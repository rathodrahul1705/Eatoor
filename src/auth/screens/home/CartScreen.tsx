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
  PanResponder
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCartDetails, updateCart, createPayment, verifyPayment, updatePyamentData } from '../../../api/cart';
import { getWalletBalance, debitWallet } from '../../../api/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from '@react-native-community/blur';
import RazorpayCheckout from 'react-native-razorpay';

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
const MINIMUM_ORDER_VALUE = 1;

// Type definitions
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
  delivery_offer_exist: boolean;
  order_count: number;
};

type UserData = {
  id: string;
  full_name: string;
  email: string;
  contact_number: string;
  wallet_balance?: string;
};

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed' | 'cancelled' | 'network_error';

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

type WalletBalance = {
  balance: number;
  currency: string;
};

// Payment constants
const PAYMENT_METHODS = {
  CREDIT_CARD: 1,
  DEBIT_CARD: 2,
  UPI: 3,
  NET_BANKING: 4,
  COD: 5,
  EATOOR_MONEY: 6,
  CASH_ON_DELIVERY: 5,
  UPI_ON_DELIVERY: 8,
} as const;

const PAYMENT_TYPES = {
  ONLINE: 1,
  COD: 2,
  UPI_ON_DELIVERY: 3,
} as const;

const PAYMENT_STATUS = {
  IN_PROGRESS: 1,
  PENDING: 2,
  REFUNDED: 3,
  FAILED: 4,
  COMPLETED: 5,
} as const;

const ORDER_STATUS = {
  PENDING: 1,
  CONFIRMED: 2,
  PREPARING: 3,
  READY_FOR_DELIVERY: 4,
  ON_THE_WAY: 5,
  DELIVERED: 6,
  CANCELLED: 7,
  REFUNDED: 8,
} as const;

// Payment method options - Updated with proper wallet handling
type PaymentMethodOption = {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  type: 'online' | 'cod' | 'wallet';
  disabled?: boolean;
  disabledReason?: string;
};

const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    id: 1,
    title: 'Online',
    subtitle: 'UPI / Cards / Net Banking',
    icon: 'card-outline',
    type: 'online',
  },
  {
    id: 2,
    title: 'Pay on Delivery',
    subtitle: 'UPI / Cash',
    icon: 'cash-outline',
    type: 'cod',
  },
  {
    id: 3,
    title: 'Eatoor Money',
    subtitle: 'Use your wallet balance',
    icon: 'wallet-outline',
    type: 'wallet',
  }
];

// Helper functions
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

const calculateTotalQuantity = (cartItems: CartItem[] = []): number => {
  return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
};

const determinePaymentStatus = (
  paymentMethod: number,
  isPaymentSuccessful: boolean,
  isWalletOnly: boolean = false
): number => {
  if (!isPaymentSuccessful) {
    return PAYMENT_STATUS.FAILED;
  }

  switch (paymentMethod) {
    case PAYMENT_METHODS.COD:
      return PAYMENT_STATUS.IN_PROGRESS;
    case PAYMENT_METHODS.CASH_ON_DELIVERY:
      return PAYMENT_STATUS.IN_PROGRESS;
    case PAYMENT_METHODS.UPI_ON_DELIVERY:
      return PAYMENT_STATUS.IN_PROGRESS;
    case PAYMENT_METHODS.EATOOR_MONEY:
      return PAYMENT_STATUS.COMPLETED;
    case PAYMENT_METHODS.CREDIT_CARD:
    case PAYMENT_METHODS.DEBIT_CARD:
    case PAYMENT_METHODS.UPI:
    case PAYMENT_METHODS.NET_BANKING:
      return PAYMENT_STATUS.COMPLETED;
    default:
      return PAYMENT_STATUS.IN_PROGRESS;
  }
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
  
  // Payment method selection states
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodOption | null>(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  
  // Payment tracking states
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [paymentAttemptId, setPaymentAttemptId] = useState<string | null>(null);
  
  // New states for enhanced modal
  const [modalDragOffset, setModalDragOffset] = useState(new Animated.Value(0));
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  
  // Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const paymentMethodSlideAnim = useRef(new Animated.Value(height)).current;
  
  // Refs for payment state
  const paymentInProgressRef = useRef(false);
  const razorpayOrderIdRef = useRef<string | null>(null);
  
  // Ref for modal pan responder
  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        setIsDraggingModal(true);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) { // Only allow downward drag
          modalDragOffset.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDraggingModal(false);
        
        // If dragged down enough, close the modal
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closePaymentMethodModal();
        } else {
          // Snap back to original position
          Animated.spring(modalDragOffset, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
        }
      },
    })
  ).current;

  const userId = user?.id;
  const sessionId = "";
  const kitchenId = pastKitchenDetails?.id;

  // Initialize refs
  useEffect(() => {
    razorpayOrderIdRef.current = razorpayOrderId;
  }, [razorpayOrderId]);

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        const savedAddressId = await AsyncStorage.getItem('AddressId');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          // Set initial wallet balance from user data
          if (parsedUser.wallet_balance) {
            setWalletBalance({
              balance: safePrice(parsedUser.wallet_balance),
              currency: 'INR'
            });
          }
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

  // Auto-select wallet as default payment when Eatoor Money covers full amount
  useEffect(() => {
    const finalAmount = calculateFinalAmount();
    const walletBalanceAmount = walletBalance?.balance || 0;
    const totalAmount = safePrice(cartData?.billing_details.total || 0);
    
    // If Eatoor Money is checked and wallet balance covers full amount
    if (useWallet && walletBalanceAmount >= totalAmount && finalAmount === 0) {
      // Find wallet payment method option
      const walletOption = PAYMENT_METHOD_OPTIONS.find(option => option.type === 'wallet');
      if (walletOption && (!selectedPaymentMethod || selectedPaymentMethod.type !== 'wallet')) {
        setSelectedPaymentMethod(walletOption);
      }
    }
    
    // If wallet is unchecked or insufficient, and no payment method is selected, set a default
    if (!selectedPaymentMethod) {
      const onlineOption = PAYMENT_METHOD_OPTIONS.find(option => option.type === 'online');
      if (onlineOption) {
        setSelectedPaymentMethod(onlineOption);
      }
    }
  }, [useWallet, walletBalance, cartData]);

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
    } else if (paymentStatus === 'success' || paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'network_error') {
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

  // Handle payment method modal animation with smooth entry
  const openPaymentMethodModal = () => {
    setShowPaymentMethodModal(true);
    Animated.timing(paymentMethodSlideAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      useNativeDriver: true,
    }).start();
  };

  const closePaymentMethodModal = () => {
    Animated.timing(paymentMethodSlideAnim, {
      toValue: height,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setShowPaymentMethodModal(false);
      modalDragOffset.setValue(0); // Reset drag offset
    });
  };

  // Toggle payment dropdown
  const togglePaymentDropdown = () => {
    openPaymentMethodModal();
  };

  // Fetch wallet balance
  const fetchWalletBalance = async () => {
    if (!userId) return;
    
    try {
      setWalletLoading(true);
      setWalletError(null);
      
      const response = await getWalletBalance(userId);
      
      if (response.status === 200) {
        const balanceData = {
          balance: safePrice(response.data.balance),
          currency: response.data.currency || 'INR'
        };
        setWalletBalance(balanceData);
        
        // Update user data in AsyncStorage
        try {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const parsedUser = JSON.parse(userData);
            parsedUser.wallet_balance = balanceData.balance.toString();
            await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
          }
        } catch (storageError) {
          console.error('Error updating wallet in storage:', storageError);
        }
        
        // If wallet has balance, check if it should be auto-selected
        if (balanceData.balance > 0 && !selectedPaymentMethod) {
          const walletOption = PAYMENT_METHOD_OPTIONS.find(option => option.type === 'wallet');
          if (walletOption) {
            setSelectedPaymentMethod(walletOption);
          }
        }
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
        const updatedResponse = response.data as CartApiResponse;
        
        if (updatedResponse.billing_details) {
          if (updatedResponse.delivery_offer_exist) {
            updatedResponse.billing_details.delivery_amount = 0;
          }
          
          const subtotal = safePrice(updatedResponse.billing_details.subtotal);
          const deliveryAmount = safePrice(updatedResponse.billing_details.delivery_amount);
          const tax = safePrice(updatedResponse.billing_details.tax);
          
          updatedResponse.billing_details.total = subtotal + deliveryAmount + tax;
        }
        
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
  const calculateFinalAmount = (): number => {
    if (!cartData) return 0;
    
    const totalAmount = safePrice(cartData.billing_details.total);
    
    if (useWallet && walletBalance) {
      const walletAmount = safePrice(walletBalance.balance);
      const amountAfterWallet = totalAmount - walletAmount;
      
      return Math.max(amountAfterWallet, 0);
    }
    
    return totalAmount;
  };

  // Calculate how much wallet will be used
  const calculateWalletUsage = (): number => {
    if (!cartData || !useWallet || !walletBalance) return 0;
    
    const totalAmount = safePrice(cartData.billing_details.total);
    const walletAmount = safePrice(walletBalance.balance);
    
    return Math.min(walletAmount, totalAmount);
  };

  // Function to debit amount from wallet
  const debitWalletAmount = async (amount: number, orderId?: number) => {
    if (!userId) {
      throw new Error('User ID is required to debit wallet');
    }

    try {
      const payload = {
        user_id: userId,
        amount: amount,
        order_id: orderId,
        description: 'Payment for order',
        transaction_type: 'debit'
      };

      const response = await debitWallet(payload);

      if (response.status === 200) {
        console.log(`Successfully debited ₹${amount} from wallet`);
        await fetchWalletBalance();
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to debit wallet');
      }
    } catch (error) {
      console.error('Error debiting wallet:', error);
      throw error;
    }
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
          navigation.navigate('TrackOrder', { 
            order: { 
              order_number: orderNumber,
              prev_location: 'HomeTabs', 
            } 
          });
        }, 300);
      }
    });
  };

  // Get payment method ID based on selected option
  const getPaymentMethodId = (): number => {
    if (!selectedPaymentMethod) {
      return PAYMENT_METHODS.UPI; // Default to UPI
    }

    switch (selectedPaymentMethod.type) {
      case 'online':
        return PAYMENT_METHODS.UPI;
      case 'cod':
        return PAYMENT_METHODS.CASH_ON_DELIVERY;
      case 'wallet':
        return PAYMENT_METHODS.EATOOR_MONEY;
      default:
        return PAYMENT_METHODS.UPI;
    }
  };

  // Get payment type based on selected option
  const getPaymentType = (): number => {
    if (!selectedPaymentMethod) {
      return PAYMENT_TYPES.ONLINE;
    }

    switch (selectedPaymentMethod.type) {
      case 'online':
        return PAYMENT_TYPES.ONLINE;
      case 'cod':
        return PAYMENT_TYPES.COD;
      case 'wallet':
        return PAYMENT_TYPES.ONLINE;
      default:
        return PAYMENT_TYPES.ONLINE;
    }
  };

  const createRazorpayOrder = async (): Promise<string> => {
    if (!cartData || !userId || !kitchenId) {
      throw new Error('Required data missing for creating order');
    }

    try {
      const finalAmount = calculateFinalAmount();
      const attemptId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setPaymentAttemptId(attemptId);
      
      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        amount: finalAmount * 100,
        currency: 'INR',
        receipt: attemptId,
        notes: {
          wallet_used: useWallet ? 'true' : 'false',
          wallet_amount: useWallet ? calculateWalletUsage().toString() : '0',
          restaurant_name: cartData.restaurant_name,
          delivery_offer: cartData.delivery_offer_exist ? 'true' : 'false',
          payment_attempt_id: attemptId
        }
      };

      const response = await createPayment(payload);
      
      if (response.status === 200) {
        const orderId = response.data.data.id;
        const razorpay_key = response.data.data.key;

        setRazorpayOrderId(orderId);
        razorpayOrderIdRef.current = orderId;

        return {
          orderId: orderId,
          razorpay_key: razorpay_key,
        };

      } else {
        throw new Error(
          response.data.message || 'Failed to create Razorpay order'
        );
      }

    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    }
  };

  // ONLY CALL THIS FUNCTION FOR SUCCESSFUL PAYMENTS
  const updateOrderDetails = async (
    razorpayPaymentId: string,
    isWalletOnly: boolean = false,
    isCOD: boolean = false
  ): Promise<UpdateOrderResponse> => {
    if (!cartData || !kitchenId || !addressId || !userId) {
      throw new Error('Required data missing for updating order');
    }

    try {
      const walletUsage = useWallet ? calculateWalletUsage() : 0;
      const finalAmount = calculateFinalAmount();
      const isWalletPaymentOnly = isWalletOnly || (useWallet && finalAmount === 0);
      const paymentMethod = getPaymentMethodId();
      
      const paymentStatusValue = isCOD ? 
        PAYMENT_STATUS.IN_PROGRESS : // For COD, payment is in progress
        determinePaymentStatus(
          paymentMethod,
          true, // Payment is successful
          isWalletPaymentOnly
        );

      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        delivery_address_id: addressId,
        special_instructions: '',
        is_takeaway: false,
        
        payment_method: paymentMethod,
        payment_type: getPaymentType(),
        payment_status: paymentStatusValue,
        
        status: ORDER_STATUS.PENDING, // Order is pending as payment is successful
        
        subtotal: safePrice(cartData.billing_details.subtotal),
        tax: safePrice(cartData.billing_details.tax),
        delivery_fee: safePrice(cartData.billing_details.delivery_amount),
        total_amount: safePrice(cartData.billing_details.total),
        quantity: calculateTotalQuantity(cartData.cart_details),
        
        razorpay_order_id: isCOD || isWalletPaymentOnly ? null : razorpayOrderIdRef.current,
        razorpay_payment_id: isCOD || isWalletPaymentOnly ? null : razorpayPaymentId,
        
        wallet_used: useWallet,
        wallet_amount: walletUsage,
        final_amount: finalAmount,
        
        delivery_offer_applied: cartData.delivery_offer_exist,
        
        code: null,
        coupon_discount: 0,
        discount_amount: 0,
        
        // Track payment attempt
        payment_attempt_id: paymentAttemptId
      };

      console.log('Creating order with payload:', payload);

      const response = await updatePyamentData(payload);
      if (response.status === 201) {
        return response.data;
      } else {
        console.error('Failed to create order:', response.data);
        throw new Error(response.data.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  // Verify payment status (called only for successful online payments)
  const verifyPaymentStatus = async (paymentResponse: PaymentResponse) => {
    if (!cartData || !userId || !kitchenId || !addressId || !paymentResponse) {
      console.error("Missing required payment data");
      showPaymentStatusModal('failed', 'Required data missing for payment verification');
      return;
    }
    
    try { 
      // Step 1: Create order in backend for successful payment
      const updateResponse = await updateOrderDetails(
        paymentResponse.razorpay_payment_id, 
        false // not wallet only
      );

      // Step 2: Debit wallet amount if wallet is used
      if (useWallet && calculateWalletUsage() > 0) {
        try {
          await debitWalletAmount(calculateWalletUsage(), updateResponse.order_id);
          console.log(`Wallet debited: ₹${calculateWalletUsage().toFixed(2)}`);
        } catch (walletError) {
          console.error('Wallet debit failed:', walletError);
          // Continue even if wallet debit fails
        }
      }

      // Step 3: Prepare verification payload
      const payload = {
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        eatoor_order_id: updateResponse.order_id,
        user_id: userId,
        amount: calculateFinalAmount() * 100,
        wallet_used: useWallet,
        wallet_amount: useWallet ? calculateWalletUsage() : 0,
        restaurant_id: kitchenId,
        delivery_offer_applied: cartData.delivery_offer_exist
      };

      // Step 4: Verify payment with backend
      const response = await verifyPayment(payload);

      if (response.status === 200) {
        const verificationData = response.data as VerifyPaymentResponse;

        setOrderDetails({
          order_id: verificationData.eatoor_order_id,
          order_number: verificationData.eatoor_order_number
        });

        setPaymentVerification({
          verifying: false,
          message: 'Payment verified successfully!',
          success: true
        });

        showPaymentStatusModal('success', 'Payment successful! Redirecting to order details...', verificationData.eatoor_order_number);
      } else {
        // If verification fails, we still have an order created
        // But we show verification failed message
        throw new Error(response.data.message || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);

      setPaymentVerification({
        verifying: false,
        message: 'Payment verification failed',
        success: false
      });

      // Even if verification fails, order is already created
      // So we show appropriate message
      showPaymentStatusModal('failed', 'Payment completed but verification failed. Please check your order history.');
    }
  };

  // Helper function to determine if error is a user cancellation
  const isUserCancelledError = (error: any): boolean => {
    if (!error) return false;
    
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorCode = error.code || error.error?.code || '';
    const errorDescription = error.description || error.error?.description || '';
    
    // Check for cancellation indicators
    const cancellationIndicators = [
      'cancelled',
      'user cancelled',
      'payment cancelled',
      'user canceled',
      'payment canceled',
      'user pressed back button',
      'back pressed',
      'modal dismissed',
      'user closed the checkout'
    ];
    
    // Check error codes
    if (errorCode === 'USER_CANCELLED' || 
        errorCode === 'PAYMENT_CANCELLED' ||
        errorCode === 'USER_CANCELED') {
      return true;
    }
    
    // Check error description
    if (cancellationIndicators.some(indicator => 
      errorDescription.toLowerCase().includes(indicator))) {
      return true;
    }
    
    // Check error string
    if (cancellationIndicators.some(indicator => 
      errorStr.includes(indicator))) {
      return true;
    }
    
    return false;
  };

  // Helper function to determine if error is a network error
  const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    
    const errorStr = JSON.stringify(error).toLowerCase();
    const errorCode = error.code || error.error?.code || '';
    const errorDescription = error.description || error.error?.description || '';
    
    const networkIndicators = [
      'network',
      'internet',
      'connection',
      'timeout',
      'offline',
      'no internet',
      'connectivity',
      'connection error',
      'network error'
    ];
    
    if (errorCode === 'NETWORK_ERROR' || errorCode === 'CONNECTION_ERROR') {
      return true;
    }
    
    if (networkIndicators.some(indicator => 
      errorDescription.toLowerCase().includes(indicator))) {
      return true;
    }
    
    if (networkIndicators.some(indicator => 
      errorStr.includes(indicator))) {
      return true;
    }
    
    return false;
  };

  // Helper function to determine if error is a payment failure (not cancellation)
  const isPaymentFailureError = (error: any): boolean => {
    if (!error) return false;
    
    if (isUserCancelledError(error) || isNetworkError(error)) {
      return false;
    }
    
    // If not cancellation or network error, it's a payment failure
    return true;
  };

  // Get user-friendly error message
  const getUserFriendlyErrorMessage = (error: any): string => {
    if (isUserCancelledError(error)) {
      return 'Payment was cancelled. You can try again.';
    }
    
    if (isNetworkError(error)) {
      return 'Unable to connect. Please check your internet connection and try again.';
    }
    
    // For other payment failures
    const errorDescription = error.description || error.error?.description || error.message || '';
    
    if (errorDescription.toLowerCase().includes('insufficient')) {
      return 'Insufficient balance. Please try a different payment method.';
    }
    
    if (errorDescription.toLowerCase().includes('card')) {
      return 'Card payment failed. Please check your card details or try a different card.';
    }
    
    if (errorDescription.toLowerCase().includes('upi')) {
      return 'UPI payment failed. Please try again or use a different payment method.';
    }
    
    if (errorDescription.toLowerCase().includes('failed') || errorDescription.toLowerCase().includes('error')) {
      return 'Payment could not be completed. Please try again.';
    }
    
    return 'Something went wrong. Please try again.';
  };

  // Handle payment cancellation cleanly - NO ORDER CREATION
  const handlePaymentCancellation = (error: any) => {
    console.log('Payment cancelled by user:', error);
    
    // Reset all states - NO API CALLS
    setPaymentStatus('cancelled');
    setShowBlurOverlay(false);
    setPaymentVerification({
      verifying: false,
      message: '',
      success: false
    });
    
    // Show user-friendly cancellation message
    showPaymentStatusModal('cancelled', getUserFriendlyErrorMessage(error));
    
    // Reset payment attempt tracking
    setPaymentAttemptId(null);
    paymentInProgressRef.current = false;
    setIsPaymentInProgress(false);
  };

  // Handle network error - NO ORDER CREATION
  const handleNetworkError = (error: any) => {
    console.log('Network error during payment:', error);
    
    // Reset all states - NO API CALLS
    setPaymentStatus('network_error');
    setShowBlurOverlay(false);
    setPaymentVerification({
      verifying: false,
      message: '',
      success: false
    });
    
    // Show user-friendly network error message
    showPaymentStatusModal('network_error', getUserFriendlyErrorMessage(error));
    
    // Reset payment attempt tracking
    setPaymentAttemptId(null);
    paymentInProgressRef.current = false;
    setIsPaymentInProgress(false);
  };

  // Handle payment failure (non-cancellation, non-network) - NO ORDER CREATION
  const handlePaymentFailure = (error: any) => {
    console.log('Payment failed:', error);
    
    // Reset all states - NO API CALLS for order creation
    setPaymentStatus('failed');
    setShowBlurOverlay(false);
    setPaymentVerification({
      verifying: false,
      message: '',
      success: false
    });
    
    // Show user-friendly error message
    showPaymentStatusModal('failed', getUserFriendlyErrorMessage(error));
    
    // Reset payment attempt tracking
    setPaymentAttemptId(null);
    paymentInProgressRef.current = false;
    setIsPaymentInProgress(false);
  };

  // Handle wallet payment - Scenario 1
  const handleWalletPayment = async () => {
    if (!cartData || !userId || !kitchenId || !addressId) {
      showPaymentStatusModal('failed', 'Required information missing');
      return;
    }
    
    const walletBalanceAmount = walletBalance?.balance || 0;
    const totalAmount = safePrice(cartData.billing_details.total);

    // Scenario 1: If wallet has insufficient balance, navigate to EatoorMoney page
    if (walletBalanceAmount < totalAmount) {
      navigation.navigate('EatoorMoneyAdd', { 
        prevScreen: 'CartScreen',
        amountToAdd: totalAmount - walletBalanceAmount
      });
      setShowPaymentMethodModal(false);
      return;
    }
    
    // Prevent multiple payment attempts
    if (paymentInProgressRef.current) {
      console.log('Payment already in progress');
      return;
    }
    
    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentStatus('processing');
    setShowBlurOverlay(true);
    
    try {
      // Create order with wallet payment
      const updateResponse = await updateOrderDetails('', true);
      
      if (updateResponse.status === 'success') {
        // Debit wallet amount for wallet-only payment
        const walletUsage = calculateWalletUsage();
        if (useWallet && walletUsage > 0) {
          try {
            await debitWalletAmount(walletUsage, updateResponse.order_id);
          } catch (walletError) {
            console.error('Wallet debit failed:', walletError);
          }
        }
        
        setOrderDetails({
          order_id: updateResponse.order_id,
          order_number: updateResponse.order_number
        });
        
        // Clear cart after successful payment
        AsyncStorage.removeItem('pastKitchenDetails');
        
        showPaymentStatusModal('success', 'Payment successful using Eatoor Money!', updateResponse.order_number);
      } else {
        throw new Error('Failed to process wallet payment');
      }
    } catch (error) {
      console.error('Wallet payment error:', error);
      showPaymentStatusModal('failed', 'Eatoor Money payment failed');
    } finally {
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
      setShowBlurOverlay(false);
    }
  };

  // Handle COD payment - Scenario 3
  const handleCODPayment = async () => {
    if (!cartData || !userId || !kitchenId || !addressId) {
      showPaymentStatusModal('failed', 'Required information missing');
      return;
    }
    
    // Prevent multiple payment attempts
    if (paymentInProgressRef.current) {
      console.log('Payment already in progress');
      return;
    }
    
    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentStatus('processing');
    setShowBlurOverlay(true);
    
    try {
      // Create order with COD payment
      const updateResponse = await updateOrderDetails('', false, true);
      
      if (updateResponse.status === 'success') {
        // If wallet is used with COD, debit the wallet amount
        if (useWallet && calculateWalletUsage() > 0) {
          try {
            await debitWalletAmount(calculateWalletUsage(), updateResponse.order_id);
          } catch (walletError) {
            console.error('Wallet debit failed for COD:', walletError);
          }
        }
        
        setOrderDetails({
          order_id: updateResponse.order_id,
          order_number: updateResponse.order_number
        });
        
        // Clear cart after successful order
        AsyncStorage.removeItem('pastKitchenDetails');
        
        showPaymentStatusModal('success', 
          `Order placed successfully! ${calculateFinalAmount() > 0 ? `Pay ₹${calculateFinalAmount().toFixed(2)} at delivery.` : 'Paid with Eatoor Money.'}`, 
          updateResponse.order_number
        );
      } else {
        throw new Error('Failed to process COD order');
      }
    } catch (error) {
      console.error('COD payment error:', error);
      showPaymentStatusModal('failed', 'Failed to place COD order');
    } finally {
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
      setShowBlurOverlay(false);
    }
  };

  // Handle Online payment - Scenario 2
  const handleOnlinePayment = async () => {
    // Prevent multiple payment attempts
    if (paymentInProgressRef.current) {
      console.log('Payment already in progress');
      return;
    }
    
    if (!cartData || !user) {
      showPaymentStatusModal('failed', 'Cart data or user information is missing');
      return;
    }
    
    const finalAmount = calculateFinalAmount();
    
    // Check minimum order value for remaining amount
    if (finalAmount > 0 && finalAmount < MINIMUM_ORDER_VALUE) {
      Alert.alert(
        'Minimum Order Value',
        `Minimum order value for online payment is ₹${MINIMUM_ORDER_VALUE}. Please add more items or choose Cash on Delivery.`
      );
      return;
    }
    
    if (!addressId) {
      Alert.alert(
        'Delivery Address Required',
        'Please select a delivery address before proceeding to payment.'
      );
      return;
    }
    
    // Set payment in progress state
    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentStatus('processing');
    setShowBlurOverlay(true);
    
    try {
      // Create Razorpay order for the remaining amount
      const response = await createRazorpayOrder();

      const options = {
        description: `Order from ${cartData.restaurant_name}`,
        image: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png',
        currency: 'INR',
        key: response.razorpay_key,
        amount: finalAmount * 100,
        name: "Eatoor",
        order_id: response.orderId,
        prefill: {
          email: user.email,
          contact: user.contact_number,
          name: user.full_name
        },
        theme: { color: '#E65C00' },
        notes: {
          order_from: 'Eatoor App',
          user_id: userId,
          delivery_offer: cartData.delivery_offer_exist ? 'true' : 'false',
          payment_attempt_id: paymentAttemptId
        }
      };

      if (Platform.OS === 'android') {
        options.modal = {
          ondismiss: () => {
            console.log('Payment modal dismissed on Android');
            handlePaymentCancellation({ 
              code: 'USER_CANCELLED', 
              description: 'Payment modal dismissed by user',
              source: 'modal_dismiss'
            });
          }
        };
    } else {
      // For iOS, we'll handle dismissal through error callback
      // No modal.ondismiss needed as iOS handles it differently
    }
      console.log('Opening Razorpay checkout with options:', options);

      // Open Razorpay checkout with proper error handling
      try {
        const data: PaymentResponse = await RazorpayCheckout.open(options);
        
        // Start verification process
        setPaymentVerification({
          verifying: true,
          message: 'Verifying your payment...',
          success: false
        });
        
        try {
          await verifyPaymentStatus(data);
        } catch (verificationError) {
          showPaymentStatusModal('failed', 'Payment verification failed');
        }
      } catch (error) {
        console.log('Razorpay checkout error:', error);
        
        if (isUserCancelledError(error)) {
          handlePaymentCancellation(error);
        } else if (isNetworkError(error)) {
          handleNetworkError(error);
        } else {
          handlePaymentFailure(error);
        }
      }
    } catch (error) {
      console.error('Error initiating online payment:', error);
      showPaymentStatusModal('failed', 'Payment initiation failed');
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
      setShowBlurOverlay(false);
    }
  };

  const initiatePayment = async () => {
    // Check if address is selected
    if (!addressId) {
      handleAddressChange(); // Navigate to address selection screen
      return;
    }
    
    // Check if payment method is selected
    if (!selectedPaymentMethod) {
      openPaymentMethodModal();
      return;
    }
    
    // Directly handle based on selected payment method
    switch (selectedPaymentMethod.type) {
      case 'wallet':
        handleWalletPayment();
        break;
      case 'cod':
        handleCODPayment();
        break;
      case 'online':
        handleOnlinePayment();
        break;
      default:
        openPaymentMethodModal();
    }
  };

  // Enhanced payment method modal with smooth animation and drag to close
  const renderPaymentMethodModal = () => {
    const finalAmount = calculateFinalAmount();
    const walletUsage = calculateWalletUsage();
    const totalAmount = safePrice(cartData?.billing_details.total || 0);
    const walletBalanceAmount = walletBalance?.balance || 0;
    
    // Combine drag animation with slide animation
    const modalTranslateY = Animated.add(
      paymentMethodSlideAnim,
      modalDragOffset
    );

    // Background opacity animation
    const backdropOpacity = paymentMethodSlideAnim.interpolate({
      inputRange: [0, height],
      outputRange: [1, 0],
    });

    return (
      <Modal
        visible={showPaymentMethodModal}
        transparent
        animationType="none"
        onRequestClose={closePaymentMethodModal}
      >
        <Animated.View style={[styles.paymentMethodModalOverlay, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={closePaymentMethodModal}>
            <View style={styles.paymentMethodModalBackdrop} />
          </TouchableWithoutFeedback>
          
          <Animated.View 
            style={[
              styles.paymentMethodModalContainer,
              { 
                transform: [{ translateY: modalTranslateY }],
                height: height * 0.55 
              }
            ]}
          >
            {/* Drag Handle */}
            <View style={styles.dragHandleContainer} {...modalPanResponder.panHandlers}>
              <View style={styles.dragHandle} />
            </View>
            
            {/* Modal Header */}
            <View style={styles.paymentMethodModalHeader}>
              <Text style={styles.paymentMethodModalTitle}>Choose Payment Method</Text>
              <TouchableOpacity 
                onPress={closePaymentMethodModal}
                style={styles.paymentMethodModalCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={scale(24)} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Payment Method Options */}
            <ScrollView 
              style={styles.paymentMethodListContainer}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => {
                let isDisabled = false;
                let disabledReason = '';
                
                // Check if wallet option should be disabled
                if (option.type === 'wallet') {
                  if (walletBalanceAmount <= 0) {
                    isDisabled = true;
                    disabledReason = 'No balance in Eatoor Money';
                  } else if (walletBalanceAmount < totalAmount) {
                    // Not disabled, but will show insufficient balance message
                  }
                }

                // Check if COD option should be disabled for online-only restaurants
                if (option.type === 'cod' && cartData?.restaurant_name) {
                  // Add your logic here if COD should be disabled for certain restaurants
                  // isDisabled = !restaurantAcceptsCOD;
                  // disabledReason = 'Cash on Delivery not available for this restaurant';
                }
                
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.paymentMethodOption,
                      selectedPaymentMethod?.id === option.id && styles.paymentMethodOptionSelected,
                      isDisabled && styles.paymentMethodOptionDisabled
                    ]}
                    onPress={() => {
                      if (!isDisabled) {
                        setSelectedPaymentMethod(option);
                        if (option.type === 'wallet') {
                          setUseWallet(true);
                        }
                        closePaymentMethodModal();
                      }
                    }}
                    disabled={isDisabled || showBlurOverlay || isPaymentInProgress}
                    activeOpacity={0.7}
                  >
                    <View style={styles.paymentMethodOptionContent}>
                      <View style={[
                        styles.paymentMethodIconContainer,
                        selectedPaymentMethod?.id === option.id && styles.paymentMethodIconContainerSelected,
                        option.type === 'wallet' && useWallet && styles.walletIconContainerActive
                      ]}>
                        <Icon 
                          name={option.icon} 
                          size={scale(22)} 
                          color={
                            selectedPaymentMethod?.id === option.id ? '#fff' : 
                            option.type === 'wallet' && useWallet ? '#E65C00' : '#666'
                          } 
                        />
                      </View>
                      <View style={styles.paymentMethodTextContainer}>
                        <View style={styles.paymentMethodTitleContainer}>
                          <Text style={[
                            styles.paymentMethodOptionTitle,
                            selectedPaymentMethod?.id === option.id && styles.paymentMethodOptionTitleSelected,
                            isDisabled && styles.paymentMethodOptionTextDisabled,
                            option.type === 'wallet' && useWallet && styles.walletOptionTitleActive
                          ]}>
                            {option.title}
                          </Text>
                          {option.type === 'wallet' && useWallet && (
                            <View style={styles.walletActiveBadge}>
                              <Text style={styles.walletActiveBadgeText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[
                          styles.paymentMethodOptionSubtitle,
                          selectedPaymentMethod?.id === option.id && styles.paymentMethodOptionSubtitleSelected,
                          isDisabled && styles.paymentMethodOptionTextDisabled,
                          option.type === 'wallet' && useWallet && styles.walletOptionSubtitleActive
                        ]}>
                          {option.subtitle}
                        </Text>
                        
                        {/* Wallet balance info for wallet option */}
                        {option.type === 'wallet' && walletBalance && !isDisabled && (
                          <View style={styles.walletBalanceInfo}>
                            <Text style={[
                              styles.walletBalanceText,
                              walletBalanceAmount < totalAmount && styles.insufficientBalanceText
                            ]}>
                              Balance: ₹{walletBalanceAmount.toFixed(2)}
                            </Text>
                            {walletBalanceAmount < totalAmount && (
                              <Text style={styles.insufficientMessage}>
                                Add ₹{(totalAmount - walletBalanceAmount).toFixed(2)} more
                              </Text>
                            )}
                          </View>
                        )}
                        
                        {/* Disabled reason */}
                        {isDisabled && disabledReason && (
                          <Text style={styles.disabledReasonText}>
                            {disabledReason}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.paymentMethodOptionRight}>
                      {selectedPaymentMethod?.id === option.id ? (
                        <View style={styles.selectedIndicator}>
                          <Icon name="checkmark-circle" size={scale(22)} color="#E65C00" />
                        </View>
                      ) : (
                        <Icon name="chevron-forward" size={scale(18)} color="#ccc" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              
              {/* Information Note */}
              <View style={styles.infoNote}>
                <Icon name="information-circle-outline" size={scale(16)} color="#666" />
                <Text style={styles.infoNoteText}>
                  You can use Eatoor Money along with other payment methods
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    );
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
        // Show inline message instead of alert
      }
    } catch (err) {
      console.error('Error updating cart:', err);
      // Show inline message instead of alert
    } finally {
      setUpdatingItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const BackToKitchen = () => {
    if (kitchenId) {
      navigation.navigate('HomeKitchenDetails', { kitchenId: kitchenId });
    } else {
      navigation.goBack();
    }
  };

  const handleClearCart = () => {
    // Show inline confirmation in future update
    if (!cartData || !kitchenId || !userId) return;
    
    // Directly clear cart without alert
    const clearCartItems = async () => {
      try {
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
      }
    };
    
    clearCartItems();
  };

  const getTotalItems = () => {
    if (!cartData?.cart_details) return 0;
    return calculateTotalQuantity(cartData.cart_details);
  };

  // Render Eatoor Money section in footer
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
    const totalAmount = safePrice(cartData?.billing_details.total || 0);
    const isInsufficient = useWallet && balance < totalAmount;
    const finalAmount = calculateFinalAmount();

    return (
      <View style={styles.eatoorMoneyContainer}>
        <View style={styles.eatoorMoneyToggleRow}>
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => {
              const newUseWallet = !useWallet;
              setUseWallet(newUseWallet);
              
              // If user unchecks wallet and amount is zero, reset to default payment method
              if (!newUseWallet && finalAmount === 0) {
                const onlineOption = PAYMENT_METHOD_OPTIONS.find(option => option.type === 'online');
                if (onlineOption) {
                  setSelectedPaymentMethod(onlineOption);
                }
              }
              
              // If user checks wallet and it covers full amount, auto-select wallet payment
              if (newUseWallet && balance >= totalAmount) {
                const walletOption = PAYMENT_METHOD_OPTIONS.find(option => option.type === 'wallet');
                if (walletOption) {
                  setSelectedPaymentMethod(walletOption);
                }
              }
            }}
            disabled={showBlurOverlay || isPaymentInProgress}
          >
            <View style={[
              styles.checkbox,
              useWallet && styles.checkboxChecked,
              (balance <= 0 || showBlurOverlay || isPaymentInProgress) && styles.checkboxDisabled
            ]}>
              {useWallet && (
                <Icon name="checkmark" size={scale(12)} color="#fff" />
              )}
            </View>
            <View style={styles.checkboxLabelContainer}>
              <View style={styles.checkboxLabelRow}>
                <Text style={[
                  styles.checkboxLabel,
                  (balance <= 0 || showBlurOverlay || isPaymentInProgress) && styles.checkboxLabelDisabled
                ]}>
                  Use Eatoor Money
                </Text>
              </View>
              <Text style={[
                styles.balanceTextSmall,
                isInsufficient && styles.insufficientBalanceText,
                (showBlurOverlay || isPaymentInProgress) && styles.balanceTextDisabled
              ]}>
                Balance: ₹{balance.toFixed(2)}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('EatoorMoneyAdd', { 
              prevScreen: 'CartScreen',
              amountToAdd: 0
            })}
            disabled={showBlurOverlay || isPaymentInProgress}
          >
            <Text style={styles.addMoneyButtonText}>Add Money</Text>
            <Icon name="arrow-forward" size={scale(14)} color="#E65C00" style={styles.addMoneyIcon} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render payment method dropdown in footer - SIDE BY SIDE with button
  const renderPaymentMethodDropdown = () => {
    const finalAmount = calculateFinalAmount();
    
    // Check if address is selected
    const isAddressSelected = !!addressId;
    
    // Determine button text based on address selection
    let buttonText = '';
    if (!isAddressSelected) {
      buttonText = 'Select Location';
    } else if (selectedPaymentMethod?.type === 'cod') {
      buttonText = 'Place Order';
    } else if (finalAmount === 0) {
      buttonText = 'Place Order';
    } else {
      buttonText = `Pay ₹${finalAmount.toFixed(0)}`;
    }

    return (
      <View style={styles.paymentMethodInlineContainer}>
        {/* Payment Method Selection */}
        <TouchableOpacity 
          style={styles.paymentMethodDropdown}
          onPress={togglePaymentDropdown}
          disabled={showBlurOverlay || isPaymentInProgress}
          activeOpacity={0.7}
        >
          <View style={styles.paymentMethodContent}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.paymentIcon}>
                {selectedPaymentMethod ? (
                  <Icon 
                    name={selectedPaymentMethod.icon} 
                    size={scale(20)} 
                    color="#E65C00"
                  />
                ) : (
                  <Icon 
                    name="card-outline" 
                    size={scale(20)} 
                    color="#E65C00"
                  />
                )}
              </View>
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              {/* Pay Using + Drop-up Icon */}
              <View style={styles.topRow}>
                <Text style={styles.payUsingLabel}>PAY USING</Text>
                <Icon 
                  name="chevron-up" 
                  size={scale(12)} 
                  color="#666" 
                />
              </View>

              {/* Payment Method Name */}
              <View style={styles.paymentMethodRow}>
                <Text style={styles.paymentMethodName} numberOfLines={1}>
                  {selectedPaymentMethod ? selectedPaymentMethod.title : 'Select Payment'}
                </Text>
              </View>

              {/* Payment Details */}
              <Text style={styles.paymentDetails} numberOfLines={1}>
                {finalAmount === 0 ? 'Paid with Eatoor Money' : selectedPaymentMethod?.subtitle || 'UPI/Cash/Cards'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Proceed Button */}
        <TouchableOpacity 
          style={[
            styles.proceedButton,
            (isPaymentInProgress || paymentStatus === 'processing') && styles.proceedButtonDisabled,
            !isAddressSelected && styles.selectLocationButton
          ]}
          onPress={initiatePayment}
          disabled={paymentStatus === 'processing' || paymentVerification.verifying || showBlurOverlay || isPaymentInProgress}
          activeOpacity={0.8}
        >
          {paymentStatus === 'processing' || isPaymentInProgress ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.proceedButtonText}>
              {buttonText}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Render cart item
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
                (item.quantity <= 1 || showBlurOverlay || isPaymentInProgress) && styles.disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
              disabled={item.quantity <= 1 || showBlurOverlay || isPaymentInProgress}
            >
              {isUpdating && currentAction === 'decrement' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="remove" size={scale(14)} color={item.quantity <= 1 ? "#ccc" : "#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{safeText(item.quantity, '0')}</Text>
            
            <TouchableOpacity 
              style={[
                styles.quantityButton,
                (showBlurOverlay || isPaymentInProgress) && styles.disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
              disabled={isUpdating || showBlurOverlay || isPaymentInProgress}
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

  // Render suggested item
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
        disabled={showBlurOverlay || isPaymentInProgress}
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
                    (quantity <= 1 || showBlurOverlay || isPaymentInProgress) && styles.disabledButton
                  ]} 
                  onPress={() => updateItemQuantity(item.item_id, 'decrement', 'SUGGESTION')}
                  disabled={isUpdating || quantity <= 1 || showBlurOverlay || isPaymentInProgress}
                >
                  {isUpdating && currentAction === 'decrement' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="remove" size={scale(14)} color={quantity <= 1 ? "#ccc" : "#E65C00"} />
                  )}
                </TouchableOpacity>
                
                <Text style={styles.quantityText}>{safeText(quantity, '0')}</Text>
                
                <TouchableOpacity 
                  style={[
                    styles.quantityButton,
                    (showBlurOverlay || isPaymentInProgress) && styles.disabledButton
                  ]} 
                  onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                  disabled={isUpdating || showBlurOverlay || isPaymentInProgress}
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
                  isUpdating && styles.addItemButtonDisabled,
                  (showBlurOverlay || isPaymentInProgress) && styles.disabledButton
                ]}
                onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                disabled={isUpdating || showBlurOverlay || isPaymentInProgress}
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
  
  // Render empty cart
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

  // Safe format number
  const safeFormatNumber = (value, decimals = 2) => {
    const num = Number(value);
    if (isNaN(num)) return "0.00";
    return num.toFixed(decimals);
  };

  // Render cart content
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
                  disabled={showBlurOverlay || isPaymentInProgress}
                >
                  <Text style={styles.itemCountText}>{getTotalItems()}</Text>
                </TouchableOpacity>
              )}
            </View>

            {cartData?.cart_details?.length > 0 && (
              <TouchableOpacity 
                style={styles.clearCartButton}
                onPress={handleClearCart}
                disabled={showBlurOverlay || isPaymentInProgress}
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
                disabled={showBlurOverlay || isPaymentInProgress}
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
                  disabled={showBlurOverlay || isPaymentInProgress}
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
                <View style={styles.deliveryCostContainer}>
                  <Text style={styles.detailText}>
                    Delivery Fee
                  </Text>
                  {cartData?.delivery_offer_exist ? (
                    <View style={styles.deliveryOfferBadge}>
                      <Icon name="checkmark-circle" size={scale(12)} color="#fff" />
                      <Text style={styles.deliveryOfferText}>FREE</Text>
                    </View>
                  ) : (
                    <Text style={styles.deliveryFeeAmount}>
                      ₹{safeFormatNumber(cartData.billing_details.estimated_delivery_cost, 2)}
                    </Text>
                  )}
                </View>
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

        {/* Free Delivery Offer Message */}
        {cartData?.delivery_offer_exist && (
          <View style={styles.freeDeliveryOfferCard}>
            <View style={styles.freeDeliveryIcon}>
              <Icon name="gift" size={scale(20)} color="#E65C00" />
            </View>
            <View style={styles.freeDeliveryContent}>
              <Text style={styles.freeDeliveryTitle}>
                Free Delivery Offer Applied!
              </Text>
              <Text style={styles.freeDeliveryDescription}>
                Your delivery fee has been waived for this order
              </Text>
            </View>
          </View>
        )}

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
                  {cartData?.delivery_offer_exist && (
                    <Text style={styles.freeDeliveryBadgeInline}></Text>
                  )}
                </Text>
                <Text style={[
                  styles.billValue,
                  cartData?.delivery_offer_exist && styles.freeDeliveryValue
                ]}>
                  {cartData?.delivery_offer_exist ? (
                    <Text style={styles.freeDeliveryText}>FREE</Text>
                  ) : (
                    `₹${safeFormatNumber(cartData.billing_details.delivery_amount, 2)}`
                  )}
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

            {/* Eatoor Money Deduction Row */}
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
    
  // Render payment footer
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

    return (
      <View style={styles.paymentFooter}>
        {/* Eatoor Money Section */}
        {renderEatoorMoneySection()}
        
        {/* Payment Method Dropdown and Proceed Button - SIDE BY SIDE */}
        {renderPaymentMethodDropdown()}
      </View>
    );
  };

  // Render payment modal
  const renderPaymentModal = () => {
    let modalColor, iconName, iconSize, additionalContent, animationStyle, modalTitle;
    
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
      modalTitle = 'Verifying Payment';
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
          modalTitle = 'Payment Successful!';
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
          modalTitle = 'Payment Failed';
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
          modalTitle = 'Payment Cancelled';
          break;
        case 'network_error':
          modalColor = '#607D8B';
          iconName = 'wifi-outline';
          iconSize = scale(60);
          additionalContent = (
            <Animated.View style={[styles.successAnimation, { transform: [{ scale: scaleAnim }] }]}>
              <Icon name={iconName} size={iconSize} color="#fff" />
            </Animated.View>
          );
          animationStyle = styles.networkErrorModal;
          modalTitle = 'Connection Error';
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
          modalTitle = 'Processing Payment';
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
        onRequestClose={() => {
          if (paymentStatus !== 'processing' && !paymentVerification.verifying) {
            setShowPaymentModal(false);
          }
        }}
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
              {modalTitle && (
                <Text style={styles.modalTitle}>{modalTitle}</Text>
              )}
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
                    {paymentStatus === 'success' ? 'View Order' : 'OK'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Render blur overlay
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

  // Loading state
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

  // Error state
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
      
      {/* Enhanced Payment Method Selection Modal */}
      {renderPaymentMethodModal()}
      
      {isCartEmpty ? (
        renderEmptyCart()
      ) : (
        <>
          {/* Simple Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={BackToKitchen}
              style={styles.backButton}
              disabled={showBlurOverlay || isPaymentInProgress}
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
                disabled={showBlurOverlay || isPaymentInProgress}
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
  // Payment Method Inline Container (SIDE BY SIDE)
  paymentMethodInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(14),
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: '#eee',
  },
  paymentMethodDropdown: {
    flex: 1,
    marginRight: scale(16),
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: scale(12),
    marginTop: verticalScale(2),
  },
  paymentIcon: {
    width: scale(24),
    height: scale(24),
  },
  textContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  payUsingLabel: {
    fontSize: FONT.S,
    color: '#666',
    fontWeight: '500',
    marginRight: scale(6),
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: verticalScale(2),
  },
  paymentMethodName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  paymentDetails: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '400',
  },
  proceedButton: {
    backgroundColor: '#E65C00',
    borderRadius: scale(6),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(20),
    minWidth: scale(100),
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectLocationButton: {
    backgroundColor: '#E65C00',
  },
  proceedButtonDisabled: {
    opacity: 0.7,
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: FONT.BASE,
    fontWeight: '700',
  },
  // Order Amount Footer
  orderAmountFooterContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: scale(8),
    padding: scale(12),
    marginHorizontal: scale(12),
    marginTop: verticalScale(4),
    marginBottom: verticalScale(8),
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  amountRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  amountLabelFooter: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  amountValueFooter: {
    fontSize: FONT.SM,
    color: '#333',
    fontWeight: '600',
  },
  walletDeductionFooter: {
    color: '#E65C00',
    fontWeight: '700',
  },
  finalAmountRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(6),
    paddingTop: verticalScale(6),
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  finalAmountLabelFooter: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  finalAmountValueFooter: {
    fontSize: FONT.LG,
    fontWeight: '800',
    color: '#E65C00',
  },
  // Enhanced Payment Method Modal Styles
  paymentMethodModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  paymentMethodModalBackdrop: {
    flex: 1,
  },
  paymentMethodModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: scale(20),
    borderTopRightRadius: scale(20),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(4),
  },
  dragHandle: {
    width: scale(40),
    height: verticalScale(4),
    backgroundColor: '#e0e0e0',
    borderRadius: scale(2),
  },
  paymentMethodModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  paymentMethodModalTitle: {
    fontSize: FONT.XXL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  paymentMethodModalCloseButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentSummaryContainer: {
    padding: scale(20),
    backgroundColor: '#f8f9fa',
    marginHorizontal: scale(16),
    marginTop: verticalScale(8),
    borderRadius: scale(12),
    marginBottom: verticalScale(12),
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  amountLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  totalAmountValue: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#333',
  },
  walletDeductionText: {
    fontSize: FONT.SM,
    fontWeight: '700',
    color: '#E65C00',
  },
  finalAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(8),
    paddingTop: verticalScale(8),
    borderTopWidth: 1.5,
    borderTopColor: '#e8e8e8',
  },
  finalAmountLabel: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  finalAmountValue: {
    fontSize: FONT.XL,
    fontWeight: '800',
    color: '#E65C00',
  },
  paymentMethodListContainer: {
    maxHeight: height * 0.4,
    marginTop:15,
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(16),
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(12),
    marginBottom: verticalScale(8),
    borderRadius: scale(12),
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  paymentMethodOptionSelected: {
    borderColor: '#E65C00',
    backgroundColor: '#fff8f0',
    transform: [{ scale: 1.01 }],
  },
  paymentMethodOptionDisabled: {
    opacity: 0.5,
    borderColor: '#e8e8e8',
    backgroundColor: '#f8f8f8',
  },
  paymentMethodOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIconContainer: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
    borderWidth: 1.5,
    borderColor: '#ffe0cc',
  },
  paymentMethodIconContainerSelected: {
    backgroundColor: '#E65C00',
    borderColor: '#E65C00',
  },
  walletIconContainerActive: {
    backgroundColor: '#fff0e6',
    borderColor: '#E65C00',
  },
  paymentMethodTextContainer: {
    flex: 1,
  },
  paymentMethodTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  paymentMethodOptionTitle: {
    fontSize: FONT.LG,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: scale(8),
  },
  paymentMethodOptionTitleSelected: {
    color: '#E65C00',
  },
  walletOptionTitleActive: {
    color: '#E65C00',
  },
  walletActiveBadge: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(6),
    paddingVertical: verticalScale(2),
    borderRadius: scale(4),
  },
  walletActiveBadgeText: {
    color: '#fff',
    fontSize: FONT.XS,
    fontWeight: '700',
  },
  paymentMethodOptionSubtitle: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
    marginBottom: verticalScale(4),
  },
  paymentMethodOptionSubtitleSelected: {
    color: '#E65C00',
  },
  walletOptionSubtitleActive: {
    color: '#E65C00',
  },
  paymentMethodOptionTextDisabled: {
    color: '#999',
  },
  walletBalanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(2),
  },
  walletBalanceText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
  },
  insufficientBalanceText: {
    color: '#ff6b6b',
  },
  insufficientMessage: {
    fontSize: FONT.XS,
    color: '#ff6b6b',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  disabledReasonText: {
    fontSize: FONT.XS,
    color: '#ff6b6b',
    fontWeight: '500',
    marginTop: verticalScale(2),
  },
  paymentMethodOptionRight: {
    alignItems: 'flex-end',
  },
  selectedIndicator: {
    backgroundColor: '#fff',
    borderRadius: scale(20),
    padding: scale(2),
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: scale(12),
    borderRadius: scale(8),
    marginTop: verticalScale(12),
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  infoNoteText: {
    fontSize: FONT.SM,
    color: '#1976d2',
    fontWeight: '500',
    marginLeft: scale(8),
    flex: 1,
  },
  // Eatoor Money Section Styles
  eatoorMoneyContainer: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eatoorMoneyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: verticalScale(2),
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
  checkboxLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  checkboxLabel: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  checkboxLabelDisabled: {
    color: '#999',
  },
  balanceTextSmall: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '500',
  },
  balanceTextDisabled: {
    color: '#999',
  },
  insufficientMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: scale(8),
    borderRadius: scale(6),
    marginTop: verticalScale(4),
    borderWidth: 1,
    borderColor: '#ffd6d6',
  },
  insufficientMessageText: {
    fontSize: FONT.SM,
    color: '#ff6b6b',
    fontWeight: '500',
    marginLeft: scale(4),
    flex: 1,
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    backgroundColor: '#fff',
    borderRadius: scale(6),
    borderWidth: 1.5,
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
  // Section Cards
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
  // Cart Item Styles
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
  // Quantity Container
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
  // Suggested Items
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
  // Delivery Cost Container with Offer Badge
  deliveryCostContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliveryOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(6),
    marginLeft: scale(6),
  },
  deliveryOfferText: {
    color: '#fff',
    fontSize: FONT.XS,
    fontWeight: '700',
    marginLeft: scale(4),
  },
  deliveryFeeAmount: {
    fontSize: FONT.SM,
    color: '#333',
    fontWeight: '600',
    marginLeft: scale(6),
  },
  // Free Delivery Offer Card
  freeDeliveryOfferCard: {
    backgroundColor: '#e8f5e8',
    borderRadius: scale(12),
    padding: scale(12),
    marginBottom: verticalScale(12),
    marginTop: verticalScale(8),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  freeDeliveryIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(10),
    borderWidth: 1.5,
    borderColor: '#E65C00',
  },
  freeDeliveryContent: {
    flex: 1,
  },
  freeDeliveryTitle: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: verticalScale(2),
  },
  freeDeliveryDescription: {
    fontSize: FONT.SM,
    color: '#4caf50',
    fontWeight: '500',
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
  freeDeliveryBadgeInline: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: FONT.SM,
  },
  freeDeliveryValue: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  freeDeliveryText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: FONT.SM,
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
  modalTitle: {
    color: '#fff',
    fontSize: FONT.XL,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: verticalScale(10),
  },
  networkErrorModal: {
    backgroundColor: '#607D8B',
  },
});

export default CartScreen;