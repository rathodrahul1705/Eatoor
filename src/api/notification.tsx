import API from './httpClient';

export const deviceTokenRemove = (device_token: string) =>
  API.post('/device/remove/', { device_token });