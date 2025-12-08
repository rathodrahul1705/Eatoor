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
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import {
  getWalletBalance,
  createWalletOrder,
  walletAddMoneySuccess,
  getWalletTransactions,
} from '../../../api/wallet';
import { useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Constants
const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;
const TRANSACTION_FILTERS = [
  { id: 'all', label: 'All', icon: 'grid-outline' },
  { id: 'credit', label: 'Credits', icon: 'trending-up-outline' },
  { id: 'debit', label: 'Debits', icon: 'trending-down-outline' },
];

// Helper functions
const mapTransactionType = (txn_type) => {
  const mapping = {
    credit: { type: 'addition', label: 'Credit', icon: 'add-circle', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' },
    debit: { type: 'deduction', label: 'Debit', icon: 'remove-circle', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
  };
  return mapping[txn_type] || { type: 'addition', label: 'Other', icon: 'help-circle', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' };
};

const mapTransactionSource = (txn_source) => {
  const mapping = {
    add_money: { category: 'Wallet Top-up', description: 'Money Added', icon: 'wallet-outline' },
    order_payment: { category: 'Order Payment', description: 'Food Order', icon: 'restaurant-outline' },
    refund: { category: 'Refund', description: 'Order Refund', icon: 'arrow-back-outline' },
    referral: { category: 'Referral Bonus', description: 'Referral Reward', icon: 'gift-outline' },
    cashback: { category: 'Cashback', description: 'Reward Cashback', icon: 'cash-outline' },
  };
  return mapping[txn_source] || { category: 'Transaction', description: 'Wallet Transaction', icon: 'swap-horizontal-outline' };
};

const formatTransactionDate = (created_at) => {
  const date = new Date(created_at);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatAmount = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const EatoorMoneyScreen = ({ navigation }) => {
  // State Management
  const route = useRoute();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [addMoneyModalVisible, setAddMoneyModalVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [user, setUser] = useState({
    name: '',
    email: '',
    contact: '',
    id: '',
  });
  const [refreshing, setRefreshing] = useState(false);
  
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
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 150],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.95],
    extrapolate: 'clamp',
  });

  // Fetch user data from AsyncStorage
  const fetchUserData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        
        const userDetails = {
          name: parsedUser.full_name || parsedUser.name || 'Eatoor User',
          email: parsedUser.email || 'user@example.com',
          contact: parsedUser.contact_number || parsedUser.phone || parsedUser.mobile || '9999999999',
          id: parsedUser.id || parsedUser.user_id || '',
          avatar: parsedUser.avatar || parsedUser.profile_image || null,
        };
        
        setUser(userDetails);
        
        if (parsedUser.wallet_balance !== undefined) {
          setBalance(parseFloat(parsedUser.wallet_balance));
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser({
        name: 'Eatoor User',
        email: 'user@example.com',
        contact: '9999999999',
        id: '',
      });
    }
  }, []);

  // Toggle balance visibility with animation
  const toggleBalanceVisibility = useCallback(() => {
    Animated.sequence([
      Animated.timing(eyeScaleAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(eyeScaleAnim, {
        toValue: 1,
        duration: 100,
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
        icon: sourceInfo.icon || typeInfo.icon,
        color: typeInfo.color,
        bgColor: typeInfo.bgColor,
        orderId: transaction.order_number,
        status: transaction.status,
        created_at: transaction.created_at,
        fullDate: date,
      };
    });
  }, []);

  // Load wallet data
  const fetchWalletData = useCallback(async (isRefresh = false) => {
    if (!isMounted.current) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const balanceResponse = await getWalletBalance();
      
      if (balanceResponse.data?.balance) {
        setBalance(parseFloat(balanceResponse.data.balance));
        
        const processedTransactions = processTransactionData(
          balanceResponse.data.transactions
        );
        
        setTransactions(processedTransactions);
        setCurrentPage(1);
        setHasMore(true);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Oops!', 'Failed to load wallet data. Please try again.');
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [processTransactionData]);

  // Initial load
  useEffect(() => {
    fetchWalletData();
    fetchUserData();
  }, [fetchWalletData, fetchUserData]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    fetchWalletData(true);
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
        setTransactions(prev => [...prev, ...newTransactions]);
        setCurrentPage(nextPage);
        setHasMore(response.data.next !== null);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      if (isMounted.current) {
        setLoadingMore(false);
      }
    }
  }, [loadingMore, hasMore, currentPage, processTransactionData]);

  // Filtered transactions
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
  const openAddMoneyModal = useCallback(async () => {
    if (!user.email || !user.contact) {
      await fetchUserData();
    }
    
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
  }, [user, fetchUserData]);

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
    const cleanedText = text.replace(/[^0-9.]/g, '');
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
      return { isValid: false, message: `Maximum amount is ₹${MAX_AMOUNT.toLocaleString()}` };
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
      
      if (!user.email || !user.contact) {
        await fetchUserData();
      }

      const orderResponse = await createWalletOrder({ 
        amount: validation.amount,
        user_id: user.id,
        user_email: user.email,
        user_name: user.name,
      });
      const orderData = orderResponse.data;
      
      if (!orderData.order_id) {
        throw new Error('Failed to create payment order');
      }
      
      const razorpayOptions = {
        description: 'Add Eatoor Money',
        image: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png',
        currency: 'INR',
        key: orderData.key || 'rzp_test_Ler2HqmO4lVND1',
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
      };

      const razorpayResponse = await RazorpayCheckout.open(razorpayOptions);
      
      if (razorpayResponse) {
        const successPayload = {
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          amount: validation.amount,
        };

        const verificationResponse = await walletAddMoneySuccess(successPayload);

        if (verificationResponse.status === 200) {
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

          await fetchWalletData();
          closeAddMoneyModal();

          Alert.alert(
            'Success! 🎉',
            `₹${validation.amount.toFixed(2)} added to your wallet`,
            [{ text: 'Awesome!', style: 'cancel' }]
          );

          if (route?.params?.prevScreen === "CartScreen") {
            navigation.navigate(route.params.prevScreen);
          }
        } else {
          throw new Error('Payment verification failed');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      
      if (error.code === 2) {
        Alert.alert('Payment Cancelled', 'Payment was cancelled');
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
  }, [amount, validateAmount, fetchWalletData, closeAddMoneyModal, user, fetchUserData]);

  // Render transaction item
  const renderTransactionItem = useCallback(({ item, index }) => {
    const isCredit = item.txn_type === 'credit';
    console.log("filteredTransactions===",item)
    return (
      <TouchableOpacity
        style={styles.transactionCard}
        activeOpacity={0.7}
      >
        <View style={[styles.transactionIconContainer, { backgroundColor: item.bgColor }]}>
          <Icon name={item.icon} size={18} color={item.color} />
        </View>
        
        <View style={styles.transactionContent}>
          <View style={styles.transactionHeader}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.transactionDescription} numberOfLines={1}>
                {item.description} | {item.orderId}
              </Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={[
                styles.transactionAmount,
                { color: isCredit ? '#10B981' : '#EF4444' }
              ]}>
                {isCredit ? '+' : '-'} {formatAmount(item.amount)}
              </Text>
            </View>
          </View>
          
          <View style={styles.transactionFooter}>
            <View style={styles.transactionMeta}>
              <Icon name="time-outline" size={12} color="#9CA3AF" />
              <Text style={styles.transactionTime}>
                {item.time} • {item.date}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.color + '15' }]}>
              <Text style={[styles.statusText, { color: item.color }]}>
                {item.status === 'success' ? '✓' : item.status}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
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
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonBackButton} />
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonEyeButton} />
        </View>
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonBalance} />
          <View style={styles.skeletonStats}>
            <View style={styles.skeletonStat} />
            <View style={styles.skeletonStat} />
            <View style={styles.skeletonStat} />
          </View>
          <View style={styles.skeletonTransactions}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonTransaction} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />
      
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.8}
          >
            <Icon name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Eatoor Money</Text>
          <TouchableOpacity 
            style={styles.eyeButton}
            onPress={toggleBalanceVisibility}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ scale: eyeScaleAnim }] }}>
              <Icon 
                name={isBalanceVisible ? 'eye-off-outline' : 'eye-outline'} 
                size={20} 
                color="#FFF" 
              />
            </Animated.View>
          </TouchableOpacity>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Animated Balance Section */}
        <Animated.View style={[
          styles.balanceContainer,
          {
            opacity: headerOpacity,
            transform: [
              { scale: headerScale }
            ],
          },
        ]}>
          <LinearGradient
            colors={['#FF6B35', '#FF8E53']}
            style={styles.balanceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            
            {isBalanceVisible ? (
              <Animated.View
                style={[
                  styles.visibleBalance,
                  {
                    transform: [
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }
                    ]
                  }
                ]}
              >
                <Text style={styles.balanceAmount}>
                  {formatAmount(balance)}
                </Text>
                <Text style={styles.balanceSubtitle}>
                  Available to spend on Eatoor
                </Text>
              </Animated.View>
            ) : (
              <TouchableOpacity 
                onPress={toggleBalanceVisibility}
                activeOpacity={0.9}
                style={styles.hiddenBalance}
              >
                <View style={styles.hiddenBalanceRow}>
                  <Icon name="lock-closed" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.hiddenBalanceText}>●●●●●</Text>
                </View>
                <Text style={styles.showBalanceHint}>Tap to reveal balance</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Quick Action Button */}
        <View style={styles.quickActionContainer}>
          <TouchableOpacity 
            style={styles.addMoneyButton}
            onPress={openAddMoneyModal}
            activeOpacity={0.8}
            disabled={processingPayment}
          >
            <LinearGradient
              colors={['#FF6B35', '#FF8E53']}
              style={styles.addMoneyGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {processingPayment ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon name="add-circle" size={20} color="#FFF" />
                  <Text style={styles.addMoneyText}>Add Money</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              <Icon name="swap-horizontal" size={16} color="#FF6B35" />
            </View>
            <Text style={styles.statValue}>{transactions.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Icon name="trending-up" size={16} color="#10B981" />
            </View>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              {transactions.filter(t => t.txn_type === 'credit').length}
            </Text>
            <Text style={styles.statLabel}>Credits</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Icon name="trending-down" size={16} color="#EF4444" />
            </View>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              {transactions.filter(t => t.txn_type === 'debit').length}
            </Text>
            <Text style={styles.statLabel}>Debits</Text>
          </View>
        </View>

        {/* Transaction Section */}
        <View style={styles.transactionSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="time-outline" size={20} color="#374151" />
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
            </View>
            
            {/* Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterContainer}
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
                    size={14}
                    color={selectedFilter === filter.id ? '#FFF' : '#6B7280'}
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
                  <Text style={styles.loadMoreText}>Load More</Text>
                  <Icon name="chevron-down" size={14} color="#666" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Icon name="receipt-outline" size={48} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyStateTitle}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {selectedFilter !== 'all' 
                  ? `No ${selectedFilter} transactions found`
                  : 'Make your first transaction to get started!'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Bottom Spacer */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button */}
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
            <Icon name="add" size={24} color="#FFF" />
          )}
        </LinearGradient>
      </TouchableOpacity>

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
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <View style={styles.modalTitleRow}>
                  <View style={styles.modalIcon}>
                    <Icon name="wallet" size={20} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Add Money</Text>
                    <Text style={styles.modalSubtitle}>Secure & Instant</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  onPress={() => !processingPayment && closeAddMoneyModal()} 
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
                  disabled={processingPayment}
                >
                  <Icon name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Amount Section */}
            <View style={styles.modalAmountSection}>
              <Text style={styles.amountLabel}>Enter Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  value={amount}
                  onChangeText={validateAmountInput}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9CA3AF"
                  autoFocus={!processingPayment}
                  maxLength={10}
                  editable={!processingPayment}
                />
              </View>
              
              {amount && parseFloat(amount) < MIN_AMOUNT ? (
                <View style={styles.amountError}>
                  <Icon name="alert-circle" size={14} color="#EF4444" />
                  <Text style={styles.amountErrorText}>
                    Minimum amount: ₹{MIN_AMOUNT}
                  </Text>
                </View>
              ) : (
                <Text style={styles.amountHint}>
                  Enter ₹{MIN_AMOUNT} - ₹{MAX_AMOUNT.toLocaleString()}
                </Text>
              )}

              {/* Quick Amounts */}
              <Text style={styles.quickAmountLabel}>Quick Add</Text>
              <View style={styles.quickAmountsRow}>
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

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.payButton,
                (!amount || parseFloat(amount) < MIN_AMOUNT || processingPayment) && 
                styles.payButtonDisabled
              ]}
              onPress={handleAddMoney}
              activeOpacity={0.8}
              disabled={!amount || parseFloat(amount) < MIN_AMOUNT || processingPayment}
            >
              <LinearGradient
                colors={(!amount || parseFloat(amount) < MIN_AMOUNT || processingPayment) 
                  ? ['#E5E7EB', '#9CA3AF'] 
                  : ['#FF6B35', '#FF8E53']}
                style={styles.payButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {processingPayment ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.payButtonText}>Processing...</Text>
                  </>
                ) : (
                  <>
                    <Icon name="lock-closed" size={16} color="#FFF" />
                    <Text style={styles.payButtonText}>
                      {amount ? `Add ₹${parseFloat(amount).toLocaleString('en-IN')}` : 'Enter Amount'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
            
            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <View style={styles.securityInfo}>
                <Icon name="shield-checkmark" size={14} color="#10B981" />
                <Text style={styles.securityText}>Secure Payment</Text>
              </View>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FF6B35',
    paddingTop: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight + 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  eyeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  balanceContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  balanceGradient: {
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  visibleBalance: {
    alignItems: 'flex-start',
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  balanceSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  hiddenBalance: {
    alignItems: 'flex-start',
  },
  hiddenBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  hiddenBalanceText: {
    fontSize: 28,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 4,
  },
  showBalanceHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  quickActionContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  addMoneyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  addMoneyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  addMoneyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
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
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  transactionSection: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    minHeight: height * 0.4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  filterContainer: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  transactionsList: {
    paddingHorizontal: 16,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  transactionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
    marginRight: 12,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transactionTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
  },
  modalAmountSection: {
    padding: 20,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
    marginBottom: 8,
    paddingVertical: 8,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    padding: 0,
  },
  amountError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
  },
  amountErrorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  amountHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    marginBottom: 20,
  },
  quickAmountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAmountButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minWidth: 90,
  },
  quickAmountButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
  },
  quickAmountTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  payButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  modalFooter: {
    padding: 20,
    paddingTop: 0,
    alignItems: 'center',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  loadMoreButton: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Skeleton styles
  skeletonHeader: {
    backgroundColor: '#FF6B35',
    paddingTop: Platform.OS === 'ios' ? 10 : StatusBar.currentHeight + 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skeletonTitle: {
    width: 120,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skeletonEyeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  skeletonContent: {
    flex: 1,
    padding: 16,
  },
  skeletonBalance: {
    height: 120,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 20,
    opacity: 0.8,
  },
  skeletonStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  skeletonStat: {
    flex: 1,
    height: 80,
    backgroundColor: '#FFF',
    borderRadius: 16,
    opacity: 0.8,
  },
  skeletonTransactions: {
    gap: 12,
  },
  skeletonTransaction: {
    height: 80,
    backgroundColor: '#FFF',
    borderRadius: 16,
    opacity: 0.8,
  },
});

export default EatoorMoneyScreen;