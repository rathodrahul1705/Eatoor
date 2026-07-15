import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ADDRESS_ID: 'AddressId',
  STREET_ADDRESS: 'StreetAddress',
  HOME_TYPE: 'HomeType',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  IS_ADDRESS_MANUAL: 'IsAddressManual',
};

export const saveAddressDetails = async (addressData: {
  id?: string | number;
  full_address: string;
  home_type?: string;
  latitude: string | number;
  longitude: string | number;
}) => {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEYS.ADDRESS_ID, String(addressData.id ?? '')],
      [STORAGE_KEYS.STREET_ADDRESS, addressData.full_address],
      [STORAGE_KEYS.HOME_TYPE, addressData.home_type || 'Home'],
      [STORAGE_KEYS.LATITUDE, String(addressData.latitude)],
      [STORAGE_KEYS.LONGITUDE, String(addressData.longitude)],
    ]);
  } catch (error) {
    console.error('Error saving address details:', error);
  }
};

export const getSavedAddressDetails = async () => {
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
        homeType: savedHomeType || 'Home',
        coords: {
          lat: parseFloat(savedLat),
          lng: parseFloat(savedLng),
        },
        addressId: savedAddressId,
      };
    }
    return {
      address: '',
      homeType: 'Home',
      coords: null,
      addressId: null,
    };
  } catch (error) {
    console.error('Error getting saved address:', error);
    return {
      address: '',
      homeType: 'Home',
      coords: null,
      addressId: null,
    };
  }
};

export const clearAddressDetails = async () => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ADDRESS_ID,
      STORAGE_KEYS.STREET_ADDRESS,
      STORAGE_KEYS.HOME_TYPE,
      STORAGE_KEYS.LATITUDE,
      STORAGE_KEYS.LONGITUDE,
      STORAGE_KEYS.IS_ADDRESS_MANUAL,
    ]);
  } catch (error) {
    console.error('Error clearing address details:', error);
  }
};

export const setAddressManual = async (manual: boolean) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.IS_ADDRESS_MANUAL, String(manual));
  } catch (error) {
    console.error('Error saving address manual flag:', error);
  }
};

export const getAddressManual = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.IS_ADDRESS_MANUAL);
    return value === 'true';
  } catch (error) {
    console.error('Error getting address manual flag:', error);
    return false;
  }
};