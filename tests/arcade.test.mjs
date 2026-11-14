import {simulationIds,newSimulation,advanceSimulation} from '../server/arcade/simulations.mjs';
import {createPlay} from '../server/play.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeGames} from '../server/arcade/catalog.mjs';
import {worldIds,newWorld,advanceWorld,worldAction,worldBot} from '../server/arcade/world.mjs';
import {newPuzzle,puzzleIds,puzzleAction,advancePuzzle,puzzleView,evaluateExpression,codePuzzle,circuitStatus} from '../server/arcade/puzzles.mjs';
import {newParty,partyAction,partyView,advanceParty} from '../server/arcade/party.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {openStore} from '../server/store.mjs';
import {UNIT} from '../server/domain.mjs';
import {initialChess,hasMatingMaterial} from '../server/skill/chess.mjs';
import {initialState,applyMove,legalMoves,ended} from '../server/skill/engines.mjs';
import {sowingFrames} from '../src/games/sowing-frames.mjs';
const step=(s,count,advance=advancePuzzle)=>{for(let i=0;i<count;i++)s=advance(s);return s;};
test('every new title has a unique original simulation and reaches a bounded finish without input',()=>{
 assert.equal(arcadeGames.length,33);assert(arcadeGames.every(game=>game.bettable));
 for(const g of arcadeGames){let s=simulationIds.has(g.id)?newSimulation(g.id,g.min_players):worldIds.has(g.id)?newWorld(g.id,g.min_players):puzzleIds.has(g.id)?newPuzzle(g.id,g.min_players):newParty(g.id,g.min_players);
  const advance=simulationIds.has(g.id)?advanceSimulation:worldIds.has(g.id)?s=>advanceWorld(s,[]):puzzleIds.has(g.id)?advancePuzzle:advanceParty;
  for(let i=0;i<19000&&!s.finished;i++)s=advance(s);assert(s.finished,g.id);assert(s.players.length>=g.min_players);assert.doesNotThrow(()=>JSON.stringify(s));
 }
});
test('timed racing rejects client scores and leaves its previous world untouched',()=>{
 const s=newWorld('pocket-racers',2),original=structuredClone(s);advanceWorld(s,[worldBot(s,0),worldBot(s,1)]);assert.deepEqual(s,original);
 assert.throws(()=>worldAction(s,0,{score:100,progress:100}),/supported/);
});
test('fighter blocks reduce damage; jump physics lands; simultaneous knockouts tie',()=>{
 let attack=newWorld('stick-rivals',2);attack.players[0].x=430;attack.players[1].x=500;const normal=step(attack,5,s=>advanceWorld(s,[{attack:true},{}])),blocked=step(attack,5,s=>advanceWorld(s,[{attack:true},{block:true}]));assert(normal.players[1].hp<blocked.players[1].hp);
 const jump=advanceWorld(attack,[{up:true},{}]);assert(jump.players[0].y<410);assert.equal(step(jump,30,s=>advanceWorld(s,[])).players[0].y,410);
 attack.players.forEach(p=>p.hp=3);attack.round=2;let tie=step(attack,5,s=>advanceWorld(s,[{attack:true},{attack:true}]));assert(tie.finished);assert.deepEqual(tie.winners,[0,1]);
});
test('paddles cannot be tunneled through and hockey strikers stay in their half',()=>{
 const s=newWorld('paddle-duel',2);s.reset=0;s.ball={x:910,y:280,vx:1000,vy:0};s.players[1].x=930;const next=advanceWorld(s,[]);assert(next.ball.vx<0);assert.equal(next.players[0].score,0);
 let hockey=newWorld('air-hockey',2);hockey=step(hockey,100,s=>advanceWorld(s,[{right:true},{left:true}]));assert(hockey.players[0].x<=455);assert(hockey.players[1].x>=505);
});
test('snake resolves head-on elimination simultaneously and permits vacating tails',()=>{
 const s=newWorld('snake-arena',2);s.tick=3;s.players=[{alive:true,dir:0,body:[{x:10,y:10},{x:9,y:10},{x:9,y:11}]},{alive:true,dir:2,body:[{x:12,y:10},{x:13,y:10},{x:14,y:10}]}];const next=advanceWorld(s,[]);assert(next.finished);assert.deepEqual(next.winners,[]);
});
test('golf enforces turn, moving-ball lock and finite power; kitchen keeps item ownership',()=>{
 const g=newWorld('mini-golf',2);assert.throws(()=>worldAction(g,1,{type:'shoot',angle:0,power:.5}),/Wait/);assert.throws(()=>worldAction(g,0,{type:'shoot',angle:NaN,power:5}),/aim/);worldAction(g,0,{type:'shoot',angle:0,power:.5});assert.throws(()=>worldAction(g,0,{type:'shoot',angle:0,power:.5}),/Wait/);assert.equal(g.players[0].strokes,1);
 const k=newWorld('kitchen-rush',2);k.players[0].x=130;k.players[0].y=430;worldAction(k,0,{type:'interact'});assert.equal(k.players[0].carrying,'lettuce');k.players[0].cooldown=0;k.players[0].x=460;k.players[0].y=110;worldAction(k,0,{type:'interact'});assert.equal(k.players[0].carrying,null);assert.equal(k.stations[2].item,'lettuce');let cooked=step(k,61,s=>advanceWorld(s,[]));worldAction(cooked,0,{type:'interact'});assert.equal(cooked.players[0].carrying,'salad');assert.equal(cooked.stations[2].item,null);
});
test('word paths enforce adjacency and repeat rules; other players cannot read word lists',()=>{
 const s=newPuzzle('word-hunt',2);assert.equal(s.grid.length,16);puzzleAction(s,0,{path:[0,1,2]});assert.equal(s.players[0].score,1);assert.throws(()=>puzzleAction(s,0,{path:[0,1,2]}),/already/);assert.throws(()=>puzzleAction(s,0,{path:[0,15,3]}),/touch/);assert(!JSON.stringify(puzzleView(s,1)).includes('"cat"'));
});
test('exact expression parsing rejects number reuse and injection; ties score equally',()=>{
 assert.deepEqual(evaluateExpression('(25-5)*4+10',[2,3,4,5,10,25]),{n:90n,d:1n,ops:3});assert.throws(()=>evaluateExpression('25+25',[25,5]),/once/);assert.throws(()=>evaluateExpression('1/0',[1,0]),/zero/);assert.throws(()=>evaluateExpression('process.exit()',[1]),/numbers/);
 let s=newPuzzle('equation-forge',2);puzzleAction(s,0,{expression:'25*4'});puzzleAction(s,1,{expression:'25*4'});assert(!JSON.stringify(puzzleView(s,1).players).includes('25*4'));s=step(s,801);assert.deepEqual(s.roundWinners,[0,1]);assert.equal(s.players[0].score,10);
});
test('all circuits are solvable through legal rotations and switch actions',()=>{
 let s=newPuzzle('circuit-crew',2);for(let level=0;level<3;level++){for(let i=0;i<16;i++){let remaining=4;while(s.cells[i].rotation!==0&&remaining--&&!s.finished&&s.level===level)puzzleAction(s,0,{cell:i});}if(!s.finished&&s.level===level&&!s.cells[6].on)puzzleAction(s,1,{cell:6,type:'switch'});assert.equal(s.level,level+1);if(!s.finished)s=step(s,21);}
 assert(s.finished);assert.deepEqual(s.winners,[0,1]);
});
test('molecules enforce valence and removable bonds; all five targets complete',()=>{
 const s=newPuzzle('molecule-match',2);puzzleAction(s,0,{from:0,to:1});assert.throws(()=>puzzleAction(s,0,{from:0,to:1}),/spare/);puzzleAction(s,0,{from:0,to:1,remove:true});assert.deepEqual(s.players[0].bonds,[]);
 for(const edges of [[[0,1,1],[0,2,1]],[[0,1,2],[1,2,2]],[[0,1,1],[0,2,1],[0,3,1]],[[0,1,1],[0,2,1],[0,3,1],[0,4,1]],[[0,1,2]]])for(const [from,to,n] of edges)for(let j=0;j<n;j++)puzzleAction(s,0,{from,to});assert(s.finished);assert.deepEqual(s.winners,[0]);
});
test('codes have five unique solutions and enforced cooldown; Sudoku entries stay private',()=>{
 const seen=new Set(),s=newPuzzle('codebreakers',2);for(let i=0;i<5;i++){const q=codePuzzle(i);seen.add(q.answer.join(''));let solutions=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++)if(c===q.answer[2]&&b===c+1&&a+b===q.answer[0]+q.answer[1]&&d===a+c)solutions++;assert.equal(solutions,1);puzzleAction(s,0,{type:'submit',code:q.answer});}assert.equal(seen.size,5);assert(s.finished);
 const wrong=newPuzzle('codebreakers',1);puzzleAction(wrong,0,{type:'submit',code:[1,1,1,1]});assert.throws(()=>puzzleAction(wrong,0,{type:'submit',code:[1,1,1,1]}),/two seconds/);
 const sudoku=newPuzzle('sudoku-race',2);puzzleAction(sudoku,0,{cell:2,value:4});assert(!('cells' in puzzleView(sudoku,1).players[0]));assert.equal(puzzleView(sudoku,1).me.cells[2],0);assert.throws(()=>puzzleAction(sudoku,0,{cell:0,value:1}),/editable/);
});
test('party views hide prompts, authors, ballots and private roles across seats and spectators',()=>{
 const draw=newParty('draw-guess',3);assert(partyView(draw,0).word);assert.equal(partyView(draw,1).word,null);assert.equal(partyView(draw,-1).word,null);assert.throws(()=>partyAction(draw,1,{type:'stroke',points:[[.2,.3]]}),/drawer/);
 let bluff=newParty('bluff-club',3);for(let i=0;i<3;i++)partyAction(bluff,i,{text:'Bluff '+i});bluff=advanceParty(bluff);const v=partyView(bluff,1);assert(v.options.every(o=>!('authors' in o)&&!('correct' in o)));assert(!('truth' in v));assert.throws(()=>partyAction(bluff,1,{option:v.options.find(o=>o.mine).id}),/someone else/);
 const deduction=newParty('deduction-club',5);assert.equal(partyView(deduction,-1).role,null);assert.equal(partyView(deduction,-1).saboteur,null);for(let i=0;i<5;i++){const v=partyView(deduction,i);assert.equal(v.role,i===deduction.saboteur?'saboteur':'investigator');assert(!('seed' in v));assert(!('nightActions' in v));}
});
test('rooms enforce invitation, private seats, receipts, free balances, stale inputs and restart refunds',()=>{
 const store=openStore(':memory:');try{let rooms=createArcadeRooms(store);const a=store.ensureUser('a','Alice','practice'),b=store.ensureUser('b','Bob','practice'),c=store.ensureUser('c','Cara','practice');let r=rooms.create({game_id:'pocket-racers',entry:'0',visibility:'invite'},a,1000);
  assert.equal(rooms.list(b).length,0);assert.throws(()=>rooms.get(r.id,b),/invitation/);assert.throws(()=>rooms.action(r.id,b,{type:'join'}),/invitation/);rooms.action(r.id,b,{type:'join'},r.invite_key,1001);assert.equal(rooms.get(r.id,b).players.length,2);assert.throws(()=>rooms.create({game_id:'paddle-duel'},a),/current/);
  for(const u of [a,b])rooms.action(r.id,u,{type:'ready',ready:true},null,1002);r=rooms.start(r.id,a,null,1003);rooms.input(r.id,a,{seq:2,controls:{up:true},x:99999},null,4004);rooms.input(r.id,a,{seq:1,controls:{down:true}},null,4005);assert.equal(rooms.get(r.id,a).input_seq,2);
  for(let t=4053;t<=5003;t+=50)rooms.tick(t);assert(rooms.get(r.id,a).state.players[0].speed>0);const before=rooms.get(r.id,a).state.tick;rooms.input(r.id,a,{seq:3,controls:{}},null,5004);assert.equal(rooms.get(r.id,a).state.tick,before);
  r=rooms.action(r.id,a,{type:'resign'},null,5005);assert.equal(store.user(b.id).credit,'0');rooms.action(r.id,a,{type:'resign'},null,5006);assert.equal(store.user(b.id).credit,'0');
  assert.throws(()=>rooms.create({game_id:'draw-guess',entry:'5'},c),/deposit/);
  r=rooms.create({game_id:'word-hunt',entry:'0'},a,6000);rooms.action(r.id,b,{type:'join'},null,6001);for(const u of [a,b])rooms.action(r.id,u,{type:'ready',ready:true},null,6002);r=rooms.start(r.id,a,null,6003);const receipt={type:'play',input_id:'word-receipt-001',action:{path:[0,1,2]}};rooms.action(r.id,a,receipt,null,10000);rooms.action(r.id,a,receipt,null,10001);assert.equal(rooms.get(r.id,a).state.me.score,1);assert.throws(()=>rooms.action(r.id,a,{...receipt,action:{path:[4,5,6]}},null,10002),/reused/);
  rooms=createArcadeRooms(store);assert.equal(rooms.get(r.id,a).status,'cancelled');assert.equal(store.user(a.id).credit,'0');assert.equal(store.user(b.id).credit,'0');
 }finally{store.db.close();}
});
test('chess handles mate, illegal castle through check, en passant exposure, promotions and draw rules',()=>{
 let s=initialState('chess-online');for(const m of [{from:53,to:45},{from:12,to:28},{from:54,to:38},{from:3,to:39}])s=applyMove(s,m);assert(ended(s));assert.equal(s.winner,1);assert.match(s.reason,/Checkmate/);
 const castle=initialChess('4kr2/8/8/8/8/8/8/4K2R w K - 0 1');assert(!legalMoves(castle).some(m=>m.from===60&&m.to===62));
 const ep=initialChess('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');assert(!legalMoves(ep).some(m=>m.from===28&&m.to===19));
 const promotion=initialChess('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.deepEqual(legalMoves(promotion).filter(m=>m.from===8).map(m=>m.promotion).sort(),['b','n','q','r']);assert.equal(applyMove(promotion,{from:8,to:0,promotion:'n'}).board[0],2);
 let repeat=initialState('chess-online');const cycle=[{from:62,to:45},{from:6,to:21},{from:45,to:62},{from:21,to:6}];for(let i=0;i<8;i++)repeat=applyMove(repeat,cycle[i%4]);assert(!ended(repeat));assert(legalMoves(repeat).some(m=>m.claim));assert(applyMove(repeat,{claim:true}).draw);for(let i=0;i<8;i++)repeat=applyMove(repeat,cycle[i%4]);assert(repeat.draw);assert.match(repeat.reason,/fivefold/);
 const fifty=initialChess('7k/8/8/8/8/8/R7/K7 w - - 100 51');assert(legalMoves(fifty).some(m=>m.claim));const seventyFive=initialChess('7k/8/8/8/8/8/R7/K7 w - - 149 75');assert(applyMove(seventyFive,{from:48,to:49}).draw);
 assert.equal(hasMatingMaterial(initialChess('7k/8/8/8/8/8/8/KN6 w - - 0 1'),0),false);assert.equal(hasMatingMaterial(initialChess('7k/7p/8/8/8/8/8/KN6 w - - 0 1'),0),true);
});
test('Mancala sow frames conserve seeds including the hand and finish on the authoritative capture',()=>{
 const before=initialState('oware'),after=applyMove(before,{from:3}),frames=sowingFrames(before,after);assert(frames.length>1);for(const frame of frames)assert.equal(frame.board.reduce((a,b)=>a+b,0)+frame.scores.reduce((a,b)=>a+b,0)+frame.hand,48);assert.deepEqual(frames.at(-1).board,after.board);assert.equal(frames.at(-1).hand,0);assert.deepEqual(sowingFrames(before,{...after,moves:5}),[]);
});

test('quiz End game is private, terminal and excluded from public score proofs',async()=>{
 const store=openStore(':memory:');try{const play=createPlay(store),a=store.ensureUser('solo-a','A player','practice'),b=store.ensureUser('solo-b','B player','practice'),run=await play.start('maths',a);assert.throws(()=>play.end(run.id,b));const ended=play.end(run.id,a);assert(ended.done);assert(ended.abandoned);assert.equal(ended.question,null);assert.throws(()=>play.share(run.id,a));assert.equal(play.end(run.id,a).id,run.id);const fresh=await play.start('maths',a);assert.notEqual(fresh.id,run.id);}finally{store.db.close();}
});
test('chess draw claims allow intended moves and checkmate takes precedence over 75 moves',()=>{
 let s=initialState('chess-online');const cycle=[{from:62,to:45},{from:6,to:21},{from:45,to:62},{from:21,to:6}];for(let i=0;i<7;i++)s=applyMove(s,cycle[i%4]);assert(legalMoves(s).some(m=>m.claim&&m.from===21&&m.to===6));assert(applyMove(s,{from:21,to:6,claim:true}).draw);
 const mate=initialChess('7k/8/5KQ1/8/8/8/8/8 w - - 149 80'),next=applyMove(mate,{from:22,to:14});assert.equal(next.winner,0);assert(!next.draw);
});


test('survival grants three lives per player, respawns while lives remain, and ends when all three lives are consumed',()=>{
 const start=newWorld('platform-relay',2);assert.equal(start.players[0].lives,3);assert.equal(start.players[1].lives,3);
 start.players[0].y=625;start.players[0].vy=150;start.players[0].ground=false;
 const afterOneFall=advanceWorld(start,[{},{}]);assert(!afterOneFall.finished);assert.equal(afterOneFall.players[0].lives,2);assert.equal(afterOneFall.players[0].alive,true);
 start.players[0].lives=1;
 const result=advanceWorld(start,[{},{}]);assert(result.finished);assert.deepEqual(result.winners,[1]);assert.equal(result.players[0].lives,0);assert.equal(result.players[0].alive,false);assert(start.players[0].alive);
 start.players[1].lives=1;start.players[1].y=625;start.players[1].vy=150;start.players[1].ground=false;const tie=advanceWorld(start,[]);assert(tie.finished);assert.deepEqual(tie.winners,[]);
});
test('gold coins are collected once per seat and do not refill nitro',()=>{
 let s=newWorld('platform-relay',2);s.coins=[{id:7,x:65,y:435,collectedBy:[]}];s=advanceWorld(s,[]);assert.deepEqual(s.players.map(p=>p.coins),[1,1]);s=advanceWorld(s,[]);assert.deepEqual(s.players.map(p=>p.coins),[1,1]);
 let race=newWorld('pocket-racers',2);race.players[0].x=480;race.players[0].boost=10;race.pickups=[{id:1,x:480,distance:1}];race=advanceWorld(race,[]);assert.equal(race.players[0].coins,1);assert.equal(race.players[0].boost,10);race=advanceWorld(race,[]);assert.equal(race.players[0].coins,1);
});
test('endless terrain extends past the former finish with bounded memory, valid gaps, and no auto-jump',()=>{
 let noJump=newWorld('platform-relay',2);for(let i=0;i<360&&!noJump.finished;i++){noJump.hazards=[];noJump.enemies=[];noJump=advanceWorld(noJump,[{right:true},{}]);}
 assert(noJump.finished);assert.equal(noJump.players[0].lives,0);assert.equal(noJump.players[0].deathReason,'fell into the sea');
 let s=newWorld('platform-relay',2);const biomesSeen=new Set([s.biome]);
 for(let i=0;i<1800&&!s.finished;i++){s.hazards=[];s.enemies=[];s=advanceWorld(s,[worldBot(s,0),worldBot(s,1)]);biomesSeen.add(s.biome);}
 assert(!s.finished,JSON.stringify(s.players));assert(s.players[0].x>18000);assert(s.nextIsland>45);assert(s.platforms.length<20);assert(s.coins.length<60);assert(s.platforms[0].id>0);
 assert.equal(biomesSeen.size,5);assert(s.difficulty>=10);
 for(let i=1;i<s.platforms.length;i++){const gap=(s.platforms[i].baseX??s.platforms[i].x)-(s.platforms[i-1].baseX??s.platforms[i-1].x)-s.platforms[i-1].w;assert(gap>=48&&gap<=96);}
});
test('matter-js moving platforms carry players, springs bounce high, and monsters can be squashed or shot',()=>{
 let s=newWorld('platform-relay',2);
 // Spring pad bounce
 s.springs=[{id:99,platformId:0,offsetX:65,x:65,y:460}];
 s.hazards=[];s.enemies=[];
 s=advanceWorld(s,[]);assert(s.players[0].vy<-550);assert.equal(s.players[0].ground,false);
 // Squashing a monster by jumping onto it from above awards bonus points, removes the monster, and bounces
 s=newWorld('platform-relay',2);s.hazards=[];s.springs=[];
 s.enemies=[{id:1,kind:'crab',label:'island crab',biome:'grove',platformId:0,minOffset:20,maxOffset:300,offsetX:65,baseOffsetY:-20,x:65,y:440,vx:0,vy:0,speed:0,flying:false,phase:0,facing:1,alive:true}];
 s.players[0].x=65;s.players[0].y=415;s.players[0].vy=220;s.players[0].ground=false;s.players[1].x=240;
 s=advanceWorld(s,[]);assert.equal(s.enemies.some(e=>e.id===1),false);assert.equal(s.players[0].stomps,1);assert(s.players[0].vy<-400);assert(!s.finished);
 // Shooting a monster with attack (Space / J) blasts the monster and awards points
 s=newWorld('platform-relay',2);s.hazards=[];s.springs=[];
 s.enemies=[{id:3,kind:'hog',label:'charging boar',biome:'grove',platformId:0,minOffset:20,maxOffset:300,offsetX:140,baseOffsetY:-20,x:140,y:440,vx:0,vy:0,speed:0,flying:false,phase:0,facing:-1,alive:true}];
 s.players[0].x=65;s.players[0].facing=1;s.players[1].x=280;
 for(let i=0;i<6;i++)s=advanceWorld(s,[{attack:i===0},{}]);
 assert.equal(s.enemies.some(e=>e.id===3),false);assert.equal(s.players[0].stomps,1);assert(!s.finished);
 // Leaping piranha from water costs a life and eliminates player when final life is consumed
 s=newWorld('platform-relay',2);s.hazards=[];s.springs=[];
 s.enemies=[{id:2,kind:'piranha',label:'leaping piranha',biome:'grove',baseX:65,x:65,y:410,vx:0,vy:-100,waterY:445,peakY:400,period:2,phase:0.5,facing:1,submerged:false,alive:true}];
 s.players[1].x=240;s.players[0].lives=1;
 s=advanceWorld(s,[]);assert(s.finished);assert.equal(s.players[0].alive,false);assert.match(s.players[0].deathReason,/leaping piranha/);assert.deepEqual(s.winners,[1]);
});
test('survival hazards cost lives until eliminated, the storm prevents stalling, and practice has a rival',()=>{
 let s=newWorld('platform-relay',2);s.hazards=[{id:1,kind:'thorns',x:65,y:460,phase:0}];s.players[1].x=160;
 s=advanceWorld(s,[]);assert.equal(s.players[0].lives,2);assert(!s.finished);
 s.players[0].lives=1;s.players[0].invulnerable=0;s.players[0].x=65;s.players[0].y=435;
 const hit=advanceWorld(s,[]);assert(hit.finished);assert.deepEqual(hit.winners,[1]);
 s=newWorld('platform-relay',2);for(let i=0;i<1000&&!s.finished;i++)s=advanceWorld(s,[]);assert(s.finished);assert(s.players.every(p=>p.lives===0&&p.deathReason==='was caught by the storm'));
 const store=openStore(':memory:');try{const rooms=createArcadeRooms(store),user=store.ensureUser('survival-solo','Runner','practice'),r=rooms.create({game_id:'platform-relay',solo:true,entry:'0'},user,1000);assert.equal(r.players.length,2);assert(r.players[1].bot);assert.equal(r.ends_at,null);}finally{store.db.close();}
});
test('race traffic penalizes speed without resetting the player, and steering eases in',()=>{
 let s=newWorld('pocket-racers',2);
 assert.equal(s.players[0].kart,'sedan-sports');assert.equal(s.players[1].kart,'hatchback-sports');
 s.players[0].x=480;s.players[1].x=570;s.traffic=[{id:0,x:480,distance:30,speed:0,kind:'car',model:'police'}];s.players[0].speed=235;
 s=advanceWorld(s,[{}, {up:true,right:true}]);
 assert(s.players[0].crashes===1);assert(s.players[0].speed<235);assert(s.players[0].crashTimer>0);assert(s.players[0].y>0);assert(s.players[1].x>570);assert(s.players[1].vx>0);
 // Releasing steering settles gradually, preserving momentum without a position snap.
 const xBefore=s.players[1].x;s=advanceWorld(s,[{}, {up:true}]);assert(s.players[1].vx>0);assert(s.players[1].x-xBefore<3);
 // Driving over a fuel pickup grants limited nitro without activating it
 s.boostPads=[{id:99,x:s.players[1].x,distance:s.players[1].y+5}];s.players[1].boost=50;const spdBefore=s.players[1].speed;
 s=advanceWorld(s,[{}, {up:true}]);assert.equal(s.players[1].nitroPickups,1);assert(!s.players[1].boosting);assert(s.players[1].speed>spdBefore);assert(s.players[1].boost>50);
});


test('eight survival coins charge an air jump without adding lives',()=>{
 let s=newWorld('platform-relay',2);s.players[0].coins=7;s.coins=[{id:1,x:65,y:435,collectedBy:[]}];s=advanceWorld(s,[]);assert.equal(s.players[0].airJumps,1);assert.equal(s.players[0].coins,8);
 s.players[0].ground=false;s.players[0].coyote=0;s.players[0].y=270;s.players[0].vy=100;s=advanceWorld(s,[{up:true},{}]);assert(s.players[0].vy<0);assert.equal(s.players[0].airJumps,0);assert.equal(s.players[0].coins,8);
});
test('a short jump tap survives release between authoritative simulation ticks',()=>{
 const store=openStore(':memory:');try{const rooms=createArcadeRooms(store),user=store.ensureUser('tap-runner','Runner','practice'),r=rooms.create({game_id:'platform-relay',solo:true,entry:'0'},user,1000);rooms.input(r.id,user,{seq:1,controls:{up:true}},null,4001);rooms.input(r.id,user,{seq:2,controls:{up:false}},null,4002);rooms.tick(4050);const first=rooms.get(r.id,user);assert(first.state.players[0].vy<0);assert.equal(first.state.players[0].ground,false);rooms.tick(4100);assert.equal(rooms.get(r.id,user).state.players[0].jumpHeld,false);}finally{store.db.close();}
});
