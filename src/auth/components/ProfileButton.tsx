import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { HomeStackParamList } from '../../types/navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type ProfileButtonProps = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'HomeTabs'>;
};

const ProfileButton: React.FC<ProfileButtonProps> = ({ navigation }) => {
  return (
    <TouchableOpacity 
      style={styles.button}
      onPress={() => navigation.navigate('ProfileScreen')}
      testID="profile-button"
    >
      <Icon name="person-outline" size={24} color="#333" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    marginRight: 15,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default ProfileButton;