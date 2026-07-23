import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  Dimensions,
  Platform,
  RefreshControl,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  getWalletBalance,
  getWalletTransactions,
} from '../../../api/wallet';

const { width } = Dimensions.get('window');

const EatoorMoneyScreen = ({ navigation }) => {
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [animatedValue] = useState(new Animated.Value(0));

  // Animation for balance
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1000,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [walletBalance]);

  // Fetch wallet data
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const balanceResponse = await getWalletBalance();
      if (balanceResponse.data) {
        setWalletBalance(parseFloat(balanceResponse.data.balance));
        setIsActive(balanceResponse.data.is_active);
      }

      const transactionsResponse = await getWalletTransactions();
      if (transactionsResponse.data) {
        const formattedTransactions = transactionsResponse.data.map(transaction => ({
          id: transaction.id.toString(),
          type: transaction.txn_type,
          amount: parseFloat(transaction.amount),
          description: getTransactionDescription(transaction),
          date: formatDate(transaction.created_at),
          time: formatTime(transaction.created_at),
          category: getTransactionCategory(transaction),
          txn_source: transaction.txn_source,
          status: transaction.status || 'success',
          note: transaction.note,
          order_number: transaction.order_number,
          razorpay_payment_id: transaction.razorpay_payment_id,
          created_at: transaction.created_at,
          balance_before: parseFloat(transaction.balance_before),
          balance_after: parseFloat(transaction.balance_after),
        }));
        setTransactions(formattedTransactions);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionDescription = (transaction) => {
    if (transaction.order_number) {
      return `Order #${transaction.order_number}`;
    }
    
    switch (transaction.txn_source) {
      case 'add_money':
        return transaction.note || 'Wallet Recharge';
      case 'order_payment':
        return transaction.order_number ? `Order #${transaction.order_number}` : 'Order Payment';
      case 'refund':
        return 'Refund';
      case 'cashback':
        return 'Cashback Offer';
      case 'bonus':
        return 'Bonus';
      case 'referral':
        return 'Referral Bonus';
      default:
        return transaction.note || 'Transaction';
    }
  };

  const getTransactionCategory = (transaction) => {
    switch (transaction.txn_source) {
      case 'add_money':
        return 'recharge';
      case 'order_payment':
        return 'food';
      case 'refund':
        return 'refund';
      case 'cashback':
        return 'cashback';
      case 'bonus':
      case 'referral':
        return 'bonus';
      default:
        return 'other';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  const handleAddMoneySuccess = (amount) => {
    fetchWalletData();
  };

  const totalTransactions = transactions.length;
  const creditCount = transactions.filter(t => t.type === 'credit').length;
  const debitCount = transactions.filter(t => t.type === 'debit').length;

  const filteredTransactions = selectedFilter === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === selectedFilter);

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'food':
        return 'restaurant-outline';
      case 'recharge':
        return 'cash-outline';
      case 'refund':
        return 'refresh-outline';
      case 'cashback':
      case 'bonus':
        return 'gift-outline';
      default:
        return 'card-outline';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'success':
        return '#4CAF50';
      case 'pending':
        return '#FFA726';
      case 'failed':
        return '#EF5350';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'success':
        return 'checkmark-circle';
      case 'pending':
        return 'time-outline';
      case 'failed':
        return 'close-circle';
      default:
        return 'alert-circle';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'success':
        return 'Success';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  const getStatusBackground = (status) => {
    switch(status) {
      case 'success':
        return 'rgba(76, 175, 80, 0.12)';
      case 'pending':
        return 'rgba(255, 167, 38, 0.12)';
      case 'failed':
        return 'rgba(239, 83, 80, 0.12)';
      default:
        return 'rgba(153, 153, 153, 0.12)';
    }
  };

  const renderTransactionItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const statusBg = getStatusBackground(item.status);

    return (
      <TouchableOpacity 
        style={styles.transactionItem}
        activeOpacity={0.7}
        onPress={() => {
          Alert.alert(
            'Transaction Details',
            `Amount: ${item.type === 'credit' ? '+' : '-'}₹${item.amount.toFixed(2)}\n` +
            `Description: ${item.description}\n` +
            `Date: ${item.date} ${item.time}\n` +
            `Status: ${getStatusText(item.status)}\n` +
            `Type: ${item.type === 'credit' ? 'Credit' : 'Debit'}\n` +
            `${item.order_number ? `Order #: ${item.order_number}\n` : ''}` +
            `${item.razorpay_payment_id ? `Payment ID: ${item.razorpay_payment_id}\n` : ''}` +
            `Balance Before: ₹${item.balance_before?.toFixed(2) || 'N/A'}\n` +
            `Balance After: ₹${item.balance_after?.toFixed(2) || 'N/A'}`
          );
        }}
      >
        <View style={styles.transactionLeft}>
          <View style={[
            styles.transactionIcon,
            { backgroundColor: item.type === 'credit' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(239, 83, 80, 0.15)' }
          ]}>
            <Icon 
              name={getCategoryIcon(item.category)} 
              size={22} 
              color={item.type === 'credit' ? '#4CAF50' : '#EF5350'} 
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={styles.transactionMeta}>
              <Icon name="calendar-outline" size={12} color="#999" />
              <Text style={styles.transactionDate}> {item.date}</Text>
              <Text style={styles.transactionDot}>•</Text>
              <Icon name="time-outline" size={12} color="#999" />
              <Text style={styles.transactionTime}> {item.time}</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.transactionRight}>
          <Text style={[
            styles.transactionAmount,
            { color: item.type === 'credit' ? '#4CAF50' : '#EF5350' }
          ]}>
            {item.type === 'credit' ? '+' : '-'}₹{item.amount.toFixed(2)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Icon name={statusIcon} size={12} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Icon name="receipt-outline" size={80} color="#E0E0E0" />
      </View>
      <Text style={styles.emptyStateText}>
        {loading ? 'Loading transactions...' : 'No transactions yet'}
      </Text>
      <Text style={styles.emptyStateSubText}>
        {selectedFilter === 'all' 
          ? 'Start using your wallet to see transactions here' 
          : `No ${selectedFilter} transactions found`}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <View style={styles.balanceTitleContainer}>
            <View style={styles.balanceIconContainer}>
              <Icon name="wallet-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
          </View>
          <View style={styles.balanceActions}>
            {!isActive && (
              <View style={styles.inactiveBadge}>
                <Icon name="warning-outline" size={14} color="#FF6B35" />
                <Text style={styles.inactiveText}>Inactive</Text>
              </View>
            )}
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setBalanceVisible(!balanceVisible)}
            >
              <Icon 
                name={balanceVisible ? 'eye-off-outline' : 'eye-outline'} 
                size={24} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <Animated.View style={[
          styles.balanceAmountContainer,
          {
            opacity: animatedValue,
            transform: [{
              scale: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1]
              })
            }]
          }
        ]}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.balanceAmount}>
            {balanceVisible ? walletBalance.toFixed(2) : '••••••'}
          </Text>
        </Animated.View>
        
        <View style={styles.balanceFooter}>
          <Icon name="shield-checkmark-outline" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.balanceFooterText}>
            {balanceVisible ? 'Balance is secure and up to date' : 'Tap 👁️ to view balance'}
          </Text>
        </View>
      </View>

      {/* Add Money Button */}
      <TouchableOpacity 
        style={styles.addMoneyButton}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('EatoorMoneyAdd', {
          currentBalance: walletBalance,
          onAddMoney: handleAddMoneySuccess
        })}
      >
        <View style={styles.addMoneyContent}>
          <Icon name="add-circle" size={26} color="#FFFFFF" />
          <Text style={styles.addMoneyButtonText}>Add Money to Wallet</Text>
          <Icon name="chevron-forward" size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#FFF5F0' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(255, 107, 53, 0.15)' }]}>
            <Icon name="swap-horizontal" size={24} color="#FF6B35" />
          </View>
          <Text style={styles.statValue}>{totalTransactions}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#F0FFF4' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
            <Icon name="trending-up" size={24} color="#4CAF50" />
          </View>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>{creditCount}</Text>
          <Text style={styles.statLabel}>Credits</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#FFF0F0' }]}>
          <View style={[styles.statIconContainer, { backgroundColor: 'rgba(239, 83, 80, 0.15)' }]}>
            <Icon name="trending-down" size={24} color="#EF5350" />
          </View>
          <Text style={[styles.statValue, { color: '#EF5350' }]}>{debitCount}</Text>
          <Text style={styles.statLabel}>Debits</Text>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterContainer}>
        <View style={styles.filterHeader}>
          <View style={styles.filterTitleContainer}>
            <Icon name="filter-outline" size={20} color="#FF6B35" />
            <Text style={styles.filterTitle}>Transactions</Text>
          </View>
          <Text style={styles.transactionCount}>
            {filteredTransactions.length}
          </Text>
        </View>
        
        <View style={styles.filterButtons}>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'all' && styles.filterButtonTextActive
            ]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'credit' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('credit')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'credit' && styles.filterButtonTextActive
            ]}>
              Credit
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'debit' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('debit')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'debit' && styles.filterButtonTextActive
            ]}>
              Debit
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#F8F9FA" 
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eatoor Money</Text>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              'Wallet Summary',
              `Status: ${isActive ? '🟢 Active' : '🔴 Inactive'}\n` +
              `Balance: ₹${walletBalance.toFixed(2)}\n` +
              `Total Transactions: ${totalTransactions}`
            );
          }}
        >
          <Icon name="ellipsis-vertical" size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={<View style={styles.footer} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  menuButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  balanceCard: {
    margin: 16,
    marginTop: 20,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 10,
    fontWeight: '500',
  },
  balanceActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  inactiveText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  eyeButton: {
    padding: 4,
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  balanceFooterText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  addMoneyButton: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FF6B35',
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
  addMoneyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  addMoneyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  transactionCount: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '700',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    marginLeft: 14,
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
    marginRight: 4,
  },
  transactionDot: {
    fontSize: 12,
    color: '#999',
    marginHorizontal: 4,
  },
  transactionTime: {
    fontSize: 12,
    color: '#999',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  separator: {
    height: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  footer: {
    height: 30,
  },
});

export default EatoorMoneyScreen;