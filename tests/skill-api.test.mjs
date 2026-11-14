import {testSchema} from './helpers/store.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {UNIT} from '../server/domain.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('all eight published boards share real HTTP state; independent sessions reconnect, chat and settle two games once',{timeout:40000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'slotvend-skill-api-')),origin='http://127.0.0.1:5196';let child,log='';
 async function start(){child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'5196',APP_ORIGIN:origin,DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SCHEMA:testSchema(dir),SEED_PRACTICE:'false',NEAR_AI_API_KEY:'',NEAR_CONTRACT_ID:'',REQUIRE_SEMANTIC_MODERATION:'false'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);for(let i=0;i<50;i++){try{if((await fetch(origin+'/api/config')).ok)return;}catch{}await wait(100);}throw Error(log);}
 async function stop(){if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}
 function client(){let cookie='';return async(path,data,status=200)=>{const r=await fetch(origin+'/api'+path,{method:data===undefined?'GET':'POST',headers:{origin,cookie,'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;};}
 try{
  await start();const a=client(),b=client(),spectator=client(),guest=client();const alice=await a('/session/practice',{name:'Coral tester'}),bob=await b('/session/practice',{name:'Lilac tester'});await spectator('/session/practice',{name:'Spectator'});
  const catalog=await guest('/play');assert.equal(catalog.length,58);assert(catalog.every(g=>g.solo&&g.multiplayer));const games=catalog.filter(g=>g.engine==='skill');assert.equal(games.length,8);assert(games.every(g=>g.skill_only));
  await a('/parties',{game_id:'ludo'},400);const rooms=[];
  for(const g of games){let r=await a('/parties',{game_id:g.id,entry:'0'},201);await b(`/parties/${r.id}/action`,{type:'join'});await a(`/parties/${r.id}/action`,{type:'ready',ready:true});await b(`/parties/${r.id}/action`,{type:'ready',ready:true});r=await a(`/parties/${r.id}/start`,{});assert.equal(r.legal_moves.length,0);rooms.push(r);}
  await wait(Math.max(...rooms.map(r=>r.starts_at))-Date.now()+40);
  let seq=0;const snapshots=[];
  for(const waiting of rooms){let r=await a(`/parties/${waiting.id}`);const other=await b(`/parties/${r.id}`);assert.deepEqual(r.board,other.board);assert.equal(other.legal_moves.length,0);const view=await spectator(`/parties/${r.id}`);assert.deepEqual(view.board,r.board);assert.equal(view.legal_moves.length,0);const d={type:'move',revision:r.revision,input_id:'network-'+seq++,move:r.game_id==='connect-four'?{column:0}:r.legal_moves[0]};await b(`/parties/${r.id}/action`,d,400);r=await a(`/parties/${r.id}/action`,d);const duplicate=await a(`/parties/${r.id}/action`,d);assert.equal(duplicate.revision,r.revision);assert.deepEqual((await b(`/parties/${r.id}`)).board,r.board);snapshots.push(r);}
  const target=snapshots.find(r=>r.game_id==='connect-four');
  await spectator(`/parties/${target.id}/messages`,{text:'I should not be allowed to post'},400);
  const stream=await fetch(origin+'/api/events'),reader=stream.body.getReader();await reader.read();await a(`/parties/${target.id}/messages`,{text:'Good luck on the shared board.'});assert.match(Buffer.from((await reader.read()).value).toString(),/update/);await reader.cancel();assert.equal((await b(`/parties/${target.id}/messages`))[0].text,'Good luck on the shared board.');
  await stop();await start();for(const s of snapshots)assert.deepEqual((await a(`/parties/${s.id}`)).board,s.board);
  let r=await a(`/parties/${target.id}`);
  for(const column of [1,0,1,0,1,0]){const c=r.turn_player===alice.id?a:b;r=await c(`/parties/${r.id}/action`,{type:'move',revision:r.revision,input_id:'network-'+seq++,move:{column}});}
  assert.equal(r.leg,2);assert.equal(r.turn_player,bob.id);assert.equal(r.results[0].winner,alice.id);
  await wait(Math.max(0,r.starts_at-Date.now()+30));r=await a(`/parties/${r.id}`);
  for(const column of [5,0,5,0,6,0,6,0]){const c=r.turn_player===alice.id?a:b;r=await c(`/parties/${r.id}/action`,{type:'move',revision:r.revision,input_id:'network-'+seq++,move:{column}});}
  assert.equal(r.status,'finished');assert.deepEqual(r.winners,[alice.id]);assert.equal((await a('/me')).credit,'0');assert.equal((await b('/me')).credit,'0');await a(`/parties/${r.id}/action`,{type:'resign'},400);assert.equal((await a('/me')).credit,'0');

  const knowledge=[];
  for(const game_id of ['trivia','maths','science']){
   const solo=await a(`/play/${game_id}/start`,{});assert(solo.question);assert(!('answer' in solo.question));
   let q=await a('/parties',{game_id,entry:'0'},201);await b(`/parties/${q.id}/action`,{type:'join'});
   await a(`/parties/${q.id}/action`,{type:'ready',ready:true});await b(`/parties/${q.id}/action`,{type:'ready',ready:true});
   q=await a(`/parties/${q.id}/start`,{});assert.equal(q.question,null);knowledge.push(q);
  }
  await wait(Math.max(...knowledge.map(q=>q.starts_at))-Date.now()+40);
  for(const q of knowledge){
   let qa=await a(`/parties/${q.id}`),qb=await b(`/parties/${q.id}`);assert.deepEqual(qa.question,qb.question);assert(qa.question);
   await a(`/parties/${q.id}/answer`,{index:0,answer:0});qb=await b(`/parties/${q.id}`);assert.equal(qb.me.index,0);
   await b(`/parties/${q.id}/answer`,{index:0,answer:0});qa=await a(`/parties/${q.id}`);qb=await b(`/parties/${q.id}`);assert.deepEqual(qa.question,qb.question);assert.equal(qa.me.index,1);
  }
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
