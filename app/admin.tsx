import React, { useEffect, useState, useRef } from 'react';
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
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.1)',
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
type Screen   = 'home'|'crear_quiniela'|'jornada_detalle'|'quinielas'|'ingresos';
type WizardStep = 1|2|3;

const confirmar = (titulo:string,mensaje:string,onConfirm:()=>void)=>{
  if(Platform.OS==='web'){if((window as any).confirm(`${titulo}\n\n${mensaje}`))onConfirm();}
  else{const{Alert}=require('react-native');Alert.alert(titulo,mensaje,[{text:'Cancelar',style:'cancel'},{text:'Confirmar',style:'destructive',onPress:onConfirm}]);}
};
const avisar=(titulo:string,mensaje:string)=>{
  if(Platform.OS==='web')(window as any).alert(`${titulo}\n\n${mensaje}`);
  else{const{Alert}=require('react-native');Alert.alert(titulo,mensaje);}
};

const LIGAS = [
  {nombre:'FIFA World Cup',id:'2000',temporada:'2026'},
  {nombre:'Liga MX',      id:'2137',temporada:'2026'},
  {nombre:'UEFA Champions',id:'2001',temporada:'2024'},
  {nombre:'Premier League',id:'2021',temporada:'2024'},
  {nombre:'La Liga',       id:'2014',temporada:'2024'},
  {nombre:'Serie A',       id:'2019',temporada:'2024'},
  {nombre:'Bundesliga',    id:'2002',temporada:'2024'},
  {nombre:'MLS',           id:'2024',temporada:'2025'},
];

function PulseBar({valor,max,color}:{valor:number;max:number;color:string}){
  const pct=max>0?Math.min(valor/max,1):0;
  const anim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(anim,{toValue:pct,duration:900,useNativeDriver:false}).start();},[pct]);
  return(
    <View style={{height:4,backgroundColor:C.cardBorder,borderRadius:2,overflow:'hidden',marginTop:8}}>
      <Animated.View style={{height:4,borderRadius:2,backgroundColor:color,width:anim.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
    </View>
  );
}

function StatChip({icon,value,label,color,dim}:{icon:string;value:string;label:string;color:string;dim:string}){
  return(
    <View style={[styles.statChip,{backgroundColor:dim,borderColor:color+'40'}]}>
      <Ionicons name={icon as any} size={20} color={color}/>
      <Text style={[styles.statChipVal,{color}]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

// ── Indicador de pasos del wizard ──────────────────────────────────────────
function WizardIndicator({step}:{step:WizardStep}){
  const steps=[{n:1,label:'Nombre'},{n:2,label:'Partidos'},{n:3,label:'Precio'}];
  return(
    <View style={styles.wizardIndicator}>
      {steps.map((s,i)=>(
        <React.Fragment key={s.n}>
          <View style={styles.wizardStepWrap}>
            <View style={[styles.wizardDot,step>=s.n&&{backgroundColor:C.accent,borderColor:C.accent}]}>
              {step>s.n
                ?<Ionicons name="checkmark" size={12} color="#fff"/>
                :<Text style={[styles.wizardDotNum,step===s.n&&{color:'#fff'}]}>{s.n}</Text>
              }
            </View>
            <Text style={[styles.wizardStepLabel,step>=s.n&&{color:C.accent}]}>{s.label}</Text>
          </View>
          {i<2&&<View style={[styles.wizardLine,step>s.n&&{backgroundColor:C.accent}]}/>}
        </React.Fragment>
      ))}
    </View>
  );
}

export default function AdminScreen(){
  const {usuario}=useAuth();
  const insets=useSafeAreaInsets();
  const router=useRouter();

  const [screen,setScreen]=useState<Screen>('home');
  const [jornadaSel,setJornadaSel]=useState<Jornada|null>(null);
  const [jornadas,setJornadas]=useState<Jornada[]>([]);
  const [partidos,setPartidos]=useState<Partido[]>([]);
  const [quinielas,setQuinielas]=useState<Quiniela[]>([]);
  const [loading,setLoading]=useState(true);
  const [syncingByJornada,setSyncingByJornada]=useState<Record<string,boolean>>({});
  const [borrando,setBorrando]=useState<string|null>(null);

  // ── Wizard crear quiniela ──────────────────────────────────────────────
  const [wizardStep,setWizardStep]=useState<WizardStep>(1);
  const [wNombre,setWNombre]=useState('');
  const [wPrecio,setWPrecio]=useState('');
  const [wLigaId,setWLigaId]=useState('2000');
  const [wTemporada,setWTemporada]=useState('2026');
  const [wModo,setWModo]=useState<'jornada'|'fecha'|'semana'>('jornada');
  const [wRound,setWRound]=useState('1');
  const [wFecha,setWFecha]=useState(new Date().toISOString().split('T')[0]);
  const [wFechaDesde,setWFechaDesde]=useState('');
  const [wFechaHasta,setWFechaHasta]=useState('');
  const [wFixtures,setWFixtures]=useState<Fixture[]>([]);
  const [wLoadingFix,setWLoadingFix]=useState(false);
  const [wSel,setWSel]=useState<Set<number>>(new Set());
  const [wCreando,setWCreando]=useState(false);

  // ── Modal resultado ────────────────────────────────────────────────────
  const [modalResultado,setModalResultado]=useState(false);
  const [partidoSel,setPartidoSel]=useState<Partido|null>(null);
  const [resultadoInput,setResultadoInput]=useState<'1'|'X'|'2'|null>(null);
  const [saving,setSaving]=useState(false);

  // ── Modal precio (editar precio de jornada existente) ─────────────────
  const [modalPrecio,setModalPrecio]=useState(false);
  const [jornadaPrecioSel,setJornadaPrecioSel]=useState<Jornada|null>(null);
  const [precioInput,setPrecioInput]=useState('');
  const [savingPrecio,setSavingPrecio]=useState(false);

  // ── Ingresos ──────────────────────────────────────────────────────────
  const [expandedJornada,setExpandedJornada]=useState<string|null>(null);

  useEffect(()=>{
    if(!usuario?.es_admin){avisar('Acceso denegado','No tienes permisos.');router.back();return;}
    cargarDatos();
  },[usuario]);

  const cargarDatos=async()=>{
    setLoading(true);
    const [{data:j},{data:p},{data:q}]=await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at',{ascending:false}),
      supabase.from('partidos').select('*').order('fecha'),
      supabase.from('quinielas').select('id,estado_pago,codigo,jornada_id,usuario_id,monto_cobrado,usuarios(nombre,username)'),
    ]);
    if(j)setJornadas(j);
    if(p)setPartidos(p);
    if(q)setQuinielas(q as any);
    setLoading(false);
  };

  // ── Wizard helpers ─────────────────────────────────────────────────────
  const resetWizard=()=>{
    setWizardStep(1);setWNombre('');setWPrecio('');setWLigaId('2000');setWTemporada('2026');
    setWModo('jornada');setWRound('1');setWFecha(new Date().toISOString().split('T')[0]);
    setWFechaDesde('');setWFechaHasta('');setWFixtures([]);setWSel(new Set());
  };

  const abrirCrear=()=>{ resetWizard(); setScreen('crear_quiniela'); };

  const wizardBuscarFixtures=async()=>{
    if(!wLigaId||!wTemporada){avisar('Faltan datos','Liga y temporada requeridos.');return;}
    setWLoadingFix(true);setWFixtures([]);setWSel(new Set());
    try{
      let data;
      if(wModo==='fecha') data=await apifb.fixtures(wLigaId,wTemporada,wFecha);
      else if(wModo==='semana') data=await apifb.fixturesPorSemana(wLigaId,wTemporada,wFechaDesde,wFechaHasta);
      else data=await apifb.fixturesPorRound(wLigaId,wTemporada,`Regular Season - ${wRound}`);
      const res:Fixture[]=data.response||[];
      setWFixtures(res);
      if(!res.length)avisar('Sin partidos',`No se encontraron partidos.`);
    }catch(e){avisar('Error',String(e));}
    setWLoadingFix(false);
  };

  // Crea jornada + importa partidos + guarda precio — todo en uno
  const wizardCrearQuiniela=async()=>{
    if(!wNombre.trim()){avisar('Falta nombre','Ponle nombre a la quiniela.');return;}
    setWCreando(true);
    try{
      // 1. Crear jornada
      const {data:jData,error:jErr}=await supabase
        .from('jornadas')
        .insert({nombre:wNombre.trim(),estado:'abierta',precio:wPrecio?parseFloat(wPrecio.replace(',','.')):null})
        .select().single();
      if(jErr||!jData){avisar('Error',jErr?.message||'No se pudo crear la jornada.');setWCreando(false);return;}

      // 2. Importar partidos seleccionados (si hay)
      if(wSel.size>0){
        const inserts=wFixtures.filter(f=>wSel.has(f.fixture.id)).map(f=>({
          local:f.teams.home.name,visitante:f.teams.away.name,fecha:f.fixture.date,
          jornada:0,jornada_id:jData.id,cerrado:false,api_fixture_id:f.fixture.id,
        }));
        if(wModo==='jornada'){
          await supabase.from('jornadas').update({api_competition_id:wLigaId,api_season:wTemporada,api_matchday:wRound}).eq('id',jData.id);
        }
        const {error:pErr}=await supabase.from('partidos').insert(inserts);
        if(pErr){avisar('Aviso',`Jornada creada pero error al importar partidos: ${pErr.message}`);}
      }

      await cargarDatos();
      resetWizard();
      // Abrir directo el detalle de la jornada recién creada
      setJornadaSel(jData);
      setScreen('jornada_detalle');
      avisar('✅ Quiniela creada',`"${jData.nombre}" lista${wSel.size>0?` con ${wSel.size} partido(s)`:''}${wPrecio?` · $${wPrecio} por quiniela`:''}`);
    }catch(e:any){avisar('Error',e.message);}
    setWCreando(false);
  };

  // ── CRUD existentes ────────────────────────────────────────────────────
  const cerrarJornada=(j:Jornada)=>{
    confirmar('Cerrar jornada',`¿Cerrar "${j.nombre}"? Los usuarios ya no podrán editar.`,async()=>{
      await supabase.from('jornadas').update({estado:'cerrada'}).eq('id',j.id);
      await supabase.from('partidos').update({cerrado:true}).eq('jornada_id',j.id);
      await cargarDatos();
      avisar('✅ Cerrada',`"${j.nombre}" cerrada.`);
    });
  };
  const finalizarJornada=(j:Jornada)=>{
    confirmar('Finalizar',`¿Marcar "${j.nombre}" como FINALIZADA?`,async()=>{
      await supabase.from('jornadas').update({estado:'finalizada'}).eq('id',j.id);
      await cargarDatos();
    });
  };
  const borrarJornada=(j:Jornada)=>{
    confirmar('⚠️ Borrar',`¿Eliminar "${j.nombre}" permanentemente?`,async()=>{
      setBorrando(j.id);
      try{
        const{data:psDB}=await supabase.from('partidos').select('id').eq('jornada_id',j.id);
        const psIds=(psDB||[]).map((p:any)=>p.id);
        if(psIds.length>0)await supabase.from('predicciones').delete().in('partido_id',psIds);
        await supabase.from('quinielas').delete().eq('jornada_id',j.id);
        await supabase.from('partidos').delete().eq('jornada_id',j.id);
        await supabase.from('jornadas').delete().eq('id',j.id);
        await cargarDatos();
        if(jornadaSel?.id===j.id){setJornadaSel(null);setScreen('home');}
        avisar('🗑️ Eliminada',`"${j.nombre}" eliminada.`);
      }catch(e:any){avisar('Error',e.message);await cargarDatos();}
      finally{setBorrando(null);}
    });
  };
  const sincronizarResultados=async(j:Jornada)=>{
    if(!j.api_competition_id||!j.api_season||!j.api_matchday){avisar('Sin datos API','Falta competition_id, season o matchday.');return;}
    setSyncingByJornada(prev=>({...prev,[j.id]:true}));
    try{
      const round=`Regular Season - ${j.api_matchday}`;
      const data=await apifb.fixturesPorRound(j.api_competition_id,j.api_season,round);
      const matches:Fixture[]=data.response||[];
      if(!matches.length){avisar('Sin datos','La API no devolvió partidos.');return;}
      const ps=partidos.filter(p=>p.jornada_id===j.id&&p.api_fixture_id);
      let actualizados=0;
      for(const p of ps){
        const match=matches.find(m=>m.fixture.id===p.api_fixture_id);
        if(!match||match.fixture.status.short!=='FT')continue;
        const goals=match.goals;
        if(goals?.home==null||goals?.away==null)continue;
        const res=goals.home>goals.away?'1':goals.away>goals.home?'2':'X';
        await supabase.from('partidos').update({resultado_final:res,cerrado:true}).eq('id',p.id).eq('jornada_id',j.id);
        actualizados++;
      }
      if(actualizados>0)await recalcularAciertos(j.id);
      await cargarDatos();
      avisar('✅ Sincronizado',`${actualizados} resultado(s) actualizado(s).`);
    }catch(e){avisar('Error',String(e));}
    finally{setSyncingByJornada(prev=>({...prev,[j.id]:false}));}
  };
  const recalcularAciertos=async(jornada_id:string)=>{
    const{data:pJs}=await supabase.from('partidos').select('id,resultado_final').eq('jornada_id',jornada_id).not('resultado_final','is',null);
    if(!pJs?.length)return;
    const ids=pJs.map(p=>p.id);
    const{data:qJs}=await supabase.from('quinielas').select('id,usuario_id').eq('jornada_id',jornada_id);
    for(const q of(qJs||[])){
      const{data:preds}=await supabase.from('predicciones').select('partido_id,resultado').eq('usuario_id',q.usuario_id).in('partido_id',ids);
      const aciertos=(preds||[]).filter(pr=>pJs.find(x=>x.id===pr.partido_id)?.resultado_final===pr.resultado).length;
      await supabase.from('quinielas').update({aciertos}).eq('id',q.id);
    }
  };
  const guardarResultado=async()=>{
    if(!resultadoInput||!partidoSel)return;
    setSaving(true);
    await supabase.from('partidos').update({resultado_final:resultadoInput,cerrado:true}).eq('id',partidoSel.id);
    await recalcularAciertos(partidoSel.jornada_id);
    setSaving(false);setModalResultado(false);cargarDatos();
  };
  const marcarPagado=async(qId:string,jornadaId:string)=>{
    const jornada=jornadas.find(j=>j.id===jornadaId);
    const monto=jornada?.precio??0;
    await supabase.from('quinielas').update({estado_pago:'pagado',monto_cobrado:monto}).eq('id',qId);
    cargarDatos();
  };
  const marcarPendiente=async(qId:string)=>{
    await supabase.from('quinielas').update({estado_pago:'pendiente'}).eq('id',qId);
    cargarDatos();
  };
  const guardarPrecio=async()=>{
    if(!jornadaPrecioSel)return;
    const precio=parseFloat(precioInput.replace(',','.'));
    if(isNaN(precio)||precio<0){avisar('Precio inválido','Número ≥ 0.');return;}
    setSavingPrecio(true);
    const{error}=await supabase.from('jornadas').update({precio}).eq('id',jornadaPrecioSel.id);
    setSavingPrecio(false);
    if(error){avisar('Error',error.message);return;}
    setModalPrecio(false);cargarDatos();
  };

  if(loading)return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  // ── Computed ───────────────────────────────────────────────────────────
  const pagados         =quinielas.filter(q=>q.estado_pago==='pagado').length;
  const pendientesTot   =quinielas.filter(q=>q.estado_pago==='pendiente').length;
  const recaudacionTotal=quinielas.filter(q=>q.estado_pago==='pagado').reduce((s,q)=>s+(q.monto_cobrado??0),0);
  const jornadasActivas =jornadas.filter(j=>j.estado==='abierta'||j.estado==='cerrada');
  const jornadasFin     =jornadas.filter(j=>j.estado==='finalizada');
  const quinPendientes  =quinielas.filter(q=>q.estado_pago==='pendiente');
  const statusColor     =(s:string)=>s==='FT'?C.green:s==='NS'?C.textSub:C.orange;
  const estadoColor     =(e:string)=>e==='abierta'?C.green:e==='cerrada'?C.orange:C.textSub;
  const estadoDim       =(e:string)=>e==='abierta'?C.greenDim:e==='cerrada'?C.orangeDim:'rgba(100,100,130,0.1)';
  const estadoLabel     =(e:string)=>e==='abierta'?'ABIERTA':e==='cerrada'?'EN CURSO':'FINALIZADA';
  const datosIngresos   =jornadas.map(j=>{
    const qJ=quinielas.filter(q=>q.jornada_id===j.id);
    const pagadasJ=qJ.filter(q=>q.estado_pago==='pagado');
    const pendientesJ=qJ.filter(q=>q.estado_pago!=='pagado');
    const recaudadoJ=pagadasJ.reduce((s,q)=>s+(q.monto_cobrado??0),0);
    const potencial=(j.precio??0)*pendientesJ.length;
    return{j,qJ,pagadasJ,pendientesJ,recaudadoJ,potencial};
  });
  const maxRecaudado=Math.max(...datosIngresos.map(d=>d.recaudadoJ),1);

  // ══════════════════════════════════════════════════════════════════════
  //  SCREEN: CREAR QUINIELA (wizard 3 pasos)
  // ══════════════════════════════════════════════════════════════════════
  const renderCrearQuiniela=()=>(
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <WizardIndicator step={wizardStep}/>

      <ScrollView contentContainerStyle={{padding:16,paddingBottom:80}} keyboardShouldPersistTaps="handled">

        {/* ── PASO 1: Nombre ── */}
        {wizardStep===1&&(
          <View>
            <Text style={styles.wizardTitulo}>¿Cómo se llama esta quiniela?</Text>
            <Text style={styles.wizardSub}>Elige un nombre descriptivo para que los participantes la identifiquen.</Text>
            <TextInput
              style={[styles.inputGrande]}
              value={wNombre}
              onChangeText={setWNombre}
              placeholder="Ej: Jornada 1 · Copa Mundial 2026"
              placeholderTextColor={C.textMuted}
              autoFocus
              maxLength={80}
            />
            <Text style={{color:C.textMuted,fontSize:11,textAlign:'right',marginTop:-4,marginBottom:16}}>{wNombre.length}/80</Text>
          </View>
        )}

        {/* ── PASO 2: Partidos ── */}
        {wizardStep===2&&(
          <View>
            <Text style={styles.wizardTitulo}>Importa los partidos</Text>
            <Text style={styles.wizardSub}>Selecciona los partidos de esta quiniela desde la API. También puedes saltarte este paso y agregarlos después.</Text>

            {/* Ligas rápidas */}
            <Text style={styles.label}>Liga rápida</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:8,marginBottom:12}}>
              {LIGAS.map(l=>(
                <TouchableOpacity key={l.id} style={[styles.ligaChip,wLigaId===l.id&&wTemporada===l.temporada&&styles.ligaChipActiva]} onPress={()=>{setWLigaId(l.id);setWTemporada(l.temporada);}} activeOpacity={0.7}>
                  <Text style={[styles.ligaChipTexto,wLigaId===l.id&&wTemporada===l.temporada&&{color:C.accent}]} numberOfLines={1}>{l.nombre}</Text>
                  <Text style={styles.ligaChipSub}>{l.temporada}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Inputs manuales */}
            <View style={{flexDirection:'row',gap:12,marginBottom:4}}>
              <View style={{flex:1}}><Text style={styles.label}>ID liga</Text><TextInput style={styles.input} value={wLigaId} onChangeText={setWLigaId} keyboardType="number-pad" placeholderTextColor={C.textMuted}/></View>
              <View style={{flex:1}}><Text style={styles.label}>Temporada</Text><TextInput style={styles.input} value={wTemporada} onChangeText={setWTemporada} keyboardType="number-pad" placeholderTextColor={C.textMuted} maxLength={4}/></View>
            </View>

            {/* Modo búsqueda */}
            <Text style={styles.label}>Buscar por</Text>
            <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
              {(['jornada','fecha','semana'] as const).map(m=>(
                <TouchableOpacity key={m} style={[styles.modoBtn,wModo===m&&styles.modoBtnActivo]} onPress={()=>setWModo(m)}>
                  <Text style={[styles.modoBtnTexto,wModo===m&&{color:C.accent}]}>{m==='jornada'?'Jornada':m==='fecha'?'Día':'Semana'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {wModo==='jornada'&&<><Text style={styles.label}>Número de jornada</Text><TextInput style={styles.input} value={wRound} onChangeText={setWRound} keyboardType="number-pad" placeholderTextColor={C.textMuted}/></>}
            {wModo==='fecha'&&<><Text style={styles.label}>Fecha (YYYY-MM-DD)</Text><TextInput style={styles.input} value={wFecha} onChangeText={setWFecha} placeholderTextColor={C.textMuted}/></>}
            {wModo==='semana'&&<><Text style={styles.label}>Desde</Text><TextInput style={styles.input} value={wFechaDesde} onChangeText={setWFechaDesde} placeholderTextColor={C.textMuted}/><Text style={styles.label}>Hasta</Text><TextInput style={styles.input} value={wFechaHasta} onChangeText={setWFechaHasta} placeholderTextColor={C.textMuted}/></>}

            <TouchableOpacity style={[styles.btnSecundarioPrimary,wLoadingFix&&{opacity:0.6}]} onPress={wizardBuscarFixtures} disabled={wLoadingFix} activeOpacity={0.8}>
              {wLoadingFix?<ActivityIndicator color={C.accent} size="small"/>:<><Ionicons name="search" size={15} color={C.accent}/><Text style={styles.btnSecundarioPrimaryTexto}>Buscar partidos</Text></>}
            </TouchableOpacity>

            {/* Lista de fixtures */}
            {wFixtures.length>0&&(
              <View style={{marginTop:14}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <Text style={styles.label}>{wFixtures.length} partidos encontrados — <Text style={{color:C.accent}}>{wSel.size} seleccionados</Text></Text>
                  <TouchableOpacity onPress={()=>wSel.size===wFixtures.length?setWSel(new Set()):setWSel(new Set(wFixtures.map(f=>f.fixture.id)))}>
                    <Text style={{color:C.accent,fontSize:12,fontWeight:'700'}}>{wSel.size===wFixtures.length?'Quitar todos':'Todos'}</Text>
                  </TouchableOpacity>
                </View>
                {wFixtures.map(f=>{
                  const sel=wSel.has(f.fixture.id);
                  return(
                    <TouchableOpacity key={f.fixture.id} style={[styles.fixtureRow,sel&&styles.fixtureRowSel]} onPress={()=>{const s=new Set(wSel);s.has(f.fixture.id)?s.delete(f.fixture.id):s.add(f.fixture.id);setWSel(s);}} activeOpacity={0.7}>
                      <View style={[styles.checkbox,sel&&styles.checkboxSel]}>{sel&&<Ionicons name="checkmark" size={13} color="#fff"/>}</View>
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
          </View>
        )}

        {/* ── PASO 3: Precio ── */}
        {wizardStep===3&&(
          <View>
            <Text style={styles.wizardTitulo}>¿Cuánto cuesta participar?</Text>
            <Text style={styles.wizardSub}>Define el precio por quiniela. Este monto se usará para registrar cobros y calcular la recaudación total.</Text>

            {/* Resumen de lo configurado */}
            <View style={styles.resumenCard}>
              <View style={styles.resumenRow}>
                <Ionicons name="trophy-outline" size={16} color={C.accent}/>
                <Text style={styles.resumenLabel}>Nombre</Text>
                <Text style={styles.resumenVal} numberOfLines={1}>{wNombre}</Text>
              </View>
              <View style={[styles.resumenRow,{borderTopWidth:1,borderTopColor:C.cardBorder,marginTop:8,paddingTop:8}]}>
                <Ionicons name="football-outline" size={16} color={C.accent}/>
                <Text style={styles.resumenLabel}>Partidos</Text>
                <Text style={styles.resumenVal}>{wSel.size>0?`${wSel.size} seleccionados`:'Sin partidos (agregar después)'}</Text>
              </View>
            </View>

            <Text style={styles.label}>Precio por quiniela (MXN)</Text>
            <TextInput
              style={styles.inputGrande}
              value={wPrecio}
              onChangeText={setWPrecio}
              keyboardType="decimal-pad"
              placeholder="Ej: 50"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <Text style={{color:C.textMuted,fontSize:11,marginBottom:8,marginTop:-4}}>Deja vacío si aún no defines el precio.</Text>
          </View>
        )}
      </ScrollView>

      {/* Barra de navegación del wizard */}
      <View style={[styles.wizardNavBar,{paddingBottom:insets.bottom+12}]}>
        {wizardStep>1
          ?<TouchableOpacity style={styles.btnWizardBack} onPress={()=>setWizardStep((wizardStep-1) as WizardStep)}>
              <Ionicons name="arrow-back" size={18} color={C.textSub}/>
              <Text style={styles.btnWizardBackTexto}>Atrás</Text>
           </TouchableOpacity>
          :<View style={{flex:1}}/>
        }
        {wizardStep<3
          ?<TouchableOpacity
              style={[styles.btnWizardNext,!wNombre.trim()&&wizardStep===1&&{opacity:0.4}]}
              onPress={()=>{
                if(wizardStep===1&&!wNombre.trim()){avisar('Falta nombre','Escribe un nombre para continuar.');return;}
                setWizardStep((wizardStep+1) as WizardStep);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.btnWizardNextTexto}>{wizardStep===2&&wSel.size===0?'Saltar paso':'Siguiente'}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff"/>
           </TouchableOpacity>
          :<TouchableOpacity
              style={[styles.btnWizardFinal,wCreando&&{opacity:0.6}]}
              onPress={wizardCrearQuiniela}
              disabled={wCreando}
              activeOpacity={0.85}
            >
              {wCreando
                ?<ActivityIndicator color="#fff" size="small"/>
                :<><Ionicons name="checkmark-circle" size={18} color="#fff"/><Text style={styles.btnWizardFinalTexto}>Crear quiniela</Text></>
              }
           </TouchableOpacity>
        }
      </View>
    </KeyboardAvoidingView>
  );

  // ══════════════════════════════════════════════════════════════════════
  //  SCREEN: DETALLE JORNADA
  // ══════════════════════════════════════════════════════════════════════
  const renderDetalleJornada=()=>{
    if(!jornadaSel)return null;
    const j=jornadas.find(x=>x.id===jornadaSel.id)||jornadaSel;
    const pJ=partidos.filter(p=>p.jornada_id===j.id);
    const conRes=pJ.filter(p=>p.resultado_final).length;
    const isOpen=j.estado==='abierta';
    const isCerrada=j.estado==='cerrada';
    const syncing=!!syncingByJornada[j.id];
    const esBorrando=borrando===j.id;
    const eColor=estadoColor(j.estado);
    const eDim=estadoDim(j.estado);
    return(
      <View style={{flex:1}}>
        <View style={[styles.detalleBanner,{backgroundColor:eDim,borderBottomColor:eColor+'30'}]}>
          <View style={{flex:1}}>
            <Text style={styles.detalleNombre} numberOfLines={2}>{j.nombre}</Text>
            <Text style={styles.detalleInfo}>{pJ.length} partidos · {conRes}/{pJ.length} resultados{j.precio?` · $${j.precio}/c`:''}</Text>
          </View>
          <View style={[styles.estadoPill,{backgroundColor:eColor+'20',borderColor:eColor}]}>
            <View style={[styles.estadoDot,{backgroundColor:eColor}]}/>
            <Text style={[styles.estadoPillTexto,{color:eColor}]}>{estadoLabel(j.estado)}</Text>
          </View>
        </View>
        <View style={styles.detalleAcciones}>
          {isOpen&&(
            <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.orangeDim,borderColor:C.orange}]} onPress={()=>cerrarJornada(j)}>
              <Ionicons name="lock-closed" size={15} color={C.orange}/><Text style={[styles.detalleBtnTexto,{color:C.orange}]}>Cerrar</Text>
            </TouchableOpacity>
          )}
          {(isOpen||isCerrada)&&j.api_competition_id&&(
            <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.accentDim,borderColor:C.accent},syncing&&{opacity:0.5}]} onPress={()=>sincronizarResultados(j)} disabled={syncing}>
              {syncing?<ActivityIndicator color={C.accent} size="small"/>:<><Ionicons name="sync" size={15} color={C.accent}/><Text style={[styles.detalleBtnTexto,{color:C.accent}]}>Sincronizar</Text></>}
            </TouchableOpacity>
          )}
          {isCerrada&&(
            <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.greenDim,borderColor:C.green}]} onPress={()=>finalizarJornada(j)}>
              <Ionicons name="checkmark-done" size={15} color={C.green}/><Text style={[styles.detalleBtnTexto,{color:C.green}]}>Finalizar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:'rgba(255,215,0,0.08)',borderColor:C.gold+'60'}]} onPress={()=>{setJornadaPrecioSel(j);setPrecioInput(j.precio?String(j.precio):'');setModalPrecio(true);}}>
            <Ionicons name="pricetag-outline" size={15} color={C.gold}/><Text style={[styles.detalleBtnTexto,{color:C.gold}]}>{j.precio?`$${j.precio}`:'Precio'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.redDim,borderColor:C.red},esBorrando&&{opacity:0.5}]} onPress={()=>borrarJornada(j)} disabled={esBorrando}>
            {esBorrando?<ActivityIndicator color={C.red} size="small"/>:<><Ionicons name="trash-outline" size={15} color={C.red}/><Text style={[styles.detalleBtnTexto,{color:C.red}]}>Borrar</Text></>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:16,paddingBottom:60}}>
          {pJ.length===0&&(
            <View style={styles.emptyCard}>
              <Ionicons name="football-outline" size={36} color={C.textMuted}/>
              <Text style={styles.emptyTexto}>Sin partidos aún.</Text>
            </View>
          )}
          {pJ.map(p=>{
            const fecha=new Date(p.fecha).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
            return(
              <View key={p.id} style={styles.partidoCard}>
                <View style={{flex:1}}>
                  <Text style={styles.partidoNombres}>{p.local} <Text style={{color:C.textSub}}>vs</Text> {p.visitante}</Text>
                  <Text style={styles.partidoFecha}>{fecha}</Text>
                </View>
                {p.resultado_final
                  ?<View style={[styles.resBadge,{borderColor:C.green,backgroundColor:C.greenDim}]}><Text style={[styles.resTexto,{color:C.green}]}>{p.resultado_final}</Text></View>
                  :<TouchableOpacity style={styles.btnAgregarRes} onPress={()=>{setPartidoSel(p);setResultadoInput(null);setModalResultado(true);}}>
                     <Ionicons name="add" size={14} color={C.accent}/><Text style={styles.btnAgregarResTexto}>Resultado</Text>
                   </TouchableOpacity>
                }
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // ══════════════════════════════════════════════════════════════════════
  //  SCREEN: QUINIELAS
  // ══════════════════════════════════════════════════════════════════════
  const renderQuinielas=()=>{
    const grouped=jornadas.map(j=>({j,qs:quinielas.filter(q=>q.jornada_id===j.id)})).filter(g=>g.qs.length>0);
    return(
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:60}}>
        {grouped.length===0&&<View style={styles.emptyCard}><Ionicons name="document-outline" size={36} color={C.textMuted}/><Text style={styles.emptyTexto}>No hay quinielas.</Text></View>}
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
                  ?<TouchableOpacity style={styles.btnPagarChico} onPress={()=>marcarPagado(q.id,j.id)}><Ionicons name="checkmark" size={13} color="#fff"/><Text style={styles.btnPagarChicoTexto}>Pagado</Text></TouchableOpacity>
                  :<TouchableOpacity style={[styles.btnPagarChico,{backgroundColor:C.orangeDim,borderWidth:1,borderColor:C.orange}]} onPress={()=>marcarPendiente(q.id)}><Text style={[styles.btnPagarChicoTexto,{color:C.orange}]}>Revertir</Text></TouchableOpacity>
                }
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  // ══════════════════════════════════════════════════════════════════════
  //  SCREEN: INGRESOS
  // ══════════════════════════════════════════════════════════════════════
  const renderIngresos=()=>{
    const potTotal=datosIngresos.reduce((s,d)=>s+d.potencial,0);
    return(
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:60}}>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard,{borderColor:C.gold+'50',backgroundColor:C.goldDim}]}><Text style={[styles.kpiVal,{color:C.gold}]}>${recaudacionTotal.toFixed(0)}</Text><Text style={styles.kpiLabel}>Recaudado</Text></View>
          <View style={[styles.kpiCard,{borderColor:C.green+'50',backgroundColor:C.greenDim}]}><Text style={[styles.kpiVal,{color:C.green}]}>{pagados}</Text><Text style={styles.kpiLabel}>Pagados</Text></View>
          <View style={[styles.kpiCard,{borderColor:C.orange+'50',backgroundColor:C.orangeDim}]}><Text style={[styles.kpiVal,{color:C.orange}]}>{pendientesTot}</Text><Text style={styles.kpiLabel}>Pendientes</Text></View>
        </View>
        {potTotal>0&&<View style={styles.potencialBanner}><Ionicons name="trending-up" size={15} color={C.orange}/><Text style={styles.potencialTexto}>Potencial pendiente: <Text style={{color:C.orange,fontWeight:'800'}}>${potTotal.toFixed(0)}</Text></Text></View>}
        {datosIngresos.map(({j,pagadasJ,pendientesJ,recaudadoJ,potencial})=>{
          const precio=j.precio??0;
          const isOpen=expandedJornada===j.id;
          return(
            <View key={j.id} style={styles.ingCard}>
              <TouchableOpacity style={styles.ingCardHeader} onPress={()=>setExpandedJornada(isOpen?null:j.id)} activeOpacity={0.8}>
                <View style={{flex:1}}><Text style={styles.ingCardNombre}>{j.nombre}</Text><Text style={styles.ingCardInfo}>{pagadasJ.length} pagadas · {pendientesJ.length} pend.</Text></View>
                <View style={{alignItems:'flex-end'}}><Text style={[styles.ingCardMonto,{color:recaudadoJ>0?C.gold:C.textSub}]}>${recaudadoJ.toFixed(0)}</Text>{precio>0&&<Text style={{color:C.textSub,fontSize:10}}>${precio}/c</Text>}</View>
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
                    <><Text style={[styles.grupLabel,{color:C.orange}]}>⏳ Pendientes ({pendientesJ.length}){precio>0?` · $${potencial.toFixed(0)} potencial`:''}</Text>
                      {pendientesJ.map(q=>(
                        <View key={q.id} style={styles.quinielaRow}>
                          <View style={{flex:1}}><Text style={styles.quinielaUser}>{(q.usuarios as any)?.username?`@${(q.usuarios as any).username}`:(q.usuarios as any)?.nombre||'Usuario'}</Text>{q.codigo&&<Text style={styles.quinielaCodigo}>🎫 {q.codigo}</Text>}</View>
                          <TouchableOpacity style={styles.btnPagarChico} onPress={()=>marcarPagado(q.id,j.id)}><Ionicons name="checkmark" size={13} color="#fff"/><Text style={styles.btnPagarChicoTexto}>Pagado</Text></TouchableOpacity>
                        </View>
                      ))}
                    </>
                  )}
                  {pagadasJ.length>0&&(
                    <><Text style={[styles.grupLabel,{color:C.green,marginTop:pendientesJ.length>0?12:0}]}>✅ Pagadas ({pagadasJ.length}) · ${recaudadoJ.toFixed(0)}</Text>
                      {pagadasJ.map(q=>(
                        <View key={q.id} style={[styles.quinielaRow,{opacity:0.8}]}>
                          <View style={{flex:1}}><Text style={styles.quinielaUser}>{(q.usuarios as any)?.username?`@${(q.usuarios as any).username}`:(q.usuarios as any)?.nombre||'Usuario'}</Text>{q.monto_cobrado!=null&&<Text style={{color:C.gold,fontSize:11}}>💵 ${q.monto_cobrado}</Text>}</View>
                          <TouchableOpacity style={[styles.btnPagarChico,{backgroundColor:C.orangeDim,borderWidth:1,borderColor:C.orange}]} onPress={()=>marcarPendiente(q.id)}><Text style={[styles.btnPagarChicoTexto,{color:C.orange}]}>Revertir</Text></TouchableOpacity>
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

  // ══════════════════════════════════════════════════════════════════════
  //  SCREEN: HOME
  // ══════════════════════════════════════════════════════════════════════
  const renderHome=()=>(
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:100}} showsVerticalScrollIndicator={false}>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatChip icon="trophy" value={`$${recaudacionTotal.toFixed(0)}`} label="Recaudado" color={C.gold} dim={C.goldDim}/>
        <StatChip icon="checkmark-circle" value={String(pagados)} label="Pagados" color={C.green} dim={C.greenDim}/>
        <StatChip icon="time" value={String(pendientesTot)} label="Pendientes" color={C.orange} dim={C.orangeDim}/>
        <StatChip icon="layers" value={String(jornadas.length)} label="Jornadas" color={C.accent} dim={C.accentDim}/>
      </View>

      {/* Alerta pagos pendientes */}
      {quinPendientes.length>0&&(
        <TouchableOpacity style={styles.alertaBanner} onPress={()=>setScreen('ingresos')} activeOpacity={0.8}>
          <View style={styles.alertaIconWrap}><Ionicons name="alert-circle" size={20} color={C.orange}/></View>
          <View style={{flex:1}}><Text style={styles.alertaTitulo}>{quinPendientes.length} pago{quinPendientes.length!==1?'s':''} pendiente{quinPendientes.length!==1?'s':''}</Text><Text style={styles.alertaSubtitulo}>Toca para ver y confirmar</Text></View>
          <Ionicons name="chevron-forward" size={16} color={C.orange}/>
        </TouchableOpacity>
      )}

      {/* Jornadas activas */}
      {jornadasActivas.length>0&&(
        <>
          <Text style={styles.sectionTitle}>Quinielas activas</Text>
          {jornadasActivas.map(j=>{
            const pJ=partidos.filter(p=>p.jornada_id===j.id);
            const conRes=pJ.filter(p=>p.resultado_final).length;
            const eColor=estadoColor(j.estado);
            const eDim=estadoDim(j.estado);
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            return(
              <TouchableOpacity key={j.id} style={[styles.jornadaCard,{borderLeftColor:eColor}]} onPress={()=>{setJornadaSel(j);setScreen('jornada_detalle');}} activeOpacity={0.8}>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4}}>
                    <View style={[styles.estadoPill,{backgroundColor:eDim,borderColor:eColor}]}>
                      <View style={[styles.estadoDot,{backgroundColor:eColor}]}/>
                      <Text style={[styles.estadoPillTexto,{color:eColor}]}>{estadoLabel(j.estado)}</Text>
                    </View>
                    {j.precio&&<Text style={{color:C.gold,fontSize:11,fontWeight:'700'}}>💵 ${j.precio}/c</Text>}
                  </View>
                  <Text style={styles.jornadaNombre}>{j.nombre}</Text>
                  <View style={{flexDirection:'row',gap:12,marginTop:6}}>
                    <Text style={styles.jornadaMeta}><Text style={{color:C.text,fontWeight:'700'}}>{pJ.length}</Text> partidos</Text>
                    <Text style={styles.jornadaMeta}><Text style={{color:C.accent,fontWeight:'700'}}>{conRes}</Text>/{pJ.length} res.</Text>
                    <Text style={styles.jornadaMeta}><Text style={{color:C.green,fontWeight:'700'}}>{qJ.length}</Text> quinielas</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textSub}/>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Historial */}
      {jornadasFin.length>0&&(
        <>
          <Text style={[styles.sectionTitle,{marginTop:8}]}>Historial</Text>
          {jornadasFin.map(j=>{
            const pJ=partidos.filter(p=>p.jornada_id===j.id);
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            return(
              <TouchableOpacity key={j.id} style={styles.jornadaFinCard} onPress={()=>{setJornadaSel(j);setScreen('jornada_detalle');}} activeOpacity={0.8}>
                <View style={{flex:1}}><Text style={styles.jornadaFinNombre}>{j.nombre}</Text><Text style={styles.jornadaMeta}>{pJ.length} partidos · {qJ.length} quinielas</Text></View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted}/>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {jornadas.length===0&&(
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={40} color={C.textMuted}/>
          <Text style={styles.emptyTexto}>Sin quinielas. Crea la primera.</Text>
        </View>
      )}
    </ScrollView>
  );

  // ══════════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════
  const isHome=screen==='home';
  const screenTitle:Record<Screen,string>={
    home:'🛡️ Admin',
    crear_quiniela:'Nueva quiniela',
    jornada_detalle:jornadaSel?.nombre||'Quiniela',
    quinielas:'📋 Quinielas',
    ingresos:'💰 Ingresos',
  };

  return(
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS==='ios'?'padding':'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* HEADER */}
      <View style={[styles.header,{paddingTop:insets.top+14}]}>
        {!isHome
          ?<TouchableOpacity onPress={()=>setScreen('home')} style={styles.backBtn}><Ionicons name="arrow-back" size={20} color={C.text}/></TouchableOpacity>
          :<TouchableOpacity onPress={()=>router.back()} style={styles.backBtn}><Ionicons name="close" size={20} color={C.text}/></TouchableOpacity>
        }
        <Text style={styles.headerTitle} numberOfLines={1}>{screenTitle[screen]}</Text>
        {screen==='jornada_detalle'
          ?<View style={{width:36}}/>
          :<View style={{width:36}}/>
        }
      </View>

      {/* CONTENT */}
      <View style={{flex:1}}>
        {screen==='home'            && renderHome()}
        {screen==='crear_quiniela'  && renderCrearQuiniela()}
        {screen==='jornada_detalle' && renderDetalleJornada()}
        {screen==='quinielas'       && renderQuinielas()}
        {screen==='ingresos'        && renderIngresos()}
      </View>

      {/* BOTTOM NAV */}
      {isHome&&(
        <View style={[styles.bottomNav,{paddingBottom:insets.bottom+6}]}>
          <TouchableOpacity style={styles.navItem} onPress={()=>setScreen('home')} activeOpacity={0.7}>
            <Ionicons name="home" size={22} color={C.accent}/>
            <Text style={[styles.navLabel,{color:C.accent}]}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={()=>setScreen('quinielas')} activeOpacity={0.7}>
            <Ionicons name="list-outline" size={22} color={C.textSub}/>
            <Text style={[styles.navLabel,{color:C.textSub}]}>Quinielas</Text>
          </TouchableOpacity>
          {/* Botón central grande CREAR */}
          <View style={styles.navCenterWrap}>
            <TouchableOpacity style={styles.navCenterBtn} onPress={abrirCrear} activeOpacity={0.85}>
              <Ionicons name="add" size={28} color="#fff"/>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.navItem} onPress={()=>setScreen('ingresos')} activeOpacity={0.7}>
            <Ionicons name="cash-outline" size={22} color={C.textSub}/>
            <Text style={[styles.navLabel,{color:C.textSub}]}>Ingresos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={cargarDatos} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={22} color={C.textSub}/>
            <Text style={[styles.navLabel,{color:C.textSub}]}>Actualizar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL RESULTADO */}
      <Modal visible={modalResultado} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Resultado manual</Text>
            <Text style={styles.modalSubtitulo}>{partidoSel?.local} vs {partidoSel?.visitante}</Text>
            <View style={{flexDirection:'row',gap:10,marginBottom:20}}>
              {(['1','X','2'] as const).map(op=>(
                <TouchableOpacity key={op} style={[styles.resOpcion,resultadoInput===op&&styles.resOpcionActiva]} onPress={()=>setResultadoInput(op)}>
                  <Text style={[styles.resOpcionTexto,resultadoInput===op&&{color:C.accent}]}>
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

      {/* MODAL PRECIO */}
      <Modal visible={modalPrecio} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitulo}>💲 Precio de quiniela</Text>
              <Text style={styles.modalSubtitulo}>{jornadaPrecioSel?.nombre}</Text>
              <Text style={styles.label}>Precio por quiniela (MXN)</Text>
              <TextInput style={styles.input} value={precioInput} onChangeText={setPrecioInput} keyboardType="decimal-pad" placeholder="Ej: 50" placeholderTextColor={C.textMuted} autoFocus/>
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

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg},

  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:16,backgroundColor:C.bg},
  backBtn:{width:36,height:36,borderRadius:10,backgroundColor:C.card,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:C.cardBorder},
  headerTitle:{flex:1,color:C.text,fontSize:17,fontWeight:'bold',textAlign:'center',marginHorizontal:8},

  // Stats
  statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:20},
  statChip:{width:(SW-42)/2,borderRadius:14,padding:14,borderWidth:1.5,gap:4},
  statChipVal:{fontSize:22,fontWeight:'900'},
  statChipLabel:{color:C.textSub,fontSize:11,fontWeight:'600'},

  // Alerta
  alertaBanner:{flexDirection:'row',alignItems:'center',backgroundColor:C.orangeDim,borderWidth:1.5,borderColor:C.orange+'60',borderRadius:14,padding:14,marginBottom:20,gap:12},
  alertaIconWrap:{width:36,height:36,borderRadius:10,backgroundColor:C.orange+'20',justifyContent:'center',alignItems:'center'},
  alertaTitulo:{color:C.orange,fontWeight:'800',fontSize:14},
  alertaSubtitulo:{color:C.textSub,fontSize:12,marginTop:1},

  sectionTitle:{color:C.text,fontWeight:'800',fontSize:14,marginBottom:12,letterSpacing:0.2},

  jornadaCard:{backgroundColor:C.card,borderRadius:14,padding:16,marginBottom:10,borderWidth:1,borderColor:C.cardBorder,flexDirection:'row',alignItems:'center',borderLeftWidth:4},
  jornadaNombre:{color:C.text,fontWeight:'bold',fontSize:15},
  jornadaMeta:{color:C.textSub,fontSize:12},
  jornadaFinCard:{backgroundColor:C.card,borderRadius:12,padding:14,marginBottom:8,borderWidth:1,borderColor:C.cardBorder,flexDirection:'row',alignItems:'center',opacity:0.7},
  jornadaFinNombre:{color:C.text,fontWeight:'600',fontSize:13},
  estadoPill:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:3,borderRadius:20,borderWidth:1},
  estadoDot:{width:6,height:6,borderRadius:3},
  estadoPillTexto:{fontSize:10,fontWeight:'800',letterSpacing:0.5},

  detalleBanner:{paddingHorizontal:16,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1},
  detalleNombre:{color:C.text,fontWeight:'bold',fontSize:16},
  detalleInfo:{color:C.textSub,fontSize:11,marginTop:3},
  detalleAcciones:{flexDirection:'row',flexWrap:'wrap',gap:8,padding:16,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  detalleBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:10,borderWidth:1.5},
  detalleBtnTexto:{fontSize:12,fontWeight:'700'},

  partidoCard:{backgroundColor:C.card,borderRadius:12,padding:14,marginBottom:8,borderWidth:1,borderColor:C.cardBorder,flexDirection:'row',alignItems:'center'},
  partidoNombres:{color:C.text,fontWeight:'600',fontSize:13},
  partidoFecha:{color:C.textSub,fontSize:11,marginTop:3},
  resBadge:{borderRadius:8,paddingHorizontal:10,paddingVertical:6,borderWidth:1.5},
  resTexto:{fontWeight:'900',fontSize:15},
  btnAgregarRes:{flexDirection:'row',alignItems:'center',gap:4,borderWidth:1,borderColor:C.accent+'60',borderRadius:8,paddingHorizontal:10,paddingVertical:6,backgroundColor:C.accentDim},
  btnAgregarResTexto:{color:C.accent,fontSize:12,fontWeight:'700'},

  // Wizard
  wizardIndicator:{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingHorizontal:24,paddingVertical:16,backgroundColor:C.card,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  wizardStepWrap:{alignItems:'center',gap:4},
  wizardDot:{width:28,height:28,borderRadius:14,borderWidth:2,borderColor:C.cardBorder,justifyContent:'center',alignItems:'center',backgroundColor:C.bg},
  wizardDotNum:{color:C.textSub,fontSize:12,fontWeight:'700'},
  wizardStepLabel:{color:C.textSub,fontSize:10,fontWeight:'600'},
  wizardLine:{flex:1,height:2,backgroundColor:C.cardBorder,marginHorizontal:6,marginBottom:14},
  wizardTitulo:{color:C.text,fontSize:22,fontWeight:'900',marginBottom:8,lineHeight:28},
  wizardSub:{color:C.textSub,fontSize:13,marginBottom:24,lineHeight:19},
  inputGrande:{borderWidth:2,borderColor:C.cardBorder,borderRadius:14,padding:16,fontSize:16,color:C.text,backgroundColor:C.card,marginBottom:6},
  resumenCard:{backgroundColor:C.card,borderRadius:14,padding:16,marginBottom:20,borderWidth:1,borderColor:C.cardBorder,gap:4},
  resumenRow:{flexDirection:'row',alignItems:'center',gap:10},
  resumenLabel:{color:C.textSub,fontSize:12,fontWeight:'600',width:70},
  resumenVal:{color:C.text,fontSize:13,fontWeight:'700',flex:1},
  wizardNavBar:{flexDirection:'row',gap:12,paddingHorizontal:16,paddingTop:12,backgroundColor:C.card,borderTopWidth:1,borderTopColor:C.cardBorder},
  btnWizardBack:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,padding:14,borderRadius:12,borderWidth:1.5,borderColor:C.cardBorder},
  btnWizardBackTexto:{color:C.textSub,fontWeight:'600',fontSize:14},
  btnWizardNext:{flex:2,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.accent,padding:14,borderRadius:12},
  btnWizardNextTexto:{color:'#fff',fontWeight:'bold',fontSize:15},
  btnWizardFinal:{flex:2,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.green,padding:14,borderRadius:12},
  btnWizardFinalTexto:{color:'#fff',fontWeight:'bold',fontSize:15},
  btnSecundarioPrimary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderWidth:1.5,borderColor:C.accent,borderRadius:10,padding:11,marginTop:4},
  btnSecundarioPrimaryTexto:{color:C.accent,fontWeight:'700',fontSize:13},

  // Importar
  ligaChip:{borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,paddingHorizontal:12,paddingVertical:8,backgroundColor:C.bg,minWidth:110,alignItems:'center'},
  ligaChipActiva:{borderColor:C.accent,backgroundColor:C.accentDim},
  ligaChipTexto:{color:C.textSub,fontSize:12,fontWeight:'700'},
  ligaChipSub:{color:C.textSub,fontSize:10,marginTop:2,opacity:0.7},
  modoBtn:{flex:1,padding:9,borderRadius:10,borderWidth:1.5,borderColor:C.cardBorder,alignItems:'center'},
  modoBtnActivo:{borderColor:C.accent,backgroundColor:C.accentDim},
  modoBtnTexto:{color:C.textSub,fontWeight:'600',fontSize:12},
  fixtureRow:{flexDirection:'row',alignItems:'center',padding:11,borderRadius:10,marginBottom:6,borderWidth:1.5,borderColor:C.cardBorder,backgroundColor:C.bg},
  fixtureRowSel:{borderColor:C.accent,backgroundColor:C.accentDim},
  checkbox:{width:22,height:22,borderRadius:6,borderWidth:2,borderColor:C.textSub,justifyContent:'center',alignItems:'center'},
  checkboxSel:{backgroundColor:C.accent,borderColor:C.accent},
  fixtureEquipos:{color:C.text,fontWeight:'600',fontSize:13},
  fixtureFecha:{color:C.textSub,fontSize:11,marginTop:2},
  statusBadge:{borderWidth:1.5,borderRadius:6,paddingHorizontal:6,paddingVertical:2},
  statusTexto:{fontSize:10,fontWeight:'700'},

  // Quinielas
  grupCard:{backgroundColor:C.card,borderRadius:14,padding:16,marginBottom:12,borderWidth:1,borderColor:C.cardBorder},
  grupHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
  grupNombre:{color:C.text,fontWeight:'bold',fontSize:14,flex:1},
  grupBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:8,fontSize:11,fontWeight:'700',overflow:'hidden'},
  quinielaRow:{flexDirection:'row',alignItems:'center',paddingVertical:9,borderTopWidth:1,borderTopColor:C.cardBorder},
  quinielaUser:{color:C.text,fontSize:13,fontWeight:'600'},
  quinielaCodigo:{color:C.textSub,fontSize:11,marginTop:1},
  btnPagarChico:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.green,paddingHorizontal:10,paddingVertical:6,borderRadius:8},
  btnPagarChicoTexto:{color:'#fff',fontSize:11,fontWeight:'700'},

  // Ingresos
  kpiRow:{flexDirection:'row',gap:10,marginBottom:14},
  kpiCard:{flex:1,borderRadius:14,padding:12,alignItems:'center',borderWidth:1.5,gap:2},
  kpiVal:{fontSize:20,fontWeight:'900'},
  kpiLabel:{color:C.textSub,fontSize:10,fontWeight:'600'},
  potencialBanner:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:C.orangeDim,borderWidth:1,borderColor:C.orange+'40',borderRadius:10,padding:12,marginBottom:14},
  potencialTexto:{color:C.textSub,fontSize:13},
  ingCard:{backgroundColor:C.card,borderRadius:14,padding:16,marginBottom:12,borderWidth:1,borderColor:C.cardBorder},
  ingCardHeader:{flexDirection:'row',alignItems:'center'},
  ingCardNombre:{color:C.text,fontWeight:'bold',fontSize:14},
  ingCardInfo:{color:C.textSub,fontSize:11,marginTop:2},
  ingCardMonto:{fontSize:18,fontWeight:'900'},
  btnPrecio:{flexDirection:'row',alignItems:'center',gap:5,marginTop:10,alignSelf:'flex-start',backgroundColor:C.accentDim,borderWidth:1,borderColor:C.accent+'50',borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  btnPrecioTexto:{color:C.accent,fontSize:11,fontWeight:'700'},
  grupLabel:{fontSize:12,fontWeight:'700',marginBottom:6},

  label:{fontSize:12,fontWeight:'600',color:C.textSub,marginBottom:5,marginTop:4},
  input:{borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,padding:12,marginBottom:8,fontSize:14,color:C.text,backgroundColor:C.bg},
  btnPrimary:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.accent,padding:13,borderRadius:12},
  btnPrimaryTexto:{color:'#fff',fontWeight:'bold',fontSize:14},
  btnSecundario:{flex:1,padding:14,borderRadius:12,borderWidth:1.5,borderColor:C.cardBorder,alignItems:'center'},
  btnSecundarioTexto:{color:C.textSub,fontWeight:'600'},
  emptyCard:{alignItems:'center',paddingVertical:50,gap:12},
  emptyTexto:{color:C.textSub,fontSize:13,textAlign:'center',maxWidth:220},

  // Bottom nav
  bottomNav:{flexDirection:'row',backgroundColor:C.card,borderTopWidth:1,borderTopColor:C.cardBorder,paddingTop:10,alignItems:'flex-end'},
  navItem:{flex:1,alignItems:'center',gap:3,paddingBottom:4},
  navLabel:{fontSize:10,fontWeight:'600'},
  navCenterWrap:{flex:1,alignItems:'center',marginTop:-22},
  navCenterBtn:{width:56,height:56,borderRadius:28,backgroundColor:C.accent,justifyContent:'center',alignItems:'center',shadowColor:C.accent,shadowOpacity:0.5,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:8},

  // Modal
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.75)',justifyContent:'flex-end'},
  modalCard:{backgroundColor:C.card,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:34,borderTopWidth:1,borderColor:C.cardBorder},
  modalTitulo:{fontSize:18,fontWeight:'bold',color:C.text,marginBottom:4},
  modalSubtitulo:{fontSize:13,color:C.textSub,marginBottom:16},
  modalBtns:{flexDirection:'row',gap:10,marginTop:4},
  resOpcion:{flex:1,borderWidth:2,borderColor:C.cardBorder,borderRadius:12,padding:14,alignItems:'center',backgroundColor:C.bg},
  resOpcionActiva:{borderColor:C.accent,backgroundColor:C.accentDim},
  resOpcionTexto:{fontSize:13,color:C.textSub,textAlign:'center',fontWeight:'600'},
});
