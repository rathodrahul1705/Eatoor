import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  FlatList,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/Ionicons';
import { storeUserAddress } from '../../../api/address';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MapLocationPickerParams } from '../../../types/addressTypes';

// Constants
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.005;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const GOOGLE_MAP_API_KEY = "AIzaSyBKOWlVTzhP7lRcNEHbT2SNz-W_bYx3v28";
const DEFAULT_COORDINATES = {
  latitude: 19.0760,
  longitude: 72.8777,
};
const ADDRESS_TYPES = [
  { id: 'home', label: 'Home', icon: 'home-outline' },
  { id: 'office', label: 'Office', icon: 'business-outline' },
  { id: 'other', label: 'Other', icon: 'location-outline' },
];

// Location timeout constants
const LOCATION_TIMEOUT = 15000; // 15 seconds
const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: LOCATION_TIMEOUT,
  maximumAge: 10000,
};

// Responsive scaling function
const scale = (size) => (width / 375) * size;
const verticalScale = (size) => (height / 812) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Debounce utility function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const MapLocationPicker = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as MapLocationPickerParams;
  const { onLocationConfirmed, prevLocation = 'HomeTabs' } = params || {};

  // State management
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState({
    type: 'Home',
    name: '',
    address: '',
    landmark: '',
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    completeAddress: '',
    addressType: 'Home',
    customName: '',
  });
  
  const [mapRegion, setMapRegion] = useState({
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });
  
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState(null);
  const [isManualAddressEdit, setIsManualAddressEdit] = useState(false);
  const [lastFetchedCoordinates, setLastFetchedCoordinates] = useState({ 
    latitude: 0, 
    longitude: 0 
  });
  const [locationError, setLocationError] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapHeight, setMapHeight] = useState(verticalScale(300));
  const [currentLocationData, setCurrentLocationData] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Refs
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const locationTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const scrollViewRef = useRef(null);
  const keyboardDidShowListener = useRef(null);
  const keyboardDidHideListener = useRef(null);
  
  // Animation values
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;
  const mapHeightAnim = useRef(new Animated.Value(verticalScale(300))).current;

  // Keyboard listeners for responsive adjustments
  useEffect(() => {
    if (Platform.OS === 'ios') {
      keyboardDidShowListener.current = Keyboard.addListener(
        'keyboardWillShow',
        (e) => {
          setIsKeyboardVisible(true);
          setKeyboardHeight(e.endCoordinates.height);
          // Reduce map height when keyboard is shown
          Animated.timing(mapHeightAnim, {
            toValue: verticalScale(200),
            duration: 250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }).start();
        }
      );

      keyboardDidHideListener.current = Keyboard.addListener(
        'keyboardWillHide',
        () => {
          setIsKeyboardVisible(false);
          setKeyboardHeight(0);
          // Restore map height when keyboard is hidden
          Animated.timing(mapHeightAnim, {
            toValue: verticalScale(300),
            duration: 250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }).start();
        }
      );
    }

    return () => {
      if (keyboardDidShowListener.current) {
        keyboardDidShowListener.current.remove();
      }
      if (keyboardDidHideListener.current) {
        keyboardDidHideListener.current.remove();
      }
    };
  }, []);

  // Cleanup function
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initialize component
    initializeComponent();
    
    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
    };
  }, []);

  // Show/hide search results
  const showSearchResultsWithAnimation = (show) => {
    Animated.timing(searchResultsOpacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const initializeComponent = async () => {
    await Promise.all([
      fetchUserData(),
      getCurrentLocation()
    ]);
  };

  const fetchUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData && isMountedRef.current) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Try to get last known location from storage first
  const getLastKnownLocation = async () => {
    try {
      const [latitude, longitude] = await Promise.all([
        AsyncStorage.getItem('Latitude'),
        AsyncStorage.getItem('Longitude'),
      ]);
      
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          return { 
            latitude: lat, 
            longitude: lng,
            isLastKnown: true 
          };
        }
      }
    } catch (error) {
      console.error('Error getting last known location:', error);
    }
    return null;
  };

  // Reverse geocode function with proper error handling and caching
  const reverseGeocode = useCallback(async (latitude, longitude, isDraggingState = false) => {
    if (!isMountedRef.current) return;
    
    try {
      if (!isDraggingState) {
        setIsDragging(true);
      }
      
      // Create cache key
      const cacheKey = `geocode_${latitude.toFixed(6)}_${longitude.toFixed(6)}`;
      
      // Try to get from cache first
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const now = Date.now();
        const cacheAge = now - parsedData.timestamp;
        
        // Use cache if less than 1 hour old
        if (cacheAge < 3600000) {
          updateAddressFromGeocodeData(parsedData.data, latitude, longitude);
          if (!isDraggingState && isMountedRef.current) {
            setIsDragging(false);
          }
          return;
        }
      }
      
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAP_API_KEY}&language=en`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0 && isMountedRef.current) {
        // Cache the result
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: data.results[0]
        }));
        
        updateAddressFromGeocodeData(data.results[0], latitude, longitude);
        
        // Set current location data
        setCurrentLocationData({
          address: data.results[0].formatted_address,
          coordinates: { latitude, longitude },
          timestamp: new Date().toISOString()
        });
        
      } else {
        throw new Error('Geocoding failed');
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      if (!isDraggingState && isMountedRef.current) {
        Alert.alert('Error', 'Failed to get address information');
      }
    } finally {
      if (isMountedRef.current && !isDraggingState) {
        setIsDragging(false);
      }
    }
  }, []);

  const updateAddressFromGeocodeData = (geocodeData, latitude, longitude) => {
    const addressComponents = geocodeData.address_components;
    const formattedAddress = geocodeData.formatted_address;
    
    // Extract address components
    let streetNumber = '';
    let route = '';
    let city = '';
    let state = '';
    let country = '';
    let zipcode = '';
    let sublocality = '';
    
    addressComponents.forEach(component => {
      if (component.types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (component.types.includes('route')) {
        route = component.long_name;
      } else if (component.types.includes('locality')) {
        city = component.long_name;
      } else if (component.types.includes('sublocality')) {
        sublocality = component.long_name;
      } else if (component.types.includes('administrative_area_level_1')) {
        state = component.long_name;
      } else if (component.types.includes('country')) {
        country = component.long_name;
      } else if (component.types.includes('postal_code')) {
        zipcode = component.long_name;
      }
    });
    
    // Use sublocality if city is not available
    if (!city && sublocality) {
      city = sublocality;
    }
    
    const completeAddress = streetNumber && route ? `${streetNumber} ${route}` : formattedAddress;
    
    setAddress(prev => ({
      ...prev,
      completeAddress,
      city: city || prev.city,
      zipCode: zipcode || prev.zipCode,
      state: state || prev.state,
      country: country || prev.country,
      landmark: prev.landmark || '',
      latitude,
      longitude,
    }));
  };

  // Improved current location fetching with better error handling
  const getCurrentLocation = async () => {
    setLoading(true);
    setLocationLoading(true);
    setLocationError(false);
    
    try {
      // First try to get last known location
      const lastKnownLocation = await getLastKnownLocation();
      if (lastKnownLocation && isMountedRef.current) {
        console.log('Using last known location');
        updateLocation(lastKnownLocation.latitude, lastKnownLocation.longitude, true);
        setLoading(false);
        setLocationLoading(false);
        return;
      }

      // Check if geolocation is available
      if (!Geolocation) {
        throw new Error('Geolocation service not available');
      }

      // Set timeout for location request
      locationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && locationLoading) {
          console.log('Location request timeout, using default location');
          handleLocationError('Location request timeout');
        }
      }, LOCATION_TIMEOUT);

      // Request current location
      Geolocation.getCurrentPosition(
        async (position) => {
          if (locationTimeoutRef.current) {
            clearTimeout(locationTimeoutRef.current);
          }
          
          if (!isMountedRef.current) return;
          
          const { latitude, longitude } = position.coords;
          console.log('Got current location:', latitude, longitude);
          updateLocation(latitude, longitude, false);
          setLoading(false);
          setLocationLoading(false);
        },
        (error) => {
          if (locationTimeoutRef.current) {
            clearTimeout(locationTimeoutRef.current);
          }
          console.error('Error getting location:', error);
          handleLocationError(error.message);
        },
        LOCATION_OPTIONS
      );

    } catch (error) {
      console.error('Error in getCurrentLocation:', error);
      handleLocationError(error.message);
    }
  };

  const handleLocationError = (errorMessage) => {
    if (!isMountedRef.current) return;
    
    console.log('Falling back to default location');
    setLocationError(true);
    setLocationLoading(false);
    
    // Use default location as fallback
    updateLocation(DEFAULT_COORDINATES.latitude, DEFAULT_COORDINATES.longitude, false);
    setLoading(false);
    
    // Show gentle warning
    setTimeout(() => {
      if (isMountedRef.current) {
        Alert.alert(
          'Location Service',
          'Using default location. You can manually select your location on the map.',
          [{ text: 'OK' }]
        );
      }
    }, 500);
  };

  const updateLocation = async (latitude, longitude, isLastKnown = false) => {
    if (!isMountedRef.current) return;
    
    setLocation({ latitude, longitude });
    const newRegion = {
      latitude,
      longitude,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };
    setMapRegion(newRegion);
    setLastFetchedCoordinates({ latitude, longitude });
    
    // Show loading indicator for reverse geocoding
    if (!isLastKnown) {
      setIsDragging(true);
    }
    
    // Reverse geocode
    await reverseGeocode(latitude, longitude, false);
    
    // Store coordinates for future use
    try {
      await AsyncStorage.multiSet([
        ['Latitude', latitude.toString()],
        ['Longitude', longitude.toString()],
      ]);
    } catch (error) {
      console.error('Error storing coordinates:', error);
    }

    // Animate map to location
    if (mapRef.current) {
      setTimeout(() => {
        if (mapRef.current && isMountedRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }, 100);
    }
  };

  // Enhanced search places with better debouncing and error handling
  const searchPlaces = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
      return;
    }

    try {
      setIsSearching(true);
      const encodedQuery = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}&key=${GOOGLE_MAP_API_KEY}&location=${mapRegion.latitude},${mapRegion.longitude}&radius=20000&components=country:in&language=en`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && isMountedRef.current) {
        // Sort results by relevance
        const sortedResults = data.predictions.sort((a, b) => {
          // Prioritize exact matches
          if (a.structured_formatting.main_text.toLowerCase().startsWith(query.toLowerCase())) return -1;
          if (b.structured_formatting.main_text.toLowerCase().startsWith(query.toLowerCase())) return 1;
          return 0;
        });
        
        setSearchResults(sortedResults.slice(0, 8)); // Limit to 8 results
        setShowSearchResults(true);
        showSearchResultsWithAnimation(true);
      } else if (data.status === 'ZERO_RESULTS') {
        setSearchResults([]);
        setShowSearchResults(true);
        showSearchResultsWithAnimation(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
        showSearchResultsWithAnimation(false);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
    } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for search with progressive delay
    const delay = text.length < 3 ? 800 : 400;
    
    if (text.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(text);
      }, delay);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
    }
  };

  // Handle place selection from search results
  const handlePlaceSelect = async (place) => {
    try {
      setIsSearching(true);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
      setSearchQuery(place.description);
      Keyboard.dismiss();
      
      // Get place details with caching
      const cacheKey = `place_${place.place_id}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      
      let locationData;
      if (cachedData) {
        locationData = JSON.parse(cachedData);
      } else {
        const encodedPlaceId = encodeURIComponent(place.place_id);
        const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${encodedPlaceId}&key=${GOOGLE_MAP_API_KEY}&fields=geometry,name,formatted_address`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && isMountedRef.current) {
          locationData = data.result;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(locationData));
        } else {
          throw new Error('Failed to get place details');
        }
      }
      
      const location = locationData.geometry.location;
      await updateLocation(location.lat, location.lng, false);
      
      // Update search query with actual place name
      setSearchQuery(locationData.name || place.description);
      
      // Animate to the new location
      if (mapRef.current) {
        const newRegion = {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    } catch (error) {
      console.error('Place details error:', error);
      Alert.alert('Error', 'Failed to get place details. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
      }
    }
  };

  // Handle map region changes with debouncing
  const handleRegionChangeComplete = useCallback(
    debounce(async (region) => {
      if (!isMountedRef.current || !isDragging || isManualAddressEdit) return;
      
      const distanceMoved = Math.sqrt(
        Math.pow(region.latitude - lastFetchedCoordinates.latitude, 2) +
        Math.pow(region.longitude - lastFetchedCoordinates.longitude, 2)
      );
      
      // Only update if moved a significant distance
      if (distanceMoved < 0.00005) return;

      setMapRegion(region);
      setLastFetchedCoordinates({
        latitude: region.latitude,
        longitude: region.longitude,
      });
      
      setLocation({
        latitude: region.latitude,
        longitude: region.longitude,
      });
      
      await reverseGeocode(region.latitude, region.longitude, true);
      
      await AsyncStorage.multiSet([
        ['Latitude', region.latitude.toString()],
        ['Longitude', region.longitude.toString()],
      ]);
    }, 800),
    [isDragging, lastFetchedCoordinates, isManualAddressEdit, reverseGeocode]
  );

  // Address form handlers
  const handleAddressTypeChange = (type) => {
    setAddress(prev => ({ ...prev, addressType: type }));
  };

  const handleInputChange = (field, value) => {
    setAddress(prev => ({ ...prev, [field]: value }));
    if (['completeAddress', 'city', 'zipCode', 'state', 'country'].includes(field)) {
      setIsManualAddressEdit(true);
    }
  };

  const handleInputFocus = (field) => {
    // Scroll to input field when focused
    setTimeout(() => {
      if (scrollViewRef.current) {
        let yOffset = mapHeightAnim._value + verticalScale(100);
        if (Platform.OS === 'ios' && isKeyboardVisible) {
          yOffset -= keyboardHeight / 2;
        }
        scrollViewRef.current.scrollTo({ y: yOffset, animated: true });
      }
    }, 300);
  };

  const handleInputBlur = () => {
    // Reset manual edit flag after delay
    setTimeout(() => {
      setIsManualAddressEdit(false);
    }, 2000);
  };

  // Address validation and submission
  const validateAddress = () => {
    const requiredFields = ['completeAddress', 'city', 'zipCode', 'state', 'country'];
    const missingFields = requiredFields.filter(field => !address[field]?.trim());
    
    if (missingFields.length > 0) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      
      // Highlight missing fields
      missingFields.forEach(field => {
        // You could add visual feedback here
      });
      
      return false;
    }
    
    if (address.addressType === 'Other' && !address.customName?.trim()) {
      Alert.alert('Missing Information', 'Please provide a name for this location');
      return false;
    }
    
    // Validate zip code format
    if (address.zipCode && !/^\d{5,6}$/.test(address.zipCode.trim())) {
      Alert.alert('Invalid Zip Code', 'Please enter a valid zip code');
      return false;
    }
    
    return true;
  };

  const prepareAddressPayload = () => {
    return {
      street_address: address.completeAddress.trim(),
      user: user?.id || 0,
      city: address.city.trim(),
      state: address.state.trim(),
      zip_code: address.zipCode.trim(),
      country: address.country.trim(),
      near_by_landmark: address.landmark?.trim() || '',
      home_type: address.addressType,
      name_of_location: address.addressType === 'Other' ? address.customName.trim() : address.addressType,
      latitude: location?.latitude?.toFixed(6) || DEFAULT_COORDINATES.latitude.toFixed(6),
      longitude: location?.longitude?.toFixed(6) || DEFAULT_COORDINATES.longitude.toFixed(6),
      is_default: false,
    };
  };

  const handleSaveAddress = async () => {
    if (!validateAddress()) return;

    try {
      setIsSubmitting(true);
      
      const payload = prepareAddressPayload();
      const response = await storeUserAddress(payload);
      
      if (response.data && isMountedRef.current) {
        const newAddress = {
          ...address,
          id: response.data.address_id || Math.random().toString(36).substring(7),
          isDefault: false,
        };

        // Store coordinates and address details
        await AsyncStorage.multiSet([
          ['AddressId', String(response.data.id)],
          ['StreetAddress', String(address.completeAddress || address.address)],
          ['HomeType', String(response.data.home_type || address.addressType)],
          ['Latitude', String(response.data.latitude || address.latitude)],
          ['Longitude', String(response.data.longitude || address.longitude)],
        ]);

        setTimeout(() => {
          navigation.navigate(prevLocation);
        }, 300);
      } else {
        throw new Error(response.data?.message || 'Failed to save address');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', error.message || 'Failed to save address. Please try again.');
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  // Render functions
  const renderSearchItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchItem}
      onPress={() => handlePlaceSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchItemIconContainer}>
        <Icon 
          name={item.types?.includes('establishment') ? "business-outline" : "location-outline"} 
          size={moderateScale(16)} 
          color="#FF6B35" 
        />
      </View>
      <View style={styles.searchItemTextContainer}>
        <Text style={styles.searchItemPrimaryText} numberOfLines={1}>
          {item.structured_formatting.main_text}
        </Text>
        <Text style={styles.searchItemSecondaryText} numberOfLines={2}>
          {item.structured_formatting.secondary_text}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptySearchResults = () => (
    <View style={styles.emptySearchContainer}>
      <Icon name="search-outline" size={moderateScale(40)} color="#CCCCCC" />
      <Text style={styles.emptySearchText}>No results found</Text>
      <Text style={styles.emptySearchSubtext}>Try a different search term</Text>
    </View>
  );

  const renderAddressTypeButtons = () => (
    <View style={styles.addressTypeContainer}>
      {ADDRESS_TYPES.map((type) => {
        const isSelected = address.addressType === type.label;
        return (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.addressTypeButton,
              isSelected && styles.addressTypeButtonSelected,
            ]}
            onPress={() => handleAddressTypeChange(type.label)}
            activeOpacity={0.7}
          >
            <View 
              style={[
                styles.addressTypeButtonInner,
                isSelected && styles.addressTypeButtonInnerSelected,
              ]}
            >
              <Icon 
                name={type.icon} 
                size={moderateScale(14)} 
                color={isSelected ? '#FFF' : '#666'} 
              />
              <Text
                style={[
                  styles.addressTypeText,
                  isSelected && styles.addressTypeTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderCurrentLocationInfo = () => {
    if (!currentLocationData || !location) return null;
    
    return (
      <View style={styles.currentLocationInfo}>
        <View style={styles.currentLocationIcon}>
          <Icon name="navigate" size={moderateScale(14)} color="#FF6B35" />
        </View>
        <Text style={styles.currentLocationText} numberOfLines={2}>
          {currentLocationData.address}
        </Text>
      </View>
    );
  };

  const renderMapSection = () => (
    <Animated.View style={[styles.mapContainer, { height: mapHeightAnim }]}>
      {loading ? (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.mapLoadingText}>Getting your location...</Text>
          {locationError && (
            <Text style={styles.mapLoadingSubtext}>
              This may take a moment. Please ensure location services are enabled.
            </Text>
          )}
        </View>
      ) : (
        <>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={mapRegion}
            provider={PROVIDER_GOOGLE}
            showsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={true}
            showsScale={true}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPanDrag={() => setIsDragging(true)}
            onPanDragStart={() => setIsDragging(true)}
            onPanDragEnd={() => setIsDragging(false)}
            loadingEnabled={true}
            loadingIndicatorColor="#FF6B35"
            loadingBackgroundColor="#FFFFFF"
          >
            {location && (
              <Marker
                coordinate={location}
                draggable
                onDragStart={() => setIsDragging(true)}
                onDragEnd={(e) => {
                  const newLocation = e.nativeEvent.coordinate;
                  setLocation(newLocation);
                  handleRegionChangeComplete({
                    ...newLocation,
                    latitudeDelta: mapRegion.latitudeDelta,
                    longitudeDelta: mapRegion.longitudeDelta,
                  });
                }}
              >
                <Animated.View style={styles.markerContainer}>
                  <View style={styles.markerPin}>
                    <Icon name="location" size={moderateScale(20)} color="#FFF" />
                  </View>
                  <View style={styles.markerBase} />
                </Animated.View>
              </Marker>
            )}
          </MapView>

          {/* Map Center Indicator */}
          <View style={styles.mapCenterIndicator}>
            <Icon name="caret-down" size={moderateScale(24)} color="#FF6B35" />
          </View>

          {/* Current Location Button */}
          <TouchableOpacity 
            style={styles.currentLocationButton} 
            onPress={getCurrentLocation}
            activeOpacity={0.8}
            disabled={locationLoading}
          >
            <View style={[
              styles.locationButtonInner,
              locationLoading && styles.locationButtonInnerDisabled
            ]}>
              {locationLoading ? (
                <ActivityIndicator size="small" color="#FF6B35" />
              ) : (
                <Icon name="locate" size={moderateScale(20)} color="#FF6B35" />
              )}
            </View>
          </TouchableOpacity>

          {/* Current Location Info Banner */}
          {renderCurrentLocationInfo()}

          {locationError && (
            <View style={styles.locationErrorBanner}>
              <Icon name="warning-outline" size={moderateScale(14)} color="#FFF" />
              <Text style={styles.locationErrorText}>Using default location</Text>
            </View>
          )}

          {isDragging && (
            <View style={styles.draggingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.draggingText}>Updating address...</Text>
            </View>
          )}
        </>
      )}
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                >
                  <Icon name="arrow-back" size={moderateScale(20)} color="#333" />
                </TouchableOpacity>
                
                <View style={[
                  styles.searchContainer,
                  isSearchFocused && styles.searchContainerFocused
                ]}>
                  <Icon name="search" size={moderateScale(16)} color="#999" style={styles.searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder="Search for address or place"
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      if (searchQuery.trim().length > 0) {
                        searchPlaces(searchQuery);
                      }
                    }}
                    clearButtonMode="while-editing"
                  />
                  {isSearching && (
                    <ActivityIndicator size="small" color="#FF6B35" style={styles.searchLoading} />
                  )}
                </View>
              </View>
            </View>

            {/* Search Results Dropdown */}
            <Animated.View 
              style={[
                styles.searchResultsContainer,
                {
                  opacity: searchResultsOpacity,
                  transform: [{
                    translateY: searchResultsOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0]
                    })
                  }],
                  display: showSearchResults ? 'flex' : 'none'
                }
              ]}
            >
              {showSearchResults && (
                <>
                  <View style={styles.searchResultsHeader}>
                    <Text style={styles.searchResultsTitle}>Search Results</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        setShowSearchResults(false);
                        showSearchResultsWithAnimation(false);
                      }}
                      style={styles.closeResultsButton}
                    >
                      <Icon name="close" size={moderateScale(18)} color="#666" />
                    </TouchableOpacity>
                  </View>
                  {searchResults.length > 0 ? (
                    <FlatList
                      data={searchResults}
                      renderItem={renderSearchItem}
                      keyExtractor={(item) => item.place_id}
                      keyboardShouldPersistTaps="always"
                      style={styles.searchResultsList}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={styles.searchResultsContent}
                    />
                  ) : (
                    renderEmptySearchResults()
                  )}
                </>
              )}
            </Animated.View>

            {/* Main ScrollView containing Map and Form */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.mainScrollView}
              showsVerticalScrollIndicator={false}
              bounces={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContentContainer}
              onScroll={({ nativeEvent }) => {
                // Optional: Hide search results when scrolling
                if (nativeEvent.contentOffset.y > 50 && showSearchResults) {
                  setShowSearchResults(false);
                  showSearchResultsWithAnimation(false);
                }
              }}
              scrollEventThrottle={16}
            >
              {/* Map Section */}
              {renderMapSection()}

              {/* Address Form Section */}
              <View style={styles.formContainer}>
                <View style={styles.formHeader}>
                  <Text style={styles.sectionTitle}>Add Address</Text>
                  <Text style={styles.sectionDescription}>
                    Confirm or edit your location details
                  </Text>
                </View>
                
                {/* Address Type Selection */}
                <Text style={styles.sectionSubtitle}>Address Type</Text>
                {renderAddressTypeButtons()}

                {/* Custom Name Field (only for Other) */}
                {address.addressType === 'Other' && (
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      Name of location <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={address.customName}
                      onChangeText={(text) => handleInputChange('customName', text)}
                      onFocus={() => handleInputFocus('customName')}
                      onBlur={handleInputBlur}
                      placeholder="e.g., Grandma's House, Gym"
                      placeholderTextColor="#999"
                    />
                  </View>
                )}

                {/* Complete Address */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    Complete Address <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={address.completeAddress}
                    onChangeText={(text) => handleInputChange('completeAddress', text)}
                    onFocus={() => handleInputFocus('completeAddress')}
                    onBlur={handleInputBlur}
                    placeholder="Full address including street name, building, etc."
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Landmark */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Landmark (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={address.landmark}
                    onChangeText={(text) => handleInputChange('landmark', text)}
                    onFocus={() => handleInputFocus('landmark')}
                    onBlur={handleInputBlur}
                    placeholder="e.g., Near Metro Station, Opposite Bank"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.row}>
                  {/* City */}
                  <View style={[styles.inputContainer, styles.flex1]}>
                    <Text style={styles.label}>
                      City <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={address.city}
                      onChangeText={(text) => handleInputChange('city', text)}
                      onFocus={() => handleInputFocus('city')}
                      onBlur={handleInputBlur}
                      placeholder="City"
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Zipcode */}
                  <View style={[styles.inputContainer, styles.flex1, styles.zipInput]}>
                    <Text style={styles.label}>
                      Zipcode <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={address.zipCode}
                      onChangeText={(text) => handleInputChange('zipCode', text)}
                      onFocus={() => handleInputFocus('zipCode')}
                      onBlur={handleInputBlur}
                      placeholder="e.g., 400001"
                      placeholderTextColor="#999"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  {/* State */}
                  <View style={[styles.inputContainer, styles.flex1]}>
                    <Text style={styles.label}>
                      State <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={address.state}
                      onChangeText={(text) => handleInputChange('state', text)}
                      onFocus={() => handleInputFocus('state')}
                      onBlur={handleInputBlur}
                      placeholder="State"
                      placeholderTextColor="#999"
                    />
                  </View>

                  {/* Country */}
                  <View style={[styles.inputContainer, styles.flex1]}>
                    <Text style={styles.label}>
                      Country <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={address.country}
                      onChangeText={(text) => handleInputChange('country', text)}
                      onFocus={() => handleInputFocus('country')}
                      onBlur={handleInputBlur}
                      placeholder="Country"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                {/* Coordinates Info */}
                <View style={styles.coordinatesInfo}>
                  <Text style={styles.coordinatesLabel}>Coordinates</Text>
                  <Text style={styles.coordinatesText}>
                    Lat: {location?.latitude?.toFixed(6) || 'N/A'}, 
                    Lng: {location?.longitude?.toFixed(6) || 'N/A'}
                  </Text>
                </View>

                {/* Extra padding for save button */}
                <View style={{ height: verticalScale(100) }} />
              </View>
            </ScrollView>

            {/* Fixed Save Button */}
            <View style={[
              styles.saveButtonContainer,
              isKeyboardVisible && styles.saveButtonContainerKeyboard
            ]}>
              <TouchableOpacity 
                style={[styles.saveButton, (isSubmitting || loading) && styles.saveButtonDisabled]} 
                onPress={handleSaveAddress}
                disabled={isSubmitting || loading}
                activeOpacity={0.8}
              >
                <View style={styles.saveButtonContent}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="checkmark-circle-outline" size={moderateScale(18)} color="#FFF" style={styles.saveIcon} />
                      <Text style={styles.saveButtonText}>Save Address</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    zIndex: 40,
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0,
    paddingBottom: verticalScale(12),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(2) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(8),
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    marginTop: Platform.OS === 'ios' ? verticalScale(8) : 0,
  },
  backButton: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#F8F9FA',
    marginRight: moderateScale(12),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    height: verticalScale(44),
    borderWidth: moderateScale(1.5),
    borderColor: '#F0F0F0',
  },
  searchContainerFocused: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    marginRight: moderateScale(8),
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#2D3436',
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  clearButton: {
    padding: moderateScale(4),
  },
  searchLoading: {
    marginLeft: moderateScale(8),
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: verticalScale(120),
  },
  searchResultsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? verticalScale(100) : verticalScale(90),
    left: moderateScale(16),
    right: moderateScale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(12),
    maxHeight: verticalScale(320),
    zIndex: 50,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(6) },
        shadowOpacity: 0.15,
        shadowRadius: moderateScale(12),
      },
      android: {
        elevation: 10,
      },
    }),
    borderWidth: moderateScale(1),
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    borderBottomWidth: moderateScale(1),
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  searchResultsTitle: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  closeResultsButton: {
    padding: moderateScale(4),
  },
  searchResultsList: {
    borderRadius: moderateScale(12),
  },
  searchResultsContent: {
    paddingBottom: moderateScale(8),
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: moderateScale(14),
    borderBottomWidth: moderateScale(1),
    borderBottomColor: '#F8F9FA',
  },
  searchItemIconContainer: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: moderateScale(18),
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  searchItemTextContainer: {
    flex: 1,
  },
  searchItemPrimaryText: {
    fontSize: moderateScale(14),
    color: '#2D3436',
    marginBottom: moderateScale(2),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  searchItemSecondaryText: {
    fontSize: moderateScale(12),
    color: '#7F8C8D',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: moderateScale(16),
  },
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(40),
  },
  emptySearchText: {
    fontSize: moderateScale(16),
    color: '#666',
    marginTop: verticalScale(12),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  emptySearchSubtext: {
    fontSize: moderateScale(14),
    color: '#999',
    marginTop: verticalScale(4),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapCenterIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: moderateScale(-12),
    marginTop: moderateScale(-24),
    zIndex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    height: '100%',
  },
  mapLoadingText: {
    marginTop: verticalScale(12),
    color: '#333333',
    fontSize: moderateScale(16),
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    textAlign: 'center',
  },
  mapLoadingSubtext: {
    marginTop: verticalScale(8),
    color: '#666',
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    textAlign: 'center',
    paddingHorizontal: moderateScale(40),
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#FF6B35',
    borderWidth: moderateScale(3),
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(6),
      },
      android: {
        elevation: 6,
      },
    }),
  },
  markerBase: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
    backgroundColor: '#FF6B35',
    position: 'absolute',
    bottom: moderateScale(-20),
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: verticalScale(20),
    right: moderateScale(16),
    backgroundColor: '#FFFFFF',
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: moderateScale(26),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(4) },
        shadowOpacity: 0.2,
        shadowRadius: moderateScale(8),
      },
      android: {
        elevation: 6,
      },
    }),
    zIndex: 10,
  },
  locationButtonInner: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: moderateScale(1.5),
    borderColor: '#FF6B35',
  },
  locationButtonInnerDisabled: {
    opacity: 0.7,
  },
  currentLocationInfo: {
    position: 'absolute',
    top: verticalScale(12),
    left: moderateScale(12),
    right: moderateScale(12),
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: moderateScale(12),
    padding: moderateScale(12),
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(2) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
      },
      android: {
        elevation: 4,
      },
    }),
    zIndex: 5,
  },
  currentLocationIcon: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(10),
  },
  currentLocationText: {
    flex: 1,
    fontSize: moderateScale(13),
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    lineHeight: moderateScale(18),
  },
  locationErrorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 149, 0, 0.95)',
    padding: moderateScale(12),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 5,
  },
  locationErrorText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: moderateScale(6),
    fontSize: moderateScale(13),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  draggingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 107, 53, 0.95)',
    padding: moderateScale(12),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomLeftRadius: moderateScale(12),
    borderBottomRightRadius: moderateScale(12),
    zIndex: 5,
  },
  draggingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: moderateScale(8),
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: moderateScale(20),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(20),
  },
  formHeader: {
    marginBottom: verticalScale(20),
  },
  sectionTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
    marginBottom: moderateScale(4),
  },
  sectionDescription: {
    fontSize: moderateScale(14),
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sectionSubtitle: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: '#636E72',
    marginBottom: verticalScale(12),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  addressTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(24),
    gap: moderateScale(8),
  },
  addressTypeButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    borderWidth: moderateScale(1.5),
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  addressTypeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(8),
    borderRadius: moderateScale(10),
  },
  addressTypeButtonInnerSelected: {
    backgroundColor: '#FF6B35',
  },
  addressTypeButtonSelected: {
    borderColor: '#FF6B35',
  },
  addressTypeText: {
    color: '#636E72',
    fontWeight: '600',
    fontSize: moderateScale(13),
    marginLeft: moderateScale(6),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  addressTypeTextSelected: {
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: verticalScale(16),
  },
  label: {
    color: '#2D3436',
    marginBottom: verticalScale(8),
    fontWeight: '600',
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  requiredStar: {
    color: '#FF6B35',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: moderateScale(1.5),
    borderColor: '#F0F0F0',
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    fontSize: moderateScale(15),
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    includeFontPadding: false,
  },
  textArea: {
    minHeight: verticalScale(100),
    textAlignVertical: 'top',
    lineHeight: moderateScale(20),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: moderateScale(12),
  },
  flex1: {
    flex: 1,
  },
  zipInput: {
    marginLeft: 0,
  },
  coordinatesInfo: {
    marginTop: verticalScale(20),
    padding: moderateScale(12),
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    borderLeftWidth: moderateScale(3),
    borderLeftColor: '#FF6B35',
  },
  coordinatesLabel: {
    fontSize: moderateScale(12),
    color: '#666',
    marginBottom: moderateScale(4),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  coordinatesText: {
    fontSize: moderateScale(13),
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: moderateScale(16),
    paddingBottom: Platform.OS === 'ios' ? verticalScale(24) : verticalScale(20),
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(-2) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 30,
  },
  saveButtonContainerKeyboard: {
    paddingBottom: moderateScale(16),
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: verticalScale(16),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(14),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: moderateScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(8),
      },
      android: {
        elevation: 6,
      },
    }),
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#DFE6E9',
    ...Platform.select({
      ios: {
        shadowColor: '#DFE6E9',
        shadowOpacity: 0.2,
      },
    }),
  },
  saveIcon: {
    marginRight: moderateScale(10),
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },
});

export default MapLocationPicker;