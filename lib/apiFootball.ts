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

export const apifb = {
  ligas: (search: string) => call('leagues', { search }),
  fixtures: (leagueId: string, season: string, date: string) =>
    call('fixtures', { league: leagueId, season, date }),
  fixturesPorSemana: (leagueId: string, season: string, from: string, to: string) =>
    call('fixtures', { league: leagueId, season, from, to }),
  fixturesPorRound: (leagueId: string, season: string, round: string) =>
    call('fixtures', { league: leagueId, season, round }),
  fixturesEnVivo: (leagueId: string) =>
    call('fixtures', { live: 'all', league: leagueId }),
  fixtureById: (id: string) =>
    call('fixtures', { id }),
};
