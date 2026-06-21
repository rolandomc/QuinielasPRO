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

export function mejorTemporada(seasons: { year: number; current: boolean }[]): string {
  if (!seasons?.length) return String(new Date().getFullYear());
  const current = seasons.find(s => s.current);
  if (current) return String(current.year);
  return String([...seasons].sort((a, b) => b.year - a.year)[0].year);
}

export const apifb = {
  ligas: (search: string) => call('leagues', { search }),
  fixtures: (leagueId: string, season: string, date: string) =>
    call('fixtures', { league: leagueId, season, date }),
  fixturesPorSemana: (leagueId: string, season: string, from: string, to: string) =>
    call('fixtures', { league: leagueId, season, from, to }),
  // Busca por round exacto: "Regular Season - 1"
  fixturesPorRound: (leagueId: string, season: string, round: string) =>
    call('fixtures', { league: leagueId, season, round }),
  fixturesEnVivo: (leagueId: string) =>
    call('fixtures', { live: 'all', league: leagueId }),
  fixtureById: (id: string) =>
    call('fixtures', { id }),
};
