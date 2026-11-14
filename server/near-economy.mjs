import {RACE_SECONDS,DEFAULT_RACE_SECONDS} from './arcade/race-course.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {amount,UNIT,shortText,moderate} from './domain.mjs';
import {publishedGame} from './game-catalog.mjs';
import {arcadeGame} from './arcade/catalog.mjs';
import {platformCharacter,platformSettings} from '../shared/platform-options.mjs';
import {getSkillGame} from './skill/engines.mjs';
import * as near from './near.mjs';
export const ROOM_STORAGE=10n**23n,JOIN_STORAGE=10n**22n;
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const member=(r,id)=>r?.members.find(m=>m.account_id===id);
const terminal=r=>['settled','refunded'].includes(r?.status);
export function createNearEconomy(store,{chain=near,services}={}){
 const {db}=store,confirming=new Map(),reconciling=new Map();let processing=false,recovering=false,recoveryCursor=0,revision=0;
 db.exec(`CREATE TABLE IF NOT EXISTS near_rooms(id TEXT PRIMARY KEY,kind TEXT NOT NULL,json TEXT NOT NULL,updated INTEGER NOT NULL,error TEXT);CREATE TABLE IF NOT EXISTS near_intents(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,json TEXT NOT NULL,complete INTEGER NOT NULL DEFAULT 0,result TEXT,created INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS near_payouts(room_id TEXT NOT NULL,user_id TEXT NOT NULL,amount TEXT NOT NULL,kind TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(room_id,user_id));`);
 const cached=id=>{const r=db.prepare('SELECT * FROM near_rooms WHERE id=?').get(id);return r?{...JSON.parse(r.json),error:r.error}:null;};
 function rememberPayouts(r,created){if(terminal(r))for(const payout of r.payouts||[])if(BigInt(payout.amount)>0n)db.prepare('INSERT OR IGNORE INTO near_payouts(room_id,user_id,amount,kind,created) VALUES(?,?,?,?,?)').run(r.id,payout.account_id,payout.amount,r.status==='refunded'?'refund':'reward',created);}
 for(const row of db.prepare('SELECT json,updated FROM near_rooms').all())rememberPayouts(JSON.parse(row.json),row.updated);
 const save=(r,kind)=>{const json=JSON.stringify(r),previous=db.prepare('SELECT json,error FROM near_rooms WHERE id=?').get(r.id);db.prepare('INSERT INTO near_rooms(id,kind,json,updated,error) VALUES(?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET json=excluded.json,updated=excluded.updated,error=NULL').run(r.id,kind,json,Date.now());rememberPayouts(r,Date.now());if(previous?.json!==json||previous?.error){revision++;services.changed?.(r.id);}};
 store.nearStatus=id=>{const r=cached(id);let missing=[];if(r?.kind==='game'){const table=id.startsWith('arena-')?'arcade_rooms':id.startsWith('board-')?'skill_rooms':'multiplayer_rooms';const local=db.prepare(`SELECT json FROM ${table} WHERE id=?`).get(id);if(local){const players=JSON.parse(local.json).players;missing=r.members.filter(m=>!players.some(p=>p.id===m.account_id)).map(m=>m.account_id);}}return r?{unconfirmed_members:missing,network:'testnet',contract_id:chain.contractId,status:r.status,error:r.error||null,refund_at:r.refund_at,entry:r.entry,storage_fee:ROOM_STORAGE.toString(),evidence_hash:r.evidence_hash,explorer:`https://testnet.nearblocks.io/address/${chain.contractId}`} :null;};
 store.reserveNear=(id,account,n)=>{if(BigInt(n)===0n)return;const r=cached(id),u=store.user(account);if(u?.kind!=='wallet'||!r||r.status!=='open'||BigInt(member(r,account)?.amount||0)<BigInt(n))throw Error('Confirm your NEAR testnet deposit in your wallet first.');};
 const requireWallet=u=>{if(u?.kind!=='wallet')throw Error('Connect your NEAR testnet wallet to play for stakes.');if(!chain.contractId||!chain.oracleReady)throw Error('NEAR testnet escrow is not connected yet.');};
 async function checkBalance(u,deposit){if(BigInt(await chain.balance(u.id))<deposit)throw Error('Your wallet balance cannot cover this stake and the required contract storage.');}
 async function load(id,kind){const r=await chain.view('get_room',{id});if(!r)throw Error('NEAR escrow not found. The wallet transaction may still be confirming.');save(r,kind);return r;}
 function intent(u,operation,id,kind,data,args,method,deposit='0',extra={}){
  const existing=db.prepare('SELECT id,json FROM near_intents WHERE user_id=? AND complete=0 ORDER BY created DESC LIMIT 30').all(u.id).find(x=>{const p=JSON.parse(x.json);return p.id===id&&p.operation===operation&&p.method===method&&JSON.stringify(p.data)===JSON.stringify(data);});
  if(existing)return {resume:true,intent_id:existing.id,transaction:{...chain.transaction(method,JSON.parse(existing.json).args,JSON.parse(existing.json).deposit),signerId:u.id}};
  const iid=randomUUID(),p={operation,id,kind,data,args,method,deposit,...extra};db.prepare('INSERT INTO near_intents(id,user_id,json,created) VALUES(?,?,?,?)').run(iid,u.id,JSON.stringify(p),Date.now());return {intent_id:iid,transaction:{...chain.transaction(method,args,deposit),signerId:u.id}};
 }
 function pendingCreations(u){return db.prepare('SELECT id,json FROM near_intents WHERE user_id=? AND complete=0 ORDER BY created DESC').all(u.id).filter(row=>JSON.parse(row.json).operation==='create');}
 function creationTerms(kind,d){
  if(kind==='game')return JSON.stringify({game_id:d.game_id,entry:amount(String(d.entry)).toString(),max_players:Number(d.max_players),visibility:d.visibility==='invite'?'invite':'public',difficulty:d.difficulty==='brainy'?'brainy':'mixed',race_seconds:d.game_id==='pocket-racers'?Number(d.race_seconds??DEFAULT_RACE_SECONDS):null,settings:d.game_id==='platform-relay'?platformSettings(d.settings):null});
  return JSON.stringify({kind,title:d.title,rules:d.rules,category:d.category,amount:amount(String(d.amount)).toString(),max_members:Number(d.max_members),hours:Number(d.hours||24),visibility:d.visibility==='invite'?'invite':'public',game_id:d.game_id||null});
 }
 async function resumeCreation(rows,kind,data,u){
  const matching=new Set(rows.filter(row=>{const p=JSON.parse(row.json);return p.kind===kind&&creationTerms(kind,p.data)===creationTerms(kind,data);}).map(row=>row.id));
  const checked=await reconcile(u),ready=checked.recovered.find(item=>matching.has(item.intent_id));
  if(ready)return ready.room;
  if(checked.recovered.some(item=>item.operation==='create_room'))throw Error('Your previous room is ready in My rooms. Open it to continue.');
  rows=pendingCreations(u);if(!rows.length)return null;
  const matches=rows.filter(row=>{const p=JSON.parse(row.json);return p.kind===kind&&creationTerms(kind,p.data)===creationTerms(kind,data);});
  if(!matches.length)throw Error('A different room payment is still pending. Continue it from Wallet → Activity, or wait for it to expire.');
  for(const row of matches){const p=JSON.parse(row.json),remote=await chain.view('get_room',{id:p.id});if(remote)return confirm(row.id,u);}
  const existing=matches.find(row=>JSON.parse(row.json).args.join_until>Date.now());
  if(existing){const p=JSON.parse(existing.json);return {intent_id:existing.id,transaction:{...chain.transaction(p.method,p.args,p.deposit),signerId:u.id}};}
  throw Error('That wallet request has expired. It will clear automatically after the final network check. Try again shortly.');
 }
 async function create(kind,d,u){
  requireWallet(u);const now=Date.now(),data={...d};delete data._funding;delete data._id;

  let entry,max,id,join,refund;
  if(kind==='game'){
   const g=publishedGame(d.game_id),a=arcadeGame(d.game_id),b=getSkillGame(d.game_id);if(!g||!g.multiplayer||d.solo)throw Error('Choose a multiplayer room to play for stakes.');
   if(a&&db.prepare('SELECT json FROM arcade_rooms').all().some(x=>{const r=JSON.parse(x.json);return !['finished','cancelled'].includes(r.status)&&r.players.some(p=>p.id===u.id&&!p.left);}))throw Error('Finish or end your current game before funding another.');
   entry=amount(String(d.entry));max=b?2:Number(d.max_players??a?.max_players??8);if(!Number.isInteger(max)||max<(a?.min_players??2)||max>(b?2:a?.max_players??16))throw Error('Choose a supported room size.');
   if(d.game_id==='pocket-racers'){data.race_seconds=Number(d.race_seconds??DEFAULT_RACE_SECONDS);if(!RACE_SECONDS.includes(data.race_seconds))throw Error('Choose a race duration of 1, 2, 3, 5 or 10 minutes.');}
   if(d.game_id==='platform-relay'){data.settings=platformSettings(d.settings);data.character=platformCharacter(d.character);}
   data.max_players=max;id=(a?'arena-':b?'board-':'party-')+randomUUID();join=now+1800000;refund=join+3600000;
  }else{
   data.title=shortText(d.title,8,90,'Title');data.rules=shortText(d.rules,30,1200,'Rules');moderate(data.title+' '+data.rules);if(!['Sports','Gaming','Life','Crypto','Facts','Science','Maths'].includes(d.category))throw Error('Choose a category.');
   if(!['pot','bounty'].includes(kind))throw Error('Choose a group pot or bounty.');if(d.game_id&&!publishedGame(d.game_id))throw Error('Choose an available game.');entry=amount(String(d.amount));max=kind==='bounty'?30:Number(d.max_members||8);const hours=Number(d.hours||24);if(!Number.isInteger(max)||max<2||max>30||!Number.isFinite(hours)||hours<1||hours>720)throw Error('Choose 2–30 people and a deadline within 30 days.');data.max_members=max;id='club-'+randomUUID();join=now+hours*3600000;refund=join+172800000;
  }
  if(entry<=0n)throw Error('Enter a stake greater than zero.');
  const previous=pendingCreations(u);if(previous.length){const resumed=await resumeCreation(previous,kind,data,u);if(resumed)return resumed;}
  await checkBalance(u,entry+ROOM_STORAGE);
  // No await between this final lookup and inserting the intent: two tabs cannot prepare two deposits.
  const concurrent=pendingCreations(u);if(concurrent.length)return resumeCreation(concurrent,kind,data,u);
  const args={id,kind,entry:entry.toString(),max_members:max,join_until:join,refund_at:refund,terms_hash:digest(data)};
  return intent(u,'create',id,kind,data,args,'create_room',(entry+ROOM_STORAGE).toString());
 }
 async function action(kind,id,operation,data,u,key){
  if(operation!=='start'&&!['join','fund','leave','cancel','refund','claim','vote','remove-player'].includes(data.type))return null;
  const local=kind==='game'?services.get(id,u,key):services.community.get(id);if(BigInt(local.entry)===0n)return null;requireWallet(u);const r=await load(id,kind),d={...data};let method,args={id},deposit='0';
  if(operation==='start'){
   if(local.host!==u.id&&local.creator!==u.id)throw Error('Only the host can start.');if(kind==='game'&&(local.status!=='lobby'||local.players.length<(local.min_players||2)||local.players.some(p=>!p.ready)))throw Error('Everyone must join and get ready before the host starts.');
   if(kind==='game'&&['maths-tug','clue-crew'].includes(local.game_id)&&local.players.length%2)throw Error('Use an even number of players for equal teams before funding the start.');
   const participants=kind==='game'?local.players.map(p=>p.id):local.members.map(m=>m.id);if(kind==='game'&&r.members.some(m=>!participants.includes(m.account_id)))throw Error('An on-chain deposit has not joined this game. Refund the unconfirmed player below, then start again.');method='start_room';args.participants=participants;
  }else if(['join','fund'].includes(d.type)){
   if(r.status!=='open')throw Error('Funding is closed.');if(kind==='game'&&arcadeGame(local.game_id)&&db.prepare('SELECT json FROM arcade_rooms').all().some(x=>{const other=JSON.parse(x.json);return other.id!==id&&!['finished','cancelled'].includes(other.status)&&other.players.some(p=>p.id===u.id&&!p.left);}))throw Error('Finish or end your current game before funding another.');if(d.type==='join'&&member(r,u.id)){if(kind==='game')return services.action(id,u,d,key);services.community.sync(id,r);return services.community.get(id);}
   method='contribute_room';deposit=d.type==='fund'?amount(String(d.amount)).toString():r.entry;if(BigInt(deposit)<=0n)throw Error('Enter a contribution greater than zero.');
  }else if(d.type==='remove-player'){if(kind!=='game'||local.host!==u.id||local.players.some(p=>p.id===d.account_id))throw Error('Only the host can refund an unconfirmed player.');method='remove_player';args.account_id=d.account_id;}
  else if(d.type==='leave')method='leave_room';
  else if(d.type==='cancel')method='cancel_room';
  else if(d.type==='refund')method='refund_room';
  else if(d.type==='claim'){if(kind==='game')throw Error('Games use verified scores.');d.evidence=shortText(d.evidence,15,1000,'Evidence');moderate(d.evidence);method='claim_room';args={id,claim_id:randomUUID(),winner:kind==='bounty'?u.id:String(d.winner),evidence_hash:digest(d.evidence)};}
  else if(d.type==='vote'){if(typeof d.approve!=='boolean')throw Error('Choose approve or reject.');method='vote_room';if(r.claim?.id!==d.claim_id||r.claim.revision!==d.claim_revision)throw Error('The claim changed. Refresh and review it before voting.');args={id,claim_id:d.claim_id,claim_revision:d.claim_revision,approve:d.approve};}
  else return null;
  if(BigInt(deposit)>0n)await checkBalance(u,BigInt(deposit)+JOIN_STORAGE);
  const contribution=deposit;if(method==='contribute_room'){args.request_id=randomUUID();args.amount=contribution;deposit=(BigInt(contribution)+JOIN_STORAGE).toString();}
  return intent(u,operation,id,kind,d,args,method,deposit,{contribution,key,prior_amount:member(r,u.id)?.amount||'0'});
 }
 function confirm(iid,u){
  const key=u.id+':'+iid;if(confirming.has(key))return confirming.get(key);
  const task=confirmOnce(iid,u).finally(()=>confirming.delete(key));confirming.set(key,task);return task;
 }
 async function confirmOnce(iid,u){
  const row=db.prepare('SELECT * FROM near_intents WHERE id=? AND user_id=?').get(iid,u.id);if(!row)throw Error('Pending NEAR transaction not found for this wallet.');const p=JSON.parse(row.json);
  if(row.complete){const result=JSON.parse(row.result||'null');return result?.cancelled?result:p.kind==='game'?services.get(p.id,u,p.key):services.community.get(p.id);}
  const r=await load(p.id,p.kind),a=p.args;
  const verified=p.method==='create_room'?r.host===u.id&&BigInt(member(r,u.id)?.amount||0)===BigInt(a.entry)&&['kind','entry','max_members','join_until','refund_at','terms_hash'].every(k=>r[k]===a[k]):p.method==='contribute_room'?BigInt(member(r,u.id)?.amount||0)>=BigInt(p.prior_amount)+BigInt(p.contribution):p.method==='remove_player'?!member(r,a.account_id):p.method==='leave_room'?!member(r,u.id):p.method==='start_room'?r.status==='active'&&JSON.stringify(r.members.map(m=>m.account_id).sort())===JSON.stringify([...a.participants].sort()):['cancel_room','refund_room'].includes(p.method)?r.status==='refunded':p.method==='claim_room'?r.claim?.id===a.claim_id&&r.claim.evidence_hash===a.evidence_hash&&r.claim.winner===a.winner:p.method==='vote_room'?r.claim?.id===a.claim_id&&r.claim.revision===a.claim_revision&&r.claim.votes.some(v=>v.account_id===u.id&&v.approve===a.approve):false;
  if(p.method==='contribute_room'&&!await chain.view('get_funding_receipt',{id:p.id,account_id:u.id,request_id:a.request_id}))throw Error('NEAR has not confirmed this contribution receipt.');
  if(!verified)throw Error('Your NEAR transaction has not been confirmed yet. Check your wallet, then recover it from your account.');
  let result;
  if(p.operation==='abandon'){db.prepare('UPDATE near_intents SET complete=1,result=? WHERE id=?').run(JSON.stringify({id:p.id,cancelled:true}),p.original_intent);try{if(p.kind==='game')services.action(p.id,u,{type:p.method==='leave_room'?'leave':'chain-refund'},p.key);else services.community.sync(p.id,r);}catch{}result={id:p.id,cancelled:true};}
  else if(p.kind==='game'){
   if(p.operation==='create'){try{result=services.get(p.id,u,p.key);}catch{result=services.create(p.data,u,{id:p.id,expires_at:r.join_until});}}
   else if(p.method==='remove_player'){result=services.get(p.id,u,p.key);}
   else if(p.operation==='start'){const local=services.get(p.id,u,p.key);result=local.status==='lobby'?await services.start(p.id,u,p.key):local;}
   else {const local=services.get(p.id,u,p.key);if(terminal(r)&&['cancelled','finished'].includes(local.status))result=local;else result=services.action(p.id,u,p.method==='refund_room'?{type:'chain-refund'}:p.data,p.key);}
  }else{
   if(p.operation==='create')services.community.create(p.data,u,Date.now(),{id:p.id,chain:r});
   services.community.sync(p.id,r,p.method==='claim_room'?{...p.data,id:a.claim_id}:null);result=services.community.get(p.id);
  }
  db.prepare('UPDATE near_intents SET complete=1,result=? WHERE id=?').run(JSON.stringify(result),iid);return result;
 }
 async function abandon(iid,u){requireWallet(u);const row=db.prepare('SELECT * FROM near_intents WHERE id=? AND user_id=? AND complete=0').get(iid,u.id);if(!row)throw Error('Pending action not found.');const p=JSON.parse(row.json),r=await chain.view('get_room',{id:p.id});
  if(!r&&p.method==='create_room'&&Date.now()<p.args.join_until+60000)throw Error('This wallet request can still confirm. Retry the same room, or wait until its request expires before cancelling.');
  if(!r||!member(r,u.id)||terminal(r)){const result={cancelled:true,...(!r?{expired:true}:{})};db.prepare('UPDATE near_intents SET complete=1,result=? WHERE id=?').run(JSON.stringify(result),iid);return result;}
  let method;if(Date.now()>=r.refund_at)method='refund_room';else if(r.status==='open'&&!r.claim)method=r.host===u.id?'cancel_room':r.kind!=='bounty'?'leave_room':null;
  if(!method)throw Error('This pot is in progress. Recover it to continue, or claim the refund after its on-chain deadline.');
  return intent(u,'abandon',p.id,p.kind,{}, {id:p.id},method,'0',{original_intent:iid,key:p.key});
 }
 function pending(u){
  return db.prepare('SELECT id,json,created FROM near_intents WHERE user_id=? AND complete=0 ORDER BY created DESC LIMIT 20').all(u.id).map(row=>{
   const p=JSON.parse(row.json);
   return {intent_id:row.id,room_id:p.id,operation:p.method,game_id:p.data?.game_id,title:publishedGame(p.data?.game_id)?.title||p.data?.title||'Room payment',entry:p.data?.entry,amount:p.deposit,created_at:row.created,expires_at:p.method==='create_room'?p.args.join_until:null,status:'checking'};
  });
 }
 function history(u){
  const entries=db.prepare('SELECT id,json,result,created FROM near_intents WHERE user_id=? AND complete=1 ORDER BY created DESC LIMIT 30').all(u.id).map(row=>{
   const p=JSON.parse(row.json),result=JSON.parse(row.result||'null');
   let title=publishedGame(p.data?.game_id)?.title||p.data?.title;
   if(!title)try{title=(p.kind==='game'?services.get(p.id,u,p.key):services.community.get(p.id)).title;}catch{}
   return {id:row.id,room_id:p.id,title:title||'Room payment',operation:p.method,amount:result?.expired?'0':p.deposit,created_at:row.created,status:result?.expired?'expired':!result||result.cancelled?'cancelled':'confirmed'};
  });
  for(const row of db.prepare('SELECT * FROM near_payouts WHERE user_id=? ORDER BY created DESC LIMIT 30').all(u.id)){
   let title;try{title=(cached(row.room_id)?.kind==='game'?services.get(row.room_id,u):services.community.get(row.room_id)).title;}catch{}
   entries.push({id:'payout:'+row.room_id+':'+u.id,room_id:row.room_id,title:title||'Room result',operation:row.kind,amount:row.amount,created_at:row.created,status:'confirmed'});
  }
  return entries.sort((a,b)=>b.created_at-a.created_at).slice(0,30);
 }
 function reconcile(u){
  if(u?.kind!=='wallet')return Promise.resolve({pending:[],recovered:[],expired:[]});
  if(reconciling.has(u.id))return reconciling.get(u.id);
  const task=reconcileOnce(u).finally(()=>reconciling.delete(u.id));reconciling.set(u.id,task);return task;
 }
 async function reconcileOnce(u){
  const recovered=[],expired=[],states=new Map();
  for(const row of db.prepare('SELECT id,json FROM near_intents WHERE user_id=? AND complete=0 ORDER BY created DESC LIMIT 20').all(u.id)){
   const p=JSON.parse(row.json);
   try{
    const remote=await chain.view('get_room',{id:p.id});
    if(!remote){
     // Only a finalized absence after the signing deadline makes an unsigned creation safe to retire.
     if(p.method==='create_room'&&Date.now()>=p.args.join_until+60000){db.prepare('UPDATE near_intents SET complete=1,result=? WHERE id=? AND complete=0').run(JSON.stringify({cancelled:true,expired:true}),row.id);expired.push(row.id);}
     else states.set(row.id,'awaiting_wallet');
     continue;
    }
    try{const room=await confirm(row.id,u);recovered.push({intent_id:row.id,operation:p.method,room});}
    catch{
     // A join is resumable only after a successful read proves its unique receipt is absent.
     if(p.method==='contribute_room'&&remote.status==='open'&&!await chain.view('get_funding_receipt',{id:p.id,account_id:u.id,request_id:p.args.request_id}))states.set(row.id,'awaiting_wallet');
     else states.set(row.id,'checking');
    }
   }catch{states.set(row.id,'unavailable');}
  }
  return {pending:pending(u).map(p=>({...p,status:states.get(p.intent_id)||'checking'})),recovered,expired};
 }
 async function recoverPending(){
  if(recovering||!chain.contractId)return false;recovering=true;
  try{
   const accounts=db.prepare("SELECT DISTINCT u.* FROM users u JOIN near_intents i ON i.user_id=u.id WHERE i.complete=0 AND u.kind='wallet' ORDER BY u.id").all();
   let changed=false;
   for(let i=0;i<Math.min(5,accounts.length);i++){
    const u=accounts[(recoveryCursor+i)%accounts.length],result=await reconcile(u);
    changed=changed||result.recovered.length>0||result.expired.length>0;
   }
   recoveryCursor=accounts.length?(recoveryCursor+5)%accounts.length:0;return changed;
  }finally{recovering=false;}
 }
 async function retry(iid,u){
  requireWallet(u);
  const row=db.prepare('SELECT * FROM near_intents WHERE id=? AND user_id=?').get(iid,u.id);if(!row)throw Error('This payment belongs to a different wallet.');
  if(row.complete)return confirm(iid,u);
  const p=JSON.parse(row.json);
  const remote=await chain.view('get_room',{id:p.id});
  if(remote){
   try{return await confirm(iid,u);}catch(error){
    // Receipt lookup must succeed before a contribution may be retried with the SAME receipt ID.
    if(p.method!=='contribute_room'||await chain.view('get_funding_receipt',{id:p.id,account_id:u.id,request_id:p.args.request_id}))throw error;
   }
  }
  if(p.method==='create_room'&&Date.now()>=p.args.join_until)throw Error('This room request has expired. We’re clearing it automatically.');
  return {intent_id:iid,transaction:{...chain.transaction(p.method,p.args,p.deposit),signerId:u.id}};
 }
 async function tick(){if(processing||!chain.oracleReady)return false;processing=true;const previousRevision=revision;try{
  for(const row of db.prepare('SELECT * FROM near_rooms').all()){
   const previous=JSON.parse(row.json);if(terminal(previous))continue;
   try{
    if(row.kind!=='game'){services.community.sync(row.id,await load(row.id,row.kind));continue;}
    let local;try{local=services.get(row.id,{id:previous.host});}catch{continue;}
    if(!['finished','cancelled'].includes(local.status))continue;
    let r=await load(row.id,'game');if(!terminal(r)){
     if(local.status==='cancelled'||r.status==='open')await chain.oracleCall('cancel_room',{id:row.id});
     else{const winners=local.players.filter(p=>BigInt(p.payout||'0')>0n).map(p=>p.id);const refund=winners.length===local.players.length&&local.players.every(p=>p.payout===local.entry);await chain.oracleCall('settle_game',{id:row.id,winners:refund?[]:winners,evidence_hash:digest({id:row.id,game:local.game_id,players:local.players.map(p=>({id:p.id,score:p.score,payout:p.payout})),reason:local.reason||'',results:local.results||[]})});}
     await load(row.id,'game');
    }
   }catch(e){const message=String(e.message).slice(0,300);db.prepare('UPDATE near_rooms SET error=? WHERE id=?').run(message,row.id);if(message!==row.error){revision++;services.changed?.(row.id);}}
  }
 }finally{processing=false;}return revision!==previousRevision;}
 return {create,action,confirm,abandon,tick,cached,pending,history,reconcile,recoverPending,retry,load};
}
