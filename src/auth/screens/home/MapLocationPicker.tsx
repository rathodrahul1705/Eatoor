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
const ADDRESS_TYPES = ['Home', 'Office', 'Other'];

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

  // Refs
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Cleanup function
  useEffect(() => {
    isMountedRef.current = true;
    
    // Animate form sliding up
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    }).start();
    
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    // Initialize component
    initializeComponent();
    
    return () => {
      isMountedRef.current = false;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const initializeComponent = async () => {
    await fetchUserData();
    getCurrentLocation();
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

  // Get current location
  const getCurrentLocation = () => {
    setLoading(true);
    Geolocation.getCurrentPosition(
      async (position) => {
        if (!isMountedRef.current) return;
        
        const { latitude, longitude } = position.coords;
        updateLocation(latitude, longitude);
        setLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Failed to get current location');
        setLoading(false);
        
        // Fallback to default location
        updateLocation(DEFAULT_COORDINATES.latitude, DEFAULT_COORDINATES.longitude);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const updateLocation = async (latitude, longitude) => {
    setLocation({ latitude, longitude });
    const newRegion = {
      latitude,
      longitude,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };
    setMapRegion(newRegion);
    setLastFetchedCoordinates({ latitude, longitude });
    await reverseGeocode(latitude, longitude, false);
    
    // Store coordinates
    await AsyncStorage.multiSet([
      ['Latitude', latitude.toString()],
      ['Longitude', longitude.toString()],
    ]);
  };

  // Search places with debouncing
  const searchPlaces = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
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
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
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
    }
  };

  // Handle place selection from search results
  const handlePlaceSelect = async (place) => {
    try {
      setIsSearching(true);
      setShowSearchResults(false);
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

  // Render functions for better code organization
  const renderSearchItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchItem}
      onPress={() => handlePlaceSelect(item)}
    >
      <Icon name="location-outline" size={20} color="#666" style={styles.searchItemIcon} />
      <View style={styles.searchItemTextContainer}>
        <Text style={styles.searchItemPrimaryText} numberOfLines={1}>
          {item.structured_formatting.main_text}
        </Text>
        <Text style={styles.searchItemSecondaryText} numberOfLines={1}>
          {item.structured_formatting.secondary_text}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderAddressTypeButtons = () => (
    <View style={styles.addressTypeContainer}>
      {ADDRESS_TYPES.map((type) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.addressTypeButton,
            address.addressType === type && styles.addressTypeButtonSelected,
          ]}
          onPress={() => handleAddressTypeChange(type)}
        >
          <Icon 
            name={
              type === 'Home' ? 'home-outline' : 
              type === 'Office' ? 'business-outline' : 
              'location-outline'
            } 
            size={16} 
            color={address.addressType === type ? '#FFF' : '#666'} 
            style={styles.addressTypeIcon}
          />
          <Text
            style={[
              styles.addressTypeText,
              address.addressType === type && styles.addressTypeTextSelected,
            ]}
          >
            {type}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E65C00" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  // Animation interpolation
  const formTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Select Location</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          {/* Map Section */}
          <View style={styles.mapContainer}>
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
                      <Icon name="location" size={16} color="#FFF" />
                    </View>
                    <View style={styles.markerBase} />
                  </View>
                </Marker>
              )}
            </MapView>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
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
                    }}
                    style={styles.clearButton}
                  >
                    <Icon name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              {isSearching && (
                <ActivityIndicator size="small" color="#E65C00" style={styles.searchLoading} />
              )}
            </View>

            {/* Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <View style={styles.searchResultsContainer}>
                <FlatList
                  data={searchResults}
                  renderItem={renderSearchItem}
                  keyExtractor={(item) => item.place_id}
                  keyboardShouldPersistTaps="handled"
                  style={styles.searchResultsList}
                />
              </View>
            )}

            {/* Current Location Button */}
            <TouchableOpacity style={styles.currentLocationButton} onPress={getCurrentLocation}>
              <View style={styles.locationButtonInner}>
                <Icon name="locate" size={20} color="#E65C00" />
              </View>
            </TouchableOpacity>

            {isDragging && (
              <View style={styles.draggingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.draggingText}>Updating address...</Text>
              </View>
            )}
          </View>

          {/* Address Form Section */}
          <Animated.View style={[
            styles.formContainer, 
            { transform: [{ translateY: formTranslateY }] }
          ]}>
            <ScrollView 
              style={styles.formScrollContainer} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionTitle}>Save Address As</Text>
              
              {/* Address Type Selection */}
              {renderAddressTypeButtons()}

              {/* Custom Name Field (only for Other) */}
              {address.addressType === 'Other' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Name of location *</Text>
                  <TextInput
                    style={styles.input}
                    value={address.customName}
                    onChangeText={(text) => handleInputChange('customName', text)}
                    onBlur={handleInputBlur}
                    placeholder="Enter location name"
                    placeholderTextColor="#999"
                  />
                </View>
              )}

              {/* Complete Address */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Complete Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={address.completeAddress}
                  onChangeText={(text) => handleInputChange('completeAddress', text)}
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
                  onBlur={handleInputBlur}
                  placeholder="Nearby landmark"
                  placeholderTextColor="#999"
                />
              </View>

              {/* City, Zipcode */}
              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.flex1]}>
                  <Text style={styles.label}>City *</Text>
                  <TextInput
                    style={styles.input}
                    value={address.city}
                    onChangeText={(text) => handleInputChange('city', text)}
                    onBlur={handleInputBlur}
                    placeholder="City"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={[styles.inputContainer, styles.flex1, styles.zipInput]}>
                  <Text style={styles.label}>Zipcode *</Text>
                  <TextInput
                    style={styles.input}
                    value={address.zipCode}
                    onChangeText={(text) => handleInputChange('zipCode', text)}
                    onBlur={handleInputBlur}
                    placeholder="Zip code"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* State, Country */}
              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.flex1]}>
                  <Text style={styles.label}>State *</Text>
                  <TextInput
                    style={styles.input}
                    value={address.state}
                    onChangeText={(text) => handleInputChange('state', text)}
                    onBlur={handleInputBlur}
                    placeholder="State"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={[styles.inputContainer, styles.flex1]}>
                  <Text style={styles.label}>Country *</Text>
                  <TextInput
                    style={styles.input}
                    value={address.country}
                    onChangeText={(text) => handleInputChange('country', text)}
                    onBlur={handleInputBlur}
                    placeholder="Country"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity 
                style={[styles.saveButton, isSubmitting && styles.saveButtonDisabled]} 
                onPress={handleSaveAddress}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Address</Text>
                )}
              </TouchableOpacity>

              <View style={styles.spacer} />
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    color: '#333333',
    fontSize: 16,
  },
  header: {
    marginTop:30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
    }),
    zIndex: 10,
  },
  backButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  mapContainer: {
    height: '45%',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
        shadowColor: '#000',
      },
    }),
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#333333',
    fontSize: 16,
    ...Platform.select({
      ios: {
        paddingVertical: 8,
      },
    }),
  },
  clearButton: {
    padding: 4,
  },
  searchLoading: {
    marginLeft: 8,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 68,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
        shadowColor: '#000',
      },
    }),
    zIndex: 1000,
  },
  searchResultsList: {
    borderRadius: 12,
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchItemIcon: {
    marginRight: 12,
  },
  searchItemTextContainer: {
    flex: 1,
  },
  searchItemPrimaryText: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,
  },
  searchItemSecondaryText: {
    fontSize: 14,
    color: '#666666',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E65C00',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  markerBase: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E65C00',
    position: 'absolute',
    bottom: -15,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  locationButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  draggingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(230, 92, 0, 0.8)',
    padding: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  draggingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
      },
    }),
  },
  formScrollContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
  },
  addressTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  addressTypeButton: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  addressTypeButtonSelected: {
    backgroundColor: '#E65C00',
    borderColor: '#E65C00',
  },
  addressTypeIcon: {
    marginRight: 6,
  },
  addressTypeText: {
    color: '#666666',
    fontWeight: '600',
  },
  addressTypeTextSelected: {
    color: '#FFFFFF',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#333333',
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flex1: {
    flex: 1,
  },
  zipInput: {
    marginLeft: 10,
  },
  saveButton: {
    backgroundColor: '#E65C00',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  saveButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  spacer: {
    height: 20,
  },
});

export default MapLocationPicker;