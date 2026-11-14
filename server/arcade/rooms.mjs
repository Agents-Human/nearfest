import {RACE_SECONDS,DEFAULT_RACE_SECONDS} from './race-course.mjs';
import {simulationIds,newSimulation,advanceSimulation,simulationAction,simulationView} from './simulations.mjs';
import {randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {amount,UNIT} from '../domain.mjs';
import {arcadeGame} from './catalog.mjs';
import {worldIds,newWorld,advanceWorld,worldAction,worldBot,controls,finish,DT} from './world.mjs';
import {puzzleIds,newPuzzle,advancePuzzle,puzzleAction,puzzleView,puzzleBot} from './puzzles.mjs';
import {newParty,advanceParty,partyAction,partyView,partyBot} from './party.mjs';

import {platformCharacter,platformLives,platformSettings} from '../../shared/platform-options.mjs';

const terminal=r=>['finished','cancelled'].includes(r.status);
const sameKey=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export async function createArcadeRooms(store){
 const {db}=store,rooms=new Map(),inputs=new Map(),subscribers=new Map(),watched=new Set(),playing=new Set(),activity=new Set();
 function remember(room){rooms.set(room.id,room);if(terminal(room))watched.delete(room.id);else watched.add(room.id);if(room.status==='playing')playing.add(room.id);else playing.delete(room.id);for(const fn of activity)fn(playing.size>0);}
 let queued=Promise.resolve();
 const serial=fn=>{const next=queued.then(fn);queued=next.catch(()=>{});return next;};
 const save=async r=>{await db.prepare('INSERT INTO arcade_rooms(id,json) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,JSON.stringify(r));if(r.status!=='playing')await store.jobs?.scheduleRoom('arcade',r);};
 const credit=(r,id,n)=>{}; // Settlement is performed by NEAR escrow, never by a local balance.
 const debit=async (r,id,n)=>{if(BigInt(n)>0n){if(!r.near)throw Error('Sign a NEAR testnet deposit first.');(await store.reserveNear(r.id,id,n));}};
 async function close(r,winners,reason,now,status='finished'){
  if(terminal(r))return;r.status=status;r.winners=winners;r.reason=reason;r.finished_at=now;
  if(r.state&&!r.state.finished)finish(r.state,winners.map(id=>r.players.findIndex(p=>p.id===id)),reason);
  const humans=r.players.filter(p=>!p.bot),pot=BigInt(r.entry)*BigInt(humans.length),refund=status==='cancelled'||winners.length===0,recipients=refund?humans:humans.filter(p=>winners.includes(p.id));
  if(recipients.length){const share=pot/BigInt(recipients.length),remainder=pot%BigInt(recipients.length);for(const [i,p] of recipients.entries()){const value=share+(BigInt(i)<remainder?1n:0n);p.payout=value.toString();credit(r,p.id,value);}}
  (await save(r));
 }
 // A restart must never replay an unfinished money result from an old snapshot.
 (await store.transaction(async ()=>{for(const row of (await db.prepare("SELECT json FROM arcade_rooms WHERE json::jsonb->>'status' IN ('lobby','playing')").all())){const r=JSON.parse(row.json);if(r.status==='playing')(await close(r,[],'Server restarted. All entries returned.',Date.now(),'cancelled'));remember(r);}}));
 await store.loadUsers([...rooms.values()].flatMap(room=>room.players.map(player=>player.id)));
 const read=async id=>{
  let room=rooms.get(id);
  if(!room){const row=await db.prepare('SELECT json FROM arcade_rooms WHERE id=$1').get(id);if(!row)throw Error('Game room not found.');room=JSON.parse(row.json);await store.loadUsers(room.players.map(player=>player.id));await store.loadNear?.([id]);remember(room);}
  return room;
 };
 function access(r,user,key){if(r.visibility==='invite'&&!r.players.some(p=>p.id===user?.id)&&!sameKey(key,r.invite_key))throw Error('Open the full invitation link to access this private room.');}
 function available(user,except){if([...rooms.values()].some(r=>r.id!==except&&!terminal(r)&&r.players.some(p=>p.id===user.id&&!p.left)))throw Error('Finish or end your current game before starting another.');}
 async function view(r,user,now=Date.now()){
  const g=arcadeGame(r.game_id),seat=r.players.findIndex(p=>p.id===user?.id),me=seat<0?null:r.players[seat],state=r.state?(simulationIds.has(g.id)?simulationView(r.state,seat):worldIds.has(g.id)?r.state:puzzleIds.has(g.id)?puzzleView(r.state,seat):partyView(r.state,seat)):null;
  return {near:store.cachedNearStatus?.(r.id,r.players)||null,id:r.id,engine:'arcade',game_id:g.id,title:g.title,label:g.label,art:g.id,category:g.category,description:g.description,status:r.status,phase:r.status==='playing'&&now<r.starts_at?'countdown':r.status,host:r.host,solo:r.solo,race_seconds:r.race_seconds,...(g.id==='platform-relay'?{settings:platformSettings(r.settings)}:{}),entry:r.entry,pot:(BigInt(r.entry)*BigInt(r.players.filter(p=>!p.bot).length)).toString(),min_players:g.min_players,max_players:r.max_players,visibility:r.visibility,...(me&&r.visibility==='invite'?{invite_key:r.invite_key}:{}),starts_at:r.starts_at,ends_at:r.ends_at,expires_at:r.expires_at,server_time:now,total:1,curation:'deterministic',question:null,players:(await Promise.all(r.players.map(async (p,i)=>({...p,name:p.bot?p.name:store.cachedUser(p.id)?.name||'Player',score:r.state?.players[i]?.score??r.state?.scores?.[i]??0,index:0,done:terminal(r),payout:p.payout||'0'})))),me:me?{index:seat,score:r.state?.players[seat]?.score||0}:null,my_side:seat<0?null:seat,state,winners:r.winners||[],reason:r.reason||'',input_seq:me?inputs.get(r.id)?.[seat]?.seq??-1:-1,revision:r.revision,bettable:g.bettable};
 }
 async function publish(r){for(const item of subscribers.get(r.id)||[]){try{item.send((await view(r,item.user)));}catch{}}}
 async function commit(r){(await save(r));remember(r);(await publish(r));}
 async function mutate(id,user,key,fn){const result=(await store.transaction(async ()=>{const old=await read(id);access(old,user,key);const r=structuredClone(old);await fn(r);await store.loadUsers(r.players.map(player=>player.id));r.revision++;(await save(r));return r;}));remember(result);(await publish(result));return (await view(result,user));}
 function startState(r,now){
  const n=r.players.length;r.state=simulationIds.has(r.game_id)?newSimulation(r.game_id,n):worldIds.has(r.game_id)?newWorld(r.game_id,n,{...r.settings,characters:r.players.map(p=>p.character)}):puzzleIds.has(r.game_id)?newPuzzle(r.game_id,n):newParty(r.game_id,n,r.solo);
  if(r.game_id==='pocket-racers')r.state.timeLimit=r.race_seconds??DEFAULT_RACE_SECONDS;
  r.status='playing';r.starts_at=now+3000;r.last_tick=r.starts_at;r.last_saved=now;const duration=r.game_id==='pocket-racers'?r.state.timeLimit:r.game_id==='draw-guess'?(r.solo?5:n)*64:({'clue-crew':540,'bluff-club':275,'category-sprint':300,'equation-forge':230,'stick-rivals':184,'bomb-maze':169}[r.game_id]??arcadeGame(r.game_id).seconds);r.ends_at=['tappy-plane','platform-relay','cat-defense','bridge-builders'].includes(r.game_id)?null:r.starts_at+duration*1000;
 }
 function botCount(id){if(simulationIds.has(id))return 0;if(['tappy-plane','kitchen-rush','orbit-rescue','mini-golf','word-hunt','category-sprint','equation-forge','circuit-crew','cat-defense','bridge-builders','molecule-match','sudoku-race','codebreakers'].includes(id))return 0;return {'draw-guess':1,'clue-crew':3,'bluff-club':2,'deduction-club':4,'snake-arena':3,'marble-knockout':3,'paint-tag':2,'bomb-maze':2}[id]??1;}
 const api={
  notify:async id=>{if(rooms.has(id))(await publish((await rooms.get(id))));},
  list:async (user,{mine=false}={})=>{
   if(mine&&!user)return [];
   const member=JSON.stringify([{id:user?.id||''}]);
   const membership="(json::jsonb->'players') @> $1::jsonb";
   const scope=mine?membership:"((json::jsonb->>'visibility'='public' AND json::jsonb->>'status' NOT IN ('finished','cancelled')) OR "+membership+")";
   const rows=(await db.query("SELECT json FROM arcade_rooms WHERE COALESCE(json::jsonb->>'solo','false')<>'true' AND ((json::jsonb->>'entry')::numeric=0 OR json::jsonb->>'near'='true') AND "+scope+' ORDER BY created_order DESC LIMIT $2',[member,mine?1000:100])).rows;
   const found=rows.map(row=>JSON.parse(row.json));await store.loadUsers(found.flatMap(room=>room.players.map(player=>player.id)));await store.loadNear?.(found.map(room=>room.id));
   return Promise.all(found.map(room=>view(rooms.get(room.id)||room,user)));
  },
  get:async (id,user,key)=>{const r=await read(id);access(r,user,key);return view(r,user);},
  hasActiveGames:()=>playing.size>0,
  onActivity:fn=>{activity.add(fn);fn(playing.size>0);return()=>activity.delete(fn);},
  expire:async(id,now=Date.now())=>serial(async()=>{const r=await read(id);if(r.status!=='lobby'||now<r.expires_at)return false;await mutate(id,{id:r.host},r.invite_key,room=>close(room,[],'Lobby expired. Entries returned.',now,'cancelled'));return true;}),
  create:async (d,user,now=Date.now(),funding=null)=>serial(async ()=>{available(user);const g=arcadeGame(d.game_id);if(!g)throw Error('Choose an original arcade game.');const solo=d.solo===true,entry=amount(String(d.entry??'0')),max=Number(d.max_players??g.max_players);
   if(entry>0n&&solo)throw Error('Stakes require a multiplayer room.');if(!Number.isInteger(max)||max<g.min_players||max>g.max_players)throw Error('Choose a supported room size.');
   const raceSeconds=Number(d.race_seconds??DEFAULT_RACE_SECONDS);if(g.id==='pocket-racers'&&!RACE_SECONDS.includes(raceSeconds))throw Error('Choose a race duration of 1, 2, 3, 5 or 10 minutes.');
   const r={...(g.id==='pocket-racers'?{race_seconds:raceSeconds}:{}),id:funding?.id||'arena-'+randomUUID(),game_id:g.id,host:user.id,status:'lobby',solo,entry:entry.toString(),near:entry>0n,visibility:solo?'invite':d.visibility==='invite'?'invite':'public',invite_key:randomBytes(24).toString('hex'),max_players:max,created_at:now,expires_at:funding?.expires_at||now+1800000,starts_at:null,ends_at:null,...(g.id==='platform-relay'?{settings:platformSettings(d.settings)}:{}),players:[{id:user.id,ready:solo,bot:false,...(g.id==='platform-relay'?{character:platformCharacter(d.character)}:{})}],revision:0,receipts:[],state:null};
   if(solo){for(let i=0;i<botCount(g.id);i++)r.players.push({id:`bot:${i}`,name:`Practice bot ${i+1}`,bot:true,ready:true,...(g.id==='platform-relay'?{character:platformCharacter(undefined,i+1)}:{})});startState(r,now);}
   (await store.transaction(async ()=>{(await debit(r,user.id,entry));(await save(r));}));remember(r);return (await view(r,user,now));
  }),
  start:async (id,user,key,now=Date.now())=>(await mutate(id,user,key,r=>{const g=arcadeGame(r.game_id);if(r.host!==user.id||r.status!=='lobby'||now>=r.expires_at||r.players.length<g.min_players||r.players.some(p=>!p.ready))throw Error('Everyone must be ready before the host starts.');if(['maths-tug','clue-crew'].includes(g.id)&&r.players.length%2)throw Error('Use an even number of players for equal teams.');startState(r,now);})),
  action:async (id,user,d,key,now=Date.now())=>(await mutate(id,user,key||d.invite_key,async r=>{const seat=r.players.findIndex(p=>p.id===user.id),p=r.players[seat];
   if(d.type==='chain-refund'&&(await store.nearStatus?.(id))?.status==='refunded'){(await close(r,[],'NEAR escrow refunded all entries.',now,'cancelled'));return;}
   if(d.type==='join'){if(p)return;available(user,id);if(r.status!=='lobby'||r.players.length>=r.max_players||now>=r.expires_at)throw Error('This room has already started or is full.');(await debit(r,user.id,BigInt(r.entry)));r.players.push({id:user.id,ready:false,bot:false,...(r.game_id==='platform-relay'?{character:platformCharacter(d.character,r.players.length)}:{})});r.players.forEach(p=>p.ready=false);return;}
   if(!p)throw Error('Join the room before playing.');
   if(d.type==='character'){
    if(r.game_id!=='platform-relay'||r.status!=='lobby')throw Error('Choose your character before the game starts.');
    p.character=platformCharacter(d.character,seat);return;
   }
   if(d.type==='platform-settings'){
    if(r.game_id!=='platform-relay'||r.status!=='lobby'||r.host!==user.id)throw Error('Only the host can change starting lives in the lobby.');
    const lives=platformLives(d.lives);
    if(lives!==platformSettings(r.settings).lives){r.settings={lives};r.players.forEach(p=>p.ready=false);}return;
   }
   if(d.type==='ready'){if(r.status!=='lobby'||typeof d.ready!=='boolean')throw Error('Ready is only available in the lobby.');p.ready=d.ready;return;}
   if(d.type==='cancel'){if(r.status!=='lobby'||r.host!==user.id)throw Error('Only the host can cancel the lobby.');(await close(r,[],'Lobby cancelled. Entries returned.',now,'cancelled'));return;}
   if(d.type==='leave'){if(r.status!=='lobby'||r.host===user.id)throw Error('End your game or cancel your lobby first.');credit(r,user.id,BigInt(r.entry));r.players.splice(seat,1);r.players.forEach(p=>p.ready=false);return;}
   if(d.type==='resign'){if(terminal(r))return;if(r.status!=='playing')throw Error('No game is in progress.');p.left=true;
    if(r.solo||BigInt(r.entry)===0n&&simulationIds.has(r.game_id))(await close(r,[],'Game ended by a player.',now,'cancelled'));
    else (await close(r,r.players.filter(q=>q.id!==user.id).map(q=>q.id),r.game_id==='platform-relay'?'An opponent left the survival round. The remaining players win.':'Opponent ended the game. Remaining players share the pot.',now));return;}
   if(d.type!=='play')throw Error('Unknown game action.');const receipt=d.input_id,payload=JSON.stringify(d.action);if(typeof receipt!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(receipt))throw Error('A valid action receipt is required.');
   const prior=r.receipts.find(x=>x.id===receipt&&x.user===user.id);if(prior){if(prior.payload!==payload)throw Error('A receipt cannot be reused for another action.');return;}
   if(r.status!=='playing'||now<r.starts_at)throw Error('Wait for the game to start.');if(!d.action||typeof d.action!=='object')throw Error('Choose an action.');
   (simulationIds.has(r.game_id)?simulationAction:worldIds.has(r.game_id)?worldAction:puzzleIds.has(r.game_id)?puzzleAction:partyAction)(r.state,seat,d.action);r.receipts.push({id:receipt,user:user.id,payload});r.receipts=r.receipts.slice(-512);
   if(r.state.finished)(await close(r,r.state.winners.map(i=>r.players[i].id),r.state.reason,now));
  })),
  input:async (id,user,d,key,now=Date.now())=>{const r=(await read(id));access(r,user,key);const seat=r.players.findIndex(p=>p.id===user.id);if(seat<0||r.status!=='playing'||!(worldIds.has(r.game_id)||simulationIds.has(r.game_id)))throw Error('Join an active action game first.');if(!Number.isSafeInteger(d.seq)||d.seq<0)throw Error('Invalid input sequence.');const row=inputs.get(id)||{},old=row[seat];if(!old||d.seq>old.seq){const next=controls(d.controls),pressed={...old?.pressed};if(['platform-relay','stick-rivals','marble-run','pocket-soccer','bridge-builders','cat-defense','pocket-racers'].includes(r.game_id))for(const key of (r.game_id==='pocket-racers'?['fire']:r.game_id==='cat-defense'?['up','down','attack','block']:r.game_id==='stick-rivals'?['up','down','attack','block','fire']:['up','attack']))if(next[key]&&!old?.controls[key])pressed[key]=true;row[seat]={seq:d.seq,at:now,controls:next,pressed};inputs.set(id,row);}return {accepted:row[seat].seq};},
  subscribe:async (id,user,key,send)=>{const r=(await read(id));access(r,user,key);const set=subscribers.get(id)||new Set();if(set.size>=100)throw Error('This room has too many viewers.');const entry={user,send};set.add(entry);subscribers.set(id,set);send((await view(r,user)));return()=>{set.delete(entry);if(!set.size)subscribers.delete(id);};},
  messages:async (id,user,key)=>{const r=(await read(id));access(r,user,key);const seat=r.players.findIndex(p=>p.id===user?.id),bench=r.game_id==='deduction-club'&&r.status==='playing'&&(seat<0||!r.state.players[seat]?.alive),channel=bench?'bench':'players';return (await db.prepare('SELECT c.id,c.text,c.at AS created_at,u.name,c.user_id FROM arcade_chat c LEFT JOIN users u ON u.id=c.user_id WHERE c.room=$1 AND c.channel=$2 ORDER BY c.id DESC LIMIT 100').all(id,channel)).reverse();},
  chat:async (id,user,text,key)=>{const r=(await read(id));access(r,user,key);const seat=r.players.findIndex(p=>p.id===user.id);if(seat<0)throw Error('Join before chatting.');if(r.game_id==='deduction-club'&&r.status==='playing'&&r.state.players[seat].alive&&r.state.phase==='night')throw Error('The night phase is quiet. Discuss in the morning.');const channel=r.game_id==='deduction-club'&&r.status==='playing'&&!r.state.players[seat].alive?'bench':'players';(await db.prepare('INSERT INTO arcade_chat(room,user_id,text,channel,at) VALUES($1,$2,$3,$4,$5)').run(id,user.id,text,channel,Date.now()));return {ok:true};},
  tick:async (now=Date.now())=>{let changed=false;for(const id of [...watched]){const old=rooms.get(id);
   if(old.status==='lobby'&&now>=old.expires_at){const r=structuredClone(old);(await store.transaction(async ()=>(await close(r,[],'Lobby expired. Entries returned.',now,'cancelled'))));remember(r);(await publish(r));changed=true;continue;}
   if(old.status!=='playing')continue;if(now<old.starts_at){const second=Math.ceil((old.starts_at-now)/1000);if(old.countdown!==second){old.countdown=second;(await publish(old));}continue;}
   if(now-old.last_tick>3000){const r=structuredClone(old);(await store.transaction(async ()=>(await close(r,[],'Connection to the game server paused. Entries returned.',now,'cancelled'))));remember(r);(await publish(r));changed=true;continue;}
   const steps=Math.min(10,Math.floor((now-old.last_tick)/50));if(!steps)continue;let r={...old,state:old.state};
   for(let step=0;step<steps&&!r.state.finished;step++){
    const input=r.players.map((p,i)=>{if(p.bot)return worldIds.has(r.game_id)?worldBot(r.state,i):{};const row=inputs.get(r.id)?.[i];if(!row||now-row.at>=650)return {};const held={...row.controls,...row.pressed};row.pressed={};return held;});
    for(let i=0;i<r.players.length;i++)if(r.players[i].bot&&!worldIds.has(r.game_id)){const action=puzzleIds.has(r.game_id)?puzzleBot(r.state,i):partyBot(r.state,i);if(action){r.state=structuredClone(r.state);try{(puzzleIds.has(r.game_id)?puzzleAction:partyAction)(r.state,i,action);}catch{}}}
    r.state=simulationIds.has(r.game_id)?advanceSimulation(r.state,input):worldIds.has(r.game_id)?advanceWorld(r.state,input):puzzleIds.has(r.game_id)?advancePuzzle(r.state):advanceParty(r.state);r.last_tick+=50;
   }
   if(r.state.finished){r=structuredClone(r);(await store.transaction(async ()=>(await close(r,r.state.winners.map(i=>r.players[i].id),r.state.reason,now))));changed=true;}
   remember(r);if(worldIds.has(r.game_id)||r.state.tick%2===0||r.state.finished)(await publish(r));
  }return changed;},
 };
 for(const method of ['start','action','tick']){const operation=api[method];api[method]=(...args)=>serial(()=>operation(...args));}
 return api;
}
