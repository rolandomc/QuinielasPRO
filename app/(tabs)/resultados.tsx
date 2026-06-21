import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { apifb } from '../../lib/apiFootball';

const C = {
  bg: '#0d0d1a', card: '#161625', cardBorder: '#1e1e35',
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.12)',
  text: '#f0f0ff', textSub: '#8888aa',
  green: '#00c897', orange: '#ff9f43', gold: '#ffd700', red: '#ff6b6b',
};

type Jornada  = { id: string; nombre: string; estado: string };
type Posicion = { usuario_id: string; username: string; aciertos: number; total_partidos: number };
type Partido  = { id: string; local: string; visitante: string; resultado_final: string | null; jornada_id: string; api_fixture_id?: number };
type LiveScore = { fixture_id: number; home: number | null; away: number | null; status: string; elapsed: number | null };

const golesAResultado = (h: number | null, a: number | null): '1' | 'X' | '2' | null => {
  if (h === null || a === null) return null;
  if (h > a) return '1'; if (a > h) return '2'; return 'X';
};

// Punto rojo pulsante para partidos en vivo
function LiveDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.liveDotAnim, { opacity: anim }]} />;
}

export default function ResultadosScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [jornadas, setJornadas]     = useState<Jornada[]>([]);
  const [jornadaSel, setJornadaSel] = useState<Jornada | null>(null);
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [partidos, setPartidos]     = useState<Partido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [miPosicion, setMiPosicion] = useState<number | null>(null);
  const [liveScores, setLiveScores] = useState<Record<number, LiveScore>>({});
  const [liveActivo, setLiveActivo] = useState(false);
  const pollingRef = useRef<any>(null);

  const cargar = useCallback(async (j?: Jornada) => {
    setLoading(true);
    const { data: jData } = await supabase
      .from('jornadas').select('id,nombre,estado')
      .in('estado', ['cerrada', 'finalizada'])
      .order('creado_at', { ascending: false });
    const lista: Jornada[] = jData || [];
    setJornadas(lista);
    const jornadaActual = j ?? lista[0] ?? null;
    setJornadaSel(jornadaActual);
    if (!jornadaActual) { setLoading(false); setRefreshing(false); return; }

    const { data: pData } = await supabase
      .from('partidos').select('id,local,visitante,resultado_final,jornada_id,api_fixture_id')
      .eq('jornada_id', jornadaActual.id).order('fecha');
    setPartidos(pData || []);

    const { data: qData } = await supabase
      .from('quinielas').select('usuario_id,aciertos,usuarios(username,nombre)')
      .eq('jornada_id', jornadaActual.id).eq('estado_pago', 'pagado')
      .order('aciertos', { ascending: false });
    const tabla: Posicion[] = (qData || []).map((q: any) => ({
      usuario_id: q.usuario_id,
      username: q.usuarios?.username ? `@${q.usuarios.username}` : (q.usuarios?.nombre || 'Jugador'),
      aciertos: q.aciertos || 0,
      total_partidos: pData?.length || 0,
    }));
    setPosiciones(tabla);
    if (user) { const pos = tabla.findIndex(p => p.usuario_id === user.id); setMiPosicion(pos >= 0 ? pos + 1 : null); }
    setLoading(false); setRefreshing(false);
  }, [user]);

  const fetchLive = useCallback(async (ps: Partido[]) => {
    const conApi = ps.filter(p => p.api_fixture_id && !p.resultado_final);
    if (conApi.length === 0) { setLiveActivo(false); return; }
    try {
      const ids = conApi.map(p => p.api_fixture_id).join('-');
      const data = await apifb.fixtureById(ids);
      const map: Record<number, LiveScore> = {};
      (data.response || []).forEach((f: any) => {
        map[f.fixture.id] = {
          fixture_id: f.fixture.id, home: f.goals.home, away: f.goals.away,
          status: f.fixture.status.short, elapsed: f.fixture.status.elapsed,
        };
      });
      setLiveScores(map);
      setLiveActivo(Object.values(map).some(s => ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(s.status)));
    } catch { }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (partidos.length === 0) return;
    fetchLive(partidos);
    pollingRef.current = setInterval(() => fetchLive(partidos), 60000);
    return () => clearInterval(pollingRef.current);
  }, [partidos]);

  const hayResultados = partidos.some(p => p.resultado_final);
  const medallaColor = (i: number) => i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : C.textSub;
  const medalla = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  const LIVE_STATUS = ['1H', '2H', 'HT', 'ET', 'BT', 'P'];
  const STATUS_LABEL: Record<string, string> = {
    '1H': '1T', '2H': '2T', 'HT': 'ET', 'ET': 'Pról.', 'BT': 'Desc.', 'P': 'Pen.',
  };

  const renderPartido = (p: Partido) => {
    const live = p.api_fixture_id ? liveScores[p.api_fixture_id] : null;
    const res = p.resultado_final;
    const resEfectivo = res ?? (live ? golesAResultado(live.home, live.away) : null);
    const localGana = resEfectivo === '1';
    const visitanteGana = resEfectivo === '2';
    const empate = resEfectivo === 'X';
    const enVivo = live && LIVE_STATUS.includes(live.status);
    const finalizado = live?.status === 'FT' || !!res;

    return (
      <View key={p.id} style={[styles.partidoCard, enVivo && styles.partidoCardLive]}>
        {/* Banner LIVE */}
        {enVivo && (
          <View style={styles.liveBanner}>
            <LiveDot />
            <Text style={styles.liveBannerTexto}>EN VIVO</Text>
            <Text style={styles.liveBannerMinuto}>
              {STATUS_LABEL[live!.status] ?? live!.status}
              {live!.elapsed ? ` ${live!.elapsed}'` : ''}
            </Text>
          </View>
        )}
        <View style={styles.partidoRow}>
          {/* Local */}
          <View style={[styles.equipoBox, localGana && styles.equipoGanador, empate && styles.equipoEmpate]}>
            <Text style={[styles.equipoNombre, localGana && styles.equipoNombreGanador, empate && styles.equipoNombreEmpate]} numberOfLines={2}>
              {p.local}
            </Text>
            {(enVivo || finalizado) && live?.home !== null && live?.home !== undefined && (
              <Text style={[styles.goles, localGana && { color: C.green }]}>{live!.home}</Text>
            )}
          </View>

          {/* Centro */}
          <View style={styles.centroCol}>
            {!enVivo && !finalizado && (
              <View style={styles.pendienteBadge}>
                <Text style={styles.pendienteTexto}>VS</Text>
              </View>
            )}
            {enVivo && (
              <Text style={styles.vsLive}>:</Text>
            )}
            {finalizado && !enVivo && (
              <View style={empate ? styles.empateBadge : styles.ftBadge}>
                <Text style={empate ? styles.empateTexto : styles.ftTexto}>{empate ? 'EMP' : 'FT'}</Text>
              </View>
            )}
          </View>

          {/* Visitante */}
          <View style={[styles.equipoBox, visitanteGana && styles.equipoGanador, empate && styles.equipoEmpate]}>
            <Text style={[styles.equipoNombre, visitanteGana && styles.equipoNombreGanador, empate && styles.equipoNombreEmpate]} numberOfLines={2}>
              {p.visitante}
            </Text>
            {(enVivo || finalizado) && live?.away !== null && live?.away !== undefined && (
              <Text style={[styles.goles, visitanteGana && { color: C.green }]}>{live!.away}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        style={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(jornadaSel ?? undefined); }}
            tintColor={C.accent} colors={[C.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.headerTitle}>🏆 Resultados</Text>
            {liveActivo && (
              <View style={styles.livePill}>
                <LiveDot />
                <Text style={styles.livePillTexto}>EN VIVO</Text>
              </View>
            )}
          </View>
          {miPosicion && (
            <View style={styles.miPosBadge}>
              <Ionicons name="ribbon" size={13} color={C.gold} />
              <Text style={styles.miPosText}>Tu posición #{miPosicion}</Text>
            </View>
          )}
        </View>

        {/* Selector jornadas */}
        {jornadas.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jornadasScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {jornadas.map(j => (
              <TouchableOpacity key={j.id} style={[styles.jornadaBtn, jornadaSel?.id === j.id && styles.jornadaBtnActivo]} onPress={() => cargar(j)} activeOpacity={0.7}>
                <Text style={[styles.jornadaTexto, jornadaSel?.id === j.id && styles.jornadaTextoActivo]} numberOfLines={1}>{j.nombre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Partidos */}
        {partidos.length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>⚽ {jornadaSel?.nombre}</Text>
            {partidos.map(renderPartido)}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={C.accent} style={{ margin: 40 }} />
        ) : jornadas.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>⏰</Text>
            <Text style={styles.emptyTitulo}>Sin jornadas cerradas</Text>
            <Text style={styles.emptyTexto}>Los resultados aparecen cuando el admin cierra una jornada.</Text>
          </View>
        ) : !hayResultados && Object.keys(liveScores).length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>⏰</Text>
            <Text style={styles.emptyTitulo}>Resultados pendientes</Text>
            <Text style={styles.emptyTexto}>La tabla se actualizará cuando inicien los partidos.</Text>
          </View>
        ) : posiciones.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTexto}>No hay participantes con pago confirmado.</Text>
          </View>
        ) : (
          <View style={styles.tablaWrap}>
            <View style={styles.tablaHeader}>
              <Text style={[styles.col, styles.colNum]}>#</Text>
              <Text style={[styles.col, styles.colNombre]}>Jugador</Text>
              <Text style={[styles.col, styles.colAciertos]}>Aciertos</Text>
            </View>
            {posiciones.map((p, i) => (
              <View key={p.usuario_id} style={[styles.tablaRow, p.usuario_id === user?.id && styles.rowMio]}>
                <Text style={[styles.col, styles.colNum, { color: medallaColor(i), fontSize: i < 3 ? 20 : 14, fontWeight: 'bold' }]}>{medalla(i)}</Text>
                <Text style={[styles.col, styles.colNombre, p.usuario_id === user?.id && { color: C.accent }]} numberOfLines={1}>
                  {p.username}{p.usuario_id === user?.id ? ' ★' : ''}
                </Text>
                <View style={styles.colAciertosWrap}>
                  <Text style={styles.aciertosNum}>{p.aciertos}</Text>
                  <Text style={styles.aciertosTotal}>/{p.total_partidos}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { color: C.text, fontSize: 28, fontWeight: 'bold' },

  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,107,107,0.15)', borderWidth: 1, borderColor: C.red, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  livePillTexto: { color: C.red, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  liveDotAnim: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red },

  miPosBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  miPosText: { color: C.gold, fontSize: 13, fontWeight: '700' },

  jornadasScroll: { marginBottom: 12 },
  jornadaBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#2a2a40', backgroundColor: C.card, maxWidth: 160 },
  jornadaBtnActivo: { backgroundColor: C.accentDim, borderColor: C.accent },
  jornadaTexto: { color: C.textSub, fontWeight: '700', fontSize: 12 },
  jornadaTextoActivo: { color: C.accent },

  seccion: { backgroundColor: C.card, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.cardBorder },
  seccionTitulo: { color: C.text, fontWeight: 'bold', fontSize: 15, marginBottom: 14 },

  // Card de partido
  partidoCard: { borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: '#12121f' },
  partidoCardLive: { borderColor: C.red, shadowColor: C.red, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },

  liveBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,107,107,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,107,107,0.2)' },
  liveBannerTexto: { color: C.red, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  liveBannerMinuto: { color: C.red, fontSize: 10, fontWeight: '700', marginLeft: 4 },

  partidoRow: { flexDirection: 'row', alignItems: 'stretch', padding: 10 },
  equipoBox: { flex: 1, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d1a' },
  equipoGanador: { borderColor: C.green, backgroundColor: 'rgba(0,200,151,0.08)' },
  equipoEmpate: { borderColor: C.orange, backgroundColor: 'rgba(255,159,67,0.06)' },
  equipoNombre: { fontSize: 12, fontWeight: 'bold', color: C.textSub, textAlign: 'center' },
  equipoNombreGanador: { color: C.green },
  equipoNombreEmpate: { color: C.orange },
  goles: { fontSize: 26, fontWeight: '900', color: C.text, marginTop: 4 },

  centroCol: { width: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  vsLive: { fontSize: 22, fontWeight: '900', color: C.red },
  empateBadge: { borderWidth: 1.5, borderColor: C.orange, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 4, backgroundColor: 'rgba(255,159,67,0.1)' },
  empateTexto: { color: C.orange, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  ftBadge: { borderWidth: 1, borderColor: C.green, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 4, backgroundColor: 'rgba(0,200,151,0.08)' },
  ftTexto: { color: C.green, fontSize: 10, fontWeight: '700' },
  pendienteBadge: { borderWidth: 1, borderColor: '#2a2a40', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 4 },
  pendienteTexto: { color: C.textSub, fontSize: 12, textAlign: 'center', fontWeight: '700' },

  emptyBox: { alignItems: 'center', padding: 50 },
  emptyTitulo: { fontSize: 16, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  emptyTexto: { color: C.textSub, fontSize: 13, textAlign: 'center' },

  tablaWrap: { marginHorizontal: 16 },
  tablaHeader: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  tablaRow: { flexDirection: 'row', backgroundColor: C.card, padding: 14, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center' },
  rowMio: { borderColor: C.accent, backgroundColor: C.accentDim },
  col: { color: C.textSub, fontSize: 14 },
  colNum: { width: 38, textAlign: 'center' },
  colNombre: { flex: 1, fontWeight: '600', color: C.text },
  colAciertos: { width: 70, textAlign: 'right', fontWeight: 'bold' },
  colAciertosWrap: { width: 70, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline' },
  aciertosNum: { fontSize: 18, fontWeight: 'bold', color: C.text },
  aciertosTotal: { fontSize: 12, color: C.textSub, marginLeft: 1 },
});
