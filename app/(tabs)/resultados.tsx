import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

type Posicion = {
  usuario_id: string;
  username: string;
  aciertos: number;
  total_partidos: number;
};

type Partido = {
  id: string;
  local: string;
  visitante: string;
  resultado_final: string | null;
  jornada: number;
};

export default function ResultadosScreen() {
  const { user } = useAuth();
  const [posiciones, setPosiciones] = useState<Posicion[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jornada, setJornada] = useState<number>(1);
  const [jornadas, setJornadas] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [miPosicion, setMiPosicion] = useState<number | null>(null);

  const cargar = useCallback(async (j?: number) => {
    setLoading(true);

    const { data: jornadasData } = await supabase
      .from('partidos')
      .select('jornada')
      .order('jornada');
    const unicas = [...new Set((jornadasData || []).map((p: any) => p.jornada))] as number[];
    setJornadas(unicas);
    const jornadaActual = j ?? (unicas[unicas.length - 1] || 1);
    setJornada(jornadaActual);

    const { data: partidosData } = await supabase
      .from('partidos')
      .select('id, local, visitante, resultado_final, jornada')
      .eq('jornada', jornadaActual)
      .order('fecha');
    setPartidos(partidosData || []);

    // Tabla de posiciones — quinielas pagadas con username
    const { data: quinielasData } = await supabase
      .from('quinielas')
      .select('usuario_id, aciertos, usuarios(username, nombre)')
      .eq('jornada', jornadaActual)
      .eq('estado_pago', 'pagado')
      .order('aciertos', { ascending: false });

    const tabla: Posicion[] = (quinielasData || []).map((q: any) => ({
      usuario_id: q.usuario_id,
      // Mostrar username si existe, si no nombre, si no 'Jugador'
      username: q.usuarios?.username
        ? `@${q.usuarios.username}`
        : (q.usuarios?.nombre || 'Jugador'),
      aciertos: q.aciertos || 0,
      total_partidos: partidosData?.length || 0,
    }));
    setPosiciones(tabla);

    if (user) {
      const pos = tabla.findIndex(p => p.usuario_id === user.id);
      setMiPosicion(pos >= 0 ? pos + 1 : null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { cargar(); }, [cargar]);

  const medalla = (lugar: number) => {
    if (lugar === 1) return '🥇';
    if (lugar === 2) return '🥈';
    if (lugar === 3) return '🥉';
    return `${lugar}`;
  };

  const hayResultados = partidos.some(p => p.resultado_final);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(jornada); }} colors={['#009ee3']} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Tabla de Posiciones</Text>
        {miPosicion && <Text style={styles.miPosicion}>Tu posición: #{miPosicion}</Text>}
      </View>

      {jornadas.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jornadasScroll}>
          {jornadas.map(j => (
            <TouchableOpacity key={j} style={[styles.jornadaBtn, jornada === j && styles.jornadaBtnActivo]} onPress={() => cargar(j)}>
              <Text style={[styles.jornadaBtnTexto, jornada === j && styles.jornadaBtnTextoActivo]}>J{j}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {partidos.length > 0 && (
        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>⚽ Resultados Jornada {jornada}</Text>
          {partidos.map(p => (
            <View key={p.id} style={styles.partidoRow}>
              <Text style={styles.partidoEquipo}>{p.local}</Text>
              <View style={[styles.resultadoBadge, p.resultado_final ? styles.resultadoReal : styles.resultadoPendiente]}>
                <Text style={[styles.resultadoTexto, !p.resultado_final && { color: '#888' }]}>
                  {p.resultado_final === '1' ? `1 · ${p.local.slice(0,4)}` :
                   p.resultado_final === 'X' ? 'X · Empate' :
                   p.resultado_final === '2' ? `2 · ${p.visitante.slice(0,4)}` :
                   'Pendiente'}
                </Text>
              </View>
              <Text style={styles.partidoEquipo}>{p.visitante}</Text>
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#009ee3" style={{ margin: 30 }} />
      ) : !hayResultados ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>⏰</Text>
          <Text style={styles.emptyTitulo}>Resultados pendientes</Text>
          <Text style={styles.emptyTexto}>La tabla se actualizará cuando el administrador capture los resultados.</Text>
        </View>
      ) : posiciones.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTexto}>No hay participantes con pago confirmado aún.</Text>
        </View>
      ) : (
        <View style={styles.tabla}>
          <View style={styles.tablaHeader}>
            <Text style={[styles.col, styles.colLugar]}>#</Text>
            <Text style={[styles.col, styles.colNombre]}>Jugador</Text>
            <Text style={[styles.col, styles.colAciertos]}>Aciertos</Text>
          </View>
          {posiciones.map((p, i) => (
            <View key={p.usuario_id} style={[
              styles.tablaRow,
              i === 0 && styles.rowOro,
              i === 1 && styles.rowPlata,
              i === 2 && styles.rowBronce,
              p.usuario_id === user?.id && styles.rowMio,
            ]}>
              <Text style={[styles.col, styles.colLugar, styles.colLugarTexto]}>{medalla(i + 1)}</Text>
              <Text style={[styles.col, styles.colNombre, p.usuario_id === user?.id && styles.textoMio]}>
                {p.username}{p.usuario_id === user?.id ? ' (tú)' : ''}
              </Text>
              <Text style={[styles.col, styles.colAciertos, i === 0 && styles.textoOro]}>
                {p.aciertos}/{p.total_partidos}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  miPosicion: { color: '#ffc107', fontSize: 14, marginTop: 6, fontWeight: '600' },
  jornadasScroll: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 8 },
  jornadaBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginHorizontal: 4, borderWidth: 1.5, borderColor: '#ddd' },
  jornadaBtnActivo: { backgroundColor: '#009ee3', borderColor: '#009ee3' },
  jornadaBtnTexto: { color: '#888', fontWeight: '600' },
  jornadaBtnTextoActivo: { color: '#fff' },
  seccion: { backgroundColor: '#fff', margin: 10, borderRadius: 12, padding: 14, elevation: 2 },
  seccionTitulo: { fontWeight: 'bold', color: '#1a1a2e', fontSize: 14, marginBottom: 10 },
  partidoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  partidoEquipo: { flex: 1, fontSize: 12, color: '#333', fontWeight: '600', textAlign: 'center' },
  resultadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginHorizontal: 6 },
  resultadoReal: { backgroundColor: '#1a1a2e' },
  resultadoPendiente: { backgroundColor: '#eee' },
  resultadoTexto: { fontSize: 11, fontWeight: 'bold', color: '#fff' },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyEmoji: { fontSize: 50, marginBottom: 10 },
  emptyTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 6 },
  emptyTexto: { color: '#888', fontSize: 13, textAlign: 'center' },
  tabla: { margin: 10 },
  tablaHeader: { flexDirection: 'row', backgroundColor: '#009ee3', padding: 12, borderRadius: 8, marginBottom: 4 },
  tablaRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 4, elevation: 1 },
  rowOro: { backgroundColor: '#fff8e1', borderWidth: 1.5, borderColor: '#ffc107' },
  rowPlata: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#bdbdbd' },
  rowBronce: { backgroundColor: '#fbe9e7', borderWidth: 1, borderColor: '#ff8a65' },
  rowMio: { borderWidth: 2, borderColor: '#009ee3' },
  col: { fontSize: 14, color: '#333' },
  colLugar: { width: 40, textAlign: 'center' },
  colLugarTexto: { fontWeight: 'bold', fontSize: 16 },
  colNombre: { flex: 1 },
  colAciertos: { width: 65, textAlign: 'center', fontWeight: 'bold' },
  textoOro: { color: '#b8860b' },
  textoMio: { color: '#009ee3', fontWeight: 'bold' },
});
