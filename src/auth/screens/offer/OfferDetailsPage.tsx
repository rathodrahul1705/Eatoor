import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  FlatList,
  Dimensions,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showMessage } from 'react-native-flash-message';
import { updateCart } from '../../../api/cart';
import { getOfferItems } from '../../../api/offer';
import { getSessionId } from '../../../utlis/utils';
import { AuthContext } from '../../../context/AuthContext';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// Storage Keys - Only past kitchen details
const STORAGE_KEYS = {
  PAST_KITCHEN_DETAILS: 'pastKitchenDetails',
  OFFER_SESSION_ID: 'offerSessionId',
};

// Placeholder constant for restaurant image
const PLACEHOLDER_RESTAURANT = 'https://via.placeholder.com/400x200?text=Restaurant';
const PLACEHOLDER_ITEM_IMAGE = 'https://via.placeholder.com/150x150?text=Food+Item';

interface CartItem {
  id: string;
  name: string;
  description: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  discountText: string;
  savings: number;
  image: string;
  rating: number;
  soldCount: string | number;
  isVeg: boolean;
  isBestseller: boolean;
  offerType: string;
  stockQuantity: number;
  availability: boolean;
  spiceLevel?: string;
  preparationTime?: number;
  servingSize?: string;
  restaurant?: string;
  restaurantId?: string;
  bogoEligible: boolean;
  hasDiscount: boolean;
  category?: string;
  startTime?: string;
  endTime?: string;
}

interface KitchenData {
  restaurant_name?: string;
  Address?: string;
  min_order?: number;
  restaurant_image?: string;
  restaurant_current_status?: {
    is_open: boolean;
  };
  id?: string;
}

interface PastKitchenDetails {
  id: string;
  name: string;
  image: string;
  itemCount: number;
  timestamp: number;
  address?: string;
  minOrder?: number;
  isOpen?: boolean;
}

// API Response Interface
interface APIItem {
  id: number;
  item_name: string;
  item_price: string;
  discount_percent: string | null;
  discount_active: number;
  description: string;
  category: string;
  item_image: string | null;
  spice_level: string;
  preparation_time: number;
  serving_size: string;
  availability: boolean;
  stock_quantity: number;
  food_type: string;
  buy_one_get_one_free: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
  restaurant: string;
  cuisines: number[];
}

interface APIResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  data: APIItem[];
}

const OfferDetailsPage = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [user, setUser] = useState(null);
  
  const { offerType = 'daily-deals', offer = null } = route.params || {};
  const offerTitle = offer?.title || route.params?.offerTitle || 'Special Offers';
  const offerSubtitle = offer?.subtitle || route.params?.offerSubtitle || 'Limited time deals';
  const offerCode = offer?.offerCode || '';
  const validTill = offer?.validTill || '';
  const offerImage = offer?.image || '';
  const backgroundColor = offer?.backgroundColor || '#E55C18';
  const category = offer?.category || '';
  const pastKitchenDetails = offer?.kitchenDetails || route.params?.kitchenDetails || null;
  
  // State variables
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerItems, setOfferItems] = useState<CartItem[]>([]);
  const [updatingItems, setUpdatingItems] = useState<Array<{id: string, action: string}>>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [kitchenData, setKitchenData] = useState<KitchenData | null>(pastKitchenDetails || null);
  const [pastKitchenDetailsState, setPastKitchenDetailsState] = useState<PastKitchenDetails | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Flag to prevent multiple navigations and updates
  const isNavigatingRef = useRef(false);
  const isUpdatingKitchenRef = useRef(false);
  const kitchenUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedKitchenRef = useRef<PastKitchenDetails | null>(null);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  // Get user ID
  const userId = useMemo(() => {
    return user?.id || null;
  }, [user]);

  // ==================== ASYNCSTORAGE FUNCTIONS ====================

  const savePastKitchenDetails = useCallback(async (details: PastKitchenDetails) => {
    // Prevent duplicate saves
    if (isUpdatingKitchenRef.current) {
      console.log('Kitchen update already in progress, skipping...');
      return false;
    }

    // Check if the same kitchen details are already saved
    if (lastSavedKitchenRef.current && 
        lastSavedKitchenRef.current.id === details.id && 
        lastSavedKitchenRef.current.itemCount === details.itemCount &&
        Math.abs(Date.now() - lastSavedKitchenRef.current.timestamp) < 5000) {
      console.log('Same kitchen details already saved recently, skipping...');
      return false;
    }

    try {
      isUpdatingKitchenRef.current = true;
      
      if (details && details.id) {
        console.log("Saving past kitchen details:", details.id, "Item count:", details.itemCount);
        await AsyncStorage.setItem(STORAGE_KEYS.PAST_KITCHEN_DETAILS, JSON.stringify(details));
        setPastKitchenDetailsState(details);
        lastSavedKitchenRef.current = details;
        console.log('Past kitchen details saved successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving past kitchen details:', error);
      return false;
    } finally {
      setTimeout(() => {
        isUpdatingKitchenRef.current = false;
      }, 500);
    }
  }, []);

  const clearPastKitchenDetails = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PAST_KITCHEN_DETAILS);
      setPastKitchenDetailsState(null);
      lastSavedKitchenRef.current = null;
      console.log('Past kitchen details cleared');
      return true;
    } catch (error) {
      console.error('Error clearing past kitchen details:', error);
      return false;
    }
  }, []);

  const fetchPastKitchenDetails = useCallback(async () => {
    try {
      const storedDetails = await AsyncStorage.getItem(STORAGE_KEYS.PAST_KITCHEN_DETAILS);
      if (storedDetails) {
        const details = JSON.parse(storedDetails);
        setPastKitchenDetailsState(details);
        lastSavedKitchenRef.current = details;
        console.log('Fetched past kitchen details:', details);
        return details;
      }
      return null;
    } catch (error) {
      console.error('Error fetching past kitchen details:', error);
      return null;
    }
  }, []);

  const saveSessionId = useCallback(async (session: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.OFFER_SESSION_ID, session);
      console.log('Session ID saved to storage');
    } catch (error) {
      console.error('Error saving session ID:', error);
    }
  }, []);

  const loadSessionId = useCallback(async () => {
    try {
      const storedSessionId = await AsyncStorage.getItem(STORAGE_KEYS.OFFER_SESSION_ID);
      if (storedSessionId) {
        console.log('Session ID loaded from storage');
        return storedSessionId;
      }
      return null;
    } catch (error) {
      console.error('Error loading session ID:', error);
      return null;
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (!user) {
          setUser?.(parsedUser);
        }
        return parsedUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, [user, setUser]);

  // ==================== SESSION AND INITIALIZATION ====================

  const initializeSession = useCallback(async () => {
    try {
      let session = await loadSessionId();
      
      if (!session) {
        session = await getSessionId();
        if (session) {
          await saveSessionId(session);
        }
      }
      
      const freshSession = await getSessionId();
      if (freshSession && freshSession !== session) {
        session = freshSession;
        await saveSessionId(session);
      }
      
      setSessionId(session);
      
      const userData = await fetchUserData();
      
      const savedKitchenDetails = await fetchPastKitchenDetails();
      if (savedKitchenDetails && !kitchenData) {
        setKitchenData(savedKitchenDetails);
      }
      
      return session;
    } catch (error) {
      console.error("Error initializing session:", error);
      const fallbackSession = await getSessionId();
      setSessionId(fallbackSession);
      await saveSessionId(fallbackSession);
      return fallbackSession;
    }
  }, [fetchUserData, loadSessionId, saveSessionId, fetchPastKitchenDetails, kitchenData]);

  // ==================== CART AND ITEM MANAGEMENT ====================

  const getCartItemsForNavigation = useCallback(() => {
    const items: any[] = [];
    
    Object.entries(quantities).forEach(([id, qty]) => {
      const item = offerItems.find(i => i.id === id);
      if (item && qty > 0) {
        items.push({
          id: item.id,
          name: item.name,
          price: item.discountedPrice,
          originalPrice: item.originalPrice,
          quantity: qty,
          image: item.image,
          isVeg: item.isVeg,
          savings: item.savings * qty,
          discountPercent: item.discountPercent,
          restaurantId: item.restaurantId,
          restaurantName: item.restaurant,
        });
      }
    });
    
    return items;
  }, [quantities, offerItems]);

  const getTotalPrice = useCallback(() => {
    let total = 0;
    Object.entries(quantities).forEach(([id, qty]) => {
      const item = offerItems.find(i => i.id === id);
      if (item && qty > 0) {
        total += item.discountedPrice * qty;
      }
    });
    return total;
  }, [quantities, offerItems]);

  const navigateToCart = useCallback((skipEmptyCheck: boolean = false) => {
    if (isNavigatingRef.current) {
      console.log('Navigation already in progress, skipping...');
      return false;
    }

    if (!sessionId) {
      showMessage({
        message: "Session error",
        description: "Please refresh the page",
        type: "danger",
      });
      return false;
    }

    const cartItemsList = getCartItemsForNavigation();
    
    if (!skipEmptyCheck && cartItemsList.length === 0) {
      console.log('Cart is empty, not navigating');
      return false;
    }

    isNavigatingRef.current = true;

    const uniqueRestaurants = [...new Map(cartItemsList.map(item => [item.restaurantId, {
      id: item.restaurantId,
      name: item.restaurantName
    }])).values()];

    const primaryRestaurant = uniqueRestaurants[0] || { 
      id: kitchenData?.id || '', 
      name: kitchenData?.restaurant_name || "Restaurant" 
    };
    
    const restaurantInfo = {
      restaurant_name: primaryRestaurant.name || kitchenData?.restaurant_name || "Restaurant",
      Address: kitchenData?.Address || "",
      min_order: kitchenData?.min_order || 0,
      restaurant_image: kitchenData?.restaurant_image || PLACEHOLDER_RESTAURANT,
      restaurant_current_status: { is_open: kitchenData?.restaurant_current_status?.is_open ?? true },
      id: primaryRestaurant.id,
    };

    navigation.navigate("CartScreen", {
      cartItems: cartItemsList,
      totalPrice: getTotalPrice(),
      pastkitcheId: primaryRestaurant.id,
      restaurant: {
        name: restaurantInfo.restaurant_name,
        address: restaurantInfo.Address,
        minOrder: restaurantInfo.min_order,
        coverImage: restaurantInfo.restaurant_image,
        isOpen: restaurantInfo.restaurant_current_status.is_open,
      },
      userId: userId,
      sessionId: sessionId,
      offerCode: offerCode,
      offerType: offerType,
      offerDetails: offer,
      fromOfferPage: true,
    });
    
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
    
    return true;
  }, [sessionId, navigation, kitchenData, getCartItemsForNavigation, getTotalPrice, userId, offerCode, offerType, offer]);

  const performCartUpdate = useCallback(async (
    itemId: string, 
    action: 'increment' | 'decrement', 
    itemRestaurantId: string, 
    itemRestaurantName: string,
    itemRestaurantImage?: string,
    itemRestaurantAddress?: string,
    itemRestaurantMinOrder?: number,
    isOpen?: boolean,
    shouldNavigateAfterAdd: boolean = true
  ) => {
    // Check if restaurant is open
    if (kitchenData?.restaurant_current_status?.is_open === false) {
      showMessage({
        message: "Restaurant closed",
        description: "This restaurant is currently closed",
        type: "danger",
      });
      return;
    }

    // Ensure session is initialized
    if (!sessionId) {
      console.log("No session ID, initializing...");
      await initializeSession();
      if (!sessionId) {
        showMessage({
          message: "Session error",
          description: "Please refresh the page",
          type: "danger",
        });
        return;
      }
    }

    setUpdatingItems(prev => [...prev, {id: itemId, action}]);
    
    const isAddingItem = action === 'increment';
    
    if (!itemRestaurantId) {
      showMessage({
        message: "Error",
        description: "Restaurant ID not available for this item",
        type: "danger",
      });
      setUpdatingItems(prev => prev.filter(item => item.id !== itemId));
      return;
    }
    
    try {
      const payload: any = {
        session_id: sessionId,
        restaurant_id: itemRestaurantId,
        user_id: userId,
        item_id: parseInt(itemId),
        source: 'ITEMLIST',
        action: action === 'increment' ? 'add' : 'remove'
      };
      
      if (userId) {
        payload.user_id = userId;
      }
      
      if (action === 'increment') {
        payload.quantity = 1;
      }

      console.log('Updating cart with payload:', payload);
      const response = await updateCart(payload);
      
      if (response.status === 200) {
        // Update local quantities state
        let newQuantities;
        setQuantities(prev => {
          newQuantities = { ...prev };
          const currentQty = prev[itemId] || 0;
          
          if (action === 'increment') {
            newQuantities[itemId] = currentQty + 1;
          } else if (action === 'decrement') {
            if (currentQty > 1) {
              newQuantities[itemId] = currentQty - 1;
            } else {
              delete newQuantities[itemId];
            }
          }
          
          return newQuantities;
        });
        
        // Update past kitchen details after cart update
        const totalItems = Object.values(newQuantities || {}).reduce((sum, qty) => sum + qty, 0);
        
        if (totalItems > 0) {
          const newPastKitchenDetails: PastKitchenDetails = {
            id: itemRestaurantId,
            name: itemRestaurantName || kitchenData?.restaurant_name || "Restaurant",
            image: itemRestaurantImage || kitchenData?.restaurant_image || PLACEHOLDER_RESTAURANT,
            itemCount: totalItems,
            timestamp: Date.now(),
            address: itemRestaurantAddress || kitchenData?.Address || "",
            minOrder: itemRestaurantMinOrder || kitchenData?.min_order || 0,
            isOpen: isOpen !== undefined ? isOpen : (kitchenData?.restaurant_current_status?.is_open ?? true),
          };
          
          await savePastKitchenDetails(newPastKitchenDetails);
          setKitchenData(newPastKitchenDetails);
        } else if (totalItems === 0) {
          await clearPastKitchenDetails();
          setKitchenData(null);
        }
        
        showMessage({
          message: action === 'increment' ? "Item added to cart" : "Item removed from cart",
          type: "success",
          duration: 1500,
        });
        
        if (isAddingItem && shouldNavigateAfterAdd) {
          // Small delay to ensure state updates are complete
          setTimeout(() => {
            navigateToCart(true);
          }, 300);
        }
      } else {
        showMessage({
          message: "Error",
          description: response.data?.message || "Failed to update cart. Please try again.",
          type: "danger",
        });
      }
    } catch (err: any) {
      console.error('Error updating cart:', err);
      
      // Handle session expiration
      if (err.response?.status === 401) {
        console.log("Session expired during cart update, reinitializing...");
        await initializeSession();
        
        // Retry the operation
        try {
          const currentUser = await fetchUserData();
          const payload: any = {
            session_id: sessionId,
            restaurant_id: itemRestaurantId,
            item_id: parseInt(itemId),
            source: 'ITEMLIST',
            action: action === 'increment' ? 'add' : 'remove'
          };
          
          if (currentUser?.id) {
            payload.user_id = currentUser.id;
          }
          
          if (action === 'increment') {
            payload.quantity = 1;
          }
          
          const retryResponse = await updateCart(payload);
          
          if (retryResponse.status === 200) {
            let newQuantities;
            setQuantities(prev => {
              newQuantities = { ...prev };
              const currentQty = prev[itemId] || 0;
              
              if (action === 'increment') {
                newQuantities[itemId] = currentQty + 1;
              } else if (action === 'decrement') {
                if (currentQty > 1) {
                  newQuantities[itemId] = currentQty - 1;
                } else {
                  delete newQuantities[itemId];
                }
              }
              
              return newQuantities;
            });
            
            // Update past kitchen details after retry
            const totalItems = Object.values(newQuantities || {}).reduce((sum, qty) => sum + qty, 0);
            
            if (totalItems > 0) {
              const newPastKitchenDetails: PastKitchenDetails = {
                id: itemRestaurantId,
                name: itemRestaurantName || kitchenData?.restaurant_name || "Restaurant",
                image: itemRestaurantImage || kitchenData?.restaurant_image || PLACEHOLDER_RESTAURANT,
                itemCount: totalItems,
                timestamp: Date.now(),
                address: itemRestaurantAddress || kitchenData?.Address || "",
                minOrder: itemRestaurantMinOrder || kitchenData?.min_order || 0,
                isOpen: isOpen !== undefined ? isOpen : (kitchenData?.restaurant_current_status?.is_open ?? true),
              };
              
              await savePastKitchenDetails(newPastKitchenDetails);
              setKitchenData(newPastKitchenDetails);
            } else if (totalItems === 0) {
              await clearPastKitchenDetails();
              setKitchenData(null);
            }
            
            showMessage({
              message: action === 'increment' ? "Item added to cart" : "Item removed from cart",
              type: "success",
              duration: 1500,
            });
            
            if (isAddingItem && shouldNavigateAfterAdd) {
              setTimeout(() => {
                navigateToCart(true);
              }, 300);
            }
          } else {
            showMessage({
              message: "Error",
              description: retryResponse.data?.message || "Failed to update cart. Please try again.",
              type: "danger",
            });
          }
        } catch (retryError) {
          console.error("Retry failed:", retryError);
          showMessage({
            message: `Failed to ${action} item`,
            description: "Please try again",
            type: "danger",
          });
        }
      } else {
        showMessage({
          message: "Error",
          description: err.response?.data?.message || "An error occurred while updating your cart",
          type: "danger",
        });
      }
    } finally {
      setUpdatingItems(prev => prev.filter(item => item.id !== itemId));
    }
  }, [sessionId, userId, kitchenData, savePastKitchenDetails, clearPastKitchenDetails, navigateToCart, initializeSession, fetchUserData]);

  const updateItemQuantity = useCallback(async (itemId: string, action: 'increment' | 'decrement') => {
    const item = offerItems.find(i => i.id === itemId);
    
    if (!item) {
      showMessage({
        message: "Error",
        description: "Item not found",
        type: "danger",
      });
      return;
    }

    const itemRestaurantId = item.restaurantId;
    const itemRestaurantName = item.restaurant || "";
    
    if (!itemRestaurantId) {
      showMessage({
        message: "Error",
        description: "Restaurant information not available for this item",
        type: "danger",
      });
      return;
    }

    const itemRestaurantImage = kitchenData?.restaurant_image || PLACEHOLDER_RESTAURANT;
    const itemRestaurantAddress = kitchenData?.Address || "";
    const itemRestaurantMinOrder = kitchenData?.min_order || 0;
    const isOpen = kitchenData?.restaurant_current_status?.is_open ?? true;

    await performCartUpdate(
      itemId, 
      action, 
      itemRestaurantId, 
      itemRestaurantName,
      itemRestaurantImage,
      itemRestaurantAddress,
      itemRestaurantMinOrder,
      isOpen,
      true // shouldNavigateAfterAdd
    );
  }, [offerItems, kitchenData, performCartUpdate]);

  const handleViewCart = useCallback(() => {
    if (!sessionId) {
      showMessage({
        message: "Session error",
        description: "Please refresh the page",
        type: "danger",
      });
      return;
    }
    
    const cartItemsList = getCartItemsForNavigation();
    
    if (cartItemsList.length === 0) {
      showMessage({
        message: "Cart is empty",
        description: "Please add items to your cart first",
        type: "info",
      });
      return;
    }
    
    navigateToCart();
  }, [navigateToCart, getCartItemsForNavigation, sessionId]);

  // ==================== API INTEGRATION ====================

  const transformAPIToCartItem = useCallback((apiItem: APIItem, index: number): CartItem => {
    const originalPrice = parseFloat(apiItem.item_price) || 0;
    let discountedPrice = originalPrice;
    let discountPercent = 0;
    
    if (apiItem.discount_active === 1 && apiItem.discount_percent) {
      discountPercent = parseFloat(apiItem.discount_percent);
      discountedPrice = originalPrice * (1 - discountPercent / 100);
    }
    
    const savings = originalPrice - discountedPrice;
    const isVeg = apiItem.food_type?.toLowerCase() === 'veg';
    const bogoEligible = apiItem.buy_one_get_one_free === true;
    const imageUrl = apiItem.item_image || PLACEHOLDER_ITEM_IMAGE;
    
    // Generate a truly unique ID to prevent duplicates
    const uniqueId = `${apiItem.id}-${apiItem.created_at || Date.now()}-${index}`;
    
    return {
      id: uniqueId,
      name: apiItem.item_name,
      description: apiItem.description || 'Delicious food item',
      originalPrice: originalPrice,
      discountedPrice: parseFloat(discountedPrice.toFixed(2)),
      discountPercent: discountPercent,
      discountText: discountPercent > 0 ? `${Math.round(discountPercent)}% OFF` : bogoEligible ? 'BOGO' : '',
      savings: savings > 0 ? parseFloat(savings.toFixed(2)) : 0,
      image: imageUrl,
      rating: 4.0,
      soldCount: 0,
      isVeg: isVeg,
      isBestseller: false,
      offerType: bogoEligible ? 'bogo' : (discountPercent > 0 ? 'percentage' : 'none'),
      stockQuantity: apiItem.stock_quantity || 0,
      availability: apiItem.availability === true && (apiItem.stock_quantity || 0) > 0,
      spiceLevel: apiItem.spice_level,
      preparationTime: apiItem.preparation_time,
      servingSize: apiItem.serving_size,
      restaurant: apiItem.restaurant,
      restaurantId: apiItem.restaurant,
      bogoEligible: bogoEligible,
      hasDiscount: discountPercent > 0 || bogoEligible,
      category: apiItem.category,
      startTime: apiItem.start_time || undefined,
      endTime: apiItem.end_time || undefined,
    };
  }, []);

  const fetchOfferItemsFromAPI = useCallback(async (page: number = 1, isLoadMore: boolean = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
        setCartLoading(true);
      }
      setError(null);

      const apiParams = route.params?.offer?.api_params || {};

      const params: any = {
        page,
        limit: 10,
        ...apiParams,
      };

      if (kitchenData?.id) {
        params.restaurant = kitchenData.id;
      }

      const response = await getOfferItems(params);
      
      let apiResponse: APIResponse;
      
      if (response && response.data) {
        apiResponse = response.data;
      } else if (response && response.success !== undefined) {
        apiResponse = response;
      } else {
        throw new Error('Invalid API response format');
      }
      
      if (apiResponse.success === true) {
        const items = apiResponse.data || [];
        const totalItems = apiResponse.total || 0;
        
        if (items.length === 0 && page === 1) {
          setError('No items found for this offer');
          setOfferItems([]);
          return;
        }
        
        const transformedItems = items.map((item, idx) => transformAPIToCartItem(item, idx));
        const validItems = transformedItems.filter(item => item.id);
        
        if (isLoadMore) {
          // Prevent duplicates by creating a Map with a composite key
          setOfferItems(prev => {
            const itemsMap = new Map();
            
            // Add existing items to map using a composite key
            prev.forEach(item => {
              const originalId = item.id.split('-')[0]; // Extract original ID
              itemsMap.set(`${originalId}-${item.name}`, item);
            });
            
            // Add new items (will overwrite duplicates)
            validItems.forEach(item => {
              const originalId = item.id.split('-')[0];
              itemsMap.set(`${originalId}-${item.name}`, item);
            });
            
            // Convert map back to array
            return Array.from(itemsMap.values());
          });
        } else {
          setOfferItems(validItems);
        }
        
        setTotalItemsCount(totalItems);
        // Update hasMoreItems based on actual items count
        const newTotalLength = isLoadMore ? offerItems.length + validItems.length : validItems.length;
        setHasMoreItems(validItems.length === 10 && newTotalLength < totalItems);
        
      } else {
        throw new Error(apiResponse.message || 'Failed to fetch offer items');
      }
    } catch (err: any) {
      console.error('Error fetching offer items:', err);
      const errorMessage = err.message || 'Failed to load items. Please try again.';
      setError(errorMessage);
    } finally {
      if (!isLoadMore) {
        setLoading(false);
        setIsInitialized(true);
      } else {
        setCartLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [offerType, category, kitchenData, transformAPIToCartItem, offerItems.length]);

  const loadMoreItems = useCallback(async () => {
    // Prevent multiple load more calls
    if (!hasMoreItems || isLoadingMore || cartLoading || loading || !isInitialized) {
      return;
    }
    
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await fetchOfferItemsFromAPI(nextPage, true);
  }, [hasMoreItems, isLoadingMore, cartLoading, loading, currentPage, fetchOfferItemsFromAPI, isInitialized]);

  const initializeOfferItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      setHasMoreItems(true);
      await fetchOfferItemsFromAPI(1, false);
    } catch (err: any) {
      console.error('Error initializing offer items:', err);
      setError(err.message || 'Failed to load items. Please try again.');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }, [fetchOfferItemsFromAPI]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    const initializeData = async () => {
      const session = await initializeSession();
      if (session) {
        await initializeOfferItems();
      }
    };
    
    initializeData();
    
    return () => {
      if (kitchenUpdateTimeoutRef.current) {
        clearTimeout(kitchenUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when offer changes
  useEffect(() => {
    // Reset state when offer changes
    setOfferItems([]);
    setCurrentPage(1);
    setHasMoreItems(true);
    setQuantities({});
    setActiveFilter('all');
    setError(null);
    
    const initializeData = async () => {
      const session = await initializeSession();
      if (session) {
        await initializeOfferItems();
      }
    };
    
    initializeData();
    
    return () => {
      if (kitchenUpdateTimeoutRef.current) {
        clearTimeout(kitchenUpdateTimeoutRef.current);
      }
    };
  }, [offer?.id, offerType]);

  // ==================== MEMOIZED VALUES ====================

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return offerItems;
    return offerItems.filter(item => 
      activeFilter === 'veg' ? item.isVeg : !item.isVeg
    );
  }, [offerItems, activeFilter]);

  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let totalOriginalAmount = 0;
    let totalDiscountedAmount = 0;
    let totalSavings = 0;
    
    Object.entries(quantities).forEach(([id, qty]) => {
      const item = offerItems.find(i => i.id === id);
      if (item && qty > 0) {
        totalItems += qty;
        totalOriginalAmount += item.originalPrice * qty;
        totalDiscountedAmount += item.discountedPrice * qty;
      }
    });
    
    totalSavings = totalOriginalAmount - totalDiscountedAmount;
    
    return {
      totalItems,
      totalAmount: totalDiscountedAmount,
      totalSavings,
      totalOriginalAmount,
      hasItems: totalItems > 0
    };
  }, [quantities, offerItems]);

  // ==================== HELPER FUNCTIONS ====================

  const formatValidTillDate = useCallback((dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const isItemUpdating = useCallback((itemId: string) => {
    return updatingItems.some(item => item.id === itemId);
  }, [updatingItems]);

  const getDiscountBadgeText = useCallback((item: CartItem) => {
    if (item.bogoEligible) return 'BOGO';
    if (item.discountPercent > 0) return `${Math.round(item.discountPercent)}% OFF`;
    return '';
  }, []);

  // Header animation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100, 150],
    outputRange: [0, 0.7, 1],
    extrapolate: 'clamp',
  });

  // ==================== RENDER METHODS ====================

  const renderHeader = useCallback(() => (
    <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.headerBackButton}
        >
          <Icon name="arrow-back" size={24} color="#1C1C1C" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{offerTitle}</Text>
        <View style={styles.headerPlaceholder} />
      </View>
    </Animated.View>
  ), [headerOpacity, navigation, offerTitle]);

  const renderHeroSection = useCallback(() => (
    <View style={styles.heroSection}>
      <View style={[styles.heroGradient, { backgroundColor: backgroundColor }]}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        {/* {offerImage ? (
          <Image source={{ uri: offerImage }} style={styles.heroImage} />
        ) : null} */}
        
        <View style={styles.heroContent}>
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>
              {offerType === 'bogo_offer' ? 'BOGO OFFER' : offerType === 'discounted' ? 'DISCOUNTED ITEMS' : 'LIMITED TIME'}
            </Text>
          </View>
          
          <Text style={styles.heroTitle}>{offerTitle}</Text>
          <Text style={styles.heroSubtitle}>{offerSubtitle}</Text>
          
          {/* {offerCode && (
            <TouchableOpacity 
              style={styles.codeContainer}
              onPress={() => {
                Alert.alert('Offer Code', `Use code: ${offerCode} at checkout`, [
                  { text: 'OK', style: 'default' }
                ]);
              }}
            >
              <Icon name="pricetag-outline" size={16} color="#FFF" />
              <Text style={styles.codeText}>Use Code: {offerCode}</Text>
            </TouchableOpacity>
          )} */}
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Icon name="restaurant-outline" size={14} color="#FFF" />
              <Text style={styles.statText}>
                {totalItemsCount || offerItems.length} Items
              </Text>
            </View>
            {validTill && (
              <View style={styles.statItem}>
                <Icon name="time-outline" size={14} color="#FFF" />
                <Text style={styles.statText}>Till {formatValidTillDate(validTill)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  ), [backgroundColor, navigation, offerType, offerTitle, offerSubtitle, offerCode, offerImage, offerItems.length, totalItemsCount, validTill, formatValidTillDate]);

  const renderFilterTabs = useCallback(() => {
    const counts = {
      all: filteredItems.length,
      veg: filteredItems.filter(i => i.isVeg).length,
      nonveg: filteredItems.filter(i => !i.isVeg).length
    };

    return (
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {['all', 'veg', 'nonveg'].map(filter => (
            <TouchableOpacity 
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.activeFilterChip]}
              onPress={() => setActiveFilter(filter)}
            >
              {filter === 'veg' && <View style={styles.vegDotIndicator} />}
              {filter === 'nonveg' && <View style={styles.nonVegDotIndicator} />}
              <Text style={[styles.filterText, activeFilter === filter && styles.activeFilterText]}>
                {filter === 'all' ? 'All Items' : filter === 'veg' ? 'Veg' : 'Non-Veg'}
              </Text>
              <View style={[styles.filterBadge, activeFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, activeFilter === filter && styles.activeFilterBadgeText]}>
                  {counts[filter]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [filteredItems, activeFilter]);

  const renderItemCard = useCallback(({ item, index }: { item: CartItem; index: number }) => {
    const quantity = quantities[item.id] || 0;
    const isOutOfStock = !item.availability || item.stockQuantity === 0;
    const isUpdating = isItemUpdating(item.id);
    const discountBadgeText = getDiscountBadgeText(item);
    
    return (
      <View style={styles.itemCard}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.image }} style={styles.itemImage} />
          {discountBadgeText ? (
            <View style={[styles.discountBadge, item.bogoEligible && styles.bogoBadge]}>
              <Text style={styles.discountText}>{discountBadgeText}</Text>
            </View>
          ) : null}
        </View>
        
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <View style={[styles.foodType, item.isVeg ? styles.vegType : styles.nonVegType]}>
              <View style={[styles.foodTypeDot, item.isVeg ? styles.vegDot : styles.nonVegDot]} />
            </View>
            {item.preparationTime ? (
              <View style={styles.timeContainer}>
                <Icon name="time-outline" size={10} color="#999" />
                <Text style={styles.timeText}>{item.preparationTime} min</Text>
              </View>
            ) : null}
          </View>
          
          <Text style={styles.itemName} numberOfLines={1}>{item.name || 'Item'}</Text>
          
          <View style={styles.priceContainer}>
            <Text style={styles.discountedPrice}>₹{item.discountedPrice.toFixed(2)}</Text>
            {item.hasDiscount && item.originalPrice !== item.discountedPrice ? (
              <Text style={styles.originalPrice}>₹{item.originalPrice.toFixed(2)}</Text>
            ) : null}
          </View>
          
          {item.hasDiscount && item.savings > 0 ? (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>Save ₹{item.savings.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
        
        <View style={styles.actionContainer}>
          {isOutOfStock ? (
            <View style={styles.outOfStockButton}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          ) : isUpdating ? (
            <View style={styles.updatingContainer}>
              <ActivityIndicator size="small" color={backgroundColor} />
            </View>
          ) : quantity === 0 ? (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => updateItemQuantity(item.id, 'increment')}
            >
              <Text style={styles.addButtonText}>Add +</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quantityContainer}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => updateItemQuantity(item.id, 'decrement')}
                disabled={isUpdating}
              >
                <Icon name="remove" size={16} color={backgroundColor} />
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => updateItemQuantity(item.id, 'increment')}
                disabled={isUpdating}
              >
                <Icon name="add" size={16} color={backgroundColor} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }, [quantities, updateItemQuantity, backgroundColor, isItemUpdating, getDiscountBadgeText]);

  const renderBottomBar = useCallback(() => {
    if (!cartSummary.hasItems) return null;

    return (
      <View style={styles.bottomBar}>
        <View style={[styles.bottomBarGradient, { backgroundColor: backgroundColor }]}>
          <View style={styles.bottomBarContent}>
            <View style={styles.cartInfo}>
              <View style={styles.cartIconContainer}>
                <Icon name="cart" size={22} color="#FFF" />
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartSummary.totalItems}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.cartText}>
                  {cartSummary.totalItems} item{cartSummary.totalItems > 1 ? 's' : ''}
                </Text>
                {cartSummary.totalSavings > 0 ? (
                  <Text style={styles.savingsText}>Save ₹{cartSummary.totalSavings.toFixed(2)}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity 
              style={styles.viewCartButton}
              onPress={handleViewCart}
            >
              <Text style={styles.viewCartText}>View Cart • ₹{cartSummary.totalAmount.toFixed(2)}</Text>
              <Icon name="arrow-forward" size={18} color={backgroundColor} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }, [cartSummary, backgroundColor, handleViewCart]);

  const renderFooter = useCallback(() => {
    if (!hasMoreItems) {
      return (
        <View style={styles.endOfListContainer}>
          <Text style={styles.endOfListText}>No more items to load</Text>
        </View>
      );
    }
    if (isLoadingMore || cartLoading) {
      return (
        <View style={styles.loaderFooter}>
          <ActivityIndicator size="small" color={backgroundColor} />
          <Text style={styles.loadingMoreText}>Loading more items...</Text>
        </View>
      );
    }
    return null;
  }, [hasMoreItems, isLoadingMore, cartLoading, backgroundColor]);

  // ==================== MAIN RENDER ====================

  if (loading && !isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={backgroundColor} />
          <Text style={styles.loadingText}>Loading delicious items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerContainer}>
          <Icon name="alert-circle-outline" size={80} color="#CCC" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={initializeOfferItems} style={[styles.retryButton, { backgroundColor }]}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#fff"  />
      
      {renderHeader()}
      
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          const isEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          if (isEnd && hasMoreItems && !cartLoading && !loading && !isLoadingMore) {
            loadMoreItems();
          }
        }}
      >
        {renderHeroSection()}
        {renderFilterTabs()}
        
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="restaurant-outline" size={80} color="#CCC" />
            <Text style={styles.emptyText}>No items found</Text>
            {activeFilter !== 'all' && (
              <TouchableOpacity onPress={() => setActiveFilter('all')} style={[styles.clearButton, { backgroundColor }]}>
                <Text style={styles.clearButtonText}>View All Items</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            <FlatList
              data={filteredItems}
              renderItem={renderItemCard}
              keyExtractor={(item, index) => {
                // Create a truly unique key using multiple identifiers
                const uniqueKey = `${item.id}-${item.name}-${index}`;
                return uniqueKey;
              }}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.row}
              ListFooterComponent={renderFooter}
              removeClippedSubviews={true}
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              windowSize={5}
            />
          </View>
        )}
        
        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
      
      {renderBottomBar()}
      
      {(cartLoading || isLoadingMore) && !loading && (
        <View style={styles.cartLoadingOverlay}>
          <ActivityIndicator size="large" color={backgroundColor} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    paddingBottom: 12,
  },
  
  headerBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1C',
    textAlign: 'center',
  },
  
  headerPlaceholder: {
    width: 40,
  },
  
  heroSection: {
    marginBottom: 16,
  },
  
  heroGradient: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.3,
  },
  
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  
  offerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    marginBottom: 12,
  },
  
  offerBadgeText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '700',
    letterSpacing: 1,
  },
  
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  heroSubtitle: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.95,
    marginBottom: 20,
    textAlign: 'center',
  },
  
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  
  codeText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  
  statText: {
    fontSize: 11,
    color: '#FFF',
  },
  
  filterContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: '#FFF',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  
  activeFilterChip: {
    backgroundColor: '#E55C18',
  },
  
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  
  activeFilterText: {
    color: '#FFF',
  },
  
  filterBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 15,
    minWidth: 26,
    alignItems: 'center',
  },
  
  activeFilterBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  
  activeFilterBadgeText: {
    color: '#FFF',
  },
  
  vegDotIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F7F4F',
  },
  
  nonVegDotIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E43B3B',
  },
  
  itemsGrid: {
    paddingHorizontal: 12,
  },
  
  row: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  
  itemCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: CARD_WIDTH - 10,
  },
  
  itemImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  discountBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#E55C18',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  bogoBadge: {
    backgroundColor: '#4ECDC4',
  },
  
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  
  itemInfo: {
    padding: 10,
  },
  
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  foodType: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 2,
  },
  
  vegType: {
    borderColor: '#0F7F4F',
  },
  
  nonVegType: {
    borderColor: '#E43B3B',
  },
  
  foodTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  vegDot: {
    backgroundColor: '#0F7F4F',
  },
  
  nonVegDot: {
    backgroundColor: '#E43B3B',
  },
  
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  
  timeText: {
    fontSize: 9,
    color: '#999',
  },
  
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 2,
  },
  
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  
  discountedPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E55C18',
  },
  
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  
  savingsBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  
  savingsBadgeText: {
    fontSize: 9,
    color: '#2E7D32',
    fontWeight: '600',
  },
  
  actionContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  
  addButton: {
    backgroundColor: '#FFF5F0',
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E55C18',
    width: '100%',
  },
  
  addButtonText: {
    color: '#E55C18',
    fontSize: 12,
    fontWeight: '700',
  },
  
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F0',
    borderRadius: 20,
    paddingHorizontal: 4,
    width: '100%',
  },
  
  quantityButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  
  quantityValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1C',
    minWidth: 28,
    textAlign: 'center',
  },
  
  outOfStockButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  
  outOfStockText: {
    color: '#999',
    fontSize: 11,
    fontWeight: '600',
  },
  
  updatingContainer: {
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    width: '100%',
  },
  
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  
  bottomBarGradient: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  
  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  cartInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  cartIconContainer: {
    position: 'relative',
  },
  
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFF',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  
  cartBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#E55C18',
  },
  
  cartText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  
  savingsText: {
    color: '#FFF',
    fontSize: 10,
    opacity: 0.9,
  },
  
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    gap: 6,
  },
  
  viewCartText: {
    color: '#E55C18',
    fontSize: 13,
    fontWeight: '700',
  },
  
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 20,
  },
  
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  
  clearButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  
  bottomSpacer: {
    height: 80,
  },
  
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
  
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 10,
  },
  
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  
  cartLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loaderFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingMoreText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  
  endOfListContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  endOfListText: {
    fontSize: 12,
    color: '#999',
  },
});

export default OfferDetailsPage;