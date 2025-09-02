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
  StatusBar,
  Dimensions,
  AppState,
  AppStateStatus,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import Geolocation from '@react-native-community/geolocation';
import Geocoder from 'react-native-geocoding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import KitchenScreen from './KitchenScreen';
import PartnerScreen from './PartnerScreen';
// import CartScreen from './CartScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ProfileButton from '../../components/ProfileButton';
import ReorderScreen from '../../screens/home/ReorderScreen';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation.d';
// import AddressScreen from './AddressScreen';
import Config from 'react-native-config';
import { getUserAddress } from '../../../api/address';

// Initialize Geocoder
Geocoder.init('AIzaSyBKOWlVTzhP7lRcNEHbT2SNz-W_bYx3v28', { language: 'en' });

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// Get screen dimensions
const { width, height } = Dimensions.get('window');
const isSmallDevice = height < 700;
const isIOS = Platform.OS === 'ios';

// Increased header height values
const HEADER_HEIGHT = isIOS ? 120 : 80; // Increased from 100/60 to 120/80
const HEADER_PADDING_TOP = isIOS ? 40 : 0; // Added padding for iOS status bar

const tabIcons: { [key in keyof HomeTabParamList]: string } = {
  Kitchen: 'fast-food-outline',
  Eatmart: 'restaurant-outline',
  Reorder: 'repeat-outline',
  Partner: 'people-outline',
  Cart: 'cart-outline',
};

const tabIconsFocused: { [key in keyof HomeTabParamList]: string } = {
  Kitchen: 'fast-food',
  Eatmart: 'restaurant',
  Reorder: 'repeat',
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
  gradientEnd: '#DD2476',   // Gradient end (primary dark)
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

  // Track app state to refresh location when app comes to foreground
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground, refresh location
      getCurrentLocation(LocationPriority.SAVED_COORDS);
    }
    setAppState(nextAppState);
  }, [appState]);

  const saveAddressDetails = async (addressData: {
    id?: string;
    full_address: string;
    home_type?: string;
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
        await saveAddressDetails({
          id: response.data.id.toString(),
          full_address: response.data.full_address,
          home_type: response.data.home_type,
          latitude: lat.toString(),
          longitude: lng.toString(),
        });
        
        updateLocationState(
          response.data.full_address,
          { lat, lng },
          { 
            homeType: response.data.home_type || 'Delivering to',
            addressId: response.data.id.toString()
          }
        );
        return true;
      }
      
      // If no address found in database, save the current coordinates and address
      const currentAddress = await getAddressFromCoordinates(lat, lng);
      await saveAddressDetails({
        full_address: currentAddress,
        latitude: lat.toString(),
        longitude: lng.toString(),
        home_type: 'Delivering to'
      });
      
      updateLocationState(
        currentAddress,
        { lat, lng },
        { homeType: 'Delivering to' }
      );
      
      return false;
    } catch (error) {
      console.error('Error checking location in database:', error);
      return false;
    }
  };

  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await Geocoder.from(lat, lng);
      if (response.results && response.results.length > 0) {
        // For iOS, use formatted_address directly
        return response.results[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Unknown location';
    }
  };

  const checkLocationEnabled = async (): Promise<boolean> => {
    try {
      if (isIOS) {
        // iOS-specific check
        return new Promise((resolve) => {
          Geolocation.getCurrentPosition(
            () => resolve(true),
            (error) => {
              // Error code 1 means permission denied, 2 means position unavailable, 3 means timeout
              if (error.code === 1 || error.code === 2) {
                resolve(false);
              } else {
                resolve(true); // Other errors might be temporary
              }
            },
            { 
              enableHighAccuracy: false, 
              timeout: 3000, 
              maximumAge: 10000 
            }
          );
        });
      } else {
        // Android: try to get a quick location fix
        return new Promise((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve(false); // Timeout means location services might be disabled
          }, 3000);
          
          Geolocation.getCurrentPosition(
            () => {
              clearTimeout(timeoutId);
              resolve(true);
            },
            (error) => {
              clearTimeout(timeoutId);
              // Specific error codes that indicate location services might be disabled
              if (error.code === 2 || error.code === 3) {
                resolve(false);
              } else {
                resolve(true); // Other errors might be permission-related
              }
            },
            { 
              enableHighAccuracy: false, 
              timeout: 2500, 
              maximumAge: 10000 
            }
          );
        });
      }
    } catch (error) {
      console.error('Error checking location services:', error);
      return true; // Default to enabled to avoid blocking the flow
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'ios') {
      // For iOS - use a simpler approach that works with available methods
      return new Promise((resolve) => {
        // Try to get current position - if it works, we have permission
        Geolocation.getCurrentPosition(
          () => {
            // Success means we have permission
            resolve(true);
          },
          (error) => {
            if (error.code === 1) {
              // Permission denied
              resolve(false);
            } else {
              // Other error - try to request permission
              // Use a direct approach since getAuthorizationStatus might not be available
              navigator.geolocation.requestAuthorization(
                () => {
                  // Permission granted callback
                  resolve(true);
                },
                () => {
                  // Permission denied callback
                  resolve(false);
                }
              );
            }
          },
          { 
            enableHighAccuracy: false, 
            timeout: 5000, 
            maximumAge: 60000 
          }
        );
      });
    } else {
      // Android implementation
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      
      if (hasPermission) {
        return true;
      }

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
    }
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
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
        // Check if location services are enabled
        const locationEnabled = await checkLocationEnabled();
        if (!locationEnabled) {
          updateLocationState(
            'Location services disabled',
            null,
            { error: 'Location services disabled', showEnableLocationPrompt: true }
          );
          return;
        }

        // Check and request permission
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          updateLocationState(
            'Location permission required',
            null,
            { error: 'Location permission required', showPermissionPrompt: true }
          );
          return;
        }

        // Get current position with platform-specific settings
        const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            resolve,
            (error) => {
              // Handle platform-specific errors
              if (isIOS) {
                if (error.code === 1) {
                  error.message = 'Location permission denied';
                } else if (error.code === 2) {
                  error.message = 'Location unavailable. Please check your network connection';
                } else if (error.code === 3) {
                  error.message = 'Location request timed out. Please try again';
                }
              } else {
                if (error.code === 2) {
                  error.message = 'Unable to determine location. Please check your network connection';
                } else if (error.code === 3) {
                  error.message = 'Location request timed out. Please try again';
                } else if (error.code === 1) {
                  error.message = 'Location permission denied';
                }
              }
              reject(error);
            },
            {
              enableHighAccuracy: isIOS ? true : false, // Use high accuracy for iOS
              timeout: isIOS ? 15000 : 30000, // Shorter timeout for iOS
              maximumAge: 10000,
              distanceFilter: 50,
              // iOS-specific options
              ...(isIOS && {
                accuracy: {
                  android: 'balanced',
                  ios: 'best',
                },
              }),
            }
          );
        });

        const { latitude, longitude } = position.coords;
        
        const foundInDB = await checkLocationInDatabase(latitude, longitude);
        if (foundInDB) return;

        const address = await getAddressFromCoordinates(latitude, longitude);
        await saveAddressDetails({
          full_address: address,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          home_type: 'Delivering to'
        });
        
        updateLocationState(
          address,
          { lat: latitude, lng: longitude },
          { homeType: 'Delivering to' }
        );
        return;
      }

      // Fallback to default location if everything else fails
      const defaultCoords = { lat: 0, lng: 0 }; // You might want to set a default location
      updateLocationState(
        'Select delivery location',
        defaultCoords,
        { error: 'Please select a delivery location' }
      );
      
    } catch (error: any) {
      console.error('Location error:', error);
      let errorMessage = 'Error getting location';
      let promptForEnable = false;
      let promptForPermission = false;
      
      if (error.code === 2 || error.code === 3) {
        errorMessage = error.message || 'Location unavailable';
        promptForEnable = true;
      } else if (error.code === 1) {
        errorMessage = 'Location permission denied';
        promptForPermission = true;
      } else if (error.message?.includes('disabled')) {
        errorMessage = 'Location services disabled';
        promptForEnable = true;
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

      // Only fallback to DEFAULT if we were trying to get current location
      if (priority === LocationPriority.CURRENT_LOCATION) {
        await getCurrentLocation(LocationPriority.DEFAULT);
      }
    }
  }, []);

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
              if (isIOS) {
                await Linking.openURL('app-settings:');
              } else {
                // Open location settings directly on Android
                await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
              }
            } catch (error) {
              console.error('Error opening settings:', error);
              // Fallback
              await Linking.openSettings();
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
                        if (isIOS) {
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
    // Always allow navigation to AddressScreen even if location data is not available
    navigation.navigate('AddressScreen', {
      prevLocation: "HomeTabs",
      currentLocation: location.coords ? {
        latitude: location.coords.lat,
        longitude: location.coords.lng
      } : null,
      currentAddress: location.address || 'Select delivery location',
      onAddressSelect: (selectedAddressObj) => {
        const raw = selectedAddressObj.rawAddress;

        // Update UI
        updateLocationState(
          raw.full_address,
          {
            lat: parseFloat(raw.latitude),
            lng: parseFloat(raw.longitude),
          },
          { 
            homeType: raw.home_type || 'Delivering to',
            addressId: String(raw.id) || null
          }
        );

        // Save address details
        (async () => {
          try {
            await saveAddressDetails({
              id: String(raw.id),
              full_address: raw.full_address,
              home_type: raw.home_type || 'Delivering to',
              latitude: raw.latitude,
              longitude: raw.longitude,
            });
          } catch (error) {
            console.error('Error saving selected address:', error);
          }
        })();
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
                color={COLORS.background} 
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
        name="Reorder" 
        component={ReorderScreen} 
        options={{ 
          tabBarLabel: 'Reorder',
          tabBarTestID: 'reorder-tab',
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
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={COLORS.primaryDark} 
      />
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
                borderBottomWidth: 0,
                height: HEADER_HEIGHT,
                paddingTop: HEADER_PADDING_TOP,
                elevation: 0,
                shadowOpacity: 0,
              },
            ],
            headerShadowVisible: false,
            headerTitleStyle: {
              color: COLORS.background,
            },
          }}
        />
      </Stack.Navigator>
    </>
  );
};

const styles = StyleSheet.create({
  sceneContainer: {
    flex: 1,
    paddingBottom: isSmallDevice ? 10 : 20,
  },
  header: {
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: isIOS ? (isSmallDevice ? 20 : 0) : (isSmallDevice ? 10 : 0),
    height: isIOS ? (isSmallDevice ? 64 : 80) : (isSmallDevice ? 58 : 64),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0,
    borderRadius: isIOS ? 0 : 0, // Rounded corners only on iOS
  },
  tabLabel: {
    fontSize: isIOS ? (isSmallDevice ? 11 : 12) : (isSmallDevice ? 10 : 11),
    fontWeight: '600',
    paddingBottom: isIOS ? (isSmallDevice ? 4 : 6) : (isSmallDevice ? 2 : 4),
  },
  tabIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: isIOS ? 2 : 0,
    paddingTop: isIOS ? 0 : (isSmallDevice ? 4 : 6),
  },
  tabIndicator: {
    position: 'absolute',
    bottom: isIOS ? (isSmallDevice ? -6 : -8) : (isSmallDevice ? -4 : -6),
    width: 6,
    height: 10,
    borderRadius: 3,
  },
  addressHeader: {
    flexDirection: 'column',
    paddingLeft: 16,
    paddingTop: isIOS ? 8 : 4, // Increased padding to better position in taller header
    maxWidth: isIOS ? (isSmallDevice ? 220 : 240) : (isSmallDevice ? 200 : 220),
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4, // Increased spacing between lines for taller header
  },
  addressLabel: {
    fontSize: isIOS ? (isSmallDevice ? 13 : 14) : (isSmallDevice ? 12 : 13), // Slightly larger font
    fontWeight: '600',
    marginLeft: 6,
    marginTop: isIOS ? 0 : 2,
  },
  addressText: {
    fontSize: isIOS ? (isSmallDevice ? 13 : 14) : (isSmallDevice ? 12 : 13), // Slightly larger font
    marginLeft: 6,
    maxWidth: isIOS ? (isSmallDevice ? 160 : 180) : (isSmallDevice ? 140 : 160),
  },
});

export default HomeTabs;