/**
 * app/admin-retiros.tsx — Clean Architecture
 * Usa NeonCard, NeonButton, EmptyState, LoadingScreen, StatusPill de components/ui/
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { NeonCard, NeonButton, EmptyState, LoadingScreen, StatusPill } from '../components/ui';
import { fetchRetiros, resolverRetiro } from '../features/retiro/retiroService';
import { estadoConfig, estadoLabel, formatFecha } from '../features/retiro/retiroUtils';
import type { SolicitudRetiro, EstadoRetiro } from '../types';

type FiltroEstado = 'todos' | 'pendiente' | 'aprobado' | 'rechazado';

export default function AdminRetirosScreen() {
  const { colors: C } = useTheme();
  const insets = useSafeAreaInsets();

  const [retiros, setRetiros]       = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro]         = useState<FiltroEstado>('todos');
  const [modalVisible, setModalVisible] = useState(false);
  const [retiroActivo, setRetiroActivo] = useState<SolicitudRetiro | null>(null);
  const [nota, setNota]             = useState('');
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    const data = await fetchRetiros();
    setRetiros(data);
  }, []);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await cargar(); setRefreshing(false); }, [cargar]);

  const abrirModal = (r: SolicitudRetiro) => { setRetiroActivo(r); setNota(''); setModalVisible(true); };

  const resolver = async (aprobar: boolean) => {
    if (!retiroActivo) return;
    setProcesando(true);
    try {
      await resolverRetiro(retiroActivo.id, aprobar, nota.trim() || null);
      await cargar();
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setProcesando(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const lista = filtro === 'todos' ? retiros : retiros.filter(r => r.estado === filtro);
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[s.titulo, { color: C.text }]}>💸 Solicitudes de retiro</Text>
          <Text style={[s.subtitulo, { color: C.textSub }]}>{counts.pendiente} pendiente{counts.pendiente !== 1 ? 's' : ''}</Text>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
          {(['todos', 'pendiente', 'aprobado', 'rechazado'] as FiltroEstado[]).map(f => {
            const activo = filtro === f;
            const cfg    = f !== 'todos' ? estadoConfig(f as EstadoRetiro) : null;
            const color  = cfg?.color ?? C.accent;
            return (
              <TouchableOpacity
                key={f}
                style={[s.filtroBtn, { borderColor: C.cardBorder, backgroundColor: C.card },
                  activo && { borderColor: color, backgroundColor: color + '18' }]}
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
          {lista.length === 0 ? (
            <EmptyState emoji="📭" title="Sin solicitudes" hint="No hay retiros en esta categoría." />
          ) : lista.map(r => {
            const cfg   = estadoConfig(r.estado as EstadoRetiro);
            const color = cfg?.color ?? C.orange;
            const label = estadoLabel(r.estado as EstadoRetiro);
            const nombre = (r as any).usuarios?.nombre ?? r.usuario_id.slice(0, 8);
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
                    {username && <Text style={[s.cardUsername, { color: C.textSub }]}>@{username}</Text>}
                  </View>
                  <StatusPill label={label} color={color} />
                </View>

                <Text style={[s.cardMonto, { color: C.accent }]}>${r.monto.toFixed(2)}</Text>

                <View style={{ gap: 3, marginBottom: 8 }}>
                  {[['Banco', r.banco], ['Titular', r.nombre_titular]].map(([k, v]) => (
                    <Text key={k as string} style={[s.dato, { color: C.textSub }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>{k}: </Text>{v}
                    </Text>
                  ))}
                  {r.clabe && <Text style={[s.dato, { color: C.textSub }]}><Text style={{ color: C.text, fontWeight: '700' }}>CLABE: </Text>****{r.clabe.slice(-4)}</Text>}
                  {r.numero_tarjeta && <Text style={[s.dato, { color: C.textSub }]}><Text style={{ color: C.text, fontWeight: '700' }}>Tarjeta: </Text>****{r.numero_tarjeta.slice(-4)}</Text>}
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
                    onPress={() => abrirModal(r)}
                    label="Revisar solicitud"
                    icon="eye-outline"
                    style={{ marginTop: 12 }}
                  />
                )}
              </NeonCard>
            );
          })}
        </View>
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      {/* Modal resolver */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={mS.overlay}>
          <NeonCard glow={C.accentGlow} glowRadius={16} style={mS.modal} cardStyle={{ padding: 24 }} radius={20}>
            <Text style={[mS.modalTitulo, { color: C.text }]}>Resolver solicitud</Text>

            {retiroActivo && (
              <>
                <Text style={[mS.modalMonto, { color: C.accent }]}>${retiroActivo.monto.toFixed(2)}</Text>
                <Text style={[mS.modalUsuario, { color: C.textSub }]}>
                  {(retiroActivo as any).usuarios?.nombre ?? retiroActivo.usuario_id.slice(0, 8)}
                </Text>
                <View style={{ gap: 4, marginBottom: 16 }}>
                  {[['Banco', retiroActivo.banco], ['Titular', retiroActivo.nombre_titular]].map(([k, v]) => (
                    <Text key={k as string} style={[mS.modalDato, { color: C.textSub }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>{k}: </Text>{v}
                    </Text>
                  ))}
                  {retiroActivo.clabe && (
                    <Text style={[mS.modalDato, { color: C.textSub }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>CLABE: </Text>{retiroActivo.clabe}
                    </Text>
                  )}
                  {retiroActivo.numero_tarjeta && (
                    <Text style={[mS.modalDato, { color: C.textSub }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>Tarjeta: </Text>{retiroActivo.numero_tarjeta}
                    </Text>
                  )}
                </View>
              </>
            )}

            <Text style={[mS.notaLabel, { color: C.textSub }]}>Nota para el usuario (opcional)</Text>
            <TextInput
              style={[mS.notaInput, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
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
                loading={procesando}
                style={{ flex: 1 }}
              />
              <NeonButton
                onPress={() => resolver(false)}
                label="Rechazar"
                icon="close-circle-outline"
                glow={'rgba(255,90,110,0.4)'}
                color={C.red}
                loading={procesando}
                style={{ flex: 1 }}
              />
            </View>

            <TouchableOpacity style={[mS.cancelarBtn, { borderColor: C.cardBorder }]} onPress={() => setModalVisible(false)}>
              <Text style={[mS.cancelarTexto, { color: C.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
          </NeonCard>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { paddingHorizontal: 20, paddingBottom: 12 },
  titulo:      { fontSize: 26, fontWeight: '900' },
  subtitulo:   { fontSize: 13, marginTop: 2 },
  filtros:     { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filtroBtn:   { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  filtroTexto: { fontWeight: '700', fontSize: 13 },
  lista:       { marginHorizontal: 16 },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardNombre:  { fontWeight: '800', fontSize: 15 },
  cardUsername:{ fontSize: 12, marginTop: 1 },
  cardMonto:   { fontSize: 26, fontWeight: '900', marginBottom: 8 },
  dato:        { fontSize: 12 },
  notaWrap:    { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, borderRadius: 8, padding: 8 },
  notaTexto:   { fontSize: 12, flex: 1 },
  fecha:       { fontSize: 11 },
});

const mS = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modal:        { marginHorizontal: 12, marginBottom: 12 },
  modalTitulo:  { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  modalMonto:   { fontSize: 32, fontWeight: '900', marginBottom: 4 },
  modalUsuario: { fontSize: 14, marginBottom: 12 },
  modalDato:    { fontSize: 13 },
  notaLabel:    { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  notaInput:    { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 60, marginBottom: 16 },
  botonesRow:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  cancelarBtn:  { alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5 },
  cancelarTexto:{ fontWeight: '700' },
});
