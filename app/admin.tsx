import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Modal, StatusBar, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { apifb } from '../lib/apiFootball';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b', gold:'#ffd700', purple:'#9b59b6' };

type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null; api_fixture_id:number|null };
type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null };
type Quiniela = { id:string; estado_pago:string; codigo:string|null; jornada_id:string; usuario_id:string; monto_cobrado:number|null; usuarios:{nombre:string;username:string}|null };
type Fixture  = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}}; goals?:{home:number|null;away:number|null} };
type TabAdmin = 'jornadas'|'importar'|'quinielas'|'ingresos';

// Confirmacion compatible web+movil
const confirmar = (titulo: string, mensaje: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if ((window as any).confirm(`${titulo}\n\n${mensaje}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
    ]);
  }
};
const avisar = (titulo: string, mensaje: string) => {
  if (Platform.OS === 'web') {
    (window as any).alert(`${titulo}\n\n${mensaje}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje);
  }
};

const LIGAS_POPULARES = [
  { nombre:'FIFA World Cup', id:'2000', temporada:'2026' },
  { nombre:'Liga MX',        id:'2137', temporada:'2026' },
  { nombre:'UEFA Champions', id:'2001', temporada:'2024' },
  { nombre:'Premier League', id:'2021', temporada:'2024' },
  { nombre:'La Liga',        id:'2014', temporada:'2024' },
  { nombre:'Serie A',        id:'2019', temporada:'2024' },
  { nombre:'Bundesliga',     id:'2002', temporada:'2024' },
  { nombre:'MLS',            id:'2024', temporada:'2025' },
];

// Mini barra de progreso para el dashboard
function BarraIngreso({ valor, max, color }: { valor: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(valor / max, 1) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ height: 6, backgroundColor: '#1e1e35', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export default function AdminScreen() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabAdmin>('jornadas');
  const [jornadas, setJornadas]   = useState<Jornada[]>([]);
  const [partidos, setPartidos]   = useState<Partido[]>([]);
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncingByJornada, setSyncingByJornada] = useState<Record<string, boolean>>({});
  const [borrando, setBorrando]   = useState<string|null>(null);

  const [modalNueva, setModalNueva] = useState(false);
  const [nombreJornada, setNombreJornada] = useState('');
  const [saving, setSaving] = useState(false);

  const [modalResultado, setModalResultado] = useState(false);
  const [partidoSel, setPartidoSel]         = useState<Partido|null>(null);
  const [resultadoInput, setResultadoInput] = useState<'1'|'X'|'2'|null>(null);

  const [ligaId, setLigaId]       = useState('2000');
  const [temporada, setTemporada] = useState('2026');
  const [modoBusqueda, setModoBusqueda] = useState<'jornada'|'fecha'|'semana'>('jornada');
  const [fechaBusqueda, setFechaBusqueda] = useState(new Date().toISOString().split('T')[0]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [roundInput, setRoundInput] = useState('1');
  const [fixtures, setFixtures]   = useState<Fixture[]>([]);
  const [loadingFix, setLoadingFix] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [jornadaDestino, setJornadaDestino] = useState<string>('');
  const [importando, setImportando] = useState(false);

  const [jornadaPagoSel, setJornadaPagoSel] = useState<string|null>(null);
  const [modalPrecio, setModalPrecio] = useState(false);
  const [jornadaPrecioSel, setJornadaPrecioSel] = useState<Jornada|null>(null);
  const [precioInput, setPrecioInput] = useState('');
  const [savingPrecio, setSavingPrecio] = useState(false);

  useEffect(() => {
    if (!usuario?.es_admin) { avisar('Acceso denegado', 'No tienes permisos.'); router.back(); return; }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data:j }, { data:p }, { data:q }] = await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at', { ascending:false }),
      supabase.from('partidos').select('*').order('fecha'),
      supabase.from('quinielas').select('id,estado_pago,codigo,jornada_id,usuario_id,monto_cobrado,usuarios(nombre,username)'),
    ]);
    if (j) setJornadas(j);
    if (p) setPartidos(p);
    if (q) setQuinielas(q as any);
    setLoading(false);
  };

  const crearJornada = async () => {
    if (!nombreJornada.trim()) { avisar('Falta nombre', 'Ingresa un nombre.'); return; }
    setSaving(true);
    const { error } = await supabase.from('jornadas').insert({ nombre: nombreJornada.trim(), estado: 'abierta' });
    setSaving(false);
    if (error) { avisar('Error', error.message); return; }
    setModalNueva(false); setNombreJornada(''); cargarDatos();
  };

  const cerrarJornada = (j: Jornada) => {
    confirmar('Cerrar jornada', `¿Cerrar "${j.nombre}"? Los usuarios ya no podrán editar sus quinielas.`, async () => {
      await supabase.from('jornadas').update({ estado: 'cerrada' }).eq('id', j.id);
      await supabase.from('partidos').update({ cerrado: true }).eq('jornada_id', j.id);
      await cargarDatos();
      avisar('✅ Jornada cerrada', `"${j.nombre}" fue cerrada.`);
    });
  };

  const finalizarJornada = (j: Jornada) => {
    confirmar('Finalizar jornada', `¿Marcar "${j.nombre}" como FINALIZADA?`, async () => {
      await supabase.from('jornadas').update({ estado: 'finalizada' }).eq('id', j.id);
      await cargarDatos();
    });
  };

  const borrarJornada = (j: Jornada) => {
    confirmar('⚠️ Borrar jornada', `¿Eliminar "${j.nombre}" permanentemente? Se borrarán partidos, quinielas y predicciones. NO se puede deshacer.`, async () => {
      setBorrando(j.id);
      try {
        const { data: psDB } = await supabase.from('partidos').select('id').eq('jornada_id', j.id);
        const psIds = (psDB || []).map((p: any) => p.id);
        if (psIds.length > 0) await supabase.from('predicciones').delete().in('partido_id', psIds);
        await supabase.from('quinielas').delete().eq('jornada_id', j.id);
        await supabase.from('partidos').delete().eq('jornada_id', j.id);
        await supabase.from('jornadas').delete().eq('id', j.id);
        await cargarDatos();
        avisar('🗑️ Eliminada', `"${j.nombre}" fue eliminada.`);
      } catch (e: any) {
        avisar('❌ Error', e.message);
        await cargarDatos();
      } finally { setBorrando(null); }
    });
  };

  const sincronizarResultados = async (j: Jornada) => {
    if (!j.api_competition_id || !j.api_season || !j.api_matchday) {
      avisar('Sin datos API', 'Esta jornada no tiene competition_id, season o matchday.'); return;
    }
    setSyncingByJornada(prev => ({ ...prev, [j.id]: true }));
    try {
      const round = `Regular Season - ${j.api_matchday}`;
      const data = await apifb.fixturesPorRound(j.api_competition_id, j.api_season, round);
      const matches: Fixture[] = data.response || [];
      if (!matches.length) { avisar('Sin datos', 'La API no devolvió partidos.'); return; }
      const ps = partidos.filter(p => p.jornada_id === j.id && p.api_fixture_id);
      let actualizados = 0;
      for (const p of ps) {
        const match = matches.find(m => m.fixture.id === p.api_fixture_id);
        if (!match || match.fixture.status.short !== 'FT') continue;
        const goals = match.goals;
        if (goals?.home == null || goals?.away == null) continue;
        const res = goals.home > goals.away ? '1' : goals.away > goals.home ? '2' : 'X';
        await supabase.from('partidos').update({ resultado_final: res, cerrado: true }).eq('id', p.id).eq('jornada_id', j.id);
        actualizados++;
      }
      if (actualizados > 0) await recalcularAciertos(j.id);
      await cargarDatos();
      avisar('✅ Sincronizado', `${actualizados} resultado(s) en "${j.nombre}".`);
    } catch (e) { avisar('Error', String(e)); }
    finally { setSyncingByJornada(prev => ({ ...prev, [j.id]: false })); }
  };

  const recalcularAciertos = async (jornada_id: string) => {
    const { data: pJs } = await supabase.from('partidos').select('id,resultado_final').eq('jornada_id', jornada_id).not('resultado_final', 'is', null);
    if (!pJs?.length) return;
    const ids = pJs.map(p => p.id);
    const { data: qJs } = await supabase.from('quinielas').select('id,usuario_id').eq('jornada_id', jornada_id);
    for (const q of (qJs || [])) {
      const { data: preds } = await supabase.from('predicciones').select('partido_id,resultado').eq('usuario_id', q.usuario_id).in('partido_id', ids);
      const aciertos = (preds || []).filter(pr => pJs.find(x => x.id === pr.partido_id)?.resultado_final === pr.resultado).length;
      await supabase.from('quinielas').update({ aciertos }).eq('id', q.id);
    }
  };

  const guardarResultado = async () => {
    if (!resultadoInput || !partidoSel) return;
    setSaving(true);
    await supabase.from('partidos').update({ resultado_final: resultadoInput, cerrado: true }).eq('id', partidoSel.id);
    await recalcularAciertos(partidoSel.jornada_id);
    setSaving(false); setModalResultado(false); cargarDatos();
  };

  const buscarFixtures = async () => {
    if (!ligaId || !temporada) { avisar('Faltan datos', 'Ingresa ID de liga y temporada.'); return; }
    setLoadingFix(true); setFixtures([]); setSeleccionados(new Set());
    try {
      let data;
      if (modoBusqueda === 'fecha') data = await apifb.fixtures(ligaId, temporada, fechaBusqueda);
      else if (modoBusqueda === 'semana') data = await apifb.fixturesPorSemana(ligaId, temporada, fechaDesde, fechaHasta);
      else data = await apifb.fixturesPorRound(ligaId, temporada, `Regular Season - ${roundInput}`);
      const res: Fixture[] = data.response || [];
      setFixtures(res);
      if (!res.length) avisar('Sin partidos', `No hay partidos para liga ${ligaId}, temporada ${temporada}.`);
    } catch (e) { avisar('Error', String(e)); }
    setLoadingFix(false);
  };

  const importarPartidos = async () => {
    if (!seleccionados.size) { avisar('Sin selección', 'Selecciona al menos un partido.'); return; }
    if (!jornadaDestino) { avisar('Sin jornada', 'Selecciona jornada destino.'); return; }
    setImportando(true);
    const jDest = jornadas.find(j => j.id === jornadaDestino);
    const inserts = fixtures.filter(f => seleccionados.has(f.fixture.id)).map(f => ({
      local: f.teams.home.name, visitante: f.teams.away.name, fecha: f.fixture.date,
      jornada: 0, jornada_id: jornadaDestino, cerrado: false, api_fixture_id: f.fixture.id,
    }));
    if (modoBusqueda === 'jornada' && jDest)
      await supabase.from('jornadas').update({ api_competition_id: ligaId, api_season: temporada, api_matchday: roundInput }).eq('id', jornadaDestino);
    const { error } = await supabase.from('partidos').insert(inserts);
    setImportando(false);
    if (error) { avisar('Error', error.message); return; }
    avisar('✅ Importados', `${inserts.length} partidos en "${jDest?.nombre}".`);
    setFixtures([]); setSeleccionados(new Set()); setTab('jornadas'); cargarDatos();
  };

  // Al marcar pagado: guarda monto_cobrado = precio actual de la jornada
  const marcarPagado = async (qId: string, jornadaId: string) => {
    const jornada = jornadas.find(j => j.id === jornadaId);
    const monto = jornada?.precio ?? 0;
    await supabase.from('quinielas').update({ estado_pago: 'pagado', monto_cobrado: monto }).eq('id', qId);
    cargarDatos();
  };

  const marcarPendiente = async (qId: string) => {
    await supabase.from('quinielas').update({ estado_pago: 'pendiente' }).eq('id', qId);
    cargarDatos();
  };

  const guardarPrecio = async () => {
    if (!jornadaPrecioSel) return;
    const precio = parseFloat(precioInput.replace(',', '.'));
    if (isNaN(precio) || precio < 0) { avisar('Precio inválido', 'Ingresa un número válido ≥ 0.'); return; }
    setSavingPrecio(true);
    const { error } = await supabase.from('jornadas').update({ precio }).eq('id', jornadaPrecioSel.id);
    setSavingPrecio(false);
    if (error) { avisar('Error', error.message); return; }
    setModalPrecio(false); cargarDatos();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large" /></View>;

  const pagados    = quinielas.filter(q => q.estado_pago === 'pagado').length;
  const pendientes = quinielas.filter(q => q.estado_pago === 'pendiente').length;
  const statusColor = (s: string) => s === 'FT' ? C.green : s === 'NS' ? C.textSub : C.orange;
  const estadoColor = (e: string) => e === 'abierta' ? C.green : e === 'cerrada' ? C.orange : C.textSub;

  // Recaudacion usando monto_cobrado guardado (persiste si se borra quiniela)
  const recaudacionTotal = quinielas
    .filter(q => q.estado_pago === 'pagado')
    .reduce((sum, q) => sum + (q.monto_cobrado ?? 0), 0);

  // Datos de ingresos por jornada
  const datosIngresos = jornadas.map(j => {
    const qJ = quinielas.filter(q => q.jornada_id === j.id);
    const pagadasJ = qJ.filter(q => q.estado_pago === 'pagado');
    const pendientesJ = qJ.filter(q => q.estado_pago !== 'pagado');
    const recaudadoJ = pagadasJ.reduce((s, q) => s + (q.monto_cobrado ?? 0), 0);
    const potencial = (j.precio ?? 0) * pendientesJ.length;
    return { j, qJ, pagadasJ, pendientesJ, recaudadoJ, potencial };
  });
  const maxRecaudado = Math.max(...datosIngresos.map(d => d.recaudadoJ), 1);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Panel Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats globales */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{jornadas.filter(j => j.estado === 'abierta').length}</Text>
          <Text style={styles.statLabel}>Abiertas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: C.green }]}>{pagados}</Text>
          <Text style={styles.statLabel}>Pagados</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: C.orange }]}>{pendientes}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: C.gold }]}>${recaudacionTotal.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Recaudado</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {(['jornadas', 'importar', 'quinielas', 'ingresos'] as TabAdmin[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActivo]} onPress={() => setTab(t)}>
            <Text style={[styles.tabTexto, tab === t && styles.tabTextoActivo]}>
              {t === 'jornadas' ? '📅 Jornadas' : t === 'importar' ? '📡 Importar' : t === 'quinielas' ? '📋 Quinielas' : '💰 Ingresos'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* ── JORNADAS ── */}
        {tab === 'jornadas' && (
          <View style={{ padding: 16 }}>
            <TouchableOpacity style={styles.btnNueva} onPress={() => setModalNueva(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle" size={18} color={C.accent} />
              <Text style={styles.btnNuevaTexto}>Nueva jornada</Text>
            </TouchableOpacity>
            {jornadas.length === 0 && <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay jornadas.</Text></View>}
            {jornadas.map(j => {
              const pJ = partidos.filter(p => p.jornada_id === j.id);
              const conRes = pJ.filter(p => p.resultado_final).length;
              const isOpen = j.estado === 'abierta';
              const isCerrada = j.estado === 'cerrada';
              const esBorrando = borrando === j.id;
              const syncing = !!syncingByJornada[j.id];
              return (
                <View key={j.id} style={styles.jornadaCard}>
                  <View style={styles.jornadaHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jornadaNombre}>{j.nombre}</Text>
                      <Text style={styles.jornadaInfo}>{pJ.length} partidos · {conRes}/{pJ.length} resultados</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.estadoBadge, { borderColor: estadoColor(j.estado) }]}>
                        <Text style={[styles.estadoTexto, { color: estadoColor(j.estado) }]}>{j.estado.toUpperCase()}</Text>
                      </View>
                      <TouchableOpacity onPress={() => borrarJornada(j)} style={styles.btnTrash} disabled={esBorrando}>
                        {esBorrando ? <ActivityIndicator size="small" color={C.red} /> : <Ionicons name="trash-outline" size={16} color={C.red} />}
                      </TouchableOpacity>
                    </View>
                  </View>
                  {pJ.map(p => (
                    <View key={p.id} style={styles.partidoRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.partidoTexto}>{p.local} vs {p.visitante}</Text>
                        <Text style={styles.partidoFecha}>{new Date(p.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      {p.resultado_final
                        ? <View style={styles.resBadge}><Text style={styles.resTexto}>{p.resultado_final}</Text></View>
                        : <TouchableOpacity style={styles.btnRes} onPress={() => { setPartidoSel(p); setResultadoInput(null); setModalResultado(true); }}>
                          <Text style={styles.btnResTexto}>+ Resultado</Text>
                        </TouchableOpacity>
                      }
                    </View>
                  ))}
                  <View style={styles.jornadaAcciones}>
                    {isOpen && (
                      <TouchableOpacity style={[styles.accionBtn, { backgroundColor: C.orange }]} onPress={() => cerrarJornada(j)}>
                        <Ionicons name="lock-closed" size={13} color="#fff" /><Text style={styles.accionTexto}>Cerrar todo</Text>
                      </TouchableOpacity>
                    )}
                    {(isOpen || isCerrada) && j.api_competition_id && (
                      <TouchableOpacity style={[styles.accionBtn, { backgroundColor: C.accent }, syncing && { opacity: 0.6 }]} onPress={() => sincronizarResultados(j)} disabled={syncing}>
                        {syncing ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="sync" size={13} color="#fff" /><Text style={styles.accionTexto}>Sincronizar API</Text></>}
                      </TouchableOpacity>
                    )}
                    {isCerrada && (
                      <TouchableOpacity style={[styles.accionBtn, { backgroundColor: C.green }]} onPress={() => finalizarJornada(j)}>
                        <Ionicons name="checkmark-done" size={13} color="#fff" /><Text style={styles.accionTexto}>Finalizar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── IMPORTAR ── */}
        {tab === 'importar' && (
          <View style={{ padding: 16 }}>
            <View style={styles.seccionCard}>
              <Text style={styles.seccionTitulo}>⚡ Ligas rápidas</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
                {LIGAS_POPULARES.map(l => (
                  <TouchableOpacity key={l.id} style={[styles.ligaChip, ligaId === l.id && temporada === l.temporada && styles.ligaChipActiva]} onPress={() => { setLigaId(l.id); setTemporada(l.temporada); }} activeOpacity={0.7}>
                    <Text style={[styles.ligaChipTexto, ligaId === l.id && temporada === l.temporada && { color: C.accent }]} numberOfLines={1}>{l.nombre}</Text>
                    <Text style={styles.ligaChipSub}>{l.temporada}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.seccionCard}>
              <Text style={styles.seccionTitulo}>🔢 Liga y temporada</Text>
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}><Text style={styles.label}>ID liga</Text><TextInput style={styles.input} value={ligaId} onChangeText={setLigaId} keyboardType="number-pad" placeholderTextColor="#555577" /></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>Temporada</Text><TextInput style={styles.input} value={temporada} onChangeText={setTemporada} keyboardType="number-pad" placeholderTextColor="#555577" maxLength={4} /></View>
              </View>
            </View>
            <View style={styles.seccionCard}>
              <Text style={styles.seccionTitulo}>📅 Buscar por</Text>
              <View style={styles.modoRow}>
                {(['jornada', 'fecha', 'semana'] as const).map(m => (
                  <TouchableOpacity key={m} style={[styles.modoBtn, modoBusqueda === m && styles.modoBtnActivo]} onPress={() => setModoBusqueda(m)}>
                    <Text style={[styles.modoBtnTexto, modoBusqueda === m && { color: C.accent }]}>{m === 'jornada' ? 'Jornada' : m === 'fecha' ? 'Día' : 'Semana'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {modoBusqueda === 'jornada' && <><Text style={styles.label}>Número de jornada</Text><TextInput style={styles.input} value={roundInput} onChangeText={setRoundInput} keyboardType="number-pad" placeholderTextColor="#555577" /></>}
              {modoBusqueda === 'fecha' && <><Text style={styles.label}>Fecha (YYYY-MM-DD)</Text><TextInput style={styles.input} value={fechaBusqueda} onChangeText={setFechaBusqueda} placeholderTextColor="#555577" /></>}
              {modoBusqueda === 'semana' && <><Text style={styles.label}>Desde</Text><TextInput style={styles.input} value={fechaDesde} onChangeText={setFechaDesde} placeholderTextColor="#555577" /><Text style={styles.label}>Hasta</Text><TextInput style={styles.input} value={fechaHasta} onChangeText={setFechaHasta} placeholderTextColor="#555577" /></>}
              <TouchableOpacity style={styles.btnBuscar} onPress={buscarFixtures} activeOpacity={0.8}>
                {loadingFix ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="search" size={16} color="#fff" /><Text style={styles.btnBuscarTexto}>Buscar partidos</Text></>}
              </TouchableOpacity>
            </View>
            {fixtures.length > 0 && (
              <View style={styles.seccionCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={styles.seccionTitulo}>{fixtures.length} partidos — {seleccionados.size} sel.</Text>
                  <TouchableOpacity onPress={() => seleccionados.size === fixtures.length ? setSeleccionados(new Set()) : setSeleccionados(new Set(fixtures.map(f => f.fixture.id)))}>
                    <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>{seleccionados.size === fixtures.length ? 'Quitar' : 'Todos'}</Text>
                  </TouchableOpacity>
                </View>
                {fixtures.map(f => {
                  const sel = seleccionados.has(f.fixture.id);
                  return (
                    <TouchableOpacity key={f.fixture.id} style={[styles.fixtureRow, sel && styles.fixtureRowSel]} onPress={() => { const s = new Set(seleccionados); s.has(f.fixture.id) ? s.delete(f.fixture.id) : s.add(f.fixture.id); setSeleccionados(s); }} activeOpacity={0.7}>
                      <View style={[styles.checkbox, sel && styles.checkboxSel]}>{sel && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.fixtureEquipos}>{f.teams.home.name} vs {f.teams.away.name}</Text>
                        <Text style={styles.fixtureFecha}>{new Date(f.fixture.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View style={[styles.statusBadge, { borderColor: statusColor(f.fixture.status.short) }]}>
                        <Text style={[styles.statusTexto, { color: statusColor(f.fixture.status.short) }]}>{f.fixture.status.short}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {seleccionados.size > 0 && (
              <View style={styles.seccionCard}>
                <Text style={styles.seccionTitulo}>📦 Asignar a jornada</Text>
                {jornadas.filter(j => j.estado === 'abierta').length === 0
                  ? <Text style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>⚠️ No hay jornadas abiertas.</Text>
                  : jornadas.filter(j => j.estado === 'abierta').map(j => (
                    <TouchableOpacity key={j.id} style={[styles.jornadaOpcion, jornadaDestino === j.id && styles.jornadaOpcionActiva]} onPress={() => setJornadaDestino(j.id)}>
                      <Text style={[styles.jornadaOpcionTexto, jornadaDestino === j.id && { color: C.accent }]}>{j.nombre}</Text>
                      {jornadaDestino === j.id && <Ionicons name="checkmark-circle" size={18} color={C.accent} />}
                    </TouchableOpacity>
                  ))
                }
                <TouchableOpacity style={[styles.btnImportar, importando && { opacity: 0.6 }]} onPress={importarPartidos} disabled={importando} activeOpacity={0.8}>
                  {importando ? <ActivityIndicator color="#fff" /> : <><Ionicons name="cloud-upload" size={18} color="#fff" /><Text style={styles.btnImportarTexto}>Importar {seleccionados.size} partidos</Text></>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── QUINIELAS ── */}
        {tab === 'quinielas' && (
          <View style={{ padding: 16 }}>
            {quinielas.length === 0
              ? <View style={styles.emptyBox}><Text style={styles.emptyText}>No hay quinielas.</Text></View>
              : quinielas.map(q => {
                const j = jornadas.find(jj => jj.id === q.jornada_id);
                return (
                  <View key={q.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardUser}>{(q.usuarios as any)?.username ? `@${(q.usuarios as any).username}` : (q.usuarios as any)?.nombre || 'Usuario'}</Text>
                        <Text style={styles.cardJornada}>{j?.nombre || 'Jornada desconocida'}</Text>
                        {q.codigo && <Text style={styles.cardCodigo}>🎫 {q.codigo}</Text>}
                        {q.monto_cobrado != null && q.monto_cobrado > 0 && (
                          <Text style={{ color: C.gold, fontSize: 11, marginTop: 2 }}>💵 ${q.monto_cobrado} cobrado</Text>
                        )}
                        <Text style={[styles.cardEstado, q.estado_pago === 'pagado' ? styles.estadoPagado : styles.estadoPendiente]}>
                          {q.estado_pago === 'pagado' ? '✅ Pagado' : '⏳ Pendiente'}
                        </Text>
                      </View>
                      {q.estado_pago !== 'pagado'
                        ? <TouchableOpacity onPress={() => marcarPagado(q.id, q.jornada_id)} style={[styles.actionBtn, { backgroundColor: C.accent }]}>
                          <Text style={styles.actionBtnTexto}>Marcar pagado</Text>
                        </TouchableOpacity>
                        : <View style={[styles.actionBtn, { backgroundColor: 'rgba(0,200,151,0.15)', borderWidth: 1, borderColor: C.green }]}>
                          <Text style={[styles.actionBtnTexto, { color: C.green }]}>✅ Pagado</Text>
                        </View>
                      }
                    </View>
                  </View>
                );
              })
            }
          </View>
        )}

        {/* ── INGRESOS (nuevo dashboard) ── */}
        {tab === 'ingresos' && (
          <View style={{ padding: 16 }}>

            {/* Tarjetas resumen */}
            <View style={styles.ingresosResumenRow}>
              <View style={[styles.ingresosCard, { borderColor: C.gold }]}>
                <Text style={styles.ingresosCardIcono}>💵</Text>
                <Text style={[styles.ingresosCardNum, { color: C.gold }]}>${recaudacionTotal.toFixed(2)}</Text>
                <Text style={styles.ingresosCardLabel}>Total cobrado</Text>
              </View>
              <View style={[styles.ingresosCard, { borderColor: C.green }]}>
                <Text style={styles.ingresosCardIcono}>✅</Text>
                <Text style={[styles.ingresosCardNum, { color: C.green }]}>{pagados}</Text>
                <Text style={styles.ingresosCardLabel}>Pagos recibidos</Text>
              </View>
              <View style={[styles.ingresosCard, { borderColor: C.orange }]}>
                <Text style={styles.ingresosCardIcono}>⏳</Text>
                <Text style={[styles.ingresosCardNum, { color: C.orange }]}>{pendientes}</Text>
                <Text style={styles.ingresosCardLabel}>Pendientes</Text>
              </View>
            </View>

            {/* Potencial pendiente */}
            {(() => {
              const potTotal = datosIngresos.reduce((s, d) => s + d.potencial, 0);
              return potTotal > 0 ? (
                <View style={[styles.potencialBanner]}>
                  <Ionicons name="trending-up" size={16} color={C.orange} />
                  <Text style={styles.potencialTexto}>Potencial pendiente: <Text style={{ color: C.orange, fontWeight: '800' }}>${potTotal.toFixed(2)}</Text></Text>
                </View>
              ) : null;
            })()}

            {/* Por jornada */}
            <Text style={[styles.seccionTitulo, { marginBottom: 10, paddingHorizontal: 4 }]}>📊 Ingresos por jornada</Text>
            {datosIngresos.map(({ j, pagadasJ, pendientesJ, recaudadoJ, potencial }) => {
              const precio = j.precio ?? 0;
              const isOpen = jornadaPagoSel === j.id;
              return (
                <View key={j.id} style={styles.ingresoJornadaCard}>
                  {/* Cabecera */}
                  <TouchableOpacity style={styles.ingresoJornadaHeader} onPress={() => setJornadaPagoSel(isOpen ? null : j.id)} activeOpacity={0.8}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jornadaNombre}>{j.nombre}</Text>
                      <Text style={styles.jornadaInfo}>{pagadasJ.length} pagadas · {pendientesJ.length} pendientes</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[styles.ingresoBig, { color: recaudadoJ > 0 ? C.gold : C.textSub }]}>
                        ${recaudadoJ.toFixed(2)}
                      </Text>
                      {precio > 0 && <Text style={styles.precioPorQuiniela}>${precio}/c</Text>}
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.textSub} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>

                  {/* Barra de progreso */}
                  <BarraIngreso valor={recaudadoJ} max={maxRecaudado} color={recaudadoJ > 0 ? C.gold : '#2a2a40'} />

                  {/* Botón precio */}
                  <TouchableOpacity
                    style={styles.btnConfPrecio}
                    onPress={() => { setJornadaPrecioSel(j); setPrecioInput(precio > 0 ? String(precio) : ''); setModalPrecio(true); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="pricetag-outline" size={13} color={C.accent} />
                    <Text style={styles.btnConfPrecioTexto}>{precio > 0 ? `Precio: $${precio} — cambiar` : 'Configurar precio'}</Text>
                  </TouchableOpacity>

                  {/* Lista expandible */}
                  {isOpen && (
                    <View style={{ marginTop: 10 }}>
                      <View style={styles.separador} />
                      {(pagadasJ.length + pendientesJ.length) === 0 && (
                        <Text style={[styles.emptyText, { marginTop: 10, textAlign: 'center' }]}>Sin quinielas en esta jornada</Text>
                      )}

                      {/* Pendientes */}
                      {pendientesJ.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={[styles.grupoLabel, { color: C.orange }]}>⏳ Pendientes ({pendientesJ.length}){precio > 0 ? ` · Potencial: $${potencial.toFixed(2)}` : ''}</Text>
                          {pendientesJ.map(q => (
                            <View key={q.id} style={styles.pagoRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pagoUser}>{(q.usuarios as any)?.username ? `@${(q.usuarios as any).username}` : (q.usuarios as any)?.nombre || 'Usuario'}</Text>
                                {q.codigo && <Text style={styles.pagoCodigo}>🎫 {q.codigo}</Text>}
                              </View>
                              <TouchableOpacity style={styles.btnPagarChico} onPress={() => marcarPagado(q.id, j.id)}>
                                <Ionicons name="checkmark" size={14} color="#fff" />
                                <Text style={styles.btnPagarChicoTexto}>Pagado</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Pagadas */}
                      {pagadasJ.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                          <Text style={[styles.grupoLabel, { color: C.green }]}>✅ Pagadas ({pagadasJ.length}) · ${recaudadoJ.toFixed(2)}</Text>
                          {pagadasJ.map(q => (
                            <View key={q.id} style={[styles.pagoRow, { opacity: 0.85 }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pagoUser}>{(q.usuarios as any)?.username ? `@${(q.usuarios as any).username}` : (q.usuarios as any)?.nombre || 'Usuario'}</Text>
                                {q.codigo && <Text style={styles.pagoCodigo}>🎫 {q.codigo}</Text>}
                                {q.monto_cobrado != null && <Text style={{ color: C.gold, fontSize: 11, marginTop: 1 }}>💵 ${q.monto_cobrado}</Text>}
                              </View>
                              <TouchableOpacity style={[styles.btnPagarChico, { backgroundColor: 'rgba(255,159,67,0.15)', borderColor: C.orange, borderWidth: 1 }]} onPress={() => marcarPendiente(q.id)}>
                                <Text style={[styles.btnPagarChicoTexto, { color: C.orange }]}>Revertir</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* Modal nueva jornada */}
      <Modal visible={modalNueva} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>Nueva jornada</Text>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={nombreJornada} onChangeText={setNombreJornada} placeholder="Ej: Jornada 1 · Copa Mundial" placeholderTextColor="#555577" autoFocus />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalNueva(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnGuardar, saving && { opacity: 0.6 }]} onPress={crearJornada} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnGuardarTexto}>Crear</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal resultado */}
      <Modal visible={modalResultado} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Resultado manual</Text>
            <Text style={styles.modalSubtitulo}>{partidoSel?.local} vs {partidoSel?.visitante}</Text>
            <View style={styles.resultadoOpciones}>
              {(['1', 'X', '2'] as const).map(op => (
                <TouchableOpacity key={op} style={[styles.resultadoOpcion, resultadoInput === op && styles.resultadoOpcionActiva]} onPress={() => setResultadoInput(op)}>
                  <Text style={[styles.resultadoOpcionTexto, resultadoInput === op && { color: C.accent }]}>
                    {op === '1' ? `1\n${partidoSel?.local.slice(0, 8)}` : op === 'X' ? 'X\nEmpate' : `2\n${partidoSel?.visitante.slice(0, 8)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalResultado(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnGuardar, (!resultadoInput || saving) && { opacity: 0.5 }]} onPress={guardarResultado} disabled={!resultadoInput || saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnGuardarTexto}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal precio */}
      <Modal visible={modalPrecio} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>💲 Precio de quiniela</Text>
              <Text style={styles.modalSubtitulo}>{jornadaPrecioSel?.nombre}</Text>
              <Text style={styles.label}>Precio por quiniela (MXN)</Text>
              <TextInput style={styles.input} value={precioInput} onChangeText={setPrecioInput} keyboardType="decimal-pad" placeholder="Ej: 50" placeholderTextColor="#555577" autoFocus />
              <Text style={{ color: C.textSub, fontSize: 11, marginBottom: 12 }}>Este precio se enviará a Mercado Pago al cobrar.</Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalPrecio(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnGuardar, savingPrecio && { opacity: 0.6 }]} onPress={guardarPrecio} disabled={savingPrecio}>
                  {savingPrecio ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnGuardarTexto}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: C.bg },
  backBtn: { padding: 6, borderRadius: 10, backgroundColor: C.card }, headerTitle: { color: C.text, fontSize: 18, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 16, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.cardBorder },
  stat: { flex: 1, alignItems: 'center' }, statNum: { color: C.accent, fontSize: 22, fontWeight: 'bold' }, statLabel: { color: C.textSub, fontSize: 11, marginTop: 2 },
  tabsScroll: { maxHeight: 52, marginHorizontal: 16, marginBottom: 8 },
  tabsContent: { gap: 6, alignItems: 'center', paddingVertical: 4 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder },
  tabActivo: { backgroundColor: C.accentDim, borderColor: C.accent },
  tabTexto: { fontSize: 12, fontWeight: '600', color: C.textSub }, tabTextoActivo: { color: C.accent },
  btnNueva: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: C.accent, borderStyle: 'dashed', padding: 14, borderRadius: 12, justifyContent: 'center', marginBottom: 12 },
  btnNuevaTexto: { color: C.accent, fontWeight: '700', fontSize: 14 },
  jornadaCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder },
  jornadaHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  jornadaNombre: { color: C.text, fontWeight: 'bold', fontSize: 15 }, jornadaInfo: { color: C.textSub, fontSize: 11, marginTop: 2 },
  estadoBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }, estadoTexto: { fontSize: 10, fontWeight: '800' },
  btnTrash: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.07)', minWidth: 28, alignItems: 'center' },
  partidoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.cardBorder },
  partidoTexto: { color: C.text, fontSize: 13, fontWeight: '600' }, partidoFecha: { color: C.textSub, fontSize: 11, marginTop: 1 },
  resBadge: { backgroundColor: C.accentDim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.accent },
  resTexto: { color: C.accent, fontWeight: '800', fontSize: 14 },
  btnRes: { borderWidth: 1, borderColor: C.cardBorder, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  btnResTexto: { color: C.textSub, fontSize: 11, fontWeight: '600' },
  jornadaAcciones: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  accionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  accionTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyBox: { padding: 24, alignItems: 'center' }, emptyText: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  seccionCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder },
  seccionTitulo: { color: C.text, fontWeight: 'bold', fontSize: 13, marginBottom: 12 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  ligaChip: { borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#12121f', minWidth: 110, alignItems: 'center' },
  ligaChipActiva: { borderColor: C.accent, backgroundColor: C.accentDim },
  ligaChipTexto: { color: C.textSub, fontSize: 12, fontWeight: '700' }, ligaChipSub: { color: C.textSub, fontSize: 10, marginTop: 2, opacity: 0.7 },
  modoRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modoBtn: { flex: 1, padding: 9, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center' },
  modoBtnActivo: { borderColor: C.accent, backgroundColor: C.accentDim },
  modoBtnTexto: { color: C.textSub, fontWeight: '600', fontSize: 12 },
  label: { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 5, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 10, padding: 12, marginBottom: 8, fontSize: 14, color: C.text, backgroundColor: '#12121f' },
  btnBuscar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, padding: 13, borderRadius: 10, marginTop: 4 },
  btnBuscarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  fixtureRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 10, marginBottom: 6, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: '#12121f' },
  fixtureRowSel: { borderColor: C.accent, backgroundColor: C.accentDim },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.textSub, justifyContent: 'center', alignItems: 'center' },
  checkboxSel: { backgroundColor: C.accent, borderColor: C.accent },
  fixtureEquipos: { color: C.text, fontWeight: '600', fontSize: 13 }, fixtureFecha: { color: C.textSub, fontSize: 11, marginTop: 2 },
  statusBadge: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }, statusTexto: { fontSize: 10, fontWeight: '700' },
  jornadaOpcion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, marginBottom: 6, backgroundColor: '#12121f' },
  jornadaOpcionActiva: { borderColor: C.accent, backgroundColor: C.accentDim },
  jornadaOpcionTexto: { color: C.textSub, fontWeight: '600', fontSize: 13 },
  btnImportar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.green, padding: 15, borderRadius: 12, marginTop: 8 },
  btnImportarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  card: { backgroundColor: C.card, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.cardBorder },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardUser: { fontSize: 14, fontWeight: 'bold', color: C.text },
  cardJornada: { fontSize: 11, color: C.accent, marginTop: 2 },
  cardCodigo: { fontSize: 11, color: C.textSub, marginTop: 2 },
  cardEstado: { fontSize: 11, marginTop: 3, fontWeight: '600' },
  estadoPagado: { color: C.green }, estadoPendiente: { color: C.orange },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  actionBtnTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // Ingresos dashboard
  ingresosResumenRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ingresosCard: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1.5, gap: 4 },
  ingresosCardIcono: { fontSize: 22 },
  ingresosCardNum: { fontSize: 18, fontWeight: '900', color: C.text },
  ingresosCardLabel: { color: C.textSub, fontSize: 10, textAlign: 'center', fontWeight: '600' },
  potencialBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,159,67,0.1)', borderWidth: 1, borderColor: 'rgba(255,159,67,0.3)', borderRadius: 10, padding: 12, marginBottom: 14 },
  potencialTexto: { color: C.textSub, fontSize: 13 },
  ingresoJornadaCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.cardBorder },
  ingresoJornadaHeader: { flexDirection: 'row', alignItems: 'center' },
  ingresoBig: { fontSize: 18, fontWeight: '900' },
  precioPorQuiniela: { color: C.textSub, fontSize: 10 },
  separador: { height: 1, backgroundColor: C.cardBorder },
  grupoLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  pagoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.cardBorder },
  pagoUser: { color: C.text, fontSize: 13, fontWeight: '600' }, pagoCodigo: { color: C.textSub, fontSize: 11, marginTop: 1 },
  btnPagarChico: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  btnPagarChicoTexto: { color: '#fff', fontSize: 11, fontWeight: '700' },
  btnConfPrecio: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: C.accent, alignSelf: 'flex-start', backgroundColor: C.accentDim, marginTop: 10, marginBottom: 4 },
  btnConfPrecioTexto: { color: C.accent, fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34, borderTopWidth: 1, borderColor: C.cardBorder },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: C.text, marginBottom: 4 }, modalSubtitulo: { fontSize: 13, color: C.textSub, marginBottom: 16 },
  resultadoOpciones: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  resultadoOpcion: { flex: 1, borderWidth: 2, borderColor: C.cardBorder, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#12121f' },
  resultadoOpcionActiva: { borderColor: C.accent, backgroundColor: C.accentDim },
  resultadoOpcionTexto: { fontSize: 13, color: C.textSub, textAlign: 'center', fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center' }, btnCancelarTexto: { color: C.textSub, fontWeight: '600' },
  btnGuardar: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center' }, btnGuardarTexto: { color: '#fff', fontWeight: 'bold' },
  resumenLabel: { color: C.textSub, fontSize: 13 }, resumenVal: { color: C.text, fontSize: 13, fontWeight: '700' },
});
