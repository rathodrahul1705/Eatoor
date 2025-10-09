import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getOrderDetails, getReOrderDetailsResponse } from '../../../api/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

const OrderDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUserAndOrderDetails = async () => {
      try {
        setLoading(true);
        
        // Fetch user data from AsyncStorage
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          
          // Fetch order details using user ID
          const response = await getOrderDetails({ 
            order_number: route.params.order.order_number,
            user_id: parsedUser.id 
          });

          if (response.status == 200 && response.data.orders?.length > 0) {
            setOrderDetails(response.data.orders[0]);
          } else {
            setError('No order details found');
          }
        } else {
          setError('User not logged in');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndOrderDetails();
  }, [route?.params?.order?.order_number]);

  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    try {
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);
  
  const handleReorder = async (order) => {
    if (!order) return;

    try {
      const newPastKitchenDetails = {
        id: order.restaurant_id,
      };

      savePastKitchenDetails(newPastKitchenDetails);

      const response = await getReOrderDetailsResponse(order.order_number);
      if (response.status === 200) {
        navigation.navigate('CartScreen');
      } else {
        Alert.alert('Error', 'Failed to reorder. Please try again.');
      }
    } catch (err) {
      console.error('Error reordering:', err);
      Alert.alert('Error', 'Failed to reorder. Please try again.');
    }
  };

  const VegNonVegIcon = ({ type = 'non-veg' }) => (
    <View style={[
      styles.vegNonVegIcon,
      type === 'veg' ? styles.vegIcon : styles.nonVegIcon
    ]}>
      <View style={[
        styles.vegNonVegInner,
        type === 'veg' ? styles.vegInner : styles.nonVegInner
      ]} />
    </View>
  );

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString; // Return original string if date parsing fails
    }
  };

  const handleCallRestaurant = () => {
    if (orderDetails?.restaurant_contact) {
      // Make a phone call
      Linking.openURL(`tel:${orderDetails.restaurant_contact}`)
        .catch(err => {
          console.error('Error opening phone app:', err);
          Alert.alert('Error', 'Could not make a call. Please check if your device supports calling.');
        });
    } else {
      Alert.alert('Info', 'Contact number not available for this restaurant.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No order details available</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button and title */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Kitchen Info Card */}
        <View style={styles.card}>
          <View style={styles.kitchenHeader}>
            <Image 
              source={{ 
                uri: orderDetails.restaurant_image || 'https://via.placeholder.com/56',
                cache: 'force-cache'
              }}
              style={styles.kitchenImage} 
            />
            <View style={styles.kitchenInfo}>
              <Text style={styles.kitchenName}>{orderDetails.restaurant_name}</Text>
              <Text style={styles.kitchenAddress}>
                {orderDetails?.restaurant_address_line || 'Address not available'}
              </Text>
            </View>
            {orderDetails.restaurant_contact && (
              <TouchableOpacity 
                style={styles.callButton}
                onPress={handleCallRestaurant}
              >
                <Icon name="call-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderIdText}>Order ID: {orderDetails.order_number}</Text>
            <View style={[
              styles.statusBadge,
              orderDetails.status === 'Delivered' ? styles.deliveredBadge : 
              orderDetails.status === 'Pending' ? styles.pendingBadge : 
              orderDetails.status === 'Cancelled' ? styles.cancelledBadge : styles.onthewayBadge
            ]}>
              <Text style={styles.statusText}>{orderDetails.status}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>Placed on: {formatDate(orderDetails.placed_on)}</Text>
          
          {/* Items List */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items Ordered</Text>
            {orderDetails.items?.map((item, index) => (
              <View key={`${item.item_name}-${index}`} style={styles.itemRow}>
                <VegNonVegIcon type={item.item_type} />
                <Text style={styles.itemName}>{item.item_name}</Text>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>₹{item.unit_price}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bill Summary Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{orderDetails.subtotal || '0.00'}</Text>
          </View>
          
          {orderDetails.coupon_discount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>{orderDetails.coupon_code_text || 'Discount'}</Text>
              <Text style={[styles.billValue, styles.discountValue]}>-₹{orderDetails.coupon_discount}</Text>
            </View>
          )}
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValue}>₹{orderDetails.delivery_fee || '0.00'}</Text>
          </View>
          
          <View style={styles.divider} />
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={[styles.billLabel, styles.totalLabel]}>Total Paid</Text>
            <Text style={[styles.billValue, styles.totalValue]}>₹{orderDetails.total || '0.00'}</Text>
          </View>
        </View>

        {/* Payment Method Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.detailRow}>
            <Icon name="card-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{orderDetails.payment_method || 'Not specified'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="time-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>Status: {orderDetails.payment_status || 'Not specified'}</Text>
          </View>
        </View>

        {/* Delivery Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          {orderDetails.delivery_address ? (
            <>
              <View style={styles.detailRow}>
                <Icon name="person-outline" size={16} color="#666" style={styles.detailIcon} />
                <Text style={styles.detailText}>{orderDetails.delivery_address.full_name || 'Not specified'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="call-outline" size={16} color="#666" style={styles.detailIcon} />
                <Text style={styles.detailText}>{orderDetails.delivery_address.phone_number || 'Not specified'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="location-outline" size={16} color="#666" style={styles.detailIcon} />
                <Text style={styles.detailText}>
                  {orderDetails.delivery_address.address || 'Address not available'}
                  {orderDetails.delivery_address.landmark && ` (${orderDetails.delivery_address.landmark})`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Icon name="home-outline" size={16} color="#666" style={styles.detailIcon} />
                <Text style={styles.detailText}>{orderDetails.delivery_address.home_type || 'Not specified'}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.detailText}>Delivery address not available</Text>
          )}
        </View>

        {/* Estimated Delivery */}
        {orderDetails.estimated_delivery && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Estimated Delivery</Text>
            <View style={styles.detailRow}>
              <Icon name="time-outline" size={16} color="#666" style={styles.detailIcon} />
              <Text style={styles.detailText}>{formatDate(orderDetails.estimated_delivery)}</Text>
            </View>
          </View>
        )}

        {/* Restaurant ID */}
        <View style={styles.licenseContainer}>
          <Text style={styles.licenseText}>Restaurant ID: {orderDetails.restaurant_id || 'Not available'}</Text>
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity 
          style={styles.reorderButton}
          onPress={() => handleReorder(orderDetails)}
          disabled={orderDetails.status === 'Cancelled'}
        >
          <Text style={styles.reorderButtonText}>Reorder</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kitchenImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
  },
  kitchenInfo: {
    flex: 1,
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  kitchenAddress: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  callButton: {
    padding: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderIdContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deliveredBadge: {
    backgroundColor: '#e3f9e5',
  },
  pendingBadge: {
    backgroundColor: '#fff3e0',
  },
  onthewayBadge: {
    backgroundColor: '#e0f7fa',
  },
  cancelledBadge: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Veg/Non-Veg Icons
  vegNonVegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  vegIcon: {
    borderColor: 'green',
  },
  nonVegIcon: {
    borderColor: 'red',
  },
  vegNonVegInner: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  vegInner: {
    backgroundColor: 'green',
  },
  nonVegInner: {
    backgroundColor: 'red',
  },
  itemsSection: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#888',
    marginHorizontal: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#333',
  },
  discountValue: {
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontWeight: '700',
    color: '#FF6B35',
    fontSize: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailIcon: {
    marginRight: 12,
    width: 16,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  licenseContainer: {
    padding: 12,
  },
  licenseText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  actionBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
  },
  reorderButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  reorderButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default OrderDetailsScreen;