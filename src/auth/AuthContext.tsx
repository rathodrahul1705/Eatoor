import AsyncStorage from "@react-native-async-storage/async-storage";

export const getUserId = async () => {
  try {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      const parsedData = JSON.parse(userData);
      return parsedData.id || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return 0;
  }
};