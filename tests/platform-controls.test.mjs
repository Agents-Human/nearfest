import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';

test('shooting in midair preserves charged jumps; a separate jump press consumes one',()=>{
  let s=newWorld('platform-relay',2);s.enemies=[];s.hazards=[];
  Object.assign(s.players[0],{x:100,y:270,vy:100,ground:false,coyote:0,airJumps:2});
  s=advanceWorld(s,[{attack:true},{}]);
  assert.equal(s.players[0].airJumps,2);assert(s.players[0].vy>0);assert.equal(s.shots.length,1);
  s=advanceWorld(s,[{up:true,attack:true},{}]);
  assert.equal(s.players[0].airJumps,1);assert(s.players[0].vy<0);
});

test('four runners with identical controls stay in sync through jumps, landings and moving platforms',()=>{
  let s=newWorld('platform-relay',4);
  for(let tick=0;tick<1500&&!s.finished;tick++){
    s.enemies=[];s.hazards=[];
    const controls=worldBot(s,0);s=advanceWorld(s,s.players.map(()=>controls));
    for(const p of s.players.slice(1))for(const key of ['x','y','vx','vy','ground','platformId','lives'])assert.equal(p[key],s.players[0][key],`${tick}: ${key}`);
  }
  assert(!s.finished);assert(s.players[0].x>12000);assert.equal(s.players[0].lives,3);
});
