export const SPORT_LEAGUES={
 'eng.1':{name:'Premier League',path:'soccer/eng.1',sport:'Football'},
 'esp.1':{name:'La Liga',path:'soccer/esp.1',sport:'Football'},
 'uefa.champions':{name:'Champions League',path:'soccer/uefa.champions',sport:'Football'},
 'nba':{name:'NBA',path:'basketball/nba',sport:'Basketball'},
 'wnba':{name:'WNBA',path:'basketball/wnba',sport:'Basketball'},
 'ncaam':{name:'College basketball',path:'basketball/mens-college-basketball',sport:'Basketball'},
 'nfl':{name:'NFL',path:'football/nfl',sport:'American football'},
 'nhl':{name:'NHL',path:'hockey/nhl',sport:'Hockey'},
 'mlb':{name:'MLB',path:'baseball/mlb',sport:'Baseball'},
};
export function sportsPhase(event){const s=event.status?.type;return s?.completed?'finished':s?.state==='in'?'live':s?.state==='pre'&&!/CANCEL|POSTPON|SUSPEND|DELAY/i.test(s.name||'')?'upcoming':'unavailable';}
export function validSportsDate(date){
 if(!/^\d{8}$/.test(date))return false;
 const parsed=new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00Z`);
 return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10).replaceAll('-','')===date;
}
export async function leagueSchedule(league,date,loadBoard,{lookAhead=false,now=Date.now()}={}){
 if(!Object.hasOwn(SPORT_LEAGUES,league)||!validSportsDate(date))throw Error('Choose a valid league and date.');
 const board=await loadBoard(league,date),events=(board.events||[]).map(e=>normalizeFixture(e,league));
 const today=new Date(now).toISOString().slice(0,10).replaceAll('-','');
 const result={events,next_date:null,looked_ahead:false,lookahead_failed:false};
 if(!lookAhead||date<today||events.some(e=>['live','upcoming'].includes(e.state)))return result;
 result.looked_ahead=true;
 const start=Date.parse(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T00:00:00Z`);
 const day=n=>new Date(start+n*86400000).toISOString().slice(0,10).replaceAll('-','');
 const calendar=board.leagues?.[0]?.calendar;
 // Soccer/basketball calendars list match days. NFL calendars contain weeks instead.
 const days=Array.isArray(calendar)&&calendar.every(d=>typeof d==='string')
  ? [...new Set(calendar.map(d=>d.slice(0,10).replaceAll('-','')))].filter(d=>validSportsDate(d)&&d>date&&d<=day(30)).sort().slice(0,3)
  : Array.from({length:7},(_,i)=>day(i+1));
 const schedules=await Promise.allSettled(days.map(d=>loadBoard(league,d)));
 for(let i=0;i<schedules.length;i++){
  const entry=schedules[i];
  if(entry.status==='rejected'){result.lookahead_failed=true;continue;}
  const upcoming=(entry.value.events||[]).map(e=>normalizeFixture(e,league)).filter(e=>['live','upcoming'].includes(e.state)&&Date.parse(e.date)>=start);
  if(upcoming.length){result.next_date=days[i];result.events=[...new Map([...events,...upcoming].map(e=>[e.id,e])).values()];break;}
 }
 return result;
}
export function normalizeFixture(e,league){const c=e.competitions?.[0],event={...c,status:c?.status||e.status};return {id:String(e.id),name:e.name,date:e.date,status:(c?.status||e.status)?.type?.shortDetail||(c?.status||e.status)?.type?.description||'Status unavailable',state:sportsPhase(event),completed:Boolean(event.status?.type?.completed),league,league_name:SPORT_LEAGUES[league]?.name,sport:SPORT_LEAGUES[league]?.sport,teams:(c?.competitors||[]).map(t=>({id:String(t.id),name:t.team?.displayName||t.team?.name,abbreviation:t.team?.abbreviation,score:String(t.score?.displayValue??t.score??''),homeAway:t.homeAway,winner:t.winner===true,logo:typeof t.team?.logo==='string'&&/^https:\/\/(?:a|a1|a2|a3|a4|a5)\.espncdn\.com\//.test(t.team.logo)?t.team.logo:undefined}))};}
export function verifySportsEntry(d,event,{now=Date.now(),practice=true,accepting=false}={}){
 const team=event.competitors?.find(t=>String(t.id)===d.resolver_config.team_id),phase=sportsPhase(event),kickoff=Date.parse(event.date);
 if(!team||!Number.isFinite(kickoff)||!['live','upcoming'].includes(phase))throw Error('This match is finished, unavailable or no longer accepting predictions.');
 if(!accepting){
  if(phase==='upcoming'&&(kickoff<=d.join_before||kickoff>=d.ends_at))throw Error('Set joining to close before kickoff, and the result time after the match.');
  if(phase==='live'&&(d.join_before>now+5*60000||d.ends_at<=now))throw Error('In-play NEAR testnet challenges must close to new players within five minutes.');
 }else if(phase==='live'&&!d.resolver_config.in_play)throw Error('Kickoff has passed. This pre-match challenge is no longer accepting entries.');
 return {team,phase,kickoff};
}
