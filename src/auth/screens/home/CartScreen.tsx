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
  KeyboardAvoidingView,
  PlatformColor
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCartDetails, updateCart, createPayment, verifyPayment, updatePyamentData } from '../../../api/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from '@react-native-community/blur';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_API_KEY } from '@env';

const { width, height } = Dimensions.get('window');

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
};

type CartApiResponse = {
  status: string;
  restaurant_name: string;
  cart_details: CartItem[];
  suggestion_cart_items: SuggestedItem[];
  delivery_address_details: DeliveryAddress;
  delivery_time: DeliveryTime;
  billing_details: BillingDetails;
  distance_km: number; // New field
  estimated_delivery_cost: number; // New field
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
        address = cartResponse.delivery_address_details.address_line1;
        if (cartResponse.delivery_address_details.address_line2) {
          address += `, ${cartResponse.delivery_address_details.address_line2}`;
        }
        homeType = cartResponse.delivery_address_details.address_type || "";
      } else {
        address = (await AsyncStorage.getItem("StreetAddress")) || "";
        homeType = (await AsyncStorage.getItem("HomeType")) || "";
      }

      const shortAddr = address.length > 18 ? `${address.substring(0, 18)}...` : address;
      const shortAddressText = homeType ? `${homeType} | ${shortAddr}` : shortAddr;
      setShortAddress(estimatedTime ? `${estimatedTime} | ${shortAddressText}` : shortAddressText);

      const fullAddressText = homeType ? `${homeType} | ${address}` : address;
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
        key: RAZORPAY_API_KEY, // Replace with your actual Razorpay key
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
            <Text style={styles.itemName}>{item.item_name}</Text>            
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{item.original_item_price.toFixed(2)}</Text>
                <Text style={styles.discountText}>{item.discount_percent}% OFF</Text>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{(item.item_price).toFixed(2)}</Text>
            
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
                <Icon name="remove" size={16} color={"#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
              disabled={isUpdating}
            >
              {isUpdating && currentAction === 'increment' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="add" size={16} color="#E65C00" />
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
            <Text style={styles.suggestedItemName} numberOfLines={1}>{item.item_name}</Text>
          </View>
          
          <View style={styles.itemDetails}>
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{item.original_item_price?.toFixed(2)}</Text>
                <Text style={styles.discountText}>{item.discount_percent}% OFF</Text>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{(item.item_price).toFixed(2)}</Text>
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
                    <Icon name="remove" size={16} color={quantity <= 1 ? "#ccc" : "#E65C00"} />
                  )}
                </TouchableOpacity>
                
                <Text style={styles.quantityText}>{quantity}</Text>
                
                <TouchableOpacity 
                  style={styles.quantityButton} 
                  onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                  disabled={isUpdating}
                >
                  {isUpdating && currentAction === 'increment' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="add" size={16} color="#E65C00" />
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
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.emptyHeaderTitle}>{cartData?.restaurant_name || 'Your Cart'}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.emptyContent}>
        <View style={styles.emptyIllustration}>
          <Icon name="cart-outline" size={60} color="#E65C00" />
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
          <Icon name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
        <View style={styles.emptySuggestionsContainer}>
          <Text style={styles.suggestionTitle}>Popular Items from {cartData.restaurant_name}</Text>
          <FlatList
            data={cartData.suggestion_cart_items}
            renderItem={renderSuggestedItem}
            keyExtractor={item => item.item_id.toString()}
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Order</Text>
            <Text style={styles.itemCount}>{cartData?.cart_details.length} {cartData?.cart_details.length === 1 ? 'item' : 'items'}</Text>
          </View>
          
          <View style={styles.cartItemsList}>
            <FlatList
              data={cartData?.cart_details}
              renderItem={renderCartItem}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
            />
          </View>
        </View>
        
        {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add More From {cartData.restaurant_name}</Text>
            </View>
            <FlatList
              data={cartData.suggestion_cart_items}
              renderItem={renderSuggestedItem}
              keyExtractor={item => item.item_id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedItemsContainer}
            />
          </View>
        )}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Icon name="location-outline" size={20} color="#E65C00" style={styles.detailIcon} />
              <View style={styles.addressContainer}>
                <Text style={styles.detailText}>{fullAddress}</Text>
                <TouchableOpacity 
                  style={styles.changeAddressButton}
                  onPress={handleAddressChange}
                >
                  <Text style={styles.changeAddressText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="time-outline" size={20} color="#E65C00" style={styles.detailIcon} />
              <Text style={styles.detailText}>Deliver by {cartData?.delivery_time.estimated_time}</Text>
            </View>
            
            {/* Display Distance Information */}
            {cartData?.billing_details.distance_km && (
              <View style={styles.detailRow}>
                <Icon name="navigate-outline" size={20} color="#E65C00" style={styles.detailIcon} />
                <Text style={styles.detailText}>Distance: {cartData.billing_details.distance_km.toFixed(1)} km</Text>
              </View>
            )}
            
            {/* Display Estimated Delivery Cost */}
            {cartData?.estimated_delivery_cost && (
              <View style={styles.detailRow}>
                <Icon name="pricetag-outline" size={20} color="#E65C00" style={styles.detailIcon} />
                <Text style={styles.detailText}>Estimated Delivery: ₹{cartData.estimated_delivery_cost.toFixed(2)}</Text>
              </View>
            )}
            
            {user?.contact_number && (
              <View style={styles.detailRow}>
                <Icon name="call-outline" size={20} color="#E65C00" style={styles.detailIcon} />
                <Text style={styles.detailText}>Contact: {user.contact_number}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          
          <View style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>₹{cartData?.billing_details.subtotal.toFixed(2)}</Text>
            </View>
            
            {cartData?.billing_details.delivery_amount ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Fee | {cartData.billing_details.distance_km.toFixed(1)} km
                </Text>
                <Text style={styles.billValue}>₹{cartData.billing_details.delivery_amount.toFixed(2)}</Text>
              </View>
            ) : null}
            
            {cartData?.billing_details.tax ? (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Tax</Text>
                <Text style={styles.billValue}>₹{cartData.billing_details.tax.toFixed(2)}</Text>
              </View>
            ) : null}
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>₹{cartData?.billing_details.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.noteCard}>
          <Icon name="information-circle-outline" size={20} color="#E65C00" />
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

    return (
      <View style={styles.paymentFooter}>
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
                <Text style={styles.payButtonText}>Pay ₹{cartData.billing_details.total.toFixed(2)}</Text>
                <Icon name="arrow-forward" size={20} color="#fff" style={styles.payButtonIcon} />
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
            <Text style={styles.addAddressButtonText}>Select Delivery Location</Text>
            <Icon name="location" size={20} color="#fff" style={styles.addAddressIcon} />
          </TouchableOpacity>
        )}
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
      iconSize = 40;
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
          iconSize = 60;
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
          iconSize = 60;
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
          iconSize = 60;
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
          iconSize = 40;
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
                          order_number: orderDetails.order_number
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
              <Icon name="warning-outline" size={48} color="#E65C00" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
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
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={BackToKitchen}
              style={styles.backButton}
              disabled={showBlurOverlay}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.restaurantName}>{cartData?.restaurant_name}</Text>
              <TouchableOpacity 
                onPress={handleAddressChange}
                style={styles.headerAddressContainer}
                disabled={showBlurOverlay}
              >
                <Icon name="location-outline" size={16} color="#E65C00" />
                <Text style={styles.headerAddressText} numberOfLines={1}>
                  {shortAddress}
                </Text>
                <Icon name="chevron-down" size={16} color="#E65C00" style={styles.downArrowIcon} />
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 100,
  },
  downArrowIcon: {
    marginLeft: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 30 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: '#eee',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
    zIndex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  headerAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAddressText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom:10,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  cartItemContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTypeContainer: {
    marginRight: 12,
  },
  itemTypeBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegBadge: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  nonVegBadge: {
    borderColor: '#E65C00',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  itemTypeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#E65C00',
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountText: {
    fontSize: 13,
    color: '#E65C00',
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bogoBadge: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  bogoText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffd6d6',
  },
  quantityButton: {
    padding: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65C00',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  suggestedItemsContainer: {
    paddingBottom: 8,
    paddingLeft: 16,
  },
  suggestedItemCard: {
    width: width * 0.45,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  suggestedItemImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
  },
  suggestedItemContent: {
    padding: 12,
  },
  suggestedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestedItemTypeBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  suggestedItemTypeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  suggestedItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  suggestedItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addItemButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonDisabled: {
    opacity: 0.7,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    marginRight: 12,
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  changeAddressButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeAddressText: {
    color: '#E65C00',
    fontWeight: '500',
    fontSize: 14,
  },
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65C00',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  exploreButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: 24,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#E65C00',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  paymentFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.7,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
        borderTopWidth: 1,
        borderColor: '#f0f0f0',
      },
    }),
  },
  payButton: {
    backgroundColor: '#E65C00',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  payButtonIcon: {
    marginLeft: 5,
  },
  addAddressButton: {
    backgroundColor: '#E65C00',
    borderRadius: 30,
    paddingVertical: 15,
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  addAddressButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 10,
  },
  addAddressIcon: {
    marginLeft: 5,
  },
  cartItemsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  emptySuggestionsContainer: {
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
    width: width * 0.85,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
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
    marginBottom: 20,
  },
  modalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    lineHeight: 24,
  },
  loadingIcon: {
    marginBottom: 20,
  },
  successAnimation: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  verificationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  verificationText: {
    fontSize: 16,
    color: '#333',
    marginTop: 10,
    textAlign: 'center',
  },
  verificationLoader: {
    marginTop: 10,
    marginBottom: 10,
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CartScreen;