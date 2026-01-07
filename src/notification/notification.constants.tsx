// src/notification/notification.constants.tsx

import { AndroidChannelConfig } from '../types/notification.types';

// Notification types for categorization
export const NOTIFICATION_TYPES = {
  GENERAL: 'general' as const,
  ORDER: 'order' as const,
  PROMOTION: 'promotion' as const,
  ALERT: 'alert' as const,
  CHAT: 'chat' as const,
  SYSTEM: 'system' as const,
};

// Notification priorities
export const NOTIFICATION_PRIORITY = {
  MIN: 'min' as const,
  LOW: 'low' as const,
  DEFAULT: 'default' as const,
  HIGH: 'high' as const,
  MAX: 'max' as const,
};

// Android notification channels
export const ANDROID_CHANNELS: Record<string, any> = {
  DEFAULT: {
    id: 'default',
    name: 'General Notifications',
    description: 'Important updates and announcements',
    importance: 'high',
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500], // EVEN: 2 values
    lights: true,
    lightColor: '#FF231F7C',
    showBadge: true,
  },
  ORDERS: {
    id: 'orders',
    name: 'Order Updates',
    description: 'Updates about your food orders',
    importance: 'high',
    sound: 'order',
    vibration: true,
    vibrationPattern: [200, 300, 200, 300], // EVEN: 4 values
    lights: true,
    lightColor: '#4CAF50',
    showBadge: true,
  },
  PROMOTIONS: {
    id: 'promotions',
    name: 'Promotions & Offers',
    description: 'Special deals and discounts',
    importance: 'default',
    sound: 'promotion',
    vibration: false, // No vibration for promotions
    lights: false,
    showBadge: true,
  },
  ALERTS: {
    id: 'alerts',
    name: 'Alerts',
    description: 'Time-sensitive alerts',
    importance: 'max',
    sound: 'alert',
    vibration: true,
    vibrationPattern: [100, 100, 100, 100, 100, 100], // EVEN: 6 values (was 5)
    lights: true,
    lightColor: '#FF5722',
    showBadge: true,
  },
  CHAT: {
    id: 'chat',
    name: 'Chat Messages',
    description: 'New messages and chats',
    importance: 'high',
    sound: 'chat',
    vibration: true,
    vibrationPattern: [100, 200], // EVEN: 2 values
    lights: true,
    lightColor: '#2196F3',
    showBadge: true,
  },
};

// iOS notification categories
export const IOS_CATEGORIES = {
  GENERAL: 'general' as const,
  ORDER: 'order' as const,
  PROMOTION: 'promotion' as const,
  ALERT: 'alert' as const,
  CHAT: 'chat' as const,
};

// iOS notification actions
export const IOS_ACTIONS = {
  VIEW: 'VIEW_ACTION' as const,
  REPLY: 'REPLY_ACTION' as const,
  DISMISS: 'DISMISS_ACTION' as const,
  ORDER_NOW: 'ORDER_NOW_ACTION' as const,
  VIEW_MENU: 'VIEW_MENU_ACTION' as const,
};

// Storage keys
export const STORAGE_KEYS = {
  FCM_TOKEN: 'fcm_token',
  FCM_TOKEN_TIMESTAMP: 'fcm_token_timestamp',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  PENDING_NAVIGATION: 'pending_navigation',
  NOTIFICATION_HISTORY: 'notification_history',
  READ_NOTIFICATIONS: 'read_notifications',
  LAST_NOTIFICATION_CHECK: 'last_notification_check',
  SCHEDULED_NOTIFICATIONS: 'scheduled_notifications',
};

// Default notification preferences
export const DEFAULT_PREFERENCES = {
  general: true,
  orders: true,
  promotions: true,
  alerts: true,
  chat: true,
  system: true,
  sound: true,
  vibration: true,
  led: true,
  badge: true,
  preview: true,
  lockScreen: true,
  inApp: true,
};

// Notification sounds
export const NOTIFICATION_SOUNDS = {
  DEFAULT: 'default' as const,
  ORDER: 'order_sound' as const,
  PROMOTION: 'promotion_sound' as const,
  ALERT: 'alert_sound' as const,
  CHAT: 'chat_sound' as const,
};

// Navigation screens for different notification types
export const NOTIFICATION_SCREENS = {
  GENERAL: 'Home',
  ORDER: 'OrderDetails',
  PROMOTION: 'Promotions',
  ALERT: 'Alerts',
  CHAT: 'ChatScreen',
  SYSTEM: 'Settings',
};

// Platform utilities
export const PLATFORMS = {
  IOS: 'ios' as const,
  ANDROID: 'android' as const,
};

export const SAFE_VIBRATION_PATTERNS = {
  SHORT: [100, 100], // 2 values
  MEDIUM: [200, 300, 200, 300], // 4 values
  LONG: [300, 500, 300, 500], // 4 values
  ALERT: [100, 100, 100, 100, 100, 100], // 6 values
  CHAT: [100, 200, 100, 200], // 4 values
};