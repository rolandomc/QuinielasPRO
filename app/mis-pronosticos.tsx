import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, StatusBar, Share, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const C = {
  bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35',
  accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)',
  text:'#f0f0ff', textSub:'#8888aa', textMuted:'#44445a',
  green:'#00c897', greenDim:'rgba(0,200,151,0.12)',
  orange:'#ff9f43', orangeDim:'rgba(255,159,67,0.12)',
  red:'#ff6b6b', redDim:'rgba(255,107,107,0.1)',
  gold:'#ffd700',
};

type FilaPartido = {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
  resultado_final: string | null;
  goles_local_real: number | null;
  goles_visitante_real: number | null;
  mi_prediccion: string | null;
  acerto: boolean | null;
};

const etiquetaCorta = (val: string | null) => {
  if (!val) return '—';
  if (val === '1') return 'Local';
  if (val === 'X') return 'Empate';
  if (val === '2') return 'Visitante';
  return val;
};

const colorRes = (val: string | null) => {
  if (val === '1') return C.accent;
  if (val === 'X') return C.orange;
  if (val === '2') return C.green;
  return C.textSub;
};

const dimRes = (val: string | null) => {
  if (val === '1') return C.accentDim;
  if (val === 'X') return C.orangeDim;
  if (val === '2') return C.greenDim;
  return 'transparent';
};

export default function MisPronosticosScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { jornada_id, jornada_nombre } = useLocalSearchParams<{ jornada_id: string; jornada_nombre: string }>();
  const [filas, setFilas] = useState<FilaPartido[]>([]);
  const [loading, setLoading] = useState(true);
  const [aciertos, setAciertos] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => { if (user && jornada_id) cargar(); }, [jornada_id, user]);

  const cargar = async () => {
    setLoading(true);
    const { data: partidos } = await supabase
      .from('partidos')
      .select('id,local,visitante,fecha,resultado_final,goles_local_real,goles_visitante_real')
      .eq('jornada_id', jornada_id)
      .order('fecha');
    if (!partidos || partidos.length === 0) { setFilas([]); setLoading(false); return; }
    const { data: preds } = await supabase
      .from('predicciones')
      .select('partido_id,resultado')
      .eq('usuario_id', user!.id)
      .in('partido_id', partidos.map(p => p.id));
    const predMap: Record<string, string> = {};
    (preds || []).forEach(p => { predMap[p.partido_id] = p.resultado; });
    const filasCalc: FilaPartido[] = partidos.map(p => {
      const miPred = predMap[p.id] ?? null;
      let acerto: boolean | null = null;
      if (p.resultado_final !== null && miPred !== null) acerto = p.resultado_final === miPred;
      return {
        id: p.id,
        local: p.local,
        visitante: p.visitante,
        fecha: p.fecha,
        resultado_final: p.resultado_final,
        goles_local_real: p.goles_local_real ?? null,
        goles_visitante_real: p.goles_visitante_real ?? null,
        mi_prediccion: miPred,
        acerto,
      };
    });
    const jugados = filasCalc.filter(f => f.acerto !== null);
    setAciertos(jugados.filter(f => f.acerto === true).length);
    setTotal(jugados.length);
    setFilas(filasCalc);
    setLoading(false);
  };

  const compartirQuiniela = async () => {
    const emoji = (v: string | null) => v === '1' ? 'L' : v === 'X' ? 'E' : v === '2' ? 'V' : '?';
    const lineas = filas.map(f => `${emoji(f.mi_prediccion)} ${f.local} vs ${f.visitante}`);
    const resumen = total > 0 ? `\n\n${aciertos}/${total} aciertos (${Math.round(aciertos/total*100)}%)` : '';
    const texto = [`Mi Quiniela — ${jornada_nombre}`, '', ...lineas, resumen, '', 'L=Local  E=Empate  V=Visitante'].join('\n');
    if (Platform.OS === 'web') {
      try { await (navigator as any).share({ title: `Quiniela — ${jornada_nombre}`, text: texto }); }
      catch { await (navigator as any).clipboard.writeText(texto); }
    } else {
      await Share.share({ message: texto, title: `Quiniela — ${jornada_nombre}` });
    }
  };

  const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  const fallos = total - aciertos;
  const pendientes = filas.length - total;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text}/>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{jornada_nombre || 'Mis pronósticos'}</Text>
        {filas.length > 0
          ? <TouchableOpacity onPress={compartirQuiniela} style={styles.shareBtn} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={20} color={C.accent}/>
            </TouchableOpacity>
          : <View style={{ width: 40 }}/>
        }
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Resumen de aciertos */}
          {total > 0 && (
            <View style={styles.resumen}>
              <View style={styles.resumenItem}>
                <Text style={[styles.resumenNum, { color: C.green }]}>{aciertos}</Text>
                <Text style={styles.resumenLabel}>Aciertos</Text>
              </View>
              <View style={styles.resumenDivider}/>
              <View style={styles.resumenItem}>
                <Text style={[styles.resumenNum, { color: C.red }]}>{fallos}</Text>
                <Text style={styles.resumenLabel}>Fallos</Text>
              </View>
              <View style={styles.resumenDivider}/>
              <View style={styles.resumenItem}>
                <Text style={[styles.resumenNum, { color: porcentaje >= 50 ? C.green : C.orange }]}>{porcentaje}%</Text>
                <Text style={styles.resumenLabel}>Efectividad</Text>
              </View>
              {pendientes > 0 && (
                <>
                  <View style={styles.resumenDivider}/>
                  <View style={styles.resumenItem}>
                    <Text style={[styles.resumenNum, { color: C.orange }]}>{pendientes}</Text>
                    <Text style={styles.resumenLabel}>Pendientes</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Barra de progreso */}
          {total > 0 && (
            <View style={styles.barraContainer}>
              <View style={styles.barraFondo}>
                {aciertos > 0 && <View style={[styles.barraVerde, { flex: aciertos }]}/>}
                {fallos > 0 && <View style={[styles.barraRoja, { flex: fallos }]}/>}
                {pendientes > 0 && <View style={[styles.barraNaranja, { flex: pendientes }]}/>}
              </View>
              <Text style={styles.barraTxt}>{aciertos} de {filas.length} partidos jugados</Text>
            </View>
          )}

          {filas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="football-outline" size={48} color={C.textMuted}/>
              <Text style={styles.emptyTexto}>No se encontraron partidos para esta jornada.</Text>
            </View>
          ) : (
            filas.map(f => {
              const tieneMarcador = f.goles_local_real != null && f.goles_visitante_real != null;
              const bgColor = f.acerto === true ? C.greenDim : f.acerto === false ? C.redDim : 'transparent';
              const borderColor = f.acerto === true ? C.green + '50' : f.acerto === false ? C.red + '50' : C.cardBorder;
              return (
                <View key={f.id} style={[styles.card, { backgroundColor: bgColor, borderColor }]}>
                  {/* Header del partido */}
                  <View style={styles.cardHeader}>
                    <View style={styles.iconoEstado}>
                      {f.acerto === true  && <Ionicons name="checkmark-circle" size={20} color={C.green}/>}
                      {f.acerto === false && <Ionicons name="close-circle"     size={20} color={C.red}/>}
                      {f.acerto === null  && <Ionicons name="time-outline"     size={20} color={C.orange}/>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardFecha}>
                        {new Date(f.fecha).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </Text>
                    </View>
                    {tieneMarcador && (
                      <View style={styles.marcadorBadge}>
                        <Text style={styles.marcadorTexto}>{f.goles_local_real} - {f.goles_visitante_real}</Text>
                      </View>
                    )}
                  </View>

                  {/* Nombre del partido */}
                  <View style={styles.equiposRow}>
                    <Text style={styles.equipoLocal} numberOfLines={1}>{f.local}</Text>
                    <Text style={styles.vsTexto}>vs</Text>
                    <Text style={styles.equipoVisitante} numberOfLines={1}>{f.visitante}</Text>
                  </View>

                  {/* Comparacion prediccion vs resultado */}
                  <View style={styles.comparacion}>
                    {/* Mi prediccion */}
                    <View style={styles.comparacionCol}>
                      <Text style={styles.comparacionLabel}>Mi pronóstico</Text>
                      <View style={[
                        styles.resBadge,
                        { backgroundColor: dimRes(f.mi_prediccion), borderColor: colorRes(f.mi_prediccion) + '80' }
                      ]}>
                        <Text style={[styles.resBadgeTexto, { color: colorRes(f.mi_prediccion) }]}>
                          {f.mi_prediccion ?? '—'}
                        </Text>
                        <Text style={[styles.resBadgeLabel, { color: colorRes(f.mi_prediccion) }]}>
                          {etiquetaCorta(f.mi_prediccion)}
                        </Text>
                      </View>
                    </View>

                    {/* Flecha con icono de acierto */}
                    <View style={styles.comparacionSep}>
                      {f.acerto === true  && <Ionicons name="checkmark-circle" size={22} color={C.green}/>}
                      {f.acerto === false && <Ionicons name="close-circle"     size={22} color={C.red}/>}
                      {f.acerto === null  && <Ionicons name="remove-circle-outline" size={22} color={C.textMuted}/>}
                    </View>

                    {/* Resultado real */}
                    <View style={styles.comparacionCol}>
                      <Text style={styles.comparacionLabel}>Resultado real</Text>
                      {f.resultado_final ? (
                        <View style={[
                          styles.resBadge,
                          { backgroundColor: dimRes(f.resultado_final), borderColor: colorRes(f.resultado_final) + '80' }
                        ]}>
                          <Text style={[styles.resBadgeTexto, { color: colorRes(f.resultado_final) }]}>
                            {f.resultado_final}
                          </Text>
                          <Text style={[styles.resBadgeLabel, { color: colorRes(f.resultado_final) }]}>
                            {etiquetaCorta(f.resultado_final)}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.resBadge, { backgroundColor: C.orangeDim, borderColor: C.orange + '50' }]}>
                          <Ionicons name="time-outline" size={16} color={C.orange}/>
                          <Text style={[styles.resBadgeLabel, { color: C.orange }]}>Pendiente</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }}/>
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
  shareBtn:{padding:6,borderRadius:10,backgroundColor:C.accentDim,borderWidth:1,borderColor:C.accent},
  headerTitle:{color:C.text,fontSize:17,fontWeight:'bold',flex:1,textAlign:'center',marginHorizontal:8},
  resumen:{flexDirection:'row',backgroundColor:C.card,marginHorizontal:16,marginTop:16,marginBottom:8,borderRadius:14,padding:20,alignItems:'center',justifyContent:'space-around',borderWidth:1,borderColor:C.cardBorder},
  resumenItem:{alignItems:'center',minWidth:56},
  resumenNum:{color:C.accent,fontSize:26,fontWeight:'bold'},
  resumenLabel:{color:C.textSub,fontSize:10,marginTop:2,fontWeight:'600'},
  resumenDivider:{width:1,height:36,backgroundColor:C.cardBorder},
  barraContainer:{marginHorizontal:16,marginBottom:16},
  barraFondo:{flexDirection:'row',height:6,borderRadius:4,overflow:'hidden',backgroundColor:C.cardBorder},
  barraVerde:{backgroundColor:C.green},
  barraRoja:{backgroundColor:C.red},
  barraNaranja:{backgroundColor:C.orange + '80'},
  barraTxt:{fontSize:11,color:C.textMuted,marginTop:5,textAlign:'center'},
  emptyBox:{alignItems:'center',padding:50,gap:12},
  emptyTexto:{color:C.textSub,fontSize:14,textAlign:'center'},
  card:{marginHorizontal:16,marginBottom:10,borderRadius:14,padding:14,borderWidth:1},
  cardHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
  iconoEstado:{width:22,alignItems:'center'},
  cardFecha:{fontSize:11,color:C.textSub,textTransform:'capitalize'},
  marcadorBadge:{backgroundColor:'rgba(0,200,151,0.15)',borderRadius:8,borderWidth:1,borderColor:C.green+'60',paddingHorizontal:8,paddingVertical:3},
  marcadorTexto:{fontSize:13,fontWeight:'800',color:C.green},
  equiposRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:12},
  equipoLocal:{flex:1,fontSize:13,fontWeight:'700',color:C.text,textAlign:'right'},
  vsTexto:{fontSize:11,color:C.textMuted,fontWeight:'600',paddingHorizontal:4},
  equipoVisitante:{flex:1,fontSize:13,fontWeight:'700',color:C.text},
  comparacion:{flexDirection:'row',alignItems:'center',gap:8},
  comparacionCol:{flex:1,alignItems:'center',gap:6},
  comparacionLabel:{fontSize:9,color:C.textMuted,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.5},
  comparacionSep:{alignItems:'center',justifyContent:'center',width:28},
  resBadge:{width:'100%',paddingVertical:8,borderRadius:10,borderWidth:1,alignItems:'center',gap:2},
  resBadgeTexto:{fontSize:18,fontWeight:'900'},
  resBadgeLabel:{fontSize:10,fontWeight:'600'},
});
