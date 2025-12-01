import React, { useState, useEffect, useContext } from 'react';
import {
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  Keyboard,
  TouchableWithoutFeedback, 
  ScrollView, 
  Switch, 
  Platform, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { updatePersonalDetails } from '../../../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../../context/AuthContext';

const PersonalDetailsScreen = () => {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [deliveryPreference, setDeliveryPreference] = useState<'veg' | 'nonveg' | ''>('');
  const [whatsappUpdates, setWhatsappUpdates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const { login } = useContext(AuthContext);

  // Validate form whenever name or deliveryPreference changes
  useEffect(() => {
    setIsFormValid(name.trim().length > 0 && deliveryPreference !== '');
  }, [name, deliveryPreference]);

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setLoading(true);
    Keyboard.dismiss();

    try {
      const payload = {
        full_name: name.trim(),
        delivery_preference: deliveryPreference === 'veg' ? 1 : 2,
        whatsapp_updates: whatsappUpdates ? 1 : 0,
      };

      const response = await updatePersonalDetails(payload);

      if (response.status === 200) {
        await AsyncStorage.multiSet([
          ['user', JSON.stringify(response.data.user)]
        ]);
        login(response.data.tokens.access);
        navigation.navigate('HomeTabs');
      } else {
        console.error('Update failed', response.data);
      }
    } catch (error) {
      console.error('Error updating personal details:', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Personal Details</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>What's your name?</Text>
            <View style={styles.inputContainer}>
              <Icon name="person-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus={true}
              />
            </View>
            {name.trim().length === 0 && (
              <Text style={styles.errorText}>Please enter your name</Text>
            )}
          </View>

          {/* Delivery Preference */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>What is your delivery preference?</Text>
            <View style={styles.optionContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  deliveryPreference === 'veg' && styles.vegOptionSelected
                ]}
                onPress={() => setDeliveryPreference('veg')}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View style={[
                    styles.itemTypeBadge,
                    styles.vegBadge,
                    deliveryPreference === 'veg' && styles.vegBadgeSelected
                  ]}>
                    <View style={[
                      styles.itemTypeIndicator,
                      styles.vegIndicator,
                      deliveryPreference === 'veg' && styles.vegIndicatorSelected
                    ]}>
                      <View style={styles.itemTypeDot} />
                    </View>
                  </View>
                  <Text style={styles.optionText}>Vegetarian</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  deliveryPreference === 'nonveg' && styles.nonvegOptionSelected
                ]}
                onPress={() => setDeliveryPreference('nonveg')}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View style={[
                    styles.itemTypeBadge,
                    styles.nonVegBadge,
                    deliveryPreference === 'nonveg' && styles.nonVegBadgeSelected
                  ]}>
                    <View style={[
                      styles.itemTypeIndicator,
                      styles.nonVegIndicator,
                      deliveryPreference === 'nonveg' && styles.nonVegIndicatorSelected
                    ]}>
                      <View style={styles.itemTypeDot} />
                    </View>
                  </View>
                  <Text style={styles.optionText}>Non-Vegetarian</Text>
                </View>
              </TouchableOpacity>
            </View>
            {deliveryPreference === '' && (
              <Text style={styles.errorText}>Please select a preference</Text>
            )}
          </View>

          {/* WhatsApp Updates */}
          <View style={styles.switchContainer}>
            <View style={styles.switchTextContainer}>
              <View style={styles.whatsappIconContainer}>
                <Icon name="logo-whatsapp" size={20} color="#fff" />
              </View>
              <View style={styles.switchTextGroup}>
                <Text style={styles.switchLabel}>WhatsApp Updates</Text>
                <Text style={styles.switchDescription}>Get order updates on WhatsApp</Text>
              </View>
            </View>
            <Switch
              value={whatsappUpdates}
              onValueChange={setWhatsappUpdates}
              thumbColor={whatsappUpdates ? '#fff' : '#f4f3f4'}
              trackColor={{ false: '#767577', true: '#25D366' }}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.button,
              !isFormValid && styles.buttonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid || loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    flex: 1,
    marginLeft: 15,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  inputGroup: {
    marginBottom: 28,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    letterSpacing: 0.2,
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    color: '#333',
    height: 52,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  optionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  optionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginHorizontal: 6,
    backgroundColor: '#fff',
    height: 60,
    justifyContent: 'center',
  },
  vegOptionSelected: {
    backgroundColor: '#F0F9F0',
    borderColor: '#4CAF50',
  },
  nonvegOptionSelected: {
    backgroundColor: '#FFF0F0',
    borderColor: '#F44336',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemTypeBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vegBadge: {
    borderColor: '#4CAF50',
  },
  nonVegBadge: {
    borderColor: '#F44336',
  },
  vegBadgeSelected: {
    borderColor: '#4CAF50',
  },
  nonVegBadgeSelected: {
    borderColor: '#F44336',
  },
  itemTypeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegIndicator: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicator: {
    backgroundColor: '#F44336',
  },
  vegIndicatorSelected: {
    backgroundColor: '#4CAF50',
  },
  nonVegIndicatorSelected: {
    backgroundColor: '#F44336',
  },
  itemTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    marginBottom: 28,
  },
  switchTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTextGroup: {
    marginLeft: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  switchDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#e65c00',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#e65c0080', // Semi-transparent disabled state
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PersonalDetailsScreen;