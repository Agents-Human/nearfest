import { readFile } from 'node:fs/promises';
import { Account, JsonRpcProvider, actions } from 'near-api-js';
import { createHash } from 'node:crypto';
let saved;try{saved=JSON.parse(await readFile('.nearfest-testnet-keys.json','utf8'));}catch{}
const id=process.env.NEAR_CONTRACT_ID,key=process.env.NEAR_DEPLOY_PRIVATE_KEY||(saved?.contract.id===id?saved.contract.key:null),oracle=process.env.NEAR_ORACLE_ACCOUNT;
if (!id || !key || !oracle || !id.endsWith('.testnet') || !oracle.endsWith('.testnet')) throw Error('Set a new, funded NEAR_CONTRACT_ID ending .testnet, its NEAR_DEPLOY_PRIVATE_KEY, and a separate NEAR_ORACLE_ACCOUNT ending .testnet.');
if (id === oracle) throw Error('Use a separate oracle account so its key cannot upgrade the contract.');
const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com' });
const status = await provider.viewNodeStatus(); if (status.chain_id !== 'testnet') throw Error('Deployment is restricted to NEAR testnet.');
const state = await provider.viewAccount({ accountId: id }); if (state.code_hash !== '11111111111111111111111111111111') throw Error('This account already has a contract. Refusing to overwrite it.');
const wasm = await readFile('evidence/slotvend.wasm'), account = new Account(id, provider, key);
const { assertSuccess } = await import('../server/near.mjs');
assertSuccess(await account.signAndSendTransaction({ receiverId: id, actions: [actions.deployContract(wasm), actions.functionCall('new', { oracle }, 100_000_000_000_000n, 0n)], waitUntil: 'FINAL', throwOnFailure: true, retries: 0 }));
const config = await provider.callFunction({ contractId: id, method: 'get_config', args: {}, blockQuery: { finality: 'final' } });
const deployedCode=await provider.viewContractCode({contractId:id,blockQuery:{finality:'final'}});if(createHash('sha256').update(deployedCode.code).digest('hex')!==createHash('sha256').update(wasm).digest('hex'))throw Error('Deployed WASM does not match the tested build.');
if (config.oracle !== oracle) throw Error('Oracle verification failed.');
console.log(JSON.stringify({ contract_id: id, network: 'testnet', oracle, wasm_sha256: createHash('sha256').update(wasm).digest('hex'), deployed: true }, null, 2));
