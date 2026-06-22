import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

type Quiniela = {
  id: string; jornada_id: string; jornada_nombre: string;
  estado_jornada: string; estado_pago: string;
  aciertos: number; creado_en: string;
  monto_cobrado: number | null; es_ganador: boolean;
};

export default function PerfilScreen() {
  const { user, usuario, signOut, refreshUsuario } = useAuth();
  const { colors, theme, toggleTheme } = useTheme();
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
      const jornadaIds = [...new Set(data.map((q: any) => q.jornada_id))];
      const { data: todasQ } = await supabase.from('quinielas').select('jornada_id,aciertos').in('jornada_id', jornadaIds);
      const maxPorJornada: Record<string, number> = {};
      (todasQ || []).forEach((q: any) => {
        const cur = maxPorJornada[q.jornada_id] ?? 0;
        if ((q.aciertos ?? 0) > cur) maxPorJornada[q.jornada_id] = q.aciertos ?? 0;
      });
      setQuinielas(data.map((q: any) => {
        const jornadaFinalizada = q.jornadas?.estado === 'finalizada';
        const esGanador = jornadaFinalizada && (q.aciertos ?? 0) > 0 && (q.aciertos ?? 0) === (maxPorJornada[q.jornada_id] ?? 0);
        return { ...q, jornada_nombre: q.jornadas?.nombre || 'Jornada', estado_jornada: q.jornadas?.estado || '', es_ganador: esGanador };
      }));
    }
  }, [user]);

  useEffect(() => { if (user) { setLoading(true); fetchQuinielas().finally(() => setLoading(false)); } }, [user, fetchQuinielas]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await Promise.all([fetchQuinielas(), refreshUsuario()]); setRefreshing(false); }, [fetchQuinielas, refreshUsuario]);
  const cerrarSesion = async () => { await signOut(); router.replace('/login'); };

  const estadoConfig = (estado: string) => {
    switch (estado) {
      case 'pagado':    return { label: 'Participando',   color: colors.green,  icon: 'checkmark-circle' as const };
      case 'pendiente': return { label: 'Pago pendiente', color: colors.orange, icon: 'time-outline' as const };
      default:          return { label: 'Sin pago',       color: colors.red,    icon: 'close-circle' as const };
    }
  };

  const totalAciertos  = quinielas.reduce((a, q) => a + (q.aciertos || 0), 0);
  const pagadas        = quinielas.filter(q => q.estado_pago === 'pagado').length;
  const ganadas        = quinielas.filter(q => q.es_ganador).length;
  const premioTotal    = quinielas.filter(q => q.es_ganador).reduce((s, q) => s + (q.monto_cobrado ?? 0), 0);
  const quinielasActivas   = quinielas.filter(q => q.estado_jornada !== 'finalizada');
  const quinielasHistorial = quinielas.filter(q => q.estado_jornada === 'finalizada');

  const C = colors;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg2 }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={C.bg2}/>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]}/>}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingTop: insets.top + 16, paddingBottom: 28, paddingHorizontal: 20, backgroundColor: C.bg2 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: C.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="person" size={40} color={C.accent}/>
            </View>
          </View>
          <Text style={{ color: C.text, fontSize: 22, fontWeight: 'bold' }}>{usuario?.username ? `@${usuario.username}` : usuario?.nombre || 'Jugador'}</Text>
          {usuario?.nombre && usuario?.username && <Text style={{ color: C.textSub, fontSize: 14, marginTop: 2 }}>{usuario.nombre}</Text>}
          <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{user?.email}</Text>

          {/* Botones hero */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {usuario?.es_admin && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }} onPress={() => router.push('/admin')} activeOpacity={0.8}>
                <Ionicons name="shield-checkmark" size={14} color={C.accent}/>
                <Text style={{ color: C.accent, fontWeight: '700', fontSize: 13 }}>Panel Admin</Text>
              </TouchableOpacity>
            )}
            {/* Toggle tema */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}
              onPress={toggleTheme}
              activeOpacity={0.8}
            >
              <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={15} color={C.textSub}/>
              <Text style={{ color: C.textSub, fontWeight: '600', fontSize: 13 }}>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder }}>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: C.text }}>{quinielas.length}</Text>
            <Text style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>Jugadas</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.accent + '60' }}>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: C.accent }}>{totalAciertos}</Text>
            <Text style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>Aciertos</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.green + '60' }}>
            <Text style={{ fontSize: 26, fontWeight: 'bold', color: C.green }}>{pagadas}</Text>
            <Text style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>Pagadas</Text>
          </View>
        </View>

        {quinielasHistorial.length > 0 && (
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 20, gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.gold + '50', backgroundColor: C.goldDim }}>
              <Ionicons name="trophy" size={20} color={C.gold} style={{ marginBottom: 4 }}/>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: C.gold }}>{ganadas}</Text>
              <Text style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>Ganadas</Text>
            </View>
            {premioTotal > 0 && (
              <View style={{ flex: 1, backgroundColor: C.greenDim, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: C.green + '50' }}>
                <Ionicons name="cash" size={20} color={C.green} style={{ marginBottom: 4 }}/>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: C.green }}>${premioTotal.toFixed(0)}</Text>
                <Text style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>Premio cobrado</Text>
              </View>
            )}
          </View>
        )}

        {loading ? <ActivityIndicator color={C.accent} style={{ margin: 30 }}/> : (
          <>
            {quinielasActivas.length > 0 && (
              <>
                <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 16, marginBottom: 10 }}>Activas</Text>
                {quinielasActivas.map((q, i) => {
                  const est = estadoConfig(q.estado_pago);
                  return (
                    <TouchableOpacity key={i} style={{ backgroundColor: C.card, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.cardBorder }} onPress={() => router.push({ pathname: '/mis-pronosticos', params: { jornada_id: q.jornada_id, jornada_nombre: q.jornada_nombre } })} activeOpacity={0.75}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontSize: 15, fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>{q.jornada_nombre}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name={est.icon} size={13} color={est.color}/>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: est.color }}>{est.label}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
                          {q.aciertos > 0 && <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: 'bold', color: C.accent }}>{q.aciertos}</Text><Text style={{ fontSize: 10, color: C.textSub }}>aciertos</Text></View>}
                          <Ionicons name="chevron-forward" size={16} color={C.textSub}/>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {quinielasHistorial.length > 0 && (
              <>
                <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginHorizontal: 16, marginBottom: 10, marginTop: quinielasActivas.length > 0 ? 20 : 0 }}>Historial</Text>
                {quinielasHistorial.map((q, i) => {
                  const est = estadoConfig(q.estado_pago);
                  return (
                    <TouchableOpacity key={i} style={{ backgroundColor: q.es_ganador ? C.goldDim : C.card, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: q.es_ganador ? C.gold + '60' : C.cardBorder }} onPress={() => router.push({ pathname: '/mis-pronosticos', params: { jornada_id: q.jornada_id, jornada_nombre: q.jornada_nombre } })} activeOpacity={0.75}>
                      {q.es_ganador && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: C.goldDim, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8, borderWidth: 1, borderColor: C.gold + '50' }}>
                          <Ionicons name="trophy" size={11} color={C.gold}/>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: C.gold }}>Ganador</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: q.es_ganador ? C.gold : C.text, fontSize: 15, fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>{q.jornada_nombre}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name={est.icon} size={13} color={est.color}/>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: est.color }}>{est.label}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
                          {q.aciertos > 0 && <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: 'bold', color: C.accent }}>{q.aciertos}</Text><Text style={{ fontSize: 10, color: C.textSub }}>aciertos</Text></View>}
                          <Ionicons name="chevron-forward" size={16} color={C.textSub}/>
                        </View>
                      </View>
                      {q.es_ganador && q.monto_cobrado != null && q.monto_cobrado > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.cardBorder }}>
                          <Ionicons name="cash-outline" size={13} color={C.green}/>
                          <Text style={{ fontSize: 13, color: C.green, fontWeight: '700' }}>Premio: ${q.monto_cobrado.toFixed(2)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {quinielas.length === 0 && (
              <View style={{ alignItems: 'center', padding: 30, marginHorizontal: 16, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder }}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🎮</Text>
                <Text style={{ color: C.textSub, fontSize: 14, textAlign: 'center' }}>Aún no has participado en ninguna quiniela.</Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.07)' }} onPress={cerrarSesion} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.red}/>
          <Text style={{ color: colors.red, fontWeight: '700', fontSize: 15 }}>Cerrar sesión</Text>
        </TouchableOpacity>
        <View style={{ height: 50 }}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});
