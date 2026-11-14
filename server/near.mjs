import {accountKey,authorizeTransaction} from './managed-crypto.mjs';
import {createNearReader,availableBalance} from './near-reads.mjs';
import { Account, JsonRpcProvider, actions } from 'near-api-js';
export const contractId = process.env.NEAR_CONTRACT_ID || '';
if(contractId&&!contractId.endsWith('.testnet'))throw Error('NearFest contracts must use a .testnet account.');
export const provider = new JsonRpcProvider(
  { url: process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com' },
  { retries: 3, wait: 400, backoff: 1.5 }
);
export const oracleReady = Boolean(process.env.NEAR_ORACLE_ACCOUNT && process.env.NEAR_ORACLE_PRIVATE_KEY && contractId);
const read=createNearReader();
export async function view(method, args = {}) {
  if (!contractId) throw Error('The NEAR testnet contract is not configured yet. Please try again when the connection is ready.');
  await assertTestnet();
  return read(method+':'+JSON.stringify(args),()=>provider.callFunction({ contractId, method, args, blockQuery: { finality: 'final' } }));
}
export function transaction(methodName, args, deposit = '0', signerId, authorizationId) {
  if (!contractId) throw Error('Connect a deployed NEAR testnet contract first.');
  return authorizeTransaction({ ...(signerId?{signerId}:{}), receiverId: contractId, actions: [{ type: 'FunctionCall', params: { methodName, args, deposit, gas: '150000000000000' } }] },accountKey(),{id:authorizationId});
}
export function assertSuccess(result) {
  const outcomes = [result?.status, ...(result?.receipts_outcome || []).map(r => r.outcome?.status)];
  if (!result || outcomes.some(s => s && typeof s === 'object' && 'Failure' in s)) throw Error('The NEAR transaction failed. The on-chain state has not been accepted as successful.');
  return result;
}
export async function propose(id, evidenceHash, outcome) {
  if (!oracleReady) throw Error('The automatic NEAR result signer is not configured.');
  const expected = await view('get_config');
  if (expected.oracle !== process.env.NEAR_ORACLE_ACCOUNT) throw Error('Oracle account does not match the contract.');
  const account = new Account(process.env.NEAR_ORACLE_ACCOUNT, provider, process.env.NEAR_ORACLE_PRIVATE_KEY);
  return assertSuccess(await account.signAndSendTransaction({ receiverId: contractId, actions: [actions.functionCall('propose_result', { id, outcome, evidence_hash: evidenceHash }, 100_000_000_000_000n, 0n)], waitUntil: 'FINAL', throwOnFailure: true, retries: 0 }));
}

let verifiedNetwork;
export async function assertTestnet(){
 if(!verifiedNetwork)verifiedNetwork=provider.viewNodeStatus().then(s=>{if(s.chain_id!=='testnet')throw Error('NearFest is restricted to NEAR testnet.');return true;}).catch(e=>{verifiedNetwork=null;throw e;});
 return verifiedNetwork;
}
export async function oracleCall(method,args){
 if(!oracleReady)throw Error('NEAR testnet result signer is not configured.');await assertTestnet();
 const expected=await view('get_config');if(expected.oracle!==process.env.NEAR_ORACLE_ACCOUNT)throw Error('Result signer does not match the contract.');
 const account=new Account(process.env.NEAR_ORACLE_ACCOUNT,provider,process.env.NEAR_ORACLE_PRIVATE_KEY);
 return assertSuccess(await account.signAndSendTransaction({receiverId:contractId,actions:[actions.functionCall(method,args,150_000_000_000_000n,0n)],waitUntil:'FINAL',throwOnFailure:true,retries:0}));
}

let storageCost,storageCostAt=0;
const PROFILE_TTL_MS=3000;
const profileCache=new Map();
export function invalidateNearAccount(accountId){if(accountId)profileCache.delete(accountId);else profileCache.clear();}
export async function balance(accountId) {
  await assertTestnet();
  if(storageCost===undefined||Date.now()-storageCostAt>300000){const config=await read('protocol',()=>provider.experimental_protocolConfig({finality:'final'}));storageCost=BigInt(config.runtime_config.storage_amount_per_byte);storageCostAt=Date.now();}
  const account=await read('account:'+accountId,()=>provider.viewAccount({accountId,blockQuery:{finality:'final'}}));
  return availableBalance(account,storageCost);
}
export async function accountProfile(accountId){
  if(!accountId)return {balance:'0',credit:'0',pending:'0',chain_error:null};
  const hit=profileCache.get(accountId);
  if(hit&&Date.now()-hit.at<PROFILE_TTL_MS)return hit.value;
  let bal='0',credit='0',pending='0',chain_error=null;
  await Promise.all([
    balance(accountId).then(v=>{bal=String(v);}).catch(()=>{chain_error='NEAR wallet balance unavailable.';}),
    ...(contractId?[
      view('get_credit',{account_id:accountId}).then(v=>{credit=v;}).catch(()=>{chain_error=chain_error||'NEAR balance unavailable. Try refreshing.';}),
      view('get_pending',{account_id:accountId}).then(v=>{pending=v;}).catch(()=>{chain_error=chain_error||'NEAR balance unavailable. Try refreshing.';}),
    ]:[]),
  ]);
  const value={balance:bal,credit,pending,chain_error};
  if(!chain_error)profileCache.set(accountId,{at:Date.now(),value});
  return value;
}
export async function requireBalance(accountId,deposit) {
  const available=BigInt(await balance(accountId));
  if(BigInt(deposit)>available)throw Error('Your wallet balance cannot cover this stake and the required contract storage.');
  return available;
}
