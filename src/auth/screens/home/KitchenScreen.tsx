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
import moment from 'moment';

// Constants
const { width, height } = Dimensions.get('window');
const isAndroid = Platform.OS === 'android';

const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Enhanced Color Palette with Vibrant Gradient Colors
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
  headerGradientStart: '#E65C00',
  headerGradientEnd: '#DD2476',
  textOnGradient: '#FFFFFF',
  categoryText: 'rgba(255,255,255,0.9)',
  activeCategoryText: '#FFFFFF',
  orderStatusBorder: '#E5E7EB',
  orderPreparing: '#F59E0B',
  orderOnTheWay: '#3B82F6',
  orderDelivered: '#10B981',
  orderCancelled: '#EF4444',
};

const FONTS = {
  bold: isAndroid ? 'sans-serif-medium' : 'Inter-Bold',
  semiBold: isAndroid ? 'sans-serif-medium' : 'Inter-SemiBold',
  medium: isAndroid ? 'sans-serif' : 'Inter-Medium',
  regular: isAndroid ? 'sans-serif' : 'Inter-Regular',
};

const DEFAULT_CATEGORY_ICON = "";
const ACTIVE_ORDERS_LIMIT = 3;

// Types
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

const KitchenScreen: React.FC = () => {
  const navigation = useNavigation();
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
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Fetch user data with proper typing and error handling
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

  // Fetch active orders from API with user dependency
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
            if (order.status === 'Cancelled') {
              status = 'cancelled';
              statusText = 'Cancelled';
            } else if (order.status === 'Pending') {
              status = 'pending';
              statusText = 'Pending';
            } else if (order.status === 'Confirmed') {
              status = 'confirmed';
              statusText = 'Confirmed';
            } else if (order.status === 'On the Way') {
              status = 'on the way';
              statusText = 'On The Way';
            }else if (order.status === 'Preparing') {
              status = 'preparing';
              statusText = 'Preparing';
            }else if (order.status === 'Ready for Delivery/Pickup') {
              status = 'Ready for Delivery/Pickup';
              statusText = 'Ready for Delivery/Pickup';
            }else if (minutesRemaining <= 0) {
              status = 'delivered';
              statusText = 'Delivered';
            } else {
              status = 'preparing';
              statusText = 'Preparing';
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
          // ✅ Only keep orders that are NOT delivered
          .filter(order => order.status !== 'delivered');

        // Sort by remaining minutes
        formattedOrders.sort((a, b) => {
          const aMinutes = parseInt(a.estimatedArrival);
          const bMinutes = parseInt(b.estimatedArrival);
          return aMinutes - bMinutes;
        });

        setActiveOrders(formattedOrders);
      }
    } catch (error) {
      console.error('Error fetching active orders:', error);
      Alert.alert('Error', 'Failed to load active orders. Please try again.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Save past kitchen details with error handling
  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    try {
      await AsyncStorage.setItem('pastKitchenDetails', JSON.stringify(details));
      setPastKitchenDetails(details);
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
    }
  }, []);
  
  // Fetch past kitchen details with proper user dependency
  const fetchPastKitchenDetails = useCallback(async (userId: string) => {
    try {
      const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');
      if (storedDetails != null) {
        setPastKitchenDetails(JSON.parse(storedDetails));
        return;
      }

      const payload = {
        session_id: null,
        user_id: userId
      };

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

  // Main data fetching function
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

  // Initial data loading with proper cleanup and user dependency
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const user = await fetchUserData();
        if (user && isMounted) {
          await Promise.all([
            fetchKitchens(),
            fetchActiveOrders(user.id),
            fetchPastKitchenDetails(user.id)
          ]);
        } else {
          await fetchKitchens();
        }
      } catch (error) {
        console.error('Initial data loading error:', error);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchKitchens, fetchPastKitchenDetails, fetchUserData, fetchActiveOrders]);

  // Refresh control handler with user dependency
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

  // Order press handler
  const handleOrderPress = useCallback(
    (order: ActiveOrder) => {
      navigation.navigate('TrackOrder', { order: { order_number: order.orderNumber } });
    },
    [navigation]
  );

  const handleViewAllOrders = useCallback(() => {
    navigation.navigate('ActiveOrders', { orders: activeOrders });
  }, [navigation, activeOrders]);

  const toggleShowAllActiveOrders = useCallback(() => {
    setShowAllActiveOrders(prev => !prev);
  }, []);

  // Render a single active order in the footer
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
              style={styles.activeOrderFooterTimeButton}
              onPress={() => handleOrderPress(order)}
            >
              <View style={styles.activeOrderFooterTime}>
                <Text style={styles.activeOrderFooterTimeLabel}>Arriving in</Text>
                <View style={styles.activeOrderFooterTimeBadge}>
                  <Text style={styles.activeOrderFooterTimeText}>
                    {order.estimatedArrival}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleOrderPress]);

  // Initialize filters with useMemo
  const [filters, setFilters] = useState<Filter[]>(useMemo(() => [
    { id: '1', name: 'Rating 4.0+', icon: 'star', type: 'rating', active: false },
    { id: '2', name: 'Pure Veg', icon: 'leaf', type: 'veg', active: false },
    { id: '3', name: 'Offers', icon: 'pricetag', type: 'offer', active: false },
    { id: '4', name: 'Fast Delivery', icon: 'rocket', type: 'fastDelivery', active: false },
  ], []));

  // Memoized filtered kitchens
  const filteredKitchens = useMemo(() => {
    if (!apiData) return [];

    let result = [...apiData.data.KitchenList];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(kitchen => 
        kitchen.restaurant_name.toLowerCase().includes(query) ||
        (kitchen.item_cuisines && kitchen.item_cuisines.toLowerCase().includes(query))
      );
    }

    if (activeCategory !== null && apiData.data.CategoryList[activeCategory]) {
      const categoryName = apiData.data.CategoryList[activeCategory].name;
      result = result.filter(kitchen => 
        kitchen.item_cuisines && kitchen.item_cuisines.toLowerCase().includes(categoryName.toLowerCase())
      );
    }

    filters.forEach(filter => {
      if (filter.active) {
        switch (filter.type) {
          case 'rating':
            result = result.filter(() => (Math.random() * 5) >= 4.0);
            break;
          case 'veg':
          case 'offer':
          case 'fastDelivery':
            break;
        }
      }
    });

    return result;
  }, [apiData, searchQuery, activeCategory, filters]);

  // Category press handler
  const handleCategoryPress = useCallback((categoryId: number) => {
    setActiveCategory(prev => prev === categoryId ? null : categoryId);
  }, []);

  // Filter press handler
  const handleFilterPress = useCallback((filterId: string) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, active: !filter.active } : filter
    ));
  }, []);

  // Kitchen press handler
  const handleKitchenPress = useCallback((kitchen: Kitchen) => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchen.restaurant_id });
  }, [navigation]);

  // Search animation handlers
  const handleSearchFocus = useCallback(() => {
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [searchAnim]);

  const handleSearchBlur = useCallback(() => {
    Animated.timing(searchAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [searchAnim]);

  // Favorite toggle with proper error handling
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
      
      setApiData(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          data: {
            ...prev.data,
            KitchenList: prev.data.KitchenList,
            FeatureKitchenList: prev.data.FeatureKitchenList
          }
        };
      });
    } finally {
      setFavoriteLoading(null);
    }
  }, [favoriteLoading]);

  // Navigation handlers
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

  // Memoized render functions for performance
  const renderCategory = useCallback(({ item, index }: { item: Category, index: number }) => (
    <TouchableOpacity 
      style={[
        styles.categoryCard,
        activeCategory === index && styles.activeCategoryCard
      ]} 
      activeOpacity={0.8}
      onPress={() => handleCategoryPress(index)}
    >
      <View style={[
        styles.categoryIconContainer,
        activeCategory === index && styles.activeCategoryIconContainer
      ]}>
        <Image 
          source={{ uri: item.icon }} 
          style={styles.categoryImage} 
          resizeMode="cover"
          defaultSource={DEFAULT_CATEGORY_ICON}
          onError={() => DEFAULT_CATEGORY_ICON}
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
    const [minTime, maxTime] = deliveryTime.split('-').map(t => parseInt(t.trim()) || 30);
    const avgTime = Math.floor((minTime + maxTime) / 2);
    
    const distance = '1.5 km';
    const deliveryFee = '₹30';
    const minOrder = item.avg_price_range ? `₹${item.avg_price_range}` : '₹100';
    const cuisines = item.item_cuisines ? item.item_cuisines.split(', ') : [];
    const rating = (Math.random() * 1 + 4).toFixed(1);

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
            <View style={[styles.kitchenImage, { backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' }]}>
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
          
          <View style={styles.ratingBadge}>
            <Icon name="star" size={12} color="#fff" />
            <Text style={styles.ratingBadgeText}>{rating}</Text>
          </View>
          
          <View style={styles.deliveryInfoContainer}>
            <Text style={styles.deliveryInfoText}>{avgTime} min • {deliveryFee}</Text>
          </View>
        </View>
        
        <View style={styles.kitchenContent}>
          <View style={styles.kitchenHeader}>
            <Text style={styles.kitchenName} numberOfLines={2}>{item.restaurant_name}</Text>
          </View>
          
          <Text style={styles.kitchenCuisine} numberOfLines={1}>
            {cuisines.join(' • ')}
          </Text>
          
          <View style={styles.kitchenFooter}>
            <Text style={styles.minOrder}>Min. {minOrder}</Text>
            <View style={styles.dotSeparator} />
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleKitchenPress, toggleFavorite, favoriteLoading]);

  const renderFeaturedKitchenPair = useCallback((index: number) => {
    if (!apiData) return null;
      
    const pair = apiData.data.FeatureKitchenList.slice(index * 2, index * 2 + 2);
    if (pair.length === 0) return null;

    return (
      <View key={`pair-${index}`} style={styles.featuredPairContainer}>
        {pair.map((item) => {
          const deliveryTime = '25-35 min';
          const [minTime, maxTime] = deliveryTime.split('-').map(t => parseInt(t.trim()) || 30);
          const avgTime = Math.floor((minTime + maxTime) / 2);
          const cuisines = item.item_cuisines ? item.item_cuisines.split(', ') : [];
          const rating = (Math.random() * 1 + 4).toFixed(1);

          return (
            <TouchableOpacity 
              key={item.restaurant_id}
              style={styles.featuredCard}
              onPress={() => handleKitchenPress(item)}
              activeOpacity={0.9}
            >
              {item.restaurant_image ? (
                <Image 
                  source={{ uri: item.restaurant_image }} 
                  style={styles.featuredImage} 
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.featuredImage, { backgroundColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center' }]}>
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
              
              <View style={styles.ratingBadge}>
                <Icon name="star" size={12} color="#fff" />
                <Text style={styles.ratingBadgeText}>{rating}</Text>
              </View>
              
              <View style={styles.featuredContent}>
                <View style={styles.featuredHeader}>
                  <Text style={styles.featuredName} numberOfLines={3}>{item.restaurant_name}</Text>
                </View>
                <Text style={styles.featuredInfo} numberOfLines={1}>
                  {cuisines.join(' • ')}
                </Text>
                <View style={styles.featuredFooter}>
                  <Text style={styles.featuredDeliveryText}>
                    <Icon name="time" size={12} color={COLORS.textMedium} /> {avgTime} mins • ₹30
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [apiData, handleKitchenPress, toggleFavorite, favoriteLoading]);

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Error state
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

  // Calculate featured pairs count
  const featuredPairsCount = Math.ceil(apiData.data.FeatureKitchenList.length / 2);
  const displayedActiveOrders = showAllActiveOrders ? activeOrders : activeOrders.slice(0, ACTIVE_ORDERS_LIMIT);

  return (
    <SafeAreaView style={styles.container}>
      {/* Active Orders Footer - Only show if there are active orders */}
      {activeOrders.length > 0 && !ordersLoading && (
        <View style={styles.activeOrdersFooter}>
          {displayedActiveOrders.map(order => (
            <React.Fragment key={order.id}>
              {renderActiveOrderFooterItem(order)}
              {order !== displayedActiveOrders[displayedActiveOrders.length - 1] && (
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

      {/* Header Section */}
      <Animated.View style={[
        styles.headerContainer,
        {
          backgroundColor: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['transparent', COLORS.card]
          }),
          borderBottomWidth: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1]
          }),
          borderBottomColor: COLORS.searchBorder,
          shadowOpacity: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.1]
          }),
          elevation: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 3]
          }),
        }
      ]}>
        <LinearGradient
          colors={[COLORS.headerGradientStart, COLORS.headerGradientEnd]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon 
                name="search" 
                size={20} 
                color={searchQuery ? COLORS.headerGradientStart : COLORS.headerGradientEnd} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={[styles.searchInput, { color: COLORS.textDark }]}
                placeholder="Search for home kitchens or cuisines"
                placeholderTextColor={COLORS.textLight}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close-circle" size={20} color={COLORS.textDark} />
                </TouchableOpacity>
              ) : null}
            </View>
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
              snapToInterval={width - 32}
              decelerationRate="fast"
              snapToAlignment="start"
            >
              {[...Array(featuredPairsCount)].map((_, index) => (
                <React.Fragment key={`featured-${index}`}>
                  {renderFeaturedKitchenPair(index)}
                </React.Fragment>
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
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
            />
          )}
        </View>
      </ScrollView>

      {/* Bottom Section - Shows either Past Kitchen Cart or nothing if both are not applicable */}
      {pastKitchenDetails && activeOrders.length === 0 && (
        <View style={styles.cartSummary__container}>
          <View style={styles.cartSummary__header}>
            <View style={styles.cartSummary__kitchenInfo}>
              <Image 
                source={{ uri: pastKitchenDetails.image }} 
                style={styles.cartSummary__kitchenImage}
              />
              <View>
                <Text style={styles.cartSummary__kitchenName} numberOfLines={1}>
                  {pastKitchenDetails.name}
                </Text>
                <TouchableOpacity 
                  onPress={BackToKitchen}
                  style={styles.cartSummary__viewMenuBtn}
                >
                  <Text style={styles.cartSummary__viewMenuText}>View Menu</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.cartSummary__miniCartBtn}
              onPress={handleViewCart}
              activeOpacity={0.9}
            >
              <View style={styles.cartSummary__miniCartContent}>
                <Text style={styles.cartSummary__viewCartText}>View Cart</Text>
                <View style={styles.cartSummary__cartCountBadge}>
                  <Text style={styles.cartSummary__miniCartCount}>{pastKitchenDetails.itemCount}</Text>
                </View>
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
    flex: 1,
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scale(30),
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: scale(32),
    padding: scale(8),
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
  seeAllText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
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
  featuredList: {
    paddingLeft: scale(16),
    paddingRight: scale(8),
    paddingBottom: scale(16),
  },
  featuredPairContainer: {
    width: width - scale(32),
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: scale(16),
  },
  featuredCard: {
    width: (width - scale(48)) / 2,
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    overflow: 'hidden',
    marginBottom: scale(8),
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
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(6),
  },
  featuredName: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    flex: 1,
    marginRight: scale(8),
  },
  featuredRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  featuredRatingText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.semiBold,
    color: '#92400E',
    marginLeft: scale(4),
  },
  featuredInfo: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginBottom: scale(8),
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredDeliveryText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  kitchenList: {
    paddingHorizontal: scale(16),
  },
  kitchenCardWrapper: {
    paddingHorizontal: scale(16),
    marginBottom: scale(16),
  },
  kitchenCard: {
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: scale(26),
  },
  kitchenImageContainer: {
    height: scale(160),
    position: 'relative',
  },
  kitchenImage: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: scale(12),
    left: scale(12),
    backgroundColor: COLORS.darkOverlay,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(12),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },
  ratingBadgeText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: '#fff',
    marginLeft: scale(4),
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
  deliveryInfoContainer: {
    position: 'absolute',
    bottom: scale(12),
    left: scale(12),
    backgroundColor: COLORS.darkOverlay,
    borderRadius: scale(4),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },
  deliveryInfoText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: '#fff',
  },
  kitchenContent: {
    padding: scale(16),
  },
  kitchenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  kitchenName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  ratingText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.bold,
    color: '#92400E',
    marginLeft: scale(4),
  },
  kitchenCuisine: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginBottom: scale(12),
  },
  kitchenFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  minOrder: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  dotSeparator: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    backgroundColor: COLORS.textLight,
    marginHorizontal: scale(8),
  },
  distanceText: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  // Active Orders Footer Styles
  activeOrdersFooter: {
    position: 'absolute',
    bottom: isAndroid ? scale(60): scale(80),
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
    backgroundColor: '#E65C00',
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
    color: '#FFFFFF',
    marginBottom: scale(2),
  },
  activeOrderFooterTimeBadge: {
    color: '#FFFFFF',
    borderRadius: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  activeOrderFooterTimeText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
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
  cartSummary__container: {
    bottom: Platform.OS === 'android' ? scale(30) : scale(15),
    backgroundColor: '#ffffff',
    borderRadius: scale(16),
    padding: scale(16),
    marginHorizontal: scale(16),
    marginBottom: scale(40),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cartSummary__header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartSummary__kitchenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(16),
  },
  cartSummary__kitchenImage: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  cartSummary__kitchenName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(4),
    maxWidth: scale(150),
  },
  cartSummary__viewMenuBtn: {
    alignSelf: 'flex-start',
  },
  cartSummary__viewMenuText: {
    color: COLORS.primary,
    fontSize: moderateScale(13),
    fontFamily: FONTS.medium,
  },
  cartSummary__miniCartBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: scale(8),
    paddingHorizontal: scale(8),
    paddingVertical: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cartSummary__miniCartContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartSummary__viewCartText: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontFamily: FONTS.semiBold,
    marginRight: scale(8),
  },
  cartSummary__cartCountBadge: {
    backgroundColor: '#fff',
    borderRadius: scale(10),
    width: scale(20),
    height: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummary__miniCartCount: {
    color: COLORS.primary,
    fontSize: moderateScale(12),
    fontFamily: FONTS.bold,
  },
});

export default React.memo(KitchenScreen);