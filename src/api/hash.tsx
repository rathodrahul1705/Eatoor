import API from './httpClient';

export const getDeviceDetails = (params?: {
  device_id?: string;
  contact_number?: string;
}) => {
  return API.get('/get-app-hash/', { params });
};

interface StoreDevicePayload {
  app_hash: string;
  platform: 'android' | 'ios';
  contact_number?: string;
  device_id: string;
  fcm_token?: string;
  device_model?: string;
  device_manufacturer?: string;
  app_version?: string;
}

export const storeDeviceDetails = (payload: StoreDevicePayload) => {
  return API.post('/store-app-hash/', payload);
};