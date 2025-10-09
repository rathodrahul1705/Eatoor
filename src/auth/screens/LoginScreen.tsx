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
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current; // Start with value 1 to prevent blank screen
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
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          navigation.navigate('OTP', { userInput: fullNumber });
        });
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
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
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
            {/* Top Image Section */}
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: 'https://eatoorprod.s3.amazonaws.com/uploads/7b4762adb1e841d6b248ecd5b8ff55c2.jpg' }}
                style={styles.topImage}
                resizeMode="cover"
              />
            </View>

            {/* Card-like Form Section */}
            <View style={styles.cardContainer}>
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
  },
  scrollContainerKeyboardVisible: {
    paddingBottom: Platform.OS === 'ios' ? (isSmallDevice ? 120 : 100) : 20,
  },
  imageContainer: {
    width: '100%',
    height: isSmallDevice ? height * 0.3 : height * 0.35,
  },
  topImage: {
    width: '100%',
    height: '100%',
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingTop: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  content: {
    paddingHorizontal: 25,
    paddingBottom: Platform.OS === 'ios' ? (isSmallDevice ? 15 : 30) : 20,
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
    marginLeft: 8,
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
  // Country Picker Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallDevice ? 20 : 24,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
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