import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  OTP: { userInput: string };
  PersonalDetailsScreen: undefined;
  HomeTabs: undefined;
};

// Home Stack - Accessible for both logged in and guest users
export type HomeStackParamList = {
  HomeTabs: undefined;
  PartnerScreen: undefined;
  ProfileScreen: undefined;
  Eatmart: undefined;
  ReorderScreen: undefined;
  HomeKitchenDetails: { kitchenId: string; kitchenName?: string };
  // KitchenScreen: undefined;
  EatoorMoneyScreen: undefined;
  EditProfileScreen: undefined;
  FavoritesScreen: undefined;
  OrdersScreen: undefined;
  OrderDetailsScreen: { orderId: string };
  CartScreen: undefined;
  RateOrderScreen: { orderId: string };
  RateOrderThankYou: undefined;
  MapLocationPicker: { 
    initialLocation?: { latitude: number; longitude: number };
    onLocationSelect?: (location: { latitude: number; longitude: number; address?: string }) => void;
  };
  TrackOrder: { orderId: string };
  AddressScreen: { 
    prevLocation?: string;
    currentLocation?: { latitude: number; longitude: number } | null;
    currentAddress?: string;
    onAddressSelect?: (address: any) => void;
  };
  HomeKitchenNavigate: undefined;
  EatoorMoneyAdd: undefined;
  LoginScreen: undefined;
  OTP: { userInput: string };
};

// Tab Navigator - Accessible for both logged in and guest users
export type HomeTabParamList = {
  Kitchen: undefined;
  Eatmart: undefined;
  ReorderScreen: undefined;
  Partner: undefined;
  Cart: undefined;
};

// App Stack
export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
};

// Screen Props
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type OTPScreenProps = NativeStackScreenProps<AuthStackParamList, 'OTP'>;
export type HomeTabsProps = NativeStackScreenProps<HomeStackParamList, 'HomeTabs'>;
export type ProfileScreenProps = NativeStackScreenProps<HomeStackParamList, 'ProfileScreen'>;
export type EditProfileScreen = NativeStackScreenProps<HomeStackParamList, 'EditProfileScreen'>;
export type FavoritesScreen = NativeStackScreenProps<HomeStackParamList, 'FavoritesScreen'>;
export type OrdersScreen = NativeStackScreenProps<HomeStackParamList, 'OrdersScreen'>;
export type MapLocationPicker = NativeStackScreenProps<HomeStackParamList, 'MapLocationPicker'>;
export type PersonalDetailsScreen = NativeStackScreenProps<HomeStackParamList, 'PersonalDetailsScreen'>;
export type EatmartScreenProps = NativeStackScreenProps<HomeTabParamList, 'Eatmart'>;
export type ReorderScreenProps = NativeStackScreenProps<HomeTabParamList, 'ReorderScreen'>;
export type EatoorMoneyScreenProps = NativeStackScreenProps<HomeTabParamList, 'EatoorMoneyScreen'>;
export type CartScreenProps = NativeStackScreenProps<HomeTabParamList, 'Cart'>;
// export type KitchenScreenProps = NativeStackScreenProps<HomeTabParamList, 'Kitchen'>;
export type AddressScreenProps = NativeStackScreenProps<HomeStackParamList, 'AddressScreen'>;
export type HomeKitchenDetailsProps = NativeStackScreenProps<HomeStackParamList, 'HomeKitchenDetails'>;
export type PartnerScreenProps = NativeStackScreenProps<HomeStackParamList, 'PartnerScreen'>;

// For useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList, HomeStackParamList, HomeTabParamList {}
  }
}