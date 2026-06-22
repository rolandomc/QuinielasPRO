import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

const C = { bg:'#0d0d1a', card:'#161625', cardBorder:'#1e1e35', accent:'#00b4d8', accentDim:'rgba(0,180,216,0.12)', text:'#f0f0ff', textSub:'#8888aa', textMuted:'#44445a', green:'#00c897', greenDim:'rgba(0,200,151,0.1)', orange:'#ff9f43', orangeDim:'rgba(255,159,67,0.1)', red:'#ff6b6b', gold:'#ffd700', goldDim:'rgba(255,215,0,0.1)' };

type Quiniela = {
  id: string;
  jornada_id: string;
  jornada_nombre: string;
  estado_jornada: string;
  estado_pago: string;
  aciertos: number;
  creado_en: string;
  monto_cobrado: number | null;
  es_ganador: boolean;
};

export default function PerfilScreen() {
  const { user, usuario, signOut, refreshUsuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuinielas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('quinielas')
      .select('id,jornada_id,estado_pago,aciertos,creado_en,monto_cobrado,jornadas(nombre,estado)')
      .eq('usuario_id', user.id)
      .order('creado_en', { ascending: false });
    if (data) {
      // Para determinar si es ganador: buscar si tiene el mayor aciertos en su jornada
      const jornadaIds = [...new Set(data.map((q: any) => q.jornada_id))];
      // Obtener max aciertos por jornada entre todos los participantes
      const { data: todasQ } = await supabase
        .from('quinielas')
        .select('jornada_id,aciertos')
        .in('jornada_id', jornadaIds);
      const maxPorJornada: Record<string, number> = {};
      (todasQ || []).forEach((q: any) => {
        const cur = maxPorJornada[q.jornada_id] ?? 0;
        if ((q.aciertos ?? 0) > cur) maxPorJornada[q.jornada_id] = q.aciertos ?? 0;
      });
      setQuinielas(data.map((q: any) => {
        const jornadaFinalizada = q.jornadas?.estado === 'finalizada';
        const esGanador = jornadaFinalizada && (q.aciertos ?? 0) > 0 && (q.aciertos ?? 0) === (maxPorJornada[q.jornada_id] ?? 0);
        return {
          ...q,
          jornada_nombre: q.jornadas?.nombre || 'Jornada',
          estado_jornada: q.jornadas?.estado || '',
          es_ganador: esGanador,
        };
      }));
    }
  }, [user]);

  useEffect(() => {
    if (user) { setLoading(true); fetchQuinielas().finally(() => setLoading(false)); }
  }, [user, fetchQuinielas]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchQuinielas(), refreshUsuario()]);
    setRefreshing(false);
  }, [fetchQuinielas, refreshUsuario]);

  const cerrarSesion = async () => { await signOut(); router.replace('/login'); };

  const estadoConfig = (estado: string) => {
    switch (estado) {
      case 'pagado':    return { label: 'Participando', color: C.green,  icon: 'checkmark-circle' as const };
      case 'pendiente': return { label: 'Pago pendiente', color: C.orange, icon: 'time-outline' as const };
      default:          return { label: 'Sin pago',       color: C.red,    icon: 'close-circle' as const };
    }
  };

  const totalAciertos   = quinielas.reduce((a, q) => a + (q.aciertos || 0), 0);
  const pagadas         = quinielas.filter(q => q.estado_pago === 'pagado').length;
  const ganadas         = quinielas.filter(q => q.es_ganador).length;
  const premioTotal     = quinielas.filter(q => q.es_ganador).reduce((s, q) => s + (q.monto_cobrado ?? 0), 0);

  const quinielasActivas    = quinielas.filter(q => q.estado_jornada !== 'finalizada');
  const quinielasHistorial  = quinielas.filter(q => q.estado_jornada === 'finalizada');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]}/>}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}><Ionicons name="person" size={40} color="#fff"/></View>
          </View>
          <Text style={styles.username}>{usuario?.username ? `@${usuario.username}` : usuario?.nombre || 'Jugador'}</Text>
          {usuario?.nombre && usuario?.username && <Text style={styles.nombre}>{usuario.nombre}</Text>}
          <Text style={styles.email}>{user?.email}</Text>
          {usuario?.es_admin && (
            <TouchableOpacity style={styles.btnAdmin} onPress={() => router.push('/admin')} activeOpacity={0.8}>
              <Ionicons name="shield-checkmark" size={14} color="#fff"/>
              <Text style={styles.btnAdminTexto}>Panel Admin</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row principal */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{quinielas.length}</Text>
            <Text style={styles.statLabel}>Jugadas</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.accent + '60' }]}>
            <Text style={[styles.statNum, { color: C.accent }]}>{totalAciertos}</Text>
            <Text style={styles.statLabel}>Aciertos</Text>
          </View>
          <View style={[styles.statCard, { borderColor: C.green + '60' }]}>
            <Text style={[styles.statNum, { color: C.green }]}>{pagadas}</Text>
            <Text style={styles.statLabel}>Pagadas</Text>
          </View>
        </View>

        {/* Stats ganador — solo si tiene historial */}
        {quinielasHistorial.length > 0 && (
          <View style={styles.statsRowGanador}>
            <View style={[styles.statCardGanador, { borderColor: C.gold + '50', backgroundColor: C.goldDim }]}>
              <Ionicons name="trophy" size={20} color={C.gold} style={{ marginBottom: 4 }}/>
              <Text style={[styles.statNum, { color: C.gold, fontSize: 24 }]}>{ganadas}</Text>
              <Text style={styles.statLabel}>Ganadas</Text>
            </View>
            {premioTotal > 0 && (
              <View style={[styles.statCardGanador, { borderColor: C.green + '50', backgroundColor: C.greenDim }]}>
                <Ionicons name="cash" size={20} color={C.green} style={{ marginBottom: 4 }}/>
                <Text style={[styles.statNum, { color: C.green, fontSize: 22 }]}>${premioTotal.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Premio cobrado</Text>
              </View>
            )}
          </View>
        )}

        {/* Quinielas activas */}
        {loading ? (
          <ActivityIndicator color={C.accent} style={{ margin: 30 }}/>
        ) : (
          <>
            {quinielasActivas.length > 0 && (
              <>
                <Text style={styles.seccionTitulo}>Activas</Text>
                {quinielasActivas.map((q, i) => {
                  const est = estadoConfig(q.estado_pago);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.quinielaCard}
                      onPress={() => router.push({ pathname: '/mis-pronosticos', params: { jornada_id: q.jornada_id, jornada_nombre: q.jornada_nombre } })}
                      activeOpacity={0.75}
                    >
                      <View style={styles.qCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.qJornada} numberOfLines={1}>{q.jornada_nombre}</Text>
                          <View style={styles.qEstadoRow}>
                            <Ionicons name={est.icon} size={13} color={est.color}/>
                            <Text style={[styles.qEstado, { color: est.color }]}>{est.label}</Text>
                          </View>
                        </View>
                        <View style={styles.qAciertosBox}>
                          {q.aciertos > 0 && <Text style={styles.qAciertosNum}>{q.aciertos}</Text>}
                          {q.aciertos > 0 && <Text style={styles.qAciertosLabel}>aciertos</Text>}
                          <Ionicons name="chevron-forward" size={16} color={C.textSub} style={{ marginTop: q.aciertos > 0 ? 0 : 4 }}/>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* Historial finalizadas */}
            {quinielasHistorial.length > 0 && (
              <>
                <Text style={[styles.seccionTitulo, { marginTop: quinielasActivas.length > 0 ? 20 : 0 }]}>Historial</Text>
                {quinielasHistorial.map((q, i) => {
                  const est = estadoConfig(q.estado_pago);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.quinielaCard,
                        q.es_ganador && styles.quinielaCardGanador,
                      ]}
                      onPress={() => router.push({ pathname: '/mis-pronosticos', params: { jornada_id: q.jornada_id, jornada_nombre: q.jornada_nombre } })}
                      activeOpacity={0.75}
                    >
                      {q.es_ganador && (
                        <View style={styles.ganadorBadge}>
                          <Ionicons name="trophy" size={11} color={C.gold}/>
                          <Text style={styles.ganadorBadgeTexto}>Ganador</Text>
                        </View>
                      )}
                      <View style={styles.qCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.qJornada, q.es_ganador && { color: C.gold }]} numberOfLines={1}>{q.jornada_nombre}</Text>
                          <View style={styles.qEstadoRow}>
                            <Ionicons name={est.icon} size={13} color={est.color}/>
                            <Text style={[styles.qEstado, { color: est.color }]}>{est.label}</Text>
                          </View>
                        </View>
                        <View style={styles.qAciertosBox}>
                          {q.aciertos > 0 && (
                            <View style={styles.aciertosChip}>
                              <Text style={styles.qAciertosNum}>{q.aciertos}</Text>
                              <Text style={styles.qAciertosLabel}>aciertos</Text>
                            </View>
                          )}
                          <Ionicons name="chevron-forward" size={16} color={C.textSub}/>
                        </View>
                      </View>
                      {q.es_ganador && q.monto_cobrado != null && q.monto_cobrado > 0 && (
                        <View style={styles.premioRow}>
                          <Ionicons name="cash-outline" size={13} color={C.green}/>
                          <Text style={styles.premioTexto}>Premio: ${q.monto_cobrado.toFixed(2)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {quinielas.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🎮</Text>
                <Text style={styles.emptyTexto}>Aún no has participado en ninguna quiniela.</Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.btnCerrar} onPress={cerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={C.red}/>
          <Text style={styles.btnCerrarTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
        <View style={{ height: 50 }}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  scroll:{flex:1},
  hero:{alignItems:'center',paddingBottom:28,paddingHorizontal:20,backgroundColor:C.bg},
  avatarRing:{width:88,height:88,borderRadius:44,borderWidth:2,borderColor:C.accent,justifyContent:'center',alignItems:'center',marginBottom:14},
  avatar:{width:76,height:76,borderRadius:38,backgroundColor:'#1e2a35',justifyContent:'center',alignItems:'center'},
  username:{color:C.text,fontSize:22,fontWeight:'bold'},
  nombre:{color:C.textSub,fontSize:14,marginTop:2},
  email:{color:'#555577',fontSize:12,marginTop:4},
  btnAdmin:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.accentDim,borderWidth:1,borderColor:C.accent,marginTop:14,paddingHorizontal:14,paddingVertical:7,borderRadius:20},
  btnAdminTexto:{color:C.accent,fontWeight:'700',fontSize:13},
  statsRow:{flexDirection:'row',marginHorizontal:16,marginBottom:10,gap:10},
  statsRowGanador:{flexDirection:'row',marginHorizontal:16,marginBottom:20,gap:10},
  statCard:{flex:1,backgroundColor:C.card,borderRadius:14,padding:16,alignItems:'center',borderWidth:1,borderColor:C.cardBorder},
  statCardGanador:{flex:1,backgroundColor:C.card,borderRadius:14,padding:16,alignItems:'center',borderWidth:1,borderColor:C.cardBorder},
  statNum:{fontSize:26,fontWeight:'bold',color:C.text},
  statLabel:{fontSize:11,color:C.textSub,marginTop:3},
  seccionTitulo:{color:C.textSub,fontSize:12,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',marginHorizontal:16,marginBottom:10},
  emptyBox:{alignItems:'center',padding:30,marginHorizontal:16,backgroundColor:C.card,borderRadius:14,borderWidth:1,borderColor:C.cardBorder},
  emptyTexto:{color:C.textSub,fontSize:14,textAlign:'center'},
  quinielaCard:{backgroundColor:C.card,marginHorizontal:16,marginBottom:8,borderRadius:14,padding:16,borderWidth:1,borderColor:C.cardBorder},
  quinielaCardGanador:{borderColor:C.gold+'60',backgroundColor:'rgba(255,215,0,0.04)'},
  ganadorBadge:{flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start',backgroundColor:C.goldDim,borderRadius:20,paddingHorizontal:8,paddingVertical:3,marginBottom:8,borderWidth:1,borderColor:C.gold+'50'},
  ganadorBadgeTexto:{fontSize:11,fontWeight:'700',color:C.gold},
  qCardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  qJornada:{color:C.text,fontSize:15,fontWeight:'bold',marginBottom:4},
  qEstadoRow:{flexDirection:'row',alignItems:'center',gap:5},
  qEstado:{fontSize:13,fontWeight:'600'},
  qAciertosBox:{alignItems:'center',flexDirection:'row',gap:6},
  aciertosChip:{alignItems:'center'},
  qAciertosNum:{fontSize:20,fontWeight:'bold',color:C.accent},
  qAciertosLabel:{fontSize:10,color:C.textSub},
  premioRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:8,paddingTop:8,borderTopWidth:1,borderTopColor:C.cardBorder},
  premioTexto:{fontSize:13,color:C.green,fontWeight:'700'},
  btnCerrar:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginHorizontal:16,marginTop:10,padding:14,borderRadius:12,borderWidth:1.5,borderColor:'rgba(255,107,107,0.3)',backgroundColor:'rgba(255,107,107,0.07)'},
  btnCerrarTexto:{color:C.red,fontWeight:'700',fontSize:15},
});
