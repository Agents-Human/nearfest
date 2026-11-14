import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyMove,legalMoves,ended} from '../server/skill/engines.mjs';
import {choosePracticeMove} from '../src/games/skill-bot.mjs';
import {discoveryGames} from '../server/game-catalog.mjs';

test('practice opponent makes legal deterministic moves without altering any board',()=>{
 for(const game of discoveryGames.filter(g=>g.engine==='skill')){
  let state=initialState(game.id);
  for(let turn=0;turn<14&&!ended(state);turn++){
   const before=JSON.stringify(state),move=choosePracticeMove(state);
   assert(move,game.id);assert(legalMoves(state).some(m=>JSON.stringify(m)===JSON.stringify(move)),game.id);
   assert.equal(JSON.stringify(state),before);assert.deepEqual(choosePracticeMove(state),move);
   state=applyMove(state,move);
  }
 }
});
test('practice opponent finishes an available win and blocks an immediate loss',()=>{
 let state=initialState('connect-four');
 for(const column of [0,1,0,1,0,2])state=applyMove(state,{column});
 const move=choosePracticeMove(state);assert.equal(move.column,0);state=applyMove(state,move);assert(ended(state));assert.equal(state.winner,0);assert.equal(choosePracticeMove(state),null);
 let threat=initialState('connect-four');for(const column of [0,1,2,1,3,1])threat=applyMove(threat,{column});
 assert.equal(choosePracticeMove(threat).column,1);
});
test('every published title offers solo and online modes, including all knowledge challenges',()=>{
 assert.equal(discoveryGames.length,58);assert.equal(new Set(discoveryGames.map(g=>g.id)).size,58);
 assert(discoveryGames.every(g=>g.solo&&g.multiplayer));
 assert(discoveryGames.every(g=>!['local','imported'].includes(g.engine)));
 for(const id of ['maths','science','trivia','times','fractions','chess'])assert(discoveryGames.some(g=>g.id===id),id);
 assert.equal(discoveryGames.find(g=>g.id==='oware').title,'Mancala');assert(!discoveryGames.some(g=>['kalah','ludo','pocket-soccer','marble-run'].includes(g.id)));
});
