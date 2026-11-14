import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('API restarts cleanly while both lobby and arcade event streams are open',{timeout:15000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'nearfest-shutdown-'));
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'0',DATABASE_PATH:join(directory,'test.sqlite'),APP_ORIGIN:'http://127.0.0.1:5188',NEAR_CONTRACT_ID:'',NEAR_ORACLE_ACCOUNT:'',NEAR_ORACLE_PRIVATE_KEY:'',NEAR_FAUCET_ACCOUNT:'',NEAR_FAUCET_PRIVATE_KEY:'',NEAR_AI_API_KEY:''},stdio:['ignore','pipe','pipe']});
 const readers=[];let timeout;
 try{
  const port=await new Promise((resolve,reject)=>{let output='';timeout=setTimeout(()=>reject(Error('API did not start')),7000);child.once('error',reject);child.stdout.on('data',data=>{output+=data;const match=output.match(/NearFest API http:\/\/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});});
  const base=`http://127.0.0.1:${port}`,headers={origin:'http://127.0.0.1:5188','content-type':'application/json'};
  const auth=await fetch(base+'/api/session/guest',{method:'POST',headers,body:JSON.stringify({name:'Shutdown check'})});assert.equal(auth.status,200);headers.cookie=auth.headers.get('set-cookie').split(';')[0];
  const response=await fetch(base+'/api/parties',{method:'POST',headers,body:JSON.stringify({game_id:'platform-relay',entry:'0',max_players:2})});assert.equal(response.status,201);const room=await response.json();
  for(const path of ['/api/events',`/api/arcade/${room.id}/events`]){const stream=await fetch(base+path,{headers});assert.equal(stream.status,200);const reader=stream.body.getReader();readers.push(reader);assert.equal((await reader.read()).done,false);}
  const exit=once(child,'exit');child.kill('SIGTERM');
  const result=await Promise.race([exit,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Open game stream blocked API shutdown')),5000);})]);clearTimeout(timeout);assert.equal(result[0],0);
 }finally{clearTimeout(timeout);if(child.exitCode===null)child.kill('SIGKILL');for(const reader of readers)await reader.cancel().catch(()=>{});await rm(directory,{recursive:true,force:true});}
});
