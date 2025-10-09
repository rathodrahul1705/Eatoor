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
  BackHandler
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { StackActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfileDetails } from '../../../api/profile';
import { AuthContext } from '../../../context/AuthContext';

const ProfileScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalPosition, setModalPosition] = useState({ top: 0, right: 0 });
  const [user, setUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useContext(AuthContext);

  // Gradient colors
  const gradientStart = '#E65C00';
  const gradientEnd = '#DD2476';

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.navigate('HomeTabs');
        return true; // Prevent default behavior
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

  const handleMenuPress = (event) => {
    const { pageY, pageX } = event.nativeEvent;
    const windowWidth = Dimensions.get('window').width;
    const windowHeight = Dimensions.get('window').height;
    
    // Calculate modal position with boundary checks
    const modalWidth = 180;
    const modalHeight = 100;
    
    let top = pageY + 10;
    let right = windowWidth - pageX - 20;
    
    // Ensure modal doesn't go off screen
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
          <ActivityIndicator size="large" color={gradientStart} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* Header with back button and menu */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={handleBackPress}
          style={styles.headerButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Icon name={Platform.OS === 'ios' ? "chevron-back" : "arrow-back"} size={24} color="#333" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Profile</Text>
        
        <TouchableOpacity 
          onPress={handleMenuPress}
          style={styles.headerButton}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Icon name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[gradientStart, gradientEnd]}
              style={styles.avatarBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {user.avatar && user.avatar !== 'https://randomuser.me/api/portraits/men/1.jpg' ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <Icon name="person" size={40} color="#FFF" />
              )}
            </LinearGradient>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            {user.email && user.email.includes('@eatoor.com') ? (
              <Text style={styles.userDetail}>{user?.contact}</Text>
            ) : (
              <Text style={styles.userDetail}>{user.email}</Text>
            )}
            <Text style={styles.memberSince}>Member since {user.memberSince}</Text>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer]}>
              <Icon name="cart-outline" size={20} color="#FFF" />
            </View>
            <Text style={styles.statValue}>{userDetails?.orders || user.orders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer]}>
              <Icon name="heart-outline" size={20} color="#FFF" />
            </View>
            <Text style={styles.statValue}>{userDetails?.favorites || user.favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <View style={[styles.statIconContainer]}>
              <Icon name="star-outline" size={20} color="#FFF" />
            </View>
            <Text style={styles.statValue}>{userDetails?.reviews || user.rating}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('OrdersScreen')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFEFE5' }]}>
              <Icon name="cart-outline" size={22} color={gradientStart} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Your Orders</Text>
              <Text style={styles.actionSubtitle}>View and track your orders</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('FavoritesScreen')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFEFE5' }]}>
              <Icon name="heart-outline" size={22} color={gradientStart} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Favorites</Text>
              <Text style={styles.actionSubtitle}>Your saved items</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={handleEditProfile}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFEFE5' }]}>
              <Icon name="person-outline" size={22} color={gradientStart} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionSubtitle}>Update your information</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('AddressScreen', {prevLocation: "ProfileScreen"})}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#FFEFE5' }]}>
              <Icon name="location-outline" size={22} color={gradientStart} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Addresses</Text>
              <Text style={styles.actionSubtitle}>Manage your addresses</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Options Modal */}
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
          <View style={[
            styles.modalContent,
            { 
              top: modalPosition.top,
              right: modalPosition.right,
              width: 180
            }
          ]}>
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={handleEditProfile}
            >
              <Icon name="create-outline" size={18} color="#333" style={styles.optionIcon} />
              <Text style={styles.modalOptionText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalOption, styles.logoutOption]}
              onPress={handleLogout}
            >
              <Icon name="log-out-outline" size={18} color="#E65C00" style={styles.optionIcon} />
              <Text style={[styles.modalOptionText, styles.logoutText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : StatusBar.currentHeight + 16,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarBorder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  avatarImage: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#E65C00',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginLeft: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalContent: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionIcon: {
    marginRight: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  logoutOption: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  logoutText: {
    color: '#E65C00',
  },
});

export default ProfileScreen;