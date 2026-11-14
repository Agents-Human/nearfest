import {PgBoss} from 'pg-boss';
import {createHash} from 'node:crypto';

const QUEUE='maintenance',ROOM_QUEUE='room-deadlines';
const queueFor=type=>type==='room'?ROOM_QUEUE:QUEUE;
export function roomDeadline(kind,room){
 if(room.status==='lobby')return room.expires_at;
 if(room.status!=='playing')return null;
 if(kind==='quiz')return room.ends_at;
 if(kind==='board')return Math.max(room.starts_at,room.clock_at)+room.clocks[room.board.turn];
 return null;
}

export async function createJobQueue(store,{pollingIntervalSeconds=1,paymentPollingIntervalSeconds=5,onError=error=>console.error('Job queue:',error.message)}={}){
 const {db}=store,namespace=db.namespace;
 const schema=namespace.length<=57?namespace+'_jobs':namespace.slice(0,48)+'_'+createHash('sha256').update(namespace).digest('hex').slice(0,8)+'_jobs';
 // Use the app pool. No extra pool or dedicated LISTEN connection is opened.
 const boss=new PgBoss({schema,db:{executeSql:(sql,values)=>db.query(sql,values)},schedule:false,registerInstance:false,superviseIntervalSeconds:60,maintenanceIntervalSeconds:3600,queueCacheIntervalSeconds:60,monitorIntervalSeconds:60,flowIntervalSeconds:60,bamIntervalSeconds:60,openTelemetry:{enabled:false}});
 boss.on('error',onError);boss.on('warning',warning=>console.warn('Job queue:',warning.message));
 try{
  await boss.start();
  const defaults={policy:'stately',retryLimit:20,retryDelay:5,retryBackoff:true,retryDelayMax:300,expireInSeconds:120,deleteAfterSeconds:86400,retentionSeconds:604800};
  await boss.createQueue(QUEUE,defaults);await boss.createQueue(ROOM_QUEUE,{...defaults,expireInSeconds:30});
 }catch(error){await boss.stop({close:false});throw error;}
 const workers=new Map();let stopped=false;
 async function schedule(type,id,at=Date.now(),extra={},options={}){
  if(!Number.isFinite(at))throw Error('A finite job deadline is required.');
  if(stopped)throw Error('Job queue is stopping.');
  const data={version:1,type,id,...extra},key=type+':'+id,name=queueFor(type);
  return db.transaction(async()=>{
   db.afterCommit(()=>{const worker=workers.get(name);if(worker)boss.notifyWorker(worker);});
   if(options.ifAbsent)return boss.send(name,data,{singletonKey:key,startAfter:new Date(at)});
   const result=await boss.upsert(name,data,{singletonKey:key,startAfter:new Date(at)});
   return result.jobs[0]||null;
  });
 }
 const jobs={boss,schema,schedule,
  async scheduleRoom(kind,room,options={}){
   const due=roomDeadline(kind,room);
   if(due!==null)await schedule('room',kind+':'+room.id,due,{kind,roomId:room.id},options);
   if(['finished','cancelled'].includes(room.status)&&room.near)await schedule('near-room',room.id);
  },
  async scheduleNear(room,options={}){
   if(['settled','refunded'].includes(room.status))return;
   const at=room.kind==='game'?room.refund_at:Date.now()+60000;
   if(Number.isFinite(at))await schedule('near-room',room.id,Math.max(Date.now(),at),{},options);
  },
  async scheduleBet(bet,{restore=false}={}){
   if(['settled','refunded','cancelled'].includes(bet.status))return;
   const now=Date.now(),timeout=bet.status==='open'?bet.join_before:bet.resolve_until;
   if(Number.isFinite(timeout)&&(restore||timeout>now))await schedule('bet-timeout',bet.id,Math.max(now,timeout));
   const due=bet.status==='matched'&&bet.resolver!=='players'?bet.ends_at:bet.status==='proposed'?bet.challenge_until:null;
   if(Number.isFinite(due)&&(restore||due>now))await schedule('bet-check',bet.id,Math.max(now,due));
  },
  async start(handlers){
   if(workers.size)return;
   for(const name of [ROOM_QUEUE,QUEUE]){
    const interval=name===ROOM_QUEUE?pollingIntervalSeconds:paymentPollingIntervalSeconds;
    const worker=await boss.work(name,{batchSize:name===ROOM_QUEUE?10:5,localConcurrency:1,pollingIntervalSeconds:interval,burstWhenBatchFull:true,perJobResults:true},async entries=>{
     const results=[];
     for(const job of entries){
      try{
       const handler=handlers[job.data.type];
       if(job.data.version!==1||!handler)throw Error('Unsupported job: '+job.data.type);
       // An RPC does not delay room clocks; one failed job does not fail its batch.
       await handler(job.data,job);results.push({id:job.id,status:'completed'});
      }catch(error){results.push({id:job.id,status:'failed',output:{message:error.message}});}
     }
     return results;
    });
    workers.set(name,worker);
   }
  },
  async stop(){stopped=true;await boss.stop({graceful:true,timeout:10000,close:false});},
 };
 store.jobs=jobs;return jobs;
}
