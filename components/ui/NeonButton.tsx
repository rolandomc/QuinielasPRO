/**
 * components/ui/NeonButton.tsx
 *
 * Botón primario con glow. Reemplaza el patrón:
 *   <NeonWrapper color={glow}>
 *     <TouchableOpacity style={[btnStyle, { backgroundColor }]}>
 *
 * Uso:
 *   <NeonButton onPress={fn} glow={C.accentGlow} label="Enviar" icon="send" />
 *   <NeonButton onPress={fn} loading />
 *   <NeonButton onPress={fn} disabled />
 */
import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  StyleSheet, ViewStyle, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import NeonWrapper from '../NeonWrapper';

interface NeonButtonProps {
  onPress: () => void;
  label: string;
  /** Nombre de icono Ionicons (opcional). */
  icon?: keyof typeof import('@expo/vector-icons/build/Ionicons').glyphMap;
  /** Color de fondo del botón. Default C.accent. */
  color?: string;
  /** Color del glow. Default C.accentGlow. */
  glow?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  radius?: number;
}

export default function NeonButton({
  onPress,
  label,
  icon,
  color,
  glow,
  loading = false,
  disabled = false,
  style,
  radius = 12,
}: NeonButtonProps) {
  const { colors: C } = useTheme();
  const bg        = color ?? C.accent;
  const glowColor = glow  ?? C.accentGlow;
  const inactive  = disabled || loading;

  return (
    <NeonWrapper
      color={inactive ? 'transparent' : glowColor}
      borderRadius={radius}
      shadowRadius={inactive ? 0 : 14}
      opacity={inactive ? 0 : 1}
      style={style}
    >
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: bg, borderRadius: radius }, inactive && styles.inactive]}
        onPress={onPress}
        disabled={inactive}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.row}>
            {icon && <Ionicons name={icon} size={16} color="#fff" />}
            <Text style={styles.label}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </NeonWrapper>
  );
}

const styles = StyleSheet.create({
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15 },
  inactive: { opacity: 0.5 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label:    { color: '#fff', fontWeight: '800', fontSize: 15 },
});
