-- ============================================================
-- VISTA: saldos
-- Calcula disponible y en_retiro desde public.usuarios
-- ============================================================
create or replace view public.saldos as
select
  u.id                                                         as usuario_id,
  u.saldo - coalesce(sum(r.monto) filter (where r.estado = 'pendiente'), 0) as disponible,
  coalesce(sum(r.monto) filter (where r.estado = 'pendiente'), 0)           as en_retiro
from public.usuarios u
left join public.solicitudes_retiro r on r.usuario_id = u.id
group by u.id, u.saldo;

-- RLS: usuario solo ve su propia fila
grant select on public.saldos to authenticated;

-- ============================================================
-- TABLA: movimientos
-- Historial de entradas/salidas de saldo del usuario
-- ============================================================
create table if not exists public.movimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        text not null,   -- deposito | premio | retiro | retiro_cancelado | ajuste_admin
  monto       numeric(10,2) not null,  -- positivo = entrada, negativo = salida
  descripcion text,
  creado_en   timestamptz not null default now()
);

create index if not exists idx_movimientos_usuario on public.movimientos(usuario_id);
create index if not exists idx_movimientos_fecha   on public.movimientos(creado_en desc);

alter table public.movimientos enable row level security;

drop policy if exists "usuario_ve_sus_movimientos" on public.movimientos;
create policy "usuario_ve_sus_movimientos" on public.movimientos
  for select using (auth.uid() = usuario_id);

drop policy if exists "admin_ve_todos_movimientos" on public.movimientos;
create policy "admin_ve_todos_movimientos" on public.movimientos
  for select using (
    exists (select 1 from public.usuarios where id = auth.uid() and es_admin = true)
  );

-- Solo el sistema (SECURITY DEFINER) puede insertar movimientos
-- ============================================================
-- FUNCIÓN: registrar_movimiento  (uso interno)
-- ============================================================
create or replace function public.registrar_movimiento(
  p_usuario_id  uuid,
  p_tipo        text,
  p_monto       numeric,
  p_descripcion text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into movimientos(usuario_id, tipo, monto, descripcion)
  values (p_usuario_id, p_tipo, p_monto, p_descripcion);
end;
$$;

grant execute on function public.registrar_movimiento to authenticated;

-- ============================================================
-- Actualizar solicitar_retiro para registrar movimiento
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
  v_uid        uuid := auth.uid();
  v_saldo_curr numeric;
  v_retiro_id  uuid;
begin
  if p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0.';
  end if;
  if p_clabe is null and p_numero_tarjeta is null then
    raise exception 'Debes proporcionar CLABE o número de tarjeta.';
  end if;
  if exists (
    select 1 from solicitudes_retiro
    where usuario_id = v_uid and estado = 'pendiente'
  ) then
    raise exception 'Ya tienes una solicitud de retiro pendiente.';
  end if;

  -- Descontar saldo (la vista lo mostrará como "en_retiro")
  update usuarios
  set saldo = saldo - p_monto
  where id = v_uid and saldo >= p_monto
  returning saldo into v_saldo_curr;

  if not found then
    raise exception 'Saldo insuficiente para realizar el retiro.';
  end if;

  insert into solicitudes_retiro(
    usuario_id, monto, nombre_titular, banco, clabe, numero_tarjeta
  ) values (
    v_uid, p_monto, p_nombre_titular, p_banco, p_clabe, p_numero_tarjeta
  ) returning id into v_retiro_id;

  -- Registrar movimiento de salida
  perform registrar_movimiento(v_uid, 'retiro', -p_monto,
    'Solicitud de retiro #' || v_retiro_id::text);

  return v_retiro_id;
end;
$$;

-- ============================================================
-- Actualizar resolver_retiro para registrar movimiento al rechazar
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
  v_retiro   solicitudes_retiro;
  v_es_admin boolean;
begin
  select es_admin into v_es_admin
  from usuarios where id = auth.uid();

  if not v_es_admin then
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
    update solicitudes_retiro
    set estado = 'aprobado', nota_admin = p_nota, resuelto_en = now()
    where id = p_retiro_id;
    -- Movimiento ya fue registrado al crear la solicitud (salida)
  else
    update solicitudes_retiro
    set estado = 'rechazado', nota_admin = p_nota, resuelto_en = now()
    where id = p_retiro_id;

    -- Devolver saldo al usuario
    update usuarios
    set saldo = saldo + v_retiro.monto
    where id = v_retiro.usuario_id;

    -- Registrar movimiento de devolución
    perform registrar_movimiento(
      v_retiro.usuario_id, 'retiro_cancelado', v_retiro.monto,
      'Retiro rechazado — ' || coalesce(p_nota, 'sin nota')
    );
  end if;
end;
$$;

grant execute on function public.solicitar_retiro to authenticated;
grant execute on function public.resolver_retiro  to authenticated;
