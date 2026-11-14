import type {api as Api,User} from './api';
/** Concurrent requests share one app session request; server sessions retain the same testnet account. */
export function createAccountSession(api:typeof Api){
 let active:Promise<User>|undefined;
 return (username:string,password:string):Promise<User>=>{
  if(active)return active;
  active=(async()=>{
   const existing=await api<User|null>('/me');
   if(existing?.managed&&existing.username===username.toLowerCase())return existing;
   return api<User>('/session/account',{username,password});
  })().finally(()=>{active=undefined;});
  return active;
 };
}
