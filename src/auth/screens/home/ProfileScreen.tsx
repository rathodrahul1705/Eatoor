import React, { useState, useEffect, useCallback, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  Modal, 
  Pressable, 
  StatusBar,
  Dimensions,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  BackHandler,
  Animated,
  RefreshControl,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  I18nManager
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfileDetails } from '../../../api/profile';
import { AuthContext } from '../../../context/AuthContext';
import { deleteAccountetails } from '../../../api/profile';

// Responsive dimensions and scaling
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive scaling functions
const scaleWidth = (size) => (SCREEN_WIDTH / 375) * size;
const scaleHeight = (size) => (SCREEN_HEIGHT / 812) * size;
const moderateScale = (size, factor = 0.5) => size + (scaleWidth(size) - size) * factor;

// Device type detection
const isSmallPhone = SCREEN_WIDTH < 375;
const isMediumPhone = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
const isLargePhone = SCREEN_WIDTH >= 414 && SCREEN_WIDTH < 768;
const isTablet = SCREEN_WIDTH >= 768;
const isLandscape = SCREEN_WIDTH > SCREEN_HEIGHT;

// Platform specific adjustments
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Font scaling
const getFontSize = (size) => {
  const baseSize = isSmallPhone ? size - 2 : isMediumPhone ? size : isLargePhone ? size + 1 : isTablet ? size + 2 : size;
  return moderateScale(baseSize);
};

// Responsive padding/margin
const getResponsivePadding = () => {
  if (isTablet) {
    return isLandscape ? scaleWidth(32) : scaleWidth(24);
  }
  if (isSmallPhone) return scaleWidth(12);
  if (isMediumPhone) return scaleWidth(16);
  return scaleWidth(20);
};

const ProfileScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPosition, setModalPosition] = useState({ top: 0, right: 0 });
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useContext(AuthContext);
  const [eatoorMoney, setEatoorMoney] = useState(0);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteStep, setDeleteStep] = useState(1);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const scaleAnim = useState(new Animated.Value(0.9))[0];
  const modalSlideAnim = useState(new Animated.Value(SCREEN_HEIGHT))[0];

  // Gradient colors
  const gradientColors = ['#FF6B35', '#FF512F', '#DD2476'];

  // Handle animations
  useEffect(() => {
    if (!loading && user) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [loading, user]);

  // Handle delete modal animation
  useEffect(() => {
    if (deleteModalVisible) {
      Animated.timing(modalSlideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalSlideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [deleteModalVisible]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.navigate('HomeTabs');
        return true;
      }
    );

    return () => backHandler.remove();
  }, [navigation]);

  // Handle orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      // Re-fetch or re-calculate responsive values if needed
    });

    return () => subscription?.remove();
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser({
          name: parsedUser.full_name || 'User Name',
          email: parsedUser.email || 'user@example.com',
          avatar: parsedUser.avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
          orders: parsedUser.orders || 0,
          favorites: parsedUser.favorites || 0,
          memberSince: parsedUser.created_at ? new Date(parsedUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Joined recently',
          rating: parsedUser.rating || 0,
          contact: parsedUser.contact_number || 'Not provided'
        });
        
        setEatoorMoney(parsedUser.eatoor_money || parsedUser.wallet_balance || 0);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserDetails = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await getUserProfileDetails();
      
      if (response.data && response.data.user_details) {
        const userDetails = response.data.user_details;
        
        const formattedUser = {
          orders: userDetails.order_count || 0,
          favorites: userDetails.favourite_count || 0,
          reviews: userDetails.review_count || 0,
        };

        setUserDetails(formattedUser);
        
        if (userDetails.eatoor_money !== undefined) {
          setEatoorMoney(userDetails.eatoor_money);
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (user) {
      fetchUserDetails();
    }
  }, [user, fetchUserDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserData();
    fetchUserDetails().finally(() => setRefreshing(false));
  }, []);

  const handleMenuPress = (event) => {
    const { pageY, pageX } = event.nativeEvent;
    
    const modalWidth = scaleWidth(180);
    const modalHeight = scaleHeight(150);
    
    let top = pageY + scaleHeight(10);
    let right = SCREEN_WIDTH - pageX - scaleWidth(20);
    
    if (top + modalHeight > SCREEN_HEIGHT) {
      top = SCREEN_HEIGHT - modalHeight - scaleHeight(20);
    }
    
    if (right + modalWidth > SCREEN_WIDTH) {
      right = scaleWidth(20);
    }
    
    setModalPosition({ top, right });
    setModalVisible(true);
  };

  const handleLogout = async () => {
    try {
      setModalVisible(false);
      logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleEditProfile = () => {
    setModalVisible(false);
    navigation.navigate('EditProfileScreen', { 
      user: {
        name: user.name,
        email: user.email,
        contact: user.contact,
        avatar: user.avatar
      }
    });
  };

  const handleSettings = () => {
    setModalVisible(false);
    setSettingsModalVisible(true);
  };

  const handleBackPress = () => {
    navigation.navigate('HomeTabs');
  };

  const handleViewEatoorMoney = () => {
    navigation.navigate('EatoorMoneyScreen', { 
      currentBalance: eatoorMoney,
      onBalanceUpdate: (newBalance) => {
        setEatoorMoney(newBalance);
      }
    });
  };

  const handleDeleteAccount = () => {
    setSettingsModalVisible(false);
    setTimeout(() => {
      setDeleteModalVisible(true);
      setDeleteStep(1);
      setDeleteReason('');
      setSelectedReason('');
      setConfirmText('');
    }, 300);
  };

  const handleCloseDeleteModal = () => {
    Animated.timing(modalSlideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setDeleteModalVisible(false);
      setDeleteStep(1);
      setDeleteReason('');
      setSelectedReason('');
      setConfirmText('');
    });
  };

  const handleNextStep = () => {
    if (deleteStep < 3) {
      setDeleteStep(deleteStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (deleteStep > 1) {
      setDeleteStep(deleteStep - 1);
    }
  };

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    setDeleteReason(reason === 'Other' ? '' : reason);
  };

  const reasons = [
    'Found a better alternative',
    'Privacy concerns',
    'Too many notifications',
    'Don\'t use the app anymore',
    'Technical issues',
    'Customer service problems',
    'Other'
  ];

  const confirmDeleteAccount = async () => {
    if (confirmText.toLowerCase() !== 'delete') {
      Alert.alert(
        'Confirmation Error',
        'Please type "DELETE" exactly as shown to confirm account deletion.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setDeletingAccount(true);
      
      const payload = {
        reason: deleteReason || selectedReason,
        reason_type: deleteReason || selectedReason,
      };

      const response = await deleteAccountetails(payload);
      if (response && response.status === 200) {
        await AsyncStorage.clear();
        handleCloseDeleteModal();
        logout();
      } else {
        throw new Error(response?.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      
      let errorMessage = "Failed to delete account. Please try again later.";
      
      if (error.response) {
        const serverError = error.response.data;
        if (serverError && serverError.message) {
          errorMessage = serverError.message;
        } else if (error.response.status === 401) {
          errorMessage = "Your session has expired. Please login again.";
        } else if (error.response.status === 403) {
          errorMessage = "You don't have permission to delete this account.";
        } else if (error.response.status === 404) {
          errorMessage = "Account not found.";
        } else if (error.response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        }
      } else if (error.request) {
        errorMessage = "No response from server. Please check your internet connection.";
      }
      
      Alert.alert(
        "Error",
        errorMessage,
        [
          {
            text: "OK",
            onPress: () => {
              setDeletingAccount(false);
            }
          }
        ]
      );
    } finally {
      if (!deletingAccount) {
        setDeletingAccount(false);
        setDeleteStep(1);
        setDeleteReason('');
        setSelectedReason('');
        setConfirmText('');
      }
    }
  };

  const renderDeleteStep1 = () => (
    <View style={styles.deleteStepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>Reason for Leaving</Text>
      </View>
      
      <Text style={styles.deleteStepDescription}>
        Please help us improve by telling us why you're leaving
      </Text>
      
      <View style={styles.reasonsScrollContainer}>
        <ScrollView 
          style={styles.reasonsContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reasonsContentContainer}
        >
          {reasons.map((reason, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.reasonOption,
                selectedReason === reason && styles.reasonOptionSelected
              ]}
              onPress={() => handleReasonSelect(reason)}
            >
              <View style={styles.reasonRadio}>
                {selectedReason === reason && (
                  <View style={styles.reasonRadioSelected} />
                )}
              </View>
              <Text style={[
                styles.reasonText,
                selectedReason === reason && styles.reasonTextSelected
              ]}>
                {reason}
              </Text>
              {selectedReason === reason && (
                <Icon name="checkmark-circle" size={scaleWidth(20)} color="#FF6B35" />
              )}
            </TouchableOpacity>
          ))}
          
          {selectedReason === 'Other' && (
            <View style={styles.otherReasonContainer}>
              <TextInput
                style={styles.otherReasonInput}
                placeholder="Please specify your reason..."
                placeholderTextColor="#999"
                value={deleteReason}
                onChangeText={setDeleteReason}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>
          )}
        </ScrollView>
      </View>
      
      <View style={styles.stepButtons}>
        <TouchableOpacity 
          style={styles.stepButtonSecondary}
          onPress={handleCloseDeleteModal}
        >
          <Text style={styles.stepButtonSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.stepButtonPrimary,
            (!selectedReason || (selectedReason === 'Other' && !deleteReason.trim())) && 
            styles.stepButtonDisabled
          ]}
          onPress={handleNextStep}
          disabled={!selectedReason || (selectedReason === 'Other' && !deleteReason.trim())}
        >
          <Text style={styles.stepButtonPrimaryText}>Next</Text>
          <Icon name="arrow-forward" size={scaleWidth(16)} color="#FFF" style={{ marginLeft: scaleWidth(8) }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDeleteStep2 = () => (
    <View style={styles.deleteStepContainer}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
            <Icon name="checkmark" size={scaleWidth(14)} color="#FFF" />
          </View>
          <View style={styles.stepLineCompleted} />
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>What You'll Lose</Text>
      </View>
      
      <Text style={styles.deleteStepDescription}>
        Before proceeding, please review what will be permanently deleted:
      </Text>
      
      <View style={styles.consequencesScrollContainer}>
        <ScrollView 
          style={styles.consequencesContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.consequencesContentContainer}
        >
          <View style={[
            styles.consequencesGrid,
            isTablet && styles.consequencesGridTablet,
            isLandscape && styles.consequencesGridLandscape
          ]}>
            <View style={[
              styles.consequenceCard,
              isTablet && styles.consequenceCardTablet
            ]}>
              <LinearGradient
                colors={['#FF6B35', '#FF512F']}
                style={styles.consequenceIcon}
              >
                <Icon name="cart-outline" size={scaleWidth(22)} color="#FFF" />
              </LinearGradient>
              <Text style={styles.consequenceCardTitle}>Order History</Text>
              <Text style={styles.consequenceCardText}>
                All past orders and receipts
              </Text>
            </View>
            
            <View style={[
              styles.consequenceCard,
              isTablet && styles.consequenceCardTablet
            ]}>
              <LinearGradient
                colors={['#DD2476', '#FF512F']}
                style={styles.consequenceIcon}
              >
                <Icon name="heart-outline" size={scaleWidth(22)} color="#FFF" />
              </LinearGradient>
              <Text style={styles.consequenceCardTitle}>Favorites</Text>
              <Text style={styles.consequenceCardText}>
                All saved restaurants & items
              </Text>
            </View>
            
            <View style={[
              styles.consequenceCard,
              isTablet && styles.consequenceCardTablet
            ]}>
              <LinearGradient
                colors={['#8A2BE2', '#DD2476']}
                style={styles.consequenceIcon}
              >
                <Icon name="wallet-outline" size={scaleWidth(22)} color="#FFF" />
              </LinearGradient>
              <Text style={styles.consequenceCardTitle}>Eatoor Money</Text>
              <Text style={styles.consequenceCardText}>
                Any remaining balance
              </Text>
            </View>
            
            <View style={[
              styles.consequenceCard,
              isTablet && styles.consequenceCardTablet
            ]}>
              <LinearGradient
                colors={['#4A90E2', '#8A2BE2']}
                style={styles.consequenceIcon}
              >
                <Icon name="star-outline" size={scaleWidth(22)} color="#FFF" />
              </LinearGradient>
              <Text style={styles.consequenceCardTitle}>Reviews & Ratings</Text>
              <Text style={styles.consequenceCardText}>
                All your contributions
              </Text>
            </View>
          </View>
          
          <View style={styles.warningBox}>
            <Icon name="warning-outline" size={scaleWidth(20)} color="#FF9500" />
            <Text style={styles.warningText}>
              This action cannot be undone. All data will be permanently erased.
            </Text>
          </View>
        </ScrollView>
      </View>
      
      <View style={styles.stepButtons}>
        <TouchableOpacity 
          style={styles.stepButtonSecondary}
          onPress={handlePrevStep}
        >
          <Icon name="arrow-back" size={scaleWidth(16)} color="#666" style={{ marginRight: scaleWidth(8) }} />
          <Text style={styles.stepButtonSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.stepButtonPrimary}
          onPress={handleNextStep}
        >
          <Text style={styles.stepButtonPrimaryText}>Continue</Text>
          <Icon name="arrow-forward" size={scaleWidth(16)} color="#FFF" style={{ marginLeft: scaleWidth(8) }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDeleteStep3 = () => (
    <KeyboardAvoidingView 
      behavior={isIOS ? 'padding' : 'height'}
      style={styles.deleteStepContainer}
      keyboardVerticalOffset={isIOS ? scaleHeight(100) : scaleHeight(20)}
    >
      <View style={styles.stepHeader}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
            <Icon name="checkmark" size={scaleWidth(14)} color="#FFF" />
          </View>
          <View style={styles.stepLineCompleted} />
          <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
            <Icon name="checkmark" size={scaleWidth(14)} color="#FFF" />
          </View>
          <View style={styles.stepLineCompleted} />
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>Final Confirmation</Text>
      </View>
      
      <View style={styles.finalStepScrollContainer}>
        <ScrollView 
          style={styles.finalStepContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.finalStepContentContainer}
        >
          <View style={styles.finalWarningContainer}>
            <LinearGradient
              colors={['#FF6B6B', '#FF4757']}
              style={styles.finalWarningIcon}
            >
              <Icon name="alert-circle" size={scaleWidth(40)} color="#FFF" />
            </LinearGradient>
            <Text style={styles.finalWarningTitle}>Final Warning</Text>
            <Text style={styles.finalWarningText}>
              You are about to permanently delete your account and all associated data.
            </Text>
          </View>
          
          <View style={styles.confirmInputContainer}>
            <Text style={styles.confirmInstruction}>
              To confirm, please type <Text style={styles.confirmWord}>DELETE</Text> below:
            </Text>
            <TextInput
              style={styles.confirmInput}
              placeholder="Type DELETE here"
              placeholderTextColor="#999"
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              returnKeyType="done"
              autoCorrect={false}
              spellCheck={false}
              maxLength={6}
            />
            <Text style={styles.confirmHint}>
              This is case-sensitive. Type exactly as shown.
            </Text>
          </View>
          
          <View style={styles.additionalWarnings}>
            <Text style={styles.additionalWarningTitle}>Important Notes:</Text>
            <View style={styles.warningItem}>
              <Icon name="close-circle" size={scaleWidth(16)} color="#FF6B6B" />
              <Text style={styles.warningItemText}>
                This action cannot be reversed or undone
              </Text>
            </View>
            <View style={styles.warningItem}>
              <Icon name="close-circle" size={scaleWidth(16)} color="#FF6B6B" />
              <Text style={styles.warningItemText}>
                You will lose access to all your data immediately
              </Text>
            </View>
            <View style={styles.warningItem}>
              <Icon name="close-circle" size={scaleWidth(16)} color="#FF6B6B" />
              <Text style={styles.warningItemText}>
                Any pending orders will be cancelled automatically
              </Text>
            </View>
            <View style={styles.warningItem}>
              <Icon name="close-circle" size={scaleWidth(16)} color="#FF6B6B" />
              <Text style={styles.warningItemText}>
                You will need to create a new account to use our services again
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
      
      <View style={styles.stepButtons}>
        <TouchableOpacity 
          style={styles.stepButtonSecondary}
          onPress={handlePrevStep}
        >
          <Icon name="arrow-back" size={scaleWidth(16)} color="#666" style={{ marginRight: scaleWidth(8) }} />
          <Text style={styles.stepButtonSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.stepButtonDelete,
            (confirmText.toLowerCase() !== 'delete' || deletingAccount) && styles.stepButtonDisabled
          ]}
          onPress={confirmDeleteAccount}
          disabled={confirmText.toLowerCase() !== 'delete' || deletingAccount}
        >
          {deletingAccount ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Icon name="trash-outline" size={scaleWidth(18)} color="#FFF" style={{ marginRight: scaleWidth(8) }} />
              <Text style={styles.stepButtonDeleteText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={gradientColors[0]} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const StatItem = ({ icon, value, label, index }) => (
    <Animated.View 
      style={[
        styles.statItem,
        {
          opacity: fadeAnim,
          transform: [
            { 
              translateY: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, scaleHeight(20) + index * scaleHeight(10)]
              })
            }
          ]
        }
      ]}
    >
      <LinearGradient
        colors={[gradientColors[0], gradientColors[1]]}
        style={styles.statIconContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Icon name={icon} size={getFontSize(isTablet ? 22 : 18)} color="#FFF" />
      </LinearGradient>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );

  const ActionCard = ({ icon, title, subtitle, onPress, index }) => (
    <Animated.View
      style={[
        styles.actionCard,
        {
          opacity: fadeAnim,
          transform: [
            { 
              translateX: slideAnim.interpolate({
                inputRange: [0, 50],
                outputRange: [0, scaleWidth(30) + index * scaleWidth(15)]
              })
            },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      <TouchableOpacity onPress={onPress} style={styles.actionCardTouchable}>
        <LinearGradient
          colors={['#f8f9ff', '#ffffff']}
          style={styles.actionIconContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name={icon} size={getFontSize(isTablet ? 24 : 18)} color={gradientColors[0]} />
        </LinearGradient>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.chevronContainer}>
          <Icon 
            name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} 
            size={getFontSize(16)} 
            color="#C5C5D3" 
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const responsivePadding = getResponsivePadding();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFF" 
        translucent={isAndroid}
      />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
            paddingTop: isIOS ? scaleHeight(16) : StatusBar.currentHeight + scaleHeight(10),
            paddingBottom: isIOS ? scaleHeight(10) : StatusBar.currentHeight + scaleHeight(0),
            paddingHorizontal: responsivePadding,
          }
        ]}
      >
        <TouchableOpacity 
          onPress={handleBackPress}
          style={styles.headerButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <LinearGradient
            colors={['#f8f9ff', '#e9ecef']}
            style={styles.headerButtonGradient}
          >
            <Icon 
              name={isIOS ? "chevron-back" : "arrow-back"} 
              size={getFontSize(20)} 
              color="#333" 
            />
          </LinearGradient>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Profile</Text>
        
        <TouchableOpacity 
          onPress={handleMenuPress}
          style={styles.headerButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <LinearGradient
            colors={['#f8f9ff', '#e9ecef']}
            style={styles.headerButtonGradient}
          >
            <Icon name="ellipsis-vertical" size={getFontSize(20)} color="#333" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: responsivePadding }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={gradientColors}
            tintColor={gradientColors[0]}
            progressViewOffset={isIOS ? scaleHeight(50) : 0}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile Section */}
        <Animated.View 
          style={[
            styles.profileSection,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ],
              marginTop: isLandscape ? scaleHeight(10) : scaleHeight(20),
              marginBottom: isLandscape ? scaleHeight(16) : scaleHeight(20),
            }
          ]}
        >
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={gradientColors}
              style={[
                styles.avatarBorder,
                {
                  width: isTablet ? scaleWidth(100) : scaleWidth(80),
                  height: isTablet ? scaleWidth(100) : scaleWidth(80),
                  borderRadius: isTablet ? scaleWidth(50) : scaleWidth(40),
                }
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {user.avatar && user.avatar !== 'https://randomuser.me/api/portraits/men/1.jpg' ? (
                <Image 
                  source={{ uri: user.avatar }} 
                  style={[
                    styles.avatarImage,
                    {
                      borderRadius: isTablet ? scaleWidth(47) : scaleWidth(37),
                    }
                  ]} 
                />
              ) : (
                <View style={[
                  styles.avatarPlaceholder,
                  {
                    borderRadius: isTablet ? scaleWidth(47) : scaleWidth(37),
                  }
                ]}>
                  <Icon 
                    name="person" 
                    size={getFontSize(isTablet ? 40 : 32)} 
                    color="#FFF" 
                  />
                </View>
              )}
            </LinearGradient>
            <View style={styles.onlineIndicator} />
          </View>
          
          <View style={[
            styles.userInfo,
            { marginLeft: isTablet ? scaleWidth(20) : scaleWidth(16) }
          ]}>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            {user.email && user.email.includes('@eatoor.com') ? (
              <Text style={styles.userDetail} numberOfLines={1}>{user?.contact}</Text>
            ) : (
              <Text style={styles.userDetail} numberOfLines={1}>{user.email}</Text>
            )}
            <View style={styles.memberSinceContainer}>
              <Icon name="calendar-outline" size={scaleWidth(12)} color="#888" />
              <Text style={styles.memberSince}>Member since {user.memberSince}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Eatoor Money Section */}
        <Animated.View 
          style={[
            styles.eatoorMoneySection,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ],
              marginBottom: isLandscape ? scaleHeight(16) : scaleHeight(24),
            }
          ]}
        >
          <View style={styles.eatoorMoneyHeader}>
            <LinearGradient
              colors={['#FF6B35', '#FF512F', '#DD2476']}
              style={[
                styles.eatoorMoneyIcon,
                {
                  width: scaleWidth(40),
                  height: scaleWidth(40),
                  borderRadius: scaleWidth(12),
                }
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="wallet-outline" size={getFontSize(18)} color="#FFF" />
            </LinearGradient>
            <View style={styles.eatoorMoneyTextContainer}>
              <Text style={styles.eatoorMoneyTitle}>Eatoor Money</Text>
            </View>
            <TouchableOpacity 
              onPress={handleViewEatoorMoney}
              style={styles.viewHistoryButton}
            >
              <Text style={styles.viewHistoryText}>View</Text>
              <Icon 
                name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} 
                size={scaleWidth(14)} 
                color="#DD2476" 
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Stats Section */}
        <View style={[
          styles.statsContainer,
          {
            marginBottom: isLandscape ? scaleHeight(16) : scaleHeight(24),
            paddingHorizontal: responsivePadding / 2,
            paddingVertical: isLandscape ? scaleHeight(12) : scaleHeight(16),
          }
        ]}>
          <StatItem 
            icon="cart-outline" 
            value={userDetails?.orders || user.orders} 
            label="Orders" 
            index={0}
          />
          
          <View style={styles.statDivider} />
          
          <StatItem 
            icon="heart-outline" 
            value={userDetails?.favorites || user.favorites} 
            label="Favorites" 
            index={1}
          />
          
          <View style={styles.statDivider} />
          
          <StatItem 
            icon="star-outline" 
            value={userDetails?.reviews || user.rating} 
            label="Reviews" 
            index={2}
          />
        </View>

        {/* Account Section */}
        <View style={[
          styles.section,
          { marginBottom: isLandscape ? scaleHeight(16) : scaleHeight(24) }
        ]}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <ActionCard 
            icon="cart-outline"
            title="Your Orders"
            subtitle="View and track your orders"
            onPress={() => navigation.navigate('OrdersScreen')}
            index={0}
          />

          <ActionCard 
            icon="heart-outline"
            title="Favorites"
            subtitle="Your saved items"
            onPress={() => navigation.navigate('FavoritesScreen')}
            index={1}
          />

          <ActionCard 
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your information"
            onPress={handleEditProfile}
            index={2}
          />
          
          <ActionCard 
            icon="location-outline"
            title="Addresses"
            subtitle="Manage your addresses"
            onPress={() => navigation.navigate('AddressScreen', {prevLocation: "ProfileScreen"})}
            index={3}
          />

          <ActionCard 
            icon="settings-outline"
            title="Settings"
            subtitle="App settings and preferences"
            onPress={() => setSettingsModalVisible(true)}
            index={4}
          />
        </View>
      </ScrollView>

      {/* Enhanced Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setModalVisible(false)}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              { 
                top: modalPosition.top,
                right: modalPosition.right,
                width: scaleWidth(180),
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#ffffff', '#f8f9ff']}
              style={styles.modalGradient}
            >
              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleEditProfile}
              >
                <View style={styles.modalOptionContent}>
                  <LinearGradient
                    colors={[gradientColors[0], gradientColors[1]]}
                    style={styles.modalOptionIcon}
                  >
                    <Icon name="create-outline" size={scaleWidth(16)} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.modalOptionText}>Edit Profile</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity 
                style={styles.modalOption}
                onPress={handleSettings}
              >
                <View style={styles.modalOptionContent}>
                  <LinearGradient
                    colors={[gradientColors[0], gradientColors[1]]}
                    style={styles.modalOptionIcon}
                  >
                    <Icon name="settings-outline" size={scaleWidth(16)} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.modalOptionText}>Settings</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity 
                style={[styles.modalOption, styles.logoutOption]}
                onPress={handleLogout}
              >
                <View style={styles.modalOptionContent}>
                  <View style={[styles.modalOptionIcon, { backgroundColor: '#FF6B6B' }]}>
                    <Icon name="log-out-outline" size={scaleWidth(16)} color="#FFF" />
                  </View>
                  <Text style={[styles.modalOptionText, styles.logoutText]}>Logout</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.settingsModalOverlay}>
          <Animated.View 
            style={[
              styles.settingsModalContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
                maxHeight: SCREEN_HEIGHT * (isLandscape ? 0.9 : 0.8),
                minHeight: SCREEN_HEIGHT * (isLandscape ? 0.6 : 0.5),
              }
            ]}
          >
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>Settings</Text>
              <TouchableOpacity 
                onPress={() => setSettingsModalVisible(false)}
                style={styles.settingsCloseButton}
              >
                <Icon name="close" size={scaleWidth(24)} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.settingsOptionsContainer} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsOptionsContent}
            >
              {/* Delete Account Option */}
              <TouchableOpacity 
                style={[styles.settingOption, styles.deleteAccountOption]}
                onPress={handleDeleteAccount}
              >
                <View style={[styles.settingOptionIconContainer, styles.deleteAccountIcon]}>
                  <Icon name="trash-outline" size={scaleWidth(20)} color="#FF6B6B" />
                </View>
                <View style={styles.settingOptionTextContainer}>
                  <Text style={[styles.settingOptionTitle, styles.deleteAccountTitle]}>Delete Account</Text>
                  <Text style={styles.settingOptionSubtitle}>Permanently delete your account</Text>
                </View>
                <Icon 
                  name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} 
                  size={scaleWidth(18)} 
                  color="#FF6B6B" 
                />
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Enhanced Delete Account Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={handleCloseDeleteModal}
        statusBarTranslucent
      >
        <View style={styles.deleteModalOverlay}>
          <Animated.View 
            style={[
              styles.deleteModalContent,
              {
                transform: [{ translateY: modalSlideAnim }],
                marginTop: isIOS ? scaleHeight(50) : StatusBar.currentHeight + scaleHeight(20),
                maxHeight: SCREEN_HEIGHT * (isLandscape ? 0.95 : 0.9),
              }
            ]}
          >
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalHeaderTitle}>
                {deleteStep === 1 && 'Reason for Leaving'}
                {deleteStep === 2 && 'What You\'ll Lose'}
                {deleteStep === 3 && 'Final Confirmation'}
              </Text>
              <TouchableOpacity 
                onPress={handleCloseDeleteModal}
                style={styles.deleteModalCloseButton}
              >
                <Icon name="close" size={scaleWidth(24)} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.deleteModalBody}>
              {deleteStep === 1 && renderDeleteStep1()}
              {deleteStep === 2 && renderDeleteStep2()}
              {deleteStep === 3 && renderDeleteStep3()}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFBFF',
  },
  loadingText: {
    marginTop: scaleHeight(16),
    fontSize: getFontSize(16),
    color: '#667eea',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: scaleHeight(30),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: getFontSize(20),
    fontWeight: '700',
    color: '#333',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerButton: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    overflow: 'hidden',
  },
  headerButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: scaleWidth(20),
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scaleWidth(20),
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: scaleWidth(12),
    elevation: 5,
  },
  avatarContainer: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: scaleWidth(12),
    elevation: 8,
  },
  avatarBorder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scaleWidth(3),
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: scaleWidth(4),
    right: scaleWidth(4),
    width: scaleWidth(14),
    height: scaleWidth(14),
    borderRadius: scaleWidth(7),
    backgroundColor: '#4CD964',
    borderWidth: scaleWidth(2),
    borderColor: '#FFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: getFontSize(20),
    fontWeight: '700',
    color: '#333',
    marginBottom: scaleHeight(4),
  },
  userDetail: {
    fontSize: getFontSize(14),
    color: '#666',
    marginBottom: scaleHeight(6),
  },
  memberSinceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scaleHeight(4),
  },
  memberSince: {
    fontSize: getFontSize(11),
    color: '#888',
    marginLeft: scaleWidth(4),
  },
  eatoorMoneySection: {
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(20),
    padding: scaleWidth(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: scaleWidth(12),
    elevation: 5,
  },
  eatoorMoneyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eatoorMoneyIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  eatoorMoneyTextContainer: {
    flex: 1,
    marginLeft: scaleWidth(12),
  },
  eatoorMoneyTitle: {
    fontSize: getFontSize(16),
    color: '#666',
    fontWeight: '500',
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(8),
    paddingHorizontal: scaleWidth(12),
    borderRadius: scaleWidth(8),
    backgroundColor: 'rgba(138, 43, 226, 0.1)',
  },
  viewHistoryText: {
    fontSize: getFontSize(13),
    color: '#DD2476',
    fontWeight: '600',
    marginRight: scaleWidth(4),
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: scaleWidth(12),
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: scaleHeight(8),
  },
  statIconContainer: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(22),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleHeight(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: getFontSize(18),
    fontWeight: '700',
    color: '#333',
    marginVertical: scaleHeight(4),
  },
  statLabel: {
    fontSize: getFontSize(10),
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: scaleHeight(40),
    backgroundColor: '#F0F0F0',
    marginHorizontal: scaleWidth(4),
  },
  section: {
    marginBottom: scaleHeight(24),
  },
  sectionTitle: {
    fontSize: getFontSize(18),
    fontWeight: '700',
    color: '#333',
    marginBottom: scaleHeight(16),
    marginLeft: scaleWidth(4),
    letterSpacing: -0.3,
  },
  actionCard: {
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(16),
    marginBottom: scaleHeight(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: scaleWidth(8),
    elevation: 3,
    overflow: 'hidden',
  },
  actionCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scaleWidth(16),
  },
  actionIconContainer: {
    width: scaleWidth(44),
    height: scaleWidth(44),
    borderRadius: scaleWidth(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#333',
    marginBottom: scaleHeight(2),
  },
  actionSubtitle: {
    fontSize: getFontSize(12),
    color: '#888',
  },
  chevronContainer: {
    padding: scaleWidth(4),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  modalContent: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(16),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: scaleWidth(12),
    elevation: 8,
  },
  modalGradient: {
    paddingVertical: scaleHeight(8),
  },
  modalOption: {
    paddingVertical: scaleHeight(12),
    paddingHorizontal: scaleWidth(16),
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOptionIcon: {
    width: scaleWidth(28),
    height: scaleWidth(28),
    borderRadius: scaleWidth(8),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(12),
  },
  modalOptionText: {
    fontSize: getFontSize(14),
    color: '#333',
    fontWeight: '500',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: scaleWidth(12),
  },
  logoutText: {
    color: '#FF6B6B',
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  settingsModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: scaleWidth(24),
    borderTopRightRadius: scaleWidth(24),
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingsModalTitle: {
    fontSize: getFontSize(20),
    fontWeight: '700',
    color: '#333',
  },
  settingsCloseButton: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  settingsOptionsContainer: {
    flex: 1,
  },
  settingsOptionsContent: {
    paddingHorizontal: scaleWidth(16),
    paddingVertical: scaleHeight(8),
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(16),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingOptionIconContainer: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(12),
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scaleWidth(16),
  },
  settingOptionTextContainer: {
    flex: 1,
  },
  settingOptionTitle: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#333',
    marginBottom: scaleHeight(4),
  },
  settingOptionSubtitle: {
    fontSize: getFontSize(12),
    color: '#888',
  },
  deleteAccountOption: {
    marginTop: scaleHeight(20),
    borderBottomWidth: 0,
    paddingVertical: scaleHeight(18),
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderRadius: scaleWidth(12),
    paddingHorizontal: scaleWidth(16),
    marginBottom: scaleHeight(20),
  },
  deleteAccountIcon: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  deleteAccountTitle: {
    color: '#FF6B6B',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  deleteModalContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: scaleWidth(24),
    borderTopRightRadius: scaleWidth(24),
  },
  deleteModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    paddingVertical: scaleHeight(20),
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  deleteModalHeaderTitle: {
    fontSize: getFontSize(20),
    fontWeight: '700',
    color: '#333',
  },
  deleteModalCloseButton: {
    width: scaleWidth(40),
    height: scaleWidth(40),
    borderRadius: scaleWidth(20),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  deleteModalBody: {
    flex: 1,
    paddingHorizontal: scaleWidth(20),
    paddingBottom: scaleHeight(20),
  },
  deleteStepContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: scaleHeight(20),
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: scaleHeight(20),
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scaleHeight(16),
  },
  stepCircle: {
    width: scaleWidth(32),
    height: scaleWidth(32),
    borderRadius: scaleWidth(16),
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: scaleWidth(2),
    borderColor: '#F0F0F0',
  },
  stepCircleActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  stepCircleCompleted: {
    backgroundColor: '#4CD964',
    borderColor: '#4CD964',
  },
  stepNumber: {
    color: '#FFF',
    fontSize: getFontSize(14),
    fontWeight: '600',
  },
  stepLine: {
    width: scaleWidth(40),
    height: scaleWidth(2),
    backgroundColor: '#F0F0F0',
  },
  stepLineCompleted: {
    width: scaleWidth(40),
    height: scaleWidth(2),
    backgroundColor: '#4CD964',
  },
  stepTitle: {
    fontSize: getFontSize(18),
    fontWeight: '600',
    color: '#333',
  },
  deleteStepDescription: {
    fontSize: getFontSize(14),
    color: '#666',
    textAlign: 'center',
    marginBottom: scaleHeight(20),
    lineHeight: scaleHeight(20),
    paddingHorizontal: scaleWidth(10),
  },
  reasonsScrollContainer: {
    flex: 1,
    marginBottom: scaleHeight(10),
  },
  reasonsContainer: {
    flex: 1,
  },
  reasonsContentContainer: {
    paddingBottom: scaleHeight(20),
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(12),
    marginBottom: scaleHeight(8),
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  reasonOptionSelected: {
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderColor: '#FF6B35',
  },
  reasonRadio: {
    width: scaleWidth(20),
    height: scaleWidth(20),
    borderRadius: scaleWidth(10),
    borderWidth: scaleWidth(2),
    borderColor: '#DDD',
    marginRight: scaleWidth(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonRadioSelected: {
    width: scaleWidth(10),
    height: scaleWidth(10),
    borderRadius: scaleWidth(5),
    backgroundColor: '#FF6B35',
  },
  reasonText: {
    flex: 1,
    fontSize: getFontSize(14),
    color: '#333',
  },
  reasonTextSelected: {
    color: '#FF6B35',
    fontWeight: '500',
  },
  otherReasonContainer: {
    marginTop: scaleHeight(16),
    paddingHorizontal: scaleWidth(16),
  },
  otherReasonInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    fontSize: getFontSize(14),
    color: '#333',
    minHeight: scaleHeight(100),
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  consequencesScrollContainer: {
    flex: 1,
    marginBottom: scaleHeight(10),
  },
  consequencesContainer: {
    flex: 1,
  },
  consequencesContentContainer: {
    paddingBottom: scaleHeight(20),
  },
  consequencesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: scaleHeight(24),
  },
  consequencesGridTablet: {
    justifyContent: 'space-around',
  },
  consequencesGridLandscape: {
    justifyContent: 'space-between',
    paddingHorizontal: scaleWidth(10),
  },
  consequenceCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  consequenceCardTablet: {
    width: '45%',
    marginBottom: scaleHeight(20),
  },
  consequenceIcon: {
    width: scaleWidth(48),
    height: scaleWidth(48),
    borderRadius: scaleWidth(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleHeight(12),
  },
  consequenceCardTitle: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#333',
    marginBottom: scaleHeight(4),
    textAlign: 'center',
  },
  consequenceCardText: {
    fontSize: getFontSize(12),
    color: '#666',
    textAlign: 'center',
    lineHeight: scaleHeight(16),
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    marginBottom: scaleHeight(10),
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: getFontSize(13),
    color: '#FF9500',
    marginLeft: scaleWidth(12),
    lineHeight: scaleHeight(18),
  },
  finalStepScrollContainer: {
    flex: 1,
    marginBottom: scaleHeight(10),
  },
  finalStepContainer: {
    flex: 1,
  },
  finalStepContentContainer: {
    paddingBottom: scaleHeight(20),
  },
  finalWarningContainer: {
    alignItems: 'center',
    paddingVertical: scaleHeight(24),
    marginBottom: scaleHeight(24),
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderRadius: scaleWidth(16),
  },
  finalWarningIcon: {
    width: scaleWidth(80),
    height: scaleWidth(80),
    borderRadius: scaleWidth(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scaleHeight(16),
  },
  finalWarningTitle: {
    fontSize: getFontSize(18),
    fontWeight: '700',
    color: '#FF6B6B',
    marginBottom: scaleHeight(8),
  },
  finalWarningText: {
    fontSize: getFontSize(14),
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: scaleWidth(20),
    lineHeight: scaleHeight(20),
  },
  confirmInputContainer: {
    marginBottom: scaleHeight(24),
    paddingHorizontal: scaleWidth(10),
  },
  confirmInstruction: {
    fontSize: getFontSize(14),
    color: '#666',
    marginBottom: scaleHeight(16),
    textAlign: 'center',
    lineHeight: scaleHeight(20),
  },
  confirmWord: {
    color: '#FF6B6B',
    fontWeight: '700',
    fontSize: getFontSize(16),
  },
  confirmInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    fontSize: getFontSize(16),
    color: '#333',
    textAlign: 'center',
    borderWidth: scaleWidth(2),
    borderColor: '#F0F0F0',
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: scaleHeight(12),
  },
  confirmHint: {
    fontSize: getFontSize(12),
    color: '#999',
    textAlign: 'center',
    marginTop: scaleHeight(8),
  },
  additionalWarnings: {
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    borderRadius: scaleWidth(12),
    padding: scaleWidth(16),
    marginTop: scaleHeight(10),
  },
  additionalWarningTitle: {
    fontSize: getFontSize(14),
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: scaleHeight(12),
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: scaleHeight(12),
  },
  warningItemText: {
    fontSize: getFontSize(13),
    color: '#666',
    marginLeft: scaleWidth(12),
    flex: 1,
    lineHeight: scaleHeight(18),
  },
  stepButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: scaleHeight(10),
    paddingBottom: Platform.OS === 'ios' ? scaleHeight(20) : scaleHeight(10),
  },
  stepButtonSecondary: {
    flex: 1,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    marginRight: scaleWidth(8),
    flexDirection: 'row',
    minHeight: scaleHeight(54),
  },
  stepButtonSecondaryText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#666',
  },
  stepButtonPrimary: {
    flex: 1,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    marginLeft: scaleWidth(8),
    flexDirection: 'row',
    minHeight: scaleHeight(54),
  },
  stepButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  stepButtonPrimaryText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#FFF',
  },
  stepButtonDelete: {
    flex: 1,
    paddingVertical: scaleHeight(16),
    borderRadius: scaleWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    marginLeft: scaleWidth(8),
    flexDirection: 'row',
    minHeight: scaleHeight(54),
  },
  stepButtonDeleteText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: '#FFF',
  },
});

export default ProfileScreen;