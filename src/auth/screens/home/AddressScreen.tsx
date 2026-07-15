import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useContext,
} from 'react';
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
  Modal,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Address, AddressType, MapLocationPickerParams } from '../../../types/addressTypes';
import { getAddressList, updateUserStatusAddress, deleteUserAddress } from '../../../api/address';
import { AuthContext } from '../../../context/AuthContext';
import { saveAddressDetails } from '../home/utils/addressStorage';
import { useLocation, isLocationServiceable } from '../../screens/home/utils/useLocation'; // adjust path

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ================ TYPES ================
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

interface RouteParams {
  onAddressSelect?: (address: Address) => void;
  selectionMode?: boolean;
  navigateToCart?: boolean;
  prevLocation?: any;
}

// ================ CONSTANTS ================
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PRIMARY = '#FF6B35';
const PRIMARY_LIGHT = '#FF8A5C';
const PRIMARY_DARK = '#E55A2B';
const SUCCESS = '#4CAF50';
const DANGER = '#FF6B6B';
const GREY_100 = '#F8F9FA';
const GREY_200 = '#F0F0F0';
const GREY_300 = '#E0E0E0';
const GREY_600 = '#666';
const GREY_800 = '#333';
const WHITE = '#FFFFFF';
const SHADOW_COLOR = 'rgba(0,0,0,0.06)';

// ================ ADDRESS CARD COMPONENT ================
interface AddressCardProps {
  address: Address;
  isSelectionMode: boolean;
  selectedAddressId: string | null;
  isGuest: boolean;
  onSelect: (address: Address) => void;
  onSetDefault: (id: string) => void;
  onEdit: (address: Address) => void;
  onDelete: (id: string) => void;
  onGuestLogin: () => void;
  fadeAnim: Animated.Value;
}

const AddressCard = React.memo(({
  address,
  isSelectionMode,
  selectedAddressId,
  isGuest,
  onSelect,
  onSetDefault,
  onEdit,
  onDelete,
  onGuestLogin,
  fadeAnim,
}: AddressCardProps) => {
  const getIconName = (type: AddressType): string => {
    switch (type) {
      case 'home': return 'home';
      case 'work': return 'briefcase';
      default: return 'location';
    }
  };

  const getIconColor = (addr: Address): string => {
    if (addr.isDefault) return WHITE;
    if (isSelectionMode && selectedAddressId === addr.id) return SUCCESS;
    return GREY_600;
  };

  const isSelected = isSelectionMode && selectedAddressId === address.id;

  return (
    <Animated.View
      style={[
        styles.addressCard,
        address.isDefault && styles.defaultAddressCard,
        isSelected && styles.selectedAddressCard,
        { opacity: fadeAnim },
      ]}
    >
      <TouchableOpacity
        onPress={() => onSelect(address)}
        activeOpacity={0.7}
        style={styles.addressCardTouchable}
      >
        <View style={styles.addressHeader}>
          <View
            style={[
              styles.addressIconContainer,
              address.isDefault && styles.defaultAddressIconContainer,
              isSelected && styles.selectedAddressIconContainer,
            ]}
          >
            <Icon name={getIconName(address.type)} size={16} color={getIconColor(address)} />
          </View>

          <View style={styles.addressTitleContainer}>
            <Text style={styles.addressName} numberOfLines={1}>
              {address.name}
            </Text>
            <View style={styles.tagContainer}>
              {address.isDefault && (
                <View style={styles.defaultTag}>
                  <Icon name="star" size={8} color={WHITE} />
                  <Text style={styles.defaultTagText}>Default</Text>
                </View>
              )}
              {isSelected && !address.isDefault && (
                <View style={styles.selectedTag}>
                  <Icon name="checkmark" size={8} color={WHITE} />
                  <Text style={styles.selectedTagText}>Selected</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text style={styles.addressText} numberOfLines={2}>
          {address.address}
        </Text>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <View style={styles.actionButtons}>
          {!address.isDefault && !isGuest && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onSetDefault(address.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="star-outline" size={18} color="#FFB74D" />
            </TouchableOpacity>
          )}

          {!isGuest && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onEdit(address)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="create-outline" size={18} color="#2196F3" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDelete(address.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="trash-outline" size={18} color={DANGER} />
              </TouchableOpacity>
            </>
          )}

          {isGuest && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onGuestLogin}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="log-in-outline" size={18} color={PRIMARY} />
            </TouchableOpacity>
          )}
        </View>

        {isSelectionMode && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => onSelect(address)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.selectButtonContent,
                isSelected ? styles.selectedButtonContent : styles.defaultButtonContent,
              ]}
            >
              <Text style={styles.selectButtonText}>
                {isSelected ? '✓' : 'Select'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
});

// ================ MAIN COMPONENT ================
const AddressScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isGuest } = useContext(AuthContext);

  const route = useRoute();
  const routeParams = (route.params as RouteParams) || {};
  const isSelectionMode = routeParams.selectionMode ?? true;
  const onAddressSelect = routeParams.onAddressSelect;
  const navigateToCart = routeParams.navigateToCart ?? false;
  const prevLocation = routeParams.prevLocation;

  // ========== STATE ==========
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

  // State to control auto‑selection after tapping "Current Location"
  const [shouldSelectCurrentLocation, setShouldSelectCurrentLocation] = useState(false);

  // ========== USE LOCATION HOOK ==========
  const {
    location,
    isServiceAvailable,
    refreshLocation,
    fetchCurrentLocationForce, // NEW: force GPS fetch
  } = useLocation(isGuest);

  // ========== REFS ==========
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const isMountedRef = useRef(true);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ========== ANIMATIONS ==========
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // ========== PLATFORM ==========
  const isIOS = Platform.OS === 'ios';

  // ========== LIFECYCLE ==========
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  // Keyboard listeners (iOS only)
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

  // ========== HELPERS ==========
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

  const formatAddresses = useCallback(
    (apiAddresses: ApiAddress[]): Address[] => {
      return apiAddresses.map((apiAddress) => ({
        id: apiAddress.id.toString(),
        type: (() => {
          switch (apiAddress.home_type.toLowerCase()) {
            case 'home':
              return 'home' as AddressType;
            case 'work':
            case 'office':
              return 'work' as AddressType;
            default:
              return 'other' as AddressType;
          }
        })(),
        name: `${apiAddress.home_type.charAt(0).toUpperCase() + apiAddress.home_type.slice(1)}`,
        address: formatFullAddress(apiAddress),
        isDefault: apiAddress.is_default,
        latitude: apiAddress.latitude || 0,
        longitude: apiAddress.longitude || 0,
        rawAddress: apiAddress,
      }));
    },
    [formatFullAddress]
  );

  const handleGuestNavigation = useCallback(() => {
    navigation.navigate('LoginScreen', {
      screen: 'LoginScreen',
      params: { returnTo: 'Address' },
    });
  }, [navigation]);

  const runInitialAnimation = useCallback(() => {
    if (isMountedRef.current && initialLoad) {
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
            if (isMountedRef.current) setHasAnimatedIn(true);
          });
        }
      }, 50);
    }
  }, [initialLoad, fadeAnim, contentOpacity]);

  // ========== FETCH ADDRESSES ==========
  const fetchAddresses = useCallback(
    async (isRefreshing = false) => {
      try {
        if (isGuest) {
          requestAnimationFrame(() => {
            if (!isMountedRef.current) return;
            setSavedAddresses([]);
            setError(null);
            runInitialAnimation();
          });
          if (!isRefreshing) setLoading(false);
          return;
        }

        if (!isRefreshing) setLoading(true);
        setError(null);

        const response = await getAddressList();
        const formattedAddresses = formatAddresses(response.data);

        requestAnimationFrame(() => {
          if (!isMountedRef.current) return;
          setSavedAddresses(formattedAddresses);

          const defaultAddress = formattedAddresses.find((addr) => addr.isDefault);
          if (defaultAddress && isSelectionMode) {
            setSelectedAddressId(defaultAddress.id);
          }

          runInitialAnimation();
        });
      } catch (err) {
        console.error('Failed to fetch addresses:', err);
        setError('Failed to load addresses. Please check your connection and try again.');
      } finally {
        if (!isRefreshing) setLoading(false);
      }
    },
    [isGuest, isSelectionMode, formatAddresses, runInitialAnimation]
  );

  // Initial load
  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  // Refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAddresses(true);
    setRefreshing(false);
  }, [fetchAddresses]);

  // ========== AUTO‑SELECT CURRENT LOCATION ==========
  // When the user taps the "Current Location" card, we call fetchCurrentLocationForce()
  const handleCurrentLocationPress = useCallback(() => {
    if (isGuest) {
      handleGuestNavigation();
      return;
    }
    // Always fetch fresh location, then auto-select when available
    setShouldSelectCurrentLocation(true);
    fetchCurrentLocationForce(); // NEW: force GPS fetch
  }, [isGuest, fetchCurrentLocationForce, handleGuestNavigation]);

  // Build an Address object from the hook's location data.
  const buildAddressFromLocation = useCallback((): Address | null => {
    if (!location.coords || !location.address) return null;
    return {
      id: location.addressId || 'current-location',
      type: (() => {
        switch (location.homeType.toLowerCase()) {
          case 'home': return 'home' as AddressType;
          case 'work': return 'work' as AddressType;
          default: return 'other' as AddressType;
        }
      })(),
      name: location.homeType.charAt(0).toUpperCase() + location.homeType.slice(1),
      address: location.address,
      isDefault: false,
      latitude: location.coords.lat,
      longitude: location.coords.lng,
      rawAddress: {
        id: location.addressId ? parseInt(location.addressId) : 0,
        full_address: location.address,
        street_address: location.address.split(',')[0] || '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        near_by_landmark: '',
        home_type: location.homeType,
        latitude: location.coords.lat,
        longitude: location.coords.lng,
        is_default: false,
      },
    };
  }, [location]);

  const selectCurrentLocation = useCallback(() => {
    const addressObj = buildAddressFromLocation();
    if (!addressObj) return;

    // Save the address details (the hook already saved it, but we save again to be safe)
    saveAddressDetails({
      id: addressObj.id,
      full_address: addressObj.address,
      home_type: addressObj.rawAddress.home_type,
      latitude: addressObj.latitude.toString(),
      longitude: addressObj.longitude.toString(),
    });

    if (onAddressSelect) {
      onAddressSelect(addressObj);
    }

    if (navigateToCart) {
      navigation.navigate('CartScreen');
    } else {
      setTimeout(() => navigation.goBack(), 150);
    }
  }, [buildAddressFromLocation, onAddressSelect, navigateToCart, navigation]);

  // Effect to handle auto‑selection after location fetch
  useEffect(() => {
    if (!shouldSelectCurrentLocation) return;
    if (location.loading) return; // still fetching

    if (location.coords && isServiceAvailable) {
      // Location is ready and serviceable → select it
      setShouldSelectCurrentLocation(false);
      selectCurrentLocation();
    } else if (!location.loading && location.coords && isServiceAvailable === false) {
      // Location is not serviceable – show alert and allow manual selection
      setShouldSelectCurrentLocation(false);
      Alert.alert(
        'Location Not Serviceable',
        'We are currently not delivering to this location. Please select a different address from the list or add a new one.',
        [{ text: 'OK' }]
      );
    } else if (!location.loading && !location.coords && location.error) {
      // Location fetch failed
      setShouldSelectCurrentLocation(false);
      Alert.alert('Error', 'Unable to fetch your location. Please try again later.');
    }
  }, [shouldSelectCurrentLocation, location, isServiceAvailable, selectCurrentLocation]);

  // ========== FILTERED ADDRESSES ==========
  const filteredAddresses = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return savedAddresses.filter(
      (addr) =>
        addr.name.toLowerCase().includes(query) ||
        addr.address.toLowerCase().includes(query)
    );
  }, [savedAddresses, searchQuery]);

  // ========== EVENT HANDLERS ==========
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    Animated.spring(searchBarAnim, {
      toValue: 1.02,
      tension: 150,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [searchBarAnim]);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    Animated.spring(searchBarAnim, {
      toValue: 1,
      tension: 150,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [searchBarAnim]);

  const handleMapNavigation = useCallback(() => {
    if (isGuest) {
      handleGuestNavigation();
      return;
    }

    const params: MapLocationPickerParams = {
      prevLocation,
      isGuest,
      onLocationConfirmed: (newAddress: Address) => {
        LayoutAnimation.configureNext({
          duration: 300,
          create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.easeInEaseOut },
        });

        setSavedAddresses((prev) => [...prev, newAddress]);
        if (newAddress.isDefault) {
          setSelectedAddressId(newAddress.id);
        }

        if (onAddressSelect) {
          onAddressSelect(newAddress);
        }

        if (navigateToCart) {
          navigation.navigate('CartScreen');
        } else {
          setTimeout(() => navigation.goBack(), 150);
        }
      },
    };
    navigation.navigate('MapLocationPicker', params);
  }, [isGuest, prevLocation, onAddressSelect, navigateToCart, navigation, handleGuestNavigation]);

  const handleEditAddress = useCallback(
    (address: Address) => {
      if (isGuest) {
        handleGuestNavigation();
        return;
      }

      const params: MapLocationPickerParams = {
        addressToEdit: address,
        prevLocation,
        onLocationConfirmed: (updatedAddress: Address) => {
          LayoutAnimation.configureNext({
            duration: 300,
            update: { type: LayoutAnimation.Types.easeInEaseOut },
          });

          setSavedAddresses((prev) =>
            prev.map((addr) => (addr.id === updatedAddress.id ? updatedAddress : addr))
          );
          if (updatedAddress.isDefault) {
            setSelectedAddressId(updatedAddress.id);
          }
        },
      };
      navigation.navigate('MapLocationPicker', params);
    },
    [isGuest, prevLocation, navigation, handleGuestNavigation]
  );

  const confirmDeleteAddress = useCallback(
    (id: string) => {
      if (isGuest) {
        handleGuestNavigation();
        return;
      }
      setAddressToDelete(id);
      setShowDeleteModal(true);
    },
    [isGuest, handleGuestNavigation]
  );

  const handleDeleteAddress = useCallback(async () => {
    if (!addressToDelete || isGuest) return;

    try {
      await deleteUserAddress(addressToDelete);

      LayoutAnimation.configureNext({
        duration: 300,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

      setSavedAddresses((prev) => prev.filter((addr) => addr.id !== addressToDelete));
      if (selectedAddressId === addressToDelete) {
        setSelectedAddressId(null);
      }
      setShowDeleteModal(false);
      setAddressToDelete(null);
    } catch (error) {
      console.error('Failed to delete address:', error);
      Alert.alert('Error', 'Failed to delete address. Please try again.');
    }
  }, [addressToDelete, selectedAddressId, isGuest]);

  const setAsDefaultAddress = useCallback(
    async (id: string) => {
      if (isGuest) {
        handleGuestNavigation();
        return;
      }

      try {
        await updateUserStatusAddress(id, { is_default: true });

        LayoutAnimation.configureNext({
          duration: 300,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
        });

        setSavedAddresses((prev) =>
          prev.map((addr) => ({
            ...addr,
            isDefault: addr.id === id,
          }))
        );
        setSelectedAddressId(id);
      } catch (error) {
        console.error('Failed to update default address:', error);
        Alert.alert('Error', 'Failed to update default address. Please try again.');
      }
    },
    [isGuest, handleGuestNavigation]
  );

  const handleAddressSelect = useCallback(
    async (address: Address) => {
      if (!isSelectionMode) return;

      if (isGuest) {
        handleGuestNavigation();
        return;
      }

      LayoutAnimation.configureNext({
        duration: 200,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });

      setSelectedAddressId(address.id);

      // Save the address (the parent will also save, but we do it here to be safe)
      await saveAddressDetails({
        id: address.id,
        full_address: address.rawAddress.full_address,
        home_type: address.rawAddress.home_type,
        latitude: address.rawAddress.latitude?.toString() || '',
        longitude: address.rawAddress.longitude?.toString() || '',
      });

      if (onAddressSelect) {
        onAddressSelect(address);
      }

      if (navigateToCart) {
        navigation.navigate('CartScreen');
      } else {
        setTimeout(() => navigation.goBack(), 150);
      }
    },
    [isSelectionMode, isGuest, handleGuestNavigation, onAddressSelect, navigateToCart, navigation]
  );

  const handleBackPress = useCallback(() => {
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home');
  }, [navigation]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }, []);

  // ========== RENDER FUNCTIONS ==========
  const renderLoading = useCallback(
    () => (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading your addresses...</Text>
        <Text style={styles.loadingSubText}>Please wait a moment</Text>
      </View>
    ),
    []
  );

  const renderError = useCallback(
    () => (
      <View style={styles.errorContainer}>
        <Icon name="warning-outline" size={48} color={DANGER} style={styles.errorIcon} />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchAddresses()}
          activeOpacity={0.8}
        >
          <View style={styles.gradientButton}>
            <Icon name="refresh" size={18} color={WHITE} style={styles.retryIcon} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </View>
        </TouchableOpacity>
      </View>
    ),
    [error, fetchAddresses]
  );

  const renderGuestEmptyState = useCallback(
    () => (
      <View style={styles.guestContainer}>
        <View style={styles.guestIconContainer}>
          <Icon name="person-outline" size={60} color={GREY_300} />
          <View style={styles.guestBadge}>
            <Text style={styles.guestBadgeText}>GUEST</Text>
          </View>
        </View>
        <Text style={styles.guestTitle}>Guest Mode</Text>
        <Text style={styles.guestText}>
          You're currently browsing as a guest. Sign in to save and manage your delivery addresses.
        </Text>
        <TouchableOpacity
          style={styles.guestPrimaryButton}
          onPress={handleGuestNavigation}
          activeOpacity={0.8}
        >
          <Icon name="log-in" size={18} color={WHITE} style={styles.guestButtonIcon} />
          <Text style={styles.guestButtonPrimaryText}>Sign In to Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestSecondaryButton}
          onPress={handleGuestNavigation}
          activeOpacity={0.7}
        >
          <Icon name="navigate" size={16} color={PRIMARY} style={{ marginRight: 8 }} />
          <Text style={styles.guestSecondaryButtonText}>Select Delivery Location</Text>
        </TouchableOpacity>
      </View>
    ),
    [handleGuestNavigation]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Icon
          name={searchQuery ? 'search-outline' : 'map-outline'}
          size={60}
          color={GREY_300}
        />
        <Text style={styles.emptyStateTitle}>
          {searchQuery ? 'No addresses found' : 'No saved addresses yet'}
        </Text>
        <Text style={styles.emptyStateText}>
          {searchQuery
            ? 'Try searching with different keywords'
            : isGuest
            ? 'Sign in to save and manage your delivery addresses'
            : 'Add your first address to get started with deliveries'}
        </Text>
        {!searchQuery && (
          <TouchableOpacity
            style={[styles.emptyStateButton, isGuest && { backgroundColor: PRIMARY }]}
            onPress={() => {
              if (isGuest) {
                handleGuestNavigation();
              } else {
                handleMapNavigation();
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.emptyStateButtonContent}>
              <Icon name={isGuest ? 'log-in' : 'add'} size={16} color={WHITE} style={{ marginRight: 6 }} />
              <Text style={styles.emptyStateButtonText}>
                {isGuest ? 'Sign In to Continue' : 'Add Your First Address'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    ),
    [searchQuery, isGuest, handleGuestNavigation, handleMapNavigation]
  );

  // ---- Current Location Card (using the hook) ----
  const renderCurrentLocation = useCallback(
    () => (
      <TouchableOpacity
        style={styles.currentLocationCard}
        onPress={handleCurrentLocationPress}
        activeOpacity={0.7}
        disabled={location.loading}
      >
        <View style={styles.currentLocationContent}>
          <View style={styles.currentLocationIconContainer}>
            <Icon
              name={location.coords ? 'navigate-circle' : 'location-outline'}
              size={20}
              color={WHITE}
            />
          </View>

          <View style={styles.currentLocationTextContainer}>
            <Text style={styles.currentLocationTitle}>Current Location</Text>
            <Text style={styles.currentLocationSubtitle}>Click to fetch current location</Text>
          </View>

          <View style={styles.currentLocationAction}>
            {location.loading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : location.coords ? (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  fetchCurrentLocationForce(); // NEW: refresh with force
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="refresh-outline" size={20} color={PRIMARY} />
              </TouchableOpacity>
            ) : (
              <Icon name="chevron-forward" size={18} color={GREY_300} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    ),
    [location, handleCurrentLocationPress, fetchCurrentLocationForce] // added fetchCurrentLocationForce
  );

  // ---- Add Address Card ----
  const renderAddAddress = useCallback(
    () => (
      <TouchableOpacity
        style={styles.addAddressCard}
        onPress={() => {
          if (isGuest) {
            handleGuestNavigation();
          } else {
            handleMapNavigation();
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.addAddressContent}>
          <View style={styles.addAddressIconContainer}>
            <Icon name="add" size={20} color={WHITE} />
          </View>
          <View style={styles.addAddressTextContainer}>
            <Text style={styles.addAddressTitle}>Add New Address</Text>
            <Text style={styles.addAddressSubtitle}>Save a new delivery location</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={GREY_300} style={styles.addAddressArrow} />
        </View>
      </TouchableOpacity>
    ),
    [isGuest, handleGuestNavigation, handleMapNavigation]
  );

  // ---- Search Bar ----
  const renderSearchBar = useCallback(
    () => (
      <Animated.View
        style={[styles.searchContainer, { transform: [{ scale: searchBarAnim }] }]}
      >
        <Icon
          name="search"
          size={18}
          color={isSearchFocused ? PRIMARY : '#888'}
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
          selectionColor={PRIMARY}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={clearSearch}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close-circle" size={18} color="#888" />
          </TouchableOpacity>
        )}
      </Animated.View>
    ),
    [searchBarAnim, isSearchFocused, searchQuery, handleSearchFocus, handleSearchBlur, clearSearch]
  );

  const renderDeleteModal = useCallback(
    () => (
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
                    <Icon name="warning" size={28} color={DANGER} />
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
                    <Icon name="trash" size={16} color={WHITE} />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    ),
    [showDeleteModal, handleDeleteAddress]
  );

  // ========== MAIN CONTENT ==========
  const renderContent = useCallback(() => {
    if (initialLoad && !hasAnimatedIn) return null;

    // Guest with no addresses → show only the guest empty state
    if (isGuest && filteredAddresses.length === 0) {
      return (
        <Animated.View style={[styles.contentContainer, { opacity: contentOpacity }]}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={isIOS ? 'padding' : 'height'}
            keyboardVerticalOffset={isIOS ? insets.top + 44 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingBottom:
                    keyboardHeight > 0 ? keyboardHeight + 20 : isIOS ? 34 : 24,
                },
              ]}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[PRIMARY]}
                  tintColor={PRIMARY}
                  progressBackgroundColor={WHITE}
                  progressViewOffset={isIOS ? insets.top + 44 : 0}
                />
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              scrollEventThrottle={16}
              bounces
            >
              {renderGuestEmptyState()}
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      );
    }

    // Main list for logged‑in users (or guests with addresses – unlikely)
    return (
      <Animated.View style={[styles.contentContainer, { opacity: contentOpacity }]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={isIOS ? 'padding' : 'height'}
          keyboardVerticalOffset={isIOS ? insets.top + 44 : 0}
        >
          <FlatList
            data={filteredAddresses}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <>
                {/* Show Current Location card only for logged-in users */}
                {!isGuest && renderCurrentLocation()}
                {!isGuest && renderAddAddress()}
                {renderSearchBar()}
              </>
            }
            ListEmptyComponent={renderEmptyState}
            renderItem={({ item }) => (
              <AddressCard
                address={item}
                isSelectionMode={isSelectionMode}
                selectedAddressId={selectedAddressId}
                isGuest={isGuest}
                onSelect={handleAddressSelect}
                onSetDefault={setAsDefaultAddress}
                onEdit={handleEditAddress}
                onDelete={confirmDeleteAddress}
                onGuestLogin={handleGuestNavigation}
                fadeAnim={fadeAnim}
              />
            )}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom:
                  keyboardHeight > 0 ? keyboardHeight + 20 : isIOS ? 34 : 24,
              },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[PRIMARY]}
                tintColor={PRIMARY}
                progressBackgroundColor={WHITE}
                progressViewOffset={isIOS ? insets.top + 44 : 0}
              />
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            bounces
          />
        </KeyboardAvoidingView>
      </Animated.View>
    );
  }, [
    initialLoad,
    hasAnimatedIn,
    isGuest,
    filteredAddresses,
    contentOpacity,
    isIOS,
    insets.top,
    keyboardHeight,
    refreshing,
    onRefresh,
    renderCurrentLocation,
    renderAddAddress,
    renderSearchBar,
    renderEmptyState,
    renderGuestEmptyState,
    isSelectionMode,
    selectedAddressId,
    handleAddressSelect,
    setAsDefaultAddress,
    handleEditAddress,
    confirmDeleteAddress,
    handleGuestNavigation,
    fadeAnim,
  ]);

  // ========== RENDER ==========
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      <View style={[styles.header, { height: isIOS ? 44 : 56 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Icon name="chevron-back" size={24} color={GREY_800} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isSelectionMode ? 'Select a Location' : 'My Addresses'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addLocationButton}
            onPress={() => {
              if (isGuest) {
                handleGuestNavigation();
              } else {
                handleMapNavigation();
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Icon name={isGuest ? 'log-in' : 'add-circle'} size={28} color={PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? renderLoading() : error ? renderError() : renderContent()}
      {renderDeleteModal()}
    </SafeAreaView>
  );
};

// ================ STYLES ================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: WHITE,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: GREY_200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: GREY_800,
    textAlign: 'center',
  },
  addLocationButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GREY_100,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: GREY_800,
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 6,
    fontSize: 13,
    color: '#888',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: GREY_100,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: GREY_800,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: GREY_600,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    fontWeight: '500',
  },
  retryButton: {
    width: '80%',
    maxWidth: 180,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: PRIMARY,
  },
  retryIcon: {
    marginRight: 6,
  },
  retryButtonText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 15,
  },
  guestContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 12,
    marginHorizontal: 16,
  },
  guestIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  guestBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  guestBadgeText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '700',
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GREY_800,
    marginBottom: 8,
    textAlign: 'center',
  },
  guestText: {
    fontSize: 14,
    color: GREY_600,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontWeight: '500',
  },
  guestPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    width: '100%',
    marginBottom: 10,
  },
  guestSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PRIMARY,
    width: '100%',
  },
  guestButtonIcon: {
    marginRight: 6,
  },
  guestButtonPrimaryText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 15,
  },
  guestSecondaryButtonText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 13,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: GREY_100,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  // ---- Current Location Card (compact) ----
  currentLocationCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: GREY_200,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW_COLOR,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  currentLocationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentLocationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  currentLocationTextContainer: {
    flex: 1,
  },
  currentLocationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: GREY_800,
  },
  currentLocationSubtitle: {
    fontSize: 10,
    color: GREY_600,
    marginTop: 1,
  },
  currentLocationAction: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ---- Add Address Card (compact) ----
  addAddressCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: GREY_200,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW_COLOR,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  addAddressContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addAddressIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  addAddressTextContainer: {
    flex: 1,
  },
  addAddressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: GREY_800,
  },
  addAddressSubtitle: {
    fontSize: 12,
    color: GREY_600,
    marginTop: 1,
  },
  addAddressArrow: {
    marginLeft: 6,
  },
  // ---- Search Bar (compact) ----
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: GREY_200,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: GREY_800,
    fontWeight: '500',
    padding: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    padding: 2,
    marginLeft: 6,
  },
  // ---- Address Cards (compact) ----
  addressCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GREY_200,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW_COLOR,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  addressCardTouchable: {
    marginBottom: 10,
  },
  defaultAddressCard: {
    borderColor: PRIMARY,
    backgroundColor: '#FFF9F0',
  },
  selectedAddressCard: {
    borderColor: SUCCESS,
    backgroundColor: '#F8FFF8',
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  addressIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: GREY_100,
  },
  defaultAddressIconContainer: {
    backgroundColor: PRIMARY,
  },
  selectedAddressIconContainer: {
    backgroundColor: SUCCESS,
  },
  addressTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  addressName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 6,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  defaultTag: {
    backgroundColor: PRIMARY,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultTagText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 3,
  },
  selectedTag: {
    backgroundColor: SUCCESS,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedTagText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 3,
  },
  addressText: {
    fontSize: 12,
    color: GREY_600,
    lineHeight: 16,
    marginLeft: 46,
    paddingRight: 6,
  },
  cardActions: {
    borderTopWidth: 0.5,
    borderTopColor: GREY_200,
    paddingTop: 8,
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
    padding: 4,
    marginRight: 10,
  },
  selectButton: {
    borderRadius: 6,
    overflow: 'hidden',
    minWidth: 60,
  },
  selectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  defaultButtonContent: {
    backgroundColor: PRIMARY,
  },
  selectedButtonContent: {
    backgroundColor: SUCCESS,
  },
  selectButtonText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 12,
  },
  // ---- Empty State ----
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 12,
    marginHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GREY_600,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
  },
  emptyStateButton: {
    width: '100%',
    maxWidth: 240,
  },
  emptyStateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  emptyStateButtonText: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 14,
  },
  // ---- Modal ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GREY_800,
    marginBottom: 4,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: GREY_600,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: GREY_100,
    borderWidth: 1,
    borderColor: GREY_300,
  },
  deleteButton: {
    backgroundColor: DANGER,
  },
  cancelButtonText: {
    color: GREY_600,
    fontWeight: '600',
    fontSize: 13,
  },
  deleteButtonText: {
    color: WHITE,
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
});

export default AddressScreen;