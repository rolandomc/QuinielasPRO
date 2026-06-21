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
import { calcularGanador, type ResumenGanador } from '../lib/ganador';

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

// ── Tabla de posiciones ────────────────────────────────────────────────
function TablaPosiciones({ resumen, onClose }: { resumen: ResumenGanador; onClose: () => void }) {
  const medalles = ['🥇','🥈','🥉'];
  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCar