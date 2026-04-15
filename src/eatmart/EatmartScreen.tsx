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
  Modal,
  ScrollView,
  Pressable,
  KeyboardAvoidingView
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Icon2 from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeStackParamList, HomeTabParamList } from '../types/navigation';
import { getUserAddress } from '../api/address';
import { getEatmartHomeData } from '../api/eatmart';
import { AuthContext } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// ============== CONSTANTS & CONFIGURATION ==============

const { width, height } = Dimensions.get('window');
const screenWidth = width;
const screenHeight = height;

// Responsive sizing functions
const eatmart_scale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  return Math.round(size * Math.min(1.3, Math.max(0.8, scaleFactor)));
};

const eatmart_verticalScale = (size: number) => {
  const baseHeight = 812;
  const scaleFactor = screenHeight / baseHeight;
  return Math.round(size * Math.min(1.3, Math.max(0.8, scaleFactor)));
};

const eatmart_fontScale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  const scaledSize = size * Math.min(1.2, Math.max(0.85, scaleFactor));
  return Math.round(scaledSize);
};

// Modern Minimalist Color Palette
const EATMART_COLORS = {
  primary: '#FF6B35',
  primaryLight: '#FF8A5C',
  primaryDark: '#E55A2B',
  secondary: '#2D3436',
  secondaryLight: '#636E72',
  secondaryDark: '#1E272E',
  success: '#00B894',
  successLight: '#55EFC4',
  warning: '#FDCB6E',
  danger: '#FF7675',
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F8F9FA',
  text: {
    primary: '#2D3436',
    secondary: '#636E72',
    tertiary: '#B2BEC3',
    light: '#FFFFFF',
    inverse: '#FFFFFF',
  },
  border: {
    light: '#F1F2F6',
    default: '#DFE6E9',
    dark: '#CED6E0',
  },
  grayBg: '#F8F9FA',
  grayLight: '#FDFDFD',
  grayDark: '#E9ECEF',
  overlay: 'rgba(0,0,0,0.5)',
  white: '#FFFFFF',
  black: '#000000',
  rating: '#00B894',
  veg: '#00B894',
  nonVeg: '#FF7675',
};

const EATMART_TYPOGRAPHY = {
  h1: { fontSize: eatmart_fontScale(34), lineHeight: eatmart_fontScale(42), fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: eatmart_fontScale(28), lineHeight: eatmart_fontScale(36), fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: eatmart_fontScale(24), lineHeight: eatmart_fontScale(32), fontWeight: '600' as const },
  h4: { fontSize: eatmart_fontScale(20), lineHeight: eatmart_fontScale(28), fontWeight: '600' as const },
  body1: { fontSize: eatmart_fontScale(16), lineHeight: eatmart_fontScale(24), fontWeight: '400' as const },
  body2: { fontSize: eatmart_fontScale(14), lineHeight: eatmart_fontScale(20), fontWeight: '400' as const },
  caption: { fontSize: eatmart_fontScale(12), lineHeight: eatmart_fontScale(16), fontWeight: '400' as const },
  button: { fontSize: eatmart_fontScale(15), lineHeight: eatmart_fontScale(20), fontWeight: '600' as const, letterSpacing: 0.3 },
};

const EATMART_HEADER_HEIGHT = Platform.OS === 'ios' ? eatmart_verticalScale(160) : eatmart_verticalScale(150);
const EATMART_MIN_HEADER_HEIGHT = Platform.OS === 'ios' ? eatmart_verticalScale(70) : eatmart_verticalScale(65);
const BANNER_HEIGHT = eatmart_verticalScale(200);

const EATMART_STORAGE_KEYS = {
  ADDRESS_ID: 'AddressId',
  STREET_ADDRESS: 'StreetAddress',
  HOME_TYPE: 'HomeType',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  RECENT_SEARCHES: 'eatmartRecentSearches',
  CART_ITEMS: 'eatmartCartItems',
  USER: 'user',
};

// ============== API RESPONSE TYPES ==============

interface ApiBannerItem {
  id: string;
  name: string;
  icon: string;
  document_type: 1 | 2;
  thumbnail?: string;
}

interface ApiCategoryItem {
  id: number;
  name: string;
  icon: string;
  icon_type?: string;
  item_count: number;
  is_active: boolean;
  sort_order: number;
}

interface ApiGroceryItem {
  item_id: string;
  item_name: string;
  item_image: string;
  category_id: number;
  category_name: string;
  price: string;
  discount_price?: string;
  unit: string;
  in_stock: boolean;
  rating?: number;
  reviews?: number;
  is_organic?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
  brand?: string;
  description?: string;
  tags?: string[];
  weight_value?: number;
  weight_unit?: string;
  pack_size?: string;
  express_delivery?: boolean;
}

// ============== FRONTEND TYPES ==============

interface BannerItem {
  id: string;
  name: string;
  icon: string;
  document_type: 1 | 2;
  thumbnail?: string;
}

interface GroceryCategory {
  id: number;
  name: string;
  icon: string;
  icon_type: string;
  item_count: number;
  is_active: boolean;
  sort_order: number;
}

interface GroceryItem {
  item_id: string;
  item_name: string;
  item_image: string;
  category_id: number;
  category_name: string;
  price: string;
  discount_price?: string;
  unit: string;
  in_stock: boolean;
  rating?: number;
  reviews?: number;
  is_organic?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
  brand?: string;
  description?: string;
  tags?: string[];
  weight_value?: number;
  weight_unit?: string;
  pack_size?: string;
  express_delivery?: boolean;
}

interface HomeScreenData {
  categories: GroceryCategory[];
  banners: BannerItem[];
  featuredItems: GroceryItem[];
  topOffers?: BannerItem[];
  forYou?: BannerItem[];
}

// ============== CART CONTEXT ==============

interface CartItem extends GroceryItem {
  cartQuantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: GroceryItem) => void;
  removeFromCart: (itemId: string) => void;
  incrementQuantity: (itemId: string) => void;
  decrementQuantity: (itemId: string) => void;
  getItemQuantity: (itemId: string) => number;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  clearCart: () => void;
}

const CartContext = React.createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    loadCartFromStorage();
  }, []);

  useEffect(() => {
    saveCartToStorage();
  }, [cartItems]);

  const loadCartFromStorage = async () => {
    try {
      const savedCart = await AsyncStorage.getItem(EATMART_STORAGE_KEYS.CART_ITEMS);
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCartToStorage = async () => {
    try {
      await AsyncStorage.setItem(EATMART_STORAGE_KEYS.CART_ITEMS, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const addToCart = (item: GroceryItem) => {
    setCartItems(prev => {
      const existingItem = prev.find(i => i.item_id === item.item_id);
      if (existingItem) {
        return prev.map(i => 
          i.item_id === item.item_id 
            ? { ...i, cartQuantity: i.cartQuantity + 1 }
            : i
        );
      } else {
        return [...prev, { ...item, cartQuantity: 1 }];
      }
    });
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.item_id !== itemId));
  };

  const incrementQuantity = (itemId: string) => {
    setCartItems(prev => 
      prev.map(item => 
        item.item_id === itemId 
          ? { ...item, cartQuantity: item.cartQuantity + 1 }
          : item
      )
    );
  };

  const decrementQuantity = (itemId: string) => {
    setCartItems(prev => {
      const item = prev.find(i => i.item_id === itemId);
      if (item && item.cartQuantity === 1) {
        return prev.filter(i => i.item_id !== itemId);
      }
      return prev.map(item => 
        item.item_id === itemId 
          ? { ...item, cartQuantity: item.cartQuantity - 1 }
          : item
      );
    });
  };

  const getItemQuantity = (itemId: string) => {
    const item = cartItems.find(i => i.item_id === itemId);
    return item?.cartQuantity || 0;
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.cartQuantity, 0);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const price = parseFloat(item.discount_price || item.price);
      return total + (price * item.cartQuantity);
    }, 0);
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      incrementQuantity,
      decrementQuantity,
      getItemQuantity,
      getTotalItems,
      getTotalPrice,
      clearCart
    }}>
      {children}
    </CartContext.Provider>
  );
};

// ============== UTILITIES ==============

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const mapApiResponseToHomeData = (apiData: any): HomeScreenData => ({
  categories: (apiData.CategoryList || []).map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    icon_type: cat.icon_type || 'emoji',
    item_count: cat.item_count || 0,
    is_active: cat.is_active,
    sort_order: cat.sort_order
  })),
  banners: (apiData.banner_images || []).map((banner: any) => ({
    id: banner.id,
    name: banner.name,
    icon: banner.icon,
    document_type: banner.document_type,
    thumbnail: banner.thumbnail
  })),
  topOffers: (apiData.top_offers || []).map((offer: any) => ({
    id: offer.id,
    name: offer.name,
    icon: offer.icon,
    document_type: offer.document_type,
    thumbnail: offer.thumbnail
  })),
  forYou: (apiData.for_you || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    icon: item.icon,
    document_type: item.document_type,
    thumbnail: item.thumbnail
  })),
  featuredItems: (apiData.FeaturedItemsList || []).map((item: any) => ({
    item_id: item.item_id,
    item_name: item.item_name,
    item_image: item.item_image,
    category_id: item.category_id,
    category_name: item.category_name,
    price: item.price,
    discount_price: item.discount_price,
    unit: item.unit,
    in_stock: item.in_stock,
    rating: item.rating,
    reviews: item.reviews,
    is_organic: item.is_organic,
    is_new: item.is_new,
    is_bestseller: item.is_bestseller,
    brand: item.brand,
    description: item.description,
    tags: item.tags,
    weight_value: item.weight_value,
    weight_unit: item.weight_unit,
    pack_size: item.pack_size,
    express_delivery: item.express_delivery
  }))
});

const fetchHomeData = async (latitude?: number, longitude?: number): Promise<HomeScreenData> => {
  try {
    const response = await getEatmartHomeData(latitude, longitude);
    const apiData = response.data?.data || response.data;
    return mapApiResponseToHomeData(apiData);
  } catch (error) {
    console.error('Error fetching home data:', error);
    throw error;
  }
};

// ============== CART BOTTOM BAR ==============

const CartBottomBar: React.FC = () => {
  const navigation = useNavigation<any>();
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const { isGuest } = useContext(AuthContext);
  
  const slideAnim = useRef(new Animated.Value(100)).current;
  
  const totalItems = cart.getTotalItems();
  const totalPrice = cart.getTotalPrice();
  
  useEffect(() => {
    if (totalItems > 0) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [totalItems]);
  
  if (totalItems === 0) return null;
  
  const handleCartPress = () => {
    if (isGuest) {
      navigation.navigate('LoginScreen');
    } else {
      navigation.navigate('EatmartViewCart');
    }
  };
  
  return (
    <Animated.View
      style={[
        eatmart_styles.eatm_screen_cartBottomBar,
        {
          transform: [{ translateY: slideAnim }],
          bottom: insets.bottom + eatmart_verticalScale(20),
          marginHorizontal: eatmart_scale(16)
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleCartPress}
        style={eatmart_styles.eatm_screen_cartBarTouchable}
      >
        <LinearGradient
          colors={[EATMART_COLORS.primary, EATMART_COLORS.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={eatmart_styles.eatm_screen_cartBarGradient}
        >
          <View style={eatmart_styles.eatm_screen_cartBarContent}>
            <View style={eatmart_styles.eatm_screen_cartBarLeft}>
              <View style={eatmart_styles.eatm_screen_cartIconContainer}>
                <Icon name="cart-outline" size={eatmart_scale(22)} color={EATMART_COLORS.white} />
              </View>
              <View style={eatmart_styles.eatm_screen_cartBarInfo}>
                <Text style={eatmart_styles.eatm_screen_cartBarItems}>{totalItems} Items</Text>
                <Text style={eatmart_styles.eatm_screen_cartBarTotal}>₹{totalPrice.toFixed(0)}</Text>
              </View>
            </View>
            <View style={eatmart_styles.eatm_screen_cartBarRight}>
              <Text style={eatmart_styles.eatm_screen_cartBarViewText}>VIEW CART</Text>
              <Icon name="arrow-forward" size={eatmart_scale(16)} color={EATMART_COLORS.white} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============== SEARCH BAR ==============

interface SearchBarProps {
  onPress: () => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onPress,
  placeholder = "Search 'atta', 'sugar' & more"
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={eatmart_styles.eatm_screen_searchContainer}
    >
      <View style={eatmart_styles.eatm_screen_searchContent}>
        <Icon name="search-outline" size={eatmart_scale(20)} color={EATMART_COLORS.text.secondary} />
        <Text style={eatmart_styles.eatm_screen_searchPlaceholder} numberOfLines={1}>
          {placeholder}
        </Text>
        <View style={eatmart_styles.eatm_screen_searchMicButton}>
          <Icon name="mic-outline" size={eatmart_scale(20)} color={EATMART_COLORS.text.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============== MODERN CATEGORY ICON ==============

interface CategoryIconProps {
  category: GroceryCategory;
  onPress: (id: number, name: string) => void;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ category, onPress }) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.94,
      friction: 6,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 4,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };
  
  return (
    <Animated.View style={[eatmart_styles.eatm_screen_categoryIconContainer, { transform: [{ scale: scaleValue }] }]}>
      <TouchableOpacity
        style={eatmart_styles.eatm_screen_categoryIconTouchable}
        onPress={() => onPress(category.id, category.name)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
      >
        <View style={eatmart_styles.eatm_screen_categoryIconWrapper}>
          <Text style={eatmart_styles.eatm_screen_categoryIconEmoji}>{category.icon}</Text>
        </View>
        <Text style={eatmart_styles.eatm_screen_categoryIconText} numberOfLines={1}>
          {category.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============== MODERN OFFER BANNER ==============

interface OfferBannerProps {
  item: BannerItem;
  index: number;
}

const OfferBanner: React.FC<OfferBannerProps> = ({ item, index }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        eatmart_styles.eatm_screen_offerBannerContainer,
        { marginLeft: index === 0 ? eatmart_scale(16) : eatmart_scale(12) }
      ]}
    >
      <Image
        source={{ uri: item.icon || item.thumbnail }}
        style={eatmart_styles.eatm_screen_offerBannerImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={eatmart_styles.eatm_screen_offerOverlay}
      >
        <Text style={eatmart_styles.eatm_screen_offerText}>{item.name}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ============== ENHANCED FULL WIDTH BANNER CAROUSEL ==============

interface BannerProps {
  banners: BannerItem[];
}

const BannerCarousel: React.FC<BannerProps> = ({ banners }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const autoPlayTimerRef = useRef<NodeJS.Timeout>();
  
  const BANNER_WIDTH = screenWidth;
  
  useEffect(() => {
    startAutoPlay();
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [banners.length]);
  
  const startAutoPlay = () => {
    if (banners.length <= 1) return;
    
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }
    
    autoPlayTimerRef.current = setInterval(() => {
      const nextIndex = (activeIndex + 1) % banners.length;
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
      setActiveIndex(nextIndex);
    }, 4000);
  };
  
  const handleScrollBegin = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }
  };
  
  const handleMomentumScrollEnd = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / BANNER_WIDTH);
    setActiveIndex(index);
    startAutoPlay();
  };
  
  const handleScroll = (event: any) => {
    scrollX.setValue(event.nativeEvent.contentOffset.x);
  };
  
  const getItemLayout = (data: any, index: number) => ({
    length: BANNER_WIDTH,
    offset: BANNER_WIDTH * index,
    index,
  });
  
  if (!banners || banners.length === 0) return null;
  
  const renderBanner = ({ item, index }: { item: BannerItem; index: number }) => {
    const inputRange = [
      (index - 1) * BANNER_WIDTH,
      index * BANNER_WIDTH,
      (index + 1) * BANNER_WIDTH,
    ];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.98, 1, 0.98],
      extrapolate: 'clamp',
    });
    
    return (
      <Animated.View style={[
        eatmart_styles.eatm_screen_bannerContainer,
        {
          width: BANNER_WIDTH,
          transform: [{ scale }],
        }
      ]}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => {}}
          style={eatmart_styles.eatm_screen_bannerTouchable}
        >
          <Image
            source={{ uri: item.icon || item.thumbnail }}
            style={eatmart_styles.eatm_screen_bannerImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={eatmart_styles.eatm_screen_bannerGradient}
          >
            <View style={eatmart_styles.eatm_screen_bannerTextContainer}>
              <Text style={eatmart_styles.eatm_screen_bannerTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={eatmart_styles.eatm_screen_bannerButton}>
                <Text style={eatmart_styles.eatm_screen_bannerButtonText}>Shop Now</Text>
                <Icon name="arrow-forward" size={eatmart_scale(14)} color={EATMART_COLORS.white} />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={eatmart_styles.eatm_screen_bannerSection}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item, index) => item.id || index.toString()}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
      />
    </View>
  );
};

// ============== MODERN PRODUCT CARD ==============

const ProductCard = ({
  item,
  onPress
}: {
  item: GroceryItem;
  onPress: (item: GroceryItem) => void;
}) => {
  const cart = useCart();
  const { isGuest } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  const quantity = cart.getItemQuantity(item.item_id);
  const scaleValue = useRef(new Animated.Value(1)).current;
  
  const handleAddToCart = (e: any) => {
    e.stopPropagation();
    if (isGuest) {
      navigation.navigate('LoginScreen');
      return;
    }
    cart.addToCart(item);
    
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1.08,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const finalPrice = item.discount_price || item.price;
  const originalPrice = item.price;
  const discountPercentage = item.discount_price ?
    Math.round((1 - parseFloat(item.discount_price) / parseFloat(item.price)) * 100) : 0;

  const displayUnit = item.pack_size || item.unit;
  const weightText = item.weight_value ? `${item.weight_value}${item.weight_unit || 'g'}` : displayUnit;

  return (
    <TouchableOpacity
      style={eatmart_styles.eatm_screen_productCard}
      onPress={() => onPress(item)}
      activeOpacity={0.95}
    >
      <View style={eatmart_styles.eatm_screen_productImageContainer}>
        <Image
          source={{ uri: item.item_image }}
          style={eatmart_styles.eatm_screen_productImage}
          resizeMode="cover"
        />
        
        {discountPercentage > 0 && (
          <View style={eatmart_styles.eatm_screen_productDiscountBadge}>
            <Text style={eatmart_styles.eatm_screen_productDiscountText}>{discountPercentage}% OFF</Text>
          </View>
        )}
        
        {item.express_delivery && (
          <View style={eatmart_styles.eatm_screen_productExpressBadge}>
            <Icon name="flash" size={eatmart_scale(10)} color={EATMART_COLORS.white} />
            <Text style={eatmart_styles.eatm_screen_productExpressText}>Express</Text>
          </View>
        )}
        
        {!item.in_stock && (
          <View style={eatmart_styles.eatm_screen_productOutOfStock}>
            <Text style={eatmart_styles.eatm_screen_productOutOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>
      
      <View style={eatmart_styles.eatm_screen_productInfo}>
        <Text style={eatmart_styles.eatm_screen_productName} numberOfLines={2}>
          {item.item_name}
        </Text>
        
        <Text style={eatmart_styles.eatm_screen_productWeight}>
          {weightText}
        </Text>
        
        {item.rating && (
          <View style={eatmart_styles.eatm_screen_productRating}>
            <Text style={eatmart_styles.eatm_screen_productRatingText}>{item.rating}</Text>
            <Icon name="star" size={eatmart_scale(10)} color={EATMART_COLORS.white} />
          </View>
        )}
        
        <View style={eatmart_styles.eatm_screen_productFooter}>
          <View>
            <Text style={eatmart_styles.eatm_screen_productPrice}>₹{finalPrice}</Text>
            {item.discount_price && (
              <Text style={eatmart_styles.eatm_screen_productOriginalPrice}>₹{originalPrice}</Text>
            )}
          </View>
          
          {quantity === 0 ? (
            <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
              <TouchableOpacity
                style={eatmart_styles.eatm_screen_addButton}
                onPress={handleAddToCart}
                activeOpacity={0.8}
              >
                <Text style={eatmart_styles.eatm_screen_addButtonText}>ADD</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={eatmart_styles.eatm_screen_quantityControl}>
              <TouchableOpacity
                style={eatmart_styles.eatm_screen_quantityButton}
                onPress={(e) => {
                  e.stopPropagation();
                  cart.decrementQuantity(item.item_id);
                }}
              >
                <Text style={eatmart_styles.eatm_screen_quantityButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={eatmart_styles.eatm_screen_quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={eatmart_styles.eatm_screen_quantityButton}
                onPress={(e) => {
                  e.stopPropagation();
                  if (isGuest) {
                    navigation.navigate('LoginScreen');
                    return;
                  }
                  cart.incrementQuantity(item.item_id);
                }}
              >
                <Text style={eatmart_styles.eatm_screen_quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ============== SECTION HEADER ==============

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onViewAll?: () => void;
  showViewAll?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  onViewAll,
  showViewAll = true
}) => {
  return (
    <View style={eatmart_styles.eatm_screen_sectionHeader}>
      <View>
        <Text style={eatmart_styles.eatm_screen_sectionTitle}>{title}</Text>
        {subtitle && <Text style={eatmart_styles.eatm_screen_sectionSubtitle}>{subtitle}</Text>}
      </View>
      {showViewAll && onViewAll && (
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={eatmart_styles.eatm_screen_sectionViewAll}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============== PRODUCT GRID ==============

interface ProductGridProps {
  items: GroceryItem[];
  onItemPress: (item: GroceryItem) => void;
  title?: string;
  subtitle?: string;
  onViewAll?: () => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  items,
  onItemPress,
  title,
  subtitle,
  onViewAll
}) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={eatmart_styles.eatm_screen_productGridSection}>
      {title && (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          onViewAll={onViewAll}
          showViewAll={items.length > 4}
        />
      )}
      <FlatList
        data={items.slice(0, 4)}
        keyExtractor={(item) => item.item_id}
        numColumns={2}
        scrollEnabled={false}
        columnWrapperStyle={eatmart_styles.eatm_screen_gridRow}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            onPress={onItemPress}
          />
        )}
      />
    </View>
  );
};

// ============== MODERN SEARCH MODAL ==============

const SearchModal = React.memo(({
  visible,
  onClose,
  initialQuery = '',
  categories,
  onCategorySelect
}: {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
  categories: GroceryCategory[];
  onCategorySelect?: (categoryId: number, categoryName: string) => void;
}) => {
  const [searchText, setSearchText] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState<GroceryCategory[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(searchText, 300);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadRecentSearches();
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  useEffect(() => {
    if (debouncedSearch) {
      performSearch(debouncedSearch);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem(EATMART_STORAGE_KEYS.RECENT_SEARCHES);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query: string) => {
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
      setRecentSearches(updated);
      await AsyncStorage.setItem(EATMART_STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const performSearch = (query: string) => {
    setIsSearching(true);
    const results = categories.filter(cat => 
      cat.name.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSubmit = () => {
    if (searchText.trim()) {
      saveRecentSearch(searchText.trim());
    }
  };

  const clearSearch = () => {
    setSearchText('');
    setSearchResults([]);
  };

  const removeRecentSearch = async (search: string) => {
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    await AsyncStorage.setItem(EATMART_STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
  };

  const handleCategorySelect = (categoryId: number, categoryName: string) => {
    if (onCategorySelect) {
      onCategorySelect(categoryId, categoryName);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[eatmart_styles.eatm_screen_searchModal, { paddingTop: insets.top }]}>
        <View style={eatmart_styles.eatm_screen_searchModalHeader}>
          <TouchableOpacity onPress={onClose} style={eatmart_styles.eatm_screen_searchModalBack}>
            <Icon name="arrow-back" size={eatmart_scale(24)} color={EATMART_COLORS.text.primary} />
          </TouchableOpacity>
          
          <View style={eatmart_styles.eatm_screen_searchModalInputWrapper}>
            <View style={eatmart_styles.eatm_screen_searchModalInputContainer}>
              <Icon name="search-outline" size={eatmart_scale(20)} color={EATMART_COLORS.text.secondary} />
              <TextInput
                ref={inputRef}
                style={eatmart_styles.eatm_screen_searchModalInput}
                placeholder="Search for groceries & essentials"
                placeholderTextColor={EATMART_COLORS.text.tertiary}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSubmit}
                returnKeyType="search"
                clearButtonMode="never"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={eatmart_styles.eatm_screen_searchModalClear}>
                  <Icon name="close-circle" size={eatmart_scale(20)} color={EATMART_COLORS.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={eatmart_styles.eatm_screen_searchModalContent}>
          {searchText.length === 0 ? (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={eatmart_styles.eatm_screen_searchInitialContent}
            >
              {recentSearches.length > 0 && (
                <View style={eatmart_styles.eatm_screen_searchSection}>
                  <View style={eatmart_styles.eatm_screen_searchSectionHeader}>
                    <Text style={eatmart_styles.eatm_screen_searchSectionTitle}>RECENT SEARCHES</Text>
                    <TouchableOpacity onPress={() => setRecentSearches([])}>
                      <Text style={eatmart_styles.eatm_screen_searchSectionClear}>Clear all</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={eatmart_styles.eatm_screen_recentList}>
                    {recentSearches.map((search, index) => (
                      <View key={index} style={eatmart_styles.eatm_screen_recentItem}>
                        <TouchableOpacity 
                          style={eatmart_styles.eatm_screen_recentContent}
                          onPress={() => setSearchText(search)}
                        >
                          <Icon name="time-outline" size={eatmart_scale(18)} color={EATMART_COLORS.text.secondary} />
                          <Text style={eatmart_styles.eatm_screen_recentText} numberOfLines={1}>
                            {search}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => removeRecentSearch(search)}
                          style={eatmart_styles.eatm_screen_recentRemove}
                        >
                          <Icon name="close" size={eatmart_scale(16)} color={EATMART_COLORS.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={eatmart_styles.eatm_screen_searchSection}>
                <Text style={eatmart_styles.eatm_screen_searchSectionTitle}>POPULAR CATEGORIES</Text>
                <View style={eatmart_styles.eatm_screen_popularGrid}>
                  {categories.slice(0, 8).map((cat) => (
                    <TouchableOpacity 
                      key={cat.id} 
                      style={eatmart_styles.eatm_screen_popularItem}
                      onPress={() => handleCategorySelect(cat.id, cat.name)}
                    >
                      <View style={eatmart_styles.eatm_screen_popularIcon}>
                        <Text style={eatmart_styles.eatm_screen_popularEmoji}>{cat.icon}</Text>
                      </View>
                      <Text style={eatmart_styles.eatm_screen_popularName} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={eatmart_styles.eatm_screen_searchResults}>
              {isSearching ? (
                <View style={eatmart_styles.eatm_screen_searchLoading}>
                  <ActivityIndicator size="small" color={EATMART_COLORS.primary} />
                </View>
              ) : searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={eatmart_styles.eatm_screen_searchResultItem}
                      onPress={() => handleCategorySelect(item.id, item.name)}
                    >
                      <View style={eatmart_styles.eatm_screen_searchResultIcon}>
                        <Text style={eatmart_styles.eatm_screen_searchResultEmoji}>{item.icon}</Text>
                      </View>
                      <View style={eatmart_styles.eatm_screen_searchResultInfo}>
                        <Text style={eatmart_styles.eatm_screen_searchResultName}>{item.name}</Text>
                        <Text style={eatmart_styles.eatm_screen_searchResultCount}>
                          {item.item_count} items
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={eatmart_scale(18)} color={EATMART_COLORS.text.tertiary} />
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={eatmart_styles.eatm_screen_searchResultsList}
                />
              ) : (
                <View style={eatmart_styles.eatm_screen_searchNoResults}>
                  <Icon name="search-outline" size={eatmart_scale(56)} color={EATMART_COLORS.text.tertiary} />
                  <Text style={eatmart_styles.eatm_screen_searchNoResultsTitle}>No results found</Text>
                  <Text style={eatmart_styles.eatm_screen_searchNoResultsText}>
                    Try searching with different keywords
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
});

// ============== ADDRESS HEADER ==============

interface AddressHeaderProps {
  isGuest: boolean;
  onAddressUpdate?: (address: string, homeType: string, coords?: { lat: number; lng: number }) => void;
}

const AddressHeader = React.memo(({ isGuest, onAddressUpdate }: AddressHeaderProps) => {
  const navigation = useNavigation<any>();
  const [location, setLocation] = useState({
    address: 'Select delivery location',
    loading: true,
    error: null as string | null,
    coords: null as { lat: number; lng: number } | null,
    homeType: 'Home',
    addressId: null as string | null,
  });

  const [appState, setAppState] = useState(AppState.currentState);

  const truncateAddress = (address: string, maxWords: number = 2) => {
    if (!address) return '';
    const words = address.split(' ');
    if (words.length <= maxWords) return address;
    return words.slice(0, maxWords).join(' ') + '...';
  };

  const saveAddressDetails = useCallback(async (addressData: {
    full_address: string;
    home_type?: string;
    latitude: string;
    longitude: string;
  }) => {
    try {
      await AsyncStorage.multiSet([
        [EATMART_STORAGE_KEYS.STREET_ADDRESS, addressData.full_address],
        [EATMART_STORAGE_KEYS.HOME_TYPE, addressData.home_type || 'Home'],
        [EATMART_STORAGE_KEYS.LATITUDE, addressData.latitude],
        [EATMART_STORAGE_KEYS.LONGITUDE, addressData.longitude],
      ]);
    } catch (error) {
      console.error('Error saving address:', error);
    }
  }, []);

  const getSavedAddressDetails = useCallback(async () => {
    try {
      const [savedAddress, savedHomeType, savedLat, savedLng] = await Promise.all([
        AsyncStorage.getItem(EATMART_STORAGE_KEYS.STREET_ADDRESS),
        AsyncStorage.getItem(EATMART_STORAGE_KEYS.HOME_TYPE),
        AsyncStorage.getItem(EATMART_STORAGE_KEYS.LATITUDE),
        AsyncStorage.getItem(EATMART_STORAGE_KEYS.LONGITUDE),
      ]);

      if (savedAddress && savedLat && savedLng) {
        return {
          address: savedAddress,
          homeType: savedHomeType || 'Home',
          coords: {
            lat: parseFloat(savedLat),
            lng: parseFloat(savedLng),
          },
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting saved address:', error);
      return null;
    }
  }, []);

  const checkLocationInDatabase = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await getUserAddress({ 
        lat: lat.toString(), 
        long: lng.toString(),
        isGuest: isGuest
      });

      const addressData = response?.data;
      if (!addressData) return false;

      const { full_address, home_type } = addressData;

      await saveAddressDetails({
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
        loading: false,
        error: null,
      }));

      if (onAddressUpdate) {
        onAddressUpdate(full_address, home_type || "Home", { lat, lng });
      }

      return true;
    } catch (error) {
      console.error("Error checking location:", error);
      return false;
    }
  }, [isGuest, saveAddressDetails, onAddressUpdate]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.requestAuthorization();
        Geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });
    } else {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Eatmart needs access to your location to show nearby stores',
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

  const getCurrentLocation = useCallback(async () => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      const savedDetails = await getSavedAddressDetails();
      if (savedDetails) {
        setLocation(prev => ({
          ...prev,
          address: savedDetails.address,
          coords: savedDetails.coords,
          homeType: savedDetails.homeType,
          loading: false,
        }));
        if (onAddressUpdate) {
          onAddressUpdate(savedDetails.address, savedDetails.homeType, savedDetails.coords);
        }
        return;
      }

      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocation(prev => ({
          ...prev,
          address: 'Location permission required',
          error: 'Location permission required',
          loading: false,
        }));
        return;
      }

      Geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await checkLocationInDatabase(latitude, longitude);
        },
        (error) => {
          console.log('Location error:', error);
          setLocation(prev => ({
            ...prev,
            address: 'Location unavailable',
            error: 'Location unavailable',
            loading: false,
          }));
        },
        {
          enableHighAccuracy: Platform.OS === 'ios',
          timeout: 30000,
          maximumAge: 10000,
        }
      );
    } catch (error) {
      setLocation(prev => ({
        ...prev,
        address: 'Error getting location',
        error: 'Error getting location',
        loading: false,
      }));
    }
  }, [requestLocationPermission, checkLocationInDatabase, getSavedAddressDetails, onAddressUpdate]);

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

  const handleAddressPress = useCallback(() => {
    navigation.navigate('AddressScreen', {
      prevLocation: "HomeTabs",
      onAddressSelect: (selectedAddressObj: any) => {
        const raw = selectedAddressObj.rawAddress;
        if (raw.full_address && raw.latitude && raw.longitude) {
          saveAddressDetails({
            full_address: raw.full_address,
            home_type: raw.home_type || 'Home',
            latitude: raw.latitude,
            longitude: raw.longitude,
          });
          setLocation(prev => ({
            ...prev,
            address: raw.full_address,
            coords: { lat: parseFloat(raw.latitude), lng: parseFloat(raw.longitude) },
            homeType: raw.home_type || 'Home',
            loading: false,
            error: null,
          }));
          if (onAddressUpdate) onAddressUpdate(raw.full_address, raw.home_type || 'Home', { 
            lat: parseFloat(raw.latitude), 
            lng: parseFloat(raw.longitude) 
          });
        }
      }
    });
  }, [navigation, saveAddressDetails, onAddressUpdate]);

  const displayAddress = location.loading
    ? 'Fetching location...'
    : location.error || truncateAddress(location.address, 2);

  return (
    <TouchableOpacity
      onPress={handleAddressPress}
      activeOpacity={0.7}
      style={eatmart_styles.eatm_screen_addressContainer}
    >
      <View style={eatmart_styles.eatm_screen_addressIcon}>
        <Icon name="location" size={eatmart_scale(14)} color={EATMART_COLORS.primary} />
      </View>
      <View style={eatmart_styles.eatm_screen_addressTextContainer}>
        <Text style={eatmart_styles.eatm_screen_addressText} numberOfLines={1}>
          {displayAddress}
        </Text>
      </View>
      <Icon name="chevron-down" size={eatmart_scale(14)} color={EATMART_COLORS.text.secondary} />
    </TouchableOpacity>
  );
});

// ============== SIMILAR ITEMS LIST ==============

interface SimilarItemsListProps {
  items: GroceryItem[];
  onItemPress: (item: GroceryItem) => void;
}

const SimilarItemsList: React.FC<SimilarItemsListProps> = ({ items, onItemPress }) => {
  const renderItem = ({ item }: { item: GroceryItem }) => (
    <TouchableOpacity
      style={eatmart_styles.eatm_screen_similarItemCard}
      onPress={() => onItemPress(item)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.item_image }} 
        style={eatmart_styles.eatm_screen_similarItemImage}
        resizeMode="cover"
      />
      <View style={eatmart_styles.eatm_screen_similarItemInfo}>
        <Text style={eatmart_styles.eatm_screen_similarItemName} numberOfLines={2}>
          {item.item_name}
        </Text>
        <Text style={eatmart_styles.eatm_screen_similarItemWeight}>
          {item.unit}
        </Text>
        <View style={eatmart_styles.eatm_screen_similarItemPriceContainer}>
          <Text style={eatmart_styles.eatm_screen_similarItemPrice}>
            ₹{item.discount_price || item.price}
          </Text>
          {item.discount_price && (
            <Text style={eatmart_styles.eatm_screen_similarItemOriginalPrice}>
              ₹{item.price}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.item_id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={eatmart_styles.eatm_screen_similarItemsContainer}
      decelerationRate="fast"
      renderItem={renderItem}
    />
  );
};

// ============== ITEM DETAILS MODAL ==============

interface ItemDetailsProps {
  visible: boolean;
  onClose: () => void;
  item: GroceryItem;
  similarItems?: GroceryItem[];
  onItemPress?: (item: GroceryItem) => void;
}

const ItemDetails: React.FC<ItemDetailsProps> = ({ 
  visible, 
  onClose, 
  item,
  similarItems = [],
  onItemPress
}) => {
  const navigation = useNavigation<any>();
  const cart = useCart();
  const { isGuest } = useContext(AuthContext);
  const [quantity, setQuantity] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setQuantity(cart.getItemQuantity(item.item_id));
      setActiveImageIndex(0);
    }
  }, [visible, item.item_id, cart]);

  const handleClose = () => {
    onClose();
  };

  const handleAddToCart = () => {
    if (isGuest) {
      handleClose();
      navigation.navigate('LoginScreen');
      return;
    }
    cart.addToCart(item);
    setQuantity(1);
  };

  const handleIncrement = () => {
    if (isGuest) {
      handleClose();
      navigation.navigate('LoginScreen');
      return;
    }
    cart.incrementQuantity(item.item_id);
    setQuantity(prev => prev + 1);
  };

  const handleDecrement = () => {
    cart.decrementQuantity(item.item_id);
    setQuantity(prev => prev - 1);
  };

  const handleSimilarItemPress = (similarItem: GroceryItem) => {
    if (onItemPress) {
      onItemPress(similarItem);
    } else {
      handleClose();
    }
  };

  const finalPrice = item.discount_price || item.price;
  const originalPrice = item.price;
  const discountPercentage = item.discount_price ? 
    Math.round((1 - parseFloat(item.discount_price) / parseFloat(item.price)) * 100) : 0;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={eatmart_styles.eatm_screen_itemDetailModalOverlay}>
        <View style={[eatmart_styles.eatm_screen_itemDetailModalContainer, { paddingBottom: insets.bottom }]}>
          <SafeAreaView style={eatmart_styles.eatm_screen_itemDetailModal}>
            <Animated.View 
              style={[
                eatmart_styles.eatm_screen_itemDetailHeader,
                { opacity: headerOpacity }
              ]}
            >
              <TouchableOpacity 
                onPress={handleClose} 
                style={eatmart_styles.eatm_screen_itemDetailHeaderButton}
                activeOpacity={0.7}
              >
                <Icon name="close" size={eatmart_scale(22)} color={EATMART_COLORS.text.primary} />
              </TouchableOpacity>
            </Animated.View>

            <Animated.ScrollView
              style={eatmart_styles.eatm_screen_itemDetailScrollView}
              showsVerticalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={16}
              bounces={true}
            >
              <View style={eatmart_styles.eatm_screen_itemDetailCarousel}>
                <Image 
                  source={{ uri: item.item_image }} 
                  style={eatmart_styles.eatm_screen_itemDetailImage}
                  resizeMode="cover"
                />
                
                {discountPercentage > 0 && (
                  <LinearGradient
                    colors={[EATMART_COLORS.primary, EATMART_COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={eatmart_styles.eatm_screen_itemDetailDiscountBadge}
                  >
                    <Text style={eatmart_styles.eatm_screen_itemDetailDiscountText}>{discountPercentage}% OFF</Text>
                  </LinearGradient>
                )}

                {item.express_delivery && (
                  <LinearGradient
                    colors={[EATMART_COLORS.success, EATMART_COLORS.successLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={eatmart_styles.eatm_screen_itemDetailExpressBadge}
                  >
                    <Icon name="flash" size={eatmart_scale(12)} color={EATMART_COLORS.white} />
                    <Text style={eatmart_styles.eatm_screen_itemDetailExpressText}>Express</Text>
                  </LinearGradient>
                )}
              </View>

              <View style={eatmart_styles.eatm_screen_itemDetailInfoSection}>
                {item.brand && (
                  <Text style={eatmart_styles.eatm_screen_itemDetailBrand}>{item.brand}</Text>
                )}

                <Text style={eatmart_styles.eatm_screen_itemDetailName}>{item.item_name}</Text>

                <Text style={eatmart_styles.eatm_screen_itemDetailWeight}>{item.unit}</Text>

                {item.rating && (
                  <View style={eatmart_styles.eatm_screen_itemDetailRatingContainer}>
                    <View style={eatmart_styles.eatm_screen_itemDetailRating}>
                      <Text style={eatmart_styles.eatm_screen_itemDetailRatingText}>{item.rating}</Text>
                      <Icon name="star" size={eatmart_scale(12)} color={EATMART_COLORS.white} />
                    </View>
                    {item.reviews && (
                      <Text style={eatmart_styles.eatm_screen_itemDetailReviews}>
                        ({item.reviews} reviews)
                      </Text>
                    )}
                  </View>
                )}

                <View style={eatmart_styles.eatm_screen_itemDetailPriceSection}>
                  <Text style={eatmart_styles.eatm_screen_itemDetailCurrentPrice}>₹{finalPrice}</Text>
                  {item.discount_price && (
                    <>
                      <Text style={eatmart_styles.eatm_screen_itemDetailOriginalPrice}>₹{originalPrice}</Text>
                      <View style={eatmart_styles.eatm_screen_itemDetailSavedBadge}>
                        <Text style={eatmart_styles.eatm_screen_itemDetailSavedPrice}>
                          Save ₹{parseInt(originalPrice) - parseInt(finalPrice)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {!item.in_stock && (
                  <View style={eatmart_styles.eatm_screen_itemDetailOutOfStock}>
                    <Icon name="alert-circle-outline" size={eatmart_scale(20)} color={EATMART_COLORS.danger} />
                    <Text style={eatmart_styles.eatm_screen_itemDetailOutOfStockText}>Out of Stock</Text>
                  </View>
                )}
              </View>

              {item.description && (
                <View style={eatmart_styles.eatm_screen_itemDetailSection}>
                  <Text style={eatmart_styles.eatm_screen_itemDetailSectionTitle}>Product Details</Text>
                  <View style={eatmart_styles.eatm_screen_itemDetailDescription}>
                    <Text 
                      style={eatmart_styles.eatm_screen_itemDetailDescriptionText}
                      numberOfLines={isDescriptionExpanded ? undefined : 3}
                    >
                      {item.description}
                    </Text>
                    {item.description.length > 100 && (
                      <TouchableOpacity 
                        onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        style={eatmart_styles.eatm_screen_itemDetailReadMore}
                      >
                        <Text style={eatmart_styles.eatm_screen_itemDetailReadMoreText}>
                          {isDescriptionExpanded ? 'Read less' : 'Read more'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {similarItems.length > 0 && (
                <View style={eatmart_styles.eatm_screen_itemDetailSection}>
                  <View style={eatmart_styles.eatm_screen_itemDetailSectionHeader}>
                    <Text style={eatmart_styles.eatm_screen_itemDetailSectionTitle}>You might also like</Text>
                    <TouchableOpacity>
                      <Text style={eatmart_styles.eatm_screen_itemDetailSectionViewAll}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <SimilarItemsList 
                    items={similarItems.slice(0, 6)} 
                    onItemPress={handleSimilarItemPress} 
                  />
                </View>
              )}
  
              <View style={{ height: eatmart_verticalScale(100) }} />
            </Animated.ScrollView>
  
            {item.in_stock && (
              <View style={eatmart_styles.eatm_screen_itemDetailBottomBar}>
                {quantity === 0 ? (
                  <TouchableOpacity 
                    style={eatmart_styles.eatm_screen_itemDetailAddButton}
                    onPress={handleAddToCart}
                    activeOpacity={0.9}
                  >
                    <Text style={eatmart_styles.eatm_screen_itemDetailAddButtonText}>ADD ITEM</Text>
                    <Text style={eatmart_styles.eatm_screen_itemDetailAddButtonPrice}>₹{finalPrice}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={eatmart_styles.eatm_screen_itemDetailQuantityContainer}>
                    <TouchableOpacity 
                      style={eatmart_styles.eatm_screen_itemDetailQuantityButton}
                      onPress={handleDecrement}
                      activeOpacity={0.7}
                    >
                      <Text style={eatmart_styles.eatm_screen_itemDetailQuantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={eatmart_styles.eatm_screen_itemDetailQuantityText}>{quantity}</Text>
                    <TouchableOpacity 
                      style={eatmart_styles.eatm_screen_itemDetailQuantityButton}
                      onPress={handleIncrement}
                      activeOpacity={0.7}
                    >
                      <Text style={eatmart_styles.eatm_screen_itemDetailQuantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
};

// ============== CATEGORY DETAILS ==============

interface CategoryDetailsProps {
  category: GroceryCategory;
  items: GroceryItem[];
  onItemPress: (item: GroceryItem) => void;
}

const CategoryDetails: React.FC<CategoryDetailsProps> = ({ category, items, onItemPress }) => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  
  const filters = ['all', 'under ₹99', 'best seller', 'new'];
  
  const filteredItems = useMemo(() => {
    let filtered = [...items];
    
    if (selectedFilter === 'under ₹99') {
      filtered = filtered.filter(item => parseInt(item.discount_price || item.price) < 99);
    } else if (selectedFilter === 'best seller') {
      filtered = filtered.filter(item => (item.reviews || 0) > 200);
    } else if (selectedFilter === 'new') {
      filtered = filtered.filter(item => item.is_new);
    }
    
    return filtered;
  }, [items, selectedFilter]);
  
  const renderHeader = () => (
    <>
      <View style={eatmart_styles.eatm_screen_categoryHeader}>
        <View style={eatmart_styles.eatm_screen_categoryHeaderIcon}>
          <Text style={eatmart_styles.eatm_screen_categoryHeaderEmoji}>{category.icon}</Text>
        </View>
        <View style={eatmart_styles.eatm_screen_categoryHeaderInfo}>
          <Text style={eatmart_styles.eatm_screen_categoryHeaderTitle}>{category.name}</Text>
          <Text style={eatmart_styles.eatm_screen_categoryHeaderSubtitle}>
            {items.length} items
          </Text>
        </View>
      </View>
  
      <View style={eatmart_styles.eatm_screen_filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={eatmart_styles.eatm_screen_filtersScrollContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                eatmart_styles.eatm_screen_filterChip,
                selectedFilter === filter && eatmart_styles.eatm_screen_filterChipActive
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[
                eatmart_styles.eatm_screen_filterChipText,
                selectedFilter === filter && eatmart_styles.eatm_screen_filterChipTextActive
              ]}>
                {filter === 'all' ? 'All' : filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </>
  );
  
  return (
    <View style={eatmart_styles.eatm_screen_categoryDetailsContainer}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.item_id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        columnWrapperStyle={eatmart_styles.eatm_screen_categoryGridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={eatmart_styles.eatm_screen_categoryGridContent}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            onPress={onItemPress}
          />
        )}
      />
    </View>
  );
};

// ============== MAIN SCREEN COMPONENT ==============

const EatmartScreenComponent: React.FC = () => {
  const navigation = useNavigation<any>();
  const { isGuest } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homeData, setHomeData] = useState<HomeScreenData | null>(null);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<{
    category: GroceryCategory;
    items: GroceryItem[];
  } | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isItemDetailsVisible, setIsItemDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GroceryItem | null>(null);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
  const fetchGroceryStores = useCallback(async (latitude?: number, longitude?: number) => {
    try {
      const data = await fetchHomeData(latitude, longitude);
      setHomeData(data);
    } catch (error) {
      console.error('Error fetching home data:', error);
      Alert.alert('Error', 'Failed to load grocery data. Please try again.');
    }
  }, []);
  
  const handleAddressUpdate = useCallback((newAddress: string, newHomeType: string, coords?: { lat: number; lng: number }) => {
    if (coords) {
      setLocation(coords);
      fetchGroceryStores(coords.lat, coords.lng);
    }
  }, [fetchGroceryStores]);
  
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (location) {
        await fetchGroceryStores(location.lat, location.lng);
      } else {
        await fetchGroceryStores();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fetchGroceryStores, location]);
  
  const handleCategoryPress = useCallback((categoryId: number, categoryName: string) => {
    if (!homeData) return;
    
    const category = homeData.categories.find(c => c.id === categoryId);
    const items = homeData.featuredItems.filter(item => item.category_id === categoryId);
    
    if (category) {
      setSelectedCategoryDetails({ category, items });
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [homeData]);
  
  const handleCloseCategoryDetails = useCallback(() => {
    setSelectedCategoryDetails(null);
  }, []);
  
  const handleItemPress = useCallback((item: GroceryItem) => {
    if (isGuest) {
      navigation.navigate('LoginScreen');
      return;
    }
    setSelectedItem(item);
    setIsItemDetailsVisible(true);
  }, [isGuest, navigation]);
  
  const handleSearchPress = useCallback(() => {
    setIsSearchModalVisible(true);
  }, []);
  
  const handleSearchClose = useCallback(() => {
    setIsSearchModalVisible(false);
  }, []);
  
  const handleCategorySelect = useCallback((categoryId: number, categoryName: string) => {
    handleCategoryPress(categoryId, categoryName);
    handleSearchClose();
  }, [handleCategoryPress, handleSearchClose]);
  
  const handleProfilePress = useCallback(() => {
    if (isGuest) {
      navigation.navigate('LoginScreen');
    } else {
      navigation.navigate('ProfileScreen');
    }
  }, [isGuest, navigation]);
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setIsHeaderCollapsed(offsetY > BANNER_HEIGHT - 50);
      }
    }
  );
  
  useEffect(() => {
    const init = async () => {
      await fetchGroceryStores();
      setLoading(false);
    };
    init();
  }, []);
  
  const headerHeight = scrollY.interpolate({
    inputRange: [0, BANNER_HEIGHT + eatmart_verticalScale(100)],
    outputRange: [EATMART_HEADER_HEIGHT + BANNER_HEIGHT, EATMART_MIN_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, BANNER_HEIGHT - 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  
  if (loading) {
    return (
      <View style={eatmart_styles.eatm_screen_loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={EATMART_COLORS.white} />
        <LinearGradient
          colors={[EATMART_COLORS.white, EATMART_COLORS.grayBg]}
          style={eatmart_styles.eatm_screen_loadingGradient}
        >
          <View style={eatmart_styles.eatm_screen_loadingIcon}>
            <Icon2 name="food" size={eatmart_scale(40)} color={EATMART_COLORS.white} />
          </View>
          <Text style={eatmart_styles.eatm_screen_loadingTitle}>Eatmart</Text>
          <Text style={eatmart_styles.eatm_screen_loadingText}>Grocery in minutes...</Text>
        </LinearGradient>
      </View>
    );
  }
  
  if (!homeData) {
    return (
      <View style={eatmart_styles.eatm_screen_errorContainer}>
        <LinearGradient
          colors={[EATMART_COLORS.white, EATMART_COLORS.grayBg]}
          style={eatmart_styles.eatm_screen_errorGradient}
        >
          <Icon name="alert-circle" size={eatmart_scale(64)} color={EATMART_COLORS.text.tertiary} />
          <Text style={eatmart_styles.eatm_screen_errorTitle}>Something went wrong</Text>
          <Text style={eatmart_styles.eatm_screen_errorText}>Unable to load stores</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); fetchGroceryStores().then(() => setLoading(false)); }}
            style={eatmart_styles.eatm_screen_errorButton}
            activeOpacity={0.8}
          >
            <Text style={eatmart_styles.eatm_screen_errorButtonText}>Try Again</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={eatmart_styles.eatm_screen_rootContainer}>
      
      <Animated.View style={[
        eatmart_styles.eatm_screen_header,
        {
          height: headerHeight,
          paddingTop: insets.top,
        }
      ]}>
        <Animated.View style={[
          eatmart_styles.eatm_screen_headerContent,
          { opacity: headerOpacity }
        ]}>
          <View style={eatmart_styles.eatm_screen_topBar}>
            <AddressHeader
              isGuest={isGuest}
              onAddressUpdate={handleAddressUpdate}
            />
            
            <TouchableOpacity
              style={eatmart_styles.eatm_screen_profileButton}
              onPress={handleProfilePress}
            >
              <Icon name="person-outline" size={eatmart_scale(20)} color={EATMART_COLORS.text.primary} />
            </TouchableOpacity>
          </View>
          
          <SearchBar onPress={handleSearchPress} />
        </Animated.View>
        
        {/* Full Width Banner Carousel */}
        <Animated.View style={{
          opacity: scrollY.interpolate({
            inputRange: [0, BANNER_HEIGHT - 30],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          })
        }}>
          {homeData.banners && homeData.banners.length > 0 && (
            <BannerCarousel banners={homeData.banners} />
          )}
        </Animated.View>
      </Animated.View>
      
      {isHeaderCollapsed && !selectedCategoryDetails && (
        <Animated.View style={[
          eatmart_styles.eatm_screen_compactHeader,
          {
            paddingTop: insets.top,
            opacity: scrollY.interpolate({
              inputRange: [BANNER_HEIGHT - 30, BANNER_HEIGHT + 10],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            })
          }
        ]}>
          <View style={eatmart_styles.eatm_screen_compactHeaderContent}>
            <TouchableOpacity
              style={eatmart_styles.eatm_screen_compactSearchButton}
              onPress={handleSearchPress}
            >
              <Icon name="search-outline" size={eatmart_scale(18)} color={EATMART_COLORS.text.secondary} />
              <Text style={eatmart_styles.eatm_screen_compactSearchText}>Search 'atta', 'sugar' & more</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={eatmart_styles.eatm_screen_compactProfileButton}
              onPress={handleProfilePress}
            >
              <Icon name="person-outline" size={eatmart_scale(18)} color={EATMART_COLORS.text.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      
      {selectedCategoryDetails ? (
        <ScrollView
          ref={scrollViewRef}
          style={eatmart_styles.eatm_screen_scrollView}
          contentContainerStyle={[
            eatmart_styles.eatm_screen_scrollContent,
            {
              paddingTop: EATMART_HEADER_HEIGHT + BANNER_HEIGHT + eatmart_verticalScale(16),
              paddingBottom: eatmart_verticalScale(80)
            }
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
        >
          <View style={eatmart_styles.eatm_screen_categoryDetailsBackButton}>
            <TouchableOpacity
              style={eatmart_styles.eatm_screen_backButton}
              onPress={handleCloseCategoryDetails}
              activeOpacity={0.8}
            >
              <Icon name="arrow-back" size={eatmart_scale(20)} color={EATMART_COLORS.primary} />
              <Text style={eatmart_styles.eatm_screen_backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
          
          <CategoryDetails
            category={selectedCategoryDetails.category}
            items={selectedCategoryDetails.items}
            onItemPress={handleItemPress}
          />
        </ScrollView>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={eatmart_styles.eatm_screen_scrollView}
          contentContainerStyle={[
            eatmart_styles.eatm_screen_scrollContent,
            {
              paddingTop: EATMART_HEADER_HEIGHT + BANNER_HEIGHT + eatmart_verticalScale(16),
              paddingBottom: eatmart_verticalScale(80)
            }
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={EATMART_COLORS.primary}
              colors={[EATMART_COLORS.primary]}
              progressViewOffset={EATMART_HEADER_HEIGHT + BANNER_HEIGHT}
            />
          }
        >
          {/* Modern Categories Section */}
          <View style={eatmart_styles.eatm_screen_categorySection}>
            <FlatList
              data={homeData.categories}
              renderItem={({ item }) => (
                <CategoryIcon
                  key={item.id}
                  category={item}
                  onPress={handleCategoryPress}
                />
              )}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={eatmart_styles.eatm_screen_categoryListContent}
            />
          </View>
          
          {/* Top Offers Banner */}
          {homeData.topOffers && homeData.topOffers.length > 0 && (
            <View style={eatmart_styles.eatm_screen_offersSection}>
              <SectionHeader title="Top Offers" showViewAll={false} />
              <FlatList
                data={homeData.topOffers.slice(0, 5)}
                renderItem={({ item, index }) => (
                  <OfferBanner item={item} index={index} />
                )}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={eatmart_styles.eatm_screen_offersListContent}
              />
            </View>
          )}
          
          {/* For You Section */}
          {homeData.forYou && homeData.forYou.length > 0 && (
            <View style={eatmart_styles.eatm_screen_forYouSection}>
              <SectionHeader title="For You" showViewAll={false} />
              <FlatList
                data={homeData.forYou.slice(0, 5)}
                renderItem={({ item, index }) => (
                  <OfferBanner item={item} index={index} />
                )}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={eatmart_styles.eatm_screen_offersListContent}
              />
            </View>
          )}
          
          {/* Featured Items */}
          {homeData.featuredItems && homeData.featuredItems.length > 0 && (
            <ProductGrid
              title="Popular Picks"
              subtitle="Based on your preferences"
              items={homeData.featuredItems}
              onItemPress={handleItemPress}
              onViewAll={() => {}}
            />
          )}
          
          <View style={{ height: eatmart_verticalScale(20) }} />
        </ScrollView>
      )}
      
      <CartBottomBar />
      
      <SearchModal
        visible={isSearchModalVisible}
        onClose={handleSearchClose}
        initialQuery=""
        categories={homeData.categories}
        onCategorySelect={handleCategorySelect}
      />
      
      {selectedItem && (
        <ItemDetails
          visible={isItemDetailsVisible}
          onClose={() => {
            setIsItemDetailsVisible(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
          similarItems={homeData?.featuredItems?.filter(
            i => i.category_id === selectedItem.category_id && i.item_id !== selectedItem.item_id
          ).slice(0, 10) || []}
          onItemPress={(item) => {
            setSelectedItem(item);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const InstamartStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InstamartHome" component={EatmartScreenComponent} />
    </Stack.Navigator>
  );
};

// ============== MODERN STYLES ==============

const eatmart_styles = StyleSheet.create({
  eatm_screen_rootContainer: {
    flex: 1,
    backgroundColor: EATMART_COLORS.background,
  },

  eatm_screen_loadingContainer: {
    flex: 1,
    backgroundColor: EATMART_COLORS.white,
  },
  eatm_screen_loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eatm_screen_loadingIcon: {
    width: eatmart_scale(80),
    height: eatmart_scale(80),
    borderRadius: eatmart_scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: EATMART_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: EATMART_COLORS.primary,
  },
  eatm_screen_loadingTitle: {
    ...EATMART_TYPOGRAPHY.h2,
    color: EATMART_COLORS.text.primary,
    marginTop: eatmart_verticalScale(20),
  },
  eatm_screen_loadingText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    marginTop: eatmart_verticalScale(8),
  },

  eatm_screen_errorContainer: {
    flex: 1,
    backgroundColor: EATMART_COLORS.white,
  },
  eatm_screen_errorGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(24),
  },
  eatm_screen_errorTitle: {
    ...EATMART_TYPOGRAPHY.h3,
    color: EATMART_COLORS.text.primary,
    marginTop: eatmart_verticalScale(16),
  },
  eatm_screen_errorText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    marginTop: eatmart_verticalScale(4),
    textAlign: 'center',
  },
  eatm_screen_errorButton: {
    marginTop: eatmart_verticalScale(24),
    paddingHorizontal: eatmart_scale(32),
    paddingVertical: eatmart_verticalScale(12),
    borderWidth: 1,
    borderColor: EATMART_COLORS.primary,
    borderRadius: eatmart_scale(30),
  },
  eatm_screen_errorButtonText: {
    ...EATMART_TYPOGRAPHY.button,
    color: EATMART_COLORS.primary,
  },
  eatm_screen_cartBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: eatmart_scale(16),
    overflow: 'hidden',
    shadowColor: EATMART_COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  eatm_screen_cartBarTouchable: {
    width: '100%',
  },
  eatm_screen_cartBarGradient: {
    width: '100%',
    paddingVertical: eatmart_verticalScale(14),
  },
  eatm_screen_cartBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: eatmart_scale(20),
  },
  eatm_screen_cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: eatmart_scale(12),
  },
  eatm_screen_cartIconContainer: {
    width: eatmart_scale(40),
    height: eatmart_scale(40),
    borderRadius: eatmart_scale(20),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eatm_screen_cartBarInfo: {
    marginLeft: eatmart_scale(4),
  },
  eatm_screen_cartBarItems: {
    ...EATMART_TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.9)',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_cartBarTotal: {
    ...EATMART_TYPOGRAPHY.body1,
    color: EATMART_COLORS.white,
    fontWeight: '700',
  },
  eatm_screen_cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: eatmart_scale(8),
  },
  eatm_screen_cartBarViewText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(12),
  },

  eatm_screen_header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'visible',
    backgroundColor: EATMART_COLORS.white,
    borderBottomWidth: 0,
    shadowColor: EATMART_COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  eatm_screen_headerContent: {
    paddingHorizontal: eatmart_scale(16),
    paddingTop: Platform.OS === 'ios' ? eatmart_verticalScale(8) : eatmart_verticalScale(4),
  },
  eatm_screen_topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: eatmart_verticalScale(12),
  },
  eatm_screen_profileButton: {
    width: eatmart_scale(40),
    height: eatmart_scale(40),
    borderRadius: eatmart_scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.grayBg,
  },

  eatm_screen_compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: EATMART_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: EATMART_COLORS.border.light,
  },
  eatm_screen_compactHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: eatmart_scale(16),
    height: EATMART_MIN_HEADER_HEIGHT,
    gap: eatmart_scale(12),
  },
  eatm_screen_compactSearchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.grayBg,
    paddingHorizontal: eatmart_scale(14),
    paddingVertical: eatmart_verticalScale(10),
    borderRadius: eatmart_scale(12),
    gap: eatmart_scale(10),
  },
  eatm_screen_compactSearchText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    fontSize: eatmart_fontScale(13),
  },
  eatm_screen_compactProfileButton: {
    width: eatmart_scale(40),
    height: eatmart_scale(40),
    borderRadius: eatmart_scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.grayBg,
  },

  eatm_screen_addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: eatmart_scale(8),
    backgroundColor: EATMART_COLORS.grayBg,
    paddingHorizontal: eatmart_scale(12),
    paddingVertical: eatmart_verticalScale(8),
    borderRadius: eatmart_scale(30),
    marginRight: eatmart_scale(12),
  },
  eatm_screen_addressIcon: {
    width: eatmart_scale(24),
    height: eatmart_scale(24),
    borderRadius: eatmart_scale(12),
    backgroundColor: 'rgba(255,107,53,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eatm_screen_addressTextContainer: {
    flex: 1,
  },
  eatm_screen_addressText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.primary,
    fontWeight: '500',
    fontSize: eatmart_fontScale(13),
  },

  eatm_screen_searchContainer: {
    marginBottom: eatmart_verticalScale(12),
  },
  eatm_screen_searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(16),
    paddingVertical: Platform.OS === 'ios' ? eatmart_verticalScale(12) : eatmart_verticalScale(10),
    gap: eatmart_scale(10),
    backgroundColor: EATMART_COLORS.grayBg,
    borderRadius: eatmart_scale(14),
  },
  eatm_screen_searchPlaceholder: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    flex: 1,
    fontSize: eatmart_fontScale(14),
  },
  eatm_screen_searchMicButton: {
    padding: eatmart_scale(4),
  },

  eatm_screen_bannerSection: {
    marginTop: eatmart_verticalScale(8),
  },
  eatm_screen_bannerContainer: {
    height: BANNER_HEIGHT,
    overflow: 'hidden',
  },
  eatm_screen_bannerTouchable: {
    width: '100%',
    height: '100%',
  },
  eatm_screen_bannerImage: {
    width: '100%',
    height: '100%',
  },
  eatm_screen_bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: eatmart_verticalScale(80),
    justifyContent: 'flex-end',
    padding: eatmart_scale(16),
  },
  eatm_screen_bannerTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eatm_screen_bannerTitle: {
    ...EATMART_TYPOGRAPHY.body1,
    color: EATMART_COLORS.white,
    fontWeight: '700',
    flex: 1,
    fontSize: eatmart_fontScale(16),
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  eatm_screen_bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: eatmart_scale(12),
    paddingVertical: eatmart_verticalScale(6),
    borderRadius: eatmart_scale(20),
    gap: eatmart_scale(4),
  },
  eatm_screen_bannerButtonText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(12),
  },
  eatm_screen_bannerPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: eatmart_verticalScale(12),
    gap: eatmart_scale(8),
  },
  eatm_screen_bannerDot: {
    height: eatmart_scale(6),
    borderRadius: eatmart_scale(3),
    transition: 'all 0.3s ease',
  },

  eatm_screen_categorySection: {
    marginBottom: eatmart_verticalScale(24),
  },
  eatm_screen_categoryListContent: {
    paddingHorizontal: eatmart_scale(16),
    gap: eatmart_scale(20),
  },
  eatm_screen_categoryIconContainer: {
    width: eatmart_scale(70),
    alignItems: 'center',
  },
  eatm_screen_categoryIconTouchable: {
    alignItems: 'center',
    width: '100%',
  },
  eatm_screen_categoryIconWrapper: {
    width: eatmart_scale(60),
    height: eatmart_scale(60),
    borderRadius: eatmart_scale(30),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: eatmart_verticalScale(6),
    backgroundColor: EATMART_COLORS.grayBg,
    shadowColor: EATMART_COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eatm_screen_categoryIconEmoji: {
    fontSize: eatmart_fontScale(30),
  },
  eatm_screen_categoryIconText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.primary,
    fontWeight: '500',
    textAlign: 'center',
    fontSize: eatmart_fontScale(12),
  },

  eatm_screen_offersSection: {
    marginBottom: eatmart_verticalScale(24),
  },
  eatm_screen_offersListContent: {
    paddingHorizontal: eatmart_scale(16),
    gap: eatmart_scale(12),
  },
  eatm_screen_offerBannerContainer: {
    width: eatmart_scale(280),
    height: eatmart_verticalScale(130),
    borderRadius: eatmart_scale(16),
    overflow: 'hidden',
    marginRight: eatmart_scale(12),
    position: 'relative',
  },
  eatm_screen_offerBannerImage: {
    width: '100%',
    height: '100%',
  },
  eatm_screen_offerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: eatmart_scale(12),
    paddingVertical: eatmart_verticalScale(8),
  },
  eatm_screen_offerText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
  },

  eatm_screen_productCard: {
    width: (screenWidth - eatmart_scale(48)) / 2,
    borderRadius: eatmart_scale(16),
    overflow: 'hidden',
    marginBottom: eatmart_verticalScale(16),
    backgroundColor: EATMART_COLORS.white,
    shadowColor: EATMART_COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eatm_screen_productImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  eatm_screen_productImage: {
    width: '100%',
    height: '100%',
  },
  eatm_screen_productDiscountBadge: {
    position: 'absolute',
    top: eatmart_scale(8),
    left: eatmart_scale(8),
    backgroundColor: EATMART_COLORS.primary,
    paddingHorizontal: eatmart_scale(8),
    paddingVertical: eatmart_verticalScale(4),
    borderRadius: eatmart_scale(6),
    zIndex: 1,
  },
  eatm_screen_productDiscountText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(10),
  },
  eatm_screen_productExpressBadge: {
    position: 'absolute',
    top: eatmart_scale(8),
    right: eatmart_scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.success,
    paddingHorizontal: eatmart_scale(6),
    paddingVertical: eatmart_verticalScale(3),
    borderRadius: eatmart_scale(6),
    gap: eatmart_scale(2),
    zIndex: 1,
  },
  eatm_screen_productExpressText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(9),
  },
  eatm_screen_productOutOfStock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  eatm_screen_productOutOfStockText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.danger,
    fontWeight: '600',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_productInfo: {
    padding: eatmart_scale(12),
  },
  eatm_screen_productName: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.primary,
    fontWeight: '500',
    marginBottom: eatmart_verticalScale(2),
    lineHeight: eatmart_fontScale(18),
  },
  eatm_screen_productWeight: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.tertiary,
    marginBottom: eatmart_verticalScale(6),
  },
  eatm_screen_productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: eatmart_scale(6),
    paddingVertical: eatmart_verticalScale(2),
    borderRadius: eatmart_scale(4),
    marginBottom: eatmart_verticalScale(8),
    gap: eatmart_scale(2),
    backgroundColor: EATMART_COLORS.rating,
  },
  eatm_screen_productRatingText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(10),
  },
  eatm_screen_productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eatm_screen_productPrice: {
    ...EATMART_TYPOGRAPHY.body1,
    color: EATMART_COLORS.text.primary,
    fontWeight: '700',
  },
  eatm_screen_productOriginalPrice: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  eatm_screen_addButton: {
    paddingHorizontal: eatmart_scale(14),
    paddingVertical: eatmart_verticalScale(6),
    backgroundColor: EATMART_COLORS.primary,
    borderRadius: eatmart_scale(8),
  },
  eatm_screen_addButtonText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.primary,
    borderRadius: eatmart_scale(8),
  },
  eatm_screen_quantityButton: {
    paddingHorizontal: eatmart_scale(10),
    paddingVertical: eatmart_verticalScale(4),
  },
  eatm_screen_quantityButtonText: {
    ...EATMART_TYPOGRAPHY.body1,
    color: EATMART_COLORS.white,
    fontWeight: '600',
  },
  eatm_screen_quantityText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    paddingHorizontal: eatmart_scale(8),
  },

  eatm_screen_sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(16),
    marginBottom: eatmart_verticalScale(16),
  },
  eatm_screen_sectionTitle: {
    ...EATMART_TYPOGRAPHY.h4,
    color: EATMART_COLORS.text.primary,
    fontWeight: '700',
  },
  eatm_screen_sectionSubtitle: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.secondary,
    marginTop: eatmart_verticalScale(2),
  },
  eatm_screen_sectionViewAll: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.primary,
    fontWeight: '600',
  },

  eatm_screen_productGridSection: {
    marginBottom: eatmart_verticalScale(24),
  },
  eatm_screen_gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: eatmart_scale(16),
    marginBottom: eatmart_verticalScale(12),
  },

  eatm_screen_searchModal: {
    flex: 1,
    backgroundColor: EATMART_COLORS.white,
  },
  eatm_screen_searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(16),
    paddingVertical: eatmart_verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: EATMART_COLORS.border.light,
  },
  eatm_screen_searchModalBack: {
    marginRight: eatmart_scale(12),
    padding: eatmart_scale(4),
  },
  eatm_screen_searchModalInputWrapper: {
    flex: 1,
  },
  eatm_screen_searchModalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.grayBg,
    borderRadius: eatmart_scale(12),
    paddingHorizontal: eatmart_scale(14),
    paddingVertical: Platform.OS === 'ios' ? eatmart_verticalScale(12) : eatmart_verticalScale(8),
  },
  eatm_screen_searchModalInput: {
    flex: 1,
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.primary,
    padding: 0,
    marginLeft: eatmart_scale(10),
    fontSize: eatmart_fontScale(16),
  },
  eatm_screen_searchModalClear: {
    padding: eatmart_scale(4),
  },
  eatm_screen_searchModalContent: {
    flex: 1,
  },
  eatm_screen_searchInitialContent: {
    paddingBottom: eatmart_verticalScale(20),
  },
  eatm_screen_searchSection: {
    paddingTop: eatmart_verticalScale(20),
    paddingHorizontal: eatmart_scale(16),
  },
  eatm_screen_searchSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: eatmart_verticalScale(12),
  },
  eatm_screen_searchSectionTitle: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.secondary,
    fontWeight: '600',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_searchSectionClear: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.primary,
    fontWeight: '500',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_recentList: {
    borderRadius: eatmart_scale(12),
    overflow: 'hidden',
  },
  eatm_screen_recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: eatmart_verticalScale(12),
    paddingHorizontal: eatmart_scale(12),
    borderBottomWidth: 1,
    borderBottomColor: EATMART_COLORS.border.light,
  },
  eatm_screen_recentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: eatmart_scale(12),
  },
  eatm_screen_recentText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.primary,
    flex: 1,
  },
  eatm_screen_recentRemove: {
    padding: eatmart_scale(4),
  },
  eatm_screen_popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -eatmart_scale(4),
    marginTop: eatmart_verticalScale(8),
  },
  eatm_screen_popularItem: {
    width: '25%',
    paddingHorizontal: eatmart_scale(4),
    marginBottom: eatmart_verticalScale(12),
  },
  eatm_screen_popularIcon: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: eatmart_verticalScale(6),
    backgroundColor: EATMART_COLORS.grayBg,
    borderRadius: eatmart_scale(16),
  },
  eatm_screen_popularEmoji: {
    fontSize: eatmart_fontScale(34),
  },
  eatm_screen_popularName: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
  eatm_screen_searchResults: {
    flex: 1,
    padding: eatmart_scale(16),
  },
  eatm_screen_searchResultsList: {
    paddingBottom: eatmart_verticalScale(20),
  },
  eatm_screen_searchLoading: {
    paddingVertical: eatmart_verticalScale(40),
    alignItems: 'center',
  },
  eatm_screen_searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: eatmart_verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: EATMART_COLORS.border.light,
  },
  eatm_screen_searchResultIcon: {
    width: eatmart_scale(50),
    height: eatmart_scale(50),
    borderRadius: eatmart_scale(25),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: eatmart_scale(14),
    backgroundColor: EATMART_COLORS.grayBg,
  },
  eatm_screen_searchResultEmoji: {
    fontSize: eatmart_fontScale(34),
  },
  eatm_screen_searchResultInfo: {
    flex: 1,
  },
  eatm_screen_searchResultName: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.primary,
    fontWeight: '500',
    marginBottom: eatmart_verticalScale(2),
  },
  eatm_screen_searchResultCount: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.secondary,
  },
  eatm_screen_searchNoResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: eatmart_verticalScale(80),
  },
  eatm_screen_searchNoResultsTitle: {
    ...EATMART_TYPOGRAPHY.h4,
    color: EATMART_COLORS.text.primary,
    marginTop: eatmart_verticalScale(16),
  },
  eatm_screen_searchNoResultsText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    marginTop: eatmart_verticalScale(4),
  },

  eatm_screen_scrollView: {
    flex: 1,
    backgroundColor: EATMART_COLORS.background,
  },
  eatm_screen_scrollContent: {
    paddingBottom: eatmart_verticalScale(100),
  },

  eatm_screen_categoryDetailsBackButton: {
    paddingHorizontal: eatmart_scale(16),
    marginBottom: eatmart_verticalScale(16),
  },
  eatm_screen_backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: eatmart_scale(6),
  },
  eatm_screen_backButtonText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.primary,
    fontWeight: '600',
  },

  eatm_screen_categoryDetailsContainer: {
    flex: 1,
  },
  eatm_screen_categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(16),
    marginBottom: eatmart_verticalScale(20),
  },
  eatm_screen_categoryHeaderIcon: {
    width: eatmart_scale(70),
    height: eatmart_scale(70),
    borderRadius: eatmart_scale(35),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: eatmart_scale(18),
    backgroundColor: EATMART_COLORS.grayBg,
  },
  eatm_screen_categoryHeaderEmoji: {
    fontSize: eatmart_fontScale(44),
  },
  eatm_screen_categoryHeaderInfo: {
    flex: 1,
  },
  eatm_screen_categoryHeaderTitle: {
    ...EATMART_TYPOGRAPHY.h3,
    color: EATMART_COLORS.text.primary,
    fontWeight: '700',
    marginBottom: eatmart_verticalScale(2),
  },
  eatm_screen_categoryHeaderSubtitle: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
  },
  eatm_screen_filterContainer: {
    paddingHorizontal: eatmart_scale(16),
    marginBottom: eatmart_verticalScale(20),
  },
  eatm_screen_filtersScrollContent: {
    gap: eatmart_scale(10),
  },
  eatm_screen_filterChip: {
    paddingHorizontal: eatmart_scale(18),
    paddingVertical: eatmart_verticalScale(8),
    borderRadius: eatmart_scale(30),
    borderWidth: 1,
    borderColor: EATMART_COLORS.border.default,
    backgroundColor: EATMART_COLORS.white,
  },
  eatm_screen_filterChipActive: {
    backgroundColor: EATMART_COLORS.primary,
    borderColor: EATMART_COLORS.primary,
  },
  eatm_screen_filterChipText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.secondary,
    fontWeight: '500',
  },
  eatm_screen_filterChipTextActive: {
    color: EATMART_COLORS.white,
  },
  eatm_screen_categoryGridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: eatmart_scale(16),
    marginBottom: eatmart_verticalScale(12),
  },
  eatm_screen_categoryGridContent: {
    paddingBottom: eatmart_verticalScale(20),
  },

  eatm_screen_similarItemsContainer: {
    paddingHorizontal: eatmart_scale(16),
    gap: eatmart_scale(12),
  },
  eatm_screen_similarItemCard: {
    width: eatmart_scale(130),
    borderRadius: eatmart_scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: EATMART_COLORS.border.light,
    backgroundColor: EATMART_COLORS.white,
    marginRight: eatmart_scale(12),
  },
  eatm_screen_similarItemImage: {
    width: '100%',
    height: eatmart_scale(130),
    backgroundColor: EATMART_COLORS.grayBg,
  },
  eatm_screen_similarItemInfo: {
    padding: eatmart_scale(10),
  },
  eatm_screen_similarItemName: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.primary,
    fontWeight: '500',
    fontSize: eatmart_fontScale(11),
    marginBottom: eatmart_verticalScale(2),
    lineHeight: eatmart_fontScale(14),
  },
  eatm_screen_similarItemWeight: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.tertiary,
    fontSize: eatmart_fontScale(10),
    marginBottom: eatmart_verticalScale(4),
  },
  eatm_screen_similarItemPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: eatmart_scale(6),
    flexWrap: 'wrap',
  },
  eatm_screen_similarItemPrice: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.primary,
    fontWeight: '700',
    fontSize: eatmart_fontScale(12),
  },
  eatm_screen_similarItemOriginalPrice: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.tertiary,
    textDecorationLine: 'line-through',
    fontSize: eatmart_fontScale(10),
  },

  eatm_screen_itemDetailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  eatm_screen_itemDetailModalContainer: {
    borderTopLeftRadius: eatmart_scale(24),
    borderTopRightRadius: eatmart_scale(24),
    overflow: 'hidden',
    height: screenHeight * 0.9,
    backgroundColor: EATMART_COLORS.white,
  },
  eatm_screen_itemDetailModal: {
    flex: 1,
  },
  eatm_screen_itemDetailHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(16),
    paddingVertical: eatmart_verticalScale(12),
    zIndex: 10,
  },
  eatm_screen_itemDetailHeaderButton: {
    width: eatmart_scale(44),
    height: eatmart_scale(44),
    borderRadius: eatmart_scale(22),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: EATMART_COLORS.white,
    shadowColor: EATMART_COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eatm_screen_itemDetailScrollView: {
    flex: 1,
  },
  eatm_screen_itemDetailCarousel: {
    position: 'relative',
    height: screenWidth,
  },
  eatm_screen_itemDetailImage: {
    width: screenWidth,
    height: screenWidth,
  },
  eatm_screen_itemDetailDiscountBadge: {
    position: 'absolute',
    top: eatmart_verticalScale(16),
    left: eatmart_scale(16),
    paddingHorizontal: eatmart_scale(12),
    paddingVertical: eatmart_verticalScale(6),
    borderRadius: eatmart_scale(8),
    zIndex: 5,
  },
  eatm_screen_itemDetailDiscountText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '700',
    fontSize: eatmart_fontScale(13),
  },
  eatm_screen_itemDetailExpressBadge: {
    position: 'absolute',
    top: eatmart_verticalScale(16),
    right: eatmart_scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(10),
    paddingVertical: eatmart_verticalScale(6),
    borderRadius: eatmart_scale(8),
    gap: eatmart_scale(4),
    zIndex: 5,
  },
  eatm_screen_itemDetailExpressText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_itemDetailInfoSection: {
    padding: eatmart_scale(20),
    borderBottomWidth: 1,
    borderBottomColor: EATMART_COLORS.border.light,
  },
  eatm_screen_itemDetailBrand: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.secondary,
    marginBottom: eatmart_verticalScale(4),
    fontSize: eatmart_fontScale(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eatm_screen_itemDetailName: {
    ...EATMART_TYPOGRAPHY.h3,
    color: EATMART_COLORS.text.primary,
    marginBottom: eatmart_verticalScale(4),
    fontWeight: '700',
    fontSize: eatmart_fontScale(24),
  },
  eatm_screen_itemDetailWeight: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    marginBottom: eatmart_verticalScale(8),
  },
  eatm_screen_itemDetailRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: eatmart_verticalScale(12),
    gap: eatmart_scale(8),
  },
  eatm_screen_itemDetailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(8),
    paddingVertical: eatmart_verticalScale(3),
    borderRadius: eatmart_scale(6),
    gap: eatmart_scale(4),
    backgroundColor: EATMART_COLORS.rating,
  },
  eatm_screen_itemDetailRatingText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.white,
    fontWeight: '600',
    fontSize: eatmart_fontScale(12),
  },
  eatm_screen_itemDetailReviews: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.text.secondary,
    fontSize: eatmart_fontScale(12),
  },
  eatm_screen_itemDetailPriceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: eatmart_scale(10),
    marginBottom: eatmart_verticalScale(12),
  },
  eatm_screen_itemDetailCurrentPrice: {
    ...EATMART_TYPOGRAPHY.h3,
    color: EATMART_COLORS.text.primary,
    fontWeight: '700',
    fontSize: eatmart_fontScale(24),
  },
  eatm_screen_itemDetailOriginalPrice: {
    ...EATMART_TYPOGRAPHY.body1,
    color: EATMART_COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  eatm_screen_itemDetailSavedBadge: {
    paddingHorizontal: eatmart_scale(8),
    paddingVertical: eatmart_verticalScale(3),
    borderRadius: eatmart_scale(6),
    backgroundColor: '#FFF5E6',
  },
  eatm_screen_itemDetailSavedPrice: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.success,
    fontWeight: '600',
    fontSize: eatmart_fontScale(11),
  },
  eatm_screen_itemDetailOutOfStock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: eatmart_scale(8),
    paddingVertical: eatmart_verticalScale(12),
    borderRadius: eatmart_scale(12),
    marginTop: eatmart_verticalScale(8),
    backgroundColor: EATMART_COLORS.grayBg,
  },
  eatm_screen_itemDetailOutOfStockText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.danger,
    fontWeight: '600',
  },
  eatm_screen_itemDetailSection: {
    padding: eatmart_scale(20),
    borderBottomWidth: 1,
    borderBottomColor: EATMART_COLORS.border.light,
  },
  eatm_screen_itemDetailSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: eatmart_verticalScale(16),
  },
  eatm_screen_itemDetailSectionTitle: {
    ...EATMART_TYPOGRAPHY.h4,
    color: EATMART_COLORS.text.primary,
    fontWeight: '700',
  },
  eatm_screen_itemDetailSectionViewAll: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.primary,
    fontWeight: '600',
  },
  eatm_screen_itemDetailDescription: {
    marginBottom: eatmart_verticalScale(16),
  },
  eatm_screen_itemDetailDescriptionText: {
    ...EATMART_TYPOGRAPHY.body2,
    color: EATMART_COLORS.text.secondary,
    lineHeight: eatmart_fontScale(22),
    fontSize: eatmart_fontScale(14),
  },
  eatm_screen_itemDetailReadMore: {
    marginTop: eatmart_verticalScale(6),
  },
  eatm_screen_itemDetailReadMoreText: {
    ...EATMART_TYPOGRAPHY.caption,
    color: EATMART_COLORS.primary,
    fontWeight: '600',
    fontSize: eatmart_fontScale(12),
  },
  eatm_screen_itemDetailBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: EATMART_COLORS.border.light,
    paddingHorizontal: eatmart_scale(20),
    paddingTop: eatmart_verticalScale(12),
    paddingBottom: eatmart_verticalScale(16),
    backgroundColor: EATMART_COLORS.white,
    shadowColor: EATMART_COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 10,
  },
  eatm_screen_itemDetailAddButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: eatmart_scale(20),
    paddingVertical: eatmart_verticalScale(14),
    borderRadius: eatmart_scale(12),
    backgroundColor: EATMART_COLORS.primary,
  },
  eatm_screen_itemDetailAddButtonText: {
    ...EATMART_TYPOGRAPHY.button,
    color: EATMART_COLORS.white,
    fontSize: eatmart_fontScale(14),
    fontWeight: '600',
  },
  eatm_screen_itemDetailAddButtonPrice: {
    ...EATMART_TYPOGRAPHY.button,
    color: EATMART_COLORS.white,
    fontSize: eatmart_fontScale(14),
    fontWeight: '600',
  },
  eatm_screen_itemDetailQuantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: EATMART_COLORS.primary,
    borderRadius: eatmart_scale(12),
    padding: eatmart_scale(4),
    backgroundColor: EATMART_COLORS.white,
  },
  eatm_screen_itemDetailQuantityButton: {
    width: eatmart_scale(48),
    height: eatmart_scale(48),
    justifyContent: 'center',
    alignItems: 'center',
  },
  eatm_screen_itemDetailQuantityButtonText: {
    ...EATMART_TYPOGRAPHY.h3,
    color: EATMART_COLORS.primary,
    fontWeight: '600',
    fontSize: eatmart_fontScale(20),
  },
  eatm_screen_itemDetailQuantityText: {
    ...EATMART_TYPOGRAPHY.h3,
    color: EATMART_COLORS.text.primary,
    fontWeight: '600',
    minWidth: eatmart_scale(50),
    textAlign: 'center',
    fontSize: eatmart_fontScale(18),
  },

  eatm_screen_forYouSection: {
    marginBottom: eatmart_verticalScale(24),
  },
});

// ============== EXPORT ==============

const EatmartScreen = () => {
  const insets = useSafeAreaInsets();

  return (
    <CartProvider>
      <View style={[eatmart_styles.eatm_screen_rootContainer, { paddingBottom: insets.bottom }]}>
        <InstamartStackNavigator />
      </View>
    </CartProvider>
  );
};

export default EatmartScreen;