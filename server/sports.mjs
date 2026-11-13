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
export function normalizeFixture(e,league){const c=e.competitions?.[0],event={...c,status:c?.status||e.status};return {id:String(e.id),name:e.name,date:e.date,status:(c?.status||e.status)?.type?.shortDetail||(c?.status||e.status)?.type?.description||'Status unavailable',state:sportsPhase(event),completed:Boolean(event.status?.type?.completed),league,league_name:SPORT_LEAGUES[league]?.name,sport:SPORT_LEAGUES[league]?.sport,teams:(c?.competitors||[]).map(t=>({id:String(t.id),name:t.team?.displayName||t.team?.name,abbreviation:t.team?.abbreviation,score:String(t.score?.displayValue??t.score??''),homeAway:t.homeAway,winner:t.winner===true,logo:typeof t.team?.logo==='string'&&/^https:\/\/(?:a|a1|a2|a3|a4|a5)\.espncdn\.com\//.test(t.team.logo)?t.team.logo:undefined}))};}
export function verifySportsEntry(d,event,{now=Date.now(),practice=true,accepting=false}={}){
 const team=event.competitors?.find(t=>String(t.id)===d.resolver_config.team_id),phase=sportsPhase(event),kickoff=Date.parse(event.date);
 if(!team||!Number.isFinite(kickoff)||!['live','upcoming'].includes(phase))throw Error('This match is finished, unavailable or no longer accepting predictions.');
 if(!accepting){
  if(phase==='upcoming'&&(kickoff<=d.join_before||kickoff>=d.ends_at))throw Error('Set joining to close before kickoff, and the result time after the match.');
  if(phase==='live'&&(!practice||d.join_before>now+5*60000||d.ends_at<=now))throw Error('In-play challenges use FUN and must close to new players within five minutes.');
 }else if(phase==='live'&&!d.resolver_config.in_play)throw Error('Kickoff has passed. This pre-match challenge is no longer accepting entries.');
 return {team,phase,kickoff};
}
