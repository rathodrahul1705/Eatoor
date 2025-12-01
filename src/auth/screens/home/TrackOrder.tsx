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
  Vibration
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

// Constants
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const SMALL_MAP_HEIGHT = 240;
const EXPANDED_MAP_HEIGHT = height * 0.8;
const CARD_WIDTH = width - 32;
const HEADER_HEIGHT = 90;
const CARD_PADDING = 20;

// Responsive font sizes
const getResponsiveFontSize = (baseSize: number) => {
  const scale = width / 375;
  const newSize = baseSize * scale;
  return Math.round(newSize);
};

// Delivery status constants
const DELIVERY_STATUS = {
  ORDERED: 'Pending',
  PREPARING: 'Preparing',
  ON_THE_WAY: 'On the Way',
  DELIVERED: 'Delivered'
};

const STATUS_COLORS = {
  [DELIVERY_STATUS.ORDERED]: '#FF6B35',
  [DELIVERY_STATUS.PREPARING]: '#FFA726',
  [DELIVERY_STATUS.ON_THE_WAY]: '#4A90E2',
  [DELIVERY_STATUS.DELIVERED]: '#2ECC71'
};

const STATUS_GRADIENTS = {
  [DELIVERY_STATUS.ORDERED]: ['#FF6B35', '#FF8A65'],
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

// Haptic feedback helper function
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  try {
    // If react-native-haptic-feedback is installed
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
      // Fallback to Vibration API
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
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [distance, setDistance] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState(DELIVERY_STATUS.ORDERED);
  const [eta, setEta] = useState('30-40 mins');
  const [coordinates, setCoordinates] = useState<{
    restaurant: { latitude: number; longitude: number; title: string };
    delivery: { latitude: number; longitude: number; title: string };
    agent?: { latitude: number; longitude: number; title: string } | null;
  } | null>(null);
  const [liveTrackingData, setLiveTrackingData] = useState<LiveTrackingData | null>(null);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastUpdated, setLastUpdated] = useState(moment());
  const [rotationAngleValue, setRotationAngleValue] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));
  
  const ANIMATION_DURATION = 2000;
  
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
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.ease,
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1); // Reset pulse when not on the way
    }
  }, [deliveryStatus]);

  // Initial fade in animation
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
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
  }, [loading]);

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
            setEta(`${data.estimated_time_minutes} mins`);
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

        if (orderData.status == DELIVERY_STATUS.PREPARING) {
          setDeliveryStatus(DELIVERY_STATUS.PREPARING);
        } else if (orderData.status == DELIVERY_STATUS.ON_THE_WAY) {
          setDeliveryStatus(DELIVERY_STATUS.ON_THE_WAY);
        } else if (orderData.status == DELIVERY_STATUS.DELIVERED) {
          setDeliveryStatus(DELIVERY_STATUS.DELIVERED);
        } else {
          setDeliveryStatus(DELIVERY_STATUS.PREPARING);
        }
        
        const placedTime = moment(orderData.placed_on);
        const estimatedTime = moment(orderData.estimated_delivery);
        const diffMinutes = estimatedTime.diff(placedTime, 'minutes');
        setEta(`${diffMinutes - 10}-${diffMinutes} mins`);
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
      
      setLastUpdated(moment());
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
    }, 30000);

    setTrackingInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [order_number]);

  // Map animation with haptic feedback
  const toggleMap = useCallback(() => {
    triggerHaptic('medium');
    
    Animated.timing(mapAnimation, {
      toValue: isMapExpanded ? 0 : 1,
      duration: 400,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      useNativeDriver: false
    }).start(() => {
      setIsMapExpanded(!isMapExpanded);
      if (!isMapExpanded && coordinates) {
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
        }, 350);
      }
    });
  }, [isMapExpanded, mapAnimation, coordinates]);

  // Calculate animated dimensions
  const mapHeight = mapAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [SMALL_MAP_HEIGHT, EXPANDED_MAP_HEIGHT]
  });

  const mapBorderRadius = mapAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0]
  });

  const infoOpacity = mapAnimation.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.2, 0]
  });

  // Status details
  const getStatusDetails = () => {
    const currentGradient = STATUS_GRADIENTS[deliveryStatus] || ['#666', '#999'];
    
    switch(deliveryStatus) {
      case DELIVERY_STATUS.ORDERED:
        return {
          title: 'Order placed',
          subtitle: 'Your order has been received',
          icon: 'receipt-outline',
          step: 1,
          color: STATUS_COLORS[DELIVERY_STATUS.ORDERED],
          gradient: currentGradient
        };
      case DELIVERY_STATUS.PREPARING:
        return {
          title: 'Preparing your order',
          subtitle: order ? `At ${order.restaurant_name}` : 'Being prepared',
          icon: 'restaurant-outline',
          step: 2,
          color: STATUS_COLORS[DELIVERY_STATUS.PREPARING],
          gradient: currentGradient
        };
      case DELIVERY_STATUS.ON_THE_WAY:
        return {
          title: 'On the way',
          subtitle: `With ${deliveryPartner.name}`,
          icon: 'bicycle-outline',
          step: 3,
          color: STATUS_COLORS[DELIVERY_STATUS.ON_THE_WAY],
          gradient: currentGradient
        };
      case DELIVERY_STATUS.DELIVERED:
        return {
          title: 'Delivered',
          subtitle: 'Your order has arrived',
          icon: 'checkmark-done-outline',
          step: 4,
          color: STATUS_COLORS[DELIVERY_STATUS.DELIVERED],
          gradient: currentGradient
        };
      default:
        return {
          title: 'Order placed',
          subtitle: 'Your order has been received',
          icon: 'time-outline',
          step: 0,
          color: '#9E9E9E',
          gradient: ['#666', '#999']
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

  // Format time
  const placedTime = moment(order?.placed_on).format('h:mm A');
  const estimatedTime = order?.estimated_delivery ? 
    moment(order.estimated_delivery).format('h:mm A') : '';

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <Animated.View style={styles.loadingAnimation}>
            <Icon name="bicycle" size={60} color="#FF6B35" />
            <ActivityIndicator size="large" color="#FF6B35" style={styles.loadingSpinner} />
          </Animated.View>
          <Text style={styles.loadingTitle}>Tracking Your Order</Text>
          <Text style={styles.loadingSubtitle}>Fetching real-time updates...</Text>
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
            <Icon name="sad-outline" size={80} color="#FF6B35" />
          </Animated.View>
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error || 'We couldn\'t find your order'}</Text>
          <Text style={styles.errorSubtext}>Please check your order history</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => fetchAllData(true)}
            activeOpacity={0.8}
          >
            <Icon name="refresh" size={18} color="#FFFFFF" />
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Floating Header */}
      <Animated.View style={[
        styles.header,
        { 
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, 0]
          })}]
        }
      ]}>
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
          <Icon name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Track Order</Text>
          <Text style={styles.headerOrderNumber}>#{order_number}</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerRight} 
          activeOpacity={0.7}
          onPress={() => triggerHaptic('light')}
        >
          <Icon name="ellipsis-vertical" size={22} color="#333" />
        </TouchableOpacity>
      </Animated.View>

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
      >
        {/* Map Section */}
        <Animated.View style={[
          styles.mapContainer, 
          { 
            height: mapHeight,
            borderRadius: mapBorderRadius,
            marginHorizontal: isMapExpanded ? 0 : CARD_PADDING,
            marginTop: isMapExpanded ? 0 : 10,
            marginBottom: isMapExpanded ? 0 : 16,
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
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
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA
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
              
              {/* Polyline with gradient effect */}
              <Polyline
                coordinates={[coordinates.restaurant, coordinates.delivery]}
                strokeColor="#FF6B35"
                strokeWidth={4}
                lineDashPattern={[8, 4]}
                lineCap="round"
                lineJoin="round"
              />
              
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
                    <Icon name="restaurant" size={20} color="#fff" />
                  </View>
                  <View style={styles.markerPulse} />
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
                    <Icon name="home" size={20} color="#fff" />
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
                      <Icon name="bicycle" size={24} color="#fff" />
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
          <Animated.View style={[styles.orderInfoOverlay, { opacity: infoOpacity }]}>
            <View style={styles.orderInfoContent}>
              <View style={styles.restaurantInfo}>
                <Image 
                  source={{ uri: order.restaurant_image }} 
                  style={styles.restaurantImage}
                />
                <View style={styles.restaurantDetails}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {order.restaurant_name}
                  </Text>
                  <View style={styles.statusIndicator}>
                    <View style={[styles.statusDot, { backgroundColor: statusDetails.color }]} />
                    <Text style={styles.statusText}>{statusDetails.title}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.deliveryStats}>
                <View style={styles.statItem}>
                  <Icon name="navigate" size={14} color="#FF6B35" />
                  <Text style={styles.statValue}>{distance || 'Calculating...'}</Text>
                  <Text style={styles.statLabel}>Distance</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="time" size={14} color="#FF6B35" />
                  <Text style={styles.statValue}>{eta}</Text>
                  <Text style={styles.statLabel}>ETA</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Icon name="refresh" size={12} color="#888" />
                  <Text style={styles.statValue}>{lastUpdated.format('h:mm')}</Text>
                  <Text style={styles.statLabel}>Updated</Text>
                </View>
              </View>
            </View>
          </Animated.View>

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
              name={isMapExpanded ? "chevron-down" : "expand"} 
              size={20} 
              color="#333" 
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Status Progress Card */}
        <Animated.View style={[
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
            <View style={[styles.statusBadge, { backgroundColor: `${statusDetails.color}15` }]}>
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
                    statusDetails.step >= step && { backgroundColor: statusDetails.color }
                  ]}>
                    {statusDetails.step >= step ? (
                      <Icon name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Icon name={step === 1 ? 'receipt' : step === 2 ? 'restaurant' : step === 3 ? 'bicycle' : 'checkmark-circle'} 
                        size={12} color="#999" />
                    )}
                  </View>
                  <Text style={[
                    styles.progressStepLabel,
                    statusDetails.step >= step && { color: '#333', fontWeight: '600' }
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
                <Icon name="star" size={12} color="#FFC107" />
                <Text style={styles.ratingText}>{deliveryPartner.rating}</Text>
                <Text style={styles.ratingCount}>({deliveryPartner.deliveries}+)</Text>
              </View>
            </View>
            
            <View style={styles.deliveryPartnerContent}>
              <View style={styles.deliveryPartnerImageContainer}>
                <Image source={{ uri: deliveryPartner.image }} style={styles.deliveryPartnerImage} />
                <View style={styles.onlineIndicator} />
              </View>
              <View style={styles.deliveryPartnerInfo}>
                <Text style={styles.deliveryPartnerName}>{deliveryPartner.name}</Text>
                <View style={styles.deliveryPartnerMeta}>
                  <View style={styles.metaItem}>
                    <Icon name="bicycle" size={12} color="#666" />
                    <Text style={styles.metaText}>{deliveryPartner.vehicle}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="call" size={12} color="#666" />
                    <Text style={styles.metaText}>{deliveryPartner.phone}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.callButton, { backgroundColor: statusDetails.color }]}
                onPress={() => handleCall(deliveryPartner.phone)}
                activeOpacity={0.8}
              >
                <Icon name="call-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Order Summary Card */}
        <Animated.View style={[
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
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <View style={styles.orderItems}>
            {order.items && order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={styles.itemImageContainer}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.itemImagePlaceholder}>
                      <Icon name="fast-food-outline" size={20} color="#666" />
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
                  <Text style={styles.itemPrice}>₹{item.unit_price * item.quantity}</Text>
                </View>
              </View>
            ))}
          </View>
          
          <View style={styles.orderTotal}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₹{order.subtotal}</Text>
            </View>
            
            {order.coupon_discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{order.coupon_code_text || 'Discount'}</Text>
                <Text style={[styles.totalValue, styles.discountValue]}>-₹{order.coupon_discount}</Text>
              </View>
            )}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee</Text>
              <Text style={styles.totalValue}>₹{order.delivery_fee}</Text>
            </View>
            
            <View style={styles.totalDivider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Total Paid</Text>
              <Text style={styles.grandTotalValue}>₹{order.total}</Text>
            </View>
            
            <View style={styles.paymentMethod}>
              <Icon name="card-outline" size={16} color="#666" />
              <Text style={styles.paymentMethodText}>{order.payment_method}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Delivery Address Card */}
        <Animated.View style={[
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
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressContent}>
            <View style={styles.addressIcon}>
              <Icon name="location" size={20} color="#FF6B35" />
            </View>
            <View style={styles.addressDetails}>
              <View style={styles.addressHeader}>
                <Text style={styles.addressType}>{order.delivery_address?.home_type || 'Home'}</Text>
                <TouchableOpacity 
                  style={styles.navigateButton} 
                  onPress={handleNavigate}
                  activeOpacity={0.7}
                >
                  <Icon name="navigate-outline" size={16} color="#FF6B35" />
                  <Text style={styles.navigateText}>Navigate</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.addressText}>{order.delivery_address?.address}</Text>
              {order.delivery_address?.landmark && (
                <Text style={styles.addressLandmark}>
                  <Icon name="flag-outline" size={12} color="#888" /> {order.delivery_address.landmark}
                </Text>
              )}
              <View style={styles.addressContact}>
                <Icon name="call-outline" size={14} color="#666" />
                <Text style={styles.addressPhone}>{order.delivery_address?.phone_number}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Last Updated Footer */}
        <View style={styles.footer}>
          <Icon name="time-outline" size={14} color="#888" />
          <Text style={styles.footerText}>
            Last updated {lastUpdated.format('h:mm A')} • Auto-refreshes every 30 seconds
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFD'
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
    paddingTop: Platform.OS === 'ios' ? 15 : 10
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1
  },
  headerTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5
  },
  headerOrderNumber: {
    fontSize: getResponsiveFontSize(12),
    color: '#666',
    marginTop: 2
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  headerRight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  scrollContainer: {
    paddingTop: HEADER_HEIGHT + 10,
    paddingBottom: 30
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    fontWeight: '500'
  },
  orderInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  orderInfoContent: {
    alignItems: 'center'
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16
  },
  restaurantImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    marginRight: 12
  },
  restaurantDetails: {
    flex: 1
  },
  restaurantName: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  statusText: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    fontWeight: '500'
  },
  deliveryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    paddingVertical: 14
  },
  statItem: {
    alignItems: 'center',
    flex: 1
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E8E8E8'
  },
  statValue: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 4,
    marginBottom: 2
  },
  statLabel: {
    fontSize: getResponsiveFontSize(11),
    color: '#888',
    fontWeight: '500'
  },
  restaurantMarker: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  deliveryMarker: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  deliveryPartnerMarker: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  markerInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF'
  },
  markerPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    zIndex: -1
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
    elevation: 8
  },
  expandButton: {
    bottom: 80,
    right: 20
  },
  collapseButton: {
    top: 20,
    right: 20
  },
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: CARD_PADDING,
    marginHorizontal: CARD_PADDING,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: getResponsiveFontSize(17),
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  statusBadgeText: {
    fontSize: getResponsiveFontSize(12),
    fontWeight: '700'
  },
  progressBarContainer: {
    marginTop: 8
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 24
  },
  progressFill: {
    height: '100%',
    borderRadius: 3
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  progressStep: {
    alignItems: 'center',
    width: 70
  },
  progressStepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  progressStepLabel: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    fontWeight: '500',
    textAlign: 'center'
  },
  deliveryPartnerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: CARD_PADDING,
    marginHorizontal: CARD_PADDING,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5
  },
  deliveryPartnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12
  },
  ratingText: {
    fontSize: getResponsiveFontSize(13),
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 4,
    marginRight: 2
  },
  ratingCount: {
    fontSize: getResponsiveFontSize(11),
    color: '#888'
  },
  deliveryPartnerContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  deliveryPartnerImageContainer: {
    position: 'relative',
    marginRight: 16
  },
  deliveryPartnerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0'
  },
  onlineIndicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#2ECC71',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    bottom: 2,
    right: 2
  },
  deliveryPartnerInfo: {
    flex: 1
  },
  deliveryPartnerName: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6
  },
  deliveryPartnerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  metaText: {
    fontSize: getResponsiveFontSize(12),
    color: '#666',
    marginLeft: 4
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
    elevation: 5
  },
  orderSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: CARD_PADDING,
    marginHorizontal: CARD_PADDING,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5
  },
  orderItems: {
    marginBottom: 20
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  itemImageContainer: {
    position: 'relative',
    marginRight: 12
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F0F0F0'
  },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bogoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FFFFFF'
  },
  bogoText: {
    fontSize: getResponsiveFontSize(9),
    color: '#1A1A1A',
    fontWeight: '800'
  },
  itemDetails: {
    flex: 1,
    marginRight: 12
  },
  itemName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4
  },
  itemDescription: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    lineHeight: 16
  },
  itemPriceContainer: {
    alignItems: 'flex-end'
  },
  itemQuantity: {
    fontSize: getResponsiveFontSize(13),
    color: '#888',
    marginBottom: 4
  },
  itemPrice: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#1A1A1A'
  },
  orderTotal: {
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    padding: 16
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  totalLabel: {
    fontSize: getResponsiveFontSize(14),
    color: '#666'
  },
  totalValue: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    color: '#1A1A1A'
  },
  discountValue: {
    color: '#2ECC71'
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 12
  },
  grandTotalLabel: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '700',
    color: '#1A1A1A'
  },
  grandTotalValue: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '800',
    color: '#1A1A1A'
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8'
  },
  paymentMethodText: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    marginLeft: 8
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: CARD_PADDING,
    marginHorizontal: CARD_PADDING,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5
  },
  addressContent: {
    flexDirection: 'row'
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  addressDetails: {
    flex: 1
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  addressType: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#1A1A1A'
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  navigateText: {
    fontSize: getResponsiveFontSize(12),
    color: '#FF6B35',
    fontWeight: '600',
    marginLeft: 4
  },
  addressText: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    lineHeight: 20,
    marginBottom: 6
  },
  addressLandmark: {
    fontSize: getResponsiveFontSize(13),
    color: '#888',
    marginBottom: 8
  },
  addressContact: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  addressPhone: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    marginLeft: 6
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 12
  },
  footerText: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    marginLeft: 6
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  loadingAnimation: {
    position: 'relative',
    marginBottom: 24
  },
  loadingSpinner: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10
  },
  loadingTitle: {
    fontSize: getResponsiveFontSize(20),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8
  },
  loadingSubtitle: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 40
  },
  errorAnimation: {
    marginBottom: 24
  },
  errorTitle: {
    fontSize: getResponsiveFontSize(24),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8
  },
  errorText: {
    fontSize: getResponsiveFontSize(16),
    color: '#FF6B35',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center'
  },
  errorSubtext: {
    fontSize: getResponsiveFontSize(14),
    color: '#666',
    marginBottom: 32,
    textAlign: 'center'
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
    justifyContent: 'center'
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: getResponsiveFontSize(15),
    marginLeft: 8
  },
  goBackButton: {
    paddingVertical: 14,
    borderRadius: 16,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  goBackButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: getResponsiveFontSize(15)
  }
});

export default TrackOrder;