import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Modal,
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
import Slider from '@react-native-community/slider';
import {
  getOrderDetails,
  getRestaurantList,
  updateOrderStatus,
  updateRestaurantStatus,
} from '../../../api/partner';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Responsive scaling
const isSmallScreen = width < 375;
const isLargeScreen = width > 414;
const isTablet = width >= 768;

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

// -------------------- CONSTANTS --------------------
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

const ORDER_STATUS_MAPPING = {
  1: 'pending',
  2: 'confirmed',
  3: 'preparing',
  4: 'ready',
  5: 'on_the_way',
  6: 'delivered',
  7: 'cancelled',
  8: 'refunded',
  9: 'confirmed', // was 'inprogress' – now mapped to confirmed
  'Pending': 'pending',
  'Confirmed': 'confirmed',
  'Preparing': 'preparing',
  'Ready for Delivery/Pickup': 'ready',
  'On the Way': 'on_the_way',
  'Delivered': 'delivered',
  'Cancelled': 'cancelled',
  'Refunded': 'refunded',
  'Payment Failed': 'payment_failed',
};

const STATUS_TO_API_MAPPING = {
  'pending': 1,
  'confirmed': 2,
  'preparing': 3,
  'ready': 4,
  'on_the_way': 5,
  'delivered': 6,
  'cancelled': 7,
  'refunded': 8,
  'payment_failed': null,
};

const STATUS_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'on_the_way',
  'delivered',
];

const NEXT_STATUS_MAPPING = {
  'pending': 'confirmed',
  'confirmed': 'preparing',
  'preparing': 'ready',
  'ready': 'on_the_way',
  'on_the_way': 'delivered',
  'delivered': null,
  'cancelled': null,
  'refunded': null,
  'payment_failed': null,
};

const STATUS_COLORS = {
  'pending': '#F59E0B',
  'confirmed': '#10B981',
  'preparing': '#3B82F6',
  'ready': '#8B5CF6',
  'on_the_way': '#EC4899',
  'delivered': '#F07119',
  'cancelled': '#EF4444',
  'refunded': '#6B7280',
  'payment_failed': '#DC2626',
};

const STATUS_BUTTON_COLORS = {
  'pending': '#10B981',
  'confirmed': '#3B82F6',
  'preparing': '#8B5CF6',
  'ready': '#EC4899',
  'on_the_way': '#F07119',
  'delivered': '#10B981',
  'cancelled': '#EF4444',
  'refunded': '#6B7280',
  'payment_failed': '#DC2626',
};

const STATUS_BUTTON_TEXT = {
  'pending': 'Confirm',
  'confirmed': 'Start Preparing',
  'preparing': 'Ready for Pickup',
  'ready': 'On the Way',
  'on_the_way': 'Delivered',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
  'payment_failed': 'Payment Failed',
};

const STATUS_DISPLAY_MAP = {
  'pending': 'Pending',
  'confirmed': 'Confirmed',
  'preparing': 'Preparing',
  'ready': 'Ready for Pickup',
  'on_the_way': 'On the Way',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
  'payment_failed': 'Payment Failed',
};

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

const ROLE_PERMISSIONS = {
  1: {
    canUpdateOrderStatus: ['pending', 'confirmed', 'preparing', 'ready', 'on_the_way', 'delivered'],
    canSeeRevenue: false,
    canManageRestaurant: true,
    canCancelOrders: true,
    canChangeToOnTheWay: true,
    canChangeToDelivered: true,
    canUpdateTo: (currentStatus, nextStatus) => {
      if (['cancelled', 'refunded'].includes(nextStatus)) return true;
      if (currentStatus === 'ready' && nextStatus === 'on_the_way') return false;
      return STATUS_FLOW.indexOf(nextStatus) > STATUS_FLOW.indexOf(currentStatus);
    },
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
    },
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
    },
  },
};

// Helper: generate unique ID
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

// -------------------- MAIN COMPONENT --------------------
const PartnerScreen = ({ navigation, route }) => {
  // ---------- STATE ----------
  const [pendingNotification, setPendingNotification] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [restaurants, setRestaurants] = useState([]);
  const [ordersData, setOrdersData] = useState({});
  const [filteredOrders, setFilteredOrders] = useState([]);

  const [selectedFilter, setSelectedFilter] = useState('all');

  const [stats, setStats] = useState({
    todayOrders: 0,
    revenue: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
    onTheWay: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0,
  });

  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingRestaurantStatus, setUpdatingRestaurantStatus] = useState(false);
  const [isRestaurantChanging, setIsRestaurantChanging] = useState(false);
  const [notificationOrderId, setNotificationOrderId] = useState(null);
  const [notificationRestaurantId, setNotificationRestaurantId] = useState(null);

  // Refs
  const pollingIntervalRef = useRef(null);
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

  // ---------- MAPPING FUNCTION ----------
  const mapApiOrderToAppFormat = useCallback((apiOrder) => {
    const {
      full_name,
      email,
      phone_number,
      order_number,
      delivery_address,
      placed_on,
      estimated_delivery,
      items = [],
      subtotal,
      delivery_fee,
      total,
      status: apiStatus,
      transaction_id,
      payment_status,
      payment_method,
    } = apiOrder;

    const internalStatus = ORDER_STATUS_MAPPING[apiStatus] || 'pending';

    const mappedItems = items.map((item, index) => ({
      id: `${order_number}-item-${index}`,
      name: item.item_name || 'Item',
      quantity: item.quantity || 1,
      unit_price: parseFloat(item.unit_price || 0),
      total_price: parseFloat(item.total_price || 0),
      buy_one_get_one_free: item.buy_one_get_one_free || false,
    }));

    const totalAmount = parseFloat(total) || 0;
    const orderDate = placed_on ? new Date(placed_on) : new Date();
    const orderTime = formatTimeString(placed_on || new Date());

    const uniqueId = generateUniqueOrderId(order_number, orderTime, transaction_id || '');

    return {
      uniqueId,
      order_number: order_number,
      customerName: full_name || 'Customer',
      phoneNumber: phone_number || '',
      items: mappedItems,
      totalAmount: totalAmount,
      subtotal: parseFloat(subtotal) || 0,
      deliveryFee: parseFloat(delivery_fee) || 0,
      deliveryAddress: delivery_address || 'Address not provided',
      deliveryTime: estimated_delivery ? formatTimeString(estimated_delivery) : '30-40 min',
      orderTime: orderTime,
      orderTimestamp: orderDate.getTime(),
      placedOn: placed_on,
      estimatedDelivery: estimated_delivery,
      specialInstructions: '',
      paymentMethod: payment_method || 'Cash',
      paymentStatus: payment_status || '',
      transactionId: transaction_id,
      status: internalStatus,
      urgency: 'normal',
      acceptedAt: internalStatus === 'confirmed' ? formatTimeString(placed_on) : null,
      prepStartTime: internalStatus === 'preparing' ? new Date() : null,
      readyAt: internalStatus === 'ready' ? formatTimeString(placed_on) : null,
      onWayAt: internalStatus === 'on_the_way' ? formatTimeString(placed_on) : null,
      deliveredAt: internalStatus === 'delivered' ? formatTimeString(placed_on) : null,
      cancelledAt: internalStatus === 'cancelled' ? formatTimeString(placed_on) : null,
      refundedAt: internalStatus === 'refunded' ? formatTimeString(placed_on) : null,
      paymentFailedAt: internalStatus === 'payment_failed' ? new Date().toLocaleTimeString('en-IN') : null,
      apiData: apiOrder,
      createdAt: new Date().toISOString(),
    };
  }, []);

  const formatTimeString = useCallback((dateInput) => {
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
  }, []);

  // ---------- STATS UPDATE USING SUMMARY ----------
  const updateStatsFromSummary = useCallback((summary) => {
    if (!summary) return;

    const totalOrders = parseInt(summary.total_orders) || 0;
    const revenue = parseFloat(summary.total_revenue) || 0;

    let pending = 0,
      confirmed = 0,
      preparing = 0,
      ready = 0,
      onTheWay = 0,
      delivered = 0,
      cancelled = 0,
      refunded = 0;

    if (summary.status_breakdown && Array.isArray(summary.status_breakdown)) {
      summary.status_breakdown.forEach(item => {
        const statusKey = ORDER_STATUS_MAPPING[item.status] || item.status;
        const count = item.order_count || 0;
        switch (statusKey) {
          case 'pending': pending = count; break;
          case 'confirmed': confirmed = count; break;
          case 'preparing': preparing = count; break;
          case 'ready': ready = count; break;
          case 'on_the_way': onTheWay = count; break;
          case 'delivered': delivered = count; break;
          case 'cancelled': cancelled = count; break;
          case 'refunded': refunded = count; break;
          default: break;
        }
      });
    }

    setStats({
      todayOrders: totalOrders,
      revenue,
      pending,
      preparing,
      ready,
      onTheWay,
      delivered,
      cancelled,
      refunded,
    });
  }, []);

  // ---------- OTHER FUNCTIONS ----------
  const updateOrderStatusAPI = useCallback(async (order_number, newStatus) => {
    if (!order_number) return false;
    const statusCode = STATUS_TO_API_MAPPING[newStatus];
    if (statusCode === null || statusCode === undefined) {
      Alert.alert('Invalid Status', `Cannot update to "${newStatus}" because it is not supported by the server.`, [{ text: 'OK' }]);
      return false;
    }
    try {
      setUpdatingStatus(true);
      const payload = {
        new_status: statusCode,
        order_number: order_number,
      };
      console.log('Updating order status with numeric code:', payload);
      const response = await updateOrderStatus(payload);
      if (response && response.status == 200) {
        console.log('Order status updated successfully');
        return true;
      } else {
        console.error('Failed to update order status:', response?.message);
        Alert.alert('Update Failed', response?.message || 'Failed to update order status.', [{ text: 'OK' }]);
        return false;
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Update Error', 'An error occurred while updating order status.', [{ text: 'OK' }]);
      return false;
    } finally {
      setUpdatingStatus(false);
    }
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
        }));
        setRestaurants(restaurantList);
        let restaurantToSelect = null;
        if (notificationDataRef.current?.data?.restaurant_id || notificationRestaurantId) {
          const notificationRestaurantId = notificationDataRef.current?.data?.restaurant_id || notificationRestaurantId;
          const notificationRestaurant = restaurantList.find(
            r => r.restaurant_id && r.restaurant_id.toString() === notificationRestaurantId.toString()
          );
          if (notificationRestaurant) restaurantToSelect = notificationRestaurant;
        }
        if (!restaurantToSelect && selectedRestaurant) {
          const existingRestaurant = restaurantList.find(
            r => r.restaurant_id && r.restaurant_id.toString() === selectedRestaurant.restaurant_id.toString()
          );
          if (existingRestaurant) restaurantToSelect = existingRestaurant;
        }
        if (!restaurantToSelect && restaurantList.length > 0) restaurantToSelect = restaurantList[0];
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
  }, [user, notificationRestaurantId, selectedRestaurant, fetchUserData, fetchOrdersForRestaurant]);

  const fetchOrdersForRestaurant = useCallback(async (restaurantId, isSilentFetch = false) => {
    try {
      if (!restaurantId) return;
      if (isPolling) return;
      setIsPolling(true);
      setOrdersLoading(true);
      console.log('📥 Fetching orders for restaurant:', restaurantId);
      const response = await getOrderDetails(restaurantId);
      if (response && response?.data?.orders) {
        const restaurantOrders = response.data.orders.map(order => mapApiOrderToAppFormat(order));
        const uniqueRestaurantOrders = [];
        const seenIds = new Set();
        restaurantOrders.forEach(order => {
          if (!seenIds.has(order.uniqueId)) {
            seenIds.add(order.uniqueId);
            uniqueRestaurantOrders.push(order);
          }
        });

        setOrdersData(prev => {
          const existingOrders = prev[restaurantId] || [];
          const existingOrdersMap = new Map();
          existingOrders.forEach(order => existingOrdersMap.set(order.uniqueId, order));
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
                paymentFailedAt: existingOrder.paymentFailedAt || newOrder.paymentFailedAt,
              };
            }
            return newOrder;
          });
          return { ...prev, [restaurantId]: updatedOrders };
        });

        if (response.data.summary) {
          updateStatsFromSummary(response.data.summary);
        } else {
          updateStatsFromOrders(uniqueRestaurantOrders);
        }

        if (!isSilentFetch) {
          checkForNewOrders(restaurantId, uniqueRestaurantOrders);
        }

        const active = uniqueRestaurantOrders.filter(order =>
          ['pending', 'confirmed', 'preparing'].includes(order.status)
        );
        setActiveOrders(active);
        setLastUpdated(new Date());

        if (notificationDataRef.current && !notificationDataRef.current.processed) {
          const notificationRestaurantId = notificationDataRef.current.data?.restaurant_id;
          const notificationOrderId = notificationDataRef.current.data?.order_number || notificationDataRef.current.data?.orderId;
          if (restaurantId.toString() === notificationRestaurantId?.toString()) {
            const notificationOrder = uniqueRestaurantOrders.find(order =>
              order.order_number && order.order_number.toString() === notificationOrderId?.toString()
            );
            if (notificationOrder) {
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
        setOrdersData(prev => ({ ...prev, [restaurantId]: [] }));
        setActiveOrders([]);
        setLastUpdated(new Date());
        resetStats();
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsPolling(false);
      setOrdersLoading(false);
    }
  }, [isPolling, mapApiOrderToAppFormat, updateStatsFromSummary, resetStats, checkForNewOrders]);

  const updateStatsFromOrders = useCallback((orders) => {
    const todayOrders = orders.length;
    const revenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const pending = orders.filter(o => o.status === 'pending').length;
    const preparing = orders.filter(o => o.status === 'preparing').length;
    const ready = orders.filter(o => o.status === 'ready').length;
    const onTheWay = orders.filter(o => o.status === 'on_the_way').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const cancelled = orders.filter(o => o.status === 'cancelled').length;
    const refunded = orders.filter(o => o.status === 'refunded').length;

    setStats({
      todayOrders,
      revenue,
      pending,
      preparing,
      ready,
      onTheWay,
      delivered,
      cancelled,
      refunded,
    });
  }, []);

  const resetStats = useCallback(() => {
    setStats({
      todayOrders: 0,
      revenue: 0,
      pending: 0,
      preparing: 0,
      ready: 0,
      onTheWay: 0,
      delivered: 0,
      cancelled: 0,
      refunded: 0,
    });
  }, []);

  // Updated: just update orders and stats without banner or alarm
  const checkForNewOrders = useCallback((restaurantId, newOrders) => {
    if (!selectedRestaurant || selectedRestaurant.restaurant_id !== restaurantId) return;
    const currentOrders = ordersData[restaurantId] || [];
    const newPendingOrders = newOrders.filter(newOrder =>
      newOrder.status === 'pending' &&
      !currentOrders.some(existingOrder => existingOrder.uniqueId === newOrder.uniqueId)
    );
    // Simply update ordersData and stats – no banner, no alarm
    if (newPendingOrders.length > 0) {
      // The ordersData is already updated above, but we can optionally show a simple toast or notification?
      // For now, we do nothing else.
    }
  }, [selectedRestaurant, ordersData]);

  const switchRestaurant = useCallback(async (restaurant) => {
    try {
      setIsRestaurantChanging(true);
      setDataLoading(true);
      console.log('🔄 Switching to restaurant:', restaurant.restaurant_id);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
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
  }, [fetchOrdersForRestaurant, startPolling, resetStats]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (selectedRestaurant) {
      fetchOrdersForRestaurant(selectedRestaurant.restaurant_id);
      pollingIntervalRef.current = setInterval(() => {
        if (selectedRestaurant) {
          fetchOrdersForRestaurant(selectedRestaurant.restaurant_id, true);
        }
      }, 30000);
    }
  }, [selectedRestaurant, fetchOrdersForRestaurant]);

  const startBackgroundPolling = useCallback(() => {
    if (backgroundPollingRef.current) clearInterval(backgroundPollingRef.current);
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
  }, [selectedRestaurant, fetchOrdersForRestaurant]);

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
  }, [selectedRestaurant, restaurants, fetchRestaurants, switchRestaurant, refreshing, fetchUserData]);

  const formatLastUpdated = useCallback(() => {
    if (!lastUpdated) return 'Never';
    const now = new Date();
    const diff = Math.floor((now - lastUpdated) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  }, [lastUpdated]);

  const openOrderModal = useCallback((order) => {
    console.log('📖 Opening order modal for:', order.order_number);
    setCurrentOrder(order);
    setShowOrderModal(true);
  }, []);

  const handleUpdateOrderStatus = useCallback(async (newStatus) => {
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
                setOrdersData(prev => ({ ...prev, [restaurantId]: updatedOrders }));
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
            }
          },
        },
      ]
    );
  }, [currentOrder, updateOrderStatusAPI, selectedRestaurant, ordersData]);

  const handleCancelOrder = useCallback(() => {
    if (!userPermissions.canCancelOrders) {
      Alert.alert('Permission Denied', 'You do not have permission to cancel orders.', [{ text: 'OK' }]);
      return;
    }
    if (userRole === 1 && currentOrder && ['on_the_way', 'delivered', 'cancelled', 'refunded', 'payment_failed'].includes(currentOrder.status)) {
      Alert.alert('Permission Denied', 'You cannot cancel an order that is already on the way or later.', [{ text: 'OK' }]);
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
              const updatedOrder = { ...currentOrder, status: 'cancelled', cancelledAt: new Date().toLocaleTimeString('en-IN') };
              setCurrentOrder(updatedOrder);
              if (selectedRestaurant) {
                const restaurantId = selectedRestaurant.restaurant_id;
                const updatedOrders = (ordersData[restaurantId] || []).map(order =>
                  order.uniqueId === currentOrder.uniqueId ? updatedOrder : order
                );
                setOrdersData(prev => ({ ...prev, [restaurantId]: updatedOrders }));
                setStats(prev => {
                  const newStats = { ...prev };
                  if (currentOrder.status === 'pending') newStats.pending = Math.max(0, prev.pending - 1);
                  if (currentOrder.status === 'preparing') newStats.preparing = Math.max(0, prev.preparing - 1);
                  if (currentOrder.status === 'ready') newStats.ready = Math.max(0, prev.ready - 1);
                  if (currentOrder.status === 'on_the_way') newStats.onTheWay = Math.max(0, prev.onTheWay - 1);
                  return newStats;
                });
              }
              Alert.alert('Cancelled', 'Order has been cancelled.');
            }
          },
        },
      ]
    );
  }, [userPermissions, userRole, currentOrder, updateOrderStatusAPI, selectedRestaurant, ordersData]);

  const getNextStatus = useCallback(() => {
    if (!currentOrder || !currentOrder.status) return null;
    const currentStatus = currentOrder.status;
    if (['delivered', 'cancelled', 'refunded', 'payment_failed'].includes(currentStatus)) return null;

    if (userRole === 1 && currentStatus === 'ready') return null;

    const nextStatus = NEXT_STATUS_MAPPING[currentStatus];
    if (nextStatus && userPermissions.canUpdateTo(currentStatus, nextStatus)) return nextStatus;
    return null;
  }, [currentOrder, userRole, userPermissions]);

  const getStatusButtonConfig = useCallback(() => {
    if (!currentOrder) return null;
    const currentStatus = currentOrder.status;
    const nextStatus = getNextStatus();
    if (!nextStatus) return null;

    return {
      text: STATUS_BUTTON_TEXT[currentStatus],
      color: STATUS_BUTTON_COLORS[currentStatus],
      nextStatus: nextStatus,
    };
  }, [currentOrder, getNextStatus]);

  const toggleRestaurantStatus = useCallback(async () => {
    if (!selectedRestaurant || updatingRestaurantStatus) return;
    try {
      setUpdatingRestaurantStatus(true);
      const newStatus = selectedRestaurant.status === 'online' ? 'offline' : 'online';
      const response = await updateRestaurantStatus(selectedRestaurant.restaurant_id, {
        status: RESTAURANT_STATUS_API_MAPPING[newStatus],
      });
      if (response && response.status === 200) {
        setSelectedRestaurant(prev => ({ ...prev, status: newStatus }));
        setRestaurants(prev => prev.map(rest =>
          rest.restaurant_id === selectedRestaurant.restaurant_id ? { ...rest, status: newStatus } : rest
        ));
      }
    } catch (error) {
      console.error('Error updating restaurant status:', error);
      Alert.alert('Error', 'Failed to update restaurant status');
    } finally {
      setUpdatingRestaurantStatus(false);
    }
  }, [selectedRestaurant, updatingRestaurantStatus]);

  const getCuisineString = useCallback((cuisines) => {
    if (!cuisines || !Array.isArray(cuisines)) return '';
    return cuisines
      .map(c => c.cuisine_name)
      .filter(name => name && name.trim() !== '')
      .slice(0, 2)
      .join(', ');
  }, []);

  const getLocationString = useCallback((location) => {
    if (!location) return '';
    const area = location.area_sector_locality || '';
    const city = location.city || '';
    return area ? `${area}, ${city}` : city;
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  const handleBackPress = useCallback(() => navigation.goBack(), [navigation]);

  const navigateToSettlement = useCallback(() => {
    navigation.navigate('PartnerSettlementScreen', { restaurantId: selectedRestaurant?.restaurant_id });
  }, [navigation, selectedRestaurant]);

  // ---------- EFFECTS ----------
  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.fromNotification && route.params?.notificationData) {
      const notification = {
        data: route.params.notificationData,
        timestamp: Date.now(),
        processed: false,
      };
      notificationDataRef.current = notification;
      setPendingNotification(notification);
      navigation.setParams({ notificationData: undefined, fromNotification: undefined });
    }
  }, [route.params, navigation]);

  useEffect(() => {
    if (notificationDataRef.current && !notificationDataRef.current.processed && dataLoadedRef.current && restaurants.length > 0 && !notificationHandledRef.current) {
      console.log('🚀 Processing stored notification after data load:', notificationDataRef.current.data);
      handleNotificationData(notificationDataRef.current.data);
      notificationDataRef.current.processed = true;
      notificationHandledRef.current = true;
    }
  }, [dataLoadedRef.current, restaurants.length, handleNotificationData]);

  const showNotificationLoader = useCallback((message) => {
    setNotificationLoading(true);
    setNotificationMessage(message);
  }, []);

  const hideNotificationLoader = useCallback(() => {
    setNotificationLoading(false);
    setNotificationMessage('');
  }, []);

  const handleNotificationData = useCallback(async (notificationData) => {
    try {
      console.log('🎯 Processing notification data:', notificationData);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      showNotificationLoader('Loading restaurant and order details...');
      const { click_action, action_type, order_number, orderId, restaurant_id, restaurantId, action_screen, type } = notificationData;
      const finalRestaurantId = restaurant_id || restaurantId;
      const finalOrderId = order_number || orderId;
      if (!finalRestaurantId || !finalOrderId) {
        hideNotificationLoader();
        Alert.alert('Notification Error', 'Missing restaurant or order information in notification.', [{ text: 'OK' }]);
        return;
      }
      setNotificationRestaurantId(finalRestaurantId.toString());
      setNotificationOrderId(finalOrderId.toString());
      await navigateToOrderFromNotification(finalRestaurantId.toString(), finalOrderId.toString());
    } catch (error) {
      console.error('❌ Error processing notification:', error);
      hideNotificationLoader();
      Alert.alert('Notification Error', 'Could not process notification. Please try refreshing.', [{ text: 'OK' }]);
    }
  }, [showNotificationLoader, hideNotificationLoader, navigateToOrderFromNotification]);

  const navigateToOrderFromNotification = useCallback(async (restaurantId, orderNumber) => {
    console.log('🧭 Starting navigation to order from notification:', { restaurantId, orderNumber });
    try {
      notificationHandledRef.current = true;
      if (restaurants.length === 0) {
        hideNotificationLoader();
        return;
      }
      const targetRestaurant = restaurants.find(r => r.restaurant_id && r.restaurant_id.toString() === restaurantId.toString());
      if (!targetRestaurant) {
        hideNotificationLoader();
        notificationHandledRef.current = false;
        return;
      }
      setNotificationMessage(`Switching to ${targetRestaurant.restaurant_name}...`);
      const needToSwitch = !selectedRestaurant || selectedRestaurant.restaurant_id.toString() !== restaurantId.toString();
      if (needToSwitch) {
        await switchRestaurant(targetRestaurant);
        setNotificationMessage(`Loading orders for ${targetRestaurant.restaurant_name}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setNotificationMessage('Fetching order details...');
      await fetchOrdersForRestaurant(restaurantId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const restaurantOrders = ordersData[restaurantId] || [];
      const targetOrder = restaurantOrders.find(order => order.order_number && order.order_number.toString() === orderNumber.toString());
      if (targetOrder) {
        hideNotificationLoader();
        setTimeout(() => {
          openOrderModal(targetOrder);
          setNotificationOrderId(null);
          setNotificationRestaurantId(null);
          notificationHandledRef.current = false;
        }, 500);
      } else {
        setNotificationMessage('Searching for order...');
        setTimeout(async () => {
          await fetchOrdersForRestaurant(restaurantId);
          setTimeout(() => {
            const updatedOrders = ordersData[restaurantId] || [];
            const foundOrder = updatedOrders.find(order => order.order_number && order.order_number.toString() === orderNumber.toString());
            if (foundOrder) {
              hideNotificationLoader();
              openOrderModal(foundOrder);
              setNotificationOrderId(null);
              setNotificationRestaurantId(null);
            } else {
              hideNotificationLoader();
              Alert.alert('Order Not Found', 'The order from notification could not be found.', [{ text: 'OK' }]);
            }
            notificationHandledRef.current = false;
          }, 1000);
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error navigating to order:', error);
      hideNotificationLoader();
      Alert.alert('Navigation Error', 'Could not navigate to the order from notification.', [{ text: 'OK' }]);
      notificationHandledRef.current = false;
    }
  }, [restaurants, ordersData, selectedRestaurant, switchRestaurant, fetchOrdersForRestaurant, hideNotificationLoader, openOrderModal]);

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
        if (selectedRestaurant && !pollingIntervalRef.current) startPolling();
        if (notificationDataRef.current && !notificationDataRef.current.processed) {
          handleNotificationData(notificationDataRef.current.data);
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      if (backgroundPollingRef.current) clearInterval(backgroundPollingRef.current);
    };
  }, [selectedRestaurant, notificationDataRef, startBackgroundPolling, startPolling, handleNotificationData]);

  // Compute filtered orders using useMemo
  useMemo(() => {
    if (!selectedRestaurant) {
      setFilteredOrders([]);
      return;
    }
    const restaurantOrders = ordersData[selectedRestaurant.restaurant_id] || [];
    let result = restaurantOrders.filter(order => {
      if (selectedFilter !== 'all') {
        if (selectedFilter === 'payment_failed') return order.status === 'payment_failed';
        return order.status === selectedFilter;
      }
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          order.order_number.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.phoneNumber?.toLowerCase().includes(query) ||
          order.items.some(item => item.name.toLowerCase().includes(query))
        );
      }
      return true;
    });
    setFilteredOrders(result);
  }, [ordersData, selectedRestaurant, selectedFilter, searchQuery]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      clearInterval(pollingIntervalRef.current);
      if (backgroundPollingRef.current) clearInterval(backgroundPollingRef.current);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  // Initial data load
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
  }, [fetchUserData, fetchRestaurants]);

  // Start polling when restaurant changes
  useEffect(() => {
    if (!selectedRestaurant || isRestaurantChanging) return;
    if (lastRestaurantIdRef.current !== selectedRestaurant.restaurant_id) {
      lastRestaurantIdRef.current = selectedRestaurant.restaurant_id;
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      startPolling();
    }
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedRestaurant?.restaurant_id, startPolling, isRestaurantChanging]);

  // ---------- INITIAL LOADING SCREEN ----------
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.partnerOrderDetailsContainer}>
        <View style={styles.partnerOrderDetailsFullscreenLoader}>
          <Icon name="restaurant" size={scaleSize(60)} color="#F07119" />
          <Text style={styles.partnerOrderDetailsLoadingTitle}>Eatoor Partner</Text>
          <Text style={styles.partnerOrderDetailsLoadingSubtitle}>Loading your restaurants...</Text>
          <ActivityIndicator size="large" color="#F07119" style={styles.partnerOrderDetailsLoadingSpinner} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !user.id) {
    return (
      <SafeAreaView style={styles.partnerOrderDetailsContainer}>
        <View style={styles.partnerOrderDetailsEmptyContainer}>
          <Icon name="person-circle-outline" size={scaleSize(60)} color="#9CA3AF" />
          <Text style={styles.partnerOrderDetailsEmptyTitle}>Authentication Required</Text>
          <Text style={styles.partnerOrderDetailsEmptyText}>Please login to access partner features.</Text>
          <TouchableOpacity style={styles.partnerOrderDetailsRetryButton} onPress={onRefresh}>
            <Icon name="refresh" size={scaleSize(16)} color="#fff" />
            <Text style={styles.partnerOrderDetailsRetryButtonText}>Login & Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (restaurants.length === 0) {
    return (
      <SafeAreaView style={styles.partnerOrderDetailsContainer}>
        <ScrollView
          contentContainerStyle={styles.partnerOrderDetailsScrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F07119']} tintColor="#F07119" />}
        >
          <View style={styles.partnerOrderDetailsEmptyContainer}>
            <Icon name="restaurant-outline" size={scaleSize(60)} color="#9CA3AF" />
            <Text style={styles.partnerOrderDetailsEmptyTitle}>No Restaurants Found</Text>
            <Text style={styles.partnerOrderDetailsEmptyText}>You don't have any restaurants setup yet.</Text>
            <TouchableOpacity style={styles.partnerOrderDetailsRetryButton} onPress={onRefresh}>
              <Icon name="refresh" size={scaleSize(16)} color="#fff" />
              <Text style={styles.partnerOrderDetailsRetryButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------- MAIN RENDER ----------
  return (
    <SafeAreaView style={styles.partnerOrderDetailsContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Data Loading Overlay */}
      {dataLoading && (
        <View style={styles.partnerOrderDetailsDataLoadingOverlay}>
          <ActivityIndicator size="large" color="#F07119" />
          <Text style={styles.partnerOrderDetailsDataLoadingText}>Loading data...</Text>
        </View>
      )}

      {/* Orders Loading Overlay */}
      {ordersLoading && selectedRestaurant && (
        <View style={styles.partnerOrderDetailsOrdersLoadingOverlay}>
          <View style={styles.partnerOrderDetailsOrdersLoadingContainer}>
            <ActivityIndicator size="small" color="#F07119" />
            <Text style={styles.partnerOrderDetailsOrdersLoadingText}>Updating orders...</Text>
          </View>
        </View>
      )}

      {/* Notification Loader Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={notificationLoading}
        onRequestClose={hideNotificationLoader}
        statusBarTranslucent={true}
      >
        <View style={styles.partnerOrderDetailsLoaderModalOverlay}>
          <View style={styles.partnerOrderDetailsLoaderModalContainer}>
            <ActivityIndicator size="large" color="#F07119" />
            <Text style={styles.partnerOrderDetailsLoaderModalText}>{notificationMessage}</Text>
            <Text style={styles.partnerOrderDetailsLoaderModalSubtext}>Please wait...</Text>
          </View>
        </View>
      </Modal>

      {/* ==================== UPDATED HEADER ==================== */}
      <View style={styles.partnerOrderDetailsHeaderWrapper}>
        <View style={styles.partnerOrderDetailsHeaderContainer}>
          {/* Top Row: Back, Restaurant Selector, Status Toggle */}
          <View style={styles.partnerOrderDetailsHeaderTopRow}>
            <TouchableOpacity style={styles.partnerOrderDetailsBackButton} onPress={handleBackPress} activeOpacity={0.7}>
              <Icon name="arrow-back" size={scaleSize(24)} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.partnerOrderDetailsRestaurantSelector}
              onPress={() => setShowRestaurantModal(true)}
              activeOpacity={0.7}
              disabled={isRestaurantChanging || dataLoading}
            >
              <View style={styles.partnerOrderDetailsRestaurantSelectorContent}>
                <View style={styles.partnerOrderDetailsRestaurantSelectorLeft}>
                  {selectedRestaurant ? (
                    <>
                      <View style={styles.partnerOrderDetailsRestaurantAvatar}>
                        <Image
                          source={{ uri: selectedRestaurant.profile_image }}
                          style={styles.partnerOrderDetailsRestaurantAvatarImage}
                          defaultSource={{ uri: 'https://via.placeholder.com/40' }}
                        />
                        <View style={[styles.partnerOrderDetailsRestaurantStatusIndicator, { backgroundColor: RESTAURANT_STATUS_COLORS[selectedRestaurant.status] }]} />
                      </View>
                      <View style={styles.partnerOrderDetailsRestaurantInfoContainer}>
                        <Text style={styles.partnerOrderDetailsRestaurantName} numberOfLines={1}>
                          {selectedRestaurant.restaurant_name}
                        </Text>
                        <Text style={styles.partnerOrderDetailsRestaurantDetails} numberOfLines={1}>
                          {getCuisineString(selectedRestaurant.cuisines)} • {getLocationString(selectedRestaurant.location)}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.partnerOrderDetailsNoRestaurantText}>Select a restaurant</Text>
                  )}
                </View>
                {isRestaurantChanging || dataLoading ? (
                  <ActivityIndicator size="small" color="#F07119" />
                ) : (
                  <Icon name="chevron-down" size={scaleSize(18)} color="#6B7280" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.partnerOrderDetailsHeaderActions}>
              {userPermissions.canManageRestaurant && (
                <TouchableOpacity
                  style={[
                    styles.partnerOrderDetailsStatusToggle,
                    { backgroundColor: selectedRestaurant?.status === 'online' ? '#10B981' : '#EF4444' }
                  ]}
                  onPress={toggleRestaurantStatus}
                  disabled={updatingRestaurantStatus || isRestaurantChanging || dataLoading}
                >
                  {updatingRestaurantStatus ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <View style={[styles.partnerOrderDetailsStatusDot, { backgroundColor: '#fff' }]} />
                      <Text style={styles.partnerOrderDetailsStatusToggleText}>
                        {RESTAURANT_STATUS_DISPLAY[selectedRestaurant?.status] || 'Offline'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Bottom Row: Always-visible Search Bar */}
          <View style={styles.partnerOrderDetailsHeaderBottomRow}>
            <View style={styles.partnerOrderDetailsSearchContainer}>
              <View style={styles.partnerOrderDetailsSearchInputContainer}>
                <Icon name="search" size={scaleSize(18)} color="#9CA3AF" style={styles.partnerOrderDetailsSearchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.partnerOrderDetailsSearchInput}
                  placeholder="Search orders..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  enablesReturnKeyAutomatically={true}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={handleSearchClear} style={styles.partnerOrderDetailsClearButton}>
                    <Icon name="close-circle" size={scaleSize(18)} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
      {/* ==================== END UPDATED HEADER ==================== */}

      {/* Search Results Info */}
      {searchQuery.trim() !== '' && (
        <View style={styles.partnerOrderDetailsSearchResultsInfo}>
          <Text style={styles.partnerOrderDetailsSearchResultsText} numberOfLines={1}>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found for "{searchQuery}"
          </Text>
          <TouchableOpacity onPress={handleSearchClear}>
            <Text style={styles.partnerOrderDetailsClearSearchText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.partnerOrderDetailsKeyboardAvoidView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? scaleSize(100) : scaleSize(20)}
      >
        <ScrollView
          contentContainerStyle={[styles.partnerOrderDetailsContentContainer, { paddingBottom: Platform.OS === 'ios' ? scaleSize(100) : scaleSize(20) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F07119']} tintColor="#F07119" />}
          keyboardShouldPersistTaps="handled"
        >
          {/* ---------- STATS CONTAINER ---------- */}
          <View style={styles.partnerOrderDetailsStatsContainer}>
            <View style={styles.partnerOrderDetailsStatsHeader}>
              <Text style={styles.partnerOrderDetailsStatsHeaderTitle}>Today's Overview</Text>
              <TouchableOpacity style={styles.partnerOrderDetailsSettlementButton} onPress={navigateToSettlement} activeOpacity={0.7}>
                <Icon name="wallet-outline" size={scaleSize(16)} color="#F07119" />
                <Text style={styles.partnerOrderDetailsSettlementButtonText}>Settlement</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.partnerOrderDetailsStatsGrid}>
            </View>

            {/* Status Breakdown Bar */}
            <View style={styles.partnerOrderDetailsStatusBreakdown}>
              <View style={styles.partnerOrderDetailsStatusBreakdownItem}>
                <View style={[styles.partnerOrderDetailsStatusDotSmall, { backgroundColor: STATUS_COLORS.pending }]} />
                <Text style={styles.partnerOrderDetailsStatusCount}>{stats.pending}</Text>
                <Text style={styles.partnerOrderDetailsStatusLabel}>Pending</Text>
              </View>
              <View style={styles.partnerOrderDetailsStatusBreakdownItem}>
                <View style={[styles.partnerOrderDetailsStatusDotSmall, { backgroundColor: STATUS_COLORS.preparing }]} />
                <Text style={styles.partnerOrderDetailsStatusCount}>{stats.preparing}</Text>
                <Text style={styles.partnerOrderDetailsStatusLabel}>Preparing</Text>
              </View>
              <View style={styles.partnerOrderDetailsStatusBreakdownItem}>
                <View style={[styles.partnerOrderDetailsStatusDotSmall, { backgroundColor: STATUS_COLORS.ready }]} />
                <Text style={styles.partnerOrderDetailsStatusCount}>{stats.ready}</Text>
                <Text style={styles.partnerOrderDetailsStatusLabel}>Ready</Text>
              </View>
              <View style={styles.partnerOrderDetailsStatusBreakdownItem}>
                <View style={[styles.partnerOrderDetailsStatusDotSmall, { backgroundColor: STATUS_COLORS.on_the_way }]} />
                <Text style={styles.partnerOrderDetailsStatusCount}>{stats.onTheWay}</Text>
                <Text style={styles.partnerOrderDetailsStatusLabel}>On Way</Text>
              </View>
            </View>

            <View style={styles.partnerOrderDetailsLastUpdatedContainer}>
              <Icon name="time-outline" size={scaleSize(12)} color="rgba(107,114,128,0.7)" />
              <Text style={styles.partnerOrderDetailsLastUpdatedText}>Updated {formatLastUpdated()}</Text>
            </View>
          </View>

          {/* ---------- FILTER CHIPS ---------- */}
          <View style={styles.partnerOrderDetailsFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partnerOrderDetailsFilterScrollContainer}>
              {FILTER_OPTIONS.map(({ id, label, icon }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.partnerOrderDetailsFilterButton, selectedFilter === id && styles.partnerOrderDetailsFilterButtonActive]}
                  onPress={() => setSelectedFilter(id)}
                  disabled={dataLoading || ordersLoading}
                >
                  <Icon name={icon} size={scaleSize(14)} color={selectedFilter === id ? '#fff' : '#6B7280'} />
                  <Text style={[styles.partnerOrderDetailsFilterButtonText, selectedFilter === id && styles.partnerOrderDetailsFilterButtonTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ---------- ORDERS SECTION ---------- */}
          <View style={styles.partnerOrderDetailsSectionContainer}>
            <View style={styles.partnerOrderDetailsSectionHeader}>
              <View>
                <Text style={styles.partnerOrderDetailsSectionTitle}>
                  {selectedFilter === 'all' ? 'All Orders' : FILTER_OPTIONS.find(f => f.id === selectedFilter)?.label || 'Orders'}
                  {searchQuery.trim() !== '' && ' (Filtered)'}
                </Text>
                {selectedRestaurant && (
                  <Text style={styles.partnerOrderDetailsSectionSubtitle}>
                    {selectedRestaurant.restaurant_name} • {filteredOrders.length} orders
                  </Text>
                )}
              </View>
              <View style={styles.partnerOrderDetailsSectionCountBadge}>
                <Text style={styles.partnerOrderDetailsSectionCount}>{filteredOrders.length}</Text>
              </View>
            </View>

            {filteredOrders.length > 0 ? (
              <FlatList
                data={filteredOrders}
                renderItem={({ item }) => {
                  const statusColor = STATUS_COLORS[item.status] || '#6B7280';
                  return (
                    <TouchableOpacity
                      style={[styles.partnerOrderDetailsOrderCard, { borderLeftColor: statusColor }]}
                      onPress={() => openOrderModal(item)}
                      activeOpacity={0.7}
                      disabled={dataLoading || ordersLoading}
                    >
                      <View style={styles.partnerOrderDetailsOrderCardHeader}>
                        <View style={styles.partnerOrderDetailsOrderCardHeaderLeft}>
                          <Text style={styles.partnerOrderDetailsOrderNumber}>{item.order_number}</Text>
                          <Text style={styles.partnerOrderDetailsOrderTime} numberOfLines={1}>
                            {item.orderTime} • {item.customerName}
                          </Text>
                        </View>
                        <View style={[styles.partnerOrderDetailsOrderStatusBadge, { backgroundColor: `${statusColor}15` }]}>
                          <View style={[styles.partnerOrderDetailsOrderStatusDot, { backgroundColor: statusColor }]} />
                          <Text style={[styles.partnerOrderDetailsOrderStatusText, { color: statusColor }]}>
                            {STATUS_DISPLAY_MAP[item.status] || item.status}
                          </Text>
                        </View>
                      </View>
                      {item.urgency === 'urgent' && (
                        <View style={styles.partnerOrderDetailsUrgentBadge}>
                          <Icon name="flash" size={scaleSize(8)} color="#fff" />
                          <Text style={styles.partnerOrderDetailsUrgentText}>URGENT</Text>
                        </View>
                      )}
                      {item.status === 'payment_failed' && (
                        <View style={[styles.partnerOrderDetailsUrgentBadge, { backgroundColor: '#DC2626' }]}>
                          <Icon name="alert-circle" size={scaleSize(8)} color="#fff" />
                          <Text style={styles.partnerOrderDetailsUrgentText}>PAYMENT FAILED</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
                keyExtractor={(item) => item.uniqueId}
                scrollEnabled={false}
                contentContainerStyle={styles.partnerOrderDetailsOrdersList}
                extraData={[selectedFilter, filteredOrders.length]}
              />
            ) : (
              <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.partnerOrderDetailsEmptyState}>
                  {dataLoading || ordersLoading ? (
                    <>
                      <ActivityIndicator size="large" color="#F07119" style={styles.partnerOrderDetailsEmptyStateLoader} />
                      <Text style={styles.partnerOrderDetailsEmptyStateTitle}>
                        {dataLoading ? 'Loading data...' : 'Updating orders...'}
                      </Text>
                      <Text style={styles.partnerOrderDetailsEmptyStateText}>Please wait while we fetch the latest information</Text>
                    </>
                  ) : (
                    <>
                      <Icon
                        name={
                          !selectedRestaurant || selectedRestaurant.status === 'offline'
                            ? 'power-outline'
                            : searchQuery.trim() !== ''
                              ? 'search-outline'
                              : 'fast-food-outline'
                        }
                        size={scaleSize(50)}
                        color="#D1D5DB"
                      />
                      <Text style={styles.partnerOrderDetailsEmptyStateTitle}>
                        {searchQuery.trim() !== ''
                          ? 'No Search Results'
                          : !selectedRestaurant || selectedRestaurant.status === 'offline'
                            ? 'Restaurant Offline'
                            : 'No Orders Found'}
                      </Text>
                      <Text style={styles.partnerOrderDetailsEmptyStateText}>
                        {searchQuery.trim() !== ''
                          ? `No orders found for "${searchQuery}"`
                          : !selectedRestaurant
                            ? 'Please select a restaurant'
                            : selectedRestaurant.status === 'offline'
                              ? 'Go online to start accepting orders'
                              : selectedFilter === 'pending'
                                ? 'No pending orders at the moment'
                                : selectedFilter === 'preparing'
                                  ? 'No orders in preparation'
                                  : selectedFilter === 'ready'
                                    ? 'No orders ready for pickup'
                                    : selectedFilter === 'on_the_way'
                                      ? 'No orders on the way'
                                      : selectedFilter === 'delivered'
                                        ? 'No delivered orders yet'
                                        : selectedFilter === 'cancelled'
                                          ? 'No cancelled orders'
                                          : selectedFilter === 'refunded'
                                            ? 'No refunded orders'
                                            : 'No orders found for the selected filter'}
                      </Text>
                      {searchQuery.trim() !== '' && (
                        <TouchableOpacity style={[styles.partnerOrderDetailsSimulateSmallButton, { backgroundColor: '#6B7280' }]} onPress={handleSearchClear}>
                          <Icon name="close-circle" size={scaleSize(16)} color="#fff" />
                          <Text style={styles.partnerOrderDetailsSimulateSmallButtonText}>Clear Search</Text>
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

      {/* ---------- RESTAURANT SELECTION MODAL ---------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showRestaurantModal}
        onRequestClose={() => setShowRestaurantModal(false)}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={() => setShowRestaurantModal(false)}>
          <View style={styles.partnerOrderDetailsModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.partnerOrderDetailsRestaurantModalContainer}>
                <View style={styles.partnerOrderDetailsRestaurantModalHeader}>
                  <Text style={styles.partnerOrderDetailsRestaurantModalTitle}>Select Restaurant</Text>
                  <TouchableOpacity style={styles.partnerOrderDetailsCloseButton} onPress={() => setShowRestaurantModal(false)}>
                    <Icon name="close" size={scaleSize(20)} color="#374151" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={restaurants}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.partnerOrderDetailsRestaurantItem, selectedRestaurant?.restaurant_id === item.restaurant_id && styles.partnerOrderDetailsRestaurantItemSelected]}
                      onPress={() => switchRestaurant(item)}
                      disabled={isRestaurantChanging || dataLoading}
                    >
                      <Image
                        source={{ uri: item.profile_image }}
                        style={styles.partnerOrderDetailsRestaurantImage}
                        defaultSource={{ uri: 'https://via.placeholder.com/60' }}
                      />
                      <View style={styles.partnerOrderDetailsRestaurantInfo}>
                        <Text style={styles.partnerOrderDetailsRestaurantItemName} numberOfLines={1}>
                          {item.restaurant_name}
                        </Text>
                        <Text style={styles.partnerOrderDetailsRestaurantItemCuisine} numberOfLines={1}>
                          {getCuisineString(item.cuisines)}
                        </Text>
                        <Text style={styles.partnerOrderDetailsRestaurantItemLocation} numberOfLines={1}>
                          {getLocationString(item.location)}
                        </Text>
                        <View style={styles.partnerOrderDetailsRestaurantItemStats}>
                          <View style={styles.partnerOrderDetailsRestaurantStat}>
                            <Icon name="cart-outline" size={scaleSize(10)} color="#6B7280" />
                            <Text style={styles.partnerOrderDetailsRestaurantStatText}>{item.ordersToday || 0} orders</Text>
                          </View>
                          {userPermissions.canSeeRevenue && (
                            <View style={styles.partnerOrderDetailsRestaurantStat}>
                              <Icon name="cash-outline" size={scaleSize(10)} color="#6B7280" />
                              <Text style={styles.partnerOrderDetailsRestaurantStatText}>₹{item.revenue || 0}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.partnerOrderDetailsRestaurantItemRight}>
                        <View style={[styles.partnerOrderDetailsRestaurantStatusBadge, { backgroundColor: `${RESTAURANT_STATUS_COLORS[item.status]}15` }]}>
                          <View style={[styles.partnerOrderDetailsRestaurantStatusDot, { backgroundColor: RESTAURANT_STATUS_COLORS[item.status] }]} />
                          <Text style={[styles.partnerOrderDetailsRestaurantStatusText, { color: RESTAURANT_STATUS_COLORS[item.status] }]}>
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
                  contentContainerStyle={styles.partnerOrderDetailsRestaurantList}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.partnerOrderDetailsModalEmptyState}>
                      <Icon name="restaurant-outline" size={scaleSize(40)} color="#9CA3AF" />
                      <Text style={styles.partnerOrderDetailsModalEmptyText}>No restaurants available</Text>
                    </View>
                  }
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ---------- ORDER DETAILS MODAL ---------- */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showOrderModal}
        onRequestClose={() => {
          setShowOrderModal(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={styles.partnerOrderDetailsModalOverlay}>
          <View style={styles.partnerOrderDetailsModalContainer}>
            <View style={[styles.partnerOrderDetailsModalHeader, currentOrder?.urgency === 'urgent' && styles.partnerOrderDetailsModalHeaderUrgent]}>
              <View style={styles.partnerOrderDetailsModalHeaderContent}>
                <View>
                  <Text style={styles.partnerOrderDetailsModalTitle}>Order Details</Text>
                  {currentOrder?.status === 'payment_failed' && (
                    <Text style={[styles.partnerOrderDetailsModalSubtitle, { color: '#DC2626' }]}>⚠️ Payment Failed</Text>
                  )}
                  {updatingStatus && (
                    <Text style={[styles.partnerOrderDetailsModalSubtitle, { color: '#F07119' }]}>Updating status...</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.partnerOrderDetailsCloseButton}
                  onPress={() => {
                    setShowOrderModal(false);
                  }}
                  disabled={updatingStatus}
                >
                  <Icon name="close" size={scaleSize(20)} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.partnerOrderDetailsModalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Order Status Card */}
              <View style={styles.partnerOrderDetailsOrderStatusCard}>
                <View style={[styles.partnerOrderDetailsOrderStatusHeader, { backgroundColor: `${STATUS_COLORS[currentOrder?.status]}15` }]}>
                  <View style={[styles.partnerOrderDetailsOrderStatusIcon, { backgroundColor: STATUS_COLORS[currentOrder?.status] }]}>
                    <Icon
                      name={
                        currentOrder?.status === 'pending'
                          ? 'time-outline'
                          : currentOrder?.status === 'confirmed'
                            ? 'checkmark-circle'
                            : currentOrder?.status === 'preparing'
                              ? 'fast-food'
                              : currentOrder?.status === 'ready'
                                ? 'cube'
                                : currentOrder?.status === 'on_the_way'
                                  ? 'car'
                                  : currentOrder?.status === 'delivered'
                                    ? 'checkmark-done'
                                    : currentOrder?.status === 'cancelled'
                                      ? 'close-circle'
                                      : currentOrder?.status === 'payment_failed'
                                        ? 'alert-circle'
                                        : 'arrow-undo'
                      }
                      size={scaleSize(18)}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.partnerOrderDetailsOrderStatusInfo}>
                    <Text style={styles.partnerOrderDetailsOrderStatusText}>{STATUS_DISPLAY_MAP[currentOrder?.status] || 'Unknown Status'}</Text>
                    <Text style={styles.partnerOrderDetailsOrderStatusSubtext}>
                      {currentOrder?.order_number} • {currentOrder?.orderTime}
                    </Text>
                  </View>
                  {userPermissions.canSeeRevenue && (
                    <Text style={[styles.partnerOrderDetailsOrderAmountLarge, { color: STATUS_COLORS[currentOrder?.status] }]}>
                      ₹{currentOrder?.totalAmount}
                    </Text>
                  )}
                </View>
              </View>

              {/* Customer Details */}
              <View style={styles.partnerOrderDetailsDetailSection}>
                <Text style={styles.partnerOrderDetailsDetailSectionTitle}>Customer Details</Text>
                <View style={styles.partnerOrderDetailsDetailCard}>
                  <View style={styles.partnerOrderDetailsDetailRow}>
                    <Icon name="person-outline" size={scaleSize(14)} color="#6B7280" />
                    <Text style={styles.partnerOrderDetailsDetailText}>{currentOrder?.customerName}</Text>
                  </View>
                  {!isLimitedUser && currentOrder?.phoneNumber && (
                    <View style={styles.partnerOrderDetailsDetailRow}>
                      <Icon name="call-outline" size={scaleSize(14)} color="#6B7280" />
                      <Text style={styles.partnerOrderDetailsDetailText}>{currentOrder.phoneNumber}</Text>
                    </View>
                  )}
                  <View style={styles.partnerOrderDetailsDetailRow}>
                    <Icon name="location-outline" size={scaleSize(14)} color="#6B7280" />
                    <Text style={styles.partnerOrderDetailsDetailText} numberOfLines={2}>{currentOrder?.deliveryAddress}</Text>
                  </View>
                  {currentOrder?.paymentStatus && (
                    <View style={styles.partnerOrderDetailsDetailRow}>
                      <Icon name="card-outline" size={scaleSize(14)} color="#6B7280" />
                      <Text style={styles.partnerOrderDetailsDetailText}>Payment: {currentOrder.paymentStatus}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Order Items */}
              <View style={styles.partnerOrderDetailsDetailSection}>
                <Text style={styles.partnerOrderDetailsDetailSectionTitle}>Order Items</Text>
                <View style={styles.partnerOrderDetailsDetailCard}>
                  <FlatList
                    data={currentOrder?.items || []}
                    renderItem={({ item }) => (
                      <View style={styles.partnerOrderDetailsOrderItem}>
                        <View style={styles.partnerOrderDetailsOrderItemLeft}>
                          <Text style={styles.partnerOrderDetailsOrderItemName}>
                            {item.quantity} <Text>x</Text> {item.name}
                            {item.buy_one_get_one_free && <Text style={styles.partnerOrderDetailsBogoText}> (B1G1)</Text>}
                          </Text>
                        </View>
                        <Text style={styles.partnerOrderDetailsOrderItemPrice}>₹{item.total_price || item.unit_price}</Text>
                      </View>
                    )}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                  />
                  {/* Order total – shown only if user has permission */}
                  {userPermissions.canSeeRevenue && (
                    <View style={styles.partnerOrderDetailsOrderTotal}>
                      <View style={styles.partnerOrderDetailsTotalRow}>
                        <Text style={styles.partnerOrderDetailsTotalLabel}>Subtotal</Text>
                        <Text style={styles.partnerOrderDetailsTotalValue}>₹{Math.round((currentOrder?.subtotal || 0))}</Text>
                      </View>
                      <View style={styles.partnerOrderDetailsTotalRow}>
                        <Text style={styles.partnerOrderDetailsTotalLabel}>Delivery</Text>
                        <Text style={styles.partnerOrderDetailsTotalValue}>₹{Math.round((currentOrder?.deliveryFee || 0))}</Text>
                      </View>
                      <View style={[styles.partnerOrderDetailsTotalRow, styles.partnerOrderDetailsGrandTotalRow]}>
                        <Text style={styles.partnerOrderDetailsGrandTotalLabel}>Total</Text>
                        <Text style={styles.partnerOrderDetailsGrandTotalValue}>₹{currentOrder?.totalAmount}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Special Instructions */}
              {currentOrder?.specialInstructions && (
                <View style={styles.partnerOrderDetailsDetailSection}>
                  <Text style={styles.partnerOrderDetailsDetailSectionTitle}>Special Instructions</Text>
                  <View style={[styles.partnerOrderDetailsDetailCard, styles.partnerOrderDetailsInstructionsCard]}>
                    <Icon name="document-text-outline" size={scaleSize(16)} color="#F59E0B" />
                    <Text style={styles.partnerOrderDetailsInstructionsText}>{currentOrder?.specialInstructions}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons – hidden for final statuses */}
            {currentOrder?.status &&
              currentOrder.status !== 'delivered' &&
              currentOrder.status !== 'cancelled' &&
              currentOrder.status !== 'refunded' &&
              currentOrder.status !== 'payment_failed' && (
              <View style={styles.partnerOrderDetailsActionButtons}>
                {userPermissions.canCancelOrders && (
                  !(userRole === 1 && ['on_the_way', 'delivered', 'cancelled', 'refunded', 'payment_failed'].includes(currentOrder.status)) && (
                    <TouchableOpacity
                      style={[styles.partnerOrderDetailsActionButton, styles.partnerOrderDetailsCancelButton]}
                      onPress={handleCancelOrder}
                      activeOpacity={0.8}
                      disabled={updatingStatus}
                    >
                      {updatingStatus ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Icon name="close-circle" size={scaleSize(16)} color="#fff" />
                          <Text style={styles.partnerOrderDetailsCancelButtonText}>Cancel</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )
                )}
                {(() => {
                  const buttonConfig = getStatusButtonConfig();
                  if (!buttonConfig) return null;
                  const isDisabled = userRole === 1 && currentOrder?.status === 'ready';
                  return (
                    <TouchableOpacity
                      style={[
                        styles.partnerOrderDetailsActionButton,
                        styles.partnerOrderDetailsStatusUpdateButton,
                        { backgroundColor: isDisabled ? '#9CA3AF' : buttonConfig.color, flex: userPermissions.canCancelOrders && !(userRole === 1 && ['on_the_way', 'delivered', 'cancelled', 'refunded', 'payment_failed'].includes(currentOrder.status)) ? 1.5 : 2 },
                      ]}
                      onPress={() => handleUpdateOrderStatus(buttonConfig.nextStatus)}
                      activeOpacity={0.8}
                      disabled={updatingStatus || isDisabled}
                    >
                      {updatingStatus ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Icon
                            name={
                              buttonConfig.nextStatus === 'confirmed'
                                ? 'checkmark-circle'
                                : buttonConfig.nextStatus === 'preparing'
                                  ? 'fast-food'
                                  : buttonConfig.nextStatus === 'ready'
                                    ? 'cube'
                                    : buttonConfig.nextStatus === 'on_the_way'
                                      ? 'car'
                                      : buttonConfig.nextStatus === 'delivered'
                                        ? 'checkmark-done'
                                        : 'checkmark-circle'
                            }
                            size={scaleSize(16)}
                            color="#fff"
                          />
                          <Text style={styles.partnerOrderDetailsStatusUpdateButtonText}>{isDisabled ? 'Not Allowed' : buttonConfig.text}</Text>
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
              currentOrder?.status === 'refunded' ||
              currentOrder?.status === 'payment_failed') && (
              <View style={styles.partnerOrderDetailsFinalStatusActions}>
                <View style={[styles.partnerOrderDetailsFinalStatusCard, { backgroundColor: `${STATUS_COLORS[currentOrder.status]}15` }]}>
                  <Icon
                    name={
                      currentOrder.status === 'delivered'
                        ? 'checkmark-done-circle'
                        : currentOrder.status === 'cancelled'
                          ? 'close-circle'
                          : currentOrder.status === 'payment_failed'
                            ? 'alert-circle'
                            : 'arrow-undo-circle'
                    }
                    size={scaleSize(30)}
                    color={STATUS_COLORS[currentOrder.status]}
                  />
                  <Text style={[styles.partnerOrderDetailsFinalStatusTitle, { color: STATUS_COLORS[currentOrder.status] }]}>
                    {STATUS_DISPLAY_MAP[currentOrder.status]}
                  </Text>
                  <Text style={styles.partnerOrderDetailsFinalStatusSubtitle}>
                    {currentOrder.status === 'delivered'
                      ? 'Order has been delivered successfully'
                      : currentOrder.status === 'cancelled'
                        ? 'Order has been cancelled'
                        : currentOrder.status === 'payment_failed'
                          ? 'Payment failed'
                          : 'Order has been refunded'}
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

// -------------------- STYLES (unchanged) --------------------
const styles = StyleSheet.create({
  partnerOrderDetailsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  partnerOrderDetailsKeyboardAvoidView: {
    flex: 1,
  },
  partnerOrderDetailsScrollContainer: {
    flexGrow: 1,
  },
  partnerOrderDetailsContentContainer: {
    paddingTop: Platform.OS === 'ios' ? scaleSize(150) : scaleSize(140),
    paddingBottom: Platform.OS === 'ios' ? scaleSize(100) : scaleSize(20),
  },
  partnerOrderDetailsFullscreenLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  partnerOrderDetailsLoadingTitle: {
    fontSize: scaleFont(28),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(8),
    letterSpacing: -0.5,
  },
  partnerOrderDetailsLoadingSubtitle: {
    fontSize: scaleFont(16),
    color: '#6B7280',
    marginBottom: scaleSize(30),
  },
  partnerOrderDetailsLoadingSpinner: {
    marginTop: scaleSize(20),
  },
  partnerOrderDetailsDataLoadingOverlay: {
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
  partnerOrderDetailsDataLoadingText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#111827',
    marginTop: scaleSize(16),
  },
  partnerOrderDetailsOrdersLoadingOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? scaleSize(150) : scaleSize(140),
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 999,
    paddingVertical: scaleSize(10),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  partnerOrderDetailsOrdersLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerOrderDetailsOrdersLoadingText: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    marginLeft: scaleSize(10),
  },
  partnerOrderDetailsHeaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? scaleSize(50) : scaleSize(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.12,
    shadowRadius: scaleSize(8),
    elevation: 6,
  },
  partnerOrderDetailsHeaderContainer: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 0 : scaleSize(42),
    paddingBottom: scaleSize(12),
    paddingHorizontal: scaleSize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  partnerOrderDetailsHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scaleSize(10),
  },
  partnerOrderDetailsHeaderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partnerOrderDetailsBackButton: {
    padding: scaleSize(4),
    marginRight: scaleSize(8),
  },
  partnerOrderDetailsRestaurantSelector: {
    flex: 1,
    marginHorizontal: scaleSize(8),
  },
  partnerOrderDetailsRestaurantSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partnerOrderDetailsRestaurantSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  partnerOrderDetailsRestaurantAvatar: {
    width: scaleSize(40),
    height: scaleSize(40),
    borderRadius: scaleSize(20),
    backgroundColor: '#E5E7EB',
    marginRight: scaleSize(12),
    overflow: 'hidden',
    position: 'relative',
  },
  partnerOrderDetailsRestaurantAvatarImage: {
    width: '100%',
    height: '100%',
  },
  partnerOrderDetailsRestaurantStatusIndicator: {
    position: 'absolute',
    bottom: scaleSize(2),
    right: scaleSize(2),
    width: scaleSize(10),
    height: scaleSize(10),
    borderRadius: scaleSize(5),
    borderWidth: scaleSize(2),
    borderColor: '#fff',
  },
  partnerOrderDetailsRestaurantInfoContainer: {
    flex: 1,
    minWidth: 0,
  },
  partnerOrderDetailsRestaurantName: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#111827',
    lineHeight: scaleSize(20),
  },
  partnerOrderDetailsRestaurantDetails: {
    fontSize: scaleFont(12),
    color: '#6B7280',
    marginTop: scaleSize(2),
    lineHeight: scaleSize(16),
  },
  partnerOrderDetailsNoRestaurantText: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    fontStyle: 'italic',
  },
  partnerOrderDetailsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerOrderDetailsStatusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(6),
    borderRadius: scaleSize(20),
    minWidth: scaleSize(80),
    height: scaleSize(32),
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(2) },
    shadowOpacity: 0.1,
    shadowRadius: scaleSize(4),
    elevation: 2,
  },
  partnerOrderDetailsStatusDot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(6),
  },
  partnerOrderDetailsStatusToggleText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
    color: '#fff',
  },
  partnerOrderDetailsSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerOrderDetailsSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(12),
    paddingHorizontal: scaleSize(12),
    paddingVertical: scaleSize(8),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partnerOrderDetailsSearchIcon: {
    marginRight: scaleSize(8),
  },
  partnerOrderDetailsSearchInput: {
    flex: 1,
    fontSize: scaleFont(14),
    color: '#111827',
    paddingVertical: 0,
    minHeight: scaleSize(20),
  },
  partnerOrderDetailsClearButton: {
    padding: scaleSize(4),
    marginLeft: scaleSize(4),
  },
  partnerOrderDetailsSearchResultsInfo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? scaleSize(150) : scaleSize(140),
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
  partnerOrderDetailsSearchResultsText: {
    fontSize: scaleFont(12),
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
    marginRight: scaleSize(8),
  },
  partnerOrderDetailsClearSearchText: {
    fontSize: scaleFont(12),
    color: '#F07119',
    fontWeight: '600',
  },
  partnerOrderDetailsLoaderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerOrderDetailsLoaderModalContainer: {
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
  partnerOrderDetailsLoaderModalText: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: '#111827',
    marginTop: scaleSize(20),
    textAlign: 'center',
    lineHeight: scaleSize(22),
  },
  partnerOrderDetailsLoaderModalSubtext: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    marginTop: scaleSize(8),
    textAlign: 'center',
  },
  partnerOrderDetailsStatsContainer: {
    marginHorizontal: scaleSize(16),
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: scaleSize(20),
    padding: scaleSize(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scaleSize(4) },
    shadowOpacity: 0.08,
    shadowRadius: scaleSize(12),
    elevation: 4,
  },
  partnerOrderDetailsStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(12),
  },
  partnerOrderDetailsStatsHeaderTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#111827',
  },
  partnerOrderDetailsSettlementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: scaleSize(14),
    paddingVertical: scaleSize(8),
    borderRadius: scaleSize(20),
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  partnerOrderDetailsSettlementButtonText: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#D97706',
    marginLeft: scaleSize(6),
  },
  partnerOrderDetailsStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: scaleSize(16),
  },
  partnerOrderDetailsStatCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(16),
    padding: scaleSize(16),
    marginBottom: scaleSize(12),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partnerOrderDetailsStatIconContainer: {
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
  partnerOrderDetailsStatValue: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(4),
  },
  partnerOrderDetailsStatLabel: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  partnerOrderDetailsStatusBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(12),
    padding: scaleSize(14),
    marginBottom: scaleSize(14),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partnerOrderDetailsStatusBreakdownItem: {
    alignItems: 'center',
    flex: 1,
  },
  partnerOrderDetailsStatusDotSmall: {
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
  partnerOrderDetailsStatusCount: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(2),
  },
  partnerOrderDetailsStatusLabel: {
    fontSize: scaleFont(10),
    color: '#6B7280',
    fontWeight: '500',
  },
  partnerOrderDetailsLastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: scaleSize(12),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  partnerOrderDetailsLastUpdatedText: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    marginLeft: scaleSize(6),
  },
  partnerOrderDetailsFilterContainer: {
    marginTop: scaleSize(16),
    marginHorizontal: scaleSize(16),
  },
  partnerOrderDetailsFilterScrollContainer: {
    paddingRight: scaleSize(16),
  },
  partnerOrderDetailsFilterButton: {
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
  partnerOrderDetailsFilterButtonActive: {
    backgroundColor: '#F07119',
    borderColor: '#F07119',
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(6),
    elevation: 4,
  },
  partnerOrderDetailsFilterButtonText: {
    fontSize: scaleFont(12),
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: scaleSize(6),
  },
  partnerOrderDetailsFilterButtonTextActive: {
    color: '#fff',
  },
  partnerOrderDetailsSectionContainer: {
    paddingHorizontal: scaleSize(16),
    marginTop: scaleSize(20),
    marginBottom: scaleSize(20),
  },
  partnerOrderDetailsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scaleSize(16),
  },
  partnerOrderDetailsSectionTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  partnerOrderDetailsSectionSubtitle: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginTop: scaleSize(4),
  },
  partnerOrderDetailsSectionCountBadge: {
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
  partnerOrderDetailsSectionCount: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#fff',
  },
  partnerOrderDetailsOrdersList: {
    paddingBottom: scaleSize(16),
  },
  partnerOrderDetailsOrderCard: {
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
  partnerOrderDetailsOrderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scaleSize(10),
  },
  partnerOrderDetailsOrderCardHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  partnerOrderDetailsOrderNumber: {
    fontSize: scaleFont(15),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  partnerOrderDetailsOrderTime: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginTop: scaleSize(4),
  },
  partnerOrderDetailsOrderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(10),
    paddingVertical: scaleSize(5),
    borderRadius: scaleSize(10),
    marginLeft: scaleSize(8),
  },
  partnerOrderDetailsOrderStatusDot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(5),
  },
  partnerOrderDetailsOrderStatusText: {
    fontSize: scaleFont(11),
    fontWeight: '700',
  },
  partnerOrderDetailsOrderItemsPreview: {
    marginBottom: scaleSize(10),
  },
  partnerOrderDetailsOrderItemPreview: {
    fontSize: scaleFont(14),
    color: '#4B5563',
    marginBottom: scaleSize(3),
  },
  partnerOrderDetailsMoreItems: {
    fontSize: scaleFont(12),
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  partnerOrderDetailsOrderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerOrderDetailsOrderAmount: {
    fontSize: scaleFont(18),
    fontWeight: '800',
    color: '#111827',
  },
  partnerOrderDetailsDeliveryTime: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    fontWeight: '500',
  },
  partnerOrderDetailsUrgentBadge: {
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
  partnerOrderDetailsUrgentText: {
    color: '#fff',
    fontSize: scaleFont(9),
    fontWeight: '800',
    marginLeft: scaleSize(2),
    letterSpacing: 0.5,
  },
  partnerOrderDetailsEmptyState: {
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
  partnerOrderDetailsEmptyStateLoader: {
    marginBottom: scaleSize(20),
  },
  partnerOrderDetailsEmptyStateTitle: {
    fontSize: scaleFont(18),
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: scaleSize(20),
    marginBottom: scaleSize(8),
  },
  partnerOrderDetailsEmptyStateText: {
    fontSize: scaleFont(14),
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: scaleSize(20),
    paddingHorizontal: scaleSize(20),
  },
  partnerOrderDetailsSimulateSmallButton: {
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
  partnerOrderDetailsSimulateSmallButtonText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginLeft: scaleSize(6),
  },
  partnerOrderDetailsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  partnerOrderDetailsRestaurantModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSize(24),
    borderTopRightRadius: scaleSize(24),
    maxHeight: height * 0.8,
  },
  partnerOrderDetailsRestaurantModalHeader: {
    paddingTop: scaleSize(24),
    paddingBottom: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerOrderDetailsRestaurantModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  partnerOrderDetailsRestaurantList: {
    padding: scaleSize(20),
  },
  partnerOrderDetailsModalEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scaleSize(50),
  },
  partnerOrderDetailsModalEmptyText: {
    fontSize: scaleFont(15),
    color: '#9CA3AF',
    marginTop: scaleSize(16),
  },
  partnerOrderDetailsRestaurantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: scaleSize(16),
    borderRadius: scaleSize(16),
    marginBottom: scaleSize(10),
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  partnerOrderDetailsRestaurantItemSelected: {
    borderWidth: 2,
    borderColor: '#F07119',
    backgroundColor: '#FFFBEB',
  },
  partnerOrderDetailsRestaurantImage: {
    width: scaleSize(56),
    height: scaleSize(56),
    borderRadius: scaleSize(12),
    marginRight: scaleSize(14),
  },
  partnerOrderDetailsRestaurantInfo: {
    flex: 1,
    minWidth: 0,
  },
  partnerOrderDetailsRestaurantItemName: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#111827',
    marginBottom: scaleSize(4),
  },
  partnerOrderDetailsRestaurantItemCuisine: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginBottom: scaleSize(4),
  },
  partnerOrderDetailsRestaurantItemLocation: {
    fontSize: scaleFont(11),
    color: '#9CA3AF',
    marginBottom: scaleSize(8),
  },
  partnerOrderDetailsRestaurantItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerOrderDetailsRestaurantStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scaleSize(12),
  },
  partnerOrderDetailsRestaurantStatText: {
    fontSize: scaleFont(11),
    color: '#6B7280',
    marginLeft: scaleSize(4),
  },
  partnerOrderDetailsRestaurantItemRight: {
    alignItems: 'flex-end',
    marginLeft: scaleSize(8),
  },
  partnerOrderDetailsRestaurantStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scaleSize(8),
    paddingVertical: scaleSize(4),
    borderRadius: scaleSize(12),
    marginBottom: scaleSize(8),
  },
  partnerOrderDetailsRestaurantStatusDot: {
    width: scaleSize(6),
    height: scaleSize(6),
    borderRadius: scaleSize(3),
    marginRight: scaleSize(5),
  },
  partnerOrderDetailsRestaurantStatusText: {
    fontSize: scaleFont(10),
    fontWeight: '700',
  },
  partnerOrderDetailsModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scaleSize(24),
    borderTopRightRadius: scaleSize(24),
    maxHeight: height * 0.85,
  },
  partnerOrderDetailsModalHeader: {
    paddingTop: scaleSize(24),
    paddingBottom: scaleSize(16),
    paddingHorizontal: scaleSize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  partnerOrderDetailsModalHeaderUrgent: {
    borderBottomWidth: 2,
    borderBottomColor: '#EF4444',
  },
  partnerOrderDetailsModalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  partnerOrderDetailsModalTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  partnerOrderDetailsModalSubtitle: {
    fontSize: scaleFont(13),
    color: '#EF4444',
    marginTop: scaleSize(6),
    fontWeight: '600',
  },
  partnerOrderDetailsCloseButton: {
    padding: scaleSize(4),
  },
  partnerOrderDetailsModalBody: {
    padding: scaleSize(20),
    maxHeight: height * 0.6,
  },
  partnerOrderDetailsOrderStatusCard: {
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
  partnerOrderDetailsOrderStatusHeader: {
    padding: scaleSize(20),
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerOrderDetailsOrderStatusIcon: {
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
  partnerOrderDetailsOrderStatusInfo: {
    flex: 1,
    minWidth: 0,
  },
  partnerOrderDetailsOrderStatusSubtext: {
    fontSize: scaleFont(13),
    color: '#6B7280',
    marginTop: scaleSize(4),
  },
  partnerOrderDetailsOrderAmountLarge: {
    fontSize: scaleFont(20),
    fontWeight: '800',
  },
  partnerOrderDetailsDetailSection: {
    marginBottom: scaleSize(20),
  },
  partnerOrderDetailsDetailSectionTitle: {
    fontSize: scaleFont(16),
    fontWeight: '700',
    color: '#111827',
    marginBottom: scaleSize(12),
    letterSpacing: -0.3,
  },
  partnerOrderDetailsDetailCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: scaleSize(14),
    padding: scaleSize(16),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  partnerOrderDetailsDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleSize(10),
  },
  partnerOrderDetailsDetailText: {
    fontSize: scaleFont(14),
    color: '#374151',
    marginLeft: scaleSize(10),
    flex: 1,
  },
  partnerOrderDetailsOrderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  partnerOrderDetailsOrderItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  partnerOrderDetailsOrderItemName: {
    flex: 1,
    fontSize: 15,
    color: '#444',
    lineHeight: 20,
  },
  partnerOrderDetailsOrderItemPrice: {
    fontSize: scaleFont(15),
    fontWeight: '600',
    color: '#111827',
    flexShrink: 0,
    marginLeft: scaleSize(12),
  },
  partnerOrderDetailsOrderTotal: {
    marginTop: scaleSize(16),
    paddingTop: scaleSize(16),
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
  },
  partnerOrderDetailsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scaleSize(6),
  },
  partnerOrderDetailsTotalLabel: {
    fontSize: scaleFont(13),
    color: '#6B7280',
  },
  partnerOrderDetailsTotalValue: {
    fontSize: scaleFont(13),
    fontWeight: '600',
    color: '#374151',
  },
  partnerOrderDetailsGrandTotalRow: {
    marginTop: scaleSize(8),
    paddingTop: scaleSize(10),
    borderTopWidth: 1.5,
    borderTopColor: '#D1D5DB',
  },
  partnerOrderDetailsGrandTotalLabel: {
    fontSize: scaleFont(16),
    fontWeight: '800',
    color: '#111827',
  },
  partnerOrderDetailsGrandTotalValue: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    color: '#F07119',
  },
  partnerOrderDetailsInstructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  partnerOrderDetailsInstructionsText: {
    fontSize: scaleFont(14),
    color: '#92400E',
    lineHeight: scaleSize(20),
    marginLeft: scaleSize(12),
    flex: 1,
    fontStyle: 'italic',
  },
  partnerOrderDetailsActionButtons: {
    flexDirection: 'row',
    padding: scaleSize(20),
    paddingTop: scaleSize(16),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  partnerOrderDetailsActionButton: {
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
  partnerOrderDetailsStatusUpdateButton: {
    backgroundColor: '#10B981',
  },
  partnerOrderDetailsStatusUpdateButtonText: {
    color: '#fff',
    fontSize: scaleFont(15),
    fontWeight: '600',
    marginLeft: scaleSize(8),
  },
  partnerOrderDetailsCancelButton: {
    backgroundColor: '#EF4444',
  },
  partnerOrderDetailsCancelButtonText: {
    color: '#fff',
    fontSize: scaleFont(15),
    fontWeight: '600',
    marginLeft: scaleSize(8),
  },
  partnerOrderDetailsFinalStatusActions: {
    padding: scaleSize(20),
    paddingTop: scaleSize(16),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  partnerOrderDetailsFinalStatusCard: {
    alignItems: 'center',
    padding: scaleSize(28),
    borderRadius: scaleSize(16),
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  partnerOrderDetailsFinalStatusTitle: {
    fontSize: scaleFont(20),
    fontWeight: '800',
    marginTop: scaleSize(16),
    marginBottom: scaleSize(8),
  },
  partnerOrderDetailsFinalStatusSubtitle: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: scaleSize(20),
  },
  partnerOrderDetailsBogoText: {
    color: '#2E7D32',
    fontSize: scaleFont(12),
    fontWeight: '700',
  },
  partnerOrderDetailsEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleSize(20),
  },
  partnerOrderDetailsEmptyTitle: {
    fontSize: scaleFont(20),
    fontWeight: '700',
    color: '#111827',
    marginTop: scaleSize(20),
    marginBottom: scaleSize(8),
  },
  partnerOrderDetailsEmptyText: {
    fontSize: scaleFont(14),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: scaleSize(20),
    marginBottom: scaleSize(20),
  },
  partnerOrderDetailsRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F07119',
    paddingHorizontal: scaleSize(20),
    paddingVertical: scaleSize(12),
    borderRadius: scaleSize(12),
    shadowColor: '#F07119',
    shadowOffset: { width: 0, height: scaleSize(3) },
    shadowOpacity: 0.3,
    shadowRadius: scaleSize(6),
    elevation: 3,
  },
  partnerOrderDetailsRetryButtonText: {
    color: '#fff',
    fontSize: scaleFont(14),
    fontWeight: '600',
    marginLeft: scaleSize(8),
  },
});

export default PartnerScreen;