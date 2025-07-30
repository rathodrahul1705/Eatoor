import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const OrderDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { order } = route.params;

  // Mock data for the order details
  const orderDetails = {
    ...order,
    orderId: '#1234543',
    kitchenAddress: '123 Food Street, Kitchen Town, Bangalore - 560001',
    userDetails: {
      name: 'John Doe',
      phone: '+91 9876543210',
      deliveryAddress: '456 Customer Avenue, Home Town, Bangalore - 560002'
    },
    paymentDate: '15 July 2023, 12:45 PM',
    fssaiLicense: '5465467',
    billSummary: {
      itemTotal: '₹400',
      gst: '₹50',
      deliveryFee: '₹30',
      platformFee: '₹20',
      totalPaid: '₹500',
      amountSaved: '₹100'
    },
    items: [
      { name: 'Butter Chicken', type: 'non-veg', quantity: 2, price: '₹200' },
      { name: 'Dal Makhani', type: 'veg', quantity: 1, price: '₹100' },
      { name: 'Garlic Naan', type: 'veg', quantity: 4, price: '₹100' }
    ]
  };

  const handleReorder = (order) => {
    navigation.navigate('CartScreen', { 
      reorderedItems: order.items,
      kitchenName: order.kitchenName,
      kitchenImage: order.kitchenImage
    });
  };

  const VegNonVegIcon = ({ type }) => (
    <View style={[
      styles.vegNonVegIcon,
      type === 'veg' ? styles.vegIcon : styles.nonVegIcon
    ]}>
      <View style={[
        styles.vegNonVegInner,
        type === 'veg' ? styles.vegInner : styles.nonVegInner
      ]} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button and title */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {/* Kitchen Info Card */}
        <View style={styles.card}>
          <View style={styles.kitchenHeader}>
            <Image source={{ uri: orderDetails.kitchenImage }} style={styles.kitchenImage} />
            <View style={styles.kitchenInfo}>
              <Text style={styles.kitchenName}>{orderDetails.kitchenName}</Text>
              <Text style={styles.kitchenAddress}>{orderDetails.kitchenAddress}</Text>
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Icon name="call-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Summary Card */}
        <View style={styles.card}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderIdText}>Order ID: {orderDetails.orderId}</Text>
            <View style={[
              styles.statusBadge,
              orderDetails.status === 'Delivered' ? styles.deliveredBadge : styles.onthewayBadge
            ]}>
              <Text style={styles.statusText}>{orderDetails.status}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>{orderDetails.orderDate}</Text>
          
          {/* Items List */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items Ordered</Text>
            {orderDetails.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <VegNonVegIcon type={item.type} />
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                <Text style={styles.itemPrice}>{item.price}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bill Summary Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>{orderDetails.billSummary.itemTotal}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>GST</Text>
            <Text style={styles.billValue}>{orderDetails.billSummary.gst}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValue}>{orderDetails.billSummary.deliveryFee}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform Fee</Text>
            <Text style={styles.billValue}>{orderDetails.billSummary.platformFee}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={[styles.billLabel, styles.totalLabel]}>Total Paid</Text>
            <Text style={[styles.billValue, styles.totalValue]}>{orderDetails.billSummary.totalPaid}</Text>
          </View>
        </View>

        {/* Savings Card */}
        <View style={[styles.card, styles.savingsCard]}>
          <View style={styles.savingsContent}>
            <Icon name="pricetag-outline" size={20} color="#fff" />
            <View style={styles.savingsText}>
              <Text style={styles.savingsTitle}>You saved ₹{orderDetails.billSummary.amountSaved}</Text>
              <Text style={styles.savingsSubtitle}>Including discounts & offers</Text>
            </View>
          </View>
        </View>

        {/* Delivery Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.detailRow}>
            <Icon name="person-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{orderDetails.userDetails.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="call-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{orderDetails.userDetails.phone}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="time-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{orderDetails.paymentDate}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="location-outline" size={16} color="#666" style={styles.detailIcon} />
            <Text style={styles.detailText}>{orderDetails.userDetails.deliveryAddress}</Text>
          </View>
        </View>

        {/* FSSAI License */}
        <View style={styles.licenseContainer}>
          <Text style={styles.licenseText}>FSSAI License: {orderDetails.fssaiLicense}</Text>
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.invoiceButton}>
          <Text style={styles.invoiceButtonText}>Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.reorderButton}
          onPress={() => handleReorder(orderDetails)}
        >
          <Text style={styles.reorderButtonText}>Reorder</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kitchenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kitchenImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
  },
  kitchenInfo: {
    flex: 1,
  },
  kitchenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  kitchenAddress: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  callButton: {
    padding: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderIdContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  orderDate: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deliveredBadge: {
    backgroundColor: '#e3f9e5',
  },
  onthewayBadge: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Veg/Non-Veg Icons
  vegNonVegIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  vegIcon: {
    borderColor: 'green',
  },
  nonVegIcon: {
    borderColor: 'red',
  },
  vegNonVegInner: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  vegInner: {
    backgroundColor: 'green',
  },
  nonVegInner: {
    backgroundColor: 'red',
  },
  itemsSection: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    marginLeft: 8,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#888',
    marginHorizontal: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  billLabel: {
    fontSize: 14,
    color: '#666',
  },
  billValue: {
    fontSize: 14,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  totalRow: {
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontWeight: '700',
    color: '#FF6B35',
    fontSize: 15,
  },
  savingsCard: {
    backgroundColor: '#FF6B35',
  },
  savingsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsText: {
    marginLeft: 12,
  },
  savingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  savingsSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailIcon: {
    marginRight: 12,
    width: 16,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  licenseContainer: {
    padding: 12,
  },
  licenseText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  actionBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  invoiceButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  reorderButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  invoiceButtonText: {
    color: '#FF6B35',
    fontWeight: '600',
    fontSize: 14,
  },
  reorderButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default OrderDetailsScreen;