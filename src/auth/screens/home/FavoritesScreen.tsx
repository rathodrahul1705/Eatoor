import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  Dimensions,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getfavouriteKitchenList, updateFavouriteKitchen } from '../../../api/home';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

const FavoritesScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchFavorites();
    }, [])
  );

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const response = await getfavouriteKitchenList();

      if (response?.data?.length > 0) {
        const transformedData = response.data.map(item => ({
          id: item.id.toString(),
          title: item.restaurant_details.restaurant_name,
          category: item.restaurant_details.cuisine_type || 'Home Kitchen',
          rating: item.restaurant_details.average_rating || 4.5,
          reviews: item.restaurant_details.review_count || 24,
          price: item.restaurant_details.average_price || 199,
          image: item.restaurant_details.profile_image,
          description: item.restaurant_details.description || 'Delicious homemade meals',
          isFavorite: true,
          prepTime: item.restaurant_details.prep_time || '30 mins',
          restaurantId: item.restaurant_details.restaurant_id,
          status: item.restaurant_details.restaurant_status
        }));
        setFavorites(transformedData);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites();
  };

  const filteredFavorites = favorites.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFavorite = async (id, restaurantId) => {
    try {
      setFavorites(prevFavorites => 
        prevFavorites
          .map(item => 
            item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
          )
          .filter(item => item.isFavorite)
      );
      
      const payload = {
        restaurant_id: restaurantId
      };
      
      await updateFavouriteKitchen(payload);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      fetchFavorites();
    }
  };

  const handleItemPress = (item) => {
    navigation.navigate('HomeKitchenDetails', { 
      kitchenId: item.restaurantId,
      kitchenName: item.title,
      kitchenImage: item.image
    });
  };

  const renderItem = ({ item, index }) => (
    <Animated.View 
      style={[
        styles.cardWrapper,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          {item.image ? (
            <Image 
              source={{ uri: item.image }} 
              style={styles.cardImage} 
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
              <Icon name="restaurant" size={50} color="#FF5E00" />
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id, item.restaurantId);
            }}
          >
            <Icon 
              name={item.isFavorite ? 'heart' : 'heart-outline'} 
              size={22} 
              color="#FF5E00" 
            />
          </TouchableOpacity>
          
          {item.status !== 2 && (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>Closed</Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.priceText}>₹{item.price}</Text>
          </View>
          
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.cardCategory}>{item.category}</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
              <Text style={styles.reviewsText}>({item.reviews})</Text>
            </View>
            
            <View style={styles.prepTimeContainer}>
              <Icon name="time-outline" size={14} color="#FF5E00" />
              <Text style={styles.prepTime}>{item.prepTime}</Text>
            </View>
          </View>
          
          {item.description && (
            <Text style={styles.descriptionText} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyComponent = () => {
    if (loading) return null;
    
    return (
      <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
        <View style={styles.emptyIconContainer}>
          <Icon name="heart-dislike" size={70} color="#FF5E00" />
        </View>
        <Text style={styles.emptyTitle}>No favorites yet</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery.length > 0 
            ? "No kitchens match your search"
            : "Save your favorite kitchens for quick access"}
        </Text>
        <TouchableOpacity 
          style={styles.exploreButton}
          onPress={() => navigation.navigate('HomeTabs')}
          activeOpacity={0.8}
        >
          <Text style={styles.exploreButtonText}>Explore Kitchens</Text>
          <Icon name="chevron-forward" size={18} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favorites</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your favorite kitchens..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')} 
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5E00" />
        </View>
      ) : (
        <FlatList
          data={filteredFavorites}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF5E00']}
              tintColor="#FF5E00"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    height: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'sans-serif',
      },
    }),
  },
  clearButton: {
    padding: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  imageContainer: {
    position: 'relative',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: 200,
    backgroundColor: '#f5f5f5',
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  closedBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(255, 94, 0, 0.95)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  cardContent: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '700',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF5E00',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '700',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  categoryRow: {
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#FF5E0010',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  cardCategory: {
    fontSize: 12,
    color: '#FF5E00',
    fontWeight: '600',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
    marginRight: 4,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  reviewsText: {
    fontSize: 12,
    color: '#777',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'sans-serif',
      },
    }),
  },
  prepTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prepTime: {
    fontSize: 13,
    color: '#FF5E00',
    marginLeft: 4,
    fontWeight: '500',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '500',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  descriptionText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'sans-serif',
      },
    }),
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 94, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
      android: {
        fontFamily: 'sans-serif',
      },
    }),
  },
  exploreButton: {
    backgroundColor: '#FF5E00',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FF5E00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  exploreButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
    ...Platform.select({
      ios: {
        fontFamily: 'System',
        fontWeight: '600',
      },
      android: {
        fontFamily: 'sans-serif-medium',
      },
    }),
  },
});

export default FavoritesScreen;