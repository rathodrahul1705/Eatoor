import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

// 🔔 Notification Service Imports
import {
  initializeNotifications,
  setupForegroundNotificationHandler,
  setupNotificationActionHandler,
  handlePendingNavigation
} from './src/notification/notifications';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <InnerApp isDarkMode={isDarkMode} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

// 🧠 Separate inner component to access navigation
const InnerApp = ({ isDarkMode }) => {
  const navigation = useNavigation();

  useEffect(() => {
    // 🔥 Initialize notification permissions + channel + token
    initializeNotifications();

    // 🔥 Foreground push notifications
    const unsubscribeForeground = setupForegroundNotificationHandler();

    // 🔥 Handle action button clicks (foreground & background)
    setupNotificationActionHandler(navigation);

    // 🔥 If app opened from quit/background via button → navigate
    handlePendingNavigation(navigation);

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, []);

  return (
    <>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </>
  );
};

export default App;