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
import { getCart } from '../../../api/cart';

// Constants
const { width, height } = Dimensions.get('window');
const isIOS = Platform.OS === 'ios';

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
};

const FONTS = {
  bold: 'Inter-Bold',
  semiBold: 'Inter-SemiBold',
  medium: 'Inter-Medium',
  regular: 'Inter-Regular',
};

const DEFAULT_CATEGORY_ICON = "";

// Types
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

const KitchenScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [pastKitchenDetails, setPastKitchenDetails] = useState<PastKitchenDetails | null>(null);
  const [user, setUser] = useState(null);
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Initialize filters with useMemo to prevent unnecessary recreations
  const [filters, setFilters] = useState<Filter[]>(useMemo(() => [
    { id: '1', name: 'Rating 4.0+', icon: 'star', type: 'rating', active: false },
    { id: '2', name: 'Pure Veg', icon: 'leaf', type: 'veg', active: false },
    { id: '3', name: 'Offers', icon: 'pricetag', type: 'offer', active: false },
    { id: '4', name: 'Fast Delivery', icon: 'rocket', type: 'fastDelivery', active: false },
  ], []));

  // Memoized filtered kitchens to prevent unnecessary recalculations
  const filteredKitchens = useMemo(() => {
    if (!apiData) return [];

    let result = [...apiData.data.KitchenList];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(kitchen => 
        kitchen.restaurant_name.toLowerCase().includes(query) ||
        (kitchen.item_cuisines && kitchen.item_cuisines.toLowerCase().includes(query))
    )}

    // Apply category filter
    if (activeCategory !== null && apiData.data.CategoryList[activeCategory]) {
      const categoryName = apiData.data.CategoryList[activeCategory].name;
      result = result.filter(kitchen => 
        kitchen.item_cuisines && kitchen.item_cuisines.toLowerCase().includes(categoryName.toLowerCase()))
    }

    // Apply other filters
    filters.forEach(filter => {
      if (filter.active) {
        switch (filter.type) {
          case 'rating':
            result = result.filter(() => (Math.random() * 5) >= 4.0);
            break;
          case 'veg':
          case 'offer':
          case 'fastDelivery':
            // Implement actual filtering logic here when available
            break;
        }
      }
    });

    return result;
  }, [apiData, searchQuery, activeCategory, filters]);

  // Fetch user data with proper cleanup
  const fetchUserData = useCallback(async () => {
    try {
      const [userData] = await Promise.all([
        AsyncStorage.getItem('user'),
      ]);      
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
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
  
  // Fetch past kitchen details with proper dependencies
  const fetchPastKitchenDetails = useCallback(async () => {
    try {
      const storedDetails = await AsyncStorage.getItem('pastKitchenDetails');
      if (storedDetails != null) {
        setPastKitchenDetails(JSON.parse(storedDetails));
        return;
      }

      console.log("user======",user)

      const payload = {
        session_id: null,
        user_id: user?.id
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
      }else{
        setPastKitchenDetails(null)
      }
    } catch (error) {
      console.error('Error fetching past kitchen details:', error);
    }
  }, [user?.id, savePastKitchenDetails]);

  // Main data fetching function with proper error handling
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

  // Initial data loading with cleanup
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      await fetchUserData();
      await fetchKitchens();
      if (isMounted) {
        await fetchPastKitchenDetails();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchKitchens, fetchPastKitchenDetails, fetchUserData]);

  // Refresh control handler
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchKitchens();
  }, [fetchKitchens]);

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
      
      // Revert UI changes if API call fails
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Gradient Header Section */}
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
                color={searchQuery ? COLORS.textDark : COLORS.textOnGradient} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={[styles.searchInput, { color: COLORS.textDark }]}
                placeholder="Search for restaurants or cuisines"
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

          {/* Categories with active state */}
          <FlatList
            horizontal
            data={apiData.data.CategoryList}
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
        {apiData.data.FeatureKitchenList.length > 0 && (
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

      {/* Past Kitchen Cart Summary */}
      {pastKitchenDetails && (
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
  headerContainer: {
    paddingBottom: 10,
    zIndex: 100,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingBottom: 10,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyResultContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  searchContainer: {
    marginTop:15,
    paddingHorizontal: 30,
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.medium,
    height: '100%',
  },
  categoryListContainer: {
    paddingHorizontal: 8,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
    marginHorizontal: 8,
    paddingVertical: 8,
  },
  activeCategoryCard: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.textOnGradient,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 32,
    padding: 8,
  },
  activeCategoryIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  categoryImage: {
    width: 65,
    height: 65,
    borderRadius: 32,
    // tintColor: COLORS.categoryText,
  },
  categoryName: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.categoryText,
    textAlign: 'center',
  },
  activeCategoryName: {
    color: COLORS.activeCategoryText,
    fontFamily: FONTS.semiBold,
  },
  sectionContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  featuredSectionContainer: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
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
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: 6,
  },
  activeFilterText: {
    color: '#fff',
  },
  featuredList: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingBottom: 16,
  },
  featuredPairContainer: {
    width: width - 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 16,
  },
  featuredCard: {
    width: (width - 48) / 2,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  featuredImage: {
    width: '100%',
    height: 120,
  },
  featuredContent: {
    padding: 12,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  featuredName: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    flex: 1,
    marginRight: 8,
  },
  featuredRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featuredRatingText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: '#92400E',
    marginLeft: 4,
  },
  featuredInfo: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginBottom: 8,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredDeliveryText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  kitchenList: {
    paddingHorizontal: 0,
  },
  kitchenCardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  kitchenCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  kitchenImageContainer: {
    height: 160,
    position: 'relative',
  },
  kitchenImage: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.darkOverlay,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#fff',
    marginLeft: 4,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.darkOverlay,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryInfoContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: COLORS.darkOverlay,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deliveryInfoText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#fff',
  },
  kitchenContent: {
    padding: 16,
  },
  kitchenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  kitchenName: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#92400E',
    marginLeft: 4,
  },
  kitchenCuisine: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginBottom: 12,
  },
  kitchenFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  minOrder: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textLight,
    marginHorizontal: 8,
  },
  distanceText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
  },
  cartSummary__container: {
    bottom:30,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
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
    marginRight: 16,
  },
  cartSummary__kitchenImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  cartSummary__kitchenName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: 4,
    maxWidth: 150,
  },
  cartSummary__viewMenuBtn: {
    alignSelf: 'flex-start',
  },
  cartSummary__viewMenuText: {
    color: COLORS.primary,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  cartSummary__miniCartBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
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
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    marginRight: 8,
  },
  cartSummary__cartCountBadge: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartSummary__miniCartCount: {
    color: COLORS.primary,
    fontSize: 12,
    fontFamily: FONTS.bold,
  },
});

export default React.memo(KitchenScreen);