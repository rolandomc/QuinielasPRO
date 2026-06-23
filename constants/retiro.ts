/**
 * constants/retiro.ts
 * Configuración y metadatos de negocio para solicitudes de retiro.
 * Centraliza límites, estados y etiquetas que antes estaban dispersos
 * entre billetera.tsx, admin/retiros.tsx y lib/retiros.ts.
 */

import { COLORS } from './colors';
import type { EstadoRetiro, TipoMovimiento } from '../types';

// ── Límites de monto ────────────────────────────────────────────────────────
export const RETIRO_MIN_MONTO = 50;     // Mínimo en MXN
export const RETIRO_MAX_MONTO = 50_000; // Máximo en MXN

// ── Configuración visual por estado de retiro ───────────────────────────────
export const RETIRO_ESTADO_CONFIG: Record<
  EstadoRetiro,
  { label: string; color: string; bg: string; icon: string }
> = {
  pendiente: {
    label: 'En revisión',
    color: COLORS.orange,
    bg:    COLORS.orangeDim,
    icon:  'time-outline',
  },
  aprobado: {
    label: 'Aprobado',
    color: COLORS.green,
    bg:    COLORS.greenDim,
    icon:  'checkmark-circle-outline',
  },
  rechazado: {
    label: 'Rechazado',
    color: COLORS.red,
    bg:    COLORS.redDim,
    icon:  'close-circle-outline',
  },
};

// ── Configuración visual por tipo de movimiento ─────────────────────────────
export const MOVIMIENTO_CONFIG: Record<
  TipoMovimiento,
  { icon: string; color: string; label: string }
> = {
  deposito:         { icon: 'arrow-down-circle', color: COLORS.green,  label: 'Depósito' },
  premio:           { icon: 'trophy',            color: COLORS.gold,   label: 'Premio' },
  retiro:           { icon: 'arrow-up-circle',   color: COLORS.red,    label: 'Retiro' },
  retiro_cancelado: { icon: 'refresh-circle',    color: COLORS.orange, label: 'Retiro devuelto' },
  ajuste_admin:     { icon: 'build',             color: COLORS.purple, label: 'Ajuste' },
};
