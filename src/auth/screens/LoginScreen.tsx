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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendOTP } from '../../api/auth';
import { Country, countries } from '../../auth/screens/home/countries';
import Icon from 'react-native-vector-icons/Ionicons';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Updated color scheme with #E65C00
const primaryColor = '#E65C00';
const backgroundColor = '#FFFFFF';
const textColor = '#1C1C1C';
const lightTextColor = '#666666';
const borderColor = '#E8E8E8';
const errorColor = '#D32F2F';
const linkColor = '#E65C00';

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries.find(country => country.code === 'IN') || countries[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const inputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
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
  }, []);

  const handleContinue = async () => {
    if (!mobileNumber || mobileNumber.length < selectedCountry.minLength) {
      setError(`Please enter a valid ${selectedCountry.name} number`);
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
        setError(response?.data?.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 120, animated: true });
    }, 100);
  };

  const filteredCountries = countries.filter(country => 
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery)
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
      
      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <Text style={styles.modalSubtitle}>Choose your country code</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowCountryPicker(false)}
              style={styles.closeButton}
            >
              <Icon name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Icon name="search-outline" size={20} color={lightTextColor} style={styles.searchIcon} />
            <TextInput
              placeholder="Search country or code..."
              style={styles.searchInput}
              placeholderTextColor={lightTextColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Icon name="close-circle" size={20} color={lightTextColor} />
              </TouchableOpacity>
            )}
          </View>
          
          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="flag-outline" size={48} color={lightTextColor} />
                <Text style={styles.emptyText}>No countries found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      <Animated.View style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.content}>
                
                

                {/* Centered Main Content */}
                <View style={styles.mainContent}>


                  {/* Centered Header Section */}
                <View style={styles.header}>
                  <View style={styles.logoContainer}>
                    <View style={styles.logoWrapper}>
                      <View style={styles.logoImageContainer}>
                        <Image 
                          source={{ uri: 'https://eatoorprod.s3.amazonaws.com/uploads/80645c4afd0d47dea9c05b0091714778.jpg' }}
                          style={styles.logoImage}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.logoText}>EATOOR</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Food Delivery</Text>
                    </View>
                  </View>
                </View>
                  
                  {/* Login/Sign Up Heading with Side Lines */}
                  <View style={styles.headingWithLines}>
                    <View style={styles.line} />
                    <Text style={styles.headingTitle}>Login or sign up</Text>
                    <View style={styles.line} />
                  </View>

                  {/* Centered Input Section */}
                  <View style={styles.inputSection}>
                    <View style={styles.inputContainer}>
                      {/* Updated Input Label */}
                      
                      <View style={styles.inputWrapper}>
                        <TouchableOpacity
                          style={styles.countryPicker}
                          onPress={() => setShowCountryPicker(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                          <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
                          <Icon name="chevron-down" size={14} color={primaryColor} />
                        </TouchableOpacity>
                        
                        <TextInput
                          ref={inputRef}
                          placeholder="Enter mobile number"
                          style={styles.input}
                          placeholderTextColor={lightTextColor}
                          value={mobileNumber}
                          onChangeText={(text) => {
                            const numericText = text.replace(/[^0-9]/g, '');
                            setMobileNumber(numericText);
                            setError('');
                          }}
                          onFocus={handleInputFocus}
                          keyboardType="number-pad"
                          autoComplete="tel"
                          textContentType="telephoneNumber"
                          returnKeyType="done"
                          onSubmitEditing={handleContinue}
                          maxLength={selectedCountry.maxLength}
                        />
                      </View>

                      {error ? 
                        <View style={styles.errorContainer}>
                          <Icon name="warning-outline" size={16} color={errorColor} />
                          <Text style={styles.errorText}>{error}</Text>
                        </View>
                      : null
                      }
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.continueButton,
                        (mobileNumber.length < selectedCountry.minLength || isLoading) && styles.buttonDisabled,
                      ]}
                      onPress={handleContinue}
                      disabled={mobileNumber.length < selectedCountry.minLength || isLoading}
                      activeOpacity={0.9}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Text style={styles.buttonText}>Continue</Text>
                          <Icon name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Centered Terms and Conditions */}
                    <View style={styles.termsContainer}>
                      <Text style={styles.termsText}>
                        By continuing, agree to{' '}
                        <Text
                          style={styles.linkText}
                          onPress={() => Linking.openURL('https://www.eatoor.com/terms-and-conditions')}
                        >
                          Terms
                        </Text>{' '}
                        and{' '}
                        <Text
                          style={styles.linkText}
                          onPress={() => Linking.openURL('https://www.eatoor.com/privacy-policy')}
                        >
                          Privacy
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minHeight: height,
    justifyContent: 'center',
    paddingBottom: 20, // Reduced bottom padding
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10, // Reduced top padding
    paddingBottom: 10, // Reduced bottom padding
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0, // Removed extra top padding
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30, // Reduced margin to remove extra space
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6, // Reduced margin
  },
  logoImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#E65C00',
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4C2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: primaryColor,
  },
  headingWithLines: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 35, // Adjusted margin for better spacing
    width: '100%',
    maxWidth: 300,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: borderColor,
  },
  headingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: textColor,
    textAlign: 'center',
    marginHorizontal: 15,
  },
  inputSection: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: 25,
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: textColor,
    marginBottom: 8,
    paddingLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFA',
    height: 52,
    width: '100%',
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1.5,
    borderRightColor: '#E8E8E8',
    marginRight: 12,
    minWidth: 85,
    height: '100%',
  },
  countryFlag: {
    fontSize: 14,
    marginRight: 6,
  },
  dialCode: {
    fontSize: 14,
    color: textColor,
    fontWeight: '500',
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: textColor,
    fontWeight: '400',
    paddingVertical: 0,
    height: '100%',
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FFF5F5',
    paddingVertical: 8,
    borderRadius: 6,
    paddingHorizontal: 10,
    width: '100%',
  },
  errorText: {
    color: errorColor,
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: primaryColor,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    flexDirection: 'row',
    shadowColor: primaryColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    width: '100%',
    maxWidth: 400,
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  termsContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
    width: '100%',
  },
  termsText: {
    color: lightTextColor,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  linkText: {
    color: linkColor,
    fontWeight: '500',
    textDecorationLine: 'none',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: textColor,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: lightTextColor,
  },
  closeButton: {
    padding: 4,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: borderColor,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: textColor,
    paddingVertical: 0,
    fontWeight: '400',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
  },
  countryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  countryName: {
    fontSize: 15,
    color: textColor,
    fontWeight: '500',
    marginBottom: 2,
  },
  countryRegion: {
    fontSize: 12,
    color: lightTextColor,
    fontWeight: '400',
  },
  countryCode: {
    fontSize: 15,
    color: primaryColor,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    color: lightTextColor,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 12,
  },
});

export default LoginScreen;