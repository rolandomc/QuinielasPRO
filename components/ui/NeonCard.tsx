/**
 * components/ui/NeonCard.tsx
 *
 * Card con efecto neón reutilizable. Reemplaza el patrón:
 *   <NeonWrapper ...><View style={[cardStyle, { backgroundColor, borderColor }]}>
 *
 * Uso:
 *   <NeonCard glow={C.accentGlow} style={{ marginBottom: 12 }}>
 *     {children}
 *   </NeonCard>
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import NeonWrapper from '../NeonWrapper';

interface NeonCardProps {
  children: React.ReactNode;
  /** Color del glow. Si se omite usa accentGlow del tema. */
  glow?: string;
  /** Intensidad del glow (0-1). Default 1. */
  glowOpacity?: number;
  /** Radio del shadow. Default 14. */
  glowRadius?: number;
  /** Estilos adicionales para el wrapper exterior. */
  style?: ViewStyle;
  /** Estilos adicionales para el View interior (la card). */
  cardStyle?: ViewStyle;
  /** Border color. Default C.cardBorder. */
  borderColor?: string;
  /** Border radius. Default 16. */
  radius?: number;
  /** Si true, desactiva el glow (útil para estados disabled). */
  noGlow?: boolean;
}

export default function NeonCard({
  children,
  glow,
  glowOpacity = 1,
  glowRadius = 14,
  style,
  cardStyle,
  borderColor,
  radius = 16,
  noGlow = false,
}: NeonCardProps) {
  const { colors: C } = useTheme();
  const glowColor = noGlow ? 'transparent' : (glow ?? C.accentGlow);

  return (
    <NeonWrapper
      color={glowColor}
      borderRadius={radius}
      shadowRadius={noGlow ? 0 : glowRadius}
      opacity={noGlow ? 0 : glowOpacity}
      style={style}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: C.card,
            borderColor: borderColor ?? C.cardBorder,
            borderRadius: radius,
          },
          cardStyle,
        ]}
      >
        {children}
      </View>
    </NeonWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 16,
  },
});
