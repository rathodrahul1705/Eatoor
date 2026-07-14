// AdminDashboardScreen.js
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// ---------- Design Constants ----------
const { width, height } = Dimensions.get('window');
const screenWidth = width;
const screenHeight = height;

const scale = (size) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  return Math.round(size * Math.min(1.6, Math.max(0.8, scaleFactor)));
};

const verticalScale = (size) => {
  const baseHeight = 812;
  const scaleFactor = screenHeight / baseHeight;
  return Math.round(size * Math.min(1.4, Math.max(0.7, scaleFactor)));
};

const fontScale = (size) => {
  const baseWidth = 375;
  const scaleFactor = screenWidth / baseWidth;
  const scaledSize = size * Math.min(1.3, Math.max(0.85, scaleFactor));
  return Math.round(scaledSize);
};

const COLORS = {
  primary: '#E55C18',
  secondary: '#00B8A9',
  accent: '#6C5CE7',
  success: '#00B894',
  warning: '#FDCB6E',
  danger: '#FF7675',
  background: '#F4F6FA',
  card: '#FFFFFF',
  text: {
    primary: '#1A1D2E',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    light: '#FFFFFF',
    dark: '#0F172A',
  },
  border: {
    light: '#E5E7EB',
    default: '#D1D5DB',
  },
};

const TYPOGRAPHY = {
  h1: { fontSize: fontScale(28), lineHeight: fontScale(34), fontWeight: '700' },
  h2: { fontSize: fontScale(24), lineHeight: fontScale(30), fontWeight: '700' },
  h3: { fontSize: fontScale(20), lineHeight: fontScale(26), fontWeight: '600' },
  h4: { fontSize: fontScale(18), lineHeight: fontScale(24), fontWeight: '600' },
  body1: { fontSize: fontScale(16), lineHeight: fontScale(24), fontWeight: '400' },
  body2: { fontSize: fontScale(14), lineHeight: fontScale(20), fontWeight: '400' },
  caption: { fontSize: fontScale(12), lineHeight: fontScale(16), fontWeight: '400' },
  button: { fontSize: fontScale(15), lineHeight: fontScale(20), fontWeight: '600' },
};

// ---------- MAIN COMPONENT ----------
const AdminDashboardScreen = ({ navigation }) => {
  const handleBackPress = () => navigation.goBack();

  return (
    <SafeAreaView style={styles.adminDashboard_safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ==================== HEADER ==================== */}
      <View style={styles.adminDashboard_headerWrapper}>
        <View style={styles.adminDashboard_headerContainer}>
          <View style={styles.adminDashboard_headerTopRow}>
            <TouchableOpacity
              style={styles.adminDashboard_backButton}
              onPress={handleBackPress}
              activeOpacity={0.7}
            >
              <Icon name="arrow-back" size={scale(24)} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.adminDashboard_headerTitle}>Admin Dashboard</Text>
          </View>
        </View>
      </View>

      {/* ==================== MAIN CONTENT ==================== */}
      <View style={styles.adminDashboard_mainContent}>
        {/* ---------- QUICK ACTIONS ---------- */}
        <View style={styles.adminDashboard_statsContainer}>
          <View style={styles.adminDashboard_statsHeader}>
            <Text style={styles.adminDashboard_statsTitle}>Quick Actions</Text>
          </View>

          <View style={styles.adminDashboard_statsGrid}>
            {/* Partner Card */}
            <TouchableOpacity
              style={[styles.adminDashboard_statCard, { backgroundColor: '#FEF3C7' }]}
              onPress={() => navigation.navigate('PartnerScreen')}
              activeOpacity={0.7}
            >
              <Icon name="restaurant-outline" size={scale(24)} color="#D97706" />
              <Text style={styles.adminDashboard_statLabel}>Partner</Text>
            </TouchableOpacity>

            {/* Settlement Card */}
            <TouchableOpacity
              style={[styles.adminDashboard_statCard, { backgroundColor: '#D1FAE5' }]}
              onPress={() => navigation.navigate('SettlementDashboardScreen')}
              activeOpacity={0.7}
            >
              <Icon name="cash-outline" size={scale(24)} color="#059669" />
              <Text style={styles.adminDashboard_statLabel}>Settlement</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ---------- STYLES ----------
const styles = StyleSheet.create({
  // SafeArea
  adminDashboard_safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header (absolute)
  adminDashboard_headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? scale(50) : scale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.12,
    shadowRadius: scale(8),
    elevation: 6,
  },
  adminDashboard_headerContainer: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 0 : scale(42),
    paddingBottom: scale(12),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  adminDashboard_headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(10),
  },
  adminDashboard_backButton: {
    padding: scale(4),
    marginRight: scale(8),
  },
  adminDashboard_headerTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },

  // Main content
  adminDashboard_mainContent: {
    flex: 1,
    paddingTop: scale(110), // reduced from 130/120 to remove extra space
    paddingHorizontal: scale(16),
  },

  // Quick Actions container
  adminDashboard_statsContainer: {
    backgroundColor: '#fff',
    borderRadius: scale(20),
    padding: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(4) },
    shadowOpacity: 0.08,
    shadowRadius: scale(12),
    elevation: 4,
    marginTop: 0, // no extra top margin
  },
  adminDashboard_statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  adminDashboard_statsTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#111827',
  },
  adminDashboard_statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  adminDashboard_statCard: {
    width: '48%', // two columns
    borderRadius: scale(16),
    padding: scale(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: scale(12),
  },
  adminDashboard_statLabel: {
    fontSize: fontScale(12),
    color: '#6B7280',
    fontWeight: '600',
    marginTop: scale(2),
  },
});

export default AdminDashboardScreen;