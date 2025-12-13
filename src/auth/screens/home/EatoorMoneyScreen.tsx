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

  // Fetch wallet data
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      // Fetch wallet balance
      const balanceResponse = await getWalletBalance();
      if (balanceResponse.data) {
        setWalletBalance(parseFloat(balanceResponse.data.balance));
        setIsActive(balanceResponse.data.is_active);
      }

      // Fetch transactions
      const transactionsResponse = await getWalletTransactions();
      if (transactionsResponse.data) {
        const formattedTransactions = transactionsResponse?.data.map(transaction => ({
          id: transaction.id.toString(),
          type: transaction.txn_type, // 'credit' or 'debit'
          amount: parseFloat(transaction.amount),
          description: getTransactionDescription(transaction),
          date: formatDate(transaction.created_at),
          time: formatTime(transaction.created_at),
          category: getTransactionCategory(transaction),
          txn_source: transaction.txn_source,
          status: transaction.status,
          note: transaction.note,
          order_number: transaction.order_number,
          razorpay_payment_id: transaction.razorpay_payment_id,
          created_at: transaction.created_at,
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

  // Helper function to get transaction description
  const getTransactionDescription = (transaction) => {
    if (transaction.order_number) {
      return `Order #${transaction.order_number}`;
    }
    
    switch (transaction.txn_source) {
      case 'add_money':
        return 'Wallet Recharge';
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

  // Helper function to get transaction category
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

  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Helper function to format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Initial load
  useEffect(() => {
    fetchWalletData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  // Handle successful money addition (called from Add Money screen)
  const handleAddMoneySuccess = (amount) => {
    // Refresh data to get latest transactions
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
        return 'fast-food-outline';
      case 'beverage':
        return 'cafe-outline';
      case 'entertainment':
        return 'film-outline';
      case 'dining':
        return 'restaurant-outline';
      case 'grocery':
        return 'cart-outline';
      case 'recharge':
        return 'phone-portrait-outline';
      case 'transfer':
        return 'swap-horizontal-outline';
      case 'cashback':
      case 'bonus':
        return 'gift-outline';
      case 'refund':
        return 'arrow-undo-outline';
      default:
        return 'card-outline';
    }
  };

  const renderTransactionItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.transactionItem}
      activeOpacity={0.7}
      onPress={() => {
        // Show transaction details if needed
        Alert.alert(
          'Transaction Details',
          `Amount: ${item.type === 'credit' ? '+' : '-'}₹${item.amount.toFixed(2)}\n` +
          `Description: ${item.description}\n` +
          `Date: ${item.date}\n` +
          `Time: ${item.time}\n` +
          `Status: ${item.status}\n` +
          `Type: ${item.type === 'credit' ? 'Credit' : 'Debit'}\n` +
          `${item.order_number ? `Order #: ${item.order_number}\n` : ''}` +
          `${item.razorpay_payment_id ? `Payment ID: ${item.razorpay_payment_id}\n` : ''}`
        );
      }}
    >
      <View style={styles.transactionIconContainer}>
        <View style={[
          styles.transactionIcon,
          { backgroundColor: item.type === 'credit' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 107, 53, 0.1)' }
        ]}>
          <Icon 
            name={getCategoryIcon(item.category)} 
            size={22} 
            color={item.type === 'credit' ? '#4CAF50' : '#FF6B35'} 
          />
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <View style={styles.transactionMeta}>
            <View style={styles.transactionDateContainer}>
              <Icon name="calendar-outline" size={12} color="#666" />
              <Text style={styles.transactionDate}> {item.date} • {item.time}</Text>
            </View>
            {item.status && (
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 107, 53, 0.1)' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: item.status === 'success' ? '#4CAF50' : '#FF6B35' }
                ]}>
                  {item.status}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.transactionAmountContainer}>
        <Text style={[
          styles.transactionAmount,
          { color: item.type === 'credit' ? '#4CAF50' : '#FF6B35' }
        ]}>
          {item.type === 'credit' ? '+' : '-'}₹{item.amount.toFixed(2)}
        </Text>
        <View style={[
          styles.transactionTypeBadge,
          { backgroundColor: item.type === 'credit' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 107, 53, 0.1)' }
        ]}>
          <Icon 
            name={item.type === 'credit' ? 'trending-up' : 'trending-down'} 
            size={10} 
            color={item.type === 'credit' ? '#4CAF50' : '#FF6B35'} 
          />
          <Text style={[
            styles.transactionTypeText,
            { color: item.type === 'credit' ? '#4CAF50' : '#FF6B35' }
          ]}>
            {item.type === 'credit' ? 'Credit' : 'Debit'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="receipt-outline" size={80} color="#E0E0E0" />
      <Text style={styles.emptyStateText}>
        {loading ? 'Loading transactions...' : 'No transactions found'}
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
      {/* Balance Section */}
      <View style={styles.balanceContainer}>
        <View style={styles.balanceLabelContainer}>
          <Icon name="wallet-outline" size={22} color="#666" />
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <View style={styles.balanceHeaderRight}>
            {!isActive && (
              <View style={styles.inactiveBadge}>
                <Icon name="warning-outline" size={14} color="#FF6B35" />
                <Text style={styles.inactiveText}>Inactive</Text>
              </View>
            )}
            <TouchableOpacity 
              style={styles.eyeButton}
              onPress={() => setBalanceVisible(!balanceVisible)}
              activeOpacity={0.7}
            >
              <Icon 
                name={balanceVisible ? 'eye-off-outline' : 'eye-outline'} 
                size={22} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.balanceAmountContainer}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.balanceAmount}>
            {balanceVisible ? walletBalance.toFixed(2) : '••••••'}
          </Text>
        </View>
        
        <View style={styles.balanceFooter}>
          <Icon name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.balanceFooterText}>
            {balanceVisible ? 'Your current wallet balance' : 'Tap eye icon to view balance'}
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
        <Icon name="add-circle" size={26} color="#FFFFFF" />
        <Text style={styles.addMoneyButtonText}>Add Money to Wallet</Text>
      </TouchableOpacity>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Icon name="stats-chart" size={20} color="#FF6B35" />
          <Text style={styles.statsTitle}>Transaction Summary</Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 107, 53, 0.1)' }]}>
              <Icon name="swap-horizontal" size={26} color="#FF6B35" />
            </View>
            <Text style={styles.statValue}>{totalTransactions}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
              <Icon name="trending-up" size={26} color="#4CAF50" />
            </View>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>{creditCount}</Text>
            <Text style={styles.statLabel}>Credits</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(244, 67, 54, 0.1)' }]}>
              <Icon name="trending-down" size={26} color="#FF6B35" />
            </View>
            <Text style={[styles.statValue, { color: '#FF6B35' }]}>{debitCount}</Text>
            <Text style={styles.statLabel}>Debits</Text>
          </View>
        </View>
      </View>

      {/* Filter Section */}
      <View style={styles.filterContainer}>
        <View style={styles.filterHeader}>
          <Icon name="filter" size={20} color="#FF6B35" />
          <Text style={styles.filterTitle}>Filter Transactions</Text>
          <Text style={styles.transactionCount}>
            ({filteredTransactions.length} transactions)
          </Text>
        </View>
        <View style={styles.filterButtons}>
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('all')}
            activeOpacity={0.7}
          >
            <Icon 
              name="apps" 
              size={18} 
              color={selectedFilter === 'all' ? '#FFFFFF' : '#666'} 
            />
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
            activeOpacity={0.7}
          >
            <View style={styles.filterButtonContent}>
              <Icon 
                name="trending-up" 
                size={18} 
                color={selectedFilter === 'credit' ? '#FFFFFF' : '#4CAF50'} 
              />
              <Text style={[
                styles.filterButtonText,
                selectedFilter === 'credit' && styles.filterButtonTextActive
              ]}>
                Credit
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'debit' && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter('debit')}
            activeOpacity={0.7}
          >
            <View style={styles.filterButtonContent}>
              <Icon 
                name="trending-down" 
                size={18} 
                color={selectedFilter === 'debit' ? '#FFFFFF' : '#FF6B35'} 
              />
              <Text style={[
                styles.filterButtonText,
                selectedFilter === 'debit' && styles.filterButtonTextActive
              ]}>
                Debit
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFFFFF" 
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="chevron-back" size={28} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Icon name="wallet" size={24} color="#FF6B35" />
          <Text style={styles.headerTitle}>Eatoor Money</Text>
        </View>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => {
            Alert.alert(
              'Wallet Info',
              `Wallet ID: ${transactions[0]?.razorpay_payment_id ? transactions[0].razorpay_payment_id : 'N/A'}\n` +
              `Status: ${isActive ? 'Active' : 'Inactive'}\n` +
              `Total Transactions: ${totalTransactions}`
            );
          }}
          activeOpacity={0.7}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginLeft: 8,
  },
  menuButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  balanceContainer: {
    margin: 16,
    marginTop: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
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
  balanceLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
    marginRight: 'auto',
    fontWeight: '500',
  },
  balanceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  inactiveText: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
    marginLeft: 4,
  },
  eyeButton: {
    padding: 4,
  },
  balanceAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginRight: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000000',
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  balanceFooterText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    marginHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 14,
    marginBottom: 20,
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
  addMoneyButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
  statsCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#E0E0E0',
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
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  transactionCount: {
    marginLeft: 'auto',
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtons: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 6,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
  },
  filterButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  transactionIconContainer: {
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
  transactionDetails: {
    marginLeft: 14,
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transactionDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionDate: {
    fontSize: 13,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  transactionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionTypeText: {
    fontSize: 11,
    fontWeight: '700',
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
  emptyStateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubText: {
    fontSize: 15,
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