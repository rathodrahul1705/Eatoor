// src/api/auth.ts
import API from './httpClient';

export const sendOTP = (contact_number: string) =>
  API.post('/login/send-otp/', { contact_number });

export const verifyOTP = (payload: { contact_number: string; otp: string }) =>
  API.post('/login/verify-otp/', payload);

export const resendOTP = (contact_number: string) =>
  API.post('/login/resend-otp/', contact_number);

export const updatePersonalDetails = (payload: {
  full_name: string;
  delivery_preference: number;
  whatsapp_updates: number;
}) => {
  return API.post('/user/personal-details-update/', payload);
};