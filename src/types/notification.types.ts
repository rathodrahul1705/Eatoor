// src/types/notification.types.ts

// Notification data structure
export interface NotificationData {
  id?: string;
  title: string;
  body: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  imageUrl?: string;
  data?: Record<string, any>;
  sound?: boolean;
  vibration?: boolean;
  badge?: boolean;
  timestamp?: number;
  read?: boolean;
}

// Notification types
export type NotificationType = 
  | 'general'
  | 'order'
  | 'promotion'
  | 'alert'
  | 'chat'
  | 'system';

// Notification priorities
export type NotificationPriority = 
  | 'min'
  | 'low'
  | 'default'
  | 'high'
  | 'max';

// Notification preferences
export interface NotificationPreferences {
  general: boolean;
  orders: boolean;
  promotions: boolean;
  alerts: boolean;
  chat: boolean;
  system: boolean;
  sound: boolean;
  vibration: boolean;
  led: boolean;
  badge: boolean;
  preview: boolean;
  lockScreen: boolean;
  inApp: boolean;
}

// FCM token response
export interface FCMTokenResponse {
  token: string | null;
  timestamp: number;
}

// Notification permission status
export interface PermissionStatus {
  granted: boolean;
  status: number;
  canRequest?: boolean;
}

// Notification initialization result
export interface NotificationInitResult {
  success: boolean;
  hasPermission: boolean;
  token: string | null;
  channelsSetup?: boolean;
  error?: string;
}

// Pending navigation data
export interface PendingNavigation {
  screen: string;
  params?: Record<string, any>;
  timestamp: number;
  notificationId?: string;
}

// Notification history item
export interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
  timestamp: number;
  displayedAt: number;
  read: boolean;
  imageUrl?: string;
}

// Firebase remote message
export interface FirebaseRemoteMessage {
  notification?: {
    title?: string;
    body?: string;
    android?: {
      image?: string;
    };
    image?: string;
  };
  data?: Record<string, any>;
}

// Android channel config
export interface AndroidChannelConfig {
  id: string;
  name: string;
  description: string;
  importance: 'min' | 'low' | 'default' | 'high' | 'max';
  sound: string;
  vibration: boolean;
  vibrationPattern?: number[];
  lights: boolean;
  lightColor: string;
  showBadge: boolean;
}

// iOS notification settings
export interface IOSNotificationSettings {
  authorizationStatus: number;
  sound: boolean;
  alert: boolean;
  badge: boolean;
  carPlay: boolean;
  criticalAlert: boolean;
  lockScreen: boolean;
  notificationCenter: boolean;
  alertStyle: number;
  showPreviews: number;
}