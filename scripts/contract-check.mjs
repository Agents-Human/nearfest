import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const name = `slotvend-check-${Date.now()}`, docker = process.env.DOCKER_BIN || 'docker', context = process.env.DOCKER_CONTEXT || '';
const base = context ? ['--context', context] : [];
async function cmd(args) { return new Promise((ok, no) => { const p = spawn(docker, [...base, ...args], { stdio: 'inherit' }); p.on('error', no); p.on('exit', c => c === 0 ? ok() : no(Error(`Docker command failed (${c})`))); }); }
try {
  await mkdir('evidence', { recursive: true });
  await cmd(['create', '--name', name, '--entrypoint', 'sh', '--user', '0', process.env.NEAR_TOOLCHAIN_IMAGE || 'humandemo-worker:dev', '-c', 'mkdir -p /work/cargo /work/home; cp -a /usr/local/cargo/registry /work/cargo/registry; ln -s /opt/runner/node_modules /work/node_modules; cd /work/contract; cargo build --release --target wasm32-unknown-unknown --locked --offline && cargo test --locked --offline && node /work/contract-sandbox.mjs']);
  await cmd(['cp', resolve('contract'), `${name}:/work/contract`]);
  await cmd(['cp', resolve('scripts/contract-sandbox.mjs'), `${name}:/work/contract-sandbox.mjs`]);
  await cmd(['cp', resolve('scripts/sandbox-launcher.mjs'), `${name}:/work/sandbox-launcher.mjs`]);
  await cmd(['start', '--attach', name]);
  // docker start can return success even if the container process exits unsuccessfully.
  const status = await new Promise((ok, no) => { let out = ''; const p = spawn(docker, [...base, 'inspect', '--format', '{{.State.ExitCode}}', name]); p.stdout.on('data', b => out += b); p.on('error', no); p.on('exit', () => ok(out.trim())); });
  if (status !== '0') throw Error(`Contract checks failed with container exit ${status}.`);
  await cmd(['cp', `${name}:/work/target/wasm32-unknown-unknown/release/slotvend.wasm`, resolve('evidence/slotvend.wasm')]);
  await cmd(['cp', `${name}:/work/contract-report.json`, resolve('evidence/contract-report.json')]);
  console.log('Contract build, native tests and sandbox transactions passed.');
} finally { await cmd(['rm', '-f', name]).catch(() => {}); }
