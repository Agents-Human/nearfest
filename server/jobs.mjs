// Restore unfinished work once at startup. Runtime dispatch always targets one ID.
export async function startJobs(store,{rooms,economy,faucet,managedAccounts,processBet,changed=()=>{}}){
 const {db,jobs}=store;
 const absent={ifAbsent:true};
 for(const [kind,table] of [['board','skill_rooms'],['quiz','multiplayer_rooms'],['arcade','arcade_rooms']]){
  for(const row of (await db.query("SELECT json FROM "+table+" WHERE json::jsonb->>'status' IN ('lobby','playing')")).rows)await jobs.scheduleRoom(kind,JSON.parse(row.json),absent);
 }
 for(const row of (await db.query("SELECT json FROM bets WHERE json::jsonb->>'status' IN ('open','matched','proposed','disputed')")).rows)await jobs.scheduleBet(JSON.parse(row.json),{restore:true});
 if(economy.enabled){
  for(const row of (await db.query('SELECT id FROM near_intents WHERE complete=0')).rows)await jobs.schedule('near-intent',row.id,Date.now(),{},absent);
  for(const row of (await db.query("SELECT json FROM near_rooms WHERE json::jsonb->>'status' NOT IN ('settled','refunded')")).rows){
   const room=JSON.parse(row.json);
   if(room.kind==='game'){
    const table=room.id.startsWith('arena-')?'arcade_rooms':room.id.startsWith('board-')?'skill_rooms':'multiplayer_rooms';
    const local=await db.prepare('SELECT json FROM '+table+' WHERE id=$1').get(room.id);
    if(local&&['finished','cancelled'].includes(JSON.parse(local.json).status)){await jobs.schedule('near-room',room.id,Date.now(),{},absent);continue;}
   }
   await jobs.scheduleNear(room,absent);
  }
 }
 if(faucet.enabled)for(const row of (await db.query("SELECT id FROM faucet_claims WHERE status='pending'")).rows)await jobs.schedule('faucet',row.id,Date.now(),{},absent);
 if(managedAccounts?.enabled)for(const row of (await db.query("SELECT id FROM managed_transactions WHERE status='pending'")).rows)await jobs.schedule('managed-transaction',row.id,Date.now(),{},absent);
 await jobs.schedule('sessions-cleanup','sessions',Date.now()+3600000,{},absent);
 await jobs.start({
  room:async data=>{if(await rooms[data.kind].expire(data.roomId))changed();},
  'near-intent':async data=>{if(await economy.recoverIntent(data.id))changed();},
  'near-room':async data=>{if(await economy.settleRoom(data.id))changed();},
  'managed-transaction':async data=>{if(await managedAccounts.recoverTransaction(data.id)){try{await economy.recoverIntent(data.id);}catch{}changed();}},
  faucet:async data=>{if(await faucet.recoverClaim(data.id))changed();},
  'bet-check':data=>processBet(data.id),
  'bet-timeout':data=>processBet(data.id),
  'sessions-cleanup':async()=>{
   await db.transaction(async()=>{const now=Date.now();await db.prepare('DELETE FROM sessions WHERE expires<$1').run(now);await db.prepare('DELETE FROM prepared WHERE expires<$1').run(now);await db.prepare('DELETE FROM wallet_auth_challenges WHERE expires<$1').run(now);await jobs.schedule('sessions-cleanup','sessions',now+3600000,{},absent);});
  },
 });
 return jobs;
}
