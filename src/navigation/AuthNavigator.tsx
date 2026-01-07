import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../auth/screens/LoginScreen';
import OTPScreen from '../auth/screens/OTPScreen';
import PersonalDetailsScreen from '../auth/screens/home/PersonalDetailsScreen';
import HomeTabs from '../auth/screens/home/HomeTabs';

export type AuthStackParamList = {
  Login: undefined;
  OTP: { userInput: string };
  PersonalDetailsScreen: undefined;
  HomeTabs: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="Login"
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="PersonalDetailsScreen" component={PersonalDetailsScreen} />
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;