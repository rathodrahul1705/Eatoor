// Re-export all notification functionality from a single entry point

// Service
export {
  requestNotificationPermissions,
  createNotificationChannels,
  getFCMToken,
  getStoredFCMToken,
  displayNotification,
  initializeNotificationSystem,
  saveNotificationPreferences,
  getNotificationPreferences,
  NOTIFICATION_CHANNELS,
} from './service';

// Handlers
export {
  setupForegroundNotificationHandler,
  setupNotificationActionHandlers,
  setupAppStateNotificationHandlers,
} from './handlers';

// Navigation
export {
  handlePendingNavigation,
  checkPendingNavigation,
  saveNotificationToHistory,
  getNotificationHistory,
  markAllNotificationsAsRead,
  clearNotificationHistory,
} from './navigation';

// Utilities
export {
  showTestNotification,
  checkNotificationStatus,
  getBadgeCount,
  setBadgeCount,
  clearAllNotifications,
  getNotificationChannels,
  getDeliveredNotifications,
  isAndroid13Plus,
  isIOS,
  getPlatformNotificationSettings,
} from './utils';