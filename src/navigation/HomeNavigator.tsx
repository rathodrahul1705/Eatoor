import React, { useEffect, useState, useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import HomeTabs from '../auth/screens/home/HomeTabs';
import ProfileScreen from '../auth/screens/home/ProfileScreen';
import EditProfileScreen from '../auth/screens/home/EditProfileScreen';
import FavoritesScreen from '../auth/screens/home/FavoritesScreen';
import OrderDetailsScreen from '../auth/screens/home/OrderDetailsScreen';
import OrdersScreen from '../auth/screens/home/OrdersScreen';
import CartScreen from '../auth/screens/home/CartScreen';
import RateOrderScreen from '../auth/screens/home/RateOrderScreen';
import RateOrderThankYou from '../auth/screens/home/RateOrderThankYou';
import HomeKitchenDetails from '../auth/screens/home/HomeKitchenDetails';
import MapLocationPicker from '../auth/screens/home/MapLocationPicker';
import TrackOrder from '../auth/screens/home/TrackOrder';
import PersonalDetailsScreen from '../auth/screens/home/PersonalDetailsScreen';
import AddressScreen from '../auth/screens/home/AddressScreen';
import ReorderScreen from '../auth/screens/home/ReorderScreen';
import HomeKitchenNavigate from '../auth/screens/home/HomeKitchenNavigate';
import EatoorMoneyScreen from '../auth/screens/home/EatoorMoneyScreen';
import EatoorMoneyAdd from '../auth/screens/home/EatoorMoneyAdd';
import PartnerScreen from '../auth/screens/home/PartnerScreen';
import LoginScreen from '../auth/screens/LoginScreen';
import { HomeStackParamList } from '../types/navigation.d';
import OTPScreen from '../auth/screens/OTPScreen';
import NotificationSettingsScreen from '../auth/screens/NotificationSettingsScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeNavigator = () => {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isGuest, userToken, loading: authLoading } = useContext(AuthContext);

  useEffect(() => {
    const checkNavigation = async () => {
      try {
        console.log('HomeNavigator: Checking navigation, isGuest:', isGuest, 'userToken:', !!userToken, 'authLoading:', authLoading);
        
        // Wait for auth to finish loading
        if (authLoading) {
          console.log('Waiting for auth to load...');
          return;
        }

        // Clear any previous navigation flag
        await AsyncStorage.removeItem('navigate_to');
        
        // Determine user type and route
        if (isGuest) {
          console.log('✅ Guest user detected -> HomeTabs');
          setInitialRoute('HomeTabs');
          setIsLoading(false);
          return;
        }
        
        if (userToken) {
          console.log('✅ Logged in user detected, checking personal details...');
          
          // Check if user needs to complete personal details
          const userData = await AsyncStorage.getItem('user');
          
          if (userData) {
            try {
              const user = JSON.parse(userData);
              const needsPersonalDetails = !user.full_name || user.full_name.trim() === '';
              
              if (needsPersonalDetails) {
                console.log('📝 User needs personal details -> PersonalDetailsScreen');
                setInitialRoute('PersonalDetailsScreen');
              } else {
                console.log('🏠 User has complete profile -> HomeTabs');
                setInitialRoute('HomeTabs');
              }
            } catch (parseError) {
              console.log('❌ Error parsing user data -> HomeTabs');
              setInitialRoute('HomeTabs');
            }
          } else {
            console.log('👤 No user data found -> HomeTabs');
            setInitialRoute('HomeTabs');
          }
        } else {
          // No token and not guest - treat as first time user
          console.log('👋 No auth state -> HomeTabs');
          setInitialRoute('HomeTabs');
        }
      } catch (error) {
        console.log('❌ Navigation check error:', error);
        setInitialRoute('HomeTabs');
      } finally {
        if (!authLoading) {
          setIsLoading(false);
        }
      }
    };

    checkNavigation();
  }, [isGuest, userToken, authLoading]);

  // Show loading while auth is loading or we're determining initial route
  if (authLoading || isLoading || initialRoute === null) {
    console.log('⏳ Showing loading screen...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e65c00" />
      </View>
    );
  }

  console.log('🎯 HomeNavigator: Initial route set to:', initialRoute);
  console.log('📊 Final state - isGuest:', isGuest, 'userToken:', !!userToken);

  return (
    <Stack.Navigator 
      initialRouteName={initialRoute as keyof HomeStackParamList}
      screenOptions={{ headerShown: false }}
    >
      {/* Common screens accessible to both guest and logged in users */}
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen name="HomeKitchenDetails" component={HomeKitchenDetails} />
      <Stack.Screen name="CartScreen" component={CartScreen} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPicker} />
      <Stack.Screen name="AddressScreen" component={AddressScreen} />
      <Stack.Screen name="ReorderScreen" component={ReorderScreen} />
      <Stack.Screen name="HomeKitchenNavigate" component={HomeKitchenNavigate} />
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      <Stack.Screen name="LoginScreen" component={LoginScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />
      <Stack.Screen name="PersonalDetailsScreen" component={PersonalDetailsScreen} />
      
      {/* These screens should only be accessible to logged in users */}
      {userToken && !isGuest && (
        <>
          {/* <Stack.Screen name="PersonalDetailsScreen" component={PersonalDetailsScreen} /> */}
          <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
          <Stack.Screen name="FavoritesScreen" component={FavoritesScreen} />
          <Stack.Screen name="OrderDetailsScreen" component={OrderDetailsScreen} />
          <Stack.Screen name="OrdersScreen" component={OrdersScreen} />
          <Stack.Screen name="RateOrderScreen" component={RateOrderScreen} />
          <Stack.Screen name="RateOrderThankYou" component={RateOrderThankYou} />
          <Stack.Screen name="TrackOrder" component={TrackOrder} />
          <Stack.Screen name="EatoorMoneyScreen" component={EatoorMoneyScreen} />
          <Stack.Screen name="EatoorMoneyAdd" component={EatoorMoneyAdd} />
          <Stack.Screen name="PartnerScreen" component={PartnerScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notification Settings' }}
        />
        </>
      )}
    </Stack.Navigator>
  );
};

export default HomeNavigator;