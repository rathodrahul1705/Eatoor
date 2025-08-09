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