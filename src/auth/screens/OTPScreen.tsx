import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Keyboard,
  TouchableWithoutFeedback, Animated, Platform, StatusBar, 
  ActivityIndicator, TextInput, Dimensions, ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { useNavigation, StackActions, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { OTPScreenProps } from '../../types/navigation.d';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyOTP, resendOTP } from '../../api/auth';
import Clipboard from '@react-native-clipboard/clipboard';
import { AuthContext } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');
const isSmallDevice = height < 700;
const isVerySmallDevice = height < 600;
const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 30;

const OTPScreen: React.FC<OTPScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { userInput } = route.params;
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [manualOtp, setManualOtp] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [isLoading, setIsLoading] = useState(false);
  const [activeInput, setActiveInput] = useState(0);
  const [shouldVerify, setShouldVerify] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const manualInputRef = useRef<TextInput>(null);
  const { login } = useContext(AuthContext);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate responsive sizes for OTP boxes
  const MAX_CONTAINER_WIDTH = width * 0.85;
  const DIGIT_BOX_SIZE = Math.min(
    isVerySmallDevice ? width * 0.14 : width * 0.16,
    (MAX_CONTAINER_WIDTH - (OTP_LENGTH * 8)) / OTP_LENGTH
  );
  const DIGIT_BOX_MARGIN = Math.min(width * 0.015, 6);

  // Keyboard visibility handler
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 50, animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Reset fade animation when screen comes back into focus and focus first input
  useFocusEffect(
    useCallback(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto focus the hidden input when screen comes into focus for better autofill
      const timer = setTimeout(() => {
        manualInputRef.current?.focus();
      }, 300);

      return () => {
        clearTimeout(timer);
      };
    }, [fadeAnim])
  );

  // Auto focus hidden input on initial mount for autofill
  useEffect(() => {
    const timer = setTimeout(() => {
      manualInputRef.current?.focus();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Countdown timer for resend OTP
  useEffect(() => {
    const timer = countdown > 0 && setInterval(() => {
      setCountdown(countdown - 1);
    }, 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  // Handle OTP verification when shouldVerify is true and OTP is complete
  useEffect(() => {
    if (shouldVerify && manualOtp.length === OTP_LENGTH) {
      handleVerify();
      setShouldVerify(false);
    }
  }, [shouldVerify, manualOtp]);

  // Enhanced autofill handling
  useEffect(() => {
    const handleAutoFill = (text: string) => {
      if (/^\d+$/.test(text) && text.length === OTP_LENGTH) {
        setManualOtp(text);
        setShouldVerify(true);
        Keyboard.dismiss();
      }
    };

    // Check clipboard on mount for autofill
    const checkClipboard = async () => {
      try {
        const text = await Clipboard.getString();
        if (/^\d+$/.test(text) && text.length === OTP_LENGTH) {
          handleAutoFill(text);
        }
      } catch (error) {
        console.error('Clipboard error:', error);
      }
    };

    checkClipboard();

    // Set up interval to check for autofill
    let clipboardInterval: NodeJS.Timeout;
    
    clipboardInterval = setInterval(async () => {
      try {
        const text = await Clipboard.getString();
        if (/^\d+$/.test(text) && text.length === OTP_LENGTH) {
          handleAutoFill(text);
          clearInterval(clipboardInterval);
        }
      } catch (error) {
        console.error('Clipboard error:', error);
      }
    }, 1000);

    // Clear interval after 10 seconds
    const timeout = setTimeout(() => {
      if (clipboardInterval) clearInterval(clipboardInterval);
    }, 10000);

    return () => {
      if (clipboardInterval) clearInterval(clipboardInterval);
      clearTimeout(timeout);
    };
  }, []);

  const handleVerify = useCallback(async () => {
    if (isLoading) return;
    
    const otpCode = manualOtp.length === OTP_LENGTH ? manualOtp : otp.join('');

    if (otpCode.length !== OTP_LENGTH) {
      setError('Please enter a valid 6-digit OTP');
      shakeInput();
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const response = await verifyOTP({ contact_number: userInput, otp: otpCode });
      await AsyncStorage.multiSet([
        ['accessToken', response.data.tokens.access],
        ['refreshToken', response.data.tokens.refresh],
        ['user', JSON.stringify(response.data.user)]
      ]);
      
      if(response.data.navigate_to == "HomeTabs"){
        login(response.data.tokens.access);
      }
      
      // Fade out animation before navigation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate(response.data.navigate_to as never);
      });

    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid OTP. Please try again.');
      shakeInput();
      // Clear OTP on invalid verification
      setOtp(Array(OTP_LENGTH).fill(''));
      setManualOtp('');
      manualInputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [otp, manualOtp, userInput, navigation, isLoading, fadeAnim, login]);

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    try {
      setCountdown(RESEND_COUNTDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      setManualOtp('');
      setError('');
      setIsLoading(true);

      const response = await resendOTP({ contact_number: userInput });
      
      if (response.status === 200) {
        manualInputRef.current?.focus();
      } else {
        setError('Failed to resend OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleBoxChangeText = (text: string, index: number) => {
    if (/^[0-9]$/.test(text) || text === '') {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      
      // Update manual OTP to match
      const newManualOtp = newOtp.join('').substring(0, OTP_LENGTH);
      setManualOtp(newManualOtp);
      
      setError('');

      if (text && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
        setActiveInput(index + 1);
      }

      // Set shouldVerify when last digit is entered
      if (index === OTP_LENGTH - 1 && text) {
        setShouldVerify(true);
      }
    }
  };

  const handleManualOtpChange = (text: string) => {
    if (/^\d*$/.test(text)) {
      const cleanText = text.replace(/[^0-9]/g, '');
      setManualOtp(cleanText);
      setError('');
      
      // Update individual boxes
      const newOtp = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < cleanText.length && i < OTP_LENGTH; i++) {
        newOtp[i] = cleanText[i];
      }
      setOtp(newOtp);
      
      // Focus the appropriate box
      const newActiveInput = Math.min(cleanText.length, OTP_LENGTH - 1);
      setActiveInput(newActiveInput);
      
      if (cleanText.length < OTP_LENGTH) {
        inputRefs.current[newActiveInput]?.focus();
      } else {
        Keyboard.dismiss();
        setShouldVerify(true);
      }
    }
  };

  const handleBoxFocus = (index: number) => {
    setActiveInput(index);
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      // Handle backspace on empty field - move to previous field and clear it
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      
      // Update manual OTP
      const newManualOtp = newOtp.join('').substring(0, OTP_LENGTH);
      setManualOtp(newManualOtp);
      
      inputRefs.current[index - 1]?.focus();
      setActiveInput(index - 1);
    } else if (e.nativeEvent.key === 'Backspace' && index > 0) {
      // Handle backspace on field with content - clear current field
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      
      // Update manual OTP
      const newManualOtp = newOtp.join('').substring(0, OTP_LENGTH);
      setManualOtp(newManualOtp);
      
      inputRefs.current[index]?.focus();
    }
  };

  const handleBackPress = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      navigation.goBack();
    });
  };

  const animatedStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* Fixed Header with Back Button */}
          <View style={styles.headerContainer}>
            <TouchableOpacity 
              style={[styles.backButton, isSmallDevice && styles.backButtonSmall]} 
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <Icon name="chevron-back" size={isSmallDevice ? 24 : 28} color="#000" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, isSmallDevice && styles.headerTitleSmall]}>
                Verification
              </Text>
            </View>
            <View style={styles.headerPlaceholder} />
          </View>

          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentKeyboardVisible
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustContentInsets={true}
            contentInsetAdjustmentBehavior="always"
          >
            <View style={styles.content}>
              {/* Updated Illustration Container without security icon */}

              <View style={[styles.textHeader, isSmallDevice && styles.textHeaderSmall]}>
                <Text style={[styles.title, isSmallDevice && styles.titleSmall]}>Enter Verification Code</Text>
                <Text style={[styles.subtitle, isSmallDevice && styles.subtitleSmall]}>
                  We've sent a 6-digit code to{"\n"}
                  <Text style={styles.phoneNumber}>{userInput}</Text>
                </Text>
              </View>

              {/* Enhanced Hidden OTP Input for Autofill with better attributes */}
              <TextInput
                ref={manualInputRef}
                style={styles.hiddenInput}
                value={manualOtp}
                onChangeText={handleManualOtpChange}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
                autoFocus={true}
                caretHidden={true}
                autoCorrect={false}
                spellCheck={false}
                dataDetectorTypes="none"
                contextMenuHidden={true}
                autoCapitalize="none"
                enterKeyHint="done"
                inputMode="numeric"
                enablesReturnKeyAutomatically={true}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (manualOtp.length === OTP_LENGTH) {
                    handleVerify();
                  }
                }}
              />

              {/* OTP Boxes Container */}
              <Animated.View 
                style={[
                  styles.otpContainer, 
                  animatedStyle,
                ]}
              >
                {Array(OTP_LENGTH).fill(0).map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={1}
                    onPress={() => {
                      inputRefs.current[index]?.focus();
                      setActiveInput(index);
                    }}
                    style={[styles.otpBoxTouchable]}
                  >
                    <View style={[
                      styles.otpBox,
                      {
                        width: DIGIT_BOX_SIZE,
                        height: DIGIT_BOX_SIZE,
                      },
                      otp[index] ? styles.otpBoxFilled : null,
                      error ? styles.otpBoxError : null,
                      activeInput === index ? styles.otpBoxActive : null
                    ]}>
                      <Text style={[styles.otpText, isSmallDevice && styles.otpTextSmall]}>
                        {otp[index] || ''}
                      </Text>
                      {activeInput === index && !otp[index] && (
                        <Text style={styles.cursor}>|</Text>
                      )}
                    </View>
                    <TextInput
                      ref={(ref) => (inputRefs.current[index] = ref)}
                      style={[styles.otpInputHidden]}
                      keyboardType="number-pad"
                      value={otp[index]}
                      onChangeText={(text) => handleBoxChangeText(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      maxLength={1}
                      onFocus={() => handleBoxFocus(index)}
                      contextMenuHidden={true}
                      selectTextOnFocus={true}
                      caretHidden={true}
                      inputMode="numeric"
                    />
                  </TouchableOpacity>
                ))}
              </Animated.View>

              {error ? (
                <View style={[styles.errorContainer, isSmallDevice && styles.errorContainerSmall]}>
                  <Icon name="warning-outline" size={isSmallDevice ? 16 : 18} color="#ff4444" />
                  <Text style={[styles.errorText, isSmallDevice && styles.errorTextSmall]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.buttonContainer, 
                  ((otp.join('').length !== OTP_LENGTH && manualOtp.length !== OTP_LENGTH) || isLoading) && styles.buttonDisabled
                ]}
                onPress={handleVerify}
                disabled={(otp.join('').length !== OTP_LENGTH && manualOtp.length !== OTP_LENGTH) || isLoading}
                activeOpacity={0.9}
              >
                <View style={[styles.button, isSmallDevice && styles.buttonSmall]}>
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.buttonText, isSmallDevice && styles.buttonTextSmall]}>Verify & Continue</Text>
                  )}
                </View>
              </TouchableOpacity>

              <View style={[styles.resendContainer, isSmallDevice && styles.resendContainerSmall]}>
                <Text style={[styles.resendText, isSmallDevice && styles.resendTextSmall]}>Didn't receive the code? </Text>
                <TouchableOpacity 
                  onPress={handleResendOTP} 
                  disabled={countdown > 0}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.resendLink, 
                    isSmallDevice && styles.resendLinkSmall,
                    countdown > 0 && styles.resendDisabled
                  ]}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  scrollContentKeyboardVisible: {
    paddingBottom: 100,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  backButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerTitleSmall: {
    fontSize: 16,
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
    alignItems: 'center',
    minHeight: height * 0.7,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  illustrationContainerSmall: {
    marginBottom: 20,
  },
  illustrationCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5EF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  textHeader: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  textHeaderSmall: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    marginBottom: 12,
  },
  titleSmall: {
    fontSize: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#E65C00',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    width: '100%',
  },
  otpBoxTouchable: {
    marginHorizontal: 4,
  },
  otpBox: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  otpBoxFilled: {
    borderColor: '#E65C00',
    backgroundColor: '#FFF5EF',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  otpBoxError: {
    borderColor: '#ff4444',
  },
  otpBoxActive: {
    borderColor: '#E65C00',
    backgroundColor: '#FFF',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  otpText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 24,
  },
  otpTextSmall: {
    fontSize: 20,
  },
  cursor: {
    color: '#E65C00',
    fontSize: 24,
    fontWeight: 'bold',
    position: 'absolute',
  },
  otpInputHidden: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFF2F2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  errorContainerSmall: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff4444',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  errorTextSmall: {
    fontSize: 13,
    marginLeft: 6,
  },
  buttonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 25,
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E65C00',
  },
  buttonSmall: {
    padding: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  buttonTextSmall: {
    fontSize: 15,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  resendContainerSmall: {
    marginBottom: 16,
  },
  resendText: {
    color: '#666',
    fontSize: 15,
  },
  resendTextSmall: {
    fontSize: 14,
  },
  resendLink: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: 15,
  },
  resendLinkSmall: {
    fontSize: 14,
  },
  resendDisabled: {
    color: '#999',
  },
});

export default OTPScreen;