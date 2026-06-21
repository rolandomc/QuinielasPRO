import { supabase } from './supabase';

const EDGE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api-football`;

async function call(endpoint: string, params: Record<string, string> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const res = await fetch(`${EDGE}?${qs}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  return res.json();
}

/** Elige la mejor temporada: primero current=true, si no la de mayor año */
export function mejorTemporada(seasons: { year: number; current: boolean }[]): string {
  if (!seasons || seasons.length === 0) return String(new Date().getFullYear());
  const current = seasons.find(s => s.current);
  if (current) return String(current.year);
  const sorted = [...seasons].sort((a, b) => b.year - a.year);
  return String(sorted[0].year);
}

export const apifb = {
  ligas: (search: string) => call('leagues', { search }),
  ligasPorPais: (country: string) => call('leagues', { country }),
  todasLasLigas: () => call('leagues', { current: 'true' }),
  fixtures: (leagueId: string, season: string, date: string) =>
    call('fixtures', { league: leagueId, season, date }),
  fixturesPorSemana: (leagueId: string, season: string, from: string, to: string) =>
    call('fixtures', { league: leagueId, season, from, to }),
  fixturesEnVivo: (leagueId: string) =>
    call('fixtures', { live: 'all', league: leagueId }),
  fixtureById: (id: string) =>
    call('fixtures', { id }),
};
