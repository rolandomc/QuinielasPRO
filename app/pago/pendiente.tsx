import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { NeonWrapper } from '../../components/ui';

export default function PagoPendiente() {
  const router = useRouter();
  const { colors: C } = useTheme();

  // Animación de pulso para el ícono
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Redirigir a quiniela tras 5 segundos
  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)/quiniela'), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <NeonWrapper color={C.orangeGlow} borderRadius={80} shadowRadius={30} opacity={1}>
        <Animated.View style={[
          styles.iconCircle,
          { backgroundColor: C.orangeDim, borderColor: C.orange },
          { transform: [{ scale: pulse }] },
        ]}>
          <Ionicons name="time-outline" size={56} color={C.orange} />
        </Animated.View>
      </NeonWrapper>

      <Text style={[styles.titulo, { color: C.text }]}>Pago en proceso</Text>
      <Text style={[styles.subtitulo, { color: C.textSub }]}>
        Tu pago está siendo verificado por MercadoPago.
        {`\n\n`}Esto puede tardar unos minutos. Te notificaremos cuando se confirme.
      </Text>

      <View style={[styles.infoBox, { backgroundColor: C.orangeDim, borderColor: C.orange }]}>
        <Ionicons name="information-circle-outline" size={16} color={C.orange} />
        <Text style={[styles.infoText, { color: C.orange }]}>
          Serás redirigido a tu quiniela en unos segundos…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titulo: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitulo: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
});
