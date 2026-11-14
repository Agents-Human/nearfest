import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
process.exitCode=1;
const bootstrap=setInterval(()=>{},1000);

let postgres,directory;
try{
 let connectionString=process.env.TEST_DATABASE_URL;
 if(!connectionString){
  const {default:EmbeddedPostgres}=await import('embedded-postgres');
  directory=await mkdtemp(join(tmpdir(),'nearfest-pg-test-'));
  const socket=createServer();await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const password=randomBytes(18).toString('hex');let log='';
  postgres=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port,persistent:true,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1','-k',directory,'-c','max_connections=100'],onLog:()=>{},onError:message=>{log+=message;}});
  try{await postgres.initialise();await postgres.start();await postgres.createDatabase('nearfest_test');}catch(error){throw Error((error?.message||'PostgreSQL failed to start')+'\n'+log);}
  connectionString=`postgresql://postgres:${password}@127.0.0.1:${port}/nearfest_test`;
 }
 const args=process.argv.slice(2);
 const child=spawn(process.execPath,['--test','--test-concurrency=4',...(args.length?args:['tests/*.test.mjs'])],{stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:connectionString}});
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
 process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
}catch(error){console.error(error?.message||error);process.exitCode=1;}finally{
 clearInterval(bootstrap);
 if(postgres)await postgres.stop();
 if(directory)await rm(directory,{recursive:true,force:true});
}
