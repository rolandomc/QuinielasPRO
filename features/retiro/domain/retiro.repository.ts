/**
 * features/retiro/domain/retiro.repository.ts
 *
 * CAPA: Domain
 * Contrato (interfaz) que define QUÉ puede hacer el repositorio de retiros.
 * Ninguna capa superior depende de Supabase directamente — solo de esta interfaz.
 * Si mañana cambias a otro backend, solo cambias la implementación en /data.
 */
import type {
  SolicitudRetiro,
  Movimiento,
  Saldo,
  CrearRetiroParams,
} from '../../../types';

export interface IRetiroRepository {
  // ── Lectura ──────────────────────────────────────────────────────────────
  /** Todos los retiros (vista admin con join a usuarios). */
  fetchRetiros(): Promise<SolicitudRetiro[]>;

  /** Retiros de un usuario específico. */
  fetchRetirosUsuario(usuarioId: string): Promise<SolicitudRetiro[]>;

  /** Últimos 50 movimientos de un usuario. */
  fetchMovimientos(usuarioId: string): Promise<Movimiento[]>;

  /** Saldo actual (disponible + en_retiro) de un usuario. */
  fetchSaldo(usuarioId: string): Promise<Saldo>;

  /** ¿Tiene el usuario alguna solicitud en estado 'pendiente'? */
  tienePendiente(usuarioId: string): Promise<boolean>;

  // ── Mutaciones ───────────────────────────────────────────────────────────
  /** Crea una nueva solicitud de retiro. Llama al RPC de Supabase. */
  crearSolicitudRetiro(params: CrearRetiroParams): Promise<void>;

  /** Aprueba o rechaza una solicitud (solo admin). */
  resolverRetiro(
    retiroId: string,
    aprobar: boolean,
    nota: string | null
  ): Promise<void>;
}
