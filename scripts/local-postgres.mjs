import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const bootstrap=setInterval(()=>{},1000);
let postgres,startupLog='';
try{
const {default:EmbeddedPostgres}=await import('embedded-postgres');

const url=new URL(process.env.DATABASE_URL||'postgresql://nearfest:nearfest@127.0.0.1:5432/nearfest');
if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('db:local only starts PostgreSQL on this computer.');
const databaseDir=resolve('data/postgres'),user=decodeURIComponent(url.username),password=decodeURIComponent(url.password),database=decodeURIComponent(url.pathname.slice(1));
if(!user||!password||!database)throw Error('DATABASE_URL must include a username, password, and database.');
postgres=new EmbeddedPostgres({databaseDir,user,password,port:Number(url.port||5432),persistent:true,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1','-k',databaseDir],onLog:message=>{startupLog=(startupLog+String(message)).slice(-4000);},onError:message=>process.stderr.write(String(message))});
if(!existsSync(resolve(databaseDir,'PG_VERSION')))await postgres.initialise();
await postgres.start();clearInterval(bootstrap);
const client=postgres.getPgClient('postgres');await client.connect();
try{if(!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount)await postgres.createDatabase(database);}finally{await client.end();}
console.log(`PostgreSQL is ready on 127.0.0.1:${url.port||5432} (${database}). Keep this terminal running.`);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await postgres.stop();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);

}catch(error){clearInterval(bootstrap);console.error(error?.message||startupLog||'PostgreSQL failed to start. Check the port and data directory.');if(postgres)await postgres.stop();process.exitCode=1;}
