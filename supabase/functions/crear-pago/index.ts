import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { nombre, telefono } = await req.json()
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    // 1. Pedir link a Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
  items: [{ title: 'Entrada Quiniela', quantity: 1, currency_id: 'MXN', unit_price: 100.00 }],
  payer: { name: nombre },
  back_urls: {
    success: "https://www.google.com",
    failure: "https://www.google.com",
    pending: "https://www.google.com"
  },
  auto_return: "approved"
})
    })

    const mpData = await mpResponse.json()
    if (!mpData.id) throw new Error("MP Error: " + JSON.stringify(mpData))

    // 2. Conectar a base de datos Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Guardar usuario
    await supabaseClient.from('usuarios_quiniela').insert([
      { nombre, telefono, mp_preference_id: mpData.id, estado_pago: 'pendiente' }
    ])

    // 4. Regresar el link a tu app
    return new Response(JSON.stringify({ urlPago: mpData.init_point }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})