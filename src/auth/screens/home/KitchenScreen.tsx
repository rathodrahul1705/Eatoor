import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, SafeAreaView, Text, TextInput,
  FlatList, TouchableOpacity, Image, Animated, Dimensions, 
  ScrollView, ActivityIndicator, Alert, RefreshControl, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { getKitchenList, updateFavouriteKitchen } from '../../../api/home';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCart, getActiveOrders } from '../../../api/cart';
import { searchSuggestions } from '../../../api/search';
import moment from 'moment';
import SearchModal from './searchmodal';

// Constants
const { width, height } = Dimensions.get('window');
const isAndroid = Platform.OS === 'android';

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Enhanced Color Palette with consistent gradient colors
const COLORS = {
  primary: '#FF6B35',
  primaryLight: '#FF9F5B',
  secondary: '#FFD166',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textDark: '#1E2329',
  textMedium: '#5E6770',
  textLight: '#8A939C',
  success: '#06C167',
  danger: '#FF3B30',
  info: '#5AC8FA',
  lightGray: '#F1F3F5',
  border: '#E1E4E8',
  rating: '#FFC120',
  darkOverlay: 'rgba(0,0,0,0.6)',
  lightOverlay: 'rgba(255,255,255,0.4)',
  searchBg: '#FFFFFF',
  categoryBg: '#FFFFFF',
  searchBorder: '#E1E4E8',
  refreshControl: '#E65C00',
  // Consistent gradient colors matching HomeTabs
  gradientStart: '#FF6B35',
  gradientMiddle: '#FF512F',
  gradientEnd: '#DD2476',
  textOnGradient: '#FFFFFF',
  categoryText: 'rgba(255,255,255,0.9)',
  activeCategoryText: '#FFFFFF',
  orderStatusBorder: '#E5E7EB',
  orderPreparing: '#F59E0B',
  orderOnTheWay: '#3B82F6',
  orderDelivered: '#10B981',
  orderCancelled: '#EF4444',
  modalBackground: 'rgba(0, 0, 0, 0.5)',
  searchModalBg: '#FFFFFF',
  recentSearchBg: '#F8F9FA',
  recentSearchText: '#5E6770',
  veg: '#06C167',
  nonVeg: '#FF3B30',
  searchHighlight: '#FFF9C4',
  searchSuggestionBg: '#F8F9FA',
  trending: '#FF6B9D',
};

const FONTS = {
  bold: isAndroid ? 'sans-serif-medium' : 'Inter-Bold',
  semiBold: isAndroid ? 'sans-serif-medium' : 'Inter-SemiBold',
  medium: isAndroid ? 'sans-serif' : 'Inter-Medium',
  regular: isAndroid ? 'sans-serif' : 'Inter-Regular',
};

const DEFAULT_CATEGORY_ICON = "";
const ACTIVE_ORDERS_LIMIT = 3;

// Enhanced search placeholders
const SEARCH_PLACEHOLDERS = [
  "Search Biryani, Pizza, or Chinese...",
  "Looking for Thalis or Combos?",
  "Craving snacks or beverages?",
  "Find your favorite home kitchen...",
  "Search for desserts or drinks..."
];

// Types (keeping the same types as before)
interface User {
  id: string;
  name: string;
  email: string;
}

interface Kitchen {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_image: string | null;
  restaurant_location: string;
  item_cuisines: string;
  avg_price_range: number;
  restaurant_city: string;
  restaurant_status: number;
  review_count?: number;
  is_favourite: boolean;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Filter {
  id: string;
  name: string;
  icon: string;
  type: 'rating' | 'veg' | 'offer' | 'fastDelivery';
  active: boolean;
}

interface ApiResponse {
  success: boolean;
  data: {
    FeatureKitchenList: Kitchen[];
    KitchenList: Kitchen[];
    CategoryList: Category[];
  };
}

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
}

interface ActiveOrder {
  id: string;
  orderNumber: string;
  status: 'preparing' | 'on-the-way' | 'delivered' | 'cancelled';
  statusText: string;
  kitchenId: string;
  kitchenName: string;
  kitchenImage: string;
  estimatedArrival: string;
  placedOn: string;
  items?: {
    name: string;
    quantity: number;
  }[];
  totalAmount?: number;
  deliveryAddress?: string;
}

// Enhanced Search Types (keeping the same as before)
interface SearchSuggestionResponse {
  query: string;
  menus: SearchMenu[];
  restaurants: SearchRestaurant[];
  popular_searches?: string[];
  trending_items?: TrendingItem[];
}

interface SearchMenu {
  menu_name: string;
  items: SearchMenuItem[];
}

interface SearchMenuItem {
  id: number;
  item_name: string;
  item_price: string;
  item_image: string;
  category: string;
  food_type: string;
  availability: boolean;
  restaurant: SearchRestaurant;
}

interface SearchRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  profile_image: string;
  restaurant_status: number;
  cuisines: Cuisine[];
  rating?: number;
  delivery_time?: string;
  distance?: string;
}

interface Cuisine {
  id: number;
  cuisine_name: string;
}

interface TrendingItem {
  id: number;
  name: string;
  image: string;
  type: string;
  popularity_score: number;
}

interface SearchItem {
  id: string;
  name: string;
  image: string;
  type: 'food' | 'restaurant' | 'trending' | 'popular';
  category?: string;
  price?: string;
  foodType?: string;
  restaurant?: SearchRestaurant;
  originalData?: SearchMenuItem | SearchRestaurant | TrendingItem;
  rating?: number;
  deliveryTime?: string;
  distance?: string;
  searchedAt?: string;
}

// Navigation Types (keeping the same as before)
type RootStackParamList = {
  HomeKitchenNavigate: {
    screen: string;
    params: {
      category?: string;
      query?: string;
      itemId?: string;
      suggestionsData?: SearchSuggestionResponse;
    };
  };
  HomeKitchenDetails: {
    kitchenId: string;
  };
  TrackOrder: {
    order: { order_number: string };
  };
  ActiveOrders: {
    orders: ActiveOrder[];
  };
  CartScreen: {
    pastkitcheId: string;
  };
  SearchResults: {
    query: string;
    itemId?: string;
    suggestionsData?: SearchSuggestionResponse;
  };
};

type NavigationProp = {
  navigate: <T extends keyof RootStackParamList>(
    screen: T,
    params?: RootStackParamList[T]
  ) => void;
};

// Custom hook for debouncing
const useDebounce = (value: string, delay: number) => {
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

const KitchenScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [showAllActiveOrders, setShowAllActiveOrders] = useState(false);
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchItem[]>([]);
  const [searchSuggestionsData, setSearchSuggestionsData] = useState<SearchSuggestionResponse | null>(null);
  
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData) as User;
        setUser(parsedUser);
        return parsedUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  // Fetch recent searches and search history
  const fetchRecentSearches = useCallback(async () => {
    try {
      const [recent, history] = await Promise.all([
        AsyncStorage.getItem('recentSearches'),
        AsyncStorage.getItem('searchHistory')
      ]);
      
      if (recent) setRecentSearches(JSON.parse(recent));
      if (history) setSearchHistory(JSON.parse(history));
    } catch (error) {
      console.error('Error fetching search data:', error);
    }
  }, []);

  // Save search data
  const saveToRecentSearches = useCallback(async (query: string, item?: SearchItem) => {
    try {
      // Save to recent searches
      const updatedSearches = [
        query,
        ...recentSearches.filter(search => search.toLowerCase() !== query.toLowerCase())
      ].slice(0, 5);
      
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));

      // Save to search history if item provided
      if (item) {
        const updatedHistory = [
          { ...item, searchedAt: new Date().toISOString() },
          ...searchHistory.filter(hist => hist.id !== item.id)
        ].slice(0, 10);
        
        setSearchHistory(updatedHistory);
        await AsyncStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
      }
    } catch (error) {
      console.error('Error saving search data:', error);
    }
  }, [recentSearches, searchHistory]);

  // Fetch active orders
  const fetchActiveOrders = useCallback(async (userId: string) => {
    try {
      setOrdersLoading(true);
      const payload = { user_id: userId };
      const response = await getActiveOrders(payload);

      if (response?.status === 200) {
        const formattedOrders: ActiveOrder[] = response.data.orders
          .map(order => {
            const now = moment();
            const deliveryTime = moment(order.estimated_delivery);
            const minutesRemaining = deliveryTime.diff(now, 'minutes');

            let status: ActiveOrder['status'];
            let statusText: string;
            
            switch (order.status) {
              case 'Cancelled':
                status = 'cancelled';
                statusText = 'Cancelled';
                break;
              case 'Pending':
                status = 'pending';
                statusText = 'Pending';
                break;
              case 'Confirmed':
                status = 'confirmed';
                statusText = 'Confirmed';
                break;
              case 'On the Way':
                status = 'on-the-way';
                statusText = 'On The Way';
                break;
              case 'Preparing':
                status = 'preparing';
                statusText = 'Preparing';
                break;
              case 'Ready for Delivery/Pickup':
                status = 'preparing';
                statusText = 'Ready';
                break;
              default:
                status = minutesRemaining <= 0 ? 'delivered' : 'preparing';
                statusText = minutesRemaining <= 0 ? 'Delivered' : 'Preparing';
            }

            return {
              id: order.order_number,
              orderNumber: order.order_number,
              status,
              statusText,
              kitchenId: order.order_number,
              kitchenName: order.kitchan_name,
              kitchenImage: order.kitchan_image,
              estimatedArrival: `${Math.max(1, minutesRemaining)} min`,
              placedOn: moment(order.placed_on).format('MMM D, h:mm A'),
            };
          })
          .filter(order => order.status !== 'delivered');

        formattedOrders.sort((a, b) => {
          const aMinutes = parseInt(a.estimatedArrival);
          const bMinutes = parseInt(b.estimatedArrival);
          return aMinutes - bMinutes;
        });

        setActiveOrders(formattedOrders);
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Past kitchen details
  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    try {
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
      setPastKitchenDetails(details);
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);
  
  const fetchPastKitchenDetails = useCallback(async (userId: string) => {
    try {
      const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');
      if (storedDetails != null) {
        setPastKitchenDetails(JSON.parse(storedDetails));
        return;
      }

      const payload = { session_id: null, user_id: userId };
      const response = await getCart(payload);
      
      if (response?.status === 200) {
        const existingCart = response?.data?.existingCartDetails || [];
        if (existingCart.length > 0) {
          const newPastKitchenDetails = {
            id: existingCart[0]?.restaurant_id,
            name: existingCart[0]?.restaurant_name,
            image: existingCart[0]?.restaurant_profile_image,
            itemCount: response?.data?.total_item_count || 0
          };
          await savePastKitchenDetails(newPastKitchenDetails);
          setPastKitchenDetails(newPastKitchenDetails);
        }
      } else {
        setPastKitchenDetails(null);
      }
    } catch (error) {
      console.error('Error fetching past kitchen details:', error);
    }
  }, [savePastKitchenDetails]);

  // Fetch kitchens
  const fetchKitchens = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getKitchenList();
      
      if (response.data?.success) {
        const processedData = {
          ...response.data,
          data: {
            ...response.data.data,
            FeatureKitchenList: response.data.data.FeatureKitchenList.map(k => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false
            })),
            KitchenList: response.data.data.KitchenList.map(k => ({
              ...k,
              review_count: Math.floor(Math.random() * 100) + 1,
              is_favourite: k.is_favourite || false
            }))
          }
        };
        
        setApiData(processedData);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch kitchens. Please try again later.');
      console.error('Error fetching kitchens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Enhanced search functionality
  const fetchSearchSuggestions = useCallback(async (query: string) => {
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
        
        const transformedResults: SearchItem[] = [];
        
        // Transform menu items
        response.data.menus.forEach(menu => {
          menu.items.forEach(item => {
            transformedResults.push({
              id: `menu-${item.id}`,
              name: item.item_name || menu.menu_name,
              image: item.item_image,
              type: 'food',
              category: menu.menu_name,
              price: item.item_price,
              foodType: item.food_type,
              restaurant: item.restaurant,
              originalData: item,
              rating: Math.random() * 2 + 3,
              deliveryTime: `${Math.floor(Math.random() * 20) + 15}-${Math.floor(Math.random() * 20) + 35} min`
            });
          });
        });
        
        // Transform restaurants
        response.data.restaurants.forEach(restaurant => {
          const cuisineNames = restaurant.cuisines
            .filter(cuisine => cuisine.cuisine_name)
            .map(cuisine => cuisine.cuisine_name)
            .join(', ');
            
          transformedResults.push({
            id: `restaurant-${restaurant.restaurant_id}`,
            name: restaurant.restaurant_name,
            image: restaurant.profile_image,
            type: 'restaurant',
            category: cuisineNames || 'Various cuisines',
            originalData: restaurant,
            rating: restaurant.rating || Math.random() * 2 + 3,
            deliveryTime: restaurant.delivery_time || `${Math.floor(Math.random() * 20) + 15}-${Math.floor(Math.random() * 20) + 35} min`,
            distance: restaurant.distance || `${(Math.random() * 5).toFixed(1)} km`
          });
        });

        // Add trending items if available
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

  // Initial data loading
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const user = await fetchUserData();
        if (user && isMounted) {
          await Promise.all([
            fetchKitchens(),
            fetchActiveOrders(user.id),
            fetchPastKitchenDetails(user.id),
            fetchRecentSearches()
          ]);
        } else {
          await fetchKitchens();
          await fetchRecentSearches();
        }
      } catch (error) {
        console.error('Initial data loading error:', error);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchKitchens, fetchPastKitchenDetails, fetchUserData, fetchActiveOrders, fetchRecentSearches]);

  // Search effect
  useEffect(() => {
    if (debouncedSearchQuery && isSearchModalVisible) {
      fetchSearchSuggestions(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length === 0 && isSearchModalVisible) {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, isSearchModalVisible, fetchSearchSuggestions]);

  // Animated placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholderIndex(prev => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Refresh control
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const user = await fetchUserData();
      if (user) {
        await Promise.all([
          fetchKitchens(),
          fetchActiveOrders(user.id),
          fetchPastKitchenDetails(user.id)
        ]);
      } else {
        await fetchKitchens();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchKitchens, fetchActiveOrders, fetchPastKitchenDetails, fetchUserData]);

  // Search handlers
  const openSearchModal = useCallback(() => {
    setIsSearchModalVisible(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  const closeSearchModal = useCallback(() => {
    setIsSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchSuggestionsData(null);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    if (searchQuery.trim()) {
      try {
        await saveToRecentSearches(searchQuery);
        closeSearchModal();
        
        navigation.navigate('HomeKitchenNavigate', { 
          screen: 'SearchResults', 
          params: { 
            query: searchQuery,
            suggestionsData: searchSuggestionsData
          } 
        });
      } catch (error) {
        console.error('Error handling search submit:', error);
      }
    }
  }, [searchQuery, navigation, closeSearchModal, saveToRecentSearches, searchSuggestionsData]);

  const handleRecentSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    setTimeout(() => {
      handleSearchSubmit();
    }, 100);
  }, [handleSearchSubmit]);

  const handlePopularSearchPress = useCallback((query: string) => {
    setSearchQuery(query);
    setTimeout(() => {
      handleSearchSubmit();
    }, 100);
  }, [handleSearchSubmit]);

  const handleSearchResultPress = useCallback((item: SearchItem) => {
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

  const clearRecentSearches = useCallback(async () => {
    try {
      setRecentSearches([]);
      setSearchHistory([]);
      await AsyncStorage.removeItem('recentSearches');
      await AsyncStorage.removeItem('searchHistory');
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  // Order handlers
  const handleOrderPress = useCallback((order: ActiveOrder) => {
    navigation.navigate('TrackOrder', { order: { order_number: order.orderNumber } });
  }, [navigation]);

  const handleViewAllOrders = useCallback(() => {
    navigation.navigate('ActiveOrders', { orders: activeOrders });
  }, [navigation, activeOrders]);

  const toggleShowAllActiveOrders = useCallback(() => {
    setShowAllActiveOrders(prev => !prev);
  }, []);

  // Filters
  const [filters, setFilters] = useState<Filter[]>(useMemo(() => [
    { id: '1', name: 'Rating 4.0+', icon: 'star', type: 'rating', active: false },
    { id: '2', name: 'Pure Veg', icon: 'leaf', type: 'veg', active: false },
    { id: '3', name: 'Offers', icon: 'pricetag', type: 'offer', active: false },
    { id: '4', name: 'Fast Delivery', icon: 'rocket', type: 'fastDelivery', active: false },
  ], []));

  // Filtered kitchens
  const filteredKitchens = useMemo(() => {
    if (!apiData) return [];
    let result = [...apiData.data.KitchenList];
    
    // Apply category filter
    if (activeCategory !== null && apiData.data.CategoryList[activeCategory]) {
      const categoryName = apiData.data.CategoryList[activeCategory].name;
      result = result.filter(kitchen => 
        kitchen.item_cuisines?.toLowerCase().includes(categoryName.toLowerCase())
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(kitchen =>
        kitchen.restaurant_name.toLowerCase().includes(query) ||
        kitchen.item_cuisines.toLowerCase().includes(query) ||
        kitchen.restaurant_location.toLowerCase().includes(query)
      );
    }
    
    // Apply other filters
    filters.forEach(filter => {
      if (filter.active) {
        switch (filter.type) {
          case 'rating':
            result = result.filter(kitchen => (kitchen.review_count || 0) >= 4);
            break;
          case 'veg':
            result = result.filter(kitchen => kitchen.item_cuisines.toLowerCase().includes('veg'));
            break;
          case 'offer':
            // Assuming some kitchens have offers
            result = result.filter(kitchen => kitchen.avg_price_range < 500);
            break;
          case 'fastDelivery':
            // Filter based on some delivery time criteria
            result = result.filter(kitchen => kitchen.restaurant_status === 1);
            break;
        }
      }
    });
    
    return result;
  }, [apiData, searchQuery, activeCategory, filters]);

  const handleCategoryPress = useCallback((categoryId: number, categoryName: string) => {
    navigation.navigate('HomeKitchenNavigate', {
      screen: 'CategoryResults',
      params: { 
          query: categoryName,
        } 
    });
  }, [navigation]);

  const handleFilterPress = useCallback((filterId: string) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, active: !filter.active } : filter
    ));
  }, []);

  const handleKitchenPress = useCallback((kitchen: Kitchen) => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchen.restaurant_id });
  }, [navigation]);

  const toggleFavorite = useCallback(async (kitchenId: string) => {
    if (favoriteLoading) return;
    try {
      setFavoriteLoading(kitchenId);
      setApiData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          data: {
            ...prev.data,
            KitchenList: prev.data.KitchenList.map(kitchen => 
              kitchen.restaurant_id === kitchenId 
                ? { ...kitchen, is_favourite: !kitchen.is_favourite } 
                : kitchen
            ),
            FeatureKitchenList: prev.data.FeatureKitchenList.map(kitchen => 
              kitchen.restaurant_id === kitchenId 
                ? { ...kitchen, is_favourite: !kitchen.is_favourite } 
                : kitchen
            )
          }
        };
      });
      await updateFavouriteKitchen({ restaurant_id: kitchenId });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status. Please try again.');
    } finally {
      setFavoriteLoading(null);
    }
  }, [favoriteLoading]);

  const BackToKitchen = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('HomeKitchenDetails', { kitchenId: pastKitchenDetails.id });
    }
  }, [navigation, pastKitchenDetails]);

  const handleViewCart = useCallback(() => {
    if (pastKitchenDetails?.id) {
      navigation.navigate('CartScreen', { pastkitcheId: pastKitchenDetails.id });
    }
  }, [navigation, pastKitchenDetails]);

  // Render functions for main content
  const renderCategory = useCallback(({ item, index }: { item: Category, index: number }) => (
    <TouchableOpacity 
      style={[
        styles.categoryCard,
        activeCategory === index && styles.activeCategoryCard
      ]} 
      activeOpacity={0.8}
      onPress={() => handleCategoryPress(index, item.name)}
    >
      <View
        style={[
          styles.categoryIconContainer,
          activeCategory === index && styles.activeCategoryIconContainer
        ]}
      >
        <Image 
          source={{ uri: item.icon }} 
          style={styles.categoryImage} 
          resizeMode="cover"
          defaultSource={{ uri: DEFAULT_CATEGORY_ICON }}
        />
      </View>
      <Text style={[
        styles.categoryName,
        activeCategory === index && styles.activeCategoryName
      ]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [activeCategory, handleCategoryPress]);

  const renderFilter = useCallback(({ item }: { item: Filter }) => (
    <TouchableOpacity 
      style={[
        styles.filterCard,
        item.active && styles.activeFilterCard
      ]}
      onPress={() => handleFilterPress(item.id)}
      activeOpacity={0.7}
    >
      <Icon 
        name={item.icon} 
        size={16} 
        color={item.active ? '#fff' : COLORS.textMedium} 
      />
      <Text style={[
        styles.filterText,
        item.active && styles.activeFilterText
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  ), [handleFilterPress]);

  const renderKitchenItem = useCallback(({ item }: { item: Kitchen }) => {
    const deliveryTime = '30-40 min';
    const rating = (Math.random() * 1 + 4).toFixed(1);
    const cuisines = item.item_cuisines ? item.item_cuisines.split(', ') : [];

    return (
      <TouchableOpacity
        style={styles.kitchenCard}
        onPress={() => handleKitchenPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.kitchenImageContainer}>
          {item.restaurant_image ? (
            <Image 
              source={{ uri: item.restaurant_image }} 
              style={styles.kitchenImage} 
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.kitchenImage, styles.kitchenImagePlaceholder]}>
              <Icon name="restaurant-outline" size={40} color={COLORS.textLight} />
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.restaurant_id);
            }}
            disabled={favoriteLoading === item.restaurant_id}
          >
            {favoriteLoading === item.restaurant_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon 
                name={item.is_favourite ? "heart" : "heart-outline"} 
                size={20} 
                color={item.is_favourite ? COLORS.danger : "#fff"} 
              />
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.kitchenContent}>
          <Text style={styles.kitchenName} numberOfLines={2}>{item.restaurant_name}</Text>
          
          <View style={styles.kitchenDetails}>
            <View style={styles.detailRow}>
              <Icon name="time-outline" size={12} color={COLORS.textMedium} />
              <Text style={styles.detailText}>{deliveryTime}</Text>
              <View style={styles.dotSeparator} />
              <Icon name="star" size={12} color={COLORS.rating} />
              <Text style={styles.ratingText}>{rating}</Text>
            </View>
          </View>
          
          <Text style={styles.kitchenCuisine} numberOfLines={1}>
            {cuisines.join(' • ')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleKitchenPress, toggleFavorite, favoriteLoading]);

  // Active order footer item
  const renderActiveOrderFooterItem = useCallback((order: ActiveOrder) => {
    const statusColors = {
      'preparing': { bg: '#FEF3C7', text: '#92400E', icon: 'time-outline' },
      'on-the-way': { bg: '#DBEAFE', text: '#1E40AF', icon: 'bicycle-outline' },
      'delivered': { bg: '#D1FAE5', text: '#065F46', icon: 'checkmark-done-outline' },
      'cancelled': { bg: '#FEE2E2', text: '#B91C1C', icon: 'close-circle-outline' },
    };

    const statusColor = statusColors[order.status] || statusColors.preparing;
    const isCancelled = order.status === 'cancelled';

    return (
      <TouchableOpacity
        key={order.id}
        style={styles.activeOrderFooterItem}
        onPress={() => handleOrderPress(order)}
        activeOpacity={0.9}
      >
        <View style={styles.activeOrderFooterContent}>
          <Image 
            source={{ uri: order.kitchenImage || 'https://via.placeholder.com/50' }} 
            style={styles.activeOrderFooterImage}
          />
          <View style={styles.activeOrderFooterDetails}>
            <Text style={styles.activeOrderFooterKitchen} numberOfLines={1}>
              {order.kitchenName}
            </Text>
            <View style={styles.activeOrderFooterStatus}>
              <Icon 
                name={statusColor.icon} 
                size={14} 
                color={statusColor.text} 
              />
              <Text style={[styles.activeOrderFooterStatusText, { color: statusColor.text }]}>
                {order.statusText}
              </Text>
            </View>
          </View>
          {!isCancelled && (
            <TouchableOpacity 
              style={[styles.activeOrderFooterTimeButton, { backgroundColor: statusColor.bg }]}
              onPress={() => handleOrderPress(order)}
            >
              <View style={styles.activeOrderFooterTime}>
                <Text style={[styles.activeOrderFooterTimeLabel, { color: statusColor.text }]}>
                  Arriving in
                </Text>
                <Text style={[styles.activeOrderFooterTimeText, { color: statusColor.text }]}>
                  {order.estimatedArrival}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleOrderPress]);

  const handleRemoveRecentSearch = (query: string) => {
    setRecentSearches(prev => prev.filter(item => item !== query));
  }

  const displayedActiveOrders = showAllActiveOrders ? activeOrders : activeOrders.slice(0, ACTIVE_ORDERS_LIMIT);

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!apiData) {
    return (
      <SafeAreaView style={[styles.container, styles.emptyContainer]}>
        <Icon name="alert-circle-outline" size={60} color={COLORS.textLight} />
        <Text style={styles.emptyText}>No data available</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchKitchens}
          activeOpacity={0.7}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Modal */}
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
        onRemoveRecentSearch={handleRemoveRecentSearch}
      />

      {/* Active Orders Footer */}
      {activeOrders.length > 0 && !ordersLoading && (
        <View style={styles.activeOrdersFooter}>
          {displayedActiveOrders.map((order, index) => (
            <React.Fragment key={order.id}>
              {renderActiveOrderFooterItem(order)}
              {index < displayedActiveOrders.length - 1 && (
                <View style={styles.orderDivider} />
              )}
            </React.Fragment>
          ))}
          
          {activeOrders.length > ACTIVE_ORDERS_LIMIT && (
            <TouchableOpacity 
              style={styles.activeOrdersFooterSeeAll}
              onPress={toggleShowAllActiveOrders}
            >
              <Text style={styles.activeOrdersFooterSeeAllText}>
                {showAllActiveOrders ? 'Show less' : `View all ${activeOrders.length} active orders`}
              </Text>
              <Icon 
                name={showAllActiveOrders ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Header Section with Enhanced Gradient */}
      <Animated.View style={[
        styles.headerContainer,
        {
          backgroundColor: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['transparent', COLORS.card]
          }),
        }
      ]}>
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientMiddle, COLORS.gradientEnd]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.5, 1]}
        >
          <View style={styles.searchContainer}>
            <TouchableOpacity 
              style={styles.searchInputContainer}
              onPress={openSearchModal}
              activeOpacity={0.9}
            >
              <Icon 
                name="search" 
                size={20} 
                color={COLORS.textLight} 
                style={styles.searchIcon} 
              />
              <Text style={[styles.searchInput, { color: COLORS.textLight }]}>
                {SEARCH_PLACEHOLDERS[currentPlaceholderIndex]}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            horizontal
            data={apiData?.data?.CategoryList || []}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryListContainer}
          />
        </LinearGradient>
      </Animated.View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.refreshControl]}
            tintColor={COLORS.refreshControl}
          />
        }
      >
        {/* Quick Filters */}
        <View style={styles.sectionContainer}>
          <FlatList
            horizontal
            data={filters}
            renderItem={renderFilter}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          />
        </View>

        {/* Featured Kitchens */}
        {apiData?.data?.FeatureKitchenList?.length > 0 && (
          <View style={styles.featuredSectionContainer}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
            >
              {apiData.data.FeatureKitchenList.map((item, index) => (
                <TouchableOpacity 
                  key={item.restaurant_id}
                  style={[
                    styles.featuredCard,
                    { marginLeft: index === 0 ? scale(16) : scale(8) }
                  ]}
                  onPress={() => handleKitchenPress(item)}
                  activeOpacity={0.9}
                >
                  <Image 
                    source={{ uri: item.restaurant_image || 'https://via.placeholder.com/200' }} 
                    style={styles.featuredImage}
                    resizeMode="cover"
                  />
                  <View style={styles.featuredContent}>
                    <Text style={styles.featuredName} numberOfLines={2}>
                      {item.restaurant_name}
                    </Text>
                    <Text style={styles.featuredCuisine} numberOfLines={1}>
                      {item.item_cuisines}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Kitchens Near You */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Home Kitchens near you</Text>
          </View>
          
          {filteredKitchens.length === 0 ? (
            <View style={styles.emptyResultContainer}>
              <Icon name="restaurant-outline" size={60} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No restaurants found</Text>
              <Text style={styles.emptySubText}>Try adjusting your filters or search</Text>
            </View>
          ) : (
            <FlatList
              data={filteredKitchens}
              renderItem={renderKitchenItem}
              keyExtractor={(item) => item.restaurant_id}
              scrollEnabled={false}
              contentContainerStyle={styles.kitchenList}
            />
          )}
        </View>
      </ScrollView>

      {/* Cart Summary */}
      {pastKitchenDetails && activeOrders.length === 0 && (
        <View style={styles.cartSummaryContainer}>
          <View style={styles.cartSummaryHeader}>
            <View style={styles.cartSummaryKitchenInfo}>
              <Image 
                source={{ uri: pastKitchenDetails.image }} 
                style={styles.cartSummaryKitchenImage}
              />
              <View>
                <Text style={styles.cartSummaryKitchenName} numberOfLines={1}>
                  {pastKitchenDetails.name}
                </Text>
                <TouchableOpacity 
                  onPress={BackToKitchen}
                  style={styles.cartSummaryViewMenuBtn}
                >
                  <Text style={styles.cartSummaryViewMenuText}>View Menu</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.cartSummaryMiniCartBtn}
              onPress={handleViewCart}
              activeOpacity={0.9}
            >
              <Text style={styles.cartSummaryViewCartText}>View Cart</Text>
              <View style={styles.cartSummaryCartCountBadge}>
                <Text style={styles.cartSummaryMiniCartCount}>{pastKitchenDetails.itemCount}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  emptyResultContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(40),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    marginTop: scale(16),
  },
  emptyText: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginTop: scale(16),
  },
  emptySubText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: scale(8),
  },
  retryButton: {
    marginTop: scale(20),
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    backgroundColor: COLORS.primary,
    borderRadius: scale(8),
  },
  retryButtonText: {
    color: '#fff',
    fontSize: moderateScale(16),
    fontFamily: FONTS.semiBold,
  },

  // Header Styles with Enhanced Gradient
  headerContainer: {
    paddingBottom: scale(10),
    zIndex: 100,
    borderBottomLeftRadius: scale(16),
    borderBottomRightRadius: scale(16),
    overflow: 'hidden',
  },
  headerGradient: {
    paddingBottom: scale(10),
  },
  searchContainer: {
    marginTop: isAndroid ? scale(10) : scale(15),
    paddingHorizontal: scale(20),
    marginBottom: scale(12),
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: scale(12),
    paddingHorizontal: scale(16),
    height: isAndroid ? scale(46) : scale(48),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    width: '100%',
  },
  searchIcon: {
    marginRight: scale(10),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(15),
    fontFamily: FONTS.medium,
    height: '100%',
    paddingVertical: isAndroid ? scale(8) : scale(12),
  },

  // Category Styles
  categoryListContainer: {
    paddingHorizontal: scale(8),
  },
  categoryCard: {
    width: scale(80),
    alignItems: 'center',
    marginHorizontal: scale(8),
    paddingVertical: scale(8),
  },
  activeCategoryCard: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.textOnGradient,
  },
  categoryIconContainer: {
    width: scale(64),
    height: scale(64),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(8),
    borderRadius: scale(32),
    padding: scale(8),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activeCategoryIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  categoryImage: {
    width: scale(65),
    height: scale(65),
    borderRadius: scale(32),
  },
  categoryName: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.categoryText,
    textAlign: 'center',
  },
  activeCategoryName: {
    color: COLORS.activeCategoryText,
    fontFamily: FONTS.semiBold,
  },

  // Main Content Styles
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scale(100),
  },
  sectionContainer: {
    marginTop: scale(10),
    paddingHorizontal: scale(10),
  },
  featuredSectionContainer: {
    marginTop: scale(20),
    marginBottom: scale(10),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(20),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    paddingHorizontal: scale(16),
    marginBottom: scale(12),
  },

  // Filter Styles
  filterList: {
    paddingHorizontal: scale(16),
  },
  filterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: scale(20),
    paddingVertical: scale(8),
    paddingHorizontal: scale(16),
    marginRight: scale(10),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeFilterCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(6),
  },
  activeFilterText: {
    color: '#fff',
  },

  // Featured Kitchens Styles
  featuredList: {
    paddingBottom: scale(16),
  },
  featuredCard: {
    width: scale(200),
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    overflow: 'hidden',
    marginRight: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  featuredImage: {
    width: '100%',
    height: scale(120),
  },
  featuredContent: {
    padding: scale(12),
  },
  featuredName: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(4),
  },
  featuredCuisine: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },

  // Kitchen List Styles
  kitchenList: {
    paddingHorizontal: scale(16),
  },
  kitchenCard: {
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    overflow: 'hidden',
    marginBottom: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  kitchenImageContainer: {
    height: scale(160),
    position: 'relative',
  },
  kitchenImage: {
    width: '100%',
    height: '100%',
  },
  kitchenImagePlaceholder: {
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: scale(12),
    right: scale(12),
    backgroundColor: COLORS.darkOverlay,
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  kitchenContent: {
    padding: scale(16),
  },
  kitchenName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginBottom: scale(8),
  },
  kitchenDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginLeft: scale(4),
  },
  dotSeparator: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: COLORS.textLight,
    marginHorizontal: scale(8),
  },
  ratingText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.rating,
    marginLeft: scale(4),
  },
  kitchenCuisine: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },

  // Active Orders Footer Styles
  activeOrdersFooter: {
    position: 'absolute',
    bottom: isAndroid ? scale(60) : scale(80),
    left: scale(16),
    right: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    padding: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  activeOrderFooterItem: {
    backgroundColor: '#FFF',
    borderRadius: scale(8),
  },
  orderDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: scale(8),
  },
  activeOrderFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(4),
  },
  activeOrderFooterImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  activeOrderFooterDetails: {
    flex: 1,
  },
  activeOrderFooterKitchen: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginBottom: scale(4),
  },
  activeOrderFooterStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeOrderFooterStatusText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    marginLeft: scale(4),
  },
  activeOrderFooterTimeButton: {
    borderRadius: scale(8),
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
  },
  activeOrderFooterTime: {
    alignItems: 'center',
  },
  activeOrderFooterTimeLabel: {
    fontSize: moderateScale(11),
    fontFamily: FONTS.regular,
    marginBottom: scale(2),
  },
  activeOrderFooterTimeText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.semiBold,
  },
  activeOrdersFooterSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: scale(8),
    paddingTop: scale(8),
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activeOrdersFooterSeeAllText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    marginRight: scale(4),
  },

  // Cart Summary Styles
  cartSummaryContainer: {
    position: 'absolute',
    bottom: isAndroid ? scale(65) : scale(85),
    left: scale(16),
    right: scale(16),
    backgroundColor: '#ffffff',
    borderRadius: scale(16),
    padding: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cartSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartSummaryKitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(16),
  },
  cartSummaryKitchenImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  cartSummaryKitchenName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(4),
    maxWidth: scale(150),
  },
  cartSummaryViewMenuBtn: {
    alignSelf: 'flex-start',
  },
  cartSummaryViewMenuText: {
    color: COLORS.primary,
    fontSize: moderateScale(13),
    fontFamily: FONTS.medium,
  },
  cartSummaryMiniCartBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: scale(8),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cartSummaryViewCartText: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontFamily: FONTS.semiBold,
    marginRight: scale(8),
  },
  cartSummaryCartCountBadge: {
    backgroundColor: '#fff',
    borderRadius: scale(10),
    width: scale(20),
    height: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummaryMiniCartCount: {
    color: COLORS.primary,
    fontSize: moderateScale(12),
    fontFamily: FONTS.bold,
  },
});

export default React.memo(KitchenScreen);