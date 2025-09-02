import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Run once when app starts
  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          setUserToken(token);
        } else {
          setUserToken(null);
        }
      } catch (e) {
        console.error("Error loading token:", e);
        setUserToken(null);
      }
      setLoading(false);
    };
    loadToken();
  }, []);

  const login = async (token: string) => {
    try {
      setUserToken(token);
      await AsyncStorage.setItem('accessToken', token);
    } catch (e) {
      console.error("Error saving token:", e);
    }
  };

  const logout = async () => {
    try {

        setUserToken(null);

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
        ];

        await AsyncStorage.multiRemove(keysToRemove);
    } catch (e) {
        console.error("Error clearing storage on logout:", e);
    }
};

  return (
    <AuthContext.Provider value={{ userToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
