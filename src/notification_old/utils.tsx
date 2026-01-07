import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------------------------------------
// 🧪 TEST NOTIFICATIONS
// --------------------------------------------------------

/**
 * Show a test notification
 */
export const showTestNotification = async (options = {}) => {
  try {
    const testConfig = {
      title: options.title || 'Test Notification',
      body: options.body || 'This is a test notification to verify functionality',
      data: {
        type: 'test',
        action_screen: options.screen || 'Home',
        notification_id: `test_${Date.now()}`,
        ...options.data,
      },
      android: {
        channelId: options.channelId || 'default',
        importance: options.importance || 4, // HIGH
        ...options.android,
      },
      ios: {
        ...options.ios,
      },
    };
    
    await notifee.displayNotification(testConfig);
    console.log('✅ Test notification shown');
    return true;
  } catch (error) {
    console.error('❌ Error showing test notification:', error);
    return false;
  }
};

// --------------------------------------------------------
// 🔧 UTILITY FUNCTIONS
// --------------------------------------------------------

/**
 * Check if notifications are enabled
 */
export const checkNotificationStatus = async () => {
  try {
    const [iosPermission, androidPermission, token] = await Promise.all([
      AsyncStorage.getItem('notification_permission_ios'),
      AsyncStorage.getItem('notification_permission_android'),
      AsyncStorage.getItem('fcm_token'),
    ]);
    
    return {
      hasPermission: Platform.OS === 'ios' 
        ? iosPermission === 'true' 
        : (Platform.Version >= 33 ? androidPermission === 'true' : true),
      hasToken: !!token,
      token,
    };
  } catch (error) {
    console.error('❌ Error checking notification status:', error);
    return {
      hasPermission: false,
      hasToken: false,
      token: null,
    };
  }
};

/**
 * Get badge count
 */
export const getBadgeCount = async () => {
  try {
    const count = await notifee.getBadgeCount();
    return count;
  } catch (error) {
    console.error('❌ Error getting badge count:', error);
    return 0;
  }
};

/**
 * Set badge count
 */
export const setBadgeCount = async (count) => {
  try {
    await notifee.setBadgeCount(count);
    return true;
  } catch (error) {
    console.error('❌ Error setting badge count:', error);
    return false;
  }
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async () => {
  try {
    await notifee.cancelAllNotifications();
    console.log('🗑️ All notifications cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    return false;
  }
};

/**
 * Get all notification channels (Android only)
 */
export const getNotificationChannels = async () => {
  try {
    if (Platform.OS === 'android') {
      const channels = await notifee.getChannels();
      return channels;
    }
    return [];
  } catch (error) {
    console.error('❌ Error getting notification channels:', error);
    return [];
  }
};

/**
 * Get delivered notifications
 */
export const getDeliveredNotifications = async () => {
  try {
    const notifications = await notifee.getDisplayedNotifications();
    return notifications;
  } catch (error) {
    console.error('❌ Error getting delivered notifications:', error);
    return [];
  }
};

// --------------------------------------------------------
// 📱 PLATFORM UTILITIES
// --------------------------------------------------------

/**
 * Check if platform is Android 13+
 */
export const isAndroid13Plus = () => {
  return Platform.OS === 'android' && Platform.Version >= 33;
};

/**
 * Check if platform is iOS
 */
export const isIOS = () => {
  return Platform.OS === 'ios';
};

/**
 * Get platform-specific notification settings
 */
export const getPlatformNotificationSettings = async () => {
  if (Platform.OS === 'ios') {
    const settings = await notifee.requestPermission();
    return settings;
  }
  
  // Android settings
  return {
    alert: true,
    badge: true,
    sound: true,
  };
};