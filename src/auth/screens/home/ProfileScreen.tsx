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
  RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { StackActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfileDetails } from '../../../api/profile';
import { AuthContext } from '../../../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isTablet = SCREEN_WIDTH >= 768;

const ProfileScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPosition, setModalPosition] = useState({ top: 0, right: 0 });
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useContext(AuthContext);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const scaleAnim = useState(new Animated.Value(0.9))[0];

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
    const windowWidth = Dimensions.get('window').width;
    const windowHeight = Dimensions.get('window').height;
    
    const modalWidth = isSmallScreen ? 160 : 180;
    const modalHeight = 100;
    
    let top = pageY + 10;
    let right = windowWidth - pageX - 20;
    
    if (top + modalHeight > windowHeight) {
      top = windowHeight - modalHeight - 20;
    }
    
    if (right + modalWidth > windowWidth) {
      right = 20;
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
    navigation.navigate('Settings');
  };

  const handleBackPress = () => {
    navigation.navigate('HomeTabs');
  };

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
                outputRange: [0, 20 + index * 10]
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
        <Icon name={icon} size={isSmallScreen ? 18 : 20} color="#FFF" />
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
                outputRange: [0, 30 + index * 15]
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
          <Icon name={icon} size={isSmallScreen ? 20 : 22} color={gradientColors[0]} />
        </LinearGradient>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.chevronContainer}>
          <Icon name="chevron-forward" size={18} color="#C5C5D3" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Animated Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
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
            <Icon name={Platform.OS === 'ios' ? "chevron-back" : "arrow-back"} size={20} color="#333" />
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
            <Icon name="ellipsis-vertical" size={20} color="#333" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={gradientColors}
            tintColor={gradientColors[0]}
          />
        }
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
              ]
            }
          ]}
        >
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={gradientColors}
              style={styles.avatarBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {user.avatar && user.avatar !== 'https://randomuser.me/api/portraits/men/1.jpg' ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Icon name="person" size={isSmallScreen ? 32 : 40} color="#FFF" />
                </View>
              )}
            </LinearGradient>
            <View style={styles.onlineIndicator} />
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
            {user.email && user.email.includes('@eatoor.com') ? (
              <Text style={styles.userDetail} numberOfLines={1}>{user?.contact}</Text>
            ) : (
              <Text style={styles.userDetail} numberOfLines={1}>{user.email}</Text>
            )}
            <View style={styles.memberSinceContainer}>
              <Icon name="calendar-outline" size={12} color="#888" />
              <Text style={styles.memberSince}>Member since {user.memberSince}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
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
        <View style={styles.section}>
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
        </View>
      </ScrollView>

      {/* Enhanced Options Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
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
                width: isSmallScreen ? 160 : 180,
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
                    <Icon name="create-outline" size={16} color="#FFF" />
                  </LinearGradient>
                  <Text style={styles.modalOptionText}>Edit Profile</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.modalDivider} />

              <TouchableOpacity 
                style={[styles.modalOption, styles.logoutOption]}
                onPress={handleLogout}
              >
                <View style={styles.modalOptionContent}>
                  <View style={[styles.modalOptionIcon, { backgroundColor: '#FF6B6B' }]}>
                    <Icon name="log-out-outline" size={16} color="#FFF" />
                  </View>
                  <Text style={[styles.modalOptionText, styles.logoutText]}>Logout</Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </Pressable>
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
    marginTop: 16,
    fontSize: 16,
    color: '#667eea',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: isSmallScreen ? 12 : isTablet ? 24 : 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : isTablet ? 24 : 16,
    paddingTop: Platform.OS === 'ios' ? 16 : StatusBar.currentHeight,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerTitle: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '700',
    color: '#333',
    letterSpacing: -0.5,
  },
  headerButton: {
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  headerButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 24,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarContainer: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarBorder: {
    width: isSmallScreen ? 70 : isTablet ? 100 : 80,
    height: isSmallScreen ? 70 : isTablet ? 100 : 80,
    borderRadius: isSmallScreen ? 35 : isTablet ? 50 : 40,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: isSmallScreen ? 32 : isTablet ? 47 : 37,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: isSmallScreen ? 32 : isTablet ? 47 : 37,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CD964',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: isSmallScreen ? 12 : 16,
  },
  userName: {
    fontSize: isSmallScreen ? 18 : isTablet ? 24 : 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: isSmallScreen ? 13 : 14,
    color: '#666',
    marginBottom: 6,
  },
  memberSinceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  memberSince: {
    fontSize: 11,
    color: '#888',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginBottom: 24,
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 16 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: isSmallScreen ? 40 : 44,
    height: isSmallScreen ? 40 : 44,
    borderRadius: isSmallScreen ? 20 : 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
    color: '#333',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 4,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: -0.3,
  },
  actionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  actionCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallScreen ? 14 : 16,
  },
  actionIconContainer: {
    width: isSmallScreen ? 40 : 44,
    height: isSmallScreen ? 40 : 44,
    borderRadius: isSmallScreen ? 12 : 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  chevronContainer: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalGradient: {
    paddingVertical: 8,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOptionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 12,
  },
  logoutOption: {
    // No additional styles needed
  },
  logoutText: {
    color: '#FF6B6B',
  },
});

export default ProfileScreen;