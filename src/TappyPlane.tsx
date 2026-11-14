import {useEffect,useRef,useState} from 'react';
import type {GameAction} from './ArcadeGames';
import type {FlightState,TappyRenderer} from './games/tappy-renderer';
import './tappy-plane.css';
const bestKey='nearfest:tappy-plane:best';
const readBest=()=>{try{const score=Number(localStorage.getItem(bestKey));return Number.isFinite(score)?Math.max(0,score):0;}catch{return 0;}};
const colors=['#ed6956','#4c9fd6','#73ae68','#f2c65b'];
export const prepareTappyAssets=()=>import('./games/tappy-renderer');
function PlaneIcon({color}:{color:string}){return <svg viewBox="0 0 64 42" aria-hidden="true"><path d="M6 23h42a7 7 0 0 0 0-14H23L12 6H6l4 12z" fill={color}/><path d="M23 5h28v5H23zM19 26h31v5H19z" fill={color}/><path d="M29 9v19m14-19v19" stroke="#3b5961" strokeWidth="2"/><path d="M56 10v21" stroke="#60767a" strokeWidth="3" strokeLinecap="round"/><circle cx="40" cy="34" r="5" fill="#304950"/><circle cx="40" cy="34" r="2" fill="#e3ede8"/></svg>;}

export default function TappyPlane({s,seat,names,action,active}:{s:FlightState;seat:number|null;names:string[];action:GameAction;active:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<TappyRenderer|null>(null),latest=useRef({s,seat,active}),tap=useRef(()=>{});
 latest.current={s,seat,active};
 const [loaded,setLoaded]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[best,setBest]=useState(readBest),[expanded,setExpanded]=useState(false);
 const mine=seat===null?null:s.players[seat],viewer=mine??s.players[0],canFly=Boolean(active&&loaded&&mine?.alive&&!s.finished);
 tap.current=()=>{if(canFly)void action({type:'flap'});};
 useEffect(()=>{engine.current?.push(s,seat,active);},[s,seat,active]);
 useEffect(()=>{
  if(!mine||mine.alive&&!s.finished||mine.score<=best)return;
  setBest(mine.score);try{localStorage.setItem(bestKey,String(Math.max(readBest(),mine.score)));}catch{/* Flying does not require browser storage. */}
 },[mine?.alive,mine?.score,s.finished,best]);
 useEffect(()=>{
  let stopped=false;setError('');setLoaded(false);
  void prepareTappyAssets().then(({TappyRenderer})=>{
   if(stopped||!canvas.current)return;
   const current=latest.current;
   engine.current=new TappyRenderer(canvas.current,current.s,current.seat,message=>{setError(message);setLoaded(false);});
   engine.current.push(current.s,current.seat,current.active);setLoaded(true);
  }).catch(()=>{if(!stopped)setError('The flight scene could not open. Enable hardware acceleration and try again.');});
  return()=>{stopped=true;engine.current?.dispose();engine.current=null;};
 },[retry]);
 useEffect(()=>{
  const keyboard=(event:KeyboardEvent)=>{
   if(event.code==='Escape'){setExpanded(false);return;}
   const target=event.target instanceof HTMLElement?event.target:null;
   if(target?.closest('input,textarea,select,a,[contenteditable]')||target?.closest('button:not([data-tappy-control])'))return;
   if(!['Space','ArrowUp','KeyW'].includes(event.code)&&!(event.code==='Enter'&&target?.closest('[data-tappy-control]')))return;
   if(canFly){event.preventDefault();if(!event.repeat)tap.current();}
  };window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);
 },[canFly]);
 useEffect(()=>{if(!expanded)return;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow;};},[expanded]);
 useEffect(()=>{if(s.finished)setExpanded(false);},[s.finished]);
 return <div className={`tappy-game ${expanded?'tappy-expanded':''}`}>
  <div className="tappy-toolbar"><span><i/>{s.players.length===1?'SOLO FLIGHT':'LAST PLANE FLYING'}</span><div><span className="tappy-best">PERSONAL BEST <b>{Math.max(best,mine?.score??0)}</b></span><button aria-label={expanded?'Exit expanded view':'Expand game'} aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'↙':'⛶'}</button></div></div>
  <div className="tappy-stage" role="button" tabIndex={0} data-tappy-control aria-label="Flight area. Tap or press Space to flap." aria-disabled={!canFly} onClick={()=>tap.current()}>
   <canvas ref={canvas} aria-label="A three-dimensional biplane flying through a sunlit canyon"/>
   <div className="tappy-location" aria-hidden="true"><span>EMERALD CANYON</span><b>Find your rhythm.</b></div>
   <div className="tappy-hud" aria-hidden="true"><div><small>{mine?'YOUR SCORE':'FLIGHT SCORE'}</small><b>{viewer.score}</b></div><span><i>★</i> {viewer.stars}<em>{viewer.gates} gates cleared</em></span></div>
   {!loaded&&<div className="tappy-loading"><span className="arena-spinner"/><b>{error||'Preparing your flight…'}</b></div>}
   {loaded&&mine&&!mine.alive&&!s.finished&&<div className="tappy-watch" role="status"><b>Your flight is over</b><span>Watching the remaining pilots…</span></div>}
   {loaded&&(s.waiting||s.tick===0)&&<div className="tappy-start-hint"><span>{s.waiting?'READY WHEN YOU ARE':'GET READY'}</span><b>{s.waiting?'Tap to take off':'Keep your plane flying'}</b><small>Click the sky · Space · ↑</small></div>}
  </div>
  {error&&<p role="alert" className="inline-error">{error} <button onClick={()=>setRetry(n=>n+1)}>Reload scene</button></p>}
  <div className="tappy-controls"><p><b>A little lift. A longer flight.</b><span>Tap or press <kbd>Space</kbd> / <kbd>↑</kbd> to climb.</span></p><button className="tappy-flap" data-tappy-control disabled={!canFly} onClick={()=>tap.current()}><PlaneIcon color="#f6dc9a"/>{s.waiting?'Take off':'Flap'} ↑</button></div>
  <div className="tappy-pilots" aria-label="Pilot standings">{s.players.map((pilot,index)=><div className={`${index===seat?'tappy-you':''} ${!pilot.alive?'tappy-out':''}`} key={index}><PlaneIcon color={colors[index%4]}/><span>{names[index]}{index===seat?' · you':''}<small>{pilot.alive?s.waiting?'Ready for takeoff':'Flying':`Flight ended · ${pilot.deathReason??'round over'}`}</small></span><b>{pilot.score}</b></div>)}</div>
  <p className="tappy-rules">1 point per gate · 3 per gold star. {s.players.length===1?'Beat your best flight on this device.':'Same course for everyone. Planes pass through each other. Last plane flying wins; simultaneous final crashes draw.'}</p>
  <p className="tappy-credit">Plane design inspired by <a href="https://kenney.nl" target="_blank" rel="noreferrer">Kenney’s Tappy Plane</a> · <a href="/games/tappy-plane/License.txt" target="_blank" rel="noreferrer">CC0</a></p>
 </div>;
}
