import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  FlatList, 
  TextInput, 
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getOrderList, getReOrderDetailsResponse } from '../../../api/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dummy images configuration for fallback
const DUMMY_IMAGES = {
  DEFAULT_KITCHEN: 'https://cdn-icons-png.flaticon.com/512/1261/1261161.png',
  DEFAULT_DELIVERY: 'https://randomuser.me/api/portraits/men/1.jpg'
};

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

interface OrderItem {
  item_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  buy_one_get_one_free: boolean;
}

interface DeliveryAddress {
  full_name: string;
  restaurant_name: string;
  restaurant_image: string;
  address: string;
  landmark: string;
  home_type: string;
  phone_number: string;
}

interface Order {
  order_number: string;
  status: string;
  placed_on: string;
  delivery_address: DeliveryAddress;
  estimated_delivery: string;
  items: OrderItem[];
  subtotal: string;
  total: string;
  rating: number | null;
}

const PastOrdersScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [reordering, setReordering] = useState<string | null>(null); // Track which order is being reordered

  useEffect(() => {
    fetchPastOrders();
  }, []);

  const fetchPastOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        const response = await getOrderList({ user_id: parsedUser.id });
        if (response.status === 200) {
          setOrders(response.data.orders || []);
        } else {
          setError('Failed to fetch orders');
        }
    } else {
        setError('User not logged in');
    }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to fetch orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPastOrders();
  };

  // Format date to a more readable form
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '';
      const isoString = dateString.replace(' ', 'T') + 'Z'; // add Z to mark UTC
      const date = new Date(isoString);
      const formatted = date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', // ✅ Force IST
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return formatted;
    } catch (e) {
      console.error('Date formatting error:', e);
      return dateString;
    }
  };

  // Enhanced search function that searches across multiple fields
  const searchOrders = (query: string) => {
    if (!query.trim()) return orders;
    
    const lowerQuery = query.toLowerCase().trim();
    
    return orders.filter(order => {
      // Search by restaurant name
      const restaurantName = order.delivery_address?.restaurant_name?.toLowerCase() || '';
      if (restaurantName.includes(lowerQuery)) return true;
      
      // Search by order number
      const orderNumber = order.order_number?.toLowerCase() || '';
      if (orderNumber.includes(lowerQuery)) return true;
      
      // Search by status
      const status = order.status?.toLowerCase() || '';
      if (status.includes(lowerQuery)) return true;
      
      // Search by date (formatted)
      const formattedDate = formatDate(order.placed_on).toLowerCase();
      if (formattedDate.includes(lowerQuery)) return true;
      
      // Search by price
      const totalPrice = order.total?.toString() || '';
      if (totalPrice.includes(lowerQuery)) return true;
      
      // Search through all items
      if (order.items && order.items.length > 0) {
        const hasMatchingItem = order.items.some(item => {
          const itemName = item.item_name?.toLowerCase() || '';
          const itemQuantity = item.quantity?.toString() || '';
          const itemPrice = item.unit_price?.toString() || '';
          
          return itemName.includes(lowerQuery) || 
                 itemQuantity.includes(lowerQuery) || 
                 itemPrice.includes(lowerQuery);
        });
        if (hasMatchingItem) return true;
      }
      
      // Search by delivery address fields
      const address = order.delivery_address?.address?.toLowerCase() || '';
      const landmark = order.delivery_address?.landmark?.toLowerCase() || '';
      const fullName = order.delivery_address?.full_name?.toLowerCase() || '';
      const phoneNumber = order.delivery_address?.phone_number?.toLowerCase() || '';
      
      if (address.includes(lowerQuery) || 
          landmark.includes(lowerQuery) || 
          fullName.includes(lowerQuery) || 
          phoneNumber.includes(lowerQuery)) {
        return true;
      }
      
      return false;
    });
  };

  const filteredOrders = searchOrders(searchQuery);

  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    try {
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);

  const handleReorder = async (order: Order) => {
    try {
      setReordering(order.order_number);
      const newPastKitchenDetails = {
        id: order.restaurant_id,
      };

      savePastKitchenDetails(newPastKitchenDetails)
      const response = await getReOrderDetailsResponse(order.order_number);
      if (response.status === 200) {
        navigation.navigate('CartScreen');
      } else {
        Alert.alert('Error', 'Failed to reorder. Please try again.');
      }
    } catch (err) {
      console.error('Error reordering:', err);
      Alert.alert('Error', 'Failed to reorder. Please try again.');
    } finally {
      setReordering(null);
    }
  };

  const handleTrackOrder = (order: Order) => {
    navigation.navigate('TrackOrder', { 
      order: {
        ...order,
        deliveryStatus: order.status === 'On the way' ? 'on_the_way' : 'preparing',
        eta: order.status === 'On the way' ? '15-20 mins' : '25-30 mins',
        kitchenName: order.delivery_address?.restaurant_name || 'Unknown Kitchen',
        kitchenImage: order.delivery_address?.restaurant_image || DUMMY_IMAGES.DEFAULT_KITCHEN,
        orderPrice: order.total
      }
    });
  };

  const VegNonVegIcon = ({ type }: { type: 'veg' | 'non-veg' }) => (
    <View style={[
      styles.vegNonVegIcon,
      type === 'veg' ? styles.vegIcon : styles.nonVegIcon
    ]}>
      <View style={[
        styles.vegNonVegInner,
        type === 'veg' ? styles.vegInner : styles.nonVegInner
      ]} />
    </View>
  );

  const determineFoodType = (itemName: string): 'veg' | 'non-veg' => {
    if (!itemName) return 'veg'; // default to veg if item name is not available
    const nonVegKeywords = ['chicken', 'mutton', 'fish', 'prawn', 'egg', 'meat'];
    return nonVegKeywords.some(keyword => itemName.toLowerCase().includes(keyword)) 
      ? 'non-veg' 
      : 'veg';
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <View style={styles.kitchenHeader}>
        <Image 
          source={{ uri: item.delivery_address?.restaurant_image || DUMMY_IMAGES.DEFAULT_KITCHEN }} 
          style={styles.kitchenImage}
          defaultSource={{ uri: DUMMY_IMAGES.DEFAULT_KITCHEN }}
        />
        <View style={styles.kitchenInfo}>
          <Text style={styles.kitchenName} numberOfLines={1} ellipsizeMode="tail">
            {item.delivery_address?.restaurant_name || 'Unknown Kitchen'}
          </Text>
          <Text style={styles.orderDate}>{formatDate(item.placed_on)}</Text>
        </View>
        {item.rating ? (
          <View style={styles.ratedStars}>
            {[...Array(5)].map((_, i) => (
              <Icon 
                key={i} 
                name={i < Math.floor(item.rating) ? 'star' : 'star-outline'} 
                size={14} 
                color="#FFD700" 
              />
            ))}
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.rateButton}
            onPress={() => navigation.navigate('RateOrderScreen', { order: item })}
          >
            <Text style={styles.rateButtonText}>Rate Order</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.itemsContainer}
      >
        {item.items?.map((foodItem, index) => (
          <View key={`${item.order_number}-${index}`} style={styles.foodItem}>
            <VegNonVegIcon type={determineFoodType(foodItem.item_name)} />
            <Text style={styles.itemText}>
              {foodItem.item_name} (x{foodItem.quantity})
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.orderFooter}>
        <View style={styles.priceStatusContainer}>
          <Text style={styles.orderPrice}>₹{item.total || '0'}</Text>
          <View style={[
            styles.statusBadge,
            item.status === 'Delivered' ? styles.deliveredBadge : styles.onthewayBadge
          ]}>
            <Text style={styles.statusText}>
              {item?.status?.trim().toLowerCase() === 'in progress'
                ? 'Payment Failed'
                : (item.status || 'Pending')}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {item.status !== 'Delivered' && item.status !== 'Cancelled' && item.status !== 'Refunded' && item.status !== 'In Progress' ? (
            <TouchableOpacity 
              style={styles.trackButton}
              onPress={() => handleTrackOrder(item)}
            >
              <Icon name="navigate" size={16} color="#333" style={styles.buttonIcon} />
              <Text style={styles.trackButtonText}>Track Order</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.reorderButton}
              onPress={() => handleReorder(item)}
              disabled={reordering === item.order_number}
            >
              {reordering === item.order_number ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <>
                  <Icon name="refresh" size={16} color="#E65C00" style={styles.buttonIcon} />
                  <Text style={styles.reorderButtonText}>Reorder</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => navigation.navigate('OrderDetailsScreen', { order: item })}
          >
            <Icon name="document-text" size={16} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.viewButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E65C00" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={50} color="#ff4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchPastOrders}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ProfileScreen')}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Your Orders</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by kitchen, dish, order number, status, date, price, or address..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* Search results info */}
      {searchQuery.length > 0 && (
        <View style={styles.searchResultsInfo}>
          <Text style={styles.searchResultsText}>
            Found {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} for "{searchQuery}"
          </Text>
        </View>
      )}

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={item => item.order_number}
        contentContainerStyle={filteredOrders.length === 0 ? styles.emptyContainer : styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E65C00']}
            tintColor="#E65C00"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="fast-food-outline" size={60} color="#ddd" />
            <Text style={styles.emptyText}>
              {searchQuery.length > 0 ? 'No matching orders found' : 'No orders found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery.length > 0 
                ? 'Try a different search term or clear the search' 
                : 'Your order history will appear here'}
            </Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery('')}
              >
                <Text style={styles.clearSearchText}>Clear Search</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    padding:10,
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  searchResultsInfo: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchResultsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  clearSearchButton: {
    marginTop: 16,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchText: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ff4444',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  kitchenImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  kitchenInfo: {
    flex: 1,
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    maxWidth: '70%',
  },
  orderDate: {
    fontSize: 9,
    color: '#888',
    marginTop: 4,
  },
  ratedStars: {
    flexDirection: 'row',
  },
  rateButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rateButtonText: {
    fontSize: 12,
    color: '#E65C00',
    fontWeight: '600',
  },
  itemsContainer: {
    paddingVertical: 8,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  itemText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
  },
  vegNonVegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegIcon: {
    borderColor: 'green',
  },
  nonVegIcon: {
    borderColor: 'red',
  },
  vegNonVegInner: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  vegInner: {
    backgroundColor: 'green',
  },
  nonVegInner: {
    backgroundColor: 'red',
  },
  orderFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  priceStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deliveredBadge: {
    backgroundColor: '#e3f9e5',
  },
  onthewayBadge: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  trackButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  reorderButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reorderButtonText: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#E65C00',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  buttonIcon: {
    marginRight: 4,
  }
});

export default PastOrdersScreen;