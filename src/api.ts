export type NearEscrow={unconfirmed_members?:string[];network:string;contract_id:string;status:string;error?:string|null;refund_at:number;explorer:string};
export type Config = { room_storage_fee:string; network: string; contract_id: string; oracle_ready: boolean; ai_ready: boolean; semantic_moderation: boolean; storage_fee: string; review_ms: number; resolution_ms: number };
export type User = { id: string; name: string; kind: 'practice' | 'wallet'; managed?: boolean; username?: string; starter_funded?: boolean; account_funding_error?: string|null; balance: string; credit: string; pending: string; chain_error?: string };
export type Evidence = { outcome: string; explanation: string; provider: string; observed_at: number; sources: { title: string; url: string; quote?: string }[]; limitation?: string };
export type EventStream = { platform: 'youtube' | 'twitch'; id: string; url: string };
export type Bet = { cover: string | null; stream: EventStream | null; id: string; mode: 'practice' | 'live'; creator: string; creator_name: string; opponent: string | null; opponent_name: string | null; invitee: string | null; referee: string | null; title: string; rules: string; category: string; side_a: string; side_b: string; stake: string; resolver: string; resolver_config: Record<string, string | number>; created_at: number; join_before: number; ends_at: number; resolve_until: number; status: string; outcome: string | null; creator_vote: string | null; opponent_vote: string | null; proposed_outcome: string | null; challenge_until: number | null; evidence: Evidence | null; reactions: Record<string, number>; chat_count: number };
export type Message = { id: number; user_id: string; name: string; text: string; created_at: number };
export type Fixture = { id: string; name: string; date: string; status: string; state: 'live'|'upcoming'|'finished'|'unavailable'; completed: boolean; league: string; league_name?:string; sport?:string; teams: { id: string; name: string; abbreviation: string; score: string; winner: boolean; logo?:string }[] };
export type Price = { symbol: string; price: string; source: string; observed_at: number };
export type Leader = { id: string; name: string; wins: number; volume: string };
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch('/api' + path, { method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: data === undefined ? {} : { 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(data === undefined ? 30000 : 90000) });
  let result;try{result=await res.json();}catch{throw Error('The connection paused. Please try again.');}
  if (!res.ok){
    const message=result.error || 'Could not complete that request.';
    if(/Sign in with your NearFest|Connect your NEAR testnet wallet/.test(message))window.dispatchEvent(new Event('nearfest:wallet-required'));
    if(/Activity|confirming|still pending/i.test(message))window.dispatchEvent(new Event('nearfest:pending-payment'));
    throw Error(message);
  }
  return result;
}
export {formatNear as money} from '../shared/near-amount.mjs';
export function remaining(time: number) { const n = time - Date.now(); if (n <= 0) return 'Time’s up'; if (n < 60000) return '< 1 min'; if (n < 3600000) return `${Math.ceil(n / 60000)} min`; if (n < 86400000) return `${Math.ceil(n / 3600000)} hr`; return `${Math.ceil(n / 86400000)} days`; }
export const cats = ['All challenges', 'Sports', 'Gaming', 'Life', 'Crypto', 'Facts', 'Science', 'Maths'];
export const icons: Record<string, string> = { 'All challenges': '✳', Sports: '⚽', Gaming: '👾', Life: '✌', Crypto: '₿', Facts: '🔎', Science: '🧪', Maths: '∑' };
export const resolverNames: Record<string, string> = { players: 'Player agreement', sports: 'Sports API', crypto: 'Price API', maths: 'Maths engine', evidence: 'AI + sources' };

export function coverFor(bet: Pick<Bet, 'category' | 'title' | 'cover'>) { const key = bet.cover || (bet.category === 'Sports' ? 'sports' : /chess|gaming/i.test(bet.title + bet.category) || bet.category === 'Life' ? 'chess' : 'science'); return `/art/${key}.png`; }
