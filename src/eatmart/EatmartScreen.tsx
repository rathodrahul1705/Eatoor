import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeTabParamList } from '../types/navigation.d';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient'; // Import LinearGradient

type EatmartScreenProps = NativeStackScreenProps<HomeTabParamList, 'Eatmart'>;

const EatmartScreen: React.FC<EatmartScreenProps> = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Card with Gradient Background */}
        <LinearGradient 
          colors={['#E65C00', '#DD2476']} 
          start={{x: 0, y: 0}} 
          end={{x: 1, y: 0}}
        >
          <View style={styles.progressCard}>

            <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Development Progress</Text>
            <Text style={styles.progressPercent}>35%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '35%' }]} />
          </View>
          <Text style={styles.progressText}>We're building a seamless grocery shopping experience</Text>
          </View>
          
        </LinearGradient>
        
        <View style={styles.content}>
          <View style={styles.featureCard}>
            <View style={styles.iconContainer}>
              <Icon name="basket-outline" size={80} color="#FF6B00" />
              <View style={styles.badge}>
                <Icon name="time-outline" size={20} color="#fff" />
              </View>
            </View>
            
            <Text style={styles.featureTitle}>Groceries at Your Doorstep</Text>
            <Text style={styles.featureDescription}>
              Get fresh produce, pantry staples, and household essentials delivered in minutes.
              No more heavy bags or crowded stores - we'll bring everything you need.
            </Text>
          </View>

          <View style={styles.notifyCard}>
            <Text style={styles.notifyTitle}>Be the First to Know</Text>
            <Text style={styles.notifySubtitle}>Get early access when we launch in your area</Text>
            
            <View style={styles.inputContainer}>
              <Icon name="location-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="Your location"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Icon name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="Your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
              />
            </View>
            
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.buttonText}>Get Early Access</Text>
              <Icon name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
});

export default EatmartScreen;