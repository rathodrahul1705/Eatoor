import React, { useState, useRef } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

// Initial transaction data
const initialTransactions = [
  {
    id: '1',
    title: 'Food Order Payment',
    amount: -450.00,
    type: 'deduction',
    date: '2024-01-15',
    time: '14:30',
    description: 'Payment for order #12345',
    category: 'Food',
  },
  {
    id: '2',
    title: 'Wallet Top-up',
    amount: 1000.00,
    type: 'addition',
    date: '2024-01-14',
    time: '10:15',
    description: 'Added via Credit Card',
    category: 'Top-up',
  },
  {
    id: '3',
    title: 'Order Refund',
    amount: 250.00,
    type: 'refund',
    date: '2024-01-13',
    time: '16:45',
    description: 'Refund for cancelled order',
    category: 'Refund',
  },
  {
    id: '4',
    title: 'Bonus Credit',
    amount: 100.00,
    type: 'addition',
    date: '2024-01-12',
    time: '09:00',
    description: 'Referral bonus',
    category: 'Bonus',
  },
  {
    id: '5',
    title: 'Restaurant Payment',
    amount: -320.50,
    type: 'deduction',
    date: '2024-01-11',
    time: '19:20',
    description: 'Payment for order #12344',
    category: 'Food',
  },
  {
    id: '6',
    title: 'Credit Expired',
    amount: -50.00,
    type: 'expired',
    date: '2024-01-10',
    time: '23:59',
    description: 'Promotional credit expiry',
    category: 'Expiry',
  },
];

const transactionTypes = [
  { id: 'all', label: 'All', icon: 'list-outline' },
  { id: 'addition', label: 'Additions', icon: 'add-circle-outline' },
  { id: 'deduction', label: 'Deductions', icon: 'remove-circle-outline' },
  { id: 'refund', label: 'Refunds', icon: 'refresh-outline' },
  { id: 'expired', label: 'Expired', icon: 'time-outline' },
];

const operationButtons = [
  { id: 'add_money', label: 'Add Money', icon: 'add-circle', color: '#4CAF50' },
];

const EatoorMoneyScreen = () => {
  // State Management
  const [balance, setBalance] = useState(2564.75);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'stats'
  const [fadeAnim] = useState(new Animated.Value(0));
  const scrollViewRef = useRef(null);

  // Modal State
  const [transactionData, setTransactionData] = useState({
    type: 'deduction',
    amount: '',
    title: '',
    description: '',
    category: '',
  });

  // Filtered transactions
  const filteredTransactions = transactions.filter(transaction => {
    const matchesFilter = selectedFilter === 'all' || transaction.type === selectedFilter;
    const matchesSearch = transaction.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         transaction.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Stats calculation
  const stats = {
    totalAdded: transactions.filter(t => t.type === 'addition').reduce((sum, t) => sum + t.amount, 0),
    totalSpent: Math.abs(transactions.filter(t => t.type === 'deduction').reduce((sum, t) => sum + t.amount, 0)),
    totalRefunded: transactions.filter(t => t.type === 'refund').reduce((sum, t) => sum + t.amount, 0),
    totalExpired: Math.abs(transactions.filter(t => t.type === 'expired').reduce((sum, t) => sum + t.amount, 0)),
  };

  // Format currency
  const formatCurrency = (amount) => {
    return `₹${Math.abs(amount).toFixed(2)}`;
  };

  // Get transaction icon
  const getTransactionIcon = (type) => {
    switch (type) {
      case 'addition': return 'add-circle';
      case 'deduction': return 'remove-circle';
      case 'refund': return 'refresh';
      case 'expired': return 'time';
      default: return 'receipt';
    }
  };

  // Get transaction color
  const getTransactionColor = (type) => {
    switch (type) {
      case 'addition': return '#4CAF50';
      case 'deduction': return '#F44336';
      case 'refund': return '#2196F3';
      case 'expired': return '#9E9E9E';
      default: return '#666';
    }
  };

  // Handle transaction creation
  const handleAddTransaction = () => {
    if (!transactionData.amount || !transactionData.title) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const amount = parseFloat(transactionData.amount);
    if (isNaN(amount)) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      title: transactionData.title,
      amount: transactionData.type === 'addition' || transactionData.type === 'refund' 
        ? amount 
        : -amount,
      type: transactionData.type,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: transactionData.description,
      category: transactionData.category || 'General',
    };

    // Update balance
    const newBalance = balance + newTransaction.amount;
    setBalance(newBalance);

    // Add transaction
    setTransactions([newTransaction, ...transactions]);

    // Reset form
    setTransactionData({
      type: 'deduction',
      amount: '',
      title: '',
      description: '',
      category: '',
    });

    // Close modal with animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      fadeAnim.setValue(0);
    });

    Alert.alert('Success', 'Transaction added successfully!');
  };

  // Handle quick actions
  const handleQuickAction = (actionId) => {
    setSelectedAction(actionId);
    setActionModalVisible(true);
    
    // Pre-fill modal based on action
    switch (actionId) {
      case 'add_money':
        setTransactionData({
          type: 'addition',
          amount: '',
          title: 'Add Money to Wallet',
          description: 'Added via Add Money',
          category: 'Top-up',
        });
        break;
      default:
        setTransactionData({
          type: 'deduction',
          amount: '',
          title: '',
          description: '',
          category: '',
        });
    }
  };

  // Handle action confirmation
  const handleActionConfirm = () => {
    if (!transactionData.amount) {
      Alert.alert('Error', 'Please enter amount');
      return;
    }

    handleAddTransaction();
    setActionModalVisible(false);
  };

  // Render transaction item
  const renderTransactionItem = ({ item }) => (
    <TouchableOpacity style={styles.transactionCard}>
      <View style={styles.transactionIconContainer}>
        <Icon 
          name={getTransactionIcon(item.type)} 
          size={20} 
          color={getTransactionColor(item.type)} 
        />
      </View>
      <View style={styles.transactionDetails}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[
            styles.transactionAmount,
            { color: item.amount >= 0 ? '#4CAF50' : '#F44336' }
          ]}>
            {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
          </Text>
        </View>
        <Text style={styles.transactionDescription} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.transactionFooter}>
          <View style={[
            styles.categoryBadge,
            { backgroundColor: getTransactionColor(item.type) + '15' }
          ]}>
            <Text style={[
              styles.transactionCategory,
              { color: getTransactionColor(item.type) }
            ]}>
              {item.category}
            </Text>
          </View>
          <Text style={styles.transactionDate}>
            {item.date} • {item.time}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render stats view
  const renderStatsView = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Icon name="trending-up" size={20} color="#4CAF50" />
          <Text style={styles.statValue}>₹{stats.totalAdded.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Added</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="trending-down" size={20} color="#F44336" />
          <Text style={styles.statValue}>₹{stats.totalSpent.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="refresh" size={20} color="#2196F3" />
          <Text style={styles.statValue}>₹{stats.totalRefunded.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Refunded</Text>
        </View>
        <View style={styles.statCard}>
          <Icon name="timer" size={20} color="#9E9E9E" />
          <Text style={styles.statValue}>₹{stats.totalExpired.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Total Expired</Text>
        </View>
      </View>
      
      <View style={styles.chartPlaceholder}>
        <Icon name="pie-chart" size={40} color="#E0E0E0" />
        <Text style={styles.chartText}>Spending Chart</Text>
        <Text style={styles.chartSubtext}>Visual representation of your transactions</Text>
      </View>
    </View>
  );

  // Render transaction list
  const renderTransactionList = () => (
    <View style={styles.listContainer}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={18} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {transactionTypes.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              selectedFilter === filter.id && styles.filterChipActive,
            ]}
            onPress={() => setSelectedFilter(filter.id)}
          >
            <Icon 
              name={filter.icon} 
              size={14} 
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
          contentContainerStyle={styles.transactionsList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Icon name="receipt-outline" size={56} color="#E0E0E0" />
          <Text style={styles.emptyStateText}>No transactions found</Text>
          <Text style={styles.emptyStateSubtext}>
            {searchQuery ? 'Try a different search term' : 'Start by adding your first transaction'}
          </Text>
        </View>
      )}
    </View>
  );

  // Floating Action Button
  const FloatingActionButton = () => (
    <TouchableOpacity
      style={styles.fab}
      onPress={() => setModalVisible(true)}
    >
      <Icon name="add" size={24} color="#FFF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Icon name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Eatoor Money</Text>
        <TouchableOpacity 
          style={styles.viewToggle}
          onPress={() => setViewMode(viewMode === 'list' ? 'stats' : 'list')}
        >
          <Icon 
            name={viewMode === 'list' ? 'stats-chart' : 'list'} 
            size={22} 
            color="#FF6B35" 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <TouchableOpacity>
              <Icon name="information-circle-outline" size={18} color="rgba(255, 255, 255, 0.9)" />
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
          
          {/* Add Money Button */}
          <View style={styles.addMoneyContainer}>
            <TouchableOpacity
              style={styles.addMoneyButton}
              onPress={() => handleQuickAction('add_money')}
            >
              <View style={styles.addMoneyIconContainer}>
                <Icon name="add-circle" size={20} color="#FFF" />
              </View>
              <Text style={styles.addMoneyText}>Add Money</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Icon name="trending-up" size={18} color="#4CAF50" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Total Added</Text>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
              +₹{stats.totalAdded.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Icon name="trending-down" size={18} color="#F44336" style={styles.summaryIcon} />
            <Text style={styles.summaryLabel}>Total Spent</Text>
            <Text style={[styles.summaryValue, { color: '#F44336' }]}>
              -₹{stats.totalSpent.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.contentContainer}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>
              Transaction History
            </Text>
            <TouchableOpacity 
              style={styles.addTransactionButton}
              onPress={() => setModalVisible(true)}
            >
              <Icon name="add-outline" size={18} color="#FF6B35" />
              <Text style={styles.addTransactionText}>Add</Text>
            </TouchableOpacity>
          </View>

          {viewMode === 'list' ? renderTransactionList() : renderStatsView()}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton />

      {/* Add Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { opacity: fadeAnim }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Icon name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Transaction Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Transaction Type</Text>
                <View style={styles.typeGrid}>
                  {transactionTypes.slice(1).map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeButton,
                        transactionData.type === type.id && styles.typeButtonActive(type.id),
                      ]}
                      onPress={() => setTransactionData({...transactionData, type: type.id})}
                    >
                      <Icon 
                        name={type.icon.replace('-outline', '')} 
                        size={18} 
                        color={transactionData.type === type.id ? '#FFF' : getTransactionColor(type.id)} 
                      />
                      <Text style={[
                        styles.typeButtonText,
                        transactionData.type === type.id && styles.typeButtonTextActive,
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.amountInput}
                  value={transactionData.amount}
                  onChangeText={(text) => setTransactionData({...transactionData, amount: text})}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.textInput}
                  value={transactionData.title}
                  onChangeText={(text) => setTransactionData({...transactionData, title: text})}
                  placeholder="Enter transaction title"
                  placeholderTextColor="#999"
                />
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={transactionData.description}
                  onChangeText={(text) => setTransactionData({...transactionData, description: text})}
                  placeholder="Enter description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.textInput}
                  value={transactionData.category}
                  onChangeText={(text) => setTransactionData({...transactionData, category: text})}
                  placeholder="e.g., Food, Shopping, etc."
                  placeholderTextColor="#999"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleAddTransaction}
              >
                <Icon name="checkmark" size={18} color="#FFF" style={styles.submitButtonIcon} />
                <Text style={styles.submitButtonText}>Add Transaction</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Action Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={actionModalVisible}
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.actionModalOverlay}>
          <View style={styles.actionModalContainer}>
            <View style={styles.actionModalHeader}>
              <Icon name="wallet-outline" size={28} color="#FF6B35" />
              <Text style={styles.actionModalTitle}>
                Add Money
              </Text>
              <Text style={styles.actionModalSubtitle}>
                Enter the amount you want to add to your wallet
              </Text>
            </View>
            
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.actionAmountInput}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={transactionData.amount}
                onChangeText={(text) => setTransactionData({...transactionData, amount: text})}
                placeholderTextColor="#999"
                autoFocus
              />
            </View>

            <View style={styles.quickAmounts}>
              {[100, 200, 500, 1000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountButton}
                  onPress={() => setTransactionData({...transactionData, amount: amount.toString()})}
                >
                  <Text style={styles.quickAmountText}>₹{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionModalActions}>
              <TouchableOpacity 
                style={styles.actionCancelButton}
                onPress={() => setActionModalVisible(false)}
              >
                <Icon name="close" size={18} color="#666" style={styles.actionButtonIcon} />
                <Text style={styles.actionCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionConfirmButton}
                onPress={handleActionConfirm}
              >
                <Icon name="checkmark" size={18} color="#FFF" style={styles.actionButtonIcon} />
                <Text style={styles.actionConfirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        paddingTop: height * 0.06,
      },
      android: {
        paddingTop: 14,
        elevation: 2,
      },
    }),
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  viewToggle: {
    padding: 6,
    backgroundColor: '#FFF5F0',
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  balanceCard: {
    backgroundColor: '#FF6B35',
    margin: 16,
    borderRadius: 24,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B35',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  addMoneyContainer: {
    alignItems: 'center',
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  addMoneyIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addMoneyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B35',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIcon: {
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 24,
    minHeight: height * 0.5,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  addTransactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addTransactionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
  },
  listContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 10,
    fontWeight: '500',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  filterChipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFF',
  },
  transactionsList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
    }),
  },
  transactionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    flex: 1,
    marginRight: 12,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  transactionDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionCategory: {
    fontSize: 11,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  statsContainer: {
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: width * 0.43,
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
    }),
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    padding: 40,
    borderRadius: 16,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    borderStyle: 'dashed',
  },
  chartText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
    marginTop: 16,
    marginBottom: 4,
  },
  chartSubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#999',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flex: 1,
    minWidth: width * 0.4,
    gap: 8,
  },
  typeButtonActive: (type) => ({
    backgroundColor: type === 'addition' ? '#E8F5E9' : 
                    type === 'deduction' ? '#FFEBEE' : 
                    type === 'refund' ? '#E3F2FD' : '#F5F5F5',
    borderColor: getTransactionColor(type),
  }),
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#000',
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    borderBottomWidth: 2,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 8,
  },
  textInput: {
    fontSize: 15,
    color: '#000',
    borderBottomWidth: 2,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 12,
    fontWeight: '500',
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderBottomWidth: 1.5,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    gap: 8,
  },
  submitButtonIcon: {
    marginRight: 4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: width * 0.85,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  actionModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  actionModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    marginTop: 12,
    marginBottom: 6,
  },
  actionModalSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
    marginBottom: 24,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    marginRight: 8,
  },
  actionAmountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    padding: 0,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  actionModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    gap: 6,
  },
  actionButtonIcon: {
    marginRight: 4,
  },
  actionCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  actionConfirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    gap: 6,
  },
  actionConfirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});

// Helper function for getTransactionColor
const getTransactionColor = (type) => {
  switch (type) {
    case 'addition': return '#4CAF50';
    case 'deduction': return '#F44336';
    case 'refund': return '#2196F3';
    case 'expired': return '#9E9E9E';
    default: return '#666';
  }
};

export default EatoorMoneyScreen;