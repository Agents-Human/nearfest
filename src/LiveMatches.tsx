import {useEffect,useState} from 'react';
import {api,type Fixture} from './api';
import UiIcon from './UiIcon';
import Select from './Select';
type Leagues=Record<string,{name:string;sport:string}>;
type Feed={events:Fixture[];unavailable:string[];observed_at:number;date:string;leagues:Leagues;next_date:string|null;looked_ahead:boolean;lookahead_failed:boolean};
const formatDay=(day:string)=>new Date(`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}T12:00:00Z`).toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'});
export default function LiveMatches({query,create}:{query:string;create:(fixture:Fixture,teamId:string)=>void}){
 const [feed,setFeed]=useState<Feed|null>(null),[leagues,setLeagues]=useState<Leagues>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [league,setLeague]=useState('all'),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[status,setStatus]=useState('all'),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  async function refresh(){
   if(active)setBusy(true);
   try{const next=await api<Feed>(`/sports-feed?date=${date.replaceAll('-','')}&league=${encodeURIComponent(league)}`);if(active){setFeed(next);setLeagues(next.leagues);setError('');}}
   catch(e){if(active)setError((e as Error).message);}
   finally{if(active)setBusy(false);}
  }
  setFeed(null);setError('');void refresh();const timer=setInterval(refresh,30000);
  return()=>{active=false;clearInterval(timer);};
 },[date,league,retry]);
 const events=(feed?.events||[]).filter(f=>(status==='all'?['live','upcoming'].includes(f.state):f.state===status)&&`${f.name} ${f.league_name} ${f.sport}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(a.state==='live'?0:1)-(b.state==='live'?0:1)||Date.parse(a.date)-Date.parse(b.date));
 const liveCount=feed?.events.filter(f=>f.state==='live').length||0;
 const unavailable=Boolean(feed?.unavailable.length);
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_',' ');
 return <section className="sports-board">
  <div className="sports-heading"><div><span className="live-eyebrow"><i/>FROM THE SCOREBOARD</span><h3>Pick a match. Make your call.</h3></div><span className="feed-time">{busy?'Refreshing scores…':feed?`Updated ${new Date(feed.observed_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'Connecting to ESPN…'}</span></div>
  <div className="sports-tools">
   <div className="sports-status" role="group" aria-label="Sports match status">{[['all','Live & upcoming'],['live',`Live ${liveCount}`],['finished','Results']].map(([v,l])=><button key={v} aria-pressed={status===v} className={status===v?'active':''} onClick={()=>setStatus(v)}>{l}</button>)}</div>
   <Select aria-label="Sports league" value={league} onChange={e=>{setLeague(e.target.value);setStatus('all');}}><option value="all">All leagues</option>{Object.entries(leagues).map(([id,l])=><option key={id} value={id}>{l.name}</option>)}</Select>
   <label className="sports-date"><UiIcon name="clock" size={17}/><input type="date" aria-label="Match date" value={date} onChange={e=>{if(e.target.value){setDate(e.target.value);setStatus('all');}}}/></label>
  </div>
  {error&&<div className="feed-error" role="alert"><b>Scores couldn’t refresh.</b><span>{error}</span><button onClick={()=>setRetry(r=>r+1)}>Try again</button></div>}
  {unavailable&&<p className="feed-partial" role="status">{league==='all'?'Some leagues are temporarily unavailable. Available scores are shown below.':'This league’s feed is temporarily unavailable. Please try again shortly.'}</p>}
  {feed?.lookahead_failed&&<p className="feed-partial">Part of the upcoming schedule couldn’t load. We’ll try again on the next refresh.</p>}
  {feed?.next_date&&status==='all'&&<div className="next-match-note"><UiIcon name="clock" size={18}/><span>No live or upcoming matches on {formatDay(feed.date)}. <strong>Next matches: {formatDay(feed.next_date)}.</strong></span></div>}
  {!feed&&busy?<div className="match-skeletons" aria-label="Loading matches">{[1,2,3].map(i=><div key={i}/>)}</div>:events.length?<div className="sports-match-grid">{events.map(f=><article className={`sports-match ${f.state==='live'?'match-is-live':''}`} key={`${f.league}-${f.id}`}>
   <header><span>{f.league_name||f.league}</span><b>{f.state==='live'&&<i/>}{f.state==='live'?'LIVE':f.state==='finished'?'FINAL':new Date(f.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</b></header>
   <div className="sports-teams">{f.teams.map(t=><div key={t.id}><span className="team-mark">{t.logo?<img src={t.logo} alt="" loading="lazy"/>:<UiIcon name="ball" size={24}/>}</span><strong>{t.name}</strong><b>{f.state==='upcoming'?'–':t.score||'0'}</b></div>)}</div>
   <p className="match-clock">{f.state==='upcoming'?new Date(f.date).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'}):f.status}</p>
   {['live','upcoming'].includes(f.state)?<div className="match-picks"><span>Back a team to win</span><div>{f.teams.map(t=><button key={t.id} aria-label={`Back ${t.name} to win`} onClick={()=>create(f,t.id)}>{t.abbreviation||t.name}<UiIcon name="arrow" size={15}/></button>)}</div></div>:<div className="match-final">{f.teams.find(t=>t.winner)?.name||'Match'} · final result</div>}
  </article>)}</div>:feed&&!error&&!unavailable?<div className="sports-empty"><UiIcon name="live" size={38}/><h4>{query?'No matches found.':status==='live'?'No matches live in this selection right now.':status==='finished'?'No completed matches on this date.':feed.looked_ahead?'No upcoming fixtures published in this schedule.':'No matches scheduled for this date.'}</h4><p>{query?'Try another team or league in the search above.':status==='live'?'You can still make your call on the next scheduled matches.':feed.looked_ahead?'This league may be between seasons. Try another league or date.':'Pick a league to see its next scheduled matches, or choose another date.'}</p><button onClick={()=>{setStatus('all');if(status!=='live')setLeague('all');}}>{status==='live'?'See upcoming matches':'Explore all leagues'}</button></div>:null}
  <p className="sports-source">Times in {zone} · ESPN scores refresh every 30 seconds · peer-to-peer challenges use practice FUN.</p>
 </section>;
}
