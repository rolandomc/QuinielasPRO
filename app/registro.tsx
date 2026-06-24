/**
 * app/registro.tsx — DEPRECADO (Fase 2)
 *
 * Era el flujo de registro pre-autenticación (nombre + teléfono + pago).
 * Reemplazado por el flujo completo de auth en login.tsx.
 *
 * Redirige a login para no romper URLs antiguas.
 * Se puede eliminar en Fase 3.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function RegistroDeprecado() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, []);
  return null;
}
