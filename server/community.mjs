import {discoveryGames} from './game-catalog.mjs';
import {randomUUID} from 'node:crypto';
import {amount,UNIT,shortText,moderate} from './domain.mjs';
function parseAmount(value){const n=amount(value);if(n<UNIT/100n||n>100n*UNIT)throw Error('Use 0.01–100 FUN per contribution.');return n;}
const categories=['Sports','Gaming','Life','Crypto','Facts','Science','Maths'];
export function createCommunity(store){
 const {db}=store;db.exec('CREATE TABLE IF NOT EXISTS community_rooms(id TEXT PRIMARY KEY,json TEXT NOT NULL)');
 const get=id=>{const row=db.prepare('SELECT json FROM community_rooms WHERE id=?').get(id);if(!row)throw Error('This club room was not found.');return JSON.parse(row.json);};
 const save=r=>db.prepare('INSERT INTO community_rooms VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,JSON.stringify(r));
 const credit=(id,n)=>{const u=store.user(id);if(!u)throw Error('Player not found.');db.prepare('UPDATE users SET credit=? WHERE id=?').run((BigInt(u.credit)+BigInt(n)).toString(),id);};
 const debit=(id,n)=>{const u=store.user(id);if(!u||u.kind!=='practice'||BigInt(u.balance)<BigInt(n))throw Error('Not enough FUN.');db.prepare('UPDATE users SET balance=? WHERE id=?').run((BigInt(u.balance)-BigInt(n)).toString(),id);};
 function decorate(r){return {...r,members:r.members.map(m=>({...m,name:store.user(m.id)?.name||m.id})),claims:r.claims.map(c=>({...c,name:store.user(c.winner)?.name||c.winner})),creator_name:store.user(r.creator)?.name||r.creator,pot:r.members.reduce((n,m)=>n+BigInt(m.amount),0n).toString(),chat_count:db.prepare('SELECT count(*) AS n FROM messages WHERE bet_id=?').get(r.id).n};}
 function create(data,user,now=Date.now()){
  if(user.kind!=='practice')throw Error('Use FUN for pooled rooms until a community treasury is connected.');
  const kind=data.kind;if(!['pot','bounty'].includes(kind))throw Error('Choose a group pot or bounty.');
  const title=shortText(data.title,8,90,'Title'),rules=shortText(data.rules,30,1200,'Rules');moderate(title+' '+rules);
  if(!categories.includes(data.category))throw Error('Choose a category.');
  const entry=parseAmount(String(data.amount)),max=Number(data.max_members||8),hours=Number(data.hours||24);
  if(!Number.isInteger(max)||max<2||max>30||!Number.isFinite(hours)||hours<1||hours>720)throw Error('Use 2–30 participants and a deadline within 30 days.');
  const game=data.game_id?discoveryGames.find(g=>g.id===data.game_id):null;if(data.game_id&&!game)throw Error('Choose a game from the library.');
  const room={game_id:game?.id||null,game_title:game?.title||null,id:'club-'+randomUUID(),kind,title,rules,category:data.category,mode:'practice',creator:user.id,status:'open',entry:entry.toString(),max_members:max,members:[{id:user.id,amount:entry.toString(),joined_at:now}],claims:[],created_at:now,ends_at:now+hours*3600000,refund_at:now+(hours+48)*3600000,winner:null,settled_at:null,visibility:data.visibility==='invite'?'invite':'public',approval:'majority',stream:null};
  return store.transaction(()=>{debit(user.id,entry);save(room);return decorate(room);});
 }
 function action(id,user,data,now=Date.now()){return store.transaction(()=>{
  if(user.kind!=='practice')throw Error('This room uses practice FUN.');const r=get(id),member=r.members.find(m=>m.id===user.id);
  if(['settled','refunded','cancelled'].includes(r.status))throw Error('This pot has already closed.');
  const refund=()=>{for(const m of r.members)credit(m.id,m.amount);r.status='refunded';r.settled_at=now;};
  switch(data.type){
   case 'join':if(r.kind!=='pot'||r.status!=='open'||now>=r.ends_at||member||r.members.length>=r.max_members)throw Error('This pot cannot accept another entry.');debit(user.id,r.entry);r.members.push({id:user.id,amount:r.entry,joined_at:now});break;
   case 'fund':{if(r.kind!=='bounty'||r.status!=='open'||now>=r.ends_at||r.claims.length)throw Error('Funding closes when a claim is submitted.');if(!member&&r.members.length>=30)throw Error('This bounty has reached its backer limit.');const n=parseAmount(String(data.amount));debit(user.id,n);if(member)member.amount=(BigInt(member.amount)+n).toString();else r.members.push({id:user.id,amount:n.toString(),joined_at:now});break;}
   case 'start':if(r.creator!==user.id||r.kind!=='pot'||r.status!=='open'||r.members.length<2)throw Error('The host can start once at least two people have joined.');r.status='active';r.started_at=now;break;
   case 'claim':{if(now>=r.refund_at)throw Error('The refund deadline has passed.');if(r.kind==='pot'&&(!member||r.members.length<2||(r.status==='open'&&now<r.ends_at)))throw Error('Start the group challenge before proposing its winner.');if(r.kind==='bounty'&&now>=r.ends_at)throw Error('The claim deadline has passed.');const winner=r.kind==='bounty'?user.id:String(data.winner);if(r.kind==='pot'&&!r.members.some(m=>m.id===winner))throw Error('The winner must be a participant.');if(r.claims.some(c=>c.winner===winner&&c.status==='review'))throw Error('That result is already under review.');const evidence=shortText(data.evidence,15,1000,'Result evidence');moderate(evidence);if(!r.members.some(m=>m.id!==winner))throw Error('At least one independent contributor must review a claim.');r.status='review';r.claims.push({id:randomUUID(),winner,evidence,votes:{},status:'review',created_at:now});break;}
   case 'vote':{if(now>=r.refund_at)throw Error('The review period has expired; refund the contributions.');if(!member)throw Error('Only the people funding this pot can approve payouts.');const claim=r.claims.find(c=>c.id===data.claim_id&&c.status==='review');if(!claim)throw Error('This claim is no longer under review.');if(claim.winner===user.id)throw Error('You cannot approve your own payout.');if(typeof data.approve!=='boolean')throw Error('Choose approve or reject.');claim.votes[user.id]=data.approve;const reviewers=r.members.filter(m=>m.id!==claim.winner),required=Math.floor(reviewers.length/2)+1,yes=Object.values(claim.votes).filter(Boolean).length,no=Object.values(claim.votes).filter(v=>v===false).length;if(yes>=required){const total=r.members.reduce((n,m)=>n+BigInt(m.amount),0n);credit(claim.winner,total);claim.status='approved';r.winner=claim.winner;r.status='settled';r.settled_at=now;r.claims.filter(c=>c.id!==claim.id).forEach(c=>{c.status='superseded';});}else if(no>=required){claim.status='rejected';if(!r.claims.some(c=>c.status==='review'))r.status=r.kind==='pot'?'active':'open';}break;}
   case 'cancel':if(r.creator!==user.id||r.status!=='open'||r.claims.length)throw Error('Only the host can cancel before play or claim review starts.');refund();r.status='cancelled';break;
   case 'refund':if(now<r.refund_at)throw Error('Refunds unlock 48 hours after the deadline.');refund();break;
   default:throw Error('Unknown club action.');
  }
  save(r);return decorate(r);
 });}
 return {get:id=>decorate(get(id)),all:()=>db.prepare('SELECT json FROM community_rooms ORDER BY rowid DESC LIMIT 500').all().map(r=>decorate(JSON.parse(r.json))),create,action};
}
