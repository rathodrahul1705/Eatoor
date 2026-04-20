import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
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
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCartDetails, updateCart, updatePyamentData } from '../../../api/cart';
import { getWalletBalance, debitWallet } from '../../../api/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionId } from '../../../utlis/utils';
import { AuthContext } from '../../../context/AuthContext';
import { PaymentModal } from './utils/PaymentModal';
import {
  getAllPaymentMethods,
} from './utils/UPIPaymentService';
import {
  initiateBackendPayment,
  processUPIPayment,
  startPaymentPolling,
  getCustomerDetails,
} from './utils/PaymentService';
import { 
  PaymentMethodModal, 
  PaymentMethodsResponse, 
  UPIPaymentApp, 
  WalletPaymentMethod, 
  NetbankingBank,
  SelectedPaymentType,
  SavedUPI
} from '../home/utils/PaymentMethodModal';

const { width, height } = Dimensions.get('window');

// Responsive scaling functions with Android optimization
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => {
  const scaled = size + (scale(size) - size) * factor;
  return Platform.OS === 'android' ? Math.round(scaled) : scaled;
};

// Responsive font sizes with Android-specific adjustments
const FONT = {
  XS: Platform.OS === 'android' ? Math.max(10, Math.round(scale(10))) : Math.max(10, scale(10)),
  SM: Platform.OS === 'android' ? Math.max(11, Math.round(scale(11))) : Math.max(11, scale(11)),
  BASE: Platform.OS === 'android' ? Math.max(12, Math.round(scale(12))) : Math.max(12, scale(12)),
  LG: Platform.OS === 'android' ? Math.max(13, Math.round(scale(13))) : Math.max(13, scale(13)),
  XL: Platform.OS === 'android' ? Math.max(15, Math.round(scale(15))) : Math.max(15, scale(15)),
  XXL: Platform.OS === 'android' ? Math.max(17, Math.round(scale(17))) : Math.max(17, scale(17)),
  XXXL: Platform.OS === 'android' ? Math.max(19, Math.round(scale(19))) : Math.max(19, scale(19)),
};

const MINIMUM_ORDER_VALUE = 1;

const PAYMENT_METHODS = {
  UPI: 3,
  COD: 5,
  EATOOR_MONEY: 6,
} as const;

const PAYMENT_TYPES = {
  ONLINE: 1,
  COD: 2,
} as const;

const PAYMENT_STATUS = {
  IN_PROGRESS: 1,
  COMPLETED: 5,
  FAILED: 6,
  PENDING: 7,
} as const;

const ORDER_STATUS = {
  PENDING: 1,
} as const;

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

type CartApiResponse = {
  status: string;
  restaurant_name: string;
  cart_details: CartItem[];
  suggestion_cart_items: SuggestedItem[];
  delivery_address_details: any;
  delivery_time: any;
  billing_details: any;
  distance_km: number;
  estimated_delivery_cost: number;
  delivery_offer_exist: boolean;
  order_count: number;
};

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

const calculateTotalQuantity = (cartItems: any[] = []): number => {
  return cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
};

const CartScreen = ({ route, navigation }: any) => {
  const [cartData, setCartData] = useState<CartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [shortAddress, setShortAddress] = useState<string>("Select Address");
  const [fullAddress, setFullAddress] = useState<string>("Select Address");
  const [pastKitchenDetails, setPastKitchenDetails] = useState<any>(null);
  const { isGuest } = useContext(AuthContext);

  // Wallet states
  const [walletBalance, setWalletBalance] = useState<any>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  
  // Payment method states from API
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsResponse | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<SelectedPaymentType>(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState<UPIPaymentApp | null>(null);
  const [selectedSavedUPI, setSelectedSavedUPI] = useState<SavedUPI | null>(null);
  const [selectedWalletApp, setSelectedWalletApp] = useState<WalletPaymentMethod | null>(null);
  const [selectedBank, setSelectedBank] = useState<NetbankingBank | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<'credit_card' | 'debit_card' | null>(null);
  const [showPaymentSectionModal, setShowPaymentSectionModal] = useState(false);
  const [installedUpiApps, setInstalledUpiApps] = useState<UPIPaymentApp[]>([]);
  const [allUpiApps, setAllUpiApps] = useState<UPIPaymentApp[]>([]);
  const [customUpiId, setCustomUpiId] = useState('');
  const [savedUpiIds, setSavedUpiIds] = useState<any[]>([]);
  const [showSavedUpiIds, setShowSavedUpiIds] = useState(false);
  const [checkingApps, setCheckingApps] = useState(true);
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  
  // New states for VPA and payment method type
  const [selectedUpiVpa, setSelectedUpiVpa] = useState<string>('');
  const [selectedUpiPaymentMethodType, setSelectedUpiPaymentMethodType] = useState<string>('');
  
  // Payment tracking states
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  const [currentOrderRef, setCurrentOrderRef] = useState<string | null>(null);
  const [currentPaymentData, setCurrentPaymentData] = useState<any>(null);
  
  // Payment Modal states
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalStatus, setPaymentModalStatus] = useState<'idle' | 'processing' | 'success' | 'failed' | 'pending'>('idle');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentError, setPaymentError] = useState('');
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [createdOrderTotal, setCreatedOrderTotal] = useState('');
  const [pollingAttempts, setPollingAttempts] = useState(0);
  
  // Refs
  const paymentInProgressRef = useRef(false);
  const pollingControlRef = useRef<any>(null);
  
  const [sessionId, setSessionId] = useState<any>(null);
  const userId = user?.id;
  const kitchenId = pastKitchenDetails?.id;

  // Load payment methods from API
  const loadPaymentMethods = useCallback(async () => {
    if (!userId && !isGuest) {
      console.log('Waiting for userId to load payment methods...');
      return;
    }
    
    setCheckingApps(true);
    try {      
      const response = userId
        ? await getAllPaymentMethods(userId)
        : await getAllPaymentMethods();
      
      console.log('Payment methods loaded:', response);
      setPaymentMethods(response);
      
      if (response.upi?.isActive && response.upi.apps) {
        const installedApps = response.upi.apps.filter(app => app.installed === true);
        const allApps = response.upi.apps;
        
        setInstalledUpiApps(installedApps);
        setAllUpiApps(allApps);
        
        if (installedApps.length > 0 && !selectedUpiApp && !selectedSavedUPI) {
          setSelectedUpiApp(installedApps[0]);
        }
      } else {
        setInstalledUpiApps([]);
        setAllUpiApps([]);
      }
      
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setInstalledUpiApps([]);
      setAllUpiApps([]);
    } finally {
      setCheckingApps(false);
    }
  }, [userId, sessionId, isGuest]);

  const initializeSession = useCallback(async () => {
    try {
      let session = await getSessionId();
      if (!session) {
        session = await getSessionId();
      }
      setSessionId(session);
      
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      }
      
      return session;
    } catch (error) {
      console.error("Error initializing session:", error);
      const fallbackSession = await getSessionId();
      setSessionId(fallbackSession);
      return fallbackSession;
    }
  }, []);
  
  // Initialize session and load user data
  useEffect(() => {
    initializeSession();
  }, []);

  // Load payment methods when userId becomes available
  useEffect(() => {
    if (userId || sessionId) {
      loadPaymentMethods();
    }
  }, [userId, sessionId, loadPaymentMethods]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        const savedAddressId = await AsyncStorage.getItem('AddressId');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
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

  useEffect(() => {
    if ((kitchenId && userId) || (kitchenId && sessionId)) {
      fetchCartData();
    }
  }, [userId, kitchenId, addressId, sessionId]);

  useEffect(() => {
    if (userId) {
      fetchWalletBalance();
    }
  }, [userId]);

  useEffect(() => {
    return () => {
      if (pollingControlRef.current) {
        pollingControlRef.current.stop();
        pollingControlRef.current = null;
      }
    };
  }, []);

  const fetchWalletBalance = async () => {
    if (!userId) return;
    
    try {
      setWalletLoading(true);
      const response = await getWalletBalance(userId);
      
      if (response.status === 200) {
        setWalletBalance({
          balance: safePrice(response.data.balance),
          currency: response.data.currency || 'INR'
        });
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  const fetchCartData = async () => {
    if (!kitchenId) {
      setError('No restaurant selected');
      setLoading(false);
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
          updatedResponse.suggestion_cart_items = updatedResponse.suggestion_cart_items.map((suggestedItem: SuggestedItem) => {
            const cartItem = updatedResponse.cart_details.find((item: CartItem) => item.item_id === suggestedItem.item_id);
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

  const updateAddressDisplay = async (cartResponse?: any) => {
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
    loadPaymentMethods();
  };

  const handleAddressChange = async () => {
    navigation.navigate('AddressScreen', { 
      prevLocation: 'CartScreen',
      onAddressSelect: async (selectedAddressId: string | number) => {
        await AsyncStorage.setItem('AddressId', String(selectedAddressId.id));
        setAddressId(String(selectedAddressId.id));
      }
    });
  };

  const calculateFinalAmount = (): number => {
    if (!cartData) return 0;
    
    const totalAmount = safePrice(cartData.billing_details?.total);
    
    if (useWallet && walletBalance && walletBalance.balance > 0) {
      const walletAmount = safePrice(walletBalance.balance);
      const amountAfterWallet = totalAmount - walletAmount;
      return Math.max(amountAfterWallet, 0);
    }
    
    return totalAmount;
  };

  const calculateWalletUsage = (): number => {
    if (!cartData || !useWallet || !walletBalance) return 0;
    
    const totalAmount = safePrice(cartData.billing_details?.total);
    const walletAmount = safePrice(walletBalance.balance);
    
    return Math.min(walletAmount, totalAmount);
  };

  const debitWalletAmount = async (amount: number, orderId?: number) => {
    if (!userId) return;

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
        await fetchWalletBalance();
        return response.data;
      }
    } catch (error) {
      console.error('Error debiting wallet:', error);
      throw error;
    }
  };

  const getPaymentMethodId = (): number => {
    switch (selectedPaymentType) {
      case 'upi':
      case 'saved_upi':
        return PAYMENT_METHODS.UPI;
      case 'wallet':
        return PAYMENT_METHODS.EATOOR_MONEY;
      case 'cod':
        return PAYMENT_METHODS.COD;
      case 'netbanking':
        return 4;
      case 'cards':
        if (selectedCardType === 'credit_card') return 1;
        if (selectedCardType === 'debit_card') return 2;
        return 1;
      default:
        return PAYMENT_METHODS.UPI;
    }
  };

  const getPaymentMethodType = (): string => {
    switch (selectedPaymentType) {
      case 'upi':
        return selectedUpiPaymentMethodType || 'APP';
      case 'saved_upi':
        return 'VPA';
      case 'wallet':
        return 'WALLET';
      case 'cod':
        return 'COD';
      case 'netbanking':
        return 'NETBANKING';
      case 'cards':
        return selectedCardType === 'credit_card' ? 'CREDIT_CARD' : 'DEBIT_CARD';
      default:
        return 'UNKNOWN';
    }
  };

  const getUpiVpaForPayment = (): string => {
    if (selectedSavedUPI) {
      return selectedSavedUPI.raw_vpa || selectedSavedUPI.vpa;
    }
    if (selectedUpiApp) {
      return selectedUpiApp.customUPIID || selectedUpiApp.vpa || selectedUpiApp.id;
    }
    return selectedUpiVpa || customUpiId;
  };

  const updatePaymentAndCreateOrder = async (
    transactionId: string | null,
    paymentId: string | null,
    paymentStatusValue: number,
    isWalletOnly: boolean = false,
    isCOD: boolean = false
  ): Promise<any> => {
    if (!cartData || !kitchenId || !addressId) {
      throw new Error('Required data missing');
    }

    try {
      const walletUsage = useWallet ? calculateWalletUsage() : 0;
      const finalAmount = calculateFinalAmount();
      const upiVpa = getUpiVpaForPayment();
      
      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        delivery_address_id: addressId,
        special_instructions: '',
        is_takeaway: false,
        payment_method: getPaymentMethodId(),
        payment_type: isCOD ? PAYMENT_TYPES.COD : PAYMENT_TYPES.ONLINE,
        payment_status: paymentStatusValue,
        status: ORDER_STATUS.PENDING,
        subtotal: safePrice(cartData.billing_details.subtotal),
        tax: safePrice(cartData.billing_details.tax),
        delivery_fee: safePrice(cartData.billing_details.delivery_amount),
        total_amount: safePrice(cartData.billing_details.total),
        quantity: calculateTotalQuantity(cartData.cart_details),
        transaction_id: isCOD || isWalletOnly ? null : transactionId,
        payment_id: isCOD || isWalletOnly ? null : paymentId,
        wallet_used: useWallet,
        wallet_amount: walletUsage,
        final_amount: finalAmount,
        coupon_discount: 0,
        discount_amount: 0,
        delivery_offer_applied: cartData.delivery_offer_exist,
        upi_id: upiVpa,
        vpa: upiVpa,
        payment_method_type: getPaymentMethodType(),
        payment_gateway: selectedPaymentType?.toUpperCase() || 'UPI',
        order_reference: currentOrderRef,
        bank_code: selectedBank?.code,
        card_type: selectedCardType,
      };

      const response = await updatePyamentData(payload);
      
      if (response.status === 201 || response.status === 200) {
        return response.data;
      } else {
        throw new Error('Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  const finalizePaymentAfterVerification = async (
    transactionId: string,
    paymentId: string,
    orderId: number,
    orderNumber: string,
    paymentStatus: number
  ): Promise<any> => {
    if (!cartData || !kitchenId || !addressId) {
      throw new Error('Required data missing');
    }

    try {
      const walletUsage = useWallet ? calculateWalletUsage() : 0;
      const finalAmount = calculateFinalAmount();
      const upiVpa = getUpiVpaForPayment();
      
      const payload = {
        user_id: userId,
        restaurant_id: kitchenId,
        delivery_address_id: addressId,
        special_instructions: '',
        is_takeaway: false,
        payment_method: getPaymentMethodId(),
        payment_type: PAYMENT_TYPES.ONLINE,
        payment_status: paymentStatus,
        status: ORDER_STATUS.PENDING,
        subtotal: safePrice(cartData.billing_details.subtotal),
        tax: safePrice(cartData.billing_details.tax),
        delivery_fee: safePrice(cartData.billing_details.delivery_amount),
        total_amount: safePrice(cartData.billing_details.total),
        quantity: calculateTotalQuantity(cartData.cart_details),
        transaction_id: transactionId,
        payment_id: paymentId,
        wallet_used: useWallet,
        wallet_amount: walletUsage,
        final_amount: finalAmount,
        coupon_discount: 0,
        discount_amount: 0,
        delivery_offer_applied: cartData.delivery_offer_exist,
        upi_id: upiVpa,
        vpa: upiVpa,
        payment_method_type: getPaymentMethodType(),
        payment_gateway: selectedPaymentType?.toUpperCase() || 'UPI',
        order_reference: currentOrderRef || transactionId,
        bank_code: selectedBank?.code,
        card_type: selectedCardType,
        order_id: orderId,
        order_number: orderNumber
      };

      console.log('Finalizing payment with payload:', payload);
      
      const response = await updatePyamentData(payload);
      
      if (response.status === 201 || response.status === 200) {
        console.log('Payment finalized successfully:', response.data);
        return response.data;
      } else {
        throw new Error('Failed to finalize payment');
      }
    } catch (error) {
      console.error('Error finalizing payment:', error);
      throw error;
    }
  };

  const resetPaymentState = () => {
    if (pollingControlRef.current) {
      pollingControlRef.current.stop();
      pollingControlRef.current = null;
    }
    setPaymentModalStatus('idle');
    setPollingAttempts(0);
    setCurrentTransactionId(null);
    setCurrentPaymentData(null);
    paymentInProgressRef.current = false;
    setIsPaymentInProgress(false);
  };

  const handlePaymentRetry = () => {
    setPaymentModalVisible(false);
    resetPaymentState();
    
    setTimeout(() => {
      if (selectedPaymentType === 'upi' || selectedPaymentType === 'saved_upi') {
        initiateUPIPaymentFlow();
      } else if (selectedPaymentType === 'wallet') {
        handleWalletPayment();
      }
    }, 300);
  };

  const handlePaymentCancel = () => {
    setPaymentModalVisible(false);
    resetPaymentState();
  };

  const handleViewOrder = (orderNumber: string) => {
    setPaymentModalVisible(false);
    resetPaymentState();
    navigation.navigate('TrackOrder', { order: { order_number: orderNumber, prev_location: "HomeTabs" } });
  };

  const initiateUPIPaymentFlow = async () => {
    if (!cartData || !kitchenId || !addressId) {
      Alert.alert('Error', 'Required information missing');
      return;
    }
    
    const finalAmount = calculateFinalAmount();
    
    if (finalAmount > 0 && finalAmount < MINIMUM_ORDER_VALUE) {
      Alert.alert('Minimum Order Value', `Minimum order value is ₹${MINIMUM_ORDER_VALUE}`);
      return;
    }
    
    if (!addressId) {
      Alert.alert('Delivery Address Required', 'Please select a delivery address');
      return;
    }
    
    if (paymentInProgressRef.current) return;
    
    const customerDetails = await getCustomerDetails();
    if (!customerDetails?.contact_number && !isGuest) {
      Alert.alert('Login Required', 'Please login to make payment');
      return;
    }
    
    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentAmount(finalAmount);
    setPaymentModalStatus('processing');
    setPaymentModalVisible(true);
    
    try {
      const walletUsage = useWallet ? calculateWalletUsage() : 0;
      const finalAmountCalc = calculateFinalAmount();
      const paymentMethodId = getPaymentMethodId();
      const totalAmount = safePrice(cartData.billing_details.total);
      const subtotal = safePrice(cartData.billing_details.subtotal);
      const tax = safePrice(cartData.billing_details.tax);
      const deliveryFee = safePrice(cartData.billing_details.delivery_amount);
      const quantity = calculateTotalQuantity(cartData.cart_details);
      const upiVpa = getUpiVpaForPayment();
      
      const orderData = {
        user_id: userId,
        restaurant_id: kitchenId,
        delivery_address_id: addressId,
        special_instructions: '',
        is_takeaway: false,
        payment_method: paymentMethodId,
        payment_type: PAYMENT_TYPES.ONLINE,
        payment_status: PAYMENT_STATUS.IN_PROGRESS,
        status: ORDER_STATUS.PENDING,
        subtotal: subtotal,
        tax: tax,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        quantity: quantity,
        coupon_discount: 0,
        discount_amount: 0,
        wallet_used: useWallet,
        wallet_amount: walletUsage,
        amount: finalAmountCalc,
        delivery_offer_applied: cartData.delivery_offer_exist || false,
        payment_gateway: selectedPaymentType?.toUpperCase() || 'UPI',
        productinfo: `Order from ${cartData.restaurant_name}`,
        firstname: customerDetails?.full_name || (user?.name) || 'Customer',
        email: customerDetails?.email || (user?.email) || 'customer@example.com',
        phone: customerDetails?.contact_number || (user?.mobile),
        upi_id: upiVpa,
        vpa: upiVpa,
        payment_method_type: getPaymentMethodType(),
        bank_code: selectedBank?.code,
        card_type: selectedCardType
      };
      
      const paymentInit = await initiateBackendPayment(orderData);
      
      setCurrentPaymentData(paymentInit);
      setCurrentTransactionId(paymentInit.txnid);
      setCurrentOrderRef(paymentInit.txnid);
      setCreatedOrderId(paymentInit.order_id);
      setCreatedOrderNumber(paymentInit.order_number);
      setCreatedOrderTotal(paymentInit.order_total);
      
      // For APP based UPI payment (not saved UPI)
      if (getPaymentMethodType() === "APP" && selectedUpiApp && !selectedSavedUPI) {
        const upiResult = await processUPIPayment(paymentInit, selectedUpiApp?.id);
        if (!upiResult.success) {
          throw new Error(upiResult.error || 'Failed to initiate payment app');
        }
      }
      
      setPaymentModalStatus('pending');
      setPollingAttempts(0);
      
      // Start polling for payment status
      setTimeout(() => {
        if (!paymentInProgressRef.current) return;
        
        const paymentMethodIdForPolling = getPaymentMethodId();
        const orderIdForPolling = paymentInit.order_id;
        
        pollingControlRef.current = startPaymentPolling(
          paymentInit.txnid,
          paymentMethodIdForPolling,
          orderIdForPolling,
          (statusUpdate) => {
            setPollingAttempts(statusUpdate.attempts);
          },
          async (result) => {
            pollingControlRef.current = null;
            
            if (result.success) {
              try {
                console.log('Payment verified successfully, finalizing order...');
                
                const finalizeResult = await finalizePaymentAfterVerification(
                  result.transaction_id || paymentInit.txnid,
                  result.payment_id || 'UPI_PAYMENT',
                  result.order_id || paymentInit.order_id,
                  result.order_number || paymentInit.order_number,
                  PAYMENT_STATUS.COMPLETED
                );
                
                console.log('Finalization result:', finalizeResult);
                
                if (useWallet && calculateWalletUsage() > 0) {
                  await debitWalletAmount(calculateWalletUsage(), result.order_id || paymentInit.order_id);
                }
                
                await AsyncStorage.removeItem('pastKitchenDetails');
                
                const finalOrderNumber = finalizeResult.order_number || paymentInit.order_number;
                const finalOrderId = finalizeResult.order_id || paymentInit.order_id;
                const finalOrderTotal = finalizeResult.total_amount || finalizeResult.final_amount || paymentInit.order_total;
                
                setCreatedOrderNumber(finalOrderNumber);
                setCreatedOrderId(finalOrderId);
                setCreatedOrderTotal(finalOrderTotal);
                setPaymentModalStatus('success');
                
              } catch (finalizeError) {
                console.error('Error finalizing payment:', finalizeError);
                setPaymentError('Payment successful but order update failed. Please contact support.');
                setPaymentModalStatus('failed');
              }
            } else {
              setPaymentError(result.error || 'Payment could not be verified');
              setPaymentModalStatus('failed');
              console.log('Payment failed for transaction:', paymentInit.txnid);
            }
            
            paymentInProgressRef.current = false;
            setIsPaymentInProgress(false);
          },
          {
            interval: 5000,
            maxAttempts: 10,
            timeout: 120000,
            onPending: (pendingInfo) => {
              setPollingAttempts(pendingInfo.attempts);
            }
          }
        );
      }, 5000);
      
    } catch (error: any) {
      console.error('UPI payment error:', error);
      setPaymentError(error.message || 'Failed to initiate payment');
      setPaymentModalStatus('failed');
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
    }
  };

  const handleWalletPayment = async () => {
    if (!cartData || !userId || !kitchenId || !addressId) {
      Alert.alert('Error', 'Required information missing');
      return;
    }
    
    const walletBalanceAmount = walletBalance?.balance || 0;
    const totalAmount = safePrice(cartData.billing_details?.total);

    if (walletBalanceAmount < totalAmount) {
      Alert.alert('Insufficient Balance', 'Please add money to your Eatoor Money wallet');
      return;
    }
    
    if (paymentInProgressRef.current) return;
    
    const finalAmount = calculateFinalAmount();
    
    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentAmount(finalAmount);
    setPaymentModalStatus('processing');
    setPaymentModalVisible(true);
    
    try {
      const updateResponse = await updatePaymentAndCreateOrder(
        null,
        null,
        PAYMENT_STATUS.COMPLETED,
        true
      );
      
      if (updateResponse && (updateResponse.status === 'success' || updateResponse.order_id)) {
        const walletUsage = calculateWalletUsage();
        if (useWallet && walletUsage > 0) {
          await debitWalletAmount(walletUsage, updateResponse.order_id);
        }
        
        await AsyncStorage.removeItem('pastKitchenDetails');
        
        const finalOrderNumber = updateResponse.order_number;
        const finalOrderId = updateResponse.order_id;
        const finalOrderTotal = updateResponse.total_amount || updateResponse.final_amount;
        
        setCreatedOrderNumber(finalOrderNumber);
        setCreatedOrderId(finalOrderId);
        setCreatedOrderTotal(finalOrderTotal);
        setPaymentModalStatus('success');
      } else {
        throw new Error('Wallet payment failed');
      }
    } catch (error) {
      console.error('Wallet payment error:', error);
      setPaymentError('Wallet payment failed. Please try again.');
      setPaymentModalStatus('failed');
    } finally {
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
    }
  };

  const handleCODPayment = async () => {
    if (!cartData || !kitchenId || !addressId) {
      Alert.alert('Error', 'Required information missing');
      return;
    }
    
    if (paymentInProgressRef.current) return;
    
    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    
    try {
      const updateResponse = await updatePaymentAndCreateOrder(
        null,
        null,
        PAYMENT_STATUS.IN_PROGRESS,
        false,
        true
      );
      
      if (updateResponse && (updateResponse.status === 'success' || updateResponse.order_id)) {
        if (useWallet && calculateWalletUsage() > 0) {
          await debitWalletAmount(calculateWalletUsage(), updateResponse.order_id);
        }
        
        await AsyncStorage.removeItem('pastKitchenDetails');
        
        const finalOrderNumber = updateResponse.order_number;
        const finalOrderId = updateResponse.order_id;
        const finalOrderTotal = updateResponse.total_amount || updateResponse.final_amount;
        
        setCreatedOrderNumber(finalOrderNumber);
        setCreatedOrderId(finalOrderId);
        setCreatedOrderTotal(finalOrderTotal);
        setPaymentModalStatus('success');
        setPaymentModalVisible(true);
      } else {
        throw new Error('Failed to place COD order');
      }
    } catch (error) {
      console.error('COD payment error:', error);
      setPaymentError('Failed to place COD order. Please try again.');
      setPaymentModalStatus('failed');
      setPaymentModalVisible(true);
    } finally {
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
    }
  };

  const initiatePayment = async () => {
    if (!addressId) {
      handleAddressChange();
      return;
    }
    
    if (!selectedPaymentType) {
      setShowPaymentSectionModal(true);
      return;
    }
    
    switch (selectedPaymentType) {
      case 'wallet':
        handleWalletPayment();
        break;
      case 'cod':
        handleCODPayment();
        break;
      case 'upi':
      case 'saved_upi':
        if (selectedUpiApp || selectedSavedUPI || customUpiId) {
          initiateUPIPaymentFlow();
        } else {
          setShowPaymentSectionModal(true);
        }
        break;
      case 'netbanking':
      case 'cards':
        Alert.alert('Coming Soon', `${selectedPaymentType?.toUpperCase()} payment integration coming soon!`);
        break;
      default:
        setShowPaymentSectionModal(true);
    }
  };

  const selectPaymentMethod = (type: SelectedPaymentType, data?: any, vpa?: string, paymentMethodType?: string) => {
    setSelectedPaymentType(type);
    
    // Reset selection states
    setSelectedUpiApp(null);
    setSelectedSavedUPI(null);
    setSelectedWalletApp(null);
    setSelectedBank(null);
    setSelectedCardType(null);
    setSelectedUpiVpa('');
    setSelectedUpiPaymentMethodType('');
    
    if (type === 'upi' && data) {
      setSelectedUpiApp(data);
      if (vpa) {
        setSelectedUpiVpa(vpa);
      } else if (data.customUPIID) {
        setSelectedUpiVpa(data.customUPIID);
      } else if (data.vpa) {
        setSelectedUpiVpa(data.vpa);
      } else {
        setSelectedUpiVpa(data.id);
      }
      setSelectedUpiPaymentMethodType(paymentMethodType || (data.customUPIID ? 'VPA' : 'APP'));
    }
    
    if (type === 'saved_upi' && data) {
      setSelectedSavedUPI(data);
      const vpaToUse = data.raw_vpa || data.vpa;
      setSelectedUpiVpa(vpaToUse);
      setSelectedUpiPaymentMethodType('SAVED_UPI');
    }
    
    if (type === 'wallet' && data) {
      setSelectedWalletApp(data);
    }
    
    if (type === 'netbanking' && data) {
      setSelectedBank(data);
    }
    
    if (type === 'cards' && data) {
      setSelectedCardType(data);
    }
    
    setShowPaymentSectionModal(false);
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
      }
    } catch (err) {
      console.error('Error updating cart:', err);
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
    if (!cartData || !kitchenId) return;
    
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

  const safeFormatNumber = (value: any, decimals = 2) => {
    const num = Number(value);
    if (isNaN(num)) return "0.00";
    return num.toFixed(decimals);
  };

  // Corrected Suggested Item Renderer with proper discount handling
const renderSuggestedItem = ({ item }: { item: SuggestedItem }) => {
  const isUpdating = updatingItems.some(i => i.id === item.item_id);
  const currentAction = isUpdating 
    ? updatingItems.find(i => i.id === item.item_id)?.action 
    : null;
  
  const quantity = item.quantity || 0;
  const itemPrice = safePrice(item.item_price);
  const originalPrice = safePrice(item.original_item_price);
  const discountPercent = safePrice(item.discount_percent);
  const discountActive = item.discount_active === 1;
  const discountAmount = originalPrice - itemPrice;
  const discountPercentage = discountPercent > 0 ? discountPercent : Math.round((discountAmount / originalPrice) * 100);

  return (
    <TouchableOpacity 
      style={styles.suggestedItemCard}
      onPress={() => {
        if (quantity === 0) {
          updateItemQuantity(item.item_id, 'increment', 'SUGGESTION');
        }
      }}
      activeOpacity={0.7}
      disabled={isPaymentInProgress}
    >
      {/* Image Section with Badge */}
      <View style={styles.suggestedItemImageContainer}>
        <Image 
          source={{ uri: item.item_image || 'https://via.placeholder.com/150' }} 
          style={styles.suggestedItemImage} 
          resizeMode="cover"
        />
        <View style={[
          styles.suggestedItemTypeBadge,
          item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
        ]}>
          <View style={[
            styles.suggestedItemTypeIndicator,
            item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
          ]} />
        </View>
        {discountActive && discountPercentage > 0 && (
          <View style={styles.discountBadgeAbsolute}>
            <Text style={styles.discountBadgeText}>{discountPercentage}% OFF</Text>
          </View>
        )}
      </View>
      
      {/* Content Section */}
      <View style={styles.suggestedItemContent}>
        <Text style={styles.suggestedItemName} numberOfLines={2}>
          {safeText(item.item_name, 'Unnamed Item')}
        </Text>
        
        {/* Price Section */}
        <View style={styles.suggestedItemPriceContainer}>
          {discountActive && originalPrice > itemPrice ? (
            <>
              <Text style={styles.currentPrice}>₹{itemPrice.toFixed(2)}</Text>
              <Text style={styles.originalSuggestedPrice}>₹{originalPrice.toFixed(2)}</Text>
            </>
          ) : (
            <Text style={styles.currentPrice}>₹{itemPrice.toFixed(2)}</Text>
          )}
        </View>
        
        {/* Action Button - Always at bottom in one line */}
        <View style={styles.suggestedItemFooter}>
          {quantity > 0 ? (
            <View style={styles.quantityContainerHorizontal}>
              <TouchableOpacity 
                style={[
                  styles.quantityButtonHorizontal,
                  (quantity <= 1 || isPaymentInProgress) && styles.disabledButton
                ]} 
                onPress={() => updateItemQuantity(item.item_id, 'decrement', 'SUGGESTION')}
              >
                {isUpdating && currentAction === 'decrement' ? (
                  <ActivityIndicator size="small" color="#E65C00" />
                ) : (
                  <Icon name="remove" size={moderateScale(14)} color={quantity <= 1 ? "#ccc" : "#E65C00"} />
                )}
              </TouchableOpacity>
              
              <Text style={styles.quantityTextHorizontal}>{safeText(quantity, '0')}</Text>
              
              <TouchableOpacity 
                style={[
                  styles.quantityButtonHorizontal,
                  isPaymentInProgress && styles.disabledButton
                ]} 
                onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
              >
                {isUpdating && currentAction === 'increment' ? (
                  <ActivityIndicator size="small" color="#E65C00" />
                ) : (
                  <Icon name="add" size={moderateScale(14)} color="#E65C00" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[
                styles.addItemButtonHorizontal,
                isUpdating && styles.addItemButtonDisabled,
                isPaymentInProgress && styles.disabledButton
              ]}
              onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
              disabled={isUpdating || isPaymentInProgress}
            >
              {isUpdating && currentAction === 'increment' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="add-circle-outline" size={moderateScale(16)} color="#fff" />
                  <Text style={styles.addItemButtonTextHorizontal}>ADD</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

  const handleWalletToggle = () => {
    const walletBalanceAmount = walletBalance?.balance || 0;
    
    // Don't allow toggling if balance is zero
    if (walletBalanceAmount <= 0) {
      Alert.alert('Insufficient Balance', 'Your Eatoor Money balance is zero. Please add money to use this payment method.');
      return;
    }
    
    const newUseWallet = !useWallet;
    setUseWallet(newUseWallet);
    
    if (newUseWallet && walletBalance && walletBalance.balance > 0) {
      const isEatoorMoneyAvailable = paymentMethods?.wallets?.isActive && 
        paymentMethods?.wallets?.wallets?.some(w => w.id === 'eatoor_money');
      
      if (isEatoorMoneyAvailable) {
        const eatoorWallet = paymentMethods?.wallets?.wallets?.find(w => w.id === 'eatoor_money');
        setSelectedPaymentType('wallet');
        if (eatoorWallet) {
          setSelectedWalletApp(eatoorWallet);
        }
      }
    }
  };

  const renderEatoorMoneySection = () => {
    const balance = walletBalance?.balance || 0;
    const isWalletActive = paymentMethods?.wallets?.isActive && paymentMethods?.wallets?.wallets?.length > 0;
    
    if (!isWalletActive) return null;

    return (
      <View style={styles.eatoorMoneyContainer}>
        <View style={styles.eatoorMoneyToggleRow}>
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={handleWalletToggle}
            disabled={isPaymentInProgress || balance <= 0}
          >
            <View style={[
              styles.checkbox,
              useWallet && styles.checkboxChecked,
              (balance <= 0 || isPaymentInProgress) && styles.checkboxDisabled
            ]}>
              {useWallet && <Icon name="checkmark" size={moderateScale(12)} color="#fff" />}
            </View>
            <View style={styles.checkboxLabelContainer}>
              <Text style={styles.checkboxLabel}>Use Eatoor Money</Text>
              <Text style={styles.balanceTextSmall}>Balance: ₹{balance.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.addMoneyButton}
            onPress={() => navigation.navigate('EatoorMoneyAdd', { prevScreen: 'CartScreen' })}
            disabled={isPaymentInProgress}
          >
            <Text style={styles.addMoneyButtonText}>Add Money</Text>
            <Icon name="arrow-forward" size={moderateScale(14)} color="#E65C00" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPaymentMethodSelector = () => {
    const finalAmount = calculateFinalAmount();
    const isAddressSelected = !!addressId;
    
    let buttonText = '';
    if (!isAddressSelected) {
      buttonText = 'Select Location';
    } else if (selectedPaymentType === 'cod') {
      buttonText = 'Place Order';
    } else if (finalAmount === 0) {
      buttonText = 'Place Order';
    } else {
      buttonText = `Pay ₹${finalAmount.toFixed(0)}`;
    }

    const getSelectedMethodDisplay = () => {
      if (!selectedPaymentType) {
        return { title: 'Select Payment', subtitle: 'Choose a payment method', icon: 'card-outline' };
      }
      
      switch (selectedPaymentType) {
        case 'upi':
          const vpaDisplay = selectedUpiVpa ? `VPA: ${selectedUpiVpa}` : '';
          const methodTypeDisplay = selectedUpiPaymentMethodType === 'VPA' ? ' (UPI ID)' : ' (UPI App)';
          return { 
            title: selectedUpiApp?.name || 'UPI', 
            subtitle: vpaDisplay || `Pay using UPI${methodTypeDisplay}`, 
            icon: 'phone-portrait-outline' 
          };
        case 'saved_upi':
          return {
            title: selectedSavedUPI?.name || 'Saved UPI',
            subtitle: `VPA: ${selectedSavedUPI?.vpa || selectedSavedUPI?.raw_vpa || ''}`,
            icon: 'save-outline'
          };
        case 'wallet':
          return { 
            title: selectedWalletApp?.name || 'Eatoor Money', 
            subtitle: `Balance: ₹${walletBalance?.balance.toFixed(2) || '0'}`,
            icon: 'wallet-outline' 
          };
        case 'cod':
          return { title: 'Pay on Delivery', subtitle: 'Cash / UPI at delivery', icon: 'cash-outline' };
        case 'netbanking':
          return { title: selectedBank?.name || 'Net Banking', subtitle: 'Pay via net banking', icon: 'business-outline' };
        case 'cards':
          return { title: selectedCardType === 'credit_card' ? 'Credit Card' : 'Debit Card', subtitle: 'Pay via card', icon: 'card-outline' };
        default:
          return { title: 'Select Payment', subtitle: 'Choose a payment method', icon: 'card-outline' };
      }
    };

    const display = getSelectedMethodDisplay();

    return (
      <View style={styles.paymentMethodInlineContainer}>
        <TouchableOpacity 
          style={styles.paymentMethodDropdown}
          onPress={() => setShowPaymentSectionModal(true)}
          disabled={isPaymentInProgress}
          activeOpacity={0.7}
        >
          <View style={styles.paymentMethodContent}>
            <View style={styles.iconContainer}>
              <View style={styles.paymentIconContainer}>
                <Icon name={display.icon} size={moderateScale(22)} color="#E65C00" />
              </View>
            </View>

            <View style={styles.textContainer}>
              <View style={styles.topRow}>
                <Text style={styles.payUsingLabel}>PAY USING</Text>
                <Icon name="chevron-down" size={moderateScale(12)} color="#999" />
              </View>

              <View style={styles.paymentMethodRow}>
                <Text style={styles.paymentMethodName} numberOfLines={1}>
                  {display.title}
                </Text>
              </View>
              <Text style={styles.paymentMethodSubtitle} numberOfLines={1}>
                {display.subtitle}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.proceedButton,
            (isPaymentInProgress || paymentModalStatus === 'processing') && styles.proceedButtonDisabled,
            !isAddressSelected && styles.selectLocationButton
          ]}
          onPress={initiatePayment}
          disabled={paymentModalStatus === 'processing' || isPaymentInProgress}
          activeOpacity={0.8}
        >
          <View style={styles.proceedButtonContent}>
            {paymentModalStatus === 'processing' || isPaymentInProgress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.proceedButtonText}>{buttonText}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Improved Cart Item Renderer
  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.some(i => i.id === item.item_id);
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
            <Text style={styles.itemName} numberOfLines={2}>
              {safeText(item.item_name, 'Unnamed Item')}
            </Text>            
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{originalPrice.toFixed(2)}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{discountPercent}% OFF</Text>
                </View>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{itemPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.cartQuantityContainer}>
            <TouchableOpacity 
              style={[
                styles.cartQuantityButton,
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="remove" size={moderateScale(16)} color={item.quantity <= 1 ? "#E65C00" : "#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.cartQuantityText}>{safeText(item.quantity, '0')}</Text>
            
            <TouchableOpacity 
              style={[
                styles.cartQuantityButton,
                isPaymentInProgress && styles.disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="add" size={moderateScale(16)} color="#E65C00" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyHeader}>
        <TouchableOpacity onPress={BackToKitchen} style={styles.backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color="#333" />
        </TouchableOpacity>
        <Text style={styles.emptyHeaderTitle}>
          {safeText(cartData?.restaurant_name, 'Your Cart')}
        </Text>
        <View style={{ width: moderateScale(24) }} />
      </View>
      
      <View style={styles.emptyContent}>
        <View style={styles.emptyIllustration}>
          <Icon name="cart-outline" size={moderateScale(80)} color="#E8ECF4" />
          <View style={styles.emptyIconOverlay}>
            <Icon name="close" size={moderateScale(40)} color="#E65C00" />
          </View>
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyDescription}>
          Looks like you haven't added anything to your cart yet
        </Text>
        
        <TouchableOpacity style={styles.exploreButton} onPress={BackToKitchen}>
          <View style={styles.exploreButtonContent}>
            <Text style={styles.exploreButtonText}>Browse Menu</Text>
            <Icon name="arrow-forward" size={moderateScale(20)} color="#fff" />
          </View>
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
            contentContainerStyle={styles.suggestedItemsHorizontalContainer}
          />
        </View>
      )}
    </View>
  );

  const renderCartContent = () => (
    <KeyboardAvoidingView 
      style={styles.scrollContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
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
        showsVerticalScrollIndicator={false}
      >
        {/* Your Items Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="restaurant-outline" size={moderateScale(20)} color="#E65C00" />
              <Text style={styles.sectionTitle}>Your Items</Text>
              {cartData?.cart_details?.length > 0 && (
                <View style={styles.itemCountBadge}>
                  <Text style={styles.itemCountText}>{getTotalItems()}</Text>
                </View>
              )}
            </View>

            {cartData?.cart_details?.length > 0 && (
              <TouchableOpacity 
                style={styles.clearCartButton}
                onPress={handleClearCart}
                disabled={isPaymentInProgress}
              >
                <Icon name="trash-outline" size={moderateScale(16)} color="#E65C00" />
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
            />
          </View>
        </View>

        {/* Add More Items Section - Improved Design */}
        {cartData?.suggestion_cart_items && cartData?.suggestion_cart_items.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Icon name="add-circle-outline" size={moderateScale(20)} color="#E65C00" />
                <Text style={styles.sectionTitle}>Add More Items</Text>
              </View>
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={BackToKitchen}
                disabled={isPaymentInProgress}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Icon name="chevron-forward" size={moderateScale(16)} color="#E65C00" />
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
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="location-outline" size={moderateScale(20)} color="#E65C00" />
              <Text style={styles.sectionTitle}>Delivery Details</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.detailCard}
            onPress={handleAddressChange}
            activeOpacity={0.7}
          >
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Icon name="navigate-circle" size={moderateScale(24)} color="#E65C00" />
              </View>
              <View style={styles.addressContainer}>
                <Text style={styles.detailLabel}>Delivery Address</Text>
                <Text style={styles.detailText}>
                  {fullAddress !== "Select Address" ? fullAddress : "Please select a delivery address"}
                </Text>
              </View>
              <Icon name="chevron-forward" size={moderateScale(20)} color="#ccc" />
            </View>

            {cartData?.delivery_time?.estimated_time && (
              <View style={[styles.detailRow, { marginTop: verticalScale(8), paddingTop: verticalScale(8), borderTopWidth: 1, borderTopColor: '#f0f0f0' }]}>
                <View style={styles.detailIconContainer}>
                  <Icon name="time-outline" size={moderateScale(24)} color="#E65C00" />
                </View>
                <View style={styles.addressContainer}>
                  <Text style={styles.detailLabel}>Delivery Time</Text>
                  <Text style={styles.detailText}>
                    {safeText(cartData?.delivery_time?.estimated_time)}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Bill Details Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Icon name="receipt-outline" size={moderateScale(20)} color="#E65C00" />
              <Text style={styles.sectionTitle}>Bill Details</Text>
            </View>
          </View>
          
          <View style={styles.billCard}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Item Total</Text>
              <Text style={styles.billValue}>
                ₹{safeFormatNumber(cartData?.billing_details?.subtotal, 2)}
              </Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <View style={styles.billValueContainer}>
                {cartData?.delivery_offer_exist && (
                  <View style={styles.freeDeliveryBadge}>
                    <Text style={styles.freeDeliveryBadgeText}>FREE</Text>
                  </View>
                )}
                <Text style={[
                  styles.billValue,
                  cartData?.delivery_offer_exist && styles.freeDeliveryValue
                ]}>
                  {cartData?.delivery_offer_exist ? '₹0' : `₹${safeFormatNumber(cartData?.billing_details?.delivery_amount, 2)}`}
                </Text>
              </View>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Tax & Charges</Text>
              <Text style={styles.billValue}>
                ₹{safeFormatNumber(cartData?.billing_details?.tax, 2)}
              </Text>
            </View>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
    
  const renderPaymentFooter = () => {
    if (!cartData || cartData?.cart_details?.length === 0) {
      return null;
    }

    return (
      <View style={styles.paymentFooter}>
        {!isGuest && renderEatoorMoneySection()}
        {renderPaymentMethodSelector()}
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
            <Icon name="warning-outline" size={moderateScale(48)} color="#E65C00" />
            <Text style={styles.errorText}>{safeText(error)}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={fetchCartData}>
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={BackToKitchen}>
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
      
      <PaymentModal
        visible={paymentModalVisible}
        status={paymentModalStatus}
        amount={paymentAmount}
        transactionId={currentTransactionId}
        errorMessage={paymentError}
        pollingAttempts={pollingAttempts}
        maxPollingAttempts={2}
        onRetry={handlePaymentRetry}
        onCancel={handlePaymentCancel}
        onViewOrder={handleViewOrder}
        orderNumber={createdOrderNumber}
        orderId={createdOrderId}
        orderTotal={createdOrderTotal}
        onDismiss={() => {
          setPaymentModalVisible(false);
          resetPaymentState();
        }}
      />
      
      <PaymentMethodModal
        visible={showPaymentSectionModal}
        onClose={() => setShowPaymentSectionModal(false)}
        paymentMethods={paymentMethods}
        selectedPaymentType={selectedPaymentType}
        selectedUpiApp={selectedUpiApp}
        selectedSavedUPI={selectedSavedUPI}
        selectedWalletApp={selectedWalletApp}
        selectedBank={selectedBank}
        selectedCardType={selectedCardType}
        savedUpiIds={savedUpiIds}
        checkingApps={checkingApps}
        onSelectPaymentMethod={selectPaymentMethod}
        onSelectSavedUPI={(savedUPI) => selectPaymentMethod('saved_upi', savedUPI, savedUPI.raw_vpa || savedUPI.vpa, 'SAVED_UPI')}
        customUpiId={customUpiId}
        setCustomUpiId={setCustomUpiId}
        walletBalance={walletBalance?.balance}
        userId={userId}
        isSavingUpi={isSavingUpi}
        refreshPaymentMethods={loadPaymentMethods}
      />
      
      {isCartEmpty ? (
        renderEmptyCart()
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={BackToKitchen}
              style={styles.backButton}
              disabled={isPaymentInProgress}
            >
              <Icon name="arrow-back" size={moderateScale(24)} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.restaurantName} numberOfLines={1}>
                {safeText(cartData?.restaurant_name, 'Restaurant')}
              </Text>
              <TouchableOpacity 
                onPress={handleAddressChange}
                style={styles.headerAddressContainer}
                disabled={isPaymentInProgress}
              >
                <Icon name="location-outline" size={moderateScale(14)} color="#E65C00" />
                <Text style={styles.headerAddressText} numberOfLines={1}>
                  {safeText(shortAddress, 'Select Address')}
                </Text>
                <Icon name="chevron-down" size={moderateScale(14)} color="#E65C00" />
              </TouchableOpacity>
            </View>
          </View>
          {renderCartContent()}
        </>
      )}
      
      {renderPaymentFooter()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
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
    paddingBottom: Platform.OS === 'android' ? verticalScale(180) : verticalScale(140),
    paddingHorizontal: scale(16),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'android' ? verticalScale(12) : verticalScale(12),
    paddingHorizontal: scale(16),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: Platform.OS === 'android' ? verticalScale(60) : verticalScale(70),
    ...Platform.select({
      android: {
        elevation: 2,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },
  backButton: {
    padding: moderateScale(8),
    marginRight: moderateScale(12),
    borderRadius: moderateScale(24),
    backgroundColor: '#f8f8f8',
    ...Platform.select({
      android: {
        elevation: 1,
      },
    }),
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: FONT.XL,
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
    marginLeft: scale(4),
    marginRight: scale(4),
    flex: 1,
  },
  paymentMethodInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: Platform.OS === 'android' ? verticalScale(10) : verticalScale(12),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  paymentMethodDropdown: {
    flex: 1,
    marginRight: scale(12),
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: moderateScale(12),
  },
  paymentIconContainer: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  payUsingLabel: {
    fontSize: FONT.XS,
    color: '#999',
    fontWeight: '600',
    marginRight: scale(6),
    letterSpacing: 0.5,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  paymentMethodName: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  paymentMethodSubtitle: {
    fontSize: FONT.XS,
    color: '#999',
  },
  proceedButton: {
    backgroundColor: '#E65C00',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    minWidth: moderateScale(110),
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  proceedButtonContent: {
    paddingVertical: Platform.OS === 'android' ? verticalScale(10) : verticalScale(12),
    paddingHorizontal: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectLocationButton: {
    opacity: 0.9,
  },
  proceedButtonDisabled: {
    opacity: 0.7,
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: FONT.BASE,
    fontWeight: '700',
  },
  eatoorMoneyContainer: {
    paddingHorizontal: scale(16),
    paddingVertical: Platform.OS === 'android' ? verticalScale(10) : verticalScale(12),
    backgroundColor: '#FFF8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eatoorMoneyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: moderateScale(6),
    borderWidth: 2,
    borderColor: '#E65C00',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(12),
  },
  checkboxChecked: {
    backgroundColor: '#E65C00',
    borderColor: '#E65C00',
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkboxLabelContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  balanceTextSmall: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
    marginTop: verticalScale(2),
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: Platform.OS === 'android' ? verticalScale(6) : verticalScale(8),
    backgroundColor: '#fff',
    borderRadius: moderateScale(8),
    borderWidth: 1.5,
    borderColor: '#E65C00',
  },
  addMoneyButtonText: {
    color: '#E65C00',
    fontSize: FONT.SM,
    fontWeight: '600',
    marginRight: scale(6),
  },
  sectionCard: {
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: verticalScale(12),
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: moderateScale(8),
  },
  itemCountBadge: {
    backgroundColor: '#E65C00',
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(12),
    marginLeft: moderateScale(8),
    minWidth: moderateScale(24),
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
    paddingHorizontal: moderateScale(12),
    paddingVertical: Platform.OS === 'android' ? verticalScale(5) : verticalScale(6),
    backgroundColor: '#FFF0E6',
    borderRadius: moderateScale(8),
  },
  clearCartText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
    marginLeft: moderateScale(4),
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
  cartItemCard: {
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(8),
    padding: moderateScale(12),
    backgroundColor: '#fff',
    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
    }),
  },
  cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTypeContainer: {
    marginRight: moderateScale(12),
  },
  itemTypeBadge: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(4),
    borderWidth: 2,
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
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#E65C00',
  },
  itemDetails: {
    flex: 1,
    marginRight: moderateScale(12),
  },
  itemName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(4),
    lineHeight: verticalScale(18),
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
    flexWrap: 'wrap',
  },
  originalPrice: {
    fontSize: FONT.SM,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: moderateScale(8),
  },
  discountBadge: {
    backgroundColor: '#FFF0E6',
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(4),
  },
  discountText: {
    fontSize: FONT.XS,
    color: '#E65C00',
    fontWeight: '700',
  },
  itemPrice: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#E65C00',
  },
  cartQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: moderateScale(24),
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(6),
  },
  cartQuantityButton: {
    padding: moderateScale(6),
    borderRadius: moderateScale(16),
    backgroundColor: '#fff',
    width: moderateScale(32),
    height: moderateScale(32),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  cartQuantityText: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#E65C00',
    marginHorizontal: moderateScale(10),
    minWidth: moderateScale(28),
    textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  addressContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: FONT.SM,
    color: '#999',
    fontWeight: '500',
    marginBottom: verticalScale(4),
  },
  detailText: {
    fontSize: FONT.SM,
    color: '#1a1a1a',
    lineHeight: verticalScale(18),
    fontWeight: '500',
  },
  billCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(12),
    paddingBottom: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  billLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  billValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billValue: {
    fontSize: FONT.SM,
    color: '#333',
    fontWeight: '600',
  },
  freeDeliveryBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(8),
  },
  freeDeliveryBadgeText: {
    fontSize: FONT.XS,
    color: '#4CAF50',
    fontWeight: '700',
  },
  eatoorMoneyDeductionBill: {
    color: '#E65C00',
    fontWeight: '700',
  },
  freeDeliveryValue: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(8),
    paddingTop: verticalScale(12),
    borderTopColor: '#E8ECF4',
  },
  totalLabel: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  totalValue: {
    fontSize: FONT.XL,
    fontWeight: '800',
    color: '#E65C00',
  },
  cartItemsList: {
    marginTop: verticalScale(4),
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(16),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: Platform.OS === 'android' ? verticalScale(16) : verticalScale(12),
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
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(24),
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
    fontSize: FONT.XXL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: FONT.SM,
    color: '#666',
    textAlign: 'center',
    marginBottom: verticalScale(24),
    lineHeight: verticalScale(20),
    paddingHorizontal: scale(32),
  },
  exploreButton: {
    backgroundColor: '#E65C00',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  exploreButtonContent: {
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginRight: moderateScale(8),
  },
  emptySuggestionsContainer: {
    marginBottom: verticalScale(16),
  },
  suggestionTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(12),
    paddingHorizontal: scale(16),
  },
  suggestedItemsHorizontalContainer: {
    paddingHorizontal: scale(8),
    paddingBottom: verticalScale(8),
  },
  // Improved Suggested Item Styles
  suggestedItemCard: {
    width: scale(180),
    backgroundColor: '#fff',
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    marginHorizontal: scale(8),
    ...Platform.select({
      android: {
        elevation: 3,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
    }),
  },
  suggestedItemImageContainer: {
    position: 'relative',
    height: verticalScale(100),
  },
  suggestedItemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  suggestedItemTypeBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(4),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  suggestedItemTypeIndicator: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
  },
  discountBadgeAbsolute: {
    position: 'absolute',
    bottom: scale(8),
    left: scale(8),
    backgroundColor: '#E65C00',
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
    borderRadius: moderateScale(6),
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  discountBadgeText: {
    fontSize: FONT.XS,
    color: '#fff',
    fontWeight: '700',
  },
  suggestedItemContent: {
    padding: moderateScale(12),
  },
  suggestedItemName: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(8),
    lineHeight: verticalScale(18),
    minHeight: verticalScale(36),
  },
  suggestedItemPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: verticalScale(12),
  },
  currentPrice: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#E65C00',
    marginRight: moderateScale(8),
  },
  originalSuggestedPrice: {
    fontSize: FONT.SM,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  suggestedItemFooter: {
    width: '100%',
  },
  // Horizontal quantity container for suggested items
  quantityContainerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F0',
    borderRadius: moderateScale(24),
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(4),
    width: '100%',
  },
  quantityButtonHorizontal: {
    padding: moderateScale(8),
    borderRadius: moderateScale(20),
    backgroundColor: '#fff',
    width: moderateScale(34),
    height: moderateScale(34),
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      android: {
        elevation: 1,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
    }),
  },
  quantityTextHorizontal: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#E65C00',
    marginHorizontal: moderateScale(8),
    minWidth: moderateScale(28),
    textAlign: 'center',
  },
  addItemButtonHorizontal: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(24),
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  addItemButtonDisabled: {
    opacity: 0.7,
  },
  addItemButtonTextHorizontal: {
    color: '#fff',
    fontSize: FONT.SM,
    fontWeight: '700',
    marginLeft: moderateScale(4),
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  errorText: {
    fontSize: FONT.LG,
    color: '#E65C00',
    marginBottom: verticalScale(20),
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    width: '80%',
    alignItems: 'center',
    marginBottom: verticalScale(12),
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
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
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    ...Platform.select({
      android: {
        elevation: 10,
      },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
    }),
  },
});

export default CartScreen;