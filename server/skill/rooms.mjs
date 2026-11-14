import {hasMatingMaterial} from './chess.mjs';
import {randomUUID} from 'node:crypto';
import {amount,UNIT} from '../domain.mjs';
import {getSkillGame,initialState,legalMoves,applyMove,publicBoard,ended} from './engines.mjs';
const CLOCK=5*60*1000;
export function createBoardRooms(store){
 const {db}=store;
 const read=async id=>{const row=(await db.prepare('SELECT json FROM skill_rooms WHERE id=$1'+(db.inTransaction()?' FOR UPDATE':'')).get(id));if(!row)throw Error('This game room was not found.');return JSON.parse(row.json);};
 const save=async r=>{await db.prepare('INSERT INTO skill_rooms(id,json) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,JSON.stringify(r));await store.jobs?.scheduleRoom('board',r);};
 const credit=(r,id,n)=>{}; // Settlement is performed by NEAR escrow, never by a local balance.
 const debit=async (r,id,n)=>{if(BigInt(n)>0n){if(!r.near)throw Error('Sign a NEAR testnet deposit first.');(await store.reserveNear(r.id,id,n));}};
 const seat=(r,side)=>r.leg===1?side:1-side;
 async function close(r,winners,reason,now,status='finished'){
  if(['finished','cancelled'].includes(r.status))return;
  r.status=status;r.winners=winners;r.reason=reason;r.finished_at=now;r.revision++;
  for(const p of r.players){const payout=status==='cancelled'||winners.length===0?BigInt(r.entry):winners.includes(p.id)?BigInt(r.entry)*BigInt(r.players.length):0n;p.payout=payout.toString();credit(r,p.id,payout);}
  (await save(r));
 }
 function nextLeg(r,now){r.draw_offer=null;r.leg++;r.board=initialState(r.game_id);r.clocks=[CLOCK,CLOCK];r.starts_at=now+3000;r.clock_at=r.starts_at;r.ends_at=r.starts_at+2*CLOCK;r.revision++;}
 async function recordLeg(r,winner,reason,now){
  const player=winner===null?null:seat(r,winner);r.results.push({leg:r.leg,winner:player===null?null:r.players[player].id,reason});
  if(player===null)r.players.forEach(p=>p.score+=.5);else r.players[player].score++;
  if(r.leg<2)nextLeg(r,now);else{const best=Math.max(...r.players.map(p=>p.score)),w=r.players.filter(p=>p.score===best);(await close(r,w.length===1?[w[0].id]:[],w.length===1?'Best score across both games.':'Match tied. Both entries returned.',now));}
 }
 async function expire(r,now){
  if(r.status==='lobby'&&now>=r.expires_at){(await close(r,[],'Waiting room expired. Entries returned.',now,'cancelled'));return true;}
  if(r.status!=='playing'||now<r.starts_at)return false;
  const turn=r.board.turn;if(r.clocks[turn]-(now-r.clock_at)<=0){const canMate=r.game_id!=='chess-online'||hasMatingMaterial(r.board,1-turn);(await recordLeg(r,canMate?1-turn:null,canMate?'Opponent ran out of time.':'Timeout draw: opponent cannot mate with the remaining material.',now));(await save(r));return true;}return false;
 }
 async function view(r,user,now){
  const g=getSkillGame(r.game_id),index=r.players.findIndex(p=>p.id===user?.id),mySide=index<0?null:seat(r,index),clocks=[...(r.clocks||[CLOCK,CLOCK])];
  if(r.status==='playing'&&now>=r.starts_at)clocks[r.board.turn]=Math.max(0,clocks[r.board.turn]-(now-r.clock_at));
  return {near:(await store.nearStatus?.(r.id))||null,id:r.id,game_id:r.game_id,engine:'skill',title:g.title,category:g.category,label:g.title,art:g.id,host:r.host,status:r.status,phase:r.status==='playing'&&now<r.starts_at?'countdown':r.status,entry:r.entry,pot:(BigInt(r.entry)*BigInt(r.players.length)).toString(),max_players:2,total:2,visibility:r.visibility,expires_at:r.expires_at,starts_at:r.starts_at,ends_at:r.ends_at,server_time:now,players:(await Promise.all(r.players.map(async p=>({...p,name:(await store.user(p.id))?.name||p.id,done:r.status==='finished',index:0,payout:p.payout||'0'})))),me:index<0?null:{index:0,score:r.players[index].score},question:null,curation:'deterministic',winners:r.winners||[],reason:r.reason||'',board:r.board?publicBoard(r.board):null,legal_moves:r.board&&r.status==='playing'&&now>=r.starts_at&&mySide===r.board.turn?legalMoves(r.board):[],my_side:mySide,turn_player:r.board?r.players[seat(r,r.board.turn)]?.id:null,clocks,leg:r.leg||1,results:r.results||[],revision:r.revision,draw_offer:r.draw_offer||null,rules_version:g.rules_version};
 }
 async function expireOne(id,now=Date.now()){return store.transaction(async()=>{const row=await db.prepare('SELECT json FROM skill_rooms WHERE id=$1 FOR UPDATE').get(id);if(!row)return false;const room=JSON.parse(row.json);const changed=await expire(room,now);await store.jobs?.scheduleRoom('board',room);return changed;});}
 return {
  expire:expireOne,
  list:async (user,{mine=false}={})=>(await Promise.all((await db.prepare('SELECT json FROM skill_rooms ORDER BY created_order DESC').all()).map(x=>JSON.parse(x.json)).filter(r=>BigInt(r.entry)===0n||r.near).filter(r=>mine?r.players.some(p=>p.id===user?.id):(r.visibility==='public'||r.players.some(p=>p.id===user?.id))&&(['lobby','playing'].includes(r.status)||r.players.some(p=>p.id===user?.id))).filter((_,i)=>mine||i<200).map(async r=>(await view(r,user,Date.now()))))),
  get:async (id,user,now=Date.now())=>(await store.transaction(async ()=>{const r=(await read(id));(await expire(r,now));return (await view(r,user,now));})),
  create:async (data,user,now=Date.now(),funding=null)=>(await store.transaction(async ()=>{
   const game=getSkillGame(data.game_id);if(!game)throw Error('Choose a supported skill game.');
   const entry=amount(String(data.entry??'0'));
   if(data.max_players!==undefined&&Number(data.max_players)!==2)throw Error('This is a two-player game.');
   const r={id:funding?.id||'board-'+randomUUID(),game_id:game.id,host:user.id,status:'lobby',entry:entry.toString(),near:entry>0n,visibility:data.visibility==='invite'?'invite':'public',created_at:now,expires_at:funding?.expires_at||now+1800000,players:[{id:user.id,ready:false,score:0}],revision:0,leg:1,results:[],dedup:[],board:null,starts_at:null,ends_at:null};(await debit(r,user.id,entry));(await save(r));return (await view(r,user,now));
  })),
  action:async (id,user,d,now=Date.now())=>(await store.transaction(async ()=>{
   const r=(await read(id));(await expire(r,now));const player=r.players.findIndex(p=>p.id===user.id);
   if(d.type==='chain-refund'&&(await store.nearStatus?.(id))?.status==='refunded'){(await close(r,[],'NEAR escrow refunded all entries.',now,'cancelled'));return (await view(r,user,now));}
   if(d.type==='join'){
    if(player>=0)return (await view(r,user,now));if(r.status!=='lobby'||r.players.length>=2)throw Error('This room is full or already started.');(await debit(r,user.id,r.entry));r.players.push({id:user.id,ready:false,score:0});r.players.forEach(p=>p.ready=false);
   }else if(player<0)throw Error('Join this room before taking part.');
   else if(d.type==='ready'){if(r.status!=='lobby'||typeof d.ready!=='boolean')throw Error('The ready state cannot change now.');r.players[player].ready=d.ready;}
   else if(d.type==='leave'){if(r.status!=='lobby'||r.host===user.id)throw Error('Only a guest can leave a waiting room.');credit(r,user.id,r.entry);r.players.splice(player,1);r.players.forEach(p=>p.ready=false);}
   else if(d.type==='cancel'){if(r.status!=='lobby'||r.host!==user.id)throw Error('Only the host can cancel a waiting room.');(await close(r,[],'Host cancelled. Entries returned.',now,'cancelled'));return (await view(r,user,now));}
   else if(d.type==='resign'){if(r.status!=='playing')throw Error('There is no match to resign.');(await close(r,[r.players[1-player].id],'Opponent resigned the match.',now));return (await view(r,user,now));}
   else if(d.type==='offer-draw'){if(r.status!=='playing')throw Error('No match in play.');if(r.draw_offer&&r.draw_offer!==user.id)throw Error('Your opponent already offered a draw. Accept it or make your move.');r.draw_offer=user.id;(await save(r));return (await view(r,user,now));}
   else if(d.type==='accept-draw'){if(r.status!=='playing'||!r.draw_offer||r.draw_offer===user.id)throw Error('Only the opponent can accept a draw offer.');(await close(r,[],'Both players agreed a drawn match.',now));return (await view(r,user,now));}
   else if(d.type==='move'){
    if(typeof d.input_id!=='string'||!/^[-a-zA-Z0-9]{8,80}$/.test(d.input_id))throw Error('A valid move receipt is required.');
    const old=r.dedup.find(x=>x.id===d.input_id&&x.actor===user.id),payload=JSON.stringify(d.move);
    if(old){if(old.payload!==payload)throw Error('A move receipt cannot be reused for a different move.');return (await view(r,user,now));}
    if(r.status!=='playing'||now<r.starts_at)throw Error('Wait for the match countdown.');
    if(d.revision!==r.revision)throw Error('The board changed. Your latest board is loading.');
    if(seat(r,r.board.turn)!==player)throw Error('Wait for your turn.');
    const turn=r.board.turn,next=applyMove(r.board,d.move);r.clocks[turn]-=Math.max(0,now-r.clock_at);r.clock_at=now;r.board=next;r.draw_offer=null;r.dedup.push({id:d.input_id,actor:user.id,payload});r.dedup=r.dedup.slice(-256);
    if(ended(next))(await recordLeg(r,next.draw?null:next.winner,next.reason,now));
   }else throw Error('Unknown game action.');
   r.revision++;(await save(r));return (await view(r,user,now));
  })),
  start:async (id,user,now=Date.now())=>(await store.transaction(async ()=>{const r=(await read(id));if(r.host!==user.id||r.status!=='lobby'||now>=r.expires_at||r.players.length!==2||r.players.some(p=>!p.ready))throw Error('Both players must be ready before the host starts.');r.leg=0;r.status='playing';nextLeg(r,now);(await save(r));return (await view(r,user,now));})),
  tick:async (now=Date.now())=>(await store.transaction(async ()=>{let changed=false;for(const row of (await db.prepare("SELECT json FROM skill_rooms WHERE json::jsonb->>'status' IN ('lobby','playing')").all()))if((await expire(JSON.parse(row.json),now)))changed=true;return changed;})),
 };
}
