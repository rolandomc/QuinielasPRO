import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// TODO: obtener datos reales del usuario desde Supabase / contexto de auth
const USUARIO_EJEMPLO = {
  nombre: 'Jugador',
  telefono: '+52 667 000 0000',
  estadoPago: 'pagado', // 'pendiente' | 'pagado'
  aciertosTotal: 12,
  quinielasJugadas: 4,
};

export default function PerfilScreen() {
  const router = useRouter();

  const cerrarSesion = () => {
    // TODO: limpiar sesión de Supabase Auth
    router.replace('/');
  };

  const isPagado = USUARIO_EJEMPLO.estadoPago === 'pagado';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={50} color="#fff" />
        </View>
        <Text style={styles.nombre}>{USUARIO_EJEMPLO.nombre}</Text>
        <Text style={styles.telefono}>{USUARIO_EJEMPLO.telefono}</Text>
        <View style={[styles.badge, isPagado ? styles.badgePagado : styles.badgePendiente]}>
          <Text style={styles.badgeTexto}>
            {isPagado ? '✅ Pago confirmado' : '⏳ Pago pendiente'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{USUARIO_EJEMPLO.aciertosTotal}</Text>
          <Text style={styles.statLabel}>Aciertos totales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{USUARIO_EJEMPLO.quinielasJugadas}</Text>
          <Text style={styles.statLabel}>Quinielas jugadas</Text>
        </View>
      </View>

      {!isPagado && (
        <TouchableOpacity
          style={styles.btnPagar}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.btnPagarTexto}>💳 Completar pago — $100.00</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btnCerrar} onPress={cerrarSesion}>
        <Ionicons name="log-out-outline" size={20} color="#e53935" />
        <Text style={styles.btnCerrarTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  avatarSection: {
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    padding: 30,
    paddingBottom: 35,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#009ee3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  nombre: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  telefono: { color: '#aaa', fontSize: 14, marginTop: 4 },
  badge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  badgePagado: { backgroundColor: '#1b5e20' },
  badgePendiente: { backgroundColor: '#e65100' },
  badgeTexto: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statsRow: { flexDirection: 'row', margin: 15, gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    elevation: 2,
  },
  statNum: { fontSize: 32, fontWeight: 'bold', color: '#009ee3' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  btnPagar: {
    backgroundColor: '#009ee3',
    margin: 15,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPagarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnCerrar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e53935',
    backgroundColor: '#fff',
  },
  btnCerrarTexto: { color: '#e53935', fontWeight: 'bold', fontSize: 15 },
});
