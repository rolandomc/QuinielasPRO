import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  if (req.method === 'GET') return new Response('OK', { status: 200 });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await req.json();
    console.log('Webhook recibido:', JSON.stringify(body));

    if (body.type !== 'payment') return new Response('OK', { status: 200 });

    const paymentId = body.data?.id;
    if (!paymentId || paymentId === '123456') return new Response('OK - test', { status: 200 });

    // — Consultar pago a MercadoPago —
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    const mpRes   = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });
    if (!mpRes.ok) {
      console.error('Error consultando MP:', await mpRes.text());
      return new Response('Error consultando pago', { status: 500 });
    }

    const pago = await mpRes.json();
    console.log('Pago MP:', JSON.stringify({ id: pago.id, status: pago.status, metadata: pago.metadata }));

    if (pago.status !== 'approved') return new Response('OK - no aprobado', { status: 200 });

    const usuarioId = pago.metadata?.usuario_id;
    const jornadaId = pago.metadata?.jornada_id;
    const monto     = pago.transaction_amount ?? 0;
    const mpId      = String(pago.id);

    if (!usuarioId || !jornadaId) {
      console.error('Metadata faltante:', pago.metadata);
      return new Response('Metadata incompleta', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ✅ RPC idempotente: si ya está pagado, no hace nada; también recalcula bolsa_total
    const { error } = await supabase.rpc('confirmar_pago_quiniela', {
      p_usuario_id: usuarioId,
      p_jornada_id: jornadaId,
      p_monto:      monto,
      p_mp_id:      mpId,
    });

    if (error) {
      console.error('Error RPC confirmar_pago_quiniela:', error);
      return new Response('Error DB', { status: 500 });
    }

    console.log(`✅ Pago confirmado: usuario=${usuarioId} jornada=${jornadaId} monto=${monto} mp_id=${mpId}`);
    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('Error interno webhook-pago:', e);
    return new Response('Error interno', { status: 500 });
  }
});
