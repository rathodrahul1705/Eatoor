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
const LOCATION_TIMEOUT = 10000; // 10 seconds
const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: LOCATION_TIMEOUT,
  maximumAge: 30000,
};

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
  const [mapHeight, setMapHeight] = useState(height * 0.4);

  // Refs
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const locationTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const scrollViewRef = useRef(null);
  
  // Animation values
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;

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
          return { latitude: lat, longitude: lng };
        }
      }
    } catch (error) {
      console.error('Error getting last known location:', error);
    }
    return null;
  };

  // Reverse geocode function with proper error handling
  const reverseGeocode = useCallback(async (latitude, longitude, isDraggingState = false) => {
    if (!isMountedRef.current) return;
    
    try {
      setIsDragging(true);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAP_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0 && isMountedRef.current) {
        const addressComponents = data.results[0].address_components;
        const formattedAddress = data.results[0].formatted_address;
        
        // Extract address components
        let streetNumber = '';
        let route = '';
        let city = '';
        let state = '';
        let country = '';
        let zipcode = '';
        
        addressComponents.forEach(component => {
          if (component.types.includes('street_number')) {
            streetNumber = component.long_name;
          } else if (component.types.includes('route')) {
            route = component.long_name;
          } else if (component.types.includes('locality') || component.types.includes('postal_town')) {
            city = component.long_name;
          } else if (component.types.includes('administrative_area_level_1')) {
            state = component.long_name;
          } else if (component.types.includes('country')) {
            country = component.long_name;
          } else if (component.types.includes('postal_code')) {
            zipcode = component.long_name;
          }
        });
        
        const completeAddress = streetNumber && route ? `${streetNumber} ${route}` : formattedAddress;
        
        setAddress(prev => ({
          ...prev,
          completeAddress,
          city,
          zipCode: zipcode,
          state,
          country,
          landmark: prev.landmark || '',
          latitude,
          longitude,
        }));
      } else {
        throw new Error('Geocoding failed');
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      if (!isDraggingState && isMountedRef.current) {
        Alert.alert('Error', 'Failed to get address information');
      }
    } finally {
      if (isMountedRef.current) {
        setIsDragging(false);
      }
    }
  }, []);

  // Get current location with improved timeout handling
  const getCurrentLocation = async () => {
    setLoading(true);
    setLocationError(false);
    
    try {
      // First try to get last known location
      const lastKnownLocation = await getLastKnownLocation();
      if (lastKnownLocation && isMountedRef.current) {
        console.log('Using last known location');
        updateLocation(lastKnownLocation.latitude, lastKnownLocation.longitude);
        setLoading(false);
        return;
      }

      // Set timeout for location request
      locationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && loading) {
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
          updateLocation(latitude, longitude);
          setLoading(false);
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
    
    // Use default location as fallback
    updateLocation(DEFAULT_COORDINATES.latitude, DEFAULT_COORDINATES.longitude);
    setLoading(false);
    
    // Show gentle warning instead of alert
    setTimeout(() => {
      if (isMountedRef.current) {
        Alert.alert(
          'Location Service',
          'Using default location. You can manually select your location on the map.',
          [{ text: 'OK' }]
        );
      }
    }, 1000);
  };

  const updateLocation = async (latitude, longitude) => {
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
    
    // Reverse geocode in background without blocking UI
    reverseGeocode(latitude, longitude, false);
    
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

  // Search places with debouncing
  const searchPlaces = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
      return;
    }

    try {
      setIsSearching(true);
      const encodedQuery = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedQuery}&key=${GOOGLE_MAP_API_KEY}&location=${mapRegion.latitude},${mapRegion.longitude}&radius=20000`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && isMountedRef.current) {
        setSearchResults(data.predictions);
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
    
    // Set new timeout for search
    if (text.trim().length > 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(text);
      }, 500);
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
      
      // Get place details
      const encodedPlaceId = encodeURIComponent(place.place_id);
      const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${encodedPlaceId}&key=${GOOGLE_MAP_API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && isMountedRef.current) {
        const location = data.result.geometry.location;
        await updateLocation(location.lat, location.lng);
        
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
      } else {
        Alert.alert('Error', 'Failed to get place details');
      }
    } catch (error) {
      console.error('Place details error:', error);
      Alert.alert('Error', 'Failed to get place details');
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
      if (distanceMoved < 0.0001) return;

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
    }, 500),
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
        scrollViewRef.current.scrollTo({ y: mapHeight + 100, animated: true });
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
    const missingFields = requiredFields.filter(field => !address[field]);
    
    if (missingFields.length > 0) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return false;
    }
    
    if (address.addressType === 'Other' && !address.customName) {
      Alert.alert('Missing Information', 'Please provide a name for this location');
      return false;
    }
    
    return true;
  };

  const prepareAddressPayload = () => {
    return {
      street_address: address.completeAddress,
      user: user?.id || 0,
      city: address.city,
      state: address.state,
      zip_code: address.zipCode,
      country: address.country,
      near_by_landmark: address.landmark,
      home_type: address.addressType,
      name_of_location: address.addressType === 'Other' ? address.customName : address.addressType,
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

        if (onLocationConfirmed) {
          onLocationConfirmed(newAddress);
        }

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
        <Icon name="location-outline" size={16} color="#FF6B35" />
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
                size={14} 
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

  const renderMapSection = () => (
    <View style={[styles.mapContainer, { height: mapHeight }]}>
      {loading ? (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.mapLoadingText}>Getting your location...</Text>
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
            onRegionChangeComplete={handleRegionChangeComplete}
            onPanDrag={() => setIsDragging(true)}
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
                <View style={styles.markerContainer}>
                  <View style={styles.markerPin}>
                    <Icon name="location" size={20} color="#FFF" />
                  </View>
                  <View style={styles.markerBase} />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Current Location Button */}
          <TouchableOpacity 
            style={styles.currentLocationButton} 
            onPress={getCurrentLocation}
            activeOpacity={0.8}
          >
            <View style={styles.locationButtonInner}>
              <Icon name="locate" size={20} color="#FF6B35" />
            </View>
          </TouchableOpacity>

          {locationError && (
            <View style={styles.locationErrorBanner}>
              <Icon name="warning-outline" size={14} color="#FFF" />
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
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
                  <Icon name="arrow-back" size={20} color="#333" />
                </TouchableOpacity>
                
                <View style={styles.searchContainer}>
                  <Icon name="search" size={16} color="#999" style={styles.searchIcon} />
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
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity 
                      onPress={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                        showSearchResultsWithAnimation(false);
                      }}
                      style={styles.clearButton}
                    >
                      <Icon name="close-circle" size={16} color="#999" />
                    </TouchableOpacity>
                  )}
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
                  }]
                }
              ]}
            >
              {showSearchResults && searchResults.length > 0 && (
                <FlatList
                  data={searchResults}
                  renderItem={renderSearchItem}
                  keyExtractor={(item) => item.place_id}
                  keyboardShouldPersistTaps="always"
                  style={styles.searchResultsList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </Animated.View>

            {/* Main ScrollView containing Map and Form */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.mainScrollView}
              showsVerticalScrollIndicator={true}
              bounces={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContentContainer}
            >
              {/* Map Section */}
              {renderMapSection()}

              {/* Address Form Section */}
              <View style={styles.formContainer}>
                <View style={styles.formHeader}>
                  <Text style={styles.sectionTitle}>Add Address</Text>
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
                      placeholder="Enter location name"
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
                    placeholder="Full address"
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Landmark */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Landmark</Text>
                  <TextInput
                    style={styles.input}
                    value={address.landmark}
                    onChangeText={(text) => handleInputChange('landmark', text)}
                    onFocus={() => handleInputFocus('landmark')}
                    onBlur={handleInputBlur}
                    placeholder="Nearby landmark"
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
                      placeholder="Zip code"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
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

                {/* Extra padding for save button */}
                <View style={{ height: 100 }} />
              </View>
            </ScrollView>

            {/* Fixed Save Button */}
            <View style={styles.saveButtonContainer}>
              <TouchableOpacity 
                style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]} 
                onPress={handleSaveAddress}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <View style={styles.saveButtonContent}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="checkmark-circle-outline" size={18} color="#FFF" style={styles.saveIcon} />
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
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    marginRight: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#2D3436',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  searchLoading: {
    marginLeft: 8,
  },
  mainScrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 120, // Space for save button
  },
  searchResultsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 280,
    zIndex: 50,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
  },
  searchResultsList: {
    borderRadius: 12,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  searchItemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchItemTextContainer: {
    flex: 1,
  },
  searchItemPrimaryText: {
    fontSize: 14,
    color: '#2D3436',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  searchItemSecondaryText: {
    fontSize: 12,
    color: '#7F8C8D',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    lineHeight: 16,
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    height: 300,
  },
  mapLoadingText: {
    marginTop: 12,
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B35',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  markerBase: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
    position: 'absolute',
    bottom: -20,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
    zIndex: 10,
  },
  locationButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  locationErrorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 149, 0, 0.95)',
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 5,
  },
  locationErrorText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  draggingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 107, 53, 0.95)',
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 5,
  },
  draggingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  formHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636E72',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  addressTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  addressTypeButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  addressTypeButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
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
    fontSize: 12,
    marginLeft: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  addressTypeTextSelected: {
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 14,
  },
  label: {
    color: '#2D3436',
    marginBottom: 6,
    fontWeight: '600',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  requiredStar: {
    color: '#FF6B35',
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#2D3436',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  flex1: {
    flex: 1,
  },
  zipInput: {
    marginLeft: 0,
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 30,
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
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
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
});

export default MapLocationPicker;