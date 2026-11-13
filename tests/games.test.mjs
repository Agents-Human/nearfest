import test from 'node:test';
import assert from 'node:assert/strict';
import {games,candidatesFor,createPlay} from '../server/play.mjs';
import {curateQuestions,validateSelection} from '../server/curator.mjs';
import {openStore} from '../server/store.mjs';
import {createMultiplayer} from '../server/multiplayer.mjs';
import {UNIT} from '../server/domain.mjs';
import {toggleLights,lightBoard,slideBoard,slideTile,solvedSlide,codeClue} from '../src/games/puzzles.mjs';
import GameManager from '../src/vendor/2048/game_manager.js';
import Grid from '../src/vendor/2048/grid.js';
import Tile from '../src/vendor/2048/tile.js';
const noAI=async()=>null;
function setup(){const s=openStore(':memory:'),users=['alice','bob','carol'].map(n=>s.ensureUser(n,n,'practice'));return {s,users,m:createMultiplayer(s,{curate:noAI})};}
test('1,000 generated multiplayer packs have valid, distinct choices and sufficient rounds',()=>{
 assert.equal(games.filter(g=>g.engine!=='imported').length,1024);assert.equal(games.filter(g=>g.multiplayer).length,1019);assert.equal(games.filter(g=>g.pack).length,1000);assert.equal(new Set(games.map(g=>g.id)).size,games.length);
 for(const g of games.filter(g=>!g.engine)){const questions=candidatesFor(g.id);assert(questions.length>=g.rounds,g.id);for(const q of questions){if(q.type!=='choice')continue;assert.equal(q.choices.length,4);assert.equal(new Set(q.choices).size,4);assert(q.answer>=0&&q.answer<4);assert(q.prompt.length>0);}}
});
test('curator selects only bank IDs; malformed, duplicate and invented IDs fail closed',async()=>{
 const q=candidatesFor('science');assert.throws(()=>validateSelection({question_ids:[0,0,2,3,4]},q,5));assert.throws(()=>validateSelection({question_ids:[0,1,2,3,99]},q,5));let request;
 const selected=await curateQuestions(q,{key:'test-only',topic:'science',fetcher:async(_url,opts)=>{request=JSON.parse(opts.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"question_ids":[4,3,2,1,0]}'}}]})};}});
 assert.deepEqual(selected,q.slice(0,5).reverse());assert(!request.messages[1].content.includes('"answer"'));assert.equal(await curateQuestions(q,{key:''}),null);
});
test('AI failures fall back, concurrent starts reuse a run, shared proof is opt-in and answer-free',async()=>{
 const {s,users:[a,b]}=setup();try{let calls=0;const p=createPlay(s,{curate:async()=>{calls++;throw Error('unavailable');}});const [r,other]=await Promise.all([p.start('science',a),p.start('science',a)]);assert.equal(r.id,other.id);assert.equal(calls,1);assert.equal(r.curation,'bank');assert.throws(()=>p.share(r.id,a));assert.throws(()=>p.proof(r.id));assert.throws(()=>p.share(r.id,b));let run=r;while(!run.done)run=p.answer(r.id,a,{index:run.index,answer:0});p.share(r.id,a);const proof=p.proof(r.id);assert.equal(proof.name,'alice');assert(!('questions' in proof));assert(!('user_id' in proof));}finally{s.db.close();}
});
test('shared rounds hide answers, require readiness, score privately and settle a winner exactly once',async()=>{
 const {s,m,users:[a,b,c]}=setup();try{const r=m.create({game_id:'maths',entry:'5'},a,1000);m.action(r.id,b,{type:'join'},1100);await assert.rejects(()=>m.start(r.id,a,1200));m.action(r.id,a,{type:'ready',ready:true},1201);m.action(r.id,b,{type:'ready',ready:true},1202);await assert.rejects(()=>m.start(r.id,b,1203));const started=await m.start(r.id,a,1300);assert.equal(started.question,null);assert.equal(m.get(r.id,c,6400).question,null);assert.throws(()=>m.answer(r.id,a,{index:0,answer:0},6200));const raw=JSON.parse(s.db.prepare('SELECT json FROM multiplayer_rooms WHERE id=?').get(r.id).json);assert(!JSON.stringify(m.get(r.id,a,6400)).includes('"answer":'));assert.deepEqual(m.get(r.id,a,6400).question,m.get(r.id,b,6400).question);
 for(let i=0;i<raw.questions.length;i++){m.answer(r.id,a,{index:i,answer:raw.questions[i].answer},6500+i*10);if(i===0)assert.throws(()=>m.answer(r.id,a,{index:0,answer:0},6501));m.answer(r.id,b,{index:i,answer:(raw.questions[i].answer+1)%4},6505+i*10);}
 assert.equal(m.get(r.id,a).status,'finished');assert.equal(s.user(a.id).credit,(10n*UNIT).toString());assert.equal(s.user(b.id).credit,'0');m.tick(999999);assert.equal(s.user(a.id).credit,(10n*UNIT).toString());assert.throws(()=>m.action(r.id,c,{type:'join'}));const total=[a,b].reduce((n,u)=>n+BigInt(s.user(u.id).balance)+BigInt(s.user(u.id).credit),0n);assert.equal(total,2000n*UNIT);
 }finally{s.db.close();}
});
test('ties split exactly, timeouts settle, empty-score rounds and abandoned lobbies refund',async()=>{
 const {s,m,users:[a,b,c]}=setup();try{let r=m.create({game_id:'chess',entry:'1'},a,1000);m.action(r.id,b,{type:'join'},1001);m.action(r.id,c,{type:'join'},1002);for(const u of [a,b,c])m.action(r.id,u,{type:'ready',ready:true},1003);await m.start(r.id,a,1004);m.answer(r.id,a,{index:0,answer:'g6g7'},6100);m.answer(r.id,b,{index:0,answer:'g6g7'},6101);m.tick(100000);assert.equal(s.user(a.id).credit,(3n*UNIT/2n).toString());assert.equal(s.user(b.id).credit,(3n*UNIT/2n).toString());assert.equal(s.user(c.id).credit,'0');
 r=m.create({game_id:'maths',entry:'2'},a,100000);m.action(r.id,b,{type:'join'},100001);for(const u of [a,b])m.action(r.id,u,{type:'ready',ready:true},100002);await m.start(r.id,a,100003);m.tick(200000);assert.equal(m.get(r.id,a).winners.length,0);assert.equal(s.user(a.id).credit,(35n*UNIT/10n).toString());
 r=m.create({game_id:'maths',entry:'5'},c,200000);m.tick(r.expires_at);assert.equal(m.get(r.id,c).status,'cancelled');assert.equal(s.user(c.id).credit,(5n*UNIT).toString());m.tick(r.expires_at+1);assert.equal(s.user(c.id).credit,(5n*UNIT).toString());
 }finally{s.db.close();}
});
test('puzzles preserve valid boards and codebreaker handles repeated colours',()=>{
 assert.deepEqual(codeClue([1,1,2,3],[1,2,1,1]),{exact:1,nearby:2});assert.deepEqual(codeClue([0,0,0,0],[0,0,0,0]),{exact:4,nearby:0});
 for(let n=0;n<50;n++){const l=lightBoard();assert(l.some(Boolean));for(let i=0;i<16;i++)assert.deepEqual(toggleLights(toggleLights(l,i),i),l);const b=slideBoard();assert(!solvedSlide(b));assert.deepEqual([...b].sort(),[0,1,2,3,4,5,6,7,8]);let inversions=0;const tiles=b.filter(Boolean);for(let i=0;i<8;i++)for(let j=i+1;j<8;j++)if(tiles[i]>tiles[j])inversions++;assert.equal(inversions%2,0);assert.strictEqual(slideTile(b,b.indexOf(0)),b);}
});
test('imported 2048 engine merges each tile once per move and awards correct points',()=>{
 class Input{on(){}}class Actuator{actuate(){}continueGame(){}}class Storage{getGameState(){return null;}setGameState(){}clearGameState(){}getBestScore(){return 0;}setBestScore(){}}
 const g=new GameManager(4,Input,Actuator,Storage);g.grid=new Grid(4);[2,2,2,2].forEach((v,x)=>g.grid.insertTile(new Tile({x,y:0},v)));g.addRandomTile=()=>{};g.move(3);assert.deepEqual([0,1,2,3].map(x=>g.grid.cellContent({x,y:0})?.value||0),[4,4,0,0]);assert.equal(g.score,8);g.move(3);assert.equal(g.grid.cellContent({x:0,y:0}).value,8);assert.equal(g.score,16);
});
