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

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// ============== CONSTANTS & CONFIGURATION ==============

const { width, height } = Dimensions.get('window');
const screenWidth = width;
const screenHeight = height;

// Responsive sizing functions
const scale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  return Math.round(size * Math.min(1.3, Math.max(0.8, scaleFactor)));
};

const verticalScale = (size: number) => {
  const baseHeight = 812;
  const scaleFactor = screenHeight / baseHeight;
  return Math.round(size * Math.min(1.3, Math.max(0.8, scaleFactor)));
};

const fontScale = (size: number) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  const scaledSize = size * Math.min(1.2, Math.max(0.85, scaleFactor));
  return Math.round(scaledSize);
};

// Color palette with black, white, and #E55C18
const COLORS = {
  primary: '#E55C18',
  primaryLight: '#F5A76C',
  primaryDark: '#B3430E',
  secondary: '#000000',
  secondaryLight: '#333333',
  secondaryDark: '#000000',
  success: '#28A745',
  successLight: '#48C768',
  warning: '#FFC107',
  danger: '#DC3545',
  background: '#FFFFFF',
  card: '#FFFFFF',
  cardAlt: '#F8F8F8',
  text: {
    primary: '#000000',
    secondary: '#666666',
    tertiary: '#999999',
    light: '#FFFFFF',
    inverse: '#FFFFFF',
  },
  border: {
    light: '#EEEEEE',
    default: '#DDDDDD',
    dark: '#CCCCCC',
  },
  grayBg: '#F5F5F5',
  grayLight: '#FAFAFA',
  grayDark: '#E0E0E0',
  overlay: 'rgba(0,0,0,0.5)',
  white: '#FFFFFF',
  black: '#000000',
};

const TYPOGRAPHY = {
  h1: { fontSize: fontScale(32), lineHeight: fontScale(38), fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: fontScale(28), lineHeight: fontScale(34), fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: fontScale(24), lineHeight: fontScale(30), fontWeight: '600' as const },
  h4: { fontSize: fontScale(20), lineHeight: fontScale(26), fontWeight: '600' as const },
  body1: { fontSize: fontScale(16), lineHeight: fontScale(24), fontWeight: '400' as const },
  body2: { fontSize: fontScale(14), lineHeight: fontScale(20), fontWeight: '400' as const },
  caption: { fontSize: fontScale(12), lineHeight: fontScale(16), fontWeight: '400' as const },
  button: { fontSize: fontScale(16), lineHeight: fontScale(20), fontWeight: '600' as const, letterSpacing: 0.3 },
};

const HEADER_HEIGHT = Platform.OS === 'ios' ? verticalScale(160) : verticalScale(150);
const MIN_HEADER_HEIGHT = Platform.OS === 'ios' ? verticalScale(65) : verticalScale(60);
const STICKY_HEADER_HEIGHT = verticalScale(65);

const STORAGE_KEYS = {
  ADDRESS_ID: 'AddressId',
  STREET_ADDRESS: 'StreetAddress',
  HOME_TYPE: 'HomeType',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  RECENT_SEARCHES: 'eatoorRecentSearches',
  CART_ITEMS: 'eatoorCartItems',
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
}

interface ApiHomeData {
  CategoryList: ApiCategoryItem[];
  banner_images: ApiBannerItem[];
  FeaturedItemsList: ApiGroceryItem[];
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
}

interface HomeScreenData {
  categories: GroceryCategory[];
  banners: BannerItem[];
  featuredItems: GroceryItem[];
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
      const savedCart = await AsyncStorage.getItem(STORAGE_KEYS.CART_ITEMS);
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const saveCartToStorage = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CART_ITEMS, JSON.stringify(cartItems));
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

const mapApiResponseToHomeData = (apiData: ApiHomeData): HomeScreenData => ({
  categories: (apiData.CategoryList || []).map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    icon_type: cat.icon_type || 'emoji',
    item_count: cat.item_count || 0,
    is_active: cat.is_active,
    sort_order: cat.sort_order
  })),
  banners: (apiData.banner_images || []).map(banner => ({
    id: banner.id,
    name: banner.name,
    icon: banner.icon,
    document_type: banner.document_type,
    thumbnail: banner.thumbnail
  })),
  featuredItems: (apiData.FeaturedItemsList || []).map(item => ({
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
    tags: item.tags
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

// ============== COMING SOON MODAL ==============

interface ComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
}

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({ visible, onClose }) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.comingSoonContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.comingSoonContent}>
            <View style={styles.comingSoonIconWrapper}>
              <View style={[styles.comingSoonIconBackground, { backgroundColor: COLORS.primary }]}>
                <Icon2 name="rocket-launch" size={scale(36)} color={COLORS.white} />
              </View>
            </View>

            <Text style={styles.comingSoonTitle}>Coming Soon! 🚀</Text>
            <Text style={styles.comingSoonMessage}>
              We're cooking up something amazing. Stay tuned for delicious updates!
            </Text>

            <TouchableOpacity
              style={[styles.comingSoonButton, { backgroundColor: COLORS.primary }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.comingSoonButtonText}>Got It</Text>
              <Icon name="arrow-forward" size={scale(18)} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// ============== CART BOTTOM BAR ==============

const CartBottomBar: React.FC = () => {
  const navigation = useNavigation<any>();
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const { isGuest } = useContext(AuthContext);
  
  const [showComingSoon, setShowComingSoon] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;
  
  const totalItems = cart.getTotalItems();
  const totalPrice = cart.getTotalPrice();
  const cartItems = cart.cartItems.slice(0, 3);
  
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
    <>
      <Animated.View
        style={[
          styles.cartBottomBar,
          {
            transform: [{ translateY: slideAnim }],
            bottom: insets.bottom + verticalScale(40),
            marginHorizontal: scale(16)
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleCartPress}
          style={styles.cartBarTouchable}
        >
          <View style={[styles.cartBarGradient, { backgroundColor: COLORS.primary }]}>
            <View style={styles.cartBarContent}>
              <View style={styles.cartBarLeft}>
                <View style={styles.cartItemPreviews}>
                  {cartItems.map((item, index) => (
                    <Image
                      key={item.item_id}
                      source={{ uri: item.item_image }}
                      style={[
                        styles.cartPreviewImage,
                        { marginLeft: index > 0 ? -scale(10) : 0, borderColor: COLORS.white }
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.cartBarInfo}>
                  <Text style={styles.cartBarItems}>
                    {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </Text>
                  <Text style={styles.cartBarTotal}>
                    ₹{totalPrice.toFixed(0)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.cartBarRight}>
                <Text style={styles.cartBarViewText}>View Cart</Text>
                <Icon name="arrow-forward-circle" size={scale(24)} color={COLORS.white} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
      
      <ComingSoonModal
        visible={showComingSoon}
        onClose={() => setShowComingSoon(false)}
      />
    </>
  );
};

// ============== SEARCH BAR ==============

interface SearchBarProps {
  onPress: () => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onPress,
  placeholder = "Search for groceries..."
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.searchContainer, { backgroundColor: COLORS.white }]}
    >
      <View style={[styles.searchContent, { borderColor: COLORS.border.light, backgroundColor: COLORS.grayBg }]}>
        <Icon name="search" size={scale(18)} color={COLORS.primary} />
        <Text style={styles.searchPlaceholder} numberOfLines={1}>
          {placeholder}
        </Text>
        <View style={[styles.searchDivider, { backgroundColor: COLORS.border.default }]} />
        <Icon2 name="tune" size={scale(18)} color={COLORS.text.secondary} />
      </View>
    </TouchableOpacity>
  );
};

// ============== CATEGORY ICON ==============

interface CategoryIconProps {
  category: GroceryCategory;
  onPress: (id: number, name: string) => void;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ category, onPress }) => {
  const scaleValue = useRef(new Animated.Value(1)).current;
  
  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.92,
      friction: 5,
      tension: 300,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };
  
  return (
    <Animated.View style={[styles.categoryIconContainer, { transform: [{ scale: scaleValue }] }]}>
      <TouchableOpacity
        style={styles.categoryIconTouchable}
        onPress={() => onPress(category.id, category.name)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <View style={[styles.categoryIconWrapper, { backgroundColor: COLORS.white, borderColor: COLORS.border.light }]}>
          <Text style={styles.categoryIconEmoji}>{category.icon}</Text>
        </View>
        <Text style={styles.categoryIconText} numberOfLines={2}>
          {category.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============== BANNER CAROUSEL ==============

interface BannerProps {
  banners: BannerItem[];
}

const BannerCarousel: React.FC<BannerProps> = ({ banners }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const autoPlayTimerRef = useRef<NodeJS.Timeout>();
  
  // Banner dimensions
  const BANNER_WIDTH = screenWidth - scale(32);
  const BANNER_SPACING = scale(16);
  
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
        viewPosition: 0.5 // Center the item
      });
      setActiveIndex(nextIndex);
    }, 3000);
  };
  
  const handleScrollBegin = () => {
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
    }
  };
  
  const handleMomentumScrollEnd = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (BANNER_WIDTH + BANNER_SPACING));
    setActiveIndex(index);
    startAutoPlay();
  };
  
  const handleScroll = (event: any) => {
    scrollX.setValue(event.nativeEvent.contentOffset.x);
  };
  
  const getItemLayout = (data: any, index: number) => ({
    length: BANNER_WIDTH + BANNER_SPACING,
    offset: (BANNER_WIDTH + BANNER_SPACING) * index,
    index,
  });
  
  if (!banners || banners.length === 0) return null;
  
  const renderBanner = ({ item, index }: { item: BannerItem; index: number }) => {
    const inputRange = [
      (index - 1) * (BANNER_WIDTH + BANNER_SPACING),
      index * (BANNER_WIDTH + BANNER_SPACING),
      (index + 1) * (BANNER_WIDTH + BANNER_SPACING),
    ];
    
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });
    
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.6, 1, 0.6],
      extrapolate: 'clamp',
    });
    
    return (
      <Animated.View style={[
        styles.bannerContainer,
        {
          width: BANNER_WIDTH,
          marginRight: BANNER_SPACING,
          transform: [{ scale }],
          opacity
        }
      ]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {}}
          style={styles.bannerTouchable}
        >
          <Image
            source={{ uri: item.icon || item.thumbnail }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.bannerSection}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item, index) => item.id || index.toString()}
        decelerationRate="fast"
        snapToInterval={BANNER_WIDTH + BANNER_SPACING}
        snapToAlignment="center"
        contentContainerStyle={styles.bannerListContent}
        getItemLayout={getItemLayout}
      />
      
      {banners.length > 1 && (
        <View style={styles.bannerPagination}>
          {banners.map((_, index) => {
            const inputRange = [
              (index - 1) * (BANNER_WIDTH + BANNER_SPACING),
              index * (BANNER_WIDTH + BANNER_SPACING),
              (index + 1) * (BANNER_WIDTH + BANNER_SPACING),
            ];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [scale(6), scale(20), scale(6)],
              extrapolate: 'clamp',
            });
            
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles.bannerDot,
                  {
                    width: dotWidth,
                    opacity,
                    backgroundColor: index === activeIndex ? COLORS.primary : COLORS.white,
                  }
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

// ============== PRODUCT CARD ==============

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
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const finalPrice = item.discount_price || item.price;
  const discountPercentage = item.discount_price ?
    Math.round((1 - parseFloat(item.discount_price) / parseFloat(item.price)) * 100) : 0;

  return (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: COLORS.white, borderColor: COLORS.border.light }]}
      onPress={() => onPress(item)}
      activeOpacity={0.95}
    >
      <View style={[styles.productImageContainer, { backgroundColor: COLORS.grayBg }]}>
        <Image
          source={{ uri: item.item_image }}
          style={styles.productImage}
          resizeMode="cover"
        />
        
        {discountPercentage > 0 && (
          <View style={[styles.productDiscountBadge, { backgroundColor: COLORS.primary }]}>
            <Text style={styles.productDiscountText}>{discountPercentage}% OFF</Text>
          </View>
        )}
        
        {item.is_organic && (
          <View style={[styles.productOrganicBadge, { backgroundColor: COLORS.success }]}>
            <Icon2 name="leaf" size={scale(12)} color={COLORS.white} />
          </View>
        )}
        
        {!item.in_stock && (
          <View style={[styles.productOutOfStock, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <Text style={styles.productOutOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>
      
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.item_name}
        </Text>
        
        <View style={styles.productRatingContainer}>
          {item.rating && (
            <View style={[styles.productRating, { backgroundColor: '#FFF5E6' }]}>
              <Icon name="star" size={scale(10)} color="#FFB800" />
              <Text style={styles.productRatingText}>{item.rating}</Text>
            </View>
          )}
          <Text style={styles.productWeight}>{item.unit}</Text>
        </View>
        
        <View style={styles.productFooter}>
          <View>
            <Text style={styles.productPrice}>₹{finalPrice}</Text>
            {item.discount_price && (
              <Text style={styles.productOriginalPrice}>₹{item.price}</Text>
            )}
          </View>
          
          {quantity === 0 ? (
            <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddToCart}
                activeOpacity={0.8}
              >
                <View style={[styles.addButtonGradient, { backgroundColor: COLORS.primary }]}>
                  <Icon name="add" size={scale(16)} color={COLORS.white} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View style={[styles.quantityControl, { backgroundColor: '#FFF5E6' }]}>
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: COLORS.white }]}
                onPress={(e) => {
                  e.stopPropagation();
                  cart.decrementQuantity(item.item_id);
                }}
              >
                <Icon name="remove" size={scale(12)} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={[styles.quantityButton, { backgroundColor: COLORS.white }]}
                onPress={(e) => {
                  e.stopPropagation();
                  if (isGuest) {
                    navigation.navigate('LoginScreen');
                    return;
                  }
                  cart.incrementQuantity(item.item_id);
                }}
              >
                <Icon name="add" size={scale(12)} color={COLORS.primary} />
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
  onViewAll?: () => void;
  showViewAll?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onViewAll,
  showViewAll = true
}) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showViewAll && onViewAll && (
        <TouchableOpacity onPress={onViewAll}>
          <Text style={[styles.sectionViewAll, { color: COLORS.primary }]}>View All</Text>
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
  onViewAll?: () => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  items,
  onItemPress,
  title,
  onViewAll
}) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.productGridSection}>
      {title && (
        <SectionHeader
          title={title}
          onViewAll={onViewAll}
          showViewAll={items.length > 6}
        />
      )}
      <FlatList
        data={items.slice(0, 6)}
        keyExtractor={(item) => item.item_id}
        numColumns={2}
        scrollEnabled={false}
        columnWrapperStyle={styles.gridRow}
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

// ============== SEARCH MODAL ==============

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
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
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
      await AsyncStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
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
    await AsyncStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(updated));
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
      <SafeAreaView style={[styles.searchModal, { paddingTop: insets.top, backgroundColor: COLORS.white }]}>
        <View style={[styles.searchModalHeader, { borderBottomColor: COLORS.border.light }]}>
          <TouchableOpacity onPress={onClose} style={styles.searchModalBack}>
            <Icon name="arrow-back" size={scale(22)} color={COLORS.black} />
          </TouchableOpacity>
          
          <View style={styles.searchModalInputWrapper}>
            <View style={[styles.searchModalInputContainer, { backgroundColor: COLORS.grayBg, borderColor: COLORS.border.light }]}>
              <Icon name="search-outline" size={scale(16)} color={COLORS.text.secondary} />
              <TextInput
                ref={inputRef}
                style={styles.searchModalInput}
                placeholder="Search for groceries & essentials"
                placeholderTextColor={COLORS.text.tertiary}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSubmit}
                returnKeyType="search"
                clearButtonMode="never"
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.searchModalClear}>
                  <Icon name="close-circle" size={scale(18)} color={COLORS.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.searchModalContent}>
          {searchText.length === 0 ? (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.searchInitialContent}
            >
              {recentSearches.length > 0 && (
                <View style={styles.searchSection}>
                  <View style={styles.searchSectionHeader}>
                    <Text style={styles.searchSectionTitle}>Recent Searches</Text>
                    <TouchableOpacity onPress={() => setRecentSearches([])}>
                      <Text style={[styles.searchSectionClear, { color: COLORS.primary }]}>Clear all</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.recentList, { backgroundColor: COLORS.grayBg }]}>
                    {recentSearches.map((search, index) => (
                      <View key={index} style={[styles.recentItem, { borderBottomColor: COLORS.border.light }]}>
                        <TouchableOpacity 
                          style={styles.recentContent}
                          onPress={() => setSearchText(search)}
                        >
                          <Icon name="time-outline" size={scale(16)} color={COLORS.text.secondary} />
                          <Text style={styles.recentText} numberOfLines={1}>
                            {search}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => removeRecentSearch(search)}
                          style={styles.recentRemove}
                        >
                          <Icon name="close" size={scale(14)} color={COLORS.text.tertiary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.searchSection}>
                <Text style={styles.searchSectionTitle}>Popular Categories</Text>
                <View style={styles.popularGrid}>
                  {categories.slice(0, 8).map((cat) => (
                    <TouchableOpacity 
                      key={cat.id} 
                      style={styles.popularItem}
                      onPress={() => handleCategorySelect(cat.id, cat.name)}
                    >
                      <View style={styles.popularIcon}>
                        <Text style={styles.popularEmoji}>{cat.icon}</Text>
                      </View>
                      <Text style={styles.popularName} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.searchResults}>
              {isSearching ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : searchResults.length > 0 ? (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.searchResultItem, { borderBottomColor: COLORS.border.light }]}
                      onPress={() => handleCategorySelect(item.id, item.name)}
                    >
                      <View style={styles.searchResultIcon}>
                        <Text style={styles.searchResultEmoji}>{item.icon}</Text>
                      </View>
                      <View style={styles.searchResultInfo}>
                        <Text style={styles.searchResultName}>{item.name}</Text>
                        <Text style={styles.searchResultCount}>
                          {item.item_count} items
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={scale(16)} color={COLORS.text.tertiary} />
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.searchResultsList}
                />
              ) : (
                <View style={styles.searchNoResults}>
                  <View style={styles.searchNoResultsIcon}>
                    <Icon name="search-outline" size={scale(48)} color={COLORS.text.tertiary} />
                  </View>
                  <Text style={styles.searchNoResultsTitle}>No results found</Text>
                  <Text style={styles.searchNoResultsText}>
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
        [STORAGE_KEYS.STREET_ADDRESS, addressData.full_address],
        [STORAGE_KEYS.HOME_TYPE, addressData.home_type || 'Home'],
        [STORAGE_KEYS.LATITUDE, addressData.latitude],
        [STORAGE_KEYS.LONGITUDE, addressData.longitude],
      ]);
    } catch (error) {
      console.error('Error saving address:', error);
    }
  }, []);

  const getSavedAddressDetails = useCallback(async () => {
    try {
      const [savedAddress, savedHomeType, savedLat, savedLng] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STREET_ADDRESS),
        AsyncStorage.getItem(STORAGE_KEYS.HOME_TYPE),
        AsyncStorage.getItem(STORAGE_KEYS.LATITUDE),
        AsyncStorage.getItem(STORAGE_KEYS.LONGITUDE),
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
            message: 'App needs access to your location to show nearby stores',
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
      activeOpacity={0.8}
      style={styles.addressContainer}
    >
      <View style={[styles.addressIcon, { backgroundColor: '#FFE5D9' }]}>
        <Icon name="location" size={scale(14)} color={COLORS.primary} />
      </View>
      <View style={styles.addressTextContainer}>
        <View style={styles.addressRow}>
          <Text style={styles.addressText} numberOfLines={1}>
            {displayAddress}
          </Text>
          {!location.loading && !location.error && (
            <>
              <Text style={styles.addressSeparator}>•</Text>
              <Text style={[styles.homeTypeBadge, { color: COLORS.primary }]}>
                {location.homeType}
              </Text>
            </>
          )}
          <Icon name="chevron-down" size={scale(16)} color={COLORS.text.secondary} />
        </View>
      </View>
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
      style={[styles.similarItemCard, { backgroundColor: COLORS.white, borderColor: COLORS.border.light }]}
      onPress={() => onItemPress(item)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.item_image }} 
        style={[styles.similarItemImage, { backgroundColor: COLORS.grayBg }]}
        resizeMode="cover"
      />
      <View style={styles.similarItemInfo}>
        <Text style={styles.similarItemName} numberOfLines={2}>
          {item.item_name}
        </Text>
        <Text style={styles.similarItemWeight}>
          {item.unit}
        </Text>
        <View style={styles.similarItemPriceContainer}>
          <Text style={styles.similarItemPrice}>
            ₹{item.discount_price || item.price}
          </Text>
          {item.discount_price && (
            <Text style={styles.similarItemOriginalPrice}>
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
      contentContainerStyle={styles.similarItemsContainer}
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
  const [isFavorite, setIsFavorite] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
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

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  const handleSimilarItemPress = (similarItem: GroceryItem) => {
    if (onItemPress) {
      onItemPress(similarItem);
    } else {
      handleClose();
    }
  };

  const renderImage = ({ item: imageUrl, index }: { item: string; index: number }) => (
    <View style={[styles.itemDetailImageContainer, { backgroundColor: COLORS.grayBg }]}>
      <Image 
        source={{ uri: imageUrl }} 
        style={styles.itemDetailImage}
        resizeMode="cover"
      />
    </View>
  );

  const onMomentumScrollEnd = (event: any) => {
    const index = Math.floor(event.nativeEvent.contentOffset.x / screenWidth);
    setActiveImageIndex(index);
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

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
      <View style={styles.itemDetailModalOverlay}>
        <View style={[styles.itemDetailModalContainer, { paddingBottom: insets.bottom, backgroundColor: COLORS.white }]}>
          <SafeAreaView style={styles.itemDetailModal}>
            <Animated.View 
              style={[
                styles.itemDetailHeader,
                { opacity: headerOpacity, backgroundColor: COLORS.white, borderBottomColor: COLORS.border.light }
              ]}
            >
              <TouchableOpacity 
                onPress={handleClose} 
                style={[styles.itemDetailHeaderButton, { backgroundColor: COLORS.white }]}
                activeOpacity={0.7}
              >
                <Icon name="close" size={scale(20)} color={COLORS.black} />
              </TouchableOpacity>
              
              <View style={styles.itemDetailHeaderActions}>
                <TouchableOpacity 
                  style={[styles.itemDetailHeaderButton, { backgroundColor: COLORS.white }]}
                  onPress={handleFavorite}
                  activeOpacity={0.7}
                >
                  <Icon 
                    name={isFavorite ? "heart" : "heart-outline"} 
                    size={scale(18)} 
                    color={isFavorite ? COLORS.danger : COLORS.black} 
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>

            <Animated.ScrollView
              style={styles.itemDetailScrollView}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              bounces={true}
            >
              <View style={styles.itemDetailCarousel}>
                <FlatList
                  ref={flatListRef}
                  data={[item.item_image, item.item_image, item.item_image]}
                  renderItem={renderImage}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onMomentumScrollEnd}
                  keyExtractor={(_, index) => `image-${index}`}
                  decelerationRate="fast"
                />
                
                <View style={styles.itemDetailPagination}>
                  {[0, 1, 2].map((index) => (
                    <View
                      key={index}
                      style={[
                        styles.itemDetailDot,
                        { backgroundColor: index === activeImageIndex ? COLORS.primary : 'rgba(255,255,255,0.5)' },
                        index === activeImageIndex && styles.itemDetailDotActive,
                      ]}
                    />
                  ))}
                </View>

                {discountPercentage > 0 && (
                  <View style={[styles.itemDetailDiscountBadge, { backgroundColor: COLORS.primary }]}>
                    <Text style={styles.itemDetailDiscountText}>{discountPercentage}% OFF</Text>
                  </View>
                )}

                {item.is_organic && (
                  <View style={[styles.itemDetailOrganicBadge, { backgroundColor: COLORS.success }]}>
                    <Icon name="leaf" size={scale(14)} color={COLORS.white} />
                    <Text style={styles.itemDetailOrganicText}>Organic</Text>
                  </View>
                )}
              </View>

              <View style={[styles.itemDetailInfoSection, { borderBottomColor: COLORS.border.light, backgroundColor: COLORS.white }]}>
                {item.brand && (
                  <Text style={styles.itemDetailBrand}>{item.brand}</Text>
                )}

                <Text style={styles.itemDetailName}>{item.item_name}</Text>

                {item.rating && (
                  <View style={styles.itemDetailRatingContainer}>
                    <View style={[styles.itemDetailRating, { backgroundColor: '#FFF5E6' }]}>
                      <Icon name="star" size={scale(14)} color="#FFB800" />
                      <Text style={styles.itemDetailRatingText}>{item.rating}</Text>
                    </View>
                    {item.reviews && (
                      <Text style={styles.itemDetailReviews}>
                        ({item.reviews} reviews)
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.itemDetailPriceSection}>
                  <View style={styles.itemDetailPriceContainer}>
                    <Text style={styles.itemDetailCurrentPrice}>₹{finalPrice}</Text>
                    {item.discount_price && (
                      <>
                        <Text style={styles.itemDetailOriginalPrice}>₹{originalPrice}</Text>
                        <View style={[styles.itemDetailSavedBadge, { backgroundColor: '#FFF5E6' }]}>
                          <Text style={[styles.itemDetailSavedPrice, { color: COLORS.success }]}>
                            Save ₹{parseInt(originalPrice) - parseInt(finalPrice)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                  
                  <View style={[styles.itemDetailWeightContainer, { backgroundColor: COLORS.grayBg }]}>
                    <Icon name="cube-outline" size={scale(14)} color={COLORS.text.secondary} />
                    <Text style={styles.itemDetailWeight}>{item.unit}</Text>
                  </View>
                </View>

                {item.tags && item.tags.length > 0 && (
                  <View style={styles.itemDetailTags}>
                    {item.tags.map((tag, index) => (
                      <View key={index} style={[styles.itemDetailTag, { backgroundColor: COLORS.grayBg }]}>
                        <Text style={styles.itemDetailTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {!item.in_stock && (
                  <View style={[styles.itemDetailOutOfStock, { backgroundColor: COLORS.grayBg }]}>
                    <Icon name="alert-circle-outline" size={scale(20)} color={COLORS.danger} />
                    <Text style={[styles.itemDetailOutOfStockText, { color: COLORS.danger }]}>Out of Stock</Text>
                  </View>
                )}
              </View>

              {item.description && (
                <View style={[styles.itemDetailSection, { borderBottomColor: COLORS.border.light, backgroundColor: COLORS.white }]}>
                  <Text style={styles.itemDetailSectionTitle}>Product Details</Text>
                  <View style={styles.itemDetailDescription}>
                    <Text 
                      style={styles.itemDetailDescriptionText}
                      numberOfLines={isDescriptionExpanded ? undefined : 3}
                    >
                      {item.description}
                    </Text>
                    {item.description.length > 100 && (
                      <TouchableOpacity 
                        onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        style={styles.itemDetailReadMore}
                      >
                        <Text style={[styles.itemDetailReadMoreText, { color: COLORS.primary }]}>
                          {isDescriptionExpanded ? 'Read less' : 'Read more'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {similarItems.length > 0 && (
                <View style={[styles.itemDetailSection, { borderBottomColor: COLORS.border.light, backgroundColor: COLORS.white }]}>
                  <View style={styles.itemDetailSectionHeader}>
                    <Text style={styles.itemDetailSectionTitle}>You might also like</Text>
                    <TouchableOpacity>
                      <Text style={[styles.itemDetailSectionViewAll, { color: COLORS.primary }]}>View All</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <SimilarItemsList 
                    items={similarItems.slice(0, 6)} 
                    onItemPress={handleSimilarItemPress} 
                  />
                </View>
              )}
  
              <View style={{ height: verticalScale(100) }} />
            </Animated.ScrollView>
  
            {item.in_stock && (
              <View style={[styles.itemDetailBottomBar, { borderTopColor: COLORS.border.light, backgroundColor: COLORS.white }]}>
                {quantity === 0 ? (
                  <TouchableOpacity 
                    style={[styles.itemDetailAddButton, { backgroundColor: COLORS.primary }]}
                    onPress={handleAddToCart}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.itemDetailAddButtonText}>Add to Cart</Text>
                    <View style={[styles.itemDetailAddButtonPriceContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <Text style={styles.itemDetailAddButtonPrice}>₹{finalPrice}</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.itemDetailQuantityContainer, { backgroundColor: COLORS.grayBg }]}>
                    <TouchableOpacity 
                      style={[styles.itemDetailQuantityButton, { backgroundColor: COLORS.white }]}
                      onPress={handleDecrement}
                      activeOpacity={0.7}
                    >
                      <Icon name="remove" size={scale(18)} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.itemDetailQuantityText}>{quantity}</Text>
                    <TouchableOpacity 
                      style={[styles.itemDetailQuantityButton, { backgroundColor: COLORS.white }]}
                      onPress={handleIncrement}
                      activeOpacity={0.7}
                    >
                      <Icon name="add" size={scale(18)} color={COLORS.primary} />
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
  const [showSortOptions, setShowSortOptions] = useState(false);
  
  const filters = ['all', 'under ₹99', 'best seller', 'new'];
  const sortOptions = ['popular', 'price low', 'price high', 'rating'];
  
  const filteredItems = useMemo(() => {
    let filtered = [...items];
    
    if (selectedFilter === 'under ₹99') {
      filtered = filtered.filter(item => parseInt(item.discount_price || item.price) < 99);
    } else if (selectedFilter === 'best seller') {
      filtered = filtered.filter(item => (item.reviews || 0) > 200);
    } else if (selectedFilter === 'new') {
      filtered = filtered.filter(item => item.is_new);
    }
    
    if (sortBy === 'price low') {
      filtered.sort((a, b) => parseInt(a.discount_price || a.price) - parseInt(b.discount_price || b.price));
    } else if (sortBy === 'price high') {
      filtered.sort((a, b) => parseInt(b.discount_price || b.price) - parseInt(a.discount_price || a.price));
    } else if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    
    return filtered;
  }, [items, selectedFilter, sortBy]);
  
  const renderHeader = () => (
    <>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryHeaderIcon}>
          <Text style={styles.categoryHeaderEmoji}>{category.icon}</Text>
        </View>
        <View style={styles.categoryHeaderInfo}>
          <Text style={styles.categoryHeaderTitle}>{category.name}</Text>
          <Text style={styles.categoryHeaderSubtitle}>
            {items.length} items
          </Text>
        </View>
      </View>
  
      <View style={styles.filterSortContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                { backgroundColor: COLORS.grayBg, borderColor: COLORS.border.light },
                selectedFilter === filter && { backgroundColor: COLORS.primary }
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[
                styles.filterChipText,
                { color: COLORS.text.secondary },
                selectedFilter === filter && { color: COLORS.white }
              ]}>
                {filter === 'all' ? 'All' : filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <TouchableOpacity 
          style={[styles.sortContainer, { backgroundColor: COLORS.grayBg }]}
          onPress={() => setShowSortOptions(!showSortOptions)}
        >
          <Icon name="options-outline" size={scale(16)} color={COLORS.text.secondary} />
          <View style={styles.sortButton}>
            <Text style={styles.sortButtonText}>
              {sortBy === 'price low' ? 'Price: Low' : 
               sortBy === 'price high' ? 'Price: High' :
               sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
            <Icon name="chevron-down" size={scale(14)} color={COLORS.text.secondary} />
          </View>
        </TouchableOpacity>
      </View>
  
      {showSortOptions && (
        <View style={[styles.sortOptionsContainer, { backgroundColor: COLORS.white }]}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.sortOption,
                sortBy === option && { backgroundColor: COLORS.grayBg }
              ]}
              onPress={() => {
                setSortBy(option);
                setShowSortOptions(false);
              }}
            >
              <Text style={[
                styles.sortOptionText,
                sortBy === option && { color: COLORS.primary, fontWeight: '600' }
              ]}>
                {option === 'price low' ? 'Price: Low to High' :
                 option === 'price high' ? 'Price: High to Low' :
                 option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
              {sortBy === option && (
                <Icon name="checkmark" size={scale(14)} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
  
  return (
    <View style={styles.categoryDetailsContainer}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.item_id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        columnWrapperStyle={styles.categoryGridRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.categoryGridContent}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryDetails, setSelectedCategoryDetails] = useState<{
    category: GroceryCategory;
    items: GroceryItem[];
  } | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isItemDetailsVisible, setIsItemDetailsVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GroceryItem | null>(null);
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  
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
    setSearchQuery('');
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

  const loadUserProfile = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (userData) {
        const user = JSON.parse(userData);
        setUserProfile({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          address: user.address || ''
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }, []);

  useEffect(() => {
    if (!isGuest) {
      loadUserProfile();
    }
  }, [isGuest, loadUserProfile]);
  
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setIsHeaderCollapsed(offsetY > MIN_HEADER_HEIGHT - 20);
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
    inputRange: [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
    outputRange: [HEADER_HEIGHT, MIN_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });
  
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - MIN_HEADER_HEIGHT],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: COLORS.white }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={[styles.loadingGradient, { backgroundColor: COLORS.white }]}>
          <Text style={[styles.loadingTitle, { color: COLORS.primary }]}>Eatmart</Text>
          <Text style={styles.loadingText}>Smart Choices Start Here...</Text>
        </View>
      </View>
    );
  }
  
  if (!homeData) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: COLORS.white }]}>
        <View style={[styles.errorGradient, { backgroundColor: COLORS.white }]}>
          <Icon name="alert-circle" size={scale(64)} color={COLORS.text.tertiary} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>Unable to load stores</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); fetchGroceryStores().then(() => setLoading(false)); }}
            style={styles.errorButton}
            activeOpacity={0.8}
          >
            <View style={[styles.errorButtonGradient, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.errorButtonText}>Try Again</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.rootContainer, { backgroundColor: COLORS.white }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      <Animated.View style={[
        styles.header,
        {
          height: headerHeight,
          paddingTop: insets.top,
          backgroundColor: COLORS.white,
          borderBottomColor: COLORS.border.light,
        }
      ]}>
        <Animated.View style={[
          styles.headerContent,
          { opacity: headerOpacity }
        ]}>
          <View style={styles.topBar}>
            <AddressHeader
              isGuest={isGuest}
              onAddressUpdate={handleAddressUpdate}
            />
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerAction}
                onPress={handleProfilePress}
              >
                <View style={[styles.headerActionGradient, { backgroundColor: COLORS.white }]}>
                  <Icon name="person" size={scale(18)} color={COLORS.black} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
          
          <SearchBar onPress={handleSearchPress} />
        </Animated.View>
      </Animated.View>
      
      {isHeaderCollapsed && !selectedCategoryDetails && (
        <Animated.View style={[
          styles.compactHeader,
          {
            paddingTop: insets.top,
            opacity: scrollY.interpolate({
              inputRange: [MIN_HEADER_HEIGHT - 20, MIN_HEADER_HEIGHT],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            })
          }
        ]}>
          <View style={[styles.compactHeaderBlur, { backgroundColor: COLORS.white }]} />
          <View style={styles.compactHeaderContent}>
            <AddressHeader
              isGuest={isGuest}
              onAddressUpdate={handleAddressUpdate}
            />
            <View style={styles.compactHeaderActions}>
              <TouchableOpacity
                style={[styles.compactSearchButton, { backgroundColor: COLORS.grayBg, borderColor: COLORS.border.light }]}
                onPress={handleSearchPress}
              >
                <Icon name="search" size={scale(18)} color={COLORS.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.compactProfileButton, { backgroundColor: COLORS.grayBg, borderColor: COLORS.border.light }]}
                onPress={handleProfilePress}
              >
                <Icon name="person" size={scale(18)} color={COLORS.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
      
      {selectedCategoryDetails ? (
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scrollView, { backgroundColor: COLORS.white }]}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: HEADER_HEIGHT + verticalScale(16),
              paddingBottom: verticalScale(80)
            }
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
        >
          <View style={styles.categoryDetailsBackButton}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleCloseCategoryDetails}
              activeOpacity={0.8}
            >
              <View style={[styles.backButtonGradient, { backgroundColor: COLORS.white, borderColor: COLORS.border.light }]}>
                <Icon name="arrow-back" size={scale(18)} color={COLORS.primary} />
                <Text style={[styles.backButtonText, { color: COLORS.primary }]}>Back to Home</Text>
              </View>
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
          style={[styles.scrollView, { backgroundColor: COLORS.white }]}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: HEADER_HEIGHT + verticalScale(16),
              paddingBottom: verticalScale(80)
            }
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
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
          <View style={styles.categorySection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScrollContent}
              decelerationRate="fast"
            >
              {homeData.categories.map((category) => (
                <CategoryIcon
                  key={category.id}
                  category={category}
                  onPress={handleCategoryPress}
                />
              ))}
            </ScrollView>
          </View>
          
          {homeData.banners && homeData.banners.length > 0 && (
            <BannerCarousel banners={homeData.banners} />
          )}
          
          {homeData.featuredItems && homeData.featuredItems.length > 0 && (
            <ProductGrid
              title="Featured Items"
              items={homeData.featuredItems}
              onItemPress={handleItemPress}
            />
          )}
          
          <View style={{ height: verticalScale(20) }} />
        </ScrollView>
      )}
      
      <CartBottomBar />
      
      <SearchModal
        visible={isSearchModalVisible}
        onClose={handleSearchClose}
        initialQuery={searchQuery}
        categories={homeData.categories}
        onCategorySelect={handleCategorySelect}
      />
      
      <ComingSoonModal
        visible={showComingSoon}
        onClose={() => setShowComingSoon(false)}
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
    </View>
  );
};

const InstamartStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InstamartHome" component={EatmartScreenComponent} />
    </Stack.Navigator>
  );
};

// ============== COMPLETE STYLES ==============

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },

  // Loading Styles
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingTitle: {
    ...TYPOGRAPHY.h2,
    marginTop: verticalScale(20),
  },
  loadingText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    marginTop: verticalScale(8),
  },

  // Error Styles
  errorContainer: {
    flex: 1,
  },
  errorGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(24),
  },
  errorTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginTop: verticalScale(16),
  },
  errorText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    marginTop: verticalScale(4),
    textAlign: 'center',
  },
  errorButton: {
    marginTop: verticalScale(24),
    borderRadius: scale(12),
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorButtonGradient: {
    paddingHorizontal: scale(32),
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.white,
  },

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Coming Soon Modal
  comingSoonContainer: {
    width: screenWidth * 0.85,
    maxWidth: scale(400),
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  comingSoonContent: {
    backgroundColor: COLORS.white,
    padding: scale(24),
    alignItems: 'center',
  },
  comingSoonIconWrapper: {
    marginBottom: verticalScale(20),
  },
  comingSoonIconBackground: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  comingSoonTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  comingSoonMessage: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: verticalScale(24),
    paddingHorizontal: scale(16),
  },
  comingSoonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(24),
    borderRadius: scale(12),
    gap: scale(8),
    width: '100%',
  },
  comingSoonButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.white,
  },

  // Cart Bottom Bar
  cartBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 1000,
  },
  cartBarTouchable: {
    width: '100%',
  },
  cartBarGradient: {
    width: '100%',
    paddingVertical: verticalScale(12),
  },
  cartBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  cartItemPreviews: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartPreviewImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    borderWidth: 2,
  },
  cartBarInfo: {
    marginLeft: scale(4),
  },
  cartBarItems: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255,255,255,0.9)',
  },
  cartBarTotal: {
    ...TYPOGRAPHY.body1,
    color: COLORS.white,
    fontWeight: '700',
  },
  cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  cartBarViewText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.white,
    fontWeight: '600',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    zIndex: 1000,
    overflow: 'visible',
  },
  headerContent: {
    flex: 1,
    paddingHorizontal: scale(16),
    paddingTop: Platform.OS === 'ios' ? verticalScale(4) : verticalScale(2),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerActionGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: scale(20),
  },

  // Compact Header
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    overflow: 'hidden',
  },
  compactHeaderBlur: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.95,
  },
  compactHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    height: MIN_HEADER_HEIGHT,
  },
  compactHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  compactSearchButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  compactProfileButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  // Address Header
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: scale(8),
  },
  addressIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    flexWrap: 'wrap',
  },
  addressText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '700',
  },
  addressSeparator: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.tertiary,
  },
  homeTypeBadge: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },

  // Search Bar
  searchContainer: {
    marginTop: verticalScale(8),
    marginBottom: verticalScale(8),
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: Platform.OS === 'ios' ? verticalScale(12) : verticalScale(10),
    gap: scale(8),
    borderWidth: 1,
    borderRadius: scale(16),
  },
  searchPlaceholder: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    flex: 1,
  },
  searchDivider: {
    width: 1,
    height: scale(20),
    marginHorizontal: scale(4),
  },

  // Category Section
  categorySection: {
    marginBottom: verticalScale(20),
  },
  categoryScrollContent: {
    paddingHorizontal: scale(16),
    gap: scale(12),
    paddingVertical: verticalScale(4),
  },
  categoryIconContainer: {
    width: scale(70),
    alignItems: 'center',
  },
  categoryIconTouchable: {
    alignItems: 'center',
    width: '100%',
  },
  categoryIconWrapper: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(4),
    borderWidth: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIconEmoji: {
    fontSize: fontScale(32),
  },
  categoryIconText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '500',
    textAlign: 'center',
    fontSize: fontScale(11),
  },

  // Banner Carousel
  bannerSection: {
    marginBottom: verticalScale(20),
  },
  bannerListContent: {
    paddingHorizontal: scale(16),
  },
  bannerContainer: {
    height: Platform.OS === 'ios' ? verticalScale(180) : verticalScale(170),
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerTouchable: {
    width: '100%',
    height: '100%',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: verticalScale(12),
    gap: scale(8),
  },
  bannerDot: {
    height: scale(6),
    borderRadius: scale(3),
  },

  // Product Card
  productCard: {
    width: (screenWidth - scale(48)) / 2,
    borderRadius: scale(20),
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: verticalScale(12),
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  productImageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productDiscountBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(8),
    zIndex: 1,
  },
  productDiscountText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '700',
    fontSize: fontScale(10),
  },
  productOrganicBadge: {
    position: 'absolute',
    top: scale(8),
    right: scale(8),
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  productOutOfStock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  productOutOfStockText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '600',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: scale(8),
    overflow: 'hidden',
  },
  productInfo: {
    padding: scale(12),
  },
  productName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(13),
    marginBottom: verticalScale(4),
    lineHeight: fontScale(18),
  },
  productRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(6),
    gap: scale(8),
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
    gap: scale(2),
  },
  productRatingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(10),
  },
  productWeight: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontSize: fontScale(10),
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontSize: fontScale(14),
  },
  productOriginalPrice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
    fontSize: fontScale(10),
  },
  addButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(20),
    padding: scale(2),
  },
  quantityButton: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quantityText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    fontWeight: '700',
    paddingHorizontal: scale(8),
    fontSize: fontScale(12),
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(12),
  },
  sectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    fontWeight: '700',
  },
  sectionViewAll: {
    ...TYPOGRAPHY.body2,
    fontWeight: '600',
  },

  // Product Grid
  productGridSection: {
    marginBottom: verticalScale(20),
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(8),
  },

  // Search Modal Styles
  searchModal: {
    flex: 1,
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
  },
  searchModalBack: {
    marginRight: scale(12),
    padding: scale(4),
  },
  searchModalInputWrapper: {
    flex: 1,
  },
  searchModalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: Platform.OS === 'ios' ? verticalScale(10) : verticalScale(6),
    borderWidth: 1,
  },
  searchModalInput: {
    flex: 1,
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    padding: 0,
    marginLeft: scale(8),
    fontSize: fontScale(15),
  },
  searchModalClear: {
    padding: scale(4),
  },
  searchModalContent: {
    flex: 1,
  },
  searchInitialContent: {
    paddingBottom: verticalScale(20),
  },
  
  searchSection: {
    paddingTop: verticalScale(20),
    paddingHorizontal: scale(16),
  },
  searchSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  searchSectionTitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  searchSectionClear: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
  },
  
  recentList: {
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
  },
  recentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  recentText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    flex: 1,
    fontSize: fontScale(14),
  },
  recentRemove: {
    padding: scale(4),
  },
  
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -scale(4),
    marginTop: verticalScale(4),
  },
  popularItem: {
    width: '25%',
    paddingHorizontal: scale(4),
    marginBottom: verticalScale(8),
  },
  popularIcon: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  popularEmoji: {
    fontSize: fontScale(32),
  },
  popularName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: fontScale(11),
  },
  
  searchResults: {
    flex: 1,
    padding: scale(16),
  },
  searchResultsList: {
    paddingBottom: verticalScale(20),
  },
  searchLoading: {
    paddingVertical: verticalScale(40),
    alignItems: 'center',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    borderBottomWidth: 1,
  },
  searchResultIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  searchResultEmoji: {
    fontSize: fontScale(32),
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '600',
    marginBottom: verticalScale(2),
    fontSize: fontScale(14),
  },
  searchResultCount: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(12),
  },
  searchNoResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(80),
  },
  searchNoResultsIcon: {
    marginBottom: verticalScale(16),
  },
  searchNoResultsTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    marginTop: verticalScale(8),
  },
  searchNoResultsText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    marginTop: verticalScale(4),
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: verticalScale(100),
  },

  // Category Details Back Button
  categoryDetailsBackButton: {
    paddingHorizontal: scale(16),
    marginBottom: verticalScale(12),
  },
  backButton: {
    borderRadius: scale(12),
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  backButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    gap: scale(8),
    borderWidth: 1,
    borderRadius: scale(12),
  },
  backButtonText: {
    ...TYPOGRAPHY.body2,
    fontWeight: '600',
  },

  // Category Details Styles
  categoryDetailsContainer: {
    flex: 1,
    paddingHorizontal: scale(16),
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  categoryHeaderIcon: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(16),
  },
  categoryHeaderEmoji: {
    fontSize: fontScale(40),
  },
  categoryHeaderInfo: {
    flex: 1,
  },
  categoryHeaderTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    fontWeight: '700',
    marginBottom: verticalScale(2),
  },
  categoryHeaderSubtitle: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
  },
  
  // Filter & Sort Styles
  filterSortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(16),
  },
  filtersScrollContent: {
    paddingRight: scale(16),
    gap: scale(8),
  },
  filterChip: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(6),
    borderRadius: scale(20),
    borderWidth: 1,
  },
  filterChipText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    fontSize: fontScale(12),
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    paddingVertical: verticalScale(6),
    paddingHorizontal: scale(12),
    borderRadius: scale(20),
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  sortButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '500',
    fontSize: fontScale(12),
  },
  
  // Sort Options Dropdown
  sortOptionsContainer: {
    position: 'absolute',
    top: verticalScale(110),
    right: scale(16),
    borderRadius: scale(12),
    padding: scale(8),
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
    minWidth: scale(150),
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(12),
    borderRadius: scale(8),
  },
  sortOptionText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    fontSize: fontScale(13),
  },
  
  // Category Grid
  categoryGridRow: {
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
  },
  categoryGridContent: {
    paddingBottom: verticalScale(16),
  },

  // Similar Items
  similarItemsContainer: {
    paddingRight: scale(20),
    gap: scale(12),
  },
  similarItemCard: {
    width: scale(140),
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: scale(12),
  },
  similarItemImage: {
    width: '100%',
    height: scale(140),
  },
  similarItemInfo: {
    padding: scale(12),
  },
  similarItemName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(12),
    marginBottom: verticalScale(2),
    lineHeight: fontScale(16),
  },
  similarItemWeight: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    fontSize: fontScale(10),
    marginBottom: verticalScale(4),
  },
  similarItemPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    flexWrap: 'wrap',
  },
  similarItemPrice: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontSize: fontScale(13),
  },
  similarItemOriginalPrice: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
    fontSize: fontScale(10),
  },

  // Item Details Modal Styles
  itemDetailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  itemDetailModalContainer: {
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    overflow: 'hidden',
    height: screenHeight * 0.95,
  },
  itemDetailModal: {
    flex: 1,
  },
  itemDetailHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    zIndex: 10,
    borderBottomWidth: 1,
  },
  itemDetailHeaderButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemDetailHeaderActions: {
    flexDirection: 'row',
    gap: scale(8),
  },
  itemDetailScrollView: {
    flex: 1,
  },
  itemDetailCarousel: {
    position: 'relative',
    height: screenWidth,
  },
  itemDetailImageContainer: {
    width: screenWidth,
    height: screenWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetailImage: {
    width: screenWidth,
    height: screenWidth,
  },
  itemDetailPagination: {
    position: 'absolute',
    bottom: verticalScale(16),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(8),
    zIndex: 5,
  },
  itemDetailDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  itemDetailDotActive: {
    width: scale(20),
  },
  itemDetailDiscountBadge: {
    position: 'absolute',
    top: verticalScale(16),
    left: scale(16),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: scale(4),
    zIndex: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  itemDetailDiscountText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '700',
    fontSize: fontScale(13),
  },
  itemDetailOrganicBadge: {
    position: 'absolute',
    top: verticalScale(16),
    right: scale(16),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    zIndex: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  itemDetailOrganicText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '600',
    fontSize: fontScale(11),
  },
  itemDetailInfoSection: {
    padding: scale(20),
    borderBottomWidth: 1,
  },
  itemDetailBrand: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    marginBottom: verticalScale(4),
    fontSize: fontScale(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemDetailName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
    marginBottom: verticalScale(8),
    fontWeight: '700',
  },
  itemDetailRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    gap: scale(8),
  },
  itemDetailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(4),
    gap: scale(4),
  },
  itemDetailRatingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.primary,
    fontWeight: '600',
    fontSize: fontScale(12),
  },
  itemDetailReviews: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(12),
  },
  itemDetailPriceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  itemDetailPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  itemDetailCurrentPrice: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text.primary,
    fontWeight: '700',
    fontSize: fontScale(26),
  },
  itemDetailOriginalPrice: {
    ...TYPOGRAPHY.body1,
    color: COLORS.text.tertiary,
    textDecorationLine: 'line-through',
  },
  itemDetailSavedBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
  },
  itemDetailSavedPrice: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    fontSize: fontScale(11),
  },
  itemDetailWeightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(16),
    gap: scale(4),
  },
  itemDetailWeight: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontWeight: '500',
    fontSize: fontScale(12),
  },
  itemDetailTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: verticalScale(4),
  },
  itemDetailTag: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(12),
  },
  itemDetailTagText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text.secondary,
    fontSize: fontScale(11),
  },
  itemDetailOutOfStock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    marginTop: verticalScale(8),
  },
  itemDetailOutOfStockText: {
    ...TYPOGRAPHY.body2,
    fontWeight: '600',
  },
  itemDetailSection: {
    padding: scale(20),
    borderBottomWidth: 1,
  },
  itemDetailSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  itemDetailSectionTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text.primary,
    fontWeight: '700',
  },
  itemDetailSectionViewAll: {
    ...TYPOGRAPHY.body2,
    fontWeight: '600',
  },
  itemDetailDescription: {
    marginBottom: verticalScale(16),
  },
  itemDetailDescriptionText: {
    ...TYPOGRAPHY.body2,
    color: COLORS.text.secondary,
    lineHeight: fontScale(22),
    fontSize: fontScale(14),
  },
  itemDetailReadMore: {
    marginTop: verticalScale(4),
  },
  itemDetailReadMoreText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    fontSize: fontScale(12),
  },
  itemDetailBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(16),
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 10,
  },
  itemDetailAddButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(16),
    borderRadius: scale(16),
  },
  itemDetailAddButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.white,
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  itemDetailAddButtonPriceContainer: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(4),
    borderRadius: scale(8),
  },
  itemDetailAddButtonPrice: {
    ...TYPOGRAPHY.button,
    color: COLORS.white,
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  itemDetailQuantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: scale(16),
    padding: scale(6),
  },
  itemDetailQuantityButton: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemDetailQuantityText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text.primary,
    fontWeight: '700',
    minWidth: scale(50),
    textAlign: 'center',
  },
});

// ============== EXPORT ==============

const EatmartScreen = () => {
  const insets = useSafeAreaInsets();

  return (
    <CartProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <View style={[styles.rootContainer, { paddingBottom: insets.bottom }]}>
        <InstamartStackNavigator />
      </View>
    </CartProvider>
  );
};

export default EatmartScreen;