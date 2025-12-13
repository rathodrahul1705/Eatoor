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
  SafeAreaView,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import KitchenScreen from './KitchenScreen';
import PartnerScreen from './PartnerScreen';
import EatmartScreen from '../../../eatmart/EatmartScreen';
import ProfileButton from '../../components/ProfileButton';
import ReorderScreen from '../../screens/home/ReorderScreen';
import { HomeStackParamList, HomeTabParamList } from '../../../types/navigation.d';
import Config from 'react-native-config';
import { getUserAddress } from '../../../api/address';

Icon.loadFont();

const Tab = createBottomTabNavigator<HomeTabParamList>();
const Stack = createNativeStackNavigator<HomeStackParamList>();

// Get screen dimensions
const { width, height } = Dimensions.get('window');
const isSmallDevice = height < 700;

// Improved header height values for better cross-platform compatibility
const HEADER_HEIGHT = Platform.select({
  ios: isSmallDevice ? 100 : 120,
  android: isSmallDevice ? 70 : 80,
  default: 80,
});

const HEADER_PADDING_TOP = Platform.select({
  ios: isSmallDevice ? 30 : 40,
  android: 0,
  default: 0,
});

// Define the tabs that actually exist in your app
type AppTabs = 'Kitchen' | 'Eatmart' | 'Reorder' | 'Partner';

// Tab icons for normal and focused states
const tabIcons: Record<AppTabs, string> = {
  Kitchen: 'fast-food-outline',
  Eatmart: 'restaurant-outline',
  Reorder: 'repeat-outline',
  Partner: 'people-outline',
};

const tabIconsFocused: Record<AppTabs, string> = {
  Kitchen: 'fast-food',
  Eatmart: 'restaurant',
  Reorder: 'repeat',
  Partner: 'people',
};

// Enhanced Color palette with smooth gradient colors
const COLORS = {
  primary: '#FF6B35',
  primaryDark: '#E65C00',
  primaryLight: '#FF9F5B',
  background: '#FFFFFF',
  text: '#333333',
  textLight: '#666666',
  border: '#EEEEEE',
  inactive: '#999999',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  info: '#5AC8FA',
  // Enhanced gradient colors for smooth transitions
  gradientStart: '#FF6B35',
  gradientMiddle: '#FF512F',
  gradientEnd: '#DD2476',
  // Additional gradient variations
  gradientLight: '#FF9F5B',
  gradientDark: '#E65C00',
  // Header specific colors
  headerText: '#FFFFFF',
  headerIcon: '#FFFFFF',
};

// Storage keys for consistency
const STORAGE_KEYS = {
  ADDRESS_ID: 'AddressId',
  STREET_ADDRESS: 'StreetAddress',
  HOME_TYPE: 'HomeType',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
};

// Custom Header Component - This will replace React Navigation's header
const CustomHeader = ({ children }: { children: React.ReactNode }) => {
  return (
    <LinearGradient
      colors={[COLORS.gradientStart, COLORS.gradientMiddle, COLORS.gradientEnd]}
      style={styles.customHeader}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      locations={[0, 0.5, 1]}
    >
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.headerContent}>
          {children}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

// Enhanced ProfileButton component
const EnhancedProfileButton = () => {
  const navigation = useNavigation();
  
  const handleProfilePress = useCallback(() => {
    console.log('Profile button pressed - navigating to ProfileScreen');
    navigation.navigate('ProfileScreen' as never);
  }, [navigation]);

  return (
    <TouchableOpacity
      onPress={handleProfilePress}
      activeOpacity={0.7}
      style={styles.profileButton}
    >
      <Icon 
        name="person-circle-outline" 
        size={Platform.select({ ios: 32, android: 28 })} 
        color={COLORS.headerIcon} 
      />
    </TouchableOpacity>
  );
};

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
      console.log('App came to foreground, refreshing location...');
      getCurrentLocation();
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
        [STORAGE_KEYS.ADDRESS_ID, addressData.id?.toString() || ''],
        [STORAGE_KEYS.STREET_ADDRESS, addressData.full_address],
        [STORAGE_KEYS.HOME_TYPE, addressData.home_type || 'Delivering to'],
        [STORAGE_KEYS.LATITUDE, addressData.latitude],
        [STORAGE_KEYS.LONGITUDE, addressData.longitude],
      ]);
    } catch (error) {
      console.error('Error saving address details:', error);
    }
  };

  const getSavedAddressDetails = async (): Promise<{
    address: string;
    homeType: string;
    coords: { lat: number; lng: number } | null;
    addressId: string | null;
  }> => {
    try {
      const [savedAddress, savedHomeType, savedLat, savedLng, savedAddressId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STREET_ADDRESS),
        AsyncStorage.getItem(STORAGE_KEYS.HOME_TYPE),
        AsyncStorage.getItem(STORAGE_KEYS.LATITUDE),
        AsyncStorage.getItem(STORAGE_KEYS.LONGITUDE),
        AsyncStorage.getItem(STORAGE_KEYS.ADDRESS_ID),
      ]);

      if (savedAddress && savedLat && savedLng) {
        return {
          address: savedAddress,
          homeType: savedHomeType || 'Delivering to',
          coords: {
            lat: parseFloat(savedLat),
            lng: parseFloat(savedLng),
          },
          addressId: savedAddressId,
        };
      }
      return {
        address: '',
        homeType: 'Delivering to',
        coords: null,
        addressId: null,
      };
    } catch (error) {
      console.error('Error getting saved address details:', error);
      return {
        address: '',
        homeType: 'Delivering to',
        coords: null,
        addressId: null,
      };
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

      const addressData = response?.data;
      if (!addressData) {
        console.warn("No address data found for given location.");
        return false;
      }

      const { id, full_address, home_type } = addressData;
      const isExisting = Boolean(id);

      // Save address (with or without id)
      await saveAddressDetails({
        id: isExisting ? id.toString() : null,
        full_address,
        home_type: home_type || "Delivering to",
        latitude: lat.toString(),
        longitude: lng.toString(),
      });

      // Update location state
      updateLocationState(
        full_address,
        { lat, lng },
        { 
          homeType: home_type || "Delivering to",
          ...(isExisting && { addressId: id.toString() }) // only add addressId if it exists
        }
      );

      return isExisting;
    } catch (error) {
      console.error("Error checking location in database:", error);
      return false;
    }
  };

  const checkLocationEnabled = async (): Promise<boolean> => {
    try {
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
    } catch (error) {
      console.error('Error checking location services:', error);
      return true; // Default to enabled to avoid blocking the flow
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        // For iOS - use a simpler approach
        return new Promise((resolve) => {
          // Try to get current position - if it works, we have permission
          Geolocation.getCurrentPosition(
            () => resolve(true),
            (error) => {
              if (error.code === 1) {
                resolve(false);
              } else {
                resolve(true); // Other errors
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

  const getCurrentLocation = useCallback(async (): Promise<void> => {
    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      // First, check if we have saved address details in local storage
      const savedDetails = await getSavedAddressDetails();
      if (savedDetails.address && savedDetails.coords) {
        console.log('Using saved address details');
        updateLocationState(
          savedDetails.address,
          savedDetails.coords,
          { 
            homeType: savedDetails.homeType,
            addressId: savedDetails.addressId
          }
        );
        return;
      }

      console.log('No saved address found, detecting location...');

      // If no saved details, proceed with location detection
      // Check if location services are enabled
      const locationEnabled = await checkLocationEnabled();
      if (!locationEnabled) {
        console.log('Location services disabled');
        updateLocationState(
          'Location services disabled',
          null,
          { error: 'Location services disabled', showEnableLocationPrompt: true }
        );
        return;
      }

      console.log('Location services enabled, checking permission...');

      // Check and request permission
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        console.log('Location permission denied');
        updateLocationState(
          'Location permission required',
          null,
          { error: 'Location permission required', showPermissionPrompt: true }
        );
        return;
      }

      console.log('Location permission granted, getting current position...');

      // Get current position
      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          (error) => {
            // Handle platform-specific errors
            if (Platform.OS === 'ios') {
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
            enableHighAccuracy: Platform.OS === 'ios',
            timeout: Platform.OS === 'ios' ? 15000 : 30000,
            maximumAge: 10000,
            distanceFilter: 50,
          }
        );
      });

      const { latitude, longitude } = position.coords;
      console.log('Location obtained:', latitude, longitude);
      
      // Only save to AsyncStorage if we have permission and valid location
      // Send coordinates to API to get address information
      await checkLocationInDatabase(latitude, longitude);
      
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
        
        // Clear any previously saved address if permission is denied
        try {
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.ADDRESS_ID,
            STORAGE_KEYS.STREET_ADDRESS,
            STORAGE_KEYS.HOME_TYPE,
            STORAGE_KEYS.LATITUDE,
            STORAGE_KEYS.LONGITUDE,
          ]);
          console.log('Cleared saved address due to permission denial');
        } catch (storageError) {
          console.error('Error clearing saved address:', storageError);
        }
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
              if (Platform.OS === 'ios') {
                await Linking.openURL('app-settings:');
              } else {
                await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
              }
            } catch (error) {
              console.error('Error opening settings:', error);
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
              console.log('Permission granted, getting location...');
              getCurrentLocation();
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

  // Handle location permission changes and auto-load when enabled
  useEffect(() => {
    const checkAndLoadLocation = async () => {
      // If location was previously disabled and now might be enabled
      if (location.error && (location.error.includes('disabled') || location.error.includes('permission'))) {
        const locationEnabled = await checkLocationEnabled();
        const hasPermission = await requestLocationPermission();
        
        if (locationEnabled && hasPermission) {
          console.log('Location services and permission now available, auto-loading location...');
          getCurrentLocation();
        }
      }
    };

    checkAndLoadLocation();
  }, [location.error]);

  // Handle auto-load when user enables location from settings
  useEffect(() => {
    if (location.showEnableLocationPrompt || location.showPermissionPrompt) {
      // Set up a listener to check for location availability when user returns from settings
      const interval = setInterval(async () => {
        const locationEnabled = await checkLocationEnabled();
        const hasPermission = await requestLocationPermission();
        
        if (locationEnabled && hasPermission) {
          console.log('Location enabled by user, auto-loading...');
          clearInterval(interval);
          getCurrentLocation();
        }
      }, 1000); // Check every second

      // Clear interval after 30 seconds to prevent infinite checking
      setTimeout(() => {
        clearInterval(interval);
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [location.showEnableLocationPrompt, location.showPermissionPrompt]);

  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, loading location...');
      getCurrentLocation();
      return () => {};
    }, [getCurrentLocation])
  );

  useEffect(() => {
    if (location.showEnableLocationPrompt) {
      console.log('Showing location enable prompt');
      showLocationSettingsAlert();
    }
  }, [location.showEnableLocationPrompt, showLocationSettingsAlert]);

  useEffect(() => {
    if (location.showPermissionPrompt) {
      console.log('Showing permission prompt');
      showPermissionAlert();
    }
  }, [location.showPermissionPrompt, showPermissionAlert]);

  const handleRefreshLocation = useCallback(() => {
    console.log('Refreshing location...');
    getCurrentLocation();
  }, [getCurrentLocation]);

  const handleAddressPress = useCallback(() => {
    console.log('Address header pressed - navigating to AddressScreen');
    // Navigation to AddressScreen
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

        // Save address details only if we have valid data
        if (raw.full_address && raw.latitude && raw.longitude) {
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
      }
    } as never);
  }, [navigation, location.coords, location.address]);

  return (
    <TouchableOpacity
      onPress={handleAddressPress}
      activeOpacity={0.7}
      style={styles.addressContainer}
    >
      <View style={styles.addressRow}>
        <Icon
          name="navigate" 
          size={Platform.select({ ios: 14, android: 12 })} 
          color={location.headerIcon ? COLORS.headerIcon : COLORS.headerIcon} 
        />
        <Text style={[styles.addressLabel, { color: COLORS.headerText }]}>
          {location.homeType}
        </Text>
        <Icon 
          name="chevron-down" 
          size={Platform.select({ ios: 16, android: 14 })} 
          color={COLORS.headerText} 
          style={styles.chevronIcon} 
        />
      </View>
      
      <View style={styles.addressRow}>
        {location.loading ? (
          <ActivityIndicator 
            size={Platform.select({ ios: 14, android: 'small' })} 
            color={COLORS.headerIcon} 
          />
        ) : (
          <Icon 
            name={location.error ? "warning-outline" : "location-outline"}  
            size={Platform.select({ ios: 15, android: 13 })} 
            color={location.headerIcon ? COLORS.headerIcon : COLORS.headerIcon} 
          />
        )}
        
        <Text 
          style={[
            styles.addressText, 
            { 
              color: location.headerIcon ? COLORS.headerIcon : COLORS.headerText,
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
            onPress={(e) => {
              e.stopPropagation();
              handleRefreshLocation();
            }} 
            style={styles.refreshButton}
          >
            <Icon 
              name="reload-outline" 
              size={Platform.select({ ios: 14, android: 12 })} 
              color={location.headerIcon ? COLORS.headerIcon : COLORS.headerIcon} 
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Custom Screen wrapper with custom header
const HomeScreenWithCustomHeader = () => {
  return (
    <View style={styles.fullScreen}>
      <CustomHeader>
        <View style={styles.headerRow}>
          <AddressHeaderLeft />
          <View style={styles.spacer} />
          <EnhancedProfileButton />
        </View>
      </CustomHeader>
      <View style={styles.screenContent}>
        <HomeTabsNavigator />
      </View>
    </View>
  );
};

const HomeTabsNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const routeName = route.name as AppTabs;
          const iconName = focused
            ? tabIconsFocused[routeName]
            : tabIcons[routeName];
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
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
        tabBarShowLabel: true,
      })}
      sceneContainerStyle={styles.sceneContainer}
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
    </Tab.Navigator>
  );
};

const HomeTabs = () => {
  return (
    <>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={COLORS.gradientStart} 
        translucent={false}
      />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="HomeScreen"
          component={HomeScreenWithCustomHeader}
        />
      </Stack.Navigator>
    </>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  customHeader: {
    width: '100%',
    height: HEADER_HEIGHT,
  },
  headerSafeArea: {
    flex: 1,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  spacer: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  sceneContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // Profile button - NO BACKGROUND
  profileButton: {
    // No background, no padding
  },
  
  // Tab bar styles
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.select({ ios: isSmallDevice ? 20 : 0, android: 0 }),
    height: Platform.select({ ios: isSmallDevice ? 64 : 80, android: isSmallDevice ? 58 : 64 }),
    backgroundColor: COLORS.background,
    borderTopWidth: Platform.select({ ios: 0, android: 1 }),
    borderTopColor: COLORS.border,
    paddingHorizontal: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  
  tabLabel: {
    fontSize: Platform.select({ ios: isSmallDevice ? 11 : 12, android: isSmallDevice ? 10 : 11 }),
    fontWeight: Platform.select({ ios: '600', android: '500' }),
    paddingBottom: Platform.select({ ios: isSmallDevice ? 4 : 6, android: isSmallDevice ? 2 : 4 }),
    marginTop: Platform.select({ ios: 0, android: -2 }),
  },
  
  tabIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.select({ ios: 2, android: 0 }),
    paddingTop: Platform.select({ ios: 0, android: isSmallDevice ? 4 : 6 }),
  },
  
  // Address container - NO BACKGROUND
  addressContainer: {
    maxWidth: Platform.select({ ios: isSmallDevice ? 220 : 240, android: isSmallDevice ? 200 : 220 }),
  },
  
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  
  chevronIcon: {
    marginLeft: 2,
  },
  
  addressLabel: {
    fontSize: Platform.select({ ios: isSmallDevice ? 13 : 14, android: isSmallDevice ? 12 : 13 }),
    fontWeight: Platform.select({ ios: '900', android: '700' }),
    marginLeft: 6,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  
  addressText: {
    fontSize: Platform.select({ ios: isSmallDevice ? 13 : 14, android: isSmallDevice ? 12 : 13 }),
    marginLeft: 6,
    maxWidth: Platform.select({ ios: isSmallDevice ? 160 : 180, android: isSmallDevice ? 140 : 160 }),
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  
  refreshButton: {
    marginLeft: Platform.select({ ios: 8, android: 6 }),
  },
});

export default HomeTabs;