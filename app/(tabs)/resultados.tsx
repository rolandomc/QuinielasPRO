import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', gold:'#ffd700' };

type Posicion = { usuario_id:string; username:string; aciertos:number; total_partidos:number };
type Partido = { id:string; local:string; visitante:string; resultado_final:string|null; jornada:number };

export default function ResultadosScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jornada, setJornada] = useState<number>(1);
  const [jornadas, setJornadas] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [miPosicion, setMiPosicion] = useState<number|null>(null);

  const cargar = useCallback(async (j?:number) => {
    setLoading(true);
    const { data: jData } = await supabase.from('partidos').select('jornada').order('jornada');
    const unicas = [...new Set((jData||[]).map((p:any)=>p.jornada))] as number[];
    setJornadas(unicas);
    const jornadaActual = j??(unicas[unicas.length-1]||1);
    setJornada(jornadaActual);
    const { data: pData } = await supabase.from('partidos').select('id,local,visitante,resultado_final,jornada').eq('jornada',jornadaActual).order('fecha');
    setPartidos(pData||[]);
    const { data: qData } = await supabase.from('quinielas').select('usuario_id,aciertos,usuarios(username,nombre)').eq('jornada',jornadaActual).eq('estado_pago','pagado').order('aciertos',{ascending:false});
    const tabla:Posicion[] = (qData||[]).map((q:any) => ({ usuario_id:q.usuario_id, username:q.usuarios?.username?`@${q.usuarios.username}`:(q.usuarios?.nombre||'Jugador'), aciertos:q.aciertos||0, total_partidos:pData?.length||0 }));
    setPosiciones(tabla);
    if (user) { const pos=tabla.findIndex(p=>p.usuario_id===user.id); setMiPosicion(pos>=0?pos+1:null); }
    setLoading(false); setRefreshing(false);
  }, [user]);

  useEffect(() => { cargar(); }, [cargar]);

  const hayResultados = partidos.some(p=>p.resultado_final);
  const medallaColor = (i:number) => i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':C.textSub;
  const medalla = (i:number) => i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;

  // Renderiza una fila de partido con el ganador resaltado en verde
  const renderPartido = (p: Partido) => {
    const res = p.resultado_final;
    const localGana = res === '1';
    const visitanteGana = res === '2';
    const empate = res === 'X';
    return (
      <View key={p.id} style={styles.partidoRow}>
        <View style={[styles.equipoBox, localGana && styles.equipoGanador]}>
          <Text style={[styles.equipoNombre, localGana && styles.equipoNombreGanador]} numberOfLines={1}>{p.local}</Text>
          {localGana && <Text style={styles.ganadorLabel}>Ganador</Text>}
        </View>
        <View style={styles.centroCol}>
          {empate ? (
            <View style={styles.empateBadge}><Text style={styles.empateTexto}>Empate</Text></View>
          ) : res ? null : (
            <View style={styles.pendienteBadge}><Text style={styles.pendienteTexto}>Pendiente</Text></View>
          )}
        </View>
        <View style={[styles.equipoBox, styles.equipoBoxRight, visitanteGana && styles.equipoGanador]}>
          <Text style={[styles.equipoNombre, visitanteGana && styles.equipoNombreGanador]} numberOfLines={1}>{p.visitante}</Text>
          {visitanteGana && <Text style={styles.ganadorLabel}>Ganador</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);cargar(jornada);}} tintColor={C.accent} colors={[C.accent]}/>} showsVerticalScrollIndicator={false}>
        <View style={[styles.header,{paddingTop:insets.top+16}]}>
          <Text style={styles.headerTitle}>🏆 Resultados</Text>
          {miPosicion && (
            <View style={styles.miPosBadge}>
              <Ionicons name="ribbon" size={13} color={C.gold}/>
              <Text style={styles.miPosText}>Tu posición #{miPosicion}</Text>
            </View>
          )}
        </View>

        {jornadas.length>1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jornadasScroll} contentContainerStyle={{paddingHorizontal:16,gap:8}}>
            {jornadas.map(j=>(
              <TouchableOpacity key={j} style={[styles.jornadaBtn,jornada===j&&styles.jornadaBtnActivo]} onPress={()=>cargar(j)} activeOpacity={0.7}>
                <Text style={[styles.jornadaTexto,jornada===j&&styles.jornadaTextoActivo]}>J{j}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {partidos.length>0 && (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>⚽ Jornada {jornada}</Text>
            {partidos.map(renderPartido)}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={C.accent} style={{margin:40}}/>
        ) : !hayResultados ? (
          <View style={styles.emptyBox}>
            <Text style={{fontSize:48,marginBottom:12}}>⏰</Text>
            <Text style={styles.emptyTitulo}>Resultados pendientes</Text>
            <Text style={styles.emptyTexto}>La tabla se actualizará cuando el admin capture los resultados.</Text>
          </View>
        ) : posiciones.length===0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyTexto}>No hay participantes con pago confirmado.</Text></View>
        ) : (
          <View style={styles.tablaWrap}>
            <View style={styles.tablaHeader}>
              <Text style={[styles.col,styles.colNum]}>#</Text>
              <Text style={[styles.col,styles.colNombre]}>Jugador</Text>
              <Text style={[styles.col,styles.colAciertos]}>Aciertos</Text>
            </View>
            {posiciones.map((p,i)=>(
              <View key={p.usuario_id} style={[styles.tablaRow,p.usuario_id===user?.id&&styles.rowMio]}>
                <Text style={[styles.col,styles.colNum,{color:medallaColor(i),fontSize:i<3?20:14,fontWeight:'bold'}]}>{medalla(i)}</Text>
                <Text style={[styles.col,styles.colNombre,p.usuario_id===user?.id&&{color:C.accent}]} numberOfLines={1}>{p.username}{p.usuario_id===user?.id?' ★':''}</Text>
                <View style={styles.colAciertosWrap}>
                  <Text style={styles.aciertosNum}>{p.aciertos}</Text>
                  <Text style={styles.aciertosTotal}>/{p.total_partidos}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{height:50}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg}, scroll:{flex:1},
  header:{paddingBottom:20,paddingHorizontal:20},
  headerTitle:{color:C.text,fontSize:28,fontWeight:'bold'},
  miPosBadge:{flexDirection:'row',alignItems:'center',gap:5,marginTop:6,alignSelf:'flex-start',backgroundColor:'rgba(255,215,0,0.1)',borderWidth:1,borderColor:'rgba(255,215,0,0.3)',paddingHorizontal:12,paddingVertical:4,borderRadius:20},
  miPosText:{color:C.gold,fontSize:13,fontWeight:'700'},
  jornadasScroll:{marginBottom:12},
  jornadaBtn:{paddingHorizontal:18,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:'#2a2a40',backgroundColor:C.card},
  jornadaBtnActivo:{backgroundColor:C.accentDim,borderColor:C.accent},
  jornadaTexto:{color:C.textSub,fontWeight:'700',fontSize:13}, jornadaTextoActivo:{color:C.accent},
  seccion:{backgroundColor:C.card,marginHorizontal:16,marginBottom:12,borderRadius:14,padding:16,borderWidth:1,borderColor:C.cardBorder},
  seccionTitulo:{color:C.text,fontWeight:'bold',fontSize:15,marginBottom:14},
  partidoRow:{flexDirection:'row',alignItems:'stretch',marginBottom:12},
  equipoBox:{flex:1,borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,padding:10,alignItems:'center',justifyContent:'center',backgroundColor:'#12121f'},
  equipoBoxRight:{},
  equipoGanador:{borderColor:C.green,backgroundColor:'rgba(0,200,151,0.08)'},
  equipoNombre:{fontSize:13,fontWeight:'bold',color:C.textSub,textAlign:'center'},
  equipoNombreGanador:{color:C.green},
  ganadorLabel:{fontSize:10,color:C.green,fontWeight:'700',marginTop:3},
  centroCol:{width:64,alignItems:'center',justifyContent:'center',paddingHorizontal:4},
  empateBadge:{borderWidth:1.5,borderColor:C.orange,borderRadius:8,paddingHorizontal:6,paddingVertical:4,backgroundColor:'rgba(255,159,67,0.1)'},
  empateTexto:{color:C.orange,fontSize:10,fontWeight:'700',textAlign:'center'},
  pendienteBadge:{borderWidth:1,borderColor:'#2a2a40',borderRadius:8,paddingHorizontal:6,paddingVertical:4},
  pendienteTexto:{color:C.textSub,fontSize:10,textAlign:'center'},
  emptyBox:{alignItems:'center',padding:50}, emptyTitulo:{fontSize:16,fontWeight:'bold',color:C.text,marginBottom:8}, emptyTexto:{color:C.textSub,fontSize:13,textAlign:'center'},
  tablaWrap:{marginHorizontal:16},
  tablaHeader:{flexDirection:'row',paddingHorizontal:14,paddingVertical:10,marginBottom:4},
  tablaRow:{flexDirection:'row',backgroundColor:C.card,padding:14,borderRadius:12,marginBottom:6,borderWidth:1,borderColor:C.cardBorder,alignItems:'center'},
  rowMio:{borderColor:C.accent,backgroundColor:C.accentDim},
  col:{color:C.textSub,fontSize:14}, colNum:{width:38,textAlign:'center'}, colNombre:{flex:1,fontWeight:'600',color:C.text},
  colAciertos:{width:70,textAlign:'right',fontWeight:'bold'},
  colAciertosWrap:{width:70,flexDirection:'row',justifyContent:'flex-end',alignItems:'baseline'},
  aciertosNum:{fontSize:18,fontWeight:'bold',color:C.text}, aciertosTotal:{fontSize:12,color:C.textSub,marginLeft:1},
});
