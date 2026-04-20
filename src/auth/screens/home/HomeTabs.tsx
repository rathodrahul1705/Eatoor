import React, { useEffect, useState, useCallback, useRef, useContext, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Linking,
  StatusBar,
  Dimensions,
  AppState,
  AppStateStatus,
  TextInput,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  Easing,
  Modal
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import PartnerScreen from './PartnerScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ReorderScreen from '../../screens/home/ReorderScreen';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation';
import { getUserAddress } from '../../../api/address';
import { AuthContext } from '../../../context/AuthContext';
import { getKitchenList, updateFavouriteKitchen } from '../../../api/home';
import { getCart, getActiveOrders, updateCartUserDetails } from '../../../api/cart';
import { searchSuggestions } from '../../../api/search';
import { getOfferBanners } from '../../../api/offer';
import moment from 'moment';
import { getSessionId } from '../../../utlis/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// ============== CONSTANTS & CONFIGURATION ==============

const { width, height } = Dimensions.get('window');
const screenWidth = width;
const screenHeight = height;

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

const COLORS = {
  primary: '#E55C18',
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
  border: {
    light: '#F1F5F9',
    default: '#E2E8F0',
  },
  search: {
    background: '#FFFFFF',
    card: '#F8FAFC',
  },
  white: '#FFFFFF'
};

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

// Dynamic header heights based on device
const getHeaderHeights = () => {
  const baseHeaderHeight = Platform.select({
    ios: 400,
    android: 380,
  }) || 380;
  
  const baseCollapsedHeight = Platform.select({
    ios: 100,
    android: 110,
  }) || 100;
  
  return {
    expanded: verticalScale(baseHeaderHeight),
    collapsed: verticalScale(baseCollapsedHeight),
  };
};

const HEADER_HEIGHTS = getHeaderHeights();

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
  OFFERS: 'offers'
};

const SEARCH_PLACEHOLDERS = [
  "Pizza, burger, pasta...",
  "Chinese, Thai, Asian...",
  "Biryani, Shawarma...",
  "Desserts, Sweets...",
  "Healthy, Salad, Bowl..."
];

// ============== TYPES ==============

interface BannerTheme {
  bg_color: string;
  text_color: string;
  icon_color: string;
}

interface ApiParams {
  category?: string;
  food_type?: string;
  has_discount?: string;
  min_price?: string;
  max_price?: string;
  sort_by?: string;
  bogo?: string;
  is_available?: string;
  [key: string]: any;
}

interface BannerOffer {
  type: string;
  banner_type: string;
  category?: string;
  discount: string;
  code: string;
  api_params: ApiParams;
}

interface BannerValidity {
  from: string;
  till: string;
}

interface Banner {
  id: number;
  title: string;
  subtitle: string;
  image_url: string;
  theme: BannerTheme;
  offer: BannerOffer;
  validity: BannerValidity;
  terms: string[];
  order: number;
  is_active: boolean;
}

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
  bannerColors?: {
    backgroundColor: string;
    textColor: string;
  };
  isCollapsed?: boolean;
}

interface SearchInputProps {
  onPress: () => void;
  placeholder: string;
  bannerColors?: {
    backgroundColor: string;
    textColor: string;
  };
  isCollapsed?: boolean;
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

// ============== ENHANCED LOADER ==============

const EnhancedDeliveryLoader = () => {
  const [foodIconScale] = useState(new Animated.Value(0));
  const [bikePosition] = useState(new Animated.Value(-150));
  const [loadingDots] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [waveAnim] = useState(new Animated.Value(0));
  const [bikeBounceAnim] = useState(new Animated.Value(0));
  const [progressWidth] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.spring(foodIconScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();

    Animated.timing(progressWidth, {
      toValue: 1,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(loadingDots, {
          toValue: 1,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(loadingDots, {
          toValue: 0,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bikeBounceAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bikeBounceAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(bikePosition, {
        toValue: screenWidth + 100,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const waveTranslateY = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -15, 0],
  });

  const bikeTranslateY = bikeBounceAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0],
  });

  const progressWidthInterpolate = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.main_app_loader_container}>
      <View style={styles.main_app_loader_background}>
        {[...Array(12)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.main_app_loader_background_circle,
              {
                width: scale(30 + i * 8),
                height: scale(30 + i * 8),
                top: (i % 3) * screenHeight * 0.3,
                left: (i % 2) * screenWidth * 0.7,
                opacity: 0.1 - i * 0.005,
                transform: [
                  {
                    translateY: waveTranslateY.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (i % 2 === 0 ? 20 : -20)],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.main_app_loader_content}>
        <View style={styles.main_app_loader_food_icons}>
          {['🍕', '🍔', '🍜', '🥗', '🍣', '🍦'].map((emoji, index) => (
            <Animated.View
              key={index}
              style={[
                styles.main_app_loader_food_icon,
                {
                  transform: [
                    { rotate: rotateInterpolate },
                    {
                      translateY: waveTranslateY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, index % 2 === 0 ? 20 : -20],
                      }),
                    },
                  ],
                  opacity: foodIconScale,
                  left: (index % 3) * scale(60) - scale(60),
                  top: Math.floor(index / 3) * scale(80) - scale(20),
                },
              ]}
            >
              <Text style={styles.main_app_loader_food_emoji}>{emoji}</Text>
            </Animated.View>
          ))}
        </View>

        <Animated.View
          style={[
            styles.main_app_loader_bike_container,
            {
              transform: [
                { translateX: bikePosition },
                { translateY: bikeTranslateY },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: 'https://eatoorprod.s3.eu-north-1.amazonaws.com/uploads/optimize_image.png' }}
            style={styles.main_app_loader_bike_image}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={styles.main_app_loader_brand_name}>Eatoor</Text>
        <Text style={styles.main_app_loader_tagline}>Delicious food delivered to your door</Text>

        <View style={styles.main_app_loader_progress_container}>
          <Animated.View
            style={[
              styles.main_app_loader_progress_bar,
              { width: progressWidthInterpolate, backgroundColor: COLORS.primary },
            ]}
          />
        </View>

        <View style={styles.main_app_loader_text_container}>
          <Text style={styles.main_app_loader_text}>Finding the best restaurants</Text>
          <View style={styles.main_app_loader_dots}>
            <Animated.View
              style={[
                styles.main_app_loader_dot,
                {
                  opacity: loadingDots.interpolate({
                    inputRange: [0, 0.3, 0.6, 1],
                    outputRange: [0.3, 1, 0.3, 0.3],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.main_app_loader_dot,
                {
                  opacity: loadingDots.interpolate({
                    inputRange: [0, 0.3, 0.6, 1],
                    outputRange: [0.3, 0.3, 1, 0.3],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.main_app_loader_dot,
                {
                  opacity: loadingDots.interpolate({
                    inputRange: [0, 0.3, 0.6, 1],
                    outputRange: [0.3, 0.3, 0.3, 1],
                  }),
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.main_app_loader_particles}>
          {[...Array(8)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.main_app_loader_particle,
                {
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  transform: [
                    {
                      translateY: waveTranslateY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.random() * 50],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ============== ENHANCED BANNER COMPONENT ==============

const EnhancedBanner = React.memo(({ 
  banners, 
  onBannerPress,
  onBannerChange
}: { 
  banners: Banner[];
  onBannerPress?: (banner: Banner) => void;
  onBannerChange?: (banner: Banner) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const autoPlayRef = useRef<NodeJS.Timeout>();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (banners.length <= 1) return;
    
    autoPlayRef.current = setInterval(() => {
      const nextIndex = activeIndex < banners.length - 1 ? activeIndex + 1 : 0;
      setActiveIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
        viewPosition: 0.5
      });
      if (onBannerChange && banners[nextIndex]) {
        onBannerChange(banners[nextIndex]);
      }
    }, 4000);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [activeIndex, banners.length, banners, onBannerChange]);

  const handleScroll = useCallback((event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / screenWidth);
    if (index !== activeIndex && banners[index]) {
      setActiveIndex(index);
      if (onBannerChange && banners[index]) {
        onBannerChange(banners[index]);
      }
    }
  }, [activeIndex, banners, onBannerChange]);

  const handleBannerPressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handleBannerPressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const renderBanner = ({ item, index }: { item: Banner; index: number }) => {
    const bgColor = item.theme?.bg_color || COLORS.primary;
    const textColor = item.theme?.text_color || '#FFFFFF';
    
    return (
      <Animated.View
        style={[
          styles.main_app_banner_wrapper,
          {
            transform: [{ scale: activeIndex === index ? 1 : 0.98 }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => onBannerPress?.(item)}
          onPressIn={handleBannerPressIn}
          onPressOut={handleBannerPressOut}
          style={styles.main_app_banner_card}
        >
          <View style={[styles.main_app_banner_container_solid, { backgroundColor: bgColor }]}>
            <View style={styles.main_app_banner_decor}>
              <Icon name="star" size={scale(60)} color="rgba(255,255,255,0.15)" style={styles.main_app_banner_decor1} />
              <Icon name="ellipse" size={scale(80)} color="rgba(255,255,255,0.1)" style={styles.main_app_banner_decor2} />
              <Icon name="flower" size={scale(50)} color="rgba(255,255,255,0.08)" style={styles.main_app_banner_decor3} />
            </View>

            <View style={styles.main_app_banner_content}>
              <View style={styles.main_app_banner_left_content}>
                <View style={[styles.main_app_banner_badge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[styles.main_app_banner_badge_text, { color: textColor }]}>
                    {item.offer?.banner_type === 'cuisine' ? 'Cuisine Special' : 
                     item.offer?.banner_type === 'dessert' ? 'Dessert Delight' : 
                     item.offer?.banner_type === 'special' ? 'Special Offer' : 'Limited Offer'}
                  </Text>
                </View>
                <Text style={[styles.main_app_banner_title, { color: textColor }]}>
                  {item.title}
                </Text>
                <Text style={[styles.main_app_banner_subtitle, { color: textColor }]} numberOfLines={2}>
                  {item.subtitle}
                </Text>
                <View style={[styles.main_app_banner_chip, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Icon name="pricetag-outline" size={scale(14)} color={textColor} />
                  <Text style={[styles.main_app_banner_chip_text, { color: textColor }]}>
                    Get {item.offer?.discount || 'Special Deal'}
                  </Text>
                  <Icon name="arrow-forward" size={scale(14)} color={textColor} />
                </View>
              </View>
              
              <View style={styles.main_app_banner_right_content}>
                <Image 
                  source={{ uri: item.image_url }} 
                  style={styles.main_app_banner_image}
                  resizeMode="cover"
                />
                <View style={[styles.main_app_banner_image_overlay, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
                <View style={[styles.main_app_banner_discount_badge, { backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.main_app_banner_discount_text, { color: COLORS.primary }]}>
                    {item.offer?.discount || 'OFF'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (banners.length === 0) return null;

  return (
    <View style={styles.main_app_banner_container}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={false}
      />
    </View>
  );
});

// ============== OFFERS CATEGORY CARD ==============

const OffersCategoryCard = ({ onPress }: { onPress: () => void }) => {
  const [scaleAnim] = useState(new Animated.Value(1));
  const [glowAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const glowIntensity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.main_app_offers_category_card_wrapper}
    >
      <Animated.View
        style={[
          styles.main_app_offers_category_card,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: COLORS.primary,
          },
        ]}
      >
        <View style={styles.main_app_offers_category_particles}>
          <Icon name="star" size={scale(20)} color="rgba(255,255,255,0.3)" style={styles.main_app_offers_particle1} />
          <Icon name="star" size={scale(15)} color="rgba(255,255,255,0.2)" style={styles.main_app_offers_particle2} />
          <Icon name="ellipse" size={scale(30)} color="rgba(255,255,255,0.1)" style={styles.main_app_offers_particle3} />
        </View>

        <View style={styles.main_app_offers_category_icon_container}>
          <Icon name="pricetag-outline" size={scale(28)} color="#FFFFFF" />
        </View>

        <Animated.View
          style={[
            styles.main_app_offers_category_badge,
            { opacity: glowIntensity, backgroundColor: '#FFFFFF' },
          ]}
        >
          <Text style={styles.main_app_offers_category_badge_text}>🔥</Text>
        </Animated.View>
      </Animated.View>
      
      <Text style={styles.main_app_offers_category_text}>Offers</Text>
    </TouchableOpacity>
  );
};

// ============== COMPONENTS ==============

const AddressHeader = React.memo(({ isGuest, onAddressUpdate, bannerColors, isCollapsed }: AddressHeaderLeftProps) => {
  const navigation = useNavigation<any>();
  const [location, setLocation] = useState<LocationData>({
    address: 'Select location',
    loading: true,
    error: null,
    coords: null,
    showEnableLocationPrompt: false,
    showPermissionPrompt: false,
    homeType: 'Home',
    addressId: null,
  });

  const [appState, setAppState] = useState(AppState.currentState);
  const [locationRetryCount, setLocationRetryCount] = useState(0);
  const locationWatchId = useRef<number | null>(null);

  const truncateAddress = (address: string, maxWords: number = 3) => {
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
      if (!addressData) return false;

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

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          () => resolve(true),
          (error) => {
            console.log('iOS location error:', error);
            if (error.code === 1) {
              resolve(false);
            } else {
              resolve(true);
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    } else {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (hasPermission) {
          console.log('Location permission already granted');
          return true;
        }

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'Eatoor needs access to your location to show nearby restaurants and provide accurate delivery estimates.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
            buttonNeutral: 'Ask Me Later',
          }
        );

        console.log('Permission request result:', granted);
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission granted');
          return true;
        } else if (granted === PermissionsAndroid.RESULTS.DENIED) {
          console.log('Location permission denied');
          return false;
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          console.log('Location permission permanently denied');
          return false;
        }
        return false;
      } catch (error) {
        console.error('Error requesting permission:', error);
        return false;
      }
    }
  }, []);

  const checkLocationServices = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: false,
              timeout: 3000,
              maximumAge: 0,
            }
          );
        });
        return !!position;
      } catch (error) {
        console.log('Location services check failed:', error);
        return false;
      }
    }
    return true;
  }, []);

  const getCurrentLocation = useCallback(async (retryCount = 0): Promise<void> => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      const savedDetails = await getSavedAddressDetails();
      if (savedDetails.address && savedDetails.coords) {
        console.log('Using saved address:', savedDetails.address);
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

      const areServicesEnabled = await checkLocationServices();
      if (!areServicesEnabled) {
        console.log('Location services are disabled');
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
        console.log('Location permission not granted');
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

      console.log('Fetching current location...');
      
      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
            distanceFilter: 0,
          }
        );
      });

      const { latitude, longitude } = position.coords;
      console.log('Location fetched:', latitude, longitude);
      
      setLocationRetryCount(0);
      await checkLocationInDatabase(latitude, longitude);
      
    } catch (error: any) {
      console.error('Error getting location:', error);
      
      let errorMessage = 'Unable to get location';
      let promptForEnable = false;
      let promptForPermission = false;
      
      if (error.code === 2 || error.code === 3) {
        errorMessage = error.code === 2 
          ? 'Location unavailable. Please enable GPS and move to an open area.'
          : 'Location request timed out. Please ensure GPS is enabled and try again.';
        promptForEnable = true;
        
        if (retryCount < 3) {
          console.log(`Retrying location fetch (attempt ${retryCount + 1}/3)...`);
          setTimeout(() => {
            getCurrentLocation(retryCount + 1);
          }, 3000);
          return;
        }
        
        if (retryCount === 3 && !locationWatchId.current) {
          console.log('Attempting watchPosition fallback...');
          locationWatchId.current = Geolocation.watchPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords;
              console.log('Watch position success:', latitude, longitude);
              checkLocationInDatabase(latitude, longitude);
              if (locationWatchId.current) {
                Geolocation.clearWatch(locationWatchId.current);
                locationWatchId.current = null;
              }
            },
            (watchError) => {
              console.error('Watch position error:', watchError);
              if (locationWatchId.current) {
                Geolocation.clearWatch(locationWatchId.current);
                locationWatchId.current = null;
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 30000,
              maximumAge: 10000,
              distanceFilter: 10,
            }
          );
          return;
        }
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
  }, [requestLocationPermission, checkLocationInDatabase, getSavedAddressDetails, onAddressUpdate, checkLocationServices]);

  useEffect(() => {
    return () => {
      if (locationWatchId.current) {
        Geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        setLocationRetryCount(0);
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
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    } else {
      Linking.openURL('app-settings:');
    }
  }, []);

  const showPermissionAlert = useCallback(() => {
    requestLocationPermission().then(granted => {
      if (granted) {
        getCurrentLocation();
      }
    });
  }, [getCurrentLocation, requestLocationPermission]);

  useEffect(() => {
    if (location.showEnableLocationPrompt) showLocationSettingsAlert();
  }, [location.showEnableLocationPrompt, showLocationSettingsAlert]);

  useEffect(() => {
    if (location.showPermissionPrompt) showPermissionAlert();
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
    : location.error || truncateAddress(location.address, 3);

  const textColor = bannerColors?.textColor || COLORS.text.primary;
  const secondaryTextColor = bannerColors?.textColor ? `${bannerColors.textColor}CC` : COLORS.text.secondary;

  if (isCollapsed) {
    return (
      <TouchableOpacity
        onPress={handleAddressPress}
        activeOpacity={0.7}
        style={styles.main_app_collapsed_address_container}
      >
        <Icon name="location-outline" size={scale(18)} color={textColor} />
        <Text style={[styles.main_app_collapsed_address_text, { color: textColor }]} numberOfLines={1}>
          {displayAddress}
        </Text>
        <Icon name="chevron-down" size={scale(14)} color={secondaryTextColor} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleAddressPress}
      activeOpacity={0.7}
      style={styles.main_app_address_container}
    >
      <View style={styles.main_app_address_content}>
        <Text style={[styles.main_app_address_home_type, { color: textColor }]} numberOfLines={1}>
          {location.loading ? '...' : location.homeType}
        </Text>
        <View style={styles.main_app_address_row}>
          <Icon name="location-outline" size={scale(16)} color={secondaryTextColor} />
          <Text style={[styles.main_app_address_text, { color: secondaryTextColor }]} numberOfLines={1}>
            {displayAddress}
          </Text>
          <Icon name="chevron-down" size={scale(16)} color={secondaryTextColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const SearchBar: React.FC<SearchInputProps> = React.memo(({ onPress, placeholder, bannerColors, isCollapsed }) => {
  const searchBgColor = bannerColors?.backgroundColor 
    ? `${bannerColors.backgroundColor}E6`
    : 'rgba(255, 255, 255, 0.95)';
    
  const borderColor = bannerColors?.textColor 
    ? `${bannerColors.textColor}40` 
    : COLORS.border.default;
  
  const textColor = bannerColors?.textColor || COLORS.text.primary;
  const iconColor = bannerColors?.textColor || COLORS.text.secondary;

  if (isCollapsed) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          styles.main_app_collapsed_search_container,
          { 
            backgroundColor: searchBgColor, 
            borderColor: borderColor,
          }
        ]}
      >
        <Icon name="search-outline" size={scale(18)} color={iconColor} />
        <Text style={[styles.main_app_collapsed_search_placeholder, { color: textColor }]} numberOfLines={1}>
          {placeholder}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[
        styles.main_app_search_container,
        { 
          backgroundColor: searchBgColor, 
          borderColor: borderColor,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          }),
        }
      ]}
    >
      <View style={styles.main_app_search_content}>
        <Icon name="search-outline" size={scale(20)} color={iconColor} />
        <Text style={[styles.main_app_search_placeholder, { color: textColor }]} numberOfLines={1}>
          {placeholder}
        </Text>
        <View style={[styles.main_app_search_filter, { backgroundColor: `${bannerColors?.backgroundColor || COLORS.border.light}30` }]}>
          <Icon name="options-outline" size={scale(18)} color={iconColor} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

const HeaderAction = React.memo(({ onPress, icon, color, isCollapsed }: { onPress: () => void; icon: string; color?: string; isCollapsed?: boolean }) => (
  <TouchableOpacity 
    style={[styles.main_app_header_action, isCollapsed && styles.main_app_collapsed_header_action]}
    onPress={onPress}
  >
    <Icon name={icon} size={isCollapsed ? scale(20) : scale(24)} color={color || COLORS.text.primary} />
  </TouchableOpacity>
));

const CollapsedHeader = React.memo(({ 
  isGuest, 
  onAddressUpdate, 
  onSearchPress,
  onFavoritePress,
  onWalletPress,
  onProfilePress,
  placeholder,
  bannerColors,
  opacity
}: { 
  isGuest: boolean;
  onAddressUpdate?: (address: string, homeType: string) => void;
  onSearchPress: () => void;
  onFavoritePress: () => void;
  onWalletPress: () => void;
  onProfilePress: () => void;
  placeholder: string;
  bannerColors?: {
    backgroundColor: string;
    textColor: string;
  };
  opacity: Animated.AnimatedInterpolation;
}) => {
  const insets = useSafeAreaInsets();
  
  const headerBgColor = bannerColors?.backgroundColor || '#FFFFFF';
  const textColor = bannerColors?.textColor || COLORS.text.primary;

  return (
    <Animated.View 
      style={[
        styles.main_app_collapsed_header, 
        { 
          backgroundColor: headerBgColor, 
          paddingTop: insets.top,
          opacity: opacity,
          transform: [{ translateY: 0 }]
        }
      ]}
    >
      <View style={styles.main_app_collapsed_header_content}>
        <AddressHeader 
          isGuest={isGuest} 
          onAddressUpdate={onAddressUpdate} 
          bannerColors={bannerColors}
          isCollapsed={true}
        />
        <SearchBar 
          onPress={onSearchPress} 
          placeholder={placeholder} 
          bannerColors={bannerColors}
          isCollapsed={true}
        />
        <View style={styles.main_app_collapsed_header_actions}>
          <HeaderAction 
            onPress={onFavoritePress}
            icon="heart-outline"
            color={textColor}
            isCollapsed={true}
          />
          <HeaderAction 
            onPress={onWalletPress}
            icon="wallet-outline"
            color={textColor}
            isCollapsed={true}
          />
          <HeaderAction 
            onPress={onProfilePress}
            icon="person-outline"
            color={textColor}
            isCollapsed={true}
          />
        </View>
      </View>
    </Animated.View>
  );
});

const IntegratedHeader = React.memo(({ 
  isGuest, 
  onAddressUpdate, 
  onSearchPress,
  onFavoritePress,
  onWalletPress,
  onProfilePress,
  placeholder,
  banners,
  onBannerPress,
  onBannerChange,
  bannerColors,
  scrollY,
  collapsedOpacity
}: { 
  isGuest: boolean;
  onAddressUpdate?: (address: string, homeType: string) => void;
  onSearchPress: () => void;
  onFavoritePress: () => void;
  onWalletPress: () => void;
  onProfilePress: () => void;
  placeholder: string;
  banners: Banner[];
  onBannerPress?: (banner: Banner) => void;
  onBannerChange?: (banner: Banner) => void;
  bannerColors?: {
    backgroundColor: string;
    textColor: string;
  };
  scrollY: Animated.Value;
  collapsedOpacity: Animated.AnimatedInterpolation;
}) => {
  const insets = useSafeAreaInsets();
  
  const headerBgColor = bannerColors?.backgroundColor || '#FFFFFF';
  const textColor = bannerColors?.textColor || COLORS.text.primary;

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed],
    outputRange: [0, -(HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed)],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed - 50, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const bannerScale = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed - 60, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const searchBarScale = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed],
    outputRange: [1, 0.92],
    extrapolate: 'clamp',
  });

  const addressHeaderOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed - 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <>
      <Animated.View
        style={[
          styles.main_app_integrated_header,
          {
            transform: [{ translateY: headerTranslateY }],
            opacity: headerOpacity,
            backgroundColor: headerBgColor,
            minHeight: HEADER_HEIGHTS.expanded,
          },
        ]}
      >
        <View style={[styles.main_app_integrated_header_content, { paddingTop: insets.top }]}>
          <Animated.View style={[styles.main_app_header_top, { opacity: addressHeaderOpacity }]}>
            <AddressHeader isGuest={isGuest} onAddressUpdate={onAddressUpdate} bannerColors={bannerColors} />
            <View style={styles.main_app_header_actions}>
              <HeaderAction 
                onPress={onFavoritePress}
                icon="heart-outline"
                color={textColor}
              />
              <HeaderAction 
                onPress={onWalletPress}
                icon="wallet-outline"
                color={textColor}
              />
              <HeaderAction 
                onPress={onProfilePress}
                icon="person-outline"
                color={textColor}
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.main_app_search_wrapper, { transform: [{ scale: searchBarScale }] }]}>
            <SearchBar onPress={onSearchPress} placeholder={placeholder} bannerColors={bannerColors} />
          </Animated.View>

          {banners.length > 0 && (
            <Animated.View 
              style={[
                styles.main_app_header_banner_container,
                {
                  transform: [{ scale: bannerScale }],
                  opacity: bannerOpacity,
                }
              ]}
            >
              <EnhancedBanner 
                banners={banners}
                onBannerPress={onBannerPress}
                onBannerChange={onBannerChange}
              />
            </Animated.View>
          )}
        </View>
      </Animated.View>

      <CollapsedHeader
        isGuest={isGuest}
        onAddressUpdate={onAddressUpdate}
        onSearchPress={onSearchPress}
        onFavoritePress={onFavoritePress}
        onWalletPress={onWalletPress}
        onProfilePress={onProfilePress}
        placeholder={placeholder}
        bannerColors={bannerColors}
        opacity={collapsedOpacity}
      />
    </>
  );
});

const CategoryCard = ({ 
  category, 
  onPress 
}: { 
  category: Category; 
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.main_app_category_card}
    >
      <View style={styles.main_app_category_icon_container}>
        <Image 
          source={{ uri: category.icon }} 
          style={styles.main_app_category_icon}
          resizeMode="cover"
        />
      </View>
      <Text style={styles.main_app_category_text} numberOfLines={1}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );
};

const RestaurantCard = ({ 
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
  const navigation = useNavigation<any>();
  const rating = kitchen.rating || (Math.random() * 1 + 4.2).toFixed(1);
  const deliveryTime = kitchen.delivery_time?.replace('min', '').trim() || '25-35';

  const handleFavoritePress = (e: any) => {
    e.stopPropagation();
    if (isGuest) {
      navigation.navigate('LoginScreen');
      return;
    }
    onToggleFavorite(kitchen.restaurant_id);
  };

  const cardWidth = isTopRestaurant 
    ? (screenWidth - scale(48)) / 2.5
    : (screenWidth - scale(48)) / 2;

  return (
    <TouchableOpacity
      onPress={() => onPress(kitchen)}
      activeOpacity={0.9}
      style={[
        styles.main_app_restaurant_card,
        { width: cardWidth }
      ]}
    >
      <View style={styles.main_app_restaurant_image_container}>
        <Image 
          source={{ uri: kitchen.restaurant_image }} 
          style={styles.main_app_restaurant_image}
          resizeMode="cover"
        />
        <TouchableOpacity 
          style={[
            styles.main_app_restaurant_favorite,
            isTopRestaurant && styles.main_app_top_restaurant_favorite
          ]}
          onPress={handleFavoritePress}
          disabled={favoriteLoading === kitchen.restaurant_id}
        >
          <Icon 
            name={kitchen.is_favourite ? "heart" : "heart-outline"} 
            size={isTopRestaurant ? scale(16) : scale(18)} 
            color={kitchen.is_favourite ? COLORS.primary : "#FFFFFF"} 
          />
        </TouchableOpacity>
        {kitchen.is_new && (
          <View style={styles.main_app_restaurant_new_badge}>
            <Text style={styles.main_app_restaurant_new_badge_text}>NEW</Text>
          </View>
        )}
      </View>
      <View style={styles.main_app_restaurant_info}>
        <Text style={[
          styles.main_app_restaurant_name,
          isTopRestaurant && styles.main_app_top_restaurant_name
        ]} numberOfLines={1}>
          {kitchen.restaurant_name}
        </Text>
        <Text style={[
          styles.main_app_restaurant_cuisine,
          isTopRestaurant && styles.main_app_top_restaurant_cuisine
        ]} numberOfLines={1}>
          {kitchen.item_cuisines?.split(', ').slice(0, 2).join(', ') || 'Various cuisines'}
        </Text>
        <View style={styles.main_app_restaurant_meta}>
          <View style={styles.main_app_restaurant_rating}>
            <Icon name="star" size={isTopRestaurant ? scale(10) : scale(12)} color="#FFB800" />
            <Text style={[
              styles.main_app_restaurant_rating_text,
              isTopRestaurant && styles.main_app_top_restaurant_rating_text
            ]}>{rating}</Text>
          </View>
          <View style={styles.main_app_restaurant_dot} />
          <Text style={[
            styles.main_app_restaurant_delivery,
            isTopRestaurant && styles.main_app_top_restaurant_delivery
          ]}>{deliveryTime} min</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Active Order Card Component (Simplified - No expand functionality)
const ActiveOrderCard = ({ 
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

  const statusIcons = {
    'pending': 'time-outline',
    'confirmed': 'checkmark-circle-outline',
    'preparing': 'restaurant-outline',
    'on-the-way': 'bicycle-outline',
    'delivered': 'home-outline',
    'cancelled': 'close-circle-outline',
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'on-the-way': return 'On The Way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'In Progress';
    }
  };

  return (
    <TouchableOpacity
      onPress={() => onPress(order)}
      activeOpacity={0.9}
      style={styles.active_order_card}
    >
      <View style={styles.active_order_content}>
        <View style={styles.active_order_image_container}>
          <Image 
            source={{ uri: order.kitchenImage }} 
            style={styles.active_order_image}
          />
          <View style={[styles.active_order_status_icon, { backgroundColor: statusColors[order.status] }]}>
            <Icon name={statusIcons[order.status]} size={scale(12)} color="#FFFFFF" />
          </View>
        </View>
        
        <View style={styles.active_order_details}>
          <View style={styles.active_order_header}>
            <Text style={styles.active_order_kitchen} numberOfLines={1}>
              {order.kitchenName}
            </Text>
            <View style={[
              styles.active_order_status_badge,
              { backgroundColor: `${statusColors[order.status]}15` }
            ]}>
              <View style={[
                styles.active_order_status_dot,
                { backgroundColor: statusColors[order.status] }
              ]} />
              <Text style={[
                styles.active_order_status_text,
                { color: statusColors[order.status] }
              ]}>
                {getStatusText(order.status)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.active_order_number}>
            Order #{order.orderNumber}
          </Text>
          
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <View style={styles.active_order_time_container}>
              <Icon name="time-outline" size={scale(10)} color={COLORS.text.tertiary} />
              <Text style={styles.active_order_time}>
                {order.estimatedArrival} • {order.placedOn}
              </Text>
            </View>
          )}
        </View>
        
        <Icon name="chevron-forward" size={scale(18)} color={COLORS.text.tertiary} />
      </View>
    </TouchableOpacity>
  );
};

// All Orders Bottom Sheet Modal
const AllOrdersModal = ({ 
  visible, 
  onClose, 
  orders,
  onOrderPress
}: { 
  visible: boolean;
  onClose: () => void;
  orders: ActiveOrder[];
  onOrderPress: (order: ActiveOrder) => void;
}) => {
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending': return 'time-outline';
      case 'confirmed': return 'checkmark-circle-outline';
      case 'preparing': return 'restaurant-outline';
      case 'on-the-way': return 'bicycle-outline';
      case 'delivered': return 'home-outline';
      case 'cancelled': return 'close-circle-outline';
      default: return 'restaurant-outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return '#FDCB6E';
      case 'confirmed': return '#00B894';
      case 'preparing': return '#6C5CE7';
      case 'on-the-way': return '#0984E3';
      case 'delivered': return '#00B894';
      case 'cancelled': return '#FF7675';
      default: return COLORS.text.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'on-the-way': return 'On The Way';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return 'In Progress';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.all_orders_backdrop,
          { opacity: backdropOpacity }
        ]}
      >
        <TouchableOpacity 
          style={styles.all_orders_backdrop_touchable}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.all_orders_modal_container,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.all_orders_modal_header}>
          <View style={styles.all_orders_modal_handle} />
          <View style={styles.all_orders_modal_header_content}>
            <Text style={styles.all_orders_modal_title}>All Orders</Text>
            <Text style={styles.all_orders_modal_subtitle}>
              {orders.length} active {orders.length === 1 ? 'order' : 'orders'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.all_orders_modal_close}>
              <Icon name="close" size={scale(24)} color={COLORS.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.all_orders_modal_list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.all_orders_modal_item}
              onPress={() => {
                onOrderPress(item);
                onClose();
              }}
            >
              <View style={styles.all_orders_modal_item_image_container}>
                <Image 
                  source={{ uri: item.kitchenImage }} 
                  style={styles.all_orders_modal_item_image}
                />
                <View style={[
                  styles.all_orders_modal_item_status_icon,
                  { backgroundColor: getStatusColor(item.status) }
                ]}>
                  <Icon name={getStatusIcon(item.status)} size={scale(12)} color="#FFFFFF" />
                </View>
              </View>
              
              <View style={styles.all_orders_modal_item_details}>
                <Text style={styles.all_orders_modal_item_name} numberOfLines={1}>
                  {item.kitchenName}
                </Text>
                <Text style={styles.all_orders_modal_item_number}>
                  Order #{item.orderNumber}
                </Text>
                <View style={styles.all_orders_modal_item_meta}>
                  <View style={[
                    styles.all_orders_modal_item_status_badge,
                    { backgroundColor: `${getStatusColor(item.status)}15` }
                  ]}>
                    <View style={[
                      styles.all_orders_modal_item_status_dot,
                      { backgroundColor: getStatusColor(item.status) }
                    ]} />
                    <Text style={[
                      styles.all_orders_modal_item_status_text,
                      { color: getStatusColor(item.status) }
                    ]}>
                      {getStatusText(item.status)}
                    </Text>
                  </View>
                  {item.status !== 'cancelled' && item.status !== 'delivered' && (
                    <Text style={styles.all_orders_modal_item_time}>
                      {item.estimatedArrival}
                    </Text>
                  )}
                </View>
              </View>
              
              <Icon name="chevron-forward" size={scale(20)} color={COLORS.text.tertiary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View style={styles.all_orders_modal_empty}>
              <Icon name="restaurant-outline" size={scale(60)} color={COLORS.text.tertiary} />
              <Text style={styles.all_orders_modal_empty_title}>No Active Orders</Text>
              <Text style={styles.all_orders_modal_empty_text}>
                Your active orders will appear here
              </Text>
            </View>
          )}
        />
      </Animated.View>
    </Modal>
  );
};

const ActiveOrdersSection = ({ 
  orders, 
  onOrderPress,
  loading
}: { 
  orders: ActiveOrder[];
  onOrderPress: (order: ActiveOrder) => void;
  loading: boolean;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const firstThreeOrders = orders.slice(0, 1);
  const remainingCount = orders.length - 3;

  if (loading) {
    return (
      <View style={styles.active_orders_section}>
        <View style={styles.active_orders_loading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.active_orders_loading_text}>Loading orders...</Text>
        </View>
      </View>
    );
  }

  if (orders.length === 0) return null;

  return (
    <>
      <View style={styles.active_orders_section}>
        <View style={styles.active_orders_container}>
          {/* All Orders Button - Top of Active Orders */}
          {/* <TouchableOpacity
            style={styles.all_orders_button}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.9}
          >
            <View style={styles.all_orders_button_left}>
              <View style={styles.all_orders_button_icon_container}>
                <Icon name="list-outline" size={scale(20)} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.all_orders_button_title}>All Orders</Text>
              </View>
            </View>
          </TouchableOpacity> */}

          {/* Show first 3 orders */}
          {firstThreeOrders.map((order) => (
            <ActiveOrderCard
              key={order.id}
              order={order}
              onPress={onOrderPress}
            />
          ))}

          {/* Show remaining count indicator if more than 3 orders */}
          {/* {remainingCount > 0 && (
            <TouchableOpacity
              style={styles.remaining_orders_indicator}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.remaining_orders_text}>
                +{remainingCount} more {remainingCount === 1 ? 'order' : 'orders'}
              </Text>
              <Icon name="arrow-forward" size={scale(14)} color={COLORS.primary} />
            </TouchableOpacity>
          )} */}
        </View>
      </View>

      {/* <AllOrdersModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        orders={orders}
        onOrderPress={onOrderPress}
      /> */}
    </>
  );
};

const CartSummary = ({ 
  pastKitchenDetails, 
  onViewCart 
}: { 
  pastKitchenDetails: PastKitchenDetails; 
  onViewCart: () => void;
}) => {
  return (
    <View style={styles.main_app_cart_summary}>
      <View style={styles.main_app_cart_summary_content}>
        <View style={styles.main_app_cart_summary_info}>
          <Image 
            source={{ uri: pastKitchenDetails.image }} 
            style={styles.main_app_cart_summary_image}
          />
          <View>
            <Text style={styles.main_app_cart_summary_title} numberOfLines={1}>
              {pastKitchenDetails.name}
            </Text>
            <Text style={styles.main_app_cart_summary_subtitle}>
              {pastKitchenDetails.itemCount} items in cart
            </Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.main_app_cart_summary_button}
          onPress={onViewCart}
          activeOpacity={0.8}
        >
          <Text style={styles.main_app_cart_summary_button_text}>View Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============== MAIN KITCHEN SCREEN ==============

const KitchenScreenTabs: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isGuest, userToken } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  
  // ========== ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS ==========
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchItem[]>([]);
  const [searchSuggestionsData, setSearchSuggestionsData] = useState<SearchSuggestionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [homeType, setHomeType] = useState<string>('Home');
  const [address, setAddress] = useState<string>('Select location');
  const [currentBannerColors, setCurrentBannerColors] = useState<{
    backgroundColor: string;
    textColor: string;
  }>({
    backgroundColor: '#E55C18',
    textColor: '#FFFFFF',
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const placeholderInterval = useRef<NodeJS.Timeout>();

  const collapsedOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed - 50, HEADER_HEIGHTS.expanded - HEADER_HEIGHTS.collapsed],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  // Moved useMemo to BEFORE conditional returns
  const hasActiveOrders = activeOrders.length > 0;
  const hasCart = pastKitchenDetails !== null;
  
  const bottomInset = useMemo(() => {
    if (hasActiveOrders) {
      return verticalScale(140);
    }
    if (hasCart) {
      return verticalScale(90);
    }
    return verticalScale(20);
  }, [hasActiveOrders, hasCart]);

  // All useCallback definitions
  const fetchBanners = useCallback(async () => {
    try {
      const response = await getOfferBanners();
      
      if (response?.data?.success && response.data.data) {
        const activeBanners = response.data.data
          .filter((banner: Banner) => banner.is_active)
          .sort((a: Banner, b: Banner) => a.order - b.order);
        
        setBanners(activeBanners);
        
        if (activeBanners.length > 0) {
          setCurrentBannerColors({
            backgroundColor: activeBanners[0].theme?.bg_color || COLORS.primary,
            textColor: activeBanners[0].theme?.text_color || '#FFFFFF',
          });
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.OFFERS, JSON.stringify(activeBanners));
      } else {
        const cachedBanners = await AsyncStorage.getItem(STORAGE_KEYS.OFFERS);
        if (cachedBanners) {
          const parsedBanners = JSON.parse(cachedBanners);
          setBanners(parsedBanners);
          if (parsedBanners.length > 0) {
            setCurrentBannerColors({
              backgroundColor: parsedBanners[0].theme?.bg_color || COLORS.primary,
              textColor: parsedBanners[0].theme?.text_color || '#FFFFFF',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
      try {
        const cachedBanners = await AsyncStorage.getItem(STORAGE_KEYS.OFFERS);
        if (cachedBanners) {
          const parsedBanners = JSON.parse(cachedBanners);
          setBanners(parsedBanners);
          if (parsedBanners.length > 0) {
            setCurrentBannerColors({
              backgroundColor: parsedBanners[0].theme?.bg_color || COLORS.primary,
              textColor: parsedBanners[0].theme?.text_color || '#FFFFFF',
            });
          }
        }
      } catch (cacheError) {
        console.error('Error loading cached banners:', cacheError);
      }
    }
  }, []);

  const handleBannerChange = useCallback((banner: Banner) => {
    setCurrentBannerColors({
      backgroundColor: banner.theme?.bg_color || COLORS.primary,
      textColor: banner.theme?.text_color || '#FFFFFF',
    });
  }, []);

  const handleBannerPress = useCallback((banner: Banner) => {
    navigation.navigate('OfferDetailsPage', {
      offerType: banner.offer?.type || 'food_offer',
      offer: {
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        discount: banner.offer?.discount || 'Special Offer',
        offerCode: banner.offer?.code || '',
        validTill: banner.validity?.till || '',
        terms: banner.terms || [],
        image: banner.image_url,
        backgroundColor: banner.theme?.bg_color || COLORS.primary,
        api_params: banner.offer?.api_params || {},
        banner_type: banner.offer?.banner_type || 'cuisine',
        category: banner.offer?.category || ''
      }
    });
  }, [navigation]);

  const handleOffersCategoryPress = useCallback(() => {
    navigation.navigate('OfferDetailsPage', {
      offerType: 'ALL_OFFER',
      offer: {
        id: 0,
        title: 'All Offers',
        subtitle: 'Discover amazing deals and discounts',
        discount: 'Special Deals',
        offerCode: '',
        validTill: '',
        terms: [],
        image: '',
        backgroundColor: COLORS.primary,
        api_params: {},
        banner_type: 'offers',
        category: ''
      }
    });
  }, [navigation]);

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
              is_new: Math.random() > 0.8,
            })),
            KitchenList: (response.data.data.KitchenList || []).map((k: any) => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false,
              rating: (Math.random() * 1 + 4).toFixed(1),
              delivery_time: `${Math.floor(Math.random() * 15) + 25}-${Math.floor(Math.random() * 20) + 40} min`,
              is_new: Math.random() > 0.8,
            })),
            CategoryList: (response.data.data.CategoryList || []),
          }
        };
        
        setApiData(processedData);
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
          });
        });

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
    if (isGuest) {
      navigation.navigate('LoginScreen');
      return;
    }

    if (favoriteLoading) return;

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

      const response = await updateFavouriteKitchen({ restaurant_id: kitchenId });
      
      if (!response?.data?.success) {
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
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
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
    } finally {
      setFavoriteLoading(null);
    }

    fetchKitchens()
    
  }, [favoriteLoading, isGuest, navigation, fetchKitchens]);

  const handleAddressUpdate = useCallback((newAddress: string, newHomeType: string) => {
    setAddress(newAddress);
    setHomeType(newHomeType);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    
    try {
      const userData = await fetchUserData();
      
      await Promise.all([
        fetchBanners(),
        fetchKitchens(),
        userData ? fetchActiveOrders(userData.id) : Promise.resolve(null),
        userData ? fetchPastKitchenDetails(userData.id) : fetchPastKitchenDetails(null),
        fetchRecentSearches(),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fetchBanners, fetchKitchens, fetchActiveOrders, fetchPastKitchenDetails, fetchUserData, fetchRecentSearches]);

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

  const handleFavoritePress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen');
    } else {
      navigation.navigate('FavoritesScreen');
    }
  }, [isGuest, navigation]);

  const handleWalletPress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen');
    } else {
      navigation.navigate('EatoorMoneyScreen');
    }
  }, [isGuest, navigation]);

  const handleProfilePress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen');
    } else {
      navigation.navigate('ProfileScreen');
    }
  }, [isGuest, navigation]);

  // All useEffect hooks
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

  useEffect(() => {
    const init = async () => {
      const session = await initializeSession();
      const userData = await fetchUserData();
      
      await Promise.all([
        fetchBanners(),
        fetchKitchens(),
        fetchRecentSearches(),
      ]);

      if (userData) {
        await Promise.all([
          fetchActiveOrders(userData.id),
          fetchPastKitchenDetails(userData.id)
        ]);
      } else {
        await fetchPastKitchenDetails(null);
      }

      setTimeout(() => setLoading(false), 2000);
    };

    init();
  }, []);

  useEffect(() => {
    if (user?.id && sessionId && pastKitchenDetails?.id) {
      updateCartItemUser(user.id);
    }
  }, [user?.id, sessionId, pastKitchenDetails?.id, updateCartItemUser]);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    if (debouncedSearchQuery && isSearchModalVisible) {
      fetchSearchSuggestions(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0 && isSearchModalVisible) {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, isSearchModalVisible, fetchSearchSuggestions]);

  // ========== CONDITIONAL RETURNS GO HERE (AFTER ALL HOOKS) ==========
  if (loading) {
    return <EnhancedDeliveryLoader />;
  }

  if (!apiData) {
    return (
      <View style={styles.main_app_error_container}>
        <Icon name="restaurant-outline" size={scale(60)} color={COLORS.text.tertiary} />
        <Text style={styles.main_app_error_title}>Oops! Something went wrong</Text>
        <Text style={styles.main_app_error_text}>Unable to load restaurants</Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            initializeSession().then(() => {
              fetchUserData();
              fetchKitchens();
              fetchBanners();
              setTimeout(() => setLoading(false), 2000);
            });
          }}
          style={styles.main_app_error_button}
        >
          <Text style={styles.main_app_error_button_text}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ========== RENDER RETURN ==========
  return (
    <View style={styles.main_app_root_container}>
      <StatusBar 
        barStyle={currentBannerColors.textColor === '#FFFFFF' ? 'light-content' : 'dark-content'} 
        backgroundColor={currentBannerColors.backgroundColor} 
      />

      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleSearchClose}
        transparent={false}
      >
        <View style={styles.main_app_search_modal_container}>
          <View style={[styles.main_app_search_modal_header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={handleSearchClose} style={styles.main_app_search_modal_back_button}>
              <Icon name="arrow-back" size={scale(24)} color={COLORS.text.primary} />
            </TouchableOpacity>
            <View style={styles.main_app_search_modal_input_container}>
              <Icon name="search-outline" size={scale(20)} color={COLORS.text.tertiary} style={styles.main_app_search_modal_input_icon} />
              <TextInput
                style={styles.main_app_search_modal_input}
                placeholder="Search for dishes or restaurants..."
                placeholderTextColor={COLORS.text.tertiary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                onSubmitEditing={handleSearchSubmit}
                autoFocus={true}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.main_app_search_modal_clear_button}>
                  <Icon name="close-circle" size={scale(20)} color={COLORS.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.main_app_search_modal_content}>
            {searchLoading ? (
              <View style={styles.main_app_search_modal_loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.main_app_search_modal_loading_text}>Searching...</Text>
              </View>
            ) : searchQuery.length > 0 ? (
              searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.main_app_search_results_list}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.main_app_search_result_item}
                      onPress={() => handleSearchResultPress(item)}
                    >
                      <Image source={{ uri: item.image }} style={styles.main_app_search_result_image} />
                      <View style={styles.main_app_search_result_info}>
                        <Text style={styles.main_app_search_result_name}>{item.name}</Text>
                        <Text style={styles.main_app_search_result_type}>
                          {item.type === 'restaurant' ? 'Restaurant' : 'Dish'}
                          {item.category && ` • ${item.category}`}
                        </Text>
                        {item.price && (
                          <Text style={styles.main_app_search_result_price}>₹{item.price}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <View style={styles.main_app_search_modal_empty}>
                  <Icon name="restaurant-outline" size={scale(50)} color={COLORS.text.tertiary} />
                  <Text style={styles.main_app_search_modal_empty_title}>No results found</Text>
                  <Text style={styles.main_app_search_modal_empty_text}>Try searching for something else</Text>
                </View>
              )
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {recentSearches.length > 0 && (
                  <View style={styles.main_app_search_section}>
                    <View style={styles.main_app_search_section_header}>
                      <Text style={styles.main_app_search_section_title}>Recent Searches</Text>
                      <TouchableOpacity onPress={clearRecentSearches}>
                        <Text style={styles.main_app_search_section_action}>Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.main_app_search_recent_list}>
                      {recentSearches.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.main_app_search_recent_item}
                          onPress={() => handleRecentSearchPress(item)}
                        >
                          <Icon name="time-outline" size={scale(18)} color={COLORS.text.tertiary} />
                          <Text style={styles.main_app_search_recent_text}>{item}</Text>
                          <TouchableOpacity onPress={() => handleRemoveRecentSearch(item)}>
                            <Icon name="close" size={scale(18)} color={COLORS.text.tertiary} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={[styles.main_app_search_section, styles.main_app_search_section_last]}>
                  <Text style={styles.main_app_search_section_title}>Popular Categories</Text>
                  <View style={styles.main_app_search_category_grid}>
                    {apiData?.data.CategoryList?.slice(0, 8).map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={styles.main_app_search_category_item}
                        onPress={() => handleRecentSearchPress(category.name)}
                      >
                        <Image source={{ uri: category.icon }} style={styles.main_app_search_category_image} />
                        <Text style={styles.main_app_search_category_name} numberOfLines={1}>{category.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <IntegratedHeader
        isGuest={isGuest}
        onAddressUpdate={handleAddressUpdate}
        onSearchPress={handleSearchPress}
        onFavoritePress={handleFavoritePress}
        onWalletPress={handleWalletPress}
        onProfilePress={handleProfilePress}
        placeholder={SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
        banners={banners}
        onBannerPress={handleBannerPress}
        onBannerChange={handleBannerChange}
        bannerColors={currentBannerColors}
        scrollY={scrollY}
        collapsedOpacity={collapsedOpacity}
      />

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.main_app_scroll_view}
        contentContainerStyle={[
          styles.main_app_scroll_content,
          { 
            paddingTop: HEADER_HEIGHTS.expanded + verticalScale(8),
            paddingBottom: bottomInset
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
          />
        }
      >
        {apiData.data.CategoryList.length > 0 && (
          <View style={[styles.main_app_categories_section, { marginTop: verticalScale(12), marginBottom: verticalScale(24) }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.main_app_categories_content}
            >
              <OffersCategoryCard onPress={handleOffersCategoryPress} />
              
              {apiData.data.CategoryList.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onPress={() => handleCategoryPress(category.id, category.name)}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {apiData.data.FeatureKitchenList?.length > 0 && (
          <View style={styles.main_app_section}>
            <View style={styles.main_app_section_header}>
              <Text style={styles.main_app_section_title}>Top Rated</Text>
              <Text style={styles.main_app_section_subtitle}>
                Most loved restaurants near you
              </Text>
            </View>
            
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.main_app_top_restaurants_content}
              decelerationRate="fast"
              snapToInterval={screenWidth * 0.3 + scale(10)}
              snapToAlignment="start"
            >
              {apiData.data.FeatureKitchenList.slice(0, 10).map((kitchen) => (
                <RestaurantCard
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

        <View style={styles.main_app_section}>
          <View style={styles.main_app_section_header}>
            <Text style={styles.main_app_section_title}>All Restaurants</Text>
            <Text style={styles.main_app_section_subtitle}>
              {apiData.data.KitchenList.length}+ places to explore
            </Text>
          </View>

          <View style={styles.main_app_restaurant_grid}>
            {apiData.data.KitchenList.map((kitchen) => (
              <RestaurantCard
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
      </Animated.ScrollView>

      {/* Active Orders Section - Only for logged-in users */}
      {!isGuest && (
        <ActiveOrdersSection 
          orders={activeOrders}
          onOrderPress={handleOrderPress}
          loading={ordersLoading}
        />
      )}

      {pastKitchenDetails && activeOrders.length === 0 && (
        <CartSummary
          pastKitchenDetails={pastKitchenDetails}
          onViewCart={handleViewCart}
        />
      )}
    </View>
  );
};

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
    Platform.select({
      ios: verticalScale(85),
      android: verticalScale(75),
    }), 
    []
  );

  const tabIcons = {
    Kitchen: { focused: 'fast-food', unfocused: 'fast-food-outline' },
    Eatmart: { focused: 'cart', unfocused: 'cart-outline' },
    Reorder: { focused: 'repeat', unfocused: 'repeat-outline' },
    Partner: { focused: 'people', unfocused: 'people-outline' },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const routeName = route.name as AppTabs;
          const iconName = focused 
            ? tabIcons[routeName]?.focused 
            : tabIcons[routeName]?.unfocused;
          
          return (
            <Icon 
              name={iconName || 'restaurant-outline'} 
              size={focused ? scale(24) : scale(22)} 
              color={focused ? COLORS.primary : color} 
            />
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text.tertiary,
        tabBarStyle: [
          styles.main_app_tab_bar,
          {
            height: tabBarHeight,
            paddingBottom: insets.bottom || verticalScale(8),
          }
        ],
        tabBarLabelStyle: styles.main_app_tab_label,
        headerShown: false,
      })}
    >
      <Tab.Screen name="Kitchen" component={KitchenTabNavigator} />
      <Tab.Screen name="Eatmart" component={EatmartScreen} />
      {!isGuest && <Tab.Screen name="Reorder" component={ReorderScreen} />}
      {isRestaurantRegister && <Tab.Screen name="Partner" component={PartnerScreen} />}
    </Tab.Navigator>
  );
});

const HomeTabs = () => {
  const { isGuest } = useContext(AuthContext);

  return (
    <View style={styles.main_app_screen_container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <HomeTabsNavigator isGuest={isGuest} />
    </View>
  );
};

const styles = StyleSheet.create({
  // Track Order Styles
  track_order_container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  track_order_header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  track_order_back_button: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  track_order_header_title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  track_order_content: {
    padding: scale(16),
  },
  track_order_info_card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: verticalScale(20),
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  track_order_restaurant_image: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(12),
    marginRight: scale(12),
  },
  track_order_info_details: {
    flex: 1,
  },
  track_order_restaurant_name: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: verticalScale(4),
  },
  track_order_number: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: verticalScale(6),
  },
  track_order_status_badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
    gap: scale(4),
  },
  track_order_status_dot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  track_order_status_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '500',
  },
  track_order_progress_container: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(20),
    marginBottom: verticalScale(20),
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  track_order_progress_bar_background: {
    position: 'absolute',
    top: scale(40),
    left: scale(50),
    right: scale(50),
    height: scale(4),
    backgroundColor: COLORS.border.light,
    borderRadius: scale(2),
  },
  track_order_progress_bar_fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: scale(2),
  },
  track_order_step: {
    position: 'absolute',
    alignItems: 'center',
    width: scale(80),
    marginLeft: -scale(40),
  },
  track_order_step_icon_container: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(8),
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  track_order_step_name: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: verticalScale(2),
  },
  track_order_step_time: {
    ...TYPOGRAPHY.caption,
    fontSize: fontScale(10),
    color: COLORS.text.tertiary,
    textAlign: 'center',
  },
  track_order_delivery_card: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  track_order_section_title: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: verticalScale(12),
  },
  track_order_delivery_info: {
    flexDirection: 'row',
    marginBottom: verticalScale(12),
    gap: scale(12),
  },
  track_order_delivery_text: {
    flex: 1,
  },
  track_order_delivery_label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: verticalScale(2),
  },
  track_order_delivery_value: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  track_order_summary_card: {
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    padding: scale(16),
    marginBottom: verticalScale(20),
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  track_order_summary_item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  track_order_summary_label: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
  },
  track_order_summary_value: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
  },
  track_order_summary_total: {
    marginTop: verticalScale(8),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  track_order_summary_total_label: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  track_order_summary_total_value: {
    ...TYPOGRAPHY.body1,
    color: COLORS.primary,
    fontWeight: '600',
  },
  track_order_support_button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}10`,
    padding: scale(14),
    borderRadius: scale(12),
    gap: scale(8),
  },
  track_order_support_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Main App Container
  main_app_screen_container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  main_app_root_container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // Enhanced Loader Styles
  main_app_loader_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  main_app_loader_background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  main_app_loader_background_circle: {
    position: 'absolute',
    borderRadius: scale(100),
    backgroundColor: COLORS.primary,
  },
  main_app_loader_bike_container: {
    position: 'absolute',
    top: '10%',
    alignItems: 'center',
    zIndex: 2,
  },
  main_app_loader_bike_image: {
    width: scale(220),
    height: scale(220),
  },
  main_app_loader_content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    paddingHorizontal: scale(20),
  },
  main_app_loader_food_icons: {
    position: 'relative',
    width: screenWidth,
    height: verticalScale(180),
    marginBottom: verticalScale(10),
  },
  main_app_loader_food_icon: {
    position: 'absolute',
    backgroundColor: 'rgba(229, 92, 24, 0.1)',
    borderRadius: scale(40),
    padding: scale(8),
  },
  main_app_loader_food_emoji: {
    fontSize: fontScale(32),
  },
  main_app_loader_brand_name: {
    ...TYPOGRAPHY.h1,
    fontSize: fontScale(36),
    fontWeight: '800',
    marginBottom: verticalScale(8),
    color: COLORS.primary,
  },
  main_app_loader_tagline: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    fontSize: fontScale(13),
    marginBottom: verticalScale(20),
    textAlign: 'center',
  },
  main_app_loader_progress_container: {
    width: screenWidth * 0.7,
    height: verticalScale(4),
    backgroundColor: COLORS.border.light,
    borderRadius: scale(2),
    overflow: 'hidden',
    marginBottom: verticalScale(24),
  },
  main_app_loader_progress_bar: {
    height: '100%',
    borderRadius: scale(2),
  },
  main_app_loader_text_container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  main_app_loader_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    fontSize: fontScale(13),
  },
  main_app_loader_dots: {
    flexDirection: 'row',
    gap: scale(4),
  },
  main_app_loader_dot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: COLORS.primary,
  },
  main_app_loader_particles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  main_app_loader_particle: {
    position: 'absolute',
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: COLORS.primary,
    opacity: 0.5,
  },
  
  // Banner Solid Container
  main_app_banner_container_solid: {
    flex: 1,
    padding: scale(20),
    position: 'relative',
  },
  
  // Offers Category Card Styles
  main_app_offers_category_card_wrapper: {
    alignItems: 'center',
    width: scale(70),
  },
  main_app_offers_category_card: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    overflow: 'hidden',
    marginBottom: verticalScale(6),
    ...Platform.select({
      ios: {
        shadowColor: '#E55C18',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  main_app_offers_category_particles: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  main_app_offers_particle1: {
    position: 'absolute',
    top: scale(5),
    right: scale(5),
  },
  main_app_offers_particle2: {
    position: 'absolute',
    bottom: scale(5),
    left: scale(5),
  },
  main_app_offers_particle3: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -scale(15),
    marginTop: -scale(15),
  },
  main_app_offers_category_icon_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  main_app_offers_category_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontSize: fontScale(11),
    marginTop: verticalScale(2),
    fontWeight: '500',
  },
  main_app_offers_category_badge: {
    position: 'absolute',
    top: -scale(5),
    right: -scale(5),
    borderRadius: scale(12),
    paddingHorizontal: scale(4),
    paddingVertical: scale(2),
    minWidth: scale(20),
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  main_app_offers_category_badge_text: {
    fontSize: fontScale(10),
  },
  
  // Error Container
  main_app_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    backgroundColor: '#FFFFFF',
  },
  main_app_error_title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginTop: verticalScale(16),
    textAlign: 'center',
  },
  main_app_error_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    marginTop: verticalScale(4),
    textAlign: 'center',
  },
  main_app_error_button: {
    marginTop: verticalScale(24),
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(12),
    backgroundColor: COLORS.primary,
    borderRadius: scale(8),
  },
  main_app_error_button_text: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
  },
  
  // Integrated Header
  main_app_integrated_header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  main_app_integrated_header_content: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(8),
  },
  
  // Collapsed Header
  main_app_collapsed_header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  main_app_collapsed_header_content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(8),
  },
  main_app_collapsed_header_actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  main_app_collapsed_header_action: {
    width: scale(32),
    height: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Collapsed Address
  main_app_collapsed_address_container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    maxWidth: screenWidth * 0.35,
  },
  main_app_collapsed_address_text: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    fontSize: fontScale(11),
    flex: 1,
  },
  
  // Collapsed Search
  main_app_collapsed_search_container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(20),
    borderWidth: 1,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(6),
    marginHorizontal: scale(8),
    gap: scale(6),
  },
  main_app_collapsed_search_placeholder: {
    ...TYPOGRAPHY.caption,
    fontSize: fontScale(12),
    flex: 1,
  },
  
  // Header Components
  main_app_header_top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  main_app_header_actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  main_app_header_action: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  main_app_search_wrapper: {
    width: '100%',
    marginBottom: verticalScale(12),
  },
  main_app_header_banner_container: {
    marginHorizontal: -scale(16),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(4),
  },
  
  // Address Header
  main_app_address_container: {
    maxWidth: screenWidth * 0.55,
  },
  main_app_address_content: {
    paddingVertical: verticalScale(4),
  },
  main_app_address_home_type: {
    ...TYPOGRAPHY.body1,
    fontWeight: '900',
    fontSize: fontScale(16),
    marginBottom: verticalScale(2),
  },
  main_app_address_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  main_app_address_text: {
    ...TYPOGRAPHY.body2,
    fontWeight: '500',
    fontSize: fontScale(13),
    maxWidth: screenWidth * 0.4,
  },
  
  // Search Bar
  main_app_search_container: {
    borderRadius: scale(12),
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  main_app_search_content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    gap: scale(8),
  },
  main_app_search_placeholder: {
    ...TYPOGRAPHY.body2,
    flex: 1,
    fontSize: fontScale(14),
  },
  main_app_search_filter: {
    width: scale(34),
    height: scale(34),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: scale(8),
  },
  
  // Scroll View
  main_app_scroll_view: {
    flex: 1,
  },
  main_app_scroll_content: {
    paddingBottom: verticalScale(100),
  },
  
  // Banner Styles
  main_app_banner_container: {
    width: screenWidth,
    height: verticalScale(180),
  },
  main_app_banner_wrapper: {
    width: screenWidth,
    height: verticalScale(180),
  },
  main_app_banner_card: {
    flex: 1,
    marginHorizontal: scale(0),
    overflow: 'hidden',
    borderRadius: 0,
  },
  main_app_banner_decor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  main_app_banner_decor1: {
    position: 'absolute',
    top: scale(20),
    right: scale(20),
  },
  main_app_banner_decor2: {
    position: 'absolute',
    bottom: scale(20),
    left: scale(20),
  },
  main_app_banner_decor3: {
    position: 'absolute',
    top: '50%',
    right: '30%',
    opacity: 0.5,
  },
  main_app_banner_content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  main_app_banner_left_content: {
    flex: 1.2,
    marginRight: scale(16),
    zIndex: 2,
  },
  main_app_banner_right_content: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  main_app_banner_badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(20),
    alignSelf: 'flex-start',
    marginBottom: verticalScale(10),
  },
  main_app_banner_badge_text: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: fontScale(11),
  },
  main_app_banner_title: {
    fontSize: fontScale(22),
    fontWeight: '800',
    marginBottom: verticalScale(6),
    letterSpacing: -0.5,
    lineHeight: fontScale(26),
  },
  main_app_banner_subtitle: {
    fontSize: fontScale(12),
    fontWeight: '500',
    opacity: 0.9,
    marginBottom: verticalScale(12),
    lineHeight: fontScale(16),
  },
  main_app_banner_chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(25),
    alignSelf: 'flex-start',
    gap: scale(8),
  },
  main_app_banner_chip_text: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  main_app_banner_image: {
    width: scale(110),
    height: scale(110),
    borderRadius: scale(20),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  main_app_banner_image_overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    borderBottomLeftRadius: scale(20),
    borderBottomRightRadius: scale(20),
  },
  main_app_banner_discount_badge: {
    position: 'absolute',
    bottom: -scale(8),
    right: -scale(8),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(15),
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  main_app_banner_discount_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: fontScale(10),
  },
  
  // Categories Section
  main_app_categories_section: {
    marginBottom: verticalScale(20),
  },
  main_app_categories_content: {
    paddingHorizontal: scale(16),
    gap: scale(16),
  },
  main_app_category_card: {
    alignItems: 'center',
    width: scale(70),
  },
  main_app_category_icon_container: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: COLORS.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(6),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  main_app_category_icon: {
    width: '100%',
    height: '100%',
  },
  main_app_category_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontSize: fontScale(11),
  },
  
  // Restaurant Section
  main_app_section: {
    marginBottom: verticalScale(28),
    paddingHorizontal: scale(16),
  },
  main_app_section_header: {
    marginBottom: verticalScale(12),
  },
  main_app_section_title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(18),
  },
  main_app_section_subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginTop: verticalScale(2),
    fontSize: fontScale(12),
  },
  main_app_top_restaurants_content: {
    paddingRight: scale(16),
    gap: scale(12),
  },
  
  // Restaurant Card
  main_app_restaurant_card: {
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  main_app_restaurant_image_container: {
    position: 'relative',
    height: verticalScale(110),
  },
  main_app_restaurant_image: {
    width: '100%',
    height: '100%',
  },
  main_app_restaurant_favorite: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  main_app_top_restaurant_favorite: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
  },
  main_app_restaurant_new_badge: {
    position: 'absolute',
    top: scale(6),
    left: scale(6),
    backgroundColor: COLORS.success,
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
  },
  main_app_restaurant_new_badge_text: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: fontScale(8),
  },
  main_app_restaurant_info: {
    padding: scale(10),
  },
  main_app_restaurant_name: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: verticalScale(2),
    fontSize: fontScale(13),
  },
  main_app_top_restaurant_name: {
    fontSize: fontScale(12),
  },
  main_app_restaurant_cuisine: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: verticalScale(4),
    fontSize: fontScale(11),
  },
  main_app_top_restaurant_cuisine: {
    fontSize: fontScale(10),
  },
  main_app_restaurant_meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  main_app_restaurant_rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(2),
  },
  main_app_restaurant_rating_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '500',
    fontSize: fontScale(11),
  },
  main_app_top_restaurant_rating_text: {
    fontSize: fontScale(9),
  },
  main_app_restaurant_dot: {
    width: scale(3),
    height: scale(3),
    borderRadius: scale(1.5),
    backgroundColor: COLORS.text.tertiary,
  },
  main_app_restaurant_delivery: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(11),
  },
  main_app_top_restaurant_delivery: {
    fontSize: fontScale(9),
  },
  main_app_restaurant_grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: scale(12),
  },
  
  // New Active Orders Section Styles
  active_orders_section: {
    position: 'absolute',
    bottom: verticalScale(85),
    left: scale(12),
    right: scale(12),
    zIndex: 100,
  },
  active_orders_container: {
    gap: verticalScale(8),
  },
  active_orders_loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(12),
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: scale(12),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  active_orders_loading_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(12),
  },
  
  // All Orders Button
  all_orders_button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(12),
    borderColor: COLORS.border.default,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  all_orders_button_left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  all_orders_button_icon_container: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  all_orders_button_title: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(14),
  },
  all_orders_button_subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(11),
    marginTop: verticalScale(2),
  },
  
  // Remaining Orders Indicator
  remaining_orders_indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(10),
    backgroundColor: `${COLORS.primary}05`,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  remaining_orders_text: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: fontScale(12),
  },
  
  // Active Order Card
  active_order_card: {
    backgroundColor: '#F5F5F5',
    borderRadius: scale(12),
    marginBottom: Platform.OS === 'ios' ? scale(8) : scale(0),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  active_order_content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(7),
  },
  active_order_image_container: {
    position: 'relative',
    marginRight: scale(12),
  },
  active_order_image: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(10),
  },
  active_order_status_icon: {
    position: 'absolute',
    bottom: -scale(4),
    right: -scale(4),
    width: scale(18),
    height: scale(18),
    borderRadius: scale(9),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  active_order_details: {
    flex: 1,
  },
  active_order_header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  active_order_kitchen: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    flex: 1,
    fontSize: fontScale(13),
  },
  active_order_status_badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(8),
    gap: scale(3),
  },
  active_order_status_dot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
  },
  active_order_status_text: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    fontSize: fontScale(9),
  },
  active_order_number: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(10),
    marginBottom: verticalScale(2),
  },
  active_order_time_container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  active_order_time: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontSize: fontScale(9),
  },
  
  // All Orders Modal Styles
  all_orders_backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  all_orders_backdrop_touchable: {
    flex: 1,
  },
  all_orders_modal_container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    maxHeight: screenHeight * 0.8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  all_orders_modal_header: {
    paddingTop: verticalScale(12),
    paddingHorizontal: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  all_orders_modal_handle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: COLORS.border.default,
    borderRadius: scale(2),
    alignSelf: 'center',
    marginBottom: verticalScale(12),
  },
  all_orders_modal_header_content: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  all_orders_modal_title: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontSize: fontScale(20),
  },
  all_orders_modal_subtitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    fontSize: fontScale(13),
    marginLeft: scale(8),
  },
  all_orders_modal_close: {
    padding: scale(4),
  },
  all_orders_modal_list: {
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(20),
  },
  all_orders_modal_item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  all_orders_modal_item_image_container: {
    position: 'relative',
    marginRight: scale(12),
  },
  all_orders_modal_item_image: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(12),
  },
  all_orders_modal_item_status_icon: {
    position: 'absolute',
    bottom: -scale(4),
    right: -scale(4),
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  all_orders_modal_item_details: {
    flex: 1,
  },
  all_orders_modal_item_name: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(14),
    marginBottom: verticalScale(2),
  },
  all_orders_modal_item_number: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(11),
    marginBottom: verticalScale(4),
  },
  all_orders_modal_item_meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  all_orders_modal_item_status_badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(3),
    borderRadius: scale(10),
    gap: scale(4),
  },
  all_orders_modal_item_status_dot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
  },
  all_orders_modal_item_status_text: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    fontSize: fontScale(10),
  },
  all_orders_modal_item_time: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(10),
  },
  all_orders_modal_empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(60),
    paddingHorizontal: scale(32),
  },
  all_orders_modal_empty_title: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text.primary,
    marginTop: verticalScale(16),
    marginBottom: verticalScale(4),
    fontSize: fontScale(16),
  },
  all_orders_modal_empty_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontSize: fontScale(13),
  },
  
  // Cart Summary
  main_app_cart_summary: {
    position: 'absolute',
    left: scale(16),
    right: scale(16),
    bottom: Platform.select({
      ios: verticalScale(90),
      android: verticalScale(80),
    }),
    borderRadius: scale(12),
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: COLORS.border.default,
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  main_app_cart_summary_content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(12),
  },
  main_app_cart_summary_info: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: scale(10),
  },
  main_app_cart_summary_image: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
  },
  main_app_cart_summary_title: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(12),
  },
  main_app_cart_summary_subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(10),
  },
  main_app_cart_summary_button: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    backgroundColor: COLORS.primary,
    borderRadius: scale(6),
  },
  main_app_cart_summary_button_text: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: fontScale(11),
  },
  
  // Tab Bar
  main_app_tab_bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    elevation: 0,
  },
  main_app_tab_label: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    fontSize: fontScale(10),
  },
  
  // Search Modal
  main_app_search_modal_container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  main_app_search_modal_header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(12),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  main_app_search_modal_back_button: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
  },
  main_app_search_modal_input_container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.search.background,
    borderRadius: scale(20),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: COLORS.border.default,
  },
  main_app_search_modal_input_icon: {
    marginRight: scale(6),
  },
  main_app_search_modal_input: {
    flex: 1,
    height: verticalScale(40),
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    paddingVertical: 0,
    fontSize: fontScale(13),
  },
  main_app_search_modal_clear_button: {
    padding: scale(4),
  },
  main_app_search_modal_content: {
    flex: 1,
    backgroundColor: COLORS.search.background,
  },
  main_app_search_modal_loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  main_app_search_modal_loading_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    marginTop: verticalScale(8),
  },
  main_app_search_modal_empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  main_app_search_modal_empty_title: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text.primary,
    marginTop: verticalScale(12),
    marginBottom: verticalScale(4),
  },
  main_app_search_modal_empty_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  main_app_search_section: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  main_app_search_section_last: {
    borderBottomWidth: 0,
  },
  main_app_search_section_header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  main_app_search_section_title: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(14),
  },
  main_app_search_section_action: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: fontScale(11),
  },
  main_app_search_recent_list: {
    gap: verticalScale(8),
  },
  main_app_search_recent_item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(6),
    gap: scale(8),
  },
  main_app_search_recent_text: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    flex: 1,
    fontSize: fontScale(13),
  },
  main_app_search_category_grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(16),
  },
  main_app_search_category_item: {
    width: (screenWidth - scale(64)) / 4,
    alignItems: 'center',
  },
  main_app_search_category_image: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    marginBottom: verticalScale(4),
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  main_app_search_category_name: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    textAlign: 'center',
    fontSize: fontScale(10),
  },
  main_app_search_results_list: {
    paddingVertical: verticalScale(4),
  },
  main_app_search_result_item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  main_app_search_result_image: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  main_app_search_result_info: {
    flex: 1,
  },
  main_app_search_result_name: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '500',
    marginBottom: verticalScale(2),
    fontSize: fontScale(13),
  },
  main_app_search_result_type: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: verticalScale(2),
    fontSize: fontScale(11),
  },
  main_app_search_result_price: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: fontScale(11),
  },
});

export default HomeTabs;