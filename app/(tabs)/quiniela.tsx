import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl, StatusBar, Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', green:'#00c897', orange:'#ff9f43', red:'#ff6b6b' };

type Partido    = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean };
type Jornada    = { id:string; nombre:string; estado:string };
type QuinielaDB = { id:string; estado_pago:string; jornada_id:string };
type Resultado  = '1'|'X'|'2';

// ── Conteo regresivo ─────────────────────────────────────────────
function useCountdown(fechaISO: string) {
  const calcDiff = () => Math.max(0, new Date(fechaISO).getTime() - Date.now());
  const [ms, setMs] = useState(calcDiff);
  const ref = useRef<any>(null);
  useEffect(() => {
    ref.current = setInterval(() => setMs(calcDiff()), 1000);
    return () => clearInterval(ref.current);
  }, [fechaISO]);
  const total = ms;
  const d  = Math.floor(total / 86400000);
  const h  = Math.floor((total % 86400000) / 3600000);
  const m  = Math.floor((total % 3600000) / 60000);
  const s  = Math.floor((total % 60000) / 1000);
  return { total, d, h, m, s };
}

function Countdown({ fecha }: { fecha: string }) {
  const { total, d, h, m, s } = useCountdown(fecha);
  if (total <= 0) return null;
  const urgente = total < 3600000; // menos de 1 hora
  const texto = d > 0
    ? `Inicia en ${d}d ${h}h ${m}m`
    : h > 0
    ? `Inicia en ${h}h ${m}m ${s}s`
    : `Inicia en ${m}m ${s}s`;
  return (
    <View style={[cdStyles.wrap, urgente && cdStyles.wrapUrgente]}>
      <Ionicons name="time-outline" size={12} color={urgente ? C.orange : C.accent} />
      <Text style={[cdStyles.texto, urgente && cdStyles.textoUrgente]}>{texto}</Text>
    </View>
  );
}

const cdStyles = StyleSheet.create({
  wrap: { flexDirection:'row', alignItems:'center', gap:4, alignSelf:'center', marginTop:4, marginBottom:2, backgroundColor:'rgba(0,180,216,0.08)', borderRadius:8, paddingHorizontal:8, paddingVertical:3, borderWidth:1, borderColor:'rgba(0,180,216,0.2)' },
  wrapUrgente: { backgroundColor:'rgba(255,159,67,0.1)', borderColor:'rgba(255,159,67,0.35)' },
  texto: { color:C.accent, fontSize:11, fontWeight:'700' },
  textoUrgente: { color:C.orange },
});
// ─────────────────────────────────────────────────────────────────

export default function QuinielaScreen() {
  const { user, usuario } = useAuth();
  const insets = useSafeAreaInsets();

  const [jornada, setJornada]           = useState<Jornada|null>(null);
  const [partidos, setPartidos]         = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string, Resultado>>({});
  const [quiniela, setQuiniela]         = useState<QuinielaDB|null>(null);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [loadingPago, setLoadingPago]   = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;
    const { data: jData } = await supabase
      .from('jornadas').select('id,nombre,estado').eq('estado','abierta')
      .order('creado_at', { ascending: false }).limit(1).maybeSingle();
    if (!jData) { setJornada(null); setPartidos([]); setQuiniela(null); return; }
    setJornada(jData);
    const { data: pData } = await supabase
      .from('partidos').select('*').eq('jornada_id', jData.id).order('fecha');
    setPartidos(pData || []);
    const { data: qData } = await supabase
      .from('quinielas').select('id,estado_pago,jornada_id')
      .eq('usuario_id', user.id).eq('jornada_id', jData.id).maybeSingle();
    setQuiniela(qData);
    if (qData && pData) {
      const { data: predData } = await supabase
        .from('predicciones').select('partido_id,resultado')
        .eq('usuario_id', user.id).in('partido_id', pData.map(p => p.id));
      const map: Record<string, Resultado> = {};
      (predData || []).forEach(p => { map[p.partido_id] = p.resultado as Resultado; });
      setPredicciones(map);
    } else { setPredicciones({}); }
  }, [user]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await cargar(); setRefreshing(false); }, [cargar]);

  const seleccionar = (id: string, r: Resultado) => {
    if (quiniela) return;
    setPredicciones(p => ({ ...p, [id]: r }));
  };

  const confirmarYPagar = async () => {
    if (!user || !jornada) return;
    const completa = partidos.every(p => predicciones[p.id]);
    if (!completa) { Alert.alert('Incompleto', 'Selecciona un resultado para cada partido.'); return; }
    setLoadingPago(true);
    try {
      const rows = partidos.map(p => ({ usuario_id: user.id, partido_id: p.id, resultado: predicciones[p.id] }));
      const { error: predError } = await supabase.from('predicciones').upsert(rows, { onConflict: 'usuario_id,partido_id' });
      if (predError) throw new Error('Error guardando predicciones: ' + predError.message);
      const { error: qError } = await supabase.from('quinielas').upsert(
        { usuario_id: user.id, jornada_id: jornada.id, jornada: 0, estado_pago: 'pendiente', aciertos: 0 },
        { onConflict: 'usuario_id,jornada_id' }
      );
      if (qError) throw new Error('Error creando quiniela: ' + qError.message);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        'https://kdvbmvsolrquphfedldz.supabase.co/functions/v1/crear-pago',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ nombre: usuario?.nombre || 'Jugador', usuario_id: user.id, jornada_id: jornada.id, jornada_nombre: jornada.nombre }) }
      );
      const data = await response.json();
      if (response.ok && data.urlPago) {
        await cargar();
        if (Platform.OS === 'web') (window as any).open(data.urlPago, '_self');
        else Linking.openURL(data.urlPago);
      } else { throw new Error(data.error || 'No se pudo crear el pago.'); }
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoadingPago(false); }
  };

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} size="large"/></View>;

  const yaGuardo = !!quiniela;
  const esPagado = quiniela?.estado_pago === 'pagado';
  const todoSel  = partidos.length > 0 && partidos.every(p => predicciones[p.id]);
  const selCount = partidos.filter(p => predicciones[p.id]).length;

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
            {yaGuardo && (
              <View style={[styles.statusBanner, esPagado ? styles.bannerGreen : styles.bannerOrange]}>
                <Ionicons name={esPagado ? 'checkmark-circle' : 'time-outline'} size={18} color="#fff"/>
                <Text style={styles.statusText}>
                  {esPagado ? 'Pago confirmado — ¡Estás participando! 🎉' : 'Pago pendiente — Completa tu pago para participar'}
                </Text>
              </View>
            )}

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

            {partidos.map(p => (
              <View key={p.id} style={styles.partidoCard}>
                <Text style={styles.partidoFecha}>{formatFecha(p.fecha)}</Text>
                {/* ── Conteo regresivo ── */}
                <Countdown fecha={p.fecha} />
                <View style={styles.equiposRow}>
                  <Text style={styles.equipo} numberOfLines={1}>{p.local}</Text>
                  <View style={styles.vsBadge}><Text style={styles.vsText}>VS</Text></View>
                  <Text style={styles.equipo} numberOfLines={1}>{p.visitante}</Text>
                </View>
                <View style={styles.opcionesRow}>
                  {(['1','X','2'] as Resultado[]).map(op => {
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

            {!esPagado && (
              <TouchableOpacity
                style={[styles.btnPagar, (!todoSel && !yaGuardo) && styles.btnDisabled]}
                onPress={confirmarYPagar}
                disabled={loadingPago || (!todoSel && !yaGuardo)}
                activeOpacity={0.8}
              >
                {loadingPago
                  ? <ActivityIndicator color="#fff"/>
                  : <Text style={styles.btnPagarTexto}>{yaGuardo ? '💳 Reintentar pago' : '💳 Confirmar y pagar'}</Text>
                }
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
  statusBanner:{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:16,marginBottom:12,padding:14,borderRadius:12},
  bannerGreen:{backgroundColor:'rgba(0,200,151,0.15)',borderWidth:1,borderColor:C.green},
  bannerOrange:{backgroundColor:'rgba(255,159,67,0.15)',borderWidth:1,borderColor:C.orange},
  statusText:{color:C.text,fontWeight:'600',fontSize:13,flex:1},
  progressBox:{marginHorizontal:16,marginBottom:12,backgroundColor:C.card,borderRadius:12,padding:14,borderWidth:1,borderColor:C.cardBorder},
  progressRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  progressLabel:{color:C.textSub,fontSize:13}, progressPct:{color:C.accent,fontSize:13,fontWeight:'700'},
  progressBar:{height:4,backgroundColor:'#1e1e35',borderRadius:2}, progressFill:{height:4,backgroundColor:C.accent,borderRadius:2},
  partidoCard:{backgroundColor:C.card,marginHorizontal:16,marginBottom:10,borderRadius:14,padding:16,borderWidth:1,borderColor:C.cardBorder},
  partidoFecha:{color:C.accent,fontSize:12,fontWeight:'600',marginBottom:4,textAlign:'center'},
  equiposRow:{flexDirection:'row',alignItems:'center',marginBottom:14,marginTop:8},
  equipo:{flex:1,fontSize:15,fontWeight:'bold',color:C.text,textAlign:'center'},
  vsBadge:{backgroundColor:'#1e1e35',paddingHorizontal:8,paddingVertical:3,borderRadius:6,marginHorizontal:6},
  vsText:{color:C.textSub,fontSize:10,fontWeight:'700'},
  opcionesRow:{flexDirection:'row',gap:8},
  opcion:{flex:1,borderWidth:1.5,borderColor:'#2a2a40',borderRadius:10,paddingVertical:10,alignItems:'center',backgroundColor:'#12121f'},
  opcionActiva:{backgroundColor:C.accentDim,borderColor:C.accent},
  opcionLetra:{fontSize:17,fontWeight:'bold',color:C.textSub}, opcionLetraActiva:{color:C.accent},
  opcionEquipo:{fontSize:11,color:'#555577',marginTop:3}, opcionEquipoActivo:{color:C.accent},
  btnPagar:{alignItems:'center',justifyContent:'center',backgroundColor:'#1a1a2e',marginHorizontal:16,marginTop:8,padding:17,borderRadius:14},
  btnDisabled:{backgroundColor:'#1e2a30',opacity:0.6},
  btnPagarTexto:{color:'#fff',fontWeight:'bold',fontSize:16},
});
