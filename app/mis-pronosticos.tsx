import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b' };

type FilaPartido = { id:string; local:string; visitante:string; fecha:string; resultado_final:string|null; mi_prediccion:string|null; acerto:boolean|null };

export default function MisPronosticosScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jornada } = useLocalSearchParams<{ jornada:string }>();
  const [filas, setFilas] = useState<FilaPartido[]>([]);
  const [loading, setLoading] = useState(true);
  const [aciertos, setAciertos] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => { if (user&&jornada) cargar(); }, [jornada,user]);

  const cargar = async () => {
    setLoading(true);
    const { data: partidos } = await supabase.from('partidos').select('id,local,visitante,fecha,resultado_final').eq('jornada',parseInt(jornada as string)).order('fecha');
    if (!partidos||partidos.length===0) { setFilas([]); setLoading(false); return; }
    const { data: preds } = await supabase.from('predicciones').select('partido_id,resultado').eq('usuario_id',user!.id).in('partido_id',partidos.map(p=>p.id));
    const predMap: Record<string,string> = {};
    (preds||[]).forEach(p=>{ predMap[p.partido_id]=p.resultado; });
    const filasCalc: FilaPartido[] = partidos.map(p => {
      const miPred = predMap[p.id]??null;
      let acerto: boolean|null = null;
      if (p.resultado_final!==null&&miPred!==null) acerto = p.resultado_final===miPred;
      return { id:p.id, local:p.local, visitante:p.visitante, fecha:p.fecha, resultado_final:p.resultado_final, mi_prediccion:miPred, acerto };
    });
    const jugados = filasCalc.filter(f=>f.acerto!==null);
    setAciertos(jugados.filter(f=>f.acerto===true).length);
    setTotal(jugados.length);
    setFilas(filasCalc);
    setLoading(false);
  };

  const etiqueta = (val:string|null, local:string, visitante:string) => {
    if (!val) return '—';
    if (val==='1') return `Local`;
    if (val==='X') return 'Empate';
    if (val==='2') return `Visitante`;
    return val;
  };

  const porcentaje = total>0?Math.round((aciertos/total)*100):0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      {/* Header */}
      <View style={[styles.header,{paddingTop:insets.top+12}]}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text}/>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jornada {jornada}</Text>
        <View style={{width:40}}/>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Resumen */}
          {total>0 && (
            <View style={styles.resumen}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenNum}>{aciertos}</Text>
                <Text style={styles.resumenLabel}>Aciertos</Text>
              </View>
              <View style={styles.resumenDivider}/>
              <View style={styles.resumenItem}>
                <Text style={[styles.resumenNum,{color:porcentaje>=50?C.green:C.orange}]}>{porcentaje}%</Text>
                <Text style={styles.resumenLabel}>Efectividad</Text>
              </View>
              <View style={styles.resumenDivider}/>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenNum}>{filas.length-total}</Text>
                <Text style={styles.resumenLabel}>Pendientes</Text>
              </View>
            </View>
          )}

          {filas.length===0 ? (
            <View style={styles.emptyBox}>
              <Text style={{fontSize:48,marginBottom:12}}>🏠</Text>
              <Text style={styles.emptyTexto}>No se encontraron partidos para esta jornada.</Text>
            </View>
          ) : (
            filas.map(f=>(
              <View key={f.id} style={[
                styles.card,
                f.acerto===true&&styles.cardAcierto,
                f.acerto===false&&styles.cardFallo,
              ]}>
                <View style={styles.iconoContainer}>
                  {f.acerto===true  && <Ionicons name="checkmark-circle" size={26} color={C.green}/>}
                  {f.acerto===false && <Ionicons name="close-circle"     size={26} color={C.red}/>}
                  {f.acerto===null  && <Ionicons name="time-outline"     size={26} color={C.orange}/>}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardFecha}>{new Date(f.fecha).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</Text>
                  <Text style={styles.cardPartido}>{f.local} vs {f.visitante}</Text>
                  <View style={styles.comparacion}>
                    <View style={styles.comparacionItem}>
                      <Text style={styles.comparacionLabel}>Mi pronóstico</Text>
                      <View style={[styles.badge, f.mi_prediccion?styles.badgePred:styles.badgeVacio]}>
                        <Text style={styles.badgeTexto}>{etiqueta(f.mi_prediccion,f.local,f.visitante)}</Text>
                      </View>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={C.textSub} style={{marginTop:18}}/>
                    <View style={styles.comparacionItem}>
                      <Text style={styles.comparacionLabel}>Resultado real</Text>
                      <View style={[styles.badge, f.resultado_final?styles.badgeReal:styles.badgePendiente]}>
                        <Text style={[styles.badgeTexto,!f.resultado_final&&{color:C.orange}]}>{f.resultado_final?etiqueta(f.resultado_final,f.local,f.visitante):'Pendiente'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
          <View style={{height:40}}/>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingBottom:16,backgroundColor:C.bg},
  backBtn:{padding:6,borderRadius:10,backgroundColor:C.card},
  headerTitle:{color:C.text,fontSize:17,fontWeight:'bold',flex:1,textAlign:'center'},
  resumen:{flexDirection:'row',backgroundColor:C.card,marginHorizontal:16,marginBottom:12,borderRadius:14,padding:20,alignItems:'center',justifyContent:'space-around',borderWidth:1,borderColor:C.cardBorder},
  resumenItem:{alignItems:'center'},
  resumenNum:{color:C.accent,fontSize:28,fontWeight:'bold'},
  resumenLabel:{color:C.textSub,fontSize:11,marginTop:2},
  resumenDivider:{width:1,height:40,backgroundColor:C.cardBorder},
  emptyBox:{alignItems:'center',padding:50},
  emptyTexto:{color:C.textSub,fontSize:14,textAlign:'center'},
  card:{backgroundColor:C.card,marginHorizontal:16,marginBottom:8,borderRadius:12,padding:14,flexDirection:'row',alignItems:'flex-start',borderLeftWidth:4,borderLeftColor:C.cardBorder,borderWidth:1,borderColor:C.cardBorder},
  cardAcierto:{borderLeftColor:C.green,backgroundColor:'rgba(0,200,151,0.06)'},
  cardFallo:{borderLeftColor:C.red,backgroundColor:'rgba(255,107,107,0.06)'},
  iconoContainer:{marginRight:12,marginTop:4},
  cardBody:{flex:1},
  cardFecha:{fontSize:11,color:C.textSub,marginBottom:3,textTransform:'capitalize'},
  cardPartido:{fontSize:15,fontWeight:'bold',color:C.text,marginBottom:10},
  comparacion:{flexDirection:'row',alignItems:'center',gap:8},
  comparacionItem:{flex:1,alignItems:'center'},
  comparacionLabel:{fontSize:10,color:C.textSub,marginBottom:5,fontWeight:'600',textTransform:'uppercase'},
  badge:{paddingHorizontal:8,paddingVertical:5,borderRadius:8,minWidth:80,alignItems:'center'},
  badgePred:{backgroundColor:C.accentDim,borderWidth:1,borderColor:C.accent},
  badgeReal:{backgroundColor:C.accentDim,borderWidth:1,borderColor:C.accent},
  badgeVacio:{backgroundColor:'#1e1e35'},
  badgePendiente:{backgroundColor:'rgba(255,159,67,0.1)',borderWidth:1,borderColor:C.orange},
  badgeTexto:{color:C.text,fontSize:11,fontWeight:'600',textAlign:'center'},
});
