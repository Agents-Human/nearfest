// A slow database must never accumulate overlapping copies of the same job.
export function startBackgroundJob(name,intervalMillis,work,{onError=error=>console.error(name+':',error.message),schedule=setInterval,cancel=clearInterval}={}){
 let running=null,stopped=false;
 function run(){
  if(stopped)return Promise.resolve();
  if(running)return running;
  running=Promise.resolve().then(work).catch(async error=>{
   try{await onError(error);}catch(reportError){console.error('Background error reporting failed:',reportError.message);}
  }).finally(()=>{running=null;});
  return running;
 }
 const timer=schedule(()=>{void run();},intervalMillis);timer.unref?.();
 return {run,stop(){stopped=true;cancel(timer);return running||Promise.resolve();}};
}
