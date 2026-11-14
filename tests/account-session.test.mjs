import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountSession} from '../src/account-session.ts';
test('unified account sign-in needs no external wallet and concurrent callers share one request',async()=>{
 const calls=[],user={id:'test-account',kind:'wallet',managed:true,username:'friend'},api=async(path,data)=>{calls.push({path,data});return path==='/me'?null:user;};
 const login=createAccountSession(api),results=await Promise.all([login('friend','private password'),login('friend','private password')]);
 assert.equal(results[0].id,results[1].id);assert.deepEqual(calls.map(call=>call.path),['/me','/session/account']);
});
test('an existing session reuses the same managed account',async()=>{
 const user={id:'test-account',kind:'wallet',managed:true,username:'friend'},calls=[];
 const login=createAccountSession(async path=>{calls.push(path);return user;});
 assert.deepEqual(await login('FRIEND',''),user);assert.deepEqual(calls,['/me']);
});
