import React, { useState, useRef } from 'react';
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
  PanResponder
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.7 - 80;

const CartScreen = ({ route, navigation }) => {
  // Extract parameters passed from HomeKitchenDetails
  const { cartItems: initialCartItems = [], totalPrice: initialTotalPrice = 0, restaurant } = route.params || {};
  
  // State for cart items and total price
  const [cartItems, setCartItems] = useState(initialCartItems);
  const [totalPrice, setTotalPrice] = useState(initialTotalPrice);
  
  // User details
  const userAddress = "123 Main Street, Apartment 4B";
  const userPhone = "+91 9876543210";
  
  // Calculate fees
  const deliveryFee = Math.max(40, totalPrice * 0.1);
  const tax = totalPrice * 0.05;
  const grandTotal = totalPrice + deliveryFee + tax;

  // Swipe to pay animation
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const [isSwiped, setIsSwiped] = useState(false);

  const allSuggestedItems = [
    { id: '101', name: 'Garlic Naan', price: 35, type: 'Veg', image: 'https://www.eatoor.com/media/menu_images/egg_omlet.webp' },
    { id: '102', name: 'Paneer Tikka', price: 180, type: 'Veg', image: "https://www.eatoor.com/media/menu_images/vegetable_upma.webp" },
    { id: '103', name: 'Chicken Biryani', price: 220, type: 'Non-Veg', image: "https://www.eatoor.com/media/menu_images/vegetable_upma.webp" },
    { id: '104', name: 'Mango Lassi', price: 60, type: 'Veg', image: "https://www.eatoor.com/media/menu_images/vegetable_upma.webp" },
  ];

  // Filter out items already in cart
  const suggestedItems = allSuggestedItems.filter(
    suggestedItem => !cartItems.some(cartItem => cartItem.id === suggestedItem.id)
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0 && gestureState.dx <= SWIPE_THRESHOLD) {
          swipeAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > SWIPE_THRESHOLD / 2) {
          // Successful swipe
          Animated.timing(swipeAnim, {
            toValue: SWIPE_THRESHOLD,
            duration: 200,
            useNativeDriver: false
          }).start(() => {
            setIsSwiped(true);
            setTimeout(() => {
              navigation.navigate('Payment', {
                amount: grandTotal,
                restaurant: restaurant?.name,
                items: cartItems
              });
              // Reset after navigation
              swipeAnim.setValue(0);
              setIsSwiped(false);
            }, 500);
          });
        } else {
          // Return to original position
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  // Update quantity for cart items
  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      // Remove item if quantity is 0
      const updatedItems = cartItems.filter(item => item.id !== itemId);
      setCartItems(updatedItems);
      
      // Recalculate total price
      const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      setTotalPrice(newTotal);
      return;
    }
    
    const updatedItems = cartItems.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    
    setCartItems(updatedItems);
    
    // Recalculate total price
    const newTotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setTotalPrice(newTotal);
  };

  // Add suggested item to cart
  const addSuggestedItem = (item) => {
    const existingItem = cartItems.find(cartItem => cartItem.id === item.id);
    
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + 1);
    } else {
      const newItem = { ...item, quantity: 1 };
      setCartItems([...cartItems, newItem]);
      setTotalPrice(totalPrice + item.price);
    }
  };

  const renderCartItem = ({ item }) => (
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
        <Text style={styles.itemName}>{item.name}</Text>
      </View>
      
      <View style={styles.itemRight}>
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
          >
            <Icon name="remove" size={14} color="#e65c00" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
          >
            <Icon name="add" size={14} color="#e65c00" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.itemTotal}>₹{item.price * item.quantity}</Text>
      </View>
    </View>
  );

  const renderSuggestedItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.suggestedItem}
      onPress={() => addSuggestedItem(item)}
    >
      <Image source={{ uri: item.image }} style={styles.suggestedImage} />
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
          <Text style={styles.suggestedName}>{item.name}</Text>
        </View>
        <Text style={styles.suggestedPrice}>₹{item.price}</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => addSuggestedItem(item)}
        >
          <Text style={styles.addButtonText}>ADD +</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        
        {/* Empty Cart View */}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyHeader}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              style={styles.backButton}
            >
              <Icon name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <View style={{ width: 24 }} /> {/* Spacer for alignment */}
          </View>
          
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconContainer}>
              <Icon name="cart-outline" size={60} color="#e65c00" />
            </View>
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <Text style={styles.emptySubText}>Looks like you haven't added anything to your cart yet</Text>
            
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.goBack()} 
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
      
      {/* Restaurant Header */}
      <View style={styles.restaurantHeader}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName}>{restaurant?.name}</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Address')}
            style={styles.deliveryInfo}
          >
            <Icon name="location-outline" size={14} color="#333" />
            <Text style={styles.deliveryText}>{userAddress}</Text>
            <Icon name="chevron-down" size={16} color="#666" style={{ marginRight: 90 }} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.content}>
        {/* Cart Items */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Order</Text>
          <Text style={styles.itemCount}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Text>
        </View>
        
        <View style={styles.cartItemsContainer}>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>
        
        {/* Apply Coupon Button */}
        <TouchableOpacity style={styles.couponButton}>
          <View style={styles.couponIcon}>
            <Icon name="pricetag-outline" size={18} color="#e65c00" />
          </View>
          <Text style={styles.couponButtonText}>Apply Coupon</Text>
          <Icon name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>
        
        {/* Suggested Items - Only show if there are items to suggest */}
        {suggestedItems.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add More From {restaurant?.name}</Text>
            </View>
            <FlatList
              data={suggestedItems}
              renderItem={renderSuggestedItem}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedContainer}
            />
          </>
        )}
        
        {/* Delivery Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Delivery Details</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="location-outline" size={14} color="#333" />
            </View>
            <Text style={styles.detailText}>Address: {userAddress}</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="time-outline" size={16} color="#666" />
            </View>
            <Text style={styles.detailText}>Delivery in {restaurant?.deliveryTime}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Icon name="call-outline" size={16} color="#666" />
            </View>
            <Text style={styles.detailText}>Contact: {userPhone}</Text>
          </View>
        </View>
        
        {/* Bill Summary */}
        <View style={styles.billContainer}>
          <Text style={styles.billTitle}>Bill Details</Text>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{totalPrice.toFixed(2)}</Text>
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValue}>₹{deliveryFee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Tax (5%)</Text>
            <Text style={styles.billValue}>₹{tax.toFixed(2)}</Text>
          </View>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>
        
        {/* Extra space at bottom */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      
      {/* Swipe to Pay Button */}
      <View style={styles.swipeContainer}>
        <View style={styles.swipeTrack}>
          <Text style={styles.swipeHint}>Swipe right to confirm payment</Text>
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
              {isSwiped ? "Processing..." : `Pay ₹${grandTotal.toFixed(2)}`}
            </Animated.Text>
          </View>
        </Animated.View>
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
  exploreButton: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
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
    paddingBottom: 100,
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    marginRight: 10,
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
    flex: 1,
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
    marginBottom: 30,
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
  bottomSpacer: {
    height: 20,
  },
  swipeContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
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
    marginLeft:65,
    fontSize: 14,
    color: '#666',
    marginRight: 10,
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
    paddingHorizontal: 20,
    height: '100%',
  },
  swipeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  }
});

export default CartScreen;