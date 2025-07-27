import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Ionicons';
import { Address, AddressType, MapLocationPickerParams } from './addressTypes';

const dummyGeocode = async (latitude: number, longitude: number): Promise<{results: {formatted_address: string}[]}> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const latDiff = latitude - 19.0760;
  const lngDiff = longitude - 72.8777;
  
  const areas = [
    {name: "Colaba", suffix: "Mumbai - 400005"},
    {name: "Bandra West", suffix: "Mumbai - 400050"},
    {name: "Andheri East", suffix: "Mumbai - 400069"},
    {name: "Dadar West", suffix: "Mumbai - 400028"},
    {name: "Powai", suffix: "Mumbai - 400076"}
  ];
  
  const areaIndex = Math.min(
    Math.floor(Math.abs(latDiff + lngDiff) * 10), 
    areas.length - 1
  );
  
  const selectedArea = areas[areaIndex];
  const streetNumber = Math.floor(Math.random() * 500) + 1;
  const streetTypes = ["Main Road", "Street", "Lane", "Avenue", "Marg"];
  const streetType = streetTypes[Math.floor(Math.random() * streetTypes.length)];
  
  return {
    results: [{
      formatted_address: `${streetNumber}, ${selectedArea.name} ${streetType}, ${selectedArea.suffix}`
    }]
  };
};

const MapLocationPicker = ({ navigation, route }: { navigation: any, route: { params?: MapLocationPickerParams } }) => {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState({
    latitude: 19.0760,
    longitude: 72.8777,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [address, setAddress] = useState('');
  const [addressName, setAddressName] = useState('');
  const [addressType, setAddressType] = useState<AddressType>('other');
  const [isLoading, setIsLoading] = useState(false);

  const { addressToEdit, onLocationConfirmed } = route.params || {};

  useEffect(() => {
    if (addressToEdit) {
      setAddressName(addressToEdit.name);
      setAddressType(addressToEdit.type);
      setAddress(addressToEdit.address);
      animateToRegion({
        latitude: addressToEdit.latitude,
        longitude: addressToEdit.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    } else {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = () => {
    setIsLoading(true);
    setTimeout(() => {
      const latitude = 19.0760 + (Math.random() * 0.1 - 0.05);
      const longitude = 72.8777 + (Math.random() * 0.1 - 0.05);
      updateAddressFromCoords(latitude, longitude);
      animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
      setIsLoading(false);
    }, 1000);
  };

  const animateToRegion = (newRegion: typeof region) => {
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 1000);
  };

  const handleMapDragEnd = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    await updateAddressFromCoords(latitude, longitude);
  };

  const updateAddressFromCoords = async (latitude: number, longitude: number) => {
    try {
      setIsLoading(true);
      const json = await dummyGeocode(latitude, longitude);
      const formattedAddress = json.results[0]?.formatted_address || '';
      setAddress(formattedAddress);
      setRegion(prev => ({
        ...prev,
        latitude,
        longitude,
      }));
    } catch (error) {
      console.log('Geocoder error', error);
      setAddress("Could not determine address");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchLocation = () => {
    const newLat = 19.0760 + (Math.random() * 0.1 - 0.05);
    const newLng = 72.8777 + (Math.random() * 0.1 - 0.05);
    
    animateToRegion({
      latitude: newLat,
      longitude: newLng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
    updateAddressFromCoords(newLat, newLng);
  };

  const validateInputs = () => {
    if (!address) {
      Alert.alert("Location Required", "Please select a location on the map");
      return false;
    }
    if (!addressName.trim()) {
      Alert.alert("Name Required", "Please provide a name for this address");
      return false;
    }
    return true;
  };

  const handleConfirmLocation = () => {
    if (!validateInputs()) return;
    
    const newAddress: Address = {
      id: addressToEdit?.id || Date.now().toString(),
      type: addressType,
      name: addressName.trim(),
      address,
      latitude: region.latitude,
      longitude: region.longitude,
      isDefault: addressToEdit?.isDefault || false,
    };

    onLocationConfirmed?.(newAddress);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TouchableOpacity 
          style={styles.searchInput}
          onPress={handleSearchLocation}
        >
          <Icon name="search-outline" size={20} color="#777" style={styles.searchIcon} />
          <Text style={styles.searchPlaceholder}>Search for area, street name...</Text>
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={handleMapDragEnd}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
      >
        <Marker
          coordinate={{
            latitude: region.latitude,
            longitude: region.longitude,
          }}
        >
          <View style={styles.marker}>
            <View style={styles.markerRing}>
              <Icon name="location-sharp" size={24} color="#E65C00" />
            </View>
            <View style={styles.markerPointer} />
          </View>
        </Marker>
      </MapView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.confirmationCard}
      >
        <View style={styles.locationInfo}>
          <Icon name="location-sharp" size={20} color="#E65C00" style={styles.locationIcon} />
          <Text style={styles.locationText}>Order will be delivered here</Text>
        </View>

        <Text style={styles.addressText}>
          {isLoading ? "Loading address..." : address || "Drag the map to select location"}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Save as (e.g., Home, Office)"
          value={addressName}
          onChangeText={setAddressName}
          placeholderTextColor="#999"
        />

        <View style={styles.addressTypeContainer}>
          {(['home', 'work', 'other'] as AddressType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.addressTypeButton, addressType === type && styles.addressTypeButtonActive]}
              onPress={() => setAddressType(type)}
            >
              <Icon 
                name={
                  type === 'home' ? 'home-outline' :
                  type === 'work' ? 'briefcase-outline' :
                  'location-outline'
                } 
                size={18} 
                color={addressType === type ? '#E65C00' : '#777'} 
              />
              <Text style={[styles.addressTypeText, addressType === type && styles.addressTypeTextActive]}>
                {type === 'home' ? 'Home' : type === 'work' ? 'Work' : 'Other'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, (isLoading || !address) && styles.confirmButtonDisabled]}
          onPress={handleConfirmLocation}
          disabled={isLoading || !address}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>
              {addressToEdit ? 'Update Address' : 'Save Address'}
            </Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  // ... [keep all existing styles from your original file]
  confirmButtonDisabled: {
    opacity: 0.6,
  },
});

export default MapLocationPicker;