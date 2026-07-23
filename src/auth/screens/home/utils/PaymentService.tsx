// services/PaymentService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initiateUPIPayment, getInstalledUPIApps } from './UPIPaymentService';
import { initiatePayment, validate_payment } from '../../../../api/payment';
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
      paymentPage: paymentData.payment_page, // Store payment_page
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
            vpa: vpa,
            payment_page: paymentData.payment_page
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
        actionUrl: actionUrl,
        payment_page: paymentData.payment_page
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
    // Extract payment_page from orderData
    const paymentPage = orderData?.payment_page || 'restaurant';
    
    // Validate required fields based on payment_page
    const requiredFields = paymentPage === "eatoor_money"
      ? [
          'amount',
          'productinfo',
          'firstname',
          'email',
          'phone',
          'user_id',
          'payment_method',
          'payment_type',
          'payment_status',
          'payment_gateway',
          'payment_page'
        ]
      : [
          'user_id',
          'restaurant_id',
          'delivery_address_id',
          'payment_method',
          'payment_type',
          'payment_status',
          'status',
          'subtotal',
          'tax',
          'delivery_fee',
          'total_amount',
          'quantity',
          'amount',
          'productinfo',
          'firstname',
          'email',
          'phone',
          'payment_page'
        ];
    
    for (const field of requiredFields) {
      if (orderData[field] === undefined || orderData[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    console.log('Initiating backend payment with order data:', orderData);
    console.log('Payment page:', paymentPage);
    
    // Using the imported initiatePayment function with complete order data
    const response = await initiatePayment(orderData);
    
    console.log('Backend payment response:', response);
    
    // Check if response is successful
    if (!response.data || response.status !== 200) {
      throw new Error(response?.message || "Failed to initiate payment");
    }

    // Get payment_page from response or fallback to orderData
    const responsePaymentPage = response?.data?.payment_page || paymentPage;
    
    // Extract payment data from response - handle multiple response structures
    let intentData = null;
    let acsTemplate = null;
    let otpPostUrl = null;
    let paymentIdValue = null;
    let txnIdValue = null;
    let orderId = null;
    let orderNumber = null;
    let orderTotal = null;
    let paymentMethod = null;
    let paymentStatus = null;
    
    // Helper function to get nested values safely
    const getNestedValue = (obj: any, path: string) => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };
    
    // Try to extract data from various response structures
    
    // 1. Check for payu_response structure (most common)
    if (response.data.payu_response) {
      const payuResponse = response.data.payu_response;
      
      // Get intent data from payu_response
      intentData = getNestedValue(payuResponse, 'result.intentURIData');
      acsTemplate = getNestedValue(payuResponse, 'result.acsTemplate');
      otpPostUrl = getNestedValue(payuResponse, 'result.otpPostUrl');
      paymentIdValue = getNestedValue(payuResponse, 'result.paymentId');
      
      // Get meta data
      txnIdValue = getNestedValue(payuResponse, 'metaData.txnId') || response.data.txnid;
      paymentMethod = getNestedValue(payuResponse, 'metaData.paymentMethod');
      paymentStatus = getNestedValue(payuResponse, 'metaData.txnStatus') || response.data.status;
      
      // Get order details
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    }
    // 2. Check for direct result structure
    else if (response.data.result) {
      const result = response.data.result;
      
      intentData = result.intentURIData;
      acsTemplate = result.acsTemplate;
      otpPostUrl = result.otpPostUrl;
      paymentIdValue = result.paymentId;
      
      // Get from metaData if available
      if (response.data.metaData) {
        txnIdValue = response.data.metaData.txnId || response.data.txnid;
        paymentMethod = response.data.metaData.paymentMethod;
        paymentStatus = response.data.metaData.txnStatus || response.data.status;
      } else {
        txnIdValue = response.data.txnid;
        paymentStatus = response.data.status;
      }
      
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
    }
    // 3. Check for direct intentURIData
    else if (response.data.intentURIData) {
      intentData = response.data.intentURIData;
      paymentIdValue = response.data.paymentId;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
      paymentStatus = response.data.status;
    }
    // 4. Check for direct acsTemplate (VPA response)
    else if (response.data.acsTemplate) {
      acsTemplate = response.data.acsTemplate;
      otpPostUrl = response.data.otpPostUrl;
      txnIdValue = response.data.txnid;
      orderId = response.data.order_id;
      orderNumber = response.data.order_number;
      orderTotal = response.data.amount;
      paymentStatus = response.data.status;
    }
    
    // If we still don't have data, try to extract from response.data directly
    if (!intentData && !acsTemplate) {
      // Try to find any data in the response
      const possibleData = Object.keys(response.data).find(key => 
        key.includes('intent') || key.includes('acs') || key.includes('payment')
      );
      
      if (possibleData && response.data[possibleData]) {
        if (response.data[possibleData].intentURIData) {
          intentData = response.data[possibleData].intentURIData;
        }
        if (response.data[possibleData].acsTemplate) {
          acsTemplate = response.data[possibleData].acsTemplate;
        }
      }
    }
    
    // Ensure we have at least one payment data type
    if (!intentData && !acsTemplate) {
      console.error("Response structure:", JSON.stringify(response.data, null, 2));
      throw new Error("No payment data received from the server");
    }
    
    // Construct the return object with all data
    const result = {
      payment_id: paymentIdValue,
      txnid: txnIdValue,
      amount: parseFloat(orderTotal) || 0,
      order_id: orderId,
      order_number: orderNumber,
      order_total: orderTotal,
      intent_data: intentData,
      acs_template: acsTemplate,
      otpPostUrl: otpPostUrl,
      full_response: response.data,
      status: paymentStatus || 'pending',
      isVPA: !!acsTemplate,
      payment_page: responsePaymentPage,
      payment_method: paymentMethod,
      isEatoorMoney: responsePaymentPage === 'eatoor_money'
    };
    
    console.log('Payment initiation result:', result);
    return result;
    
  } catch (error) {
    console.error("Payment initiation error:", error);
    throw error;
  }
};

/**
 * Verify payment status from backend using validate_payment endpoint
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID (1: Credit Card, 2: Debit Card, 3: UPI, 4: Netbanking, 5: COD, 6: Eatoor Money)
 * @param {string} paymentPage - Payment page identifier (e.g., 'eatoor_money', 'restaurant')
 * @returns {Promise<Object>} - Payment verification result with order details
 */
export const verifyPaymentStatus = async (txnId: string, paymentMethodId: number | null = null, paymentPage: string | null = null) => {
  try {
    if (!txnId) {
      console.warn("Transaction ID is required for payment verification");
      return null;
    }
    
    console.log(`Validating payment for txnId: ${txnId}, paymentMethod: ${paymentMethodId}, paymentPage: ${paymentPage}`);
    
    // Using validate_payment with required parameters
    const response = await validate_payment(txnId, paymentMethodId, paymentPage);
    
    console.log('Payment validation response:', response);
    
    // Check if API response is successful
    if (!response.data || response.data.status == "error") {
      console.error("Payment validation API error:", response);
      return null;
    }

    // Extract the payment status from response
    let transaction = null;
    let paymentStatus = null;
    let unmappedStatus = null;
    let message = null;
    let transactionId = null;
    let amount = 0;
    let paymentMode = null;
    let bankRefNum = null;
    let addedon = null;
    let mihpayid = null;
    
    // Handle the new response structure
    if (response.data?.data?.transaction_details) {
      // If transaction_details is an object with txnId as key
      const details = response.data.data.transaction_details;
      transaction = details[txnId] || details;
      
      // Extract status from the transaction
      if (transaction) {
        paymentStatus = transaction.status || transaction.payment_status;
        unmappedStatus = transaction.unmappedstatus || transaction.unmapped_status;
        message = transaction.error_Message || transaction.error_message || transaction.msg;
        transactionId = transaction.txnid || transaction.transaction_id;
        amount = parseFloat(transaction.amt || transaction.transaction_amount || transaction.amount || 0);
        paymentMode = transaction.mode || transaction.payment_mode || transaction.method;
        bankRefNum = transaction.bank_ref_num || transaction.bank_ref_number;
        addedon = transaction.addedon || transaction.created_at;
        mihpayid = transaction.mihpayid;
      }
    } else if (response.data?.transaction_details) {
      const details = response.data.transaction_details;
      transaction = details[txnId] || details;
      
      if (transaction) {
        paymentStatus = transaction.status || transaction.payment_status;
        unmappedStatus = transaction.unmappedstatus || transaction.unmapped_status;
        message = transaction.error_Message || transaction.error_message || transaction.msg;
        transactionId = transaction.txnid || transaction.transaction_id;
        amount = parseFloat(transaction.amt || transaction.transaction_amount || transaction.amount || 0);
        paymentMode = transaction.mode || transaction.payment_mode || transaction.method;
        bankRefNum = transaction.bank_ref_num || transaction.bank_ref_number;
        addedon = transaction.addedon || transaction.created_at;
        mihpayid = transaction.mihpayid;
      }
    } else if (response.data?.payu_response?.transaction_details) {
      const details = response.data.payu_response.transaction_details;
      transaction = details[txnId] || details;
      
      if (transaction) {
        paymentStatus = transaction.status || transaction.payment_status;
        unmappedStatus = transaction.unmappedstatus || transaction.unmapped_status;
        message = transaction.error_Message || transaction.error_message || transaction.msg;
        transactionId = transaction.txnid || transaction.transaction_id;
        amount = parseFloat(transaction.amt || transaction.transaction_amount || transaction.amount || 0);
        paymentMode = transaction.mode || transaction.payment_mode || transaction.method;
        bankRefNum = transaction.bank_ref_num || transaction.bank_ref_number;
        addedon = transaction.addedon || transaction.created_at;
        mihpayid = transaction.mihpayid;
      }
    }
    
    // If transaction not found in details, check if response.data itself has the status
    if (!transaction || Object.keys(transaction).length === 0) {
      // Check if response.data has direct status fields
      if (response.data.status || response.data.payment_status) {
        transaction = {
          status: response.data.status,
          payment_status: response.data.payment_status,
          unmappedstatus: response.data.unmapped_status || response.data.unmappedstatus,
          message: response.data.message,
          transaction_id: response.data.transaction_id || txnId,
          amount: response.data.amount || 0,
          mode: response.data.payment_mode || response.data.mode,
          bank_ref_num: response.data.bank_ref_num,
          addedon: response.data.addedon
        };
        paymentStatus = response.data.status || response.data.payment_status;
        unmappedStatus = response.data.unmapped_status || response.data.unmappedstatus;
        message = response.data.message;
        transactionId = response.data.transaction_id || txnId;
        amount = parseFloat(response.data.amount || 0);
        paymentMode = response.data.payment_mode || response.data.mode;
        bankRefNum = response.data.bank_ref_num;
        addedon = response.data.addedon;
      }
    }
    
    // If we have a transaction but it's not the direct transaction, try to find it
    if (transaction && typeof transaction === 'object' && !transaction.status && !transaction.payment_status) {
      // If transaction has the txnId as a property
      if (transaction[txnId]) {
        const nestedTxn = transaction[txnId];
        transaction = nestedTxn;
        paymentStatus = nestedTxn.status || nestedTxn.payment_status;
        unmappedStatus = nestedTxn.unmappedstatus || nestedTxn.unmapped_status;
        message = nestedTxn.error_Message || nestedTxn.error_message || nestedTxn.msg;
        transactionId = nestedTxn.txnid || nestedTxn.transaction_id;
        amount = parseFloat(nestedTxn.amt || nestedTxn.transaction_amount || nestedTxn.amount || 0);
        paymentMode = nestedTxn.mode || nestedTxn.payment_mode || nestedTxn.method;
        bankRefNum = nestedTxn.bank_ref_num || nestedTxn.bank_ref_number;
        addedon = nestedTxn.addedon || nestedTxn.created_at;
        mihpayid = nestedTxn.mihpayid;
      }
    }
    
    // If no transaction found, try to use the whole response
    if (!transaction || Object.keys(transaction).length === 0) {
      transaction = response.data;
      paymentStatus = transaction.status || transaction.payment_status;
      unmappedStatus = transaction.unmapped_status || transaction.unmappedstatus;
      message = transaction.message;
      transactionId = transaction.transaction_id || txnId;
      amount = parseFloat(transaction.amount || 0);
      paymentMode = transaction.payment_mode || transaction.mode;
      bankRefNum = transaction.bank_ref_num;
      addedon = transaction.addedon;
    }
    
    console.log('Extracted transaction:', transaction);
    
    // Normalize status response based on transaction status
    const transactionStatus = (paymentStatus || transaction?.status || transaction?.payment_status || 'pending').toLowerCase();
    const unmappedStatusLower = (unmappedStatus || '').toLowerCase();
    
    // Check payment status with more accurate mapping
    const isSuccess = transactionStatus === "success" || 
                      transactionStatus === "completed" || 
                      transactionStatus === "captured" ||
                      transactionStatus === "approved" ||
                      (unmappedStatusLower === "completed" || unmappedStatusLower === "success" || unmappedStatusLower === "captured");
    
    const isPending = transactionStatus === "pending" || 
                      transactionStatus === "processing" || 
                      transactionStatus === "initiated" ||
                      unmappedStatusLower === "in progress" ||
                      unmappedStatusLower === "pending" ||
                      unmappedStatusLower === "processing" ||
                      unmappedStatusLower === "initiated";
    
    const isFailed = transactionStatus === "failure" || 
                     transactionStatus === "failed" || 
                     transactionStatus === "declined" ||
                     transactionStatus === "rejected" ||
                     unmappedStatusLower === "failure" ||
                     unmappedStatusLower === "failed" ||
                     unmappedStatusLower === "declined" ||
                     unmappedStatusLower === "rejected";
    
    // If it's Eatoor Money, check the payment status specifically
    if (paymentPage === 'eatoor_money') {
      const eatoorStatus = transaction?.payment_status?.toLowerCase() || transactionStatus;
      if (eatoorStatus === 'completed' || eatoorStatus === 'success' || isSuccess) {
        return {
          success: true,
          pending: false,
          failed: false,
          status: transaction.payment_status || eatoorStatus || 'completed',
          unmappedstatus: unmappedStatus || transaction.unmappedstatus || 'completed',
          message: transaction.message || 'Payment completed successfully',
          amount: amount || parseFloat(transaction.amount) || 0,
          transaction_id: transactionId || transaction.transaction_id || txnId,
          payment_mode: paymentMode || transaction.payment_mode,
          payment_page: paymentPage,
          mihpayid: mihpayid || transaction.mihpayid,
          bank_ref_num: bankRefNum || transaction.bank_ref_num,
          addedon: addedon || transaction.addedon,
          raw_data: transaction
        };
      }
      
      if (eatoorStatus === 'pending' || eatoorStatus === 'processing' || eatoorStatus === 'initiated' || isPending) {
        return {
          success: false,
          pending: true,
          failed: false,
          status: transaction.payment_status || eatoorStatus || 'pending',
          unmappedstatus: unmappedStatus || transaction.unmappedstatus || 'in progress',
          message: transaction.message || 'Payment is being processed. Please check again after some time.',
          amount: amount || parseFloat(transaction.amount) || 0,
          transaction_id: transactionId || transaction.transaction_id || txnId,
          payment_mode: paymentMode || transaction.payment_mode,
          payment_page: paymentPage,
          mihpayid: mihpayid || transaction.mihpayid,
          bank_ref_num: bankRefNum || transaction.bank_ref_num,
          addedon: addedon || transaction.addedon,
          raw_data: transaction
        };
      }
    }
    
    // Build the result object
    const result = {
      success: isSuccess,
      pending: isPending,
      failed: isFailed,
      status: paymentStatus || transaction.status || transaction.payment_status || transactionStatus,
      unmappedstatus: unmappedStatus || transaction.unmappedstatus || transaction.unmapped_status || transactionStatus,
      message: message || 
               transaction?.error_Message || 
               transaction?.error_message || 
               transaction?.msg || 
               transaction?.message || 
               "NO ERROR",
      error_code: transaction?.error_code || transaction?.code,
      amount: amount || 
              parseFloat(transaction?.amt) || 
              parseFloat(transaction?.transaction_amount) || 
              parseFloat(transaction?.amount) || 0,
      net_amount: parseFloat(transaction?.net_amount_debit) || 0,
      transaction_id: transactionId || 
                      transaction?.mihpayid || 
                      transaction?.transaction_id || 
                      transaction?.txnid || 
                      txnId,
      mihpayid: mihpayid || transaction?.mihpayid,
      bank_ref_num: bankRefNum || transaction?.bank_ref_num || transaction?.bank_ref_number,
      payment_mode: paymentMode || transaction?.mode || transaction?.payment_mode || transaction?.method,
      app_name: transaction?.App_Name || transaction?.app_name,
      txnid: transaction?.txnid || txnId,
      addedon: addedon || transaction?.addedon || transaction?.created_at || transaction?.createdAt,
      productinfo: transaction?.productinfo || transaction?.product_info,
      firstname: transaction?.firstname || transaction?.first_name,
      bankcode: transaction?.bankcode || transaction?.bank_code,
      payment_page: paymentPage,
      payment_method: transaction?.payment_method,
      order_id: transaction?.order_id,
      raw_data: transaction || response.data
    };
    
    console.log('Payment verification result:', result);
    return result;
    
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
      bank_ref_num: paymentData.bank_ref_num,
      payment_page: paymentData.payment_page
    };
    
    // Return success for now
    return {
      success: true,
      order_id: orderId,
      message: "Order updated successfully",
      data: params
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
 * @param {string} paymentPage - Payment page identifier
 * @returns {Promise<Object>} - Payment status
 */
export const checkPaymentStatus = async (txnId: string, paymentMethodId: number | null = null, paymentPage: string | null = null) => {
  return await verifyPaymentStatus(txnId, paymentMethodId, paymentPage);
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
      paymentData: {
        ...paymentData,
        payment_page: paymentData.payment_page
      }
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
 * Start polling for payment status using the validate_payment endpoint
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID
 * @param {string} paymentPage - Payment page identifier
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} onComplete - Callback when payment completes
 * @param {Object} options - Polling options
 * @returns {Object} - Polling control object with stop function
 */
export const startPaymentPolling = (
  txnId: string, 
  paymentMethodId: number | null, 
  paymentPage: string | null, 
  onStatusUpdate: (status: any) => void, 
  onComplete: (result: any) => void, 
  options: any = {}
) => {
  const {
    interval = 5000,
    maxAttempts = 10,
    timeout = 120000,
    onPending = null
  } = options;
  
  let attempts = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  let isCompleted = false;
  let currentPaymentPage = paymentPage;
  
  const updatePaymentPage = (newPaymentPage: string | null) => {
    if (newPaymentPage) {
      currentPaymentPage = newPaymentPage;
      console.log(`Payment page updated to ${currentPaymentPage} for transaction ${txnId}`);
    }
  };
  
  const updatePaymentMethod = (newPaymentMethod: number | null) => {
    if (newPaymentMethod) {
      paymentMethodId = newPaymentMethod;
      console.log(`Payment method updated to ${paymentMethodId} for transaction ${txnId}`);
    }
  };
  
  const checkStatus = async () => {
    if (isCompleted) return;
    
    attempts++;
    
    if (onStatusUpdate) {
      onStatusUpdate({
        attempts: attempts,
        maxAttempts: maxAttempts,
        percentage: (attempts / maxAttempts) * 100,
        payment_page: currentPaymentPage
      });
    }
    
    console.log(`Polling payment status for txnId: ${txnId}, attempt: ${attempts}/${maxAttempts}, payment_page: ${currentPaymentPage}`);
    
    const status = await verifyPaymentStatus(txnId, paymentMethodId, currentPaymentPage);
    
    if (status) {
      if (status.success) {
        console.log(`Payment successful for transaction ${txnId}`);
        isCompleted = true;
        stopPolling();
        if (onComplete) {
          onComplete({ 
            success: true, 
            status: 'success',
            data: status,
            transaction_id: status.transaction_id,
            payment_id: status.payment_id,
            payment_page: currentPaymentPage,
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
            payment_page: currentPaymentPage
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
            payment_page: currentPaymentPage
          });
        }
      }
    }
    
    if (attempts >= maxAttempts && !isCompleted) {
      console.log(`Max polling attempts reached for transaction ${txnId}`);
      isCompleted = true;
      stopPolling();
      
      const finalStatus = await verifyPaymentStatus(txnId, paymentMethodId, currentPaymentPage);
      if (finalStatus && finalStatus.pending) {
        if (onComplete) {
          onComplete({ 
            success: false, 
            status: 'pending',
            error: "Payment is still pending. Please check your bank app or contact support.",
            data: finalStatus,
            payment_page: currentPaymentPage
          });
        }
      } else if (finalStatus && finalStatus.success) {
        if (onComplete) {
          onComplete({ 
            success: true, 
            status: 'success',
            data: finalStatus,
            transaction_id: finalStatus.transaction_id,
            payment_page: currentPaymentPage,
            message: 'Payment completed successfully'
          });
        }
      } else {
        if (onComplete) {
          onComplete({ 
            success: false, 
            status: 'timeout',
            error: "Payment verification timeout. Please check your payment status in order history.",
            attempts: attempts,
            payment_page: currentPaymentPage
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
    console.log(`Polling stopped for transaction ${txnId}`);
  };
  
  // Start polling
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
          payment_page: currentPaymentPage
        });
      }
    }
  }, timeout);
  
  // Return control object
  return {
    stop: stopPolling,
    getAttempts: () => attempts,
    isRunning: () => intervalId !== null,
    updatePaymentPage: updatePaymentPage,
    updatePaymentMethod: updatePaymentMethod,
    getPaymentPage: () => currentPaymentPage
  };
};

/**
 * Get detailed payment status (one-time check)
 * @param {string} txnId - Transaction ID
 * @param {number} paymentMethodId - Payment method ID
 * @param {string} paymentPage - Payment page identifier
 * @returns {Promise<Object>} - Detailed payment status
 */
export const getDetailedPaymentStatus = async (txnId: string, paymentMethodId: number | null = null, paymentPage: string | null = null) => {
  try {
    const status = await verifyPaymentStatus(txnId, paymentMethodId, paymentPage);
    
    if (!status) {
      return {
        success: false,
        error: "Unable to fetch payment status",
        payment_page: paymentPage
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
      payment_page: paymentPage,
      payment_method: status.payment_method,
      order_id: status.order_id,
      raw_data: status.raw_data
    };
  } catch (error: any) {
    console.error("Error getting detailed payment status:", error);
    return {
      success: false,
      error: error.message,
      payment_page: paymentPage
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
  // Can retry if payment failed or is pending (but not if it's a COD or Eatoor Money payment)
  if (paymentStatus.payment_page === 'eatoor_money' || paymentStatus.payment_page === 'cod') {
    return false;
  }
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
      icon: "help-circle",
      shouldRetry: false
    };
  }
  
  // Check if it's Eatoor Money payment
  const isEatoorMoney = paymentStatus.payment_page === 'eatoor_money';
  
  if (paymentStatus.success) {
    return {
      title: isEatoorMoney ? "Payment Successful via Eatoor Money" : "Payment Successful",
      message: isEatoorMoney 
        ? `Amount ₹${paymentStatus.amount?.toFixed(2)} has been debited from your Eatoor Money wallet`
        : `Amount ₹${paymentStatus.amount?.toFixed(2)} has been debited successfully`,
      color: "#4CAF50",
      icon: "check-circle",
      transactionId: paymentStatus.transaction_id,
      paymentMode: paymentStatus.payment_mode,
      bankRef: paymentStatus.bank_ref_num,
      paymentPage: paymentStatus.payment_page,
      shouldRetry: false
    };
  }
  
  if (paymentStatus.pending) {
    return {
      title: isEatoorMoney ? "Eatoor Money Payment Pending" : "Payment Pending",
      message: isEatoorMoney 
        ? "Your Eatoor Money payment is being processed. Please check your wallet balance."
        : "Your payment is being processed. Please check your bank app or order history for updates.",
      color: "#FF9800",
      icon: "clock",
      shouldRetry: false,
      paymentPage: paymentStatus.payment_page
    };
  }
  
  if (paymentStatus.failed) {
    return {
      title: isEatoorMoney ? "Eatoor Money Payment Failed" : "Payment Failed",
      message: isEatoorMoney
        ? paymentStatus.message || "Insufficient balance or transaction failed. Please try again or use another payment method."
        : paymentStatus.message || "Payment could not be completed. Please try again.",
      color: "#F44336",
      icon: "alert-circle",
      shouldRetry: !isEatoorMoney,
      paymentPage: paymentStatus.payment_page
    };
  }
  
  return {
    title: "Payment Status Unknown",
    message: "Unable to determine payment status. Please check order history.",
    color: "#9E9E9E",
    icon: "help-circle",
    shouldRetry: true,
    paymentPage: paymentStatus.payment_page
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