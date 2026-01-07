// src/screens/NotificationSettingsScreen.tsx
// Notification settings screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {
  getNotificationPreferences,
  saveNotificationPreferences,
  showTestNotification,
  checkNotificationSettings,
  clearAllNotifications,
  getNotificationHistory,
  clearNotificationHistory,
  openNotificationSettings,
  isAndroid13Plus,
  isIOS,
  NOTIFICATION_TYPES,
  DEFAULT_PREFERENCES,
} from '../../notification';

const NotificationSettingsScreen: React.FC = () => {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [settings, setSettings] = useState({
    hasPermission: false,
    badgeCount: 0,
    token: null as string | null,
  });
  const [historyCount, setHistoryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prefs, settingsData, history] = await Promise.all([
        getNotificationPreferences(),
        checkNotificationSettings(),
        getNotificationHistory(),
      ]);
      
      setPreferences(prefs);
      setSettings(settingsData);
      setHistoryCount(history.length);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = async (key: keyof typeof DEFAULT_PREFERENCES) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };
    
    setPreferences(newPreferences);
    await saveNotificationPreferences(newPreferences);
  };

  const handleTestNotification = async () => {
    const success = await showTestNotification();
    
    if (success) {
      Alert.alert('Success', 'Test notification sent!');
    } else {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
            Alert.alert('Success', 'All notifications cleared');
            await loadData();
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear notification history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearNotificationHistory();
            setHistoryCount(0);
            Alert.alert('Success', 'Notification history cleared');
          },
        },
      ]
    );
  };

  const handleOpenSettings = async () => {
    await openNotificationSettings();
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    description: string,
    key: keyof typeof DEFAULT_PREFERENCES
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Icon name={icon} size={24} color="#666" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={preferences[key]}
        onValueChange={() => togglePreference(key)}
        trackColor={{ false: '#ddd', true: '#4CAF50' }}
        thumbColor="#fff"
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notification Settings</Text>
          <Text style={styles.headerSubtitle}>
            Manage how you receive notifications
          </Text>
        </View>

        {/* Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon
              name={settings.hasPermission ? 'check-circle' : 'error'}
              size={24}
              color={settings.hasPermission ? '#4CAF50' : '#FF6B6B'}
            />
            <Text style={styles.statusTitle}>
              {settings.hasPermission ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <Text style={styles.statusText}>
            {settings.hasPermission
              ? 'Notifications are enabled for this app'
              : 'Notifications are disabled'}
          </Text>
          {settings.token && (
            <Text style={styles.tokenText} numberOfLines={1}>
              Token: {settings.token.substring(0, 30)}...
            </Text>
          )}
        </View>

        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          {renderSettingItem(
            'notifications',
            'General Notifications',
            'Important updates and announcements',
            'general'
          )}
          {renderSettingItem(
            'restaurant',
            'Order Updates',
            'Updates about your food orders',
            'orders'
          )}
          {renderSettingItem(
            'local-offer',
            'Promotions & Offers',
            'Special deals and discounts',
            'promotions'
          )}
          {renderSettingItem(
            'warning',
            'Alerts',
            'Time-sensitive alerts',
            'alerts'
          )}
          {renderSettingItem(
            'chat',
            'Chat Messages',
            'New messages and chats',
            'chat'
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {renderSettingItem(
            'volume-up',
            'Sound',
            'Play sound for notifications',
            'sound'
          )}
          {renderSettingItem(
            'vibration',
            'Vibration',
            'Vibrate for notifications',
            'vibration'
          )}
          {Platform.OS === 'android' && renderSettingItem(
            'flash-on',
            'LED Light',
            'Flash LED for notifications',
            'led'
          )}
          {isIOS() && renderSettingItem(
            'notifications',
            'Badge',
            'Show badge count on app icon',
            'badge'
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleTestNotification}>
            <Icon name="notifications" size={22} color="#4CAF50" />
            <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>
              Send Test Notification
            </Text>
            <Icon name="chevron-right" size={22} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleClearAll}>
            <Icon name="clear-all" size={22} color="#FF6B6B" />
            <Text style={[styles.actionButtonText, { color: '#FF6B6B' }]}>
              Clear All Notifications
            </Text>
            <Icon name="chevron-right" size={22} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleClearHistory}>
            <Icon name="history" size={22} color="#FF9800" />
            <View style={styles.actionButtonContent}>
              <Text style={[styles.actionButtonText, { color: '#FF9800' }]}>
                Clear Notification History
              </Text>
              <Text style={styles.historyCount}>{historyCount} items</Text>
            </View>
            <Icon name="chevron-right" size={22} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleOpenSettings}>
            <Icon name="settings" size={22} color="#2196F3" />
            <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
              Open System Settings
            </Text>
            <Icon name="chevron-right" size={22} color="#999" />
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Icon name="info" size={20} color="#2196F3" />
          <Text style={styles.infoText}>
            Some settings might require app restart. Manage system-level settings in device settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  statusCard: { margin: 16, padding: 16, backgroundColor: '#fff', borderRadius: 12, elevation: 3 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusTitle: { fontSize: 18, fontWeight: '600', marginLeft: 8, color: '#333' },
  statusText: { fontSize: 14, color: '#666', lineHeight: 20 },
  tokenText: { fontSize: 12, color: '#999', marginTop: 8, backgroundColor: '#f8f8f8', padding: 8, borderRadius: 6 },
  section: { margin: 16, marginTop: 8, backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 16 },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  settingIcon: { width: 40, alignItems: 'center' },
  settingContent: { flex: 1, marginLeft: 12, marginRight: 16 },
  settingTitle: { fontSize: 16, color: '#333', marginBottom: 2 },
  settingDescription: { fontSize: 14, color: '#666' },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  actionButtonContent: { flex: 1, marginLeft: 12, marginRight: 16 },
  actionButtonText: { fontSize: 16, fontWeight: '500' },
  historyCount: { fontSize: 14, color: '#999', marginTop: 2 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', margin: 16, marginTop: 8, padding: 16, backgroundColor: '#E3F2FD', borderRadius: 12 },
  infoText: { flex: 1, fontSize: 14, color: '#1565C0', marginLeft: 12, lineHeight: 20 },
});

export default NotificationSettingsScreen;