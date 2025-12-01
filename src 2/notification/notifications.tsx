import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------------------------------------
// 🔐 REQUEST iOS NOTIFICATION PERMISSION
// --------------------------------------------------------
export const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  console.log('🔐 Firebase Permission:', enabled ? 'GRANTED' : 'DENIED');
};

// --------------------------------------------------------
// 🔐 REQUEST ANDROID 13+ NOTIFICATION PERMISSION
// --------------------------------------------------------
export const requestAndroidNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    console.log('🔐 Android Permission:', granted);
  }
};

// --------------------------------------------------------
// 🔔 CREATE ANDROID NOTIFICATION CHANNEL
// --------------------------------------------------------
export const createNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    console.log('📡 Android Notification Channel created');
  }
};

// --------------------------------------------------------
// 🔥 SAVE TOKEN TO ASYNC STORAGE
// --------------------------------------------------------
const saveTokenToStorage = async (token) => {
  try {
    await AsyncStorage.setItem('fcm_token', token);
    console.log('💾 Saved token to AsyncStorage');
  } catch (e) {
    console.log('❌ Error saving FCM token:', e);
  }
};

// --------------------------------------------------------
// 🔥 GET STORED TOKEN
// --------------------------------------------------------
export const getStoredFCMToken = async () => {
  try {
    const token = await AsyncStorage.getItem('fcm_token');
    console.log('📦 Stored FCM Token:', token);
    return token;
  } catch (e) {
    console.log('❌ Error reading stored FCM token:', e);
    return null;
  }
};

// --------------------------------------------------------
// 🔥 GET NEW FCM TOKEN
// --------------------------------------------------------
export const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log('📨 FCM Device Token:', token);

    if (token) {
      await saveTokenToStorage(token);
    }

    return token;
  } catch (error) {
    console.log('❌ Error getting FCM token:', error);
    return null;
  }
};

// --------------------------------------------------------
// 🔄 TOKEN REFRESH
// --------------------------------------------------------
export const setupTokenRefreshListener = () => {
  messaging().onTokenRefresh(async (newToken) => {
    console.log('🔄 FCM Token refreshed:', newToken);
    await saveTokenToStorage(newToken);
  });
};

// --------------------------------------------------------
// 🔥 FOREGROUND HANDLER WITH IMAGE + BUTTON
// --------------------------------------------------------
export const setupForegroundNotificationHandler = () => {
  return messaging().onMessage(async (remoteMessage) => {
    console.log('🔥 FOREGROUND LISTENER TRIGGERED');
    console.log('📩 Foreground:', remoteMessage);

    const imageUrl =
      remoteMessage.notification?.android?.image ||
      remoteMessage.notification?.image ||
      remoteMessage.data?.image;

    const actionButton = remoteMessage.data?.action_button || 'Order Now';

    try {
      await notifee.displayNotification({
        title: remoteMessage.notification?.title ?? 'Notification',
        body: remoteMessage.notification?.body ?? '',
        data: remoteMessage.data, // 👈 Pass all data payload
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          style: imageUrl
            ? {
                type: AndroidStyle.BIGPICTURE,
                picture: imageUrl,
              }
            : undefined,

          // ⭐ ACTION BUTTON HERE
          actions: [
            {
              title: actionButton,
              pressAction: {
                id: 'order-now',
              },
            },
          ],
        },
        ios: {
          attachments: imageUrl ? [{ url: imageUrl }] : [],
        },
      });
    } catch (e) {
      console.log('❌ Notifee Error:', e);
    }
  });
};

// --------------------------------------------------------
// 🎯 NOTIFEE ACTION HANDLER (Button Click → Navigate)
// --------------------------------------------------------
export const setupNotificationActionHandler = (navigation) => {
  notifee.onForegroundEvent(({ type, detail }) => {
    const { pressAction, notification } = detail;

    if (type === EventType.ACTION_PRESS && pressAction.id === 'order-now') {
      const screen = notification?.data?.action_screen || 'KitchenPage';

      console.log('🍽 Navigating to:', screen);
      navigation.navigate(screen);
    }
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { pressAction, notification } = detail;

    if (type === EventType.ACTION_PRESS && pressAction.id === 'order-now') {
      const screen = notification?.data?.action_screen || 'KitchenPage';

      console.log('🍽 Background Navigation Target:', screen);
      await AsyncStorage.setItem('pending_navigation', screen);
    }
  });
};

// --------------------------------------------------------
// 🚀 HANDLE APP OPENED FROM BACKGROUND/QUIT
// --------------------------------------------------------
export const setupBackgroundHandlers = () => {
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('➡️ App opened from background:', remoteMessage);
  });

  messaging()
    .getInitialNotification()
    .then(async (remoteMessage) => {
      if (remoteMessage) {
        console.log('🚀 App opened from quit:', remoteMessage);

        const screen =
          remoteMessage.data?.action_screen || 'KitchenPage';

        await AsyncStorage.setItem('pending_navigation', screen);
      }
    });
};

// --------------------------------------------------------
// 🧭 HANDLE PENDING NAVIGATION (CALL IN APP.JS)
// --------------------------------------------------------
export const handlePendingNavigation = async (navigation) => {
  const screen = await AsyncStorage.getItem('pending_navigation');
  if (screen) {
    console.log('🔄 Navigating to pending screen:', screen);
    navigation.navigate(screen);
    await AsyncStorage.removeItem('pending_navigation');
  }
};

// --------------------------------------------------------
// 🔔 TEST NOTIFICATION
// --------------------------------------------------------
export const showTestNotification = async () => {
  try {
    await notifee.displayNotification({
      title: 'Test Popup',
      body: 'If you see this, notifications WORK.',
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
      },
    });
    console.log('📢 Test Notification Shown');
  } catch (e) {
    console.log('❌ Notifee Test Error:', e);
  }
};

// --------------------------------------------------------

// 🚀 INITIALIZE EVERYTHING
// --------------------------------------------------------
export const initializeNotifications = async () => {
  await requestUserPermission();
  await requestAndroidNotificationPermission();
  await createNotificationChannel();
  await getFCMToken();
  setupTokenRefreshListener();
  setupBackgroundHandlers();
};