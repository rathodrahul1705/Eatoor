import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  Image
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const RateOrderThankYou = ({ route, navigation }) => {
  const { rating, kitchenName } = route.params;

  // Get appropriate message based on rating
  const getMessage = () => {
    if (rating >= 4) {
      return "We're delighted you enjoyed your meal from " + kitchenName + "! Your feedback helps us improve.";
    } else if (rating >= 3) {
      return "Thank you for rating your experience with " + kitchenName + ". We appreciate your feedback!";
    } else {
      return "We're truly sorry your experience with " + kitchenName + " wasn't perfect. We'll use your feedback to improve.";
    }
  };

  // Get appropriate icon based on rating
  const getIcon = () => {
    if (rating >= 4) {
      return { name: "happy", color: "#4CAF50" };
    } else if (rating >= 3) {
      return { name: "thumbs-up", color: "#2196F3" };
    } else {
      return { name: "sad", color: "#FF5722" };
    }
  };

  const icon = getIcon();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Rating Icon */}
        <View style={styles.iconContainer}>
          <Icon 
            name={icon.name} 
            size={80} 
            color={icon.color} 
          />
        </View>
        
        {/* Thank You Message */}
        <Text style={styles.title}>Thank You!</Text>
        
        {/* Rating Display */}
        <View style={styles.ratingDisplay}>
          <Text style={styles.ratingText}>You rated:</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Icon
                key={star}
                name={star <= rating ? 'star' : 'star-outline'}
                size={24}
                color={star <= rating ? '#FFC107' : '#E5E7EB'}
                style={styles.starIcon}
              />
            ))}
          </View>
          <Text style={styles.kitchenName}>{kitchenName}</Text>
        </View>
        
        {/* Personalized Message */}
        <Text style={styles.message}>{getMessage()}</Text>
        
        {/* Action Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>BACK TO HOME</Text>
          <Icon name="home" size={20} color="#FFF" style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  iconContainer: {
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16
  },
  ratingDisplay: {
    alignItems: 'center',
    marginBottom: 24
  },
  ratingText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8
  },
  stars: {
    flexDirection: 'row',
    marginBottom: 8
  },
  starIcon: {
    marginHorizontal: 4
  },
  kitchenName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827'
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16
  },
  button: {
    backgroundColor: '#E65C00',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center'
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 8
  },
  buttonIcon: {
    marginLeft: 8
  }
});

export default RateOrderThankYou;