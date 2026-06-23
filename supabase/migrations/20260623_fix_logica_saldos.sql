-- ============================================================
-- MIGRACIÓN: fix_logica_saldos_retiros
-- ============================================================

-- PASO 0: Agregar columna de rastreo para idempotencia
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'solicitudes_retiro'
      and column_name  = 'saldo_descontado'
  ) then
    alter table public.solicitudes_retiro
      add column saldo_descontado boolean not null default false;
  end if;
end $$;

-- Marcar todas las solicitudes existentes como saldo_descontado=true
update public.solicitudes_retiro
set saldo_descontado = true
where saldo_descontado = false;

-- Devolver saldo de solicitudes RECHAZADAS
update public.usuarios
set saldo = saldo + sq.total_rechazado
from (
  select usuario_id, sum(monto) as total_rechazado
  from public.solicitudes_retiro
  where estado = 'rechazado'
    and saldo_descontado = true
  group by usuario_id
) sq
where public.usuarios.id = sq.usuario_id
  and sq.total_rechazado > 0;

update public.solicitudes_retiro
set saldo_descontado = false
where estado = 'rechazado';

-- Devolver saldo de solicitudes PENDIENTES
update public.usuarios
set saldo = saldo + sq.total_pendiente
from (
  select usuario_id, sum(monto) as total_pendiente
  from public.solicitudes_retiro
  where estado = 'pendiente'
    and saldo_descontado = true
  group by usuario_id
) sq
where public.usuarios.id = sq.usuario_id
  and sq.total_pendiente > 0;

update public.solicitudes_retiro
set saldo_descontado = false
where estado = 'pendiente';

-- ============================================================
-- PASO 1: Vista saldos
-- ============================================================
create or replace view public.saldos as
select
  u.id                                                                        as usuario_id,
  u.saldo - coalesce(sum(r.monto) filter (where r.estado = 'pendiente'), 0)  as disponible,
  coalesce(sum(r.monto) filter (where r.estado = 'pendiente'), 0)            as en_retiro,
  u.saldo                                                                     as saldo_total
from public.usuarios u
left join public.solicitudes_retiro r on r.usuario_id = u.id
group by u.id, u.saldo;

grant select on public.saldos to authenticated;

-- ============================================================
-- PASO 2: solicitar_retiro — NO descuenta saldo
-- ============================================================
create or replace function public.solicitar_retiro(
  p_monto          numeric,
  p_nombre_titular text,
  p_banco          text,
  p_clabe          text default null,
  p_numero_tarjeta text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid    := auth.uid();
  v_saldo_actual numeric;
  v_en_retiro    numeric;
  v_disponible   numeric;
  v_retiro_id    uuid;
begin
  if p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0.';
  end if;
  if p_clabe is null and p_numero_tarjeta is null then
    raise exception 'Debes proporcionar CLABE o número de tarjeta.';
  end if;

  select u.saldo,
         coalesce((
           select sum(r.monto)
           from solicitudes_retiro r
           where r.usuario_id = v_uid and r.estado = 'pendiente'
         ), 0)
  into v_saldo_actual, v_en_retiro
  from usuarios u
  where u.id = v_uid
  for update;

  if not found then
    raise exception 'Usuario no encontrado.';
  end if;

  v_disponible := v_saldo_actual - v_en_retiro;

  if v_disponible < p_monto then
    raise exception 'Saldo insuficiente. Disponible: $%. En retiro: $%.',
      v_disponible, v_en_retiro;
  end if;

  insert into solicitudes_retiro(
    usuario_id, monto, nombre_titular, banco, clabe, numero_tarjeta, saldo_descontado
  ) values (
    v_uid, p_monto, p_nombre_titular, p_banco, p_clabe, p_numero_tarjeta, false
  ) returning id into v_retiro_id;

  perform registrar_movimiento(
    v_uid, 'retiro_solicitado', -p_monto,
    format('Solicitud de retiro por $%s — pendiente de aprobación', p_monto)
  );

  return v_retiro_id;
end;
$$;

-- ============================================================
-- PASO 3: resolver_retiro — descuenta solo al aprobar
-- ============================================================
create or replace function public.resolver_retiro(
  p_retiro_id uuid,
  p_aprobar   boolean,
  p_nota      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retiro    solicitudes_retiro;
  v_es_admin  boolean;
  v_ok        boolean;
begin
  select es_admin into v_es_admin
  from usuarios where id = auth.uid();

  if coalesce(v_es_admin, false) = false then
    raise exception 'No tienes permisos de administrador.';
  end if;

  select * into v_retiro
  from solicitudes_retiro
  where id = p_retiro_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada.';
  end if;

  if v_retiro.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue resuelta (estado: %).', v_retiro.estado;
  end if;

  if p_aprobar then
    update usuarios
    set saldo = saldo - v_retiro.monto
    where id = v_retiro.usuario_id
      and saldo >= v_retiro.monto
    returning true into v_ok;

    if v_ok is null then
      raise exception 'Saldo insuficiente al momento de aprobar.';
    end if;

    update solicitudes_retiro
    set estado           = 'aprobado',
        nota_admin       = p_nota,
        resuelto_en      = now(),
        saldo_descontado = true
    where id = p_retiro_id;

    perform registrar_movimiento(
      v_retiro.usuario_id, 'retiro_aprobado', -v_retiro.monto,
      format('Retiro aprobado%s',
             case when p_nota is not null then ': ' || p_nota else '' end)
    );

  else
    update solicitudes_retiro
    set estado      = 'rechazado',
        nota_admin  = p_nota,
        resuelto_en = now()
    where id = p_retiro_id;

    perform registrar_movimiento(
      v_retiro.usuario_id, 'retiro_cancelado', v_retiro.monto,
      format('Retiro rechazado%s',
             case when p_nota is not null then ': ' || p_nota else '' end)
    );
  end if;
end;
$$;

grant execute on function public.solicitar_retiro to authenticated;
grant execute on function public.resolver_retiro  to authenticated;
