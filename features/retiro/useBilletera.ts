/**
 * features/retiro/useBilletera.ts
 *
 * Wrapper delgado sobre useRetiro para la pantalla solicitar-retiro.tsx.
 * Expone: saldo (disponible), saldoTotal, enRetiro, tienePendiente, loading, enviarSolicitud.
 *
 * MODELO CORRECTO (post-fix):
 *   saldo       = disponible  (lo que puede solicitar ahora)
 *   saldoTotal  = saldo real en DB (disponible + en_retiro)
 *   enRetiro    = SUM(solicitudes pendientes)
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

  const tienePendiente = retiros.some(r => r.estado === 'pendiente');

  const saldoDisponible = saldo?.disponible  ?? 0;
  const saldoTotal      = saldo?.saldo_total ?? 0;
  const enRetiro        = saldo?.en_retiro   ?? 0;

  const enviarSolicitud = useCallback(
    async (datos: Omit<CrearRetiroParams, 'usuarioId'>) => {
      await solicitarRetiro(datos);
    },
    [solicitarRetiro]
  );

  return {
    saldo:           saldoDisponible,
    saldoTotal,
    enRetiro,
    tienePendiente,
    loading,
    enviarSolicitud,
  };
}
