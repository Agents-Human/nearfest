// Creates only fresh testnet accounts. No mainnet support; keys never go to stdout.
import {readFile,writeFile,chmod,mkdir} from 'node:fs/promises';
import {Account,JsonRpcProvider,KeyPair} from 'near-api-js';
import {randomBytes} from 'node:crypto';
const rpc=new JsonRpcProvider({url:'https://test.rpc.fastnear.com'}),UNIT=10n**24n;
if((await rpc.viewNodeStatus()).chain_id!=='testnet')throw Error('Testnet required.');
const path='.nearfest-testnet-keys.json';let keys;
try{keys=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;const id=`nearfest-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}.testnet`;keys={network:'testnet',contract:{id,key:KeyPair.fromRandom('ed25519').toString()}};for(const role of ['oracle','alice','bob','carol'])keys[role]={id:`${role}.${id}`,key:KeyPair.fromRandom('ed25519').toString()};await writeFile(path,JSON.stringify(keys,null,2),{mode:0o600,flag:'wx'});}
await chmod(path,0o600);if(keys.network!=='testnet'||!keys.contract.id.endsWith('.testnet'))throw Error('Invalid testnet key file.');
async function exists(id){try{return await rpc.viewAccount({accountId:id});}catch(e){if(/does not exist|UNKNOWN_ACCOUNT|unknown account/i.test(e.message))return null;throw e;}}
if(!await exists(keys.contract.id)){
 const response=await fetch('https://helper.nearprotocol.com/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newAccountId:keys.contract.id,newAccountPublicKey:KeyPair.fromString(keys.contract.key).getPublicKey().toString()}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(`Testnet faucet returned ${response.status}. The saved account can be retried without generating new keys.`);
}
let state;for(let i=0;i<20;i++){state=await exists(keys.contract.id);if(state)break;await new Promise(r=>setTimeout(r,1000));}if(!state)throw Error('Faucet account is not confirmed yet. Run again to recover.');
const root=new Account(keys.contract.id,rpc,keys.contract.key);
for(const role of ['oracle','alice','bob','carol'])if(!await exists(keys[role].id))await root.createAccount({newAccountId:keys[role].id,publicKey:KeyPair.fromString(keys[role].key).getPublicKey(),nearToTransfer:UNIT});
for(const role of ['contract','oracle','alice','bob','carol'])await rpc.viewAccessKey({accountId:keys[role].id,publicKey:KeyPair.fromString(keys[role].key).getPublicKey().toString(),blockQuery:{finality:'final'}});
let env='';try{env=await readFile('.env','utf8');}catch{}
const values={NEAR_RPC_URL:'https://test.rpc.fastnear.com',NEAR_CONTRACT_ID:keys.contract.id,NEAR_ORACLE_ACCOUNT:keys.oracle.id,NEAR_ORACLE_PRIVATE_KEY:keys.oracle.key};
for(const [name,value]of Object.entries(values)){const line=new RegExp(`^${name}=.*$`,'m');env=line.test(env)?env.replace(line,`${name}=${value}`):env.trimEnd()+`\n${name}=${value}\n`;}
await writeFile('.env',env,{mode:0o600});await chmod('.env',0o600);
console.log(JSON.stringify({network:'testnet',contract:keys.contract.id,oracle:keys.oracle.id,test_players:['alice','bob','carol'].map(role=>keys[role].id),credentials_saved_locally:true},null,2));
