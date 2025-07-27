import React, { useRef, useState } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { height, width } = Dimensions.get('window');

type MenuItem = {
  id: string;
  name: string;
  price: number;
  type: 'Veg' | 'NonVeg';
  category: string;
  image: string;
  description: string;
  ingredients: string;
  calories: string;
  isBestseller: boolean;
  quantity?: number;
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

const DUMMY_KITCHEN = {
  name: 'Spice Garden',
  address: '123 MG Road, Thane',
  deliveryTime: '30-40 mins',
  rating: '4.5',
  reviews: '1.2k',
  minOrder: '₹150',
  coverImage: 'https://www.eatoor.com/media/restaurant_profile_images/image2.png',
};

const DUMMY_MENU: MenuItem[] = [
  {
    id: '1',
    name: 'Paneer Butter Masala',
    price: 220,
    type: 'Veg',
    category: 'Main Course',
    image: 'https://i.imgur.com/5mZwK5D.jpg',
    description: 'Cottage cheese cooked in rich creamy tomato gravy with butter',
    ingredients: 'Paneer, Tomatoes, Cream, Butter, Spices',
    calories: '450 kcal',
    isBestseller: true,
  },
  {
    id: '2',
    name: 'Chicken Biryani',
    price: 280,
    type: 'NonVeg',
    category: 'Main Course',
    image: 'https://i.imgur.com/UPrs1EW.jpg',
    description: 'Aromatic basmati rice cooked with chicken and spices',
    ingredients: 'Chicken, Basmati Rice, Yogurt, Spices, Herbs',
    calories: '650 kcal',
    isBestseller: true,
  },
  {
    id: '3',
    name: 'Veg Hakka Noodles',
    price: 160,
    type: 'Veg',
    category: 'Chinese',
    image: 'https://i.imgur.com/MABUbpD.jpg',
    description: 'Stir fried noodles with fresh vegetables and sauces',
    ingredients: 'Noodles, Capsicum, Carrot, Cabbage, Soy Sauce',
    calories: '380 kcal',
    isBestseller: false,
  },
  {
    id: '4',
    name: 'Butter Naan',
    price: 60,
    type: 'Veg',
    category: 'Breads',
    image: 'https://i.imgur.com/yXOvdOS.jpg',
    description: 'Soft leavened bread brushed with butter',
    ingredients: 'Flour, Yeast, Yogurt, Butter',
    calories: '260 kcal',
    isBestseller: false,
  },
  {
    id: '5',
    name: 'Chocolate Lava Cake',
    price: 120,
    type: 'Veg',
    category: 'Dessert',
    image: 'https://i.imgur.com/QVF7UZs.jpg',
    description: 'Warm chocolate cake with molten center, served with ice cream',
    ingredients: 'Chocolate, Flour, Eggs, Butter, Sugar',
    calories: '420 kcal',
    isBestseller: true,
  },
  {
    id: '6',
    name: 'Dal Makhani',
    price: 180,
    type: 'Veg',
    category: 'Main Course',
    image: 'https://i.imgur.com/JQJqZQz.jpg',
    description: 'Black lentils cooked with butter and cream',
    ingredients: 'Black Lentils, Butter, Cream, Spices',
    calories: '380 kcal',
    isBestseller: false,
  },
  {
    id: '7',
    name: 'Chicken Tikka',
    price: 240,
    type: 'NonVeg',
    category: 'Starters',
    image: 'https://i.imgur.com/9X9X9X9.jpg',
    description: 'Grilled chicken chunks marinated in spices and yogurt',
    ingredients: 'Chicken, Yogurt, Spices, Herbs',
    calories: '320 kcal',
    isBestseller: true,
  },
  {
    id: '8',
    name: 'Gulab Jamun',
    price: 90,
    type: 'Veg',
    category: 'Dessert',
    image: 'https://i.imgur.com/8X8X8X8.jpg',
    description: 'Deep-fried milk balls soaked in sugar syrup',
    ingredients: 'Milk Powder, Flour, Sugar, Ghee',
    calories: '280 kcal',
    isBestseller: false,
  },
];

const FILTERS: FilterItem[] = [
  { id: '1', name: 'All', icon: 'fast-food-outline' },
  { id: '2', name: 'Veg', icon: 'leaf-outline' },
  { id: '3', name: 'NonVeg', icon: 'nutrition-outline' },
  { id: '4', name: 'Bestseller', icon: 'star-outline' },
  { id: '5', name: 'Chinese', icon: 'restaurant-outline' },
  { id: '6', name: 'Dessert', icon: 'ice-cream-outline' },
];

const HEADER_MAX_HEIGHT = 280;
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

const HomeKitchenDetails = () => {
  const navigation = useNavigation();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [cartItems, setCartItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    // Group menu items by category
    const categoryMap = DUMMY_MENU.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);

    // Convert to array with expanded state
    return Object.entries(categoryMap).map(([name, items]) => ({
      name,
      items,
      expanded: true, // Initially all categories are expanded
    }));
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [0, -HEADER_SCROLL_DISTANCE],
    extrapolate: 'clamp',
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 1, 0],
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
      switch (activeFilter) {
        case 'Veg': return item.type === 'Veg';
        case 'NonVeg': return item.type === 'NonVeg';
        case 'Bestseller': return item.isBestseller;
        case 'Chinese': return item.category === 'Chinese';
        case 'Dessert': return item.category === 'Dessert';
        default: return true;
      }
    });
    return { ...category, items: filteredItems };
  }).filter(category => category.items.length > 0); // Remove empty categories

  const itemCount = cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  const totalPrice = cartItems.reduce((total, item) => total + (item.price * (item.quantity || 0)), 0);

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
    navigation.navigate('CartScreen', { 
      cartItems,
      totalPrice,
      restaurant: DUMMY_KITCHEN 
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
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => openModal(item)}
        activeOpacity={0.9}
      >
        <View style={styles.cardContent}>
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.image }} style={styles.foodImage} />
            {item.isBestseller && (
              <View style={styles.bestsellerBadge}>
                <Icon name="star" size={12} color="#fff" />
                <Text style={styles.bestsellerText}>Bestseller</Text>
              </View>
            )}
          </View>
          <View style={styles.foodDetails}>
            <View style={styles.foodHeader}>
              <Text style={styles.foodName}>{item.name}</Text>
              <Text style={styles.foodPrice}>₹{item.price}</Text>
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
                  style={styles.addToCartBtn} 
                  onPress={(e) => {
                    e.stopPropagation();
                    addToCart(item);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addToCartText}>ADD</Text>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#e65c00" barStyle="light-content" />

      {/* Header with Kitchen Details */}
      <Animated.View style={[styles.headerContainer, { 
        transform: [{ translateY: headerTranslateY }],
        height: HEADER_MAX_HEIGHT,
      }]}>
        <Animated.Image
          source={{ uri: DUMMY_KITCHEN.coverImage }}
          style={[styles.coverImage, { opacity: imageOpacity }]}
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
          <Text style={styles.kitchenName}>{DUMMY_KITCHEN.name}</Text>
          <View style={styles.kitchenMetaRow}>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{DUMMY_KITCHEN.rating} ({DUMMY_KITCHEN.reviews})</Text>
            </View>
            <View style={styles.deliveryInfo}>
              <Icon name="time-outline" size={14} color="#fff" />
              <Text style={styles.deliveryText}>{DUMMY_KITCHEN.deliveryTime}</Text>
            </View>
            <View style={styles.minOrderInfo}>
              <Icon name="basket-outline" size={14} color="#fff" />
              <Text style={styles.minOrderText}>{DUMMY_KITCHEN.minOrder}</Text>
            </View>
          </View>
          <Text style={styles.kitchenAddress}>
            <Icon name="location-outline" size={12} color="#fff" /> {DUMMY_KITCHEN.address}
          </Text>
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
              <Text style={styles.cartPriceText}>₹{totalPrice}</Text>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: selectedItem?.image }} style={styles.modalFoodImage} />
            
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalFoodName}>{selectedItem?.name}</Text>
                <Text style={styles.modalFoodPrice}>₹{selectedItem?.price}</Text>
              </View>
              
              <View style={styles.modalBadgeRow}>
                {selectedItem?.isBestseller && (
                  <View style={styles.modalBestsellerBadge}>
                    <Icon name="star" size={12} color="#fff" />
                    <Text style={styles.modalBestsellerText}>Bestseller</Text>
                  </View>
                )}
                <View style={styles.modalTypeContainer}>
                  <VegNonVegIcon type={selectedItem?.type || 'Veg'} size={16} />
                  <Text style={styles.modalTypeText}>{selectedItem?.type}</Text>
                </View>
              </View>
              
              <Text style={styles.modalFoodDescription}>{selectedItem?.description}</Text>
              
              <View style={styles.modalActions}>
                <View style={styles.modalQuantityControls}>
                  <TouchableOpacity 
                    style={styles.modalQuantityButton}
                    onPress={() => selectedItem && removeFromCart(selectedItem.id)}
                    disabled={!selectedItem || getItemQuantity(selectedItem.id) === 0}
                  >
                    <Icon 
                      name="remove" 
                      size={24} 
                      color={!selectedItem || getItemQuantity(selectedItem.id) === 0 ? '#ccc' : '#e65c00'} 
                    />
                  </TouchableOpacity>
                  <Text style={styles.modalQuantityText}>
                    {selectedItem ? getItemQuantity(selectedItem.id) : 0}
                  </Text>
                  <TouchableOpacity 
                    style={styles.modalQuantityButton}
                    onPress={() => selectedItem && addToCart(selectedItem)}
                  >
                    <Icon name="add" size={24} color="#e65c00" />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={styles.addToCartBtnLarge}
                  onPress={() => {
                    if (selectedItem) {
                      addToCart(selectedItem);
                    }
                  }}
                >
                  <Text style={styles.addToCartTextLarge}>
                    {selectedItem && getItemQuantity(selectedItem.id) > 0 ? 'UPDATE CART' : 'ADD TO CART'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 6,
  },
  kitchenInfoContainer: {
    position: 'absolute',
    bottom: 55,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  kitchenName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  kitchenMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  ratingText: {
    marginLeft: 4,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  deliveryText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  minOrderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minOrderText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  kitchenAddress: {
    fontSize: 14,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  filterContainer: {
    position: 'absolute',
    top: HEADER_MAX_HEIGHT - 50,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: '#fff',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
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
    shadowRadius: 4,
    elevation: 2,
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
  foodPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
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
    borderRadius: 10,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
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
    fontSize: 15,
    color: '#fff',
    marginTop: 4,
    fontWeight: '600',
  },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  viewCartText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  menuContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
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
    padding: 6,
  },
  modalFoodImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  modalFoodPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e65c00',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  modalSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
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
  addToCartTextLarge: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default HomeKitchenDetails;