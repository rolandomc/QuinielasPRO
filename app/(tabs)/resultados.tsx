import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { apifb } from '../../lib/apiFootball';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', gold:'#ffd700', red:'#ff6b6b' };

type Posicion = { usuario_id:string; username:string; aciertos:number; total_partidos:number };
type Partido = { id:string; local:string; visitante:string; resultado_final:string|null; jornada:number; api_fixture_id?:number };
type LiveScore = { fixture_id:number; home:number|null; away:number|null; status:string; elapsed:number|null };

// Convierte goles a resultado 1/X/2
const golesAResultado = (h:number|null, a:number|null): '1'|'X'|'2'|null => {
  if (h===null||a===null) return null;
  if (h>a) return '1'; if (a>h) return '2'; return 'X';
};

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
  const [liveScores, setLiveScores] = useState<Record<number, LiveScore>>({});
  const [liveActivo, setLiveActivo] = useState(false);
  const pollingRef = useRef<any>(null);

  const cargar = useCallback(async (j?:number) => {
    setLoading(true);
    const { data: jData } = await supabase.from('partidos').select('jornada').order('jornada');
    const unicas = [...new Set((jData||[]).map((p:any)=>p.jornada))] as number[];
    setJornadas(unicas);
    const jornadaActual = j??(unicas[unicas.length-1]||1);
    setJornada(jornadaActual);
    const { data: pData } = await supabase.from('partidos').select('id,local,visitante,resultado_final,jornada,api_fixture_id').eq('jornada',jornadaActual).order('fecha');
    setPartidos(pData||[]);
    const { data: qData } = await supabase.from('quinielas').select('usuario_id,aciertos,usuarios(username,nombre)').eq('jornada',jornadaActual).eq('estado_pago','pagado').order('aciertos',{ascending:false});
    const tabla:Posicion[] = (qData||[]).map((q:any) => ({ usuario_id:q.usuario_id, username:q.usuarios?.username?`@${q.usuarios.username}`:(q.usuarios?.nombre||'Jugador'), aciertos:q.aciertos||0, total_partidos:pData?.length||0 }));
    setPosiciones(tabla);
    if (user) { const pos=tabla.findIndex(p=>p.usuario_id===user.id); setMiPosicion(pos>=0?pos+1:null); }
    setLoading(false); setRefreshing(false);
  }, [user]);

  // Polling en vivo
  const fetchLive = useCallback(async (ps: Partido[]) => {
    const conApi = ps.filter(p=>p.api_fixture_id&&!p.resultado_final);
    if (conApi.length===0) { setLiveActivo(false); return; }
    try {
      const ids = conApi.map(p=>p.api_fixture_id).join('-');
      const data = await apifb.fixtureById(ids);
      const map: Record<number,LiveScore> = {};
      (data.response||[]).forEach((f:any) => {
        map[f.fixture.id] = { fixture_id:f.fixture.id, home:f.goals.home, away:f.goals.away, status:f.fixture.status.short, elapsed:f.fixture.status.elapsed };
      });
      setLiveScores(map);
      setLiveActivo(Object.values(map).some(s=>['1H','2H','HT','ET','BT','P'].includes(s.status)));
    } catch {}
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (partidos.length===0) return;
    fetchLive(partidos);
    pollingRef.current = setInterval(()=>fetchLive(partidos), 60000);
    return () => clearInterval(pollingRef.current);
  }, [partidos]);

  const hayResultados = partidos.some(p=>p.resultado_final);
  const medallaColor = (i:number) => i===0?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':C.textSub;
  const medalla = (i:number) => i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}`;

  const renderPartido = (p: Partido) => {
    const live = p.api_fixture_id ? liveScores[p.api_fixture_id] : null;
    const res = p.resultado_final;
    // Si tiene resultado final en DB úsalo, si hay live score úsalo
    const resEfectivo = res ?? (live ? golesAResultado(live.home, live.away) : null);
    const localGana = resEfectivo==='1';
    const visitanteGana = resEfectivo==='2';
    const empate = resEfectivo==='X';
    const enVivo = live&&['1H','2H','HT','ET','BT','P'].includes(live.status);
    const finalizado = live?.status==='FT'||!!res;

    return (
      <View key={p.id} style={styles.partidoRow}>
        <View style={[styles.equipoBox, localGana&&styles.equipoGanador]}>
          <Text style={[styles.equipoNombre, localGana&&styles.equipoNombreGanador]} numberOfLines={2}>{p.local}</Text>
          {live&&live.home!==null&&<Text style={[styles.goles,localGana&&{color:C.green}]}>{live.home}</Text>}
        </View>
        <View style={styles.centroCol}>
          {enVivo&&<View style={styles.liveDot}><Text style={styles.liveTexto}>{live!.elapsed}'</Text></View>}
          {empate&&!enVivo&&<View style={styles.empateBadge}><Text style={styles.empateTexto}>Empate</Text></View>}
          {finalizado&&!enVivo&&!empate&&<Text style={styles.ftTexto}>FT</Text>}
          {!enVivo&&!finalizado&&<View style={styles.pendienteBadge}><Text style={styles.pendienteTexto}>Pdte.</Text></View>}
        </View>
        <View style={[styles.equipoBox, visitanteGana&&styles.equipoGanador]}>
          <Text style={[styles.equipoNombre, visitanteGana&&styles.equipoNombreGanador]} numberOfLines={2}>{p.visitante}</Text>
          {live&&live.away!==null&&<Text style={[styles.goles,visitanteGana&&{color:C.green}]}>{live.away}</Text>}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <ScrollView style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);cargar(jornada);}} tintColor={C.accent} colors={[C.accent]}/>} showsVerticalScrollIndicator={false}>
        <View style={[styles.header,{paddingTop:insets.top+16}]}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <Text style={styles.headerTitle}>🏆 Resultados</Text>
            {liveActivo&&<View style={styles.livePill}><View style={styles.liveDotPill}/><Text style={styles.livePillTexto}>EN VIVO</Text></View>}
          </View>
          {miPosicion&&(
            <View style={styles.miPosBadge}>
              <Ionicons name="ribbon" size={13} color={C.gold}/>
              <Text style={styles.miPosText}>Tu posición #{miPosicion}</Text>
            </View>
          )}
        </View>

        {jornadas.length>1&&(
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jornadasScroll} contentContainerStyle={{paddingHorizontal:16,gap:8}}>
            {jornadas.map(j=>(
              <TouchableOpacity key={j} style={[styles.jornadaBtn,jornada===j&&styles.jornadaBtnActivo]} onPress={()=>cargar(j)} activeOpacity={0.7}>
                <Text style={[styles.jornadaTexto,jornada===j&&styles.jornadaTextoActivo]}>J{j}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {partidos.length>0&&(
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>⚽ Jornada {jornada}</Text>
            {partidos.map(renderPartido)}
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={C.accent} style={{margin:40}}/>
        ) : !hayResultados&&Object.keys(liveScores).length===0 ? (
          <View style={styles.emptyBox}>
            <Text style={{fontSize:48,marginBottom:12}}>⏰</Text>
            <Text style={styles.emptyTitulo}>Resultados pendientes</Text>
            <Text style={styles.emptyTexto}>La tabla se actualizará cuando inicien los partidos.</Text>
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
  livePill:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(255,107,107,0.15)',borderWidth:1,borderColor:C.red,paddingHorizontal:10,paddingVertical:3,borderRadius:20},
  liveDotPill:{width:7,height:7,borderRadius:4,backgroundColor:C.red},
  livePillTexto:{color:C.red,fontSize:10,fontWeight:'800',letterSpacing:1},
  miPosBadge:{flexDirection:'row',alignItems:'center',gap:5,marginTop:6,alignSelf:'flex-start',backgroundColor:'rgba(255,215,0,0.1)',borderWidth:1,borderColor:'rgba(255,215,0,0.3)',paddingHorizontal:12,paddingVertical:4,borderRadius:20},
  miPosText:{color:C.gold,fontSize:13,fontWeight:'700'},
  jornadasScroll:{marginBottom:12},
  jornadaBtn:{paddingHorizontal:18,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:'#2a2a40',backgroundColor:C.card},
  jornadaBtnActivo:{backgroundColor:C.accentDim,borderColor:C.accent},
  jornadaTexto:{color:C.textSub,fontWeight:'700',fontSize:13}, jornadaTextoActivo:{color:C.accent},
  seccion:{backgroundColor:C.card,marginHorizontal:16,marginBottom:12,borderRadius:14,padding:16,borderWidth:1,borderColor:C.cardBorder},
  seccionTitulo:{color:C.text,fontWeight:'bold',fontSize:15,marginBottom:14},
  partidoRow:{flexDirection:'row',alignItems:'stretch',marginBottom:10},
  equipoBox:{flex:1,borderWidth:1.5,borderColor:C.cardBorder,borderRadius:10,paddingVertical:12,paddingHorizontal:8,alignItems:'center',justifyContent:'center',backgroundColor:'#12121f'},
  equipoGanador:{borderColor:C.green,backgroundColor:'rgba(0,200,151,0.08)'},
  equipoNombre:{fontSize:12,fontWeight:'bold',color:C.textSub,textAlign:'center'},
  equipoNombreGanador:{color:C.green},
  goles:{fontSize:22,fontWeight:'bold',color:C.text,marginTop:4},
  centroCol:{width:60,alignItems:'center',justifyContent:'center',paddingHorizontal:4},
  liveDot:{backgroundColor:'rgba(255,107,107,0.15)',borderWidth:1,borderColor:C.red,borderRadius:8,paddingHorizontal:5,paddingVertical:3},
  liveTexto:{color:C.red,fontSize:11,fontWeight:'800'},
  empateBadge:{borderWidth:1.5,borderColor:C.orange,borderRadius:8,paddingHorizontal:5,paddingVertical:4,backgroundColor:'rgba(255,159,67,0.1)'},
  empateTexto:{color:C.orange,fontSize:10,fontWeight:'700',textAlign:'center'},
  ftTexto:{color:C.green,fontSize:10,fontWeight:'700'},
  pendienteBadge:{borderWidth:1,borderColor:'#2a2a40',borderRadius:8,paddingHorizontal:5,paddingVertical:4},
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
