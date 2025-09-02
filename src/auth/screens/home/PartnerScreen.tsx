import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';

const PartnerScreen = () => {
  const isComingSoon = true;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B00" />
      {isComingSoon ? (
        <ScrollView contentContainerStyle={styles.contentContainer}>
        <LinearGradient 
          colors={['#E65C00', '#DD2476']} 
          start={{x: 0, y: 0}} 
          end={{x: 1, y: 0}}
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
          <View style={styles.content}>

            <View style={styles.featureCard}>
              <View style={styles.iconContainer}>
                <Icon name="business-outline" size={80} color="#FF6B00" />
                <View style={styles.badge}>
                  <Icon name="time-outline" size={20} color="#fff" />
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
  },
  header: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#FF6B00',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 24,
  },
  content: {
    padding: 16,
    paddingTop: 24,
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
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
    color: '#fff', // Changed to white for better contrast on gradient
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff', // Changed to white for better contrast on gradient
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Lighter background for contrast
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#fff', // White progress fill for contrast
  },
  progressText: {
    fontSize: 14,
    color: '#fff', // Changed to white for better contrast on gradient
    lineHeight: 20,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  notifyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  notifyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  notifySubtitle: {
    fontSize: 15,
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