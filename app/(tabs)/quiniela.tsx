import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl, StatusBar, Platform, Animated, TextInput,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';
import NeonWrapper from '../../components/NeonWrapper';

type Partido    = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean };
type Jornada    = { id:string; nombre:string; estado:string; precio?:number|null; porcentaje_organizador?:number|null; bolsa_total?:number|null };
type QuinielaDB = { id:string; estado_pago:string; jornada_id:string };
type Resultado  = '1'|'X'|'2';
type Marcador   = { local: string; visitante: string };

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

function Countdown({ fecha, C }: { fecha: string; C: any }) {
  const { total, d, h, m, s } = useCountdown(fecha);
  if (total <= 0) return null;
  const urgente = total < 3600000;
  const texto = d > 0 ? `Inicia en ${d}d ${h}h ${m}m` : h > 0 ? `Inicia en ${h}h ${m}m ${s}s` : `Inicia en ${m}m ${s}s`;
  return (
    <View style={[{ flexDirection:'row', alignItems:'center', gap:4, alignSelf:'center', marginTop:4, marginBottom:2, borderRadius:8, paddingHorizontal:8, paddingVertical:3, borderWidth:1 }, { backgroundColor: urgente ? C.orangeDim : C.accentDim, borderColor: urgente ? 'rgba(255,179,64,0.4)' : 'rgba(0,212,255,0.25)' }]}>
      <Ionicons name="time-outline" size={12} color={urgente ? C.orange : C.accent} />
      <Text style={{ color: urgente ? C.orange : C.accent, fontSize:11, fontWeight:'700' }}>{texto}</Text>
    </View>
  );
}

function BannerCierre({ fechaPrimerPartido, yaGuardo, C }: { fechaPrimerPartido: string; yaGuardo: boolean; C: any }) {
  const { total, d, h, m, s } = useCountdown(fechaPrimerPartido);
  if (total <= 0 || yaGuardo) return null;
  const critico  = total < 3600000;
  const urgente  = total < 10800000;
  const dias     = d > 0;
  const bloques = dias
    ? [{ valor: String(d).padStart(2,'0'), label:'DÍAS' },{ valor:String(h).padStart(2,'0'),label:'HRS' },{ valor:String(m).padStart(2,'0'),label:'MIN' }]
    : [{ valor: String(h).padStart(2,'0'), label:'HRS' },{ valor:String(m).padStart(2,'0'),label:'MIN' },{ valor:String(s).padStart(2,'0'),label:'SEG' }];
  const bgColor  = critico ? C.redDim    : urgente ? C.orangeDim : C.accentDim;
  const bdColor  = critico ? C.red       : urgente ? C.orange    : C.accent;
  const glowColor= critico ? 'rgba(255,90,110,0.35)' : urgente ? 'rgba(255,179,64,0.35)' : C.accentGlow;
  const numColor = critico ? C.red       : urgente ? C.orange    : C.text;
  return (
    <NeonWrapper color={glowColor} borderRadius={18} shadowRadius={14} opacity={1} style={{ marginHorizontal:16, marginBottom:14 }}>
      <View style={[{ borderRadius:18, borderWidth:1.5, padding:16 }, { backgroundColor:bgColor, borderColor:bdColor }]}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 }}>
          <Ionicons name={critico ? 'warning' : 'timer-outline'} size={16} color={bdColor} />
          <Text style={{ fontSize:13, fontWeight:'800', flex:1, lineHeight:18, color:bdColor }}>{critico ? '⚠️ ¡Última hora!' : urgente ? '⏰ Cierra en menos de 3 horas' : '📅 Tiempo para registrar tu quiniela'}</Text>
        </View>
        <View style={{ flexDirection:'row', justifyContent:'center', alignItems:'center', gap:4, marginBottom:10 }}>
          {bloques.map((b, i) => (
            <React.Fragment key={b.label}>
              <View style={[{ alignItems:'center', minWidth:56, borderRadius:12, paddingVertical:8, paddingHorizontal:10, borderWidth:1, backgroundColor:'rgba(0,0,0,0.35)' }, { borderColor: bdColor + '50' }]}>
                <Text style={{ fontSize:34, fontWeight:'900', letterSpacing:1, color:numColor }}>{b.valor}</Text>
                <Text style={{ fontSize:9, fontWeight:'800', letterSpacing:1.5, marginTop:2, color:bdColor }}>{b.label}</Text>
              </View>
              {i < bloques.length - 1 && <Text style={{ fontSize:28, fontWeight:'900', marginBottom:8, color:numColor }}>:</Text>}
            </React.Fragment>
          ))}
        </View>
        <Text style={{ fontSize:11, textAlign:'center', lineHeight:16, color:bdColor+'cc' }}>Una vez que inicie el primer partido ya no podrás modificar tus selecciones.</Text>
      </View>
    </NeonWrapper>
  );
}

const COLORES_CONFETTI = ['#00d4ff','#00e5a0','#ffd060','#ffb340','#ff5a6e','#b57bff','#f4f4ff'];
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
        Animated.timing(y,{toValue:580,duration:1800,useNativeDriver:true}),
        Animated.timing(x,{toValue:endX-startX,duration:1800,useNativeDriver:true}),
        Animated.timing(op,{toValue:0,duration:1800,delay:1000,useNativeDriver:true}),
        Animated.timing(rot,{toValue:8,duration:1800,useNativeDriver:true}),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);
  const rotate = rot.interpolate({ inputRange:[0,8], outputRange:['0deg','720deg'] });
  return <Animated.View style={[{ position:'absolute', top:0, width:10, height:10, borderRadius:2, backgroundColor:color, opacity:op, transform:[{translateY:y},{translateX:x},{rotate}], left:'50%', marginLeft:startX }]} />;
}
function Confetti({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={{ ...StyleSheet.absoluteFillObject, zIndex:999 }} pointerEvents="none">
      {Array.from({length:N_CONFETTI}).map((_,i)=>(
        <ConfettiPieza key={i} delay={Math.random()*400} color={COLORES_CONFETTI[i%COLORES_CONFETTI.length]} />
      ))}
    </View>
  );
}

function SelectorQuinielas({
  jornadas, seleccionada, onSeleccionar, quinielasUsuario, C,
}: {
  jornadas:Jornada[]; seleccionada:Jornada|null;
  onSeleccionar:(j:Jornada)=>void; quinielasUsuario:QuinielaDB[]; C: any;
}) {
  if (jornadas.length <= 1) return null;
  return (
    <View style={{ marginHorizontal:16, marginBottom:16, backgroundColor:C.card, borderRadius:18, padding:16, borderWidth:1, borderColor:C.cardBorder }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:12 }}>
        <Ionicons name="layers" size={14} color={C.accent} />
        <Text style={{ color:C.text, fontWeight:'800', fontSize:14, flex:1 }}>Quinielas disponibles</Text>
        <View style={{ backgroundColor:C.accentDim, borderRadius:10, paddingHorizontal:7, paddingVertical:2, borderWidth:1, borderColor:'rgba(0,212,255,0.35)' }}><Text style={{ color:C.accent, fontSize:11, fontWeight:'800' }}>{jornadas.length}</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:2}}>
        {jornadas.map(j=>{
          const activa = seleccionada?.id === j.id;
          const quiniela = quinielasUsuario.find(q=>q.jornada_id===j.id);
          const pagada = quiniela?.estado_pago==='pagado';
          const pendiente = quiniela && !pagada;
          return (
            <NeonWrapper key={j.id} color={activa ? C.accentGlow : 'transparent'} borderRadius={12} shadowRadius={activa ? 8 : 0} opacity={activa ? 1 : 0}>
              <TouchableOpacity style={[{ flexDirection:'row', alignItems:'center', gap:6, borderWidth:1.5, borderColor:C.cardBorder, borderRadius:12, paddingHorizontal:12, paddingVertical:8, backgroundColor:C.bg, maxWidth:200 }, activa && { borderColor:C.accent, backgroundColor:C.accentDim }]} onPress={()=>onSeleccionar(j)} activeOpacity={0.75}>
                {pagada    && <Ionicons name="checkmark-circle" size={13} color={C.green} />}
                {pendiente && <Ionicons name="time" size={13} color={C.orange} />}
                {!quiniela && <Ionicons name="ellipse-outline" size={13} color={activa?C.accent:C.textSub} />}
                <Text style={[{ color:C.textSub, fontSize:12, fontWeight:'600', flexShrink:1 }, activa && { color:C.accent }]} numberOfLines={1}>{j.nombre}</Text>
                {j.precio!=null&&j.precio>0&&(
                  <View style={{ backgroundColor:C.goldDim, borderRadius:6, paddingHorizontal:5, paddingVertical:1, borderWidth:1, borderColor:'rgba(255,208,96,0.35)' }}><Text style={{ color:C.gold, fontSize:10, fontWeight:'800' }}>${j.precio}</Text></View>
                )}
              </TouchableOpacity>
            </NeonWrapper>
          );
        })}
      </ScrollView>
    </View>
  );
}

function InputMarcador({
  partido,marcador,onChange,disabled,C,
}:{
  partido:Partido;marcador:Marcador;onChange:(m:Marcador)=>void;disabled:boolean;C:any;
}) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:10, paddingTop:10, borderTopWidth:1, borderTopColor:C.cardBorder }}>
      <Ionicons name="football-outline" size={12} color={C.textSub} />
      <Text style={{ color:C.textSub, fontSize:11, flex:1 }}>Marcador pronosticado</Text>
      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
        <TextInput
          style={[{ width:38, height:34, borderWidth:1.5, borderColor:C.accent, borderRadius:8, textAlign:'center', color:C.text, fontSize:16, fontWeight:'700', backgroundColor:C.accentDim }, disabled && { borderColor:C.cardBorder, color:C.textSub, backgroundColor:'transparent' }]}
          value={marcador.local}
          onChangeText={v=>onChange({...marcador,local:v.replace(/[^0-9]/g,'').slice(0,2)})}
          keyboardType="number-pad" maxLength={2} placeholder="0"
          placeholderTextColor={C.textSub} editable={!disabled} selectTextOnFocus
        />
        <Text style={{ color:C.text, fontWeight:'900', fontSize:18 }}>-</Text>
        <TextInput
          style={[{ width:38, height:34, borderWidth:1.5, borderColor:C.accent, borderRadius:8, textAlign:'center', color:C.text, fontSize:16, fontWeight:'700', backgroundColor:C.accentDim }, disabled && { borderColor:C.cardBorder, color:C.textSub, backgroundColor:'transparent' }]}
          value={marcador.visitante}
          onChangeText={v=>onChange({...marcador,visitante:v.replace(/[^0-9]/g,'').slice(0,2)})}
          keyboardType="number-pad" maxLength={2} placeholder="0"
          placeholderTextColor={C.textSub} editable={!disabled} selectTextOnFocus
        />
      </View>
    </View>
  );
}

export default function QuinielaScreen() {
  const { user, usuario } = useAuth();
  const { colors: C, theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [jornadasAbiertas, setJornadasAbiertas] = useState<Jornada[]>([]);
  const [jornada, setJornada]                   = useState<Jornada | null>(null);
  const [partidos, setPartidos]                 = useState<Partido[]>([]);
  const [predicciones, setPredicciones]         = useState<Record<string,Resultado>>({});
  const [marcadores, setMarcadores]             = useState<Record<string,Marcador>>({});
  const [quiniela, setQuiniela]                 = useState<QuinielaDB|null>(null);
  const [quinielasUsuario, setQuinielasUsuario] = useState<QuinielaDB[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [loadingPago, setLoadingPago]           = useState(false);
  const [showConfetti, setShowConfetti]         = useState(false);
  const [pagoRecienConfirmado, setPagoRecienConfirmado] = useState(false);

  const cargaInicialHecha = useRef(false);
  const prevEstadoRef     = useRef<string|null>(null);

  const fechaPrimerPartido = partidos.length > 0
    ? partidos.reduce((min,p)=>p.fecha<min?p.fecha:min, partidos[0].fecha)
    : null;

  const cargarJornada = useCallback(async (j:Jornada, opciones?:{forzarPredicciones?:boolean}) => {
    if (!user) return;
    const { data:pData } = await supabase.from('partidos').select('*').eq('jornada_id',j.id).order('fecha');
    setPartidos(pData||[]);
    const { data:qData } = await supabase.from('quinielas').select('id,estado_pago,jornada_id').eq('usuario_id',user.id).eq('jornada_id',j.id).maybeSingle();
    if (qData && prevEstadoRef.current==='pendiente' && qData.estado_pago==='pagado') {
      setPagoRecienConfirmado(true); setShowConfetti(true);
      setTimeout(()=>setShowConfetti(false),2500);
      setTimeout(()=>setPagoRecienConfirmado(false),6000);
    }
    prevEstadoRef.current = qData?.estado_pago??null;
    setQuiniela(qData);
    if ((qData&&pData)||opciones?.forzarPredicciones) {
      if (pData&&pData.length>0) {
        const { data:predData } = await supabase.from('predicciones').select('partido_id,resultado,goles_local,goles_visitante').eq('usuario_id',user.id).in('partido_id',pData.map(p=>p.id));
        const mapRes:Record<string,Resultado>={};
        const mapMarcador:Record<string,Marcador>={};
        (predData||[]).forEach(p=>{
          mapRes[p.partido_id]=p.resultado as Resultado;
          mapMarcador[p.partido_id]={local:p.goles_local!=null?String(p.goles_local):'',visitante:p.goles_visitante!=null?String(p.goles_visitante):''};
        });
        setPredicciones(mapRes); setMarcadores(mapMarcador);
      }
    }
  }, [user]);

  const cargarInicial = useCallback(async () => {
    if (!user) return;
    const { data:jData } = await supabase.from('jornadas').select('id,nombre,estado,precio,porcentaje_organizador,bolsa_total').eq('estado','abierta').order('creado_at',{ascending:false});
    const lista:Jornada[]=jData||[];
    setJornadasAbiertas(lista);
    const { data:qAll } = await supabase.from('quinielas').select('id,estado_pago,jornada_id').eq('usuario_id',user.id);
    setQuinielasUsuario(qAll||[]);
    if (lista.length>0) { setJornada(lista[0]); await cargarJornada(lista[0],{forzarPredicciones:true}); }
    else { setJornada(null); setPartidos([]); setQuiniela(null); }
  }, [user,cargarJornada]);

  const refrescarSinBorrar = useCallback(async () => {
    if (!user) return;
    const { data:jData } = await supabase.from('jornadas').select('id,nombre,estado,precio,porcentaje_organizador,bolsa_total').eq('estado','abierta').order('creado_at',{ascending:false});
    const lista:Jornada[]=jData||[];
    setJornadasAbiertas(lista);
    const { data:qAll } = await supabase.from('quinielas').select('id,estado_pago,jornada_id').eq('usuario_id',user.id);
    setQuinielasUsuario(qAll||[]);
    if (jornada) {
      const jActualizada = lista.find(j=>j.id===jornada.id);
      if (jActualizada) {
        setJornada(jActualizada);
        const { data:qData } = await supabase.from('quinielas').select('id,estado_pago,jornada_id').eq('usuario_id',user.id).eq('jornada_id',jActualizada.id).maybeSingle();
        if (qData&&prevEstadoRef.current==='pendiente'&&qData.estado_pago==='pagado') {
          setPagoRecienConfirmado(true); setShowConfetti(true);
          setTimeout(()=>setShowConfetti(false),2500);
          setTimeout(()=>setPagoRecienConfirmado(false),6000);
        }
        prevEstadoRef.current=qData?.estado_pago??null;
        setQuiniela(qData);
      }
    }
  }, [user,jornada]);

  useEffect(() => {
    if (!user||cargaInicialHecha.current) return;
    cargaInicialHecha.current=true;
    setLoading(true);
    cargarInicial().finally(()=>setLoading(false));
  }, [user,cargarInicial]);

  useFocusEffect(useCallback(()=>{
    if (!cargaInicialHecha.current) return;
    refrescarSinBorrar();
  },[refrescarSinBorrar]));

  const onRefresh = useCallback(async()=>{
    setRefreshing(true);
    await refrescarSinBorrar();
    setRefreshing(false);
  },[refrescarSinBorrar]);

  const seleccionarJornada = useCallback(async(j:Jornada)=>{
    setJornada(j); setPartidos([]); setPredicciones({}); setMarcadores({}); setQuiniela(null);
    await cargarJornada(j,{forzarPredicciones:true});
  },[cargarJornada]);

  const seleccionar = (id:string, r:Resultado) => {
    if (quiniela) return;
    const nuevas={...predicciones,[id]:r};
    setPredicciones(nuevas);
    if (partidos.every(p=>nuevas[p.id])&&!showConfetti) {
      setShowConfetti(true);
      setTimeout(()=>setShowConfetti(false),2200);
    }
  };

  const setMarcadorPartido = (id:string,m:Marcador) => {
    if (quiniela) return;
    setMarcadores(prev=>({...prev,[id]:m}));
  };

  const confirmarYPagar = async () => {
    if (!user||!jornada) return;
    if (!partidos.every(p=>predicciones[p.id])) { Alert.alert('Incompleto','Selecciona un resultado para cada partido.'); return; }
    setLoadingPago(true);
    try {
      const rows=partidos.map(p=>{
        const m=marcadores[p.id];
        return { usuario_id:user.id,partido_id:p.id,resultado:predicciones[p.id],
          goles_local:m?.local!==''&&m?.local!=null?parseInt(m.local,10):null,
          goles_visitante:m?.visitante!==''&&m?.visitante!=null?parseInt(m.visitante,10):null };
      });
      const { error:predError } = await supabase.from('predicciones').upsert(rows,{onConflict:'usuario_id,partido_id'});
      if (predError) throw new Error('Error guardando predicciones: '+predError.message);
      const { error:qError } = await supabase.from('quinielas').upsert(
        {usuario_id:user.id,jornada_id:jornada.id,jornada:0,estado_pago:'pendiente',aciertos:0},
        {onConflict:'usuario_id,jornada_id'}
      );
      if (qError) throw new Error('Error creando quiniela: '+qError.message);
      const { data:{session} } = await supabase.auth.getSession();
      const response = await fetch(
        'https://kdvbmvsolrquphfedldz.supabase.co/functions/v1/crear-pago',
        { method:'POST',
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${session?.access_token}`},
          body:JSON.stringify({nombre:usuario?.nombre||'Jugador',usuario_id:user.id,jornada_id:jornada.id,jornada_nombre:jornada.nombre}) }
      );
      const data=await response.json();
      if (response.ok&&data.urlPago) {
        await refrescarSinBorrar();
        if (Platform.OS==='web') (window as any).open(data.urlPago,'_self');
        else Linking.openURL(data.urlPago);
      } else { throw new Error(data.error||'No se pudo crear el pago.'); }
    } catch(e:any) { Alert.alert('Error',e.message); }
    finally { setLoadingPago(false); }
  };

  const formatFecha = (f:string) =>
    new Date(f).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

  const calcularPremioUsuario = () => {
    if (!jornada?.bolsa_total) return null;
    const porcOrg=jornada.porcentaje_organizador??0;
    return jornada.bolsa_total*((100-porcOrg)/100);
  };

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:C.bg }}><ActivityIndicator color={C.accent} size="large" /></View>;

  const yaGuardo      = !!quiniela;
  const esPagado      = quiniela?.estado_pago==='pagado';
  const todoSel       = partidos.length>0&&partidos.every(p=>predicciones[p.id]);
  const selCount      = partidos.filter(p=>predicciones[p.id]).length;
  const premioUsuario = calcularPremioUsuario();

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />
      <Confetti visible={showConfetti} />
      <ScrollView
        style={{ flex:1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={{ paddingBottom:16, paddingHorizontal:20, backgroundColor:C.bg, paddingTop:insets.top+16 }}>
          <Text style={{ color:C.text, fontSize:28, fontWeight:'bold', marginBottom:10 }}>⚽ Mi Quiniela</Text>
          {jornada?.precio!=null&&jornada.precio>0&&(
            <NeonWrapper color={C.goldGlow} borderRadius={14} shadowRadius={10} opacity={1}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:7, backgroundColor:C.goldDim, borderWidth:1.5, borderColor:'rgba(255,208,96,0.40)', borderRadius:14, paddingHorizontal:14, paddingVertical:8, alignSelf:'flex-start' }}>
                <Ionicons name="pricetag" size={16} color={C.gold} />
                <Text style={{ color:C.gold, fontSize:22, fontWeight:'900' }}>${jornada.precio}</Text>
                <Text style={{ color:'rgba(255,208,96,0.7)', fontSize:13, fontWeight:'600' }}>por quiniela</Text>
              </View>
            </NeonWrapper>
          )}
        </View>

        <SelectorQuinielas jornadas={jornadasAbiertas} seleccionada={jornada} onSeleccionar={seleccionarJornada} quinielasUsuario={quinielasUsuario} C={C} />

        {jornadasAbiertas.length===0&&(
          <View style={{ alignItems:'center', padding:60 }}>
            <Text style={{ fontSize:54, marginBottom:16 }}>⏳</Text>
            <Text style={{ fontSize:18, fontWeight:'bold', color:C.text, marginBottom:8 }}>Sin quiniela activa</Text>
            <Text style={{ color:C.textSub, fontSize:14, textAlign:'center', lineHeight:22 }}>El administrador aún no ha abierto ninguna jornada.</Text>
          </View>
        )}

        {jornada&&partidos.length===0&&(
          <View style={{ alignItems:'center', padding:60 }}>
            <Text style={{ fontSize:54, marginBottom:16 }}>📋</Text>
            <Text style={{ fontSize:18, fontWeight:'bold', color:C.text, marginBottom:8 }}>Sin partidos aún</Text>
            <Text style={{ color:C.textSub, fontSize:14, textAlign:'center', lineHeight:22 }}>Pronto se agregarán los partidos de {jornada.nombre}.</Text>
          </View>
        )}

        {jornada&&partidos.length>0&&(
          <>
            <NeonWrapper color={C.pinkGlow} borderRadius={18} shadowRadius={16} opacity={1} style={{ marginHorizontal:16, marginBottom:12 }}>
              <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:C.card, borderRadius:18, padding:14, borderWidth:1.5, borderColor:'rgba(255,79,160,0.5)', gap:10 }}>
                <View style={{flex:1}}>
                  <Text style={{ color:C.text, fontWeight:'bold', fontSize:15 }}>{jornada.nombre}</Text>
                  <Text style={{ color:C.textSub, fontSize:11, marginTop:3 }}>{partidos.length} partidos · {jornada.estado==='abierta'?'Abierta':'En curso'}</Text>
                </View>
                <View style={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:8, paddingVertical:3, borderRadius:20, borderWidth:1, borderColor:C.green, backgroundColor:C.greenDim }}>
                  <View style={{ width:6, height:6, borderRadius:3, backgroundColor:C.green }} />
                  <Text style={{ fontSize:9, fontWeight:'800', letterSpacing:0.5, color:C.green }}>ABIERTA</Text>
                </View>
              </View>
            </NeonWrapper>

            {fechaPrimerPartido&&<BannerCierre fechaPrimerPartido={fechaPrimerPartido} yaGuardo={yaGuardo} C={C} />}

            {premioUsuario!=null&&premioUsuario>0&&(
              <NeonWrapper color={C.goldGlow} borderRadius={18} shadowRadius={14} opacity={1} style={{ marginHorizontal:16, marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:12, padding:16, borderRadius:18, backgroundColor:C.goldDim, borderWidth:1.5, borderColor:'rgba(255,208,96,0.4)' }}>
                  <Ionicons name="trophy" size={20} color={C.gold} />
                  <View style={{flex:1}}>
                    <Text style={{ color:C.textSub, fontWeight:'700', fontSize:12, marginBottom:2 }}>🏆 Premio a ganar</Text>
                    <Text style={{ color:C.gold, fontWeight:'900', fontSize:26 }}>${premioUsuario.toFixed(2)}</Text>
                  </View>
                </View>
              </NeonWrapper>
            )}

            {pagoRecienConfirmado&&(
              <NeonWrapper color={C.greenGlow} borderRadius={18} shadowRadius={14} opacity={1} style={{ marginHorizontal:16, marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10, padding:16, borderRadius:18, backgroundColor:C.greenDim, borderWidth:1.5, borderColor:C.green }}>
                  <Text style={{ fontSize:28 }}>🎉</Text>
                  <View style={{flex:1}}>
                    <Text style={{ color:C.green, fontWeight:'800', fontSize:15 }}>¡Tu pago fue confirmado!</Text>
                    <Text style={{ color:C.textSub, fontSize:12, marginTop:2 }}>Ya estás participando en {jornada.nombre}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={22} color={C.green} />
                </View>
              </NeonWrapper>
            )}

            {yaGuardo&&!pagoRecienConfirmado&&(
              <NeonWrapper
                color={esPagado ? C.greenGlow : C.orangeGlow}
                borderRadius={14} shadowRadius={12} opacity={1}
                style={{ marginHorizontal:16, marginBottom:12 }}
              >
                <View style={[{ flexDirection:'row', alignItems:'center', gap:10, padding:14, borderRadius:14 }, esPagado ? { backgroundColor:C.greenDim, borderWidth:1.5, borderColor:C.green } : { backgroundColor:C.orangeDim, borderWidth:1.5, borderColor:C.orange }]}>
                  <Ionicons name={esPagado?'checkmark-circle':'time-outline'} size={18} color="#fff" />
                  <Text style={{ color:C.text, fontWeight:'600', fontSize:13, flex:1 }}>{esPagado?'Pago confirmado — ¡Estás participando! 🎉':'Pago pendiente — Completa tu pago para participar'}</Text>
                </View>
              </NeonWrapper>
            )}

            {!yaGuardo&&(
              <View style={{ flexDirection:'row', alignItems:'flex-start', gap:8, marginHorizontal:16, marginBottom:10, padding:12, borderRadius:12, backgroundColor:C.accentDim, borderWidth:1, borderColor:'rgba(0,212,255,0.25)' }}>
                <Ionicons name="information-circle-outline" size={14} color={C.accent} />
                <Text style={{ color:C.textSub, fontSize:11, flex:1, lineHeight:16 }}><Text style={{fontWeight:'700',color:C.accent}}>Desempate por marcador:</Text> ingresa el marcador exacto de cada partido para desempatar en caso de empate en aciertos.</Text>
              </View>
            )}

            {!yaGuardo&&(
              <View style={{ marginHorizontal:16, marginBottom:12, backgroundColor:C.card, borderRadius:14, padding:14, borderWidth:1, borderColor:C.cardBorder }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
                  <Text style={{ color:C.textSub, fontSize:13 }}>{selCount}/{partidos.length} seleccionados</Text>
                  <Text style={{ color:C.accent, fontSize:13, fontWeight:'700' }}>{Math.round(selCount/partidos.length*100)}%</Text>
                </View>
                <View style={{ height:4, backgroundColor:C.cardBorder, borderRadius:2 }}>
                  <View style={{ height:4, backgroundColor:C.accent, borderRadius:2, width:`${selCount/partidos.length*100}%` as any }} />
                </View>
                {todoSel&&<Text style={{ color:C.green, fontSize:12, fontWeight:'700', marginTop:8, textAlign:'center' }}>✨ ¡Quiniela completa! Ya puedes confirmar y pagar.</Text>}
              </View>
            )}

            {partidos.map(p=>{
              const seleccion = predicciones[p.id];
              const glowCard = seleccion==='1'?C.accentGlow : seleccion==='X'?C.purpleGlow : seleccion==='2'?C.greenGlow : 'transparent';
              return (
                <NeonWrapper
                  key={p.id}
                  color={glowCard}
                  borderRadius={18}
                  shadowRadius={seleccion ? 12 : 0}
                  opacity={seleccion ? 0.9 : 0}
                  style={{ marginHorizontal:16, marginBottom:10 }}
                >
                  <View style={{ backgroundColor:C.card, borderRadius:18, padding:16, borderWidth:1.5, borderColor:'rgba(0,212,255,0.22)' }}>
                    <Text style={{ color:C.accent, fontSize:12, fontWeight:'600', marginBottom:4, textAlign:'center' }}>{formatFecha(p.fecha)}</Text>
                    <Countdown fecha={p.fecha} C={C} />
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:14, marginTop:8 }}>
                      <Text style={{ flex:1, fontSize:15, fontWeight:'bold', color:C.text, textAlign:'center' }} numberOfLines={1}>{p.local}</Text>
                      <View style={{ backgroundColor:C.cardBorder, paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginHorizontal:6 }}><Text style={{ color:C.textSub, fontSize:10, fontWeight:'700' }}>VS</Text></View>
                      <Text style={{ flex:1, fontSize:15, fontWeight:'bold', color:C.text, textAlign:'center' }} numberOfLines={1}>{p.visitante}</Text>
                    </View>
                    <View style={{ flexDirection:'row', gap:8 }}>
                      {(['1','X','2'] as Resultado[]).map(op=>{
                        const activo = predicciones[p.id]===op;
                        const glowColor = op==='1'?C.accentGlow : op==='X'?C.purpleGlow : C.greenGlow;
                        const borderActive = op==='1'?C.accent : op==='X'?C.purple : C.green;
                        const bgActive = op==='1'?C.accentDim : op==='X'?C.purpleDim : C.greenDim;
                        return (
                          <TouchableOpacity
                            key={op}
                            style={[{ flex:1, borderWidth:1.5, borderColor:C.cardBorder, borderRadius:12, paddingVertical:10, alignItems:'center', backgroundColor:C.bg },
                              activo&&{backgroundColor:bgActive,borderColor:borderActive,shadowColor:glowColor,shadowOffset:{width:0,height:0},shadowOpacity:1,shadowRadius:10,elevation:6},
                              yaGuardo&&{opacity:0.7}
                            ]}
                            onPress={()=>seleccionar(p.id,op)}
                            disabled={yaGuardo} activeOpacity={0.7}
                          >
                            <Text style={[{ fontSize:17, fontWeight:'bold', color:C.textSub }, activo&&{color:borderActive}]}>{op}</Text>
                            <Text style={[{ fontSize:11, color:C.textSub, marginTop:3 }, activo&&{color:borderActive}]} numberOfLines={1}>
                              {op==='1'?p.local.slice(0,8):op==='X'?'Empate':p.visitante.slice(0,8)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <InputMarcador
                      partido={p}
                      marcador={marcadores[p.id]??{local:'',visitante:''}}
                      onChange={m=>setMarcadorPartido(p.id,m)}
                      disabled={yaGuardo}
                      C={C}
                    />
                  </View>
                </NeonWrapper>
              );
            })}

            {!esPagado&&(
              <NeonWrapper
                color={todoSel ? C.accentGlow : 'transparent'}
                borderRadius={16} shadowRadius={todoSel ? 18 : 0} opacity={todoSel ? 1 : 0}
                style={{ marginHorizontal:16, marginTop:8 }}
              >
                <TouchableOpacity
                  style={[{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, padding:17, borderRadius:16, backgroundColor:C.card },
                    todoSel?{backgroundColor:C.accent}:{ backgroundColor:C.card, opacity:0.45 }
                  ]}
                  onPress={confirmarYPagar}
                  disabled={loadingPago||(!todoSel&&!yaGuardo)}
                  activeOpacity={0.8}
                >
                  {loadingPago
                    ?<ActivityIndicator color="#fff" />
                    :<>
                      <Ionicons name="card" size={18} color={todoSel?C.bg:'#fff'} />
                      <Text style={[{ color:'#fff', fontWeight:'bold', fontSize:16 }, todoSel&&{color:C.bg}]}>{yaGuardo?'Reintentar pago':'Confirmar y pagar'}</Text>
                      {jornada.precio!=null&&jornada.precio>0&&(
                        <View style={{ backgroundColor:'rgba(0,0,0,0.3)', borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}><Text style={[{ color:'#fff', fontSize:13, fontWeight:'800' }, todoSel&&{color:C.bg}]}>${jornada.precio}</Text></View>
                      )}
                    </>
                  }
                </TouchableOpacity>
              </NeonWrapper>
            )}
          </>
        )}

        <View style={{height:insets.bottom+40}} />
      </ScrollView>
    </View>
  );
}
