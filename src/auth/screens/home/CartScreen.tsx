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
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCartDetails, updateCart } from '../../../api/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
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
  quantity?: number;
  original_item_price?: number;
  discount_active?: number;
  discount_percent?: number;
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

type UserData = {
  id: string;
  name: string;
  email: string;
  contact_number: string;
};

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

const CartScreen = ({ route, navigation }) => {
  const [cartData, setCartData] = useState<CartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<{id: number, action: 'increment' | 'decrement' | 'add'}[]>([]);
  const [user, setUser] = useState<UserData | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [shortAddress, setShortAddress] = useState<string>("Select Address");
  const [fullAddress, setFullAddress] = useState<string>("Select Address");
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
    
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        const savedAddressId = await AsyncStorage.getItem('AddressId');
        if (userData) {
          setUser(JSON.parse(userData));
        }
        if (savedAddressId) {
          setAddressId(savedAddressId);
        }

        const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');

        if (storedDetails) {
        setPastKitchenDetails(JSON.parse(storedDetails));
      }

      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  const userId = user?.id;
  const sessionId = "";
  const kitchenId = pastKitchenDetails?.id;

  const swipeAnim = useRef(new Animated.Value(0)).current;
  const [isSwiped, setIsSwiped] = useState(false);

  const fetchCartData = async () => {
    if (!kitchenId) {
      setError('No restaurant selected');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await getCartDetails({
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId,
        address_id: addressId
      });
      
      if (response.status === 200) {
        const updatedResponse = response.data;
        
        // Update suggested items with cart quantities
        if (updatedResponse.cart_details && updatedResponse.suggestion_cart_items) {
          updatedResponse.suggestion_cart_items = updatedResponse.suggestion_cart_items.map(suggestedItem => {
            const cartItem = updatedResponse.cart_details.find(item => item.item_id === suggestedItem.item_id);
            return cartItem ? {
              ...suggestedItem,
              quantity: cartItem.quantity,
              original_item_price: cartItem.original_item_price,
              discount_active: cartItem.discount_active,
              discount_percent: cartItem.discount_percent,
              item_price: cartItem.item_price
            } : {
              ...suggestedItem,
              quantity: 0
            };
          });
        }
        
        setCartData(updatedResponse);
        
        // Update address display
        updateAddressDisplay(updatedResponse);
      } else {
        setError('Failed to load cart data');
      }
    } catch (err) {
      console.error('Error fetching cart data:', err);
      setError('An error occurred while loading your cart');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateAddressDisplay = async (cartResponse?: CartApiResponse) => {
    try {
      let address = "";
      let homeType = "";
      const estimatedTime = cartResponse?.delivery_time?.estimated_time || "";
      
      if (cartResponse?.delivery_address_details?.address_line1) {
        address = cartResponse.delivery_address_details.address_line1;
        if (cartResponse.delivery_address_details.address_line2) {
          address += `, ${cartResponse.delivery_address_details.address_line2}`;
        }
        homeType = cartResponse.delivery_address_details.address_type || "";
      } else {
        address = (await AsyncStorage.getItem("StreetAddress")) || "";
        homeType = (await AsyncStorage.getItem("HomeType")) || "";
      }

      // Short address for header
      const shortAddr = address.length > 18 ? `${address.substring(0, 18)}...` : address;
      const shortAddressText = homeType ? `${homeType} | ${shortAddr}` : shortAddr;
      setShortAddress(estimatedTime ? `${estimatedTime} | ${shortAddressText}` : shortAddressText);

      // Full address for details section
      const fullAddressText = homeType ? `${homeType} | ${address}` : address;
      setFullAddress(estimatedTime ? `${estimatedTime} | ${fullAddressText.substring(0, 50)}...` : fullAddressText);
    } catch (error) {
      console.error('Error formatting address:', error);
      setShortAddress("Select Address");
      setFullAddress("Select Address");
    }
  };

  useEffect(() => {
    if (kitchenId && userId) {
      fetchCartData();
    }
  }, [userId, kitchenId, addressId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCartData();
  };

  const handleAddressChange = async () => {
    navigation.navigate('AddressScreen', { 
      prevLocation: 'CartScreen',
      onAddressSelect: async (selectedAddressId: string | number) => {
        try {
          await AsyncStorage.setItem('AddressId', String(selectedAddressId.id));
          setAddressId(String(selectedAddressId.id));
          fetchCartData(); // Refresh cart data with new address
        } catch (error) {
          console.error('Error saving address:', error);
        }
      }
    });
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
          if (!addressId) {
            Alert.alert(
              'Address Required',
              'Please select a delivery address before proceeding to payment',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    Animated.spring(swipeAnim, {
                      toValue: 0,
                      useNativeDriver: false
                    }).start();
                  }
                },
                {
                  text: 'Select Address',
                  onPress: () => {
                    Animated.spring(swipeAnim, {
                      toValue: 0,
                      useNativeDriver: false
                    }).start(() => {
                      handleAddressChange();
                    });
                  }
                }
              ]
            );
            return;
          }

          setIsProcessingPayment(true);
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
                items: cartData.cart_details,
                userId,
                kitchenId,
                addressId
              });
              swipeAnim.setValue(0);
              setIsSwiped(false);
              setIsProcessingPayment(false);
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

  const updateItemQuantity = async (itemId: number, action: 'increment' | 'decrement', source: 'CART' | 'SUGGESTION' = 'CART') => {
    if (!cartData || !kitchenId) return;

    setUpdatingItems(prev => [...prev, {id: itemId, action}]);
    
    try {
      const payload = {
        user_id: userId,
        session_id: sessionId,
        restaurant_id: kitchenId,
        item_id: itemId,
        source: source,
        quantity: 1,
        action: action === 'increment' ? 'add' : 'remove'
      };

      const response = await updateCart(payload);
      
      if (response.status === 200) {
        await fetchCartData();
      } else {
        console.error('Failed to update cart:', response.data.message);
        Alert.alert('Error', 'Failed to update cart. Please try again.');
      }
    } catch (err) {
      console.error('Error updating cart:', err);
      Alert.alert('Error', 'An error occurred while updating your cart.');
    } finally {
      setUpdatingItems(prev => prev.filter(item => item.id !== itemId));
    }
  };

  const BackToKitchen = () => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchenId });
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const isUpdating = updatingItems.some(i => i.id === item.item_id);
    const currentAction = isUpdating 
      ? updatingItems.find(i => i.id === item.item_id)?.action 
      : null;

    return (
      <View style={styles.cartItemContainer}>
        <View style={styles.cartItemContent}>
          <View style={styles.itemTypeContainer}>
            <View style={[
              styles.itemTypeBadge,
              item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
            ]}>
              <View style={[
                styles.itemTypeIndicator,
                item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
              ]} />
            </View>
          </View>
          
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.item_name}</Text>            
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{item.original_item_price.toFixed(2)}</Text>
                <Text style={styles.discountText}>{item.discount_percent}% OFF</Text>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{(item.item_price).toFixed(2)}</Text>
            
            {item.buy_one_get_one_free && (
              <View style={styles.bogoBadge}>
                <Text style={styles.bogoText}>BOGO</Text>
              </View>
            )}
          </View>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={[
                styles.quantityButton,
                styles.disabledButton
              ]} 
              onPress={() => updateItemQuantity(item.item_id, 'decrement')}
            >
              {isUpdating && currentAction === 'decrement' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="remove" size={16} color={"#E65C00"} />
              )}
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={() => updateItemQuantity(item.item_id, 'increment')}
              disabled={isUpdating}
            >
              {isUpdating && currentAction === 'increment' ? (
                <ActivityIndicator size="small" color="#E65C00" />
              ) : (
                <Icon name="add" size={16} color="#E65C00" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderSuggestedItem = ({ item }: { item: SuggestedItem }) => {
    const isUpdating = updatingItems.some(i => i.id === item.item_id);
    const currentAction = isUpdating 
      ? updatingItems.find(i => i.id === item.item_id)?.action 
      : null;
    
    const quantity = item.quantity || 0;

    return (
      <View style={styles.suggestedItemCard}>
        <Image 
          source={{ uri: item.item_image || 'https://via.placeholder.com/150' }} 
          style={styles.suggestedItemImage} 
          resizeMode="cover"
          onError={() => console.log("Image failed to load")}
        />
        <View style={styles.suggestedItemContent}>
          <View style={styles.suggestedItemHeader}>
            <View style={[
              styles.suggestedItemTypeBadge,
              item.type === 'Veg' ? styles.vegBadge : styles.nonVegBadge
            ]}>
              <View style={[
                styles.suggestedItemTypeIndicator,
                item.type === 'Veg' ? styles.vegIndicator : styles.nonVegIndicator
              ]} />
            </View>
            <Text style={styles.suggestedItemName} numberOfLines={1}>{item.item_name}</Text>
          </View>
          
          <View style={styles.itemDetails}>
            {item.discount_active ? (
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>₹{item.original_item_price?.toFixed(2)}</Text>
                <Text style={styles.discountText}>{item.discount_percent}% OFF</Text>
              </View>
            ) : null}
            
            <Text style={styles.itemPrice}>₹{(item.item_price).toFixed(2)}</Text>
          </View>
          
          <View style={styles.suggestedItemFooter}>
            {quantity > 0 ? (
              <View style={styles.quantityContainer}>
                <TouchableOpacity 
                  style={[
                    styles.quantityButton,
                    quantity <= 1 && styles.disabledButton
                  ]} 
                  onPress={() => updateItemQuantity(item.item_id, 'decrement', 'SUGGESTION')}
                  disabled={isUpdating || quantity <= 1}
                >
                  {isUpdating && currentAction === 'decrement' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="remove" size={16} color={quantity <= 1 ? "#ccc" : "#E65C00"} />
                  )}
                </TouchableOpacity>
                
                <Text style={styles.quantityText}>{quantity}</Text>
                
                <TouchableOpacity 
                  style={styles.quantityButton} 
                  onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                  disabled={isUpdating}
                >
                  {isUpdating && currentAction === 'increment' ? (
                    <ActivityIndicator size="small" color="#E65C00" />
                  ) : (
                    <Icon name="add" size={16} color="#E65C00" />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.addItemButton,
                  isUpdating && styles.addItemButtonDisabled
                ]}
                onPress={() => updateItemQuantity(item.item_id, 'increment', 'SUGGESTION')}
                disabled={isUpdating}
              >
                {isUpdating && currentAction === 'increment' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addItemButtonText}>ADD</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyCart = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyHeader}>
        <TouchableOpacity 
          onPress={BackToKitchen}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.emptyHeaderTitle}>{cartData?.restaurant_name || 'Your Cart'}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.emptyContent}>
        <View style={styles.emptyIllustration}>
          <Icon name="cart-outline" size={60} color="#E65C00" />
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptyDescription}>
          Looks like you haven't added anything to your cart yet
        </Text>
        
        <TouchableOpacity 
          style={styles.exploreButton}
          onPress={BackToKitchen}
        >
          <Text style={styles.exploreButtonText}>Browse Menu</Text>
          <Icon name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
        <View style={styles.emptySuggestionsContainer}>
          <Text style={styles.suggestionTitle}>Popular Items from {cartData.restaurant_name}</Text>
          <FlatList
            data={cartData.suggestion_cart_items}
            renderItem={renderSuggestedItem}
            keyExtractor={item => item.item_id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedItemsContainer}
          />
        </View>
      )}
    </View>
  );

  const renderCartContent = () => (
    <ScrollView 
      style={styles.scrollContainer}
      contentContainerStyle={styles.scrollContentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#E65C00']}
          tintColor="#E65C00"
        />
      }
    >
      {/* Your Order Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Order</Text>
          <Text style={styles.itemCount}>{cartData?.cart_details.length} {cartData?.cart_details.length === 1 ? 'item' : 'items'}</Text>
        </View>
        
        <View style={styles.cartItemsList}>
          <FlatList
            data={cartData?.cart_details}
            renderItem={renderCartItem}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
          />
        </View>
      </View>
      
      {/* Suggested Items Section */}
      {cartData?.suggestion_cart_items && cartData.suggestion_cart_items.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add More From {cartData.restaurant_name}</Text>
          </View>
          <FlatList
            data={cartData.suggestion_cart_items}
            renderItem={renderSuggestedItem}
            keyExtractor={item => item.item_id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestedItemsContainer}
          />
        </View>
      )}
      
      {/* Delivery Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Details</Text>
        
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Icon name="location-outline" size={20} color="#E65C00" style={styles.detailIcon} />
            <View style={styles.addressContainer}>
              <Text style={styles.detailText}>{fullAddress}</Text>
              <TouchableOpacity 
                style={styles.changeAddressButton}
                onPress={handleAddressChange}
              >
                <Text style={styles.changeAddressText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Icon name="time-outline" size={20} color="#E65C00" style={styles.detailIcon} />
            <Text style={styles.detailText}>Deliver by {cartData?.delivery_time.estimated_time}</Text>
          </View>
          
          {user?.contact_number && (
            <View style={styles.detailRow}>
              <Icon name="call-outline" size={20} color="#E65C00" style={styles.detailIcon} />
              <Text style={styles.detailText}>Contact: {user.contact_number}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Bill Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill Details</Text>
        
        <View style={styles.billCard}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{cartData?.billing_details.subtotal.toFixed(2)}</Text>
          </View>
          
          {cartData?.billing_details.delivery_fee ? (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Fee</Text>
              <Text style={styles.billValue}>₹{cartData.billing_details.delivery_fee.toFixed(2)}</Text>
            </View>
          ) : null}
          
          {cartData?.billing_details.tax ? (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Tax</Text>
              <Text style={styles.billValue}>₹{cartData.billing_details.tax.toFixed(2)}</Text>
            </View>
          ) : null}
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{cartData?.billing_details.total.toFixed(2)}</Text>
          </View>
        </View>
      </View>
      
      {/* Note Section */}
      <View style={styles.noteCard}>
        <Icon name="information-circle-outline" size={20} color="#E65C00" />
        <Text style={styles.noteText}>Order cannot be cancelled once packed for delivery</Text>
      </View>
    </ScrollView>
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <View style={styles.errorIcon}>
              <Icon name="warning-outline" size={48} color="#E65C00" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={fetchCartData}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={BackToKitchen}
            >
              <Text style={styles.secondaryButtonText}>Back to Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !cartData) {

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E65C00" />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCartEmpty = !cartData?.cart_details || cartData.cart_details.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {isCartEmpty ? (
        renderEmptyCart()
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={BackToKitchen}
              style={styles.backButton}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.restaurantName}>{cartData?.restaurant_name}</Text>
              <TouchableOpacity 
                onPress={handleAddressChange}
                style={styles.headerAddressContainer}
              >
                <Icon name="location-outline" size={16} color="#E65C00" />
                <Text style={styles.headerAddressText} numberOfLines={1}>
                  {shortAddress}
                </Text>
                <Icon name="chevron-down" size={16} color="#E65C00" style={styles.downArrowIcon} />
              </TouchableOpacity>
            </View>
          </View>
          {renderCartContent()}
        </>
      )}
      
      {/* Payment Footer - Only show if cart has items */}
      {!isCartEmpty && (
        <View style={styles.paymentFooter}>
          <View style={styles.swipeContainer}>
            <View style={styles.swipeTrack}>
              <Text style={styles.swipeHint}>Swipe to pay ₹{cartData?.billing_details.total.toFixed(2)}</Text>
              <View style={styles.swipeArrows}>
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
                    outputRange: [80, SWIPE_THRESHOLD + 180],
                    extrapolate: 'clamp'
                  }),
                  backgroundColor: swipeAnim.interpolate({
                    inputRange: [0, SWIPE_THRESHOLD],
                    outputRange: ['#E65C00', '#4CAF50'],
                    extrapolate: 'clamp'
                  })
                }
              ]}
              {...panResponder.panHandlers}
            >
              <View style={styles.swipeButtonContent}>
                {isProcessingPayment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
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
                      {isSwiped ? "Processing..." : `Pay ₹${cartData?.billing_details.total.toFixed(2)}`}
                    </Animated.Text>
                  </>
                )}
              </View>
            </Animated.View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 100,
  },
  downArrowIcon: {
    marginLeft: 4,
  },
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  headerAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAddressText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  
  // Section styles
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom:10,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  
  // Cart Item Container
  cartItemContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cartItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Veg/Non-Veg Indicator
  itemTypeContainer: {
    marginRight: 12,
  },
  itemTypeBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegBadge: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  nonVegBadge: {
    borderColor: '#E65C00',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  itemTypeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#E65C00',
  },
  
  // Item Details
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountText: {
    fontSize: 13,
    color: '#E65C00',
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bogoBadge: {
    backgroundColor: '#FFEB3B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  bogoText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  
  // Quantity Controls
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffd6d6',
  },
  quantityButton: {
    padding: 4,
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65C00',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  
  // Suggested items
  suggestedItemsContainer: {
    paddingBottom: 8,
    paddingLeft: 16,
  },
  suggestedItemCard: {
    width: width * 0.45,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestedItemImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f5f5f5',
  },
  suggestedItemContent: {
    padding: 12,
  },
  suggestedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestedItemTypeBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  suggestedItemTypeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  suggestedItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  suggestedItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addItemButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButtonDisabled: {
    opacity: 0.7,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Detail card
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    marginRight: 12,
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
  changeAddressButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeAddressText: {
    color: '#E65C00',
    fontWeight: '500',
    fontSize: 14,
  },
  
  // Bill card
  billCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
    color: '#E65C00',
  },
  
  // Note card
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  exploreButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    marginTop: 24,
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  
  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#E65C00',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    width: '80%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Payment footer
  paymentFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  swipeContainer: {
    height: 56,
    justifyContent: 'center',
  },
  swipeTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: '#f5f5f5',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
  },
  swipeHint: {
    fontSize: 16,
    color: '#666',
    marginRight: 10,
    marginLeft: 60,
  },
  swipeArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeButton: {
    position: 'absolute',
    height: 56,
    borderRadius: 28,
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
    paddingHorizontal: 24,
    height: '100%',
  },
  swipeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  
  // Misc
  cartItemsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptySuggestionsContainer: {
    marginBottom: 20,
  },
});

export default CartScreen;