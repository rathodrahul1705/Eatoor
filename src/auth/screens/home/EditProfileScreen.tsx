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
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const EditProfileScreen = ({ route }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState({
    email: false,
    contact: false
  });
  const [isVerified, setIsVerified] = useState({
    email: false,
    contact: false
  });
  const [otpSent, setOtpSent] = useState({
    email: false,
    contact: false
  });
  const [otp, setOtp] = useState({
    email: '',
    contact: ''
  });
  const [showOtpFields, setShowOtpFields] = useState({
    email: false,
    contact: false
  });
  
  const [user, setUser] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    contact: '+1 234 567 8901'
  });

  const handleChange = (field, value) => {
    setUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOtpChange = (field, value) => {
    setOtp(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const sendOtp = async (type) => {
    try {
      setVerificationLoading(prev => ({ ...prev, [type]: true }));
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setOtpSent(prev => ({ ...prev, [type]: true }));
      setShowOtpFields(prev => ({ ...prev, [type]: true }));
      Alert.alert('OTP Sent', `Verification code has been sent to your ${type}`);
    } catch (error) {
      Alert.alert('Error', `Failed to send OTP to ${type}`);
    } finally {
      setVerificationLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const verifyOtp = async (type) => {
    try {
      setVerificationLoading(prev => ({ ...prev, [type]: true }));
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (otp[type].length === 6) {
        setIsVerified(prev => ({ ...prev, [type]: true }));
        setShowOtpFields(prev => ({ ...prev, [type]: false }));
        Alert.alert('Verified', `${type.charAt(0).toUpperCase() + type.slice(1)} verified successfully`);
      } else {
        Alert.alert('Invalid OTP', 'Please enter a valid 6-digit code');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to verify ${type}`);
    } finally {
      setVerificationLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
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
          disabled={loading}
          style={styles.saveButton}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FF5E00" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture Placeholder */}
          <View style={styles.profilePictureContainer}>
            <View style={styles.profilePicture}>
              <Icon name="person" size={60} color="#FF5E00" />
            </View>
            <TouchableOpacity style={styles.editPictureButton}>
              <Icon name="camera" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Name Field */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={user.name}
                  onChangeText={(text) => handleChange('name', text)}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>

          {/* Email Field with Verification */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                {isVerified.email ? (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>Verified</Text>
                    <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                  </View>
                ) : null}
              </View>
              
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, !isVerified.email && styles.editableInput]}
                  value={user.email}
                  onChangeText={(text) => handleChange('email', text)}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isVerified.email}
                  placeholderTextColor="#999"
                />
                {!isVerified.email && (
                  <TouchableOpacity 
                    style={styles.verifyButton}
                    onPress={() => sendOtp('email')}
                    disabled={verificationLoading.email}
                  >
                    {verificationLoading.email ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyButtonText}>
                        {otpSent.email ? 'Resend' : 'Verify'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              
              {showOtpFields.email && (
                <View style={styles.otpContainer}>
                  <View style={styles.otpInputWrapper}>
                    <TextInput
                      style={styles.otpInput}
                      value={otp.email}
                      onChangeText={(text) => handleOtpChange('email', text)}
                      placeholder="Enter OTP"
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholderTextColor="#999"
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.verifyOtpButton}
                    onPress={() => verifyOtp('email')}
                    disabled={verificationLoading.email}
                  >
                    {verificationLoading.email ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyOtpButtonText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Contact Field with Verification */}
            <View style={styles.inputContainer}>
              <View style={styles.labelContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                {isVerified.contact ? (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>Verified</Text>
                    <Icon name="checkmark-circle" size={16} color="#4CAF50" />
                  </View>
                ) : null}
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
                {!isVerified.contact && (
                  <TouchableOpacity 
                    style={styles.verifyButton}
                    onPress={() => sendOtp('contact')}
                    disabled={verificationLoading.contact}
                  >
                    {verificationLoading.contact ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyButtonText}>
                        {otpSent.contact ? 'Resend' : 'Verify'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              
              {showOtpFields.contact && (
                <View style={styles.otpContainer}>
                  <View style={styles.otpInputWrapper}>
                    <TextInput
                      style={styles.otpInput}
                      value={otp.contact}
                      onChangeText={(text) => handleOtpChange('contact', text)}
                      placeholder="Enter OTP"
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholderTextColor="#999"
                    />
                  </View>
                  <TouchableOpacity 
                    style={styles.verifyOtpButton}
                    onPress={() => verifyOtp('contact')}
                    disabled={verificationLoading.contact}
                  >
                    {verificationLoading.contact ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.verifyOtpButtonText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
  },
  profilePicture: {
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
    right: 100,
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  },
  verifyOtpButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EditProfileScreen;