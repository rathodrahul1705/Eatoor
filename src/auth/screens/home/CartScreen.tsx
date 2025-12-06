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
import { getWalletBalance } from '../../../api/wallet'; // You'll need to create this API function
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
  XS: normalize(10),
  SM: normalize(12),
  BASE: normalize(14),
  LG: normalize(16),
  XL: normalize(18),
  XXL: normalize(20),
  XXXL: normalize(22),
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
  full_name: string;
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

// Wallet related types
type WalletBalance = {
  balance: number;
  currency: string;
};

type PaymentMethod = 'online';

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
  const [showItemCountBadge, setShowItemCountBadge] = useState(true);
  
  // Wallet states
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  
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

  // Fetch wallet balance when user is available
  useEffect(() => {
    if (userId) {
      fetchWalletBalance();
    }
  }, [userId]);

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

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!userId) return;
    
    try {
      setWalletLoading(true);
      setWalletError(null);
      
      // Assuming you have an API endpoint to get wallet balance
      const response = await getWalletBalance(userId);
      
      if (response.status === 200) {
        setWalletBalance({
          balance: safePrice(response.data.balance),
          currency: response.data.currency || 'INR'
        });
      } else {
        setWalletError('Failed to load wallet balance');
        setWalletBalance({
          balance: 0,
          currency: 'INR'
        });
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
      setWalletError('Unable to load wallet balance');
      setWalletBalance({
        balance: 0,
        currency: 'INR'
      });
    } finally {
      setWalletLoading(false);
    }
  };

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
    fetchWalletBalance();
  };

  const handleAddressChange = async () => {
    navigation.navigate('AddressScreen', { 
      prevLocation: 'CartScreen',
      onAddressSelect: async (selectedAddressId: string | number) => {
        try {
          await AsyncStorage.setItem('AddressId', String(selectedAddressId.id));
          setAddressId(String(selectedAddressId.id));
        } catch (error) {
          console.error('Error saving address:', error);
        }
      }
    });
  };

  // Calculate final amount after wallet deduction
  const calculateFinalAmount = () => {
    if (!cartData) return 0;
    
    const totalAmount = safePrice(cartData.billing_details.total);
    
    if (useWallet && walletBalance) {
      const walletAmount = safePrice(walletBalance.balance);
      const amountAfterWallet = totalAmount - walletAmount;
      
      // If wallet covers entire amount, return 0
      // If wallet doesn't cover entire amount, return remaining amount (minimum 0)
      return Math.max(amountAfterWallet, 0);
    }
    
    return totalAmount;
  };

  // Calculate how much wallet will be used
  const calculateWalletUsage = () => {
    if (!cartData || !useWallet || !walletBalance) return 0;
    
    const totalAmount = safePrice(cartData.billing_details.total);
    const walletAmount = safePrice(walletBalance.balance);
    
    // Return how much of wallet will be used (either full wallet or partial if order amount is less)
    return Math.min(walletAmount, totalAmount);
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
          navigation.navigate('TrackOrder', { order: { order_number: orderNumber,prev_location: 'HomeTabs', } });
        }, 300);
      }
    });
  };

  const createRazorpayOrder = async (): Promise<string> => {
    if (!cartData || !userId || !kitchenId) {
      throw new Error('Required data missing for creating order');
    }

    try {
      const finalAmount = calculateFinalAmount();
      
      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        amount: finalAmount * 100, // Convert to paise
        currency: 'INR',
        receipt: `order_${Date.now()}`,
        wallet_used: useWallet,
        wallet_amount: useWallet ? calculateWalletUsage() : 0
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
        amount: calculateFinalAmount(),
        deliveryAddressId: addressId,
        payment_type: 2, // Online payment
        eatoor_order_id: updateResponse.order_id,
        restaurant_id: kitchenId,
        restaurantName: cartData.restaurant_name,
        wallet_used: useWallet,
        wallet_amount: useWallet ? calculateWalletUsage() : 0
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
        wallet_used: useWallet,
        wallet_amount: useWallet ? calculateWalletUsage() : 0,
        final_amount: calculateFinalAmount(),
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
    const finalAmount = calculateFinalAmount();
    if (finalAmount > 0 && finalAmount < MINIMUM_ORDER_VALUE) {
      Alert.alert(
        'Minimum Order Value',
        `Your remaining amount is ₹${finalAmount.toFixed(2)}. Minimum order value is ₹${MINIMUM_ORDER_VALUE}. Please add more items to proceed.`,
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
    
    // If wallet covers entire amount
    if (useWallet && calculateWalletUsage() >= cartData.billing_details.total) {
      // Handle wallet-only payment
      handleWalletPayment();
      return;
    }
    
    // For online payment (with or without wallet)
    setPaymentStatus('processing');
    setShowBlurOverlay(true);
    
    try {
      // Create Razorpay order first
      const orderId = await createRazorpayOrder();
      setRazorpayOrderId(orderId);

      const options = {
        description: `Order from ${cartData.restaurant_name}${useWallet ? ` (Eatoor Money used: ₹${calculateWalletUsage().toFixed(2)})` : ''}`,
        image: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png',
        currency: 'INR',
        key: RAZORPAY_API_KEY,
        amount: finalAmount * 100, // Amount in paise
        name: user.full_name,
        order_id: orderId,
        prefill: {
          email: user.email,
          contact: user.contact_number,
          name: user.full_name
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

  // Handle wallet-only payment
  const handleWalletPayment = async () => {
    if (!cartData || !userId || !kitchenId || !addressId) {
      Alert.alert('Error', 'Required information missing for wallet payment');
      return;
    }
    
    setPaymentStatus('processing');
    setShowBlurOverlay(true);
    
    try {
      // Update order with wallet payment
      const updateResponse = await updateOrderDetails('');
      
      if (updateResponse.status === 'success') {
        // Simulate payment verification for wallet
        setPaymentVerification({
          verifying: false,
          message: 'Payment successful using Eatoor Money!',
          success: true
        });
        
        setOrderDetails({
          order_id: updateResponse.order_id,
          order_number: updateResponse.order_number
        });
        
        showPaymentStatusModal('success', 'Payment successful using Eatoor Money! Redirecting to order details...', updateResponse.order_number);
      } else {
        throw new Error('Failed to process wallet payment');
      }
    } catch (error) {
      console.error('Wallet payment error:', error);
      showPaymentStatusModal('failed', error.message || 'Eatoor Money payment failed');
    } finally {
      setShowBlurOverlay(false);
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

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (!cartData || !kitchenId || !userId) return;
            
            try {
              // Remove all items from cart
              for (const item of cartData.cart_details) {
                const payload = {
                  user_id: userId,
                  session_id: sessionId,
                  restaurant_id: kitchenId,
                  item_id: item.item_id,
                  source: 'CART',
                  quantity: item.quantity,
                  action: 'remove'
                };
                await updateCart(payload);
              }
              await fetchCartData();
            } catch (error) {
              console.error('Error clearing cart:', error);
              Alert.alert('Error', 'Failed to clear cart. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getTotalItems = () => {
    if (!cartData?.cart_details) return 0;
    return cartData.cart_details.reduce((total, item) => total + item.quantity, 0);
  };

  // Render Eatoor Money section (above Pay button)
  const renderEatoorMoneySection = () => {
    if (walletLoading) {
      return (
        <View style={styles.eatoorMoneyContainer}>
          <View style={styles.eatoorMoneyLoading}>
            <ActivityIndicator size="small" color="#E65C00" />
            <Text style={styles.eatoorMoneyLoadingText}>Loading Eatoor Money...</Text>
          </View>
        </View>
      );
    }

    const balance = walletBalance?.balance || 0;
    const walletUsage = calculateWalletUsage();
    const finalAmount = calculateFinalAmount();

    return (
      <View style={styles.eatoorMoneyContainer}>
        <View style={styles.eatoorMoneyToggleRow}>
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => {
              if (balance <= 0) {
                Alert.alert(
                  'No Eatoor Money',
                  'You need to add money to your Eatoor Money first',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Add Money', onPress: () => navigation.navigate('EatoorMoneyScreen', { prevScreen: 'CartScreen' }) }
                  ]
                );
                return;
              }
              setUseWallet(!useWallet);
            }}
            disabled={showBlurOverlay}
          >
            <View style={[
              styles.checkbox,
              useWallet && styles.checkboxChecked,
              balance <= 0 && styles.checkboxDisabled
            ]}>
              {useWallet && (
                <Icon name="checkmark" size={scale(12)} color="#fff" />
              )}
            </View>
            <View style={styles.checkboxLabelContainer}>
              <Text style={[
                styles.checkboxLabel,
                balance <= 0 && styles.checkboxLabelDisabled
              ]}>
                Use Eatoor Money
              </Text>
              <Text style={styles.balanceTextSmall}>
                Balance: ₹{balance.toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('EatoorMoneyScreen', { prevScreen: 'CartScreen' })}
            disabled={showBlurOverlay}
          >
            <Text style={styles.addMoneyButtonText}>Add Money</Text>
            <Icon name="arrow-forward" size={scale(14)} color="#E65C00" style={styles.addMoneyIcon} />
          </TouchableOpacity>
        </View>
      </View>
    );
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
      <View style={styles.cartItemCard}>
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
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
              disabled={showBlurOverlay}
            >
              {isUpdating && currentAction === 'decrement' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="remove" size={scale(14)} color={item.quantity <= 1 ? "#E65C00" : "#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{safeText(item.quantity, '0')}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
              disabled={isUpdating || showBlurOverlay}
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
      <TouchableOpacity 
        style={styles.suggestedItemCard}
        onPress={() => {
          if (quantity === 0) {
            updateItemQuantity(item.item_id, 'increment', 'SUGGESTION');
          }
        }}
        activeOpacity={0.7}
        disabled={showBlurOverlay}
      >
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
                  disabled={isUpdating || quantity <= 1 || showBlurOverlay}
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
                  disabled={isUpdating || showBlurOverlay}
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
                disabled={isUpdating || showBlurOverlay}
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
      </TouchableOpacity>
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

      {cartData?.suggestion_cart_items && cartData?.suggestion_cart_items.length > 0 && (
        <View style={styles.emptySuggestionsContainer}>
          <Text style={styles.suggestionTitle}>
            Popular Items from {safeText(cartData?.restaurant_name, 'this restaurant')}
          </Text>
          <FlatList
            data={cartData?.suggestion_cart_items}
            renderItem={renderSuggestedItem}
            keyExtractor={item => safeText(item.item_id, '0')}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );

  const safeFormatNumber = (value, decimals = 2) => {
    const num = Number(value);
    if (isNaN(num)) return "0.00";
    return num.toFixed(decimals);
  };

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
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Your Order</Text>

              {showItemCountBadge && cartData?.cart_details?.length > 0 && (
                <TouchableOpacity 
                  style={styles.itemCountBadge}
                  onPress={() => setShowItemCountBadge(!showItemCountBadge)}
                  disabled={showBlurOverlay}
                >
                  <Text style={styles.itemCountText}>{getTotalItems()}</Text>
                </TouchableOpacity>
              )}
            </View>

            {cartData?.cart_details?.length > 0 && (
              <TouchableOpacity 
                style={styles.clearCartButton}
                onPress={handleClearCart}
                disabled={showBlurOverlay}
              >
                <Icon name="trash-outline" size={scale(18)} color="#E65C00" />
                <Text style={styles.clearCartText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.cartItemsList}>
            <FlatList
              data={cartData?.cart_details}
              renderItem={renderCartItem}
              keyExtractor={item => safeText(item.id, '0')}
              scrollEnabled={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyCartMessage}>
                  <Icon name="cart-outline" size={scale(40)} color="#E8ECF4" />
                  <Text style={styles.emptyCartText}>No items in cart</Text>
                </View>
              )}
            />
          </View>
        </View>

        {/* Add More Items Section */}
        {cartData?.suggestion_cart_items?.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add More Items</Text>
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => BackToKitchen()}
                disabled={showBlurOverlay}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Icon name="chevron-forward" size={scale(16)} color="#E65C00" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={cartData?.suggestion_cart_items}
              renderItem={renderSuggestedItem}
              keyExtractor={item => safeText(item.item_id, '0')}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedItemsHorizontalContainer}
            />
          </View>
        )}

        {/* Delivery Details Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>

          <View style={styles.detailCard}>
            
            {/* Address */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Icon name="location-outline" size={scale(20)} color="#E65C00" />
              </View>
              <View style={styles.addressContainer}>
                <Text style={styles.detailText}>
                  {fullAddress !== "Select Address"
                    ? fullAddress
                    : "Please select a delivery address"}
                </Text>

                <TouchableOpacity 
                  style={styles.changeAddressButton}
                  onPress={handleAddressChange}
                  disabled={showBlurOverlay}
                >
                  <Text style={styles.changeAddressText}>
                    {fullAddress !== "Select Address" ? "Change" : "Add"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Estimated Time */}
            {cartData?.delivery_time?.estimated_time && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>
                  Deliver in {safeText(cartData?.delivery_time?.estimated_time)}
                </Text>
              </View>
            )}

            {/* Distance */}
            {cartData?.billing_details?.distance_km != null && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="navigate-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>
                  Distance: {safeFormatNumber(cartData.billing_details.distance_km, 1)} km
                </Text>
              </View>
            )}

            {/* Delivery Cost */}
            {cartData?.billing_details?.estimated_delivery_cost != null && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="pricetag-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>
                  Estimated Delivery: ₹
                  {safeFormatNumber(cartData.billing_details.estimated_delivery_cost, 2)}
                </Text>
              </View>
            )}

            {/* Phone */}
            {user?.contact_number && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <Icon name="call-outline" size={scale(20)} color="#E65C00" />
                </View>
                <Text style={styles.detailText}>
                  {safeText(user?.full_name)}, {safeText(user?.contact_number)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bill Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Bill Details</Text>

          <View style={styles.billCard}>
            
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>
                ₹{safeFormatNumber(cartData?.billing_details?.subtotal, 2)}
              </Text>
            </View>

            {cartData?.billing_details?.delivery_amount != null && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>
                  Delivery Fee 
                  {cartData?.billing_details?.distance_km
                    ? ` | ${safeFormatNumber(cartData.billing_details.distance_km, 1)} km`
                    : ''}
                </Text>
                <Text style={styles.billValue}>
                  ₹{safeFormatNumber(cartData.billing_details.delivery_amount, 2)}
                </Text>
              </View>
            )}

            {cartData?.billing_details?.tax != null && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Tax</Text>
                <Text style={styles.billValue}>
                  ₹{safeFormatNumber(cartData.billing_details.tax, 2)}
                </Text>
              </View>
            )}

            {/* Eatoor Money Deduction Row - Show in bill details */}
            {useWallet && walletBalance && walletBalance.balance > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Eatoor Money</Text>
                <Text style={[styles.billValue, styles.eatoorMoneyDeductionBill]}>
                  - ₹{calculateWalletUsage().toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {useWallet && calculateFinalAmount() > 0 ? 'Amount to Pay' : 'Total Bill'}
              </Text>
              <Text style={styles.totalValue}>
                ₹{calculateFinalAmount().toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Note */}
        <View style={styles.noteCard}>
          <View style={styles.noteIconContainer}>
            <Icon name="information-circle-outline" size={scale(20)} color="#E65C00" />
          </View>
          <Text style={styles.noteText}>
            Order cannot be cancelled once packed for delivery
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
    
  const renderPaymentFooter = () => {
    if (!cartData || !cartData?.cart_details || cartData?.cart_details.length === 0) {
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

    const finalAmount = calculateFinalAmount();
    const walletUsage = calculateWalletUsage();

    return (
      <View style={styles.paymentFooter}>
        {/* Eatoor Money Section - Above Pay Button */}
        {renderEatoorMoneySection()}
        
        <View style={styles.paymentFooterContent}>
          <View style={styles.totalAmountContainer}>
            <Text style={styles.totalAmountLabel}>
              {finalAmount === 0 ? 'PAID' : 'TO PAY'}
            </Text>
            <View style={styles.totalAmountValueContainer}>
              <Text style={styles.totalAmountValue}>₹{finalAmount.toFixed(2)}</Text>
              {useWallet && walletUsage > 0 && (
                <Text style={styles.walletUsageFooter}>
                  (Eatoor Money: ₹{walletUsage.toFixed(2)})
                </Text>
              )}
            </View>
          </View>
          {addressId ? (
            <TouchableOpacity 
              style={[
                styles.payButton,
                finalAmount === 0 && styles.payButtonPaid
              ]}
              onPress={initiatePayment}
              disabled={paymentStatus === 'processing' || paymentVerification.verifying || showBlurOverlay}
              activeOpacity={0.8}
            >
              {paymentStatus === 'processing' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.payButtonText}>
                    {finalAmount === 0 
                      ? 'Place Order' 
                      : 'Proceed to Pay'}
                  </Text>
                  <Icon 
                    name="arrow-forward" 
                    size={scale(20)} 
                    color="#fff" 
                    style={styles.payButtonIcon} 
                  />
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
              <Icon name="location" size={scale(18)} color="#fff" style={styles.addAddressIcon} />
              <Text style={styles.addAddressButtonText}>Select Location</Text>
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

  const isCartEmpty = !cartData?.cart_details || cartData?.cart_details.length === 0;
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
    backgroundColor: '#f8f9fa',
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
    paddingBottom: verticalScale(140),
    paddingHorizontal: scale(16),
  },
  downArrowIcon: {
    marginLeft: scale(4),
  },
  // Updated Header Styles - Clean and Modern
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? verticalScale(30) : verticalScale(20),
    backgroundColor: '#fff',
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(4),
  },
  headerAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAddressText: {
    fontSize: FONT.SM,
    fontWeight: '500',
    color: '#666',
  },
  // Eatoor Money Section Styles (Zomato Style)
  eatoorMoneyContainer: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eatoorMoneyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  eatoorMoneyTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  eatoorMoneyBalance: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  eatoorMoneyBalanceAmount: {
    fontWeight: '700',
    color: '#E65C00',
  },
  eatoorMoneyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(4),
    borderWidth: 2,
    borderColor: '#d1d1d6',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
  },
  checkboxChecked: {
    backgroundColor: '#E65C00',
    borderColor: '#E65C00',
  },
  checkboxDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#d1d1d6',
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(2),
  },
  checkboxLabelDisabled: {
    color: '#999',
  },
  balanceTextSmall: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '500',
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    backgroundColor: '#fff',
    borderRadius: scale(4),
    borderWidth: 1,
    borderColor: '#E65C00',
  },
  addMoneyButtonText: {
    color: '#E65C00',
    fontSize: FONT.SM,
    fontWeight: '600',
  },
  addMoneyIcon: {
    marginLeft: scale(4),
  },
  eatoorMoneyLoading: {
    alignItems: 'center',
    padding: verticalScale(10),
  },
  eatoorMoneyLoadingText: {
    fontSize: FONT.SM,
    color: '#666',
    marginTop: verticalScale(6),
    fontWeight: '500',
  },
  eatoorMoneyDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    marginTop: verticalScale(6),
  },
  insufficientWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    borderRadius: scale(6),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  insufficientText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '500',
    marginLeft: scale(6),
    flex: 1,
  },
  eatoorMoneyBreakdown: {
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingTop: verticalScale(6),
  },
  eatoorMoneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(4),
  },
  eatoorMoneyLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  eatoorMoneyDeduction: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '700',
  },
  eatoorMoneyAmount: {
    fontSize: FONT.BASE,
    color: '#E65C00',
    fontWeight: '800',
  },
  eatoorMoneyFullyPaid: {
    fontSize: FONT.BASE,
    color: '#4CAF50',
    fontWeight: '800',
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#f0f0f0',
    marginHorizontal: -scale(16),
    marginTop: verticalScale(10),
  },
  // Section Cards - All content in cards like Zomato
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: verticalScale(12),
    marginTop: verticalScale(8),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  itemCountBadge: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(10),
    marginLeft: scale(6),
    minWidth: scale(20),
    alignItems: 'center',
  },
  itemCountText: {
    fontSize: FONT.XS,
    color: '#fff',
    fontWeight: '700',
  },
  clearCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    backgroundColor: '#fff0e6',
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: '#ffd1b3',
  },
  clearCartText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
    marginLeft: scale(4),
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
  },
  // Cart Item Styles - Compact and Clean
  cartItemCard: {
    backgroundColor: '#fff',
    borderRadius: scale(10),
    padding: scale(10),
    marginBottom: verticalScale(6),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTypeContainer: {
    marginRight: scale(10),
  },
  itemTypeBadge: {
    width: scale(18),
    height: scale(18),
    borderRadius: scale(3),
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
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#E65C00',
  },
  itemDetails: {
    flex: 1,
    marginRight: scale(10),
  },
  itemName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(3),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  originalPrice: {
    fontSize: FONT.SM,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: scale(4),
    fontWeight: '500',
  },
  discountText: {
    fontSize: FONT.XS,
    color: '#E65C00',
    fontWeight: '600',
    backgroundColor: '#fff0e6',
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
  },
  itemPrice: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  bogoBadge: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: scale(5),
    paddingVertical: verticalScale(1),
    borderRadius: scale(3),
    alignSelf: 'flex-start',
    marginTop: verticalScale(4),
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  bogoText: {
    fontSize: FONT.XS,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  // Quantity Container - Compact Design
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: scale(16),
    paddingHorizontal: scale(4),
    paddingVertical: verticalScale(2),
    borderWidth: 1.5,
    borderColor: '#ffd6d6',
  },
  quantityButton: {
    padding: scale(3),
    borderRadius: scale(10),
    backgroundColor: '#fff',
    width: scale(22),
    height: scale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: FONT.SM,
    fontWeight: '700',
    color: '#E65C00',
    marginHorizontal: scale(4),
    minWidth: scale(18),
    textAlign: 'center',
  },
  // Suggested Items - Horizontal Scroll
  suggestedItemsHorizontalContainer: {
    paddingHorizontal: scale(2),
    paddingBottom: verticalScale(2),
  },
  suggestedItemCard: {
    width: scale(130),
    backgroundColor: '#fff',
    borderRadius: scale(10),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginHorizontal: scale(5),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  suggestedItemImage: {
    width: '100%',
    height: verticalScale(90),
    backgroundColor: '#f8f8f8',
  },
  suggestedItemContent: {
    padding: scale(8),
  },
  suggestedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  suggestedItemTypeBadge: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(2),
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(4),
  },
  suggestedItemTypeIndicator: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
  },
  suggestedItemName: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  suggestedItemDetails: {
    marginBottom: verticalScale(4),
  },
  suggestedItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addItemButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(5),
    borderRadius: scale(5),
    minWidth: scale(45),
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonDisabled: {
    opacity: 0.7,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: FONT.SM,
    fontWeight: '700',
  },
  // Detail Card inside Section
  detailCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(10),
    padding: scale(12),
    marginTop: verticalScale(6),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: verticalScale(10),
  },
  detailIconContainer: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: '#fff8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
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
    fontSize: FONT.SM,
    color: '#4a4a4a',
    flex: 1,
    marginRight: scale(10),
    lineHeight: verticalScale(18),
    fontWeight: '500',
  },
  changeAddressButton: {
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
    backgroundColor: '#fff0e6',
    borderRadius: scale(5),
    borderWidth: 1,
    borderColor: '#ffd1b3',
  },
  changeAddressText: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: FONT.SM,
  },
  // Bill Card inside Section
  billCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(10),
    padding: scale(12),
    marginTop: verticalScale(6),
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(10),
    paddingBottom: verticalScale(10),
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  billLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  billValue: {
    fontSize: FONT.SM,
    color: '#333',
    fontWeight: '600',
  },
  eatoorMoneyDeductionBill: {
    color: '#E65C00',
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(6),
    paddingTop: verticalScale(10),
    borderTopWidth: 1.5,
    borderTopColor: '#e8e8e8',
  },
  totalLabel: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: FONT.LG,
    fontWeight: '800',
    color: '#E65C00',
  },
  // Note Card
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderRadius: scale(10),
    padding: scale(12),
    marginTop: verticalScale(6),
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  noteIconContainer: {
    marginRight: scale(10),
  },
  noteText: {
    fontSize: FONT.XS,
    color: '#666',
    flex: 1,
    fontWeight: '500',
    lineHeight: verticalScale(16),
  },
  // Cart Items List
  cartItemsList: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(10),
    padding: scale(10),
    marginTop: verticalScale(6),
  },
  emptyCartMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: verticalScale(16),
  },
  emptyCartText: {
    fontSize: FONT.SM,
    color: '#666',
    marginTop: verticalScale(6),
    fontWeight: '500',
  },
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: scale(14),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emptyHeaderTitle: {
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  emptyIllustration: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(20),
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
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(6),
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT.SM,
    color: '#666',
    textAlign: 'center',
    marginBottom: verticalScale(20),
    lineHeight: verticalScale(18),
    paddingHorizontal: scale(16),
    fontWeight: '500',
  },
  suggestionTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: verticalScale(12),
    marginBottom: verticalScale(10),
    paddingHorizontal: scale(14),
  },
  exploreButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(28),
    paddingVertical: verticalScale(12),
    borderRadius: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#E65C00',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginRight: scale(6),
  },
  emptySuggestionsContainer: {
    marginBottom: verticalScale(16),
  },
  // Error State Styles
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  errorIcon: {
    marginBottom: verticalScale(12),
  },
  errorText: {
    fontSize: FONT.LG,
    color: '#E65C00',
    marginBottom: verticalScale(20),
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: verticalScale(18),
  },
  primaryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(28),
    paddingVertical: verticalScale(12),
    borderRadius: scale(20),
    width: '80%',
    alignItems: 'center',
    marginBottom: verticalScale(10),
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: scale(28),
    paddingVertical: verticalScale(12),
    borderRadius: scale(20),
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
  // Payment Footer
  paymentFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  paymentFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingBottom: verticalScale(10),
  },
  totalAmountContainer: {
    flex: 1,
  },
  totalAmountLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
    marginBottom: verticalScale(2),
  },
  totalAmountValueContainer: {
    flexDirection: 'column',
  },
  totalAmountValue: {
    fontSize: FONT.XL,
    fontWeight: '800',
    color: '#E65C00',
  },
  walletUsageFooter: {
    fontSize: FONT.XS,
    color: '#666',
    fontWeight: '500',
    marginTop: verticalScale(1),
  },
  payButton: {
    backgroundColor: '#E65C00',
    borderRadius: scale(20),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(130),
  },
  payButtonPaid: {
    backgroundColor: '#4CAF50',
  },
  payButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginRight: scale(4),
  },
  payButtonIcon: {
    marginLeft: scale(2),
  },
  addAddressButton: {
    backgroundColor: '#E65C00',
    borderRadius: scale(20),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  addAddressButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginLeft: scale(4),
  },
  addAddressIcon: {
    marginRight: scale(4),
  },
  // Verification Container
  verificationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(16),
  },
  verificationText: {
    fontSize: FONT.LG,
    color: '#333',
    marginTop: verticalScale(6),
    textAlign: 'center',
    fontWeight: '600',
  },
  // Modal Styles
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
    marginTop: verticalScale(10),
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
    borderRadius: scale(16),
    padding: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
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
  modalText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: verticalScale(12),
    marginBottom: verticalScale(12),
    lineHeight: verticalScale(18),
  },
  loadingIcon: {
    marginBottom: verticalScale(12),
  },
  successAnimation: {
    width: scale(70),
    height: scale(70),
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(35),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  verificationLoader: {
    marginTop: verticalScale(6),
    marginBottom: verticalScale(6),
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(8),
    borderRadius: scale(16),
    marginTop: verticalScale(10),
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT.SM,
  },
});

export default CartScreen;