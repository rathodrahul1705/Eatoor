import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar 
              barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
              backgroundColor="#fff" 
            />
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
