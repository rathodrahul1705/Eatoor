import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import {
  getWalletBalance,
  createWalletOrder,
  walletAddMoneySuccess,
  getWalletTransactions,
  debitWallet,
} from '../../../api/wallet';

const { width, height } = Dimensions.get('window');

// Transaction data mapping
const mapTransactionType = (txn_type) => {
  switch (txn_type) {
    case 'credit':
      return { type: 'addition', label: 'Credit', icon: 'add-circle', color: '#4CAF50' };
    case 'debit':
      return { type: 'deduction', label: 'Debit', icon: 'remove-circle', color: '#F44336' };
    default:
      return { type: 'addition', label: 'Other', icon: 'help-circle', color: '#2196F3' };
  }
};

const mapTransactionSource = (txn_source) => {
  switch (txn_source) {
    case 'add_money':
      return { category: 'Top-up', description: 'Money Added to Wallet' };
    case 'order_payment':
      return { category: 'Order Payment', description: 'Food Order Payment' };
    case 'refund':
      return { category: 'Refund', description: 'Order Refund' };
    default:
      return { category: 'Other', description: 'Wallet Transaction' };
  }
};

const transactionFilters = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'credit', label: 'Credit', icon: 'trending-up' },
  { id: 'debit', label: 'Debit', icon: 'trending-down' },
];

const EatoorMoneyScreen = ({ navigation }) => {
  // State Management
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [addMoneyModalVisible, setAddMoneyModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [amount, setAmount] = useState('');
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const modalClosingRef = useRef(false);
  const flatListRef = useRef(null);

  // Animation Values
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [height * 0.35, height * 0.2],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });
  const balanceTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -30],
    extrapolate: 'clamp',
  });
  const balanceScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  // Start pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Load wallet data
  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const balanceResponse = await getWalletBalance();
      
      if (balanceResponse.data && balanceResponse.data.balance) {
        setBalance(parseFloat(balanceResponse.data.balance));
        
        // Map API transactions to UI format
        const mappedTransactions = balanceResponse.data.transactions?.map(transaction => {
          const typeInfo = mapTransactionType(transaction.txn_type);
          const sourceInfo = mapTransactionSource(transaction.txn_source);
          
          const date = new Date(transaction.created_at);
          const now = new Date();
          const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
          
          let displayDate = '';
          if (diffDays === 0) {
            displayDate = 'Today';
          } else if (diffDays === 1) {
            displayDate = 'Yesterday';
          } else {
            displayDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          }
          
          return {
            id: transaction.id.toString(),
            title: sourceInfo.category,
            amount: parseFloat(transaction.amount),
            type: typeInfo.type,
            txn_type: transaction.txn_type,
            date: displayDate,
            time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            description: transaction.note || sourceInfo.description,
            category: sourceInfo.category,
            icon: typeInfo.icon,
            color: typeInfo.color,
            orderId: transaction.order_number,
            status: transaction.status,
            created_at: transaction.created_at,
            fullDate: date,
          };
        }) || [];
        
        setTransactions(mappedTransactions);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  // Load more transactions
  const loadMoreTransactions = async () => {
  if (loadingMore || !hasMore) return;

  try {
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    const response = await getWalletTransactions(nextPage);

    if (response.data && response.data.results && response.data.results.length > 0) {
      const newTransactions = response.data.results.map(transaction => {
        const typeInfo = mapTransactionType(transaction.txn_type);
        const sourceInfo = mapTransactionSource(transaction.txn_source);

        const date = new Date(transaction.created_at);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        let displayDate = '';
        if (diffDays === 0) {
          displayDate = 'Today';
        } else if (diffDays === 1) {
          displayDate = 'Yesterday';
        } else {
          displayDate = date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          });
        }

        return {
          id: transaction.id.toString(),
          title: sourceInfo.category,
          amount: parseFloat(transaction.amount),
          type: typeInfo.type,
          txn_type: transaction.txn_type,
          date: displayDate,
          time: date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          description: transaction.note || sourceInfo.description,
          category: sourceInfo.category,
          icon: typeInfo.icon,
          color: typeInfo.color,
          orderId: transaction.order_number,
          status: transaction.status,
          created_at: transaction.created_at,
          fullDate: date,
        };
      });

      // KEEP DESC ORDER — append next page at bottom
      setTransactions(prev => [...prev, ...newTransactions]);
      setCurrentPage(nextPage);
      setHasMore(response.data.next !== null);
    } else {
      setHasMore(false);
    }
  } catch (error) {
    console.error('Error loading more transactions:', error);
    Alert.alert('Error', 'Failed to load more transactions');
  } finally {
    setLoadingMore(false);
  }
};


  // Filtered transactions
  const filteredTransactions = transactions.filter(transaction => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'credit') return transaction.txn_type === 'credit';
    if (selectedFilter === 'debit') return transaction.txn_type === 'debit';
    return true;
  });

  // Handle back navigation
  const handleBackPress = () => {
    navigation.goBack();
  };

  // Open Add Money Modal
  const openAddMoneyModal = () => {
    setAmount('');
    setAddMoneyModalVisible(true);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Close Add Money Modal with callback
  const closeAddMoneyModal = (callback) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAddMoneyModalVisible(false);
      fadeAnim.setValue(0);
      slideAnim.setValue(height);
      if (callback) callback();
    });
  };

  // Validate amount input - only numbers and decimals
  const validateAmountInput = (text) => {
    const cleanedText = text.replace(/[^0-9.]/g, '');
    
    const parts = cleanedText.split('.');
    if (parts.length > 2) {
      setAmount(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setAmount(cleanedText);
    }
  };

  // Handle Add Money with Razorpay
  const handleAddMoney = async () => {
    if (!amount || amount.trim() === '') {
      Alert.alert('Invalid Amount', 'Please enter an amount');
      return;
    }

    const newAmount = parseFloat(amount);
    
    if (isNaN(newAmount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (newAmount < 100) {
      Alert.alert('Minimum Amount Required', 'Please add at least ₹100');
      return;
    }

    if (newAmount > 100000) {
      Alert.alert('Maximum Limit Exceeded', 'Cannot add more than ₹1,00,000 at once');
      return;
    }

    try {
      setProcessingPayment(true);
      
      // Step 1: Create Razorpay order
      const orderResponse = await createWalletOrder({ amount: newAmount });
      const orderData = orderResponse.data;
      
      if (!orderData.order_id) {
        throw new Error('Failed to create payment order');
      }

      // Step 2: Initialize Razorpay checkout
      const razorpayOptions = {
        description: 'Add Eatoor Money',
        image: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png', // Add your logo URL
        currency: 'INR',
        key: orderData.key || 'rzp_test_Ler2HqmO4lVND1', // Use key from API or fallback
        amount: newAmount * 100, // Convert to paise
        name: 'Eatoor Money',
        order_id: orderData.order_id,
        prefill: {
          email: 'user@example.com',
          contact: '9999999999',
          name: 'Eatoor User',
        },
        theme: { color: '#E65C00' },
      };

      // Step 3: Open Razorpay checkout
      const razorpayResponse = await RazorpayCheckout.open(razorpayOptions);
      
      if (razorpayResponse) {
        // Step 4: Verify payment success
        const successPayload = {
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          amount: newAmount,
        };

        const verificationResponse = await walletAddMoneySuccess(successPayload);

        if (verificationResponse.status == 200) {
          // Update balance with animation
          Animated.sequence([
            Animated.timing(rotateAnim, {
              toValue: 1,
              duration: 500,
              easing: Easing.out(Easing.back(2)),
              useNativeDriver: true,
            }),
            Animated.timing(rotateAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();

          // Fetch updated wallet data
          await fetchWalletData();
          closeAddMoneyModal();

          Alert.alert(
            'Success!',
            `₹${newAmount.toFixed(2)} added successfully 🎉`,
            [{ text: 'Awesome!', style: 'cancel' }]
          );
        } else {
          throw new Error('Payment verification failed');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      
      // Check if user cancelled the payment
      if (error.code === 2) {
        Alert.alert('Payment Cancelled', 'Payment was cancelled by user');
      } else {
        Alert.alert(
          'Payment Failed',
          error.message || 'Failed to process payment. Please try again.'
        );
      }
    } finally {
      setProcessingPayment(false);
    }
  };

  // Render transaction item
  const renderTransactionItem = ({ item, index }) => {
    const isPositive = item.txn_type === 'credit';
    const itemOpacity = scrollY.interpolate({
      inputRange: [0, 100, 100 + index * 30],
      outputRange: [1, 1, 0.9],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.transactionCard,
          {
            opacity: itemOpacity,
            transform: [{
              translateY: scrollY.interpolate({
                inputRange: [-1, 0, 100, 100 + index * 30],
                outputRange: [0, 0, 0, -5],
                extrapolate: 'clamp',
              })
            }]
          },
        ]}
      >
        <LinearGradient
          colors={[item.color + '20', item.color + '08']}
          style={styles.transactionIconContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name={item.icon} size={22} color={item.color} />
        </LinearGradient>
        
        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.transactionDescription} numberOfLines={1}>
                {item.description}
              </Text>
              {item.orderId && (
                <View style={styles.restaurantBadge}>
                  <Icon name="receipt" size={12} color="#666" />
                  <Text style={styles.restaurantText}>Order {item.orderId}</Text>
                </View>
              )}
            </View>
            <View style={styles.amountContainer}>
              <Text style={[
                styles.transactionAmount,
                { color: isPositive ? '#4CAF50' : '#F44336' }
              ]}>
                {isPositive ? '+' : '-'}₹{Math.abs(item.amount).toFixed(2)}
              </Text>
              <Text style={styles.transactionTime}>
                {item.time}
              </Text>
            </View>
          </View>
          
          <View style={styles.transactionFooter}>
            <View style={[styles.categoryBadge, { backgroundColor: item.color + '15' }]}>
              <Text style={[styles.categoryText, { color: item.color }]}>
                {item.status === 'success' ? 'Completed' : item.status}
              </Text>
            </View>
            <Text style={styles.transactionDate}>
              {item.date}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  // Render footer with loading indicator
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  // Animated Header Background
  const AnimatedHeaderBackground = () => {
    const bgHeight = scrollY.interpolate({
      inputRange: [0, 150],
      outputRange: [height * 0.35, height * 0.25],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.headerBackground, { height: bgHeight }]}>
        <LinearGradient
          colors={['#FF6B35', '#FF8E53', '#FFA726']}
          style={styles.gradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.foodDecoration}>
            <Icon name="pizza" size={60} color="rgba(255,255,255,0.1)" style={styles.foodIcon1} />
            <Icon name="fast-food" size={50} color="rgba(255,255,255,0.1)" style={styles.foodIcon2} />
            <Icon name="ice-cream" size={70} color="rgba(255,255,255,0.1)" style={styles.foodIcon3} />
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading wallet...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" translucent />
      
      {/* Animated Header Background */}
      <AnimatedHeaderBackground />
      
      {/* Fixed Header Content */}
      <View style={styles.headerFixedContent}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.viewToggle}
            onPress={() => setIsBalanceVisible(!isBalanceVisible)}
            activeOpacity={0.7}
          >
            <Icon 
              name={isBalanceVisible ? 'eye-off' : 'eye'} 
              size={24} 
              color="#FFF" 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={flatListRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Balance Section */}
        <Animated.View style={[
          styles.balanceContainer,
          {
            transform: [
              { translateY: balanceTranslateY },
              { scale: balanceScale }
            ],
          },
        ]}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Animated.View
            style={{
              transform: [
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }
              ]
            }}
          >
            {isBalanceVisible ? (
              <View style={styles.balanceAmountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <Text style={styles.balanceAmount}>{balance.toFixed(2)}</Text>
              </View>
            ) : (
              <View style={styles.hiddenBalance}>
                <Text style={styles.hiddenBalanceText}>●●●●●●</Text>
              </View>
            )}
          </Animated.View>
          
          <View style={styles.balanceStats}>
              <TouchableOpacity 
                style={styles.addMoneyButtonSmall}
                onPress={openAddMoneyModal}
                activeOpacity={0.8}
                disabled={processingPayment}
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8E53']}
                  style={styles.addMoneyButtonSmallGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {processingPayment ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Icon name="add" size={18} color="#FFF" />
                      <Text style={styles.addMoneyButtonSmallText}>Add Money</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Transaction History */}
        <View style={styles.transactionSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
            </View>
            <TouchableOpacity onPress={fetchWalletData}>
              <Icon name="refresh" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            {transactionFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterChip,
                  selectedFilter === filter.id && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFilter(filter.id)}
                activeOpacity={0.7}
              >
                <Icon
                  name={filter.icon}
                  size={16}
                  color={selectedFilter === filter.id ? '#FFF' : '#666'}
                  style={styles.filterIcon}
                />
                <Text style={[
                  styles.filterText,
                  selectedFilter === filter.id && styles.filterTextActive,
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Transactions List */}
          {filteredTransactions.length > 0 ? (
            <>
              <FlatList
                data={filteredTransactions}
                renderItem={renderTransactionItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.transactionsList}
                ListFooterComponent={renderFooter}
                onEndReached={loadMoreTransactions}
                onEndReachedThreshold={0.5}
              />
              {hasMore && !loadingMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMoreTransactions}
                >
                  <Text style={styles.loadMoreText}>Load More</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="receipt-outline" size={64} color="#E0E0E0" />
              <Text style={styles.emptyStateTitle}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Start ordering food or add money to see transactions here
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton} 
                onPress={openAddMoneyModal}
                disabled={processingPayment}
              >
                <Text style={styles.emptyStateButtonText}>
                  {processingPayment ? 'Processing...' : 'Add Money Now'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Bottom Padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <Animated.View style={[
        styles.fabContainer,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={openAddMoneyModal}
          activeOpacity={0.9}
          disabled={processingPayment}
        >
          <LinearGradient
            colors={['#FF6B35', '#FF8E53']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {processingPayment ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Icon name="add" size={28} color="#FFF" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Add Money Modal */}
      <Modal
        transparent={true}
        visible={addMoneyModalVisible}
        onRequestClose={() => {
          if (!modalClosingRef.current) {
            closeAddMoneyModal();
          }
        }}
        statusBarTranslucent
        animationType="none"
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => {
              if (!modalClosingRef.current) {
                closeAddMoneyModal();
              }
            }}
            disabled={processingPayment}
          />
          <Animated.View style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTop}>
                <View style={styles.modalTitleContainer}>
                  <Icon name="wallet" size={24} color="#FF6B35" />
                  <Text style={styles.modalTitle}>Add Money</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    if (!modalClosingRef.current && !processingPayment) {
                      closeAddMoneyModal();
                    }
                  }} 
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                  disabled={processingPayment}
                >
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Minimum amount: ₹100</Text>
            </View>

            {/* Amount Section */}
            <View style={styles.modalAmountSection}>
              <Text style={styles.amountLabel}>Enter Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={validateAmountInput}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                  autoFocus={!processingPayment}
                  maxLength={10}
                  editable={!processingPayment}
                />
              </View>
              {amount && parseFloat(amount) < 100 && (
                <Text style={styles.minimumAmountError}>
                  Minimum amount required: ₹100
                </Text>
              )}

              {/* Quick Amount Suggestions */}
              <Text style={styles.quickAmountLabel}>Suggested Amounts</Text>
              <View style={styles.quickAmountsGrid}>
                {[100, 200, 500, 1000, 2000, 5000].map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={[
                      styles.quickAmountButton,
                      amount === quickAmount.toString() && styles.quickAmountButtonActive,
                    ]}
                    onPress={() => setAmount(quickAmount.toString())}
                    activeOpacity={0.7}
                    disabled={processingPayment}
                  >
                    <Text style={[
                      styles.quickAmountText,
                      amount === quickAmount.toString() && styles.quickAmountTextActive,
                    ]}>
                      ₹{quickAmount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.addMoneyButton,
                (!amount || parseFloat(amount) < 100 || processingPayment) && styles.addMoneyButtonDisabled
              ]}
              onPress={handleAddMoney}
              activeOpacity={0.8}
              disabled={!amount || parseFloat(amount) < 100 || processingPayment}
            >
              <LinearGradient
                colors={(!amount || parseFloat(amount) < 100 || processingPayment) ? ['#CCCCCC', '#999999'] : ['#FF6B35', '#FF8E53']}
                style={styles.addMoneyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {processingPayment ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Icon name="wallet" size={22} color="#FFF" style={styles.buttonIcon} />
                    <Text style={styles.addMoneyButtonText}>
                      {amount ? `Add ₹${parseFloat(amount).toFixed(2)}` : 'Enter Amount'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFD',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FF6B35',
  },
  gradientBackground: {
    flex: 1,
  },
  foodDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  foodIcon1: {
    position: 'absolute',
    top: '20%',
    left: '10%',
  },
  foodIcon2: {
    position: 'absolute',
    bottom: '30%',
    right: '15%',
  },
  foodIcon3: {
    position: 'absolute',
    top: '40%',
    right: '10%',
  },
  headerFixedContent: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceContainer: {
    paddingHorizontal: 24,
    paddingTop: height * 0.12,
    paddingBottom: 30,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 24,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1.5,
  },
  hiddenBalance: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 24,
  },
  hiddenBalanceText: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 6,
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addMoneyButtonSmall: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  addMoneyButtonSmallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  addMoneyButtonSmallText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transactionSection: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    minHeight: height * 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterContent: {
    paddingHorizontal: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  filterIcon: {
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
  },
  transactionsList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
      },
    }),
  },
  transactionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  transactionDescription: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restaurantText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  transactionTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#999',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  emptyStateButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 24,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.85,
  },
  modalHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalAmountSection: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
    marginBottom: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
    marginBottom: 8,
    paddingVertical: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '900',
    color: '#1A1A1A',
    padding: 0,
  },
  minimumAmountError: {
    fontSize: 14,
    color: '#F44336',
    marginBottom: 20,
    fontWeight: '600',
  },
  quickAmountLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#F8FAFD',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  quickAmountButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  quickAmountTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  addMoneyButton: {
    margin: 24,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  addMoneyButtonDisabled: {
    opacity: 0.7,
  },
  addMoneyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  buttonIcon: {
    marginRight: 4,
  },
  addMoneyButtonText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  loadMoreButton: {
    backgroundColor: '#F8FAFD',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
});

export default EatoorMoneyScreen;