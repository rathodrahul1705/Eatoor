import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  AppState,
} from 'react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';

import { OTPScreenProps, RootStackParamList } from '../../types/navigation.d';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyOTP, resendOTP } from '../../api/auth';
import { AuthContext } from '../../context/AuthContext';

import RNOtpVerify from 'react-native-otp-verify';

const { width, height } = Dimensions.get('window');
const isSmallDevice = height < 700;
const isVerySmallDevice = height < 600;

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 30;

const OTPScreen: React.FC<OTPScreenProps> = ({ route }) => {
  // Since OTP screen is inside AuthNavigator, we need to navigate within the Home stack
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userInput, appHash } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [manualOtp, setManualOtp] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [isLoading, setIsLoading] = useState(false);
  const [activeInput, setActiveInput] = useState(0);
  const [shouldVerify, setShouldVerify] = useState(false);

  const [isListeningSMS, setIsListeningSMS] = useState(false);

  // Refs
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const manualInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const appState = useRef(AppState.currentState);

  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const { login } = useContext(AuthContext);

  /** *****************************************************************
   *            NEW OTP LISTENER USING react-native-otp-verify
   ***************************************************************** */
  const startOtpListener = async () => {
    if (Platform.OS !== 'android') return;

    try {
      console.log('Starting OTP listener...');
      setIsListeningSMS(true);

      const started = await RNOtpVerify.getOtp();
      console.log('getOtp started:', started);

      if (started) {
        RNOtpVerify.addListener(handleOTPMessage);
      }
    } catch (e) {
      console.log('OTP Listener error:', e);
      setIsListeningSMS(false);
    }
  };

  const stopOtpListener = () => {
    try {
      RNOtpVerify.removeListener();
    } catch (e) {
      console.log('removeListener error', e);
    }
    setIsListeningSMS(false);
  };

  /** Extract OTP from SMS */
  const handleOTPMessage = (message: string) => {
    console.log('Received SMS Message:', message);

    const match = message.match(/(\d{6})/);
    if (match) {
      const code = match[1];
      console.log('OTP Auto-Extracted:', code);
      autoFillOTP(code);
      stopOtpListener();
    }
  };

  /** Fill UI boxes with OTP */
  const autoFillOTP = (code: string) => {
    setManualOtp(code);

    const arr = code.split('');
    setOtp(arr);

    setActiveInput(OTP_LENGTH - 1);
    Keyboard.dismiss();

    setShouldVerify(true);
  };

  /** *****************************************************************
   *            APP STATE LISTENER (FOREGROUND / BACKGROUND)
   ***************************************************************** */
  useEffect(() => {
    if (Platform.OS === 'android') startOtpListener();

    const stateSub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (Platform.OS === 'android') startOtpListener();
      }
      if (nextState.match(/inactive|background/)) {
        if (Platform.OS === 'android') stopOtpListener();
      }
      appState.current = nextState;
    });

    return () => {
      stateSub.remove();
      stopOtpListener();
    };
  }, []);

  /** *****************************************************************
   *            COUNTDOWN TIMER FOR RESEND
   ***************************************************************** */
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  /** *****************************************************************
   *            SCREEN FOCUS → ANIMATION + AUTO-FOCUS
   ***************************************************************** */
  useFocusEffect(
    useCallback(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();

      const t = setTimeout(() => {
        manualInputRef.current?.focus();
      }, 300);

      if (Platform.OS === 'android') startOtpListener();

      return () => {
        clearTimeout(t);
        stopOtpListener();
      };
    }, [])
  );

  /** *****************************************************************
   *            VERIFY OTP
   ***************************************************************** */
  useEffect(() => {
    if (shouldVerify && manualOtp.length === OTP_LENGTH) {
      handleVerify();
      setShouldVerify(false);
    }
  }, [shouldVerify, manualOtp]);

  const handleVerify = async () => {
    if (isLoading) return;

    const finalOtp = manualOtp.length === OTP_LENGTH ? manualOtp : otp.join('');

    if (finalOtp.length !== OTP_LENGTH) {
      setError('Please enter a valid 6-digit OTP');
      shakeInput();
      return;
    }

    setIsLoading(true);
    Keyboard.dismiss();
    stopOtpListener();

    try {
      const deviceToken = await AsyncStorage.getItem('fcm_token');

      const payload: any = {
        contact_number: userInput,
        otp: finalOtp,
        platform: Platform.OS,
        device_token: deviceToken || null,
      };

      if (Platform.OS === 'android' && appHash) payload.app_hash = appHash;

      console.log('Verifying OTP:', payload);

      const response = await verifyOTP(payload);

      await AsyncStorage.multiSet([
        ['accessToken', response.data.tokens.access],
        ['refreshToken', response.data.tokens.refresh],
        ['user', JSON.stringify(response.data.user)],
      ]);

      login(response.data.tokens.access);

      await AsyncStorage.setItem('navigate_to', response.data.navigate_to);

      // IMPORTANT: Since the login function in AuthContext will update userToken,
      // AppNavigator will automatically switch from Auth navigator to Home navigator.
      // The Home navigator should handle its own initial screen based on user data.

    } catch (err: any) {
      console.log('OTP verify error:', err);
      setError(err?.response?.data?.error || 'Invalid OTP. Try again.');
      shakeInput();

      // restart OTP listener
      if (Platform.OS === 'android') startOtpListener();

      setOtp(Array(OTP_LENGTH).fill(''));
      setManualOtp('');

      setTimeout(() => manualInputRef.current?.focus(), 150);
    } finally {
      setIsLoading(false);
    }
  };

  /** *****************************************************************
   *            RESEND OTP
   ***************************************************************** */
  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setCountdown(RESEND_COUNTDOWN);
    setOtp(Array(OTP_LENGTH).fill(''));
    setManualOtp('');
    setError('');

    setIsLoading(true);

    const payload: any = {
      contact_number: userInput,
      platform: Platform.OS,
    };

    if (Platform.OS === 'android' && appHash) payload.app_hash = appHash;

    try {
      const response = await resendOTP(payload);
      console.log('Resend OTP response:', response.data);

      manualInputRef.current?.focus();

      if (Platform.OS === 'android') startOtpListener();
    } catch (e) {
      console.log('Resend error:', e);
      setError('Failed to resend OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  /** *****************************************************************
   *            INPUT HANDLING
   ***************************************************************** */
  const handleBoxChangeText = (text: string, index: number) => {
    if (!/^[0-9]?$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    const merged = newOtp.join('').substring(0, OTP_LENGTH);
    setManualOtp(merged);

    setError('');

    if (text && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
      setActiveInput(index + 1);
    }
    if (index === OTP_LENGTH - 1 && text) setShouldVerify(true);
  };

  const handleManualOtpChange = (v: string) => {
    if (!/^\d*$/.test(v)) return;

    const clean = v.replace(/[^0-9]/g, '');
    setManualOtp(clean);

    const arr = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < clean.length; i++) arr[i] = clean[i];
    setOtp(arr);

    const pos = Math.min(clean.length, OTP_LENGTH - 1);
    setActiveInput(pos);

    if (clean.length === OTP_LENGTH) setShouldVerify(true);
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newOtp = [...otp];

      if (!otp[index] && index > 0) {
        newOtp[index - 1] = '';
        setOtp(newOtp);
        setManualOtp(newOtp.join(''));
        inputRefs.current[index - 1]?.focus();
        setActiveInput(index - 1);
      } else {
        newOtp[index] = '';
        setOtp(newOtp);
        setManualOtp(newOtp.join('').substring(0, OTP_LENGTH));
      }
    }
  };

  /** *****************************************************************
   *            UI ANIMATION
   ***************************************************************** */
  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  /** *****************************************************************
   *            BACK PRESS
   ***************************************************************** */
  const handleBackPress = () => {
    stopOtpListener();
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      navigation.goBack();
    });
  };

  const MAX_CONTAINER_WIDTH = width * 0.85;
  const DIGIT_BOX_SIZE = Math.min(
    isVerySmallDevice ? width * 0.14 : width * 0.16,
    (MAX_CONTAINER_WIDTH - OTP_LENGTH * 8) / OTP_LENGTH
  );

  const animatedShakeStyle = {
    transform: [{ translateX: shakeAnimation }],
  };

  /** *****************************************************************
   *            RENDER
   ***************************************************************** */
  return (
    <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <StatusBar barStyle="dark-content" backgroundColor="#fff" />

          {/* HEADER */}
          <View style={styles.headerContainer}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
              <Icon name="chevron-back" size={26} color="#000" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Verification</Text>

            <View style={{ width: 40 }} />
          </View>

          {/* BODY */}
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>

              {/* TITLE */}
              <View style={styles.textHeader}>
                <Text style={styles.title}>Enter Verification Code</Text>
                <Text style={styles.subtitle}>
                  We've sent a 6-digit code to{'\n'}
                  <Text style={styles.phoneNumber}>{userInput}</Text>
                </Text>

                {Platform.OS === 'android' && isListeningSMS && (
                  <View style={styles.smsStatus}>
                    <ActivityIndicator size="small" color="#E65C00" />
                    <Text style={styles.smsStatusText}>Listening for OTP…</Text>
                  </View>
                )}
              </View>

              {/* HIDDEN INPUT FOR AUTO-FILL */}
              <TextInput
                ref={manualInputRef}
                style={styles.hiddenInput}
                value={manualOtp}
                onChangeText={handleManualOtpChange}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                caretHidden
              />

              {/* OTP BOXES */}
              <Animated.View style={[styles.otpContainer, animatedShakeStyle]}>
                {otp.map((digit, index) => (
                  <TouchableOpacity
                    activeOpacity={1}
                    key={index}
                    onPress={() => {
                      inputRefs.current[index]?.focus();
                      setActiveInput(index);
                    }}
                  >
                    <View
                      style={[
                        styles.otpBox,
                        { width: DIGIT_BOX_SIZE, height: DIGIT_BOX_SIZE },
                        digit ? styles.otpBoxFilled : null,
                        activeInput === index ? styles.otpBoxActive : null,
                        error ? styles.otpBoxError : null,
                      ]}
                    >
                      <Text style={styles.otpText}>{digit}</Text>
                      {activeInput === index && !digit && <Text style={styles.cursor}>|</Text>}
                    </View>

                    <TextInput
                      ref={(ref) => (inputRefs.current[index] = ref)}
                      value={digit}
                      onChangeText={(t) => handleBoxChangeText(t, index)}
                      onKeyPress={(e) => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={styles.otpInputHidden}
                      caretHidden
                    />
                  </TouchableOpacity>
                ))}
              </Animated.View>

              {/* ERROR */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Icon name="warning-outline" size={18} color="#ff4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* VERIFY BUTTON */}
              <TouchableOpacity
                style={[styles.buttonContainer, isLoading && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={manualOtp.length !== OTP_LENGTH || isLoading}
              >
                <View style={styles.button}>
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
                </View>
              </TouchableOpacity>

              {/* RESEND */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the code? </Text>
                <TouchableOpacity onPress={handleResendOTP} disabled={countdown > 0}>
                  <Text style={[styles.resendLink, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* AUTO-FILL INFO */}
              {Platform.OS === 'android' && (
                <View style={styles.autofillHint}>
                  <Icon name="flash-outline" size={16} color="#E65C00" />
                  <Text style={styles.autofillHintText}>OTP will be auto-filled from SMS</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

/* ********************************************************************
 *                               STYLES
 ******************************************************************** */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },

  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },

  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 30,
    alignItems: 'center',
  },

  textHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },

  title: { fontSize: 26, fontWeight: '700', color: '#333', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 22 },
  phoneNumber: { color: '#E65C00', fontWeight: '600' },

  smsStatus: {
    marginTop: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EF',
    borderRadius: 8,
  },
  smsStatusText: { color: '#E65C00', marginLeft: 6, fontSize: 12 },

  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width * 0.85,
    marginBottom: 30,
  },

  otpBox: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  otpBoxFilled: {
    borderColor: '#E65C00',
    backgroundColor: '#FFF5EF',
  },

  otpBoxActive: {
    borderColor: '#E65C00',
    backgroundColor: '#fff',
    elevation: 4,
  },

  otpBoxError: { borderColor: '#ff4444' },

  otpText: { fontSize: 22, fontWeight: '600', color: '#333' },
  cursor: { position: 'absolute', color: '#E65C00', fontSize: 24 },

  otpInputHidden: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2F2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },

  errorText: { marginLeft: 8, color: '#ff4444', fontSize: 14 },

  buttonContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginBottom: 25,
  },
  buttonDisabled: { opacity: 0.6 },
  button: {
    backgroundColor: '#E65C00',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  resendText: { fontSize: 15, color: '#666' },
  resendLink: { fontSize: 15, fontWeight: '600', color: '#E65C00' },
  resendDisabled: { color: '#aaa' },

  autofillHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    borderColor: '#E65C00',
    borderWidth: 1,
  },
  autofillHintText: { color: '#E65C00', marginLeft: 6, fontSize: 12 },
});

export default OTPScreen;