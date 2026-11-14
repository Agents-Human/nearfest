import {createHash,randomUUID} from 'node:crypto';
import {openStore as openPostgresStore} from '../../server/store.mjs';
export const testSchema=key=>'test_'+createHash('sha256').update(key||randomUUID()).digest('hex').slice(0,24);
export function openStore(key){
 if(!process.env.TEST_DATABASE_URL)throw Error('Run npm test to start an isolated PostgreSQL test database.');
 return openPostgresStore(process.env.TEST_DATABASE_URL,{schema:testSchema(key===':memory:'?undefined:key)});
}
