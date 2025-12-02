import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';
import { getAddressList, updateUserStatusAddress, deleteUserAddress } from '../../../api/address';
import LinearGradient from 'react-native-linear-gradient';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const { width, height } = useWindowDimensions();
  
  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [hasAnimatedIn, setHasAnimatedIn] = useState(false);
  
  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animations - Initialize with final values to prevent flicker
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  
  // Configuration
  const isSelectionMode = route?.params?.selectionMode ?? true;
  const onAddressSelect = route?.params?.onAddressSelect;
  const navigateToCart = route?.params?.navigateToCart ?? false;
  
  // Cleanup function
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);
  
  // Optimized fetch function - only fetch once
  const fetchAddresses = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);
      
      const response = await getAddressList();
      const formattedAddresses = formatAddresses(response.data);
      
      // Use requestAnimationFrame for smooth state updates
      requestAnimationFrame(() => {
        if (!isMountedRef.current) return;
        
        setSavedAddresses(formattedAddresses);
        
        // Set default address as selected
        const defaultAddress = formattedAddresses.find(addr => addr.isDefault);
        if (defaultAddress && isSelectionMode) {
          setSelectedAddressId(defaultAddress.id);
        }
        
        // Initial load animation
        if (initialLoad) {
          setInitialLoad(false);
          
          // Small delay to ensure render is complete
          animationTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              Animated.parallel([
                Animated.timing(fadeAnim, {
                  toValue: 1,
                  duration: 300,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                  delay: 50,
                }),
                Animated.timing(contentOpacity, {
                  toValue: 1,
                  duration: 250,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
              ]).start(() => {
                if (isMountedRef.current) {
                  setHasAnimatedIn(true);
                }
              });
            }
          }, 50);
        }
      });
      
    } catch (err) {
      console.error('Failed to fetch addresses:', err);
      setError('Failed to load addresses. Please check your connection and try again.');
    } finally {
      if (!isRefreshing) {
        setLoading(false);
      }
    }
  }, [initialLoad, isSelectionMode]);
  
  // Initial load only once
  useEffect(() => {
    fetchAddresses();
    
    // Don't return cleanup function here, we have it above
  }, []); // Empty dependency array - only run once on mount

  // Optimized refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAddresses(true);
    setRefreshing(false);
  }, [fetchAddresses]);

  // Helper functions
  const formatAddresses = useCallback((apiAddresses: ApiAddress[]): Address[] => {
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
  }, []);

  const mapHomeTypeToAddressType = useCallback((homeType: string): AddressType => {
    switch (homeType.toLowerCase()) {
      case 'home': return 'home';
      case 'work': return 'work';
      case 'apartment': return 'other';
      case 'office': return 'work';
      default: return 'other';
    }
  }, []);

  const formatFullAddress = useCallback((address: ApiAddress): string => {
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
  }, []);

  const getIconName = useCallback((type: AddressType) => {
    switch (type) {
      case 'home': return 'home';
      case 'work': return 'briefcase';
      default: return 'location';
    }
  }, []);

  const getIconColor = useCallback((address: Address) => {
    if (address.isDefault) return '#FF6B35';
    if (isSelectionMode && selectedAddressId === address.id) return '#4CAF50';
    return '#666';
  }, [isSelectionMode, selectedAddressId]);

  // Event handlers
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    Animated.spring(searchBarAnim, {
      toValue: 1.02,
      tension: 150,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    Animated.spring(searchBarAnim, {
      toValue: 1,
      tension: 150,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAddNewAddress = useCallback(() => {
    const prevLocation = route?.params?.prevLocation;
    const params: MapLocationPickerParams = {
      prevLocation,
      onLocationConfirmed: (newAddress: Address) => {
        // Use LayoutAnimation for smooth updates
        LayoutAnimation.configureNext({
          duration: 300,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
          },
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });
        
        setSavedAddresses(prev => [...prev, newAddress]);
        if (newAddress.isDefault) {
          setSelectedAddressId(newAddress.id);
        }
      },
    };
    navigation.navigate('MapLocationPicker', params);
  }, [route?.params?.prevLocation, navigation]);

  const handleEditAddress = useCallback((address: Address) => {
    const prevLocation = route?.params?.prevLocation;
    const params: MapLocationPickerParams = {
      addressToEdit: address,
      prevLocation: prevLocation,
      onLocationConfirmed: (updatedAddress: Address) => {
        LayoutAnimation.configureNext({
          duration: 300,
          update: {
            type: LayoutAnimation.Types.easeInEaseOut,
          },
        });
        
        setSavedAddresses(prev => prev.map(addr => 
          addr.id === updatedAddress.id ? updatedAddress : addr
        ));
        if (updatedAddress.isDefault) {
          setSelectedAddressId(updatedAddress.id);
        }
      },
    };
    navigation.navigate('MapLocationPicker', params);
  }, [route?.params?.prevLocation, navigation]);

  const confirmDeleteAddress = useCallback((id: string) => {
    setAddressToDelete(id);
    setShowDeleteModal(true);
  }, []);

  const handleDeleteAddress = useCallback(async () => {
    if (!addressToDelete) return;
    
    try {
      await deleteUserAddress(addressToDelete);
      
      LayoutAnimation.configureNext({
        duration: 300,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
      
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
  }, [addressToDelete, selectedAddressId]);

  const setAsDefaultAddress = useCallback(async (id: string) => {
    try {
      await updateUserStatusAddress(id, { is_default: true });
      
      LayoutAnimation.configureNext({
        duration: 300,
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
      
      setSavedAddresses(prev => prev.map(addr => ({
        ...addr,
        isDefault: addr.id === id,
      })));
      setSelectedAddressId(id);
    } catch (error) {
      console.error('Failed to update default address:', error);
      Alert.alert("Error", "Failed to update default address. Please try again.");
    }
  }, []);

  const storeAddressToStorage = useCallback(async (address: Address) => {
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
  }, []);

  const handleAddressSelect = useCallback(async (address: Address) => {
    if (!isSelectionMode) return;
    
    // Smooth selection animation
    LayoutAnimation.configureNext({
      duration: 200,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    
    setSelectedAddressId(address.id);
    await storeAddressToStorage(address);
    
    if (onAddressSelect) {
      onAddressSelect(address);
    }
    
    // Haptic feedback (if available)
    // ReactNativeHapticFeedback.trigger("impactLight");
    
    if (navigateToCart) {
      navigation.navigate('CartScreen');
    } else {
      // Smooth navigation back
      setTimeout(() => navigation.goBack(), 150);
    }
  }, [isSelectionMode, onAddressSelect, navigateToCart, navigation, storeAddressToStorage]);

  // Memoized filtered addresses for performance
  const filteredAddresses = useMemo(() => {
    return savedAddresses.filter(addr => 
      addr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      addr.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [savedAddresses, searchQuery]);

  // Component rendering - use useMemo to prevent unnecessary re-renders
  const renderLoading = useMemo(() => () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Loading your addresses...</Text>
      <Text style={styles.loadingSubText}>Please wait a moment</Text>
    </View>
  ), []);

  const renderError = useMemo(() => () => (
    <View style={styles.errorContainer}>
      <Icon name="warning-outline" size={64} color="#FF6B6B" style={styles.errorIcon} />
      <Text style={styles.errorTitle}>Oops!</Text>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity 
        style={styles.retryButton}
        onPress={() => fetchAddresses()}
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
  ), [error, fetchAddresses]);

  const renderAddressCard = useCallback((address: Address, index: number) => (
    <Animated.View 
      key={address.id}
      style={[
        styles.addressCard, 
        address.isDefault && styles.defaultAddressCard,
        isSelectionMode && selectedAddressId === address.id && styles.selectedAddressCard,
        {
          opacity: fadeAnim,
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
          {/* <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleEditAddress(address)}
            activeOpacity={0.6}
          >
            <Icon name="create-outline" size={18} color="#4A90E2" />
            <Text style={[styles.actionButtonText, { color: '#4A90E2' }]}>Edit</Text>
          </TouchableOpacity> */}
          
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
          
          {/* {!address.isDefault && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => confirmDeleteAddress(address.id)}
              activeOpacity={0.6}
            >
              <Icon name="trash-outline" size={18} color="#FF6B6B" />
              <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>Delete</Text>
            </TouchableOpacity>
          )} */}
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
    </Animated.View>
  ), [selectedAddressId, isSelectionMode, handleAddressSelect, handleEditAddress, setAsDefaultAddress, confirmDeleteAddress, getIconName, getIconColor]);

  const renderDeleteModal = useMemo(() => () => (
    <Modal
      visible={showDeleteModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDeleteModal(false)}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.modalContent,
              ]}
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
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  ), [showDeleteModal, handleDeleteAddress]);

  const renderContent = useMemo(() => () => {
    // Don't render content until initial animation is complete
    if (initialLoad && !hasAnimatedIn) {
      return null;
    }
    
    return (
      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: contentOpacity,
          }
        ]}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
        >
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 24 }
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#FF6B35']}
                tintColor="#FF6B35"
                progressBackgroundColor="#FFF"
                progressViewOffset={Platform.OS === 'ios' ? 64 : 0}
              />
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            bounces={true}
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
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search for addresses.."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
                selectionColor="#FF6B35"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close-circle" size={20} color="#888" />
                </TouchableOpacity>
              )}
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
              <Animated.View 
                style={[
                  styles.emptyState,
                ]}
              >
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
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    );
  }, [searchQuery, isSearchFocused, filteredAddresses, refreshing, keyboardHeight, insets, initialLoad, hasAnimatedIn, contentOpacity, searchBarAnim, onRefresh, handleSearchFocus, handleSearchBlur, handleAddNewAddress, renderAddressCard]);

  // Main render - simplified to prevent flickering
  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFF" 
        animated={true}
      />
      
      {/* Header - always visible */}
      <Animated.View style={{ opacity: headerOpacity }}>
        <LinearGradient
          colors={['#FFFFFF', '#F8F9FA']}
          style={[styles.header, { paddingTop: insets.top }]}
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
      </Animated.View>

      {/* Content - rendered based on state */}
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
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: Platform.OS === 'ios' ? 44 : 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
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
    backgroundColor: 'transparent',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: Platform.OS === 'ios' ? 17 : 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  addLocationButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#FFF',
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
    paddingTop: 8,
    backgroundColor: '#F8F9FA',
    minHeight: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
    paddingVertical: Platform.OS === 'ios' ? 0 : 4,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  addButton: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    fontSize: 17,
    fontWeight: '700',
  },
  addButtonArrow: {
    opacity: 0.9,
  },
  addressCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  addressCardTouchable: {
    marginBottom: 16,
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
  addressIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 2,
  },
  addressName: {
    fontSize: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  selectedTag: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 56,
    paddingRight: 10,
  },
  cardActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  actionButtons: {
    flexDirection: 'row',
    flex: 1,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  selectButton: {
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 90,
  },
  selectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  selectedButton: {
    shadowColor: '#4CAF50',
  },
  selectButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  selectButtonIcon: {
    marginLeft: 4,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 20,
    marginHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
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
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
});

export default AddressScreen;