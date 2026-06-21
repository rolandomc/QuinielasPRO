import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Linking, RefreshControl, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const C = {
  bg: '#0d0d1a',
  card: '#161625',
  cardBorder: '#1e1e35',
  accent: '#00b4d8',
  accentDim: 'rgba(0,180,216,0.12)',
  text: '#f0f0ff',
  textSub: '#8888aa',
  green: '#00c897',
  orange: '#ff9f43',
  red: '#ff6b6b',
};

type Partido = { id: string; local: string; visitante: string; fecha: string; jornada: number; cerrado: boolean };
type Prediccion = { partido_id: string; resultado: '1' | 'X' | '2' };
type QuinielaDB = { id: string; estado_pago: string; jornada: number };

export default function QuinielaScreen() {
  const { user } = useAuth();
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string, '1' | 'X' | '2'>>({});
  const [jornadaActual, setJornadaActual] = useState<number | null>(null);
  const [quiniela, setQuiniela] = useState<QuinielaDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;
    const { data: partData } = await supabase.from('partidos').select('*').eq('cerrado', false).order('jornada').order('fecha');
    if (!partData || partData.length === 0) { setPartidos([]); setJornadaActual(null); setQuiniela(null); return; }
    const jornada = partData[0].jornada;
    setJornadaActual(jornada); setPartidos(partData);
    const { data: qData } = await supabase.from('quinielas').select('id, estado_pago, jornada').eq('usuario_id', user.id).eq('jornada', jornada).maybeSingle();
    setQuiniela(qData);
    if (qData) {
      const { data: predData } = await supabase.from('predicciones').select('partido_id, resultado').eq('usuario_id', user.id).in('partido_id', partData.map(p => p.id));
      const map: Record<string, '1' | 'X' | '2'> = {};
      (predData || []).forEach(p => { map[p.partido_id] = p.resultado; });
      setPredicciones(map);
    } else { setPredicciones({}); }
  }, [user]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await cargar(); setRefreshing(false); }, [cargar]);
  const seleccionar = (id: string, r: '1' | 'X' | '2') => { if (quiniela) return; setPredicciones(p => ({ ...p, [id]: r })); };

  const guardarQuiniela = async () => {
    if (!user || !jornadaActual) return;
    if (Object.keys(predicciones).length < partidos.length) { Alert.alert('Incompleto', 'Selecciona un resultado para cada partido.'); return; }
    setGuardando(true);
    const { data: nQ, error: eQ } = await supabase.from('quinielas').insert({ usuario_id: user.id, jornada: jornadaActual, estado_pago: 'pendiente', aciertos: 0 }).select().single();
    if (eQ || !nQ) { Alert.alert('Error', eQ?.message || 'Error'); setGuardando(false); return; }
    const inserts = Object.entries(predicciones).map(([partido_id, resultado]) => ({ usuario_id: user.id, partido_id, resultado, quiniela_id: nQ.id }));
    const { error: eP } = await supabase.from('predicciones').insert(inserts);
    if (eP) { Alert.alert('Error', eP.message); setGuardando(false); return; }
    await cargar(); setGuardando(false);
    Alert.alert('\u2705 Quiniela guardada', 'Ahora realiza tu pago para participar.');
  };

  const formatFecha = (f: string) => new Date(f).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large" /></View>;

  const yaGuardo = !!quiniela;
  const esPagado = quiniela?.estado_pago === 'pagado';
  const todoSel = partidos.length > 0 && Object.keys(predicciones).length === partidos.length;
  const selCount = Object.keys(predicciones).length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚽ Mi Quiniela</Text>
          {jornadaActual && <View style={styles.jornadaBadge}><Text style={styles.jornadaBadgeText}>Jornada {jornadaActual}</Text></View>}
        </View>

        {partidos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>⏳</Text>
            <Text style={styles.emptyTitulo}>Sin partidos disponibles</Text>
            <Text style={styles.emptyTexto}>El administrador aún no ha cargado los partidos de la siguiente jornada.</Text>
          </View>
        ) : (
          <>
            {/* Status banner */}
            {yaGuardo && (
              <View style={[styles.statusBanner, esPagado ? styles.bannerGreen : styles.bannerOrange]}>
                <Ionicons name={esPagado ? 'checkmark-circle' : 'time-outline'} size={18} color="#fff" />
                <Text style={styles.statusText}>{esPagado ? 'Pago confirmado \u2014 Estás participando 🎉' : 'Pago pendiente \u2014 Confirma tu pago'}</Text>
              </View>
            )}

            {/* Progreso */}
            {!yaGuardo && (
              <View style={styles.progressBox}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>{selCount}/{partidos.length} partidos seleccionados</Text>
                  <Text style={styles.progressPct}>{Math.round(selCount / partidos.length * 100)}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${selCount / partidos.length * 100}%` as any }]} />
                </View>
              </View>
            )}

            {partidos.map(p => (
              <View key={p.id} style={styles.partidoCard}>
                <Text style={styles.partidoFecha}>{formatFecha(p.fecha)}</Text>
                <View style={styles.equiposRow}>
                  <Text style={styles.equipo} numberOfLines={1}>{p.local}</Text>
                  <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
                  <Text style={styles.equipo} numberOfLines={1}>{p.visitante}</Text>
                </View>
                <View style={styles.opcionesRow}>
                  {(['1', 'X', '2'] as const).map(op => {
                    const activo = predicciones[p.id] === op;
                    return (
                      <TouchableOpacity
                        key={op}
                        style={[styles.opcion, activo && styles.opcionActiva, yaGuardo && { opacity: 0.7 }]}
                        onPress={() => seleccionar(p.id, op)}
                        disabled={yaGuardo}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.opcionLetra, activo && styles.opcionLetraActiva]}>{op}</Text>
                        <Text style={[styles.opcionEquipo, activo && styles.opcionEquipoActivo]} numberOfLines={1}>
                          {op === '1' ? p.local.slice(0, 7) : op === 'X' ? 'Empate' : p.visitante.slice(0, 7)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {!yaGuardo && (
              <TouchableOpacity style={[styles.btnGuardar, !todoSel && styles.btnDisabled]} onPress={guardarQuiniela} disabled={!todoSel || guardando} activeOpacity={0.8}>
                {guardando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={18} color="#fff" /><Text style={styles.btnGuardarTexto}>Guardar quiniela</Text></>}
              </TouchableOpacity>
            )}

            {yaGuardo && !esPagado && (
              <View style={styles.pagoCard}>
                <Ionicons name="wallet-outline" size={28} color={C.accent} style={{ marginBottom: 10 }} />
                <Text style={styles.pagoTitulo}>Confirma tu pago</Text>
                <Text style={styles.pagoTexto}>Envía tu comprobante al administrador vía WhatsApp para participar oficialmente.</Text>
                <TouchableOpacity style={styles.btnWsp} onPress={() => Linking.openURL('https://wa.me/521XXXXXXXXXX?text=Quiero+confirmar+mi+pago+jornada+' + jornadaActual)} activeOpacity={0.8}>
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                  <Text style={styles.btnWspTexto}>Enviar comprobante</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: C.bg },
  headerTitle: { color: C.text, fontSize: 26, fontWeight: 'bold' },
  jornadaBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: C.accentDim, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  jornadaBadgeText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  emptyBox: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitulo: { fontSize: 18, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  emptyTexto: { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12 },
  bannerGreen: { backgroundColor: 'rgba(0,200,151,0.15)', borderWidth: 1, borderColor: C.green },
  bannerOrange: { backgroundColor: 'rgba(255,159,67,0.15)', borderWidth: 1, borderColor: C.orange },
  statusText: { color: C.text, fontWeight: '600', fontSize: 13, flex: 1 },
  progressBox: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.cardBorder },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: C.textSub, fontSize: 12 },
  progressPct: { color: C.accent, fontSize: 12, fontWeight: '700' },
  progressBar: { height: 4, backgroundColor: '#1e1e35', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  partidoCard: { backgroundColor: C.card, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.cardBorder },
  partidoFecha: { color: C.accent, fontSize: 11, fontWeight: '600', marginBottom: 10, textAlign: 'center', letterSpacing: 0.5 },
  equiposRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  equipo: { flex: 1, fontSize: 14, fontWeight: 'bold', color: C.text, textAlign: 'center' },
  vsBadge: { backgroundColor: '#1e1e35', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginHorizontal: 6 },
  vsText: { color: C.textSub, fontSize: 10, fontWeight: '700' },
  opcionesRow: { flexDirection: 'row', gap: 8 },
  opcion: { flex: 1, borderWidth: 1.5, borderColor: '#2a2a40', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#12121f' },
  opcionActiva: { backgroundColor: C.accentDim, borderColor: C.accent },
  opcionLetra: { fontSize: 16, fontWeight: 'bold', color: C.textSub },
  opcionLetraActiva: { color: C.accent },
  opcionEquipo: { fontSize: 10, color: '#555577', marginTop: 3 },
  opcionEquipoActivo: { color: C.accent },
  btnGuardar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, marginHorizontal: 16, marginTop: 6, padding: 16, borderRadius: 14 },
  btnDisabled: { backgroundColor: '#1e2a30', opacity: 0.6 },
  btnGuardarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pagoCard: { backgroundColor: C.card, marginHorizontal: 16, marginTop: 6, borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder },
  pagoTitulo: { fontSize: 16, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  pagoTexto: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  btnWsp: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#25d366', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  btnWspTexto: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
