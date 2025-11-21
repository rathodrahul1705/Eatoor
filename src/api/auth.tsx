// src/api/auth.ts
import API from './httpClient';

export const sendOTP = (contact_number: string) =>
  API.post('/login/send-otp/', { contact_number });

export const verifyOTP = (payload: {
  contact_number: string;
  otp: string;
  device_token: string | null;
  platform: 'ios' | 'android';
}) => API.post('/login/verify-otp/', payload);


export const resendOTP = (contact_number: string) =>
  API.post('/login/resend-otp/', contact_number);

interface PersonalDetailsPayload {
  full_name: string;
  delivery_preference?: number;
  whatsapp_updates?: number;
  contact_number?: string;
  email?: string;
}

export const updatePersonalDetails = (payload: PersonalDetailsPayload) => {
  return API.put('/user/personal-details-update/', payload);
};

export const sendEmailOTP = (email: string) =>
  API.post('/send-email-otp/', { email });

export const verifyEmailOTP = (payload: { email: string; otp: string }) =>
  API.post('/verify-email-otp/', payload);
