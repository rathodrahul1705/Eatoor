// src/notification/notification.handlers.tsx
// Dynamic notification handlers with support for TRACK_ORDER, HOMENAVIGATE, and ORDER_RECEIVED

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { Event, EventType } from '@notifee/react-native';
import { NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { displayNotificationFromRemoteMessage } from './notification.service';
import { STORAGE_KEYS } from './notification.service';

// ==================== NAVIGATION LOGIC ====================

interface NavigationParams {
  [key: string]: any;
  order?: {
    order_number: string;
  };
  notificationData?: any;
  fromNotification?: boolean;
}

/**
 * Navigates to screen based on notification data
 */
const navigateBasedOnNotification = async (
  navigation: NavigationProp<any>,
  notificationData: any
): Promise<void> => {
  console.log('🧭 Navigating based on notification data:', notificationData);
  
  // Get click_action from notification (normalized to uppercase)
  const clickAction = notificationData.click_action?.toUpperCase() || '';
  
  // Get dynamic screen name from action_screen
  const dynamicScreen = notificationData.action_screen;
  
  // Get order number from notification data
  const orderNumber = notificationData.order_number || notificationData.orderId;
  
  // Get restaurant ID from notification data
  const restaurantId = notificationData.restaurant_id || notificationData.restaurantId;
  
  let targetScreen = 'Home';
  let navigationParams: NavigationParams = {
    fromNotification: true,
    notificationData: notificationData
  };
  
  // Check if we have a dynamic screen from action_screen
  if (dynamicScreen) {
    targetScreen = dynamicScreen;
    console.log('🎯 Using dynamic screen from action_screen:', targetScreen);
    
    // Special handling for ORDER_RECEIVED -> PartnerScreen
    if (clickAction === 'ORDER_RECEIVED' && dynamicScreen === 'PartnerScreen') {
      navigationParams = {
        ...navigationParams,
        fromNotification: true,
        notificationData: {
          ...notificationData,
          restaurantId: restaurantId,
          orderId: orderNumber,
          order_number: orderNumber,
          click_action: clickAction,
          action_screen: dynamicScreen,
          type: notificationData.type || 'new_order'
        }
      };
    }
    // For TRACK_ORDER, add order data if available
    else if (clickAction === 'TRACK_ORDER' && orderNumber) {
      navigationParams = {
        ...navigationParams,
        order: { 
          order_number: orderNumber 
        }
      };
    } else {
      // For other actions, parse any additional params
      if (notificationData.params) {
        try {
          const parsedParams = JSON.parse(notificationData.params);
          navigationParams = {
            ...navigationParams,
            ...parsedParams
          };
        } catch (error) {
          console.warn('⚠️ Failed to parse params:', error);
        }
      }
    }
  }
  // If no dynamic screen, use click_action mapping
  else {
    switch (clickAction) {
      case 'TRACK_ORDER':
        targetScreen = 'TrackOrder';
        if (orderNumber) {
          navigationParams = {
            ...navigationParams,
            order: { 
              order_number: orderNumber 
            }
          };
        }
        break;
        
      case 'HOMENAVIGATE':
        // HOMENAVIGATE should go to home if no specific screen is provided
        targetScreen = 'Home';
        break;
        
      case 'ORDER_RECEIVED':
        targetScreen = 'PartnerScreen';
        navigationParams = {
          ...navigationParams,
          fromNotification: true,
          notificationData: {
            ...notificationData,
            restaurantId: restaurantId,
            orderId: orderNumber,
            order_number: orderNumber,
            click_action: clickAction,
            type: notificationData.type || 'new_order'
          }
        };
        break;
        
      default:
        targetScreen = 'Home';
    }
  }
  
  console.log('🚀 Final navigation:', {
    targetScreen,
    navigationParams,
    clickAction,
    hasOrderNumber: !!orderNumber,
    hasRestaurantId: !!restaurantId,
    hasDynamicScreen: !!dynamicScreen
  });
  
  // Perform navigation
  try {
    await performNavigation(navigation, targetScreen, navigationParams);
  } catch (error) {
    console.error('❌ Navigation failed:', error);
    // Fallback to Home
    await performNavigation(navigation, 'Home', {});
  }
};

/**
 * Helper function to perform navigation
 */
const performNavigation = async (
  navigation: NavigationProp<any>,
  screen: string,
  params: NavigationParams
): Promise<void> => {
  console.log('🧭 Performing navigation to:', screen);
  
  if (!navigation || typeof navigation.navigate !== 'function') {
    throw new Error('Invalid navigation object');
  }
  
  try {
    // For PartnerScreen, we need to pass notification data
    if (screen === 'PartnerScreen') {
      console.log('📋 Passing notification data to PartnerScreen:', params.notificationData);
    }
    
    // Direct navigation
    navigation.navigate(screen as never, params as never);
    console.log('✅ Navigation performed successfully');
  } catch (error) {
    console.error('❌ Navigation error:', error);
    
    // Fallback to Home
    try {
      navigation.navigate('Home' as never, {} as never);
    } catch (fallbackError) {
      console.error('❌ Fallback navigation failed:', fallbackError);
    }
  }
};

// ==================== FOREGROUND HANDLER ====================

export const setupForegroundNotificationHandler = (): (() => void) => {
  console.log('🔥 Setting up foreground handler');
  
  const unsubscribe = messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.log('📩 Foreground message received');
    await displayNotificationFromRemoteMessage(remoteMessage);
  });
  
  return unsubscribe;
};

// ==================== NOTIFICATION ACTION HANDLER ====================

export const setupNotificationActionHandlers = (
  navigation: NavigationProp<any>
): (() => void) => {
  console.log('🎯 Setting up action handlers');
  
  // Handle foreground events
  const unsubscribeForeground = notifee.onForegroundEvent(async (event: Event) => {
    await handleNotificationEvent(event, navigation);
  });
  
  // Handle background events
  notifee.onBackgroundEvent(async (event: Event) => {
    await handleBackgroundNotificationEvent(event);
  });
  
  return unsubscribeForeground;
};

const handleNotificationEvent = async (
  event: Event,
  navigation: NavigationProp<any>
): Promise<void> => {
  const { type, detail } = event;
  
  switch (type) {
    case EventType.PRESS:
      console.log('👆 Notification pressed');
      await handleNotificationPress(detail.notification, navigation);
      break;
      
    case EventType.ACTION_PRESS:
      console.log('🎯 Action pressed:', detail.pressAction?.id);
      await handleActionPress(detail.pressAction?.id, detail.notification, navigation);
      break;
      
    default:
      console.log('📨 Unhandled event type:', type);
  }
};

const handleNotificationPress = async (
  notification: any,
  navigation: NavigationProp<any>
): Promise<void> => {
  console.log('👆 Starting handleNotificationPress');
  
  if (!notification || !notification.data) {
    console.error('❌ No notification data');
    return;
  }
  
  // Extract data
  let notificationData = notification.data.data || notification.data;
  
  if (!notificationData) {
    console.error('❌ Could not extract notification data');
    return;
  }
  
  // Check navigation object
  if (!navigation || typeof navigation.navigate !== 'function') {
    console.error('❌ Navigation object is invalid');
    return;
  }
  
  console.log('📊 Notification data:', notificationData);
  
  // Navigate based on notification data
  await navigateBasedOnNotification(navigation, notificationData);
  
  // Mark as read
  await markNotificationAsRead(notificationData);
};

const handleActionPress = async (
  actionId: string | undefined,
  notification: any,
  navigation: NavigationProp<any>
): Promise<void> => {
  console.log('🎯 Starting handleActionPress');
  
  if (!actionId || !notification?.data) {
    console.error('❌ Invalid action or notification data');
    return;
  }
  
  // Extract data
  const notificationData = notification.data.data || notification.data;
  
  // For dismiss action, just mark as read
  if (actionId === 'dismiss') {
    console.log('❎ Notification dismissed via action');
    await markNotificationAsRead(notificationData);
    return;
  }
  
  // For all other actions, navigate based on notification data
  await navigateBasedOnNotification(navigation, notificationData);
  
  // Mark as read
  await markNotificationAsRead(notificationData);
};

const handleBackgroundNotificationEvent = async (event: Event): Promise<void> => {
  console.log('🌙 Handling background notification event');
  
  const { type, detail } = event;
  
  if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
    // Extract data
    const notificationData = detail.notification?.data?.data || detail.notification?.data;
    
    if (!notificationData) {
      console.error('❌ No data in background notification');
      return;
    }
    
    // Get click action and dynamic screen
    const clickAction = notificationData.click_action?.toUpperCase() || '';
    const dynamicScreen = notificationData.action_screen;
    const orderNumber = notificationData.order_number || notificationData.orderId;
    const restaurantId = notificationData.restaurant_id || notificationData.restaurantId;
    
    let screen = 'Home';
    let params: NavigationParams = {
      fromNotification: true,
      notificationData: notificationData
    };
    
    // Use dynamic screen if available
    if (dynamicScreen) {
      screen = dynamicScreen;
      console.log('🌙 Using dynamic screen from action_screen:', screen);
      
      // Special handling for ORDER_RECEIVED -> PartnerScreen
      if (clickAction === 'ORDER_RECEIVED' && dynamicScreen === 'PartnerScreen') {
        params = {
          ...params,
          fromNotification: true,
          notificationData: {
            ...notificationData,
            restaurantId: restaurantId,
            orderId: orderNumber,
            order_number: orderNumber,
            click_action: clickAction,
            action_screen: dynamicScreen,
            type: notificationData.type || 'new_order'
          }
        };
      }
      // For TRACK_ORDER, add order data
      else if (clickAction === 'TRACK_ORDER' && orderNumber) {
        params = {
          ...params,
          order: { 
            order_number: orderNumber 
          }
        };
      } else {
        // Parse any additional params
        if (notificationData.params) {
          try {
            const parsedParams = JSON.parse(notificationData.params);
            params = {
              ...params,
              ...parsedParams
            };
          } catch (error) {
            console.warn('⚠️ Failed to parse params in background:', error);
          }
        }
      }
    }
    // Fallback to click_action mapping
    else {
      switch (clickAction) {
        case 'TRACK_ORDER':
          screen = 'TrackOrder';
          if (orderNumber) {
            params = {
              ...params,
              order: { 
                order_number: orderNumber 
              }
            };
          }
          break;
          
        case 'HOMENAVIGATE':
          screen = 'Home';
          break;
          
        case 'ORDER_RECEIVED':
          screen = 'PartnerScreen';
          params = {
            ...params,
            fromNotification: true,
            notificationData: {
              ...notificationData,
              restaurantId: restaurantId,
              orderId: orderNumber,
              order_number: orderNumber,
              click_action: clickAction,
              type: notificationData.type || 'new_order'
            }
          };
          break;
          
        default:
          screen = 'Home';
      }
    }
    
    console.log(`🌙 Background navigation to: ${screen}`);
    
    // Save pending navigation
    const pendingNav = {
      screen,
      params,
      timestamp: Date.now(),
      clickAction,
      actionScreen: dynamicScreen,
      restaurantId: restaurantId,
      orderNumber: orderNumber
    };
    
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_NAVIGATION,
        JSON.stringify(pendingNav)
      );
      console.log('✅ Pending navigation saved');
    } catch (error) {
      console.error('❌ Error saving pending navigation:', error);
    }
    
    // Mark as read
    await markNotificationAsRead(notificationData);
  }
};

const markNotificationAsRead = async (notificationData: any): Promise<void> => {
  const notificationId = notificationData.id || notificationData.notification_id;
  
  if (notificationId) {
    console.log('📝 Marking notification as read:', notificationId);
    try {
      const delivered = await AsyncStorage.getItem(STORAGE_KEYS.READ_NOTIFICATIONS) || '[]';
      const parsed = JSON.parse(delivered);
      
      if (!parsed.includes(notificationId)) {
        parsed.push(notificationId);
        await AsyncStorage.setItem(
          STORAGE_KEYS.READ_NOTIFICATIONS,
          JSON.stringify(parsed.slice(-100))
        );
        console.log('✅ Notification marked as read:', notificationId);
      }
    } catch (error) {
      console.error('❌ Error marking as read:', error);
    }
  }
};

// ==================== APP STATE HANDLERS ====================

export const setupAppStateNotificationHandlers = (): void => {
  console.log('📱 Setting up app state handlers');
  
  // App opened from background
  messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.log('➡️ App opened from background');
    
    const notificationData = remoteMessage.data?.data || remoteMessage.data;
    
    if (!notificationData) {
      console.error('❌ No notification data in app state handler');
      return;
    }
    
    // Get click action, dynamic screen, and order number
    const clickAction = notificationData.click_action?.toUpperCase() || '';
    const dynamicScreen = notificationData.action_screen;
    const orderNumber = notificationData.order_number || notificationData.orderId;
    const restaurantId = notificationData.restaurant_id || notificationData.restaurantId;
    
    let screen = 'Home';
    let params: NavigationParams = {
      fromNotification: true,
      notificationData: notificationData
    };
    
    // Use dynamic screen if available
    if (dynamicScreen) {
      screen = dynamicScreen;
      console.log('📱 Using dynamic screen from action_screen:', screen);
      
      // Special handling for ORDER_RECEIVED -> PartnerScreen
      if (clickAction === 'ORDER_RECEIVED' && dynamicScreen === 'PartnerScreen') {
        params = {
          ...params,
          fromNotification: true,
          notificationData: {
            ...notificationData,
            restaurantId: restaurantId,
            orderId: orderNumber,
            order_number: orderNumber,
            click_action: clickAction,
            action_screen: dynamicScreen,
            type: notificationData.type || 'new_order'
          }
        };
      }
      // For TRACK_ORDER, add order data
      else if (clickAction === 'TRACK_ORDER' && orderNumber) {
        params = {
          ...params,
          order: { 
            order_number: orderNumber 
          }
        };
      } else {
        // Parse any additional params
        if (notificationData.params) {
          try {
            const parsedParams = JSON.parse(notificationData.params);
            params = {
              ...params,
              ...parsedParams
            };
          } catch (error) {
            console.warn('⚠️ Failed to parse params in app state:', error);
          }
        }
      }
    }
    // Fallback to click_action mapping
    else {
      switch (clickAction) {
        case 'TRACK_ORDER':
          screen = 'TrackOrder';
          if (orderNumber) {
            params = {
              ...params,
              order: { 
                order_number: orderNumber 
              }
            };
          }
          break;
          
        case 'HOMENAVIGATE':
          screen = 'Home';
          break;
          
        case 'ORDER_RECEIVED':
          screen = 'PartnerScreen';
          params = {
            ...params,
            fromNotification: true,
            notificationData: {
              ...notificationData,
              restaurantId: restaurantId,
              orderId: orderNumber,
              order_number: orderNumber,
              click_action: clickAction,
              type: notificationData.type || 'new_order'
            }
          };
          break;
          
        default:
          screen = 'Home';
      }
    }
    
    console.log(`📱 App state navigation to: ${screen}`);
    
    // Save pending navigation
    const pendingNav = {
      screen,
      params,
      timestamp: Date.now(),
      clickAction,
      actionScreen: dynamicScreen,
      restaurantId: restaurantId,
      orderNumber: orderNumber
    };
    
    AsyncStorage.setItem(
      STORAGE_KEYS.PENDING_NAVIGATION,
      JSON.stringify(pendingNav)
    ).then(() => {
      console.log('✅ App state pending nav saved');
    }).catch(error => {
      console.error('❌ Error saving app state pending nav:', error);
    });
  });
  
  // App opened from quit state
  messaging()
    .getInitialNotification()
    .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
      if (remoteMessage) {
        console.log('🚀 App opened from quit');
        
        const notificationData = remoteMessage.data?.data || remoteMessage.data;
        
        if (!notificationData) {
          console.error('❌ No notification data in initial notification');
          return;
        }
        
        // Get click action, dynamic screen, and order number
        const clickAction = notificationData.click_action?.toUpperCase() || '';
        const dynamicScreen = notificationData.action_screen;
        const orderNumber = notificationData.order_number || notificationData.orderId;
        const restaurantId = notificationData.restaurant_id || notificationData.restaurantId;
        
        let screen = 'Home';
        let params: NavigationParams = {
          fromNotification: true,
          notificationData: notificationData
        };
        
        // Use dynamic screen if available
        if (dynamicScreen) {
          screen = dynamicScreen;
          console.log('🔄 Using dynamic screen from action_screen:', screen);
          
          // Special handling for ORDER_RECEIVED -> PartnerScreen
          if (clickAction === 'ORDER_RECEIVED' && dynamicScreen === 'PartnerScreen') {
            params = {
              ...params,
              fromNotification: true,
              notificationData: {
                ...notificationData,
                restaurantId: restaurantId,
                orderId: orderNumber,
                order_number: orderNumber,
                click_action: clickAction,
                action_screen: dynamicScreen,
                type: notificationData.type || 'new_order'
              }
            };
          }
          // For TRACK_ORDER, add order data
          else if (clickAction === 'TRACK_ORDER' && orderNumber) {
            params = {
              ...params,
              order: { 
                order_number: orderNumber 
              }
            };
          } else {
            // Parse any additional params
            if (notificationData.params) {
              try {
                const parsedParams = JSON.parse(notificationData.params);
                params = {
                  ...params,
                  ...parsedParams
                };
              } catch (error) {
                console.warn('⚠️ Failed to parse params in initial:', error);
              }
            }
          }
        }
        // Fallback to click_action mapping
        else {
          switch (clickAction) {
            case 'TRACK_ORDER':
              screen = 'TrackOrder';
              if (orderNumber) {
                params = {
                  ...params,
                  order: { 
                    order_number: orderNumber 
                  }
                };
              }
              break;
              
            case 'HOMENAVIGATE':
              screen = 'Home';
              break;
              
            case 'ORDER_RECEIVED':
              screen = 'PartnerScreen';
              params = {
                ...params,
                fromNotification: true,
                notificationData: {
                  ...notificationData,
                  restaurantId: restaurantId,
                  orderId: orderNumber,
                  order_number: orderNumber,
                  click_action: clickAction,
                  type: notificationData.type || 'new_order'
                }
              };
              break;
              
            default:
              screen = 'Home';
          }
        }
        
        console.log(`🔄 Initial navigation to: ${screen}`);
        
        // Save pending navigation
        const pendingNav = {
          screen,
          params,
          timestamp: Date.now(),
          clickAction,
          actionScreen: dynamicScreen,
          restaurantId: restaurantId,
          orderNumber: orderNumber
        };
        
        AsyncStorage.setItem(
          STORAGE_KEYS.PENDING_NAVIGATION,
          JSON.stringify(pendingNav)
        ).then(() => {
          console.log('✅ Initial pending nav saved');
        }).catch(error => {
          console.error('❌ Error saving initial pending nav:', error);
        });
      }
    })
    .catch((error) => {
      console.error('❌ Error getting initial notification:', error);
    });
};

// ==================== TEST FUNCTION ====================

/**
 * Test function to manually trigger notification navigation
 */
export const testNotificationNavigation = (navigation: NavigationProp<any>): void => {
  console.log('🧪 Testing dynamic notification navigation');
  
  // Test different scenarios
  const tests = [
    {
      name: 'ORDER_RECEIVED to PartnerScreen',
      data: {
        click_action: 'ORDER_RECEIVED',
        action_screen: 'PartnerScreen',
        action_type: 'navigate',
        restaurant_id: 'EAT33233428',
        restaurantId: 'EAT33233428',
        order_number: 'ORD20260104-0003',
        orderId: 'ORD20260104-0003',
        type: 'new_order',
        notification_id: 'notif_1767502421985'
      }
    },
    {
      name: 'TRACK_ORDER with order number',
      data: {
        click_action: 'TRACK_ORDER',
        action_screen: 'TrackOrder',
        order_number: 'TEST-ORD-123',
      }
    },
    {
      name: 'HOMENAVIGATE with dynamic screen',
      data: {
        click_action: 'HOMENAVIGATE',
        action_screen: 'HomeTabs',
        params: JSON.stringify({ tab: 'offers' })
      }
    },
    {
      name: 'ORDER_RECEIVED without dynamic screen',
      data: {
        click_action: 'ORDER_RECEIVED',
        restaurant_id: 'EAT33233428',
        order_number: 'ORD20260104-0004',
      }
    },
    {
      name: 'No click_action or action_screen',
      data: {
        message: 'Test notification'
      }
    }
  ];
  
  // Run tests sequentially
  tests.forEach((test, index) => {
    setTimeout(() => {
      console.log(`🧪 Test ${index + 1}: ${test.name}`);
      console.log('🧪 Test data:', test.data);
      
      navigateBasedOnNotification(navigation, test.data);
    }, index * 3000);
  });
};

// ==================== PENDING NAVIGATION CHECK ====================

/**
 * Check for any pending navigation from notifications when app starts
 */
export const checkPendingNavigation = async (
  navigation: NavigationProp<any>
): Promise<void> => {
  try {
    const pendingNavJson = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_NAVIGATION);
    
    if (pendingNavJson) {
      const pendingNav = JSON.parse(pendingNavJson);
      console.log('🔍 Found pending navigation:', pendingNav);
      
      // Clear pending navigation
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_NAVIGATION);
      
      // Check if it's still relevant (within last 5 minutes)
      const timeDiff = Date.now() - pendingNav.timestamp;
      const fiveMinutes = 5 * 60 * 1000;
      
      if (timeDiff <= fiveMinutes) {
        console.log('🔄 Processing pending navigation');
        
        // Perform navigation
        if (pendingNav.screen === 'PartnerScreen') {
          navigation.navigate('PartnerScreen' as never, {
            fromNotification: true,
            notificationData: pendingNav.params?.notificationData || pendingNav
          } as never);
        } else {
          navigation.navigate(pendingNav.screen as never, pendingNav.params as never);
        }
      } else {
        console.log('⏰ Pending navigation expired');
      }
    }
  } catch (error) {
    console.error('❌ Error checking pending navigation:', error);
  }
};