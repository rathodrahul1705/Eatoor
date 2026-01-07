import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RazorpayCheckout from 'react-native-razorpay';
import {
  createWalletOrder,
  walletAddMoneySuccess
} from '../../../api/wallet';

const { width, height } = Dimensions.get('window');

const EatoorMoneyAdd = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [amount, setAmount] = useState('');
  const [selectedDefaultAmount, setSelectedDefaultAmount] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [user, setUser] = useState({
    name: '',
    email: '',
    contact: '',
    id: '',
  });
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const amountInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  const cartScreenBalance = route?.params?.amountToAdd;

  useEffect(() => {
    if (cartScreenBalance) {
      setAmount(String(cartScreenBalance));
    }
  }, [cartScreenBalance]);

  const defaultAmounts = [100, 200, 300, 500, 1000, 2000];
  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 100000;

  // Handle keyboard
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setKeyboardVisible(true);
        
        // Scroll to input when keyboard appears
        setTimeout(() => {
          if (scrollViewRef.current && amountInputRef.current) {
            amountInputRef.current.measureLayout(
              scrollViewRef.current.getInnerViewNode(),
              (x, y, width, height) => {
                scrollViewRef.current.scrollTo({
                  y: y - 100,
                  animated: true
                });
              }
            );
          }
        }, 100);
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

  // Fetch user data on component mount
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
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleDefaultAmountSelect = (value) => {
    setAmount(value.toString());
    setSelectedDefaultAmount(value);
    setPaymentError(null);
    setPaymentSuccess(false);
    
    // Focus on input after selecting quick amount
    if (amountInputRef.current) {
      amountInputRef.current.focus();
    }
  };

  const handleAmountChange = (text) => {
    // Allow only numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    setAmount(numericValue);
    setPaymentError(null);
    setPaymentSuccess(false);
    
    // Check if the amount matches any default amount
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

  const handlePayNow = async () => {
    // Dismiss keyboard
    Keyboard.dismiss();
    
    const validation = validateAmount(amount);
    if (!validation.isValid) {
      Alert.alert('Invalid Amount', validation.message);
      return;
    }

    try {
      setProcessingPayment(true);
      setPaymentError(null);
      setPaymentSuccess(false);

      console.log('Creating payment order...');
      const orderResponse = await createWalletOrder({ 
        amount: validation.amount,
        user_id: user.id,
        user_email: user.email,
        user_name: user.name,
      });

      const orderData = orderResponse.data;

      if (!orderData?.order_id) {
        throw new Error('Failed to create payment order. Please try again.');
      }
      
      const razorpayOptions = {
        description: 'Add Eatoor Money',
        method: {
            upi: true,
            card: true,
            netbanking: true,
            wallet: true,
        },
        image: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png',
        currency: 'INR',
        key: orderData.key || 'rzp_live_FHtZiuvJzjmBrk',
        amount: validation.amount * 100,
        name: 'Eatoor Money',
        order_id: orderData.order_id,
        prefill: {
          email: user.email || 'user@example.com',
          contact: user.contact || '9999999999',
          name: user.name || 'Eatoor User',
        },
        theme: { color: '#FF6B35' },
        notes: {
          source: 'eatoor_wallet',
          user_id: user.id || 'unknown',
          app_name: 'Eatoor',
        },
        timeout: 300,
      };

      console.log('Opening Razorpay checkout...');
      const razorpayResponse = await RazorpayCheckout.open(razorpayOptions);

      if (razorpayResponse?.razorpay_payment_id) {
        console.log('Payment successful, verifying...');

        const successPayload = {
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          amount: validation.amount,
        };

        const verificationResponse = await walletAddMoneySuccess(successPayload);

        if (verificationResponse.status === 200 || verificationResponse.data?.success) {
          console.log('Payment verification successful');

          // Update wallet balance in AsyncStorage
          try {
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
              const parsedUser = JSON.parse(userData);
              const currentBalance = parseFloat(parsedUser.wallet_balance || 0);
              parsedUser.wallet_balance = (currentBalance + validation.amount).toString();
              await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
            }
          } catch (storageError) {
            console.error('Wallet update error:', storageError);
          }

          setProcessingPayment(false);
          setSuccessMessage(`₹${validation.amount.toFixed(2)} has been added to your wallet`);
          setPaymentSuccess(true);

          // Navigate after 2 seconds
          setTimeout(() => {
            if (route?.params?.prevScreen === 'CartScreen') {
              navigation.navigate('CartScreen');
            } else {
              navigation.goBack();
            }
          }, 2000);

        } else {
          throw new Error('Payment verification failed. Please contact support.');
        }
      } else {
        setPaymentError('Payment was cancelled');
        setProcessingPayment(false);
      }

    } catch (error) {
      console.error('Payment error:', error);
      setProcessingPayment(false);
      setPaymentSuccess(false);

      if (error.code === 2) {
        setPaymentError('Payment was cancelled. You can try again.');
      } else if (error.code === 4) {
        setPaymentError('Network error. Please check your connection and try again.');
      } else if (error.code === 5) {
        setPaymentError('Payment failed. Please try again.');
      } else if (error.message?.includes('verification')) {
        setPaymentError('Payment verification failed. Please contact support.');
      } else {
        setPaymentError(error.message || 'Failed to process payment.');
      }
    }
  };

  const isAmountValid = () => {
    if (!amount) return false;
    const numAmount = parseFloat(amount);
    return !isNaN(numAmount) && numAmount >= MIN_AMOUNT && numAmount <= MAX_AMOUNT;
  };

  const renderPayNowButton = () => {
    if (paymentSuccess) return null;
    
    return (
      <View 
        style={[
          styles.payNowContainer,
          keyboardVisible && styles.payNowContainerWithKeyboard
        ]}
      >
        <TouchableOpacity
          style={[
            styles.payNowButton,
            (!isAmountValid() || processingPayment) && styles.payNowButtonDisabled
          ]}
          onPress={handlePayNow}
          disabled={!isAmountValid() || processingPayment}
          activeOpacity={0.8}
        >
          {processingPayment ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.payNowButtonContent}>
              <Text style={styles.payNowText}>Pay Now</Text>
              {amount && isAmountValid() && (
                <Text style={styles.payNowAmount}>
                  ₹{parseInt(amount).toLocaleString('en-IN')}
                </Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
              keyboardVisible && styles.scrollContentWithKeyboard
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
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

            {/* Amount Input Section */}
            {!paymentSuccess && (
              <>
                <View style={styles.amountSection}>
                  <Text style={styles.sectionLabel}>Enter Amount</Text>
                  
                  <View style={styles.amountInputContainer}>
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

                  {/* Amount Validation Messages */}
                  {amount && parseFloat(amount) < MIN_AMOUNT ? (
                    <View style={styles.amountError}>
                      <Icon name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.amountErrorText}>
                        Minimum amount: ₹{MIN_AMOUNT}
                      </Text>
                    </View>
                  ) : amount && parseFloat(amount) > MAX_AMOUNT ? (
                    <View style={styles.amountError}>
                      <Icon name="alert-circle" size={14} color="#EF4444" />
                      <Text style={styles.amountErrorText}>
                        Maximum amount: ₹{MAX_AMOUNT.toLocaleString()}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.amountHint}>
                      Enter ₹{MIN_AMOUNT} - ₹{MAX_AMOUNT.toLocaleString()}
                    </Text>
                  )}

                  {/* Payment Error Display */}
                  {paymentError && (
                    <View style={styles.paymentErrorContainer}>
                      <Icon name="warning" size={16} color="#EF4444" />
                      <Text style={styles.paymentErrorText}>{paymentError}</Text>
                    </View>
                  )}
                </View>

                {/* Quick Amount Selection */}
                <View style={styles.quickAmountSection}>
                  <Text style={styles.sectionLabel}>Quick Add</Text>
                  <View style={styles.defaultAmountsContainer}>
                    {defaultAmounts.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.defaultAmountButton,
                          selectedDefaultAmount === item && styles.selectedDefaultAmountButton,
                          processingPayment && styles.buttonDisabled
                        ]}
                        onPress={() => handleDefaultAmountSelect(item)}
                        activeOpacity={0.7}
                        disabled={processingPayment}
                      >
                        <Text
                          style={[
                            styles.defaultAmountText,
                            selectedDefaultAmount === item && styles.selectedDefaultAmountText
                          ]}
                        >
                          ₹{item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Security Info */}
                <View style={styles.securityInfo}>
                  <Icon name="shield-checkmark" size={16} color="#10B981" />
                  <Text style={styles.securityText}>Secure Payment • 100% Safe</Text>
                </View>
              </>
            )}

            {/* Spacer for bottom button - Dynamic based on keyboard */}
            <View style={{ 
              height: keyboardVisible ? 80 : 120,
              minHeight: keyboardVisible ? 80 : 120 
            }} />
          </ScrollView>

          {/* Pay Now Button - Fixed at bottom, appears above keyboard */}
          {renderPayNowButton()}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop:20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
    paddingBottom: 100, // Extra padding when keyboard is visible
  },
  // Success Message Styles
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
  // Amount Section Styles
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
  payNowContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  payNowContainerWithKeyboard: {
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  payNowButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payNowButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowColor: '#999',
  },
  payNowButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payNowText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  payNowAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
});

export default EatoorMoneyAdd;