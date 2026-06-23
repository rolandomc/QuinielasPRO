/**
 * components/ui/LoadingScreen.tsx
 *
 * Pantalla de carga centrada reutilizable.
 * Reemplaza el patrón View + ActivityIndicator repetido en cada pantalla.
 *
 * Uso:
 *   if (loading) return <LoadingScreen />;
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function LoadingScreen() {
  const { colors: C } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: C.bg }]}>
      <ActivityIndicator color={C.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
