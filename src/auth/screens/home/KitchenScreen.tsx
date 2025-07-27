import React, { useRef } from 'react';
import {
  View, StyleSheet, SafeAreaView, Text, TextInput,
  FlatList, TouchableOpacity, Image, Animated, Dimensions, ScrollView
} from 'react-native';
import { SwiperFlatList } from 'react-native-swiper-flatlist';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

// Enhanced Color Palette
const COLORS = {
  primary: '#FF6D28',       // Vibrant orange
  secondary: '#FF9F45',     // Lighter orange
  accent: '#FAC213',        // Yellow accent
  background: '#FFFBF5',    // Light cream background
  card: '#FFFFFF',          // White cards
  textDark: '#2D2727',      // Dark text
  textMedium: '#5C5C5C',    // Medium text
  textLight: '#8D8D8D',     // Light text
  success: '#4ECDC4',       // Teal for offers
  danger: '#EF4444',        // Red for badges
  info: '#3B82F6',          // Blue for info
  lightGray: '#F3F4F6',     // Light gray
  border: '#E5E7EB',        // Border color
  rating: '#FFD700',        // Gold for ratings
};

interface Offer {
  id: string;
  text: string;
  color: string;
  icon: string;
}

interface Kitchen {
  id: string;
  name: string;
  rating: string;
  time: string;
  cuisine: string;
  image: string;
  offer: string;
  distance: string;
  deliveryFee: string;
  minOrder: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string; // For vector icons (e.g., 'pizza')
  image?: string; // For image URLs
}

interface Filter {
  id: string;
  name: string;
  icon: string;
}

const KitchenScreen: React.FC = () => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  // Enhanced Offers Data
  const offers: Offer[] = [
    { id: '1', text: '50% OFF\nFirst Order', color: COLORS.primary, icon: 'flash' },
    { id: '2', text: '₹100 Cashback', color: COLORS.success, icon: 'cash' },
    { id: '3', text: 'Free Delivery\nOver ₹299', color: COLORS.accent, icon: 'car' },
    { id: '4', text: 'Combo Deals', color: COLORS.info, icon: 'fast-food' },
  ];

  const featuredKitchens: Kitchen[] = [
    {
      id: '1',
      name: 'Grand Kitchen',
      rating: '4.5',
      time: '25 mins',
      cuisine: 'North Indian, Chinese',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      offer: '50% OFF up to ₹100',
      distance: '1.2 km',
      deliveryFee: '₹30',
      minOrder: '₹150'
    },
    {
      id: '2',
      name: 'Spice Valley',
      rating: '4.2',
      time: '30 mins',
      cuisine: 'South Indian, Biryani',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      offer: '40% OFF up to ₹80',
      distance: '1.5 km',
      deliveryFee: 'Free',
      minOrder: '₹200'
    },
    {
      id: '3',
      name: 'Burger King',
      rating: '4.3',
      time: '20 mins',
      cuisine: 'Burgers, Fast Food',
      image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      offer: 'Buy 1 Get 1 Free',
      distance: '0.8 km',
      deliveryFee: '₹25',
      minOrder: '₹99'
    }
  ];

  interface Category {
  id: string;
  name: string;
  icon: string; // URL or local asset path
}

const categories: Category[] = [
  {
    id: '1',
    name: 'Pizza',
    icon: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '2',
    name: 'Burger',
    icon: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '3',
    name: 'Sushi',
    icon: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '4',
    name: 'Pasta',
    icon: 'https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '5',
    name: 'Salad',
    icon: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '6',
    name: 'Dessert',
    icon: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '7',
    name: 'Indian',
    icon: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
  {
    id: '8',
    name: 'Chinese',
    icon: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
  },
];

  const filters: Filter[] = [
    { id: '1', name: 'Rating: 4.0+', icon: 'star' },
    { id: '2', name: 'Pure Veg', icon: 'leaf' },
    { id: '3', name: 'Offers', icon: 'pricetag' },
    { id: '4', name: 'Fast Delivery', icon: 'rocket' },
  ];

  const kitchens: Kitchen[] = [
    {
      id: '1',
      name: 'Grand Kitchen',
      rating: '4.5',
      time: '25 mins',
      cuisine: 'North Indian, Chinese',
      image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      offer: '50% OFF up to ₹100',
      distance: '1.2 km',
      deliveryFee: '₹30',
      minOrder: '₹150'
    },
    {
      id: '2',
      name: 'Spice Valley',
      rating: '4.2',
      time: '30 mins',
      cuisine: 'South Indian, Biryani',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      offer: '40% OFF up to ₹80',
      distance: '1.5 km',
      deliveryFee: 'Free',
      minOrder: '₹200'
    },
    {
      id: '3',
      name: 'Burger King',
      rating: '4.3',
      time: '20 mins',
      cuisine: 'Burgers, Fast Food',
      image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60',
      offer: 'Buy 1 Get 1 Free',
      distance: '0.8 km',
      deliveryFee: '₹25',
      minOrder: '₹99'
    }
  ];

  const handleKitchenPress = (kitchen: Kitchen) => {
    navigation.navigate('HomeKitchenDetails', { kitchenId: kitchen.id });
  };

  const renderOffer = ({ item }: { item: Offer }) => (
    <View style={[styles.offerCard, { backgroundColor: item.color }]}>
      <View style={styles.offerIconContainer}>
        <Icon name={item.icon} size={24} color="#fff" />
      </View>
      <Text style={styles.offerText}>{item.text}</Text>
      <View style={styles.offerDecoration} />
    </View>
  );

const renderCategory = ({ item }: { item: Category }) => {
  
  return (
    <TouchableOpacity style={styles.categoryCard}>
      <View style={[styles.categoryIconContainer]}>
        <View style={[styles.categoryIconCircle]}>
          <Image 
            source={{ uri: item.icon }} 
            style={styles.categoryImage} 
            resizeMode="cover"
          />
        </View>
      </View>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );
};

  const renderFilter = ({ item }: { item: Filter }) => (
    <TouchableOpacity style={styles.filterCard}>
      <Icon name={item.icon} size={16} color={COLORS.primary} />
      <Text style={styles.filterText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icon name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search kitchens, cuisines"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories Section */}
        <View style={styles.sectionContainer}>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          />
        </View>

        {/* Offers Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Special Offers</Text>
          </View>
          <FlatList
            data={offers}
            renderItem={renderOffer}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.offerList}
          />
        </View>

        {/* Featured Kitchens */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Kitchens</Text>
          </View>
          <SwiperFlatList
            autoplay
            autoplayDelay={4}
            autoplayLoop
            showPagination={false}
            data={featuredKitchens}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.featuredCard}
                onPress={() => handleKitchenPress(item)}
              >
                <Image source={{ uri: item.image }} style={styles.featuredImage} />
                <View style={styles.featuredOverlay} />
                <View style={styles.featuredContent}>
                  <Text style={styles.featuredName}>{item.name}</Text>
                  <View style={styles.featuredRating}>
                    <Icon name="star" size={16} color={COLORS.rating} />
                    <Text style={styles.featuredRatingText}>{item.rating}</Text>
                  </View>
                  <Text style={styles.featuredInfo}>{item.cuisine}</Text>
                  <View style={styles.featuredOfferBadge}>
                    <Text style={styles.featuredOfferText}>{item.offer}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            style={styles.swiper}
          />
        </View>

        {/* Filters */}
        <View style={styles.sectionContainer}>
          <FlatList
            data={filters}
            renderItem={renderFilter}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          />
        </View>

        {/* Kitchens Near You */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Kitchens</Text>
          </View>
          <View style={styles.kitchenList}>
            {kitchens.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.kitchenCard}
                onPress={() => handleKitchenPress(item)}
              >
                <View style={styles.kitchenImageContainer}>
                  <Image source={{ uri: item.image }} style={styles.kitchenImage} />
                  <View style={styles.kitchenBadge}>
                    <Text style={styles.kitchenBadgeText}>{item.offer}</Text>
                  </View>
                </View>
                <View style={styles.kitchenContent}>
                  <View style={styles.kitchenHeader}>
                    <Text style={styles.kitchenName}>{item.name}</Text>
                    <View style={styles.ratingContainer}>
                      <Icon name="star" size={14} color={COLORS.rating} />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                  </View>
                  <Text style={styles.kitchenCuisine}>{item.cuisine}</Text>
                  
                  <View style={styles.kitchenDetails}>
                    <View style={styles.detailItem}>
                      <Icon name="time" size={14} color={COLORS.textLight} />
                      <Text style={styles.detailText}>{item.time}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Icon name="location" size={14} color={COLORS.textLight} />
                      <Text style={styles.detailText}>{item.distance}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Icon name="bicycle" size={14} color={COLORS.textLight} />
                      <Text style={styles.detailText}>{item.deliveryFee}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.kitchenFooter}>
                    <Text style={styles.minOrder}>Min. order: {item.minOrder}</Text>
                    <TouchableOpacity style={styles.favoriteButton}>
                      <Icon name="heart-outline" size={20} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  
  // Header Styles
  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25, // Adjust as needed
  },
  categoryIconCircle: {
    width: 50, // Ensure this matches your design
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', // Ensures the image respects border radius
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.card,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 48,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textDark,
    paddingVertical: 12,
    fontFamily: 'Inter-Medium',
    letterSpacing: 0.2
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Section Styles
  sectionContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
    fontFamily: 'Inter-Bold',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: 'Inter-SemiBold',
  },
  
  // Category Styles
  categoryList: {
    paddingRight: 16,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
    marginRight: 16,
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textDark,
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
    marginTop: 4,
  },
  
  // Offer Styles
  offerList: {
    paddingRight: 16,
  },
  offerCard: {
    width: 160,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  offerIconContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    lineHeight: 18,
  },
  offerDecoration: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Featured Kitchen Styles
  swiper: {
    height: 220,
    borderRadius: 16,
  },
  featuredCard: {
    width: width - 48,
    height: 200,
    borderRadius: 16,
    marginHorizontal: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  featuredName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    fontFamily: 'Inter-Bold',
  },
  featuredRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featuredRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
    fontFamily: 'Inter-SemiBold',
  },
  featuredInfo: {
    fontSize: 14,
    color: '#E5E7EB',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  featuredOfferBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featuredOfferText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    fontFamily: 'Inter-Bold',
  },
  
  // Filter Styles
  filterList: {
    paddingRight: 16,
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
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textDark,
    marginLeft: 6,
    fontFamily: 'Inter-Medium',
  },
  
  // Kitchen Card Styles
  kitchenList: {
    paddingRight: 16,
  },
  kitchenCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  kitchenImageContainer: {
    height: 180,
    position: 'relative',
  },
  kitchenImage: {
    width: '100%',
    height: '100%',
  },
  kitchenBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: COLORS.danger,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  kitchenBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Inter-Bold',
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    fontFamily: 'Inter-Bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
    fontFamily: 'Inter-Bold',
  },
  kitchenCuisine: {
    fontSize: 14,
    color: COLORS.textMedium,
    marginBottom: 12,
    fontFamily: 'Inter-Regular',
  },
  kitchenDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
    fontFamily: 'Inter-Regular',
  },
  kitchenFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  minOrder: {
    fontSize: 13,
    color: COLORS.textLight,
    fontFamily: 'Inter-Regular',
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default KitchenScreen;