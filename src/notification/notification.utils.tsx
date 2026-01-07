// src/notification/notification.utils.tsx
// Notification utility functions

import { Platform, Alert, Linking } from 'react-native';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { 
  getBadgeCount,
  getNotificationPreferences,
  STORAGE_KEYS,
  NOTIFICATION_TYPES,
  displayNotification,
} from './notification.service';

// ==================== SETTINGS CHECK ====================

export const checkNotificationSettings = async () => {
  try {
    const [badgeCount, preferences, token] = await Promise.all([
      getBadgeCount(),
      getNotificationPreferences(),
      AsyncStorage.getItem(STORAGE_KEYS.FCM_TOKEN),
    ]);
    
    return {
      hasPermission: true,
      badgeCount,
      preferences,
      token,
    };
  } catch (error) {
    console.error('❌ Error checking settings:', error);
    return {
      hasPermission: false,
      badgeCount: 0,
      preferences: {},
      token: null,
    };
  }
};

// ==================== SCHEDULED NOTIFICATIONS ====================

export const scheduleNotification = async (
  title: string,
  body: string,
  triggerDate: Date,
  data?: Record<string, any>
): Promise<string | null> => {
  try {
    const notificationId = `scheduled_${Date.now()}`;
    
    const notification = {
      title,
      body,
      data: {
        ...data,
        scheduled: true,
        notification_id: notificationId,
      },
      android: {
        channelId: 'default',
      },
    };
    
    await notifee.createTriggerNotification(
      notification,
      {
        type: 0, // TIMESTAMP
        timestamp: triggerDate.getTime(),
      }
    );
    
    // Save to scheduled list
    const scheduledList = await getScheduledNotifications();
    scheduledList.push({
      id: notificationId,
      title,
      body,
      triggerDate: triggerDate.getTime(),
      data,
    });
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEDULED_NOTIFICATIONS,
      JSON.stringify(scheduledList)
    );
    
    console.log(`⏰ Scheduled notification: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
    return null;
  }
};

export const cancelScheduledNotification = async (notificationId: string): Promise<boolean> => {
  try {
    // Cancel with notifee
    await notifee.cancelNotification(notificationId);
    
    // Remove from storage
    const scheduledList = await getScheduledNotifications();
    const updated = scheduledList.filter((item: any) => item.id !== notificationId);
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.SCHEDULED_NOTIFICATIONS,
      JSON.stringify(updated)
    );
    
    console.log(`❌ Cancelled scheduled notification: ${notificationId}`);
    return true;
  } catch (error) {
    console.error('❌ Error cancelling scheduled notification:', error);
    return false;
  }
};

export const getScheduledNotifications = async (): Promise<any[]> => {
  try {
    const scheduledStr = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATIONS);
    return scheduledStr ? JSON.parse(scheduledStr) : [];
  } catch (error) {
    console.error('❌ Error getting scheduled notifications:', error);
    return [];
  }
};

// ==================== PLATFORM UTILITIES ====================

export const isAndroid13Plus = (): boolean => {
  return Platform.OS === 'android' && Platform.Version >= 33;
};

export const isIOS = (): boolean => {
  return Platform.OS === 'ios';
};

export const getPlatformInfo = () => {
  return {
    platform: Platform.OS,
    version: Platform.Version,
    isAndroid13Plus: isAndroid13Plus(),
    isIOS: isIOS(),
  };
};

// ==================== SETTINGS UTILITIES ====================

export const openNotificationSettings = async (): Promise<boolean> => {
  try {
    await notifee.openNotificationSettings();
    return true;
  } catch (error) {
    console.error('❌ Error opening notification settings:', error);
    
    // Fallback to app settings
    try {
      await Linking.openSettings();
      return true;
    } catch (linkError) {
      console.error('❌ Error opening app settings:', linkError);
      return false;
    }
  }
};

export const showPermissionAlert = (
  title: string = 'Enable Notifications',
  message: string = 'Please enable notifications to receive updates.',
  onOpenSettings?: () => void
): void => {
  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Open Settings', 
        onPress: () => {
          if (onOpenSettings) {
            onOpenSettings();
          } else {
            openNotificationSettings();
          }
        }
      },
    ]
  );
};