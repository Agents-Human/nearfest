import {readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {accountKey} from '../server/managed-crypto.mjs';
const path='.env';let contents='';try{contents=await readFile(path,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
const existing=/^NEAR_MANAGED_ACCOUNT_KEY=(.*)$/m.exec(contents)?.[1]?.trim();
if(existing){accountKey(existing);console.log('Existing managed-account encryption key preserved.');}
else{const key=randomBytes(32).toString('base64');await writeFile(path,contents+(contents&&!contents.endsWith('\n')?'\n':'')+'NEAR_MANAGED_ACCOUNT_KEY='+key+'\n',{mode:0o600});await chmod(path,0o600);console.log('Managed-account encryption key added to .env. Keep this same secret in every deployed app instance; never commit it.');}
