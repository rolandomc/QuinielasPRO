import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b' };

type Partido    = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean };
type Jornada    = { id:string; nombre:string; estado:string };
type QuinielaDB = { id:string; estado_pago:string; jornada_id:string; codigo:string; aciertos:number };

export default function QuinielaScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();

  const [jornada, setJornada]           = useState<Jornada|null>(null);
  const [partidos, setPartidos]         = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string,'1'|'X'|'2'>>({});
  const [quiniela, setQuiniela]         = useState<QuinielaDB|null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;

    const { data: jData } = await supabase
      .from('jornadas')
      .select('id,nombre,estado')
      .eq('estado','abierta')
      .order('creado_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!jData) { setJornada(null); setPartidos([]); setQuiniela(null); return; }
    setJornada(jData);

    const { data: pData } = await supabase
      .from('partidos').select('*').eq('jornada_id', jData.id).order('fecha');
    setPartidos(pData || []);

    const { data: qData } = await supabase
      .from('quinielas')
      .select('id,estado_pago,jornada_id,codigo,aciertos')
      .eq('usuario_id', user.id)
      .eq('jornada_id', jData.id)
      .maybeSingle();
    setQuiniela(qData);

    if (qData && pData) {
      const { data: predData } = await supabase
        .from('predicciones').select('partido_id,resultado')
        .eq('usuario_id', user.id)
        .in('partido_id', pData.map(p => p.id));
      const map: Record<string,'1'|'X'|'2'> = {};
      (predData || []).forEach(p => { map[p.partido_id] = p.resultado; });
      setPredicciones(map);
    } else {
      setPredicciones({});
    }
  }, [user]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await cargar(); setRefreshing(false); }, [cargar]);

  const seleccionar = (id: string, r: '1'|'X'|'2') => {
    if (quiniela) return;
    setPredicciones(p => ({ ...p, [id]: r }));
  };

  // Ir a pagar — las predicciones viajan como params, Supabase NO se toca aqui
  const irAPagar = () => {
    if (!user || !jornada) return;
    if (Object.keys(predicciones).length < partidos.length) {
      Alert.alert('Incompleto', 'Selecciona un resultado para cada partido.');
      return;
    }
    // Serializar predicciones como JSON para pasarlas como param
    router.push({
      pathname: '/pago/checkout',
      params: {
        jornada_id:  jornada.id,
        jornada_nombre: jornada.nombre,
        predicciones: JSON.stringify(predicciones),
      },
    });
  };

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  const yaGuardo = !!quiniela;
  const esPagado = quiniela?.estado_pago === 'pagado';
  const todoSel  = partidos.length > 0 && Object.keys(predicciones).length === partidos.length;
  const selCount = Object.keys(predicciones).length;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]}/>}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>⚽ Mi Quiniela</Text>
          {jornada && (
            <View style={styles.jornadaBadge}>
              <Text style={styles.jornadaBadgeText}>{jornada.nombre}</Text>
            </View>
          )}
        </View>

        {/* Sin jornada activa */}
        {!jornada && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>⏳</Text>
            <Text style={styles.emptyTitulo}>Sin quiniela activa</Text>
            <Text style={styles.emptyTexto}>El administrador aún no ha abierto la siguiente jornada.</Text>
          </View>
        )}

        {jornada && partidos.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitulo}>Jornada sin partidos</Text>
            <Text style={styles.emptyTexto}>Pronto se agregarán los partidos.</Text>
          </View>
        )}

        {jornada && partidos.length > 0 && (
          <>
            {/* Banner si ya pagó */}
            {yaGuardo && (
              <View style={[styles.statusBanner, esPagado ? styles.bannerGreen : styles.bannerOrange]}>
                <Ionicons name={esPagado ? 'checkmark-circle' : 'time-outline'} size={18} color="#fff"/>
                <View style={{flex:1}}>
                  <Text style={styles.statusText}>
                    {esPagado ? '¡Pago confirmado — Estás participando! 🎉' : 'Pago pendiente — Confirma tu pago'}
                  </Text>
                  {quiniela?.codigo && <Text style={styles.codigoText}>Código: {quiniela.codigo}</Text>}
                </View>
              </View>
            )}

            {/* Progreso selección */}
            {!yaGuardo && (
              <View style={styles.progressBox}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>{selCount}/{partidos.length} seleccionados</Text>
                  <Text style={styles.progressPct}>{Math.round(selCount / partidos.length * 100)}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${selCount / partidos.length * 100}%` as any }]}/>
                </View>
              </View>
            )}

            {/* Partidos */}
            {partidos.map(p => (
              <View key={p.id} style={styles.partidoCard}>
                <Text style={styles.partidoFecha}>{formatFecha(p.fecha)}</Text>
                <View style={styles.equiposRow}>
                  <Text style={styles.equipo} numberOfLines={1}>{p.local}</Text>
                  <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
                  <Text style={styles.equipo} numberOfLines={1}>{p.visitante}</Text>
                </View>
                <View style={styles.opcionesRow}>
                  {(['1','X','2'] as const).map(op => {
                    const activo = predicciones[p.id] === op;
                    return (
                      <TouchableOpacity
                        key={op}
                        style={[styles.opcion, activo && styles.opcionActiva, yaGuardo && { opacity: 0.7 }]}
                        onPress={() => seleccionar(p.id, op)}
                        disabled={yaGuardo}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.opcionLetra, activo && styles.opcionLetraActiva]}>{op}</Text>
                        <Text style={[styles.opcionEquipo, activo && styles.opcionEquipoActivo]} numberOfLines={1}>
                          {op==='1' ? p.local.slice(0,8) : op==='X' ? 'Empate' : p.visitante.slice(0,8)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Botón ir a pagar */}
            {!yaGuardo && (
              <TouchableOpacity
                style={[styles.btnPagar, !todoSel && styles.btnDisabled]}
                onPress={irAPagar}
                disabled={!todoSel}
                activeOpacity={0.8}
              >
                <Ionicons name="card" size={20} color="#fff"/>
                <Text style={styles.btnPagarTexto}>Pagar con Mercado Pago</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{height: insets.bottom + 40}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg}, center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:C.bg}, scroll:{flex:1},
  header:{paddingBottom:20,paddingHorizontal:20,backgroundColor:C.bg},
  headerTitle:{color:C.text,fontSize:28,fontWeight:'bold'},
  jornadaBadge:{marginTop:6,alignSelf:'flex-start',backgroundColor:C.accentDim,paddingHorizontal:12,paddingVertical:4,borderRadius:20},
  jornadaBadgeText:{color:C.accent,fontSize:13,fontWeight:'700'},
  emptyBox:{alignItems:'center',padding:60}, emptyEmoji:{fontSize:54,marginBottom:16},
  emptyTitulo:{fontSize:18,fontWeight:'bold',color:C.text,marginBottom:8},
  emptyTexto:{color:C.textSub,fontSize:14,textAlign:'center',lineHeight:22},
  statusBanner:{flexDirection:'row',alignItems:'flex-start',gap:10,marginHorizontal:16,marginBottom:12,padding:14,borderRadius:12},
  bannerGreen:{backgroundColor:'rgba(0,200,151,0.15)',borderWidth:1,borderColor:C.green},
  bannerOrange:{backgroundColor:'rgba(255,159,67,0.15)',borderWidth:1,borderColor:C.orange},
  statusText:{color:C.text,fontWeight:'600',fontSize:13}, codigoText:{color:C.textSub,fontSize:12,marginTop:3},
  progressBox:{marginHorizontal:16,marginBottom:12,backgroundColor:C.card,borderRadius:12,padding:14,borderWidth:1,borderColor:C.cardBorder},
  progressRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  progressLabel:{color:C.textSub,fontSize:13}, progressPct:{color:C.accent,fontSize:13,fontWeight:'700'},
  progressBar:{height:4,backgroundColor:'#1e1e35',borderRadius:2}, progressFill:{height:4,backgroundColor:C.accent,borderRadius:2},
  partidoCard:{backgroundColor:C.card,marginHorizontal:16,marginBottom:10,borderRadius:14,padding:16,borderWidth:1,borderColor:C.cardBorder},
  partidoFecha:{color:C.accent,fontSize:12,fontWeight:'600',marginBottom:10,textAlign:'center'},
  equiposRow:{flexDirection:'row',alignItems:'center',marginBottom:14},
  equipo:{flex:1,fontSize:15,fontWeight:'bold',color:C.text,textAlign:'center'},
  vsBadge:{backgroundColor:'#1e1e35',paddingHorizontal:8,paddingVertical:3,borderRadius:6,marginHorizontal:6},
  vsText:{color:C.textSub,fontSize:10,fontWeight:'700'},
  opcionesRow:{flexDirection:'row',gap:8},
  opcion:{flex:1,borderWidth:1.5,borderColor:'#2a2a40',borderRadius:10,paddingVertical:10,alignItems:'center',backgroundColor:'#12121f'},
  opcionActiva:{backgroundColor:C.accentDim,borderColor:C.accent},
  opcionLetra:{fontSize:17,fontWeight:'bold',color:C.textSub}, opcionLetraActiva:{color:C.accent},
  opcionEquipo:{fontSize:11,color:'#555577',marginTop:3}, opcionEquipoActivo:{color:C.accent},
  btnPagar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,backgroundColor:'#009ee3',marginHorizontal:16,marginTop:6,padding:17,borderRadius:14},
  btnDisabled:{backgroundColor:'#1e2a30',opacity:0.6}, btnPagarTexto:{color:'#fff',fontWeight:'bold',fontSize:16},
});
