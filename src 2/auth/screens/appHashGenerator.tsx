// utils/appHashUtils.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { storeDeviceDetails } from '../../api/hash';

// Fallback hash when SMS retriever fails
const FALLBACK_APP_HASH = 'ABCD1234EFG';

/**
 * Generate a stable device ID
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem('device_id');

    if (!deviceId) {
      deviceId =
        Platform.OS === 'android'
          ? await DeviceInfo.getAndroidId()
          : DeviceInfo.getUniqueId();

      if (!deviceId || deviceId === 'unknown') {
        deviceId = `device_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
      }

      await AsyncStorage.setItem('device_id', deviceId);
      console.log('Device ID generated:', deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    const fallbackId = `fallback_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    await AsyncStorage.setItem('device_id', fallbackId);
    return fallbackId;
  }
};

/**
 * Get device info + stored FCM token
 */
export const getDeviceInfo = async () => {
  try {
    const deviceId = await getDeviceId();
    const fcmToken = await AsyncStorage.getItem('fcm_token');

    return {
      deviceId,
      fcmToken,
      deviceModel: DeviceInfo.getModel(),
      deviceManufacturer: await DeviceInfo.getManufacturer(),
      appVersion: DeviceInfo.getVersion(),
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return {
      deviceId: `error_${Date.now()}`,
      fcmToken: null,
      deviceModel: 'unknown',
      deviceManufacturer: 'unknown',
      appVersion: 'unknown',
    };
  }
};

/**
 * Send hash + device details to backend using storeDeviceDetails()
 */
export const sendAppHashToBackend = async (
  appHash: string,
  contactNumber?: string
): Promise<boolean> => {
  try {
    const { deviceId, fcmToken, deviceModel, deviceManufacturer, appVersion } =
      await getDeviceInfo();

    const payload = {
      app_hash: appHash,
      platform: Platform.OS as 'android' | 'ios',
      contact_number: contactNumber,
      device_id: deviceId,
      fcm_token: fcmToken,
      device_model: deviceModel,
      device_manufacturer: deviceManufacturer,
      app_version: appVersion,
    };

    console.log('Sending via storeDeviceDetails():', {
      ...payload,
      app_hash: appHash.substring(0, 6) + '...',
    });

    const response = await storeDeviceDetails(payload);

    if (response?.data) {
      console.log('App hash stored successfully.');
      return true;
    }

    console.warn('storeDeviceDetails() did not return data');
    return false;
  } catch (error) {
    console.error('Error sending app hash:', error);
    return false;
  }
};

/**
 * Get hash using SMS Retriever API on Android
 */
export const getAppHash = async (contactNumber?: string): Promise<string> => {
  if (Platform.OS !== 'android') return FALLBACK_APP_HASH;

  try {
    const SmsRetriever = require('react-native-sms-retriever');

    let appHash: string;

    if (SmsRetriever.default?.getAppHash) {
      appHash = await SmsRetriever.default.getAppHash();
    } else if (SmsRetriever.getAppHash) {
      appHash = await SmsRetriever.getAppHash();
    } else {
      throw new Error('SMS Retriever: getAppHash() not available');
    }

    console.log('App hash retrieved:', appHash);

    if (!appHash || appHash.length < 5) {
      throw new Error('Invalid app hash received');
    }

    await sendAppHashToBackend(appHash, contactNumber);

    return appHash;
  } catch (error) {
    console.error('Error retrieving real hash:', error);

    const fallbackHash = await generateAppHashSignature();
    await sendAppHashToBackend(fallbackHash, contactNumber);
    return fallbackHash;
  }
};

/**
 * Generate fallback hash (for emulator or API failure)
 */
export const generateAppHashSignature = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem('app_hash_signature');
    if (stored) return stored;

    const appIdentifier = 'com.eatoor';
    const raw = btoa(appIdentifier + Date.now());
    const finalHash = raw.substring(0, 11).replace(/[^a-zA-Z0-9]/g, '');

    await AsyncStorage.setItem('app_hash_signature', finalHash);

    console.log('Generated fallback hash:', finalHash);
    return finalHash;
  } catch (error) {
    console.error('Error generating fallback hash:', error);
    return FALLBACK_APP_HASH;
  }
};

/**
 * Initialize app hash (first time in app)
 */
export const initializeAppHash = async (
  contactNumber?: string
): Promise<string> => {
  try {
    let appHash;

    try {
      appHash = await getAppHash(contactNumber);
    } catch {
      console.log('Real hash failed → using fallback');
      appHash = await generateAppHashSignature();
      await sendAppHashToBackend(appHash, contactNumber);
    }

    if (appHash) {
      await AsyncStorage.setItem('app_hash', appHash);
      await AsyncStorage.setItem('app_hash_initialized', 'true');

      console.log('App hash initialized:', appHash);
      return appHash;
    }

    return FALLBACK_APP_HASH;
  } catch (error) {
    console.error('Error initializing hash:', error);
    return FALLBACK_APP_HASH;
  }
};

/**
 * Helpers
 */
export const getStoredAppHash = async () =>
  (await AsyncStorage.getItem('app_hash')) || FALLBACK_APP_HASH;

export const isAppHashInitialized = async () =>
  (await AsyncStorage.getItem('app_hash_initialized')) === 'true';

export default {
  getDeviceId,
  getDeviceInfo,
  getAppHash,
  generateAppHashSignature,
  initializeAppHash,
  getStoredAppHash,
  isAppHashInitialized,
  sendAppHashToBackend,
};