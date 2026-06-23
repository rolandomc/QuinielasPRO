/**
 * app/admin-retiros.tsx
 *
 * CAPA: Presentation
 * ✅ Clean Architecture:
 *   - Solo importa el hook `useAdminRetiros` — NUNCA el Service ni supabase.
 *   - Alert/Platform viven aquí (capa UI), no en el hook.
 *   - Toda la lógica de negocio y datos está en features/retiro/application/.
 */
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Alert, TextInput, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { NeonCard, NeonButton, EmptyState, LoadingScreen, StatusPill } from '../components/ui';
import { useAdminRetiros } from '../features/retiro';
import { estadoConfig, estadoLabel, formatFecha } from '../features/retiro';
import type { EstadoRetiro } from '../types';

type FiltroEstado = 'todos' | 'pendiente' | 'aprobado' | 'rechazado';

/** Muestra un Alert nativo o window.alert según plataforma. */
const avisar = (titulo: string, cuerpo: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${cuerpo}`);
  else Alert.alert(titulo, cuerpo);
};

export default function AdminRetirosScreen() {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    retirosFiltered,
    retiros,
    loading,
    refreshing,
    errorMsg,
    filtro,
    setFiltro,
    pendientesCount,
    modalVisible,
    setModalVisible,
    retiroSel,
    nota,
    setNota,
    mensaje,
    setMensaje,
    resolving,
    cargar,
    onRefresh,
    abrirResolver,
    resolver,
  } = useAdminRetiros();

  // Carga inicial
  useEffect(() => { cargar(); }, [cargar]);

  // La UI maneja el Alert cuando el hook devuelve un mensaje
  useEffect(() => {
    if (!mensaje) return;
    avisar(mensaje.titulo, mensaje.cuerpo);
    setMensaje(null);
  }, [mensaje, setMensaje]);

  if (loading) return <LoadingScreen />;

  const counts = {
    todos:     retiros.length,
    pendiente: retiros.filter(r => r.estado === 'pendiente').length,
    aprobado:  retiros.filter(r => r.estado === 'aprobado').length,
    rechazado: retiros.filter(r => r.estado === 'rechazado').length,
  };

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[s.titulo, { color: C.text }]}>💸 Solicitudes de retiro</Text>
          <Text style={[s.subtitulo, { color: C.textSub }]}>
            {pendientesCount} pendiente{pendientesCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {errorMsg && (
          <View style={[s.errorBanner, { backgroundColor: C.bg }]}>
            <Text style={{ color: C.red ?? '#ff4444', fontSize: 13 }}>{errorMsg}</Text>
          </View>
        )}

        {/* Filtros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtros}
        >
          {(['todos', 'pendiente', 'aprobado', 'rechazado'] as FiltroEstado[]).map((f) => {
            const activo = filtro === f;
            const cfg    = f !== 'todos' ? estadoConfig(f as EstadoRetiro) : null;
            const color  = cfg?.color ?? C.accent;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  s.filtroBtn,
                  { borderColor: C.cardBorder, backgroundColor: C.card },
                  activo && { borderColor: color, backgroundColor: color + '18' },
                ]}
                onPress={() => setFiltro(f)}
              >
                <Text style={[s.filtroTexto, { color: activo ? color : C.textSub }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Lista */}
        <View style={s.lista}>
          {retirosFiltered.length === 0 ? (
            <EmptyState
              emoji="📭"
              title="Sin solicitudes"
              hint="No hay retiros en esta categoría."
            />
          ) : (
            retirosFiltered.map((r) => {
              const cfg      = estadoConfig(r.estado as EstadoRetiro);
              const color    = cfg?.color ?? C.orange;
              const label    = estadoLabel(r.estado as EstadoRetiro);
              const nombre   = (r as any).usuarios?.nombre ?? r.usuario_id.slice(0, 8);
              const username = (r as any).usuarios?.username;
              return (
                <NeonCard
                  key={r.id}
                  glow={color + '40'}
                  glowRadius={10}
                  style={{ marginBottom: 12 }}
                  radius={14}
                  cardStyle={{ padding: 14 }}
                >
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardNombre, { color: C.text }]}>{nombre}</Text>
                      {username && (
                        <Text style={[s.cardUsername, { color: C.textSub }]}>@{username}</Text>
                      )}
                    </View>
                    <StatusPill label={label} color={color} />
                  </View>

                  <Text style={[s.cardMonto, { color: C.accent }]}>
                    ${r.monto.toFixed(2)}
                  </Text>

                  <View style={{ gap: 3, marginBottom: 8 }}>
                    {([['Banco', r.banco], ['Titular', r.nombre_titular]] as [string, string][]).map(
                      ([k, v]) => (
                        <Text key={k} style={[s.dato, { color: C.textSub }]}>
                          <Text style={{ color: C.text, fontWeight: '700' }}>{k}: </Text>{v}
                        </Text>
                      )
                    )}
                    {r.clabe && (
                      <Text style={[s.dato, { color: C.textSub }]}>
                        <Text style={{ color: C.text, fontWeight: '700' }}>CLABE: </Text>
                        ****{r.clabe.slice(-4)}
                      </Text>
                    )}
                    {r.numero_tarjeta && (
                      <Text style={[s.dato, { color: C.textSub }]}>
                        <Text style={{ color: C.text, fontWeight: '700' }}>Tarjeta: </Text>
                        ****{r.numero_tarjeta.slice(-4)}
                      </Text>
                    )}
                  </View>

                  {r.nota_admin && (
                    <View style={[s.notaWrap, { backgroundColor: C.orangeDim }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={C.orange} />
                      <Text style={[s.notaTexto, { color: C.orange }]}>{r.nota_admin}</Text>
                    </View>
                  )}

                  <Text style={[s.fecha, { color: C.textSub }]}>{formatFecha(r.creado_en)}</Text>

                  {r.estado === 'pendiente' && (
                    <NeonButton
                      onPress={() => abrirResolver(r)}
                      label="Revisar solicitud"
                      icon="eye-outline"
                      style={{ marginTop: 12 }}
                    />
                  )}
                </NeonCard>
              );
            })
          )}
        </View>
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      {/* Modal resolver */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={mS.overlay}>
          <NeonCard
            glow={C.accentGlow}
            glowRadius={16}
            style={mS.modal}
            cardStyle={{ padding: 24 }}
            radius={20}
          >
            <Text style={[mS.modalTitulo, { color: C.text }]}>Resolver solicitud</Text>

            {retiroSel && (
              <>
                <Text style={[mS.modalMonto, { color: C.accent }]}>
                  ${retiroSel.monto.toFixed(2)}
                </Text>
                <Text style={[mS.modalUsuario, { color: C.textSub }]}>
                  {(retiroSel as any).usuarios?.nombre ?? retiroSel.usuario_id.slice(0, 8)}
                </Text>
                <View style={{ gap: 4, marginBottom: 16 }}>
                  {([['Banco', retiroSel.banco], ['Titular', retiroSel.nombre_titular]] as [string, string][]).map(
                    ([k, v]) => (
                      <Text key={k} style={[mS.modalDato, { color: C.textSub }]}>
                        <Text style={{ color: C.text, fontWeight: '700' }}>{k}: </Text>{v}
                      </Text>
                    )
                  )}
                  {retiroSel.clabe && (
                    <Text style={[mS.modalDato, { color: C.textSub }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>CLABE: </Text>
                      {retiroSel.clabe}
                    </Text>
                  )}
                  {retiroSel.numero_tarjeta && (
                    <Text style={[mS.modalDato, { color: C.textSub }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>Tarjeta: </Text>
                      {retiroSel.numero_tarjeta}
                    </Text>
                  )}
                </View>
              </>
            )}

            <Text style={[mS.notaLabel, { color: C.textSub }]}>
              Nota para el usuario (opcional)
            </Text>
            <TextInput
              style={[
                mS.notaInput,
                { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text },
              ]}
              value={nota}
              onChangeText={setNota}
              placeholder="Ej: Transferencia realizada"
              placeholderTextColor={C.textSub}
              multiline
            />

            <View style={mS.botonesRow}>
              <NeonButton
                onPress={() => resolver(true)}
                label="Aprobar"
                icon="checkmark-circle-outline"
                glow={C.greenGlow}
                color={C.green}
                loading={resolving}
                style={{ flex: 1 }}
              />
              <NeonButton
                onPress={() => resolver(false)}
                label="Rechazar"
                icon="close-circle-outline"
                glow={'rgba(255,90,110,0.4)'}
                color={C.red}
                loading={resolving}
                style={{ flex: 1 }}
              />
            </View>

            <TouchableOpacity
              style={[mS.cancelarBtn, { borderColor: C.cardBorder }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[mS.cancelarTexto, { color: C.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
          </NeonCard>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1 },
  header:       { paddingHorizontal: 20, paddingBottom: 12 },
  titulo:       { fontSize: 26, fontWeight: '900' },
  subtitulo:    { fontSize: 13, marginTop: 2 },
  errorBanner:  { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8 },
  filtros:      { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filtroBtn:    { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  filtroTexto:  { fontWeight: '700', fontSize: 13 },
  lista:        { marginHorizontal: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardNombre:   { fontWeight: '800', fontSize: 15 },
  cardUsername: { fontSize: 12, marginTop: 1 },
  cardMonto:    { fontSize: 26, fontWeight: '900', marginBottom: 8 },
  dato:         { fontSize: 12 },
  notaWrap:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, borderRadius: 8, padding: 8 },
  notaTexto:    { fontSize: 12, flex: 1 },
  fecha:        { fontSize: 11 },
});

const mS = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modal:         { marginHorizontal: 12, marginBottom: 12 },
  modalTitulo:   { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  modalMonto:    { fontSize: 32, fontWeight: '900', marginBottom: 4 },
  modalUsuario:  { fontSize: 14, marginBottom: 12 },
  modalDato:     { fontSize: 13 },
  notaLabel:     { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  notaInput:     { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, marginBottom: 16 },
  botonesRow:    { flexDirection: 'row', gap: 10, marginBottom: 12 },
  cancelarBtn:   { alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5 },
  cancelarTexto: { fontWeight: '700' },
});
