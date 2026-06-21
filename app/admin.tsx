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
  resultado_final: string | null;
};

type Quiniela = {
  id: string;
  jornada: number;
  estado_pago: string;
  usuario_id: string;
  usuarios: { nombre: string } | null;
};

export default function AdminScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'partidos' | 'quinielas'>('partidos');
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [quinielas, setQuinielas] = useState<Quiniela[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalPartido, setModalPartido] = useState(false);
  const [modalResultado, setModalResultado] = useState(false);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<Partido | null>(null);
  const [resultadoInput, setResultadoInput] = useState<'1' | 'X' | '2' | null>(null);
  const [saving, setSaving] = useState(false);

  const [local, setLocal] = useState('');
  const [visitante, setVisitante] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [jornada, setJornada] = useState('1');

  useEffect(() => {
    if (!usuario?.es_admin) {
      Alert.alert('Acceso denegado', 'No tienes permisos.');
      router.back();
      return;
    }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data: p, error: ep }, { data: q, error: eq }] = await Promise.all([
      supabase.from('partidos').select('*').order('jornada').order('fecha'),
      supabase
        .from('quinielas')
        .select('id, jornada, estado_pago, usuario_id, usuarios(nombre)')
        .order('jornada', { ascending: false }),
    ]);
    if (ep) console.error('Error partidos:', ep.message);
    if (eq) console.error('Error quinielas:', eq.message);
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
    const { error } = await supabase.from('partidos').insert({
      local: local.trim(), visitante: visitante.trim(),
      fecha: `${fecha}T${hora}:00-06:00`,
      jornada: parseInt(jornada), cerrado: false,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setModalPartido(false);
    setLocal(''); setVisitante(''); setFecha(''); setHora('');
    cargarDatos();
  };

  const abrirModalResultado = (partido: Partido) => {
    setPartidoSeleccionado(partido);
    setResultadoInput(partido.resultado_final as any || null);
    setModalResultado(true);
  };

  const guardarResultado = async () => {
    if (!resultadoInput || !partidoSeleccionado) return;
    setSaving(true);

    const { error } = await supabase
      .from('partidos')
      .update({ resultado_final: resultadoInput, cerrado: true })
      .eq('id', partidoSeleccionado.id);

    if (error) {
      Alert.alert('Error guardando partido', error.message);
      setSaving(false);
      return;
    }

    await recalcularAciertos(partidoSeleccionado.jornada);

    setSaving(false);
    setModalResultado(false);
    cargarDatos();
    Alert.alert('\u2705 Listo', 'Resultado guardado y aciertos recalculados.');
  };

  const recalcularAciertos = async (jornadaNum: number) => {
    // 1. Partidos con resultado de la jornada
    const { data: partidosJornada, error: e1 } = await supabase
      .from('partidos')
      .select('id, resultado_final')
      .eq('jornada', jornadaNum)
      .not('resultado_final', 'is', null);

    if (e1) { console.error('Error partidos jornada:', e1.message); return; }
    if (!partidosJornada || partidosJornada.length === 0) return;

    const idsPartidos = partidosJornada.map(p => p.id);

    // 2. Quinielas de la jornada
    const { data: quinielasJornada, error: e2 } = await supabase
      .from('quinielas')
      .select('id, usuario_id')
      .eq('jornada', jornadaNum);

    if (e2) { console.error('Error quinielas jornada:', e2.message); return; }
    if (!quinielasJornada || quinielasJornada.length === 0) return;

    // 3. Calcular aciertos por quiniela
    for (const q of quinielasJornada) {
      const { data: preds, error: e3 } = await supabase
        .from('predicciones')
        .select('partido_id, resultado')
        .eq('usuario_id', q.usuario_id)
        .in('partido_id', idsPartidos);

      if (e3) { console.error('Error predicciones:', e3.message); continue; }

      let aciertos = 0;
      for (const pred of (preds || [])) {
        const partido = partidosJornada.find(p => p.id === pred.partido_id);
        if (partido?.resultado_final === pred.resultado) aciertos++;
      }

      const { error: e4 } = await supabase
        .from('quinielas')
        .update({ aciertos })
        .eq('id', q.id);

      if (e4) console.error('Error update aciertos:', e4.message);
    }
  };

  const toggleCerrar = async (partido: Partido) => {
    await supabase.from('partidos').update({ cerrado: !partido.cerrado }).eq('id', partido.id);
    cargarDatos();
  };

  const eliminarPartido = (id: string) => {
    Alert.alert('Eliminar', '¿Eliminar este partido?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await supabase.from('partidos').delete().eq('id', id); cargarDatos(); } }
    ]);
  };

  const marcarPagado = async (quinielaId: string) => {
    const { error } = await supabase
      .from('quinielas')
      .update({ estado_pago: 'pagado' })
      .eq('id', quinielaId);
    if (error) Alert.alert('Error', error.message);
    else cargarDatos();
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#009ee3" />;

  const jornadaActual = partidos.find(p => !p.cerrado)?.jornada ?? '-';
  const pagados = quinielas.filter(q => q.estado_pago === 'pagado').length;
  const pendientes = quinielas.filter(q => q.estado_pago === 'pendiente').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🛡️ Panel Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{jornadaActual}</Text><Text style={styles.statLabel}>Jornada activa</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum, { color: '#4caf50' }]}>{pagados}</Text><Text style={styles.statLabel}>Pagados</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum, { color: '#ff9800' }]}>{pendientes}</Text><Text style={styles.statLabel}>Pendientes</Text></View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'partidos' && styles.tabActivo]} onPress={() => setTab('partidos')}>
          <Text style={[styles.tabTexto, tab === 'partidos' && styles.tabTextoActivo]}>⚽ Partidos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'quinielas' && styles.tabActivo]} onPress={() => setTab('quinielas')}>
          <Text style={[styles.tabTexto, tab === 'quinielas' && styles.tabTextoActivo]}>📋 Quinielas ({quinielas.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {tab === 'partidos' ? (
          <>
            <TouchableOpacity style={styles.btnAgregar} onPress={() => setModalPartido(true)}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.btnAgregarTexto}>Agregar partido</Text>
            </TouchableOpacity>
            {partidos.map((p) => (
              <View key={p.id} style={styles.card}>
                <Text style={styles.cardJornada}>Jornada {p.jornada}</Text>
                <Text style={styles.cardPartido}>{p.local} vs {p.visitante}</Text>
                <Text style={styles.cardFecha}>
                  {new Date(p.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
                {p.resultado_final && (
                  <View style={styles.resultadoTag}>
                    <Text style={styles.resultadoTagTexto}>
                      Resultado: {p.resultado_final === '1' ? `1 - ${p.local}` : p.resultado_final === 'X' ? 'X - Empate' : `2 - ${p.visitante}`}
                    </Text>
                  </View>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => abrirModalResultado(p)} style={[styles.actionBtn, { backgroundColor: '#1a1a2e' }]}>
                    <Text style={styles.actionBtnTexto}>{p.resultado_final ? '✏️ Editar resultado' : '🎯 Capturar resultado'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleCerrar(p)} style={[styles.actionBtn, p.cerrado ? styles.btnAbrir : styles.btnCerrarPartido]}>
                    <Text style={styles.actionBtnTexto}>{p.cerrado ? 'Abrir' : 'Cerrar'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => eliminarPartido(p.id)} style={[styles.actionBtn, styles.btnEliminar]}>
                    <Ionicons name="trash" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          quinielas.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No hay quinielas registradas aún.</Text>
            </View>
          ) : (
            quinielas.map((q) => (
              <View key={q.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardPartido}>{(q.usuarios as any)?.nombre || 'Usuario'}</Text>
                    <Text style={styles.cardJornada}>Jornada {q.jornada}</Text>
                  </View>
                  {q.estado_pago === 'pagado' ? (
                    <View style={[styles.actionBtn, { backgroundColor: '#4caf50' }]}>
                      <Text style={styles.actionBtnTexto}>✅ Pagado</Text>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => marcarPagado(q.id)} style={[styles.actionBtn, { backgroundColor: '#009ee3' }]}>
                      <Text style={styles.actionBtnTexto}>Marcar pagado</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal nuevo partido */}
      <Modal visible={modalPartido} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Nuevo partido</Text>
            <Text style={styles.label}>Equipo local</Text>
            <TextInput style={styles.input} value={local} onChangeText={setLocal} placeholder="América" placeholderTextColor="#bbb" />
            <Text style={styles.label}>Equipo visitante</Text>
            <TextInput style={styles.input} value={visitante} onChangeText={setVisitante} placeholder="Chivas" placeholderTextColor="#bbb" />
            <Text style={styles.label}>Fecha (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={fecha} onChangeText={setFecha} placeholder="2026-07-05" placeholderTextColor="#bbb" />
            <Text style={styles.label}>Hora (HH:MM)</Text>
            <TextInput style={styles.input} value={hora} onChangeText={setHora} placeholder="20:00" placeholderTextColor="#bbb" />
            <Text style={styles.label}>Jornada</Text>
            <TextInput style={styles.input} value={jornada} onChangeText={setJornada} keyboardType="number-pad" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalPartido(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnGuardar, saving && { opacity: 0.6 }]} onPress={agregarPartido} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnGuardarTexto}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal capturar resultado */}
      <Modal visible={modalResultado} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Resultado del partido</Text>
            <Text style={styles.modalSubtitulo}>{partidoSeleccionado?.local} vs {partidoSeleccionado?.visitante}</Text>
            <Text style={styles.label}>Selecciona el resultado:</Text>
            <View style={styles.resultadoOpciones}>
              {(['1', 'X', '2'] as const).map(op => (
                <TouchableOpacity
                  key={op}
                  style={[styles.resultadoOpcion, resultadoInput === op && styles.resultadoOpcionActiva]}
                  onPress={() => setResultadoInput(op)}
                >
                  <Text style={[styles.resultadoOpcionTexto, resultadoInput === op && styles.resultadoOpcionTextoActivo]}>
                    {op === '1' ? `1\n${partidoSeleccionado?.local}` : op === 'X' ? 'X\nEmpate' : `2\n${partidoSeleccionado?.visitante}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.infoAciertos}>⚡ Al guardar se recalculan los aciertos automáticamente</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancelar} onPress={() => setModalResultado(false)}><Text style={styles.btnCancelarTexto}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.btnGuardar, (!resultadoInput || saving) && { opacity: 0.6 }]} onPress={guardarResultado} disabled={!resultadoInput || saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnGuardarTexto}>Guardar y calcular</Text>}
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
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardJornada: { fontSize: 11, color: '#009ee3', fontWeight: '600', marginBottom: 2 },
  cardPartido: { fontSize: 15, fontWeight: 'bold', color: '#1a1a2e' },
  cardFecha: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 8 },
  resultadoTag: { backgroundColor: '#e8f5e9', padding: 6, borderRadius: 6, marginBottom: 8 },
  resultadoTagTexto: { color: '#2e7d32', fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  actionBtnTexto: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnCerrarPartido: { backgroundColor: '#ff9800' },
  btnAbrir: { backgroundColor: '#4caf50' },
  btnEliminar: { backgroundColor: '#e53935' },
  emptyBox: { margin: 20, padding: 20, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', marginBottom: 4 },
  modalSubtitulo: { fontSize: 13, color: '#888', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 11, marginBottom: 12, fontSize: 14, color: '#333' },
  resultadoOpciones: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  resultadoOpcion: { flex: 1, borderWidth: 2, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  resultadoOpcionActiva: { backgroundColor: '#1a1a2e', borderColor: '#1a1a2e' },
  resultadoOpcionTexto: { fontSize: 13, color: '#555', textAlign: 'center', fontWeight: '600' },
  resultadoOpcionTextoActivo: { color: '#fff' },
  infoAciertos: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  btnCancelar: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center' },
  btnCancelarTexto: { color: '#888', fontWeight: '600' },
  btnGuardar: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#009ee3', alignItems: 'center' },
  btnGuardarTexto: { color: '#fff', fontWeight: 'bold' },
});
