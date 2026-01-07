// src/notification/notification.service.tsx - UPDATED VERSION
// Order alert notifications stop when notification is clicked

import { Platform, PermissionsAndroid, AppState, AppStateStatus, Vibration } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  Notification,
  EventType,
  Event,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';

// ==================== CONSTANTS ====================
export const NOTIFICATION_TYPES = {
  GENERAL: 'general' as const,
  ORDER: 'order' as const,
  PROMOTION: 'promotion' as const,
  ALERT: 'alert' as const,
  CHAT: 'chat' as const,
  SYSTEM: 'system' as const,
  NEW_ORDER: 'new_order' as const,
};

export const STORAGE_KEYS = {
  FCM_TOKEN: 'fcm_token',
  FCM_TOKEN_TIMESTAMP: 'fcm_token_timestamp',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  PENDING_NAVIGATION: 'pending_navigation',
  NOTIFICATION_HISTORY: 'notification_history',
  READ_NOTIFICATIONS: 'read_notifications',
  LAST_NOTIFICATION_CHECK: 'last_notification_check',
  SCHEDULED_NOTIFICATIONS: 'scheduled_notifications',
  ACTIVE_ORDER_SOUND: 'active_order_sound', // Track active sound state
  ACTIVE_NOTIFICATION_ID: 'active_notification_id', // Track which notification is active
};

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

export const NOTIFICATION_SCREENS = {
  GENERAL: 'Home',
  ORDER: 'OrderDetails',
  PROMOTION: 'Promotions',
  ALERT: 'Alerts',
  CHAT: 'ChatScreen',
  SYSTEM: 'Settings',
  NEW_ORDER: 'PartnerScreen',
};

export const PLATFORMS = {
  IOS: 'ios' as const,
  ANDROID: 'android' as const,
};

export const ANDROID_CHANNELS = {
  DEFAULT: {
    id: 'default',
    name: 'General Notifications',
    description: 'Important updates and announcements',
    importance: 'high' as const,
  },
  ORDERS: {
    id: 'orders',
    name: 'Order Updates',
    description: 'Updates about your food orders',
    importance: 'high' as const,
  },
  ORDER_ALERTS: {
    id: 'order_alerts',
    name: 'Order Alerts',
    description: 'New order notifications for vendors - Continuous alert',
    importance: 'max' as const,
  },
  PROMOTIONS: {
    id: 'promotions',
    name: 'Promotions & Offers',
    description: 'Special deals and discounts',
    importance: 'default' as const,
  },
  ALERTS: {
    id: 'alerts',
    name: 'Alerts',
    description: 'Time-sensitive alerts',
    importance: 'max' as const,
  },
  CHAT: {
    id: 'chat',
    name: 'Chat Messages',
    description: 'New messages and chats',
    importance: 'high' as const,
  },
};

// ==================== SOUND MANAGEMENT ====================

let orderSoundInstance: Sound | null = null;
let isOrderSoundPlaying = false;
let currentNotificationId: string | null = null;
let soundInterval: NodeJS.Timeout | null = null;
let vibrationInterval: NodeJS.Timeout | null = null;
let isPlayingOrderAlert = false;

// Initialize sound system
export const initializeSoundSystem = (): void => {
  Sound.setCategory('Playback', true);
  console.log('🔊 Sound system initialized');
};

// Get iOS sound name for different notification types
const getIOSSoundName = (type: string): string => {
  switch (type) {
    case NOTIFICATION_TYPES.ORDER: 
    case NOTIFICATION_TYPES.NEW_ORDER:
      return 'beep.caf'; // iOS notification sound
    default:
      return 'default'; // System default
  }
};

// Get Android sound - Ensure the sound file exists in android/app/src/main/res/raw/beep.wav
const getAndroidSound = (type: string): string | undefined => {
  switch (type) {
    case NOTIFICATION_TYPES.ORDER: 
    case NOTIFICATION_TYPES.NEW_ORDER:
      return 'beep'; // This corresponds to beep.wav in raw folder
    default:
      return 'default';
  }
};

// Play order notification sound continuously
export const playOrderNotificationSound = (notificationId: string, notificationType: string = NOTIFICATION_TYPES.NEW_ORDER): void => {
  if (isOrderSoundPlaying && currentNotificationId === notificationId) {
    console.log('🔊 Order sound already playing continuously for this notification');
    return;
  }

  try {
    console.log(`🔊 Starting continuous order notification sound for ID: ${notificationId}, Type: ${notificationType}`);
    isOrderSoundPlaying = true;
    currentNotificationId = notificationId;
    
    // Save active state to storage
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORDER_SOUND, 'true');
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_NOTIFICATION_ID, notificationId);

    // Platform-specific sound handling
    if (Platform.OS === 'android') {
      // Android: Use beep.wav from raw folder
      console.log('🤖 Android: Loading beep.wav for continuous play');
      
      orderSoundInstance = new Sound(
        'beep.wav',
        Sound.MAIN_BUNDLE,
        (error) => {
          if (error) {
            console.error('❌ Android order sound error:', error);
            
            // Try fallback sounds
            const fallbackSounds = ['beep', 'notification', 'default'];
            tryAndroidFallback(fallbackSounds, 0, notificationId);
            return;
          }
          console.log('✅ Android: beep.wav loaded successfully');
          playContinuousBeep(notificationId);
        }
      );
    } else {
      // iOS: Use beep.caf for continuous play
      console.log('🔵 iOS: Loading beep.caf for continuous play');
      
      const iosSoundName = getIOSSoundName(notificationType);
      console.log(`🔵 iOS: Using sound file: ${iosSoundName}`);
      
      orderSoundInstance = new Sound(
        iosSoundName,
        Sound.MAIN_BUNDLE,
        (error) => {
          if (error) {
            console.error('❌ iOS sound error:', error.message);
            
            // Fallback to system default sound
            console.log('🔄 iOS: Trying system default sound as fallback...');
            orderSoundInstance = new Sound(
              'default',
              Sound.MAIN_BUNDLE,
              (fallbackError) => {
                if (fallbackError) {
                  console.error('❌ iOS default sound also failed:', fallbackError.message);
                  console.log('📳 Using vibration only');
                  startVibrationFallback(notificationId);
                } else {
                  console.log('✅ iOS: Default sound loaded as fallback');
                  playContinuousBeep(notificationId);
                }
              }
            );
            return;
          }
          console.log(`✅ iOS: ${iosSoundName} loaded successfully`);
          playContinuousBeep(notificationId);
        }
      );
    }
  } catch (error) {
    console.error('❌ Error in playOrderNotificationSound:', error);
    isOrderSoundPlaying = false;
    currentNotificationId = null;
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORDER_SOUND, 'false');
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTIFICATION_ID);
  }
};

// Android fallback sounds
const tryAndroidFallback = (sounds: string[], index: number, notificationId: string): void => {
  if (index >= sounds.length) {
    console.error('❌ Android: All sound sources failed');
    isOrderSoundPlaying = false;
    currentNotificationId = null;
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORDER_SOUND, 'false');
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTIFICATION_ID);
    startVibrationFallback(notificationId);
    return;
  }
  
  const soundName = sounds[index];
  console.log(`🔄 Android: Trying fallback sound: ${soundName}`);
  
  orderSoundInstance = new Sound(
    soundName,
    Sound.MAIN_BUNDLE,
    (error) => {
      if (error) {
        console.error(`❌ Android: ${soundName} failed:`, error);
        tryAndroidFallback(sounds, index + 1, notificationId);
      } else {
        console.log(`✅ Android: ${soundName} loaded successfully`);
        playContinuousBeep(notificationId);
      }
    }
  );
};

const playContinuousBeep = (notificationId: string): void => {
  if (!orderSoundInstance) {
    isOrderSoundPlaying = false;
    currentNotificationId = null;
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORDER_SOUND, 'false');
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTIFICATION_ID);
    return;
  }

  console.log('🔊 Starting continuous beep pattern...');

  // Function to play beep repeatedly
  const playBeepLoop = () => {
    if (!isOrderSoundPlaying || !orderSoundInstance || currentNotificationId !== notificationId) return;
    
    orderSoundInstance.play((success) => {
      if (success) {
        console.log('🔊 Beep played');
      } else {
        console.error('❌ Beep failed to play');
      }
      
      // Wait 1 second and play again
      if (isOrderSoundPlaying && currentNotificationId === notificationId) {
        setTimeout(playBeepLoop, 1000);
      }
    });
  };

  // Start the loop
  playBeepLoop();
};

// Play vibration for order notifications
export const playOrderVibration = (duration: number = 10000): void => {
  if (isPlayingOrderAlert) {
    console.log('📳 Vibration already playing');
    return;
  }

  try {
    console.log(`📳 Playing vibration for ${duration}ms...`);
    isPlayingOrderAlert = true;

    // Pattern: Strong vibration for order alerts
    const pattern = [1000, 500, 1000, 500, 1000, 500]; // 1 sec vibrate, 0.5 sec pause
    
    Vibration.vibrate(pattern, true);
    
    // Auto-stop after duration (but continuous alerts will override this)
    setTimeout(() => {
      if (isPlayingOrderAlert) {
        stopOrderVibration();
      }
    }, duration);

  } catch (error) {
    console.error('❌ Error playing vibration:', error);
    isPlayingOrderAlert = false;
  }
};

// Vibration fallback for continuous alerts
const startVibrationFallback = (notificationId: string): void => {
  console.log('📳 Starting continuous vibration pattern...');
  
  try {
    // First try react-native-haptic-feedback
    const ReactNativeHapticFeedback = require('react-native-haptic-feedback');
    
    const options = {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    };
    
    // Create continuous vibration pattern
    vibrationInterval = setInterval(() => {
      if (isOrderSoundPlaying && currentNotificationId === notificationId) {
        ReactNativeHapticFeedback.trigger('impactMedium', options);
      } else {
        if (vibrationInterval) {
          clearInterval(vibrationInterval);
          vibrationInterval = null;
        }
      }
    }, 1000);
    
  } catch (error) {
    console.log('⚠️ Haptic feedback not available, trying React Native Vibration');
    try {
      // Create continuous vibration pattern: vibrate for 500ms, pause for 500ms
      const pattern = [1000, 500, 1000, 500, 1000, 500];
      Vibration.vibrate(pattern, true);
      
    } catch (vibrationError) {
      console.log('❌ Vibration API not available');
    }
  }
};

// Stop order sound if playing
export const stopOrderNotificationSound = (): void => {
  console.log('🔇 Attempting to stop order notification sound...');
  
  if (soundInterval) {
    clearInterval(soundInterval);
    soundInterval = null;
  }
  
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  
  // Stop vibration
  try {
    Vibration.cancel();
  } catch (error) {
    // Ignore if Vibration not available
  }
  
  if (orderSoundInstance && isOrderSoundPlaying) {
    try {
      orderSoundInstance.stop();
      orderSoundInstance.release();
    } catch (error) {
      console.error('❌ Error stopping sound:', error);
    }
    orderSoundInstance = null;
  }
  
  isOrderSoundPlaying = false;
  isPlayingOrderAlert = false;
  currentNotificationId = null;
  AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ORDER_SOUND, 'false');
  AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_NOTIFICATION_ID);
  console.log('🔇 Order notification sound stopped');
};

// Stop vibration only
export const stopOrderVibration = (): void => {
  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }
  
  // Stop vibration
  try {
    Vibration.cancel();
  } catch (error) {
    // Ignore
  }
  
  isPlayingOrderAlert = false;
  console.log('🛑 Vibration stopped');
};

// Stop sound for specific notification
export const stopSoundForNotification = (notificationId: string): void => {
  console.log(`🔇 Checking if sound should stop for notification: ${notificationId}`);
  
  if (currentNotificationId === notificationId) {
    console.log(`🔇 Stopping sound for notification: ${notificationId}`);
    stopOrderNotificationSound();
  } else {
    console.log(`ℹ️ Sound is not playing for notification: ${notificationId}`);
  }
};

// Check if order sound is currently playing
export const isOrderSoundPlayingNow = (): boolean => {
  return isOrderSoundPlaying;
};

// Get active order sound state from storage
export const getActiveOrderSoundState = async (): Promise<{
  isActive: boolean;
  notificationId: string | null;
}> => {
  try {
    const state = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ORDER_SOUND);
    const notificationId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_NOTIFICATION_ID);
    return {
      isActive: state === 'true',
      notificationId,
    };
  } catch (error) {
    console.error('❌ Error getting active sound state:', error);
    return { isActive: false, notificationId: null };
  }
};

// Clean up sound resources
export const cleanupSoundSystem = (): void => {
  stopOrderNotificationSound();
  console.log('🧹 Sound system cleaned up');
};

// ==================== NOTIFICATION CLICK HANDLER ====================

// Setup notification event listeners
export const setupNotificationEventListeners = (): (() => void) => {
  console.log('🎯 Setting up notification event listeners...');
  
  // Handle notification press events
  const unsubscribe = notifee.onForegroundEvent(({ type, detail }: Event) => {
    console.log('📱 Foreground event:', type, 'Detail:', detail.notification?.id);
    
    switch (type) {
      case EventType.PRESS:
        console.log('🖱️ Notification pressed:', detail.notification?.id);
        handleNotificationPress(detail);
        break;
      case EventType.ACTION_PRESS:
        console.log('🖱️ Notification action pressed:', detail.pressAction?.id);
        handleActionPress(detail);
        break;
      case EventType.DISMISSED:
        console.log('🗑️ Notification dismissed:', detail.notification?.id);
        handleNotificationDismiss(detail);
        break;
    }
  });
  
  // Also handle background/quit state events
  notifee.onBackgroundEvent(async ({ type, detail }: Event) => {
    console.log('📱 Background event:', type, 'Detail:', detail.notification?.id);
    
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      console.log('🖱️ Background notification pressed:', detail.notification?.id);
      handleNotificationPress(detail);
    }
    
    return Promise.resolve();
  });
  
  // Handle app state changes
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    console.log('📱 App state changed to:', nextAppState);
    
    if (nextAppState === 'active') {
      // Check if we need to stop any sounds when app comes to foreground
      checkAndStopSoundsForOpenedNotifications();
    }
  };
  
  AppState.addEventListener('change', handleAppStateChange);
  
  // Return cleanup function
  return () => {
    unsubscribe();
    // @ts-ignore - removeEventListener exists but types may not show it
    AppState.removeEventListener('change', handleAppStateChange);
  };
};

// Handle notification press
const handleNotificationPress = async (detail: any): Promise<void> => {
  try {
    const notificationId = detail.notification?.id;
    const data = detail.notification?.data;
    
    if (!notificationId) {
      console.log('⚠️ No notification ID in press event');
      return;
    }
    
    console.log(`🖱️ Handling press for notification: ${notificationId}`);
    
    // Always stop sound when notification is pressed
    stopSoundForNotification(notificationId);
    
    // Mark as read in history
    await markNotificationAsRead(notificationId);
    
    // Handle navigation based on notification data
    if (data) {
      await handleNotificationNavigation(data, notificationId);
    }
    
    // Clear the notification badge if needed
    if (Platform.OS === PLATFORMS.IOS) {
      await decrementBadgeCount();
    }
    
  } catch (error) {
    console.error('❌ Error handling notification press:', error);
  }
};

// Handle action button press
const handleActionPress = async (detail: any): Promise<void> => {
  try {
    const notificationId = detail.notification?.id;
    const actionId = detail.pressAction?.id;
    const data = detail.notification?.data;
    
    console.log(`🖱️ Action pressed: ${actionId} for notification: ${notificationId}`);
    
    // Stop sound for any action press on order notifications
    if (notificationId) {
      stopSoundForNotification(notificationId);
    }
    
    // Handle specific actions
    switch (actionId) {
      case 'view_and_stop':
      case 'view':
        console.log('👁️ View action pressed');
        if (notificationId) {
          await markNotificationAsRead(notificationId);
        }
        if (data) {
          await handleNotificationNavigation(data, notificationId);
        }
        break;
        
      case 'dismiss_and_stop':
      case 'dismiss':
        console.log('🗑️ Dismiss action pressed');
        if (notificationId) {
          await notifee.cancelNotification(notificationId);
          await markNotificationAsRead(notificationId);
        }
        break;
        
      default:
        console.log(`🔄 Unknown action: ${actionId}`);
    }
    
  } catch (error) {
    console.error('❌ Error handling action press:', error);
  }
};

// Handle notification dismiss
const handleNotificationDismiss = async (detail: any): Promise<void> => {
  try {
    const notificationId = detail.notification?.id;
    
    if (notificationId) {
      console.log(`🗑️ Notification dismissed: ${notificationId}`);
      // Optionally mark as read when dismissed
      await markNotificationAsRead(notificationId);
      stopSoundForNotification(notificationId);
    }
  } catch (error) {
    console.error('❌ Error handling notification dismiss:', error);
  }
};

// Handle notification navigation
const handleNotificationNavigation = async (data: any, notificationId: string): Promise<void> => {
  try {
    console.log('🧭 Handling notification navigation...');
    
    const actionScreen = data.action_screen || 'Home';
    const params = data.params ? JSON.parse(data.params) : {};
    const notificationType = data.type || NOTIFICATION_TYPES.GENERAL;
    
    console.log(`📍 Navigating to: ${actionScreen}`, params);
    
    // Save pending navigation for app to handle
    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_NAVIGATION,
      JSON.stringify({
        screen: actionScreen,
        params: {
          ...params,
          notificationId,
          notificationType,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      })
    );
    
    // Emit event for app to handle (if using event emitters)
    try {
      const { DeviceEventEmitter } = require('react-native');
      DeviceEventEmitter.emit('notification_navigation', {
        screen: actionScreen,
        params: { ...params, notificationId, notificationType },
      });
    } catch (e) {
      console.log('⚠️ DeviceEventEmitter not available');
    }
    
  } catch (error) {
    console.error('❌ Error handling notification navigation:', error);
  }
};

// Check and stop sounds for opened notifications
const checkAndStopSoundsForOpenedNotifications = async (): Promise<void> => {
  try {
    const { isActive, notificationId } = await getActiveOrderSoundState();
    
    if (isActive && notificationId) {
      console.log(`📱 App came to foreground, checking notification ${notificationId}...`);
      
      // Check if the notification still exists
      const notifications = await notifee.getDisplayedNotifications();
      const notificationExists = notifications.some(n => n.notification.id === notificationId);
      
      if (!notificationExists) {
        console.log(`🗑️ Notification ${notificationId} no longer displayed, stopping sound`);
        stopOrderNotificationSound();
      } else {
        console.log(`ℹ️ Notification ${notificationId} still displayed, keeping sound`);
      }
    }
  } catch (error) {
    console.error('❌ Error checking opened notifications:', error);
  }
};

// ==================== PERMISSION MANAGEMENT ====================

export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    console.log('🔐 Requesting notification permission...');
    
    if (Platform.OS === PLATFORMS.IOS) {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      console.log(`📱 iOS permission: ${enabled ? 'GRANTED' : 'DENIED'}`);
      return enabled;
    } else {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'This app needs notification permission to send you updates.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log(`🤖 Android 13+ permission: ${isGranted ? 'GRANTED' : 'DENIED'}`);
        return isGranted;
      }
      console.log('🤖 Android <13: Permission granted by default');
      return true;
    }
  } catch (error) {
    console.error('❌ Error requesting permission:', error);
    return false;
  }
};

// ==================== CHANNEL SETUP ====================

export const setupNotificationChannels = async (): Promise<boolean> => {
  if (Platform.OS !== PLATFORMS.ANDROID) return true;
  
  try {
    console.log('📱 Setting up Android notification channels...');
    
    for (const channel of Object.values(ANDROID_CHANNELS)) {
      const channelConfig: any = {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        importance: getAndroidImportance(channel.importance),
        vibration: true,
        vibrationPattern: channel.id === 'order_alerts' ? [1000, 500, 1000, 500, 1000, 500] : [300, 500],
        lights: true,
        lightColor: '#FF6B00',
        bypassDnd: channel.id === 'order_alerts',
      };
      
      // Set sound for the channel
      if (channel.id === 'order_alerts') {
        channelConfig.sound = 'beep'; // Use 'beep' for order alerts
      } else {
        channelConfig.sound = 'default';
      }
      
      await notifee.createChannel(channelConfig);
      console.log(`✅ Created channel: ${channel.name}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error creating channels:', error);
    return false;
  }
};

const getAndroidImportance = (importance: string): AndroidImportance => {
  switch (importance) {
    case 'min': return AndroidImportance.MIN;
    case 'low': return AndroidImportance.LOW;
    case 'default': return AndroidImportance.DEFAULT;
    case 'high': return AndroidImportance.HIGH;
    case 'max': return AndroidImportance.MAX;
    default: return AndroidImportance.HIGH;
  }
};

// ==================== FCM TOKEN MANAGEMENT ====================

export const saveFCMToken = async (token: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN_TIMESTAMP, Date.now().toString());
    console.log('💾 FCM token saved');
    return true;
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
    return false;
  }
};

export const getStoredFCMToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
  } catch (error) {
    console.error('❌ Error getting stored token:', error);
    return null;
  }
};

export const getFCMToken = async (forceRefresh = false): Promise<string | null> => {
  try {
    const hasPermission = await messaging().hasPermission();
    if (hasPermission !== 1 && hasPermission !== 2) {
      console.log('⚠️ No notification permission');
      return null;
    }
    
    if (!forceRefresh) {
      const cachedToken = await getStoredFCMToken();
      console.log("cachedToken===", cachedToken);
      
      if (cachedToken) {
        console.log('📦 Using cached FCM token');
        return cachedToken;
      }
    }
    
    console.log('🔄 Getting fresh FCM token...');
    const token = await messaging().getToken();
    
    if (token) {
      await saveFCMToken(token);
      console.log('✅ New FCM token received');
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
};

export const setupTokenRefreshListener = (): (() => void) => {
  return messaging().onTokenRefresh(async (newToken: string) => {
    console.log('🔄 FCM token refreshed');
    await saveFCMToken(newToken);
  });
};

// ==================== NOTIFICATION PREFERENCES ====================

export const getNotificationPreferences = async (): Promise<typeof DEFAULT_PREFERENCES> => {
  try {
    const prefsStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES);
    
    if (!prefsStr) {
      const defaultPrefs = JSON.stringify(DEFAULT_PREFERENCES);
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFERENCES, defaultPrefs);
      console.log('📋 Created default preferences');
      return DEFAULT_PREFERENCES;
    }
    
    const prefs = JSON.parse(prefsStr);
    console.log('📋 Loaded stored preferences');
    return { ...DEFAULT_PREFERENCES, ...prefs };
  } catch (error) {
    console.error('❌ Error loading preferences:', error);
    return DEFAULT_PREFERENCES;
  }
};

export const saveNotificationPreferences = async (
  preferences: Partial<typeof DEFAULT_PREFERENCES>
): Promise<boolean> => {
  try {
    const current = await getNotificationPreferences();
    const merged = { ...current, ...preferences };
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_PREFERENCES,
      JSON.stringify(merged)
    );
    
    console.log('💾 Preferences saved');
    return true;
  } catch (error) {
    console.error('❌ Error saving preferences:', error);
    return false;
  }
};

export const isNotificationTypeEnabled = async (
  type: string = NOTIFICATION_TYPES.GENERAL
): Promise<boolean> => {
  try {
    const prefs = await getNotificationPreferences();
    
    switch (type) {
      case NOTIFICATION_TYPES.ORDER: 
      case NOTIFICATION_TYPES.NEW_ORDER: 
        return prefs.orders;
      case NOTIFICATION_TYPES.PROMOTION: return prefs.promotions;
      case NOTIFICATION_TYPES.ALERT: return prefs.alerts;
      case NOTIFICATION_TYPES.CHAT: return prefs.chat;
      case NOTIFICATION_TYPES.SYSTEM: return prefs.system;
      default: return prefs.general;
    }
  } catch (error) {
    console.error('❌ Error checking notification type:', error);
    return true;
  }
};

// ==================== UTILITY FUNCTIONS ====================

const stringifyDataValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const prepareNotificationData = (data: Record<string, any>): Record<string, string> => {
  const preparedData: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(data)) {
    preparedData[key] = stringifyDataValue(value);
  }
  
  return preparedData;
};

// ==================== SOUND CONFIGURATION ====================

const getPlatformSound = (isOrderNotification: boolean, soundOption: boolean | string, type: string = NOTIFICATION_TYPES.GENERAL): string | undefined => {
  if (!soundOption) return undefined;
  
  if (Platform.OS === PLATFORMS.ANDROID) {
    if (isOrderNotification) {
      return getAndroidSound(type);
    }
    return soundOption === true ? 'default' : soundOption as string;
  } else {
    if (isOrderNotification) {
      return getIOSSoundName(type);
    }
    return 'default';
  }
};

// ==================== NOTIFICATION DISPLAY ====================

const getAndroidChannelId = (type: string = NOTIFICATION_TYPES.GENERAL): string => {
  switch (type) {
    case NOTIFICATION_TYPES.ORDER: 
    case NOTIFICATION_TYPES.NEW_ORDER:
      return ANDROID_CHANNELS.ORDER_ALERTS.id;
    case NOTIFICATION_TYPES.PROMOTION: return ANDROID_CHANNELS.PROMOTIONS.id;
    case NOTIFICATION_TYPES.ALERT: return ANDROID_CHANNELS.ALERTS.id;
    case NOTIFICATION_TYPES.CHAT: return ANDROID_CHANNELS.CHAT.id;
    default: return ANDROID_CHANNELS.DEFAULT.id;
  }
};

const getNotificationColor = (type: string): string => {
  switch (type) {
    case NOTIFICATION_TYPES.ORDER: 
    case NOTIFICATION_TYPES.NEW_ORDER:
      return '#E65C00';
    case NOTIFICATION_TYPES.PROMOTION: return '#E65C00';
    case NOTIFICATION_TYPES.ALERT: return '#E65C00';
    case NOTIFICATION_TYPES.CHAT: return '#E65C00';
    default: return '#E65C00';
  }
};

const getIOSCategoryId = (type: string): string => {
  switch (type) {
    case NOTIFICATION_TYPES.ORDER: 
    case NOTIFICATION_TYPES.NEW_ORDER:
      return 'ORDER_ACTION';
    case NOTIFICATION_TYPES.PROMOTION: return 'promotion';
    case NOTIFICATION_TYPES.ALERT: return 'alert';
    case NOTIFICATION_TYPES.CHAT: return 'chat';
    default: return 'general';
  }
};

const getAndroidIcon = (): string => {
  return 'ic_launcher';
};

export const displayNotification = async (
  title: string,
  body: string,
  options: {
    type?: string;
    imageUrl?: string;
    data?: Record<string, any>;
    sound?: boolean | string;
    vibration?: boolean;
    badge?: boolean;
  } = {}
): Promise<boolean> => {
  try {
    const {
      type = NOTIFICATION_TYPES.GENERAL,
      imageUrl,
      data = {},
      sound = true,
      vibration = true,
      badge = true,
    } = options;
    
    console.log('📤 Displaying notification:', title, 'Type:', type, 'Sound:', sound);
    
    // Check if enabled
    const enabled = await isNotificationTypeEnabled(type);
    if (!enabled) {
      console.log(`⏸️ ${type} notifications are disabled`);
      return false;
    }
    
    const notificationId = `notif_${Date.now()}`;
    
    // Check if this is a new order notification for vendor
    const isNewOrderNotification = type === NOTIFICATION_TYPES.NEW_ORDER || 
                                   data?.type === 'new_order' ||
                                   data?.click_action === 'ORDER_RECEIVED';
    
    const notificationType = isNewOrderNotification ? NOTIFICATION_TYPES.NEW_ORDER : type;
    
    // Prepare notification data
    const notificationData = {
      ...data,
      notification_id: notificationId,
      type: notificationType,
      timestamp: Date.now().toString(),
      action_screen: data.action_screen || 
        (isNewOrderNotification ? 'PartnerScreen' : 
         NOTIFICATION_SCREENS[type.toUpperCase() as keyof typeof NOTIFICATION_SCREENS] || 'Home'),
    };
    
    if (notificationData.params && typeof notificationData.params === 'object') {
      notificationData.params = JSON.stringify(notificationData.params);
    }
    
    const preparedData = prepareNotificationData(notificationData);
    
    console.log('📊 Notification data prepared:', preparedData);
    
    const config: Notification = {
      id: notificationId,
      title,
      body,
      data: preparedData,
    };
    
    // Determine if this needs custom order sound
    const isOrderNotification = isNewOrderNotification || 
                               type === NOTIFICATION_TYPES.ORDER ||
                               data?.type === 'order';
    
    // Platform-specific config
    if (Platform.OS === PLATFORMS.ANDROID) {
      const androidIcon = getAndroidIcon();
      const channelId = getAndroidChannelId(notificationType);
      const androidSound = sound ? getPlatformSound(isOrderNotification, sound, notificationType) : undefined;
      
      config.android = {
        channelId,
        importance: AndroidImportance.HIGH,
        smallIcon: androidIcon,
        color: getNotificationColor(type),
        timestamp: Date.now(),
        showTimestamp: true,
        pressAction: { 
          id: 'default',
          launchActivity: 'default',
        },
        sound: androidSound,
        vibrationPattern: vibration ? (isOrderNotification ? [1000, 500, 1000, 500, 1000, 500] : [300, 500]) : undefined,
      };
      
      // Actions for order notifications
      if (isNewOrderNotification) {
        config.android.actions = [
          {
            title: 'View & Stop Sound',
            pressAction: { id: 'view_and_stop' },
          },
          {
            title: 'Dismiss & Stop',
            pressAction: { id: 'dismiss_and_stop' },
          },
        ];
      } else {
        config.android.actions = [
          {
            title: 'View',
            pressAction: { id: 'view' },
          },
          {
            title: 'Dismiss',
            pressAction: { id: 'dismiss' },
          },
        ];
      }
      
      if (imageUrl) {
        config.android.style = {
          type: AndroidStyle.BIGPICTURE,
          picture: imageUrl,
        };
      }
    } else {
      // iOS config
      const iosSound = sound ? getPlatformSound(isOrderNotification, sound, notificationType) : undefined;
      
      config.ios = {
        categoryId: getIOSCategoryId(notificationType),
        sound: iosSound,
        badge: badge ? 1 : undefined,
      };
      
      if (imageUrl) {
        config.ios.attachments = [{ url: imageUrl }];
      }
    }
    
    // Display notification
    await notifee.displayNotification(config);
    console.log('✅ Notification displayed with ID:', notificationId);
    
    // Play continuous sound for order notifications
    if (isOrderNotification && sound) {
      console.log('🔊 Order notification detected - starting CONTINUOUS alert');
      playOrderNotificationSound(notificationId, notificationType); // Play continuously until manually stopped
    }
    
    // For non-order notifications, just play vibration if needed
    else if (vibration && isOrderNotification) {
      playOrderVibration(10000);
    }
    
    // Save to history
    await saveNotificationToHistory({
      id: notificationId,
      title,
      body,
      type: notificationType,
      data: notificationData,
      timestamp: Date.now(),
      displayedAt: Date.now(),
      read: false,
      playedSound: isOrderNotification,
      continuousSound: isOrderNotification,
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error displaying notification:', error);
    return false;
  }
};

export const displayNotificationFromRemoteMessage = async (
  remoteMessage: FirebaseMessagingTypes.RemoteMessage
): Promise<boolean> => {
  try {
    const { notification, data } = remoteMessage;
    
    if (!notification?.title && !data?.title) {
      console.log('⚠️ No title in remote message');
      return false;
    }
    
    let parsedData: Record<string, any> = {};
    if (data) {
      parsedData = { ...data };
      
      // Check for new order notification from backend
      const isNewOrderNotification = parsedData.click_action === 'ORDER_RECEIVED' || 
                                    parsedData.type === 'new_order';
      
      if (!parsedData.action_screen) {
        parsedData.action_screen = isNewOrderNotification ? 
          'PartnerScreen' : 
          (parsedData.type ? 
            NOTIFICATION_SCREENS[parsedData.type.toUpperCase() as keyof typeof NOTIFICATION_SCREENS] || 
            'Home' : 
            'Home');
      }
    }
    
    const sound = parsedData?.sound !== 'false';
    const vibration = parsedData?.vibration !== 'false';
    const badge = parsedData?.badge !== 'false';
    
    // Determine notification type
    let notificationType = parsedData?.type || NOTIFICATION_TYPES.GENERAL;
    if (parsedData.click_action === 'ORDER_RECEIVED') {
      notificationType = NOTIFICATION_TYPES.NEW_ORDER;
    }
    
    return await displayNotification(
      notification?.title || data?.title || 'Notification',
      notification?.body || data?.body || '',
      {
        type: notificationType,
        imageUrl: data?.image || data?.imageUrl,
        data: parsedData,
        sound,
        vibration,
        badge,
      }
    );
  } catch (error) {
    console.error('❌ Error displaying from remote message:', error);
    return false;
  }
};

// ==================== INITIALIZATION ====================

export const initializeNotificationSystem = async (): Promise<{
  success: boolean;
  hasPermission: boolean;
  token: string | null;
  channelsSetup?: boolean;
  error?: string;
}> => {
  console.log('🚀 Initializing notification system...');
  
  try {
    // 1. Initialize sound system
    console.log('1️⃣ Initializing sound system...');
    initializeSoundSystem();
    
    // 2. Request permission
    console.log('2️⃣ Requesting permission...');
    const hasPermission = await requestNotificationPermission();
    
    if (!hasPermission) {
      console.log('⚠️ Permission not granted');
      return {
        success: false,
        hasPermission: false,
        token: null,
        error: 'Permission denied',
      };
    }
    
    // 3. Setup channels
    console.log('3️⃣ Setting up channels...');
    const channelsSetup = await setupNotificationChannels();
    
    if (!channelsSetup && Platform.OS === PLATFORMS.ANDROID) {
      console.log('⚠️ Failed to setup notification channels');
    }
    
    // 4. Get token
    console.log('4️⃣ Getting FCM token...');
    const token = await getFCMToken();
    
    if (!token) {
      console.log('⚠️ Could not get FCM token');
    }
    
    // 5. Setup refresh listener
    console.log('5️⃣ Setting up token refresh listener...');
    setupTokenRefreshListener();
    
    // 6. Setup notification event listeners
    console.log('6️⃣ Setting up notification event listeners...');
    setupNotificationEventListeners();
    
    // 7. Load preferences
    console.log('7️⃣ Loading preferences...');
    await getNotificationPreferences();
    
    // 8. Check for any active order sound from previous session
    const { isActive, notificationId } = await getActiveOrderSoundState();
    if (isActive && notificationId) {
      console.log(`⚠️ Found active order sound from previous session for notification: ${notificationId}`);
      // Check if notification still exists
      const notifications = await notifee.getDisplayedNotifications();
      const notificationExists = notifications.some(n => n.notification.id === notificationId);
      
      if (!notificationExists) {
        console.log(`🗑️ Previous notification ${notificationId} no longer exists, cleaning up`);
        stopOrderNotificationSound();
      } else {
        console.log(`ℹ️ Previous notification ${notificationId} still exists, sound may still be playing`);
      }
    }
    
    console.log('✅ Notification system initialized successfully!');
    
    return {
      success: true,
      hasPermission: true,
      token,
      channelsSetup,
    };
  } catch (error: any) {
    console.error('❌ Failed to initialize notification system:', error);
    return {
      success: false,
      hasPermission: false,
      token: null,
      error: error.message,
    };
  }
};

// ==================== NOTIFICATION HISTORY ====================

export const saveNotificationToHistory = async (notification: any): Promise<boolean> => {
  try {
    const historyStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_HISTORY) || '[]';
    const history = JSON.parse(historyStr);
    
    history.unshift({
      ...notification,
      id: notification.id || `hist_${Date.now()}`,
      timestamp: Date.now(),
      read: false,
    });
    
    const limited = history.slice(0, 100);
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      JSON.stringify(limited)
    );
    
    return true;
  } catch (error) {
    console.error('❌ Error saving to history:', error);
    return false;
  }
};

export const getNotificationHistory = async (limit: number = 50): Promise<any[]> => {
  try {
    const historyStr = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_HISTORY);
    if (!historyStr) return [];
    
    const parsed = JSON.parse(historyStr);
    return parsed.slice(0, limit);
  } catch (error) {
    console.error('❌ Error getting history:', error);
    return [];
  }
};

export const markNotificationAsRead = async (id: string): Promise<boolean> => {
  try {
    const history = await getNotificationHistory(1000);
    const updated = history.map(item => 
      item.id === id ? { ...item, read: true } : item
    );
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      JSON.stringify(updated)
    );
    
    // If this is an order notification with continuous sound, stop it
    const notification = history.find(item => item.id === id);
    if (notification?.continuousSound) {
      stopSoundForNotification(id);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error marking as read:', error);
    return false;
  }
};

export const markAllNotificationsAsRead = async (): Promise<boolean> => {
  try {
    const history = await getNotificationHistory(1000);
    const updated = history.map(item => ({ ...item, read: true }));
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      JSON.stringify(updated)
    );
    
    // Stop any continuous order sounds
    const hasActiveOrderNotification = history.some(item => 
      item.continuousSound && !item.read
    );
    if (hasActiveOrderNotification) {
      stopOrderNotificationSound();
    }
    
    if (Platform.OS === PLATFORMS.IOS) {
      await resetBadgeCount();
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error marking all as read:', error);
    return false;
  }
};

export const clearNotificationHistory = async (): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_HISTORY, '[]');
    return true;
  } catch (error) {
    console.error('❌ Error clearing history:', error);
    return false;
  }
};

// ==================== BADGE MANAGEMENT ====================

export const getBadgeCount = async (): Promise<number> => {
  try {
    return await notifee.getBadgeCount();
  } catch (error) {
    console.error('❌ Error getting badge count:', error);
    return 0;
  }
};

export const setBadgeCount = async (count: number): Promise<boolean> => {
  try {
    await notifee.setBadgeCount(count);
    return true;
  } catch (error) {
    console.error('❌ Error setting badge count:', error);
    return false;
  }
};

export const incrementBadgeCount = async (): Promise<number> => {
  try {
    const current = await getBadgeCount();
    const newCount = current + 1;
    await setBadgeCount(newCount);
    return newCount;
  } catch (error) {
    console.error('❌ Error incrementing badge count:', error);
    return 0;
  }
};

export const decrementBadgeCount = async (): Promise<number> => {
  try {
    const current = await getBadgeCount();
    const newCount = Math.max(0, current - 1);
    await setBadgeCount(newCount);
    return newCount;
  } catch (error) {
    console.error('❌ Error decrementing badge count:', error);
    return 0;
  }
};

export const resetBadgeCount = async (): Promise<boolean> => {
  try {
    await setBadgeCount(0);
    return true;
  } catch (error) {
    console.error('❌ Error resetting badge count:', error);
    return false;
  }
};

// ==================== CLEANUP ====================

export const clearAllNotifications = async (): Promise<boolean> => {
  try {
    await notifee.cancelAllNotifications();
    await resetBadgeCount();
    stopOrderNotificationSound(); // Stop any continuous sounds
    cleanupSoundSystem();
    console.log('🗑️ All notifications cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    return false;
  }
};

export const clearNotificationById = async (id: string): Promise<boolean> => {
  try {
    await notifee.cancelNotification(id);
    console.log(`🗑️ Notification ${id} cleared`);
    // Also stop sound if it was playing for this notification
    stopSoundForNotification(id);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing notification ${id}:`, error);
    return false;
  }
};

// ==================== TEST FUNCTION ====================

export const showTestNotification = async (type: string = NOTIFICATION_TYPES.GENERAL): Promise<boolean> => {
  try {
    let title = 'Test Notification  ssssss';
    let body = 'This is a test notification';
    let testType = type;
    
    if (type === NOTIFICATION_TYPES.NEW_ORDER || type === NOTIFICATION_TYPES.ORDER) {
      title = '🛎 New Order Received (Continuous)';
      body = 'Order #12345 awaiting confirmation - Sound will play continuously until clicked';
      testType = NOTIFICATION_TYPES.NEW_ORDER;
    }
    
    return await displayNotification(
      title,
      body,
      {
        type: testType,
        data: { 
          test: 'true',
          timestamp: Date.now().toString(),
          action_screen: testType === NOTIFICATION_TYPES.NEW_ORDER ? 'PartnerScreen' : 'Home',
          params: JSON.stringify({ testParam: 'hello' }),
          click_action: testType === NOTIFICATION_TYPES.NEW_ORDER ? 'ORDER_RECEIVED' : undefined,
          type: testType === NOTIFICATION_TYPES.NEW_ORDER ? 'new_order' : 'test',
        },
        sound: true,
        vibration: true,
      }
    );
  } catch (error) {
    console.error('❌ Error showing test notification:', error);
    return false;
  }
};

export const stopAllSounds = (): void => {
  cleanupSoundSystem();
};

// Test functions
export const testVibration = (): void => {
  console.log('🧪 Testing vibration...');
  playOrderVibration(5000);
};

export const testSoundAndVibration = (): void => {
  console.log('🧪 Testing notification with sound and vibration...');
  // showTestNotification('new_order');
};

// Export control functions
export { stopOrderVibration as stopNotificationAlert };
export { stopOrderNotificationSound as stopNotificationSound };
export { cleanupSoundSystem as stopAllNotificationSounds };

// Test function specifically for iOS sound
export const testIOSSound = async (): Promise<void> => {
  console.log('🧪 Testing iOS sound capabilities...');
  
  if (Platform.OS !== 'ios') {
    console.log('❌ This test is for iOS only');
    return;
  }
  
  try {
    console.log('1️⃣ Testing system default sound...');
    const sound1 = new Sound('default', Sound.MAIN_BUNDLE, (error) => {
      if (error) {
        console.error('❌ System default sound failed:', error.message);
      } else {
        console.log('✅ System default sound works');
        sound1.play();
        setTimeout(() => sound1.release(), 1000);
      }
    });
    
    // Wait and test continuous alert
    setTimeout(() => {
      console.log('2️⃣ Testing beep.caf sound...');
      const sound2 = new Sound('beep.caf', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.error('❌ beep.caf sound failed:', error.message);
        } else {
          console.log('✅ beep.caf sound works');
          sound2.play();
          setTimeout(() => sound2.release(), 1000);
        }
      });
      
      // Wait and test continuous alert
      setTimeout(() => {
        console.log('3️⃣ Testing continuous alert...');
        const testNotificationId = `test_${Date.now()}`;
        playOrderNotificationSound(testNotificationId, NOTIFICATION_TYPES.NEW_ORDER);
        
        // Auto-stop after 10 seconds for testing
        setTimeout(() => {
          console.log('4️⃣ Stopping test alert...');
          stopSoundForNotification(testNotificationId);
        }, 10000);
      }, 2000);
      
    }, 2000);
    
  } catch (error) {
    console.error('❌ iOS sound test failed:', error);
  }
};

// Helper function to manually stop continuous order sounds
export const manuallyStopOrderAlerts = (): void => {
  console.log('🛑 Manually stopping all order alerts');
  stopOrderNotificationSound();
};

// Function to check and stop order alerts when user enters PartnerScreen
export const handlePartnerScreenEnter = (): void => {
  console.log('👤 User entered PartnerScreen - checking for active order alerts');
  if (isOrderSoundPlayingNow()) {
    console.log('🛑 Stopping order alerts as user entered PartnerScreen');
    stopOrderNotificationSound();
  }
};

// Function to get current active notification ID
export const getCurrentNotificationId = (): string | null => {
  return currentNotificationId;
};