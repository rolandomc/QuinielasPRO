/**
 * app/solicitar-retiro.tsx — DEPRECADO (Fase 2)
 *
 * Esta pantalla duplicaba el ModalRetiro de billetera.tsx.
 * Redirige automáticamente a la billetera donde está el flujo unificado.
 *
 * Mantener el archivo evita errores 404 en deep links existentes.
 * Se puede eliminar en Fase 3 una vez confirmado que no hay enlaces activos.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SolicitarRetiroRedirect() {
  const router = useRouter();
  useEffect(() => {
    // Redirige a billetera — el modal de retiro está ahí
    router.replace('/(tabs)/billetera');
  }, []);
  return null;
}
