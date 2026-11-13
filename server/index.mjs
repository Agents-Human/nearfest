import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { verifyMessage } from 'near-api-js/nep413';
import { openStore } from './store.mjs';
import { UNIT, STORAGE, validateDraft, createBet, shortText, validAccount, moderate } from './domain.mjs';
import { resolveBet, fixtures, fixture, prices, hasAI, semanticModerate } from './resolvers.mjs';
import {createMultiplayer} from './multiplayer.mjs';
import {SPORT_LEAGUES,verifySportsEntry} from './sports.mjs';
import {createPlay} from './play.mjs';
import {serveLibrary} from './library.mjs';
import {createCommunity} from './community.mjs';
import { coverKey, streamLink } from './media.mjs';
import { contractId, oracleReady, view, provider, transaction as nearTransaction, propose } from './near.mjs';

const port = Number(process.env.PORT || 5189), origin = process.env.APP_ORIGIN || 'http://127.0.0.1:5188';
const store = openStore(process.env.DATABASE_PATH || resolve('data/slotvend.sqlite'));
const play=createPlay(store),community=createCommunity(store),multiplayer=createMultiplayer(store);
const { db } = store, streams = new Set(), challenges = new Map(), limits = new Map(), resolving = new Set(), cache = new Map();
const hash = x => createHash('sha256').update(x).digest('hex');
const config = { network: 'testnet', contract_id: contractId, oracle_ready: oracleReady, ai_ready: hasAI, semantic_moderation: hasAI, storage_fee: STORAGE.toString(), review_ms: 900000, resolution_ms: 172800000 };
function broadcast() { for (const s of streams) s.write(`event: update\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`); }
function rate(key, max, ms = 60000) { const t = Date.now(); let v = limits.get(key); if (!v || v.until < t) { v = { count: 0, until: t + ms }; limits.set(key, v); } if (++v.count > max) throw Error('A little too fast. Please try again shortly.'); }
function json(res, data, status = 200) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); }
async function body(req) { let data = ''; for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 16000) throw Error('Request is too large.'); } try { return JSON.parse(data || '{}'); } catch { throw Error('Invalid request body.'); } }
function current(req) { const token = /(?:^|;\s*)slotvend=([^;]+)/.exec(req.headers.cookie || '')?.[1]; if (!token) return null; const s = db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(hash(token), Date.now()); return s ? store.user(s.user_id) : null; }
function login(res, user) { const token = randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), user.id, Date.now() + 7 * 86400000); res.setHeader('set-cookie', `slotvend=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${origin.startsWith('https:') ? '; Secure' : ''}`); }
async function review(text) { moderate(text); if (process.env.REQUIRE_SEMANTIC_MODERATION === 'true' && !hasAI) throw Error('Content creation is paused until the moderation service is configured.'); await semanticModerate(text); }
function required(req) { const u = current(req); if (!u) throw Error('Choose a practice name or connect your NEAR wallet first.'); return u; }
async function profile(u) { if (!u) return null; let credit = u.credit, pending = '0', chain_error = null; if (u.kind === 'wallet' && contractId) { try { [credit, pending] = await Promise.all([view('get_credit', { account_id: u.id }), view('get_pending', { account_id: u.id })]); } catch { chain_error = 'NEAR balance unavailable. Try refreshing.'; } } return { ...u, credit, pending, chain_error }; }
function decorated(b) { const media = db.prepare('SELECT cover,stream_json FROM room_media WHERE bet_id=?').get(b.id); const reactions = {}; for (const r of db.prepare('SELECT emoji,count(*) AS n FROM reactions WHERE bet_id=? GROUP BY emoji').all(b.id)) reactions[r.emoji] = r.n; return { ...b, cover: media?.cover || null, stream: media?.stream_json ? JSON.parse(media.stream_json) : null, creator_name: store.user(b.creator)?.name || b.creator, opponent_name: b.opponent ? store.user(b.opponent)?.name || b.opponent : null, reactions, chat_count: db.prepare('SELECT count(*) AS n FROM messages WHERE bet_id=?').get(b.id).n }; }
function room(id) { const b = store.bet(id); if (!b) throw Error('This room was not found.'); return b; }
async function sync(id) {
  const raw = await view('get_bet', { id: Number(id.replace(/^n/, '')) }); if (!raw) throw Error('This bet was not found on NEAR.');
  // Only surface creations prepared through this moderated application. Other chain writes remain directly accessible via RPC.
  const prior = store.bet('n' + raw.id), prep = db.prepare('SELECT * FROM prepared WHERE request_id=? AND user_id=?').get(raw.request_id, raw.creator);
  if (!prior && !prep) throw Error('This room has not passed slotVend content review.');
  const terms = prep ? JSON.parse(prep.json) : prior;
  for (const key of ['title', 'rules', 'category', 'side_a', 'side_b', 'stake', 'join_before', 'ends_at', 'invitee', 'referee', 'resolver']) if (raw[key] !== terms[key]) throw Error('The on-chain terms differ from the reviewed room.');
  const rc = JSON.parse(raw.resolver_config); if (JSON.stringify(rc) !== JSON.stringify(terms.resolver_config)) throw Error('The result source differs from the reviewed room.');
  const e = db.prepare('SELECT * FROM evidence WHERE bet_id=?').get('n' + raw.id);
  const b = { ...raw, id: 'n' + raw.id, mode: 'live', resolver_config: rc, evidence: e && raw.evidence_hash === e.hash ? JSON.parse(e.json) : null };
  store.save(b); return b;
}
async function getEvidence(id) {
  if (resolving.has(id)) throw Error('A result check is already running.'); resolving.add(id);
  try {
    let b = room(id); if (b.mode === 'live') b = await sync(id);
    if (b.status !== 'matched' || Date.now() < b.ends_at) throw Error('Results can be checked after the agreed finish time for a matched bet.');
    const evidence = await resolveBet(b), digest = hash(JSON.stringify(evidence));
    if (b.mode === 'practice') store.move(id, 'oracle', { type: 'propose', outcome: evidence.outcome, evidence });
    else { db.prepare('INSERT OR REPLACE INTO evidence VALUES(?,?,?)').run(id, digest, JSON.stringify(evidence)); await propose(Number(id.slice(1)), digest, evidence.outcome); await sync(id); }
    broadcast(); return evidence;
  } finally { resolving.delete(id); }
}
async function cached(key, fn) { const old = cache.get(key); if (old && Date.now() - old.at < 30000) return old.value; const value = await fn(); cache.set(key, { at: Date.now(), value }); return value; }
const server = createServer(async (req, res) => {
  const url = new URL(req.url, origin), path = url.pathname;
  try {
    if (req.method === 'POST') { if (req.headers.origin !== origin) { json(res, { error: 'This request must come from the slotVend application.' }, 403); return; } rate('ip:' + req.socket.remoteAddress, current(req)?1000:120); }
    if (path === '/api/config') return json(res, config);
    if (path === '/api/me') return json(res, await profile(current(req)));
    if (path === '/api/events' && req.method === 'GET') {
      if (streams.size >= 1000) return json(res, { error: 'Room connections are busy.' }, 503);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' }); streams.add(res); res.write('event: ready\ndata: {}\n\n');
      const timer = setInterval(() => res.write(': heartbeat\n\n'), 20000); req.on('close', () => { clearInterval(timer); streams.delete(res); }); return;
    }
    if (path === '/api/session/practice' && req.method === 'POST') { rate('guest:' + req.socket.remoteAddress, 30, 3600000); const d = await body(req), name = shortText(d.name, 2, 24, 'Display name'); await review(name); const old = current(req); const u = old?.kind === 'practice' ? old : store.ensureUser(randomBytes(8).toString('hex') + '.practice', name, 'practice'); db.prepare('UPDATE users SET name=? WHERE id=?').run(name, u.id); login(res, u); return json(res, await profile(store.user(u.id))); }
    if (path === '/api/session/logout' && req.method === 'POST') { const token = /(?:^|;\s*)slotvend=([^;]+)/.exec(req.headers.cookie || '')?.[1]; if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); res.setHeader('set-cookie', 'slotvend=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return json(res, { ok: true }); }
    if (path === '/api/auth/challenge' && req.method === 'POST') {
      rate('auth:' + req.socket.remoteAddress, 15); const { account_id } = await body(req); if (!validAccount(account_id)) throw Error('Invalid NEAR account.');
      const id = randomUUID(), challenge = { id, account_id, nonce: randomBytes(32).toString('base64'), message: `Sign in to slotVend on NEAR testnet. No transaction or spending permission. Request: ${id}`, recipient: origin, expires: Date.now() + 300000 };
      challenges.set(id, challenge); return json(res, challenge);
    }
    if (path === '/api/auth/verify' && req.method === 'POST') {
      const d = await body(req), c = challenges.get(d.id); challenges.delete(d.id);
      if (!c || c.expires < Date.now() || c.account_id !== d.accountId) throw Error('Sign-in expired. Please reconnect.');
      await verifyMessage({ signerAccountId: d.accountId, signerPublicKey: d.publicKey, signature: new Uint8Array(Buffer.from(d.signature, 'base64')), payload: { message: c.message, recipient: c.recipient, nonce: new Uint8Array(Buffer.from(c.nonce, 'base64')) }, provider });
      const u = store.ensureUser(d.accountId, d.accountId, 'wallet'); login(res, u); return json(res, await profile(u));
    }
    if(path==='/api/parties'&&req.method==='GET')return json(res,multiplayer.list(current(req)));
    if(path==='/api/parties'&&req.method==='POST'){const u=required(req);rate('party-create:'+u.id,10);const r=multiplayer.create(await body(req),u);broadcast();return json(res,r,201);}
    const partyMatch=/^\/api\/parties\/([^/]+)(?:\/(action|start|answer|messages))?$/.exec(path);
    if(partyMatch){const [,id,action]=partyMatch;if(req.method==='GET'&&!action)return json(res,multiplayer.get(id,current(req)));if(action==='messages'&&req.method==='GET'){multiplayer.get(id,current(req));return json(res,db.prepare('SELECT m.*,u.name FROM messages m LEFT JOIN users u ON u.id=m.user_id WHERE bet_id=? ORDER BY id DESC LIMIT 100').all(id).reverse());}const u=required(req);rate('party:'+u.id,60);if(req.method==='POST'){const d=await body(req);if(action==='messages'){multiplayer.get(id,u);const message=shortText(d.text,1,500,'Message');await review(message);db.prepare('INSERT INTO messages(bet_id,user_id,text,created_at) VALUES(?,?,?,?)').run(id,u.id,message,Date.now());broadcast();return json(res,{ok:true});}const r=action==='start'?await multiplayer.start(id,u):action==='answer'?multiplayer.answer(id,u,d):action==='action'?multiplayer.action(id,u,d):null;if(!r)throw Error('Unknown room action.');broadcast();return json(res,r);}}
    if(path==='/api/play'&&req.method==='GET')return json(res,play.catalog());
    if(path==='/api/play/scores'&&req.method==='GET')return json(res,play.scores());
    const gameMatch=/^\/api\/play\/([^/]+)\/(start|run|answer|share|proof)$/.exec(path);
    if(gameMatch&&gameMatch[2]==='proof'&&req.method==='GET')return json(res,play.proof(gameMatch[1]));
    if(gameMatch){const u=required(req),[,id,action]=gameMatch;rate('play:'+u.id,60);if(action==='start'&&req.method==='POST')return json(res,await play.start(id,u,await body(req)));if(action==='share'&&req.method==='POST')return json(res,play.share(id,u));if(action==='run'&&req.method==='GET')return json(res,play.get(id,u));if(action==='answer'&&req.method==='POST')return json(res,play.answer(id,u,await body(req)));}
    if(path==='/api/community'&&req.method==='GET'){const u=current(req);return json(res,community.all().filter(r=>r.visibility==='public'||r.members.some(m=>m.id===u?.id)));}
    if(path==='/api/community'&&req.method==='POST'){const u=required(req),d=await body(req);rate('club-create:'+u.id,10);await review(`${d.title} ${d.rules}`);const r=community.create(d,u);broadcast();return json(res,r,201);}
    const clubMatch=/^\/api\/community\/([^/]+)(?:\/(action|messages|stream))?$/.exec(path);
    if(clubMatch){const [,id,action]=clubMatch,r=community.get(id);if(req.method==='GET'&&!action)return json(res,r);if(req.method==='GET'&&action==='messages')return json(res,db.prepare('SELECT m.*,u.name FROM messages m LEFT JOIN users u ON u.id=m.user_id WHERE bet_id=? ORDER BY id DESC LIMIT 100').all(id).reverse());const u=required(req);if(req.method==='POST'&&action==='action'){rate('club:'+u.id,30);const d=await body(req);if(d.evidence)await review(d.evidence);const next=community.action(id,u,d);broadcast();return json(res,next);}if(req.method==='POST'&&action==='messages'){rate('chat:'+u.id,20);const d=await body(req),message=shortText(d.text,1,500,'Message');await review(message);db.prepare('INSERT INTO messages(bet_id,user_id,text,created_at) VALUES(?,?,?,?)').run(id,u.id,message,Date.now());broadcast();return json(res,{ok:true});}}
    if (path === '/api/bets' && req.method === 'GET') return json(res, store.all().filter(b => !(b.creator==='house.practice'&&b.resolver==='maths')).filter(b => !url.searchParams.get('mode') || b.mode === url.searchParams.get('mode')).map(decorated));
    if (path === '/api/leaderboard') {
      const wins = new Map(); for (const b of store.all().filter(b => b.mode === (url.searchParams.get('mode') || 'practice') && b.status === 'settled')) { const id = b.outcome === 'creator' ? b.creator : b.opponent; const row = wins.get(id) || { id, name: store.user(id)?.name || id, wins: 0, volume: 0n }; row.wins++; row.volume += BigInt(b.stake) * 2n; wins.set(id, row); }
      return json(res, [...wins.values()].sort((a, b) => b.wins - a.wins).slice(0, 20).map(r => ({ ...r, volume: r.volume.toString() })));
    }
    if (path === '/api/prices') return json(res, await cached('prices', prices));
    if(path==='/api/sports-feed'&&req.method==='GET'){
      const date=url.searchParams.get('date')||new Date().toISOString().slice(0,10).replaceAll('-','');
      if(!/^\d{8}$/.test(date))throw Error('Choose a valid date.');
      const data=await cached(`sports-feed:${date}`,async()=>{const leagues=Object.keys(SPORT_LEAGUES);const results=await Promise.allSettled(leagues.map(l=>fixtures(l,date)));return {events:results.flatMap(r=>r.status==='fulfilled'?r.value:[]),unavailable:leagues.filter((_,i)=>results[i].status==='rejected'),observed_at:Date.now(),date,leagues:SPORT_LEAGUES};});
      return json(res,data);
    }
    if (path === '/api/fixtures') { const league = url.searchParams.get('league') || 'eng.1', date = url.searchParams.get('date') || ''; return json(res, await cached(`fixtures:${league}:${date}`, () => fixtures(league, date))); }
    if ((path === '/api/bets' || path === '/api/bets/prepare' || path === '/api/preview') && req.method === 'POST') {
      const u = required(req); rate('create:' + u.id, 10); const d = validateDraft(await body(req), u.id);
      await review(`${d.title}\n${d.rules}\n${d.side_a}\n${d.side_b}\n${JSON.stringify(d.resolver_config)}`);
      if (d.resolver === 'sports') { const {event}=await fixture(d.resolver_config.league,d.resolver_config.event_id);const {team,phase}=verifySportsEntry(d,event,{practice:u.kind==='practice'});d.resolver_config.in_play=phase==='live';d.title=`Will ${team.team.displayName} win ${new Date(event.date).toLocaleDateString('en-GB',{timeZone:'UTC'})}?`; }
      if (path === '/api/preview') return json(res, d);
      if (u.kind === 'practice') { const b = store.create(createBet(randomUUID(), u.id, d, 'practice')); broadcast(); return json(res, decorated(b), 201); }
      if (!contractId) throw Error('The NEAR testnet contract must be configured before creating a wallet bet.');
      if (d.resolver !== 'players' && !oracleReady) throw Error('The automatic result signer is not configured for NEAR yet.');
      if (d.resolver === 'evidence' && !hasAI) throw Error('NEAR AI is not configured. Choose another settlement method.');
      for (const [key, max] of [['title', 120], ['rules', 500], ['side_a', 40], ['side_b', 40]]) if (Buffer.byteLength(d[key]) > max) throw Error(`${key} is too long for on-chain storage. Shorten the text.`);
      const request_id = randomUUID(); db.prepare('INSERT INTO prepared VALUES(?,?,?,?)').run(request_id, u.id, JSON.stringify(d), Date.now() + 86400000);
      const args = { request_id, ...Object.fromEntries(['title', 'rules', 'category', 'side_a', 'side_b', 'stake', 'join_before', 'ends_at', 'invitee', 'referee', 'resolver'].map(k => [k, d[k]])), resolver_config: JSON.stringify(d.resolver_config) };
      return json(res, { request_id, transaction: nearTransaction('create_bet', args, (BigInt(d.stake) + STORAGE).toString()) });
    }
    if (path === '/api/recover' && req.method === 'POST') { const u = required(req), { request_id } = await body(req); const id = await view('get_request', { account_id: u.id, request_id }); if (id === null) throw Error('The creation is not confirmed on NEAR yet. No new transaction was sent.'); const b = await sync('n' + id); broadcast(); return json(res, decorated(b)); }
    if (path === '/api/collect' && req.method === 'POST') { const u = required(req); if (u.kind === 'wallet') return json(res, { transaction: nearTransaction('withdraw', {}) }); const updated = store.collect(u.id); broadcast(); return json(res, updated); }
    if (path === '/api/report' && req.method === 'POST') { const u = required(req), d = await body(req); rate('report:' + u.id, 10); const reason = shortText(d.reason, 3, 300, 'Report reason'), target = shortText(d.target, 1, 100, 'Report target'); db.prepare('INSERT OR IGNORE INTO reports(user_id,target,reason,created_at) VALUES(?,?,?,?)').run(u.id, target, reason, Date.now()); return json(res, { ok: true }); }
    const match = /^\/api\/bets\/([^/]+)(?:\/(messages|action|resolve|reaction|sync|media))?$/.exec(path);
    if (match) {
      const [, id, endpoint] = match, b = room(id);
      if (req.method === 'GET' && !endpoint) return json(res, decorated(b));
      if (req.method === 'GET' && endpoint === 'messages') return json(res, db.prepare('SELECT m.*,u.name FROM messages m LEFT JOIN users u ON u.id=m.user_id WHERE bet_id=? ORDER BY id DESC LIMIT 100').all(id).reverse());
      const u = required(req);
      if (req.method === 'POST' && endpoint === 'media') {
        if (u.id !== b.creator) throw Error('Only the creator can edit this event’s artwork and stream.');
        rate('media:' + u.id, 15); const input = await body(req), cover = coverKey(input.cover), stream = streamLink(input.stream_url);
        db.prepare('INSERT INTO room_media VALUES(?,?,?,?) ON CONFLICT(bet_id) DO UPDATE SET cover=excluded.cover,stream_json=excluded.stream_json,updated_at=excluded.updated_at').run(id, cover, stream ? JSON.stringify(stream) : null, Date.now());
        broadcast(); return json(res, decorated(b));
      }
      if (req.method === 'POST' && endpoint === 'sync') { const updated = await sync(id); broadcast(); return json(res, decorated(updated)); }
      if (req.method === 'POST' && endpoint === 'messages') { const d = await body(req); rate('chat:' + u.id, 20); const message = shortText(d.text, 1, 500, 'Message'); await review(message); db.prepare('INSERT INTO messages(bet_id,user_id,text,created_at) VALUES(?,?,?,?)').run(id, u.id, message, Date.now()); broadcast(); return json(res, { ok: true }); }
      if (req.method === 'POST' && endpoint === 'reaction') { const { emoji } = await body(req); if (!['🔥', '👏', '😂', '👀'].includes(emoji)) throw Error('Choose a room reaction.'); const old = db.prepare('SELECT emoji FROM reactions WHERE bet_id=? AND user_id=?').get(id, u.id); if (old?.emoji === emoji) db.prepare('DELETE FROM reactions WHERE bet_id=? AND user_id=?').run(id, u.id); else db.prepare('INSERT OR REPLACE INTO reactions VALUES(?,?,?)').run(id, u.id, emoji); broadcast(); return json(res, { ok: true }); }
      if (req.method === 'POST' && endpoint === 'resolve') { rate('resolve:' + u.id, 5); if (u.id !== b.creator && u.id !== b.opponent) throw Error('A player must request the result check.'); return json(res, await getEvidence(id)); }
      if (req.method === 'POST' && endpoint === 'action') {
        const d = await body(req); if (!['accept', 'cancel', 'concede', 'vote', 'referee', 'challenge', 'finalize', 'timeout'].includes(d.type)) throw Error('Unknown action.');
        if ((b.mode === 'practice') !== (u.kind === 'practice')) throw Error('Switch to the matching practice or NEAR account for this room.');
        if(d.type==='accept'&&b.resolver==='sports'){const {event}=await fixture(b.resolver_config.league,b.resolver_config.event_id);verifySportsEntry(b,event,{accepting:true,practice:b.mode==='practice'});}
        if (b.mode === 'practice') { const updated = store.move(id, u.id, d); broadcast(); return json(res, decorated(updated)); }
        if (d.outcome !== undefined && !['creator', 'opponent', 'draw'].includes(d.outcome)) throw Error('Invalid result.');
        const methods = { accept: 'accept_bet', cancel: 'cancel_bet', concede: 'concede', vote: 'report_result', referee: 'referee_result', challenge: 'challenge_result', finalize: 'finalize_result', timeout: 'refund_expired' };
        return json(res, { transaction: nearTransaction(methods[d.type], { id: Number(id.slice(1)), ...(['vote', 'referee'].includes(d.type) ? { outcome: d.outcome } : {}) }, d.type === 'accept' ? b.stake : '0') });
      }
    }
    if(await serveLibrary(req,res,path,origin))return;
    if (path.startsWith('/api/')) return json(res, { error: 'Endpoint not found.' }, 404);
    if (req.method !== 'GET') return json(res, { error: 'Method not allowed.' }, 405);
    const root = resolve('dist'), requested = resolve(root, '.' + decodeURIComponent(path));
    if (!requested.startsWith(root + '/') && requested !== root) return json(res, { error: 'Not found.' }, 404);
    let file = requested; try { if (!(await stat(file)).isFile()) file = root + '/index.html'; } catch { file = root + '/index.html'; }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2' };
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' }); res.end(await readFile(file));
  } catch (e) { if (!res.headersSent) json(res, { error: e.message || 'Something went wrong. Please try again.' }, 400); else res.end(); }
});
let processing = false;
async function tick() {
  if (processing) return; processing = true;
  try {
    for (const b of store.all().filter(b => ['matched', 'proposed', 'disputed', 'open'].includes(b.status))) {
      try {
        const t = Date.now();
        if (b.mode === 'live') { await sync(b.id); continue; }
        if ((b.status === 'open' && t >= b.join_before) || (b.status !== 'open' && t >= b.resolve_until)) { store.move(b.id, b.creator, { type: 'timeout' }); broadcast(); }
        else if (b.status === 'proposed' && t >= b.challenge_until) { store.move(b.id, b.creator, { type: 'finalize' }); broadcast(); }
        else if (b.status === 'matched' && b.resolver !== 'players' && t >= b.ends_at && !(b.resolver === 'evidence' && !hasAI)) { await getEvidence(b.id); }
      } catch { /* A missing source never guesses an outcome. Players retain settlement/refund paths. */ }
    }
    for (const [key, v] of limits) if (v.until < Date.now()) limits.delete(key);
    for (const [key, v] of challenges) if (v.expires < Date.now()) challenges.delete(key);
    db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  } finally { processing = false; }
}
const interval = setInterval(tick, 30000);
const partyInterval=setInterval(()=>{try{if(multiplayer.tick())broadcast();}catch(e){console.error('Multiplayer settlement failed:',e.message);}},1000);
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`slotVend API http://127.0.0.1:${port}`));
function close() { clearInterval(interval); clearInterval(partyInterval); for (const s of streams) s.end(); server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', close); process.on('SIGTERM', close);
