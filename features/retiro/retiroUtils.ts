/**
 * features/retiro/retiroUtils.ts
 * Helpers de presentación y formateo para retiros y movimientos.
 * Sin dependencias de React ni Supabase — puro TypeScript.
 */
import { COLORS } from '../../constants/colors';
import { RETIRO_ESTADO_CONFIG, MOVIMIENTO_CONFIG } from '../../constants/retiro';
import type { EstadoRetiro, TipoMovimiento } from '../../types';

// ─── Formatters ───────────────────────────────────────────────────────────

/** Formatea una fecha ISO a cadena legible en español. */
export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Formatea un monto con signo y dos decimales. */
export function formatMonto(monto: number): string {
  const positivo = monto >= 0;
  return `${positivo ? '+' : ''}$${Math.abs(monto).toFixed(2)}`;
}

/** Formatea un monto como moneda MXN sin signo. */
export function formatCurrency(monto: number): string {
  return `$${Math.abs(monto).toFixed(2)}`;
}

// ─── Estado de retiro ─────────────────────────────────────────────────────

/** Devuelve el color del estado usando la config centralizada. */
export function estadoColor(estado: EstadoRetiro): string {
  return RETIRO_ESTADO_CONFIG[estado]?.color ?? COLORS.orange;
}

/** Devuelve la etiqueta legible del estado. */
export function estadoLabel(estado: EstadoRetiro): string {
  const labels: Record<EstadoRetiro, string> = {
    aprobado:  '✅ Aprobado',
    rechazado: '❌ Rechazado',
    pendiente: '⏳ Pendiente',
  };
  return labels[estado] ?? estado;
}

/** Devuelve el config completo (color, bg, icon, label) de un estado. */
export function estadoConfig(estado: EstadoRetiro) {
  return RETIRO_ESTADO_CONFIG[estado];
}

// ─── Tipo de movimiento ───────────────────────────────────────────────────

/** Devuelve el config visual (icon, color, label) de un tipo de movimiento. */
export function movimientoConfig(tipo: TipoMovimiento) {
  return (
    MOVIMIENTO_CONFIG[tipo] ?? {
      icon:  'ellipse-outline',
      color: COLORS.textSub,
      label: tipo,
    }
  );
}

// ─── Validaciones del formulario ──────────────────────────────────────────

export interface ValidarRetiroParams {
  monto:        string;
  nombre:       string;
  banco:        string;
  clabe:        string;
  tarjeta:      string;
  usarClabe:    boolean;
  saldoDisponible: number;
}

export interface ValidarRetiroResult {
  ok:    boolean;
  campo?: string;
  msg?:  string;
}

/** Valida los campos del formulario de retiro. Devuelve el primer error. */
export function validarFormularioRetiro(
  p: ValidarRetiroParams
): ValidarRetiroResult {
  const montoNum = parseFloat(p.monto);
  if (!p.monto || isNaN(montoNum) || montoNum <= 0)
    return { ok: false, campo: 'monto', msg: 'Ingresa un monto válido.' };
  if (montoNum > p.saldoDisponible)
    return { ok: false, campo: 'monto', msg: `Tu saldo disponible es $${p.saldoDisponible.toFixed(2)}` };
  if (!p.nombre.trim())
    return { ok: false, campo: 'nombre', msg: 'Ingresa el nombre del titular.' };
  if (!p.banco.trim())
    return { ok: false, campo: 'banco', msg: 'Ingresa el nombre del banco.' };
  if (p.usarClabe && p.clabe.replace(/\s/g, '').length !== 18)
    return { ok: false, campo: 'clabe', msg: 'La CLABE debe tener 18 dígitos.' };
  if (!p.usarClabe && p.tarjeta.replace(/\s/g, '').length < 16)
    return { ok: false, campo: 'tarjeta', msg: 'El número de tarjeta debe tener al menos 16 dígitos.' };
  return { ok: true };
}
