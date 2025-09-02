import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Keyboard,
  TouchableWithoutFeedback, Animated, Platform, StatusBar, 
  ActivityIndicator, TextInput, Alert
} from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { OTPScreenProps } from '../../types/navigation.d';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyOTP, resendOTP } from '../../api/auth';
import Clipboard from '@react-native-clipboard/clipboard';
import { AuthContext } from '../../context/AuthContext';

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 30;
const DIGIT_BOX_SIZE = 48;
const DIGIT_BOX_MARGIN = 8;

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
      console.log("response.data.navigate_to==",response.data.navigate_to)
      navigation.navigate(response.data.navigate_to);

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
  }, [otp, manualOtp, userInput, navigation, isLoading]);

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
      inputRefs.current[index - 1]?.focus();
      setActiveInput(index - 1);
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
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  };

  const animatedStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit OTP to{"\n"}
            <Text style={styles.phoneNumber}>{userInput}</Text>
          </Text>

          {/* Hidden manual OTP input for better keyboard support */}
          <TextInput
            ref={manualInputRef}
            style={styles.hiddenInput}
            value={manualOtp}
            onChangeText={handleManualOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            textContentType="oneTimeCode"
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
            importantForAutofill="yes"
            onPaste={handlePaste}
            caretHidden={true}
            autoFocus={true}
            autoCorrect={false}
            spellCheck={false}
            dataDetectorTypes="none"
          />

          {/* OTP Boxes */}
          <Animated.View style={[styles.otpContainer, animatedStyle]}>
            {Array(OTP_LENGTH).fill(0).map((_, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={1}
                onPress={() => {
                  inputRefs.current[index]?.focus();
                  setActiveInput(index);
                }}
              >
                <TextInput
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    otp[index] ? styles.otpInputFilled : null,
                    error ? styles.otpInputError : null,
                    activeInput === index ? styles.otpInputActive : null
                  ]}
                  keyboardType="number-pad"
                  value={otp[index]}
                  onChangeText={(text) => handleBoxChangeText(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  maxLength={1}
                  onFocus={() => handleBoxFocus(index)}
                  contextMenuHidden={true}
                  selectTextOnFocus={false}
                  caretHidden={true}
                />
              </TouchableOpacity>
            ))}
          </Animated.View>

          {error ? (
            <Text style={styles.error}>
              <Icon name="warning" size={14} color="#ff4444" /> {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button, 
              ((otp.join('').length !== OTP_LENGTH && manualOtp.length !== OTP_LENGTH) || isLoading) && styles.buttonDisabled
            ]}
            onPress={() => setShouldVerify(true)}
            disabled={(otp.join('').length !== OTP_LENGTH && manualOtp.length !== OTP_LENGTH) || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the OTP?</Text>
            <TouchableOpacity 
              onPress={handleResendOTP} 
              disabled={countdown > 0}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.resendLink, 
                countdown > 0 && styles.resendDisabled
              ]}>
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop:180,
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#333',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  otpInput: {
    width: DIGIT_BOX_SIZE,
    height: DIGIT_BOX_SIZE,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    color: '#333',
    fontWeight: '600',
    fontSize: 24,
    textAlign: 'center',
    marginHorizontal: DIGIT_BOX_MARGIN / 2,
  },
  otpInputFilled: {
    borderColor: '#E65C00',
    backgroundColor: '#FFF5EF',
  },
  otpInputError: {
    borderColor: '#ff4444',
  },
  otpInputActive: {
    borderColor: '#E65C00',
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#E65C00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#E65C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#E65C0080',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendText: {
    color: '#666',
    fontSize: 14,
  },
  resendLink: {
    color: '#E65C00',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  resendDisabled: {
    color: '#999',
  },
});

export default OTPScreen;