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

// Responsive scaling functions
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;
const normalize = (size: number) => Math.round(scale(size));

// Responsive font sizes
const FONT = {
  XS: Math.max(10, normalize(10)),
  SM: Math.max(11, normalize(12)),
  BASE: Math.max(12, normalize(14)),
  LG: Math.max(14, normalize(16)),
  XL: Math.max(16, normalize(18)),
  XXL: Math.max(18, normalize(20)),
  XXXL: Math.max(20, normalize(22)),
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
        style={styles.cartscreen_page_suggestedItemCard}
        onPress={() => {
          if (quantity === 0) {
            updateItemQuantity(item.item_id, 'increment', 'SUGGESTION');
          }
        }}
        activeOpacity={0.7}
        disabled={isPaymentInProgress}
      >
        <View style={styles.cartscreen_page_suggestedItemImageContainer}>
          <Image 
            source={{ uri: item.item_image || 'https://via.placeholder.com/150' }} 
            style={styles.cartscreen_page_suggestedItemImage} 
            resizeMode="cover"
          />
          <View style={[
            styles.cartscreen_page_suggestedItemTypeBadge,
            item.type === 'Veg' ? styles.cartscreen_page_vegBadge : styles.cartscreen_page_nonVegBadge
          ]}>
            <View style={[
              styles.cartscreen_page_suggestedItemTypeIndicator,
              item.type === 'Veg' ? styles.cartscreen_page_vegIndicator : styles.cartscreen_page_nonVegIndicator
            ]} />
          </View>
        </View>
        
        <View style={styles.cartscreen_page_suggestedItemContent}>
          <Text style={styles.cartscreen_page_suggestedItemName} numberOfLines={2}>
            {safeText(item.item_name, 'Unnamed Item')}
          </Text>
          
          <View style={styles.cartscreen_page_suggestedItemDetails}>
            {item.discount_active ? (
              <View style={styles.cartscreen_page_priceRow}>
                <Text style={styles.cartscreen_page_originalPrice}>₹{originalPrice.toFixed(2)}</Text>
                <View style={styles.cartscreen_page_discountBadge}>
                  <Text style={styles.cartscreen_page_discountText}>{discountPercent}% OFF</Text>
                </View>
              </View>
            ) : null}
            
            <Text style={styles.cartscreen_page_itemPrice}>₹{itemPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.cartscreen_page_suggestedItemFooter}>
            {quantity > 0 ? (
              <View style={styles.cartscreen_page_quantityContainer}>
                <TouchableOpacity 
                  style={[
                    styles.cartscreen_page_quantityButton,
                    (quantity <= 1 || isPaymentInProgress) && styles.cartscreen_page_disabledButton
                  ]} 
                  onPress={() => updateItemQuantity(item.item_id, 'decrement', 'SUGGESTION')}
                >
                  {isUpdating && currentAction === 'decrement' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="remove" size={moderateScale(14)} color={quantity <= 1 ? "#ccc" : "#E65C00"} />
                  )}
                </TouchableOpacity>
                
                <Text style={styles.cartscreen_page_quantityText}>{safeText(quantity, '0')}</Text>
                
                <TouchableOpacity 
                  style={[
                    styles.cartscreen_page_quantityButton,
                    isPaymentInProgress && styles.cartscreen_page_disabledButton
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
                  styles.cartscreen_page_addItemButton,
                  isUpdating && styles.cartscreen_page_addItemButtonDisabled,
                  isPaymentInProgress && styles.cartscreen_page_disabledButton
                ]}
                onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                disabled={isUpdating || isPaymentInProgress}
              >
                {isUpdating && currentAction === 'increment' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.cartscreen_page_addItemButtonText}>ADD</Text>
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
      <View style={styles.cartscreen_page_eatoorMoneyContainer}>
        <View style={styles.cartscreen_page_eatoorMoneyToggleRow}>
          <TouchableOpacity 
            style={styles.cartscreen_page_checkboxContainer}
            onPress={handleWalletToggle}
            disabled={isPaymentInProgress || balance <= 0}
          >
            <View style={[
              styles.cartscreen_page_checkbox,
              useWallet && styles.cartscreen_page_checkboxChecked,
              (balance <= 0 || isPaymentInProgress) && styles.cartscreen_page_checkboxDisabled
            ]}>
              {useWallet && <Icon name="checkmark" size={moderateScale(12)} color="#fff" />}
            </View>
            <View style={styles.cartscreen_page_checkboxLabelContainer}>
              <Text style={styles.cartscreen_page_checkboxLabel}>Use Eatoor Money</Text>
              <Text style={styles.cartscreen_page_balanceTextSmall}>Balance: ₹{balance.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.cartscreen_page_addMoneyButton}
            onPress={() => navigation.navigate('EatoorMoneyAdd', { prevScreen: 'CartScreen' })}
            disabled={isPaymentInProgress}
          >
            <Text style={styles.cartscreen_page_addMoneyButtonText}>Add Money</Text>
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
      <View style={styles.cartscreen_page_paymentMethodInlineContainer}>
        <TouchableOpacity 
          style={styles.cartscreen_page_paymentMethodDropdown}
          onPress={() => setShowPaymentSectionModal(true)}
          disabled={isPaymentInProgress}
          activeOpacity={0.7}
        >
          <View style={styles.cartscreen_page_paymentMethodContent}>
            <View style={styles.cartscreen_page_iconContainer}>
              <View style={styles.cartscreen_page_paymentIconContainer}>
                <Icon name={display.icon} size={moderateScale(22)} color="#E65C00" />
              </View>
            </View>

            <View style={styles.cartscreen_page_textContainer}>
              <View style={styles.cartscreen_page_topRow}>
                <Text style={styles.cartscreen_page_payUsingLabel}>PAY USING</Text>
                <Icon name="chevron-down" size={moderateScale(12)} color="#999" />
              </View>

              <View style={styles.cartscreen_page_paymentMethodRow}>
                <Text style={styles.cartscreen_page_paymentMethodName} numberOfLines={1}>
                  {display.title}
                </Text>
              </View>
              <Text style={styles.cartscreen_page_paymentMethodSubtitle} numberOfLines={1}>
                {display.subtitle}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.cartscreen_page_proceedButton,
            (isPaymentInProgress || paymentModalStatus === 'processing') && styles.cartscreen_page_proceedButtonDisabled,
            !isAddressSelected && styles.cartscreen_page_selectLocationButton
          ]}
          onPress={initiatePayment}
          disabled={paymentModalStatus === 'processing' || isPaymentInProgress}
          activeOpacity={0.8}
        >
          <View style={styles.cartscreen_page_proceedButtonContent}>
            {paymentModalStatus === 'processing' || isPaymentInProgress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cartscreen_page_proceedButtonText}>{buttonText}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.some(i => i.id === item.item_id);
    const itemPrice = safePrice(item.item_price);
    const originalPrice = safePrice(item.original_item_price);
    const discountPercent = safePrice(item.discount_percent);

    return (
      <View style={styles.cartscreen_page_cartItemCard}>
        <View style={styles.cartscreen_page_cartItemContent}>
          <View style={styles.cartscreen_page_itemTypeContainer}>
            <View style={[
              styles.cartscreen_page_itemTypeBadge,
              item.type === 'Veg' ? styles.cartscreen_page_vegBadge : styles.cartscreen_page_nonVegBadge
            ]}>
              <View style={[
                styles.cartscreen_page_itemTypeIndicator,
                item.type === 'Veg' ? styles.cartscreen_page_vegIndicator : styles.cartscreen_page_nonVegIndicator
              ]} />
            </View>
          </View>
          
          <View style={styles.cartscreen_page_itemDetails}>
            <Text style={styles.cartscreen_page_itemName} numberOfLines={2}>
              {safeText(item.item_name, 'Unnamed Item')}
            </Text>            
            {item.discount_active ? (
              <View style={styles.cartscreen_page_priceRow}>
                <Text style={styles.cartscreen_page_originalPrice}>₹{originalPrice.toFixed(2)}</Text>
                <View style={styles.cartscreen_page_discountBadge}>
                  <Text style={styles.cartscreen_page_discountText}>{discountPercent}% OFF</Text>
                </View>
              </View>
            ) : null}
            
            <Text style={styles.cartscreen_page_itemPrice}>₹{itemPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.cartscreen_page_quantityContainer}>
            <TouchableOpacity 
              style={[
                styles.cartscreen_page_quantityButton,
                (item.quantity <= 1 || isPaymentInProgress) && styles.cartscreen_page_disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="remove" size={moderateScale(14)} color={item.quantity <= 1 ? "#ccc" : "#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.cartscreen_page_quantityText}>{safeText(item.quantity, '0')}</Text>
            
            <TouchableOpacity 
              style={[
                styles.cartscreen_page_quantityButton,
                isPaymentInProgress && styles.cartscreen_page_disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="add" size={moderateScale(14)} color="#E65C00" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.cartscreen_page_emptyContainer}>
      <View style={styles.cartscreen_page_emptyHeader}>
        <TouchableOpacity onPress={BackToKitchen} style={styles.cartscreen_page_backButton}>
          <Icon name="arrow-back" size={moderateScale(24)} color="#333" />
        </TouchableOpacity>
        <Text style={styles.cartscreen_page_emptyHeaderTitle}>
          {safeText(cartData?.restaurant_name, 'Your Cart')}
        </Text>
        <View style={{ width: moderateScale(24) }} />
      </View>
      
      <View style={styles.cartscreen_page_emptyContent}>
        <View style={styles.cartscreen_page_emptyIllustration}>
          <Icon name="cart-outline" size={moderateScale(80)} color="#E8ECF4" />
          <View style={styles.cartscreen_page_emptyIconOverlay}>
            <Icon name="close" size={moderateScale(40)} color="#E65C00" />
          </View>
        </View>
        <Text style={styles.cartscreen_page_emptyTitle}>Your cart is empty</Text>
        <Text style={styles.cartscreen_page_emptyDescription}>
          Looks like you haven't added anything to your cart yet
        </Text>
        
        <TouchableOpacity style={styles.cartscreen_page_exploreButton} onPress={BackToKitchen}>
          <View style={styles.cartscreen_page_exploreButtonContent}>
            <Text style={styles.cartscreen_page_exploreButtonText}>Browse Menu</Text>
            <Icon name="arrow-forward" size={moderateScale(20)} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {cartData?.suggestion_cart_items && cartData?.suggestion_cart_items.length > 0 && (
        <View style={styles.cartscreen_page_emptySuggestionsContainer}>
          <Text style={styles.cartscreen_page_suggestionTitle}>
            Popular Items from {safeText(cartData?.restaurant_name, 'this restaurant')}
          </Text>
          <FlatList
            data={cartData?.suggestion_cart_items}
            renderItem={renderSuggestedItem}
            keyExtractor={item => safeText(item.item_id, '0')}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cartscreen_page_suggestedItemsHorizontalContainer}
          />
        </View>
      )}
    </View>
  );

  const renderCartContent = () => (
    <KeyboardAvoidingView 
      style={styles.cartscreen_page_scrollContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.cartscreen_page_scrollContentContainer}
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
        <View style={styles.cartscreen_page_sectionCard}>
          <View style={styles.cartscreen_page_sectionHeader}>
            <View style={styles.cartscreen_page_sectionTitleContainer}>
              <Icon name="restaurant-outline" size={moderateScale(20)} color="#E65C00" />
              <Text style={styles.cartscreen_page_sectionTitle}>Your Items</Text>
              {cartData?.cart_details?.length > 0 && (
                <View style={styles.cartscreen_page_itemCountBadge}>
                  <Text style={styles.cartscreen_page_itemCountText}>{getTotalItems()}</Text>
                </View>
              )}
            </View>

            {cartData?.cart_details?.length > 0 && (
              <TouchableOpacity 
                style={styles.cartscreen_page_clearCartButton}
                onPress={handleClearCart}
                disabled={isPaymentInProgress}
              >
                <Icon name="trash-outline" size={moderateScale(16)} color="#E65C00" />
                <Text style={styles.cartscreen_page_clearCartText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.cartscreen_page_cartItemsList}>
            <FlatList
              data={cartData?.cart_details}
              renderItem={renderCartItem}
              keyExtractor={item => safeText(item.id, '0')}
              scrollEnabled={false}
            />
          </View>
        </View>

        {cartData?.suggestion_cart_items && cartData?.suggestion_cart_items.length > 0 && (
          <View style={styles.cartscreen_page_sectionCard}>
            <View style={styles.cartscreen_page_sectionHeader}>
              <View style={styles.cartscreen_page_sectionTitleContainer}>
                <Icon name="add-circle-outline" size={moderateScale(20)} color="#E65C00" />
                <Text style={styles.cartscreen_page_sectionTitle}>Add More Items</Text>
              </View>
              <TouchableOpacity 
                style={styles.cartscreen_page_viewAllButton}
                onPress={BackToKitchen}
                disabled={isPaymentInProgress}
              >
                <Text style={styles.cartscreen_page_viewAllText}>View All</Text>
                <Icon name="chevron-forward" size={moderateScale(16)} color="#E65C00" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={cartData?.suggestion_cart_items}
              renderItem={renderSuggestedItem}
              keyExtractor={item => safeText(item.item_id, '0')}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cartscreen_page_suggestedItemsHorizontalContainer}
            />
          </View>
        )}

        <View style={styles.cartscreen_page_sectionCard}>
          <View style={styles.cartscreen_page_sectionHeader}>
            <View style={styles.cartscreen_page_sectionTitleContainer}>
              <Icon name="location-outline" size={moderateScale(20)} color="#E65C00" />
              <Text style={styles.cartscreen_page_sectionTitle}>Delivery Details</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.cartscreen_page_detailCard}
            onPress={handleAddressChange}
            activeOpacity={0.7}
          >
            <View style={styles.cartscreen_page_detailRow}>
              <View style={styles.cartscreen_page_detailIconContainer}>
                <Icon name="navigate-circle" size={moderateScale(24)} color="#E65C00" />
              </View>
              <View style={styles.cartscreen_page_addressContainer}>
                <Text style={styles.cartscreen_page_detailLabel}>Delivery Address</Text>
                <Text style={styles.cartscreen_page_detailText}>
                  {fullAddress !== "Select Address" ? fullAddress : "Please select a delivery address"}
                </Text>
              </View>
              <Icon name="chevron-forward" size={moderateScale(20)} color="#ccc" />
            </View>

            {cartData?.delivery_time?.estimated_time && (
              <View style={[styles.cartscreen_page_detailRow, { marginTop: verticalScale(8), paddingTop: verticalScale(8), borderTopWidth: 1, borderTopColor: '#f0f0f0' }]}>
                <View style={styles.cartscreen_page_detailIconContainer}>
                  <Icon name="time-outline" size={moderateScale(24)} color="#E65C00" />
                </View>
                <View style={styles.cartscreen_page_addressContainer}>
                  <Text style={styles.cartscreen_page_detailLabel}>Delivery Time</Text>
                  <Text style={styles.cartscreen_page_detailText}>
                    {safeText(cartData?.delivery_time?.estimated_time)}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.cartscreen_page_sectionCard}>
          <View style={styles.cartscreen_page_sectionHeader}>
            <View style={styles.cartscreen_page_sectionTitleContainer}>
              <Icon name="receipt-outline" size={moderateScale(20)} color="#E65C00" />
              <Text style={styles.cartscreen_page_sectionTitle}>Bill Details</Text>
            </View>
          </View>
          
          <View style={styles.cartscreen_page_billCard}>
            <View style={styles.cartscreen_page_billRow}>
              <Text style={styles.cartscreen_page_billLabel}>Item Total</Text>
              <Text style={styles.cartscreen_page_billValue}>
                ₹{safeFormatNumber(cartData?.billing_details?.subtotal, 2)}
              </Text>
            </View>

            <View style={styles.cartscreen_page_billRow}>
              <Text style={styles.cartscreen_page_billLabel}>Delivery Fee</Text>
              <View style={styles.cartscreen_page_billValueContainer}>
                {cartData?.delivery_offer_exist && (
                  <View style={styles.cartscreen_page_freeDeliveryBadge}>
                    <Text style={styles.cartscreen_page_freeDeliveryBadgeText}>FREE</Text>
                  </View>
                )}
                <Text style={[
                  styles.cartscreen_page_billValue,
                  cartData?.delivery_offer_exist && styles.cartscreen_page_freeDeliveryValue
                ]}>
                  {cartData?.delivery_offer_exist ? '₹0' : `₹${safeFormatNumber(cartData?.billing_details?.delivery_amount, 2)}`}
                </Text>
              </View>
            </View>

            <View style={styles.cartscreen_page_billRow}>
              <Text style={styles.cartscreen_page_billLabel}>Tax & Charges</Text>
              <Text style={styles.cartscreen_page_billValue}>
                ₹{safeFormatNumber(cartData?.billing_details?.tax, 2)}
              </Text>
            </View>

            {useWallet && walletBalance && walletBalance.balance > 0 && (
              <View style={styles.cartscreen_page_billRow}>
                <Text style={styles.cartscreen_page_billLabel}>Eatoor Money</Text>
                <Text style={[styles.cartscreen_page_billValue, styles.cartscreen_page_eatoorMoneyDeductionBill]}>
                  - ₹{calculateWalletUsage().toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.cartscreen_page_totalRow}>
              <Text style={styles.cartscreen_page_totalLabel}>
                {useWallet && calculateFinalAmount() > 0 ? 'Amount to Pay' : 'Total Bill'}
              </Text>
              <Text style={styles.cartscreen_page_totalValue}>
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
      <View style={styles.cartscreen_page_paymentFooter}>
        {!isGuest && renderEatoorMoneySection()}
        {renderPaymentMethodSelector()}
      </View>
    );
  };
  
  if (loading && !cartData) {
    return (
      <SafeAreaView style={styles.cartscreen_page_container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.cartscreen_page_loadingContainer}>
          <ActivityIndicator size="large" color="#E65C00" />
          <Text style={styles.cartscreen_page_loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.cartscreen_page_container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.cartscreen_page_errorContainer}>
          <View style={styles.cartscreen_page_errorContent}>
            <Icon name="warning-outline" size={moderateScale(48)} color="#E65C00" />
            <Text style={styles.cartscreen_page_errorText}>{safeText(error)}</Text>
            <TouchableOpacity style={styles.cartscreen_page_primaryButton} onPress={fetchCartData}>
              <Text style={styles.cartscreen_page_primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cartscreen_page_secondaryButton} onPress={BackToKitchen}>
              <Text style={styles.cartscreen_page_secondaryButtonText}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isCartEmpty = !cartData?.cart_details || cartData?.cart_details.length === 0;
  
  return (
    <SafeAreaView style={styles.cartscreen_page_container}>
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
          <View style={styles.cartscreen_page_header}>
            <TouchableOpacity 
              onPress={BackToKitchen}
              style={styles.cartscreen_page_backButton}
              disabled={isPaymentInProgress}
            >
              <Icon name="arrow-back" size={moderateScale(24)} color="#333" />
            </TouchableOpacity>
            <View style={styles.cartscreen_page_headerContent}>
              <Text style={styles.cartscreen_page_restaurantName} numberOfLines={1}>
                {safeText(cartData?.restaurant_name, 'Restaurant')}
              </Text>
              <TouchableOpacity 
                onPress={handleAddressChange}
                style={styles.cartscreen_page_headerAddressContainer}
                disabled={isPaymentInProgress}
              >
                <Icon name="location-outline" size={moderateScale(14)} color="#E65C00" />
                <Text style={styles.cartscreen_page_headerAddressText} numberOfLines={1}>
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
  cartscreen_page_container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  cartscreen_page_loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  cartscreen_page_loadingText: {
    marginTop: verticalScale(16),
    fontSize: FONT.LG,
    color: '#666',
    fontWeight: '500',
  },
  cartscreen_page_scrollContainer: {
    flex: 1,
  },
  cartscreen_page_scrollContentContainer: {
    paddingBottom: verticalScale(140),
    paddingHorizontal: scale(16),
  },
  cartscreen_page_header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(16),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: Platform.OS === 'ios' ? verticalScale(70) : verticalScale(64),
  },
  cartscreen_page_backButton: {
    padding: moderateScale(8),
    marginRight: moderateScale(12),
    borderRadius: moderateScale(24),
    backgroundColor: '#f8f8f8',
  },
  cartscreen_page_headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cartscreen_page_restaurantName: {
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(4),
  },
  cartscreen_page_headerAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_headerAddressText: {
    fontSize: FONT.SM,
    fontWeight: '500',
    color: '#666',
    marginLeft: scale(4),
    marginRight: scale(4),
    flex: 1,
  },
  cartscreen_page_paymentMethodInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cartscreen_page_paymentMethodDropdown: {
    flex: 1,
    marginRight: scale(12),
  },
  cartscreen_page_paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_iconContainer: {
    marginRight: moderateScale(12),
  },
  cartscreen_page_paymentIconContainer: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartscreen_page_textContainer: {
    flex: 1,
  },
  cartscreen_page_topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  cartscreen_page_payUsingLabel: {
    fontSize: FONT.XS,
    color: '#999',
    fontWeight: '600',
    marginRight: scale(6),
    letterSpacing: 0.5,
  },
  cartscreen_page_paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(2),
  },
  cartscreen_page_paymentMethodName: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cartscreen_page_paymentMethodSubtitle: {
    fontSize: FONT.XS,
    color: '#999',
  },
  cartscreen_page_proceedButton: {
    backgroundColor: '#E65C00',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    minWidth: moderateScale(110),
  },
  cartscreen_page_proceedButtonContent: {
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartscreen_page_selectLocationButton: {
    opacity: 0.9,
  },
  cartscreen_page_proceedButtonDisabled: {
    opacity: 0.7,
  },
  cartscreen_page_proceedButtonText: {
    color: '#fff',
    fontSize: FONT.BASE,
    fontWeight: '700',
  },
  cartscreen_page_eatoorMoneyContainer: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    backgroundColor: '#FFF8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cartscreen_page_eatoorMoneyToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartscreen_page_checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cartscreen_page_checkbox: {
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
  cartscreen_page_checkboxChecked: {
    backgroundColor: '#E65C00',
    borderColor: '#E65C00',
  },
  cartscreen_page_checkboxDisabled: {
    opacity: 0.5,
  },
  cartscreen_page_checkboxLabelContainer: {
    flex: 1,
  },
  cartscreen_page_checkboxLabel: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cartscreen_page_balanceTextSmall: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
    marginTop: verticalScale(2),
  },
  cartscreen_page_addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(8),
    backgroundColor: '#fff',
    borderRadius: moderateScale(8),
    borderWidth: 1.5,
    borderColor: '#E65C00',
  },
  cartscreen_page_addMoneyButtonText: {
    color: '#E65C00',
    fontSize: FONT.SM,
    fontWeight: '600',
    marginRight: scale(6),
  },
  cartscreen_page_sectionCard: {
    backgroundColor: '#fff',
    top:10,
    borderRadius: moderateScale(16),
    padding: moderateScale(16),
    marginBottom: verticalScale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cartscreen_page_sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  cartscreen_page_sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_sectionTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: moderateScale(8),
  },
  cartscreen_page_itemCountBadge: {
    backgroundColor: '#E65C00',
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: moderateScale(12),
    marginLeft: moderateScale(8),
    minWidth: moderateScale(24),
    alignItems: 'center',
  },
  cartscreen_page_itemCountText: {
    fontSize: FONT.XS,
    color: '#fff',
    fontWeight: '700',
  },
  cartscreen_page_clearCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(6),
    backgroundColor: '#FFF0E6',
    borderRadius: moderateScale(8),
  },
  cartscreen_page_clearCartText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
    marginLeft: moderateScale(4),
  },
  cartscreen_page_viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_viewAllText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '600',
  },
  cartscreen_page_cartItemCard: {
    borderRadius: moderateScale(12),
    marginBottom: verticalScale(8),
    padding: moderateScale(12),
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cartscreen_page_cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_itemTypeContainer: {
    marginRight: moderateScale(12),
  },
  cartscreen_page_itemTypeBadge: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: moderateScale(4),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartscreen_page_vegBadge: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  cartscreen_page_nonVegBadge: {
    borderColor: '#E65C00',
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
  },
  cartscreen_page_itemTypeIndicator: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: moderateScale(5),
  },
  cartscreen_page_vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  cartscreen_page_nonVegIndicator: {
    backgroundColor: '#E65C00',
  },
  cartscreen_page_itemDetails: {
    flex: 1,
    marginRight: moderateScale(12),
  },
  cartscreen_page_itemName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(4),
    lineHeight: verticalScale(18),
  },
  cartscreen_page_priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(4),
  },
  cartscreen_page_originalPrice: {
    fontSize: FONT.SM,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: moderateScale(8),
  },
  cartscreen_page_discountBadge: {
    backgroundColor: '#FFF0E6',
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(4),
  },
  cartscreen_page_discountText: {
    fontSize: FONT.XS,
    color: '#E65C00',
    fontWeight: '700',
  },
  cartscreen_page_itemPrice: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#E65C00',
  },
  cartscreen_page_quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderRadius: moderateScale(20),
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(4),
  },
  cartscreen_page_quantityButton: {
    padding: moderateScale(4),
    borderRadius: moderateScale(12),
    backgroundColor: '#fff',
    width: moderateScale(28),
    height: moderateScale(28),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  cartscreen_page_quantityText: {
    fontSize: FONT.BASE,
    fontWeight: '700',
    color: '#E65C00',
    marginHorizontal: moderateScale(8),
    minWidth: moderateScale(24),
    textAlign: 'center',
  },
  cartscreen_page_detailCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
  },
  cartscreen_page_detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_detailIconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  cartscreen_page_addressContainer: {
    flex: 1,
  },
  cartscreen_page_detailLabel: {
    fontSize: FONT.SM,
    color: '#999',
    fontWeight: '500',
    marginBottom: verticalScale(4),
  },
  cartscreen_page_detailText: {
    fontSize: FONT.SM,
    color: '#1a1a1a',
    lineHeight: verticalScale(18),
    fontWeight: '500',
  },
  cartscreen_page_billCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
  },
  cartscreen_page_billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(12),
    paddingBottom: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  cartscreen_page_billLabel: {
    fontSize: FONT.SM,
    color: '#666',
    fontWeight: '500',
  },
  cartscreen_page_billValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_billValue: {
    fontSize: FONT.SM,
    color: '#333',
    fontWeight: '600',
  },
  cartscreen_page_freeDeliveryBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(8),
  },
  cartscreen_page_freeDeliveryBadgeText: {
    fontSize: FONT.XS,
    color: '#4CAF50',
    fontWeight: '700',
  },
  cartscreen_page_eatoorMoneyDeductionBill: {
    color: '#E65C00',
    fontWeight: '700',
  },
  cartscreen_page_freeDeliveryValue: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  cartscreen_page_totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(8),
    paddingTop: verticalScale(12),
    borderTopColor: '#E8ECF4',
  },
  cartscreen_page_totalLabel: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cartscreen_page_totalValue: {
    fontSize: FONT.XL,
    fontWeight: '800',
    color: '#E65C00',
  },
  cartscreen_page_cartItemsList: {
    marginTop: verticalScale(4),
  },
  cartscreen_page_emptyContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  cartscreen_page_emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: moderateScale(16),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingTop: Platform.OS === 'ios' ? verticalScale(12) : verticalScale(20),
  },
  cartscreen_page_emptyHeaderTitle: {
    fontSize: FONT.XL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cartscreen_page_emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  cartscreen_page_emptyIllustration: {
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: moderateScale(60),
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(24),
    position: 'relative',
  },
  cartscreen_page_emptyIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartscreen_page_emptyTitle: {
    fontSize: FONT.XXL,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: verticalScale(8),
    textAlign: 'center',
  },
  cartscreen_page_emptyDescription: {
    fontSize: FONT.SM,
    color: '#666',
    textAlign: 'center',
    marginBottom: verticalScale(24),
    lineHeight: verticalScale(20),
    paddingHorizontal: scale(32),
  },
  cartscreen_page_exploreButton: {
    backgroundColor: '#E65C00',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
  },
  cartscreen_page_exploreButtonContent: {
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(14),
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartscreen_page_exploreButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
    marginRight: moderateScale(8),
  },
  cartscreen_page_emptySuggestionsContainer: {
    marginBottom: verticalScale(16),
  },
  cartscreen_page_suggestionTitle: {
    fontSize: FONT.LG,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: verticalScale(8),
    marginBottom: verticalScale(12),
    paddingHorizontal: scale(16),
  },
  cartscreen_page_suggestedItemsHorizontalContainer: {
    paddingHorizontal: scale(12),
    paddingBottom: verticalScale(8),
  },
  cartscreen_page_suggestedItemCard: {
    width: scale(140),
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    overflow: 'hidden',
    marginHorizontal: scale(6),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cartscreen_page_suggestedItemImageContainer: {
    position: 'relative',
  },
  cartscreen_page_suggestedItemImage: {
    width: '100%',
    height: verticalScale(100),
    backgroundColor: '#F8F9FA',
  },
  cartscreen_page_suggestedItemTypeBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    width: moderateScale(16),
    height: moderateScale(16),
    borderRadius: moderateScale(4),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cartscreen_page_suggestedItemTypeIndicator: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
  },
  cartscreen_page_suggestedItemContent: {
    padding: scale(10),
  },
  cartscreen_page_suggestedItemName: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(6),
    lineHeight: verticalScale(16),
    minHeight: verticalScale(32),
  },
  cartscreen_page_suggestedItemDetails: {
    marginBottom: verticalScale(8),
  },
  cartscreen_page_suggestedItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartscreen_page_addItemButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
    borderRadius: moderateScale(8),
    minWidth: scale(55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartscreen_page_addItemButtonDisabled: {
    opacity: 0.7,
  },
  cartscreen_page_addItemButtonText: {
    color: '#fff',
    fontSize: FONT.SM,
    fontWeight: '700',
  },
  cartscreen_page_disabledButton: {
    opacity: 0.5,
  },
  cartscreen_page_errorContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  cartscreen_page_errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  cartscreen_page_errorText: {
    fontSize: FONT.LG,
    color: '#E65C00',
    marginBottom: verticalScale(20),
    textAlign: 'center',
    fontWeight: '600',
  },
  cartscreen_page_primaryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    width: '80%',
    alignItems: 'center',
    marginBottom: verticalScale(12),
  },
  cartscreen_page_primaryButtonText: {
    color: '#fff',
    fontSize: FONT.LG,
    fontWeight: '700',
  },
  cartscreen_page_secondaryButton: {
    paddingHorizontal: moderateScale(32),
    paddingVertical: verticalScale(12),
    borderRadius: moderateScale(12),
    width: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E65C00',
    backgroundColor: '#fff',
  },
  cartscreen_page_secondaryButtonText: {
    color: '#E65C00',
    fontSize: FONT.LG,
    fontWeight: '600',
  },
  cartscreen_page_paymentFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
});

export default CartScreen;