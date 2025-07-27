import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const RateOrderScreen = ({ navigation }) => {
  const order = {
    id: 'ORD789456',
    kitchenName: "Curry Palace",
    orderDate: "Delivered on June 20, 2023",
    deliveryTime: "38 minutes",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
    items: [
      { name: "Chicken Biryani", quantity: 1, price: "₹220" },
      { name: "Paneer Butter Masala", quantity: 1, price: "₹180" },
      { name: "Tandoori Roti", quantity: 4, price: "₹20" },
      { name: "Sweet Lassi", quantity: 2, price: "₹50" }
    ],
    total: "₹530"
  };

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [feedback, setFeedback] = useState('');
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const positiveTags = [
    { id: 1, text: "Excellent Taste", emoji: "😋" },
    { id: 2, text: "Quick Delivery", emoji: "⚡" },
    { id: 3, text: "Good Packaging", emoji: "🎁" },
    { id: 4, text: "Value for Money", emoji: "💰" },
    { id: 9, text: "Friendly Staff", emoji: "👨‍🍳" },
    { id: 10, text: "Fresh Ingredients", emoji: "🥬" }
  ];

  const negativeTags = [
    { id: 5, text: "Missing Items", emoji: "👎" },
    { id: 6, text: "Slow Service", emoji: "🐌" },
    { id: 7, text: "Too Spicy", emoji: "🌶️" },
    { id: 8, text: "Food Was Cold", emoji: "🧊" },
    { id: 11, text: "Poor Quality", emoji: "❌" },
    { id: 12, text: "Wrong Order", emoji: "🔄" }
  ];

  const handleRating = (stars) => {
    setRating(stars);
    setSelectedTags([]);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.spring(scaleAnim, {
        toValue: 0,
        friction: 3,
        useNativeDriver: true
      })
    ]).start();
  };

  const toggleTag = (tag) => {
    if (selectedTags.some(t => t.id === tag.id)) {
      setSelectedTags(selectedTags.filter(t => t.id !== tag.id));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = () => {
    const submissionData = {
      orderId: order.id,
      rating,
      tags: selectedTags.map(tag => tag.text),
      feedback,
      timestamp: new Date().toISOString()
    };
    
    console.log('Rating submitted:', submissionData);
    navigation.navigate('RateOrderThankYou', { 
      rating,
      kitchenName: order.kitchenName 
    });
  };

  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity 
        key={star} 
        onPress={() => handleRating(star)}
        activeOpacity={0.7}
      >
        <Animated.View style={{
          transform: [
            {
              scale: star === rating ? 
                scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2]
                }) : 1
            }
          ]
        }}>
          <Icon
            name={star <= rating ? 'star' : 'star-outline'}
            size={40}
            color={star <= rating ? '#FFD700' : '#E0E0E0'}
          />
        </Animated.View>
      </TouchableOpacity>
    ));
  };

  const renderTags = () => {
    const tags = rating <= 2 ? negativeTags : positiveTags;
    
    return tags.map((tag) => (
      <TouchableOpacity
        key={tag.id}
        style={[
          styles.tag,
          selectedTags.some(t => t.id === tag.id) && styles.selectedTag
        ]}
        onPress={() => toggleTag(tag)}
        activeOpacity={0.8}
      >
        <Text style={styles.tagEmoji}>{tag.emoji}</Text>
        <Text style={styles.tagText}>{tag.text}</Text>
      </TouchableOpacity>
    ));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        <View style={styles.orderCard}>
          <Image 
            source={{ uri: order.image }} 
            style={styles.restaurantImage} 
            resizeMode="cover"
          />
          <View style={styles.orderInfo}>
            <Text style={styles.restaurantName}>{order.kitchenName}</Text>
            <View style={styles.deliveryInfo}>
              <Icon name="time-outline" size={14} color="#666" />
              <Text style={styles.deliveryText}>
                {order.orderDate} • {order.deliveryTime}
              </Text>
            </View>
            <View style={styles.orderIdContainer}>
              <Text style={styles.orderIdText}>Order ID: {order.id}</Text>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitle}>Your Order</Text>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{item.quantity}x</Text>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{item.price}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>{order.total}</Text>
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate your experience</Text>
          <View style={styles.starsContainer}>
            {renderStars()}
          </View>
          <Text style={styles.ratingHint}>
            {rating === 0 ? 'Tap a star to rate' : 
             rating <= 2 ? 'We apologize for your experience' : 
             'We appreciate your feedback!'}
          </Text>
        </View>

        {/* Feedback Tags */}
        {rating > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {rating <= 2 ? 'What went wrong?' : 'What did you like?'}
            </Text>
            <View style={styles.tagsContainer}>
              {renderTags()}
            </View>
          </View>
        )}

        {/* Additional Feedback */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional comments</Text>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Share details about your experience..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            maxLength={200}
            value={feedback}
            onChangeText={setFeedback}
          />
          <Text style={styles.charCounter}>
            {feedback.length}/200 characters
          </Text>
        </View>
      </ScrollView>

      {/* Compact Submit Button */}
      <View style={[
        styles.submitButtonContainer,
        rating === 0 && styles.disabledButtonContainer
      ]}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={rating === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>
            {rating === 0 ? 'Select Rating' : 'Submit Review'}
          </Text>
          {rating > 0 && (
            <Icon 
              name="checkmark" 
              size={18} 
              color="#FFF" 
              style={styles.buttonIcon} 
            />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 1
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  content: {
    padding: 16,
    paddingBottom: 80
  },
  orderCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2
  },
  restaurantImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  orderInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center'
  },
  restaurantName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6
  },
  deliveryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  deliveryText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6
  },
  orderIdContainer: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  orderIdText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500'
  },
  itemsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    width: 30,
    fontWeight: '500'
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    color: '#444',
    fontWeight: '500'
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222'
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333'
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E65C00'
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 8
  },
  ratingHint: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginTop: 8
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 8
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    margin: 4,
    borderWidth: 1,
    borderColor: '#F5F5F5'
  },
  selectedTag: {
    backgroundColor: '#FFF5E6',
    borderColor: '#E65C00'
  },
  tagEmoji: {
    fontSize: 14,
    marginRight: 4
  },
  tagText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '500'
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FFF',
    marginTop: 8
  },
  charCounter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 6
  },
  submitButtonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#E65C00',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  disabledButtonContainer: {
    backgroundColor: '#AAAAAA'
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15
  },
  buttonIcon: {
    marginLeft: 8
  }
});

export default RateOrderScreen;