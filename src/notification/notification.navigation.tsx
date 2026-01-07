// src/notification/notification.navigation.tsx
// Navigation-related notification functions

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationProp } from '@react-navigation/native';
import { STORAGE_KEYS } from './notification.service';

interface PendingNavigation {
  screen: string;
  params?: Record<string, any>;
  timestamp: number;
  notificationId?: string;
}

// ==================== PENDING NAVIGATION ====================

export const handlePendingNavigation = async (
  navigation: NavigationProp<any>
): Promise<boolean> => {
  try {
    const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_NAVIGATION);
    if (!pendingStr) return false;
    
    const pending: PendingNavigation = JSON.parse(pendingStr);
    
    // Check if navigation is stale (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    if (pending.timestamp < tenMinutesAgo) {
      await clearPendingNavigation();
      return false;
    }
    
    console.log(`🔄 Navigating to pending screen: ${pending.screen}`);
    
    // Navigate to the pending screen
    navigation.navigate(pending.screen as never, pending.params as never);
    
    // Clear pending navigation
    await clearPendingNavigation();
    
    return true;
  } catch (error) {
    console.error('❌ Error handling pending navigation:', error);
    await clearPendingNavigation();
    return false;
  }
};

export const checkPendingNavigation = async (): Promise<PendingNavigation | null> => {
  try {
    const pendingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_NAVIGATION);
    if (!pendingStr) return null;
    
    return JSON.parse(pendingStr);
  } catch (error) {
    console.error('❌ Error checking pending navigation:', error);
    return null;
  }
};

export const savePendingNavigation = async (
  screen: string,
  params?: Record<string, any>,
  notificationId?: string
): Promise<boolean> => {
  try {
    const pending: PendingNavigation = {
      screen,
      params: params || {},
      timestamp: Date.now(),
      notificationId,
    };
    
    await AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_NAVIGATION,
      JSON.stringify(pending)
    );
    
    return true;
  } catch (error) {
    console.error('❌ Error saving pending navigation:', error);
    return false;
  }
};

export const clearPendingNavigation = async (): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_NAVIGATION);
    return true;
  } catch (error) {
    console.error('❌ Error clearing pending navigation:', error);
    return false;
  }
};