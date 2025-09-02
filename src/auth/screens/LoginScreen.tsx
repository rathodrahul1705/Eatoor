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
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendOTP } from '../../api/auth';
import { Country, countries } from '../../auth/screens/home/countries';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Check if device is small screen
const isSmallDevice = height < 700;

// Color scheme
const primaryColor = '#E65C00';
const secondaryColor = '#F9F9F9';
const textColor = '#333';
const borderColor = '#E0E0E0';
const errorColor = '#FF4444';
const placeholderColor = '#999';

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Clear AsyncStorage on component mount
    AsyncStorage.clear().then(() => {
      console.log('AsyncStorage cleared');
    });

    // Keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleContinue = async () => {
    if (!mobileNumber) {
      setError('Please enter mobile number');
      shakeInput();
      return;
    }

    if (mobileNumber.length < selectedCountry.minLength) {
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
        <Icon name="checkmark" size={20} color={primaryColor} style={styles.selectedIcon} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (isSmallDevice ? 40 : 20) : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContainer,
            keyboardVisible && Platform.OS === 'ios' && styles.scrollContainerKeyboardVisible
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../../assets/eatoormob.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName}>EATOOR</Text>
            </View>
            <Text style={styles.appTagline}>Delicious food at your doorstep</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.formContainer}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Enter your phone number to get started</Text>

              <Animated.View style={[styles.inputContainer, animatedStyle]}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                        color={isFocused ? primaryColor : placeholderColor} 
                        style={styles.chevronIcon}
                      />
                    </TouchableOpacity>
                    <View style={styles.separatorVertical} />
                    <TextInput
                      ref={inputRef}
                      placeholder="Phone number"
                      style={styles.input}
                      placeholderTextColor={placeholderColor}
                      value={mobileNumber}
                      onChangeText={handleInputChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
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
                </TouchableWithoutFeedback>
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
                Agree and continue{' '}
                <Text
                  style={styles.highlightText}
                  onPress={() => Linking.openURL('https://www.eatoor.com/terms-and-conditions')}
                >
                  Terms
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.highlightText}
                  onPress={() => Linking.openURL('https://www.eatoor.com/privacy-policy')}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Country Picker Modal */}
        <Modal
          visible={showCountryPicker}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowCountryPicker(false)}
              >
                <Icon name="close" size={24} color={textColor} />
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
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: isSmallDevice ? 10 : 20,
  },
  scrollContainerKeyboardVisible: {
    paddingBottom: Platform.OS === 'ios' ? (isSmallDevice ? 120 : 100) : 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: isSmallDevice ? height * 0.04 : height * 0.06,
    marginTop: Platform.OS === 'ios' ? (isSmallDevice ? 5 : 10) : (isSmallDevice ? height * 0.02 : height * 0.05),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logo: {
    width: isSmallDevice ? 32 : 40,
    height: isSmallDevice ? 32 : 40,
    marginRight: 10,
  },
  appName: {
    fontSize: isSmallDevice ? 28 : 32,
    fontWeight: '800',
    color: primaryColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  appTagline: {
    fontSize: isSmallDevice ? 14 : 16,
    color: placeholderColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  content: {
    paddingHorizontal: 25,
    marginBottom: Platform.OS === 'ios' ? (isSmallDevice ? 15 : 30) : 0,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: isSmallDevice ? 20 : 25,
  },
  title: {
    fontSize: isSmallDevice ? 24 : 28,
    fontWeight: '700',
    textAlign: 'center',
    color: textColor,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: isSmallDevice ? 14 : 16,
    color: placeholderColor,
    textAlign: 'center',
    marginBottom: isSmallDevice ? 20 : 30,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: isSmallDevice ? 20 : 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: borderColor,
    borderRadius: 14,
    backgroundColor: secondaryColor,
    paddingHorizontal: 16,
    height: isSmallDevice ? 50 : 56,
  },
  inputErrorContainer: {
    borderColor: errorColor,
  },
  inputFocusedContainer: {
    borderColor: primaryColor,
    backgroundColor: '#fff',
    shadowColor: primaryColor,
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
    fontSize: isSmallDevice ? 20 : 24,
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  dialCodeText: {
    fontSize: isSmallDevice ? 14 : 16,
    color: textColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
  },
  separatorVertical: {
    height: isSmallDevice ? 20 : 24,
    width: 1,
    backgroundColor: borderColor,
    marginHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: isSmallDevice ? 14 : 16,
    color: textColor,
    height: '100%',
    includeFontPadding: false,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
  },
  error: {
    color: errorColor,
    fontSize: isSmallDevice ? 12 : 14,
    marginTop: 8,
    marginLeft: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  button: {
    backgroundColor: primaryColor,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    height: Platform.OS === 'ios' ? (isSmallDevice ? 45 : 50) : (isSmallDevice ? 48 : 54),
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: isSmallDevice ? 14 : 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  termsText: {
    color: placeholderColor,
    fontSize: isSmallDevice ? 10 : 12,
    textAlign: 'center',
    marginTop: isSmallDevice ? 18 : 24,
    lineHeight: isSmallDevice ? 16 : 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  highlightText: {
    color: primaryColor,
    fontWeight: '500',
  },
  // Country Picker Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallDevice ? 15 : 20,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
  },
  modalTitle: {
    fontSize: isSmallDevice ? 18 : 20,
    fontWeight: '600',
    color: textColor,
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
    padding: isSmallDevice ? 12 : 16,
    paddingHorizontal: isSmallDevice ? 20 : 24,
  },
  countryName: {
    flex: 1,
    fontSize: isSmallDevice ? 14 : 16,
    color: textColor,
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  countryCode: {
    fontSize: isSmallDevice ? 14 : 16,
    color: placeholderColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    marginRight: 10,
  },
  selectedIcon: {
    marginLeft: 10,
  },
  separator: {
    height: 1,
    backgroundColor: borderColor,
    marginLeft: isSmallDevice ? 20 : 24,
  },
});

export default LoginScreen;