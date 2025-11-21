import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidStyle } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------------------------------------
// 🔐 REQUEST iOS NOTIFICATION PERMISSION
// --------------------------------------------------------
export const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  console.log("🔐 Firebase Permission:", enabled ? "GRANTED" : "DENIED");
};

// --------------------------------------------------------
// 🔐 REQUEST ANDROID 13+ NOTIFICATION PERMISSION
// --------------------------------------------------------
export const requestAndroidNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    console.log("🔐 Android Permission:", granted);
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

    console.log("📡 Android Notification Channel created");
  }
};

// --------------------------------------------------------
// 🔥 SAVE TOKEN TO ASYNC STORAGE
// --------------------------------------------------------
const saveTokenToStorage = async (token) => {
  try {
    await AsyncStorage.setItem("fcm_token", token);
    console.log("💾 Saved token to AsyncStorage");
  } catch (e) {
    console.log("❌ Error saving FCM token:", e);
  }
};

// --------------------------------------------------------
// 🔥 GET TOKEN FROM STORAGE
// --------------------------------------------------------
export const getStoredFCMToken = async () => {
  try {
    const token = await AsyncStorage.getItem("fcm_token");
    console.log("📦 Stored FCM Token:", token);
    return token;
  } catch (e) {
    console.log("❌ Error reading stored FCM token:", e);
    return null;
  }
};

// --------------------------------------------------------
// 🔥 GET FCM TOKEN (AND SAVE TO STORAGE)
// --------------------------------------------------------
export const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log("📨 FCM Device Token:", token);

    if (token) {
      await saveTokenToStorage(token);
    }

    return token;
  } catch (error) {
    console.log("❌ Error getting FCM token:", error);
    return null;
  }
};

// --------------------------------------------------------
// 🔄 HANDLE TOKEN REFRESH
// --------------------------------------------------------
export const setupTokenRefreshListener = () => {
  messaging().onTokenRefresh(async (newToken) => {
    console.log("🔄 FCM Token refreshed:", newToken);
    await saveTokenToStorage(newToken);
  });
};

// --------------------------------------------------------
// 🔥 FOREGROUND NOTIFICATION HANDLER (WITH IMAGE)
// --------------------------------------------------------
export const setupForegroundNotificationHandler = () => {
  return messaging().onMessage(async (remoteMessage) => {
    console.log("🔥 FOREGROUND LISTENER TRIGGERED");
    console.log("📩 Foreground:", remoteMessage);

    const imageUrl =
      remoteMessage.notification?.android?.image ||
      remoteMessage.notification?.image ||
      remoteMessage.data?.image; // ⭐ ADDED

    try {
      await notifee.displayNotification({
        title: remoteMessage.notification?.title ?? 'Notification',
        body: remoteMessage.notification?.body ?? '',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          // ⭐ ADDED — Android Big Picture Notification
          style: imageUrl
            ? {
                type: AndroidStyle.BIGPICTURE,
                picture: imageUrl,
              }
            : undefined,
        },
        ios: {
          // ⭐ ADDED — iOS image support
          attachments: imageUrl
            ? [{ url: imageUrl }]
            : [],
        },
      });
    } catch (e) {
      console.log("❌ Notifee Error:", e);
    }
  });
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
    console.log("📢 Test Notification Shown");
  } catch (e) {
    console.log("❌ Notifee Test Error:", e);
  }
};

// --------------------------------------------------------
// 🚀 BACKGROUND & QUIT STATE HANDLERS
// --------------------------------------------------------
export const setupBackgroundHandlers = () => {
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log("➡️ App opened from background:", remoteMessage);
  });

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log("🚀 App opened from quit:", remoteMessage);
      }
    });
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
