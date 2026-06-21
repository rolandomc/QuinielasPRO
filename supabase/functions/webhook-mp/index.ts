import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

serve(async (req) => {
  try {
    // 1. Recibir la "carta" de Mercado Pago
    const body = await req.json()

    // Solo nos interesan las notificaciones de pagos reales
    if (body.type === 'payment' || body.topic === 'payment') {
      const paymentId = body.data.id
      const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

      // 2. Preguntarle a Mercado Pago los detalles de este pago por seguridad
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` }
      })
      const paymentData = await mpResponse.json()

      // 3. Si el pago fue aprobado, buscamos de quién era
      if (paymentData.status === 'approved') {
        // Obtenemos el ID de la preferencia que generamos en la app
        const preferenceId = paymentData.order?.preference_id || paymentData.metadata?.preference_id

        if (preferenceId) {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          )

          // 4. ¡Magia! Actualizamos al usuario a "pagado"
          await supabaseClient
            .from('usuarios_quiniela')
            .update({ estado_pago: 'pagado' })
            .eq('mp_preference_id', preferenceId)
        }
      }
    }

    // Mercado Pago exige que le respondamos un "Recibido" (Status 200) rápido
    return new Response("OK", { status: 200 })

  } catch (error) {
    return new Response("Error procesando webhook", { status: 400 })
  }
})