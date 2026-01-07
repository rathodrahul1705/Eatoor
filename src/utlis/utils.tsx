import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

/**
 * Storage key for session id
 */
const SESSION_ID_KEY = 'SESSION_ID';

/**
 * Generate UUID v4 session id
 */
export const generateSessionId = (): string => {
  return uuid.v4().toString();
};

/**
 * Get persistent session id
 * Creates one if it does not exist
 */
export const getSessionId = async (): Promise<string> => {
  try {
    let sessionId = await AsyncStorage.getItem(SESSION_ID_KEY);

    if (!sessionId) {
      sessionId = generateSessionId();
      await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
    }

    return sessionId;
  } catch (error) {
    console.error('Failed to get session id', error);
    // fallback
    return generateSessionId();
  }
};

/**
 * Regenerate session id (logout / reset)
 */
export const resetSessionId = async (): Promise<string> => {
  const newSessionId = generateSessionId();
  await AsyncStorage.setItem(SESSION_ID_KEY, newSessionId);
  return newSessionId;
};

/**
 * Clear session id completely
 */
export const clearSessionId = async (): Promise<void> => {
  await AsyncStorage.removeItem(SESSION_ID_KEY);
};
