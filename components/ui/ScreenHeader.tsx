/**
 * components/ui/ScreenHeader.tsx
 *
 * Header estándar con título, línea de acento neón y área segura.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import NeonWrapper from '../NeonWrapper';

interface ScreenHeaderProps {
  title: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export default function ScreenHeader({ title, children, style }: ScreenHeaderProps) {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: C.bg }, style]}>
      <Text style={[styles.title, { color: C.text }]}>{title}</Text>
      {/* Línea de acento neón bajo el título */}
      <NeonWrapper
        color={C.accentGlow}
        borderRadius={2}
        shadowRadius={6}
        opacity={0.85}
        style={styles.lineWrap}
      >
        <View style={[styles.accentLine, { backgroundColor: C.accent }]} />
      </NeonWrapper>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header:     { paddingBottom: 16, paddingHorizontal: 20 },
  title:      { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  lineWrap:   { alignSelf: 'flex-start' },
  accentLine: { height: 3, width: 48, borderRadius: 2 },
});
