import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';
import {PLATFORM_CHARACTERS,PLATFORM_TINTS,platformCharacter,platformLives} from '../shared/platform-options.mjs';

test('ten colors are cosmetic: equivalent controls produce identical physics',()=>{
  assert.equal(new Set(PLATFORM_CHARACTERS).size,10);
  assert.equal(new Set(Object.values(PLATFORM_TINTS)).size,10);
  for(const character of PLATFORM_CHARACTERS)assert.equal(platformCharacter(character),character);
  // Two matching worlds, different cosmetics and an identical course seed.
  let a=newWorld('platform-relay',4,{lives:7,characters:PLATFORM_CHARACTERS.slice(0,4)});
  let b=structuredClone(a);b.players.forEach((p,i)=>p.character=PLATFORM_CHARACTERS[i+6]);
  for(let tick=0;tick<1000&&!a.finished;tick++){
    const controls=a.players.map((_,i)=>worldBot(a,i));
    a=advanceWorld(a,controls);b=advanceWorld(b,controls);
    assert.deepEqual(b.players.map(({character,...p})=>p),a.players.map(({character,...p})=>p));
  }
});

test('chosen lives count down once per impact, including the final death event',()=>{
  for(const lives of [1,3,9]){
    let s=newWorld('platform-relay',2,{lives});
    assert(s.players.every(p=>p.lives===lives&&p.maxLives===lives));
    for(let hit=1;hit<=lives;hit++){
      Object.assign(s.players[0],{y:800,ground:false,invulnerable:0});
      s=advanceWorld(s,[{},{}]);
      const p=s.players[0];assert.equal(p.lives,lives-hit);assert.equal(p.damageCount,hit);
      assert.equal(p.alive,hit<lives);assert.equal(s.finished,hit===lives);
      if(p.alive){const next=advanceWorld(s,[{},{}]);assert.equal(next.players[0].lives,p.lives);assert.equal(next.players[0].damageCount,hit);}
    }
  }
});

test('room settings are host-owned, persisted, equal for everyone and locked after starting',()=>{
  const store=openStore(':memory:');
  try {
    let rooms=createArcadeRooms(store);
    const host=store.ensureUser('platform-host','Host','practice'),guest=store.ensureUser('platform-guest','Guest','practice'),spectator=store.ensureUser('platform-viewer','Viewer','practice');
    let r=rooms.create({game_id:'platform-relay',settings:{lives:5},character:'cyan'},host,1000);
    assert.equal(r.settings.lives,5);assert.equal(r.players[0].character,'cyan');
    r=rooms.action(r.id,guest,{type:'join',character:'slate'},null,1100);
    assert.throws(()=>rooms.action(r.id,spectator,{type:'platform-settings',lives:8},null,1200),/Join/);
    assert.throws(()=>rooms.action(r.id,guest,{type:'platform-settings',lives:8},null,1200),/host/);
    for(const p of [host,guest])rooms.action(r.id,p,{type:'ready',ready:true},null,1300);
    r=rooms.action(r.id,host,{type:'platform-settings',lives:9},null,1400);
    assert(r.players.every(p=>!p.ready));
    r=rooms.action(r.id,guest,{type:'character',character:'orange',user_id:host.id},null,1500);
    assert.deepEqual(r.players.map(p=>p.character),['cyan','orange']);
    // Reload a waiting lobby from the same persisted JSON, as on a restart.
    rooms=createArcadeRooms(store);r=rooms.get(r.id,host);
    assert.equal(r.settings.lives,9);assert.equal(r.players[1].character,'orange');
    for(const p of [host,guest])rooms.action(r.id,p,{type:'ready',ready:true},null,1600);
    r=rooms.start(r.id,host,null,1700);
    assert(r.state.players.every(p=>p.lives===9&&p.maxLives===9));
    assert.deepEqual(r.state.players.map(p=>p.character),['cyan','orange']);
    assert.throws(()=>rooms.action(r.id,host,{type:'platform-settings',lives:1},null,1800),/lobby/);
    assert.throws(()=>rooms.action(r.id,guest,{type:'character',character:'red'},null,1800),/before/);
    assert.equal(rooms.get(r.id,guest).state.players[0].maxLives,9);
  } finally {store.db.close();}
});

test('solo applies chosen lives to the player and bot, and invalid options cannot create a room',()=>{
  const store=openStore(':memory:');
  try {
    const rooms=createArcadeRooms(store),user=store.ensureUser('platform-options','Runner','practice');
    for(const lives of [0,-1,10,1.5,'5',null,true,NaN,Infinity]){
      assert.throws(()=>platformLives(lives),/starting lives/);
      assert.throws(()=>rooms.create({game_id:'platform-relay',solo:true,settings:{lives}},user,1000),/starting lives/);
    }
    for(const character of ['invisible',null,4,{},'../secret'])assert.throws(()=>rooms.create({game_id:'platform-relay',solo:true,character},user,1000),/character colors/);
    for(const settings of [null,[],false,'lives'])assert.throws(()=>rooms.create({game_id:'platform-relay',settings},user,1000),/settings/);
    const r=rooms.create({game_id:'platform-relay',solo:true,character:'lime',settings:{lives:2}},user,1000);
    assert.equal(r.players[0].character,'lime');assert.equal(r.state.players[0].character,'lime');
    assert(r.players[1].bot);assert(r.state.players.every(p=>p.lives===2&&p.maxLives===2));
    assert.equal(newWorld('platform-relay',2).startingLives,3);
  } finally {store.db.close();}
});
