/**
 * resultados.tsx
 *
 * Muestra la quiniela DEL USUARIO que está en curso (jornada cerrada).
 * Para cada partido se ve:
 *   - Equipos + marcador real (si ya tiene goles capturados)
 *   - La predicción del usuario (1 / X / 2)
 *   - ✅ acertó / ❌ falló / ⏳ pendiente
 * Banner superior con total de aciertos y bolsa.
 * Tab "Podio" con el ranking de todos los participantes.
 * Auto-refresh cada 30 s mientras la jornada está activa.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import NeonWrapper from '../../components/NeonWrapper';
import { NeonCard, ScreenHeader } from '../../components/ui';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Jornada = {
  id: string; nombre: string; estado: string;
  bolsa_total: number | null; porcentaje_organizador: number | null;
  precio: number | null;
};
type Partido = {
  id: string; local: string; visitante: string; fecha: string;
  resultado_final: string | null;
  goles_local: number | null; goles_visitante: number | null;
  cerrado: boolean;
};
type Prediccion = {
  partido_id: string; resultado: string;
  goles_local: number | null; goles_visitante: number | null;
};
type PosicionPodio = {
  posicion: number; nombre: string; username: string; aciertos: number;
  esYo: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function calcPremio(j: Jornada) {
  if (!j.bolsa_total) return null;
  return j.bolsa_total * ((100 - (j.porcentaje_organizador ?? 0)) / 100);
}

// ─── Componente: fila de un partido ──────────────────────────────────────────
function FilaPartido({ partido, prediccion, C }: {
  partido: Partido;
  prediccion: Prediccion | undefined;
  C: any;
}) {
  const tieneResultado = partido.resultado_final != null;
  const acerto = prediccion && tieneResultado
    ? prediccion.resultado === partido.resultado_final
    : null;
  const enCurso = partido.cerrado && !tieneResultado;

  // colores del borde según estado
  const borderColor = acerto === true  ? C.green
                    : acerto === false ? C.red
                    : enCurso         ? C.orange
                    : C.cardBorder;
  const glowColor   = acerto === true  ? C.greenGlow
                    : acerto === false ? 'rgba(255,90,110,0.3)'
                    : enCurso         ? 'rgba(255,179,64,0.25)'
                    : 'transparent';

  // texto marcador real
  const marcadorReal = partido.goles_local != null
    ? `${partido.goles_local}  -  ${partido.goles_visitante}`
    : enCurso ? 'En curso' : 'Pendiente';

  // color resultado predicción
  const predColor = acerto === true ? C.green : acerto === false ? C.red : C.accent;

  return (
    <NeonWrapper
      color={glowColor}
      borderRadius={16}
      shadowRadius={acerto != null || enCurso ? 10 : 0}
      opacity={1}
      style={{ marginBottom: 10 }}
    >
      <View style={[
        s.filaCard,
        { backgroundColor: C.card, borderColor },
      ]}>
        {/* Fecha + badge estado */}
        <View style={s.filaHeader}>
          <Text style={[s.fechaTxt, { color: C.textSub }]}>{formatFecha(partido.fecha)}</Text>
          <View style={s.badgeRow}>
            {acerto === true  && <Ionicons name="checkmark-circle" size={18} color={C.green} />}
            {acerto === false && <Ionicons name="close-circle"      size={18} color={C.red}   />}
            {enCurso && (
              <View style={[s.livePill, { backgroundColor: C.orangeDim, borderColor: C.orange }]}>
                <View style={[s.liveDot, { backgroundColor: C.orange }]} />
                <Text style={[s.liveTxt, { color: C.orange }]}>EN CURSO</Text>
              </View>
            )}
            {!prediccion && !partido.cerrado && (
              <View style={[s.livePill, { backgroundColor: C.cardBorder, borderColor: C.cardBorder }]}>
                <Text style={[s.liveTxt, { color: C.textSub }]}>Sin pred.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Equipos + marcador real */}
        <View style={s.equiposRow}>
          <Text style={[s.equipoTxt, { color: C.text }]} numberOfLines={2}>
            {partido.local}
          </Text>
          <View style={[
            s.marcadorWrap,
            { backgroundColor: enCurso ? C.orangeDim : tieneResultado ? C.accentDim : C.cardBorder },
          ]}>
            <Text style={[
              s.marcadorTxt,
              { color: enCurso ? C.orange : tieneResultado ? C.accent : C.textSub,
                fontWeight: tieneResultado || enCurso ? '900' : '600' },
            ]}>
              {marcadorReal}
            </Text>
          </View>
          <Text style={[s.equipoTxt, { color: C.text, textAlign: 'right' }]} numberOfLines={2}>
            {partido.visitante}
          </Text>
        </View>

        {/* Predicción del usuario */}
        {prediccion ? (
          <View style={s.predRow}>
            <Text style={[s.predLabel, { color: C.textSub }]}>Tu predicción</Text>
            <View style={[
              s.predPill,
              { backgroundColor: C.accentDim, borderColor: 'rgba(0,212,255,0.4)' },
              acerto === true  && { backgroundColor: C.greenDim,  borderColor: C.green },
              acerto === false && { backgroundColor: 'rgba(255,90,110,0.18)', borderColor: C.red },
            ]}>
              <Text style={[s.predValor, { color: predColor }]}>
                {prediccion.resultado === '1' ? `1 — ${partido.local}`
                  : prediccion.resultado === '2' ? `2 — ${partido.visitante}`
                  : 'X — Empate'}
              </Text>
            </View>
            {prediccion.goles_local != null && (
              <Text style={[s.marcPronoTxt, { color: C.textSub }]}>
                Pronóstico: {prediccion.goles_local}-{prediccion.goles_visitante}
              </Text>
            )}
          </View>
        ) : (
          <Text style={[s.sinPredTxt, { color: C.textSub }]}>Sin predicción registrada</Text>
        )}
      </View>
    </NeonWrapper>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ResultadosScreen() {
  const { user } = useAuth();
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  const [jornadas,      setJornadas]      = useState<Jornada[]>([]);
  const [jornadaSel,    setJornadaSel]    = useState<Jornada | null>(null);
  const [partidos,      setPartidos]      = useState<Partido[]>([]);
  const [predicciones,  setPredicciones]  = useState<Prediccion[]>([]);
  const [aciertos,      setAciertos]      = useState<number | null>(null);
  const [podio,         setPodio]         = useState<PosicionPodio[]>([]);
  const [tab,           setTab]           = useState<'quiniela' | 'podio'>('quiniela');
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Carga de datos para una jornada ─────────────────────────────────────────
  const cargarJornada = useCallback(async (j: Jornada) => {
    if (!user) return;

    // 1. Partidos de la jornada
    const { data: pData } = await supabase
      .from('partidos')
      .select('id,local,visitante,fecha,resultado_final,goles_local,goles_visitante,cerrado')
      .eq('jornada_id', j.id)
      .order('fecha');
    const listaPartidos: Partido[] = pData ?? [];
    setPartidos(listaPartidos);

    if (listaPartidos.length === 0) {
      setPredicciones([]);
      setAciertos(null);
      setPodio([]);
      return;
    }

    // 2. Predicciones del usuario para estos partidos
    const { data: predData } = await supabase
      .from('predicciones')
      .select('partido_id,resultado,goles_local,goles_visitante')
      .eq('usuario_id', user.id)
      .in('partido_id', listaPartidos.map(p => p.id));
    setPredicciones(predData ?? []);

    // 3. Aciertos del usuario (desde quinielas)
    const { data: qData } = await supabase
      .from('quinielas')
      .select('aciertos')
      .eq('usuario_id', user.id)
      .eq('jornada_id', j.id)
      .maybeSingle();
    setAciertos(qData?.aciertos ?? null);

    // 4. Podio — todos los participantes, ordenados por aciertos
    const { data: podioData } = await supabase
      .from('quinielas')
      .select('aciertos, usuario_id, usuarios:usuario_id(nombre,username)')
      .eq('jornada_id', j.id)
      .order('aciertos', { ascending: false })
      .limit(20);

    const lista: PosicionPodio[] = (podioData ?? []).map((q: any, i: number) => ({
      posicion: i + 1,
      nombre:   q.usuarios?.nombre   ?? '—',
      username: q.usuarios?.username ?? '—',
      aciertos: q.aciertos ?? 0,
      esYo:     q.usuario_id === user.id,
    }));
    setPodio(lista);
  }, [user]);

  // ── Carga inicial: jornadas con estado cerrada, abierta o terminada ──────────
  const cargar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('jornadas')
      .select('id,nombre,estado,bolsa_total,porcentaje_organizador,precio')
      .in('estado', ['cerrada', 'abierta', 'terminada'])
      .order('creado_at', { ascending: false })
      .limit(20);

    const lista: Jornada[] = data ?? [];
    setJornadas(lista);

    // Prioridad: cerrada > abierta > terminada
    const prioridad =
      lista.find(j => j.estado === 'cerrada') ??
      lista.find(j => j.estado === 'abierta') ??
      lista[0] ?? null;

    if (prioridad) {
      setJornadaSel(prioridad);
      await cargarJornada(prioridad);
    }
  }, [user, cargarJornada]);

  // ── Auto-refresh polling ─────────────────────────────────────────────────────
  const recargar = useCallback(async () => {
    if (!jornadaSel) return;
    await cargarJornada(jornadaSel);
  }, [jornadaSel, cargarJornada]);

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (jornadaSel?.estado === 'cerrada' || jornadaSel?.estado === 'abierta') {
      pollingRef.current = setInterval(recargar, 30_000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [jornadaSel, recargar]);

  useEffect(() => {
    setLoading(true);
    cargar().finally(() => setLoading(false));
  }, [cargar]);

  useFocusEffect(useCallback(() => {
    cargar();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [cargar]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  const seleccionarJornada = async (j: Jornada) => {
    setJornadaSel(j);
    setPartidos([]); setPredicciones([]); setAciertos(null); setPodio([]);
    await cargarJornada(j);
  };

  // ── Derivados ────────────────────────────────────────────────────────────────
  const predMap = Object.fromEntries(predicciones.map(p => [p.partido_id, p]));
  const totalCerrados = partidos.filter(p => p.cerrado).length;
  const totalPendientes = partidos.filter(p => !p.cerrado).length;
  const totalTerminados = partidos.filter(p => p.resultado_final != null).length;
  const porcentaje = totalCerrados > 0 && aciertos != null
    ? Math.round((aciertos / totalCerrados) * 100) : null;
  const premio = jornadaSel ? calcPremio(jornadaSel) : null;
  const esActiva = jornadaSel?.estado === 'cerrada' || jornadaSel?.estado === 'abierta';

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={C.accent} colors={[C.accent]} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <ScreenHeader title="📊 Resultados" />

        {/* ── Sin jornadas ── */}
        {jornadas.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>⏳</Text>
            <Text style={[s.emptyTitulo, { color: C.text }]}>Sin jornadas activas</Text>
            <Text style={[s.emptySub, { color: C.textSub }]}>
              Cuando haya una jornada en curso podrás ver tu quiniela aquí.
            </Text>
          </View>
        )}

        {jornadas.length > 0 && (
          <>
            {/* ── Selector de jornadas ── */}
            {jornadas.length > 1 && (
              <View style={s.selectorWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                  {jornadas.map(j => {
                    const sel = jornadaSel?.id === j.id;
                    const dot = j.estado === 'cerrada' ? C.orange
                              : j.estado === 'abierta' ? C.green : null;
                    return (
                      <TouchableOpacity
                        key={j.id}
                        style={[
                          s.chip,
                          { borderColor: C.cardBorder, backgroundColor: C.card },
                          sel && { borderColor: C.accent, backgroundColor: C.accentDim },
                        ]}
                        onPress={() => seleccionarJornada(j)}
                        activeOpacity={0.75}
                      >
                        {dot && <View style={[s.chipDot, { backgroundColor: dot }]} />}
                        <Text style={[s.chipTxt, { color: sel ? C.accent : C.textSub }]}
                          numberOfLines={1}>
                          {j.nombre}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Banner de estado de la jornada ── */}
            {jornadaSel && (
              <NeonWrapper
                color={jornadaSel.estado === 'cerrada' ? 'rgba(255,179,64,0.35)'
                      : jornadaSel.estado === 'abierta' ? C.greenGlow
                      : 'rgba(100,100,100,0.2)'}
                borderRadius={18} shadowRadius={14} opacity={1}
                style={{ marginHorizontal: 16, marginBottom: 12 }}
              >
                <View style={[
                  s.bannerCard,
                  { backgroundColor: jornadaSel.estado === 'cerrada' ? C.orangeDim
                      : jornadaSel.estado === 'abierta' ? C.greenDim : C.card,
                    borderColor: jornadaSel.estado === 'cerrada' ? C.orange
                      : jornadaSel.estado === 'abierta' ? C.green : C.cardBorder,
                  },
                ]}>
                  <View style={s.bannerLeft}>
                    {/* Indicador live */}
                    {jornadaSel.estado === 'cerrada' && (
                      <View style={s.liveRow}>
                        <View style={[s.liveDot, { backgroundColor: C.orange }]} />
                        <Text style={[s.liveTexto, { color: C.orange }]}>EN CURSO</Text>
                      </View>
                    )}
                    {jornadaSel.estado === 'abierta' && (
                      <View style={s.liveRow}>
                        <View style={[s.liveDot, { backgroundColor: C.green }]} />
                        <Text style={[s.liveTexto, { color: C.green }]}>ABIERTA</Text>
                      </View>
                    )}
                    {jornadaSel.estado === 'terminada' && (
                      <View style={s.liveRow}>
                        <Ionicons name="trophy" size={12} color={C.gold} />
                        <Text style={[s.liveTexto, { color: C.gold }]}>TERMINADA</Text>
                      </View>
                    )}
                    <Text style={[s.bannerNombre, { color: C.text }]}>{jornadaSel.nombre}</Text>
                    <Text style={[s.bannerSub, { color: C.textSub }]}>
                      {totalTerminados} terminados · {totalCerrados - totalTerminados} en juego · {totalPendientes} pendientes
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {premio != null && premio > 0 && (
                      <View style={[s.premioPill, { backgroundColor: C.goldDim, borderColor: 'rgba(255,208,96,0.4)' }]}>
                        <Ionicons name="trophy" size={11} color={C.gold} />
                        <Text style={[s.premioTxt, { color: C.gold }]}>${premio.toFixed(0)}</Text>
                      </View>
                    )}
                    {esActiva && (
                      <View style={[s.premioPill, { backgroundColor: C.accentDim, borderColor: 'rgba(0,212,255,0.3)' }]}>
                        <Ionicons name="refresh" size={10} color={C.accent} />
                        <Text style={[s.premioTxt, { color: C.accent }]}>Auto·30s</Text>
                      </View>
                    )}
                  </View>
                </View>
              </NeonWrapper>
            )}

            {/* ── Resumen de aciertos ── */}
            {aciertos != null && totalCerrados > 0 && (
              <NeonCard glow={C.goldGlow} glowRadius={14}
                style={{ marginHorizontal: 16, marginBottom: 12 }}
                cardStyle={{ padding: 16 }}>
                <View style={s.resumenRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.resumenLabel, { color: C.textSub }]}>Tus aciertos</Text>
                    <View style={s.resumenNumRow}>
                      <Text style={[s.resumenNum, { color: C.gold }]}>{aciertos}</Text>
                      <Text style={[s.resumenDen, { color: C.textSub }]}>/ {totalCerrados}</Text>
                      {porcentaje != null && (
                        <View style={[s.pctPill, { backgroundColor: C.goldDim, borderColor: 'rgba(255,208,96,0.35)' }]}>
                          <Text style={[s.pctTxt, { color: C.gold }]}>{porcentaje}%</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name="trophy" size={36} color={C.gold} />
                </View>
                {/* Barra de progreso */}
                <View style={[s.barBg, { backgroundColor: C.cardBorder }]}>
                  <View style={[
                    s.barFill,
                    { backgroundColor: C.gold, width: `${(aciertos / totalCerrados) * 100}%` as any },
                  ]} />
                </View>
              </NeonCard>
            )}

            {/* ── Tabs ── */}
            <View style={s.tabsRow}>
              {(['quiniela', 'podio'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[
                    s.tabBtn,
                    { borderColor: C.cardBorder, backgroundColor: C.card },
                    tab === t && { borderColor: C.accent, backgroundColor: C.accentDim },
                  ]}
                  onPress={() => setTab(t)}
                >
                  <Ionicons
                    name={t === 'quiniela' ? 'football-outline' : 'podium'}
                    size={14}
                    color={tab === t ? C.accent : C.textSub}
                  />
                  <Text style={[s.tabTxt, { color: tab === t ? C.accent : C.textSub }]}>
                    {t === 'quiniela' ? 'Mi Quiniela' : 'Podio'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ══ TAB: Mi Quiniela ══════════════════════════════════════════ */}
            {tab === 'quiniela' && (
              <View style={s.lista}>
                {partidos.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyEmoji}>📋</Text>
                    <Text style={[s.emptyTitulo, { color: C.text }]}>Sin partidos</Text>
                  </View>
                ) : (
                  partidos.map(p => (
                    <FilaPartido
                      key={p.id}
                      partido={p}
                      prediccion={predMap[p.id]}
                      C={C}
                    />
                  ))
                )}
              </View>
            )}

            {/* ══ TAB: Podio ═══════════════════════════════════════════════ */}
            {tab === 'podio' && (
              <View style={s.lista}>
                {podio.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyEmoji}>🏆</Text>
                    <Text style={[s.emptyTitulo, { color: C.text }]}>Sin datos aún</Text>
                    <Text style={[s.emptySub, { color: C.textSub }]}>
                      El podio se actualiza conforme terminan los partidos.
                    </Text>
                  </View>
                ) : (
                  podio.map((pos, i) => {
                    const medallas = ['🥇', '🥈', '🥉'];
                    const glow = i === 0 ? C.goldGlow : i === 1 ? C.accentGlow : i === 2 ? C.orangeGlow : 'transparent';
                    return (
                      <NeonWrapper key={pos.username} color={glow}
                        borderRadius={14} shadowRadius={i < 3 ? 10 : 0} opacity={1}
                        style={{ marginBottom: 8 }}>
                        <View style={[
                          s.podioCard,
                          { backgroundColor: C.card, borderColor: pos.esYo ? C.accent : C.cardBorder },
                          pos.esYo && { borderWidth: 2 },
                        ]}>
                          <Text style={s.medal}>{medallas[i] ?? `${pos.posicion}.`}</Text>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={[s.podioNombre, { color: C.text }]}>{pos.nombre}</Text>
                              {pos.esYo && (
                                <View style={[s.yoPill, { backgroundColor: C.accentDim, borderColor: 'rgba(0,212,255,0.4)' }]}>
                                  <Text style={[s.yoTxt, { color: C.accent }]}>Tú</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[s.podioUser, { color: C.textSub }]}>@{pos.username}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[s.podioAciertos, { color: i === 0 ? C.gold : C.text }]}>
                              {pos.aciertos}
                            </Text>
                            <Text style={[s.podioLabel, { color: C.textSub }]}>aciertos</Text>
                          </View>
                        </View>
                      </NeonWrapper>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:          { flex: 1 },
  emptyWrap:     { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyEmoji:    { fontSize: 52, marginBottom: 16 },
  emptyTitulo:   { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  selectorWrap:  { marginBottom: 12 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  chipDot:       { width: 7, height: 7, borderRadius: 4 },
  chipTxt:       { fontSize: 12, fontWeight: '700' },
  bannerCard:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 18, padding: 14, gap: 10 },
  bannerLeft:    { flex: 1, gap: 3 },
  liveRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  liveDot:       { width: 7, height: 7, borderRadius: 4 },
  liveTexto:     { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  bannerNombre:  { fontSize: 15, fontWeight: '800' },
  bannerSub:     { fontSize: 11 },
  premioPill:    { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  premioTxt:     { fontSize: 11, fontWeight: '800' },
  resumenRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  resumenLabel:  { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  resumenNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  resumenNum:    { fontSize: 36, fontWeight: '900' },
  resumenDen:    { fontSize: 18, fontWeight: '600' },
  pctPill:       { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6 },
  pctTxt:        { fontSize: 12, fontWeight: '800' },
  barBg:         { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:       { height: 6, borderRadius: 3 },
  tabsRow:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5 },
  tabTxt:        { fontWeight: '700', fontSize: 13 },
  lista:         { marginHorizontal: 16 },
  // FilaPartido
  filaCard:      { borderWidth: 1.5, borderRadius: 16, padding: 14 },
  filaHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fechaTxt:      { fontSize: 11 },
  badgeRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  livePill:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  liveTxt:       { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  equiposRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  equipoTxt:     { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  marcadorWrap:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, minWidth: 70, alignItems: 'center' },
  marcadorTxt:   { fontSize: 13, textAlign: 'center' },
  predRow:       { gap: 6 },
  predLabel:     { fontSize: 11, fontWeight: '600' },
  predPill:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  predValor:     { fontSize: 13, fontWeight: '800' },
  marcPronoTxt:  { fontSize: 11, marginTop: 2 },
  sinPredTxt:    { fontSize: 12 },
  // Podio
  podioCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  medal:         { fontSize: 24, width: 34, textAlign: 'center' },
  podioNombre:   { fontSize: 14, fontWeight: '700' },
  podioUser:     { fontSize: 12, marginTop: 2 },
  podioAciertos: { fontSize: 24, fontWeight: '900' },
  podioLabel:    { fontSize: 10 },
  yoPill:        { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  yoTxt:         { fontSize: 10, fontWeight: '800' },
});
