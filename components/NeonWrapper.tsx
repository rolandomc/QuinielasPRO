import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface NeonWrapperProps {
  children: React.ReactNode;
  color: string;
  borderRadius?: number;
  shadowRadius?: number;
  opacity?: number;
  style?: ViewStyle;
}

export default function NeonWrapper({
  children,
  color,
  borderRadius = 16,
  shadowRadius = 10,
  opacity = 0.6,
  style,
}: NeonWrapperProps) {
  return (
    <View style={[styles.wrapper, style]}>
      {/* Capa Fantasma Neón (emite la luz) */}
      <View
        style={[
          styles.glowBackdrop,
          {
            backgroundColor: '#0a0d14',
            borderRadius,
            shadowColor: color,
            shadowRadius,
            shadowOpacity: opacity,
            elevation: shadowRadius,
          },
        ]}
      />
      {/* Contenido real */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  glowBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    shadowOffset: { width: 0, height: 0 },
  },
});
