import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  Animated,
  Modal,
  Vibration,
  Easing,
  FlatList,
  Image,
  RefreshControl,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  AppState,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Sound from 'react-native-sound';
import Slider from '@react-native-community/slider';
import { 
  getOrderDetails, 
  getRestaurantList, 
  updateOrderStatus, 
  updateRestaurantStatus 
} from '../../../api/partner';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Responsive calculations
const isSmallScreen = width < 375;
const isLargeScreen = width > 414;
const isTablet = width >= 768;

// Responsive scaling functions
const scaleFont = (size) => {
  const scaleFactor = isTablet ? 1.3 : isSmallScreen ? 0.9 : 1;
  const baseSize = isSmallScreen ? size * 0.9 : isLargeScreen ? size * 1.1 : size;
  return Math.ceil(baseSize * scaleFactor);
};

const scaleSize = (size) => {
  const scaleFactor = width / 375;
  return Math.ceil(size * Math.min(scaleFactor, isTablet ? 1.5 : 1.2));
};

const moderateScale = (size, factor = 0.5) => {
  const scaleFactor = width / 375;
  return size + (scaleFactor - 1) * size * factor;
};

const ORDER_TIMEOUT = 5 * 60; // 5 minutes in seconds

// Filter options
const FILTER_OPTIONS = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'pending', label: 'Pending', icon: 'time-outline' },
  { id: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { id: 'preparing', label: 'Preparing', icon: 'fast-food-outline' },
  { id: 'ready', label: 'Ready', icon: 'cube-outline' },
  { id: 'on_the_way', label: 'On the Way', icon: 'car-outline' },
  { id: 'delivered', label: 'Delivered', icon: 'checkmark-done' },
  { id: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
  { id: 'refunded', label: 'Refunded', icon: 'arrow-undo-outline' },
];

// Order status mapping from API
const ORDER_STATUS_MAPPING = {
  1: 'pending',
  2: 'confirmed',
  3: 'preparing',
  4: 'ready',
  5: 'on_the_way',
  6: 'delivered',
  7: 'cancelled',
  8: 'refunded',
};

// Reverse mapping for API
const STATUS_TO_API_MAPPING = {
  'pending': 1,
  'confirmed': 2,
  'preparing': 3,
  'ready': 4,
  'on_the_way': 5,
  'delivered': 6,
  'cancelled': 7,
  'refunded': 8,
};

// Status flow for order progression
const STATUS_FLOW = [
  'pending',
  'confirmed', 
  'preparing',
  'ready',
  'on_the_way',
  'delivered'
];

// Next status mapping
const NEXT_STATUS_MAPPING = {
  'pending': 'confirmed',
  'confirmed': 'preparing',
  'preparing': 'ready',
  'ready': 'on_the_way',
  'on_the_way': 'delivered',
  'delivered': null,
  'cancelled': null,
  'refunded': null,
};

// Status colors for UI
const STATUS_COLORS = {
  'pending': '#F59E0B',
  'confirmed': '#10B981',
  'preparing': '#3B82F6',
  'ready': '#8B5CF6',
  'on_the_way': '#EC4899',
  'delivered': '#F07119',
  'cancelled': '#EF4444',
  'refunded': '#6B7280',
};

// Button colors for status updates
const STATUS_BUTTON_COLORS = {
  'pending': '#10B981',
  'confirmed': '#3B82F6',
  'preparing': '#8B5CF6',
  'ready': '#EC4899',
  'on_the_way': '#F07119',
  'delivered': '#10B981',
  'cancelled': '#EF4444',
  'refunded': '#6B7280',
};

// Button text for status updates
const STATUS_BUTTON_TEXT = {
  'confirmed': 'Confirm Order',
  'preparing': 'Start Preparing',
  'ready': 'Mark as Ready',
  'on_the_way': 'Mark as On the Way',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
};

// Reverse mapping for display
const STATUS_DISPLAY_MAP = {
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'preparing': 'Preparing',
  'ready': 'Ready for Pickup',
  'on_the_way': 'On the Way',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
};

// Restaurant status mapping
const RESTAURANT_STATUS_MAPPING = {
  0: 'offline',
  1: 'online',
  2: 'online',
  3: 'offline',
};

const RESTAURANT_STATUS_DISPLAY = {
  'online': 'Online',
  'offline': 'Offline',
  'inactive': 'Inactive',
};

const RESTAURANT_STATUS_COLORS = {
  'online': '#10B981',
  'offline': '#EF4444',
  'inactive': '#6B7280',
};

const RESTAURANT_STATUS_API_MAPPING = {
  'online': '2',
  'offline': '3',
};

// Role-based permissions
const ROLE_PERMISSIONS = {
  1: {
    canUpdateOrderStatus: ['pending', 'confirmed', 'preparing', 'ready'],
    canSeeRevenue: false,
    canManageRestaurant: true,
    canCancelOrders: true,
    canChangeToOnTheWay: false,
    canChangeToDelivered: false,
    canUpdateTo: (currentStatus, nextStatus) => {
      const allowedStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
      return allowedStatuses.includes(nextStatus) && 
             STATUS_FLOW.indexOf(nextStatus) > STATUS_FLOW.indexOf(currentStatus);
    }
  },
  2: {
    canUpdateOrderStatus: ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered', 'cancelled'],
    canSeeRevenue: true,
    canManageRestaurant: true,
    canCancelOrders: true,
    canChangeToOnTheWay: true,
    canChangeToDelivered: true,
    canUpdateTo: (currentStatus, nextStatus) => {
      if (['cancelled', 'refunded'].includes(nextStatus)) return true;
      return STATUS_FLOW.indexOf(nextStatus) > STATUS_FLOW.indexOf(currentStatus);
    }
  },
  3: {
    canUpdateOrderStatus: ['on_the_way', 'delivered'],
    canSeeRevenue: false,
    canManageRestaurant: false,
    canCancelOrders: false,
    canChangeToOnTheWay: true,
    canChangeToDelivered: true,
    canUpdateTo: (currentStatus, nextStatus) => {
      return (currentStatus === 'ready' && nextStatus === 'on_the_way') ||
             (currentStatus === 'on_the_way' && nextStatus === 'delivered');
    }
  }
};

// Generate unique ID for orders
const generateUniqueOrderId = (order_number, orderTime, additionalIdentifier = '') => {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substr(2, 9);
  const timeString = orderTime ? orderTime.replace(/[^0-9]/g, '') : '';
  
  const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };
  
  const baseString = `${order_number}-${timeString}-${additionalIdentifier}`;
  const hash = simpleHash(baseString);
  
  return `order-${hash}-${timestamp}-${random}`;
};

const PartnerScreen = ({ navigation, route }) => {
  const [pendingNotification, setPendingNotification] = useState(null);
  const [notificationProcessed, setNotificationProcessed] = useState(false);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  
  const [restaurants, setRestaurants] = useState([]);
  const [ordersData, setOrdersData] = useState({});
  const [allOrders, setAllOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  
  const [timeRemaining, setTimeRemaining] = useState(ORDER_TIMEOUT);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.9);
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  const [stats, setStats] = useState({
    todayOrders: 0,
    revenue: 0,
    avgTime: '0m',
    pending: 0,
    preparing: 0,
    ready: 0,
    onTheWay: 0,
    delivered: 0,
  });

  const [isPolling, setIsPolling] = useState(false);
  const [lastFetchedOrders, setLastFetchedOrders] = useState([]);
  const [notificationQueue, setNotificationQueue] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingRestaurantStatus, setUpdatingRestaurantStatus] = useState(false);
  const [isRestaurantChanging, setIsRestaurantChanging] = useState(false);
  const [notificationOrderId, setNotificationOrderId] = useState(null);
  const [notificationRestaurantId, setNotificationRestaurantId] = useState(null);

  const slideAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const alarmSound = useRef(null);
  const timeoutRef = useRef(null);
  const countdownRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const notificationQueueRef = useRef(notificationQueue);
  const isInitialMount = useRef(true);
  const fetchAttempted = useRef(false);
  const searchInputRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const backgroundPollingRef = useRef(null);
  const orderIdMapRef = useRef(new Map());
  const processedOrderIdsRef = useRef(new Set());
  const lastRestaurantIdRef = useRef(null);
  const navigationRef = useRef(navigation);
  const dataLoadedRef = useRef(false);
  const notificationHandledRef = useRef(false);
  const notificationTimeoutRef = useRef(null);
  const storedRestaurantIdRef = useRef(null);
  const notificationDataRef = useRef(null);

  const userRole = user?.role || 1;
  const userPermissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS[1];
  const isLimitedUser = userRole === 1;
  const isDeliveryUser = userRole === 3;
  const isFullAccessUser = userRole === 2;

  const orders = selectedRestaurant ? ordersData[selectedRestaurant.restaurant_id] || [] : [];

  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  useEffect(() => {
    notificationQueueRef.current = notificationQueue;
  }, [notificationQueue]);

  useEffect(() => {
    console.log('🔍 Checking notification data on mount:', {
      notificationData: route.params?.notificationData,
      fromNotification: route.params?.fromNotification
    });

    if (route.params?.fromNotification && route.params?.notificationData) {
      const notification = {
        data: route.params.notificationData,
        timestamp: Date.now(),
        processed: false
      };
      
      notificationDataRef.current = notification;
      setPendingNotification(notification);
      console.log('📱 Notification stored for processing:', notification.data);
      
      navigation.setParams({ notificationData: undefined, fromNotification: undefined });
    }
  }, [route.params]);

  useEffect(() => {
    if (notificationDataRef.current && 
        !notificationDataRef.current.processed && 
        dataLoadedRef.current && 
        restaurants.length > 0 &&
        !notificationHandledRef.current) {
      console.log('🚀 Processing stored notification after data load:', notificationDataRef.current.data);
      handleNotificationData(notificationDataRef.current.data);
      
      notificationDataRef.current.processed = true;
      notificationHandledRef.current = true;
    }
  }, [dataLoadedRef.current, restaurants.length]);

  const showNotificationLoader = (message) => {
    setNotificationLoading(true);
    setNotificationMessage(message);
  };

  const hideNotificationLoader = () => {
    setNotificationLoading(false);
    setNotificationMessage('');
  };

  const handleNotificationData = useCallback(async (notificationData) => {
    try {
      console.log('🎯 Processing notification data:', notificationData);
      
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      
      showNotificationLoader('Loading restaurant and order details...');
      
      const { 
        click_action, 
        action_type, 
        order_number, 
        orderId,
        restaurant_id, 
        restaurantId,
        action_screen,
        type 
      } = notificationData;
      
      console.log('📋 Extracted notification details:', {
        order_number: order_number || orderId,
        restaurant_id: restaurant_id || restaurantId,
        type
      });
      
      const finalRestaurantId = restaurant_id || restaurantId;
      const finalOrderId = order_number || orderId;
      
      if (!finalRestaurantId || !finalOrderId) {
        console.log('❌ Missing restaurantId or orderId in notification');
        hideNotificationLoader();
        Alert.alert(
          'Notification Error',
          'Missing restaurant or order information in notification.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      setNotificationRestaurantId(finalRestaurantId.toString());
      setNotificationOrderId(finalOrderId.toString());
      
      await navigateToOrderFromNotification(
        finalRestaurantId.toString(), 
        finalOrderId.toString()
      );
      
    } catch (error) {
      console.error('❌ Error processing notification:', error);
      hideNotificationLoader();
      Alert.alert(
        'Notification Error',
        'Could not process notification. Please try refreshing.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  const navigateToOrderFromNotification = useCallback(async (restaurantId, orderNumber) => {
    console.log('🧭 Starting navigation to order from notification:', { 
      restaurantId, 
      orderNumber,
      currentSelectedRestaurantId: selectedRestaurant?.restaurant_id,
      restaurantsCount: restaurants.length
    });
    
    try {
      notificationHandledRef.current = true;
      
      if (restaurants.length === 0) {
        console.log('🏪 No restaurants available, cannot navigate');
        hideNotificationLoader();
        return;
      }
      
      const targetRestaurant = restaurants.find(r => 
        r.restaurant_id && r.restaurant_id.toString() === restaurantId.toString()
      );
      
      if (!targetRestaurant) {
        console.log('❌ Restaurant not found in current list:', restaurantId);
        hideNotificationLoader();
        notificationHandledRef.current = false;
        return;
      }
      
      console.log('✅ Found restaurant:', targetRestaurant.restaurant_name);
      
      setNotificationMessage(`Switching to ${targetRestaurant.restaurant_name}...`);
      
      const needToSwitch = !selectedRestaurant || 
        selectedRestaurant.restaurant_id.toString() !== restaurantId.toString();
      
      if (needToSwitch) {
        console.log('🔄 Switching to notification restaurant...');
        await switchRestaurant(targetRestaurant);
        
        setNotificationMessage(`Loading orders for ${targetRestaurant.restaurant_name}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('📥 Fetching orders for restaurant:', restaurantId);
      setNotificationMessage('Fetching order details...');
      await fetchOrdersForRestaurant(restaurantId);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const restaurantOrders = ordersData[restaurantId] || [];
      console.log('🔍 Searching for order in', restaurantOrders.length, 'orders');
      
      const targetOrder = restaurantOrders.find(order => 
        order.order_number && order.order_number.toString() === orderNumber.toString()
      );
      
      if (targetOrder) {
        console.log('✅ Order found, opening modal');
        hideNotificationLoader();
        setTimeout(() => {
          openOrderModal(targetOrder);
          setNotificationOrderId(null);
          setNotificationRestaurantId(null);
          notificationHandledRef.current = false;
        }, 500);
      } else {
        console.log('❌ Order not found after fetch');
        setNotificationMessage('Searching for order...');
        setTimeout(async () => {
          await fetchOrdersForRestaurant(restaurantId);
          
          setTimeout(() => {
            const updatedOrders = ordersData[restaurantId] || [];
            const foundOrder = updatedOrders.find(order => 
              order.order_number && order.order_number.toString() === orderNumber.toString()
            );
            
            if (foundOrder) {
              console.log('✅ Order found on second attempt');
              hideNotificationLoader();
              openOrderModal(foundOrder);
              setNotificationOrderId(null);
              setNotificationRestaurantId(null);
            } else {
              hideNotificationLoader();
              Alert.alert(
                'Order Not Found',
                'The order from notification could not be found.',
                [{ text: 'OK' }]
              );
            }
            notificationHandledRef.current = false;
          }, 1000);
        }, 500);
      }
      
    } catch (error) {
      console.error('❌ Error navigating to order:', error);
      hideNotificationLoader();
      Alert.alert(
        'Navigation Error',
        'Could not navigate to the order from notification.',
        [{ text: 'OK' }]
      );
      notificationHandledRef.current = false;
    }
  }, [restaurants, ordersData, selectedRestaurant, switchRestaurant, fetchOrdersForRestaurant]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log('App state changed from', appStateRef.current, 'to', nextAppState);
      appStateRef.current = nextAppState;
      
      if (nextAppState === 'background') {
        startBackgroundPolling();
      } else if (nextAppState === 'active') {
        if (backgroundPollingRef.current) {
          clearInterval(backgroundPollingRef.current);
          backgroundPollingRef.current = null;
        }
        
        if (selectedRestaurant && !pollingIntervalRef.current) {
          startPolling();
        }
        
        if (notificationDataRef.current && !notificationDataRef.current.processed) {
          handleNotificationData(notificationDataRef.current.data);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (backgroundPollingRef.current) {
        clearInterval(backgroundPollingRef.current);
      }
    };
  }, [selectedRestaurant, notificationDataRef.current]);

  const startBackgroundPolling = useCallback(() => {
    if (backgroundPollingRef.current) {
      clearInterval(backgroundPollingRef.current);
    }

    backgroundPollingRef.current = setInterval(async () => {
      console.log('Background polling check...');
      
      if (selectedRestaurant) {
        try {
          await fetchOrdersForRestaurant(selectedRestaurant.restaurant_id, true);
        } catch (error) {
          console.error('Background polling error:', error);
        }
      }
    }, 60000);
  }, [selectedRestaurant]);

  useEffect(() => {
    if (!selectedRestaurant) {
      setFilteredOrders([]);
      return;
    }

    const restaurantOrders = ordersData[selectedRestaurant.restaurant_id] || [];
    
    let result = restaurantOrders.filter(order => {
      if (selectedFilter !== 'all') {
        return order.status === selectedFilter;
      }
      
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          order.order_number.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.phoneNumber?.toLowerCase().includes(query) ||
          order.items.some(item => 
            item.name.toLowerCase().includes(query)
          )
        );
      }
      
      return true;
    });
    
    setFilteredOrders(result);
  }, [ordersData, selectedRestaurant, selectedFilter, searchQuery]);

  useEffect(() => {
    try {
      alarmSound.current = new Sound(
        'beep.wav',
        Sound.MAIN_BUNDLE,
        (error) => {
          if (error) {
            alarmSound.current = new Sound(
              "https://eatoorprod.s3.eu-north-1.amazonaws.com/uploads/beep.wav",
              (error) => {
                if (error) {
                  console.log('Failed to load fallback sound', error);
                }
              }
            );
          }
        }
      );
    } catch (error) {
      console.log('Sound initialization error:', error);
    }

    return () => {
      if (alarmSound.current) {
        alarmSound.current.release();
      }
      clearTimeout(timeoutRef.current);
      clearInterval(countdownRef.current);
      clearInterval(pollingIntervalRef.current);
      if (backgroundPollingRef.current) {
        clearInterval(backgroundPollingRef.current);
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        return parsedUser;
      }
      setUser(null);
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser(null);
      return null;
    }
  }, []);

  const fetchRestaurants = useCallback(async (userData = null) => {
    try {
      setLoading(true);
      setDataLoading(true);
      
      let currentUser = userData || user;
      
      if (!currentUser || !currentUser.id) {
        currentUser = await fetchUserData();
        if (!currentUser || !currentUser.id) {
          setLoading(false);
          setDataLoading(false);
          dataLoadedRef.current = true;
          return;
        }
      }

      const response = await getRestaurantList(currentUser.id);

      if (response && response.data && response.data.live_restaurants) {
        const restaurantList = response.data.live_restaurants.map(restaurant => ({
          ...restaurant,
          status: RESTAURANT_STATUS_MAPPING[restaurant.restaurant_status],
          ordersToday: 0,
          revenue: 0,
          pending: 0,
          preparing: 0,
          ready: 0,
          onTheWay: 0,
          delivered: 0,
        }));
        
        setRestaurants(restaurantList);
        
        let restaurantToSelect = null;
        
        if (notificationDataRef.current?.data?.restaurant_id || notificationRestaurantId) {
          const notificationRestaurantId = notificationDataRef.current?.data?.restaurant_id || notificationRestaurantId;
          const notificationRestaurant = restaurantList.find(
            r => r.restaurant_id && r.restaurant_id.toString() === notificationRestaurantId.toString()
          );
          
          if (notificationRestaurant) {
            console.log('✅ Selecting restaurant from notification');
            restaurantToSelect = notificationRestaurant;
          }
        }
        
        if (!restaurantToSelect && selectedRestaurant) {
          const existingRestaurant = restaurantList.find(
            r => r.restaurant_id && r.restaurant_id.toString() === selectedRestaurant.restaurant_id.toString()
          );
          
          if (existingRestaurant) {
            console.log('🔄 Selecting previously selected restaurant');
            restaurantToSelect = existingRestaurant;
          }
        }
        
        if (!restaurantToSelect && restaurantList.length > 0) {
          console.log('📌 Selecting first restaurant in list');
          restaurantToSelect = restaurantList[0];
        }
        
        if (restaurantToSelect) {
          setSelectedRestaurant(restaurantToSelect);
          lastRestaurantIdRef.current = restaurantToSelect.restaurant_id.toString();
          await fetchOrdersForRestaurant(restaurantToSelect.restaurant_id.toString());
        }
        
        setLoading(false);
        setDataLoading(false);
        dataLoadedRef.current = true;
        
      } else {
        setRestaurants([]);
        setLoading(false);
        setDataLoading(false);
        dataLoadedRef.current = true;
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      setLoading(false);
      setDataLoading(false);
      dataLoadedRef.current = true;
    }
  }, [user, notificationRestaurantId, selectedRestaurant]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    if (selectedRestaurant) {
      fetchOrdersForRestaurant(selectedRestaurant.restaurant_id);

      pollingIntervalRef.current = setInterval(() => {
        if (selectedRestaurant) {
          fetchOrdersForRestaurant(selectedRestaurant.restaurant_id, true);
        }
      }, 30000);
    }
  }, [selectedRestaurant, fetchOrdersForRestaurant]);

  const fetchOrdersForRestaurant = useCallback(async (restaurantId, isSilentFetch = false) => {
    try {
      if (!restaurantId) return;
      if (isPolling) return;
      
      setIsPolling(true);
      setOrdersLoading(true);
      
      console.log('📥 Fetching orders for restaurant:', restaurantId);
      const response = await getOrderDetails(restaurantId);
      
      if (response && response?.data?.orders) {
        const restaurantOrders = response?.data?.orders.map(order => mapApiOrderToAppFormat(order));
        
        const uniqueRestaurantOrders = [];
        const seenIds = new Set();
        
        restaurantOrders.forEach(order => {
          if (!seenIds.has(order.uniqueId)) {
            seenIds.add(order.uniqueId);
            uniqueRestaurantOrders.push(order);
          }
        });
        
        if (!isSilentFetch) {
          checkForNewOrders(restaurantId, uniqueRestaurantOrders);
        }
        
        setOrdersData(prev => {
          const existingOrders = prev[restaurantId] || [];
          const existingOrdersMap = new Map();
          
          existingOrders.forEach(order => {
            existingOrdersMap.set(order.uniqueId, order);
          });
          
          const updatedOrders = uniqueRestaurantOrders.map(newOrder => {
            const existingOrder = existingOrdersMap.get(newOrder.uniqueId);
            if (existingOrder) {
              return {
                ...newOrder,
                acceptedAt: existingOrder.acceptedAt || newOrder.acceptedAt,
                prepStartTime: existingOrder.prepStartTime || newOrder.prepStartTime,
                readyAt: existingOrder.readyAt || newOrder.readyAt,
                onWayAt: existingOrder.onWayAt || newOrder.onWayAt,
                deliveredAt: existingOrder.deliveredAt || newOrder.deliveredAt,
                cancelledAt: existingOrder.cancelledAt || newOrder.cancelledAt,
                refundedAt: existingOrder.refundedAt || newOrder.refundedAt,
              };
            }
            return newOrder;
          });
          
          return {
            ...prev,
            [restaurantId]: updatedOrders
          };
        });
        
        const active = uniqueRestaurantOrders.filter(order => 
          ['pending', 'confirmed', 'preparing'].includes(order.status)
        );
        setActiveOrders(active);
        setLastFetchedOrders(uniqueRestaurantOrders);
        setLastUpdated(new Date());
        
        updateStatsFromOrders(uniqueRestaurantOrders);
        
        if (notificationDataRef.current && !notificationDataRef.current.processed) {
          const notificationRestaurantId = notificationDataRef.current.data?.restaurant_id;
          const notificationOrderId = notificationDataRef.current.data?.order_number || notificationDataRef.current.data?.orderId;
          
          if (restaurantId.toString() === notificationRestaurantId?.toString()) {
            console.log('🔍 Checking for notification order in fetched orders');
            const notificationOrder = uniqueRestaurantOrders.find(order => 
              order.order_number && order.order_number.toString() === notificationOrderId?.toString()
            );
            
            if (notificationOrder) {
              console.log('✅ Found notification order in fetched orders');
              setTimeout(() => {
                openOrderModal(notificationOrder);
                notificationDataRef.current.processed = true;
                setNotificationOrderId(null);
                setNotificationRestaurantId(null);
              }, 500);
            }
          }
        }
        
      } else {
        console.log('📭 No orders found');
        setOrdersData(prev => ({
          ...prev,
          [restaurantId]: []
        }));
        setActiveOrders([]);
        setLastFetchedOrders([]);
        setLastUpdated(new Date());
        resetStats();
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsPolling(false);
      setOrdersLoading(false);
    }
  }, [isPolling, updateStatsFromOrders]);

  const checkForNewOrders = useCallback((restaurantId, newOrders) => {
    if (!selectedRestaurant || selectedRestaurant.restaurant_id !== restaurantId) return;
    
    const currentOrders = ordersData[restaurantId] || [];
    const newPendingOrders = newOrders.filter(newOrder => 
      newOrder.status === 'pending' && 
      !currentOrders.some(existingOrder => existingOrder.uniqueId === newOrder.uniqueId)
    );
    
    newPendingOrders.forEach(order => {
      const isAlreadyNotified = notificationQueueRef.current.some(notif => notif.uniqueId === order.uniqueId);
      if (!isAlreadyNotified && !hasNewOrder) {
        showNewOrderNotification(order);
      }
    });
  }, [selectedRestaurant, ordersData, hasNewOrder]);

  const showNewOrderNotification = useCallback((order) => {
    if (hasNewOrder) {
      setNotificationQueue(prev => [...prev, { 
        ...order, 
        timestamp: Date.now() 
      }]);
      return;
    }
    
    setHasNewOrder(true);
    setCurrentOrder(order);
    setTimeRemaining(ORDER_TIMEOUT);
    
    if (selectedRestaurant) {
      const restaurantId = selectedRestaurant.restaurant_id;
      setOrdersData(prev => {
        const existingOrders = prev[restaurantId] || [];
        const orderExists = existingOrders.some(ex => ex.uniqueId === order.uniqueId);
        
        if (orderExists) {
          return prev;
        }
        
        return {
          ...prev,
          [restaurantId]: [order, ...existingOrders]
        };
      });
      
      setStats(prev => ({
        ...prev,
        todayOrders: prev.todayOrders + 1,
        pending: prev.pending + 1,
      }));
    }
    
    showNotification(order);
    
    timeoutRef.current = setTimeout(() => {
      if (!order.status || order.status === 'pending') {
        autoCancelOrder(order.uniqueId);
      }
    }, ORDER_TIMEOUT * 1000);
  }, [selectedRestaurant, hasNewOrder]);

  const updateOrderStatusAPI = useCallback(async (order_number, newStatus) => {
    if (!order_number) {
      console.error('Order number is required to update status');
      return false;
    }

    try {
      setUpdatingStatus(true);
      
      const payload = {
        new_status: STATUS_TO_API_MAPPING[newStatus],
        order_number: order_number
      };

      console.log('Updating order status:', payload);

      const response = await updateOrderStatus(payload);

      if (response && response.status == 200) {
        console.log('Order status updated successfully');
        return true;
      } else {
        console.error('Failed to update order status:', response?.message);
        Alert.alert(
          'Update Failed',
          response?.message || 'Failed to update order status.',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert(
        'Update Error',
        'An error occurred while updating order status.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setUpdatingStatus(false);
    }
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        setInitialLoading(true);
        const userData = await fetchUserData();
        if (userData && userData.id) {
          await fetchRestaurants(userData);
          setInitialLoading(false);
        } else {
          setLoading(false);
          setInitialLoading(false);
          dataLoadedRef.current = true;
        }
        fetchAttempted.current = true;
      }
      
    };

    initializeData();
  }, []);

  useEffect(() => {
    if (!selectedRestaurant || isRestaurantChanging) return;

    if (lastRestaurantIdRef.current !== selectedRestaurant.restaurant_id) {
      lastRestaurantIdRef.current = selectedRestaurant.restaurant_id;
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      startPolling();
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [selectedRestaurant?.restaurant_id, startPolling, isRestaurantChanging]);

  useEffect(() => {
    if (!hasNewOrder && !showOrderModal && notificationQueue.length > 0) {
      const timer = setTimeout(() => {
        const nextNotification = notificationQueue[0];
        setNotificationQueue(prev => prev.slice(1));
        if (nextNotification) {
          showNewOrderNotification(nextNotification);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [hasNewOrder, showOrderModal, notificationQueue.length]);

  useEffect(() => {
    if (hasNewOrder && timeRemaining > 0) {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      
      countdownRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            if (currentOrder && !currentOrder.status) {
              autoCancelOrder(currentOrder.uniqueId);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [hasNewOrder, currentOrder]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startShakeAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: moderateScale(10),
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: moderateScale(-10),
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: moderateScale(10),
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 5 }
    ).start();
  };

  const playAlarm = () => {
    if (alarmSound.current) {
      try {
        alarmSound.current.setVolume(audioVolume);
        alarmSound.current.setNumberOfLoops(-1);
        alarmSound.current.play((success) => {
          if (!success) {
            console.log('Failed to play alarm');
          }
        });
        setIsAlarmPlaying(true);
      } catch (error) {
        console.log('Play alarm error:', error);
      }
    }
  };

  const stopAlarm = () => {
    if (alarmSound.current && isAlarmPlaying) {
      try {
        alarmSound.current.stop();
        setIsAlarmPlaying(false);
      } catch (error) {
        console.log('Stop alarm error:', error);
      }
    }
  };

  const showNotification = (newOrder) => {
    slideAnim.setValue(height);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 100,
      friction: 10,
      useNativeDriver: true,
    }).start();

    startPulseAnimation();
    
    if (newOrder.urgency === 'urgent') {
      startShakeAnimation();
    }

    playAlarm();
    Vibration.vibrate([300, 200, 300, 200, 300, 200, 300], false);
  };

  const autoCancelOrder = async (orderUniqueId) => {
    Alert.alert(
      '⏰ Order Timeout',
      'Order was automatically cancelled due to no response.',
      [{ text: 'OK' }]
    );

    if (selectedRestaurant) {
      const restaurantId = selectedRestaurant.restaurant_id;
      const orderToCancel = (ordersData[restaurantId] || []).find(order => order.uniqueId === orderUniqueId);
      
      if (orderToCancel) {
        const success = await updateOrderStatusAPI(orderToCancel.order_number, 'cancelled');
        
        if (success) {
          const updatedOrders = (ordersData[restaurantId] || []).map(order => 
            order.uniqueId === orderUniqueId 
              ? { 
                  ...order, 
                  status: 'cancelled', 
                  cancelledAt: new Date().toLocaleTimeString('en-IN'),
                  autoCancelled: true 
                }
              : order
          );

          setOrdersData(prev => ({
            ...prev,
            [restaurantId]: updatedOrders
          }));

          if (currentOrder?.uniqueId === orderUniqueId) {
            setCurrentOrder(prev => ({ 
              ...prev, 
              status: 'cancelled',
              cancelledAt: new Date().toLocaleTimeString('en-IN'),
              autoCancelled: true 
            }));
            setShowOrderModal(false);
          }
        }
      }
      
      stopAlarm();
      setHasNewOrder(false);
      clearInterval(countdownRef.current);
    }
  };

  const switchRestaurant = useCallback(async (restaurant) => {
    try {
      setIsRestaurantChanging(true);
      setDataLoading(true);
      
      console.log('🔄 Switching to restaurant:', restaurant.restaurant_id);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      
      if (isAlarmPlaying) {
        stopAlarm();
      }
      
      setHasNewOrder(false);
      setCurrentOrder(null);
      setNotificationQueue([]);
      
      storedRestaurantIdRef.current = restaurant.restaurant_id.toString();
      
      setSelectedRestaurant(restaurant);
      setShowRestaurantModal(false);
      setSelectedFilter('all');
      setSearchQuery('');
      
      resetStats();
      
      await fetchOrdersForRestaurant(restaurant.restaurant_id);
      
      startPolling();
      
      console.log('✅ Successfully switched to restaurant:', restaurant.restaurant_id);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error switching restaurant:', error);
      Alert.alert('Error', 'Failed to switch restaurant.');
      return false;
    } finally {
      setIsRestaurantChanging(false);
      setDataLoading(false);
    }
  }, [fetchOrdersForRestaurant, startPolling, isAlarmPlaying]);

  const mapApiOrderToAppFormat = (apiOrder) => {
    const status = ORDER_STATUS_MAPPING[apiOrder.status] || 'pending';
    const items = apiOrder.items || [];
    const totalAmount = parseFloat(apiOrder.total || 0);
    const orderDate = apiOrder.placed_on ? new Date(apiOrder.placed_on) : new Date();
    
    const order_number = apiOrder.order_number || `#${Math.floor(1000 + Math.random() * 9000)}`;
    const orderTime = formatTimeString(apiOrder.placed_on || apiOrder.order_time || new Date());
    
    const uniqueId = generateUniqueOrderId(order_number, orderTime, apiOrder.id || '');
    
    orderIdMapRef.current.set(order_number.toString(), uniqueId);
    
    return {
      uniqueId: uniqueId,
      id: uniqueId,
      order_number: order_number.toString(),
      customerName: apiOrder.full_name || apiOrder.customer_name || 'Customer',
      phoneNumber: apiOrder.phone_number || '',
      items: items.map((item, index) => ({
        id: `${uniqueId}-item-${index}`,
        name: item.item_name || item.name,
        quantity: item.quantity || 1,
        buy_one_get_one_free: item.buy_one_get_one_free || false,
        price: parseFloat(item.unit_price || item.price || 0),
      })),
      totalAmount: totalAmount,
      deliveryAddress: apiOrder.delivery_address || apiOrder.address || 'Address not provided',
      deliveryTime: '30-40 min',
      orderTime: orderTime,
      orderTimestamp: orderDate.getTime(),
      specialInstructions: apiOrder.special_instructions || '',
      paymentMethod: apiOrder.payment_method || 'Cash',
      paymentStatus: 'pending',
      status: status,
      urgency: 'normal',
      acceptedAt: status === 'confirmed' ? formatTimeString(apiOrder.accepted_at || orderDate) : null,
      prepStartTime: status === 'preparing' ? new Date() : null,
      readyAt: status === 'ready' ? formatTimeString(apiOrder.ready_at || orderDate) : null,
      onWayAt: status === 'on_the_way' ? formatTimeString(apiOrder.on_way_at || orderDate) : null,
      deliveredAt: status === 'delivered' ? formatTimeString(apiOrder.delivered_at || orderDate) : null,
      cancelledAt: status === 'cancelled' ? formatTimeString(apiOrder.cancelled_at || orderDate) : null,
      refundedAt: status === 'refunded' ? formatTimeString(apiOrder.refunded_at || orderDate) : null,
      apiData: apiOrder,
      createdAt: new Date().toISOString(),
    };
  };

  const formatTimeString = (dateInput) => {
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const updateStatsFromOrders = useCallback((orders) => {
    const todayOrders = orders.length;
    const revenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const pending = orders.filter(order => order.status === 'pending').length;
    const preparing = orders.filter(order => order.status === 'preparing').length;
    const ready = orders.filter(order => order.status === 'ready').length;
    const onTheWay = orders.filter(order => order.status === 'on_the_way').length;
    const delivered = orders.filter(order => order.status === 'delivered').length;
    
    setStats({
      todayOrders,
      revenue,
      avgTime: '22m',
      pending,
      preparing,
      ready,
      onTheWay,
      delivered,
    });
  }, []);

  const resetStats = useCallback(() => {
    setStats({
      todayOrders: 0,
      revenue: 0,
      avgTime: '0m',
      pending: 0,
      preparing: 0,
      ready: 0,
      onTheWay: 0,
      delivered: 0,
    });
  }, []);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    setDataLoading(true);
    
    try {
      console.log('🔄 Refreshing data...');
      
      const currentRestaurantId = selectedRestaurant?.restaurant_id;
      
      const userData = await fetchUserData();
      
      if (userData && userData.id) {
        await fetchRestaurants(userData);
        
        if (currentRestaurantId) {
          setTimeout(() => {
            const refreshedRestaurant = restaurants.find(r => 
              r.restaurant_id.toString() === currentRestaurantId.toString()
            );
            
            if (refreshedRestaurant && (!selectedRestaurant || selectedRestaurant.restaurant_id !== currentRestaurantId)) {
              console.log('🔄 Restoring previously selected restaurant after refresh');
              switchRestaurant(refreshedRestaurant);
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
      setDataLoading(false);
    }
  }, [selectedRestaurant, restaurants, fetchRestaurants, refreshing]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    const now = new Date();
    const diff = Math.floor((now - lastUpdated) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const openOrderModal = (order) => {
    console.log('📖 Opening order modal for:', order.order_number);
    setCurrentOrder(order);
    setShowOrderModal(true);
    
    if (order.status === 'pending' && hasNewOrder && currentOrder?.uniqueId === order.uniqueId) {
      stopAlarm();
      setHasNewOrder(false);
      clearInterval(countdownRef.current);
    }
  };

  const handleUpdateOrderStatus = async (newStatus) => {
    if (!currentOrder) return;
    
    if (newStatus === 'cancelled') {
      handleCancelOrder();
      return;
    }
    
    Alert.alert(
      'Update Order Status',
      `Are you sure you want to update order status to "${STATUS_DISPLAY_MAP[newStatus]}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Status',
          onPress: async () => {
            const success = await updateOrderStatusAPI(currentOrder.order_number, newStatus);
            
            if (success) {
              const updatedOrder = { 
                ...currentOrder, 
                status: newStatus,
                ...(newStatus === 'confirmed' && { acceptedAt: new Date().toLocaleTimeString('en-IN') }),
                ...(newStatus === 'preparing' && { prepStartTime: new Date() }),
                ...(newStatus === 'ready' && { readyAt: new Date().toLocaleTimeString('en-IN') }),
                ...(newStatus === 'on_the_way' && { onWayAt: new Date().toLocaleTimeString('en-IN') }),
                ...(newStatus === 'delivered' && { deliveredAt: new Date().toLocaleTimeString('en-IN') }),
              };
              
              setCurrentOrder(updatedOrder);
              
              if (selectedRestaurant) {
                const restaurantId = selectedRestaurant.restaurant_id;
                const updatedOrders = (ordersData[restaurantId] || []).map(order => 
                  order.uniqueId === currentOrder.uniqueId ? updatedOrder : order
                );
                
                setOrdersData(prev => ({
                  ...prev,
                  [restaurantId]: updatedOrders
                }));
                
                setStats(prev => {
                  const newStats = { ...prev };
                  
                  if (currentOrder.status === 'pending') newStats.pending = Math.max(0, prev.pending - 1);
                  if (currentOrder.status === 'preparing') newStats.preparing = Math.max(0, prev.preparing - 1);
                  if (currentOrder.status === 'ready') newStats.ready = Math.max(0, prev.ready - 1);
                  if (currentOrder.status === 'on_the_way') newStats.onTheWay = Math.max(0, prev.onTheWay - 1);
                  
                  if (newStatus === 'preparing') newStats.preparing = (prev.preparing || 0) + 1;
                  if (newStatus === 'ready') newStats.ready = (prev.ready || 0) + 1;
                  if (newStatus === 'on_the_way') newStats.onTheWay = (prev.onTheWay || 0) + 1;
                  if (newStatus === 'delivered') newStats.delivered = (prev.delivered || 0) + 1;
                  
                  return newStats;
                });
              }
              
              if (currentOrder.status === 'pending' && hasNewOrder) {
                setHasNewOrder(false);
                stopAlarm();
                clearTimeout(timeoutRef.current);
                clearInterval(countdownRef.current);
              }
            }
          },
        },
      ]
    );
  };

  const handleCancelOrder = () => {
    if (!userPermissions.canCancelOrders) {
      Alert.alert(
        'Permission Denied',
        'You do not have permission to cancel orders.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            const success = await updateOrderStatusAPI(currentOrder.order_number, 'cancelled');
            
            if (success) {
              const updatedOrder = { 
                ...currentOrder, 
                status: 'cancelled',
                cancelledAt: new Date().toLocaleTimeString('en-IN')
              };
              
              setCurrentOrder(updatedOrder);
              
              if (selectedRestaurant) {
                const restaurantId = selectedRestaurant.restaurant_id;
                const updatedOrders = (ordersData[restaurantId] || []).map(order => 
                  order.uniqueId === currentOrder.uniqueId ? updatedOrder : order
                );
                
                setOrdersData(prev => ({
                  ...prev,
                  [restaurantId]: updatedOrders
                }));
                
                setStats(prev => {
                  const newStats = { ...prev };
                  
                  if (currentOrder.status === 'pending') newStats.pending = Math.max(0, prev.pending - 1);
                  if (currentOrder.status === 'preparing') newStats.preparing = Math.max(0, prev.preparing - 1);
                  if (currentOrder.status === 'ready') newStats.ready = Math.max(0, prev.ready - 1);
                  if (currentOrder.status === 'on_the_way') newStats.onTheWay = Math.max(0, prev.onTheWay - 1);
                  
                  return newStats;
                });
              }
              
              if (currentOrder.status === 'pending' && hasNewOrder) {
                setHasNewOrder(false);
                stopAlarm();
                clearTimeout(timeoutRef.current);
                clearInterval(countdownRef.current);
              }
              
              Alert.alert('Cancelled', 'Order has been cancelled.');
            }
          },
        },
      ]
    );
  };

  const getNextStatus = () => {
    if (!currentOrder || !currentOrder.status) return null;
    
    const currentStatus = currentOrder.status;
    
    if (['delivered', 'cancelled', 'refunded'].includes(currentStatus)) {
      return null;
    }
    
    const nextStatus = NEXT_STATUS_MAPPING[currentStatus];
    
    if (nextStatus && userPermissions.canUpdateTo(currentStatus, nextStatus)) {
      return nextStatus;
    }
    
    return null;
  };

  const getStatusButtonConfig = () => {
    if (!currentOrder) return null;
    
    const currentStatus = currentOrder.status;
    const nextStatus = getNextStatus();
    
    if (!nextStatus) {
      return null;
    }
    
    return {
      text: STATUS_BUTTON_TEXT[nextStatus],
      color: STATUS_BUTTON_COLORS[nextStatus],
      nextStatus: nextStatus
    };
  };

  const getCuisineString = (cuisines) => {
    if (!cuisines || !Array.isArray(cuisines)) return '';
    return cuisines
      .map(c => c.cuisine_name)
      .filter(name => name && name.trim() !== '')
      .slice(0, 2)
      .join(', ');
  };

  const getLocationString = (location) => {
    if (!location) return '';
    const area = location.area_sector_locality || '';
    const city = location.city || '';
    return area ? `${area}, ${city}` : city;
  };

  const handleSearchFocus = () => {
    setShowSearch(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleSearchCancel = () => {
    setSearchQuery('');
    setShowSearch(false);
    Keyboard.dismiss();
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleAcceptOrder = async () => {
    Alert.alert(
      '✅ Confirm Order',
      'Are you sure you want to confirm this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Order',
          onPress: async () => {
            const success = await updateOrderStatusAPI(currentOrder.order_number, 'confirmed');
            
            if (success) {
              const updatedOrder = { 
                ...currentOrder, 
                status: 'confirmed',
                acceptedAt: new Date().toLocaleTimeString('en-IN'),
                prepStartTime: new Date()
              };
              
              setCurrentOrder(updatedOrder);
              
              if (selectedRestaurant) {
                const restaurantId = selectedRestaurant.restaurant_id;
                const updatedOrders = (ordersData[restaurantId] || []).map(order => 
                  order.uniqueId === currentOrder.uniqueId ? updatedOrder : order
                );
                
                setOrdersData(prev => ({
                  ...prev,
                  [restaurantId]: updatedOrders
                }));
                
                setHasNewOrder(false);
                stopAlarm();
                clearTimeout(timeoutRef.current);
                clearInterval(countdownRef.current);
                
                setStats(prev => ({
                  ...prev,
                  pending: Math.max(0, prev.pending - 1),
                  confirmed: (prev.confirmed || 0) + 1,
                }));
              }
            }
          },
        },
      ]
    );
  };

  const toggleRestaurantStatus = async () => {
    if (!selectedRestaurant || updatingRestaurantStatus) return;

    try {
      setUpdatingRestaurantStatus(true);
      const newStatus =
      selectedRestaurant.status === 'online' ? 'offline' : 'online';

      const response = await updateRestaurantStatus(
        selectedRestaurant.restaurant_id,
        {
          status: RESTAURANT_STATUS_API_MAPPING[newStatus],
        }
      );

      if (response && response.status === 200) {
        setSelectedRestaurant(prev => ({
          ...prev,
          status: newStatus
        }));
        
        setRestaurants(prev => prev.map(rest => 
          rest.restaurant_id === selectedRestaurant.restaurant_id 
            ? { ...rest, status: newStatus }
            : rest
        ));
      }
    } catch (error) {
      console.error('Error updating restaurant status:', error);
      Alert.alert('Error', 'Failed to update restaurant status');
    } finally {
      setUpdatingRestaurantStatus(false);
    }
  };

  // Initial loading screen
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fullscreenLoader}>
          <Animated.View style={styles.loadingLogoContainer}>
            <Icon name="restaurant" size={scaleSize(60)} color="#F07119" />
            <View style={styles.loadingPulse} />
          </Animated.View>
          <Text style={styles.loadingTitle}>Eatoor Partner</Text>
          <Text style={styles.loadingSubtitle}>Loading your restaurants...</Text>
          <ActivityIndicator size="large" color="#F07119" style={styles.loadingSpinner} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !user.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Icon name="person-circle-outline" size={scaleSize(60)} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Authentication Required</Text>
          <Text style={styles.emptyText}>
            Please login to access partner features.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Icon name="refresh" size={scaleSize(16)} color="#fff" />
            <Text style={styles.retryButtonText}>Login & Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F07119']}
              tintColor="#F07119"
            />
          }
        >
          <View style={styles.emptyContainer}>
            <Icon name="restaurant-outline" size={scaleSize(60)} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Restaurants Found</Text>
            <Text style={styles.emptyText}>
              You don't have any restaurants setup yet.
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={onRefresh}
            >
              <Icon name="refresh" size={scaleSize(16)} color="#fff" />
              <Text style={styles.retryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Data Loading Overlay */}
      {dataLoading && (
        <View style={styles.dataLoadingOverlay}>
            <ActivityIndicator size="large" color="#F07119" />
            <Text style={styles.dataLoadingText}>Loading data...</Text>
        </View>
      )}
      
      {/* Orders Loading Overlay */}
      {ordersLoading && selectedRestaurant && (
        <View style={styles.ordersLoadingOverlay}>
          <View style={styles.ordersLoadingContainer}>
            <ActivityIndicator size="small" color="#F07119" />
            <Text style={styles.ordersLoadingText}>Updating orders...</Text>
          </View>
        </View>
      )}
      
      {/* Notification Loader Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={notificationLoading}
        onRequestClose={() => hideNotificationLoader()}
        statusBarTranslucent={true}
      >
        <View style={styles.loaderModalOverlay}>
          <View style={styles.loaderModalContainer}>
            <ActivityIndicator size="large" color="#F07119" />
            <Text style={styles.loaderModalText}>{notificationMessage}</Text>
            <Text style={styles.loaderModalSubtext}>Please wait...</Text>
          </View>
        </View>
      </Modal>
      
      {/* Animated Notification Banner */}
      {hasNewOrder && currentOrder && (
        <Animated.View 
          style={[
            styles.notificationBanner,
            { 
              transform: [
                { translateY: slideAnim },
                { scale: pulseAnim },
                { translateX: shakeAnim }
              ]
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.bannerContent}
            onPress={() => {
              openOrderModal(currentOrder);
              slideAnim.setValue(0);
            }}
            activeOpacity={0.9}
          >
            <Animated.View 
              style={[
                styles.bannerIcon,
                {
                  transform: [{ scale: pulseAnim }]
                }
              ]}
            >
              <Icon name="notifications" size={scaleSize(20)} color="#fff" />
              <View style={styles.notificationBadge}>
                <Icon name="flash" size={scaleSize(6)} color="#fff" />
              </View>
            </Animated.View>
            
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>🛵 New Order Received!</Text>
              <Text style={styles.bannerSubtitle} numberOfLines={1}>
                {currentOrder.order_number} • {currentOrder.customerName}
              </Text>
              <View style={styles.timerBadge}>
                <Icon name="time-outline" size={scaleSize(10)} color="#fff" />
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              </View>
            </View>
            
            <Icon name="chevron-forward" size={scaleSize(18)} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Fixed Header Container */}
      <View style={styles.headerWrapper}>
        {/* Modern Header */}
        <View style={styles.headerContainer}>
          {/* Top Row: Back Button + Restaurant Selector + Refresh */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={scaleSize(24)} color="#111827" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.restaurantSelector}
              onPress={() => setShowRestaurantModal(true)}
              activeOpacity={0.7}
              disabled={isRestaurantChanging || dataLoading}
            >
              <View style={styles.restaurantSelectorContent}>
                <View style={styles.restaurantSelectorLeft}>
                  {selectedRestaurant ? (
                    <>
                      <View style={styles.restaurantAvatar}>
                        <Image
                          source={{ uri: selectedRestaurant.profile_image }}
                          style={styles.restaurantAvatarImage}
                          defaultSource={{ uri: 'https://via.placeholder.com/40' }}
                        />
                        <View style={[
                          styles.restaurantStatusIndicator,
                          { backgroundColor: RESTAURANT_STATUS_COLORS[selectedRestaurant.status] }
                        ]} />
                      </View>
                      <View style={styles.restaurantInfoContainer}>
                        <Text style={styles.restaurantName} numberOfLines={1}>
                          {selectedRestaurant.restaurant_name}
                        </Text>
                        <Text style={styles.restaurantDetails} numberOfLines={1}>
                          {getCuisineString(selectedRestaurant.cuisines)} • {getLocationString(selectedRestaurant.location)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noRestaurantText}>Select a restaurant</Text>
                  )}
                </View>
                {isRestaurantChanging || dataLoading ? (
                  <ActivityIndicator size="small" color="#F07119" />
                ) : (
                  <Icon name="chevron-down" size={scaleSize(18)} color="#6B7280" />
                )}
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={() => onRefresh()}
              disabled={refreshing || !selectedRestaurant || updatingStatus || isRestaurantChanging || dataLoading}
            >
              {refreshing || dataLoading ? (
                <ActivityIndicator size="small" color="#F07119" />
              ) : (
                <Icon 
                  name="refresh" 
                  size={scaleSize(22)} 
                  color={refreshing || !selectedRestaurant || updatingStatus || isRestaurantChanging || dataLoading ? "#9CA3AF" : "#F07119"} 
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Bottom Row: Restaurant Status + Search */}
          <View style={styles.headerBottomRow}>
            {/* Restaurant Status Button */}
            {selectedRestaurant && userPermissions.canManageRestaurant && (
              <TouchableOpacity 
                style={[
                  styles.statusButton,
                  { 
                    backgroundColor: selectedRestaurant.status === 'online' ? '#ECFDF5' : '#FEF2F2',
                    borderColor: selectedRestaurant.status === 'online' ? '#10B981' : '#EF4444'
                  }
                ]}
                onPress={() => toggleRestaurantStatus()}
                disabled={updatingRestaurantStatus || isRestaurantChanging || dataLoading}
              >
                {updatingRestaurantStatus ? (
                  <ActivityIndicator size="small" color={RESTAURANT_STATUS_COLORS[selectedRestaurant.status]} />
                ) : (
                  <>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: RESTAURANT_STATUS_COLORS[selectedRestaurant.status] }
                    ]} />
                    <Text style={[
                      styles.statusButtonText,
                      { color: RESTAURANT_STATUS_COLORS[selectedRestaurant.status] }
                    ]}>
                      {RESTAURANT_STATUS_DISPLAY[selectedRestaurant.status]}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            {/* Search Button/Input */}
            {!showSearch ? (
              <TouchableOpacity 
                style={styles.searchButton}
                onPress={handleSearchFocus}
                disabled={!selectedRestaurant || updatingStatus || isRestaurantChanging || dataLoading}
              >
                <Icon 
                  name="search" 
                  size={scaleSize(22)} 
                  color={!selectedRestaurant || updatingStatus || isRestaurantChanging || dataLoading ? "#9CA3AF" : "#F07119"} 
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Icon name="search" size={scaleSize(18)} color="#9CA3AF" style={styles.searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder="Search orders..."
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus={true}
                    returnKeyType="search"
                    enablesReturnKeyAutomatically={true}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={handleSearchClear} style={styles.clearButton}>
                      <Icon name="close-circle" size={scaleSize(18)} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={handleSearchCancel} 
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Search Results Info */}
      {searchQuery.trim() !== '' && (
        <View style={styles.searchResultsInfo}>
          <Text style={styles.searchResultsText} numberOfLines={1}>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found for "{searchQuery}"
          </Text>
          <TouchableOpacity onPress={handleSearchClear}>
            <Text style={styles.clearSearchText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardAvoidView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scaleSize(100) : scaleSize(20)}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: Platform.OS === 'ios' ? scaleSize(100) : scaleSize(20) }
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F07119']}
              tintColor="#F07119"
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Modern Stats Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
                  <Icon name="cart-outline" size={scaleSize(18)} color="#D97706" />
                </View>
                <Text style={styles.statValue}>{stats.todayOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>
              
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#DBEAFE' }]}>
                  <Icon name="cash-outline" size={scaleSize(18)} color="#1D4ED8" />
                </View>
                {userPermissions.canSeeRevenue ? (
                  <>
                    <Text style={styles.statValue}>
                      ₹{Math.round(stats.revenue || 0).toLocaleString('en-IN')}
                    </Text>
                    <Text style={styles.statLabel}>Revenue</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.statValue}>-</Text>
                    <Text style={styles.statLabel}>Revenue</Text>
                  </>
                )}
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#D1FAE5' }]}>
                  <Icon name="time-outline" size={scaleSize(18)} color="#059669" />
                </View>
                <Text style={styles.statValue}>{stats.avgTime}</Text>
                <Text style={styles.statLabel}>Avg. Time</Text>
              </View>
              
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#E0E7FF' }]}>
                  <Icon name="timer-outline" size={scaleSize(18)} color="#4F46E5" />
                </View>
                <Text style={styles.statValue}>{activeOrders.length}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
            </View>
            
            {/* Status Breakdown Bar */}
            <View style={styles.statusBreakdown}>
              <View style={styles.statusBreakdownItem}>
                <View style={[styles.statusDotSmall, { backgroundColor: STATUS_COLORS.pending }]} />
                <Text style={styles.statusCount}>{stats.pending}</Text>
                <Text style={styles.statusLabel}>Pending</Text>
              </View>
              <View style={styles.statusBreakdownItem}>
                <View style={[styles.statusDotSmall, { backgroundColor: STATUS_COLORS.preparing }]} />
                <Text style={styles.statusCount}>{stats.preparing}</Text>
                <Text style={styles.statusLabel}>Preparing</Text>
              </View>
              <View style={styles.statusBreakdownItem}>
                <View style={[styles.statusDotSmall, { backgroundColor: STATUS_COLORS.ready }]} />
                <Text style={styles.statusCount}>{stats.ready}</Text>
                <Text style={styles.statusLabel}>Ready</Text>
              </View>
              <View style={styles.statusBreakdownItem}>
                <View style={[styles.statusDotSmall, { backgroundColor: STATUS_COLORS.on_the_way }]} />
                <Text style={styles.statusCount}>{stats.onTheWay}</Text>
                <Text style={styles.statusLabel}>On the Way</Text>
              </View>
            </View>
            
            {/* Last Updated */}
            <View style={styles.lastUpdatedContainer}>
              <Icon name="time-outline" size={scaleSize(12)} color="rgba(107, 114, 128, 0.7)" />
              <Text style={styles.lastUpdatedText}>
                Updated {formatLastUpdated()}
              </Text>
            </View>
          </View>

          {/* Modern Filter Chips */}
          <View style={styles.filterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContainer}
            >
              {FILTER_OPTIONS.map(({ id, label, icon }) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.filterButton,
                    selectedFilter === id && styles.filterButtonActive,
                  ]}
                  onPress={() => setSelectedFilter(id)}
                  disabled={dataLoading || ordersLoading}
                >
                  <Icon 
                    name={icon} 
                    size={scaleSize(14)} 
                    color={selectedFilter === id ? '#fff' : '#6B7280'} 
                  />
                  <Text style={[
                    styles.filterButtonText,
                    selectedFilter === id && styles.filterButtonTextActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Orders Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {selectedFilter === 'all' ? 'All Orders' : 
                   FILTER_OPTIONS.find(f => f.id === selectedFilter)?.label || 'Orders'}
                  {searchQuery.trim() !== '' && ' (Filtered)'}
                </Text>
                {selectedRestaurant && (
                  <Text style={styles.sectionSubtitle}>
                    {selectedRestaurant.restaurant_name} • {filteredOrders.length} orders
                  </Text>
                )}
              </View>
              <View style={styles.sectionCountBadge}>
                <Text style={styles.sectionCount}>{filteredOrders.length}</Text>
              </View>
            </View>
            
            {filteredOrders.length > 0 ? (
              <FlatList
                data={filteredOrders}
                renderItem={({ item }) => {
                  const statusColor = STATUS_COLORS[item.status] || '#6B7280';
                  
                  return (
                    <TouchableOpacity 
                      style={[
                        styles.orderCard,
                        { borderLeftColor: statusColor }
                      ]}
                      onPress={() => openOrderModal(item)}
                      activeOpacity={0.7}
                      disabled={dataLoading || ordersLoading}
                    >
                      <View style={styles.orderCardHeader}>
                        <View style={styles.orderCardHeaderLeft}>
                          <Text style={styles.order_number}>{item.order_number}</Text>
                          <Text style={styles.orderTime} numberOfLines={1}>
                            {item.orderTime} • {item.customerName}
                          </Text>
                        </View>
                        
                        <View style={[
                          styles.orderStatusBadge,
                          { backgroundColor: `${statusColor}15` }
                        ]}>
                          <View style={[
                            styles.orderStatusDot,
                            { backgroundColor: statusColor }
                          ]} />
                          <Text style={[
                            styles.orderStatusText,
                            { color: statusColor }
                          ]}>
                            {STATUS_DISPLAY_MAP[item.status] || item.status}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.orderItemsPreview}>
                        {item.items.slice(0, 2).map((orderItem) => (
                          <Text key={orderItem.id} style={styles.orderItemPreview} numberOfLines={1}>
                            {orderItem.quantity}x {orderItem.name}
                          </Text>
                        ))}
                        {item.items.length > 2 && (
                          <Text style={styles.moreItems}>+{item.items.length - 2} more</Text>
                        )}
                      </View>
                      
                      <View style={styles.orderFooter}>
                        {userPermissions.canSeeRevenue && (
                          <Text style={styles.orderAmount}>₹{item.totalAmount}</Text>
                        )}
                        <Text style={styles.deliveryTime}>{item.deliveryTime}</Text>
                      </View>
                      
                      {item.urgency === 'urgent' && (
                        <View style={styles.urgentBadge}>
                          <Icon name="flash" size={scaleSize(8)} color="#fff" />
                          <Text style={styles.urgentText}>URGENT</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
                keyExtractor={(item) => item.uniqueId}
                scrollEnabled={false}
                contentContainerStyle={styles.ordersList}
                extraData={[selectedFilter, filteredOrders.length]}
              />
            ) : (
              <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.emptyState}>
                  {(dataLoading || ordersLoading) ? (
                    <>
                      <ActivityIndicator size="large" color="#F07119" style={styles.emptyStateLoader} />
                      <Text style={styles.emptyStateTitle}>
                        {dataLoading ? 'Loading data...' : 'Updating orders...'}
                      </Text>
                      <Text style={styles.emptyStateText}>
                        Please wait while we fetch the latest information
                      </Text>
                    </>
                  ) : (
                    <>
                      <Icon 
                        name={!selectedRestaurant || selectedRestaurant.status === 'offline' ? 'power-outline' : 
                               searchQuery.trim() !== '' ? 'search-outline' : 'fast-food-outline'} 
                        size={scaleSize(50)} 
                        color="#D1D5DB" 
                      />
                      <Text style={styles.emptyStateTitle}>
                        {searchQuery.trim() !== '' ? 'No Search Results' :
                         !selectedRestaurant || selectedRestaurant.status === 'offline' ? 'Restaurant Offline' : 'No Orders Found'}
                      </Text>
                      <Text style={styles.emptyStateText}>
                        {searchQuery.trim() !== '' ? `No orders found for "${searchQuery}"` :
                         !selectedRestaurant ? 'Please select a restaurant' :
                         selectedRestaurant.status === 'offline' 
                          ? 'Go online to start accepting orders' 
                          : selectedFilter === 'pending' ? 'No pending orders at the moment' :
                          selectedFilter === 'preparing' ? 'No orders in preparation' :
                          selectedFilter === 'ready' ? 'No orders ready for pickup' :
                          selectedFilter === 'on_the_way' ? 'No orders on the way' :
                          selectedFilter === 'delivered' ? 'No delivered orders yet' :
                          selectedFilter === 'cancelled' ? 'No cancelled orders' :
                          selectedFilter === 'refunded' ? 'No refunded orders' :
                          'No orders found for the selected filter'}
                      </Text>
                      {searchQuery.trim() !== '' && (
                        <TouchableOpacity 
                          style={[styles.simulateSmallButton, { backgroundColor: '#6B7280' }]}
                          onPress={handleSearchClear}
                        >
                          <Icon name="close-circle" size={scaleSize(16)} color="#fff" />
                          <Text style={styles.simulateSmallButtonText}>Clear Search</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Restaurant Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showRestaurantModal}
        onRequestClose={() => setShowRestaurantModal(false)}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={() => setShowRestaurantModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.restaurantModalContainer}>
                <View style={styles.restaurantModalHeader}>
                  <Text style={styles.restaurantModalTitle}>Select Restaurant</Text>
                  <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={() => setShowRestaurantModal(false)}
                  >
                    <Icon name="close" size={scaleSize(20)} color="#374151" />
                  </TouchableOpacity>
                </View>
                
                <FlatList
                  data={restaurants}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.restaurantItem,
                        selectedRestaurant?.restaurant_id === item.restaurant_id && styles.restaurantItemSelected,
                      ]}
                      onPress={() => switchRestaurant(item)}
                      disabled={isRestaurantChanging || dataLoading}
                    >
                      <Image
                        source={{ uri: item.profile_image }}
                        style={styles.restaurantImage}
                        defaultSource={{ uri: 'https://via.placeholder.com/60' }}
                      />
                      <View style={styles.restaurantInfo}>
                        <Text style={styles.restaurantItemName} numberOfLines={1}>
                          {item.restaurant_name}
                        </Text>
                        <Text style={styles.restaurantItemCuisine} numberOfLines={1}>
                          {getCuisineString(item.cuisines)}
                        </Text>
                        <Text style={styles.restaurantItemLocation} numberOfLines={1}>
                          {getLocationString(item.location)}
                        </Text>
                        <View style={styles.restaurantItemStats}>
                          <View style={styles.restaurantStat}>
                            <Icon name="cart-outline" size={scaleSize(10)} color="#6B7280" />
                            <Text style={styles.restaurantStatText}>{item.ordersToday || 0} orders</Text>
                          </View>
                          {userPermissions.canSeeRevenue && (
                            <View style={styles.restaurantStat}>
                              <Icon name="cash-outline" size={scaleSize(10)} color="#6B7280" />
                              <Text style={styles.restaurantStatText}>₹{item.revenue || 0}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.restaurantItemRight}>
                        <View style={[
                          styles.restaurantStatusBadge,
                          { backgroundColor: `${RESTAURANT_STATUS_COLORS[item.status]}15` }
                        ]}>
                          <View style={[
                            styles.restaurantStatusDot,
                            { backgroundColor: RESTAURANT_STATUS_COLORS[item.status] }
                          ]} />
                          <Text style={[
                            styles.restaurantStatusText,
                            { color: RESTAURANT_STATUS_COLORS[item.status] }
                          ]}>
                            {RESTAURANT_STATUS_DISPLAY[item.status]}
                          </Text>
                        </View>
                        {isRestaurantChanging && selectedRestaurant?.restaurant_id === item.restaurant_id ? (
                          <ActivityIndicator size="small" color="#F07119" />
                        ) : (
                          <Icon 
                            name="chevron-forward" 
                            size={scaleSize(16)} 
                            color={selectedRestaurant?.restaurant_id === item.restaurant_id ? '#F07119' : '#9CA3AF'} 
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.restaurant_id.toString()}
                  contentContainerStyle={styles.restaurantList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.modalEmptyState}>
                      <Icon name="restaurant-outline" size={scaleSize(40)} color="#9CA3AF" />
                      <Text style={styles.modalEmptyText}>No restaurants available</Text>
                    </View>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Order Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOrderModal}
        onRequestClose={() => {
          stopAlarm();
          setShowOrderModal(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={[
              styles.modalHeader,
              currentOrder?.urgency === 'urgent' && styles.modalHeaderUrgent
            ]}>
              <View style={styles.modalHeaderContent}>
                <View>
                  <Text style={styles.modalTitle}>Order Details</Text>
                  {currentOrder?.status === 'pending' && hasNewOrder && (
                    <Text style={styles.modalSubtitle}>
                      ⏰ Accept in: {formatTime(timeRemaining)}
                    </Text>
                  )}
                  {updatingStatus && (
                    <Text style={[styles.modalSubtitle, { color: '#F07119' }]}>
                      Updating status...
                    </Text>
                  )}
                </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => {
                    stopAlarm();
                    setShowOrderModal(false);
                  }}
                  disabled={updatingStatus}
                >
                  <Icon name="close" size={scaleSize(20)} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {isAlarmPlaying && (
                <View style={styles.alarmControl}>
                  <Icon name="volume-high" size={scaleSize(18)} color="#F07119" />
                  <Slider
                    style={styles.volumeSlider}
                    minimumValue={0.1}
                    maximumValue={1}
                    value={audioVolume}
                    onValueChange={(value) => {
                      setAudioVolume(value);
                      if (alarmSound.current) {
                        alarmSound.current.setVolume(value);
                      }
                    }}
                    minimumTrackTintColor="#F07119"
                    maximumTrackTintColor="#E5E7EB"
                    thumbTintColor="#F07119"
                  />
                  <TouchableOpacity onPress={stopAlarm} style={styles.muteButton}>
                    <Icon name="volume-mute" size={scaleSize(18)} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Order Status Card */}
              <View style={styles.orderStatusCard}>
                <View style={[
                  styles.orderStatusHeader,
                  { backgroundColor: `${STATUS_COLORS[currentOrder?.status]}15` }
                ]}>
                  <View style={[
                    styles.orderStatusIcon,
                    { backgroundColor: STATUS_COLORS[currentOrder?.status] }
                  ]}>
                    <Icon 
                      name={
                        currentOrder?.status === 'pending' ? 'time-outline' :
                        currentOrder?.status === 'confirmed' ? 'checkmark-circle' :
                        currentOrder?.status === 'preparing' ? 'fast-food' :
                        currentOrder?.status === 'ready' ? 'cube' :
                        currentOrder?.status === 'on_the_way' ? 'car' :
                        currentOrder?.status === 'delivered' ? 'checkmark-done' :
                        currentOrder?.status === 'cancelled' ? 'close-circle' :
                        'arrow-undo'
                      } 
                      size={scaleSize(18)} 
                      color="#fff" 
                    />
                  </View>
                  <View style={styles.orderStatusInfo}>
                    <Text style={styles.orderStatusText}>
                      {STATUS_DISPLAY_MAP[currentOrder?.status] || 'Unknown Status'}
                    </Text>
                    <Text style={styles.orderStatusSubtext}>
                      {currentOrder?.order_number} • {currentOrder?.orderTime}
                    </Text>
                  </View>
                  {userPermissions.canSeeRevenue && (
                    <Text style={[
                      styles.orderAmountLarge,
                      { color: STATUS_COLORS[currentOrder?.status] }
                    ]}>
                      ₹{currentOrder?.totalAmount}
                    </Text>
                  )}
                </View>
                
                {/* Status Timeline */}
                <View style={styles.statusTimeline}>
                  {['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered'].map((status, index) => {
                    const isActive = ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered']
                      .indexOf(currentOrder?.status) >= index;
                    const isCurrent = currentOrder?.status === status;
                    
                    return (
                      <View key={`${status}-${index}`} style={styles.timelineItem}>
                        <View style={[
                          styles.timelineDot,
                          isActive && { backgroundColor: STATUS_COLORS[status] },
                          isCurrent && styles.timelineDotActive
                        ]}>
                          {isActive && (
                            <Icon 
                              name="checkmark" 
                              size={scaleSize(8)} 
                              color="#fff" 
                            />
                          )}
                        </View>
                        <Text style={[
                          styles.timelineLabel,
                          isActive && styles.timelineLabelActive
                        ]}>
                          {STATUS_DISPLAY_MAP[status]}
                        </Text>
                        {index < 5 && (
                          <View style={[
                            styles.timelineLine,
                            isActive && { backgroundColor: STATUS_COLORS[status] }
                          ]} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Customer Details */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Customer Details</Text>
                <View style={styles.detailCard}>
                  <View style={styles.detailRow}>
                    <Icon name="person-outline" size={scaleSize(14)} color="#6B7280" />
                    <Text style={styles.detailText}>{currentOrder?.customerName}</Text>
                  </View>
                  {!isLimitedUser && currentOrder?.phoneNumber && (
                    <View style={styles.detailRow}>
                      <Icon name="call-outline" size={scaleSize(14)} color="#6B7280" />
                      <Text style={styles.detailText}>{currentOrder.phoneNumber}</Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Icon name="location-outline" size={scaleSize(14)} color="#6B7280" />
                    <Text style={styles.detailText} numberOfLines={2}>{currentOrder?.deliveryAddress}</Text>
                  </View>
                </View>
              </View>

              {/* Order Items */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Order Items</Text>
                <View style={styles.detailCard}>
                  <FlatList
                    data={currentOrder?.items || []}
                    renderItem={({ item }) => (
                      <View style={styles.orderItem}>
                        <View style={styles.orderItemLeft}>
                          <View style={styles.quantityBadge}>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                          </View>

                          <Text style={styles.orderItemName} numberOfLines={2}>
                            {item.name}
                            {item.buy_one_get_one_free && (
                              <Text style={styles.bogoText}>  (B1G1)</Text>
                            )}
                          </Text>
                        </View>

                        {userPermissions.canSeeRevenue && (
                          <Text style={styles.orderItemPrice}>₹{item.price}</Text>
                        )}
                      </View>
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                  
                  {userPermissions.canSeeRevenue && (
                    <View style={styles.orderTotal}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>
                          ₹{Math.round(currentOrder?.totalAmount * 0.95)}
                        </Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Delivery</Text>
                        <Text style={styles.totalValue}>₹40</Text>
                      </View>
                      <View style={[styles.totalRow, styles.grandTotalRow]}>
                        <Text style={styles.grandTotalLabel}>Total</Text>
                        <Text style={styles.grandTotalValue}>
                          ₹{currentOrder?.totalAmount}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Special Instructions */}
              {currentOrder?.specialInstructions && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Special Instructions</Text>
                  <View style={[styles.detailCard, styles.instructionsCard]}>
                    <Icon name="document-text-outline" size={scaleSize(16)} color="#F59E0B" />
                    <Text style={styles.instructionsText}>
                      {currentOrder?.specialInstructions}
                    </Text>
                  </View>
                </View>
              )}

              {/* Timestamps */}
              <View style={styles.timestampsSection}>
                <Text style={styles.timestampsTitle}>Order Timeline</Text>
                {currentOrder?.acceptedAt && (
                  <View style={styles.timestampRow}>
                    <Icon name="checkmark-circle" size={scaleSize(12)} color="#10B981" />
                    <Text style={styles.timestampText}>Confirmed at {currentOrder.acceptedAt}</Text>
                  </View>
                )}
                {currentOrder?.readyAt && (
                  <View style={styles.timestampRow}>
                    <Icon name="cube" size={scaleSize(12)} color="#8B5CF6" />
                    <Text style={styles.timestampText}>Ready at {currentOrder.readyAt}</Text>
                  </View>
                )}
                {currentOrder?.onWayAt && (
                  <View style={styles.timestampRow}>
                    <Icon name="car" size={scaleSize(12)} color="#EC4899" />
                    <Text style={styles.timestampText}>On the way at {currentOrder.onWayAt}</Text>
                  </View>
                )}
                {currentOrder?.deliveredAt && (
                  <View Style={styles.timestampRow}>
                    <Icon name="checkmark-done" size={scaleSize(12)} color="#F07119" />
                    <Text style={styles.timestampText}>Delivered at {currentOrder.deliveredAt}</Text>
                  </View>
                )}
                {currentOrder?.cancelledAt && (
                  <View style={styles.timestampRow}>
                    <Icon name="close-circle" size={scaleSize(12)} color="#EF4444" />
                    <Text style={styles.timestampText}>
                      {currentOrder.autoCancelled ? 'Auto-cancelled' : 'Cancelled'} at {currentOrder.cancelledAt}
                    </Text>
                  </View>
                )}
              </View>

              {/* Role Information Badge */}
              <View style={styles.roleInfoBadge}>
                <Icon name="person-circle-outline" size={scaleSize(14)} color="#6B7280" />
                <Text style={styles.roleInfoText}>
                  Logged in as: {userRole === 1 ? 'Kitchen Staff' : userRole === 2 ? 'Manager' : 'Delivery Personnel'}
                </Text>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            {currentOrder?.status && currentOrder.status !== 'delivered' && 
              currentOrder.status !== 'cancelled' && currentOrder.status !== 'refunded' && (
              <View style={styles.actionButtons}>
                {/* Cancel Button - Always shown for restaurant owners */}
                {userPermissions.canCancelOrders && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={handleCancelOrder}
                    activeOpacity={0.8}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Icon name="close-circle" size={scaleSize(16)} color="#fff" />
                        <Text style={styles.cancelButtonText}>Cancel Order</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                
                {/* Status Update Button */}
                {(() => {
                  const buttonConfig = getStatusButtonConfig();
                  
                  if (!buttonConfig) return null;
                  
                  return (
                    <TouchableOpacity 
                      style={[
                        styles.actionButton, 
                        styles.statusUpdateButton,
                        { 
                          backgroundColor: buttonConfig.color,
                          flex: userPermissions.canCancelOrders ? 1.5 : 2
                        }
                      ]}
                      onPress={() => handleUpdateOrderStatus(buttonConfig.nextStatus)}
                      activeOpacity={0.8}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Icon 
                            name={
                              buttonConfig.nextStatus === 'confirmed' ? 'checkmark-circle' :
                              buttonConfig.nextStatus === 'preparing' ? 'fast-food' :
                              buttonConfig.nextStatus === 'ready' ? 'cube' :
                              buttonConfig.nextStatus === 'on_the_way' ? 'car' :
                              buttonConfig.nextStatus === 'delivered' ? 'checkmark-done' :
                              'checkmark-circle'
                            } 
                            size={scaleSize(16)} 
                            color="#fff" 
                          />
                          <Text style={styles.statusUpdateButtonText}>{buttonConfig.text}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}

            {/* Final Status Display */}
            {(currentOrder?.status === 'delivered' || 
              currentOrder?.status === 'cancelled' || 
              currentOrder?.status === 'refunded') && (
              <View style={styles.finalStatusActions}>
                <View style={[
                  styles.finalStatusCard,
                  { backgroundColor: `${STATUS_COLORS[currentOrder.status]}15` }
                ]}>
                  <Icon 
                    name={
                      currentOrder.status === 'delivered' ? 'checkmark-done-circle' :
                      currentOrder.status === 'cancelled' ? 'close-circle' :
                      'arrow-undo-circle'
                    } 
                    size={scaleSize(30)} 
                    color={STATUS_COLORS[currentOrder.status]} 
                  />
                  <Text style={[
                    styles.finalStatusTitle,
                    { color: STATUS_COLORS[currentOrder.status] }
                  ]}>
                    {STATUS_DISPLAY_MAP[currentOrder.status]}
                  </Text>
                  <Text style={styles.finalStatusSubtitle}>
                    {currentOrder.status === 'delivered' ? 'Order has been delivered successfully' :
                     currentOrder.status === 'cancelled' ? 'Order has been cancelled' :
                     'Order has been refunded'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'ios' ? scaleSize(130) : scaleSize(120),
    paddingBottom: Platform.OS === 'ios' ? scaleSize(100) : scaleSize(20),
  },
  // Fullscreen Initial Loader
  fullscreenLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingLogoContainer: {
    position: 'relative',
    marginBottom: scaleSize(20),
  },
  loadingPulse: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: 'rgba(240, 113, 25, 0.1)',
    borderRadius: scaleSize(40),
    transform: [{ scale: 1.2 }],
  },
  loadingTitle: {
    fontSize: scaleFont(28),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(8),
    letterSpacing: -0.5,
  },
  loadingSubtitle: {
    fontSize: scaleFont(16),
    color: '#6B7280',
    marginBottom: scaleSize(30),
  },
  loadingSpinner: {
    marginTop: scaleSize(20),
  },
  // Data Loading Overlay
  dataLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1001,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataLoadingText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#111827',
    marginTop: scaleSize(16),
  },
  // Orders Loading Overlay
  ordersLoadingOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? scaleSize(130) : scaleSize(120),
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 999,
    paddingVertical: scaleSize(10),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ordersLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordersLoadingText: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    marginLeft: scaleSize(10),
  },
  // Header Wrapper to fix header position
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? scaleSize(40) : scaleSize(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: scaleSize(4),
    elevation: 5,
  },
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleSize(20),
  },
  loadingLogo: {
    marginBottom: scaleSize(20),
  },
  loadingText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#374151',
    marginBottom: scaleSize(20),
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F07119',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
    borderRadius: scaleSize(10),
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginLeft: scaleSize(8),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleSize(20),
  },
  emptyTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#111827',
    marginTop: scaleSize(20),
  },
  emptyText: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: scaleSize(8),
    marginBottom: scaleSize(20),
    lineHeight: scaleSize(20),
    paddingHorizontal: scaleSize(40),
  },
  // Modern Header
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 0 : scaleSize(42),
    paddingBottom: scaleSize(12),
    paddingHorizontal: scaleSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSize(12),
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: scaleSize(4),
    marginRight: scaleSize(8),
  },
  restaurantSelector: {
    flex: 1,
    marginHorizontal: scaleSize(8),
  },
  restaurantSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restaurantSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantAvatar: {
    width: scaleSize(36),
    height: scaleSize(36),
    borderRadius: scaleSize(18),
    backgroundColor: '#E5E7EB',
    marginRight: scaleSize(10),
    overflow: 'hidden',
    position: 'relative',
  },
  restaurantAvatarImage: {
    width: '100%',
    height: '100%',
  },
  restaurantStatusIndicator: {
    position: 'absolute',
    bottom: scaleSize(2),
    right: scaleSize(2),
    width: scaleSize(8),
    height: scaleSize(8),
    borderRadius: scaleSize(4),
    borderWidth: scaleSize(1.5),
    borderColor: '#fff',
  },
  restaurantInfoContainer: {
    flex: 1,
    minWidth: 0,
  },
  restaurantName: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#111827',
    lineHeight: scaleSize(20),
  },
  restaurantDetails: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    marginTop: scaleSize(2),
    lineHeight: scaleSize(14),
  },
  noRestaurantText: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    fontStyle: 'italic',
  },
  refreshButton: {
    padding: scaleSize(6),
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(10),
    marginLeft: scaleSize(8),
  },
  // Status Button
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(6),
    borderRadius: scaleSize(20),
    borderWidth: 1.5,
    minWidth: scaleSize(90),
    height: scaleSize(32),
    justifyContent: 'center',
  },
  statusDot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(6),
  },
  statusButtonText: {
    fontSize: scaleFont(11),
    fontWeight: '600',
  },
  // Search
  searchButton: {
    padding: scaleSize(6),
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(10),
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(12),
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(8),
    marginRight: scaleSize(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: scaleSize(8),
  },
  searchInput: {
    flex: 1,
    fontSize: scaleFont(14),
    color: '#111827',
    paddingVertical: 0,
    minHeight: scaleSize(20),
  },
  clearButton: {
    padding: scaleSize(4),
    marginLeft: scaleSize(4),
  },
  cancelButton: {
    backgroundColor: '#F07119',
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(8),
    borderRadius: scaleSize(10),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: scaleFont(13),
    fontWeight: '600',
  },
  searchResultsInfo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? scaleSize(130) : scaleSize(120),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleSize(16),
    paddingVertical: scaleSize(10),
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    zIndex: 999,
  },
  searchResultsText: {
    fontSize: scaleFont(12),
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
    marginRight: scaleSize(8),
  },
  clearSearchText: {
    fontSize: scaleFont(12),
    color: '#F07119',
    fontWeight: '600',
  },
  // Notification Loader Modal
  loaderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderModalContainer: {
    backgroundColor: '#fff',
    padding: scaleSize(30),
    borderRadius: scaleSize(20),
    alignItems: 'center',
    justifyContent: 'center',
    width: scaleSize(280),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(8),
    elevation: 10,
  },
  loaderModalText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#111827',
    marginTop: scaleSize(20),
    textAlign: 'center',
    lineHeight: scaleSize(22),
  },
  loaderModalSubtext: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    marginTop: scaleSize(8),
    textAlign: 'center',
  },
  // Notification Banner
  notificationBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? scaleSize(100) : scaleSize(80),
    left: scaleSize(12),
    right: scaleSize(12),
    backgroundColor: '#F07119',
    borderRadius: scaleSize(16),
    padding: scaleSize(14),
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.2,
    shadowRadius: scaleSize(8),
    elevation: 10,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    position: 'relative',
    marginRight: scaleSize(12),
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: scaleSize(-2),
    right: scaleSize(-2),
    width: scaleSize(14),
    height: scaleSize(14),
    borderRadius: scaleSize(7),
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
    marginRight: scaleSize(12),
  },
  bannerTitle: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: '#fff',
    marginBottom: scaleSize(4),
  },
  bannerSubtitle: {
    fontSize: scaleFont(13),
    color: 'rgba(255,255,255,0.9)',
    marginBottom: scaleSize(6),
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scaleSize(10),
    paddingVertical: scaleSize(4),
    borderRadius: scaleSize(8),
    alignSelf: 'flex-start',
  },
  timerText: {
    color: '#fff',
    fontSize: scaleFont(11),
    fontWeight: '700',
    marginLeft: scaleSize(4),
  },
  // Modern Stats Container
  statsContainer: {
    marginHorizontal: scaleSize(16),
    marginTop: scaleSize(40),
    backgroundColor: '#fff',
    borderRadius: scaleSize(20),
    padding: scaleSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.08,
    shadowRadius: scaleSize(12),
    elevation: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: scaleSize(16),
  },
  statCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(16),
    padding: scaleSize(16),
    marginBottom: scaleSize(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIconContainer: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleSize(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: scaleSize(4),
    elevation: 2,
  },
  statValue: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(4),
  },
  statLabel: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  statusBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(12),
    padding: scaleSize(14),
    marginBottom: scaleSize(14),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusBreakdownItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusDotSmall: {
    width: scaleSize(8),
    height: scaleSize(8),
    borderRadius: scaleSize(4),
    marginBottom: scaleSize(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(1) },
    shadowOpacity: 0.2,
    shadowRadius: scaleSize(2),
    elevation: 1,
  },
  statusCount: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(2),
  },
  statusLabel: {
    fontSize: scaleFont(10),
    color: '#6B7280',
    fontWeight: '500',
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scaleSize(12),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  lastUpdatedText: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    marginLeft: scaleSize(6),
  },
  // Filter Section
  filterContainer: {
    marginTop: scaleSize(16),
    marginHorizontal: scaleSize(16),
  },
  filterScrollContainer: {
    paddingRight: scaleSize(16),
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(10),
    borderRadius: scaleSize(12),
    marginRight: scaleSize(8),
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.05,
    shadowRadius: scaleSize(4),
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: '#F07119',
    borderColor: '#F07119',
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(6),
    elevation: 4,
  },
  filterButtonText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: scaleSize(6),
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  // Section Container
  sectionContainer: {
    paddingHorizontal: scaleSize(16),
    marginTop: scaleSize(20),
    marginBottom: scaleSize(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(16),
  },
  sectionTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginTop: scaleSize(4),
  },
  sectionCountBadge: {
    backgroundColor: '#F07119',
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(8),
    borderRadius: scaleSize(20),
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(6),
    elevation: 4,
  },
  sectionCount: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#fff',
  },
  ordersList: {
    paddingBottom: scaleSize(16),
  },
  // Modern Order Cards
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(16),
    padding: scaleSize(18),
    marginBottom: scaleSize(10),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: scaleSize(5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.05,
    shadowRadius: scaleSize(6),
    elevation: 2,
    position: 'relative',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(10),
  },
  orderCardHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  order_number: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  orderTime: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginTop: scaleSize(4),
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(10),
    paddingVertical: scaleSize(5),
    borderRadius: scaleSize(10),
    marginLeft: scaleSize(8),
  },
  orderStatusDot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(5),
  },
  orderStatusText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  orderItemsPreview: {
    marginBottom: scaleSize(10),
  },
  orderItemPreview: {
    fontSize: scaleFont(14),
    color: '#4B5563',
    marginBottom: scaleSize(3),
  },
  moreItems: {
    fontSize: scaleFont(12),
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmount: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: '#111827',
  },
  deliveryTime: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    fontWeight: '500',
  },
  urgentBadge: {
    position: 'absolute',
    top: scaleSize(-4),
    right: scaleSize(-4),
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(3),
    borderRadius: scaleSize(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  urgentText: {
    color: '#fff',
    fontSize: scaleFont(9),
    fontWeight: '800',
    marginLeft: scaleSize(2),
    letterSpacing: 0.5,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleSize(50),
    paddingHorizontal: scaleSize(20),
    backgroundColor: '#fff',
    borderRadius: scaleSize(16),
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginTop: scaleSize(8),
  },
  emptyStateLoader: {
    marginBottom: scaleSize(20),
  },
  emptyStateTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: scaleSize(20),
    marginBottom: scaleSize(8),
  },
  emptyStateText: {
    fontSize: scaleFont(14),
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: scaleSize(20),
    paddingHorizontal: scaleSize(20),
  },
  simulateSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F07119',
    paddingHorizontal: scaleSize(18),
    paddingVertical: scaleSize(12),
    borderRadius: scaleSize(10),
    marginTop: scaleSize(20),
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(6),
    elevation: 3,
  },
  simulateSmallButtonText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginLeft: scaleSize(6),
  },
  // Restaurant Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  restaurantModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSize(24),
    borderTopRightRadius: scaleSize(24),
    maxHeight: height * 0.8,
  },
  restaurantModalHeader: {
    paddingTop: scaleSize(24),
    paddingBottom: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restaurantModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  restaurantList: {
    padding: scaleSize(20),
  },
  modalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleSize(50),
  },
  modalEmptyText: {
    fontSize: scaleFont(15),
    color: '#9CA3AF',
    marginTop: scaleSize(16),
  },
  restaurantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: scaleSize(16),
    borderRadius: scaleSize(16),
    marginBottom: scaleSize(10),
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  restaurantItemSelected: {
    borderWidth: 2,
    borderColor: '#F07119',
    backgroundColor: '#FFFBEB',
  },
  restaurantImage: {
    width: scaleSize(56),
    height: scaleSize(56),
    borderRadius: scaleSize(12),
    marginRight: scaleSize(14),
  },
  restaurantInfo: {
    flex: 1,
    minWidth: 0,
  },
  restaurantItemName: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(4),
  },
  restaurantItemCuisine: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginBottom: scaleSize(4),
  },
  restaurantItemLocation: {
    fontSize: scaleFont(11),
    color: '#9CA3AF',
    marginBottom: scaleSize(8),
  },
  restaurantItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scaleSize(12),
  },
  restaurantStatText: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    marginLeft: scaleSize(4),
  },
  restaurantItemRight: {
    alignItems: 'flex-end',
    marginLeft: scaleSize(8),
  },
  restaurantStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(4),
    borderRadius: scaleSize(12),
    marginBottom: scaleSize(8),
  },
  restaurantStatusDot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(5),
  },
  restaurantStatusText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
  },
  // Order Details Modal
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSize(24),
    borderTopRightRadius: scaleSize(24),
    maxHeight: height * 0.85,
  },
  modalHeader: {
    paddingTop: scaleSize(24),
    paddingBottom: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderUrgent: {
    borderBottomWidth: 2,
    borderBottomColor: '#EF4444',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: scaleFont(13),
    color: '#EF4444',
    marginTop: scaleSize(6),
    fontWeight: '600',
  },
  closeButton: {
    padding: scaleSize(4),
  },
  modalBody: {
    padding: scaleSize(20),
    maxHeight: height * 0.6,
  },
  // Order Status Card
  orderStatusCard: {
    backgroundColor: '#fff',
    borderRadius: scaleSize(18),
    marginBottom: scaleSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.08,
    shadowRadius: scaleSize(8),
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderStatusHeader: {
    padding: scaleSize(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderStatusIcon: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleSize(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.2,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  orderStatusInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderStatusSubtext: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginTop: scaleSize(4),
  },
  orderAmountLarge: {
    fontSize: scaleFont(20),
    fontWeight: '800',
  },
  // Status Timeline
  statusTimeline: {
    padding: scaleSize(20),
    paddingTop: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: scaleSize(44),
  },
  timelineDot: {
    width: scaleSize(20),
    height: scaleSize(20),
    borderRadius: scaleSize(10),
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleSize(12),
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(1) },
    shadowOpacity: 0.1,
    shadowRadius: scaleSize(2),
    elevation: 1,
  },
  timelineDotActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(3) },
    shadowOpacity: 0.2,
    shadowRadius: scaleSize(4),
    elevation: 3,
  },
  timelineLabel: {
    fontSize: scaleFont(12),
    color: '#9CA3AF',
    fontWeight: '500',
    flex: 1,
  },
  timelineLabelActive: {
    color: '#111827',
    fontWeight: '600',
  },
  timelineLine: {
    position: 'absolute',
    left: scaleSize(10),
    top: scaleSize(20),
    width: 1,
    height: scaleSize(44),
    backgroundColor: '#E5E7EB',
  },
  // Detail Sections
  detailSection: {
    marginBottom: scaleSize(20),
  },
  detailSectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scaleSize(12),
    letterSpacing: -0.3,
  },
  detailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(14),
    padding: scaleSize(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(10),
  },
  detailText: {
    fontSize: scaleFont(14),
    color: '#374151',
    marginLeft: scaleSize(10),
    flex: 1,
  },
  // Alarm Control
  alarmControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: scaleSize(16),
    borderRadius: scaleSize(14),
    marginBottom: scaleSize(20),
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
  },
  volumeSlider: {
    flex: 1,
    height: scaleSize(24),
    marginHorizontal: scaleSize(12),
  },
  muteButton: {
    padding: scaleSize(6),
  },
  // Order Items
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: scaleSize(10),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  quantityBadge: {
    width: scaleSize(28),
    height: scaleSize(28),
    borderRadius: scaleSize(14),
    backgroundColor: '#F07119',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleSize(12),
    flexShrink: 0,
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(4),
    elevation: 2,
  },
  quantityText: {
    color: '#fff',
    fontSize: scaleFont(12),
    fontWeight: '800',
  },
  orderItemName: {
    fontSize: scaleFont(15),
    color: '#374151',
    flex: 1,
    lineHeight: scaleSize(20),
  },
  orderItemPrice: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: '#111827',
    flexShrink: 0,
    marginLeft: scaleSize(12),
  },
  orderTotal: {
    marginTop: scaleSize(16),
    paddingTop: scaleSize(16),
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scaleSize(6),
  },
  totalLabel: {
    fontSize: scaleFont(13),
    color: '#6B7280',
  },
  totalValue: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#374151',
  },
  grandTotalRow: {
    marginTop: scaleSize(8),
    paddingTop: scaleSize(10),
    borderTopWidth: 1.5,
    borderTopColor: '#D1D5DB',
  },
  grandTotalLabel: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#F07119',
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  instructionsText: {
    fontSize: scaleFont(14),
    color: '#92400E',
    lineHeight: scaleSize(20),
    marginLeft: scaleSize(12),
    flex: 1,
    fontStyle: 'italic',
  },
  // Timestamps
  timestampsSection: {
    backgroundColor: '#F8FAFC',
    padding: scaleSize(18),
    borderRadius: scaleSize(14),
    marginTop: scaleSize(20),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timestampsTitle: {
    fontSize: scaleFont(15),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scaleSize(12),
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(8),
  },
  timestampText: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginLeft: scaleSize(10),
  },
  // Role Info Badge
  roleInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(10),
    borderRadius: scaleSize(10),
    marginTop: scaleSize(20),
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleInfoText: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginLeft: scaleSize(8),
    fontWeight: '500',
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    padding: scaleSize(20),
    paddingTop: scaleSize(16),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: scaleSize(6),
    borderRadius: scaleSize(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleSize(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.15,
    shadowRadius: scaleSize(8),
    elevation: 4,
  },
  statusUpdateButton: {
    backgroundColor: '#10B981',
  },
  statusUpdateButtonText: {
    color: '#fff',
    fontSize: scaleFont(15),
    fontWeight: '600',
    marginLeft: scaleSize(8),
  },
  // Final Status Actions
  finalStatusActions: {
    padding: scaleSize(20),
    paddingTop: scaleSize(16),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  finalStatusCard: {
    alignItems: 'center',
    padding: scaleSize(28),
    borderRadius: scaleSize(16),
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  finalStatusTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    marginTop: scaleSize(16),
    marginBottom: scaleSize(8),
  },
  finalStatusSubtitle: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: scaleSize(20),
  },
  bogoText: {
    color: "#2E7D32",
    fontSize: scaleFont(12),
    fontWeight: "700",
  }
});

export default PartnerScreen;