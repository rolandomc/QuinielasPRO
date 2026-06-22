import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl, StatusBar, Platform, Animated, TextInput,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b', gold:'#ffd700', goldDim:'rgba(255,215,0,0.1)' };

type Partido    = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean };
type Jornada    = { id:string; nombre:string; estado:string; precio?:number|null; porcentaje_organizador?:number|null; bolsa_total?:number|null };
type QuinielaDB = { id:string; estado_pago:string; jornada_id:string };
type Resultado  = '1'|'X'|'2';
type Marcador   = { local: string; visitante: string };

// ─── Hook generico de cuenta regresiva ──────────────────────────────────────────────
function useCountdown(fechaISO: string) {
  const calcDiff = () => Math.max(0, new Date(fechaISO).getTime() - Date.now());
  const [ms, setMs] = useState(calcDiff);
  const ref = useRef<any>(null);
  useEffect(() => {
    ref.current = setInterval(() => setMs(calcDiff()), 1000);
    return () => clearInterval(ref.current);
  }, [fechaISO]);
  const total = ms;
  const d = Math.floor(total / 86400000);
  const h = Math.floor((total % 86400000) / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  return { total, d, h, m, s };
}

// Cuenta regresiva pequeña para cada tarjeta de partido
function Countdown({ fecha }: { fecha: string }) {
  const { total, d, h, m, s } = useCountdown(fecha);
  if (total <= 0) return null;
  const urgente = total < 3600000;
  const texto = d > 0 ? `Inicia en ${d}d ${h}h ${m}m` : h > 0 ? `Inicia en ${h}h ${m}m ${s}s` : `Inicia en ${m}m ${s}s`;
  return (
    <View style={[cdStyles.wrap, urgente && cdStyles.wrapUrgente]}>
      <Ionicons name="time-outline" size={12} color={urgente ? C.orange : C.accent} />
      <Text style={[cdStyles.texto, urgente && cdStyles.textoUrgente]}>{texto}</Text>
    </View>
  );
}
const cdStyles = StyleSheet.create({
  wrap:{ flexDirection:'row', alignItems:'center', gap:4, alignSelf:'center', marginTop:4, marginBottom:2, backgroundColor:'rgba(0,180,216,0.08)', borderRadius:8, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:'rgba(0,180,216,0.2)' },
  wrapUrgente:{ backgroundColor:'rgba(255,159,67,0.1)', borderColor:'rgba(255,159,67,0.35)' },
  texto:{ color:C.accent, fontSize:11, fontWeight:'700' },
  textoUrgente:{ color:C.orange },
});

// ─── Banner grande de cuenta regresiva al cierre ─────────────────────────────────
function BannerCierre({ fechaPrimerPartido, yaGuardo }: { fechaPrimerPartido: string; yaGuardo: boolean }) {
  const { total, d, h, m, s } = useCountdown(fechaPrimerPartido);

  // Si ya cerró (tiempo = 0) o ya guardó, no mostrar
  if (total <= 0 || yaGuardo) return null;

  const critico  = total < 3600000;          // menos de 1 hora
  const urgente  = total < 10800000;         // menos de 3 horas
  const dias     = d > 0;

  const bloques = dias
    ? [
        { valor: String(d).padStart(2,'0'), label: 'DÍAS' },
        { valor: String(h).padStart(2,'0'), label: 'HRS' },
        { valor: String(m).padStart(2,'0'), label: 'MIN' },
      ]
    : [
        { valor: String(h).padStart(2,'0'), label: 'HRS' },
        { valor: String(m).padStart(2,'0'), label: 'MIN' },
        { valor: String(s).padStart(2,'0'), label: 'SEG' },
      ];

  const bgColor   = critico  ? 'rgba(255,107,107,0.12)'
                 : urgente   ? 'rgba(255,159,67,0.10)'
                 :             'rgba(0,180,216,0.08)';
  const bdColor   = critico  ? C.red
                 : urgente   ? C.orange
                 :             C.accent;
  const iconColor = critico ? C.red : urgente ? C.orange : C.accent;
  const numColor  = critico ? C.red : urgente ? C.orange : C.text;

  return (
    <View style={[bannerStyles.wrap, { backgroundColor: bgColor, borderColor: bdColor }]}>
      <View style={bannerStyles.topRow}>
        <Ionicons name={critico ? 'warning' : 'timer-outline'} size={16} color={iconColor} />
        <Text style={[bannerStyles.titulo, { color: iconColor }]}>
          {critico ? '⚠️ ¡Última hora! La quiniela cierra pronto'
          : urgente ? '⏰ La quiniela cierra en menos de 3 horas'
          :           '📅 Tiempo restante para registrar tu quiniela'}
        </Text>
      </View>
      <View style={bannerStyles.bloquesRow}>
        {bloques.map((b, i) => (
          <React.Fragment key={b.label}>
            <View style={bannerStyles.bloque}>
              <Text style={[bannerStyles.numero, { color: numColor }]}>{b.valor}</Text>
              <Text style={[bannerStyles.label, { color: iconColor }]}>{b.label}</Text>
            </View>
            {i < bloques.length - 1 && (
              <Text style={[bannerStyles.separador, { color: numColor }]}>:</Text>
            )}
          </React.Fragment>
        ))}
      </View>
      <Text style={[bannerStyles.subtexto, { color: iconColor + 'cc' }]}>
        Una vez que inicie el primer partido ya no podrás modificar tus selecciones.
      </Text>
    </View>
  );
}
const bannerStyles = StyleSheet.create({
  wrap: { marginHorizontal:16, marginBottom:14, borderRadius:16, borderWidth:1.5, padding:16 },
  topRow: { flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  titulo: { fontSize:13, fontWeight:'800', flex:1, lineHeight:18 },
  bloquesRow: { flexDirection:'row', justifyContent:'center', alignItems:'center', gap:4, marginBottom:10 },
  bloque: { alignItems:'center', minWidth:56, backgroundColor:'rgba(0,0,0,0.25)', borderRadius:10, paddingVertical:8, paddingHorizontal:10 },
  numero: { fontSize:34, fontWeight:'900', letterSpacing:1 },
  label: { fontSize:9, fontWeight:'800', letterSpacing:1.5, marginTop:2 },
  separador: { fontSize:28, fontWeight:'900', marginBottom:8 },
  subtexto: { fontSize:11, textAlign:'center', lineHeight:16 },
});

// ─── Confetti ─────────────────────────────────────────────────────────────────
const COLORES_CONFETTI = ['#00b4d8','#00c897','#ffd700','#ff9f43','#ff6b6b','#9b59b6','#f0f0ff'];
const N_CONFETTI = 22;
function ConfettiPieza({ delay, color }: { delay: number; color: string }) {
  const y = useRef(new Animated.Value(-20)).current;
  const x = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const startX = (Math.random() - 0.5) * 320;
  const endX = startX + (Math.random() - 0.5) * 100;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(y, { toValue: 580, duration: 1800, useNativeDriver: true }),
        Animated.timing(x, { toValue: endX - startX, duration: 1800, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 1800, delay: 1000, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 8, duration: 1800, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 8], outputRange: ['0deg', '720deg'] });
  return (
    <Animated.View style={[
      confettiStyles.pieza,
      { backgroundColor: color, opacity: op, transform: [{ translateY: y }, { translateX: x }, { rotate }], left: '50%', marginLeft: startX },
    ]} />
  );
}
function Confetti({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {Array.from({ length: N_CONFETTI }).map((_, i) => (
        <ConfettiPieza key={i} delay={Math.random() * 400} color={COLORES_CONFETTI[i % COLORES_CONFETTI.length]} />
      ))}
    </View>
  );
}
const confettiStyles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 999, pointerEvents: 'none' },
  pieza: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 2 },
});

// ─── Selector de jornadas ─────────────────────────────────────────────────────
function SelectorQuinielas({
  jornadas, seleccionada, onSeleccionar, quinielasUsuario,
}: {
  jornadas: Jornada[]; seleccionada: Jornada | null;
  onSeleccionar: (j: Jornada) => void; quinielasUsuario: QuinielaDB[];
}) {
  if (jornadas.length <= 1) return null;
  return (
    <View style={selectorStyles.wrap}>
      <View style={selectorStyles.headerRow}>
        <Ionicons name="layers" size={14} color={C.accent} />
        <Text style={selectorStyles.titulo}>Quinielas disponibles</Text>
        <View style={selectorStyles.countBadge}>
          <Text style={selectorStyles.countTexto}>{jornadas.length}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
        {jornadas.map(j => {
          const activa = seleccionada?.id === j.id;
          const quiniela = quinielasUsuario.find(q => q.jornada_id === j.id);
          const pagada = quiniela?.estado_pago === 'pagado';
          const pendiente = quiniela && !pagada;
          return (
            <TouchableOpacity key={j.id} style={[selectorStyles.chip, activa && selectorStyles.chipActivo]} onPress={() => onSeleccionar(j)} activeOpacity={0.75}>
              {pagada    && <Ionicons name="checkmark-circle" size={13} color={C.green} />}
              {pendiente && <Ionicons name="time" size={13} color={C.orange} />}
              {!quiniela && <Ionicons name="ellipse-outline" size={13} color={activa ? C.accent : C.textSub} />}
              <Text style={[selectorStyles.chipTexto, activa && selectorStyles.chipTextoActivo]} numberOfLines={1}>{j.nombre}</Text>
              {j.precio != null && j.precio > 0 && (
                <View style={selectorStyles.chipPrecio}>
                  <Text style={selectorStyles.chipPrecioTexto}>${j.precio}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
const selectorStyles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.cardBorder },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  titulo: { color: C.text, fontWeight: '800', fontSize: 14, flex: 1 },
  countBadge: { backgroundColor: C.accentDim, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.accent + '40' },
  countTexto: { color: C.accent, fontSize: 11, fontWeight: '800' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.bg, maxWidth: 200 },
  chipActivo: { borderColor: C.accent, backgroundColor: C.accentDim },
  chipTexto: { color: C.textSub, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  chipTextoActivo: { color: C.accent },
  chipPrecio: { backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  chipPrecioTexto: { color: C.gold, fontSize: 10, fontWeight: '800' },
});

// ─── Input marcador ───────────────────────────────────────────────────────────
function InputMarcador({
  partido, marcador, onChange, disabled,
}: {
  partido: Partido; marcador: Marcador; onChange: (m: Marcador) => void; disabled: boolean;
}) {
  return (
    <View style={marcadorStyles.wrap}>
      <Ionicons name="football-outline" size={12} color={C.textSub} />
      <Text style={marcadorStyles.label}>Marcador pronosticado</Text>
      <View style={marcadorStyles.inputs}>
        <TextInput
          style={[marcadorStyles.input, disabled && marcadorStyles.inputDisabled]}
          value={marcador.local}
          onChangeText={v => onChange({ ...marcador, local: v.replace(/[^0-9]/g, '').slice(0, 2) })}
          keyboardType="number-pad" maxLength={2} placeholder="0"
          placeholderTextColor={C.textSub} editable={!disabled} selectTextOnFocus
        />
        <Text style={marcadorStyles.separador}>-</Text>
        <TextInput
          style={[marcadorStyles.input, disabled && marcadorStyles.inputDisabled]}
          value={marcador.visitante}
          onChangeText={v => onChange({ ...marcador, visitante: v.replace(/[^0-9]/g, '').slice(0, 2) })}
          keyboardType="number-pad" maxLength={2} placeholder="0"
          placeholderTextColor={C.textSub} editable={!disabled} selectTextOnFocus
        />
      </View>
    </View>
  );
}
const marcadorStyles = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:8, marginTop:10, paddingTop:10, borderTopWidth:1, borderTopColor:'#1e1e35' },
  label: { color:C.textSub, fontSize:11, flex:1 },
  inputs: { flexDirection:'row', alignItems:'center', gap:6 },
  input: { width:38, height:34, borderWidth:1.5, borderColor:C.accent, borderRadius:8, textAlign:'center', color:C.text, fontSize:16, fontWeight:'700', backgroundColor:'rgba(0,180,216,0.07)' },
  inputDisabled: { borderColor:C.cardBorder, color:C.textSub, backgroundColor:'transparent' },
  separador: { color:C.text, fontWeight:'900', fontSize:18 },
});

// ─── Screen principal ─────────────────────────────────────────────────────────
export default function QuinielaScreen() {
  const { user, usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [jornadasAbiertas, setJornadasAbiertas] = useState<Jornada[]>([]);
  const [jornada, setJornada]                   = useState<Jornada | null>(null);
  const [partidos, setPartidos]                 = useState<Partido[]>([]);
  const [predicciones, setPredicciones]         = useState<Record<string, Resultado>>({});
  const [marcadores, setMarcadores]             = useState<Record<string, Marcador>>({});
  const [quiniela, setQuiniela]                 = useState<QuinielaDB | null>(null);
  const [quinielasUsuario, setQuinielasUsuario] = useState<QuinielaDB[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [loadingPago, setLoadingPago]           = useState(false);
  const [showConfetti, setShowConfetti]         = useState(false);
  const [pagoRecienConfirmado, setPagoRecienConfirmado] = useState(false);

  const cargaInicialHecha = useRef(false);
  const prevEstadoRef     = useRef<string | null>(null);

  // Fecha del primer partido (para el banner de cierre)
  const fechaPrimerPartido = partidos.length > 0
    ? partidos.reduce((min, p) => p.fecha < min ? p.fecha : min, partidos[0].fecha)
    : null;

  const cargarJornada = useCallback(async (
    j: Jornada,
    opciones?: { forzarPredicciones?: boolean }
  ) => {
    if (!user) return;
    const { data: pData } = await supabase
      .from('partidos').select('*').eq('jornada_id', j.id).order('fecha');
    setPartidos(pData || []);

    const { data: qData } = await supabase
      .from('quinielas').select('id,estado_pago,jornada_id')
      .eq('usuario_id', user.id).eq('jornada_id', j.id).maybeSingle();

    if (qData && prevEstadoRef.current === 'pendiente' && qData.estado_pago === 'pagado') {
      setPagoRecienConfirmado(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      setTimeout(() => setPagoRecienConfirmado(false), 6000);
    }
    prevEstadoRef.current = qData?.estado_pago ?? null;
    setQuiniela(qData);

    if ((qData && pData) || opciones?.forzarPredicciones) {
      if (pData && pData.length > 0) {
        const { data: predData } = await supabase
          .from('predicciones').select('partido_id,resultado,goles_local,goles_visitante')
          .eq('usuario_id', user.id).in('partido_id', pData.map(p => p.id));
        const mapRes: Record<string, Resultado> = {};
        const mapMarcador: Record<string, Marcador> = {};
        (predData || []).forEach(p => {
          mapRes[p.partido_id] = p.resultado as Resultado;
          mapMarcador[p.partido_id] = {
            local:     p.goles_local    != null ? String(p.goles_local)    : '',
            visitante: p.goles_visitante != null ? String(p.goles_visitante) : '',
          };
        });
        setPredicciones(mapRes);
        setMarcadores(mapMarcador);
      }
    }
  }, [user]);

  const cargarInicial = useCallback(async () => {
    if (!user) return;
    const { data: jData } = await supabase
      .from('jornadas').select('id,nombre,estado,precio,porcentaje_organizador,bolsa_total')
      .eq('estado', 'abierta').order('creado_at', { ascending: false });
    const lista: Jornada[] = jData || [];
    setJornadasAbiertas(lista);

    const { data: qAll } = await supabase
      .from('quinielas').select('id,estado_pago,jornada_id').eq('usuario_id', user.id);
    setQuinielasUsuario(qAll || []);

    if (lista.length > 0) {
      setJornada(lista[0]);
      await cargarJornada(lista[0], { forzarPredicciones: true });
    } else {
      setJornada(null); setPartidos([]); setQuiniela(null);
    }
  }, [user, cargarJornada]);

  const refrescarSinBorrar = useCallback(async () => {
    if (!user) return;
    const { data: jData } = await supabase
      .from('jornadas').select('id,nombre,estado,precio,porcentaje_organizador,bolsa_total')
      .eq('estado', 'abierta').order('creado_at', { ascending: false });
    const lista: Jornada[] = jData || [];
    setJornadasAbiertas(lista);

    const { data: qAll } = await supabase
      .from('quinielas').select('id,estado_pago,jornada_id').eq('usuario_id', user.id);
    setQuinielasUsuario(qAll || []);

    if (jornada) {
      const jActualizada = lista.find(j => j.id === jornada.id);
      if (jActualizada) {
        setJornada(jActualizada);
        const { data: qData } = await supabase
          .from('quinielas').select('id,estado_pago,jornada_id')
          .eq('usuario_id', user.id).eq('jornada_id', jActualizada.id).maybeSingle();
        if (qData && prevEstadoRef.current === 'pendiente' && qData.estado_pago === 'pagado') {
          setPagoRecienConfirmado(true);
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 2500);
          setTimeout(() => setPagoRecienConfirmado(false), 6000);
        }
        prevEstadoRef.current = qData?.estado_pago ?? null;
        setQuiniela(qData);
      }
    }
  }, [user, jornada]);

  useEffect(() => {
    if (!user || cargaInicialHecha.current) return;
    cargaInicialHecha.current = true;
    setLoading(true);
    cargarInicial().finally(() => setLoading(false));
  }, [user, cargarInicial]);

  useFocusEffect(
    useCallback(() => {
      if (!cargaInicialHecha.current) return;
      refrescarSinBorrar();
    }, [refrescarSinBorrar])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refrescarSinBorrar();
    setRefreshing(false);
  }, [refrescarSinBorrar]);

  const seleccionarJornada = useCallback(async (j: Jornada) => {
    setJornada(j);
    setPartidos([]);
    setPredicciones({});
    setMarcadores({});
    setQuiniela(null);
    await cargarJornada(j, { forzarPredicciones: true });
  }, [cargarJornada]);

  const seleccionar = (id: string, r: Resultado) => {
    if (quiniela) return;
    const nuevas = { ...predicciones, [id]: r };
    setPredicciones(nuevas);
    const todas = partidos.every(p => nuevas[p.id]);
    if (todas && !showConfetti) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2200);
    }
  };

  const setMarcadorPartido = (id: string, m: Marcador) => {
    if (quiniela) return;
    setMarcadores(prev => ({ ...prev, [id]: m }));
  };

  const confirmarYPagar = async () => {
    if (!user || !jornada) return;
    const completa = partidos.every(p => predicciones[p.id]);
    if (!completa) { Alert.alert('Incompleto', 'Selecciona un resultado para cada partido.'); return; }
    setLoadingPago(true);
    try {
      const rows = partidos.map(p => {
        const m = marcadores[p.id];
        return {
          usuario_id: user.id, partido_id: p.id, resultado: predicciones[p.id],
          goles_local:     m?.local     !== '' && m?.local     != null ? parseInt(m.local, 10)     : null,
          goles_visitante: m?.visitante !== '' && m?.visitante != null ? parseInt(m.visitante, 10) : null,
        };
      });
      const { error: predError } = await supabase
        .from('predicciones').upsert(rows, { onConflict: 'usuario_id,partido_id' });
      if (predError) throw new Error('Error guardando predicciones: ' + predError.message);
      const { error: qError } = await supabase.from('quinielas').upsert(
        { usuario_id: user.id, jornada_id: jornada.id, jornada: 0, estado_pago: 'pendiente', aciertos: 0 },
        { onConflict: 'usuario_id,jornada_id' }
      );
      if (qError) throw new Error('Error creando quiniela: ' + qError.message);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        'https://kdvbmvsolrquphfedldz.supabase.co/functions/v1/crear-pago',
        { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ nombre: usuario?.nombre || 'Jugador', usuario_id: user.id, jornada_id: jornada.id, jornada_nombre: jornada.nombre }) }
      );
      const data = await response.json();
      if (response.ok && data.urlPago) {
        await refrescarSinBorrar();
        if (Platform.OS === 'web') (window as any).open(data.urlPago, '_self');
        else Linking.openURL(data.urlPago);
      } else { throw new Error(data.error || 'No se pudo crear el pago.'); }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoadingPago(false); }
  };

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

  const calcularPremioUsuario = () => {
    if (!jornada?.bolsa_total) return null;
    const porcOrg = jornada.porcentaje_organizador ?? 0;
    return jornada.bolsa_total * ((100 - porcOrg) / 100);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large" /></View>;

  const yaGuardo      = !!quiniela;
  const esPagado      = quiniela?.estado_pago === 'pagado';
  const todoSel       = partidos.length > 0 && partidos.every(p => predicciones[p.id]);
  const selCount      = partidos.filter(p => predicciones[p.id]).length;
  const premioUsuario = calcularPremioUsuario();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <Confetti visible={showConfetti} />

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>⚽ Mi Quiniela</Text>
          {jornada?.precio != null && jornada.precio > 0 && (
            <View style={styles.precioDestacado}>
              <Ionicons name="pricetag" size={16} color={C.gold} />
              <Text style={styles.precioDestacadoMonto}>${jornada.precio}</Text>
              <Text style={styles.precioDestacadoLabel}>por quiniela</Text>
            </View>
          )}
        </View>

        <SelectorQuinielas
          jornadas={jornadasAbiertas} seleccionada={jornada}
          onSeleccionar={seleccionarJornada} quinielasUsuario={quinielasUsuario}
        />

        {jornadasAbiertas.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>⏳</Text>
            <Text style={styles.emptyTitulo}>Sin quiniela activa</Text>
            <Text style={styles.emptyTexto}>El administrador aún no ha abierto ninguna jornada.</Text>
          </View>
        )}

        {jornada && partidos.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitulo}>Sin partidos aún</Text>
            <Text style={styles.emptyTexto}>Pronto se agregarán los partidos de {jornada.nombre}.</Text>
          </View>
        )}

        {jornada && partidos.length > 0 && (
          <>
            <View style={styles.jornadaHeaderCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jornadaNombreGrande}>{jornada.nombre}</Text>
                <Text style={styles.jornadaSubtexto}>{partidos.length} partidos · {jornada.estado === 'abierta' ? 'Abierta' : 'En curso'}</Text>
              </View>
              <View style={styles.estadoPill}>
                <View style={[styles.estadoDot, { backgroundColor: C.green }]} />
                <Text style={[styles.estadoTexto, { color: C.green }]}>ABIERTA</Text>
              </View>
            </View>

            {/* ⏳ BANNER CUENTA REGRESIVA AL CIERRE */}
            {fechaPrimerPartido && (
              <BannerCierre
                fechaPrimerPartido={fechaPrimerPartido}
                yaGuardo={yaGuardo}
              />
            )}

            {premioUsuario != null && premioUsuario > 0 && (
              <View style={styles.bolsaCard}>
                <Ionicons name="trophy" size={20} color={C.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bolsaTitulo}>🏆 Premio a ganar</Text>
                  <Text style={styles.bolsaMonto}>${premioUsuario.toFixed(2)}</Text>
                </View>
              </View>
            )}

            {pagoRecienConfirmado && (
              <View style={styles.bannerPagoConfirmado}>
                <Text style={styles.bannerPagoEmoji}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerPagoTitulo}>¡Tu pago fue confirmado!</Text>
                  <Text style={styles.bannerPagoSub}>Ya estás participando en {jornada.nombre}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={C.green} />
              </View>
            )}

            {yaGuardo && !pagoRecienConfirmado && (
              <View style={[styles.statusBanner, esPagado ? styles.bannerGreen : styles.bannerOrange]}>
                <Ionicons name={esPagado ? 'checkmark-circle' : 'time-outline'} size={18} color="#fff" />
                <Text style={styles.statusText}>
                  {esPagado ? 'Pago confirmado — ¡Estás participando! 🎉' : 'Pago pendiente — Completa tu pago para participar'}
                </Text>
              </View>
            )}

            {!yaGuardo && (
              <View style={styles.avisoDesempate}>
                <Ionicons name="information-circle-outline" size={14} color={C.accent} />
                <Text style={styles.avisoTexto}>
                  <Text style={{ fontWeight: '700', color: C.accent }}>Desempate por marcador:</Text> ingresa el marcador exacto de cada partido para desempatar en caso de empate en aciertos.
                </Text>
              </View>
            )}

            {!yaGuardo && (
              <View style={styles.progressBox}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>{selCount}/{partidos.length} seleccionados</Text>
                  <Text style={styles.progressPct}>{Math.round(selCount / partidos.length * 100)}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${selCount / partidos.length * 100}%` as any }]} />
                </View>
                {todoSel && <Text style={styles.completoTexto}>✨ ¡Quiniela completa! Ya puedes confirmar y pagar.</Text>}
              </View>
            )}

            {partidos.map(p => (
              <View key={p.id} style={styles.partidoCard}>
                <Text style={styles.partidoFecha}>{formatFecha(p.fecha)}</Text>
                <Countdown fecha={p.fecha} />
                <View style={styles.equiposRow}>
                  <Text style={styles.equipo} numberOfLines={1}>{p.local}</Text>
                  <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
                  <Text style={styles.equipo} numberOfLines={1}>{p.visitante}</Text>
                </View>
                <View style={styles.opcionesRow}>
                  {(['1','X','2'] as Resultado[]).map(op => {
                    const activo = predicciones[p.id] === op;
                    return (
                      <TouchableOpacity
                        key={op}
                        style={[styles.opcion, activo && styles.opcionActiva, yaGuardo && { opacity: 0.7 }]}
                        onPress={() => seleccionar(p.id, op)}
                        disabled={yaGuardo} activeOpacity={0.7}
                      >
                        <Text style={[styles.opcionLetra, activo && styles.opcionLetraActiva]}>{op}</Text>
                        <Text style={[styles.opcionEquipo, activo && styles.opcionEquipoActivo]} numberOfLines={1}>
                          {op === '1' ? p.local.slice(0, 8) : op === 'X' ? 'Empate' : p.visitante.slice(0, 8)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <InputMarcador
                  partido={p}
                  marcador={marcadores[p.id] ?? { local: '', visitante: '' }}
                  onChange={m => setMarcadorPartido(p.id, m)}
                  disabled={yaGuardo}
                />
              </View>
            ))}

            {!esPagado && (
              <TouchableOpacity
                style={[styles.btnPagar, todoSel ? styles.btnPagarActivo : styles.btnDisabled]}
                onPress={confirmarYPagar}
                disabled={loadingPago || (!todoSel && !yaGuardo)}
                activeOpacity={0.8}
              >
                {loadingPago
                  ? <ActivityIndicator color="#fff" />
                  : <>
                    <Ionicons name="card" size={18} color="#fff" />
                    <Text style={styles.btnPagarTexto}>{yaGuardo ? 'Reintentar pago' : 'Confirmar y pagar'}</Text>
                    {jornada.precio != null && jornada.precio > 0 && (
                      <View style={styles.btnPrecioTag}>
                        <Text style={styles.btnPrecioTagTexto}>${jornada.precio}</Text>
                      </View>
                    )}
                  </>
                }
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scroll: { flex: 1 },
  header: { paddingBottom: 16, paddingHorizontal: 20, backgroundColor: C.bg },
  headerTitle: { color: C.text, fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  precioDestacado: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.goldDim, borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.35)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  precioDestacadoMonto: { color: C.gold, fontSize: 22, fontWeight: '900' },
  precioDestacadoLabel: { color: 'rgba(255,215,0,0.7)', fontSize: 13, fontWeight: '600' },
  jornadaHeaderCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.cardBorder, gap: 10 },
  jornadaNombreGrande: { color: C.text, fontWeight: 'bold', fontSize: 15 },
  jornadaSubtexto: { color: C.textSub, fontSize: 11, marginTop: 3 },
  estadoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: C.green, backgroundColor: 'rgba(0,200,151,0.1)' },
  estadoDot: { width: 6, height: 6, borderRadius: 3 },
  estadoTexto: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  bolsaCard: { flexDirection:'row', alignItems:'center', gap:12, marginHorizontal:16, marginBottom:12, padding:16, borderRadius:14, backgroundColor:'rgba(255,215,0,0.08)', borderWidth:1.5, borderColor:'rgba(255,215,0,0.3)' },
  bolsaTitulo: { color:C.textSub, fontWeight:'700', fontSize:12, marginBottom:2 },
  bolsaMonto: { color:C.gold, fontWeight:'900', fontSize:26 },
  avisoDesempate: { flexDirection:'row', alignItems:'flex-start', gap:8, marginHorizontal:16, marginBottom:10, padding:12, borderRadius:10, backgroundColor:'rgba(0,180,216,0.07)', borderWidth:1, borderColor:'rgba(0,180,216,0.2)' },
  avisoTexto: { color:C.textSub, fontSize:11, flex:1, lineHeight:16 },
  bannerPagoConfirmado: { flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:16, marginBottom:12, padding:16, borderRadius:14, backgroundColor:'rgba(0,200,151,0.12)', borderWidth:1.5, borderColor:C.green },
  bannerPagoEmoji: { fontSize: 28 },
  bannerPagoTitulo: { color: C.green, fontWeight: '800', fontSize: 15 },
  bannerPagoSub: { color: C.textSub, fontSize: 12, marginTop: 2 },
  statusBanner: { flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:16, marginBottom:12, padding:14, borderRadius:12 },
  bannerGreen: { backgroundColor:'rgba(0,200,151,0.15)', borderWidth:1, borderColor:C.green },
  bannerOrange: { backgroundColor:'rgba(255,159,67,0.15)', borderWidth:1, borderColor:C.orange },
  statusText: { color:C.text, fontWeight:'600', fontSize:13, flex:1 },
  progressBox: { marginHorizontal:16, marginBottom:12, backgroundColor:C.card, borderRadius:12, padding:14, borderWidth:1, borderColor:C.cardBorder },
  progressRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:8 },
  progressLabel: { color:C.textSub, fontSize:13 },
  progressPct: { color:C.accent, fontSize:13, fontWeight:'700' },
  progressBar: { height:4, backgroundColor:'#1e1e35', borderRadius:2 },
  progressFill: { height:4, backgroundColor:C.accent, borderRadius:2 },
  completoTexto: { color:C.green, fontSize:12, fontWeight:'700', marginTop:8, textAlign:'center' },
  partidoCard: { backgroundColor:C.card, marginHorizontal:16, marginBottom:10, borderRadius:14, padding:16, borderWidth:1, borderColor:C.cardBorder },
  partidoFecha: { color:C.accent, fontSize:12, fontWeight:'600', marginBottom:4, textAlign:'center' },
  equiposRow: { flexDirection:'row', alignItems:'center', marginBottom:14, marginTop:8 },
  equipo: { flex:1, fontSize:15, fontWeight:'bold', color:C.text, textAlign:'center' },
  vsBadge: { backgroundColor:'#1e1e35', paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginHorizontal:6 },
  vsText: { color:C.textSub, fontSize:10, fontWeight:'700' },
  opcionesRow: { flexDirection:'row', gap:8 },
  opcion: { flex:1, borderWidth:1.5, borderColor:'#2a2a40', borderRadius:10, paddingVertical:10, alignItems:'center', backgroundColor:'#12121f' },
  opcionActiva: { backgroundColor:C.accentDim, borderColor:C.accent },
  opcionLetra: { fontSize:17, fontWeight:'bold', color:C.textSub },
  opcionLetraActiva: { color:C.accent },
  opcionEquipo: { fontSize:11, color:'#555577', marginTop:3 },
  opcionEquipoActivo: { color:C.accent },
  btnPagar: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, marginHorizontal:16, marginTop:8, padding:17, borderRadius:14, backgroundColor:'#1a1a2e' },
  btnPagarActivo: { backgroundColor: C.accent },
  btnDisabled: { backgroundColor:'#1e2a30', opacity:0.5 },
  btnPagarTexto: { color:'#fff', fontWeight:'bold', fontSize:16 },
  btnPrecioTag: { backgroundColor:'rgba(0,0,0,0.25)', borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  btnPrecioTagTexto: { color:'#fff', fontSize:13, fontWeight:'800' },
  emptyBox: { alignItems:'center', padding:60 },
  emptyEmoji: { fontSize:54, marginBottom:16 },
  emptyTitulo: { fontSize:18, fontWeight:'bold', color:C.text, marginBottom:8 },
  emptyTexto: { color:C.textSub, fontSize:14, textAlign:'center', lineHeight:22 },
});
