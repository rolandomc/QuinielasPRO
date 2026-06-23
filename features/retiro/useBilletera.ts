/**
 * features/retiro/useBilletera.ts
 *
 * Wrapper delgado sobre useBilletera (useRetiro) para la pantalla
 * solicitar-retiro.tsx que necesita una API más simple:
 *   { saldo, tienePendiente, loading, enviarSolicitud }
 */
import { useCallback } from 'react';
import { useBilletera as _useBilletera } from './useRetiro';
import { useAuth } from '../../context/AuthContext';
import type { CrearRetiroParams } from '../../types';

export function useBilletera() {
  const { usuario } = useAuth();
  const {
    saldo,
    retiros,
    loading,
    solicitarRetiro,
  } = _useBilletera(usuario?.id);

  // Hay solicitud pendiente si existe al menos un retiro en estado 'pendiente'
  const tienePendiente = retiros.some(r => r.estado === 'pendiente');

  // Saldo disponible (número simple que espera la pantalla)
  const saldoDisponible = saldo?.disponible ?? 0;

  // API simplificada que espera solicitar-retiro.tsx
  const enviarSolicitud = useCallback(
    async (datos: Omit<CrearRetiroParams, 'usuarioId'>) => {
      await solicitarRetiro(datos);
    },
    [solicitarRetiro]
  );

  return {
    saldo:           saldoDisponible,
    tienePendiente,
    loading,
    enviarSolicitud,
  };
}
