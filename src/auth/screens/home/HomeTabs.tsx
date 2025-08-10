import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import Geolocation from 'react-native-geolocation-service';
import Geocoder from 'react-native-geocoding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import KitchenScreen from './KitchenScreen';
import PartnerScreen from './PartnerScreen';
import CartScreen from './CartScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ProfileButton from '../../components/ProfileButton';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation.d';
import AddressScreen from './AddressScreen';
import { GOOGLE_MAPS_API_KEY } from '@env';
import { getUserAddress } from '../../../api/address';

// Initialize Geocoder
Geocoder.init(GOOGLE_MAPS_API_KEY, { language: 'en' });

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

// Color palette
const COLORS = {
  primary: '#FF6B35',       // Primary orange
  primaryDark: '#E65C00',   // Darker orange
  primaryLight: '#FF9F5B',  // Lighter orange
  background: '#FFFFFF',    // White background
  text: '#333333',          // Dark text
  textLight: '#666666',     // Lighter text
  border: '#EEEEEE',        // Light border
  inactive: '#999999',      // Inactive tab color
  error: '#FF3B30',         // Error red
  success: '#34C759',       // Success green
  warning: '#FF9500',       // Warning orange
  info: '#5AC8FA',          // Info blue
  gradientStart: '#E65C00', // Gradient start (primary)
  gradientEnd: '#DD2476',   // Gradient end (primary light)
};

interface LocationData {
  address: string;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lng: number } | null;
  showEnableLocationPrompt: boolean;
  showPermissionPrompt: boolean;
  homeType: string;
  addressId?: string | null;
}

enum LocationPriority {
  SAVED_COORDS = 'SAVED_COORDS',
  CURRENT_LOCATION = 'CURRENT_LOCATION',
  DEFAULT = 'DEFAULT'
}

const AddressHeaderLeft = () => {
  const navigation = useNavigation();
  const [location, setLocation] = useState<LocationData>({
    address: 'Fetching location...',
    loading: true,
    error: null,
    coords: null,
    showEnableLocationPrompt: false,
    showPermissionPrompt: false,
    homeType: 'Delivering to',
    addressId: null,
  });

  const saveAddressDetails = async (addressData: {
    id?: string;
    full_address: string;
    home_type: string;
    latitude: string;
    longitude: string;
  }) => {
    try {
      await AsyncStorage.multiSet([
        ['AddressId', addressData.id?.toString() || ''],
        ['StreetAddress', addressData.full_address],
        ['HomeType', addressData.home_type || 'Delivering to'],
        ['Latitude', addressData.latitude],
        ['Longitude', addressData.longitude],
      ]);
    } catch (error) {
      console.error('Error saving address details:', error);
    }
  };

  const getSavedCoordinates = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const [savedLat, savedLng] = await Promise.all([
        AsyncStorage.getItem('Latitude'),
        AsyncStorage.getItem('Longitude'),
      ]);

      if (savedLat && savedLng) {
        return {
          lat: parseFloat(savedLat),
          lng: parseFloat(savedLng),
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting saved coordinates:', error);
      return null;
    }
  };

  const updateLocationState = (
    address: string,
    coords: { lat: number; lng: number } | null,
    options: Partial<LocationData> = {}
  ) => {
    setLocation(prev => ({
      ...prev,
      address,
      coords,
      loading: false,
      error: null,
      showEnableLocationPrompt: false,
      showPermissionPrompt: false,
      ...options,
    }));
  };

  const checkLocationInDatabase = async (lat: number, lng: number): Promise<boolean> => {
    try {
      const response = await getUserAddress({ 
        lat: lat.toString(), 
        long: lng.toString() 
      });

      if (response.data?.id) {
        await saveAddressDetails(response.data);
        updateLocationState(
          response.data.full_address,
          { lat, lng },
          { 
            homeType: response.data.home_type,
            addressId: response.data.id.toString()
          }
        );
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking location in database:', error);
      return false;
    }
  };

  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await Geocoder.from(lat, lng);
      return response.results[0]?.formatted_address || 
             `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Unknown location';
    }
  };

  const getCurrentLocation = useCallback(async (priority: LocationPriority = LocationPriority.SAVED_COORDS): Promise<void> => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (priority === LocationPriority.SAVED_COORDS) {
        const savedCoords = await getSavedCoordinates();
        if (savedCoords) {
          const foundInDB = await checkLocationInDatabase(savedCoords.lat, savedCoords.lng);
          if (foundInDB) return;
        }
      }

      if (priority !== LocationPriority.DEFAULT) {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          updateLocationState(
            'Location permission required',
            null,
            { error: 'Location permission required', showPermissionPrompt: true }
          );
          return;
        }

        const locationEnabled = await checkLocationEnabled();
        if (!locationEnabled) {
          updateLocationState(
            'Location services disabled',
            null,
            { error: 'Location services disabled', showEnableLocationPrompt: true }
          );
          return;
        }

        const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 10000,
              distanceFilter: 50,
            }
          );
        });

        const { latitude, longitude } = position.coords;
        
        const foundInDB = await checkLocationInDatabase(latitude, longitude);
        if (foundInDB) return;

        const address = await getAddressFromCoordinates(latitude, longitude);
        updateLocationState(
          address,
          { lat: latitude, lng: longitude }
        );
        return;
      }

      updateLocationState(
        'Unknown location',
        null,
        { error: 'Unable to determine location' }
      );
    } catch (error) {
      console.error('Location error:', error);
      let errorMessage = 'Error getting location';
      let promptForEnable = false;
      let promptForPermission = false;
      
      if (error.code === 2 || error.code === 3) {
        errorMessage = 'Location unavailable';
        promptForEnable = true;
      } else if (error.code === 1) {
        errorMessage = 'Location permission denied';
        promptForPermission = true;
      }
      
      updateLocationState(
        errorMessage,
        null,
        { 
          error: errorMessage,
          showEnableLocationPrompt: promptForEnable,
          showPermissionPrompt: promptForPermission
        }
      );

      if (priority !== LocationPriority.DEFAULT) {
        await getCurrentLocation(LocationPriority.DEFAULT);
      }
    }
  }, []);

  const checkLocationEnabled = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const providerStatus = await Geolocation.getProviderStatus();
        return providerStatus.locationServicesEnabled;
      } else {
        return true;
      }
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This app needs access to your location to show nearby kitchens',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const status = await Geolocation.requestAuthorization('whenInUse');
        return status === 'granted';
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  const showLocationSettingsAlert = useCallback(() => {
    Alert.alert(
      'Location Services Required',
      'To find kitchens near you, please enable location services in your device settings',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => setLocation(prev => ({ ...prev, showEnableLocationPrompt: false }))
        },
        {
          text: 'Open Settings',
          onPress: async () => {
            setLocation(prev => ({ ...prev, showEnableLocationPrompt: false }));
            try {
              if (Platform.OS === 'ios') {
                await Linking.openURL('app-settings:');
              } else {
                await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
              }
            } catch (error) {
              console.error('Error opening settings:', error);
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, []);

  const showPermissionAlert = useCallback(() => {
    Alert.alert(
      'Location Permission Required',
      'This app needs access to your location to show nearby kitchens',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setLocation(prev => ({ ...prev, showPermissionPrompt: false }))
        },
        {
          text: 'Allow',
          onPress: async () => {
            setLocation(prev => ({ ...prev, showPermissionPrompt: false }));
            const granted = await requestLocationPermission();
            if (granted) {
              getCurrentLocation(LocationPriority.CURRENT_LOCATION);
            } else {
              Alert.alert(
                'Permission Denied',
                'To enable location, please grant permission in app settings',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open Settings',
                    onPress: async () => {
                      try {
                        if (Platform.OS === 'ios') {
                          await Linking.openURL('app-settings:');
                        } else {
                          await Linking.openSettings();
                        }
                      } catch (error) {
                        console.error('Error opening settings:', error);
                      }
                    },
                  },
                ]
              );
            }
          },
        },
      ],
      { cancelable: false }
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      getCurrentLocation(LocationPriority.SAVED_COORDS);
      return () => {};
    }, [getCurrentLocation])
  );

  useEffect(() => {
    if (location.showEnableLocationPrompt) {
      showLocationSettingsAlert();
    }
  }, [location.showEnableLocationPrompt, showLocationSettingsAlert]);

  useEffect(() => {
    if (location.showPermissionPrompt) {
      showPermissionAlert();
    }
  }, [location.showPermissionPrompt, showPermissionAlert]);

  const handleRefreshLocation = () => {
    getCurrentLocation(LocationPriority.CURRENT_LOCATION);
  };

  const handleAddressPress = () => {
    navigation.navigate('AddressScreen', {
      prevLocation: "HomeTabs",
      currentLocation: location.coords,
      currentAddress: location.address,
      onAddressSelect: async (
        selectedAddress: string, 
        selectedCoords: { lat: number; lng: number }, 
        homeType: string, 
        addressId?: string
      ) => {
        updateLocationState(
          selectedAddress,
          selectedCoords,
          { 
            homeType: homeType || 'Delivering to',
            addressId: addressId || null
          }
        );
        
        try {
          await saveAddressDetails({
            id: addressId,
            full_address: selectedAddress,
            home_type: homeType || 'Delivering to',
            latitude: selectedCoords.lat.toString(),
            longitude: selectedCoords.lng.toString(),
          });
        } catch (error) {
          console.error('Error saving selected address:', error);
        }
      }
    });
  };

  return (
    <TouchableOpacity
      style={styles.addressHeader}
      onPress={handleAddressPress}
      activeOpacity={0.7}
    >
      <View style={styles.addressLine}>
        <Icon name="location-outline" size={16} color={COLORS.background} />
        <Text style={[styles.addressLabel, { color: COLORS.background }]}>
          {location.homeType}
        </Text>
        <Icon 
          name="chevron-down" 
          size={16} 
          color={COLORS.background} 
          style={{ marginLeft: 2 }} 
        />
      </View>
      
      <Animatable.View 
        animation={location.loading ? 'pulse' : undefined}
        iterationCount="infinite"
        style={styles.addressLine}
      >
        {location.loading ? (
          <ActivityIndicator size={14} color={COLORS.background} />
        ) : (
          <Icon 
            name={location.error ? "warning-outline" : "navigate-outline"} 
            size={14} 
            color={location.error ? COLORS.error : COLORS.background} 
          />
        )}
        
        <Text 
          style={[
            styles.addressText, 
            { 
              color: location.error ? COLORS.error : COLORS.background,
              fontWeight: location.error ? '500' : '400',
            },
          ]} 
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {location.error ? location.error : location.address}
        </Text>
        
        {!location.loading && (
          <TouchableOpacity 
            onPress={handleRefreshLocation} 
            style={{ marginLeft: 8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animatable.View animation="pulse" iterationCount={1}>
              <Icon 
                name="reload-outline" 
                size={14} 
                color={location.error ? COLORS.error : COLORS.background} 
              />
            </Animatable.View>
          </TouchableOpacity>
        )}
      </Animatable.View>
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
            <Animatable.View 
              animation={animation} 
              duration={600} 
              useNativeDriver
              style={styles.tabIconContainer}
            >
              <Icon name={iconName} size={size} color={color} />
              {focused && (
                <View style={[styles.tabIndicator, { backgroundColor: COLORS.primary }]} />
              )}
            </Animatable.View>
          );
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: COLORS.background,
            borderTopColor: COLORS.border,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
        tabBarShowLabel: true,
      })}
      sceneContainerStyle={[
        styles.sceneContainer,
        { backgroundColor: COLORS.background },
      ]}
    >
      <Tab.Screen 
        name="Kitchen" 
        component={KitchenScreen} 
        options={{ 
          tabBarLabel: 'Kitchens',
          tabBarTestID: 'kitchen-tab',
        }} 
      />
      <Tab.Screen 
        name="Eatmart" 
        component={EatmartScreen} 
        options={{ 
          tabBarLabel: 'Eatmart',
          tabBarTestID: 'eatmart-tab',
        }} 
      />
      <Tab.Screen 
        name="Partner" 
        component={PartnerScreen} 
        options={{ 
          tabBarLabel: 'Partner',
          tabBarTestID: 'partner-tab',
        }} 
      />
      {/* <Tab.Screen 
        name="Cart" 
        component={CartScreen} 
        options={{ 
          tabBarLabel: 'Cart',
          tabBarTestID: 'cart-tab',
        }} 
      /> */}
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
          headerBackground: () => (
            <LinearGradient
              colors={[COLORS.gradientStart, COLORS.gradientEnd]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          ),
          headerStyle: [
            styles.header,
            { 
              backgroundColor: 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: COLORS.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            },
          ],
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  sceneContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  header: {
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0,
    borderRadius: 15,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 4,
  },
  tabIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  addressHeader: {
    flexDirection: 'column',
    paddingLeft: 16,
    paddingTop: 2,
    maxWidth: 240,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  addressText: {
    fontSize: 13,
    marginLeft: 6,
    maxWidth: 180,
  },
});

export default HomeTabs;