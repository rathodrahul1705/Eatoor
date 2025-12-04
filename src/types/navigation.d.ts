import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  OTP: { userInput: string };
  PersonalDetails: undefined;
};

// Home Stack
export type HomeStackParamList = {
  HomeTabs: undefined;
  Profile: undefined;
  PastOrders: undefined;
  Eatmart: undefined; // Add this line
  ReorderScreen: undefined; // Add this line
  HomeKitchenDetails: undefined;
  KitchenScreen: undefined;
  PersonalDetailsScreen: undefined;
  EatoorMoneyScreen: undefined;
};

// Tab Navigator
export type HomeTabParamList = {
  Eatmart: undefined;
  Kitchen: undefined;
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
export type ProfileScreenProps = NativeStackScreenProps<HomeStackParamList, 'Profile'>;
export type EditProfileScreen = NativeStackScreenProps<HomeStackParamList, 'EditProfileScreen'>;
export type FavoritesScreen = NativeStackScreenProps<HomeStackParamList, 'FavoritesScreen'>;
export type OrdersScreen = NativeStackScreenProps<HomeStackParamList, 'OrdersScreen'>;
export type MapLocationPicker = NativeStackScreenProps<HomeStackParamList, 'MapLocationPicker'>;
// export type TrackOrder = NativeStackScreenProps<HomeStackParamList, 'TrackOrder'>;
export type PersonalDetailsScreen = NativeStackScreenProps<HomeStackParamList, 'PersonalDetailsScreen'>;
export type EatmartScreenProps = NativeStackScreenProps<HomeTabParamList, 'Eatmart'>;
export type ReorderScreenProps = NativeStackScreenProps<HomeTabParamList, 'ReorderScreen'>;
export type EatoorMoneyScreenProps = NativeStackScreenProps<HomeTabParamList, 'EatoorMoneyScreen'>;

// For useNavigation hook
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList, HomeStackParamList, HomeTabParamList {}
  }
}