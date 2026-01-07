import API from './httpClient';

export const getOrderDetails = (restaurant_id: string) =>
  API.post('/restaurant/orders/details', { restaurant_id });

export const getRestaurantList = (user_id: string) =>
  API.get(`/restaurants/status/${user_id}/`);

interface updateOrderStatus {
  new_status: string;
  order_number?: number;
}

export const updateOrderStatus = (payload: updateOrderStatus) => {
  return API.post('/order/update-order-status/', payload);
};

interface RestaurantStatusUpdate {
  status: string;
}

export const updateRestaurantStatus = (
  restaurantId: string,
  payload: RestaurantStatusUpdate
) => {
  return API.patch(`/restaurant/status-update/${restaurantId}/`, payload);
};
