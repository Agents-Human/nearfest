import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from 'pg';
import {openDatabase} from '../server/database.mjs';
import {testSchema} from './helpers/store.mjs';

function startServer(schema,overrides={}){
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:schema,DATABASE_POOL_MAX:'1',DATABASE_CONNECTION_TIMEOUT_MS:'150',PORT:'0',HOST:'127.0.0.1',APP_ORIGIN:'http://127.0.0.1:5188',NEAR_CONTRACT_ID:'',NEAR_ORACLE_ACCOUNT:'',NEAR_ORACLE_PRIVATE_KEY:'',NEAR_FAUCET_ACCOUNT:'',NEAR_FAUCET_PRIVATE_KEY:'',NEAR_AI_API_KEY:'',REQUIRE_SEMANTIC_MODERATION:'false',...overrides},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
 return {child,output:()=>output,async ready(){for(let i=0;i<200;i++){const match=output.match(/NearFest API http:\/\/([^:]+):(\d+)/);if(match)return {host:match[1],port:Number(match[2])};if(child.exitCode!==null)throw Error(output);await delay(25);}throw Error('API did not start: '+output);},async stop(){if(child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('API did not stop')),4000);})]);}finally{clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');}}};
}

test('the API and durable worker survive a saturated pool and recover after the blocked row is released',{timeout:15000},async()=>{
 const schema=testSchema(),setup=await openDatabase(process.env.TEST_DATABASE_URL,{schema});await setup.close();
 const admin=new Client({connectionString:process.env.TEST_DATABASE_URL});await admin.connect();
 const api=startServer(schema);let locked=false,pending;
 try{
  const {port}=await api.ready(),base='http://127.0.0.1:'+port,headers={origin:'http://127.0.0.1:5188','content-type':'application/json'};
  const login=await fetch(base+'/api/session/practice',{method:'POST',headers,body:JSON.stringify({name:'Recovered player'})});assert.equal(login.status,200);headers.cookie=login.headers.get('set-cookie').split(';')[0];
  const created=await fetch(base+'/api/parties',{method:'POST',headers,body:JSON.stringify({game_id:'connect-four',entry:'0'})});assert.equal(created.status,201);const room=await created.json();
  await admin.query('BEGIN');await admin.query('SELECT id FROM '+schema+'.skill_rooms WHERE id=$1 FOR UPDATE',[room.id]);locked=true;
  pending=fetch(base+'/api/parties/'+room.id+'/action',{method:'POST',headers,body:JSON.stringify({type:'ready',ready:true})});
  for(let i=0;i<160&&!api.output().includes('timeout exceeded when trying to connect');i++){if(api.child.exitCode!==null)break;await delay(25);}
  assert(api.output().includes('timeout exceeded when trying to connect'),api.output());
  assert.equal(api.child.exitCode,null,'A queue timeout must not terminate the process');
  assert.equal((await fetch(base+'/api/config')).status,200);
  await admin.query('ROLLBACK');locked=false;
  const response=await pending;assert.equal(response.status,200,await response.text());
  const recovered=await fetch(base+'/api/parties/'+room.id,{headers});assert.equal(recovered.status,200);assert.equal((await recovered.json()).players[0].ready,true);
  assert.equal(api.child.exitCode,null);
 }finally{if(locked)await admin.query('ROLLBACK');if(pending)await pending.catch(()=>{});await api.stop();await admin.end();}
});

test('an idle API performs no repeated scans of application tables',{timeout:15000},async()=>{
 const schema=testSchema(),api=startServer(schema),admin=new Client({connectionString:process.env.TEST_DATABASE_URL});await admin.connect();
 try{
  await api.ready();await delay(1500);
  const scans=async()=>{await admin.query('SELECT pg_stat_clear_snapshot()');return (await admin.query('SELECT relname,seq_scan,idx_scan,n_tup_ins,n_tup_upd,n_tup_del FROM pg_stat_user_tables WHERE schemaname=$1 ORDER BY relname',[schema])).rows;};
  const before=await scans();await delay(2200);const after=await scans();
  assert.deepEqual(after,before,'Only the separate indexed job queues may be checked while the app is idle');assert.equal(api.child.exitCode,null);
 }finally{await api.stop();await admin.end();}
});

test('production listens on the external interface when HOST is not provided',{timeout:10000},async()=>{
 const api=startServer(testSchema(),{NODE_ENV:'production',HOST:''});
 try{const address=await api.ready();assert.equal(address.host,'0.0.0.0');assert.equal((await fetch('http://127.0.0.1:'+address.port+'/api/config')).status,200);}finally{await api.stop();}
});
