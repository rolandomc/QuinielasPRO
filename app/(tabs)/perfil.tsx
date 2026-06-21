import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#0d0d1a', card: '#161625', cardBorder: '#1e1e35',
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.12)',
  text: '#f0f0ff', textSub: '#8888aa',
  green: '#00c897', orange: '#ff9f43', red: '#ff6b6b',
};

type Quiniela = { id: string; jornada: number; estado_pago: string; aciertos: number; creado_en: string };

export default function PerfilScreen() {
  const { user, usuario, signOut, refreshUsuario } = useAuth();
  const router = useRouter();
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuinielas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('quinielas').select('id, jornada, estado_pago, aciertos, creado_en').eq('usuario_id', user.id).order('creado_en', { ascending: false });
    if (data) setQuinielas(data);
  }, [user]);

  useEffect(() => { if (user) { setLoading(true); fetchQuinielas().finally(() => setLoading(false)); } }, [user, fetchQuinielas]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await Promise.all([fetchQuinielas(), refreshUsuario()]); setRefreshing(false); }, [fetchQuinielas, refreshUsuario]);

  const cerrarSesion = async () => { await signOut(); router.replace('/login'); };

  const estadoConfig = (estado: string) => {
    switch (estado) {
      case 'pagado':    return { label: 'Pagado \u2014 Participando', color: C.green,  icon: 'checkmark-circle' as const };
      case 'pendiente': return { label: 'Pago pendiente',             color: C.orange, icon: 'time-outline' as const };
      default:          return { label: 'Sin pago',                    color: C.red,    icon: 'close-circle' as const };
    }
  };

  const totalAciertos = quinielas.reduce((a, q) => a + (q.aciertos || 0), 0);
  const pagadas = quinielas.filter(q => q.estado_pago === 'pagado').length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
          </View>
          <Text style={styles.username}>{usuario?.username ? `@${usuario.username}` : usuario?.nombre || 'Jugador'}</Text>
          {usuario?.nombre && usuario?.username && <Text style={styles.nombre}>{usuario.nombre}</Text>}
          <Text style={styles.email}>{user?.email}</Text>
          {usuario?.es_admin && (
            <TouchableOpacity style={styles.btnAdmin} onPress={() => router.push('/admin')} activeOpacity={0.8}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.btnAdminTexto}>Panel Admin</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{quinielas.length}</Text>
            <Text style={styles.statLabel}>Jugadas</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.accent }]}>
            <Text style={[styles.statNum, { color: C.accent }]}>{totalAciertos}</Text>
            <Text style={styles.statLabel}>Aciertos</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: C.green }]}>{pagadas}</Text>
            <Text style={styles.statLabel}>Pagadas</Text>
          </View>
        </View>

        {/* Quinielas */}
        <Text style={styles.seccionTitulo}>Mis quinielas</Text>

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ margin: 30 }} />
        ) : quinielas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎮</Text>
            <Text style={styles.emptyTexto}>Aún no has participado en ninguna quiniela.</Text>
          </View>
        ) : (
          quinielas.map((q, i) => {
            const est = estadoConfig(q.estado_pago);
            return (
              <TouchableOpacity
                key={i}
                style={styles.quinielaCard}
                onPress={() => router.push({ pathname: '/mis-pronosticos', params: { jornada: q.jornada } })}
                activeOpacity={0.75}
              >
                <View style={styles.qCardTop}>
                  <View>
                    <Text style={styles.qJornada}>Jornada {q.jornada}</Text>
                    <View style={styles.qEstadoRow}>
                      <Ionicons name={est.icon} size={13} color={est.color} />
                      <Text style={[styles.qEstado, { color: est.color }]}>{est.label}</Text>
                    </View>
                  </View>
                  <View style={styles.qAciertosBox}>
                    {q.aciertos > 0 && <Text style={styles.qAciertosNum}>{q.aciertos}</Text>}
                    {q.aciertos > 0 && <Text style={styles.qAciertosLabel}>aciertos</Text>}
                    <Ionicons name="chevron-forward" size={16} color={C.textSub} style={{ marginTop: q.aciertos > 0 ? 0 : 4 }} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Cerrar sesion */}
        <TouchableOpacity style={styles.btnCerrar} onPress={cerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={C.red} />
          <Text style={styles.btnCerrarTexto}>Cerrar sesión</Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 56, paddingBottom: 28, paddingHorizontal: 20, backgroundColor: C.bg },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#1e2a35', justifyContent: 'center', alignItems: 'center' },
  username: { color: C.text, fontSize: 22, fontWeight: 'bold' },
  nombre: { color: C.textSub, fontSize: 14, marginTop: 2 },
  email: { color: '#555577', fontSize: 12, marginTop: 4 },
  btnAdmin: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent, marginTop: 14, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  btnAdminTexto: { color: C.accent, fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 10 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder },
  statNum: { fontSize: 26, fontWeight: 'bold', color: C.text },
  statLabel: { fontSize: 11, color: C.textSub, marginTop: 3 },
  seccionTitulo: { color: C.text, fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 10 },
  emptyBox: { alignItems: 'center', padding: 30, marginHorizontal: 16, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder },
  emptyTexto: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  quinielaCard: { backgroundColor: C.card, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.cardBorder },
  qCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qJornada: { color: C.text, fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  qEstadoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qEstado: { fontSize: 12, fontWeight: '600' },
  qAciertosBox: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  qAciertosNum: { fontSize: 20, fontWeight: 'bold', color: C.accent },
  qAciertosLabel: { fontSize: 11, color: C.textSub },
  btnCerrar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.07)' },
  btnCerrarTexto: { color: C.red, fontWeight: '700', fontSize: 15 },
});
