import { Account, JsonRpcProvider, actions } from 'near-api-js';
export const contractId = process.env.NEAR_CONTRACT_ID || '';
if(contractId&&!contractId.endsWith('.testnet'))throw Error('NearFest contracts must use a .testnet account.');
export const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com' });
export const oracleReady = Boolean(process.env.NEAR_ORACLE_ACCOUNT && process.env.NEAR_ORACLE_PRIVATE_KEY && contractId);
export async function view(method, args = {}) {
  if (!contractId) throw Error('The NEAR testnet contract is not configured yet. Free play is available.');
  await assertTestnet();
  return provider.callFunction({ contractId, method, args, blockQuery: { finality: 'final' } });
}
export function transaction(methodName, args, deposit = '0') {
  if (!contractId) throw Error('Connect a deployed NEAR testnet contract first.');
  return { receiverId: contractId, actions: [{ type: 'FunctionCall', params: { methodName, args, deposit, gas: '150000000000000' } }] };
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
