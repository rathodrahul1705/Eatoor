export type AddressType = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  type: AddressType;
  name: string;
  address: string;
  isDefault: boolean;
  latitude: number;
  longitude: number;
}

export interface MapLocationPickerParams {
  addressToEdit?: Address;
  onLocationConfirmed: (address: Address) => void;
}