import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import NetInfo from '@react-native-community/netinfo';
import NoInternetScreen from './src/auth/screens/NoInternet';

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
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // 📡 Listen for internet changes
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected === true);
    });

    // 🔥 Initialize notification permissions + channel + token
    initializeNotifications();

    // 🔥 Foreground push notifications
    const unsubscribeForeground = setupForegroundNotificationHandler();

    // 🔥 Handle action button clicks
    setupNotificationActionHandler(navigation);

    // 🔥 Handle navigation on notification tap
    handlePendingNavigation(navigation);

    return () => {
      unsubscribeNetInfo();
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, []);

  // 📌 If offline → Show No Internet Page
  if (!isConnected) {
    return (
      <NoInternetScreen
        onRetry={() => {
          NetInfo.fetch().then(s => setIsConnected(s.isConnected === true));
        }}
      />
    );
  }

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
