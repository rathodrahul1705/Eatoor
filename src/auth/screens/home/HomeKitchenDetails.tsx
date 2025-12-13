import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  LayoutAnimation,
  UIManager,
  ActivityIndicator,
  BackHandler,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { getKitcheDetails } from "../../../api/home";
import { getCart, updateCart, clearCartDetails } from "../../../api/cart";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showMessage } from "react-native-flash-message";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width, height } = Dimensions.get("window");

// Responsive font sizes based on screen width
const scale = width / 375; // 375 is standard iPhone width
const normalize = (size) => Math.round(scale * size);

const FONT = {
  XS: normalize(10),
  SM: normalize(12),
  BASE: normalize(14),
  LG: normalize(16),
  XL: normalize(18),
  XXL: normalize(20),
  XXXL: normalize(24),
};

// Color palette
const COLORS = {
  primary: "#e65c00",
  primaryLight: "#ff8c42",
  primaryDark: "#cc5200",
  secondary: "#2e7d32",
  background: "#ffffff",
  surface: "#f8f9fa",
  error: "#d32f2f",
  warning: "#ffa000",
  success: "#388e3c",
  text: {
    primary: "#1a1a1a",
    secondary: "#666666",
    disabled: "#9e9e9e",
    light: "#ffffff",
  },
  border: "#e0e0e0",
  divider: "#f0f0f0",
  overlay: "rgba(0,0,0,0.6)",
};

// Placeholder images
const PLACEHOLDER_FOOD = "https://via.placeholder.com/150";
const PLACEHOLDER_RESTAURANT = "https://via.placeholder.com/300";

const HomeKitchenDetails = ({ route }) => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [modalQuantity, setModalQuantity] = useState(0);
  const [kitchenData, setKitchenData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [pastKitchenDetails, setPastKitchenDetails] = useState(null);
  const [showKitchenConflictModal, setShowKitchenConflictModal] =
    useState(false);
  const [pendingCartAction, setPendingCartAction] = useState(null);

  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  const offerScrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const modalOpenRef = useRef(false);

  // Check if kitchen is open
  const isKitchenOpen =
    kitchenData?.restaurant_current_status?.is_open || false;

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackPress();
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  const handleBackPress = useCallback(() => {
    navigation.navigate("HomeTabs");
  }, [navigation]);

  // Set navigation options
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fetch user data and session ID
  const fetchUserData = useCallback(async () => {
    try {
      const [userData, session] = await Promise.all([
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem("session_id"),
      ]);

      if (userData) setUser(JSON.parse(userData));
      if (session) setSessionId(session);
      return { user: userData ? JSON.parse(userData) : null, session };
    } catch (error) {
      console.error("Error fetching user data:", error);
      return { user: null, session: null };
    }
  }, []);

  // Fetch past kitchen details from storage
  const fetchPastKitchenDetails = useCallback(async () => {
    try {
      const storedDetails = await AsyncStorage.getItem("pastKitchenDetails");
      if (storedDetails) {
        setPastKitchenDetails(JSON.parse(storedDetails));
      }
    } catch (error) {
      console.error("Error fetching past kitchen details:", error);
    }
  }, []);

  // Save past kitchen details to storage
  const savePastKitchenDetails = useCallback(async (details) => {
    try {
      await AsyncStorage.setItem("pastKitchenDetails", JSON.stringify(details));
      setPastKitchenDetails(details);
    } catch (error) {
      console.error("Error saving past kitchen details:", error);
    }
  }, []);

  // Clear past kitchen details from storage
  const clearPastKitchenDetails = useCallback(async () => {
    try {
      await AsyncStorage.removeItem("pastKitchenDetails");
      setPastKitchenDetails(null);
    } catch (error) {
      console.error("Error clearing past kitchen details:", error);
    }
  }, []);

  // Check if current kitchen matches past kitchen
  const isSameKitchen = useMemo(() => {
    return pastKitchenDetails?.id === route.params?.kitchenId;
  }, [pastKitchenDetails, route.params?.kitchenId]);

  // Check if cart has items from different kitchen
  const hasDifferentKitchenItems = useMemo(() => {
    return (
      pastKitchenDetails &&
      pastKitchenDetails.id !== route.params?.kitchenId &&
      cartItems.length > 0
    );
  }, [pastKitchenDetails, route.params?.kitchenId, cartItems]);

  // Check if item is currently available based on time
  const isItemAvailableByTime = (item) => {
    if (!item.start_time || !item.end_time) return item.availability;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHours, startMinutes] = item.start_time.split(":").map(Number);
    const [endHours, endMinutes] = item.end_time.split(":").map(Number);

    const startTime = startHours * 60 + startMinutes;
    const endTime = endHours * 60 + endMinutes;

    return currentTime >= startTime && currentTime <= endTime;
  };

  // Check if item is completely available (kitchen open + item available + time valid)
  const isItemCompletelyAvailable = (item) => {
    return isKitchenOpen && item.availability && isItemAvailableByTime(item);
  };

  // Fetch kitchen details
  const fetchKitchenDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getKitcheDetails(route.params?.kitchenId);
      setKitchenData(response.data);
      // Expand first category by default
      if (response.data.itemlist && response.data.itemlist.length > 0) {
        const categories = [
          ...new Set(response.data.itemlist.map((item) => item.category)),
        ];
        if (categories.length > 0) {
          setExpandedSections({ [categories[0]]: true });
        }
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [route.params?.kitchenId]);

  // Fetch cart data
  const fetchCartData = useCallback(async () => {
    try {
      const { user: currentUser, session: currentSession } =
        await fetchUserData();

      if (!currentUser?.id) return;

      const payload = {
        session_id: currentSession,
        user_id: currentUser.id,
      };

      const response = await getCart(payload);

      if (response.status === 200) {
        const cartItemsFromApi = response.data.cart_details.map((item) => ({
          id: item.item_id.toString(),
          name: item.item_name,
          price: item.item_price,
          quantity: item.quantity,
          image: item.item_image || null,
          type: item.food_type === "Non-Veg" ? "NonVeg" : "Veg",
          category: "",
          description: "",
          availability: true,
          isBestseller: false,
          discount_active: false,
        }));
        setCartItems(cartItemsFromApi);

        // Update past kitchen details based on cart
        if (response?.data.existingCartDetails.length > 0) {
          const newPastKitchenDetails = {
            id: response?.data.existingCartDetails[0]?.restaurant_id,
            name: response?.data.existingCartDetails[0]?.restaurant_name,
            image:
              response?.data.existingCartDetails[0]?.restaurant_profile_image,
            itemCount: response?.data.total_item_count,
          };
          await savePastKitchenDetails(newPastKitchenDetails);
        } else if (cartItemsFromApi.length === 0) {
          await clearPastKitchenDetails();
        }
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
      showMessage({
        message: "Failed to load cart items",
        description: "Please try again later",
        type: "danger",
      });
    }
  }, [fetchUserData, savePastKitchenDetails, clearPastKitchenDetails]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchKitchenDetails(),
        fetchCartData(),
        fetchPastKitchenDetails(),
      ]);
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchKitchenDetails, fetchCartData, fetchPastKitchenDetails]);

  // Initial data load
  useEffect(() => {
    if (route.params?.kitchenId) {
      refreshData();
    }
  }, [route.params?.kitchenId]);

  // Auto change offers
  useEffect(() => {
    const offersList = kitchenData?.active_offer_list || [];
    if (offersList.length > 1) {
      const interval = setInterval(() => {
        setCurrentOfferIndex((prev) => (prev + 1) % offersList.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [kitchenData?.active_offer_list]);

  // Show cart summary when items are added
  useEffect(() => {
    const totalItems = cartItems.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    setShowCartSummary(totalItems > 0);
  }, [cartItems]);

  // Update modal quantity when selected item changes, but only if modal is not open
  useEffect(() => {
    if (selectedItem && !modalOpenRef.current) {
      const cartItem = cartItems.find((item) => item.id === selectedItem.id);
      setModalQuantity(cartItem?.quantity || 0);
    }
  }, [selectedItem, cartItems]);

  const insets = useSafeAreaInsets();

  // Header height decreases as we scroll
  const MAX_HEADER_HEIGHT = 220;
  const MIN_HEADER_HEIGHT = Platform.OS === "ios" ? 30 + insets.top : 70;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [MAX_HEADER_HEIGHT, MIN_HEADER_HEIGHT],
    extrapolate: "clamp",
  });

  // Kitchen name becomes visible in header as we scroll
  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [0, 100, 150],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  // Image opacity decreases as we scroll
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Default kitchen info if API data is not available
  const defaultKitchenInfo = {
    name: "Spice Garden",
    address: "123 Food Street, Culinary District",
    shortAddress: "Food Street",
    deliveryTime: "40-45 mins",
    distance: "5 km",
    openingTime: "10:00 AM",
    closingTime: "10:00 PM",
    isOpen: true,
    rating: 4.5,
    reviews: 1247,
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cmVzdGF1cmFudCUyMGludGVyaW9yfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60",
  };

  // Use API data or fallback to default
  const kitchenInfo = kitchenData
    ? {
        name: kitchenData.restaurant_name,
        address: kitchenData.Address,
        shortAddress: kitchenData.Address,
        deliveryTime: `${kitchenData.time_required_to_reach_loc} mins`,
        distance: "5 km", // Not in API response, keeping default
        openingTime: formatTime(kitchenData.opening_time),
        closingTime: formatTime(kitchenData.closing_time),
        isOpen: kitchenData.restaurant_current_status?.is_open || false,
        rating: kitchenData.rating,
        reviews: 1247, // Not in API response, keeping default
        image: kitchenData.restaurant_image,
      }
    : defaultKitchenInfo;

  // Helper function to format time (HH:MM to HH:MM AM/PM)
  function formatTime(timeString) {
    if (!timeString) return "";

    const [hours, minutes] = timeString.split(":");
    const hourInt = parseInt(hours, 10);
    const period = hourInt >= 12 ? "PM" : "AM";
    const formattedHour = hourInt % 12 || 12;

    return `${formattedHour}:${minutes} ${period}`;
  }

  const filters = ["All", "Veg", "Non-Veg", "Offers", "Bestseller"];

  // Get offers from API response or use empty array
  const offers = useMemo(() => {
    if (!kitchenData?.active_offer_list) return [];
    
    return kitchenData.active_offer_list.map((offer) => {
      let description = "";
      let code = "";
      
      // Generate description and code based on offer type
      switch (offer.offer_type) {
        case "free_delivery":
          description = offer.details?.sub_filter === "new_user" 
            ? "Free delivery for new users" 
            : "Free delivery on all orders";
          code = `FREE${offer.id}`;
          break;
        case "credit":
          description = `Get ₹${offer.details?.credit_amount || 0} credit for new users`;
          code = `CREDIT${offer.id}`;
          break;
        case "percentage_discount":
          description = `${offer.details?.discount_percent || 0}% off on your order`;
          code = `OFF${offer.id}`;
          break;
        case "flat_discount":
          description = `Flat ₹${offer.details?.discount_amount || 0} off on your order`;
          code = `FLAT${offer.id}`;
          break;
        default:
          description = offer.title || "Special offer";
          code = `OFFER${offer.id}`;
      }
      
      return {
        id: offer.id.toString(),
        title: offer.title,
        description,
        code,
        offer_type: offer.offer_type,
        details: offer.details,
      };
    });
  }, [kitchenData?.active_offer_list]);

  // Transform API data to menu items format
  const transformMenuItems = (itemlist) => {
    if (!itemlist || !Array.isArray(itemlist)) return [];

    const categories = [...new Set(itemlist.map((item) => item.category))];

    return categories.map((category) => {
      const categoryItems = itemlist.filter(
        (item) => item.category === category
      );
      return {
        id: category,
        category: category,
        items: categoryItems.map((item) => ({
          id: item.id.toString(),
          name: item.item_name,
          description: item.description,
          price: parseFloat(item.item_price),
          isVeg: item.food_type === "Veg",
          isBestseller: false,
          rating: 4.5,
          image: item.item_image,
          availability: item.availability,
          discountPercent: parseFloat(item.discount_percent) || 0,
          discountActive: item.discount_active === "1",
          start_time: item.start_time,
          end_time: item.end_time,
          // Add time-based availability
          isAvailableByTime: isItemAvailableByTime(item),
          // Add complete availability status
          isCompletelyAvailable: isItemCompletelyAvailable(item),
          // Add type for filtering
          type: item.food_type === "Non-Veg" ? "NonVeg" : "Veg",
          // Add discount and BOGO info
          discount_percent: item.discount_percent,
          buy_one_get_one_free: item.buy_one_get_one_free,
        })),
      };
    });
  };

  const menuItems = kitchenData ? transformMenuItems(kitchenData.itemlist) : [];

  // Filter menu items based on active filter
  const filteredMenuItems = menuItems
    .map((section) => {
      if (activeFilter === "All") return section;

      return {
        ...section,
        items: section.items.filter((item) => {
          if (activeFilter === "Veg") return item.isVeg;
          if (activeFilter === "Non-Veg") return !item.isVeg;
          if (activeFilter === "Offers")
            return item.discountActive || item.buy_one_get_one_free;
          if (activeFilter === "Bestseller") return item.isBestseller;
          return true;
        }),
      };
    })
    .filter((section) => section.items.length > 0);

  const toggleSection = (sectionId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Handle kitchen conflict and show conflict modal
  const handleKitchenConflict = useCallback(
    (itemId, action) => {
      setPendingCartAction({ itemId, action });
      setShowKitchenConflictModal(true);
      // Close item modal if open
      if (modalVisible) {
        setModalVisible(false);
      }
    },
    [modalVisible]
  );

  // Update cart item quantity with kitchen conflict handling
  const updateCartItem = useCallback(
    async (itemId, action, force = false) => {
      if (!kitchenData?.restaurant_current_status.is_open) return;

      try {
        // Check if we're trying to add to a different kitchen's cart
        if (!force && action === "add" && hasDifferentKitchenItems) {
          handleKitchenConflict(itemId, action);
          return;
        }

        setUpdatingItemId(itemId);

        const payload = {
          session_id: sessionId,
          restaurant_id: route.params?.kitchenId,
          item_id: itemId,
          source: "ITEMLIST",
          action,
          quantity: 1,
          user_id: user?.id,
        };

        await updateCart(payload);

        // Update past kitchen details after cart update
        if (kitchenData) {
          const currentItemCount = cartItems.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0
          );
          const newPastKitchenDetails = {
            id: route.params?.kitchenId,
            name: kitchenData.restaurant_name,
            image: kitchenData.restaurant_image || PLACEHOLDER_RESTAURANT,
            itemCount:
              action === "add"
                ? currentItemCount + 1
                : Math.max(0, currentItemCount - 1),
          };
          await savePastKitchenDetails(newPastKitchenDetails);
        }

        await fetchCartData();
      } catch (error) {
        console.error("Cart update error:", error);
        showMessage({
          message: `Failed to ${action} item`,
          description: error.response?.data?.message || "Please try again",
          type: "danger",
        });
      } finally {
        setUpdatingItemId(null);
      }
    },
    [
      sessionId,
      user?.id,
      route.params?.kitchenId,
      kitchenData,
      fetchCartData,
      hasDifferentKitchenItems,
      cartItems,
      savePastKitchenDetails,
      handleKitchenConflict,
    ]
  );

  const handleClearCartAndProceed = useCallback(async () => {
    try {
      setShowKitchenConflictModal(false);
      setModalVisible(false);
      const { user: currentUser, session: currentSession } =
        await fetchUserData();

      if (!currentUser?.id) return;

      const payload = {
        session_id: currentSession,
        user_id: currentUser.id,
      };

      await clearCartDetails(payload);
      await clearPastKitchenDetails();
      await fetchCartData(); // Refresh cart data after clearing

      if (pendingCartAction) {
        await updateCartItem(
          pendingCartAction.itemId,
          pendingCartAction.action,
          true
        );
      }

      showMessage({
        message: "Cart cleared",
        description: "You can now add items from this kitchen",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to clear cart:", error);
      showMessage({
        message: "Failed to clear cart",
        description: "Please try again later",
        type: "danger",
      });
    } finally {
      setPendingCartAction(null);
    }
  }, [
    fetchUserData,
    pendingCartAction,
    clearPastKitchenDetails,
    updateCartItem,
    fetchCartData,
  ]);

  // Handle adding item directly from list with conflict check
  const handleAddItemFromList = useCallback(
    (itemId) => {
      updateCartItem(itemId, "add");
    },
    [updateCartItem]
  );

  // Get current quantity of an item in cart
  const getItemQuantity = useCallback(
    (itemId) => {
      const item = cartItems.find((item) => item.id === itemId);
      return item?.quantity || 0;
    },
    [cartItems]
  );

  const openItemModal = (item) => {
    console.log("Opening modal for item:", item?.name);
    setSelectedItem(item);
    setModalQuantity(getItemQuantity(item.id) || 0);
    modalOpenRef.current = true;
    setModalVisible(true);
  };

  const closeItemModal = () => {
    modalOpenRef.current = false;
    setModalVisible(false);
  };

  const openOffersModal = () => {
    setOfferModalVisible(true);
  };

  const closeOffersModal = () => {
    setOfferModalVisible(false);
  };

  // Handle Add button click in modal
  const handleModalAddButton = useCallback(() => {
    if (!selectedItem) return;
    updateModalQuantity(1);
  }, [selectedItem]);

  // Update modal quantity and make API calls
  const updateModalQuantity = useCallback(
    (change) => {
      if (!isKitchenOpen || !selectedItem) return;

      const newQuantity = Math.max(0, modalQuantity + change);
      setModalQuantity(newQuantity);

      // Make API call based on the change
      if (change > 0) {
        // Add item
        updateCartItem(selectedItem.id, "add");
      } else if (change < 0 && newQuantity >= 0) {
        // Remove item
        updateCartItem(selectedItem.id, "remove");
      }
    },
    [isKitchenOpen, selectedItem, modalQuantity, updateCartItem]
  );

  const getTotalItems = () => {
    return cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getTotalPrice = () => {
    let total = 0;
    for (const item of cartItems) {
      if (item.quantity > 0) {
        // Apply discount if available
        const price =
          item.discountActive && item.discount_percent
            ? item.price * (1 - parseFloat(item.discount_percent) / 100)
            : item.price;
        total += price * item.quantity;
      }
    }
    return Math.round(total);
  };

  // View cart handler
  const handleViewCart = useCallback(() => {
    const pastkitcheId = pastKitchenDetails?.id;
    if (!kitchenData) return;
    navigation.navigate("CartScreen", {
      cartItems,
      totalPrice: getTotalPrice(),
      pastkitcheId,
      restaurant: {
        name: kitchenData.restaurant_name,
        address: kitchenData.Address,
        minOrder: kitchenData.min_order,
        coverImage: kitchenData.restaurant_image || PLACEHOLDER_RESTAURANT,
        isOpen: kitchenData.restaurant_current_status.is_open,
      },
      userId: user?.id,
    });
  }, [navigation, kitchenData, cartItems, pastKitchenDetails, user?.id]);

  // Copy offer code to clipboard
  const copyToClipboard = useCallback((code) => {
    showMessage({
      message: "Offer code copied!",
      description: `Code: ${code}`,
      type: "success",
    });
  }, []);

  const renderFilterChip = (filter) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.kitchenDetails__filterChip,
        activeFilter === filter && styles.kitchenDetails__filterChipActive,
      ]}
      onPress={() => setActiveFilter(filter)}
    >
      <Text
        style={[
          styles.kitchenDetails__filterText,
          activeFilter === filter && styles.kitchenDetails__filterTextActive,
        ]}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const renderOfferItem = ({ item, index }) => (
    <TouchableOpacity
      style={[
        styles.kitchenDetails__offerItem,
        index === currentOfferIndex && styles.kitchenDetails__offerItemActive,
      ]}
      onPress={openOffersModal}
      activeOpacity={0.8}
    >
      <View style={styles.kitchenDetails__offerIcon}>
        <Icon 
          name={item.offer_type === "free_delivery" ? "bicycle" : "pricetag"} 
          size={16} 
          color={COLORS.primary} 
        />
      </View>
      <View style={styles.kitchenDetails__offerContent}>
        <Text style={styles.kitchenDetails__offerTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.kitchenDetails__offerDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View style={styles.kitchenDetails__offerCount}>
        <Text style={styles.kitchenDetails__offerCountText}>
          {index + 1}/{offers.length}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderMenuItem = ({ item }) => {
    const quantity = getItemQuantity(item.id);
    const discountedPrice = item.discountActive
      ? Math.round(item.price * (1 - item.discountPercent / 100))
      : null;

    const isAvailable = item.isCompletelyAvailable;
    const isUpdating = updatingItemId === item.id;

    return (
      <TouchableOpacity
        style={styles.kitchenDetails__menuItem}
        onPress={() => {
          console.log("Item pressed:", item.name);
          if (isAvailable) {
            openItemModal(item);
          }
        }}
        activeOpacity={isAvailable ? 0.7 : 1}
        disabled={!isAvailable}
      >
        {/* Image Section */}
        <View style={styles.kitchenDetails__menuItemImageContainer}>
          <Image
            source={{ uri: item.image || PLACEHOLDER_FOOD }}
            style={styles.kitchenDetails__menuItemImage}
            resizeMode="cover"
            defaultSource={{ uri: PLACEHOLDER_FOOD }}
          />
          
          {/* Veg/Non-Veg Indicator */}
          <View style={styles.kitchenDetails__vegIndicatorContainer}>
            {item.isVeg ? (
              <View style={styles.kitchenDetails__vegIndicator}>
                <View
                  style={[
                    styles.kitchenDetails__vegInnerDot,
                    { backgroundColor: COLORS.success },
                  ]}
                />
              </View>
            ) : (
              <View style={styles.kitchenDetails__nonVegIndicator}>
                <View
                  style={[
                    styles.kitchenDetails__vegInnerDot,
                    { backgroundColor: COLORS.error },
                  ]}
                />
              </View>
            )}
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.kitchenDetails__menuItemContent}>
          {/* Item Name */}
          <Text style={styles.kitchenDetails__menuItemName} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Description */}
          {item.description ? (
            <Text style={styles.kitchenDetails__menuItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          {/* Price and Discount Section */}
          <View style={styles.kitchenDetails__priceDiscountContainer}>
            {discountedPrice ? (
              <View style={styles.kitchenDetails__discountedPriceContainer}>
                <Text style={styles.kitchenDetails__discountedPrice}>
                  ₹{discountedPrice}
                </Text>
                <Text style={styles.kitchenDetails__originalPrice}>
                  ₹{item.price}
                </Text>
                {item.discountActive && (
                  <View style={styles.kitchenDetails__discountBadge}>
                    <Text style={styles.kitchenDetails__discountText}>
                      {item.discountPercent}% OFF
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.kitchenDetails__menuItemPrice}>
                ₹{item.price}
              </Text>
            )}
          </View>

          {/* Add to Cart Button */}
          {isAvailable ? (
            quantity === 0 ? (
              <TouchableOpacity
                style={[
                  styles.kitchenDetails__addButton,
                  isUpdating && styles.kitchenDetails__addButtonLoading
                ]}
                onPress={() => handleAddItemFromList(item.id)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={COLORS.text.light} />
                ) : (
                  <Text style={styles.kitchenDetails__addButtonText}>ADD</Text>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.kitchenDetails__quantityControls}>
                <TouchableOpacity
                  style={styles.kitchenDetails__quantityButton}
                  onPress={() => updateCartItem(item.id, "remove")}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Icon name="remove" size={16} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
                <Text style={styles.kitchenDetails__quantityText}>
                  {quantity}
                </Text>
                <TouchableOpacity
                  style={styles.kitchenDetails__quantityButton}
                  onPress={() => updateCartItem(item.id, "add")}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Icon name="add" size={16} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={styles.kitchenDetails__addButtonDisabled}>
              <Text style={styles.kitchenDetails__addButtonDisabledText}>
                UNAVAILABLE
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMenuSection = ({ item: section }) => {
    const isExpanded = expandedSections[section.id] || false;

    return (
      <View style={styles.kitchenDetails__menuSection}>
        <TouchableOpacity
          style={styles.kitchenDetails__sectionHeader}
          onPress={() => toggleSection(section.id)}
          activeOpacity={0.8}
        >
          <View style={styles.kitchenDetails__sectionHeaderContent}>
            <Text style={styles.kitchenDetails__sectionTitle}>
              {section.category}
            </Text>
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={COLORS.primary}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.kitchenDetails__sectionContent}>
            <FlatList
              data={section.items}
              renderItem={renderMenuItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </View>
    );
  };

  const renderOfferModalItem = ({ item }) => (
    <View style={styles.offersModal__item}>
      <View style={styles.offersModal__icon}>
        <Icon 
          name={item.offer_type === "free_delivery" ? "bicycle" : "pricetag"} 
          size={20} 
          color={COLORS.primary} 
        />
      </View>
      <View style={styles.offersModal__itemContent}>
        <Text style={styles.offersModal__itemTitle}>
          {item.title}
        </Text>
        <Text style={styles.offersModal__itemDescription}>
          {item.description}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.kitchenDetails__loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.kitchenDetails__loadingContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.kitchenDetails__loadingText}>
            Loading Kitchen Details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.kitchenDetails__errorContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.kitchenDetails__errorContent}>
          <Icon name="alert-circle-outline" size={60} color={COLORS.primary} />
          <Text style={styles.kitchenDetails__errorText}>
            Failed to load kitchen details
          </Text>
          <Text style={styles.kitchenDetails__errorSubText}>{error}</Text>
          <TouchableOpacity
            style={styles.kitchenDetails__retryButton}
            onPress={refreshData}
          >
            <Text style={styles.kitchenDetails__retryButtonText}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.kitchenDetails__container}>
      <StatusBar barStyle="light-content" />

      {/* Sticky Header */}
      <Animated.View
        style={[styles.kitchenDetails__header, { height: headerHeight }]}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: imageOpacity }]}
        >
          <Image
            source={{ uri: kitchenInfo.image || PLACEHOLDER_RESTAURANT }}
            style={styles.kitchenDetails__headerImage}
            defaultSource={{ uri: PLACEHOLDER_RESTAURANT }}
          />
          <View style={styles.kitchenDetails__headerOverlay} />
        </Animated.View>

        <TouchableOpacity
          style={styles.kitchenDetails__backButton}
          onPress={handleBackPress}
        >
          <Icon name="arrow-back" size={24} color={COLORS.text.light} />
        </TouchableOpacity>

        <Animated.Text
          style={[
            styles.kitchenDetails__stickyTitle,
            { opacity: headerTitleOpacity },
          ]}
          numberOfLines={1}
        >
          {kitchenInfo.name}
        </Animated.Text>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.kitchenDetails__scrollView}
        contentContainerStyle={styles.kitchenDetails__scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshData}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Kitchen Info Section */}
        <View style={styles.kitchenDetails__kitchenCard}>
          <View style={styles.kitchenDetails__kitchenInfo}>
            <View style={styles.kitchenDetails__kitchenHeader}>
              <View style={styles.kitchenDetails__nameRatingRow}>
                <Text
                  style={styles.kitchenDetails__kitchenName}
                  numberOfLines={1}
                >
                  {kitchenInfo.name}
                </Text>
                <View style={styles.kitchenDetails__ratingBadge}>
                  <Icon name="star" size={12} color={COLORS.text.light} />
                  <Text style={styles.kitchenDetails__ratingText}>
                    {kitchenInfo.rating}
                  </Text>
                </View>
              </View>

              <View style={styles.kitchenDetails__addressRow}>
                <Icon name="location-outline" size={14} color="#ff6b6b" />
                <Text
                  style={styles.kitchenDetails__kitchenAddress}
                  numberOfLines={1}
                >
                  {kitchenInfo.shortAddress}
                </Text>
              </View>
            </View>

            <View style={styles.kitchenDetails__detailsContainer}>
              <View style={styles.kitchenDetails__detailRow}>
                <View style={styles.kitchenDetails__detailItem}>
                  <Icon name="time-outline" size={14} color={COLORS.text.secondary} />
                  <Text style={styles.kitchenDetails__detailText}>
                    {kitchenInfo.deliveryTime}
                  </Text>
                </View>

                <View style={styles.kitchenDetails__dotSeparator} />

                <View style={styles.kitchenDetails__detailItem}>
                  <Icon name="navigate-outline" size={14} color={COLORS.text.secondary} />
                  <Text style={styles.kitchenDetails__detailText}>
                    {kitchenInfo.distance}
                  </Text>
                </View>

                <View style={styles.kitchenDetails__dotSeparator} />

                <View style={styles.kitchenDetails__statusContainer}>
                  <View
                    style={[
                      styles.kitchenDetails__statusIndicator,
                      kitchenInfo.isOpen
                        ? styles.kitchenDetails__openIndicator
                        : styles.kitchenDetails__closedIndicator,
                    ]}
                  />
                  <Text
                    style={[
                      styles.kitchenDetails__kitchenStatus,
                      kitchenInfo.isOpen
                        ? styles.kitchenDetails__openText
                        : styles.kitchenDetails__closedText,
                    ]}
                  >
                    {kitchenInfo.isOpen ? "OPEN" : "CLOSED"}
                  </Text>
                </View>
              </View>

              <View style={styles.kitchenDetails__timingRow}>
                <Text style={styles.kitchenDetails__kitchenTimings}>
                  {kitchenInfo.openingTime} - {kitchenInfo.closingTime}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Offers Banner - Compact Design */}
        {offers.length > 0 ? (
          <View style={styles.kitchenDetails__offersContainer}>
            <View style={styles.kitchenDetails__offersHeader}>
              <Icon name="pricetag" size={18} color={COLORS.primary} />
              <Text style={styles.kitchenDetails__offersTitle}>Offers</Text>
              <TouchableOpacity
                onPress={openOffersModal}
                style={styles.kitchenDetails__viewAllButton}
              >
                <Text style={styles.kitchenDetails__viewAllText}>View All</Text>
                <Icon name="chevron-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={offerScrollRef}
              data={offers}
              renderItem={renderOfferItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(
                  event.nativeEvent.contentOffset.x / (width - 32)
                );
                setCurrentOfferIndex(index);
              }}
            />
            <View style={styles.kitchenDetails__offerPagination}>
              {offers.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.kitchenDetails__paginationDot,
                    index === currentOfferIndex &&
                      styles.kitchenDetails__paginationDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.kitchenDetails__noOffersContainer}>
            <Icon name="pricetag-outline" size={20} color={COLORS.border} />
            <Text style={styles.kitchenDetails__noOffersText}>
              No offers available
            </Text>
          </View>
        )}

        {/* Filters Section */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kitchenDetails__filtersContainer}
          contentContainerStyle={styles.kitchenDetails__filtersContent}
        >
          {filters.map(renderFilterChip)}
        </ScrollView>

        {/* Kitchen Closed Message */}
        {!isKitchenOpen && (
          <View style={styles.kitchenDetails__closedMessageContainer}>
            <Icon name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.kitchenDetails__closedMessageText}>
              This kitchen is currently closed. You can browse the menu but
              cannot place orders.
            </Text>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.kitchenDetails__menuContainer}>
          {filteredMenuItems.length > 0 ? (
            <FlatList
              data={filteredMenuItems}
              renderItem={renderMenuSection}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.kitchenDetails__noItemsContainer}>
              <Icon name="fast-food-outline" size={50} color={COLORS.border} />
              <Text style={styles.kitchenDetails__noItemsText}>
                No items found for this filter
              </Text>
            </View>
          )}
        </View>
        
        {/* Bottom Padding for ScrollView */}
        <View style={styles.kitchenDetails__bottomPadding} />
      </Animated.ScrollView>

      {/* Cart Summary Bar */}
      {showCartSummary && pastKitchenDetails && (
        <View style={styles.kitchenDetails__cartSummaryContainer}>
          <View style={styles.kitchenDetails__cartSummaryHeader}>
            <View style={styles.kitchenDetails__cartSummaryKitchenInfo}>
              <Image
                source={{
                  uri: pastKitchenDetails.image || PLACEHOLDER_RESTAURANT,
                }}
                style={styles.kitchenDetails__cartSummaryKitchenImage}
              />
              <View style={styles.kitchenDetails__cartSummaryKitchenText}>
                <Text
                  style={styles.kitchenDetails__cartSummaryKitchenName}
                  numberOfLines={1}
                >
                  {pastKitchenDetails.name}
                </Text>
                <Text style={styles.kitchenDetails__cartSummaryItemCount}>
                  {pastKitchenDetails.itemCount} item
                  {pastKitchenDetails.itemCount !== 1 ? "s" : ""} in cart
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.kitchenDetails__cartSummaryMiniCartBtn}
              onPress={handleViewCart}
              activeOpacity={0.9}
            >
              <View style={styles.kitchenDetails__cartSummaryMiniCartContent}>
                <Text style={styles.kitchenDetails__cartSummaryViewCartText}>
                  View Cart
                </Text>
                <View style={styles.kitchenDetails__cartSummaryCartCountBadge}>
                  <Text style={styles.kitchenDetails__cartSummaryMiniCartCount}>
                    {pastKitchenDetails.itemCount}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Item Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeItemModal}
        statusBarTranslucent={true}
      >
        <View style={styles.modal__container}>
          <View style={styles.modal__content}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.modal__closeButton}
              onPress={closeItemModal}
            >
              <Icon name="close" size={24} color={COLORS.text.light} />
            </TouchableOpacity>

            {selectedItem ? (
              <View style={styles.modal__fixedContent}>
                {/* Enhanced Image with rounded top corners and shadow */}
                <View style={styles.modal__imageContainer}>
                  <Image
                    source={{ uri: selectedItem.image || PLACEHOLDER_FOOD }}
                    style={styles.modal__image}
                    resizeMode="cover"
                    defaultSource={{ uri: PLACEHOLDER_FOOD }}
                  />
                  <View style={styles.modal__imageOverlay} />
                </View>

                {/* Scrollable Content Area */}
                <View style={styles.modal__scrollContent}>
                  <ScrollView
                    style={styles.modal__scrollView}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.modal__body}>
                      {/* Title and Veg Indicator */}
                      <View style={styles.modal__titleRow}>
                        <View style={styles.modal__vegIndicatorContainer}>
                          {selectedItem.isVeg ? (
                            <View
                              style={[
                                styles.modal__vegIndicator,
                                styles.modal__veg,
                              ]}
                            >
                              <View
                                style={[
                                  styles.modal__vegInnerDot,
                                  { backgroundColor: COLORS.success },
                                ]}
                              />
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.modal__vegIndicator,
                                styles.modal__nonVeg,
                              ]}
                            >
                              <View
                                style={[
                                  styles.modal__vegInnerDot,
                                  { backgroundColor: COLORS.error },
                                ]}
                              />
                            </View>
                          )}
                        </View>
                        <Text style={styles.modal__itemName} numberOfLines={2}>
                          {selectedItem.name}
                        </Text>
                      </View>

                      {/* Scrollable Description */}
                      <Text style={styles.modal__itemDescription}>
                        {selectedItem.description}
                      </Text>
                    </View>
                  </ScrollView>
                </View>

                {/* Fixed Bottom Section - Price and Action Buttons */}
                <View style={styles.modal__fixedBottom}>
                  {/* Unavailable Message */}
                  {!selectedItem.isCompletelyAvailable && (
                    <View style={styles.modal__unavailableMessage}>
                      <Icon name="error-outline" size={20} color={COLORS.error} />
                      <Text style={styles.modal__unavailableMessageText}>
                        This item is currently unavailable
                      </Text>
                    </View>
                  )}

                  {/* Price and Action Buttons Row */}
                  <View style={styles.modal__actionRow}>
                    {/* Price Section */}
                    <View style={styles.modal__priceSection}>
                      {selectedItem.discountActive ? (
                        <>
                          <Text style={styles.modal__currentPrice}>
                            ₹
                            {Math.round(
                              selectedItem.price *
                                (1 - selectedItem.discountPercent / 100)
                            )}
                          </Text>
                          <Text style={styles.modal__originalPrice}>
                            ₹{selectedItem.price}
                          </Text>
                          <View style={styles.modal__discountBadge}>
                            <Text style={styles.modal__discountText}>
                              {selectedItem.discountPercent}% OFF
                            </Text>
                          </View>
                        </>
                      ) : (
                        <Text style={styles.modal__currentPrice}>
                          ₹{selectedItem.price}
                        </Text>
                      )}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.modal__actionButtons}>
                      {modalQuantity === 0 ? (
                        <TouchableOpacity
                          style={[
                            styles.modal__addButton,
                            !selectedItem.isCompletelyAvailable &&
                              styles.modal__addButtonDisabled,
                          ]}
                          onPress={handleModalAddButton}
                          disabled={
                            !selectedItem.isCompletelyAvailable ||
                            updatingItemId === selectedItem.id
                          }
                        >
                          {updatingItemId === selectedItem.id ? (
                            <View style={styles.modal__addButtonContent}>
                              <ActivityIndicator size="small" color={COLORS.text.light} />
                            </View>
                          ) : (
                            <View style={styles.modal__addButtonContent}>
                              <Text style={styles.modal__addButtonText}>
                                ADD
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.modal__quantityContainer}>
                          <TouchableOpacity
                            style={styles.modal__quantityButton}
                            onPress={() => updateModalQuantity(-1)}
                            disabled={
                              modalQuantity === 0 ||
                              !selectedItem.isCompletelyAvailable ||
                              updatingItemId === selectedItem.id
                            }
                          >
                            {updatingItemId === selectedItem.id ? (
                              <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                              <Icon
                                name="remove"
                                size={20}
                                color={
                                  modalQuantity === 0 ||
                                  !selectedItem.isCompletelyAvailable
                                    ? COLORS.border
                                    : COLORS.primary
                                }
                              />
                            )}
                          </TouchableOpacity>

                          <Text style={styles.modal__quantityText}>
                            {modalQuantity}
                          </Text>

                          <TouchableOpacity
                            style={styles.modal__quantityButton}
                            onPress={() => updateModalQuantity(1)}
                            disabled={
                              !selectedItem.isCompletelyAvailable ||
                              updatingItemId === selectedItem.id
                            }
                          >
                            {updatingItemId === selectedItem.id ? (
                              <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                              <Icon
                                name="add"
                                size={20}
                                color={
                                  !selectedItem.isCompletelyAvailable
                                    ? COLORS.border
                                    : COLORS.primary
                                }
                              />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.modal__loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.modal__loadingText}>
                  Loading item details...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Offers Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={offerModalVisible}
        onRequestClose={closeOffersModal}
        statusBarTranslucent={true}
      >
        <View style={styles.offersModal__container}>
          <TouchableOpacity
            style={styles.offersModal__backdrop}
            activeOpacity={1}
            onPress={closeOffersModal}
          >
            <View style={styles.offersModal__content}>
              <View style={styles.offersModal__header}>
                <Text style={styles.offersModal__title}>Available Offers</Text>
                <TouchableOpacity
                  style={styles.offersModal__closeButton}
                  onPress={closeOffersModal}
                >
                  <Icon name="close" size={28} color={COLORS.text.primary} />
                </TouchableOpacity>
              </View>

              {offers.length > 0 ? (
                <FlatList
                  data={offers}
                  renderItem={renderOfferModalItem}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.offersModal__listContent}
                />
              ) : (
                <View style={styles.offersModal__noOffersContent}>
                  <Icon name="pricetag-outline" size={48} color={COLORS.divider} />
                  <Text style={styles.offersModal__noOffersText}>
                    No offers available
                  </Text>
                  <Text style={styles.offersModal__noOffersSubText}>
                    Check back later for exciting offers and discounts!
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Kitchen Conflict Modal */}
      <Modal
        visible={showKitchenConflictModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowKitchenConflictModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.conflictModal__overlay}>
          <View style={styles.conflictModal__card}>
            <View style={styles.conflictModal__header}>
              <Icon name="warning" size={32} color={COLORS.primary} />
              <Text style={styles.conflictModal__title}>Kitchen Conflict</Text>
            </View>
            <Text style={styles.conflictModal__text}>
              Your cart contains items from another kitchen. Would you like to
              reset your cart and start fresh with items from this kitchen?
            </Text>
            {pastKitchenDetails && (
              <View style={styles.conflictModal__kitchenInfo}>
                <Image
                  source={{
                    uri: pastKitchenDetails.image || PLACEHOLDER_RESTAURANT,
                  }}
                  style={styles.conflictModal__kitchenImage}
                  defaultSource={{ uri: PLACEHOLDER_RESTAURANT }}
                />
                <View style={styles.conflictModal__kitchenDetails}>
                  <Text
                    style={styles.conflictModal__kitchenName}
                    numberOfLines={1}
                  >
                    {pastKitchenDetails.name}
                  </Text>
                  <Text style={styles.conflictModal__kitchenItemCount}>
                    {pastKitchenDetails.itemCount} item
                    {pastKitchenDetails.itemCount !== 1 ? "s" : ""} in cart
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.conflictModal__buttonRow}>
              <TouchableOpacity
                style={[
                  styles.conflictModal__button,
                  styles.conflictModal__cancelButton,
                ]}
                onPress={() => {
                  setShowKitchenConflictModal(false);
                  setPendingCartAction(null);
                }}
              >
                <Text style={styles.conflictModal__buttonText}>
                  No, Keep Items
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.conflictModal__button,
                  styles.conflictModal__confirmButton,
                ]}
                onPress={handleClearCartAndProceed}
              >
                <Text style={styles.conflictModal__buttonText}>
                  Yes, Fresh Start
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Main Container Styles
  kitchenDetails__container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  kitchenDetails__loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
  },
  kitchenDetails__errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // Loading Styles
  kitchenDetails__loadingContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenDetails__loadingText: {
    marginTop: 16,
    fontSize: FONT.LG,
    color: COLORS.text.secondary,
  },

  // Error Styles
  kitchenDetails__errorContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenDetails__errorText: {
    marginTop: 16,
    fontSize: FONT.XL,
    fontWeight: "bold",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  kitchenDetails__errorSubText: {
    marginTop: 8,
    fontSize: FONT.SM,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 20,
  },
  kitchenDetails__retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  kitchenDetails__retryButtonText: {
    color: COLORS.text.light,
    fontSize: FONT.BASE,
    fontWeight: "600",
  },

  // Header Styles
  kitchenDetails__header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 5,
    backgroundColor: COLORS.background,
    overflow: "hidden",
  },
  kitchenDetails__headerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  kitchenDetails__headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  kitchenDetails__backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 44 : 20,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 11,
  },
  kitchenDetails__stickyTitle: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 28,
    left: 64,
    right: 16,
    color: COLORS.text.primary,
    fontSize: FONT.LG,
    fontWeight: "bold",
    zIndex: 11,
  },

  // Scroll View - FIXED to remove white space
  kitchenDetails__scrollView: {
    flex: 1,
  },
  kitchenDetails__scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 80 : 60, // Add padding for safe area
  },
  kitchenDetails__bottomPadding: {
    height: Platform.OS === 'ios' ? 100 : 80, // Extra padding at bottom
  },

  // Kitchen Card Styles
  kitchenDetails__kitchenCard: {
    backgroundColor: COLORS.background,
    marginTop: 230,
    marginBottom: 8, // Reduced from 10
    marginHorizontal: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: "hidden",
  },
  kitchenDetails__kitchenInfo: {
    padding: 16,
    paddingVertical: 14,
  },
  kitchenDetails__kitchenHeader: {
    marginBottom: 12,
  },
  kitchenDetails__nameRatingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  kitchenDetails__kitchenName: {
    fontSize: FONT.XL,
    fontWeight: "700",
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 8,
  },
  kitchenDetails__ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    justifyContent: "center",
  },
  kitchenDetails__ratingText: {
    color: COLORS.text.light,
    fontWeight: "700",
    marginLeft: 2,
    fontSize: FONT.XS,
  },
  kitchenDetails__addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  kitchenDetails__kitchenAddress: {
    fontSize: FONT.SM,
    color: COLORS.text.secondary,
    fontWeight: "500",
    flex: 1,
  },
  kitchenDetails__detailsContainer: {
    gap: 8,
  },
  kitchenDetails__detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kitchenDetails__detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  kitchenDetails__detailText: {
    fontSize: FONT.XS,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  kitchenDetails__dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.border,
  },
  kitchenDetails__statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  kitchenDetails__statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kitchenDetails__openIndicator: {
    backgroundColor: COLORS.success,
  },
  kitchenDetails__closedIndicator: {
    backgroundColor: COLORS.error,
  },
  kitchenDetails__kitchenStatus: {
    fontSize: FONT.XS,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  kitchenDetails__openText: {
    color: COLORS.success,
  },
  kitchenDetails__closedText: {
    color: COLORS.error,
  },
  kitchenDetails__timingRow: {
    marginTop: 2,
  },
  kitchenDetails__kitchenTimings: {
    fontSize: FONT.XS,
    color: COLORS.text.disabled,
    fontWeight: "500",
  },

  // UPDATED Offers Styles - More Compact
  kitchenDetails__offersContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
    marginBottom: 8, // Reduced from border
  },
  kitchenDetails__noOffersContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderStyle: "dashed",
  },
  kitchenDetails__noOffersText: {
    fontSize: FONT.SM,
    fontWeight: "500",
    color: COLORS.text.disabled,
    textAlign: "center",
    marginLeft: 8,
  },
  kitchenDetails__offersHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  kitchenDetails__offersTitle: {
    fontSize: FONT.LG,
    fontWeight: "bold",
    color: COLORS.text.primary,
    flex: 1,
  },
  kitchenDetails__viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  kitchenDetails__viewAllText: {
    color: COLORS.primary,
    fontSize: FONT.SM,
    fontWeight: "500",
    marginRight: 4,
  },
  kitchenDetails__offerItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    marginRight: 12,
    width: width - 32, // Adjusted width
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kitchenDetails__offerItemActive: {
    backgroundColor: "#fff8e6",
    borderColor: "#ffd166",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kitchenDetails__offerIcon: {
    marginRight: 10,
    backgroundColor: "#fff0e0",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenDetails__offerContent: {
    flex: 1,
    marginRight: 8,
  },
  kitchenDetails__offerTitle: {
    fontSize: FONT.SM,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  kitchenDetails__offerDescription: {
    fontSize: FONT.XS,
    color: COLORS.text.secondary,
    lineHeight: 14,
  },
  kitchenDetails__offerCount: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 40,
    alignItems: "center",
  },
  kitchenDetails__offerCountText: {
    color: COLORS.text.light,
    fontSize: FONT.XS,
    fontWeight: "bold",
  },
  kitchenDetails__offerPagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  kitchenDetails__paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  kitchenDetails__paginationDotActive: {
    backgroundColor: COLORS.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Filters Styles
  kitchenDetails__filtersContainer: {
    backgroundColor: COLORS.background,
    marginBottom: 8, // Reduced from border
  },
  kitchenDetails__filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  kitchenDetails__filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kitchenDetails__filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  kitchenDetails__filterText: {
    fontSize: FONT.SM,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  kitchenDetails__filterTextActive: {
    color: COLORS.text.light,
  },

  // Closed Message Styles
  kitchenDetails__closedMessageContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff8e6",
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffd166",
  },
  kitchenDetails__closedMessageText: {
    marginLeft: 10,
    fontSize: FONT.SM,
    color: COLORS.primary,
    flex: 1,
    lineHeight: 16,
  },

  // Menu Container Styles - FIXED to remove bottom white space
  kitchenDetails__menuContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20, // Reduced padding
    backgroundColor: COLORS.background,
    flex: 1,
  },
  kitchenDetails__noItemsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  kitchenDetails__noItemsText: {
    marginTop: 12,
    fontSize: FONT.LG,
    color: COLORS.text.disabled,
    textAlign: "center",
  },

  // Menu Section Styles
  kitchenDetails__menuSection: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  kitchenDetails__sectionHeader: {
    padding: 14,
    backgroundColor: COLORS.surface,
  },
  kitchenDetails__sectionHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kitchenDetails__sectionTitle: {
    fontSize: FONT.LG,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  kitchenDetails__sectionContent: {
    padding: 14,
    paddingTop: 0,
  },

  // UPDATED Menu Item Styles - Optimized Layout
  kitchenDetails__menuItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    alignItems: "flex-start",
  },
  kitchenDetails__menuItemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
    position: "relative",
  },
  kitchenDetails__menuItemImage: {
    width: "100%",
    height: "100%",
  },
  kitchenDetails__vegIndicatorContainer: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 4,
    padding: 2,
  },
  kitchenDetails__vegIndicator: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenDetails__nonVegIndicator: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenDetails__vegInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  kitchenDetails__menuItemContent: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: 80,
  },
  kitchenDetails__menuItemName: {
    fontSize: FONT.SM,
    fontWeight: "600",
    color: COLORS.text.primary,
    lineHeight: 18,
    marginBottom: 4,
  },
  kitchenDetails__menuItemDescription: {
    fontSize: FONT.XS,
    color: COLORS.text.secondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  kitchenDetails__priceDiscountContainer: {
    marginBottom: 8,
  },
  kitchenDetails__discountedPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  kitchenDetails__menuItemPrice: {
    fontSize: FONT.LG,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  kitchenDetails__discountedPrice: {
    fontSize: FONT.LG,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  kitchenDetails__originalPrice: {
    fontSize: FONT.SM,
    color: COLORS.text.disabled,
    textDecorationLine: "line-through",
  },
  kitchenDetails__discountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kitchenDetails__discountText: {
    color: COLORS.text.light,
    fontSize: FONT.XS,
    fontWeight: "bold",
  },
  kitchenDetails__addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    minWidth: 60,
  },
  kitchenDetails__addButtonLoading: {
    opacity: 0.8,
  },
  kitchenDetails__addButtonText: {
    color: COLORS.text.light,
    fontSize: FONT.XS,
    fontWeight: "bold",
  },
  kitchenDetails__addButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    minWidth: 80,
  },
  kitchenDetails__addButtonDisabledText: {
    color: COLORS.text.light,
    fontSize: FONT.XS,
    fontWeight: "bold",
  },
  kitchenDetails__quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    minWidth: 80,
    justifyContent: "space-between",
  },
  kitchenDetails__quantityButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.text.light,
    alignItems: "center",
    justifyContent: "center",
  },
  kitchenDetails__quantityText: {
    color: COLORS.text.light,
    fontWeight: "bold",
    fontSize: FONT.SM,
    minWidth: 20,
    textAlign: "center",
  },

  // Cart Summary Styles - FIXED positioning
  kitchenDetails__cartSummaryContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  kitchenDetails__cartSummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kitchenDetails__cartSummaryKitchenInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  kitchenDetails__cartSummaryKitchenImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  kitchenDetails__cartSummaryKitchenText: {
    flex: 1,
  },
  kitchenDetails__cartSummaryKitchenName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  kitchenDetails__cartSummaryItemCount: {
    fontSize: FONT.XS,
    color: COLORS.text.secondary,
  },
  kitchenDetails__cartSummaryMiniCartBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  kitchenDetails__cartSummaryMiniCartContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  kitchenDetails__cartSummaryViewCartText: {
    color: COLORS.text.light,
    fontSize: FONT.SM,
    fontWeight: "600",
    marginRight: 8,
  },
  kitchenDetails__cartSummaryCartCountBadge: {
    backgroundColor: COLORS.text.light,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  kitchenDetails__cartSummaryMiniCartCount: {
    color: COLORS.primary,
    fontSize: FONT.XS,
    fontWeight: "bold",
  },

  // Item Detail Modal Styles
  modal__container: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  modal__content: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "80%",
  },
  modal__fixedContent: {
    flex: 1,
  },
  modal__imageContainer: {
    position: "relative",
    height: 250,
  },
  modal__image: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modal__imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modal__closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Scrollable Content Area
  modal__scrollContent: {
    flex: 1,
  },
  modal__scrollView: {
    flex: 1,
  },
  modal__body: {
    padding: 20,
    paddingBottom: 0, // Remove bottom padding since fixed section is separate
  },
  modal__titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  modal__vegIndicatorContainer: {
    marginTop: 2,
  },
  modal__vegIndicator: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  modal__veg: {
    borderColor: COLORS.success,
  },
  modal__nonVeg: {
    borderColor: COLORS.error,
  },
  modal__vegInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  modal__itemName: {
    fontSize: FONT.XL,
    fontWeight: "700",
    color: COLORS.text.primary,
    flex: 1,
    lineHeight: 28,
  },
  modal__itemDescription: {
    fontSize: FONT.BASE,
    color: COLORS.text.secondary,
    lineHeight: 22,
    marginBottom: 20,
  },

  // Fixed Bottom Section
  modal__fixedBottom: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  modal__actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modal__priceSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  modal__currentPrice: {
    fontSize: FONT.XXL,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  modal__originalPrice: {
    fontSize: FONT.LG,
    color: COLORS.text.disabled,
    textDecorationLine: "line-through",
  },
  modal__discountBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modal__discountText: {
    color: COLORS.text.light,
    fontSize: FONT.XS,
    fontWeight: "700",
  },

  // Action Buttons
  modal__actionButtons: {
    flexShrink: 0,
  },
  modal__addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 52,
    minWidth: 120,
  },
  modal__addButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modal__addButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
    shadowColor: "transparent",
    elevation: 0,
  },
  modal__addButtonText: {
    color: COLORS.text.light,
    fontSize: FONT.LG,
    fontWeight: "700",
  },

  // Quantity Controls
  modal__quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 52,
    gap: 12,
    minWidth: 140,
    justifyContent: "center",
  },
  modal__quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modal__quantityText: {
    fontSize: FONT.LG,
    fontWeight: "700",
    color: COLORS.text.primary,
    minWidth: 30,
    textAlign: "center",
  },

  modal__unavailableMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    gap: 8,
  },
  modal__unavailableMessageText: {
    color: COLORS.error,
    fontWeight: "500",
    fontSize: FONT.SM,
    flex: 1,
  },

  modal__loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  modal__loadingText: {
    marginTop: 12,
    fontSize: FONT.SM,
    color: COLORS.text.secondary,
  },

  // Offers Modal Styles
  offersModal__container: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  offersModal__backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  offersModal__content: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  offersModal__header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  offersModal__title: {
    fontSize: FONT.LG,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  offersModal__closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  offersModal__listContent: {
    paddingBottom: 20,
  },
  offersModal__item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  offersModal__icon: {
    marginRight: 12,
    marginTop: 2,
  },
  offersModal__itemContent: {
    flex: 1,
  },
  offersModal__itemTitle: {
    fontSize: FONT.BASE,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  offersModal__itemDescription: {
    fontSize: FONT.SM,
    color: COLORS.text.secondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  offersModal__codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offersModal__codeText: {
    fontSize: FONT.SM,
    color: COLORS.primary,
    fontWeight: "500",
  },
  offersModal__copyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  offersModal__copyButtonText: {
    color: COLORS.text.light,
    fontSize: FONT.XS,
    fontWeight: "bold",
  },
  offersModal__noOffersContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  offersModal__noOffersText: {
    fontSize: FONT.BASE,
    fontWeight: "600",
    color: COLORS.text.disabled,
    marginTop: 12,
    marginBottom: 6,
  },
  offersModal__noOffersSubText: {
    fontSize: FONT.SM,
    color: COLORS.border,
    textAlign: "center",
    lineHeight: 18,
  },

  // Kitchen Conflict Modal
  conflictModal__overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  conflictModal__card: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 320,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  conflictModal__header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  conflictModal__title: {
    fontSize: FONT.LG,
    fontWeight: "bold",
    color: COLORS.text.primary,
    flex: 1,
  },
  conflictModal__text: {
    fontSize: FONT.SM,
    marginBottom: 12,
    textAlign: "center",
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  conflictModal__kitchenInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  conflictModal__kitchenImage: {
    width: 35,
    height: 35,
    borderRadius: 6,
    marginRight: 10,
  },
  conflictModal__kitchenDetails: {
    flex: 1,
  },
  conflictModal__kitchenName: {
    fontSize: FONT.SM,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  conflictModal__kitchenItemCount: {
    fontSize: FONT.XS,
    color: COLORS.text.secondary,
  },
  conflictModal__buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  conflictModal__button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  conflictModal__cancelButton: {
    backgroundColor: COLORS.border,
    marginRight: 8,
  },
  conflictModal__confirmButton: {
    backgroundColor: COLORS.primary,
    marginLeft: 8,
  },
  conflictModal__buttonText: {
    color: COLORS.text.light,
    fontWeight: "600",
    fontSize: FONT.SM,
  },
});

export default HomeKitchenDetails;