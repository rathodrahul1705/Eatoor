// hooks/useCashfreeUPIPayment.js
import { useCallback } from 'react';
import {
  CFPaymentGatewayService,
  CFErrorResponse,
} from 'react-native-cashfree-pg-sdk';
import {
  CFUPIIntentCheckoutPayment,  // ⭐ KEY: UPI Intent only
  CFEnvironment,
  CFSession,
  CFThemeBuilder,
} from 'cashfree-pg-api-contract';

export const useCashfreeUPIPayment = () => {
  const setupCallbacks = useCallback(() => {
    CFPaymentGatewayService.setCallback({
      onVerify: (orderId) => {
        console.log('✅ Payment Verified for Order:', orderId);
        // Navigate to success screen, update order status
      },
      onError: (error, orderId) => {
        console.error('❌ Payment Failed:', error, orderId);
        // Show error message to user
      },
    });
  }, []);

  const initiateUPIPayment = async (paymentSessionId, orderId) => {
    try {
      // 1. Create session
      const session = new CFSession(
        paymentSessionId,
        orderId,
        CFEnvironment.SANDBOX  // Use CFEnvironment.PRODUCTION for live
      );

      // 2. Optional: Customize theme colors (Zepto-like dark theme)
      const theme = new CFThemeBuilder()
        .setNavigationBarBackgroundColor('#1A1A1A')    // Dark navbar
        .setNavigationBarTextColor('#FFFFFF')          // White text
        .setButtonBackgroundColor('#2C2C2C')           // Dark buttons
        .setButtonTextColor('#FFFFFF')                 // White button text
        .setPrimaryTextColor('#FFFFFF')                // Primary text color
        .setSecondaryTextColor('#9E9E9E')              // Secondary text
        .build();

      // 3. ⭐ CRITICAL: Use CFUPIIntentCheckoutPayment for native UPI list
      const upiPayment = new CFUPIIntentCheckoutPayment(session, theme);
      
      // 4. Launch native UPI app list
      await CFPaymentGatewayService.doUPIPayment(upiPayment);
      
    } catch (error) {
      console.error('Error initiating UPI payment:', error);
    }
  };

  return { setupCallbacks, initiateUPIPayment };
};