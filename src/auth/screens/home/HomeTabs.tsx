import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';

import KitchenScreen from './KitchenScreen';
import PartnerScreen from './PartnerScreen';
import CartScreen from './CartScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ProfileButton from '../../components/ProfileButton';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation.d';
import AddressScreen from './AddressScreen'; // Import the new component

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

const tabIcons: { [key in keyof HomeTabParamList]: string } = {
  Kitchen: 'fast-food-outline',
  Eatmart: 'restaurant-outline',
  Partner: 'people-outline',
  Cart: 'cart-outline',
};

const tabIconsFocused: { [key in keyof HomeTabParamList]: string } = {
  Kitchen: 'fast-food',
  Eatmart: 'restaurant',
  Partner: 'people',
  Cart: 'cart',
};

const AddressHeaderLeft = () => {
  const navigation = useNavigation();

  return (
    <TouchableOpacity
      style={styles.addressHeader}
      onPress={() => navigation.navigate('AddressScreen' as never)}
    >
      <View style={styles.addressLine}>
        <Icon name="location-outline" size={16} color="#E65C00" />
        <Text style={styles.addressLabel}>Delivering to</Text>
        <Icon name="chevron-down" size={16} color="#E65C00" style={{ marginLeft: 2 }} />
      </View>
      <View style={styles.addressLine}>
        <Icon name="navigate-outline" size={14} color="#555" />
        <Text style={styles.addressText} numberOfLines={1}>
          123, Shivaji Nagar, Thane
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const HomeTabsNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = focused
            ? tabIconsFocused[route.name as keyof HomeTabParamList]
            : tabIcons[route.name as keyof HomeTabParamList];
          const animation = focused ? 'bounceIn' : undefined;

          return (
            <Animatable.View animation={animation} duration={600} useNativeDriver>
              <Icon name={iconName} size={size} color={color} />
            </Animatable.View>
          );
        },
        tabBarActiveTintColor: '#E65C00',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      })}
      sceneContainerStyle={styles.sceneContainer}
    >
      <Tab.Screen name="Kitchen" component={KitchenScreen} options={{ tabBarLabel: 'Kitchens' }} />
      <Tab.Screen name="Eatmart" component={EatmartScreen} options={{ tabBarLabel: 'Eatmart' }} />
      <Tab.Screen name="Partner" component={PartnerScreen} options={{ tabBarLabel: 'Partner' }} />
      {/* <Tab.Screen name="Cart" component={CartScreen} options={{ tabBarLabel: 'Cart' }} /> */}
    </Tab.Navigator>
  );
};

const HomeTabs = () => {
  const navigation = useNavigation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HomeTabs"
        component={HomeTabsNavigator}
        options={{
          headerTitle: '',
          headerLeft: () => <AddressHeaderLeft />,
          headerRight: () => <ProfileButton navigation={navigation} />,
          headerStyle: styles.header,
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="AddressScreen"
        component={AddressScreen}
        options={{
          title: 'Manage Address',
          headerBackTitleVisible: false,
          headerBackTitle: '',
          headerTintColor: '#000',
          headerTitleStyle: { fontSize: 17, fontWeight: '600' },
          headerStyle: styles.header,
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  sceneContainer: {
    backgroundColor: '#fff',
    paddingBottom: 20,
  },
  header: {
    backgroundColor: '#fff',
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 70,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 4,
  },
  addressHeader: {
    flexDirection: 'column',
    paddingLeft: 10,
    paddingTop: 2,
    maxWidth: 220,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65C00',
    marginLeft: 6,
  },
  addressText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 6,
    maxWidth: 160,
  },
});

export default HomeTabs;