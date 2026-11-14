import {withChoiceArt} from './choice-art.mjs';
import { randomUUID, randomInt } from 'node:crypto';
import { games,discoveryGames } from './game-catalog.mjs';
import { banks } from './question-bank.mjs';
import { recipeQuestions } from './recipe-questions.mjs';
import { curateQuestions } from './curator.mjs';
import { withQuestionArt } from './question-art.mjs';
export {games};
const shuffle=values=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function choice(prompt,answer,wrong){const choices=shuffle([String(answer),...wrong.map(String)]);return withQuestionArt({type:'choice',prompt,choices,answer:choices.indexOf(String(answer))});}
export function candidatesFor(id,difficulty='mixed') {
 const game=games.find(g=>g.id===id);if(game?.recipe)return recipeQuestions(game,choice);
 if(id==='chess')return [{type:'chess',prompt:'White to move. Find checkmate in one.',pieces:{f6:'K',g6:'Q',h8:'k'},answer:'g6g7',hint:'Select a white piece, then its destination.'}];
 if(['maths','times','fractions','sequence'].includes(id)){
  const generated=[],seenPrompts=new Set();
  for(let i=0;generated.length<30&&i<300;i++){
   const hard=difficulty==='brainy';
   const a=randomInt(3,hard?45:24),b=randomInt(2,hard?15:13),c=randomInt(2,9);let prompt,answer;
   if(id==='times'){
    const x=randomInt(hard?6:2,hard?25:15),y=randomInt(hard?4:2,hard?19:13);
    answer=x*y;prompt=`${x} × ${y} = ?`;
   }
   else if(id==='fractions'){
    const mode=i%3;
    if(mode===0){const denominator=[2,3,4,5,6,8,10][i%7],whole=a*denominator;answer=a;prompt=`What is 1/${denominator} of ${whole}?`;}
    else if(mode===1){const denominator=[4,5,8,10][i%4],num=randomInt(2,denominator-1),whole=a*denominator;answer=a*num;prompt=`What is ${num}/${denominator} of ${whole}?`;}
    else{const pct=[10,20,25,50,75][i%5],base=pct===25||pct===75?randomInt(2,24)*4:randomInt(2,30)*10;answer=Math.round((pct/100)*base);prompt=`What is ${pct}% of ${base}?`;}
   }
   else if(id==='sequence'){
    if(i%4===0){answer=a+4*b;prompt=`${a}, ${a+b}, ${a+2*b}, ${a+3*b}, ?`;}
    else if(i%4===1){const start=a+4*b;answer=start-4*c;prompt=`${start}, ${start-c}, ${start-2*c}, ${start-3*c}, ?`;}
    else if(i%4===2){const r=randomInt(2,4),s0=randomInt(2,6);answer=s0*r**4;prompt=`${s0}, ${s0*r}, ${s0*r**2}, ${s0*r**3}, ?`;}
    else{const base=randomInt(2,hard?10:7);answer=(base+4)**2;prompt=`${base**2}, ${(base+1)**2}, ${(base+2)**2}, ${(base+3)**2}, ?`;}
   }
   else {
    const mode=i%5;
    if(mode===0){answer=a*b;prompt=`${a} × ${b} = ?`;}
    else if(mode===1){answer=a+b+c;prompt=`${a} + ${b} + ${c} = ?`;}
    else if(mode===2){answer=(a+b)*c;prompt=`(${a} + ${b}) × ${c} = ?`;}
    else if(mode===3){const total=a*b+c;answer=total-c;prompt=`${total} − ${c} = ?`;}
    else{const prod=a*b;answer=a;prompt=`${prod} ÷ ${b} = ?`;}
   }
   if(seenPrompts.has(prompt))continue;
   seenPrompts.add(prompt);
   const distractors=[];const used=new Set([answer]);
   for(const delta of [c,-c,randomInt(10,19),-randomInt(2,9),b+1,answer>12?-b:b+4]){
    const candidate=answer+delta;
    if(candidate!==answer&&!used.has(candidate)&&(answer<0||candidate>=0)){used.add(candidate);distractors.push(candidate);}
    if(distractors.length===3)break;
   }
   while(distractors.length<3){const fallback=answer+distractors.length+2;if(!used.has(fallback)){used.add(fallback);distractors.push(fallback);}}
   generated.push(choice(prompt,answer,distractors));
  }
  return generated;
 }
 if(id==='words'){
  const words=['PLANET','ORANGE','BRIDGE','GARDEN','ROCKET','CASTLE','PURPLE','MARKET','FOREST','POCKET','SILVER','BASKET','LANTERN','ANCHOR','HARBOUR','COMPASS','CRYSTAL','DESERT','MEADOW','VALLEY','THUNDER','HORIZON','COBALT','VELVET','QUARTZ','SAFARI','CANOPY','GALAXY','GLACIER','ISLAND','JUNGLE','KERNEL','MAGNET','NEBULA','ORACLE','PUZZLE','QUIVER','RIBBON','SUMMIT','TIMBER','TROPHY','VOYAGE'];
  return shuffle(words).map(word=>{
   let scrambled=shuffle([...word]).join('');
   if(scrambled===word)scrambled=word.slice(1)+word[0];
   const sameLen=words.filter(w=>w!==word&&w.length===word.length);
   const pool=sameLen.length>=3?sameLen:words.filter(w=>w!==word);
   return choice(`Unscramble: ${scrambled}`,word,shuffle(pool).slice(0,3));
  });
 }
 return shuffle(banks[id]||banks.trivia).map(([q,a,...wrong])=>choice(q,a,wrong));
}
export function createPlay(store,{curate=curateQuestions}={}) {
 const {db}=store,starting=new Map();
 const read=async id=>{const r=(await db.prepare('SELECT json FROM play_runs WHERE id=$1'+(db.inTransaction()?' FOR UPDATE':'')).get(id));if(!r)throw Error('Game not found.');return JSON.parse(r.json);};
 const save=async r=>(await db.prepare('INSERT INTO play_runs(id,user_id,game_id,json) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,r.user_id,r.game_id,JSON.stringify(r)));
 function publicRun(r,now=Date.now()){const done=r.abandoned||r.index>=r.questions.length||now>=r.ends_at;let question=null;if(!done){const {answer,...q}=r.questions[r.index];question=withChoiceArt(q);}return {id:r.id,game_id:r.game_id,index:r.index,total:r.questions.length,score:r.score,ends_at:r.ends_at,abandoned:Boolean(r.abandoned),done,question,curation:r.curation||'bank',difficulty:r.difficulty||'mixed',completed_at:r.completed_at||null,shared:r.shared===true};}
 async function finishExpired(r,now=Date.now()){if(now>=r.ends_at&&!r.completed_at){r.completed_at=r.ends_at;(await save(r));}return r;}
 async function start(id,user,options={}){
   const game=games.find(g=>g.id===id);if(!game||game.engine)throw Error('Choose a timed challenge.');
   const key=user.id+':'+id;if(starting.has(key))return starting.get(key);
   const task=(async()=>{
     const pending=(await db.prepare('SELECT json FROM play_runs WHERE user_id=$1 AND game_id=$2 ORDER BY created_order DESC LIMIT 1').get(user.id,id));
     if(pending){const old=(await finishExpired(JSON.parse(pending.json)));if(!publicRun(old).done)return publicRun(old);}
     const difficulty=['mixed','brainy'].includes(options.difficulty)?options.difficulty:'mixed',candidates=candidatesFor(id,difficulty);let questions=shuffle(candidates).slice(0,game.rounds),curation=id==='chess'?'puzzle':banks[id]?'bank':'generated';
     if(game.rounds>1)try{const curated=await curate(candidates,{topic:game.label,difficulty,count:game.rounds});if(curated){questions=curated;curation='ai';}}catch{/* The bounded bank stays playable when the curator is unavailable. */}
     return store.transaction(async()=>{const now=Date.now(),latest=await db.prepare('SELECT json FROM play_runs WHERE user_id=$1 AND game_id=$2 ORDER BY created_order DESC LIMIT 1 FOR UPDATE').get(user.id,id);if(latest){const existing=await finishExpired(JSON.parse(latest.json));if(!publicRun(existing).done)return publicRun(existing);}const r={id:randomUUID(),user_id:user.id,game_id:id,questions,index:0,score:0,started_at:now,ends_at:now+game.seconds*1000,curation,difficulty,shared:false};await save(r);return publicRun(r);},{key:'solo-run:'+user.id+':'+id});
   })();starting.set(key,task);try{return await task;}finally{starting.delete(key);}
 }
 const api={
   catalog:async ()=>{const counts=new Map((await db.prepare('SELECT game_id,count(*) AS n FROM play_runs GROUP BY game_id').all()).map(r=>[r.game_id,r.n]));return discoveryGames.map(g=>({...g,ai_available:g.engine!=='skill'&&Boolean(process.env.NEAR_AI_API_KEY)&&g.rounds>1,plays:counts.get(g.id)||0}));},start,
   get:async (id,user)=>{const r=(await read(id));if(r.user_id!==user.id)throw Error('This run belongs to another player.');return publicRun((await finishExpired(r)));},
   end:async (id,user)=>{const r=(await read(id));if(r.user_id!==user.id)throw Error('This run belongs to another player.');if(!publicRun(r).done){r.abandoned=true;r.completed_at=Date.now();(await save(r));}return publicRun(r);},
   answer:async (id,user,data,now=Date.now())=>(await store.transaction(async ()=>{const r=(await read(id));if(r.user_id!==user.id)throw Error('This run belongs to another player.');if(publicRun(r,now).done)return publicRun((await finishExpired(r,now)),now);if(data.index!==r.index)throw Error('That question was already answered.');const q=r.questions[r.index];if(q.type==='choice'&&(!Number.isInteger(data.answer)||data.answer<0||data.answer>=q.choices.length))throw Error('Choose one answer.');if(q.type==='chess'&&(typeof data.answer!=='string'||!/^[a-h][1-8][a-h][1-8]$/.test(data.answer)))throw Error('Choose a move.');const correct=data.answer===q.answer;r.score+=correct?1:0;r.index++;if(r.index===r.questions.length)r.completed_at=now;(await save(r));return {...publicRun(r,now),feedback:{correct,answer:q.type==='choice'?q.choices[q.answer]:'Qg7#'}};})),
   share:async (id,user)=>{const r=(await read(id));if(r.user_id!==user.id)throw Error('Only the player can share this run.');(await finishExpired(r));if(!r.completed_at||r.abandoned)throw Error('Finish your run before sharing it.');r.shared=true;(await save(r));return {id:r.id};},
   proof:async id=>{const r=(await read(id));if(!r.shared||!r.completed_at)throw Error('This result has not been shared.');return {id:r.id,game_id:r.game_id,title:games.find(g=>g.id===r.game_id)?.title,name:(await store.user(r.user_id))?.name||'Player',score:r.score,total:r.questions.length,completed_at:r.completed_at,curation:r.curation};},
   scores:async ()=>{const best=new Map();for(const row of (await db.prepare('SELECT json FROM play_runs').all())){const r=JSON.parse(row.json);if(!r.completed_at||r.abandoned)continue;const old=best.get(r.user_id)||{id:r.user_id,name:(await store.user(r.user_id))?.name||r.user_id,points:0,plays:0};old.points+=r.score;old.plays++;best.set(r.user_id,old);}return [...best.values()].sort((a,b)=>b.points-a.points).slice(0,20);}
 };
 for(const method of ['get','end','share']){const operation=api[method];api[method]=(...args)=>store.transaction(()=>operation(...args));}
 return api;
}
