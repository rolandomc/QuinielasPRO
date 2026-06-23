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
import { supabase } from '../../lib/supabase';
import NeonWrapper from '../../components/NeonWrapper';

const C = {
  bg: '#0b0b10', card: '#13131a', cardBorder: '#1f1f2e',
  accent: '#00d4ff', accentDim: 'rgba(0,212,255,0.10)', accentGlow: 'rgba(0,212,255,0.25)',
  text: '#f4f4ff', textSub: '#7070a0',
  green: '#00e5a0', greenDim: 'rgba(0,229,160,0.10)', greenGlow: 'rgba(0,229,160,0.28)',
  orange: '#ffb340', orangeDim: 'rgba(255,179,64,0.10)', orangeGlow: 'rgba(255,179,64,0.28)',
  red: '#ff5a6e', redDim: 'rgba(255,90,110,0.10)',
  gold: '#ffd060', goldDim: 'rgba(255,208,96,0.10)', goldGlow: 'rgba(255,208,96,0.28)',
  purple: '#b57bff',
};

type Saldo = { disponible: number; en_retiro: number };
type Movimiento = { id: string; tipo: string; monto: number; descripcion: string | null; creado_en: string };
type SolicitudRetiro = {
  id: string; monto: number; estado: 'pendiente' | 'aprobado' | 'rechazado';
  nombre_titular: string; banco: string; clabe: string | null; numero_tarjeta: string | null;
  nota_admin: string | null; creado_en: string; resuelto_en: string | null;
};

const ICONOS_TIPO: Record<string, { icon: string; color: string; label: string }> = {
  deposito:         { icon: 'arrow-down-circle',  color: C.green,  label: 'Depósito' },
  premio:           { icon: 'trophy',             color: C.gold,   label: 'Premio' },
  retiro:           { icon: 'arrow-up-circle',    color: C.red,    label: 'Retiro' },
  retiro_cancelado: { icon: 'refresh-circle',     color: C.orange, label: 'Retiro devuelto' },
  ajuste_admin:     { icon: 'build',              color: C.purple, label: 'Ajuste' },
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatMonto(monto: number) {
  const positivo = monto >= 0;
  return `${positivo ? '+' : ''}$${Math.abs(monto).toFixed(2)}`;
}

function ModalRetiro({ visible, onClose, onEnviar, saldoDisponible }: {
  visible: boolean; onClose: () => void;
  onEnviar: (datos: any) => Promise<void>; saldoDisponible: number;
}) {
  const [monto, setMonto]         = useState('');
  const [nombre, setNombre]       = useState('');
  const [banco, setBanco]         = useState('');
  const [clabe, setClabe]         = useState('');
  const [tarjeta, setTarjeta]     = useState('');
  const [usarClabe, setUsarClabe] = useState(true);
  const [loading, setLoading]     = useState(false);

  const limpiar = () => { setMonto(''); setNombre(''); setBanco(''); setClabe(''); setTarjeta(''); setUsarClabe(true); };

  const handleEnviar = async () => {
    const montoNum = parseFloat(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) return Alert.alert('Error', 'Ingresa un monto válido.');
    if (montoNum > saldoDisponible) return Alert.alert('Saldo insuficiente', `Tu saldo disponible es $${saldoDisponible.toFixed(2)}`);
    if (!nombre.trim()) return Alert.alert('Error', 'Ingresa el nombre del titular.');
    if (!banco.trim())  return Alert.alert('Error', 'Ingresa el nombre del banco.');
    if (usarClabe && clabe.replace(/\s/g, '').length !== 18) return Alert.alert('Error', 'La CLABE debe tener 18 dígitos.');
    if (!usarClabe && tarjeta.replace(/\s/g, '').length < 16) return Alert.alert('Error', 'El número de tarjeta debe tener al menos 16 dígitos.');
    setLoading(true);
    await onEnviar({ monto: montoNum, nombre_titular: nombre.trim(), banco: banco.trim(), clabe: usarClabe ? clabe.replace(/\s/g, '') : null, numero_tarjeta: !usarClabe ? tarjeta.replace(/\s/g, '') : null });
    setLoading(false);
    limpiar();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={modalS.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={modalS.sheet}>
          <View style={modalS.handle} />
          <View style={modalS.headerRow}>
            <Text style={modalS.titulo}>Solicitar retiro</Text>
            <TouchableOpacity onPress={() => { limpiar(); onClose(); }}>
              <Ionicons name="close" size={24} color={C.textSub} />
            </TouchableOpacity>
          </View>
          <View style={modalS.saldoInfo}>
            <Ionicons name="wallet-outline" size={14} color={C.green} />
            <Text style={modalS.saldoInfoText}>Disponible: <Text style={{ color: C.green, fontWeight: '800' }}>${saldoDisponible.toFixed(2)}</Text></Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={modalS.label}>Monto a retirar</Text>
            <View style={modalS.inputMontoWrap}>
              <Text style={modalS.inputMontoPeso}>$</Text>
              <TextInput style={modalS.inputMonto} value={monto} onChangeText={setMonto} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={C.textSub} />
            </View>
            <Text style={modalS.label}>Nombre completo del titular</Text>
            <TextInput style={modalS.input} value={nombre} onChangeText={setNombre} placeholder="Como aparece en tu cuenta bancaria" placeholderTextColor={C.textSub} autoCapitalize="words" />
            <Text style={modalS.label}>Banco</Text>
            <TextInput style={modalS.input} value={banco} onChangeText={setBanco} placeholder="BBVA, Santander, HSBC..." placeholderTextColor={C.textSub} autoCapitalize="words" />
            <View style={modalS.toggleRow}>
              <TouchableOpacity style={[modalS.toggleBtn, usarClabe && modalS.toggleActivo]} onPress={() => setUsarClabe(true)}>
                <Text style={[modalS.toggleTexto, usarClabe && modalS.toggleTextoActivo]}>CLABE</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[modalS.toggleBtn, !usarClabe && modalS.toggleActivo]} onPress={() => setUsarClabe(false)}>
                <Text style={[modalS.toggleTexto, !usarClabe && modalS.toggleTextoActivo]}>Tarjeta</Text>
              </TouchableOpacity>
            </View>
            {usarClabe ? (
              <><Text style={modalS.label}>CLABE interbancaria (18 dígitos)</Text>
              <TextInput style={modalS.input} value={clabe} onChangeText={setClabe} keyboardType="number-pad" maxLength={18} placeholder="000000000000000000" placeholderTextColor={C.textSub} /></>
            ) : (
              <><Text style={modalS.label}>Número de tarjeta</Text>
              <TextInput style={modalS.input} value={tarjeta} onChangeText={setTarjeta} keyboardType="number-pad" maxLength={16} placeholder="0000000000000000" placeholderTextColor={C.textSub} /></>
            )}
            <Text style={modalS.aviso}>⚠️ Tu solicitud será revisada por el administrador. El monto se bloquea hasta que sea aprobada o rechazada.</Text>
            <NeonWrapper color={C.accentGlow} borderRadius={12} shadowRadius={12} opacity={1} style={{ marginTop: 20 }}>
              <TouchableOpacity style={[modalS.btnEnviar, loading && { opacity: 0.6 }]} onPress={handleEnviar} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="send" size={16} color="#fff" /><Text style={modalS.btnEnviarTexto}>Enviar solicitud</Text></>}
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
  sheet:             { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  handle:            { width: 40, height: 4, backgroundColor: C.cardBorder, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  titulo:            { color: C.text, fontSize: 20, fontWeight: '900' },
  saldoInfo:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenDim, borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0,229,160,0.2)' },
  saldoInfoText:     { color: C.textSub, fontSize: 13 },
  label:             { color: C.textSub, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  input:             { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.cardBorder, borderRadius: 10, padding: 12, color: C.text, fontSize: 15 },
  inputMontoWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.accent, borderRadius: 10, paddingHorizontal: 12 },
  inputMontoPeso:    { color: C.accent, fontSize: 22, fontWeight: '900', marginRight: 4 },
  inputMonto:        { flex: 1, color: C.text, fontSize: 28, fontWeight: '900', paddingVertical: 10 },
  toggleRow:         { flexDirection: 'row', marginTop: 14, marginBottom: 2, gap: 8 },
  toggleBtn:         { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.cardBorder, alignItems: 'center' },
  toggleActivo:      { borderColor: C.accent, backgroundColor: C.accentDim },
  toggleTexto:       { color: C.textSub, fontWeight: '700' },
  toggleTextoActivo: { color: C.accent },
  aviso:             { color: C.textSub, fontSize: 11, lineHeight: 16, marginTop: 16, padding: 10, backgroundColor: C.orangeDim, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,179,64,0.2)' },
  btnEnviar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, padding: 16 },
  btnEnviarTexto:    { color: '#fff', fontWeight: '800', fontSize: 16 },
});

export default function BilleteraScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const [saldo, setSaldo]               = useState<Saldo | null>(null);
  const [movimientos, setMovimientos]   = useState<Movimiento[]>([]);
  const [retiros, setRetiros]           = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [tab, setTab]                   = useState<'movimientos' | 'retiros'>('movimientos');

  const cargar = useCallback(async () => {
    if (!user) return;
    const [{ data: sData }, { data: mData }, { data: rData }] = await Promise.all([
      supabase.from('usuarios').select('saldo').eq('id', user.id).maybeSingle(),
      supabase.from('movimientos').select('*').eq('usuario_id', user.id).order('creado_en', { ascending: false }).limit(50),
      supabase.from('solicitudes_retiro').select('*').eq('usuario_id', user.id).order('creado_en', { ascending: false }),
    ]);
    const enRetiro = (rData || []).filter((r: SolicitudRetiro) => r.estado === 'pendiente').reduce((acc: number, r: SolicitudRetiro) => acc + Number(r.monto), 0);
    const saldoTotal = Number((sData as any)?.saldo ?? 0);
    setSaldo({ disponible: saldoTotal, en_retiro: enRetiro });
    setMovimientos(mData || []);
    setRetiros(rData || []);
  }, [user]);

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)); }, [cargar]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = async () => { setRefreshing(true); await cargar(); setRefreshing(false); };

  const solicitarRetiro = async (datos: any) => {
    if (!user) return;
    const { error } = await supabase.rpc('solicitar_retiro', {
      p_monto: datos.monto, p_nombre_titular: datos.nombre_titular,
      p_banco: datos.banco, p_clabe: datos.clabe ?? null, p_numero_tarjeta: datos.numero_tarjeta ?? null,
    });
    if (error) { Alert.alert('Error', error.message); }
    else {
      Alert.alert('✅ Solicitud enviada', 'Tu solicitud fue recibida. El administrador la revisará pronto.');
      setModalVisible(false);
      await cargar();
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>;

  const disponible = saldo?.disponible ?? 0;
  const enRetiro   = saldo?.en_retiro  ?? 0;
  const total      = disponible + enRetiro;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.headerTitle}>💰 Mi Billetera</Text>
        </View>

        {/* TARJETA DE SALDO — glow cyan */}
        <NeonWrapper color={C.accentGlow} borderRadius={20} shadowRadius={18} opacity={1} style={{ marginHorizontal:16, marginBottom:16 }}>
          <View style={s.saldoCard}>
            <Text style={s.saldoLabel}>Saldo total</Text>
            <Text style={s.saldoTotal}>${total.toFixed(2)}</Text>
            <View style={s.saldoDesglose}>
              <View style={s.saldoItem}>
                <View style={[s.saldoDot, { backgroundColor: C.green }]} />
                <View>
                  <Text style={s.saldoItemLabel}>Disponible</Text>
                  <Text style={[s.saldoItemMonto, { color: C.green }]}>${disponible.toFixed(2)}</Text>
                </View>
              </View>
              <View style={s.saldoDivider} />
              <View style={s.saldoItem}>
                <View style={[s.saldoDot, { backgroundColor: C.orange }]} />
                <View>
                  <Text style={s.saldoItemLabel}>En retiro</Text>
                  <Text style={[s.saldoItemMonto, { color: C.orange }]}>${enRetiro.toFixed(2)}</Text>
                </View>
              </View>
            </View>
            <NeonWrapper color={disponible > 0 ? C.accentGlow : 'transparent'} borderRadius={12} shadowRadius={disponible > 0 ? 12 : 0} opacity={disponible > 0 ? 1 : 0}>
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

        {/* TABS */}
        <View style={s.tabsRow}>
          <TouchableOpacity style={[s.tabBtn, tab === 'movimientos' && s.tabActivo]} onPress={() => setTab('movimientos')}>
            <Ionicons name="list" size={14} color={tab === 'movimientos' ? C.accent : C.textSub} />
            <Text style={[s.tabTexto, tab === 'movimientos' && s.tabTextoActivo]}>Movimientos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, tab === 'retiros' && s.tabActivo]} onPress={() => setTab('retiros')}>
            <Ionicons name="time" size={14} color={tab === 'retiros' ? C.accent : C.textSub} />
            <Text style={[s.tabTexto, tab === 'retiros' && s.tabTextoActivo]}>Retiros</Text>
            {retiros.filter(r => r.estado === 'pendiente').length > 0 && (
              <View style={s.badge}><Text style={s.badgeTexto}>{retiros.filter(r => r.estado === 'pendiente').length}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        {/* MOVIMIENTOS */}
        {tab === 'movimientos' && (
          <View style={s.lista}>
            {movimientos.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyEmoji}>📭</Text>
                <Text style={s.emptyTexto}>Sin movimientos aún</Text>
                <Text style={s.emptyHint}>Aquí aparecerán depósitos, premios y retiros</Text>
              </View>
            ) : movimientos.map(m => {
              const info = ICONOS_TIPO[m.tipo] ?? { icon: 'ellipse', color: C.textSub, label: m.tipo };
              const positivo = m.monto >= 0;
              return (
                <View key={m.id} style={s.movRow}>
                  <View style={[s.movIconWrap, { backgroundColor: info.color + '18' }]}>
                    <Ionicons name={info.icon as any} size={20} color={info.color} />
                  </View>
                  <View style={s.movInfo}>
                    <Text style={s.movTipo}>{info.label}</Text>
                    {m.descripcion ? <Text style={s.movDesc} numberOfLines={1}>{m.descripcion}</Text> : null}
                    <Text style={s.movFecha}>{formatFecha(m.creado_en)}</Text>
                  </View>
                  <Text style={[s.movMonto, { color: positivo ? C.green : C.red }]}>{formatMonto(m.monto)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* RETIROS */}
        {tab === 'retiros' && (
          <View style={s.lista}>
            {retiros.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyEmoji}>📭</Text><Text style={s.emptyTexto}>Sin solicitudes de retiro</Text></View>
            ) : retiros.map(r => {
              const estadoColor = r.estado === 'aprobado' ? C.green : r.estado === 'rechazado' ? C.red : C.orange;
              const estadoGlow  = r.estado === 'aprobado' ? C.greenGlow : r.estado === 'rechazado' ? 'rgba(255,90,110,0.28)' : C.orangeGlow;
              const estadoLabel = r.estado === 'aprobado' ? '✅ Aprobado' : r.estado === 'rechazado' ? '❌ Rechazado' : '⏳ Pendiente';
              return (
                <NeonWrapper key={r.id} color={estadoGlow} borderRadius={14} shadowRadius={10} opacity={0.8} style={{ marginBottom: 10 }}>
                  <View style={s.retiroCard}>
                    <View style={s.retiroHeaderRow}>
                      <Text style={s.retiroMonto}>${r.monto.toFixed(2)}</Text>
                      <View style={[s.estadoPill, { borderColor: estadoColor, backgroundColor: estadoColor + '18' }]}>
                        <Text style={[s.estadoTexto, { color: estadoColor }]}>{estadoLabel}</Text>
                      </View>
                    </View>
                    <View style={s.retiroDatos}>
                      <Text style={s.retiroDato}><Text style={s.retiroDatoLabel}>Titular: </Text>{r.nombre_titular}</Text>
                      <Text style={s.retiroDato}><Text style={s.retiroDatoLabel}>Banco: </Text>{r.banco}</Text>
                      {r.clabe && <Text style={s.retiroDato}><Text style={s.retiroDatoLabel}>CLABE: </Text>****{r.clabe.slice(-4)}</Text>}
                      {r.numero_tarjeta && <Text style={s.retiroDato}><Text style={s.retiroDatoLabel}>Tarjeta: </Text>****{r.numero_tarjeta.slice(-4)}</Text>}
                    </View>
                    {r.nota_admin ? (
                      <View style={s.notaAdminWrap}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color={C.orange} />
                        <Text style={s.retiroNota}>{r.nota_admin}</Text>
                      </View>
                    ) : null}
                    <View style={s.retiroFechas}>
                      <Text style={s.retiroFecha}>Solicitado: {formatFecha(r.creado_en)}</Text>
                      {r.resuelto_en && <Text style={[s.retiroFecha, { color: estadoColor }]}>Resuelto: {formatFecha(r.resuelto_en)}</Text>}
                    </View>
                  </View>
                </NeonWrapper>
              );
            })}
          </View>
        )}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>

      <ModalRetiro visible={modalVisible} onClose={() => setModalVisible(false)} onEnviar={solicitarRetiro} saldoDisponible={disponible} />
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },
  center:             { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  scroll:             { flex: 1 },
  header:             { paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:        { color: C.text, fontSize: 28, fontWeight: 'bold' },
  saldoCard:          { backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: 'rgba(0,212,255,0.25)' },
  saldoLabel:         { color: C.textSub, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  saldoTotal:         { color: C.text, fontSize: 44, fontWeight: '900', marginBottom: 16 },
  saldoDesglose:      { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: C.bg, borderRadius: 12, padding: 14, gap: 12 },
  saldoItem:          { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  saldoDot:           { width: 10, height: 10, borderRadius: 5 },
  saldoItemLabel:     { color: C.textSub, fontSize: 11, fontWeight: '600' },
  saldoItemMonto:     { fontWeight: '800', fontSize: 18 },
  saldoDivider:       { width: 1, height: 36, backgroundColor: C.cardBorder },
  btnRetirar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 12, padding: 14 },
  btnRetirarDisabled: { backgroundColor: '#1e2a30', opacity: 0.5 },
  btnRetirarTexto:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  tabsRow:            { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tabBtn:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: C.cardBorder, backgroundColor: C.card },
  tabActivo:          { borderColor: C.accent, backgroundColor: C.accentDim },
  tabTexto:           { color: C.textSub, fontWeight: '700', fontSize: 13 },
  tabTextoActivo:     { color: C.accent },
  badge:              { backgroundColor: C.orange, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTexto:         { color: '#fff', fontSize: 9, fontWeight: '900' },
  lista:              { marginHorizontal: 16 },
  empty:              { alignItems: 'center', padding: 48 },
  emptyEmoji:         { fontSize: 40, marginBottom: 12 },
  emptyTexto:         { color: C.textSub, fontSize: 14, fontWeight: '700' },
  emptyHint:          { color: C.textSub, fontSize: 12, marginTop: 4, textAlign: 'center' },
  movRow:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  movIconWrap:        { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movInfo:            { flex: 1 },
  movTipo:            { color: C.text, fontWeight: '700', fontSize: 14 },
  movDesc:            { color: C.textSub, fontSize: 12, marginTop: 1 },
  movFecha:           { color: C.textSub, fontSize: 11, marginTop: 2 },
  movMonto:           { fontWeight: '900', fontSize: 16 },
  retiroCard:         { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.cardBorder },
  retiroHeaderRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  retiroMonto:        { color: C.text, fontSize: 22, fontWeight: '900' },
  estadoPill:         { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoTexto:        { fontSize: 12, fontWeight: '700' },
  retiroDatos:        { gap: 3, marginBottom: 8 },
  retiroDato:         { color: C.textSub, fontSize: 12 },
  retiroDatoLabel:    { color: C.text, fontWeight: '700' },
  notaAdminWrap:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8, backgroundColor: C.orangeDim, borderRadius: 8, padding: 8 },
  retiroNota:         { color: C.orange, fontSize: 12, flex: 1 },
  retiroFechas:       { gap: 2, marginTop: 4 },
  retiroFecha:        { color: C.textSub, fontSize: 11 },
});
