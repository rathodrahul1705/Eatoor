// EatmartViewCart.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  FlatList,
  Dimensions,
  Animated,
  Modal,
  ActivityIndicator,
  Vibration,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

// Define navigation types
type RootStackParamList = {
  EatmartTrackOrder: { orderId: string; transactionId: string };
  Home: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Dummy image URLs for different categories
const DUMMY_IMAGES = {
  dal: 'https://images.unsplash.com/photo-1585992294030-3c0c1e3b5b5e?w=400&h=400&fit=crop',
  milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=400&fit=crop',
  oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&h=400&fit=crop',
  atta: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop',
  ghee: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?w=400&h=400&fit=crop',
  noodles: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&h=400&fit=crop',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop',
  pepsi: 'https://images.unsplash.com/photo-1629203851122-3726ecdfcb81?w=400&h=400&fit=crop',
  biscuits: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&h=400&fit=crop',
  chips: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&h=400&fit=crop',
  soap: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=400&fit=crop',
  shampoo: 'https://images.unsplash.com/photo-1631730359585-38a4935cbec4?w=400&h=400&fit=crop',
  success: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=400&h=400&fit=crop',
  failed: 'https://images.unsplash.com/photo-1617038260898-89e142f92a5c?w=400&h=400&fit=crop',
};

// Types
interface CartItem {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  quantity: number;
  image: string;
  unit: string;
  store: string;
  weight: string;
  discount: string;
  category: string;
}

interface SuggestedItem {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  weight: string;
  discount: string;
  category: string;
}

// Initial cart items
const INITIAL_CART_ITEMS: CartItem[] = [
  {
    id: 1,
    name: 'Tata Sampann Toor Dal',
    price: 120,
    originalPrice: 132,
    quantity: 2,
    image: DUMMY_IMAGES.dal,
    unit: 'kg',
    store: 'Tata Products',
    weight: '1 kg',
    discount: '5% off',
    category: 'groceries',
  },
  {
    id: 2,
    name: 'Amul Gold Full Cream Milk',
    price: 68,
    originalPrice: 75,
    quantity: 2,
    image: DUMMY_IMAGES.milk,
    unit: 'litre',
    store: 'Amul Dairy',
    weight: '1 litre',
    discount: '',
    category: 'dairy',
  },
  {
    id: 3,
    name: 'Fortune Sunflower Oil',
    price: 195,
    originalPrice: 216,
    quantity: 1,
    image: DUMMY_IMAGES.oil,
    unit: 'litre',
    store: 'Fortune',
    weight: '1 litre',
    discount: '10% off',
    category: 'oils',
  },
  {
    id: 4,
    name: 'Aashirvaad Whole Wheat Atta',
    price: 325,
    originalPrice: 353,
    quantity: 1,
    image: DUMMY_IMAGES.atta,
    unit: 'kg',
    store: 'Aashirvaad',
    weight: '5 kg',
    discount: '8% off',
    category: 'groceries',
  },
];

// Initial suggested items
const INITIAL_SUGGESTED_ITEMS: SuggestedItem[] = [
  {
    id: 101,
    name: 'Patanjali Ghee',
    price: 450,
    originalPrice: 495,
    image: DUMMY_IMAGES.ghee,
    weight: '1 kg',
    discount: '12% off',
    category: 'dairy',
  },
  {
    id: 102,
    name: 'Maggi Noodles',
    price: 70,
    originalPrice: 75,
    image: DUMMY_IMAGES.noodles,
    weight: 'Pack of 4',
    discount: '',
    category: 'snacks',
  },
  {
    id: 103,
    name: 'Britannia Bread',
    price: 45,
    originalPrice: 48,
    image: DUMMY_IMAGES.bread,
    weight: '400 g',
    discount: '5% off',
    category: 'bakery',
  },
  {
    id: 104,
    name: 'Pepsi Black',
    price: 40,
    originalPrice: 45,
    image: DUMMY_IMAGES.pepsi,
    weight: '750 ml',
    discount: '',
    category: 'beverages',
  },
  {
    id: 105,
    name: 'Oreo Biscuits',
    price: 35,
    originalPrice: 40,
    image: DUMMY_IMAGES.biscuits,
    weight: '120 g',
    discount: '12% off',
    category: 'snacks',
  },
  {
    id: 106,
    name: 'Lays Chips',
    price: 20,
    originalPrice: 20,
    image: DUMMY_IMAGES.chips,
    weight: '52 g',
    discount: '',
    category: 'snacks',
  },
  {
    id: 107,
    name: 'Dove Soap',
    price: 85,
    originalPrice: 95,
    image: DUMMY_IMAGES.soap,
    weight: '100 g',
    discount: '10% off',
    category: 'personal care',
  },
  {
    id: 108,
    name: 'Clinic Plus Shampoo',
    price: 65,
    originalPrice: 70,
    image: DUMMY_IMAGES.shampoo,
    weight: '200 ml',
    discount: '7% off',
    category: 'personal care',
  },
];

// Payment simulation configurations
const PAYMENT_CONFIG = {
  SUCCESS_RATE: 0.85, // 85% success rate for demo
  PROCESSING_TIME: 2000, // 2 seconds processing time
};

const EatmartViewCart = () => {
  const navigation = useNavigation<NavigationProp>();
  
  // State management
  const [cartItems, setCartItems] = useState<CartItem[]>(INITIAL_CART_ITEMS);
  const [suggestedItems, setSuggestedItems] = useState<SuggestedItem[]>(INITIAL_SUGGESTED_ITEMS);
  const [promoCode, setPromoCode] = useState('');
  const [isPromoApplied, setIsPromoApplied] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('online');
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  
  // Payment processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [orderId, setOrderId] = useState('');

  const [address] = useState({
    type: 'Home',
    fullAddress: 'B-502, Sunshine Apartments, Andheri East, Mumbai - 400093',
  });

  const paymentMethods = [
    { id: 'online', label: 'Online', icon: 'card-outline' },
    { id: 'cod', label: 'Cash on Delivery', icon: 'cash-outline' },
    { id: 'upi', label: 'UPI', icon: 'phone-portrait-outline' },
  ];

  // Generate random transaction ID
  const generateTransactionId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'TXN';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate random order ID
  const generateOrderId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'ORD';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Initiate payment process
  const initiatePayment = () => {
    Vibration.vibrate(50); // Haptic feedback
    setIsProcessing(true);
    setPaymentStatus('processing');
    setShowPaymentModal(true);
    
    // Simulate payment processing
    setTimeout(() => {
      processPayment();
    }, PAYMENT_CONFIG.PROCESSING_TIME);
  };

  // Process payment (simulated)
  const processPayment = () => {
    const isSuccess = Math.random() < PAYMENT_CONFIG.SUCCESS_RATE;
    const newTransactionId = generateTransactionId();
    const newOrderId = generateOrderId();
    setTransactionId(newTransactionId);
    setOrderId(newOrderId);
    
    if (isSuccess) {
      // Payment successful
      setPaymentStatus('success');
      setPaymentMessage('Your payment has been processed successfully!');
      Vibration.vibrate([0, 100, 50, 100]); // Success vibration pattern
      
      // Clear cart after successful payment
      setCartItems([]);
    } else {
      // Payment failed
      setPaymentStatus('failed');
      setPaymentMessage('Payment failed. Please try again or use another method.');
      Vibration.vibrate([0, 300, 100, 300]); // Error vibration pattern
    }
    
    setIsProcessing(false);
  };

  // Handle successful payment - navigate to track order
  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    
    // Navigate to track order page with order details
    navigation.navigate('EatmartTrackOrder', {
      orderId: orderId,
      transactionId: transactionId,
    });
    
    // Reset payment states
    setPaymentStatus('idle');
  };

  // Handle payment retry
  const handleRetryPayment = () => {
    setShowPaymentModal(false);
    setPaymentStatus('idle');
    // Optionally show retry message
    Alert.alert('Retry Payment', 'Please try payment again.');
  };

  // Handle payment cancellation
  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    setPaymentStatus('idle');
    setTransactionId('');
    setPaymentMessage('');
  };

  // Effect to update suggested items based on cart
  useEffect(() => {
    updateSuggestionsBasedOnCart();
  }, [cartItems]);

  const updateSuggestionsBasedOnCart = () => {
    // Get categories of items in cart
    const cartCategories = [...new Set(cartItems.map(item => item.category))];
    
    // Filter out items that are already in cart
    const cartItemIds = cartItems.map(item => item.id);
    let filteredSuggestions = INITIAL_SUGGESTED_ITEMS.filter(
      item => !cartItemIds.includes(item.id)
    );

    // Sort suggestions: prioritize items from same categories as cart
    filteredSuggestions.sort((a, b) => {
      const aInCartCategory = cartCategories.includes(a.category);
      const bInCartCategory = cartCategories.includes(b.category);
      
      if (aInCartCategory && !bInCartCategory) return -1;
      if (!aInCartCategory && bInCartCategory) return 1;
      return 0;
    });

    // Limit to 6 suggestions max
    setSuggestedItems(filteredSuggestions.slice(0, 6));
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const updateQuantity = (id: number, action: 'increase' | 'decrease') => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id
          ? {
              ...item,
              quantity: action === 'increase' ? item.quantity + 1 : Math.max(1, item.quantity - 1),
            }
          : item
      )
    );
  };

  const removeItem = (id: number) => {
    // Find the removed item
    const removedItem = cartItems.find(item => item.id === id);
    
    if (removedItem) {
      // Remove from cart
      setCartItems(prevItems => prevItems.filter(item => item.id !== id));
      
      // Check if this item should be added back to suggestions
      const isOriginalSuggestedItem = INITIAL_SUGGESTED_ITEMS.some(item => item.id === id);
      
      if (isOriginalSuggestedItem) {
        // Find the original suggested item
        const originalItem = INITIAL_SUGGESTED_ITEMS.find(item => item.id === id);
        
        if (originalItem && !suggestedItems.some(item => item.id === id)) {
          // Add back to suggestions
          setSuggestedItems(prevItems => {
            const newSuggestions = [...prevItems, originalItem];
            // Keep suggestions limited to 6 items
            return newSuggestions.slice(0, 6);
          });
        }
      } else {
        // For custom items (not in original suggestions), create a suggestion
        const newSuggestion: SuggestedItem = {
          id: removedItem.id,
          name: removedItem.name,
          price: removedItem.price,
          originalPrice: removedItem.originalPrice,
          image: removedItem.image,
          weight: removedItem.weight,
          discount: removedItem.discount,
          category: removedItem.category || 'other',
        };
        
        if (!suggestedItems.some(item => item.id === id)) {
          setSuggestedItems(prevItems => {
            const newSuggestions = [...prevItems, newSuggestion];
            return newSuggestions.slice(0, 6);
          });
        }
      }
    }
  };

  const addSuggestedItemToCart = (suggestedItem: SuggestedItem) => {
    // Check if item already exists in cart
    const existingItem = cartItems.find(item => item.id === suggestedItem.id);
    
    if (existingItem) {
      // If exists, increase quantity
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === suggestedItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      // If doesn't exist, add new item
      const newCartItem: CartItem = {
        id: suggestedItem.id,
        name: suggestedItem.name,
        price: suggestedItem.price,
        originalPrice: suggestedItem.originalPrice,
        quantity: 1,
        image: suggestedItem.image,
        unit: 'pc',
        store: 'Various',
        weight: suggestedItem.weight,
        discount: suggestedItem.discount,
        category: suggestedItem.category || 'other',
      };
      setCartItems(prevItems => [...prevItems, newCartItem]);
      
      // Remove from suggestions
      setSuggestedItems(prevItems => 
        prevItems.filter(item => item.id !== suggestedItem.id)
      );
    }
  };

  const applyPromoCode = () => {
    if (promoCode.toLowerCase() === 'eatmart20') {
      setIsPromoApplied(true);
      setShowPaymentDropdown(false);
    }
  };

  const calculateSubtotal = (): number => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateOriginalTotal = (): number => {
    return cartItems.reduce((sum, item) => sum + (item.originalPrice || item.price) * item.quantity, 0);
  };

  const calculateDiscount = (): number => {
    return isPromoApplied ? calculateSubtotal() * 0.2 : 0;
  };

  const calculateDeliveryFee = (): number => {
    return calculateSubtotal() > 500 ? 0 : 40;
  };

  const calculateTotal = (): number => {
    return calculateSubtotal() - calculateDiscount() + calculateDeliveryFee();
  };

  const calculateSavings = (): number => {
    return calculateOriginalTotal() - calculateSubtotal() + calculateDiscount();
  };

  const renderSuggestedItem = ({ item, index }: { item: SuggestedItem; index: number }) => (
    <TouchableOpacity 
      style={[
        styles.suggestedItemCard,
        { marginLeft: index === 0 ? 20 : 12 }
      ]}
      activeOpacity={0.7}
      onPress={() => {
        // Navigate to product details
        console.log('Suggested item pressed:', item.id);
      }}
    >
      <Image source={{ uri: item.image }} style={styles.suggestedItemImage} />
      <View style={styles.suggestedItemBadge}>
        <Text style={styles.suggestedItemBadgeText}>✨ RECOMMENDED</Text>
      </View>
      <View style={styles.suggestedItemDetails}>
        <Text style={styles.suggestedItemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.suggestedItemWeight}>{item.weight}</Text>
        <View style={styles.suggestedItemPriceRow}>
          <Text style={styles.suggestedItemPrice}>₹{item.price}</Text>
          {item.originalPrice && item.originalPrice > item.price && (
            <Text style={styles.suggestedItemOriginalPrice}>₹{item.originalPrice}</Text>
          )}
          {item.discount ? (
            <Text style={styles.suggestedItemDiscount}>{item.discount}</Text>
          ) : null}
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => addSuggestedItemToCart(item)}
        >
          <View style={styles.addButtonBackground}>
            <Text style={styles.addButtonText}>ADD +</Text>
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const selectPaymentMethod = (methodId: string) => {
    setSelectedPayment(methodId);
    setShowPaymentDropdown(false);
  };

  // Payment Modal Component
  const renderPaymentModal = () => (
    <Modal
      visible={showPaymentModal}
      transparent
      animationType="slide"
      onRequestClose={handleCancelPayment}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {paymentStatus === 'processing' && (
            <>
              <ActivityIndicator size="large" color="#E55C18" />
              <Text style={styles.modalTitle}>Processing Payment</Text>
              <Text style={styles.modalMessage}>
                Please wait while we process your payment...
              </Text>
              <View style={styles.processingAnimation}>
                <Animated.View style={styles.processingDot} />
                <Animated.View style={[styles.processingDot, styles.processingDotDelay1]} />
                <Animated.View style={[styles.processingDot, styles.processingDotDelay2]} />
              </View>
            </>
          )}

          {paymentStatus === 'success' && (
            <>
              <View style={styles.successIcon}>
                <Icon name="checkmark-circle" size={80} color="#10B981" />
              </View>
              <Text style={styles.modalTitle}>Payment Successful! 🎉</Text>
              <Text style={styles.modalMessage}>{paymentMessage}</Text>
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionLabel}>Transaction ID:</Text>
                <Text style={styles.transactionValue}>{transactionId}</Text>
                <Text style={[styles.transactionLabel, { marginTop: 8 }]}>Order ID:</Text>
                <Text style={styles.transactionValue}>{orderId}</Text>
              </View>
              <View style={styles.modalAmount}>
                <Text style={styles.modalAmountLabel}>Amount Paid:</Text>
                <Text style={styles.modalAmountValue}>₹{calculateTotal().toFixed(0)}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handlePaymentSuccess}
              >
                <Text style={styles.modalButtonText}>Track Order</Text>
              </TouchableOpacity>
            </>
          )}

          {paymentStatus === 'failed' && (
            <>
              <View style={styles.failedIcon}>
                <Icon name="close-circle" size={80} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Payment Failed</Text>
              <Text style={styles.modalMessage}>{paymentMessage}</Text>
              <Text style={styles.failedSuggestion}>
                This could be due to insufficient balance or network issues.
              </Text>
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={handleCancelPayment}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleRetryPayment}
                >
                  <Text style={styles.modalButtonText}>Retry Payment</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // Regular Pay Button (used for all platforms)
  const renderPayButton = () => {
    return (
      <TouchableOpacity 
        style={styles.payButton}
        activeOpacity={0.8}
        onPress={cartItems.length > 0 ? initiatePayment : undefined}
        disabled={cartItems.length === 0}
      >
        <View style={[
          styles.payButtonBackground,
          cartItems.length === 0 && styles.payButtonDisabled
        ]}>
          <Text style={styles.payButtonText}>
            {cartItems.length > 0 
              ? `Pay ₹${calculateTotal().toFixed(0)}` 
              : 'Cart is Empty'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.locationContainer}
            onPress={() => {
              console.log('Address pressed');
            }}
            activeOpacity={0.7}
          >
            <Icon name="location" size={16} color="#E55C18" />
            <View style={styles.addressWrapper}>
              <Text style={styles.addressType}>{address.type}</Text>
              <Text style={styles.addressText} numberOfLines={1}>
                {address.fullAddress}
              </Text>
            </View>
            <Icon name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
          
          <View style={styles.placeholderRight} />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Delivery Time Card */}
        <View style={styles.timeCard}>
          <View style={styles.timeCardLeft}>
            <View style={styles.timeIconContainer}>
              <Icon name="bicycle" size={24} color="#E55C18" />
            </View>
            <View>
              <Text style={styles.timeLabel}>Delivery in</Text>
              <Text style={styles.timeValue}>25-35 mins</Text>
            </View>
          </View>
          <View style={styles.timeCardRight}>
            <Text style={styles.freeDeliveryText}>FREE above ₹500</Text>
          </View>
        </View>

        {/* Cart Items Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Cart</Text>
            <Text style={styles.sectionSubtitle}>{cartItems.length} items</Text>
          </View>
        </View>

        {cartItems.map((item) => (
          <View key={item.id} style={styles.cartItemCard}>
            <TouchableOpacity 
              onPress={() => {
                console.log('Product pressed:', item.id);
              }}
              style={styles.itemImageContainer}
            >
              <Image source={{ uri: item.image }} style={styles.itemImage} />
              {item.discount ? (
                <View style={styles.itemDiscountBadge}>
                  <Text style={styles.itemDiscountBadgeText}>{item.discount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            
            <View style={styles.itemDetails}>
              <View style={styles.itemHeader}>
                <TouchableOpacity 
                  onPress={() => {
                    console.log('Product name pressed:', item.id);
                  }}
                  style={styles.itemNameContainer}
                >
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemWeight}>{item.weight}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => removeItem(item.id)}
                  style={styles.removeButton}
                >
                  <Icon name="close" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.itemFooter}>
                <View style={styles.priceContainer}>
                  <View style={styles.priceRow}>
                    <Text style={styles.itemPrice}>₹{item.price}</Text>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <Text style={styles.itemOriginalPrice}>₹{item.originalPrice}</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, 'decrease')}
                  >
                    <Icon name="remove" size={14} color="#E55C18" />
                  </TouchableOpacity>
                  
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, 'increase')}
                  >
                    <Icon name="add" size={14} color="#E55C18" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* Promo Code */}
        <View style={styles.promoCard}>
          <View style={styles.promoHeader}>
            <Icon name="pricetag" size={20} color="#E55C18" />
            <Text style={styles.promoTitle}>Have a promo code?</Text>
          </View>
          
          <View style={styles.promoInputContainer}>
            <TextInput
              style={styles.promoInput}
              placeholder="Enter promo code"
              placeholderTextColor="#9CA3AF"
              value={promoCode}
              onChangeText={setPromoCode}
            />
            <TouchableOpacity 
              style={[
                styles.applyButton,
                promoCode.length > 0 && styles.applyButtonActive
              ]}
              onPress={applyPromoCode}
              disabled={promoCode.length === 0}
            >
              <View style={[
                styles.applyButtonBackground,
                promoCode.length > 0 ? styles.applyButtonActive : styles.applyButtonInactive
              ]}>
                <Text style={[
                  styles.applyButtonText,
                  promoCode.length > 0 && styles.applyButtonTextActive
                ]}>Apply</Text>
              </View>
            </TouchableOpacity>
          </View>

          {isPromoApplied && (
            <View style={styles.promoApplied}>
              <Icon name="checkmark-circle" size={18} color="#10B981" />
              <Text style={styles.promoAppliedText}>20% discount applied!</Text>
            </View>
          )}
        </View>

        {/* Bill Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billTitle}>Bill Summary</Text>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Subtotal</Text>
            <Text style={styles.billValue}>₹{calculateSubtotal().toFixed(0)}</Text>
          </View>
          
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={[styles.billValue, calculateDeliveryFee() === 0 && styles.freeText]}>
              {calculateDeliveryFee() === 0 ? 'FREE' : `₹${calculateDeliveryFee()}`}
            </Text>
          </View>
          
          {isPromoApplied && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Promo Discount</Text>
              <Text style={[styles.billValue, styles.discountText]}>
                -₹{calculateDiscount().toFixed(0)}
              </Text>
            </View>
          )}
          
          <View style={styles.billDivider} />
          
          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{calculateTotal().toFixed(0)}</Text>
          </View>
          
          {calculateSavings() > 0 && (
            <View style={styles.savingsContainer}>
              <Icon name="wallet" size={16} color="#10B981" />
              <Text style={styles.savingsText}>
                You saved ₹{calculateSavings().toFixed(0)}! 🎉
              </Text>
            </View>
          )}
        </View>

        {/* Suggested Items - Only show if there are suggestions */}
        {suggestedItems.length > 0 && (
          <View style={styles.suggestedSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>You might also like</Text>
                <Text style={styles.sectionSubtitle}>Based on your cart</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  console.log('View all suggested items');
                }}
              >
                <Text style={styles.viewAllText}>View All →</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={suggestedItems}
              renderItem={renderSuggestedItem}
              keyExtractor={item => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestedList}
            />
          </View>
        )}

        {/* Delivery Instructions */}
        <TouchableOpacity 
          style={styles.instructionCard}
          onPress={() => {
            console.log('Add delivery instructions');
          }}
          activeOpacity={0.7}
        >
          <View style={styles.instructionLeft}>
            <View style={styles.instructionIcon}>
              <Icon name="create" size={20} color="#E55C18" />
            </View>
            <View>
              <Text style={styles.instructionTitle}>Add delivery instructions</Text>
              <Text style={styles.instructionSubtitle}>Special requests for delivery</Text>
            </View>
          </View>
          <Icon name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Payment Section */}
      <View style={styles.bottomBar}>
        {/* Payment Method Dropdown */}
        <TouchableOpacity 
          style={styles.paymentSelector}
          onPress={() => setShowPaymentDropdown(!showPaymentDropdown)}
          activeOpacity={0.7}
        >
          <View style={styles.paymentSelectorLeft}>
            <View style={[styles.paymentIconContainer, { backgroundColor: '#E55C1815' }]}>
              <Icon 
                name={selectedPayment === 'online' ? 'card' : selectedPayment === 'cod' ? 'cash' : 'phone-portrait'} 
                size={18} 
                color="#E55C18" 
              />
            </View>
            <View>
              <Text style={styles.paymentSelectorLabel}>Pay via</Text>
              <Text style={styles.paymentSelectorValue}>
                {paymentMethods.find(m => m.id === selectedPayment)?.label}
              </Text>
            </View>
          </View>
          <Icon name={showPaymentDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Payment Dropdown */}
        {showPaymentDropdown && (
          <View style={styles.paymentDropdown}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  selectedPayment === method.id && styles.paymentOptionSelected
                ]}
                onPress={() => selectPaymentMethod(method.id)}
              >
                <View style={[styles.paymentOptionIcon, { backgroundColor: '#E55C1810' }]}>
                  <Icon name={method.icon} size={18} color="#E55C18" />
                </View>
                <Text style={[
                  styles.paymentOptionText,
                  selectedPayment === method.id && styles.paymentOptionTextSelected
                ]}>{method.label}</Text>
                {selectedPayment === method.id && (
                  <Icon name="checkmark-circle" size={18} color="#E55C18" style={styles.paymentOptionCheck} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Regular Pay Button for all platforms */}
        {renderPayButton()}
      </View>

      {/* Payment Modal */}
      {renderPaymentModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 30,
  },
  addressWrapper: {
    flex: 1,
    marginLeft: 6,
  },
  addressType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  addressText: {
    fontSize: 10,
    color: '#6B7280',
  },
  placeholderRight: {
    width: 40,
    height: 40,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  timeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E55C1815',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  timeLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  timeCardRight: {
    backgroundColor: '#E55C1815',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  freeDeliveryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E55C18',
  },
  scrollContent: {
    paddingBottom: 240,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  cartItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  itemDiscountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  itemDiscountBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 4,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  itemWeight: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  priceContainer: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginRight: 6,
  },
  itemOriginalPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 2,
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginHorizontal: 8,
  },
  promoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  promoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promoInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#1F2937',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  applyButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  applyButtonBackground: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonActive: {
    backgroundColor: '#E55C18',
  },
  applyButtonInactive: {
    backgroundColor: '#E5E7EB',
  },
  applyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  applyButtonTextActive: {
    color: '#FFFFFF',
  },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  promoAppliedText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  billCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  billValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  freeText: {
    color: '#10B981',
  },
  discountText: {
    color: '#10B981',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E55C18',
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#10B98110',
    borderRadius: 12,
  },
  savingsText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  suggestedSection: {
    marginTop: 20,
  },
  viewAllText: {
    fontSize: 13,
    color: '#E55C18',
    fontWeight: '600',
  },
  suggestedList: {
    paddingRight: 20,
    paddingVertical: 8,
  },
  suggestedItemCard: {
    backgroundColor: '#FFFFFF',
    width: 140,
    marginRight: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  suggestedItemImage: {
    width: '100%',
    height: 100,
  },
  suggestedItemBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#E55C18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  suggestedItemBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  suggestedItemDetails: {
    padding: 10,
  },
  suggestedItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  suggestedItemWeight: {
    fontSize: 9,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  suggestedItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  suggestedItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    marginRight: 4,
  },
  suggestedItemOriginalPrice: {
    fontSize: 9,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  suggestedItemDiscount: {
    fontSize: 8,
    color: '#10B981',
    backgroundColor: '#10B98120',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  addButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  addButtonBackground: {
    backgroundColor: '#E55C18',
    paddingVertical: 6,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
  },
  instructionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E55C1815',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  instructionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  instructionSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  paymentSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 30,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  paymentSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  paymentSelectorLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  paymentSelectorValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  paymentDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  paymentOptionSelected: {
    backgroundColor: '#F9FAFB',
  },
  paymentOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  paymentOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  paymentOptionTextSelected: {
    color: '#1F2937',
    fontWeight: '600',
  },
  paymentOptionCheck: {
    marginLeft: 8,
  },
  payButton: {
    borderRadius: 30,
    overflow: 'hidden',
    marginTop: 8,
  },
  payButtonBackground: {
    backgroundColor: '#E55C18',
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  processingAnimation: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 8,
  },
  processingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E55C18',
    marginHorizontal: 4,
    opacity: 0.5,
  },
  processingDotDelay1: {
    opacity: 0.8,
  },
  processingDotDelay2: {
    opacity: 1,
  },
  successIcon: {
    marginBottom: 8,
  },
  failedIcon: {
    marginBottom: 8,
  },
  transactionDetails: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  transactionLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  transactionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalAmount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  modalAmountLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalAmountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E55C18',
  },
  failedSuggestion: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#E55C18',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonPrimary: {
    backgroundColor: '#E55C18',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalButtonTextSecondary: {
    color: '#1F2937',
  },
});

export default EatmartViewCart;