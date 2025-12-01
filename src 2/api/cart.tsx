import API from './httpClient';

interface CartActionPayload {
  user_id?: number;
  session_id: string;
  restaurant_id: string;
  item_id: string | number;
  source: 'ITEMLIST' | 'MENU' | string;
  quantity?: number;
  action: 'add' | 'remove';
}

export const updateCart = (payload: CartActionPayload) => {
  return API.post('/restaurant/cart/add/', payload);
};

interface CartGetActionPayload {
  user_id?: number;
  session_id: string;
}

export const getCart = (payload: CartGetActionPayload) => {
  return API.post('/restaurant/cart/list/', payload);
};

interface CartDetailsActionPayload {
  user_id: number;
  session_id?: string;
}

export const getCartDetails = (payload: CartDetailsActionPayload) => {
  return API.post('/restaurant/cart/details/', payload);
};

interface ClearCartDetails {
  user_id: number;
  session_id?: string;
}

export const clearCartDetails = (payload: ClearCartDetails) => {
  return API.post('/restaurant/cart/clear/', payload);
};

interface CreatePaymentRequest {
  amount: number;
  currency: string;
  receipt: string;
  notes: {
    userId: number | string;
    restaurantId: string;
    couponCode: string | null;
  };
}

export const createPayment = (payload: CreatePaymentRequest) => {
  return API.post('/restaurant/order/create-order/', payload);
};
export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount: number;
  deliveryAddressId: string;
  payment_type: number; // 1 = COD, 2 = Online Payment etc.
  eatoor_order_id: number;
  eatoor_order_number: string;
  restaurant_id: string;
  restaurantName: string;
}

export const verifyPayment = (payload: VerifyPaymentRequest) => {
  return API.post('/restaurant/order/verify-payment/', payload);
};
export interface UpdateOrderDetails {
  user_id: number;
  restaurant_id: string;
  payment_method: number;
  payment_type: number;
  delivery_address_id: string;
  is_takeaway: boolean;
  special_instructions: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  delivery_fee: number;
  total_amount: number;
  code: string | null;
  discount_amount: number;
}

export const updatePyamentData = (payload: UpdateOrderDetails) => {
  return API.post('/restaurant/order/details/update/', payload);
};

export interface ActiveOrderPayload {
  user_id: number;
}

export const getActiveOrders = (payload: ActiveOrderPayload) => {
  return API.post('/order/active-orders/', payload);
};

export interface RestaurantCartOrderDetaiils {
  restaurant_id: string;
  user_id: number;
  delivery_address_id: string;
}

export const getRestaurantCartDetails = (payload: RestaurantCartOrderDetaiils) => {
  return API.post('/restaurant/order/details/', payload);
};