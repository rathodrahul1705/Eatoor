import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width, height } = Dimensions.get('window');

type RootStackParamList = {
  TrackOrder: { order: { order_number: string; prev_location?: string } };
  // Add other screens here
};

interface PaymentModalProps {
  visible: boolean;
  status: 'idle' | 'processing' | 'success' | 'failed' | 'pending';
  amount: number;
  transactionId?: string | null;
  errorMessage?: string;
  pollingAttempts?: number;
  maxPollingAttempts?: number;
  onRetry?: () => void;
  onCancel?: () => void;
  onDismiss?: () => void;
  onViewOrder?: (orderNumber: string) => void;
  orderNumber?: string;
  orderId?: number | null;
  orderTotal?: string;
  paymentPage?: string; // Add payment page prop
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  status,
  amount,
  transactionId,
  errorMessage,
  pollingAttempts = 0,
  maxPollingAttempts = 2,
  onRetry,
  onCancel,
  onDismiss,
  onViewOrder,
  orderNumber,
  orderId,
  orderTotal,
  paymentPage = '', // Default to empty string
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const hasNavigated = useRef(false);
  const autoDismissTimer = useRef<NodeJS.Timeout | null>(null);

  // Check if this is eatoor_money payment page
  const isEatoorMoneyPayment = paymentPage === 'eatoor_money';

  // Auto-dismiss success modal and navigate/close after 3 seconds
  useEffect(() => {
    if (status === 'success' && !hasNavigated.current) {
      hasNavigated.current = true;
      
      // Show success screen for 3 seconds before auto-dismiss
      autoDismissTimer.current = setTimeout(() => {
        // Close modal
        if (onDismiss) {
          onDismiss();
        }
        
        // For eatoor_money, just close the modal and let the parent handle navigation
        // For other pages, navigate to TrackOrder
        if (!isEatoorMoneyPayment && orderNumber) {
          setTimeout(() => {
            try {
              navigation.navigate('TrackOrder', {
                order: { 
                  order_number: orderNumber, 
                  prev_location: "HomeTabs" 
                }
              });
            } catch (error) {
              console.error('Navigation error:', error);
              if (onViewOrder) {
                onViewOrder(orderNumber);
              }
            }
          }, 300);
        }
      }, 3000); // 3 seconds delay
    }
    
    // Cleanup timer when modal becomes invisible or status changes
    if (!visible || status !== 'success') {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current);
        autoDismissTimer.current = null;
      }
      const resetTimer = setTimeout(() => {
        hasNavigated.current = false;
      }, 500);
      return () => clearTimeout(resetTimer);
    }
  }, [status, orderNumber, navigation, onDismiss, visible, onViewOrder, isEatoorMoneyPayment]);

  const handleClose = () => {
    // Clear auto-dismiss timer if user clicks manually
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
    
    if (onDismiss) {
      onDismiss();
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <View style={styles.contentContainer}>
            <ActivityIndicator size="large" color="#E55C18" />
            <Text style={styles.title}>Processing payment...</Text>
            <Text style={styles.message}>Please wait while we process your payment</Text>
          </View>
        );

      case 'pending':
        return (
          <View style={styles.contentContainer}>
            <ActivityIndicator size="large" color="#E55C18" />
            <Text style={styles.title}>Awaiting confirmation</Text>
            <Text style={styles.message}>Please complete payment in your UPI app</Text>
            <Text style={styles.waitingMessage}>Waiting for payment confirmation...</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );

      case 'success':
        return (
          <View style={styles.contentContainer}>
            <View style={styles.successIconContainer}>
              <Icon name="checkmark-circle" size={80} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Payment Successful!</Text>
            <Text style={styles.message}>
              {isEatoorMoneyPayment 
                ? `₹${amount.toFixed(2)} has been added to your wallet` 
                : 'Your order has been placed successfully'}
            </Text>
            
            {isEatoorMoneyPayment ? (
              // Show wallet balance updated message for eatoor_money
              <View style={styles.walletDetailsContainer}>
                <Icon name="wallet-outline" size={24} color="#4CAF50" />
                <Text style={styles.walletUpdateText}>
                  Wallet balance updated successfully
                </Text>
              </View>
            ) : (
              // Show order details for other payment pages
              <View style={styles.orderDetailsContainer}>
                <Text style={styles.orderDetailsText}>
                  Order ID: {orderNumber || 'Processing...'}
                </Text>
                {orderTotal && (
                  <Text style={styles.orderAmountText}>
                    Amount Paid: ₹{parseFloat(orderTotal).toFixed(2)}
                  </Text>
                )}
              </View>
            )}
            
            <Text style={styles.autoRedirectText}>
              {isEatoorMoneyPayment 
                ? 'Redirecting back...' 
                : 'Redirecting to order tracking in a moment...'}
            </Text>

            {!isEatoorMoneyPayment && (
              <TouchableOpacity
                style={styles.viewOrderButton}
                onPress={handleClose}
              >
                <Text style={styles.viewOrderButtonText}>Track Your Order Now</Text>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" style={styles.buttonIcon} />
              </TouchableOpacity>
            )}

            {isEatoorMoneyPayment && (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleClose}
              >
                <Text style={styles.dismissButtonText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case 'failed':
        return (
          <View style={styles.contentContainer}>
            <Icon name="close-circle" size={72} color="#E55C18" />
            <Text style={styles.failedTitle}>Payment Failed</Text>
            <Text style={styles.message}>
              {errorMessage || 'Something went wrong. Please try again.'}
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButtonOutline} onPress={onCancel}>
                <Text style={styles.cancelButtonOutlineText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (status !== 'processing' && status !== 'pending') {
          onDismiss?.();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {(status === 'failed' || status === 'pending') && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onDismiss}
            >
              <Icon name="close" size={24} color="#999" />
            </TouchableOpacity>
          )}
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.85,
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  contentContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: 16,
    marginBottom: 8,
  },
  failedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E55C18',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  waitingMessage: {
    fontSize: 13,
    color: '#E55C18',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
    fontStyle: 'italic',
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginTop: 8,
    marginBottom: 20,
  },
  pollingStatus: {
    fontSize: 12,
    color: '#E55C18',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#E55C18',
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonOutline: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonOutlineText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  viewOrderButton: {
    backgroundColor: '#E55C18',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  viewOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  successIconContainer: {
    marginBottom: 8,
  },
  orderDetailsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  orderDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  orderAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E55C18',
  },
  autoRedirectText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  walletDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
    justifyContent: 'center',
    gap: 8,
  },
  walletUpdateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
  },
  dismissButton: {
    backgroundColor: '#E55C18',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
  },
  dismissButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});