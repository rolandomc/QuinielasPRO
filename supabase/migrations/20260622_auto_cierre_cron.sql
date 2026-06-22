-- ================================================================
-- AUTO-CIERRE DE JORNADA: función SQL que puede ser llamada por
-- pg_cron (Supabase cron jobs) cada minuto.
-- ================================================================

-- Habilitar pg_cron si no está habilitado
-- (ya viene habilitado en Supabase por defecto)

CREATE OR REPLACE FUNCTION cerrar_jornadas_automatico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jornada   RECORD;
  v_primer_partido_fecha TIMESTAMPTZ;
BEGIN
  -- Iterar sobre cada jornada abierta
  FOR v_jornada IN
    SELECT id, nombre FROM jornadas WHERE estado = 'abierta'
  LOOP
    -- Obtener la fecha del partido más temprano
    SELECT fecha INTO v_primer_partido_fecha
    FROM partidos
    WHERE jornada_id = v_jornada.id
    ORDER BY fecha ASC
    LIMIT 1;

    -- Si ya pasó la hora del primer partido → cerrar
    IF v_primer_partido_fecha IS NOT NULL AND v_primer_partido_fecha <= NOW() THEN
      UPDATE jornadas SET estado = 'cerrada' WHERE id = v_jornada.id;
      RAISE NOTICE 'Jornada cerrada automáticamente: %', v_jornada.nombre;
    END IF;
  END LOOP;
END;
$$;

-- ================================================================
-- CRON JOB: ejecutar la función cada minuto
-- Requiere extensión pg_cron habilitada en Supabase
-- Ir a: Dashboard → Database → Extensions → buscar pg_cron → Enable
-- Luego ejecutar este bloque:
-- ================================================================

-- Eliminar job previo si existe
SELECT cron.unschedule('auto-cerrar-jornadas')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-cerrar-jornadas'
);

-- Crear el cron job (cada minuto)
SELECT cron.schedule(
  'auto-cerrar-jornadas',   -- nombre del job
  '* * * * *',              -- cada minuto
  $$SELECT cerrar_jornadas_automatico();$$
);
