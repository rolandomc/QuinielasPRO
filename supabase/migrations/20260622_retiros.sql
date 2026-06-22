-- ============================================================
-- TABLA: solicitudes_retiro
-- ============================================================
create table if not exists public.solicitudes_retiro (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users(id) on delete cascade,
  monto            numeric(10,2) not null check (monto > 0),
  estado           text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  nombre_titular   text not null,
  banco            text not null,
  clabe            text,
  numero_tarjeta   text,
  nota_admin       text,
  creado_en        timestamptz not null default now(),
  resuelto_en      timestamptz,
  constraint al_menos_un_destino check (
    clabe is not null or numero_tarjeta is not null
  )
);

-- Índices útiles
create index if not exists idx_retiros_usuario  on public.solicitudes_retiro(usuario_id);
create index if not exists idx_retiros_estado   on public.solicitudes_retiro(estado);
create index if not exists idx_retiros_creado   on public.solicitudes_retiro(creado_en desc);

-- RLS
alter table public.solicitudes_retiro enable row level security;

-- Usuario sólo ve sus propias solicitudes
create policy "usuario_ve_sus_retiros" on public.solicitudes_retiro
  for select using (auth.uid() = usuario_id);

-- Usuario sólo puede insertar las suyas (y sólo si no hay otra pendiente)
create policy "usuario_inserta_retiros" on public.solicitudes_retiro
  for insert with check (auth.uid() = usuario_id);

-- Admin puede ver todas
create policy "admin_ve_todos_retiros" on public.solicitudes_retiro
  for select using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.es_admin = true
    )
  );

-- Admin puede actualizar (aprobar/rechazar)
create policy "admin_actualiza_retiros" on public.solicitudes_retiro
  for update using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.es_admin = true
    )
  );

-- ============================================================
-- COLUMNA saldo en tabla usuarios (si no existe)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'usuarios'
      and column_name  = 'saldo'
  ) then
    alter table public.usuarios add column saldo numeric(10,2) not null default 0
      check (saldo >= 0);
  end if;
end $$;

-- ============================================================
-- FUNCIÓN: solicitar_retiro
-- Llama el usuario desde la app. Descuenta saldo y crea solicitud.
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
  v_uid         uuid := auth.uid();
  v_saldo_actual numeric;
  v_retiro_id   uuid;
begin
  -- Validaciones básicas
  if p_monto <= 0 then
    raise exception 'El monto debe ser mayor a 0.';
  end if;
  if p_clabe is null and p_numero_tarjeta is null then
    raise exception 'Debes proporcionar CLABE o número de tarjeta.';
  end if;

  -- Verificar que no tenga ya una solicitud pendiente
  if exists (
    select 1 from solicitudes_retiro
    where usuario_id = v_uid and estado = 'pendiente'
  ) then
    raise exception 'Ya tienes una solicitud de retiro pendiente.';
  end if;

  -- Verificar saldo suficiente y descontarlo (en una sola operación atómica)
  update usuarios
  set saldo = saldo - p_monto
  where id = v_uid and saldo >= p_monto
  returning saldo into v_saldo_actual;

  if not found then
    raise exception 'Saldo insuficiente para realizar el retiro.';
  end if;

  -- Crear la solicitud
  insert into solicitudes_retiro (
    usuario_id, monto, nombre_titular, banco, clabe, numero_tarjeta
  ) values (
    v_uid, p_monto, p_nombre_titular, p_banco, p_clabe, p_numero_tarjeta
  ) returning id into v_retiro_id;

  return v_retiro_id;
end;
$$;

-- ============================================================
-- FUNCIÓN: resolver_retiro
-- Llama el admin desde la app. Aprueba o rechaza.
-- Si rechaza → devuelve el saldo al usuario.
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
  v_retiro  solicitudes_retiro;
  v_es_admin boolean;
begin
  -- Verificar que quien llama es admin
  select es_admin into v_es_admin
  from usuarios where id = auth.uid();

  if not v_es_admin then
    raise exception 'No tienes permisos de administrador.';
  end if;

  -- Obtener la solicitud (bloquear fila)
  select * into v_retiro
  from solicitudes_retiro
  where id = p_retiro_id
  for update;

  if not found then
    raise exception 'Solicitud no encontrada.';
  end if;

  if v_retiro.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue resuelta (estado: %).' , v_retiro.estado;
  end if;

  if p_aprobar then
    -- Marcar como aprobado
    update solicitudes_retiro
    set estado       = 'aprobado',
        nota_admin   = p_nota,
        resuelto_en  = now()
    where id = p_retiro_id;

    -- El saldo ya fue descontado al crear la solicitud → no hacer nada más.
  else
    -- Rechazar → devolver saldo al usuario
    update solicitudes_retiro
    set estado       = 'rechazado',
        nota_admin   = p_nota,
        resuelto_en  = now()
    where id = p_retiro_id;

    update usuarios
    set saldo = saldo + v_retiro.monto
    where id = v_retiro.usuario_id;
  end if;
end;
$$;

-- Dar permiso de ejecución a usuarios autenticados
grant execute on function public.solicitar_retiro to authenticated;
grant execute on function public.resolver_retiro  to authenticated;
