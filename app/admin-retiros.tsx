/**
 * app/admin-retiros.tsx
 * Panel admin — gestión de solicitudes de retiro.
 * Lógica de datos en lib/retiros.ts | Tarjeta en components/AdminRetiroCard.tsx
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Modal,
  TextInput, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import {
  fetchRetiros,
  resolverRetiro,
  estadoColor,
  type SolicitudRetiro,
  type EstadoRetiro,
} from '../lib/retiros';
import AdminRetiroCard from '../components/AdminRetiroCard';

const C = {
  bg: '#0a0a15', card: '#131320', cardBorder: '#1c1c30',
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.1)',
  text: '#f0f0ff', textSub: '#7777aa', textMuted: '#44445a',
  green: '#00c897', greenDim: 'rgba(0,200,151,0.12)',
  orange: '#ff9f43', orangeDim: 'rgba(255,159,67,0.12)',
  red: '#ff6b6b', redDim: 'rgba(255,107,107,0.1)',
};

const COLORS = { green: C.green, red: C.red, orange: C.orange };

const avisar = (titulo: string, mensaje: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${mensaje}`);
  else { const { Alert } = require('react-native'); Alert.alert(titulo, mensaje); }
};

export default function AdminRetirosScreen() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [retiros,    setRetiros]    = useState<SolicitudRetiro[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro,     setFiltro]     = useState<EstadoRetiro>('pendiente');
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  // Modal resolver
  const [modalVisible, setModalVisible] = useState(false);
  const [retiroSel,    setRetiroSel]    = useState<SolicitudRetiro | null>(null);
  const [nota,         setNota]         = useState('');
  const [resolviendo,  setResolviendo]  = useState(false);

  const cargar = useCallback(async () => {
    setErrorMsg(null);
    try {
      const data = await fetchRetiros();
      console.log('[admin-retiros] registros cargados:', data.length);
      setRetiros(data);
    } catch (e: any) {
      const msg = e.message ?? 'No se pudieron cargar los retiros.';
      console.error('[admin-retiros] Error al cargar:', msg);
      setErrorMsg(msg);
      avisar('Error al cargar retiros', msg);
    }
  }, []);

  useEffect(() => {
    if (!usuario?.es_admin) {
      avisar('Acceso denegado', 'No tienes permisos.');
      router.back();
      return;
    }
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
    try {
      await resolverRetiro(retiroSel.id, aprobar, nota.trim() || null);
      setModalVisible(false);
      await cargar();
      avisar(
        aprobar ? '✅ Retiro aprobado' : '❌ Retiro rechazado',
        aprobar
          ? `Se aprobó $${retiroSel.monto.toFixed(2)} para ${retiroSel.usuarios?.nombre ?? 'usuario'}.`
          : 'Se rechazó el retiro y el saldo fue devuelto al usuario.'
      );
    } catch (e: any) {
      const msg = e.message ?? 'Error desconocido';
      console.error('[admin-retiros] Error al resolver:', msg);
      avisar('Error', msg);
    } finally {
      setResolviendo(false);
    }
  };

  const pendientesCount = retiros.filter(r => r.estado === 'pendiente').length;
  const aprobadosCount  = retiros.filter(r => r.estado === 'aprobado').length;
  const totalPagado     = retiros.filter(r => r.estado === 'aprobado').reduce((s, r) => s + r.monto, 0);
  const retirosFiltered = retiros.filter(r => r.estado === filtro);

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitulo}>Solicitudes de Retiro</Text>
          {pendientesCount > 0 && (
            <View style={s.badgePendiente}>
              <Text style={s.badgeTexto}>{pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* BANNER DE ERROR (si la carga falló) */}
      {errorMsg && (
        <View style={s.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={C.red} />
          <Text style={s.errorBannerTexto}>{errorMsg}</Text>
          <TouchableOpacity onPress={cargar}>
            <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STATS */}
      <View style={s.statsRow}>
        <StatChip valor={pendientesCount} label="Pendientes" color={C.orange} bg={C.orangeDim} />
        <StatChip valor={aprobadosCount}  label="Aprobados"  color={C.green}  bg={C.greenDim} />
        <StatChip valor={`$${totalPagado.toFixed(0)}`} label="Total pagado" color={C.accent} bg={C.accentDim} />
      </View>

      {/* FILTROS */}
      <View style={s.filtrosRow}>
        {(['pendiente', 'aprobado', 'rechazado'] as EstadoRetiro[]).map(f => {
          const fc = estadoColor(f, COLORS);
          return (
            <TouchableOpacity
              key={f}
              style={[s.filtroBtn, filtro === f && { borderColor: fc, backgroundColor: fc + '18' }]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[s.filtroTexto, filtro === f && { color: fc }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pendiente' && pendientesCount > 0 ? ` (${pendientesCount})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* LISTA */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {retiros.length === 0 && !errorMsg && (
          <View style={[s.empty, { paddingTop: 40 }]}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>📋</Text>
            <Text style={s.emptyTexto}>No hay solicitudes registradas todavía.</Text>
            <Text style={[s.emptyTexto, { fontSize: 12, marginTop: 6 }]}>
              Cuando un usuario solicite un retiro, aparecerá aquí.
            </Text>
          </View>
        )}
        {retiros.length > 0 && retirosFiltered.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyTexto}>
              No hay solicitudes {filtro === 'pendiente' ? 'pendientes' : filtro === 'aprobado' ? 'aprobadas' : 'rechazadas'}
            </Text>
          </View>
        )}
        {retirosFiltered.map(r => (
          <AdminRetiroCard key={r.id} retiro={r} onResolver={abrirResolver} />
        ))}
      </ScrollView>

      {/* MODAL RESOLVER */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
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
                <View style={[s.resumenBox, { borderColor: C.orange + '40', backgroundColor: C.orangeDim }]}>
                  <Text style={s.resumenNombre}>{retiroSel.usuarios?.nombre ?? '—'}</Text>
                  <Text style={[s.resumenMonto, { color: C.orange }]}>${retiroSel.monto.toFixed(2)}</Text>
                  <Text style={s.resumenBanco}>
                    {retiroSel.banco} ·{' '}
                    {retiroSel.clabe
                      ? `CLABE: ****${retiroSel.clabe.slice(-4)}`
                      : `Tarjeta: ****${retiroSel.numero_tarjeta?.slice(-4)}`
                    }
                  </Text>
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

function StatChip({ valor, label, color, bg }: { valor: string | number; label: string; color: string; bg: string }) {
  return (
    <View style={[s.statChip, { borderColor: color + '60', backgroundColor: bg }]}>
      <Text style={[s.statVal, { color }]}>{valor}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  headerBack:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitulo:   { fontSize: 17, fontWeight: '700', color: C.text },
  badgePendiente: { marginTop: 2, backgroundColor: C.orange + '25', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTexto:     { fontSize: 10, fontWeight: '800', color: C.orange },
  errorBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 12, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, borderWidth: 1, borderColor: C.red + '40' },
  errorBannerTexto: { flex: 1, color: C.red, fontSize: 12 },
  statsRow:       { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  statChip:       { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  statVal:        { fontSize: 18, fontWeight: '800' },
  statLabel:      { fontSize: 10, color: C.textSub, fontWeight: '600' },
  filtrosRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filtroBtn:      { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center' },
  filtroTexto:    { fontSize: 12, fontWeight: '700', color: C.textSub },
  empty:          { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji:     { fontSize: 36, marginBottom: 12 },
  emptyTexto:     { color: C.textSub, fontSize: 14, textAlign: 'center' },
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
