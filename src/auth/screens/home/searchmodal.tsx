import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  SafeAreaView,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modal';
import moment from 'moment';

const { width, height } = Dimensions.get('window');
const isAndroid = Platform.OS === 'android';
const statusBarHeight = StatusBar.currentHeight || 0;

// Enhanced Color Palette - Swiggy Inspired
const COLORS = {
  primary: '#FC8019',
  primaryLight: '#FF9F5B',
  secondary: '#FFD166',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textDark: '#1E1E29',
  textMedium: '#686B78',
  textLight: '#93959F',
  success: '#06C167',
  danger: '#FF3B30',
  info: '#5AC8FA',
  lightGray: '#F1F1F6',
  border: '#E8E8E8',
  rating: '#FFC120',
  darkOverlay: 'rgba(0,0,0,0.6)',
  lightOverlay: 'rgba(255,255,255,0.4)',
  recentSearchBg: '#F8F9FA',
  recentSearchText: '#5E6770',
  veg: '#06C167',
  nonVeg: '#FF3B30',
  searchHighlight: '#FFF9C4',
  modalBackground: 'rgba(0, 0, 0, 0.8)',
  searchModalBg: '#FFFFFF',
  trending: '#FF6B9D',
  headerGradientStart: '#E65C00',
  headerGradientEnd: '#DD2476',
  swiggyOrange: '#FC8019',
  swiggyDark: '#1E1E29',
};

const FONTS = {
  bold: isAndroid ? 'sans-serif-medium' : 'Inter-Bold',
  semiBold: isAndroid ? 'sans-serif-medium' : 'Inter-SemiBold',
  medium: isAndroid ? 'sans-serif' : 'Inter-Medium',
  regular: isAndroid ? 'sans-serif' : 'Inter-Regular',
};

const scale = (size: number) => (width / 375) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

const getModalHeight = () => {
  return height;
};

// Popular searches constant
const POPULAR_SEARCHES = [
  "Biryani", "Pizza", "Burger", "Chinese", "North Indian",
  "South Indian", "Ice Cream", "Beverages", "Thali", "Rolls",
  "Momos", "Noodles", "Fried Rice", "Chicken", "Desserts"
];

// Types
interface SearchItem {
  id: string;
  name: string;
  image: string;
  type: 'food' | 'restaurant' | 'trending' | 'popular';
  category?: string;
  price?: string;
  foodType?: string;
  rating?: number;
  deliveryTime?: string;
  distance?: string;
  searchedAt?: string;
  originalData?: any;
}

interface SearchModalProps {
  isVisible: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  recentSearches: string[];
  searchHistory: SearchItem[];
  searchResults: SearchItem[];
  searchLoading: boolean;
  onRecentSearchPress: (query: string) => void;
  onPopularSearchPress: (query: string) => void;
  onSearchResultPress: (item: SearchItem) => void;
  onClearRecentSearches: () => void;
  onRemoveRecentSearch: (query: string) => void;
  searchInputRef: React.RefObject<TextInput>;
}

const SearchModal: React.FC<SearchModalProps> = ({
  isVisible,
  onClose,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  recentSearches,
  searchHistory,
  searchResults,
  searchLoading,
  onRecentSearchPress,
  onPopularSearchPress,
  onSearchResultPress,
  onClearRecentSearches,
  onRemoveRecentSearch,
  searchInputRef,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isComponentVisible, setIsComponentVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const modalHeight = getModalHeight();

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      setIsComponentVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      });
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setIsComponentVisible(false);
        Keyboard.dismiss();
      });
    }
  }, [isVisible, slideAnim, fadeAnim]);

  const slideIn = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-height, 0],
  });

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleContentTouch = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
    }
  };

  const handleScrollBegin = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
    }
  };

  const handleSearchResultPress = (item: SearchItem) => {
    Keyboard.dismiss();
    onSearchResultPress(item);
  };

  const handleRecentSearchPress = (query: string) => {
    onRecentSearchPress(query);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handlePopularSearchPress = (query: string) => {
    onPopularSearchPress(query);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <Text key={index} style={styles.highlightedText}>
          {part}
        </Text>
      ) : (
        part
      )
    );
  };

  const renderRecentSearchItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      style={styles.recentSearchItem}
      onPress={() => handleRecentSearchPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recentSearchIconContainer}>
        <Icon name="time-outline" size={18} color={COLORS.textMedium} />
      </View>
      <Text style={styles.recentSearchText} numberOfLines={1}>
        {highlightText(item, searchQuery)}
      </Text>
      <TouchableOpacity 
        style={styles.recentSearchDelete}
        onPress={(e) => {
          e.stopPropagation();
          onRemoveRecentSearch(item);
        }}
      >
        <Icon name="close" size={16} color={COLORS.textLight} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSearchHistoryItem = ({ item, index }: { item: SearchItem; index: number }) => (
    <TouchableOpacity
      style={styles.searchHistoryItem}
      onPress={() => handleSearchResultPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchHistoryIconContainer}>
        <Icon name="search-outline" size={18} color={COLORS.swiggyOrange} />
      </View>
      <View style={styles.searchHistoryContent}>
        <Text style={styles.searchHistoryName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.searchHistoryType} numberOfLines={1}>
          {item.type === 'restaurant' ? 'Restaurant' : 'Food Item'} • 
          {item.searchedAt && moment(item.searchedAt).fromNow()}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  const renderSearchResultItem = ({ item, index }: { item: SearchItem; index: number }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => handleSearchResultPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.searchResultImageContainer}>
        <Image 
          source={{ uri: item.image || 'https://via.placeholder.com/60' }} 
          style={styles.searchResultImage}
          resizeMode="cover"
          defaultSource={{ uri: 'https://via.placeholder.com/60' }}
        />
        {item.type === 'trending' && (
          <View style={styles.trendingBadgeSmall}>
            <Icon name="trending-up" size={10} color="#fff" />
          </View>
        )}
      </View>
      
      <View style={styles.searchResultContent}>
        <View style={styles.searchResultHeader}>
          <Text style={styles.searchResultName} numberOfLines={2}>
            {highlightText(item.name, searchQuery)}
          </Text>
          {item.type === 'trending' && (
            <View style={styles.trendingIndicator}>
              <Icon name="flame" size={14} color={COLORS.trending} />
            </View>
          )}
        </View>
        
        {item.category && (
          <Text style={styles.searchResultCategory} numberOfLines={1}>
            {item.category}
          </Text>
        )}
        
        <View style={styles.searchResultMeta}>
          {item.rating && (
            <View style={styles.ratingContainer}>
              <Icon name="star" size={12} color={COLORS.rating} />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
          
          {item.deliveryTime && (
            <View style={styles.metaItem}>
              <Icon name="time-outline" size={12} color={COLORS.textMedium} />
              <Text style={styles.metaText}>{item.deliveryTime}</Text>
            </View>
          )}
          
          {item.distance && (
            <View style={styles.metaItem}>
              <Icon name="location-outline" size={12} color={COLORS.textMedium} />
              <Text style={styles.metaText}>{item.distance}</Text>
            </View>
          )}
        </View>
        
        {item.foodType && (
          <View style={[
            styles.foodTypeBadge,
            { backgroundColor: item.foodType === 'Veg' ? COLORS.veg : COLORS.nonVeg }
          ]}>
            <Text style={styles.foodTypeText}>{item.foodType}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.searchResultAction}>
        <Icon name="chevron-forward" size={20} color={COLORS.textLight} />
      </View>
    </TouchableOpacity>
  );

  const renderTrendingCard = (item: SearchItem, index: number) => (
    <TouchableOpacity
      key={`trending-${item.id}-${index}`}
      style={styles.trendingCard}
      onPress={() => handleSearchResultPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.trendingImageContainer}>
        <Image 
          source={{ uri: item.image }} 
          style={styles.trendingImage}
          resizeMode="cover"
        />
        <View style={styles.trendingOverlay} />
        <View style={styles.trendingBadge}>
          <Icon name="trending-up" size={14} color="#fff" />
          <Text style={styles.trendingBadgeText}>Trending</Text>
        </View>
      </View>
      <View style={styles.trendingContent}>
        <Text style={styles.trendingName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.rating && (
          <View style={styles.trendingRating}>
            <Icon name="star" size={12} color={COLORS.rating} />
            <Text style={styles.trendingRatingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSearchSections = () => {
    if (searchQuery.length === 0) {
      return (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.searchInitialState}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBegin}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <View style={styles.searchSection}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleContainer}>
                  <Icon name="time-outline" size={20} color={COLORS.swiggyOrange} />
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                </View>
                <TouchableOpacity 
                  onPress={onClearRecentSearches}
                  style={styles.clearButtonContainer}
                >
                  <Text style={styles.clearButton}>Clear all</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={recentSearches}
                renderItem={renderRecentSearchItem}
                keyExtractor={(item, index) => `recent-${index}-${item}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <View style={styles.searchSection}>
              <View style={styles.sectionTitleContainer}>
                <Icon name="search-outline" size={20} color={COLORS.swiggyOrange} />
                <Text style={styles.sectionTitle}>Search History</Text>
              </View>
              <FlatList
                data={searchHistory.slice(0, 5)}
                renderItem={renderSearchHistoryItem}
                keyExtractor={(item, index) => `history-${item.id}-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Popular Searches */}
          <View style={styles.searchSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleContainer}>
                <Icon name="flame" size={20} color={COLORS.swiggyOrange} />
                <Text style={styles.sectionTitle}>Popular Searches</Text>
              </View>
            </View>
            <View style={styles.popularSearchesGrid}>
              {POPULAR_SEARCHES.map((item, index) => (
                <TouchableOpacity
                  key={`popular-${index}`}
                  style={styles.popularSearchItem}
                  onPress={() => handlePopularSearchPress(item)}
                  activeOpacity={0.7}
                >
                  <Icon name="search-outline" size={14} color={COLORS.swiggyOrange} />
                  <Text style={styles.popularSearchText} numberOfLines={1}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Empty State */}
          {recentSearches.length === 0 && searchHistory.length === 0 && (
            <View style={styles.emptySearchContainer}>
              <View style={styles.emptySearchIllustration}>
                <Icon name="search-outline" size={80} color={COLORS.lightGray} />
              </View>
              <Text style={styles.emptySearchTitle}>What are you craving?</Text>
              <Text style={styles.emptySearchSubtitle}>
                Search for your favorite foods, kitchens, or cuisines
              </Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (searchLoading) {
      return (
        <View style={styles.searchLoading}>
          <ActivityIndicator size="large" color={COLORS.swiggyOrange} />
          <Text style={styles.searchLoadingText}>Finding delicious options...</Text>
        </View>
      );
    }

    if (searchResults.length > 0) {
      const trendingResults = searchResults.filter(item => item.type === 'trending');
      const foodResults = searchResults.filter(item => item.type === 'food');
      const restaurantResults = searchResults.filter(item => item.type === 'restaurant');

      return (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.searchResultsContainer}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBegin}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Trending Results */}
          {trendingResults.length > 0 && (
            <View style={styles.searchResultSection}>
              <View style={styles.sectionTitleContainer}>
                <Icon name="trending-up" size={20} color={COLORS.swiggyOrange} />
                <Text style={styles.sectionTitle}>Trending Now</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trendingList}
              >
                {trendingResults.map((item, index) => renderTrendingCard(item, index))}
              </ScrollView>
            </View>
          )}

          {/* Food Results */}
          {foodResults.length > 0 && (
            <View style={styles.searchResultSection}>
              <View style={styles.sectionTitleContainer}>
                <Icon name="fast-food-outline" size={20} color={COLORS.swiggyOrange} />
                <Text style={styles.sectionTitle}>
                  Food Items ({foodResults.length})
                </Text>
              </View>
              <FlatList
                data={foodResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(item, index) => `food-${item.id}-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Restaurant Results */}
          {restaurantResults.length > 0 && (
            <View style={styles.searchResultSection}>
              <View style={styles.sectionTitleContainer}>
                <Icon name="restaurant-outline" size={20} color={COLORS.swiggyOrange} />
                <Text style={styles.sectionTitle}>
                  Kitchens ({restaurantResults.length})
                </Text>
              </View>
              <FlatList
                data={restaurantResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(item, index) => `restaurant-${item.id}-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      );
    }

    if (searchQuery.length >= 1 && !searchLoading) {
      return (
        <View style={styles.noResultsContainer}>
          <View style={styles.noResultsIllustration}>
            <Icon name="search-outline" size={60} color={COLORS.textLight} />
          </View>
          <Text style={styles.noResultsTitle}>No results found</Text>
          <Text style={styles.noResultsSubtitle}>
            Try searching for something else or check the spelling
          </Text>
          <TouchableOpacity 
            style={styles.suggestSearchButton}
            onPress={() => onSearchChange('')}
          >
            <Text style={styles.suggestSearchText}>Clear search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  if (!isComponentVisible) return null;

  return (
    <Modal
      isVisible={isVisible}
      animationInTiming={1}
      animationOutTiming={1}
      backdropOpacity={0.8}
      backdropColor={COLORS.modalBackground}
      onBackdropPress={handleClose}
      onBackButtonPress={handleClose}
      style={styles.modal}
      statusBarTranslucent={true}
      animationIn="slideInDown"
      animationOut="slideOutUp"
      coverScreen={true}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={isAndroid ? 'height' : 'padding'}
          enabled
        >
          <Animated.View 
            style={[
              styles.modalContainer,
              { 
                transform: [{ translateY: slideIn }],
                opacity: fadeAnim,
                height: modalHeight,
              }
            ]}
          >
            {/* Search Header - Swiggy Style */}
            <View style={styles.searchModalHeader}>
              {/* Back Button */}
              <TouchableOpacity 
                onPress={handleClose} 
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <Icon name="arrow-back" size={24} color={COLORS.textDark} />
              </TouchableOpacity>

              {/* Search Input Container */}
              <View style={styles.modalSearchInputContainer}>
                <Icon name="search" size={20} color={COLORS.swiggyOrange} style={styles.modalSearchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.modalSearchInput}
                  placeholder="Search for food, kitchens..."
                  placeholderTextColor={COLORS.textLight}
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  autoFocus={true}
                  returnKeyType="search"
                  onSubmitEditing={onSearchSubmit}
                  clearButtonMode="while-editing"
                />
              </View>
            </View>

            {/* Search Content */}
            <TouchableWithoutFeedback onPress={handleContentTouch}>
              <View style={styles.searchModalContent}>
                {renderSearchSections()}
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-start',
  },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.searchModalBg,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: COLORS.searchModalBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: isAndroid ? statusBarHeight + scale(12) : scale(12),
  },
  backButton: {
    padding: scale(8),
    marginRight: scale(8),
  },
  modalSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: scale(8),
    paddingHorizontal: scale(12),
    height: scale(44),
  },
  modalSearchIcon: {
    marginRight: scale(8),
  },
  modalSearchInput: {
    flex: 1,
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    paddingVertical: scale(8),
    paddingRight: scale(8),
    paddingLeft: 0,
  },
  searchModalContent: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: scale(20),
  },

  // Search Initial State
  searchInitialState: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchSection: {
    marginBottom: scale(24),
    paddingHorizontal: scale(16),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginLeft: scale(8),
  },
  clearButtonContainer: {
    padding: scale(4),
  },
  clearButton: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.swiggyOrange,
  },

  // Recent Searches
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    backgroundColor: COLORS.card,
    borderRadius: scale(8),
    marginBottom: scale(8),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentSearchIconContainer: {
    width: scale(24),
    alignItems: 'center',
  },
  recentSearchText: {
    flex: 1,
    fontSize: moderateScale(15),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(12),
  },
  recentSearchDelete: {
    padding: scale(4),
  },

  // Search History
  searchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchHistoryIconContainer: {
    width: scale(24),
    alignItems: 'center',
  },
  searchHistoryContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  searchHistoryName: {
    fontSize: moderateScale(15),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginBottom: scale(2),
  },
  searchHistoryType: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },

  // Popular Searches
  popularSearchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: scale(-4),
  },
  popularSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    margin: scale(4),
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  popularSearchText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(6),
  },

  // Empty State
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(80),
    flex: 1,
    paddingHorizontal: scale(16),
  },
  emptySearchIllustration: {
    marginBottom: scale(20),
  },
  emptySearchTitle: {
    fontSize: moderateScale(20),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginBottom: scale(8),
    textAlign: 'center',
  },
  emptySearchSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(20),
  },

  // Loading State
  searchLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(80),
    flex: 1,
  },
  searchLoadingText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.textMedium,
    marginTop: scale(12),
  },

  // Search Results
  searchResultsContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchResultSection: {
    marginBottom: scale(24),
    paddingHorizontal: scale(16),
  },
  trendingList: {
    paddingRight: scale(16),
  },

  // Trending Cards
  trendingCard: {
    width: scale(140),
    marginRight: scale(12),
    backgroundColor: COLORS.card,
    borderRadius: scale(12),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trendingImageContainer: {
    position: 'relative',
    height: scale(100),
  },
  trendingImage: {
    width: '100%',
    height: '100%',
  },
  trendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  trendingBadge: {
    position: 'absolute',
    top: scale(8),
    left: scale(8),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.trending,
    borderRadius: scale(12),
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
  },
  trendingBadgeText: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
    marginLeft: scale(4),
  },
  trendingContent: {
    padding: scale(12),
  },
  trendingName: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginBottom: scale(6),
    lineHeight: scale(18),
  },
  trendingRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingRatingText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(4),
  },

  // Search Result Items
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: scale(8),
    marginBottom: scale(8),
    paddingHorizontal: scale(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchResultImageContainer: {
    position: 'relative',
  },
  searchResultImage: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(8),
    marginRight: scale(12),
  },
  trendingBadgeSmall: {
    position: 'absolute',
    top: -4,
    right: 4,
    backgroundColor: COLORS.trending,
    borderRadius: scale(8),
    width: scale(16),
    height: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultContent: {
    flex: 1,
    marginRight: scale(8),
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(4),
  },
  searchResultName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    flex: 1,
    lineHeight: scale(20),
  },
  trendingIndicator: {
    marginLeft: scale(8),
  },
  searchResultCategory: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginBottom: scale(6),
  },
  searchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: scale(4),
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(12),
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  ratingText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(4),
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: scale(12),
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  metaText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.textMedium,
    marginLeft: scale(4),
  },
  foodTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: scale(8),
    paddingVertical: scale(2),
    borderRadius: scale(4),
    marginTop: scale(4),
  },
  foodTypeText: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
  },
  searchResultAction: {
    padding: scale(4),
  },

  // No Results
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(80),
    flex: 1,
    paddingHorizontal: scale(16),
  },
  noResultsIllustration: {
    marginBottom: scale(20),
  },
  noResultsTitle: {
    fontSize: moderateScale(18),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(8),
  },
  noResultsSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: scale(20),
    lineHeight: scale(20),
  },
  suggestSearchButton: {
    backgroundColor: COLORS.swiggyOrange,
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(8),
  },
  suggestSearchText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontFamily: FONTS.semiBold,
  },
  highlightedText: {
    backgroundColor: COLORS.searchHighlight,
    color: COLORS.textDark,
    fontWeight: 'bold',
  },
});

export default SearchModal;