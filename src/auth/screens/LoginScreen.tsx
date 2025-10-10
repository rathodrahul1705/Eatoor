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

// Modern color scheme
const primaryColor = '#FF7E33'; // Vibrant orange
const secondaryColor = '#FFFFFF';
const accentColor = '#FFE8D9'; // Light orange for backgrounds
const textColor = '#2D2D2D';
const lightTextColor = '#7B7B7B';
const borderColor = '#F0F0F0';
const errorColor = '#FF4444';

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries.find(country => country.code === 'IN') || countries[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Clear AsyncStorage on component mount
    const clearStorage = async () => {
      try {
        await AsyncStorage.clear();
        console.log('AsyncStorage cleared');
      } catch (error) {
        console.log('Error clearing AsyncStorage:', error);
      }
    };
    clearStorage();

    // Keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        const keyboardHeight = e.endCoordinates.height;
        setKeyboardHeight(keyboardHeight);
        
        // Scroll to input when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 100, animated: true });
        }, 100);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
        // Scroll back to top when keyboard hides
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Reset fade animation when screen comes back into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });

    return unsubscribe;
  }, [navigation, fadeAnim]);

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
        // Success animation before navigation
          navigation.navigate('OTP', { userInput: fullNumber });
      } else {
        setError(response?.data?.message || 'Failed to send OTP. Please try again.');
        shakeInput();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong. Try again.';
      setError(msg);
      shakeInput();
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    // Remove all non-digit characters and limit to maxLength
    const numericText = text.replace(/[^0-9]/g, '');
    
    // Auto-detect and remove country code if it matches selected country
    let processedText = numericText;
    const countryDialCodeWithoutPlus = selectedCountry.dialCode.replace('+', '');
    
    // Check if input starts with country code and remove it
    if (numericText.startsWith(countryDialCodeWithoutPlus)) {
      processedText = numericText.slice(countryDialCodeWithoutPlus.length);
    }
    
    // Also check for common country codes that might be auto-filled
    const commonCountryCodes = ['91', '1', '44', '86', '81', '49', '33', '7', '39', '34'];
    for (const code of commonCountryCodes) {
      if (numericText.startsWith(code) && numericText.length > code.length) {
        // Only remove if the remaining digits are valid phone number length
        const remainingDigits = numericText.slice(code.length);
        if (remainingDigits.length >= 7 && remainingDigits.length <= 15) {
          processedText = remainingDigits;
          break;
        }
      }
    }
    
    setMobileNumber(processedText.slice(0, selectedCountry.maxLength));
    setError('');
  };

  // Handle autofill specifically for contacts
  const handleAutoFill = (text: string) => {
    console.log('Autofill text:', text);
    
    // Remove all non-digit characters including +, spaces, hyphens
    const cleanText = text.replace(/[^0-9]/g, '');
    
    if (!cleanText) {
      setMobileNumber('');
      return;
    }

    let finalNumber = cleanText;
    
    // Remove country code if present (for India +91)
    if (cleanText.startsWith('91') && cleanText.length > 10) {
      finalNumber = cleanText.slice(2);
    }
    
    // Remove leading 0 if present (some countries use 0 after country code)
    if (finalNumber.startsWith('0') && finalNumber.length > 10) {
      finalNumber = finalNumber.slice(1);
    }
    
    // Limit to 10 digits for Indian numbers
    if (selectedCountry.code === 'IN') {
      finalNumber = finalNumber.slice(0, 10);
    } else {
      finalNumber = finalNumber.slice(0, selectedCountry.maxLength);
    }
    
    console.log('Processed number:', finalNumber);
    setMobileNumber(finalNumber);
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

  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery)
  );

  const animatedStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setShowCountryPicker(false);
        setSearchQuery('');
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
      
      {/* Country Picker Modal - Positioned above everything */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCountryPicker(false)}
        statusBarTranslucent={false}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => {
                setShowCountryPicker(false);
                setSearchQuery('');
              }}
            >
              <Icon name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color={lightTextColor} style={styles.searchIcon} />
            <TextInput
              placeholder="Search country"
              style={styles.searchInput}
              placeholderTextColor={lightTextColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
          </View>
          
          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="always"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.modalContent}
          />
        </SafeAreaView>
      </Modal>

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {/* Fixed Image Section - Always visible */}
          <View style={[
            styles.imageContainer,
            keyboardVisible && styles.imageContainerWithKeyboard
          ]}>
            <Image
              source={{ uri: 'https://eatoorprod.s3.amazonaws.com/uploads/7b4762adb1e841d6b248ecd5b8ff55c2.jpg' }}
              style={styles.topImage}
              resizeMode="cover"
            />
          </View>

          {/* Scrollable Form Section */}
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContainer,
              { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : 40 }
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
          >
            {/* Card-like Form Section */}
            <View style={[
              styles.cardContainer,
              keyboardVisible && styles.cardContainerWithKeyboard
            ]}>
              <View style={styles.content}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title}>Login or Signup</Text>
                  <Text style={styles.subtitle}>Enter phone number to continue</Text>
                </View>

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
                          color={isFocused ? primaryColor : lightTextColor} 
                          style={styles.chevronIcon}
                        />
                      </TouchableOpacity>
                      <TextInput
                        ref={inputRef}
                        placeholder="Enter phone number"
                        style={styles.input}
                        placeholderTextColor={lightTextColor}
                        value={mobileNumber}
                        onChangeText={handleAutoFill} // Use the improved autofill handler
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
                        autoFocus={false}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                  {error ? (
                    <View style={styles.errorContainer}>
                      <Icon name="alert-circle" size={16} color={errorColor} />
                      <Text style={styles.error}>{error}</Text>
                    </View>
                  ) : null}
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
                  Continue to agree {' '}
                  <Text
                    style={styles.highlightText}
                    onPress={() => Linking.openURL('https://www.eatoor.com/terms-and-conditions')}
                  >
                    Terms of Service
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
        </KeyboardAvoidingView>
      </Animated.View>
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
    paddingTop: isSmallDevice ? height * 0.3 : height * 0.35,
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: isSmallDevice ? height * 0.3 : height * 0.35,
    zIndex: 1,
  },
  imageContainerWithKeyboard: {
    height: isSmallDevice ? height * 0.2 : height * 0.25,
  },
  topImage: {
    width: '100%',
    height: '100%',
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    minHeight: height * 0.65,
  },
  cardContainerWithKeyboard: {
    minHeight: height * 0.5,
  },
  content: {
    paddingHorizontal: 25,
    paddingBottom: 20,
  },
  titleContainer: {
    marginBottom: isSmallDevice ? 24 : 30,
    alignItems: 'center',
  },
  title: {
    fontSize: isSmallDevice ? 22 : 24,
    fontWeight: '700',
    textAlign: 'center',
    color: textColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: isSmallDevice ? 14 : 16,
    color: lightTextColor,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inputContainer: {
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: borderColor,
    borderRadius: 16,
    backgroundColor: secondaryColor,
    paddingHorizontal: 16,
    height: isSmallDevice ? 56 : 60,
  },
  inputErrorContainer: {
    borderColor: errorColor,
  },
  inputFocusedContainer: {
    borderColor: primaryColor,
    backgroundColor: '#fff',
    shadowColor: primaryColor,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: borderColor,
    marginRight: 12,
  },
  countryFlag: {
    fontSize: isSmallDevice ? 20 : 24,
    marginRight: 8,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  dialCodeText: {
    fontSize: isSmallDevice ? 16 : 17,
    color: textColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: isSmallDevice ? 16 : 17,
    color: textColor,
    height: '100%',
    includeFontPadding: false,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
    paddingVertical: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4,
  },
  error: {
    color: errorColor,
    fontSize: isSmallDevice ? 12 : 14,
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  button: {
    backgroundColor: primaryColor,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: primaryColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    height: Platform.OS === 'ios' ? (isSmallDevice ? 52 : 56) : (isSmallDevice ? 54 : 58),
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
    fontSize: isSmallDevice ? 16 : 17,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  termsText: {
    color: lightTextColor,
    fontSize: isSmallDevice ? 11 : 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: isSmallDevice ? 16 : 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  highlightText: {
    color: primaryColor,
    fontWeight: '500',
  },
  // Country Picker Modal Styles - Ensure it appears above everything
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    zIndex: 1000,
    elevation: 1000,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallDevice ? 20 : 24,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
  },
  modalTitle: {
    fontSize: isSmallDevice ? 20 : 22,
    fontWeight: '700',
    color: textColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: isSmallDevice ? 16 : 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: borderColor,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: textColor,
    paddingVertical: 0,
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
    padding: isSmallDevice ? 14 : 16,
    paddingHorizontal: isSmallDevice ? 20 : 24,
  },
  countryName: {
    flex: 1,
    fontSize: isSmallDevice ? 16 : 17,
    color: textColor,
    marginLeft: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  countryCode: {
    fontSize: isSmallDevice ? 16 : 17,
    color: lightTextColor,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    marginRight: 10,
    fontWeight: '500',
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