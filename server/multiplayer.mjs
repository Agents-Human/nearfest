import {withChoiceArt} from './choice-art.mjs';
import {randomUUID} from 'node:crypto';
import {amount,UNIT} from './domain.mjs';
import {games,candidatesFor} from './play.mjs';
import {curateQuestions} from './curator.mjs';
export function createMultiplayer(store,{curate=curateQuestions}={}){
 const {db}=store,pending=new Map();
 const read=async id=>{const row=(await db.prepare('SELECT json FROM multiplayer_rooms WHERE id=$1'+(db.inTransaction()?' FOR UPDATE':'')).get(id));if(!row)throw Error('This multiplayer room was not found.');return JSON.parse(row.json);};
 const save=async r=>{await db.prepare('INSERT INTO multiplayer_rooms(id,json) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,JSON.stringify(r));await store.jobs?.scheduleRoom('quiz',r);};
 const credit=(r,id,n)=>{}; // Settlement is performed by NEAR escrow, never by a local balance.
 const debit=async (r,id,n)=>{if(BigInt(n)>0n){if(!r.near)throw Error('Sign a NEAR testnet deposit first.');(await store.reserveNear(r.id,id,n));}};
 async function publicRoom(r,user,now=Date.now()){
   const me=r.players.find(p=>p.id===user?.id),game=games.find(g=>g.id===r.game_id);let question=null;
   if(r.status==='playing'&&now>=r.starts_at&&now<r.ends_at&&me&&!me.left&&me.index<r.questions.length){const {answer,...q}=r.questions[me.index];question=withChoiceArt(q);}
   return {near:(await store.nearStatus?.(r.id))||null,id:r.id,game_id:r.game_id,title:game?.title,category:game?.category,label:game?.label,art:game?.art||game?.id,host:r.host,status:r.status,phase:r.status==='playing'&&now<r.starts_at?'countdown':r.status,entry:r.entry,pot:(BigInt(r.entry)*BigInt(r.players.length)).toString(),max_players:r.max_players,starts_at:r.starts_at,ends_at:r.ends_at,expires_at:r.expires_at,total:r.questions.length||game?.rounds,curation:r.curation,visibility:r.visibility,players:(await Promise.all(r.players.map(async p=>({id:p.id,name:(await store.user(p.id))?.name||p.id,ready:p.ready,left:Boolean(p.left),score:p.score,index:p.index,done:r.status==='finished'||p.index>=r.questions.length&&r.questions.length>0,payout:p.payout||'0'})))),me:me?{index:me.index,score:me.score}:null,question,winners:r.winners||[],server_time:now};
 }
 async function settle(r,now){
   if(r.status==='lobby'&&now>=r.expires_at){for(const p of r.players)credit(r,p.id,r.entry);r.status='cancelled';(await save(r));return true;}
   if(r.status!=='playing'||now<r.starts_at||now<r.ends_at&&r.players.some(p=>!p.left&&p.index<r.questions.length))return false;
   const eligible=r.players.filter(p=>!p.left),high=Math.max(0,...eligible.map(p=>p.score)),winners=eligible.length?(high>0?eligible.filter(p=>p.score===high):eligible):r.players,total=BigInt(r.entry)*BigInt(r.players.length),share=total/BigInt(winners.length);let remainder=total%BigInt(winners.length);
   for(const p of winners){const extra=remainder>0n?1n:0n;remainder-=extra;p.payout=(share+extra).toString();credit(r,p.id,p.payout);}
   r.winners=high>0||winners.length<r.players.length?winners.map(p=>p.id):[];r.status='finished';r.finished_at=now;(await save(r));return true;
 }
 async function expireOne(id,now=Date.now()){return store.transaction(async()=>{const row=await db.prepare('SELECT json FROM multiplayer_rooms WHERE id=$1 FOR UPDATE').get(id);if(!row)return false;const room=JSON.parse(row.json);const changed=await settle(room,now);await store.jobs?.scheduleRoom('quiz',room);return changed;});}
 return {
  expire:expireOne,
   list:async (user,{mine=false}={})=>(await Promise.all((await db.prepare('SELECT json FROM multiplayer_rooms ORDER BY created_order DESC').all()).map(x=>JSON.parse(x.json)).filter(r=>BigInt(r.entry)===0n||r.near).filter(r=>mine?r.players.some(p=>p.id===user?.id):(r.visibility==='public'||r.players.some(p=>p.id===user?.id))&&(['lobby','playing'].includes(r.status)||r.players.some(p=>p.id===user?.id))).filter((_,i)=>mine||i<200).map(async r=>(await publicRoom(r,user))))),
   get:async (id,user,now=Date.now())=>(await publicRoom((await read(id)),user,now)),
   create:async (data,user,now=Date.now(),funding=null)=>(await store.transaction(async ()=>{
     const game=games.find(g=>g.id===data.game_id);if(!game||game.engine)throw Error('Choose a multiplayer challenge pack.');
     const entry=amount(String(data.entry??'0')),max=Number(data.max_players||8);if(!Number.isInteger(max)||max<2||max>16)throw Error('Choose 2–16 players.');
     const r={id:funding?.id||'party-'+randomUUID(),game_id:game.id,host:user.id,status:'lobby',entry:entry.toString(),near:entry>0n,max_players:max,visibility:data.visibility==='invite'?'invite':'public',created_at:now,expires_at:funding?.expires_at||now+1800000,questions:[],players:[{id:user.id,ready:false,index:0,score:0}],starts_at:null,ends_at:null,difficulty:data.difficulty==='brainy'?'brainy':'mixed'};(await debit(r,user.id,entry));(await save(r));return (await publicRoom(r,user,now));
   })),
   action:async (id,user,data,now=Date.now())=>(await store.transaction(async ()=>{
     const r=(await read(id));(await settle(r,now));const p=r.players.find(p=>p.id===user.id);if(data.type==='chain-refund'&&(await store.nearStatus?.(id))?.status==='refunded'){r.status='cancelled';(await save(r));return (await publicRoom(r,user,now));}if(data.type==='resign'){if(!p)throw Error('Join before ending a game.');if(p.left||r.status==='finished')return (await publicRoom(r,user,now));if(r.status!=='playing')throw Error('No game in progress.');p.left=true;p.index=r.questions.length;(await save(r));(await settle(r,now));return (await publicRoom(r,user,now));}if(r.status!=='lobby')throw Error('This lobby is no longer open.');
     if(data.type==='join'){if(p)return (await publicRoom(r,user,now));if(r.players.length>=r.max_players)throw Error('The room is full.');(await debit(r,user.id,r.entry));r.players.push({id:user.id,ready:false,index:0,score:0});}
     else if(data.type==='ready'){if(!p)throw Error('Join before getting ready.');if(typeof data.ready!=='boolean')throw Error('Choose your ready state.');p.ready=data.ready;}
     else if(data.type==='leave'){if(!p)throw Error('You are not in this room.');if(r.host===user.id)throw Error('The host can cancel the lobby.');credit(r,p.id,r.entry);r.players=r.players.filter(x=>x.id!==p.id);}
     else if(data.type==='cancel'){if(r.host!==user.id)throw Error('Only the host can cancel.');for(const p of r.players)credit(r,p.id,r.entry);r.status='cancelled';}
     else throw Error('Unknown lobby action.');(await save(r));return (await publicRoom(r,user,now));
   })),
   start:async(id,user,nowOverride)=>{
     const r=(await read(id));if(r.host!==user.id)throw Error('Only the host can start.');if(pending.has(id))return pending.get(id);
     if(r.host!==user.id||r.status!=='lobby'||r.players.length<2||r.players.some(p=>!p.ready))throw Error('The host can start when at least two players are ready.');
     const task=(async()=>{const game=games.find(g=>g.id===r.game_id),candidates=candidatesFor(game.id,r.difficulty);let questions=candidates.slice(0,game.rounds),curation='bank';if(game.rounds>1)try{const result=await curate(candidates,{topic:game.label,difficulty:r.difficulty,count:game.rounds});if(result){questions=result;curation='ai';}}catch{}
       return (await store.transaction(async ()=>{const current=(await read(id)),now=nowOverride??Date.now();if(current.host!==user.id||current.status!=='lobby'||current.players.length<2||current.players.some(p=>!p.ready)||now>=current.expires_at)throw Error('The lobby changed. Check everyone is ready and start again.');current.questions=questions;current.curation=curation;current.status='playing';current.starts_at=now+5000;current.ends_at=current.starts_at+game.seconds*1000;(await save(current));return (await publicRoom(current,user,now));}));
     })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
   },
   answer:async (id,user,data,now=Date.now())=>(await store.transaction(async ()=>{
     const r=(await read(id));(await settle(r,now));if(r.status!=='playing'||now<r.starts_at||now>=r.ends_at)throw Error('The round is not accepting answers.');const p=r.players.find(p=>p.id===user.id);if(!p||p.left)throw Error('Only active players can answer.');if(data.index!==p.index||p.index>=r.questions.length)throw Error('That answer has already been submitted.');const q=r.questions[p.index];if(q.type==='choice'&&(!Number.isInteger(data.answer)||data.answer<0||data.answer>=q.choices.length))throw Error('Choose an answer.');if(q.type==='chess'&&(typeof data.answer!=='string'||!/^[a-h][1-8][a-h][1-8]$/.test(data.answer)))throw Error('Choose a move.');p.score+=data.answer===q.answer?1:0;p.index++;(await save(r));(await settle(r,now));return (await publicRoom(r,user,now));
   })),
   tick:async (now=Date.now())=>(await store.transaction(async ()=>{let changed=false;for(const row of (await db.prepare("SELECT json FROM multiplayer_rooms WHERE json::jsonb->>'status' IN ('lobby','playing')").all())){if((await settle(JSON.parse(row.json),now)))changed=true;}return changed;}))
 };
}
