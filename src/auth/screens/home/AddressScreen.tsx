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
import { Address, MapLocationPickerParams } from './addressTypes';

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
      case 'home':
        return 'home-outline';
      case 'work':
        return 'briefcase-outline';
      default:
        return 'location-outline';
    }
  };

  const handleAddNewAddress = () => {
    navigation.navigate('MapLocationPicker', {
      onLocationConfirmed: (newAddress: Address) => {
        setSavedAddresses([...savedAddresses, newAddress]);
      },
    } as MapLocationPickerParams);
  };

  const handleEditAddress = (address: Address) => {
    navigation.navigate('MapLocationPicker', {
      addressToEdit: address,
      onLocationConfirmed: (updatedAddress: Address) => {
        setSavedAddresses(
          savedAddresses.map((addr) =>
            addr.id === updatedAddress.id ? updatedAddress : addr
          )
        );
      },
    } as MapLocationPickerParams);
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
            setSavedAddresses(savedAddresses.filter((addr) => addr.id !== id));
          }
        }
      ]
    );
  };

  const setAsDefaultAddress = (id: string) => {
    setSavedAddresses(
      savedAddresses.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
    );
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
  // ... [keep all existing styles from your original file]
  noResultsText: {
    textAlign: 'center',
    color: '#777',
    marginVertical: 20,
    fontSize: 16,
  },
});

export default AddressScreen;