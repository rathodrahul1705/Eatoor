// src/notification/notification.android.js
// Android-specific notification functionality

import { Platform } from 'react-native';
import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import { ANDROID_CHANNELS } from '../utils/notification.constants';

/**
 * Create Android notification channels
 */
export const createAndroidChannels = async () => {
  try {
    // Create all channels
    for (const channel of Object.values(ANDROID_CHANNELS)) {
      await notifee.createChannel({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        importance: getAndroidImportance(channel.importance),
        sound: channel.sound,
        vibration: channel.vibration,
        vibrationPattern: channel.vibrationPattern,
        lights: channel.lights,
        lightColor: channel.lightColor,
        badge: channel.showBadge,
        bypassDnd: channel.importance === 'max',
        showBadge: channel.showBadge,
        enableLights: channel.lights,
        enableVibration: channel.vibration,
      });
      
      console.log(`✅ Android channel created: ${channel.name}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error creating Android channels:', error);
    return false;
  }
};

/**
 * Convert string importance to AndroidImportance constant
 */
export const getAndroidImportance = (importance) => {
  switch (importance) {
    case 'min':
      return AndroidImportance.MIN;
    case 'low':
      return AndroidImportance.LOW;
    case 'default':
      return AndroidImportance.DEFAULT;
    case 'high':
      return AndroidImportance.HIGH;
    case 'max':
      return AndroidImportance.MAX;
    default:
      return AndroidImportance.HIGH;
  }
};

/**
 * Get Android notification channel ID based on type
 */
export const getAndroidChannelId = (notificationType) => {
  switch (notificationType) {
    case 'order':
      return ANDROID_CHANNELS.ORDERS.id;
    case 'promotion':
      return ANDROID_CHANNELS.PROMOTIONS.id;
    case 'alert':
      return ANDROID_CHANNELS.ALERTS.id;
    case 'chat':
      return ANDROID_CHANNELS.CHAT.id;
    default:
      return ANDROID_CHANNELS.DEFAULT.id;
  }
};

/**
 * Get Android notification style
 */
export const getAndroidNotificationStyle = (notificationData) => {
  const { imageUrl, largeText, messages } = notificationData;
  
  if (imageUrl) {
    return {
      type: AndroidStyle.BIGPICTURE,
      picture: imageUrl,
      title: notificationData.title,
      summary: notificationData.body,
    };
  }
  
  if (largeText) {
    return {
      type: AndroidStyle.BIGTEXT,
      text: largeText,
      title: notificationData.title,
      summary: notificationData.body,
    };
  }
  
  if (messages && Array.isArray(messages)) {
    return {
      type: AndroidStyle.MESSAGING,
      messages: messages.map(msg => ({
        text: msg.text,
        timestamp: msg.timestamp,
        person: {
          name: msg.sender,
          icon: msg.avatar,
        },
      })),
      title: notificationData.title,
      summary: notificationData.body,
      conversationTitle: notificationData.conversationTitle,
      groupConversation: notificationData.groupConversation || false,
    };
  }
  
  return undefined;
};

/**
 * Get Android notification actions
 */
export const getAndroidNotificationActions = (notificationType) => {
  const baseActions = [
    {
      title: 'View',
      pressAction: {
        id: 'view',
      },
    },
    {
      title: 'Dismiss',
      pressAction: {
        id: 'dismiss',
      },
    },
  ];
  
  switch (notificationType) {
    case 'order':
      return [
        {
          title: 'Track Order',
          pressAction: {
            id: 'track-order',
          },
        },
        ...baseActions,
      ];
    
    case 'promotion':
      return [
        {
          title: 'Order Now',
          pressAction: {
            id: 'order-now',
          },
        },
        ...baseActions,
      ];
    
    case 'chat':
      return [
        {
          title: 'Reply',
          pressAction: {
            id: 'reply',
          },
          input: {
            placeholder: 'Type a reply...',
          },
        },
        ...baseActions,
      ];
    
    default:
      return baseActions;
  }
};

/**
 * Check if device is Android 13+
 */
export const isAndroid13Plus = () => {
  return Platform.OS === 'android' && Platform.Version >= 33;
};

/**
 * Get Android notification importance based on priority
 */
export const getAndroidPriority = (priority) => {
  switch (priority) {
    case 'min':
    case 'low':
      return 'low';
    case 'default':
      return 'default';
    case 'high':
    case 'max':
      return 'high';
    default:
      return 'default';
  }
};

/**
 * Setup Android notification group
 */
export const setupAndroidNotificationGroup = async (groupId, groupName) => {
  try {
    await notifee.createChannel({
      id: groupId,
      name: groupName,
      importance: AndroidImportance.HIGH,
      groupId: groupId,
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error creating Android notification group:', error);
    return false;
  }
};

/**
 * Get Android notification color
 */
export const getAndroidNotificationColor = (notificationType) => {
  switch (notificationType) {
    case 'order':
      return '#4CAF50'; // Green
    case 'promotion':
      return '#FF9800'; // Orange
    case 'alert':
      return '#FF5722'; // Deep Orange
    case 'chat':
      return '#2196F3'; // Blue
    default:
      return '#231F7C'; // Default purple
  }
};