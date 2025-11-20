import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';

// -------------------------------------------
// 🔥 REQUEST iOS & FIREBASE PERMISSION
// -------------------------------------------
export const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  console.log("🔐 Firebase Permission:", enabled ? "GRANTED" : "DENIED");
};

// -------------------------------------------
// 🔥 ANDROID 13+ NOTIFICATION PERMISSION
// -------------------------------------------
export const requestAndroidNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    console.log("🔐 Android Permission:", granted);
  }
};

// -------------------------------------------
// 🔔 CREATE ANDROID CHANNEL
// -------------------------------------------
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

// -------------------------------------------
// 🔥 GET FCM TOKEN
// -------------------------------------------
export const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log("📨 FCM Device Token:", token);
    return token;
  } catch (error) {
    console.log("❌ Error getting FCM token:", error);
    return null;
  }
};

// -------------------------------------------
// 🔥 HANDLE FOREGROUND NOTIFICATIONS
// -------------------------------------------
export const setupForegroundNotificationHandler = () => {
  return messaging().onMessage(async remoteMessage => {
    console.log("🔥 FOREGROUND LISTENER TRIGGERED");
    console.log("📩 Foreground:", remoteMessage);

    try {
      await notifee.displayNotification({
        title: remoteMessage.notification?.title ?? 'Notification',
        body: remoteMessage.notification?.body ?? '',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
        },
      });
    } catch (e) {
      console.log("❌ Notifee Error:", e);
    }
  });
};

// -------------------------------------------
// 🔥 TEST NOTIFICATION (ON START)
// -------------------------------------------
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

// -------------------------------------------
// 🔥 BACKGROUND & QUIT STATE HANDLERS
// -------------------------------------------
export const setupBackgroundHandlers = () => {
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log("➡️ App opened from background:", remoteMessage);
  });

  messaging().getInitialNotification().then(remoteMessage => {
    if (remoteMessage) {
      console.log("🚀 App opened from quit:", remoteMessage);
    }
  });
};
