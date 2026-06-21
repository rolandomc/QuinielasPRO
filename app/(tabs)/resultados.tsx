import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';

// Datos de ejemplo — se reemplazarán con datos reales de Supabase
const POSICIONES_EJEMPLO = [
  { lugar: 1, nombre: 'Rolando M.', aciertos: 4, premio: '$500' },
  { lugar: 2, nombre: 'Carlos R.', aciertos: 3, premio: '-' },
  { lugar: 3, nombre: 'Ana G.', aciertos: 3, premio: '-' },
  { lugar: 4, nombre: 'Luis T.', aciertos: 2, premio: '-' },
  { lugar: 5, nombre: 'María S.', aciertos: 1, premio: '-' },
];

export default function ResultadosScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 Tabla de Posiciones</Text>
        <Text style={styles.headerSub}>Jornada actual</Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.col, styles.colLugar]}>#</Text>
        <Text style={[styles.col, styles.colNombre]}>Jugador</Text>
        <Text style={[styles.col, styles.colAciertos]}>Aciertos</Text>
        <Text style={[styles.col, styles.colPremio]}>Premio</Text>
      </View>

      {POSICIONES_EJEMPLO.map((jugador) => (
        <View
          key={jugador.lugar}
          style={[styles.row, jugador.lugar === 1 && styles.rowGanador]}
        >
          <Text style={[styles.col, styles.colLugar, jugador.lugar === 1 && styles.textoGanador]}>
            {jugador.lugar === 1 ? '🥇' : jugador.lugar === 2 ? '🥈' : jugador.lugar === 3 ? '🥉' : jugador.lugar}
          </Text>
          <Text style={[styles.col, styles.colNombre, jugador.lugar === 1 && styles.textoGanador]}>
            {jugador.nombre}
          </Text>
          <Text style={[styles.col, styles.colAciertos, jugador.lugar === 1 && styles.textoGanador]}>
            {jugador.aciertos}/5
          </Text>
          <Text style={[styles.col, styles.colPremio, jugador.lugar === 1 && styles.premioTexto]}>
            {jugador.premio}
          </Text>
        </View>
      ))}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>ℹ️ Resultados de partidos</Text>
        <Text style={styles.infoText}>Los resultados se actualizan al finalizar cada partido.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#009ee3', fontSize: 14, marginTop: 4 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#009ee3',
    padding: 12,
    marginTop: 10,
    marginHorizontal: 10,
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    marginHorizontal: 10,
    marginTop: 4,
    borderRadius: 8,
    elevation: 1,
  },
  rowGanador: { backgroundColor: '#fff8e1', borderWidth: 1.5, borderColor: '#ffc107' },
  col: { fontSize: 14, color: '#333' },
  colLugar: { width: 40, textAlign: 'center', fontWeight: 'bold' },
  colNombre: { flex: 1 },
  colAciertos: { width: 70, textAlign: 'center' },
  colPremio: { width: 70, textAlign: 'right', color: '#888' },
  textoGanador: { color: '#b8860b', fontWeight: 'bold' },
  premioTexto: { color: '#2e7d32', fontWeight: 'bold' },
  infoBox: {
    backgroundColor: '#e3f2fd',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#009ee3',
  },
  infoTitle: { fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  infoText: { color: '#555', fontSize: 13 },
});
