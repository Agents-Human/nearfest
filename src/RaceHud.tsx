import {raceBiome,roadCenter,raceWeather,raceTarget,raceBridgeSections,raceRampSections,roadGrade} from '../server/arcade/race-course.mjs';
import './race-game.css';

const colors=['#ff766a','#6bd9ff','#9bebb9','#ffdb78'];
export default function RaceHud({s,seat}:{s:any;seat:number|null}){
 const index=seat??0,me=s.players[index],d=me.y/10,biome=raceBiome(d);
 const weather=raceWeather(s.elapsed,s.raceSeed),target=raceTarget(s.players,index),ammo=me.ammo??3;
 const crossing=raceBridgeSections(d,d+80)[0],ramp=raceRampSections(d,d+85)[0];
 const remaining=Math.max(0,Math.ceil((s.timeLimit??120)-s.elapsed));
 const order=s.players.map((p:any,i:number)=>({...p,seat:i})).sort((a:any,b:any)=>b.y-a.y||a.seat-b.seat);
 const position=1+s.players.filter((p:any)=>p.y>me.y+.001).length;
 const leader=order[0],gap=Math.max(0,Math.round((leader.y-me.y)/10));
 const flash=s.finished?(s.winners.includes(index)?'YOU TAKE THE WIN':'RACE COMPLETE'):me.crashTimer>0?'CRASH · KEEP RACING':me.hitTimer>0?'HIT · SHIELD ACTIVE':me.takedownTimer>0?'TAKEDOWN':me.hitConfirm>0?'DIRECT HIT':me.airborne?'AIRTIME':me.landingTimer>0?'CLEAN LANDING':me.driftBoost>0?'DRIFT BOOST':me.nearMissTimer>0?'CLOSE CALL':me.nitroPickupTimer>0?`NITRO +${Math.round(me.nitroPickupAmount||0)}`:me.boosting?'FULL THROTTLE':me.drafting?'IN THE SLIPSTREAM':me.speed<1?'HOLD ACCELERATE · W / ↑':'';
 const path=Array.from({length:40},(_,i)=>{const ahead=i*5;return `${i?'L':'M'}${60+(roadCenter(d+ahead)-roadCenter(d))*.55},${138-ahead*.58}`;}).join(' ');
 return <div className={`race-hud ${me.boosting?'is-boosting':''}`}>
  <div className="race-position"><strong>{String(position).padStart(2,'0')}</strong><div><small>POSITION / {s.players.length}</small><span>{position===1?'LEADING THE PACK':`${gap} m to the lead`}</span></div></div>
  <div className={`race-timer ${remaining<=10?'is-final':''}`} role="timer" aria-label="Race time remaining"><small>{s.finished?'TIME’S UP':remaining<=10?'FINAL SECONDS':'TIME REMAINING'}</small><strong>{Math.floor(remaining/60)}<i>:</i>{String(remaining%60).padStart(2,'0')}</strong><span>Lead when the clock hits zero</span></div>
  <div className="race-route"><span className="race-route-number">{String(Math.floor(d/650)+1).padStart(2,'0')} /</span><div><small>NOW DRIVING</small><b>{biome.name}</b><span>{weather.rain>.15?'RAIN · EASE INTO THE CORNERS':weather.wet>.2?'CLEARING · WET ROAD':biome.subtitle}</span></div></div>
  <div className="race-field"><small>LIVE DISTANCE</small>{order.map((p:any,i:number)=><div className={p.seat===index?'is-you':''} key={p.seat}><b>{i+1}</b><i style={{background:colors[p.seat%4]}}/><span>{p.seat===index?'YOU':`DRIVER ${p.seat+1}`}</span><em>{(p.y/10000).toFixed(2)} km</em></div>)}</div>
  <div className="race-roadmap"><svg viewBox="0 0 120 155" aria-label="Upcoming road bends" role="img"><path d={path} stroke="#b9d9de25" strokeWidth="13" fill="none"/><path d={path} stroke="#ecf9ef" strokeWidth="2" fill="none" strokeDasharray="4 4"/><path d="M60 130l-6 12 6-3 6 3z" fill="#8efbe4"/></svg><span>ROAD AHEAD</span></div>
  <div className="race-feedback" aria-live="polite"><b key={flash}>{flash}</b>{me.airborne&&<span aria-live="off">{(me.airTime||0).toFixed(1)} SECONDS · KEEP YOUR LINE</span>}{me.drifting&&<><span>{me.driftCharge>=.65?'RELEASE DRIFT FOR A BOOST':'HOLD THE SLIDE'}</span><div><i style={{width:`${(me.driftCharge||0)*100}%`}}/></div></>}</div>
  <div className={`race-weapon ${target>=0?'has-target':''}`} aria-label="Pulse blaster">
   <div><kbd>F</kbd><b>PULSE BLASTER</b><span>{me.hits||0} HITS</span></div>
   <div className="race-ammo" aria-label={`${ammo} of 3 shots ready`}>{[0,1,2].map(i=><i key={i} className={i<ammo?'ready':''}><em style={{width:`${i===ammo?(me.reload||0)/3.2*100:0}%`}}/></i>)}</div>
   <span>{s.finished?'RACE COMPLETE':ammo===0?'RECHARGING':target>=0?`DRIVER ${target+1} · ${Math.round((s.players[target].y-me.y)/10)} m AHEAD`:'LINE UP A RIVAL · HOLD TO FIRE'}</span>
  </div>
  <div className="race-weather">{crossing?crossing.start>d?`BRIDGE IN ${Math.round(crossing.start-d)} m`:crossing.name:ramp?`JUMP ${ramp.x<0?'LEFT':'RIGHT'} · ${Math.max(0,Math.round(ramp.start-d))} m`:Math.abs(roadGrade(d))>.12?roadGrade(d)>0?'HILL CLIMB':'DOWNHILL RUSH':weather.rain>.15?'☂ RAIN':weather.wet>.2?'WET ROAD':''}</div>
  <div className="race-speedometer"><div><strong>{Math.round(me.speed*.36)}</strong><span>KM/H</span></div><div className="race-nitro-label"><b>NITRO</b><span>{Math.round(me.boost)}%</span></div><div className="race-nitro"><i style={{width:`${me.boost}%`}}/></div><span className="race-boost-hint">{me.boost<=0?'EMPTY · COLLECT FUEL':'W / ↑ GAS · N NITRO'} <i>·</i> SHIFT DRIFT</span><div className="race-rewards"><span>◈ {me.coins} coins</span><span>↗ {me.jumps||0} jumps</span></div></div>
 </div>;
}
