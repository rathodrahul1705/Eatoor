import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StatusBar, useColorScheme, AppState, Platform } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';

import NoInternetScreen from './src/auth/screens/NoInternet';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

// Import notification services
import {
  initializeNotificationSystem,
  setupForegroundNotificationHandler,
  setupNotificationActionHandlers,
  setupAppStateNotificationHandlers,
  handlePendingNavigation,
  checkNotificationSettings,
  // showTestNotification,
} from './src/notification';

const App: React.FC = () => {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <MainApp isDarkMode={isDarkMode} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

interface MainAppProps {
  isDarkMode: boolean;
}

const MainApp: React.FC<MainAppProps> = ({ isDarkMode }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const appState = useRef<string>(AppState.currentState);
  const unsubscribeRefs = useRef<(() => void)[]>([]); // Store unsubscribe functions

  // Add this function to check for icon issues
  const checkAndroidNotificationIcon = () => {
    if (Platform.OS === 'android') {
      console.log('🔍 Checking Android notification icon...');
      // You can add icon validation logic here
    }
  };

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      appState.current = nextAppState;
      
      // App came to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        handleAppForeground();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppForeground = useCallback(async () => {
    console.log('📱 App came to foreground');
    
    // Check for pending navigation
    if (navigationRef.current) {
      await handlePendingNavigation(navigationRef.current);
    }
    
    // Refresh notification status
    await checkNotificationSettings();
  }, []);

  // Initialize notification system (without navigation dependencies)
  useEffect(() => {
    const initNotifications = async () => {
      try {
        console.log('🚀 Starting notification initialization...');
        
        const result = await initializeNotificationSystem();
        
        if (result.success) {
          console.log('✅ Notification system initialized successfully');
          
          // Setup background handlers (these don't need navigation)
          setupAppStateNotificationHandlers();
        } else {
          console.warn('⚠️ Notification initialization issues:', result.error);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize notifications:', error);
        setIsInitialized(true); // Mark as initialized anyway
      }
    };

    // Delay initialization a bit
    const initTimeout = setTimeout(() => {
      initNotifications();
    }, 500);

    return () => {
      clearTimeout(initTimeout);
    };
  }, []);

  // Setup notification handlers AFTER navigation is ready
  const setupNotificationHandlers = useCallback(() => {
    console.log('🔧 Setting up notification handlers with navigation...');
    
    if (!navigationRef.current) {
      console.error('❌ Navigation ref is not ready');
      return;
    }
    
    // Clean up any existing handlers first
    cleanupNotificationHandlers();
    
    // Setup action handlers
    const unsubscribeActions = setupNotificationActionHandlers(navigationRef.current);
    if (unsubscribeActions) {
      unsubscribeRefs.current.push(unsubscribeActions);
    }
    // showTestNotification()
    // Setup foreground handler
    const unsubscribeForeground = setupForegroundNotificationHandler();
    if (unsubscribeForeground) {
      unsubscribeRefs.current.push(unsubscribeForeground);
    }
    
    console.log('✅ Notification handlers setup complete');
  }, []);

  const cleanupNotificationHandlers = useCallback(() => {
    console.log('🧹 Cleaning up notification handlers...');
    unsubscribeRefs.current.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    unsubscribeRefs.current = [];
  }, []);

  // Handle navigation ready - THIS IS KEY
  const onNavigationReady = useCallback(() => {
    console.log('✅ NavigationContainer is ready');
    
    // Now setup notification handlers with the navigation ref
    setupNotificationHandlers();
    
    // Check for pending navigation
    if (navigationRef.current) {
      // Small delay to ensure everything is mounted
      setTimeout(() => {
        console.log('🔍 Checking for pending navigation...');
        handlePendingNavigation(navigationRef.current!);
      }, 1000);
    }
  }, [setupNotificationHandlers]);

  // Listen for internet connection
  useEffect(() => {
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected === true);
    });

    return () => {
      unsubscribeNetInfo();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupNotificationHandlers();
    };
  }, [cleanupNotificationHandlers]);

  // Show no internet screen
  if (!isConnected) {
    return (
      <NoInternetScreen
        onRetry={() => {
          NetInfo.fetch().then(state => setIsConnected(state.isConnected === true));
        }}
      />
    );
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={onNavigationReady}
      onStateChange={() => {
        // Optional: Log navigation state changes for debugging
        console.log('🧭 Navigation state changed');
      }}
    >
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </NavigationContainer>
  );
};

export default App;