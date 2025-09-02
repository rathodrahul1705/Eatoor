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
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
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
    
    setModalPosition({
      top: pageY + 10,
      right: windowWidth - pageX - 20
    });
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

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5E00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header with back button and menu */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('HomeTabs')}
          style={styles.headerButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={handleMenuPress}
          style={styles.headerButton}
        >
          <Icon name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Profile Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarBorder}>
            <Icon name="person" size={60} color="#FF5E00" />
          </View>
        </View>
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          {user.email && user.email.includes('@eatoor.com') ? (
            <Text style={styles.userDetail}>{user?.contact}</Text>
          ) : (
            <Text style={styles.userDetail}>{user.email}</Text>
          )}
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Icon name="cart-outline" size={24} color="#FF5E00" />
          <Text style={styles.statValue}>{userDetails?.orders || user.orders}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="heart-outline" size={24} color="#FF5E00" />
          <Text style={styles.statValue}>{userDetails?.favorites || user.favorites}</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="star-outline" size={24} color="#FF5E00" />
          <Text style={styles.statValue}>{userDetails?.reviews}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      <ScrollView style={styles.contentContainer}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('OrdersScreen')}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(255, 94, 0, 0.1)' }]}>
              <Icon name="cart-outline" size={22} color="#FF5E00" />
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
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(255, 94, 0, 0.1)' }]}>
              <Icon name="heart-outline" size={22} color="#FF5E00" />
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
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(255, 94, 0, 0.1)' }]}>
              <Icon name="person-outline" size={22} color="#FF5E00" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Edit Profile</Text>
              <Text style={styles.actionSubtitle}>Update your information</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('AddressScreen',{prevLocation:"ProfileScreen"})}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(255, 94, 0, 0.1)' }]}>
              <Icon name="location-outline" size={30} color="#FF5E00" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Addresses</Text>
              <Text style={styles.actionSubtitle}>Your saved items</Text>
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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Platform.OS === 'android' ? 20 : 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarBorder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FF5E00',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 3,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userInfo: {
    flex: 1,
    marginLeft: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  memberSince: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginHorizontal: 20,
    borderRadius: 15,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF5E00',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contentContainer: {
    flex: 1,
    marginTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 15,
    marginLeft: 5,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalContent: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  optionIcon: {
    marginRight: 12,
  },
  modalOptionText: {
    fontSize: 14,
    color: '#333',
  },
  logoutOption: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  logoutText: {
    color: '#E65C00',
  },
});

export default ProfileScreen;