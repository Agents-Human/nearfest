import {useEffect,useRef,useState} from 'react';
import type {GameAction} from './ArcadeGames';
import {drawTappyFlight,planeColors,prepareTappyAssets,type FlightState} from './games/tappy-renderer';
import './tappy-plane.css';
export {prepareTappyAssets} from './games/tappy-renderer';
const bestKey='nearfest:tappy-plane:best';
const readBest=()=>{try{return Math.max(0,Number(localStorage.getItem(bestKey))||0);}catch{return 0;}};

export default function TappyPlane({s,seat,names,action,active}:{s:FlightState;seat:number|null;names:string[];action:GameAction;active:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),snapshot=useRef({s,seat,active,at:performance.now()}),tap=useRef(()=>{});
 const [loaded,setLoaded]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[best,setBest]=useState(readBest);
 const mine=seat===null?null:s.players[seat],canFly=Boolean(active&&loaded&&mine?.alive&&!s.finished);
 useEffect(()=>{snapshot.current={s,seat,active,at:performance.now()};},[s,seat,active]);
 tap.current=()=>{if(canFly)void action({type:'flap'});};
 useEffect(()=>{
  if(!mine||mine.alive&&!s.finished||mine.score<=best)return;
  setBest(mine.score);try{localStorage.setItem(bestKey,String(Math.max(readBest(),mine.score)));}catch{/* A flight works even when storage is unavailable. */}
 },[mine?.alive,mine?.score,s.finished,best]);
 useEffect(()=>{
  let stopped=false,frame=0;setError('');setLoaded(false);
  void prepareTappyAssets().then(assets=>{
   if(stopped)return;const element=canvas.current,ctx=element?.getContext('2d');if(!element||!ctx)throw Error('Your browser could not open the flight canvas.');
   setLoaded(true);
   const render=(now:number)=>{
    const rect=element.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);
    if(element.width!==width||element.height!==height){element.width=width;element.height=height;}
    const current=snapshot.current,ahead=current.active?Math.min(.06,(now-current.at)/1000):0;
    if(width&&height)drawTappyFlight(ctx,assets,current.s,current.seat,width,height,now,ahead);
    frame=requestAnimationFrame(render);
   };frame=requestAnimationFrame(render);
  }).catch(e=>{if(!stopped)setError((e as Error).message);});
  return()=>{stopped=true;cancelAnimationFrame(frame);};
 },[retry]);
 useEffect(()=>{
  const keyboard=(event:KeyboardEvent)=>{
   const target=event.target instanceof HTMLElement?event.target:null;
   if(target?.closest('input,textarea,select,a,[contenteditable]')||target?.closest('button:not([data-tappy-control])'))return;
   if(!['Space','ArrowUp','KeyW'].includes(event.code)&&!(event.code==='Enter'&&target?.closest('[data-tappy-control]')))return;
   if(canFly){event.preventDefault();if(!event.repeat)tap.current();}
  };window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);
 },[canFly]);
 return <div className="tappy-game">
  <div className="tappy-toolbar"><span><i/>{s.players.length===1?'SOLO FLIGHT':'LAST PLANE FLYING'}</span><span>BEST <b>{Math.max(best,mine?.score??0)}</b></span></div>
  <div className="tappy-stage" role="button" tabIndex={0} data-tappy-control aria-label="Flight area. Tap or press Space to flap." aria-disabled={!canFly} onClick={()=>tap.current()}>
   <canvas ref={canvas} aria-label="Planes flying through a rocky canyon"/>
   <div className="tappy-hud" aria-hidden="true"><span>{mine?'YOUR SCORE':'FLIGHT SCORE'}</span><b>{(mine??s.players[0]).score}</b><small>{(mine??s.players[0]).gates} gates <em>·</em> ★ {(mine??s.players[0]).stars}</small></div>
   {!loaded&&<div className="tappy-loading"><span className="arena-spinner"/><b>{error||'Opening the skies…'}</b></div>}
   {loaded&&mine&&!mine.alive&&!s.finished&&<div className="tappy-watch" role="status"><b>Your flight is over</b><span>Watching the remaining pilots…</span></div>}
   {loaded&&(s.waiting||s.tick===0)&&<span className="tappy-start-hint">{s.waiting?'Tap the sky or press Space to take off.':'A little lift goes a long way.'}</span>}
  </div>
  {error&&<p role="alert" className="inline-error">{error} <button onClick={()=>setRetry(n=>n+1)}>Reload artwork</button></p>}
  <div className="tappy-controls"><p><b>Tap to fly. Find your rhythm.</b><span>Click the sky or press <kbd>Space</kbd> / <kbd>↑</kbd>. Release between taps.</span></p><button className="tappy-flap" data-tappy-control disabled={!canFly} onClick={()=>tap.current()}>Flap ↑</button></div>
  <div className="tappy-pilots" aria-label="Pilot standings">{s.players.map((pilot,index)=><div className={`${index===seat?'tappy-you':''} ${!pilot.alive?'tappy-out':''}`} key={index}><img src={`/games/tappy-plane/plane${planeColors[index%4]}1.png`} alt=""/><span>{names[index]}{index===seat?' · you':''}<small>{pilot.alive?'Flying':`Flight ended · ${pilot.deathReason??'round over'}`}</small></span><b>{pilot.score}</b></div>)}</div>
  <p className="tappy-rules">Clear a gate for 1 point. Collect a gold star for 3. {s.players.length===1?'Keep flying to beat your best score on this device.':'Everyone flies the same course. Planes pass through each other. Last plane flying wins; simultaneous final crashes draw.'}</p>
  <p className="tappy-credit">Artwork by <a href="https://kenney.nl" target="_blank" rel="noreferrer">Kenney</a> · <a href="/games/tappy-plane/License.txt" target="_blank" rel="noreferrer">CC0</a></p>
 </div>;
}
