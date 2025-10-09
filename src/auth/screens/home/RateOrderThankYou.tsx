import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const RateOrderThankYou = ({ route, navigation }) => {
  const { rating, kitchenName } = route.params;
  const scaleValue = new Animated.Value(0);
  const fadeValue = new Animated.Value(0);
  const slideValue = new Animated.Value(50);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true
      }),
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.timing(slideValue, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }, []);

  const getAssets = () => {
    if (rating >= 4) {
      return {
        icon: 'happy',
        color: '#E65C00',
        title: 'Awesome!',
        subtitle: `You loved ${kitchenName}'s food`,
        bgColor: '#E8F5E9',
        message: `We're thrilled you enjoyed your meal from ${kitchenName}! Your feedback helps us maintain our quality.`,
        starBg: 'rgba(76, 175, 80, 0.1)'
      };
    } else if (rating >= 3) {
      return {
        icon: 'thumbs-up',
        color: '#E65C00',
        title: 'Thanks!',
        subtitle: `Your feedback matters`,
        bgColor: '#FFF8E1',
        message: `Thanks for rating your experience with ${kitchenName}. We'll use your feedback to improve.`,
        starBg: 'rgba(255, 160, 0, 0.1)'
      };
    } else {
      return {
        icon: 'sad',
        color: '#E65C00',
        title: 'Oops!',
        subtitle: `We'll do better next time`,
        bgColor: '#FFEBEE',
        message: `We sincerely apologize your experience with ${kitchenName} wasn't perfect. Your feedback is valuable to us.`,
        starBg: 'rgba(244, 67, 54, 0.1)'
      };
    }
  };

  const assets = getAssets();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: assets.bgColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Feedback</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('HomeTabs')}
          style={styles.homeButton}
        >
          <Icon name="home" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeValue,
            transform: [{ translateY: slideValue }]
          }
        ]}
      >
        {/* Main Content */}
        <View style={styles.card}>
          {/* Icon Illustration */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { 
                transform: [{ scale: scaleValue }],
                backgroundColor: assets.color,
                shadowColor: assets.color,
              }
            ]}
          >
            <Icon 
              name={assets.icon} 
              size={40} 
              color="#FFF"
            />
          </Animated.View>
          
          {/* Title */}
          <Text style={[styles.title, { color: assets.color }]}>
            {assets.title}
          </Text>
          
          {/* Subtitle */}
          <Text style={styles.subtitle}>{assets.subtitle}</Text>
          
          {/* Rating Display */}
          <View style={styles.ratingContainer}>
            <View style={[styles.starsBackground, { backgroundColor: assets.starBg }]}>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Icon
                    key={star}
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={28}
                    color={star <= rating ? assets.color : '#E0E0E0'}
                    style={styles.star}
                  />
                ))}
              </View>
            </View>
            <Text style={styles.kitchenName}>{kitchenName}</Text>
          </View>
        </View>
        
        {/* Thank You Message */}
        <View style={styles.messageCard}>
          <Text style={styles.message}>
            {assets.message}
          </Text>
        </View>
        
        {/* Home Button */}
        <TouchableOpacity
          style={[styles.homeActionButton, { backgroundColor: assets.color }]}
          onPress={() => navigation.navigate('HomeTabs')}
        >
          <Icon name="home" size={20} color="#FFF" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  homeButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingTop: 16
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 17,
    color: '#6B7280',
    marginBottom: 24,
    fontWeight: '500',
    textAlign: 'center'
  },
  ratingContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0'
  },
  starsBackground: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 16
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  star: {
    marginHorizontal: 6
  },
  kitchenName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8
  },
  messageCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    textAlign: 'center'
  },
  homeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10
  },
  buttonIcon: {
    marginRight: 4
  }
});

export default RateOrderThankYou;