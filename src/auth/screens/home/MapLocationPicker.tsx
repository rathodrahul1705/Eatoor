import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  StatusBar,
  Animated,
  ActivityIndicator,
  Dimensions,
  PermissionsAndroid,
  Modal,
  PanResponder,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';
import { GOOGLE_MAPS_API_KEY } from '@env';
import axios from 'axios';
import { storeUserAddress, updateUserAddress } from '../../../api/address';

// Constants
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.005; // More zoomed in by default
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const DEFAULT_COORDINATES = {
  latitude: 19.0760,
  longitude: 72.8777,
};

// Debounce function for API calls
const debounce = (func: (...args: any[]) => void, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Initialize Google Maps for Android
if (Platform.OS === 'android') {
  MapView.setApiKey(GOOGLE_MAPS_API_KEY);
}

const MapLocationPicker = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { addressToEdit, onLocationConfirmed, prevLocation } = route.params as MapLocationPickerParams;
  
  // Refs
  const mapRef = useRef<MapView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  
  // State variables
  const [user, setUser] = useState<any>(null);
  const [address, setAddress] = useState<Omit<Address, 'id' | 'isDefault'>>({
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
  });
  const [region, setRegion] = useState({
    latitude: DEFAULT_COORDINATES.latitude,
    longitude: DEFAULT_COORDINATES.longitude,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapDragged, setIsMapDragged] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [modalPanStart, setModalPanStart] = useState(false);
  const [lastFetchedCoordinates, setLastFetchedCoordinates] = useState({
    latitude: 0,
    longitude: 0,
  });
  const [isManualAddressEdit, setIsManualAddressEdit] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  
  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  const modalTranslateY = useRef(new Animated.Value(height)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const mapHeight = useRef(new Animated.Value(height * 0.5)).current;

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        Animated.timing(mapHeight, {
          toValue: height * 0.3,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        Animated.timing(mapHeight, {
          toValue: height * 0.5,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Initialize with address to edit if provided
  useEffect(() => {
    const initializeAddress = async () => {
      try {
        let initialLat = DEFAULT_COORDINATES.latitude;
        let initialLng = DEFAULT_COORDINATES.longitude;
        
        if (addressToEdit) {
          const { id, isDefault, ...rest } = addressToEdit;
          setAddress(rest);
          initialLat = addressToEdit.latitude;
          initialLng = addressToEdit.longitude;
          setIsManualAddressEdit(true);
        } else {
          const savedLat = await AsyncStorage.getItem('Latitude');
          const savedLng = await AsyncStorage.getItem('Longitude');
          
          if (savedLat && savedLng) {
            initialLat = parseFloat(savedLat);
            initialLng = parseFloat(savedLng);
          } else {
            // Try to get current location if no saved location
            const hasPermission = await requestLocationPermission();
            if (hasPermission) {
              const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
                Geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
                );
              });
              initialLat = position.coords.latitude;
              initialLng = position.coords.longitude;
            }
          }
        }

        const newRegion = {
          latitude: initialLat,
          longitude: initialLng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };

        setRegion(newRegion);
        setLastFetchedCoordinates({
          latitude: initialLat,
          longitude: initialLng,
        });
        
        if (!addressToEdit) {
          setAddress(prev => ({
            ...prev,
            latitude: initialLat,
            longitude: initialLng,
          }));
        }

        fetchAddressFromCoordinates(initialLat, initialLng);

        setTimeout(() => {
          mapRef.current?.animateToRegion(newRegion, 1000);
        }, 500);

      } catch (error) {
        console.error('Error initializing address:', error);
      } finally {
        setIsFirstLoad(false);
      }
    };

    initializeAddress();
  }, [addressToEdit]);

  // Set navigation options
  useEffect(() => {
    navigation.setOptions({
      title: addressToEdit ? 'Edit Address' : 'Add New Address',
      headerLeft: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#E65C00" />
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: '#fff',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerTitleStyle: {
        color: '#333',
        fontWeight: '600',
        fontSize: 18,
      },
    });
  }, [addressToEdit, navigation]);

  // Fetch address from coordinates
  const fetchAddressFromCoordinates = async (lat: number, lng: number) => {
    if (isManualAddressEdit && !isFirstLoad) return;

    try {
      setIsLoading(true);
      
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        const addressComponents = result.address_components;
        const formattedAddress = result.formatted_address;

        const extractComponent = (types: string[]) => {
          const component = addressComponents.find((comp: any) => 
            types.some(type => comp.types.includes(type))
          );
          return component ? component.long_name : '';
        };

        const streetNumber = extractComponent(['street_number']);
        const route = extractComponent(['route']);
        const sublocality = extractComponent(['sublocality']);
        const locality = extractComponent(['locality']);
        const city = extractComponent(['locality', 'administrative_area_level_2']) || locality;
        const state = extractComponent(['administrative_area_level_1']);
        const postalCode = extractComponent(['postal_code']);
        const country = extractComponent(['country']) || 'India';
        
        const streetAddress = `${streetNumber} ${route}`.trim();
        const fullAddress = formattedAddress || `${streetAddress}, ${locality || sublocality}, ${state}`;
        
        const placeName = streetAddress || locality || sublocality || city || '';
        
        setAddress(prev => ({
          ...prev,
          address: prev.address === '' || !isManualAddressEdit ? fullAddress : prev.address,
          city: prev.city === '' || !isManualAddressEdit ? (city || locality || sublocality) : prev.city,
          state: prev.state === '' || !isManualAddressEdit ? state : prev.state,
          zipCode: prev.zipCode === '' || !isManualAddressEdit ? postalCode : prev.zipCode,
          country: prev.country === '' || !isManualAddressEdit ? country : prev.country,
          latitude: lat,
          longitude: lng,
        }));

        setSelectedPlaceName(placeName);
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      Alert.alert('Error', 'Could not fetch address details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search for places with debounce
  const handleSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      try {
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:in&location=${region.latitude},${region.longitude}&radius=20000`
        );

        if (response.data.predictions) {
          setSearchResults(response.data.predictions);
          setShowSearchResults(true);
        }
      } catch (error) {
        console.error('Error searching places:', error);
        setSearchResults([]);
      }
    }, 500),
    [region.latitude, region.longitude]
  );

  // Handle place selection from search results
  const handlePlaceSelect = async (placeId: string, description: string) => {
    try {
      setIsLoading(true);
      setShowSearchResults(false);
      Keyboard.dismiss();
      setSearchQuery(description);
      setSelectedPlaceName(description.split(',')[0].trim());

      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (response.data.result) {
        const place = response.data.result;
        const location = place.geometry.location;
        
        const newRegion = {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };

        setRegion(newRegion);
        setAddress(prev => ({
          ...prev,
          latitude: location.lat,
          longitude: location.lng,
        }));

        mapRef.current?.animateToRegion(newRegion, 1000);
        await fetchAddressFromCoordinates(location.lat, location.lng);
        
        await AsyncStorage.setItem('Latitude', location.lat.toString());
        await AsyncStorage.setItem('Longitude', location.lng.toString());
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      Alert.alert('Error', 'Could not fetch place details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle map region changes
  const handleRegionChange = (newRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    if (!isMapDragged) return;
    
    setRegion(newRegion);
    setAddress(prev => ({
      ...prev,
      latitude: newRegion.latitude,
      longitude: newRegion.longitude,
    }));
  };

  // Debounced region change handler
  const handleRegionChangeComplete = debounce(async (newRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    if (!isMapDragged) return;
    
    const distanceMoved = Math.sqrt(
      Math.pow(newRegion.latitude - lastFetchedCoordinates.latitude, 2) +
      Math.pow(newRegion.longitude - lastFetchedCoordinates.longitude, 2)
    );
    
    if (distanceMoved < 0.0001) return;

    setIsLoading(true);
    setRegion(newRegion);
    setLastFetchedCoordinates({
      latitude: newRegion.latitude,
      longitude: newRegion.longitude,
    });
    
    if (!isManualAddressEdit) {
      setAddress(prev => ({
        ...prev,
        latitude: newRegion.latitude,
        longitude: newRegion.longitude,
      }));
      
      await fetchAddressFromCoordinates(newRegion.latitude, newRegion.longitude);
    }
    
    await AsyncStorage.setItem('Latitude', newRegion.latitude.toString());
    await AsyncStorage.setItem('Longitude', newRegion.longitude.toString());
    
    setIsLoading(false);
  }, 500);

  // Handlers for manual text input
  const handleManualAddressChange = (text: string) => {
    setIsManualAddressEdit(true);
    setAddress(prev => ({ ...prev, address: text }));
  };

  const handleManualCityChange = (text: string) => {
    setIsManualAddressEdit(true);
    setAddress(prev => ({ ...prev, city: text }));
  };

  const handleManualStateChange = (text: string) => {
    setIsManualAddressEdit(true);
    setAddress(prev => ({ ...prev, state: text }));
  };

  const handleManualZipCodeChange = (text: string) => {
    setIsManualAddressEdit(true);
    setAddress(prev => ({ ...prev, zipCode: text }));
  };

  const handleManualCountryChange = (text: string) => {
    setIsManualAddressEdit(true);
    setAddress(prev => ({ ...prev, country: text }));
  };

  // Request location permission
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  // Handle current location button press
  const handleCurrentLocationPress = async () => {
    try {
      setIsFetchingLocation(true);
      setIsManualAddressEdit(false);
      
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert('Permission denied', 'Location permission is required to use this feature');
        return;
      }

      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      });

      const newRegion = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };

      await AsyncStorage.setItem('Latitude', position.coords.latitude.toString());
      await AsyncStorage.setItem('Longitude', position.coords.longitude.toString());
      
      mapRef.current?.animateToRegion(newRegion, 1000);
      setAddress(prev => ({
        ...prev,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }));
      
      await fetchAddressFromCoordinates(position.coords.latitude, position.coords.longitude);
      
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Could not get your current location. Please ensure location services are enabled.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleMapDragStart = () => {
    setIsMapDragged(true);
    setIsManualAddressEdit(false);
  };

  const handleMapDragEnd = () => {
    setIsMapDragged(false);
  };

  // Handle address type change
  const handleAddressTypeChange = (type: AddressType) => {
    setAddress(prev => ({
      ...prev,
      type,
      name: type !== 'Other' ? '' : prev.name
    }));
  };

  // Validate address before saving
  const validateAddress = () => {
    if (!address.address.trim()) {
      Alert.alert('Error', 'Please enter the full address');
      return false;
    }

    if (!address.city.trim()) {
      Alert.alert('Error', 'Please enter the city');
      return false;
    }

    if (!address.state.trim()) {
      Alert.alert('Error', 'Please enter the state');
      return false;
    }

    if (!address.zipCode.trim()) {
      Alert.alert('Error', 'Please enter the zip code');
      return false;
    }

    if (!address.country.trim()) {
      Alert.alert('Error', 'Please enter the country');
      return false;
    }

    return true;
  };

  // Handle confirm location button press
  const handleConfirmLocation = () => {
    if (validateAddress()) {
      openModal();
    }
  };

  const prepareAddressPayload = () => {
    const formatCoord = (value) => {
      if (value === null || value === undefined || isNaN(value)) return null;
      return Number(value).toFixed(4);
    };

    return {
      street_address: address.address,
      user: user?.id || 0,
      city: address.city,
      state: address.state,
      zip_code: address.zipCode,
      country: address.country,
      near_by_landmark: address.landmark,
      home_type: address.type,
      name_of_location: address.name,
      latitude: formatCoord(address.latitude),
      longitude: formatCoord(address.longitude),
      is_default: addressToEdit?.isDefault || false,
    };
  };


  // Pan responder for modal swipe down
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setModalPanStart(true),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          modalTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeModal();
        } else {
          Animated.spring(modalTranslateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
        setModalPanStart(false);
      },
    })
  ).current;

  const openModal = () => {
    setShowConfirmationModal(true);
    Animated.parallel([
      Animated.timing(modalTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(modalTranslateY, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(modalOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setShowConfirmationModal(false));
  };

  // Handle save address from modal
  const handleSaveAddress = async () => {
    if (!validateAddress()) return;

    try {
      setIsSubmitting(true);
      
      const payload = prepareAddressPayload();

      let response;
      if (addressToEdit) {
        response = await updateUserAddress(addressToEdit.id, payload);
      } else {
        response = await storeUserAddress(payload);
      }
      
      if (response.data) {
        const newAddress: Address = {
          ...address,
          id: addressToEdit?.id || response.data.address_id || Math.random().toString(36).substring(7),
          isDefault: addressToEdit?.isDefault || false,
        };

        await AsyncStorage.setItem('Latitude', response.data.latitude.toString());
        await AsyncStorage.setItem('Longitude', response.data.longitude.toString());

        await AsyncStorage.multiSet([
          ['AddressId', String(response.data.id)],
          ['StreetAddress', String(response.data.full_address)],
          ['HomeType', String(response.data.home_type || 'Delivering to')],
          ['Latitude', String(response.data.latitude)],
          ['Longitude', String(response.data.longitude)],
        ]);

        if (onLocationConfirmed) {
          onLocationConfirmed(newAddress);
        }
        
        console.log("prevLocation===",prevLocation)
        
        closeModal();
        setTimeout(() => {
          navigation.navigate(prevLocation);
        }, 300);
        
      } else {
        throw new Error(response.data?.message || 'Failed to save address');
      }
    } catch (error: any) {
      console.error('Error saving address:', error);
      Alert.alert('Error', error.message || 'Failed to save address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle map ready event
  const handleMapReady = () => {
    setMapReady(true);
    setMapError(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      {/* Map Section */}
      <Animated.View style={[styles.mapContainer, { height: mapHeight }]}>
        {mapError ? (
          <View style={styles.mapErrorContainer}>
            <Icon name="map-outline" size={50} color="#E65C00" />
            <Text style={styles.mapErrorText}>{mapError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setMapError(null)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            onRegionChange={handleRegionChange}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPanDrag={handleMapDragStart}
            onResponderRelease={handleMapDragEnd}
            onMapReady={handleMapReady}
            showsUserLocation={true}
            showsMyLocationButton={false}
            loadingEnabled={true}
            loadingIndicatorColor="#E65C00"
            loadingBackgroundColor="#fff"
            moveOnMarkerPress={false}
            customMapStyle={mapStyle}
          >
            <Marker
              coordinate={{
                latitude: address.latitude,
                longitude: address.longitude,
              }}
              anchor={{ x: 0.5, y: 1 }}
              draggable={false}
            >
              <View style={styles.customMarker}>
                <Icon name="location-sharp" size={30} color="#E65C00" />
                {isLoading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#E65C00" />
                  </View>
                )}
              </View>
            </Marker>
          </MapView>
        )}
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <View style={styles.searchInputContainer}>
            <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search area, street, landmark..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.length > 2) {
                  handleSearch(text);
                } else {
                  setSearchResults([]);
                  setShowSearchResults(false);
                }
              }}
              onFocus={() => {
                if (searchQuery.length > 2) {
                  setShowSearchResults(true);
                }
              }}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
              >
                <Icon name="close" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <ScrollView 
              style={styles.searchResultsScroll}
              keyboardShouldPersistTaps="always"
            >
              {searchResults.map((result) => (
                <TouchableOpacity
                  key={result.place_id}
                  style={styles.searchResultItem}
                  onPress={() => handlePlaceSelect(result.place_id, result.description)}
                >
                  <Icon name="location-outline" size={20} color="#666" style={styles.searchResultIcon} />
                  <View style={styles.searchResultTextContainer}>
                    <Text style={styles.searchResultPrimaryText}>{result.structured_formatting.main_text}</Text>
                    <Text style={styles.searchResultSecondaryText}>{result.structured_formatting.secondary_text}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Current Location Button */}
        <TouchableOpacity 
          style={styles.currentLocationButton}
          onPress={handleCurrentLocationPress}
          activeOpacity={0.8}
          disabled={isFetchingLocation}
        >
          {isFetchingLocation ? (
            <ActivityIndicator size="small" color="#E65C00" />
          ) : (
            <Icon name="locate" size={20} color="#E65C00" />
          )}
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Form Section */}
          <View style={styles.formContainer}>
            <View style={styles.addressPreview}>
              <Icon name="location-sharp" size={20} color="#E65C00" />
              <Text style={styles.addressPreviewText} numberOfLines={2}>
                {address.address || 'Select a location on the map and enter address below'}
              </Text>
            </View>
            
            <Text style={styles.sectionTitle}>Save Address As</Text>
            
            <View style={styles.inputGroup}>
              <View style={styles.typeOptions}>
                {(['Home', 'Office', 'Other'] as AddressType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      address.type === type && styles.selectedTypeOption,
                    ]}
                    onPress={() => handleAddressTypeChange(type)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={
                        type === 'Home' ? 'home-outline' :
                        type === 'Office' ? 'briefcase-outline' : 'location-outline'
                      }
                      size={20}
                      color={address.type === type ? '#E65C00' : '#777'}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        address.type === type && styles.selectedTypeOptionText,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {address.type === 'Other' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name this location</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mom's House, Vacation Home, etc."
                  placeholderTextColor="#999"
                  value={address.name}
                  onChangeText={(text) => setAddress({ ...address, name: text })}
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Complete Address</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Building name, floor, street, landmark, etc."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={address.address}
                onChangeText={handleManualAddressChange}
                returnKeyType="done"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Landmark (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nearby landmark for easy identification"
                placeholderTextColor="#999"
                value={address.landmark}
                onChangeText={(text) => setAddress({ ...address, landmark: text })}
                returnKeyType="done"
              />
            </View>
            
            <View style={styles.addressDetailsContainer}>
              <View style={styles.addressDetailRow}>
                <View style={[styles.addressDetailItem, { flex: 2 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    placeholderTextColor="#999"
                    value={address.city}
                    onChangeText={handleManualCityChange}
                  />
                </View>
                <View style={[styles.addressDetailItem, { flex: 1, marginLeft: 10 }]}>
                  <Text style={styles.label}>Zip Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Zip Code"
                    placeholderTextColor="#999"
                    value={address.zipCode}
                    onChangeText={handleManualZipCodeChange}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              
              <View style={styles.addressDetailRow}>
                <View style={styles.addressDetailItem}>
                  <Text style={styles.label}>State</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="State"
                    placeholderTextColor="#999"
                    value={address.state}
                    onChangeText={handleManualStateChange}
                  />
                </View>
              </View>
              
              <View style={styles.addressDetailRow}>
                <View style={styles.addressDetailItem}>
                  <Text style={styles.label}>Country</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Country"
                    placeholderTextColor="#999"
                    value={address.country}
                    onChangeText={handleManualCountryChange}
                  />
                </View>
              </View>
            </View>
          </View>
        </Animated.ScrollView>

        {/* Footer with Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmLocation}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.confirmButtonText}>
                  {addressToEdit ? 'Update Address' : 'Save Address'}
                </Text>
                <Icon name="chevron-up" size={20} color="#fff" style={styles.confirmButtonIcon} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmationModal}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <Animated.View 
          style={[
            styles.modalOverlay,
            { opacity: modalOpacity }
          ]}
        >
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={closeModal}
          />
        </Animated.View>
        
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: modalTranslateY }] }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.modalHandleContainer}>
            <View style={styles.modalHandle} />
          </View>
          
          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.modalTitle}>Confirm Your Location</Text>
            
            <View style={styles.modalAddressPreview}>
              <Icon name="location-sharp" size={24} color="#E65C00" />
              <View style={styles.modalAddressTextContainer}>
                <Text style={styles.modalAddressType}>
                  {address.type === 'Home' ? 'Home' : 
                   address.type === 'Office' ? 'Work' : address.name}
                </Text>
                <Text style={styles.modalAddressText} numberOfLines={3}>
                  {address.address}
                </Text>
                {address.landmark && (
                  <Text style={styles.modalLandmarkText}>
                    Landmark: {address.landmark}
                  </Text>
                )}
              </View>
            </View>
            
            <View style={styles.modalMapContainer}>
              <MapView
                style={styles.modalMap}
                provider={PROVIDER_GOOGLE}
                region={{
                  latitude: address.latitude,
                  longitude: address.longitude,
                  latitudeDelta: LATITUDE_DELTA * 0.5,
                  longitudeDelta: LONGITUDE_DELTA * 0.5,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                loadingEnabled={true}
                customMapStyle={mapStyle}
              >
                <Marker
                  coordinate={{
                    latitude: address.latitude,
                    longitude: address.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <Icon name="location-sharp" size={30} color="#E65C00" />
                </Marker>
              </MapView>
            </View>
            
            <View style={styles.modalDetailsContainer}>
              <View style={styles.modalDetailRow}>
                <Icon name="home-outline" size={20} color="#777" />
                <Text style={styles.modalDetailText}>
                  {address.city}, {address.state}, {address.country}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Icon name="navigate-outline" size={20} color="#777" />
                <Text style={styles.modalDetailText}>
                  {address.latitude}, {address.longitude}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Icon name="mail-outline" size={20} color="#777" />
                <Text style={styles.modalDetailText}>
                  {address.zipCode}
                </Text>
              </View>
            </View>
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={closeModal}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelButtonText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalSaveButton, isSubmitting && styles.disabledButton]}
              onPress={handleSaveAddress}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalSaveButtonText}>
                  {addressToEdit ? 'Update Address' : 'Save Address'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
};

// Custom map styling
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#c9c9c9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  mapContainer: {
    width: '100%',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapErrorText: {
    fontSize: 16,
    color: '#333',
    marginTop: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#E65C00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginRight: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  clearSearchButton: {
    marginLeft: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
  },
  searchResultsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 95 : 65,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  searchResultsScroll: {
    paddingVertical: 5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultIcon: {
    marginRight: 12,
  },
  searchResultTextContainer: {
    flex: 1,
  },
  searchResultPrimaryText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 2,
  },
  searchResultSecondaryText: {
    fontSize: 13,
    color: '#777',
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 20,
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 15,
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 15,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  addressPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#E65C00',
  },
  addressPreviewText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    gap: 10,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedTypeOption: {
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
    borderColor: 'rgba(230, 92, 0, 0.5)',
  },
  typeOptionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#777',
  },
  selectedTypeOptionText: {
    color: '#E65C00',
    fontWeight: '600',
  },
  addressDetailsContainer: {
    marginTop: 10,
  },
  addressDetailRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  addressDetailItem: {
    flex: 1,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmButton: {
    backgroundColor: '#E65C00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonIcon: {
    marginLeft: 8,
  },
  headerButton: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  // Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalOverlayTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  modalHandleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#ddd',
    borderRadius: 3,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginVertical: 20,
    textAlign: 'center',
  },
  modalAddressPreview: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  modalAddressTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  modalAddressType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65C00',
    marginBottom: 5,
  },
  modalAddressText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  modalLandmarkText: {
    fontSize: 13,
    color: '#777',
    fontStyle: 'italic',
  },
  modalMapContainer: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  modalMap: {
    ...StyleSheet.absoluteFillObject,
  },
  modalDetailsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalDetailText: {
    fontSize: 14,
    color: '#555',
    marginLeft: 10,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginRight: 10,
  },
  modalCancelButtonText: {
    color: '#555',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#E65C00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default MapLocationPicker;