import API from './httpClient';

export const getOfferBanners = () =>
  API.get(`/offers/banner/`);

export const getOfferItems = (params) =>
  API.get(`/offers/`, { params });