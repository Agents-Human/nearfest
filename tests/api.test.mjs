import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
const wait = n => new Promise(r => setTimeout(r, n));
test('guest sessions remain free; NEAR stakes reject guests; origin, catalogue and private runs survive restart', { timeout: 30000 }, async () => {
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
    await alice('/bets',draft,400);await alice('/parties',{game_id:'connect-four',entry:'0.1'},400);await alice('/collect',{},400);assert.equal((await alice('/me')).balance,'0');assert.equal((await bob('/me')).credit,'0');
    const auth = await alice('/auth/challenge', { account_id: 'alice.testnet' }); await alice('/auth/verify', { id: auth.id, accountId: 'wrong.testnet', publicKey: 'invalid', signature: 'invalid' }, 400); await alice('/auth/verify', { id: auth.id, accountId: 'alice.testnet', publicKey: 'invalid', signature: 'invalid' }, 400);
    const catalogue=await anon('/play');assert.equal(catalogue.filter(g=>g.multiplayer).length,55);assert(!JSON.stringify(catalogue).includes('"answer":'));
    await alice('/parties',{game_id:'ludo',entry:'0'},400);
    await alice('/parties',{game_id:'kalah',entry:'0'},400);
    for(const game_id of ['chess','trivia','maths','science']){const restored=await alice('/parties',{game_id,entry:'0'},201);assert.equal(restored.game_id,game_id);}
    const solo=await alice('/play/chess/start',{});await bob(`/play/${solo.id}/run`,undefined,400);await alice(`/play/${solo.id}/answer`,{index:0,answer:'g6g7'});await anon(`/play/${solo.id}/proof`,undefined,400);await alice(`/play/${solo.id}/share`,{});assert.equal((await anon(`/play/${solo.id}/proof`)).score,1);
    await stop();start();await ready();assert.equal((await bob('/me')).id,b.id);assert.equal((await alice('/me')).credit,'0');
  } finally { await stop(); await rm(dir, { recursive: true, force: true }); }
});
