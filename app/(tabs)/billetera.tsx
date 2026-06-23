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
import { useTheme } from '../../context/ThemeContext';
import NeonWrapper from '../../components/NeonWrapper';
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
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}
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
              <Text style={{ color: C.green, fontWeight: '800' }}>
                ${saldoDisponible.toFixed(2)}
              </Text>
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[mS.label, { color: C.textSub }]}>Monto a retirar</Text>
            <View style={[mS.inputMontoWrap, { backgroundColor: C.bg, borderColor: C.accent }]}>
              <Text style={[mS.inputMontoPeso, { color: C.accent }]}>$</Text>
              <TextInput
                style={[mS.inputMonto, { color: C.text }]}
                value={monto}
                onChangeText={setMonto}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.textSub}
              />
            </View>

            <Text style={[mS.label, { color: C.textSub }]}>Nombre completo del titular</Text>
            <TextInput
              style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Como aparece en tu cuenta bancaria"
              placeholderTextColor={C.textSub}
              autoCapitalize="words"
            />

            <Text style={[mS.label, { color: C.textSub }]}>Banco</Text>
            <TextInput
              style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
              value={banco}
              onChangeText={setBanco}
              placeholder="BBVA, Santander, HSBC..."
              placeholderTextColor={C.textSub}
              autoCapitalize="words"
            />

            <View style={mS.toggleRow}>
              <TouchableOpacity
                style={[mS.toggleBtn, { borderColor: C.cardBorder }, usarClabe && { borderColor: C.accent, backgroundColor: C.accentDim }]}
                onPress={() => setUsarClabe(true)}
              >
                <Text style={[mS.toggleTexto, { color: C.textSub }, usarClabe && { color: C.accent }]}>
                  CLABE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mS.toggleBtn, { borderColor: C.cardBorder }, !usarClabe && { borderColor: C.accent, backgroundColor: C.accentDim }]}
                onPress={() => setUsarClabe(false)}
              >
                <Text style={[mS.toggleTexto, { color: C.textSub }, !usarClabe && { color: C.accent }]}>
                  Tarjeta
                </Text>
              </TouchableOpacity>
            </View>

            {usarClabe ? (
              <>
                <Text style={[mS.label, { color: C.textSub }]}>CLABE interbancaria (18 dígitos)</Text>
                <TextInput
                  style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
                  value={clabe}
                  onChangeText={setClabe}
                  keyboardType="number-pad"
                  maxLength={18}
                  placeholder="000000000000000000"
                  placeholderTextColor={C.textSub}
                />
              </>
            ) : (
              <>
                <Text style={[mS.label, { color: C.textSub }]}>Número de tarjeta</Text>
                <TextInput
                  style={[mS.input, { backgroundColor: C.bg, borderColor: C.cardBorder, color: C.text }]}
                  value={tarjeta}
                  onChangeText={setTarjeta}
                  keyboardType="number-pad"
                  maxLength={16}
                  placeholder="0000000000000000"
                  placeholderTextColor={C.textSub}
                />
              </>
            )}

            <Text style={[mS.aviso, { color: C.textSub, backgroundColor: C.orangeDim, borderColor: C.orange + '33' }]}>
              ⚠️ Tu solicitud será revisada por el administrador. El monto se bloquea hasta que sea aprobada o rechazada.
            </Text>

            <NeonWrapper
              color={C.accentGlow}
              borderRadius={12}
              shadowRadius={12}
              opacity={1}
              style={{ marginTop: 20 }}
            >
              <TouchableOpacity
                style={[mS.btnEnviar, { backgroundColor: C.accent }, sending && { opacity: 0.6 }]}
                onPress={handleEnviar}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={mS.btnEnviarTexto}>Enviar solicitud</Text>
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

const mS = StyleSheet.create({
  sheet:             { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%', borderTopWidth: 1 },
  handle:            { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo:            { fontSize: 20, fontWeight: '900' },
  saldoInfo:         { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1 },
  saldoInfoText:     { fontSize: 13 },
  label:             { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  input:             { borderWidth: 1.5, borderRadius: 10, padding: 12, fontSize: 15 },
  inputMontoWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12 },
  inputMontoPeso:    { fontSize: 22, fontWeight: '900', marginRight: 4 },
  inputMonto:        { flex: 1, fontSize: 28, fontWeight: '900', paddingVertical: 10 },
  toggleRow:         { flexDirection: 'row', marginTop: 14, marginBottom: 2, gap: 8 },
  toggleBtn:         { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  toggleTexto:       { fontWeight: '700' },
  aviso:             { fontSize: 11, lineHeight: 16, marginTop: 16, padding: 10, borderRadius: 8, borderWidth: 1 },
  btnEnviar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 16 },
  btnEnviarTexto:    { color: '#fff', fontWeight: '800', fontSize: 16 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function BilleteraScreen() {
  // ✅ Fix: usar 'usuario' (no 'user') — AuthContext expone usuario con el perfil de BD
  const { usuario } = useAuth();
  const { colors: C } = useTheme();
  const insets   = useSafeAreaInsets();
  const [tab, setTab] = useState<'movimientos' | 'retiros'>('movimientos');

  // ✅ Fix: pasar usuario?.id (que es el UUID de public.usuarios)
  const {
    saldo, movimientos, retiros, loading, refreshing,
    modalVisible, cargar, onRefresh, solicitarRetiro, setModalVisible,
  } = useBilletera(usuario?.id);

  useEffect(() => { cargar(); }, [cargar]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  const disponible = saldo?.disponible ?? 0;
  const enRetiro   = saldo?.en_retiro  ?? 0;
  const total      = disponible + enRetiro;
  const pendientes = retiros.filter(r => r.estado === 'pendiente').length;

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={C.statusBar === 'light' ? 'light-content' : 'dark-content'} backgroundColor={C.bg} />

      <ScrollView
        style={s.scroll}
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
          <Text style={[s.headerTitle, { color: C.text }]}>💰 Mi Billetera</Text>
        </View>

        {/* Tarjeta de saldo */}
        <NeonWrapper
          color={C.accentGlow}
          borderRadius={20}
          shadowRadius={18}
          opacity={1}
          style={{ marginHorizontal: 16, marginBottom: 16 }}
        >
          <View style={[s.saldoCard, { backgroundColor: C.card, borderColor: C.accent + '40' }]}>
            <Text style={[s.saldoLabel, { color: C.textSub }]}>Saldo total</Text>
            <Text style={[s.saldoTotal, { color: C.text }]}>${total.toFixed(2)}</Text>

            <View style={[s.saldoDesglose, { backgroundColor: C.bg }]}>
              <View style={s.saldoItem}>
                <View style={[s.saldoDot, { backgroundColor: C.green }]} />
                <View>
                  <Text style={[s.saldoItemLabel, { color: C.textSub }]}>Disponible</Text>
                  <Text style={[s.saldoItemMonto, { color: C.green }]}>${disponible.toFixed(2)}</Text>
                </View>
              </View>
              <View style={[s.saldoDivider, { backgroundColor: C.cardBorder }]} />
              <View style={s.saldoItem}>
                <View style={[s.saldoDot, { backgroundColor: C.orange }]} />
                <View>
                  <Text style={[s.saldoItemLabel, { color: C.textSub }]}>En retiro</Text>
                  <Text style={[s.saldoItemMonto, { color: C.orange }]}>${enRetiro.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            <NeonWrapper
              color={disponible > 0 ? C.accentGlow : 'transparent'}
              borderRadius={12}
              shadowRadius={disponible > 0 ? 12 : 0}
              opacity={disponible > 0 ? 1 : 0}
            >
              <TouchableOpacity
                style={[s.btnRetirar, { backgroundColor: C.accent }, disponible <= 0 && s.btnRetirarDisabled]}
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
            style={[s.tabBtn, { borderColor: C.cardBorder, backgroundColor: C.card }, tab === 'movimientos' && { borderColor: C.accent, backgroundColor: C.accentDim }]}
            onPress={() => setTab('movimientos')}
          >
            <Ionicons name="list" size={14} color={tab === 'movimientos' ? C.accent : C.textSub} />
            <Text style={[s.tabTexto, { color: tab === 'movimientos' ? C.accent : C.textSub }]}>Movimientos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, { borderColor: C.cardBorder, backgroundColor: C.card }, tab === 'retiros' && { borderColor: C.accent, backgroundColor: C.accentDim }]}
            onPress={() => setTab('retiros')}
          >
            <Ionicons name="time" size={14} color={tab === 'retiros' ? C.accent : C.textSub} />
            <Text style={[s.tabTexto, { color: tab === 'retiros' ? C.accent : C.textSub }]}>Retiros</Text>
            {pendientes > 0 && (
              <View style={[s.badge, { backgroundColor: C.orange }]}>
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
                <Text style={[s.emptyTexto, { color: C.textSub }]}>Sin movimientos aún</Text>
                <Text style={[s.emptyHint, { color: C.textSub }]}>Aquí aparecerán depósitos, premios y retiros</Text>
              </View>
            ) : (
              movimientos.map(m => {
                const info     = movimientoConfig(m.tipo as any);
                const positivo = m.monto >= 0;
                return (
                  <View key={m.id} style={[s.movRow, { borderBottomColor: C.cardBorder }]}>
                    <View style={[s.movIconWrap, { backgroundColor: info.color + '18' }]}>
                      <Ionicons name={info.icon as any} size={20} color={info.color} />
                    </View>
                    <View style={s.movInfo}>
                      <Text style={[s.movTipo, { color: C.text }]}>{info.label}</Text>
                      {m.descripcion ? (
                        <Text style={[s.movDesc, { color: C.textSub }]} numberOfLines={1}>{m.descripcion}</Text>
                      ) : null}
                      <Text style={[s.movFecha, { color: C.textSub }]}>{formatFecha(m.creado_en)}</Text>
                    </View>
                    <Text style={[s.movMonto, { color: positivo ? C.green : C.red }]}>
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
                <Text style={[s.emptyTexto, { color: C.textSub }]}>Sin solicitudes de retiro</Text>
              </View>
            ) : (
              retiros.map(r => {
                const cfg   = estadoConfig(r.estado as EstadoRetiro);
                const color = cfg?.color ?? C.orange;
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
                    <View style={[s.retiroCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
                      <View style={s.retiroHeaderRow}>
                        <Text style={[s.retiroMonto, { color: C.text }]}>${r.monto.toFixed(2)}</Text>
                        <View style={[s.estadoPill, { borderColor: color, backgroundColor: color + '18' }]}>
                          <Text style={[s.estadoTexto, { color }]}>{label}</Text>
                        </View>
                      </View>

                      <View style={s.retiroDatos}>
                        <Text style={[s.retiroDato, { color: C.textSub }]}>
                          <Text style={[s.retiroDatoLabel, { color: C.text }]}>Titular: </Text>
                          {r.nombre_titular}
                        </Text>
                        <Text style={[s.retiroDato, { color: C.textSub }]}>
                          <Text style={[s.retiroDatoLabel, { color: C.text }]}>Banco: </Text>
                          {r.banco}
                        </Text>
                        {r.clabe && (
                          <Text style={[s.retiroDato, { color: C.textSub }]}>
                            <Text style={[s.retiroDatoLabel, { color: C.text }]}>CLABE: </Text>
                            ****{r.clabe.slice(-4)}
                          </Text>
                        )}
                        {r.numero_tarjeta && (
                          <Text style={[s.retiroDato, { color: C.textSub }]}>
                            <Text style={[s.retiroDatoLabel, { color: C.text }]}>Tarjeta: </Text>
                            ****{r.numero_tarjeta.slice(-4)}
                          </Text>
                        )}
                      </View>

                      {r.nota_admin ? (
                        <View style={[s.notaAdminWrap, { backgroundColor: C.orangeDim }]}>
                          <Ionicons name="chatbubble-ellipses-outline" size={12} color={C.orange} />
                          <Text style={[s.retiroNota, { color: C.orange }]}>{r.nota_admin}</Text>
                        </View>
                      ) : null}

                      <View style={s.retiroFechas}>
                        <Text style={[s.retiroFecha, { color: C.textSub }]}>Solicitado: {formatFecha(r.creado_en)}</Text>
                        {r.resuelto_en && (
                          <Text style={[s.retiroFecha, { color }]}>Resuelto: {formatFecha(r.resuelto_en)}</Text>
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
  root:               { flex: 1 },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:             { flex: 1 },
  header:             { paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:        { fontSize: 28, fontWeight: 'bold' },
  saldoCard:          { borderRadius: 20, padding: 20, borderWidth: 1.5 },
  saldoLabel:         { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  saldoTotal:         { fontSize: 44, fontWeight: '900', marginBottom: 16 },
  saldoDesglose:      { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderRadius: 12, padding: 14, gap: 12 },
  saldoItem:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  saldoDot:           { width: 10, height: 10, borderRadius: 5 },
  saldoItemLabel:     { fontSize: 11, fontWeight: '600' },
  saldoItemMonto:     { fontWeight: '800', fontSize: 18 },
  saldoDivider:       { width: 1, height: 36 },
  btnRetirar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14 },
  btnRetirarDisabled: { opacity: 0.5 },
  btnRetirarTexto:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  tabsRow:            { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5 },
  tabTexto:           { fontWeight: '700', fontSize: 13 },
  badge:              { borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTexto:         { color: '#fff', fontSize: 9, fontWeight: '900' },
  lista:              { marginHorizontal: 16 },
  empty:              { alignItems: 'center', padding: 48 },
  emptyEmoji:         { fontSize: 40, marginBottom: 12 },
  emptyTexto:         { fontSize: 14, fontWeight: '700' },
  emptyHint:          { fontSize: 12, marginTop: 4, textAlign: 'center' },
  movRow:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  movIconWrap:        { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movInfo:            { flex: 1 },
  movTipo:            { fontWeight: '700', fontSize: 14 },
  movDesc:            { fontSize: 12, marginTop: 1 },
  movFecha:           { fontSize: 11, marginTop: 2 },
  movMonto:           { fontWeight: '900', fontSize: 16 },
  retiroCard:         { borderRadius: 14, padding: 14, borderWidth: 1 },
  retiroHeaderRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  retiroMonto:        { fontSize: 22, fontWeight: '900' },
  estadoPill:         { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoTexto:        { fontSize: 12, fontWeight: '700' },
  retiroDatos:        { gap: 3, marginBottom: 8 },
  retiroDato:         { fontSize: 12 },
  retiroDatoLabel:    { fontWeight: '700' },
  notaAdminWrap:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, borderRadius: 8, padding: 8 },
  retiroNota:         { fontSize: 12, flex: 1 },
  retiroFechas:       { gap: 2, marginTop: 4 },
  retiroFecha:        { fontSize: 11 },
});
