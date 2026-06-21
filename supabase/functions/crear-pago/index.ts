import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error('Token invalido')

    const { nombre, usuario_id, jornada_id, jornada_nombre } = await req.json()
    if (!jornada_id) throw new Error('jornada_id requerido')

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    const appUrl = Deno.env.get('APP_URL') ?? 'https://quinielapro.app'
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{ title: `Quiniela Pro — ${jornada_nombre || jornada_id}`, quantity: 1, currency_id: 'MXN', unit_price: 100.00 }],
        payer: { name: nombre, email: user.email },
        back_urls: {
          success: `${appUrl}/pago/exito`,
          failure: `${appUrl}/pago/error`,
          pending: `${appUrl}/pago/pendiente`,
        },
        auto_return: 'approved',
        metadata: { usuario_id, jornada_id },
        notification_url: `${supabaseUrl}/functions/v1/webhook-pago`,
      })
    })

    const mpData = await mpResponse.json()
    console.log('MP preference creada:', JSON.stringify({ id: mpData.id }))
    if (!mpData.id) throw new Error('MP Error: ' + JSON.stringify(mpData))

    // Producción: siempre usar init_point (no sandbox_init_point)
    const urlPago = mpData.init_point

    return new Response(JSON.stringify({ urlPago }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error crear-pago:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})
