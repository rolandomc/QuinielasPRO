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

/**
 * Trae TODAS las solicitudes de retiro (para admin), con datos del usuario.
 * Usa join explícito por FK: solicitudes_retiro.usuario_id → usuarios.id
 */
export async function fetchRetiros(): Promise<SolicitudRetiro[]> {
  // Intentamos join relacional primero (requiere FK en BD)
  const { data, error } = await supabase
    .from('solicitudes_retiro')
    .select(`
      id, usuario_id, monto, estado,
      nombre_titular, banco, clabe, numero_tarjeta,
      nota_admin, creado_en, resuelto_en,
      usuarios:usuario_id ( nombre, username )
    `)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('[fetchRetiros] Error en join relacional:', error.message, error.details, error.hint);
    // Fallback: traer sin join y enriquecer manualmente
    return fetchRetirosFallback();
  }

  // Si el join devuelve usuarios=null en todos los registros, intentar fallback
  const sinUsuario = (data ?? []).filter(r => r.usuarios == null);
  if (data && data.length > 0 && sinUsuario.length === data.length) {
    console.warn('[fetchRetiros] Join no resolvió usuarios, usando fallback manual.');
    return fetchRetirosFallback();
  }

  return (data as SolicitudRetiro[]) ?? [];
}

/** Fallback: trae retiros + usuarios por separado y los une en memoria. */
async function fetchRetirosFallback(): Promise<SolicitudRetiro[]> {
  const { data: retiros, error: e1 } = await supabase
    .from('solicitudes_retiro')
    .select('id, usuario_id, monto, estado, nombre_titular, banco, clabe, numero_tarjeta, nota_admin, creado_en, resuelto_en')
    .order('creado_en', { ascending: false });

  if (e1 || !retiros?.length) return [];

  const ids = [...new Set(retiros.map(r => r.usuario_id))];
  const { data: users } = await supabase
    .from('usuarios')
    .select('id, nombre, username')
    .in('id', ids);

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]));

  return retiros.map(r => ({
    ...r,
    usuarios: userMap[r.usuario_id] ?? { nombre: r.usuario_id, username: '—' },
  })) as SolicitudRetiro[];
}

/** Trae las solicitudes de un usuario específico. */
export async function fetchRetirosUsuario(usuarioId: string): Promise<SolicitudRetiro[]> {
  const { data, error } = await supabase
    .from('solicitudes_retiro')
    .select('id, usuario_id, monto, estado, nombre_titular, banco, clabe, numero_tarjeta, nota_admin, creado_en, resuelto_en')
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

/**
 * Aprueba o rechaza un retiro.
 * Intenta RPC primero; si no existe, aplica la lógica directo en BD.
 */
export async function resolverRetiro(
  retiroId: string,
  aprobar: boolean,
  nota: string | null
): Promise<void> {
  // Intentar RPC
  const { error: rpcErr } = await supabase.rpc('resolver_retiro', {
    p_retiro_id: retiroId,
    p_aprobar: aprobar,
    p_nota: nota,
  });

  if (!rpcErr) return; // RPC funcionó ✅

  console.warn('[resolverRetiro] RPC no disponible, aplicando lógica directa:', rpcErr.message);

  // Fallback directo: actualizar estado
  const nuevoEstado: EstadoRetiro = aprobar ? 'aprobado' : 'rechazado';
  const { data: retiro, error: fetchErr } = await supabase
    .from('solicitudes_retiro')
    .select('usuario_id, monto, estado')
    .eq('id', retiroId)
    .single();

  if (fetchErr || !retiro) throw new Error('No se encontró la solicitud.');
  if (retiro.estado !== 'pendiente') throw new Error('Esta solicitud ya fue procesada.');

  const { error: updateErr } = await supabase
    .from('solicitudes_retiro')
    .update({ estado: nuevoEstado, nota_admin: nota, resuelto_en: new Date().toISOString() })
    .eq('id', retiroId);

  if (updateErr) throw updateErr;

  // Si se rechaza, devolver saldo al usuario
  if (!aprobar) {
    const { data: user } = await supabase
      .from('usuarios')
      .select('saldo')
      .eq('id', retiro.usuario_id)
      .single();
    if (user) {
      await supabase
        .from('usuarios')
        .update({ saldo: (user.saldo ?? 0) + retiro.monto })
        .eq('id', retiro.usuario_id);
    }
  }
}

/**
 * Crea una nueva solicitud de retiro.
 * Intenta RPC; si falla, hace insert + descuento de saldo directamente.
 */
export async function crearSolicitudRetiro(params: {
  usuarioId: string;
  monto: number;
  nombre_titular: string;
  banco: string;
  clabe: string | null;
  numero_tarjeta: string | null;
}): Promise<void> {
  // Intentar RPC
  const { error: rpcErr } = await supabase.rpc('solicitar_retiro', {
    p_monto: params.monto,
    p_nombre_titular: params.nombre_titular,
    p_banco: params.banco,
    p_clabe: params.clabe,
    p_numero_tarjeta: params.numero_tarjeta,
  });

  if (!rpcErr) return; // RPC funcionó ✅

  console.warn('[crearSolicitudRetiro] RPC no disponible, aplicando lógica directa:', rpcErr.message);

  // Fallback: verificar saldo
  const { data: user, error: userErr } = await supabase
    .from('usuarios')
    .select('saldo')
    .eq('id', params.usuarioId)
    .single();

  if (userErr || !user) throw new Error('No se encontró el usuario.');
  if ((user.saldo ?? 0) < params.monto) throw new Error('Saldo insuficiente.');

  // Descontar saldo
  const { error: saldoErr } = await supabase
    .from('usuarios')
    .update({ saldo: user.saldo - params.monto })
    .eq('id', params.usuarioId);

  if (saldoErr) throw saldoErr;

  // Insertar solicitud
  const { error: insertErr } = await supabase
    .from('solicitudes_retiro')
    .insert({
      usuario_id: params.usuarioId,
      monto: params.monto,
      estado: 'pendiente',
      nombre_titular: params.nombre_titular,
      banco: params.banco,
      clabe: params.clabe,
      numero_tarjeta: params.numero_tarjeta,
    });

  if (insertErr) {
    // Revertir descuento de saldo
    await supabase
      .from('usuarios')
      .update({ saldo: user.saldo })
      .eq('id', params.usuarioId);
    throw insertErr;
  }
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
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
