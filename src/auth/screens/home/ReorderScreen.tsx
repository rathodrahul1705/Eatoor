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
  Alert,
  Dimensions,
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getOrderList, getReOrderDetailsResponse } from '../../../api/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeTabParamList } from '../../../types/navigation.d';

// Dummy images configuration for fallback
const DUMMY_IMAGES = {
  DEFAULT_KITCHEN: 'https://cdn-icons-png.flaticon.com/512/1261/1261161.png',
  DEFAULT_DELIVERY: 'https://randomuser.me/api/portraits/men/1.jpg'
};

const { width, height } = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

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
  restaurant_id?: string;
}

type ReorderScreenProps = NativeStackScreenProps<HomeTabParamList, 'ReorderScreen'>;

const ReorderScreen: React.FC<ReorderScreenProps> = () => {
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
          // Filter to show only delivered orders
          const deliveredOrders = (response.data.orders || []).filter(
            order => order.status === 'Delivered'
          );
          setOrders(deliveredOrders);
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

  // Filter orders based on search (only delivered orders are shown)
  const filteredOrders = orders.filter(order => {
    return order.delivery_address?.restaurant_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           order.items?.some(item => item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  });

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
        id: order.restaurant_id || '',
        name: order.delivery_address?.restaurant_name || 'Unknown Kitchen',
        image: order.delivery_address?.restaurant_image || DUMMY_IMAGES.DEFAULT_KITCHEN,
        itemCount: order.items?.length || 0
      };

      savePastKitchenDetails(newPastKitchenDetails);
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

  const VegNonVegIcon = ({ type }: { type: 'veg' | 'non-veg' }) => (
    <View style={[
      styles.reorder_screen_vegNonVegIcon,
      type === 'veg' ? styles.reorder_screen_vegIcon : styles.reorder_screen_nonVegIcon
    ]}>
      <View style={[
        styles.reorder_screen_vegNonVegInner,
        type === 'veg' ? styles.reorder_screen_vegInner : styles.reorder_screen_nonVegInner
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
    <View style={styles.reorder_screen_orderCard}>
      <View style={styles.reorder_screen_kitchenHeader}>
        <Image 
          source={{ uri: item.delivery_address?.restaurant_image || DUMMY_IMAGES.DEFAULT_KITCHEN }} 
          style={styles.reorder_screen_kitchenImage}
          defaultSource={{ uri: DUMMY_IMAGES.DEFAULT_KITCHEN }}
        />
        <View style={styles.reorder_screen_kitchenInfo}>
          <Text style={styles.reorder_screen_kitchenName} numberOfLines={1} ellipsizeMode="tail">
            {item.delivery_address?.restaurant_name || 'Unknown Kitchen'}
          </Text>
          <Text style={styles.reorder_screen_orderDate}>{formatDate(item.placed_on)}</Text>
        </View>
        {item.rating ? (
          <View style={styles.reorder_screen_ratedStars}>
            {[...Array(5)].map((_, i) => (
              <Icon 
                key={i} 
                name={i < Math.floor(item.rating || 0) ? 'star' : 'star-outline'} 
                size={14} 
                color="#FFD700" 
              />
            ))}
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.reorder_screen_rateButton}
            onPress={() => navigation.navigate('RateOrderScreen', { order: item })}
          >
            <Text style={styles.reorder_screen_rateButtonText}>Rate Order</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reorder_screen_itemsContainer}
      >
        {item.items?.map((foodItem, index) => (
          <View key={`${item.order_number}-${index}`} style={styles.reorder_screen_foodItem}>
            <VegNonVegIcon type={determineFoodType(foodItem.item_name)} />
            <Text style={styles.reorder_screen_itemText}>
              {foodItem.item_name} (x{foodItem.quantity})
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.reorder_screen_orderFooter}>
        <View style={styles.reorder_screen_priceStatusContainer}>
          <Text style={styles.reorder_screen_orderPrice}>₹{item.total || '0'}</Text>
          <View style={[styles.reorder_screen_statusBadge, 
            item.status === 'Delivered' ? styles.reorder_screen_deliveredBadge : 
            item.status === 'Cancelled' ? styles.reorder_screen_cancelledBadge : 
            styles.reorder_screen_pendingBadge
          ]}>
            <Text style={styles.reorder_screen_statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.reorder_screen_actionButtons}>
          <TouchableOpacity 
            style={styles.reorder_screen_reorderButton}
            onPress={() => handleReorder(item)}
            disabled={reordering === item.order_number || item.status === 'Cancelled'}
          >
            {reordering === item.order_number ? (
              <ActivityIndicator size="small" color="#E65C00" />
            ) : (
              <>
                <Icon name="refresh" size={16} color="#E65C00" style={styles.reorder_screen_buttonIcon} />
                <Text style={styles.reorder_screen_reorderButtonText}>Reorder</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.reorder_screen_viewButton}
            onPress={() => navigation.navigate('OrderDetailsScreen', { order: item })}
          >
            <Icon name="document-text" size={16} color="#fff" style={styles.reorder_screen_buttonIcon} />
            <Text style={styles.reorder_screen_viewButtonText}>Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.reorder_screen_container}>
        <StatusBar backgroundColor="#fff" barStyle="dark-content" />
        <View style={styles.reorder_screen_loadingContainer}>
          <ActivityIndicator size="large" color="#E65C00" />
          <Text style={styles.reorder_screen_loadingText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !loading) {
    return (
      <SafeAreaView style={styles.reorder_screen_container}>
        <StatusBar backgroundColor="#fff" barStyle="dark-content" />
        <View style={styles.reorder_screen_errorContainer}>
          <Icon name="alert-circle" size={50} color="#ff4444" />
          <Text style={styles.reorder_screen_errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.reorder_screen_retryButton}
            onPress={fetchPastOrders}
          >
            <Text style={styles.reorder_screen_retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.reorder_screen_container}>
      
      {/* Header with Back Button and Title */}
      <View style={styles.reorder_screen_header}>
        <TouchableOpacity 
          style={styles.reorder_screen_backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.reorder_screen_headerTitle}>Reorder</Text>
        <View style={styles.reorder_screen_headerRightPlaceholder} />
      </View>

      {/* Search Box */}
      <View style={styles.reorder_screen_searchContainer}>
        <Icon name="search" size={20} color="#888" style={styles.reorder_screen_searchIcon} />
        <TextInput
          style={styles.reorder_screen_searchInput}
          placeholder="Search by kitchen or dish..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={item => item.order_number}
        contentContainerStyle={filteredOrders.length === 0 ? styles.reorder_screen_emptyContainer : styles.reorder_screen_listContainer}
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
          <View style={styles.reorder_screen_emptyContainer}>
            <Icon name="fast-food-outline" size={60} color="#ddd" />
            <Text style={styles.reorder_screen_emptyText}>No delivered orders found</Text>
            <Text style={styles.reorder_screen_emptySubtext}>Try adjusting your search</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  reorder_screen_container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  reorder_screen_header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reorder_screen_backButton: {
    padding: 4,
  },
  reorder_screen_headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  reorder_screen_headerRightPlaceholder: {
    width: 32,
  },
  reorder_screen_searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    margin: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  reorder_screen_searchIcon: {
    marginRight: 10,
  },
  reorder_screen_searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 8,
    color: '#333',
  },
  reorder_screen_loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorder_screen_loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  reorder_screen_errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reorder_screen_errorText: {
    fontSize: 18,
    color: '#ff4444',
    marginTop: 16,
    textAlign: 'center',
  },
  reorder_screen_retryButton: {
    marginTop: 20,
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reorder_screen_retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  reorder_screen_emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  reorder_screen_emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  reorder_screen_emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  reorder_screen_listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  reorder_screen_orderCard: {
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
  reorder_screen_kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reorder_screen_kitchenImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  reorder_screen_kitchenInfo: {
    flex: 1,
  },
  reorder_screen_kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    maxWidth: '70%',
  },
  reorder_screen_orderDate: {
    fontSize: 9,
    color: '#888',
    marginTop: 4,
  },
  reorder_screen_ratedStars: {
    flexDirection: 'row',
  },
  reorder_screen_rateButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reorder_screen_rateButtonText: {
    fontSize: 12,
    color: '#E65C00',
    fontWeight: '600',
  },
  reorder_screen_itemsContainer: {
    paddingVertical: 8,
  },
  reorder_screen_foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  reorder_screen_itemText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
  },
  reorder_screen_vegNonVegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorder_screen_vegIcon: {
    borderColor: 'green',
  },
  reorder_screen_nonVegIcon: {
    borderColor: 'red',
  },
  reorder_screen_vegNonVegInner: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  reorder_screen_vegInner: {
    backgroundColor: 'green',
  },
  reorder_screen_nonVegInner: {
    backgroundColor: 'red',
  },
  reorder_screen_orderFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  reorder_screen_priceStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reorder_screen_orderPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  reorder_screen_statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reorder_screen_deliveredBadge: {
    backgroundColor: '#e3f9e5',
  },
  reorder_screen_cancelledBadge: {
    backgroundColor: '#ffe6e6',
  },
  reorder_screen_pendingBadge: {
    backgroundColor: '#fff0cc',
  },
  reorder_screen_statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reorder_screen_actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reorder_screen_reorderButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reorder_screen_reorderButtonText: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  reorder_screen_viewButton: {
    flex: 1,
    backgroundColor: '#E65C00',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reorder_screen_viewButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  reorder_screen_buttonIcon: {
    marginRight: 4,
  }
});

export default ReorderScreen;