import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Partido = {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
  jornada: number;
  cerrado: boolean;
};

type Resultado = '1' | 'X' | '2';

export default function QuinielaScreen() {
  const { user, usuario } = useAuth();
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [predicciones, setPredicciones] = useState<Record<string, Resultado>>({});
  const [jornada, setJornada] = useState<number | null>(null);
  const [loadingPartidos, setLoadingPartidos] = useState(true);
  const [loadingPago, setLoadingPago] = useState(false);
  const [yaEnvio, setYaEnvio] = useState(false);
  const [estadoPago, setEstadoPago] = useState<string>('pendiente');

  const cargarPartidos = useCallback(async () => {
    setLoadingPartidos(true);
    const { data, error } = await supabase
      .from('partidos')
      .select('*')
      .eq('cerrado', false)
      .order('fecha', { ascending: true });
    if (error) {
      Alert.alert('Error', 'No se pudieron cargar los partidos.');
    } else if (data && data.length > 0) {
      setPartidos(data);
      setJornada(data[0].jornada);
    }
    setLoadingPartidos(false);
  }, []);

  const cargarEstado = useCallback(async () => {
    if (!user || !jornada) return;
    const { data: quinielaData } = await supabase
      .from('quinielas')
      .select('id, estado_pago')
      .eq('usuario_id', user.id)
      .eq('jornada', jornada)
      .single();
    if (quinielaData) {
      setYaEnvio(true);
      setEstadoPago(quinielaData.estado_pago);
    }
    const { data: preds } = await supabase
      .from('predicciones')
      .select('partido_id, resultado')
      .eq('usuario_id', user.id);
    if (preds) {
      const map: Record<string, Resultado> = {};
      preds.forEach((p) => { map[p.partido_id] = p.resultado as Resultado; });
      setPredicciones(map);
    }
  }, [user, jornada]);

  useEffect(() => { cargarPartidos(); }, [cargarPartidos]);
  useEffect(() => { cargarEstado(); }, [cargarEstado]);

  const seleccionar = (partidoId: string, resultado: Resultado) => {
    if (yaEnvio) return;
    setPredicciones((prev) => ({ ...prev, [partidoId]: resultado }));
  };

  const confirmarYPagar = async () => {
    const completa = partidos.every((p) => predicciones[p.id]);
    if (!completa) {
      Alert.alert('Incompleto', 'Selecciona un resultado para cada partido.');
      return;
    }
    if (!user || !jornada) return;
    setLoadingPago(true);
    try {
      // 1. Guardar predicciones
      const rows = partidos.map((p) => ({
        usuario_id: user.id,
        partido_id: p.id,
        resultado: predicciones[p.id],
      }));
      const { error: predError } = await supabase
        .from('predicciones')
        .upsert(rows, { onConflict: 'usuario_id,partido_id' });
      if (predError) throw new Error('Error guardando predicciones: ' + predError.message);

      // 2. Crear o actualizar registro en quinielas
      const { error: quinielaError } = await supabase
        .from('quinielas')
        .upsert(
          { usuario_id: user.id, jornada, estado_pago: 'pendiente' },
          { onConflict: 'usuario_id,jornada' }
        );
      if (quinielaError) throw new Error('Error creando quiniela: ' + quinielaError.message);

      // 3. Crear preferencia de pago en Mercado Pago
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        'https://kdvbmvsolrquphfedldz.supabase.co/functions/v1/crear-pago',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            nombre: usuario?.nombre || 'Jugador',
            usuario_id: user.id,
            jornada,
          }),
        }
      );
      const data = await response.json();
      if (response.ok && data.urlPago) {
        setYaEnvio(true);
        if (Platform.OS === 'web') window.open(data.urlPago, '_self');
        else Linking.openURL(data.urlPago);
      } else {
        throw new Error(data.error || 'No se pudo crear el pago.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingPago(false);
    }
  };

  if (loadingPartidos) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#009ee3" />
        <Text style={styles.loadingText}>Cargando partidos...</Text>
      </View>
    );
  }

  if (partidos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>🕐</Text>
        <Text style={styles.emptyTitle}>Sin partidos disponibles</Text>
        <Text style={styles.emptyText}>El administrador aún no ha cargado los partidos.</Text>
      </View>
    );
  }

  const totalSeleccionados = partidos.filter((p) => predicciones[p.id]).length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚽ Jornada {jornada}</Text>
        <Text style={styles.headerSub}>
          {yaEnvio
            ? estadoPago === 'pagado' ? '✅ Pagado — Participando' : '⏳ Pago pendiente'
            : `${totalSeleccionados}/${partidos.length} seleccionados`}
        </Text>
      </View>

      {yaEnvio && (
        <View style={[styles.bannerEnviado, estadoPago === 'pagado' && styles.bannerPagado]}>
          <Text style={styles.bannerTexto}>
            {estadoPago === 'pagado'
              ? '🎉 Pago confirmado. ¡Estás participando!'
              : '⏳ Pronósticos guardados. Completa el pago para participar.'}
          </Text>
        </View>
      )}

      {partidos.map((partido) => (
        <View key={partido.id} style={styles.card}>
          <Text style={styles.fecha}>
            {new Date(partido.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.equipos}>
            <Text style={styles.equipo}>{partido.local}</Text>
            <Text style={styles.vs}>VS</Text>
            <Text style={styles.equipo}>{partido.visitante}</Text>
          </View>
          <View style={styles.opciones}>
            {(['1', 'X', '2'] as Resultado[]).map((op) => (
              <TouchableOpacity
                key={op}
                style={[
                  styles.opcionBtn,
                  predicciones[partido.id] === op && styles.opcionSeleccionada,
                  yaEnvio && styles.opcionDeshabilitada,
                ]}
                onPress={() => seleccionar(partido.id, op)}
                disabled={yaEnvio}
              >
                <Text style={[
                  styles.opcionTexto,
                  predicciones[partido.id] === op && styles.opcionTextoActivo,
                ]}>
                  {op === '1' ? `1\n${partido.local}` : op === 'X' ? 'X\nEmpate' : `2\n${partido.visitante}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {!yaEnvio && (
        <TouchableOpacity
          style={[styles.btnPagar, (loadingPago || totalSeleccionados < partidos.length) && styles.btnDisabled]}
          onPress={confirmarYPagar}
          disabled={loadingPago || totalSeleccionados < partidos.length}
        >
          {loadingPago
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPagarTexto}>💳 Confirmar y pagar $100.00</Text>
          }
        </TouchableOpacity>
      )}

      {yaEnvio && estadoPago !== 'pagado' && (
        <TouchableOpacity
          style={styles.btnPagar}
          onPress={confirmarYPagar}
          disabled={loadingPago}
        >
          {loadingPago
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPagarTexto}>💳 Reintentar pago</Text>
          }
        </TouchableOpacity>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#f0f2f5' },
  loadingText: { marginTop: 12, color: '#888' },
  emptyEmoji: { fontSize: 60, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8 },
  header: { backgroundColor: '#1a1a2e', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#009ee3', fontSize: 14, marginTop: 4 },
  bannerEnviado: { backgroundColor: '#fff3e0', margin: 10, padding: 14, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#ff9800' },
  bannerPagado: { backgroundColor: '#e8f5e9', borderLeftColor: '#4caf50' },
  bannerTexto: { color: '#444', fontSize: 13 },
  card: { backgroundColor: '#fff', margin: 10, borderRadius: 12, padding: 15, elevation: 3 },
  fecha: { fontSize: 11, color: '#888', marginBottom: 8, textAlign: 'center', textTransform: 'capitalize' },
  equipos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  equipo: { fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  vs: { fontSize: 11, color: '#aaa', marginHorizontal: 5 },
  opciones: { flexDirection: 'row', gap: 8 },
  opcionBtn: { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 8, alignItems: 'center' },
  opcionSeleccionada: { backgroundColor: '#009ee3', borderColor: '#009ee3' },
  opcionDeshabilitada: { opacity: 0.6 },
  opcionTexto: { fontSize: 11, color: '#555', textAlign: 'center', fontWeight: '600' },
  opcionTextoActivo: { color: '#fff' },
  btnPagar: { backgroundColor: '#1a1a2e', margin: 15, padding: 16, borderRadius: 10, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#ccc' },
  btnPagarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
