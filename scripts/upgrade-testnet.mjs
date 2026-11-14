import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Account,JsonRpcProvider,actions} from 'near-api-js';
import {assertSuccess} from '../server/near.mjs';

// Explicit, state-preserving upgrades are separate from fresh deploys, which still refuse overwrite.
const option=name=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
const expectedCurrent=option('expected-current-sha256'),expectedNew=option('expected-wasm-sha256');
assert(expectedCurrent&&expectedNew,'Supply both reviewed WASM hashes before inspecting or applying an upgrade.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stateHash=state=>hash(JSON.stringify(state.values.map(({key,value})=>({key,value})).sort((a,b)=>a.key.localeCompare(b.key))));
const id=process.env.NEAR_CONTRACT_ID,oracle=process.env.NEAR_ORACLE_ACCOUNT;
assert(id?.endsWith('.testnet')&&oracle?.endsWith('.testnet')&&id!==oracle,'Only a testnet contract with a separate oracle is allowed.');
const rpc=new JsonRpcProvider({url:process.env.NEAR_RPC_URL||'https://test.rpc.fastnear.com'});
assert.equal((await rpc.viewNodeStatus()).chain_id,'testnet');
const wasm=await readFile('evidence/slotvend.wasm'),report=JSON.parse(await readFile('evidence/contract-report.json','utf8'));
assert.equal(hash(wasm),expectedNew);assert.equal(report.wasm_sha256,expectedNew);
assert(report.completed_at&&report.checks.length>=18&&report.checks.every(check=>check.passed),'All sandbox checks must pass for this exact artifact.');
const view=(method,args={})=>rpc.callFunction({contractId:id,method,args,blockQuery:{finality:'final'}});
const [beforeCode,beforeState,beforeConfig]=await Promise.all([rpc.viewContractCode({contractId:id,blockQuery:{finality:'final'}}),rpc.viewContractState({contractId:id,blockQuery:{finality:'final'}}),view('get_config')]);
assert.equal(hash(beforeCode.code),expectedCurrent,'The existing deployment changed since review.');
assert.equal(beforeConfig.oracle,oracle);assert.equal(beforeConfig.version,2,'This upgrade preserves the existing version-2 storage layout.');
assert.notEqual(expectedCurrent,expectedNew,'The reviewed build is already deployed.');
const evidence={contract_id:id,network:'testnet',previous_wasm_sha256:expectedCurrent,wasm_sha256:expectedNew,state_sha256:stateHash(beforeState),state_entries:beforeState.values.length,sandbox_checks:report.checks.length,initialized:false};
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({...evidence,ready:true,applied:false},null,2));
}else{
 let saved;try{saved=JSON.parse(await readFile('.nearfest-testnet-keys.json','utf8'));}catch{}
 const key=process.env.NEAR_DEPLOY_PRIVATE_KEY||(saved?.contract.id===id?saved.contract.key:null);assert(key,'The existing deployment key is required.');
 const backup=await mkdtemp(join(tmpdir(),'nearfest-contract-before-'));
 await writeFile(join(backup,'contract.wasm'),beforeCode.code);await writeFile(join(backup,'state.json'),JSON.stringify(beforeState));
 const account=new Account(id,rpc,key);
 // No initialization or migration action: preserve every existing escrow and credit.
 const result=assertSuccess(await account.signAndSendTransaction({receiverId:id,actions:[actions.deployContract(wasm)],waitUntil:'FINAL',throwOnFailure:true,retries:0}));
 const [afterCode,afterState,afterConfig]=await Promise.all([rpc.viewContractCode({contractId:id,blockQuery:{finality:'final'}}),rpc.viewContractState({contractId:id,blockQuery:{finality:'final'}}),view('get_config')]);
 assert.equal(hash(afterCode.code),expectedNew,'Downloaded deployed code must match the tested artifact.');
 assert.equal(stateHash(afterState),stateHash(beforeState),'Contract state changed during the upgrade; inspect concurrent activity before continuing.');
 assert.deepEqual(afterConfig,beforeConfig);
 const completed={...evidence,transaction_hash:result.transaction.hash,backup,state_preserved:true,completed_at:new Date().toISOString()};
 await writeFile('evidence/nearfest-upgrade.json',JSON.stringify(completed,null,2)+'\n');console.log(JSON.stringify(completed,null,2));
}
