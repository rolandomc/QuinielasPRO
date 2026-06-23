/**
 * components/ui/EmptyState.tsx
 *
 * Estado vacío reutilizable. Reemplaza bloques View + emoji + Text repetidos.
 *
 * Uso:
 *   <EmptyState emoji="📭" title="Sin movimientos" hint="Aquí aparecerán..." />
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface EmptyStateProps {
  emoji: string;
  title: string;
  hint?: string;
}

export default function EmptyState({ emoji, title, hint }: EmptyStateProps) {
  const { colors: C } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.title, { color: C.textSub }]}>{title}</Text>
      {hint && <Text style={[styles.hint, { color: C.textSub }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { alignItems: 'center', padding: 48 },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700' },
  hint:  { fontSize: 12, marginTop: 4, textAlign: 'center' },
});
