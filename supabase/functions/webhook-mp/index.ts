import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

serve(async (req) => {
  try {
    const body = await req.text();

    // — Verificación de firma HMAC de MercadoPago —
    const secret = Deno.env.get('MP_WEBHOOK_SECRET');
    if (secret) {
      const xSignature = req.headers.get('x-signature') ?? '';
      const xRequestId = req.headers.get('x-request-id') ?? '';
      const url        = new URL(req.url);
      const dataId     = url.searchParams.get('data.id') ?? '';
      const ts         = xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1] ?? '';
      const v1         = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1] ?? '';

      const generatedHash = await hmac(
        'sha256', secret,
        `id:${dataId};request-id:${xRequestId};ts:${ts};`,
        'utf8', 'hex'
      );

      if (generatedHash !== v1) {
        console.error('Firma HMAC inválida — posible request falso');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

    if (payload.type === 'payment' || payload.topic === 'payment') {
      const paymentId = payload.data?.id;
      if (!paymentId || paymentId === '123456') return new Response('OK - test', { status: 200 });

      // Verificar el pago directamente con MP
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });
      const paymentData = await mpResponse.json();

      if (paymentData.status === 'approved') {
        const usuarioId = paymentData.metadata?.usuario_id;
        const jornadaId = paymentData.metadata?.jornada_id;
        const monto     = paymentData.transaction_amount ?? 0;
        const mpId      = String(paymentData.id);

        if (!usuarioId || !jornadaId) {
          console.error('Metadata faltante:', paymentData.metadata);
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

        console.log(`✅ Pago confirmado (webhook-mp): usuario=${usuarioId} jornada=${jornadaId} monto=${monto}`);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook-mp error:', error);
    return new Response('Error', { status: 400 });
  }
});
