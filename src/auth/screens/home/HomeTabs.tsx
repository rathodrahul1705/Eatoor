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
  PanResponder,
  Modal
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Icon2 from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import { BlurView } from '@react-native-community/blur';
import PartnerScreen from './PartnerScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ReorderScreen from '../../screens/home/ReorderScreen';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation';
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

// ============== CONSTANTS & CONFIGURATION ==============

// Screen dimensions
const { width, height } = Dimensions.get('window');
const screenWidth = width;
const screenHeight = height;

// Responsive scaling functions
const scale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  return Math.round(size * Math.min(1.6, Math.max(0.8, scaleFactor)));
};

const verticalScale = (size: number) => {
  const baseHeight = 812;
  const scaleFactor = screenHeight / baseHeight;
  return Math.round(size * Math.min(1.4, Math.max(0.7, scaleFactor)));
};

const fontScale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  const scaledSize = size * Math.min(1.3, Math.max(0.85, scaleFactor));
  return Math.round(scaledSize);
};

// Color Palette - UPDATED: Kitchen/Eatmart/Reorder/Partner color changed to #E55C18
const COLORS = {
  primary: '#E55C18',
  primaryGradient: ['#E55C18', '#F15A2E', '#FF6B4A'],
  secondary: '#00B8A9',
  accent: '#6C5CE7',
  success: '#00B894',
  warning: '#FDCB6E',
  danger: '#FF7675',
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F9FAFC',
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    tertiary: '#94A3B8',
    light: '#FFFFFF',
    dark: '#0F172A',
  },
  gradient: {
    start: '#E55C18',
    end: '#FF6B4A',
    overlay: ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.1)'],
    card: ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.98)'],
  },
  border: {
    light: '#F1F5F9',
    default: '#E2E8F0',
  },
  zomato: {
    pink: '#FF7E7E',
    red: '#E55C18',
    orange: '#F15A2E',
    gray: '#F8FAFC',
    dark: '#1E293B',
  }
};

// Typography
const TYPOGRAPHY = {
  h1: { fontSize: fontScale(28), lineHeight: fontScale(34), fontWeight: '700' as const },
  h2: { fontSize: fontScale(24), lineHeight: fontScale(30), fontWeight: '700' as const },
  h3: { fontSize: fontScale(20), lineHeight: fontScale(26), fontWeight: '600' as const },
  h4: { fontSize: fontScale(18), lineHeight: fontScale(24), fontWeight: '600' as const },
  body1: { fontSize: fontScale(16), lineHeight: fontScale(24), fontWeight: '400' as const },
  body2: { fontSize: fontScale(14), lineHeight: fontScale(20), fontWeight: '400' as const },
  caption: { fontSize: fontScale(12), lineHeight: fontScale(16), fontWeight: '400' as const },
  button: { fontSize: fontScale(15), lineHeight: fontScale(20), fontWeight: '600' as const },
};

// Dynamic header height - INCREASED with bottom radius
const HEADER_HEIGHT = screenHeight * (Platform.OS === 'ios' ? 0.52 : 0.48);
const STICKY_HEADER_HEIGHT = verticalScale(120);

// Storage Keys
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
  IS_RESTAURANT_REGISTER: 'is_restaurant_register',
  HEADER_OFFERS: 'headerOffers'
};

// Default Assets
const DEFAULT_BANNER_IMAGE = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=600&fit=crop&crop=center&q=80";
const DEFAULT_CATEGORY_ICON = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop&crop=center&q=80";
const DEFAULT_RESTAURANT_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop&crop=center&q=80";

// Search Placeholders
const SEARCH_PLACEHOLDERS = [
  "Pizza, burger, pasta...",
  "Chinese, Thai, Asian...",
  "Biryani, Shawarma...",
  "Desserts, Sweets...",
  "Healthy, Salad, Bowl..."
];

// ============== HEADER OFFERS CONFIGURATION ==============
const HEADER_OFFERS = []
// const HEADER_OFFERS = [
//   {
//     id: '1',
//     title: 'FLAT 40% OFF',
//     subtitle: 'Get Biryani @99',
//     discount: '40%',
//     kitchenId: 'STA59068507',
//     image: 'https://eatoorprod.s3.amazonaws.com/menu_images/5df3397c503b4ad09da617107984f682.jpg',
//     offerCode: '',
//     validUntil: '2024-12-31',
//     isActive: true,
//     backgroundColor: 'rgba(229, 92, 24, 0.9)' // Made slightly transparent
//   },
//   {
//     id: '2',
//     title: 'FLAT 20% OFF',
//     subtitle: 'Get Waffle @49',
//     discount: '20%',
//     kitchenId: 'WAF67901458',
//     image: 'https://eatoorprod.s3.amazonaws.com/menu_images/fbeb16c5a4534abeb02b40c736cc1fd6.jpg',
//     offerCode: '',
//     validUntil: '2024-12-31',
//     isActive: true,
//     backgroundColor: 'rgba(78, 205, 196, 0.9)' // Made slightly transparent
//   },
//   {
//     id: '3',
//     title: 'FLAT 30% OFF',
//     subtitle: 'Pizza Mania',
//     discount: '30%',
//     kitchenId: 'PIZ12345678',
//     image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop&crop=center&q=80',
//     offerCode: 'PIZZA30',
//     validUntil: '2024-12-31',
//     isActive: true,
//     backgroundColor: 'rgba(168, 230, 207, 0.9)' // Made slightly transparent
//   },
//   {
//     id: '4',
//     title: 'BUY 1 GET 1',
//     subtitle: 'On all burgers',
//     discount: 'BOGO',
//     kitchenId: 'BUR56789012',
//     image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=400&fit=crop&crop=center&q=80',
//     offerCode: 'BOGOBURGER',
//     validUntil: '2024-12-31',
//     isActive: true,
//     backgroundColor: 'rgba(255, 217, 61, 0.9)' // Made slightly transparent
//   },
//   {
//     id: '5',
//     title: 'FLAT 50% OFF',
//     subtitle: 'Healthy bowls',
//     discount: '50%',
//     kitchenId: 'BOWL34567890',
//     image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop&crop=center&q=80',
//     offerCode: 'HEALTHY50',
//     validUntil: '2024-12-31',
//     isActive: true,
//     backgroundColor: 'rgba(108, 92, 231, 0.9)' // Made slightly transparent
//   }
// ];

// ============== TYPES ==============

interface LocationData {
  address: string;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lng: number } | null;
  showEnableLocationPrompt: boolean;
  showPermissionPrompt: boolean;
  homeType: string;
  addressId: string | null;
}

interface AddressHeaderLeftProps {
  isGuest: boolean;
  onAddressUpdate?: (address: string, homeType: string) => void;
}

interface BannerItem {
  id: string;
  name: string;
  icon: string;
  document_type: 1 | 2;
  thumbnail?: string;
}

interface BannerComponentProps {
  banner: BannerItem | null;
  isVisible: boolean;
}

interface ImageBannerProps {
  imageUrl: string;
  thumbnailUrl?: string;
}

interface VideoBannerProps {
  videoUrl: string;
  isVisible: boolean;
  thumbnailUrl?: string;
}

interface SearchInputProps {
  onPress: () => void;
  placeholder: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Kitchen {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  item_cuisines: string;
  rating: string;
  delivery_time: string;
  avg_price_range: string;
  is_favourite: boolean;
  discount?: number;
  distance?: string;
  review_count?: number;
  is_new?: boolean;
  is_trending?: boolean;
}

interface ApiResponse {
  data: {
    success: boolean;
    data: {
      FeatureKitchenList: Kitchen[];
      KitchenList: Kitchen[];
      CategoryList: Category[];
      final_banner_image: BannerItem;
    };
  };
}

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'on-the-way' | 'delivered' | 'cancelled';
  statusText: string;
  kitchenId: string;
  kitchenName: string;
  kitchenImage: string;
  estimatedArrival: string;
  placedOn: string;
}

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
}

interface SearchItem {
  id: string;
  name: string;
  image: string;
  type: 'food' | 'restaurant' | 'trending';
  category?: string;
  price?: string;
  foodType?: string;
  restaurant?: string;
  rating?: number;
  deliveryTime?: string;
  distance?: string;
  originalData?: any;
}

interface SearchRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  profile_image: string;
  rating: string;
  delivery_time: string;
  distance: string;
  cuisines: Array<{ cuisine_name: string }>;
}

interface SearchSuggestionResponse {
  menus: Array<{
    menu_name: string;
    items: Array<{
      id: string;
      item_name: string;
      item_image: string;
      item_price: string;
      food_type: string;
      restaurant: string;
    }>;
  }>;
  restaurants: SearchRestaurant[];
  trending_items?: Array<{
    id: string;
    name: string;
    image: string;
  }>;
}

type AppTabs = 'Kitchen' | 'Eatmart' | 'Reorder' | 'Partner';

interface OfferCard {
  id: string;
  title: string;
  subtitle: string;
  discount: string;
  kitchenId: string;
  image: string;
  offerCode?: string;
  validUntil?: string;
  isActive?: boolean;
  backgroundColor?: string;
}

// ============== CUSTOM HOOKS ==============

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

// ============== PREMIUM COMPONENTS ==============

// FIXED: Animated Loading Icon Component - Works on both iOS and Android
const AnimatedLoadingIcon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View style={{
      transform: [{ scale: scaleAnim }],
      opacity: opacityAnim,
    }}>
      <Icon2 name={name} size={size} color={color} />
    </Animated.View>
  );
};

// Premium Video Banner Component
const PremiumVideoBanner: React.FC<VideoBannerProps> = React.memo(({ videoUrl, isVisible, thumbnailUrl }) => {
  const videoRef = useRef<Video>(null);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1.1)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }).start();
    }
  }, [isVisible, scaleAnim]);

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

  const handleVideoLoad = useCallback(() => {
    setHasError(false);
    setIsReady(true);
    if (videoRef.current && isVisible) {
      setTimeout(() => videoRef.current?.resume?.(), 100);
    }
  }, [isVisible]);

  const handleVideoError = useCallback(() => {
    setHasError(true);
    setIsReady(false);
  }, []);

  if (hasError || !videoUrl) {
    return (
      <Animated.View style={[styles.premiumBannerContainer, { transform: [{ scale: scaleAnim }] }]}>
        <Image
          source={{ uri: thumbnailUrl || DEFAULT_BANNER_IMAGE }}
          style={styles.premiumBannerImage}
          resizeMode="cover"
        />
        <View style={[StyleSheet.absoluteFillObject, styles.premiumBannerOverlay]} />
      </Animated.View>
    );
  }

  return (
    <View style={styles.premiumBannerContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], flex: 1 }}>
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={styles.premiumBannerVideo}
          resizeMode="cover"
          paused={!isVisible}
          repeat={true}
          muted={true}
          volume={0}
          playInBackground={false}
          onError={handleVideoError}
          onLoad={handleVideoLoad}
          controls={false}
          hideShutterView={true}
          poster={thumbnailUrl || DEFAULT_BANNER_IMAGE}
          posterResizeMode="cover"
          rate={1.0}
          bufferConfig={{
            minBufferMs: 1000,
            maxBufferMs: 5000,
            bufferForPlaybackMs: 250,
            bufferForPlaybackAfterRebufferMs: 500,
          }}
        />
      </Animated.View>
      <View style={[StyleSheet.absoluteFillObject, styles.premiumBannerOverlay]} />
      {!isReady && (
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source={{ uri: thumbnailUrl || DEFAULT_BANNER_IMAGE }}
            style={styles.premiumBannerImage}
            resizeMode="cover"
          />
          <View style={[StyleSheet.absoluteFillObject, styles.premiumBannerOverlay]} />
        </View>
      )}
    </View>
  );
});

// Premium Image Banner Component
const PremiumImageBanner: React.FC<ImageBannerProps> = React.memo(({ imageUrl, thumbnailUrl }) => {
  const scaleAnim = useRef(new Animated.Value(1.1)).current;

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 6000,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [scaleAnim]);

  return (
    <View style={styles.premiumBannerContainer}>
      <Animated.Image
        source={{ uri: imageUrl || thumbnailUrl || DEFAULT_BANNER_IMAGE }}
        style={[styles.premiumBannerImage, { transform: [{ scale: scaleAnim }] }]}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFillObject, styles.premiumBannerOverlay]} />
    </View>
  );
});

// Premium Banner Component
const PremiumBannerComponent: React.FC<BannerComponentProps> = React.memo(({ banner, isVisible }) => {
  if (!banner) {
    return <PremiumImageBanner imageUrl={DEFAULT_BANNER_IMAGE} />;
  }
  
  if (banner.document_type === 2) {
    return (
      <PremiumVideoBanner
        videoUrl={banner.icon}
        isVisible={isVisible}
        thumbnailUrl={banner.thumbnail}
      />
    );
  }
  
  return <PremiumImageBanner imageUrl={banner.icon} thumbnailUrl={banner.thumbnail} />;
});

// FIXED: Premium Header Offer Cards Component - Platform specific styling for proper transparency and alignment
const PremiumHeaderOfferCards = React.memo(() => {
  const navigation = useNavigation();
  const [offers, setOffers] = useState<OfferCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Load offers from AsyncStorage or use default
  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      const storedOffers = await AsyncStorage.getItem(STORAGE_KEYS.HEADER_OFFERS);
      if (storedOffers) {
        setOffers(JSON.parse(storedOffers));
      } else {
        // Use default offers and save to storage - only active and first 2
        const activeOffers = HEADER_OFFERS.filter(offer => offer.isActive).slice(0, 2);
        setOffers(activeOffers);
        await AsyncStorage.setItem(STORAGE_KEYS.HEADER_OFFERS, JSON.stringify(activeOffers));
      }
    } catch (error) {
      console.error('Error loading header offers:', error);
      setOffers(HEADER_OFFERS.filter(offer => offer.isActive).slice(0, 2));
    } finally {
      setLoading(false);
    }
  };

  const navigateToOffer = useCallback((kitchenId: string, offer: OfferCard) => {
    navigation.navigate('HomeKitchenDetails', { 
      kitchenId,
      offerDetails: {
        title: offer.title,
        discount: offer.discount,
        offerCode: offer.offerCode
      }
    });
  }, [navigation]);

  // Animation values for each offer
  const slideAnims = useRef(offers.map(() => new Animated.Value(50))).current;
  const scaleAnims = useRef(offers.map(() => new Animated.Value(0.9))).current;

  useEffect(() => {
    // Update animations when offers change
    if (slideAnims.length !== offers.length) {
      // Reinitialize animations if offers length changes
      while (slideAnims.length < offers.length) {
        slideAnims.push(new Animated.Value(50));
        scaleAnims.push(new Animated.Value(0.9));
      }
    }

    const animations = offers.flatMap((_, index) => [
      Animated.spring(slideAnims[index], {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        delay: 200 + (index * 100),
      }),
      Animated.spring(scaleAnims[index], {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        delay: 200 + (index * 100),
      }),
    ]);

    Animated.parallel(animations).start();
  }, [offers]);

  if (loading || offers.length === 0) {
    return null;
  }

  return (
    <View style={styles.premiumHeaderOfferCardsContainer}>
      {offers.map((offer, index) => (
        <Animated.View 
          key={offer.id}
          style={[
            styles.premiumHeaderOfferCard,
            {
              transform: [
                { translateX: slideAnims[index] || new Animated.Value(50) },
                { scale: scaleAnims[index] || new Animated.Value(0.9) }
              ]
            }
          ]}
        >
          <TouchableOpacity 
            activeOpacity={0.95} 
            onPress={() => navigateToOffer(offer.kitchenId, offer)}
            style={{ flex: 1 }}
          >
            {/* FIXED: Platform specific implementation for proper transparency */}
            <View style={[
              styles.premiumHeaderOfferCardContent,
              { backgroundColor: offer.backgroundColor || 'rgba(229, 92, 24, 0.85)' }
            ]}>
              {/* iOS: Use BlurView for glass effect */}
              {Platform.OS === 'ios' && (
                <BlurView
                  style={StyleSheet.absoluteFillObject}
                  blurType="light"
                  blurAmount={10}
                  reducedTransparencyFallbackColor={offer.backgroundColor || 'rgba(229, 92, 24, 0.85)'}
                />
              )}
              
              {/* Android: Use additional semi-transparent overlay for better transparency effect */}
              {Platform.OS === 'android' && (
                <View style={[
                  StyleSheet.absoluteFillObject,
                  styles.premiumHeaderOfferAndroidOverlay
                ]} />
              )}
              
              <View style={styles.premiumHeaderOfferInner}>
                <View style={styles.premiumHeaderOfferContent}>
                  <Text style={styles.premiumHeaderOfferTitle} numberOfLines={1}>
                    {offer.title}
                  </Text>
                  <Text style={styles.premiumHeaderOfferSubtitle} numberOfLines={1}>
                    {offer.subtitle}
                  </Text>
                  
                  {offer.offerCode && (
                    <View style={styles.premiumHeaderOfferChip}>
                      <Text style={styles.premiumHeaderOfferChipText} numberOfLines={1}>
                        Code: {offer.offerCode}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.premiumHeaderOfferImageContainer}>
                  <Image 
                    source={{ uri: offer.image }} 
                    style={styles.premiumHeaderOfferImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  );
});

// Premium Address Header Component
const PremiumAddressHeader = React.memo(({ isGuest, onAddressUpdate }: AddressHeaderLeftProps) => {
  const navigation = useNavigation<any>();
  const [location, setLocation] = useState<LocationData>({
    address: 'Delivering to...',
    loading: true,
    error: null,
    coords: null,
    showEnableLocationPrompt: false,
    showPermissionPrompt: false,
    homeType: 'Home',
    addressId: null,
  });

  const [appState, setAppState] = useState(AppState.currentState);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const truncateAddress = (address: string, maxWords: number = 4) => {
    if (!address) return '';
    const words = address.split(' ');
    if (words.length <= maxWords) return address;
    return words.slice(0, maxWords).join(' ') + '...';
  };

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
        [STORAGE_KEYS.HOME_TYPE, addressData.home_type || 'Home'],
        [STORAGE_KEYS.LATITUDE, addressData.latitude],
        [STORAGE_KEYS.LONGITUDE, addressData.longitude],
      ]);
    } catch (error) {
      console.error('Error saving address:', error);
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
          homeType: savedHomeType || 'Home',
          coords: {
            lat: parseFloat(savedLat),
            lng: parseFloat(savedLng),
          },
          addressId: savedAddressId,
        };
      }
      return {
        address: '',
        homeType: 'Home',
        coords: null,
        addressId: null,
      };
    } catch (error) {
      console.error('Error getting saved address:', error);
      return {
        address: '',
        homeType: 'Home',
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
        return false;
      }

      const { id, full_address, home_type } = addressData;
      const isExisting = Boolean(id);

      await saveAddressDetails({
        id: isExisting ? id.toString() : undefined,
        full_address,
        home_type: home_type || "Home",
        latitude: lat.toString(),
        longitude: lng.toString(),
      });

      setLocation(prev => ({
        ...prev,
        address: full_address,
        coords: { lat, lng },
        homeType: home_type || "Home",
        addressId: isExisting ? id.toString() : null,
        loading: false,
        error: null,
        showEnableLocationPrompt: false,
        showPermissionPrompt: false,
      }));

      if (onAddressUpdate) {
        onAddressUpdate(full_address, home_type || "Home");
      }

      return isExisting;
    } catch (error) {
      console.error("Error checking location:", error);
      return false;
    }
  }, [isGuest, saveAddressDetails, onAddressUpdate]);

  const checkLocationEnabled = useCallback(async (): Promise<boolean> => {
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
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
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
      try {
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
            message: 'This app needs access to your location to show nearby restaurants',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('Error requesting permission:', error);
        return false;
      }
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<void> => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      const savedDetails = await getSavedAddressDetails();
      if (savedDetails.address && savedDetails.coords) {
        setLocation(prev => ({
          ...prev,
          address: savedDetails.address,
          coords: savedDetails.coords,
          homeType: savedDetails.homeType,
          addressId: savedDetails.addressId,
          loading: false,
          error: null,
        }));
        if (onAddressUpdate) {
          onAddressUpdate(savedDetails.address, savedDetails.homeType);
        }
        return;
      }

      const locationEnabled = await checkLocationEnabled();
      if (!locationEnabled) {
        setLocation(prev => ({
          ...prev,
          address: 'Location services disabled',
          coords: null,
          error: 'Location services disabled',
          showEnableLocationPrompt: true,
          loading: false,
        }));
        return;
      }

      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocation(prev => ({
          ...prev,
          address: 'Location permission required',
          coords: null,
          error: 'Location permission required',
          showPermissionPrompt: true,
          loading: false,
        }));
        return;
      }

      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: Platform.OS === 'ios',
            timeout: Platform.OS === 'ios' ? 15000 : 30000,
            maximumAge: 10000,
            distanceFilter: 50,
          }
        );
      });

      const { latitude, longitude } = position.coords;
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
        
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.ADDRESS_ID,
          STORAGE_KEYS.STREET_ADDRESS,
          STORAGE_KEYS.HOME_TYPE,
          STORAGE_KEYS.LATITUDE,
          STORAGE_KEYS.LONGITUDE,
        ]);
      } else if (error.message?.includes('disabled')) {
        errorMessage = 'Location services disabled';
        promptForEnable = true;
      }
      
      setLocation(prev => ({
        ...prev,
        address: errorMessage,
        coords: null,
        error: errorMessage,
        showEnableLocationPrompt: promptForEnable,
        showPermissionPrompt: promptForPermission,
        loading: false,
      }));
    }
  }, [checkLocationEnabled, requestLocationPermission, checkLocationInDatabase, getSavedAddressDetails, onAddressUpdate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        getCurrentLocation();
      }
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, [appState, getCurrentLocation]);

  useFocusEffect(
    useCallback(() => {
      getCurrentLocation();
    }, [getCurrentLocation])
  );

  const showLocationSettingsAlert = useCallback(() => {
    Alert.alert(
      'Location Services Required',
      'To find restaurants near you, please enable location services',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => setLocation(prev => ({ ...prev, showEnableLocationPrompt: false }))
        },
        {
          text: 'Open Settings',
          onPress: async () => {
            setLocation(prev => ({ ...prev, showEnableLocationPrompt: false }));
            await Linking.openSettings();
          },
        },
      ]
    );
  }, []);

  const showPermissionAlert = useCallback(() => {
    Alert.alert(
      'Location Permission Required',
      'This app needs access to your location to show nearby restaurants',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setLocation(prev => ({ ...prev, showPermissionPrompt: false }))
        },
        {
          text: 'Allow',
          onPress: async () => {
            setLocation(prev => ({ ...prev, showPermissionPrompt: false }));
            const granted = await requestLocationPermission();
            if (granted) {
              getCurrentLocation();
            } else {
              Alert.alert(
                'Permission Denied',
                'To enable location, please grant permission in app settings',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => Linking.openSettings() },
                ]
              );
            }
          },
        },
      ]
    );
  }, [getCurrentLocation, requestLocationPermission]);

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
      onAddressSelect: (selectedAddressObj: any) => {
        const raw = selectedAddressObj.rawAddress;
        if (raw.full_address && raw.latitude && raw.longitude) {
          saveAddressDetails({
            id: String(raw.id),
            full_address: raw.full_address,
            home_type: raw.home_type || 'Home',
            latitude: raw.latitude,
            longitude: raw.longitude,
          });
          setLocation(prev => ({
            ...prev,
            address: raw.full_address,
            coords: {
              lat: parseFloat(raw.latitude),
              lng: parseFloat(raw.longitude),
            },
            homeType: raw.home_type || 'Home',
            addressId: String(raw.id),
            loading: false,
            error: null,
          }));
          if (onAddressUpdate) {
            onAddressUpdate(raw.full_address, raw.home_type || 'Home');
          }
        }
      }
    });
  }, [navigation, location.coords, location.address, saveAddressDetails, onAddressUpdate]);

  const displayAddress = location.loading 
    ? 'Fetching location...' 
    : location.error || truncateAddress(location.address, 4);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handleAddressPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.premiumAddressContainer}
      >
        <View>
          <View>
            <View style={styles.premiumAddressHomeTypeRow}>
              <Text style={styles.premiumAddressHomeTypeLabel} numberOfLines={1}>
                {location.loading ? 'Fetching...' : location.homeType}
              </Text>
              <Icon name="chevron-down" size={scale(12)} color="#FFFFFF" />
            </View>
            <Text style={styles.premiumAddressMainLabel} numberOfLines={1}>
              {displayAddress}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Premium Search Bar Component - iOS Optimized
const PremiumSearchBar: React.FC<SearchInputProps> = React.memo(({ onPress, placeholder }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        damping: 15,
      }),
      Animated.spring(translateYAnim, {
        toValue: -2,
        useNativeDriver: true,
        damping: 15,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
      }),
    ]).start();
  };

  // iOS specific styles
  const iosStyles = Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },
    android: {}
  });

  return (
    <Animated.View style={{
      transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
      width: '100%',
    }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
        style={[styles.premiumSearchContainer, iosStyles]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFillObject}
            blurType="light"
            blurAmount={20}
            reducedTransparencyFallbackColor="rgba(255,255,255,0.3)"
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
        )}
        <View style={styles.premiumSearchContent}>
          <View style={styles.premiumSearchIconWrapper}>
            <Icon name="search" size={scale(18)} color="#FFFFFF" />
          </View>
          <Text style={styles.premiumSearchPlaceholder} numberOfLines={1}>
            {placeholder}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// Premium Category Card Component
const PremiumCategoryCard = ({ 
  category, 
  isActive, 
  onPress,
  index 
}: { 
  category: Category; 
  isActive: boolean; 
  onPress: () => void;
  index: number;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.timing(translateYAnim, {
      toValue: 0,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [index, translateYAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  return (
    <Animated.View style={{
      transform: [{ scale: scaleAnim }, { translateY: translateYAnim }],
      opacity: translateYAnim.interpolate({
        inputRange: [0, 20],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={[
          styles.premiumCategoryCard,
          isActive && styles.premiumCategoryCardActive
        ]}
      >
        <View style={[
          styles.premiumCategoryIconContainer,
          isActive && styles.premiumCategoryIconContainerActive
        ]}>
          <Image 
            source={{ uri: category.icon || DEFAULT_CATEGORY_ICON }} 
            style={styles.premiumCategoryIcon}
            resizeMode="cover"
            defaultSource={{ uri: DEFAULT_CATEGORY_ICON }}
          />
        </View>
        <Text style={[
          styles.premiumCategoryText,
          isActive && styles.premiumCategoryTextActive
        ]} numberOfLines={1}>
          {category.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Sticky Categories Header Component
const StickyCategoriesHeader = React.memo(({ 
  categories, 
  activeCategory, 
  onCategoryPress,
  visible 
}: { 
  categories: Category[];
  activeCategory: number | null;
  onCategoryPress: (id: number, name: string) => void;
  visible: boolean;
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -100,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.stickyCategoriesContainer,
      {
        transform: [{ translateY }],
      }
    ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          style={StyleSheet.absoluteFillObject}
          blurType="light"
          blurAmount={20}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#FFFFFF' }]} />
      )}
      <View style={styles.stickyCategoriesContent}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stickyCategoriesScrollContent}
        >
          {categories.map((category, index) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.stickyCategoryItem,
                activeCategory === index && styles.stickyCategoryItemActive
              ]}
              onPress={() => onCategoryPress(category.id, category.name)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.stickyCategoryIconWrapper,
                activeCategory === index && styles.stickyCategoryIconWrapperActive
              ]}>
                <Image 
                  source={{ uri: category.icon || DEFAULT_CATEGORY_ICON }} 
                  style={styles.stickyCategoryIcon}
                  resizeMode="cover"
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
    </Animated.View>
  );
});

// Premium Restaurant Card Component
const PremiumRestaurantCard = ({ 
  kitchen, 
  onPress, 
  onToggleFavorite, 
  favoriteLoading,
  isGuest,
  isTopRestaurant = false
}: { 
  kitchen: Kitchen; 
  onPress: (kitchen: Kitchen) => void; 
  onToggleFavorite: (kitchenId: string) => void; 
  favoriteLoading: string | null;
  isGuest: boolean;
  isTopRestaurant?: boolean;
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const imageScaleAnim = useRef(new Animated.Value(1)).current;
  const favoriteAnim = useRef(new Animated.Value(kitchen.is_favourite ? 1 : 0)).current;
  
  const rating = kitchen.rating || (Math.random() * 1 + 4.2).toFixed(1);
  const deliveryTime = kitchen.delivery_time?.replace('min', '').trim() || '25-35';
  const discount = kitchen.discount || Math.floor(Math.random() * 30) + 20;

  useEffect(() => {
    Animated.spring(favoriteAnim, {
      toValue: kitchen.is_favourite ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
    }).start();
  }, [kitchen.is_favourite, favoriteAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      damping: 15,
    }).start();
    Animated.spring(imageScaleAnim, {
      toValue: 1.05,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
    Animated.spring(imageScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  };

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    if (isGuest) {
      Alert.alert('Login Required', 'Please login to add favorites');
      return;
    }
    onToggleFavorite(kitchen.restaurant_id);
  };

  const handleImageError = () => {
    setHasImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setHasImageError(false);
  };

  const imageSource = hasImageError 
    ? { uri: DEFAULT_RESTAURANT_IMAGE }
    : { uri: kitchen.restaurant_image || DEFAULT_RESTAURANT_IMAGE };

  const cardWidth = isTopRestaurant 
    ? (screenWidth - scale(48)) / 3.2
    : (screenWidth - scale(48)) / 2;

  return (
    <Animated.View style={{
      transform: [{ scale: scaleAnim }],
      width: cardWidth,
    }}>
      <TouchableOpacity
        onPress={() => onPress(kitchen)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.95}
        style={[
          styles.premiumRestaurantCard,
          isTopRestaurant && styles.premiumTopRestaurantCard
        ]}
      >
        <View style={styles.premiumRestaurantImageContainer}>
          <Animated.Image
            source={imageSource}
            style={[
              styles.premiumRestaurantImage,
              { transform: [{ scale: imageScaleAnim }] }
            ]}
            resizeMode="cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
            defaultSource={{ uri: DEFAULT_RESTAURANT_IMAGE }}
          />
          
          {!imageLoaded && !hasImageError && (
            <View style={styles.premiumRestaurantImagePlaceholder}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          )}

          <View style={styles.premiumRestaurantImageGradient} />

          <TouchableOpacity 
            style={[
              styles.premiumRestaurantFavorite,
              isTopRestaurant && styles.premiumTopRestaurantFavorite
            ]}
            onPress={handleFavoritePress}
            disabled={favoriteLoading === kitchen.restaurant_id}
          >
            <Animated.View style={{
              transform: [{
                scale: favoriteAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2],
                  extrapolate: 'clamp',
                })
              }]
            }}>
              <Icon 
                name={kitchen.is_favourite ? "heart" : "heart-outline"} 
                size={isTopRestaurant ? scale(16) : scale(20)} 
                color={kitchen.is_favourite ? COLORS.primary : "#FFFFFF"} 
              />
            </Animated.View>
          </TouchableOpacity>

          {kitchen.is_new && (
            <View style={styles.premiumRestaurantNewBadge}>
              <Text style={styles.premiumRestaurantNewBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        <View style={[
          styles.premiumRestaurantInfo,
          isTopRestaurant && styles.premiumTopRestaurantInfo
        ]}>
          <Text style={[
            styles.premiumRestaurantName,
            isTopRestaurant && styles.premiumTopRestaurantName
          ]} numberOfLines={1}>
            {kitchen.restaurant_name}
          </Text>
          
          <View style={styles.premiumRestaurantMeta}>
            <View style={styles.premiumRestaurantCuisine}>
              <Text style={[
                styles.premiumRestaurantCuisineText,
                isTopRestaurant && styles.premiumTopRestaurantCuisineText
              ]} numberOfLines={1}>
                {kitchen.item_cuisines?.split(', ').slice(0, 1).join(' ') || 'Various'}
              </Text>
            </View>
            <View style={styles.premiumRestaurantDelivery}>
              <Icon2 name="clock-outline" size={isTopRestaurant ? scale(10) : scale(12)} color={COLORS.text.secondary} />
              <Text style={[
                styles.premiumRestaurantDeliveryText,
                isTopRestaurant && styles.premiumTopRestaurantDeliveryText
              ]}>{deliveryTime} min</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Premium Active Order Card Component
const PremiumActiveOrderCard = ({ 
  order, 
  onPress 
}: { 
  order: ActiveOrder; 
  onPress: (order: ActiveOrder) => void;
}) => {
  const statusColors = {
    'pending': '#FDCB6E',
    'confirmed': '#00B894',
    'preparing': '#6C5CE7',
    'on-the-way': '#0984E3',
    'delivered': '#00B894',
    'cancelled': '#FF7675',
  };

  return (
    <TouchableOpacity
      onPress={() => onPress(order)}
      activeOpacity={0.95}
      style={styles.premiumActiveOrderCard}
    >
      <View style={styles.premiumActiveOrderContent}>
        <Image 
          source={{ 
            uri: order.kitchenImage || DEFAULT_CATEGORY_ICON 
          }} 
          style={styles.premiumActiveOrderImage}
          defaultSource={{ uri: DEFAULT_CATEGORY_ICON }}
        />
        
        <View style={styles.premiumActiveOrderDetails}>
          <View style={styles.premiumActiveOrderHeader}>
            <Text style={styles.premiumActiveOrderKitchen} numberOfLines={1}>
              {order.kitchenName}
            </Text>
            <View style={[
              styles.premiumActiveOrderStatusBadge,
              { backgroundColor: `${statusColors[order.status]}20` }
            ]}>
              <View style={[
                styles.premiumActiveOrderStatusDot,
                { backgroundColor: statusColors[order.status] }
              ]} />
              <Text style={[
                styles.premiumActiveOrderStatusText,
                { color: statusColors[order.status] }
              ]}>
                {order.statusText}
              </Text>
            </View>
          </View>

          <Text style={styles.premiumActiveOrderNumber}>
            Order #{order.orderNumber}
          </Text>

          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <View style={styles.premiumActiveOrderTimeContainer}>
              <Icon2 name="timer-sand" size={scale(14)} color={COLORS.primary} />
              <Text style={styles.premiumActiveOrderTime}>
                {order.estimatedArrival} • {order.placedOn}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.premiumActiveOrderArrow}>
          <Icon name="chevron-forward" size={scale(20)} color={COLORS.text.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// UPDATED: Premium Cart Summary Component - No LinearGradient, iOS optimized
const PremiumCartSummary = ({ 
  pastKitchenDetails, 
  onViewCart, 
  onBackToKitchen 
}: { 
  pastKitchenDetails: PastKitchenDetails; 
  onViewCart: () => void; 
  onBackToKitchen: () => void;
}) => {
  const slideAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
      }),
    ]).start();
  }, [slideAnim, scaleAnim]);

  return (
    <Animated.View style={[
      styles.premiumCartSummary,
      {
        transform: [
          { translateY: slideAnim },
          { scale: scaleAnim }
        ]
      }
    ]}>
      <View style={styles.premiumCartSummaryContent}>
        <View style={styles.premiumCartSummaryInfo}>
          <Image 
            source={{ 
              uri: pastKitchenDetails.image || DEFAULT_RESTAURANT_IMAGE 
            }} 
            style={styles.premiumCartSummaryImage}
            defaultSource={{ uri: DEFAULT_RESTAURANT_IMAGE }}
          />
          <View style={styles.premiumCartSummaryText}>
            <Text style={styles.premiumCartSummaryTitle} numberOfLines={1}>
              {pastKitchenDetails.name}
            </Text>
            <TouchableOpacity onPress={onBackToKitchen}>
              <Text style={styles.premiumCartSummarySubtitle}>Add more items</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.premiumCartSummaryButton}
          onPress={onViewCart}
          activeOpacity={0.9}
        >
          <View style={styles.premiumCartSummaryButtonContent}>
            <Text style={styles.premiumCartSummaryButtonText}>View Cart</Text>
            <View style={styles.premiumCartBadge}>
              <Text style={styles.premiumCartBadgeText}>
                {pastKitchenDetails.itemCount}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ============== MAIN KITCHEN SCREEN ==============

const KitchenScreenTabs: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isGuest, userToken } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  
  // ============== STATE HOOKS ==============
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
  const [homeType, setHomeType] = useState<string>('Home');
  const [address, setAddress] = useState<string>('Fetching location...');
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [headerLoader, setHeaderLoader] = useState(true);
  const [showStickyCategories, setShowStickyCategories] = useState(false);
  const [headerOffers, setHeaderOffers] = useState<OfferCard[]>([]);

  // ============== REF HOOKS ==============
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const placeholderInterval = useRef<NodeJS.Timeout>();

  // ============== ANIMATION INTERPOLATIONS ==============
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.6],
    outputRange: [0, -HEADER_HEIGHT * 0.5],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.4],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const categoriesTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.3],
    outputRange: [0, -40],
    extrapolate: 'clamp',
  });

  const categoriesOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT * 0.3],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  // ============== HEADER VISIBILITY ==============
  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      setIsHeaderVisible(value < HEADER_HEIGHT * 0.5);
      setShowStickyCategories(value > HEADER_HEIGHT * 0.4);
    });
    return () => scrollY.removeListener(listenerId);
  }, [scrollY]);

  // ============== PLACEHOLDER ANIMATION ==============
  useEffect(() => {
    placeholderInterval.current = setInterval(() => {
      setCurrentPlaceholderIndex(prev => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3000);
    return () => {
      if (placeholderInterval.current) {
        clearInterval(placeholderInterval.current);
      }
    };
  }, []);

  // ============== LOAD HEADER OFFERS ==============
  const loadHeaderOffers = useCallback(async () => {
    try {
      const storedOffers = await AsyncStorage.getItem(STORAGE_KEYS.HEADER_OFFERS);
      if (storedOffers) {
        setHeaderOffers(JSON.parse(storedOffers));
      } else {
        // Filter active offers and take first 2
        const activeOffers = HEADER_OFFERS.filter(offer => offer.isActive).slice(0, 2);
        setHeaderOffers(activeOffers);
        await AsyncStorage.setItem(STORAGE_KEYS.HEADER_OFFERS, JSON.stringify(activeOffers));
      }
    } catch (error) {
      console.error('Error loading header offers:', error);
      setHeaderOffers(HEADER_OFFERS.filter(offer => offer.isActive).slice(0, 2));
    }
  }, []);

  // ============== API FUNCTIONS ==============
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

  const fetchKitchens = useCallback(async () => {
    try {
      const response = await getKitchenList();
      
      if (response.data?.success) {
        const processedData = {
          ...response.data,
          data: {
            ...response.data.data,
            FeatureKitchenList: (response.data.data.FeatureKitchenList || []).map((k: any) => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false,
              rating: (Math.random() * 1 + 4.2).toFixed(1),
              delivery_time: `${Math.floor(Math.random() * 15) + 25}-${Math.floor(Math.random() * 20) + 40} min`,
              discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 20 : 0,
              is_new: Math.random() > 0.8,
              is_trending: Math.random() > 0.9,
              distance: `${(Math.random() * 5 + 0.5).toFixed(1)} km`,
            })),
            KitchenList: (response.data.data.KitchenList || []).map((k: any) => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false,
              rating: (Math.random() * 1 + 4).toFixed(1),
              delivery_time: `${Math.floor(Math.random() * 15) + 25}-${Math.floor(Math.random() * 20) + 40} min`,
              discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 20 : 0,
              is_new: Math.random() > 0.8,
              is_trending: Math.random() > 0.9,
              distance: `${(Math.random() * 5 + 0.5).toFixed(1)} km`,
            })),
            CategoryList: (response.data.data.CategoryList || []).map((c: any) => ({
              ...c,
              icon: c.icon || DEFAULT_CATEGORY_ICON
            })),
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
        setTimeout(() => setHeaderLoader(false), 1000);
      }
    } catch (error) {
      console.error('Error fetching kitchens:', error);
    }
  }, []);

  const fetchActiveOrders = useCallback(async (userId: string) => {
    try {
      setOrdersLoading(true);
      const payload = { user_id: userId };
      const response = await getActiveOrders(payload);

      if (response?.status === 200) {
        const formattedOrders: ActiveOrder[] = (response.data.orders || [])
          .map((order: any) => {
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
          .filter((order: ActiveOrder) => order.status !== 'delivered');

        formattedOrders.sort((a: ActiveOrder, b: ActiveOrder) => {
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
      const storedDetails = await AsyncStorage.getItem(STORAGE_KEYS.PAST_KITCHEN_DETAILS);

      if (storedDetails) {
        setPastKitchenDetails(JSON.parse(storedDetails));
        return;
      }

      const session = await getSessionId();
      const payload = { 
        session_id: userId ? null : session, 
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
        }
      } else {
        setPastKitchenDetails(null);
      }
    } catch (error) {
      console.error('Error fetching past kitchen details:', error);
    }
  }, [savePastKitchenDetails]);

  const updateCartItemUser = useCallback(async (userId: string) => {
    try {
      const payload = { 
        user_id: userId,
        session_id: sessionId, 
        cart_status: 2, 
        restaurant_id: pastKitchenDetails?.id, 
      };
      await updateCartUserDetails(payload);
    } catch (error) {
      console.error('Error updating cart user details:', error);
    }
  }, [sessionId, pastKitchenDetails?.id]);

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

  const initializeSession = useCallback(async () => {
    try {
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
  }, []);

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
        
        response.data.menus?.forEach((menu: any) => {
          menu.items?.forEach((item: any) => {
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
        
        response.data.restaurants?.forEach((restaurant: any) => {
          const cuisineNames = restaurant.cuisines
            ?.filter((cuisine: any) => cuisine.cuisine_name)
            .map((cuisine: any) => cuisine.cuisine_name)
            .join(', ') || 'Various cuisines';
            
          transformedResults.push({
            id: `restaurant-${restaurant.restaurant_id}`,
            name: restaurant.restaurant_name,
            image: restaurant.profile_image,
            type: 'restaurant',
            category: cuisineNames,
            originalData: restaurant,
            rating: restaurant.rating || (Math.random() * 2 + 3).toFixed(1),
            deliveryTime: restaurant.delivery_time || `${Math.floor(Math.random() * 20) + 15}-${Math.floor(Math.random() * 20) + 35} min`,
            distance: restaurant.distance || `${(Math.random() * 5).toFixed(1)} km`
          });
        });

        if (response.data.trending_items) {
          response.data.trending_items.forEach((item: any) => {
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
      }
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const toggleFavorite = useCallback(async (kitchenId: string) => {
    if (favoriteLoading) return;

    if (isGuest) {
      Alert.alert('Login Required', 'Please login to add favorites');
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
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setFavoriteLoading(null);
    }
  }, [favoriteLoading, isGuest]);

  // ============== HANDLERS ==============
  const handleAddressUpdate = useCallback((newAddress: string, newHomeType: string) => {
    setAddress(newAddress);
    setHomeType(newHomeType);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    setShowRefreshSuccess(false);
    
    try {
      const minDelay = new Promise(resolve => setTimeout(resolve, 1000));
      const userData = await fetchUserData();
      
      await Promise.all([
        fetchKitchens(),
        loadHeaderOffers(),
        userData ? fetchActiveOrders(userData.id) : Promise.resolve(null),
        userData ? fetchPastKitchenDetails(userData.id) : fetchPastKitchenDetails(null),
        fetchRecentSearches(),
      ]);

      await minDelay;
      setShowRefreshSuccess(true);
      setTimeout(() => setShowRefreshSuccess(false), 2000);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fetchKitchens, loadHeaderOffers, fetchActiveOrders, fetchPastKitchenDetails, fetchUserData, fetchRecentSearches]);

  const handleCategoryPress = useCallback((categoryId: number, categoryName: string) => {
    const categoryIndex = apiData?.data.CategoryList.findIndex(cat => cat.id === categoryId) ?? -1;
    setActiveCategory(categoryIndex === activeCategory ? null : categoryIndex);
    setIsSearchModalVisible(true);
    setSearchQuery(categoryName);
  }, [activeCategory, apiData]);

  const handleOrderPress = useCallback((order: ActiveOrder) => {
    navigation.navigate('TrackOrder', { order: { order_number: order.orderNumber } });
  }, [navigation]);

  const handleViewCart = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('CartScreen', { pastkitcheId: pastKitchenDetails.id });
    }
  }, [navigation, pastKitchenDetails]);

  const handleBackToKitchen = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('HomeKitchenDetails', { kitchenId: pastKitchenDetails.id });
    }
  }, [navigation, pastKitchenDetails]);

  const handleSearchPress = useCallback(() => {
    setIsSearchModalVisible(true);
  }, []);

  const handleSearchClose = useCallback(() => {
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
      await saveToRecentSearches(searchQuery);
      handleSearchClose();
      navigation.navigate('HomeKitchenNavigate', { 
        screen: 'SearchResults', 
        params: { 
          query: searchQuery,
          suggestionsData: searchSuggestionsData
        } 
      });
    }
  }, [searchQuery, navigation, handleSearchClose, saveToRecentSearches, searchSuggestionsData]);

  const handleRecentSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    setTimeout(() => handleSearchSubmit(), 100);
  }, [handleSearchSubmit]);

  const handleSearchResultPress = useCallback((item: SearchItem) => {
    saveToRecentSearches(item.name, item);
    handleSearchClose();
    
    if (item.type === 'restaurant') {
      navigation.navigate('HomeKitchenDetails', { 
        kitchenId: (item.originalData as SearchRestaurant)?.restaurant_id || item.id.replace('restaurant-', '')
      });
    } else {
      navigation.navigate('HomeKitchenNavigate', { 
        screen: 'SearchResults', 
        params: { 
          query: item.name,
          itemId: item.id.replace('menu-', ''),
          suggestionsData: searchSuggestionsData
        } 
      });
    }
  }, [handleSearchClose, navigation, saveToRecentSearches, searchSuggestionsData]);

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    setSearchHistory([]);
    await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
    await AsyncStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
  }, []);

  const handleRemoveRecentSearch = useCallback((query: string) => {
    setRecentSearches(prev => prev.filter(item => item !== query));
  }, []);

  const toggleShowAllActiveOrders = useCallback(() => {
    setShowAllActiveOrders(prev => !prev);
  }, []);

  // ============== EFFECTS ==============
  useEffect(() => {
    const init = async () => {
      const session = await initializeSession();
      const userData = await fetchUserData();
      await fetchKitchens();
      await fetchRecentSearches();
      await loadHeaderOffers();

      if (userData) {
        await Promise.all([
          fetchActiveOrders(userData.id),
          fetchPastKitchenDetails(userData.id)
        ]);
      } else {
        await fetchPastKitchenDetails(null);
      }

      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (user?.id && sessionId && pastKitchenDetails?.id) {
      updateCartItemUser(user.id);
    }
  }, [user?.id, sessionId, pastKitchenDetails?.id, updateCartItemUser]);

  // ============== COMPUTED VALUES ==============
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const displayedActiveOrders = showAllActiveOrders ? activeOrders : activeOrders.slice(0, 1);

  // ============== SEARCH EFFECT ==============
  useEffect(() => {
    if (debouncedSearchQuery && isSearchModalVisible) {
      fetchSearchSuggestions(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0 && isSearchModalVisible) {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, isSearchModalVisible, fetchSearchSuggestions]);

  // ============== LOADING STATES ==============
  if (loading) {
    return (
      <View style={styles.premiumLoadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={[StyleSheet.absoluteFillObject, styles.premiumLoadingGradient]} />
        <View style={styles.premiumLoadingContent}>
          {/* FIXED: Replaced Animatable.View with custom Animated component */}
          {/* <AnimatedLoadingIcon name="food-variant" size={scale(80)} color="#FFF" /> */}
          <Text style={styles.premiumLoadingTitle}>Eatoor</Text>
          <Text style={styles.premiumLoadingText}>Discover amazing food...</Text>
          <ActivityIndicator size="large" color="#FFF" style={styles.premiumLoadingSpinner} />
        </View>
      </View>
    );
  }

  if (!apiData) {
    return (
      <View style={styles.premiumErrorContainer}>
        <View style={[StyleSheet.absoluteFillObject, styles.premiumErrorGradient]} />
        <Icon2 name="food-off" size={scale(80)} color={COLORS.text.tertiary} />
        <Text style={styles.premiumErrorTitle}>Oops! Something went wrong</Text>
        <Text style={styles.premiumErrorText}>Unable to load restaurants</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            initializeSession().then(() => {
              fetchUserData();
              fetchKitchens();
              setLoading(false);
            });
          }}
          style={styles.premiumErrorButton}
          activeOpacity={0.9}
        >
          <View style={styles.premiumErrorButtonContent}>
            <Text style={styles.premiumErrorButtonText}>Try Again</Text>
            <Icon name="refresh" size={scale(20)} color="#FFF" />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ============== MAIN RENDER ==============
  return (
    <View style={styles.premiumContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Search Modal */}
      <SearchModal
        isVisible={isSearchModalVisible}
        onClose={handleSearchClose}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchInputRef={searchInputRef}
        onSearchSubmit={handleSearchSubmit}
        recentSearches={recentSearches}
        searchHistory={searchHistory}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onRecentSearchPress={handleRecentSearchPress}
        onPopularSearchPress={handleRecentSearchPress}
        onSearchResultPress={handleSearchResultPress}
        onClearRecentSearches={clearRecentSearches}
        onRemoveRecentSearch={handleRemoveRecentSearch}
        tabBarHeight={scale(70)}
      />

      {/* Sticky Categories Header - Appears when scrolling */}
      {apiData.data.CategoryList.length > 0 && (
        <StickyCategoriesHeader
          categories={apiData.data.CategoryList}
          activeCategory={activeCategory}
          onCategoryPress={handleCategoryPress}
          visible={showStickyCategories}
        />
      )}

      {/* Premium Header with Parallax - INCREASED HEIGHT and BOTTOM RADIUS */}
      <Animated.View style={[
        styles.premiumHeader,
        {
          height: HEADER_HEIGHT,
          transform: [
            { translateY: headerTranslateY },
            { scale: headerScale }
          ],
          opacity: headerOpacity,
        }
      ]}>
        <PremiumBannerComponent
          banner={apiData?.data?.final_banner_image || null}
          isVisible={isHeaderVisible}
        />

        {/* Header Bottom Radius Overlay */}
        <View style={styles.premiumHeaderBottomRadius} />

        {/* Header Content */}
        <View style={[
          styles.premiumHeaderContent, 
          { 
            paddingTop: insets.top + verticalScale(16),
            paddingBottom: verticalScale(20)
          }
        ]}>
          {/* Location and Profile Section */}
          <View style={styles.premiumHeaderTop}>
            <PremiumAddressHeader isGuest={isGuest} onAddressUpdate={handleAddressUpdate} />
            
            <View style={styles.premiumHeaderActions}>
              <TouchableOpacity 
                style={styles.premiumHeaderAction}
                onPress={() => isGuest ? navigation.navigate('LoginScreen') : navigation.navigate('FavoritesScreen')}
              >
                <View style={styles.premiumHeaderActionGradient}>
                  <Icon name="heart-outline" size={scale(20)} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.premiumHeaderAction}
                onPress={() => isGuest ? navigation.navigate('LoginScreen') : navigation.navigate('EatoorMoneyScreen')}
              >
                <View style={styles.premiumHeaderActionGradient}>
                  <Icon name="wallet-outline" size={scale(20)} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.premiumHeaderAction}
                onPress={() => isGuest ? navigation.navigate('LoginScreen') : navigation.navigate('ProfileScreen')}
              >
                <View style={styles.premiumHeaderActionGradient}>
                  <Icon name="person-outline" size={scale(20)} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.premiumSearchWrapper}>
            <PremiumSearchBar
              onPress={handleSearchPress}
              placeholder={SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
            />
          </View>
        </View>

        {/* Dynamic Header Offer Cards from JSON - Transparent Background */}
        {headerOffers.length > 0 && <PremiumHeaderOfferCards />}
      </Animated.View>

      {/* Main Content */}
      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.premiumScrollView}
        contentContainerStyle={[
          styles.premiumScrollContent,
          { 
            paddingTop: HEADER_HEIGHT + verticalScale(8),
            paddingBottom: verticalScale(120)
          }
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            progressViewOffset={HEADER_HEIGHT}
          />
        }
      >
        {/* Categories Section */}
        {apiData.data.CategoryList.length > 0 && (
          <Animated.View style={[
            styles.premiumCategoriesContainer,
            {
              opacity: categoriesOpacity,
              transform: [{ translateY: categoriesTranslateY }]
            }
          ]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.premiumCategoriesContent}
            >
              {apiData.data.CategoryList.map((category, index) => (
                <PremiumCategoryCard
                  key={category.id}
                  category={category}
                  isActive={activeCategory === index}
                  onPress={() => handleCategoryPress(category.id, category.name)}
                  index={index}
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Top Restaurants Section */}
        {apiData.data.FeatureKitchenList?.length > 0 && (
          <View style={styles.premiumSection}>
            <View style={styles.premiumSectionHeader}>
              <View>
                <Text style={styles.premiumSectionTitle}>Top Rated</Text>
                <Text style={styles.premiumSectionSubtitle}>
                  Most loved restaurants near you
                </Text>
              </View>
            </View>
            
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.premiumTopRestaurantsContent}
              decelerationRate="fast"
              snapToInterval={screenWidth * 0.3 + scale(10)}
              snapToAlignment="start"
            >
              {apiData.data.FeatureKitchenList.slice(0, 10).map((kitchen, index) => (
                <PremiumRestaurantCard
                  key={kitchen.restaurant_id}
                  kitchen={kitchen}
                  onPress={(k) => navigation.navigate('HomeKitchenDetails', { kitchenId: k.restaurant_id })}
                  onToggleFavorite={toggleFavorite}
                  favoriteLoading={favoriteLoading}
                  isGuest={isGuest}
                  isTopRestaurant={true}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* All Restaurants Section */}
        <View style={styles.premiumSection}>
          <View style={styles.premiumSectionHeader}>
            <View>
              <Text style={styles.premiumSectionTitle}>All Restaurants</Text>
              <Text style={styles.premiumSectionSubtitle}>
                {apiData.data.KitchenList.length}+ places to explore
              </Text>
            </View>
          </View>

          <View style={styles.premiumRestaurantGrid}>
            {apiData.data.KitchenList.map((kitchen) => (
              <PremiumRestaurantCard
                key={kitchen.restaurant_id}
                kitchen={kitchen}
                onPress={(k) => navigation.navigate('HomeKitchenDetails', { kitchenId: k.restaurant_id })}
                onToggleFavorite={toggleFavorite}
                favoriteLoading={favoriteLoading}
                isGuest={isGuest}
                isTopRestaurant={false}
              />
            ))}
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: verticalScale(20) }} />
      </Animated.ScrollView>

      {/* Active Orders */}
      {activeOrders.length > 0 && !ordersLoading && (
        <View style={[
          styles.premiumActiveOrdersContainer,
          { 
            bottom: pastKitchenDetails 
              ? verticalScale(100) 
              : Platform.OS === 'ios' 
                ? verticalScale(20) 
                : verticalScale(16) 
          }
        ]}>
          <View style={styles.premiumActiveOrdersHeader}>
            <View style={styles.premiumActiveOrdersTitleContainer}>
              <Icon2 name="clock-outline" size={scale(18)} color={COLORS.primary} />
              <Text style={styles.premiumActiveOrdersTitle}>
                Active Orders ({activeOrders.length})
              </Text>
            </View>
            {activeOrders.length > 1 && (
              <TouchableOpacity onPress={toggleShowAllActiveOrders}>
                <Text style={styles.premiumActiveOrdersToggle}>
                  {showAllActiveOrders ? 'Show less' : 'See all'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.premiumActiveOrdersList}>
            {displayedActiveOrders.map((order) => (
              <PremiumActiveOrderCard
                key={order.id}
                order={order}
                onPress={handleOrderPress}
              />
            ))}
          </View>
        </View>
      )}

      {/* Cart Summary */}
      {pastKitchenDetails && activeOrders.length === 0 && (
        <PremiumCartSummary
          pastKitchenDetails={pastKitchenDetails}
          onViewCart={handleViewCart}
          onBackToKitchen={handleBackToKitchen}
        />
      )}
    </View>
  );
};

// ============== NAVIGATORS ==============

const KitchenTabNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="KitchenHome" component={KitchenScreenTabs} />
    </Stack.Navigator>
  );
};

const HomeTabsNavigator = React.memo(({ isGuest }: { isGuest: boolean }) => {
  const [isRestaurantRegister, setIsRestaurantRegister] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const value = await AsyncStorage.getItem(STORAGE_KEYS.IS_RESTAURANT_REGISTER);
        setIsRestaurantRegister(value === 'true');
      } catch (error) {
        console.error('Error loading restaurant register status:', error);
      }
    };
    loadStatus();
  }, []);

  const tabBarHeight = useMemo(() => 
    Platform.OS === 'ios' ? verticalScale(90) : verticalScale(80), 
  []);

  const tabIcons = {
    Kitchen: { focused: 'restaurant', unfocused: 'restaurant-outline' },
    Eatmart: { focused: 'basket', unfocused: 'basket-outline' },
    Reorder: { focused: 'repeat', unfocused: 'repeat-outline' },
    Partner: { focused: 'people', unfocused: 'people-outline' },
  };

  // FIXED: Platform specific tab bar positioning
  const tabBarPosition = Platform.select({
    ios: {
      bottom: 0,
    },
    android: {
      bottom: 0,
    },
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const routeName = route.name as AppTabs;
          const iconName = focused 
            ? tabIcons[routeName]?.focused 
            : tabIcons[routeName]?.unfocused;
          
          return (
            <View style={styles.premiumTabIconContainer}>
              <Icon 
                name={iconName || 'restaurant-outline'} 
                size={focused ? scale(24) : scale(22)} 
                color={focused ? COLORS.primary : color} 
              />
              {focused && (
                <View style={styles.premiumTabIndicator} />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text.tertiary,
        tabBarStyle: [
          styles.premiumTabBar,
          {
            height: tabBarHeight,
            paddingBottom: insets.bottom || verticalScale(8),
            ...tabBarPosition,
          }
        ],
        tabBarLabelStyle: styles.premiumTabLabel,
        headerShown: false,
        tabBarShowLabel: true,
      })}
    >
      <Tab.Screen name="Kitchen" component={KitchenTabNavigator} />
      <Tab.Screen name="Eatmart" component={EatmartScreen} />
      {!isGuest && <Tab.Screen name="Reorder" component={ReorderScreen} />}
      {isRestaurantRegister && <Tab.Screen name="Partner" component={PartnerScreen} />}
    </Tab.Navigator>
  );
});

// ============== MAIN EXPORT ==============

const HomeTabs = () => {
  const { isGuest } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true}
      />
      <View style={[styles.premiumRootContainer, { paddingBottom: 0 }]}>
        <HomeTabsNavigator isGuest={isGuest} />
      </View>
    </>
  );
};

// ============== UPDATED STYLES ==============

const styles = StyleSheet.create({
  // Root Container
  premiumRootContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  premiumContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Loading States
  premiumLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  premiumLoadingGradient: {
    backgroundColor: COLORS.primary,
  },
  premiumLoadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumLoadingTitle: {
    ...TYPOGRAPHY.h1,
    color: '#FFFFFF',
    marginTop: verticalScale(20),
    fontWeight: '700',
  },
  premiumLoadingText: {
    ...TYPOGRAPHY.body1,
    color: 'rgba(255,255,255,0.9)',
    marginTop: verticalScale(8),
  },
  premiumLoadingSpinner: {
    marginTop: verticalScale(30),
  },

  // Error States
  premiumErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    backgroundColor: '#F8FAFC',
  },
  premiumErrorGradient: {
    backgroundColor: '#F8FAFC',
  },
  premiumErrorTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginTop: verticalScale(20),
  },
  premiumErrorText: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text.secondary,
    marginTop: verticalScale(8),
  },
  premiumErrorButton: {
    marginTop: verticalScale(30),
    borderRadius: scale(30),
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  premiumErrorButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(14),
    gap: scale(8),
  },
  premiumErrorButtonText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
  },

  // Premium Banner Overlay
  premiumBannerOverlay: {
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  // Premium Header - INCREASED HEIGHT with BOTTOM RADIUS
  premiumHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
    borderBottomLeftRadius: scale(32),
    borderBottomRightRadius: scale(32),
  },
  premiumHeaderBottomRadius: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: verticalScale(40),
    borderBottomLeftRadius: scale(32),
    borderBottomRightRadius: scale(32),
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  premiumHeaderContent: {
    flex: 1,
    paddingHorizontal: scale(20),
  },
  premiumHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: verticalScale(16),
  },
  premiumHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  premiumHeaderAction: {
    borderRadius: scale(18),
    overflow: 'hidden',
  },
  premiumHeaderActionGradient: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // FIXED: Premium Header Offer Cards Styles - Platform specific
  premiumHeaderOfferCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: scale(16),
    marginBottom: verticalScale(16),
    gap: scale(12),
    ...Platform.select({
      ios: {
        // iOS specific positioning
        marginTop: 0,
      },
      android: {
        // Android specific positioning - ensures cards are properly aligned
        marginTop: verticalScale(4),
      },
    }),
  },
  premiumHeaderOfferCard: {
    flex: 1,
    height: verticalScale(80),
    borderRadius: scale(16),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  premiumHeaderOfferCardContent: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: scale(16),
    borderWidth: Platform.select({
      ios: 1,
      android: 0.5,
    }),
    borderColor: 'rgba(255,255,255,0.3)',
  },
  // FIXED: Android specific overlay for better transparency
  premiumHeaderOfferAndroidOverlay: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  premiumHeaderOfferInner: {
    flex: 1,
    flexDirection: 'row',
    padding: scale(12),
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  premiumHeaderOfferContent: {
    flex: 1,
  },
  premiumHeaderOfferTitle: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontScale(13),
    marginBottom: verticalScale(2),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  premiumHeaderOfferSubtitle: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontSize: fontScale(9),
    marginBottom: verticalScale(4),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  premiumHeaderOfferChip: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(8),
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  premiumHeaderOfferChipText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: fontScale(8),
  },
  premiumHeaderOfferImageContainer: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(12),
    overflow: 'hidden',
    marginLeft: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  premiumHeaderOfferImage: {
    width: '100%',
    height: '100%',
  },

  // Premium Banner
  premiumBannerContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  premiumBannerImage: {
    width: '100%',
    height: '100%',
  },
  premiumBannerVideo: {
    width: '100%',
    height: '100%',
  },

  // Premium Address
  premiumAddressContainer: {
    overflow: 'hidden',
    maxWidth: screenWidth * 0.55,
  },
  premiumAddressHomeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginBottom: verticalScale(2),
  },
  premiumAddressHomeTypeLabel: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontScale(13),
  },
  premiumAddressMainLabel: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: fontScale(11),
    opacity: 0.9,
  },

  // Premium Search - iOS Optimized
  premiumSearchWrapper: {
    width: '100%',
    paddingHorizontal: scale(4),
    marginTop: verticalScale(8),
  },
  premiumSearchContainer: {
    borderRadius: scale(20),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        backgroundColor: 'transparent',
      },
      android: {
        elevation: 4,
      },
    }),
  },
  premiumSearchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  premiumSearchIconWrapper: {
    marginRight: scale(12),
  },
  premiumSearchPlaceholder: {
    ...TYPOGRAPHY.body2,
    color: '#FFFFFF',
    flex: 1,
    fontWeight: '500',
    fontSize: fontScale(14),
  },

  // Sticky Categories Header - iOS Optimized
  stickyCategoriesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
  },
  stickyCategoriesContent: {
    paddingVertical: verticalScale(12),
  },
  stickyCategoriesScrollContent: {
    paddingHorizontal: scale(16),
    gap: scale(16),
  },
  stickyCategoryItem: {
    alignItems: 'center',
    width: scale(64),
  },
  stickyCategoryItemActive: {
    opacity: 1,
  },
  stickyCategoryIconWrapper: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    overflow: 'hidden',
    marginBottom: verticalScale(4),
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stickyCategoryIconWrapperActive: {
    borderColor: COLORS.primary,
  },
  stickyCategoryIcon: {
    width: '100%',
    height: '100%',
  },
  stickyCategoryText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(10),
    textAlign: 'center',
  },
  stickyCategoryTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Premium Categories
  premiumCategoriesContainer: {
    marginBottom: verticalScale(20),
  },
  premiumCategoriesContent: {
    paddingHorizontal: scale(16),
    gap: scale(12),
  },
  premiumCategoryCard: {
    alignItems: 'center',
    width: scale(72),
  },
  premiumCategoryCardActive: {
    transform: [{ scale: 1.05 }],
  },
  premiumCategoryIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(6),
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border.light,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  premiumCategoryIconContainerActive: {
    borderColor: COLORS.primary,
  },
  premiumCategoryIcon: {
    width: '100%',
    height: '100%',
  },
  premiumCategoryText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
    fontSize: fontScale(11),
  },
  premiumCategoryTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Premium Sections
  premiumScrollView: {
    flex: 1,
  },
  premiumScrollContent: {
    paddingBottom: verticalScale(100),
  },
  premiumSection: {
    marginBottom: verticalScale(28),
    paddingHorizontal: scale(16),
  },
  premiumSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(14),
  },
  premiumSectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontSize: fontScale(18),
  },
  premiumSectionSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: verticalScale(2),
    fontSize: fontScale(12),
  },

  // Premium Top Restaurants
  premiumTopRestaurantsContent: {
    paddingRight: scale(16),
    gap: scale(25),
  },

  // Premium Restaurant Cards
  premiumRestaurantCard: {
    backgroundColor: COLORS.card,
    borderRadius: scale(14),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  premiumTopRestaurantCard: {
    width: (screenWidth) / 3.2,
  },
  premiumRestaurantImageContainer: {
    position: 'relative',
    height: verticalScale(110),
  },
  premiumRestaurantImage: {
    width: '100%',
    height: '100%',
  },
  premiumRestaurantImagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.border.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumRestaurantImageGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  premiumRestaurantNewBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    backgroundColor: COLORS.success,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(8),
  },
  premiumRestaurantNewBadgeText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontScale(8),
  },
  premiumRestaurantFavorite: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumTopRestaurantFavorite: {
    top: scale(6),
    right: scale(6),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
  },
  premiumRestaurantInfo: {
    padding: scale(12),
  },
  premiumTopRestaurantInfo: {
    padding: scale(8),
  },
  premiumRestaurantName: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: verticalScale(2),
    fontSize: fontScale(14),
  },
  premiumTopRestaurantName: {
    fontSize: fontScale(12),
    marginBottom: verticalScale(1),
  },
  premiumRestaurantMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  premiumRestaurantCuisine: {
    flex: 1,
  },
  premiumRestaurantCuisineText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(11),
  },
  premiumTopRestaurantCuisineText: {
    fontSize: fontScale(9),
  },
  premiumRestaurantDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  premiumRestaurantDeliveryText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(11),
  },
  premiumTopRestaurantDeliveryText: {
    fontSize: fontScale(9),
  },
  premiumRestaurantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scale(14),
  },

  // Premium Active Orders - iOS Optimized
  premiumActiveOrdersContainer: {
    position: 'absolute',
    left: scale(16),
    right: scale(16),
    zIndex: 100,
    ...Platform.select({
      ios: {
        // iOS specific positioning
      },
      android: {
        // Android specific positioning to ensure proper alignment from bottom
      },
    }),
  },
  premiumActiveOrdersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  premiumActiveOrdersTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  premiumActiveOrdersTitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(14),
  },
  premiumActiveOrdersToggle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: fontScale(12),
  },
  premiumActiveOrdersList: {
    gap: verticalScale(10),
  },
  premiumActiveOrderCard: {
    borderRadius: scale(14),
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  premiumActiveOrderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(12),
  },
  premiumActiveOrderImage: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(12),
    marginRight: scale(12),
  },
  premiumActiveOrderDetails: {
    flex: 1,
  },
  premiumActiveOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  premiumActiveOrderKitchen: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    flex: 1,
    fontSize: fontScale(13),
  },
  premiumActiveOrderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: scale(12),
    gap: scale(4),
  },
  premiumActiveOrderStatusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  premiumActiveOrderStatusText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    fontSize: fontScale(11),
  },
  premiumActiveOrderNumber: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: verticalScale(4),
    fontSize: fontScale(11),
  },
  premiumActiveOrderTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  premiumActiveOrderTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontSize: fontScale(11),
  },
  premiumActiveOrderArrow: {
    marginLeft: scale(8),
  },

  // Premium Cart Summary - iOS Optimized
  premiumCartSummary: {
    position: 'absolute',
    left: scale(16),
    right: scale(16),
    bottom: Platform.OS === 'ios' ? verticalScale(95) : verticalScale(86),
    borderRadius: scale(18),
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  premiumCartSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(14),
  },
  premiumCartSummaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumCartSummaryImage: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    marginRight: scale(12),
  },
  premiumCartSummaryText: {
    flex: 1,
  },
  premiumCartSummaryTitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: verticalScale(2),
    fontSize: fontScale(13),
  },
  premiumCartSummarySubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: fontScale(11),
  },
  premiumCartSummaryButton: {
    borderRadius: scale(28),
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  premiumCartSummaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    gap: scale(6),
  },
  premiumCartSummaryButtonText: {
    ...TYPOGRAPHY.body2,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: fontScale(13),
  },
  premiumCartBadge: {
    backgroundColor: '#FFFFFF',
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumCartBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: fontScale(11),
  },

  // FIXED: Premium Tab Bar - No border, only top radius, properly positioned
  premiumTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0, // Remove top border
    borderWidth: 0, // Remove all borders
    elevation: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
        // Android specific shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
    borderTopLeftRadius: scale(24), // Only top left radius
    borderTopRightRadius: scale(24), // Only top right radius
    borderBottomLeftRadius: 0, // No bottom radius
    borderBottomRightRadius: 0, // No bottom radius
    overflow: 'hidden',
  },
  premiumTabLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    marginBottom: verticalScale(4),
    fontSize: fontScale(11),
  },
  premiumTabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTabIndicator: {
    position: 'absolute',
    bottom: -verticalScale(6),
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: COLORS.primary,
  },
});

export default HomeTabs;