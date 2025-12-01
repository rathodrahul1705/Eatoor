import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';
import { getAddressList, updateUserStatusAddress, deleteUserAddress } from '../../../api/address';
import LinearGradient from 'react-native-linear-gradient';

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AddressScreen: React.FC<AddressScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const searchBarAnim = useRef(new Animated.Value(1)).current;

  const isSelectionMode = route?.params?.selectionMode ?? true;
  const onAddressSelect = route?.params?.onAddressSelect;
  const navigateToCart = route?.params?.navigateToCart ?? false;
  
  // Memoized fetch function
  const fetchAddresses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAddressList();
      const formattedAddresses = formatAddresses(response.data);
      setSavedAddresses(formattedAddresses);
      
      // Set the default address as selected initially
      const defaultAddress = formattedAddresses.find(addr => addr.isDefault);
      if (defaultAddress && isSelectionMode) {
        setSelectedAddressId(defaultAddress.id);
      }
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
      setError('Failed to load addresses. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isSelectionMode]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  useEffect(() => {
    if (!loading && savedAddresses.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start();
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
      name: `${apiAddress.home_type.charAt(0).toUpperCase() + apiAddress.home_type.slice(1)}`,
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
      case 'apartment': return 'other';
      case 'office': return 'work';
      default: return 'other';
    }
  };

  const formatFullAddress = (address: ApiAddress): string => {
    const parts = [
      address.street_address,
      address.city,
      address.state,
      address.zip_code,
      address.country,
    ].filter(Boolean);
    
    if (address.near_by_landmark) {
      parts.push(`(Near ${address.near_by_landmark})`);
    }
    
    return parts.join(', ');
  };

  const getIconName = (type: AddressType) => {
    switch (type) {
      case 'home': return 'home';
      case 'work': return 'briefcase';
      default: return 'location';
    }
  };

  const getIconColor = (address: Address) => {
    if (address.isDefault) return '#FF6B35';
    if (isSelectionMode && selectedAddressId === address.id) return '#4CAF50';
    return '#666';
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    Animated.spring(searchBarAnim, {
      toValue: 1.02,
      useNativeDriver: true,
    }).start();
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    Animated.spring(searchBarAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleAddNewAddress = () => {
    const prevLocation = route?.params?.prevLocation;

    const params: MapLocationPickerParams = {
      prevLocation,
      onLocationConfirmed: (newAddress: Address) => {
        setSavedAddresses(prev => [...prev, newAddress]);
        if (newAddress.isDefault) {
          setSelectedAddressId(newAddress.id);
        }
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
        if (updatedAddress.isDefault) {
          setSelectedAddressId(updatedAddress.id);
        }
      },
    };
    navigation.navigate('MapLocationPicker', params);
  };

  const confirmDeleteAddress = (id: string) => {
    setAddressToDelete(id);
    setShowDeleteModal(true);
  };

  const handleDeleteAddress = async () => {
    if (!addressToDelete) return;
    
    try {
      await deleteUserAddress(addressToDelete);
      setSavedAddresses(prev => prev.filter(addr => addr.id !== addressToDelete));
      if (selectedAddressId === addressToDelete) {
        setSelectedAddressId(null);
      }
      setShowDeleteModal(false);
      setAddressToDelete(null);
    } catch (error) {
      console.error('Failed to delete address:', error);
      Alert.alert("Error", "Failed to delete address. Please try again.");
    }
  };

  const setAsDefaultAddress = async (id: string) => {
    try {
      await updateUserStatusAddress(id, { is_default: true });
      
      setSavedAddresses(prev => prev.map(addr => ({
        ...addr,
        isDefault: addr.id === id,
      })));
      setSelectedAddressId(id);
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
    
    // Add haptic feedback here if available
    // ReactNativeHapticFeedback.trigger("impactLight");
    
    if (navigateToCart) {
      navigation.navigate('CartScreen');
    } else {
      setTimeout(() => navigation.goBack(), 300);
    }
  };

  const filteredAddresses = savedAddresses.filter(addr => 
    addr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    addr.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Loading your addresses...</Text>
      <Text style={styles.loadingSubText}>Please wait a moment</Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Icon name="warning-outline" size={64} color="#FF6B6B" style={styles.errorIcon} />
      <Text style={styles.errorTitle}>Oops!</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={fetchAddresses}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#FF6B35', '#FF8C42']}
          style={styles.gradientButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Icon name="refresh" size={20} color="#FFF" style={styles.retryIcon} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderAddressCard = (address: Address, index: number) => (
    <Animatable.View 
      key={address.id}
      animation="fadeInUp"
      duration={500}
      delay={index * 100}
      useNativeDriver
      style={[
        styles.addressCard, 
        address.isDefault && styles.defaultAddressCard,
        isSelectionMode && selectedAddressId === address.id && styles.selectedAddressCard,
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 50],
              outputRange: [0, 10 * index],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity
        onPress={() => handleAddressSelect(address)}
        activeOpacity={0.7}
        style={styles.addressCardTouchable}
      >
        <View style={styles.addressHeader}>
          <LinearGradient
            colors={
              address.isDefault 
                ? ['#FF6B35', '#FF8C42'] 
                : (isSelectionMode && selectedAddressId === address.id)
                ? ['#4CAF50', '#66BB6A']
                : ['#F8F9FA', '#FFFFFF']
            }
            style={styles.addressIconContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon 
              name={getIconName(address.type)} 
              size={20} 
              color={getIconColor(address)} 
            />
          </LinearGradient>
          
          <View style={styles.addressTitleContainer}>
            <Text style={styles.addressName}>
              {address.name}
            </Text>
            <View style={styles.tagContainer}>
              {address.isDefault && (
                <View style={styles.defaultTag}>
                  <Icon name="star" size={10} color="#FFF" />
                  <Text style={styles.defaultTagText}>Default</Text>
                </View>
              )}
              {isSelectionMode && selectedAddressId === address.id && !address.isDefault && (
                <View style={styles.selectedTag}>
                  <Icon name="checkmark" size={10} color="#FFF" />
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
            activeOpacity={0.6}
          >
            <Icon name="create-outline" size={18} color="#4A90E2" />
            <Text style={[styles.actionButtonText, { color: '#4A90E2' }]}>Edit</Text>
          </TouchableOpacity>
          
          {!address.isDefault && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setAsDefaultAddress(address.id)}
              activeOpacity={0.6}
            >
              <Icon name="star-outline" size={18} color="#FFB74D" />
              <Text style={[styles.actionButtonText, { color: '#FFB74D' }]}>Set Default</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {isSelectionMode && (
          <TouchableOpacity
            style={[
              styles.selectButton,
              selectedAddressId === address.id && styles.selectedButton
            ]}
            onPress={() => handleAddressSelect(address)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                selectedAddressId === address.id 
                  ? ['#4CAF50', '#66BB6A']
                  : ['#FF6B35', '#FF8C42']
              }
              style={styles.selectButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.selectButtonText}>
                {selectedAddressId === address.id ? 'Selected' : 'Select'}
              </Text>
              {selectedAddressId === address.id && (
                <Icon name="checkmark" size={16} color="#FFF" style={styles.selectButtonIcon} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Animatable.View>
  );

  const renderDeleteModal = () => (
    <Modal
      visible={showDeleteModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeleteModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animatable.View 
              animation="bounceIn"
              duration={400}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalIconContainer}>
                  <Icon name="warning" size={32} color="#FF6B6B" />
                </View>
                <Text style={styles.modalTitle}>Delete Address</Text>
                <Text style={styles.modalSubtitle}>
                  Are you sure you want to delete this address? This action cannot be undone.
                </Text>
              </View>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowDeleteModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={handleDeleteAddress}
                  activeOpacity={0.7}
                >
                  <Icon name="trash" size={18} color="#FFF" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Animatable.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderContent = () => (
    <Animated.View 
      style={[
        styles.contentContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B35']}
            tintColor="#FF6B35"
            progressBackgroundColor="#FFF"
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View 
          style={[
            styles.searchContainer,
            {
              transform: [{ scale: searchBarAnim }]
            }
          ]}
        >
          <Icon 
            name="search" 
            size={20} 
            color={isSearchFocused ? "#FF6B35" : "#888"} 
            style={styles.searchIcon} 
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search addresses by name or location..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            clearButtonMode="while-editing"
          />
        </Animated.View>

        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddNewAddress}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#FF6B35', '#FF8C42']}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.addButtonContent}>
              <View style={styles.addButtonIconContainer}>
                <Icon name="add" size={22} color="#FFF" />
              </View>
              <Text style={styles.addButtonText}>Add New Address</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#FFF" style={styles.addButtonArrow} />
          </LinearGradient>
        </TouchableOpacity>

        {filteredAddresses.length > 0 ? (
          <>
            {filteredAddresses.map((address, index) => renderAddressCard(address, index))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Icon 
              name={searchQuery ? "search-outline" : "map-outline"} 
              size={80} 
              color="#E0E0E0" 
            />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No addresses found' : 'No saved addresses yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery 
                ? 'Try searching with different keywords'
                : 'Add your first address to get started with deliveries'
              }
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyStateButton}
                onPress={handleAddNewAddress}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8C42']}
                  style={styles.emptyStateButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Icon name="add" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.emptyStateButtonText}>Add Your First Address</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Custom Header */}
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FA']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <View style={styles.backButtonContainer}>
              <Icon name="chevron-back" size={24} color="#333" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isSelectionMode ? 'Select Address' : 'My Addresses'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addLocationButton}
            onPress={handleAddNewAddress}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.7}
          >
            <Icon name="add-circle" size={28} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? renderLoading() : error ? renderError() : renderContent()}
      {renderDeleteModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
    marginTop: 2,
  },
  addLocationButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#FFF',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingBottom: 60,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#888',
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
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
    fontWeight: '500',
  },
  retryButton: {
    width: '80%',
    maxWidth: 200,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  contentContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: '#F8F9FA',
    minHeight: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    padding: 0,
    paddingVertical: 4,
  },
  addButton: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  addButtonArrow: {
    opacity: 0.9,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginBottom: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  addressCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addressCardTouchable: {
    marginBottom: 16,
  },
  defaultAddressCard: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF9F0',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.15,
  },
  selectedAddressCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#F8FFF8',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.15,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  addressTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 4,
  },
  addressName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    marginRight: 10,
    letterSpacing: -0.3,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  defaultTag: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultTagText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  selectedTag: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedTagText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  addressText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginLeft: 68, // Align with icon
    paddingRight: 10,
    letterSpacing: 0.1,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
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
    marginRight: 20,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  selectButton: {
    borderRadius: 20,
    overflow: 'hidden',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  selectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  selectedButton: {
    shadowColor: '#4CAF50',
  },
  selectButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  selectButtonIcon: {
    marginLeft: 6,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
    marginHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#666',
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontWeight: '500',
  },
  emptyStateButton: {
    width: '100%',
    maxWidth: 280,
  },
  emptyStateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyStateButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  bottomSpacer: {
    height: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '700',
    fontSize: 16,
  },
  deleteButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
});

export default AddressScreen;