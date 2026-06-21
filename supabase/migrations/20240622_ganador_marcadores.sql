-- Marcadores pronosticados por usuario por partido
ALTER TABLE predicciones
  ADD COLUMN IF NOT EXISTS goles_local      INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goles_visitante  INTEGER DEFAULT NULL;

-- Resultado real del partido con marcador
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS goles_local_real      INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS goles_visitante_real  INTEGER DEFAULT NULL;

-- Columnas de desempate y premio en quinielas
ALTER TABLE quinielas
  ADD COLUMN IF NOT EXISTS goles_pronosticados  INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diferencia_goles     INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS posicion             INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS premio_ganado        NUMERIC(10,2) DEFAULT NULL;

-- Configuración de premio y ganador en jornadas
ALTER TABLE jornadas
  ADD COLUMN IF NOT EXISTS porcentaje_organizador  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bolsa_total             NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bolsa_premio            NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ganador_usuario_id      UUID REFERENCES auth.users(id) DEFAULT NULL;
