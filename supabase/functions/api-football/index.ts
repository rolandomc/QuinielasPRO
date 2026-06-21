import { serve } from 'https://deno.land/x/sift@0.6.0/mod.ts';

const BASE = 'https://api.football-data.org/v4';
const TOKEN = 'da8f268f10094556926d15f43668a666';

// Mapeo de endpoints estilo api-football -> football-data.org
function buildUrl(endpoint: string, params: Record<string, string>): string {
  const p = params;

  // Ligas / competencias
  if (endpoint === 'leagues') {
    if (p.search) {
      // Buscar por nombre en /competitions
      return `${BASE}/competitions?${new URLSearchParams({ areas: '' }).toString()}`;
    }
    return `${BASE}/competitions`;
  }

  // Partidos / fixtures
  if (endpoint === 'fixtures') {
    // Por liga + temporada + fecha
    if (p.league && p.season) {
      const qs: Record<string, string> = {};
      if (p.date) { qs.dateFrom = p.date; qs.dateTo = p.date; }
      if (p.from)  qs.dateFrom = p.from;
      if (p.to)    qs.dateTo   = p.to;
      if (p.round) qs.matchday = p.round.replace(/\D+/g, ''); // "Regular Season - 3" -> "3"
      if (p.season) qs.season  = p.season;
      return `${BASE}/competitions/${p.league}/matches?${new URLSearchParams(qs).toString()}`;
    }
    // Fixture por ID
    if (p.id) return `${BASE}/matches/${p.id}`;
    // En vivo
    if (p.live) return `${BASE}/matches?status=IN_PLAY`;
    return `${BASE}/matches`;
  }

  // Standings
  if (endpoint === 'standings') {
    return `${BASE}/competitions/${p.league}/standings${p.season ? `?season=${p.season}` : ''}`;
  }

  // Fallback generico
  return `${BASE}/${endpoint}?${new URLSearchParams(p).toString()}`;
}

// Normaliza la respuesta de football-data.org al formato que espera la app
function normalizar(endpoint: string, data: any, params: Record<string, string>): any {
  // /competitions -> formato leagues
  if (endpoint === 'leagues') {
    const comps = data.competitions ?? [];
    const search = (params.search ?? '').toLowerCase();
    const filtradas = search
      ? comps.filter((c: any) =>
          c.name?.toLowerCase().includes(search) ||
          c.area?.name?.toLowerCase().includes(search)
        )
      : comps;
    return {
      results: filtradas.length,
      response: filtradas.map((c: any) => ({
        league: { id: c.id, name: c.name, type: c.type ?? 'League', logo: c.emblem ?? '' },
        country: { name: c.area?.name ?? '', code: c.area?.code ?? '', flag: c.area?.flag ?? '' },
        seasons: c.currentSeason ? [{
          year: c.currentSeason.startDate?.substring(0, 4) ?? '',
          start: c.currentSeason.startDate ?? '',
          end:   c.currentSeason.endDate ?? '',
          current: true,
        }] : [],
      })),
    };
  }

  // /matches -> formato fixtures
  if (endpoint === 'fixtures') {
    const matches = data.matches ?? (data.match ? [data.match] : []);
    return {
      results: matches.length,
      response: matches.map((m: any) => ({
        fixture: {
          id: m.id,
          date: m.utcDate,
          status: { short: mapStatus(m.status), long: m.status },
        },
        league: {
          id: m.competition?.id,
          name: m.competition?.name,
          round: m.matchday ? `Regular Season - ${m.matchday}` : '',
        },
        teams: {
          home: { id: m.homeTeam?.id, name: m.homeTeam?.name ?? m.homeTeam?.shortName ?? '' },
          away: { id: m.awayTeam?.id, name: m.awayTeam?.name ?? m.awayTeam?.shortName ?? '' },
        },
        goals: {
          home: m.score?.fullTime?.home ?? null,
          away: m.score?.fullTime?.away ?? null,
        },
      })),
    };
  }

  return data;
}

function mapStatus(s: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'NS', TIMED: 'NS', IN_PLAY: 'LIVE', PAUSED: 'HT',
    FINISHED: 'FT', SUSPENDED: 'SUSP', POSTPONED: 'PST', CANCELLED: 'CANC',
  };
  return map[s] ?? s;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  const url  = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') ?? '';
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { if (k !== 'endpoint') params[k] = v; });

  const apiUrl = buildUrl(endpoint, params);

  try {
    const res  = await fetch(apiUrl, { headers: { 'X-Auth-Token': TOKEN } });
    const data = await res.json();
    const body = normalizar(endpoint, data, params);

    return new Response(JSON.stringify(body), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
