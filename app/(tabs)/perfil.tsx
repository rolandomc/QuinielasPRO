import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Quiniela = {
  jornada: number;
  estado_pago: string;
  aciertos: number;
  creado_en: string;
};

export default function PerfilScreen() {
  const { user, usuario, signOut } = useAuth();
  const router = useRouter();
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuinielas = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('quinielas')
        .select('jornada, estado_pago, aciertos, creado_en')
        .eq('usuario_id', user.id)
        .order('creado_en', { ascending: false });
      if (data) setQuinielas(data);
      setLoading(false);
    };
    fetchQuinielas();
  }, [user]);

  const cerrarSesion = async () => {
    await signOut();
    router.replace('/login');
  };

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'pagado': return { label: '✅ Pagado — Participando', bg: '#1b5e20' };
      case 'pendiente': return { label: '⏳ Pago pendiente', bg: '#e65100' };
      default: return { label: '❌ Sin pago', bg: '#b71c1c' };
    }
  };

  const totalAciertos = quinielas.reduce((acc, q) => acc + (q.aciertos || 0), 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={50} color="#fff" />
        </View>
        <Text style={styles.nombre}>{usuario?.nombre || 'Jugador'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalAciertos}</Text>
          <Text style={styles.statLabel}>Aciertos totales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{quinielas.length}</Text>
          <Text style={styles.statLabel}>Quinielas jugadas</Text>
        </View>
      </View>

      <Text style={styles.seccion}>Mis quinielas</Text>

      {loading ? (
        <ActivityIndicator color="#009ee3" style={{ margin: 20 }} />
      ) : quinielas.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Aún no has participado en ninguna quiniela.</Text>
        </View>
      ) : (
        quinielas.map((q, i) => {
          const badge = estadoBadge(q.estado_pago);
          return (
            <View key={i} style={styles.quinielaCard}>
              <View style={styles.quinielaHeader}>
                <Text style={styles.quinielaTitulo}>Jornada {q.jornada}</Text>
                <Text style={styles.quinielaFecha}>
                  {new Date(q.creado_en).toLocaleDateString('es-MX')}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={styles.badgeTexto}>{badge.label}</Text>
              </View>
              {q.aciertos > 0 && (
                <Text style={styles.aciertos}>🎯 {q.aciertos} aciertos</Text>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.btnCerrar} onPress={cerrarSesion}>
        <Ionicons name="log-out-outline" size={20} color="#e53935" />
        <Text style={styles.btnCerrarTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  avatarSection: { backgroundColor: '#1a1a2e', alignItems: 'center', padding: 30 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#009ee3', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  nombre: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  email: { color: '#aaa', fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', margin: 15, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 18, alignItems: 'center', elevation: 2 },
  statNum: { fontSize: 32, fontWeight: 'bold', color: '#009ee3' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  seccion: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginHorizontal: 15, marginBottom: 8 },
  emptyBox: { backgroundColor: '#fff', margin: 15, padding: 20, borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14 },
  quinielaCard: { backgroundColor: '#fff', margin: 10, marginTop: 4, borderRadius: 12, padding: 15, elevation: 2 },
  quinielaHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  quinielaTitulo: { fontWeight: 'bold', fontSize: 15, color: '#1a1a2e' },
  quinielaFecha: { fontSize: 12, color: '#aaa' },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  aciertos: { marginTop: 8, fontSize: 13, color: '#2e7d32', fontWeight: '600' },
  btnCerrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 15, padding: 15, borderRadius: 10, borderWidth: 1.5, borderColor: '#e53935', backgroundColor: '#fff' },
  btnCerrarTexto: { color: '#e53935', fontWeight: 'bold', fontSize: 15 },
});
