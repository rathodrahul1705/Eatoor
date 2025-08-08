import React, { useRef, useState, useEffect } from 'react';
import {
  View, StyleSheet, SafeAreaView, Text, TextInput,
  FlatList, TouchableOpacity, Image, Animated, Dimensions, 
  ScrollView, ActivityIndicator, Alert, RefreshControl, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { getKitchenList, updateFavouriteKitchen } from '../../../api/home';

const { width, height } = Dimensions.get('window');
const isIOS = Platform.OS === 'ios';

// Enhanced Color Palette
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
};

// Typography
const FONTS = {
  bold: 'Inter-Bold',
  semiBold: 'Inter-SemiBold',
  medium: 'Inter-Medium',
  regular: 'Inter-Regular',
};

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
  is_favourite: boolean; // Added favourite status
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

const KitchenScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [filteredKitchens, setFilteredKitchens] = useState<Kitchen[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState<string | null>(null); // Track which kitchen is being toggled

  const searchAnim = useRef(new Animated.Value(0)).current;

  const fetchKitchens = async () => {
    try {
      const response = await getKitchenList();
      // Add mock review count and ensure is_favourite exists
      const dataWithReviews = {
        ...response.data,
        data: {
          ...response.data.data,
          FeatureKitchenList: response.data.data.FeatureKitchenList.map(k => ({
            ...k,
            review_count: Math.floor(Math.random() * 100) + 1,
            is_favourite: k.is_favourite || false // Ensure is_favourite exists
          })),
          KitchenList: response.data.data.KitchenList.map(k => ({
            ...k,
            review_count: Math.floor(Math.random() * 100) + 1,
            is_favourite: k.is_favourite || false // Ensure is_favourite exists
          }))
        }
      };
      setApiData(dataWithReviews);
      setFilteredKitchens(dataWithReviews.data.KitchenList);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch kitchens. Please try again later.');
      console.error('Error fetching kitchens:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKitchens();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, searchQuery, apiData]);

  const applyFilters = () => {
    if (!apiData) return;

    let result = [...apiData.data.KitchenList];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(kitchen => 
        kitchen.restaurant_name.toLowerCase().includes(query) ||
        (kitchen.item_cuisines && kitchen.item_cuisines.toLowerCase().includes(query))
      );
    }

    filters.forEach(filter => {
      if (filter.active) {
        switch (filter.type) {
          case 'rating':
            // Rating filter may not work as rating isn't in the API response
            break;
          case 'veg':
            // Veg filter may not work as is_veg_only isn't in the API response
            break;
          case 'offer':
            // Offer filter may not work as offers aren't in the API response
            break;
          case 'fastDelivery':
            // Delivery time filter may not work as delivery_time isn't in the API response
            break;
        }
      }
    });

    setFilteredKitchens(result);
  };

  const handleFilterPress = (filterId: string) => {
    setFilters(filters.map(filter => 
      filter.id === filterId ? { ...filter, active: !filter.active } : filter
    ));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchKitchens();
  };

  const handleKitchenPress = (kitchen: Kitchen) => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchen.restaurant_id});
  };

  const handleSearchFocus = () => {
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleSearchBlur = () => {
    Animated.timing(searchAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // Toggle favorite status for a kitchen
  const toggleFavorite = async (kitchenId: string) => {
    try {
      setFavoriteLoading(kitchenId);
      
      // Optimistically update the UI
      if (apiData) {
        const updatedKitchenList = apiData.data.KitchenList.map(kitchen => 
          kitchen.restaurant_id === kitchenId 
            ? { ...kitchen, is_favourite: !kitchen.is_favourite } 
            : kitchen
        );
        
        const updatedFeatureKitchenList = apiData.data.FeatureKitchenList.map(kitchen => 
          kitchen.restaurant_id === kitchenId 
            ? { ...kitchen, is_favourite: !kitchen.is_favourite } 
            : kitchen
        );
        
        setApiData({
          ...apiData,
          data: {
            ...apiData.data,
            KitchenList: updatedKitchenList,
            FeatureKitchenList: updatedFeatureKitchenList
          }
        });
      }
      
      // Call the API
      await updateFavouriteKitchen({ restaurant_id: kitchenId });
      
      // Refetch data to ensure sync with server
      await fetchKitchens();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorite status. Please try again.');
      
      // Revert optimistic update if API call fails
      if (apiData) {
        setApiData({
          ...apiData,
          data: {
            ...apiData.data,
            KitchenList: apiData.data.KitchenList,
            FeatureKitchenList: apiData.data.FeatureKitchenList
          }
        });
      }
    } finally {
      setFavoriteLoading(null);
    }
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity style={styles.categoryCard} activeOpacity={0.8}>
      <View style={styles.categoryIconContainer}>
        <Image 
          source={{ uri: item.icon }} 
          style={styles.categoryImage} 
          resizeMode="contain"
        />
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderFilter = ({ item }: { item: Filter }) => (
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
  );

  const renderKitchenItem = ({ item }: { item: Kitchen }) => {
    const deliveryTime = '30-40 min';
    const [minTime, maxTime] = deliveryTime.split('-').map(t => parseInt(t.trim()) || 30);
    const avgTime = Math.floor((minTime + maxTime) / 2);
    
    const distance = '1.5 km';
    const deliveryFee = '₹30';
    const minOrder = item.avg_price_range ? `₹${item.avg_price_range}` : '₹100';
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
            <View style={[styles.kitchenImage, { backgroundColor: COLORS.lightGray }]}>
              <Icon name="restaurant-outline" size={40} color={COLORS.textLight} />
            </View>
          )}
          
          {/* Favorite Button */}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent TouchableOpacity
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
          
          <View style={styles.deliveryInfoContainer}>
            <Text style={styles.deliveryInfoText}>{avgTime} min • {deliveryFee}</Text>
          </View>
        </View>
        
        <View style={styles.kitchenContent}>
          <View style={styles.kitchenHeader}>
            <Text style={styles.kitchenName} numberOfLines={2}>{item.restaurant_name}</Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={14} color={COLORS.rating} />
              <Text style={styles.ratingText}>4.0</Text>
            </View>
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
  };

  const renderFeaturedKitchenPair = (index: number) => {
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
              
              {/* Favorite Button for Featured Items */}
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
              
              {/* Review Count Badge for Featured Items */}
              <View style={styles.reviewBadge}>
                <Icon name="star" size={12} color="#fff" />
                <Text style={styles.reviewBadgeText}>4.0</Text>
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
  };

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

  const featuredPairsCount = Math.ceil(apiData.data.FeatureKitchenList.length / 2);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Search */}
      <Animated.View style={[
        styles.headerContainer,
        {
          backgroundColor: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [COLORS.background, COLORS.card]
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
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icon name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for restaurants or cuisines"
              placeholderTextColor={COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryListContainer}
        >
          {apiData.data.CategoryList.map(category => (
            <TouchableOpacity 
              key={category.id} 
              style={styles.categoryCard}
              activeOpacity={0.8}
            >
              <View style={styles.categoryIconContainer}>
                <Image 
                  source={{ uri: category.icon }} 
                  style={styles.categoryImage} 
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          >
            {filters.map(filter => (
              <TouchableOpacity 
                key={filter.id}
                style={[
                  styles.filterCard,
                  filter.active && styles.activeFilterCard
                ]}
                onPress={() => handleFilterPress(filter.id)}
                activeOpacity={0.7}
              >
                <Icon 
                  name={filter.icon} 
                  size={16} 
                  color={filter.active ? '#fff' : COLORS.textMedium} 
                />
                <Text style={[
                  styles.filterText,
                  filter.active && styles.activeFilterText
                ]}>
                  {filter.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Kitchens - Horizontal Scroll with 2 per screen */}
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
                renderFeaturedKitchenPair(index)
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
            <View style={styles.kitchenList}>
              {filteredKitchens.map(item => (
                <View key={item.restaurant_id} style={styles.kitchenCardWrapper}>
                  {renderKitchenItem({ item })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 100,
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
  
  // Search Bar
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.searchBorder,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
    fontFamily: FONTS.medium,
    height: '100%',
  },
  
  // Categories
  categoryListContainer: {
    paddingHorizontal: 8,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  categoryImage: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  categoryName: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    textAlign: 'center',
  },
  
  // Section Styles
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
  
  // Filter Styles
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
  
  // Featured Kitchens
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
  
  // Kitchen List
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
  // Review Badge Styles
  reviewBadge: {
    position: 'absolute',
    top: 90,
    right: 12,
    backgroundColor: COLORS.darkOverlay,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: '#fff',
    marginLeft: 4,
  },
  kitchenBadgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
  },
  kitchenBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 8,
  },
  vegBadge: {
    backgroundColor: COLORS.success,
  },
  kitchenBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: '#fff',
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
});

export default KitchenScreen;