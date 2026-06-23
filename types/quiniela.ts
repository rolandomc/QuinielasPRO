/**
 * types/quiniela.ts
 * Interfaces para quinielas, jornadas, partidos y predicciones.
 */

/** Jornada de quiniela tal como viene de la tabla `jornadas`. */
export interface Jornada {
  id: string;
  nombre: string;
  estado: 'abierta' | 'cerrada' | 'finalizada';
  precio?: number | null;
  porcentaje_organizador?: number | null;
  bolsa_total?: number | null;
}

/** Partido dentro de una jornada. */
export interface Partido {
  id: string;
  local: string;
  visitante: string;
  fecha: string;
  jornada_id: string;
  cerrado: boolean;
}

/** Registro de quiniela del usuario en la tabla `quinielas`. */
export interface QuinielaDB {
  id: string;
  usuario_id: string;
  jornada_id: string;
  estado_pago: EstadoPago;
  aciertos: number;
}

/** Estados de pago de una quiniela. */
export type EstadoPago = 'pendiente' | 'pagado';

/** Resultado posible para un partido (1 local, X empate, 2 visitante). */
export type Resultado = '1' | 'X' | '2';

/** Marcador pronosticado para un partido. */
export interface Marcador {
  local: string;
  visitante: string;
}

/** Predicción guardada en la tabla `predicciones`. */
export interface Prediccion {
  partido_id: string;
  usuario_id: string;
  resultado: Resultado;
  goles_local: number | null;
  goles_visitante: number | null;
}

/** Mapa de resultado seleccionado por partido (clave = partido_id). */
export type MapaResultados = Record<string, Resultado>;

/** Mapa de marcador pronosticado por partido (clave = partido_id). */
export type MapaMarcadores = Record<string, Marcador>;
