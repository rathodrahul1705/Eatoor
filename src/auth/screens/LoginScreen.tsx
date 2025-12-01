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

const { AppHash } = NativeModules;
const { width, height } = Dimensions.get('window');

const primaryColor = '#E65C00';
const textColor = '#1C1C1C';
const lightTextColor = '#666666';
const borderColor = '#E8E8E8';
const errorColor = '#D32F2F';
const linkColor = '#E65C00';
const backgroundColor = '#FFFFFF';

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
      scrollViewRef.current?.scrollTo({ y: 120, animated: true });
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
      {/* COUNTRY PICKER MODAL    */}
      {/* ------------------------ */}
      <Modal visible={showCountryPicker} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Country</Text>
              <Text style={styles.modalSubtitle}>Choose your country code</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
              <Icon name="close" size={26} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Icon name="search-outline" size={20} color={lightTextColor} style={{ marginRight: 10 }} />
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
                <Icon name="close-circle" size={20} color={lightTextColor} />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
          />
        </SafeAreaView>
      </Modal>

      {/* ------------------------ */}
      {/* MAIN CONTENT             */}
      {/* ------------------------ */}
      <View style={styles.container}>
        <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.content}>
                
                {/* LOGO */}
                <View style={styles.logoContainer}>
                  <Image
                    source={{ uri: 'https://eatoorprod.s3.amazonaws.com/eatoor-logo/fwdeatoorlogofiles/5.png' }}
                    style={styles.logoImage}
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
                      <TouchableOpacity style={styles.countryPicker} onPress={() => setShowCountryPicker(true)}>
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
                    style={[styles.continueButton, (mobileNumber.length < selectedCountry.minLength || isLoading) && styles.buttonDisabled]}
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
                      <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.eatoor.com/terms-and-conditions')}>Terms</Text>
                      {' '}and{' '}
                      <Text style={styles.linkText} onPress={() => Linking.openURL('https://www.eatoor.com/privacy-policy')}>Privacy</Text>
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
/*        STYLES BELOW          */
/* ---------------------------- */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: backgroundColor },
  container: { flex: 1, backgroundColor },
  keyboardAvoid: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },

  content: {
    flex: 1,
    minHeight: height,
    justifyContent: 'center',
    paddingBottom: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logoImage: { width: 100, height: 100, borderRadius: 20 },
  badge: {
    marginTop: 10,
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderColor: '#FFE4C2',
    borderWidth: 1,
  },
  badgeText: { color: primaryColor, fontWeight: '600', fontSize: 12 },

  headingWithLines: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 300, marginBottom: 35 },
  line: { flex: 1, height: 1, backgroundColor: borderColor },
  headingTitle: { marginHorizontal: 15, fontSize: 18, fontWeight: '600', color: textColor },

  inputSection: { width: '100%', maxWidth: 400, alignItems: 'center' },
  inputContainer: { marginBottom: 25, width: '100%' },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: borderColor,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    height: 52,
  },

  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1.5,
    borderRightColor: borderColor,
    marginRight: 12,
    minWidth: 85,
  },

  countryFlag: { fontSize: 14, marginRight: 6 },
  dialCode: { fontSize: 14, fontWeight: '500', color: textColor, marginRight: 6 },
  input: {
    flex: 1,
    fontSize: 16,
    color: textColor,
    fontWeight: '400',
    paddingVertical: 0,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },
  errorText: { color: errorColor, marginLeft: 6, fontWeight: '500', fontSize: 13 },

  continueButton: {
    backgroundColor: primaryColor,
    paddingVertical: 15,
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonIcon: { marginLeft: 8 },

  termsContainer: { marginTop: 10 },
  termsText: { color: lightTextColor, fontSize: 12, textAlign: 'center' },
  linkText: { color: linkColor, fontWeight: '600' },

  /* MODAL STYLES */
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', color: textColor },
  modalSubtitle: { fontSize: 14, color: lightTextColor },

  searchContainer: {
    flexDirection: 'row',
    padding: 14,
    margin: 16,
    borderColor: borderColor,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  searchInput: { flex: 1, fontSize: 15, color: textColor },

  countryItem: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
    alignItems: 'center',
  },
  countryInfo: { flex: 1, marginLeft: 12 },
  countryName: { fontSize: 15, fontWeight: '500', color: textColor },
  countryRegion: { fontSize: 12, color: lightTextColor },
  countryCode: { fontSize: 15, fontWeight: '600', color: primaryColor },
});

export default LoginScreen;