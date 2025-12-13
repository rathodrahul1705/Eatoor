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
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  // Configuration
  const isSelectionMode = route?.params?.selectionMode ?? true;
  const onAddressSelect = route?.params?.onAddressSelect;
  const navigateToCart = route?.params?.navigateToCart ?? false;
  
  // Platform detection
  const isIOS = Platform.OS === 'ios';
  
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
  
  // Keyboard listeners
  useEffect(() => {
    if (!isIOS) return;
    
    const showSubscription = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isIOS]);
  
  // Optimized fetch function
  const fetchAddresses = useCallback(async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }
      setError(null);
      
      const response = await getAddressList();
      const formattedAddresses = formatAddresses(response.data);
      
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
  
  // Initial load
  useEffect(() => {
    fetchAddresses();
  }, []);
  
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
    if (address.isDefault) return '#fff';
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
    
    if (navigateToCart) {
      navigation.navigate('CartScreen');
    } else {
      setTimeout(() => navigation.goBack(), 150);
    }
  }, [isSelectionMode, onAddressSelect, navigateToCart, navigation, storeAddressToStorage]);

  // Memoized filtered addresses
  const filteredAddresses = useMemo(() => {
    return savedAddresses.filter(addr => 
      addr.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      addr.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [savedAddresses, searchQuery]);

  // Handle back press
  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  // Component rendering
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
        onPress={() => fetchAddresses()}
        activeOpacity={0.8}
      >
        <View style={styles.gradientButton}>
          <Icon name="refresh" size={20} color="#FFF" style={styles.retryIcon} />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderAddressCard = (address: Address, index: number) => (
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
          <View style={[
            styles.addressIconContainer,
            address.isDefault && styles.defaultAddressIconContainer,
            isSelectionMode && selectedAddressId === address.id && styles.selectedAddressIconContainer
          ]}>
            <Icon 
              name={getIconName(address.type)} 
              size={20} 
              color={getIconColor(address)} 
            />
          </View>
          
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
            <View style={[
              styles.selectButtonContent,
              selectedAddressId === address.id ? styles.selectedButtonContent : styles.defaultButtonContent
            ]}>
              <Text style={styles.selectButtonText}>
                {selectedAddressId === address.id ? 'Selected' : 'Select'}
              </Text>
              {selectedAddressId === address.id && (
                <Icon name="checkmark" size={16} color="#FFF" style={styles.selectButtonIcon} />
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  const renderDeleteModal = () => (
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
            <View style={styles.modalContent}>
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
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );

  const renderContent = () => {
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
          behavior={isIOS ? 'padding' : 'height'}
          keyboardVerticalOffset={isIOS ? (insets.top + 44) : 0}
        >
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              { 
                paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 
                  (isIOS ? 34 : 24)
              }
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#FF6B35']}
                tintColor="#FF6B35"
                progressBackgroundColor="#FFF"
                progressViewOffset={isIOS ? (insets.top + 44) : 0}
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
              <View style={styles.addButtonContent}>
                <View style={styles.addButtonIconContainer}>
                  <Icon name="add" size={22} color="#FFF" />
                </View>
                <Text style={styles.addButtonText}>Add New Address</Text>
                <Icon name="chevron-forward" size={20} color="#FFF" style={styles.addButtonArrow} />
              </View>
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
                    <View style={styles.emptyStateButtonContent}>
                      <Icon name="add" size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.emptyStateButtonText}>Add Your First Address</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    );
  };

  // Main render
  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFF"
        animated={true}
      />
      
      {/* Header - Fixed iOS spacing */}
      <View style={[styles.header, { height: isIOS ? 44 : 56 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Icon name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isSelectionMode ? 'Select Address' : 'My Addresses'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.addLocationButton}
            onPress={handleAddNewAddress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Icon name="add-circle" size={32} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? renderLoading() : error ? renderError() : renderContent()}
      {renderDeleteModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  addLocationButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
    backgroundColor: '#FF6B35',
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
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 34,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingVertical: 0,
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
    backgroundColor: '#FF6B35',
    overflow: 'hidden',
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
    flex: 1,
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
    backgroundColor: '#F8F9FA',
  },
  defaultAddressIconContainer: {
    backgroundColor: '#FF6B35',
  },
  selectedAddressIconContainer: {
    backgroundColor: '#4CAF50',
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
    borderTopWidth: 0.5,
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
  selectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  defaultButtonContent: {
    backgroundColor: '#FF6B35',
  },
  selectedButtonContent: {
    backgroundColor: '#4CAF50',
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
  emptyStateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
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