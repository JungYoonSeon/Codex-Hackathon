import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function BrandLogo({ size = 'home' }) {
  return <Image source={require('../../assets/roomready-logo.png')} resizeMode="contain" style={size === 'splash' ? styles.splash : styles.home} accessibilityLabel="RoomReady" />;
}

const styles = StyleSheet.create({ home: { width: 105, height: 44 }, splash: { width: 192, height: 79 } });
