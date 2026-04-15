import API from './httpClient';

export interface InitiateOrder {
  user_id?: number;
  session_id?: string;
  restaurant_id: string;
  delivery_address_id: string;
  special_instructions?: string;
  is_takeaway: boolean;
  payment_method: number;
  payment_type: number;
  payment_status: number;
  payment_gateway: string;
  status: number;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  total_amount: number;
  amount: number;
  quantity: number;
  coupon_discount: number;
  discount_amount: number;
  delivery_offer_applied: boolean;
  wallet_used: boolean;
  wallet_amount: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone: number;
}

// Initiate Payment with params
export const initiatePayment = (payload: InitiateOrder) =>
  API.post('/initiate/payment/', payload);

export const verifyPayment = (txnid, payment_method, order_id) =>
  API.get('/payment/verify/', {
    params: {
      txnid: txnid,
      payment_method: payment_method,
      order_id: order_id
    }
  });

export const getPaymentMethods = () =>
  API.get('/payment/methods/');