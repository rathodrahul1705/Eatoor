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

// Enhanced Modern Color Palette
const COLORS = {
  primary: '#FF6B35',
  primaryLight: '#FF8E53',
  primaryDark: '#E55A2B',
  secondary: '#6C63FF',
  background: '#FAFBFF',
  card: '#FFFFFF',
  textDark: '#1A1D29',
  textMedium: '#5A5D70',
  textLight: '#8F92A1',
  success: '#00C896',
  danger: '#FF4757',
  warning: '#FF9F43',
  info: '#2E86DE',
  lightGray: '#F8F9FC',
  border: '#EFF2F6',
  rating: '#FFD166',
  darkOverlay: 'rgba(26,29,41,0.85)',
  lightOverlay: 'rgba(255,255,255,0.6)',
  recentSearchBg: '#F8F9FC',
  recentSearchText: '#5A5D70',
  veg: '#00C896',
  nonVeg: '#FF4757',
  searchHighlight: 'rgba(255,107,53,0.15)',
  modalBackground: 'rgba(26,29,41,0.85)',
  searchModalBg: '#FFFFFF',
  trending: '#6C63FF',
  gradientStart: '#FF6B35',
  gradientEnd: '#6C63FF',
  accent: '#6C63FF',
  shimmer: '#F0F0F0',
  premium: '#FFD700',
  new: '#4CD964',
  discount: '#FF3B30',
  category1: '#FF6B6B',
  category2: '#4ECDC4',
  category3: '#45B7D1',
  category4: '#96CEB4',
  category5: '#FFEAA7',
  timeBadge: 'rgba(143, 146, 161, 0.1)',
  priceBadge: 'rgba(255, 107, 53, 0.1)',
};

const FONTS = {
  bold: isAndroid ? 'sans-serif-medium' : 'Inter-Bold',
  semiBold: isAndroid ? 'sans-serif-medium' : 'Inter-SemiBold',
  medium: isAndroid ? 'sans-serif' : 'Inter-Medium',
  regular: isAndroid ? 'sans-serif' : 'Inter-Regular',
  light: isAndroid ? 'sans-serif-light' : 'Inter-Light',
};

const scale = (size: number) => (width / 375) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;

// Enhanced popular searches with better categories
const POPULAR_SEARCHES = [
  { id: '1', name: "Biryani", category: "Indian", emoji: "🍛", color: COLORS.category1 },
  { id: '2', name: "Pizza", category: "Italian", emoji: "🍕", color: COLORS.category2 },
  { id: '3', name: "Burger", category: "Fast Food", emoji: "🍔", color: COLORS.category3 },
  { id: '4', name: "Sushi", category: "Japanese", emoji: "🍣", color: COLORS.category4 },
  { id: '5', name: "Tacos", category: "Mexican", emoji: "🌮", color: COLORS.category5 },
  { id: '6', name: "Pasta", category: "Italian", emoji: "🍝", color: COLORS.category1 },
  { id: '7', name: "Salad", category: "Healthy", emoji: "🥗", color: COLORS.category2 },
  { id: '8', name: "Ice Cream", category: "Dessert", emoji: "🍦", color: COLORS.category3 },
  { id: '9', name: "Coffee", category: "Beverage", emoji: "☕", color: COLORS.category4 },
  { id: '10', name: "Smoothie", category: "Healthy", emoji: "🥤", color: COLORS.category5 },
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
  emoji?: string;
  isNew?: boolean;
  discount?: string;
  premium?: boolean;
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
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [isComponentVisible, setIsComponentVisible] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Enhanced animation control
  const animateIn = () => {
    setIsComponentVisible(true);
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 250);
    });
  };

  const animateOut = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsComponentVisible(false);
    });
  };

  // Debounce search query for smoother performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Enhanced keyboard handling
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

  // Enhanced modal visibility handling
  useEffect(() => {
    if (isVisible) {
      animateIn();
    } else {
      animateOut();
    }
  }, [isVisible]);

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleClose = () => {
    onClose();
  };

  const handleBackdropPress = () => {
    handleClose();
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
    }, 150);
  };

  const handlePopularSearchPress = (item: any) => {
    onPopularSearchPress(item.name);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <Text key={index} style={styles.searchModalHighlightedText}>
          {part}
        </Text>
      ) : (
        part
      )
    );
  };

  // Enhanced Image Component with Fallback
  const EnhancedImage = ({ source, style, defaultSource, children }: any) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    return (
      <View style={[style, styles.searchModalImageContainer]}>
        {!imageError ? (
          <>
            <Image
              source={source}
              style={[style, { position: 'absolute' }]}
              resizeMode="cover"
              onLoadEnd={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
              defaultSource={defaultSource}
            />
            {imageLoading && (
              <View style={[style, styles.searchModalImagePlaceholder]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            )}
          </>
        ) : (
          <View style={[style, styles.searchModalImageFallback]}>
            <Icon name="fast-food-outline" size={24} color={COLORS.textLight} />
          </View>
        )}
        {children}
      </View>
    );
  };

  const renderRecentSearchItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      style={styles.searchModalRecentSearchItem}
      onPress={() => handleRecentSearchPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.searchModalRecentSearchIconContainer}>
        <Icon name="time-outline" size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.searchModalRecentSearchText} numberOfLines={1}>
        {highlightText(item, searchQuery)}
      </Text>
      <TouchableOpacity 
        style={styles.searchModalRecentSearchDelete}
        onPress={(e) => {
          e.stopPropagation();
          onRemoveRecentSearch(item);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="close-circle" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSearchHistoryItem = ({ item, index }: { item: SearchItem; index: number }) => (
    <TouchableOpacity
      style={styles.searchModalSearchHistoryItem}
      onPress={() => handleSearchResultPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.searchModalSearchHistoryIconContainer}>
        <Icon name="search-outline" size={18} color={COLORS.primary} />
      </View>
      <View style={styles.searchModalSearchHistoryContent}>
        <Text style={styles.searchModalSearchHistoryName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.searchModalSearchHistoryType} numberOfLines={1}>
          {item.type === 'restaurant' ? 'Restaurant' : 'Food Item'} • 
          {item.searchedAt && moment(item.searchedAt).fromNow()}
        </Text>
      </View>
      <Icon name="chevron-forward" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  const renderSearchResultItem = ({ item, index }: { item: SearchItem; index: number }) => (
    <TouchableOpacity
      style={styles.searchModalSearchResultItem}
      onPress={() => handleSearchResultPress(item)}
      activeOpacity={0.9}
    >
      <View style={styles.searchModalSearchResultImageContainer}>
        <EnhancedImage 
          source={{ uri: item.image }} 
          style={styles.searchModalSearchResultImage}
          defaultSource={{ uri: 'https://via.placeholder.com/60' }}
        >
          {item.premium && (
            <View style={styles.searchModalPremiumBadge}>
              <Icon name="diamond" size={8} color="#FFFFFF" />
            </View>
          )}
          
          {item.isNew && (
            <View style={styles.searchModalNewBadge}>
              <Text style={styles.searchModalNewBadgeText}>NEW</Text>
            </View>
          )}
          
          {item.discount && (
            <View style={styles.searchModalDiscountBadge}>
              <Text style={styles.searchModalDiscountBadgeText}>{item.discount}</Text>
            </View>
          )}
        </EnhancedImage>
      </View>
      
      <View style={styles.searchModalSearchResultContent}>
        <Text style={styles.searchModalSearchResultName} numberOfLines={2}>
          {highlightText(item.name, searchQuery)}
        </Text>
        
        <View style={styles.searchModalSearchResultMeta}>
          {item.price && (
            <View style={styles.searchModalPriceBadge}>
              <Text style={styles.searchModalPriceText}>{item.price}</Text>
            </View>
          )}
          
          {item.deliveryTime && (
            <View style={styles.searchModalTimeBadge}>
              <Icon name="time-outline" size={10} color={COLORS.textMedium} />
              <Text style={styles.searchModalTimeText}>{item.deliveryTime}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.searchModalSearchResultAction}>
        <View style={styles.searchModalActionButton}>
          <Icon name="chevron-forward" size={16} color={COLORS.textLight} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTrendingCard = (item: SearchItem, index: number) => (
    <TouchableOpacity
      key={`trending-${item.id}-${index}`}
      style={styles.searchModalTrendingCard}
      onPress={() => handleSearchResultPress(item)}
      activeOpacity={0.9}
    >
      <View style={styles.searchModalTrendingImageContainer}>
        <EnhancedImage 
          source={{ uri: item.image }} 
          style={styles.searchModalTrendingImage}
          defaultSource={{ uri: 'https://via.placeholder.com/160x120' }}
        >
          <View style={styles.searchModalTrendingGradient} />
          <View style={styles.searchModalTrendingBadge}>
            <Icon name="trending-up" size={12} color="#fff" />
            <Text style={styles.searchModalTrendingBadgeText}>Trending</Text>
          </View>
          <View style={styles.searchModalTrendingEmoji}>
            <Text style={styles.searchModalTrendingEmojiText}>{item.emoji || '🔥'}</Text>
          </View>
        </EnhancedImage>
      </View>
      <View style={styles.searchModalTrendingContent}>
        <Text style={styles.searchModalTrendingName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.rating && (
          <View style={styles.searchModalTrendingRating}>
            <Icon name="star" size={12} color="#FFFFFF" />
            <Text style={styles.searchModalTrendingRatingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Enhanced Popular Searches Grid
  const PopularSearchesGrid = () => (
    <View style={styles.searchModalPopularSearchesGrid}>
      {POPULAR_SEARCHES.map((item) => (
        <TouchableOpacity
          key={`popular-${item.id}`}
          style={[styles.searchModalPopularSearchCard, { borderLeftColor: item.color }]}
          onPress={() => handlePopularSearchPress(item)}
          activeOpacity={0.8}
        >
          <View style={styles.searchModalPopularSearchContent}>
            <View style={styles.searchModalPopularSearchHeader}>
              <Text style={styles.searchModalPopularSearchEmoji}>{item.emoji}</Text>
              <View style={[styles.searchModalPopularSearchIndicator, { backgroundColor: item.color }]} />
            </View>
            <Text style={styles.searchModalPopularSearchName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.searchModalPopularSearchCategory} numberOfLines={1}>
              {item.category}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSearchSections = () => {
    if (debouncedQuery.length === 0) {
      return (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.searchModalSearchInitialState}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBegin}
          scrollEventThrottle={16}
          contentContainerStyle={styles.searchModalScrollViewContent}
        >
          {recentSearches.length > 0 && (
            <View style={styles.searchModalSearchSection}>
              <View style={styles.searchModalSectionHeaderRow}>
                <View style={styles.searchModalSectionTitleContainer}>
                  <Icon name="time-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.searchModalSectionTitle}>Recent Searches</Text>
                </View>
                <TouchableOpacity 
                  onPress={onClearRecentSearches}
                  style={styles.searchModalClearButtonContainer}
                >
                  <Text style={styles.searchModalClearButton}>Clear all</Text>
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

          {searchHistory.length > 0 && (
            <View style={styles.searchModalSearchSection}>
              <View style={styles.searchModalSectionTitleContainer}>
                <Icon name="search-outline" size={22} color={COLORS.primary} />
                <Text style={styles.searchModalSectionTitle}>Search History</Text>
              </View>
              <FlatList
                data={searchHistory.slice(0, 5)}
                renderItem={renderSearchHistoryItem}
                keyExtractor={(item, index) => `history-${item.id}-${index}`}
                scrollEnabled={false}
              />
            </View>
          )}

          <View style={styles.searchModalSearchSection}>
            <View style={styles.searchModalSectionHeaderRow}>
              <View style={styles.searchModalSectionTitleContainer}>
                <Icon name="flame" size={22} color={COLORS.primary} />
                <Text style={styles.searchModalSectionTitle}>Popular Categories</Text>
              </View>
            </View>
            <PopularSearchesGrid />
          </View>

          {recentSearches.length === 0 && searchHistory.length === 0 && (
            <View style={styles.searchModalEmptySearchContainer}>
              <View style={styles.searchModalEmptySearchIllustration}>
                <View style={styles.searchModalEmptySearchIcon}>
                  <Icon name="search-outline" size={64} color={COLORS.lightGray} />
                </View>
              </View>
              <Text style={styles.searchModalEmptySearchTitle}>Discover Amazing Food</Text>
              <Text style={styles.searchModalEmptySearchSubtitle}>
                Search for your favorite restaurants, cuisines, or dishes to get started
              </Text>
            </View>
          )}
        </ScrollView>
      );
    }

    if (searchLoading) {
      return (
        <View style={styles.searchModalSearchLoading}>
          <View style={styles.searchModalLoadingAnimation}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.searchModalSearchLoadingText}>Finding delicious options...</Text>
          </View>
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
          style={styles.searchModalSearchResultsContainer}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBegin}
          scrollEventThrottle={16}
          contentContainerStyle={styles.searchModalScrollViewContent}
        >
          {trendingResults.length > 0 && (
            <View style={styles.searchModalSearchResultSection}>
              <View style={styles.searchModalSectionTitleContainer}>
                <Icon name="trending-up" size={22} color={COLORS.primary} />
                <Text style={styles.searchModalSectionTitle}>Trending Now</Text>
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.searchModalTrendingList}
              >
                {trendingResults.map((item, index) => renderTrendingCard(item, index))}
              </ScrollView>
            </View>
          )}

          {foodResults.length > 0 && (
            <View style={styles.searchModalSearchResultSection}>
              <View style={styles.searchModalSectionTitleContainer}>
                <Icon name="fast-food-outline" size={22} color={COLORS.primary} />
                <Text style={styles.searchModalSectionTitle}>
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

          {restaurantResults.length > 0 && (
            <View style={styles.searchModalSearchResultSection}>
              <View style={styles.searchModalSectionTitleContainer}>
                <Icon name="restaurant-outline" size={22} color={COLORS.primary} />
                <Text style={styles.searchModalSectionTitle}>
                  Restaurants ({restaurantResults.length})
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

    if (debouncedQuery.length >= 1 && !searchLoading) {
      return (
        <View style={styles.searchModalNoResultsContainer}>
          <View style={styles.searchModalNoResultsIllustration}>
            <View style={styles.searchModalNoResultsIcon}>
              <Icon name="search-outline" size={48} color={COLORS.textLight} />
            </View>
            <View style={styles.searchModalNoResultsPulse} />
          </View>
          <Text style={styles.searchModalNoResultsTitle}>No results found</Text>
          <Text style={styles.searchModalNoResultsSubtitle}>
            We couldn't find any matches for "{debouncedQuery}"
          </Text>
          <TouchableOpacity 
            style={styles.searchModalSuggestSearchButton}
            onPress={() => onSearchChange('')}
          >
            <Text style={styles.searchModalSuggestSearchText}>Try another search</Text>
          </TouchableOpacity>
          
          <View style={styles.searchModalSuggestedSearches}>
            <Text style={styles.searchModalSuggestedTitle}>Try searching for:</Text>
            <View style={styles.searchModalSuggestedTags}>
              {POPULAR_SEARCHES.slice(0, 4).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.searchModalSuggestedTag}
                  onPress={() => handlePopularSearchPress(item)}
                >
                  <Text style={styles.searchModalSuggestedTagText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  if (!isComponentVisible) return null;

  return (
    <Modal
      isVisible={isVisible}
      animationInTiming={300}
      animationOutTiming={300}
      backdropOpacity={1}
      backdropColor={COLORS.modalBackground}
      onBackdropPress={handleBackdropPress}
      onBackButtonPress={handleClose}
      style={styles.searchModalModal}
      statusBarTranslucent={true}
      useNativeDriver={true}
      hideModalContentWhileAnimating={true}
      avoidKeyboard={true}
    >
      <SafeAreaView style={styles.searchModalSafeArea}>
        <KeyboardAvoidingView 
          style={styles.searchModalKeyboardAvoidingView}
          behavior={isAndroid ? 'height' : 'padding'}
          enabled
        >
          <Animated.View 
            style={[
              styles.searchModalModalContainer,
              { 
                transform: [
                  { translateY: slideAnim }
                ],
                opacity: fadeAnim,
              }
            ]}
          >
            <View style={styles.searchModalSearchModalHeader}>
              <TouchableOpacity 
                onPress={handleClose} 
                style={styles.searchModalBackButton}
                activeOpacity={0.8}
              >
                <View style={styles.searchModalBackButtonCircle}>
                  <Icon name="chevron-down" size={24} color={COLORS.textDark} />
                </View>
              </TouchableOpacity>

              <View style={styles.searchModalModalSearchInputContainer}>
                <Icon name="search" size={20} color={COLORS.primary} style={styles.searchModalModalSearchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchModalModalSearchInput}
                  placeholder="Search for food, restaurants..."
                  placeholderTextColor={COLORS.textLight}
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  autoFocus={true}
                  returnKeyType="search"
                  onSubmitEditing={onSearchSubmit}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => onSearchChange('')}
                    style={styles.searchModalClearSearchButton}
                  >
                    <Icon name="close-circle" size={20} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableWithoutFeedback onPress={handleContentTouch}>
              <View style={styles.searchModalSearchModalContent}>
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
  searchModalModal: {
    margin: 0,
    justifyContent: 'flex-start',
  },
  searchModalSafeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  searchModalKeyboardAvoidingView: {
    flex: 1,
  },
  searchModalModalContainer: {
    flex: 1,
    backgroundColor: COLORS.searchModalBg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  searchModalSearchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(16),
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingTop: isAndroid ? statusBarHeight + scale(16) : scale(16),
  },
  searchModalBackButton: {
    marginRight: scale(12),
  },
  searchModalBackButtonCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchModalModalSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: scale(16),
    paddingHorizontal: scale(16),
    height: scale(52),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchModalModalSearchIcon: {
    marginRight: scale(12),
  },
  searchModalModalSearchInput: {
    flex: 1,
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    paddingVertical: scale(12),
    paddingRight: scale(8),
    paddingLeft: 0,
  },
  searchModalClearSearchButton: {
    padding: scale(4),
  },
  searchModalSearchModalContent: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchModalScrollViewContent: {
    flexGrow: 1,
    paddingBottom: scale(30),
  },

  // Search Initial State
  searchModalSearchInitialState: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchModalSearchSection: {
    marginBottom: scale(32),
    paddingHorizontal: scale(20),
  },
  searchModalSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  searchModalSectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchModalSectionTitle: {
    fontSize: moderateScale(20),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginLeft: scale(12),
    letterSpacing: -0.5,
  },
  searchModalClearButtonContainer: {
    padding: scale(8),
    borderRadius: scale(8),
  },
  searchModalClearButton: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },

  // Recent Searches
  searchModalRecentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(14),
    marginBottom: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchModalRecentSearchIconContainer: {
    width: scale(24),
    alignItems: 'center',
  },
  searchModalRecentSearchText: {
    flex: 1,
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginLeft: scale(12),
  },
  searchModalRecentSearchDelete: {
    padding: scale(4),
  },

  // Search History
  searchModalSearchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchModalSearchHistoryIconContainer: {
    width: scale(24),
    alignItems: 'center',
  },
  searchModalSearchHistoryContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  searchModalSearchHistoryName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
    marginBottom: scale(4),
  },
  searchModalSearchHistoryType: {
    fontSize: moderateScale(13),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },

  // Enhanced Popular Searches Grid
  searchModalPopularSearchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -scale(4),
  },
  searchModalPopularSearchCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    marginBottom: scale(12),
    padding: scale(16),
    borderLeftWidth: scale(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchModalPopularSearchContent: {
    flex: 1,
  },
  searchModalPopularSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(12),
  },
  searchModalPopularSearchEmoji: {
    fontSize: moderateScale(24),
  },
  searchModalPopularSearchIndicator: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginTop: scale(8),
  },
  searchModalPopularSearchName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(4),
  },
  searchModalPopularSearchCategory: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
  },

  // Empty State
  searchModalEmptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(100),
    flex: 1,
    paddingHorizontal: scale(20),
  },
  searchModalEmptySearchIllustration: {
    marginBottom: scale(24),
  },
  searchModalEmptySearchIcon: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(60),
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchModalEmptySearchTitle: {
    fontSize: moderateScale(24),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginBottom: scale(12),
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  searchModalEmptySearchSubtitle: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: scale(24),
    marginBottom: scale(32),
    paddingHorizontal: scale(20),
  },

  // Loading State
  searchModalSearchLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(100),
    flex: 1,
  },
  searchModalLoadingAnimation: {
    alignItems: 'center',
  },
  searchModalSearchLoadingText: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textMedium,
    marginTop: scale(16),
  },

  // Enhanced Image Components
  searchModalImageContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  searchModalImagePlaceholder: {
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalImageFallback: {
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: scale(12),
  },

  // Search Results
  searchModalSearchResultsContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchModalSearchResultSection: {
    marginBottom: scale(24),
    paddingHorizontal: scale(20),
  },
  searchModalTrendingList: {
    paddingRight: scale(20),
  },

  // Enhanced Trending Cards
  searchModalTrendingCard: {
    width: scale(160),
    marginRight: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  searchModalTrendingImageContainer: {
    position: 'relative',
    height: scale(120),
  },
  searchModalTrendingImage: {
    width: '100%',
    height: '100%',
  },
  searchModalTrendingGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  searchModalTrendingBadge: {
    position: 'absolute',
    top: scale(12),
    left: scale(12),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.trending,
    borderRadius: scale(12),
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
  },
  searchModalTrendingBadgeText: {
    fontSize: moderateScale(10),
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
    marginLeft: scale(4),
  },
  searchModalTrendingEmoji: {
    position: 'absolute',
    bottom: scale(12),
    right: scale(12),
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: scale(8),
    padding: scale(4),
  },
  searchModalTrendingEmojiText: {
    fontSize: moderateScale(14),
  },
  searchModalTrendingContent: {
    padding: scale(16),
  },
  searchModalTrendingName: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(8),
    lineHeight: scale(20),
  },
  searchModalTrendingRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
  },
  searchModalTrendingRatingText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.semiBold,
    color: '#FFFFFF',
    marginLeft: scale(4),
  },

  // Enhanced Search Result Items
  searchModalSearchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    paddingHorizontal: scale(16),
    backgroundColor: COLORS.card,
    borderRadius: scale(16),
    marginBottom: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    minHeight: scale(80),
  },
  searchModalSearchResultImageContainer: {
    position: 'relative',
    marginRight: scale(12),
  },
  searchModalSearchResultImage: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(12),
  },
  // Enhanced Badges
  searchModalPremiumBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: COLORS.premium,
    borderRadius: scale(8),
    width: scale(16),
    height: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  searchModalNewBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: COLORS.new,
    borderRadius: scale(8),
    paddingHorizontal: scale(4),
    paddingVertical: scale(1),
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalNewBadgeText: {
    fontSize: moderateScale(7),
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  searchModalDiscountBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    backgroundColor: COLORS.discount,
    borderRadius: scale(6),
    paddingHorizontal: scale(4),
    paddingVertical: scale(1),
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchModalDiscountBadgeText: {
    fontSize: moderateScale(7),
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  searchModalSearchResultContent: {
    flex: 1,
    marginRight: scale(8),
  },
  searchModalSearchResultName: {
    fontSize: moderateScale(15),
    fontFamily: FONTS.semiBold,
    color: COLORS.textDark,
    marginBottom: scale(6),
    lineHeight: scale(18),
  },
  searchModalSearchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchModalPriceBadge: {
    backgroundColor: COLORS.priceBadge,
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    marginRight: scale(8),
  },
  searchModalPriceText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  searchModalTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.timeBadge,
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
  },
  searchModalTimeText: {
    fontSize: moderateScale(12),
    fontFamily: FONTS.medium,
    color: COLORS.textMedium,
    marginLeft: scale(4),
  },
  searchModalSearchResultAction: {
    padding: scale(2),
  },
  searchModalActionButton: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Enhanced No Results
  searchModalNoResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(80),
    flex: 1,
    paddingHorizontal: scale(20),
  },
  searchModalNoResultsIllustration: {
    marginBottom: scale(24),
    position: 'relative',
  },
  searchModalNoResultsIcon: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchModalNoResultsPulse: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: scale(60),
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    opacity: 0.6,
  },
  searchModalNoResultsTitle: {
    fontSize: moderateScale(22),
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
    marginBottom: scale(12),
    textAlign: 'center',
  },
  searchModalNoResultsSubtitle: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: scale(32),
    lineHeight: scale(24),
    paddingHorizontal: scale(20),
  },
  searchModalSuggestSearchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: scale(32),
    paddingVertical: scale(16),
    borderRadius: scale(12),
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: scale(32),
  },
  searchModalSuggestSearchText: {
    color: '#FFFFFF',
    fontSize: moderateScale(16),
    fontFamily: FONTS.semiBold,
  },
  searchModalSuggestedSearches: {
    alignItems: 'center',
  },
  searchModalSuggestedTitle: {
    fontSize: moderateScale(16),
    fontFamily: FONTS.medium,
    color: COLORS.textMedium,
    marginBottom: scale(16),
  },
  searchModalSuggestedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  searchModalSuggestedTag: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    margin: scale(4),
  },
  searchModalSuggestedTagText: {
    fontSize: moderateScale(14),
    fontFamily: FONTS.medium,
    color: COLORS.textDark,
  },
  searchModalHighlightedText: {
    backgroundColor: COLORS.searchHighlight,
    color: COLORS.primaryDark,
    fontFamily: FONTS.semiBold,
    borderRadius: scale(4),
    overflow: 'hidden',
    paddingHorizontal: scale(2),
  },
});

export default SearchModal;