import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Linking, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

type Partido = {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
  jornada: number;
  cerrado: boolean;
};

type Prediccion = {
  partido_id: string;
  resultado: '1' | 'X' | '2';
};

type QuinielaDB = {
  id: string;
  estado_pago: string;
  jornada: number;
};

export default function QuinielaScreen() {
  const { user } = useAuth();
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string, '1' | 'X' | '2'>>({});
  const [jornadaActual, setJornadaActual] = useState<number | null>(null);
  const [quiniela, setQuiniela] = useState<QuinielaDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user) return;

    const { data: partData } = await supabase
      .from('partidos')
      .select('*')
      .eq('cerrado', false)
      .order('jornada')
      .order('fecha');

    if (!partData || partData.length === 0) {
      setPartidos([]);
      setJornadaActual(null);
      setQuiniela(null);
      return;
    }

    const jornada = partData[0].jornada;
    setJornadaActual(jornada);
    setPartidos(partData);

    const { data: qData } = await supabase
      .from('quinielas')
      .select('id, estado_pago, jornada')
      .eq('usuario_id', user.id)
      .eq('jornada', jornada)
      .maybeSingle();
    setQuiniela(qData);

    if (qData) {
      const { data: predData } = await supabase
        .from('predicciones')
        .select('partido_id, resultado')
        .eq('usuario_id', user.id)
        .in('partido_id', partData.map(p => p.id));
      const map: Record<string, '1' | 'X' | '2'> = {};
      (predData || []).forEach(p => { map[p.partido_id] = p.resultado; });
      setPredicciones(map);
    } else {
      setPredicciones({});
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    cargar().finally(() => setLoading(false));
  }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  const seleccionar = (partidoId: string, resultado: '1' | 'X' | '2') => {
    if (quiniela) return;
    setPredicciones(prev => ({ ...prev, [partidoId]: resultado }));
  };

  const guardarQuiniela = async () => {
    if (!user || !jornadaActual) return;
    if (Object.keys(predicciones).length < partidos.length) {
      Alert.alert('Incompleto', 'Debes seleccionar un resultado para cada partido.');
      return;
    }
    setGuardando(true);
    const { data: nuevaQ, error: eQ } = await supabase
      .from('quinielas')
      .insert({ usuario_id: user.id, jornada: jornadaActual, estado_pago: 'pendiente', aciertos: 0 })
      .select()
      .single();
    if (eQ || !nuevaQ) {
      Alert.alert('Error', eQ?.message || 'Error al guardar');
      setGuardando(false);
      return;
    }
    const inserts = Object.entries(predicciones).map(([partido_id, resultado]) => ({
      usuario_id: user.id, partido_id, resultado, quiniela_id: nuevaQ.id,
    }));
    const { error: eP } = await supabase.from('predicciones').insert(inserts);
    if (eP) { Alert.alert('Error', eP.message); setGuardando(false); return; }
    await cargar();
    setGuardando(false);
    Alert.alert('\u2705 Quiniela guardada', 'Ahora realiza tu pago para participar.');
  };

  const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#009ee3" />;

  const yaGuardo = !!quiniela;
  const esPagado = quiniela?.estado_pago === 'pagado';
  const todoSeleccionado = partidos.length > 0 && Object.keys(predicciones).length === partidos.length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#009ee3']} tintColor="#009ee3" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚽ Mi Quiniela</Text>
        {jornadaActual && <Text style={styles.headerSub}>Jornada {jornadaActual}</Text>}
      </View>

      {partidos.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>⏳</Text>
          <Text style={styles.emptyTitulo}>Sin partidos disponibles</Text>
          <Text style={styles.emptyTexto}>El administrador aún no ha cargado los partidos de la siguiente jornada.</Text>
        </View>
      ) : (
        <>
          {yaGuardo && (
            <View style={[styles.statusBanner, esPagado ? styles.bannerPagado : styles.bannerPendiente]}>
              <Ionicons name={esPagado ? 'checkmark-circle' : 'time'} size={18} color="#fff" />
              <Text style={styles.statusText}>
                {esPagado ? 'Pago confirmado \u2014 Estás participando' : 'Pago pendiente \u2014 Confirma tu pago'}
              </Text>
            </View>
          )}

          {partidos.map(p => (
            <View key={p.id} style={styles.partidoCard}>
              <Text style={styles.fecha}>{formatFecha(p.fecha)}</Text>
              <View style={styles.equipos}>
                <Text style={styles.equipo}>{p.local}</Text>
                <Text style={styles.vs}>vs</Text>
                <Text style={styles.equipo}>{p.visitante}</Text>
              </View>
              <View style={styles.opciones}>
                {(['1', 'X', '2'] as const).map(op => (
                  <TouchableOpacity
                    key={op}
                    style={[
                      styles.opcion,
                      predicciones[p.id] === op && styles.opcionActiva,
                      yaGuardo && styles.opcionBloqueada,
                    ]}
                    onPress={() => seleccionar(p.id, op)}
                    disabled={yaGuardo}
                    activeOpacity={yaGuardo ? 1 : 0.7}
                  >
                    <Text style={[styles.opcionTexto, predicciones[p.id] === op && styles.opcionTextoActivo]}>
                      {op === '1' ? `1\n${p.local.slice(0, 8)}` : op === 'X' ? 'X\nEmpate' : `2\n${p.visitante.slice(0, 8)}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {!yaGuardo && (
            <TouchableOpacity
              style={[styles.btnGuardar, !todoSeleccionado && styles.btnDisabled]}
              onPress={guardarQuiniela}
              disabled={!todoSeleccionado || guardando}
            >
              {guardando
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnGuardarTexto}>💾 Guardar quiniela</Text>}
            </TouchableOpacity>
          )}

          {yaGuardo && !esPagado && (
            <View style={styles.pagoBox}>
              <Text style={styles.pagoTitulo}>💳 Realiza tu pago</Text>
              <Text style={styles.pagoTexto}>Envía tu comprobante de pago al administrador para confirmar tu participación.</Text>
              <TouchableOpacity
                style={styles.btnWhatsapp}
                onPress={() => Linking.openURL('https://wa.me/521XXXXXXXXXX?text=Hola%2C%20quiero%20confirmar%20mi%20pago%20de%20quiniela%20jornada%20' + jornadaActual)}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.btnWhatsappTexto}>Enviar comprobante por WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#009ee3', fontSize: 13, marginTop: 4, fontWeight: '600' },
  emptyBox: { alignItems: 'center', padding: 60 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitulo: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8 },
  emptyTexto: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 14, borderRadius: 10 },
  bannerPagado: { backgroundColor: '#2e7d32' },
  bannerPendiente: { backgroundColor: '#e65100' },
  statusText: { color: '#fff', fontWeight: '600', fontSize: 13, flex: 1 },
  partidoCard: { backgroundColor: '#fff', margin: 10, marginBottom: 6, borderRadius: 12, padding: 14, elevation: 2 },
  fecha: { fontSize: 11, color: '#009ee3', fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  equipos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  equipo: { flex: 1, fontSize: 14, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center' },
  vs: { fontSize: 12, color: '#aaa', marginHorizontal: 8 },
  opciones: { flexDirection: 'row', gap: 8 },
  opcion: { flex: 1, borderWidth: 2, borderColor: '#e0e0e0', borderRadius: 10, padding: 10, alignItems: 'center' },
  opcionActiva: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  opcionBloqueada: { opacity: 0.85 },
  opcionTexto: { fontSize: 12, color: '#555', textAlign: 'center', fontWeight: '600' },
  opcionTextoActivo: { color: '#fff' },
  btnGuardar: { backgroundColor: '#009ee3', margin: 12, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#b0bec5' },
  btnGuardarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pagoBox: { backgroundColor: '#fff', margin: 12, padding: 20, borderRadius: 12, elevation: 2 },
  pagoTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 8 },
  pagoTexto: { fontSize: 13, color: '#666', lineHeight: 20, marginBottom: 14 },
  btnWhatsapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25d366', padding: 14, borderRadius: 10 },
  btnWhatsappTexto: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
