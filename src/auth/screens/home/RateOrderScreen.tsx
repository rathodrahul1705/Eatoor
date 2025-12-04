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
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getOrderDetails, updateOrderRating } from '../../../api/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Tag data for ratings
const positiveTags = [
  { id: 1, emoji: '😋', text: 'Tasty Food' },
  { id: 2, emoji: '🚚', text: 'Fast Delivery' },
  { id: 3, emoji: '👨‍🍳', text: 'Great Packaging' },
  { id: 4, emoji: '💯', text: 'Fresh Ingredients' },
  { id: 5, emoji: '⭐', text: 'Excellent Service' },
  { id: 6, emoji: '🔥', text: 'Hot & Fresh' },
];

const negativeTags = [
  { id: 7, emoji: '😞', text: 'Cold Food' },
  { id: 8, emoji: '⏰', text: 'Late Delivery' },
  { id: 9, emoji: '💸', text: 'Overpriced' },
  { id: 10, emoji: '👎', text: 'Poor Quality' },
  { id: 11, emoji: '📦', text: 'Bad Packaging' },
  { id: 12, emoji: '😠', text: 'Rude Staff' },
];

const RateOrderScreen = ({ navigation, route }) => {
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef();
  const feedbackInputRef = useRef();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
              // Fade in animation when order loads
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }).start();
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

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Scroll to feedback input when keyboard appears
        setTimeout(() => {
          feedbackInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
            scrollViewRef.current?.scrollTo({ y: pageY - 100, animated: true });
          });
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
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

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
    return [1, 2, 3, 4, 5].map((star) => {
      const starScale = scaleAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, star === rating ? 1.3 : 1]
      });

      return (
        <TouchableOpacity 
          key={star} 
          onPress={() => handleRating(star)}
          activeOpacity={0.6}
          style={styles.starButton}
        >
          <Animated.View style={{
            transform: [{ scale: starScale }],
            padding: 4,
          }}>
            <Icon
              name={star <= rating ? 'star' : 'star-outline'}
              size={44}
              color={star <= rating ? '#FFB800' : '#E0E0E0'}
              style={styles.starIcon}
            />
            {star <= rating && (
              <View style={styles.starGlow} />
            )}
          </Animated.View>
        </TouchableOpacity>
      );
    });
  };

  const renderTags = () => {
    const tags = rating <= 2 ? negativeTags : positiveTags;
    
    return tags.map((tag) => {
      const isSelected = selectedTags.some(t => t.id === tag.id);
      
      return (
        <TouchableOpacity
          key={tag.id}
          style={[
            styles.tag,
            isSelected && styles.selectedTag
          ]}
          onPress={() => toggleTag(tag)}
          activeOpacity={0.7}
        >
          <Text style={styles.tagEmoji}>{tag.emoji}</Text>
          <Text style={[
            styles.tagText,
            isSelected && styles.selectedTagText
          ]}>{tag.text}</Text>
        </TouchableOpacity>
      );
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const calculateDeliveryTime = (placedOn, estimatedDelivery) => {
    const placed = new Date(placedOn);
    const estimated = new Date(estimatedDelivery);
    const diff = (estimated - placed) / (1000 * 60);
    return `${Math.round(diff)} min`;
  };

  const scrollToFeedback = () => {
    setTimeout(() => {
      feedbackInputRef.current?.measure((x, y, width, height, pageX, pageY) => {
        scrollViewRef.current?.scrollTo({ y: pageY - 150, animated: true });
      });
    }, 100);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading your order details...</Text>
          <Text style={styles.loadingSubtext}>This will just take a moment</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <View style={styles.errorIconContainer}>
            <Icon name="warning-outline" size={60} color="#FF6B35" />
          </View>
          <Text style={styles.errorTitle}>Oops!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Icon name="arrow-back" size={20} color="#FFF" />
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <View style={styles.errorIconContainer}>
            <Icon name="alert-circle-outline" size={60} color="#FF9500" />
          </View>
          <Text style={styles.errorTitle}>No Data Available</Text>
          <Text style={styles.errorText}>We couldn't find your order information</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Icon name="arrow-back" size={20} color="#FFF" />
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
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
          activeOpacity={0.7}
        >
          <Icon name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Your Order</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <Animated.ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ opacity: fadeAnim }}
        >
          {/* Order Summary Card */}
          <View style={styles.orderCard}>
            <View style={styles.orderCardHeader}>
              <Text style={styles.orderCardTitle}>Order Summary</Text>
              <View style={styles.orderStatusBadge}>
                <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                <Text style={styles.orderStatusText}>Delivered</Text>
              </View>
            </View>
            
            <View style={styles.restaurantInfo}>
              <Image 
                source={{ uri: order.restaurant_image || 'https://via.placeholder.com/80' }} 
                style={styles.restaurantImage} 
                resizeMode="cover"
              />
              <View style={styles.restaurantDetails}>
                <Text style={styles.restaurantName}>{order.restaurant_name}</Text>
                <View style={styles.restaurantMeta}>
                  <View style={styles.metaItem}>
                    <Icon name="calendar-outline" size={14} color="#666" />
                    <Text style={styles.metaText}>{formatDate(order.placed_on)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Icon name="time-outline" size={14} color="#666" />
                    <Text style={styles.metaText}>{calculateDeliveryTime(order.placed_on, order.estimated_delivery)}</Text>
                  </View>
                </View>
                <View style={styles.orderIdContainer}>
                  <Icon name="receipt-outline" size={12} color="#666" />
                  <Text style={styles.orderIdText}>ID: {order.order_number}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Order Items Card */}
          <View style={styles.itemsCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Order Items</Text>
              <Text style={styles.itemCount}>{order.items.length} items</Text>
            </View>
            
            {order.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{item.total_price}</Text>
              </View>
            ))}
            
            <View style={styles.divider} />
            
            {/* Pricing Summary */}
            <View style={styles.pricingSummary}>
              {order.coupon_code && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Discount ({order.coupon_code})</Text>
                  <Text style={[styles.priceValue, styles.discountValue]}>-₹{order.coupon_discount}</Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Fee</Text>
                <Text style={styles.priceValue}>₹{order.delivery_fee}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalAmount}>₹{order.total}</Text>
              </View>
            </View>
          </View>

          {/* Rating Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="star-half-outline" size={20} color="#FFB800" />
              <Text style={styles.sectionTitle}>How was your experience?</Text>
            </View>
            
            <View style={styles.starsContainer}>
              {renderStars()}
            </View>
            
            <Text style={styles.ratingHint}>
              {rating === 0 ? 'Tap a star to rate your experience' : 
               rating <= 2 ? 'We apologize for your experience 😔' : 
               'Thank you for your feedback! 😊'}
            </Text>

            {/* Tags Section */}
            {rating > 0 && (
              <View style={styles.tagsSection}>
                <Text style={styles.tagsTitle}>
                  What stood out? (Optional)
                </Text>
                <View style={styles.tagsContainer}>
                  {renderTags()}
                </View>
              </View>
            )}
          </View>

          {/* Feedback Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="chatbubble-outline" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>Additional feedback</Text>
            </View>
            
            <Text style={styles.feedbackHint}>
              Share more details about your experience (optional)
            </Text>
            
            <TouchableOpacity
              activeOpacity={1}
              onPress={scrollToFeedback}
              style={styles.feedbackInputContainer}
            >
              <TextInput
                ref={feedbackInputRef}
                style={styles.feedbackInput}
                placeholder="Tell us what you loved or what we can improve..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                maxLength={200}
                value={feedback}
                onChangeText={setFeedback}
                onFocus={scrollToFeedback}
              />
              <View style={styles.charCounterContainer}>
                <Text style={styles.charCounter}>
                  {feedback.length}/200
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Submit Button */}
      <Animated.View style={[
        styles.submitButtonContainer,
        keyboardVisible && styles.submitButtonContainerKeyboard,
        { opacity: fadeAnim }
      ]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            rating === 0 && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitting}
          activeOpacity={0.9}
        >
          <View style={styles.submitButtonContent}>
            {submitting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {rating === 0 ? 'Select a Rating' : 'Submit Review'}
                </Text>
                <View style={styles.buttonIconContainer}>
                  <Icon 
                    name={rating === 0 ? "arrow-forward" : "checkmark"} 
                    size={20} 
                    color="#FFF" 
                  />
                </View>
              </>
            )}
          </View>
          {rating > 0 && (
            <View style={styles.ratingIndicator}>
              <Text style={styles.ratingIndicatorText}>{rating}/5</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666'
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10
  },
  backButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5
  },
  keyboardAvoidView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  orderCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A'
  },
  orderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 4
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  restaurantImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  restaurantDetails: {
    flex: 1,
    marginLeft: 16
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8
  },
  restaurantMeta: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4
  },
  metaText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 6
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  orderIdText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4
  },
  itemsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A'
  },
  itemCount: {
    fontSize: 13,
    color: '#FF6B35',
    fontWeight: '600',
    backgroundColor: '#FFF0EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  itemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    width: 30
  },
  itemName: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 1
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A'
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16
  },
  pricingSummary: {
    marginTop: 8
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  priceLabel: {
    fontSize: 14,
    color: '#666'
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333'
  },
  discountValue: {
    color: '#4CAF50'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333'
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF6B35'
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 10
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16
  },
  starButton: {
    padding: 4,
    marginHorizontal: 2
  },
  starIcon: {
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  starGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFB800',
    opacity: 0.2,
    top: 4,
    left: 4
  },
  ratingHint: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic'
  },
  tagsSection: {
    marginTop: 20
  },
  tagsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    margin: 4,
    borderWidth: 1.5,
    borderColor: '#F8FAFC'
  },
  selectedTag: {
    backgroundColor: '#FFF5EB',
    borderColor: '#FF6B35',
    transform: [{ scale: 1.05 }]
  },
  tagEmoji: {
    fontSize: 16,
    marginRight: 6
  },
  tagText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500'
  },
  selectedTagText: {
    color: '#FF6B35',
    fontWeight: '600'
  },
  feedbackHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12
  },
  feedbackInputContainer: {
    borderWidth: 2,
    borderColor: '#E8ECF4',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden'
  },
  feedbackInput: {
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#333',
    backgroundColor: '#F8FAFC'
  },
  charCounterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'flex-end'
  },
  charCounter: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500'
  },
  bottomSpacer: {
    height: 40
  },
  submitButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8
  },
  submitButtonContainerKeyboard: {
    bottom: Platform.OS === 'ios' ? 20 : 10
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC'
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: -0.3
  },
  buttonIconContainer: {
    marginLeft: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },
  ratingIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  ratingIndicatorText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14
  }
});

export default RateOrderScreen;