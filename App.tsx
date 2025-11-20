import React, { useEffect } from 'react';
import { Platform, StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  requestUserPermission,
  requestAndroidNotificationPermission,
  createNotificationChannel,
  getFCMToken,
  setupForegroundNotificationHandler,
  showTestNotification,
  setupBackgroundHandlers,
} from './src/notification/notifications.js';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  // INITIAL SETUP
  useEffect(() => {
    requestUserPermission();
    requestAndroidNotificationPermission();
    createNotificationChannel();
    getFCMToken();
  }, []);

  // FOREGROUND NOTIFICATION
  useEffect(() => {
    const unsubscribe = setupForegroundNotificationHandler();
    return unsubscribe;
  }, []);

  // TEST POPUP
  // useEffect(() => {
  //   showTestNotification();
  // }, []);

  // BACKGROUND + QUIT HANDLERS
  useEffect(() => {
    setupBackgroundHandlers();
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar
              barStyle={isDarkMode ? 'light-content' : 'dark-content'}
              backgroundColor="#fff"
            />
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
