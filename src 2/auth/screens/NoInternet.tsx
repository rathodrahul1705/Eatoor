import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

export default function NoInternetScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <View style={styles.wifiIcon}>
          <View style={styles.wifiArc1} />
          <View style={styles.wifiArc2} />
          <View style={styles.wifiArc3} />
          <View style={styles.wifiDot} />
        </View>
      </View>
      
      <Text style={styles.title}>No Internet Connection</Text>
      <Text style={styles.subtitle}>
        It looks like you're offline. Please check your network settings and try again.
      </Text>

      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
      
      <Text style={styles.tip}>
        Tip: Check your Wi-Fi or mobile data connection
      </Text>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 30,
    backgroundColor: '#FFFFFF'
  },
  iconContainer: {
    marginBottom: 30,
  },
  wifiIcon: {
    width: 80,
    height: 80,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wifiArc1: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FF6B35',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  wifiArc2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FF6B35',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  wifiArc3: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FF6B35',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
  wifiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 12,
    color: '#000000',
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666666', 
    marginBottom: 40, 
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: width * 0.8
  },
  button: {
    backgroundColor: '#FF6B35',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 12,
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 30,
  },
  buttonText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '600',
    textAlign: 'center'
  },
  tip: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});