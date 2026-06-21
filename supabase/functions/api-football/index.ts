import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const API_KEY = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const BASE = 'https://v3.football.api-sports.io';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint') ?? '';
    const params = new URLSearchParams();
    url.searchParams.forEach((v, k) => { if (k !== 'endpoint') params.append(k, v); });

    const apiUrl = `${BASE}/${endpoint}${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(apiUrl, { headers: { 'x-apisports-key': API_KEY } });
    const data = await res.json();

    return new Response(JSON.stringify(data), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
