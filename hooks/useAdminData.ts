import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { apifb } from '../lib/apiFootball';
import { calcularGanador, ResumenGanador } from '../lib/ganador';

export type Partido  = { id:string; local:string; visitante:string; fecha:string; jornada_id:string; cerrado:boolean; resultado_final:string|null; api_fixture_id:number|null; goles_local_real:number|null; goles_visitante_real:number|null };
export type Jornada  = { id:string; nombre:string; estado:string; api_competition_id:string|null; api_season:string|null; api_matchday:string|null; creado_at:string; precio?:number|null; porcentaje_organizador?:number|null; ganador_usuario_id?:string|null };
export type Quiniela = { id:string; estado_pago:string; codigo:string|null; jornada_id:string; usuario_id:string; monto_cobrado:number|null; usuarios:{nombre:string;username:string}|null };
export type Fixture  = { fixture:{id:number;date:string;status:{short:string}}; teams:{home:{name:string};away:{name:string}}; goals?:{home:number|null;away:number|null} };

export const confirmar = (titulo:string, mensaje:string, onConfirm:()=>void) => {
  if (Platform.OS === 'web') {
    if ((window as any).confirm(`${titulo}\n\n${mensaje}`)) onConfirm();
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje, [{ text:'Cancelar', style:'cancel' }, { text:'Confirmar', style:'destructive', onPress:onConfirm }]);
  }
};

export const avisar = (titulo:string, mensaje:string) => {
  if (Platform.OS === 'web') {
    (window as any).alert(`${titulo}\n\n${mensaje}`);
  } else {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensaje);
  }
};

export function useAdminData() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [jornadas, setJornadas]       = useState<Jornada[]>([]);
  const [partidos, setPartidos]       = useState<Partido[]>([]);
  const [quinielas, setQuinielas]     = useState<Quiniela[]>([]);
  const [loading, setLoading]         = useState(true);
  const [retirosPendientes, setRetirosPendientes] = useState(0);
  const [syncingByJornada, setSyncingByJornada]   = useState<Record<string,boolean>>({});
  const [borrando, setBorrando]       = useState<string|null>(null);
  const [calculando, setCalculando]   = useState(false);
  const [resumenGanador, setResumenGanador] = useState<ResumenGanador|null>(null);

  useEffect(() => {
    if (!usuario?.es_admin) {
      avisar('Acceso denegado', 'No tienes permisos.');
      router.back();
      return;
    }
    cargarDatos();
  }, [usuario]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    const [{ data:j }, { data:p }, { data:q }, { data:r }] = await Promise.all([
      supabase.from('jornadas').select('*').order('creado_at', { ascending:false }),
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

  const recalcularAciertos = useCallback(async (jornada_id:string) => {
    const { data:pJs } = await supabase
      .from('partidos').select('id,resultado_final')
      .eq('jornada_id', jornada_id).not('resultado_final', 'is', null);
    if (!pJs?.length) return;
    const ids = pJs.map(p => p.id);
    const { data:qJs } = await supabase.from('quinielas').select('id,usuario_id').eq('jornada_id', jornada_id);
    for (const q of (qJs || [])) {
      const { data:preds } = await supabase
        .from('predicciones').select('partido_id,resultado')
        .eq('usuario_id', q.usuario_id).in('partido_id', ids);
      const aciertos = (preds || []).filter(pr =>
        pJs.find(x => x.id === pr.partido_id)?.resultado_final === pr.resultado
      ).length;
      await supabase.from('quinielas').update({ aciertos }).eq('id', q.id);
    }
  }, []);

  const cerrarJornada = useCallback((j:Jornada) => {
    confirmar('Cerrar jornada', `¿Cerrar "${j.nombre}"? Los usuarios ya no podrán editar.`, async () => {
      await supabase.from('jornadas').update({ estado:'cerrada' }).eq('id', j.id);
      await supabase.from('partidos').update({ cerrado:true }).eq('jornada_id', j.id);
      await cargarDatos();
      avisar('✅ Cerrada', `"${j.nombre}" cerrada.`);
    });
  }, [cargarDatos]);

  const finalizarJornada = useCallback((j:Jornada) => {
    confirmar('Finalizar', `¿Marcar "${j.nombre}" como FINALIZADA?`, async () => {
      await supabase.from('jornadas').update({ estado:'finalizada' }).eq('id', j.id);
      await cargarDatos();
    });
  }, [cargarDatos]);

  const borrarJornada = useCallback((j:Jornada, onBorrado?:()=>void) => {
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
        onBorrado?.();
        avisar('🗑️ Eliminada', `"${j.nombre}" eliminada.`);
      } catch (e:any) {
        avisar('Error', e.message);
        await cargarDatos();
      } finally {
        setBorrando(null);
      }
    });
  }, [cargarDatos]);

  const sincronizarResultados = useCallback(async (j:Jornada) => {
    if (!j.api_competition_id || !j.api_season || !j.api_matchday) {
      avisar('Sin datos API', 'Falta competition_id, season o matchday.');
      return;
    }
    setSyncingByJornada(prev => ({ ...prev, [j.id]:true }));
    try {
      const round = `Regular Season - ${j.api_matchday}`;
      const data  = await apifb.fixturesPorRound(j.api_competition_id, j.api_season, round);
      const matches:Fixture[] = data.response || [];
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
          resultado_final: res,
          cerrado: true,
          goles_local_real: goals.home,
          goles_visitante_real: goals.away,
        }).eq('id', p.id).eq('jornada_id', j.id);
        actualizados++;
      }
      if (actualizados > 0) await recalcularAciertos(j.id);
      await cargarDatos();
      avisar('✅ Sincronizado', `${actualizados} resultado(s) actualizado(s).`);
    } catch (e) {
      avisar('Error', String(e));
    } finally {
      setSyncingByJornada(prev => ({ ...prev, [j.id]:false }));
    }
  }, [partidos, cargarDatos, recalcularAciertos]);

  const guardarResultado = useCallback(async (
    partidoSel: Partido,
    resultadoInput: '1'|'X'|'2',
    golesLocalInput: string,
    golesVisitanteInput: string,
  ) => {
    const gl = golesLocalInput  !== '' ? parseInt(golesLocalInput,  10) : null;
    const gv = golesVisitanteInput !== '' ? parseInt(golesVisitanteInput, 10) : null;
    let res: '1'|'X'|'2' = resultadoInput;
    if (gl != null && gv != null) res = gl > gv ? '1' : gv > gl ? '2' : 'X';
    await supabase.from('partidos').update({
      resultado_final: res,
      cerrado: true,
      goles_local_real: gl,
      goles_visitante_real: gv,
    }).eq('id', partidoSel.id);
    await recalcularAciertos(partidoSel.jornada_id);
    await cargarDatos();
  }, [cargarDatos, recalcularAciertos]);

  const marcarPagado = useCallback(async (qId:string, jornadaId:string) => {
    const jornada = jornadas.find(j => j.id === jornadaId);
    const monto   = jornada?.precio ?? 0;
    await supabase.from('quinielas').update({ estado_pago:'pagado', monto_cobrado:monto }).eq('id', qId);
    const qsPagadas = quinielas.filter(q => q.jornada_id === jornadaId && (q.id === qId || q.estado_pago === 'pagado'));
    const nuevaBolsa = qsPagadas.length * (jornada?.precio ?? 0);
    await supabase.from('jornadas').update({ bolsa_total:nuevaBolsa }).eq('id', jornadaId);
    await cargarDatos();
  }, [jornadas, quinielas, cargarDatos]);

  const marcarPendiente = useCallback(async (qId:string) => {
    await supabase.from('quinielas').update({ estado_pago:'pendiente' }).eq('id', qId);
    await cargarDatos();
  }, [cargarDatos]);

  const guardarPrecio = useCallback(async (
    jornadaId: string,
    precioInput: string,
    porcOrgInput: string,
  ): Promise<boolean> => {
    const precio  = parseFloat(precioInput.replace(',', '.'));
    if (isNaN(precio) || precio < 0) { avisar('Precio inválido', 'Número >= 0.'); return false; }
    const porcOrg = porcOrgInput !== '' ? parseInt(porcOrgInput, 10) : 0;
    if (isNaN(porcOrg) || porcOrg < 0 || porcOrg > 100) { avisar('% inválido', 'Entre 0 y 100.'); return false; }
    const { error } = await supabase.from('jornadas').update({ precio, porcentaje_organizador:porcOrg }).eq('id', jornadaId);
    if (error) { avisar('Error', error.message); return false; }
    await cargarDatos();
    return true;
  }, [cargarDatos]);

  const handleCalcularGanador = useCallback(async (j:Jornada): Promise<ResumenGanador|null> => {
    setCalculando(true);
    setResumenGanador(null);
    try {
      const resumen = await calcularGanador(j.id);
      setResumenGanador(resumen);
      await cargarDatos();
      return resumen;
    } catch (e:any) {
      avisar('Error', e.message);
      return null;
    } finally {
      setCalculando(false);
    }
  }, [cargarDatos]);

  // ─── Derived data ─────────────────────────────────────────────────────────
  const pagados          = quinielas.filter(q => q.estado_pago === 'pagado').length;
  const pendientesTot    = quinielas.filter(q => q.estado_pago === 'pendiente').length;
  const recaudacionTotal = quinielas.filter(q => q.estado_pago === 'pagado').reduce((s,q) => s + (q.monto_cobrado ?? 0), 0);
  const jornadasActivas  = jornadas.filter(j => j.estado === 'abierta' || j.estado === 'cerrada');
  const jornadasFin      = jornadas.filter(j => j.estado === 'finalizada');
  const quinPendientes   = quinielas.filter(q => q.estado_pago === 'pendiente');
  const datosIngresos    = jornadas.map(j => {
    const qJ       = quinielas.filter(q => q.jornada_id === j.id);
    const pagadasJ    = qJ.filter(q => q.estado_pago === 'pagado');
    const pendientesJ = qJ.filter(q => q.estado_pago !== 'pagado');
    const recaudadoJ  = pagadasJ.reduce((s,q) => s + (q.monto_cobrado ?? 0), 0);
    const potencial   = (j.precio ?? 0) * pendientesJ.length;
    return { j, qJ, pagadasJ, pendientesJ, recaudadoJ, potencial };
  });
  const maxRecaudado = Math.max(...datosIngresos.map(d => d.recaudadoJ), 1);

  return {
    // state
    jornadas, partidos, quinielas, loading,
    retirosPendientes, syncingByJornada, borrando,
    calculando, resumenGanador, setResumenGanador,
    // derived
    pagados, pendientesTot, recaudacionTotal,
    jornadasActivas, jornadasFin, quinPendientes,
    datosIngresos, maxRecaudado,
    // actions
    cargarDatos,
    cerrarJornada, finalizarJornada, borrarJornada,
    sincronizarResultados, guardarResultado,
    marcarPagado, marcarPendiente,
    guardarPrecio, handleCalcularGanador,
  };
}
