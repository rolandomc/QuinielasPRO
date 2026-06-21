import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function PagoExitoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎉</Text>
      <Text style={styles.titulo}>¡Pago exitoso!</Text>
      <Text style={styles.subtitulo}>
        Tu participación en la quiniela ha sido confirmada.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>¿Qué sigue?</Text>
        <Text style={styles.paso}>1️⃣  Ve a la pestaña "Mi Quiniela"</Text>
        <Text style={styles.paso}>2️⃣  Selecciona tus pronósticos</Text>
        <Text style={styles.paso}>3️⃣  Guarda antes de que cierren los partidos</Text>
        <Text style={styles.paso}>4️⃣  Revisa los resultados en "Resultados"</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace('/(tabs)/quiniela')}
      >
        <Text style={styles.btnTexto}>⚽ Ir a mis pronósticos</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },
  icon: { fontSize: 80 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#1a1a2e', marginTop: 15 },
  subtitulo: { fontSize: 15, color: '#555', textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginTop: 25,
    elevation: 3,
  },
  cardTitulo: { fontWeight: 'bold', fontSize: 16, marginBottom: 12, color: '#1a1a2e' },
  paso: { fontSize: 14, color: '#444', marginBottom: 8 },
  btn: {
    backgroundColor: '#009ee3',
    width: '100%',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 25,
  },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
