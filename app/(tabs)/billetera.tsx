/**
 * app/(tabs)/billetera.tsx
 *
 * Pantalla de billetera — Clean Architecture:
 *  - Lógica de datos:       features/retiro/useRetiro.ts
 *  - Lógica de UI pura:     features/retiro/retiroUtils.ts
 *  - Componentes UI neón:   components/ui/
 *  - Esta pantalla solo ensambla y conecta.
 */
import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Modal,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NeonCard, NeonButton, ScreenHeader, EmptyState, LoadingScreen, StatusPill } from '../../components/ui';
import { useBilletera } from '../../features/retiro/useRetiro';
import {
  formatFecha, formatMonto, movimientoConfig,
  estadoConfig, estadoLabel, validarFormularioRetiro,
} from '../../features/retiro/retiroUtils';
import type { CrearRetiroParams, EstadoRetiro } from '../../types';

// ─── Modal de solicitud ──────────────────────────────────────────────────────

function ModalRetiro({
  visible, onClose, onEnviar, saldoDisponible,
}: {
  visible: boolean;
  onClose: () => void;
  onEnviar: (datos: Omit<CrearRetiroParams, 'usuarioId'>) => Promise<void>;
  saldoDisponible: number;
}) {
  const { colors: C } = useTheme();
  const [monto, setMonto]         = useState('');
  const [nombre, setNombre]       = useState('');
  const [banco, setBanco]         = useState('');
  const [clabe, setClabe]         = useState('');
  const [tarjeta, setTarjeta]     = useState('');
  const [usarClabe, setUsarClabe] = useState(true);
  const [sending, setSending]     = useState(false);

  const limpiar = () => {
    setMonto(''); setNombre(''); setBanco('');
    setClabe(''); setTarjeta(''); setUsarClabe(true);
  };

  const handleEnviar = async () => {
    const res = validarFormularioRetiro({ monto, nombre, banco, clabe, tarjeta, usarClabe, saldoDisponible });
    if (!res.ok) { Alert.alert('Error', res.msg); return; }
    setSending(true);
    await onEnviar({
      monto:          parseFloat(monto),
      nombre_titular: nombre.trim(),
      banco:          banco.trim(),
      clabe:          usarClabe ? clabe.replace(/\s/g, '') : null,
      numero_tarjeta: !usarClabe ? tarjeta.replace(/\s/g, '') : null,
    });
    setSending(false);
    limpiar();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={mS.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[mS.sheet, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}>
          <View style={[mS.handle, { backgroundColor: C.cardBorder }]} />
          <View style={mS.headerRow}>
            <Text style={[mS.titulo, { color: C.text }]}>Solicitar retiro</Text>
            <TouchableOpacity onPress={() => { limpiar(); onClose(); }}>
              <Ionicons name="close" size={24} color={C.textSub} />
            </TouchableOpacity>
          </View>

          <View style={[mS.saldoInfo, { backgroundColor: C.greenDim, borderColor: C.green + '33' }]}>
            <Ionicons name="wallet-outline" size={14} color={C.green} />
            <Text style={[mS.saldoInfoText, { color: C.textSub }]}>
              Disponible:{' '}
              <Text style={{ color: C.green, fontWeight: '800' }}>${saldoDisponible.toFixed(2)}</Text>
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[mS.label, { color: C.textSub }]}>Monto a retirar</Text>
            <View style={[mS.inputMontoWrap, { backgroundColor: C.bg, borderColor: C.accent }]}>
              <Text style={[mS.inputMontoPeso, { color: C.accent }]}>$</Text>
              <TextInput
                style={[mS.inputMonto, { color: C.text }]}
                value={monto} onChangeText={setMonto}
                keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textSub}
              />
            </View>

            <Text style={[mS.label, { color: C.textSub }]}>Nombre completo del titular</Text>
            <TextInput
              style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
              value={nombre} onChangeText={setNombre}
              placeholder="Como aparece en tu cuenta bancaria" placeholderTextColor={C.textSub}
              autoCapitalize="words"
            />

            <Text style={[mS.label, { color: C.textSub }]}>Banco</Text>
            <TextInput
              style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
              value={banco} onChangeText={setBanco}
              placeholder="BBVA, Santander, HSBC..." placeholderTextColor={C.textSub}
              autoCapitalize="words"
            />

            <View style={mS.toggleRow}>
              {['CLABE', 'Tarjeta'].map((opt, i) => {
                const active = i === 0 ? usarClabe : !usarClabe;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[mS.toggleBtn, { borderColor: C.cardBorder }, active && { borderColor: C.accent, backgroundColor: C.accentDim }]}
                    onPress={() => setUsarClabe(i === 0)}
                  >
                    <Text style={[mS.toggleTexto, { color: C.textSub }, active && { color: C.accent }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[mS.label, { color: C.textSub }]}>
              {usarClabe ? 'CLABE interbancaria (18 dígitos)' : 'Número de tarjeta'}
            </Text>
            <TextInput
              style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
              value={usarClabe ? clabe : tarjeta}
              onChangeText={usarClabe ? setClabe : setTarjeta}
              keyboardType="number-pad"
              maxLength={usarClabe ? 18 : 16}
              placeholder={usarClabe ? '000000000000000000' : '0000000000000000'}
              placeholderTextColor={C.textSub}
            />

            <Text style={[mS.aviso, { color: C.textSub, backgroundColor: C.orangeDim, borderColor: C.orange + '33' }]}>
              ⚠️ Tu solicitud será revisada por el administrador. El monto se bloquea hasta ser aprobado o rechazado.
            </Text>

            <NeonButton
              onPress={handleEnviar}
              label="Enviar solicitud"
              icon="send"
              loading={sending}
              style={{ marginTop: 20 }}
            />
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const mS = StyleSheet.create({
  overlay:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:          { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%', borderTopWidth: 1 },
  handle:         { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo:         { fontSize: 20, fontWeight: '900' },
  saldoInfo:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1 },
  saldoInfoText:  { fontSize: 13 },
  label:          { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  input:          { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15 },
  inputMontoWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12 },
  inputMontoPeso: { fontSize: 22, fontWeight: '900', marginRight: 4 },
  inputMonto:     { flex: 1, fontSize: 28, fontWeight: '900', paddingVertical: 10 },
  toggleRow:      { flexDirection: 'row', marginTop: 14, marginBottom: 2, gap: 8 },
  toggleBtn:      { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  toggleTexto:    { fontWeight: '700' },
  aviso:          { fontSize: 11, lineHeight: 16, marginTop: 16, padding: 10, borderRadius: 8, borderWidth: 1 },
});

// ─── Pantalla principal ──────────────────────────────────────────────────────

export default function BilleteraScreen() {
  const { usuario } = useAuth();
  const { colors: C } = useTheme();
  const [tab, setTab] = useState<'movimientos' | 'retiros'>('movimientos');

  const {
    saldo, movimientos, retiros, loading, refreshing,
    modalVisible, cargar, onRefresh, solicitarRetiro, setModalVisible,
  } = useBilletera(usuario?.id);

  useEffect(() => { cargar(); }, [cargar]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) return <LoadingScreen />;

  const disponible = saldo?.disponible ?? 0;
  const enRetiro   = saldo?.en_retiro  ?? 0;
  const total      = disponible + enRetiro;
  const pendientes = retiros.filter(r => r.estado === 'pendiente').length;

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="💰 Mi Billetera" />

        {/* ── Tarjeta de saldo ── */}
        <NeonCard glow={C.accentGlow} glowRadius={18} style={s.marginH} cardStyle={s.saldoCard}>
          <Text style={[s.saldoLabel, { color: C.textSub }]}>Saldo total</Text>
          <Text style={[s.saldoTotal, { color: C.text }]}>${total.toFixed(2)}</Text>

          <View style={[s.saldoDesglose, { backgroundColor: C.bg }]}>
            {[{ label: 'Disponible', monto: disponible, color: C.green },
              { label: 'En retiro',  monto: enRetiro,   color: C.orange }]
              .map((item, i) => (
                <React.Fragment key={item.label}>
                  {i > 0 && <View style={[s.saldoDivider, { backgroundColor: C.cardBorder }]} />}
                  <View style={s.saldoItem}>
                    <View style={[s.saldoDot, { backgroundColor: item.color }]} />
                    <View>
                      <Text style={[s.saldoItemLabel, { color: C.textSub }]}>{item.label}</Text>
                      <Text style={[s.saldoItemMonto, { color: item.color }]}>${item.monto.toFixed(2)}</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
          </View>

          <NeonButton
            onPress={() => setModalVisible(true)}
            label="Solicitar retiro"
            icon="arrow-up-circle"
            disabled={disponible <= 0}
          />
        </NeonCard>

        {/* ── Tabs ── */}
        <View style={s.tabsRow}>
          {([['movimientos', 'list', 'Movimientos'], ['retiros', 'time', 'Retiros']] as const).map(([id, icon, label]) => {
            const activo = tab === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.tabBtn, { borderColor: C.cardBorder, backgroundColor: C.card }, activo && { borderColor: C.accent, backgroundColor: C.accentDim }]}
                onPress={() => setTab(id)}
              >
                <Ionicons name={icon} size={14} color={activo ? C.accent : C.textSub} />
                <Text style={[s.tabTexto, { color: activo ? C.accent : C.textSub }]}>{label}</Text>
                {id === 'retiros' && pendientes > 0 && (
                  <View style={[s.badge, { backgroundColor: C.orange }]}>
                    <Text style={s.badgeTexto}>{pendientes}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Movimientos ── */}
        {tab === 'movimientos' && (
          <View style={s.lista}>
            {movimientos.length === 0
              ? <EmptyState emoji="📭" title="Sin movimientos aún" hint="Aquí aparecerán depósitos, premios y retiros" />
              : movimientos.map(m => {
                  const info     = movimientoConfig(m.tipo as any);
                  const positivo = m.monto >= 0;
                  return (
                    <View key={m.id} style={[s.movRow, { borderBottomColor: C.cardBorder }]}>
                      <View style={[s.movIconWrap, { backgroundColor: info.color + '18' }]}>
                        <Ionicons name={info.icon as any} size={20} color={info.color} />
                      </View>
                      <View style={s.movInfo}>
                        <Text style={[s.movTipo, { color: C.text }]}>{info.label}</Text>
                        {m.descripcion && <Text style={[s.movDesc, { color: C.textSub }]} numberOfLines={1}>{m.descripcion}</Text>}
                        <Text style={[s.movFecha, { color: C.textSub }]}>{formatFecha(m.creado_en)}</Text>
                      </View>
                      <Text style={[s.movMonto, { color: positivo ? C.green : C.red }]}>{formatMonto(m.monto)}</Text>
                    </View>
                  );
                })
            }
          </View>
        )}

        {/* ── Retiros ── */}
        {tab === 'retiros' && (
          <View style={s.lista}>
            {retiros.length === 0
              ? <EmptyState emoji="📭" title="Sin solicitudes de retiro" />
              : retiros.map(r => {
                  const cfg   = estadoConfig(r.estado as EstadoRetiro);
                  const color = cfg?.color ?? C.orange;
                  const label = estadoLabel(r.estado as EstadoRetiro);
                  return (
                    <NeonCard
                      key={r.id}
                      glow={color + '46'}
                      glowRadius={10}
                      style={{ marginBottom: 10 }}
                      cardStyle={{ padding: 14 }}
                      radius={14}
                    >
                      <View style={s.retiroHeaderRow}>
                        <Text style={[s.retiroMonto, { color: C.text }]}>${r.monto.toFixed(2)}</Text>
                        <StatusPill label={label} color={color} />
                      </View>

                      <View style={{ gap: 3, marginBottom: 8 }}>
                        {[['Titular', r.nombre_titular], ['Banco', r.banco]].map(([k, v]) => (
                          <Text key={k} style={[s.retiroDato, { color: C.textSub }]}>
                            <Text style={{ fontWeight: '700', color: C.text }}>{k}: </Text>{v}
                          </Text>
                        ))}
                        {r.clabe && <Text style={[s.retiroDato, { color: C.textSub }]}><Text style={{ fontWeight: '700', color: C.text }}>CLABE: </Text>****{r.clabe.slice(-4)}</Text>}
                        {r.numero_tarjeta && <Text style={[s.retiroDato, { color: C.textSub }]}><Text style={{ fontWeight: '700', color: C.text }}>Tarjeta: </Text>****{r.numero_tarjeta.slice(-4)}</Text>}
                      </View>

                      {r.nota_admin && (
                        <View style={[s.notaAdmin, { backgroundColor: C.orangeDim }]}>
                          <Ionicons name="chatbubble-ellipses-outline" size={12} color={C.orange} />
                          <Text style={[s.notaTexto, { color: C.orange }]}>{r.nota_admin}</Text>
                        </View>
                      )}

                      <View style={{ gap: 2, marginTop: 4 }}>
                        <Text style={[s.retiroFecha, { color: C.textSub }]}>Solicitado: {formatFecha(r.creado_en)}</Text>
                        {r.resuelto_en && <Text style={[s.retiroFecha, { color }]}>Resuelto: {formatFecha(r.resuelto_en)}</Text>}
                      </View>
                    </NeonCard>
                  );
                })
            }
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      <ModalRetiro
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onEnviar={solicitarRetiro}
        saldoDisponible={disponible}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  marginH:       { marginHorizontal: 16, marginBottom: 16 },
  saldoCard:     { padding: 20 },
  saldoLabel:    { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  saldoTotal:    { fontSize: 44, fontWeight: '900', marginBottom: 16 },
  saldoDesglose: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderRadius: 12, padding: 14, gap: 12 },
  saldoItem:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  saldoDot:      { width: 10, height: 10, borderRadius: 5 },
  saldoItemLabel:{ fontSize: 11, fontWeight: '600' },
  saldoItemMonto:{ fontWeight: '800', fontSize: 18 },
  saldoDivider:  { width: 1, height: 36 },
  tabsRow:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5 },
  tabTexto:      { fontWeight: '700', fontSize: 13 },
  badge:         { borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTexto:    { color: '#fff', fontSize: 9, fontWeight: '900' },
  lista:         { marginHorizontal: 16 },
  movRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  movIconWrap:   { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movInfo:       { flex: 1 },
  movTipo:       { fontWeight: '700', fontSize: 14 },
  movDesc:       { fontSize: 12, marginTop: 1 },
  movFecha:      { fontSize: 11, marginTop: 2 },
  movMonto:      { fontWeight: '900', fontSize: 16 },
  retiroHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  retiroMonto:   { fontSize: 22, fontWeight: '900' },
  retiroDato:    { fontSize: 12 },
  notaAdmin:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, borderRadius: 8, padding: 8 },
  notaTexto:     { fontSize: 12, flex: 1 },
  retiroFecha:   { fontSize: 11 },
});
