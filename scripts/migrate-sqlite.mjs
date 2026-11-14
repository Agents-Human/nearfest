import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDatabase} from '../server/database.mjs';
import {orderedTables,identityTables} from '../server/schema.mjs';

const tables=['users','sessions','bets','messages','reactions','reports','prepared','room_media','evidence','play_runs','community_rooms','multiplayer_rooms','skill_rooms','arcade_rooms','arcade_chat','near_rooms','near_intents','near_payouts','faucet_claims'];
const quote=value=>'"'+value.replaceAll('"','""')+'"';
export async function migrateSqlite(sourcePath,connectionString,options={}){
 const source=new DatabaseSync(sourcePath,{readOnly:true});let db;
 try{
  // One SQLite read snapshot includes committed WAL records and never changes the source.
  source.exec('BEGIN');
  const existing=source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name);
  const unknown=existing.filter(name=>!tables.includes(name));
  if(unknown.length)throw Error('Unrecognized SQLite tables: '+unknown.join(', ')+'. No data was imported.');
  db=await openDatabase(connectionString,options);
  return await db.transaction(async()=>{
   // Block all application writes for the empty-database check and the full import.
   await db.query('LOCK TABLE '+tables.map(quote).join(',')+' IN ACCESS EXCLUSIVE MODE');
   for(const table of tables)if((await db.prepare('SELECT count(*) AS n FROM '+quote(table)).get()).n!==0)throw Error('PostgreSQL already contains data. Import into an empty database; no records were changed.');
   const counts={};
   for(const table of existing){
    const columns=source.prepare('PRAGMA table_info('+quote(table)+')').all().map(row=>row.name);
    const ordered=orderedTables.has(table),targetColumns=ordered?[...columns,'created_order']:columns;
    const rows=source.prepare('SELECT '+(ordered?'rowid AS created_order,':'')+'* FROM '+quote(table)+(ordered?' ORDER BY rowid':'')).all();
    const insert='INSERT INTO '+quote(table)+'('+targetColumns.map(quote).join(',')+') VALUES('+targetColumns.map((_,i)=>'$'+(i+1)).join(',')+')';
    for(const row of rows)await db.query(insert,targetColumns.map(column=>row[column]));
    const actual=(await db.prepare('SELECT count(*) AS n FROM '+quote(table)).get()).n;
    if(actual!==rows.length)throw Error('Row count mismatch for '+table);
    counts[table]=actual;
   }
   for(const table of identityTables){
    const column=orderedTables.has(table)?'created_order':'id';
    await db.query('SELECT setval(pg_get_serial_sequence($1,$2),COALESCE(MAX('+quote(column)+'),1),MAX('+quote(column)+') IS NOT NULL) FROM '+quote(table),[table,column]);
   }
   return counts;
  });
 }finally{source.close();if(db)await db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const source=resolve(process.argv[2]||'data/slotvend.sqlite');
 const counts=await migrateSqlite(source,process.env.DATABASE_URL);
 for(const [table,count] of Object.entries(counts))console.log(table+': '+count);
 console.log('SQLite data copied to PostgreSQL. The source database was preserved.');
}
