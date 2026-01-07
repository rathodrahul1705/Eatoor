import API from './httpClient';

interface OrderList {
  user_id?: number;
}

export const getOrderList = (payload: OrderList) => {
  return API.post('/order/order-details/', payload);
};

interface OrderDetails {
  user_id: number;
  order_number: string;
}

export const getOrderDetails = (payload: OrderDetails) => {
  return API.post('/order/track-order-details/', payload);
};

interface OrderRatingUpdate {
  order_id: number;        
  restaurant_id: string;
  user_id: number;              
  rating: number;           
  review_text: string;
}

export const updateOrderRating = (payload: OrderRatingUpdate) => {
  return API.post('/order-review/update/', payload);
};

export const getUserProfileDetails = () =>
  API.get('/get-user-details/');

interface LiveTrackingDetails {
  order_id: number;        
}

export const getLiveTrackingDetails = (payload: LiveTrackingDetails) => {
  return API.post('/order/live-location-details/', payload);
};

export const getReOrderDetailsResponse = (order_number: string) => {
  return API.post(`/restaurant/cart/reorder/${order_number}/`);
};

interface DeleteAccountPayload {
  reason: string;
  reason_type: string;
}

export const deleteAccountetails = (payload: DeleteAccountPayload) => {
  return API.delete('request/user-data/delete/', {
    data: payload,
  });
};

