import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { validateVpa } from '../../../../api/payment';

const { width, height } = Dimensions.get('window');

// Responsive scaling functions
const scale = (size: number) => (width / 375) * size;
const verticalScale = (size: number) => (height / 812) * size;
const moderateScale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;
const normalize = (size: number) => Math.round(scale(size));

// Responsive font sizes
const FONT = {
  XS: Math.max(10, normalize(10)),
  SM: Math.max(11, normalize(12)),
  BASE: Math.max(12, normalize(14)),
  LG: Math.max(14, normalize(16)),
  XL: Math.max(16, normalize(18)),
  XXL: Math.max(18, normalize(20)),
  XXXL: Math.max(20, normalize(22)),
};

// Type definitions
export type UPIPaymentApp = {
  method_id?: number;
  id: string;
  name: string;
  packageName: string;
  scheme: string;
  iosScheme: string;
  priority: number;
  installed: boolean;
  icon: string | null;
  customUPIID?: string;
  vpa?: string; // Added VPA field
};

export type WalletPaymentMethod = {
  method_id: number;
  id: string;
  name: string;
  icon: string;
  balance: number;
  is_active: boolean;
};

export type NetbankingBank = {
  code: string;
  name: string;
};

export type NetbankingData = {
  method_id: number;
  is_active: boolean;
  icon: string;
  supported_banks: NetbankingBank[];
};

export type CardData = {
  is_active: boolean;
  icon: string;
  supported: {
    type: string;
    method_id: number;
  }[];
};

export type CODData = {
  method_id: number;
  is_active: boolean;
  icon: string;
  message: string;
};

export type PaymentMethodsResponse = {
  upi: {
    isActive: boolean;
    apps: UPIPaymentApp[];
  };
  wallets: {
    isActive: boolean;
    wallets: WalletPaymentMethod[];
  };
  netbanking: {
    isActive: boolean;
    data: NetbankingData;
  };
  cards: {
    isActive: boolean;
    data: CardData;
  };
  cod: {
    isActive: boolean;
    data: CODData;
  };
};

export type SelectedPaymentType = 'upi' | 'wallet' | 'cod' | 'netbanking' | 'cards' | null;

export interface SelectedUPIDetails {
  upiApp: UPIPaymentApp | null;
  vpa: string;
  paymentMethodType: string;
}

interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  paymentMethods: PaymentMethodsResponse | null;
  selectedPaymentType: SelectedPaymentType;
  selectedUpiApp: UPIPaymentApp | null;
  selectedWalletApp: WalletPaymentMethod | null;
  selectedBank: NetbankingBank | null;
  selectedCardType: 'credit_card' | 'debit_card' | null;
  savedUpiIds: any[];
  checkingApps: boolean;
  onSelectPaymentMethod: (
    type: SelectedPaymentType,
    data?: any,
    vpa?: string,
    paymentMethodType?: string
  ) => void;
  onAddCustomUpiId: (upiId: string, vpa?: string) => void;
  onDeleteCustomUpiId: (id: string) => void;
  customUpiId: string;
  setCustomUpiId: (value: string) => void;
  walletBalance?: number;
  isSavingUpi?: boolean;
  userId?: number;
}

// Helper functions
const getIconForUPIApp = (appId: string): string => {
  const icons: Record<string, string> = {
    paytm: 'logo-paytm',
    phonepe: 'logo-phonepe',
    googlepay: 'logo-google',
    cred: 'card-outline',
    bhim: 'shield-checkmark-outline',
    upi: 'qr-code-outline',
    whatsapp: 'logo-whatsapp',
    amazonpay: 'logo-amazon'
  };
  return icons[appId] || 'phone-portrait-outline';
};

const getColorForUPIApp = (appId: string): string => {
  const colors: Record<string, string> = {
    paytm: '#00BAF2',
    phonepe: '#5F259F',
    googlepay: '#4285F4',
    cred: '#00A3E0',
    bhim: '#4CAF50',
    upi: '#25D366',
    whatsapp: '#25D366',
    amazonpay: '#FF9900'
  };
  return colors[appId] || '#E65C00';
};

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  visible,
  onClose,
  paymentMethods,
  selectedPaymentType,
  selectedUpiApp,
  selectedWalletApp,
  selectedBank,
  selectedCardType,
  savedUpiIds,
  checkingApps,
  onSelectPaymentMethod,
  onAddCustomUpiId,
  onDeleteCustomUpiId,
  customUpiId,
  setCustomUpiId,
  walletBalance,
  isSavingUpi = false,
  userId,
}) => {
  const slideAnim = React.useRef(new Animated.Value(height)).current;
  const [isAddUpiExpanded, setIsAddUpiExpanded] = useState(false);
  const [validatingUpi, setValidatingUpi] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [validatedVpa, setValidatedVpa] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
      setIsAddUpiExpanded(false);
      setCustomUpiId('');
      setValidationError(null);
      setValidationSuccess(null);
      setValidatedVpa(null);
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onClose();
      setIsAddUpiExpanded(false);
      setCustomUpiId('');
      setValidationError(null);
      setValidationSuccess(null);
      setValidatedVpa(null);
    });
  };

  const handleValidateAndAddUpi = async () => {
    const trimmedUpiId = customUpiId.trim();
    
    if (!trimmedUpiId) {
      setValidationError('Please enter a UPI ID');
      return;
    }
    
    if (!trimmedUpiId.includes('@')) {
      setValidationError('Please enter a valid UPI ID (e.g., username@bankname)');
      return;
    }

    if (!userId) {
      setValidationError('User ID is missing. Please try again.');
      return;
    }

    setValidationError(null);
    setValidationSuccess(null);
    setValidatingUpi(true);

    try {
      const response = await validateVpa(trimmedUpiId, userId);

      if (response.data) {
        if (response.data.isVPAValid === 1) {
          setValidationSuccess('UPI ID is valid! Adding...');
          setValidatedVpa(trimmedUpiId);
          
          await onAddCustomUpiId(trimmedUpiId, trimmedUpiId);
          
          setCustomUpiId('');
          setIsAddUpiExpanded(false);
          setValidationSuccess(null);
          setValidatedVpa(null);
        } else {
          const errorMsg = response.data.message || 
                          response.data.error || 
                          'Invalid UPI ID. Please check and try again.';
          setValidationError(errorMsg);
        }
      } else {
        setValidationError('Unable to validate UPI ID. Please try again.');
      }
    } catch (error: any) {
      console.error('Error validating UPI:', error);
      
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 400) {
          setValidationError(errorData?.message || 'Invalid UPI ID format');
        } else if (status === 404) {
          setValidationError('UPI ID not found. Please check and try again.');
        } else if (status === 500) {
          setValidationError('Server error. Please try again later.');
        } else {
          setValidationError(errorData?.message || 'Validation failed. Please try again.');
        }
      } else if (error.request) {
        setValidationError('Network error. Please check your connection.');
      } else {
        setValidationError('An error occurred. Please try again.');
      }
    } finally {
      setValidatingUpi(false);
    }
  };

  const handleUpiInputChange = (text: string) => {
    setCustomUpiId(text);
    if (validationError || validationSuccess) {
      setValidationError(null);
      setValidationSuccess(null);
      setValidatedVpa(null);
    }
  };

  const handleSelectUPIApp = (app: UPIPaymentApp) => {
    // Determine VPA based on app type
    let vpa = '';
    let paymentMethodType = 'APP';
    
    if (app.customUPIID) {
      // Custom UPI ID (manually added)
      vpa = app.customUPIID;
      paymentMethodType = 'VPA';
    } else if (app.vpa) {
      // App has predefined VPA
      vpa = app.vpa;
      paymentMethodType = 'VPA';
    } else {
      // For apps without specific VPA, we use app ID as identifier
      vpa = app.id;
      paymentMethodType = 'APP';
    }
    
    onSelectPaymentMethod('upi', app, vpa, paymentMethodType);
  };

  const renderUPISection = () => {
    if (checkingApps) {
      return (
        <View style={styles.upiSectionContainer}>
          <View style={styles.loadingAppsContainer}>
            <ActivityIndicator size="large" color="#E65C00" />
            <Text style={styles.loadingAppsText}>Loading payment options...</Text>
          </View>
        </View>
      );
    }

    const isUPIActive = paymentMethods?.upi?.isActive;
    if (!isUPIActive) {
      return (
        <View style={styles.upiSectionContainer}>
          <Text style={styles.unavailableText}>UPI payments are currently unavailable</Text>
        </View>
      );
    }

    const customUpiApps = savedUpiIds.map(upi => ({
      id: upi.id,
      name: upi.name || upi.upiId,
      packageName: '',
      scheme: '',
      iosScheme: '',
      priority: 999,
      installed: false,
      icon: null,
      customUPIID: upi.upiId,
      vpa: upi.upiId // Set VPA for custom UPI IDs
    }));

    const displayApps = [...(paymentMethods?.upi?.apps || []), ...customUpiApps];

    if (displayApps.length === 0) {
      return (
        <View style={styles.upiSectionContainer}>
          <Text style={styles.noAppsText}>No UPI apps available</Text>
        </View>
      );
    }

    return (
      <View style={styles.upiSectionContainer}>
        <View style={styles.upiAppsList}>
          {displayApps.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={[
                styles.upiAppCard,
                selectedUpiApp?.id === app.id && styles.upiAppCardSelected
              ]}
              onPress={() => handleSelectUPIApp(app)}
              activeOpacity={0.8}
            >
              <View style={styles.upiAppIconContainer}>
                {app.icon ? (
                  <Image 
                    source={{ uri: app.icon }} 
                    style={styles.upiAppImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name={getIconForUPIApp(app.id)} size={moderateScale(28)} color={getColorForUPIApp(app.id)} />
                )}
              </View>
              
              <View style={styles.upiAppInfo}>
                <Text style={styles.upiAppName}>{app.name}</Text>
                {app.customUPIID && (
                  <Text style={styles.upiAppCategory}>{app.customUPIID}</Text>
                )}
                {app.vpa && !app.customUPIID && (
                  <Text style={styles.upiAppVpaText}>VPA: {app.vpa}</Text>
                )}
              </View>
              
              {selectedUpiApp?.id === app.id && (
                <View style={styles.selectedIndicator}>
                  <Icon name="checkmark-circle" size={moderateScale(24)} color="#E65C00" />
                </View>
              )}
              
              {app.customUPIID && (
                <TouchableOpacity 
                  style={styles.deleteUpiButton}
                  onPress={() => onDeleteCustomUpiId(app.id)}
                >
                  <Icon name="close-circle" size={moderateScale(20)} color="#FF4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {!isAddUpiExpanded ? (
          <TouchableOpacity 
            style={styles.addUpiButton}
            onPress={() => setIsAddUpiExpanded(true)}
            activeOpacity={0.7}
          >
            <Icon name="add-circle-outline" size={moderateScale(22)} color="#E65C00" />
            <Text style={styles.addUpiButtonText}>Add New UPI ID</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.expandedUpiContainer}>
            <View style={styles.manualUpiContainer}>
              <TextInput
                style={styles.manualUpiInput}
                placeholder="Enter UPI ID (e.g., name@okhdfcbank)"
                placeholderTextColor="#999"
                value={customUpiId}
                onChangeText={handleUpiInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={true}
                editable={!validatingUpi && !isSavingUpi}
              />
              {customUpiId.length > 0 && !validatingUpi && !isSavingUpi && (
                <TouchableOpacity 
                  style={styles.clearUpiInputButton}
                  onPress={() => {
                    setCustomUpiId('');
                    setValidationError(null);
                    setValidationSuccess(null);
                    setValidatedVpa(null);
                  }}
                >
                  <Icon name="close-circle" size={moderateScale(18)} color="#999" />
                </TouchableOpacity>
              )}
              {(validatingUpi || isSavingUpi) && (
                <ActivityIndicator size="small" color="#E65C00" style={styles.loadingIndicator} />
              )}
            </View>

            {validationSuccess && (
              <View style={styles.validationSuccessContainer}>
                <Icon name="checkmark-circle" size={moderateScale(16)} color="#4CAF50" />
                <Text style={styles.validationSuccessText}>{validationSuccess}</Text>
              </View>
            )}

            {validationError && (
              <View style={styles.validationErrorContainer}>
                <Icon name="alert-circle" size={moderateScale(16)} color="#FF4444" />
                <Text style={styles.validationErrorText}>{validationError}</Text>
              </View>
            )}
            
            <View style={styles.expandedUpiActions}>
              <TouchableOpacity 
                style={styles.cancelUpiButton}
                onPress={() => {
                  setIsAddUpiExpanded(false);
                  setCustomUpiId('');
                  setValidationError(null);
                  setValidationSuccess(null);
                  setValidatedVpa(null);
                }}
                disabled={validatingUpi || isSavingUpi}
              >
                <Text style={styles.cancelUpiButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.saveUpiButton,
                  (!customUpiId.trim() || !customUpiId.includes('@') || validatingUpi || isSavingUpi) && styles.saveUpiButtonDisabled
                ]}
                onPress={handleValidateAndAddUpi}
                disabled={!customUpiId.trim() || !customUpiId.includes('@') || validatingUpi || isSavingUpi}
              >
                {validatingUpi ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.saveUpiButtonText}> Validating...</Text>
                  </>
                ) : isSavingUpi ? (
                  <>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.saveUpiButtonText}> Adding...</Text>
                  </>
                ) : (
                  <Text style={styles.saveUpiButtonText}>Add UPI ID</Text>
                )}
              </TouchableOpacity>
            </View>
            
            {customUpiId.length > 0 && !customUpiId.includes('@') && !validationError && (
              <Text style={styles.hintText}>
                Tip: UPI ID should contain '@' (e.g., username@bankname)
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderWalletSection = () => {
    const areWalletsActive = paymentMethods?.wallets?.isActive;
    const wallets = paymentMethods?.wallets?.wallets || [];
    
    if (!areWalletsActive || wallets.length === 0) {
      return (
        <View style={styles.paymentSectionContent}>
          <Text style={styles.unavailableText}>Wallet payments are currently unavailable</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.paymentSectionContent}>
        <View style={styles.walletAppsList}>
          {wallets.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={[
                styles.walletCard,
                selectedWalletApp?.id === wallet.id && styles.walletCardSelected
              ]}
              onPress={() => onSelectPaymentMethod('wallet', wallet)}
            >
              <View style={styles.walletIconContainer}>
                {wallet.icon ? (
                  <Image 
                    source={{ uri: wallet.icon }} 
                    style={styles.walletImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name="wallet-outline" size={moderateScale(28)} color="#E65C00" />
                )}
              </View>
              <View style={styles.walletInfo}>
                <Text style={styles.walletName}>{wallet.name}</Text>
                <Text style={styles.walletBalanceText}>
                  Balance: ₹{(walletBalance || 0).toFixed(2)}
                </Text>
              </View>
              {selectedWalletApp?.id === wallet.id && (
                <View style={styles.selectedIndicator}>
                  <Icon name="checkmark-circle" size={moderateScale(24)} color="#E65C00" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderNetbankingSection = () => {
    const isNetbankingActive = paymentMethods?.netbanking?.isActive;
    const netbankingData = paymentMethods?.netbanking?.data;
    const banks = netbankingData?.supported_banks || [];
    
    if (!isNetbankingActive || banks.length === 0) {
      return (
        <View style={styles.paymentSectionContent}>
          <Text style={styles.unavailableText}>Net Banking is currently unavailable</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.paymentSectionContent}>
        <Text style={styles.sectionSubtitle}>Select Bank</Text>
        <View style={styles.banksList}>
          {banks.map((bank) => (
            <TouchableOpacity
              key={bank.code}
              style={[
                styles.bankCard,
                selectedBank?.code === bank.code && styles.bankCardSelected
              ]}
              onPress={() => onSelectPaymentMethod('netbanking', bank)}
            >
              <View style={styles.bankIconContainer}>
                {netbankingData?.icon ? (
                  <Image 
                    source={{ uri: netbankingData.icon }} 
                    style={styles.bankImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon name="business-outline" size={moderateScale(24)} color="#E65C00" />
                )}
              </View>
              <Text style={styles.bankName}>{bank.name}</Text>
              {selectedBank?.code === bank.code && (
                <View style={styles.selectedIndicator}>
                  <Icon name="checkmark-circle" size={moderateScale(20)} color="#E65C00" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCardsSection = () => {
    const areCardsActive = paymentMethods?.cards?.isActive;
    const cardData = paymentMethods?.cards?.data;
    const supportedCards = cardData?.supported || [];
    
    if (!areCardsActive || supportedCards.length === 0) {
      return (
        <View style={styles.paymentSectionContent}>
          <Text style={styles.unavailableText}>Card payments are currently unavailable</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.paymentSectionContent}>
        <Text style={styles.sectionSubtitle}>Select Card Type</Text>
        <View style={styles.cardsList}>
          {supportedCards.map((card) => (
            <TouchableOpacity
              key={card.type}
              style={[
                styles.cardCard,
                selectedCardType === card.type && styles.cardCardSelected
              ]}
              onPress={() => onSelectPaymentMethod('cards', card.type)}
            >
              <View style={styles.cardIconContainer}>
                {cardData?.icon ? (
                  <Image 
                    source={{ uri: cardData.icon }} 
                    style={styles.cardImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Icon 
                    name={card.type === 'credit_card' ? 'card-outline' : 'card-outline'} 
                    size={moderateScale(24)} 
                    color="#E65C00" 
                  />
                )}
              </View>
              <Text style={styles.cardName}>
                {card.type === 'credit_card' ? 'Credit Card' : 'Debit Card'}
              </Text>
              {selectedCardType === card.type && (
                <View style={styles.selectedIndicator}>
                  <Icon name="checkmark-circle" size={moderateScale(20)} color="#E65C00" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderCODSection = () => {
    const isCODActive = paymentMethods?.cod?.isActive;
    const codData = paymentMethods?.cod?.data;
    
    if (!isCODActive) {
      return (
        <View style={styles.codSectionContainer}>
          <Text style={styles.unavailableText}>Cash on Delivery is currently unavailable</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.codSectionContainer}>
        <Text style={styles.paymentMethodHeading}>Cash on Delivery</Text>
        <TouchableOpacity
          style={[
            styles.codSimpleCard,
            selectedPaymentType === 'cod' && styles.codSimpleCardSelected
          ]}
          onPress={() => onSelectPaymentMethod('cod')}
          activeOpacity={0.8}
        >
          <View style={styles.codSimpleContent}>
            <View style={styles.codSimpleIcon}>
              <Icon name="cash-outline" size={moderateScale(24)} color="#E65C00" />
            </View>
            <View style={styles.codSimpleTextContainer}>
              <Text style={styles.codSimpleTitle}>Pay on Delivery</Text>
            </View>
            {selectedPaymentType === 'cod' && (
              <View style={styles.codSimpleCheck}>
                <Icon name="checkmark-circle" size={moderateScale(24)} color="#E65C00" />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        
        <Animated.View 
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <TouchableOpacity onPress={handleClose}>
              <Icon name="close" size={moderateScale(24)} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* UPI Section */}
            {paymentMethods?.upi?.isActive && (
              <View>
                <Text style={styles.paymentMethodHeading}>UPI Apps</Text>
                <View style={styles.paymentSectionBody}>
                  {renderUPISection()}
                </View>
              </View>
            )}

            {/* Wallet Section */}
            {paymentMethods?.wallets?.isActive && paymentMethods?.wallets?.wallets?.length > 0 && (
              <View>
                <Text style={styles.paymentMethodHeading}>Wallet</Text>
                <View style={styles.paymentSectionBody}>
                  {renderWalletSection()}
                </View>
              </View>
            )}

            {/* Netbanking Section */}
            {paymentMethods?.netbanking?.isActive && paymentMethods?.netbanking?.data?.supported_banks?.length > 0 && (
              <View>
                <Text style={styles.paymentMethodHeading}>Net Banking</Text>
                <View style={styles.paymentSectionBody}>
                  {renderNetbankingSection()}
                </View>
              </View>
            )}

            {/* Cards Section */}
            {paymentMethods?.cards?.isActive && paymentMethods?.cards?.data?.supported?.length > 0 && (
              <View>
                <Text style={styles.paymentMethodHeading}>Cards</Text>
                <View style={styles.paymentSectionBody}>
                  {renderCardsSection()}
                </View>
              </View>
            )}

            {/* COD Section */}
            {paymentMethods?.cod?.isActive && (
              <View>
                {renderCODSection()}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    overflow: 'hidden',
    maxHeight: height * 0.85,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(4),
  },
  dragHandle: {
    width: scale(40),
    height: verticalScale(4),
    backgroundColor: '#e0e0e0',
    borderRadius: moderateScale(2),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: FONT.XXL,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalContent: {
    paddingHorizontal: scale(16),
    paddingBottom: verticalScale(16),
  },
  paymentMethodHeading: {
    fontSize: FONT.LG,
    fontWeight: '600',
    color: '#1a1a1a',
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(8),
    backgroundColor: '#fff',
  },
  paymentSectionBody: {
    paddingHorizontal: scale(5),
    paddingBottom: verticalScale(5),
  },
  paymentSectionContent: {
    paddingVertical: verticalScale(8),
  },
  sectionSubtitle: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#666',
    marginBottom: verticalScale(12),
  },
  upiSectionContainer: {
    paddingVertical: verticalScale(8),
  },
  loadingAppsContainer: {
    alignItems: 'center',
    paddingVertical: verticalScale(30),
  },
  loadingAppsText: {
    fontSize: FONT.BASE,
    color: '#666',
    marginTop: verticalScale(12),
  },
  upiAppsList: {
    gap: verticalScale(10),
  },
  upiAppCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(12),
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  upiAppCardSelected: {
    borderColor: '#E65C00',
    backgroundColor: '#fff8f0',
  },
  upiAppIconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  upiAppImage: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
  },
  upiAppInfo: {
    flex: 1,
  },
  upiAppName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  upiAppCategory: {
    fontSize: FONT.XS,
    color: '#999',
    marginTop: verticalScale(2),
  },
  upiAppVpaText: {
    fontSize: FONT.XS,
    color: '#E65C00',
    marginTop: verticalScale(2),
  },
  selectedIndicator: {
    marginLeft: scale(8),
  },
  deleteUpiButton: {
    marginLeft: scale(8),
    padding: scale(4),
  },
  addUpiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(12),
    marginTop: verticalScale(12),
    backgroundColor: '#fff8f0',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#E65C00',
    borderStyle: 'dashed',
  },
  addUpiButtonText: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#E65C00',
    marginLeft: scale(8),
  },
  expandedUpiContainer: {
    marginTop: verticalScale(12),
  },
  manualUpiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(12),
    borderWidth: 1,
    borderColor: '#E65C00',
  },
  manualUpiInput: {
    flex: 1,
    fontSize: FONT.SM,
    color: '#333',
    paddingVertical: verticalScale(10),
  },
  clearUpiInputButton: {
    padding: scale(4),
  },
  loadingIndicator: {
    marginLeft: scale(8),
  },
  validationSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(8),
    paddingHorizontal: scale(4),
  },
  validationSuccessText: {
    fontSize: FONT.XS,
    color: '#4CAF50',
    marginLeft: scale(6),
    flex: 1,
  },
  validationErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(8),
    paddingHorizontal: scale(4),
  },
  validationErrorText: {
    fontSize: FONT.XS,
    color: '#FF4444',
    marginLeft: scale(6),
    flex: 1,
  },
  expandedUpiActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: verticalScale(12),
    gap: scale(12),
  },
  cancelUpiButton: {
    flex: 1,
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  cancelUpiButtonText: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#666',
  },
  saveUpiButton: {
    flex: 1,
    backgroundColor: '#E65C00',
    paddingVertical: verticalScale(10),
    borderRadius: moderateScale(8),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveUpiButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveUpiButtonText: {
    fontSize: FONT.SM,
    fontWeight: '600',
    color: '#fff',
  },
  hintText: {
    fontSize: FONT.XS,
    color: '#999',
    marginTop: verticalScale(6),
    marginLeft: scale(4),
  },
  walletAppsList: {
    gap: verticalScale(10),
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(12),
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  walletCardSelected: {
    borderColor: '#E65C00',
    backgroundColor: '#fff8f0',
  },
  walletIconContainer: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  walletImage: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(2),
  },
  walletBalanceText: {
    fontSize: FONT.SM,
    color: '#E65C00',
    fontWeight: '500',
  },
  banksList: {
    gap: verticalScale(10),
  },
  bankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(12),
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  bankCardSelected: {
    borderColor: '#E65C00',
    backgroundColor: '#fff8f0',
  },
  bankIconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  bankImage: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
  },
  bankName: {
    flex: 1,
    fontSize: FONT.BASE,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  cardsList: {
    gap: verticalScale(10),
  },
  cardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(12),
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  cardCardSelected: {
    borderColor: '#E65C00',
    backgroundColor: '#fff8f0',
  },
  cardIconContainer: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12),
  },
  cardImage: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: moderateScale(14),
  },
  cardName: {
    flex: 1,
    fontSize: FONT.BASE,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  codSectionContainer: {
    paddingVertical: verticalScale(8),
  },
  codSimpleCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    marginTop: verticalScale(4),
    marginBottom: verticalScale(8),
  },
  codSimpleCardSelected: {
    borderColor: '#E65C00',
    backgroundColor: '#fff8f0',
  },
  codSimpleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(16),
  },
  codSimpleIcon: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: '#fff0e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(14),
  },
  codSimpleTextContainer: {
    flex: 1,
  },
  codSimpleTitle: {
    fontSize: FONT.BASE,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: verticalScale(2),
  },
  codSimpleDescription: {
    fontSize: FONT.SM,
    color: '#666',
  },
  codSimpleCheck: {
    marginLeft: scale(8),
  },
  unavailableText: {
    fontSize: FONT.BASE,
    color: '#999',
    textAlign: 'center',
    paddingVertical: verticalScale(20),
  },
  noAppsText: {
    fontSize: FONT.BASE,
    color: '#999',
    textAlign: 'center',
    paddingVertical: verticalScale(20),
  },
});