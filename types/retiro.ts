/**
 * types/retiro.ts
 * Interfaces para solicitudes de retiro y movimientos de billetera.
 */

export type EstadoRetiro = 'pendiente' | 'aprobado' | 'rechazado';

/** Solicitud de retiro tal como viene de la tabla `solicitudes_retiro`. */
export interface SolicitudRetiro {
  id: string;
  usuario_id: string;
  monto: number;
  estado: EstadoRetiro;
  nombre_titular: string;
  banco: string;
  clabe: string | null;
  numero_tarjeta: string | null;
  nota_admin: string | null;
  creado_en: string;
  resuelto_en: string | null;
  /** Presente solo cuando se hace join con la tabla `usuarios` (vista admin). */
  usuarios?: { nombre: string; username: string } | null;
}

/** Parámetros para crear una nueva solicitud de retiro. */
export interface CrearRetiroParams {
  usuarioId: string;
  monto: number;
  nombre_titular: string;
  banco: string;
  clabe: string | null;
  numero_tarjeta: string | null;
}

/** Un movimiento de la tabla `movimientos` (historial de billetera). */
export interface Movimiento {
  id: string;
  usuario_id: string;
  tipo: TipoMovimiento;
  monto: number;
  descripcion: string | null;
  creado_en: string;
}

/** Tipos de movimiento reconocidos en el historial de billetera. */
export type TipoMovimiento =
  | 'deposito'
  | 'premio'
  | 'retiro'
  | 'retiro_solicitado'
  | 'retiro_aprobado'
  | 'retiro_cancelado'
  | 'ajuste_admin';

/**
 * Saldo calculado para la pantalla de billetera.
 *
 * MODELO (post-fix):
 *  saldo_total = saldo real en DB (nunca se descuenta al solicitar)
 *  en_retiro   = SUM de solicitudes pendientes
 *  disponible  = saldo_total - en_retiro  (lo que puede solicitar)
 */
export interface Saldo {
  disponible:   number;
  en_retiro:    number;
  saldo_total:  number;
}
