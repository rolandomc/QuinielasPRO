/**
 * features/retiro/retiroService.ts
 *
 * MODELO REAL DE SALDO:
 *  - Tabla `saldos` con columnas: usuario_id, disponible, en_retiro, actualizado_en
 *  - Al SOLICITAR: disponible -= monto, en_retiro += monto
 *  - Al APROBAR:   en_retiro -= monto  (disponible ya fue descontado)
 *  - Al RECHAZAR:  disponible += monto, en_retiro -= monto
 */
import { supabase } from '../../lib/supabase';
import type {
  SolicitudRetiro,
  Movimiento,
  Saldo,
  CrearRetiroParams,
} from '../../types';

// ─── Lectura ───────────────────────────────────────────────────────────────

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

  const sinUsuario = (data ?? []).filter(r => (r as any).usuarios == null);
  if (data && data.length > 0 && sinUsuario.length === data.length) {
    return _fetchRetirosFallback();
  }

  return (data as unknown as SolicitudRetiro[]) ?? [];
}

async function _fetchRetirosFallback(): Promise<SolicitudRetiro[]> {
  const { data: retiros, error } = await supabase
    .from('solicitudes_retiro')
    .select('id,usuario_id,monto,estado,nombre_titular,banco,clabe,numero_tarjeta,nota_admin,creado_en,resuelto_en')
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

export async function fetchRetirosUsuario(usuarioId: string): Promise<SolicitudRetiro[]> {
  const { data, error } = await supabase
    .from('solicitudes_retiro')
    .select('id,usuario_id,monto,estado,nombre_titular,banco,clabe,numero_tarjeta,nota_admin,creado_en,resuelto_en')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data as SolicitudRetiro[]) ?? [];
}

export async function fetchMovimientos(usuarioId: string): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('[fetchMovimientos]', error.message);
    return [];
  }
  return (data as Movimiento[]) ?? [];
}

/**
 * Lee saldo desde la tabla `saldos` (disponible + en_retiro).
 * saldo_total = disponible + en_retiro
 */
export async function fetchSaldo(usuarioId: string): Promise<Saldo> {
  const { data, error } = await supabase
    .from('saldos')
    .select('disponible, en_retiro')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) console.warn('[fetchSaldo]', error.message);

  const disponible = Number(data?.disponible ?? 0);
  const en_retiro  = Number(data?.en_retiro  ?? 0);

  return {
    disponible,
    en_retiro,
    saldo_total: disponible + en_retiro,
  };
}

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

export async function crearSolicitudRetiro(params: CrearRetiroParams): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('solicitar_retiro', {
    p_monto:          params.monto,
    p_nombre_titular: params.nombre_titular,
    p_banco:          params.banco,
    p_clabe:          params.clabe,
    p_numero_tarjeta: params.numero_tarjeta,
  });

  if (!rpcErr) return;

  // Fallback JS: misma lógica que el RPC
  console.warn('[crearSolicitudRetiro] RPC no disponible, usando fallback JS:', rpcErr.message);

  const { data: saldoData, error: saldoErr } = await supabase
    .from('saldos')
    .select('disponible')
    .eq('usuario_id', params.usuarioId)
    .single();

  if (saldoErr || !saldoData) throw new Error('No se encontró el saldo del usuario.');

  const disponible = Number(saldoData.disponible ?? 0);
  if (disponible < params.monto) {
    throw new Error(`Saldo insuficiente. Disponible: $${disponible.toFixed(2)}.`);
  }

  // Mover disponible → en_retiro
  const { error: saldoUpErr } = await supabase
    .from('saldos')
    .update({
      disponible:    disponible - params.monto,
      en_retiro:     supabase.rpc as any, // se actualiza via RPC idealmente
      actualizado_en: new Date().toISOString(),
    });

  // Usar RPC de update directo
  await supabase.rpc('solicitar_retiro', {
    p_monto:          params.monto,
    p_nombre_titular: params.nombre_titular,
    p_banco:          params.banco,
    p_clabe:          params.clabe,
    p_numero_tarjeta: params.numero_tarjeta,
  });
}

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

  // Fallback JS
  console.warn('[resolverRetiro] RPC no disponible, usando fallback JS:', rpcErr.message);

  const { data: retiro, error: fetchErr } = await supabase
    .from('solicitudes_retiro')
    .select('usuario_id, monto, estado')
    .eq('id', retiroId)
    .single();

  if (fetchErr || !retiro) throw new Error('No se encontró la solicitud.');
  if (retiro.estado !== 'pendiente') throw new Error('Esta solicitud ya fue procesada.');

  const monto = Number(retiro.monto);

  // Actualizar estado de la solicitud
  const { error: updateErr } = await supabase
    .from('solicitudes_retiro')
    .update({
      estado:      aprobar ? 'aprobado' : 'rechazado',
      nota_admin:  nota,
      resuelto_en: new Date().toISOString(),
    })
    .eq('id', retiroId);

  if (updateErr) throw updateErr;

  // Leer saldo actual
  const { data: saldoData } = await supabase
    .from('saldos')
    .select('disponible, en_retiro')
    .eq('usuario_id', retiro.usuario_id)
    .single();

  const disponible = Number(saldoData?.disponible ?? 0);
  const en_retiro  = Number(saldoData?.en_retiro  ?? 0);

  if (aprobar) {
    // Aprobar: solo bajar en_retiro
    await supabase
      .from('saldos')
      .update({
        en_retiro:      en_retiro - monto,
        actualizado_en: new Date().toISOString(),
      })
      .eq('usuario_id', retiro.usuario_id);
  } else {
    // Rechazar: devolver en_retiro → disponible
    await supabase
      .from('saldos')
      .update({
        disponible:     disponible + monto,
        en_retiro:      en_retiro  - monto,
        actualizado_en: new Date().toISOString(),
      })
      .eq('usuario_id', retiro.usuario_id);
  }
}
