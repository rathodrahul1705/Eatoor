import React, { useRef } from 'react';
import { 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Easing,
  View 
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { HomeStackParamList } from '../../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ProfileButtonProps = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'HomeTabs'>;
};

const ProfileButton: React.FC<ProfileButtonProps> = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.ease
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.ease
        })
      ]),
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.ease
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.ease
        })
      ])
    ]).start(() => {
      // Navigate after animation completes
      navigation.navigate('ProfileScreen');
    });
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity 
        style={styles.button}
        onPress={handlePress}
        activeOpacity={0.7}
        testID="profile-button"
      >
        <Icon name="person-outline" size={24} color="#333" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 5,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.5,
    // Android shadow
    elevation: 5,
    // Border for subtle definition
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
});

export default ProfileButton;