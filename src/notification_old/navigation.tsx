import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------------------------------------
// 🧭 PENDING NAVIGATION HANDLER
// --------------------------------------------------------

/**
 * Handle pending navigation from notifications
 */
export const handlePendingNavigation = async (navigation) => {
  try {
    const pendingNavStr = await AsyncStorage.getItem('pending_navigation');
    
    if (!pendingNavStr) return false;
    
    const pendingNav = JSON.parse(pendingNavStr);
    
    // Check if navigation is too old (more than 10 minutes)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    if (pendingNav.timestamp < tenMinutesAgo) {
      await AsyncStorage.removeItem('pending_navigation');
      return false;
    }
    
    console.log(`🔄 Processing pending navigation to: ${pendingNav.screen}`);
    
    // Navigate to the pending screen
    navigation.navigate(pendingNav.screen, pendingNav.params);
    
    // Clear the pending navigation
    await AsyncStorage.removeItem('pending_navigation');
    
    return true;
  } catch (error) {
    console.error('❌ Error handling pending navigation:', error);
    await AsyncStorage.removeItem('pending_navigation');
    return false;
  }
};

/**
 * Check for pending navigation without navigating
 */
export const checkPendingNavigation = async () => {
  try {
    const pendingNavStr = await AsyncStorage.getItem('pending_navigation');
    return pendingNavStr ? JSON.parse(pendingNavStr) : null;
  } catch (error) {
    console.error('❌ Error checking pending navigation:', error);
    return null;
  }
};

// --------------------------------------------------------
// 📊 NOTIFICATION HISTORY
// --------------------------------------------------------

/**
 * Save notification to history
 */
export const saveNotificationToHistory = async (notification) => {
  try {
    const historyStr = await AsyncStorage.getItem('notification_history') || '[]';
    const history = JSON.parse(historyStr);
    
    // Add new notification at the beginning
    history.unshift({
      ...notification,
      id: notification.data?.notification_id || Date.now().toString(),
      timestamp: Date.now(),
      read: false,
    });
    
    // Keep only last 100 notifications
    const limitedHistory = history.slice(0, 100);
    
    await AsyncStorage.setItem('notification_history', JSON.stringify(limitedHistory));
    return true;
  } catch (error) {
    console.error('❌ Error saving notification to history:', error);
    return false;
  }
};

/**
 * Get notification history
 */
export const getNotificationHistory = async () => {
  try {
    const historyStr = await AsyncStorage.getItem('notification_history') || '[]';
    return JSON.parse(historyStr);
  } catch (error) {
    console.error('❌ Error getting notification history:', error);
    return [];
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const history = await getNotificationHistory();
    const updatedHistory = history.map(notification => ({
      ...notification,
      read: true,
    }));
    
    await AsyncStorage.setItem('notification_history', JSON.stringify(updatedHistory));
    return true;
  } catch (error) {
    console.error('❌ Error marking notifications as read:', error);
    return false;
  }
};

/**
 * Clear notification history
 */
export const clearNotificationHistory = async () => {
  try {
    await AsyncStorage.setItem('notification_history', '[]');
    return true;
  } catch (error) {
    console.error('❌ Error clearing notification history:', error);
    return false;
  }
};