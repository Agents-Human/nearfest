import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { KeyPair } from 'near-api-js';
const sleep = n => new Promise(r => setTimeout(r, n));
export async function launchSandbox() {
  const home = '/work/sandbox'; await mkdir(home, { recursive: true });
  await new Promise((ok, no) => { const p = spawn('/opt/near/near-sandbox', ['--home', home, 'init', '--fast'], { stdio: 'ignore' }); p.on('error', no); p.on('exit', c => c === 0 ? ok() : no(Error('Sandbox init failed'))); });
  const genesis = JSON.parse(await readFile(home + '/genesis.json', 'utf8')), key = KeyPair.fromRandom('ed25519'), accountId = 'sandbox', balance = 10n ** 28n;
  genesis.epoch_length = 100000000; genesis.total_supply = (BigInt(genesis.total_supply) + balance).toString();
  genesis.records.push({ Account: { account_id: accountId, account: { amount: balance.toString(), locked: '0', code_hash: '11111111111111111111111111111111', storage_usage: 182 } } }, { AccessKey: { account_id: accountId, public_key: key.getPublicKey().toString(), access_key: { nonce: 0, permission: 'FullAccess' } } });
  await writeFile(home + '/genesis.json', JSON.stringify(genesis));
  const config = JSON.parse(await readFile(home + '/config.json', 'utf8')); config.store.max_open_files = 512; await writeFile(home + '/config.json', JSON.stringify(config));
  const p = spawn('/opt/near/near-sandbox', ['--home', home, 'run', '--rpc-addr', '127.0.0.1:3030', '--network-addr', '127.0.0.1:3031'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { const r = await fetch('http://127.0.0.1:3030/status'); await r.body.cancel(); if (r.ok) return { accountId, key, rpcUrl: 'http://127.0.0.1:3030', stop: () => p.kill('SIGTERM') }; } catch {} await sleep(250); }
  p.kill(); throw Error('Sandbox did not start.');
}
