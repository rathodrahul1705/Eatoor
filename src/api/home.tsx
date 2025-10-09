import API from './httpClient';

export const getKitchenList = () =>
  API.get('/restaurant/live/list/');

export const getKitcheDetails = (kitchenId: string) =>
  API.get(`/restaurant/menu/list/${kitchenId}/`);

export const getfavouriteKitchenList = () =>
  API.get('/favourites/');
interface FavouriteKitchen {
  restaurant_id: string;
}

export const updateFavouriteKitchen = (payload: FavouriteKitchen) => {
  return API.post('/favourites/toggle/', payload);
};