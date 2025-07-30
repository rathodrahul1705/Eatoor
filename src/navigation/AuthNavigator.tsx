import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../auth/screens/LoginScreen';
import OTPScreen from '../auth/screens/OTPScreen';
import PersonalDetailsScreen from '../auth/screens/home/PersonalDetailsScreen';

export type AuthStackParamList = {
  Login: undefined;
  OTP: { userInput: string };
  PersonalDetails: undefined
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;