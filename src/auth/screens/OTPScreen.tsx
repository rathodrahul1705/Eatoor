import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Keyboard,
  TouchableWithoutFeedback, Animated, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { OTPScreenProps } from '../../types/navigation.d';

const OTPScreen: React.FC<OTPScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { userInput } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const shakeAnimation = new Animated.Value(0);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length === 6) {
      setIsLoading(true);
      Keyboard.dismiss();
      
      // Simulate API verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      navigation.dispatch(
        StackActions.replace('Home', { screen: 'HomeTabs' })
      );
    } else {
      setError('Please enter a valid 6-digit OTP');
      shakeInput();
    }
  };

  const handleResendOTP = () => {
    if (!canResend) return;
    setCountdown(30);
    setCanResend(false);
    setOtp('');
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit OTP to{"\n"}
            <Text style={styles.phoneNumber}>{userInput}</Text>
          </Text>

          <Animated.View style={[styles.inputContainer, animatedStyle]}>
            <TextInput
              style={styles.input}
              placeholder="• • • • • •"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
              value={otp}
              onChangeText={(text) => {
                setOtp(text);
                setError('');
              }}
              maxLength={6}
              textAlign="center"
              autoFocus
            />
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (otp.length !== 6 || isLoading) && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={otp.length !== 6 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the OTP?</Text>
            <TouchableOpacity onPress={handleResendOTP} disabled={!canResend}>
              <Text style={[styles.resendLink, !canResend && styles.resendDisabled]}>
                {canResend ? 'Resend OTP' : `Resend in ${countdown}s`}
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
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight,
    left: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    marginTop: 40,
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
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    fontSize: 24,
    letterSpacing: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    color: '#333',
    fontWeight: '600',
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 16,
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