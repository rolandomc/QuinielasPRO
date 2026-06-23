/**
 * app/(tabs)/billetera.tsx
 *
 * Pantalla de billetera del usuario.
 * Toda la lógica de datos vive en features/retiro/useRetiro.ts
 * Toda la lógica de presentación de retiros en features/retiro/retiroUtils.ts
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Modal,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import NeonWrapper from '../../components/NeonWrapper';
import { COLORS } from '../../constants/colors';
import { useBilletera } from '../../features/retiro/useRetiro';
import {
  formatFecha,
  formatMonto,
  movimientoConfig,
  estadoColor,
  estadoLabel,
  estadoConfig,
  validarFormularioRetiro,
} from '../../features/retiro/retiroUtils';
import type { CrearRetiroParams, EstadoRetiro } from '../../types';

// ─── Modal de solicitud de retiro ────────────────────────────────────────────

function ModalRetiro({
  visible, onClose, onEnviar, saldoDisponible,
}: {
  visible: boolean;
  onClose: () => void;
  onEnviar: (datos: Omit<CrearRetiroParams, 'usuarioId'>) => Promise<void>;
  saldoDisponible: number;
}) {
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
    const resultado = validarFormularioRetiro({
      monto, nombre, banco, clabe, tarjeta, usarClabe, saldoDisponible,
    });
    if (!resultado.ok) {
      Alert.alert('Error', resultado.msg);
      return;
    }
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
        style={modalS.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={modalS.sheet}>
          <View style={modalS.handle} />
          <View style={modalS.headerRow}>
            <Text style={modalS.titulo}>Solicitar retiro</Text>
            <TouchableOpacity onPress={() => { limpiar(); onClose(); }}>
              <Ionicons name="close" size={24} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <View style={modalS.saldoInfo}>
            <Ionicons name="wallet-outline" size={14} color={COLORS.green} />
            <Text style={modalS.saldoInfoText}>
              Disponible:{' '}
              <Text style={{ color: COLORS.green, fontWeight: '800' }}>
                ${saldoDisponible.toFixed(2)}
              </Text>
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalS.label}>Monto a retirar</Text>
            <View style={modalS.inputMontoWrap}>
              <Text style={modalS.inputMontoPeso}>$</Text>
              <TextInput
                style={modalS.inputMonto}
                value={monto}
                onChangeText={setMonto}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textSub}
              />
            </View>

            <Text style={modalS.label}>Nombre completo del titular</Text>
            <TextInput
              style={modalS.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Como aparece en tu cuenta bancaria"
              placeholderTextColor={COLORS.textSub}
              autoCapitalize="words"
            />

            <Text style={modalS.label}>Banco</Text>
            <TextInput
              style={modalS.input}
              value={banco}
              onChangeText={setBanco}
              placeholder="BBVA, Santander, HSBC..."
              placeholderTextColor={COLORS.textSub}
              autoCapitalize="words"
            />

            <View style={modalS.toggleRow}>
              <TouchableOpacity
                style={[modalS.toggleBtn, usarClabe && modalS.toggleActivo]}
                onPress={() => setUsarClabe(true)}
              >
                <Text style={[modalS.toggleTexto, usarClabe && modalS.toggleTextoActivo]}>
                  CLABE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalS.toggleBtn, !usarClabe && modalS.toggleActivo]}
                onPress={() => setUsarClabe(false)}
              >
                <Text style={[modalS.toggleTexto, !usarClabe && modalS.toggleTextoActivo]}>
                  Tarjeta
                </Text>
              </TouchableOpacity>
            </View>

            {usarClabe ? (
              <>
                <Text style={modalS.label}>CLABE interbancaria (18 dígitos)</Text>
                <TextInput
                  style={modalS.input}
                  value={clabe}
                  onChangeText={setClabe}
                  keyboardType="number-pad"
                  maxLength={18}
                  placeholder="000000000000000000"
                  placeholderTextColor={COLORS.textSub}
                />
              </>
            ) : (
              <>
                <Text style={modalS.label}>Número de tarjeta</Text>
                <TextInput
                  style={modalS.input}
                  value={tarjeta}
                  onChangeText={setTarjeta}
                  keyboardType="number-pad"
                  maxLength={16}
                  placeholder="0000000000000000"
                  placeholderTextColor={COLORS.textSub}
                />
              </>
            )}

            <Text style={modalS.aviso}>
              ⚠️ Tu solicitud será revisada por el administrador. El monto se bloquea hasta que
              sea aprobada o rechazada.
            </Text>

            <NeonWrapper
              color={COLORS.accentGlow}
              borderRadius={12}
              shadowRadius={12}
              opacity={1}
              style={{ marginTop: 20 }}
            >
              <TouchableOpacity
                style={[modalS.btnEnviar, sending && { opacity: 0.6 }]}
                onPress={handleEnviar}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={modalS.btnEnviarTexto}>Enviar solicitud</Text>
                  </>
                )}
              </TouchableOpacity>
            </NeonWrapper>
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalS = StyleSheet.create({
  overlay:           { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:             { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  handle:            { width: 40, height: 4, backgroundColor: COLORS.cardBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo:            { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  saldoInfo:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenDim, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,229,160,0.2)' },
  saldoInfoText:     { color: COLORS.textSub, fontSize: 13 },
  label:             { color: COLORS.textSub, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  input:             { backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 15 },
  inputMontoWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 12 },
  inputMontoPeso:    { color: COLORS.accent, fontSize: 22, fontWeight: '900', marginRight: 4 },
  inputMonto:        { flex: 1, color: COLORS.text, fontSize: 28, fontWeight: '900', paddingVertical: 10 },
  toggleRow:         { flexDirection: 'row', marginTop: 14, marginBottom: 2, gap: 8 },
  toggleBtn:         { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.cardBorder, alignItems: 'center' },
  toggleActivo:      { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  toggleTexto:       { color: COLORS.textSub, fontWeight: '700' },
  toggleTextoActivo: { color: COLORS.accent },
  aviso:             { color: COLORS.textSub, fontSize: 11, lineHeight: 16, marginTop: 16, padding: 10, backgroundColor: COLORS.orangeDim, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,179,64,0.2)' },
  btnEnviar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accent, borderRadius: 12, padding: 16 },
  btnEnviarTexto:    { color: '#fff', fontWeight: '800', fontSize: 16 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function BilleteraScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const [tab, setTab] = useState<'movimientos' | 'retiros'>('movimientos');

  const {
    saldo, movimientos, retiros, loading, refreshing,
    modalVisible, cargar, onRefresh, solicitarRetiro, setModalVisible,
  } = useBilletera(user?.id);

  // Carga inicial
  useEffect(() => { cargar(); }, [cargar]);

  // Refresco silencioso al volver a la pestaña
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  const disponible = saldo?.disponible ?? 0;
  const enRetiro   = saldo?.en_retiro  ?? 0;
  const total      = disponible + enRetiro;
  const pendientes = retiros.filter(r => r.estado === 'pendiente').length;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <ScrollView
        style={s.scroll}
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
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.headerTitle}>💰 Mi Billetera</Text>
        </View>

        {/* Tarjeta de saldo */}
        <NeonWrapper
          color={COLORS.accentGlow}
          borderRadius={20}
          shadowRadius={18}
          opacity={1}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        >
          <View style={s.saldoCard}>
            <Text style={s.saldoLabel}>Saldo total</Text>
            <Text style={s.saldoTotal}>${total.toFixed(2)}</Text>

            <View style={s.saldoDesglose}>
              <View style={s.saldoItem}>
                <View style={[s.saldoDot, { backgroundColor: COLORS.green }]} />
                <View>
                  <Text style={s.saldoItemLabel}>Disponible</Text>
                  <Text style={[s.saldoItemMonto, { color: COLORS.green }]}>
                    ${disponible.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={s.saldoDivider} />
              <View style={s.saldoItem}>
                <View style={[s.saldoDot, { backgroundColor: COLORS.orange }]} />
                <View>
                  <Text style={s.saldoItemLabel}>En retiro</Text>
                  <Text style={[s.saldoItemMonto, { color: COLORS.orange }]}>
                    ${enRetiro.toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>

            <NeonWrapper
              color={disponible > 0 ? COLORS.accentGlow : 'transparent'}
              borderRadius={12}
              shadowRadius={disponible > 0 ? 12 : 0}
              opacity={disponible > 0 ? 1 : 0}
            >
              <TouchableOpacity
                style={[s.btnRetirar, disponible <= 0 && s.btnRetirarDisabled]}
                onPress={() => setModalVisible(true)}
                disabled={disponible <= 0}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up-circle" size={18} color="#fff" />
                <Text style={s.btnRetirarTexto}>Solicitar retiro</Text>
              </TouchableOpacity>
            </NeonWrapper>
          </View>
        </NeonWrapper>

        {/* Tabs */}
        <View style={s.tabsRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'movimientos' && s.tabActivo]}
            onPress={() => setTab('movimientos')}
          >
            <Ionicons name="list" size={14} color={tab === 'movimientos' ? COLORS.accent : COLORS.textSub} />
            <Text style={[s.tabTexto, tab === 'movimientos' && s.tabTextoActivo]}>Movimientos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'retiros' && s.tabActivo]}
            onPress={() => setTab('retiros')}
          >
            <Ionicons name="time" size={14} color={tab === 'retiros' ? COLORS.accent : COLORS.textSub} />
            <Text style={[s.tabTexto, tab === 'retiros' && s.tabTextoActivo]}>Retiros</Text>
            {pendientes > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTexto}>{pendientes}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Tab: Movimientos ── */}
        {tab === 'movimientos' && (
          <View style={s.lista}>
            {movimientos.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>📭</Text>
                <Text style={s.emptyTexto}>Sin movimientos aún</Text>
                <Text style={s.emptyHint}>Aquí aparecerán depósitos, premios y retiros</Text>
              </View>
            ) : (
              movimientos.map(m => {
                const info     = movimientoConfig(m.tipo as any);
                const positivo = m.monto >= 0;
                return (
                  <View key={m.id} style={s.movRow}>
                    <View style={[s.movIconWrap, { backgroundColor: info.color + '18' }]}>
                      <Ionicons name={info.icon as any} size={20} color={info.color} />
                    </View>
                    <View style={s.movInfo}>
                      <Text style={s.movTipo}>{info.label}</Text>
                      {m.descripcion ? (
                        <Text style={s.movDesc} numberOfLines={1}>{m.descripcion}</Text>
                      ) : null}
                      <Text style={s.movFecha}>{formatFecha(m.creado_en)}</Text>
                    </View>
                    <Text style={[s.movMonto, { color: positivo ? COLORS.green : COLORS.red }]}>
                      {formatMonto(m.monto)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Tab: Retiros ── */}
        {tab === 'retiros' && (
          <View style={s.lista}>
            {retiros.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>📭</Text>
                <Text style={s.emptyTexto}>Sin solicitudes de retiro</Text>
              </View>
            ) : (
              retiros.map(r => {
                const cfg   = estadoConfig(r.estado as EstadoRetiro);
                const color = cfg?.color ?? COLORS.orange;
                const glow  = color + '46';
                const label = estadoLabel(r.estado as EstadoRetiro);
                return (
                  <NeonWrapper
                    key={r.id}
                    color={glow}
                    borderRadius={14}
                    shadowRadius={10}
                    opacity={0.8}
                    style={{ marginBottom: 10 }}
                  >
                    <View style={s.retiroCard}>
                      <View style={s.retiroHeaderRow}>
                        <Text style={s.retiroMonto}>${r.monto.toFixed(2)}</Text>
                        <View style={[s.estadoPill, { borderColor: color, backgroundColor: color + '18' }]}>
                          <Text style={[s.estadoTexto, { color }]}>{label}</Text>
                        </View>
                      </View>

                      <View style={s.retiroDatos}>
                        <Text style={s.retiroDato}>
                          <Text style={s.retiroDatoLabel}>Titular: </Text>
                          {r.nombre_titular}
                        </Text>
                        <Text style={s.retiroDato}>
                          <Text style={s.retiroDatoLabel}>Banco: </Text>
                          {r.banco}
                        </Text>
                        {r.clabe && (
                          <Text style={s.retiroDato}>
                            <Text style={s.retiroDatoLabel}>CLABE: </Text>
                            ****{r.clabe.slice(-4)}
                          </Text>
                        )}
                        {r.numero_tarjeta && (
                          <Text style={s.retiroDato}>
                            <Text style={s.retiroDatoLabel}>Tarjeta: </Text>
                            ****{r.numero_tarjeta.slice(-4)}
                          </Text>
                        )}
                      </View>

                      {r.nota_admin ? (
                        <View style={s.notaAdminWrap}>
                          <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.orange} />
                          <Text style={s.retiroNota}>{r.nota_admin}</Text>
                        </View>
                      ) : null}

                      <View style={s.retiroFechas}>
                        <Text style={s.retiroFecha}>Solicitado: {formatFecha(r.creado_en)}</Text>
                        {r.resuelto_en && (
                          <Text style={[s.retiroFecha, { color }]}>
                            Resuelto: {formatFecha(r.resuelto_en)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </NeonWrapper>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
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
  root:               { flex: 1, backgroundColor: COLORS.bg },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  scroll:             { flex: 1 },
  header:             { paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:        { color: COLORS.text, fontSize: 28, fontWeight: 'bold' },
  saldoCard:          { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.25)' },
  saldoLabel:         { color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  saldoTotal:         { color: COLORS.text, fontSize: 44, fontWeight: '900', marginBottom: 16 },
  saldoDesglose:      { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: COLORS.bg, borderRadius: 12, padding: 14, gap: 12 },
  saldoItem:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  saldoDot:           { width: 10, height: 10, borderRadius: 5 },
  saldoItemLabel:     { color: COLORS.textSub, fontSize: 11, fontWeight: '600' },
  saldoItemMonto:     { fontWeight: '800', fontSize: 18 },
  saldoDivider:       { width: 1, height: 36, backgroundColor: COLORS.cardBorder },
  btnRetirar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.accent, borderRadius: 12, padding: 14 },
  btnRetirarDisabled: { backgroundColor: '#1e2a30', opacity: 0.5 },
  btnRetirarTexto:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  tabsRow:            { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  tabActivo:          { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  tabTexto:           { color: COLORS.textSub, fontWeight: '700', fontSize: 13 },
  tabTextoActivo:     { color: COLORS.accent },
  badge:              { backgroundColor: COLORS.orange, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTexto:         { color: '#fff', fontSize: 9, fontWeight: '900' },
  lista:              { marginHorizontal: 16 },
  empty:              { alignItems: 'center', padding: 48 },
  emptyEmoji:         { fontSize: 40, marginBottom: 12 },
  emptyTexto:         { color: COLORS.textSub, fontSize: 14, fontWeight: '700' },
  emptyHint:          { color: COLORS.textSub, fontSize: 12, marginTop: 4, textAlign: 'center' },
  movRow:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  movIconWrap:        { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movInfo:            { flex: 1 },
  movTipo:            { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  movDesc:            { color: COLORS.textSub, fontSize: 12, marginTop: 1 },
  movFecha:           { color: COLORS.textSub, fontSize: 11, marginTop: 2 },
  movMonto:           { fontWeight: '900', fontSize: 16 },
  retiroCard:         { backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.cardBorder },
  retiroHeaderRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  retiroMonto:        { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  estadoPill:         { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoTexto:        { fontSize: 12, fontWeight: '700' },
  retiroDatos:        { gap: 3, marginBottom: 8 },
  retiroDato:         { color: COLORS.textSub, fontSize: 12 },
  retiroDatoLabel:    { color: COLORS.text, fontWeight: '700' },
  notaAdminWrap:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, backgroundColor: COLORS.orangeDim, borderRadius: 8, padding: 8 },
  retiroNota:         { color: COLORS.orange, fontSize: 12, flex: 1 },
  retiroFechas:       { gap: 2, marginTop: 4 },
  retiroFecha:        { color: COLORS.textSub, fontSize: 11 },
});
