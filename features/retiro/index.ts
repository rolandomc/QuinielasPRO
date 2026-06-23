/**
 * features/retiro/index.ts
 * Barrel — exporta todo lo público de la feature de retiros.
 *
 * Estructura Clean Architecture:
 *   domain/      → contrato (IRetiroRepository)
 *   data/        → implementación Supabase
 *   application/ → hooks (useAdminRetiros, useBilletera)
 *   retiroUtils  → helpers de presentación
 *
 * Uso desde pantallas o tests:
 *   import { useBilletera, useAdminRetiros, formatFecha } from '@/features/retiro';
 */

// Domain
export type { IRetiroRepository } from './domain/retiro.repository';

// Data (solo se exporta la instancia, no la clase interna de Supabase)
export { retiroRepository } from './data/retiro.supabase';

// Application
export { useBilletera }      from './application/useBilletera';
export type { UseBilleteraReturn } from './application/useBilletera';
export { useAdminRetiros }   from './application/useAdminRetiros';
export type { FiltroRetiro, MensajeRetiro } from './application/useAdminRetiros';

// Presentation helpers
export * from './retiroUtils';
