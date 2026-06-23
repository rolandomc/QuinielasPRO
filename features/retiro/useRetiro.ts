/**
 * features/retiro/useRetiro.ts
 * Hook para la pantalla de billetera del usuario.
 * Encapsula toda la lógica de estado: saldo, movimientos, retiros.
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { fetchSaldo, fetchMovimientos, fetchRetirosUsuario, crearSolicitudRetiro } from './retiroService';
import type { Saldo, Movimiento, SolicitudRetiro, CrearRetiroParams } from '../../types';

export interface UseBilleteraState {
  saldo:          Saldo | null;
  movimientos:    Movimiento[];
  retiros:        SolicitudRetiro[];
  loading:        boolean;
  refreshing:     boolean;
  modalVisible:   boolean;
}

export interface UseBilleteraActions {
  cargar:           () => Promise<void>;
  onRefresh:        () => Promise<void>;
  solicitarRetiro:  (datos: Omit<CrearRetiroParams, 'usuarioId'>) => Promise<void>;
  setModalVisible:  (v: boolean) => void;
}

export function useBilletera(
  userId: string | undefined
): UseBilleteraState & UseBilleteraActions {
  const [saldo, setSaldo]               = useState<Saldo | null>(null);
  const [movimientos, setMovimientos]   = useState<Movimiento[]>([]);
  const [retiros, setRetiros]           = useState<SolicitudRetiro[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const cargar = useCallback(async () => {
    if (!userId) return;
    try {
      const [s, m, r] = await Promise.all([
        fetchSaldo(userId),
        fetchMovimientos(userId),
        fetchRetirosUsuario(userId),
      ]);
      setSaldo(s);
      setMovimientos(m);
      setRetiros(r);
    } catch (err) {
      console.error('[useBilletera] cargar:', err);
    }
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargar();
    setRefreshing(false);
  }, [cargar]);

  const solicitarRetiro = useCallback(
    async (datos: Omit<CrearRetiroParams, 'usuarioId'>) => {
      if (!userId) return;
      try {
        await crearSolicitudRetiro({ ...datos, usuarioId: userId });
        Alert.alert(
          '✅ Solicitud enviada',
          'Tu solicitud fue recibida. El administrador la revisará pronto.'
        );
        setModalVisible(false);
        await cargar();
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'Ocurrió un error al enviar la solicitud.');
      }
    },
    [userId, cargar]
  );

  return {
    saldo,
    movimientos,
    retiros,
    loading,
    refreshing,
    modalVisible,
    cargar,
    onRefresh,
    solicitarRetiro,
    setModalVisible,
  };
}
