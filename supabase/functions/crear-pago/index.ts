import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verificar JWT del usuario autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Obtener usuario desde el JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error('Token inválido')

    const { nombre, usuario_id, jornada } = await req.json()
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    const appUrl = Deno.env.get('APP_URL') ?? 'https://quinielapro.app'

    // Crear preferencia en Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ title: `Quiniela Pro — Jornada ${jornada}`, quantity: 1, currency_id: 'MXN', unit_price: 100.00 }],
        payer: { name: nombre, email: user.email },
        back_urls: {
          success: `${appUrl}/pago/exito`,
          failure: `${appUrl}/pago/error`,
          pending: `${appUrl}/pago/error`,
        },
        auto_return: 'approved',
        metadata: { usuario_id, jornada },
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-mp`,
      })
    })

    const mpData = await mpResponse.json()
    if (!mpData.id) throw new Error('MP Error: ' + JSON.stringify(mpData))

    // Crear o actualizar registro en quinielas
    await supabaseClient.from('quinielas').upsert([
      {
        usuario_id,
        jornada,
        mp_preference_id: mpData.id,
        estado_pago: 'pendiente',
      }
    ], { onConflict: 'usuario_id,jornada' })

    return new Response(JSON.stringify({ urlPago: mpData.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})
