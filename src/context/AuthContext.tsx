import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { deviceTokenRemove } from '../api/notification';

interface AuthContextType {
  userToken: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  userToken: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token when app starts
  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        setUserToken(token ?? null);
      } catch (e) {
        console.error("Error loading token:", e);
        setUserToken(null);
      }
      setLoading(false);
    };
    loadToken();
  }, []);

  // ---------------------------------------------------------
  // LOGIN
  // ---------------------------------------------------------
  const login = async (token: string) => {
    try {
      setUserToken(token);
      await AsyncStorage.setItem('accessToken', token);
    } catch (e) {
      console.error("Error saving token:", e);
    }
  };

  // ---------------------------------------------------------
  // LOGOUT (with deviceTokenRemove)
  // ---------------------------------------------------------
  // const logout = async () => {
  //   try {
  //     // 1️⃣ Get FCM token saved in app
  //     const storedFcmToken = await AsyncStorage.getItem('fcm_token');
  //     console.log("📡 Logout: stored FCM token:", storedFcmToken);

  //     // 2️⃣ Remove token from backend (Django)
  //     if (storedFcmToken) {
  //       try {
  //         await deviceTokenRemove(storedFcmToken);
  //         console.log("🗑️ Device token removed from backend");
  //       } catch (err) {
  //         console.log("⚠️ Failed API deviceTokenRemove:", err);
  //       }
  //     }

  //     // 3️⃣ Delete token from Firebase
  //     try {
  //       await messaging().deleteToken();
  //       console.log("🧹 Firebase FCM token deleted");
  //     } catch (err) {
  //       console.log("⚠️ Firebase deleteToken failed:", err);
  //     }

  //     // 🔥🔥🔥 IMPORTANT 🔥🔥🔥
  //     // Force FCM to request a NEW token on next login
  //     try {
  //       await messaging().registerDeviceForRemoteMessages();
  //       console.log("📲 Device re-registered for remote messages");
  //     } catch (err) {
  //       console.log("⚠️ registerDeviceForRemoteMessages failed:", err);
  //     }

  //     // 4️⃣ Clear React state
  //     setUserToken(null);

  //     // 5️⃣ Clear all local keys
  //     const keysToRemove = [
  //       'accessToken',
  //       'refreshToken',
  //       'user',
  //       'AddressId',
  //       'StreetAddress',
  //       'HomeType',
  //       'Latitude',
  //       'Longitude',
  //       'kitchenId',
  //       'fcm_token'
  //     ];

  //     await AsyncStorage.multiRemove(keysToRemove);
  //     console.log("🧼 AsyncStorage cleared");

  //   } catch (e) {
  //     console.error("❌ Error clearing storage on logout:", e);
  //   }
  // };

  const logout = async () => {
  try {
    const storedFcmToken = await AsyncStorage.getItem('fcm_token');
    console.log("📡 Logout: stored FCM token:", storedFcmToken);

    // 1️⃣ Deactivate token on backend
    if (storedFcmToken) {
      try {
        await deviceTokenRemove(storedFcmToken);
        console.log("🗑️ Device token deactivated on backend");
      } catch (err) {
        console.log("⚠️ Failed API deviceTokenRemove:", err);
      }
    }

    // ❌ NEVER delete Firebase token here
    // await messaging().deleteToken();  ⛔ REMOVE
    // await messaging().registerDeviceForRemoteMessages(); ⛔ REMOVE

    // 2️⃣ Clear app state
    setUserToken(null);

    // 3️⃣ Clear local storage (but keep fcm_token!)
    const keysToRemove = [
      'accessToken',
      'refreshToken',
      'user',
      'AddressId',
      'StreetAddress',
      'HomeType',
      'Latitude',
      'Longitude',
      'kitchenId'
      // ❌ REMOVE 'fcm_token'
    ];

    await AsyncStorage.multiRemove(keysToRemove);
    console.log("🧼 AsyncStorage cleared");

  } catch (e) {
    console.error("❌ Error clearing storage on logout:", e);
  }
};


  return (
    <AuthContext.Provider value={{ userToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
