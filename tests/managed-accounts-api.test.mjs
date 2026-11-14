import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {testSchema} from './helpers/store.mjs';

test('managed accounts register, create & join staked rooms in one request, recover from failed tx, and collect/logout cleanly',{timeout:25000},async()=>{
 const origin='http://127.0.0.1:5188',child=spawn(process.execPath,['--import','./tests/fixtures/managed-near-rpc.mjs','server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',HOST:'127.0.0.1',APP_ORIGIN:origin,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(),NEAR_MANAGED_ACCOUNT_KEY:randomBytes(32).toString('base64'),NEAR_RPC_URL:'https://managed-near-test.invalid',NEAR_CONTRACT_ID:'escrow.testnet',NEAR_ORACLE_ACCOUNT:'oracle.testnet',NEAR_ORACLE_PRIVATE_KEY:'ed25519:3D4YudUahN1nawWv3k2mU1k4jN4F2vN1e3oQf8qB9c7w2N2x4c5v6b7n8m9p1q2r3s4t5u6v7w8x9y1z2a3b4c5d',NEAR_FAUCET_ACCOUNT:'',NEAR_FAUCET_PRIVATE_KEY:'',NEAR_AI_API_KEY:'',REQUIRE_SEMANTIC_MODERATION:'false'},stdio:['ignore','pipe','pipe']});
 let timeout,log='';child.stderr.on('data',data=>{log+=data;});
 try{
  const port=await new Promise((resolve,reject)=>{let output='';timeout=setTimeout(()=>reject(Error('API did not start '+log)),8000);child.once('error',reject);child.stdout.on('data',data=>{output+=data;const match=output.match(/NearFest API http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});});
  const client=()=>{let cookie='';return async(path,data,expected=200)=>{
   const response=await fetch('http://127.0.0.1:'+port+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
   if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const value=await response.json();assert.equal(response.status,expected,JSON.stringify(value)+' '+log);return value;
  };};
  const host=client(),guest=client();
  const credentials={username:'friend',password:'a private test password'},user=await host('/session/account',credentials);
  assert.equal(user.managed,true);assert.equal(user.starter_funded,true,JSON.stringify(user)+' '+log);assert.equal(user.balance,'10000000000000000000000000');assert.equal(user.account_funding_error,null);
  assert(!JSON.stringify(user).includes('encrypted_key'));assert(!JSON.stringify(user).includes('password_hash'));
  // Legacy external-wallet endpoints are removed.
  await host('/auth/challenge',{},404);
  await host('/near/submit',{},404);
  await host('/near/confirm',{},404);
  // A failed on-chain room creation returns 400 and does not block subsequent room creation.
  await host('/parties',{game_id:'connect-four',entry:'0.1234',max_players:2},400);
  // Creating a staked room succeeds end-to-end in one HTTP request.
  const created=await host('/parties',{game_id:'connect-four',entry:'0.1',max_players:2},201);
  assert(created.id.startsWith('board-'));assert.equal(created.transaction,undefined);assert.equal(created.near?.status,'open');
  assert.equal((await host('/near/pending')).length,0);
  // Guest registers and joins the staked room in one request, then both ready and host starts in one request.
  const g=await guest('/session/account',{username:'rivalplayer',password:'another private password'});
  assert.equal(g.starter_funded,true);
  const joined=await guest(`/parties/${created.id}/action`,{type:'join'});
  assert.equal(joined.players.length,2);assert.equal(joined.transaction,undefined);
  await host(`/parties/${created.id}/action`,{type:'ready',ready:true});
  await guest(`/parties/${created.id}/action`,{type:'ready',ready:true});
  const started=await host(`/parties/${created.id}/start`,{});
  assert.equal(started.status,'playing');assert.equal(started.near?.status,'active');
  // Collect executes directly on chain.
  const collected=await host('/collect',{});assert.equal(collected.status,'confirmed');
  // Logout, restore by username/password, and verify starter history.
  await host('/session/logout',{});assert.equal(await host('/me'),null);
  await host('/collect',{},400);
  await host('/session/account',{...credentials,password:'incorrect password'},400);
  const returning=await host('/session/account',credentials);assert.equal(returning.id,user.id);
  await host('/session/logout',{});
  const legacyLogin=await host('/session/login',credentials);assert.equal(legacyLogin.id,user.id);
  const history=await host('/near/reconcile',{});
  assert.equal(history.history.filter(item=>item.id==='starter-'+user.id).length,1);
  assert.equal(history.history.filter(item=>item.operation==='create_room'&&item.status==='confirmed').length,1);
  assert.equal(history.history.filter(item=>item.operation==='create_room'&&item.status==='failed').length,1);
 }finally{clearTimeout(timeout);if(child.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}}
});
