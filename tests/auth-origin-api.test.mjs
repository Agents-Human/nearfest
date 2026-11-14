import {testSchema} from './helpers/store.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

// Browser Origin headers omit the trailing slash present in a copied app URL.
test('first login uses the normalized APP_ORIGIN and still rejects foreign origins',{timeout:15000},async()=>{
 const origin='https://nearfest-2fgw8.ondigitalocean.app';
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',PORT:'0',HOST:'127.0.0.1',DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(),APP_ORIGIN:'  https://NearFest-2fgw8.ondigitalocean.app:443/  ',NEAR_CONTRACT_ID:'',NEAR_ORACLE_ACCOUNT:'',NEAR_ORACLE_PRIVATE_KEY:'',NEAR_FAUCET_ACCOUNT:'',NEAR_FAUCET_PRIVATE_KEY:'',NEAR_AI_API_KEY:'',REQUIRE_SEMANTIC_MODERATION:'false'},stdio:['ignore','pipe','pipe']});
 let timeout,errors='';child.stderr.on('data',data=>{errors+=data;});
 try{
  const port=await new Promise((resolve,reject)=>{let output='';timeout=setTimeout(()=>reject(Error('API did not start: '+errors)),7000);child.once('error',reject);child.stdout.on('data',data=>{output+=data;const match=output.match(/NearFest API http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});});
  const base='http://127.0.0.1:'+port;
  const post=(path,data={},requestOrigin=origin)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(requestOrigin===undefined?{}:{origin:requestOrigin})},body:JSON.stringify(data)});
  for(const foreign of ['https://attacker.example',origin+'.attacker.example','http://nearfest-2fgw8.ondigitalocean.app','null','']){
   const blocked=await post('/api/session/guest',{name:'First login'},foreign);assert.equal(blocked.status,403,foreign);assert.match((await blocked.json()).error,/must come from/);
  }
  const missing=await fetch(base+'/api/session/guest',{method:'POST',headers:{'content-type':'application/json'},body:'{"name":"First login"}'});assert.equal(missing.status,403);
  const login=await post('/api/session/guest',{name:'First login'});assert.equal(login.status,200,await login.clone().text());
  assert.match(login.headers.get('set-cookie'),/; Secure(?:;|$)/);
  const cookie=login.headers.get('set-cookie').split(';')[0],user=await login.json();
  const me=await fetch(base+'/api/me',{headers:{cookie}});assert.equal((await me.json()).id,user.id);
 }finally{
  clearTimeout(timeout);if(child.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}
 }
});
