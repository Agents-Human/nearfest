import assert from 'node:assert/strict';
import {JsonRpcProvider} from 'near-api-js';
const rpc=new JsonRpcProvider({url:'https://test.rpc.fastnear.com'}),base='http://127.0.0.1:5189/api',origin='http://127.0.0.1:5188',UNIT=10n**24n;
assert.equal((await rpc.viewNodeStatus()).chain_id,'testnet');
let cookie='';async function api(path,data){const res=await fetch(base+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(60000)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const result=await res.json();assert(res.ok,JSON.stringify(result));return result;}
const denied=await fetch(base+'/near/faucet',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});assert.equal(denied.status,400);
const user=await api('/session/account',{username:'faucetprobe'+Date.now().toString(36),password:'faucet probe password'});
assert.equal(user.managed,true);assert.equal(user.starter_funded,true);
const account=await rpc.viewAccount({accountId:user.id,blockQuery:{finality:'final'}});
assert(BigInt(account.amount)>=10n*UNIT);
const status=await api('/near/faucet');
assert.equal((await api('/me')).balance,user.balance);
console.log(JSON.stringify({passed:true,account:user.id,balance:user.balance,faucet:status}));
