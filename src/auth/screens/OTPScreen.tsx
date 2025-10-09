import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Keyboard,
  TouchableWithoutFeedback, Animated, Platform, StatusBar, 
  ActivityIndicator, TextInput, Alert, Dimensions, ScrollView
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
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const manualInputRef = useRef<TextInput>(null);
  const { login } = useContext(AuthContext);
  const fadeAnim = useRef(new Animated.Value(1)).current; // Add fade animation for consistency

  // Calculate responsive sizes for OTP boxes
  const MAX_CONTAINER_WIDTH = width * 0.9;
  const DIGIT_BOX_SIZE = Math.min(
    isVerySmallDevice ? width * 0.12 : width * 0.13,
    (MAX_CONTAINER_WIDTH - (OTP_LENGTH * 6)) / OTP_LENGTH
  );
  const DIGIT_BOX_MARGIN = Math.min(width * 0.01, 4);

  // Reset fade animation when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      return () => {
        // Optional cleanup when screen loses focus
      };
    }, [fadeAnim])
  );

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

  // Listen for OTP autofill
  useEffect(() => {
    const handleAutoFill = (text: string) => {
      if (/^\d+$/.test(text) && text.length === OTP_LENGTH) {
        setManualOtp(text);
        inputRefs.current[OTP_LENGTH - 1]?.focus();
        setActiveInput(OTP_LENGTH - 1);
        setShouldVerify(true);
      }
    };

    // Listen for clipboard changes (for Android)
    let clipboardInterval: NodeJS.Timeout;
    if (Platform.OS === 'android') {
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
    }

    return () => {
      if (clipboardInterval) clearInterval(clipboardInterval);
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
        navigation.navigate(response.data.navigate_to);
      });

    } catch (err: any) {
      setError(err?.response?.data?.error || 'Invalid OTP. Please try again.');
      shakeInput();
      // Clear OTP on invalid verification
      setOtp(Array(OTP_LENGTH).fill(''));
      setManualOtp('');
      inputRefs.current[0]?.focus();
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
        inputRefs.current[0]?.focus();
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
      setManualOtp(text);
      setError('');
      
      // Update individual boxes
      const newOtp = [...otp];
      for (let i = 0; i < text.length && i < OTP_LENGTH; i++) {
        newOtp[i] = text[i];
      }
      // Clear remaining boxes if text is shorter
      for (let i = text.length; i < OTP_LENGTH; i++) {
        newOtp[i] = '';
      }
      setOtp(newOtp);
      
      // Focus the appropriate box
      const newActiveInput = Math.min(text.length, OTP_LENGTH - 1);
      setActiveInput(newActiveInput);
      if (text.length < OTP_LENGTH) {
        inputRefs.current[newActiveInput]?.focus();
      }

      // Set shouldVerify when OTP is complete
      if (text.length === OTP_LENGTH) {
        setShouldVerify(true);
      }
    }
  };

  const handleBoxFocus = (index: number) => {
    setActiveInput(index);
    // When focusing a box, position cursor at end of manual OTP
    if (manualOtp.length > 0) {
      manualInputRef.current?.setNativeProps({
        selection: {
          start: manualOtp.length,
          end: manualOtp.length,
        },
      });
    }
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

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      if (/^\d+$/.test(text)) {
        const pastedDigits = text.substring(0, OTP_LENGTH);
        setManualOtp(pastedDigits);
        inputRefs.current[OTP_LENGTH - 1]?.focus();
        setActiveInput(OTP_LENGTH - 1);
        if (pastedDigits.length === OTP_LENGTH) {
          setShouldVerify(true);
        }
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  };

  const animatedStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          <TouchableOpacity 
            style={[styles.backButton, isSmallDevice && styles.backButtonSmall]} 
            onPress={() => {
              // Fade out animation before going back
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(() => {
                navigation.goBack();
              });
            }}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={isSmallDevice ? 20 : 24} color="#000" />
          </TouchableOpacity>

          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={[styles.header, isSmallDevice && styles.headerSmall]}>
                <Text style={[styles.title, isSmallDevice && styles.titleSmall]}>Enter Verification Code</Text>
                <Text style={[styles.subtitle, isSmallDevice && styles.subtitleSmall]}>
                  We've sent a 6-digit code to{"\n"}
                  <Text style={styles.phoneNumber}>{userInput}</Text>
                </Text>
              </View>

              {/* Hidden manual OTP input for better keyboard support and autofill */}
              <TextInput
                ref={manualInputRef}
                style={styles.hiddenInput}
                value={manualOtp}
                onChangeText={handleManualOtpChange}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                importantForAutofill="yes"
                autoFocus={true}
                onPaste={handlePaste}
                caretHidden={true}
                autoCorrect={false}
                spellCheck={false}
                dataDetectorTypes="none"
                contextMenuHidden={true}
              />

              {/* OTP Boxes - Now in a single row with no wrapping */}
              <Animated.View 
                style={[
                  styles.otpContainer, 
                  animatedStyle,
                  { 
                    maxWidth: MAX_CONTAINER_WIDTH,
                    flexWrap: 'nowrap',
                  }
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
                    style={[styles.otpBoxTouchable, {
                      marginHorizontal: DIGIT_BOX_MARGIN
                    }]}
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
                      <Text style={[styles.otpText, isSmallDevice && styles.otpTextSmall]}>{otp[index]}</Text>
                    </View>
                    <TextInput
                      ref={(ref) => (inputRefs.current[index] = ref)}
                      style={[styles.otpInputHidden, {
                        width: DIGIT_BOX_SIZE,
                        height: DIGIT_BOX_SIZE,
                      }]}
                      keyboardType="number-pad"
                      value={otp[index]}
                      onChangeText={(text) => handleBoxChangeText(text, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      maxLength={1}
                      onFocus={() => handleBoxFocus(index)}
                      contextMenuHidden={true}
                      selectTextOnFocus={false}
                      caretHidden={true}
                      textContentType="oneTimeCode"
                      autoComplete="one-time-code"
                      importantForAutofill="yes"
                    />
                  </TouchableOpacity>
                ))}
              </Animated.View>

              {error ? (
                <View style={[styles.errorContainer, isSmallDevice && styles.errorContainerSmall]}>
                  <Icon name="warning" size={isSmallDevice ? 14 : 16} color="#ff4444" />
                  <Text style={[styles.errorText, isSmallDevice && styles.errorTextSmall]}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.buttonContainer, 
                  ((otp.join('').length !== OTP_LENGTH && manualOtp.length !== OTP_LENGTH) || isLoading) && styles.buttonDisabled
                ]}
                onPress={() => setShouldVerify(true)}
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
        </View>
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 0) + 10,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  backButtonSmall: {
    padding: 6,
    borderRadius: 18,
    top: Platform.OS === 'ios' ? 40 : (StatusBar.currentHeight || 0) + 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    paddingTop: Platform.select({
      ios: height < 700 ? height * 0.12 : height * 0.14,
      android: height < 600 ? height * 0.10 : height * 0.12
    }),
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: height * 0.05,
    width: '100%',
  },
  headerSmall: {
    marginBottom: height * 0.04,
  },
  title: {
    fontSize: height < 700 ? 22 : 26,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    marginBottom: 12,
  },
  titleSmall: {
    fontSize: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: height < 700 ? 14 : 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitleSmall: {
    fontSize: 13,
    lineHeight: 20,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#E65C00',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    alignSelf: 'center',
    width: '100%',
  },
  otpBoxTouchable: {
    // marginHorizontal handled inline based on calculated value
  },
  otpBox: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#E65C00',
    backgroundColor: '#FFF5EF',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  otpBoxError: {
    borderColor: '#ff4444',
  },
  otpBoxActive: {
    borderColor: '#E65C00',
    backgroundColor: '#FFF',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  otpText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 22,
  },
  otpTextSmall: {
    fontSize: 20,
  },
  otpInputHidden: {
    position: 'absolute',
    opacity: 0,
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFF2F2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  errorContainerSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  button: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E65C00',
  },
  buttonSmall: {
    padding: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
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
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  resendContainerSmall: {
    marginBottom: 20,
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
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  pasteButtonSmall: {
    padding: 8,
  },
  pasteText: {
    color: '#E65C00',
    fontWeight: '500',
    fontSize: 14,
    marginLeft: 6,
  },
  pasteTextSmall: {
    fontSize: 13,
    marginLeft: 5,
  },
});

export default OTPScreen;