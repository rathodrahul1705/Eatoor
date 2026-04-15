// services/UPIPaymentService.js
import { Platform, Linking, Alert } from 'react-native';
import { getPaymentMethods } from '../../../../api/payment';

/**
 * UPI Payment Service - Generic service to handle all UPI payment apps
 * Supports: Paytm, PhonePe, Google Pay, BHIM, CRED, WhatsApp Pay, Amazon Pay
 */

export const WALLET_APPS = {
  eatoormoney: {
    id: "eatoor_money",
    name: 'Eatoor Money',
    icon: 'restaurant-outline',
    isActive: true,
  },
}

// Default UPI Apps Configuration (fallback if API fails)
export const DEFAULT_UPI_APPS = {
  paytm: {
    id: "paytm",
    name: "Paytm",
    packageName: "net.one97.paytm",
    scheme: "paytm://upi/pay?",
    iosScheme: "paytm://upi/pay?",
    priority: 1
  },
  phonepe: {
    id: "phonepe",
    name: "PhonePe",
    packageName: "com.phonepe.app",
    scheme: "phonepe://upi/pay?",
    iosScheme: "phonepe://upi/pay?",
    priority: 2
  },
  googlepay: {
    id: "googlepay",
    name: "Google Pay",
    packageName: "com.google.android.apps.nbu.paisa.user",
    scheme: "gpay://upi/pay?",
    iosScheme: "gpay://upi/pay?",
    priority: 3
  },
  cred: {
    id: "cred",
    name: "CRED",
    packageName: "com.cred.club",
    scheme: "credpay://upi/pay?",
    iosScheme: "credpay://upi/pay?",
    priority: 4
  },
  bhim: {
    id: "bhim",
    name: "BHIM",
    packageName: "in.org.npci.upiapp",
    scheme: "bhim://upi/pay?",
    iosScheme: "bhim://upi/pay?",
    priority: 5
  },
  whatsapp: {
    id: "whatsapp",
    name: "WhatsApp Pay",
    packageName: "com.whatsapp",
    scheme: "whatsapp://pay?",
    iosScheme: "whatsapp://pay?",
    priority: 6
  },
  amazonpay: {
    id: "amazonpay",
    name: "Amazon Pay",
    packageName: "in.amazon.mShop.android.shopping",
    scheme: "amazonpay://upi/pay?",
    iosScheme: "amazonpay://upi/pay?",
    priority: 7
  },
};

// Payment method types
export const PAYMENT_METHODS = {
  UPI: 'upi',
  WALLET: 'wallet',
  NETBANKING: 'netbanking',
  CARD: 'card',
  COD: 'cod'
};

let cachedPaymentMethods = null;

/**
 * Fetch payment methods from API
 * @returns {Promise<Object>} - Returns payment methods data
 */
export const fetchPaymentMethods = async () => {
  try {
    const response = await getPaymentMethods();
    if (response?.status == 200 && response?.data) {
      cachedPaymentMethods = response.data;
      return response.data.data;
    }
    throw new Error('Invalid response from API');
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
};

/**
 * Get UPI apps from API response
 * @returns {Array} - Returns array of UPI apps from API
 */
export const getUPIAppsFromAPI = () => {
  if (cachedPaymentMethods.data?.upi_apps) {
    return cachedPaymentMethods?.data?.upi_apps;
  }
  return [];
};

/**
 * Get wallets from API response
 * @returns {Array} - Returns array of wallets from API
 */
export const getWalletsFromAPI = () => {
  if (cachedPaymentMethods?.data?.wallets) {
    return cachedPaymentMethods?.data?.wallets;
  }
  return [];
};

/**
 * Get netbanking data from API response
 * @returns {Object} - Returns netbanking data
 */
export const getNetbankingFromAPI = () => {
  if (cachedPaymentMethods?.data?.netbanking) {
    return cachedPaymentMethods?.data?.netbanking;
  }
  return null;
};

/**
 * Get cards data from API response
 * @returns {Object} - Returns cards data
 */
export const getCardsFromAPI = () => {
  if (cachedPaymentMethods?.data?.cards) {
    return cachedPaymentMethods?.data?.cards;
  }
  return null;
};

/**
 * Get COD data from API response
 * @returns {Object} - Returns COD data
 */
export const getCODFromAPI = () => {
  if (cachedPaymentMethods?.cod) {
    return cachedPaymentMethods.cod;
  }
  return null;
};

/**
 * Check if a specific UPI app is installed on the device
 * @param {Object} app - App configuration object
 * @returns {Promise<boolean>} - Returns true if app is installed
 */
export const isAppInstalled = async (app) => {
  try {
    const url = Platform.OS === 'ios' ? app.iosScheme : app.scheme;
    const canOpen = await Linking.canOpenURL(url);
    return canOpen;
  } catch (error) {
    console.error(`Error checking ${app.name}:`, error);
    return false;
  }
};

/**
 * Get list of installed UPI apps from API data
 * @returns {Promise<Array>} - Returns array of installed apps with their configurations
 */
export const getInstalledUPIApps = async () => {
  const apiApps = getUPIAppsFromAPI();
  if (apiApps.length === 0) {
    const installedApps = [];
    for (const [key, app] of Object.entries(DEFAULT_UPI_APPS)) {
      const isInstalled = await isAppInstalled(app);
      if (isInstalled) {
        installedApps.push({
          ...app,
          installed: true,
          icon: app.icon || null
        });
      }
    }
    return installedApps.sort((a, b) => a.priority - b.priority);
  }
  
  // Use API data
  const installedApps = [];
  for (const app of apiApps) {
    if (app.is_active) {
      const isInstalled = await isAppInstalled(app);
      if (isInstalled) {
        installedApps.push({
          ...app,
          installed: true
        });
      }
    }
  }
  
  return installedApps.sort((a, b) => a.priority - b.priority);
};

/**
 * Build UPI Intent URL for Android
 * @param {Object} app - App configuration
 * @param {string} intentData - Intent URI data from payment gateway
 * @param {string} fallbackUrl - Fallback URL if app not installed
 * @returns {string} - Complete intent URL
 */
const buildAndroidIntentUrl = (app, intentData, fallbackUrl) => {
  let intentUrl = `intent://pay?${intentData}`;
  intentUrl += `#Intent;scheme=upi;package=${app.packageName};`;
  
  if (fallbackUrl) {
    intentUrl += `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};`;
  }
  
  intentUrl += "end";
  return intentUrl;
};

/**
 * Open UPI app with payment intent
 * @param {Object} app - App configuration
 * @param {string} intentData - Intent URI data from payment gateway
 * @param {string} fallbackUrl - Optional fallback URL
 * @returns {Promise<boolean>} - Returns true if app opened successfully
 */
export const openUPIApp = async (app, intentData, fallbackUrl = null) => {
  try {
    if (!intentData) {
      throw new Error("Invalid UPI data received");
    }

    let url;
    
    if (Platform.OS === 'ios') {
      // iOS uses simple URL scheme
      url = `${app.iosScheme}${intentData}`;
    } else {
      // Android uses intent URL
      url = buildAndroidIntentUrl(app, intentData, fallbackUrl);
    }

    console.log(`Opening ${app.name} with URL:`, url);

    // Check if app can be opened
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    } else {
      console.log(`${app.name} is not installed`);
      return false;
    }
  } catch (error) {
    console.error(`Error opening ${app.name}:`, error);
    return false;
  }
};

/**
 * Generic function to initiate payment with any UPI app
 * @param {string} intentData - Intent URI data from payment gateway
 * @param {string} preferredAppId - Preferred app ID (optional)
 * @param {string} fallbackUrl - Fallback URL (optional)
 * @returns {Promise<Object>} - Returns result of payment initiation
 */
export const initiateUPIPayment = async (intentData, preferredAppId = null, fallbackUrl = null) => {
  try {
    // Get all installed UPI apps
    const installedApps = await getInstalledUPIApps();
    
    if (installedApps.length === 0) {
      return {
        success: false,
        error: "No UPI payment apps found on your device. Please install Paytm, PhonePe, or Google Pay."
      };
    }

    // If preferred app is specified and installed, use it
    if (preferredAppId) {
      const preferredApp = installedApps.find(app => app.id === preferredAppId);
      
      if (preferredApp) {
        const opened = await openUPIApp(preferredApp, intentData, fallbackUrl);
        return {
          success: opened,
          app: preferredApp,
          error: opened ? null : `Failed to open ${preferredApp.name}`
        };
      }
    }
    
    // Otherwise, try the first installed app (highest priority)
    const firstApp = installedApps[0];
    const opened = await openUPIApp(firstApp, intentData, fallbackUrl);
    
    return {
      success: opened,
      app: firstApp,
      error: opened ? null : "Failed to open payment app"
    };
  } catch (error) {
    console.error("UPI Payment Error:", error);
    return {
      success: false,
      error: error.message || "Failed to initiate UPI payment"
    };
  }
};

/**
 * Show app selection dialog for multiple installed UPI apps
 * @param {Array} apps - List of installed apps
 * @param {Function} onSelect - Callback when app is selected
 */
export const showAppSelectionDialog = (apps, onSelect) => {
  // This function would typically show a modal or action sheet
  // For now, we'll return the first app
  if (apps.length > 0) {
    onSelect(apps[0]);
  }
};

/**
 * Validate UPI intent data
 * @param {string} intentData - Intent data to validate
 * @returns {boolean} - Returns true if valid
 */
export const validateIntentData = (intentData) => {
  if (!intentData || typeof intentData !== 'string') return false;
  
  // Basic validation - should contain UPI parameters
  const requiredParams = ['pa=', 'pn=', 'am='];
  return requiredParams.some(param => intentData.includes(param));
};

/**
 * Get all payment methods with their status
 * @returns {Promise<Object>} - Returns all payment methods with their data
 */
export const getAllPaymentMethods = async () => {
  try {

    const methods = await fetchPaymentMethods();
    const installedUPIApps = await getInstalledUPIApps();
      
    return {
      upi: {
        isActive: methods.upi_apps?.some(app => app.is_active) || false,
        apps: installedUPIApps,
      },
      wallets: {
        isActive: methods.wallets?.some(wallet => wallet.is_active) || false,
        wallets: methods.wallets || []
      },
      netbanking: {
        isActive: methods.netbanking?.is_active || false,
        data: methods.netbanking || null
      },
      cards: {
        isActive: methods.cards?.is_active || false,
        data: methods.cards || null
      },
      cod: {
        isActive: methods.cod?.is_active || false,
        data: methods.cod || null
      }
    };
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return {
      upi: { isActive: false, apps: [], allApps: [] },
      wallets: { isActive: false, wallets: [] },
      netbanking: { isActive: false, data: null },
      cards: { isActive: false, data: null },
      cod: { isActive: false, data: null }
    };
  }
};