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
  Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

const LoginScreen = () => {
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList, 'Login'>>();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const shakeAnimation = new Animated.Value(0);

  const handleContinue = () => {
    if (!input.trim()) {
      setError('Please enter mobile number or email');
      shakeInput();
      return;
    }

    if (input.includes('@')) {
      if (!input.includes('.') || input.length < 5) {
        setError('Please enter a valid email');
        shakeInput();
        return;
      }
    } else {
      const digits = input.replace(/\D/g, '');
      if (digits.length < 8) {
        setError('Please enter a valid mobile number');
        shakeInput();
        return;
      }
    }

    setError('');
    navigation.navigate('OTP', { userInput: input });
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
          <Text style={styles.sub}>Enter your mobile number or email to continue</Text>

          <Animated.View style={[styles.inputContainer, animatedStyle]}>
            <TextInput
              placeholder="Enter your mobile number or email"
              style={[
                styles.input,
                isFocused && styles.inputFocused,
                error ? styles.inputError : null
              ]}
              placeholderTextColor="#999"
              value={input}
              onChangeText={(text) => {
                setInput(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              textAlignVertical="center"
            />
          </Animated.View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !input.trim() && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!input.trim()}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  content: { 
    flex: 1, 
    padding: 24, 
    justifyContent: 'center' 
  },
  heading: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: '#333', 
    marginBottom: 8 
  },
  sub: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 32 
  },
  inputContainer: { 
    marginBottom: 16 
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
    shadowOpacity: 0 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 16 
  },
});

export default LoginScreen;