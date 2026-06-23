/**
 * app/solicitar-retiro.tsx
 *
 * Pantalla de usuario para solicitar un retiro de saldo.
 * Consume useBilletera() — no hace queries directas a Supabase.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StatusBar, Platform,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../constants/colors';
import { useBilletera } from '../features/retiro/useBilletera';

const BANCOS = [
  'BBVA', 'Santander', 'Banamex', 'Banorte', 'HSBC',
  'Scotiabank', 'Inbursa', 'Afirme', 'Bajío', 'Otro',
];

const avisar = (titulo: string, msg: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${msg}`);
  else { const { Alert } = require('react-native'); Alert.alert(titulo, msg); }
};

export default function SolicitarRetiroScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Todo el estado de datos viene del hook — saldo, pendiente, enviar
  const { saldo, tienePendiente, loading, enviarSolicitud } = useBilletera();

  // Estado local de UI del formulario
  const [enviando,    setEnviando]    = useState(false);
  const [exito,       setExito]       = useState(false);
  const [monto,       setMonto]       = useState('');
  const [titular,     setTitular]     = useState('');
  const [banco,       setBanco]       = useState('');
  const [modoDest,    setModoDest]    = useState<'clabe' | 'tarjeta'>('clabe');
  const [clabe,       setClabe]       = useState('');
  const [tarjeta,     setTarjeta]     = useState('');
  const [modalBancos, setModalBancos] = useState(false);

  // Validaciones
  const montoNum      = parseFloat(monto.replace(',', '.')) || 0;
  const clabeValida   = clabe.replace(/\s/g, '').length === 18;
  const tarjetaValida = tarjeta.replace(/\s/g, '').length >= 16;
  const destValido    = modoDest === 'clabe' ? clabeValida : tarjetaValida;
  const formValido    = montoNum > 0 && montoNum <= saldo && titular.trim().length > 2 && banco.length > 0 && destValido;

  const enviar = async () => {
    if (!formValido) return;
    setEnviando(true);
    try {
      await enviarSolicitud({
        monto: montoNum,
        nombre_titular: titular.trim(),
        banco,
        clabe:          modoDest === 'clabe'    ? clabe.replace(/\s/g, '')   : undefined,
        numero_tarjeta: modoDest === 'tarjeta'  ? tarjeta.replace(/\s/g, '') : undefined,
      });
      setExito(true);
    } catch (e: any) {
      avisar('Error', e.message ?? 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator color={COLORS.accent} size="large" />
    </View>
  );

  // ── Éxito ──────────────────────────────────────────────────────────────────
  if (exito) return (
    <View style={[s.center, { paddingHorizontal: 32 }]}>
      <Ionicons name="checkmark-circle" size={72} color={COLORS.green} />
      <Text style={s.exitoTitulo}>\u00a1Solicitud enviada!</Text>
      <Text style={s.exitoSub}>
        El administrador revisará tu solicitud y realizará la transferencia.{' '}
        Te notificaremos cuando sea procesada.
      </Text>
      <TouchableOpacity style={s.btnVolver} onPress={() => router.back()}>
        <Text style={s.btnVolverTexto}>Volver</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Formulario principal ───────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.headerBack} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={s.headerTitulo}>Solicitar retiro</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Saldo disponible */}
          <View style={s.saldoCard}>
            <Text style={s.saldoLabel}>Saldo disponible</Text>
            <Text style={[s.saldoVal, { color: saldo > 0 ? COLORS.green : COLORS.textSub }]}>
              ${saldo.toFixed(2)}{' '}<Text style={{ fontSize: 16 }}>MXN</Text>
            </Text>
            {saldo <= 0 && (
              <Text style={s.saldoCero}>No tienes saldo disponible para retirar.</Text>
            )}
          </View>

          {/* Alerta de solicitud pendiente */}
          {tienePendiente && (
            <View style={s.alertaPendiente}>
              <Ionicons name="time-outline" size={18} color={COLORS.orange} />
              <Text style={s.alertaTexto}>
                Ya tienes una solicitud pendiente. Espera a que sea procesada antes de hacer otra.
              </Text>
            </View>
          )}

          {/* Formulario — solo si no hay pendiente y hay saldo */}
          {!tienePendiente && saldo > 0 && (
            <>
              {/* Monto */}
              <Text style={s.label}>Monto a retirar (MXN)</Text>
              <View style={s.montoRow}>
                <TextInput
                  style={[s.inputGrande, { flex: 1 }, montoNum > saldo && { borderColor: COLORS.red }]}
                  value={monto} onChangeText={setMonto}
                  keyboardType="decimal-pad" placeholder="0.00"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TouchableOpacity style={s.btnMax} onPress={() => setMonto(saldo.toFixed(2))}>
                  <Text style={s.btnMaxTexto}>MAX</Text>
                </TouchableOpacity>
              </View>
              {montoNum > saldo && (
                <Text style={s.errorTexto}>El monto supera tu saldo disponible.</Text>
              )}

              {/* Titular */}
              <Text style={s.label}>Nombre del titular de la cuenta</Text>
              <TextInput
                style={s.input} value={titular} onChangeText={setTitular}
                placeholder="Como aparece en tu tarjeta/cuenta"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="words"
              />

              {/* Banco */}
              <Text style={s.label}>Banco</Text>
              <TouchableOpacity style={s.selectorBanco} onPress={() => setModalBancos(true)}>
                <Text style={[s.selectorBancoTexto, !banco && { color: COLORS.textMuted }]}>
                  {banco || 'Selecciona tu banco'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textSub} />
              </TouchableOpacity>

              {/* Destino: CLABE o Tarjeta */}
              <Text style={s.label}>Destino del pago</Text>
              <View style={s.destinoTabs}>
                {(['clabe', 'tarjeta'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.destinoTab, modoDest === m && s.destinoTabActivo]}
                    onPress={() => setModoDest(m)}
                  >
                    <Ionicons
                      name={m === 'clabe' ? 'swap-horizontal-outline' : 'card-outline'}
                      size={15}
                      color={modoDest === m ? COLORS.accent : COLORS.textSub}
                    />
                    <Text style={[s.destinoTabTexto, modoDest === m && { color: COLORS.accent }]}>
                      {m === 'clabe' ? 'CLABE' : 'Tarjeta'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {modoDest === 'clabe' ? (
                <>
                  <TextInput
                    style={[s.input, clabe.replace(/\s/g, '').length > 0 && !clabeValida && { borderColor: COLORS.red }]}
                    value={clabe} onChangeText={setClabe}
                    placeholder="18 dígitos" placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad" maxLength={18}
                  />
                  {clabe.replace(/\s/g, '').length > 0 && !clabeValida && (
                    <Text style={s.errorTexto}>La CLABE debe tener 18 dígitos.</Text>
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    style={[s.input, tarjeta.replace(/\s/g, '').length > 0 && !tarjetaValida && { borderColor: COLORS.red }]}
                    value={tarjeta} onChangeText={setTarjeta}
                    placeholder="16 dígitos" placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad" maxLength={16}
                  />
                  {tarjeta.replace(/\s/g, '').length > 0 && !tarjetaValida && (
                    <Text style={s.errorTexto}>El número de tarjeta debe tener al menos 16 dígitos.</Text>
                  )}
                </>
              )}

              {/* Resumen previo al envío */}
              {formValido && (
                <View style={s.resumenCard}>
                  <Text style={s.resumenTitulo}>Resumen de la solicitud</Text>
                  <ResumenRow label="Monto"    valor={`$${montoNum.toFixed(2)} MXN`} resaltado />
                  <ResumenRow label="Titular"  valor={titular} />
                  <ResumenRow label="Banco"    valor={banco} />
                  <ResumenRow
                    label={modoDest === 'clabe' ? 'CLABE' : 'Tarjeta'}
                    valor={modoDest === 'clabe' ? `****${clabe.slice(-4)}` : `****${tarjeta.slice(-4)}`}
                  />
                </View>
              )}

              {/* Botón enviar */}
              <TouchableOpacity
                style={[s.btnEnviar, (!formValido || enviando) && { opacity: 0.4 }]}
                onPress={enviar} disabled={!formValido || enviando} activeOpacity={0.85}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={s.btnEnviarTexto}>Enviar solicitud</Text>
                    </>
                  )
                }
              </TouchableOpacity>

              <Text style={s.aviso}>
                ⚠️ Al enviar, el monto se reserva de tu saldo. Si el admin rechaza la solicitud, el saldo se devuelve automáticamente.
              </Text>
            </>
          )}
        </ScrollView>

        {/* Modal selección de banco */}
        <Modal visible={modalBancos} transparent animationType="slide" onRequestClose={() => setModalBancos(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitulo}>Selecciona tu banco</Text>
                <TouchableOpacity onPress={() => setModalBancos(false)}>
                  <Ionicons name="close" size={22} color={COLORS.textSub} />
                </TouchableOpacity>
              </View>
              {BANCOS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[s.bancoOpcion, banco === b && { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent }]}
                  onPress={() => { setBanco(b); setModalBancos(false); }}
                >
                  <Text style={[s.bancoOpcionTexto, banco === b && { color: COLORS.accent }]}>{b}</Text>
                  {banco === b && <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

// Fila del resumen de solicitud
function ResumenRow({ label, valor, resaltado }: { label: string; valor: string; resaltado?: boolean }) {
  return (
    <View style={s.resumenRow}>
      <Text style={s.resumenLabel}>{label}</Text>
      <Text style={[s.resumenVal, resaltado && { color: COLORS.gold }]}>{valor}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: COLORS.bg },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  headerBack:         { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitulo:       { fontSize: 17, fontWeight: '700', color: COLORS.text, flex: 1, textAlign: 'center' },
  saldoCard:          { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 20, alignItems: 'center', marginBottom: 16 },
  saldoLabel:         { color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  saldoVal:           { fontSize: 36, fontWeight: '900' },
  saldoCero:          { color: COLORS.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' },
  alertaPendiente:    { flexDirection: 'row', gap: 10, backgroundColor: COLORS.orangeDim, borderRadius: 12, borderWidth: 1, borderColor: COLORS.orange + '50', padding: 14, marginBottom: 16, alignItems: 'flex-start' },
  alertaTexto:        { color: COLORS.orange, fontSize: 13, flex: 1, lineHeight: 18 },
  label:              { color: COLORS.textSub, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:              { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: 12, padding: 14, color: COLORS.text, fontSize: 15, marginBottom: 4 },
  inputGrande:        { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: 12, padding: 16, color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  montoRow:           { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 4 },
  btnMax:             { backgroundColor: COLORS.accentDim, borderRadius: 10, borderWidth: 1, borderColor: COLORS.accent, paddingHorizontal: 14, paddingVertical: 14 },
  btnMaxTexto:        { color: COLORS.accent, fontSize: 12, fontWeight: '800' },
  errorTexto:         { color: COLORS.red, fontSize: 11, marginBottom: 4, marginTop: -2 },
  selectorBanco:      { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.cardBorder, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  selectorBancoTexto: { color: COLORS.text, fontSize: 15 },
  destinoTabs:        { flexDirection: 'row', gap: 10, marginBottom: 10 },
  destinoTab:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.cardBorder, backgroundColor: COLORS.card },
  destinoTabActivo:   { borderColor: COLORS.accent, backgroundColor: COLORS.accentDim },
  destinoTabTexto:    { color: COLORS.textSub, fontSize: 13, fontWeight: '700' },
  resumenCard:        { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginTop: 16, marginBottom: 4, gap: 8 },
  resumenTitulo:      { color: COLORS.textSub, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  resumenRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumenLabel:       { color: COLORS.textSub, fontSize: 13 },
  resumenVal:         { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  btnEnviar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 20 },
  btnEnviarTexto:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  aviso:              { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  exitoTitulo:        { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 16, marginBottom: 10 },
  exitoSub:           { color: COLORS.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  btnVolver:          { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnVolverTexto:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:          { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: COLORS.cardBorder },
  modalHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitulo:        { fontSize: 16, fontWeight: '800', color: COLORS.text },
  bancoOpcion:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginBottom: 4 },
  bancoOpcionTexto:   { color: COLORS.text, fontSize: 15 },
});
