import React, { useEffect, useState, useCallback, useRef, useContext, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
  StatusBar,
  Dimensions,
  AppState,
  AppStateStatus,
  SafeAreaView,
  TextInput,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  ScrollView,
  Easing,
  ImageBackground,
  PanResponder
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import PartnerScreen from './PartnerScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ReorderScreen from '../../screens/home/ReorderScreen';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation.d';
import { getUserAddress } from '../../../api/address';
import { AuthContext } from '../../../context/AuthContext';
import { getKitchenList, updateFavouriteKitchen } from '../../../api/home';
import { getCart, getActiveOrders, updateCartUserDetails } from '../../../api/cart';
import { searchSuggestions } from '../../../api/search';
import moment from 'moment';
import SearchModal from './searchmodal';
import { getSessionId } from '../../../utlis/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// Get screen dimensions
const { width, height } = Dimensions.get('window');
const isSmallDevice = height < 700;
const isMediumDevice = height >= 700 && height <= 800;
const isLargeDevice = height > 800;

// Calculate header height based on device
const HEADER_HEIGHT = isSmallDevice ? height * 0.3 : isMediumDevice ? height * 0.35 : height * 0.4;

// Responsive scaling functions with better precision
const scale = (size: number) => {
  const baseWidth = 375;
  const scaleWidth = width / baseWidth;
  return Math.max(1, Math.round(size * scaleWidth));
};

const verticalScale = (size: number) => {
  const baseHeight = 812;
  const scaleHeight = height / baseHeight;
  return Math.max(1, Math.round(size * scaleHeight));
};

const moderateScale = (size: number, factor = 0.5) => {
  const baseWidth = 375;
  const scaleWidth = width / baseWidth;
  return Math.max(1, Math.round(size + (scaleWidth * size - size) * factor));
};

// Calculate responsive font sizes
const fontScale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = width / baseWidth;
  const scaledSize = size * scaleFactor;
  
  // Cap the minimum and maximum sizes
  const minSize = size * 0.9;
  const maxSize = size * 1.2;
  
  return Math.max(minSize, Math.min(maxSize, scaledSize));
};

const isAndroid = Platform.OS === 'android';

// Define the tabs that actually exist in your app
type AppTabs = 'Kitchen' | 'Eatmart' | 'Reorder' | 'Partner';

// Tab icons for normal and focused states
const tabIcons: Record<AppTabs, string> = {
  Kitchen: 'fast-food-outline',
  Eatmart: 'restaurant-outline',
  Reorder: 'repeat-outline',
  Partner: 'people-outline',
};

const tabIconsFocused: Record<AppTabs, string> = {
  Kitchen: 'fast-food',
  Eatmart: 'restaurant',
  Reorder: 'repeat',
  Partner: 'people',
};

// Colors
const COLORS = {
  gradientStart: '#E65C00',
  gradientEnd: '#DD2476',
  primary: '#E65C00',
  background: '#FFFFFF',
  text: '#1C1C1C',
  textLight: '#696969',
  textLighter: '#A9A9A9',
  textDark: '#696969',
  card: '#FFFFFF',
  zomatoGray: '#F8F8F8',
  zomatoLightGray: '#F0F0F0',
  headerIcon: '#FFFFFF',
  filterVegActive: '#059669',
  success: '#34C759',
  refreshSuccess: '#34C759',
  searchBackground: 'rgba(255, 255, 255, 0.95)',
  searchBorder: 'rgba(255, 255, 255, 0.3)',
  searchText: '#666666',
  searchPlaceholder: '#9A9A9A',
  searchAndroidBorder: '#E0E0E0',
  overlayDark: 'rgba(0, 0, 0, 0.4)',
  overlayDarker: 'rgba(0, 0, 0, 0.6)',
};

// Storage keys
const STORAGE_KEYS = {
  ADDRESS_ID: 'AddressId',
  STREET_ADDRESS: 'StreetAddress',
  HOME_TYPE: 'HomeType',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  RECENT_SEARCHES: 'recentSearches',
  SEARCH_HISTORY: 'searchHistory',
  PAST_KITCHEN_DETAILS: 'pastKitchenDetails',
  USER: 'user',
  SESSION_ID: 'sessionId',
  IS_RESTAURANT_REGISTER: 'is_restaurant_register'
};

// Font family handling with better Android/iOS support
const FONTS = {
  bold: Platform.select({ 
    ios: 'Inter-Bold', 
    android: 'sans-serif-condensed' 
  }),
  semiBold: Platform.select({ 
    ios: 'Inter-SemiBold', 
    android: 'sans-serif-medium' 
  }),
  medium: Platform.select({ 
    ios: 'Inter-Medium', 
    android: 'sans-serif' 
  }),
  regular: Platform.select({ 
    ios: 'Inter-Regular', 
    android: 'sans-serif' 
  }),
  light: Platform.select({ 
    ios: 'Inter-Light', 
    android: 'sans-serif-light' 
  }),
};

const DEFAULT_BANNER_IMAGE = "https://eatoorprod.s3.eu-north-1.amazonaws.com/uploads/thumbnail_image_v1.png";
const DEFAULT_CATEGORY_ICON = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=60&h=60&fit=crop&crop=center";
const ACTIVE_ORDERS_LIMIT = 3;

// Updated search placeholders
const SEARCH_PLACEHOLDERS = [
  "Search for restaurants or dishes",
  "Find your favorite meals...",
  "Craving something delicious?",
  "Discover amazing places...",
  "Search desserts or snacks..."
];

// Types
interface BannerItem {
  id: string;
  name: string;
  icon: string;
  document_type: 1 | 2; // 1: image, 2: video
  thumbnail?: string;
}

// Types for the video player (simplified for autoplay)
interface VideoBannerProps {
  videoUrl: string;
  isVisible: boolean;
  thumbnailUrl?: string;
}

// Updated Video Banner Component - FIXED: Changed black background to white
const VideoBanner: React.FC<VideoBannerProps> = React.memo(({ videoUrl, isVisible, thumbnailUrl }) => {
  const videoRef = useRef<Video>(null);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Handle video errors gracefully
  const handleVideoError = useCallback((error: any) => {
    console.log('Video loading error:', error);
    setHasError(true);
    setIsReady(false);
    
    // Retry logic for network issues
    if (retryCount < 2) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setHasError(false);
        if (videoRef.current) {
          videoRef.current.seek(0);
        }
      }, 2000);
    }
  }, [retryCount]);

  // Handle video load - start playing immediately
  const handleVideoLoad = useCallback(() => {
    console.log('Video loaded successfully');
    setHasError(false);
    setIsReady(true);
    
    // Start playing immediately when loaded
    if (videoRef.current && isVisible) {
      setTimeout(() => {
        videoRef.current?.resume?.();
      }, 100);
    }
  }, [isVisible]);

  // Handle buffer - no UI changes, just internal state
  const handleBuffer = useCallback(() => {
    // No UI updates, just handle buffering internally
  }, []);

  // Handle app state changes for video playback
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (videoRef.current) {
        if (nextAppState === 'active' && isVisible) {
          videoRef.current.resume();
        } else if (nextAppState === 'background') {
          videoRef.current.pause();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isVisible]);

  // Reset when video URL changes
  useEffect(() => {
    setHasError(false);
    setIsReady(false);
    setRetryCount(0);
  }, [videoUrl]);

  // Show fallback image on error - use thumbnailUrl if available
  if (hasError || !videoUrl) {
    return (
      <View style={styles.videoBannerContainer}>
        <Image
          source={{ uri: thumbnailUrl || DEFAULT_BANNER_IMAGE }}
          style={styles.videoFallbackImage}
          resizeMode="cover"
        />
        {/* Dark overlay for better text readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)']}
          style={styles.videoOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.videoBannerContainer}>
      {/* Video player - completely hidden controls, autoplay */}
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={styles.videoPlayer}
        resizeMode="cover"
        paused={!isVisible}
        repeat={true}
        muted={true}
        volume={0}
        playWhenInactive={false}
        playInBackground={false}
        ignoreSilentSwitch="ignore"
        onError={handleVideoError}
        onLoad={handleVideoLoad}
        onBuffer={handleBuffer}
        onReadyForDisplay={() => {
          setIsReady(true);
          if (videoRef.current && isVisible) {
            setTimeout(() => {
              videoRef.current?.resume?.();
            }, 50);
          }
        }}
        // Remove all controls and progress indicators
        controls={false}
        hideShutterView={true}
        // Optimize for performance
        bufferConfig={{
          minBufferMs: 1000,
          maxBufferMs: 5000,
          bufferForPlaybackMs: 250,
          bufferForPlaybackAfterRebufferMs: 500,
        }}
        // Use thumbnail as poster
        poster={thumbnailUrl || DEFAULT_BANNER_IMAGE}
        posterResizeMode="cover"
        // Preload for better performance
        rate={1.0}
        automaticallyWaitsToMinimizeStalling={true}
        // Remove any visual feedback
        progressUpdateInterval={1000}
        allowsExternalPlayback={false}
        filterEnabled={false}
      />
      
      {/* Dark overlay for better text readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)']}
        style={styles.videoOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      
      {/* Fallback image that shows initially until video is ready */}
      {!isReady && (
        <View style={styles.videoFallbackContainer}>
          <Image
            source={{ uri: thumbnailUrl || DEFAULT_BANNER_IMAGE }}
            style={styles.videoFallbackImage}
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
});

// Enhanced Image Banner Component (for image banners) - FIXED: Changed black background to white
interface ImageBannerProps {
  imageUrl: string;
  thumbnailUrl?: string;
}

const ImageBanner: React.FC<ImageBannerProps> = React.memo(({ imageUrl, thumbnailUrl }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageError = useCallback(() => {
    console.log('Image loading error');
    setImageLoaded(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const source = !imageUrl 
    ? { uri: thumbnailUrl || DEFAULT_BANNER_IMAGE }
    : { uri: imageUrl };

  return (
    <View style={styles.imageBannerContainer}>
      <Image
        source={source}
        style={styles.imageBanner}
        resizeMode="cover"
        onError={handleImageError}
        onLoad={handleImageLoad}
        defaultSource={{ uri: thumbnailUrl || DEFAULT_BANNER_IMAGE }}
      />
      {/* Dark overlay for better text readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)']}
        style={styles.imageOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
    </View>
  );
});

// Banner Component that handles single banner object
interface BannerComponentProps {
  banner: BannerItem | null;
  isVisible: boolean;
}

const BannerComponent: React.FC<BannerComponentProps> = React.memo(({ banner, isVisible }) => {
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (!banner) {
    return (
      <View style={styles.bannerContainer}>
        <ImageBanner 
          imageUrl={DEFAULT_BANNER_IMAGE} 
          thumbnailUrl={DEFAULT_BANNER_IMAGE}
        />
      </View>
    );
  }
  
  if (banner.document_type === 2) { // Video
    return (
      <View style={styles.bannerContainer}>
        <VideoBanner
          videoUrl={banner.icon}
          isVisible={isVisible}
          thumbnailUrl={banner.thumbnail || DEFAULT_BANNER_IMAGE}
        />
      </View>
    );
  }
  
  // Image (document_type === 1)
  return (
    <View style={styles.bannerContainer}>
      <ImageBanner 
        imageUrl={banner.icon || DEFAULT_BANNER_IMAGE} 
        thumbnailUrl={banner.thumbnail || DEFAULT_BANNER_IMAGE}
      />
    </View>
  );
});

// Favorite Button Component
const FavoriteButton = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isGuest } = useContext(AuthContext);
  
  const handleFavoritePress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen' as never);
    } else {
      navigation.navigate('FavoritesScreen' as never);
    }
  }, [navigation, isGuest]);

  return (
    <TouchableOpacity
      onPress={handleFavoritePress}
      activeOpacity={0.7}
      style={styles.iconButton}
    >
      <Icon 
        name="heart-outline" 
        size={scale(22)} 
        color={COLORS.headerIcon} 
      />
    </TouchableOpacity>
  );
};

// Profile Button Component
const ProfileButton = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isGuest } = useContext(AuthContext);
  
  const handleProfilePress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen' as never);
    } else {
      navigation.navigate('ProfileScreen' as never);
    }
  }, [navigation, isGuest]);

  return (
    <TouchableOpacity
      onPress={handleProfilePress}
      activeOpacity={0.7}
      style={styles.iconButton}
    >
      <Icon 
        name="person-circle-outline" 
        size={scale(26)} 
        color={COLORS.headerIcon} 
      />
    </TouchableOpacity>
  );
};

// Wallet Button Component
const WalletButton = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isGuest } = useContext(AuthContext);
  
  const handleWalletPress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen' as never);
    } else {
      navigation.navigate('EatoorMoneyScreen' as never);
    }
  }, [navigation, isGuest]);

  return (
    <TouchableOpacity
      onPress={handleWalletPress}
      activeOpacity={0.7}
      style={styles.iconButton}
    >
      <Icon
        name="wallet-outline"
        size={scale(22)}
        color={COLORS.headerIcon}
      />
    </TouchableOpacity>
  );
};

interface AddressHeaderLeftProps {
  isGuest: boolean;
  onAddressUpdate?: (address: string, homeType: string) => void;
}

const AddressHeaderLeft = React.memo(({ isGuest, onAddressUpdate }: AddressHeaderLeftProps) => {
  const navigation = useNavigation<NavigationProp>();
  const [location, setLocation] = useState<LocationData>({
    address: 'Fetching location...',
    loading: true,
    error: null,
    coords: null,
    showEnableLocationPrompt: false,
    showPermissionPrompt: false,
    homeType: 'Delivering',
    addressId: null,
  });

  // Track app state
  const [appState, setAppState] = useState(AppState.currentState);
  
  // Use refs to avoid function recreation
  const onAddressUpdateRef = useRef(onAddressUpdate);
  
  // Update ref when prop changes
  useEffect(() => {
    onAddressUpdateRef.current = onAddressUpdate;
  }, [onAddressUpdate]);

  // Update location state without calling parent callback during render
  const updateLocationState = useCallback((newState: Partial<LocationData>) => {
    setLocation(prev => ({ ...prev, ...newState }));
  }, []);

  // Use effect to notify parent when location changes
  useEffect(() => {
    if (onAddressUpdateRef.current && !location.loading && location.address && location.homeType) {
      onAddressUpdateRef.current(location.address, location.homeType);
    }
  }, [location.address, location.homeType, location.loading]);

  const saveAddressDetails = useCallback(async (addressData: {
    id?: string;
    full_address: string;
    home_type?: string;
    latitude: string;
    longitude: string;
  }) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ADDRESS_ID, addressData.id?.toString() || ''],
        [STORAGE_KEYS.STREET_ADDRESS, addressData.full_address],
        [STORAGE_KEYS.HOME_TYPE, addressData.home_type || 'Delivering'],
        [STORAGE_KEYS.LATITUDE, addressData.latitude],
        [STORAGE_KEYS.LONGITUDE, addressData.longitude],
      ]);
    } catch (error) {
      console.error('Error saving address details:', error);
    }
  }, []);

  const getSavedAddressDetails = useCallback(async (): Promise<{
    address: string;
    homeType: string;
    coords: { lat: number; lng: number } | null;
    addressId: string | null;
  }> => {
    try {
      const [savedAddress, savedHomeType, savedLat, savedLng, savedAddressId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STREET_ADDRESS),
        AsyncStorage.getItem(STORAGE_KEYS.HOME_TYPE),
        AsyncStorage.getItem(STORAGE_KEYS.LATITUDE),
        AsyncStorage.getItem(STORAGE_KEYS.LONGITUDE),
        AsyncStorage.getItem(STORAGE_KEYS.ADDRESS_ID),
      ]);

      if (savedAddress && savedLat && savedLng) {
        return {
          address: savedAddress,
          homeType: savedHomeType || 'Delivering',
          coords: {
            lat: parseFloat(savedLat),
            lng: parseFloat(savedLng),
          },
          addressId: savedAddressId,
        };
      }
      return {
        address: '',
        homeType: 'Delivering',
        coords: null,
        addressId: null,
      };
    } catch (error) {
      console.error('Error getting saved address details:', error);
      return {
        address: '',
        homeType: 'Delivering',
        coords: null,
        addressId: null,
      };
    }
  }, []);

  const checkLocationInDatabase = useCallback(async (lat: number, lng: number): Promise<boolean> => {
    try {
      const response = await getUserAddress({ 
        lat: lat.toString(), 
        long: lng.toString(),
        isGuest: isGuest
      });

      const addressData = response?.data;
      if (!addressData) {
        console.warn("No address data found for given location.");
        return false;
      }

      const { id, full_address, home_type } = addressData;
      const isExisting = Boolean(id);

      // Save address (with or without id)
      await saveAddressDetails({
        id: isExisting ? id.toString() : undefined,
        full_address,
        home_type: home_type || "Delivering",
        latitude: lat.toString(),
        longitude: lng.toString(),
      });

      // Update location state
      updateLocationState({
        address: full_address,
        coords: { lat, lng },
        homeType: home_type || "Delivering",
        addressId: isExisting ? id.toString() : null,
        loading: false,
        error: null,
        showEnableLocationPrompt: false,
        showPermissionPrompt: false,
      });

      return isExisting;
    } catch (error) {
      console.error("Error checking location in database:", error);
      return false;
    }
  }, [isGuest, saveAddressDetails, updateLocationState]);

  const checkLocationEnabled = useCallback(async (): Promise<boolean> => {
    try {
      return new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          () => resolve(true),
          (error) => {
            if (error.code === 1 || error.code === 2) {
              resolve(false);
            } else {
              resolve(true);
            }
          },
          { 
            enableHighAccuracy: false, 
            timeout: 3000, 
            maximumAge: 10000 
          }
        );
      });
    } catch (error) {
      console.error('Error checking location services:', error);
      return true;
    }
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        return new Promise((resolve) => {
          Geolocation.getCurrentPosition(
            () => resolve(true),
            (error) => {
              if (error.code === 1) {
                resolve(false);
              } else {
                resolve(true);
              }
            },
            { 
              enableHighAccuracy: false, 
              timeout: 5000, 
              maximumAge: 60000 
            }
          );
        });
      } else {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (hasPermission) {
          return true;
        }

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to show nearby kitchens',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<void> => {
    updateLocationState({ loading: true, error: null });

    try {
      // First, check if we have saved address details in local storage
      const savedDetails = await getSavedAddressDetails();
      if (savedDetails.address && savedDetails.coords) {
        updateLocationState({
          address: savedDetails.address,
          coords: savedDetails.coords,
          homeType: savedDetails.homeType,
          addressId: savedDetails.addressId,
          loading: false,
          error: null,
        });
        return;
      }

      // Check if location services are enabled
      const locationEnabled = await checkLocationEnabled();
      if (!locationEnabled) {
        updateLocationState({
          address: 'Location services disabled',
          coords: null,
          error: 'Location services disabled',
          showEnableLocationPrompt: true,
          loading: false,
        });
        return;
      }

      // Check and request permission
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        updateLocationState({
          address: 'Location permission required',
          coords: null,
          error: 'Location permission required',
          showPermissionPrompt: true,
          loading: false,
        });
        return;
      }

      // Get current position
      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          (error) => {
            if (Platform.OS === 'ios') {
              if (error.code === 1) {
                error.message = 'Location permission denied';
              } else if (error.code === 2) {
                error.message = 'Location unavailable. Please check your network connection';
              } else if (error.code === 3) {
                error.message = 'Location request timed out. Please try again';
              }
            } else {
              if (error.code === 2) {
                error.message = 'Unable to determine location. Please check your network connection';
              } else if (error.code === 3) {
                error.message = 'Location request timed out. Please try again';
              } else if (error.code === 1) {
                error.message = 'Location permission denied';
              }
            }
            reject(error);
          },
          {
            enableHighAccuracy: Platform.OS === 'ios',
            timeout: Platform.OS === 'ios' ? 15000 : 30000,
            maximumAge: 10000,
            distanceFilter: 50,
          }
        );
      });

      const { latitude, longitude } = position.coords;
      
      // Send coordinates to API to get address information
      await checkLocationInDatabase(latitude, longitude);
      
    } catch (error: any) {
      let errorMessage = 'Error getting location';
      let promptForEnable = false;
      let promptForPermission = false;
      
      if (error.code === 2 || error.code === 3) {
        errorMessage = error.message || 'Location unavailable';
        promptForEnable = true;
      } else if (error.code === 1) {
        errorMessage = 'Location permission denied';
        promptForPermission = true;
        
        // Clear any previously saved address if permission is denied
        try {
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.ADDRESS_ID,
            STORAGE_KEYS.STREET_ADDRESS,
            STORAGE_KEYS.HOME_TYPE,
            STORAGE_KEYS.LATITUDE,
            STORAGE_KEYS.LONGITUDE,
          ]);
        } catch (storageError) {
          console.error('Error clearing saved address:', storageError);
        }
      } else if (error.message?.includes('disabled')) {
        errorMessage = 'Location services disabled';
        promptForEnable = true;
      }
      
      updateLocationState({
        address: errorMessage,
        coords: null,
        error: errorMessage,
        showEnableLocationPrompt: promptForEnable,
        showPermissionPrompt: promptForPermission,
        loading: false,
      });
    }
  }, [checkLocationEnabled, requestLocationPermission, checkLocationInDatabase, updateLocationState, getSavedAddressDetails]);

  const showLocationSettingsAlert = useCallback(() => {
    Alert.alert(
      'Location Services Required',
      'To find kitchens near you, please enable location services in your device settings',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => updateLocationState({ showEnableLocationPrompt: false })
        },
        {
          text: 'Open Settings',
          onPress: async () => {
            updateLocationState({ showEnableLocationPrompt: false });
            try {
              if (Platform.OS === 'ios') {
                await Linking.openURL('app-settings:');
              } else {
                await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
              }
            } catch (error) {
              console.error('Error opening settings:', error);
              await Linking.openSettings();
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [updateLocationState]);

  const showPermissionAlert = useCallback(() => {
    Alert.alert(
      'Location Permission Required',
      'This app needs access to your location to show nearby kitchens',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => updateLocationState({ showPermissionPrompt: false })
        },
        {
          text: 'Allow',
          onPress: async () => {
            updateLocationState({ showPermissionPrompt: false });
            const granted = await requestLocationPermission();
            if (granted) {
              getCurrentLocation();
            } else {
              Alert.alert(
                'Permission Denied',
                'To enable location, please grant permission in app settings',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open Settings',
                    onPress: async () => {
                      try {
                        if (Platform.OS === 'ios') {
                          await Linking.openURL('app-settings:');
                        } else {
                          await Linking.openSettings();
                      }
                      } catch (error) {
                        console.error('Error opening settings:', error);
                      }
                    },
                  },
                ]
              );
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, [getCurrentLocation, requestLocationPermission, updateLocationState]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        getCurrentLocation();
      }
      setAppState(nextAppState);
    });
    return () => {
      subscription.remove();
    };
  }, [appState, getCurrentLocation]);

  useFocusEffect(
    useCallback(() => {
      getCurrentLocation();
    }, [getCurrentLocation])
  );

  useEffect(() => {
    if (location.showEnableLocationPrompt) {
      showLocationSettingsAlert();
    }
  }, [location.showEnableLocationPrompt, showLocationSettingsAlert]);

  useEffect(() => {
    if (location.showPermissionPrompt) {
      showPermissionAlert();
    }
  }, [location.showPermissionPrompt, showPermissionAlert]);

  const handleAddressPress = useCallback(() => {
    navigation.navigate('AddressScreen', {
      prevLocation: "HomeTabs",
      currentLocation: location.coords ? {
        latitude: location.coords.lat,
        longitude: location.coords.lng
      } : null,
      currentAddress: location.address || 'Select delivery location',
      onAddressSelect: (selectedAddressObj) => {
        const raw = selectedAddressObj.rawAddress;

        // Update UI
        updateLocationState({
          address: raw.full_address,
          coords: {
            lat: parseFloat(raw.latitude),
            lng: parseFloat(raw.longitude),
          },
          homeType: raw.home_type || 'Delivering',
          addressId: String(raw.id) || null,
          loading: false,
          error: null,
        });

        // Save address details
        if (raw.full_address && raw.latitude && raw.longitude) {
          (async () => {
            try {
              await saveAddressDetails({
                id: String(raw.id),
                full_address: raw.full_address,
                home_type: raw.home_type || 'Delivering',
                latitude: raw.latitude,
                longitude: raw.longitude,
              });
            } catch (error) {
              console.error('Error saving selected address:', error);
            }
          })();
        }
      }
    } as never);
  }, [navigation, location.coords, location.address, updateLocationState, saveAddressDetails]);

  // Function to truncate address based on screen width
  const truncateAddress = useCallback((address: string): string => {
    if (!address) return '';
    
    const maxLength = width < 360 ? 25 : width < 400 ? 30 : width < 450 ? 35 : 40;
    if (address.length <= maxLength) return address;
    
    return address.substring(0, maxLength - 3).trim() + '...';
  }, [width]);

  return (
    <TouchableOpacity
      onPress={handleAddressPress}
      activeOpacity={0.7}
      style={styles.addressContainer}
    >
      <View style={styles.addressRow}>
        <Icon
          name="location-outline" 
          size={scale(18)} 
          color="#FFFFFF" 
          style={styles.simpleLocationIcon}
        />
        <View style={styles.addressTextContainer}>
          <View style={styles.homeTypeContainer}>
            <Text style={styles.homeTypeText} numberOfLines={1}>
              {location.homeType || 'Delivering'}
            </Text>
            <Icon 
              name="chevron-down" 
              size={scale(14)} 
              color="#FFFFFF" 
              style={styles.chevronIcon} 
            />
          </View>
          
          <Text style={styles.addressMainText} numberOfLines={1}>
            {location.error ? location.error : truncateAddress(location.address)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Enhanced Search Input Component - ZOMATO STYLE
interface SearchInputProps {
  onPress: () => void;
  placeholder: string;
}

const SearchInput: React.FC<SearchInputProps> = React.memo(({ onPress, placeholder }) => {
  const scaleAnim = useState(() => new Animated.Value(1))[0];

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      {/* FIXED: Use View instead of TouchableOpacity for Android to avoid ripple effect */}
      {Platform.OS === 'android' ? (
        <View 
          style={[
            styles.searchInputTouchable,
            styles.searchInputTouchableAndroid,
            styles.searchInputTouchableAndroidFix // Added fix for Android
          ]}
        >
          <TouchableOpacity 
            style={styles.searchInputInnerTouchable}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
            // FIXED: Disable Android ripple effect
            android_ripple={{ color: 'transparent' }}
          >
            <View style={styles.searchInputContent}>
              <Icon 
                name="search" 
                size={scale(20)}
                color="#FFFFFF"
                style={styles.searchLeftIcon}
              />
              <View style={styles.searchTextContainer}>
                <Text 
                  style={[
                    styles.searchPlaceholderText,
                    styles.searchPlaceholderTextAndroid
                  ]} 
                  numberOfLines={1}
                  selectable={false}
                  selectionColor="transparent"
                  // FIXED: Additional Android text properties
                  textBreakStrategy="simple"
                  ellipsizeMode="tail"
                >
                  {placeholder}
                </Text>
              </View>
              <Icon 
                name="mic-outline" 
                size={scale(20)}
                color="#FFFFFF"
                style={styles.searchRightIcon}
              />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        // iOS version remains the same
        <TouchableOpacity 
          style={[
            styles.searchInputTouchable,
            styles.searchInputTouchableIOS
          ]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          <View style={styles.searchInputContent}>
            <Icon 
              name="search" 
              size={scale(20)}
              color="#FFFFFF"
              style={styles.searchLeftIcon}
            />
            <View style={styles.searchTextContainer}>
              <Text style={styles.searchPlaceholderText} numberOfLines={1}>
                {placeholder}
              </Text>
            </View>
            <Icon 
              name="mic-outline" 
              size={scale(20)}
              color="#FFFFFF"
              style={styles.searchRightIcon}
            />
          </View>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

// New Sticky Header Component with Search and Categories
const StickyHeader = ({ 
  onSearchPress, 
  categories, 
  activeCategory, 
  onCategoryPress,
  searchPlaceholder,
  homeType,
  address
}: { 
  onSearchPress: () => void;
  categories: Category[];
  activeCategory: number | null;
  onCategoryPress: (id: number, name: string) => void;
  searchPlaceholder: string;
  homeType: string;
  address: string;
}) => {
  return (
    <View style={styles.stickyHeader}>
      {/* Search Bar - Zomato Style */}
      <TouchableOpacity 
        style={[
          styles.stickySearchBar,
          Platform.select({
            android: styles.stickySearchBarAndroid,
            ios: styles.stickySearchBarIOS
          })
        ]}
        onPress={onSearchPress}
        activeOpacity={0.9}
        // Add these to prevent text selection on Android
        onLongPress={() => {}}
        delayLongPress={0}
      >
        <Icon 
          name="search" 
          size={scale(20)}
          color={COLORS.searchPlaceholder} 
          style={styles.stickySearchIcon} 
        />
        {/* FIXED: Added Platform.select for Android placeholder text selection prevention */}
        {Platform.select({
          android: (
            <Text 
              style={[
                styles.stickySearchPlaceholder,
                styles.stickySearchPlaceholderAndroid // Added specific style for Android
              ]} 
              numberOfLines={1}
              // Prevent text selection on Android
              selectable={false}
              selectionColor="transparent"
            >
              {searchPlaceholder}
            </Text>
          ),
          ios: (
            <Text style={styles.stickySearchPlaceholder} numberOfLines={1}>
              {searchPlaceholder}
            </Text>
          )
        })}
      </TouchableOpacity>

      {/* Categories Scroll - Zomato style */}
      {categories && categories.length > 0 && (
        <View style={styles.stickyCategoriesContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.stickyCategoriesScroll}
            contentContainerStyle={styles.stickyCategoriesContent}
          >
            {categories.map((category, index) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.stickyCategoryItem,
                  activeCategory === index && styles.stickyCategoryItemActive
                ]}
                onPress={() => onCategoryPress(category.id, category.name)}
                activeOpacity={0.8}
              >
                <View style={styles.stickyCategoryIconContainer}>
                  <Image 
                    source={{ uri: category.icon || DEFAULT_CATEGORY_ICON }} 
                    style={styles.stickyCategoryIcon}
                    resizeMode="cover"
                    defaultSource={{ uri: DEFAULT_CATEGORY_ICON }}
                  />
                </View>
                <Text style={[
                  styles.stickyCategoryText,
                  activeCategory === index && styles.stickyCategoryTextActive
                ]} numberOfLines={1}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

// Top Restaurant Card (Side by side like Zomato) - Updated to show 2 restaurants per frame
const TopRestaurantCard = ({ 
  kitchen, 
  onPress, 
  onToggleFavorite, 
  favoriteLoading,
  isGuest
}: { 
  kitchen: Kitchen; 
  onPress: (kitchen: Kitchen) => void; 
  onToggleFavorite: (kitchenId: string) => void; 
  favoriteLoading: string | null;
  isGuest: boolean;
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const scaleAnim = useState(() => new Animated.Value(1))[0];
  
  const rating = kitchen.rating || (Math.random() * 1 + 4).toFixed(1);
  const deliveryTime = kitchen.delivery_time || '30-40 min';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handleImageError = () => {
    setHasImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setHasImageError(false);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={() => onPress(kitchen)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.topRestaurantCard}
      >
        <View style={styles.topRestaurantImageContainer}>
          {!imageLoaded && !hasImageError && (
            <View style={[styles.topRestaurantImage, styles.imagePlaceholder]}>
              <ActivityIndicator size="small" color={COLORS.gradientStart} />
            </View>
          )}
          
          <Image 
            source={{ 
              uri: hasImageError 
                ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center'
                : kitchen.restaurant_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center'
            }} 
            style={styles.topRestaurantImage}
            resizeMode="cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            defaultSource={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center' }}
          />
          
          <View style={styles.topRestaurantRatingBadge}>
            <Icon name="star" size={scale(10)} color="#FFF" />
            <Text style={styles.topRestaurantRatingText}>{rating}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.topRestaurantFavoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(kitchen.restaurant_id);
            }}
            disabled={favoriteLoading === kitchen.restaurant_id}
          >
            <Icon 
              name={kitchen.is_favourite ? "heart" : "heart-outline"} 
              size={scale(16)} 
              color={kitchen.is_favourite ? COLORS.gradientStart : "#fff"} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.topRestaurantInfo}>
          <Text style={styles.topRestaurantName} numberOfLines={1}>
            {kitchen.restaurant_name}
          </Text>
          
          <View style={styles.topRestaurantMeta}>
            <Text style={styles.topRestaurantCuisine} numberOfLines={1}>
              {kitchen.item_cuisines?.split(', ').slice(0, 2).join(', ')}
            </Text>
            <View style={styles.topRestaurantDelivery}>
              <Icon name="time-outline" size={scale(10)} color={COLORS.textLight} />
              <Text style={styles.topRestaurantDeliveryText}>{deliveryTime}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Restaurant Card (2 in a row for "Restaurant Near You")
const RestaurantCard = ({ 
  kitchen, 
  onPress, 
  onToggleFavorite, 
  favoriteLoading,
  isGuest
}: { 
  kitchen: Kitchen; 
  onPress: (kitchen: Kitchen) => void; 
  onToggleFavorite: (kitchenId: string) => void; 
  favoriteLoading: string | null;
  isGuest: boolean;
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const scaleAnim = useState(() => new Animated.Value(1))[0];
  
  const rating = kitchen.rating || (Math.random() * 1 + 4).toFixed(1);
  const deliveryTime = kitchen.delivery_time || '30-40 min';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();
  };

  const handleImageError = () => {
    setHasImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setHasImageError(false);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={() => onPress(kitchen)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.restaurantCard}
      >
        <View style={styles.restaurantImageContainer}>
          {!imageLoaded && !hasImageError && (
            <View style={[styles.restaurantImage, styles.imagePlaceholder]}>
              <ActivityIndicator size="small" color={COLORS.gradientStart} />
            </View>
          )}
          
          <Image 
            source={{ 
              uri: hasImageError 
                ? 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center'
                : kitchen.restaurant_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center'
            }} 
            style={styles.restaurantImage}
            resizeMode="cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            defaultSource={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center' }}
          />
          
          <View style={styles.restaurantRatingBadge}>
            <Icon name="star" size={scale(10)} color="#FFF" />
            <Text style={styles.restaurantRatingText}>{rating}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.restaurantFavoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(kitchen.restaurant_id);
            }}
            disabled={favoriteLoading === kitchen.restaurant_id}
          >
            <Icon 
              name={kitchen.is_favourite ? "heart" : "heart-outline"} 
              size={scale(16)} 
              color={kitchen.is_favourite ? COLORS.gradientStart : "#fff"} 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {kitchen.restaurant_name}
          </Text>
          
          <View style={styles.restaurantMeta}>
            <Text style={styles.restaurantCuisine} numberOfLines={1}>
              {kitchen.item_cuisines?.split(', ').slice(0, 2).join(', ')}
            </Text>
            <View style={styles.restaurantDelivery}>
              <Icon name="time-outline" size={scale(10)} color={COLORS.textLight} />
              <Text style={styles.restaurantDeliveryText}>{deliveryTime}</Text>
            </View>
          </View>
          
          <Text style={styles.restaurantPrice}>₹{kitchen.avg_price_range || '200'} for one</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Custom Refresh Indicator Component
const CustomRefreshIndicator = ({ progress, refreshing }: { progress: number; refreshing: boolean }) => {
  const rotation = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.linear,
        })
      ).start();
    } else {
      rotation.setValue(0);
    }
  }, [refreshing]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (progress === 0 && !refreshing) return null;

  return (
    <View style={styles.customRefreshIndicator}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon 
          name="refresh" 
          size={scale(24)} 
          color={COLORS.gradientStart} 
        />
      </Animated.View>
      <Text style={styles.customRefreshText}>
        {refreshing ? 'Refreshing...' : progress > 1 ? 'Release to refresh' : 'Pull to refresh'}
      </Text>
    </View>
  );
};

// Refresh Success Feedback Component
const RefreshSuccessFeedback = ({ visible }: { visible: boolean }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
};

// Kitchen Screen Component
const KitchenScreenTabs: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { isGuest, userToken } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [showAllActiveOrders, setShowAllActiveOrders] = useState(false);
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchItem[]>([]);
  const [searchSuggestionsData, setSearchSuggestionsData] = useState<SearchSuggestionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [homeType, setHomeType] = useState<string>('Delivering');
  const [address, setAddress] = useState<string>('Fetching location...');
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [headerLoader, setHeaderLoader] = useState(true);

  // Track header visibility for video playback
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  // Scroll animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const isAtTop = useRef(true);
  
  // Pre-banner loading state
  const [bannerReady, setBannerReady] = useState(false);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Calculate header animations with insets
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Track header visibility
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      setIsHeaderVisible(value <= HEADER_HEIGHT / 2);
    });

    return () => {
      scrollY.removeListener(listenerId);
    };
  }, []);

  // Sticky header animation - appears at top
  const stickyHeaderTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - 100, HEADER_HEIGHT],
    outputRange: [-HEADER_HEIGHT, -HEADER_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  // Handle address update from AddressHeaderLeft
  const handleAddressUpdate = useCallback((newAddress: string, newHomeType: string) => {
    setAddress(newAddress);
    setHomeType(newHomeType);
  }, []);

  // Enhanced placeholder animation
  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;
    
    if (mounted) {
      interval = setInterval(() => {
        if (mounted) {
          setCurrentPlaceholderIndex(prev => (prev + 1) % SEARCH_PLACEHOLDERS.length);
        }
      }, 3000);
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      if (userToken) {
        const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
        if (userData) {
          const parsedUser = JSON.parse(userData) as User;
          setUser(parsedUser);
          return parsedUser;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, [userToken]);

  // Fetch recent searches and search history
  const fetchRecentSearches = useCallback(async () => {
    try {
      const [recent, history] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES),
        AsyncStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY)
      ]);
      
      if (recent) setRecentSearches(JSON.parse(recent));
      if (history) setSearchHistory(JSON.parse(history));
    } catch (error) {
      console.error('Error fetching search data:', error);
    }
  }, []);

  // Save search data
  const saveToRecentSearches = useCallback(async (query: string, item?: SearchItem) => {
    try {
      const updatedSearches = [
        query,
        ...recentSearches.filter(search => search.toLowerCase() !== query.toLowerCase())
      ].slice(0, 5);
      
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updatedSearches));

      if (item) {
        const updatedHistory = [
          { ...item, searchedAt: new Date().toISOString() },
          ...searchHistory.filter(hist => hist.id !== item.id)
        ].slice(0, 10);
        
        setSearchHistory(updatedHistory);
        await AsyncStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('Error saving search data:', error);
    }
  }, [recentSearches, searchHistory]);

  const updateCartItemUser = useCallback(async (userId: string) => {
    try {
      const payload = { 
        user_id: userId,
        session_id: sessionId, 
        cart_status: 2, 
        restaurant_id: pastKitchenDetails?.id, 
      };

      const response = await updateCartUserDetails(payload);
      return response?.status === 200;
    } catch (error) {
      console.error('Error updating cart user details:', error);
      return false;
    }
  }, [sessionId, pastKitchenDetails?.id]);

  // Fetch active orders
  const fetchActiveOrders = useCallback(async (userId: string) => {
    try {
      setOrdersLoading(true);
      const payload = { user_id: userId };
      const response = await getActiveOrders(payload);

      if (response?.status === 200) {
        const formattedOrders: ActiveOrder[] = response.data.orders
          .map(order => {
            const now = moment();
            const deliveryTime = moment(order.estimated_delivery);
            const minutesRemaining = deliveryTime.diff(now, 'minutes');

            let status: ActiveOrder['status'];
            let statusText: string;
            
            switch (order.status) {
              case 'Cancelled':
                status = 'cancelled';
                statusText = 'Cancelled';
                break;
              case 'Pending':
                status = 'pending';
                statusText = 'Pending';
                break;
              case 'Confirmed':
                status = 'confirmed';
                statusText = 'Confirmed';
                break;
              case 'On the Way':
                status = 'on-the-way';
                statusText = 'On The Way';
                break;
              case 'Preparing':
                status = 'preparing';
                statusText = 'Preparing';
                break;
              case 'Ready for Delivery/Pickup':
                status = 'preparing';
                statusText = 'Ready';
                break;
              default:
                status = minutesRemaining <= 0 ? 'delivered' : 'preparing';
                statusText = minutesRemaining <= 0 ? 'Delivered' : 'Preparing';
            }

            return {
              id: order.order_number,
              orderNumber: order.order_number,
              status,
              statusText,
              kitchenId: order.order_number,
              kitchenName: order.kitchan_name,
              kitchenImage: order.kitchan_image,
              estimatedArrival: `${Math.max(1, minutesRemaining)} min`,
              placedOn: moment(order.placed_on).format('MMM D, h:mm A'),
            };
          })
          .filter(order => order.status !== 'delivered');

        formattedOrders.sort((a, b) => {
          const aMinutes = parseInt(a.estimatedArrival);
          const bMinutes = parseInt(b.estimatedArrival);
          return aMinutes - bMinutes;
        });

        setActiveOrders(formattedOrders);
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Past kitchen details
  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PAST_KITCHEN_DETAILS, JSON.stringify(details));
      setPastKitchenDetails(details);
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);
  
  const fetchPastKitchenDetails = useCallback(async (userId: string | null) => {
    try {
      // Try to get stored details first
      const storedDetails = await AsyncStorage.getItem(STORAGE_KEYS.PAST_KITCHEN_DETAILS);
      const sessionId = await getSessionId();

      if (storedDetails) {
        setPastKitchenDetails(JSON.parse(storedDetails));
        return;
      }

      // If no stored details, fetch from API
      const payload = { 
        session_id: userId ? null : sessionId, 
        user_id: userId 
      };
      const response = await getCart(payload);
      
      if (response?.status === 200) {
        const existingCart = response?.data?.existingCartDetails || [];
        if (existingCart.length > 0) {
          const newPastKitchenDetails = {
            id: existingCart[0]?.restaurant_id,
            name: existingCart[0]?.restaurant_name,
            image: existingCart[0]?.restaurant_profile_image,
            itemCount: response?.data?.total_item_count || 0
          };
          await savePastKitchenDetails(newPastKitchenDetails);
          setPastKitchenDetails(newPastKitchenDetails);
        }
      } else {
        setPastKitchenDetails(null);
      }
    } catch (error) {
      console.error('Error fetching past kitchen details:', error);
    }
  }, [savePastKitchenDetails]);

  // Fetch kitchens with enhanced data - UPDATED TO INCLUDE THUMBNAIL
  const fetchKitchens = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getKitchenList();
      
      if (response.data?.success) {
        const processedData = {
          ...response.data,
          data: {
            ...response.data.data,
            FeatureKitchenList: response.data.data.FeatureKitchenList.map(k => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false,
              rating: (Math.random() * 1 + 4).toFixed(1),
              delivery_time: `${Math.floor(Math.random() * 15) + 20}-${Math.floor(Math.random() * 20) + 35} min`,
              discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0,
              is_new: Math.random() > 0.8,
              is_trending: Math.random() > 0.9,
              distance: `${(Math.random() * 5).toFixed(1)} km`,
              restaurant_image: k.restaurant_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center'
            })),
            KitchenList: response.data.data.KitchenList.map(k => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false,
              rating: (Math.random() * 1 + 4).toFixed(1),
              delivery_time: `${Math.floor(Math.random() * 15) + 20}-${Math.floor(Math.random() * 20) + 35} min`,
              discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0,
              is_new: Math.random() > 0.8,
              is_trending: Math.random() > 0.9,
              distance: `${(Math.random() * 5).toFixed(1)} km`,
              restaurant_image: k.restaurant_image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&h=150&fit=crop&crop=center'
            })),
            CategoryList: response.data.data.CategoryList.map(c => ({
              ...c,
              icon: c.icon || DEFAULT_CATEGORY_ICON
            })),
            // Process banner data - now includes thumbnail from API
            final_banner_image: response.data.data.final_banner_image ? {
              ...response.data.data.final_banner_image,
              icon: response.data.data.final_banner_image.icon || DEFAULT_BANNER_IMAGE,
              thumbnail: response.data.data.final_banner_image.thumbnail || DEFAULT_BANNER_IMAGE,
              document_type: response.data.data.final_banner_image.document_type || 1
            } : {
              icon: DEFAULT_BANNER_IMAGE,
              thumbnail: DEFAULT_BANNER_IMAGE,
              document_type: 1 as const
            }
          }
        };
        
        setApiData(processedData);
        setIsInitialLoad(false);
        
        // Hide header loader after 1 second
        setTimeout(() => {
          setHeaderLoader(false);
        }, 1000);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch kitchens. Please try again later.');
      console.error('Error fetching kitchens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Enhanced search functionality
  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchSuggestionsData(null);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    try {
      setSearchLoading(true);

      const response = await searchSuggestions(query);
      if (response?.data) {
        setSearchSuggestionsData(response.data);
        
        const transformedResults: SearchItem[] = [];
        
        // Transform menu items
        response.data.menus.forEach(menu => {
          menu.items.forEach(item => {
            transformedResults.push({
              id: `menu-${item.id}`,
              name: item.item_name || menu.menu_name,
              image: item.item_image,
              type: 'food',
              category: menu.menu_name,
              price: item.item_price,
              foodType: item.food_type,
              restaurant: item.restaurant,
              originalData: item,
              rating: Math.random() * 2 + 3,
              deliveryTime: `${Math.floor(Math.random() * 20) + 15}-${Math.floor(Math.random() * 20) + 35} min`
            });
          });
        });
        
        // Transform restaurants
        response.data.restaurants.forEach(restaurant => {
          const cuisineNames = restaurant.cuisines
            .filter(cuisine => cuisine.cuisine_name)
            .map(cuisine => cuisine.cuisine_name)
            .join(', ');
            
          transformedResults.push({
            id: `restaurant-${restaurant.restaurant_id}`,
            name: restaurant.restaurant_name,
            image: restaurant.profile_image,
            type: 'restaurant',
            category: cuisineNames || 'Various cuisines',
            originalData: restaurant,
            rating: restaurant.rating || Math.random() * 2 + 3,
            deliveryTime: restaurant.delivery_time || `${Math.floor(Math.random() * 20) + 15}-${Math.floor(Math.random() * 20) + 35} min`,
            distance: restaurant.distance || `${(Math.random() * 5).toFixed(1)} km`
          });
        });

        // Add trending items if available
        if (response.data.trending_items) {
          response.data.trending_items.forEach(item => {
            transformedResults.unshift({
              id: `trending-${item.id}`,
              name: item.name,
              image: item.image,
              type: 'trending',
              originalData: item
            });
          });
        }

        setSearchResults(transformedResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Initialize session ID
  const initializeSession = useCallback(async () => {
    try {
      if (sessionId) {
        return sessionId;
      }
      
      const storedSessionId = await AsyncStorage.getItem(STORAGE_KEYS.SESSION_ID);
      if (storedSessionId) {
        setSessionId(storedSessionId);
        return storedSessionId;
      }

      const newSessionId = await getSessionId();
      
      if (newSessionId) {
        setSessionId(newSessionId);
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId);
        return newSessionId;
      }
      return null;
    } catch (error) {
      console.error("Error initializing session:", error);
      const fallbackSession = await getSessionId();
      return fallbackSession;
    }
  }, [sessionId]);

  useEffect(() => {
    initializeSession();
  }, []);

  // Initial data loading
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!isMounted) return;
      
      const userData = await fetchUserData();
      await fetchKitchens();
      await fetchRecentSearches();

      if (userData) {
        await Promise.all([
          fetchActiveOrders(userData.id),
          fetchPastKitchenDetails(userData.id)
        ]);
      } else {
        await fetchPastKitchenDetails(null);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      user?.id &&
      sessionId &&
      pastKitchenDetails?.id
    ) {
      updateCartItemUser(user.id);
    }
  }, [
    user?.id,
    sessionId,
    pastKitchenDetails?.id,
    updateCartItemUser,
  ]);

  // Search effect
  useEffect(() => {
    if (debouncedSearchQuery && isSearchModalVisible) {
      fetchSearchSuggestions(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0 && isSearchModalVisible) {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, isSearchModalVisible, fetchSearchSuggestions]);

  // Enhanced refresh control with smooth animation
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    setShowRefreshSuccess(false);
    
    try {
      // Add haptic feedback for iOS
      if (Platform.OS === 'ios') {
        const HapticFeedback = require('react-native-haptic-feedback');
        HapticFeedback.trigger('impactLight');
      }
      
      // Add a minimum delay for better UX
      const minDelay = new Promise(resolve => setTimeout(resolve, 1000));
      
      const userData = await fetchUserData();
      
      // Execute all requests in parallel
      await Promise.all([
        fetchKitchens(),
        userData ? fetchActiveOrders(userData.id) : Promise.resolve(null),
        userData ? fetchPastKitchenDetails(userData.id) : fetchPastKitchenDetails(null),
        fetchRecentSearches(),
      ]);

      // Wait for minimum delay to show loading animation
      await minDelay;
      
      // Show success feedback
      setShowRefreshSuccess(true);
      
      // Hide success feedback after 2 seconds
      setTimeout(() => {
        setShowRefreshSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('Refresh error:', error);
      
      // Show error feedback
      Alert.alert(
        'Refresh Failed',
        'Unable to refresh data. Please check your connection and try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing, 
    fetchKitchens, 
    fetchActiveOrders, 
    fetchPastKitchenDetails, 
    fetchUserData, 
    fetchRecentSearches
  ]);

  // Enhanced Search handlers
  const openSearchModal = useCallback(() => {
    setIsSearchModalVisible(true);
  }, []);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchSuggestionsData(null);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    if (searchQuery.trim()) {
      try {
        await saveToRecentSearches(searchQuery);
        closeSearchModal();
        
        navigation.navigate('HomeKitchenNavigate', { 
          screen: 'SearchResults', 
          params: { 
            query: searchQuery,
            suggestionsData: searchSuggestionsData
          } 
        } as never);
      } catch (error) {
        console.error('Error handling search submit:', error);
      }
    }
  }, [searchQuery, navigation, closeSearchModal, saveToRecentSearches, searchSuggestionsData]);

  const handleRecentSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    setTimeout(() => {
      handleSearchSubmit();
    }, 100);
  }, [handleSearchSubmit]);

  const handlePopularSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    setTimeout(() => {
      handleSearchSubmit();
    }, 100);
  }, [handleSearchSubmit]);

  const handleSearchResultPress = useCallback((item: SearchItem) => {
    saveToRecentSearches(item.name, item);
    closeSearchModal();
    
    if (item.type === 'restaurant') {
      navigation.navigate('HomeKitchenDetails', { 
        kitchenId: (item.originalData as SearchRestaurant)?.restaurant_id || item.id.replace('restaurant-', '')
      } as never);
    } else {
      navigation.navigate('HomeKitchenNavigate', { 
        screen: 'SearchResults', 
        params: { 
          query: item.name,
          itemId: item.id.replace('menu-', ''),
          suggestionsData: searchSuggestionsData
        } 
      } as never);
    }
  }, [closeSearchModal, navigation, saveToRecentSearches, searchSuggestionsData]);

  const clearRecentSearches = useCallback(async () => {
    try {
      setRecentSearches([]);
      setSearchHistory([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
      await AsyncStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  // Order handlers
  const handleOrderPress = useCallback((order: ActiveOrder) => {
    navigation.navigate('TrackOrder', { order: { order_number: order.orderNumber } } as never);
  }, [navigation]);

  const handleViewAllOrders = useCallback(() => {
    navigation.navigate('ActiveOrders', { orders: activeOrders } as never);
  }, [navigation, activeOrders]);

  const toggleShowAllActiveOrders = useCallback(() => {
    setShowAllActiveOrders(prev => !prev);
  }, []);

  // Category press handler - Fixed: Only opens search with category name
  const handleCategoryPress = useCallback((categoryId: number, categoryName: string) => {
    // Only set active category state (visual feedback)
    const categoryIndex = apiData?.data.CategoryList.findIndex(cat => cat.id === categoryId) ?? -1;
    setActiveCategory(categoryIndex === activeCategory ? null : categoryIndex);
    
    // Open search modal with category name
    setIsSearchModalVisible(true);
    setSearchQuery(categoryName);
  }, [activeCategory, apiData]);

  // Toggle favorite with isGuest check
  const toggleFavorite = useCallback(async (kitchenId: string) => {
    if (favoriteLoading) return;

    if (isGuest) {
      navigation.navigate('LoginScreen', { 
        callback: 'HomeTabs',
        message: 'Please login to add to favorites' 
      } as never);
      return;
    }

    try {
      setFavoriteLoading(kitchenId);
      setApiData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          data: {
            ...prev.data,
            KitchenList: prev.data.KitchenList.map(kitchen => 
              kitchen.restaurant_id === kitchenId 
                ? { ...kitchen, is_favourite: !kitchen.is_favourite } 
                : kitchen
            ),
            FeatureKitchenList: prev.data.FeatureKitchenList.map(kitchen => 
              kitchen.restaurant_id === kitchenId 
                ? { ...kitchen, is_favourite: !kitchen.is_favourite } 
                : kitchen
            )
          }
        };
      });
      await updateFavouriteKitchen({ restaurant_id: kitchenId });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status. Please try again.');
    } finally {
      setFavoriteLoading(null);
    }
  }, [favoriteLoading, navigation, isGuest]);

  const BackToKitchen = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('HomeKitchenDetails', { kitchenId: pastKitchenDetails.id } as never);
    }
  }, [navigation, pastKitchenDetails]);

  const handleViewCart = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('CartScreen', { pastkitcheId: pastKitchenDetails.id } as never);
    }
  }, [navigation, pastKitchenDetails]);

  const handleRemoveRecentSearch = useCallback((query: string) => {
    setRecentSearches(prev => prev.filter(item => item !== query));
  }, []);

  const displayedActiveOrders = showAllActiveOrders ? activeOrders : activeOrders.slice(0, ACTIVE_ORDERS_LIMIT);
  const searchInputRef = useRef<TextInput>(null);
  
  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.homeTabsContainer, styles.homeTabsLoadingContainer]}>
        <View style={styles.homeTabsLoadingContent}>
          <ActivityIndicator size="large" color={COLORS.gradientStart} />
          <Text style={styles.homeTabsLoadingText}>Discovering amazing kitchens...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!apiData) {
    return (
      <SafeAreaView style={[styles.homeTabsContainer, styles.homeTabsEmptyContainer]}>
        <Icon name="alert-circle-outline" size={scale(60)} color={COLORS.textLight} />
        <Text style={styles.homeTabsEmptyText}>No data available</Text>
        <TouchableOpacity 
          style={styles.homeTabsRetryButton}
          onPress={fetchKitchens}
          activeOpacity={0.7}
        >
          <Text style={styles.homeTabsRetryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.homeTabsContainer}>
      {/* Search Modal - Fixed to be full screen and not affect tab bar */}
      <SearchModal
        isVisible={isSearchModalVisible}
        onClose={closeSearchModal}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchInputRef={searchInputRef}
        onSearchSubmit={handleSearchSubmit}
        recentSearches={recentSearches}
        searchHistory={searchHistory}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onRecentSearchPress={handleRecentSearchPress}
        onPopularSearchPress={handlePopularSearchPress}
        onSearchResultPress={handleSearchResultPress}
        onClearRecentSearches={clearRecentSearches}
        onRemoveRecentSearch={handleRemoveRecentSearch}
        tabBarHeight={scale(70)}
      />
      
      {/* Refresh Success Feedback */}
      <RefreshSuccessFeedback visible={showRefreshSuccess} />
      
      {/* Main Header with Animation and Background Image/Video - FIXED LAYOUT */}
      <Animated.View style={[
        styles.homeTabsMainHeader,
        {
          transform: [{ translateY: headerTranslateY }],
          opacity: headerOpacity,
          height: HEADER_HEIGHT,
        }
      ]}>
        {/* Background Banner (Image or Video) - Positioned absolutely behind content */}
        <View style={styles.headerBackgroundContainer}>
          <BannerComponent 
            banner={apiData?.data?.final_banner_image || null}
            isVisible={isHeaderVisible}
          />
        </View>
        
        {/* Header Content - Positioned above the banner */}
        <View style={[styles.headerContentContainer, { 
          paddingTop: insets.top + verticalScale(10),
          paddingHorizontal: scale(16)
        }]}>
          {/* Top section with address and icons */}
          <View style={styles.headerTopRow}>
            <AddressHeaderLeft isGuest={isGuest} onAddressUpdate={handleAddressUpdate} />
            <View style={styles.headerIcons}>
              <FavoriteButton />
              <WalletButton />
              <ProfileButton />
            </View>
          </View>
          
          {/* Search Input with consistent sizing and alignment */}
          <View style={styles.headerSearchContainer}>
            <SearchInput
              onPress={openSearchModal}
              placeholder={SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
            />
          </View>
        </View>
      </Animated.View>

      {/* Sticky Header (Appears on scroll) */}
      <Animated.View 
        style={[
          styles.stickyHeaderContainer,
          {
            transform: [{ translateY: stickyHeaderTranslateY }],
            paddingTop: insets.top + verticalScale(10),
          }
        ]}
      >
        <StickyHeader
          onSearchPress={openSearchModal}
          categories={apiData.data.CategoryList.slice(0, 8)}
          activeCategory={activeCategory}
          onCategoryPress={handleCategoryPress}
          searchPlaceholder={SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
          homeType={homeType}
          address={address}
        />
      </Animated.View>

      {/* Main Content with Enhanced Refresh Control */}
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.mainScrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: HEADER_HEIGHT + verticalScale(16) }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.gradientStart]}
            tintColor={COLORS.gradientStart}
            title="Pull to refresh"
            titleColor={COLORS.gradientStart}
            progressBackgroundColor="#fff"
            style={Platform.OS === 'ios' ? styles.iosRefreshControl : undefined}
            size={Platform.OS === 'android' ? RefreshControl.SIZE : undefined}
            progressViewOffset={HEADER_HEIGHT}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        overScrollMode="always"
        bounces={true}
        bouncesZoom={true}
        alwaysBounceVertical={true}
      >
        {/* Categories Section with Images - Fixed scrolling (Zomato Style) */}
        {apiData.data.CategoryList && apiData.data.CategoryList.length > 0 && (
          <View style={styles.categoriesSection}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScrollView}
              contentContainerStyle={styles.categoriesContent}
            >
              {apiData.data.CategoryList.map((category, index) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryItem,
                    activeCategory === index && styles.categoryItemActive
                  ]}
                  onPress={() => handleCategoryPress(category.id, category.name)}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.categoryIconContainer,
                    activeCategory === index && styles.categoryIconContainerActive
                  ]}>
                    <Image 
                      source={{ uri: category.icon || DEFAULT_CATEGORY_ICON }} 
                      style={styles.categoryIcon}
                      resizeMode="cover"
                      defaultSource={{ uri: DEFAULT_CATEGORY_ICON }}
                    />
                  </View>
                  <Text style={[
                    styles.categoryText,
                    activeCategory === index && styles.categoryTextActive
                  ]} numberOfLines={1}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Top Restaurants Section - Show 2 restaurants per frame */}
        {apiData.data.FeatureKitchenList && apiData.data.FeatureKitchenList.length > 0 && (
          <View style={styles.contentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TOP RESTAURANTS NEAR YOU</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.topRestaurantsScroll}
              contentContainerStyle={styles.topRestaurantsContent}
            >
              {/* Group kitchens in pairs of 2 */}
              {(() => {
                const pairs = [];
                const kitchens = apiData.data.FeatureKitchenList.slice(0, 10);
                for (let i = 0; i < kitchens.length; i += 2) {
                  pairs.push(kitchens.slice(i, i + 2));
                }
                return pairs.map((pair, pairIndex) => (
                  <View key={`pair-${pairIndex}`} style={styles.topRestaurantPair}>
                    {pair.map((kitchen) => (
                      <TopRestaurantCard
                        key={kitchen.restaurant_id}
                        kitchen={kitchen}
                        onPress={(k) => navigation.navigate('HomeKitchenDetails', { kitchenId: k.restaurant_id } as never)}
                        onToggleFavorite={toggleFavorite}
                        favoriteLoading={favoriteLoading}
                        isGuest={isGuest}
                      />
                    ))}
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        )}

        {/* All Restaurants Section - 2 cards per row */}
        <View style={styles.contentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RESTAURANTS NEAR YOU</Text>
            <Text style={styles.sectionSubtitle}>{apiData.data.KitchenList.length} restaurants</Text>
          </View>
          
          <View style={styles.restaurantGrid}>
            {apiData.data.KitchenList.map(kitchen => (
              <RestaurantCard
                key={kitchen.restaurant_id}
                kitchen={kitchen}
                onPress={(k) => navigation.navigate('HomeKitchenDetails', { kitchenId: k.restaurant_id } as never)}
                onToggleFavorite={toggleFavorite}
                favoriteLoading={favoriteLoading}
                isGuest={isGuest}
              />
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Active Orders Footer */}
      {activeOrders.length > 0 && !ordersLoading && (
        <View style={styles.activeOrdersFooter}>
          {displayedActiveOrders.map((order, index) => (
            <React.Fragment key={order.id}>
              <TouchableOpacity
                style={styles.activeOrderItem}
                onPress={() => handleOrderPress(order)}
                activeOpacity={0.9}
              >
                <View style={styles.activeOrderContent}>
                  <Image 
                    source={{ 
                      uri: order.kitchenImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=50&h=50&fit=crop&crop=center'
                    }} 
                    style={styles.activeOrderImage}
                    defaultSource={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=50&h=50&fit=crop&crop=center' }}
                  />
                  <View style={styles.activeOrderDetails}>
                    <Text style={styles.activeOrderKitchen} numberOfLines={1}>
                      {order.kitchenName}
                    </Text>
                    <View style={styles.activeOrderStatus}>
                      <Icon 
                        name={order.status === 'on-the-way' ? 'bicycle' : 'time-outline'} 
                        size={scale(14)} 
                        color={COLORS.gradientStart} 
                      />
                      <Text style={styles.activeOrderStatusText}>
                        {order.statusText}
                      </Text>
                    </View>
                  </View>
                  {order.status !== 'cancelled' && (
                    <View style={styles.activeOrderTime}>
                      <Text style={styles.activeOrderTimeText}>{order.estimatedArrival}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {index < displayedActiveOrders.length - 1 && (
                <View style={styles.orderDivider} />
              )}
            </React.Fragment>
          ))}
          
          {activeOrders.length > ACTIVE_ORDERS_LIMIT && (
            <TouchableOpacity 
              style={styles.activeOrdersSeeAll}
              onPress={toggleShowAllActiveOrders}
            >
              <Text style={styles.activeOrdersSeeAllText}>
                {showAllActiveOrders ? 'Show less' : `View all ${activeOrders.length} active orders`}
              </Text>
              <Icon 
                name={showAllActiveOrders ? "chevron-up" : "chevron-down"} 
                size={scale(16)} 
                color={COLORS.gradientStart} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cart Summary */}
      {pastKitchenDetails && activeOrders.length === 0 && (
        <View style={[
          styles.cartSummaryContainer,
          { 
            bottom: Platform.OS === 'ios' 
              ? (insets.bottom > 0 ? 10 : verticalScale(95))
              : verticalScale(10)
          }
        ]}>
          <View style={styles.cartSummaryContent}>
            <View style={styles.cartSummaryInfo}>
              <Image 
                source={{ 
                  uri: pastKitchenDetails.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=48&h=48&fit=crop&crop=center'
                }} 
                style={styles.cartSummaryImage}
                defaultSource={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=48&h=48&fit=crop&crop=center' }}
              />
              <View style={styles.cartSummaryText}>
                <Text style={styles.cartSummaryTitle} numberOfLines={1}>
                  {pastKitchenDetails.name}
                </Text>
                <TouchableOpacity onPress={BackToKitchen}>
                  <Text style={styles.cartSummarySubtitle}>View Menu →</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.cartSummaryButton}
              onPress={handleViewCart}
            >
              <Text style={styles.cartSummaryButtonText}>View Cart</Text>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{pastKitchenDetails.itemCount}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// Kitchen Tab Navigator
const KitchenTabNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="KitchenHome" component={KitchenScreenTabs} />
      {/* Add other kitchen-related screens here if needed */}
    </Stack.Navigator>
  );
};

// HomeTabsNavigator component - This should be the main tab navigator
const HomeTabsNavigator = React.memo(({ isGuest }: { isGuest: boolean }) => {

  const [isRestaurantRegister, setIsRestaurantRegister] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      const value = await AsyncStorage.getItem('is_restaurant_register');
      setIsRestaurantRegister(value === 'true');
    };

    loadStatus();
  }, []);

  const insets = useSafeAreaInsets();
  
  // Calculate tab bar height based on device
  const tabBarHeight = useMemo(() => {
    if (isSmallDevice) return scale(60);
    if (isMediumDevice) return scale(65);
    return scale(70);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const routeName = route.name as AppTabs;
          const iconName = focused
            ? tabIconsFocused[routeName]
            : tabIcons[routeName];

          return (
            <Animatable.View 
              animation={focused ? "bounceIn" : undefined} 
              duration={600} 
              useNativeDriver
              style={styles.tabIconContainer}
            >
              <Icon name={iconName} size={size} color={color} />
            </Animatable.View>
          );
        },
        tabBarActiveTintColor: COLORS.gradientStart,
        tabBarInactiveTintColor: COLORS.textLighter,
        tabBarStyle: [
          { 
            height: tabBarHeight,
            paddingBottom: isAndroid ? scale(8) : scale(10),
            paddingTop: scale(6),
          }
        ],
        tabBarLabelStyle: [
          styles.tabLabel,
          { 
            fontSize: fontScale(11),
            marginBottom: isAndroid ? scale(4) : scale(2)
          }
        ],
        headerShown: false,
        tabBarShowLabel: true,
      })}
      sceneContainerStyle={styles.sceneContainer}
    >
      <Tab.Screen 
        name="Kitchen" 
        component={KitchenTabNavigator} 
        options={{ 
          tabBarLabel: 'Kitchens',
          tabBarTestID: 'kitchen-tab',
        }} 
      />
      <Tab.Screen 
        name="Eatmart" 
        component={EatmartScreen} 
        options={{ 
          tabBarLabel: 'Eatmart',
          tabBarTestID: 'eatmart-tab',
        }} 
      />
      {!isGuest && (
        <Tab.Screen 
          name="Reorder" 
          component={ReorderScreen} 
          options={{ 
            tabBarLabel: 'Reorder',
            tabBarTestID: 'reorder-tab',
          }} 
        />
      )}
      {
        isRestaurantRegister && (
          <Tab.Screen 
        name="Partner" 
        component={PartnerScreen} 
        options={{ 
          tabBarLabel: 'Partner',
          tabBarTestID: 'partner-tab',
        }} 
      />
        )}
    </Tab.Navigator>
  );
});

// HomeTabs component - This is what gets exported
const HomeTabs = () => {
  const { userToken, isGuest } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true}
      />
      <View style={[styles.fullScreenContainer, { paddingBottom: insets.bottom }]}>
        <HomeTabsNavigator isGuest={isGuest} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  // Base Container Styles
  homeTabsContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  sceneContainer: {
    backgroundColor: COLORS.background,
  },

  // Banner Components Styles - FIXED: Changed all black backgrounds to white
  bannerContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderBottomLeftRadius: scale(20),
    borderBottomRightRadius: scale(20),
    backgroundColor: COLORS.background, // FIX: Added white background
  },
  
  // VIDEO BANNER STYLES - ZOMATO STYLE - FIXED: Changed black to white
  videoBannerContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: "#FFFFFF80", // FIX: Changed from '#000' to white
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: "#FFFFFF80", // FIX: Changed from '#000' to white
  },
  videoFallbackContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF80", // FIX: Changed from '#000' to white
  },
  videoFallbackImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // IMAGE BANNER STYLES - FIXED: Changed black to white
  imageBannerContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background, // FIX: Changed from '#000' to white
    overflow: 'hidden',
    position: 'relative',
  },
  imageBanner: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Header Styles with Background Image/Video
  homeTabsMainHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    height: HEADER_HEIGHT,
  },
  headerBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderBottomLeftRadius: scale(20),
    borderBottomRightRadius: scale(20),
  },
  headerContentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(16),
    minHeight: verticalScale(40),
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  headerSearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },

  // Sticky Header Container
  stickyHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: COLORS.background, // FIX: Ensure white background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderBottomLeftRadius: scale(20),
    borderBottomRightRadius: scale(20),
    overflow: 'hidden',
  },

  // Sticky Header styles - ZOMATO STYLE
  stickyHeader: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(8),
  },
  stickySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(Platform.OS === 'ios' ? 14 : 12),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stickySearchBarAndroid: {
    borderColor: COLORS.searchAndroidBorder,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  stickySearchBarIOS: {
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  stickySearchIcon: {
    marginRight: scale(12),
  },
  stickySearchPlaceholder: {
    fontSize: fontScale(15),
    fontFamily: FONTS.medium,
    color: COLORS.searchPlaceholder,
    flex: 1,
  },
  stickyCategoriesContainer: {
    height: verticalScale(85),
  },
  stickyCategoriesScroll: {
    flexDirection: 'row',
  },
  stickyCategoriesContent: {
    paddingRight: scale(16),
    alignItems: 'center',
  },
  stickyCategoryItem: {
    alignItems: 'center',
    marginRight: scale(12),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(6),
    width: scale(80),
  },
  stickyCategoryItemActive: {
    backgroundColor: COLORS.zomatoGray,
    borderRadius: scale(12),
  },
  stickyCategoryIconContainer: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    marginBottom: verticalScale(6),
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  stickyCategoryIcon: {
    width: '100%',
    height: '100%',
  },
  stickyCategoryText: {
    fontSize: fontScale(11),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  stickyCategoryTextActive: {
    color: COLORS.gradientStart,
    fontFamily: FONTS.semiBold,
  },

  // Address styles
  addressContainer: {
    flex: 1,
    marginRight: scale(12),
    justifyContent: 'center',
    minHeight: verticalScale(40),
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  simpleLocationIcon: {
    marginRight: scale(6),
    alignSelf: 'flex-start',
    marginTop: Platform.OS === 'ios' ? verticalScale(2) : 0,
  },
  addressTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  homeTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
    flexWrap: 'wrap',
  },
  homeTypeText: {
    fontSize: fontScale(14),
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontWeight: '900',
    lineHeight: fontScale(16),
  },
  addressMainText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '700',
    lineHeight: fontScale(14),
    letterSpacing: 0.2,
  },
  chevronIcon: {
    marginLeft: scale(4),
    marginTop: Platform.OS === 'ios' ? verticalScale(1) : 0,
  },

  // Search Input styles - FIXED FOR ANDROID (no conflicting shadow/elevation)
  
  searchInputTouchable: {
    borderRadius: scale(20),
    height: verticalScale(56),
    justifyContent: 'center',
    width: width - scale(32),
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
  },
  
  // Android-specific fixes
  searchInputTouchableAndroid: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    elevation: 2,
    overflow: 'hidden', // Important for Android to contain ripple
  },
  searchInputTouchableAndroidFix: {
    // Additional Android fix properties
    elevation: 0, // Remove elevation from container
    backgroundColor: 'transparent', // Make container transparent
  },
  
  // Inner touchable for Android
  searchInputInnerTouchable: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Move background here
  },
  
  // iOS version
  searchInputTouchableIOS: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  searchInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: scale(16),
  },
  
  searchLeftIcon: {
    marginRight: scale(12),
  },
  
  searchTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  
  searchPlaceholderText: {
    fontSize: fontScale(15),
    fontFamily: FONTS.medium,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    lineHeight: fontScale(18),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // FIXED: Android-specific placeholder text style
  searchPlaceholderTextAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
    // Additional Android text fix properties
    paddingVertical: 0,
    marginVertical: 0,
    minHeight: 0, // Prevent extra height
  },
  
  searchRightIcon: {
    marginLeft: scale(12),
  },

  // Icon Button Styles
  iconButton: {
    marginLeft: scale(12),
    padding: scale(4),
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: scale(40),
    minHeight: scale(40),
  },

  // Scroll content styles
  mainScrollContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: verticalScale(120),
  },

  // Categories Section - ZOMATO STYLE
  categoriesSection: {
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(24),
  },
  categoriesScrollView: {
    flexDirection: 'row',
    marginTop: verticalScale(12),
  },
  categoriesContent: {
    paddingRight: scale(16),
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: scale(16),
    width: scale(80),
  },
  categoryItemActive: {
    transform: [{ scale: 1.05 }],
  },
  categoryIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(8),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  categoryIconContainerActive: {
    borderColor: COLORS.gradientStart,
  },
  categoryIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
  },
  categoryText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: fontScale(14),
  },
  categoryTextActive: {
    color: COLORS.gradientStart,
    fontFamily: FONTS.semiBold,
  },

  // Content Section styles
  contentSection: {
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  sectionTitle: {
    fontSize: fontScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    letterSpacing: 0.5,
    lineHeight: fontScale(18),
  },
  sectionSubtitle: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textLighter,
    letterSpacing: 0.3,
    lineHeight: fontScale(14),
  },

  // Top Restaurants Section
  topRestaurantsScroll: {
    flexDirection: 'row',
  },
  topRestaurantsContent: {
    paddingRight: scale(16),
  },
  topRestaurantPair: {
    flexDirection: 'row',
    marginRight: scale(12),
  },
  topRestaurantCard: {
    width: (width - scale(16) * 2 - scale(12) * 3) / 2,
    marginRight: scale(12),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    marginBottom: verticalScale(12),
  },
  topRestaurantImageContainer: {
    height: verticalScale(120),
    position: 'relative',
  },
  topRestaurantImage: {
    width: '100%',
    height: '100%',
  },
  topRestaurantRatingBadge: {
    position: 'absolute',
    bottom: scale(8),
    left: scale(8),
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(20),
  },
  topRestaurantRatingText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginLeft: scale(2),
    lineHeight: fontScale(14),
  },
  topRestaurantFavoriteButton: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRestaurantInfo: {
    padding: scale(12),
  },
  topRestaurantName: {
    fontSize: fontScale(15),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: verticalScale(6),
    letterSpacing: 0.3,
    lineHeight: fontScale(17),
  },
  topRestaurantMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  topRestaurantCuisine: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    flex: 1,
    marginRight: scale(8),
    lineHeight: fontScale(14),
  },
  topRestaurantDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRestaurantDeliveryText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginLeft: scale(4),
    lineHeight: fontScale(14),
  },

  // Restaurant Grid
  restaurantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  restaurantCard: {
    width: (width - scale(16) * 2 - scale(8)) / 2,
    marginBottom: verticalScale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  restaurantImageContainer: {
    height: verticalScale(140),
    position: 'relative',
  },
  restaurantImage: {
    width: '100%',
    height: '100%',
  },
  restaurantRatingBadge: {
    position: 'absolute',
    bottom: scale(6),
    left: scale(6),
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(3),
    borderRadius: scale(20),
  },
  restaurantRatingText: {
    fontSize: fontScale(11),
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginLeft: scale(2),
    lineHeight: fontScale(13),
  },
  restaurantFavoriteButton: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantInfo: {
    padding: scale(12),
  },
  restaurantName: {
    fontSize: fontScale(15),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: verticalScale(6),
    letterSpacing: 0.3,
    lineHeight: fontScale(17),
  },
  restaurantMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  restaurantCuisine: {
    fontSize: fontScale(11),
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    flex: 1,
    marginRight: scale(4),
    lineHeight: fontScale(13),
  },
  restaurantDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantDeliveryText: {
    fontSize: fontScale(11),
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginLeft: scale(2),
    lineHeight: fontScale(13),
  },
  restaurantPrice: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    letterSpacing: 0.3,
    lineHeight: fontScale(14),
  },

  // Active Orders Footer
  activeOrdersFooter: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? verticalScale(10) : verticalScale(10),
    left: scale(16),
    right: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    padding: scale(12),
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  activeOrderItem: {
    marginBottom: verticalScale(8),
  },
  activeOrderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeOrderImage: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    marginRight: scale(12),
  },
  activeOrderDetails: {
    flex: 1,
  },
  activeOrderKitchen: {
    fontSize: fontScale(14),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: verticalScale(4),
    letterSpacing: 0.3,
    lineHeight: fontScale(16),
  },
  activeOrderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeOrderStatusText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    marginLeft: scale(4),
    lineHeight: fontScale(14),
  },
  activeOrderTime: {
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(12),
  },
  activeOrderTimeText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.semiBold,
    color: COLORS.gradientStart,
    lineHeight: fontScale(14),
  },
  orderDivider: {
    height: 1,
    backgroundColor: COLORS.zomatoLightGray,
    marginVertical: verticalScale(8),
  },
  activeOrdersSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: verticalScale(8),
  },
  activeOrdersSeeAllText: {
    fontSize: fontScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.gradientStart,
    marginRight: scale(4),
    letterSpacing: 0.3,
    lineHeight: fontScale(16),
  },

  // Cart Summary
  cartSummaryContainer: {
    position: 'absolute',
    left: scale(16),
    right: scale(16),
    backgroundColor: '#FFFFFF',
    borderRadius: scale(16),
    padding: scale(10),
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
    borderWidth: 1,
    borderColor: COLORS.zomatoLightGray,
  },
  cartSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartSummaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(16),
  },
  cartSummaryImage: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    marginRight: scale(12),
    borderWidth: 1,
    borderColor: COLORS.zomatoLightGray,
  },
  cartSummaryText: {
    flex: 1,
  },
  cartSummaryTitle: {
    fontSize: fontScale(14),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: verticalScale(4),
    letterSpacing: 0.3,
    lineHeight: fontScale(16),
  },
  cartSummarySubtitle: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.gradientStart,
    letterSpacing: 0.3,
    lineHeight: fontScale(14),
  },
  cartSummaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gradientStart,
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderRadius: scale(20),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gradientStart,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cartSummaryButtonText: {
    fontSize: fontScale(14),
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
    marginRight: scale(8),
    letterSpacing: 0.3,
    lineHeight: fontScale(16),
  },
  cartBadge: {
    backgroundColor: '#FFFFFF',
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cartBadgeText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.bold,
    color: COLORS.gradientStart,
    lineHeight: fontScale(14),
  },

  // Tab Bar styles - IMPROVED FOR BOTTOM ALIGNMENT
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.zomatoLightGray,
    paddingTop: verticalScale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  tabLabel: {
    fontSize: fontScale(11),
    fontFamily: FONTS.medium,
    marginTop: verticalScale(4),
    letterSpacing: 0.3,
    lineHeight: fontScale(13),
  },
  tabIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Loading and Empty states
  homeTabsLoadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeTabsLoadingContent: {
    alignItems: 'center',
  },
  homeTabsLoadingText: {
    marginTop: verticalScale(16),
    fontSize: fontScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    letterSpacing: 0.3,
    lineHeight: fontScale(18),
  },
  homeTabsEmptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  homeTabsEmptyText: {
    fontSize: fontScale(18),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginTop: verticalScale(16),
    letterSpacing: 0.3,
    lineHeight: fontScale(20),
  },
  homeTabsRetryButton: {
    marginTop: verticalScale(20),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    backgroundColor: COLORS.gradientStart,
    borderRadius: scale(12),
    ...Platform.select({
      ios: {
        shadowColor: COLORS.gradientStart,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  homeTabsRetryButtonText: {
    color: '#fff',
    fontSize: fontScale(16),
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
    lineHeight: fontScale(18),
  },
  imagePlaceholder: {
    backgroundColor: COLORS.zomatoGray,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Custom Refresh Control Styles
  customRefreshIndicator: {
    position: 'absolute',
    top: HEADER_HEIGHT + verticalScale(10),
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1001,
  },
  customRefreshText: {
    fontSize: fontScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.gradientStart,
    marginTop: verticalScale(4),
    letterSpacing: 0.3,
    lineHeight: fontScale(14),
  },
  iosRefreshControl: {
    backgroundColor: '#F07119',
  },
});

export default HomeTabs;