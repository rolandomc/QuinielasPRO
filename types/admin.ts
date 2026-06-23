/**
 * types/admin.ts
 * Interfaces específicas del panel de administración.
 */

import type { Jornada, Partido } from './quiniela';
import type { Usuario } from './usuario';

/** Estadísticas generales para el dashboard de admin. */
export interface StatsAdmin {
  totalUsuarios: number;
  totalQuinielas: number;
  totalRecaudado: number;
  jornadasActivas: number;
}

/** Vista de usuario enriquecida para el panel admin. */
export interface UsuarioAdmin extends Usuario {
  total_quinielas?: number;
  ultima_actividad?: string;
}

/** Jornada con datos extra para el panel admin. */
export interface JornadaAdmin extends Jornada {
  total_participantes?: number;
  total_recaudado?: number;
  ganador_id?: string | null;
  ganador?: Pick<Usuario, 'nombre' | 'username'> | null;
}

/** Partido con resultado final (para admin al cerrar jornada). */
export interface PartidoAdmin extends Partido {
  goles_local?: number | null;
  goles_visitante?: number | null;
  resultado_final?: '1' | 'X' | '2' | null;
}
