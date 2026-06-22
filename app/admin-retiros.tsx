import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Modal,
  TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const C = {
  bg: '#0a0a15', card: '#131320', cardBorder: '#1c1c30',
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.1)',
  text: '#f0f0ff', textSub: '#7777aa', textMuted: '#44445a',
  green: '#00c897', greenDim: 'rgba(0,200,151,0.12)',
  orange: '#ff9f43', orangeDim: 'rgba(255,159,67,0.12)',
  red: '#ff6b6b', redDim: 'rgba(255,107,107,0.1)',
  gold: '#ffd700', goldDim: 'rgba(255,215,0,0.1)',
};

type SolicitudRetiro = {
  id: string;
  usuario_id: string;
  monto: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  nombre_titular: string;
  banco: string;
  clabe: string | null;
  numero_tarjeta: string | null;
  nota_admin: string | null;
  creado_en: string;
  resuelto_en: string | null;
  usuarios: { nombre: string; username: string } | null;
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const avisar = (titulo: string, mensaje: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${mensaje}`);
  else { const { Alert } = require('react-native'); Alert.alert(titulo, mensaje); }
};

export default function AdminRetirosScreen() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [retiros, setRetiros] = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<'pendiente' | 'aprobado' | 'rechazado'>('pendiente');

  // Modal resolver
  const [modalVisible, setModalVisible] = useState(false);
  const [retiroSel, setRetiroSel] = useState<SolicitudRetiro | null>(null);
  const [nota, setNota] = useState('');
  const [resolviendo, setResolviendo] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('solicitudes_retiro')
      .select('*, usuarios(nombre, username)')
      .order('creado_en', { ascending: false });
    setRetiros((data as any) || []);
  }, []);

  useEffect(() => {
    if (!usuario?.es_admin) { avisar('Acceso denegado', 'No tienes permisos.'); router.back(); return; }
    setLoading(true);
    cargar().finally(() => setLoading(false));
  }, [usuario]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  };

  const abrirResolver = (r: SolicitudRetiro) => {
    setRetiroSel(r);
    setNota('');
    setModalVisible(true);
  };

  const resolver = async (aprobar: boolean) => {
    if (!retiroSel) return;
    setResolviendo(true);
    const { error } = await supabase.rpc('resolver_retiro', {
      p_retiro_id: retiroSel.id,
      p_aprobar: aprobar,
      p_nota: nota.trim() || null,
    });
    setResolviendo(false);
    if (error) {
      avisar('Error', error.message);
    } else {
      setModalVisible(false);
      await cargar();
      avisar(
        aprobar ? '✅ Retiro aprobado' : '❌ Retiro rechazado',
        aprobar
          ? `Se aprobó el retiro de $${retiroSel.monto.toFixed(2)} para ${retiroSel.usuarios?.nombre}.`
          : `Se rechazó el retiro y se devolvió el saldo al usuario.`
      );
    }
  };

  const retirosFiltered = retiros.filter(r => r.estado === filtro);
  const pendientesCount = retiros.filter(r => r.estado === 'pendiente').length;

  const estadoColor = (e: string) => e === 'aprobado' ? C.green : e === 'rechazado' ? C.red : C.orange;
  const estadoLabel = (e: string) => e === 'aprobado' ? '✅ Aprobado' : e === 'rechazado' ? '❌ Rechazado' : '⏳ Pendiente';

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={C.accent} size="large" />
    </View>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitulo}>Solicitudes de Retiro</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* STATS */}
      <View style={s.statsRow}>
        <View style={[s.statChip, { borderColor: C.orange + '60', backgroundColor: C.orangeDim }]}>
          <Text style={[s.statVal, { color: C.orange }]}>{retiros.filter(r => r.estado === 'pendiente').length}</Text>
          <Text style={s.statLabel}>Pendientes</Text>
        </View>
        <View style={[s.statChip, { borderColor: C.green + '60', backgroundColor: C.greenDim }]}>
          <Text style={[s.statVal, { color: C.green }]}>{retiros.filter(r => r.estado === 'aprobado').length}</Text>
          <Text style={s.statLabel}>Aprobados</Text>
        </View>
        <View style={[s.statChip, { borderColor: C.red + '60', backgroundColor: C.redDim }]}>
          <Text style={[s.statVal, { color: C.red }]}>
            ${retiros.filter(r => r.estado === 'aprobado').reduce((sum, r) => sum + r.monto, 0).toFixed(0)}
          </Text>
          <Text style={s.statLabel}>Total pagado</Text>
        </View>
      </View>

      {/* FILTROS */}
      <View style={s.filtrosRow}>
        {(['pendiente', 'aprobado', 'rechazado'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filtroBtn, filtro === f && { borderColor: estadoColor(f), backgroundColor: estadoColor(f) + '18' }]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[s.filtroTexto, filtro === f && { color: estadoColor(f) }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'pendiente' && pendientesCount > 0 ? ` (${pendientesCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LISTA */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {retirosFiltered.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyTexto}>No hay solicitudes {filtro}s</Text>
          </View>
        ) : retirosFiltered.map(r => {
          const eColor = estadoColor(r.estado);
          return (
            <View key={r.id} style={[s.card, { borderColor: eColor + '30' }]}>
              {/* Header row */}
              <View style={s.cardHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardNombre}>{r.usuarios?.nombre || '—'}</Text>
                  <Text style={s.cardUsername}>@{r.usuarios?.username || ''}</Text>
                </View>
                <View>
                  <Text style={[s.cardMonto, { color: eColor }]}>${r.monto.toFixed(2)}</Text>
                  <View style={[s.estadoPill, { borderColor: eColor, backgroundColor: eColor + '18' }]}>
                    <Text style={[s.estadoTexto, { color: eColor }]}>{estadoLabel(r.estado)}</Text>
                  </View>
                </View>
              </View>

              {/* Datos bancarios */}
              <View style={s.datosBox}>
                <View style={s.datoRow}>
                  <Ionicons name="person-outline" size={13} color={C.textSub} />
                  <Text style={s.datoTexto}><Text style={s.datoLabel}>Titular: </Text>{r.nombre_titular}</Text>
                </View>
                <View style={s.datoRow}>
                  <Ionicons name="business-outline" size={13} color={C.textSub} />
                  <Text style={s.datoTexto}><Text style={s.datoLabel}>Banco: </Text>{r.banco}</Text>
                </View>
                {r.clabe && (
                  <View style={s.datoRow}>
                    <Ionicons name="card-outline" size={13} color={C.textSub} />
                    <Text style={s.datoTexto}><Text style={s.datoLabel}>CLABE: </Text>{r.clabe}</Text>
                  </View>
                )}
                {r.numero_tarjeta && (
                  <View style={s.datoRow}>
                    <Ionicons name="card-outline" size={13} color={C.textSub} />
                    <Text style={s.datoTexto}><Text style={s.datoLabel}>Tarjeta: </Text>****{r.numero_tarjeta.slice(-4)}</Text>
                  </View>
                )}
              </View>

              {r.nota_admin && (
                <Text style={s.notaAdmin}>💬 {r.nota_admin}</Text>
              )}

              <Text style={s.fecha}>{formatFecha(r.creado_en)}</Text>

              {/* Botones acción — solo en pendientes */}
              {r.estado === 'pendiente' && (
                <View style={s.accionesRow}>
                  <TouchableOpacity
                    style={[s.btnAccion, { borderColor: C.red, backgroundColor: C.redDim }]}
                    onPress={() => abrirResolver(r)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle" size={15} color={C.red} />
                    <Text style={[s.btnAccionTexto, { color: C.red }]}>Rechazar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btnAccion, { borderColor: C.green, backgroundColor: C.greenDim, flex: 2 }]}
                    onPress={() => abrirResolver(r)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={15} color={C.green} />
                    <Text style={[s.btnAccionTexto, { color: C.green }]}>Aprobar transferencia</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* MODAL RESOLVER */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Resolver solicitud</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>

            {retiroSel && (
              <>
                {/* Resumen */}
                <View style={[s.resumenBox, { borderColor: C.orange + '40', backgroundColor: C.orangeDim }]}>
                  <Text style={s.resumenNombre}>{retiroSel.usuarios?.nombre}</Text>
                  <Text style={[s.resumenMonto, { color: C.orange }]}>${retiroSel.monto.toFixed(2)}</Text>
                  <Text style={s.resumenBanco}>{retiroSel.banco} · {retiroSel.clabe ? `CLABE: ${retiroSel.clabe}` : `Tarjeta: ****${retiroSel.numero_tarjeta?.slice(-4)}`}</Text>
                  <Text style={s.resumenTitular}>Titular: {retiroSel.nombre_titular}</Text>
                </View>

                <Text style={s.modalLabel}>Nota para el usuario (opcional)</Text>
                <TextInput
                  style={s.modalInput}
                  value={nota}
                  onChangeText={setNota}
                  placeholder='Ej: "Transferencia enviada" o "Datos incorrectos"'
                  placeholderTextColor={C.textMuted}
                  multiline
                  numberOfLines={2}
                />

                <View style={s.modalBtnsRow}>
                  <TouchableOpacity
                    style={[s.modalBtn, { borderColor: C.red, backgroundColor: C.redDim }, resolviendo && { opacity: 0.5 }]}
                    onPress={() => resolver(false)}
                    disabled={resolviendo}
                    activeOpacity={0.8}
                  >
                    {resolviendo
                      ? <ActivityIndicator color={C.red} size="small" />
                      : <><Ionicons name="close-circle" size={16} color={C.red} /><Text style={[s.modalBtnTexto, { color: C.red }]}>Rechazar</Text></>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modalBtn, { borderColor: C.green, backgroundColor: C.greenDim, flex: 2 }, resolviendo && { opacity: 0.5 }]}
                    onPress={() => resolver(true)}
                    disabled={resolviendo}
                    activeOpacity={0.8}
                  >
                    {resolviendo
                      ? <ActivityIndicator color={C.green} size="small" />
                      : <><Ionicons name="checkmark-circle" size={16} color={C.green} /><Text style={[s.modalBtnTexto, { color: C.green }]}>Confirmar aprobación</Text></>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  headerBack:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitulo:   { fontSize: 17, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' },
  statsRow:       { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  statChip:       { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  statVal:        { fontSize: 18, fontWeight: '800' },
  statLabel:      { fontSize: 10, color: C.textSub, fontWeight: '600' },
  filtrosRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filtroBtn:      { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center' },
  filtroTexto:    { fontSize: 12, fontWeight: '700', color: C.textSub },
  empty:          { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji:     { fontSize: 36, marginBottom: 12 },
  emptyTexto:     { color: C.textSub, fontSize: 14 },
  card:           { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  cardHeaderRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardNombre:     { color: C.text, fontSize: 16, fontWeight: '800' },
  cardUsername:   { color: C.textSub, fontSize: 12, marginTop: 2 },
  cardMonto:      { fontSize: 22, fontWeight: '900', textAlign: 'right' },
  estadoPill:     { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4, alignSelf: 'flex-end' },
  estadoTexto:    { fontSize: 10, fontWeight: '800' },
  datosBox:       { backgroundColor: C.bg, borderRadius: 10, padding: 10, gap: 6, marginBottom: 10 },
  datoRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datoTexto:      { color: C.textSub, fontSize: 12, flex: 1 },
  datoLabel:      { color: C.text, fontWeight: '700' },
  notaAdmin:      { color: C.orange, fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  fecha:          { color: C.textMuted, fontSize: 11, marginBottom: 10 },
  accionesRow:    { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnAccion:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  btnAccionTexto: { fontWeight: '700', fontSize: 13 },
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: C.cardBorder },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo:    { fontSize: 17, fontWeight: '800', color: C.text },
  resumenBox:     { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16, alignItems: 'center', gap: 4 },
  resumenNombre:  { color: C.text, fontSize: 16, fontWeight: '800' },
  resumenMonto:   { fontSize: 28, fontWeight: '900' },
  resumenBanco:   { color: C.textSub, fontSize: 12, marginTop: 4 },
  resumenTitular: { color: C.textSub, fontSize: 12 },
  modalLabel:     { fontSize: 12, color: C.textSub, fontWeight: '600', marginBottom: 8 },
  modalInput:     { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 10, padding: 12, color: C.text, fontSize: 14, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' },
  modalBtnsRow:   { flexDirection: 'row', gap: 10 },
  modalBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  modalBtnTexto:  { fontWeight: '800', fontSize: 14 },
});
