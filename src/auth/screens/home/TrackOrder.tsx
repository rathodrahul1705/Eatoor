import React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';

// Dummy images configuration
const DUMMY_IMAGES = {
  DELIVERY_PARTNERS: [
    'https://randomuser.me/api/portraits/men/42.jpg',
    'https://randomuser.me/api/portraits/women/63.jpg',
    'https://randomuser.me/api/portraits/men/22.jpg',
    'https://randomuser.me/api/portraits/women/34.jpg'
  ],
  KITCHENS: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
    'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60'
  ],
  DEFAULT_AVATAR: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  DEFAULT_KITCHEN: 'https://cdn-icons-png.flaticon.com/512/1261/1261161.png'
};

// Delivery status constants
const DELIVERY_STATUS = {
  PREPARING: 'preparing',
  ON_THE_WAY: 'on_the_way',
  NEARBY: 'nearby',
  ARRIVED: 'arrived'
};

const { width, height } = Dimensions.get('window');

const TrackOrder = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { order } = route.params || {};
  
  // Animation for the delivery partner
  const [deliveryAnim] = useState(new Animated.Value(0));
  
  // Delivery state
  const [deliveryStatus, setDeliveryStatus] = useState(DELIVERY_STATUS.PREPARING);
  const [eta, setEta] = useState('25-30 mins');
  const [deliveryPartner] = useState({
    name: order?.deliveryPartner?.name || 'Rahul Kumar',
    phone: order?.deliveryPartner?.phone || '+919876543210',
    vehicle: order?.deliveryPartner?.vehicle || 'Bike',
    rating: order?.deliveryPartner?.rating || 4.8,
    image: order?.deliveryPartner?.image || DUMMY_IMAGES.DELIVERY_PARTNERS[Math.floor(Math.random() * DUMMY_IMAGES.DELIVERY_PARTNERS.length)]
  });
  
  // Default coordinates for map
  const defaultCoordinates = {
    restaurant: {
      latitude: 12.9716,
      longitude: 77.5946,
      title: 'Restaurant',
    },
    delivery: {
      latitude: 12.9685,
      longitude: 77.5873,
      title: 'Your Location',
    },
  };

  // Use order coordinates if available, otherwise use defaults
  const coordinates = order?.coordinates || defaultCoordinates;
  coordinates.restaurant.title = order?.kitchenName || 'Restaurant';

  // Simulate delivery progress
  useEffect(() => {
    const timer1 = setTimeout(() => {
      setDeliveryStatus(DELIVERY_STATUS.ON_THE_WAY);
      setEta('15-20 mins');
      animateDelivery(0.5, 3000);
    }, 5000);

    const timer2 = setTimeout(() => {
      setDeliveryStatus(DELIVERY_STATUS.NEARBY);
      setEta('5-7 mins');
      animateDelivery(0.8, 3000);
    }, 10000);

    const timer3 = setTimeout(() => {
      setDeliveryStatus(DELIVERY_STATUS.ARRIVED);
      setEta('1 min');
      animateDelivery(1, 2000);
    }, 15000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const animateDelivery = (toValue, duration) => {
    Animated.timing(deliveryAnim, {
      toValue,
      duration,
      useNativeDriver: false,
    }).start();
  };

  // Calculate current position based on animation
  const currentLatitude = deliveryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [coordinates.restaurant.latitude, coordinates.delivery.latitude],
  });

  const currentLongitude = deliveryAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [coordinates.restaurant.longitude, coordinates.delivery.longitude],
  });

  const getStatusDetails = () => {
    switch(deliveryStatus) {
      case DELIVERY_STATUS.PREPARING:
        return {
          title: 'Preparing your order',
          subtitle: 'Your food is being prepared at the kitchen',
          icon: 'restaurant-outline',
          step: 1,
          color: '#FFA000'
        };
      case DELIVERY_STATUS.ON_THE_WAY:
        return {
          title: 'On the way',
          subtitle: `Your order is picked up by ${deliveryPartner.name}`,
          icon: 'bicycle-outline',
          step: 2,
          color: '#2196F3'
        };
      case DELIVERY_STATUS.NEARBY:
        return {
          title: 'Almost there',
          subtitle: 'The delivery partner is nearby',
          icon: 'navigate-outline',
          step: 3,
          color: '#4CAF50'
        };
      case DELIVERY_STATUS.ARRIVED:
        return {
          title: 'Arrived at your location',
          subtitle: 'The delivery partner has arrived',
          icon: 'location-outline',
          step: 4,
          color: '#8BC34A'
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

  const handleCallDeliveryPartner = () => {
    const phoneNumber = Platform.OS === 'android' 
      ? `tel:${deliveryPartner.phone}` 
      : `telprompt:${deliveryPartner.phone}`;
    
    Linking.canOpenURL(phoneNumber)
      .then(supported => {
        if (!supported) {
          console.log("Phone calls not supported");
        } else {
          return Linking.openURL(phoneNumber);
        }
      })
      .catch(err => console.log(err));
  };

  const statusDetails = getStatusDetails();

  // Fallback for missing order data
  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Track Order</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="warning-outline" size={40} color="#FF5722" />
          <Text style={styles.errorText}>No order data available</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Track Order</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* ETA Section */}
        <View style={[styles.etaContainer, { backgroundColor: statusDetails.color }]}>
          <Icon name="time-outline" size={20} color="#fff" style={styles.etaIcon} />
          <Text style={styles.etaText}>
            Estimated delivery: <Text style={styles.etaTime}>{eta}</Text>
          </Text>
        </View>

        {/* Progress Tracking */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { 
                  width: deliveryAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  }),
                  backgroundColor: statusDetails.color
                }
              ]} 
            />
          </View>
          
          <View style={styles.progressSteps}>
            {[1, 2, 3, 4].map((step) => (
              <View key={step} style={styles.progressStep}>
                <View style={[
                  styles.stepIcon, 
                  statusDetails.step >= step && { backgroundColor: statusDetails.color }
                ]}>
                  <Icon 
                    name="checkmark" 
                    size={16} 
                    color={statusDetails.step >= step ? '#fff' : '#888'} 
                  />
                </View>
                <Text style={[
                  styles.stepText,
                  statusDetails.step >= step && { color: statusDetails.color, fontWeight: '600' }
                ]}>
                  {step === 1 && 'Ordered'}
                  {step === 2 && 'Preparing'}
                  {step === 3 && 'On the way'}
                  {step === 4 && 'Delivered'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Current Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusIcon, { backgroundColor: `${statusDetails.color}20` }]}>
            <Icon name={statusDetails.icon} size={28} color={statusDetails.color} />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>{statusDetails.title}</Text>
            <Text style={styles.statusSubtitle}>{statusDetails.subtitle}</Text>
          </View>
        </View>

        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: (coordinates.restaurant.latitude + coordinates.delivery.latitude) / 2,
              longitude: (coordinates.restaurant.longitude + coordinates.delivery.longitude) / 2,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02 * (width / height),
            }}
            loadingEnabled={true}
            loadingIndicatorColor={statusDetails.color}
          >
            <Marker
              coordinate={coordinates.restaurant}
              title={coordinates.restaurant.title}
              description="Restaurant Location"
            >
              <View style={[styles.restaurantMarker, { backgroundColor: statusDetails.color }]}>
                <Icon name="restaurant" size={20} color="#fff" />
              </View>
            </Marker>
            
            <Marker
              coordinate={coordinates.delivery}
              title={coordinates.delivery.title}
              description="Delivery Address"
            >
              <View style={styles.deliveryMarker}>
                <Icon name="location" size={20} color="#fff" />
              </View>
            </Marker>
            
            <Animated.Marker
              coordinate={{
                latitude: currentLatitude,
                longitude: currentLongitude,
              }}
              title="Delivery Partner"
              description={`${deliveryPartner.name} (${deliveryPartner.vehicle})`}
            >
              <Animated.View style={[
                styles.deliveryPartnerMarker, 
                { 
                  backgroundColor: statusDetails.color,
                  transform: [{
                    rotate: deliveryAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg']
                    })
                  }]
                }
              ]}>
                <Icon name="bicycle" size={24} color="#fff" />
              </Animated.View>
            </Animated.Marker>
          </MapView>
        </View>

        {/* Delivery Partner Info */}
        <View style={styles.deliveryPartnerContainer}>
          <Image 
            source={{ uri: deliveryPartner.image }} 
            style={styles.deliveryPartnerImage}
            defaultSource={{ uri: DUMMY_IMAGES.DEFAULT_AVATAR }}
            onError={() => deliveryPartner.image = DUMMY_IMAGES.DEFAULT_AVATAR}
          />
          <View style={styles.deliveryPartnerInfo}>
            <Text style={styles.deliveryPartnerName}>{deliveryPartner.name}</Text>
            <View style={styles.deliveryPartnerMeta}>
              <Text style={styles.deliveryPartnerVehicle}>
                <Icon name="bicycle" size={14} color="#666" /> {deliveryPartner.vehicle}
              </Text>
              <Text style={styles.deliveryPartnerRating}>
                <Icon name="star" size={14} color="#FFC107" /> {deliveryPartner.rating}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.callButton, { borderColor: statusDetails.color }]}
            onPress={handleCallDeliveryPartner}
          >
            <Icon name="call" size={20} color={statusDetails.color} />
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummaryContainer}>
          <Text style={styles.sectionTitle}>Your Order</Text>
          
          <View style={styles.kitchenInfo}>
            <Image 
              source={{ uri: order.kitchenImage || DUMMY_IMAGES.KITCHENS[0] }} 
              style={styles.kitchenImage}
              defaultSource={{ uri: DUMMY_IMAGES.DEFAULT_KITCHEN }}
              onError={() => order.kitchenImage = DUMMY_IMAGES.DEFAULT_KITCHEN}
            />
            <Text style={styles.kitchenName}>{order.kitchenName || 'Kitchen'}</Text>
          </View>
          
          <View style={styles.orderItems}>
            {(order.items || []).map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Text style={styles.itemQuantity}>x{item.quantity || 1}</Text>
                <Text style={styles.itemName}>{item.name || 'Item'}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.orderTotal}>
            <Text style={styles.totalText}>Total Paid</Text>
            <Text style={styles.totalAmount}>{order.orderPrice || '₹0'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  etaContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etaIcon: {
    marginRight: 8,
  },
  etaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  etaTime: {
    fontWeight: '800',
  },
  progressContainer: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 24,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
  },
  progressStep: {
    alignItems: 'center',
    minWidth: 70,
  },
  stepIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  mapContainer: {
    height: 250,
    marginTop: 8,
    backgroundColor: '#fff',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  restaurantMarker: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryMarker: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryPartnerMarker: {
    padding: 10,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryPartnerContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deliveryPartnerImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    backgroundColor: '#f0f0f0',
  },
  deliveryPartnerInfo: {
    flex: 1,
  },
  deliveryPartnerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deliveryPartnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryPartnerVehicle: {
    fontSize: 13,
    color: '#666',
    marginRight: 12,
  },
  deliveryPartnerRating: {
    fontSize: 13,
    color: '#666',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderSummaryContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  kitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  kitchenImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderItems: {
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  itemQuantity: {
    width: 30,
    fontSize: 14,
    color: '#666',
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  orderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#FF5722',
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default TrackOrder;