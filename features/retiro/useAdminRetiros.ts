/**
 * features/retiro/useAdminRetiros.ts
 * Hook para el panel de administración de retiros.
 * Encapsula carga, filtrado y resolución (aprobar / rechazar).
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { fetchRetiros, resolverRetiro } from './retiroService';
import type { SolicitudRetiro, EstadoRetiro } from '../../types';

export type FiltroRetiro = EstadoRetiro | 'todos';

export interface UseAdminRetirosState {
  retiros:       SolicitudRetiro[];
  loading:       boolean;
  refreshing:    boolean;
  filtro:        FiltroRetiro;
  resolving:     string | null; // id del retiro que se está procesando
}

export interface UseAdminRetirosActions {
  cargar:         () => Promise<void>;
  onRefresh:      () => Promise<void>;
  setFiltro:      (f: FiltroRetiro) => void;
  aprobar:        (id: string) => Promise<void>;
  rechazar:       (id: string, nota: string) => Promise<void>;
  retirosVisibles: SolicitudRetiro[];
}

export function useAdminRetiros(): UseAdminRetirosState & UseAdminRetirosActions {
  const [retiros, setRetiros]     = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro]       = useState<FiltroRetiro>('pendiente');
  const [resolving, setResolving] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await fetchRetiros();
      setRetiros(data);
    } catch (err) {
      console.error('[useAdminRetiros] cargar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  const aprobar = useCallback(
    async (id: string) => {
      setResolving(id);
      try {
        await resolverRetiro(id, true, null);
        await cargar();
        Alert.alert('✅ Aprobado', 'El retiro fue aprobado y el saldo descontado.');
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'No se pudo aprobar el retiro.');
      } finally {
        setResolving(null);
      }
    },
    [cargar]
  );

  const rechazar = useCallback(
    async (id: string, nota: string) => {
      setResolving(id);
      try {
        await resolverRetiro(id, false, nota || null);
        await cargar();
        Alert.alert('Rechazado', 'El retiro fue rechazado y el saldo devuelto.');
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'No se pudo rechazar el retiro.');
      } finally {
        setResolving(null);
      }
    },
    [cargar]
  );

  const retirosVisibles =
    filtro === 'todos' ? retiros : retiros.filter(r => r.estado === filtro);

  return {
    retiros,
    loading,
    refreshing,
    filtro,
    resolving,
    cargar,
    onRefresh,
    setFiltro,
    aprobar,
    rechazar,
    retirosVisibles,
  };
}
