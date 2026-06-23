import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apifb } from '../../lib/apiFootball';

const LIVE_STATUS = ['1H', '2H', 'HT', 'ET', 'BT', 'P'];
const STATUS_LABEL: Record<string, string> = {
  '1H': '1T', '2H': '2T', 'HT': 'ET', 'ET': 'Pról.', 'BT': 'Desc.', 'P': 'Pen.',
};

type Jornada  = { id: string; nombre: string; estado: string };
type Posicion = { usuario_id: string; username: string; aciertos: number; total_partidos: number };
type Partido  = { id: string; local: string; visitante: string; resultado_final: string | null; jornada_id: string; api_fixture_id?: number | null };
type LiveScore = { fixture_id: number; home: number | null; away: number | null; status: string; elapsed: number | null };
type RankHist = { usuario_id: string; username: string; victorias: number; top3: number; totalAciertos: number; jornadas: number };
type TabRes = 'quiniela' | 'historico';

const golesAResultado = (h: number | null, a: number | null): '1' | 'X' | '2' | null => {
  if (h === null || a === null) return null;
  if (h > a) return '1'; if (a > h) return '2'; return 'X';
};

function LiveDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: anim }} />;
}

export default function ResultadosScreen() {
  const { user } = useAuth();
  const { colors: C, theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab]                 = useState<TabRes>('quiniela');
  const [quinielas, setQuinielas]     = useState<Jornada[]>([]);
  const [quinielaSel, setQuinielaSel] = useState<Jornada | null>(null);
  const [posiciones, setPosiciones]   = useState<Posicion[]>([]);
  const [partidos, setPartidos]       = useState<Partido[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [miPosicion, setMiPosicion]   = useState<number | null>(null);
  const [liveScores, setLiveScores]   = useState<Record<number, LiveScore>>({});
  const [liveActivo, setLiveActivo]   = useState(false);
  const [rankHist, setRankHist]       = useState<RankHist[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const partidosRef       = useRef<Partido[]>([]);
  const pollingRef        = useRef<any>(null);
  const cargaInicialHecha = useRef(false);

  const fetchLive = useCallback(async (ps: Partido[]) => {
    const conApi = ps.filter(p => p.api_fixture_id);
    if (conApi.length === 0) { setLiveActivo(false); return; }
    try {
      const ids = conApi.map(p => p.api_fixture_id).join('-');
      const data = await apifb.fixtureById(ids);
      if (!data?.response) return;
      const map: Record<number, LiveScore> = {};
      (data.response as any[]).forEach(f => {
        map[f.fixture.id] = {
          fixture_id: f.fixture.id,
          home:    f.goals.home,
          away:    f.goals.away,
          status:  f.fixture.status.short,
          elapsed: f.fixture.status.elapsed,
        };
      });
      setLiveScores(map);
      setLiveActivo(Object.values(map).some(s => LIVE_STATUS.includes(s.status)));
    } catch { }
  }, []);

  const iniciarPolling = useCallback((ps: Partido[]) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    partidosRef.current = ps;
    const conApi = ps.filter(p => p.api_fixture_id);
    if (conApi.length === 0) { setLiveActivo(false); return; }
    fetchLive(ps);
    pollingRef.current = setInterval(() => fetchLive(partidosRef.current), 45000);
  }, [fetchLive]);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const cargar = useCallback(async (jornadaForzada?: Jornada) => {
    if (!user) return;
    const { data: jData } = await supabase
      .from('jornadas')
      .select('id,nombre,estado')
      .eq('estado', 'cerrada')
      .order('creado_at', { ascending: false });

    const lista: Jornada[] = jData || [];
    setQuinielas(lista);

    const actual = jornadaForzada ?? lista[0] ?? null;
    setQuinielaSel(actual);

    if (!actual) {
      setPartidos([]);
      setPosiciones([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: pData } = await supabase
      .from('partidos')
      .select('id,local,visitante,resultado_final,jornada_id,api_fixture_id')
      .eq('jornada_id', actual.id)
      .order('fecha');
    const ps: Partido[] = pData || [];
    setPartidos(ps);

    const { data: qData } = await supabase
      .from('quinielas')
      .select('usuario_id,aciertos,usuarios(username,nombre)')
      .eq('jornada_id', actual.id)
      .eq('estado_pago', 'pagado')
      .order('aciertos', { ascending: false });
    const tabla: Posicion[] = (qData || []).map((q: any) => ({
      usuario_id: q.usuario_id,
      username: q.usuarios?.username ? `@${q.usuarios.username}` : (q.usuarios?.nombre || 'Jugador'),
      aciertos: q.aciertos || 0,
      total_partidos: ps.length,
    }));
    setPosiciones(tabla);
    if (user) {
      const pos = tabla.findIndex(p => p.usuario_id === user.id);
      setMiPosicion(pos >= 0 ? pos + 1 : null);
    }
    iniciarPolling(ps);
    setLoading(false);
    setRefreshing(false);
  }, [user, iniciarPolling]);

  useEffect(() => {
    if (!user || cargaInicialHecha.current) return;
    cargaInicialHecha.current = true;
    setLoading(true);
    cargar();
  }, [user, cargar]);

  useFocusEffect(
    useCallback(() => {
      if (!cargaInicialHecha.current) return;
      cargar(quinielaSel ?? undefined);
    }, [cargar, quinielaSel])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    cargar(quinielaSel ?? undefined);
  }, [cargar, quinielaSel]);

  const cargarHistorico = useCallback(async () => {
    setLoadingHist(true);
    const { data: qAll } = await supabase
      .from('quinielas')
      .select('usuario_id,aciertos,jornada_id,usuarios(username,nombre)')
      .eq('estado_pago', 'pagado');
    if (!qAll) { setLoadingHist(false); return; }
    const { data: jAll } = await supabase
      .from('jornadas').select('id').eq('estado', 'finalizada');
    const jIds = new Set((jAll || []).map((j: any) => j.id));
    const mapaUser: Record<string, RankHist> = {};
    for (const q of qAll) {
      if (!jIds.has(q.jornada_id)) continue;
      const uid = q.usuario_id;
      const uname = (q.usuarios as any)?.username
        ? `@${(q.usuarios as any).username}`
        : (q.usuarios as any)?.nombre || 'Jugador';
      if (!mapaUser[uid]) mapaUser[uid] = { usuario_id: uid, username: uname, victorias: 0, top3: 0, totalAciertos: 0, jornadas: 0 };
      mapaUser[uid].totalAciertos += q.aciertos || 0;
      mapaUser[uid].jornadas += 1;
    }
    const porJornada: Record<string, typeof qAll> = {};
    for (const q of qAll) {
      if (!porJornada[q.jornada_id]) porJornada[q.jornada_id] = [];
      porJornada[q.jornada_id].push(q);
    }
    for (const jid of Object.keys(porJornada)) {
      if (!jIds.has(jid)) continue;
      const sorted = [...porJornada[jid]].sort((a, b) => (b.aciertos || 0) - (a.aciertos || 0));
      sorted.forEach((q, i) => {
        if (!mapaUser[q.usuario_id]) return;
        if (i === 0) mapaUser[q.usuario_id].victorias += 1;
        if (i < 3)  mapaUser[q.usuario_id].top3 += 1;
      });
    }
    setRankHist(Object.values(mapaUser).sort((a, b) =>
      b.victorias !== a.victorias ? b.victorias - a.victorias : b.totalAciertos - a.totalAciertos
    ));
    setLoadingHist(false);
  }, []);

  useEffect(() => { if (tab === 'historico') cargarHistorico(); }, [tab, cargarHistorico]);

  const hayResultados = partidos.some(p => p.resultado_final);
  const medallaColor  = (i: number) => i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : C.textSub;
  const medalla       = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

  const renderPartido = (p: Partido) => {
    const live = p.api_fixture_id ? liveScores[p.api_fixture_id] : null;
    const enVivo     = !!live && LIVE_STATUS.includes(live.status);
    const finalizado = live?.status === 'FT' || live?.status === 'AET' || live?.status === 'PEN' || (!!p.resultado_final && !enVivo);
    const golesHome  = live?.home ?? null;
    const golesAway  = live?.away ?? null;
    const resEfectivo   = golesHome !== null ? golesAResultado(golesHome, golesAway) : (p.resultado_final as any ?? null);
    const localGana     = resEfectivo === '1';
    const visitanteGana = resEfectivo === '2';
    const empate        = resEfectivo === 'X';
    const mostrarGoles  = enVivo || finalizado;
    return (
      <View key={p.id} style={[{ borderRadius:12, marginBottom:10, overflow:'hidden', borderWidth:1.5, borderColor:C.cardBorder, backgroundColor:C.card }, enVivo && { borderColor:C.red, shadowColor:C.red, shadowOpacity:0.35, shadowRadius:8, shadowOffset:{width:0,height:0} }]}>
        {enVivo && (
          <View style={{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,107,107,0.12)', paddingHorizontal:12, paddingVertical:6, borderBottomWidth:1, borderBottomColor:'rgba(255,107,107,0.2)' }}>
            <LiveDot color={C.red} />
            <Text style={{ color:C.red, fontSize:11, fontWeight:'900', letterSpacing:1.5 }}>EN VIVO</Text>
            <Text style={{ color:C.red, fontSize:11, fontWeight:'700', marginLeft:2 }}>
              {STATUS_LABEL[live!.status] ?? live!.status}
              {live!.elapsed ? ` ${live!.elapsed}'` : ''}
            </Text>
          </View>
        )}
        <View style={{ flexDirection:'row', alignItems:'stretch', padding:10 }}>
          <View style={[{ flex:1, borderWidth:1.5, borderColor:C.cardBorder, borderRadius:10, paddingVertical:12, paddingHorizontal:8, alignItems:'center', justifyContent:'center', backgroundColor:C.bg }, localGana && { borderColor:C.green, backgroundColor:C.greenDim }, empate && { borderColor:C.orange, backgroundColor:C.orangeDim }]}>
            <Text style={[{ fontSize:12, fontWeight:'bold', color:C.textSub, textAlign:'center' }, localGana && { color:C.green }, empate && { color:C.orange }]} numberOfLines={2}>{p.local}</Text>
            {mostrarGoles && golesHome !== null && (
              <Text style={[{ fontSize:28, fontWeight:'900', color:C.text, marginTop:4 }, localGana && { color:C.green }, empate && { color:C.orange }]}>{golesHome}</Text>
            )}
          </View>
          <View style={{ width:56, alignItems:'center', justifyContent:'center', paddingHorizontal:4 }}>
            {!enVivo && !finalizado && <View style={{ borderWidth:1, borderColor:C.cardBorder, borderRadius:8, paddingHorizontal:5, paddingVertical:4 }}><Text style={{ color:C.textSub, fontSize:12, textAlign:'center', fontWeight:'700' }}>VS</Text></View>}
            {enVivo && <Text style={{ fontSize:24, fontWeight:'900', color:C.red }}>:</Text>}
            {finalizado && !enVivo && (
              <View style={empate ? { borderWidth:1.5, borderColor:C.orange, borderRadius:8, paddingHorizontal:6, paddingVertical:4, backgroundColor:C.orangeDim } : { borderWidth:1, borderColor:C.green, borderRadius:8, paddingHorizontal:6, paddingVertical:4, backgroundColor:C.greenDim }}>
                <Text style={empate ? { color:C.orange, fontSize:10, fontWeight:'700', textAlign:'center' } : { color:C.green, fontSize:10, fontWeight:'700' }}>{empate ? 'EMP' : 'FT'}</Text>
              </View>
            )}
          </View>
          <View style={[{ flex:1, borderWidth:1.5, borderColor:C.cardBorder, borderRadius:10, paddingVertical:12, paddingHorizontal:8, alignItems:'center', justifyContent:'center', backgroundColor:C.bg }, visitanteGana && { borderColor:C.green, backgroundColor:C.greenDim }, empate && { borderColor:C.orange, backgroundColor:C.orangeDim }]}>
            <Text style={[{ fontSize:12, fontWeight:'bold', color:C.textSub, textAlign:'center' }, visitanteGana && { color:C.green }, empate && { color:C.orange }]} numberOfLines={2}>{p.visitante}</Text>
            {mostrarGoles && golesAway !== null && (
              <Text style={[{ fontSize:28, fontWeight:'900', color:C.text, marginTop:4 }, visitanteGana && { color:C.green }, empate && { color:C.orange }]}>{golesAway}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
      <ScrollView
        style={{ flex:1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingBottom:16, paddingHorizontal:20, paddingTop:insets.top+16 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <Text style={{ color:C.text, fontSize:28, fontWeight:'bold' }}>🏆 Resultados</Text>
            {liveActivo && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,107,107,0.15)', borderWidth:1, borderColor:C.red, paddingHorizontal:10, paddingVertical:4, borderRadius:20 }}>
                <LiveDot color={C.red} />
                <Text style={{ color:C.red, fontSize:10, fontWeight:'800', letterSpacing:1 }}>EN VIVO</Text>
              </View>
            )}
          </View>
          {miPosicion != null && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:6, alignSelf:'flex-start', backgroundColor:'rgba(255,215,0,0.1)', borderWidth:1, borderColor:'rgba(255,215,0,0.3)', paddingHorizontal:12, paddingVertical:4, borderRadius:20 }}>
              <Ionicons name="ribbon" size={13} color={C.gold} />
              <Text style={{ color:C.gold, fontSize:13, fontWeight:'700' }}>Tu posición #{miPosicion}</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={{ flexDirection:'row', marginHorizontal:16, marginBottom:14, gap:8 }}>
          <TouchableOpacity style={[{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:C.cardBorder, backgroundColor:C.card }, tab==='quiniela' && { borderColor:C.accent, backgroundColor:C.accentDim }]} onPress={() => setTab('quiniela')} activeOpacity={0.8}>
            <Ionicons name="trophy-outline" size={14} color={tab==='quiniela' ? C.accent : C.textSub} />
            <Text style={[{ color:C.textSub, fontWeight:'700', fontSize:13 }, tab==='quiniela' && { color:C.accent }]}>En Curso</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[{ flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:C.cardBorder, backgroundColor:C.card }, tab==='historico' && { borderColor:C.accent, backgroundColor:C.accentDim }]} onPress={() => setTab('historico')} activeOpacity={0.8}>
            <Ionicons name="bar-chart-outline" size={14} color={tab==='historico' ? C.accent : C.textSub} />
            <Text style={[{ color:C.textSub, fontWeight:'700', fontSize:13 }, tab==='historico' && { color:C.accent }]}>Ranking Global</Text>
          </TouchableOpacity>
        </View>

        {/* ─ TAB EN CURSO ─ */}
        {tab === 'quiniela' && (
          <>
            {quinielas.length > 1 && (
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom:12 }}
                contentContainerStyle={{ paddingHorizontal:16, gap:8 }}
              >
                {quinielas.map(q => (
                  <TouchableOpacity
                    key={q.id}
                    style={[{ paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:C.cardBorder, backgroundColor:C.card, maxWidth:180, gap:4 }, quinielaSel?.id===q.id && { backgroundColor:C.accentDim, borderColor:C.accent }]}
                    onPress={() => { setQuinielaSel(q); cargar(q); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ color:C.textSub, fontWeight:'700', fontSize:12 }, quinielaSel?.id===q.id && { color:C.accent }]} numberOfLines={1}>
                      {q.nombre}
                    </Text>
                    <View style={{ backgroundColor:C.accentDim, borderRadius:6, paddingHorizontal:6, paddingVertical:2, alignSelf:'flex-start' }}>
                      <Text style={{ color:C.accent, fontSize:9, fontWeight:'800', letterSpacing:0.5 }}>EN CURSO</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {loading ? (
              <ActivityIndicator color={C.accent} style={{ margin:40 }} />
            ) : quinielas.length === 0 ? (
              <View style={{ alignItems:'center', padding:50 }}>
                <Text style={{ fontSize:48, marginBottom:12 }}>⚽</Text>
                <Text style={{ fontSize:16, fontWeight:'bold', color:C.text, marginBottom:8 }}>No hay quinielas en curso</Text>
                <Text style={{ color:C.textSub, fontSize:13, textAlign:'center', lineHeight:20 }}>
                  Los resultados en vivo aparecen cuando el admin cierra una jornada.{`\n`}
                  Las jornadas finalizadas aparecen en el Ranking Global.
                </Text>
              </View>
            ) : (
              <>
                {partidos.length > 0 && (
                  <View style={{ backgroundColor:C.card, marginHorizontal:16, marginBottom:12, borderRadius:14, padding:16, borderWidth:1, borderColor:C.cardBorder }}>
                    <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                      <Text style={{ color:C.text, fontWeight:'bold', fontSize:15 }}>⚽ {quinielaSel?.nombre}</Text>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,107,107,0.1)', borderWidth:1, borderColor:C.red, paddingHorizontal:8, paddingVertical:3, borderRadius:10 }}>
                        <LiveDot color={C.red} />
                        <Text style={{ color:C.red, fontSize:10, fontWeight:'800' }}>En curso</Text>
                      </View>
                    </View>
                    {partidos.map(renderPartido)}
                  </View>
                )}

                {!hayResultados && Object.keys(liveScores).length === 0 ? (
                  <View style={{ alignItems:'center', padding:50 }}>
                    <Text style={{ fontSize:48, marginBottom:12 }}>⏰</Text>
                    <Text style={{ fontSize:16, fontWeight:'bold', color:C.text, marginBottom:8 }}>Partidos por comenzar</Text>
                    <Text style={{ color:C.textSub, fontSize:13, textAlign:'center', lineHeight:20 }}>Los marcadores aparecerán cuando inicien los partidos.</Text>
                  </View>
                ) : posiciones.length === 0 ? (
                  <View style={{ alignItems:'center', padding:50 }}>
                    <Text style={{ color:C.textSub, fontSize:13, textAlign:'center', lineHeight:20 }}>No hay pronósticos con pago confirmado.</Text>
                  </View>
                ) : (
                  <View style={{ marginBottom:12, paddingHorizontal:16 }}>
                    <View style={{ flexDirection:'row', paddingHorizontal:14, paddingVertical:10, marginBottom:4 }}>
                      <Text style={[{ color:C.textSub, fontSize:14 }, { width:38, textAlign:'center' }]}>#</Text>
                      <Text style={[{ color:C.textSub, fontSize:14 }, { flex:1, fontWeight:'600', color:C.text }]}>Jugador</Text>
                      <Text style={[{ color:C.textSub, fontSize:14 }, { width:70, textAlign:'right', fontWeight:'bold' }]}>Aciertos</Text>
                    </View>
                    {posiciones.map((p, i) => (
                      <View key={p.usuario_id} style={[{ flexDirection:'row', backgroundColor:C.card, padding:14, borderRadius:12, marginBottom:6, borderWidth:1, borderColor:C.cardBorder, alignItems:'center' }, p.usuario_id===user?.id && { borderColor:C.accent, backgroundColor:C.accentDim }]}>
                        <Text style={[{ color:C.textSub, fontSize:14 }, { width:38, textAlign:'center' }, { color:medallaColor(i), fontSize:i<3?20:14, fontWeight:'bold' }]}>
                          {medalla(i)}
                        </Text>
                        <Text style={[{ color:C.text, flex:1, fontWeight:'600', fontSize:14 }, p.usuario_id===user?.id && { color:C.accent }]} numberOfLines={1}>
                          {p.username}{p.usuario_id===user?.id?' ★':''}
                        </Text>
                        <View style={{ width:70, flexDirection:'row', justifyContent:'flex-end', alignItems:'baseline' }}>
                          <Text style={{ fontSize:18, fontWeight:'bold', color:C.text }}>{p.aciertos}</Text>
                          <Text style={{ fontSize:12, color:C.textSub, marginLeft:1 }}>/{p.total_partidos}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ─ TAB RANKING GLOBAL ─ */}
        {tab === 'historico' && (
          <View style={{ paddingHorizontal:16 }}>
            {loadingHist ? (
              <ActivityIndicator color={C.accent} style={{ margin:40 }} />
            ) : rankHist.length === 0 ? (
              <View style={{ alignItems:'center', padding:50 }}>
                <Text style={{ fontSize:48, marginBottom:12 }}>🏆</Text>
                <Text style={{ fontSize:16, fontWeight:'bold', color:C.text, marginBottom:8 }}>Sin datos históricos</Text>
                <Text style={{ color:C.textSub, fontSize:13, textAlign:'center', lineHeight:20 }}>El ranking aparecerá cuando haya quinielas finalizadas.</Text>
              </View>
            ) : (
              <>
                <Text style={{ color:C.text, fontWeight:'bold', fontSize:15, marginBottom:12 }}>🏆 Ranking de Campeones</Text>
                {rankHist.length >= 3 && (
                  <View style={{ flexDirection:'row', justifyContent:'center', alignItems:'flex-end', marginBottom:20, gap:8 }}>
                    <View style={[{ flex:1, alignItems:'center', backgroundColor:C.card, borderRadius:14, padding:12, borderWidth:1, borderColor:C.cardBorder }, { marginTop:20 }]}>
                      <Text style={{ fontSize:30, marginBottom:4 }}>🥈</Text>
                      <Text style={{ color:C.text, fontSize:11, fontWeight:'bold', textAlign:'center', marginBottom:6 }} numberOfLines={1}>{rankHist[1].username}</Text>
                      <View style={{ borderWidth:1, borderRadius:8, paddingHorizontal:8, paddingVertical:3, backgroundColor:'rgba(192,192,192,0.12)', borderColor:'#c0c0c0' }}>
                        <Text style={{ fontSize:11, fontWeight:'800', color:'#c0c0c0' }}>{rankHist[1].victorias} 🏆</Text>
                      </View>
                    </View>
                    <View style={[{ flex:1, alignItems:'center', backgroundColor:'rgba(255,215,0,0.05)', borderRadius:14, padding:12, borderWidth:1, borderColor:'rgba(255,215,0,0.3)', paddingTop:8 }]}>
                      <Text style={{ fontSize:36 }}>👑</Text>
                      <Text style={{ fontSize:30, marginBottom:4 }}>🥇</Text>
                      <Text style={[{ fontSize:11, fontWeight:'bold', textAlign:'center', marginBottom:6 }, { color:C.gold }]} numberOfLines={1}>{rankHist[0].username}</Text>
                      <View style={{ borderWidth:1, borderRadius:8, paddingHorizontal:8, paddingVertical:3, backgroundColor:'rgba(255,215,0,0.12)', borderColor:C.gold }}>
                        <Text style={{ fontSize:11, fontWeight:'800', color:C.gold }}>{rankHist[0].victorias} 🏆</Text>
                      </View>
                    </View>
                    <View style={[{ flex:1, alignItems:'center', backgroundColor:C.card, borderRadius:14, padding:12, borderWidth:1, borderColor:C.cardBorder }, { marginTop:32 }]}>
                      <Text style={{ fontSize:30, marginBottom:4 }}>🥉</Text>
                      <Text style={{ color:C.text, fontSize:11, fontWeight:'bold', textAlign:'center', marginBottom:6 }} numberOfLines={1}>{rankHist[2].username}</Text>
                      <View style={{ borderWidth:1, borderRadius:8, paddingHorizontal:8, paddingVertical:3, backgroundColor:'rgba(205,127,50,0.12)', borderColor:'#cd7f32' }}>
                        <Text style={{ fontSize:11, fontWeight:'800', color:'#cd7f32' }}>{rankHist[2].victorias} 🏆</Text>
                      </View>
                    </View>
                  </View>
                )}
                <View style={{ marginBottom:12 }}>
                  <View style={{ flexDirection:'row', paddingHorizontal:14, paddingVertical:10, marginBottom:4 }}>
                    <Text style={{ color:C.textSub, fontSize:14, width:38, textAlign:'center' }}>#</Text>
                    <Text style={{ color:C.text, flex:1, fontWeight:'600', fontSize:14 }}>Jugador</Text>
                    <Text style={{ color:C.textSub, fontSize:14, width:36, textAlign:'center' }}>🏆</Text>
                    <Text style={{ color:C.textSub, fontSize:14, width:50, textAlign:'right' }}>Prom</Text>
                  </View>
                  {rankHist.map((r, i) => (
                    <View key={r.usuario_id} style={[{ flexDirection:'row', backgroundColor:C.card, padding:14, borderRadius:12, marginBottom:6, borderWidth:1, borderColor:C.cardBorder, alignItems:'center' }, r.usuario_id===user?.id && { borderColor:C.accent, backgroundColor:C.accentDim }]}>
                      <Text style={[{ color:C.textSub, fontSize:14 }, { width:38, textAlign:'center' }, { color:medallaColor(i), fontSize:i<3?18:13, fontWeight:'bold' }]}>
                        {medalla(i)}
                      </Text>
                      <View style={{ flex:1 }}>
                        <Text style={[{ color:C.text, fontWeight:'600', fontSize:14 }, r.usuario_id===user?.id && { color:C.accent }]} numberOfLines={1}>
                          {r.username}{r.usuario_id===user?.id?' ★':''}
                        </Text>
                        <Text style={{ color:C.textSub, fontSize:10, marginTop:1 }}>
                          {r.jornadas} quiniela{r.jornadas!==1?'s':''} · {r.top3} top3
                        </Text>
                      </View>
                      <Text style={{ color:C.gold, fontWeight:'bold', fontSize:14, width:36, textAlign:'center' }}>{r.victorias}</Text>
                      <Text style={{ color:C.green, fontSize:14, width:50, textAlign:'right' }}>
                        {r.jornadas>0?(r.totalAciertos/r.jornadas).toFixed(1):'-'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ height:50 }} />
      </ScrollView>
    </View>
  );
}
