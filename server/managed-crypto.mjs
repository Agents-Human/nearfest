import {createCipheriv,createDecipheriv,createHmac,randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,hkdfSync} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export function accountKey(value=process.env.NEAR_MANAGED_ACCOUNT_KEY){
 if(!value)return null;
 if(!/^[A-Za-z0-9+/]{43}=$/.test(value)||Buffer.from(value,'base64').length!==32)throw Error('NEAR_MANAGED_ACCOUNT_KEY must be a base64-encoded 32-byte key.');
 return Buffer.from(value,'base64');
}
export async function passwordHash(password){
 if(typeof password!=='string'||password.length<10||password.length>128)throw Error('Use a password with 10–128 characters.');
 const salt=randomBytes(16),hash=await scrypt(password,salt,32);
 return 'scrypt:'+salt.toString('base64')+':'+hash.toString('base64');
}
export async function passwordMatches(password,stored){
 if(typeof password!=='string'||password.length>128)return false;
 const [version,salt,expected]=stored.split(':');if(version!=='scrypt')return false;
 const hash=await scrypt(password,Buffer.from(salt,'base64'),32),other=Buffer.from(expected,'base64');
 return hash.length===other.length&&timingSafeEqual(hash,other);
}
export function encryptKey(secret,id,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(id));
 const data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join(':');
}
export function decryptKey(encrypted,id,key){
 const [version,iv,tag,data]=encrypted.split(':');if(version!=='v1')throw Error('Unknown account key format.');
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(Buffer.from(tag,'base64'));
 return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');
}
const unsigned=tx=>({signerId:tx.signerId,receiverId:tx.receiverId,actions:tx.actions});
const payload=(tx,authorization)=>JSON.stringify({transaction:unsigned(tx),id:authorization.id,expires:authorization.expires});
const mac=(tx,authorization,key)=>createHmac('sha256',Buffer.from(hkdfSync('sha256',key,'nearfest','prepared-transactions-v1',32))).update(payload(tx,authorization)).digest();
export function authorizeTransaction(tx,key,{id=randomUUID(),now=Date.now()}={}){
 if(!key)return tx;
 const authorization={id,expires:now+300000};authorization.signature=mac(tx,authorization,key).toString('base64');
 return {...tx,authorization};
}
export function verifyAuthorization(tx,key,now=Date.now()){
 const a=tx?.authorization;
 if(!key||!a||typeof a.id!=='string'||a.id.length>100||!Number.isSafeInteger(a.expires)||a.expires<now||typeof a.signature!=='string')throw Error('This action expired. Retry it from NearFest.');
 const expected=mac(tx,a,key),actual=Buffer.from(a.signature,'base64');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('The prepared action was changed. Retry it from NearFest.');
 return a.id;
}
