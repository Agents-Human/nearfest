import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFixture,verifySportsEntry,sportsPhase} from '../server/sports.mjs';
const now=Date.UTC(2026,10,13,18),config={league:'nba',event_id:'123',team_id:'7'};
const event=state=>({id:'123',date:new Date(now+(state==='pre'?3600000:-3600000)).toISOString(),status:{type:{state,completed:state==='post',name:state==='pre'?'STATUS_SCHEDULED':state==='in'?'STATUS_IN_PROGRESS':'STATUS_FINAL'}},competitors:[{id:'7',team:{displayName:'Home'},score:'20'},{id:'8',team:{displayName:'Away'},score:'18'}]});
test('scoreboard maps real live state, scores and restricts logo URLs',()=>{const c=event('in');c.competitors[0].team.logo='https://evil.example/file.svg';const f=normalizeFixture({id:'123',name:'Home vs Away',date:c.date,competitions:[c]},'nba');assert.equal(f.state,'live');assert.equal(f.teams[0].score,'20');assert.equal(f.teams[0].logo,undefined);assert.equal(f.league_name,'NBA');assert.equal(sportsPhase({...c,status:{type:{state:'pre',name:'STATUS_POSTPONED'}}}),'unavailable');});
test('pre-match entry closes at kickoff; in-play NEAR testnet entries keep a short join window',()=>{const d={resolver_config:config,join_before:now+120000,ends_at:now+4*3600000};assert.equal(verifySportsEntry(d,event('pre'),{now}).phase,'upcoming');assert.equal(verifySportsEntry(d,event('in'),{now}).phase,'live');assert.equal(verifySportsEntry(d,event('in'),{now,practice:false}).phase,'live');assert.throws(()=>verifySportsEntry({...d,join_before:now+3600000},event('in'),{now}),/five minutes/);assert.throws(()=>verifySportsEntry(d,event('post'),{now}),/finished/);});
test('accepting rechecks completion and never upgrades a pre-match bet to in-play',()=>{const d={resolver_config:config};assert.throws(()=>verifySportsEntry(d,event('in'),{now,accepting:true}),/Kickoff/);assert.equal(verifySportsEntry({resolver_config:{...config,in_play:true}},event('in'),{now,accepting:true}).phase,'live');assert.throws(()=>verifySportsEntry({resolver_config:{...config,in_play:true}},event('post'),{now,accepting:true}),/finished/);});

test('empty match days use the league calendar, preserving dates and final results',async()=>{
 const {leagueSchedule,validSportsDate}=await import('../server/sports.mjs');
 assert.equal(validSportsDate('20260230'),false);assert.equal(validSportsDate('20261113'),true);
 const calls=[];
 const load=async(league,date)=>{calls.push(date);return date==='20261113'?{events:[],leagues:[{calendar:['2026-11-08T08:00Z','2026-11-21T08:00Z','2027-01-01T08:00Z']}]}:{events:[{id:'123',name:'Home vs Away',date:'2026-11-21T12:30Z',competitions:[event('pre')]}]};};
 const next=await leagueSchedule('eng.1','20261113',load,{lookAhead:true,now});
 assert.deepEqual(calls,['20261113','20261121']);assert.equal(next.next_date,'20261121');assert.equal(next.events[0].state,'upcoming');
 const exact=await leagueSchedule('eng.1','20261113',load,{now});assert.equal(exact.events.length,0);assert.equal(exact.looked_ahead,false);
 const past=await leagueSchedule('eng.1','20261112',async()=>({events:[]}),{lookAhead:true,now});assert.equal(past.looked_ahead,false);
});
test('lookahead distinguishes off-season calendars and provider failures',async()=>{
 const {leagueSchedule}=await import('../server/sports.mjs');
 const empty=await leagueSchedule('wnba','20261113',async()=>({events:[],leagues:[{calendar:['2026-08-01T08:00Z']}]}),{lookAhead:true,now});
 assert.equal(empty.next_date,null);assert.equal(empty.lookahead_failed,false);
 const failed=await leagueSchedule('eng.1','20261113',async(_,date)=>{if(date!=='20261113')throw Error('offline');return {events:[],leagues:[{calendar:['2026-11-21T08:00Z']}]};},{lookAhead:true,now});
 assert.equal(failed.lookahead_failed,true);assert.equal(failed.events.length,0);
});
