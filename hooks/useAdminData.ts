import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { apifb } from '../lib/apiFootball';
import { calcularGanador, ResumenGanador } from '../lib/ganador';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null; api_fixture_id:number|null; goles_local_real:number|null; goles_visitante_real:number|null };
export type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null; porcentaje_organizador?:number|null; ganador_usuario_id?:string|null };
export type Quiniela = { id:string; estado_pago:string; codigo:string|null; jornada_id:string; usuario_id:string; monto_cobrado:number|null; usuarios:{nombre:string;username:string}|null };
export type Fixture  = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}}; goals?:{home:number|null;away:number|null} };

// ─── Helpers de alerta ────────────────────────────────────────────────────────

export const confirmar = (titulo:string, mensaje:string, onConfirm:()=>void) => {
  if (Platform.OS === 'web') {
    if ((window as any).confirm(`${titulo}\n\n${mensaje}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje, [{ text:'Cancelar', style:'cancel' }, { text:'Confirmar', style:'destructive', onPress:onConfirm }]);
  }
};

export const avisar = (titulo:string, mensaje:string) => {
  if (Platform.OS === 'web') (window as any).alert(`${titulo}\n\n${mensaje}`);
  else { const { Alert } = require('react-native'); Alert.alert(titulo, mensaje); }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminData() {
  const [jornadas, setJornadas]             = useState<Jornada[]>([]);
  const [partidos, setPartidos]             = useState<Partido[]>([]);
  const [quinielas, setQuinielas]           = useState<Quiniela[]>([]);
  const [loading, setLoading]               = useState(true);
  const [retirosPendientes, setRetirosPendientes] = useState(0);
  const [syncingByJornada, setSyncingByJornada]   = useState<Record<string,boolean>>({});
  const [borrando, setBorrando]             = useState<string|null>(null);
  const [calculando, setCalculando]         = useState(false);
  const [resumenGanador, setResumenGanador] = useState<ResumenGanador|null>(null);

  useEffect(() => { cargarDatos(); }, []);

  // ── Carga ──────────────────────────────────────────────────────────────────

  const cargarDatos = async () => {
    setLoading(true);
    const [{ data:j }, { data:p }, { data:q }, { data:r }] = await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at', { ascending:false }),
      supabase.from('partidos').select('*').order('fecha'),
      supabase.from('quinielas').select('id,estado_pago,codigo,jornada_id,usuario_id,monto_cobrado,usuarios(nombre,username)'),
      supabase.from('solicitudes_retiro').select('id').eq('estado','pendiente'),
    ]);
    if (j) setJornadas(j);
    if (p) setPartidos(p);
    if (q) setQuinielas(q as any);
    setRetirosPendientes((r || []).length);
    setLoading(false);
  };

  // ── Recálculo de aciertos ──────────────────────────────────────────────────

  const recalcularAciertos = async (jornada_id:string) => {
    const { data:pJs } = await supabase.from('partidos').select('id,resultado_final').eq('jornada_id', jornada_id).not('resultado_final','is',null);
    if (!pJs?.length) return;
    const ids = pJs.map(p => p.id);
    const { data:qJs } = await supabase.from('quinielas').select('id,usuario_id').eq('jornada_id', jornada_id);
    for (const q of (qJs || [])) {
      const { data:preds } = await supabase.from('predicciones').select('partido_id,resultado').eq('usuario_id', q.usuario_id).in('partido_id', ids);
      const aciertos = (preds || []).filter(pr => pJs.find(x => x.id === pr.partido_id)?.resultado_final === pr.resultado).length;
      await supabase.from('quinielas').update({ aciertos }).eq('id', q.id);
    }
  };

  // ── Mutaciones de jornada ──────────────────────────────────────────────────

  const cerrarJornada = (j:Jornada) => {
    confirmar('Cerrar jornada', `¿Cerrar "${j.nombre}"? Los usuarios ya no podrán editar.`, async () => {
      await supabase.from('jornadas').update({ estado:'cerrada' }).eq('id', j.id);
      await supabase.from('partidos').update({ cerrado:true }).eq('jornada_id', j.id);
      await cargarDatos();
      avisar('✅ Cerrada', `"${j.nombre}" cerrada.`);
    });
  };

  const finalizarJornada = (j:Jornada) => {
    confirmar('Finalizar', `¿Marcar "${j.nombre}" como FINALIZADA?`, async () => {
      await supabase.from('jornadas').update({ estado:'finalizada' }).eq('id', j.id);
      await cargarDatos();
    });
  };

  const borrarJornada = (j:Jornada, onBorrado?:(id:string)=>void) => {
    confirmar('⚠️ Borrar', `¿Eliminar "${j.nombre}" permanentemente?`, async () => {
      setBorrando(j.id);
      try {
        const { data:psDB } = await supabase.from('partidos').select('id').eq('jornada_id', j.id);
        const psIds = (psDB || []).map((p:any) => p.id);
        if (psIds.length > 0) await supabase.from('predicciones').delete().in('partido_id', psIds);
        await supabase.from('quinielas').delete().eq('jornada_id', j.id);
        await supabase.from('partidos').delete().eq('jornada_id', j.id);
        await supabase.from('jornadas').delete().eq('id', j.id);
        await cargarDatos();
        onBorrado?.(j.id);
        avisar('🗑️ Eliminada', `"${j.nombre}" eliminada.`);
      } catch (e:any) {
        avisar('Error', e.message);
        await cargarDatos();
      } finally {
        setBorrando(null);
      }
    });
  };

  const sincronizarResultados = async (j:Jornada) => {
    if (!j.api_competition_id || !j.api_season || !j.api_matchday) {
      avisar('Sin datos API', 'Falta competition_id, season o matchday.'); return;
    }
    setSyncingByJornada(prev => ({ ...prev, [j.id]:true }));
    try {
      const round = `Regular Season - ${j.api_matchday}`;
      const data  = await apifb.fixturesPorRound(j.api_competition_id, j.api_season, round);
      const matches: Fixture[] = data.response || [];
      if (!matches.length) { avisar('Sin datos', 'La API no devolvió partidos.'); return; }
      const ps = partidos.filter(p => p.jornada_id === j.id && p.api_fixture_id);
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
    } catch (e) { avisar('Error', String(e)); }
    finally { setSyncingByJornada(prev => ({ ...prev, [j.id]:false })); }
  };

  const guardarResultado = async (
    partido: Partido,
    resultadoInput: '1'|'X'|'2',
    golesLocal: string,
    golesVisitante: string,
  ) => {
    const gl = golesLocal !== '' ? parseInt(golesLocal, 10) : null;
    const gv = golesVisitante !== '' ? parseInt(golesVisitante, 10) : null;
    let res: '1'|'X'|'2' = resultadoInput;
    if (gl != null && gv != null) res = gl > gv ? '1' : gv > gl ? '2' : 'X';
    await supabase.from('partidos').update({
      resultado_final: res, cerrado: true,
      goles_local_real: gl, goles_visitante_real: gv,
    }).eq('id', partido.id);
    await recalcularAciertos(partido.jornada_id);
    await cargarDatos();
  };

  // ── Mutaciones de quinielas ────────────────────────────────────────────────

  const marcarPagado = async (qId:string, jornadaId:string) => {
    const jornada = jornadas.find(j => j.id === jornadaId);
    const monto   = jornada?.precio ?? 0;
    await supabase.from('quinielas').update({ estado_pago:'pagado', monto_cobrado:monto }).eq('id', qId);
    const qsPagadas = quinielas.filter(q => q.jornada_id === jornadaId && (q.id === qId || q.estado_pago === 'pagado'));
    const nuevaBolsa = qsPagadas.length * (jornada?.precio ?? 0);
    await supabase.from('jornadas').update({ bolsa_total: nuevaBolsa }).eq('id', jornadaId);
    cargarDatos();
  };

  const marcarPendiente = async (qId:string) => {
    await supabase.from('quinielas').update({ estado_pago:'pendiente' }).eq('id', qId);
    cargarDatos();
  };

  // ── Precio ────────────────────────────────────────────────────────────────

  const guardarPrecio = async (jornadaId:string, precioStr:string, porcOrgStr:string): Promise<boolean> => {
    const precio = parseFloat(precioStr.replace(',', '.'));
    if (isNaN(precio) || precio < 0) { avisar('Precio inválido', 'Número >= 0.'); return false; }
    const porcOrg = porcOrgStr !== '' ? parseInt(porcOrgStr, 10) : 0;
    if (isNaN(porcOrg) || porcOrg < 0 || porcOrg > 100) { avisar('% inválido', 'Entre 0 y 100.'); return false; }
    const { error } = await supabase.from('jornadas').update({ precio, porcentaje_organizador: porcOrg }).eq('id', jornadaId);
    if (error) { avisar('Error', error.message); return false; }
    await cargarDatos();
    return true;
  };

  // ── Ganador ───────────────────────────────────────────────────────────────

  const handleCalcularGanador = async (jornadaId:string): Promise<ResumenGanador|null> => {
    setCalculando(true);
    setResumenGanador(null);
    try {
      const resumen = await calcularGanador(jornadaId);
      setResumenGanador(resumen);
      await cargarDatos();
      return resumen;
    } catch (e:any) {
      avisar('Error', e.message);
      return null;
    } finally {
      setCalculando(false);
    }
  };

  // ── Crear jornada (wizard) ─────────────────────────────────────────────────

  const crearJornada = async (params: {
    nombre: string;
    precio: string;
    porcOrg: string;
    fixtures: Fixture[];
    seleccionados: Set<number>;
    ligaId: string;
    temporada: string;
    modo: 'jornada'|'fecha'|'semana';
    round: string;
  }): Promise<Jornada|null> => {
    const { nombre, precio, porcOrg, fixtures, seleccionados, ligaId, temporada, modo, round } = params;
    const precioNum  = precio  ? parseFloat(precio.replace(',','.'))  : null;
    const porcOrgNum = porcOrg ? parseInt(porcOrg, 10)               : 0;
    const { data:jData, error:jErr } = await supabase
      .from('jornadas')
      .insert({ nombre: nombre.trim(), estado:'abierta', precio: precioNum, porcentaje_organizador: porcOrgNum })
      .select().single();
    if (jErr || !jData) { avisar('Error', jErr?.message || 'No se pudo crear la jornada.'); return null; }
    if (seleccionados.size > 0) {
      const inserts = fixtures.filter(f => seleccionados.has(f.fixture.id)).map(f => ({
        local: f.teams.home.name, visitante: f.teams.away.name,
        fecha: f.fixture.date, jornada: 0, jornada_id: jData.id,
        cerrado: false, api_fixture_id: f.fixture.id,
      }));
      if (modo === 'jornada') {
        await supabase.from('jornadas').update({ api_competition_id: ligaId, api_season: temporada, api_matchday: round }).eq('id', jData.id);
      }
      const { error:pErr } = await supabase.from('partidos').insert(inserts);
      if (pErr) avisar('Aviso', `Jornada creada pero error al importar partidos: ${pErr.message}`);
    }
    await cargarDatos();
    return jData;
  };

  return {
    // estado
    jornadas, partidos, quinielas, loading, retirosPendientes,
    syncingByJornada, borrando, calculando, resumenGanador,
    // acciones
    cargarDatos,
    cerrarJornada, finalizarJornada, borrarJornada,
    sincronizarResultados,
    guardarResultado,
    marcarPagado, marcarPendiente,
    guardarPrecio,
    handleCalcularGanador,
    crearJornada,
  };
}
