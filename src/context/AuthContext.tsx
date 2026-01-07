import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { deviceTokenRemove } from '../api/notification';

interface AuthContextType {
  userToken: string | null;
  loading: boolean;
  isGuest: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  convertGuestToUser: (token: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  userToken: null,
  loading: true,
  isGuest: false,
  login: async () => {},
  logout: async () => {},
  loginAsGuest: async () => {},
  convertGuestToUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  
  // Load auth state when app starts
  useEffect(() => {
    // Update the loadAuthState function in your AuthContext
  const loadAuthState = async () => {
    try {
      console.log("🔍 AuthContext: Loading auth state...");
      
      const token = await AsyncStorage.getItem('accessToken');
      const guestStatus = await AsyncStorage.getItem('isGuest');
      
      console.log("🔍 AuthContext: Found - token:", !!token, "guestStatus:", guestStatus);
      
      // Handle all possible states
      if (token) {
        // We have a token - must be a logged in user
        console.log("✅ AuthContext: Regular user detected");
        setUserToken(token);
        setIsGuest(false);
        
        // Ensure isGuest flag is correctly set
        if (guestStatus === 'true') {
          console.log("⚠️ AuthContext: Fixing inconsistent state - removing isGuest flag");
          await AsyncStorage.setItem('isGuest', 'false');
        }
      } else if (guestStatus === 'true') {
        // No token but isGuest is true - guest user
        console.log("👤 AuthContext: Guest user detected");
        setUserToken(null);
        setIsGuest(true);
        
        // Ensure accessToken is removed
        await AsyncStorage.removeItem('accessToken');
      } else {
        // No auth state - first time user
        console.log("👋 AuthContext: No auth state detected");
        setUserToken(null);
        setIsGuest(false);
        
        // Clear both to be safe
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('isGuest');
      }
    } catch (e) {
      console.error("❌ AuthContext: Error loading auth state:", e);
      setUserToken(null);
      setIsGuest(false);
    } finally {
      console.log("🏁 AuthContext: Loading complete");
      setLoading(false);
    }
  };
    
    loadAuthState();
  }, []);

  // ---------------------------------------------------------
  // REGULAR USER LOGIN
  // ---------------------------------------------------------
  const login = useCallback(async (token: string) => {
    try {
      console.log("🔑 Regular user login");
      setUserToken(token);
      setIsGuest(false);
      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('isGuest', 'false');
    } catch (e) {
      console.error("❌ Error saving token:", e);
    }
  }, []);

  // ---------------------------------------------------------
  // GUEST LOGIN
  // ---------------------------------------------------------
  const loginAsGuest = useCallback(async () => {
    try {
      console.log("👤 Guest login");
      // Guest users should NOT have an accessToken
      // They are identified only by isGuest flag
      setUserToken(null);
      setIsGuest(true);
      
      await AsyncStorage.setItem('isGuest', 'true');
      await AsyncStorage.removeItem('accessToken'); // Ensure no token exists
      
      console.log("✅ Logged in as guest");
    } catch (e) {
      console.error("❌ Error logging in as guest:", e);
    }
  }, []);

  // ---------------------------------------------------------
  // CONVERT GUEST TO REGISTERED USER
  // ---------------------------------------------------------
  const convertGuestToUser = useCallback(async (token: string) => {
    try {
      console.log("🔄 Converting guest to registered user");
      
      // Clear guest state first
      await AsyncStorage.removeItem('isGuest');
      
      // Set regular user state
      setUserToken(token);
      setIsGuest(false);
      
      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('isGuest', 'false');
      
      console.log("✅ Guest converted to registered user");
    } catch (e) {
      console.error("❌ Error converting guest to user:", e);
    }
  }, []);

  // ---------------------------------------------------------
  // LOGOUT (works for both regular users and guests)
  // ---------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      console.log("🚪 Logout called, isGuest:", isGuest);
      
      // Only call backend token removal for registered users
      if (userToken && !isGuest) {
        const storedFcmToken = await AsyncStorage.getItem('fcm_token');
        console.log("📡 Logout: stored FCM token:", storedFcmToken);

        if (storedFcmToken) {
          try {
            await deviceTokenRemove(storedFcmToken);
            console.log("🗑️ Device token deactivated on backend");
          } catch (err) {
            console.log("⚠️ Failed API deviceTokenRemove:", err);
          }
        }
      }

      // Clear app state
      setUserToken(null);
      setIsGuest(false);

      // Clear local storage
      const keysToRemove = [
        'accessToken',
        'refreshToken',
        'user',
        'AddressId',
        'StreetAddress',
        'HomeType',
        'Latitude',
        'Longitude',
        'kitchenId',
        'isGuest',
        'is_restaurant_register'
      ];

      await AsyncStorage.multiRemove(keysToRemove);
      console.log("🧼 AsyncStorage cleared");

    } catch (e) {
      console.error("❌ Error clearing storage on logout:", e);
    }
  }, [isGuest, userToken]);

  // Create context value object
  const contextValue = React.useMemo(() => ({
    userToken,
    loading,
    isGuest,
    login,
    logout,
    loginAsGuest,
    convertGuestToUser,
  }), [userToken, loading, isGuest, login, logout, loginAsGuest, convertGuestToUser]);

  console.log("🔧 AuthContext State - userToken:", !!userToken, "isGuest:", isGuest, "loading:", loading);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};