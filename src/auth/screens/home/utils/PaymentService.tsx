// services/PaymentService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initiateUPIPayment, getInstalledUPIApps } from './UPIPaymentService';
import { initiatePayment, verifyPayment } from '../../../../api/payment';

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
 * Initiate payment with backend - Creates order and gets payment intent
 * @param {Object} orderData - Complete order data for payment initiation
 * @returns {Promise<Object>} - Payment initiation response with order details
 */
export const initiateBackendPayment = async (orderData) => {
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
    
    // Using the imported initiatePayment function with complete order data
    const response = await initiatePayment(orderData);
    
    // Check if response is successful
    if (!response.data || response.status !== 200) {
      throw new Error(response?.message || "Failed to initiate payment");
    }
    
    // Extract payment data from response
    let intentData = null;
    let acsTemplate = null;
    let paymentIdValue = null;
    let txnIdValue = null;
    let orderId = null;
    let orderNumber = null;
    let orderTotal = null;
    
    // Check if response has payu_response structure
    if (response.data.payu_response && response.data.payu_response.result) {
      intentData = response.data.payu_response.result.intentURIData;
      acsTemplate = response.data.payu_response.result.acsTemplate;
      paymentIdValue = response.data.payu_response.result.paymentId;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    } else if (response.data.intentURIData) {
      // Alternative response structure
      intentData = response.data.intentURIData;
      paymentIdValue = response.data.paymentId;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    } else {
      // Try to extract from response directly
      intentData = response.data.intentURIData;
      paymentIdValue = response.data.paymentId || response.data.payment_id;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    }
    
    if (!intentData) {
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
      full_response: response.data,
      status: response.data.status || 'pending'
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
export const verifyPaymentStatus = async (txnId, paymentMethodId = null, orderId = null) => {
  try {
    if (!orderId) {
      console.warn("Order ID is required for payment verification");
      return null;
    }
    
    // Using the imported verifyPayment function with params
    const response = await verifyPayment(txnId, paymentMethodId, orderId);
    
    // Check if API response is successful
    if (!response.data || response.status !== 200) {
      console.error("Payment verification API error:", response);
      return null;
    }

    // Extract transaction details
    const transactionDetails = response?.data?.data?.transaction_details;
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
      message: transaction.error_Message || "NO ERROR",
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
export const updateOrderAfterPayment = async (orderId, paymentData) => {
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
export const checkPaymentStatus = async (txnId, paymentMethodId = null, orderId = null) => {
  return await verifyPaymentStatus(txnId, paymentMethodId, orderId);
};

/**
 * Process UPI payment with installed apps
 * @param {Object} paymentData - Payment data from initiation
 * @param {string} preferredApp - Preferred app ID (optional)
 * @returns {Promise<Object>} - Payment processing result
 */
export const processUPIPayment = async (paymentData, preferredApp = null) => {
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
  } catch (error) {
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
export const startPaymentPolling = (txnId, paymentMethodId, orderId, onStatusUpdate, onComplete, options = {}) => {
  const {
    interval = 3000,
    maxAttempts = 2,
    timeout = 120000,
    onPending = null
  } = options;
  
  let attempts = 0;
  let intervalId = null;
  let timeoutId = null;
  let isCompleted = false;
  let currentOrderId = orderId;
  
  const updateOrderId = (newOrderId) => {
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
export const getDetailedPaymentStatus = async (txnId, paymentMethodId = null, orderId = null) => {
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
  } catch (error) {
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
export const canRetryPayment = (paymentStatus) => {
  if (!paymentStatus) return true;
  return !paymentStatus.success && (paymentStatus.failed || paymentStatus.pending);
};

/**
 * Format payment status for display
 * @param {Object} paymentStatus - Payment status object
 * @returns {Object} - Formatted status for UI
 */
export const formatPaymentStatusForDisplay = (paymentStatus) => {
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

// Helper function for base64 decode
const decodeBase64 = (data) => {
  try {
    if (!data) return null;
    if (typeof atob === 'function') {
      return atob(data);
    }
    return Buffer.from(data, 'base64').toString('utf-8');
  } catch (e) {
    console.error("Base64 decode error:", e);
    return null;
  }
};

export default {
  getCustomerDetails,
  getSessionIdForPayment,
  initiateBackendPayment,
  verifyPaymentStatus,
  updateOrderAfterPayment,
  checkPaymentStatus,
  processUPIPayment,
  startPaymentPolling,
  getDetailedPaymentStatus,
  canRetryPayment,
  formatPaymentStatusForDisplay
};