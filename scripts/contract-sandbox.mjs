import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { Account, JsonRpcProvider, KeyPair, actions } from 'near-api-js';
import { launchSandbox } from './sandbox-launcher.mjs';
const UNIT = 10n ** 24n, STORAGE = 3n * 10n ** 22n, checks = [], sandbox = await launchSandbox();
const rpc = new JsonRpcProvider({ url: sandbox.rpcUrl }), root = new Account(sandbox.accountId, rpc, sandbox.key.toString()), users = {};
const wasm = await readFile('/work/target/wasm32-unknown-unknown/release/slotvend.wasm');
const sleep = n => new Promise(r => setTimeout(r, n));
const view = (method, args = {}) => rpc.callFunction({ contractId: users.contract.accountId, method, args, blockQuery: { finality: 'final' } });
async function call(who, method, args = {}, deposit = 0n, succeeds = true) {
  const r = await users[who].signAndSendTransaction({ receiverId: users.contract.accountId, actions: [actions.functionCall(method, args, 150_000_000_000_000n, deposit)], waitUntil: 'FINAL', throwOnFailure: false, retries: 0 });
  const failed = [r.status, ...(r.receipts_outcome || []).map(x => x.outcome.status)].some(s => s && typeof s === 'object' && 'Failure' in s);
  assert.equal(failed, !succeeds, `${who}.${method}: ${JSON.stringify(r.status)}`); return r;
}
const now = async () => Number(BigInt((await rpc.viewBlock({ finality: 'final' })).header.timestamp_nanosec) / 1000000n);
async function advanceTo(targetMs) {
  let last = await now(), nanosPerBlock = 1000;
  for (let i = 0; last < targetMs && i < 12; i++) {
    const delta = Math.min(3000000, Math.max(1, Math.ceil((targetMs - last) / nanosPerBlock)));
    const result = await fetch(sandbox.rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'clock', method: 'sandbox_fast_forward', params: { delta_height: delta } }) }).then(r => r.json()); if (result.error) throw Error(JSON.stringify(result.error));
    const height = (await rpc.viewBlock({ finality: 'optimistic' })).header.height;
    for (let j = 0; j < 80 && (await rpc.viewBlock({ finality: 'final' })).header.height < height; j++) await sleep(100);
    const next = await now(); nanosPerBlock = Math.max(120, (next - last) / delta); last = next;
  }
  assert.ok(last >= targetMs, 'Sandbox must reach requested final timestamp');
}
async function create(extra = {}, deposit) {
  const t = await now(), request = randomUUID(), args = { request_id: request, title: 'Will Alice win the chess game?', rules: 'One agreed game; the recorded winner takes both stakes. A draw refunds both.', category: 'Gaming', side_a: 'Alice', side_b: 'Bob', stake: UNIT.toString(), join_before: t + 300000, ends_at: t + 600000, invitee: null, referee: users.referee.accountId, resolver: 'players', resolver_config: '{}', ...extra };
  await call('alice', 'create_bet', args, deposit ?? UNIT + STORAGE);
  const id = await view('get_request', { account_id: users.alice.accountId, request_id: request }); return { id, args };
}
async function check(name, fn) { await fn(); checks.push({ name, passed: true }); console.log('PASS:', name); }
try {
  for (const name of ['contract', 'alice', 'bob', 'carol', 'referee', 'oracle']) { const key = KeyPair.fromRandom('ed25519'), id = name + '.sandbox'; await root.createAccount({ newAccountId: id, publicKey: key.getPublicKey(), nearToTransfer: 100n * UNIT }); users[name] = new Account(id, rpc, key.toString()); }
  await users.contract.deployContract(wasm); await call('contract', 'new', { oracle: users.oracle.accountId });
  let main;
  await check('exact funding, unique creation and immutable terms', async () => { main = await create(); await call('alice', 'create_bet', main.args, UNIT + STORAGE, false); assert.equal((await view('get_bets')).length, 1); const bad = { ...main.args, request_id: randomUUID() }; await call('alice', 'create_bet', bad, UNIT, false); assert.equal((await view('get_bet', { id: main.id })).stake, UNIT.toString()); });
  await check('self, referee, wrong deposit and duplicate acceptance are rejected', async () => { for (const name of ['alice', 'referee']) await call(name, 'accept_bet', { id: main.id }, UNIT, false); await call('bob', 'accept_bet', { id: main.id }, UNIT - 1n, false); await call('bob', 'accept_bet', { id: main.id }, UNIT); await call('carol', 'accept_bet', { id: main.id }, UNIT, false); await call('alice', 'cancel_bet', { id: main.id }, 0n, false); });
  await check('concession credits exact pot; only beneficiary can withdraw once', async () => { await call('carol', 'concede', { id: main.id }, 0n, false); await call('bob', 'concede', { id: main.id }); assert.equal(await view('get_credit', { account_id: users.alice.accountId }), (2n * UNIT).toString()); await call('bob', 'withdraw', {}, 0n, false); await call('alice', 'withdraw'); assert.equal(await view('get_credit', { account_id: users.alice.accountId }), '0'); assert.equal(await view('get_pending', { account_id: users.alice.accountId }), '0'); await call('alice', 'withdraw', {}, 0n, false); await call('bob', 'concede', { id: main.id }, 0n, false); });
  await check('invited opponent restriction and unmatched cancellation', async () => { const a = await create({ invitee: users.bob.accountId }); await call('carol', 'accept_bet', { id: a.id }, UNIT, false); await call('alice', 'cancel_bet', { id: a.id }); assert.equal((await view('get_bet', { id: a.id })).status, 'cancelled'); await call('bob', 'accept_bet', { id: a.id }, UNIT, false); await call('alice', 'withdraw'); });
  const agreement = await create(), disputed = await create(), automatic = await create({ resolver: 'maths', resolver_config: '{"expression":"2+2","expected":4}' }), challenged = await create({ resolver: 'maths', resolver_config: '{"expression":"2+2","expected":4}' }), timeout = await create(), expired = await create();
  for (const a of [agreement, disputed, automatic, challenged, timeout]) await call('bob', 'accept_bet', { id: a.id }, UNIT);
  await check('premature reports and automatic results are rejected', async () => { await call('alice', 'report_result', { id: agreement.id, outcome: 'creator' }, 0n, false); await call('oracle', 'propose_result', { id: automatic.id, outcome: 'creator', evidence_hash: 'a'.repeat(64) }, 0n, false); });
  await advanceTo(expired.args.ends_at + 1000);
  await check('unmatched expiry refund is permissionless and not repeatable', async () => { await call('carol', 'refund_expired', { id: expired.id }); await call('carol', 'refund_expired', { id: expired.id }, 0n, false); });
  await check('matching player results settle and disagreements require chosen referee', async () => { await call('alice', 'report_result', { id: agreement.id, outcome: 'opponent' }); await call('bob', 'report_result', { id: agreement.id, outcome: 'opponent' }); assert.equal((await view('get_bet', { id: agreement.id })).status, 'settled'); await call('alice', 'report_result', { id: disputed.id, outcome: 'creator' }); await call('bob', 'report_result', { id: disputed.id, outcome: 'opponent' }); assert.equal((await view('get_bet', { id: disputed.id })).status, 'disputed'); await call('carol', 'referee_result', { id: disputed.id, outcome: 'creator' }, 0n, false); await call('referee', 'referee_result', { id: disputed.id, outcome: 'draw' }); assert.equal((await view('get_bet', { id: disputed.id })).status, 'refunded'); });
  await check('oracle authorization, evidence commitment and review window', async () => { const args = { id: automatic.id, outcome: 'creator', evidence_hash: 'b'.repeat(64) }; await call('alice', 'propose_result', args, 0n, false); await call('oracle', 'propose_result', args); assert.equal((await view('get_bet', { id: automatic.id })).evidence_hash, args.evidence_hash); await call('carol', 'finalize_result', { id: automatic.id }, 0n, false); await call('carol', 'challenge_result', { id: automatic.id }, 0n, false); await call('oracle', 'propose_result', { ...args, id: challenged.id }); await call('bob', 'challenge_result', { id: challenged.id }); });
  await advanceTo((await view('get_bet', { id: automatic.id })).challenge_until + 1000);
  await check('unchallenged verdict finalizes; disputed verdict cannot bypass players', async () => { await call('carol', 'finalize_result', { id: automatic.id }); await call('carol', 'finalize_result', { id: automatic.id }, 0n, false); await call('carol', 'finalize_result', { id: challenged.id }, 0n, false); assert.equal((await view('get_bet', { id: challenged.id })).status, 'disputed'); });
  await advanceTo(timeout.args.ends_at + 172800000 + 1000);
  await check('48-hour timeout refunds matched and challenged bets exactly once', async () => { for (const a of [timeout, challenged]) { await call('carol', 'refund_expired', { id: a.id }); assert.equal((await view('get_bet', { id: a.id })).status, 'refunded'); await call('carol', 'refund_expired', { id: a.id }, 0n, false); } });
  await check('all remaining obligations can be collected and no callback is externally callable', async () => { const a = BigInt(await view('get_credit', { account_id: users.alice.accountId })), b = BigInt(await view('get_credit', { account_id: users.bob.accountId })); assert.equal(a + b, 11n * UNIT); await call('alice', 'on_withdraw', { account_id: users.alice.accountId }, 0n, false); for (const who of ['alice', 'bob']) { await call(who, 'withdraw'); assert.equal(await view('get_credit', { account_id: users[who].accountId }), '0'); assert.equal(await view('get_pending', { account_id: users[who].accountId }), '0'); } });
  await writeFile('/work/contract-report.json', JSON.stringify({ network: 'isolated NEAR sandbox', wasm_sha256: createHash('sha256').update(wasm).digest('hex'), checks, completed_at: new Date().toISOString() }, null, 2));
} finally { sandbox.stop(); }
