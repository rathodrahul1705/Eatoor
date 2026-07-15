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
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/Ionicons';
import { storeUserAddress } from '../../../api/address';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MapLocationPickerParams } from '../../../types/addressTypes';
import {
  saveAddressDetails,
  setAddressManual,
} from '../../screens/home/utils/addressStorage';

// Constants
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.005;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const GOOGLE_MAP_API_KEY = 'AIzaSyBKOWlVTzhP7lRcNEHbT2SNz-W_bYx3v28';
const DEFAULT_COORDINATES = {
  latitude: 19.0760,
  longitude: 72.8777,
};

// Brand palette
const BRAND = '#FF814F';
const BRAND_DARK = '#FF814F';
const BRAND_TINT = '#FDEBEC';
const INK = '#1C1C1C';
const SUBTLE = '#6B6B6B';
const BORDER = '#EDEDED';
const SURFACE = '#F7F7F8';

const ADDRESS_TYPES = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconFilled: 'home' },
  { id: 'work', label: 'Work', icon: 'briefcase-outline', iconFilled: 'briefcase' },
  { id: 'other', label: 'Other', icon: 'location-outline', iconFilled: 'location' },
];

// Location timeout
const LOCATION_TIMEOUT = 15000;
const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: LOCATION_TIMEOUT,
  maximumAge: 10000,
};

// Responsive helpers
const scale = (size) => (width / 375) * size;
const verticalScale = (size) => (height / 812) * size;
const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// Debounce
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

// Phone validation (Indian 10-digit)
const isValidPhone = (phone) => /^[6-9]\d{9}$/.test((phone || '').trim());

const MapLocationPicker = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as MapLocationPickerParams;
  const { onLocationConfirmed, prevLocation = 'HomeTabs' } = params || {};

  // State
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
    completeAddress: '', // EMPTY by default – user must type
    addressType: 'Home',
    customName: '',
  });

  const [receiver, setReceiver] = useState({ name: '', phone: '' });
  const [isReceiverExpanded, setIsReceiverExpanded] = useState(false);

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
    longitude: 0,
  });
  const [locationError, setLocationError] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [currentLocationData, setCurrentLocationData] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // Refs
  const mapRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const locationTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const scrollViewRef = useRef(null);
  const keyboardDidShowListener = useRef(null);
  const keyboardDidHideListener = useRef(null);
  const inputYPositions = useRef({});

  // Animations
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;
  const mapHeightAnim = useRef(new Animated.Value(verticalScale(260))).current;

  // Keyboard listeners
  useEffect(() => {
    if (Platform.OS === 'ios') {
      keyboardDidShowListener.current = Keyboard.addListener(
        'keyboardWillShow',
        (e) => {
          setIsKeyboardVisible(true);
          setKeyboardHeight(e.endCoordinates.height);
          Animated.timing(mapHeightAnim, {
            toValue: verticalScale(180),
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
          Animated.timing(mapHeightAnim, {
            toValue: verticalScale(260),
            duration: 250,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }).start();
        }
      );
    }
    return () => {
      keyboardDidShowListener.current?.remove();
      keyboardDidHideListener.current?.remove();
    };
  }, []);

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    initializeComponent();
    return () => {
      isMountedRef.current = false;
      searchTimeoutRef.current && clearTimeout(searchTimeoutRef.current);
      locationTimeoutRef.current && clearTimeout(locationTimeoutRef.current);
    };
  }, []);

  // Pre‑fill receiver when user data is available
  useEffect(() => {
    if (user) {
      setReceiver((prev) => ({
        name: prev.name || user.full_name || user.name || '',
        phone: prev.phone || user.contact_number || user.phone || user.mobile || '',
      }));
    }
  }, [user]);

  // ---------- User data fetching ----------
  const fetchUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser({
          name: parsedUser.full_name || 'User Name',
          email: parsedUser.email || 'user@example.com',
          avatar: parsedUser.avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
          orders: parsedUser.orders || 0,
          favorites: parsedUser.favorites || 0,
          memberSince: parsedUser.created_at
            ? new Date(parsedUser.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })
            : 'Joined recently',
          rating: parsedUser.rating || 0,
          contact_number: parsedUser.contact_number || 'Not provided',
          full_name: parsedUser.full_name || '',
          id: parsedUser.id || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  const initializeComponent = async () => {
    await Promise.all([fetchUserData(), getCurrentLocation()]);
  };

  // ---------- Location & Geocode functions ----------
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
          return { latitude: lat, longitude: lng, isLastKnown: true };
        }
      }
    } catch (error) {
      console.error('Error getting last known location:', error);
    }
    return null;
  };

  const reverseGeocode = useCallback(
    async (latitude, longitude, isDraggingState = false) => {
      if (!isMountedRef.current) return;
      try {
        if (!isDraggingState) setIsDragging(true);
        const cacheKey = `geocode_${latitude.toFixed(6)}_${longitude.toFixed(6)}`;
        const cachedData = await AsyncStorage.getItem(cacheKey);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          if (Date.now() - parsed.timestamp < 3600000) {
            updateAddressFromGeocodeData(parsed.data, latitude, longitude);
            setCurrentLocationData({
              address: parsed.data.formatted_address,
              coordinates: { latitude, longitude },
              timestamp: new Date().toISOString(),
            });
            if (!isDraggingState && isMountedRef.current) setIsDragging(false);
            return;
          }
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAP_API_KEY}&language=en`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && data.results.length > 0 && isMountedRef.current) {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({
              timestamp: Date.now(),
              data: data.results[0],
            })
          );
          updateAddressFromGeocodeData(data.results[0], latitude, longitude);
          setCurrentLocationData({
            address: data.results[0].formatted_address,
            coordinates: { latitude, longitude },
            timestamp: new Date().toISOString(),
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
    },
    []
  );

  const updateAddressFromGeocodeData = (geocodeData, latitude, longitude) => {
    const components = geocodeData.address_components;
    let city = '',
      state = '',
      country = '',
      zipcode = '',
      sublocality = '';
    components.forEach((comp) => {
      if (comp.types.includes('locality')) city = comp.long_name;
      else if (comp.types.includes('sublocality')) sublocality = comp.long_name;
      else if (comp.types.includes('administrative_area_level_1'))
        state = comp.long_name;
      else if (comp.types.includes('country')) country = comp.long_name;
      else if (comp.types.includes('postal_code')) zipcode = comp.long_name;
    });
    if (!city && sublocality) city = sublocality;
    setAddress((prev) => ({
      ...prev,
      city: city || prev.city,
      zipCode: zipcode || prev.zipCode,
      state: state || prev.state,
      country: country || prev.country,
      latitude,
      longitude,
    }));
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    setLocationLoading(true);
    setLocationError(false);
    try {
      const lastKnown = await getLastKnownLocation();
      if (lastKnown && isMountedRef.current) {
        updateLocation(lastKnown.latitude, lastKnown.longitude, true);
        setLoading(false);
        setLocationLoading(false);
        return;
      }
      if (!Geolocation) throw new Error('Geolocation service not available');
      locationTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && locationLoading) {
          handleLocationError('Location request timeout');
        }
      }, LOCATION_TIMEOUT);
      Geolocation.getCurrentPosition(
        async (position) => {
          if (locationTimeoutRef.current) clearTimeout(locationTimeoutRef.current);
          if (!isMountedRef.current) return;
          const { latitude, longitude } = position.coords;
          updateLocation(latitude, longitude, false);
          setLoading(false);
          setLocationLoading(false);
        },
        (error) => {
          if (locationTimeoutRef.current) clearTimeout(locationTimeoutRef.current);
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
    setLocationError(true);
    setLocationLoading(false);
    updateLocation(DEFAULT_COORDINATES.latitude, DEFAULT_COORDINATES.longitude, false);
    setLoading(false);
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
    if (!isLastKnown) setIsDragging(true);
    await reverseGeocode(latitude, longitude, false);
    await AsyncStorage.multiSet([
      ['Latitude', latitude.toString()],
      ['Longitude', longitude.toString()],
    ]);
    if (mapRef.current) {
      setTimeout(() => {
        if (mapRef.current && isMountedRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }, 100);
    }
  };

  // ---------- Search & place selection ----------
  const searchPlaces = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
      return;
    }
    try {
      setIsSearching(true);
      const encoded = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encoded}&key=${GOOGLE_MAP_API_KEY}&location=${mapRegion.latitude},${mapRegion.longitude}&radius=20000&components=country:in&language=en`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && isMountedRef.current) {
        const sorted = data.predictions.sort((a, b) => {
          if (
            a.structured_formatting.main_text
              .toLowerCase()
              .startsWith(query.toLowerCase())
          )
            return -1;
          if (
            b.structured_formatting.main_text
              .toLowerCase()
              .startsWith(query.toLowerCase())
          )
            return 1;
          return 0;
        });
        setSearchResults(sorted.slice(0, 8));
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
      if (isMountedRef.current) setIsSearching(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const delay = text.length < 3 ? 800 : 400;
    if (text.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => searchPlaces(text), delay);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
    }
  };

  const handlePlaceSelect = async (place) => {
    try {
      setIsSearching(true);
      setShowSearchResults(false);
      showSearchResultsWithAnimation(false);
      setSearchQuery(place.description);
      Keyboard.dismiss();

      const cacheKey = `place_${place.place_id}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      let locationData;
      if (cached) {
        locationData = JSON.parse(cached);
      } else {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${encodeURIComponent(
          place.place_id
        )}&key=${GOOGLE_MAP_API_KEY}&fields=geometry,name,formatted_address`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === 'OK' && isMountedRef.current) {
          locationData = data.result;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(locationData));
        } else {
          throw new Error('Failed to get place details');
        }
      }
      const loc = locationData.geometry.location;
      await updateLocation(loc.lat, loc.lng, false);
      setSearchQuery(locationData.name || place.description);
      if (mapRef.current) {
        const newRegion = {
          latitude: loc.lat,
          longitude: loc.lng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        };
        mapRef.current.animateToRegion(newRegion, 1000);
      }
    } catch (error) {
      console.error('Place details error:', error);
      Alert.alert('Error', 'Failed to get place details. Please try again.');
    } finally {
      if (isMountedRef.current) setIsSearching(false);
    }
  };

  const handleRegionChangeComplete = useCallback(
    debounce(async (region) => {
      if (!isMountedRef.current || isManualAddressEdit) return;
      const distance = Math.sqrt(
        Math.pow(region.latitude - lastFetchedCoordinates.latitude, 2) +
          Math.pow(region.longitude - lastFetchedCoordinates.longitude, 2)
      );
      if (distance < 0.00005) return;

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
    [lastFetchedCoordinates, isManualAddressEdit, reverseGeocode]
  );

  const showSearchResultsWithAnimation = (show) => {
    Animated.timing(searchResultsOpacity, {
      toValue: show ? 1 : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  // ---------- Form handlers ----------
  const handleAddressTypeChange = (type) => {
    setAddress((prev) => ({ ...prev, addressType: type }));
    setFieldErrors((prev) => ({ ...prev, customName: null }));
  };

  const handleInputChange = (field, value) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    if (['completeAddress', 'city', 'zipCode', 'state', 'country'].includes(field)) {
      setIsManualAddressEdit(true);
    }
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleReceiverChange = (field, value) => {
    setReceiver((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleInputFocus = (field) => {
    setTimeout(() => {
      const y = inputYPositions.current[field];
      if (scrollViewRef.current && typeof y === 'number') {
        scrollViewRef.current.scrollTo({
          y: Math.max(y - verticalScale(24), 0),
          animated: true,
        });
      }
    }, 250);
  };

  const handleInputBlur = () => {
    setTimeout(() => setIsManualAddressEdit(false), 2000);
  };

  const registerInputLayout = (field) => (e) => {
    inputYPositions.current[field] = e.nativeEvent.layout.y;
  };

  // ---------- Validation ----------
  const validateAddress = () => {
    const errors = {};
    if (!address.completeAddress?.trim()) errors.completeAddress = 'Required';
    if (address.addressType === 'Other' && !address.customName?.trim()) {
      errors.customName = 'Please name this address';
    }
    if (!receiver.name?.trim()) errors.name = 'Required';
    if (!receiver.phone?.trim()) {
      errors.phone = 'Required';
    } else if (!isValidPhone(receiver.phone)) {
      errors.phone = 'Enter a valid 10-digit number';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return false;
    }
    return true;
  };

  const prepareAddressPayload = () => {
    return {
      street_address: address.completeAddress.trim(),
      user: user?.id || 0,
      city: address.city.trim() || 'N/A',
      state: address.state.trim() || 'N/A',
      zip_code: address.zipCode.trim() || '000000',
      country: address.country.trim() || 'India',
      near_by_landmark: address.landmark?.trim() || '',
      home_type: address.addressType,
      name_of_location:
        address.addressType === 'Other' ? address.customName.trim() : address.addressType,
      latitude: location?.latitude?.toFixed(6) || DEFAULT_COORDINATES.latitude.toFixed(6),
      longitude:
        location?.longitude?.toFixed(6) || DEFAULT_COORDINATES.longitude.toFixed(6),
      is_default: false,
      receiver_name: receiver.name.trim(),
      receiver_phone: receiver.phone.trim(),
    };
  };

  const handleSaveAddress = async () => {
    if (!validateAddress()) return;
    try {
      setIsSubmitting(true);
      const payload = prepareAddressPayload();
      const response = await storeUserAddress(payload);
      if (response.data && isMountedRef.current) {
        const id = response.data.address_id || response.data.id;
        const fullAddress = address.completeAddress || address.address;
        const homeType = response.data.home_type || address.addressType;
        const lat = location?.latitude || address.latitude;
        const lng = location?.longitude || address.longitude;
        await saveAddressDetails({
          id,
          full_address: fullAddress,
          home_type: homeType,
          latitude: lat,
          longitude: lng,
        });
        await setAddressManual(true);
        await AsyncStorage.multiSet([
          ['AddressId', String(id)],
          ['StreetAddress', fullAddress],
          ['HomeType', homeType],
          ['Latitude', String(lat)],
          ['Longitude', String(lng)],
          ['ReceiverName', receiver.name.trim()],
          ['ReceiverPhone', receiver.phone.trim()],
        ]);
        setTimeout(() => navigation.navigate(prevLocation), 300);
      } else {
        throw new Error(response.data?.message || 'Failed to save address');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', error.message || 'Failed to save address. Please try again.');
    } finally {
      if (isMountedRef.current) setIsSubmitting(false);
    }
  };

  // ---------- Render helpers ----------
  const renderSearchItem = ({ item }) => (
    <TouchableOpacity
      style={styles.searchItem}
      onPress={() => handlePlaceSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchItemIconContainer}>
        <Icon
          name={
            item.types?.includes('establishment') ? 'business-outline' : 'location-outline'
          }
          size={moderateScale(16)}
          color={BRAND}
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
      <Icon
        name="arrow-up-outline"
        size={moderateScale(14)}
        color="#C7C7C7"
        style={{ transform: [{ rotate: '45deg' }] }}
      />
    </TouchableOpacity>
  );

  const renderEmptySearchResults = () => (
    <View style={styles.emptySearchContainer}>
      <Icon name="search-outline" size={moderateScale(40)} color="#CCCCCC" />
      <Text style={styles.emptySearchText}>No results found</Text>
      <Text style={styles.emptySearchSubtext}>Try a different search term</Text>
    </View>
  );

  const renderAddressTypeChips = () => (
    <View style={styles.chipRow}>
      {ADDRESS_TYPES.map((type) => {
        const isSelected = address.addressType === type.label;
        return (
          <TouchableOpacity
            key={type.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => handleAddressTypeChange(type.label)}
            activeOpacity={0.75}
          >
            <Icon
              name={isSelected ? type.iconFilled : type.icon}
              size={moderateScale(15)}
              color={isSelected ? '#FFF' : SUBTLE}
            />
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderCurrentLocationBanner = () => {
    if (!currentLocationData && !isDragging) return null;
    return (
      <View style={styles.locationPreviewCard}>
        <View style={styles.locationPreviewIcon}>
          <Icon name="location" size={moderateScale(16)} color={BRAND} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationPreviewLabel}>DELIVERING YOUR ORDER TO</Text>
          {isDragging ? (
            <View style={styles.locationPreviewLoadingRow}>
              <ActivityIndicator size="small" color={BRAND} />
              <Text style={styles.locationPreviewLoadingText}>Fetching address…</Text>
            </View>
          ) : (
            <Text style={styles.locationPreviewText} numberOfLines={2}>
              {currentLocationData?.address}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.changeLink}
          onPress={() => searchInputRef.current?.focus()}
          activeOpacity={0.7}
        >
          <Text style={styles.changeLinkText}>CHANGE</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMapSection = () => (
    <>
      {loading ? (
        <View style={styles.mapLoadingContainer}>
          <ActivityIndicator size="large" color={BRAND} />
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
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            showsScale={false}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPanDragStart={() => setIsDragging(true)}
            loadingEnabled
            loadingIndicatorColor={BRAND}
            loadingBackgroundColor="#FFFFFF"
          />
          <View style={styles.mapCenterIndicator} pointerEvents="none">
            <View style={styles.markerPin}>
              <Icon name="fast-food-outline" size={moderateScale(18)} color="#FFF" />
            </View>
            <View style={styles.markerBase} />
          </View>
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={getCurrentLocation}
            activeOpacity={0.8}
            disabled={locationLoading}
          >
            <View
              style={[
                styles.locationButtonInner,
                locationLoading && styles.locationButtonInnerDisabled,
              ]}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={BRAND} />
              ) : (
                <Icon name="locate" size={moderateScale(18)} color={BRAND} />
              )}
            </View>
            <Text style={styles.currentLocationButtonLabel}>Locate me</Text>
          </TouchableOpacity>
          {locationError && (
            <View style={styles.locationErrorBanner}>
              <Icon name="warning-outline" size={moderateScale(14)} color="#FFF" />
              <Text style={styles.locationErrorText}>Using default location</Text>
            </View>
          )}
        </>
      )}
    </>
  );

  const renderSectionHeader = (title, icon) => (
    <View style={styles.sectionHeaderRow}>
      {icon && (
        <Icon
          name={icon}
          size={moderateScale(15)}
          color={INK}
          style={{ marginRight: moderateScale(6) }}
        />
      )}
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  // Receiver summary (tap to expand)
  const renderReceiverSummary = () => {
    const displayName = receiver.name.trim() || 'Not provided';
    const displayPhone = receiver.phone.trim() ? `+91 ${receiver.phone}` : 'Not provided';
    return (
      <TouchableOpacity
        style={styles.receiverSummary}
        onPress={() => setIsReceiverExpanded(!isReceiverExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.receiverSummaryIcon}>
          <Icon name="person-circle-outline" size={moderateScale(22)} color={BRAND} />
        </View>
        <View style={styles.receiverSummaryTextContainer}>
          <Text style={styles.receiverSummaryLabel}>DELIVER TO</Text>
          <Text style={styles.receiverSummaryValue} numberOfLines={1}>
            {displayName}{' '}
            {displayPhone !== 'Not provided' ? `, ${displayPhone}` : ''}
          </Text>
        </View>
        <Icon
          name={isReceiverExpanded ? 'chevron-up' : 'chevron-down'}
          size={moderateScale(18)}
          color={SUBTLE}
        />
      </TouchableOpacity>
    );
  };

  const renderReceiverExpanded = () => (
    <View style={styles.receiverExpandedContainer}>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          Receiver's name <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, fieldErrors.name && styles.inputError]}
          value={receiver.name}
          onChangeText={(text) => handleReceiverChange('name', text)}
          onFocus={() => handleInputFocus('name')}
          onBlur={handleInputBlur}
          placeholder="Full name"
          placeholderTextColor="#999"
        />
        {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>
          Receiver's phone number <Text style={styles.requiredStar}>*</Text>
        </Text>
        <View
          style={[styles.phoneInputWrapper, fieldErrors.phone && styles.inputError]}
        >
          <Text style={styles.phonePrefix}>+91</Text>
          <View style={styles.phoneDivider} />
          <TextInput
            style={styles.phoneInput}
            value={receiver.phone}
            onChangeText={(text) =>
              handleReceiverChange('phone', text.replace(/[^0-9]/g, ''))
            }
            onFocus={() => handleInputFocus('phone')}
            onBlur={handleInputBlur}
            placeholder="10-digit mobile number"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
        {fieldErrors.phone && <Text style={styles.errorText}>{fieldErrors.phone}</Text>}
      </View>
    </View>
  );

  // ---------- Main render ----------
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
            {/* Header with search */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.7}
                >
                  <Icon name="arrow-back" size={moderateScale(20)} color={INK} />
                </TouchableOpacity>
                <View
                  style={[
                    styles.searchContainer,
                    isSearchFocused && styles.searchContainerFocused,
                  ]}
                >
                  <Icon
                    name="search"
                    size={moderateScale(16)}
                    color="#999"
                    style={styles.searchIcon}
                  />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder="Search for area, street name..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      if (searchQuery.trim().length > 0) searchPlaces(searchQuery);
                    }}
                    clearButtonMode="while-editing"
                  />
                  {isSearching && (
                    <ActivityIndicator
                      size="small"
                      color={BRAND}
                      style={styles.searchLoading}
                    />
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
                  transform: [
                    {
                      translateY: searchResultsOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                  ],
                  display: showSearchResults ? 'flex' : 'none',
                },
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
                      removeClippedSubviews={Platform.OS === 'android'}
                    />
                  ) : (
                    renderEmptySearchResults()
                  )}
                </>
              )}
            </Animated.View>

            {/* Main Content: map + scrollable sheet */}
            <View style={styles.mainContent}>
              {/* Map - now outside ScrollView */}
              <Animated.View style={[styles.mapContainer, { height: mapHeightAnim }]}>
                {renderMapSection()}
              </Animated.View>

              {/* Scrollable sheet content */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContentContainer}
                showsVerticalScrollIndicator={false}
                bounces
                keyboardShouldPersistTaps="handled"
                decelerationRate="fast"
                removeClippedSubviews={Platform.OS === 'android'}
                onScroll={({ nativeEvent }) => {
                  if (nativeEvent.contentOffset.y > 50 && showSearchResults) {
                    setShowSearchResults(false);
                    showSearchResultsWithAnimation(false);
                  }
                }}
                scrollEventThrottle={16}
              >
                <View style={styles.sheet}>
                  <View style={styles.sheetHandle} />
                  {renderCurrentLocationBanner()}

                  {/* SAVE ADDRESS AS */}
                  <View style={styles.card}>
                    {renderSectionHeader('SAVE ADDRESS AS', 'bookmark-outline')}
                    {renderAddressTypeChips()}
                    {address.addressType === 'Other' && (
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>
                          Give this address a name <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <TextInput
                          style={[styles.input, fieldErrors.customName && styles.inputError]}
                          value={address.customName}
                          onChangeText={(text) => handleInputChange('customName', text)}
                          onFocus={() => handleInputFocus('customName')}
                          onBlur={handleInputBlur}
                          placeholder="e.g., Grandma's House, Gym"
                          placeholderTextColor="#999"
                        />
                        {fieldErrors.customName && (
                          <Text style={styles.errorText}>{fieldErrors.customName}</Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* ADDRESS DETAILS */}
                  <View style={styles.card} onLayout={registerInputLayout('completeAddress')}>
                    {renderSectionHeader('ADDRESS DETAILS', 'document-text-outline')}
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>
                        Flat / House no., Building name <Text style={styles.requiredStar}>*</Text>
                      </Text>
                      <TextInput
                        style={[styles.input, fieldErrors.completeAddress && styles.inputError]}
                        value={address.completeAddress}
                        onChangeText={(text) => handleInputChange('completeAddress', text)}
                        onFocus={() => handleInputFocus('completeAddress')}
                        onBlur={handleInputBlur}
                        placeholder="Enter your full address manually"
                        placeholderTextColor="#999"
                      />
                      {fieldErrors.completeAddress && (
                        <Text style={styles.errorText}>{fieldErrors.completeAddress}</Text>
                      )}
                    </View>
                    {/* Landmark and other fields are hidden */}
                  </View>

                  {/* RECEIVER DETAILS */}
                  <View style={styles.card} onLayout={registerInputLayout('receiver')}>
                    {renderSectionHeader('RECEIVER DETAILS', 'person-outline')}
                    {renderReceiverSummary()}
                    {isReceiverExpanded && renderReceiverExpanded()}
                  </View>

                  <View style={{ height: verticalScale(100) }} />
                </View>
              </ScrollView>
            </View>

            {/* Fixed Save Button */}
            <View
              style={[
                styles.saveButtonContainer,
                isKeyboardVisible && styles.saveButtonContainerKeyboard,
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (isSubmitting || loading) && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveAddress}
                disabled={isSubmitting || loading}
                activeOpacity={0.85}
              >
                <View style={styles.saveButtonContent}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.saveButtonText}>SAVE ADDRESS & PROCEED</Text>
                      <Icon
                        name="arrow-forward"
                        size={moderateScale(16)}
                        color="#FFF"
                        style={styles.saveIcon}
                      />
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    backgroundColor: SURFACE,
    marginRight: moderateScale(12),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(12),
    height: verticalScale(44),
    borderWidth: moderateScale(1.5),
    borderColor: BORDER,
  },
  searchContainerFocused: { borderColor: BRAND, backgroundColor: '#FFFFFF' },
  searchIcon: { marginRight: moderateScale(8) },
  searchInput: {
    flex: 1,
    height: '100%',
    color: INK,
    fontSize: moderateScale(14),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    paddingVertical: 0,
    includeFontPadding: false,
  },
  searchLoading: { marginLeft: moderateScale(8) },

  // Main content: map + scroll view
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContentContainer: {
    paddingBottom: verticalScale(120),
    paddingHorizontal: 0,
  },

  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    // height is animated via mapHeightAnim
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapCenterIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: moderateScale(-20),
    marginTop: moderateScale(-44),
    alignItems: 'center',
    zIndex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SURFACE,
    height: '100%',
  },
  mapLoadingText: {
    marginTop: verticalScale(12),
    color: INK,
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
  markerPin: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: BRAND,
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
      android: { elevation: 6 },
    }),
  },
  markerBase: {
    width: moderateScale(3),
    height: moderateScale(22),
    backgroundColor: BRAND,
    marginTop: moderateScale(-2),
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: verticalScale(16),
    right: moderateScale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(4) },
        shadowOpacity: 0.2,
        shadowRadius: moderateScale(8),
      },
      android: { elevation: 6 },
    }),
    zIndex: 10,
  },
  locationButtonInner: {
    width: moderateScale(24),
    height: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(6),
  },
  locationButtonInnerDisabled: { opacity: 0.7 },
  currentLocationButtonLabel: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: BRAND,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
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
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: moderateScale(22),
    borderTopRightRadius: moderateScale(22),
    marginTop: moderateScale(-6), // slight overlap for visual continuity
    paddingTop: verticalScale(10),
    paddingHorizontal: moderateScale(16),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(-2) },
        shadowOpacity: 0.06,
        shadowRadius: moderateScale(8),
      },
      android: { elevation: 4 },
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: moderateScale(36),
    height: moderateScale(4),
    borderRadius: moderateScale(2),
    backgroundColor: '#E0E0E0',
    marginBottom: verticalScale(14),
  },
  locationPreviewCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BRAND_TINT,
    borderRadius: moderateScale(14),
    padding: moderateScale(14),
    marginBottom: verticalScale(14),
  },
  locationPreviewIcon: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(15),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(10),
    marginTop: moderateScale(2),
  },
  locationPreviewLabel: {
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    color: BRAND_DARK,
    letterSpacing: 0.5,
    marginBottom: moderateScale(3),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  locationPreviewText: {
    fontSize: moderateScale(13.5),
    color: INK,
    lineHeight: moderateScale(18),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  locationPreviewLoadingRow: { flexDirection: 'row', alignItems: 'center' },
  locationPreviewLoadingText: {
    marginLeft: moderateScale(8),
    fontSize: moderateScale(13),
    color: SUBTLE,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  changeLink: { paddingHorizontal: moderateScale(8), paddingVertical: moderateScale(4) },
  changeLinkText: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: BRAND,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(14),
    borderWidth: moderateScale(1),
    borderColor: BORDER,
    padding: moderateScale(16),
    marginBottom: verticalScale(14),
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: verticalScale(4) },
  sectionHeaderText: {
    fontSize: moderateScale(12.5),
    fontWeight: '800',
    color: INK,
    letterSpacing: 0.6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  sectionSubDescription: {
    fontSize: moderateScale(12.5),
    color: SUBTLE,
    marginBottom: verticalScale(14),
    marginTop: verticalScale(2),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  chipRow: { flexDirection: 'row', marginTop: verticalScale(12), gap: moderateScale(10) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(14),
    borderRadius: moderateScale(20),
    backgroundColor: SURFACE,
    borderWidth: moderateScale(1.5),
    borderColor: BORDER,
  },
  chipSelected: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: {
    color: SUBTLE,
    fontWeight: '700',
    fontSize: moderateScale(13),
    marginLeft: moderateScale(6),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  chipTextSelected: { color: '#FFFFFF' },
  inputContainer: { marginTop: verticalScale(16) },
  label: {
    color: INK,
    marginBottom: verticalScale(8),
    fontWeight: '600',
    fontSize: moderateScale(13.5),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  requiredStar: { color: BRAND },
  input: {
    backgroundColor: SURFACE,
    borderWidth: moderateScale(1.5),
    borderColor: BORDER,
    borderRadius: moderateScale(10),
    padding: moderateScale(13),
    fontSize: moderateScale(14.5),
    color: INK,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    includeFontPadding: false,
  },
  inputError: { borderColor: BRAND, backgroundColor: BRAND_TINT },
  errorText: {
    color: BRAND,
    fontSize: moderateScale(11.5),
    marginTop: moderateScale(5),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: moderateScale(1.5),
    borderColor: BORDER,
    borderRadius: moderateScale(10),
    paddingHorizontal: moderateScale(13),
  },
  phonePrefix: {
    fontSize: moderateScale(14.5),
    color: SUBTLE,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  phoneDivider: {
    width: 1,
    height: verticalScale(20),
    backgroundColor: BORDER,
    marginHorizontal: moderateScale(10),
  },
  phoneInput: {
    flex: 1,
    paddingVertical: moderateScale(13),
    fontSize: moderateScale(14.5),
    color: INK,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    includeFontPadding: false,
  },
  receiverSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: moderateScale(10),
    padding: moderateScale(12),
    marginTop: verticalScale(8),
    borderWidth: 1,
    borderColor: BORDER,
  },
  receiverSummaryIcon: { marginRight: moderateScale(10) },
  receiverSummaryTextContainer: { flex: 1 },
  receiverSummaryLabel: {
    fontSize: moderateScale(10),
    color: SUBTLE,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  receiverSummaryValue: {
    fontSize: moderateScale(14),
    color: INK,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  receiverExpandedContainer: {
    marginTop: verticalScale(8),
    paddingHorizontal: moderateScale(4),
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: moderateScale(16),
    paddingBottom: Platform.OS === 'ios' ? verticalScale(24) : verticalScale(20),
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: moderateScale(-2) },
        shadowOpacity: 0.1,
        shadowRadius: moderateScale(4),
      },
      android: { elevation: 8 },
    }),
    zIndex: 30,
  },
  saveButtonContainerKeyboard: { paddingBottom: moderateScale(16) },
  saveButton: {
    backgroundColor: BRAND,
    paddingVertical: verticalScale(16),
    paddingHorizontal: moderateScale(24),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: BRAND,
        shadowOffset: { width: 0, height: moderateScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: moderateScale(8),
      },
      android: { elevation: 6 },
    }),
  },
  saveButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveButtonDisabled: {
    backgroundColor: '#DFE6E9',
    ...Platform.select({ ios: { shadowColor: '#DFE6E9', shadowOpacity: 0.2 } }),
  },
  saveIcon: { marginLeft: moderateScale(8) },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14.5),
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },

  // Search results (unchanged)
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
      android: { elevation: 10 },
    }),
    borderWidth: moderateScale(1),
    borderColor: BORDER,
    overflow: 'hidden',
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(12),
    borderBottomWidth: moderateScale(1),
    borderBottomColor: BORDER,
    backgroundColor: '#FAFAFA',
  },
  searchResultsTitle: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: INK,
    letterSpacing: 0.4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  closeResultsButton: { padding: moderateScale(4) },
  searchResultsList: { borderRadius: moderateScale(12) },
  searchResultsContent: { paddingBottom: moderateScale(8) },
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
    backgroundColor: BRAND_TINT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  searchItemTextContainer: { flex: 1 },
  searchItemPrimaryText: {
    fontSize: moderateScale(14),
    color: INK,
    marginBottom: moderateScale(2),
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  },
  searchItemSecondaryText: {
    fontSize: moderateScale(12),
    color: SUBTLE,
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
});

export default MapLocationPicker;