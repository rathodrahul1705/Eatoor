import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import HomeNavigator from './HomeNavigator';
import { RootStackParamList } from '../types/navigation.d';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const { userToken, isLoading, isGuest } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View>
        <ActivityIndicator size="large" color="#e65c00" />
      </View>
    );
  }

  console.log('AppNavigator: userToken:', !!userToken, 'isGuest:', isGuest);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {userToken || isGuest ? (
        // User is logged in OR is a guest user
        <Stack.Screen name="HomeNavigator" component={HomeNavigator} />
      ) : (
        // User is not logged in and not a guest
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;