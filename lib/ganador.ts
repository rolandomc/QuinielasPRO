import { supabase } from './supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface ResumenGanador {
  ganador_usuario_id: string | null;
  ganador_nombre: string | null;
  bolsa_total: number;
  bolsa_premio: number;
  porcentaje_organizador: number;
  posiciones: PosicionQuiniela[];
  empate_perfecto: boolean;
  premio_por_ganador: number;
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

export async function calcularGanador(jornada_id: string): Promise<ResumenGanador | null> {
  const { data: jornada, error: jErr } = await supabase
    .from('jornadas')
    .select('id, nombre, precio, porcentaje_organizador, bolsa_total')
    .eq('id', jornada_id)
    .single();
  if (jErr || !jornada) return null;

  const { data: quinielas, error: qErr } = await supabase
    .from('quinielas')
    .select('id, usuario_id, aciertos, goles_pronosticados')
    .eq('jornada_id', jornada_id)
    .eq('estado_pago', 'pagado');
  if (qErr || !quinielas || quinielas.length === 0) return null;

  // CORREGIDO: resultado_final (no resultado_real)
  const { data: partidos, error: pErr } = await supabase
    .from('partidos')
    .select('id, resultado_final, goles_local_real, goles_visitante_real')
    .eq('jornada_id', jornada_id);
  if (pErr || !partidos) return null;

  const partidoIds = partidos.map(p => p.id);
  const { data: predicciones, error: predErr } = await supabase
    .from('predicciones')
    .select('usuario_id, partido_id, resultado, goles_local, goles_visitante')
    .in('partido_id', partidoIds);
  if (predErr) return null;

  const usuarioIds = [...new Set(quinielas.map(q => q.usuario_id))];
  const { data: perfiles } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .in('id', usuarioIds);
  const nombrePorId: Record<string, string> = {};
  (perfiles || []).forEach(p => { nombrePorId[p.id] = p.nombre || p.id; });

  const golesReales = partidos.reduce((acc, p) => {
    return acc + (p.goles_local_real ?? 0) + (p.goles_visitante_real ?? 0);
  }, 0);

  const posiciones: Omit<PosicionQuiniela, 'posicion' | 'premio_ganado'>[] = quinielas.map(q => {
    const predsUsuario = (predicciones || []).filter(pr => pr.usuario_id === q.usuario_id);

    // CORREGIDO: comparar con resultado_final
    const aciertos = predsUsuario.reduce((acc, pr) => {
      const partido = partidos.find(p => p.id === pr.partido_id);
      if (!partido?.resultado_final) return acc;
      return acc + (pr.resultado === partido.resultado_final ? 1 : 0);
    }, 0);

    const golesPronosticados = predsUsuario.reduce((acc, pr) => {
      return acc + (pr.goles_local ?? 0) + (pr.goles_visitante ?? 0);
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

  posiciones.sort((a, b) => {
    if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
    return (a.diferencia_goles ?? 999) - (b.diferencia_goles ?? 999);
  });

  const posicionadas: PosicionQuiniela[] = posiciones.map((p, i) => ({
    ...p,
    posicion: i + 1,
    premio_ganado: 0,
  }));

  const porcOrg = jornada.porcentaje_organizador ?? 0;
  const precioBase = jornada.precio ?? 0;
  const bolsaTotal = jornada.bolsa_total ?? quinielas.length * precioBase;
  const bolsaPremio = bolsaTotal * ((100 - porcOrg) / 100);

  const lider = posicionadas[0];
  const ganadores = posicionadas.filter(
    g => g.aciertos === lider.aciertos && g.diferencia_goles === lider.diferencia_goles
  );
  const empatePerfecto = ganadores.length > 1;
  const premioPorGanador = bolsaPremio / ganadores.length;

  ganadores.forEach(g => { g.premio_ganado = premioPorGanador; });

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
