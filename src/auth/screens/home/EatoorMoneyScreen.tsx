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
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

// Food delivery specific transaction data
const initialTransactions = [
  {
    id: '1',
    title: 'Food Order Payment',
    amount: -450.00,
    type: 'deduction',
    date: 'Today',
    time: '14:30',
    description: 'Dominos Pizza - Order #12345',
    category: 'Food & Dining',
    icon: 'fast-food',
    color: '#FF6B35',
    restaurant: 'Dominos Pizza',
    orderId: '#12345'
  },
  {
    id: '2',
    title: 'Wallet Top-up',
    amount: 1000.00,
    type: 'addition',
    date: 'Today',
    time: '10:15',
    description: 'Added via Credit Card',
    category: 'Top-up',
    icon: 'card',
    color: '#4CAF50',
  },
  {
    id: '3',
    title: 'Bonus Received',
    amount: 250.00,
    type: 'bonus',
    date: 'Yesterday',
    time: '16:45',
    description: 'Referral Program Bonus',
    category: 'Rewards',
    icon: 'gift',
    color: '#9C27B0',
  },
  {
    id: '4',
    title: 'Grocery Shopping',
    amount: -1200.50,
    type: 'deduction',
    date: 'Jan 12',
    time: '19:20',
    description: 'Big Bazaar - Monthly groceries',
    category: 'Shopping',
    icon: 'cart',
    color: '#2196F3',
    restaurant: 'Big Bazaar'
  },
  {
    id: '5',
    title: 'Refund Received',
    amount: 320.00,
    type: 'refund',
    date: 'Jan 11',
    time: '11:30',
    description: 'Order cancellation refund',
    category: 'Refund',
    icon: 'refresh',
    color: '#FF9800',
    restaurant: 'KFC'
  },
  {
    id: '6',
    title: 'Food Order Payment',
    amount: -325.00,
    type: 'deduction',
    date: 'Jan 10',
    time: '20:15',
    description: 'McDonald\'s - Order #12346',
    category: 'Food & Dining',
    icon: 'fast-food',
    color: '#FF6B35',
    restaurant: 'McDonald\'s'
  },
];

const quickActions = [
  { id: 'add_money', label: 'Add Money', icon: 'add-circle', color: '#FF6B35', gradient: ['#FF6B35', '#FF8E53'] },
  { id: 'send_money', label: 'Send Money', icon: 'paper-plane', color: '#2196F3', gradient: ['#2196F3', '#64B5F6'] },
  { id: 'pay_bills', label: 'Pay Bills', icon: 'receipt', color: '#4CAF50', gradient: ['#4CAF50', '#81C784'] },
  { id: 'scan_qr', label: 'Scan & Pay', icon: 'qr-code', color: '#9C27B0', gradient: ['#9C27B0', '#BA68C8'] },
  { id: 'food_orders', label: 'My Orders', icon: 'restaurant', color: '#FF9800', gradient: ['#FF9800', '#FFB74D'] },
];

const transactionFilters = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'addition', label: 'Income', icon: 'trending-up' },
  { id: 'deduction', label: 'Expense', icon: 'trending-down' },
  { id: 'bonus', label: 'Rewards', icon: 'gift' },
  { id: 'refund', label: 'Refunds', icon: 'refresh' },
];

const paymentMethods = [
  { id: 'upi', label: 'UPI', icon: 'phone-portrait', color: '#2196F3', popular: true },
  { id: 'card', label: 'Card', icon: 'card', color: '#FF6B35' },
  { id: 'netbanking', label: 'Net Banking', icon: 'business', color: '#4CAF50' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet', color: '#9C27B0' },
];

const EatoorMoneyScreen = ({ navigation }) => {
  // State Management
  const [balance, setBalance] = useState(2564.75);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [addMoneyModalVisible, setAddMoneyModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [amount, setAmount] = useState('');
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  
  // Refs
  const backPressTimer = useRef(null);
  const isProcessingBackPress = useRef(false);
  const modalClosingRef = useRef(false);

  // Animation Values
  const scrollY = useRef(new Animated.Value(0)).current;
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
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 80, 150],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // BackHandler for Android
  // useEffect(() => {
  //   const backAction = () => {
  //     handleBackPress();
  //     return true; // Prevent default behavior
  //   };

  //   const backHandler = BackHandler.addEventListener(
  //     'hardwareBackPress',
  //     backAction
  //   );

  //   return () => {
  //     if (backPressTimer.current) {
  //       clearTimeout(backPressTimer.current);
  //     }
  //     backHandler.remove();
  //   };
  // }, []);

  const handleBackPress = () => {
    console.log("====")
    navigation.navigate('ProfileScreen');
  };

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

  // Filtered transactions
  const filteredTransactions = transactions.filter(transaction => {
    return selectedFilter === 'all' || transaction.type === selectedFilter;
  });

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${Math.abs(amount).toFixed(2)}`;
  };

  // Handle back navigation - SIMPLIFIED AND FIXED
  // const handleBackPress = () => {
  //   // Prevent multiple rapid clicks
  //   if (isProcessingBackPress.current || modalClosingRef.current) {
  //     return;
  //   }

  //   isProcessingBackPress.current = true;

  //   // If modal is open, close it
  //   if (addMoneyModalVisible) {
  //     modalClosingRef.current = true;
  //     closeAddMoneyModal(() => {
  //       // Reset flags after modal is closed
  //       setTimeout(() => {
  //         isProcessingBackPress.current = false;
  //         modalClosingRef.current = false;
  //       }, 300);
  //     });
  //   } else {
  //     // Navigate back if modal is not open
  //     if (navigation && navigation.goBack) {
  //       // Reset flag after navigation
  //       backPressTimer.current = setTimeout(() => {
  //         isProcessingBackPress.current = false;
  //       }, 500);
        
  //       navigation.goBack();
  //     } else {
  //       // Reset flag if no navigation
  //       isProcessingBackPress.current = false;
  //     }
  //   }
  // };

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
    // Remove any non-numeric characters except decimal point
    const cleanedText = text.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = cleanedText.split('.');
    if (parts.length > 2) {
      // If more than one decimal point, keep only the first one
      setAmount(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setAmount(cleanedText);
    }
  };

  // Handle Add Money with validation
  const handleAddMoney = () => {
    // Check if amount is empty
    if (!amount || amount.trim() === '') {
      Alert.alert('Invalid Amount', 'Please enter an amount');
      return;
    }

    // Convert to number
    const newAmount = parseFloat(amount);
    
    // Check if it's a valid number
    if (isNaN(newAmount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    // Check minimum amount (₹100)
    if (newAmount < 100) {
      Alert.alert('Minimum Amount Required', 'Please add at least ₹100');
      return;
    }

    // Check maximum amount (optional)
    if (newAmount > 100000) {
      Alert.alert('Maximum Limit Exceeded', 'Cannot add more than ₹1,00,000 at once');
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      title: 'Wallet Top-up',
      amount: newAmount,
      type: 'addition',
      date: 'Just now',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `Added via ${paymentMethods.find(m => m.id === selectedPaymentMethod)?.label}`,
      category: 'Top-up',
      icon: 'add-circle',
      color: '#4CAF50',
    };

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

    setBalance(prev => prev + newAmount);
    setTransactions([newTransaction, ...transactions]);
    closeAddMoneyModal();

    // Show success animation
    Alert.alert('Success!', `₹${newAmount.toFixed(2)} added successfully 🎉`, [
      { text: 'Awesome!', style: 'cancel' }
    ]);
  };

  // Render transaction item
  const renderTransactionItem = ({ item, index }) => {
    const isPositive = item.amount >= 0;
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
              {item.restaurant && (
                <View style={styles.restaurantBadge}>
                  <Icon name="restaurant" size={12} color="#666" />
                  <Text style={styles.restaurantText}>{item.restaurant}</Text>
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
                {item.category}
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
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8E53']}
                  style={styles.addMoneyButtonSmallGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Icon name="add" size={18} color="#FFF" />
                  <Text style={styles.addMoneyButtonSmallText}>Add Money</Text>
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
            <FlatList
              data={filteredTransactions}
              renderItem={renderTransactionItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.transactionsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Icon name="receipt-outline" size={64} color="#E0E0E0" />
              <Text style={styles.emptyStateTitle}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Start ordering food to see transactions here
              </Text>
              <TouchableOpacity style={styles.emptyStateButton} onPress={openAddMoneyModal}>
                <Text style={styles.emptyStateButtonText}>Add Money Now</Text>
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
        >
          <LinearGradient
            colors={['#FF6B35', '#FF8E53']}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="add" size={28} color="#FFF" />
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
                    if (!modalClosingRef.current) {
                      closeAddMoneyModal();
                    }
                  }} 
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}
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
                  autoFocus
                  maxLength={10}
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
                (!amount || parseFloat(amount) < 100) && styles.addMoneyButtonDisabled
              ]}
              onPress={handleAddMoney}
              activeOpacity={0.8}
              disabled={!amount || parseFloat(amount) < 100}
            >
              <LinearGradient
                colors={(!amount || parseFloat(amount) < 100) ? ['#CCCCCC', '#999999'] : ['#FF6B35', '#FF8E53']}
                style={styles.addMoneyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Icon name="wallet" size={22} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.addMoneyButtonText}>
                  {amount ? `Add ₹${parseFloat(amount).toFixed(2)}` : 'Enter Amount'}
                </Text>
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
  headerTitleFixed: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
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
});

export default EatoorMoneyScreen;