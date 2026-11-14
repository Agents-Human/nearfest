import {setTimeout as delay} from 'node:timers/promises';

// Retry only startup, before requests or wallet transactions can be accepted.
const temporary=new Set(['53300','57P03','08000','08001','08003','08006','ECONNREFUSED','ECONNRESET','ETIMEDOUT','EAI_AGAIN']);
export async function retryDatabaseStartup(connect,{timeoutMillis=30000,wait=delay,now=Date.now,onRetry=error=>console.warn('Waiting for PostgreSQL to become available ('+error.code+').')}={}){
 const deadline=now()+timeoutMillis;let attempts=0;
 while(true){
  try{return await connect();}
  catch(error){
   const remaining=deadline-now();
   if(!temporary.has(error?.code)||remaining<=0)throw error;
   if(attempts===0)onRetry(error);
   const pause=Math.min(500*2**Math.min(attempts++,2),remaining);
   await wait(pause);
  }
 }
}
