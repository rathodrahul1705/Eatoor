import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import HomeTabs from '../auth/screens/home/HomeTabs';
import ProfileScreen from '../auth/screens/home/ProfileScreen';
import EditProfileScreen from '../auth/screens/home/EditProfileScreen';
import FavoritesScreen from '../auth/screens/home/FavoritesScreen';
import OrderDetailsScreen from '../auth/screens/home/OrderDetailsScreen';
import OrdersScreen from '../auth/screens/home/OrdersScreen';
import KitchenScreen from '../auth/screens/home/KitchenScreen';
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
import { HomeStackParamList } from '../types/navigation.d';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeNavigator = () => {
  const [initialRoute, setInitialRoute] = useState<string>('HomeTabs');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkNavigation = async () => {
      try {
        // Get the navigation target from AsyncStorage (set by OTP screen)
        const navigateTo = await AsyncStorage.getItem('navigate_to');
        
        if (navigateTo === 'PersonalDetailsScreen') {
          // Check if user has completed personal details
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            
            // Check if user has completed profile (based on your API response)
            // In your API response, full_name is empty string: "full_name": ""
            if (!user.full_name || user.full_name.trim() === '') {
              setInitialRoute('PersonalDetailsScreen');
            } else {
              setInitialRoute('HomeTabs');
            }
          }
        } else {
          setInitialRoute('HomeTabs');
        }
        
        // Clear the navigation flag
        await AsyncStorage.removeItem('navigate_to');
      } catch (error) {
        console.log('Navigation check error:', error);
        setInitialRoute('HomeTabs');
      } finally {
        setIsLoading(false);
      }
    };

    checkNavigation();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e65c00" />
      </View>
    );
  }

  return (
    <Stack.Navigator 
      initialRouteName={initialRoute as keyof HomeStackParamList}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      <Stack.Screen name="FavoritesScreen" component={FavoritesScreen} />
      <Stack.Screen name="OrderDetailsScreen" component={OrderDetailsScreen} />
      <Stack.Screen name="OrdersScreen" component={OrdersScreen} />
      <Stack.Screen name="KitchenScreen" component={KitchenScreen} />
      <Stack.Screen name="HomeKitchenDetails" component={HomeKitchenDetails} />
      <Stack.Screen name="PersonalDetailsScreen" component={PersonalDetailsScreen} />
      <Stack.Screen name="CartScreen" component={CartScreen} />
      <Stack.Screen name="RateOrderScreen" component={RateOrderScreen} />
      <Stack.Screen name="RateOrderThankYou" component={RateOrderThankYou} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPicker} />
      <Stack.Screen name="TrackOrder" component={TrackOrder} />
      <Stack.Screen name="AddressScreen" component={AddressScreen} />
      <Stack.Screen name="ReorderScreen" component={ReorderScreen} />
      <Stack.Screen name="HomeKitchenNavigate" component={HomeKitchenNavigate} />
      <Stack.Screen name="EatoorMoneyScreen" component={EatoorMoneyScreen} />
    </Stack.Navigator>
  );
};

export default HomeNavigator;