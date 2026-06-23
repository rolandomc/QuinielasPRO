/**
 * components/AdminRetiroCard.tsx
 *
 * Tarjeta de solicitud de retiro para la vista admin.
 * No hace fetches propios — sólo presenta datos y dispara callbacks.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { estadoColor, estadoLabel, formatFecha } from '../features/retiro/retiroUtils';
import type { SolicitudRetiro, EstadoRetiro } from '../types';

// Props tipadas con el tipo central
interface Props {
  retiro: SolicitudRetiro;
  onResolver: (retiro: SolicitudRetiro) => void;
}

// Fila de dato bancario
function DatoRow({ icon, label, valor }: { icon: any; label: string; valor: string }) {
  return (
    <View style={s.datoRow}>
      <Ionicons name={icon} size={13} color={COLORS.textSub} />
      <Text style={s.datoTexto}>
        <Text style={s.datoLabel}>{label}: </Text>
        {valor}
      </Text>
    </View>
  );
}

export default function AdminRetiroCard({ retiro: r, onResolver }: Props) {
  const eColor = estadoColor(r.estado as EstadoRetiro);
  const eLabel = estadoLabel(r.estado as EstadoRetiro);

  // Nombre e usuario vienen del join con la tabla usuarios
  const nombreUsuario   = (r as any).usuarios?.nombre   ?? '—';
  const usernameUsuario = (r as any).usuarios?.username ?? '';

  return (
    <View style={[s.card, { borderColor: eColor + '30' }]}>

      {/* Cabecera: nombre + monto + estado */}
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.nombre}>{nombreUsuario}</Text>
          {usernameUsuario ? (
            <Text style={s.username}>@{usernameUsuario}</Text>
          ) : null}
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
        <DatoRow icon="person-outline"   label="Titular" valor={r.nombre_titular} />
        <DatoRow icon="business-outline" label="Banco"   valor={r.banco} />
        {r.clabe && (
          <DatoRow icon="card-outline" label="CLABE" valor={`****${r.clabe.slice(-4)}`} />
        )}
        {r.numero_tarjeta && (
          <DatoRow icon="card-outline" label="Tarjeta" valor={`****${r.numero_tarjeta.slice(-4)}`} />
        )}
      </View>

      {/* Nota del admin (si existe) */}
      {r.nota_admin ? (
        <View style={s.notaWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.orange} />
          <Text style={s.nota}>{r.nota_admin}</Text>
        </View>
      ) : null}

      {/* Fecha de solicitud */}
      <Text style={s.fecha}>{formatFecha(r.creado_en)}</Text>

      {/* Botón resolver — solo en estado pendiente */}
      {r.estado === 'pendiente' && (
        <TouchableOpacity
          style={s.btnResolver}
          onPress={() => onResolver(r)}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={15} color={COLORS.orange} />
          <Text style={s.btnResolverTexto}>Revisar y resolver</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:             { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  headerRow:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nombre:           { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  username:         { color: COLORS.textSub, fontSize: 12, marginTop: 2 },
  monto:            { fontSize: 22, fontWeight: '900', textAlign: 'right' },
  pill:             { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  pillTexto:        { fontSize: 10, fontWeight: '800' },
  datosBox:         { backgroundColor: COLORS.bg, borderRadius: 10, padding: 10, gap: 6, marginBottom: 10 },
  datoRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  datoTexto:        { color: COLORS.textSub, fontSize: 12, flex: 1 },
  datoLabel:        { color: COLORS.text, fontWeight: '700' },
  notaWrap:         { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: COLORS.orangeDim, borderRadius: 8, padding: 8, marginBottom: 6 },
  nota:             { color: COLORS.orange, fontSize: 12, fontStyle: 'italic', flex: 1 },
  fecha:            { color: COLORS.textMuted, fontSize: 11, marginBottom: 10 },
  btnResolver:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.orange, backgroundColor: COLORS.orangeDim },
  btnResolverTexto: { fontWeight: '700', fontSize: 13, color: COLORS.orange },
});
