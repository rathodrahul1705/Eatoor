import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, AppState, AppStateStatus, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserAddress } from '../../../../api/address';
import {
  saveAddressDetails,
  getSavedAddressDetails,
  clearAddressDetails,
  setAddressManual,
  getAddressManual,
} from '../../home/utils/addressStorage';
import { getSessionId } from '../../../../utlis/utils';

// Serviceable cities config
interface ServiceableCity {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

const SERVICEABLE_CITIES: ServiceableCity[] = [
  { name: 'Thane', lat: 19.2183, lng: 72.9781, radiusKm: 15 },
];

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const isLocationServiceable = (lat: number, lng: number): boolean => {
  if (!lat || !lng) return false;
  for (const city of SERVICEABLE_CITIES) {
    const distance = haversineDistance(lat, lng, city.lat, city.lng);
    if (distance <= city.radiusKm) return true;
  }
  return false;
};

interface LocationData {
  address: string;
  loading: boolean;
  error: string | null;
  coords: { lat: number; lng: number } | null;
  homeType: string;
  addressId: string | null;
}

interface UseLocationReturn {
  location: LocationData;
  isServiceAvailable: boolean | null;
  isManualAddress: boolean | null;
  updateAddress: (rawAddress: any) => Promise<void>;
  refreshLocation: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  showLocationSettingsAlert: () => void;
  showPermissionAlert: () => void;
  // NEW: force a fresh GPS fetch, ignoring saved/manual address
  fetchCurrentLocationForce: () => Promise<void>;
}

export const useLocation = (
  isGuest: boolean,
  onAddressUpdate?: (address: string, homeType: string, lat?: number, lng?: number) => void
): UseLocationReturn => {
  const [location, setLocation] = useState<LocationData>({
    address: 'Select location',
    loading: true,
    error: null,
    coords: null,
    homeType: 'Home',
    addressId: null,
  });
  const [isServiceAvailable, setIsServiceAvailable] = useState<boolean | null>(null);
  const [isManualAddress, setIsManualAddress] = useState<boolean | null>(null);

  const [appState, setAppState] = useState(AppState.currentState);
  const hasShownLocationAlert = useRef(false);
  const hasShownPermissionAlert = useRef(false);
  const isMounted = useRef(true);
  const skipNextLocationFetch = useRef(false);
  // NEW: force GPS fetch flag
  const forceFetchRef = useRef(false);

  // Load manual flag on mount
  useEffect(() => {
    const loadManualFlag = async () => {
      const manual = await getAddressManual();
      setIsManualAddress(manual);
    };
    loadManualFlag();
  }, []);

  // Check if location exists in database
  const checkLocationInDatabase = useCallback(async (lat: number, lng: number): Promise<boolean> => {
    try {
      const response = await getUserAddress({
        lat: lat.toString(),
        long: lng.toString(),
        isGuest,
      });

      const addressData = response?.data;
      if (!addressData) return false;

      console.log("addressData====",addressData)
      
      const { id, full_address, home_type } = addressData;
      const isExisting = Boolean(id);

      await saveAddressDetails({
        id: isExisting ? id.toString() : undefined,
        full_address,
        home_type: home_type || "Home",
        latitude: lat.toString(),
        longitude: lng.toString(),
      });

      // GPS‑based address → not manual
      await setAddressManual(false);

      if (isMounted.current) {
        setLocation(prev => ({
          ...prev,
          address: full_address,
          coords: { lat, lng },
          homeType: home_type || "Home",
          addressId: isExisting ? id.toString() : null,
          loading: false,
          error: null,
        }));
        setIsServiceAvailable(isLocationServiceable(lat, lng));
      }

      if (onAddressUpdate) {
        onAddressUpdate(full_address, home_type || "Home", lat, lng);
      }

      hasShownLocationAlert.current = false;
      hasShownPermissionAlert.current = false;

      return isExisting;
    } catch (error) {
      console.error("Error checking location:", error);
      return false;
    }
  }, [isGuest, onAddressUpdate]);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          () => resolve(true),
          (error) => {
            console.log('iOS location error:', error);
            if (error.code === 1) resolve(false);
            else resolve(true);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    } else {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (hasPermission) return true;

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission Required',
            message: 'Eatoor needs access to your location to show nearby restaurants and provide accurate delivery estimates.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
            buttonNeutral: 'Ask Me Later',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.error('Error requesting permission:', error);
        return false;
      }
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<void> => {
    if (!isMounted.current) return;

    // NEW: If force fetch is true, skip saved/manual checks and go straight to GPS
    const isForce = forceFetchRef.current;

    // If not forced, check for saved/manual address
    if (!isForce) {
      // If user just manually selected an address, use saved and skip GPS
      if (skipNextLocationFetch.current) {
        const savedDetails = await getSavedAddressDetails();
        if (savedDetails.address && savedDetails.coords) {
          if (isMounted.current) {
            setLocation(prev => ({
              ...prev,
              address: savedDetails.address,
              coords: savedDetails.coords,
              homeType: savedDetails.homeType,
              addressId: savedDetails.addressId,
              loading: false,
              error: null,
            }));
            setIsServiceAvailable(isLocationServiceable(savedDetails.coords.lat, savedDetails.coords.lng));
          }
          if (onAddressUpdate) {
            onAddressUpdate(savedDetails.address, savedDetails.homeType, savedDetails.coords.lat, savedDetails.coords.lng);
          }
        }
        skipNextLocationFetch.current = false;
        return;
      }

      // Check if we have a manual address flag – use saved without GPS
      const manualFlag = await getAddressManual();
      const savedDetails = await getSavedAddressDetails();
      if (manualFlag && savedDetails.address && savedDetails.coords) {
        console.log('Manual address found, using saved address without GPS fetch.');
        if (isMounted.current) {
          setLocation(prev => ({
            ...prev,
            address: savedDetails.address,
            coords: savedDetails.coords,
            homeType: savedDetails.homeType,
            addressId: savedDetails.addressId,
            loading: false,
            error: null,
          }));
          setIsServiceAvailable(isLocationServiceable(savedDetails.coords.lat, savedDetails.coords.lng));
        }
        if (onAddressUpdate) {
          onAddressUpdate(savedDetails.address, savedDetails.homeType, savedDetails.coords.lat, savedDetails.coords.lng);
        }
        return;
      }
    }

    // If we reach here, we need GPS (either forced or no saved/manual)
    // Reset force flag so subsequent calls behave normally
    forceFetchRef.current = false;

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    try {
      if (Platform.OS === 'android') {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) {
          // If forced, do NOT fallback to saved address
          if (isForce) {
            if (isMounted.current) {
              setLocation(prev => ({
                ...prev,
                address: 'Location permission denied',
                coords: null,
                error: 'Location permission required',
                loading: false,
              }));
              setIsServiceAvailable(false);
            }
            return;
          }

          // Non-forced: fallback to saved address if available
          const savedDetails = await getSavedAddressDetails();
          if (savedDetails.address && savedDetails.coords) {
            if (isMounted.current) {
              setLocation(prev => ({
                ...prev,
                address: savedDetails.address,
                coords: savedDetails.coords,
                homeType: savedDetails.homeType,
                addressId: savedDetails.addressId,
                loading: false,
                error: null,
              }));
              setIsServiceAvailable(isLocationServiceable(savedDetails.coords.lat, savedDetails.coords.lng));
            }
            if (onAddressUpdate) {
              onAddressUpdate(savedDetails.address, savedDetails.homeType, savedDetails.coords.lat, savedDetails.coords.lng);
            }
            return;
          } else {
            if (isMounted.current) {
              setLocation(prev => ({
                ...prev,
                address: 'Location permission required',
                coords: null,
                error: 'Location permission required',
                loading: false,
              }));
            }
            return;
          }
        }
      }

      console.log('Fetching current location...');
      const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
        let resolved = false;
        const timeoutId = setTimeout(() => {
          if (!resolved) reject({ code: 3, message: 'Location request timeout' });
        }, 15000);

        Geolocation.getCurrentPosition(
          (pos) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.log('Location fetched successfully:', pos.coords.latitude, pos.coords.longitude);
              resolve(pos);
            }
          },
          (error) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.log('Location error:', error.code, error.message);
              reject(error);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
            ...(Platform.OS === 'android' && {
              showLocationDialog: true,
              forceRequestLocation: true,
            }),
          }
        );
      });

      const { latitude, longitude } = position.coords;

      // Compare with saved coords (only if not forced? Actually we can still compare,
      // but if forced, we might want to always update even if same coords? We'll update anyway.)
      const savedDetails = await getSavedAddressDetails();
      const hasSavedCoords = savedDetails.coords !== null;
      const areDifferent = hasSavedCoords &&
        (Math.abs(latitude - savedDetails.coords!.lat) > 0.001 ||
         Math.abs(longitude - savedDetails.coords!.lng) > 0.001);

      if (hasSavedCoords && !areDifferent && !isForce) {
        // If not forced and coords match, use saved
        console.log('Current location matches saved address, using saved.');
        if (isMounted.current) {
          setLocation(prev => ({
            ...prev,
            address: savedDetails.address,
            coords: savedDetails.coords,
            homeType: savedDetails.homeType,
            addressId: savedDetails.addressId,
            loading: false,
            error: null,
          }));
          setIsServiceAvailable(isLocationServiceable(savedDetails.coords!.lat, savedDetails.coords!.lng));
        }
        if (onAddressUpdate) {
          onAddressUpdate(savedDetails.address, savedDetails.homeType, savedDetails.coords!.lat, savedDetails.coords!.lng);
        }
      } else {
        console.log('Location changed or no saved address, calling checkLocationInDatabase');
        await checkLocationInDatabase(latitude, longitude);
      }
    } catch (error: any) {
      console.error('Error getting location:', error);

      // If forced, do NOT fallback to saved address
      if (isForce) {
        let errorMessage = 'Unable to get location';
        if (error.code === 1) {
          errorMessage = 'Location permission denied';
        } else if (error.code === 2 || error.code === 3) {
          errorMessage = error.code === 2
            ? 'Location unavailable. Please enable GPS and move to an open area.'
            : 'Location request timed out. Please ensure GPS is enabled and try again.';
        } else {
          errorMessage = error.message || 'Unknown location error';
        }
        if (isMounted.current) {
          setLocation(prev => ({
            ...prev,
            address: errorMessage,
            coords: null,
            error: errorMessage,
            loading: false,
          }));
          setIsServiceAvailable(false);
        }
        return;
      }

      // Non-forced: fallback to saved address
      const savedDetails = await getSavedAddressDetails();
      if (savedDetails.address && savedDetails.coords) {
        console.log('GPS failed, falling back to saved address');
        if (isMounted.current) {
          setLocation(prev => ({
            ...prev,
            address: savedDetails.address,
            coords: savedDetails.coords,
            homeType: savedDetails.homeType,
            addressId: savedDetails.addressId,
            loading: false,
            error: null,
          }));
          setIsServiceAvailable(isLocationServiceable(savedDetails.coords.lat, savedDetails.coords.lng));
        }
        if (onAddressUpdate) {
          onAddressUpdate(savedDetails.address, savedDetails.homeType, savedDetails.coords.lat, savedDetails.coords.lng);
        }
        return;
      }

      let errorMessage = 'Unable to get location';
      let promptForEnable = false;
      let promptForPermission = false;

      if (error.code === 1) {
        errorMessage = 'Location permission denied';
        promptForPermission = true;
        await clearAddressDetails();
      } else if (error.code === 2 || error.code === 3) {
        errorMessage = error.code === 2
          ? 'Location unavailable. Please enable GPS and move to an open area.'
          : 'Location request timed out. Please ensure GPS is enabled and try again.';
        promptForEnable = true;
      } else {
        errorMessage = error.message || 'Unknown location error';
      }

      if (isMounted.current) {
        setLocation(prev => ({
          ...prev,
          address: errorMessage,
          coords: null,
          error: errorMessage,
          loading: false,
        }));
        if (!savedDetails.coords) {
          setIsServiceAvailable(false);
        }
      }
    }
  }, [requestLocationPermission, checkLocationInDatabase, onAddressUpdate]);

  // Update address manually (called from AddressScreen)
  const updateAddress = useCallback(async (rawAddress: any) => {
    if (!rawAddress.full_address || !rawAddress.latitude || !rawAddress.longitude) return;

    const lat = parseFloat(rawAddress.latitude);
    const lng = parseFloat(rawAddress.longitude);

    // Set manual flag and skip GPS next time
    await setAddressManual(true);
    skipNextLocationFetch.current = true;

    await saveAddressDetails({
      id: String(rawAddress.id),
      full_address: rawAddress.full_address,
      home_type: rawAddress.home_type || 'Home',
      latitude: rawAddress.latitude,
      longitude: rawAddress.longitude,
    });

    setLocation(prev => ({
      ...prev,
      address: rawAddress.full_address,
      coords: { lat, lng },
      homeType: rawAddress.home_type || 'Home',
      addressId: String(rawAddress.id),
      loading: false,
      error: null,
    }));
    setIsServiceAvailable(isLocationServiceable(lat, lng));

    if (onAddressUpdate) {
      onAddressUpdate(rawAddress.full_address, rawAddress.home_type || 'Home', lat, lng);
    }
  }, [onAddressUpdate]);

  // Alerts
  const showLocationSettingsAlert = useCallback(() => {
    Alert.alert(
      'Location Services Disabled',
      'Please enable location services to find nearby restaurants and get accurate delivery estimates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'android') {
              Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(err => {
                console.error('Failed to open location settings:', err);
                Linking.openSettings();
              });
            } else {
              Linking.openURL('app-settings:');
            }
          }
        }
      ]
    );
  }, []);

  const showPermissionAlert = useCallback(() => {
    Alert.alert(
      'Location Permission Required',
      'Eatoor needs access to your location to show nearby restaurants and provide accurate delivery estimates.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Allow',
          onPress: () => {
            requestLocationPermission().then(granted => {
              if (granted) {
                getCurrentLocation();
              } else {
                Alert.alert(
                  'Permission Denied',
                  'Please enable location permission in settings to use location-based features.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() }
                  ]
                );
              }
            });
          }
        }
      ]
    );
  }, [getCurrentLocation, requestLocationPermission]);

  // Effect to trigger alerts based on error state
  useEffect(() => {
    if (location.error?.includes('enable GPS') && !hasShownLocationAlert.current) {
      hasShownLocationAlert.current = true;
      const timer = setTimeout(showLocationSettingsAlert, 1000);
      return () => clearTimeout(timer);
    }
    if (location.error === 'Location permission required' && !hasShownPermissionAlert.current) {
      hasShownPermissionAlert.current = true;
      const timer = setTimeout(showPermissionAlert, 1000);
      return () => clearTimeout(timer);
    }
  }, [location.error, showLocationSettingsAlert, showPermissionAlert]);

  // AppState change listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, refetching location...');
        getCurrentLocation();
      }
      setAppState(nextAppState);
    });
    return () => subscription.remove();
  }, [appState, getCurrentLocation]);

  // Focus effect
  useFocusEffect(
    useCallback(() => {
      getCurrentLocation();
    }, [getCurrentLocation])
  );

  const refreshLocation = useCallback(async () => {
    await getCurrentLocation();
  }, [getCurrentLocation]);

  // NEW: Force GPS fetch
  const fetchCurrentLocationForce = useCallback(async () => {
    forceFetchRef.current = true;
    await getCurrentLocation();
  }, [getCurrentLocation]);

  return {
    location,
    isServiceAvailable,
    isManualAddress,
    updateAddress,
    refreshLocation,
    requestLocationPermission,
    showLocationSettingsAlert,
    showPermissionAlert,
    fetchCurrentLocationForce,
  };
};