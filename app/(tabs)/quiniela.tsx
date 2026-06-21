import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';

// Datos de ejemplo — se reemplazarán con datos reales de Supabase
const PARTIDOS_EJEMPLO = [
  { id: 1, local: 'América', visitante: 'Chivas', fecha: 'Sáb 22 Jun' },
  { id: 2, local: 'Cruz Azul', visitante: 'Pumas', fecha: 'Sáb 22 Jun' },
  { id: 3, local: 'Tigres', visitante: 'Monterrey', fecha: 'Dom 23 Jun' },
  { id: 4, local: 'Atlas', visitante: 'Santos', fecha: 'Dom 23 Jun' },
  { id: 5, local: 'Toluca', visitante: 'León', fecha: 'Dom 23 Jun' },
];

type Resultado = '1' | 'X' | '2' | null;

export default function QuinielaScreen() {
  const [predicciones, setPredicciones] = useState<Record<number, Resultado>>({});

  const seleccionar = (partidoId: number, resultado: Resultado) => {
    setPredicciones((prev) => ({ ...prev, [partidoId]: resultado }));
  };

  const guardarQuiniela = () => {
    const completa = PARTIDOS_EJEMPLO.every((p) => predicciones[p.id]);
    if (!completa) {
      Alert.alert('Incompleto', 'Debes seleccionar un resultado para cada partido.');
      return;
    }
    // TODO: enviar a Supabase
    Alert.alert('¡Quiniela guardada!', 'Tus pronósticos han sido registrados.');
  };

  const totalSeleccionados = Object.keys(predicciones).length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚽ Jornada Actual</Text>
        <Text style={styles.headerSub}>
          {totalSeleccionados}/{PARTIDOS_EJEMPLO.length} seleccionados
        </Text>
      </View>

      {PARTIDOS_EJEMPLO.map((partido) => (
        <View key={partido.id} style={styles.card}>
          <Text style={styles.fecha}>{partido.fecha}</Text>
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
                ]}
                onPress={() => seleccionar(partido.id, op)}
              >
                <Text
                  style={[
                    styles.opcionTexto,
                    predicciones[partido.id] === op && styles.opcionTextoActivo,
                  ]}
                >
                  {op === '1' ? `1 ${partido.local}` : op === 'X' ? 'X Empate' : `2 ${partido.visitante}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.btnGuardar} onPress={guardarQuiniela}>
        <Text style={styles.btnGuardarTexto}>💾 Guardar Quiniela</Text>
      </TouchableOpacity>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#009ee3', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 12,
    padding: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  fecha: { fontSize: 12, color: '#888', marginBottom: 8, textAlign: 'center' },
  equipos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  equipo: { fontSize: 16, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  vs: { fontSize: 12, color: '#aaa', marginHorizontal: 5 },
  opciones: { flexDirection: 'row', gap: 8 },
  opcionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  opcionSeleccionada: {
    backgroundColor: '#009ee3',
    borderColor: '#009ee3',
  },
  opcionTexto: { fontSize: 11, color: '#555', textAlign: 'center', fontWeight: '600' },
  opcionTextoActivo: { color: '#fff' },
  btnGuardar: {
    backgroundColor: '#1a1a2e',
    margin: 15,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGuardarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
