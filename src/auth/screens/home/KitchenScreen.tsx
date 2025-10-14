import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, SafeAreaView, Text, TextInput,
  FlatList, TouchableOpacity, Image, Animated, Dimensions, 
  ScrollView, ActivityIndicator, Alert, RefreshControl, Platform,
  Modal
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { getKitchenList, updateFavouriteKitchen } from '../../../api/home';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCart, getActiveOrders } from '../../../api/cart';
import { searchSuggestions } from '../../../api/search';
import moment from 'moment';
import SearchModal from './searchmodal';

// Constants
const { width, height } = Dimensions.get('window');
const isAndroid = Platform.OS === 'android';

// Responsive scaling functions
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Responsive font sizes based on screen width
const normalize = (size: number) => Math.round(scale * size);

const FONT = {
  S: 10,
  XS: normalize(10),
  SM: normalize(12),
  BASE: normalize(14),
  LG: normalize(16),
  XL: normalize(18),
  XXL: normalize(20),
  XXXL: normalize(24),
};

// Enhanced Color Palette
const COLORS = {
  primary: '#FF6B35',
  primaryLight: '#FF9F5B',
  secondary: '#FFD166',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textDark: '#1E2329',
  textMedium: '#5E6770',
  textLight: '#8A939C',
  success: '#06C167',
  danger: '#FF3B30',
  info: '#5AC8FA',
  lightGray: '#F1F3F5',
  border: '#E1E4E8',
  rating: '#FFC120',
  darkOverlay: 'rgba(0,0,0,0.6)',
  lightOverlay: 'rgba(255,255,255,0.4)',
  searchBg: '#FFFFFF',
  categoryBg: '#FFFFFF',
  searchBorder: '#E1E4E8',
  refreshControl: '#E65C00',
  gradientStart: '#FF6B35',
  gradientMiddle: '#FF512F',
  gradientEnd: '#DD2476',
  textOnGradient: '#FFFFFF',
  categoryText: 'rgba(255,255,255,0.9)',
  activeCategoryText: '#FFFFFF',
  orderStatusBorder: '#E5E7EB',
  orderPreparing: '#F59E0B',
  orderOnTheWay: '#3B82F6',
  orderDelivered: '#10B981',
  orderCancelled: '#EF4444',
  modalBackground: 'rgba(0, 0, 0, 0.5)',
  searchModalBg: '#FFFFFF',
  recentSearchBg: '#F8F9FA',
  recentSearchText: '#5E6770',
  veg: '#06C167',
  nonVeg: '#FF3B30',
  searchHighlight: '#FFF9C4',
  searchSuggestionBg: '#F8F9FA',
  trending: '#FF6B9D',
  searchInputBg: 'rgba(255,255,255,0.95)',
  searchInputBorder: 'rgba(255,255,255,0.3)',
  searchPlaceholder: 'rgba(255,255,255,0.7)',
  premiumGold: '#FFD700',
  premiumSilver: '#C0C0C0',
  featuredGradientStart: '#667eea',
  featuredGradientEnd: '#764ba2',
  cardShadow: 'rgba(0, 0, 0, 0.08)',
  cardHover: 'rgba(255, 107, 53, 0.05)',
  discount: '#FF4757',
  newBadge: '#2ED573',
  trendingBadge: '#FF6B9D',
  // Diwali Colors
  diwaliGold: '#FFD700',
  diwaliOrange: '#FF6B35',
  diwaliRed: '#FF4757',
  diwaliYellow: '#FFD166',
  diwaliLight: '#FFF9C4',
  diwaliDark: '#8B4513',
  diwaliDeepOrange: '#FF8C00',
  diwaliSparkle: '#FFA500',
};

const FONTS = {
  bold: isAndroid ? 'sans-serif-medium' : 'Inter-Bold',
  semiBold: isAndroid ? 'sans-serif-medium' : 'Inter-SemiBold',
  medium: isAndroid ? 'sans-serif' : 'Inter-Medium',
  regular: isAndroid ? 'sans-serif' : 'Inter-Regular',
  light: isAndroid ? 'sans-serif-light' : 'Inter-Light',
};

const DEFAULT_CATEGORY_ICON = "https://via.placeholder.com/60";
const ACTIVE_ORDERS_LIMIT = 3;
const RECOMMENDED_KITCHENS_PER_ROW = 2;

// Enhanced search placeholders
const SEARCH_PLACEHOLDERS = [
  "🍛 Search Biryani, Pizza, or Chinese...",
  "🍱 Looking for Thalis or Combos?",
  "🍔 Craving snacks or beverages?",
  "🏠 Find your favorite home kitchen...",
  "🍰 Search for desserts or drinks..."
];

// Types (keeping the same types as before)
interface User {
  id: string;
  name: string;
  email: string;
}

interface Kitchen {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_image: string | null;
  restaurant_location: string;
  item_cuisines: string;
  avg_price_range: number;
  restaurant_city: string;
  restaurant_status: number;
  review_count?: number;
  is_favourite: boolean;
  rating?: number;
  delivery_time?: string;
  discount?: number;
  is_new?: boolean;
  is_trending?: boolean;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Filter {
  id: string;
  name: string;
  icon: string;
  type: 'rating' | 'veg' | 'offer' | 'fastDelivery';
  active: boolean;
}

interface ApiResponse {
  success: boolean;
  data: {
    FeatureKitchenList: Kitchen[];
    KitchenList: Kitchen[];
    CategoryList: Category[];
  };
}

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: 'preparing' | 'on-the-way' | 'delivered' | 'cancelled';
  statusText: string;
  kitchenId: string;
  kitchenName: string;
  kitchenImage: string;
  estimatedArrival: string;
  placedOn: string;
  items?: {
    name: string;
    quantity: number;
  }[];
  totalAmount?: number;
  deliveryAddress?: string;
}

// Enhanced Search Types
interface SearchSuggestionResponse {
  query: string;
  menus: SearchMenu[];
  restaurants: SearchRestaurant[];
  popular_searches?: string[];
  trending_items?: TrendingItem[];
}

interface SearchMenu {
  menu_name: string;
  items: SearchMenuItem[];
}

interface SearchMenuItem {
  id: number;
  item_name: string;
  item_price: string;
  item_image: string;
  category: string;
  food_type: string;
  availability: boolean;
  restaurant: SearchRestaurant;
}

interface SearchRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  profile_image: string;
  restaurant_status: number;
  cuisines: Cuisine[];
  rating?: number;
  delivery_time?: string;
  distance?: string;
}

interface Cuisine {
  id: number;
  cuisine_name: string;
}

interface TrendingItem {
  id: number;
  name: string;
  image: string;
  type: string;
  popularity_score: number;
}

interface SearchItem {
  id: string;
  name: string;
  image: string;
  type: 'food' | 'restaurant' | 'trending' | 'popular';
  category?: string;
  price?: string;
  foodType?: string;
  restaurant?: SearchRestaurant;
  originalData?: SearchMenuItem | SearchRestaurant | TrendingItem;
  rating?: number;
  deliveryTime?: string;
  distance?: string;
  searchedAt?: string;
}

// Navigation Types
type RootStackParamList = {
  HomeKitchenNavigate: {
    screen: string;
    params: {
      category?: string;
      query?: string;
      itemId?: string;
      suggestionsData?: SearchSuggestionResponse;
    };
  };
  HomeKitchenDetails: {
    kitchenId: string;
  };
  TrackOrder: {
    order: { order_number: string };
  };
  ActiveOrders: {
    orders: ActiveOrder[];
  };
  CartScreen: {
    pastkitcheId: string;
  };
  SearchResults: {
    query: string;
    itemId?: string;
    suggestionsData?: SearchSuggestionResponse;
  };
  CategoryResults: {
    query: string;
  };
};

type NavigationProp = {
  navigate: <T extends keyof RootStackParamList>(
    screen: T,
    params?: RootStackParamList[T]
  ) => void;
};

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

// Firecracker Component for Home Screen
const Firecracker: React.FC<{ 
  firecracker: { 
    id: string; 
    x: number; 
    y: number; 
    scale: number;
    delay: number;
  }; 
  visible: boolean 
}> = React.memo(({ firecracker, visible }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      const animation = Animated.sequence([
        Animated.delay(firecracker.delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        })
      ]);
      
      const loop = Animated.loop(animation);
      loop.start();
      
      return () => loop.stop();
    }
  }, [visible, anim, firecracker.delay]);

  return (
    <Animated.View
      style={[
        styles.firecracker,
        {
          left: firecracker.x,
          top: firecracker.y,
          transform: [
            { scale: firecracker.scale },
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1]
              })
            }
          ],
          opacity: anim
        }
      ]}
    >
      <Icon name="sparkles" size={moderateScale(16)} color={COLORS.diwaliSparkle} />
    </Animated.View>
  );
});

// Separate Firework component that properly uses hooks
const Firework: React.FC<{ firework: { id: string; x: number; y: number; scale: number }; visible: boolean }> = React.memo(({ firework, visible }) => {
  const fireworkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(fireworkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(fireworkAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, fireworkAnim]);

  return (
    <Animated.View
      style={[
        styles.firework,
        {
          left: firework.x,
          top: firework.y,
          transform: [
            { scale: firework.scale },
            {
              scale: fireworkAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1]
              })
            }
          ],
          opacity: fireworkAnim
        }
      ]}
    >
      <Icon name="sparkles" size={moderateScale(24)} color={COLORS.diwaliGold} />
    </Animated.View>
  );
});

// Diwali Timer Component for Home Screen
const DiwaliTimer: React.FC<{ onPress: () => void }> = React.memo(({ onPress }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const [firecrackers, setFirecrackers] = useState<Array<{
    id: string;
    x: number;
    y: number;
    scale: number;
    delay: number;
  }>>([]);

  useEffect(() => {
      const calculateTimeLeft = () => {
        const diwaliDate = new Date(Date.UTC(2025, 9, 18, 0, 0, 0));
        const diwaliIST = new Date(diwaliDate.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
        const now = new Date();
        const difference = diwaliIST.getTime() - now.getTime();
  
        if (difference > 0) {
          setTimeLeft({
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((difference % (1000 * 60)) / 1000)
          });
        } else {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        }
      };
  
      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);
      return () => clearInterval(timer);
    }, []);

  const TimerItem: React.FC<{ value: number; label: string }> = ({ value, label }) => (
    <View style={styles.timerItem}>
      <View style={styles.timerValueContainer}>
        <Text style={styles.timerValue}>
          {value.toString().padStart(2, '0')}
        </Text>
      </View>
      <Text style={styles.timerLabel}>{label}</Text>
    </View>
  );

  return (
    <TouchableOpacity 
      style={styles.diwaliTimerContainer} 
      activeOpacity={0.9}
      onPress={onPress}
    >
      <LinearGradient
        colors={[COLORS.diwaliOrange, COLORS.diwaliRed, COLORS.diwaliDeepOrange]}
        style={styles.diwaliTimerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Firecrackers Background */}
        {firecrackers.map((firecracker) => (
          <Firecracker key={firecracker.id} firecracker={firecracker} visible={true} />
        ))}

        {/* Left Side - Icon and Text */}
        <View style={styles.timerLeftContent}>
          <View style={styles.timerIconContainer}>
            <Icon name="sparkles" size={moderateScale(20)} color={COLORS.diwaliGold} />
          </View>
          <View style={styles.timerTextContainer}>
            <Text style={styles.timerTitle}>Diwali Offers</Text>
            <Text style={styles.timerSubtitle}>Starting in</Text>
          </View>
        </View>

        {/* Right Side - Countdown */}
        <View style={styles.timerRightContent}>
          <TimerItem value={timeLeft.days} label="Days" />
          <Text style={styles.timerColon}>:</Text>
          <TimerItem value={timeLeft.hours} label="Hours" />
          <Text style={styles.timerColon}>:</Text>
          <TimerItem value={timeLeft.minutes} label="Mins" />
          <Text style={styles.timerColon}>:</Text>
          <TimerItem value={timeLeft.seconds} label="Secs" />
        </View>

        {/* Tap Indicator */}
        <View style={styles.tapIndicator}>
          <Icon name="chevron-forward" size={moderateScale(16)} color="rgba(255,255,255,0.8)" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// Enhanced Diwali Popup Component with bottom slide animation
interface DiwaliPopupProps {
  visible: boolean;
  onClose: () => void;
}

const DiwaliPopup: React.FC<DiwaliPopupProps> = React.memo(({ visible, onClose }) => {
  const [fireworks, setFireworks] = useState<Array<{id: string; x: number; y: number; scale: number}>>([]);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  
  const slideAnim = useRef(new Animated.Value(height)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const contentScaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Create fireworks
      const newFireworks = Array.from({ length: 15 }, (_, i) => ({
        id: `firework-${i}`,
        x: Math.random() * width,
        y: Math.random() * height,
        scale: Math.random() * 1.2 + 0.8
      }));
      setFireworks(newFireworks);

      // Calculate time until Diwali
      const calculateTimeLeft = () => {
      const diwaliDate = new Date(Date.UTC(2025, 9, 18, 0, 0, 0));
      const diwaliIST = new Date(diwaliDate.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
      const now = new Date();
      const difference = diwaliIST.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);

      // Slide up animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(contentScaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      ]).start();

      return () => clearInterval(timer);
    } else {
      // Slide down animation
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentScaleAnim, {
          toValue: 0.9,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        setFireworks([]);
      });
    }
  }, [visible, slideAnim, opacityAnim, contentScaleAnim]);

  const handleClose = () => {
    onClose();
  };

  const TimerItem: React.FC<{ value: number; label: string }> = ({ value, label }) => (
    <View style={styles.popupTimerItem}>
      <View style={styles.popupTimerValueContainer}>
        <Text style={styles.popupTimerValue}>
          {value.toString().padStart(2, '0')}
        </Text>
      </View>
      <Text style={styles.popupTimerLabel}>{label}</Text>
    </View>
  );

  return (
    <Modal
  visible={visible}
  transparent={true}
  animationType="none"
  onRequestClose={handleClose}
  statusBarTranslucent={true}
>
  <Animated.View 
    style={[
      styles.diwaliModalOverlay,
      { opacity: opacityAnim }
    ]}
  >
    {/* Enhanced Fireworks Background */}
    {fireworks.map((firework) => (
      <Firework key={firework.id} firework={firework} visible={visible} />
    ))}
    
    {/* Backdrop Touch Area */}
    <TouchableOpacity 
      style={styles.backdropTouchable}
      activeOpacity={1}
      onPress={handleClose}
    />
    
    {/* Main Modal Content */}
    <Animated.View 
      style={[
        styles.diwaliModalContainerBottom,
        {
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      {/* Pull Handle Bar */}
      <View style={styles.pullHandleBar} />
      
      <Animated.View
        style={[
          styles.diwaliModalContent,
          {
            transform: [{ scale: contentScaleAnim }]
          }
        ]}
      >
        {/* Close Button */}
        <TouchableOpacity 
          style={styles.diwaliCloseButton}
          onPress={handleClose}
        >
          <Icon name="close" size={moderateScale(20)} color={COLORS.textDark} />
        </TouchableOpacity>

        {/* Header with Animated Diya */}
        <View style={styles.diwaliHeader}>
          <View style={[styles.diyaContainer, styles.diyaLeft]}>
            <View style={styles.diyaBase}>
              <View style={[styles.diyaFlame, styles.flameAnimation]} />
            </View>
          </View>
          
          <Text style={styles.diwaliTitle}>Happy Diwali! 🪔</Text>
          
          <View style={[styles.diyaContainer, styles.diyaRight]}>
            <View style={styles.diyaBase}>
              <View style={[styles.diyaFlame, styles.flameAnimation]} />
            </View>
          </View>
        </View>

        {/* Content with ScrollView */}
        <ScrollView 
          style={styles.contentScrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Content */}
          <View style={styles.diwaliContent}>
            <Text style={styles.diwaliSubtitle}>Diwali Coming Soon!</Text>
            <Text style={styles.diwaliMessage}>
              Get ready for the festival of lights with{'\n'}
              exclusive offers and delicious festive specials
            </Text>
            
            {/* Enhanced Countdown Timer */}
            <View style={styles.popupCountdownContainer}>
              <Text style={styles.popupCountdownText}>Festival starts in</Text>
              <View style={styles.popupCountdownTimer}>
                <TimerItem value={timeLeft.days} label="Days" />
                <Text style={styles.popupTimerColon}>:</Text>
                <TimerItem value={timeLeft.hours} label="Hours" />
                <Text style={styles.popupTimerColon}>:</Text>
                <TimerItem value={timeLeft.minutes} label="Minutes" />
                <Text style={styles.popupTimerColon}>:</Text>
                <TimerItem value={timeLeft.seconds} label="Seconds" />
              </View>
            </View>

            {/* Enhanced Offer Highlights */}
            <View style={styles.popupOfferHighlights}>
              <View style={styles.popupOfferItem}>
                <View style={styles.popupOfferIcon}>
                  <Icon name="flash" size={moderateScale(24)} color={COLORS.diwaliGold} />
                </View>
                <View style={styles.offerTextContainer}>
                  <Text style={styles.popupOfferTitle}>Upto 50% OFF</Text>
                  <Text style={styles.popupOfferDesc}>On all orders</Text>
                </View>
              </View>
              
              <View style={styles.popupOfferItem}>
                <View style={styles.popupOfferIcon}>
                  <Icon name="gift" size={moderateScale(24)} color={COLORS.diwaliGold} />
                </View>
                <View style={styles.offerTextContainer}>
                  <Text style={styles.popupOfferTitle}>Free Delivery</Text>
                  <Text style={styles.popupOfferDesc}>No minimum order</Text>
                </View>
              </View>
              
              <View style={styles.popupOfferItem}>
                <View style={styles.popupOfferIcon}>
                  <Icon name="star" size={moderateScale(24)} color={COLORS.diwaliGold} />
                </View>
                <View style={styles.offerTextContainer}>
                  <Text style={styles.popupOfferTitle}>Free Traditional Sweets</Text>
                  <Text style={styles.popupOfferDesc}>On all orders</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Enhanced Action Button */}
        <TouchableOpacity 
          style={styles.diwaliButton}
          onPress={handleClose}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[COLORS.diwaliGold, COLORS.diwaliOrange, COLORS.diwaliRed]}
            style={styles.diwaliButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.buttonContent}>
              <Icon name="notifications" size={moderateScale(20)} color="#FFF" />
              <Text style={styles.diwaliButtonText}>Get Notified</Text>
              <Icon name="chevron-forward" size={moderateScale(16)} color="#FFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Enhanced Decorative Elements */}
      <View style={styles.decorativeTopLeft}>
        <Icon name="sparkles" size={moderateScale(24)} color={COLORS.diwaliGold} />
      </View>
      <View style={styles.decorativeTopRight}>
        <Icon name="sparkles" size={moderateScale(24)} color={COLORS.diwaliGold} />
      </View>
      <View style={styles.decorativeBottomLeft}>
        <Icon name="flower" size={moderateScale(18)} color={COLORS.diwaliOrange} />
      </View>
      <View style={styles.decorativeBottomRight}>
        <Icon name="flower" size={moderateScale(18)} color={COLORS.diwaliOrange} />
      </View>
    </Animated.View>
  </Animated.View>
</Modal>
  );
});

// Enhanced Search Input Component
interface SearchInputProps {
  onPress: () => void;
  placeholder: string;
  animatedValue?: Animated.Value;
}

const SearchInput: React.FC<SearchInputProps> = React.memo(({ onPress, placeholder, animatedValue }) => {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [pulseAnim]);

  return (
    <Animated.View 
      style={[
        styles.searchInputContainer,
        animatedValue && {
          transform: [{
            scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.98],
            }),
          }],
          opacity: animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.9],
          }),
        },
        {
          transform: [{ scale: pulseAnim }],
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.searchInputTouchable}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.searchInputContent}>
          <Icon 
            name="search" 
            size={moderateScale(22)} 
            color={COLORS.searchPlaceholder} 
            style={styles.searchIcon} 
          />
          <View style={styles.searchTextContainer}>
            <Text style={styles.searchPlaceholderText} numberOfLines={1}>
              {placeholder}
            </Text>
          </View>
          <View style={styles.searchRightIcon}>
            <Icon 
              name="mic-outline" 
              size={moderateScale(20)} 
              color={COLORS.searchPlaceholder} 
            />
          </View>
        </View>
        
        <View style={styles.searchShimmer} />
      </TouchableOpacity>
    </Animated.View>
  );
});

// Enhanced Kitchen Card Component for Side-by-Side Layout
interface KitchenCardProps {
  kitchen: Kitchen;
  onPress: (kitchen: Kitchen) => void;
  onToggleFavorite: (kitchenId: string) => void;
  favoriteLoading: string | null;
  isFeatured?: boolean;
  cardStyle?: 'compact' | 'detailed' | 'sideBySide';
  cardWidth?: number;
}

const KitchenCard: React.FC<KitchenCardProps> = React.memo(({ 
  kitchen, 
  onPress, 
  onToggleFavorite, 
  favoriteLoading,
  isFeatured = false,
  cardStyle = 'sideBySide',
  cardWidth
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const rating = kitchen.rating || (Math.random() * 1 + 4).toFixed(1);
  const deliveryTime = kitchen.delivery_time || '30-40 min';
  const cuisines = kitchen.item_cuisines ? kitchen.item_cuisines.split(', ').slice(0, 2) : [];
  const discount = kitchen.discount || Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0;
  const isNew = kitchen.is_new || Math.random() > 0.8;
  const isTrending = kitchen.is_trending || Math.random() > 0.9;

  const renderBadges = () => {
    const badges = [];
    
    if (isFeatured) {
      badges.push(
        <View key="featured" style={[styles.badge, styles.featuredBadge]}>
          <Icon name="flash" size={moderateScale(10)} color="#FFF" />
          <Text style={styles.badgeText}>Featured</Text>
        </View>
      );
    }
    
    if (isNew) {
      badges.push(
        <View key="new" style={[styles.badge, styles.newBadge]}>
          <Text style={styles.badgeText}>New</Text>
        </View>
      );
    }
    
    if (isTrending) {
      badges.push(
        <View key="trending" style={[styles.badge, styles.trendingBadge]}>
          <Icon name="trending-up" size={moderateScale(10)} color="#FFF" />
          <Text style={styles.badgeText}>Trending</Text>
        </View>
      );
    }
    
    if (discount > 0) {
      badges.push(
        <View key="discount" style={[styles.badge, styles.discountBadge]}>
          <Text style={styles.badgeText}>{discount}% OFF</Text>
        </View>
      );
    }

    return badges.slice(0, 2);
  };

  // Side by side layout for recommended section
  if (cardStyle === 'sideBySide') {
    return (
      <Animated.View
        style={[
          styles.kitchenCardSideBySide,
          cardWidth ? { width: cardWidth } : {},
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <TouchableOpacity
          onPress={() => onPress(kitchen)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          style={styles.kitchenCardTouchable}
        >
          <View style={styles.kitchenImageContainerSideBySide}>
            {!imageLoaded && (
              <View style={[styles.kitchenImageSideBySide, styles.imagePlaceholder]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            )}
            
            {imageError || !kitchen.restaurant_image ? (
              <View style={[styles.kitchenImageSideBySide, styles.imagePlaceholder]}>
                <Icon name="restaurant-outline" size={moderateScale(30)} color={COLORS.textLight} />
              </View>
            ) : (
              <Animated.Image 
                source={{ uri: kitchen.restaurant_image }} 
                style={[
                  styles.kitchenImageSideBySide,
                  { opacity: opacityAnim }
                ]}
                resizeMode="cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
            
            <View style={styles.badgeContainerSideBySide}>
              {renderBadges()}
            </View>
            
            <TouchableOpacity 
              style={styles.favoriteButtonSideBySide}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFavorite(kitchen.restaurant_id);
              }}
              disabled={favoriteLoading === kitchen.restaurant_id}
            >
              {favoriteLoading === kitchen.restaurant_id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon 
                  name={kitchen.is_favourite ? "heart" : "heart-outline"} 
                  size={moderateScale(16)} 
                  color={kitchen.is_favourite ? COLORS.danger : "#fff"} 
                />
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.kitchenContentSideBySide}>
            <Text style={styles.kitchenNameSideBySide} numberOfLines={1}>
              {kitchen.restaurant_name}
            </Text>
            
            <View style={styles.ratingContainerSideBySide}>
              <Icon name="star" size={moderateScale(12)} color={COLORS.rating} />
              <Text style={styles.ratingTextSideBySide}>{rating}</Text>
              <Text style={styles.deliveryTimeSideBySide}>• {deliveryTime}</Text>
            </View>
            
            <Text style={styles.kitchenCuisineSideBySide} numberOfLines={1}>
              {cuisines.join(' • ')}
            </Text>
            
            <Text style={styles.priceTextSideBySide}>
              ₹{kitchen.avg_price_range || '200'} for one
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // Detailed card for regular list view
  return (
    <Animated.View
      style={[
        styles.kitchenCardDetailed,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <TouchableOpacity
        onPress={() => onPress(kitchen)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.kitchenCardTouchable}
      >
        <View style={styles.kitchenImageContainerDetailed}>
          {!imageLoaded && (
            <View style={[styles.kitchenImageDetailed, styles.imagePlaceholder]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          )}
          
          {imageError || !kitchen.restaurant_image ? (
            <View style={[styles.kitchenImageDetailed, styles.imagePlaceholder]}>
              <Icon name="restaurant-outline" size={moderateScale(40)} color={COLORS.textLight} />
            </View>
          ) : (
            <Animated.Image 
              source={{ uri: kitchen.restaurant_image }} 
              style={[
                styles.kitchenImageDetailed,
                { opacity: opacityAnim }
              ]}
              resizeMode="cover"
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageGradient}
          />
          
          <View style={styles.badgeContainer}>
            {renderBadges()}
          </View>
          
          <TouchableOpacity 
            style={styles.favoriteButtonDetailed}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(kitchen.restaurant_id);
            }}
            disabled={favoriteLoading === kitchen.restaurant_id}
          >
            {favoriteLoading === kitchen.restaurant_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon 
                name={kitchen.is_favourite ? "heart" : "heart-outline"} 
                size={moderateScale(20)} 
                color={kitchen.is_favourite ? COLORS.danger : "#fff"} 
              />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.kitchenContentDetailed}>
          <View style={styles.kitchenHeader}>
            <Text style={styles.kitchenNameDetailed} numberOfLines={1}>
              {kitchen.restaurant_name}
            </Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={moderateScale(14)} color={COLORS.rating} />
              <Text style={styles.ratingTextDetailed}>{rating}</Text>
            </View>
          </View>
          
          <Text style={styles.kitchenCuisineDetailed} numberOfLines={1}>
            {cuisines.join(' • ')}
          </Text>
          
          <View style={styles.kitchenFooter}>
            <View style={styles.deliveryInfo}>
              <Icon name="time-outline" size={moderateScale(14)} color={COLORS.textMedium} />
              <Text style={styles.deliveryText}>{deliveryTime}</Text>
            </View>
            
            <View style={styles.priceInfo}>
              <Text style={styles.priceText}>
                ₹{kitchen.avg_price_range || '200'} for one
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const KitchenScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
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
  
  
  // Diwali Popup State
  const [showDiwaliPopup, setShowDiwaliPopup] = useState(false);
  const [diwaliPopupShown, setDiwaliPopupShown] = useState(false);
  
  // Scroll animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const placeholderAnim = useRef(new Animated.Value(0)).current;
  const modalSlideAnim = useRef(new Animated.Value(0)).current;
  const modalOpacityAnim = useRef(new Animated.Value(0)).current;

  // Calculate card width for side-by-side layout
  const sideBySideCardWidth = useMemo(() => {
    const screenPadding = scale(16);
    const gap = scale(8);
    return (width - screenPadding * 2 - gap) / RECOMMENDED_KITCHENS_PER_ROW;
  }, [width]);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Scroll animation for sticky search and compact categories
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [160, 80],
    extrapolate: 'clamp',
  });

  const searchOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Check and show Diwali popup
  const checkAndShowDiwaliPopup = useCallback(async () => {
    try {
      const popupShown = await AsyncStorage.getItem('diwali_popup_shown');
      if (!popupShown && !diwaliPopupShown) {
        // Wait a bit for the main content to load
        setTimeout(() => {
          setShowDiwaliPopup(true);
          setDiwaliPopupShown(true);
          AsyncStorage.setItem('diwali_popup_shown', 'true');
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking Diwali popup status:', error);
    }
  }, [diwaliPopupShown]);

  // Enhanced placeholder animation
  useEffect(() => {
    const animatePlaceholder = () => {
      Animated.timing(placeholderAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        placeholderAnim.setValue(0);
      });
    };

    const interval = setInterval(() => {
      setCurrentPlaceholderIndex(prev => {
        animatePlaceholder();
        return (prev + 1) % SEARCH_PLACEHOLDERS.length;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [placeholderAnim]);

  // Fixed Modal animation - Shadow first, then modal
  useEffect(() => {
    if (isSearchModalVisible) {
      // First show the shadow/overlay
      Animated.timing(modalOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        // Then slide in the modal
        Animated.timing(modalSlideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // First slide out the modal
      Animated.timing(modalSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        // Then hide the shadow/overlay
        Animated.timing(modalOpacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isSearchModalVisible, modalSlideAnim, modalOpacityAnim]);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData) as User;
        setUser(parsedUser);
        return parsedUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  // Fetch recent searches and search history
  const fetchRecentSearches = useCallback(async () => {
    try {
      const [recent, history] = await Promise.all([
        AsyncStorage.getItem('recentSearches'),
        AsyncStorage.getItem('searchHistory')
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
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));

      if (item) {
        const updatedHistory = [
          { ...item, searchedAt: new Date().toISOString() },
          ...searchHistory.filter(hist => hist.id !== item.id)
        ].slice(0, 10);
        
        setSearchHistory(updatedHistory);
        await AsyncStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('Error saving search data:', error);
    }
  }, [recentSearches, searchHistory]);

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
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
      setPastKitchenDetails(details);
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);
  
  const fetchPastKitchenDetails = useCallback(async (userId: string) => {
    try {
      const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');
      if (storedDetails != null) {
        setPastKitchenDetails(JSON.parse(storedDetails));
        return;
      }

      const payload = { session_id: null, user_id: userId };
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

  // Fetch kitchens with enhanced data
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
              is_trending: Math.random() > 0.9
            })),
            KitchenList: response.data.data.KitchenList.map(k => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false,
              rating: (Math.random() * 1 + 4).toFixed(1),
              delivery_time: `${Math.floor(Math.random() * 15) + 20}-${Math.floor(Math.random() * 20) + 35} min`,
              discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0,
              is_new: Math.random() > 0.8,
              is_trending: Math.random() > 0.9
            }))
          }
        };
        
        setApiData(processedData);
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

  // Initial data loading
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const user = await fetchUserData();
        if (user && isMounted) {
          await Promise.all([
            fetchKitchens(),
            fetchActiveOrders(user.id),
            fetchPastKitchenDetails(user.id),
            fetchRecentSearches()
          ]);
        } else {
          await fetchKitchens();
          await fetchRecentSearches();
        }
        
        // Check and show Diwali popup after data loads
        if (isMounted) {
          checkAndShowDiwaliPopup();
        }
      } catch (error) {
        console.error('Initial data loading error:', error);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchKitchens, fetchPastKitchenDetails, fetchUserData, fetchActiveOrders, fetchRecentSearches, checkAndShowDiwaliPopup]);

  // Search effect
  useEffect(() => {
    if (debouncedSearchQuery && isSearchModalVisible) {
      fetchSearchSuggestions(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0 && isSearchModalVisible) {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, isSearchModalVisible, fetchSearchSuggestions]);

  // Refresh control
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const user = await fetchUserData();
      if (user) {
        await Promise.all([
          fetchKitchens(),
          fetchActiveOrders(user.id),
          fetchPastKitchenDetails(user.id)
        ]);
      } else {
        await fetchKitchens();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchKitchens, fetchActiveOrders, fetchPastKitchenDetails, fetchUserData]);

  // Enhanced Search handlers with fixed animation sequence
  const openSearchModal = useCallback(() => {
    setIsSearchModalVisible(true);
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [searchAnim]);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchSuggestionsData(null);
    Animated.timing(searchAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [searchAnim]);

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
        });
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
        kitchenId: item.originalData?.restaurant_id || item.id.replace('restaurant-', '')
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
  }, [closeSearchModal, navigation, saveToRecentSearches, searchSuggestionsData]);

  const clearRecentSearches = useCallback(async () => {
    try {
      setRecentSearches([]);
      setSearchHistory([]);
      await AsyncStorage.removeItem('recentSearches');
      await AsyncStorage.removeItem('searchHistory');
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  // Diwali popup handlers
  const handleDiwaliPopupClose = useCallback(() => {
    setShowDiwaliPopup(false);
  }, []);

  const handleDiwaliTimerPress = useCallback(() => {
    setShowDiwaliPopup(true);
  }, []);

  // Order handlers
  const handleOrderPress = useCallback((order: ActiveOrder) => {
    navigation.navigate('TrackOrder', { order: { order_number: order.orderNumber } });
  }, [navigation]);

  const handleViewAllOrders = useCallback(() => {
    navigation.navigate('ActiveOrders', { orders: activeOrders });
  }, [navigation, activeOrders]);

  const toggleShowAllActiveOrders = useCallback(() => {
    setShowAllActiveOrders(prev => !prev);
  }, []);

  // Filters
  const [filters, setFilters] = useState<Filter[]>(useMemo(() => [
    { id: '1', name: 'Rating 4.0+', icon: 'star', type: 'rating', active: false },
    { id: '2', name: 'Pure Veg', icon: 'leaf', type: 'veg', active: false },
    { id: '3', name: 'Offers', icon: 'pricetag', type: 'offer', active: false },
    { id: '4', name: 'Fast Delivery', icon: 'rocket', type: 'fastDelivery', active: false },
  ], []));

  // Filtered kitchens
  const filteredKitchens = useMemo(() => {
    if (!apiData) return [];
    let result = [...apiData.data.KitchenList];
    
    if (activeCategory !== null && apiData.data.CategoryList[activeCategory]) {
      const categoryName = apiData.data.CategoryList[activeCategory].name;
      result = result.filter(kitchen => 
        kitchen.item_cuisines?.toLowerCase().includes(categoryName.toLowerCase())
      );
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(kitchen =>
        kitchen.restaurant_name.toLowerCase().includes(query) ||
        kitchen.item_cuisines.toLowerCase().includes(query) ||
        kitchen.restaurant_location.toLowerCase().includes(query)
      );
    }
    
    filters.forEach(filter => {
      if (filter.active) {
        switch (filter.type) {
          case 'rating':
            result = result.filter(kitchen => parseFloat(kitchen.rating || '0') >= 4);
            break;
          case 'veg':
            result = result.filter(kitchen => kitchen.item_cuisines.toLowerCase().includes('veg'));
            break;
          case 'offer':
            result = result.filter(kitchen => (kitchen.discount || 0) > 0);
            break;
          case 'fastDelivery':
            result = result.filter(kitchen => kitchen.restaurant_status === 1);
            break;
        }
      }
    });
    
    return result;
  }, [apiData, searchQuery, activeCategory, filters]);

  // UPDATED: Category press handler with navigation
  const handleCategoryPress = useCallback((categoryId: number, categoryName: string) => {
    navigation.navigate('HomeKitchenNavigate', {
      screen: 'CategoryResults',
      params: { 
        query: categoryName,
      } 
    });
  }, [navigation]);

  const handleFilterPress = useCallback((filterId: string) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, active: !filter.active } : filter
    ));
  }, []);

  const handleKitchenPress = useCallback((kitchen: Kitchen) => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchen.restaurant_id });
  }, [navigation]);

  const toggleFavorite = useCallback(async (kitchenId: string) => {
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
      await updateFavouriteKitchen({ restaurant_id: kitchenId });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status. Please try again.');
    } finally {
      setFavoriteLoading(null);
    }
  }, [favoriteLoading]);

  const BackToKitchen = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('HomeKitchenDetails', { kitchenId: pastKitchenDetails.id });
    }
  }, [navigation, pastKitchenDetails]);

  const handleViewCart = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('CartScreen', { pastkitcheId: pastKitchenDetails.id });
    }
  }, [navigation, pastKitchenDetails]);

  const handleRemoveRecentSearch = (query: string) => {
    setRecentSearches(prev => prev.filter(item => item !== query));
  }

  // Render functions for main content
  // UPDATED: Category renderer with circular images
  const renderCategory = useCallback(({ item, index }: { item: Category, index: number }) => (
    <TouchableOpacity 
      style={[
        styles.categoryCard,
        activeCategory === index && styles.activeCategoryCard
      ]} 
      activeOpacity={0.8}
      onPress={() => handleCategoryPress(index, item.name)}
    >
      <Animated.View
        style={[
          styles.categoryIconContainer,
          activeCategory === index && styles.activeCategoryIconContainer
        ]}
      >
        <Image 
          source={{ uri: item.icon || DEFAULT_CATEGORY_ICON }} 
          style={styles.categoryImage} 
          resizeMode="cover"
          defaultSource={{ uri: DEFAULT_CATEGORY_ICON }}
        />
      </Animated.View>
      <Text style={[
        styles.categoryName,
        activeCategory === index && styles.activeCategoryName
      ]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [activeCategory, handleCategoryPress]);

  const renderFilter = useCallback(({ item }: { item: Filter }) => (
    <TouchableOpacity 
      style={[
        styles.filterCard,
        item.active && styles.activeFilterCard
      ]}
      onPress={() => handleFilterPress(item.id)}
      activeOpacity={0.7}
    >
      <Icon 
        name={item.icon} 
        size={moderateScale(16)} 
        color={item.active ? '#fff' : COLORS.textMedium} 
      />
      <Text style={[
        styles.filterText,
        item.active && styles.activeFilterText
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [handleFilterPress]);

  // Kitchen item renderer - only detailed layout now
  const renderKitchenItem = useCallback(({ item }: { item: Kitchen }) => {
    return (
      <KitchenCard
        kitchen={item}
        onPress={handleKitchenPress}
        onToggleFavorite={toggleFavorite}
        favoriteLoading={favoriteLoading}
        cardStyle="detailed"
      />
    );
  }, [handleKitchenPress, toggleFavorite, favoriteLoading]);

  // Side by side kitchen item renderer for recommended section - Now in horizontal FlatList
  const renderSideBySideKitchenItem = useCallback(({ item }: { item: Kitchen }) => {
    return (
      <KitchenCard
        kitchen={item}
        onPress={handleKitchenPress}
        onToggleFavorite={toggleFavorite}
        favoriteLoading={favoriteLoading}
        cardStyle="sideBySide"
        cardWidth={sideBySideCardWidth}
      />
    );
  }, [handleKitchenPress, toggleFavorite, favoriteLoading, sideBySideCardWidth]);

  // Active order footer item
  const renderActiveOrderFooterItem = useCallback((order: ActiveOrder) => {
    const statusColors = {
      'preparing': { bg: '#FEF3C7', text: '#92400E', icon: 'time-outline' },
      'on-the-way': { bg: '#DBEAFE', text: '#1E40AF', icon: 'bicycle-outline' },
      'delivered': { bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-done-outline' },
      'cancelled': { bg: '#FEE2E2', text: '#B91C1C', icon: 'close-circle-outline' },
    };

    const statusColor = statusColors[order.status] || statusColors.preparing;
    const isCancelled = order.status === 'cancelled';

    return (
      <TouchableOpacity
        key={order.id}
        style={styles.activeOrderFooterItem}
        onPress={() => handleOrderPress(order)}
        activeOpacity={0.9}
      >
        <View style={styles.activeOrderFooterContent}>
          <Image 
            source={{ uri: order.kitchenImage || 'https://via.placeholder.com/50' }} 
            style={styles.activeOrderFooterImage}
          />
          <View style={styles.activeOrderFooterDetails}>
            <Text style={styles.activeOrderFooterKitchen} numberOfLines={1}>
              {order.kitchenName}
            </Text>
            <View style={styles.activeOrderFooterStatus}>
              <Icon 
                name={statusColor.icon} 
                size={moderateScale(14)} 
                color={statusColor.text} 
              />
              <Text style={[styles.activeOrderFooterStatusText, { color: statusColor.text }]}>
                {order.statusText}
              </Text>
            </View>
          </View>
          {!isCancelled && (
            <TouchableOpacity 
              style={[styles.activeOrderFooterTimeButton, { backgroundColor: statusColor.bg }]}
              onPress={() => handleOrderPress(order)}
            >
              <View style={styles.activeOrderFooterTime}>
                <Text style={[styles.activeOrderFooterTimeLabel, { color: statusColor.text }]}>
                  Arriving in
                </Text>
                <Text style={[styles.activeOrderFooterTimeText, { color: statusColor.text }]}>
                  {order.estimatedArrival}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleOrderPress]);

  const displayedActiveOrders = showAllActiveOrders ? activeOrders : activeOrders.slice(0, ACTIVE_ORDERS_LIMIT);

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!apiData) {
    return (
      <SafeAreaView style={[styles.container, styles.emptyContainer]}>
        <Icon name="alert-circle-outline" size={moderateScale(60)} color={COLORS.textLight} />
        <Text style={styles.emptyText}>No data available</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchKitchens}
          activeOpacity={0.7}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Diwali Popup Modal */}
      <DiwaliPopup 
        visible={showDiwaliPopup}
        onClose={handleDiwaliPopupClose}
      />

      {/* Search Modal */}
      {isSearchModalVisible && (
        <Animated.View 
          style={[
            styles.searchModalOverlay,
            {
              opacity: modalOpacityAnim,
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.searchModalContainer,
              {
                transform: [{
                  translateY: modalSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [height, 0],
                  }),
                }],
              }
            ]}
          >
            <SearchModal
              isVisible={isSearchModalVisible}
              onClose={closeSearchModal}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onSearchSubmit={handleSearchSubmit}
              recentSearches={recentSearches}
              searchHistory={searchHistory}
              searchResults={searchResults}
              searchLoading={searchLoading}
              onRecentSearchPress={handleRecentSearchPress}
              onPopularSearchPress={handlePopularSearchPress}
              onSearchResultPress={handleSearchResultPress}
              onClearRecentSearches={clearRecentSearches}
              searchInputRef={searchInputRef}
              onRemoveRecentSearch={handleRemoveRecentSearch}
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* Active Orders Footer */}
      {activeOrders.length > 0 && !ordersLoading && (
        <View style={styles.activeOrdersFooter}>
          {displayedActiveOrders.map((order, index) => (
            <React.Fragment key={order.id}>
              {renderActiveOrderFooterItem(order)}
              {index < displayedActiveOrders.length - 1 && (
                <View style={styles.orderDivider} />
              )}
            </React.Fragment>
          ))}
          
          {activeOrders.length > ACTIVE_ORDERS_LIMIT && (
            <TouchableOpacity 
              style={styles.activeOrdersFooterSeeAll}
              onPress={toggleShowAllActiveOrders}
            >
              <Text style={styles.activeOrdersFooterSeeAllText}>
                {showAllActiveOrders ? 'Show less' : `View all ${activeOrders.length} active orders`}
              </Text>
              <Icon 
                name={showAllActiveOrders ? "chevron-up" : "chevron-down"} 
                size={moderateScale(16)} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Sticky Search Bar */}
      <Animated.View style={[styles.stickySearchContainer, { opacity: searchOpacity }]}>
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientMiddle, COLORS.gradientEnd]}
          style={styles.stickySearchGradient}
        >
          <SearchInput
            onPress={openSearchModal}
            placeholder={SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
          />
        </LinearGradient>
      </Animated.View>

      {/* Main ScrollView */}
      <Animated.ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.refreshControl]}
            tintColor={COLORS.refreshControl}
          />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Enhanced Header Section - Scrolls with content */}
        <Animated.View style={[styles.headerContainer, { height: headerHeight + 25 }]}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.gradientMiddle, COLORS.gradientEnd]}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {/* Main Search - Hidden when scrolling */}
            <Animated.View 
              style={[
                styles.searchContainer,
                { 
                  opacity: scrollY.interpolate({
                    inputRange: [0, 50],
                    outputRange: [1, 0],
                    extrapolate: 'clamp',
                  }) 
                }
              ]}
            >
              <SearchInput
                onPress={openSearchModal}
                placeholder={SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
                animatedValue={placeholderAnim}
              />
            </Animated.View>

            {/* Diwali Timer - Above Categories */}
            <Animated.View style={styles.diwaliTimerWrapper}>
              <DiwaliTimer onPress={handleDiwaliTimerPress} />
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Categories Section - MOVED TO BODY */}
          {apiData?.data?.CategoryList && apiData.data.CategoryList.length > 0 && (
            <View style={styles.categoriesSection}>
              <FlatList
                horizontal
                data={apiData.data.CategoryList}
                renderItem={renderCategory}
                keyExtractor={(item) => item.id.toString()}
                showsHorizontalScrollIndicator={false}
                snapToInterval={scale(80)}
                decelerationRate="fast"
              />
            </View>
          )}

          {/* Quick Filters */}
          <View style={styles.sectionContainer}>
            <FlatList
              horizontal
              data={filters}
              renderItem={renderFilter}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            />
          </View>

          {/* Featured Kitchens - Horizontal Side by Side Layout */}
          {apiData?.data?.FeatureKitchenList?.length > 0 && (
            <View style={styles.featuredSectionContainer}>
              <Text style={styles.sectionTitle}>RECOMMENDED FOR YOU</Text>
              <FlatList
                horizontal
                data={apiData.data.FeatureKitchenList}
                renderItem={renderSideBySideKitchenItem}
                keyExtractor={(item) => item.restaurant_id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendedListContainer}
                snapToInterval={sideBySideCardWidth + scale(8)}
                decelerationRate="fast"
              />
            </View>
          )}

          {/* All Kitchens - Detailed Layout (One below one) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>DISCOVER KITCHENS NEAR YOU</Text>
            {filteredKitchens.length === 0 ? (
              <View style={styles.emptyResultContainer}>
                <Icon name="restaurant-outline" size={moderateScale(60)} color={COLORS.textLight} />
                <Text style={styles.emptyText}>No restaurants found</Text>
                <Text style={styles.emptySubText}>Try adjusting your filters or search</Text>
              </View>
            ) : (
              <FlatList
                data={filteredKitchens}
                renderItem={renderKitchenItem}
                keyExtractor={(item) => item.restaurant_id}
                scrollEnabled={false}
                contentContainerStyle={styles.kitchenList}
              />
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Cart Summary */}
      {pastKitchenDetails && activeOrders.length === 0 && (
        <View style={styles.cartSummaryContainer}>
          <View style={styles.cartSummaryHeader}>
            <View style={styles.cartSummaryKitchenInfo}>
              <Image 
                source={{ uri: pastKitchenDetails.image }} 
                style={styles.cartSummaryKitchenImage}
              />
              <View>
                <Text style={styles.cartSummaryKitchenName} numberOfLines={1}>
                  {pastKitchenDetails.name}
                </Text>
                <TouchableOpacity 
                  onPress={BackToKitchen}
                  style={styles.cartSummaryViewMenuBtn}
                >
                  <Text style={styles.cartSummaryViewMenuText}>View Menu</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.cartSummaryMiniCartBtn}
              onPress={handleViewCart}
              activeOpacity={0.9}
            >
              <Text style={styles.cartSummaryViewCartText}>View Cart</Text>
              <View style={styles.cartSummaryCartCountBadge}>
                <Text style={styles.cartSummaryMiniCartCount}>{pastKitchenDetails.itemCount}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// Reorganized Styles following kitchen-home-screen pattern with responsive text
const styles = StyleSheet.create({
  // Base container styles
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  emptyResultContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(40),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    marginTop: scale(16),
  },
  emptyText: {
    fontSize: FONT.XL,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginTop: scale(16),
  },
  emptySubText: {
    fontSize: FONT.SM,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: scale(8),
  },
  retryButton: {
    marginTop: scale(20),
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    backgroundColor: COLORS.primary,
    borderRadius: scale(8),
  },
  retryButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontFamily: FONTS.semiBold,
  },

  // Sticky Search Styles
  stickySearchContainer: {
    position: 'absolute',
    top: isAndroid ? scale(10) : scale(15),
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: scale(16),
  },
  stickySearchGradient: {
    borderRadius: scale(16),
    padding: scale(2),
  },

  // Firecracker Styles
  firecracker: {
    position: 'absolute',
    zIndex: 1,
  },
  firework: {
    position: 'absolute',
    zIndex: 1,
  },

  // Diwali Timer Styles
  diwaliTimerContainer: {
    marginHorizontal: scale(16),
    marginBottom: scale(8),
    borderRadius: scale(12),
    overflow: 'hidden',
    shadowColor: COLORS.diwaliOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  diwaliTimerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(14),
    position: 'relative',
  },
  timerLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timerIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
    shadowColor: COLORS.diwaliGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timerTextContainer: {
    flex: 1,
  },
  timerTitle: {
    fontSize: FONT.LG,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginBottom: scale(2),
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  timerSubtitle: {
    fontSize: FONT.SM,
    fontFamily: FONTS.medium,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  timerRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerItem: {
    alignItems: 'center',
    marginHorizontal: scale(2),
  },
  timerValueContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: scale(6),
    paddingHorizontal: scale(6),
    paddingVertical: scale(4),
    minWidth: scale(28),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  timerValue: {
    fontSize: FONT.SM,
    fontFamily: FONTS.bold,
    color: COLORS.diwaliOrange,
  },
  timerLabel: {
    fontSize: FONT.XS,
    fontFamily: FONTS.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: scale(2),
  },
  timerColon: {
    fontSize: FONT.LG,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginHorizontal: scale(1),
    marginBottom: scale(8),
  },
  tapIndicator: {
    marginLeft: scale(8),
  },
  diwaliTimerWrapper: {
    marginTop: scale(8),
  },
  // Bottom Slide Diwali Popup Styles
    diwaliModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  diwaliModalContainerBottom: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: scale(30),
    borderTopRightRadius: scale(30),
    paddingBottom: scale(20),
    maxHeight: height * 0.85,
    shadowColor: COLORS.diwaliGold,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  pullHandleBar: {
    width: scale(40),
    height: scale(4),
    backgroundColor: '#E5E5E5',
    borderRadius: scale(2),
    alignSelf: 'center',
    marginTop: scale(8),
    marginBottom: scale(8),
  },
  diwaliModalContent: {
    padding: scale(20),
    paddingTop: scale(10),
  },
  contentScrollView: {
    maxHeight: height * 0.6,
  },
  scrollContent: {
    flexGrow: 1,
  },
  diwaliCloseButton: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    zIndex: 10,
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  diwaliHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(25),
    marginTop: scale(15),
    paddingHorizontal: scale(10),
  },
  diyaContainer: {
    alignItems: 'center',
  },
  diyaLeft: {
    transform: [{ rotate: '-5deg' }],
  },
  diyaRight: {
    transform: [{ rotate: '5deg' }],
  },
  diyaBase: {
    width: scale(24),
    height: scale(18),
    backgroundColor: COLORS.diwaliDark,
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.diwaliOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  diyaFlame: {
    width: scale(8),
    height: scale(12),
    backgroundColor: COLORS.diwaliOrange,
    borderRadius: scale(4),
  },
  flameAnimation: {
    shadowColor: COLORS.diwaliOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  diwaliTitle: {
    fontSize: FONT.XXL + 2,
    fontFamily: FONTS.bold,
    color: COLORS.diwaliOrange,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
    letterSpacing: 0.5,
  },
  diwaliContent: {
    alignItems: 'center',
    marginBottom: scale(15),
  },
  diwaliSubtitle: {
    fontSize: FONT.XL + 2,
    fontFamily: FONTS.semiBold,
    color: COLORS.diwaliRed,
    marginBottom: scale(15),
    textAlign: 'center',
    textShadowColor: 'rgba(255, 107, 53, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  diwaliMessage: {
    fontSize: FONT.LG,
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: scale(24),
    marginBottom: scale(25),
    paddingHorizontal: scale(10),
  },
  popupCountdownContainer: {
    alignItems: 'center',
    marginBottom: scale(25),
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    padding: scale(20),
    borderRadius: scale(16),
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
  },
  popupCountdownText: {
    fontSize: FONT.LG,
    fontFamily: FONTS.medium,
    color: COLORS.diwaliOrange,
    marginBottom: scale(15),
    letterSpacing: 0.3,
  },
  popupCountdownTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  popupTimerColon: {
    fontSize: FONT.XL,
    fontFamily: FONTS.bold,
    color: COLORS.diwaliOrange,
    marginBottom: scale(15),
    marginHorizontal: scale(3),
  },
  popupOfferHighlights: {
    width: '100%',
    marginBottom: scale(15),
  },
  popupOfferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.07)',
    padding: scale(18),
    borderRadius: scale(14),
    marginBottom: scale(14),
    borderLeftWidth: 5,
    borderLeftColor: COLORS.diwaliGold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  popupOfferIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(15),
    shadowColor: COLORS.diwaliGold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  offerTextContainer: {
    flex: 1,
  },
  popupOfferTitle: {
    fontSize: FONT.LG,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(3),
  },
  popupOfferDesc: {
    fontSize: FONT.SM,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    lineHeight: scale(18),
  },
  diwaliButton: {
    width: '100%',
    borderRadius: scale(14),
    overflow: 'hidden',
    marginTop: scale(15),
    shadowColor: COLORS.diwaliOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  diwaliButtonGradient: {
    paddingVertical: scale(18),
    paddingHorizontal: scale(24),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diwaliButtonText: {
    fontSize: FONT.LG + 1,
    fontFamily: FONTS.semiBold,
    color: '#FFF',
    marginHorizontal: scale(10),
    letterSpacing: 0.3,
  },
  decorativeTopLeft: {
    position: 'absolute',
    top: scale(12),
    left: scale(12),
  },
  decorativeTopRight: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
  },
  decorativeBottomLeft: {
    position: 'absolute',
    bottom: scale(12),
    left: scale(12),
  },
  decorativeBottomRight: {
    position: 'absolute',
    bottom: scale(12),
    right: scale(12),
  },

  // Search Modal Styles
  searchModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.modalBackground,
    zIndex: 1000,
  },
  searchModalContainer: {
    flex: 1,
  },

  // Header Styles
  headerContainer: {
    zIndex: 100,
    borderBottomLeftRadius: scale(16),
    borderBottomRightRadius: scale(16),
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    paddingBottom: scale(8),
  },
  searchContainer: {
    marginTop: isAndroid ? scale(10) : scale(15),
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },

  // Main Content Styles
  mainContent: {
    backgroundColor: COLORS.background,
    minHeight: height * 0.6,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scale(100),
  },

  // Categories Section Styles
  categoriesSection: {
    marginTop: scale(16),
    marginBottom: scale(8),
  },

  // Search Input Styles
  searchInputContainer: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  searchInputTouchable: {
    borderRadius: scale(16),
    paddingHorizontal: scale(16),
    height: isAndroid ? scale(52) : scale(56),
    borderWidth: 2,
    borderColor: COLORS.searchInputBorder,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  searchInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  searchIcon: {
    marginRight: scale(12),
    color: COLORS.background,
  },
  searchTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  searchPlaceholderText: {
    fontSize: FONT.LG,
    fontFamily: FONTS.medium,
    color: COLORS.searchPlaceholder,
    letterSpacing: 0.3,
  },
  searchRightIcon: {
    paddingLeft: scale(12),
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    color: COLORS.background,
    marginLeft: scale(8),
  },
  searchShimmer: {
    position: 'absolute',
    top: 0,
    left: -100,
    width: 50,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ skewX: '-20deg' }],
  },

  // UPDATED: Category Styles with circular images
  categoryCard: {
    width: scale(65),
    alignItems: 'center',
    marginHorizontal: scale(8),
    paddingVertical: scale(8),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeCategoryCard: {
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.05 }],
  },
  categoryIconContainer: {
    width: scale(50),
    height: scale(50),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(2),
    borderRadius: scale(25), // Circular shape
    backgroundColor: COLORS.lightGray,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeCategoryIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: COLORS.primary,
  },
  categoryImage: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(15), // Circular image
  },
  categoryName: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  activeCategoryName: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
  },

  // Section Styles
  sectionContainer: {
    marginTop: scale(16),
    paddingHorizontal: scale(16),
  },
  featuredSectionContainer: {
    marginTop: scale(20),
    marginBottom: scale(10),
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginBottom: scale(12),
    paddingHorizontal: scale(16),
  },

  // Recommended Section - Horizontal Layout
  recommendedListContainer: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },

  // Filter Styles
  filterList: {
    paddingHorizontal: scale(0),
  },
  filterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: scale(20),
    paddingVertical: scale(8),
    paddingHorizontal: scale(16),
    marginRight: scale(10),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeFilterCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT.SM,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(6),
  },
  activeFilterText: {
    color: '#fff',
  },

  // Kitchen List Styles
  kitchenList: {
    paddingHorizontal: scale(8),
  },

  // Kitchen Card Styles - Side by Side
  kitchenCardSideBySide: {
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    overflow: 'hidden',
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginHorizontal: scale(4),
    marginBottom: scale(8),
  },
  kitchenCardDetailed: {
    marginHorizontal: scale(8),
    marginBottom: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  kitchenCardTouchable: {
    flex: 1,
  },
  kitchenImageContainerSideBySide: {
    height: scale(100),
    position: 'relative',
  },
  kitchenImageContainerDetailed: {
    height: scale(180),
    position: 'relative',
  },
  kitchenImageSideBySide: {
    width: '100%',
    height: '100%',
  },
  kitchenImageDetailed: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  badgeContainer: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badgeContainerSideBySide: {
    position: 'absolute',
    top: scale(4),
    left: scale(4),
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    marginRight: scale(4),
    marginBottom: scale(4),
  },
  featuredBadge: {
    backgroundColor: COLORS.featuredGradientStart,
  },
  newBadge: {
    backgroundColor: COLORS.newBadge,
  },
  trendingBadge: {
    backgroundColor: COLORS.trendingBadge,
  },
  discountBadge: {
    backgroundColor: COLORS.discount,
  },
  badgeText: {
    fontSize: FONT.S,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    marginLeft: scale(2),
  },
  favoriteButtonSideBySide: {
    position: 'absolute',
    top: scale(4),
    right: scale(4),
    backgroundColor: COLORS.darkOverlay,
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonDetailed: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    backgroundColor: COLORS.darkOverlay,
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  kitchenContentSideBySide: {
    padding: scale(8),
  },
  kitchenContentDetailed: {
    padding: scale(16),
  },
  kitchenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(6),
  },
  kitchenNameSideBySide: {
    fontSize: FONT.SM,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(4),
  },
  kitchenNameDetailed: {
    fontSize: FONT.XL,
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    flex: 1,
    marginRight: scale(8),
  },
  ratingContainerSideBySide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  ratingTextSideBySide: {
    fontSize: FONT.XS,
    fontFamily: FONTS.semiBold,
    color: COLORS.rating,
    marginLeft: scale(2),
    marginRight: scale(4),
  },
  ratingTextDetailed: {
    fontSize: FONT.XS,
    fontFamily: FONTS.semiBold,
    color: COLORS.rating,
    marginLeft: scale(2),
  },
  deliveryTimeSideBySide: {
    fontSize: FONT.XS,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  kitchenCuisineSideBySide: {
    fontSize: FONT.XS,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginBottom: scale(4),
  },
  kitchenCuisineDetailed: {
    fontSize: FONT.SM,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginBottom: scale(8),
  },
  priceTextSideBySide: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
  },
  kitchenFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryText: {
    fontSize: FONT.XS,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginLeft: scale(4),
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: FONT.XS,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
  },

  // Active Orders Footer Styles
  activeOrdersFooter: {
    position: 'absolute',
    bottom: isAndroid ? scale(70) : scale(80),
    left: scale(16),
    right: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    padding: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  activeOrderFooterItem: {
    backgroundColor: '#FFF',
    borderRadius: scale(8),
  },
  orderDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: scale(8),
  },
  activeOrderFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(4),
  },
  activeOrderFooterImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  activeOrderFooterDetails: {
    flex: 1,
  },
  activeOrderFooterKitchen: {
    fontSize: FONT.SM,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginBottom: scale(4),
  },
  activeOrderFooterStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeOrderFooterStatusText: {
    fontSize: FONT.XS,
    fontFamily: FONTS.medium,
    marginLeft: scale(4),
  },
  activeOrderFooterTimeButton: {
    borderRadius: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
  },
  activeOrderFooterTime: {
    alignItems: 'center',
  },
  activeOrderFooterTimeLabel: {
    fontSize: FONT.XS,
    fontFamily: FONTS.regular,
    marginBottom: scale(2),
  },
  activeOrderFooterTimeText: {
    fontSize: FONT.XS,
    fontFamily: FONTS.semiBold,
  },
  activeOrdersFooterSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(8),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activeOrdersFooterSeeAllText: {
    fontSize: FONT.SM,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    marginRight: scale(4),
  },

  // Cart Summary Styles
  cartSummaryContainer: {
    position: 'absolute',
    bottom: isAndroid ? scale(75) : scale(85),
    left: scale(16),
    right: scale(16),
    backgroundColor: '#ffffff',
    borderRadius: scale(16),
    padding: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cartSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartSummaryKitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(16),
  },
  cartSummaryKitchenImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  cartSummaryKitchenName: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(4),
    maxWidth: scale(150),
  },
  cartSummaryViewMenuBtn: {
    alignSelf: 'flex-start',
  },
  cartSummaryViewMenuText: {
    color: COLORS.primary,
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  cartSummaryMiniCartBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cartSummaryViewCartText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    marginRight: scale(8),
  },
  cartSummaryCartCountBadge: {
    backgroundColor: '#fff',
    borderRadius: scale(10),
    width: scale(17),
    height: scale(17),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummaryMiniCartCount: {
    color: COLORS.primary,
    fontSize: FONT.XS,
    fontFamily: FONTS.bold,
  },
});

export default React.memo(KitchenScreen);