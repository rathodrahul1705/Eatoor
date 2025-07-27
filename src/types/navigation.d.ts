import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  OTP: { userInput: string };
};

// Home Stack
export type HomeStackParamList = {
  HomeTabs: undefined;
  Profile: undefined;
  PastOrders: undefined;
  Eatmart: undefined; // Add this line
  HomeKitchenDetails: { kitchenId: string };
  KitchenScreen: undefined;
};

// Tab Navigator
export type HomeTabParamList = {
  Eatmart: undefined;
  Kitchen: undefined;
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
export type ProfileScreenProps = NativeStackScreenProps<HomeStackParamList, 'Profile'>;
export type EditProfileScreen = NativeStackScreenProps<HomeStackParamList, 'EditProfileScreen'>;
export type FavoritesScreen = NativeStackScreenProps<HomeStackParamList, 'FavoritesScreen'>;
export type OrdersScreen = NativeStackScreenProps<HomeStackParamList, 'OrdersScreen'>;
export type EatmartScreenProps = NativeStackScreenProps<HomeTabParamList, 'Eatmart'>;

// For useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList, HomeStackParamList, HomeTabParamList {}
  }
}