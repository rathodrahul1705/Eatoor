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
        id: order.restaurant_details.restaurant_id,
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

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '';
      const isoString = dateString.replace(' ', 'T') + 'Z';
      const date = new Date(isoString);
      const formatted = date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return formatted;
    } catch (e) {
      console.error('Date formatting error:', e);
      return dateString;
    }
  };

  const handleCallRestaurant = () => {
    const contactNumber = orderDetails?.restaurant_details?.restaurant_contact;
    if (contactNumber) {
      Linking.openURL(`tel:${contactNumber}`)
        .catch(err => {
          console.error('Error opening phone app:', err);
          Alert.alert('Error', 'Could not make a call. Please check if your device supports calling.');
        });
    } else {
      Alert.alert('Info', 'Contact number not available for this restaurant.');
    }
  };

  // Calculate items subtotal
  const calculateItemsSubtotal = () => {
    if (!orderDetails?.items) return 0;
    return orderDetails.items.reduce((sum, item) => {
      return sum + (parseFloat(item.total_price) || 0);
    }, 0);
  };

  // Calculate the complete bill breakdown
  const calculateBillDetails = () => {
    if (!orderDetails) return null;

    const itemsSubtotal = calculateItemsSubtotal();
    const paymentDetails = orderDetails.payment_details || {};
    const couponDetails = orderDetails.coupon_details_details || {};
    
    // All possible charges
    const deliveryFee = parseFloat(paymentDetails.delivery_fee || '0');
    const taxAmount = parseFloat(paymentDetails.tax_amount || '0');
    const serviceFee = parseFloat(paymentDetails.service_fee || '0');
    const packagingFee = parseFloat(paymentDetails.packaging_fee || '0');
    const convenienceFee = parseFloat(paymentDetails.convenience_fee || '0');
    const insuranceFee = parseFloat(paymentDetails.insurance_fee || '0');
    const additionalCharges = parseFloat(paymentDetails.additional_charges || '0');
    const donationAmount = parseFloat(paymentDetails.donation_amount || '0');
    const tipAmount = parseFloat(paymentDetails.tip_amount || '0');
    
    // All possible discounts
    const couponDiscount = parseFloat(couponDetails.coupon_discount || '0');
    const additionalDiscount = parseFloat(paymentDetails.additional_discount || '0');
    
    // Calculate subtotal (Items + Delivery)
    const subtotalBeforeCharges = itemsSubtotal + deliveryFee;
    
    // Calculate total charges
    const totalCharges = taxAmount + serviceFee + packagingFee + convenienceFee + 
                        insuranceFee + additionalCharges + donationAmount + tipAmount;
    
    // Calculate total discounts
    const totalDiscounts = couponDiscount + additionalDiscount;
    
    // Calculate final total
    const finalTotal = subtotalBeforeCharges + totalCharges - totalDiscounts;
    
    // Payment method breakdown
    const paymentChecks = orderDetails.payment_method_checks || {};
    const walletPayment = parseFloat(paymentChecks.wallet_payment_amount || '0');
    const onlinePayment = parseFloat(paymentChecks.online_payment_amount || '0');
    const cashPayment = parseFloat(paymentChecks.cash_payment_amount || '0');
    
    return {
      itemsSubtotal: itemsSubtotal.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      packagingFee: packagingFee.toFixed(2),
      convenienceFee: convenienceFee.toFixed(2),
      insuranceFee: insuranceFee.toFixed(2),
      additionalCharges: additionalCharges.toFixed(2),
      donationAmount: donationAmount.toFixed(2),
      tipAmount: tipAmount.toFixed(2),
      couponDiscount: couponDiscount.toFixed(2),
      additionalDiscount: additionalDiscount.toFixed(2),
      subtotalBeforeCharges: subtotalBeforeCharges.toFixed(2),
      totalCharges: totalCharges.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
      finalTotal: finalTotal.toFixed(2),
      walletPayment: walletPayment.toFixed(2),
      onlinePayment: onlinePayment.toFixed(2),
      cashPayment: cashPayment.toFixed(2),
      hasWalletPayment: walletPayment > 0,
      hasOnlinePayment: onlinePayment > 0,
      hasCashPayment: cashPayment > 0,
      walletMethod: paymentChecks.wallet_payment_method || 'Wallet',
      onlineMethod: paymentChecks.online_payment_method || 'Online Payment',
      transactionId: paymentChecks.online_transaction_id,
    };
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

  const restaurantDetails = orderDetails.restaurant_details || {};
  const paymentDetails = orderDetails.payment_details || {};
  const deliveryAddress = orderDetails.delivery_address || {};
  const couponDetails = orderDetails.coupon_details_details || {};
  const paymentChecks = orderDetails.payment_method_checks || {};
  
  const billDetails = calculateBillDetails();

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
                uri: restaurantDetails.restaurant_image || 'https://via.placeholder.com/56',
                cache: 'force-cache'
              }}
              style={styles.kitchenImage} 
            />
            <View style={styles.kitchenInfo}>
              <Text style={styles.kitchenName}>{restaurantDetails.restaurant_name}</Text>
              <Text style={styles.kitchenAddress}>
                {restaurantDetails.restaurant_address_line || 'Address not available'}
              </Text>
            </View>
            {restaurantDetails.restaurant_contact && (
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
              paymentDetails.order_status === 'Delivered' ? styles.deliveredBadge : 
              paymentDetails.order_status === 'Pending' ? styles.pendingBadge : 
              paymentDetails.order_status === 'Cancelled' ? styles.cancelledBadge : 
              paymentDetails.order_status === 'Confirmed' ? styles.confirmedBadge : styles.onthewayBadge
            ]}>
              <Text style={styles.statusText}>{paymentDetails.order_status || 'Processing'}</Text>
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

        {/* Bill Summary Card - Complete Breakdown */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          
          {/* Items Subtotal */}
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Total</Text>
            <Text style={styles.billValue}>₹{billDetails.itemsSubtotal}</Text>
          </View>
          
          {/* Delivery Fee */}
          {parseFloat(billDetails.deliveryFee) > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={styles.billValue}>₹{billDetails.deliveryFee}</Text>
            </View>
          )}
          
          {/* Subtotal before additional charges */}
          <View style={[styles.billRow, styles.subtotalRow]}>
            <Text style={[styles.billLabel, styles.subtotalLabel]}>Subtotal</Text>
            <Text style={[styles.billValue, styles.subtotalValue]}>₹{billDetails.subtotalBeforeCharges}</Text>
          </View>
          
          {/* Additional Charges Section */}
          {(parseFloat(billDetails.taxAmount) > 0 || 
            parseFloat(billDetails.serviceFee) > 0 || 
            parseFloat(billDetails.packagingFee) > 0 ||
            parseFloat(billDetails.convenienceFee) > 0 ||
            parseFloat(billDetails.insuranceFee) > 0 ||
            parseFloat(billDetails.additionalCharges) > 0 ||
            parseFloat(billDetails.donationAmount) > 0 ||
            parseFloat(billDetails.tipAmount) > 0) && (
            <>
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Additional Charges</Text>
              </View>
              
              {/* Tax */}
              {parseFloat(billDetails.taxAmount) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Tax</Text>
                  <Text style={styles.billValue}>₹{billDetails.taxAmount}</Text>
                </View>
              )}
              
              {/* Service Fee */}
              {parseFloat(billDetails.serviceFee) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Service Fee</Text>
                  <Text style={styles.billValue}>₹{billDetails.serviceFee}</Text>
                </View>
              )}
              
              {/* Packaging Fee */}
              {parseFloat(billDetails.packagingFee) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Packaging Fee</Text>
                  <Text style={styles.billValue}>₹{billDetails.packagingFee}</Text>
                </View>
              )}
              
              {/* Convenience Fee */}
              {parseFloat(billDetails.convenienceFee) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Convenience Fee</Text>
                  <Text style={styles.billValue}>₹{billDetails.convenienceFee}</Text>
                </View>
              )}
              
              {/* Insurance Fee */}
              {parseFloat(billDetails.insuranceFee) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Insurance Fee</Text>
                  <Text style={styles.billValue}>₹{billDetails.insuranceFee}</Text>
                </View>
              )}
              
              {/* Additional Charges */}
              {parseFloat(billDetails.additionalCharges) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Additional Charges</Text>
                  <Text style={styles.billValue}>₹{billDetails.additionalCharges}</Text>
                </View>
              )}
              
              {/* Donation */}
              {parseFloat(billDetails.donationAmount) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Donation</Text>
                  <Text style={styles.billValue}>₹{billDetails.donationAmount}</Text>
                </View>
              )}
              
              {/* Tip */}
              {parseFloat(billDetails.tipAmount) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Tip</Text>
                  <Text style={styles.billValue}>₹{billDetails.tipAmount}</Text>
                </View>
              )}
              
              {/* Total Charges */}
              <View style={[styles.billRow, styles.chargesTotalRow]}>
                <Text style={[styles.billLabel, styles.chargesTotalLabel]}>Total Additional Charges</Text>
                <Text style={[styles.billValue, styles.chargesTotalValue]}>₹{billDetails.totalCharges}</Text>
              </View>
            </>
          )}
          
          {/* Discounts Section */}
          {(parseFloat(billDetails.couponDiscount) > 0 || parseFloat(billDetails.additionalDiscount) > 0) && (
            <>
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Discounts Applied</Text>
              </View>
              
              {/* Coupon Discount */}
              {parseFloat(billDetails.couponDiscount) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>
                    {couponDetails.coupon_code_text || 'Coupon Discount'}
                  </Text>
                  <Text style={[styles.billValue, styles.discountValue]}>-₹{billDetails.couponDiscount}</Text>
                </View>
              )}
              
              {/* Additional Discount */}
              {parseFloat(billDetails.additionalDiscount) > 0 && (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Additional Discount</Text>
                  <Text style={[styles.billValue, styles.discountValue]}>-₹{billDetails.additionalDiscount}</Text>
                </View>
              )}
              
              {/* Total Discounts */}
              <View style={[styles.billRow, styles.discountTotalRow]}>
                <Text style={[styles.billLabel, styles.discountTotalLabel]}>Total Discounts</Text>
                <Text style={[styles.billValue, styles.discountTotalValue]}>-₹{billDetails.totalDiscounts}</Text>
              </View>
            </>
          )}
          
          {/* Final Total */}
          <View style={styles.totalDivider} />
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={[styles.billLabel, styles.totalLabel]}>Final Amount Paid</Text>
            <Text style={[styles.billValue, styles.totalValue]}>₹{billDetails.finalTotal}</Text>
          </View>
          
          {/* Payment Method Breakdown */}
          {(billDetails.hasWalletPayment || billDetails.hasOnlinePayment || billDetails.hasCashPayment) && (
            <>
              <View style={styles.paymentDivider} />
              <Text style={[styles.sectionTitle, styles.paymentSectionTitle]}>Payment Method Breakdown</Text>
              
              {/* Wallet Payment */}
              {billDetails.hasWalletPayment && (
                <View style={styles.paymentMethodRow}>
                  <View style={styles.paymentMethodIconContainer}>
                    <Icon name="wallet-outline" size={16} color="#FF6B35" />
                  </View>
                  <Text style={styles.paymentMethodLabel}>{billDetails.walletMethod}</Text>
                  <Text style={styles.paymentMethodAmount}>₹{billDetails.walletPayment}</Text>
                </View>
              )}
              
              {/* Online Payment */}
              {billDetails.hasOnlinePayment && (
                <View style={styles.paymentMethodRow}>
                  <View style={styles.paymentMethodIconContainer}>
                    <Icon name="card-outline" size={16} color="#4CAF50" />
                  </View>
                  <Text style={styles.paymentMethodLabel}>{billDetails.onlineMethod}</Text>
                  <Text style={styles.paymentMethodAmount}>₹{billDetails.onlinePayment}</Text>
                </View>
              )}
              
              {/* Cash Payment */}
              {billDetails.hasCashPayment && (
                <View style={styles.paymentMethodRow}>
                  <View style={styles.paymentMethodIconContainer}>
                    <Icon name="cash-outline" size={16} color="#2196F3" />
                  </View>
                  <Text style={styles.paymentMethodLabel}>Cash on Delivery</Text>
                  <Text style={styles.paymentMethodAmount}>₹{billDetails.cashPayment}</Text>
                </View>
              )}
              
              {/* Payment Total */}
              <View style={[styles.paymentMethodRow, styles.paymentTotalRow]}>
                <Text style={[styles.paymentMethodLabel, styles.paymentTotalLabel]}>Total Paid</Text>
                <Text style={[styles.paymentMethodAmount, styles.paymentTotalAmount]}>
                  ₹{billDetails.finalTotal}
                </Text>
              </View>
              
              {/* Transaction ID if available */}
              {billDetails.transactionId && (
                <View style={styles.transactionContainer}>
                  <Text style={styles.transactionLabel}>Transaction ID:</Text>
                  <Text style={styles.transactionValue}>{billDetails.transactionId}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Payment Status Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={styles.detailRow}>
            <Icon name="card-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>
              Status: <Text style={[
                styles.paymentStatus,
                paymentDetails.payment_status === 'Paid' ? styles.paidStatus :
                paymentDetails.payment_status === 'Pending' ? styles.pendingStatus :
                paymentDetails.payment_status === 'Failed' ? styles.failedStatus :
                styles.otherStatus
              ]}>
                {paymentDetails.payment_status || 'Not specified'}
              </Text>
            </Text>
          </View>
          
          {paymentDetails.payment_method && (
            <View style={styles.detailRow}>
              <Icon name="receipt-outline" size={16} color="#666" style={styles.detailIcon} />
              <Text style={styles.detailText}>
                Method: {paymentDetails.payment_method}
              </Text>
            </View>
          )}
        </View>

        {/* Delivery Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.detailRow}>
            <Icon name="person-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{deliveryAddress.full_name || 'Not specified'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="call-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{deliveryAddress.phone_number || 'Not specified'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="location-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>
              {deliveryAddress.address || 'Address not available'}
              {deliveryAddress.landmark && ` (${deliveryAddress.landmark})`}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="home-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{deliveryAddress.home_type || 'Not specified'}</Text>
          </View>
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
          <Text style={styles.licenseText}>Restaurant ID: {restaurantDetails.restaurant_id || 'Not available'}</Text>
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity 
          style={styles.reorderButton}
          onPress={() => handleReorder(orderDetails)}
          disabled={paymentDetails.order_status === 'Cancelled'}
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
    fontSize: 9,
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
  confirmedBadge: {
    backgroundColor: '#e3f2fd',
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
  // Bill Summary Styles
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
    fontWeight: '600',
  },
  subtotalRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  subtotalLabel: {
    fontWeight: '600',
    color: '#333',
  },
  subtotalValue: {
    fontWeight: '600',
    color: '#333',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '700',
    color: '#333',
    fontSize: 15,
  },
  totalValue: {
    fontWeight: '700',
    color: '#FF6B35',
    fontSize: 16,
  },
  // Section Dividers
  sectionDivider: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginVertical: 8,
  },
  sectionDividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  // Charges and Discounts
  chargesTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  chargesTotalLabel: {
    fontWeight: '600',
    color: '#333',
  },
  chargesTotalValue: {
    fontWeight: '600',
    color: '#333',
  },
  discountTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  discountTotalLabel: {
    fontWeight: '600',
    color: '#333',
  },
  discountTotalValue: {
    fontWeight: '600',
    color: '#4CAF50',
  },
  // Payment Method Styles
  paymentDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  paymentSectionTitle: {
    marginBottom: 12,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  paymentMethodIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodLabel: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  paymentMethodAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderBottomWidth: 0,
  },
  paymentTotalLabel: {
    fontWeight: '700',
    fontSize: 15,
    color: '#333',
  },
  paymentTotalAmount: {
    fontWeight: '700',
    fontSize: 15,
    color: '#FF6B35',
  },
  transactionContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 6,
  },
  transactionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  transactionValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  // Detail Rows
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
  // Payment Status
  paymentStatus: {
    fontWeight: '600',
  },
  paidStatus: {
    color: '#4CAF50',
  },
  pendingStatus: {
    color: '#FF9800',
  },
  failedStatus: {
    color: '#F44336',
  },
  otherStatus: {
    color: '#666',
  },
  // Review Section
  reviewButton: {
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  reviewButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  licenseContainer: {
    padding: 12,
  },
  licenseText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  // Action Bar
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
  // Loading & Error
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