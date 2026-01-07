// src/notification/index.tsx
// Main exports file

// Export everything from service
export {
  // Core functions
  initializeNotificationSystem,
  requestNotificationPermission,
  setupNotificationChannels,
  
  // Token management
  getFCMToken,
  getStoredFCMToken,
  saveFCMToken,
  setupTokenRefreshListener,
  
  // Notification display
  displayNotification,
  displayNotificationFromRemoteMessage,
  // showTestNotification,
  
  // Preferences
  getNotificationPreferences,
  saveNotificationPreferences,
  isNotificationTypeEnabled,
  
  // Badge management
  getBadgeCount,
  setBadgeCount,
  resetBadgeCount,
  
  // Cleanup
  clearAllNotifications,
  
  // History
  getNotificationHistory,
  saveNotificationToHistory,
  
  // Constants
  NOTIFICATION_TYPES,
  STORAGE_KEYS,
  DEFAULT_PREFERENCES,
  NOTIFICATION_SCREENS,
  PLATFORMS,
  ANDROID_CHANNELS,
} from './notification.service';

// Export from handlers
export {
  setupForegroundNotificationHandler,
  setupNotificationActionHandlers,
  setupAppStateNotificationHandlers,
} from './notification.handlers';

// Export from navigation
export {
  handlePendingNavigation,
  checkPendingNavigation,
  savePendingNavigation,
  clearPendingNavigation,
} from './notification.navigation';

// Export from utilities
export {
  checkNotificationSettings,
  isAndroid13Plus,
  isIOS,
  getPlatformInfo,
  openNotificationSettings,
  scheduleNotification,
  cancelScheduledNotification,
} from './notification.utils';