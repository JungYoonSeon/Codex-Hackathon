import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import BrandLogo from '../components/BrandLogo';

export default function SplashScreen() {
  return <SafeAreaView style={styles.screen}><StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" /><BrandLogo size="splash" /></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' } });
