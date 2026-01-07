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
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  SafeAreaView,
  Animated,
  Easing
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { updatePersonalDetails } from '../../../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../../../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Enhanced responsive size calculation
const scaleSize = (size: number) => {
  const scale = SCREEN_WIDTH / 375;
  return Math.round(size * Math.min(scale, 1.5));
};

const getResponsiveValue = (mobile: number, tablet: number) => {
  return SCREEN_WIDTH >= 768 ? tablet : mobile;
};

const PersonalDetailsScreen = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const [name, setName] = useState('');
  const [deliveryPreference, setDeliveryPreference] = useState<'veg' | 'nonveg' | ''>('');
  const [whatsappUpdates, setWhatsappUpdates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const { login } = useContext(AuthContext);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  const buttonScale = useState(new Animated.Value(1))[0];

  // Device detection
  const isSmallDevice = width < 375;
  const isTablet = width >= 768;
  const isIOS = Platform.OS === 'ios';

  // Responsive values
  const headerHeight = getResponsiveValue(isIOS ? 90 : 70, 100);
  const inputHeight = getResponsiveValue(56, 64);
  const optionButtonHeight = getResponsiveValue(70, 80);
  const borderRadius = getResponsiveValue(16, 20);
  const fontSize = {
    small: getResponsiveValue(12, 14),
    regular: getResponsiveValue(14, 16),
    large: getResponsiveValue(16, 18),
    xlarge: getResponsiveValue(18, 20),
    header: getResponsiveValue(24, 28)
  };

  // Validate form
  useEffect(() => {
    setIsFormValid(name.trim().length > 0 && deliveryPreference !== '');
  }, [name, deliveryPreference]);

  // Animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      })
    ]).start();
  }, []);

  // Button press animation
  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleSubmit = async () => {
    if (!isFormValid || loading) return;

    animateButtonPress();
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

  const renderHeader = () => (
    <View style={[
      styles.header,
      {
        height: headerHeight,
        paddingTop: isIOS ? 40 : StatusBar.currentHeight,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
      }
    ]}>
      <TouchableOpacity
        style={[
          styles.backButton,
          isSmallDevice && styles.backButtonSmall,
          isTablet && styles.backButtonTablet
        ]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon 
          name="chevron-back" 
          size={getResponsiveValue(24, 28)} 
          color="#333" 
        />
      </TouchableOpacity>
      
      <Animated.Text
        style={[
          styles.headerTitle,
          {
            fontSize: fontSize.header,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          },
          isSmallDevice && styles.headerTitleSmall,
          isTablet && styles.headerTitleTablet
        ]}
      >
        Personal Details
      </Animated.Text>
      
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderNameInput = () => (
    <Animated.View
      style={[
        styles.inputCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        },
        isSmallDevice && styles.inputCardSmall,
        isTablet && styles.inputCardTablet,
        focusedInput === 'name' && styles.inputCardFocused
      ]}
    >
      <View style={styles.inputLabelContainer}>
        <Icon 
          name="person-circle-outline" 
          size={getResponsiveValue(20, 24)} 
          color="#FF6B35" 
          style={styles.labelIcon}
        />
        <Text style={[
          styles.inputLabel,
          { fontSize: fontSize.large },
          isSmallDevice && styles.inputLabelSmall,
          isTablet && styles.inputLabelTablet
        ]}>
          What's your name?
        </Text>
      </View>
      
      <View style={[
        styles.inputWrapper,
        {
          height: inputHeight,
          borderRadius: borderRadius,
        },
        isSmallDevice && styles.inputWrapperSmall,
        isTablet && styles.inputWrapperTablet,
        focusedInput === 'name' && styles.inputWrapperFocused
      ]}>
        <Icon 
          name="person-outline" 
          size={getResponsiveValue(20, 24)} 
          color={focusedInput === 'name' ? '#FF6B35' : '#999'} 
          style={styles.inputIcon}
        />
        <TextInput
          style={[
            styles.textInput,
            { fontSize: fontSize.regular },
            isSmallDevice && styles.textInputSmall,
            isTablet && styles.textInputTablet
          ]}
          placeholder="Enter your full name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          onFocus={() => setFocusedInput('name')}
          onBlur={() => setFocusedInput(null)}
          autoCapitalize="words"
          autoFocus={true}
          selectionColor="#FF6B35"
        />
        {name.length > 0 && (
          <TouchableOpacity
            onPress={() => setName('')}
            style={styles.clearButton}
          >
            <Icon 
              name="close-circle" 
              size={getResponsiveValue(18, 22)} 
              color="#999" 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {name.trim().length === 0 && (
        <Animated.View style={styles.errorContainer}>
          <Icon name="alert-circle" size={getResponsiveValue(14, 16)} color="#FF4444" />
          <Text style={[
            styles.errorText,
            { fontSize: fontSize.small },
            isSmallDevice && styles.errorTextSmall,
            isTablet && styles.errorTextTablet
          ]}>
            Please enter your name
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  const renderDeliveryPreference = () => (
    <Animated.View
      style={[
        styles.inputCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        },
        isSmallDevice && styles.inputCardSmall,
        isTablet && styles.inputCardTablet
      ]}
    >
      <View style={styles.inputLabelContainer}>
        <Icon 
          name="restaurant-outline" 
          size={getResponsiveValue(20, 24)} 
          color="#FF6B35" 
          style={styles.labelIcon}
        />
        <Text style={[
          styles.inputLabel,
          { fontSize: fontSize.large },
          isSmallDevice && styles.inputLabelSmall,
          isTablet && styles.inputLabelTablet
        ]}>
          Delivery Preference
        </Text>
      </View>
      
      <View style={[
        styles.optionGrid,
        isTablet && styles.optionGridTablet
      ]}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            {
              height: optionButtonHeight,
              borderRadius: borderRadius,
            },
            isSmallDevice && styles.optionCardSmall,
            isTablet && styles.optionCardTablet,
            deliveryPreference === 'veg' && styles.vegOptionSelected
          ]}
          onPress={() => setDeliveryPreference('veg')}
          activeOpacity={0.7}
        >
          <View style={styles.optionContent}>
            <View style={styles.optionLeft}>
              <View style={[
                styles.vegBadge,
                deliveryPreference === 'veg' && styles.vegBadgeSelected
              ]}>
                <Icon 
                  name="leaf-outline" 
                  size={getResponsiveValue(18, 22)} 
                  color={deliveryPreference === 'veg' ? '#FFFFFF' : '#4CAF50'} 
                />
                <Text style={[
                  styles.badgeText,
                  { fontSize: fontSize.small },
                  deliveryPreference === 'veg' && styles.badgeTextSelected
                ]}>
                  VEG
                </Text>
              </View>
            </View>
            
            <View style={styles.optionCenter}>
              <Text style={[
                styles.optionTitle,
                { fontSize: fontSize.regular },
                isSmallDevice && styles.optionTitleSmall,
                isTablet && styles.optionTitleTablet,
                deliveryPreference === 'veg' && styles.optionTitleSelected
              ]}>
                Vegetarian
              </Text>
              <Text style={[
                styles.optionDescription,
                { fontSize: fontSize.small },
                deliveryPreference === 'veg' && styles.optionDescriptionSelected
              ]}>
                Plant-based meals only
              </Text>
            </View>
            
            <View style={styles.optionRight}>
              {deliveryPreference === 'veg' && (
                <View style={styles.selectedIndicator}>
                  <Icon 
                    name="checkmark-circle" 
                    size={getResponsiveValue(24, 28)} 
                    color="#4CAF50" 
                  />
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            {
              height: optionButtonHeight,
              borderRadius: borderRadius,
            },
            isSmallDevice && styles.optionCardSmall,
            isTablet && styles.optionCardTablet,
            deliveryPreference === 'nonveg' && styles.nonvegOptionSelected
          ]}
          onPress={() => setDeliveryPreference('nonveg')}
          activeOpacity={0.7}
        >
          <View style={styles.optionContent}>
            <View style={styles.optionLeft}>
              <View style={[
                styles.nonvegBadge,
                deliveryPreference === 'nonveg' && styles.nonvegBadgeSelected
              ]}>
                <Icon 
                  name="nutrition-outline" 
                  size={getResponsiveValue(18, 22)} 
                  color={deliveryPreference === 'nonveg' ? '#FFFFFF' : '#FF4444'} 
                />
                <Text style={[
                  styles.badgeText,
                  { fontSize: fontSize.small },
                  deliveryPreference === 'nonveg' && styles.badgeTextSelected
                ]}>
                  NON-VEG
                </Text>
              </View>
            </View>
            
            <View style={styles.optionCenter}>
              <Text style={[
                styles.optionTitle,
                { fontSize: fontSize.regular },
                isSmallDevice && styles.optionTitleSmall,
                isTablet && styles.optionTitleTablet,
                deliveryPreference === 'nonveg' && styles.optionTitleSelected
              ]}>
                Non-Vegetarian
              </Text>
              <Text style={[
                styles.optionDescription,
                { fontSize: fontSize.small },
                deliveryPreference === 'nonveg' && styles.optionDescriptionSelected
              ]}>
                Includes meat & seafood
              </Text>
            </View>
            
            <View style={styles.optionRight}>
              {deliveryPreference === 'nonveg' && (
                <View style={styles.selectedIndicator}>
                  <Icon 
                    name="checkmark-circle" 
                    size={getResponsiveValue(24, 28)} 
                    color="#FF4444" 
                  />
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
      
      {deliveryPreference === '' && (
        <Animated.View style={styles.errorContainer}>
          <Icon name="alert-circle" size={getResponsiveValue(14, 16)} color="#FF4444" />
          <Text style={[
            styles.errorText,
            { fontSize: fontSize.small },
            isSmallDevice && styles.errorTextSmall,
            isTablet && styles.errorTextTablet
          ]}>
            Please select a preference
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );

  const renderWhatsappUpdates = () => (
    <Animated.View
      style={[
        styles.switchCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderRadius: borderRadius,
        },
        isSmallDevice && styles.switchCardSmall,
        isTablet && styles.switchCardTablet
      ]}
    >
      <View style={styles.switchHeader}>
        <View style={styles.switchIconContainer}>
          <View style={[
            styles.whatsappIconContainer,
            { 
              width: getResponsiveValue(48, 56),
              height: getResponsiveValue(48, 56),
              borderRadius: borderRadius - 4
            }
          ]}>
            <Icon 
              name="logo-whatsapp" 
              size={getResponsiveValue(24, 28)} 
              color="#25D366" 
            />
          </View>
        </View>
        
        <View style={[
          styles.switchTextGroup,
          isSmallDevice && styles.switchTextGroupSmall,
          isTablet && styles.switchTextGroupTablet
        ]}>
          <Text style={[
            styles.switchLabel,
            { fontSize: fontSize.large },
            isSmallDevice && styles.switchLabelSmall,
            isTablet && styles.switchLabelTablet
          ]}>
            WhatsApp Updates
          </Text>
          <Text style={[
            styles.switchDescription,
            { fontSize: fontSize.small },
            isSmallDevice && styles.switchDescriptionSmall,
            isTablet && styles.switchDescriptionTablet
          ]}>
            Get real-time order updates on WhatsApp
          </Text>
        </View>
      </View>
      
      <View style={styles.switchToggleContainer}>
        <Text style={[
          styles.switchStatus,
          { fontSize: fontSize.small },
          whatsappUpdates && styles.switchStatusActive
        ]}>
          {whatsappUpdates ? 'Enabled' : 'Disabled'}
        </Text>
        <Switch
          value={whatsappUpdates}
          onValueChange={setWhatsappUpdates}
          thumbColor={whatsappUpdates ? '#25D366' : '#F4F3F4'}
          trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
          ios_backgroundColor="#E0E0E0"
          style={[
            styles.switch,
            isTablet && { transform: [{ scale: 1.2 }] }
          ]}
        />
      </View>
    </Animated.View>
  );

  const renderSubmitButton = () => (
    <Animated.View
      style={[
        styles.buttonContainer,
        {
          transform: [{ scale: buttonScale }],
          opacity: fadeAnim
        }
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            height: getResponsiveValue(56, 64),
            borderRadius: borderRadius,
          },
          isSmallDevice && styles.buttonSmall,
          isTablet && styles.buttonTablet,
          isFormValid ? styles.buttonEnabled : styles.buttonDisabled
        ]}
        onPress={handleSubmit}
        disabled={!isFormValid || loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator 
            color="#fff" 
            size={isTablet ? 'large' : 'small'} 
          />
        ) : (
          <View style={styles.buttonContent}>
            <Text style={[
              styles.buttonText,
              { fontSize: fontSize.large },
              isSmallDevice && styles.buttonTextSmall,
              isTablet && styles.buttonTextTablet
            ]}>
              Continue
            </Text>
            <Icon 
              name="arrow-forward" 
              size={getResponsiveValue(20, 24)} 
              color="#fff" 
              style={styles.buttonIcon}
            />
          </View>
        )}
      </TouchableOpacity>
      
      <Text style={[
        styles.buttonHint,
        { fontSize: fontSize.small },
        isSmallDevice && styles.buttonHintSmall,
        isTablet && styles.buttonHintTablet
      ]}>
        Complete your profile to get started
      </Text>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFFFFF" 
        translucent={false}
      />
      
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {renderHeader()}
          
          <ScrollView 
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: getResponsiveValue(20, 40),
                minHeight: height - headerHeight
              }
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {renderNameInput()}
              {renderDeliveryPreference()}
              {renderWhatsappUpdates()}
              {renderSubmitButton()}
            </Animated.View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: getResponsiveValue(20, 32),
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  backButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  backButtonTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerTitle: {
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerTitleSmall: {
    fontSize: 20,
  },
  headerTitleTablet: {
    fontSize: 28,
  },
  headerSpacer: {
    width: 40,
  },
  
  // Scroll Content
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: getResponsiveValue(20, 32),
    paddingTop: getResponsiveValue(16, 24),
  },
  
  // Welcome Container
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: getResponsiveValue(32, 48),
    paddingHorizontal: getResponsiveValue(10, 20),
  },
  welcomeIcon: {
    marginBottom: getResponsiveValue(16, 20),
  },
  welcomeText: {
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeTextSmall: {
    fontSize: 20,
  },
  welcomeTextTablet: {
    fontSize: 32,
  },
  subtitle: {
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: getResponsiveValue(10, 40),
  },
  subtitleSmall: {
    fontSize: 14,
    lineHeight: 20,
  },
  subtitleTablet: {
    fontSize: 20,
    lineHeight: 28,
  },
  
  // Input Card
  inputCard: {
    marginBottom: getResponsiveValue(24, 32),
    backgroundColor: '#FFFFFF',
    borderRadius: getResponsiveValue(16, 20),
    padding: getResponsiveValue(20, 24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  inputCardSmall: {
    padding: getResponsiveValue(16, 20),
  },
  inputCardTablet: {
    padding: getResponsiveValue(28, 32),
  },
  inputCardFocused: {
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.15,
    elevation: 6,
  },
  
  // Input Label Container
  inputLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: getResponsiveValue(12, 16),
  },
  labelIcon: {
    marginRight: getResponsiveValue(10, 12),
  },
  
  // Input Label
  inputLabel: {
    fontWeight: '600',
    color: '#1A1A1A',
  },
  inputLabelSmall: {
    fontSize: 14,
  },
  inputLabelTablet: {
    fontSize: 20,
  },
  
  // Input Wrapper
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  inputWrapperSmall: {
    height: 48,
  },
  inputWrapperTablet: {
    height: 64,
  },
  inputWrapperFocused: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginHorizontal: getResponsiveValue(16, 20),
  },
  
  // Clear Button
  clearButton: {
    padding: getResponsiveValue(8, 10),
    marginRight: getResponsiveValue(8, 12),
  },
  
  // Text Input
  textInput: {
    flex: 1,
    color: '#1A1A1A',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  textInputSmall: {
    fontSize: 14,
  },
  textInputTablet: {
    fontSize: 18,
  },
  
  // Error Container
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: getResponsiveValue(8, 12),
    paddingHorizontal: 4,
  },
  
  // Error Text
  errorText: {
    color: '#FF4444',
    fontWeight: '500',
    marginLeft: getResponsiveValue(6, 8),
  },
  errorTextSmall: {
    fontSize: 11,
  },
  errorTextTablet: {
    fontSize: 14,
  },
  
  // Option Grid
  optionGrid: {
    gap: getResponsiveValue(12, 16),
  },
  optionGridTablet: {
    flexDirection: 'row',
  },
  
  // Option Card
  optionCard: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  optionCardSmall: {
    height: 60,
  },
  optionCardTablet: {
    flex: 1,
  },
  vegOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#F8FCF8',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.15,
    elevation: 6,
  },
  nonvegOptionSelected: {
    borderColor: '#FF4444',
    backgroundColor: '#FFF8F8',
    shadowColor: '#FF4444',
    shadowOpacity: 0.15,
    elevation: 6,
  },
  
  // Option Content
  optionContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: getResponsiveValue(16, 20),
  },
  optionLeft: {
    marginRight: getResponsiveValue(12, 16),
  },
  optionCenter: {
    flex: 1,
  },
  optionRight: {
    marginLeft: getResponsiveValue(8, 12),
  },
  
  // Badge Styles
  vegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: getResponsiveValue(10, 12),
    paddingVertical: getResponsiveValue(6, 8),
    borderRadius: getResponsiveValue(8, 10),
    borderWidth: 1,
    borderColor: '#C8E6C9',
    minWidth: getResponsiveValue(70, 80),
  },
  nonvegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: getResponsiveValue(10, 12),
    paddingVertical: getResponsiveValue(6, 8),
    borderRadius: getResponsiveValue(8, 10),
    borderWidth: 1,
    borderColor: '#FFCDD2',
    minWidth: getResponsiveValue(85, 95),
  },
  vegBadgeSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#45a049',
  },
  nonvegBadgeSelected: {
    backgroundColor: '#FF4444',
    borderColor: '#e53935',
  },
  
  // Badge Text
  badgeText: {
    color: '#4CAF50',
    fontWeight: '700',
    marginLeft: getResponsiveValue(4, 6),
  },
  badgeTextSelected: {
    color: '#FFFFFF',
  },
  
  // Selected Indicator
  selectedIndicator: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 2,
  },
  
  // Option Title
  optionTitle: {
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionTitleSmall: {
    fontSize: 14,
  },
  optionTitleTablet: {
    fontSize: 18,
  },
  optionTitleSelected: {
    color: '#1A1A1A',
  },
  
  // Option Description
  optionDescription: {
    color: '#666',
  },
  optionDescriptionSelected: {
    color: '#666',
  },
  
  // Switch Card
  switchCard: {
    backgroundColor: '#FFFFFF',
    padding: getResponsiveValue(20, 24),
    marginBottom: getResponsiveValue(32, 48),
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  switchCardSmall: {
    padding: getResponsiveValue(16, 20),
  },
  switchCardTablet: {
    padding: getResponsiveValue(28, 32),
  },
  
  // Switch Header
  switchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: getResponsiveValue(16, 20),
  },
  
  // Switch Icon Container
  switchIconContainer: {
    marginRight: getResponsiveValue(16, 20),
  },
  
  // WhatsApp Icon Container
  whatsappIconContainer: {
    backgroundColor: '#F1F8E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E8F5E9',
  },
  
  // Switch Text Group
  switchTextGroup: {
    flex: 1,
  },
  switchTextGroupSmall: {
    marginLeft: 12,
  },
  switchTextGroupTablet: {
    marginLeft: 20,
  },
  
  // Switch Label
  switchLabel: {
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  switchLabelSmall: {
    fontSize: 14,
  },
  switchLabelTablet: {
    fontSize: 20,
  },
  
  // Switch Description
  switchDescription: {
    color: '#666',
    lineHeight: 18,
  },
  switchDescriptionSmall: {
    fontSize: 12,
    lineHeight: 16,
  },
  switchDescriptionTablet: {
    fontSize: 16,
    lineHeight: 22,
  },
  
  // Switch Toggle Container
  switchToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: getResponsiveValue(12, 16),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  
  // Switch Status
  switchStatus: {
    color: '#999',
    fontWeight: '500',
  },
  switchStatusActive: {
    color: '#25D366',
  },
  
  // Switch Component
  switch: {
    transform: [{ scale: 0.9 }],
  },
  
  // Button Container
  buttonContainer: {
    marginBottom: getResponsiveValue(20, 32),
  },
  
  // Button
  button: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: getResponsiveValue(12, 16),
  },
  buttonSmall: {
    height: 52,
  },
  buttonTablet: {
    height: 70,
  },
  buttonEnabled: {
    backgroundColor: '#FF6B35',
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0.05,
    elevation: 2,
  },
  
  // Button Content
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: getResponsiveValue(24, 32),
    flex: 1,
  },
  
  // Button Text
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonTextSmall: {
    fontSize: 16,
  },
  buttonTextTablet: {
    fontSize: 20,
  },
  
  // Button Icon
  buttonIcon: {
    marginLeft: getResponsiveValue(8, 12),
  },
  
  // Button Hint
  buttonHint: {
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonHintSmall: {
    fontSize: 11,
  },
  buttonHintTablet: {
    fontSize: 14,
  },
});

export default PersonalDetailsScreen;