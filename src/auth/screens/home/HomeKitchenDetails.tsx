import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  StatusBar,
  Modal,
  Dimensions,
  LayoutAnimation,
  UIManager,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getKitcheDetails } from '../../../api/home';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height, width } = Dimensions.get('window');

// Placeholder images
const PLACEHOLDER_FOOD = ""
const PLACEHOLDER_RESTAURANT = ""

type MenuItem = {
  id: string;
  name: string;
  price: number;
  type: 'Veg' | 'NonVeg';
  category: string;
  image: string;
  description: string;
  isBestseller?: boolean;
  quantity?: number;
  availability: boolean;
  discount_percent?: string | null;
  discount_active?: string;
  buy_one_get_one_free?: boolean | null;
};

type FilterItem = {
  id: string;
  name: string;
  icon: string;
};

type MenuCategory = {
  name: string;
  items: MenuItem[];
  expanded: boolean;
};

type KitchenDetails = {
  restaurant_name: string;
  restaurant_image: string;
  Address: string;
  rating: number;
  min_order: number;
  opening_time: string;
  closing_time: string;
  itemlist: Array<{
    id: string;
    item_name: string;
    item_price: string;
    description: string;
    item_image: string;
    food_type: string;
    category: string;
    availability: boolean;
    buy_one_get_one_free: boolean | null;
    discount_percent: string | null;
    discount_active: string;
  }>;
  delivery_timings: Array<{
    day: string;
    open: boolean;
    start_time: string;
    end_time: string;
  }>;
  restaurant_current_status: {
    is_open: boolean;
  };
};

const FILTERS: FilterItem[] = [
  { id: '1', name: 'All', icon: 'fast-food-outline' },
  { id: '2', name: 'Veg', icon: 'leaf-outline' },
  { id: '3', name: 'NonVeg', icon: 'nutrition-outline' },
  { id: '4', name: 'Offers', icon: 'pricetag-outline' },
  { id: '5', name: 'Bestseller', icon: 'star-outline' },
];

const HEADER_MAX_HEIGHT = 300;
const HEADER_MIN_HEIGHT = 100;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const VegNonVegIcon = ({ type, size = 16 }: { type: 'Veg' | 'NonVeg', size?: number }) => {
  return (
    <View style={[
      styles.vegNonVegIconContainer,
      type === 'Veg' ? styles.vegIcon : styles.nonVegIcon,
      { width: size, height: size }
    ]}>
      <View style={[
        styles.vegNonVegDot,
        { width: size * 0.5, height: size * 0.5 }
      ]} />
    </View>
  );
};

const HomeKitchenDetails = ({ route }) => {
  const navigation = useNavigation();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [cartItems, setCartItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [kitchenDetails, setKitchenDetails] = useState<KitchenDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const titleScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const titleTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const fetchKitchenDetails = async () => {
      try {
        setLoading(true);
        const response = await getKitcheDetails(route.params.kitchenId);
        
        // Transform API data to match our UI structure
        const transformedItems = response.data.itemlist.map(item => ({
          id: item.id,
          name: item.item_name,
          price: parseFloat(item.item_price),
          type: item.food_type === 'Non-Veg' ? 'NonVeg' : 'Veg',
          category: item.category,
          image: item.item_image.startsWith('http') ? item.item_image : null,
          description: item.description,
          availability: item.availability,
          isBestseller: false, // You might want to add this to your API or calculate it
          discount_percent: item.discount_percent,
          discount_active: item.discount_active === "1",
          buy_one_get_one_free: item.buy_one_get_one_free
        }));

        // Group menu items by category
        const categoryMap = transformedItems.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = [];
          }
          acc[item.category].push(item);
          return acc;
        }, {} as Record<string, MenuItem[]>);

        // Convert to array with expanded state
        const categories = Object.entries(categoryMap).map(([name, items]) => ({
          name,
          items,
          expanded: true,
        }));

        setKitchenDetails(response.data);
        setCategories(categories);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch kitchen details:', err);
        setError('Failed to load kitchen details. Please try again.');
        setLoading(false);
      }
    };

    fetchKitchenDetails();
  }, [route.params.kitchenId]);

  const toggleCategory = (categoryName: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategories(prevCategories =>
      prevCategories.map(category =>
        category.name === categoryName
          ? { ...category, expanded: !category.expanded }
          : category
      )
    );
  };

  const filteredCategories = categories.map(category => {
    const filteredItems = category.items.filter(item => {
      if (!item.availability) return false;
      
      switch (activeFilter) {
        case 'Veg': return item.type === 'Veg';
        case 'NonVeg': return item.type === 'NonVeg';
        case 'Bestseller': return item.isBestseller;
        case 'Offers': return item.discount_active || item.buy_one_get_one_free;
        default: return true;
      }
    });
    return { ...category, items: filteredItems };
  }).filter(category => category.items.length > 0);

  const itemCount = cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  const totalPrice = cartItems.reduce((total, item) => {
    const itemPrice = item.discount_active && item.discount_percent 
      ? item.price * (1 - parseFloat(item.discount_percent) / 100)
      : item.price;
    return total + (itemPrice * (item.quantity || 0));
  }, 0);

  const addToCart = (item: MenuItem) => {
    const existingItem = cartItems.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCartItems(cartItems.map(cartItem =>
        cartItem.id === item.id
          ? { ...cartItem, quantity: (cartItem.quantity || 0) + 1 }
          : cartItem
      ));
    } else {
      setCartItems([...cartItems, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    const existingItem = cartItems.find(item => item.id === itemId);
    if (existingItem && existingItem.quantity && existingItem.quantity > 1) {
      setCartItems(cartItems.map(item =>
        item.id === itemId
          ? { ...item, quantity: (item.quantity || 0) - 1 }
          : item
      ));
    } else {
      setCartItems(cartItems.filter(item => item.id !== itemId));
    }
  };

  const getItemQuantity = (itemId: string) => {
    const item = cartItems.find(item => item.id === itemId);
    return item?.quantity || 0;
  };

  const openModal = (item: MenuItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleViewCart = () => {
    if (!kitchenDetails) return;
    
    navigation.navigate('CartScreen', { 
      cartItems,
      totalPrice,
      restaurant: {
        name: kitchenDetails.restaurant_name,
        address: kitchenDetails.Address,
        minOrder: `₹${kitchenDetails.min_order}`,
        coverImage: kitchenDetails.restaurant_image || categories[0]?.items[0]?.image || ''
      } 
    });
  };

  const renderCategoryHeader = ({ name, expanded, itemCount }: { name: string; expanded: boolean; itemCount: number }) => {
    return (
      <TouchableOpacity 
        style={styles.categoryHeader} 
        onPress={() => toggleCategory(name)}
        activeOpacity={0.8}
      >
        <Text style={styles.categoryName}>{name}</Text>
        <View style={styles.categoryHeaderRight}>
          <Text style={styles.categoryItemCount}>{itemCount} items</Text>
          <Animated.View style={{
            transform: [{
              rotate: expanded ? '180deg' : '0deg'
            }]
          }}>
            <Icon name="chevron-down" size={20} color="#666" />
          </Animated.View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: MenuItem }) => {
    const quantity = getItemQuantity(item.id);
    const discountedPrice = item.discount_active && item.discount_percent 
      ? item.price * (1 - parseFloat(item.discount_percent) / 100)
      : null;
    
    return (
      <TouchableOpacity 
        style={[
          styles.card,
          !item.availability && styles.disabledCard
        ]} 
        onPress={() => openModal(item)}
        activeOpacity={0.9}
        disabled={!item.availability}
      >
        <View style={styles.cardContent}>
          <View style={styles.imageContainer}>
            <Image 
              source={item.image ? { uri: item.image } : PLACEHOLDER_FOOD}
              style={styles.foodImage}
              defaultSource={PLACEHOLDER_FOOD}
            />
            {item.isBestseller && (
              <View style={styles.bestsellerBadge}>
                <Icon name="star" size={12} color="#fff" />
                <Text style={styles.bestsellerText}>Bestseller</Text>
              </View>
            )}
            {(item.discount_active || item.buy_one_get_one_free) && (
              <View style={styles.offerBadge}>
                <Icon name="pricetag" size={12} color="#fff" />
                <Text style={styles.offerText}>
                  {item.buy_one_get_one_free 
                    ? 'BOGO' 
                    : `${parseFloat(item.discount_percent).toFixed(0)}% OFF`}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.foodDetails}>
            <View style={styles.foodHeader}>
              <Text style={styles.foodName}>{item.name}</Text>
              <View style={styles.priceContainer}>
                {discountedPrice && (
                  <Text style={styles.originalPrice}>₹{item.price.toFixed(2)}</Text>
                )}
                <Text style={styles.foodPrice}>
                  ₹{discountedPrice ? discountedPrice.toFixed(2) : item.price.toFixed(2)}
                </Text>
              </View>
            </View>
            <Text style={styles.foodDescription} numberOfLines={2}>{item.description}</Text>
            <View style={styles.priceRow}>
              <View style={styles.itemTypeContainer}>
                <VegNonVegIcon type={item.type} size={16} />
                <Text style={styles.typeText}>{item.type}</Text>
              </View>
              {quantity > 0 ? (
                <View style={styles.quantityContainer}>
                  <TouchableOpacity 
                    style={styles.quantityButton} 
                    onPress={(e) => {
                      e.stopPropagation();
                      removeFromCart(item.id);
                    }}
                  >
                    <Icon name="remove" size={18} color="#e65c00" />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <TouchableOpacity 
                    style={styles.quantityButton} 
                    onPress={(e) => {
                      e.stopPropagation();
                      addToCart(item);
                    }}
                  >
                    <Icon name="add" size={18} color="#e65c00" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[
                    styles.addToCartBtn,
                    !item.availability && styles.disabledAddToCartBtn
                  ]} 
                  onPress={(e) => {
                    e.stopPropagation();
                    addToCart(item);
                  }}
                  activeOpacity={0.8}
                  disabled={!item.availability}
                >
                  <Text style={styles.addToCartText}>
                    {!item.availability ? 'UNAVAILABLE' : 'ADD'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }: { item: MenuCategory }) => {
    return (
      <View style={styles.categoryContainer}>
        {renderCategoryHeader({
          name: item.name,
          expanded: item.expanded,
          itemCount: item.items.length
        })}
        {item.expanded && (
          <View style={styles.categoryItems}>
            {item.items.map(menuItem => (
              <View key={menuItem.id}>
                {renderItem({ item: menuItem })}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e65c00" />
        <Text style={styles.loadingText}>Loading restaurant details...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="sad-outline" size={50} color="#e65c00" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!kitchenDetails) {
    return null;
  }

  const deliveryTime = `40-45 mins`;
  const isOpen = kitchenDetails.restaurant_current_status?.is_open;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#e65c00" barStyle="light-content" />

      {/* Header with Kitchen Details */}
      <Animated.View style={[styles.headerContainer, { 
        transform: [{ translateY: headerTranslateY }],
        height: HEADER_MAX_HEIGHT,
      }]}>
        <Animated.Image
          source={kitchenDetails.restaurant_image ? { uri: kitchenDetails.restaurant_image } : PLACEHOLDER_RESTAURANT}
          style={[styles.coverImage, { opacity: imageOpacity }]}
          defaultSource={PLACEHOLDER_RESTAURANT}
        />
        <View style={styles.overlay} />
        
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Animated.View style={[styles.kitchenInfoContainer, {
          transform: [{ translateY: titleTranslateY }, { scale: titleScale }],
        }]}>
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusIndicator,
              isOpen ? styles.openStatus : styles.closedStatus
            ]} />
            <Text style={styles.statusText}>
              {isOpen ? 'OPEN NOW' : 'CLOSED'}
            </Text>
          </View>
          
          <Text style={styles.kitchenName}>{kitchenDetails.restaurant_name}</Text>
          
          <View style={styles.kitchenMetaRow}>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{kitchenDetails.rating}</Text>
            </View>
            <View style={styles.deliveryInfo}>
              <Icon name="time-outline" size={16} color="#fff" />
              <Text style={styles.deliveryText}>{deliveryTime}</Text>
            </View>
            <View style={styles.minOrderInfo}>
              <Icon name="basket-outline" size={16} color="#fff" />
              <Text style={styles.minOrderText}>
                {kitchenDetails.min_order > 0 ? `₹${kitchenDetails.min_order}` : '100'}
              </Text>
            </View>
          </View>
          
          <View style={styles.addressContainer}>
            <Icon name="location-outline" size={16} color="#fff" />
            <Text style={styles.kitchenAddress}>{kitchenDetails.Address}</Text>
          </View>
          
          <View style={styles.timingContainer}>
            <Icon name="time-outline" size={14} color="#fff" />
            <Text style={styles.timingText}>
              {kitchenDetails.opening_time} - {kitchenDetails.closing_time}
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Filters Section */}
      <Animated.View style={[styles.filterContainer, {
        transform: [{ translateY: headerTranslateY }],
      }]}>
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterBtn, 
                activeFilter === item.name && styles.activeFilterBtn
              ]}
              onPress={() => setActiveFilter(item.name)}
              activeOpacity={0.7}
            >
              {item.name === 'Veg' || item.name === 'NonVeg' ? (
                <VegNonVegIcon 
                  type={item.name === 'Veg' ? 'Veg' : 'NonVeg'} 
                  size={16} 
                />
              ) : (
                <Icon
                  name={item.icon}
                  size={16}
                  color={activeFilter === item.name ? '#fff' : '#555'}
                />
              )}
              <Text style={[
                styles.filterText, 
                activeFilter === item.name && styles.activeFilterText
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </Animated.View>

      {/* Menu Items List */}
      <AnimatedFlatList
        data={filteredCategories}
        keyExtractor={(item: MenuCategory) => item.name}
        renderItem={renderCategory}
        contentContainerStyle={styles.menuContainer}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ListHeaderComponent={<View style={{ height: HEADER_MAX_HEIGHT - 45 }} />}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />

      {/* Cart Summary */}
      {itemCount > 0 && (
        <View style={styles.cartSummary}>
          <View style={styles.cartSummaryContent}>
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.cartPriceText}>₹{totalPrice.toFixed(2)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewCartBtn}
              activeOpacity={0.8}
              onPress={handleViewCart}
            >
              <Text style={styles.viewCartText}>VIEW CART</Text>
              <Icon name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Item Details Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        {selectedItem && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Image 
                source={selectedItem.image ? { uri: selectedItem.image } : PLACEHOLDER_FOOD}
                style={styles.modalFoodImage}
                defaultSource={PLACEHOLDER_FOOD}
              />
              
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalFoodName}>{selectedItem.name}</Text>
                  <View style={styles.modalPriceContainer}>
                    {selectedItem.discount_active && selectedItem.discount_percent && (
                      <Text style={styles.modalOriginalPrice}>₹{selectedItem.price.toFixed(2)}</Text>
                    )}
                    <Text style={styles.modalFoodPrice}>
                      ₹
                      {selectedItem.discount_active && selectedItem.discount_percent
                        ? (selectedItem.price * (1 - parseFloat(selectedItem.discount_percent) / 100)).toFixed(2)
                        : selectedItem.price.toFixed(2)}
                    </Text>

                  </View>
                </View>
                
                <View style={styles.modalBadgeRow}>
                  {selectedItem.isBestseller && (
                    <View style={styles.modalBestsellerBadge}>
                      <Icon name="star" size={12} color="#fff" />
                      <Text style={styles.modalBestsellerText}>Bestseller</Text>
                    </View>
                  )}
                  {(selectedItem.discount_active || selectedItem.buy_one_get_one_free) && (
                    <View style={styles.modalOfferBadge}>
                      <Icon name="pricetag" size={12} color="#fff" />
                      <Text style={styles.modalOfferText}>
                        {selectedItem.buy_one_get_one_free ? 'BOGO' : `${selectedItem.discount_percent}% OFF`}
                      </Text>
                    </View>
                  )}
                  <View style={styles.modalTypeContainer}>
                    <VegNonVegIcon type={selectedItem.type} size={16} />
                    <Text style={styles.modalTypeText}>{selectedItem.type}</Text>
                  </View>
                </View>
                
                <Text style={styles.modalFoodDescription}>{selectedItem.description}</Text>
                
                <View style={styles.modalActions}>
                  <View style={styles.modalQuantityControls}>
                    <TouchableOpacity 
                      style={styles.modalQuantityButton}
                      onPress={() => removeFromCart(selectedItem.id)}
                      disabled={getItemQuantity(selectedItem.id) === 0}
                    >
                      <Icon 
                        name="remove" 
                        size={24} 
                        color={getItemQuantity(selectedItem.id) === 0 ? '#ccc' : '#e65c00'} 
                      />
                    </TouchableOpacity>
                    <Text style={styles.modalQuantityText}>
                      {getItemQuantity(selectedItem.id)}
                    </Text>
                    <TouchableOpacity 
                      style={styles.modalQuantityButton}
                      onPress={() => addToCart(selectedItem)}
                      disabled={!selectedItem.availability}
                    >
                      <Icon 
                        name="add" 
                        size={24} 
                        color={!selectedItem.availability ? '#ccc' : '#e65c00'} 
                      />
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity 
                    style={[
                      styles.addToCartBtnLarge,
                      !selectedItem.availability && styles.disabledAddToCartBtnLarge
                    ]}
                    onPress={() => {
                      if (selectedItem.availability) {
                        addToCart(selectedItem);
                      }
                    }}
                  >
                    <Text style={styles.addToCartTextLarge}>
                      {!selectedItem.availability 
                        ? 'UNAVAILABLE' 
                        : getItemQuantity(selectedItem.id) > 0 
                          ? 'UPDATE CART' 
                          : 'ADD TO CART'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    marginTop: 15,
  },
  retryButton: {
    backgroundColor: '#e65c00',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  kitchenInfoContainer: {
    position: 'absolute',
    bottom: 55,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  openStatus: {
    backgroundColor: '#4CAF50',
  },
  closedStatus: {
    backgroundColor: '#F44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  kitchenName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  kitchenMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  ratingText: {
    marginLeft: 4,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  deliveryText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  minOrderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  minOrderText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  kitchenAddress: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flexShrink: 1,
  },
  timingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timingText: {
    fontSize: 13,
    color: '#fff',
    marginLeft: 6,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  filterContainer: {
    position: 'absolute',
    top: HEADER_MAX_HEIGHT - 50,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 15,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  filterRow: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  activeFilterBtn: {
    backgroundColor: '#e65c00',
    borderColor: '#e65c00',
  },
  filterText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
    marginLeft: 6,
  },
  activeFilterText: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryContainer: {
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryItemCount: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  categoryItems: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledCard: {
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  imageContainer: {
    position: 'relative',
  },
  foodImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    resizeMode: 'cover',
    backgroundColor: '#f5f5f5',
  },
  bestsellerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e65c00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestsellerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  offerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  foodDetails: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'space-between',
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#333',
    marginRight: 8,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  foodPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  foodDescription: {
    color: '#666',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  itemTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vegNonVegIconContainer: {
    borderWidth: 1,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  vegIcon: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  nonVegIcon: {
    borderColor: '#F44336',
    backgroundColor: '#F44336',
  },
  vegNonVegDot: {
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  typeText: {
    fontSize: 12,
    color: '#555',
  },
  addToCartBtn: {
    backgroundColor: '#e65c00',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 20,
  },
  disabledAddToCartBtn: {
    backgroundColor: '#ccc',
  },
  addToCartText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f0',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#ffd6c5',
  },
  quantityButton: {
    padding: 4,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e65c00',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  cartSummary: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  cartSummaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartCount: {},
  cartCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  cartPriceText: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
    fontWeight: '600',
  },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  viewCartText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  menuContainer: {
    paddingHorizontal: 5,
    paddingBottom: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.85,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  modalFoodImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#f5f5f5',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalFoodName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    marginRight: 10,
  },
  modalPriceContainer: {
    alignItems: 'flex-end',
  },
  modalFoodPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e65c00',
  },
  modalOriginalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  modalBestsellerBadge: {
    backgroundColor: '#e65c00',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBestsellerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalOfferBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOfferText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  modalTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTypeText: {
    fontSize: 12,
    color: '#555',
    marginLeft: 6,
  },
  modalFoodDescription: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  modalQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f0',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffd6c5',
  },
  modalQuantityButton: {
    padding: 6,
  },
  modalQuantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e65c00',
    marginHorizontal: 12,
    minWidth: 24,
    textAlign: 'center',
  },
  addToCartBtnLarge: {
    backgroundColor: '#e65c00',
    borderRadius: 25,
    paddingVertical: 16,
    paddingHorizontal: 25,
    alignItems: 'center',
    shadowColor: '#e65c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    flex: 1,
    marginLeft: 15,
  },
  disabledAddToCartBtnLarge: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  addToCartTextLarge: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default HomeKitchenDetails;