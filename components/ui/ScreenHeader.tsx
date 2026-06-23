/**
 * components/ui/ScreenHeader.tsx
 *
 * Header estándar de pantalla con título y padding seguro.
 * Reemplaza el patrón View + paddingTop: insets.top + Text repetido en cada pantalla.
 *
 * Uso:
 *   <ScreenHeader title="⚽ Mi Quiniela" />
 *   <ScreenHeader title="💰 Mi Billetera">
 *     <Chips ... />
 *   </ScreenHeader>
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export default function ScreenHeader({ title, children, style }: ScreenHeaderProps) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16 }, style]}>
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 16, paddingHorizontal: 20 },
  title:  { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
});
