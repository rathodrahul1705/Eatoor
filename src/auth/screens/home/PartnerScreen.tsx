import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, TextInput, Platform, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

const PartnerScreen = () => {
  const isComingSoon = true;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B00" />
      {isComingSoon ? (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Progress Card with Gradient Background - Shadow Removed */}
          <View style={styles.progressCardContainer}>
            <LinearGradient 
              colors={['#E65C00', '#DD2476']} 
              start={{x: 0, y: 0}} 
              end={{x: 1, y: 0}}
              style={styles.gradient}
            >
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressTitle}>Launch Progress</Text>
                  <Text style={styles.progressPercent}>42%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: '42%' }]} />
                </View>
                <Text style={styles.progressText}>We're building powerful tools for food businesses</Text>
              </View>
            </LinearGradient>
          </View>
          
          <View style={styles.content}>
            <View style={styles.featureCard}>
              <View style={styles.iconContainer}>
                <Icon name="business-outline" size={width * 0.2} color="#FF6B00" />
                <View style={styles.badge}>
                  <Icon name="time-outline" size={width * 0.05} color="#fff" />
                </View>
              </View>
              
              <Text style={styles.featureTitle}>For Restaurants & Kitchens</Text>
              <Text style={styles.featureDescription}>
                Increase your reach, get more orders, and manage everything in one place.
                Join our partner network and grow your business with EATOOR.
              </Text>
            </View>

            <View style={styles.notifyCard}>
              <Text style={styles.notifyTitle}>Get Early Access</Text>
              <Text style={styles.notifySubtitle}>Be the first to know when we launch</Text>
              
              <View style={styles.inputContainer}>
                <Icon name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Your business email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                />
              </View>
              
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.buttonText}>Join Waitlist</Text>
                <Icon name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.liveContainer}>
          {/* Live content would go here */}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  progressCardContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    // Shadow properties removed
  },
  gradient: {
    borderRadius: 16,
  },
  progressCard: {
    padding: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  progressText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  content: {
    padding: 16,
    paddingTop: 24,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    // Platform-specific shadows
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    backgroundColor: '#FF6B00',
    borderRadius: 16,
    padding: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  featureTitle: {
    fontSize: width > 400 ? 22 : 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: width > 400 ? 15 : 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  notifyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom:40,
    // Platform-specific shadows
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  notifyTitle: {
    fontSize: width > 400 ? 20 : 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  notifySubtitle: {
    fontSize: width > 400 ? 15 : 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#333',
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  liveContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default PartnerScreen;