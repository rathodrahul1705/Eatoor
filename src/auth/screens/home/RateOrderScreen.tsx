import React, { useState, useRef, useEffect } from 'react';
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
  Dimensions,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getOrderDetails, updateOrderRating } from '../../../api/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const RateOrderScreen = ({ navigation, route }) => {
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchUserAndOrderDetails = async () => {
      try {
        setLoading(true);
        
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          
          if (route.params?.order?.order_number) {
            const response = await getOrderDetails({ 
              order_number: route.params.order.order_number,
              user_id: parsedUser.id 
            });

            if (response.status === 200 && response.data.orders?.length > 0) {
              setOrder(response.data.orders[0]);
            } else {
              setError('No order details found');
            }
          } else {
            setError('Order number not provided');
          }
        } else {
          setError('User not logged in');
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError(err.message || 'Failed to fetch order details');
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndOrderDetails();
  }, [route.params?.order?.order_number]);

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

  const handleSubmit = async () => {
    if (!order || !user || rating === 0) return;

    try {
      setSubmitting(true);
      
      const submissionData = {
        order_id: order.order_number,
        user_id: user.id,
        restaurant_id: order.restaurant_id,
        rating: rating,
        review_text: feedback,
      };


      const response = await updateOrderRating(submissionData);
      if (response.status === 201) {
        navigation.navigate('RateOrderThankYou', { 
          rating,
          kitchenName: order.restaurant_name 
        });
      } else {
        Alert.alert(
          'Submission Failed',
          response.message || 'Failed to submit rating. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert(
        'Error',
        'An error occurred while submitting your rating. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSubmitting(false);
    }
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const calculateDeliveryTime = (placedOn, estimatedDelivery) => {
    const placed = new Date(placedOn);
    const estimated = new Date(estimatedDelivery);
    const diff = (estimated - placed) / (1000 * 60);
    return `${Math.round(diff)} minutes`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E65C00" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Icon name="warning-outline" size={40} color="#FF3B30" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={40} color="#FF9500" />
        <Text style={styles.errorText}>No order data available</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
            source={{ uri: order.restaurant_image }} 
            style={styles.restaurantImage} 
            resizeMode="cover"
          />
          <View style={styles.orderInfo}>
            <Text style={styles.restaurantName}>{order.restaurant_name}</Text>
            <View style={styles.deliveryInfo}>
              <Icon name="time-outline" size={14} color="#666" />
              <Text style={styles.deliveryText}>
                Delivered on {formatDate(order.placed_on)} • {calculateDeliveryTime(order.placed_on, order.estimated_delivery)}
              </Text>
            </View>
            <View style={styles.orderIdContainer}>
              <Text style={styles.orderIdText}>Order ID: {order.order_number}</Text>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.itemsTitle}>Your Order</Text>
          {order.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{item.quantity}x</Text>
              <Text style={styles.itemName}>{item.item_name}</Text>
              <Text style={styles.itemPrice}>₹{item.total_price}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          {order.coupon_code && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Discount ({order.coupon_code})</Text>
              <Text style={styles.discountAmount}>-₹{order.coupon_discount}</Text>
            </View>
          )}
          <View style={styles.deliveryFeeRow}>
            <Text style={styles.deliveryFeeLabel}>Delivery Fee</Text>
            <Text style={styles.deliveryFeeAmount}>₹{order.delivery_fee}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalAmount}>₹{order.total}</Text>
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

      {/* Submit Button */}
      <View style={[
        styles.submitButtonContainer,
        rating === 0 && styles.disabledButtonContainer
      ]}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
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
            </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 20
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    textAlign: 'center'
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16
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
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  discountLabel: {
    fontSize: 14,
    color: '#666'
  },
  discountAmount: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600'
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  deliveryFeeLabel: {
    fontSize: 14,
    color: '#666'
  },
  deliveryFeeAmount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600'
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