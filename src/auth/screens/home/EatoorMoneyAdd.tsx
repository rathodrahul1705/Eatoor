import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  findNodeHandle,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import payment components and services
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
import { PaymentMethodModal } from './utils/PaymentMethodModal';

const { width, height } = Dimensions.get('window');

// Constants
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

const PAYMENT_PAGE = "eatoor_money";

const EatoorMoneyAdd = () => {
  const navigation = useNavigation();
  const route = useRoute();

  // Amount states
  const [amount, setAmount] = useState('');
  const [selectedDefaultAmount, setSelectedDefaultAmount] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // User state
  const [user, setUser] = useState({
    name: '',
    email: '',
    contact: '',
    id: '',
    wallet_balance: '0',
  });

  // Refs
  const amountInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const amountContainerRef = useRef(null);
  const paymentInProgressRef = useRef(false);
  const pollingControlRef = useRef(null);

  // Payment method states
  const [paymentMethods, setPaymentMethods] = useState(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState(null);
  const [selectedSavedUPI, setSelectedSavedUPI] = useState(null);
  const [selectedWalletApp, setSelectedWalletApp] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedCardType, setSelectedCardType] = useState(null);
  const [showPaymentSectionModal, setShowPaymentSectionModal] = useState(false);
  const [installedUpiApps, setInstalledUpiApps] = useState([]);
  const [allUpiApps, setAllUpiApps] = useState([]);
  const [customUpiId, setCustomUpiId] = useState('');
  const [savedUpiIds, setSavedUpiIds] = useState([]);
  const [checkingApps, setCheckingApps] = useState(true);
  const [isSavingUpi, setIsSavingUpi] = useState(false);
  const [selectedUpiVpa, setSelectedUpiVpa] = useState('');
  const [selectedUpiPaymentMethodType, setSelectedUpiPaymentMethodType] = useState('');

  // Payment tracking states
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState(null);
  const [currentOrderRef, setCurrentOrderRef] = useState(null);
  const [currentPaymentData, setCurrentPaymentData] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentModalStatus, setPaymentModalStatus] = useState('idle');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [createdOrderTotal, setCreatedOrderTotal] = useState('');

  const cartScreenBalance = route?.params?.amountToAdd;
  const defaultAmounts = [100, 200, 300, 500, 1000, 2000];
  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 100000;

  // Keyboard handling
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setKeyboardVisible(true);
        setTimeout(() => scrollToInput(), 100);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setKeyboardVisible(false);
      }
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollToInput = () => {
    if (scrollViewRef.current && amountInputRef.current) {
      amountInputRef.current.measure((x, y, width, height, pageX, pageY) => {
        scrollViewRef.current.scrollTo({ y: pageY - 100, animated: true });
      });
    }
  };

  // Load user data
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser({
          name: parsedUser.full_name || parsedUser.name || 'Eatoor User',
          email: parsedUser.email || 'user@example.com',
          contact: parsedUser.contact_number || parsedUser.phone || parsedUser.mobile || '9999999999',
          id: parsedUser.id || parsedUser.user_id || '',
          wallet_balance: parsedUser.wallet_balance || '0',
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Load payment methods when user is available
  const loadPaymentMethods = useCallback(async () => {
    if (!user.id) return;
    setCheckingApps(true);
    try {
      const response = await getAllPaymentMethods(user.id, PAYMENT_PAGE);
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
    } finally {
      setCheckingApps(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (user.id) {
      loadPaymentMethods();
    }
  }, [user.id, loadPaymentMethods]);

  // Amount handling
  useEffect(() => {
    if (cartScreenBalance) {
      setAmount(String(cartScreenBalance));
    }
  }, [cartScreenBalance]);

  const handleDefaultAmountSelect = (value) => {
    setAmount(value.toString());
    setSelectedDefaultAmount(value);
    setPaymentError(null);
    setPaymentSuccess(false);
    if (amountInputRef.current) {
      amountInputRef.current.focus();
    }
  };

  const handleAmountChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
    setPaymentError(null);
    setPaymentSuccess(false);
    const parsedAmount = parseInt(numericValue) || 0;
    const matchedDefault = defaultAmounts.find(item => item === parsedAmount);
    setSelectedDefaultAmount(matchedDefault || null);
  };

  const validateAmount = (amountStr) => {
    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount)) {
      return { isValid: false, message: 'Please enter a valid amount' };
    }
    if (numAmount < MIN_AMOUNT) {
      return { isValid: false, message: `Minimum amount is ₹${MIN_AMOUNT}` };
    }
    if (numAmount > MAX_AMOUNT) {
      return { isValid: false, message: `Maximum amount is ₹${MAX_AMOUNT.toLocaleString()}` };
    }
    return { isValid: true, amount: numAmount };
  };

  const isAmountValid = () => {
    if (!amount) return false;
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= MIN_AMOUNT && numAmount <= MAX_AMOUNT;
  };

  // Payment Method Helpers
  const getPaymentMethodId = (): number => {
    switch (selectedPaymentType) {
      case 'upi':
      case 'saved_upi':
        return PAYMENT_METHODS.UPI;
      case 'wallet':
        return PAYMENT_METHODS.EATOOR_MONEY;
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

  const selectPaymentMethod = (type, data, vpa, paymentMethodType) => {
    setSelectedPaymentType(type);
    setSelectedUpiApp(null);
    setSelectedSavedUPI(null);
    setSelectedWalletApp(null);
    setSelectedBank(null);
    setSelectedCardType(null);
    setSelectedUpiVpa('');
    setSelectedUpiPaymentMethodType('');

    if (type === 'upi' && data) {
      setSelectedUpiApp(data);
      setSelectedUpiVpa(vpa || data.customUPIID || data.vpa || data.id);
      setSelectedUpiPaymentMethodType(paymentMethodType || (data.customUPIID ? 'VPA' : 'APP'));
    }
    if (type === 'saved_upi' && data) {
      setSelectedSavedUPI(data);
      setSelectedUpiVpa(data.raw_vpa || data.vpa);
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

  // Payment Initiation Flows
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

  // Generic wallet top-up (for netbanking / cards / any non-UPI)
  const initiateWalletTopUpGeneric = async (amountValue, paymentType) => {
    if (paymentInProgressRef.current) return;
    const validation = validateAmount(String(amountValue));
    if (!validation.isValid) {
      Alert.alert('Invalid Amount', validation.message);
      return;
    }

    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentAmount(amountValue);
    setPaymentModalStatus('processing');
    setPaymentModalVisible(true);

    try {
      const customerDetails = await getCustomerDetails();
      const upiVpa = getUpiVpaForPayment();
      const paymentMethodId = getPaymentMethodId();

      const orderData = {
        user_id: user.id,
        amount: amountValue,
        productinfo: 'Add Eatoor Money',
        firstname: customerDetails?.full_name || user.name || 'Eatoor User',
        email: customerDetails?.email || user.email || 'user@example.com',
        phone: customerDetails?.contact_number || user.contact || '9999999999',
        payment_method: paymentMethodId,
        payment_type: PAYMENT_TYPES.ONLINE,
        payment_status: PAYMENT_STATUS.IN_PROGRESS,
        payment_gateway: paymentType?.toUpperCase() || 'UPI',
        upi_id: upiVpa,
        vpa: upiVpa,
        payment_method_type: getPaymentMethodType(),
        bank_code: selectedBank?.code,
        card_type: selectedCardType,
        payment_page: PAYMENT_PAGE
      };

      console.log('Generic payment orderData:', orderData);

      const paymentInit = await initiateBackendPayment(orderData);
      setCurrentPaymentData(paymentInit);
      setCurrentTransactionId(paymentInit.txnid);
      setCurrentOrderRef(paymentInit.txnid);
      setCreatedOrderId(paymentInit.order_id);
      setCreatedOrderNumber(paymentInit.order_number);
      setCreatedOrderTotal(paymentInit.order_total);

      setPaymentModalStatus('pending');

      // Start polling
      pollingControlRef.current = startPaymentPolling(
        paymentInit.txnid,
        paymentMethodId,
        PAYMENT_PAGE,
        (statusUpdate) => setPollingAttempts(statusUpdate.attempts),
        async (result) => {
          pollingControlRef.current = null;
          if (result.success) {
            // Update local wallet balance directly
            await updateLocalWalletBalance(amountValue);
            setPaymentModalStatus('success');
            setSuccessMessage(`₹${amountValue.toFixed(2)} has been added to your wallet`);
            setPaymentSuccess(true);
            // Remove the navigation.goBack() here since PaymentModal handles it
          } else {
            setPaymentError(result.error || 'Payment verification failed');
            setPaymentModalStatus('failed');
          }
          paymentInProgressRef.current = false;
          setIsPaymentInProgress(false);
        },
        { interval: 5000, maxAttempts: 10, timeout: 120000 }
      );
    } catch (error) {
      console.error('Generic payment error:', error);
      setPaymentError(error.message || 'Payment initiation failed');
      setPaymentModalStatus('failed');
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
    }
  };

  // UPI wallet top-up
  const initiateWalletTopUpUPI = async (amountValue) => {
    if (paymentInProgressRef.current) return;
    const validation = validateAmount(String(amountValue));
    if (!validation.isValid) {
      Alert.alert('Invalid Amount', validation.message);
      return;
    }

    paymentInProgressRef.current = true;
    setIsPaymentInProgress(true);
    setPaymentAmount(amountValue);
    setPaymentModalStatus('processing');
    setPaymentModalVisible(true);

    try {
      const customerDetails = await getCustomerDetails();
      const upiVpa = getUpiVpaForPayment();

      const orderData = {
        user_id: user.id,
        amount: amountValue,
        productinfo: 'Add Eatoor Money',
        firstname: customerDetails?.full_name || user.name || 'Eatoor User',
        email: customerDetails?.email || user.email || 'user@example.com',
        phone: customerDetails?.contact_number || user.contact || '9999999999',
        payment_method: PAYMENT_METHODS.UPI,
        payment_type: PAYMENT_TYPES.ONLINE,
        payment_status: PAYMENT_STATUS.IN_PROGRESS,
        payment_gateway: 'UPI',
        upi_id: upiVpa,
        vpa: upiVpa,
        payment_method_type: getPaymentMethodType(),
        payment_page: PAYMENT_PAGE
      };

      console.log('UPI payment orderData:', orderData);

      const paymentInit = await initiateBackendPayment(orderData);
      setCurrentPaymentData(paymentInit);
      setCurrentTransactionId(paymentInit.txnid);
      setCurrentOrderRef(paymentInit.txnid);
      setCreatedOrderId(paymentInit.order_id);
      setCreatedOrderNumber(paymentInit.order_number);
      setCreatedOrderTotal(paymentInit.order_total);

      // If UPI app is selected, open the app
      if (getPaymentMethodType() === 'APP' && selectedUpiApp && !selectedSavedUPI) {
        const upiResult = await processUPIPayment(paymentInit, selectedUpiApp.id);
        if (!upiResult.success) {
          throw new Error(upiResult.error || 'Failed to open UPI app');
        }
      }

      setPaymentModalStatus('pending');

      // Start polling
      pollingControlRef.current = startPaymentPolling(
        paymentInit.txnid,
        PAYMENT_METHODS.UPI,
        PAYMENT_PAGE,
        (statusUpdate) => setPollingAttempts(statusUpdate.attempts),
        async (result) => {
          pollingControlRef.current = null;
          if (result.success) {
            // Update local wallet balance directly
            await updateLocalWalletBalance(amountValue);
            setPaymentModalStatus('success');
            setSuccessMessage(`₹${amountValue.toFixed(2)} has been added to your wallet`);
            setPaymentSuccess(true);
            // Remove the navigation.goBack() here since PaymentModal handles it
          } else {
            setPaymentError(result.error || 'Payment verification failed');
            setPaymentModalStatus('failed');
          }
          paymentInProgressRef.current = false;
          setIsPaymentInProgress(false);
        },
        { interval: 5000, maxAttempts: 10, timeout: 120000 }
      );
    } catch (error) {
      console.error('UPI payment error:', error);
      setPaymentError(error.message || 'Payment initiation failed');
      setPaymentModalStatus('failed');
      paymentInProgressRef.current = false;
      setIsPaymentInProgress(false);
    }
  };

  // Update local wallet balance
  const updateLocalWalletBalance = async (amountAdded) => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        const currentBalance = parseFloat(parsedUser.wallet_balance || 0);
        const newBalance = currentBalance + amountAdded;
        parsedUser.wallet_balance = newBalance.toString();
        await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
        
        setUser(prev => ({
          ...prev,
          wallet_balance: newBalance.toString()
        }));
      }
    } catch (error) {
      console.error('Error updating local wallet:', error);
    }
  };

  // Main initiatePayment
  const initiatePayment = async () => {
    Keyboard.dismiss();
    const validation = validateAmount(amount);
    if (!validation.isValid) {
      Alert.alert('Invalid Amount', validation.message);
      return;
    }

    if (!selectedPaymentType) {
      setShowPaymentSectionModal(true);
      return;
    }

    if (selectedPaymentType === 'wallet') {
      Alert.alert('Info', 'You cannot pay with wallet to add money.');
      return;
    }

    switch (selectedPaymentType) {
      case 'upi':
      case 'saved_upi':
        if (selectedUpiApp || selectedSavedUPI || customUpiId) {
          await initiateWalletTopUpUPI(validation.amount);
        } else {
          setShowPaymentSectionModal(true);
        }
        break;
      case 'netbanking':
      case 'cards':
        await initiateWalletTopUpGeneric(validation.amount, selectedPaymentType);
        break;
      default:
        setShowPaymentSectionModal(true);
    }
  };

  // Render Helpers
  const renderPaymentSelector = () => {
    if (paymentSuccess) return null;

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
            subtitle: `Balance: ₹${parseFloat(user?.wallet_balance || 0).toFixed(2)}`,
            icon: 'wallet-outline'
          };
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
      <View style={styles.paymentRow}>
        <TouchableOpacity
          style={styles.paymentDropdown}
          onPress={() => setShowPaymentSectionModal(true)}
          disabled={isPaymentInProgress}
          activeOpacity={0.7}
        >
          <View style={styles.paymentContent}>
            <View style={styles.paymentIconWrap}>
              <Icon name={display.icon} size={22} color="#FF6B35" />
            </View>
            <View style={styles.paymentTextWrap}>
              <View style={styles.paymentTopRow}>
                <Text style={styles.payUsingLabel}>PAY USING</Text>
                <Icon name="chevron-down" size={12} color="#999" />
              </View>
              <Text style={styles.paymentMethodName} numberOfLines={1}>
                {display.title}
              </Text>
              <Text style={styles.paymentMethodSubtitle} numberOfLines={1}>
                {display.subtitle}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.proceedBtn,
            (!isAmountValid() || isPaymentInProgress || paymentModalStatus === 'processing') && styles.proceedBtnDisabled,
          ]}
          onPress={initiatePayment}
          disabled={!isAmountValid() || isPaymentInProgress || paymentModalStatus === 'processing'}
          activeOpacity={0.8}
        >
          <View style={styles.proceedBtnContent}>
            {paymentModalStatus === 'processing' || isPaymentInProgress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.proceedBtnText}>
                Pay ₹{parseFloat(amount || 0).toFixed(0)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Render
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              disabled={processingPayment}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Money</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.content}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentWithKeyboard,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Payment Success Message */}
            {paymentSuccess && (
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <Icon name="checkmark-circle" size={24} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>Payment Successful! 🎉</Text>
                <Text style={styles.successMessage}>{successMessage}</Text>
                <View style={styles.successProgressContainer}>
                  <View style={styles.successProgressBar}>
                    <View style={[styles.successProgressFill, { width: '100%' }]} />
                  </View>
                  <Text style={styles.successRedirectText}>Redirecting...</Text>
                </View>
              </View>
            )}

            {!paymentSuccess && (
              <>
                <View style={styles.amountSection}>
                  <Text style={styles.sectionLabel}>Enter Amount</Text>
                  <View ref={amountContainerRef} style={styles.amountInputContainer} collapsable={false}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      ref={amountInputRef}
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={handleAmountChange}
                      placeholder="0"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      maxLength={6}
                      editable={!processingPayment}
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  </View>
                  {amount && parseFloat(amount) < MIN_AMOUNT ? (
                    <View style={styles.amountError}>
                      <Icon name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.amountErrorText}>Minimum amount: ₹{MIN_AMOUNT}</Text>
                    </View>
                  ) : amount && parseFloat(amount) > MAX_AMOUNT ? (
                    <View style={styles.amountError}>
                      <Icon name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.amountErrorText}>Maximum amount: ₹{MAX_AMOUNT.toLocaleString()}</Text>
                    </View>
                  ) : (
                    <Text style={styles.amountHint}>Enter ₹{MIN_AMOUNT} - ₹{MAX_AMOUNT.toLocaleString()}</Text>
                  )}
                  {paymentError && (
                    <View style={styles.paymentErrorContainer}>
                      <Icon name="warning" size={16} color="#EF4444" />
                      <Text style={styles.paymentErrorText}>{paymentError}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.quickAmountSection}>
                  <Text style={styles.sectionLabel}>Quick Add</Text>
                  <View style={styles.defaultAmountsContainer}>
                    {defaultAmounts.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.defaultAmountButton,
                          selectedDefaultAmount === item && styles.selectedDefaultAmountButton,
                          processingPayment && styles.buttonDisabled,
                        ]}
                        onPress={() => handleDefaultAmountSelect(item)}
                        activeOpacity={0.7}
                        disabled={processingPayment}
                      >
                        <Text
                          style={[
                            styles.defaultAmountText,
                            selectedDefaultAmount === item && styles.selectedDefaultAmountText,
                          ]}
                        >
                          ₹{item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.securityInfo}>
                  <Icon name="shield-checkmark" size={16} color="#10B981" />
                  <Text style={styles.securityText}>Secure Payment • 100% Safe</Text>
                </View>
              </>
            )}

            <View style={{ height: keyboardVisible ? 80 : 120, minHeight: keyboardVisible ? 80 : 120 }} />
          </ScrollView>

          {/* Payment Selector + Proceed Button */}
          {!paymentSuccess && renderPaymentSelector()}
        </KeyboardAvoidingView>

        <PaymentModal
          visible={paymentModalVisible}
          status={paymentModalStatus}
          amount={paymentAmount}
          transactionId={currentTransactionId}
          errorMessage={paymentError}
          pollingAttempts={pollingAttempts}
          maxPollingAttempts={10}
          paymentPage={PAYMENT_PAGE}
          onRetry={() => {
            setPaymentModalVisible(false);
            resetPaymentState();
            setTimeout(() => initiatePayment(), 500);
          }}
          onCancel={() => {
            setPaymentModalVisible(false);
            resetPaymentState();
          }}
          onViewOrder={() => {}}
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
          walletBalance={parseFloat(user?.wallet_balance || 0)}
          userId={user.id}
          isSavingUpi={isSavingUpi}
          refreshPaymentMethods={loadPaymentMethods}
        />
        
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  scrollContentWithKeyboard: {
    paddingBottom: 100,
  },
  successContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  successIconContainer: {
    backgroundColor: '#D1FAE5',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  successProgressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  successProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  successProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  successRedirectText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  amountSection: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    height: 70,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '700',
    color: '#333',
    paddingVertical: 10,
    minHeight: 50,
  },
  amountError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
    gap: 8,
  },
  amountErrorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  amountHint: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
    marginBottom: 16,
  },
  paymentErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  paymentErrorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
  },
  quickAmountSection: {
    marginBottom: 24,
  },
  defaultAmountsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  defaultAmountButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    margin: 6,
    minWidth: width * 0.27,
    alignItems: 'center',
  },
  selectedDefaultAmountButton: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  defaultAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedDefaultAmountText: {
    color: '#FFFFFF',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  securityText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  paymentDropdown: {
    flex: 1,
    marginRight: 12,
  },
  paymentContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconWrap: {
    marginRight: 12,
  },
  paymentTextWrap: {
    flex: 1,
  },
  paymentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  payUsingLabel: {
    fontSize: 10,
    color: '#999',
    fontWeight: '600',
    marginRight: 6,
    letterSpacing: 0.5,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  paymentMethodSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  proceedBtn: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 110,
  },
  proceedBtnContent: {
    paddingVertical: Platform.OS === 'android' ? 10 : 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedBtnDisabled: {
    opacity: 0.7,
  },
  proceedBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default EatoorMoneyAdd;
