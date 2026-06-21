import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts"

serve(async (req) => {
  try {
    const body = await req.text()
    
    // Verificación de firma HMAC de Mercado Pago
    const secret = Deno.env.get('MP_WEBHOOK_SECRET')
    if (secret) {
      const xSignature = req.headers.get('x-signature') ?? ''
      const xRequestId = req.headers.get('x-request-id') ?? ''
      const url = new URL(req.url)
      const dataId = url.searchParams.get('data.id') ?? ''

      // Construir el manifest según documentación de MP
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1] ?? ''};`
      const ts = xSignature.split(',').find(p => p.startsWith('ts='))?.split('=')[1] ?? ''
      const v1 = xSignature.split(',').find(p => p.startsWith('v1='))?.split('=')[1] ?? ''
      const generatedHash = await hmac('sha256', secret, `id:${dataId};request-id:${xRequestId};ts:${ts};`, 'utf8', 'hex')

      if (generatedHash !== v1) {
        console.error('Firma HMAC inválida — posible request falso')
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    if (payload.type === 'payment' || payload.topic === 'payment') {
      const paymentId = payload.data?.id

      // Verificar el pago directamente con MP por seguridad
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` }
      })
      const paymentData = await mpResponse.json()

      if (paymentData.status === 'approved') {
        const preferenceId = paymentData.order?.preference_id
        const metaUsuarioId = paymentData.metadata?.usuario_id
        const metaJornada = paymentData.metadata?.jornada

        if (preferenceId) {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )

          await supabaseClient
            .from('quinielas')
            .update({ estado_pago: 'pagado' })
            .eq('mp_preference_id', preferenceId)

          console.log(`✅ Pago aprobado — usuario: ${metaUsuarioId}, jornada: ${metaJornada}`)
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Error', { status: 400 })
  }
})
