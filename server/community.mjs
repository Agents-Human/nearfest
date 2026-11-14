import {discoveryGames} from './game-catalog.mjs';
export function createCommunity(store){
 const {db}=store;db.exec('CREATE TABLE IF NOT EXISTS community_rooms(id TEXT PRIMARY KEY,json TEXT NOT NULL)');
 const read=id=>{const row=db.prepare('SELECT json FROM community_rooms WHERE id=?').get(id);if(!row)throw Error('This community room was not found.');return JSON.parse(row.json);};
 const save=r=>db.prepare('INSERT INTO community_rooms VALUES(?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,JSON.stringify(r));
 const decorate=r=>({...r,near:store.nearStatus?.(r.id),creator_name:store.user(r.creator)?.name||r.creator,members:r.members.map(m=>({...m,name:store.user(m.id)?.name||m.id})),claims:r.claims.map(c=>({...c,name:store.user(c.winner)?.name||c.winner})),pot:r.members.reduce((n,m)=>n+BigInt(m.amount),0n).toString(),chat_count:db.prepare('SELECT count(*) AS n FROM messages WHERE bet_id=?').get(r.id).n});
 function sync(id,chain,evidence){const r=read(id);r.members=chain.members.map(m=>({id:m.account_id,amount:m.amount}));r.status=chain.status==='settled'?'settled':chain.status;r.winner=chain.winners?.[0]||null;r.ends_at=chain.join_until;r.refund_at=chain.refund_at;r.payouts=chain.payouts;r.near=true;
  if(chain.claim){const c=chain.claim,previous=r.claims.find(x=>x.id===c.id);const next={revision:c.revision,id:c.id,winner:c.winner,evidence:(evidence?.id===c.id?evidence.evidence:null)||(previous?.evidence_hash===c.evidence_hash?previous.evidence:null)||'Evidence hash: '+c.evidence_hash,evidence_hash:c.evidence_hash,votes:Object.fromEntries(c.votes.map(v=>[v.account_id,v.approve])),status:c.status};if(previous)Object.assign(previous,next);else r.claims.push(next);}
  save(r);return decorate(r);
 }
 return {get:id=>decorate(read(id)),all:()=>db.prepare('SELECT json FROM community_rooms ORDER BY rowid DESC LIMIT 500').all().map(x=>JSON.parse(x.json)).filter(r=>r.mode==='testnet').map(decorate),sync,
 create:(d,u,now=Date.now(),funding)=>{if(u.kind!=='wallet'||!funding?.chain)throw Error('Create a community pot with your NEAR testnet wallet.');try{return decorate(read(funding.id));}catch{}
  const game=discoveryGames.find(g=>g.id===d.game_id);const r={id:funding.id,game_id:game?.id||null,game_title:game?.title||null,kind:funding.chain.kind,title:d.title,rules:d.rules,category:d.category,mode:'testnet',near:true,creator:u.id,entry:funding.chain.entry,max_members:funding.chain.max_members,members:[],claims:[],created_at:now,visibility:d.visibility==='invite'?'invite':'public',approval:'majority',stream:null};save(r);return sync(r.id,funding.chain);},
 action:()=>{throw Error('Community funding and approvals require a NEAR wallet transaction.');}};
}
