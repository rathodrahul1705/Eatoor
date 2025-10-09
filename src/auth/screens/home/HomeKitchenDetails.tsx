import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
  BackHandler,
  RefreshControl,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getKitcheDetails } from '../../../api/home';
import { getCart, updateCart, clearCartDetails } from '../../../api/cart';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showMessage } from 'react-native-flash-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width, height } = Dimensions.get('window');

// Placeholder images
const PLACEHOLDER_FOOD = "https://via.placeholder.com/150";
const PLACEHOLDER_RESTAURANT = "https://via.placeholder.com/300";

const HomeKitchenDetails = ({ route }) => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [modalQuantity, setModalQuantity] = useState(0);
  const [kitchenData, setKitchenData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [pastKitchenDetails, setPastKitchenDetails] = useState(null);
  const [showKitchenConflictModal, setShowKitchenConflictModal] = useState(false);
  const [pendingCartAction, setPendingCartAction] = useState(null);
  const [modalMode, setModalMode] = useState('view'); // 'view' or 'conflict'
  
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const offerScrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const modalOpenRef = useRef(false);
  
  // Check if kitchen is open
  const isKitchenOpen = kitchenData?.restaurant_current_status?.is_open || false;
  
  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    return () => backHandler.remove();
  }, []);

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
  const savePastKitchenDetails = useCallback(async (details) => {
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
    return pastKitchenDetails?.id === route.params?.kitchenId;
  }, [pastKitchenDetails, route.params?.kitchenId]);

  // Check if cart has items from different kitchen
  const hasDifferentKitchenItems = useMemo(() => {
    return pastKitchenDetails && pastKitchenDetails.id !== route.params?.kitchenId && cartItems.length > 0;
  }, [pastKitchenDetails, route.params?.kitchenId, cartItems]);

  // Check if item is currently available based on time
  const isItemAvailableByTime = (item) => {
    if (!item.start_time || !item.end_time) return item.availability;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHours, startMinutes] = item.start_time.split(':').map(Number);
    const [endHours, endMinutes] = item.end_time.split(':').map(Number);
    
    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;
    
    return currentTime >= startTime && currentTime <= endTime;
  };
  
  // Check if item is completely available (kitchen open + item available + time valid)
  const isItemCompletelyAvailable = (item) => {
    return isKitchenOpen && item.availability && isItemAvailableByTime(item);
  };

  // Fetch kitchen details
  const fetchKitchenDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getKitcheDetails(route.params?.kitchenId);
      setKitchenData(response.data);
      // Expand first category by default
      if (response.data.itemlist && response.data.itemlist.length > 0) {
        const categories = [...new Set(response.data.itemlist.map(item => item.category))];
        if (categories.length > 0) {
          setExpandedSections({ [categories[0]]: true });
        }
      }
      
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [route.params?.kitchenId]);

  // Fetch cart data
  const fetchCartData = useCallback(async () => {
    try {
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
          type: (item.food_type === 'Non-Veg' ? 'NonVeg' : 'Veg'),
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
    }
  }, [fetchUserData, savePastKitchenDetails, clearPastKitchenDetails]);

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
      setRefreshing(false);
    }
  }, [fetchKitchenDetails, fetchCartData, fetchPastKitchenDetails]);

  // Initial data load
  useEffect(() => {
    if (route.params?.kitchenId) {
      refreshData();
    }
  }, [route.params?.kitchenId]);

  // Auto change offers
  useEffect(() => {
    if (offers.length > 1) {
      const interval = setInterval(() => {
        setCurrentOfferIndex(prev => (prev + 1) % offers.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);
  
  // Show cart summary when items are added
  useEffect(() => {
    const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    setShowCartSummary(totalItems > 0);
  }, [cartItems]);

  // Update modal quantity when selected item changes, but only if modal is not open
  useEffect(() => {
    if (selectedItem && !modalOpenRef.current) {
      const cartItem = cartItems.find(item => item.id === selectedItem.id);
      setModalQuantity(cartItem?.quantity || 0);
    }
  }, [selectedItem, cartItems]);

  
  const insets = useSafeAreaInsets();
  
  // Header height decreases as we scroll
  const MAX_HEADER_HEIGHT = 220;
  const MIN_HEADER_HEIGHT = Platform.OS === 'ios' ? 30 + insets.top : 70;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [MAX_HEADER_HEIGHT, MIN_HEADER_HEIGHT],
    extrapolate: 'clamp',
  });
  
  // Kitchen name becomes visible in header as we scroll
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 100, 150],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp'
  });

    // Image opacity decreases as we scroll
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  });
  
  // Default kitchen info if API data is not available
  const defaultKitchenInfo = {
    name: "Spice Garden",
    address: "123 Food Street, Culinary District",
    shortAddress: "Food Street",
    deliveryTime: "40-45 mins",
    distance: "5 km",
    openingTime: "10:00 AM",
    closingTime: "10:00 PM",
    isOpen: true,
    rating: 4.5,
    reviews: 1247,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cmVzdGF1cmFudCUyMGludGVyaW9yfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60"
  };
  
  // Use API data or fallback to default
  const kitchenInfo = kitchenData ? {
    name: kitchenData.restaurant_name,
    address: kitchenData.Address,
    shortAddress: kitchenData.Address,
    deliveryTime: `${kitchenData.time_required_to_reach_loc} mins`,
    distance: "5 km", // Not in API response, keeping default
    openingTime: formatTime(kitchenData.opening_time),
    closingTime: formatTime(kitchenData.closing_time),
    isOpen: kitchenData.restaurant_current_status?.is_open || false,
    rating: kitchenData.rating,
    reviews: 1247, // Not in API response, keeping default
    image: kitchenData.restaurant_image
  } : defaultKitchenInfo;
  
  // Helper function to format time (HH:MM to HH:MM AM/PM)
  function formatTime(timeString) {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hourInt = parseInt(hours, 10);
    const period = hourInt >= 12 ? 'PM' : 'AM';
    const formattedHour = hourInt % 12 || 12;
    
    return `${formattedHour}:${minutes} ${period}`;
  }
  
  const filters = ['All', 'Veg', 'Non-Veg', 'Offers', 'Bestseller'];
  
  const offers = [];
  
  // Transform API data to menu items format
  const transformMenuItems = (itemlist) => {
    if (!itemlist || !Array.isArray(itemlist)) return [];
    
    const categories = [...new Set(itemlist.map(item => item.category))];
    
    return categories.map(category => {
      const categoryItems = itemlist.filter(item => item.category === category);
      return {
        id: category,
        category: category,
        items: categoryItems.map(item => ({
          id: item.id.toString(),
          name: item.item_name,
          description: item.description,
          price: parseFloat(item.item_price),
          isVeg: item.food_type === 'Veg',
          isBestseller: false,
          rating: 4.5,
          image: item.item_image,
          availability: item.availability,
          discountPercent: parseFloat(item.discount_percent) || 0,
          discountActive: item.discount_active === "1",
          start_time: item.start_time,
          end_time: item.end_time,
          // Add time-based availability
          isAvailableByTime: isItemAvailableByTime(item),
          // Add complete availability status
          isCompletelyAvailable: isItemCompletelyAvailable(item),
          // Add type for filtering
          type: item.food_type === 'Non-Veg' ? 'NonVeg' : 'Veg',
          // Add discount and BOGO info
          discount_percent: item.discount_percent,
          buy_one_get_one_free: item.buy_one_get_one_free
        }))
      };
    });
  };
  
  const menuItems = kitchenData ? transformMenuItems(kitchenData.itemlist) : [];

  // Filter menu items based on active filter
  const filteredMenuItems = menuItems.map(section => {
    if (activeFilter === 'All') return section;
    
    return {
      ...section,
      items: section.items.filter(item => {
        if (activeFilter === 'Veg') return item.isVeg;
        if (activeFilter === 'Non-Veg') return !item.isVeg;
        if (activeFilter === 'Offers') return item.discountActive || item.buy_one_get_one_free;
        if (activeFilter === 'Bestseller') return item.isBestseller;
        return true;
      })
    };
  }).filter(section => section.items.length > 0);

  const toggleSection = (sectionId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Update cart item quantity with kitchen conflict handling
  const updateCartItem = useCallback(async (
    itemId, 
    action,
    force = false
  ) => {
    if (!kitchenData?.restaurant_current_status.is_open) return;
    
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
        restaurant_id: route.params?.kitchenId,
        item_id: itemId,
        source: 'ITEMLIST',
        action,
        quantity: 1,
        user_id: user?.id
      };

      await updateCart(payload);
      
      // Update past kitchen details after cart update
      if (kitchenData) {
        const currentItemCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const newPastKitchenDetails = {
          id: route.params?.kitchenId,
          name: kitchenData.restaurant_name,
          image: kitchenData.restaurant_image || PLACEHOLDER_RESTAURANT,
          itemCount: action === 'add' ? currentItemCount + 1 : Math.max(0, currentItemCount - 1)
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
    route.params?.kitchenId, 
    kitchenData, 
    fetchCartData,
    hasDifferentKitchenItems,
    cartItems,
    savePastKitchenDetails
  ]);

  const handleClearCartAndProceed = useCallback(async () => {
    try {
      setShowKitchenConflictModal(false);
      setModalMode('view');
      setModalVisible(false)
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
    }
  }, [fetchUserData, pendingCartAction, clearPastKitchenDetails, updateCartItem]);

  // Handle adding item directly from list with conflict check
  const handleAddItemFromList = useCallback((itemId) => {
    if (hasDifferentKitchenItems) {
      setPendingCartAction({ itemId, action: 'add' });
      setShowKitchenConflictModal(true);
    } else {
      updateCartItem(itemId, 'add');
    }
  }, [hasDifferentKitchenItems, updateCartItem]);

  // Get current quantity of an item in cart
  const getItemQuantity = useCallback((itemId) => {
    const item = cartItems.find(item => item.id === itemId);
    return item?.quantity || 0;
  }, [cartItems]);

  const openItemModal = (item) => {
    setSelectedItem(item);
    setModalQuantity(getItemQuantity(item.id) || 0);
    modalOpenRef.current = true;
    setModalVisible(true);
    setModalMode('view'); // Reset to view mode when opening modal
  };

  const closeItemModal = () => {
    modalOpenRef.current = false;
    setModalVisible(false);
    setModalMode('view'); // Reset to view mode when closing modal
  };

  const openOffersModal = () => {
    setOfferModalVisible(true);
  };

  const closeOffersModal = () => {
    setOfferModalVisible(false);
  };

  // Handle Add button click in modal - check for kitchen conflict
  const handleModalAddButton = useCallback(() => {
    if (!selectedItem) return;
    
    // Check for kitchen conflict
    if (hasDifferentKitchenItems) {
      setPendingCartAction({ itemId: selectedItem.id, action: 'add' });
      setModalMode('conflict');
    } else {
      // No conflict, proceed with adding item
      updateModalQuantity(1);
    }
  }, [selectedItem, hasDifferentKitchenItems]);

  // Update modal quantity and make API calls
  const updateModalQuantity = useCallback((change) => {
    if (!isKitchenOpen || !selectedItem) return;
    
    const newQuantity = Math.max(0, modalQuantity + change);
    setModalQuantity(newQuantity);
    
    // Make API call based on the change
    if (change > 0) {
      // Add item
      updateCartItem(selectedItem.id, 'add');
    } else if (change < 0 && newQuantity >= 0) {
      // Remove item
      updateCartItem(selectedItem.id, 'remove');
    }
  }, [isKitchenOpen, selectedItem, modalQuantity, updateCartItem]);

  const getTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getTotalPrice = () => {
    let total = 0;
    for (const item of cartItems) {
      if (item.quantity > 0) {
        // Apply discount if available
        const price = item.discountActive && item.discount_percent
          ? item.price * (1 - parseFloat(item.discount_percent) / 100)
          : item.price;
        total += price * item.quantity;
      }
    }
    return Math.round(total);
  };

  // View cart handler
  const handleViewCart = useCallback(() => {
    const pastkitcheId = pastKitchenDetails?.id;
    if (!kitchenData) return;
    navigation.navigate('CartScreen', { 
      cartItems,
      totalPrice: getTotalPrice(),
      pastkitcheId,
      restaurant: {
        name: kitchenData.restaurant_name,
        address: kitchenData.Address,
        minOrder: kitchenData.min_order,
        coverImage: kitchenData.restaurant_image || PLACEHOLDER_RESTAURANT,
        isOpen: kitchenData.restaurant_current_status.is_open
      },
      userId: user?.id
    });
  }, [navigation, kitchenData, cartItems, pastKitchenDetails, user?.id]);

  // Back to kitchen handler
  const BackToKitchen = useCallback(() => {
    // This function would navigate back to the kitchen screen
    // For now, we'll just scroll to the top
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, []);

  const renderFilterChip = (filter) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterChip,
        activeFilter === filter && styles.activeFilterChip
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text style={[
        styles.filterText,
        activeFilter === filter && styles.activeFilterText
      ]}>
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const renderOfferItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.offerItem,
        index === currentOfferIndex && styles.activeOfferItem
      ]}
      onPress={openOffersModal}
      activeOpacity={0.8}
    >
      <View style={styles.offerIcon}>
        <Icon name="pricetag" size={20} color="#e65c00" />
      </View>
      <View style={styles.offerContent}>
        <Text style={styles.offerTitle}>{item.title}</Text>
        <Text style={styles.offerDescription}>{item.description}</Text>
        <View style={styles.offerCodeContainer}>
          <Text style={styles.offerCodeText}>Use code: {item.code}</Text>
        </View>
      </View>
      <View style={styles.offerCount}>
        <Text style={styles.offerCountText}>{index + 1}/{offers.length}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderMenuItem = ({ item }) => {
    const quantity = getItemQuantity(item.id);
    const discountedPrice = item.discountActive 
      ? Math.round(item.price * (1 - item.discountPercent / 100))
      : null;
    
    const isAvailable = item.isCompletelyAvailable;
    const isUpdating = updatingItemId === item.id;
    
    return (
      <TouchableOpacity 
        style={styles.menuItem}
        onPress={() => isAvailable && openItemModal(item)}
        activeOpacity={isAvailable ? 0.7 : 1}
        disabled={!isAvailable}
      >
        {!isAvailable && (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>
              {!item.availability
                ? 'Currently unavailable'
                : 'Not available at this time'}
            </Text>
          </View>
        )}

        <View style={styles.menuItemContent}>
          <View style={styles.menuItemHeader}>
            <View style={styles.menuItemVegIndicator}>
              {item.isVeg ? (
                <View style={styles.vegIndicator}>
                  <View style={[styles.vegInnerDot, { backgroundColor: 'green' }]} />
                </View>
              ) : (
                <View style={styles.nonVegIndicator}>
                  <View style={[styles.vegInnerDot, { backgroundColor: '#cc0000' }]} />
                </View>
              )}
            </View>
            <View style={styles.menuItemTextContainer}>
              <Text style={styles.menuItemName}>{item.name}</Text>
              {item.isBestseller && (
                <View style={styles.bestsellerBadge}>
                  <Icon name="trophy" size={12} color="#FFD700" />
                  <Text style={styles.bestsellerText}>Bestseller</Text>
                </View>
              )}
            </View>
          </View>
          <Text 
            style={styles.menuItemDescription}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.description}
          </Text>
          <View style={styles.menuItemFooter}>
            <View style={styles.priceContainer}>
              {discountedPrice ? (
                <>
                  <Text style={styles.discountedPrice}>₹{discountedPrice}</Text>
                  <Text style={styles.originalPrice}>₹{item.price}</Text>
                  {item.discountActive && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>{item.discountPercent}% OFF</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.menuItemPrice}>₹{item.price}</Text>
              )}
            </View>
            {item.rating && (
              <View style={styles.ratingContainer}>
                <Icon name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{item.rating}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.menuItemImageContainer}>
          <Image 
            source={{ uri: item.image }} 
            style={styles.menuItemImage}
            resizeMode="cover"
          />
          {isAvailable ? (
            quantity === 0 ? (
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => handleAddItemFromList(item.id)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#e65c00" />
                ) : (
                  <Text style={styles.addButtonText}>ADD</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.quantityControls}>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => updateCartItem(item.id, 'remove')}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#e65c00" />
                  ) : (
                    <Icon name="remove" size={16} color="#e65c00" />
                  )}
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => updateCartItem(item.id, 'add')}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#e65c00" />
                  ) : (
                    <Icon name="add" size={16} color="#e65c00" />
                  )}
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMenuSection = ({ item: section }) => {
    const isExpanded = expandedSections[section.id] || false;
    
    return (
      <View style={styles.menuSection}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => toggleSection(section.id)}
          activeOpacity={0.8}
        >
          <View style={styles.sectionHeaderContent}>
            <Text style={styles.sectionTitle}>{section.category}</Text>
            <Icon 
              name={isExpanded ? "chevron-up" : "chevron-down"} 
              size={24} 
              color="#e65c00" 
            />
          </View>
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.sectionContent}>
            <FlatList
              data={section.items}
              renderItem={renderMenuItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#e65c00" />
          <Text style={styles.loadingText}>Loading Kitchen Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContent}>
          <Icon name="alert-circle-outline" size={60} color="#e65c00" />
          <Text style={styles.errorText}>Failed to load kitchen details</Text>
          <Text style={styles.errorSubText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Sticky Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: imageOpacity }]}>
          <Image 
            source={{ uri: kitchenInfo.image }} 
            style={styles.headerImage}
          />
          <View style={styles.headerOverlay} />
        </Animated.View>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
        >
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <Animated.Text 
          style={[styles.stickyTitle, { opacity: headerTitleOpacity }]}
          numberOfLines={1}
        >
          {kitchenInfo.name}
        </Animated.Text>
      </Animated.View>

      <Animated.ScrollView 
        ref={scrollViewRef}
        style={[styles.scrollView, { marginBottom: showCartSummary ? 120 : 0 }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshData}
            colors={['#e65c00']}
            tintColor="#e65c00"
          />
        }
      >
        {/* Kitchen Info Section */}
        <View style={styles.kitchenInfo}>
          <View style={styles.kitchenHeader}>
            <Text style={styles.kitchenName}>{kitchenInfo.name}</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={16} color="#fff" />
              <Text style={styles.ratingText}>{kitchenInfo.rating}</Text>
            </View>
          </View>
          
          <Text style={styles.kitchenCuisine}>North Indian, Chinese, Mughlai</Text>
          
          <View style={styles.kitchenDetails}>
            <View style={styles.detailRow}>
              <Icon name="time-outline" size={16} color="#666" />
              <Text style={styles.kitchenDeliveryTime}>{kitchenInfo.deliveryTime}</Text>
              <View style={styles.dotSeparator} />
              <Text style={styles.kitchenDistance}>{kitchenInfo.distance}</Text>
              <View style={styles.dotSeparator} />
              <Icon name="location-outline" size={16} color="#666" />
              <Text style={styles.kitchenAddress}>{kitchenInfo.shortAddress}</Text>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.timingsContainer}>
                <Text style={styles.kitchenTimings}>
                  {kitchenInfo.openingTime} - {kitchenInfo.closingTime}
                </Text>
                <View style={[
                  styles.statusIndicator,
                  kitchenInfo.isOpen ? styles.openIndicator : styles.closedIndicator
                ]} />
                <Text style={[
                  styles.kitchenStatus,
                  kitchenInfo.isOpen ? styles.openText : styles.closedText
                ]}>
                  {kitchenInfo.isOpen ? 'Open Now' : 'Closed Now'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Offers Banner - Conditionally Rendered */}
        {offers.length > 0 ? (
          <View style={styles.offersContainer}>
            <View style={styles.offersHeader}>
              <Icon name="pricetag" size={20} color="#e65c00" />
              <Text style={styles.offersTitle}>Offers</Text>
              <TouchableOpacity onPress={openOffersModal} style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <Icon name="chevron-forward" size={16} color="#e65c00" />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={offerScrollRef}
              data={offers}
              renderItem={renderOfferItem}
              keyExtractor={item => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / (width - 40));
                setCurrentOfferIndex(index);
              }}
            />
            <View style={styles.offerPagination}>
              {offers.map((_, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.paginationDot,
                    index === currentOfferIndex && styles.paginationDotActive
                  ]} 
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.noOffersContainer}>
            <Icon name="pricetag-outline" size={24} color="#ccc" />
            <Text style={styles.noOffersText}>No offers available at the moment</Text>
          </View>
        )}


        {/* Filters Section */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map(renderFilterChip)}
        </ScrollView>

        {/* Kitchen Closed Message */}
        {!isKitchenOpen && (
          <View style={styles.closedMessageContainer}>
            <Icon name="time-outline" size={24} color="#e65c00" />
            <Text style={styles.closedMessageText}>
              This kitchen is currently closed. You can browse the menu but cannot place orders.
            </Text>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {filteredMenuItems.length > 0 ? (
            <FlatList
              data={filteredMenuItems}
              renderItem={renderMenuSection}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.noItemsContainer}>
              <Icon name="fast-food-outline" size={60} color="#ccc" />
              <Text style={styles.noItemsText}>No items found for this filter</Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* New Cart Summary Bar */}
      {showCartSummary && pastKitchenDetails && (
        <View style={styles.cartSummary__container}>
          <View style={styles.cartSummary__header}>
            <View style={styles.cartSummary__kitchenInfo}>
              <Image 
                source={{ uri: pastKitchenDetails.image || PLACEHOLDER_RESTAURANT }} 
                style={styles.cartSummary__kitchenImage}
              />
              <View>
                <Text style={styles.cartSummary__kitchenName} numberOfLines={1}>
                  {pastKitchenDetails.name}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.cartSummary__miniCartBtn}
              onPress={handleViewCart}
              activeOpacity={0.9}
            >
              <View style={styles.cartSummary__miniCartContent}>
                <Text style={styles.cartSummary__viewCartText}>View Cart</Text>
                <View style={styles.cartSummary__cartCountBadge}>
                  <Text style={styles.cartSummary__miniCartCount}>{pastKitchenDetails.itemCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Item Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeItemModal}
        onDismiss={() => modalOpenRef.current = false}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeItemModal}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={closeItemModal}
                >
                  <Icon name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>
              
              {selectedItem && (
                <>
                  <Image 
                    source={{ uri: selectedItem.image }} 
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                  
                  <View style={styles.modalItemHeader}>
                    <View style={styles.modalVegIndicator}>
                      {selectedItem.isVeg ? (
                        <View style={styles.modalVegIndicatorIcon}>
                          <View style={[styles.modalVegInnerDot, { backgroundColor: 'green' }]} />
                        </View>
                      ) : (
                        <View style={styles.modalNonVegIndicator}>
                          <View style={[styles.modalVegInnerDot, { backgroundColor: '#cc0000' }]} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                  </View>
                  
                  <Text style={styles.modalItemDescription}>{selectedItem.description}</Text>
                  
                  {selectedItem.rating && (
                    <View style={styles.modalRating}>
                      <Icon name="star" size={16} color="#FFD700" />
                      <Text style={styles.modalRatingText}>{selectedItem.rating}</Text>
                    </View>
                  )}
                  
                  <View style={styles.modalPriceContainer}>
                    {selectedItem.discountActive ? (
                      <>
                        <Text style={styles.modalItemPrice}>
                          ₹{Math.round(selectedItem.price * (1 - selectedItem.discountPercent / 100))}
                        </Text>
                        <Text style={styles.modalOriginalPrice}>₹{selectedItem.price}</Text>
                        <View style={styles.modalDiscountBadge}>
                          <Text style={styles.modalDiscountText}>{selectedItem.discountPercent}% OFF</Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.modalItemPrice}>₹{selectedItem.price}</Text>
                    )}
                  </View>
                  
                  {!selectedItem.isCompletelyAvailable && (
                    <View style={styles.unavailableMessage}>
                      <Text style={styles.unavailableMessageText}>
                        {!selectedItem.availability
                          ? 'This item is currently unavailable'
                          : 'Not available at this time'}
                      </Text>
                    </View>
                  )}

                  {/* Kitchen Conflict Message in Modal */}
                  {modalMode === 'conflict' && (
                    <View style={styles.conflictMessage}>
                      <Text style={styles.conflictMessageTitle}>🚨 Kitchen Conflict</Text>
                      <Text style={styles.conflictMessageText}>
                        Your cart contains items from another restaurant. Would you like to reset your cart and add this item?
                      </Text>
                      <View style={styles.conflictButtons}>
                        <TouchableOpacity 
                          style={[styles.conflictButton, styles.conflictCancelButton]}
                          onPress={() => {
                            setModalMode('view');
                            setPendingCartAction(null);
                          }}
                        >
                          <Text style={styles.conflictButtonText}>No</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.conflictButton, styles.conflictConfirmButton]}
                          onPress={handleClearCartAndProceed}
                        >
                          <Text style={styles.conflictButtonText}>Yes, Fresh Start</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  
                  {/* Quantity Controls or Add Button */}
                  {modalMode === 'view' && (
                    <View style={styles.modalQuantityContainer}>
                      <Text style={styles.quantityLabel}>Quantity:</Text>
                      {modalQuantity === 0 ? (
                        <TouchableOpacity 
                          style={[
                            styles.addButtonModal,
                            !selectedItem.isCompletelyAvailable && styles.addButtonModalDisabled
                          ]}
                          onPress={handleModalAddButton}
                          disabled={!selectedItem.isCompletelyAvailable || updatingItemId === selectedItem.id}
                        >
                          {updatingItemId === selectedItem.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.addButtonModalText}>ADD</Text>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.modalQuantityControls}>
                          <TouchableOpacity 
                            style={styles.modalQuantityButton}
                            onPress={() => updateModalQuantity(-1)}
                            disabled={modalQuantity === 0 || !selectedItem.isCompletelyAvailable || updatingItemId === selectedItem.id}
                          >
                            {updatingItemId === selectedItem.id ? (
                              <ActivityIndicator size="small" color="#ccc" />
                            ) : (
                              <Icon 
                                name="remove" 
                                size={20} 
                                color={modalQuantity === 0 || !selectedItem.isCompletelyAvailable ? "#ccc" : "#e65c00"} 
                              />
                            )}
                          </TouchableOpacity>
                          <Text style={styles.modalQuantityText}>{modalQuantity}</Text>
                          <TouchableOpacity 
                            style={styles.modalQuantityButton}
                            onPress={() => updateModalQuantity(1)}
                            disabled={!selectedItem.isCompletelyAvailable || updatingItemId === selectedItem.id}
                          >
                            {updatingItemId === selectedItem.id ? (
                              <ActivityIndicator size="small" color="#ccc" />
                            ) : (
                              <Icon 
                                name="add" 
                                size={20} 
                                color={!selectedItem.isCompletelyAvailable ? "#ccc" : "#e65c00"} 
                              />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Offers Modal - Updated to handle empty state */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={offerModalVisible}
        onRequestClose={closeOffersModal}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeOffersModal}
          >
            <View style={styles.offersModalContent}>
              <View style={styles.offersModalHeader}>
                <Text style={styles.offersModalTitle}>Available Offers</Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={closeOffersModal}
                >
                  <Icon name="close" size={28} color="#333" />
                </TouchableOpacity>
              </View>
              
              {offers.length > 0 ? (
                <FlatList
                  data={offers}
                  renderItem={({ item }) => (
                    <View style={styles.offerModalItem}>
                      <View style={styles.offerModalIcon}>
                        <Icon name="pricetag" size={20} color="#e65c00" />
                      </View>
                      <View style={styles.offerModalContent}>
                        <Text style={styles.offerModalTitle}>{item.title}</Text>
                        <Text style={styles.offerModalDescription}>{item.description}</Text>
                        <View style={styles.offerCodeContainer}>
                          <Text style={styles.offerCodeText}>Use code: {item.code}</Text>
                          <TouchableOpacity style={styles.copyButton}>
                            <Text style={styles.copyButtonText}>COPY</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                  keyExtractor={item => item.id}
                />
              ) : (
                <View style={styles.noOffersModalContent}>
                  <Icon name="pricetag-outline" size={48} color="#e0e0e0" />
                  <Text style={styles.noOffersModalText}>No offers available</Text>
                  <Text style={styles.noOffersModalSubText}>
                    Check back later for exciting offers and discounts!
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
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
              Your cart contains items from another restaurant. Would you like to reset your cart and start fresh with items from this kitchen?
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
                <Text style={styles.clearModalButtonText}>No, Keep Items</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.clearModalButton, styles.clearModalConfirmButton]}
                onPress={handleClearCartAndProceed}
              >
                <Text style={styles.clearModalButtonText}>Yes, Fresh Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  errorSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 5, 
    backgroundColor: '#fff',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 11,
  },
  stickyTitle: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 28,
    left: 64,
    right: 16,
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    zIndex: 11,
  },
  kitchenInfo: {
    padding: 20,
    paddingTop: 24,
    backgroundColor: '#fff',
    marginTop: 200,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 6,
    borderBottomColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  kitchenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kitchenName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a9c39',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ratingText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 14,
  },
  kitchenCuisine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  kitchenDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  kitchenAddress: {
    fontSize: 14,
    color: '#666',
  },
  kitchenDeliveryTime: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  kitchenDistance: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noOffersContainer: {
  padding: 20,
  backgroundColor: '#fff',
  borderBottomWidth: 6,
  borderBottomColor: '#f5f5f5',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: 12,
},
noOffersText: {
  fontSize: 16,
  color: '#999',
  textAlign: 'center',
},
noOffersModalContent: {
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
},
noOffersModalText: {
  fontSize: 18,
  color: '#666',
  fontWeight: '600',
  marginTop: 16,
  textAlign: 'center',
},
noOffersModalSubText: {
  fontSize: 14,
  color: '#999',
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 20,
},
  kitchenTimings: {
    fontSize: 14,
    color: '#666',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  openIndicator: {
    backgroundColor: '#00cc00',
  },
  closedIndicator: {
    backgroundColor: '#cc0000',
  },
  kitchenStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  openText: {
    color: '#00cc00',
  },
  closedText: {
    color: '#cc0000',
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
  },
  offersContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 6,
    borderBottomColor: '#f5f5f5',
  },
  offersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  offersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#e65c00',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
  },
  offerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f9f9f9',
    marginRight: 16,
    width: width - 40,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeOfferItem: {
    backgroundColor: '#fff8e6',
    borderColor: '#ffd166',
    shadowColor: '#e65c00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  offerIcon: {
    marginRight: 12,
    backgroundColor: '#fff0e0',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerContent: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  offerDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  offerCodeContainer: {
    backgroundColor: '#fff0e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  offerCodeText: {
    fontSize: 12,
    color: '#e65c00',
    fontWeight: '500',
  },
  offerCount: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offerCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  offerPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  paginationDotActive: {
    backgroundColor: '#e65c00',
    width: 12,
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 6,
    borderBottomColor: '#f5f5f5',
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterChip: {
    backgroundColor: '#e65c00',
    borderColor: '#e65c00',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  closedMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e6',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd166',
  },
  closedMessageText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#e65c00',
    flex: 1,
  },
  menuContainer: {
    padding: 16,
    backgroundColor: '#fff',
    minHeight: 300,
  },
  noItemsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noItemsText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  menuSection: {
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    padding: 16,
    backgroundColor: '#fafafa',
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  },
  unavailableOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  unavailableText: {
    color: '#cc0000',
    fontWeight: '500',
    fontSize: 11,
    textAlign: 'center',
  },
  menuItemContent: {
    flex: 1,
    gap: 8,
  },
  menuItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemVegIndicator: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: 'green',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nonVegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#cc0000',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuItemTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bestsellerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  bestsellerText: {
    fontSize: 12,
    color: '#e65c00',
    fontWeight: '500',
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuItemImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 12,
    position: 'relative',
  },
  menuItemImage: {
    width: '100%',
    height: '100%',
  },
  addButton: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: [{ translateX: -30 }],
    width: 60,
    backgroundColor: '#fff',
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e65c00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#e65c00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quantityControls: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: [{ translateX: -40 }],
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e65c00',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // New Cart Summary Styles
  cartSummary__container: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 0 : 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    marginRight: 16,
  },
  cartSummary__kitchenImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  cartSummary__kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    maxWidth: 150,
  },
  cartSummary__viewMenuBtn: {
    alignSelf: 'flex-start',
  },
  cartSummary__viewMenuText: {
    color: '#e65c00',
    fontSize: 13,
    fontWeight: '500',
  },
  cartSummary__miniCartBtn: {
    backgroundColor: '#e65c00',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e65c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cartSummary__miniCartContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartSummary__viewCartText: {
    color: '#fff',
    fontSize: 14,
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
    color: '#e65c00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    marginBottom: 0,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: height * 0.9,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  modalItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  modalVegIndicator: {
    width: 24,
    alignItems: 'center',
  },
  modalVegIndicatorIcon: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: 'green',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNonVegIndicator: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#cc0000',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalVegInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modalItemName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  modalItemDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  modalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  modalRatingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  modalItemPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOriginalPrice: {
    fontSize: 18,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  modalDiscountBadge: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modalDiscountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  unavailableMessage: {
    backgroundColor: '#fff0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  unavailableMessageText: {
    color: '#cc0000',
    fontWeight: '500',
    textAlign: 'center',
  },
  conflictMessage: {
    backgroundColor: '#fff8e6',
    borderWidth: 1,
    borderColor: '#ffd166',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  conflictMessageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65c00',
    marginBottom: 8,
    textAlign: 'center',
  },
  conflictMessageText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  conflictButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  conflictButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictCancelButton: {
    backgroundColor: '#e0e0e0',
  },
  conflictConfirmButton: {
    backgroundColor: '#e65c00',
  },
  conflictButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  modalQuantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addButtonModal: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  addButtonModalDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonModalText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalQuantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalQuantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  addToCartButton: {
    backgroundColor: '#e65c00',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addToCartText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  offersModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: height * 0.7,
  },
  offersModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  offersModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  offerModalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  offerModalIcon: {
    marginRight: 16,
    marginTop: 4,
  },
  offerModalContent: {
    flex: 1,
  },
  offerModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  offerModalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  copyButton: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  copyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  clearModalText: {
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  conflictKitchenItemCount: {
    fontSize: 12,
    color: '#666',
  },
  clearModalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clearModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
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
    fontSize: 16,
  },
});

export default HomeKitchenDetails;