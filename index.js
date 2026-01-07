/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';


// 🔥 Background notifications
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log("Message handled in background:", remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);

