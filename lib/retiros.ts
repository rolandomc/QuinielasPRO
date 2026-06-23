/**
 * lib/retiros.ts
 * Toda la lógica de datos para solicitudes de retiro.
 * Importar desde aquí — nunca duplicar queries en pantallas.
 */
import { supabase } from './supabase';

export type EstadoRetiro = 'pendiente' | 'aprobado' | 'rechazado';

export type SolicitudRetiro = {
  id: string;
  usuario_id: string;
  monto: number;
  estado: EstadoRetiro;
  nombre_titular: string;
  banco: string;
  clabe: string | null;
  numero_tarjeta: string | null;
  nota_admin: string | null;
  creado_en: string;
  resuelto_en: string | null;
  usuarios: { nombre: string; username: string } | null;
};

/** Trae TODAS las solicitudes de retiro (para admin), con datos del usuario. */
export async function fetchRetiros(): Promise<SolicitudRetiro[]> {
  const { data, error } = await supabase
    .from('solicitudes_retiro')
    .select('*, usuarios(nombre, username)')
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data as SolicitudRetiro[]) ?? [];
}

/** Trae las solicitudes de un usuario específico. */
export async function fetchRetirosUsuario(usuarioId: string): Promise<SolicitudRetiro[]> {
  const { data, error } = await supabase
    .from('solicitudes_retiro')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data as SolicitudRetiro[]) ?? [];
}

/** Verifica si el usuario ya tiene una solicitud pendiente. */
export async function tienePendiente(usuarioId: string): Promise<boolean> {
  const { data } = await supabase
    .from('solicitudes_retiro')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'pendiente')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Aprueba o rechaza un retiro vía RPC. */
export async function resolverRetiro(
  retiroId: string,
  aprobar: boolean,
  nota: string | null
): Promise<void> {
  const { error } = await supabase.rpc('resolver_retiro', {
    p_retiro_id: retiroId,
    p_aprobar: aprobar,
    p_nota: nota,
  });
  if (error) throw error;
}

/** Crea una nueva solicitud de retiro. */
export async function crearSolicitudRetiro(params: {
  monto: number;
  nombre_titular: string;
  banco: string;
  clabe: string | null;
  numero_tarjeta: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('solicitar_retiro', {
    p_monto: params.monto,
    p_nombre_titular: params.nombre_titular,
    p_banco: params.banco,
    p_clabe: params.clabe,
    p_numero_tarjeta: params.numero_tarjeta,
  });
  if (error) throw error;
}

// ─── Helpers de presentación ───────────────────────────────────────────────

export function estadoColor(
  estado: string,
  colors: { green: string; red: string; orange: string }
): string {
  if (estado === 'aprobado') return colors.green;
  if (estado === 'rechazado') return colors.red;
  return colors.orange;
}

export function estadoLabel(estado: string): string {
  if (estado === 'aprobado') return '✅ Aprobado';
  if (estado === 'rechazado') return '❌ Rechazado';
  return '⏳ Pendiente';
}

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
