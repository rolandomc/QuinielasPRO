/**
 * features/retiro/retiroService.ts
 * Capa de datos para solicitudes de retiro y movimientos de billetera.
 *
 * Reglas:
 * - Toda query a Supabase relacionada con retiros vive aquí.
 * - Las pantallas NO importan supabase directamente para retiros.
 * - Los tipos vienen de @/types, no se redeclaran aquí.
 */
import { supabase } from '../../lib/supabase';
import type {
  SolicitudRetiro,
  Movimiento,
  Saldo,
  CrearRetiroParams,
} from '../../types';

// ─── Queries de lectura ────────────────────────────────────────────────────

/**
 * Trae TODAS las solicitudes (panel admin) con datos del usuario via join.
 * Si el join falla por FK ausente usa fallback manual.
 */
export async function fetchRetiros(): Promise<SolicitudRetiro[]> {
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
    console.error('[fetchRetiros] join error:', error.message);
    return _fetchRetirosFallback();
  }

  const sinUsuario = (data ?? []).filter(r => r.usuarios == null);
  if (data && data.length > 0 && sinUsuario.length === data.length) {
    console.warn('[fetchRetiros] join vacío, usando fallback.');
    return _fetchRetirosFallback();
  }

  return (data as unknown as SolicitudRetiro[]) ?? [];
}

/** Fallback: trae retiros y usuarios por separado, los une en memoria. */
async function _fetchRetirosFallback(): Promise<SolicitudRetiro[]> {
  const { data: retiros, error } = await supabase
    .from('solicitudes_retiro')
    .select(
      'id,usuario_id,monto,estado,nombre_titular,banco,clabe,numero_tarjeta,nota_admin,creado_en,resuelto_en'
    )
    .order('creado_en', { ascending: false });

  if (error || !retiros?.length) return [];

  const ids = [...new Set(retiros.map(r => r.usuario_id))];
  const { data: users } = await supabase
    .from('usuarios')
    .select('id,nombre,username')
    .in('id', ids);

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u]));

  return retiros.map(r => ({
    ...r,
    usuarios: userMap[r.usuario_id] ?? { nombre: r.usuario_id, username: '—' },
  })) as SolicitudRetiro[];
}

/** Retiros de un usuario específico (pantalla billetera). */
export async function fetchRetirosUsuario(
  usuarioId: string
): Promise<SolicitudRetiro[]> {
  const { data, error } = await supabase
    .from('solicitudes_retiro')
    .select(
      'id,usuario_id,monto,estado,nombre_titular,banco,clabe,numero_tarjeta,nota_admin,creado_en,resuelto_en'
    )
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data as SolicitudRetiro[]) ?? [];
}

/** Movimientos (historial) de un usuario, últimos 50. */
export async function fetchMovimientos(
  usuarioId: string
): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Movimiento[]) ?? [];
}

/** Saldo + monto en retiro pendiente para la pantalla billetera. */
export async function fetchSaldo(usuarioId: string): Promise<Saldo> {
  const [{ data: uData }, { data: rData }] = await Promise.all([
    supabase
      .from('usuarios')
      .select('saldo')
      .eq('id', usuarioId)
      .maybeSingle(),
    supabase
      .from('solicitudes_retiro')
      .select('monto')
      .eq('usuario_id', usuarioId)
      .eq('estado', 'pendiente'),
  ]);

  const disponible = Number((uData as any)?.saldo ?? 0);
  const en_retiro = (rData ?? []).reduce(
    (acc: number, r: { monto: number }) => acc + Number(r.monto),
    0
  );

  return { disponible, en_retiro };
}

/** ¿El usuario ya tiene una solicitud pendiente? */
export async function tienePendiente(usuarioId: string): Promise<boolean> {
  const { data } = await supabase
    .from('solicitudes_retiro')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('estado', 'pendiente')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ─── Mutaciones ───────────────────────────────────────────────────────────

/**
 * Crea una solicitud de retiro.
 * Intenta RPC; si falla aplica lógica directa con rollback de saldo.
 */
export async function crearSolicitudRetiro(
  params: CrearRetiroParams
): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('solicitar_retiro', {
    p_monto:          params.monto,
    p_nombre_titular: params.nombre_titular,
    p_banco:          params.banco,
    p_clabe:          params.clabe,
    p_numero_tarjeta: params.numero_tarjeta,
  });

  if (!rpcErr) return;

  console.warn('[crearSolicitudRetiro] RPC no disponible:', rpcErr.message);

  const { data: user, error: userErr } = await supabase
    .from('usuarios')
    .select('saldo')
    .eq('id', params.usuarioId)
    .single();

  if (userErr || !user) throw new Error('No se encontró el usuario.');
  if ((user.saldo ?? 0) < params.monto) throw new Error('Saldo insuficiente.');

  const { error: saldoErr } = await supabase
    .from('usuarios')
    .update({ saldo: user.saldo - params.monto })
    .eq('id', params.usuarioId);
  if (saldoErr) throw saldoErr;

  const { error: insertErr } = await supabase
    .from('solicitudes_retiro')
    .insert({
      usuario_id:     params.usuarioId,
      monto:          params.monto,
      estado:         'pendiente',
      nombre_titular: params.nombre_titular,
      banco:          params.banco,
      clabe:          params.clabe,
      numero_tarjeta: params.numero_tarjeta,
    });

  if (insertErr) {
    // Rollback: restaurar saldo
    await supabase
      .from('usuarios')
      .update({ saldo: user.saldo })
      .eq('id', params.usuarioId);
    throw insertErr;
  }
}

/**
 * Aprueba o rechaza un retiro (panel admin).
 * Intenta RPC; si falla aplica lógica directa.
 */
export async function resolverRetiro(
  retiroId: string,
  aprobar: boolean,
  nota: string | null
): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('resolver_retiro', {
    p_retiro_id: retiroId,
    p_aprobar:   aprobar,
    p_nota:      nota,
  });

  if (!rpcErr) return;

  console.warn('[resolverRetiro] RPC no disponible:', rpcErr.message);

  const nuevoEstado = aprobar ? 'aprobado' : 'rechazado';

  const { data: retiro, error: fetchErr } = await supabase
    .from('solicitudes_retiro')
    .select('usuario_id,monto,estado')
    .eq('id', retiroId)
    .single();

  if (fetchErr || !retiro) throw new Error('No se encontró la solicitud.');
  if (retiro.estado !== 'pendiente') throw new Error('Esta solicitud ya fue procesada.');

  const { error: updateErr } = await supabase
    .from('solicitudes_retiro')
    .update({
      estado:      nuevoEstado,
      nota_admin:  nota,
      resuelto_en: new Date().toISOString(),
    })
    .eq('id', retiroId);
  if (updateErr) throw updateErr;

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
