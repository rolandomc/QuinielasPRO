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
import { calcularGanador, ResumenGanador } from '../lib/ganador';

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

type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null; api_fixture_id:number|null; goles_local_real:number|null; goles_visitante_real:number|null };
type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null; porcentaje_organizador?:number|null };
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

  const [wizardStep,setWizardStep]=useState<WizardStep>(1);
  const [wNombre,setWNombre]=useState('');
  const [wPrecio,setWPrecio]=useState('');
  const [wPorcOrg,setWPorcOrg]=useState('');
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

  const [modalResultado,setModalResultado]=useState(false);
  const [partidoSel,setPartidoSel]=useState<Partido|null>(null);
  const [resultadoInput,setResultadoInput]=useState<'1'|'X'|'2'|null>(null);
  const [golesLocalInput,setGolesLocalInput]=useState('');
  const [golesVisitanteInput,setGolesVisitanteInput]=useState('');
  const [saving,setSaving]=useState(false);

  const [modalPrecio,setModalPrecio]=useState(false);
  const [jornadaPrecioSel,setJornadaPrecioSel]=useState<Jornada|null>(null);
  const [precioInput,setPrecioInput]=useState('');
  const [porcOrgInput,setPorcOrgInput]=useState('');
  const [savingPrecio,setSavingPrecio]=useState(false);

  const [modalGanador,setModalGanador]=useState(false);
  const [resumenGanador,setResumenGanador]=useState<ResumenGanador|null>(null);
  const [calculando,setCalculando]=useState(false);

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

  const resetWizard=()=>{
    setWizardStep(1);setWNombre('');setWPrecio('');setWPorcOrg('');setWLigaId('2000');setWTemporada('2026');
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

  const wizardCrearQuiniela=async()=>{
    if(!wNombre.trim()){avisar('Falta nombre','Ponle nombre a la quiniela.');return;}
    setWCreando(true);
    try{
      const precio=wPrecio?parseFloat(wPrecio.replace(',','.')):null;
      const porcOrg=wPorcOrg?parseInt(wPorcOrg,10):0;
      const {data:jData,error:jErr}=await supabase
        .from('jornadas')
        .insert({nombre:wNombre.trim(),estado:'abierta',precio,porcentaje_organizador:porcOrg})
        .select().single();
      if(jErr||!jData){avisar('Error',jErr?.message||'No se pudo crear la jornada.');setWCreando(false);return;}
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
      setJornadaSel(jData);
      setScreen('jornada_detalle');
      avisar('✅ Quiniela creada',`"${jData.nombre}" lista${wSel.size>0?` con ${wSel.size} partido(s)`:''}${precio?` · $${precio} por quiniela`:''}`);
    }catch(e:any){avisar('Error',e.message);}
    setWCreando(false);
  };

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
        await supabase.from('partidos').update({
          resultado_final:res,
          cerrado:true,
          goles_local_real:goals.home,
          goles_visitante_real:goals.away,
        }).eq('id',p.id).eq('jornada_id',j.id);
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
    const gl=golesLocalInput!==''?parseInt(golesLocalInput,10):null;
    const gv=golesVisitanteInput!==''?parseInt(golesVisitanteInput,10):null;
    let res:'1'|'X'|'2'=resultadoInput;
    if(gl!=null&&gv!=null){
      res=gl>gv?'1':gv>gl?'2':'X';
    }
    await supabase.from('partidos').update({
      resultado_final:res,
      cerrado:true,
      goles_local_real:gl,
      goles_visitante_real:gv,
    }).eq('id',partidoSel.id);
    await recalcularAciertos(partidoSel.jornada_id);
    setSaving(false);setModalResultado(false);cargarDatos();
  };

  const handleCalcularGanador=async(j:Jornada)=>{
    setCalculando(true);
    setResumenGanador(null);
    setModalGanador(true);
    try{
      const resumen=await calcularGanador(j.id);
      setResumenGanador(resumen);
    }catch(e:any){
      avisar('Error',e.message);
      setModalGanador(false);
    }
    setCalculando(false);
  };

  const marcarPagado=async(qId:string,jornadaId:string)=>{
    const jornada=jornadas.find(j=>j.id===jornadaId);
    const monto=jornada?.precio??0;
    await supabase.from('quinielas').update({estado_pago:'pagado',monto_cobrado:monto}).eq('id',qId);
    const qsPagadas=quinielas.filter(q=>q.jornada_id===jornadaId&&(q.id===qId||q.estado_pago==='pagado'));
    const nuevaBolsa=qsPagadas.length*(jornada?.precio??0);
    await supabase.from('jornadas').update({bolsa_total:nuevaBolsa}).eq('id',jornadaId);
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
    const porcOrg=porcOrgInput!==''?parseInt(porcOrgInput,10):0;
    if(isNaN(porcOrg)||porcOrg<0||porcOrg>100){avisar('% inválido','Entre 0 y 100.');return;}
    setSavingPrecio(true);
    const{error}=await supabase.from('jornadas').update({precio,porcentaje_organizador:porcOrg}).eq('id',jornadaPrecioSel.id);
    setSavingPrecio(false);
    if(error){avisar('Error',error.message);return;}
    setModalPrecio(false);cargarDatos();
  };

  if(loading)return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  const pagados          = quinielas.filter(q=>q.estado_pago==='pagado').length;
  const pendientesTot    = quinielas.filter(q=>q.estado_pago==='pendiente').length;
  const recaudacionTotal = quinielas.filter(q=>q.estado_pago==='pagado').reduce((s,q)=>s+(q.monto_cobrado??0),0);
  const jornadasActivas  = jornadas.filter(j=>j.estado==='abierta'||j.estado==='cerrada');
  const jornadasFin      = jornadas.filter(j=>j.estado==='finalizada');
  const quinPendientes   = quinielas.filter(q=>q.estado_pago==='pendiente');
  const statusColor      = (s:string)=>s==='FT'?C.green:s==='NS'?C.textSub:C.orange;
  const estadoColor      = (e:string)=>e==='abierta'?C.green:e==='cerrada'?C.orange:C.textSub;
  const estadoDim        = (e:string)=>e==='abierta'?C.greenDim:e==='cerrada'?C.orangeDim:'rgba(100,100,130,0.1)';
  const estadoLabel      = (e:string)=>e==='abierta'?'ABIERTA':e==='cerrada'?'EN CURSO':'FINALIZADA';
  const datosIngresos    = jornadas.map(j=>{
    const qJ=quinielas.filter(q=>q.jornada_id===j.id);
    const pagadasJ=qJ.filter(q=>q.estado_pago==='pagado');
    const pendientesJ=qJ.filter(q=>q.estado_pago!=='pagado');
    const recaudadoJ=pagadasJ.reduce((s,q)=>s+(q.monto_cobrado??0),0);
    const potencial=(j.precio??0)*pendientesJ.length;
    return{j,qJ,pagadasJ,pendientesJ,recaudadoJ,potencial};
  });
  const maxRecaudado=Math.max(...datosIngresos.map(d=>d.recaudadoJ),1);

  const mostrarNav = screen !== 'crear_quiniela';

  const renderCrearQuiniela=()=>(
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
      <WizardIndicator step={wizardStep}/>
      <ScrollView contentContainerStyle={{padding:16,paddingBottom:80}} keyboardShouldPersistTaps="handled">
        {wizardStep===1&&(
          <View>
            <Text style={styles.wizardTitulo}>¿Cómo se llama esta quiniela?</Text>
            <Text style={styles.wizardSub}>Elige un nombre descriptivo para que los participantes la identifiquen.</Text>
            <TextInput style={[styles.inputGrande]} value={wNombre} onChangeText={setWNombre} placeholder="Ej: Jornada 1 · Copa Mundial 2026" placeholderTextColor={C.textMuted} autoFocus maxLength={80}/>
            <Text style={{color:C.textMuted,fontSize:11,textAlign:'right',marginTop:-4,marginBottom:16}}>{wNombre.length}/80</Text>
          </View>
        )}
        {wizardStep===2&&(
          <View>
            <Text style={styles.wizardTitulo}>Importa los partidos</Text>
            <Text style={styles.wizardSub}>Selecciona los partidos de esta quiniela desde la API. También puedes saltarte este paso y agregarlos después.</Text>
            <Text style={styles.label}>Liga rápida</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingBottom:8,marginBottom:12}}>
              {LIGAS.map(l=>(
                <TouchableOpacity key={l.id} style={[styles.ligaChip,wLigaId===l.id&&wTemporada===l.temporada&&styles.ligaChipActiva]} onPress={()=>{setWLigaId(l.id);setWTemporada(l.temporada);}} activeOpacity={0.7}>
                  <Text style={[styles.ligaChipTexto,wLigaId===l.id&&wTemporada===l.temporada&&{color:C.accent}]} numberOfLines={1}>{l.nombre}</Text>
                  <Text style={styles.ligaChipSub}>{l.temporada}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{flexDirection:'row',gap:12,marginBottom:4}}>
              <View style={{flex:1}}><Text style={styles.label}>ID liga</Text><TextInput style={styles.input} value={wLigaId} onChangeText={setWLigaId} keyboardType="number-pad" placeholderTextColor={C.textMuted}/></View>
              <View style={{flex:1}}><Text style={styles.label}>Temporada</Text><TextInput style={styles.input} value={wTemporada} onChangeText={setWTemporada} keyboardType="number-pad" placeholderTextColor={C.textMuted} maxLength={4}/></View>
            </View>
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
            {wFixtures.length>0&&(
              <View style={{marginTop:14}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <Text style={styles.label}>{wFixtures.length} partidos — <Text style={{color:C.accent}}>{wSel.size} sel.</Text></Text>
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
        {wizardStep===3&&(
          <View>
            <Text style={styles.wizardTitulo}>¿Cuánto cuesta participar?</Text>
            <Text style={styles.wizardSub}>Define el precio y el porcentaje del organizador. El resto va al premio.</Text>
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
            <TextInput style={styles.inputGrande} value={wPrecio} onChangeText={setWPrecio} keyboardType="decimal-pad" placeholder="Ej: 50" placeholderTextColor={C.textMuted} autoFocus/>
            <Text style={styles.label}>% para el organizador</Text>
            <TextInput style={styles.inputGrande} value={wPorcOrg} onChangeText={setWPorcOrg} keyboardType="number-pad" placeholder="Ej: 20  (0 = todo va al premio)" placeholderTextColor={C.textMuted}/>
            <Text style={{color:C.textMuted,fontSize:11,marginBottom:8,marginTop:-4}}>El resto se distribuye como premio al ganador.</Text>
          </View>
        )}
      </ScrollView>
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

  const renderDetalleJornada=()=>{
    if(!jornadaSel)return null;
    const j=jornadas.find(x=>x.id===jornadaSel.id)||jornadaSel;
    const pJ=partidos.filter(p=>p.jornada_id===j.id);
    const conRes=pJ.filter(p=>p.resultado_final).length;
    const isOpen=j.estado==='abierta';
    const isCerrada=j.estado==='cerrada';
    const isFinalizada=j.estado==='finalizada';
    const syncing=!!syncingByJornada[j.id];
    const esBorrando=borrando===j.id;
    const eColor=estadoColor(j.estado);
    const eDim=estadoDim(j.estado);
    const qJ=quinielas.filter(q=>q.jornada_id===j.id&&q.estado_pago==='pagado');
    const bolsaTotal=qJ.reduce((s,q)=>s+(q.monto_cobrado??0),0);
    const porcOrg=j.porcentaje_organizador??0;
    const bolsaPremio=bolsaTotal*((100-porcOrg)/100);
    return(
      <View style={{flex:1}}>
        <View style={[styles.detalleBanner,{backgroundColor:eDim,borderBottomColor:eColor+'30'}]}>
          <View style={{flex:1}}>
            <Text style={styles.detalleNombre} numberOfLines={2}>{j.nombre}</Text>
            <Text style={styles.detalleInfo}>{pJ.length} partidos · {conRes}/{pJ.length} resultados{j.precio?` · $${j.precio}/c`:''}{porcOrg>0?` · ${porcOrg}% org.`:''}</Text>
          </View>
          <View style={[styles.estadoPill,{backgroundColor:eColor+'20',borderColor:eColor}]}>
            <View style={[styles.estadoDot,{backgroundColor:eColor}]}/>
            <Text style={[styles.estadoPillTexto,{color:eColor}]}>{estadoLabel(j.estado)}</Text>
          </View>
        </View>

        {bolsaTotal>0&&(
          <View style={styles.bolsaInfoRow}>
            <View style={styles.bolsaInfoItem}>
              <Text style={styles.bolsaInfoLabel}>Bolsa total</Text>
              <Text style={[styles.bolsaInfoVal,{color:C.gold}]}>${bolsaTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.bolsaInfoSep}/>
            <View style={styles.bolsaInfoItem}>
              <Text style={styles.bolsaInfoLabel}>Premio ({100-porcOrg}%)</Text>
              <Text style={[styles.bolsaInfoVal,{color:C.green}]}>${bolsaPremio.toFixed(2)}</Text>
            </View>
            <View style={styles.bolsaInfoSep}/>
            <View style={styles.bolsaInfoItem}>
              <Text style={styles.bolsaInfoLabel}>Organizador</Text>
              <Text style={[styles.bolsaInfoVal,{color:C.orange}]}>${(bolsaTotal-bolsaPremio).toFixed(2)}</Text>
            </View>
          </View>
        )}

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
          {isFinalizada&&(
            <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.goldDim,borderColor:C.gold},calculando&&{opacity:0.5}]} onPress={()=>handleCalcularGanador(j)} disabled={calculando}>
              {calculando?<ActivityIndicator color={C.gold} size="small"/>:<><Ionicons name="trophy" size={15} color={C.gold}/><Text style={[styles.detalleBtnTexto,{color:C.gold}]}>Ganador</Text></>}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:'rgba(255,215,0,0.08)',borderColor:C.gold+'60'}]} onPress={()=>{
            setJornadaPrecioSel(j);
            setPrecioInput(j.precio?String(j.precio):'');
            setPorcOrgInput(j.porcentaje_organizador!=null?String(j.porcentaje_organizador):'0');
            setModalPrecio(true);
          }}>
            <Ionicons name="pricetag-outline" size={15} color={C.gold}/>
            <Text style={[styles.detalleBtnTexto,{color:C.gold}]}>{j.precio?`$${j.precio}`:'Precio'}{porcOrg>0?` · ${porcOrg}%`:''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.redDim,borderColor:C.red},esBorrando&&{opacity:0.5}]} onPress={()=>borrarJornada(j)} disabled={esBorrando}>
            {esBorrando?<ActivityIndicator color={C.red} size="small"/>:<><Ionicons name="trash-outline" size={15} color={C.red}/><Text style={[styles.detalleBtnTexto,{color:C.red}]}>Borrar</Text></>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{padding:16,paddingBottom:80}}>
          {pJ.length===0&&(
            <View style={styles.emptyCard}>
              <Ionicons name="football-outline" size={36} color={C.textMuted}/>
              <Text style={styles.emptyTexto}>Sin partidos. Usa el botón + para agregar.</Text>
            </View>
          )}
          {pJ.map(p=>{
            const tieneRes=!!p.resultado_final;
            const marcador=p.goles_local_real!=null&&p.goles_visitante_real!=null
              ?`${p.goles_local_real}-${p.goles_visitante_real}`
              :null;
            return(
              <TouchableOpacity key={p.id} style={[styles.partidoCard,tieneRes&&styles.partidoCardConRes]} onPress={()=>{setPartidoSel(p);setResultadoInput(p.resultado_final as any||null);setGolesLocalInput(p.goles_local_real!=null?String(p.goles_local_real):'');setGolesVisitanteInput(p.goles_visitante_real!=null?String(p.goles_visitante_real):'');setModalResultado(true);}} activeOpacity={0.75}>
                <View style={styles.partidoEquiposRow}>
                  <Text style={styles.partidoEquipo} numberOfLines={1}>{p.local}</Text>
                  <View style={styles.partidoCentro}>
                    {marcador
                      ?<Text style={styles.marcadorReal}>{marcador}</Text>
                      :<Text style={styles.vsTexto}>vs</Text>
                    }
                    {tieneRes&&(
                      <View style={[styles.resBadge,{backgroundColor:p.resultado_final==='1'?C.greenDim:p.resultado_final==='X'?C.orangeDim:C.accentDim}]}>
                        <Text style={[styles.resBadgeTexto,{color:p.resultado_final==='1'?C.green:p.resultado_final==='X'?C.orange:C.accent}]}>{p.resultado_final}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.partidoEquipo,{textAlign:'right'}]} numberOfLines={1}>{p.visitante}</Text>
                </View>
                <Text style={styles.partidoFecha}>{new Date(p.fecha).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderHome=()=>(
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:100}}>
      <View style={styles.statsRow}>
        <StatChip icon="trophy-outline" value={String(jornadasActivas.length)} label="Activas" color={C.green} dim={C.greenDim}/>
        <StatChip icon="people-outline" value={String(quinielas.length)} label="Quinielas" color={C.accent} dim={C.accentDim}/>
        <StatChip icon="cash-outline" value={`$${recaudacionTotal.toFixed(0)}`} label="Recaudado" color={C.gold} dim={C.goldDim}/>
        <StatChip icon="time-outline" value={String(pendientesTot)} label="Pendientes" color={C.orange} dim={C.orangeDim}/>
      </View>
      {jornadasActivas.length>0&&(
        <>
          <Text style={styles.seccionTitulo}>Jornadas activas</Text>
          {jornadasActivas.map(j=>{
            const pJ=partidos.filter(p=>p.jornada_id===j.id);
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            const pagJ=qJ.filter(q=>q.estado_pago==='pagado').length;
            const eColor=estadoColor(j.estado);
            return(
              <TouchableOpacity key={j.id} style={styles.jornadaCard} onPress={()=>{setJornadaSel(j);setScreen('jornada_detalle');}} activeOpacity={0.8}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:6}}>
                  <View style={[styles.estadoPillSmall,{backgroundColor:eColor+'20',borderColor:eColor}]}>
                    <View style={[styles.estadoDotSmall,{backgroundColor:eColor}]}/>
                    <Text style={[styles.estadoPillSmallTexto,{color:eColor}]}>{estadoLabel(j.estado)}</Text>
                  </View>
                  {j.precio&&<Text style={styles.jornadaPrecioTag}>${j.precio}/c</Text>}
                </View>
                <Text style={styles.jornadaNombre} numberOfLines={2}>{j.nombre}</Text>
                <View style={styles.jornadaMeta}>
                  <Text style={styles.jornadaMetaTexto}>{pJ.length} partidos</Text>
                  <Text style={styles.jornadaMetaSep}>·</Text>
                  <Text style={styles.jornadaMetaTexto}>{qJ.length} quinielas</Text>
                  <Text style={styles.jornadaMetaSep}>·</Text>
                  <Text style={[styles.jornadaMetaTexto,{color:C.green}]}>{pagJ} pagadas</Text>
                </View>
                <PulseBar valor={pagJ} max={Math.max(qJ.length,1)} color={C.green}/>
              </TouchableOpacity>
            );
          })}
        </>
      )}
      {jornadasFin.length>0&&(
        <>
          <Text style={[styles.seccionTitulo,{marginTop:20}]}>Finalizadas</Text>
          {jornadasFin.map(j=>{
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            const recJ=qJ.filter(q=>q.estado_pago==='pagado').reduce((s,q)=>s+(q.monto_cobrado??0),0);
            return(
              <TouchableOpacity key={j.id} style={[styles.jornadaCard,{opacity:0.7}]} onPress={()=>{setJornadaSel(j);setScreen('jornada_detalle');}} activeOpacity={0.8}>
                <Text style={styles.jornadaNombre} numberOfLines={1}>{j.nombre}</Text>
                <View style={styles.jornadaMeta}>
                  <Text style={styles.jornadaMetaTexto}>{qJ.length} quinielas</Text>
                  {recJ>0&&<><Text style={styles.jornadaMetaSep}>·</Text><Text style={[styles.jornadaMetaTexto,{color:C.gold}]}>${recJ.toFixed(0)} rec.</Text></>}
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      )}
      {jornadas.length===0&&(
        <View style={styles.emptyCard}>
          <Ionicons name="trophy-outline" size={48} color={C.textMuted}/>
          <Text style={styles.emptyTexto}>No hay quinielas todavía.</Text>
          <Text style={[styles.emptyTexto,{fontSize:13,marginTop:4}]}>Toca + para crear la primera.</Text>
        </View>
      )}
    </ScrollView>
  );

  const renderQuinielas=()=>(
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:100}}>
      {quinPendientes.length>0&&(
        <>
          <Text style={styles.seccionTitulo}>Pagos pendientes ({quinPendientes.length})</Text>
          {quinPendientes.map(q=>{
            const j=jornadas.find(x=>x.id===q.jornada_id);
            return(
              <View key={q.id} style={styles.quinielaCard}>
                <View style={{flex:1}}>
                  <Text style={styles.quinielaNombre}>{q.usuarios?.nombre||'—'}</Text>
                  <Text style={styles.quinielaUser}>@{q.usuarios?.username||''} · {j?.nombre||''}</Text>
                  {q.codigo&&<Text style={styles.quinielaCodigo}>Código: {q.codigo}</Text>}
                </View>
                <TouchableOpacity style={styles.btnPagar} onPress={()=>marcarPagado(q.id,q.jornada_id)} activeOpacity={0.8}>
                  <Text style={styles.btnPagarTexto}>Pagado ✓</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}
      <Text style={[styles.seccionTitulo,{marginTop:quinPendientes.length>0?20:0}]}>Todas las quinielas</Text>
      {quinielas.length===0&&(
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={C.textMuted}/>
          <Text style={styles.emptyTexto}>No hay quinielas registradas aún.</Text>
        </View>
      )}
      {jornadas.map(j=>{
        const qJ=quinielas.filter(q=>q.jornada_id===j.id);
        if(!qJ.length)return null;
        const isExp=expandedJornada===j.id;
        return(
          <View key={j.id} style={{marginBottom:12}}>
            <TouchableOpacity style={styles.jornadaHeaderRow} onPress={()=>setExpandedJornada(isExp?null:j.id)} activeOpacity={0.8}>
              <View style={{flex:1}}>
                <Text style={styles.jornadaHeaderNombre} numberOfLines={1}>{j.nombre}</Text>
                <Text style={styles.jornadaHeaderSub}>{qJ.length} quinielas · {qJ.filter(q=>q.estado_pago==='pagado').length} pagadas</Text>
              </View>
              <Ionicons name={isExp?'chevron-up':'chevron-down'} size={18} color={C.textSub}/>
            </TouchableOpacity>
            {isExp&&qJ.map(q=>(
              <View key={q.id} style={[styles.quinielaCard,{marginTop:4}]}>
                <View style={{flex:1}}>
                  <Text style={styles.quinielaNombre}>{q.usuarios?.nombre||'—'}</Text>
                  <Text style={styles.quinielaUser}>@{q.usuarios?.username||''}</Text>
                  {q.codigo&&<Text style={styles.quinielaCodigo}>Código: {q.codigo}</Text>}
                </View>
                {q.estado_pago==='pagado'
                  ?<TouchableOpacity style={[styles.btnPagar,{backgroundColor:C.greenDim,borderColor:C.green}]} onPress={()=>marcarPendiente(q.id)} activeOpacity={0.8}>
                     <Text style={[styles.btnPagarTexto,{color:C.green}]}>Pagado ✓</Text>
                   </TouchableOpacity>
                  :<TouchableOpacity style={styles.btnPagar} onPress={()=>marcarPagado(q.id,q.jornada_id)} activeOpacity={0.8}>
                     <Text style={styles.btnPagarTexto}>Cobrar</Text>
                   </TouchableOpacity>
                }
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );

  const renderIngresos=()=>(
    <ScrollView contentContainerStyle={{padding:16,paddingBottom:100}}>
      <View style={styles.statsRow}>
        <StatChip icon="cash-outline" value={`$${recaudacionTotal.toFixed(0)}`} label="Total recaudado" color={C.gold} dim={C.goldDim}/>
        <StatChip icon="checkmark-circle-outline" value={String(pagados)} label="Pagadas" color={C.green} dim={C.greenDim}/>
      </View>
      <Text style={[styles.seccionTitulo,{marginTop:16}]}>Por jornada</Text>
      {datosIngresos.map(({j,qJ,pagadasJ,pendientesJ,recaudadoJ,potencial})=>(
        <View key={j.id} style={styles.ingresoCard}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
            <Text style={styles.ingresoNombre} numberOfLines={2}>{j.nombre}</Text>
            <Text style={[styles.ingresoMonto,{color:C.gold}]}>${recaudadoJ.toFixed(0)}</Text>
          </View>
          <View style={{flexDirection:'row',gap:16,marginBottom:2}}>
            <Text style={styles.ingresoSub}><Text style={{color:C.green}}>{pagadasJ.length}</Text> pagadas</Text>
            <Text style={styles.ingresoSub}><Text style={{color:C.orange}}>{pendientesJ.length}</Text> pendientes</Text>
            {potencial>0&&<Text style={styles.ingresoSub}><Text style={{color:C.textSub}}>+${potencial.toFixed(0)}</Text> potencial</Text>}
          </View>
          <PulseBar valor={recaudadoJ} max={maxRecaudado} color={C.gold}/>
        </View>
      ))}
    </ScrollView>
  );

  const renderModalResultado=()=>(
    <Modal visible={modalResultado} transparent animationType="slide" onRequestClose={()=>setModalResultado(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Capturar resultado</Text>
            <TouchableOpacity onPress={()=>setModalResultado(false)}><Ionicons name="close" size={22} color={C.textSub}/></TouchableOpacity>
          </View>
          {partidoSel&&(
            <>
              <Text style={styles.modalPartidoNombre}>{partidoSel.local} vs {partidoSel.visitante}</Text>
              <Text style={styles.modalLabel}>Marcador real (opcional)</Text>
              <View style={{flexDirection:'row',gap:12,marginBottom:12}}>
                <View style={{flex:1}}>
                  <Text style={[styles.modalLabel,{fontSize:11,marginBottom:4}]}>{partidoSel.local}</Text>
                  <TextInput style={styles.input} value={golesLocalInput} onChangeText={setGolesLocalInput} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.textMuted}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={[styles.modalLabel,{fontSize:11,marginBottom:4}]}>{partidoSel.visitante}</Text>
                  <TextInput style={styles.input} value={golesVisitanteInput} onChangeText={setGolesVisitanteInput} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.textMuted}/>
                </View>
              </View>
              <Text style={styles.modalLabel}>Resultado</Text>
              <View style={styles.resultadoBtnsRow}>
                {(['1','X','2'] as const).map(r=>(
                  <TouchableOpacity key={r} style={[styles.resultadoBtn,resultadoInput===r&&styles.resultadoBtnActivo]} onPress={()=>setResultadoInput(r)} activeOpacity={0.8}>
                    <Text style={[styles.resultadoBtnTexto,resultadoInput===r&&{color:'#fff'}]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.btnGuardar,(!resultadoInput||saving)&&{opacity:0.5}]} onPress={guardarResultado} disabled={!resultadoInput||saving} activeOpacity={0.85}>
                {saving?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnGuardarTexto}>Guardar resultado</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderModalPrecio=()=>(
    <Modal visible={modalPrecio} transparent animationType="slide" onRequestClose={()=>setModalPrecio(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Precio y organizador</Text>
            <TouchableOpacity onPress={()=>setModalPrecio(false)}><Ionicons name="close" size={22} color={C.textSub}/></TouchableOpacity>
          </View>
          <Text style={styles.modalLabel}>Precio por quiniela (MXN)</Text>
          <TextInput style={styles.input} value={precioInput} onChangeText={setPrecioInput} keyboardType="decimal-pad" placeholder="Ej: 50" placeholderTextColor={C.textMuted} autoFocus/>
          <Text style={[styles.modalLabel,{marginTop:12}]}>% para el organizador (0-100)</Text>
          <TextInput style={styles.input} value={porcOrgInput} onChangeText={setPorcOrgInput} keyboardType="number-pad" placeholder="Ej: 20" placeholderTextColor={C.textMuted}/>
          <Text style={{color:C.textMuted,fontSize:11,marginBottom:12,marginTop:4}}>El resto va al ganador como premio.</Text>
          <TouchableOpacity style={[styles.btnGuardar,savingPrecio&&{opacity:0.5}]} onPress={guardarPrecio} disabled={savingPrecio} activeOpacity={0.85}>
            {savingPrecio?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.btnGuardarTexto}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderModalGanador=()=>(
    <Modal visible={modalGanador} transparent animationType="slide" onRequestClose={()=>setModalGanador(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard,{maxHeight:'90%'}]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>🏆 Tabla de posiciones</Text>
            <TouchableOpacity onPress={()=>setModalGanador(false)}><Ionicons name="close" size={22} color={C.textSub}/></TouchableOpacity>
          </View>
          {calculando&&<ActivityIndicator color={C.gold} size="large" style={{marginVertical:24}}/>}
          {!calculando&&resumenGanador&&(
            <ScrollView>
              <View style={[styles.ganadorBanner,{backgroundColor:C.goldDim,borderColor:C.gold}]}>
                {resumenGanador.empate_perfecto
                  ?<Text style={styles.ganadorTitulo}>🤝 Empate — premio compartido</Text>
                  :<Text style={styles.ganadorTitulo}>🥇 {resumenGanador.ganador_nombre}</Text>
                }
                <Text style={styles.ganadorPremio}>Premio: ${resumenGanador.premio_por_ganador.toFixed(2)}{resumenGanador.empate_perfecto?' c/u':''}</Text>
                <View style={{flexDirection:'row',gap:16,marginTop:4}}>
                  <Text style={styles.ganadorSub}>Bolsa: ${resumenGanador.bolsa_total.toFixed(2)}</Text>
                  <Text style={styles.ganadorSub}>Org. {resumenGanador.porcentaje_organizador}%: ${(resumenGanador.bolsa_total-resumenGanador.bolsa_premio).toFixed(2)}</Text>
                </View>
              </View>
              {resumenGanador.posiciones.map(pos=>{
                const medals=['🥇','🥈','🥉'];
                const medal=pos.posicion<=3?medals[pos.posicion-1]:null;
                const isGanador=pos.premio_ganado>0;
                return(
                  <View key={pos.quiniela_id} style={[styles.posRow,isGanador&&{backgroundColor:C.goldDim,borderColor:C.gold+'60'}]}>
                    <Text style={styles.posNum}>{medal||pos.posicion}</Text>
                    <View style={{flex:1,marginLeft:10}}>
                      <Text style={[styles.posNombre,isGanador&&{color:C.gold}]}>{pos.nombre}</Text>
                      <Text style={styles.posSub}>{pos.aciertos} aciertos{pos.diferencia_goles!=null?` · Δgoles: ${pos.diferencia_goles}`:''}</Text>
                    </View>
                    {pos.premio_ganado>0&&(
                      <View style={styles.posPremio}>
                        <Text style={styles.posPremioTexto}>${pos.premio_ganado.toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
          {!calculando&&!resumenGanador&&(
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTexto}>No hay datos suficientes para calcular el ganador.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return(
    <View style={[styles.root,{paddingTop:insets.top}]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {mostrarNav&&(
        <View style={styles.header}>
          {screen!=='home'
            ?<TouchableOpacity style={styles.headerBack} onPress={()=>setScreen('home')}>
               <Ionicons name="arrow-back" size={20} color={C.text}/>
             </TouchableOpacity>
            :<View style={{width:36}}/>
          }
          <Text style={styles.headerTitulo}>
            {screen==='home'?'Admin':screen==='jornada_detalle'?(jornadaSel?.nombre||'Detalle'):screen==='quinielas'?'Quinielas':'Ingresos'}
          </Text>
          <View style={{width:36}}/>
        </View>
      )}

      <View style={{flex:1}}>
        {screen==='home'&&renderHome()}
        {screen==='crear_quiniela'&&renderCrearQuiniela()}
        {screen==='jornada_detalle'&&renderDetalleJornada()}
        {screen==='quinielas'&&renderQuinielas()}
        {screen==='ingresos'&&renderIngresos()}
      </View>

      {mostrarNav&&(
        <View style={[styles.bottomNav,{paddingBottom:insets.bottom+4}]}>
          <TouchableOpacity style={styles.navTab} onPress={()=>setScreen('home')} activeOpacity={0.7}>
            <Ionicons name="home-outline" size={22} color={screen==='home'?C.accent:C.textMuted}/>
            <Text style={[styles.navTabLabel,screen==='home'&&{color:C.accent}]}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navTab,styles.navTabCenter]} onPress={abrirCrear} activeOpacity={0.7}>
            <View style={styles.navAddBtn}>
              <Ionicons name="add" size={26} color="#fff"/>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navTab} onPress={()=>setScreen('ingresos')} activeOpacity={0.7}>
            <Ionicons name="bar-chart-outline" size={22} color={screen==='ingresos'?C.accent:C.textMuted}/>
            <Text style={[styles.navTabLabel,screen==='ingresos'&&{color:C.accent}]}>Ingresos</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderModalResultado()}
      {renderModalPrecio()}
      {renderModalGanador()}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  headerBack:{width:36,height:36,justifyContent:'center',alignItems:'center'},
  headerTitulo:{fontSize:17,fontWeight:'700',color:C.text,flex:1,textAlign:'center'},
  bottomNav:{flexDirection:'row',backgroundColor:C.card,borderTopWidth:1,borderTopColor:C.cardBorder},
  navTab:{flex:1,alignItems:'center',paddingTop:10,paddingBottom:4,gap:2},
  navTabCenter:{justifyContent:'center',paddingTop:0,paddingBottom:0},
  navAddBtn:{width:52,height:52,backgroundColor:C.accent,borderRadius:26,justifyContent:'center',alignItems:'center',marginBottom:8,shadowColor:C.accent,shadowOffset:{width:0,height:4},shadowOpacity:0.5,shadowRadius:8,elevation:8},
  navTabLabel:{fontSize:10,color:C.textMuted,fontWeight:'500'},
  statsRow:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:20},
  statChip:{flex:1,minWidth:'44%',borderRadius:12,borderWidth:1,padding:12,alignItems:'center',gap:4},
  statChipVal:{fontSize:20,fontWeight:'800'},
  statChipLabel:{fontSize:11,color:C.textSub,fontWeight:'500'},
  seccionTitulo:{fontSize:13,fontWeight:'700',color:C.textSub,letterSpacing:1,textTransform:'uppercase',marginBottom:10},
  jornadaCard:{backgroundColor:C.card,borderRadius:14,borderWidth:1,borderColor:C.cardBorder,padding:14,marginBottom:10},
  jornadaNombre:{fontSize:15,fontWeight:'700',color:C.text,marginBottom:6},
  jornadaMeta:{flexDirection:'row',alignItems:'center',gap:6},
  jornadaMetaTexto:{fontSize:12,color:C.textSub},
  jornadaMetaSep:{fontSize:12,color:C.textMuted},
  jornadaPrecioTag:{fontSize:11,color:C.gold,fontWeight:'600',marginLeft:8},
  estadoPillSmall:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:20,borderWidth:1},
  estadoDotSmall:{width:5,height:5,borderRadius:3},
  estadoPillSmallTexto:{fontSize:10,fontWeight:'700'},
  ingresoCard:{backgroundColor:C.card,borderRadius:14,borderWidth:1,borderColor:C.cardBorder,padding:14,marginBottom:10},
  ingresoNombre:{fontSize:14,fontWeight:'700',color:C.text,flex:1,marginRight:8},
  ingresoMonto:{fontSize:18,fontWeight:'800'},
  ingresoSub:{fontSize:12,color:C.textSub},
  quinielaCard:{backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.cardBorder,padding:12,flexDirection:'row',alignItems:'center',gap:10,marginBottom:6},
  quinielaNombre:{fontSize:14,fontWeight:'700',color:C.text},
  quinielaUser:{fontSize:12,color:C.textSub,marginTop:1},
  quinielaCodigo:{fontSize:11,color:C.textMuted,marginTop:2},
  btnPagar:{backgroundColor:C.orangeDim,borderWidth:1,borderColor:C.orange,paddingHorizontal:12,paddingVertical:7,borderRadius:10},
  btnPagarTexto:{fontSize:12,fontWeight:'700',color:C.orange},
  jornadaHeaderRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.cardBorder,padding:12,marginBottom:2},
  jornadaHeaderNombre:{fontSize:14,fontWeight:'700',color:C.text},
  jornadaHeaderSub:{fontSize:12,color:C.textSub,marginTop:2},
  detalleBanner:{padding:16,borderBottomWidth:1,flexDirection:'row',alignItems:'flex-start',gap:12},
  detalleNombre:{fontSize:18,fontWeight:'800',color:C.text,marginBottom:4},
  detalleInfo:{fontSize:12,color:C.textSub},
  estadoPill:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:1},
  estadoDot:{width:6,height:6,borderRadius:3},
  estadoPillTexto:{fontSize:11,fontWeight:'700'},
  detalleAcciones:{flexDirection:'row',flexWrap:'wrap',gap:8,padding:12,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  detalleBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:7,borderRadius:10,borderWidth:1},
  detalleBtnTexto:{fontSize:12,fontWeight:'700'},
  bolsaInfoRow:{flexDirection:'row',padding:12,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  bolsaInfoItem:{flex:1,alignItems:'center'},
  bolsaInfoSep:{width:1,backgroundColor:C.cardBorder,marginVertical:4},
  bolsaInfoLabel:{fontSize:10,color:C.textSub,marginBottom:2},
  bolsaInfoVal:{fontSize:16,fontWeight:'800'},
  emptyCard:{alignItems:'center',justifyContent:'center',padding:40,gap:8},
  emptyTexto:{fontSize:14,color:C.textMuted,textAlign:'center'},
  partidoCard:{backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.cardBorder,padding:12,marginBottom:8},
  partidoCardConRes:{borderColor:C.green+'40',backgroundColor:'rgba(0,200,151,0.04)'},
  partidoEquiposRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:4},
  partidoEquipo:{flex:1,fontSize:13,fontWeight:'600',color:C.text},
  partidoCentro:{alignItems:'center',gap:4},
  vsTexto:{fontSize:12,color:C.textMuted,fontWeight:'600'},
  marcadorReal:{fontSize:15,fontWeight:'800',color:C.green},
  resBadge:{paddingHorizontal:8,paddingVertical:2,borderRadius:8},
  resBadgeTexto:{fontSize:12,fontWeight:'800'},
  partidoFecha:{fontSize:11,color:C.textMuted},
  modalOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'flex-end'},
  modalCard:{backgroundColor:C.card,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,borderTopWidth:1,borderColor:C.cardBorder},
  modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},
  modalTitulo:{fontSize:17,fontWeight:'800',color:C.text},
  modalLabel:{fontSize:12,color:C.textSub,fontWeight:'600',marginBottom:8},
  modalPartidoNombre:{fontSize:14,fontWeight:'700',color:C.text,marginBottom:16,textAlign:'center'},
  resultadoBtnsRow:{flexDirection:'row',gap:10,marginBottom:16},
  resultadoBtn:{flex:1,paddingVertical:14,borderRadius:12,borderWidth:2,borderColor:C.cardBorder,alignItems:'center'},
  resultadoBtnActivo:{backgroundColor:C.accent,borderColor:C.accent},
  resultadoBtnTexto:{fontSize:18,fontWeight:'800',color:C.textSub},
  btnGuardar:{backgroundColor:C.accent,borderRadius:12,paddingVertical:14,alignItems:'center'},
  btnGuardarTexto:{fontSize:15,fontWeight:'800',color:'#fff'},
  ganadorBanner:{borderRadius:14,borderWidth:1,padding:16,marginBottom:16,alignItems:'center'},
  ganadorTitulo:{fontSize:18,fontWeight:'800',color:C.gold,textAlign:'center'},
  ganadorPremio:{fontSize:22,fontWeight:'900',color:C.green,marginTop:4},
  ganadorSub:{fontSize:12,color:C.textSub},
  posRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.cardBorder,padding:12,marginBottom:6},
  posNum:{fontSize:20,width:32,textAlign:'center'},
  posNombre:{fontSize:14,fontWeight:'700',color:C.text},
  posSub:{fontSize:12,color:C.textSub,marginTop:2},
  posPremio:{backgroundColor:C.greenDim,borderRadius:8,borderWidth:1,borderColor:C.green,paddingHorizontal:10,paddingVertical:4},
  posPremioTexto:{fontSize:13,fontWeight:'800',color:C.green},
  wizardIndicator:{flexDirection:'row',alignItems:'center',justifyContent:'center',padding:16,borderBottomWidth:1,borderBottomColor:C.cardBorder},
  wizardStepWrap:{alignItems:'center',gap:4},
  wizardDot:{width:28,height:28,borderRadius:14,borderWidth:2,borderColor:C.cardBorder,justifyContent:'center',alignItems:'center'},
  wizardDotNum:{fontSize:13,fontWeight:'700',color:C.textMuted},
  wizardStepLabel:{fontSize:10,color:C.textMuted,fontWeight:'600'},
  wizardLine:{flex:1,height:2,backgroundColor:C.cardBorder,marginHorizontal:8,marginBottom:16},
  wizardTitulo:{fontSize:22,fontWeight:'800',color:C.text,marginBottom:8},
  wizardSub:{fontSize:14,color:C.textSub,marginBottom:20,lineHeight:20},
  wizardNavBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16,borderTopWidth:1,borderTopColor:C.cardBorder,gap:12},
  btnWizardBack:{flexDirection:'row',alignItems:'center',gap:6,flex:1,paddingVertical:14,borderRadius:12,borderWidth:1,borderColor:C.cardBorder,justifyContent:'center'},
  btnWizardBackTexto:{fontSize:14,fontWeight:'700',color:C.textSub},
  btnWizardNext:{flexDirection:'row',alignItems:'center',gap:8,flex:2,paddingVertical:14,borderRadius:12,backgroundColor:C.accent,justifyContent:'center'},
  btnWizardNextTexto:{fontSize:15,fontWeight:'800',color:'#fff'},
  btnWizardFinal:{flexDirection:'row',alignItems:'center',gap:8,flex:2,paddingVertical:14,borderRadius:12,backgroundColor:C.green,justifyContent:'center'},
  btnWizardFinalTexto:{fontSize:15,fontWeight:'800',color:'#fff'},
  label:{fontSize:12,color:C.textSub,fontWeight:'600',marginBottom:6},
  input:{backgroundColor:C.cardBorder,borderRadius:10,padding:12,color:C.text,fontSize:14,marginBottom:12},
  inputGrande:{backgroundColor:C.cardBorder,borderRadius:12,padding:16,color:C.text,fontSize:18,fontWeight:'700',marginBottom:16},
  ligaChip:{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:C.card,borderWidth:1,borderColor:C.cardBorder,alignItems:'center'},
  ligaChipActiva:{borderColor:C.accent,backgroundColor:C.accentDim},
  ligaChipTexto:{fontSize:12,fontWeight:'700',color:C.textSub},
  ligaChipSub:{fontSize:10,color:C.textMuted},
  modoBtn:{flex:1,paddingVertical:8,borderRadius:10,backgroundColor:C.card,borderWidth:1,borderColor:C.cardBorder,alignItems:'center'},
  modoBtnActivo:{borderColor:C.accent,backgroundColor:C.accentDim},
  modoBtnTexto:{fontSize:13,fontWeight:'700',color:C.textSub},
  fixtureRow:{flexDirection:'row',alignItems:'center',backgroundColor:C.card,borderRadius:10,borderWidth:1,borderColor:C.cardBorder,padding:10,marginBottom:6},
  fixtureRowSel:{borderColor:C.accent,backgroundColor:C.accentDim},
  checkbox:{width:20,height:20,borderRadius:5,borderWidth:2,borderColor:C.cardBorder,justifyContent:'center',alignItems:'center'},
  checkboxSel:{backgroundColor:C.accent,borderColor:C.accent},
  fixtureEquipos:{fontSize:13,fontWeight:'700',color:C.text},
  fixtureFecha:{fontSize:11,color:C.textMuted,marginTop:2},
  statusBadge:{paddingHorizontal:6,paddingVertical:2,borderRadius:6,borderWidth:1},
  statusTexto:{fontSize:10,fontWeight:'700'},
  btnSecundarioPrimary:{flexDirection:'row',alignItems:'center',gap:6,justifyContent:'center',padding:12,borderRadius:12,borderWidth:1,borderColor:C.accent,backgroundColor:C.accentDim,marginBottom:4},
  btnSecundarioPrimaryTexto:{fontSize:14,fontWeight:'700',color:C.accent},
  resumenCard:{backgroundColor:C.card,borderRadius:12,borderWidth:1,borderColor:C.cardBorder,padding:14,marginBottom:16},
  resumenRow:{flexDirection:'row',alignItems:'center',gap:10},
  resumenLabel:{fontSize:12,color:C.textSub,flex:1},
  resumenVal:{fontSize:13,fontWeight:'700',color:C.text,flex:2,textAlign:'right'},
});
