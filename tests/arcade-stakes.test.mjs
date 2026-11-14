import {publishedGame} from '../server/game-catalog.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from './helpers/store.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {arcadeGames} from '../server/arcade/catalog.mjs';
import {createNearEconomy,ROOM_STORAGE} from '../server/near-economy.mjs';

async function setup() {
  const store=(await openStore(':memory:')),rooms=(await createArcadeRooms(store)),remote=new Map(),calls=[];
  const chain={
    contractId:'escrow.testnet',oracleReady:true,balance:async()=>10000n*10n**24n,
    view:async(method,args)=>method==='get_funding_receipt'?true:structuredClone(remote.get(args.id)||null),
    transaction:(method,args,deposit)=>({method,args,deposit}),
    oracleCall:async(method,args)=>{
      calls.push({method,args});
      remote.get(args.id).status=method==='cancel_room'||!args.winners?.length?'refunded':'settled';
    },
  };
  const services={changed:rooms.notify,get:rooms.get,create:async (data,user,funding)=>(await rooms.create(data,user,Date.now(),funding)),start:rooms.start,action:rooms.action};
  const economy=(await createNearEconomy(store,{chain,services}));
  return {store,rooms,remote,calls,economy};
}

for(const game of arcadeGames.filter(game=>publishedGame(game.id)))test(`${game.title}: confirmed stakes start and settle once, including a resignation`,async()=>{
  const {store,rooms,remote,calls,economy}=(await setup());
  try {
    assert.equal(game.bettable,true);
    const players=await Promise.all(Array.from({length:game.min_players},(_,i)=>store.ensureUser(`player${i}.testnet`,`Player ${i+1}`,'wallet')));
    const host=players[0],guest=(await store.ensureUser('guest','Guest','practice'));
    const data={game_id:game.id,entry:'0.1',max_players:game.min_players,...(game.id==='platform-relay'?{character:'cyan',settings:{lives:5}}:{})};
    await assert.rejects(async ()=>(await economy.create('game',data,guest)),/wallet/);
    (await assert.rejects(async ()=>(await rooms.create(data,host)),/deposit/));
    const pending=await economy.create('game',data,host),args=pending.transaction.args;
    assert.equal(BigInt(pending.transaction.deposit),BigInt(args.entry)+ROOM_STORAGE);
    await assert.rejects(()=>economy.confirm(pending.intent_id,host),/not found/);
    remote.set(args.id,{...args,host:host.id,status:'open',members:[{account_id:host.id,amount:args.entry}],claim:null,winners:[],payouts:[]});
    let room=await economy.confirm(pending.intent_id,host);
    if(game.id==='platform-relay'){
      assert.equal(room.title,'Astro Dash');
      assert.equal(room.settings.lives,5);
      assert.equal(room.players[0].character,'cyan');
    }
    for(const player of players.slice(1)){
      const joining=await economy.action('game',room.id,'action',{type:'join'},player);
      await assert.rejects(()=>economy.confirm(joining.intent_id,player),/not been confirmed/);
      remote.get(room.id).members.push({account_id:player.id,amount:args.entry});
      room=await economy.confirm(joining.intent_id,player);
    }
    const snapshots=[];const unsubscribe=(await rooms.subscribe(room.id,host,undefined,next=>snapshots.push(next)));
    for(const player of players)(await rooms.action(room.id,player,{type:'ready',ready:true}));
    const starting=await economy.action('game',room.id,'start',{},host);
    remote.get(room.id).status='active';
    room=await economy.confirm(starting.intent_id,host);
    assert.equal(room.status,'playing');
    assert(room.players.every(player=>!player.bot));
    room=(await rooms.action(room.id,host,{type:'resign'}));
    assert.equal(room.status,'finished');
    assert.deepEqual(room.winners,players.slice(1).map(player=>player.id));
    assert.equal(room.players.reduce((sum,player)=>sum+BigInt(player.payout),0n),BigInt(args.entry)*BigInt(players.length));
    assert.equal(room.players[0].payout,'0');
    await economy.tick();
    await economy.tick();
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,'settle_game');
    assert.deepEqual(calls[0].args.winners,players.slice(1).map(player=>player.id));
    assert.equal((await rooms.get(room.id,host)).near.status,'settled');
    assert.equal(snapshots.at(-1).near.status,'settled');unsubscribe();
    assert((await Promise.all(players.map(async player=>(await store.user(player.id)).credit==='0'))).every(Boolean));
  } finally {(await store.db.close());}
});

test('Astro Dash validates its settings before preparing a wallet deposit',async()=>{
  const {store,economy}=(await setup());
  try {
    const user=(await store.ensureUser('astro.testnet','Explorer','wallet'));
    for(const settings of [null,[],{lives:0},{lives:10},{lives:'3'}]){
      await assert.rejects(async ()=>(await economy.create('game',{game_id:'platform-relay',entry:'0.1',settings},user)),/settings|lives/);
    }
    await assert.rejects(async ()=>(await economy.create('game',{game_id:'platform-relay',entry:'0.1',character:'invisible'},user)),/character/);
    await assert.rejects(async ()=>(await economy.create('game',{game_id:'platform-relay',entry:'0.1',solo:true},user)),/multiplayer/);
    assert.deepEqual((await economy.pending(user)),[]);
  } finally {(await store.db.close());}
});
