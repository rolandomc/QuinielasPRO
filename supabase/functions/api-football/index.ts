const BASE = 'https://api.football-data.org/v4';
const TOKEN = 'da8f268f10094556926d15f43668a666';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function buildUrl(endpoint: string, p: Record<string, string>): string {
  if (endpoint === 'leagues') {
    return `${BASE}/competitions`;
  }
  if (endpoint === 'fixtures') {
    if (p.league && p.season) {
      const qs: Record<string, string> = { season: p.season };
      if (p.date)  { qs.dateFrom = p.date; qs.dateTo = p.date; }
      if (p.from)    qs.dateFrom = p.from;
      if (p.to)      qs.dateTo   = p.to;
      if (p.round)   qs.matchday = p.round.replace(/\D+/g, '');
      return `${BASE}/competitions/${p.league}/matches?${new URLSearchParams(qs)}`;
    }
    if (p.id)   return `${BASE}/matches/${p.id}`;
    if (p.live) return `${BASE}/matches?status=IN_PLAY`;
    return `${BASE}/matches`;
  }
  if (endpoint === 'standings') {
    return `${BASE}/competitions/${p.league}/standings${p.season ? `?season=${p.season}` : ''}`;
  }
  return `${BASE}/${endpoint}?${new URLSearchParams(p)}`;
}

function mapStatus(s: string): string {
  const m: Record<string, string> = {
    SCHEDULED:'NS', TIMED:'NS', IN_PLAY:'LIVE', PAUSED:'HT',
    FINISHED:'FT', SUSPENDED:'SUSP', POSTPONED:'PST', CANCELLED:'CANC',
  };
  return m[s] ?? s;
}

function normalizar(endpoint: string, data: any, params: Record<string, string>): any {
  if (endpoint === 'leagues') {
    const comps: any[] = data.competitions ?? [];
    const search = (params.search ?? '').toLowerCase();
    const lista = search
      ? comps.filter(c => c.name?.toLowerCase().includes(search) || c.area?.name?.toLowerCase().includes(search))
      : comps;
    return {
      results: lista.length,
      response: lista.map(c => ({
        league: { id: c.id, name: c.name, type: 'League', logo: c.emblem ?? '' },
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
  if (endpoint === 'fixtures') {
    const matches: any[] = data.matches ?? (data.match ? [data.match] : []);
    return {
      results: matches.length,
      response: matches.map(m => ({
        fixture: { id: m.id, date: m.utcDate, status: { short: mapStatus(m.status) } },
        league:  { id: m.competition?.id, name: m.competition?.name, round: m.matchday ? `Regular Season - ${m.matchday}` : '' },
        teams:   { home: { id: m.homeTeam?.id, name: m.homeTeam?.name ?? '' }, away: { id: m.awayTeam?.id, name: m.awayTeam?.name ?? '' } },
        goals:   { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
      })),
    };
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const endpoint = url.searchParams.get('endpoint') ?? '';
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { if (k !== 'endpoint') params[k] = v; });

  const apiUrl = buildUrl(endpoint, params);

  try {
    const res  = await fetch(apiUrl, { headers: { 'X-Auth-Token': TOKEN } });
    const data = await res.json();
    const body = normalizar(endpoint, data, params);
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
