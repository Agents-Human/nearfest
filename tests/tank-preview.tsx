// Local visual/interaction harness using the production HUD, inputs and simulation.
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArcadeWorld,TouchControls,useWorldControls} from '../src/ArcadeWorld';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';

function Preview(){
 const [state,setState]=useState(()=>newWorld('tank-arena',2)),[count,setCount]=useState(2),[mode,setMode]=useState('drive'),[paused,setPaused]=useState(true),[narrow,setNarrow]=useState(false),[run,setRun]=useState(0);
 const world=useRef(state),held=useRef<Record<string,boolean>>({});world.current=state;
 const controls=useWorldControls(!paused&&!state.finished,async next=>{held.current=next;});
 useEffect(()=>{const timer=setInterval(()=>{if(paused||world.current.finished)return;const current=world.current;const next=advanceWorld(current,current.players.map((_:any,i:number)=>mode==='bots'||i>0?worldBot(current,i):held.current));world.current=next;setState(next);},50);return()=>clearInterval(timer);},[paused,mode,run]);
 function restart(n=count){const next=newWorld('tank-arena',n);world.current=next;setState(next);setCount(n);setPaused(true);setRun(v=>v+1);}
 function powerups(){const next=structuredClone(world.current);Object.assign(next.players[0],{hp:2,shield:2,weapon:'spread',weaponTimer:8.5,boostTimer:5,dashCooldown:1.2});next.tick++;world.current=next;setState(next);}
 const seconds=Math.max(0,120-Math.floor(state.elapsed||0)),colors=['#ff765d','#a68bff','#65dfb5','#ffd166'];
 return <><header className="tank-preview-tools"><b>TOY TANK ARENA / PLAYTEST</b><select aria-label="Playtest mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="drive">You drive</option><option value="bots">Watch bots</option></select><select aria-label="Player count" value={count} onChange={e=>restart(Number(e.target.value))}><option value={2}>2 players</option><option value={4}>4 players</option></select><button onClick={()=>setPaused(!paused)}>{paused?'Play':'Pause'}</button><button onClick={()=>restart()}>Restart</button><button onClick={powerups}>Power-up check</button><button onClick={()=>setNarrow(!narrow)}>{narrow?'Wide layout':'Narrow layout'}</button></header><main className={`tank-preview-main ${narrow?'narrow':''}`}><h1>Toy Tank Arena</h1><p className="tank-preview-subtitle">SOLO PRACTICE · {count-1} practice {count===2?'bot':'bots'}</p><div className="tank-preview-score">{state.players.map((p:any,i:number)=><span key={i}><i style={{background:colors[i]}}/>{i?`Practice bot ${i}`:'You'} <small>{i?'BOT':''}</small><b>{p.score}</b></span>)}<strong>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></div><div className="arena-main"><ArcadeWorld key={run} s={state} seat={0} controls={controls} controllable={!paused&&!state.finished} action={async()=>{}}/>{!state.finished&&<TouchControls controls={controls} game="tank-arena"/>}</div><footer className="tank-preview-footer" role="status">{state.finished?`Match complete · ${state.reason}`:paused?'Paused · Press Play to drive or watch bots':`Playing · ${state.players.length} tanks · ${state.shots.length} shells · ${state.players[0].hp} armour · ${state.players[0].score} knockouts`}</footer></main></>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
