import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function PagoErrorScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>😕</Text>
      <Text style={styles.titulo}>Pago no completado</Text>
      <Text style={styles.subtitulo}>
        El pago fue cancelado o no se pudo procesar. Puedes intentarlo de nuevo.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>Posibles causas:</Text>
        <Text style={styles.item}>• Cancelaste el proceso de pago</Text>
        <Text style={styles.item}>• Fondos insuficientes en tu cuenta</Text>
        <Text style={styles.item}>• Problema temporal con el banco</Text>
      </View>

      <TouchableOpacity
        style={styles.btnReintentar}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.btnTexto}>🔄 Intentar de nuevo</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSalir}
        onPress={() => router.replace('/(tabs)/perfil')}
      >
        <Text style={styles.btnSalirTexto}>Ir a mi perfil</Text>
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
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#1a1a2e', marginTop: 15 },
  subtitulo: { fontSize: 15, color: '#555', textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginTop: 25,
    elevation: 3,
  },
  cardTitulo: { fontWeight: 'bold', fontSize: 15, marginBottom: 10, color: '#1a1a2e' },
  item: { fontSize: 14, color: '#666', marginBottom: 6 },
  btnReintentar: {
    backgroundColor: '#009ee3',
    width: '100%',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 25,
  },
  btnSalir: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#ccc',
  },
  btnTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSalirTexto: { color: '#666', fontWeight: '600', fontSize: 15 },
});
