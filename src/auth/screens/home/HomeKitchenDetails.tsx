import React, { useRef, useState, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  StatusBar,
  Modal,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  BackHandler,
  ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { getKitcheDetails } from '../../../api/home';
import { getCart, updateCart, clearCartDetails } from '../../../api/cart';
import { showMessage } from 'react-native-flash-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { height, width } = Dimensions.get('window');

// Responsive dimensions based on screen size
const ANDROID_STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;
const HEADER_MAX_HEIGHT = Platform.select({
  android: height * 0.32,
  ios: height * 0.35
});
const HEADER_MIN_HEIGHT = Platform.select({
  android: height * 0.12,
  ios: height * 0.14
});
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

// Responsive font sizes
const scaleFont = (size: number): number => {
  const scale = Math.min(width, height) / 375;
  return Math.round(size * scale);
};

// Placeholder images
const PLACEHOLDER_FOOD = ""
const PLACEHOLDER_RESTAURANT = ""

// Types
type FoodType = 'Veg' | 'NonVeg';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  type: FoodType;
  category: string;
  image: string | null;
  description: string;
  isBestseller?: boolean;
  quantity?: number;
  availability: boolean;
  discount_percent?: string | null;
  discount_active?: boolean;
  buy_one_get_one_free?: boolean | null;
}

interface FilterItem {
  id: string;
  name: string;
  icon: string;
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
  expanded: boolean;
}

interface CartItem {
  item_id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  item_image: string;
  food_type?: string;
}

interface CartResponse {
  status: string;
  cart_details: CartItem[];
}

interface KitchenDetails {
  restaurant_name: string;
  restaurant_image: string;
  restaurant_id: string;
  Address: string;
  rating: number;
  min_order: number;
  opening_time: string;
  closing_time: string;
  itemlist: Array<{
    id: string;
    item_name: string;
    item_price: string;
    description: string;
    item_image: string;
    food_type: string;
    category: string;
    availability: boolean;
    buy_one_get_one_free: boolean | null;
    discount_percent: string | null;
    discount_active: string;
  }>;
  restaurant_current_status: {
    is_open: boolean;
  };
}

interface UserData {
  user_id?: string;
}

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

const FILTERS: FilterItem[] = [
  { id: '1', name: 'All', icon: 'fast-food-outline' },
  { id: '2', name: 'Veg', icon: 'leaf-outline' },
  { id: '3', name: 'NonVeg', icon: 'nutrition-outline' },
  { id: '4', name: 'Offers', icon: 'pricetag-outline' },
  { id: '5', name: 'Bestseller', icon: 'star-outline' },
];

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const VegNonVegIcon = React.memo(({ type, size = 18 }: { type: FoodType; size?: number }) => {
  const iconSize = Platform.select({
    android: size * 0.9,
    ios: size
  });
  
  return (
    <View style={[
      styles.vegNonVegIconContainer,
      type === 'Veg' ? styles.vegIcon : styles.nonVegIcon,
      { width: iconSize, height: iconSize }
    ]}>
      <View style={[
        styles.vegNonVegDot,
        type === 'Veg' ? styles.vegDot : styles.nonVegDot,
        { width: iconSize * 0.6, height: iconSize * 0.6 }
      ]} />
    </View>
  );
});

const HomeKitchenDetails: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [initialLoad, setInitialLoad] = useState(true);
  
  // State declarations
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [cartItems, setCartItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [kitchenDetails, setKitchenDetails] = useState<KitchenDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cartLoading, setCartLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
  const [showKitchenConflictModal, setShowKitchenConflictModal] = useState(false);
  const [pendingCartAction, setPendingCartAction] = useState<{itemId: string, action: 'add' | 'remove'} | null>(null);

  const kitchenId = route.params?.kitchenId;
  
  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Fetch past kitchen details from storage
  const fetchPastKitchenDetails = useCallback(async () => {
    try {
      const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');
      if (storedDetails) {
        setPastKitchenDetails(JSON.parse(storedDetails));
      }
    } catch (error) {
      console.error('Error fetching past kitchen details:', error);
    }
  }, []);

  // Save past kitchen details to storage
  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    try {
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
      setPastKitchenDetails(details);
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);

  // Clear past kitchen details from storage
  const clearPastKitchenDetails = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('pastKitchenDetails');
      setPastKitchenDetails(null);
    } catch (error) {
      console.error('Error clearing past kitchen details:', error);
    }
  }, []);

  // Check if current kitchen matches past kitchen
  const isSameKitchen = useMemo(() => {
    return pastKitchenDetails?.id === kitchenId;
  }, [pastKitchenDetails, kitchenId]);

  // Check if cart has items from different kitchen
  const hasDifferentKitchenItems = useMemo(() => {
    return pastKitchenDetails && pastKitchenDetails.id !== kitchenId && cartItems.length > 0;
  }, [pastKitchenDetails, kitchenId, cartItems]);

  // Handle back button press
  const handleBackPress = useCallback(() => {
    navigation.navigate('HomeTabs');
  }, [navigation]);

  // Set navigation options
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fetch user data and session ID
  const fetchUserData = useCallback(async () => {
    try {
      const [userData, session] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('session_id')
      ]);
      
      if (userData) setUser(JSON.parse(userData));
      if (session) setSessionId(session);
      return { user: userData ? JSON.parse(userData) : null, session };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { user: null, session: null };
    }
  }, []);

  const handleClearCartAndProceed = useCallback(async () => {
    try {
      setShowKitchenConflictModal(false);
      setCartLoading(true);
      
      const { user: currentUser, session: currentSession } = await fetchUserData();
      
      if (!currentUser?.id) return;
      
      const payload = {
        session_id: currentSession,
        user_id: currentUser.id
      };
      
      await clearCartDetails(payload);
      await clearPastKitchenDetails();
      
      if (pendingCartAction) {
        await updateCartItem(pendingCartAction.itemId, pendingCartAction.action, true);
      }
      
      showMessage({
        message: 'Cart cleared',
        description: 'You can now add items from this kitchen',
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to clear cart:', error);
      showMessage({
        message: 'Failed to clear cart',
        description: 'Please try again later',
        type: 'danger',
      });
    } finally {
      setPendingCartAction(null);
      setCartLoading(false);
    }
  }, [fetchUserData, pendingCartAction, clearPastKitchenDetails]);

  // Fetch cart data
  const fetchCartData = useCallback(async () => {
    try {
      setCartLoading(true);
      const { user: currentUser, session: currentSession } = await fetchUserData();
      
      if (!currentUser?.id) return;
      
      const payload = {
        session_id: currentSession,
        user_id: currentUser.id
      };
      
      const response = await getCart(payload);
      if (response.status === 200) {
        const cartItemsFromApi = response.data.cart_details.map(item => ({
          id: item.item_id.toString(),
          name: item.item_name,
          price: item.item_price,
          quantity: item.quantity,
          image: item.item_image || null,
          type: (item.food_type === 'Non-Veg' ? 'NonVeg' : 'Veg') as FoodType,
          category: '',
          description: '',
          availability: true,
          isBestseller: false,
          discount_active: false
        }));
        setCartItems(cartItemsFromApi);
        if (response?.data.existingCartDetails.length > 0) {
          const newPastKitchenDetails = {
            id: response?.data.existingCartDetails[0]?.restaurant_id,
            name: response?.data.existingCartDetails[0]?.restaurant_name,
            image: response?.data.existingCartDetails[0]?.restaurant_profile_image,
            itemCount: response?.data.total_item_count
          };
          await savePastKitchenDetails(newPastKitchenDetails);
        } else if (cartItemsFromApi.length === 0) {
          await clearPastKitchenDetails();
        }
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      showMessage({
        message: 'Failed to load cart items',
        description: 'Please try again later',
        type: 'danger',
      });
    } finally {
      setCartLoading(false);
    }
  }, [fetchUserData, savePastKitchenDetails, clearPastKitchenDetails]);

  // Fetch kitchen details
  const fetchKitchenDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getKitcheDetails(kitchenId);
      
      const transformedItems = response.data.itemlist.map(item => ({
        id: item.id,
        name: item.item_name,
        price: parseFloat(item.item_price),
        type: (item.food_type === 'Non-Veg' ? 'NonVeg' : 'Veg') as FoodType,
        category: item.category,
        image: item.item_image.startsWith('http') ? item.item_image : null,
        description: item.description,
        availability: item.availability,
        isBestseller: false,
        discount_percent: item.discount_percent,
        discount_active: item.discount_active === "1",
        buy_one_get_one_free: item.buy_one_get_one_free
      }));

      const categoryMap = transformedItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, MenuItem[]>);

      const categories = Object.entries(categoryMap).map(([name, items]) => ({
        name,
        items,
        expanded: true,
      }));

      setKitchenDetails(response.data);
      setCategories(categories);
    } catch (err) {
      console.error('Failed to fetch kitchen details:', err);
      setError('Failed to load kitchen details. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kitchenId]);

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  // Refresh all data
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchKitchenDetails(),
        fetchCartData(),
        fetchPastKitchenDetails()
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setInitialLoad(false);
    }
  }, [fetchKitchenDetails, fetchCartData, fetchPastKitchenDetails]);

  // Custom refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshData().finally(() => setRefreshing(false));
  }, [refreshData]);

  // Initial data load - fixed to prevent double call
  useEffect(() => {
    if (kitchenId && initialLoad) {
      refreshData();
    }
  }, [kitchenId, refreshData, initialLoad]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!initialLoad) {
        scrollY.setValue(0);
        refreshData();
      }
      return () => {};
    }, [refreshData, scrollY, initialLoad])
  );

  // Modal handlers
  const openModal = useCallback((item: MenuItem) => {
    setSelectedItem(item);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Toggle category expansion
  const toggleCategory = useCallback((categoryName: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategories(prevCategories =>
      prevCategories.map(category =>
        category.name === categoryName
          ? { ...category, expanded: !category.expanded }
          : category
      )
    );
  }, []);

  // Animation interpolations
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  // Filter categories based on active filter
  const filteredCategories = useMemo(() => {
    return categories.map(category => {
      const filteredItems = category.items.filter(item => {
        if (!item.availability) return false;
        
        switch (activeFilter) {
          case 'Veg': return item.type === 'Veg';
          case 'NonVeg': return item.type === 'NonVeg';
          case 'Bestseller': return item.isBestseller;
          case 'Offers': return item.discount_active || item.buy_one_get_one_free;
          default: return true;
        }
      });
      return { ...category, items: filteredItems };
    }).filter(category => category.items.length > 0);
  }, [categories, activeFilter]);

  // Calculate cart totals
  const { itemCount, totalPrice } = useMemo(() => {
    const count = cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
    const price = cartItems.reduce((total, item) => {
      const itemPrice = item.discount_active && item.discount_percent 
        ? item.price * (1 - parseFloat(item.discount_percent) / 100)
        : item.price;
      return total + (itemPrice * (item.quantity || 0));
    }, 0);
    return { itemCount: count, totalPrice: price };
  }, [cartItems]);

  // Update cart item quantity with kitchen conflict handling
  const updateCartItem = useCallback(async (
    itemId: string, 
    action: 'add' | 'remove',
    force = false
  ) => {
    if (!kitchenDetails?.restaurant_current_status.is_open) return;
    
    try {
      // Check if we're trying to add to a different kitchen's cart
      if (!force && action === 'add' && hasDifferentKitchenItems) {
        setPendingCartAction({ itemId, action });
        setShowKitchenConflictModal(true);
        return;
      }

      setUpdatingItemId(itemId);
      
      const payload = {
        session_id: sessionId,
        restaurant_id: kitchenId,
        item_id: itemId,
        source: 'ITEMLIST',
        action,
        quantity: 1,
        user_id: user?.id
      };

      await updateCart(payload);
      
      // Update past kitchen details after cart update
      if (kitchenDetails) {
        const newPastKitchenDetails = {
          id: kitchenId,
          name: kitchenDetails.restaurant_name,
          image: kitchenDetails.restaurant_image || PLACEHOLDER_RESTAURANT,
          itemCount: action === 'add' ? itemCount + 1 : Math.max(0, itemCount - 1)
        };
        await savePastKitchenDetails(newPastKitchenDetails);
      }
      
      await fetchCartData();
    } catch (error) {
      console.error('Cart update error:', error);
      showMessage({
        message: `Failed to ${action} item`,
        description: error.response?.data?.message || 'Please try again',
        type: 'danger',
      });
    } finally {
      setUpdatingItemId(null);
    }
  }, [
    sessionId, 
    user?.id, 
    kitchenId, 
    kitchenDetails, 
    fetchCartData,
    hasDifferentKitchenItems,
    itemCount,
    savePastKitchenDetails
  ]);

  // Get current quantity of an item in cart
  const getItemQuantity = useCallback((itemId: string): number => {
    const item = cartItems.find(item => item.id === itemId);
    return item?.quantity || 0;
  }, [cartItems]);

  // View cart handler
  const handleViewCart = useCallback(() => {
    const pastkitcheId = pastKitchenDetails?.id;
    if (!kitchenDetails) return;
    navigation.navigate('CartScreen', { 
      cartItems,
      totalPrice,
      pastkitcheId,
      restaurant: {
        name: kitchenDetails.restaurant_name,
        address: kitchenDetails.Address,
        minOrder: kitchenDetails.min_order,
        coverImage: kitchenDetails.restaurant_image || PLACEHOLDER_RESTAURANT,
        isOpen: kitchenDetails.restaurant_current_status.is_open
      },
      userId: user?.id
    });
  }, [navigation, kitchenDetails, cartItems, totalPrice, pastKitchenDetails, user?.id]);

  const BackToKitchen = () => {
    if (pastKitchenDetails) {
      navigation.navigate('HomeKitchenDetails', { kitchenId: pastKitchenDetails.id });
    }
  };

  // Render category header
  const renderCategoryHeader = useCallback(({ name, expanded, itemCount }: { 
    name: string; 
    expanded: boolean; 
    itemCount: number 
  }) => {
    return (
      <TouchableOpacity 
        style={styles.categoryHeader} 
        onPress={() => toggleCategory(name)}
        activeOpacity={0.8}
      >
        <View style={styles.categoryHeaderLeft}>
          <Text style={styles.categoryName}>{name}</Text>
          <Text style={styles.categoryItemCount}>{itemCount} items</Text>
        </View>
        <Animated.View style={{
          transform: [{
            rotate: expanded ? '180deg' : '0deg'
          }]
        }}>
          <Icon name="chevron-down" size={20} color="#666" />
        </Animated.View>
      </TouchableOpacity>
    );
  }, [toggleCategory]);

  // Render individual menu item
  const renderItem = useCallback(({ item }: { item: MenuItem }) => {
    const quantity = getItemQuantity(item.id);
    const discountedPrice = item.discount_active && item.discount_percent 
      ? item.price * (1 - parseFloat(item.discount_percent) / 100)
      : null;
    const isKitchenOpen = kitchenDetails?.restaurant_current_status.is_open;
    const isUpdating = updatingItemId === item.id;
    
    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity 
          style={[
            styles.card,
            !item.availability && styles.disabledCard
          ]} 
          onPress={() => openModal(item)}
          activeOpacity={0.9}
          disabled={!item.availability}
        >
          <View style={styles.cardContent}>
            <View style={styles.imageContainer}>
              <Image 
                source={item.image ? { uri: item.image } : PLACEHOLDER_FOOD}
                style={styles.foodImage}
                defaultSource={PLACEHOLDER_FOOD}
              />
              {item.isBestseller && (
                <View style={styles.bestsellerBadge}>
                  <Icon name="star" size={12} color="#fff" />
                  <Text style={styles.bestsellerText}>Bestseller</Text>
                </View>
              )}
              {(item.discount_active || item.buy_one_get_one_free) && (
                <View style={styles.offerBadge}>
                  <Icon name="pricetag" size={12} color="#fff" />
                  <Text style={styles.offerText}>
                    {item.buy_one_get_one_free 
                      ? 'BOGO' 
                      : `${parseInt(item.discount_percent || '0')}% OFF`}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.foodDetails}>
              <View style={styles.foodHeader}>
                <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.priceContainer}>
                  {discountedPrice && (
                    <Text style={styles.originalPrice}>₹{item.price.toFixed(2)}</Text>
                  )}
                  <Text style={styles.foodPrice}>
                    ₹{discountedPrice ? discountedPrice.toFixed(2) : item.price.toFixed(2)}
                  </Text>
                </View>
              </View>
              <Text style={styles.foodDescription} numberOfLines={2}>{item.description}</Text>
              <View style={styles.priceRow}>
                <View style={styles.itemTypeContainer}>
                  <VegNonVegIcon type={item.type} size={16} />
                  <Text style={styles.typeText}>{item.type}</Text>
                </View>
                {quantity > 0 ? (
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity 
                      style={styles.quantityButton} 
                      onPress={(e) => {
                        e.stopPropagation();
                        updateCartItem(item.id, 'remove');
                      }}
                      disabled={!isKitchenOpen || isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#E65C00" />
                      ) : (
                        <Icon name="remove" size={18} color={isKitchenOpen ? '#E65C00' : '#ccc'} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity 
                      style={styles.quantityButton} 
                      onPress={(e) => {
                        e.stopPropagation();
                        updateCartItem(item.id, 'add');
                      }}
                      disabled={!isKitchenOpen || isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color="#E65C00" />
                      ) : (
                        <Icon name="add" size={18} color={isKitchenOpen ? '#E65C00' : '#ccc'} />
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[
                      styles.addToCartBtn,
                      (!item.availability || !isKitchenOpen) && styles.disabledAddToCartBtn
                    ]} 
                    onPress={(e) => {
                      e.stopPropagation();
                      updateCartItem(item.id, 'add');
                    }}
                    activeOpacity={0.8}
                    disabled={!item.availability || !isKitchenOpen || isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addToCartText}>{'ADD'}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.itemSeparator} />
      </View>
    );
  }, [getItemQuantity, updatingItemId, kitchenDetails, openModal, updateCartItem]);

  // Render category with items
  const renderCategory = useCallback(({ item }: { item: MenuCategory }) => {
    return (
      <View style={styles.categoryContainer}>
        {renderCategoryHeader({
          name: item.name,
          expanded: item.expanded,
          itemCount: item.items.length
        })}
        {item.expanded && (
          <View style={styles.categoryItems}>
            {item.items.map(menuItem => (
              <React.Fragment key={menuItem.id}>
                {renderItem({ item: menuItem })}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    );
  }, [renderCategoryHeader, renderItem]);

  if (loading && initialLoad) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E65C00" />
        <Text style={styles.loadingText}>Loading kitchen details...</Text>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="sad-outline" size={50} color="#E65C00" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={refreshData}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, { marginTop: 10, backgroundColor: '#666' }]}
          onPress={handleBackPress}
        >
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!kitchenDetails) {
    return null;
  }

  const deliveryTime = `40-45 mins`;
  const isOpen = kitchenDetails.restaurant_current_status?.is_open;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#E65C00" barStyle="light-content" />

      {/* Header with Kitchen Details */}
      <Animated.View style={[styles.headerContainer, { 
        transform: [{ translateY: headerTranslateY }],
        height: HEADER_MAX_HEIGHT,
      }]}>
        <Animated.Image
          source={kitchenDetails.restaurant_image ? { uri: kitchenDetails.restaurant_image } : PLACEHOLDER_RESTAURANT}
          style={[styles.coverImage, { opacity: imageOpacity }]}
          defaultSource={PLACEHOLDER_RESTAURANT}
        />
        <View style={styles.overlay} />
        
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.openStatusBadge}>
          <View style={[
            styles.openStatusIndicator,
            isOpen ? styles.openStatus : styles.closedStatus
          ]} />
          <Text style={styles.openStatusText}>
            {isOpen ? 'OPEN NOW' : 'CLOSED'}
          </Text>
        </View>
        
        <Animated.View style={[styles.kitchenInfoContainer, {
          transform: [{ translateY: titleTranslateY }, { scale: titleScale }],
        }]}>
          <Text style={styles.kitchenName}>{kitchenDetails.restaurant_name}</Text>
          
          <View style={styles.kitchenMetaRow}>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{kitchenDetails.rating}</Text>
            </View>
            <View style={styles.deliveryInfo}>
              <Icon name="time-outline" size={16} color="#fff" />
              <Text style={styles.deliveryText}>{deliveryTime}</Text>
            </View>
            <View style={styles.minOrderInfo}>
              <Icon name="basket-outline" size={16} color="#fff" />
              <Text style={styles.minOrderText}>
                ₹{kitchenDetails.min_order}
              </Text>
            </View>
          </View>
          
          <View style={styles.addressContainer}>
            <Icon name="location-outline" size={16} color="#fff" />
            <Text style={styles.kitchenAddress} numberOfLines={1}>{kitchenDetails.Address}</Text>
          </View>
          
          <View style={styles.timingContainer}>
            <Icon name="time-outline" size={14} color="#fff" />
            <Text style={styles.timingText}>
              {kitchenDetails.opening_time} - {kitchenDetails.closing_time}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Filters Section */}
      <Animated.View style={[styles.filterContainer, {
        transform: [{ translateY: headerTranslateY }],
      }]}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterBtn, 
                activeFilter === item.name && styles.activeFilterBtn,
                !isOpen && styles.disabledFilterBtn
              ]}
              onPress={() => isOpen && setActiveFilter(item.name)}
              activeOpacity={0.7}
              disabled={!isOpen}
            >
              {item.name === 'Veg' || item.name === 'NonVeg' ? (
                <VegNonVegIcon 
                  type={item.name as FoodType} 
                  size={16} 
                />
              ) : (
                <Icon
                  name={item.icon}
                  size={16}
                  color={activeFilter === item.name ? '#fff' : '#555'}
                />
              )}
              <Text style={[
                styles.filterText, 
                activeFilter === item.name && styles.activeFilterText,
                !isOpen && styles.disabledFilterText
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      {/* Menu Items List with Fixed Refresh Control */}
      <AnimatedFlatList
        data={filteredCategories}
        keyExtractor={(item: MenuCategory) => item.name}
        renderItem={renderCategory}
        contentContainerStyle={styles.menuContainer}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={<View style={{ height: HEADER_MAX_HEIGHT - 45 }} />}
        ListFooterComponent={<View style={{ height: 100 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            progressViewOffset={HEADER_MAX_HEIGHT - 45}
            colors={['#E65C00']}
            tintColor="#E65C00"
            progressBackgroundColor="#ffffff"
            title="Pull to refresh"
            titleColor="#E65C00"
            style={styles.refreshControl}
            titleStyle={styles.refreshTitle}
          />
        }
      />

      {itemCount > 0 && (
        <View style={styles.cartSummary__container}>
          {/* Kitchen Info Row with Image */}
          <View style={styles.cartSummary__header}>
            <View style={styles.cartSummary__kitchenInfo}>
              <Image 
                source={{ uri: pastKitchenDetails?.image || kitchenDetails.restaurant_image || PLACEHOLDER_RESTAURANT }} 
                style={styles.cartSummary__kitchenImage}
              />
              <View>
                <Text style={styles.cartSummary__kitchenName} numberOfLines={1}>
                  {pastKitchenDetails?.name || kitchenDetails.restaurant_name}
                </Text>
                <Text style={styles.cartSummary__itemCountText}>
                  {itemCount} item{itemCount !== 1 ? 's' : ''} • ₹{totalPrice.toFixed(2)}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.cartSummary__miniCartBtn,
                !isOpen && styles.cartSummary__miniCartBtnDisabled
              ]}
              onPress={isOpen ? handleViewCart : undefined}
              disabled={!isOpen}
              activeOpacity={0.9}
            >
              <View style={styles.cartSummary__miniCartContent}>
                <Text style={styles.cartSummary__viewCartText}>View Cart</Text>
                <View style={styles.cartSummary__cartCountBadge}>
                  <Text style={styles.cartSummary__miniCartCount}>{itemCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Item Details Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        {selectedItem && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Image 
                source={selectedItem.image ? { uri: selectedItem.image } : PLACEHOLDER_FOOD}
                style={styles.modalFoodImage}
                defaultSource={PLACEHOLDER_FOOD}
              />
              
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalFoodName}>{selectedItem.name}</Text>
                  <View style={styles.modalPriceContainer}>
                    {selectedItem.discount_active && selectedItem.discount_percent && (
                      <Text style={styles.modalOriginalPrice}>₹{selectedItem.price.toFixed(2)}</Text>
                    )}
                    <Text style={styles.modalFoodPrice}>
                      ₹
                      {selectedItem.discount_active && selectedItem.discount_percent
                        ? (selectedItem.price * (1 - parseFloat(selectedItem.discount_percent) / 100)).toFixed(2)
                        : selectedItem.price.toFixed(2)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.modalBadgeRow}>
                  {selectedItem.isBestseller && (
                    <View style={styles.modalBestsellerBadge}>
                      <Icon name="star" size={12} color="#fff" />
                      <Text style={styles.modalBestsellerText}>Bestseller</Text>
                    </View>
                  )}
                  {(selectedItem.discount_active || selectedItem.buy_one_get_one_free) && (
                    <View style={styles.modalOfferBadge}>
                      <Icon name="pricetag" size={12} color="#fff" />
                      <Text style={styles.modalOfferText}>
                        {selectedItem.buy_one_get_one_free ? 'BOGO' : `${selectedItem.discount_percent}% OFF`}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalTypeContainer}>
                    <VegNonVegIcon type={selectedItem.type} size={16} />
                    <Text style={styles.modalTypeText}>{selectedItem.type}</Text>
                  </View>
                </View>
                
                <Text style={styles.modalFoodDescription}>{selectedItem.description}</Text>
                
                <View style={styles.modalActions}>
                  <View style={styles.modalQuantityControls}>
                    <TouchableOpacity 
                      style={styles.modalQuantityButton}
                      onPress={() => updateCartItem(selectedItem.id, 'remove')}
                      disabled={getItemQuantity(selectedItem.id) === 0 || !isOpen || updatingItemId === selectedItem.id}
                    >
                      {updatingItemId === selectedItem.id ? (
                        <ActivityIndicator size="small" color="#E65C00" />
                      ) : (
                        <Icon 
                          name="remove" 
                          size={24} 
                          color={getItemQuantity(selectedItem.id) === 0 || !isOpen ? '#ccc' : '#E65C00'} 
                        />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.modalQuantityText}>
                      {getItemQuantity(selectedItem.id)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.modalQuantityButton}
                      onPress={() => updateCartItem(selectedItem.id, 'add')}
                      disabled={!selectedItem.availability || !isOpen || updatingItemId === selectedItem.id}
                    >
                      {updatingItemId === selectedItem.id ? (
                        <ActivityIndicator size="small" color="#E65C00" />
                      ) : (
                        <Icon 
                          name="add" 
                          size={24} 
                          color={!selectedItem.availability || !isOpen ? '#ccc' : '#E65C00'} 
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.addToCartBtnLarge,
                      (!selectedItem.availability || !isOpen) && styles.disabledAddToCartBtnLarge
                    ]}
                    onPress={() => {
                      if (selectedItem.availability && isOpen) {
                        updateCartItem(selectedItem.id, 'add');
                      }
                    }}
                    disabled={!selectedItem.availability || !isOpen || updatingItemId === selectedItem.id}
                  >
                    {updatingItemId === selectedItem.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.addToCartTextLarge}>
                        {!selectedItem.availability 
                          ? 'UNAVAILABLE' 
                          : !isOpen
                            ? 'RESTAURANT CLOSED'
                            : getItemQuantity(selectedItem.id) > 0 
                              ? 'UPDATE CART' 
                              : 'ADD TO CART'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Kitchen Conflict Modal */}
      <Modal
        visible={showKitchenConflictModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKitchenConflictModal(false)}
      >
        <View style={styles.clearModalOverlay}>
          <View style={styles.clearModalCard}>
            <Text style={styles.clearModalTitle}>🚨 Kitchen Conflict</Text>
            <Text style={styles.clearModalText}>
              Your cart contains items from another restaurant. Would you like to reset your cart?
            </Text>
            {pastKitchenDetails && (
              <View style={styles.conflictKitchenInfo}>
                <Image 
                  source={{ uri: pastKitchenDetails.image || PLACEHOLDER_RESTAURANT }} 
                  style={styles.conflictKitchenImage}
                />
                <View style={styles.conflictKitchenDetails}>
                  <Text style={styles.conflictKitchenName} numberOfLines={1}>
                    {pastKitchenDetails.name}
                  </Text>
                  <Text style={styles.conflictKitchenItemCount}>
                    {pastKitchenDetails.itemCount} item{pastKitchenDetails.itemCount !== 1 ? 's' : ''} in cart
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.clearModalButtonRow}>
              <TouchableOpacity 
                style={[styles.clearModalButton, styles.clearModalCancelButton]}
                onPress={() => {
                  setShowKitchenConflictModal(false);
                  setPendingCartAction(null);
                }}
              >
                <Text style={styles.clearModalButtonText}>No</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.clearModalButton, styles.clearModalConfirmButton]}
                onPress={handleClearCartAndProceed}
                disabled={cartLoading}
              >
                {cartLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.clearModalButtonText}>Yes, Fresh Start</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: scaleFont(16),
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: scaleFont(18),
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 15,
  },
  retryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: scaleFont(16),
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 10,
    backgroundColor: '#fff',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backButton: {
    position: 'absolute',
    top: Platform.select({
      android: ANDROID_STATUS_BAR_HEIGHT + 10,
      ios: 50
    }),
    left: 20,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  openStatusBadge: {
    position: 'absolute',
    top: Platform.select({
      android: ANDROID_STATUS_BAR_HEIGHT + 10,
      ios: 50
    }),
    right: 20,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  openStatusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  openStatus: {
    backgroundColor: '#4ECB71',
  },
  closedStatus: {
    backgroundColor: '#E65C00',
  },
  openStatusText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  kitchenInfoContainer: {
    position: 'absolute',
    top: Platform.select({
      android: HEADER_MAX_HEIGHT * 0.35,
      ios: HEADER_MAX_HEIGHT * 0.4
    }),
    bottom: 55,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  cartSummary__container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cartSummary__header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartSummary__kitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  cartSummary__kitchenImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  cartSummary__kitchenName: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: '#2d3436',
    marginBottom: 2,
    maxWidth: width * 0.5,
  },
  cartSummary__itemCountText: {
    fontSize: scaleFont(13),
    color: '#666',
  },
  cartSummary__viewMenuBtn: {
    alignSelf: 'flex-start',
  },
  cartSummary__viewMenuText: {
    color: '#4a90e2',
    fontSize: scaleFont(12),
    fontWeight: '500',
  },
  cartSummary__miniCartBtn: {
    backgroundColor: '#E65C00',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartSummary__miniCartBtnDisabled: {
    backgroundColor: '#b2bec3',
  },
  cartSummary__miniCartContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartSummary__viewCartText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginRight: 8,
  },
  cartSummary__cartCountBadge: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummary__miniCartCount: {
    color: '#E65C00',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
  },
  kitchenName: {
    fontSize: scaleFont(24),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  kitchenMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  ratingText: {
    marginLeft: 4,
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  deliveryText: {
    marginLeft: 4,
    fontSize: scaleFont(14),
    color: '#fff',
    fontWeight: '600',
  },
  minOrderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  minOrderText: {
    marginLeft: 4,
    fontSize: scaleFont(14),
    color: '#fff',
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  kitchenAddress: {
    fontSize: scaleFont(14),
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flex: 1,
  },
  timingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timingText: {
    fontSize: scaleFont(13),
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  filterContainer: {
    position: 'absolute',
    top: HEADER_MAX_HEIGHT - 30,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  filterRow: {
    paddingLeft: 15,
    paddingRight: 5,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  activeFilterBtn: {
    backgroundColor: '#E65C00',
    borderColor: '#E65C00',
  },
  disabledFilterBtn: {
    opacity: 0.6,
  },
  filterText: {
    fontSize: scaleFont(14),
    color: '#555',
    fontWeight: '500',
    marginLeft: 6,
  },
  disabledFilterText: {
    color: '#999',
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryContainer: {
    top: Platform.OS === 'android' ? 80 :20,
    marginBottom: 15,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginHorizontal: 5,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  categoryHeaderLeft: {
    flex: 1,
  },
  categoryName: {
    fontSize: scaleFont(18),
    fontWeight: 'bold',
    color: '#333',
  },
  categoryItemCount: {
    fontSize: scaleFont(13),
    color: '#666',
    marginTop: 4,
  },
  categoryItems: {
    paddingHorizontal: 10,
    paddingBottom: 5,
  },
  itemContainer: {
    position: 'relative',
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 15,
    marginVertical: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 5,
    marginHorizontal: 5,
  },
  disabledCard: {
    opacity: 0.6,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  foodImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover',
    backgroundColor: '#f5f5f5',
  },
  bestsellerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#E65C00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestsellerText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
    marginLeft: 4,
  },
  offerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4ECB71',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
    marginLeft: 4,
  },
  foodDetails: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-between',
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  foodName: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    flex: 1,
    color: '#333',
    marginRight: 8,
    lineHeight: 20,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  foodPrice: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#333',
  },
  originalPrice: {
    fontSize: scaleFont(12),
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  foodDescription: {
    color: '#666',
    fontSize: scaleFont(13),
    marginTop: 6,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  itemTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vegNonVegIconContainer: {
    borderWidth: 1.5,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  vegIcon: {
    borderColor: '#4ECB71',
    backgroundColor: 'transparent',
  },
  nonVegIcon: {
    borderColor: '#E65C00',
    backgroundColor: 'transparent',
  },
  vegNonVegDot: {
    borderRadius: 999,
  },
  vegDot: {
    backgroundColor: '#4ECB71',
  },
  nonVegDot: {
    backgroundColor: '#E65C00',
  },
  typeText: {
    fontSize: scaleFont(12),
    color: '#555',
  },
  addToCartBtn: {
    backgroundColor: '#E65C00',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  disabledAddToCartBtn: {
    backgroundColor: '#ccc',
  },
  addToCartText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: scaleFont(14),
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f0',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffd6c5',
  },
  quantityButton: {
    padding: 4,
  },
  quantityText: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#E65C00',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  menuContainer: {
    paddingBottom: 5,
  },
  refreshControl: {
    backgroundColor: 'transparent',
  },
  refreshTitle: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  modalFoodImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#f5f5f5',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalFoodName: {
    fontSize: scaleFont(22),
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    marginRight: 10,
  },
  modalPriceContainer: {
    alignItems: 'flex-end',
  },
  modalFoodPrice: {
    fontSize: scaleFont(22),
    fontWeight: 'bold',
    color: '#E65C00',
  },
  modalOriginalPrice: {
    fontSize: scaleFont(16),
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  modalBestsellerBadge: {
    backgroundColor: '#E65C00',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBestsellerText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOfferBadge: {
    backgroundColor: '#4ECB71',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOfferText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTypeText: {
    fontSize: scaleFont(12),
    color: '#555',
    marginLeft: 6,
  },
  modalFoodDescription: {
    fontSize: scaleFont(15),
    color: '#555',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  modalQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f0',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffd6c5',
  },
  modalQuantityButton: {
    padding: 6,
  },
  modalQuantityText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#E65C00',
    marginHorizontal: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  addToCartBtnLarge: {
    backgroundColor: '#E65C00',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 25,
    alignItems: 'center',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    flex: 1,
    marginLeft: 15,
  },
  disabledAddToCartBtnLarge: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  addToCartTextLarge: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: scaleFont(16),
  },
  clearModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  clearModalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  clearModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  clearModalText: {
    fontSize: scaleFont(16),
    marginBottom: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  conflictKitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  conflictKitchenImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  conflictKitchenDetails: {
    flex: 1,
  },
  conflictKitchenName: {
    fontSize: scaleFont(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  conflictKitchenItemCount: {
    fontSize: scaleFont(12),
    color: '#666',
  },
  clearModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clearModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearModalCancelButton: {
    backgroundColor: '#e0e0e0',
    marginRight: 10,
  },
  clearModalConfirmButton: {
    backgroundColor: '#E65C00',
    marginLeft: 10,
  },
  clearModalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: scaleFont(16),
  },
});

export default HomeKitchenDetails;