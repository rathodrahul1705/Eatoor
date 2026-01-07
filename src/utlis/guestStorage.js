// utils/guestStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

class GuestStorage {
  constructor() {
    this.guestId = null;
  }

  async initialize() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        if (parsed.isGuest) {
          this.guestId = parsed.id;
        }
      }
    } catch (error) {
      console.error('Error initializing guest storage:', error);
    }
  }

  async saveCart(items) {
    if (!this.guestId) return;
    try {
      await AsyncStorage.setItem(`guest_cart_${this.guestId}`, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving guest cart:', error);
    }
  }

  async loadCart() {
    if (!this.guestId) return [];
    try {
      const cartData = await AsyncStorage.getItem(`guest_cart_${this.guestId}`);
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('Error loading guest cart:', error);
      return [];
    }
  }

  async saveOrder(order) {
    if (!this.guestId) return;
    try {
      const orders = await this.loadOrders();
      orders.push({ ...order, guestId: this.guestId });
      await AsyncStorage.setItem(`guest_orders_${this.guestId}`, JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving guest order:', error);
    }
  }

  async loadOrders() {
    if (!this.guestId) return [];
    try {
      const ordersData = await AsyncStorage.getItem(`guest_orders_${this.guestId}`);
      return ordersData ? JSON.parse(ordersData) : [];
    } catch (error) {
      console.error('Error loading guest orders:', error);
      return [];
    }
  }

  async clearGuestData() {
    if (!this.guestId) return;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const guestKeys = keys.filter(key => key.includes(this.guestId));
      await AsyncStorage.multiRemove(guestKeys);
    } catch (error) {
      console.error('Error clearing guest data:', error);
    }
  }
}

export default new GuestStorage();