import test from 'node:test';import assert from 'node:assert/strict';import {openStore} from '../server/store.mjs';import {createBoardRooms} from '../server/skill/rooms.mjs';import {createNearEconomy} from '../server/near-economy.mjs';import {createCommunity} from '../server/community.mjs';
function setup(){const s=openStore(':memory:'),a=s.ensureUser('a.testnet','Alice','wallet'),b=s.ensureUser('b.testnet','Bob','wallet'),guest=s.ensureUser('guest','Guest','practice'),rooms=createBoardRooms(s),community=createCommunity(s),remote=new Map(),calls=[];
const chain={contractId:'escrow.testnet',oracleReady:true,balance:async()=>10000n*10n**24n,view:async(method,args)=>method==='get_funding_receipt'?true:structuredClone(remote.get(args.id)||null),transaction:(method,args,deposit)=>({method,args,deposit}),oracleCall:async(method,args)=>{calls.push({method,args});const r=remote.get(args.id);r.status=method==='cancel_room'||!args.winners?.length?'refunded':'settled';}};
const services={get:rooms.get,create:(d,u,f)=>rooms.create(d,u,Date.now(),f),start:rooms.start,action:rooms.action,community},economy=createNearEconomy(s,{chain,services});
function chainCreate(intent,user){const a=intent.transaction.args;remote.set(a.id,{...a,host:user.id,status:'open',members:[{account_id:user.id,amount:a.entry}],claim:null,winners:[],payouts:[]});}
return {s,a,b,guest,rooms,community,economy,remote,calls,chainCreate,chain,services};}
test('NEAR deposits require a wallet and final matching contract state; local balance never funds a stake',async()=>{const x=setup();try{assert.equal(x.guest.balance,'0');await assert.rejects(()=>x.economy.create('game',{game_id:'connect-four',entry:'.1'},x.guest),/wallet/);const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);assert.equal(p.transaction.deposit,'200000000000000000000000');await assert.rejects(()=>x.economy.confirm(p.intent_id,x.a),/not found/);await assert.rejects(()=>x.economy.confirm(p.intent_id,x.b),/wallet/);x.chainCreate(p,x.a);const r=x.remote.get(p.transaction.args.id);r.terms_hash='0'.repeat(64);await assert.rejects(()=>x.economy.confirm(p.intent_id,x.a),/not been confirmed/);r.terms_hash=p.transaction.args.terms_hash;const local=await x.economy.confirm(p.intent_id,x.a);assert.equal(local.near.status,'open');assert.equal(local.entry,r.entry);assert.equal((await x.economy.confirm(p.intent_id,x.a)).id,local.id);assert.equal(x.s.user(x.a.id).credit,'0');assert.throws(()=>x.rooms.create({game_id:'checkers',entry:'1'},x.a),/deposit/);}finally{x.s.db.close();}});
test('confirmed multiplayer deposits settle once through the oracle, with replay-safe recovery',async()=>{const x=setup();try{const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(p,x.a);let r=await x.economy.confirm(p.intent_id,x.a);const j=await x.economy.action('game',r.id,'action',{type:'join'},x.b);await assert.rejects(()=>x.economy.confirm(j.intent_id,x.b),/not been confirmed/);const remote=x.remote.get(r.id);remote.members.push({account_id:x.b.id,amount:remote.entry});r=await x.economy.confirm(j.intent_id,x.b);assert.equal(r.players.length,2);for(const u of [x.a,x.b])x.rooms.action(r.id,u,{type:'ready',ready:true});const start=await x.economy.action('game',r.id,'start',{},x.a);remote.status='active';r=await x.economy.confirm(start.intent_id,x.a);assert.equal(r.status,'playing');x.rooms.action(r.id,x.b,{type:'resign'});await x.economy.tick();await x.economy.tick();assert.equal(x.calls.length,1);assert.deepEqual(x.calls[0].args.winners,[x.a.id]);assert.equal(x.s.user(x.a.id).credit,'0');assert.equal(x.rooms.get(r.id,x.a).near.status,'settled');}finally{x.s.db.close();}});
test('free multiplayer and solo never request a deposit; paid games cannot accept forged funding',()=>{const x=setup();try{const r=x.rooms.create({game_id:'connect-four',entry:'0'},x.guest);assert.equal(r.entry,'0');assert.equal(r.near,null);assert.throws(()=>x.rooms.create({game_id:'checkers',entry:'0.1'},x.guest,Date.now(),{id:r.id}),/deposit/);assert.equal(x.s.user(x.guest.id).balance,'0');}finally{x.s.db.close();}});
test('community results mirror on-chain approval, never a local vote or credit',async()=>{const x=setup();try{const p=await x.economy.create('pot',{title:'Our group chess challenge',rules:'Everyone plays a game. The group approves the winner from recorded results.',category:'Gaming',amount:'0.1'},x.a);x.chainCreate(p,x.a);let r=await x.economy.confirm(p.intent_id,x.a);assert.equal(r.mode,'testnet');assert.equal(r.members[0].amount,p.transaction.args.entry);assert.throws(()=>x.community.action(r.id,x.a,{type:'vote'}),/wallet transaction/);const remote=x.remote.get(r.id);remote.members.push({account_id:x.b.id,amount:remote.entry});remote.status='settled';remote.winners=[x.b.id];remote.payouts=[{account_id:x.b.id,amount:'200000000000000000000000'}];x.community.sync(r.id,remote);assert.equal(x.community.get(r.id).winner,x.b.id);assert.equal(x.s.user(x.b.id).credit,'0');}finally{x.s.db.close();}});

test('interrupted funded creation can be cancelled and its confirmation recovered repeatedly',async()=>{const x=setup();try{const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.01'},x.a);x.chainCreate(p,x.a);const cancel=await x.economy.abandon(p.intent_id,x.a);assert.equal(cancel.transaction.method,'cancel_room');x.remote.get(p.transaction.args.id).status='refunded';const result=await x.economy.confirm(cancel.intent_id,x.a);assert.equal(result.cancelled,true);assert.deepEqual(await x.economy.confirm(cancel.intent_id,x.a),result);assert.deepEqual(x.economy.pending(x.a),[]);assert.equal(x.s.user(x.a.id).credit,'0');}finally{x.s.db.close();}});

test('fresh available balance must cover stake plus storage before a deposit is prepared',async()=>{
 const x=setup();try{
  x.chain.balance=async()=>199999999999999999999999n;
  await assert.rejects(()=>x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a),/balance/);
  assert.equal(x.economy.pending(x.a).length,0);
  x.chain.balance=async()=>200000000000000000000000n;
  const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);
  assert.equal(p.transaction.signerId,x.a.id);assert.equal(p.transaction.deposit,'200000000000000000000000');
 }finally{x.s.db.close();}
});
test('small and large stakes have no arbitrary minimum or maximum',async()=>{
 for(const entry of ['0.000000000000000000000001','0.001','101']){
  const x=setup();try{const p=await x.economy.create('game',{game_id:'connect-four',entry},x.a);x.chainCreate(p,x.a);const r=await x.economy.confirm(p.intent_id,x.a);assert.equal(r.entry,p.transaction.args.entry);}finally{x.s.db.close();}
 }
});
test('concurrent create requests reuse one intent and confirmed retry opens the same room',async()=>{
 const x=setup();try{
  const data={game_id:'connect-four',entry:'0.1'};
  const [first,second]=await Promise.all([x.economy.create('game',data,x.a),x.economy.create('game',data,x.a)]);
  assert.equal(first.intent_id,second.intent_id);assert.deepEqual(first.transaction,second.transaction);assert.equal(x.economy.pending(x.a).length,1);
  x.chainCreate(first,x.a);let creations=0;const create=x.services.create;x.services.create=(...args)=>{creations++;return create(...args);};
  const results=await Promise.all([x.economy.confirm(first.intent_id,x.a),x.economy.confirm(first.intent_id,x.a)]);
  assert.equal(creations,1);assert.equal(results[0].id,results[1].id);assert.equal(x.economy.pending(x.a).length,0);
 }finally{x.s.db.close();}
});
test('retry after a lost wallet callback opens the funded room without another transaction',async()=>{
 const x=setup();try{
  const data={game_id:'connect-four',entry:'0.1'},p=await x.economy.create('game',data,x.a);x.chainCreate(p,x.a);
  x.chain.balance=async()=>0n; // Already-paid funds need no new balance or deposit.
  const room=await x.economy.create('game',data,x.a);assert.equal(room.id,p.transaction.args.id);assert.equal(room.transaction,undefined);assert.equal(x.economy.pending(x.a).length,0);
 }finally{x.s.db.close();}
});
test('changing a pending stake cannot quietly create a second payment',async()=>{
 const x=setup();try{
  await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);
  await assert.rejects(()=>x.economy.create('game',{game_id:'connect-four',entry:'0.2'},x.a),/different room payment/);assert.equal(x.economy.pending(x.a).length,1);
 }finally{x.s.db.close();}
});
test('unavailable wallet balance fails closed before any payment intent is created',async()=>{
 const x=setup();try{x.chain.balance=async()=>{throw Error('RPC unavailable');};await assert.rejects(()=>x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a),/RPC/);assert.equal(x.economy.pending(x.a).length,0);}finally{x.s.db.close();}
});
test('a join checks its own balance and requires its exact funding receipt',async()=>{
 const x=setup();try{
  const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(p,x.a);const room=await x.economy.confirm(p.intent_id,x.a);
  x.chain.balance=async()=>100000000000000000000000n;
  await assert.rejects(()=>x.economy.action('game',room.id,'action',{type:'join'},x.b),/balance/);assert.equal(x.economy.pending(x.b).length,0);
  x.chain.balance=async()=>110000000000000000000000n;const joining=await x.economy.action('game',room.id,'action',{type:'join'},x.b);assert.equal(joining.transaction.signerId,x.b.id);
  x.remote.get(room.id).members.push({account_id:x.b.id,amount:room.entry});const view=x.chain.view;x.chain.view=async(method,args)=>method==='get_funding_receipt'?false:view(method,args);
  await assert.rejects(()=>x.economy.confirm(joining.intent_id,x.b),/receipt/);assert.equal(x.rooms.get(room.id,x.a).players.length,1);
 }finally{x.s.db.close();}
});
test('matching room terms without the host deposit are not accepted',async()=>{
 const x=setup();try{const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(p,x.a);x.remote.get(p.transaction.args.id).members=[];await assert.rejects(()=>x.economy.confirm(p.intent_id,x.a),/not been confirmed/);assert.throws(()=>x.rooms.get(p.transaction.args.id,x.a),/not found/);}finally{x.s.db.close();}
});

test('an unconfirmed creation cannot be discarded while its transaction can still arrive',async()=>{
 const x=setup();try{const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);await assert.rejects(()=>x.economy.abandon(p.intent_id,x.a),/can still confirm/);assert.equal(x.economy.pending(x.a).length,1);x.chainCreate(p,x.a);assert.equal((await x.economy.confirm(p.intent_id,x.a)).id,p.transaction.args.id);}finally{x.s.db.close();}
});

test('unchanged escrow does not trigger continuous balance-refresh broadcasts',async()=>{const x=setup();try{assert.equal(await x.economy.tick(),false);assert.equal(await x.economy.tick(),false);}finally{x.s.db.close();}});

test('background recovery restores a confirmed room without signing or paying again',async()=>{
 const x=setup();try{
  const prepared=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(prepared,x.a);
  let signs=0;x.chain.transaction=()=>{signs++;throw Error('Background recovery must not prepare a transaction');};
  const result=await x.economy.reconcile(x.a);
  assert.equal(result.recovered.length,1);assert.equal(result.recovered[0].room.id,prepared.transaction.args.id);assert.equal(result.pending.length,0);assert.equal(signs,0);assert.equal(x.calls.length,0);
  assert.equal((await x.economy.reconcile(x.a)).recovered.length,0);
 }finally{x.s.db.close();}
});
test('three expired unpaid requests disappear automatically without cancelling any on-chain funds',async()=>{
 const x=setup();try{
  const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.01'},x.a),row=x.s.db.prepare('SELECT * FROM near_intents WHERE id=?').get(p.intent_id),intent=JSON.parse(row.json);
  intent.args.join_until=Date.now()-61000;
  x.s.db.prepare('UPDATE near_intents SET json=? WHERE id=?').run(JSON.stringify(intent),p.intent_id);
  for(let i=1;i<3;i++)x.s.db.prepare('INSERT INTO near_intents(id,user_id,json,created) VALUES(?,?,?,?)').run('legacy-'+i,x.a.id,JSON.stringify({...intent,id:'legacy-room-'+i,args:{...intent.args,id:'legacy-room-'+i}}),Date.now());
  const result=await x.economy.reconcile(x.a);assert.equal(result.expired.length,3);assert.deepEqual(result.pending,[]);assert.deepEqual(result.recovered,[]);assert.equal(x.calls.length,0);
  assert.deepEqual(await x.economy.confirm(p.intent_id,x.a),{cancelled:true,expired:true});
  assert((await x.economy.create('game',{game_id:'checkers',entry:'0.02'},x.a)).transaction);
 }finally{x.s.db.close();}
});
test('RPC failure never discards a request; fresh requests remain resumable',async()=>{
 const x=setup();try{
  const prepared=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);
  let result=await x.economy.reconcile(x.a);assert.equal(result.pending[0].status,'awaiting_wallet');assert.equal(result.pending[0].title,'Connect Four');
  x.chain.view=async()=>{throw Error('RPC unavailable');};result=await x.economy.reconcile(x.a);
  assert.equal(result.pending.length,1);assert.equal(result.pending[0].intent_id,prepared.intent_id);assert.equal(result.pending[0].status,'unavailable');assert.deepEqual(result.expired,[]);
 }finally{x.s.db.close();}
});
test('continuing an unsigned request uses the same room and receipt; a paid request opens directly',async()=>{
 const x=setup();try{
  const prepared=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a),retry=await x.economy.retry(prepared.intent_id,x.a);
  assert.equal(retry.intent_id,prepared.intent_id);assert.deepEqual(retry.transaction,prepared.transaction);assert.equal(x.economy.pending(x.a).length,1);
  await assert.rejects(()=>x.economy.retry(prepared.intent_id,x.b),/different wallet/);
  x.chainCreate(prepared,x.a);const ready=await x.economy.retry(prepared.intent_id,x.a);assert.equal(ready.id,prepared.transaction.args.id);assert.equal(ready.transaction,undefined);
 }finally{x.s.db.close();}
});

test('server recovery works without a browser and keeps account-scoped history after recreation',async()=>{
 const x=setup();try{
  const prepared=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(prepared,x.a);
  assert.equal(await x.economy.recoverPending(),true);assert.equal(x.economy.pending(x.a).length,0);
  const restarted=createNearEconomy(x.s,{chain:x.chain,services:x.services}),history=restarted.history(x.a);
  assert.equal(history.length,1);assert.equal(history[0].id,prepared.intent_id);assert.equal(history[0].status,'confirmed');assert.equal(history[0].title,'Connect Four');assert.deepEqual(restarted.history(x.b),[]);
  assert.equal(await restarted.recoverPending(),false);assert.equal(x.calls.length,0);
 }finally{x.s.db.close();}
});
test('expired unpaid requests remain in history with no payment recorded',async()=>{
 const x=setup();try{
  const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a),row=x.s.db.prepare('SELECT json FROM near_intents WHERE id=?').get(p.intent_id),data=JSON.parse(row.json);data.args.join_until=Date.now()-61000;
  x.s.db.prepare('UPDATE near_intents SET json=? WHERE id=?').run(JSON.stringify(data),p.intent_id);
  await x.economy.recoverPending();const [event]=x.economy.history(x.a);assert.equal(event.status,'expired');assert.equal(event.amount,'0');assert.equal(event.id,p.intent_id);assert.equal(x.calls.length,0);
 }finally{x.s.db.close();}
});
test('an unsigned join can continue only with its original receipt, then recovers in the background',async()=>{
 const x=setup();try{
  const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(p,x.a);const room=await x.economy.confirm(p.intent_id,x.a);
  const joining=await x.economy.action('game',room.id,'action',{type:'join'},x.b),view=x.chain.view;let paid=false;
  x.chain.view=async(method,args)=>method==='get_funding_receipt'?paid:view(method,args);
  assert.equal((await x.economy.reconcile(x.b)).pending[0].status,'awaiting_wallet');
  const retry=await x.economy.retry(joining.intent_id,x.b);assert.deepEqual(retry.transaction,joining.transaction);
  x.remote.get(room.id).members.push({account_id:x.b.id,amount:room.entry});paid=true;
  assert.equal(await x.economy.recoverPending(),true);assert(x.rooms.get(room.id,x.b).players.some(p=>p.id===x.b.id));assert.equal(x.economy.history(x.b)[0].status,'confirmed');
  assert.equal((await x.economy.retry(joining.intent_id,x.b)).transaction,undefined);
 }finally{x.s.db.close();}
});

test('confirmed winnings and refunds are retained once with a stable history date',async()=>{
 const x=setup();try{
  const p=await x.economy.create('game',{game_id:'connect-four',entry:'0.1'},x.a);x.chainCreate(p,x.a);const room=await x.economy.confirm(p.intent_id,x.a),remote=x.remote.get(room.id);
  assert.equal(x.economy.history(x.a).filter(e=>e.operation==='refund').length,0);
  remote.status='refunded';remote.payouts=[{account_id:x.a.id,amount:room.entry}];await x.economy.load(room.id,'game');
  const [refund]=x.economy.history(x.a).filter(e=>e.operation==='refund');assert.equal(refund.amount,room.entry);assert.equal(refund.title,'Connect Four');
  await x.economy.load(room.id,'game');const restarted=createNearEconomy(x.s,{chain:x.chain,services:x.services});
  assert.deepEqual(restarted.history(x.a).filter(e=>e.operation==='refund'),[refund]);assert.deepEqual(restarted.history(x.b),[]);
 }finally{x.s.db.close();}
});
