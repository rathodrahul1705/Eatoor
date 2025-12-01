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
  RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { getOrderDetails, getLiveTrackingDetails } from '../../../api/profile';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const SMALL_MAP_HEIGHT = 220;
const EXPANDED_MAP_HEIGHT = height * 0.75;
const CARD_WIDTH = width - 32;
const HEADER_HEIGHT = 60;

// Responsive font sizes based on screen width
const getResponsiveFontSize = (baseSize) => {
  const scale = width / 375; // 375 is standard iPhone width
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
  [DELIVERY_STATUS.ORDERED]: '#FF7A33',
  [DELIVERY_STATUS.PREPARING]: '#FF7A33',
  [DELIVERY_STATUS.ON_THE_WAY]: '#FF7A33',
  [DELIVERY_STATUS.DELIVERED]: '#4CAF50'
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
  
  const ANIMATION_DURATION = 2000;
  
  // Delivery partner details
  const [deliveryPartner, setDeliveryPartner] = useState({
    name: 'Delivery Partner',
    phone: '+918108662484',
    vehicle: 'Bike',
    rating: 4.5,
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
  });

  // Update rotation angle when animation changes
  useEffect(() => {
    const listener = deliveryAnim.addListener(({ value }) => {
      setRotationAngleValue(value * 90);
    });
    
    return () => {
      deliveryAnim.removeListener(listener);
    };
  }, [deliveryAnim]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
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
        
        // Update coordinates if we have all required data
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
          
          // Add agent location if available
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
          
          // Calculate distance
          if (data.user_destination && data.restaurant_location) {
            const dist = calculateDistance(
              data.restaurant_location.lat,
              data.restaurant_location.lng,
              data.user_destination.lat,
              data.user_destination.lng
            );
            setDistance(`${dist.toFixed(1)} km`);
          }
          
          // Update ETA if available
          if (data.estimated_time_minutes) {
            setEta(`${data.estimated_time_minutes} mins`);
          }
          
          // Update delivery status based on agent assignment
          if (data.porter_agent_assign_status === 'assigned') {
            setDeliveryStatus(DELIVERY_STATUS.ON_THE_WAY);
          } else if (data.porter_agent_assign_status === 'delivered') {
            setDeliveryStatus(DELIVERY_STATUS.DELIVERED);
          }
          
          // Update delivery partner details if available
          if (data.porter_tracking_details) {
            setDeliveryPartner(prev => ({
              ...prev,
              name: data.porter_tracking_details.delivery_person_name || prev.name,
              phone: data.porter_tracking_details.delivery_person_contact || prev.phone,
              vehicle: data.porter_tracking_details.vehicle_type || prev.vehicle,
              rating: data.porter_tracking_details.rating || prev.rating
            }));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live tracking data:', err);
      // Don't show alert during auto-refresh to avoid annoying the user
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
      if (!order) { // Only set error if we don't have any order data
        setError(err.message);
      }
    }
  }, [order_number, order]);

  // Combined data fetching function
  const fetchAllData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setRefreshing(true);
      }

      // Fetch both order details and live tracking data simultaneously
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
    // Initial data fetch
    fetchAllData(true);

    // Set up interval for auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAllData(false);
    }, 30000); // 30 seconds

    setTrackingInterval(interval);

    // Cleanup function
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [order_number]); // Only depend on order_number

  // Map animation
  const toggleMap = useCallback(() => {
    Animated.timing(mapAnimation, {
      toValue: isMapExpanded ? 0 : 1,
      duration: 300,
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
            edgePadding: { top: 50, right: 50, bottom: 100, left: 50 },
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
    outputRange: [16, 0]
  });

  const infoOpacity = mapAnimation.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.5, 0]
  });

  // Delivery simulation - only if we don't have live tracking data
  useEffect(() => {
    if (liveTrackingData || !order || deliveryStatus === DELIVERY_STATUS.DELIVERED || !coordinates) return;

    const timers = [
      setTimeout(() => {
        setDeliveryStatus(DELIVERY_STATUS.PREPARING);
        setEta('20-30 mins');
        animateDelivery(0.3);
      }, 5000),
      setTimeout(() => {
        setDeliveryStatus(DELIVERY_STATUS.ON_THE_WAY);
        setEta('10-15 mins');
        animateDelivery(0.7);
      }, 10000),
      setTimeout(() => {
        setDeliveryStatus(DELIVERY_STATUS.DELIVERED);
        setEta('Delivered');
        animateDelivery(1);
      }, 15000)
    ];

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [order, deliveryStatus, coordinates, liveTrackingData]);

  const animateDelivery = (toValue: number) => {
    Animated.timing(deliveryAnim, {
      toValue,
      duration: ANIMATION_DURATION,
      useNativeDriver: false
    }).start();
  };

  // Status details
  const getStatusDetails = () => {
    switch(deliveryStatus) {
      case DELIVERY_STATUS.ORDERED:
        return {
          title: 'Order placed',
          subtitle: 'Your order has been received',
          icon: 'receipt-outline',
          step: 1,
          color: STATUS_COLORS[DELIVERY_STATUS.ORDERED]
        };
      case DELIVERY_STATUS.PREPARING:
        return {
          title: 'Preparing your order',
          subtitle: order ? `At ${order.restaurant_name}` : 'Being prepared',
          icon: 'restaurant-outline',
          step: 2,
          color: STATUS_COLORS[DELIVERY_STATUS.PREPARING]
        };
      case DELIVERY_STATUS.ON_THE_WAY:
        return {
          title: 'On the way',
          subtitle: `With ${deliveryPartner.name}`,
          icon: 'bicycle-outline',
          step: 3,
          color: STATUS_COLORS[DELIVERY_STATUS.ON_THE_WAY]
        };
      case DELIVERY_STATUS.DELIVERED:
        return {
          title: 'Delivered',
          subtitle: 'Your order has arrived',
          icon: 'checkmark-done-outline',
          step: 4,
          color: STATUS_COLORS[DELIVERY_STATUS.DELIVERED]
        };
      default:
        return {
          title: 'Order placed',
          subtitle: 'Your order has been received',
          icon: 'time-outline',
          step: 0,
          color: '#9E9E9E'
        };
    }
  };

  const statusDetails = getStatusDetails();

  // Handle calls
  const handleCall = (number: string) => {
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

  // Format time
  const placedTime = moment(order?.placed_on).format('h:mm A');
  const estimatedTime = order?.estimated_delivery ? 
    moment(order.estimated_delivery).format('h:mm A') : '';

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Order</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF7A33" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Order</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="warning-outline" size={48} color="#FF7A33" />
          <Text style={styles.errorText}>{error || 'No order data'}</Text>
          <Text style={styles.errorSubtext}>Check your order history</Text>
          <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (prev_location) {
              navigation.navigate(prev_location);
            } else {
              navigation.goBack();
            }
          }} 
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Order</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF7A33']}
            tintColor="#FF7A33"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Map Section */}
        <Animated.View style={[
          styles.mapContainer, 
          { 
            height: mapHeight,
            borderRadius: mapBorderRadius,
            marginHorizontal: isMapExpanded ? 0 : 16,
            marginBottom: isMapExpanded ? 0 : 16,
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
              scrollEnabled={isMapExpanded}
              zoomEnabled={isMapExpanded}
              rotateEnabled={isMapExpanded}
              pitchEnabled={isMapExpanded}
              showsUserLocation={false}
              showsMyLocationButton={false}
              showsCompass={false}
              showsScale={false}
              showsTraffic={false}
              showsBuildings={false}
              showsIndoors={false}
            >
              {/* Polyline connecting restaurant and delivery location */}
              <Polyline
                coordinates={[coordinates.restaurant, coordinates.delivery]}
                strokeColor="#FF7A33"
                strokeWidth={3}
                lineDashPattern={[5, 5]}
              />
              
              {/* Restaurant Marker */}
              <Marker
                coordinate={coordinates.restaurant}
                title={coordinates.restaurant.title}
                description="Restaurant"
              >
                <Animated.View style={[
                  styles.restaurantMarker, 
                  { 
                    backgroundColor: statusDetails.color,
                  }
                ]}>
                  <Icon name="restaurant" size={20} color="#fff" />
                </Animated.View>
              </Marker>
              
              {/* Delivery Location Marker */}
              <Marker
                coordinate={coordinates.delivery}
                title={coordinates.delivery.title}
                description="Your Location"
              >
                <Animated.View style={[
                  styles.deliveryMarker,
                  {
                    backgroundColor: statusDetails.color,
                  }
                ]}>
                  <Icon name="home" size={20} color="#fff" />
                </Animated.View>
              </Marker>
              
              {/* Delivery Partner Marker (if available) */}
              {coordinates.agent && (
                <Marker
                  coordinate={{
                    latitude: coordinates.agent.latitude,
                    longitude: coordinates.agent.longitude
                  }}
                  title={coordinates.agent.title}
                  description="Delivery Partner"
                >
                  <Animated.View 
                    style={[
                      styles.deliveryPartnerMarker, 
                      { 
                        backgroundColor: statusDetails.color,
                        transform: [{ rotate: `${rotationAngleValue}deg` }]
                      }
                    ]}
                  >
                    <Icon name="bicycle" size={24} color="#fff" />
                  </Animated.View>
                </Marker>
              )}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#FF7A33" />
              <Text style={styles.mapPlaceholderText}>Loading map...</Text>
            </View>
          )}

          {/* Order Info Overlay - Only visible when map is small */}
          <Animated.View style={[styles.orderInfoOverlay, { opacity: infoOpacity }]}>
            <View style={styles.kitchenHeader}>
              <View style={styles.kitchenInfo}>
                <Image 
                  source={{ uri: order.restaurant_image }} 
                  style={styles.kitchenImage}
                />
                <View style={styles.kitchenText}>
                  <View style={styles.kitchenNameRow}>
                    <Text style={styles.kitchenName} numberOfLines={1}>
                      {order.restaurant_name}
                    </Text>
                  </View>
                  <Text style={styles.kitchenStatus} numberOfLines={1}>
                    <Icon name={statusDetails.icon} size={14} color={statusDetails.color} /> 
                    {' '}{statusDetails.title}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.deliveryInfo}>
              <View style={styles.deliveryInfoItem}>
                <Icon name="location-outline" size={14} color="#FF7A33" />
                <Text style={styles.deliveryText}>{distance || 'Calculating...'}</Text>
              </View>
              <View style={styles.deliveryInfoItem}>
                <Icon name="time-outline" size={14} color="#FF7A33" />
                <Text style={styles.deliveryEta}>{eta}</Text>
              </View>
              <View style={styles.deliveryInfoItem}>
                <Icon name="time-outline" size={12} color="#888" />
                <Text style={styles.lastUpdatedText}>
                  Updated {lastUpdated.fromNow()}
                </Text>
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
          >
            <Icon 
              name={isMapExpanded ? "chevron-down" : "expand"} 
              size={18} 
              color="#333" 
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Status Timeline */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.sectionTitle}>Order Status</Text>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusBadgeText, { color: statusDetails.color }]}>
                {deliveryStatus}
              </Text>
            </View>
          </View>
          
          <View style={styles.statusTimeline}>
            {[
              { step: 1, label: 'Ordered', icon: 'receipt-outline' },
              { step: 2, label: 'Preparing', icon: 'restaurant-outline' },
              { step: 3, label: 'On the way', icon: 'bicycle-outline' },
              { step: 4, label: 'Delivered', icon: 'checkmark-done-outline' }
            ].map((item) => (
              <View key={item.step} style={styles.timelineStep}>
                <View style={[
                  styles.stepIcon,
                  statusDetails.step >= item.step && { backgroundColor: statusDetails.color }
                ]}>
                  {statusDetails.step >= item.step ? (
                    <Icon name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Icon name={item.icon} size={14} color="#999" />
                  )}
                </View>
                <Text style={[
                  styles.stepText,
                  statusDetails.step >= item.step && { color: '#333', fontWeight: '600' }
                ]}>
                  {item.label}
                </Text>
                {item.step < 4 && (
                  <View style={[
                    styles.stepConnector,
                    statusDetails.step > item.step && { backgroundColor: statusDetails.color }
                  ]} />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Delivery Partner */}
        {[DELIVERY_STATUS.ON_THE_WAY, DELIVERY_STATUS.DELIVERED].includes(deliveryStatus) && (
          <View style={styles.deliveryPartnerCard}>
            <View style={styles.deliveryPartnerHeader}>
              <Text style={styles.sectionTitle}>Delivery Partner</Text>
              <View style={styles.ratingContainer}>
                <Icon name="star" size={12} color="#FFC107" />
                <Text style={styles.ratingText}>{deliveryPartner.rating}</Text>
              </View>
            </View>
            
            <View style={styles.deliveryPartnerContent}>
              <Image source={{ uri: deliveryPartner.image }} style={styles.deliveryPartnerImage} />
              <View style={styles.deliveryPartnerInfo}>
                <Text style={styles.deliveryPartnerName}>{deliveryPartner.name}</Text>
                <View style={styles.deliveryPartnerMeta}>
                  <Text style={styles.deliveryPartnerVehicle}>
                    <Icon name="bicycle" size={12} color="#666" /> {deliveryPartner.vehicle}
                  </Text>
                </View>
                <Text style={styles.contactText}>Contact Delivery Partner</Text>
              </View>
              <TouchableOpacity 
                style={[styles.callButton, { backgroundColor: statusDetails.color }]}
                onPress={() => handleCall(deliveryPartner.phone)}
              >
                <Icon name="call" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Order Details */}
        <View style={styles.orderDetailsCard}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          
          {order.items && order.items.map((item, index) => (
            <View key={index} style={styles.orderItem}>
              <View style={styles.itemImagePlaceholder}>
                <Icon name="fast-food-outline" size={18} color="#666" />
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.item_name}</Text>
                {item.buy_one_get_one_free && (
                  <View style={styles.bogoTag}>
                    <Text style={styles.bogoText}>BOGO</Text>
                  </View>
                )}
                <Text style={styles.itemPrice}>₹{item.unit_price}</Text>
              </View>
              <Text style={styles.itemQuantity}>x{item.quantity}</Text>
            </View>
          ))}
          
          <View style={styles.orderSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{order.subtotal}</Text>
            </View>
            
            {order.coupon_discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{order.coupon_code_text || 'Discount'}</Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>-₹{order.coupon_discount}</Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>₹{order.delivery_fee}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.grandTotalLabel}>Total Paid</Text>
              <Text style={styles.grandTotalValue}>₹{order.total}</Text>
            </View>
            
            <View style={styles.paymentMethod}>
              <Icon name="card-outline" size={14} color="#666" />
              <Text style={styles.paymentMethodText}>{order.payment_method}</Text>
            </View>
          </View>
        </View>

        {/* Delivery Address */}
        <View style={styles.deliveryAddressCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressContent}>
            <Icon name="location-outline" size={18} color="#FF7A33" />
            <View style={styles.addressTextContainer}>
              <Text style={styles.addressType}>{order.delivery_address?.home_type || 'Home'}</Text>
              <Text style={styles.addressText}>{order.delivery_address?.address}</Text>
              {order.delivery_address?.landmark && (
                <Text style={styles.addressLandmark}>Landmark: {order.delivery_address.landmark}</Text>
              )}
              <Text style={styles.addressPhone}>
                <Icon name="call-outline" size={12} color="#666" /> {order.delivery_address?.phone_number}
              </Text>
            </View>
          </View>
        </View>

        {/* Last Updated Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Last updated {lastUpdated.format('h:mm A')} • Auto-refreshes every 30 seconds
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8'
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    ...Platform.select({
      ios: {
        paddingTop: 10
      }
    })
  },
  headerTitle: {
    fontSize: getResponsiveFontSize(18),
    fontWeight: '700',
    color: '#333'
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0'
  },
  headerRight: {
    width: 40
  },
  scrollContainer: {
    paddingBottom: 20
  },
  mapContainer: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0'
  },
  mapPlaceholderText: {
    marginTop: 10,
    fontSize: getResponsiveFontSize(14),
    color: '#666'
  },
  orderInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  kitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  kitchenImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#f0f0f0'
  },
  kitchenText: {
    flex: 1
  },
  kitchenNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  kitchenName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 8
  },
  kitchenStatus: {
    fontSize: getResponsiveFontSize(13),
    color: '#666'
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  deliveryInfoItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  deliveryText: {
    fontSize: getResponsiveFontSize(13),
    color: '#333',
    marginLeft: 4,
    fontWeight: '500'
  },
  deliveryEta: {
    fontSize: getResponsiveFontSize(13),
    color: '#333',
    fontWeight: '600',
    marginLeft: 4
  },
  lastUpdatedText: {
    fontSize: getResponsiveFontSize(11),
    color: '#888',
    marginLeft: 4
  },
  restaurantMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF7A33',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff'
  },
  deliveryMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF7A33',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff'
  },
  deliveryPartnerMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF7A33',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#fff'
  },
  mapToggleButton: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  expandButton: {
    bottom: 70,
    right: 12,
  },
  collapseButton: {
    top: 12,
    right: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 122, 51, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10
  },
  statusBadgeText: {
    fontSize: getResponsiveFontSize(11),
    fontWeight: '600'
  },
  statusTimeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineStep: {
    alignItems: 'center',
    width: 65,
    position: 'relative'
  },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#fff'
  },
  stepText: {
    fontSize: getResponsiveFontSize(11),
    color: '#888',
    textAlign: 'center',
    fontWeight: '500'
  },
  stepConnector: {
    position: 'absolute',
    top: 14,
    left: '50%',
    width: 65,
    height: 2,
    backgroundColor: '#eee',
    zIndex: -1
  },
  deliveryPartnerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  deliveryPartnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6
  },
  ratingText: {
    fontSize: getResponsiveFontSize(11),
    color: '#666',
    marginLeft: 2,
    fontWeight: '600'
  },
  deliveryPartnerContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  deliveryPartnerImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#f0f0f0'
  },
  deliveryPartnerInfo: {
    flex: 1
  },
  deliveryPartnerName: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#333',
    marginBottom: 3
  },
  deliveryPartnerMeta: {
    flexDirection: 'row',
    marginBottom: 3
  },
  deliveryPartnerVehicle: {
    fontSize: getResponsiveFontSize(12),
    color: '#666',
    marginRight: 10
  },
  contactText: {
    fontSize: getResponsiveFontSize(11),
    color: '#888'
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  orderDetailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  sectionTitle: {
    fontSize: getResponsiveFontSize(16),
    fontWeight: '700',
    color: '#333',
    marginBottom: 14
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  itemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  itemDetails: {
    flex: 1
  },
  itemName: {
    fontSize: getResponsiveFontSize(14),
    color: '#333',
    marginBottom: 3,
    fontWeight: '500'
  },
  bogoTag: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    alignSelf: 'flex-start',
    marginTop: 1,
    marginBottom: 3
  },
  bogoText: {
    fontSize: getResponsiveFontSize(9),
    color: '#333',
    fontWeight: 'bold'
  },
  itemPrice: {
    fontSize: getResponsiveFontSize(13),
    color: '#666'
  },
  itemQuantity: {
    fontSize: getResponsiveFontSize(14),
    color: '#333',
    fontWeight: '600'
  },
  orderSummary: {
    marginTop: 10
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  summaryLabel: {
    fontSize: getResponsiveFontSize(13),
    color: '#666'
  },
  summaryValue: {
    fontSize: getResponsiveFontSize(13),
    color: '#333',
    fontWeight: '500'
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 10
  },
  grandTotalLabel: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '700',
    color: '#333'
  },
  grandTotalValue: {
    fontSize: getResponsiveFontSize(15),
    fontWeight: '800',
    color: '#333'
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0'
  },
  paymentMethodText: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    marginLeft: 6
  },
  deliveryAddressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3
  },
  addressContent: {
    flexDirection: 'row'
  },
  addressTextContainer: {
    flex: 1,
    marginLeft: 10
  },
  addressType: {
    fontSize: getResponsiveFontSize(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: 3
  },
  addressText: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    marginBottom: 3,
    lineHeight: 18
  },
  addressLandmark: {
    fontSize: getResponsiveFontSize(12),
    color: '#888',
    marginBottom: 3
  },
  addressPhone: {
    fontSize: getResponsiveFontSize(13),
    color: '#666'
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center'
  },
  footerText: {
    fontSize: getResponsiveFontSize(11),
    color: '#888',
    textAlign: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 16,
    fontSize: getResponsiveFontSize(15),
    color: '#666'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorText: {
    fontSize: getResponsiveFontSize(16),
    color: '#FF7A33',
    fontWeight: '600',
    marginTop: 16
  },
  errorSubtext: {
    fontSize: getResponsiveFontSize(13),
    color: '#666',
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center'
  },
  goBackButton: {
    backgroundColor: '#FF7A33',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20
  },
  goBackButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: getResponsiveFontSize(14)
  },
});

export default TrackOrder;