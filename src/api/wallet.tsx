import API from './httpClient';

// ---------------------------------------------
// Get Wallet Balance
// ---------------------------------------------
export const getWalletBalance = () => {
  return API.get('/wallet/');
};

// ---------------------------------------------
// Create Razorpay Order for Adding Money
// ---------------------------------------------
interface WalletCreateOrderPayload {
  amount: number;
}

export const createWalletOrder = (payload: WalletCreateOrderPayload) => {
  return API.post('/wallet/create-order/', payload);
};

// ---------------------------------------------
// Add Money Success (Credit Wallet After Payment)
// ---------------------------------------------
interface WalletAddMoneySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  amount: number;
}

export const walletAddMoneySuccess = (payload: WalletAddMoneySuccessPayload) => {
  return API.post('/wallet/add-money-success/', payload);
};

// ---------------------------------------------
// Get All Wallet Transactions (Paginated)
// ---------------------------------------------
export const getWalletTransactions = (page: number = 1) => {
  return API.get(`/wallet/transactions/?page=${page}`);
};

// ---------------------------------------------
// Debit Wallet For Order  
// (Your previous issue: order_id is optional → FIXED here)
// ---------------------------------------------
interface WalletDebitPayload {
  amount: number;
  order_id?: number;  // OPTIONAL NOW
}

export const debitWallet = (payload: WalletDebitPayload) => {
  return API.post('/wallet/debit/', payload);
};

