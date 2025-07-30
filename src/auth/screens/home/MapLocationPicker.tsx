import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Marker } from 'react-native-maps';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';

type RootStackParamList = {
  MapLocationPicker: MapLocationPickerParams;
};

type MapLocationPickerRouteProp = RouteProp<RootStackParamList, 'MapLocationPicker'>;

const MapLocationPicker = ({ route }: { route: MapLocationPickerRouteProp }) => {
  const navigation = useNavigation();
  const { addressToEdit, onLocationConfirmed } = route.params;
  
  const [address, setAddress] = useState<Omit<Address, 'id' | 'isDefault'>>({
    type: 'home',
    name: '',
    address: '',
    latitude: addressToEdit?.latitude || 19.0760,
    longitude: addressToEdit?.longitude || 72.8777,
  });
  
  const [region, setRegion] = useState({
    latitude: addressToEdit?.latitude || 19.0760,
    longitude: addressToEdit?.longitude || 72.8777,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    if (addressToEdit) {
      setAddress({
        type: addressToEdit.type,
        name: addressToEdit.name,
        address: addressToEdit.address,
        latitude: addressToEdit.latitude,
        longitude: addressToEdit.longitude,
      });
    }

    navigation.setOptions({
      title: addressToEdit ? 'Edit Address' : 'Add New Address',
      headerLeft: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#E65C00" />
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: '#fff',
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTitleStyle: {
        color: '#333',
        fontWeight: '600',
      },
    });
  }, [addressToEdit, navigation]);

  const handleRegionChangeComplete = (newRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    setRegion(newRegion);
    setAddress(prev => ({
      ...prev,
      latitude: newRegion.latitude,
      longitude: newRegion.longitude,
    }));
  };

  const handleSaveAddress = () => {
    if (!address.name.trim()) {
      Alert.alert('Error', 'Please enter a name for this address');
      return;
    }

    if (!address.address.trim()) {
      Alert.alert('Error', 'Please enter the full address');
      return;
    }

    const newAddress: Address = {
      ...address,
      id: addressToEdit?.id || Math.random().toString(36).substring(7),
      isDefault: addressToEdit?.isDefault || false,
    };

    onLocationConfirmed(newAddress);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />
      
      {/* Map Section with Back Button */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={region}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation={true}
          showsMyLocationButton={true}
          zoomControlEnabled={true}
          toolbarEnabled={false}
        >
          <Marker
            coordinate={{
              latitude: address.latitude,
              longitude: address.longitude,
            }}
            pinColor="#E65C00"
          />
        </MapView>
        
        {/* Floating Back Button */}
        <TouchableOpacity 
          style={styles.floatingBackButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        {/* Center Marker */}
        <View style={styles.mapMarkerFixed}>
          <Icon name="location-sharp" size={32} color="#E65C00" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Form Section */}
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle}>Address Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address Type</Text>
              <View style={styles.typeOptions}>
                {(['home', 'work', 'other'] as AddressType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      address.type === type && styles.selectedTypeOption,
                    ]}
                    onPress={() => setAddress({ ...address, type })}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name={
                        type === 'home' ? 'home-outline' :
                        type === 'work' ? 'briefcase-outline' : 'location-outline'
                      }
                      size={20}
                      color={address.type === type ? '#E65C00' : '#777'}
                    />
                    <Text
                      style={[
                        styles.typeOptionText,
                        address.type === type && styles.selectedTypeOptionText,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Name this location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Home, Office, etc."
                placeholderTextColor="#999"
                value={address.name}
                onChangeText={(text) => setAddress({ ...address, name: text })}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Address</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Enter complete address"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                value={address.address}
                onChangeText={(text) => setAddress({ ...address, address: text })}
                returnKeyType="done"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer with Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveAddress}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {addressToEdit ? 'Update Address' : 'Save Address'}
            </Text>
            <Icon name="checkmark" size={20} color="#fff" style={styles.saveButtonIcon} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  mapContainer: {
    height: '40%',
    width: '100%',
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  mapMarkerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -32,
    zIndex: 1,
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 15,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#444',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
    gap: 10,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedTypeOption: {
    backgroundColor: 'rgba(230, 92, 0, 0.1)',
    borderColor: 'rgba(230, 92, 0, 0.5)',
  },
  typeOptionText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#777',
  },
  selectedTypeOptionText: {
    color: '#E65C00',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#E65C00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  saveButtonIcon: {
    marginLeft: 8,
  },
  headerButton: {
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
});

export default MapLocationPicker;