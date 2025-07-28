import React, { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendOTP } from '../../api/auth';

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const shakeAnimation = new Animated.Value(0);

  const handleContinue = async () => {
    if (!mobileNumber) {
      setError('Please enter mobile number');
      shakeInput();
      return;
    }

    if (mobileNumber.length !== 10) {
      setError('Mobile number must be 10 digits');
      shakeInput();
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await sendOTP(mobileNumber);
      if (response?.status == 200) {
        navigation.navigate('OTP', { userInput: mobileNumber });
      } else {
        setError(response?.data?.message || 'Failed to send OTP. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong. Try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setMobileNumber(numericText.slice(0, 10));
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.heading}>Welcome Back!</Text>
          <Text style={styles.sub}>Enter your 10-digit mobile number</Text>

          <Animated.View style={[styles.inputContainer, animatedStyle]}>
            <TextInput
              placeholder="Enter 10-digit mobile number"
              style={[
                styles.input,
                isFocused && styles.inputFocused,
                error ? styles.inputError : null,
              ]}
              placeholderTextColor="#999"
              value={mobileNumber}
              onChangeText={handleInputChange}
              keyboardType="number-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              textAlignVertical="center"
              maxLength={10}
              editable={!isLoading}
            />
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.button,
              mobileNumber.length !== 10 && styles.buttonDisabled,
              isLoading && styles.buttonLoading,
            ]}
            onPress={handleContinue}
            disabled={mobileNumber.length !== 10 || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    height: 52,
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: 0.2,
    fontFamily: Platform.OS === 'android' ? 'sans-serif' : undefined,
  },
  inputFocused: {
    borderColor: '#E65C00',
    borderWidth: 1.5,
    shadowColor: '#E65C0040',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  inputError: {
    borderColor: '#ff4444',
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#E65C00',
    borderRadius: 10,
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
  buttonLoading: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default LoginScreen;
