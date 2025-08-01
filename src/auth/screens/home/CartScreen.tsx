import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar, 
  FlatList, 
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCartDetails, updateCart } from '../../../api/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.7 - 80;

// Define types for API response
type CartItem = {
  item_id: number;
  id: number;
  restaurant_id: string;
  restaurant_name: string;
  item_name: string;
  item_description: string;
  discount_active: number;
  discount_percent: number;
  item_price: number;
  original_item_price: number;
  buy_one_get_one_free: boolean;
  quantity: number;
  item_image: string;
  type?: 'Veg' | 'Non-Veg';
};

type SuggestedItem = {
  item_name: string;
  item_id: number;
  item_price: number;
  item_image: string;
  type?: 'Veg' | 'Non-Veg';
};

type DeliveryAddress = {
  id: number;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
};

type DeliveryTime = {
  estimated_time: string;
  is_express_available: boolean;
};

type BillingDetails = {
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  currency: string;
};

type CartApiResponse = {
  status: string;
  restaurant_name: string;
  cart_details: CartItem[];
  suggestion_cart_items: SuggestedItem[];
  delivery_address_details: DeliveryAddress;
  delivery_time: DeliveryTime;
  billing_details: BillingDetails;
};

const CartScreen = ({ route, navigation }) => {
  const [cartData, setCartData] = useState<CartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<number[]>([]);
  const [user, setUser] = useState<string | null>(null);
  
  const userId = route.params.userId;
  const sessionId = "";
  const kitchenId = route.params.kitchenId;

  const swipeAnim = useRef(new Animated.Value(0)).current;
  const [isSwiped, setIsSwiped] = useState(false);

    useEffect(() => {
      const fetchUserData = async () => {
        try {
          const [userData] = await Promise.all([
            AsyncStorage.getItem('user'),
            AsyncStorage.getItem('session_id')
          ]);
          
          if (userData) setUser(JSON.parse(userData));
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      };

      fetchUserData();
    }, []);

  useEffect(() => {
    const fetchCartData = async () => {
      try {
        setLoading(true);
        const response = await getCartDetails({
          user_id: userId,
          session_id: sessionId,
          restaurant_id: kitchenId
        });
        
        if (response.status === 200) {
          setCartData(response.data);
        } else {
          setError('Failed to load cart data');
        }
      } catch (err) {
        console.error('Error fetching cart data:', err);
        setError('An error occurred while loading your cart');
      } finally {
        setLoading(false);
      }
    };

    fetchCartData();
  }, [userId, sessionId, kitchenId, user]);

  const formatAddress = () => {
    if (!cartData?.delivery_address_details) return "No address selected";
    
    const { address_line1, address_line2, city, state, postal_code } = cartData.delivery_address_details;
    return `${address_line1}${address_line2 ? ', ' + address_line2 : ''}, ${city}, ${state} ${postal_code}`;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= SWIPE_THRESHOLD) {
          swipeAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD / 2 && cartData) {
          Animated.timing(swipeAnim, {
            toValue: SWIPE_THRESHOLD,
            duration: 200,
            useNativeDriver: false
          }).start(() => {
            setIsSwiped(true);
            setTimeout(() => {
              navigation.navigate('Payment', {
                amount: cartData.billing_details.total,
                restaurant: cartData.restaurant_name || 'Restaurant',
                items: cartData.cart_details
              });
              swipeAnim.setValue(0);
              setIsSwiped(false);
            }, 500);
          });
        } else {
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  const updateItemQuantity = async (itemId: number, action: 'increment' | 'decrement') => {
    if (!cartData) return;

    setUpdatingItems(prev => [...prev, itemId]);
    
    try {
      const payload = {
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId,
        item_id: itemId,
        source: 'CART',
        quantity: 1, // Always update by 1
        action: action === 'increment' ? 'add' : 'remove'
      };

      const response = await updateCart(payload);
      
      if (response.status === 200) {
        // Find the item to update
        const itemIndex = cartData.cart_details.findIndex(item => item.item_id === itemId);
        
        if (itemIndex === -1) {
          console.error('Item not found in cart');
          return;
        }

        const item = cartData.cart_details[itemIndex];
        let newQuantity = action === 'increment' ? item.quantity + 1 : item.quantity - 1;

        // If decrementing to 0, remove the item
        if (newQuantity <= 0) {
          const updatedItems = [...cartData.cart_details];
          updatedItems.splice(itemIndex, 1);
          
          setCartData({
            ...cartData,
            cart_details: updatedItems,
            billing_details: calculateBillingDetails(updatedItems)
          });
        } else {
          // Update quantity
          const updatedItems = cartData.cart_details.map(item => {
            if (item.item_id === itemId) {
              return { 
                ...item, 
                quantity: newQuantity 
              };
            }
            return item;
          });
          
          setCartData({
            ...cartData,
            cart_details: updatedItems,
            billing_details: calculateBillingDetails(updatedItems)
          });
        }
      } else {
        console.error('Failed to update cart:', response.data.message);
        // Revert UI if API call fails by refetching cart data
        const fetchResponse = await getCartDetails({
          user_id: userId,
          session_id: sessionId,
          restaurant_id: kitchenId
        });
        if (fetchResponse.data.status === 'success') {
          setCartData(fetchResponse.data);
        }
      }
    } catch (err) {
      console.error('Error updating cart:', err);
      // Revert UI if API call fails by refetching cart data
      const fetchResponse = await getCartDetails({
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId
      });
      if (fetchResponse.data.status === 'success') {
        setCartData(fetchResponse.data);
      }
    } finally {
      setUpdatingItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const calculateBillingDetails = (items: CartItem[]): BillingDetails => {
    const subtotal = items.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax + (cartData?.billing_details.delivery_fee || 0);
    
    return {
      subtotal,
      delivery_fee: cartData?.billing_details.delivery_fee || 0,
      tax,
      total,
      currency: cartData?.billing_details.currency || 'INR'
    };
  };

  const addSuggestedItem = async (item: SuggestedItem) => {
    if (!cartData) return;

    setUpdatingItems(prev => [...prev, item.item_id]);
    
    try {
      const payload = {
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId,
        item_id: item.item_id,
        source: 'SUGGESTION',
        quantity: 1,
        action: 'add'
      };

      const response = await updateCart(payload);
      
      if (response.status === 200) {
        // Check if item already exists in cart
        const existingItemIndex = cartData.cart_details.findIndex(
          cartItem => cartItem.item_id === item.item_id
        );

        if (existingItemIndex >= 0) {
          // Increment quantity if item exists
          const updatedItems = cartData.cart_details.map((cartItem, index) => 
            index === existingItemIndex 
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          );
          
          setCartData({
            ...cartData,
            cart_details: updatedItems,
            billing_details: calculateBillingDetails(updatedItems)
          });
        } else {
          // Add new item if it doesn't exist
          const newItem: CartItem = {
            item_id: item.item_id,
            id: Date.now(),
            restaurant_id: cartData.cart_details[0]?.restaurant_id || '',
            restaurant_name: cartData.restaurant_name,
            item_name: item.item_name,
            item_description: '',
            discount_active: 0,
            discount_percent: 0,
            item_price: item.item_price,
            original_item_price: item.item_price,
            buy_one_get_one_free: false,
            quantity: 1,
            item_image: item.item_image,
            type: item.type
          };
          
          const updatedItems = [...cartData.cart_details, newItem];
          setCartData({
            ...cartData,
            cart_details: updatedItems,
            billing_details: calculateBillingDetails(updatedItems)
          });
        }
      } else {
        console.error('Failed to add item:', response.data.message);
      }
    } catch (err) {
      console.error('Error adding item:', err);
    } finally {
      setUpdatingItems(prev => prev.filter(id => id !== item.item_id));
    }
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemLeft}>
        <View style={[
          styles.itemTypeBadge,
          item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
        ]}>
          <View style={[
            styles.itemTypeIndicator,
            item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
          ]}>
            <View style={styles.itemTypeDot} />
          </View>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.item_name}</Text>
          {/* <Text style={styles.itemPrice}>₹{item.item_price.toFixed(2)}</Text> */}
          {/* {item.discount_active ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discount_percent}% OFF</Text>
            </View>
          ) : null} */}
        </View>
      </View>
      
      <View style={styles.itemRight}>
        {updatingItems.includes(item.item_id) ? (
          <ActivityIndicator size="small" color="#e65c00" style={styles.quantityLoader} />
        ) : (
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
              // disabled={item.quantity <= 1}
            >
              <Icon 
                name="remove" 
                size={14} 
                color={item.quantity <= 1 ? "#ccc" : "#e65c00"} 
              />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
            >
              <Icon name="add" size={14} color="#e65c00" />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.itemTotal}>₹{(item.item_price).toFixed(2)}</Text>
      </View>
    </View>
  );

  const renderSuggestedItem = ({ item }: { item: SuggestedItem }) => (
    <TouchableOpacity 
      style={styles.suggestedItem}
      onPress={() => addSuggestedItem(item)}
      // disabled={updatingItems.includes(item.item_id)}
    >
      <Image source={{ uri: item.item_image }} style={styles.suggestedImage} />
      <View style={styles.suggestedDetails}>
        <View style={styles.suggestedItemHeader}>
          <View style={[
            styles.suggestedItemTypeBadge,
            item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
          ]}>
            <View style={[
              styles.suggestedItemTypeIndicator,
              item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
            ]}>
              <View style={styles.itemTypeDot} />
            </View>
          </View>
          <Text style={styles.suggestedName}>{item.item_name}</Text>
        </View>
        <Text style={styles.suggestedPrice}>₹{item.item_price.toFixed(2)}</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => addSuggestedItem(item)}
          disabled={updatingItems.includes(item.item_id)}
        >
          {updatingItems.includes(item.item_id) ? (
            <ActivityIndicator size="small" color="#e65c00" />
          ) : (
            <Text style={styles.addButtonText}>ADD +</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e65c00" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={40} color="#ff4444" style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!cartData || cartData.cart_details.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        <View style={styles.emptyContainer}>
          <View style={styles.emptyHeader}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.backButton}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.emptyHeaderTitle}>{cartData?.restaurant_name || 'Cart'}</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconContainer}>
              <Icon name="cart-outline" size={60} color="#e65c00" />
            </View>
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <Text style={styles.emptySubText}>Looks like you haven't added anything to your cart yet</Text>
            
            {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
              <>
                <Text style={styles.suggestionTitle}>Try something from {cartData.restaurant_name}</Text>
                <FlatList
                  data={cartData.suggestion_cart_items}
                  renderItem={renderSuggestedItem}
                  keyExtractor={item => item.item_id.toString()}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.suggestedContainer}
                  style={{ width: '100%', marginTop: 20 }}
                />
              </>
            )}
            
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.navigate('Kitchen')}
            >
              <Text style={styles.exploreButtonText}>Browse Home Kitchens</Text>
              <Icon name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 5 }} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.restaurantHeader}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{cartData.restaurant_name}</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Address')}
            style={styles.deliveryInfo}
          >
            <Icon name="location-outline" size={14} color="#333" />
            <Text style={styles.deliveryText} numberOfLines={1} ellipsizeMode="tail">
              {formatAddress()}
            </Text>
            <Icon name="chevron-down" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Order</Text>
          <Text style={styles.itemCount}>{cartData.cart_details.length} {cartData.cart_details.length === 1 ? 'item' : 'items'}</Text>
        </View>
        
        <View style={styles.cartItemsContainer}>
          <FlatList
            data={cartData.cart_details}
            renderItem={renderCartItem}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
          />
        </View>
        
        <TouchableOpacity style={styles.couponButton}>
          <View style={styles.couponIcon}>
            <Icon name="pricetag-outline" size={18} color="#e65c00" />
          </View>
          <Text style={styles.couponButtonText}>Apply Coupon</Text>
          <Icon name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>
        
        {cartData.suggestion_cart_items.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add More From {cartData.restaurant_name}</Text>
            </View>
            <FlatList
              data={cartData.suggestion_cart_items}
              renderItem={renderSuggestedItem}
              keyExtractor={item => item.item_id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedContainer}
            />
          </>
        )}
        
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Delivery Details</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="location-outline" size={14} color="#333" />
            </View>
            <Text style={styles.detailText}>Address: {formatAddress()}</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="time-outline" size={16} color="#666" />
            </View>
            <Text style={styles.detailText}>Delivery in {cartData.delivery_time.estimated_time}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="call-outline" size={16} color="#666" />
            </View>
            <Text style={styles.detailText}>Contact: {user?.contact_number}</Text>
          </View>
        </View>
        
        <View style={styles.billContainer}>
          <Text style={styles.billTitle}>Bill Details</Text>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{cartData.billing_details.subtotal.toFixed(2)}</Text>
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValue}>₹{cartData.billing_details.delivery_fee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Tax (5%)</Text>
            <Text style={styles.billValue}>₹{cartData.billing_details.tax.toFixed(2)}</Text>
          </View>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{cartData.billing_details.total.toFixed(2)}</Text>
          </View>
        </View>
        
        <View style={styles.noteContainer}>
          <Icon name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.noteText}>Order cannot be cancelled and non-refundable once packed for delivery</Text>
        </View>
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      <View style={styles.paymentSipper}>
        <View style={styles.swipeContainer}>
          <View style={styles.swipeTrack}>
            <Text style={styles.swipeHint}>Swipe to pay | ₹{cartData.billing_details.total.toFixed(2)}</Text>
            <View style={styles.swipeArrowContainer}>
              <Icon name="chevron-forward" size={20} color="#666" />
              <Icon name="chevron-forward" size={20} color="#666" />
            </View>
          </View>
          <Animated.View 
            style={[
              styles.swipeButton,
              {
                width: swipeAnim.interpolate({
                  inputRange: [0, SWIPE_THRESHOLD],
                  outputRange: [80, SWIPE_THRESHOLD + 160],
                  extrapolate: 'clamp'
                }),
                backgroundColor: swipeAnim.interpolate({
                  inputRange: [0, SWIPE_THRESHOLD],
                  outputRange: ['#e65c00', '#4CAF50'],
                  extrapolate: 'clamp'
                })
              }
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.swipeButtonContent}>
              <Icon 
                name={isSwiped ? "checkmark-circle" : "arrow-forward"} 
                size={20} 
                color="#fff" 
              />
              <Animated.Text style={[
                styles.swipeText,
                {
                  opacity: swipeAnim.interpolate({
                    inputRange: [0, SWIPE_THRESHOLD/2],
                    outputRange: [0, 1],
                    extrapolate: 'clamp'
                  })
                }
              ]}>
                {isSwiped ? "Processing..." : `Pay ₹${cartData.billing_details.total.toFixed(2)}`}
              </Animated.Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  backButton: {
    padding: 5,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff5f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  exploreButton: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    marginTop: 30,
    shadowColor: '#e65c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  restaurantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  restaurantInfo: {
    flex: 1,
    marginLeft: 10,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  deliveryText: {
    marginLeft: 4,
    fontSize: 13,
    color: '#666',
    flex: 1,
    marginRight: 4,
  },
  content: {
    flex: 1,
    paddingBottom: 120,
  },
  sectionHeader: {
    paddingHorizontal: 15,
    marginTop: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  cartItemsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 60,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 10,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTypeBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  vegBadge: {
    borderColor: '#4CAF50',
  },
  nonVegBadge: {
    borderColor: '#F44336',
  },
  itemTypeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#F44336',
  },
  itemTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  discountBadge: {
    backgroundColor: '#e65c00',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f0',
    borderRadius: 15,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ffd6c5',
    marginRight: 12,
  },
  quantityLoader: {
    marginRight: 12,
    width: 80,
  },
  quantityButton: {
    padding: 2,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e65c00',
    marginHorizontal: 6,
    minWidth: 18,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    minWidth: 60,
    textAlign: 'right',
  },
  couponButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  couponIcon: {
    backgroundColor: '#fff5f0',
    padding: 5,
    borderRadius: 6,
  },
  couponButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  suggestedContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  suggestedItem: {
    width: width * 0.4,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestedImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  suggestedDetails: {
    padding: 10,
  },
  suggestedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestedItemTypeBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  suggestedItemTypeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestedName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  suggestedPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65c00',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#fff5f0',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffd6c5',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  addButtonText: {
    color: '#e65c00',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailIcon: {
    backgroundColor: '#f5f5f5',
    padding: 5,
    borderRadius: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  billContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e65c00',
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff8e1',
    marginHorizontal: 15,
    borderRadius: 8,
    marginBottom: 40,
  },
  noteText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  bottomSpacer: {
    height: 20,
  },
  paymentSipper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  swipeContainer: {
    height: 50,
    justifyContent: 'center',
  },
  swipeTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
  },
  swipeHint: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
    marginLeft: 55,
  },
  swipeArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeButton: {
    position: 'absolute',
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    zIndex: 2,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  swipeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    height: '100%',
  },
  swipeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    shadowColor: '#e65c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default CartScreen;