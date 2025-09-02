import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { HomeStackParamList } from '../types/navigation.d';

const Stack = createNativeStackNavigator<HomeStackParamList>();

const HomeNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
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
  </Stack.Navigator>
);

export default HomeNavigator;
