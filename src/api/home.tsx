import API from './httpClient';

export const getKitchenList = () =>
  API.get('/restaurant/live/list/');

export const getKitcheDetails = (kitchenId: string) =>
  API.get(`/restaurant/menu/list/${kitchenId}/`);