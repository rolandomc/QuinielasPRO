import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Linking, RefreshControl, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b' };

type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null };
type Jornada  = { id:string; nombre:string; estado:string };
type QuinielaDB = { id:string; estado_pago:string; jornada_id:string; codigo:string };

export default function QuinielaScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [jornada, setJornada]     = useState<Jornada|null>(null);
  const [partidos, setPartidos]   = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string,'1'|'X'|'2'>>({});
  const [quiniela, setQuiniela]   = useState<QuinielaDB|null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;

    // 1. Jornada abierta activa
    const { data: jData } = await supabase
      .from('jornadas')
      .select('id,nombre,estado')
      .eq('estado','abierta')
      .order('creado_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!jData) { setJornada(null); setPartidos([]); setQuiniela(null); setLoading(false); return; }
    setJornada(jData);

    // 2. Partidos de esa jornada
    const { data: pData } = await supabase
      .from('partidos')
      .select('*')
      .eq('jornada_id', jData.id)
      .order('fecha');
    setPartidos(pData || []);

    // 3. Quiniela del usuario para esta jornada
    const { data: qData } = await supabase
      .from('quinielas')
      .select('id,estado_pago,jornada_id,codigo')
      .eq('usuario_id', user.id)
      .eq('jornada_id', jData.id)
      .maybeSingle();
    setQuiniela(qData);

    // 4. Sus predicciones
    if (qData && pData) {
      const { data: predData } = await supabase
        .from('predicciones')
        .select('partido_id,resultado')
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

  // Genera codigo tipo QUI-XXXX
  const generarCodigo = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'QUI-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const guardarQuiniela = async () => {
    if (!user || !jornada) return;
    if (Object.keys(predicciones).length < partidos.length) {
      Alert.alert('Incompleto', 'Selecciona un resultado para cada partido.');
      return;
    }
    setGuardando(true);
    const codigo = generarCodigo();
    const { data: nQ, error: eQ } = await supabase
      .from('quinielas')
      .insert({ usuario_id: user.id, jornada_id: jornada.id, jornada: 0, estado_pago: 'pendiente', aciertos: 0, codigo })
      .select().single();
    if (eQ || !nQ) { Alert.alert('Error', eQ?.message || 'Error'); setGuardando(false); return; }
    const inserts = Object.entries(predicciones).map(([partido_id, resultado]) => ({
      usuario_id: user.id, partido_id, resultado, quiniela_id: nQ.id,
    }));
    const { error: eP } = await supabase.from('predicciones').insert(inserts);
    if (eP) { Alert.alert('Error', eP.message); setGuardando(false); return; }
    await cargar();
    setGuardando(false);
    Alert.alert('✅ Quiniela guardada', `Tu código es: ${codigo}\n\nGuárdalo y envíalo con tu pago.`);
  };

  const formatFecha = (f: string) => new Date(f).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  const yaGuardo  = !!quiniela;
  const esPagado  = quiniela?.estado_pago === 'pagado';
  const todoSel   = partidos.length > 0 && Object.keys(predicciones).length === partidos.length;
  const selCount  = Object.keys(predicciones).length;

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
            {/* Banner estado */}
            {yaGuardo && (
              <View style={[styles.statusBanner, esPagado ? styles.bannerGreen : styles.bannerOrange]}>
                <Ionicons name={esPagado ? 'checkmark-circle' : 'time-outline'} size={18} color="#fff"/>
                <View style={{flex:1}}>
                  <Text style={styles.statusText}>
                    {esPagado ? '¡Pago confirmado — Estás participando! 🎉' : 'Pago pendiente — Confirma tu pago'}
                  </Text>
                  {quiniela?.codigo && (
                    <Text style={styles.codigoText}>Código: {quiniela.codigo}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Barra progreso */}
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

            {/* Botón guardar */}
            {!yaGuardo && (
              <TouchableOpacity
                style={[styles.btnGuardar, !todoSel && styles.btnDisabled]}
                onPress={guardarQuiniela}
                disabled={!todoSel || guardando}
                activeOpacity={0.8}
              >
                {guardando
                  ? <ActivityIndicator color="#fff"/>
                  : <><Ionicons name="save-outline" size={18} color="#fff"/><Text style={styles.btnGuardarTexto}>Guardar quiniela</Text></>}
              </TouchableOpacity>
            )}

            {/* Card pago */}
            {yaGuardo && !esPagado && (
              <View style={styles.pagoCard}>
                <Ionicons name="wallet-outline" size={28} color={C.accent} style={{marginBottom:8}}/>
                <Text style={styles.pagoTitulo}>Confirma tu pago</Text>
                <View style={styles.codigoBadge}>
                  <Text style={styles.codigoBadgeLabel}>Tu código</Text>
                  <Text style={styles.codigoBadgeValue}>{quiniela?.codigo}</Text>
                </View>
                <Text style={styles.pagoTexto}>Envía tu comprobante con este código al administrador para participar.</Text>
                <TouchableOpacity
                  style={styles.btnWsp}
                  onPress={() => Linking.openURL(`https://wa.me/521XXXXXXXXXX?text=Hola%2C+quiero+confirmar+mi+pago.+Mi+c%C3%B3digo+es+${quiniela?.codigo}+%E2%80%94+${jornada.nombre}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff"/>
                  <Text style={styles.btnWspTexto}>Enviar comprobante</Text>
                </TouchableOpacity>
              </View>
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
  statusText:{color:C.text,fontWeight:'600',fontSize:13},
  codigoText:{color:C.textSub,fontSize:12,marginTop:3},
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
  btnGuardar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.accent,marginHorizontal:16,marginTop:6,padding:16,borderRadius:14},
  btnDisabled:{backgroundColor:'#1e2a30',opacity:0.6}, btnGuardarTexto:{color:'#fff',fontWeight:'bold',fontSize:16},
  pagoCard:{backgroundColor:C.card,marginHorizontal:16,marginTop:6,borderRadius:14,padding:20,alignItems:'center',borderWidth:1,borderColor:C.cardBorder},
  pagoTitulo:{fontSize:16,fontWeight:'bold',color:C.text,marginBottom:12},
  codigoBadge:{backgroundColor:C.accentDim,borderWidth:1.5,borderColor:C.accent,borderRadius:12,paddingHorizontal:20,paddingVertical:10,alignItems:'center',marginBottom:12},
  codigoBadgeLabel:{color:C.textSub,fontSize:11,fontWeight:'600'},
  codigoBadgeValue:{color:C.accent,fontSize:24,fontWeight:'bold',letterSpacing:2},
  pagoTexto:{fontSize:13,color:C.textSub,textAlign:'center',lineHeight:20,marginBottom:16},
  btnWsp:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#25d366',paddingHorizontal:20,paddingVertical:12,borderRadius:10},
  btnWspTexto:{color:'#fff',fontWeight:'bold',fontSize:14},
});
