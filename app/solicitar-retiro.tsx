import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StatusBar, Platform,
  KeyboardAvoidingView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const C = {
  bg: '#0a0a15', card: '#131320', cardBorder: '#1c1c30',
  accent: '#00b4d8', accentDim: 'rgba(0,180,216,0.1)',
  text: '#f0f0ff', textSub: '#7777aa', textMuted: '#44445a',
  green: '#00c897', greenDim: 'rgba(0,200,151,0.12)',
  orange: '#ff9f43', orangeDim: 'rgba(255,159,67,0.12)',
  red: '#ff6b6b', redDim: 'rgba(255,107,107,0.1)',
  gold: '#ffd700',
};

const BANCOS = [
  'BBVA', 'Santander', 'Banamex', 'Banorte', 'HSBC',
  'Scotiabank', 'Inbursa', 'Afirme', 'Bajío', 'Otro',
];

const avisar = (titulo: string, msg: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${msg}`);
  else { const { Alert } = require('react-native'); Alert.alert(titulo, msg); }
};

export default function SolicitarRetiroScreen() {
  const { usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [saldo, setSaldo] = useState<number>(0);
  const [pendiente, setPendiente] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  // Formulario
  const [monto, setMonto] = useState('');
  const [titular, setTitular] = useState('');
  const [banco, setBanco] = useState('');
  const [modoDest, setModoDest] = useState<'clabe' | 'tarjeta'>('clabe');
  const [clabe, setClabe] = useState('');
  const [tarjeta, setTarjeta] = useState('');
  const [modalBancos, setModalBancos] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [{ data: u }, { data: sol }] = await Promise.all([
      supabase.from('usuarios').select('saldo').eq('id', usuario!.id).single(),
      supabase.from('solicitudes_retiro')
        .select('id').eq('usuario_id', usuario!.id).eq('estado', 'pendiente').limit(1),
    ]);
    setSaldo(u?.saldo ?? 0);
    setPendiente((sol?.length ?? 0) > 0);
    setLoading(false);
  };

  const montoNum = parseFloat(monto.replace(',', '.')) || 0;
  const clabeValida = clabe.replace(/\s/g, '').length === 18;
  const tarjetaValida = tarjeta.replace(/\s/g, '').length >= 16;
  const destValido = modoDest === 'clabe' ? clabeValida : tarjetaValida;
  const formValido = montoNum > 0 && montoNum <= saldo && titular.trim().length > 2 && banco.length > 0 && destValido;

  const enviar = async () => {
    if (!formValido) return;
    setEnviando(true);
    const { error } = await supabase.rpc('solicitar_retiro', {
      p_monto: montoNum,
      p_nombre_titular: titular.trim(),
      p_banco: banco,
      p_clabe: modoDest === 'clabe' ? clabe.replace(/\s/g, '') : null,
      p_numero_tarjeta: modoDest === 'tarjeta' ? tarjeta.replace(/\s/g, '') : null,
    });
    setEnviando(false);
    if (error) {
      avisar('Error', error.message);
    } else {
      setExito(true);
      await cargar();
    }
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
  );

  if (exito) return (
    <View style={[s.center, { paddingHorizontal: 32 }]}>
      <Text style={{ fontSize: 56 }}>✅</Text>
      <Text style={s.exitoTitulo}>¡Solicitud enviada!</Text>
      <Text style={s.exitoSub}>El administrador revisará tu solicitud y realizará la transferencia. Te notificaremos cuando sea procesada.</Text>
      <TouchableOpacity style={s.btnVolver} onPress={() => router.back()}>
        <Text style={s.btnVolverTexto}>Volver</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity style={s.headerBack} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={C.text} />
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
          {/* SALDO CARD */}
          <View style={s.saldoCard}>
            <Text style={s.saldoLabel}>Saldo disponible</Text>
            <Text style={[s.saldoVal, { color: saldo > 0 ? C.green : C.textSub }]}>
              ${saldo.toFixed(2)} <Text style={{ fontSize: 16 }}>MXN</Text>
            </Text>
            {saldo <= 0 && (
              <Text style={s.saldoCero}>No tienes saldo disponible para retirar.</Text>
            )}
          </View>

          {/* ALERTA PENDIENTE */}
          {pendiente && (
            <View style={s.alertaPendiente}>
              <Ionicons name="time-outline" size={18} color={C.orange} />
              <Text style={s.alertaTexto}>Ya tienes una solicitud pendiente. Espera a que sea procesada antes de hacer otra.</Text>
            </View>
          )}

          {!pendiente && saldo > 0 && (
            <>
              {/* MONTO */}
              <Text style={s.label}>Monto a retirar (MXN)</Text>
              <View style={s.montoRow}>
                <TextInput
                  style={[s.inputGrande, { flex: 1 }, montoNum > saldo && { borderColor: C.red }]}
                  value={monto}
                  onChangeText={setMonto}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={C.textMuted}
                />
                <TouchableOpacity
                  style={s.btnMax}
                  onPress={() => setMonto(saldo.toFixed(2))}
                >
                  <Text style={s.btnMaxTexto}>MAX</Text>
                </TouchableOpacity>
              </View>
              {montoNum > saldo && (
                <Text style={s.errorTexto}>El monto supera tu saldo disponible.</Text>
              )}

              {/* TITULAR */}
              <Text style={s.label}>Nombre del titular de la cuenta</Text>
              <TextInput
                style={s.input}
                value={titular}
                onChangeText={setTitular}
                placeholder="Como aparece en tu tarjeta/cuenta"
                placeholderTextColor={C.textMuted}
                autoCapitalize="words"
              />

              {/* BANCO */}
              <Text style={s.label}>Banco</Text>
              <TouchableOpacity style={s.selectorBanco} onPress={() => setModalBancos(true)}>
                <Text style={[s.selectorBancoTexto, !banco && { color: C.textMuted }]}>
                  {banco || 'Selecciona tu banco'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={C.textSub} />
              </TouchableOpacity>

              {/* DESTINO */}
              <Text style={s.label}>Destino del pago</Text>
              <View style={s.destinoTabs}>
                <TouchableOpacity
                  style={[s.destinoTab, modoDest === 'clabe' && s.destinoTabActivo]}
                  onPress={() => setModoDest('clabe')}
                >
                  <Ionicons name="swap-horizontal-outline" size={15} color={modoDest === 'clabe' ? C.accent : C.textSub} />
                  <Text style={[s.destinoTabTexto, modoDest === 'clabe' && { color: C.accent }]}>CLABE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.destinoTab, modoDest === 'tarjeta' && s.destinoTabActivo]}
                  onPress={() => setModoDest('tarjeta')}
                >
                  <Ionicons name="card-outline" size={15} color={modoDest === 'tarjeta' ? C.accent : C.textSub} />
                  <Text style={[s.destinoTabTexto, modoDest === 'tarjeta' && { color: C.accent }]}>Tarjeta</Text>
                </TouchableOpacity>
              </View>

              {modoDest === 'clabe' ? (
                <>
                  <TextInput
                    style={[s.input, clabe.replace(/\s/g,'').length > 0 && !clabeValida && { borderColor: C.red }]}
                    value={clabe}
                    onChangeText={setClabe}
                    placeholder="18 dígitos"
                    placeholderTextColor={C.textMuted}
                    keyboardType="number-pad"
                    maxLength={18}
                  />
                  {clabe.replace(/\s/g,'').length > 0 && !clabeValida && (
                    <Text style={s.errorTexto}>La CLABE debe tener 18 dígitos.</Text>
                  )}
                </>
              ) : (
                <>
                  <TextInput
                    style={[s.input, tarjeta.replace(/\s/g,'').length > 0 && !tarjetaValida && { borderColor: C.red }]}
                    value={tarjeta}
                    onChangeText={setTarjeta}
                    placeholder="16 dígitos"
                    placeholderTextColor={C.textMuted}
                    keyboardType="number-pad"
                    maxLength={16}
                  />
                  {tarjeta.replace(/\s/g,'').length > 0 && !tarjetaValida && (
                    <Text style={s.errorTexto}>El número de tarjeta debe tener al menos 16 dígitos.</Text>
                  )}
                </>
              )}

              {/* RESUMEN */}
              {formValido && (
                <View style={s.resumenCard}>
                  <Text style={s.resumenTitulo}>Resumen de la solicitud</Text>
                  <View style={s.resumenRow}><Text style={s.resumenLabel}>Monto</Text><Text style={[s.resumenVal, { color: C.gold }]}>${montoNum.toFixed(2)} MXN</Text></View>
                  <View style={s.resumenRow}><Text style={s.resumenLabel}>Titular</Text><Text style={s.resumenVal}>{titular}</Text></View>
                  <View style={s.resumenRow}><Text style={s.resumenLabel}>Banco</Text><Text style={s.resumenVal}>{banco}</Text></View>
                  <View style={s.resumenRow}>
                    <Text style={s.resumenLabel}>{modoDest === 'clabe' ? 'CLABE' : 'Tarjeta'}</Text>
                    <Text style={s.resumenVal}>
                      {modoDest === 'clabe'
                        ? `****${clabe.slice(-4)}`
                        : `****${tarjeta.slice(-4)}`
                      }
                    </Text>
                  </View>
                </View>
              )}

              {/* BOTÓN ENVIAR */}
              <TouchableOpacity
                style={[s.btnEnviar, (!formValido || enviando) && { opacity: 0.4 }]}
                onPress={enviar}
                disabled={!formValido || enviando}
                activeOpacity={0.85}
              >
                {enviando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="send" size={18} color="#fff" /><Text style={s.btnEnviarTexto}>Enviar solicitud</Text></>
                }
              </TouchableOpacity>

              <Text style={s.aviso}>
                ⚠️ Al enviar, el monto se reserva de tu saldo. Si el admin rechaza la solicitud, el saldo se devuelve automáticamente.
              </Text>
            </>
          )}
        </ScrollView>

        {/* MODAL BANCOS */}
        <Modal visible={modalBancos} transparent animationType="slide" onRequestClose={() => setModalBancos(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitulo}>Selecciona tu banco</Text>
                <TouchableOpacity onPress={() => setModalBancos(false)}>
                  <Ionicons name="close" size={22} color={C.textSub} />
                </TouchableOpacity>
              </View>
              {BANCOS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[s.bancoOpcion, banco === b && { backgroundColor: C.accentDim, borderColor: C.accent }]}
                  onPress={() => { setBanco(b); setModalBancos(false); }}
                >
                  <Text style={[s.bancoOpcionTexto, banco === b && { color: C.accent }]}>{b}</Text>
                  {banco === b && <Ionicons name="checkmark-circle" size={18} color={C.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: C.bg },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  headerBack:        { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitulo:      { fontSize: 17, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' },
  saldoCard:         { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder, padding: 20, alignItems: 'center', marginBottom: 16 },
  saldoLabel:        { color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  saldoVal:          { fontSize: 36, fontWeight: '900' },
  saldoCero:         { color: C.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' },
  alertaPendiente:   { flexDirection: 'row', gap: 10, backgroundColor: C.orangeDim, borderRadius: 12, borderWidth: 1, borderColor: C.orange + '50', padding: 14, marginBottom: 16, alignItems: 'flex-start' },
  alertaTexto:       { color: C.orange, fontSize: 13, flex: 1, lineHeight: 18 },
  label:             { color: C.textSub, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:             { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 12, padding: 14, color: C.text, fontSize: 15, marginBottom: 4 },
  inputGrande:       { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 12, padding: 16, color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  montoRow:          { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 4 },
  btnMax:            { backgroundColor: C.accentDim, borderRadius: 10, borderWidth: 1, borderColor: C.accent, paddingHorizontal: 14, paddingVertical: 14 },
  btnMaxTexto:       { color: C.accent, fontSize: 12, fontWeight: '800' },
  errorTexto:        { color: C.red, fontSize: 11, marginBottom: 4, marginTop: -2 },
  selectorBanco:     { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  selectorBancoTexto:{ color: C.text, fontSize: 15 },
  destinoTabs:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  destinoTab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.card },
  destinoTabActivo:  { borderColor: C.accent, backgroundColor: C.accentDim },
  destinoTabTexto:   { color: C.textSub, fontSize: 13, fontWeight: '700' },
  resumenCard:       { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, padding: 16, marginTop: 16, marginBottom: 4, gap: 8 },
  resumenTitulo:     { color: C.textSub, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  resumenRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resumenLabel:      { color: C.textSub, fontSize: 13 },
  resumenVal:        { color: C.text, fontSize: 13, fontWeight: '700' },
  btnEnviar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 16, marginTop: 20 },
  btnEnviarTexto:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  aviso:             { color: C.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  exitoTitulo:       { color: C.text, fontSize: 24, fontWeight: '900', marginTop: 16, marginBottom: 10 },
  exitoSub:          { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  btnVolver:         { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  btnVolverTexto:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:         { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderTopWidth: 1, borderColor: C.cardBorder },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitulo:       { fontSize: 16, fontWeight: '800', color: C.text },
  bancoOpcion:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginBottom: 4 },
  bancoOpcionTexto:  { color: C.text, fontSize: 15 },
});
