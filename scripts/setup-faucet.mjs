// Dedicated disposable testnet funding wallet. Never use escrow, oracle or mainnet funds.
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {JsonRpcProvider,KeyPair} from 'near-api-js';
const rpc=new JsonRpcProvider({url:'https://test.rpc.fastnear.com'});
if((await rpc.viewNodeStatus()).chain_id!=='testnet')throw Error('Testnet required.');
const filename='.nearfest-faucet-keys.json';let keys;
try{keys=JSON.parse(await readFile(filename,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;keys={network:'testnet',account_id:`nearfest-faucet-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}.testnet`,private_key:KeyPair.fromRandom('ed25519').toString()};await writeFile(filename,JSON.stringify(keys,null,2),{flag:'wx',mode:0o600});}
if(keys.network!=='testnet'||!keys.account_id.endsWith('.testnet'))throw Error('Invalid faucet key file.');await chmod(filename,0o600);
async function state(){try{return await rpc.viewAccount({accountId:keys.account_id});}catch(e){if(/does not exist|UNKNOWN_ACCOUNT|unknown account/i.test(e.message))return null;throw e;}}
if(!await state()){const res=await fetch('https://helper.nearprotocol.com/account',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({newAccountId:keys.account_id,newAccountPublicKey:KeyPair.fromString(keys.private_key).getPublicKey().toString()}),signal:AbortSignal.timeout(60000)});if(!res.ok)throw Error(`Faucet sponsor returned ${res.status}. Retry with the saved account; do not create more keys.`);}
let confirmed;for(let i=0;i<20;i++){confirmed=await state();if(confirmed)break;await new Promise(r=>setTimeout(r,1000));}if(!confirmed)throw Error('Faucet creation is still confirming.');
await rpc.viewAccessKey({accountId:keys.account_id,publicKey:KeyPair.fromString(keys.private_key).getPublicKey().toString(),blockQuery:{finality:'final'}});
let env=await readFile('.env','utf8');for(const [name,value]of Object.entries({NEAR_FAUCET_ACCOUNT:keys.account_id,NEAR_FAUCET_PRIVATE_KEY:keys.private_key})){const pattern=new RegExp(`^${name}=.*$`,'m');env=pattern.test(env)?env.replace(pattern,`${name}=${value}`):env.trimEnd()+`\n${name}=${value}\n`;}
await writeFile('.env',env,{mode:0o600});await chmod('.env',0o600);
console.log(JSON.stringify({network:'testnet',faucet:keys.account_id,balance:String(confirmed.amount),configured:true}));
