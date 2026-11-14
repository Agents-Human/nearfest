import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from 'pg';
import {openDatabase} from '../server/database.mjs';
import {testSchema} from './helpers/store.mjs';

function startServer(schema,overrides={}){
 const child=spawn(process.execPath,['--import','./tests/fixtures/fast-maintenance.mjs','server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:schema,DATABASE_POOL_MAX:'1',DATABASE_CONNECTION_TIMEOUT_MS:'150',PORT:'0',HOST:'127.0.0.1',APP_ORIGIN:'http://127.0.0.1:5188',NEAR_CONTRACT_ID:'',NEAR_ORACLE_ACCOUNT:'',NEAR_ORACLE_PRIVATE_KEY:'',NEAR_FAUCET_ACCOUNT:'',NEAR_FAUCET_PRIVATE_KEY:'',NEAR_AI_API_KEY:'',REQUIRE_SEMANTIC_MODERATION:'false',...overrides},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 return {child,output:()=>output,async ready(){for(let i=0;i<100;i++){const match=output.match(/NearFest API http:\/\/([^:]+):(\d+)/);if(match)return {host:match[1],port:Number(match[2])};if(child.exitCode!==null)throw Error(output);await delay(25);}throw Error('API did not start: '+output);},async stop(){if(child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('API did not stop')),4000);})]);}finally{clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');}}};
}

test('the HTTP API survives the exact pool timeout, reports it, and accepts requests after recovery',{timeout:15000},async()=>{
 const schema=testSchema(),setup=await openDatabase(process.env.TEST_DATABASE_URL,{schema});await setup.close();
 const admin=new Client({connectionString:process.env.TEST_DATABASE_URL});await admin.connect();
 const api=startServer(schema);let locked=false;
 try{
  const {port}=await api.ready(),base='http://127.0.0.1:'+port;
  await admin.query('SELECT pg_advisory_lock(hashtext($1),1)',[schema]);locked=true;
  for(let i=0;i<100&&!api.output().includes('Room maintenance failed: timeout exceeded when trying to connect');i++){if(api.child.exitCode!==null)break;await delay(25);}
  assert(api.output().includes('Room maintenance failed: timeout exceeded when trying to connect'),api.output());
  assert.equal(api.child.exitCode,null,'A background timeout must not terminate the process');
  assert.equal((await fetch(base+'/api/config')).status,200);
  await admin.query('SELECT pg_advisory_unlock(hashtext($1),1)',[schema]);locked=false;
  const login=await fetch(base+'/api/session/practice',{method:'POST',headers:{origin:'http://127.0.0.1:5188','content-type':'application/json'},body:JSON.stringify({name:'Recovered player'})});
  assert.equal(login.status,200,await login.text());
  assert.equal(api.child.exitCode,null);
 }finally{if(locked)await admin.query('SELECT pg_advisory_unlock(hashtext($1),1)',[schema]);await api.stop();await admin.end();}
});

test('production listens on the external interface when HOST is not provided',{timeout:10000},async()=>{
 const api=startServer(testSchema(),{NODE_ENV:'production',HOST:''});
 try{const address=await api.ready();assert.equal(address.host,'0.0.0.0');assert.equal((await fetch('http://127.0.0.1:'+address.port+'/api/config')).status,200);}finally{await api.stop();}
});
