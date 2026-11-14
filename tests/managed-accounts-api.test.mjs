import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {testSchema} from './helpers/store.mjs';

test('app registration funds 10 NEAR, signs prepared actions, logs out, and restores the same account',{timeout:20000},async()=>{
 const origin='http://127.0.0.1:5188',child=spawn(process.execPath,['--import','./tests/fixtures/managed-near-rpc.mjs','server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'127.0.0.1',APP_ORIGIN:origin,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(),NEAR_MANAGED_ACCOUNT_KEY:randomBytes(32).toString('base64'),NEAR_RPC_URL:'https://managed-near-test.invalid',NEAR_CONTRACT_ID:'escrow.testnet',NEAR_ORACLE_ACCOUNT:'',NEAR_ORACLE_PRIVATE_KEY:'',NEAR_FAUCET_ACCOUNT:'',NEAR_FAUCET_PRIVATE_KEY:'',NEAR_AI_API_KEY:'',REQUIRE_SEMANTIC_MODERATION:'false'},stdio:['ignore','pipe','pipe']});
 let timeout,log='';child.stderr.on('data',data=>{log+=data;});
 try{
  const port=await new Promise((resolve,reject)=>{let output='';timeout=setTimeout(()=>reject(Error('API did not start '+log)),8000);child.once('error',reject);child.stdout.on('data',data=>{output+=data;const match=output.match(/NearFest API http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});});
  let cookie='';const request=async(path,data,expected=200)=>{
   const response=await fetch('http://127.0.0.1:'+port+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
   if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value)+' '+log);return value;
  };
  const credentials={username:'friend',password:'a private test password'},user=await request('/session/account',credentials);
  assert.equal(user.managed,true);assert.equal(user.starter_funded,true,JSON.stringify(user)+' '+log);assert.equal(user.balance,'10000000000000000000000000');assert.equal(user.account_funding_error,null);
  assert(!JSON.stringify(user).includes('encrypted_key'));assert(!JSON.stringify(user).includes('password_hash'));
  const prepared=await request('/collect',{});assert(prepared.transaction.authorization);
  assert.equal((await request('/near/submit',{transaction:prepared.transaction})).status,'confirmed');
  assert.equal((await request('/near/submit',{transaction:{...prepared.transaction,receiverId:'attacker.testnet'}},400)).error.includes('changed'),true);
  await request('/session/logout',{});assert.equal(await request('/me'),null);
  await request('/near/submit',{transaction:prepared.transaction},400);
  await request('/session/account',{...credentials,password:'incorrect password'},400);
  const returning=await request('/session/account',credentials);assert.equal(returning.id,user.id);assert.equal(returning.balance,user.balance);
  await request('/session/logout',{});
  const legacyLogin=await request('/session/login',credentials);assert.equal(legacyLogin.id,user.id);
  const history=await request('/near/reconcile',{});assert.equal(history.history.filter(item=>item.id==='starter-'+user.id).length,1);
 }finally{clearTimeout(timeout);if(child.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}}
});
