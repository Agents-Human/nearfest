// Live NEAR testnet end-to-end check for app-managed accounts.
// Usage: node --env-file-if-exists=.env scripts/managed-e2e.mjs [http://127.0.0.1:5189]
import assert from 'node:assert/strict';
const base=process.argv[2]||process.env.TEST_API_URL||'http://127.0.0.1:5189',origin=process.env.APP_ORIGIN||'http://127.0.0.1:5188';
const tag=Date.now().toString(36);
function client(name){
 let cookie='';
 const request=async(path,data)=>{
  const started=Date.now();
  const response=await fetch(base+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(120000)});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  const value=await response.json();
  console.log(`${name} ${data===undefined?'GET':'POST'} ${path} -> ${response.status} (${Date.now()-started}ms)${response.ok?'':' '+value.error}`);
  if(!response.ok)throw Object.assign(Error(value.error),{status:response.status});
  return value;
 };
 // Mirrors the browser: submit the prepared action once, then confirm finalized escrow.
 async function pay(path,data){
  const prepared=await request(path,data);
  if(!prepared?.transaction)return prepared;
  const sent=await request('/near/submit',{transaction:prepared.transaction});
  assert.equal(sent.status,'confirmed');
  for(let attempt=0;;attempt++){try{return await request('/near/confirm',{intent_id:prepared.intent_id});}catch(error){if(attempt>=10)throw error;await new Promise(resolve=>setTimeout(resolve,1500));}}
 }
 return {request,pay};
}
import {readFile,writeFile} from 'node:fs/promises';
const saved=process.env.E2E_ACCOUNTS||'';let credentials=null;
if(saved)try{credentials=JSON.parse(await readFile(saved,'utf8'));}catch{}
credentials||={host:{username:'e2eh'+tag,password:'e2e test password '+tag},guest:{username:'e2eg'+tag,password:'e2e test password '+tag}};
if(saved)await writeFile(saved,JSON.stringify(credentials));
const host=client('host'),guest=client('guest');
async function ready(c,login){
 let user;try{user=await c.request('/session/login',login);}catch{user=await c.request('/session/register',login);}
 for(let attempt=0;!user.starter_funded;attempt++){
  if(attempt>=40)throw Error('Account was not funded: '+user.account_funding_error);
  try{await c.request('/near/faucet',{});}catch{}
  await new Promise(resolve=>setTimeout(resolve,3000));user=await c.request('/me');
 }
 return user;
}
const a=await ready(host,credentials.host),b=await ready(guest,credentials.guest);
assert.equal(a.managed,true);
console.log('accounts',a.id,a.balance,b.id,b.balance);
const room=await host.pay('/parties',{game_id:process.env.E2E_GAME||'platform-relay',max_players:'2',visibility:'public',entry:'0.1',character:'pink',settings:{lives:3}});
assert(room.id,'room not created');console.log('room created',room.id,room.status);
const joined=await guest.pay(`/parties/${room.id}/action`,{type:'join'});
console.log('guest joined',joined.players?.map(p=>p.id));
assert(joined.players?.some(p=>p.id===b.id),'guest not in room');
const after=await host.request('/me');console.log('host balance after',after.balance);
console.log('E2E OK');
