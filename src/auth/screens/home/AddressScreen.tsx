import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';
import { getAddressList, updateUserStatusAddress, deleteUserAddress } from '../../../api/address';

interface ApiAddress {
  id: number;
  full_address: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  near_by_landmark: string;
  home_type: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
}

interface AddressScreenProps {
  route?: {
    params?: {
      onAddressSelect?: (address: Address) => void;
      selectionMode?: boolean;
      navigateToCart?: boolean;
    };
  };
}

const AddressScreen: React.FC<AddressScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const isSelectionMode = route?.params?.selectionMode ?? true;
  const onAddressSelect = route?.params?.onAddressSelect;
  const navigateToCart = route?.params?.navigateToCart ?? false;
  
  useEffect(() => {
    fetchAddresses();
  }, []);

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  };

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      fadeAnim.setValue(0);
      const response = await getAddressList();
      const formattedAddresses = formatAddresses(response.data);
      setSavedAddresses(formattedAddresses);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
      setError('Failed to load addresses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatAddresses = (apiAddresses: ApiAddress[]): Address[] => {
    return apiAddresses.map(apiAddress => ({
      id: apiAddress.id.toString(),
      type: mapHomeTypeToAddressType(apiAddress.home_type),
      name: `${apiAddress.home_type}`,
      address: formatFullAddress(apiAddress),
      isDefault: apiAddress.is_default,
      latitude: apiAddress.latitude || 0,
      longitude: apiAddress.longitude || 0,
      rawAddress: apiAddress,
    }));
  };

  const mapHomeTypeToAddressType = (homeType: string): AddressType => {
    switch (homeType.toLowerCase()) {
      case 'home': return 'home';
      case 'work': return 'work';
      default: return 'other';
    }
  };

  const formatFullAddress = (address: ApiAddress): string => {
    return [
      address.street_address,
      address.city,
      address.state,
      address.zip_code,
      address.country,
      address.near_by_landmark && `(Landmark: ${address.near_by_landmark})`
    ].filter(Boolean).join(', ');
  };

  const getIconName = (type: AddressType) => {
    switch (type) {
      case 'home': return 'home';
      case 'work': return 'briefcase';
      default: return 'location';
    }
  };

  const handleAddNewAddress = () => {
    const prevLocation = route?.params?.prevLocation;

    const params: MapLocationPickerParams = {
      prevLocation,
      onLocationConfirmed: (newAddress: Address) => {
        setSavedAddresses([...savedAddresses, newAddress]);
      },
    };
    navigation.navigate('MapLocationPicker', params);
  };

  const handleEditAddress = (address: Address) => {
    const prevLocation = route?.params?.prevLocation;
    const params: MapLocationPickerParams = {
      addressToEdit: address,
      prevLocation: prevLocation,
      onLocationConfirmed: (updatedAddress: Address) => {
        setSavedAddresses(savedAddresses.map(addr => 
          addr.id === updatedAddress.id ? updatedAddress : addr
        ));
      },
    };
    navigation.navigate('MapLocationPicker', params);
  };

  const handleDeleteAddress = async (id: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUserAddress(id);
              setSavedAddresses(savedAddresses.filter(addr => addr.id !== id));
            } catch (error) {
              console.error('Failed to delete address:', error);
              Alert.alert("Error", "Failed to delete address. Please try again.");
            }
          }
        }
      ]
    );
  };

  const setAsDefaultAddress = async (id: string) => {
    try {
      await updateUserStatusAddress(id, { is_default: true });
      
      const updatedAddresses = savedAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === id,
      }));
      
      setSavedAddresses(updatedAddresses);
    } catch (error) {
      console.error('Failed to update default address:', error);
      Alert.alert("Error", "Failed to update default address. Please try again.");
    }
  };

  const storeAddressToStorage = async (address: Address) => {
    try {
      const addressData = address.rawAddress;
      await AsyncStorage.multiSet([
          ['AddressId', String(addressData.id)],
          ['StreetAddress', String(addressData.full_address)],
          ['HomeType', String(addressData.home_type || 'Delivering to')],
          ['Latitude', String(addressData.latitude)],
          ['Longitude', String(addressData.longitude)],
        ]);
    } catch (error) {
      console.error('Failed to save address to storage:', error);
    }
  };

  const handleAddressSelect = async (address: Address) => {
    if (!isSelectionMode) return;
    setSelectedAddressId(address.id);
    await storeAddressToStorage(address);
    if (onAddressSelect) {
      onAddressSelect(address);
    }
    if (navigateToCart) {
      navigation.navigate('CartScreen');
    } else {
      setTimeout(() => navigation.goBack(), 500);
    }
  };

  const filteredAddresses = savedAddresses.filter(addr => 
    addr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    addr.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#E65C00" />
      <Text style={styles.loadingText}>Loading your addresses...</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Icon name="warning" size={48} color="#FF6B6B" style={styles.errorIcon} />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={fetchAddresses}
      >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => (
    <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4A90E2']}
            tintColor="#4A90E2"
          />
        }
      >
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#888" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search addresses..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Icon name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddNewAddress}
        >
          <View style={styles.addButtonIcon}>
            <Icon name="add" size={24} color="#FFF" />
          </View>
          <Text style={styles.addButtonText}>Add New Address</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          {isSelectionMode ? 'Select an Address' : 'Saved Addresses'}
        </Text>
        
        {filteredAddresses.length > 0 ? (
          filteredAddresses.map((address, index) => (
            <Animatable.View 
              key={address.id}
              animation="fadeInUp"
              duration={500}
              delay={index * 100}
              style={[
                styles.addressCard, 
                address.isDefault && styles.defaultAddressCard,
                isSelectionMode && selectedAddressId === address.id && styles.selectedAddressCard
              ]}
            >
              <TouchableOpacity
                onPress={() => handleAddressSelect(address)}
                activeOpacity={0.7}
                style={styles.addressCardTouchable}
              >
                <View style={styles.addressHeader}>
                  <View style={[
                    styles.addressIcon,
                    { 
                      backgroundColor: address.isDefault ? '#eb6c18ff' : 
                        (isSelectionMode && selectedAddressId === address.id) ? '#4CAF50' : '#E0E0E0'
                    }
                  ]}>
                    <Icon 
                      name={getIconName(address.type)} 
                      size={20} 
                      color={
                        address.isDefault ? '#FFF' : 
                        (isSelectionMode && selectedAddressId === address.id) ? '#FFF' : '#555'
                      } 
                    />
                  </View>
                  <View style={styles.addressTitleContainer}>
                    <Text style={styles.addressName}>
                      {address.name.charAt(0).toUpperCase() + address.name.slice(1)}
                    </Text>
                    {address.isDefault && (
                      <View style={styles.defaultTag}>
                        <Text style={styles.defaultTagText}>Default</Text>
                      </View>
                    )}
                    {isSelectionMode && selectedAddressId === address.id && (
                      <View style={styles.selectedTag}>
                        <Text style={styles.selectedTagText}>Selected</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <Text style={styles.addressText}>{address.address}</Text>
              </TouchableOpacity>
                
              <View style={styles.cardActions}>
                <View style={styles.actionButtons}>
                  {/* <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleEditAddress(address)}
                  >
                    <Icon name="create-outline" size={18} color="#e97528ff" />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity> */}
                  
                  {!address.isDefault && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => setAsDefaultAddress(address.id)}
                    >
                      <Icon name="star-outline" size={18} color="#FFC107" />
                      <Text style={[styles.actionButtonText, { color: '#FFC107' }]}>Set Default</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleDeleteAddress(address.id)}
                  >
                    <Icon name="trash-outline" size={18} color="#FF6B6B" />
                    <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>Delete</Text>
                  </TouchableOpacity> */}
                </View>
                
                {isSelectionMode && (
                  <TouchableOpacity
                    style={[
                      styles.selectButton,
                      selectedAddressId === address.id && styles.selectedButton
                    ]}
                    onPress={() => handleAddressSelect(address)}
                  >
                    <Text style={styles.selectButtonText}>
                      {selectedAddressId === address.id ? 'Selected' : 'Select'}
                    </Text>
                    {selectedAddressId === address.id && (
                      <Icon name="checkmark" size={14} color="#FFF" style={styles.selectButtonIcon} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </Animatable.View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="map" size={60} color="#DDD" />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No addresses found' : 'No saved addresses'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Try a different search term' : 'Add your first address to get started'}
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isSelectionMode ? 'Select Address' : 'My Addresses'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? renderLoading() : error ? renderError() : renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#E65C00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eb7323ff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonIcon: {
    marginRight: 12,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  addressCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addressCardTouchable: {
    marginBottom: 12,
  },
  defaultAddressCard: {
    borderWidth: 1.5,
    borderColor: '#E65C00',
    backgroundColor: '#FFF9F0',
  },
  selectedAddressCard: {
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    backgroundColor: '#F5FFF5',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  defaultTag: {
    backgroundColor: '#E65C00',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  defaultTagText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedTag: {
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  selectedTagText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 52, // Align with icon
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#E65C00',
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E65C00',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 80,
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
  },
  selectButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  selectButtonIcon: {
    marginLeft: 4,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});


export default AddressScreen;