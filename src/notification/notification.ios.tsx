// src/notification/notification.ios.js
// iOS-specific notification functionality

import notifee from '@notifee/react-native';
import { IOS_CATEGORIES, IOS_ACTIONS } from '../utils/notification.constants';

/**
 * Setup iOS notification categories
 */
export const setupIOSNotificationCategories = async () => {
  try {
    // General category
    await notifee.setNotificationCategories([
      {
        id: IOS_CATEGORIES.GENERAL,
        actions: [
          {
            id: IOS_ACTIONS.VIEW,
            title: 'View',
            foreground: true,
          },
          {
            id: IOS_ACTIONS.DISMISS,
            title: 'Dismiss',
            destructive: true,
            foreground: false,
            authenticationRequired: false,
          },
        ],
      },
      {
        id: IOS_CATEGORIES.ORDER,
        actions: [
          {
            id: IOS_ACTIONS.VIEW,
            title: 'View Order',
            foreground: true,
          },
          {
            id: IOS_ACTIONS.ORDER_NOW,
            title: 'Order Again',
            foreground: true,
          },
          {
            id: IOS_ACTIONS.DISMISS,
            title: 'Dismiss',
            destructive: true,
          },
        ],
      },
      {
        id: IOS_CATEGORIES.PROMOTION,
        actions: [
          {
            id: IOS_ACTIONS.VIEW,
            title: 'View Offer',
            foreground: true,
          },
          {
            id: IOS_ACTIONS.VIEW_MENU,
            title: 'View Menu',
            foreground: true,
          },
          {
            id: IOS_ACTIONS.DISMISS,
            title: 'Dismiss',
            destructive: true,
          },
        ],
      },
      {
        id: IOS_CATEGORIES.CHAT,
        actions: [
          {
            id: IOS_ACTIONS.REPLY,
            title: 'Reply',
            foreground: false,
            input: {
              placeholder: 'Type a reply...',
            },
          },
          {
            id: IOS_ACTIONS.VIEW,
            title: 'View Chat',
            foreground: true,
          },
        ],
      },
    ]);

    console.log('✅ iOS notification categories setup complete');
    return true;
  } catch (error) {
    console.error('❌ Error setting up iOS notification categories:', error);
    return false;
  }
};

/**
 * Get iOS notification settings
 */
export const getIOSNotificationSettings = async () => {
  try {
    const settings = await notifee.requestPermission({
      sound: true,
      alert: true,
      badge: true,
      carPlay: true,
      criticalAlert: true,
      provisional: false,
      providesAppNotificationSettings: true,
      announcement: true,
    });

    return {
      authorizationStatus: settings.authorizationStatus,
      sound: settings.sound,
      alert: settings.alert,
      badge: settings.badge,
      carPlay: settings.carPlay,
      criticalAlert: settings.criticalAlert,
      lockScreen: settings.lockScreen,
      notificationCenter: settings.notificationCenter,
      alertStyle: settings.alertStyle,
      showPreviews: settings.showPreviews,
    };
  } catch (error) {
    console.error('❌ Error getting iOS notification settings:', error);
    return null;
  }
};

/**
 * Request critical alerts permission (iOS 12+)
 */
export const requestCriticalAlertsPermission = async () => {
  try {
    const settings = await notifee.requestPermission({
      criticalAlert: true,
      sound: true,
      alert: true,
      badge: true,
    });

    if (settings.authorizationStatus >= 2) {
      console.log('✅ Critical alerts permission granted');
      return true;
    } else {
      console.log('⚠️ Critical alerts permission not granted');
      return false;
    }
  } catch (error) {
    console.error('❌ Error requesting critical alerts:', error);
    return false;
  }
};

/**
 * Setup iOS notification interruption levels
 */
export const setupIOSInterruptionLevels = (notificationData) => {
  const { priority, type } = notificationData;
  
  let interruptionLevel = 'active';
  let relevanceScore = 0.5;
  
  switch (priority) {
    case 'critical':
    case 'high':
      interruptionLevel = 'critical';
      relevanceScore = 1.0;
      break;
    case 'timeSensitive':
      interruptionLevel = 'timeSensitive';
      relevanceScore = 0.8;
      break;
    case 'passive':
      interruptionLevel = 'passive';
      relevanceScore = 0.2;
      break;
    default:
      interruptionLevel = 'active';
      relevanceScore = 0.5;
  }
  
  // Adjust based on notification type
  if (type === 'alert') {
    interruptionLevel = 'timeSensitive';
    relevanceScore = 0.9;
  }
  
  if (type === 'order') {
    relevanceScore = 0.7;
  }
  
  return {
    interruptionLevel,
    relevanceScore,
  };
};

/**
 * Get iOS badge count
 */
export const getIOSBadgeCount = async () => {
  try {
    const count = await notifee.getBadgeCount();
    return count;
  } catch (error) {
    console.error('❌ Error getting iOS badge count:', error);
    return 0;
  }
};

/**
 * Set iOS badge count
 */
export const setIOSBadgeCount = async (count) => {
  try {
    await notifee.setBadgeCount(count);
    return true;
  } catch (error) {
    console.error('❌ Error setting iOS badge count:', error);
    return false;
  }
};

/**
 * Increment iOS badge count
 */
export const incrementIOSBadgeCount = async () => {
  try {
    const currentCount = await getIOSBadgeCount();
    await setIOSBadgeCount(currentCount + 1);
    return currentCount + 1;
  } catch (error) {
    console.error('❌ Error incrementing iOS badge count:', error);
    return 0;
  }
};

/**
 * Decrement iOS badge count
 */
export const decrementIOSBadgeCount = async () => {
  try {
    const currentCount = await getIOSBadgeCount();
    const newCount = Math.max(0, currentCount - 1);
    await setIOSBadgeCount(newCount);
    return newCount;
  } catch (error) {
    console.error('❌ Error decrementing iOS badge count:', error);
    return 0;
  }
};

/**
 * Reset iOS badge count
 */
export const resetIOSBadgeCount = async () => {
  try {
    await setIOSBadgeCount(0);
    return true;
  } catch (error) {
    console.error('❌ Error resetting iOS badge count:', error);
    return false;
  }
};

/**
 * Get iOS notification attachment options
 */
export const getIOSAttachmentOptions = (imageUrl) => {
  if (!imageUrl) return [];
  
  return [
    {
      url: imageUrl,
      id: 'notification-image',
      typeHint: 'public.jpeg',
      thumbnailHidden: false,
      thumbnailClippingRect: {
        x: 0.1,
        y: 0.1,
        width: 0.8,
        height: 0.8,
      },
    },
  ];
};

/**
 * Get iOS notification category identifier
 */
export const getIOSCategoryIdentifier = (notificationType) => {
  switch (notificationType) {
    case 'order':
      return IOS_CATEGORIES.ORDER;
    case 'promotion':
      return IOS_CATEGORIES.PROMOTION;
    case 'chat':
      return IOS_CATEGORIES.CHAT;
    case 'alert':
      return IOS_CATEGORIES.ALERT;
    default:
      return IOS_CATEGORIES.GENERAL;
  }
};