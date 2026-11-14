import {PgBoss} from 'pg-boss';
import {createHash} from 'node:crypto';

const QUEUE='maintenance';
export function roomDeadline(kind,room){
 if(room.status==='lobby')return room.expires_at;
 if(room.status!=='playing')return null;
 if(kind==='quiz')return room.ends_at;
 if(kind==='board')return Math.max(room.starts_at,room.clock_at)+room.clocks[room.board.turn];
 return null;
}

export async function createJobQueue(store,{pollingIntervalSeconds=1,onError=error=>console.error('Job queue:',error.message)}={}){
 const {db}=store,namespace=db.namespace;
 const schema=namespace.length<=57?namespace+'_jobs':namespace.slice(0,48)+'_'+createHash('sha256').update(namespace).digest('hex').slice(0,8)+'_jobs';
 // Use the app pool. No extra pool or dedicated LISTEN connection is opened.
 const boss=new PgBoss({schema,db:{executeSql:(sql,values)=>db.query(sql,values)},schedule:false,registerInstance:false,superviseIntervalSeconds:60,maintenanceIntervalSeconds:3600,queueCacheIntervalSeconds:60,monitorIntervalSeconds:60,openTelemetry:{enabled:false}});
 boss.on('error',onError);boss.on('warning',warning=>console.warn('Job queue:',warning.message));
 try{
  await boss.start();
  await boss.createQueue(QUEUE,{policy:'stately',retryLimit:20,retryDelay:5,retryBackoff:true,retryDelayMax:300,expireInSeconds:120,deleteAfterSeconds:86400,retentionSeconds:604800});
 }catch(error){await boss.stop({close:false});throw error;}
 let worker=null,stopped=false;
 async function schedule(type,id,at=Date.now(),extra={},options={}){
  if(!Number.isFinite(at))throw Error('A finite job deadline is required.');
  if(stopped)throw Error('Job queue is stopping.');
  const data={version:1,type,id,...extra},key=type+':'+id;
  return db.transaction(async()=>{
   if(options.ifAbsent)return boss.send(QUEUE,data,{singletonKey:key,startAfter:new Date(at)});
   const result=await boss.upsert(QUEUE,data,{singletonKey:key,startAfter:new Date(at)});
   return result.jobs[0]||null;
  });
 }
 const jobs={boss,schema,schedule,
  async scheduleRoom(kind,room){
   const due=roomDeadline(kind,room);
   if(due!==null)await schedule('room',kind+':'+room.id,due,{kind,roomId:room.id});
   if(['finished','cancelled'].includes(room.status)&&room.near)await schedule('near-room',room.id);
  },
  async scheduleNear(room){
   if(['settled','refunded'].includes(room.status))return;
   const at=room.kind==='game'?room.refund_at:Date.now()+60000;
   if(Number.isFinite(at))await schedule('near-room',room.id,Math.max(Date.now(),at));
  },
  async scheduleBet(bet){
   if(['settled','refunded','cancelled'].includes(bet.status))return;
   const now=Date.now(),timeout=bet.status==='open'?bet.join_before:bet.resolve_until;
   if(Number.isFinite(timeout)&&timeout>now)await schedule('bet-timeout',bet.id,timeout);
   const due=bet.status==='matched'&&bet.resolver!=='players'?bet.ends_at:bet.status==='proposed'?bet.challenge_until:null;
   if(Number.isFinite(due)&&due>now)await schedule('bet-check',bet.id,due);
  },
  async start(handlers){
   if(worker)return;
   worker=await boss.work(QUEUE,{batchSize:1,localConcurrency:1,pollingIntervalSeconds},async entries=>{
    for(const job of entries){
     const handler=handlers[job.data.type];
     if(job.data.version!==1||!handler)throw Error('Unsupported job: '+job.data.type);
     // No DB transaction is held while handlers wait for external RPCs.
     await handler(job.data,job);
    }
   });
  },
  async stop(){stopped=true;await boss.stop({graceful:true,timeout:10000,close:false});},
 };
 store.jobs=jobs;return jobs;
}
