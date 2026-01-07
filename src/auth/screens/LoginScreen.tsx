import React, { useState, useRef, useEffect, useContext } from 'react';
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
  Dimensions,
  SafeAreaView,
  StatusBar,
  Linking,
  ScrollView,
  NativeModules
} from 'react-native';

import Clipboard from '@react-native-clipboard/clipboard';

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendOTP } from '../../api/auth';
import { Country, countries } from '../../auth/screens/home/countries';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthContext } from '../../context/AuthContext';

const { AppHash } = NativeModules;
const { width, height } = Dimensions.get('window');

const primaryColor = '#E65C00';
const textColor = '#1C1C1C';
const lightTextColor = '#666666';
const borderColor = '#E8E8E8';
const errorColor = '#D32F2F';
const linkColor = '#E65C00';
const backgroundColor = '#FFFFFF';

// Responsive sizing
const responsiveSize = (size: number) => {
  const baseWidth = 375; // iPhone 6/7/8
  const scale = width / baseWidth;
  return Math.round(size * Math.min(scale, 1.2));
};

const isSmallDevice = width < 375;
const isLargeDevice = width > 414;

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();

  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find((c) => c.code === 'IN') || countries[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appHash, setAppHash] = useState<string>('');

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const { loginAsGuest } = useContext(AuthContext);

  /** ----------------------------------
   *  RUN ANIMATIONS
   * ---------------------------------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        })
      ]).start();
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  /** ----------------------------------
   *  GET APP HASH FOR ANDROID
   * ---------------------------------- */
  useEffect(() => {
    if (Platform.OS === 'android') getAppHash();
  }, []);

  const getAppHash = async () => {
    try {
      const hash = await AppHash.getAppHash();
      console.log('App Hash:', hash);
      setAppHash(hash);
    } catch (error) {
      console.log('App Hash Error:', error);
    }
  };

  /** ----------------------------------
   *  AUTO-FILL PHONE NUMBER FROM CLIPBOARD
   * ---------------------------------- */
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getString();

        // Auto-fill ONLY 10-digit Indian mobile numbers
        if (/^[0-9]{10}$/.test(text)) {
          console.log('Clipboard auto-detected phone:', text);
          setMobileNumber(text);
        }
      } catch (err) {
        console.log('Clipboard read error:', err);
      }
    };

    checkClipboard();
  }, []);

  /** ----------------------------------
   *  SKIP TO HOME TAB
   * ---------------------------------- */
  const handleSkipToHome = () => {
    loginAsGuest()
    navigation.reset({
      index: 0,
      routes: [{ name: 'HomeTabs' }],
    });
  };

  /** ----------------------------------
   *  ON CONTINUE → SEND OTP
   * ---------------------------------- */
  const handleContinue = async () => {
    if (!mobileNumber || mobileNumber.length < selectedCountry.minLength) {
      setError(`Please enter a valid ${selectedCountry.name} number`);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const contact_number = `${mobileNumber}`;

      const payload: any = {
        contact_number,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      };

      if (Platform.OS === 'android' && appHash) {
        payload.app_hash = appHash;
      }

      console.log('Sending OTP payload:', payload);

      const response = await sendOTP(payload);

      if (response?.status === 200) {
        navigation.navigate('OTP', {
          userInput: contact_number,
          appHash: Platform.OS === 'android' ? appHash : undefined,
        });
      } else {
        setError(response?.data?.message || 'Failed to send OTP.');
      }
    } catch (err: any) {
      console.log('Send OTP error:', err);
      setError(err?.response?.data?.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: isSmallDevice ? 80 : 120, animated: true });
    }, 100);
  };

  /** ----------------------------------
   *  COUNTRY SEARCH
   * ---------------------------------- */
  const filteredCountries = countries.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery)
  );

  const renderCountryItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setShowCountryPicker(false);
        setSearchQuery('');
      }}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <View style={styles.countryInfo}>
        <Text style={styles.countryName}>{item.name}</Text>
        <Text style={styles.countryRegion}>{item.region}</Text>
      </View>
      <Text style={styles.countryCode}>{item.dialCode}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ------------------------ */}
      {/* SKIP BUTTON - TOP RIGHT  */}
      {/* ------------------------ */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkipToHome}
        activeOpacity={0.7}
      >
        <Text style={styles.skipText}>Skip</Text>
        <Icon name="arrow-forward" size={16} color={primaryColor} />
      </TouchableOpacity>

      {/* ------------------------ */}
      {/* COUNTRY PICKER MODAL    */}
      {/* ------------------------ */}
      <Modal 
        visible={showCountryPicker} 
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Compact Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowCountryPicker(false)}
            >
              <Icon name="close" size={24} color={textColor} />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Select Country</Text>
            </View>
            <View style={styles.modalCloseButton} />
          </View>

          {/* Compact Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icon name="search-outline" size={18} color={lightTextColor} style={styles.searchIcon} />
              <TextInput
                placeholder="Search country or code..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                placeholderTextColor={lightTextColor}
                autoFocus
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Icon name="close-circle" size={18} color={lightTextColor} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.countryList}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>

      {/* ------------------------ */}
      {/* MAIN CONTENT             */}
      {/* ------------------------ */}
      <View style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoid} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef} 
            contentContainerStyle={styles.scrollContent} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.content}>
                
                {/* LOGO */}
                <View style={styles.logoContainer}>
                  <Image
                    source={{ uri: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png' }}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Food Delivery</Text>
                  </View>
                </View>

                {/* HEADING */}
                <Animated.View style={[styles.headingWithLines, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                  <View style={styles.line} />
                  <Text style={styles.headingTitle}>Login or sign up</Text>
                  <View style={styles.line} />
                </Animated.View>

                {/* INPUT AREA */}
                <Animated.View style={[styles.inputSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

                  <View style={styles.inputContainer}>
                    <View style={styles.inputWrapper}>
                      
                      {/* Country Picker */}
                      <TouchableOpacity 
                        style={styles.countryPicker} 
                        onPress={() => setShowCountryPicker(true)}
                      >
                        <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                        <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                        <Icon name="chevron-down" size={14} color={primaryColor} />
                      </TouchableOpacity>

                      {/* Mobile Input */}
                      <TextInput
                        ref={inputRef}
                        placeholder="Enter mobile number"
                        value={mobileNumber}
                        onFocus={handleInputFocus}
                        keyboardType="number-pad"
                        onChangeText={(txt) => {
                          const cleaned = txt.replace(/[^0-9]/g, '');
                          setMobileNumber(cleaned);
                          setError('');
                        }}
                        placeholderTextColor={lightTextColor}
                        style={styles.input}
                        maxLength={selectedCountry.maxLength}
                      />
                    </View>

                    {error ? (
                      <View style={styles.errorContainer}>
                        <Icon name="warning-outline" size={16} color={errorColor} />
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Continue */}
                  <TouchableOpacity
                    style={[
                      styles.continueButton, 
                      (mobileNumber.length < selectedCountry.minLength || isLoading) && styles.buttonDisabled
                    ]}
                    disabled={mobileNumber.length < selectedCountry.minLength || isLoading}
                    onPress={handleContinue}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Continue</Text>
                        <Icon name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Terms */}
                  <View style={styles.termsContainer}>
                    <Text style={styles.termsText}>
                      By continuing, agree to{' '}
                      <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.eatoor.com/terms-and-conditions')}>
                        Terms
                      </Text>
                      {' '}and{' '}
                      <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.eatoor.com/privacy-policy')}>
                        Privacy
                      </Text>
                    </Text>
                  </View>

                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

/* ---------------------------- */
/*        IMPROVED STYLES       */
/* ---------------------------- */
const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: backgroundColor 
  },
  container: { 
    flex: 1, 
    backgroundColor 
  },
  keyboardAvoid: { 
    flex: 1 
  },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center',
    minHeight: height,
  },

  // Skip Button Styles
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? responsiveSize(50) : responsiveSize(70),
    right: responsiveSize(16),
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: responsiveSize(12),
    paddingVertical: responsiveSize(8),
    borderRadius: responsiveSize(20),
    borderWidth: 1,
    borderColor: '#FFE4C2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  skipText: {
    color: primaryColor,
    fontWeight: '600',
    fontSize: responsiveSize(14),
    marginRight: responsiveSize(4),
  },

  content: {
    flex: 1,
    minHeight: height * 0.8,
    justifyContent: 'center',
    paddingBottom: responsiveSize(20),
    alignItems: 'center',
    paddingHorizontal: responsiveSize(20),
  },

  logoContainer: { 
    alignItems: 'center', 
    marginBottom: isSmallDevice ? responsiveSize(20) : responsiveSize(30) 
  },
  logoImage: { 
    width: isSmallDevice ? responsiveSize(80) : responsiveSize(100), 
    height: isSmallDevice ? responsiveSize(80) : responsiveSize(100), 
    borderRadius: responsiveSize(20) 
  },
  badge: {
    marginTop: responsiveSize(8),
    backgroundColor: '#FFF5E6',
    paddingHorizontal: responsiveSize(12),
    paddingVertical: responsiveSize(6),
    borderRadius: responsiveSize(12),
    borderColor: '#FFE4C2',
    borderWidth: 1,
  },
  badgeText: { 
    color: primaryColor, 
    fontWeight: '600', 
    fontSize: responsiveSize(12) 
  },

  headingWithLines: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    width: '100%', 
    maxWidth: responsiveSize(300), 
    marginBottom: isSmallDevice ? responsiveSize(25) : responsiveSize(35) 
  },
  line: { 
    flex: 1, 
    height: 1, 
    backgroundColor: borderColor 
  },
  headingTitle: { 
    marginHorizontal: responsiveSize(15), 
    fontSize: responsiveSize(18), 
    fontWeight: '600', 
    color: textColor 
  },

  inputSection: { 
    width: '100%', 
    maxWidth: responsiveSize(400), 
    alignItems: 'center' 
  },
  inputContainer: { 
    marginBottom: responsiveSize(25), 
    width: '100%' 
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: borderColor,
    borderRadius: responsiveSize(12),
    backgroundColor: '#FAFAFA',
    paddingHorizontal: responsiveSize(14),
    height: responsiveSize(52),
  },

  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: responsiveSize(12),
    borderRightWidth: 1.5,
    borderRightColor: borderColor,
    marginRight: responsiveSize(12),
    minWidth: responsiveSize(85),
  },

  countryFlag: { 
    fontSize: responsiveSize(14), 
    marginRight: responsiveSize(6) 
  },
  dialCode: { 
    fontSize: responsiveSize(14), 
    fontWeight: '500', 
    color: textColor, 
    marginRight: responsiveSize(6) 
  },
  input: {
    flex: 1,
    fontSize: responsiveSize(16),
    color: textColor,
    fontWeight: '400',
    paddingVertical: 0,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    marginTop: responsiveSize(8),
    padding: responsiveSize(8),
    borderRadius: responsiveSize(6),
  },
  errorText: { 
    color: errorColor, 
    marginLeft: responsiveSize(6), 
    fontWeight: '500', 
    fontSize: responsiveSize(13) 
  },

  continueButton: {
    backgroundColor: primaryColor,
    paddingVertical: responsiveSize(15),
    borderRadius: responsiveSize(12),
    width: '100%',
    maxWidth: responsiveSize(400),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonDisabled: { 
    opacity: 0.6 
  },
  buttonText: { 
    color: '#fff', 
    fontSize: responsiveSize(16), 
    fontWeight: '600' 
  },
  buttonIcon: { 
    marginLeft: responsiveSize(8) 
  },

  termsContainer: { 
    marginTop: responsiveSize(10) 
  },
  termsText: { 
    color: lightTextColor, 
    fontSize: responsiveSize(12), 
    textAlign: 'center',
    lineHeight: responsiveSize(16),
  },
  linkText: { 
    color: linkColor, 
    fontWeight: '600' 
  },

  /* IMPROVED MODAL STYLES - More Compact */
  modalContainer: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(12),
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
    minHeight: responsiveSize(56),
  },
  modalCloseButton: {
    width: responsiveSize(40),
    height: responsiveSize(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: { 
    fontSize: responsiveSize(18), 
    fontWeight: '700', 
    color: textColor 
  },

  searchContainer: {
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(12),
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: borderColor,
    borderWidth: 1,
    borderRadius: responsiveSize(10),
    paddingHorizontal: responsiveSize(12),
    height: responsiveSize(44),
    backgroundColor: '#F8F8F8',
  },
  searchIcon: { 
    marginRight: responsiveSize(8) 
  },
  searchInput: { 
    flex: 1, 
    fontSize: responsiveSize(15), 
    color: textColor,
    paddingVertical: responsiveSize(8),
  },

  countryList: {
    paddingBottom: responsiveSize(20),
  },
  countryItem: {
    flexDirection: 'row',
    padding: responsiveSize(12),
    paddingHorizontal: responsiveSize(16),
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
    alignItems: 'center',
    minHeight: responsiveSize(56),
  },
  countryInfo: { 
    flex: 1, 
    marginLeft: responsiveSize(12) 
  },
  countryName: { 
    fontSize: responsiveSize(15), 
    fontWeight: '500', 
    color: textColor 
  },
  countryRegion: { 
    fontSize: responsiveSize(12), 
    color: lightTextColor,
    marginTop: responsiveSize(2),
  },
  countryCode: { 
    fontSize: responsiveSize(15), 
    fontWeight: '600', 
    color: primaryColor 
  },
});

export default LoginScreen;