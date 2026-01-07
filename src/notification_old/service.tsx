import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------------------------------------
// 🏗️ NOTIFICATION CHANNELS/CATEGORIES
// --------------------------------------------------------
export const NOTIFICATION_CHANNELS = {
  DEFAULT: {
    id: 'default',
    name: 'General Notifications',
    description: 'Important updates and announcements',
  },
  ORDERS: {
    id: 'orders',
    name: 'Order Updates',
    description: 'Updates about your food orders',
  },
  PROMOTIONS: {
    id: 'promotions',
    name: 'Promotions & Offers',
    description: 'Special deals and discounts',
  },
  ALERTS: {
    id: 'alerts',
    name: 'Alerts',
    description: 'Time-sensitive alerts',
  },
};

// --------------------------------------------------------
// 🔐 PERMISSION MANAGEMENT
// --------------------------------------------------------

/**
 * Request iOS notification permission
 */
export const requestIOSPermission = async () => {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    console.log('📱 iOS Notification Permission:', enabled ? 'GRANTED' : 'DENIED');
    await AsyncStorage.setItem('notification_permission_ios', enabled ? 'true' : 'false');
    return enabled;
  } catch (error) {
    console.error('❌ Error requesting iOS permission:', error);
    return false;
  }
};

/**
 * Request Android 13+ notification permission
 */
export const requestAndroidPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      
      console.log('🤖 Android Notification Permission:', isGranted ? 'GRANTED' : 'DENIED');
      await AsyncStorage.setItem('notification_permission_android', isGranted ? 'true' : 'false');
      return isGranted;
    } catch (error) {
      console.error('❌ Error requesting Android permission:', error);
      return false;
    }
  }
  return true; // For Android < 13, permission is granted by default
};

/**
 * Request all necessary permissions
 */
export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'ios') {
    return await requestIOSPermission();
  } else {
    return await requestAndroidPermission();
  }
};

// --------------------------------------------------------
// 📡 CHANNEL MANAGEMENT
// --------------------------------------------------------

/**
 * Create all notification channels
 */
export const createNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    try {
      // Create all channels
      await Promise.all(
        Object.values(NOTIFICATION_CHANNELS).map(channel =>
          notifee.createChannel({
            id: channel.id,
            name: channel.name,
            description: channel.description,
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
            vibrationPattern: [300, 500],
            lights: true,
            lightColor: '#FF231F7C',
          })
        )
      );
      
      console.log('✅ All notification channels created');
      return true;
    } catch (error) {
      console.error('❌ Error creating notification channels:', error);
      return false;
    }
  }
  return true; // iOS doesn't use channels
};

// --------------------------------------------------------
// 🔥 FCM TOKEN MANAGEMENT
// --------------------------------------------------------

/**
 * Save FCM token to storage
 */
export const saveFCMToken = async (token) => {
  try {
    await AsyncStorage.setItem('fcm_token', token);
    await AsyncStorage.setItem('fcm_token_timestamp', Date.now().toString());
    console.log('💾 FCM Token saved:', token.substring(0, 20) + '...');
    return true;
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    return false;
  }
};

/**
 * Get stored FCM token
 */
export const getStoredFCMToken = async () => {
  try {
    const token = await AsyncStorage.getItem('fcm_token');
    return token;
  } catch (error) {
    console.error('❌ Error reading stored FCM token:', error);
    return null;
  }
};

/**
 * Get new FCM token from Firebase
 */
export const getFCMToken = async () => {
  try {
    // Check if we have a recent token (less than 7 days old)
    const storedToken = await getStoredFCMToken();
    const timestamp = await AsyncStorage.getItem('fcm_token_timestamp');
    
    if (storedToken && timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      
      if (age < sevenDays) {
        console.log('📦 Using cached FCM token');
        return storedToken;
      }
    }
    
    // Get fresh token
    const hasPermission = await messaging().hasPermission();
    if (!hasPermission) {
      console.log('⚠️ No notification permission, cannot get FCM token');
      return null;
    }
    
    const token = await messaging().getToken();
    console.log('📨 New FCM Token received');
    
    if (token) {
      await saveFCMToken(token);
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
};

/**
 * Setup token refresh listener
 */
export const setupTokenRefreshListener = () => {
  return messaging().onTokenRefresh(async (newToken) => {
    console.log('🔄 FCM Token refreshed');
    await saveFCMToken(newToken);
  });
};

// --------------------------------------------------------
// 🔔 NOTIFICATION DISPLAY
// --------------------------------------------------------

/**
 * Determine notification channel based on data
 */
const getChannelForNotification = (data) => {
  if (data?.type === 'order') return NOTIFICATION_CHANNELS.ORDERS.id;
  if (data?.type === 'promotion') return NOTIFICATION_CHANNELS.PROMOTIONS.id;
  if (data?.type === 'alert') return NOTIFICATION_CHANNELS.ALERTS.id;
  return NOTIFICATION_CHANNELS.DEFAULT.id;
};

/**
 * Display a notification
 */
export const displayNotification = async (remoteMessage, customConfig = {}) => {
  try {
    const { notification, data } = remoteMessage;
    
    // Extract image URL from various possible locations
    const imageUrl = 
      remoteMessage.notification?.android?.image ||
      remoteMessage.notification?.image ||
      remoteMessage.data?.image ||
      remoteMessage.data?.imageUrl ||
      customConfig.imageUrl;
    
    const channelId = customConfig.channelId || getChannelForNotification(data);
    const actionButton = data?.action_button || customConfig.actionButton || 'View Details';
    const actionScreen = data?.action_screen || customConfig.actionScreen || 'Home';
    
    // Build notification config
    const notificationConfig = {
      title: notification?.title || data?.title || 'Notification',
      body: notification?.body || data?.body || '',
      data: {
        ...data,
        action_screen: actionScreen,
        notification_id: data?.notification_id || Date.now().toString(),
        timestamp: Date.now().toString(),
      },
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        smallIcon: 'ic_notification',
        color: '#FF231F7C',
        timestamp: Date.now(),
        showTimestamp: true,
        ...(imageUrl && {
          style: {
            type: AndroidStyle.BIGPICTURE,
            picture: imageUrl,
          },
        }),
        actions: [
          {
            title: actionButton,
            pressAction: {
              id: 'default-action',
            },
          },
        ],
        ...customConfig.android,
      },
      ios: {
        ...(imageUrl && {
          attachments: [{ url: imageUrl }],
        }),
        ...customConfig.ios,
      },
    };
    
    await notifee.displayNotification(notificationConfig);
    console.log('📤 Notification displayed:', notificationConfig.title);
    return true;
  } catch (error) {
    console.error('❌ Error displaying notification:', error);
    return false;
  }
};

// --------------------------------------------------------
// 📊 NOTIFICATION SETTINGS
// --------------------------------------------------------

/**
 * Save notification preferences
 */
export const saveNotificationPreferences = async (preferences) => {
  try {
    await AsyncStorage.setItem('notification_preferences', JSON.stringify(preferences));
    return true;
  } catch (error) {
    console.error('❌ Error saving notification preferences:', error);
    return false;
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async () => {
  try {
    const preferences = await AsyncStorage.getItem('notification_preferences');
    return preferences ? JSON.parse(preferences) : {
      general: true,
      orders: true,
      promotions: true,
      alerts: true,
      sound: true,
      vibration: true,
      led: true,
    };
  } catch (error) {
    console.error('❌ Error getting notification preferences:', error);
    return null;
  }
};

/**
 * Check if notification type is enabled
 */
export const isNotificationTypeEnabled = async (type) => {
  const preferences = await getNotificationPreferences();
  if (!preferences) return true; // Default to enabled
  
  switch (type) {
    case 'order':
      return preferences.orders !== false;
    case 'promotion':
      return preferences.promotions !== false;
    case 'alert':
      return preferences.alerts !== false;
    default:
      return preferences.general !== false;
  }
};

// --------------------------------------------------------
// 🚀 INITIALIZATION
// --------------------------------------------------------

/**
 * Initialize complete notification system
 */
export const initializeNotificationSystem = async () => {
  console.log('🚀 Initializing notification system...');
  
  try {
    // 1. Request permissions
    const hasPermission = await requestNotificationPermissions();
    
    if (!hasPermission) {
      console.log('⚠️ Notification permissions not granted');
      return {
        success: false,
        hasPermission: false,
        token: null,
      };
    }
    
    // 2. Create channels (Android only)
    const channelsCreated = await createNotificationChannels();
    
    // 3. Get FCM token
    const token = await getFCMToken();
    
    // 4. Setup token refresh listener
    setupTokenRefreshListener();
    
    console.log('✅ Notification system initialized successfully');
    
    return {
      success: true,
      hasPermission: true,
      token,
      channelsCreated,
    };
  } catch (error) {
    console.error('❌ Failed to initialize notification system:', error);
    return {
      success: false,
      hasPermission: false,
      token: null,
      error: error.message,
    };
  }
};