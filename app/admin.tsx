import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Modal, StatusBar, KeyboardAvoidingView, Platform,
  Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { apifb } from '../lib/apiFootball';

const { width: SW } = Dimensions.get('window');
const C = {
  bg: '#0a0a15', card: '#131320', cardBorder: '#1c1c30',
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.1)', accentGlow: 'rgba(0,180,216,0.25)',
  text: '#f0f0ff', textSub: '#7777aa', textMuted: '#44445a',
  green: '#00c897', greenDim: 'rgba(0,200,151,0.12)',
  orange: '#ff9f43', orangeDim: 'rgba(255,159,67,0.12)',
  red: '#ff6b6b', redDim: 'rgba(255,107,107,0.1)',
  gold: '#ffd700', goldDim: 'rgba(255,215,0,0.1)',
  purple: '#a78bfa', purpleDim: 'rgba(167,139,250,0.1)',
};

type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null; api_fixture_id:number|null };
type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null };
type Quiniela = { id:string; estado_pago:string; codigo:string|null; jornada_id:string; usuario_id:string; monto_cobrado:number|null; usuarios:{nombre:string;username:string}|null };
type Fixture  = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}}; goals?:{home:number|null;away:number|null} };
type Screen = 'home'|'jornada_detalle'|'importar'|'quinielas'|'ingresos';

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

function PulseBar({ valor, max, color }: { valor:number; max:number; color:string }) {
  const pct = max > 0 ? Math.min(valor / max, 1) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 900, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ height: 4, backgroundColor: C.cardBorder, borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
      <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: color, width: anim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }} />
    </View>
  );
}

function StatChip({ icon, value, label, color, dim }: { icon:string; value:string; label:string; color:string; dim:string }) {
  return (
    <View style={[styles.statChip, { backgroundColor: dim, borderColor: color+'40' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statChipVal, { color }]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

function AccionRapida({ icon, label, color, dim, onPress }: { icon:string; label:string; color:string; dim:string; onPress:()=>void }) {
  return (
    <TouchableOpacity style={[styles.accionRapida, { backgroundColor: dim, borderColor: color+'50' }]} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.accionIcon, { backgroundColor: color+'20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.accionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AdminScreen() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>('home');
  const [jornadaSel, setJornadaSel] = useState<Jornada|null>(null);

  const [jornadas, setJornadas]   = useState<Jornada[]>([]);
  const [partidos, setPartidos]   = useState<Partido[]>([]);
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading]     = useState(true);
  const [syncingByJornada, setSyncingByJornada] = useState<Record<string,boolean>>({});
  const [borrando, setBorrando]   = useState<string|null>(null);

  const [modalNueva, setModalNueva]   = useState(false);
  const [nombreJornada, setNombreJornada] = useState('');
  const [saving, setSaving]           = useState(false);

  const [modalResultado, setModalResultado] = useState(false);
  const [partidoSel, setPartidoSel]         = useState<Partido|null>(null);
  const [resultadoInput, setResultadoInput] = useState<'1'|'X'|'2'|null>(null);

  // Importar
  const [ligaId, setLigaId]         = useState('2000');
  const [temporada, setTemporada]   = useState('2026');
  const [modoBusqueda, setModoBusqueda] = useState<'jornada'|'fecha'|'semana'>('jornada');
  const [fechaBusqueda, setFechaBusqueda] = useState(new Date().toISOString().split('T')[0]);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [roundInput, setRoundInput] = useState('1');
  const [fixtures, setFixtures]     = useState<Fixture[]>([]);
  const [loadingFix, setLoadingFix] = useState(false);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [jornadaDestino, setJornadaDestino] = useState('');
  const [importando, setImportando] = useState(false);

  // Ingresos
  const [expandedJornada, setExpandedJornada] = useState<string|null>(null);
  const [modalPrecio, setModalPrecio]   = useState(false);
  const [jornadaPrecioSel, setJornadaPrecioSel] = useState<Jornada|null>(null);
  const [precioInput, setPrecioInput]   = useState('');
  const [savingPrecio, setSavingPrecio] = useState(false);

  useEffect(() => {
    if (!usuario?.es_admin) { avisar('Acceso denegado','No tienes permisos.'); router.back(); return; }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data:j },{ data:p },{ data:q }] = await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at',{ascending:false}),
      supabase.from('partidos').select('*').order('fecha'),
      supabase.from('quinielas').select('id,estado_pago,codigo,jornada_id,usuario_id,monto_cobrado,usuarios(nombre,username)'),
    ]);
    if (j) setJornadas(j);
    if (p) setPartidos(p);
    if (q) setQuinielas(q as any);
    setLoading(false);
  };

  const crearJornada = async () => {
    if (!nombreJornada.trim()) { avisar('Falta nombre','Ingresa un nombre.'); return; }
    setSaving(true);
    const { error } = await supabase.from('jornadas').insert({ nombre: nombreJornada.trim(), estado:'abierta' });
    setSaving(false);
    if (error) { avisar('Error', error.message); return; }
    setModalNueva(false); setNombreJornada(''); cargarDatos();
  };

  const cerrarJornada = (j: Jornada) => {
    confirmar('Cerrar jornada', `¿Cerrar "${j.nombre}"? Los usuarios ya no podrán editar.`, async () => {
      await supabase.from('jornadas').update({ estado:'cerrada' }).eq('id', j.id);
      await supabase.from('partidos').update({ cerrado:true }).eq('jornada_id', j.id);
      await cargarDatos();
      avisar('✅ Cerrada', `"${j.nombre}" fue cerrada.`);
    });
  };

  const finalizarJornada = (j: Jornada) => {
    confirmar('Finalizar', `¿Marcar "${j.nombre}" como FINALIZADA?`, async () => {
      await supabase.from('jornadas').update({ estado:'finalizada' }).eq('id', j.id);
      await cargarDatos();
    });
  };

  const borrarJornada = (j: Jornada) => {
    confirmar('⚠️ Borrar', `¿Eliminar "${j.nombre}" permanentemente?`, async () => {
      setBorrando(j.id);
      try {
        const { data: psDB } = await supabase.from('partidos').select('id').eq('jornada_id', j.id);
        const psIds = (psDB||[]).map((p:any)=>p.id);
        if (psIds.length>0) await supabase.from('predicciones').delete().in('partido_id', psIds);
        await supabase.from('quinielas').delete().eq('jornada_id', j.id);
        await supabase.from('partidos').delete().eq('jornada_id', j.id);
        await supabase.from('jornadas').delete().eq('id', j.id);
        await cargarDatos();
        if (jornadaSel?.id === j.id) { setJornadaSel(null); setScreen('home'); }
        avisar('🗑️ Eliminada', `"${j.nombre}" fue eliminada.`);
      } catch (e:any) { avisar('Error', e.message); await cargarDatos(); }
      finally { setBorrando(null); }
    });
  };

  const sincronizarResultados = async (j: Jornada) => {
    if (!j.api_competition_id||!j.api_season||!j.api_matchday) {
      avisar('Sin datos API','Esta jornada no tiene competition_id, season o matchday.'); return;
    }
    setSyncingByJornada(prev=>({...prev,[j.id]:true}));
    try {
      const round = `Regular Season - ${j.api_matchday}`;
      const data = await apifb.fixturesPorRound(j.api_competition_id, j.api_season, round);
      const matches: Fixture[] = data.response||[];
      if (!matches.length) { avisar('Sin datos','La API no devolvió partidos.'); return; }
      const ps = partidos.filter(p=>p.jornada_id===j.id && p.api_fixture_id);
      let actualizados=0;
      for (const p of ps) {
        const match = matches.find(m=>m.fixture.id===p.api_fixture_id);
        if (!match||match.fixture.status.short!=='FT') continue;
        const goals=match.goals;
        if (goals?.home==null||goals?.away==null) continue;
        const res = goals.home>goals.away?'1':goals.away>goals.home?'2':'X';
        await supabase.from('partidos').update({resultado_final:res,cerrado:true}).eq('id',p.id).eq('jornada_id',j.id);
        actualizados++;
      }
      if (actualizados>0) await recalcularAciertos(j.id);
      await cargarDatos();
      avisar('✅ Sincronizado',`${actualizados} resultado(s) en "${j.nombre}".`);
    } catch(e){ avisar('Error',String(e)); }
    finally { setSyncingByJornada(prev=>({...prev,[j.id]:false})); }
  };

  const recalcularAciertos = async (jornada_id: string) => {
    const { data:pJs } = await supabase.from('partidos').select('id,resultado_final').eq('jornada_id',jornada_id).not('resultado_final','is',null);
    if (!pJs?.length) return;
    const ids = pJs.map(p=>p.id);
    const { data:qJs } = await supabase.from('quinielas').select('id,usuario_id').eq('jornada_id',jornada_id);
    for (const q of (qJs||[])) {
      const { data:preds } = await supabase.from('predicciones').select('partido_id,resultado').eq('usuario_id',q.usuario_id).in('partido_id',ids);
      const aciertos = (preds||[]).filter(pr=>pJs.find(x=>x.id===pr.partido_id)?.resultado_final===pr.resultado).length;
      await supabase.from('quinielas').update({aciertos}).eq('id',q.id);
    }
  };

  const guardarResultado = async () => {
    if (!resultadoInput||!partidoSel) return;
    setSaving(true);
    await supabase.from('partidos').update({resultado_final:resultadoInput,cerrado:true}).eq('id',partidoSel.id);
    await recalcularAciertos(partidoSel.jornada_id);
    setSaving(false); setModalResultado(false); cargarDatos();
  };

  const buscarFixtures = async () => {
    if (!ligaId||!temporada) { avisar('Faltan datos','Ingresa ID de liga y temporada.'); return; }
    setLoadingFix(true); setFixtures([]); setSeleccionados(new Set());
    try {
      let data;
      if (modoBusqueda==='fecha') data = await apifb.fixtures(ligaId,temporada,fechaBusqueda);
      else if (modoBusqueda==='semana') data = await apifb.fixturesPorSemana(ligaId,temporada,fechaDesde,fechaHasta);
      else data = await apifb.fixturesPorRound(ligaId,temporada,`Regular Season - ${roundInput}`);
      const res: Fixture[] = data.response||[];
      setFixtures(res);
      if (!res.length) avisar('Sin partidos',`No hay partidos para liga ${ligaId}, temporada ${temporada}.`);
    } catch(e){ avisar('Error',String(e)); }
    setLoadingFix(false);
  };

  const importarPartidos = async () => {
    if (!seleccionados.size) { avisar('Sin selección','Selecciona al menos un partido.'); return; }
    if (!jornadaDestino) { avisar('Sin jornada','Selecciona jornada destino.'); return; }
    setImportando(true);
    const jDest = jornadas.find(j=>j.id===jornadaDestino);
    const inserts = fixtures.filter(f=>seleccionados.has(f.fixture.id)).map(f=>({
      local:f.teams.home.name, visitante:f.teams.away.name, fecha:f.fixture.date,
      jornada:0, jornada_id:jornadaDestino, cerrado:false, api_fixture_id:f.fixture.id,
    }));
    if (modoBusqueda==='jornada'&&jDest)
      await supabase.from('jornadas').update({api_competition_id:ligaId,api_season:temporada,api_matchday:roundInput}).eq('id',jornadaDestino);
    const { error } = await supabase.from('partidos').insert(inserts);
    setImportando(false);
    if (error) { avisar('Error',error.message); return; }
    avisar('✅ Importados',`${inserts.length} partidos en "${jDest?.nombre}".`);
    setFixtures([]); setSeleccionados(new Set()); setScreen('home'); cargarDatos();
  };

  const marcarPagado = async (qId:string, jornadaId:string) => {
    const jornada = jornadas.find(j=>j.id===jornadaId);
    const monto = jornada?.precio??0;
    await supabase.from('quinielas').update({estado_pago:'pagado',monto_cobrado:monto}).eq('id',qId);
    cargarDatos();
  };
  const marcarPendiente = async (qId:string) => {
    await supabase.from('quinielas').update({estado_pago:'pendiente'}).eq('id',qId);
    cargarDatos();
  };
  const guardarPrecio = async () => {
    if (!jornadaPrecioSel) return;
    const precio = parseFloat(precioInput.replace(',','.'));
    if (isNaN(precio)||precio<0) { avisar('Precio inválido','Ingresa un número válido ≥ 0.'); return; }
    setSavingPrecio(true);
    const { error } = await supabase.from('jornadas').update({precio}).eq('id',jornadaPrecioSel.id);
    setSavingPrecio(false);
    if (error) { avisar('Error',error.message); return; }
    setModalPrecio(false); cargarDatos();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  // — Computed —
  const pagados          = quinielas.filter(q=>q.estado_pago==='pagado').length;
  const pendientes       = quinielas.filter(q=>q.estado_pago==='pendiente').length;
  const recaudacionTotal = quinielas.filter(q=>q.estado_pago==='pagado').reduce((s,q)=>s+(q.monto_cobrado??0),0);
  const jornadasActivas  = jornadas.filter(j=>j.estado==='abierta'||j.estado==='cerrada');
  const jornadasFin      = jornadas.filter(j=>j.estado==='finalizada');
  const quinPendientes   = quinielas.filter(q=>q.estado_pago==='pendiente');
  const statusColor      = (s:string)=>s==='FT'?C.green:s==='NS'?C.textSub:C.orange;
  const estadoColor      = (e:string)=>e==='abierta'?C.green:e==='cerrada'?C.orange:C.textSub;
  const estadoDim        = (e:string)=>e==='abierta'?C.greenDim:e==='cerrada'?C.orangeDim:'rgba(100,100,130,0.1)';
  const estadoLabel      = (e:string)=>e==='abierta'?'ABIERTA':e==='cerrada'?'EN CURSO':'FINALIZADA';

  const datosIngresos = jornadas.map(j=>{
    const qJ = quinielas.filter(q=>q.jornada_id===j.id);
    const pagadasJ = qJ.filter(q=>q.estado_pago==='pagado');
    const pendientesJ = qJ.filter(q=>q.estado_pago!=='pagado');
    const recaudadoJ = pagadasJ.reduce((s,q)=>s+(q.monto_cobrado??0),0);
    const potencial = (j.precio??0)*pendientesJ.length;
    return {j,qJ,pagadasJ,pendientesJ,recaudadoJ,potencial};
  });
  const maxRecaudado = Math.max(...datosIngresos.map(d=>d.recaudadoJ),1);

  // ─── RENDER DETALLE JORNADA ───────────────────────────────────────────────
  const renderDetalleJornada = () => {
    if (!jornadaSel) return null;
    const j = jornadas.find(x=>x.id===jornadaSel.id)||jornadaSel;
    const pJ = partidos.filter(p=>p.jornada_id===j.id);
    const conRes = pJ.filter(p=>p.resultado_final).length;
    const isOpen = j.estado==='abierta';
    const isCerrada = j.estado==='cerrada';
    const syncing = !!syncingByJornada[j.id];
    const esBorrando = borrando===j.id;
    const eColor = estadoColor(j.estado);
    const eDim = estadoDim(j.estado);

    return (
      <View style={{flex:1}}>
        {/* Subheader */}
        <View style={[styles.detalleBanner, {backgroundColor: eDim, borderBottomColor: eColor+'30'}]}>
          <View style={{flex:1}}>
            <Text style={styles.detalleNombre} numberOfLines={2}>{j.nombre}</Text>
            <Text style={styles.detalleInfo}>{pJ.length} partidos  ·  {conRes}/{pJ.length} resultados</Text>
          </View>
          <View style={[styles.estadoPill, {backgroundColor: eColor+'20', borderColor: eColor}]}>
            <View style={[styles.estadoDot, {backgroundColor: eColor}]}/>
            <Text style={[styles.estadoPillTexto, {color: eColor}]}>{estadoLabel(j.estado)}</Text>
          </View>
        </View>

        {/* Acciones rápidas de esta jornada */}
        <View style={styles.detalleAcciones}>
          {isOpen && (
            <TouchableOpacity style={[styles.detalleBtn, {backgroundColor: C.orangeDim, borderColor: C.orange}]} onPress={()=>cerrarJornada(j)}>
              <Ionicons name="lock-closed" size={16} color={C.orange}/>
              <Text style={[styles.detalleBtnTexto, {color:C.orange}]}>Cerrar jornada</Text>
            </TouchableOpacity>
          )}
          {(isOpen||isCerrada) && j.api_competition_id && (
            <TouchableOpacity style={[styles.detalleBtn, {backgroundColor: C.accentDim, borderColor: C.accent}, syncing&&{opacity:0.5}]} onPress={()=>sincronizarResultados(j)} disabled={syncing}>
              {syncing
                ? <ActivityIndicator color={C.accent} size="small"/>
                : <><Ionicons name="sync" size={16} color={C.accent}/><Text style={[styles.detalleBtnTexto,{color:C.accent}]}>Sincronizar</Text></>
              }
            </TouchableOpacity>
          )}
          {isCerrada && (
            <TouchableOpacity style={[styles.detalleBtn, {backgroundColor: C.greenDim, borderColor: C.green}]} onPress={()=>finalizarJornada(j)}>
              <Ionicons name="checkmark-done" size={16} color={C.green}/>
              <Text style={[styles.detalleBtnTexto, {color:C.green}]}>Finalizar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.detalleBtn, {backgroundColor: C.redDim, borderColor: C.red}, esBorrando&&{opacity:0.5}]} onPress={()=>borrarJornada(j)} disabled={esBorrando}>
            {esBorrando
              ? <ActivityIndicator color={C.red} size="small"/>
              : <><Ionicons name="trash-outline" size={16} color={C.red}/><Text style={[styles.detalleBtnTexto,{color:C.red}]}>Borrar</Text></>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{padding:16, paddingBottom:60}}>
          {pJ.length===0 && (
            <View style={styles.emptyCard}>
              <Ionicons name="football-outline" size={36} color={C.textMuted}/>
              <Text style={styles.emptyTexto}>Sin partidos — importa desde la sección de Importar</Text>
            </View>
          )}
          {pJ.map(p=>{
            const fecha = new Date(p.fecha).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
            return (
              <View key={p.id} style={styles.partidoCard}>
                <View style={styles.partidoCardLeft}>
                  <Text style={styles.partidoNombres}>{p.local} <Text style={{color:C.textSub}}>vs</Text> {p.visitante}</Text>
                  <Text style={styles.partidoFecha}>{fecha}</Text>
                </View>
                {p.resultado_final
                  ? <View style={[styles.resBadge, {borderColor: C.green, backgroundColor: C.greenDim}]}>
                      <Text style={[styles.resTexto, {color: C.green}]}>{p.resultado_final}</Text>
                    </View>
                  : <TouchableOpacity style={styles.btnAgregarRes} onPress={()=>{ setPartidoSel(p); setResultadoInput(null); setModalResultado(true); }}>
                      <Ionicons name="add" size={14} color={C.accent}/>
                      <Text style={styles.btnAgregarResTexto}>Resultado</Text>
                    </TouchableOpacity>
                }
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ─── RENDER IMPORTAR ─────────────────────────────────────────────────────
  const renderImportar = () => (
    <ScrollView contentContainerStyle={{padding:16, paddingBottom:60}} keyboardShouldPersistTaps="handled">
      {/* Ligas rápidas */}
      <Text style={styles.sectionTitle}>⚡ Liga rápida</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:4,marginBottom:16}}>
        {LIGAS_POPULARES.map(l=>(
          <TouchableOpacity key={l.id} style={[styles.ligaChip, ligaId===l.id&&temporada===l.temporada&&styles.ligaChipActiva]} onPress={()=>{setLigaId(l.id);setTemporada(l.temporada);}} activeOpacity={0.7}>
            <Text style={[styles.ligaChipTexto, ligaId===l.id&&temporada===l.temporada&&{color:C.accent}]} numberOfLines={1}>{l.nombre}</Text>
            <Text style={styles.ligaChipSub}>{l.temporada}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputCard}>
        <Text style={styles.sectionTitle}>🔢 Liga y temporada</Text>
        <View style={{flexDirection:'row',gap:12}}>
          <View style={{flex:1}}><Text style={styles.label}>ID liga</Text><TextInput style={styles.input} value={ligaId} onChangeText={setLigaId} keyboardType="number-pad" placeholderTextColor={C.textMuted}/></View>
          <View style={{flex:1}}><Text style={styles.label}>Temporada</Text><TextInput style={styles.input} value={temporada} onChangeText={setTemporada} keyboardType="number-pad" placeholderTextColor={C.textMuted} maxLength={4}/></View>
        </View>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.sectionTitle}>📅 Buscar por</Text>
        <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
          {(['jornada','fecha','semana'] as const).map(m=>(
            <TouchableOpacity key={m} style={[styles.modoBtn, modoBusqueda===m&&styles.modoBtnActivo]} onPress={()=>setModoBusqueda(m)}>
              <Text style={[styles.modoBtnTexto, modoBusqueda===m&&{color:C.accent}]}>{m==='jornada'?'Jornada':m==='fecha'?'Día':'Semana'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {modoBusqueda==='jornada'&&<><Text style={styles.label}>Número de jornada</Text><TextInput style={styles.input} value={roundInput} onChangeText={setRoundInput} keyboardType="number-pad" placeholderTextColor={C.textMuted}/></>}
        {modoBusqueda==='fecha'&&<><Text style={styles.label}>Fecha (YYYY-MM-DD)</Text><TextInput style={styles.input} value={fechaBusqueda} onChangeText={setFechaBusqueda} placeholderTextColor={C.textMuted}/></>}
        {modoBusqueda==='semana'&&<><Text style={styles.label}>Desde</Text><TextInput style={styles.input} value={fechaDesde} onChangeText={setFechaDesde} placeholderTextColor={C.textMuted}/><Text style={styles.label}>Hasta</Text><TextInput style={styles.input} value={fechaHasta} onChangeText={setFechaHasta} placeholderTextColor={C.textMuted}/></>}
        <TouchableOpacity style={styles.btnPrimary} onPress={buscarFixtures} activeOpacity={0.8}>
          {loadingFix?<ActivityIndicator color="#fff" size="small"/>:<><Ionicons name="search" size={16} color="#fff"/><Text style={styles.btnPrimaryTexto}>Buscar partidos</Text></>}
        </TouchableOpacity>
      </View>

      {fixtures.length>0&&(
        <View style={styles.inputCard}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <Text style={styles.sectionTitle}>{fixtures.length} partidos — {seleccionados.size} sel.</Text>
            <TouchableOpacity onPress={()=>seleccionados.size===fixtures.length?setSeleccionados(new Set()):setSeleccionados(new Set(fixtures.map(f=>f.fixture.id)))}>
              <Text style={{color:C.accent,fontSize:13,fontWeight:'700'}}>{seleccionados.size===fixtures.length?'Quitar todos':'Seleccionar todos'}</Text>
            </TouchableOpacity>
          </View>
          {fixtures.map(f=>{
            const sel=seleccionados.has(f.fixture.id);
            return (
              <TouchableOpacity key={f.fixture.id} style={[styles.fixtureRow, sel&&styles.fixtureRowSel]} onPress={()=>{const s=new Set(seleccionados);s.has(f.fixture.id)?s.delete(f.fixture.id):s.add(f.fixture.id);setSeleccionados(s);}} activeOpacity={0.7}>
                <View style={[styles.checkbox, sel&&styles.checkboxSel]}>{sel&&<Ionicons name="checkmark" size={13} color="#fff"/>}</View>
                <View style={{flex:1,marginLeft:10}}>
                  <Text style={styles.fixtureEquipos}>{f.teams.home.name} vs {f.teams.away.name}</Text>
                  <Text style={styles.fixtureFecha}>{new Date(f.fixture.date).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Text>
                </View>
                <View style={[styles.statusBadge,{borderColor:statusColor(f.fixture.status.short)}]}>
                  <Text style={[styles.statusTexto,{color:statusColor(f.fixture.status.short)}]}>{f.fixture.status.short}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {seleccionados.size>0&&(
        <View style={styles.inputCard}>
          <Text style={styles.sectionTitle}>📦 Asignar a jornada</Text>
          {jornadas.filter(j=>j.estado==='abierta').length===0
            ?<Text style={{color:C.red,fontSize:13,marginBottom:8}}>⚠️ No hay jornadas abiertas.</Text>
            :jornadas.filter(j=>j.estado==='abierta').map(j=>(
              <TouchableOpacity key={j.id} style={[styles.jornadaOpcion, jornadaDestino===j.id&&styles.jornadaOpcionActiva]} onPress={()=>setJornadaDestino(j.id)}>
                <Text style={[styles.jornadaOpcionTexto, jornadaDestino===j.id&&{color:C.accent}]}>{j.nombre}</Text>
                {jornadaDestino===j.id&&<Ionicons name="checkmark-circle" size={18} color={C.accent}/>}
              </TouchableOpacity>
            ))
          }
          <TouchableOpacity style={[styles.btnPrimary,{backgroundColor:C.green},importando&&{opacity:0.6}]} onPress={importarPartidos} disabled={importando} activeOpacity={0.8}>
            {importando?<ActivityIndicator color="#fff"/>:<><Ionicons name="cloud-upload" size={18} color="#fff"/><Text style={styles.btnPrimaryTexto}>Importar {seleccionados.size} partidos</Text></>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  // ─── RENDER QUINIELAS ────────────────────────────────────────────────────
  const renderQuinielas = () => {
    const grouped = jornadas.map(j=>({ j, qs: quinielas.filter(q=>q.jornada_id===j.id) })).filter(g=>g.qs.length>0);
    return (
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:60}}>
        {grouped.length===0&&(
          <View style={styles.emptyCard}><Ionicons name="document-outline" size={36} color={C.textMuted}/><Text style={styles.emptyTexto}>No hay quinielas registradas.</Text></View>
        )}
        {grouped.map(({j,qs})=>(
          <View key={j.id} style={styles.grupCard}>
            <View style={styles.grupHeader}>
              <Text style={styles.grupNombre}>{j.nombre}</Text>
              <View style={{flexDirection:'row',gap:6}}>
                <Text style={[styles.grupBadge,{backgroundColor:C.greenDim,color:C.green}]}>{qs.filter(q=>q.estado_pago==='pagado').length} ✅</Text>
                <Text style={[styles.grupBadge,{backgroundColor:C.orangeDim,color:C.orange}]}>{qs.filter(q=>q.estado_pago!=='pagado').length} ⏳</Text>
              </View>
            </View>
            {qs.map(q=>(
              <View key={q.id} style={styles.quinielaRow}>
                <View style={{flex:1}}>
                  <Text style={styles.quinielaUser}>{(q.usuarios as any)?.username?`@${(q.usuarios as any).username}`:(q.usuarios as any)?.nombre||'Usuario'}</Text>
                  {q.codigo&&<Text style={styles.quinielaCodigo}>🎫 {q.codigo}</Text>}
                  {q.monto_cobrado!=null&&q.monto_cobrado>0&&<Text style={{color:C.gold,fontSize:11,marginTop:1}}>💵 ${q.monto_cobrado}</Text>}
                </View>
                {q.estado_pago!=='pagado'
                  ?<TouchableOpacity style={styles.btnPagarChico} onPress={()=>marcarPagado(q.id,j.id)}>
                     <Ionicons name="checkmark" size={13} color="#fff"/>
                     <Text style={styles.btnPagarChicoTexto}>Pagado</Text>
                   </TouchableOpacity>
                  :<TouchableOpacity style={[styles.btnPagarChico,{backgroundColor:C.orangeDim,borderWidth:1,borderColor:C.orange}]} onPress={()=>marcarPendiente(q.id)}>
                     <Text style={[styles.btnPagarChicoTexto,{color:C.orange}]}>Revertir</Text>
                   </TouchableOpacity>
                }
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  // ─── RENDER INGRESOS ─────────────────────────────────────────────────────
  const renderIngresos = () => {
    const potTotal = datosIngresos.reduce((s,d)=>s+d.potencial,0);
    return (
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:60}}>
        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard,{borderColor:C.gold+'50',backgroundColor:C.goldDim}]}>
            <Text style={[styles.kpiVal,{color:C.gold}]}>${recaudacionTotal.toFixed(0)}</Text>
            <Text style={styles.kpiLabel}>Recaudado</Text>
          </View>
          <View style={[styles.kpiCard,{borderColor:C.green+'50',backgroundColor:C.greenDim}]}>
            <Text style={[styles.kpiVal,{color:C.green}]}>{pagados}</Text>
            <Text style={styles.kpiLabel}>Pagados</Text>
          </View>
          <View style={[styles.kpiCard,{borderColor:C.orange+'50',backgroundColor:C.orangeDim}]}>
            <Text style={[styles.kpiVal,{color:C.orange}]}>{pendientes}</Text>
            <Text style={styles.kpiLabel}>Pendientes</Text>
          </View>
        </View>
        {potTotal>0&&(
          <View style={styles.potencialBanner}>
            <Ionicons name="trending-up" size={15} color={C.orange}/>
            <Text style={styles.potencialTexto}>Potencial pendiente: <Text style={{color:C.orange,fontWeight:'800'}}>${potTotal.toFixed(0)}</Text></Text>
          </View>
        )}
        {datosIngresos.map(({j,pagadasJ,pendientesJ,recaudadoJ,potencial})=>{
          const precio=j.precio??0;
          const isOpen=expandedJornada===j.id;
          return (
            <View key={j.id} style={styles.ingCard}>
              <TouchableOpacity style={styles.ingCardHeader} onPress={()=>setExpandedJornada(isOpen?null:j.id)} activeOpacity={0.8}>
                <View style={{flex:1}}>
                  <Text style={styles.ingCardNombre}>{j.nombre}</Text>
                  <Text style={styles.ingCardInfo}>{pagadasJ.length} pagadas · {pendientesJ.length} pendientes</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={[styles.ingCardMonto,{color:recaudadoJ>0?C.gold:C.textSub}]}>${recaudadoJ.toFixed(0)}</Text>
                  {precio>0&&<Text style={{color:C.textSub,fontSize:10}}>${precio}/c</Text>}
                </View>
                <Ionicons name={isOpen?'chevron-up':'chevron-down'} size={16} color={C.textSub} style={{marginLeft:10}}/>
              </TouchableOpacity>
              <PulseBar valor={recaudadoJ} max={maxRecaudado} color={recaudadoJ>0?C.gold:'#2a2a40'}/>
              <TouchableOpacity style={styles.btnPrecio} onPress={()=>{setJornadaPrecioSel(j);setPrecioInput(precio>0?String(precio):'');setModalPrecio(true);}} activeOpacity={0.8}>
                <Ionicons name="pricetag-outline" size={12} color={C.accent}/>
                <Text style={styles.btnPrecioTexto}>{precio>0?`Precio: $${precio} — cambiar`:'Configurar precio'}</Text>
              </TouchableOpacity>
              {isOpen&&(
                <View style={{marginTop:12}}>
                  <View style={{height:1,backgroundColor:C.cardBorder,marginBottom:12}}/>
                  {pendientesJ.length>0&&(
                    <>
                      <Text style={[styles.grupLabel,{color:C.orange}]}>⏳ Pendientes ({pendientesJ.length}){precio>0?` · $${potencial.toFixed(0)} potencial`:''}</Text>
                      {pendientesJ.map(q=>(
                        <View key={q.id} style={styles.quinielaRow}>
                          <View style={{flex:1}}>
                            <Text style={styles.quinielaUser}>{(q.usuarios as any)?.username?`@${(q.usuarios as any).username}`:(q.usuarios as any)?.nombre||'Usuario'}</Text>
                            {q.codigo&&<Text style={styles.quinielaCodigo}>🎫 {q.codigo}</Text>}
                          </View>
                          <TouchableOpacity style={styles.btnPagarChico} onPress={()=>marcarPagado(q.id,j.id)}>
                            <Ionicons name="checkmark" size={13} color="#fff"/>
                            <Text style={styles.btnPagarChicoTexto}>Pagado</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                  {pagadasJ.length>0&&(
                    <>
                      <Text style={[styles.grupLabel,{color:C.green,marginTop:pendientesJ.length>0?12:0}]}>✅ Pagadas ({pagadasJ.length}) · ${recaudadoJ.toFixed(0)}</Text>
                      {pagadasJ.map(q=>(
                        <View key={q.id} style={[styles.quinielaRow,{opacity:0.8}]}>
                          <View style={{flex:1}}>
                            <Text style={styles.quinielaUser}>{(q.usuarios as any)?.username?`@${(q.usuarios as any).username}`:(q.usuarios as any)?.nombre||'Usuario'}</Text>
                            {q.monto_cobrado!=null&&<Text style={{color:C.gold,fontSize:11}}>💵 ${q.monto_cobrado}</Text>}
                          </View>
                          <TouchableOpacity style={[styles.btnPagarChico,{backgroundColor:C.orangeDim,borderWidth:1,borderColor:C.orange}]} onPress={()=>marcarPendiente(q.id)}>
                            <Text style={[styles.btnPagarChicoTexto,{color:C.orange}]}>Revertir</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // ─── RENDER HOME ─────────────────────────────────────────────────────────
  const renderHome = () => (
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:80}} showsVerticalScrollIndicator={false}>

      {/* Stats row */}
      <View style={styles.statsGrid}>
        <StatChip icon="trophy" value={`$${recaudacionTotal.toFixed(0)}`} label="Recaudado" color={C.gold} dim={C.goldDim}/>
        <StatChip icon="checkmark-circle" value={String(pagados)} label="Pagados" color={C.green} dim={C.greenDim}/>
        <StatChip icon="time" value={String(pendientes)} label="Pendientes" color={C.orange} dim={C.orangeDim}/>
        <StatChip icon="layers" value={String(jornadas.length)} label="Jornadas" color={C.accent} dim={C.accentDim}/>
      </View>

      {/* Acciones rápidas */}
      <Text style={styles.sectionTitle}>Acciones rápidas</Text>
      <View style={styles.accionesGrid}>
        <AccionRapida icon="add-circle" label="Nueva jornada" color={C.accent} dim={C.accentDim} onPress={()=>setModalNueva(true)}/>
        <AccionRapida icon="cloud-download" label="Importar partidos" color={C.purple} dim={C.purpleDim} onPress={()=>setScreen('importar')}/>
        <AccionRapida icon="cash" label="Ingresos" color={C.gold} dim={C.goldDim} onPress={()=>setScreen('ingresos')}/>
        <AccionRapida icon="people" label="Quinielas" color={C.green} dim={C.greenDim} onPress={()=>setScreen('quinielas')}/>
      </View>

      {/* Alerta pagos pendientes */}
      {quinPendientes.length>0&&(
        <TouchableOpacity style={styles.alertaBanner} onPress={()=>setScreen('ingresos')} activeOpacity={0.8}>
          <View style={styles.alertaIconWrap}><Ionicons name="alert-circle" size={20} color={C.orange}/></View>
          <View style={{flex:1}}>
            <Text style={styles.alertaTitulo}>{quinPendientes.length} pago{quinPendientes.length!==1?'s':''} pendiente{quinPendientes.length!==1?'s':''}</Text>
            <Text style={styles.alertaSubtitulo}>Toca para ver y confirmar</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.orange}/>
        </TouchableOpacity>
      )}

      {/* Jornadas activas */}
      {jornadasActivas.length>0&&(
        <>
          <Text style={styles.sectionTitle}>Jornadas activas</Text>
          {jornadasActivas.map(j=>{
            const pJ=partidos.filter(p=>p.jornada_id===j.id);
            const conRes=pJ.filter(p=>p.resultado_final).length;
            const eColor=estadoColor(j.estado);
            const eDim=estadoDim(j.estado);
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            return (
              <TouchableOpacity key={j.id} style={[styles.jornadaCard,{borderLeftColor:eColor}]} onPress={()=>{setJornadaSel(j);setScreen('jornada_detalle');}} activeOpacity={0.8}>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4}}>
                    <View style={[styles.estadoPill,{backgroundColor:eDim,borderColor:eColor}]}>
                      <View style={[styles.estadoDot,{backgroundColor:eColor}]}/>
                      <Text style={[styles.estadoPillTexto,{color:eColor}]}>{estadoLabel(j.estado)}</Text>
                    </View>
                  </View>
                  <Text style={styles.jornadaNombre}>{j.nombre}</Text>
                  <View style={{flexDirection:'row',gap:12,marginTop:6}}>
                    <Text style={styles.jornadaMeta}><Text style={{color:C.text,fontWeight:'700'}}>{pJ.length}</Text> partidos</Text>
                    <Text style={styles.jornadaMeta}><Text style={{color:C.accent,fontWeight:'700'}}>{conRes}</Text>/{pJ.length} resultados</Text>
                    <Text style={styles.jornadaMeta}><Text style={{color:C.green,fontWeight:'700'}}>{qJ.length}</Text> quinielas</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textSub}/>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Jornadas finalizadas (acordeón) */}
      {jornadasFin.length>0&&(
        <>
          <Text style={[styles.sectionTitle,{marginTop:8}]}>Historial</Text>
          {jornadasFin.map(j=>{
            const pJ=partidos.filter(p=>p.jornada_id===j.id);
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            return (
              <TouchableOpacity key={j.id} style={styles.jornadaFinCard} onPress={()=>{setJornadaSel(j);setScreen('jornada_detalle');}} activeOpacity={0.8}>
                <View style={{flex:1}}>
                  <Text style={styles.jornadaFinNombre}>{j.nombre}</Text>
                  <Text style={styles.jornadaMeta}>{pJ.length} partidos · {qJ.length} quinielas</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted}/>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {jornadas.length===0&&(
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={40} color={C.textMuted}/>
          <Text style={styles.emptyTexto}>Sin jornadas. Crea una para empezar.</Text>
        </View>
      )}
    </ScrollView>
  );

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────
  const screenTitles: Record<Screen,string> = {
    home: '🛡️ Admin',
    jornada_detalle: jornadaSel?.nombre||'Jornada',
    importar: '📡 Importar partidos',
    quinielas: '📋 Quinielas',
    ingresos: '💰 Ingresos',
  };
  const isHome = screen==='home';

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* ── HEADER ── */}
      <View style={[styles.header, {paddingTop: insets.top+14}]}>
        {!isHome
          ? <TouchableOpacity onPress={()=>setScreen('home')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={C.text}/>
            </TouchableOpacity>
          : <TouchableOpacity onPress={()=>router.back()} style={styles.backBtn}>
              <Ionicons name="close" size={20} color={C.text}/>
            </TouchableOpacity>
        }
        <Text style={styles.headerTitle} numberOfLines={1}>{screenTitles[screen]}</Text>
        {/* Botón contextual derecho */}
        {screen==='home'&&(
          <TouchableOpacity style={styles.headerActionBtn} onPress={()=>setModalNueva(true)}>
            <Ionicons name="add" size={20} color={C.accent}/>
          </TouchableOpacity>
        )}
        {screen==='jornada_detalle'&&(
          <TouchableOpacity style={styles.headerActionBtn} onPress={()=>setScreen('importar')}>
            <Ionicons name="cloud-download-outline" size={20} color={C.accent}/>
          </TouchableOpacity>
        )}
        {screen!=='home'&&screen!=='jornada_detalle'&&<View style={{width:36}}/>}
      </View>

      {/* ── CONTENT ── */}
      <View style={{flex:1}}>
        {screen==='home'          && renderHome()}
        {screen==='jornada_detalle' && renderDetalleJornada()}
        {screen==='importar'      && renderImportar()}
        {screen==='quinielas'     && renderQuinielas()}
        {screen==='ingresos'      && renderIngresos()}
      </View>

      {/* ── BOTTOM NAV (solo en home) ── */}
      {isHome&&(
        <View style={[styles.bottomNav, {paddingBottom: insets.bottom+6}]}>
          {([
            {s:'home' as Screen, icon:'home', label:'Inicio'},
            {s:'importar' as Screen, icon:'cloud-download-outline', label:'Importar'},
            {s:'quinielas' as Screen, icon:'list-outline', label:'Quinielas'},
            {s:'ingresos' as Screen, icon:'cash-outline', label:'Ingresos'},
          ] as {s:Screen;icon:string;label:string}[]).map(({s,icon,label})=>(
            <TouchableOpacity key={s} style={styles.navItem} onPress={()=>setScreen(s)} activeOpacity={0.7}>
              <Ionicons name={icon as any} size={22} color={screen===s?C.accent:C.textSub}/>
              <Text style={[styles.navLabel,{color:screen===s?C.accent:C.textSub}]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── MODALES ── */}
      <Modal visible={modalNueva} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>Nueva jornada</Text>
              <Text style={styles.label}>Nombre</Text>
              <TextInput style={styles.input} value={nombreJornada} onChangeText={setNombreJornada} placeholder="Ej: Jornada 1 · Copa Mundial" placeholderTextColor={C.textMuted} autoFocus/>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnSecundario} onPress={()=>setModalNueva(false)}><Text style={styles.btnSecundarioTexto}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary,{flex:1},saving&&{opacity:0.6}]} onPress={crearJornada} disabled={saving}>
                  {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnPrimaryTexto}>Crear</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalResultado} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Resultado manual</Text>
            <Text style={styles.modalSubtitulo}>{partidoSel?.local} vs {partidoSel?.visitante}</Text>
            <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
              {(['1','X','2'] as const).map(op=>(
                <TouchableOpacity key={op} style={[styles.resOpcion, resultadoInput===op&&styles.resOpcionActiva]} onPress={()=>setResultadoInput(op)}>
                  <Text style={[styles.resOpcionTexto, resultadoInput===op&&{color:C.accent}]}>
                    {op==='1'?`1\n${partidoSel?.local.slice(0,8)}`:op==='X'?'X\nEmpate':`2\n${partidoSel?.visitante.slice(0,8)}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnSecundario} onPress={()=>setModalResultado(false)}><Text style={styles.btnSecundarioTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary,{flex:1},(!resultadoInput||saving)&&{opacity:0.4}]} onPress={guardarResultado} disabled={!resultadoInput||saving}>
                {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnPrimaryTexto}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalPrecio} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>💲 Precio de quiniela</Text>
              <Text style={styles.modalSubtitulo}>{jornadaPrecioSel?.nombre}</Text>
              <Text style={styles.label}>Precio por quiniela (MXN)</Text>
              <TextInput style={styles.input} value={precioInput} onChangeText={setPrecioInput} keyboardType="decimal-pad" placeholder="Ej: 50" placeholderTextColor={C.textMuted} autoFocus/>
              <Text style={{color:C.textSub,fontSize:11,marginBottom:14}}>Este precio se usará al cobrar vía Mercado Pago.</Text>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.btnSecundario} onPress={()=>setModalPrecio(false)}><Text style={styles.btnSecundarioTexto}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnPrimary,{flex:1},savingPrecio&&{opacity:0.6}]} onPress={guardarPrecio} disabled={savingPrecio}>
                  {savingPrecio?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnPrimaryTexto}>Guardar</Text>}
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
  root: { flex:1, backgroundColor:C.bg },
  center: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:C.bg },

  // Header
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:16, backgroundColor:C.bg },
  backBtn: { width:36, height:36, borderRadius:10, backgroundColor:C.card, justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:C.cardBorder },
  headerTitle: { flex:1, color:C.text, fontSize:17, fontWeight:'bold', textAlign:'center', marginHorizontal:8 },
  headerActionBtn: { width:36, height:36, borderRadius:10, backgroundColor:C.accentDim, justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:C.accent+'50' },

  // Stats
  statsGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:22 },
  statChip: { width:(SW-42)/2, borderRadius:14, padding:14, borderWidth:1.5, gap:4 },
  statChipVal: { fontSize:22, fontWeight:'900' },
  statChipLabel: { color:C.textSub, fontSize:11, fontWeight:'600' },

  // Acciones rápidas
  accionesGrid: { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:22 },
  accionRapida: { width:(SW-42)/2, borderRadius:14, padding:16, borderWidth:1.5, gap:10, flexDirection:'row', alignItems:'center' },
  accionIcon: { width:40, height:40, borderRadius:10, justifyContent:'center', alignItems:'center' },
  accionLabel: { fontSize:13, fontWeight:'700', flex:1 },

  // Alerta
  alertaBanner: { flexDirection:'row', alignItems:'center', backgroundColor:C.orangeDim, borderWidth:1.5, borderColor:C.orange+'60', borderRadius:14, padding:14, marginBottom:22, gap:12 },
  alertaIconWrap: { width:36, height:36, borderRadius:10, backgroundColor:C.orange+'20', justifyContent:'center', alignItems:'center' },
  alertaTitulo: { color:C.orange, fontWeight:'800', fontSize:14 },
  alertaSubtitulo: { color:C.textSub, fontSize:12, marginTop:1 },

  sectionTitle: { color:C.text, fontWeight:'800', fontSize:14, marginBottom:12, letterSpacing:0.2 },

  // Jornada cards (home)
  jornadaCard: { backgroundColor:C.card, borderRadius:14, padding:16, marginBottom:10, borderWidth:1, borderColor:C.cardBorder, flexDirection:'row', alignItems:'center', borderLeftWidth:4 },
  jornadaNombre: { color:C.text, fontWeight:'bold', fontSize:15 },
  jornadaMeta: { color:C.textSub, fontSize:12 },
  jornadaFinCard: { backgroundColor:C.card, borderRadius:12, padding:14, marginBottom:8, borderWidth:1, borderColor:C.cardBorder, flexDirection:'row', alignItems:'center', opacity:0.7 },
  jornadaFinNombre: { color:C.text, fontWeight:'600', fontSize:13 },

  // Estado pill
  estadoPill: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:8, paddingVertical:3, borderRadius:20, borderWidth:1 },
  estadoDot: { width:6, height:6, borderRadius:3 },
  estadoPillTexto: { fontSize:10, fontWeight:'800', letterSpacing:0.5 },

  // Detalle jornada
  detalleBanner: { paddingHorizontal:16, paddingVertical:14, flexDirection:'row', alignItems:'center', gap:12, borderBottomWidth:1 },
  detalleNombre: { color:C.text, fontWeight:'bold', fontSize:16 },
  detalleInfo: { color:C.textSub, fontSize:11, marginTop:3 },
  detalleAcciones: { flexDirection:'row', flexWrap:'wrap', gap:8, padding:16, borderBottomWidth:1, borderBottomColor:C.cardBorder },
  detalleBtn: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:9, borderRadius:10, borderWidth:1.5 },
  detalleBtnTexto: { fontSize:13, fontWeight:'700' },

  // Partido card
  partidoCard: { backgroundColor:C.card, borderRadius:12, padding:14, marginBottom:8, borderWidth:1, borderColor:C.cardBorder, flexDirection:'row', alignItems:'center' },
  partidoCardLeft: { flex:1 },
  partidoNombres: { color:C.text, fontWeight:'600', fontSize:13 },
  partidoFecha: { color:C.textSub, fontSize:11, marginTop:3 },
  resBadge: { borderRadius:8, paddingHorizontal:10, paddingVertical:6, borderWidth:1.5 },
  resTexto: { fontWeight:'900', fontSize:15 },
  btnAgregarRes: { flexDirection:'row', alignItems:'center', gap:4, borderWidth:1, borderColor:C.accent+'60', borderRadius:8, paddingHorizontal:10, paddingVertical:6, backgroundColor:C.accentDim },
  btnAgregarResTexto: { color:C.accent, fontSize:12, fontWeight:'700' },

  // Importar
  inputCard: { backgroundColor:C.card, borderRadius:14, padding:16, marginBottom:14, borderWidth:1, borderColor:C.cardBorder },
  ligaChip: { borderWidth:1.5, borderColor:C.cardBorder, borderRadius:10, paddingHorizontal:12, paddingVertical:8, backgroundColor:C.bg, minWidth:110, alignItems:'center' },
  ligaChipActiva: { borderColor:C.accent, backgroundColor:C.accentDim },
  ligaChipTexto: { color:C.textSub, fontSize:12, fontWeight:'700' },
  ligaChipSub: { color:C.textSub, fontSize:10, marginTop:2, opacity:0.7 },
  modoBtn: { flex:1, padding:9, borderRadius:10, borderWidth:1.5, borderColor:C.cardBorder, alignItems:'center' },
  modoBtnActivo: { borderColor:C.accent, backgroundColor:C.accentDim },
  modoBtnTexto: { color:C.textSub, fontWeight:'600', fontSize:12 },
  fixtureRow: { flexDirection:'row', alignItems:'center', padding:11, borderRadius:10, marginBottom:6, borderWidth:1.5, borderColor:C.cardBorder, backgroundColor:C.bg },
  fixtureRowSel: { borderColor:C.accent, backgroundColor:C.accentDim },
  checkbox: { width:22, height:22, borderRadius:6, borderWidth:2, borderColor:C.textSub, justifyContent:'center', alignItems:'center' },
  checkboxSel: { backgroundColor:C.accent, borderColor:C.accent },
  fixtureEquipos: { color:C.text, fontWeight:'600', fontSize:13 },
  fixtureFecha: { color:C.textSub, fontSize:11, marginTop:2 },
  statusBadge: { borderWidth:1.5, borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  statusTexto: { fontSize:10, fontWeight:'700' },
  jornadaOpcion: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:12, borderRadius:10, borderWidth:1.5, borderColor:C.cardBorder, marginBottom:6, backgroundColor:C.bg },
  jornadaOpcionActiva: { borderColor:C.accent, backgroundColor:C.accentDim },
  jornadaOpcionTexto: { color:C.textSub, fontWeight:'600', fontSize:13 },

  // Quinielas
  grupCard: { backgroundColor:C.card, borderRadius:14, padding:16, marginBottom:12, borderWidth:1, borderColor:C.cardBorder },
  grupHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  grupNombre: { color:C.text, fontWeight:'bold', fontSize:14, flex:1 },
  grupBadge: { paddingHorizontal:8, paddingVertical:3, borderRadius:8, fontSize:11, fontWeight:'700', overflow:'hidden' },
  quinielaRow: { flexDirection:'row', alignItems:'center', paddingVertical:9, borderTopWidth:1, borderTopColor:C.cardBorder },
  quinielaUser: { color:C.text, fontSize:13, fontWeight:'600' },
  quinielaCodigo: { color:C.textSub, fontSize:11, marginTop:1 },
  btnPagarChico: { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:C.green, paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  btnPagarChicoTexto: { color:'#fff', fontSize:11, fontWeight:'700' },

  // Ingresos
  kpiRow: { flexDirection:'row', gap:10, marginBottom:14 },
  kpiCard: { flex:1, borderRadius:14, padding:12, alignItems:'center', borderWidth:1.5, gap:2 },
  kpiVal: { fontSize:20, fontWeight:'900' },
  kpiLabel: { color:C.textSub, fontSize:10, fontWeight:'600' },
  potencialBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.orangeDim, borderWidth:1, borderColor:C.orange+'40', borderRadius:10, padding:12, marginBottom:14 },
  potencialTexto: { color:C.textSub, fontSize:13 },
  ingCard: { backgroundColor:C.card, borderRadius:14, padding:16, marginBottom:12, borderWidth:1, borderColor:C.cardBorder },
  ingCardHeader: { flexDirection:'row', alignItems:'center' },
  ingCardNombre: { color:C.text, fontWeight:'bold', fontSize:14 },
  ingCardInfo: { color:C.textSub, fontSize:11, marginTop:2 },
  ingCardMonto: { fontSize:18, fontWeight:'900' },
  btnPrecio: { flexDirection:'row', alignItems:'center', gap:5, marginTop:10, alignSelf:'flex-start', backgroundColor:C.accentDim, borderWidth:1, borderColor:C.accent+'50', borderRadius:8, paddingHorizontal:10, paddingVertical:5 },
  btnPrecioTexto: { color:C.accent, fontSize:11, fontWeight:'700' },
  grupLabel: { fontSize:12, fontWeight:'700', marginBottom:6 },

  // Shared
  label: { fontSize:12, fontWeight:'600', color:C.textSub, marginBottom:5, marginTop:4 },
  input: { borderWidth:1.5, borderColor:C.cardBorder, borderRadius:10, padding:12, marginBottom:8, fontSize:14, color:C.text, backgroundColor:C.bg },
  btnPrimary: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:C.accent, padding:13, borderRadius:12 },
  btnPrimaryTexto: { color:'#fff', fontWeight:'bold', fontSize:14 },
  btnSecundario: { flex:1, padding:14, borderRadius:12, borderWidth:1.5, borderColor:C.cardBorder, alignItems:'center' },
  btnSecundarioTexto: { color:C.textSub, fontWeight:'600' },
  emptyCard: { alignItems:'center', paddingVertical:50, gap:12 },
  emptyTexto: { color:C.textSub, fontSize:13, textAlign:'center', maxWidth:220 },

  // Bottom nav
  bottomNav: { flexDirection:'row', backgroundColor:C.card, borderTopWidth:1, borderTopColor:C.cardBorder, paddingTop:10 },
  navItem: { flex:1, alignItems:'center', gap:3 },
  navLabel: { fontSize:10, fontWeight:'600' },

  // Modal
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.75)', justifyContent:'flex-end' },
  modalCard: { backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:34, borderTopWidth:1, borderColor:C.cardBorder },
  modalTitulo: { fontSize:18, fontWeight:'bold', color:C.text, marginBottom:4 },
  modalSubtitulo: { fontSize:13, color:C.textSub, marginBottom:16 },
  modalBtns: { flexDirection:'row', gap:10, marginTop:4 },
  resOpcion: { flex:1, borderWidth:2, borderColor:C.cardBorder, borderRadius:12, padding:14, alignItems:'center', backgroundColor:C.bg },
  resOpcionActiva: { borderColor:C.accent, backgroundColor:C.accentDim },
  resOpcionTexto: { fontSize:13, color:C.textSub, textAlign:'center', fontWeight:'600' },
});
