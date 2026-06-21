import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type FilaPartido = {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
  resultado_final: string | null;
  mi_prediccion: string | null;
  acerto: boolean | null;
};

export default function MisPronosticosScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { jornada } = useLocalSearchParams<{ jornada: string }>();
  const [filas, setFilas] = useState<FilaPartido[]>([]);
  const [loading, setLoading] = useState(true);
  const [aciertos, setAciertos] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (user && jornada) cargar();
  }, [jornada, user]);

  const cargar = async () => {
    setLoading(true);

    // 1. Todos los partidos de la jornada (cerrados o no)
    const { data: partidos } = await supabase
      .from('partidos')
      .select('id, local, visitante, fecha, resultado_final')
      .eq('jornada', parseInt(jornada as string))
      .order('fecha');

    if (!partidos || partidos.length === 0) {
      setFilas([]);
      setLoading(false);
      return;
    }

    // 2. Mis predicciones para TODOS los partidos de la jornada
    const { data: preds } = await supabase
      .from('predicciones')
      .select('partido_id, resultado')
      .eq('usuario_id', user!.id)
      .in('partido_id', partidos.map(p => p.id));

    const predMap: Record<string, string> = {};
    (preds || []).forEach(p => { predMap[p.partido_id] = p.resultado; });

    // 3. Construir filas comparando prediccion vs resultado real
    const filasCalc: FilaPartido[] = partidos.map(p => {
      const miPred = predMap[p.id] ?? null;
      let acerto: boolean | null = null;
      if (p.resultado_final !== null && miPred !== null) {
        acerto = p.resultado_final === miPred;
      }
      return {
        id: p.id,
        local: p.local,
        visitante: p.visitante,
        fecha: p.fecha,
        resultado_final: p.resultado_final,
        mi_prediccion: miPred,
        acerto,
      };
    });

    // 4. Calcular resumen solo de partidos ya jugados
    const jugados = filasCalc.filter(f => f.acerto !== null);
    setAciertos(jugados.filter(f => f.acerto === true).length);
    setTotal(jugados.length);
    setFilas(filasCalc);
    setLoading(false);
  };

  const etiqueta = (val: string | null, local: string, visitante: string) => {
    if (!val) return '—';
    if (val === '1') return `1 · ${local}`;
    if (val === 'X') return 'X · Empate';
    if (val === '2') return `2 · ${visitante}`;
    return val;
  };

  const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jornada {jornada} — Mis pronósticos</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#009ee3" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView>
          {/* Resumen solo si hay partidos jugados */}
          {total > 0 && (
            <View style={styles.resumen}>
              <View style={styles.resumenItem}>
                <Text style={styles.resumenNum}>{aciertos}/{total}</Text>
                <Text style={styles.resumenLabel}>Aciertos</Text>
              </View>
              <View style={styles.resumenDivider} />
              <View style={styles.resumenItem}>
                <Text style={[styles.resumenNum, { color: porcentaje >= 50 ? '#4caf50' : '#ff9800' }]}>
                  {porcentaje}%
                </Text>
                <Text style={styles.resumenLabel}>Efectividad</Text>
              </View>
              <View style={styles.resumenDivider} />
              <View style={styles.resumenItem}>
                <Text style={styles.resumenNum}>{filas.length - total}</Text>
                <Text style={styles.resumenLabel}>Pendientes</Text>
              </View>
            </View>
          )}

          {filas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No se encontraron partidos para esta jornada.</Text>
            </View>
          ) : (
            filas.map(f => (
              <View key={f.id} style={[
                styles.card,
                f.acerto === true && styles.cardAcierto,
                f.acerto === false && styles.cardFallo,
              ]}>
                <View style={styles.iconoContainer}>
                  {f.acerto === true  && <Ionicons name="checkmark-circle" size={26} color="#4caf50" />}
                  {f.acerto === false && <Ionicons name="close-circle"     size={26} color="#e53935" />}
                  {f.acerto === null  && <Ionicons name="time-outline"     size={26} color="#ff9800" />}
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardFecha}>
                    {new Date(f.fecha).toLocaleDateString('es-MX', {
                      weekday: 'short', day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                  <Text style={styles.cardPartido}>{f.local} vs {f.visitante}</Text>

                  <View style={styles.comparacion}>
                    <View style={styles.comparacionItem}>
                      <Text style={styles.comparacionLabel}>Mi pronóstico</Text>
                      <View style={[styles.badge, f.mi_prediccion ? styles.badgePred : styles.badgeVacio]}>
                        <Text style={[styles.badgeTexto, !f.mi_prediccion && { color: '#888' }]}>
                          {etiqueta(f.mi_prediccion, f.local, f.visitante)}
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="arrow-forward" size={16} color="#bbb" style={{ marginTop: 18 }} />

                    <View style={styles.comparacionItem}>
                      <Text style={styles.comparacionLabel}>Resultado real</Text>
                      <View style={[styles.badge, f.resultado_final ? styles.badgeReal : styles.badgePendiente]}>
                        <Text style={[styles.badgeTexto, !f.resultado_final && { color: '#e65100' }]}>
                          {f.resultado_final
                            ? etiqueta(f.resultado_final, f.local, f.visitante)
                            : 'Pendiente'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50 },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  resumen: { flexDirection: 'row', backgroundColor: '#1a1a2e', padding: 20, alignItems: 'center', justifyContent: 'space-around' },
  resumenItem: { alignItems: 'center' },
  resumenNum: { color: '#009ee3', fontSize: 28, fontWeight: 'bold' },
  resumenLabel: { color: '#aaa', fontSize: 11, marginTop: 2 },
  resumenDivider: { width: 1, height: 40, backgroundColor: '#333' },
  emptyBox: { margin: 20, padding: 20, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14 },
  card: { backgroundColor: '#fff', margin: 10, marginBottom: 6, borderRadius: 12, padding: 14, elevation: 2, flexDirection: 'row', alignItems: 'flex-start', borderLeftWidth: 4, borderLeftColor: '#ddd' },
  cardAcierto: { borderLeftColor: '#4caf50', backgroundColor: '#f9fff9' },
  cardFallo:   { borderLeftColor: '#e53935', backgroundColor: '#fff9f9' },
  iconoContainer: { marginRight: 12, marginTop: 4 },
  cardBody: { flex: 1 },
  cardFecha: { fontSize: 11, color: '#aaa', marginBottom: 3, textTransform: 'capitalize' },
  cardPartido: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 10 },
  comparacion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comparacionItem: { flex: 1, alignItems: 'center' },
  comparacionLabel: { fontSize: 10, color: '#999', marginBottom: 5, fontWeight: '600', textTransform: 'uppercase' },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  badgePred:      { backgroundColor: '#1a1a2e' },
  badgeReal:      { backgroundColor: '#009ee3' },
  badgeVacio:     { backgroundColor: '#eee' },
  badgePendiente: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ff9800' },
  badgeTexto: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
