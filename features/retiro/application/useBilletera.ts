/**
 * features/retiro/application/useBilletera.ts
 *
 * CAPA: Application
 * Hook unificado para la pantalla de billetera del usuario.
 * ✅ Clean Architecture:
 *   - Usa retiroRepository (interfaz), NO importa supabase directamente.
 *   - Fusiona useRetiro.ts + el antiguo wrapper useBilletera.ts en un solo archivo.
 *   - No hay Alert de React Native aquí — devuelve `error` para que la UI lo maneje.
 *
 * FIX: se agregó useEffect para disparar cargar() al montar el hook.
 *      Sin este efecto el hook nunca pedía datos iniciales y la billetera
 *      se quedaba en loading indefinidamente (o mostraba $0.00).
 */
import { useState, useCallback, useEffect } from 'react';
import { retiroRepository } from '../data/retiro.supabase';
import { useAuth } from '../../../context/AuthContext';
import type { Saldo, Movimiento, SolicitudRetiro, CrearRetiroParams } from '../../../types';

export interface UseBilleteraReturn {
  // Estado
  saldo:           number;   // disponible (lo que puede retirar ahora)
  saldoTotal:      number;   // disponible + en_retiro
  enRetiro:        number;   // monto en solicitudes pendientes
  movimientos:     Movimiento[];
  retiros:         SolicitudRetiro[];
  tienePendiente:  boolean;
  loading:         boolean;
  refreshing:      boolean;
  // Acciones
  cargar:          () => Promise<void>;
  onRefresh:       () => Promise<void>;
  enviarSolicitud: (datos: Omit<CrearRetiroParams, 'usuarioId'>) => Promise<void>;
}

export function useBilletera(): UseBilleteraReturn {
  const { usuario } = useAuth();
  const userId = usuario?.id;

  const [saldoData, setSaldoData]       = useState<Saldo | null>(null);
  const [movimientos, setMovimientos]   = useState<Movimiento[]>([]);
  const [retiros, setRetiros]           = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // ── Carga paralela ────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, m, r] = await Promise.all([
        retiroRepository.fetchSaldo(userId),
        retiroRepository.fetchMovimientos(userId),
        retiroRepository.fetchRetirosUsuario(userId),
      ]);
      setSaldoData(s);
      setMovimientos(m);
      setRetiros(r);
    } catch (err) {
      console.error('[useBilletera] cargar:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── FIX: cargar datos al montar (cuando userId esté disponible) ───────────
  useEffect(() => {
    cargar();
  }, [cargar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  // ── Solicitar retiro ─────────────────────────────────────────────────────
  // ✅ No lanza Alert aquí — propaga el error para que la pantalla lo maneje.
  const enviarSolicitud = useCallback(
    async (datos: Omit<CrearRetiroParams, 'usuarioId'>) => {
      if (!userId) throw new Error('Usuario no autenticado.');
      await retiroRepository.crearSolicitudRetiro({ ...datos, usuarioId: userId });
      await cargar();
    },
    [userId, cargar]
  );

  // ── Derivados ────────────────────────────────────────────────────────────
  const saldo          = saldoData?.disponible  ?? 0;
  const saldoTotal     = saldoData?.saldo_total ?? 0;
  const enRetiro       = saldoData?.en_retiro   ?? 0;
  const tienePendiente = retiros.some((r) => r.estado === 'pendiente');

  return {
    saldo,
    saldoTotal,
    enRetiro,
    movimientos,
    retiros,
    tienePendiente,
    loading,
    refreshing,
    cargar,
    onRefresh,
    enviarSolicitud,
  };
}
