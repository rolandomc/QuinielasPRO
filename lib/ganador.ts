import { supabase } from './supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────────────────
export interface ResumenGanador {
  ganador_usuario_id:     string | null;
  ganador_nombre:         string | null;
  bolsa_total:            number;
  bolsa_premio:           number;
  porcentaje_organizador: number;
  posiciones:             PosicionQuiniela[];
  empate_perfecto:        boolean;
  premio_por_ganador:     number;
}

export interface PosicionQuiniela {
  quiniela_id:         string;
  usuario_id:          string;
  nombre:              string;
  aciertos:            number;
  goles_pronosticados: number | null;
  diferencia_goles:    number | null;
  posicion:            number;
  premio_ganado:       number;
}

// ─── Función principal ──────────────────────────────────────────────────────────────
export async function calcularGanador(jornada_id: string): Promise<ResumenGanador | null> {

  // — 1. Cargar jornada —
  const { data: jornada, error: jErr } = await supabase
    .from('jornadas')
    .select('id, nombre, precio, porcentaje_organizador, bolsa_total')
    .eq('id', jornada_id)
    .single();
  if (jErr || !jornada) return null;

  // — 2. Quinielas pagadas —
  const { data: quinielas, error: qErr } = await supabase
    .from('quinielas')
    .select('id, usuario_id, aciertos, goles_pronosticados')
    .eq('jornada_id', jornada_id)
    .eq('estado_pago', 'pagado');
  if (qErr || !quinielas || quinielas.length === 0) return null;

  // — 3. Partidos de la jornada —
  const { data: partidos, error: pErr } = await supabase
    .from('partidos')
    .select('id, resultado_final, goles_local_real, goles_visitante_real')
    .eq('jornada_id', jornada_id);
  if (pErr || !partidos) return null;

  // — 4. Predicciones de todos los participantes —
  const partidoIds = partidos.map(p => p.id);
  const { data: predicciones, error: predErr } = await supabase
    .from('predicciones')
    .select('usuario_id, partido_id, resultado, goles_local, goles_visitante')
    .in('partido_id', partidoIds);
  if (predErr) return null;

  // — 5. Nombres de usuarios —
  const usuarioIds = [...new Set(quinielas.map(q => q.usuario_id))];
  const { data: perfiles } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .in('id', usuarioIds);

  const nombrePorId: Record<string, string> = {};
  (perfiles || []).forEach(p => { nombrePorId[p.id] = p.nombre || p.id; });

  // — 6. Goles reales totales (para desempate) —
  const golesReales = partidos.reduce((acc, p) =>
    acc + (p.goles_local_real ?? 0) + (p.goles_visitante_real ?? 0), 0);

  // — 7. Calcular aciertos y diferencia de goles por quiniela —
  const posicionesBruto = quinielas.map(q => {
    const predsUsuario = (predicciones || []).filter(pr => pr.usuario_id === q.usuario_id);

    const aciertos = predsUsuario.reduce((acc, pr) => {
      const partido = partidos.find(p => p.id === pr.partido_id);
      if (!partido?.resultado_final) return acc;
      return acc + (pr.resultado === partido.resultado_final ? 1 : 0);
    }, 0);

    const golesPronosticados = predsUsuario.reduce((acc, pr) =>
      acc + (pr.goles_local ?? 0) + (pr.goles_visitante ?? 0), 0);

    return {
      quiniela_id:         q.id,
      usuario_id:          q.usuario_id,
      nombre:              nombrePorId[q.usuario_id] ?? 'Jugador',
      aciertos,
      goles_pronosticados: golesPronosticados,
      diferencia_goles:    Math.abs(golesPronosticados - golesReales),
    };
  });

  // — 8. Ordenar: más aciertos primero, menor diferencia de goles como desempate —
  posicionesBruto.sort((a, b) => {
    if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
    return (a.diferencia_goles ?? 999) - (b.diferencia_goles ?? 999);
  });

  const posicionadas: PosicionQuiniela[] = posicionesBruto.map((p, i) => ({
    ...p, posicion: i + 1, premio_ganado: 0,
  }));

  // — 9. Calcular bolsa y premio —
  const porcOrg        = jornada.porcentaje_organizador ?? 0;
  const precioBase     = jornada.precio ?? 0;
  const bolsaTotal     = jornada.bolsa_total ?? quinielas.length * precioBase;
  const bolsaPremio    = bolsaTotal * ((100 - porcOrg) / 100);

  const lider        = posicionadas[0];
  const ganadores    = posicionadas.filter(
    g => g.aciertos === lider.aciertos && g.diferencia_goles === lider.diferencia_goles
  );
  const empatePerfecto   = ganadores.length > 1;
  const premioPorGanador = bolsaPremio / ganadores.length;
  ganadores.forEach(g => { g.premio_ganado = premioPorGanador; });

  // — 10. Guardar posiciones y aciertos en DB (reset primero para consistencia) —
  const quinielaIds = posicionadas.map(p => p.quiniela_id);
  await supabase.from('quinielas').update({ premio_ganado: 0 }).in('id', quinielaIds);

  for (const pos of posicionadas) {
    await supabase
      .from('quinielas')
      .update({
        aciertos:            pos.aciertos,
        goles_pronosticados: pos.goles_pronosticados,
        diferencia_goles:    pos.diferencia_goles,
        posicion:            pos.posicion,
        premio_ganado:       pos.premio_ganado,
      })
      .eq('id', pos.quiniela_id);
  }

  // — 11. Actualizar jornada con resumen final —
  await supabase
    .from('jornadas')
    .update({
      bolsa_total,
      bolsa_premio:       bolsaPremio,
      ganador_usuario_id: empatePerfecto ? null : ganadores[0].usuario_id,
    })
    .eq('id', jornada_id);

  // — 12. Acreditar premio a billetera de cada ganador (idempotente vía RPC) —
  for (const g of ganadores) {
    const { error: rpcErr } = await supabase.rpc('acreditar_premio', {
      p_quiniela_id: g.quiniela_id,
      p_usuario_id:  g.usuario_id,
      p_monto:       premioPorGanador,
    });
    if (rpcErr) {
      // Log sin lanzar excepción: el cálculo ya se guardó, el admin puede reintentar
      console.error(`[acreditar_premio] Error para quiniela ${g.quiniela_id}:`, rpcErr.message);
    } else {
      console.log(`✅ Premio acreditado: usuario=${g.usuario_id} monto=${premioPorGanador}`);
    }
  }

  return {
    ganador_usuario_id:     empatePerfecto ? null : ganadores[0].usuario_id,
    ganador_nombre:         empatePerfecto ? null : ganadores[0].nombre,
    bolsa_total:            bolsaTotal,
    bolsa_premio:           bolsaPremio,
    porcentaje_organizador: porcOrg,
    posiciones:             posicionadas,
    empate_perfecto:        empatePerfecto,
    premio_por_ganador:     premioPorGanador,
  };
}
