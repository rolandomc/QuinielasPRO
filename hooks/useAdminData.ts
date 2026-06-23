/**
 * hooks/useAdminData.ts
 * Hook centralizado con toda la lógica de datos del panel admin.
 * El componente admin.tsx solo llama funciones de aquí — sin queries inline.
 */
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apifb } from '../lib/apiFootball';
import { calcularGanador, type ResumenGanador } from '../lib/ganador';
import { avisar, confirmar } from '../lib/adminHelpers';

export type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null; api_fixture_id:number|null; goles_local_real:number|null; goles_visitante_real:number|null };
export type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null; porcentaje_organizador?:number|null };
export type Quiniela = { id:string; estado_pago:string; codigo:string|null; jornada_id:string; usuario_id:string; monto_cobrado:number|null; usuarios:{nombre:string;username:string}|null };
export type Fixture  = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}}; goals?:{home:number|null;away:number|null} };

export function useAdminData() {
  const [jornadas,    setJornadas]    = useState<Jornada[]>([]);
  const [partidos,    setPartidos]    = useState<Partido[]>([]);
  const [quinielas,   setQuinielas]   = useState<Quiniela[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [borrando,    setBorrando]    = useState<string|null>(null);
  const [syncingById, setSyncingById] = useState<Record<string,boolean>>({});
  const [retirosPendientes, setRetirosPendientes] = useState(0);

  // ─── Ganador ────────────────────────────────────────────────────────────
  const [modalGanador,   setModalGanador]   = useState(false);
  const [resumenGanador, setResumenGanador] = useState<ResumenGanador|null>(null);
  const [calculando,     setCalculando]     = useState(false);

  // ─── Modal resultado ────────────────────────────────────────────────────
  const [modalResultado,      setModalResultado]      = useState(false);
  const [partidoSel,          setPartidoSel]          = useState<Partido|null>(null);
  const [resultadoInput,      setResultadoInput]      = useState<'1'|'X'|'2'|null>(null);
  const [golesLocalInput,     setGolesLocalInput]     = useState('');
  const [golesVisitanteInput, setGolesVisitanteInput] = useState('');
  const [saving,              setSaving]              = useState(false);

  // ─── Modal precio ───────────────────────────────────────────────────────
  const [modalPrecio,      setModalPrecio]      = useState(false);
  const [jornadaPrecioSel, setJornadaPrecioSel] = useState<Jornada|null>(null);
  const [precioInput,      setPrecioInput]      = useState('');
  const [porcOrgInput,     setPorcOrgInput]     = useState('');
  const [savingPrecio,     setSavingPrecio]     = useState(false);

  // ─── Cargar datos ────────────────────────────────────────────────────────
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const [{ data: j }, { data: p }, { data: q }, { data: r }] = await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at', { ascending: false }),
      supabase.from('partidos').select('*').order('fecha'),
      supabase.from('quinielas').select('id,estado_pago,codigo,jornada_id,usuario_id,monto_cobrado,usuarios(nombre,username)'),
      supabase.from('solicitudes_retiro').select('id').eq('estado', 'pendiente'),
    ]);
    if (j) setJornadas(j);
    if (p) setPartidos(p);
    if (q) setQuinielas(q as any);
    setRetirosPendientes((r || []).length);
    setLoading(false);
  }, []);

  // ─── Recalcular aciertos ─────────────────────────────────────────────────
  const recalcularAciertos = useCallback(async (jornada_id: string) => {
    const { data: pJs } = await supabase
      .from('partidos').select('id,resultado_final')
      .eq('jornada_id', jornada_id).not('resultado_final', 'is', null);
    if (!pJs?.length) return;
    const ids = pJs.map(p => p.id);
    const { data: qJs } = await supabase
      .from('quinielas').select('id,usuario_id').eq('jornada_id', jornada_id);
    for (const q of (qJs || [])) {
      const { data: preds } = await supabase
        .from('predicciones').select('partido_id,resultado')
        .eq('usuario_id', q.usuario_id).in('partido_id', ids);
      const aciertos = (preds || []).filter(
        pr => pJs.find(x => x.id === pr.partido_id)?.resultado_final === pr.resultado
      ).length;
      await supabase.from('quinielas').update({ aciertos }).eq('id', q.id);
    }
  }, []);

  // ─── Acciones de jornada ─────────────────────────────────────────────────
  const cerrarJornada = useCallback((j: Jornada) => {
    confirmar('Cerrar jornada', `¿Cerrar "${j.nombre}"? Los usuarios ya no podrán editar.`, async () => {
      await supabase.from('jornadas').update({ estado: 'cerrada' }).eq('id', j.id);
      await supabase.from('partidos').update({ cerrado: true }).eq('jornada_id', j.id);
      await cargarDatos();
      avisar('✅ Cerrada', `"${j.nombre}" cerrada.`);
    });
  }, [cargarDatos]);

  const finalizarJornada = useCallback((j: Jornada) => {
    confirmar('Finalizar', `¿Marcar "${j.nombre}" como FINALIZADA?`, async () => {
      await supabase.from('jornadas').update({ estado: 'finalizada' }).eq('id', j.id);
      await cargarDatos();
    });
  }, [cargarDatos]);

  const borrarJornada = useCallback((j: Jornada, onBorrado?: () => void) => {
    confirmar('⚠️ Borrar', `¿Eliminar "${j.nombre}" permanentemente?`, async () => {
      setBorrando(j.id);
      try {
        const { data: psDB } = await supabase.from('partidos').select('id').eq('jornada_id', j.id);
        const psIds = (psDB || []).map((p: any) => p.id);
        if (psIds.length > 0) await supabase.from('predicciones').delete().in('partido_id', psIds);
        await supabase.from('quinielas').delete().eq('jornada_id', j.id);
        await supabase.from('partidos').delete().eq('jornada_id', j.id);
        await supabase.from('jornadas').delete().eq('id', j.id);
        await cargarDatos();
        onBorrado?.();
        avisar('🗑️ Eliminada', `"${j.nombre}" eliminada.`);
      } catch (e: any) {
        avisar('Error', e.message);
        await cargarDatos();
      } finally {
        setBorrando(null);
      }
    });
  }, [cargarDatos]);

  // ─── Sincronizar resultados API ──────────────────────────────────────────
  const sincronizarResultados = useCallback(async (j: Jornada, partidosLocales: Partido[]) => {
    if (!j.api_competition_id || !j.api_season || !j.api_matchday) {
      avisar('Sin datos API', 'Falta competition_id, season o matchday.');
      return;
    }
    setSyncingById(prev => ({ ...prev, [j.id]: true }));
    try {
      const round = `Regular Season - ${j.api_matchday}`;
      const data = await apifb.fixturesPorRound(j.api_competition_id, j.api_season, round);
      const matches: Fixture[] = data.response || [];
      if (!matches.length) { avisar('Sin datos', 'La API no devolvió partidos.'); return; }
      const ps = partidosLocales.filter(p => p.jornada_id === j.id && p.api_fixture_id);
      let actualizados = 0;
      for (const p of ps) {
        const match = matches.find(m => m.fixture.id === p.api_fixture_id);
        if (!match || match.fixture.status.short !== 'FT') continue;
        const goals = match.goals;
        if (goals?.home == null || goals?.away == null) continue;
        const res = goals.home > goals.away ? '1' : goals.away > goals.home ? '2' : 'X';
        await supabase.from('partidos').update({
          resultado_final: res, cerrado: true,
          goles_local_real: goals.home, goles_visitante_real: goals.away,
        }).eq('id', p.id).eq('jornada_id', j.id);
        actualizados++;
      }
      if (actualizados > 0) await recalcularAciertos(j.id);
      await cargarDatos();
      avisar('✅ Sincronizado', `${actualizados} resultado(s) actualizado(s).`);
    } catch (e) {
      avisar('Error', String(e));
    } finally {
      setSyncingById(prev => ({ ...prev, [j.id]: false }));
    }
  }, [cargarDatos, recalcularAciertos]);

  // ─── Guardar resultado manual ────────────────────────────────────────────
  const guardarResultado = useCallback(async () => {
    if (!resultadoInput || !partidoSel) return;
    setSaving(true);
    const gl = golesLocalInput !== '' ? parseInt(golesLocalInput, 10) : null;
    const gv = golesVisitanteInput !== '' ? parseInt(golesVisitanteInput, 10) : null;
    let res: '1' | 'X' | '2' = resultadoInput;
    if (gl != null && gv != null) res = gl > gv ? '1' : gv > gl ? '2' : 'X';
    await supabase.from('partidos').update({
      resultado_final: res, cerrado: true,
      goles_local_real: gl, goles_visitante_real: gv,
    }).eq('id', partidoSel.id);
    await recalcularAciertos(partidoSel.jornada_id);
    setSaving(false);
    setModalResultado(false);
    await cargarDatos();
  }, [resultadoInput, partidoSel, golesLocalInput, golesVisitanteInput, cargarDatos, recalcularAciertos]);

  // ─── Calcular ganador ────────────────────────────────────────────────────
  const handleCalcularGanador = useCallback(async (j: Jornada) => {
    setCalculando(true);
    setResumenGanador(null);
    setModalGanador(true);
    try {
      const resumen = await calcularGanador(j.id);
      setResumenGanador(resumen);
    } catch (e: any) {
      avisar('Error', e.message);
      setModalGanador(false);
    }
    setCalculando(false);
  }, []);

  // ─── Pago de quinielas ───────────────────────────────────────────────────
  const marcarPagado = useCallback(async (qId: string, jornadaId: string, jornadasList: Jornada[]) => {
    const jornada = jornadasList.find(j => j.id === jornadaId);
    const monto = jornada?.precio ?? 0;
    await supabase.from('quinielas').update({ estado_pago: 'pagado', monto_cobrado: monto }).eq('id', qId);
    // Recalcular bolsa
    const { data: qsPag } = await supabase
      .from('quinielas').select('monto_cobrado')
      .eq('jornada_id', jornadaId).eq('estado_pago', 'pagado');
    const nuevaBolsa = (qsPag || []).reduce((s, q) => s + (q.monto_cobrado ?? 0), 0);
    await supabase.from('jornadas').update({ bolsa_total: nuevaBolsa }).eq('id', jornadaId);
    await cargarDatos();
  }, [cargarDatos]);

  const marcarPendiente = useCallback(async (qId: string) => {
    await supabase.from('quinielas').update({ estado_pago: 'pendiente' }).eq('id', qId);
    await cargarDatos();
  }, [cargarDatos]);

  // ─── Guardar precio ──────────────────────────────────────────────────────
  const guardarPrecio = useCallback(async () => {
    if (!jornadaPrecioSel) return;
    const precio = parseFloat(precioInput.replace(',', '.'));
    if (isNaN(precio) || precio < 0) { avisar('Precio inválido', 'Número >= 0.'); return; }
    const porcOrg = porcOrgInput !== '' ? parseInt(porcOrgInput, 10) : 0;
    if (isNaN(porcOrg) || porcOrg < 0 || porcOrg > 100) { avisar('% inválido', 'Entre 0 y 100.'); return; }
    setSavingPrecio(true);
    const { error } = await supabase
      .from('jornadas').update({ precio, porcentaje_organizador: porcOrg })
      .eq('id', jornadaPrecioSel.id);
    setSavingPrecio(false);
    if (error) { avisar('Error', error.message); return; }
    setModalPrecio(false);
    await cargarDatos();
  }, [jornadaPrecioSel, precioInput, porcOrgInput, cargarDatos]);

  // ─── Abrir modal precio ──────────────────────────────────────────────────
  const abrirModalPrecio = useCallback((j: Jornada) => {
    setJornadaPrecioSel(j);
    setPrecioInput(j.precio ? String(j.precio) : '');
    setPorcOrgInput(j.porcentaje_organizador != null ? String(j.porcentaje_organizador) : '0');
    setModalPrecio(true);
  }, []);

  // ─── Abrir modal resultado ───────────────────────────────────────────────
  const abrirModalResultado = useCallback((p: Partido) => {
    setPartidoSel(p);
    setResultadoInput((p.resultado_final as any) || null);
    setGolesLocalInput(p.goles_local_real != null ? String(p.goles_local_real) : '');
    setGolesVisitanteInput(p.goles_visitante_real != null ? String(p.goles_visitante_real) : '');
    setModalResultado(true);
  }, []);

  return {
    // Estado
    jornadas, partidos, quinielas, loading, borrando, syncingById, retirosPendientes,
    // Ganador
    modalGanador, setModalGanador, resumenGanador, calculando,
    // Resultado
    modalResultado, setModalResultado, partidoSel,
    resultadoInput, setResultadoInput,
    golesLocalInput, setGolesLocalInput,
    golesVisitanteInput, setGolesVisitanteInput,
    saving,
    // Precio
    modalPrecio, setModalPrecio, jornadaPrecioSel,
    precioInput, setPrecioInput,
    porcOrgInput, setPorcOrgInput,
    savingPrecio,
    // Acciones
    cargarDatos,
    cerrarJornada,
    finalizarJornada,
    borrarJornada,
    sincronizarResultados,
    guardarResultado,
    handleCalcularGanador,
    marcarPagado,
    marcarPendiente,
    guardarPrecio,
    abrirModalPrecio,
    abrirModalResultado,
  };
}
