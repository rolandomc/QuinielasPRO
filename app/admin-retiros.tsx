/**
 * app/admin-retiros.tsx
 *
 * Panel admin — gestión de solicitudes de retiro.
 * Toda la lógica de datos vive en features/retiro/useAdminRetiros.ts
 * Utilidades de presentación en features/retiro/retiroUtils.ts
 */
import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Modal,
  TextInput, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';
import { useAdminRetiros } from '../features/retiro/useAdminRetiros';
import { estadoColor, estadoLabel, formatFecha } from '../features/retiro/retiroUtils';
import AdminRetiroCard from '../components/AdminRetiroCard';
import type { EstadoRetiro } from '../types';

// Alerta cross-platform
const avisar = (titulo: string, mensaje: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${mensaje}`);
  else Alert.alert(titulo, mensaje);
};

// ─── Chip de estadística ────────────────────────────────────────────────────
function StatChip({
  valor, label, color, bg,
}: { valor: string | number; label: string; color: string; bg: string }) {
  return (
    <View style={[s.statChip, { borderColor: color + '60', backgroundColor: bg }]}>
      <Text style={[s.statVal, { color }]}>{valor}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Pantalla principal ──────────────────────────────────────────────────────
export default function AdminRetirosScreen() {
  const { usuario } = useAuth();
  const insets      = useSafeAreaInsets();
  const router      = useRouter();

  const {
    retiros, loading, refreshing, errorMsg,
    filtro, setFiltro,
    retirosFiltered, pendientesCount, aprobadosCount, totalPagado,
    modalVisible, setModalVisible,
    retiroSel, nota, setNota,
    resolving,
    cargar, onRefresh,
    abrirResolver, resolver,
  } = useAdminRetiros();

  // Guardia de admin + carga inicial
  useEffect(() => {
    if (!usuario?.es_admin) {
      avisar('Acceso denegado', 'No tienes permisos.');
      router.back();
      return;
    }
    cargar();
  }, [usuario]);

  // Refresco silencioso al volver a la pantalla
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitulo}>Solicitudes de Retiro</Text>
          {pendientesCount > 0 && (
            <View style={s.badgePendiente}>
              <Text style={s.badgeTexto}>
                {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Banner de error ── */}
      {errorMsg && (
        <View style={s.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={COLORS.red} />
          <Text style={s.errorBannerTexto}>{errorMsg}</Text>
          <TouchableOpacity onPress={cargar}>
            <Text style={{ color: COLORS.accent, fontSize: 12, fontWeight: '700' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Stats ── */}
      <View style={s.statsRow}>
        <StatChip
          valor={pendientesCount}
          label="Pendientes"
          color={COLORS.orange}
          bg={COLORS.orangeDim}
        />
        <StatChip
          valor={aprobadosCount}
          label="Aprobados"
          color={COLORS.green}
          bg={COLORS.greenDim}
        />
        <StatChip
          valor={`$${totalPagado.toFixed(0)}`}
          label="Total pagado"
          color={COLORS.accent}
          bg={COLORS.accentDim}
        />
      </View>

      {/* ── Filtros ── */}
      <View style={s.filtrosRow}>
        {(['pendiente', 'aprobado', 'rechazado'] as EstadoRetiro[]).map(f => {
          const fc     = estadoColor(f);
          const activo = filtro === f;
          return (
            <TouchableOpacity
              key={f}
              style={[s.filtroBtn, activo && { borderColor: fc, backgroundColor: fc + '18' }]}
              onPress={() => setFiltro(f)}
            >
              <Text style={[s.filtroTexto, activo && { color: fc }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pendiente' && pendientesCount > 0 ? ` (${pendientesCount})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Lista ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Sin datos globales */}
        {retiros.length === 0 && !errorMsg && (
          <View style={[s.empty, { paddingTop: 40 }]}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>📋</Text>
            <Text style={s.emptyTexto}>No hay solicitudes registradas todavía.</Text>
            <Text style={[s.emptyTexto, { fontSize: 12, marginTop: 6 }]}>
              Cuando un usuario solicite un retiro, aparecerá aquí.
            </Text>
          </View>
        )}

        {/* Sin datos para el filtro activo */}
        {retiros.length > 0 && retirosFiltered.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyTexto}>
              No hay solicitudes{' '}
              {filtro === 'pendiente'
                ? 'pendientes'
                : filtro === 'aprobado'
                ? 'aprobadas'
                : 'rechazadas'}
            </Text>
          </View>
        )}

        {retirosFiltered.map(r => (
          <AdminRetiroCard key={r.id} retiro={r} onResolver={abrirResolver} />
        ))}
      </ScrollView>

      {/* ── Modal resolver ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Cabecera del modal */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Resolver solicitud</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            {retiroSel && (
              <>
                {/* Resumen del retiro */}
                <View style={[s.resumenBox, {
                  borderColor: COLORS.orange + '40',
                  backgroundColor: COLORS.orangeDim,
                }]}>
                  <Text style={s.resumenNombre}>
                    {(retiroSel as any).usuarios?.nombre ?? '—'}
                  </Text>
                  <Text style={[s.resumenMonto, { color: COLORS.orange }]}>
                    ${retiroSel.monto.toFixed(2)}
                  </Text>
                  <Text style={s.resumenBanco}>
                    {retiroSel.banco} ·{' '}
                    {retiroSel.clabe
                      ? `CLABE: ****${retiroSel.clabe.slice(-4)}`
                      : `Tarjeta: ****${retiroSel.numero_tarjeta?.slice(-4)}`}
                  </Text>
                  <Text style={s.resumenTitular}>Titular: {retiroSel.nombre_titular}</Text>
                  <Text style={s.resumenFecha}>Solicitado: {formatFecha(retiroSel.creado_en)}</Text>
                </View>

                {/* Nota admin */}
                <Text style={s.modalLabel}>Nota para el usuario (opcional)</Text>
                <TextInput
                  style={s.modalInput}
                  value={nota}
                  onChangeText={setNota}
                  placeholder='Ej: "Transferencia enviada" o "Datos incorrectos"'
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={2}
                />

                {/* Botones aprobar / rechazar */}
                <View style={s.modalBtnsRow}>
                  <TouchableOpacity
                    style={[
                      s.modalBtn,
                      { borderColor: COLORS.red, backgroundColor: COLORS.redDim },
                      resolving && { opacity: 0.5 },
                    ]}
                    onPress={() => resolver(false)}
                    disabled={resolving}
                    activeOpacity={0.8}
                  >
                    {resolving ? (
                      <ActivityIndicator color={COLORS.red} size="small" />
                    ) : (
                      <>
                        <Ionicons name="close-circle" size={16} color={COLORS.red} />
                        <Text style={[s.modalBtnTexto, { color: COLORS.red }]}>Rechazar</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      s.modalBtn,
                      { borderColor: COLORS.green, backgroundColor: COLORS.greenDim, flex: 2 },
                      resolving && { opacity: 0.5 },
                    ]}
                    onPress={() => resolver(true)}
                    disabled={resolving}
                    activeOpacity={0.8}
                  >
                    {resolving ? (
                      <ActivityIndicator color={COLORS.green} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                        <Text style={[s.modalBtnTexto, { color: COLORS.green }]}>
                          Confirmar aprobación
                        </Text>
                      </>
                    )}
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
  root:             { flex: 1, backgroundColor: COLORS.bg },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  headerBack:       { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitulo:     { fontSize: 17, fontWeight: '700', color: COLORS.text },
  badgePendiente:   { marginTop: 2, backgroundColor: COLORS.orange + '25', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTexto:       { fontSize: 10, fontWeight: '800', color: COLORS.orange },
  errorBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 12, backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: 10, borderWidth: 1, borderColor: COLORS.red + '40' },
  errorBannerTexto: { flex: 1, color: COLORS.red, fontSize: 12 },
  statsRow:         { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  statChip:         { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 2 },
  statVal:          { fontSize: 18, fontWeight: '800' },
  statLabel:        { fontSize: 10, color: COLORS.textSub, fontWeight: '600' },
  filtrosRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filtroBtn:        { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.cardBorder, alignItems: 'center' },
  filtroTexto:      { fontSize: 12, fontWeight: '700', color: COLORS.textSub },
  empty:            { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji:       { fontSize: 36, marginBottom: 12 },
  emptyTexto:       { color: COLORS.textSub, fontSize: 14, textAlign: 'center' },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:        { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: COLORS.cardBorder },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo:      { fontSize: 17, fontWeight: '800', color: COLORS.text },
  resumenBox:       { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16, alignItems: 'center', gap: 4 },
  resumenNombre:    { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  resumenMonto:     { fontSize: 28, fontWeight: '900' },
  resumenBanco:     { color: COLORS.textSub, fontSize: 12, marginTop: 4 },
  resumenTitular:   { color: COLORS.textSub, fontSize: 12 },
  resumenFecha:     { color: COLORS.textSub, fontSize: 11, marginTop: 2 },
  modalLabel:       { fontSize: 12, color: COLORS.textSub, fontWeight: '600', marginBottom: 8 },
  modalInput:       { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 14, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' },
  modalBtnsRow:     { flexDirection: 'row', gap: 10 },
  modalBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  modalBtnTexto:    { fontWeight: '800', fontSize: 14 },
});
