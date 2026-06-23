/**
 * features/retiro/retiroService.ts
 * Capa de datos para solicitudes de retiro y movimientos de billetera.
 *
 * MODELO DE SALDO (post-fix):
 *  - El saldo en DB representa el saldo REAL (disponible + en_retiro).
 *  - Al SOLICITAR un retiro el saldo NO se descuenta; queda "reservado".
 *  - Al APROBAR se descuenta. Al RECHAZAR no se toca nada.
 *  - La vista `saldos` expone: disponible = saldo - SUM(pendientes), en_retiro, saldo_total.
 */
import { supabase } from '../../lib/supabase';
import type {
  SolicitudRetiro,
  Movimiento,
  Saldo,
  CrearRetiroParams,
} from '../../types';

// ─── Queries de lectura ────────────────────────────────────────────────────

/** Trae TODAS las solicitudes (panel admin) con datos del usuario via join. */
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
    console.warn('[fetchRetiros] join vacío, usando fallback.');
    return _fetchRetirosFallback();
  }

  return (data as unknown as SolicitudRetiro[]) ?? [];
}

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
  if (error) {
    console.warn('[fetchMovimientos]', error.message);
    return [];
  }
  return (data as Movimiento[]) ?? [];
}

/**
 * Saldo para la pantalla billetera.
 * Usa la vista `saldos` cuando está disponible; fallback a cálculo manual.
 *
 * MODELO CORRECTO:
 *   disponible  = saldo_total - en_retiro   (lo que puede solicitar)
 *   en_retiro   = SUM(solicitudes pendientes)
 *   saldo_total = saldo real en tabla usuarios
 */
export async function fetchSaldo(usuarioId: string): Promise<Saldo> {
  const { data: vista, error: vistaErr } = await supabase
    .from('saldos')
    .select('disponible,en_retiro,saldo_total')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (!vistaErr && vista) {
    return {
      disponible:  Number(vista.disponible  ?? 0),
      en_retiro:   Number(vista.en_retiro   ?? 0),
      saldo_total: Number((vista as any).saldo_total ?? 0),
    };
  }

  console.warn('[fetchSaldo] vista `saldos` no disponible, usando fallback.', vistaErr?.message);

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

  const saldo_total = Number((uData as any)?.saldo ?? 0);
  const en_retiro   = (rData ?? []).reduce(
    (acc: number, r: { monto: number }) => acc + Number(r.monto),
    0
  );

  return {
    disponible:  saldo_total - en_retiro,
    en_retiro,
    saldo_total,
  };
}

/** ¿El usuario tiene alguna solicitud en estado pendiente? */
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
 * Crea una solicitud de retiro via RPC.
 * El fallback JS replica el NUEVO modelo: NO descuenta saldo al solicitar.
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

  const [{ data: user, error: userErr }, { data: pendientes }] =
    await Promise.all([
      supabase.from('usuarios').select('saldo').eq('id', params.usuarioId).single(),
      supabase
        .from('solicitudes_retiro')
        .select('monto')
        .eq('usuario_id', params.usuarioId)
        .eq('estado', 'pendiente'),
    ]);

  if (userErr || !user) throw new Error('No se encontró el usuario.');

  const saldo_total = Number(user.saldo ?? 0);
  const en_retiro   = (pendientes ?? []).reduce(
    (acc: number, r: { monto: number }) => acc + Number(r.monto),
    0
  );
  const disponible  = saldo_total - en_retiro;

  if (disponible < params.monto) {
    throw new Error(
      `Saldo insuficiente. Disponible: $${disponible.toFixed(2)} (en retiro: $${en_retiro.toFixed(2)}).`
    );
  }

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

  if (insertErr) throw insertErr;
}

/**
 * Aprueba o rechaza un retiro (panel admin).
 * NUEVO MODELO:
 *  - Aprobar  → descuenta saldo ahora
 *  - Rechazar → no toca saldo (nunca se descontó)
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

  const { data: retiro, error: fetchErr } = await supabase
    .from('solicitudes_retiro')
    .select('usuario_id,monto,estado')
    .eq('id', retiroId)
    .single();

  if (fetchErr || !retiro) throw new Error('No se encontró la solicitud.');
  if (retiro.estado !== 'pendiente') throw new Error('Esta solicitud ya fue procesada.');

  const nuevoEstado = aprobar ? 'aprobado' : 'rechazado';

  const { error: updateErr } = await supabase
    .from('solicitudes_retiro')
    .update({
      estado:      nuevoEstado,
      nota_admin:  nota,
      resuelto_en: new Date().toISOString(),
    })
    .eq('id', retiroId);

  if (updateErr) throw updateErr;

  if (aprobar) {
    const { data: user, error: userErr } = await supabase
      .from('usuarios')
      .select('saldo')
      .eq('id', retiro.usuario_id)
      .single();

    if (userErr || !user) throw new Error('No se encontró el usuario para descontar saldo.');
    if (Number(user.saldo) < Number(retiro.monto)) {
      await supabase
        .from('solicitudes_retiro')
        .update({ estado: 'pendiente', resuelto_en: null, nota_admin: null })
        .eq('id', retiroId);
      throw new Error('Saldo insuficiente al momento de aprobar.');
    }

    await supabase
      .from('usuarios')
      .update({ saldo: Number(user.saldo) - Number(retiro.monto) })
      .eq('id', retiro.usuario_id);
  }
  // RECHAZAR: no se toca el saldo
}
