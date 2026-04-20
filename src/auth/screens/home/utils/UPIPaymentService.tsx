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
  SAVED_UPI: 'saved_upi',
  WALLET: 'wallet',
  NETBANKING: 'netbanking',
  CARD: 'card',
  COD: 'cod'
};

let cachedPaymentMethods = null;
let currentUserId = null;

/**
 * Fetch payment methods from API
 * @param {string|number} userId - User ID to fetch payment methods for
 * @returns {Promise<Object>} - Returns payment methods data
 */
export const fetchPaymentMethods = async (userId) => {
  try {
    const response = await getPaymentMethods(userId);
    if (response?.status == 200 && response?.data) {
      cachedPaymentMethods = response.data;
      currentUserId = userId;
      return response.data.data;
    }
    throw new Error('Invalid response from API');
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw error;
  }
};

/**
 * Get saved UPIs from API response
 * @returns {Array} - Returns array of saved UPIs from API
 */
export const getSavedUPIsFromAPI = () => {
  if (cachedPaymentMethods?.data?.saved_upi) {
    return cachedPaymentMethods.data.saved_upi;
  }
  return [];
};

/**
 * Get UPI apps from API response
 * @returns {Array} - Returns array of UPI apps from API
 */
export const getUPIAppsFromAPI = () => {
  if (cachedPaymentMethods?.data?.upi_apps) {
    return cachedPaymentMethods.data.upi_apps;
  }
  return [];
};

/**
 * Get wallets from API response
 * @returns {Array} - Returns array of wallets from API
 */
export const getWalletsFromAPI = () => {
  if (cachedPaymentMethods?.data?.wallets) {
    return cachedPaymentMethods.data.wallets;
  }
  return [];
};

/**
 * Get netbanking data from API response
 * @returns {Object} - Returns netbanking data
 */
export const getNetbankingFromAPI = () => {
  if (cachedPaymentMethods?.data?.netbanking) {
    return cachedPaymentMethods.data.netbanking;
  }
  return null;
};

/**
 * Get cards data from API response
 * @returns {Object} - Returns cards data
 */
export const getCardsFromAPI = () => {
  if (cachedPaymentMethods?.data?.cards) {
    return cachedPaymentMethods.data.cards;
  }
  return null;
};

/**
 * Get COD data from API response
 * @returns {Object} - Returns COD data
 */
export const getCODFromAPI = () => {
  if (cachedPaymentMethods?.data?.cod) {
    return cachedPaymentMethods.data.cod;
  }
  return null;
};

/**
 * Get default saved UPI
 * @returns {Object|null} - Returns default saved UPI or null
 */
export const getDefaultSavedUPI = () => {
  const savedUPIs = getSavedUPIsFromAPI();
  return savedUPIs.find(upi => upi.is_default === true) || savedUPIs[0] || null;
};

/**
 * Check if a specific UPI app is installed on the device
 * @param {Object} app - App configuration object
 * @returns {Promise<boolean>} - Returns true if app is installed
 */
export const isAppInstalled = async (app) => {
  try {
    // Skip checking for apps without package name
    if (!app.packageName && Platform.OS === 'android') {
      console.log(`${app.name} has no package name, skipping installation check`);
      return false;
    }
    
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
    // Fallback to default apps if no API data
    const installedApps = [];
    for (const [key, app] of Object.entries(DEFAULT_UPI_APPS)) {
      
      const isInstalled = await isAppInstalled(app);
      if (isInstalled) {
        installedApps.push({
          ...app,
          installed: true,
          icon: app.icon || null,
          method_id: 3
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
 * Get all saved UPIs with masked VPAs
 * @returns {Array} - Returns array of saved UPIs
 */
export const getSavedUPIs = () => {
  return getSavedUPIsFromAPI();
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
      suffix = `${app.anroidScheme}#Intent;scheme=upi;package=${app.packageName};`
      url = app.anroidScheme+intentData+suffix
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
 * Open UPI app with saved UPI VPA
 * @param {Object} app - App configuration
 * @param {Object} savedUPI - Saved UPI object
 * @param {string} amount - Payment amount
 * @param {string} orderId - Order ID
 * @param {string} merchantName - Merchant name
 * @param {string} note - Payment note
 * @returns {Promise<boolean>} - Returns true if app opened successfully
 */
export const openUPIAppWithSavedVPA = async (app, savedUPI, amount, orderId, merchantName, note) => {
  try {
    if (!savedUPI || !savedUPI.raw_vpa) {
      throw new Error("Invalid saved UPI data");
    }

    // Build UPI intent parameters
    const params = new URLSearchParams();
    params.append('pa', savedUPI.raw_vpa); // Payee VPA
    params.append('pn', merchantName || savedUPI.name); // Payee name
    params.append('am', amount); // Amount
    params.append('cu', 'INR'); // Currency
    params.append('tn', note || `Payment for order ${orderId}`); // Transaction note
    
    const intentData = params.toString();
    
    return await openUPIApp(app, intentData);
  } catch (error) {
    console.error(`Error opening ${app.name} with saved VPA:`, error);
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
 * Initiate payment with saved UPI
 * @param {Object} savedUPI - Saved UPI object
 * @param {string} amount - Payment amount
 * @param {string} orderId - Order ID
 * @param {string} merchantName - Merchant name
 * @param {string} note - Payment note
 * @param {string} preferredAppId - Preferred app ID (optional)
 * @returns {Promise<Object>} - Returns result of payment initiation
 */
export const initiateSavedUPIPayment = async (savedUPI, amount, orderId, merchantName, note, preferredAppId = null) => {
  try {
    if (!savedUPI || !savedUPI.raw_vpa) {
      return {
        success: false,
        error: "Invalid saved UPI information"
      };
    }

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
        const opened = await openUPIAppWithSavedVPA(preferredApp, savedUPI, amount, orderId, merchantName, note);
        return {
          success: opened,
          app: preferredApp,
          savedUPI: savedUPI,
          error: opened ? null : `Failed to open ${preferredApp.name}`
        };
      }
    }
    
    // Otherwise, try the first installed app (highest priority)
    const firstApp = installedApps[0];
    const opened = await openUPIAppWithSavedVPA(firstApp, savedUPI, amount, orderId, merchantName, note);
    
    return {
      success: opened,
      app: firstApp,
      savedUPI: savedUPI,
      error: opened ? null : "Failed to open payment app"
    };
  } catch (error) {
    console.error("Saved UPI Payment Error:", error);
    return {
      success: false,
      error: error.message || "Failed to initiate payment with saved UPI"
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
 * @param {string|number} userId - User ID to fetch payment methods for
 * @returns {Promise<Object>} - Returns all payment methods with their data
 */
export const getAllPaymentMethods = async (userId) => {

  try {

    if (!userId && currentUserId) {
      userId = currentUserId;
    }
    
    const methods = await fetchPaymentMethods(userId);
    const installedUPIApps = await getInstalledUPIApps();

    const savedUPIs = getSavedUPIsFromAPI();
    const defaultSavedUPI = getDefaultSavedUPI();
      
    return {
      upi: {
        isActive: methods.upi_apps?.some(app => app.is_active) || false,
        apps: installedUPIApps,
        allApps: methods.upi_apps || []
      },
      saved_upi: {
        isActive: savedUPIs.length > 0,
        list: savedUPIs,
        default: defaultSavedUPI
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
      saved_upi: { isActive: false, list: [], default: null },
      wallets: { isActive: false, wallets: [] },
      netbanking: { isActive: false, data: null },
      cards: { isActive: false, data: null },
      cod: { isActive: false, data: null }
    };
  }
};

/**
 * Clear cached payment methods
 */
export const clearPaymentMethodsCache = () => {
  cachedPaymentMethods = null;
  currentUserId = null;
};

// Export additional helper functions
export default {
  WALLET_APPS,
  DEFAULT_UPI_APPS,
  PAYMENT_METHODS,
  fetchPaymentMethods,
  getSavedUPIsFromAPI,
  getUPIAppsFromAPI,
  getWalletsFromAPI,
  getNetbankingFromAPI,
  getCardsFromAPI,
  getCODFromAPI,
  getDefaultSavedUPI,
  getSavedUPIs,
  isAppInstalled,
  getInstalledUPIApps,
  openUPIApp,
  openUPIAppWithSavedVPA,
  initiateUPIPayment,
  initiateSavedUPIPayment,
  showAppSelectionDialog,
  validateIntentData,
  getAllPaymentMethods,
  clearPaymentMethodsCache
};