/**
 * features/retiro/application/useAdminRetiros.ts
 *
 * CAPA: Application
 * Hook para el panel de administración de retiros.
 * ✅ Clean Architecture:
 *   - Usa retiroRepository (interfaz), NO importa supabase directamente.
 *   - NO contiene Alert ni Platform — eso pertenece a la capa de Presentación.
 *     La pantalla recibe `mensajeExito` / `mensajeError` y decide cómo mostrarlo.
 */
import { useState, useCallback, useMemo } from 'react';
import { retiroRepository } from '../data/retiro.supabase';
import type { SolicitudRetiro, EstadoRetiro } from '../../../types';

export type FiltroRetiro = EstadoRetiro | 'todos';

/** Mensaje de feedback para la UI tras resolver un retiro. */
export interface MensajeRetiro {
  tipo:  'exito' | 'error';
  titulo: string;
  cuerpo: string;
}

export function useAdminRetiros() {
  const [retiros, setRetiros]       = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro]         = useState<FiltroRetiro>('pendiente');
  const [resolving, setResolving]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [mensaje, setMensaje]       = useState<MensajeRetiro | null>(null);

  // Estado del modal de resolución
  const [modalVisible, setModalVisible] = useState(false);
  const [retiroSel, setRetiroSel]       = useState<SolicitudRetiro | null>(null);
  const [nota, setNota]                 = useState('');

  // ── Carga ────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setErrorMsg(null);
    try {
      const data = await retiroRepository.fetchRetiros();
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

  // ── Filtrado y estadísticas ──────────────────────────────────────────────
  const retirosFiltered = useMemo(
    () => (filtro === 'todos' ? retiros : retiros.filter((r) => r.estado === filtro)),
    [retiros, filtro]
  );

  const pendientesCount = useMemo(
    () => retiros.filter((r) => r.estado === 'pendiente').length,
    [retiros]
  );

  const aprobadosCount = useMemo(
    () => retiros.filter((r) => r.estado === 'aprobado').length,
    [retiros]
  );

  const totalPagado = useMemo(
    () =>
      retiros
        .filter((r) => r.estado === 'aprobado')
        .reduce((sum, r) => sum + (r.monto ?? 0), 0),
    [retiros]
  );

  // ── Modal ────────────────────────────────────────────────────────────────
  const abrirResolver = useCallback((retiro: SolicitudRetiro) => {
    setRetiroSel(retiro);
    setNota('');
    setMensaje(null);
    setModalVisible(true);
  }, []);

  // ── Resolver ────────────────────────────────────────────────────────────
  const resolver = useCallback(
    async (aprobar: boolean) => {
      if (!retiroSel) return;
      setResolving(true);
      try {
        await retiroRepository.resolverRetiro(retiroSel.id, aprobar, nota.trim() || null);
        setModalVisible(false);
        setRetiroSel(null);
        setNota('');
        await cargar();
        // ✅ No usamos Alert aquí — devolvemos el mensaje para que la UI lo muestre
        setMensaje({
          tipo:   'exito',
          titulo: aprobar ? '✅ Aprobado' : 'Rechazado',
          cuerpo: aprobar
            ? 'El retiro fue aprobado y el saldo descontado.'
            : 'El retiro fue rechazado y el saldo devuelto.',
        });
      } catch (err: any) {
        setMensaje({
          tipo:   'error',
          titulo: 'Error',
          cuerpo: err?.message ?? 'No se pudo procesar el retiro.',
        });
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
    // mensaje de feedback para la UI (reemplaza Alert)
    mensaje,
    setMensaje,
    // acciones
    resolving,
    cargar,
    onRefresh,
    abrirResolver,
    resolver,
  };
}
