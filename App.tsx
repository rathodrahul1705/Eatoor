import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

// 🔔 Notification Service Imports
import {
  initializeNotifications,
  setupForegroundNotificationHandler
} from './src/notification/notifications';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // 🔥 Initialize notification setup
    initializeNotifications();

    // 🔥 Foreground notification listener
    const unsubscribe = setupForegroundNotificationHandler();

    // Cleanup
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar
            barStyle={isDarkMode ? 'light-content' : 'dark-content'}
            backgroundColor="transparent"
            translucent
          />

          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
