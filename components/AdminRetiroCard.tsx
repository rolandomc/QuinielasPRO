/**
 * components/AdminRetiroCard.tsx
 * Tarjeta de solicitud de retiro para la vista admin.
 * Recibe la solicitud y callbacks — no hace fetches propios.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SolicitudRetiro } from '../lib/retiros';
import { estadoColor, estadoLabel, formatFecha } from '../lib/retiros';

const C = {
  bg: '#0a0a15', card: '#131320', cardBorder: '#1c1c30',
  text: '#f0f0ff', textSub: '#7777aa', textMuted: '#44445a',
  green: '#00c897', greenDim: 'rgba(0,200,151,0.12)',
  orange: '#ff9f43', orangeDim: 'rgba(255,159,67,0.12)',
  red: '#ff6b6b', redDim: 'rgba(255,107,107,0.1)',
};

const COLORS = { green: C.green, red: C.red, orange: C.orange };

interface Props {
  retiro: SolicitudRetiro;
  onResolver: (retiro: SolicitudRetiro) => void;
}

export default function AdminRetiroCard({ retiro: r, onResolver }: Props) {
  const eColor = estadoColor(r.estado, COLORS);
  const eLabel = estadoLabel(r.estado);

  return (
    <View style={[s.card, { borderColor: eColor + '30' }]}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>{r.usuarios?.nombre || '—'}</Text>
          <Text style={s.username}>@{r.usuarios?.username || ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.monto, { color: eColor }]}>${r.monto.toFixed(2)}</Text>
          <View style={[s.pill, { borderColor: eColor, backgroundColor: eColor + '18' }]}>
            <Text style={[s.pillTexto, { color: eColor }]}>{eLabel}</Text>
          </View>
        </View>
      </View>

      {/* Datos bancarios */}
      <View style={s.datosBox}>
        <DatoRow icon="person-outline" label="Titular" valor={r.nombre_titular} />
        <DatoRow icon="business-outline" label="Banco" valor={r.banco} />
        {r.clabe && <DatoRow icon="card-outline" label="CLABE" valor={r.clabe} />}
        {r.numero_tarjeta && (
          <DatoRow icon="card-outline" label="Tarjeta" valor={`****${r.numero_tarjeta.slice(-4)}`} />
        )}
      </View>

      {r.nota_admin ? (
        <Text style={s.nota}>💬 {r.nota_admin}</Text>
      ) : null}

      <Text style={s.fecha}>{formatFecha(r.creado_en)}</Text>

      {r.estado === 'pendiente' && (
        <TouchableOpacity
          style={s.btnResolver}
          onPress={() => onResolver(r)}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={15} color={C.orange} />
          <Text style={s.btnResolverTexto}>Revisar y resolver</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DatoRow({ icon, label, valor }: { icon: any; label: string; valor: string }) {
  return (
    <View style={s.datoRow}>
      <Ionicons name={icon} size={13} color={C.textSub} />
      <Text style={s.datoTexto}>
        <Text style={s.datoLabel}>{label}: </Text>{valor}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card:          { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  headerRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nombre:        { color: C.text, fontSize: 16, fontWeight: '800' },
  username:      { color: C.textSub, fontSize: 12, marginTop: 2 },
  monto:         { fontSize: 22, fontWeight: '900', textAlign: 'right' },
  pill:          { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  pillTexto:     { fontSize: 10, fontWeight: '800' },
  datosBox:      { backgroundColor: C.bg, borderRadius: 10, padding: 10, gap: 6, marginBottom: 10 },
  datoRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datoTexto:     { color: C.textSub, fontSize: 12, flex: 1 },
  datoLabel:     { color: C.text, fontWeight: '700' },
  nota:          { color: '#ff9f43', fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  fecha:         { color: C.textMuted, fontSize: 11, marginBottom: 10 },
  btnResolver:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: '#ff9f43', backgroundColor: 'rgba(255,159,67,0.12)' },
  btnResolverTexto: { fontWeight: '700', fontSize: 13, color: '#ff9f43' },
});
