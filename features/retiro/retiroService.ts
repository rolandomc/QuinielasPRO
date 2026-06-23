/**
 * features/retiro/retiroService.ts
 *
 * ⚠️  DEPRECADO — Mantenido solo como alias para no romper imports externos.
 *
 * Migrado a Clean Architecture:
 *   - Lógica de datos → features/retiro/data/retiro.supabase.ts
 *   - Contrato       → features/retiro/domain/retiro.repository.ts
 *
 * TODO: Eliminar este archivo cuando todos los imports externos estén actualizados.
 */
export { retiroRepository as default } from './data/retiro.supabase';
export {
  retiroRepository,
} from './data/retiro.supabase';

// Re-exporta funciones sueltas para compatibilidad con cualquier import legacy
import { retiroRepository } from './data/retiro.supabase';

export const fetchRetiros          = () => retiroRepository.fetchRetiros();
export const fetchRetirosUsuario   = (id: string) => retiroRepository.fetchRetirosUsuario(id);
export const fetchMovimientos      = (id: string) => retiroRepository.fetchMovimientos(id);
export const fetchSaldo            = (id: string) => retiroRepository.fetchSaldo(id);
export const tienePendiente        = (id: string) => retiroRepository.tienePendiente(id);
export const crearSolicitudRetiro  = (p: Parameters<typeof retiroRepository.crearSolicitudRetiro>[0]) =>
  retiroRepository.crearSolicitudRetiro(p);
export const resolverRetiro        = (
  id: string, aprobar: boolean, nota: string | null
) => retiroRepository.resolverRetiro(id, aprobar, nota);
