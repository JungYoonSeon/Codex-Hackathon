import React from 'react';
import { Text as NativeText, StyleSheet } from 'react-native';

export default function AppText({ style, ...props }) {
  return <NativeText {...props} style={[styles.base, style]} />;
}

const styles = StyleSheet.create({ base: { color: '#162B70', fontFamily: 'Geologica' } });
