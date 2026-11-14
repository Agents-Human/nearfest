// An isolated NEAR RPC/faucet double; the real SDK still creates and signs transactions.
import {decodeSignedTransaction,encodeTransaction,baseEncode} from 'near-api-js';
import {createHash} from 'node:crypto';
const original=globalThis.fetch,accounts=new Map(),transactions=new Map(),rooms=new Map(),receipts=new Set(),block='11111111111111111111111111111111';
const respond=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const encoded=value=>[...Buffer.from(JSON.stringify(value))];
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
  if(params.request_type==='call_function'){
   const qargs=JSON.parse(Buffer.from(params.args_base64||'','base64').toString()||'{}');
   let value='0';
   if(params.method_name==='get_config')value={oracle:process.env.NEAR_ORACLE_ACCOUNT||'oracle.testnet'};
   else if(params.method_name==='get_room')value=rooms.get(qargs.id)??null;
   else if(params.method_name==='get_funding_receipt')value=receipts.has(`${qargs.id}:${qargs.account_id}:${qargs.request_id}`);
   else if(params.method_name==='get_credit'||params.method_name==='get_pending')value='0';
   result={result:encoded(value),logs:[],block_height:1,block_hash:block};
  }else{
   const account=accounts.get(params.account_id);if(!account)return respond({jsonrpc:'2.0',id:request.id,error:{name:'HANDLER_ERROR',cause:{name:'UNKNOWN_ACCOUNT',info:{requested_account_id:params.account_id,block_hash:block,block_height:1}},code:-32000,message:'Server error'}});
   if(params.request_type==='view_account')result={amount:account.amount,locked:'0',storage_usage:0,code_hash:block,block_hash:block,block_height:1};
   else if(params.request_type==='view_access_key'){if(params.public_key!==account.publicKey)throw Error('Wrong key');result={nonce:1,permission:'FullAccess',block_hash:block,block_height:1};}
   else throw Error('Unexpected query '+params.request_type);
  }
 }else if(method==='send_tx'||method==='broadcast_tx_commit'){
  const signed=decodeSignedTransaction(Buffer.from(params.signed_tx_base64||params[0],'base64'));
  const hash=baseEncode(createHash('sha256').update(encodeTransaction(signed.transaction)).digest());
  const signer=signed.transaction.signerId,call=signed.transaction.actions?.[0]?.functionCall;
  const args=call?JSON.parse(Buffer.from(call.args).toString()||'{}'):{};
  if(call?.methodName==='create_room'&&args.entry==='123400000000000000000000'){
   result={transaction:{hash},final_execution_status:'FINAL',status:{Failure:{ActionError:{index:0,kind:'FunctionCallError'}}},receipts_outcome:[{outcome:{status:{Failure:'Failed'}}}]};
  }else{
   if(call?.methodName==='create_room'){
    rooms.set(args.id,{id:args.id,kind:args.kind,host:signer,entry:args.entry,max_members:args.max_members,join_until:args.join_until,refund_at:args.refund_at,terms_hash:args.terms_hash,status:'open',members:[{account_id:signer,amount:args.entry}],claim:null,winners:[],payouts:[],evidence_hash:null});
   }else if(call?.methodName==='contribute_room'){
    const room=rooms.get(args.id);if(room){room.members.push({account_id:signer,amount:args.amount});receipts.add(`${args.id}:${signer}:${args.request_id}`);}
   }else if(call?.methodName==='start_room'){
    const room=rooms.get(args.id);if(room)room.status='active';
   }
   if(call&&call.deposit>0n&&accounts.has(signer)){const acct=accounts.get(signer);acct.amount=(BigInt(acct.amount)-BigInt(call.deposit)).toString();}
   result={transaction:{hash},final_execution_status:'FINAL',status:{SuccessValue:''},receipts_outcome:[]};
  }
  transactions.set(hash,result);
 }else if(method==='tx'){
  const hash=params.tx_hash||params[0];if(!transactions.has(hash))return respond({jsonrpc:'2.0',id:request.id,error:{code:-32000,message:'Unknown transaction'}});result=transactions.get(hash);
 }else throw Error('Unexpected RPC '+method);
 return respond({jsonrpc:'2.0',id:request.id,result});
};
