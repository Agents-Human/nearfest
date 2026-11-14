import {SPORT_LEAGUES} from './sports.mjs';
export const UNIT = 10n ** 24n;
export const STORAGE = 3n * 10n ** 22n;
export const RESOLUTION_MS = 48 * 3600_000;
export const CHALLENGE_MS = 15 * 60_000;
export const CATEGORIES = ['Sports', 'Gaming', 'Life', 'Crypto', 'Facts', 'Science', 'Maths'];
export const RESOLVERS = ['players', 'crypto', 'sports', 'maths', 'evidence'];
export function amount(s) {
  if (typeof s !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(s)) throw Error('Enter a valid amount, with up to 24 decimals.');
  const [a, b = ''] = s.split('.'); return BigInt(a) * UNIT + BigInt(b.padEnd(24, '0'));
}
export function format(n) { n = BigInt(n); const f = (n % UNIT).toString().padStart(24, '0').slice(0, 4).replace(/0+$/, ''); return `${n / UNIT}${f ? '.' + f : ''}`; }
export function validAccount(a) { return typeof a === 'string' && a.length >= 2 && a.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a); }

// A conservative first layer. A configured moderation model adds semantic review.
// Never present a keyword filter as complete protection against evasive content.
const excluded = /\b(porn\w*|sex(?:ual|ting)?|nudes?|naked|erotic\w*|orgasm\w*|fetish\w*|masturbat\w*|rape|cocaine|heroin|meth(?:amphetamine)?|fentanyl|ecstasy|mdma|weed|cannabis|marijuana|lsd|ketamine|drug(?:s)?|overdose|suicide|self.harm|behead\w*|gore|kill (?:myself|yourself|someone))\b/i;
export function moderate(text) {
  const normalized = String(text).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/0/g, 'o').replace(/3/g, 'e').replace(/@/g, 'a').replace(/\$/g, 's');
  if (excluded.test(normalized)) throw Error('Keep it friendly: drugs, sexual or explicit content, graphic violence and dangerous challenges are not allowed.');
}
export function shortText(v, min, max, label) {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw Error(`${label} must be ${min}–${max} characters.`);
  moderate(v); return v.trim();
}
// Arithmetic only: no eval, functions, variables, property access or unbounded exponents.
export function calculate(input) {
  if (typeof input !== 'string' || input.length > 120 || /[^0-9\s.+*/^()-]/.test(input)) throw Error('Use numbers, parentheses and + − * / ^ only.');
  const tokens = input.match(/(?:\d+(?:\.\d+)?|\.\d+)|[()+*/^-]/g) || []; let i = 0;
  function atom() { const t = tokens[i++]; if (t === '+') return atom(); if (t === '-') return -atom(); if (t === '(') { const n = expression(); if (tokens[i++] !== ')') throw Error('Close every parenthesis.'); return n; } if (!t || !/^\d|^\./.test(t)) throw Error('Invalid arithmetic expression.'); return Number(t); }
  function power() { let n = atom(); if (tokens[i] === '^') { i++; const p = power(); if (Math.abs(p) > 12) throw Error('Exponents must be between −12 and 12.'); n = n ** p; } return n; }
  function product() { let n = power(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++], d = power(); if (op === '/' && d === 0) throw Error('Division by zero cannot be settled.'); n = op === '*' ? n * d : n / d; } return n; }
  function expression() { let n = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++], d = product(); n = op === '+' ? n + d : n - d; } return n; }
  const answer = expression(); if (i !== tokens.length || !Number.isFinite(answer) || Math.abs(answer) > 1e12) throw Error('The expression must have a finite result within ±1 trillion.'); return answer;
}
export function validateDraft(input, actor, now = Date.now()) {
  const d = { ...input };
  d.title = shortText(d.title, 8, 120, 'The question'); d.rules = shortText(d.rules, 20, 500, 'Settlement rules');
  d.side_a = shortText(d.side_a || 'Yes', 1, 40, 'Your side'); d.side_b = shortText(d.side_b || 'No', 1, 40, 'The other side');
  if (d.side_a.toLowerCase() === d.side_b.toLowerCase()) throw Error('Give the two sides different labels.');
  if (!CATEGORIES.includes(d.category) || !RESOLVERS.includes(d.resolver)) throw Error('Choose a category and settlement method.');
  const stake = amount(d.stake);
  if (stake <= 0n) throw Error('Enter a stake greater than zero.');
  if (!Number.isSafeInteger(d.join_before) || !Number.isSafeInteger(d.ends_at) || d.join_before <= now || d.ends_at <= d.join_before || d.ends_at > now + 90 * 86400_000) throw Error('Accept-by must be in the future and before the result time, within 90 days.');
  d.invitee = d.invitee || null; d.referee = d.referee || null;
  for (const a of [d.invitee, d.referee]) if (a && !validAccount(a)) throw Error('Enter a valid NEAR account ID.');
  if (d.invitee === actor || d.referee === actor || (d.invitee && d.invitee === d.referee)) throw Error('The players and referee must be different accounts.');
  const r = d.resolver_config || {};
  if (d.resolver === 'maths') {
    calculate(r.expression); if (!Number.isFinite(Number(r.expected)) || String(r.expected).trim() === '') throw Error('Enter the number your expression should equal.');
    d.resolver_config = { expression: r.expression, expected: Number(r.expected) };
    d.title = `Does ${r.expression} equal ${Number(r.expected)}?`;
    d.rules = 'Creator backs YES, opponent backs NO. Evaluate the displayed arithmetic expression using IEEE-754 arithmetic, parentheses, then powers, multiplication/division, addition/subtraction; unary signs bind before powers. Equality tolerance: 0.000000001. The recorded result may be challenged for 15 minutes.';
    d.side_a = 'Yes'; d.side_b = 'No';
  } else if (d.resolver === 'crypto') {
    if (!['BTCUSDT', 'ETHUSDT', 'NEARUSDT', 'SOLUSDT'].includes(r.symbol) || !Number.isFinite(Number(r.threshold)) || Number(r.threshold) <= 0) throw Error('Choose a supported pair and a positive target price.');
    if (d.ends_at % 60000 !== 0) throw Error('Crypto result times must be on a whole UTC minute.');
    d.resolver_config = { symbol: r.symbol, threshold: Number(r.threshold) };
    d.title = `Will ${r.symbol.replace('USDT', '')} close above $${Number(r.threshold).toLocaleString('en-US')}?`;
    d.rules = `YES wins if the Binance ${r.symbol} one-minute candle closing immediately before ${new Date(d.ends_at).toISOString()} closes strictly above ${r.threshold} USDT. Equality means NO. No alternate price source. Missing data stays unresolved; 48-hour timeout refunds both. Challenge period: 15 minutes.`;
    d.side_a = 'Yes'; d.side_b = 'No';
  } else if (d.resolver === 'sports') {
    if (!Object.hasOwn(SPORT_LEAGUES,r.league) || !/^\d{1,16}$/.test(r.event_id || '') || !/^\d{1,16}$/.test(r.team_id || '')) throw Error('Choose a supported fixture and team.');
    d.resolver_config = { league: r.league, event_id: r.event_id, team_id: r.team_id };
    d.rules = 'YES wins only if the selected team is marked as winner in the completed ESPN event, including extra time/penalties as recorded there. A drawn match means NO. A cancelled event refunds both. Postponed or unavailable results remain pending, with a 48-hour refund deadline. Challenge period: 15 minutes.';
    d.side_a = 'Yes'; d.side_b = 'No';
  } else if (d.resolver === 'evidence') {
    d.resolver_config = { topic: shortText(r.topic || d.title, 3, 160, 'Research topic') };
    d.side_a = 'True'; d.side_b = 'False';
  } else d.resolver_config = {};
  return { ...d, stake: stake.toString() };
}
export function createBet(id, actor, draft, mode, now = Date.now()) {
  return { ...draft, id, mode, creator: actor, opponent: null, created_at: now, resolve_until: draft.ends_at + RESOLUTION_MS, status: 'open', creator_vote: null, opponent_vote: null, outcome: null, evidence: null, proposed_outcome: null, challenge_until: null, reactions: {}, chat_count: 0 };
}
export function transition(original, actor, action, now = Date.now()) {
  const b = structuredClone(original), credits = [];
  const active = ['matched', 'disputed', 'proposed'].includes(b.status), player = actor === b.creator || actor === b.opponent;
  const outcome = action.outcome;
  if (outcome !== undefined && !['creator', 'opponent', 'draw'].includes(outcome)) throw Error('Choose a valid outcome.');
  function finish(result) {
    b.outcome = result; b.status = result === 'draw' ? 'refunded' : 'settled';
    if (result === 'draw') { credits.push([b.creator, b.stake]); if (b.opponent) credits.push([b.opponent, b.stake]); }
    else credits.push([result === 'creator' ? b.creator : b.opponent, (BigInt(b.stake) * 2n).toString()]);
  }
  let debit = '0';
  switch (action.type) {
    case 'accept':
      if (b.status !== 'open' || now >= b.join_before) throw Error('This challenge is no longer open.');
      if (actor === b.creator || actor === b.referee || (b.invitee && actor !== b.invitee)) throw Error('This account cannot take the other side.');
      b.opponent = actor; b.status = 'matched'; debit = b.stake; break;
    case 'cancel':
      if (b.status !== 'open' || actor !== b.creator) throw Error('Only the creator can cancel an unmatched challenge.');
      b.status = 'cancelled'; credits.push([b.creator, b.stake]); break;
    case 'concede':
      if (!active || !player || now >= b.resolve_until) throw Error('You cannot concede this challenge.');
      finish(actor === b.creator ? 'opponent' : 'creator'); break;
    case 'vote':
      if (!active || !player || now < b.ends_at || now >= b.resolve_until || !outcome) throw Error('Players can report results during the 48-hour settlement window.');
      if (actor === b.creator) b.creator_vote = outcome; else b.opponent_vote = outcome;
      if (b.creator_vote && b.opponent_vote) { if (b.creator_vote === b.opponent_vote) finish(outcome); else b.status = 'disputed'; } break;
    case 'referee':
      if (b.status !== 'disputed' || actor !== b.referee || now >= b.resolve_until || !outcome) throw Error('Only the agreed referee can settle this dispute.');
      finish(outcome); break;
    case 'propose':
      if (actor !== 'oracle' || b.resolver === 'players' || b.status !== 'matched' || now < b.ends_at || now + CHALLENGE_MS >= b.resolve_until || !outcome) throw Error('An automatic verdict is not available for this challenge.');
      b.proposed_outcome = outcome; b.evidence = action.evidence; b.challenge_until = now + CHALLENGE_MS; b.status = 'proposed'; break;
    case 'challenge':
      if (!player || b.status !== 'proposed' || now >= b.challenge_until) throw Error('Only a player can challenge during the verdict review window.');
      b.status = 'disputed'; break;
    case 'finalize':
      if (b.status !== 'proposed' || now < b.challenge_until || now >= b.resolve_until) throw Error('The verdict is still under review or the refund deadline has arrived.');
      finish(b.proposed_outcome); break;
    case 'timeout':
      if (b.status === 'open' && now >= b.join_before) { b.status = 'cancelled'; credits.push([b.creator, b.stake]); }
      else if (active && now >= b.resolve_until) finish('draw'); else throw Error('The refund deadline has not arrived.'); break;
    default: throw Error('Unknown challenge action.');
  }
  return { bet: b, credits, debit };
}
