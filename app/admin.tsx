import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Partido = {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
  jornada: number;
  cerrado: boolean;
};

type Quiniela = {
  id: string;
  jornada: number;
  estado_pago: string;
  usuarios: { nombre: string; } | null;
};

export default function AdminScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'partidos' | 'quinielas'>('partidos');
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Formulario nuevo partido
  const [local, setLocal] = useState('');
  const [visitante, setVisitante] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [jornada, setJornada] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!usuario?.es_admin) {
      Alert.alert('Acceso denegado', 'No tienes permisos de administrador.');
      router.back();
      return;
    }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: p }, { data: q }] = await Promise.all([
      supabase.from('partidos').select('*').order('jornada').order('fecha'),
      supabase.from('quinielas').select('id, jornada, estado_pago, usuarios(nombre)').order('jornada', { ascending: false }),
    ]);
    if (p) setPartidos(p);
    if (q) setQuinielas(q as any);
    setLoading(false);
  };

  const agregarPartido = async () => {
    if (!local || !visitante || !fecha || !hora || !jornada) {
      Alert.alert('Campos incompletos', 'Llena todos los campos.');
      return;
    }
    setSaving(true);
    const fechaISO = `${fecha}T${hora}:00-06:00`;
    const { error } = await supabase.from('partidos').insert({
      local: local.trim(),
      visitante: visitante.trim(),
      fecha: fechaISO,
      jornada: parseInt(jornada),
      cerrado: false,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      setLocal(''); setVisitante(''); setFecha(''); setHora('');
      cargarDatos();
    }
  };

  const toggleCerrar = async (partido: Partido) => {
    const { error } = await supabase
      .from('partidos')
      .update({ cerrado: !partido.cerrado })
      .eq('id', partido.id);
    if (!error) cargarDatos();
  };

  const eliminarPartido = async (id: string) => {
    Alert.alert('Eliminar', '¿Seguro que quieres eliminar este partido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('partidos').delete().eq('id', id);
          cargarDatos();
        }
      }
    ]);
  };

  const marcarPagado = async (quinielaId: string) => {
    await supabase.from('quinielas').update({ estado_pago: 'pagado' }).eq('id', quinielaId);
    cargarDatos();
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#009ee3" />;

  const jornadaActual = partidos.find(p => !p.cerrado)?.jornada ?? '-';
  const pagados = quinielas.filter(q => q.estado_pago === 'pagado').length;
  const pendientes = quinielas.filter(q => q.estado_pago === 'pendiente').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Panel Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{jornadaActual}</Text>
          <Text style={styles.statLabel}>Jornada activa</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: '#4caf50' }]}>{pagados}</Text>
          <Text style={styles.statLabel}>Pagados</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: '#ff9800' }]}>{pendientes}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'partidos' && styles.tabActivo]} onPress={() => setTab('partidos')}>
          <Text style={[styles.tabTexto, tab === 'partidos' && styles.tabTextoActivo]}>⚽ Partidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'quinielas' && styles.tabActivo]} onPress={() => setTab('quinielas')}>
          <Text style={[styles.tabTexto, tab === 'quinielas' && styles.tabTextoActivo]}>📋 Quinielas</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {tab === 'partidos' ? (
          <>
            <TouchableOpacity style={styles.btnAgregar} onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.btnAgregarTexto}>Agregar partido</Text>
            </TouchableOpacity>

            {partidos.length === 0 ? (
              <Text style={styles.empty}>No hay partidos cargados.</Text>
            ) : (
              partidos.map((p) => (
                <View key={p.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardJornada}>Jornada {p.jornada}</Text>
                      <Text style={styles.cardPartido}>{p.local} vs {p.visitante}</Text>
                      <Text style={styles.cardFecha}>
                        {new Date(p.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => toggleCerrar(p)} style={[styles.actionBtn, p.cerrado ? styles.btnAbrir : styles.btnCerrar]}>
                        <Text style={styles.actionBtnTexto}>{p.cerrado ? 'Abrir' : 'Cerrar'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => eliminarPartido(p.id)} style={[styles.actionBtn, styles.btnEliminar]}>
                        <Ionicons name="trash" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {quinielas.length === 0 ? (
              <Text style={styles.empty}>No hay quinielas registradas.</Text>
            ) : (
              quinielas.map((q) => (
                <View key={q.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardPartido}>{(q.usuarios as any)?.nombre || 'Usuario'}</Text>
                      <Text style={styles.cardJornada}>Jornada {q.jornada}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      {q.estado_pago === 'pagado' ? (
                        <View style={[styles.actionBtn, styles.btnPagado]}>
                          <Text style={styles.actionBtnTexto}>✅ Pagado</Text>
                        </View>
                      ) : (
                        <TouchableOpacity onPress={() => marcarPagado(q.id)} style={[styles.actionBtn, styles.btnMarcarPagado]}>
                          <Text style={styles.actionBtnTexto}>Marcar pagado</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal agregar partido */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Nuevo partido</Text>

            <Text style={styles.label}>Equipo local</Text>
            <TextInput style={styles.input} value={local} onChangeText={setLocal} placeholder="Ej. América" placeholderTextColor="#bbb" />

            <Text style={styles.label}>Equipo visitante</Text>
            <TextInput style={styles.input} value={visitante} onChangeText={setVisitante} placeholder="Ej. Chivas" placeholderTextColor="#bbb" />

            <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="2026-07-05" placeholderTextColor="#bbb" keyboardType="numbers-and-punctuation" />

            <Text style={styles.label}>Hora (HH:MM)</Text>
            <TextInput style={styles.input} value={hora} onChangeText={setHora} placeholder="20:00" placeholderTextColor="#bbb" keyboardType="numbers-and-punctuation" />

            <Text style={styles.label}>Jornada</Text>
            <TextInput style={styles.input} value={jornada} onChangeText={setJornada} keyboardType="number-pad" />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnGuardar, saving && { opacity: 0.6 }]} onPress={agregarPartido} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnGuardarTexto}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { backgroundColor: '#1a1a2e', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50 },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', backgroundColor: '#1a1a2e', paddingBottom: 16, paddingHorizontal: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { color: '#009ee3', fontSize: 28, fontWeight: 'bold' },
  statLabel: { color: '#aaa', fontSize: 11, marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tabBtn: { flex: 1, padding: 14, alignItems: 'center' },
  tabActivo: { borderBottomWidth: 3, borderBottomColor: '#009ee3' },
  tabTexto: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabTextoActivo: { color: '#009ee3' },
  btnAgregar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#009ee3', margin: 12, padding: 14, borderRadius: 10, justifyContent: 'center' },
  btnAgregarTexto: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardJornada: { fontSize: 11, color: '#009ee3', fontWeight: '600', marginBottom: 2 },
  cardPartido: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  cardFecha: { fontSize: 11, color: '#888', marginTop: 2 },
  cardActions: { gap: 6 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  actionBtnTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnCerrar: { backgroundColor: '#ff9800' },
  btnAbrir: { backgroundColor: '#4caf50' },
  btnEliminar: { backgroundColor: '#e53935' },
  btnPagado: { backgroundColor: '#4caf50' },
  btnMarcarPagado: { backgroundColor: '#009ee3' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 11, marginBottom: 12, fontSize: 14, color: '#333' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center' },
  btnCancelarTexto: { color: '#888', fontWeight: '600' },
  btnGuardar: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#009ee3', alignItems: 'center' },
  btnGuardarTexto: { color: '#fff', fontWeight: 'bold' },
});
