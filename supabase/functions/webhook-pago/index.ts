import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Responder a verificacion de MP
  if (req.method === 'GET') {
    return new Response('OK', { status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    console.log('Webhook recibido:', JSON.stringify(body));

    // Solo procesar eventos de pago
    if (body.type !== 'payment') {
      return new Response('OK', { status: 200 });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response('No payment id', { status: 400 });
    }

    // Obtener detalles del pago desde Mercado Pago
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN');
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    });

    if (!mpRes.ok) {
      console.error('Error consultando MP:', await mpRes.text());
      return new Response('Error consultando pago', { status: 500 });
    }

    const pago = await mpRes.json();
    console.log('Pago MP:', JSON.stringify({ id: pago.id, status: pago.status, metadata: pago.metadata }));

    // Solo actualizar si el pago fue aprobado
    if (pago.status !== 'approved') {
      return new Response('OK - pago no aprobado', { status: 200 });
    }

    // Extraer usuario_id y jornada del metadata del pago
    const usuarioId = pago.metadata?.usuario_id;
    const jornada = pago.metadata?.jornada;

    if (!usuarioId || !jornada) {
      console.error('Metadata faltante:', pago.metadata);
      return new Response('Metadata incompleta', { status: 400 });
    }

    // Actualizar estado en Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabase
      .from('quinielas')
      .update({ estado_pago: 'pagado' })
      .eq('usuario_id', usuarioId)
      .eq('jornada', jornada);

    if (error) {
      console.error('Error actualizando quiniela:', error);
      return new Response('Error actualizando DB', { status: 500 });
    }

    console.log(`Quiniela actualizada: usuario=${usuarioId} jornada=${jornada}`);
    return new Response('OK', { status: 200 });

  } catch (e) {
    console.error('Error webhook:', e);
    return new Response('Error interno', { status: 500 });
  }
});
