import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar, 
  FlatList, 
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Animated,
  Easing,
  Platform,
  TouchableWithoutFeedback,
  KeyboardAvoidingView
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCartDetails, updateCart, createPayment, verifyPayment, updatePyamentData } from '../../../api/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from '@react-native-community/blur';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_API_KEY } from '@env';

const { width, height } = Dimensions.get('window');

// Responsive scaling functions
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Responsive font sizes based on screen width
const normalize = (size: number) => Math.round(scale(size));

const FONT = {
  S: normalize(10),
  XS: normalize(10),
  SM: normalize(12),
  BASE: normalize(14),
  LG: normalize(16),
  XL: normalize(18),
  XXL: normalize(20),
  XXXL: normalize(24),
};

// Minimum order value constant
const MINIMUM_ORDER_VALUE = 50;

// Type definitions (updated with new fields)
type CartItem = {
  item_id: number;
  id: number;
  restaurant_id: string;
  restaurant_name: string;
  item_name: string;
  item_description: string;
  discount_active: number;
  discount_percent: number;
  item_price: number;
  original_item_price: number;
  buy_one_get_one_free: boolean;
  quantity: number;
  item_image: string;
  type?: 'Veg' | 'Non-Veg';
};

type SuggestedItem = {
  item_name: string;
  item_id: number;
  item_price: number;
  item_image: string;
  type?: 'Veg' | 'Non-Veg';
  quantity?: number;
  original_item_price?: number;
  discount_active?: number;
  discount_percent?: number;
};

type DeliveryAddress = {
  id: number;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type?: string;
};

type DeliveryTime = {
  estimated_time: string;
  is_express_available: boolean;
};

type BillingDetails = {
  subtotal: number;
  delivery_amount: number;
  tax: number;
  total: number;
  currency: string;
  distance_km?: number;
  estimated_delivery_cost?: number;
};

type CartApiResponse = {
  status: string;
  restaurant_name: string;
  cart_details: CartItem[];
  suggestion_cart_items: SuggestedItem[];
  delivery_address_details: DeliveryAddress;
  delivery_time: DeliveryTime;
  billing_details: BillingDetails;
  distance_km: number;
  estimated_delivery_cost: number;
};

type UserData = {
  id: string;
  name: string;
  email: string;
  contact_number: string;
};

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed' | 'cancelled';

interface RazorpayOrderResponse {
  status: string;
  data: {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    offer_id: null | string;
    status: string;
    attempts: number;
    created_at: number;
  };
}

interface VerifyPaymentResponse {
  status: string;
  payment_id: number;
  order_status: number;
  eatoor_order_number: string;
  payment_method: string;
  payment_status: string;
  amount_paid: number;
  eatoor_order_id: number;
}

interface UpdateOrderResponse {
  status: string;
  order_number: string;
  order_id: number;
  total_amount: string;
  estimated_prep_time: number;
}

type PaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type PaymentVerificationState = {
  verifying: boolean;
  message: string;
  success: boolean;
};

// Helper function to safely format prices and text
const safeText = (text: any, fallback: string = ''): string => {
  if (text === null || text === undefined || text === '') {
    return fallback;
  }
  return String(text);
};

const safePrice = (price: any): number => {
  const num = parseFloat(price);
  return isNaN(num) ? 0 : num;
};

const CartScreen = ({ route, navigation }) => {
  const [cartData, setCartData] = useState<CartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<{id: number, action: 'increment' | 'decrement' | 'add'}[]>([]);
  const [user, setUser] = useState<UserData | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [shortAddress, setShortAddress] = useState<string>("Select Address");
  const [fullAddress, setFullAddress] = useState<string>("Select Address");
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [orderDetails, setOrderDetails] = useState<{
    order_id: number;
    order_number: string;
  } | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [paymentVerification, setPaymentVerification] = useState<PaymentVerificationState>({
    verifying: false,
    message: '',
    success: false
  });
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [showBlurOverlay, setShowBlurOverlay] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  const userId = user?.id;
  const sessionId = "";
  const kitchenId = pastKitchenDetails?.id;

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        const savedAddressId = await AsyncStorage.getItem('AddressId');
        if (userData) {
          setUser(JSON.parse(userData));
        }
        if (savedAddressId) {
          setAddressId(savedAddressId);
        }

        const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');
        if (storedDetails) {
          setPastKitchenDetails(JSON.parse(storedDetails));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Fetch cart data when dependencies change
  useEffect(() => {
    if (kitchenId && userId) {
      fetchCartData();
    }
  }, [userId, kitchenId, addressId]);

  // Handle payment status animations
  useEffect(() => {
    if (paymentStatus === 'processing' || paymentVerification.verifying) {
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else if (paymentStatus === 'success' || paymentStatus === 'failed') {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [paymentStatus, paymentVerification.verifying]);

  // Handle modal slide animation
  useEffect(() => {
    if (showPaymentModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showPaymentModal]);

  const fetchCartData = async () => {
    if (!kitchenId) {
      setError('No restaurant selected');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await getCartDetails({
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId,
        address_id: addressId
      });
      
      if (response.status === 200) {
        const updatedResponse = response.data;
        
        if (updatedResponse.cart_details && updatedResponse.suggestion_cart_items) {
          updatedResponse.suggestion_cart_items = updatedResponse.suggestion_cart_items.map(suggestedItem => {
            const cartItem = updatedResponse.cart_details.find(item => item.item_id === suggestedItem.item_id);
            return cartItem ? {
              ...suggestedItem,
              quantity: cartItem.quantity,
              original_item_price: cartItem.original_item_price,
              discount_active: cartItem.discount_active,
              discount_percent: cartItem.discount_percent,
              item_price: cartItem.item_price
            } : {
              ...suggestedItem,
              quantity: 0
            };
          });
        }
        
        setCartData(updatedResponse);
        updateAddressDisplay(updatedResponse);
      } else {
        setError('Failed to load cart data');
      }
    } catch (err) {
      console.error('Error fetching cart data:', err);
      setError('An error occurred while loading your cart');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const updateAddressDisplay = async (cartResponse?: CartApiResponse) => {
    try {
      let address = "";
      let homeType = "";
      const estimatedTime = cartResponse?.delivery_time?.estimated_time || "";
      
      if (cartResponse?.delivery_address_details?.address_line1) {
        address = safeText(cartResponse.delivery_address_details.address_line1);
        if (cartResponse.delivery_address_details.address_line2) {
          address += `, ${safeText(cartResponse.delivery_address_details.address_line2)}`;
        }
        homeType = safeText(cartResponse.delivery_address_details.address_type);
      } else {
        address = safeText(await AsyncStorage.getItem("StreetAddress"));
        homeType = safeText(await AsyncStorage.getItem("HomeType"));
      }

      // Fix: Ensure we're working with strings and handle empty cases
      const safeAddress = address || "Select Address";
      const safeHomeType = homeType || "";
      
      const shortAddr = safeAddress.length > 18 ? `${safeAddress.substring(0, 18)}...` : safeAddress;
      const shortAddressText = safeHomeType ? `${safeHomeType} | ${shortAddr}` : shortAddr;
      setShortAddress(estimatedTime ? `${estimatedTime} | ${shortAddressText}` : shortAddressText);

      const fullAddressText = safeHomeType ? `${safeHomeType} | ${safeAddress}` : safeAddress;
      setFullAddress(estimatedTime ? `${estimatedTime} | ${fullAddressText.substring(0, 50)}...` : fullAddressText);
    } catch (error) {
      console.error('Error formatting address:', error);
      setShortAddress("Select Address");
      setFullAddress("Select Address");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCartData();
  };

  const handleAddressChange = async () => {
    navigation.navigate('AddressScreen', { 
      prevLocation: 'CartScreen',
      onAddressSelect: async (selectedAddressId: string | number) => {
        try {
          await AsyncStorage.setItem('AddressId', String(selectedAddressId.id));
          setAddressId(String(selectedAddressId.id));
          fetchCartData();
        } catch (error) {
          console.error('Error saving address:', error);
        }
      }
    });
  };

  const showPaymentStatusModal = (status: PaymentStatus, message: string, orderNumber?: string) => {
    setPaymentStatus(status);
    setPaymentMessage(message);
    setShowPaymentModal(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start(() => {
      if (status === 'success' && orderNumber) {
        AsyncStorage.removeItem('pastKitchenDetails');
        setTimeout(() => {
          setShowPaymentModal(false);
          navigation.navigate('TrackOrder', { order: { order_number: orderNumber } });
        }, 300);
      }
    });
  };

  const createRazorpayOrder = async (): Promise<string> => {
    if (!cartData || !userId || !kitchenId) {
      throw new Error('Required data missing for creating order');
    }

    try {
      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        amount: cartData.billing_details.total * 100, // Convert to paise
        currency: 'INR',
        receipt: `order_${Date.now()}`
      };

      const response = await createPayment(payload);
      
      if (response.status === 200) {
        return response.data.data.id;
      } else {
        throw new Error(response.data.message || 'Failed to create Razorpay order');
      }
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    }
  };

  const verifyPaymentStatus = async (paymentResponse: PaymentResponse) => {
    if (!cartData || !userId || !kitchenId || !addressId) {
      console.error("Missing required payment data");
      showPaymentStatusModal('failed', 'Required data missing for payment verification');
      return;
    }

    try {
      // Step 1: Update order details with payment info
      const updateResponse = await updateOrderDetails(paymentResponse.razorpay_payment_id);

      // Step 2: Prepare verification payload
      const payload = {
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        amount: cartData.billing_details.total,
        deliveryAddressId: addressId,
        payment_type: 2, // Online payment
        eatoor_order_id: updateResponse.order_id,
        restaurant_id: kitchenId,
        restaurantName: cartData.restaurant_name,
      };

      // Step 3: Verify with backend
      const response = await verifyPayment(payload);

      if (response.status === 200) {
        const verificationData = response.data as VerifyPaymentResponse;

        // ✅ Store order details
        setOrderDetails({
          order_id: verificationData.eatoor_order_id,
          order_number: verificationData.eatoor_order_number
        });

        // ✅ Update verification state
        setPaymentVerification({
          verifying: false,
          message: 'Payment verified successfully!',
          success: true
        });

        // ✅ Pass order number directly to modal (avoids async state issue)
        showPaymentStatusModal('success', 'Payment successful! Redirecting to order details...', verificationData.eatoor_order_number);
      } else {
        throw new Error(response.data.message || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);

      setPaymentVerification({
        verifying: false,
        message: 'Payment verification failed',
        success: false
      });

      showPaymentStatusModal('failed', 'Payment verification failed');
    }
  };

  const updateOrderDetails = async (
    razorpayPaymentId: string
  ): Promise<UpdateOrderResponse> => {
    if (!cartData || !kitchenId || !addressId || !userId) {
      throw new Error('Required data missing for updating order');
    }

    try {
      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        payment_method: 2, // Online payment
        payment_type: 2, // Online payment
        delivery_address_id: addressId,
        is_takeaway: false,
        special_instructions: '',
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        delivery_amount: cartData.billing_details.delivery_amount,
        delivery_fee: cartData.billing_details.delivery_amount,
        total_amount: cartData.billing_details.total,
        code: null,
        discount_amount: cartData.billing_details.subtotal - cartData.billing_details.total
      };

      const response = await updatePyamentData(payload);
      if (response.status === 201) {
        return response.data;
      } else {
        console.error('Failed to update order details:', response.data);
        throw new Error(response.data.message || 'Failed to update order details');
      }
    } catch (error) {
      console.error('Error updating order details:', error);
      throw error;
    }
  };

  const initiatePayment = async () => {
    if (!cartData || !user) {
      Alert.alert('Error', 'Cart data or user information is missing');
      return;
    }
    
    // Check minimum order value
    if (cartData.billing_details.total < MINIMUM_ORDER_VALUE) {
      Alert.alert(
        'Minimum Order Value',
        `Your order total is ₹${cartData.billing_details.total.toFixed(2)}. Minimum order value is ₹${MINIMUM_ORDER_VALUE}. Please add more items to proceed.`,
        [
          { text: 'OK' },
          {
            text: 'Browse Menu',
            onPress: BackToKitchen
          }
        ]
      );
      return;
    }
    
    if (!addressId) {
      Alert.alert(
        'Address Required',
        'Please select a delivery address before proceeding to payment',
        [
          {
            text: 'OK',
          },
          {
            text: 'Select Address',
            onPress: () => {
              handleAddressChange();
            }
          }
        ]
      );
      return;
    }
    
    setPaymentStatus('processing');
    setShowBlurOverlay(true);
    
    try {
      // Create Razorpay order first
      const orderId = await createRazorpayOrder();
      setRazorpayOrderId(orderId);

      const options = {
        description: `Order from ${cartData.restaurant_name}`,
        image: 'https://www.eatoor.com/eatoormob.svg',
        currency: 'INR',
        key: RAZORPAY_API_KEY,
        amount: cartData.billing_details.total * 100, // Amount in paise
        name: user.name,
        order_id: orderId,
        prefill: {
          email: user.email,
          contact: user.contact_number,
          name: user.name
        },
        theme: { color: '#E65C00' }
      };

      RazorpayCheckout.open(options)
        .then(async (data: PaymentResponse) => {
          // Start verification process
          setPaymentVerification({
            verifying: true,
            message: 'Verifying your payment...',
            success: false
          });
          
          try {
            await verifyPaymentStatus(data);
            setVerificationComplete(true);
          } catch (error) {
            console.error('Payment verification error:', error);
            setPaymentVerification({
              verifying: false,
              message: 'Payment verification failed',
              success: false
            });
            showPaymentStatusModal('failed', 'Payment verification failed. Please check your order history.');
          } finally {
            setShowBlurOverlay(false);
          }
        })
        .catch((error) => {
          setShowBlurOverlay(false);
          console.log("error===",error)
          if (error.description == 'Payment Cancelled' || error.error.description == "undefined") {
            showPaymentStatusModal('cancelled', 'Payment was cancelled by user');
          } else {
            showPaymentStatusModal('failed', error.description || 'Payment could not be completed');
          }
        });
    } catch (error) {
      console.error('Payment error:', error);
      setShowBlurOverlay(false);
      showPaymentStatusModal('failed', error.message || 'An error occurred while processing payment');
    } finally {
      setPaymentStatus('idle');
    }
  };

  const updateItemQuantity = async (itemId: number, action: 'increment' | 'decrement', source: 'CART' | 'SUGGESTION' = 'CART') => {
    if (!cartData || !kitchenId) return;

    setUpdatingItems(prev => [...prev, {id: itemId, action}]);
    
    try {
      const payload = {
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId,
        item_id: itemId,
        source: source,
        quantity: 1,
        action: action === 'increment' ? 'add' : 'remove'
      };

      const response = await updateCart(payload);
      
      if (response.status === 200) {
        await fetchCartData();
      } else {
        console.error('Failed to update cart:', response.data.message);
        Alert.alert('Error', 'Failed to update cart. Please try again.');
      }
    } catch (err) {
      console.error('Error updating cart:', err);
      Alert.alert('Error', 'An error occurred while updating your cart.');
    } finally {
      setUpdatingItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const BackToKitchen = () => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchenId });
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.some(i => i.id === item.item_id);
    const currentAction = isUpdating 
      ? updatingItems.find(i => i.id === item.item_id)?.action 
      : null;

    const itemPrice = safePrice(item.item_price);
    const originalPrice = safePrice(item.original_item_price);
    const discountPercent = safePrice(item.discount_percent);

    return (
      <View style={styles.cartItemContainer}>
        <View style={styles.cartItemContent}>
          <View style={styles.itemTypeContainer}>
            <View style={[
              styles.itemTypeBadge,
              item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
            ]}>
              <View style={[
                styles.itemTypeIndicator,
                item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
              ]} />
            </View>
          </View>
          
          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={1}>
              {safeText(item.item_name, 'Unnamed Item')}
            </Text>            
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{originalPrice.toFixed(2)}</Text>
                <Text style={styles.discountText}>{discountPercent}% OFF</Text>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{itemPrice.toFixed(2)}</Text>
            
            {item.buy_one_get_one_free && (
              <View style={styles.bogoBadge}>
                <Text style={styles.bogoText}>BOGO</Text>
              </View>
            )}
          </View>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={[
                styles.quantityButton,
                styles.disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
            >
              {isUpdating && currentAction === 'decrement' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="remove" size={scale(14)} color={"#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{safeText(item.quantity, '0')}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
              disabled={isUpdating}
            >
              {isUpdating && currentAction === 'increment' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="add" size={scale(14)} color="#E65C00" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSuggestedItem = ({ item }: { item: SuggestedItem }) => {
    const isUpdating = updatingItems.some(i => i.id === item.item_id);
    const currentAction = isUpdating 
      ? updatingItems.find(i => i.id === item.item_id)?.action 
      : null;
    
    const quantity = item.quantity || 0;
    const itemPrice = safePrice(item.item_price);
    const originalPrice = safePrice(item.original_item_price);
    const discountPercent = safePrice(item.discount_percent);

    return (
      <View style={styles.suggestedItemCard}>
        <Image 
          source={{ uri: item.item_image || 'https://via.placeholder.com/150' }} 
          style={styles.suggestedItemImage} 
          resizeMode="cover"
        />
        <View style={styles.suggestedItemContent}>
          <View style={styles.suggestedItemHeader}>
            <View style={[
              styles.suggestedItemTypeBadge,
              item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
            ]}>
              <View style={[
                styles.suggestedItemTypeIndicator,
                item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
              ]} />
            </View>
            <Text style={styles.suggestedItemName} numberOfLines={1}>
              {safeText(item.item_name, 'Unnamed Item')}
            </Text>
          </View>
          
          <View style={styles.suggestedItemDetails}>
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{originalPrice.toFixed(2)}</Text>
                <Text style={styles.discountText}>{discountPercent}% OFF</Text>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{itemPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.suggestedItemFooter}>
            {quantity > 0 ? (
              <View style={styles.quantityContainer}>
                <TouchableOpacity 
                  style={[
                    styles.quantityButton,
                    quantity <= 1 && styles.disabledButton
                  ]} 
                  onPress={() => updateItemQuantity(item.item_id, 'decrement', 'SUGGESTION')}
                  disabled={isUpdating || quantity <= 1}
                >
                  {isUpdating && currentAction === 'decrement' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="remove" size={scale(14)} color={quantity <= 1 ? "#ccc" : "#E65C00"} />
                  )}
                </TouchableOpacity>
                
                <Text style={styles.quantityText}>{safeText(quantity, '0')}</Text>
                
                <TouchableOpacity 
                  style={styles.quantityButton} 
                  onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                  disabled={isUpdating}
                >
                  {isUpdating && currentAction === 'increment' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="add" size={scale(14)} color="#E65C00" />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.addItemButton,
                  isUpdating && styles.addItemButtonDisabled
                ]}
                onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                disabled={isUpdating}
              >
                {isUpdating && currentAction === 'increment' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addItemButtonText}>ADD</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyHeader}>
        <TouchableOpacity 
          onPress={BackToKitchen}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={scale(24)} color="#333" />
        </TouchableOpacity>
        <Text style={styles.emptyHeaderTitle}>
          {safeText(cartData?.restaurant_name, 'Your Cart')}
        </Text>
        <View style={{ width: scale(24) }} />
      </View>
      
      <View style={styles.emptyContent}>
        <View style={styles.emptyIllustration}>
          <Icon name="cart-outline" size={scale(80)} color="#E8ECF4" />
          <View style={styles.emptyIconOverlay}>
            <Icon name="close" size={scale(40)} color="#E65C00" />
          </View>
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyDescription}>
          Looks like you haven't added anything to your cart yet
        </Text>
        
        <TouchableOpacity 
          style={styles.exploreButton}
          onPress={BackToKitchen}
        >
          <Text style={styles.exploreButtonText}>Browse Menu</Text>
          <Icon name="arrow-forward" size={scale(20)} color="#fff" />
        </TouchableOpacity>
      </View>

      {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
        <View style={styles.emptySuggestionsContainer}>
          <Text style={styles.suggestionTitle}>
            Popular Items from {safeText(cartData.restaurant_name, 'this restaurant')}
          </Text>
          <FlatList
            data={cartData.suggestion_cart_items}
            renderItem={renderSuggestedItem}
            keyExtractor={item => safeText(item.item_id, '0')}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedItemsContainer}
          />
        </View>
      )}
    </View>
  );

  const renderCartContent = () => (
    <KeyboardAvoidingView 
      style={styles.scrollContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E65C00']}
            tintColor="#E65C00"
          />
        }
      >
        {/* Your Order Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Order</Text>
            <View style={styles.itemCountBadge}>
              <Text style={styles.itemCountText}>
                {safeText(cartData?.cart_details.length, '0')} {cartData?.cart_details.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
          </View>
          
          <View style={styles.cartItemsList}>
            <FlatList
              data={cartData?.cart_details}
              renderItem={renderCartItem}
              keyExtractor={item => safeText(item.id, '0')}
              scrollEnabled={false}
            />
          </View>
        </View>
        
        {/* Add More Items Section - Single Row */}
        {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Add More Items
              </Text>
            </View>
            <View style={styles.suggestedItemsRowContainer}>
              <FlatList
                data={cartData.suggestion_cart_items}
                renderItem={renderSuggestedItem}
                keyExtractor={item => safeText(item.item_id, '0')}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestedItemsHorizontalContainer}
              />
            </View>
          </View>
        )}
        
        {/* Delivery Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Icon name="location-outline" size={scale(20)} color="#E65C00" />
              </View>
              <View style={styles.addressContainer}>
                <Text style={styles.detailText}>
                  {fullAddress !== "Select Address" ? fullAddress : "Please select a delivery address"}
                </Text>
                <TouchableOpacity 
                  style={styles.changeAddressButton}
                  onPress={handleAddressChange}
                >
                  <Text style={styles.changeAddressText}>
                    {fullAddress !== "Select Address" ? "Change" : "Add"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {cartData?.delivery_time?.estimated_time && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>Deliver by {safeText(cartData.delivery_time.estimated_time)}</Text>
              </View>
            )}
            
            {/* Display Distance Information */}
            {cartData?.billing_details.distance_km && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="navigate-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>
                  Distance: {safePrice(cartData.billing_details.distance_km).toFixed(1)} km
                </Text>
              </View>
            )}
            
            {/* Display Estimated Delivery Cost */}
            {cartData?.billing_details.estimated_delivery_cost && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="pricetag-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>
                  Estimated Delivery: ₹{safePrice(cartData.billing_details.estimated_delivery_cost).toFixed(2)}
                </Text>
              </View>
            )}
            
            {user?.contact_number && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="call-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>Contact: {safeText(user.contact_number)}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Bill Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          
          <View style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>
                ₹{safePrice(cartData?.billing_details.subtotal).toFixed(2)}
              </Text>
            </View>
            
            {cartData?.billing_details.delivery_amount ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>
                  Delivery Fee {cartData.billing_details.distance_km ? 
                    `| ${safePrice(cartData.billing_details.distance_km).toFixed(1)} km` : ''}
                </Text>
                <Text style={styles.billValue}>
                  ₹{safePrice(cartData.billing_details.delivery_amount).toFixed(2)}
                </Text>
              </View>
            ) : null}
            
            {cartData?.billing_details.tax ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Tax</Text>
                <Text style={styles.billValue}>
                  ₹{safePrice(cartData.billing_details.tax).toFixed(2)}
                </Text>
              </View>
            ) : null}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>
                ₹{safePrice(cartData?.billing_details.total).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Note Section */}
        <View style={styles.noteCard}>
          <View style={styles.noteIconContainer}>
            <Icon name="information-circle-outline" size={scale(20)} color="#E65C00" />
          </View>
          <Text style={styles.noteText}>Order cannot be cancelled once packed for delivery</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPaymentFooter = () => {
    if (!cartData || !cartData.cart_details || cartData.cart_details.length === 0) {
      return null;
    }

    if (paymentVerification.verifying) {
      return (
        <View style={[styles.paymentFooter, { backgroundColor: '#fff' }]}>
          <View style={styles.verificationContainer}>
            <ActivityIndicator size="small" color="#E65C00" />
            <Text style={styles.verificationText}>
              Verifying your payment...
            </Text>
          </View>
        </View>
      );
    }

    const totalAmount = safePrice(cartData.billing_details.total);

    return (
      <View style={styles.paymentFooter}>
        <View style={styles.paymentFooterContent}>
          <View style={styles.totalAmountContainer}>
            <Text style={styles.totalAmountLabel}>Total Amount</Text>
            <Text style={styles.totalAmountValue}>₹{totalAmount.toFixed(2)}</Text>
          </View>
          {addressId ? (
            <TouchableOpacity 
              style={styles.payButton}
              onPress={initiatePayment}
              disabled={paymentStatus === 'processing' || paymentVerification.verifying || showBlurOverlay}
              activeOpacity={0.8}
            >
              {paymentStatus === 'processing' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.payButtonText}>Proceed to Pay</Text>
                  <Icon name="arrow-forward" size={scale(20)} color="#fff" style={styles.payButtonIcon} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.addAddressButton}
              onPress={handleAddressChange}
              activeOpacity={0.8}
              disabled={showBlurOverlay}
            >
              <Icon name="location" size={scale(20)} color="#fff" style={styles.addAddressIcon} />
              <Text style={styles.addAddressButtonText}>Select Delivery Location</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPaymentModal = () => {
    let modalColor, iconName, iconSize, additionalContent, animationStyle;
    
    const rotateInterpolation = rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    if (paymentVerification.verifying) {
      modalColor = '#2196F3';
      iconName = 'refresh';
      iconSize = scale(40);
      additionalContent = (
        <Animated.View style={[styles.loadingIcon, { transform: [{ rotate: rotateInterpolation }] }]}>
          <Icon name={iconName} size={iconSize} color="#fff" />
        </Animated.View>
      );
      animationStyle = styles.verifyingModal;
    } else {
      switch(paymentStatus) {
        case 'success':
          modalColor = '#4CAF50';
          iconName = 'checkmark-circle';
          iconSize = scale(60);
          additionalContent = (
            <Animated.View style={[styles.successAnimation, { transform: [{ scale: scaleAnim }] }]}>
              <Icon name={iconName} size={iconSize} color="#fff" />
            </Animated.View>
          );
          animationStyle = styles.successModal;
          break;
        case 'failed':
          modalColor = '#E65C00';
          iconName = 'close-circle';
          iconSize = scale(60);
          additionalContent = (
            <Animated.View style={[styles.successAnimation, { transform: [{ scale: scaleAnim }] }]}>
              <Icon name={iconName} size={iconSize} color="#fff" />
            </Animated.View>
          );
          animationStyle = styles.errorModal;
          break;
        case 'cancelled':
          modalColor = '#FF9800';
          iconName = 'alert-circle';
          iconSize = scale(60);
          additionalContent = (
            <Animated.View style={[styles.successAnimation, { transform: [{ scale: scaleAnim }] }]}>
              <Icon name={iconName} size={iconSize} color="#fff" />
            </Animated.View>
          );
          animationStyle = styles.warningModal;
          break;
        case 'processing':
          modalColor = '#2196F3';
          iconName = 'refresh';
          iconSize = scale(40);
          additionalContent = (
            <Animated.View style={[styles.loadingIcon, { transform: [{ rotate: rotateInterpolation }] }]}>
              <Icon name={iconName} size={iconSize} color="#fff" />
            </Animated.View>
          );
          animationStyle = styles.verifyingModal;
          break;
        default:
          return null;
      }
    }
    
    return (
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[
            styles.modalContainer,
            animationStyle,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}>
            <View style={styles.modalContent}>
              {additionalContent}
              <Text style={styles.modalText}>
                {paymentVerification.verifying 
                  ? paymentVerification.message 
                  : paymentMessage}
              </Text>
              
              {paymentVerification.verifying && (
                <ActivityIndicator size="small" color="#fff" style={styles.verificationLoader} />
              )}
              
              {!paymentVerification.verifying && paymentStatus !== 'processing' && (
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowPaymentModal(false);
                    if (verificationComplete && paymentStatus === 'success' && orderDetails) {
                      navigation.navigate('TrackOrder', {
                        order: {
                          order_number: safeText(orderDetails.order_number)
                        }
                      });
                    }
                  }}
                >
                  <Text style={styles.modalCloseButtonText}>
                    {paymentStatus === 'success' ? 'View Order' : 'Close'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  const renderBlurOverlay = () => {
    if (!showBlurOverlay) return null;

    return (
      <View style={styles.absoluteBlurContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView
            style={styles.absoluteBlur}
            blurType="light"
            blurAmount={10}
            reducedTransparencyFallbackColor="white"
          />
        ) : (
          <View style={[styles.absoluteBlur, { backgroundColor: 'rgba(255,255,255,0.7)' }]} />
        )}
        
        <View style={styles.blurLoadingContainer}>
          <ActivityIndicator size="large" color="#E65C00" />
          <Text style={styles.blurLoadingText}>
            {paymentVerification.verifying 
              ? 'Verifying your payment...' 
              : 'Processing payment...'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading && !cartData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E65C00" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <View style={styles.errorIcon}>
              <Icon name="warning-outline" size={scale(48)} color="#E65C00" />
            </View>
            <Text style={styles.errorText}>{safeText(error)}</Text>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={fetchCartData}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={BackToKitchen}
            >
              <Text style={styles.secondaryButtonText}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isCartEmpty = !cartData?.cart_details || cartData.cart_details.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Blur overlay for payment processing */}
      {renderBlurOverlay()}
      
      {/* Touch blocking overlay during payment processing */}
      {showBlurOverlay && (
        <TouchableWithoutFeedback>
          <View style={styles.touchableOverlay} />
        </TouchableWithoutFeedback>
      )}
      
      {isCartEmpty ? (
        renderEmptyCart()
      ) : (
        <>
          {/* Simple Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={BackToKitchen}
              style={styles.backButton}
              disabled={showBlurOverlay}
            >
              <Icon name="arrow-back" size={scale(24)} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.restaurantName}>
                {safeText(cartData?.restaurant_name, 'Restaurant')}
              </Text>
              <TouchableOpacity 
                onPress={handleAddressChange}
                style={styles.headerAddressContainer}
                disabled={showBlurOverlay}
              >
                <Icon name="location-outline" size={scale(16)} color="#E65C00" />
                <Text style={styles.headerAddressText} numberOfLines={1}>
                  {safeText(shortAddress, 'Select Address')}
                </Text>
                <Icon name="chevron-down" size={scale(16)} color="#E65C00" style={styles.downArrowIcon} />
              </TouchableOpacity>
            </View>
          </View>
          
          {renderCartContent()}
        </>
      )}
      
      {renderPaymentFooter()}
      {renderPaymentModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    marginTop: verticalScale(16),
    fontSize: FONT.LG,
    color: '#666',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: verticalScale(120),
  },
  downArrowIcon: {
    marginLeft: scale(4),
  },
  // Updated Header Styles - Simple and Clean
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? verticalScale(30) : verticalScale(20),
    backgroundColor: '#fff',
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(16),
    // Removed border and shadow for simple look
  },
  backButton: {
    padding: scale(8),
    marginRight: scale(12),
    borderRadius: scale(20),
    backgroundColor: '#f8f8f8',
  },
  headerContent: {
    flex: 1,
  },
  restaurantName: {
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(6),
  },
  headerAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAddressText: {
    fontSize: FONT.SM,
    marginLeft: scale(6),
    fontWeight: '500',
  },
  // Updated Section Styles with more spacing
  section: {
    marginTop: verticalScale(24), // Increased spacing between sections
    paddingHorizontal: scale(20),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  sectionTitle: {
    fontSize: FONT.XXL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  itemCountBadge: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(16),
  },
  itemCountText: {
    fontSize: FONT.SM,
    color: '#fff',
    fontWeight: '600',
  },
  // Updated Cart Item Styles
  cartItemContainer: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: verticalScale(12),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTypeContainer: {
    marginRight: scale(16),
  },
  itemTypeBadge: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(6),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegBadge: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  nonVegBadge: {
    borderColor: '#E65C00',
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
  },
  itemTypeIndicator: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#E65C00',
  },
  itemDetails: {
    flex: 1,
    marginRight: scale(12), // Reduced margin to make space for quantity controls
  },
  itemName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(6),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  originalPrice: {
    fontSize: FONT.SM,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: scale(8),
    fontWeight: '500',
  },
  discountText: {
    fontSize: FONT.XS,
    color: '#E65C00',
    fontWeight: '600',
    backgroundColor: '#fff0e6',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
  },
  itemPrice: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  bogoBadge: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(6),
    alignSelf: 'flex-start',
    marginTop: verticalScale(6),
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  bogoText: {
    fontSize: FONT.SM,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  // Updated Quantity Container - More Compact
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: scale(20),
    paddingHorizontal: scale(6), // Reduced padding
    paddingVertical: verticalScale(4),   // Reduced padding
    borderWidth: 1.5,
    borderColor: '#ffd6d6',
  },
  quantityButton: {
    padding: scale(4), // Reduced padding
    borderRadius: scale(12),
    backgroundColor: '#fff',
    width: scale(28), // Fixed width
    height: scale(28), // Fixed height
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: FONT.BASE, // Slightly smaller
    fontWeight: '700',
    color: '#E65C00',
    marginHorizontal: scale(8), // Reduced margin
    minWidth: scale(20),
    textAlign: 'center',
  },
  // Updated Suggested Items Styles - Single Row Layout
  suggestedItemsRowContainer: {
    marginTop: verticalScale(8),
  },
  suggestedItemsHorizontalContainer: {
    paddingHorizontal: scale(4),
    paddingBottom: verticalScale(8),
  },
  suggestedItemCard: {
    width: scale(160),
    backgroundColor: '#fff',
    borderRadius: scale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginHorizontal: scale(6),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  suggestedItemImage: {
    width: '100%',
    height: verticalScale(120), // Reduced height for compact design
    backgroundColor: '#f8f8f8',
  },
  suggestedItemContent: {
    padding: scale(12), // Reduced padding
  },
  suggestedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  suggestedItemTypeBadge: {
    width: scale(16), // Smaller badge
    height: scale(16), // Smaller badge
    borderRadius: scale(4),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(6),
  },
  suggestedItemTypeIndicator: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  suggestedItemName: {
    fontSize: FONT.BASE, // Smaller font
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  suggestedItemDetails: {
    marginBottom: verticalScale(8),
  },
  suggestedItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addItemButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(6),
    borderRadius: scale(8),
    minWidth: scale(60),
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E65C00',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  addItemButtonDisabled: {
    opacity: 0.7,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: FONT.SM,
    fontWeight: '700',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(20),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: verticalScale(8),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: verticalScale(16),
  },
  detailIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: '#fff8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(14),
    borderWidth: 1,
    borderColor: '#ffe0cc',
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: FONT.BASE,
    color: '#4a4a4a',
    flex: 1,
    marginRight: scale(12),
    lineHeight: verticalScale(20),
    fontWeight: '500',
  },
  changeAddressButton: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    backgroundColor: '#fff0e6',
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#ffd1b3',
  },
  changeAddressText: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: FONT.SM,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(20),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: verticalScale(8),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(14),
    paddingBottom: verticalScale(14),
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  billLabel: {
    fontSize: FONT.BASE,
    color: '#666',
    fontWeight: '500',
  },
  billValue: {
    fontSize: FONT.BASE,
    color: '#333',
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(8),
    paddingTop: verticalScale(16),
    borderTopWidth: 1.5,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: FONT.XL,
    fontWeight: '800',
    color: '#E65C00',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderRadius: scale(12),
    padding: scale(16),
    marginHorizontal: scale(20),
    marginTop: verticalScale(20),
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  noteIconContainer: {
    marginRight: scale(12),
  },
  noteText: {
    fontSize: FONT.SM,
    color: '#666',
    flex: 1,
    fontWeight: '500',
    lineHeight: verticalScale(18),
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emptyHeaderTitle: {
    fontSize: FONT.XXL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  emptyIllustration: {
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(32),
    position: 'relative',
  },
  emptyIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: FONT.XXXL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(12),
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT.LG,
    color: '#666',
    textAlign: 'center',
    marginBottom: verticalScale(32),
    lineHeight: verticalScale(24),
    paddingHorizontal: scale(20),
    fontWeight: '500',
  },
  suggestionTitle: {
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: verticalScale(24),
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(20),
  },
  exploreButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(36),
    paddingVertical: verticalScale(16),
    borderRadius: scale(30),
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E65C00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
    marginTop: verticalScale(24),
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginRight: scale(8),
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  errorIcon: {
    marginBottom: verticalScale(24),
  },
  errorText: {
    fontSize: FONT.LG,
    color: '#E65C00',
    marginBottom: verticalScale(32),
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: verticalScale(24),
  },
  primaryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(32),
    paddingVertical: verticalScale(16),
    borderRadius: scale(30),
    width: '80%',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    ...Platform.select({
      ios: {
        shadowColor: '#E65C00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: scale(32),
    paddingVertical: verticalScale(16),
    borderRadius: scale(30),
    width: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E65C00',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#E65C00',
    fontSize: FONT.LG,
    fontWeight: '600',
  },
  paymentFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    padding: scale(20),
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  paymentFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalAmountContainer: {
    flex: 1,
  },
  totalAmountLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
    marginBottom: verticalScale(4),
  },
  totalAmountValue: {
    fontSize: FONT.XXL,
    fontWeight: '800',
    color: '#E65C00',
  },
  payButton: {
    backgroundColor: '#E65C00',
    borderRadius: scale(30),
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(28),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(160),
    ...Platform.select({
      ios: {
        shadowColor: '#E65C00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  payButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginRight: scale(8),
  },
  payButtonIcon: {
    marginLeft: scale(4),
  },
  addAddressButton: {
    backgroundColor: '#E65C00',
    borderRadius: scale(30),
    paddingVertical: verticalScale(16),
    paddingHorizontal: scale(24),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#E65C00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  addAddressButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginLeft: scale(8),
  },
  addAddressIcon: {
    marginRight: scale(4),
  },
  cartItemsList: {
    backgroundColor: '#fff',
    borderRadius: scale(16),
    padding: scale(16),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: verticalScale(8),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptySuggestionsContainer: {
    marginBottom: verticalScale(20),
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  absoluteBlurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  absoluteBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  blurLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  blurLoadingText: {
    marginTop: verticalScale(16),
    fontSize: FONT.LG,
    color: '#333',
    fontWeight: '600',
  },
  touchableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  modalContainer: {
    width: width * 0.8,
    borderRadius: scale(24),
    padding: scale(32),
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
    overflow: 'hidden',
  },
  verifyingModal: {
    backgroundColor: '#2196F3',
  },
  successModal: {
    backgroundColor: '#4CAF50',
  },
  errorModal: {
    backgroundColor: '#E65C00',
  },
  warningModal: {
    backgroundColor: '#FF9800',
  },
  modalContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  modalIcon: {
    marginBottom: verticalScale(20),
  },
  modalText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: verticalScale(20),
    marginBottom: verticalScale(20),
    lineHeight: verticalScale(24),
  },
  loadingIcon: {
    marginBottom: verticalScale(20),
  },
  successAnimation: {
    width: scale(90),
    height: scale(90),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(45),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  verificationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(24),
  },
  verificationText: {
    fontSize: FONT.LG,
    color: '#333',
    marginTop: verticalScale(12),
    textAlign: 'center',
    fontWeight: '600',
  },
  verificationLoader: {
    marginTop: verticalScale(12),
    marginBottom: verticalScale(12),
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: scale(28),
    paddingVertical: verticalScale(14),
    borderRadius: scale(25),
    marginTop: verticalScale(16),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.LG,
  },
});

export default CartScreen;