import React, { useState, useRef, useEffect } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  View,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendOTP } from '../../api/auth';
import { Country, countries } from '../../auth/screens/home/countries';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';


const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const shakeAnimation = new Animated.Value(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.clear().then(() => {
      console.log('AsyncStorage cleared');
    });
  }, []);

  const handleContinue = async () => {
    if (!mobileNumber) {
      setError('Please enter mobile number');
      shakeInput();
      return;
    }

    if (mobileNumber.length < 6) {
      setError(`Mobile number must be at least ${selectedCountry.minLength} digits`);
      shakeInput();
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const fullNumber = mobileNumber;
      const response = await sendOTP(fullNumber);

      if (response?.status == 200) {
        navigation.navigate('OTP', { userInput: fullNumber });
      } else {
        setError(response?.data?.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong. Try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setMobileNumber(numericText.slice(0, selectedCountry.maxLength));
    setError('');
  };

  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const animatedStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setShowCountryPicker(false);
        inputRef.current?.focus();
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={styles.countryCode}>{item.dialCode}</Text>
      {selectedCountry.code === item.code && (
        <Icon name="checkmark" size={20} color="#FF6B00" style={styles.selectedIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image
              source={require('../../../assets/eatoorweb.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Enter your phone number to get started</Text>

            <Animated.View style={[styles.inputContainer, animatedStyle]}>
              <View style={[styles.phoneInputContainer, error ? styles.inputErrorContainer : null, isFocused && styles.inputFocusedContainer]}>
                <TouchableOpacity
                  style={styles.countryPicker}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.dialCodeText}>{selectedCountry.dialCode}</Text>
                  <Icon 
                    name="chevron-down" 
                    size={18} 
                    color={isFocused ? '#FF6B00' : '#666'} 
                    style={styles.chevronIcon}
                  />
                </TouchableOpacity>
                <View style={styles.separatorVertical} />
                <TextInput
                  ref={inputRef}
                  placeholder="Phone number"
                  style={styles.input}
                  placeholderTextColor="#999"
                  value={mobileNumber}
                  onChangeText={handleInputChange}
                  keyboardType="number-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                  textAlignVertical="center"
                  maxLength={selectedCountry.maxLength}
                  editable={!isLoading}
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Animated.View>

            <TouchableOpacity
              style={[
                styles.button,
                (mobileNumber.length < selectedCountry.minLength || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleContinue}
              disabled={mobileNumber.length < selectedCountry.minLength || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Continue</Text>
                  <Icon name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.highlightText}>Terms of Service</Text> and{' '}
              <Text style={styles.highlightText}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>

        {/* Country Picker Modal */}
        <Modal
          visible={showCountryPicker}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCountryPicker(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countries}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="always"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.modalContent}
            />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: height * 0.05,
    marginTop: height * 0.05,
  },
  logo: {
    width: width * 0.6,
    height: width * 0.2,
    marginBottom: 10,
  },
  content: {
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    height: 56,
  },
  inputErrorContainer: {
    borderColor: '#ff4444',
  },
  inputFocusedContainer: {
    borderColor: '#FF6B00',
    backgroundColor: '#fff',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  dialCodeText: {
    fontSize: 16,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
  },
  separatorVertical: {
    height: 24,
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
    includeFontPadding: false,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
  },
  error: {
    color: '#ff4444',
    fontSize: 14,
    marginTop: 8,
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  button: {
    backgroundColor: '#FF6B00',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#FFA76B',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  termsText: {
    color: '#999',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  highlightText: {
    color: '#FF6B00',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  // Country Picker Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  modalContent: {
    paddingBottom: 20,
  },
  closeButton: {
    padding: 4,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 24,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  countryCode: {
    fontSize: 16,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    marginRight: 10,
  },
  selectedIcon: {
    marginLeft: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginLeft: 24,
  },
});

export default LoginScreen;