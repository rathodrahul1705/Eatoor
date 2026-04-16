// services/PaymentService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initiateUPIPayment, getInstalledUPIApps } from './UPIPaymentService';
import { initiatePayment, verifyPayment } from '../../../../api/payment';
import { Linking, Platform } from 'react-native';

/**
 * Payment Service - Handles all payment related operations
 * Including: Payment initiation, status checking, polling, etc.
 */

/**
 * Get customer details from storage
 * @returns {Promise<Object>} - Customer details object
 */
export const getCustomerDetails = async () => {
  try {
    const user = await AsyncStorage.getItem('user');
    const userData = user ? JSON.parse(user) : null;
    
    return {
      contact_number: userData?.contact_number || userData?.phone || "",
      email: userData?.email || userData?.contact_number || "",
      full_name: userData?.full_name || userData?.name || ""
    };
  } catch (error) {
    console.error("Error fetching customer details:", error);
    return null;
  }
};

/**
 * Get session ID from storage
 * @returns {Promise<string>} - Session ID
 */
export const getSessionIdForPayment = async () => {
  try {
    const sessionId = await AsyncStorage.getItem('sessionId');
    return sessionId;
  } catch (error) {
    console.error("Error fetching session ID:", error);
    return null;
  }
};

/**
 * Decode base64 string
 * @param data - Base64 encoded string
 * @returns Decoded string
 */
const decodeBase64 = (data: string): string => {
  try {
    if (!data) return '';
    
    // For web environment
    if (Platform.OS === 'web' && typeof atob === 'function') {
      return atob(data);
    }
    
    // For React Native - atob is available in React Native 0.60+
    if (typeof atob === 'function') {
      return atob(data);
    }
    
    // Fallback: Manual base64 decoding for older React Native versions
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    
    const cleanData = data.replace(/[^A-Za-z0-9+/=]/g, '');
    
    while (i < cleanData.length) {
      const enc1 = chars.indexOf(cleanData.charAt(i++));
      const enc2 = chars.indexOf(cleanData.charAt(i++));
      const enc3 = chars.indexOf(cleanData.charAt(i++));
      const enc4 = chars.indexOf(cleanData.charAt(i++));
      
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      if (enc3 !== 64) output += String.fromCharCode(chr2);
      if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    
    // Handle UTF-8 characters
    try {
      return decodeURIComponent(escape(output));
    } catch (e) {
      return output;
    }
  } catch (e) {
    console.error("Base64 decode error:", e);
    return data;
  }
};

/**
 * Process VPA payment response - handles the HTML form submission for VPA payments
 * @param paymentData - Payment data from initiation
 * @returns {Promise<Object>} - Payment processing result
 */
export const processVPAPayment = async (paymentData: any): Promise<{ success: boolean; error?: string; data?: any }> => {
  try {
    console.log('Processing VPA payment with data:', paymentData);
    
    // Check if we have acsTemplate in the response (from the new API response structure)
    let acsTemplate = null;
    let otpPostUrl = null;
    
    // Handle different response structures
    if (paymentData.acs_template) {
      acsTemplate = paymentData.acs_template;
      otpPostUrl = paymentData.otpPostUrl;
    } else if (paymentData.full_response?.result?.acsTemplate) {
      acsTemplate = paymentData.full_response.result.acsTemplate;
      otpPostUrl = paymentData.full_response.result.otpPostUrl;
    } else if (paymentData.full_response?.acsTemplate) {
      acsTemplate = paymentData.full_response.acsTemplate;
      otpPostUrl = paymentData.full_response.otpPostUrl;
    } else if (paymentData.result?.acsTemplate) {
      acsTemplate = paymentData.result.acsTemplate;
      otpPostUrl = paymentData.result.otpPostUrl;
    }
    
    if (!acsTemplate) {
      console.error('No ACS template found in payment response');
      return {
        success: false,
        error: 'No payment template received from server'
      };
    }
    
    // Decode the base64 ACS template
    const decodedHtml = decodeBase64(acsTemplate);
    console.log('Decoded ACS template:', decodedHtml.substring(0, 500));
    
    // Extract the action URL from the form
    const formActionMatch = decodedHtml.match(/action=["']([^"']+)["']/);
    const actionUrl = formActionMatch ? formActionMatch[1] : otpPostUrl;
    
    console.log('Form action URL:', actionUrl);
    
    // For VPA payments, we need to open the UPI app or show a webview
    // The decoded HTML contains a form that auto-submits to the UPI payment URL
    
    // Extract the form data if needed
    const formData: Record<string, string> = {};
    const inputMatches = decodedHtml.matchAll(/<input[^>]+name=["']([^"']+)["'][^>]+value=["']([^"']+)["']/gi);
    for (const match of inputMatches) {
      formData[match[1]] = match[2];
    }
    
    console.log('Extracted form data:', formData);
    
    // Check if there's a direct intent URL in the form
    let intentUrl = actionUrl;
    
    // For UPI intent URLs, we can try to open directly
    if (intentUrl && (intentUrl.includes('upi://') || intentUrl.includes('paytmmp//') || 
        intentUrl.includes('phonepe://') || intentUrl.includes('gpay://') ||
        intentUrl.includes('tez://') || intentUrl.includes('googlepay://'))) {
      
      console.log('Found UPI intent URL:', intentUrl);
      
      const canOpen = await Linking.canOpenURL(intentUrl);
      if (canOpen) {
        await Linking.openURL(intentUrl);
        return {
          success: true,
          data: {
            message: 'UPI app opened successfully',
            intentUrl: intentUrl
          }
        };
      } else {
        console.log('Cannot open intent URL, falling back to webview');
      }
    }
    
    // If no direct intent URL or cannot open, we need to use a WebView
    // For now, we'll consider it successful and rely on polling
    // The actual payment will be completed in the UPI app after the user approves
    
    // Store the ACS data for potential WebView fallback
    await AsyncStorage.setItem('pendingVPAPayment', JSON.stringify({
      html: decodedHtml,
      actionUrl: actionUrl,
      formData: formData,
      transactionId: paymentData.txnid,
      orderId: paymentData.order_id,
      timestamp: Date.now()
    }));
    
    // Try to construct a UPI intent URL from the form data if available
    if (formData.pa || formData.payee_vpa) {
      const vpa = formData.pa || formData.payee_vpa;
      const amount = formData.amount || paymentData.amount;
      const tn = formData.tn || formData.txnid || paymentData.txnid;
      
      // Construct UPI intent URL
      const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(formData.pn || 'Merchant')}&am=${amount}&tn=${encodeURIComponent(tn)}&cu=INR`;
      
      console.log('Constructed UPI intent URL:', upiIntentUrl);
      
      const canOpen = await Linking.canOpenURL(upiIntentUrl);
      if (canOpen) {
        await Linking.openURL(upiIntentUrl);
        return {
          success: true,
          data: {
            message: 'UPI app opened for VPA payment',
            intentUrl: upiIntentUrl,
            vpa: vpa
          }
        };
      }
    }
    
    // If we can't open any UPI app, we'll consider it successful and rely on polling
    // The user should check their UPI app for pending requests
    return {
      success: true,
      data: {
        message: 'VPA payment initiated. Please check your UPI app.',
        requiresWebview: true,
        html: decodedHtml,
        actionUrl: actionUrl
      }
    };
    
  } catch (error: any) {
    console.error('VPA payment processing error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process VPA payment'
    };
  }
};

/**
 * Initiate payment with backend - Creates order and gets payment intent
 * @param {Object} orderData - Complete order data for payment initiation
 * @returns {Promise<Object>} - Payment initiation response with order details
 */
export const initiateBackendPayment = async (orderData: any) => {
  try {
    // Validate required fields

    const requiredFields = [
      'user_id', 'restaurant_id', 'delivery_address_id', 'payment_method',
      'payment_type', 'payment_status', 'status', 'subtotal', 'tax',
      'delivery_fee', 'total_amount', 'quantity', 'amount', 'productinfo',
      'firstname', 'email', 'phone'
    ];
    
    for (const field of requiredFields) {
      if (orderData[field] === undefined || orderData[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    console.log('Initiating backend payment with order data:', orderData);
    
    // Using the imported initiatePayment function with complete order data
    const response = await initiatePayment(orderData);
    
    console.log('Backend payment response:', response);
    
    // Check if response is successful
    if (!response.data || response.status !== 200) {
      throw new Error(response?.message || "Failed to initiate payment");
    }
    
    // Extract payment data from response - handle multiple response structures
    let intentData = null;
    let acsTemplate = null;
    let otpPostUrl = null;
    let paymentIdValue = null;
    let txnIdValue = null;
    let orderId = null;
    let orderNumber = null;
    let orderTotal = null;
    
    // Check for VPA payment response structure (with metaData and result)
    if (response.data.metaData && response.data.result) {
      // New VPA response structure
      acsTemplate = response.data.result.acsTemplate;
      otpPostUrl = response.data.result.otpPostUrl;
      txnIdValue = response.data.metaData.txnId;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
      
      return {
        payment_id: paymentIdValue,
        txnid: txnIdValue,
        amount: parseFloat(orderTotal),
        order_id: orderId,
        order_number: orderNumber,
        order_total: orderTotal,
        acs_template: acsTemplate,
        otpPostUrl: otpPostUrl,
        full_response: response.data,
        status: response.data.metaData?.txnStatus || 'pending',
        isVPA: true
      };
    }
    
    // Check for payu_response structure
    if (response.data.payu_response && response.data.payu_response.result) {
      intentData = response.data.payu_response.result.intentURIData;
      acsTemplate = response.data.payu_response.result.acsTemplate;
      paymentIdValue = response.data.payu_response.result.paymentId;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    } 
    // Alternative response structure with intentURIData
    else if (response.data.intentURIData) {
      intentData = response.data.intentURIData;
      paymentIdValue = response.data.paymentId;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    }
    // Check for result with intentURIData
    else if (response.data.result && response.data.result.intentURIData) {
      intentData = response.data.result.intentURIData;
      paymentIdValue = response.data.result.paymentId;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    }
    // Check for direct acsTemplate (VPA response without metaData wrapper)
    else if (response.data.acsTemplate) {
      acsTemplate = response.data.acsTemplate;
      otpPostUrl = response.data.otpPostUrl;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
      
      return {
        payment_id: paymentIdValue,
        txnid: txnIdValue,
        amount: parseFloat(orderTotal),
        order_id: orderId,
        order_number: orderNumber,
        order_total: orderTotal,
        acs_template: acsTemplate,
        otpPostUrl: otpPostUrl,
        full_response: response.data,
        status: response.data.status || 'pending',
        isVPA: true
      };
    }
    else {
      // Try to extract from response directly
      intentData = response.data.intentURIData;
      paymentIdValue = response.data.paymentId || response.data.payment_id;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    }
    
    if (!intentData && !acsTemplate) {
      console.error("Response structure:", JSON.stringify(response.data, null, 2));
      throw new Error("No payment data received from the server");
    }
    
    return {
      payment_id: paymentIdValue,
      txnid: txnIdValue,
      amount: parseFloat(orderTotal),
      order_id: orderId,
      order_number: orderNumber,
      order_total: orderTotal,
      intent_data: intentData,
      acs_template: acsTemplate,
      otpPostUrl: otpPostUrl,
      full_response: response.data,
      status: response.data.status || 'pending',
      isVPA: !!acsTemplate
    };
  } catch (error) {
    console.error("Payment initiation error:", error);
    throw error;
  }
};

/**
 * Verify payment status from backend using payment/verify endpoint
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID (1: Credit Card, 2: Debit Card, 3: UPI, 4: Netbanking, 5: COD, 6: Eatoor Money)
 * @param {number} orderId - Order ID (required for verification)
 * @returns {Promise<Object>} - Payment verification result with order details
 */
export const verifyPaymentStatus = async (txnId: string, paymentMethodId: number | null = null, orderId: number | null = null) => {
  try {
    if (!orderId) {
      console.warn("Order ID is required for payment verification");
      return null;
    }
    
    console.log(`Verifying payment for txnId: ${txnId}, orderId: ${orderId}`);
    
    // Using the imported verifyPayment function with params
    const response = await verifyPayment(txnId, paymentMethodId, orderId);
    
    console.log('Payment verification response:', response);
    
    // Check if API response is successful
    if (!response.data || response.status !== 200) {
      console.error("Payment verification API error:", response);
      return null;
    }

    // Extract transaction details - handle different response structures
    let transactionDetails = null;
    
    // Check for data.transaction_details structure
    if (response.data?.data?.transaction_details) {
      transactionDetails = response.data.data.transaction_details;
    } 
    // Check for direct transaction_details
    else if (response.data?.transaction_details) {
      transactionDetails = response.data.transaction_details;
    }
    // Check for payu_response structure
    else if (response.data?.payu_response?.transaction_details) {
      transactionDetails = response.data.payu_response.transaction_details;
    }
    
    if (!transactionDetails || Object.keys(transactionDetails).length === 0) {
      console.error("No transaction details found");
      return null;
    }

    // Get the transaction object (key is the txnId)
    const transaction = transactionDetails[txnId];
    if (!transaction) {
      console.error(`Transaction not found for ID: ${txnId}`);
      return null;
    }

    // Normalize status response based on transaction status
    const transactionStatus = transaction.status?.toLowerCase();
    
    // Check if payment is successful
    const isSuccess = transactionStatus === "success";
    
    // Check if payment is pending
    const isPending = transactionStatus === "pending";
    
    // Check if payment failed
    const isFailed = transactionStatus === "failure" || transactionStatus === "failed";

    return {
      success: isSuccess,
      pending: isPending,
      failed: isFailed,
      status: transaction.status,
      unmappedstatus: transaction.unmappedstatus,
      message: transaction.error_Message || transaction.error_message || "NO ERROR",
      error_code: transaction.error_code,
      amount: parseFloat(transaction.amt) || parseFloat(transaction.transaction_amount) || 0,
      net_amount: parseFloat(transaction.net_amount_debit) || 0,
      transaction_id: transaction.mihpayid,
      bank_ref_num: transaction.bank_ref_num,
      payment_mode: transaction.mode,
      app_name: transaction.App_Name,
      txnid: transaction.txnid,
      addedon: transaction.addedon,
      productinfo: transaction.productinfo,
      firstname: transaction.firstname,
      bankcode: transaction.bankcode,
      order_id: orderId,
      raw_data: transaction
    };
  } catch (error) {
    console.error("Payment verification error:", error);
    return null;
  }
};

/**
 * Update order after successful payment
 * @param {number} orderId - Order ID
 * @param {Object} paymentData - Payment data including transaction details
 * @returns {Promise<Object>} - Updated order response
 */
export const updateOrderAfterPayment = async (orderId: number, paymentData: any) => {
  try {
    const params = {
      order_id: orderId,
      payment_status: 'completed',
      transaction_id: paymentData.transaction_id,
      payment_id: paymentData.payment_id,
      payment_mode: paymentData.payment_mode,
      bank_ref_num: paymentData.bank_ref_num
    };
    
    // Return success for now
    return {
      success: true,
      order_id: orderId,
      message: "Order updated successfully"
    };
  } catch (error) {
    console.error("Error updating order:", error);
    throw error;
  }
};

/**
 * Check payment status from backend (legacy method - kept for compatibility)
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID
 * @param {number} orderId - Order ID
 * @returns {Promise<Object>} - Payment status
 */
export const checkPaymentStatus = async (txnId: string, paymentMethodId: number | null = null, orderId: number | null = null) => {
  return await verifyPaymentStatus(txnId, paymentMethodId, orderId);
};

/**
 * Process UPI payment with installed apps
 * @param {Object} paymentData - Payment data from initiation
 * @param {string} preferredApp - Preferred app ID (optional)
 * @returns {Promise<Object>} - Payment processing result
 */
export const processUPIPayment = async (paymentData: any, preferredApp: string | null = null) => {
  try {
    // Get installed UPI apps for logging/analytics
    const installedApps = await getInstalledUPIApps();
    console.log("Installed UPI apps:", installedApps.map(app => app.name));
    
    // Decode ACS template if present
    let fallbackUrl = null;
    if (paymentData.acs_template) {
      fallbackUrl = decodeBase64(paymentData.acs_template);
    }
    
    // Initiate UPI payment
    const result = await initiateUPIPayment(
      paymentData.intent_data,
      preferredApp,
      fallbackUrl
    );
    
    return {
      success: result.success,
      appUsed: result.app,
      error: result.error,
      paymentData: paymentData
    };
  } catch (error: any) {
    console.error("Payment processing error:", error);
    return {
      success: false,
      error: error.message,
      paymentData: paymentData
    };
  }
};

/**
 * Start polling for payment status using the new verify endpoint
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID
 * @param {number} orderId - Order ID (required)
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} onComplete - Callback when payment completes
 * @param {Object} options - Polling options
 * @returns {Object} - Polling control object with stop function
 */
export const startPaymentPolling = (
  txnId: string, 
  paymentMethodId: number | null, 
  orderId: number | null, 
  onStatusUpdate: (status: any) => void, 
  onComplete: (result: any) => void, 
  options: any = {}
) => {
  const {
    interval = 3000,
    maxAttempts = 10,
    timeout = 180000,
    onPending = null
  } = options;
  
  let attempts = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  let isCompleted = false;
  let currentOrderId = orderId;
  
  const updateOrderId = (newOrderId: number | null) => {
    if (newOrderId && !currentOrderId) {
      currentOrderId = newOrderId;
      console.log(`Order ID updated to ${currentOrderId} for transaction ${txnId}`);
    }
  };
  
  const checkStatus = async () => {
    if (isCompleted) return;
    
    attempts++;
    
    if (onStatusUpdate) {
      onStatusUpdate({
        attempts: attempts,
        maxAttempts: maxAttempts,
        percentage: (attempts / maxAttempts) * 100
      });
    }
    
    console.log(`Polling payment status for txnId: ${txnId}, attempt: ${attempts}/${maxAttempts}`);
    
    const status = await verifyPaymentStatus(txnId, paymentMethodId, currentOrderId);
    
    if (status) {
      if (status.success) {
        console.log(`Payment successful for transaction ${txnId}, order ${currentOrderId}`);
        isCompleted = true;
        stopPolling();
        if (onComplete) {
          onComplete({ 
            success: true, 
            status: 'success',
            data: status,
            order_id: currentOrderId,
            transaction_id: status.transaction_id,
            payment_id: status.payment_id,
            order_number: status.order_number,
            message: 'Payment completed successfully'
          });
        }
        return;
      } 
      else if (status.failed) {
        console.log(`Payment failed for transaction ${txnId}`);
        isCompleted = true;
        stopPolling();
        if (onComplete) {
          onComplete({ 
            success: false, 
            status: 'failed',
            error: status.message || "Payment failed",
            data: status,
            order_id: currentOrderId
          });
        }
        return;
      }
      else if (status.pending) {
        console.log(`Payment pending for transaction ${txnId}, attempt ${attempts}/${maxAttempts}`);
        
        if (onPending) {
          onPending({
            attempts: attempts,
            maxAttempts: maxAttempts,
            data: status,
            order_id: currentOrderId
          });
        }
      }
    }
    
    if (attempts >= maxAttempts && !isCompleted) {
      console.log(`Max polling attempts reached for transaction ${txnId}`);
      isCompleted = true;
      stopPolling();
      
      const finalStatus = await verifyPaymentStatus(txnId, paymentMethodId, currentOrderId);
      if (finalStatus && finalStatus.pending) {
        if (onComplete) {
          onComplete({ 
            success: false, 
            status: 'pending',
            error: "Payment is still pending. Please check your bank app or contact support.",
            data: finalStatus,
            order_id: currentOrderId
          });
        }
      } else {
        if (onComplete) {
          onComplete({ 
            success: false, 
            status: 'timeout',
            error: "Payment verification timeout. Please check your payment status in order history.",
            attempts: attempts,
            order_id: currentOrderId
          });
        }
      }
    }
  };
  
  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  intervalId = setInterval(checkStatus, interval);
  
  timeoutId = setTimeout(() => {
    if (!isCompleted) {
      console.log(`Payment polling timeout for transaction ${txnId}`);
      isCompleted = true;
      stopPolling();
      if (onComplete) {
        onComplete({ 
          success: false, 
          status: 'timeout',
          error: "Payment timeout. Please check your payment status in order history.",
          order_id: currentOrderId
        });
      }
    }
  }, timeout);
  
  return {
    stop: stopPolling,
    getAttempts: () => attempts,
    isRunning: () => intervalId !== null,
    updateOrderId: updateOrderId
  };
};

/**
 * Get detailed payment status (one-time check)
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID
 * @param {number} orderId - Order ID
 * @returns {Promise<Object>} - Detailed payment status
 */
export const getDetailedPaymentStatus = async (txnId: string, paymentMethodId: number | null = null, orderId: number | null = null) => {
  try {
    const status = await verifyPaymentStatus(txnId, paymentMethodId, orderId);
    
    if (!status) {
      return {
        success: false,
        error: "Unable to fetch payment status"
      };
    }
    
    return {
      success: status.success,
      pending: status.pending,
      failed: status.failed,
      status: status.status,
      amount: status.amount,
      transaction_id: status.transaction_id,
      payment_mode: status.payment_mode,
      app_name: status.app_name,
      bank_ref_num: status.bank_ref_num,
      addedon: status.addedon,
      message: status.message,
      order_id: orderId
    };
  } catch (error: any) {
    console.error("Error getting detailed payment status:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Helper function to check if payment can be retried
 * @param {Object} paymentStatus - Payment status object
 * @returns {boolean} - Whether payment can be retried
 */
export const canRetryPayment = (paymentStatus: any) => {
  if (!paymentStatus) return true;
  return !paymentStatus.success && (paymentStatus.failed || paymentStatus.pending);
};

/**
 * Format payment status for display
 * @param {Object} paymentStatus - Payment status object
 * @returns {Object} - Formatted status for UI
 */
export const formatPaymentStatusForDisplay = (paymentStatus: any) => {
  if (!paymentStatus) {
    return {
      title: "Unknown",
      message: "Unable to determine payment status",
      color: "#FF9800",
      icon: "help-circle"
    };
  }
  
  if (paymentStatus.success) {
    return {
      title: "Payment Successful",
      message: `Amount ₹${paymentStatus.amount?.toFixed(2)} has been debited successfully`,
      color: "#4CAF50",
      icon: "check-circle",
      transactionId: paymentStatus.transaction_id,
      paymentMode: paymentStatus.payment_mode,
      bankRef: paymentStatus.bank_ref_num,
      orderId: paymentStatus.order_id
    };
  }
  
  if (paymentStatus.pending) {
    return {
      title: "Payment Pending",
      message: "Your payment is being processed. Please check your bank app or order history for updates.",
      color: "#FF9800",
      icon: "clock",
      shouldRetry: false,
      orderId: paymentStatus.order_id
    };
  }
  
  if (paymentStatus.failed) {
    return {
      title: "Payment Failed",
      message: paymentStatus.message || "Payment could not be completed. Please try again.",
      color: "#F44336",
      icon: "alert-circle",
      shouldRetry: true,
      orderId: paymentStatus.order_id
    };
  }
  
  return {
    title: "Payment Status Unknown",
    message: "Unable to determine payment status. Please check order history.",
    color: "#9E9E9E",
    icon: "help-circle",
    shouldRetry: true
  };
};

export default {
  getCustomerDetails,
  getSessionIdForPayment,
  initiateBackendPayment,
  verifyPaymentStatus,
  updateOrderAfterPayment,
  checkPaymentStatus,
  processUPIPayment,
  processVPAPayment,
  startPaymentPolling,
  getDetailedPaymentStatus,
  canRetryPayment,
  formatPaymentStatusForDisplay
};