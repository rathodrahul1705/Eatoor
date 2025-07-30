import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';

const AddressScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([
    {
      id: '1',
      type: 'home',
      name: 'Home',
      address: '123, Shivaji Nagar, Thane West, Maharashtra - 400601',
      isDefault: true,
      latitude: 19.2183,
      longitude: 72.9781,
    },
    {
      id: '2',
      type: 'work',
      name: 'Office',
      address: '456, Business Park, Andheri East, Mumbai - 400093',
      isDefault: false,
      latitude: 19.1175,
      longitude: 72.8567,
    },
    {
      id: '3',
      type: 'other',
      name: 'Parents House',
      address: '789, Green Valley, Mulund West, Mumbai - 400080',
      isDefault: false,
      latitude: 19.1700,
      longitude: 72.9575,
    },
  ]);

  const getIconName = (type: AddressType) => {
    switch (type) {
      case 'home': return 'home-outline';
      case 'work': return 'briefcase-outline';
      default: return 'location-outline';
    }
  };

  const handleAddNewAddress = () => {
    const params: MapLocationPickerParams = {
      onLocationConfirmed: (newAddress: Address) => {
        setSavedAddresses([...savedAddresses, newAddress]);
      },
    };
    navigation.navigate('MapLocationPicker', params);
  };

  const handleEditAddress = (address: Address) => {
    const params: MapLocationPickerParams = {
      addressToEdit: address,
      onLocationConfirmed: (updatedAddress: Address) => {
        setSavedAddresses(savedAddresses.map(addr => 
          addr.id === updatedAddress.id ? updatedAddress : addr
        ));
      },
    };
    navigation.navigate('MapLocationPicker', params);
  };

  const handleDeleteAddress = (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            setSavedAddresses(savedAddresses.filter(addr => addr.id !== id));
          }
        }
      ]
    );
  };

  const setAsDefaultAddress = (id: string) => {
    setSavedAddresses(savedAddresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id,
    })));
  };

  const filteredAddresses = savedAddresses.filter(addr => 
    addr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    addr.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={20} color="#777" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for area, street name..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Add New Address</Text>
        <TouchableOpacity 
          style={styles.addAddressOption}
          onPress={handleAddNewAddress}
        >
          <View style={styles.optionIconContainer}>
            <Icon name="add-circle-outline" size={20} color="#E65C00" />
          </View>
          <Text style={styles.optionText}>Add new address</Text>
          <Icon name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Saved Addresses</Text>
        
        {filteredAddresses.length > 0 ? (
          filteredAddresses.map((address) => (
            <Animatable.View 
              key={address.id}
              animation="fadeIn"
              duration={500}
              style={[styles.addressCard, address.isDefault && styles.defaultAddressCard]}
            >
              <View style={styles.addressHeader}>
                <View style={styles.addressIconContainer}>
                  <Icon name={getIconName(address.type)} size={18} color="#E65C00" />
                </View>
                <Text style={styles.addressName}>{address.name}</Text>
                {address.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                )}
              </View>
              
              <Text style={styles.addressText}>{address.address}</Text>
              
              <View style={styles.addressActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleEditAddress(address)}
                >
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleDeleteAddress(address.id)}
                >
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                </TouchableOpacity>

                {!address.isDefault && (
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => setAsDefaultAddress(address.id)}
                  >
                    <Text style={[styles.actionButtonText, styles.setDefaultText]}>Set as Default</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animatable.View>
          ))
        ) : (
          <Text style={styles.noResultsText}>No addresses found</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 15,
    marginVertical: 15,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  sectionContainer: {
    marginTop: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 15,
    paddingLeft: 5,
  },
  addAddressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  defaultAddressCard: {
    borderColor: 'rgba(230, 92, 0, 0.3)',
    backgroundColor: 'rgba(230, 92, 0, 0.05)',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  addressIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  defaultBadge: {
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 10,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E65C00',
  },
  addressText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  addressActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
    marginVertical: 5,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#777',
  },
  deleteButtonText: {
    color: '#ff4444',
  },
  setDefaultText: {
    color: '#E65C00',
    fontWeight: '600',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#777',
    marginVertical: 20,
    fontSize: 16,
  },
});

export default AddressScreen;