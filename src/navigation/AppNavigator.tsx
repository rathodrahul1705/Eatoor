import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthNavigator from './AuthNavigator';
import HomeNavigator from './HomeNavigator';
import { RootStackParamList } from '../types/navigation.d';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="Home" component={HomeNavigator} />
    </Stack.Navigator>
  );
};

export default AppNavigator;