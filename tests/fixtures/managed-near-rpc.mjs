// An isolated NEAR RPC/faucet double; the real SDK still creates and signs transactions.
import {decodeSignedTransaction,encodeTransaction,baseEncode} from 'near-api-js';
import {createHash} from 'node:crypto';
const original=globalThis.fetch,accounts=new Map(),transactions=new Map(),block='11111111111111111111111111111111';
const respond=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
globalThis.fetch=async(input,options)=>{
 const url=String(input);
 if(url==='https://helper.nearprotocol.com/account'){
  const {newAccountId,newAccountPublicKey}=JSON.parse(options.body);if(accounts.has(newAccountId))return new Response('Already exists',{status:409});
  accounts.set(newAccountId,{publicKey:newAccountPublicKey,amount:'10000000000000000000000000'});return respond({transaction:{hash:'initial-grant'}});
 }
 if(url!=='https://managed-near-test.invalid')return original(input,options);
 const request=JSON.parse(options.body),{method,params}=request;let result;
 if(method==='status')result={chain_id:'testnet'};
 else if(method==='block')result={header:{hash:block,height:1}};
 else if(method==='EXPERIMENTAL_protocol_config')result={runtime_config:{storage_amount_per_byte:'10000000000000000000'}};
 else if(method==='query'){
  if(params.request_type==='call_function')result={result:[...Buffer.from('"0"')],logs:[],block_height:1,block_hash:block};
  else{
   const account=accounts.get(params.account_id);if(!account)return respond({jsonrpc:'2.0',id:request.id,error:{name:'HANDLER_ERROR',cause:{name:'UNKNOWN_ACCOUNT',info:{requested_account_id:params.account_id,block_hash:block,block_height:1}},code:-32000,message:'Server error'}});
   if(params.request_type==='view_account')result={amount:account.amount,locked:'0',storage_usage:0,code_hash:block,block_hash:block,block_height:1};
   else if(params.request_type==='view_access_key'){if(params.public_key!==account.publicKey)throw Error('Wrong key');result={nonce:1,permission:'FullAccess',block_hash:block,block_height:1};}
   else throw Error('Unexpected query '+params.request_type);
  }
 }else if(method==='send_tx'||method==='broadcast_tx_commit'){
  const signed=decodeSignedTransaction(Buffer.from(params.signed_tx_base64||params[0],'base64'));
  const hash=baseEncode(createHash('sha256').update(encodeTransaction(signed.transaction)).digest());
  result={transaction:{hash},final_execution_status:'FINAL',status:{SuccessValue:''},receipts_outcome:[]};transactions.set(hash,result);
 }else if(method==='tx'){
  const hash=params.tx_hash||params[0];if(!transactions.has(hash))return respond({jsonrpc:'2.0',id:request.id,error:{code:-32000,message:'Unknown transaction'}});result=transactions.get(hash);
 }else throw Error('Unexpected RPC '+method);
 return respond({jsonrpc:'2.0',id:request.id,result});
};
