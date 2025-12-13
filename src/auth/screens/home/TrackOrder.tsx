import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  Image, 
  Dimensions, 
  Animated, 
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Easing,
  Vibration,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Circle } from 'react-native-maps';
import { getOrderDetails, getLiveTrackingDetails } from '../../../api/profile';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Optional: Install react-native-haptic-feedback for better haptics
// npm install react-native-haptic-feedback
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Constants
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const SMALL_MAP_HEIGHT = 320;
const EXPANDED_MAP_HEIGHT = height * 0.75;
const CARD_WIDTH = width - 40;
const HEADER_HEIGHT = Platform.OS === 'ios' ? 90 : 70;
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;
const CARD_PADDING = 20;
const CARD_RADIUS = 24;
const CARD_MARGIN = 20;
const CARD_MARGIN_BOTTOM = 16;

// Responsive font sizes
const getResponsiveFontSize = (baseSize: number) => {
  const scale = Math.min(width / 375, 1.2);
  const newSize = baseSize * scale;
  return Math.round(newSize);
};

// Delivery status constants
const DELIVERY_STATUS = {
  PENDING: 'Pending',
  ORDERED: 'Ordered',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  ON_THE_WAY: 'On the Way',
  DELIVERED: 'Delivered'
};

const STATUS_COLORS = {
  [DELIVERY_STATUS.PENDING]: '#FF6B35',
  [DELIVERY_STATUS.ORDERED]: '#FF6B35',
  [DELIVERY_STATUS.CONFIRMED]: '#4A90E2',
  [DELIVERY_STATUS.PREPARING]: '#FFA726',
  [DELIVERY_STATUS.ON_THE_WAY]: '#4A90E2',
  [DELIVERY_STATUS.DELIVERED]: '#2ECC71'
};

const STATUS_GRADIENTS = {
  [DELIVERY_STATUS.PENDING]: ['#FF6B35', '#FF8A65'],
  [DELIVERY_STATUS.ORDERED]: ['#FF6B35', '#FF8A65'],
  [DELIVERY_STATUS.CONFIRMED]: ['#4A90E2', '#64B5F6'],
  [DELIVERY_STATUS.PREPARING]: ['#FFA726', '#FFB74D'],
  [DELIVERY_STATUS.ON_THE_WAY]: ['#4A90E2', '#64B5F6'],
  [DELIVERY_STATUS.DELIVERED]: ['#2ECC71', '#4CD964']
};

interface LiveTrackingData {
  user_destination: {
    lat: number;
    lng: number;
  };
  restaurant_location: {
    lat: number;
    lng: number;
  };
  deliver_agent_location: {
    lat: number | null;
    lng: number | null;
  };
  estimated_time_minutes: number | null;
  porter_agent_assign_status: string | null;
  porter_tracking_details: any | null;
}

interface OrderItem {
  item_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  buy_one_get_one_free: boolean;
  image?: string;
  description?: string;
}

interface PaymentMethodChecks {
  eatoor_wallet_used: boolean;
  online_payment_used: boolean;
  wallet_payment_amount: number;
  wallet_payment_method: string | null;
  online_payment_method: string | null;
  online_payment_amount: number;
  online_transaction_id: string | null;
  cod_payment_used: boolean;
  cod_payment_pending: number;
}

interface DeliveryAddress {
  full_name: string;
  address: string;
  landmark: string;
  home_type: string;
  phone_number: string;
}

interface RestaurantDetails {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_address_line: string;
  restaurant_image: string;
  restaurant_contact: string;
}

interface PaymentDetails {
  subtotal: string;
  delivery_fee: number;
  total: string;
  payment_status: string;
  order_status: string;
}

interface CouponDetails {
  coupon_code: string | null;
  coupon_discount: number;
  coupon_code_text: string;
}

interface Order {
  order_number: string;
  placed_on: string;
  estimated_delivery: string;
  review_present: boolean;
  items: OrderItem[];
  delivery_address: DeliveryAddress;
  restaurant_details: RestaurantDetails;
  payment_details: PaymentDetails;
  coupon_details_details: CouponDetails;
  payment_method_checks: PaymentMethodChecks;
}

// Haptic feedback helper function
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    if (ReactNativeHapticFeedback) {
      const hapticTypes = {
        light: 'impactLight',
        medium: 'impactMedium',
        heavy: 'impactHeavy'
      };
      ReactNativeHapticFeedback.trigger(hapticTypes[type], {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false
      });
    } else {
      const vibrationPatterns = {
        light: 50,
        medium: 100,
        heavy: 150
      };
      Vibration.vibrate(vibrationPatterns[type]);
    }
  } catch (error) {
    console.log('Haptic feedback not available');
  }
};

// Date formatting function for IST
const formatDate = (dateString: string, formatType: 'full' | 'date' | 'time' | 'datetime' = 'full') => {
  try {
    if (!dateString) return '';
    
    // Convert the date string to ISO format
    const isoString = dateString.replace(' ', 'T') + 'Z';
    const date = new Date(isoString);
    
    // Options for different formats
    const options: any = {
      timeZone: 'Asia/Kolkata',
      hour12: true,
    };
    
    // Set options based on format type
    switch (formatType) {
      case 'full':
        options.day = '2-digit';
        options.month = 'long';
        options.year = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
      case 'date':
        options.day = '2-digit';
        options.month = 'short';
        options.year = 'numeric';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      case 'datetime':
        options.day = '2-digit';
        options.month = 'short';
        options.year = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
      default:
        options.day = '2-digit';
        options.month = 'long';
        options.year = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    const formatted = date.toLocaleString('en-IN', options);
    return formatted;
  } catch (e) {
    console.error('Date formatting error:', e);
    return dateString;
  }
};

// Format date for header display (shorter version)
const formatHeaderDate = (dateString: string) => {
  try {
    if (!dateString) return '';
    
    const isoString = dateString.replace(' ', 'T') + 'Z';
    const date = new Date(isoString);
    
    // Format: "DD MMM, hh:mm AM/PM"
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    
    return formatted;
  } catch (e) {
    console.error('Date formatting error:', e);
    return '';
  }
};

// Format time only
const formatTime = (dateString: string) => {
  try {
    if (!dateString) return '';
    
    const isoString = dateString.replace(' ', 'T') + 'Z';
    const date = new Date(isoString);
    
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    
    return formatted;
  } catch (e) {
    console.error('Time formatting error:', e);
    return '';
  }
};

// Format date and time without seconds
const formatDateTime = (dateString: string) => {
  try {
    if (!dateString) return '';
    
    const isoString = dateString.replace(' ', 'T') + 'Z';
    const date = new Date(isoString);
    
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    
    return formatted;
  } catch (e) {
    console.error('DateTime formatting error:', e);
    return '';
  }
};

// Get relative time (e.g., "5 min ago")
const getRelativeTime = (dateString: string) => {
  try {
    if (!dateString) return '';
    
    const isoString = dateString.replace(' ', 'T') + 'Z';
    const pastDate = new Date(isoString);
    const currentDate = new Date();
    
    // Convert both dates to IST
    const istPastDate = new Date(pastDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const istCurrentDate = new Date(currentDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const diffMs = istCurrentDate.getTime() - istPastDate.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffMin < 1) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    } else {
      return formatDateTime(dateString);
    }
  } catch (e) {
    console.error('Relative time error:', e);
    return '';
  }
};

// Loading Animation Component
const LoadingAnimation = () => {
  const [rotation] = useState(new Animated.Value(0));
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.loadingAnimationContainer}>
      <View style={styles.loadingBikeContainer}>
        <Animated.View style={[styles.loadingBike, { transform: [{ rotate: spin }] }]}>
          <Icon name="bicycle" size={60} color="#FF6B35" />
        </Animated.View>
      </View>
      <View style={styles.loadingDots}>
        <Animated.View style={[styles.loadingDot, styles.dot1]} />
        <Animated.View style={[styles.loadingDot, styles.dot2]} />
        <Animated.View style={[styles.loadingDot, styles.dot3]} />
      </View>
    </View>
  );
};

const TrackOrder = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { order_number, prev_location } = route?.params?.order || {};
  
  const mapRef = useRef(null);
  const scrollViewRef = useRef(null);
  
  // Animation values
  const [mapAnimation] = useState(new Animated.Value(0));
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [deliveryAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [distance, setDistance] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState(DELIVERY_STATUS.PENDING);
  const [eta, setEta] = useState('30-40 mins');
  const [coordinates, setCoordinates] = useState<{
    restaurant: { latitude: number; longitude: number; title: string };
    delivery: { latitude: number; longitude: number; title: string };
    agent?: { latitude: number; longitude: number; title: string } | null;
  } | null>(null);
  const [liveTrackingData, setLiveTrackingData] = useState<LiveTrackingData | null>(null);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [rotationAngleValue, setRotationAngleValue] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  
  // Layout states
  const [currentMapHeight, setCurrentMapHeight] = useState(SMALL_MAP_HEIGHT);
  const [isInfoVisible, setIsInfoVisible] = useState(true);
  
  const ANIMATION_DURATION = 350;

  // Delivery partner details
  const [deliveryPartner, setDeliveryPartner] = useState({
    name: 'Delivery Partner',
    phone: '+918108662484',
    vehicle: 'Bike',
    rating: 4.5,
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    deliveries: 1240
  });

  // Pulse animation for live tracking
  useEffect(() => {
    if (deliveryStatus === DELIVERY_STATUS.ON_THE_WAY) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1200,
            easing: Easing.ease,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.ease,
            useNativeDriver: true
          })
        ])
      );
      pulseAnimation.start();
      
      return () => {
        pulseAnimation.stop();
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [deliveryStatus, pulseAnim]);

  // Initial fade in animation with staggered delay
  useEffect(() => {
    if (!loading) {
      Animated.stagger(100, [
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic)
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic)
        })
      ]).start();
    }
  }, [loading, fadeAnim, scaleAnim]);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const deg2rad = (deg: number) => deg * (Math.PI/180);

  // Calculate distance between two points in meters
  const calculateDistanceBetweenPoints = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2 - lat1) * Math.PI/180;
    const Δλ = (lon2 - lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Calculate route coordinates based on status
  const calculateRouteCoordinates = useCallback(() => {
    if (!coordinates) return [];
    
    let route = [];
    
    if (coordinates.agent) {
      // When agent is "On the Way": restaurant → agent → customer
      route = [
        {
          latitude: coordinates.restaurant.latitude,
          longitude: coordinates.restaurant.longitude
        },
        {
          latitude: coordinates.agent.latitude,
          longitude: coordinates.agent.longitude
        },
        {
          latitude: coordinates.delivery.latitude,
          longitude: coordinates.delivery.longitude
        }
      ];
    } else {
      // For other statuses: restaurant → customer (direct path)
      route = [
        {
          latitude: coordinates.restaurant.latitude,
          longitude: coordinates.restaurant.longitude
        },
        {
          latitude: coordinates.delivery.latitude,
          longitude: coordinates.delivery.longitude
        }
      ];
    }
    
    return route;
  }, [coordinates, deliveryStatus]);

  // Update route when coordinates or status changes
  useEffect(() => {
    if (coordinates) {
      const newRoute = calculateRouteCoordinates();
      setRouteCoordinates(newRoute);
    }
  }, [coordinates, deliveryStatus, calculateRouteCoordinates]);

  // Calculate agent rotation angle
  const calculateAgentRotation = useCallback(() => {
    if (!coordinates || !coordinates.agent) return;
    
    // Calculate bearing from restaurant to agent
    const restaurant = coordinates.restaurant;
    const agent = coordinates.agent;
    
    const y = Math.sin(agent.longitude - restaurant.longitude) * Math.cos(agent.latitude);
    const x = Math.cos(restaurant.latitude) * Math.sin(agent.latitude) -
             Math.sin(restaurant.latitude) * Math.cos(agent.latitude) * 
             Math.cos(agent.longitude - restaurant.longitude);
    const bearing = Math.atan2(y, x);
    const angle = bearing * (180 / Math.PI);
    setRotationAngleValue(angle);
  }, [coordinates]);

  // Function to handle phone calls
  const handleAddressCall = (phoneNumber: string) => {
    triggerHaptic('medium');
    
    if (!phoneNumber) {
      Alert.alert('Error', 'Phone number not available');
      return;
    }

    // Clean phone number - remove any non-digit characters
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanPhoneNumber.length < 10) {
      Alert.alert('Error', 'Invalid phone number');
      return;
    }

    const phoneUrl = Platform.select({
      android: `tel:${cleanPhoneNumber}`,
      ios: `telprompt:${cleanPhoneNumber}`
    });

    Linking.canOpenURL(phoneUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Error', 'Unable to make a call on this device');
        }
      })
      .catch(err => {
        console.error('Error making call:', err);
        Alert.alert('Error', 'Failed to make call');
      });
  };

  // Fetch live tracking data
  const fetchLiveTrackingData = useCallback(async (showLoader = false) => {
    try {
      if (!order_number) return;

      const payload = {
        "order_id": order_number
      };
      
      const response = await getLiveTrackingDetails(payload);
      
      if (response.status === 200) {
        const data = response.data;
        setLiveTrackingData(data);
        
        if (data.user_destination && data.restaurant_location) {
          const newCoordinates = {
            restaurant: {
              latitude: data.restaurant_location.lat,
              longitude: data.restaurant_location.lng,
              title: 'Restaurant'
            },
            delivery: {
              latitude: data.user_destination.lat,
              longitude: data.user_destination.lng,
              title: 'Your Location'
            }
          };
          
          if (data.deliver_agent_location?.lat && data.deliver_agent_location?.lng) {
            newCoordinates.agent = {
              latitude: data.deliver_agent_location.lat,
              longitude: data.deliver_agent_location.lng,
              title: 'Delivery Partner'
            };
          } else {
            newCoordinates.agent = null;
          }
          
          setCoordinates(newCoordinates);
          
          if (data.user_destination && data.restaurant_location) {
            const dist = calculateDistance(
              data.restaurant_location.lat,
              data.restaurant_location.lng,
              data.user_destination.lat,
              data.user_destination.lng
            );
            setDistance(`${dist.toFixed(1)} km`);
          }
          
          if (data.estimated_time_minutes) {
            setEta(`${data.estimated_time_minutes + 10} mins`);
          }
          
          if (data.porter_agent_assign_status === 'assigned') {
            setDeliveryStatus(DELIVERY_STATUS.ON_THE_WAY);
          } else if (data.porter_agent_assign_status === 'delivered') {
            setDeliveryStatus(DELIVERY_STATUS.DELIVERED);
          }
          
          if (data.porter_tracking_details) {
            setDeliveryPartner(prev => ({
              ...prev,
              name: data.porter_tracking_details.delivery_person_name || prev.name,
              phone: data.porter_tracking_details.delivery_person_contact || prev.phone,
              vehicle: data.porter_tracking_details.vehicle_type || prev.vehicle,
              rating: data.porter_tracking_details.rating || prev.rating,
              deliveries: data.porter_tracking_details.total_deliveries || prev.deliveries
            }));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live tracking data:', err);
      if (showLoader) {
        Alert.alert('Error', 'Failed to fetch tracking data');
      }
    }
  }, [order_number]);

  // Fetch order details
  const fetchOrderDetails = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (!userData) throw new Error('User not logged in');

      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);

      const response = await getOrderDetails({
        order_number,
        user_id: parsedUser.id
      });

      if (response.status === 200 && response.data.orders?.length > 0) {
        const orderData = response.data.orders[0];
        setOrder(orderData);

        // Map API order status to delivery status
        const orderStatus = orderData.payment_details?.order_status;
        
        switch (orderStatus?.toLowerCase()) {
          case 'pending':
            setDeliveryStatus(DELIVERY_STATUS.PENDING);
            break;
          case 'confirmed':
            setDeliveryStatus(DELIVERY_STATUS.CONFIRMED);
            break;
          case 'preparing':
            setDeliveryStatus(DELIVERY_STATUS.PREPARING);
            break;
          case 'on the way':
          case 'out for delivery':
            setDeliveryStatus(DELIVERY_STATUS.ON_THE_WAY);
            break;
          case 'delivered':
            setDeliveryStatus(DELIVERY_STATUS.DELIVERED);
            break;
          default:
            setDeliveryStatus(DELIVERY_STATUS.PENDING);
        }
        
        // Calculate ETA
        const placedTime = new Date(orderData.placed_on.replace(' ', 'T') + 'Z');
        const estimatedTime = new Date(orderData.estimated_delivery.replace(' ', 'T') + 'Z');
        const diffMinutes = Math.floor((estimatedTime.getTime() - placedTime.getTime()) / (1000 * 60));
        
        if (!isNaN(diffMinutes)) {
          setEta(`${diffMinutes} mins`);
        }
      } else {
        throw new Error('No order data available');
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      if (!order) {
        setError(err.message);
      }
    }
  }, [order_number, order]);

  // Combined data fetching function
  const fetchAllData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setRefreshing(true);
        triggerHaptic('light');
      }

      await Promise.all([
        fetchOrderDetails(),
        fetchLiveTrackingData(showLoader)
      ]);
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching all data:', err);
      if (showLoader) {
        Alert.alert('Error', 'Failed to refresh data');
      }
    } finally {
      if (showLoader) {
        setRefreshing(false);
      }
      setLoading(false);
    }
  }, [fetchOrderDetails, fetchLiveTrackingData]);

  // Manual refresh function
  const onRefresh = useCallback(async () => {
    await fetchAllData(true);
  }, [fetchAllData]);

  // Initial data fetch and auto-refresh setup
  useEffect(() => {
    fetchAllData(true);

    const interval = setInterval(() => {
      fetchAllData(false);
    }, 60000);

    setTrackingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [order_number]);

  // Update agent rotation when coordinates change
  useEffect(() => {
    if (coordinates && coordinates.agent) {
      calculateAgentRotation();
    }
  }, [coordinates, calculateAgentRotation]);

  // Map expand/collapse function
  const toggleMap = useCallback(() => {
    triggerHaptic('medium');
    
    LayoutAnimation.configureNext({
      duration: ANIMATION_DURATION,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    
    if (isMapExpanded) {
      // Collapse map
      setCurrentMapHeight(SMALL_MAP_HEIGHT);
      setIsInfoVisible(true);
      setIsMapExpanded(false);
      
      // Scroll to top
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    } else {
      // Expand map
      setCurrentMapHeight(EXPANDED_MAP_HEIGHT);
      setIsInfoVisible(false);
      setIsMapExpanded(true);
      
      // Fit all markers in view when expanded
      if (coordinates) {
        setTimeout(() => {
          const coordsToFit = [
            coordinates.restaurant,
            coordinates.delivery
          ];
          if (coordinates.agent) {
            coordsToFit.push(coordinates.agent);
          }
          
          mapRef.current?.fitToCoordinates(coordsToFit, {
            edgePadding: { top: 100, right: 50, bottom: 150, left: 50 },
            animated: true
          });
        }, 150);
      }
    }
  }, [isMapExpanded, coordinates]);

  // Status details
  const getStatusDetails = () => {
    const currentGradient = STATUS_GRADIENTS[deliveryStatus] || ['#666', '#999'];
    
    switch(deliveryStatus) {
      case DELIVERY_STATUS.PENDING:
        return {
          title: 'Order placed',
          subtitle: 'Your order has been received',
          icon: 'receipt-outline',
          step: 1,
          color: STATUS_COLORS[DELIVERY_STATUS.PENDING],
          gradient: currentGradient,
          bgColor: 'rgba(255, 107, 53, 0.1)'
        };
      case DELIVERY_STATUS.CONFIRMED:
        return {
          title: 'Order confirmed',
          subtitle: order ? `Restaurant confirmed your order` : 'Order confirmed',
          icon: 'checkmark-circle-outline',
          step: 1.5,
          color: STATUS_COLORS[DELIVERY_STATUS.CONFIRMED],
          gradient: currentGradient,
          bgColor: 'rgba(74, 144, 226, 0.1)'
        };
      case DELIVERY_STATUS.PREPARING:
        return {
          title: 'Preparing your order',
          subtitle: order ? `At ${order.restaurant_details?.restaurant_name || 'Restaurant'}` : 'Being prepared',
          icon: 'restaurant-outline',
          step: 2,
          color: STATUS_COLORS[DELIVERY_STATUS.PREPARING],
          gradient: currentGradient,
          bgColor: 'rgba(255, 167, 38, 0.1)'
        };
      case DELIVERY_STATUS.ON_THE_WAY:
        return {
          title: 'On the way',
          subtitle: `With ${deliveryPartner.name}`,
          icon: 'bicycle-outline',
          step: 3,
          color: STATUS_COLORS[DELIVERY_STATUS.ON_THE_WAY],
          gradient: currentGradient,
          bgColor: 'rgba(74, 144, 226, 0.1)'
        };
      case DELIVERY_STATUS.DELIVERED:
        return {
          title: 'Delivered',
          subtitle: 'Your order has arrived',
          icon: 'checkmark-done-outline',
          step: 4,
          color: STATUS_COLORS[DELIVERY_STATUS.DELIVERED],
          gradient: currentGradient,
          bgColor: 'rgba(46, 204, 113, 0.1)'
        };
      default:
        return {
          title: 'Order placed',
          subtitle: 'Your order has been received',
          icon: 'time-outline',
          step: 0,
          color: '#9E9E9E',
          gradient: ['#666', '#999'],
          bgColor: 'rgba(158, 158, 158, 0.1)'
        };
    }
  };

  const statusDetails = getStatusDetails();

  // Handle calls with haptic feedback
  const handleCall = (number: string) => {
    triggerHaptic('medium');
    
    if (!number) {
      Alert.alert('Error', 'Contact number not available');
      return;
    }

    const phoneNumber = Platform.select({
      android: `tel:${number}`,
      ios: `telprompt:${number}`
    });

    Linking.canOpenURL(phoneNumber)
      .then(supported => supported ? Linking.openURL(phoneNumber) : null)
      .catch(() => Alert.alert('Error', 'Failed to make call'));
  };

  // Handle navigation
  const handleNavigate = () => {
    triggerHaptic('light');
    if (coordinates?.delivery) {
      const url = Platform.select({
        ios: `maps://?daddr=${coordinates.delivery.latitude},${coordinates.delivery.longitude}`,
        android: `google.navigation:q=${coordinates.delivery.latitude},${coordinates.delivery.longitude}`
      });
      
      Linking.canOpenURL(url)
        .then(supported => {
          if (supported) {
            Linking.openURL(url);
          } else {
            const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.delivery.latitude},${coordinates.delivery.longitude}`;
            Linking.openURL(fallbackUrl);
          }
        })
        .catch(err => console.error('Error opening maps:', err));
    }
  };

  // Function to render payment breakdown based on payment_method_checks
  const renderPaymentBreakdown = () => {
    if (!order?.payment_method_checks) return null;

    const { 
      eatoor_wallet_used, 
      online_payment_used, 
      wallet_payment_amount, 
      wallet_payment_method, 
      online_payment_method, 
      online_payment_amount,
      online_transaction_id,
      cod_payment_used,
      cod_payment_pending
    } = order.payment_method_checks;

    const totalAmount = parseFloat(order.payment_details?.total || '0');
    
    // Case 1: Only Wallet Payment
    if (eatoor_wallet_used && !online_payment_used && !cod_payment_used) {
      return (
        <>
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
              <Icon name="wallet-outline" size={20} color="#9C27B0" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {wallet_payment_method || 'Eatoor Money'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Wallet payment
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#9C27B0' }]}>
              ₹{parseFloat(wallet_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.paidIndicator}>
            <Icon name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.paidText}>Paid via Wallet</Text>
          </View>
        </>
      );
    }
    
    // Case 2: Only Online Payment
    if (!eatoor_wallet_used && online_payment_used && !cod_payment_used) {
      return (
        <>
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
              <Icon name="card-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {online_payment_method || 'Online Payment'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Online payment
                {online_transaction_id && (
                  <Text style={styles.transactionIdText}>
                    ID: {online_transaction_id}
                  </Text>
                )}
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#4CAF50' }]}>
              ₹{parseFloat(online_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.paidIndicator}>
            <Icon name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.paidText}>
              Paid via {online_payment_method || 'Online Payment'}
            </Text>
          </View>
        </>
      );
    }
    
    // Case 3: Both Wallet and Online Payment
    if (eatoor_wallet_used && online_payment_used && !cod_payment_used) {
      return (
        <>
          {/* Wallet Payment Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
              <Icon name="wallet-outline" size={20} color="#9C27B0" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {wallet_payment_method || 'Eatoor Money'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Wallet payment
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#9C27B0' }]}>
              ₹{parseFloat(wallet_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          {/* Online Payment Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
              <Icon name="card-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {online_payment_method || 'Online Payment'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Online payment
                {online_transaction_id && (
                  <Text style={styles.transactionIdText}>
                    • ID: {online_transaction_id}
                  </Text>
                )}
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#4CAF50' }]}>
              ₹{parseFloat(online_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.paidIndicator}>
            <Icon name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.paidText}>
              Paid via Wallet + {online_payment_method || 'Online'}
            </Text>
          </View>
        </>
      );
    }
    
    // Case 4: Only Cash on Delivery
    if (!eatoor_wallet_used && !online_payment_used && cod_payment_used) {
      return (
        <>
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              <Icon name="cash-outline" size={20} color="#FF6B35" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>Cash on Delivery</Text>
              <Text style={styles.paymentMethodDescription}>
                Pay when order arrives
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#FF6B35' }]}>
              ₹{totalAmount.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.pendingPaymentIndicator}>
            <Icon name="time-outline" size={18} color="#FFA726" />
            <Text style={styles.pendingPaymentText}>
              Payment Pending: ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)}
            </Text>
          </View>
        </>
      );
    }
    
    // Case 5: Wallet + Cash on Delivery
    if (eatoor_wallet_used && !online_payment_used && cod_payment_used) {
      return (
        <>
          {/* Wallet Payment Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
              <Icon name="wallet-outline" size={20} color="#9C27B0" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {wallet_payment_method || 'Eatoor Money'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Wallet payment
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#9C27B0' }]}>
              ₹{parseFloat(wallet_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          {/* Cash on Delivery Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              <Icon name="cash-outline" size={20} color="#FF6B35" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>Cash on Delivery</Text>
              <Text style={styles.paymentMethodDescription}>
                Pay remaining when order arrives
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#FF6B35' }]}>
              ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.partialPaymentIndicator}>
            <Icon name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.partialPaymentText}>
              ₹{parseFloat(wallet_payment_amount.toString() || '0').toFixed(2)} paid via Wallet
            </Text>
          </View>
          
          <View style={styles.pendingPaymentIndicator}>
            <Icon name="time-outline" size={18} color="#FFA726" />
            <Text style={styles.pendingPaymentText}>
              ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)} pending via Cash
            </Text>
          </View>
        </>
      );
    }
    
    // Case 6: Online + Cash on Delivery
    if (!eatoor_wallet_used && online_payment_used && cod_payment_used) {
      return (
        <>
          {/* Online Payment Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
              <Icon name="card-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {online_payment_method || 'Online Payment'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Online payment
                {online_transaction_id && (
                  <Text style={styles.transactionIdText}>
                    ID: {online_transaction_id}
                  </Text>
                )}
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#4CAF50' }]}>
              ₹{parseFloat(online_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          {/* Cash on Delivery Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              <Icon name="cash-outline" size={20} color="#FF6B35" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>Cash on Delivery</Text>
              <Text style={styles.paymentMethodDescription}>
                Pay remaining when order arrives
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#FF6B35' }]}>
              ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.partialPaymentIndicator}>
            <Icon name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.partialPaymentText}>
              ₹{parseFloat(online_payment_amount.toString() || '0').toFixed(2)} paid via {online_payment_method || 'Online'}
            </Text>
          </View>
          
          <View style={styles.pendingPaymentIndicator}>
            <Icon name="time-outline" size={18} color="#FFA726" />
            <Text style={styles.pendingPaymentText}>
              ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)} pending via Cash
            </Text>
          </View>
        </>
      );
    }
    
    // Case 7: All three methods (Wallet + Online + COD)
    if (eatoor_wallet_used && online_payment_used && cod_payment_used) {
      return (
        <>
          {/* Wallet Payment Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(156, 39, 176, 0.1)' }]}>
              <Icon name="wallet-outline" size={20} color="#9C27B0" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {wallet_payment_method || 'Eatoor Money'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Wallet payment
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#9C27B0' }]}>
              ₹{parseFloat(wallet_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          {/* Online Payment Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
              <Icon name="card-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>
                {online_payment_method || 'Online Payment'}
              </Text>
              <Text style={styles.paymentMethodDescription}>
                Online payment
                {online_transaction_id && (
                  <Text style={styles.transactionIdText}>
                    • ID: {online_transaction_id}
                  </Text>
                )}
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#4CAF50' }]}>
              ₹{parseFloat(online_payment_amount.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          {/* Cash on Delivery Row */}
          <View style={styles.paymentMethodRow}>
            <View style={[styles.paymentMethodIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              <Icon name="cash-outline" size={20} color="#FF6B35" />
            </View>
            <View style={styles.paymentMethodInfo}>
              <Text style={styles.paymentMethodName}>Cash on Delivery</Text>
              <Text style={styles.paymentMethodDescription}>
                Pay remaining when order arrives
              </Text>
            </View>
            <Text style={[styles.paymentAmount, { color: '#FF6B35' }]}>
              ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.partialPaymentIndicator}>
            <Icon name="checkmark-circle" size={18} color="#2ECC71" />
            <Text style={styles.partialPaymentText}>
              ₹{(parseFloat(wallet_payment_amount.toString() || '0') + parseFloat(online_payment_amount.toString() || '0')).toFixed(2)} paid
            </Text>
          </View>
          
          <View style={styles.pendingPaymentIndicator}>
            <Icon name="time-outline" size={18} color="#FFA726" />
            <Text style={styles.pendingPaymentText}>
              ₹{parseFloat(cod_payment_pending?.toString() || '0').toFixed(2)} pending via Cash
            </Text>
          </View>
        </>
      );
    }
    
    return null;
  };

  // Format last updated time in IST
  const formatLastUpdated = () => {
    try {
      return lastUpdated.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      console.error('Error formatting last updated time:', e);
      return '';
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          {/* Loading Animation */}
          <LoadingAnimation />
          
          <View style={styles.loadingContent}>
            <Text style={styles.loadingTitle}>Tracking Your Order</Text>
            <Text style={styles.loadingSubtitle}>Fetching real-time updates...</Text>
            
            {/* Order info */}
            <View style={styles.loadingOrderInfo}>
              <Text style={styles.loadingOrderNumber}>Order #{order_number}</Text>
              <Text style={styles.loadingStatus}>Preparing your delivery...</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Animated.View style={styles.errorAnimation}>
            <Icon name="sad-outline" size={90} color="#FF6B35" />
          </Animated.View>
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error || 'We couldn\'t find your order'}</Text>
          <Text style={styles.errorSubtext}>Please check your order history</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchAllData(true)}
            activeOpacity={0.8}
          >
            <Icon name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.goBackButton} 
            onPress={() => {
              triggerHaptic('light');
              navigation.goBack();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Fixed Header */}
      <View style={styles.headerContainer}>
        <SafeAreaView style={styles.safeAreaHeader}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => {
                triggerHaptic('light');
                if (prev_location) {
                  navigation.navigate(prev_location);
                } else {
                  navigation.goBack();
                }
              }} 
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Icon name="chevron-back" size={28} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Track Order</Text>
              <View style={styles.headerDateTimeContainer}>
                <Text style={styles.headerOrderNumber}>#{order.order_number}</Text>
                <Text style={styles.headerDateTime}>
                  • {formatHeaderDate(order.placed_on)}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
            progressBackgroundColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={!isMapExpanded}
      >
        {/* Map Section */}
        <View style={[
          styles.mapContainer, 
          { 
            height: currentMapHeight,
          }
        ]}>
          {coordinates ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: (coordinates.restaurant.latitude + coordinates.delivery.latitude) / 2,
                longitude: (coordinates.restaurant.longitude + coordinates.delivery.longitude) / 2,
                latitudeDelta: LATITUDE_DELTA * 1.5,
                longitudeDelta: LONGITUDE_DELTA * 1.5
              }}
              customMapStyle={mapStyle}
              scrollEnabled={isMapExpanded}
              zoomEnabled={isMapExpanded}
              rotateEnabled={isMapExpanded}
              pitchEnabled={isMapExpanded}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={false}
              showsScale={false}
              showsTraffic={false}
              showsBuildings={true}
              showsIndoors={false}
            >
              {/* Pulse effect for delivery partner */}
              {coordinates.agent && deliveryStatus === DELIVERY_STATUS.ON_THE_WAY && (
                <Circle
                  center={{
                    latitude: coordinates.agent.latitude,
                    longitude: coordinates.agent.longitude
                  }}
                  radius={100}
                  strokeWidth={1}
                  strokeColor="rgba(74, 144, 226, 0.2)"
                  fillColor="rgba(74, 144, 226, 0.1)"
                />
              )}
              
              {/* Route line based on delivery status */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={statusDetails.color}
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              
              {/* Completed portion of route when agent is on the way */}
              {coordinates && coordinates.agent && deliveryStatus === DELIVERY_STATUS.ON_THE_WAY && (
                <Polyline
                  coordinates={[coordinates.restaurant, coordinates.agent]}
                  strokeColor={statusDetails.color}
                  strokeWidth={6}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              
              {/* Restaurant Marker */}
              <Marker
                coordinate={coordinates.restaurant}
                title={coordinates.restaurant.title}
                description="Restaurant"
                tracksViewChanges={false}
              >
                <Animated.View style={[
                  styles.restaurantMarker,
                  {
                    transform: [{ scale: pulseAnim }]
                  }
                ]}>
                  <View style={[styles.markerInner, { backgroundColor: statusDetails.color }]}>
                    <Icon name="restaurant" size={24} color="#fff" />
                  </View>
                  <View style={[styles.markerPulse, { borderColor: statusDetails.color }]} />
                </Animated.View>
              </Marker>
              
              {/* Delivery Location Marker */}
              <Marker
                coordinate={coordinates.delivery}
                title={coordinates.delivery.title}
                description="Your Location"
                tracksViewChanges={false}
              >
                <Animated.View style={[
                  styles.deliveryMarker,
                  {
                    transform: [{ scale: pulseAnim }]
                  }
                ]}>
                  <View style={[styles.markerInner, { backgroundColor: statusDetails.color }]}>
                    <Icon name="home" size={24} color="#fff" />
                  </View>
                </Animated.View>
              </Marker>
              
              {/* Delivery Partner Marker */}
              {coordinates.agent && (
                <Marker
                  coordinate={{
                    latitude: coordinates.agent.latitude,
                    longitude: coordinates.agent.longitude
                  }}
                  title={coordinates.agent.title}
                  description="Delivery Partner"
                  tracksViewChanges={false}
                >
                  <Animated.View 
                    style={[
                      styles.deliveryPartnerMarker, 
                      { 
                        transform: [
                          { rotate: `${rotationAngleValue}deg` },
                          { scale: pulseAnim }
                        ]
                      }
                    ]}
                  >
                    <View style={[styles.markerInner, { backgroundColor: statusDetails.color }]}>
                      <Icon name="bicycle" size={26} color="#fff" />
                    </View>
                  </Animated.View>
                </Marker>
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.mapPlaceholderText}>Loading live location...</Text>
            </View>
          )}

          {/* Order Info Overlay */}
          {isInfoVisible && (
            <View style={styles.orderInfoOverlay}>
              <View style={styles.orderInfoContent}>
                <View style={styles.restaurantInfo}>
                  <View style={styles.restaurantInfoLeft}>
                    <Image 
                      source={{ uri: order.restaurant_details?.restaurant_image || 'https://via.placeholder.com/60' }} 
                      style={styles.restaurantImage}
                    />
                    <View style={styles.restaurantDetails}>
                      <View style={styles.restaurantNameContainer}>
                        <Text style={styles.restaurantName} numberOfLines={1}>
                          {order.restaurant_details?.restaurant_name || 'Restaurant'}
                        </Text>
                      </View>
                      <View style={styles.statusIndicator}>
                        <View style={[styles.statusDot, { backgroundColor: statusDetails.color }]} />
                        <Text style={styles.statusText}>{statusDetails.title}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.deliveryStats}>
                  <View style={styles.statItem}>
                    <Icon name="navigate" size={18} color="#FF6B35" />
                    <Text style={styles.statValue}>{distance || 'Calculating...'}</Text>
                    <Text style={styles.statLabel}>Distance</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Icon name="time" size={18} color="#FF6B35" />
                    <Text style={styles.statValue}>{eta}</Text>
                    <Text style={styles.statLabel}>ETA</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Icon name="refresh" size={16} color="#888" />
                    <Text style={styles.statValue}>{formatLastUpdated()}</Text>
                    <Text style={styles.statLabel}>Updated</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Expand/Collapse Button */}
          <TouchableOpacity 
            style={[
              styles.mapToggleButton,
              isMapExpanded ? styles.collapseButton : styles.expandButton
            ]}
            onPress={toggleMap}
            activeOpacity={0.8}
          >
            <Icon 
              name={isMapExpanded ? "expand" : "contract"} 
              size={24} 
              color="#333" 
            />
          </TouchableOpacity>
        </View>

        {/* Status Progress Card */}
        <Animated.View style={[
          styles.card,
          styles.progressCard,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })}
            ]
          }
        ]}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>Delivery Progress</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusDetails.bgColor }]}>
              <Text style={[styles.statusBadgeText, { color: statusDetails.color }]}>
                {deliveryStatus}
              </Text>
            </View>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${(statusDetails.step / 4) * 100}%`,
                    backgroundColor: statusDetails.color 
                  }
                ]} 
              />
            </View>
            <View style={styles.progressSteps}>
              {[1, 2, 3, 4].map((step) => (
                <View key={step} style={styles.progressStep}>
                  <View style={[
                    styles.progressStepIcon,
                    statusDetails.step >= step 
                      ? { backgroundColor: statusDetails.color } 
                      : { backgroundColor: '#F0F0F0' }
                  ]}>
                    {statusDetails.step >= step ? (
                      <Icon name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Icon 
                        name={
                          step === 1 ? 'receipt-outline' : 
                          step === 2 ? 'restaurant-outline' : 
                          step === 3 ? 'bicycle-outline' : 
                          'checkmark-circle-outline'
                        } 
                        size={16} 
                        color={statusDetails.step >= step ? '#fff' : '#999'} 
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.progressStepLabel,
                    statusDetails.step >= step && { color: '#333', fontWeight: '700' }
                  ]}>
                    {step === 1 ? 'Ordered' : step === 2 ? 'Preparing' : step === 3 ? 'On Way' : 'Delivered'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Delivery Partner Card */}
        {[DELIVERY_STATUS.ON_THE_WAY, DELIVERY_STATUS.DELIVERED].includes(deliveryStatus) && (
          <Animated.View style={[
            styles.card,
            styles.deliveryPartnerCard,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })}
              ]
            }
          ]}>
            <View style={styles.deliveryPartnerHeader}>
              <Text style={styles.sectionTitle}>Your Delivery Partner</Text>
              <View style={styles.ratingBadge}>
                <Icon name="star" size={16} color="#FFC107" />
                <Text style={styles.ratingText}>{deliveryPartner.rating}</Text>
                <Text style={styles.ratingCount}>({deliveryPartner.deliveries}+)</Text>
              </View>
            </View>
            
            <View style={styles.deliveryPartnerContent}>
              <View style={styles.deliveryPartnerImageContainer}>
                <Image source={{ uri: deliveryPartner.image }} style={styles.deliveryPartnerImage} />
                {deliveryStatus === DELIVERY_STATUS.ON_THE_WAY && (
                  <View style={[styles.onlineIndicator, { backgroundColor: statusDetails.color }]} />
                )}
              </View>
              <View style={styles.deliveryPartnerInfo}>
                <Text style={styles.deliveryPartnerName}>{deliveryPartner.name}</Text>
                <View style={styles.deliveryPartnerMeta}>
                  <View style={styles.metaItem}>
                    <Icon name="bicycle" size={16} color="#666" />
                    <Text style={styles.metaText}>{deliveryPartner.vehicle}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="call" size={16} color="#666" />
                    <Text style={styles.metaText}>{deliveryPartner.phone}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.callButton, { backgroundColor: statusDetails.color }]}
                onPress={() => handleCall(deliveryPartner.phone)}
                activeOpacity={0.8}
              >
                <Icon name="call-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Order Summary Card */}
        <Animated.View style={[
          styles.card,
          styles.orderSummaryCard,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })}
            ]
          }
        ]}>
          <View style={styles.orderSummaryHeader}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <Text style={styles.orderDateTime}>
              Ordered: {formatDateTime(order.placed_on)}
            </Text>
            <Text style={styles.estimatedDateTime}>
              Estimated delivery: {formatDateTime(order.estimated_delivery)}
            </Text>
          </View>
          
          <View style={styles.orderItems}>
            {order.items && order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={styles.itemImageContainer}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Icon name="fast-food-outline" size={28} color="#666" />
                    </View>
                  )}
                  {item.buy_one_get_one_free && (
                    <View style={styles.bogoBadge}>
                      <Text style={styles.bogoText}>BOGO</Text>
                    </View>
                  )}
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  {item.description && (
                    <Text style={styles.itemDescription} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <View style={styles.itemPriceContainer}>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                  <Text style={styles.itemPrice}>₹{(parseFloat(item.unit_price)).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
          
          {/* Bill Details Section */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionDividerText}>Bill Details</Text>
          </View>
          
          <View style={styles.billDetails}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{parseFloat(order.payment_details?.subtotal || '0').toFixed(2)}</Text>
            </View>
            
            {order.coupon_details_details?.coupon_discount > 0 && (
              <View style={styles.billRow}>
                <View style={styles.billLabelContainer}>
                  <Text style={styles.billLabel}>Discount</Text>
                  {order.coupon_details_details?.coupon_code && (
                    <Text style={styles.couponCode}>{order.coupon_details_details.coupon_code}</Text>
                  )}
                </View>
                <Text style={[styles.billValue, styles.discountValue]}>
                  -₹{parseFloat(order.coupon_details_details?.coupon_discount.toString() || '0').toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={styles.billValue}>₹{parseFloat(order.payment_details?.delivery_fee?.toString() || '0').toFixed(2)}</Text>
            </View>
            
            <View style={styles.billTotalDivider} />
            
            <View style={styles.billRow}>
              <Text style={styles.billTotalLabel}>Grand Total</Text>
              <Text style={styles.billTotalValue}>₹{parseFloat(order.payment_details?.total || '0').toFixed(2)}</Text>
            </View>
          </View>
          
          {/* Payment Breakdown Section */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionDividerText}>Payment Breakdown</Text>
          </View>
          
          <View style={styles.paymentBreakdown}>
            {renderPaymentBreakdown()}
          </View>
        </Animated.View>

        {/* Delivery Address Card */}
        <Animated.View style={[
          styles.card,
          styles.addressCard,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })}
            ]
          }
        ]}>
          {/* Header with gradient background */}
          <View style={[styles.addressHeader, { backgroundColor: statusDetails.bgColor }]}>
            <View style={styles.addressHeaderContent}>
              <View style={styles.addressTitleContainer}>
                <Icon name="location-outline" size={24} color={statusDetails.color} />
                <Text style={[styles.sectionTitle, { color: '#1A1A1A', marginLeft: 8 }]}>
                  Delivery Address
                </Text>
              </View>
              <View style={styles.addressTypeBadgeContainer}>
                <View style={[styles.addressTypeBadge, { backgroundColor: statusDetails.color }]}>
                  <Text style={styles.addressTypeText}>
                    {order.delivery_address?.home_type || 'Home'}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.addressActions}>
              <TouchableOpacity 
                style={[styles.addressActionButton, { backgroundColor: statusDetails.color }]} 
                onPress={() => handleAddressCall(order.delivery_address?.phone_number)}
                activeOpacity={0.8}
              >
                <Icon name="call-outline" size={20} color="#fff" />
                <Text style={styles.addressActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.addressActionButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: statusDetails.color }]} 
                onPress={handleNavigate}
                activeOpacity={0.8}
              >
                <Icon name="navigate-outline" size={20} color={statusDetails.color} />
                <Text style={[styles.addressActionText, { color: statusDetails.color }]}>
                  Navigate
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Address Content */}
          <View style={styles.addressContent}>
            {/* Recipient Info */}
            <View style={styles.recipientInfo}>
              <View style={styles.recipientIconContainer}>
                <View style={[styles.recipientIcon, { backgroundColor: statusDetails.bgColor }]}>
                  <Icon name="person" size={20} color={statusDetails.color} />
                </View>
              </View>
              <View style={styles.recipientDetails}>
                <Text style={styles.recipientName}>
                  {order.delivery_address?.full_name || 'Name not available'}
                </Text>
                <TouchableOpacity 
                  style={styles.phoneContainer}
                  onPress={() => handleAddressCall(order.delivery_address?.phone_number)}
                  activeOpacity={0.7}
                >
                  <Icon name="call-outline" size={18} color="#666" />
                  <Text style={styles.recipientPhone}>
                    {order.delivery_address?.phone_number || 'Phone not available'}
                  </Text>
                  <Icon name="chevron-forward" size={16} color="#888" />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Address Details */}
            <View style={styles.addressDetailsSection}>
              <View style={styles.addressIconContainer}>
                <Icon name="location-sharp" size={24} color="#FF6B35" />
              </View>
              <View style={styles.addressTextContainer}>
                <Text style={styles.addressText}>
                  {order.delivery_address?.address || 'Address not available'}
                </Text>
                {order.delivery_address?.landmark && (
                  <View style={styles.landmarkContainer}>
                    <Icon name="flag-outline" size={16} color="#888" />
                    <Text style={styles.landmarkText}>
                      Near {order.delivery_address.landmark}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Last Updated Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Icon name="time-outline" size={18} color="#888" />
            <View style={styles.footerTextContainer}>
              <Text style={styles.footerText}>
                Last updated {formatLastUpdated()} IST
              </Text>
              <Text style={styles.footerSubtext}>
                Auto-refreshes every 60 seconds
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Icon name="refresh" size={18} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Bottom Spacer */}
        <View style={{ height: Platform.OS === 'ios' ? 40 : 20 }} />
      </ScrollView>
    </View>
  );
};

// Custom Map Style
const mapStyle = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#c9c9c9"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFD'
  },
  safeAreaHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 1000,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_MARGIN,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: getResponsiveFontSize(22),
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  headerDateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  headerOrderNumber: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerDateTime: {
    fontSize: getResponsiveFontSize(13),
    color: '#888',
    fontWeight: '500',
    marginLeft: 4,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  headerRight: {
    width: 48,
    height: 48,
  },
  scrollContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: CARD_MARGIN_BOTTOM,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  mapPlaceholderText: {
    marginTop: 16,
    fontSize: getResponsiveFontSize(15),
    color: '#666',
    fontWeight: '600',
  },
  orderInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    paddingVertical: 20,
    paddingHorizontal: CARD_MARGIN,
  },
  orderInfoContent: {
    alignItems: 'center',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  restaurantInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  arrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginLeft: 'auto',
  },
  restaurantImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantNameContainer: {
    marginBottom: 6,
  },
  restaurantName: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '800',
    color: '#1A1A1A',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  statusText: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    fontWeight: '600',
  },
  deliveryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E8E8E8',
  },
  statValue: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  restaurantMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryPartnerMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerPulse: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    zIndex: -1,
  },
  mapToggleButton: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  expandButton: {
    top: 16,
    right: 16,
  },
  collapseButton: {
    bottom: 16,
    right: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginHorizontal: CARD_MARGIN,
    marginBottom: CARD_MARGIN_BOTTOM,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F5F5F5',
  },
  progressCard: {
    // Inherits card styles
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    flex: 1,
  },
  orderSummaryHeader: {
    marginBottom: 20,
  },
  orderDateTime: {
    fontSize: getResponsiveFontSize(13),
    color: '#888',
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 18,
  },
  estimatedDateTime: {
    fontSize: getResponsiveFontSize(13),
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    minWidth: 100,
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  progressBarContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 30,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  progressStep: {
    alignItems: 'center',
    width: 70,
  },
  progressStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  progressStepLabel: {
    fontSize: getResponsiveFontSize(11),
    color: '#888',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  deliveryPartnerCard: {
    // Inherits card styles
  },
  deliveryPartnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEBB2',
  },
  ratingText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '800',
    color: '#1A1A1A',
    marginLeft: 4,
    marginRight: 2,
  },
  ratingCount: {
    fontSize: getResponsiveFontSize(10),
    color: '#888',
    fontWeight: '600',
  },
  deliveryPartnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryPartnerImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  deliveryPartnerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  onlineIndicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    bottom: 2,
    right: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryPartnerInfo: {
    flex: 1,
    marginRight: 10,
  },
  deliveryPartnerName: {
    fontSize: getResponsiveFontSize(17),
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  deliveryPartnerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  metaText: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    marginLeft: 6,
    fontWeight: '600',
  },
  callButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  orderSummaryCard: {
    // Inherits card styles
  },
  orderItems: {
    marginBottom: 20,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#F8FAFD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  bogoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bogoText: {
    fontSize: getResponsiveFontSize(9),
    color: '#1A1A1A',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    lineHeight: 16,
  },
  itemPriceContainer: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  itemQuantity: {
    fontSize: getResponsiveFontSize(13),
    color: '#888',
    marginBottom: 4,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A',
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    marginTop: 25,
  },
  sectionDividerText: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    letterSpacing: 0.3,
  },
  billDetails: {
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 5,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  billLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    fontWeight: '600',
  },
  couponCode: {
    fontSize: getResponsiveFontSize(11),
    color: '#FF6B35',
    fontWeight: '700',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    overflow: 'hidden',
  },
  billValue: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: '#1A1A1A',
  },
  discountValue: {
    color: '#2ECC71',
  },
  billTotalDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 14,
    marginHorizontal: 4,
  },
  billTotalLabel: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A',
  },
  billTotalValue: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '900',
    color: '#1A1A1A',
  },
  paymentBreakdown: {
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  paymentMethodIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
  },
  paymentMethodInfo: {
    flex: 1,
    marginRight: 12,
  },
  paymentMethodName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  paymentMethodDescription: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    fontWeight: '500',
    lineHeight: 16,
  },
  transactionIdText: {
    fontSize: getResponsiveFontSize(10),
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paymentAmount: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A',
  },
  paidIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
    marginTop: 8,
  },
  paidText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: '#2ECC71',
    marginLeft: 8,
    flex: 1,
  },
  partialPaymentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.2)',
    marginTop: 8,
  },
  partialPaymentText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: '#FFA726',
    marginLeft: 8,
    flex: 1,
  },
  pendingPaymentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 167, 38, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.2)',
    marginTop: 8,
  },
  pendingPaymentText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: '#FF6B35',
    marginLeft: 8,
    flex: 1,
  },
  
  // ADDRESS CARD STYLES
  addressCard: {
    overflow: 'hidden',
    padding: 0,
  },
  addressHeader: {
    padding: CARD_PADDING,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  addressHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addressTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressTypeBadgeContainer: {
    marginLeft: 8,
  },
  addressTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addressTypeText: {
    fontSize: getResponsiveFontSize(12),
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addressActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addressActionText: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  addressContent: {
    padding: CARD_PADDING,
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recipientIconContainer: {
    marginRight: 16,
  },
  recipientIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  recipientDetails: {
    flex: 1,
  },
  recipientName: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  recipientPhone: {
    fontSize: getResponsiveFontSize(15),
    color: '#666',
    fontWeight: '600',
    marginLeft: 10,
    flex: 1,
  },
  addressDetailsSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  addressIconContainer: {
    marginRight: 16,
    marginTop: 4,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressText: {
    fontSize: getResponsiveFontSize(15),
    color: '#666',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 12,
  },
  landmarkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  landmarkText: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    marginHorizontal: CARD_MARGIN,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  footerTextContainer: {
    marginLeft: 10,
  },
  footerText: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    fontWeight: '600',
    marginBottom: 2,
  },
  footerSubtext: {
    fontSize: getResponsiveFontSize(11),
    color: '#888',
    fontWeight: '500',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  
  // LOADING STYLES
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingContent: {
    alignItems: 'center',
    marginTop: 40,
  },
  loadingTitle: {
    fontSize: getResponsiveFontSize(26),
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: getResponsiveFontSize(16),
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    fontWeight: '500',
    marginBottom: 30,
  },
  loadingOrderInfo: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingOrderNumber: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 8,
  },
  loadingStatus: {
    fontSize: getResponsiveFontSize(14),
    color: '#888',
    fontWeight: '600',
  },
  
  // LOADING ANIMATION STYLES
  loadingAnimationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  loadingBikeContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8FAFD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F0F0',
  },
  loadingBike: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 20,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
    backgroundColor: '#FF6B35',
  },
  dot1: {
    opacity: 0.6,
    transform: [{ scale: 0.8 }],
  },
  dot2: {
    opacity: 0.8,
    transform: [{ scale: 0.9 }],
  },
  dot3: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  
  // ERROR STYLES
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 40,
  },
  errorAnimation: {
    marginBottom: 30,
  },
  errorTitle: {
    fontSize: getResponsiveFontSize(26),
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  errorText: {
    fontSize: getResponsiveFontSize(16),
    color: '#FF6B35',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: getResponsiveFontSize(15),
    marginLeft: 8,
  },
  goBackButton: {
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goBackButtonText: {
    color: '#666',
    fontWeight: '700',
    fontSize: getResponsiveFontSize(15),
  },
});

export default TrackOrder;