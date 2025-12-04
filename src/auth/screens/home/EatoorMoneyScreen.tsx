import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
} from '../../../api/wallet';

const { width, height } = Dimensions.get('window');

// Constants (keep outside component)
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 100000;
const TRANSACTION_FILTERS = [
  { id: 'all', label: 'All', icon: 'grid-outline' },
  { id: 'credit', label: 'Credits', icon: 'trending-up-outline' },
  { id: 'debit', label: 'Debits', icon: 'trending-down-outline' },
];

// Helper functions (keep outside component)
const mapTransactionType = (txn_type) => {
  const mapping = {
    credit: { type: 'addition', label: 'Credit', icon: 'add-circle', color: '#10B981' },
    debit: { type: 'deduction', label: 'Debit', icon: 'remove-circle', color: '#EF4444' },
  };
  return mapping[txn_type] || { type: 'addition', label: 'Other', icon: 'help-circle', color: '#3B82F6' };
};

const mapTransactionSource = (txn_source) => {
  const mapping = {
    add_money: { category: 'Top-up', description: 'Money Added to Wallet' },
    order_payment: { category: 'Order Payment', description: 'Food Order Payment' },
    refund: { category: 'Refund', description: 'Order Refund' },
  };
  return mapping[txn_source] || { category: 'Other', description: 'Wallet Transaction' };
};

const formatTransactionDate = (created_at) => {
  const date = new Date(created_at);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const EatoorMoneyScreen = ({ navigation }) => {
  // State Management
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [addMoneyModalVisible, setAddMoneyModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [isBalanceVisible, setIsBalanceVisible] = useState(false); // Default hidden
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
  const eyeScaleAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef(null);
  const isMounted = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Animation interpolations
  const headerHeight = useMemo(() => 
    scrollY.interpolate({
      inputRange: [0, 150],
      outputRange: [height * 0.35, height * 0.2],
      extrapolate: 'clamp',
    }), [scrollY]);

  const balanceScale = useMemo(() =>
    scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    }), [scrollY]);

  const balanceTranslateY = useMemo(() =>
    scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [0, -30],
      extrapolate: 'clamp',
    }), [scrollY]);

  // Eye icon animation
  const eyeScale = useMemo(() =>
    eyeScaleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.2],
    }), []);

  // Toggle balance visibility with animation
  const toggleBalanceVisibility = useCallback(() => {
    Animated.sequence([
      Animated.timing(eyeScaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(eyeScaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsBalanceVisible(prev => !prev);
  }, []);

  // Process transaction data from API
  const processTransactionData = useCallback((apiTransactions) => {
    if (!apiTransactions || !Array.isArray(apiTransactions)) return [];
    
    return apiTransactions.map(transaction => {
      const typeInfo = mapTransactionType(transaction.txn_type);
      const sourceInfo = mapTransactionSource(transaction.txn_source);
      const date = new Date(transaction.created_at);
      
      return {
        id: transaction.id.toString(),
        title: sourceInfo.category,
        amount: parseFloat(transaction.amount),
        type: typeInfo.type,
        txn_type: transaction.txn_type,
        date: formatTransactionDate(transaction.created_at),
        time: date.toLocaleTimeString('en-IN', { 
          hour: '2-digit', 
          minute: '2-digit' 
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
  }, []);

  // Load wallet data
  const fetchWalletData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      setLoading(true);
      const balanceResponse = await getWalletBalance();
      
      if (balanceResponse.data?.balance) {
        setBalance(parseFloat(balanceResponse.data.balance));
        
        // Process transactions from API response
        const processedTransactions = processTransactionData(
          balanceResponse.data.transactions
        );
        
        setTransactions(processedTransactions);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [processTransactionData]);

  // Initial load
  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Load more transactions
  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore || !isMounted.current) return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      const response = await getWalletTransactions(nextPage);

      if (response.data?.results?.length > 0) {
        const newTransactions = processTransactionData(response.data.results);
        
        // Append new transactions while maintaining order from API
        setTransactions(prev => [...prev, ...newTransactions]);
        setCurrentPage(nextPage);
        setHasMore(response.data.next !== null);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load more transactions');
      }
    } finally {
      if (isMounted.current) {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, hasMore, currentPage, processTransactionData]);

  // Filtered transactions - memoized for performance
  const filteredTransactions = useMemo(() => {
    if (selectedFilter === 'all') return transactions;
    if (selectedFilter === 'credit') {
      return transactions.filter(t => t.txn_type === 'credit');
    }
    if (selectedFilter === 'debit') {
      return transactions.filter(t => t.txn_type === 'debit');
    }
    return transactions;
  }, [transactions, selectedFilter]);

  // Navigation handlers
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Modal handlers
  const openAddMoneyModal = useCallback(() => {
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
  }, []);

  const closeAddMoneyModal = useCallback((callback) => {
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
      if (isMounted.current) {
        setAddMoneyModalVisible(false);
        fadeAnim.setValue(0);
        slideAnim.setValue(height);
        callback?.();
      }
    });
  }, []);

  // Amount validation
  const validateAmountInput = useCallback((text) => {
    // Remove non-numeric characters except decimal point
    const cleanedText = text.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points
    const parts = cleanedText.split('.');
    if (parts.length > 2) {
      setAmount(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setAmount(cleanedText);
    }
  }, []);

  const validateAmount = useCallback((amountStr) => {
    const numAmount = parseFloat(amountStr);
    if (isNaN(numAmount)) {
      return { isValid: false, message: 'Please enter a valid amount' };
    }
    if (numAmount < MIN_AMOUNT) {
      return { isValid: false, message: `Minimum amount is ₹${MIN_AMOUNT}` };
    }
    if (numAmount > MAX_AMOUNT) {
      return { isValid: false, message: `Maximum amount is ₹${MAX_AMOUNT}` };
    }
    return { isValid: true, amount: numAmount };
  }, []);

  // Payment handler
  const handleAddMoney = useCallback(async () => {
    const validation = validateAmount(amount);
    if (!validation.isValid) {
      Alert.alert('Invalid Amount', validation.message);
      return;
    }

    try {
      setProcessingPayment(true);
      
      // Create Razorpay order
      const orderResponse = await createWalletOrder({ 
        amount: validation.amount 
      });
      const orderData = orderResponse.data;
      
      if (!orderData.order_id) {
        throw new Error('Failed to create payment order');
      }

      // Configure Razorpay options
      const razorpayOptions = {
        description: 'Add Eatoor Money',
        image: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png',
        currency: 'INR',
        key: orderData.key || 'rzp_test_Ler2HqmO4lVND1',
        amount: validation.amount * 100,
        name: 'Eatoor Money',
        order_id: orderData.order_id,
        prefill: {
          email: 'user@example.com',
          contact: '9999999999',
          name: 'Eatoor User',
        },
        theme: { color: '#E65C00' },
      };

      // Open Razorpay checkout
      const razorpayResponse = await RazorpayCheckout.open(razorpayOptions);
      
      if (razorpayResponse) {
        // Verify payment
        const successPayload = {
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          amount: validation.amount,
        };

        const verificationResponse = await walletAddMoneySuccess(successPayload);

        if (verificationResponse.status === 200) {
          // Success animation
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

          // Refresh data
          await fetchWalletData();
          closeAddMoneyModal();

          Alert.alert(
            'Success!',
            `₹${validation.amount.toFixed(2)} added successfully 🎉`,
            [{ text: 'Awesome!', style: 'cancel' }]
          );
        } else {
          throw new Error('Payment verification failed');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      
      if (error.code === 2) {
        Alert.alert('Payment Cancelled', 'Payment was cancelled by user');
      } else {
        Alert.alert(
          'Payment Failed',
          error.message || 'Failed to process payment. Please try again.'
        );
      }
    } finally {
      if (isMounted.current) {
        setProcessingPayment(false);
      }
    }
  }, [amount, validateAmount, fetchWalletData, closeAddMoneyModal]);

  // Render transaction item - memoized
  const renderTransactionItem = useCallback(({ item }) => {
    const isCredit = item.txn_type === 'credit';
    
    return (
      <View style={styles.transactionCard}>
        <LinearGradient
          colors={[item.color + '15', item.color + '08']}
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
                { color: isCredit ? '#10B981' : '#EF4444' }
              ]}>
                {isCredit ? '+' : '-'}₹{Math.abs(item.amount).toFixed(2)}
              </Text>
              <Text style={styles.transactionTime}>
                {item.time}
              </Text>
            </View>
          </View>
          
          <View style={styles.transactionFooter}>
            <View style={[styles.categoryBadge, { backgroundColor: item.color + '10' }]}>
              <Text style={[styles.categoryText, { color: item.color }]}>
                {item.status === 'success' ? 'Completed' : item.status}
              </Text>
            </View>
            <Text style={styles.transactionDate}>
              {item.date}
            </Text>
          </View>
        </View>
      </View>
    );
  }, []);

  // Render list footer
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <LinearGradient
          colors={['#FF6B35', '#FF8E53']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingTextWhite}>Loading your wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" translucent />
      
      {/* Header Background */}
      <Animated.View style={[styles.headerBackground, { height: headerHeight }]}>
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
      
      {/* Fixed Header */}
      <View style={styles.headerFixedContent}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Icon name="chevron-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Animated.View style={{ transform: [{ scale: eyeScale }] }}>
            <TouchableOpacity 
              style={styles.viewToggle}
              onPress={toggleBalanceVisibility}
              activeOpacity={0.7}
            >
              <Icon 
                name={isBalanceVisible ? 'eye-off-outline' : 'eye-outline'} 
                size={24} 
                color="#FFF" 
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      <ScrollView
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
          <View style={styles.balanceLabelContainer}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <View style={styles.balanceVisibilityHint}>
              <Icon 
                name={isBalanceVisible ? 'eye-off-outline' : 'eye-outline'} 
                size={14} 
                color="rgba(255,255,255,0.7)" 
              />
              <Text style={styles.balanceVisibilityText}>
                {isBalanceVisible ? 'Tap to hide' : 'Tap to show'}
              </Text>
            </View>
          </View>
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
                <Text style={styles.balanceAmount}>
                  {balance.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </Text>
              </View>
            ) : (
              <TouchableOpacity 
                onPress={toggleBalanceVisibility}
                activeOpacity={0.8}
                style={styles.hiddenBalanceContainer}
              >
                <View style={styles.hiddenBalance}>
                  <Icon name="lock-closed" size={20} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.hiddenBalanceText}>●●●●●●</Text>
                  <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
                </View>
                <Text style={styles.showBalanceText}>Tap to show balance</Text>
              </TouchableOpacity>
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
              <Icon name="receipt-outline" size={24} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Transaction History</Text>
            </View>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={fetchWalletData} 
              disabled={loading}
              activeOpacity={0.7}
            >
              <Icon name="refresh-outline" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Filter Chips - Improved Design */}
          <View style={styles.filterContainer}>
            <View style={styles.filterScrollContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContent}
              >
                {TRANSACTION_FILTERS.map((filter) => (
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
                    {selectedFilter === filter.id && (
                      <View style={styles.activeIndicator} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            {/* Active filter stats */}
            <View style={styles.filterStats}>
              <Text style={styles.filterStatsText}>
                {selectedFilter === 'all' && 'All Transactions'}
                {selectedFilter === 'credit' && 'Credit Transactions'}
                {selectedFilter === 'debit' && 'Debit Transactions'}
              </Text>
              <Text style={styles.filterCount}>
                {filteredTransactions.length} {filteredTransactions.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
          </View>

          {/* Transactions List */}
          {filteredTransactions.length > 0 ? (
            <>
              <FlatList
                ref={flatListRef}
                data={filteredTransactions}
                renderItem={renderTransactionItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.transactionsList}
                ListFooterComponent={renderFooter}
                onEndReached={loadMoreTransactions}
                onEndReachedThreshold={0.5}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
              />
              {hasMore && !loadingMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMoreTransactions}
                  activeOpacity={0.7}
                >
                  <Text style={styles.loadMoreText}>Load More Transactions</Text>
                  <Icon name="chevron-down" size={18} color="#666" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconContainer}>
                <Icon name="receipt-outline" size={64} color="#E5E7EB" />
              </View>
              <Text style={styles.emptyStateTitle}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {selectedFilter !== 'all' 
                  ? `No ${selectedFilter} transactions found`
                  : 'Start ordering food or add money to see transactions here'}
              </Text>
              <TouchableOpacity 
                style={styles.emptyStateButton} 
                onPress={openAddMoneyModal}
                disabled={processingPayment}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8E53']}
                  style={styles.emptyStateButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon name="wallet-outline" size={20} color="#FFF" />
                  <Text style={styles.emptyStateButtonText}>
                    {processingPayment ? 'Processing...' : 'Add Money Now'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
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
              <>
                <Icon name="add" size={28} color="#FFF" />
                <View style={styles.fabBadge}>
                  <Icon name="wallet-outline" size={12} color="#FF6B35" />
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Add Money Modal */}
      <Modal
        transparent={true}
        visible={addMoneyModalVisible}
        onRequestClose={() => closeAddMoneyModal()}
        statusBarTranslucent
        animationType="none"
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => !processingPayment && closeAddMoneyModal()}
          />
          <Animated.View style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTop}>
                <View style={styles.modalTitleContainer}>
                  <LinearGradient
                    colors={['#FF6B35', '#FF8E53']}
                    style={styles.modalIconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Icon name="wallet" size={24} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => !processingPayment && closeAddMoneyModal()} 
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                  disabled={processingPayment}
                >
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Securely add money using UPI, cards, or net banking</Text>
            </View>

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
              
              {amount && parseFloat(amount) < MIN_AMOUNT && (
                <View style={styles.minimumAmountErrorContainer}>
                  <Icon name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.minimumAmountError}>
                    Minimum amount required: ₹{MIN_AMOUNT}
                  </Text>
                </View>
              )}

              <Text style={styles.quickAmountLabel}>Quick Select</Text>
              <View style={styles.quickAmountsGrid}>
                {QUICK_AMOUNTS.map((quickAmount) => {
                  const isActive = amount === quickAmount.toString();
                  return (
                    <TouchableOpacity
                      key={quickAmount}
                      style={[
                        styles.quickAmountButton,
                        isActive && styles.quickAmountButtonActive,
                      ]}
                      onPress={() => setAmount(quickAmount.toString())}
                      activeOpacity={0.7}
                      disabled={processingPayment}
                    >
                      {isActive && (
                        <View style={styles.quickAmountActiveIndicator} />
                      )}
                      <Text style={[
                        styles.quickAmountText,
                        isActive && styles.quickAmountTextActive,
                      ]}>
                        ₹{quickAmount}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.addMoneyButton,
                (!amount || parseFloat(amount) < MIN_AMOUNT || processingPayment) && 
                styles.addMoneyButtonDisabled
              ]}
              onPress={handleAddMoney}
              activeOpacity={0.8}
              disabled={!amount || parseFloat(amount) < MIN_AMOUNT || processingPayment}
            >
              <LinearGradient
                colors={(!amount || parseFloat(amount) < MIN_AMOUNT || processingPayment) 
                  ? ['#E5E7EB', '#9CA3AF'] 
                  : ['#FF6B35', '#FF8E53']}
                style={styles.addMoneyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {processingPayment ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.addMoneyButtonText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="wallet" size={22} color="#FFF" style={styles.buttonIcon} />
                    <Text style={styles.addMoneyButtonText}>
                      {amount ? `Add ₹${parseFloat(amount).toFixed(2)}` : 'Enter Amount'}
                    </Text>
                    <Icon name="arrow-forward" size={20} color="#FFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.modalFooter}>
              <View style={styles.securityBadge}>
                <Icon name="shield-checkmark" size={16} color="#10B981" />
                <Text style={styles.securityText}>Secure & Encrypted Payment</Text>
              </View>
              <Text style={styles.modalFooterNote}>
                Your money is safe and instantly available for orders
              </Text>
            </View>
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
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  loadingTextWhite: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
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
    top: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
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
  balanceLabelContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceVisibilityHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  balanceVisibilityText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
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
  hiddenBalanceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  hiddenBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 12,
    marginBottom: 8,
  },
  hiddenBalanceText: {
    fontSize: 28,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 6,
  },
  showBalanceText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
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
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  filterScrollContainer: {
    marginBottom: 16,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginRight: 10,
    minWidth: 100,
    position: 'relative',
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
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  filterStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  filterStatsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  filterCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
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
    color: '#6B7280',
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
    color: '#6B7280',
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
    color: '#9CA3AF',
    fontWeight: '600',
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transactionDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  emptyStateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 10,
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
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
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
    borderBottomColor: '#F3F4F6',
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
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 20,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
  },
  modalAmountSection: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  amountLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
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
    marginLeft: 4,
  },
  minimumAmountErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  minimumAmountError: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
    flex: 1,
  },
  quickAmountLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    position: 'relative',
    minWidth: 90,
  },
  quickAmountButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  quickAmountActiveIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  quickAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
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
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  addMoneyButtonDisabled: {
    opacity: 0.6,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  modalFooter: {
    padding: 24,
    paddingTop: 0,
    alignItems: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  securityText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  modalFooterNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadMoreButton: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
});

export default EatoorMoneyScreen;