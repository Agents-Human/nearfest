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
 if(['maths','times','fractions','sequence'].includes(id))return Array.from({length:16},(_,i)=>{
   const a=randomInt(3,difficulty==='brainy'?40:22),b=randomInt(2,13),c=randomInt(2,8);let prompt,answer;
   if(id==='times'){answer=a*b;prompt=`${a} × ${b} = ?`;}
   else if(id==='fractions'){const denominator=[2,4,5,10][i%4],whole=a*denominator;answer=a;prompt=`What is 1/${denominator} of ${whole}?`;}
   else if(id==='sequence'){answer=a+4*b;prompt=`${a}, ${a+b}, ${a+2*b}, ${a+3*b}, ?`;}
   else {answer=i%3===0?a*b:i%3===1?a+b+c:(a+b)*c;prompt=i%3===0?`${a} × ${b} = ?`:i%3===1?`${a} + ${b} + ${c} = ?`:`(${a} + ${b}) × ${c} = ?`;}
   return choice(prompt,answer,[answer+c,answer-c,answer+randomInt(9,17)]);
 });
 if(id==='words'){const words=['PLANET','ORANGE','BRIDGE','GARDEN','ROCKET','CASTLE','PURPLE','MARKET','FOREST','POCKET','SILVER','BASKET'];return words.map(word=>{let scrambled=shuffle([...word]).join('');if(scrambled===word)scrambled=word.slice(1)+word[0];return choice(`Unscramble: ${scrambled}`,word,shuffle(words.filter(w=>w!==word)).slice(0,3));});}
 return shuffle(banks[id]||banks.trivia).map(([q,a,...wrong])=>choice(q,a,wrong));
}
export function createPlay(store,{curate=curateQuestions}={}) {
 const {db}=store,starting=new Map();
 db.exec('CREATE TABLE IF NOT EXISTS play_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,game_id TEXT NOT NULL,json TEXT NOT NULL)');
 const read=id=>{const r=db.prepare('SELECT json FROM play_runs WHERE id=?').get(id);if(!r)throw Error('Game not found.');return JSON.parse(r.json);};
 const save=r=>db.prepare('INSERT INTO play_runs VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,r.user_id,r.game_id,JSON.stringify(r));
 function publicRun(r,now=Date.now()){const done=r.abandoned||r.index>=r.questions.length||now>=r.ends_at;let question=null;if(!done){const {answer,...q}=r.questions[r.index];question=withChoiceArt(q);}return {id:r.id,game_id:r.game_id,index:r.index,total:r.questions.length,score:r.score,ends_at:r.ends_at,abandoned:Boolean(r.abandoned),done,question,curation:r.curation||'bank',difficulty:r.difficulty||'mixed',completed_at:r.completed_at||null,shared:r.shared===true};}
 function finishExpired(r,now=Date.now()){if(now>=r.ends_at&&!r.completed_at){r.completed_at=r.ends_at;save(r);}return r;}
 async function start(id,user,options={}){
   const game=games.find(g=>g.id===id);if(!game||game.engine)throw Error('Choose a timed challenge.');
   const key=user.id+':'+id;if(starting.has(key))return starting.get(key);
   const task=(async()=>{
     const pending=db.prepare('SELECT json FROM play_runs WHERE user_id=? AND game_id=? ORDER BY rowid DESC LIMIT 1').get(user.id,id);
     if(pending){const old=finishExpired(JSON.parse(pending.json));if(!publicRun(old).done)return publicRun(old);}
     const difficulty=['mixed','brainy'].includes(options.difficulty)?options.difficulty:'mixed',candidates=candidatesFor(id,difficulty);let questions=shuffle(candidates).slice(0,game.rounds),curation=id==='chess'?'puzzle':banks[id]?'bank':'generated';
     if(game.rounds>1)try{const curated=await curate(candidates,{topic:game.label,difficulty,count:game.rounds});if(curated){questions=curated;curation='ai';}}catch{/* The bounded bank stays playable when the curator is unavailable. */}
     const now=Date.now(),r={id:randomUUID(),user_id:user.id,game_id:id,questions,index:0,score:0,started_at:now,ends_at:now+game.seconds*1000,curation,difficulty,shared:false};save(r);return publicRun(r);
   })();starting.set(key,task);try{return await task;}finally{starting.delete(key);}
 }
 return {
   catalog:()=>{const counts=new Map(db.prepare('SELECT game_id,count(*) AS n FROM play_runs GROUP BY game_id').all().map(r=>[r.game_id,r.n]));return discoveryGames.map(g=>({...g,ai_available:g.engine!=='skill'&&Boolean(process.env.NEAR_AI_API_KEY)&&g.rounds>1,plays:counts.get(g.id)||0}));},start,
   get:(id,user)=>{const r=read(id);if(r.user_id!==user.id)throw Error('This run belongs to another player.');return publicRun(finishExpired(r));},
   end:(id,user)=>{const r=read(id);if(r.user_id!==user.id)throw Error('This run belongs to another player.');if(!publicRun(r).done){r.abandoned=true;r.completed_at=Date.now();save(r);}return publicRun(r);},
   answer:(id,user,data,now=Date.now())=>store.transaction(()=>{const r=read(id);if(r.user_id!==user.id)throw Error('This run belongs to another player.');if(publicRun(r,now).done)return publicRun(finishExpired(r,now),now);if(data.index!==r.index)throw Error('That question was already answered.');const q=r.questions[r.index];if(q.type==='choice'&&(!Number.isInteger(data.answer)||data.answer<0||data.answer>=q.choices.length))throw Error('Choose one answer.');if(q.type==='chess'&&(typeof data.answer!=='string'||!/^[a-h][1-8][a-h][1-8]$/.test(data.answer)))throw Error('Choose a move.');const correct=data.answer===q.answer;r.score+=correct?1:0;r.index++;if(r.index===r.questions.length)r.completed_at=now;save(r);return {...publicRun(r,now),feedback:{correct,answer:q.type==='choice'?q.choices[q.answer]:'Qg7#'}};}),
   share:(id,user)=>{const r=read(id);if(r.user_id!==user.id)throw Error('Only the player can share this run.');finishExpired(r);if(!r.completed_at||r.abandoned)throw Error('Finish your run before sharing it.');r.shared=true;save(r);return {id:r.id};},
   proof:id=>{const r=read(id);if(!r.shared||!r.completed_at)throw Error('This result has not been shared.');return {id:r.id,game_id:r.game_id,title:games.find(g=>g.id===r.game_id)?.title,name:store.user(r.user_id)?.name||'Player',score:r.score,total:r.questions.length,completed_at:r.completed_at,curation:r.curation};},
   scores:()=>{const best=new Map();for(const row of db.prepare('SELECT json FROM play_runs').all()){const r=JSON.parse(row.json);if(!r.completed_at||r.abandoned)continue;const old=best.get(r.user_id)||{id:r.user_id,name:store.user(r.user_id)?.name||r.user_id,points:0,plays:0};old.points+=r.score;old.plays++;best.set(r.user_id,old);}return [...best.values()].sort((a,b)=>b.points-a.points).slice(0,20);}
 };
}
