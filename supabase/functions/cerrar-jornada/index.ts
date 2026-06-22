// Edge Function: cerrar-jornada
// Llamar con un cron cada minuto desde Supabase → Project Settings → Cron Jobs
// Expresión cron: * * * * *
// Comando: SELECT cerrar_jornadas_automatico();
// O invocar via HTTP como edge function con pg_cron o desde tu scheduler.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (_req) => {
  try {
    // Buscar jornadas 'abierta' cuyo primer partido ya comenzó
    const ahora = new Date().toISOString();

    // Obtener todas las jornadas abiertas
    const { data: jornadas, error: jErr } = await supabase
      .from('jornadas')
      .select('id, nombre')
      .eq('estado', 'abierta');

    if (jErr) throw jErr;
    if (!jornadas || jornadas.length === 0) {
      return new Response(JSON.stringify({ message: 'Sin jornadas abiertas' }), { status: 200 });
    }

    const cerradas: string[] = [];

    for (const jornada of jornadas) {
      // Buscar el partido más temprano de esta jornada
      const { data: primerPartido } = await supabase
        .from('partidos')
        .select('id, fecha')
        .eq('jornada_id', jornada.id)
        .order('fecha', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!primerPartido) continue;

      // Si la fecha del primer partido ya pasó → cerrar jornada
      if (primerPartido.fecha <= ahora) {
        const { error: updErr } = await supabase
          .from('jornadas')
          .update({ estado: 'cerrada' })
          .eq('id', jornada.id);

        if (!updErr) {
          cerradas.push(jornada.nombre);
          console.log(`Jornada cerrada automáticamente: ${jornada.nombre}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ cerradas, total: cerradas.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
