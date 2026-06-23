/**
 * features/retiro/useAdminRetiros.ts
 * Hook para el panel de administración de retiros.
 * Encapsula carga, filtrado, estadísticas y resolución (aprobar / rechazar).
 */
import { useState, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { fetchRetiros, resolverRetiro } from './retiroService';
import type { SolicitudRetiro, EstadoRetiro } from '../../types';

export type FiltroRetiro = EstadoRetiro | 'todos';

const avisar = (titulo: string, mensaje: string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${mensaje}`);
  else Alert.alert(titulo, mensaje);
};

export function useAdminRetiros() {
  const [retiros, setRetiros]         = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [filtro, setFiltro]           = useState<FiltroRetiro>('pendiente');
  const [resolving, setResolving]     = useState(false);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  // Estado del modal de resolución
  const [modalVisible, setModalVisible] = useState(false);
  const [retiroSel, setRetiroSel]       = useState<SolicitudRetiro | null>(null);
  const [nota, setNota]                 = useState('');

  // ── Carga ──────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setErrorMsg(null);
    try {
      const data = await fetchRetiros();
      setRetiros(data);
    } catch (err: any) {
      console.error('[useAdminRetiros] cargar:', err);
      setErrorMsg(err?.message ?? 'Error al cargar retiros.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  // ── Filtrado y estadísticas ───────────────────────────────────────────────
  const retirosFiltered = useMemo(
    () => filtro === 'todos' ? retiros : retiros.filter(r => r.estado === filtro),
    [retiros, filtro]
  );

  const pendientesCount = useMemo(
    () => retiros.filter(r => r.estado === 'pendiente').length,
    [retiros]
  );

  const aprobadosCount = useMemo(
    () => retiros.filter(r => r.estado === 'aprobado').length,
    [retiros]
  );

  const totalPagado = useMemo(
    () => retiros
      .filter(r => r.estado === 'aprobado')
      .reduce((sum, r) => sum + (r.monto ?? 0), 0),
    [retiros]
  );

  // ── Modal ─────────────────────────────────────────────────────────────────
  const abrirResolver = useCallback((retiro: SolicitudRetiro) => {
    setRetiroSel(retiro);
    setNota('');
    setModalVisible(true);
  }, []);

  // ── Resolver (aprobar = true | rechazar = false) ──────────────────────────
  const resolver = useCallback(
    async (aprobar: boolean) => {
      if (!retiroSel) return;
      setResolving(true);
      try {
        await resolverRetiro(retiroSel.id, aprobar, nota.trim() || null);
        setModalVisible(false);
        setRetiroSel(null);
        setNota('');
        await cargar();
        avisar(
          aprobar ? '\u2705 Aprobado' : 'Rechazado',
          aprobar
            ? 'El retiro fue aprobado y el saldo descontado.'
            : 'El retiro fue rechazado y el saldo devuelto.'
        );
      } catch (err: any) {
        avisar('Error', err?.message ?? 'No se pudo procesar el retiro.');
      } finally {
        setResolving(false);
      }
    },
    [retiroSel, nota, cargar]
  );

  return {
    // datos
    retiros,
    retirosFiltered,
    loading,
    refreshing,
    errorMsg,
    // filtros y stats
    filtro,
    setFiltro,
    pendientesCount,
    aprobadosCount,
    totalPagado,
    // modal
    modalVisible,
    setModalVisible,
    retiroSel,
    nota,
    setNota,
    // acciones
    resolving,
    cargar,
    onRefresh,
    abrirResolver,
    resolver,
  };
}
