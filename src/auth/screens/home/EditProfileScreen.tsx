import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { updatePersonalDetails, sendEmailOTP, verifyEmailOTP } from '../../../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserData = {
  name: string;
  email: string;
  contact: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  profilePicture?: string;
};

type VerificationState = {
  email: boolean;
  contact: boolean;
};

type OTPState = {
  email: string;
  contact: string;
};

type OTPVisibility = {
  email: boolean;
  contact: boolean;
};

type OTPStatus = {
  email: boolean;
  contact: boolean;
};

type LoadingState = {
  email: boolean;
  contact: boolean;
  save: boolean;
};

const EditProfileScreen = ({ route }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState<LoadingState>({
    email: false,
    contact: false,
    save: false
  });
  const [isVerified, setIsVerified] = useState<VerificationState>({
    email: false,
    contact: false
  });
  const [otp, setOtp] = useState<OTPState>({
    email: '',
    contact: ''
  });
  const [showOtpFields, setShowOtpFields] = useState<OTPVisibility>({
    email: false,
    contact: false
  });
  const [otpSent, setOtpSent] = useState<OTPStatus>({
    email: false,
    contact: false
  });
  
  const [user, setUser] = useState<UserData>({
    name: '',
    email: '',
    contact: ''
  });

  console.log("isVerified===",isVerified)
  // Email validation helper
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Load user data from route params or AsyncStorage
  useEffect(() => {
    const loadUserData = async () => {
      try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser({
              name: parsedUser.full_name || '',
              email: (parsedUser.email && !parsedUser.email.includes('@eatoor.com')) ? parsedUser.email : '',
              contact: parsedUser.contact_number || '',
            });
            setIsVerified({
              email: parsedUser.is_email_verified || false,
              contact: parsedUser.is_mobile_verified || false
            });
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, [route.params?.user]);

  const handleChange = (field: keyof UserData, value: string) => {
    setUser(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Reset verification status if email/contact is changed
    if (field === 'email' && value !== route.params?.user?.email) {
      setIsVerified(prev => ({ ...prev, email: false }));
      setShowOtpFields(prev => ({ ...prev, email: false }));
      setOtp(prev => ({ ...prev, email: '' }));
      setOtpSent(prev => ({ ...prev, email: false }));
    }
    if (field === 'contact' && value !== route.params?.user?.contact) {
      setIsVerified(prev => ({ ...prev, contact: false }));
      setShowOtpFields(prev => ({ ...prev, contact: false }));
      setOtp(prev => ({ ...prev, contact: '' }));
      setOtpSent(prev => ({ ...prev, contact: false }));
    }
  };

  const handleOtpChange = (field: keyof OTPState, value: string) => {
    // Only allow numbers and limit to 6 digits
    const cleanedValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setOtp(prev => ({
      ...prev,
      [field]: cleanedValue
    }));
  };

  const sendOtp = async (type: keyof VerificationState) => {
    try {
      setLoading(prev => ({ ...prev, [type]: true }));

      const targetField = type === 'email' ? user.email : user.contact;
      
      if (!targetField) {
        Alert.alert('Error', `Please enter your ${type} first`);
        return;
      }

      if (type === 'email' && !validateEmail(targetField)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }

      // For this example, we'll only implement email OTP
      if (type === 'email') {
        const response = await sendEmailOTP(targetField);
        if (response.status === 200) {
          setOtpSent(prev => ({ ...prev, [type]: true }));
          setShowOtpFields(prev => ({ ...prev, [type]: true }));
          Alert.alert('OTP Sent', 'Verification code has been sent to your email');
        } else {
          Alert.alert('Error', response.data.message || 'Failed to send OTP');
        }
      } else {
        // Phone OTP implementation would go here
        Alert.alert('Info', 'Phone verification is not implemented in this example');
      }
    } catch (error) {
      console.error(`Error sending ${type} OTP:`, error);
      Alert.alert(
        'Error',
        error.response?.data?.message || `Failed to send ${type} OTP. Please try again.`
      );
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const verifyOtp = async (type: keyof VerificationState) => {
    try {
      if (otp[type].length !== 6) {
        Alert.alert('Invalid OTP', 'Please enter a valid 6-digit code');
        return;
      }

      setLoading(prev => ({ ...prev, [type]: true }));

      // For this example, we'll only implement email OTP verification
      if (type === 'email') {
        const response = await verifyEmailOTP({ 
          email: user.email, 
          otp: otp[type] 
        });

        if (response.status = 200) {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            const updatedUser = {
              ...parsedUser,
              email: user.email,
              is_email_verified: true,
            };
            await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
          }

          setIsVerified(prev => ({ ...prev, [type]: true }));
          setShowOtpFields(prev => ({ ...prev, [type]: false }));
          setOtp(prev => ({ ...prev, [type]: '' }));
          setOtpSent(prev => ({ ...prev, [type]: false }));
          Alert.alert('Verified', `${type} verified successfully`);
        } else {
          Alert.alert('Error', response.data.message || `Failed to verify ${type}`);
        }
      } else {
        // Phone OTP verification would go here
        Alert.alert('Info', 'Phone verification is not implemented in this example');
      }
    } catch (error) {
      console.error(`Error verifying ${type}:`, error);
      Alert.alert(
        'Error',
        error.response?.data?.message || `Failed to verify ${type}. Please try again.`
      );
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    try {
      setLoading(prev => ({ ...prev, save: true }));
      
      // Check if email has changed but not verified
      if (user.email !== route.params?.user?.email && !isVerified.email) {
        Alert.alert('Verification Required', 'Please verify your new email before saving');
        return;
      }
      
      // Check if contact has changed but not verified (if implemented)
      if (user.contact !== route.params?.user?.contact && !isVerified.contact) {
        Alert.alert('Verification Required', 'Please verify your new phone number before saving');
        return;
      }

      const payload = {
        full_name: user.name,
        ...(user.email !== route.params?.user?.email && { email: user.email }),
        ...(user.contact !== route.params?.user?.contact && { contact_number: user.contact })
      };

      // Check if there are actual changes
      const hasChanges = (
        user.name !== route.params?.user?.name ||
        user.email !== route.params?.user?.email ||
        user.contact !== route.params?.user?.contact
      );

      if (!hasChanges) {
        Alert.alert('No Changes', 'No changes were made to your profile');
        return;
      }

      const response = await updatePersonalDetails(payload);
      if (response.status === 200) {
        await AsyncStorage.multiSet([
          ['user', JSON.stringify(response.data.user)]
        ]);

        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Error', 
        error.response?.data?.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setLoading(prev => ({ ...prev, save: false }));
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Icon name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Edit Profile</Text>
      <TouchableOpacity 
        onPress={handleSave} 
        disabled={loading.save}
        style={styles.saveButton}
      >
        {loading.save ? (
          <ActivityIndicator size="small" color="#FF5E00" />
        ) : (
          <Text style={styles.saveButtonText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderProfilePicture = () => (
    <View style={styles.profilePictureContainer}>
      {user.profilePicture ? (
        <Image 
          source={{ uri: user.profilePicture }} 
          style={styles.profilePicture}
        />
      ) : (
        <View style={styles.profilePicturePlaceholder}>
          <Icon name="person" size={60} color="#FF5E00" />
        </View>
      )}
      <TouchableOpacity style={styles.editPictureButton}>
        <Icon name="camera" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderNameField = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>Full Name</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={user.name}
          onChangeText={(text) => handleChange('name', text)}
          placeholder="Enter your full name"
          placeholderTextColor="#999"
          autoCapitalize="words"
        />
      </View>
    </View>
  );

  const renderVerificationBadge = (type: keyof VerificationState) => (
    <View style={styles.verifiedBadge}>
      <Text style={styles.verifiedText}>Verified</Text>
      <Icon name="checkmark-circle" size={16} color="#4CAF50" />
    </View>
  );

  const renderVerifyButton = (type: keyof VerificationState) => (
    <TouchableOpacity 
      style={styles.verifyButton}
      onPress={() => sendOtp(type)}
      disabled={loading[type]}
    >
      {loading[type] ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.verifyButtonText}>
          {otpSent[type] ? 'Resend' : 'Verify'}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderOtpField = (type: keyof VerificationState) => (
    <View style={styles.otpContainer}>
      <View style={styles.otpInputWrapper}>
        <TextInput
          style={styles.otpInput}
          value={otp[type]}
          onChangeText={(text) => handleOtpChange(type, text)}
          placeholder="Enter 6-digit OTP"
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor="#999"
        />
      </View>
      <TouchableOpacity 
        style={[
          styles.verifyOtpButton,
          otp[type].length !== 6 && styles.disabledButton
        ]}
        onPress={() => verifyOtp(type)}
        disabled={loading[type] || otp[type].length !== 6}
      >
        {loading[type] ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.verifyOtpButtonText}>Verify</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  console.log("user==",user)
  const renderEmailField = () => (
    <View style={styles.inputContainer}>
      <View style={styles.labelContainer}>
        <Text style={styles.inputLabel}>Email Address</Text>
        {isVerified.email && renderVerificationBadge('email')}
      </View>
      
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, !isVerified.email && styles.editableInput]}
          value={user.email}
          onChangeText={(text) => handleChange('email', text)}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          // editable={!isVerified.email}
          placeholderTextColor="#999"
        />
        {!isVerified.email && renderVerifyButton('email')}
      </View>
      
      {showOtpFields.email && !isVerified.email && renderOtpField('email')}
    </View>
  );

  const renderContactField = () => (
    <View style={styles.inputContainer}>
      <View style={styles.labelContainer}>
        <Text style={styles.inputLabel}>Phone Number</Text>
        {isVerified.contact && renderVerificationBadge('contact')}
      </View>
      
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, !isVerified.contact && styles.editableInput]}
          value={user.contact}
          onChangeText={(text) => handleChange('contact', text)}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
          editable={!isVerified.contact}
          placeholderTextColor="#999"
        />
        {!isVerified.contact && renderVerifyButton('contact')}
      </View>
      
      {showOtpFields.contact && !isVerified.contact && renderOtpField('contact')}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {renderHeader()}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderProfilePicture()}

          {/* Personal Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            {renderNameField()}
          </View>

          {/* Contact Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            {renderEmailField()}
            {renderContactField()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF5E00',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#FF5E00',
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF5E00',
  },
  editPictureButton: {
    position: 'absolute',
    right: '35%',
    bottom: 0,
    backgroundColor: '#FF5E00',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  section: {
    marginBottom: 25,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginRight: 4,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 15,
  },
  editableInput: {
    color: '#000',
  },
  verifyButton: {
    backgroundColor: '#FF5E00',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginLeft: 10,
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  otpInputWrapper: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#eee',
    marginRight: 10,
  },
  otpInput: {
    fontSize: 16,
    color: '#000',
    paddingVertical: 15,
  },
  verifyOtpButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  verifyOtpButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default EditProfileScreen;