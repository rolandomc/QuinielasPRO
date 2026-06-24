-- =============================================================
-- Migración: Premios → Billetera
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================
-- Esta función es llamada desde calcularGanador() en admin.tsx
-- Acredita el premio al saldo del usuario y crea el movimiento.
-- Es idempotente: si la quiniela ya tiene premio_acreditado=true
-- no hace nada.
-- =============================================================

CREATE OR REPLACE FUNCTION acreditar_premio(
  p_quiniela_id  UUID,
  p_usuario_id   UUID,
  p_monto        NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ya_acreditado BOOLEAN;
BEGIN
  -- Verificar idempotencia
  SELECT COALESCE(premio_acreditado, FALSE)
    INTO v_ya_acreditado
    FROM quinielas
   WHERE id = p_quiniela_id;

  IF v_ya_acreditado THEN
    RETURN; -- Ya se acreditó, salir sin hacer nada
  END IF;

  -- 1. Sumar al saldo del usuario
  UPDATE usuarios
     SET saldo = COALESCE(saldo, 0) + p_monto
   WHERE id = p_usuario_id;

  -- 2. Crear movimiento tipo 'premio'
  INSERT INTO movimientos (usuario_id, tipo, monto, descripcion, creado_at)
  VALUES (
    p_usuario_id,
    'premio',
    p_monto,
    'Premio quiniela ganada',
    NOW()
  );

  -- 3. Marcar quiniela como acreditada (evita doble cobro)
  UPDATE quinielas
     SET premio_acreditado = TRUE
   WHERE id = p_quiniela_id;

END;
$$;

-- Columna de control de idempotencia (agregar si no existe)
ALTER TABLE quinielas
  ADD COLUMN IF NOT EXISTS premio_acreditado BOOLEAN DEFAULT FALSE;

-- =============================================================
-- Migración: Webhook idempotente — bolsa_total
-- =============================================================
-- Función llamada por el webhook de MercadoPago al confirmar pago.
-- Actualiza estado, monto_cobrado y recalcula bolsa_total.
-- Idempotente: si ya estaba 'pagado', no hace nada.
-- =============================================================

CREATE OR REPLACE FUNCTION confirmar_pago_quiniela(
  p_usuario_id  UUID,
  p_jornada_id  UUID,
  p_monto       NUMERIC,
  p_mp_id       TEXT  -- ID de pago de MercadoPago para idempotencia
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  -- Verificar estado actual
  SELECT estado_pago
    INTO v_estado
    FROM quinielas
   WHERE usuario_id = p_usuario_id
     AND jornada_id = p_jornada_id;

  -- Idempotencia: si ya está pagado, no hacer nada
  IF v_estado = 'pagado' THEN
    RETURN;
  END IF;

  -- 1. Actualizar quiniela
  UPDATE quinielas
     SET estado_pago    = 'pagado',
         monto_cobrado  = p_monto,
         mp_pago_id     = p_mp_id
   WHERE usuario_id = p_usuario_id
     AND jornada_id = p_jornada_id;

  -- 2. Recalcular bolsa_total de la jornada
  UPDATE jornadas
     SET bolsa_total = (
           SELECT COALESCE(SUM(monto_cobrado), 0)
             FROM quinielas
            WHERE jornada_id = p_jornada_id
              AND estado_pago = 'pagado'
         )
   WHERE id = p_jornada_id;

END;
$$;

-- Columnas necesarias si no existen
ALTER TABLE quinielas
  ADD COLUMN IF NOT EXISTS monto_cobrado NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mp_pago_id    TEXT;
