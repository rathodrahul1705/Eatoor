export type AddressType = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  type: AddressType;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}

export interface MapLocationPickerParams {
  addressToEdit?: Address;
  prevLocation?: Address;
  onLocationConfirmed: (address: Address) => void;
}

// Optional: You can also include address type metadata if needed
export const AddressTypeMetadata: Record<AddressType, { icon: string; label: string }> = {
  home: {
    icon: 'home-outline',
    label: 'Home',
  },
  work: {
    icon: 'briefcase-outline',
    label: 'Work',
  },
  other: {
    icon: 'location-outline',
    label: 'Other',
  },
};

// Optional: Default names for each address type
export const DefaultAddressNames: Record<AddressType, string> = {
  home: 'Home',
  work: 'Work',
  other: 'Other',
};