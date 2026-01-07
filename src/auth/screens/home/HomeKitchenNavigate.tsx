import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  Dimensions,
  FlatList,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { searchSuggestions, searchResult } from '../../../api/search';
import SearchModal from './searchmodal';
import { updateCart } from '../../../api/cart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionId } from "../../../utlis/utils";

const { width, height } = Dimensions.get('window');
const isIOS = Platform.OS === 'ios';
const isSmallDevice = width < 375;

// Session ID utility function
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const HomeKitchenNavigate = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const searchInputRef = useRef(null);

  const [kitchens, setKitchens] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [filteredKitchens, setFilteredKitchens] = useState([]);
  const [filteredDishes, setFilteredDishes] = useState([]);
  const [searchQuery, setSearchQuery] = useState(route?.params?.params?.query || '');
  const [selectedKitchen, setSelectedKitchen] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState('kitchens');
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedSort, setSelectedSort] = useState('Relevance');
  const [loading, setLoading] = useState(false);
  
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestionsData, setSearchSuggestionsData] = useState(null);

  // Cart related states
  const [sessionId, setSessionId] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [hasDifferentKitchenItems, setHasDifferentKitchenItems] = useState(false);
  const [showKitchenConflictModal, setShowKitchenConflictModal] = useState(false);
  const [pendingCartAction, setPendingCartAction] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [pastKitchenDetails, setPastKitchenDetails] = useState(null);

  const searchBarAnim = useRef(new Animated.Value(0)).current;
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  const [activeFilters, setActiveFilters] = useState({
    sort: 'Relevance',
    veg: false,
    nonVeg: false,
    rated4Plus: false,
  });

  const initializeSession = useCallback(async () => {
    try {
      console.log("Initializing session...");
      let session = await getSessionId();
      
      if (!session) {
        console.log("No existing session found, creating new one...");
        session = await getSessionId();
        console.log("New session created:", session);
      } else {
        console.log("Existing session found:", session);
      }
      
      setSessionId(session);
      
      return session;
    } catch (error) {
      console.error("Error initializing session:", error);
      // Create a fallback session
      const fallbackSession = await getSessionId();
      setSessionId(fallbackSession);
      return fallbackSession;
    }
  }, []);

  // Initialize session ID
  useEffect(() => {
    loadPastKitchenDetails();
    initializeSession();
  }, []);

  const loadPastKitchenDetails = async () => {
    try {
      const savedDetails = null;
      if (savedDetails) {
        setPastKitchenDetails(JSON.parse(savedDetails));
      }
    } catch (error) {
      console.error('Error loading past kitchen details:', error);
    }
  };

  const savePastKitchenDetails = async (details) => {
    try {
      setPastKitchenDetails(details);
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  };

  const loadRecentSearches = async () => {
    const savedSearches = ['Pizza', 'Burger', 'Sushi', 'Pasta'];
    setRecentSearches(savedSearches);
    setSearchHistory(savedSearches);
  };

  const saveToRecentSearches = (query) => {
    if (!query.trim()) return;
    
    const newRecentSearches = [query, ...recentSearches.filter(item => item !== query)].slice(0, 5);
    setRecentSearches(newRecentSearches);
    setSearchHistory(newRecentSearches);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    setSearchHistory([]);
  };

  const openSearchModal = () => {
    setIsSearchModalVisible(true);
    Animated.timing(searchBarAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeSearchModal = () => {
    setIsSearchModalVisible(false);
    setSearchResults([]);
    setSearchSuggestionsData(null);
    Animated.timing(searchBarAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
  };

  const handleRecentSearchPress = (searchTerm) => {
    setSearchQuery(searchTerm);
    fetchSearchResults(searchTerm);
    saveToRecentSearches(searchTerm);
    closeSearchModal();
  };

  const handlePopularSearchPress = (searchTerm) => {
    setSearchQuery(searchTerm);
    fetchSearchResults(searchTerm);
    saveToRecentSearches(searchTerm);
    closeSearchModal();
  };
  
  const handleSearchResultPress = useCallback((item) => {
      saveToRecentSearches(item.name, item);
      closeSearchModal();
      
      if (item.type === 'restaurant') {
        navigation.navigate('HomeKitchenDetails', { 
          kitchenId: item.originalData?.restaurant_id || item.id.replace('restaurant-', '')
        });
      } else {
        navigation.navigate('HomeKitchenNavigate', { 
          screen: 'SearchResults', 
          params: { 
            query: item.name,
            itemId: item.id.replace('menu-', ''),
            suggestionsData: searchSuggestionsData
          } 
        });
      }
    }, [closeSearchModal, navigation, saveToRecentSearches, searchSuggestionsData]);

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
    fetchSearchResults(searchQuery);
    saveToRecentSearches(searchQuery);
    closeSearchModal();
  };

  const calculateDiscountedPrice = (originalPrice, discountPercent) => {
    if (!discountPercent || discountPercent <= 0) return null;
    
    const original = parseFloat(originalPrice);
    const discounted = original * (1 - discountPercent / 100);
    
    return {
      discounted: `₹${discounted.toFixed(2)}`,
      original: `₹${original.toFixed(2)}`,
      savings: `₹${(original - discounted).toFixed(2)}`,
      percentage: `${discountPercent}%`
    };
  };

  const formatKitchenData = (restaurants) => {
    return restaurants.map((restaurant, index) => {
      return {
        id: restaurant.restaurant_id || `restaurant-${index}`,
        name: restaurant.restaurant_name,
        rating: restaurant.rating || 4.5,
        deliveryTime: restaurant.delivery_time || '25-35 min',
        image: restaurant.profile_image,
        featuredDish: restaurant.cuisines?.[0]?.cuisine_name || 'Special Dish',
        category: restaurant.cuisines?.map(c => c.cuisine_name).filter(Boolean).join(', ') || 'Multi-cuisine',
        discount: restaurant.discount || '20% OFF',
        promoted: false,
        distance: restaurant.distance || '1.5 km',
        isFavorite: false,
        originalData: restaurant,
        restaurant_current_status: restaurant.restaurant_current_status || { is_open: true }
      };
    });
  };

  const formatDishData = (menus) => {
    const dishes = [];
    menus.forEach(menu => {
      menu.items.forEach(item => {
        const discountPercent = item.discount_percent || 0;
        const originalPrice = item.discount_price && item.discount_active ? 
          item.discount_price / (1 - discountPercent / 100) : 
          item.item_price;
        
        const priceData = calculateDiscountedPrice(originalPrice, discountPercent);
        const finalPrice = item.discount_active && item.discount_price ? 
          `₹${item.discount_price.toFixed(2)}` : 
          `₹${item.item_price.toFixed(2)}`;
        
        dishes.push({
          id: item.id.toString(),
          name: item.item_name,
          kitchen: item.restaurant?.restaurant_name || 'Unknown Kitchen',
          originalPrice: `₹${originalPrice.toFixed(2)}`,
          price: finalPrice,
          rating: 4.5,
          image: item.item_image || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8Zm9vZCUyMGRpc2h8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
          description: `${item.item_name} - ${item.spice_level || 'Freshly prepared'}`,
          category: menu.menu_name,
          isVeg: item.food_type === 'Veg',
          bestSeller: Math.random() > 0.5,
          isFavorite: false,
          availability: item.availability,
          discount: discountPercent > 0 ? `${discountPercent}% OFF` : null,
          discountPercent: discountPercent,
          discountActive: item.discount_active,
          discountPrice: item.discount_price,
          priceData: priceData,
          originalData: item,
          restaurant_id: item.restaurant?.restaurant_id,
          spiceLevel: item.spice_level,
          servingSize: item.serving_size,
          preparationTime: item.preparation_time,
          buyOneGetOneFree: item.buy_one_get_one_free
        });
      });
    });
    return dishes;
  };

  const fetchSearchResults = async (query) => {
    if (!query || query.trim() === '') {
      setFilteredKitchens(kitchens);
      setFilteredDishes(dishes);
      return;
    }

    try {
      setLoading(true);
      const response = await searchResult(query);
      
      if (response && response.data) {
        // Updated to match new API response structure
        const formattedKitchens = formatKitchenData(response.data.restaurants || []);
        setFilteredKitchens(formattedKitchens);
        
        const formattedDishes = formatDishData(response.data.menus || []);
        setFilteredDishes(formattedDishes);
        
        setKitchens(formattedKitchens);
        setDishes(formattedDishes);
        
        saveToRecentSearches(query);
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
      handleLocalSearch(query);
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchSuggestions = useCallback(async (query) => {
    if (query.length < 1) {
      setSearchSuggestionsData(null);
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    try {
      setSearchLoading(true);

      const response = await searchSuggestions(query);
      if (response?.data) {
        setSearchSuggestionsData(response.data);
        
        const transformedResults = [];
        
        // Process menus and items
        response.data.menus?.forEach(menu => {
          menu.items?.forEach(item => {
            const discountPercent = item.discount_percent || 0;
            const finalPrice = item.discount_active && item.discount_price ? 
              `₹${item.discount_price.toFixed(2)}` : 
              `₹${item.item_price.toFixed(2)}`;
            
            transformedResults.push({
              id: `menu-${item.id}`,
              name: item.item_name,
              image: item.item_image,
              type: 'food',
              category: menu.menu_name,
              price: finalPrice,
              foodType: item.food_type,
              restaurant: item.restaurant,
              originalData: item,
              rating: Math.random() * 2 + 3,
              deliveryTime: `${item.preparation_time || Math.floor(Math.random() * 20) + 15} min`,
              discountPercent: discountPercent,
              discountActive: item.discount_active,
              spiceLevel: item.spice_level
            });
          });
        });
        
        // Process restaurants
        response.data.restaurants?.forEach(restaurant => {
          const cuisineNames = restaurant.cuisines
            ?.filter(cuisine => cuisine.cuisine_name)
            ?.map(cuisine => cuisine.cuisine_name)
            ?.join(', ') || 'Various cuisines';
            
          transformedResults.push({
            id: `restaurant-${restaurant.restaurant_id}`,
            name: restaurant.restaurant_name,
            image: restaurant.profile_image,
            type: 'restaurant',
            category: cuisineNames,
            originalData: restaurant,
            rating: restaurant.rating || Math.random() * 2 + 3,
            deliveryTime: restaurant.delivery_time || `${Math.floor(Math.random() * 20) + 15}-${Math.floor(Math.random() * 20) + 35} min`,
            distance: restaurant.distance || `${(Math.random() * 5).toFixed(1)} km`
          });
        });

        // Process trending items if available
        if (response.data.trending_items) {
          response.data.trending_items.forEach(item => {
            transformedResults.unshift({
              id: `trending-${item.id}`,
              name: item.name,
              image: item.image,
              type: 'trending',
              originalData: item
            });
          });
        }

        setSearchResults(transformedResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedSearchQuery && isSearchModalVisible) {
      fetchSearchSuggestions(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0 && isSearchModalVisible) {
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, [debouncedSearchQuery, isSearchModalVisible, fetchSearchSuggestions]);

  const handleLocalSearch = (query) => {
    const searchQuery = query.toLowerCase();
    
    const filteredKs = kitchens.filter(kitchen => 
      kitchen.name.toLowerCase().includes(searchQuery) ||
      kitchen.category.toLowerCase().includes(searchQuery) ||
      kitchen.featuredDish.toLowerCase().includes(searchQuery)
    );
    
    const filteredDs = dishes.filter(dish => 
      dish.name.toLowerCase().includes(searchQuery) ||
      dish.kitchen.toLowerCase().includes(searchQuery) ||
      dish.category.toLowerCase().includes(searchQuery) ||
      dish.description.toLowerCase().includes(searchQuery)
    );

    setFilteredKitchens(filteredKs);
    setFilteredDishes(filteredDs);
  };

  useEffect(() => {
    if (route?.params?.params?.query) {
      setSearchQuery(route.params.params.query);
      fetchSearchResults(route.params.params.query);
    }
    fetchUserData();
  }, [route?.params?.params?.query]);

  const toggleKitchenFavorite = (id) => {
    const updatedKitchens = kitchens.map(kitchen => 
      kitchen.id === id ? {...kitchen, isFavorite: !kitchen.isFavorite} : kitchen
    );
    setKitchens(updatedKitchens);
    setFilteredKitchens(updatedKitchens);
  };

  const toggleDishFavorite = (id) => {
    const updatedDishes = dishes.map(dish => 
      dish.id === id ? {...dish, isFavorite: !dish.isFavorite} : dish
    );
    setDishes(updatedDishes);
    setFilteredDishes(updatedDishes);
  };

  const getDishesByKitchen = () => {
    if (!selectedKitchen) return filteredDishes;
    return filteredDishes.filter(dish => dish.kitchen === selectedKitchen.name);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchSuggestionsData(null);
    Keyboard.dismiss();
  };

  const handleFilterSelect = (filterType, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: filterType === 'sort' ? value : !prev[filterType]
    }));
    
    if (filterType === 'sort') {
      setSelectedSort(value);
      setSortModalVisible(false);
    }
  };

  const handleFilterRemove = (filterType) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: filterType === 'sort' ? 'Relevance' : false
    }));
    
    if (filterType === 'sort') {
      setSelectedSort('Relevance');
    }
  };

  const hasActiveFilters = () => {
    return Object.entries(activeFilters).some(([key, value]) => {
      if (key === 'sort') return value !== 'Relevance';
      return value === true;
    });
  };

  const kitcheNavigation = useCallback((item) => {
    navigation.navigate('HomeKitchenDetails', { 
      kitchenId: item.id
    });
  }, [navigation]);

  const clearAllFilters = () => {
    setActiveFilters({
      sort: 'Relevance',
      veg: false,
      nonVeg: false,
      rated4Plus: false,
    });
    setSelectedSort('Relevance');
  };

  // Fetch cart data (simulated)
  const fetchCartData = useCallback(async () => {
    try {
      if (pastKitchenDetails && pastKitchenDetails.id) {
        const currentKitchenIds = [...new Set(dishes.map(dish => dish.restaurant_id))];
        setHasDifferentKitchenItems(
          currentKitchenIds.length > 0 && 
          !currentKitchenIds.includes(pastKitchenDetails.id)
        );
      }
    } catch (error) {
      console.error('Error fetching cart data:', error);
    }
  }, [sessionId, pastKitchenDetails, dishes]);

  const [user, setUser] = useState(null);

  const fetchUserData = useCallback(async () => {
    try {
      const [userData] = await Promise.all([
        AsyncStorage.getItem("user"),
      ]);

      if (userData) setUser(JSON.parse(userData));
      return { user: userData};
    } catch (error) {
      console.error("Error fetching user data:", error);
      return { user: null};
    }
  }, []);

  // Updated cart API integration
  const updateCartItem = useCallback(async (itemId, action, force = false) => {
    try {
      console.log(`Updating cart: ${action} item ${itemId}`);
            
      const dish = dishes.find(d => d.id === itemId);

      
      if (!dish) {
        console.error('Dish not found');
        return;
      }


      // Find the kitchen for this dish
      const kitchen = kitchens.find(k => k.name === dish.kitchen);
      if (!kitchen) {
        console.error('Kitchen not found for dish');
        return;
      }

      // Check if kitchen is open
      if (!kitchen.restaurant_current_status?.is_open) {
        return;
      }
      

      // Check if we're trying to add to a different kitchen's cart
      if (!force && action === 'add' && hasDifferentKitchenItems) {
        setPendingCartAction({ itemId, action });
        setShowKitchenConflictModal(true);
        return;
      }

      setUpdatingItemId(itemId);
      
      console.log("user===",user)

      const payload = {
        session_id: sessionId,
        restaurant_id: kitchen.id,
        item_id: itemId,
        source: 'ITEMLIST',
        action,
        quantity: 1,
        user_id: user?.id || null,
      };


      const response = await updateCart(payload);
      
      if (response.status == 200 ) {
        const currentItemCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const newPastKitchenDetails = {
          id: kitchen.id,
          name: kitchen.name,
          image: kitchen.image,
          itemCount: action === 'add' ? currentItemCount + 1 : Math.max(0, currentItemCount - 1)
        };

        await savePastKitchenDetails(newPastKitchenDetails);
        
        // Fetch updated cart data
        await fetchCartData();
        
        // Navigate to HomeKitchenDetails on successful add
        if (action === 'add') {
          navigation.navigate('HomeKitchenDetails', { 
            kitchenId: kitchen.id,
            preSelectedItemId: itemId
          });
        }
      } else {
        throw new Error(response.data.message || 'Failed to update cart');
      }
      
    } catch (error) {
      console.error('Cart update error:', error);
    } finally {
      setUpdatingItemId(null);
    }
  }, [
    sessionId, 
    dishes, 
    kitchens, 
    navigation, 
    hasDifferentKitchenItems,
    cartItems,
    savePastKitchenDetails,
    fetchCartData
  ]);

  const handleRemoveRecentSearch = (query: string) => {
    setRecentSearches(prev => prev.filter(item => item !== query));
  }

  // Handle kitchen conflict modal actions
  const handleKitchenConflictConfirm = () => {
    if (pendingCartAction) {
      updateCartItem(pendingCartAction.itemId, pendingCartAction.action, true);
    }
    setShowKitchenConflictModal(false);
    setPendingCartAction(null);
  };

  const handleKitchenConflictCancel = () => {
    setShowKitchenConflictModal(false);
    setPendingCartAction(null);
  };

  const renderKitchenItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.kitchenItem, 
        selectedKitchen?.id === item.id && styles.selectedKitchen
      ]}
      onPress={() => kitcheNavigation(item)}
    >
      <View style={styles.kitchenImageContainer}>
        <Image source={{ uri: item.image }} style={styles.kitchenImage} />
        {item.promoted && (
          <View style={styles.promotedBadge}>
            <Text style={styles.promotedText}>PROMOTED</Text>
          </View>
        )}
        {item.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}</Text>
          </View>
        )}
        {!item.restaurant_current_status?.is_open && (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>CLOSED</Text>
          </View>
        )}
      </View>
      <View style={styles.kitchenInfo}>
        <View style={styles.kitchenHeader}>
          <Text style={styles.kitchenName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingContainer}>
            <Icon name="star" size={12} color="#fff" />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>
        <Text style={styles.kitchenCategory} numberOfLines={1}>{item.category}</Text>
        <View style={styles.kitchenDetails}>
          <Text style={styles.deliveryTime}>{item.deliveryTime}</Text>
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.distance}>{item.distance}</Text>
        </View>
        <Text style={styles.featuredDish} numberOfLines={1}>{item.featuredDish}</Text>
        {!item.restaurant_current_status?.is_open && (
          <Text style={styles.closedStatusText}>Currently closed</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderDishItem = ({ item }) => {
    const kitchen = kitchens.find(k => k.name === item.kitchen);
    const isKitchenOpen = kitchen?.restaurant_current_status?.is_open;
    const isUpdating = updatingItemId === item.id;

    return (
      <View style={styles.dishItem}>
        <View style={styles.dishImageContainer}>
          <Image source={{ uri: item.image }} style={styles.dishImage} />
          {item.discount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discount}</Text>
            </View>
          )}
          {item.bestSeller && (
            <View style={styles.bestSellerBadge}>
              <Text style={styles.bestSellerText}>🔥 Best Seller</Text>
            </View>
          )}
          {item.buyOneGetOneFree && (
            <View style={styles.bogoBadge}>
              <Text style={styles.bogoText}>BOGO</Text>
            </View>
          )}
          {(!item.availability || !isKitchenOpen) && (
            <View style={styles.unavailableOverlay}>
              <Text style={styles.unavailableText}>
                {!isKitchenOpen ? 'KITCHEN CLOSED' : 'UNAVAILABLE'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.dishInfo}>
          <View style={styles.dishHeader}>
            <View style={styles.dishTitleContainer}>
              <Text style={styles.dishName} numberOfLines={1}>{item.name}</Text>
              {item.isVeg && (
                <View style={styles.vegIndicator}>
                  <Text style={styles.vegText}>🟢</Text>
                </View>
              )}
              {item.spiceLevel && (
                <View style={styles.spiceIndicator}>
                  <Text style={styles.spiceText}>🌶️ {item.spiceLevel}</Text>
                </View>
              )}
            </View>
            <View style={styles.dishPriceContainer}>
              {item.priceData && item.discountActive ? (
                <View style={styles.priceContainer}>
                  <Text style={styles.dishPrice}>{item.price}</Text>
                  <Text style={styles.originalPrice}>{item.originalPrice}</Text>
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>Save {item.priceData.savings}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.dishPrice}>{item.price}</Text>
              )}
            </View>
          </View>
          <Text style={styles.dishKitchen} numberOfLines={1}>{item.kitchen}</Text>
          <View style={styles.dishDetailsRow}>
            <Text style={styles.dishCategory}>{item.category}</Text>
            {item.servingSize && (
              <Text style={styles.servingSize}>• {item.servingSize}</Text>
            )}
            {item.preparationTime && (
              <Text style={styles.preparationTime}>• {item.preparationTime} min</Text>
            )}
          </View>
          <Text style={styles.dishDescription} numberOfLines={2}>{item.description}</Text>
          <View style={styles.dishFooter}>
            <View style={styles.ratingContainerSmall}>
              <Icon name="star" size={12} color="#fff" />
              <Text style={styles.ratingTextSmall}>{item.rating}</Text>
            </View>
            <TouchableOpacity 
              style={[
                styles.addButton, 
                (!item.availability || !isKitchenOpen) && styles.disabledButton,
                isUpdating && styles.loadingButton
              ]}
              disabled={!item.availability || !isKitchenOpen || isUpdating}
              onPress={() => updateCartItem(item.id, 'add')}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addButtonText}>
                  {!isKitchenOpen ? 'CLOSED' : !item.availability ? 'UNAVAILABLE' : 'ADD +'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="search-outline" size={50} color="#E65C00" />
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptyText}>
        Try searching for something else or check your spelling
      </Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#E65C00" />
      <Text style={styles.loadingText}>Searching...</Text>
    </View>
  );

  const renderActiveFilters = () => {
    if (!hasActiveFilters()) return null;

    return (
      <View style={styles.activeFiltersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeFiltersScroll}
        >
          {activeFilters.sort !== 'Relevance' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText} numberOfLines={1}>{activeFilters.sort}</Text>
              <TouchableOpacity onPress={() => handleFilterRemove('sort')}>
                <Icon name="close-circle" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          
          {activeFilters.veg && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>Veg Only</Text>
              <TouchableOpacity onPress={() => handleFilterRemove('veg')}>
                <Icon name="close-circle" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          
          {activeFilters.nonVeg && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>Non-Veg Only</Text>
              <TouchableOpacity onPress={() => handleFilterRemove('nonVeg')}>
                <Icon name="close-circle" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          
          {activeFilters.rated4Plus && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterText}>Rating 4.0+</Text>
              <TouchableOpacity onPress={() => handleFilterRemove('rated4Plus')}>
                <Icon name="close-circle" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <Animated.View style={[
          styles.searchContainer,
          {
            transform: [{
              scale: searchBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.95]
              })
            }]
          }
        ]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="chevron-back" size={22} color="#333" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.searchInputContainer}
            onPress={openSearchModal}
            activeOpacity={0.8}
          >
            <Icon name="search" size={18} color="#666" style={styles.searchIcon} />
            <Text style={styles.searchPlaceholder}>
              {searchQuery || "Search kitchens or dishes..."}
            </Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Icon name="close-circle" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'kitchens' && styles.activeTab]}
          onPress={() => setActiveTab('kitchens')}
        >
          <Text style={[styles.tabText, activeTab === 'kitchens' && styles.activeTabText]}>
            Kitchens ({filteredKitchens.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'dishes' && styles.activeTab]}
          onPress={() => setActiveTab('dishes')}
        >
          <Text style={[styles.tabText, activeTab === 'dishes' && styles.activeTabText]}>
            Dishes ({getDishesByKitchen().length})
          </Text>
        </TouchableOpacity>
      </View>

      {renderActiveFilters()}

      {loading ? (
        renderLoading()
      ) : activeTab === 'kitchens' ? (
        <FlatList
          data={filteredKitchens}
          renderItem={renderKitchenItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!loading && renderEmptyState}
        />
      ) : (
        <FlatList
          data={getDishesByKitchen()}
          renderItem={renderDishItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!loading && renderEmptyState}
          ListHeaderComponent={
            selectedKitchen && (
              <View style={styles.selectedKitchenHeader}>
                <Text style={styles.selectedKitchenText} numberOfLines={1}>
                  Dishes from {selectedKitchen.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedKitchen(null)}>
                  <Text style={styles.clearFilterText}>Clear</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      {/* Kitchen Conflict Modal */}
      <Modal
        visible={showKitchenConflictModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleKitchenConflictCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.conflictModal}>
            <View style={styles.modalIcon}>
              <Icon name="warning" size={32} color="#E65C00" />
            </View>
            <Text style={styles.conflictModalTitle}>Kitchen Conflict</Text>
            <Text style={styles.conflictModalText}>
              Your cart contains items from a different kitchen. Adding this item will clear your current cart and start a new order from this kitchen.
            </Text>
            <View style={styles.conflictModalButtons}>
              <TouchableOpacity 
                style={[styles.conflictModalButton, styles.cancelButton]}
                onPress={handleKitchenConflictCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.conflictModalButton, styles.confirmButton]}
                onPress={handleKitchenConflictConfirm}
              >
                <Text style={styles.confirmButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SearchModal
        isVisible={isSearchModalVisible}
        onClose={closeSearchModal}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        recentSearches={recentSearches}
        searchHistory={searchHistory}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onRecentSearchPress={handleRecentSearchPress}
        onPopularSearchPress={handlePopularSearchPress}
        onSearchResultPress={handleSearchResultPress}
        onClearRecentSearches={clearRecentSearches}
        searchInputRef={searchInputRef}
        searchSuggestionsData={searchSuggestionsData}
        onRemoveRecentSearch={handleRemoveRecentSearch}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 6,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#666',
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFiltersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  activeFiltersScroll: {
    paddingHorizontal: 16,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E65C00',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
    maxWidth: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  activeTab: {
    backgroundColor: '#E65C00',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  kitchenItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
    height: 110,
    borderWidth: 1,
    borderColor: '#f8f8f8',
  },
  selectedKitchen: {
    borderWidth: 1.5,
    borderColor: '#E65C00',
  },
  kitchenImageContainer: {
    position: 'relative',
    width: 100,
  },
  kitchenImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  promotedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  promotedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#E65C00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bogoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bogoText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  kitchenInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  kitchenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kitchenName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a9b38',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 40,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  kitchenCategory: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
  },
  kitchenDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deliveryTime: {
    color: '#333',
    fontSize: 11,
    fontWeight: '500',
  },
  dotSeparator: {
    color: '#999',
    marginHorizontal: 4,
    fontSize: 10,
  },
  distance: {
    color: '#666',
    fontSize: 11,
  },
  featuredDish: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  closedStatusText: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  selectedKitchenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectedKitchenText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  clearFilterText: {
    color: '#E65C00',
    fontSize: 12,
    fontWeight: '600',
  },
  dishItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f8f8f8',
  },
  dishImageContainer: {
    position: 'relative',
    width: 90,
    marginRight: 12,
  },
  dishImage: {
    width: '100%',
    height: 90,
    resizeMode: 'cover',
    borderRadius: 12,
  },
  bestSellerBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 107, 0, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestSellerText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  unavailableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
  },
  dishInfo: {
    flex: 1,
  },
  dishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dishTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  vegIndicator: {
    marginLeft: 4,
  },
  vegText: {
    fontSize: 10,
  },
  spiceIndicator: {
    marginLeft: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  spiceText: {
    fontSize: 8,
    color: '#E65100',
    fontWeight: '600',
  },
  dishPriceContainer: {
    alignItems: 'flex-end',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  dishPrice: {
    fontWeight: '700',
    color: '#333',
    fontSize: 14,
  },
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  savingsBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  savingsText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  dishKitchen: {
    color: '#666',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  dishDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dishCategory: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
  },
  servingSize: {
    color: '#666',
    fontSize: 11,
    marginLeft: 4,
  },
  preparationTime: {
    color: '#666',
    fontSize: 11,
    marginLeft: 4,
  },
  dishDescription: {
    color: '#666',
    marginBottom: 8,
    fontSize: 11,
    lineHeight: 16,
  },
  dishFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a9b38',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 36,
  },
  ratingTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  addButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 80,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  loadingButton: {
    backgroundColor: '#ff9933',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  conflictModal: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 12,
  },
  conflictModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  conflictModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  conflictModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  conflictModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  confirmButton: {
    backgroundColor: '#E65C00',
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default HomeKitchenNavigate;