import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  FlatList,
  Image,
  TextInput,
  StatusBar
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const FavoritesScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState([
    {
      id: '1',
      title: 'Butter Chicken',
      category: 'North Indian',
      rating: 4.9,
      reviews: 428,
      price: 299,
      image: 'https://images.unsplash.com/photo-1632818924360-68d4994cfdb2?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
      description: 'Creamy tomato-based curry with tender chicken pieces, a Punjabi specialty.',
      isFavorite: true,
      prepTime: '25 mins'
    },
    {
      id: '2',
      title: 'Masala Dosa',
      category: 'South Indian',
      rating: 4.8,
      reviews: 356,
      price: 149,
      image: 'https://images.unsplash.com/photo-1631898039775-8ce64d27f9d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
      description: 'Crispy rice crepe stuffed with spiced potatoes, served with sambar and chutney.',
      isFavorite: true,
      prepTime: '20 mins'
    },
    {
      id: '3',
      title: 'Pani Puri',
      category: 'Street Food',
      rating: 4.7,
      reviews: 512,
      price: 99,
      image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
      description: 'Hollow puris filled with spicy tamarind water, potatoes and chickpeas.',
      isFavorite: true,
      prepTime: '15 mins'
    },
    {
      id: '4',
      title: 'Biryani',
      category: 'Mughlai',
      rating: 4.9,
      reviews: 672,
      price: 349,
      image: 'https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
      description: 'Fragrant rice dish cooked with spices, meat and saffron, slow-cooked to perfection.',
      isFavorite: true,
      prepTime: '40 mins'
    },
  ]);

  const filteredFavorites = favorites.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFavorite = (id) => {
    setFavorites(prevFavorites => 
      prevFavorites
        .map(item => 
          item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
        )
        .filter(item => item.isFavorite)
    );
  };

  const handleItemPress = (item) => {
    navigation.navigate('HomeKitchenDetails', { foodItem: item });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image }} style={styles.cardImage} />
      <View style={styles.imageOverlay} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
          </View>
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
          >
            <Icon 
              name={item.isFavorite ? 'heart' : 'heart-outline'} 
              size={24} 
              color="#FF5E00" 
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.cardFooter}>
          <View style={styles.ratingContainer}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{item.rating}</Text>
            <Text style={styles.reviewsText}>({item.reviews})</Text>
            <Icon name="time-outline" size={14} color="#fff" style={styles.timeIcon} />
            <Text style={styles.prepTime}>{item.prepTime}</Text>
          </View>
          <Text style={styles.priceText}>₹{item.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favorites</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your favorite foods..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Icon name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {filteredFavorites.length > 0 ? (
        <FlatList
          data={filteredFavorites}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80' }}
            style={styles.emptyImage}
          />
          <Text style={styles.emptyText}>No favorites found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery.length > 0 
              ? "Try a different search term"
              : "Tap the heart icon on food items to add them here"}
          </Text>
          <TouchableOpacity 
            style={styles.browseButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.browseButtonText}>Explore Foods</Text>
            <Icon name="chevron-forward" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    fontFamily: 'sans-serif-medium',
  },
  headerRight: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 50,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  clearButton: {
    padding: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardCategory: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  favoriteButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 4,
    marginRight: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reviewsText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timeIcon: {
    marginLeft: 12,
    marginRight: 4,
  },
  prepTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  browseButton: {
    backgroundColor: '#FF5E00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  browseButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8,
  },
});

export default FavoritesScreen;