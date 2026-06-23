/**
 * app/(tabs)/resultados.tsx — Clean Architecture
 * Usa NeonCard, ScreenHeader, EmptyState, LoadingScreen de components/ui/
 *
 * FIX: auto-selecciona la jornada con estado 'cerrada' (en curso) o 'abierta'.
 *      Si no hay ninguna, usa la más reciente.
 *      Los estados reales del admin son: 'abierta' | 'cerrada' | 'finalizada'
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { NeonCard, ScreenHeader, EmptyState, LoadingScreen } from '../../components/ui';

type Prediccion = {
  id: string; partido_id: string; resultado: string;
  goles_local: number | null; goles_visitante: number | null;
};
type Partido = {
  id: string; local: string; visitante: string; fecha: string;
  resultado_final: string | null; goles_local: number | null; goles_visitante: number | null; cerrado: boolean;
};
type Jornada = {
  id: string; nombre: string; estado: string;
  bolsa_total: number | null; porcentaje_organizador: number | null;
};
type Quiniela = { id: string; estado_pago: string; aciertos: number | null; jornada_id: string };
type Posicion = { nombre: string; username: string; aciertos: number; posicion: number };

/**
 * Devuelve la jornada prioritaria según los estados reales del admin:
 *  1. estado = 'cerrada'    → jornada en curso (partidos jugándose, resultados pendientes)
 *  2. estado = 'abierta'    → jornada activa donde se pueden hacer predicciones
 *  3. la primera de la lista (más reciente por orden DESC)
 */
function elegirJornadaInicial(lista: Jornada[]): Jornada | null {
  if (lista.length === 0) return null;
  return (
    lista.find(j => j.estado === 'cerrada') ??
    lista.find(j => j.estado === 'abierta') ??
    lista[0]
  );
}

export default function ResultadosScreen() {
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  const [jornadas, setJornadas]         = useState<Jornada[]>([]);
  const [jornadaSel, setJornadaSel]     = useState<Jornada | null>(null);
  const [partidos, setPartidos]         = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Prediccion[]>([]);
  const [quiniela, setQuiniela]         = useState<Quiniela | null>(null);
  const [podio, setPodio]               = useState<Posicion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [tabActiva, setTabActiva]       = useState<'mis' | 'podio'>('mis');

  const cargarJornada = useCallback(async (j: Jornada) => {
    if (!user) return;
    const [{ data: pData }, { data: predData }, { data: qData }, { data: podioData }] = await Promise.all([
      supabase.from('partidos').select('id,local,visitante,fecha,resultado_final,goles_local,goles_visitante,cerrado').eq('jornada_id', j.id).order('fecha'),
      supabase.from('predicciones').select('id,partido_id,resultado,goles_local,goles_visitante').eq('usuario_id', user.id),
      supabase.from('quinielas').select('id,estado_pago,aciertos,jornada_id').eq('usuario_id', user.id).eq('jornada_id', j.id).maybeSingle(),
      supabase.from('quinielas').select('aciertos, usuarios:usuario_id(nombre,username)').eq('jornada_id', j.id).eq('estado_pago', 'pagado').order('aciertos', { ascending: false }).limit(10),
    ]);
    setPartidos(pData ?? []);
    setPredicciones(predData ?? []);
    setQuiniela(qData);
    const lista: Posicion[] = (podioData ?? []).map((q: any, i: number) => ({
      nombre:   q.usuarios?.nombre   ?? '—',
      username: q.usuarios?.username ?? '—',
      aciertos: q.aciertos ?? 0,
      posicion: i + 1,
    }));
    setPodio(lista);
  }, [user]);

  const cargar = useCallback(async () => {
    if (!user) return;
    // Carga todas las jornadas (sin filtrar por estado) para mostrar historial completo
    const { data } = await supabase
      .from('jornadas')
      .select('id,nombre,estado,bolsa_total,porcentaje_organizador')
      .order('creado_at', { ascending: false })
      .limit(20);
    const lista = data ?? [];
    setJornadas(lista);
    // Elegir jornada prioritaria: cerrada (en curso) > abierta > más reciente
    const prioritaria = elegirJornadaInicial(lista);
    setJornadaSel(prioritaria);
    if (prioritaria) await cargarJornada(prioritaria);
  }, [user, cargarJornada]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await cargar(); setRefreshing(false); }, [cargar]);

  const seleccionarJornada = useCallback(async (j: Jornada) => {
    setJornadaSel(j);
    setPartidos([]); setPredicciones([]); setQuiniela(null); setPodio([]);
    await cargarJornada(j);
  }, [cargarJornada]);

  if (loading) return <LoadingScreen />;

  const predMap    = Object.fromEntries(predicciones.map(p => [p.partido_id, p]));
  const aciertos   = quiniela?.aciertos ?? null;
  const total      = partidos.filter(p => p.cerrado).length;
  const porcentaje = total > 0 && aciertos != null ? Math.round((aciertos / total) * 100) : null;

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="📊 Resultados" />

        {jornadas.length === 0 ? (
          <EmptyState emoji="📋" title="Sin jornadas" hint="Aún no hay jornadas registradas." />
        ) : (
          <>
            {/* Selector jornadas */}
            {jornadas.length > 1 && (
              <NeonCard glow={C.accentGlow} glowRadius={10} style={s.marginH}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {jornadas.map(j => {
                    const activa = jornadaSel?.id === j.id;
                    // Punto verde para jornadas 'cerradas' (en curso) o 'abierta' (activas)
                    const enCurso = j.estado === 'cerrada' || j.estado === 'abierta';
                    return (
                      <TouchableOpacity
                        key={j.id}
                        style={[s.jornadaChip, { borderColor: C.cardBorder, backgroundColor: C.bg },
                          activa && { borderColor: C.accent, backgroundColor: C.accentDim }]}
                        onPress={() => seleccionarJornada(j)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.jornadaChipTexto, { color: activa ? C.accent : C.textSub }]} numberOfLines={1}>{j.nombre}</Text>
                        {enCurso && (
                          <View style={[s.estadoDot, { backgroundColor: C.green }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </NeonCard>
            )}

            {/* Resumen aciertos */}
            {quiniela && aciertos != null && (
              <NeonCard glow={C.goldGlow} glowRadius={14} style={s.marginH}>
                <View style={s.resumenRow}>
                  <Ionicons name="trophy" size={22} color={C.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.resumenLabel, { color: C.textSub }]}>Tus aciertos</Text>
                    <Text style={[s.resumenMonto, { color: C.gold }]}>{aciertos} / {total} partidos{porcentaje != null ? `  (${porcentaje}%)` : ''}</Text>
                  </View>
                </View>
              </NeonCard>
            )}

            {/* Tabs */}
            <View style={s.tabsRow}>
              {(['mis', 'podio'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tabBtn, { borderColor: C.cardBorder, backgroundColor: C.card },
                    tabActiva === t && { borderColor: C.accent, backgroundColor: C.accentDim }]}
                  onPress={() => setTabActiva(t)}
                >
                  <Ionicons name={t === 'mis' ? 'list' : 'podium'} size={14} color={tabActiva === t ? C.accent : C.textSub} />
                  <Text style={[s.tabTexto, { color: tabActiva === t ? C.accent : C.textSub }]}>
                    {t === 'mis' ? 'Mis predicciones' : 'Podio'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Predicciones */}
            {tabActiva === 'mis' && (
              <View style={s.lista}>
                {partidos.length === 0 ? (
                  <EmptyState emoji="📋" title="Sin partidos" />
                ) : partidos.map(p => {
                  const pred    = predMap[p.id];
                  const acerto  = pred && p.resultado_final ? pred.resultado === p.resultado_final : null;
                  const glowC   = acerto === true ? C.greenGlow : acerto === false ? 'rgba(255,90,110,0.3)' : C.accentGlow;
                  const borderC = acerto === true ? C.green    : acerto === false ? C.red             : C.cardBorder;
                  return (
                    <NeonCard
                      key={p.id}
                      glow={glowC}
                      glowRadius={acerto != null ? 12 : 0}
                      noGlow={acerto == null}
                      borderColor={borderC}
                      style={{ marginBottom: 10 }}
                      radius={14}
                    >
                      <View style={s.partidoHeaderRow}>
                        <Text style={[s.fechaTexto, { color: C.textSub }]}>
                          {new Date(p.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Text>
                        {acerto === true  && <Ionicons name="checkmark-circle" size={16} color={C.green} />}
                        {acerto === false && <Ionicons name="close-circle"      size={16} color={C.red}   />}
                        {acerto == null   && <Ionicons name="time-outline"      size={16} color={C.textSub} />}
                      </View>
                      <View style={s.equiposRow}>
                        <Text style={[s.equipo, { color: C.text }]} numberOfLines={1}>{p.local}</Text>
                        <View style={[s.vsWrap, { backgroundColor: C.cardBorder }]}>
                          <Text style={[s.vsTexto, { color: C.textSub }]}>
                            {p.goles_local != null ? `${p.goles_local}-${p.goles_visitante}` : 'VS'}
                          </Text>
                        </View>
                        <Text style={[s.equipo, { color: C.text, textAlign: 'right' }]} numberOfLines={1}>{p.visitante}</Text>
                      </View>
                      {pred ? (
                        <View style={s.predRow}>
                          <Text style={[s.predLabel, { color: C.textSub }]}>Tu predicción: </Text>
                          <View style={[s.predPill, { backgroundColor: C.accentDim, borderColor: 'rgba(0,212,255,0.35)' }]}>
                            <Text style={[s.predValor, { color: C.accent }]}>{pred.resultado}</Text>
                          </View>
                          {pred.goles_local != null && (
                            <Text style={[s.marcadorTexto, { color: C.textSub }]}> Marcador: {pred.goles_local}-{pred.goles_visitante}</Text>
                          )}
                        </View>
                      ) : (
                        <Text style={[s.sinPred, { color: C.textSub }]}>Sin predicción registrada</Text>
                      )}
                    </NeonCard>
                  );
                })}
              </View>
            )}

            {/* Podio */}
            {tabActiva === 'podio' && (
              <View style={s.lista}>
                {podio.length === 0
                  ? <EmptyState emoji="🏆" title="Sin datos de podio" hint="Aún no hay resultados finales." />
                  : podio.map((pos, i) => {
                    const medallas = ['🥇', '🥈', '🥉'];
                    const esMedalla = i < 3;
                    const glowC = i === 0 ? C.goldGlow : i === 1 ? C.accentGlow : i === 2 ? C.orangeGlow : 'transparent';
                    return (
                      <NeonCard
                        key={pos.username}
                        glow={glowC}
                        glowRadius={esMedalla ? 12 : 0}
                        noGlow={!esMedalla}
                        style={{ marginBottom: 8 }}
                        radius={14}
                      >
                        <View style={s.podioRow}>
                          <Text style={s.medal}>{medallas[i] ?? `${pos.posicion}.`}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.podioNombre, { color: C.text }]}>{pos.nombre}</Text>
                            <Text style={[s.podioUsername, { color: C.textSub }]}>@{pos.username}</Text>
                          </View>
                          <Text style={[s.podioAciertos, { color: i === 0 ? C.gold : C.text }]}>{pos.aciertos}</Text>
                        </View>
                      </NeonCard>
                    );
                  })
                }
              </View>
            )}
          </>
        )}
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:            { flex: 1 },
  marginH:         { marginHorizontal: 16, marginBottom: 12 },
  jornadaChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  jornadaChipTexto:{ fontSize: 12, fontWeight: '600' },
  estadoDot:       { width: 7, height: 7, borderRadius: 4 },
  resumenRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumenLabel:    { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  resumenMonto:    { fontSize: 20, fontWeight: '900' },
  tabsRow:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5 },
  tabTexto:        { fontWeight: '700', fontSize: 13 },
  lista:           { marginHorizontal: 16 },
  partidoHeaderRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fechaTexto:      { fontSize: 11 },
  equiposRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  equipo:          { flex: 1, fontSize: 14, fontWeight: '700' },
  vsWrap:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  vsTexto:         { fontSize: 11, fontWeight: '700' },
  predRow:         { flexDirection: 'row', alignItems: 'center' },
  predLabel:       { fontSize: 12 },
  predPill:        { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  predValor:       { fontSize: 12, fontWeight: '800' },
  marcadorTexto:   { fontSize: 12 },
  sinPred:         { fontSize: 12 },
  podioRow:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  medal:           { fontSize: 22, width: 30, textAlign: 'center' },
  podioNombre:     { fontSize: 14, fontWeight: '700' },
  podioUsername:   { fontSize: 12 },
  podioAciertos:   { fontSize: 20, fontWeight: '900' },
});
