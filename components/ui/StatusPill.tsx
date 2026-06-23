/**
 * components/ui/StatusPill.tsx
 *
 * Pastilla de estado (aprobado / rechazado / pendiente).
 * Reemplaza el patrón View + borderColor + Text repetido en retiros y admin.
 *
 * Uso:
 *   <StatusPill label="Aprobado" color={C.green} />
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusPillProps {
  label: string;
  color: string;
}

export default function StatusPill({ label, color }: StatusPillProps) {
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: color + '18' }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
