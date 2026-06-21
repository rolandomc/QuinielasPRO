import { supabase } from './supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface ResumenGanador {
  ganador_usuario_id: string | null;
  ganador_nombre: string | null;
  bolsa_total: number;
  bolsa_premio: number;
  porcentaje_organizador: number;
  posiciones: PosicionQuiniela[];
  empate_perfecto: boolean;   // true si 2+ usuarios comparten el 1er lugar
  premio_por_ganador: number; // si hay empate, es bolsa_premio / n_ganadores
}

export interface PosicionQuiniela {
  quiniela_id: string;
  usuario_id: string;
  nombre: string;
  aciertos: number;
  goles_pronosticados: number | null;
  diferencia_goles: number | null;
  posicion: number;
  premio_ganado: number;
}

// ─── Función principal ────────────────────────────────────────────────────────
/**
 * Calcula el ganador de una jornada:
 * 1. Mayor número de aciertos gana.
 * 2. Desempate: menor diferencia absoluta entre goles pronosticados y reales.
 * 3. Si persiste el empate, se reparte el premio entre todos los empatados.
 * 4. Se descuenta porcentaje_organizador de la bolsa antes de repartir.
 */
export async function calcularGanador(jornada_id: string): Promise<ResumenGanador | null> {
  // 1. Datos de la jornada
  const { data: jornada, error: jErr } = await supabase
    .from('jornadas')
    .select('id, nombre, precio, porcentaje_organizador, bolsa_total')
    .eq('id', jornada_id)
    .single();
  if (jErr || !jornada) return null;

  // 2. Quinielas pagadas
  const { data: quinielas, error: qErr } = await supabase
    .from('quinielas')
    .select('id, usuario_id, aciertos, goles_pronosticados')
    .eq('jornada_id', jornada_id)
    .eq('estado_pago', 'pagado');
  if (qErr || !quinielas || quinielas.length === 0) return null;

  // 3. Partidos con resultado real y marcador real
  const { data: partidos, error: pErr } = await supabase
    .from('partidos')
    .select('id, resultado_real, goles_local_real, goles_visitante_real')
    .eq('jornada_id', jornada_id);
  if (pErr || !partidos) return null;

  // 4. Predicciones de todos los participantes
  const partidoIds = partidos.map(p => p.id);
  const { data: predicciones, error: predErr } = await supabase
    .from('predicciones')
    .select('usuario_id, partido_id, resultado, goles_local, goles_visitante')
    .in('partido_id', partidoIds);
  if (predErr) return null;

  // 5. Perfiles de usuarios
  const usuarioIds = [...new Set(quinielas.map(q => q.usuario_id))];
  const { data: perfiles } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .in('id', usuarioIds);
  const nombrePorId: Record<string, string> = {};
  (perfiles || []).forEach(p => { nombrePorId[p.id] = p.nombre || p.id; });

  // 6. Goles reales totales de la jornada
  const golesReales = partidos.reduce((acc, p) => {
    const gl = p.goles_local_real ?? 0;
    const gv = p.goles_visitante_real ?? 0;
    return acc + gl + gv;
  }, 0);

  // 7. Calcular aciertos y goles pronosticados por quiniela
  const posiciones: Omit<PosicionQuiniela, 'posicion' | 'premio_ganado'>[] = quinielas.map(q => {
    const predsUsuario = (predicciones || []).filter(pr => pr.usuario_id === q.usuario_id);

    // Aciertos: comparar resultado pronosticado vs resultado_real
    const aciertos = predsUsuario.reduce((acc, pr) => {
      const partido = partidos.find(p => p.id === pr.partido_id);
      if (!partido?.resultado_real) return acc;
      return acc + (pr.resultado === partido.resultado_real ? 1 : 0);
    }, 0);

    // Goles pronosticados totales
    const golesPronosticados = predsUsuario.reduce((acc, pr) => {
      const gl = pr.goles_local ?? 0;
      const gv = pr.goles_visitante ?? 0;
      return acc + gl + gv;
    }, 0);

    const diferencia = Math.abs(golesPronosticados - golesReales);

    return {
      quiniela_id: q.id,
      usuario_id: q.usuario_id,
      nombre: nombrePorId[q.usuario_id] ?? 'Jugador',
      aciertos,
      goles_pronosticados: golesPronosticados,
      diferencia_goles: diferencia,
    };
  });

  // 8. Ordenar: mayor aciertos primero, menor diferencia_goles como desempate
  posiciones.sort((a, b) => {
    if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
    return (a.diferencia_goles ?? 999) - (b.diferencia_goles ?? 999);
  });

  // 9. Asignar posiciones
  const posicionadas: PosicionQuiniela[] = posiciones.map((p, i) => ({
    ...p,
    posicion: i + 1,
    premio_ganado: 0,
  }));

  // 10. Calcular bolsa
  const porcOrg = jornada.porcentaje_organizador ?? 0;
  const precioBase = jornada.precio ?? 0;
  const bolsaTotal = jornada.bolsa_total ?? quinielas.length * precioBase;
  const bolsaPremio = bolsaTotal * ((100 - porcOrg) / 100);

  // 11. Determinar ganadores (pueden ser varios por empate perfecto)
  const lider = posicionadas[0];
  const ganadores = posicionadas.filter(
    g => g.aciertos === lider.aciertos && g.diferencia_goles === lider.diferencia_goles
  );
  const empatePerfecto = ganadores.length > 1;
  const premioPorGanador = bolsaPremio / ganadores.length;

  ganadores.forEach(g => { g.premio_ganado = premioPorGanador; });

  // 12. Persistir resultados en DB
  for (const pos of posicionadas) {
    await supabase
      .from('quinielas')
      .update({
        aciertos: pos.aciertos,
        goles_pronosticados: pos.goles_pronosticados,
        diferencia_goles: pos.diferencia_goles,
        posicion: pos.posicion,
        premio_ganado: pos.premio_ganado,
      })
      .eq('id', pos.quiniela_id);
  }

  // Actualizar jornada con bolsa y ganador
  await supabase
    .from('jornadas')
    .update({
      bolsa_total: bolsaTotal,
      bolsa_premio: bolsaPremio,
      ganador_usuario_id: empatePerfecto ? null : ganadores[0].usuario_id,
    })
    .eq('id', jornada_id);

  return {
    ganador_usuario_id: empatePerfecto ? null : ganadores[0].usuario_id,
    ganador_nombre: empatePerfecto ? null : ganadores[0].nombre,
    bolsa_total: bolsaTotal,
    bolsa_premio: bolsaPremio,
    porcentaje_organizador: porcOrg,
    posiciones: posicionadas,
    empate_perfecto: empatePerfecto,
    premio_por_ganador: premioPorGanador,
  };
}
