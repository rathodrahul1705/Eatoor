import API from './httpClient';

export const getAddressList = () =>
  API.get('/addresses/list/');

export interface StoreAddress {
  street_address: string;
  user: number;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  near_by_landmark?: string; // optional field
  home_type: string;
  name_of_location: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
}

// API call function
export const storeUserAddress = (payload: StoreAddress) => {
  return API.post('/user_address/store/', payload);
};

export const updateUserAddress = (addressId: string, payload: StoreAddress) => {
  return API.put(`/user_address/update/${addressId}/`, payload);
};

export const deleteUserAddress = (addressId: string) => {
  return API.delete(`/user_address/delete/${addressId}/`);
};

export interface StatusAddress {
  is_default: boolean;
}

export const updateUserStatusAddress = (addressId: string, payload: StatusAddress) => {
  return API.put(`/user_address/status_update/${addressId}/`, payload);
};

export interface GetUserAddressPayload {
  lat: string;
  long: string;
}

export const getUserAddress = (payload: GetUserAddressPayload) => {
  return API.post('/address/filter/', payload);
};