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
const isIOS = Platform.OS === 'ios';

// Header height values optimized for all devices
const HEADER_HEIGHT = isIOS ? (isSmallDevice ? 100 : 120) : (isSmallDevice ? 70 : 80);
const HEADER_PADDING_TOP = isIOS ? (isSmallDevice ? 30 : 40) : 0;

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
  gradientStart: '#FF6B35',    // Primary orange
  gradientMiddle: '#FF512F',   // Intermediate orange
  gradientEnd: '#DD2476',      // Primary dark with pink tone
  // Additional gradient variations
  gradientLight: '#FF9F5B',    // Light orange
  gradientDark: '#E65C00',     // Dark orange
};

// Storage keys for consistency
const STORAGE_KEYS = {
  ADDRESS_ID: 'AddressId',
  STREET_ADDRESS: 'StreetAddress',
  HOME_TYPE: 'HomeType',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
};

// Enhanced ProfileButton component with better touch handling
const EnhancedProfileButton = () => {
  const navigation = useNavigation();
  
  const handleProfilePress = useCallback(() => {
    console.log('Profile button pressed - navigating to ProfileScreen');
    navigation.navigate('ProfileScreen' as never);
  }, [navigation]);

  return (
    <TouchableOpacity
      onPress={handleProfilePress}
      style={styles.profileButton}
      activeOpacity={0.7}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
    >
      <Animatable.View
        animation="pulse"
        duration={500}
        useNativeDriver
      >
        <Icon 
          name="person-circle-outline" 
          size={32} 
          color={COLORS.background} 
        />
      </Animatable.View>
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

      // If no saved details, proceed with location detection
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

      // Get current position
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
            enableHighAccuracy: isIOS ? true : false,
            timeout: isIOS ? 15000 : 30000,
            maximumAge: 10000,
            distanceFilter: 50,
          }
        );
      });

      const { latitude, longitude } = position.coords;
      
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
              if (isIOS) {
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
      getCurrentLocation();
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
    } as never);
  }, [navigation, location.coords, location.address]);

  return (
    <TouchableOpacity
      style={styles.addressHeader}
      onPress={handleAddressPress}
      activeOpacity={0.7}
      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
    >
      <View style={styles.addressLine}>
         <Icon
            name={"navigate"} 
            size={14} 
            color={location.error ? COLORS.error : COLORS.background} 
          />
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
          <Icon name={location.error ? "warning-outline" : "location-outline"}  size={15} color={COLORS.background} />
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
            onPress={(e) => {
              e.stopPropagation();
              handleRefreshLocation();
            }} 
            style={styles.refreshButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Animatable.View 
              animation="pulse" 
              iterationCount={1}
              duration={500}
              useNativeDriver
            >
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
      <Stack.Navigator>
        <Stack.Screen
          name="HomeTabs"
          component={HomeTabsNavigator}
          options={{
            headerTitle: '',
            headerLeft: () => <AddressHeaderLeft />,
            headerRight: () => <EnhancedProfileButton />,
            headerBackground: () => (
              <LinearGradient
                colors={[COLORS.gradientStart, COLORS.gradientMiddle, COLORS.gradientEnd]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                locations={[0, 0.5, 1]}
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
            // Improved header configuration for better touch handling
            headerLeftContainerStyle: styles.headerLeftContainer,
            headerRightContainerStyle: styles.headerRightContainer,
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
    borderBottomWidth: 0,
  },
  // Improved container styles for better touch handling
  headerLeftContainer: {
    paddingLeft: isIOS ? 16 : 16,
    paddingRight: isIOS ? 0 : 16,
    zIndex: 999,
    elevation: 999,
  },
  headerRightContainer: {
    paddingRight: isIOS ? 16 : 16,
    paddingLeft: isIOS ? 0 : 16,
    zIndex: 999,
    elevation: 999,
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
    zIndex: 1000,
    elevation: 1000,
  },
  tabBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: isIOS ? (isSmallDevice ? 20 : 0) : (isSmallDevice ? 10 : 0),
    height: isIOS ? (isSmallDevice ? 64 : 80) : (isSmallDevice ? 58 : 64),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    paddingHorizontal: 10,
    borderTopWidth: 0,
    borderRadius: isIOS ? 0 : 0,
    zIndex: 100,
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
  addressHeader: {
    flexDirection: 'column',
    paddingLeft: isIOS ? 0 : 0,
    paddingTop: isIOS ? 8 : 4,
    maxWidth: isIOS ? (isSmallDevice ? 220 : 240) : (isSmallDevice ? 200 : 220),
    minHeight: 50,
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressLabel: {
    fontSize: isIOS ? (isSmallDevice ? 13 : 14) : (isSmallDevice ? 12 : 15),
    fontWeight: '900',
    marginLeft: 6,
    marginTop: isIOS ? 0 : 2,
  },
  addressText: {
    fontSize: isIOS ? (isSmallDevice ? 13 : 14) : (isSmallDevice ? 12 : 11),
    marginLeft: 6,
    maxWidth: isIOS ? (isSmallDevice ? 160 : 180) : (isSmallDevice ? 140 : 160),
    flexShrink: 1,
  },
  refreshButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default HomeTabs;