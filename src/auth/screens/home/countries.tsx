export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  minLength: number;
  maxLength: number;
}

export const countries: Country[] = [
  {
    name: 'India',
    code: 'IN',
    dialCode: '+91',
    flag: '🇮🇳',
    minLength: 10,
    maxLength: 10,
  },
  {
    name: 'United States',
    code: 'US',
    dialCode: '+1',
    flag: '🇺🇸',
    minLength: 10,
    maxLength: 10,
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    dialCode: '+44',
    flag: '🇬🇧',
    minLength: 10,
    maxLength: 10,
  },
  {
    name: 'Australia',
    code: 'AU',
    dialCode: '+61',
    flag: '🇦🇺',
    minLength: 9,
    maxLength: 9,
  },
  // ... add more countries
];