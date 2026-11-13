import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const wait = n => new Promise(r => setTimeout(r, n));
test('two independent sessions share rooms and chat; stakes stay atomic across requests and restart', { timeout: 30000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'slotvend-test-')), origin = 'http://127.0.0.1:5197'; let child, log = '';
  function start() { child = spawn(process.execPath, ['server/index.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '5197', APP_ORIGIN: origin, DATABASE_PATH: join(dir, 'test.sqlite'), SEED_PRACTICE: 'false', NEAR_AI_API_KEY: '', NEAR_CONTRACT_ID: '', REQUIRE_SEMANTIC_MODERATION: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', b => log += b); child.stderr.on('data', b => log += b); }
  async function ready() { for (let i = 0; i < 50; i++) { try { if ((await fetch(origin + '/api/config')).ok) return; } catch {} await wait(100); } throw Error(log); }
  async function stop() { if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; } }
  const client = () => { let cookie = ''; return async (path, data, expected = 200, customOrigin = origin) => { const r = await fetch(origin + '/api' + path, { method: data === undefined ? 'GET' : 'POST', headers: { origin: customOrigin, cookie, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) }); if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0]; const value = await r.json(); assert.equal(r.status, expected, JSON.stringify(value)); return value; }; };
  try {
    start(); await ready();
    const importedAsset=await fetch(origin+'/library/chogan/games/chess/index.html');assert.equal(importedAsset.status,200);assert.match(importedAsset.headers.get('content-security-policy'),/sandbox allow-scripts allow-pointer-lock;/);assert(!importedAsset.headers.get('content-security-policy').includes('allow-same-origin'));assert.deepEqual(importedAsset.headers.get('content-security-policy').match(/connect-src ([^;]+);/)[1].split(' '),[origin+'/library/','http://localhost:5197/library/','http://[::1]:5197/library/']);assert((await importedAsset.text()).includes('/library/runtime.js'));
    assert.equal((await fetch(origin+'/library/does-not-exist.js')).status,404);assert.equal((await fetch(origin+'/library/%2e%2e%2f.env')).status,404);assert.equal((await fetch(origin+'/api/me',{headers:{origin:'null'}})).headers.get('access-control-allow-origin'),null);
    const alice = client(), bob = client(), carol = client(), anon = client();
    const a = await alice('/session/practice', { name: 'Alice test' }), b = await bob('/session/practice', { name: 'Bob test' }); await carol('/session/practice', { name: 'Carol test' });
    await anon('/bets', {}, 400); await alice('/session/practice', { name: 'Test' }, 403, 'https://untrusted.invalid');
    const t = Date.now(), draft = { title: 'Who wins our local chess game?', rules: 'One agreed chess game. Its winner wins both stakes; a draw refunds both.', category: 'Gaming', side_a: 'Alice', side_b: 'Bob', stake: '5', resolver: 'players', resolver_config: {}, join_before: t + 60000, ends_at: t + 120000 };
    await alice('/preview', { ...draft, title: 'A cocaine contest?' }, 400);
    const room = await alice('/bets', draft, 201); assert.equal((await bob('/bets')).length, 1);
    await bob(`/bets/${room.id}/media`, {cover:'chess',stream_url:'https://www.twitch.tv/testplayer'},400);
    await alice(`/bets/${room.id}/media`, {cover:'chess',stream_url:'https://127.0.0.1/private'},400);
    await alice(`/bets/${room.id}/media`, {cover:'../../../secret',stream_url:''},400);
    const media=await alice(`/bets/${room.id}/media`, {cover:'sports',stream_url:'https://youtu.be/M7lc1UVf-VE'}); assert.equal(media.stream.id,'M7lc1UVf-VE'); assert.equal(media.cover,'sports');
    const stream = await fetch(origin + '/api/events'), reader = stream.body.getReader(); await reader.read();
    await alice(`/bets/${room.id}/messages`, { text: 'Ready for a friendly match?' });
    const update = await reader.read(); assert.match(Buffer.from(update.value).toString(), /event: update/); await reader.cancel();
    const chat = await bob(`/bets/${room.id}/messages`); assert.equal(chat[0].text, 'Ready for a friendly match?'); assert.equal(chat[0].user_id, a.id);
    await bob(`/bets/${room.id}/messages`, { text: 'porn content' }, 400);
    await bob(`/bets/${room.id}/reaction`, { emoji: '🔥' }); assert.equal((await alice(`/bets/${room.id}`)).reactions['🔥'], 1);
    await bob(`/bets/${room.id}/action`, { type: 'accept' }); await carol(`/bets/${room.id}/action`, { type: 'accept' }, 400);
    await bob(`/bets/${room.id}/action`, { type: 'propose', outcome: 'opponent' }, 400); await carol(`/bets/${room.id}/action`, { type: 'concede' }, 400);
    await bob(`/bets/${room.id}/action`, { type: 'concede' }); await bob(`/bets/${room.id}/action`, { type: 'concede' }, 400);
    assert.equal((await alice('/me')).credit, '10000000000000000000000000'); await alice('/collect', {}); await alice('/collect', {}, 400);
    assert.equal((await alice('/me')).balance, '1005000000000000000000000000'); assert.equal((await bob('/me')).balance, '995000000000000000000000000');
    assert.equal((await alice('/leaderboard'))[0].id, a.id);
    await bob('/report', { target: `bet:${room.id}`, reason: 'Test report queue' });
    const auth = await alice('/auth/challenge', { account_id: 'alice.testnet' }); await alice('/auth/verify', { id: auth.id, accountId: 'wrong.testnet', publicKey: 'invalid', signature: 'invalid' }, 400); await alice('/auth/verify', { id: auth.id, accountId: 'alice.testnet', publicKey: 'invalid', signature: 'invalid' }, 400);
    const catalogue=await anon('/play');assert.equal(catalogue.filter(g=>g.multiplayer).length,19);assert(!JSON.stringify(catalogue).includes('"answer":'));
    const party=await alice('/parties',{game_id:'chess',entry:'1',max_players:4},201);
    await bob(`/parties/${party.id}/action`,{type:'join'});
    await anon(`/parties/${party.id}/answer`,{index:0,answer:'g6g7'},400);
    await alice(`/parties/${party.id}/action`,{type:'ready',ready:true});
    await bob(`/parties/${party.id}/action`,{type:'ready',ready:true});
    await bob(`/parties/${party.id}/start`,{},400);
    const round=await alice(`/parties/${party.id}/start`,{});assert.equal(round.question,null);
    await alice(`/parties/${party.id}/messages`,{text:'Ready for this shared round.'});assert.equal((await bob(`/parties/${party.id}/messages`)).length,1);
    await wait(Math.max(0,round.starts_at-Date.now()+20));
    const aq=await alice(`/parties/${party.id}`),bq=await bob(`/parties/${party.id}`);assert.deepEqual(aq.question,bq.question);assert(!('answer' in aq.question));assert.equal((await anon(`/parties/${party.id}`)).question,null);
    await alice(`/parties/${party.id}/answer`,{index:0,answer:'g6g7'});await alice(`/parties/${party.id}/answer`,{index:0,answer:'g6g7'},400);
    const final=await bob(`/parties/${party.id}/answer`,{index:0,answer:'g6g7'});assert.equal(final.status,'finished');assert.equal(final.winners.length,2);assert.equal((await alice('/me')).credit,'1000000000000000000000000');
    const solo=await alice('/play/chess/start',{});await bob(`/play/${solo.id}/run`,undefined,400);await alice(`/play/${solo.id}/answer`,{index:0,answer:'g6g7'});await anon(`/play/${solo.id}/proof`,undefined,400);await alice(`/play/${solo.id}/share`,{});assert.equal((await anon(`/play/${solo.id}/proof`)).score,1);
    await stop(); start(); await ready(); assert.equal((await bob(`/bets/${room.id}`)).status, 'settled'); assert.equal((await bob(`/bets/${room.id}`)).stream.platform, 'youtube'); assert.equal((await alice(`/bets/${room.id}/messages`)).length, 1); assert.equal((await bob('/me')).id, b.id);assert.equal((await bob(`/parties/${party.id}`)).status,'finished');assert.equal((await alice('/me')).credit,'1000000000000000000000000');
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
