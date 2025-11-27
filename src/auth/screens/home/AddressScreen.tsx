import React, { useState, useEffect, useCallback } from 'react';
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
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
      prevLocation?: any;
    };
  };
}

const AddressScreen: React.FC<AddressScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
  
  // Memoized fetch function to prevent unnecessary re-renders
  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAddressList();
      const formattedAddresses = formatAddresses(response.data);
      setSavedAddresses(formattedAddresses);
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
      setError('Failed to load addresses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    if (!loading && savedAddresses.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [loading, savedAddresses.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  }, [fetchAddresses]);

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
        setSavedAddresses(prev => [...prev, newAddress]);
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
        setSavedAddresses(prev => prev.map(addr => 
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
              setSavedAddresses(prev => prev.filter(addr => addr.id !== id));
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
      
      setSavedAddresses(prev => prev.map(addr => ({
        ...addr,
        isDefault: addr.id === id,
      })));
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
      // Use setTimeout to ensure smooth transition
      setTimeout(() => navigation.goBack(), 300);
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

  const renderAddressCard = (address: Address, index: number) => (
    <Animatable.View 
      key={address.id}
      animation="fadeInUp"
      duration={400}
      delay={index * 80}
      useNativeDriver
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
              backgroundColor: address.isDefault ? '#FF6B35' : 
                (isSelectionMode && selectedAddressId === address.id) ? '#4CAF50' : '#F0F0F0'
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
            <View style={styles.tagContainer}>
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
        </View>
        
        <Text style={styles.addressText}>{address.address}</Text>
      </TouchableOpacity>
        
      <View style={styles.cardActions}>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEditAddress(address)}
          >
            <Icon name="create-outline" size={18} color="#666" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          
          {!address.isDefault && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setAsDefaultAddress(address.id)}
            >
              <Icon name="star-outline" size={18} color="#666" />
              <Text style={styles.actionButtonText}>Set Default</Text>
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
  );

  const renderContent = () => (
    <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
            returnKeyType="search"
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
          activeOpacity={0.8}
        >
          <View style={styles.addButtonContent}>
            <View style={styles.addButtonIconContainer}>
              <Icon name="add" size={24} color="#FFF" />
            </View>
            <Text style={styles.addButtonText}>Add New Address</Text>
          </View>
        </TouchableOpacity>

        {filteredAddresses.length > 0 ? (
          filteredAddresses.map((address, index) => renderAddressCard(address, index))
        ) : (
          <View style={styles.emptyState}>
            <Icon name="map-outline" size={72} color="#E0E0E0" />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No addresses found' : 'No saved addresses'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Try a different search term' : 'Add your first address to get started'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={handleAddNewAddress}
              >
                <Text style={styles.emptyStateButtonText}>Add Address</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Add some bottom padding for better scrolling */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <View style={styles.backButtonContainer}>
              <Icon name="chevron-back" size={24} color="#333" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isSelectionMode ? 'Manage Addresses' : 'My Addresses'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addLocationButton}
            onPress={handleAddNewAddress}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Icon name="add" size={22} color="#FF6B35" />
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    paddingHorizontal: 16,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  addLocationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingBottom: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8F9FA',
  },
  errorIcon: {
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  contentContainer: {
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: '#F8F9FA',
    minHeight: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    padding: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  addButton: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FF6B35',
    borderStyle: 'dashed',
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: '#FF6B35',
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  addressCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  addressCardTouchable: {
    marginBottom: 14,
  },
  defaultAddressCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF9F0',
  },
  selectedAddressCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#F8FFF8',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addressTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  addressName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  defaultTag: {
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  defaultTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedTag: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  selectedTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addressText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 21,
    marginLeft: 60, // Align with icon
    paddingRight: 10,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  actionButtonText: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    minWidth: 90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  selectedButton: {
    backgroundColor: '#4CAF50',
  },
  selectButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  selectButtonIcon: {
    marginLeft: 5,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 30,
    marginHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  emptyStateButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default AddressScreen;