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
type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null; porcentaje_organizador?:number|null; ganador_usuario_id?:string|null };
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
  const [vistaUsuarios,setVistaUsuarios]=useState(false);
  // badge retiros pendientes
  const [retirosPendientes,setRetirosPendientes]=useState(0);

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
    const [{data:j},{data:p},{data:q},{data:r}]=await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at',{ascending:false}),
      supabase.from('partidos').select('*').order('fecha'),
      supabase.from('quinielas').select('id,estado_pago,codigo,jornada_id,usuario_id,monto_cobrado,usuarios(nombre,username)'),
      supabase.from('solicitudes_retiro').select('id').eq('estado','pendiente'),
    ]);
    if(j)setJornadas(j);
    if(p)setPartidos(p);
    if(q)setQuinielas(q as any);
    setRetirosPendientes((r||[]).length);
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
      if(!res.length)avisar('Sin partidos','No se encontraron partidos.');
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
      // Refrescar jornadas para que ganador_usuario_id quede actualizado en estado
      await cargarDatos();
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
    if(isNaN(precio)||precio<0){avisar('Precio inválido','Número >= 0.');return;}
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

  // ─── RENDERS ──────────────────────────────────────────────────────────────

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
    const qJTodos=quinielas.filter(q=>q.jornada_id===j.id);
    const pagadosJ=qJTodos.filter(q=>q.estado_pago==='pagado');
    const pendientesJ=qJTodos.filter(q=>q.estado_pago!=='pagado');
    const ganadorYaDeterminado=!!j.ganador_usuario_id;

    return(
      <View style={{flex:1}}>
        <View style={[styles.detalleBanner,{backgroundColor:eDim,borderBottomColor:eColor+'30'}]}>
          <View style={{flex:1}}>
            <Text style={styles.detalleNombre} numberOfLines={2}>{j.nombre}</Text>
            <Text style={styles.detalleInfo}>{pJ.length} partidos · {conRes}/{pJ.length} resultados{j.precio?` · $${j.precio}/c`:''}{ porcOrg>0?` · ${porcOrg}% org.`:''}</Text>
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
              <Text style={styles.bolsaInfoLabel}>Org. ({porcOrg}%)</Text>
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
            <TouchableOpacity
              style={[
                styles.detalleBtn,
                {backgroundColor:C.goldDim,borderColor:C.gold},
                (calculando||ganadorYaDeterminado)&&{opacity:0.4},
              ]}
              onPress={()=>{
                if(ganadorYaDeterminado){
                  avisar('Ya calculado','El ganador ya fue determinado para esta quiniela.');
                  return;
                }
                handleCalcularGanador(j);
              }}
              disabled={calculando}
              activeOpacity={0.85}
            >
              {calculando
                ?<ActivityIndicator color={C.gold} size="small"/>
                :<>
                    <Ionicons name="trophy" size={15} color={C.gold}/>
                    <Text style={[styles.detalleBtnTexto,{color:C.gold}]}>
                      {ganadorYaDeterminado?'Ganador ✓':'Ganador'}
                    </Text>
                  </>
              }
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
          <TouchableOpacity
            style={[styles.detalleBtn,{backgroundColor:C.purpleDim,borderColor:C.purple},vistaUsuarios&&{borderColor:C.purple,backgroundColor:C.purpleDim}]}
            onPress={()=>setVistaUsuarios(v=>!v)}
          >
            <Ionicons name="people" size={15} color={C.purple}/>
            <Text style={[styles.detalleBtnTexto,{color:C.purple}]}>{qJTodos.length} jugadores</Text>
            {vistaUsuarios&&<View style={styles.btnEnclavadoDot}/>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.detalleBtn,{backgroundColor:C.redDim,borderColor:C.red},esBorrando&&{opacity:0.5}]} onPress={()=>borrarJornada(j)} disabled={esBorrando}>
            {esBorrando?<ActivityIndicator color={C.red} size="small"/>:<><Ionicons name="trash-outline" size={15} color={C.red}/><Text style={[styles.detalleBtnTexto,{color:C.red}]}>Borrar</Text></>}
          </TouchableOpacity>
        </View>

        {vistaUsuarios ? (
          <ScrollView contentContainerStyle={{padding:16,paddingBottom:80}}>
            {qJTodos.length===0&&(
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={36} color={C.textMuted}/>
                <Text style={styles.emptyTexto}>Nadie se ha inscrito todavía.</Text>
              </View>
            )}
            {pagadosJ.length>0&&(
              <>
                <Text style={[styles.seccionTitulo,{color:C.green,marginBottom:8}]}>Pagados ({pagadosJ.length})</Text>
                {pagadosJ.map(q=>(
                  <View key={q.id} style={[styles.usuarioRow,{borderColor:C.green+'40',backgroundColor:C.greenDim}]}>
                    <View style={[styles.usuarioEstadoDot,{backgroundColor:C.green}]}/>
                    <View style={{flex:1}}>
                      <Text style={styles.usuarioNombre}>{q.usuarios?.nombre||'—'}</Text>
                      <Text style={styles.usuarioUser}>@{q.usuarios?.username||''}{q.monto_cobrado?` · $${q.monto_cobrado}`:''}</Text>
                    </View>
                    <TouchableOpacity style={[styles.btnTogglePago,{borderColor:C.green,backgroundColor:C.greenDim}]} onPress={()=>marcarPendiente(q.id)}>
                      <Text style={[styles.btnTogglePagoTexto,{color:C.green}]}>Pagado</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
            {pendientesJ.length>0&&(
              <>
                <Text style={[styles.seccionTitulo,{color:C.orange,marginBottom:8,marginTop:pagadosJ.length>0?16:0}]}>Pendientes ({pendientesJ.length})</Text>
                {pendientesJ.map(q=>(
                  <View key={q.id} style={[styles.usuarioRow,{borderColor:C.orange+'40',backgroundColor:C.orangeDim}]}>
                    <View style={[styles.usuarioEstadoDot,{backgroundColor:C.orange}]}/>
                    <View style={{flex:1}}>
                      <Text style={styles.usuarioNombre}>{q.usuarios?.nombre||'—'}</Text>
                      <Text style={styles.usuarioUser}>@{q.usuarios?.username||''}</Text>
                    </View>
                    <TouchableOpacity style={[styles.btnTogglePago,{borderColor:C.orange,backgroundColor:C.orangeDim}]} onPress={()=>marcarPagado(q.id,q.jornada_id)}>
                      <Text style={[styles.btnTogglePagoTexto,{color:C.orange}]}>Cobrar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        ) : (
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
        )}
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

      {/* Acceso rápido a Retiros */}
      <TouchableOpacity
        style={styles.retirosBannerBtn}
        onPress={()=>router.push('/admin-retiros')}
        activeOpacity={0.85}
      >
        <View style={styles.retirosBannerLeft}>
          <Ionicons name="wallet-outline" size={22} color={C.accent}/>
          <View>
            <Text style={styles.retirosBannerTitulo}>Solicitudes de Retiro</Text>
            <Text style={styles.retirosBannerSub}>Aprobar o rechazar retiros pendientes</Text>
          </View>
        </View>
        <View style={styles.retirosBannerRight}>
          {retirosPendientes>0&&(
            <View style={styles.retirosBadge}>
              <Text style={styles.retirosBadgeTexto}>{retirosPendientes}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={C.textSub}/>
        </View>
      </TouchableOpacity>

      {jornadasActivas.length>0&&(
        <>
          <Text style={styles.seccionTitulo}>Jornadas activas</Text>
          {jornadasActivas.map(j=>{
            const pJ=partidos.filter(p=>p.jornada_id===j.id);
            const qJ=quinielas.filter(q=>q.jornada_id===j.id);
            const pagJ=qJ.filter(q=>q.estado_pago==='pagado').length;
            const eColor=estadoColor(j.estado);
            return(
              <TouchableOpacity key={j.id} style={styles.jornadaCard} onPress={()=>{setJornadaSel(j);setVistaUsuarios(false);setScreen('jornada_detalle');}} activeOpacity={0.8}>
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
              <TouchableOpacity key={j.id} style={[styles.jornadaCard,{opacity:0.7}]} onPress={()=>{setJornadaSel(j);setVistaUsuarios(false);setScreen('jornada_detalle');}} activeOpacity={0.8}>
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
                  <Text style={styles.btnPagarTexto}>Cobrar</Text>
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
                     <Text style={[styles.btnPagarTexto,{color:C.green}]}>Pagado</Text>
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
          <View style=