// Local playtest: production HUD, simulation, sound, inputs and rendering.
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArcadeWorld,useWorldControls} from '../src/ArcadeWorld';
import {newWorld,advanceWorld,worldBot} from '../server/arcade/world.mjs';

function Preview(){
 const [state,setState]=useState(()=>newWorld('stick-rivals',2)),[paused,setPaused]=useState(true),[mode,setMode]=useState('play'),[narrow,setNarrow]=useState(false),[run,setRun]=useState(0),[recording,setRecording]=useState(false),[clip,setClip]=useState('');
 const world=useRef(state),held=useRef<Record<string,boolean>>({}),edges=useRef<Record<string,boolean>>({}),tick=useRef(0);world.current=state;
 const controls=useWorldControls(!paused&&!state.finished,async c=>{for(const k of Object.keys(c))if(c[k]&&!held.current[k])edges.current[k]=true;held.current=c;},'stick-rivals');
 useEffect(()=>{const timer=setInterval(()=>{
  if(paused||world.current.finished)return;
  const s=world.current;let inputs=[{...held.current,...edges.current},worldBot(s,1)];edges.current={};
  if(mode==='watch')inputs=s.players.map((_:any,i:number)=>worldBot(s,i));
  else if(mode==='combo')inputs=[{attack:true},{}];
  else if(mode==='guard')inputs=[{attack:true},{block:tick.current>0}];
  else if(mode==='parry')inputs=[{attack:tick.current<1},{block:tick.current<2}];
  else if(mode==='air')inputs=[{down:tick.current===0},{}];
  else if(mode==='ko')inputs=[{up:true,attack:tick.current<2},{}];
  else if(mode==='blast')inputs=[{fire:tick.current===0},{}];
  tick.current++;const next=advanceWorld(s,inputs);world.current=next;setState(next);
 },50);return()=>clearInterval(timer);},[paused,mode,run]);
 function record(){
  const canvas=document.querySelector<HTMLCanvasElement>('.world-canvas canvas');if(!canvas||recording)return;
  const stream=canvas.captureStream(60),chunks:BlobPart[]=[];
  const mimeType=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:3500000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());setClip(old=>{if(old)URL.revokeObjectURL(old);return URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));});setRecording(false);};
  setRecording(true);setPaused(false);recorder.start();setTimeout(()=>recorder.stop(),6000);
 }
 function restart(nextMode=mode){const next=newWorld('stick-rivals',2);if(!['play','watch'].includes(nextMode))next.weapons=[];if(['combo','guard','parry','ko'].includes(nextMode)){next.players[0].x=435;next.players[1].x=495;}if(nextMode==='air'){Object.assign(next.players[0],{x:410,y:320,ground:false,vy:0});next.players[1].x=485;}if(nextMode==='ko')next.players[1].hp=8;tick.current=0;held.current={};edges.current={};world.current=next;setState(next);setMode(nextMode);setPaused(true);setRun(v=>v+1);}
 return <><header className="preview-tools"><b>YOKAI DUEL <span>/ PLAYTEST</span></b><select aria-label="Playtest mode" value={mode} onChange={e=>restart(e.target.value)}><option value="play">You vs practice bot</option><option value="watch">Watch duel</option><option value="combo">Combo drill</option><option value="guard">Guard drill</option><option value="parry">Parry drill</option><option value="air">Dropkick drill</option><option value="blast">Spirit blast drill</option><option value="ko">Knockout drill</option></select><button onClick={()=>setPaused(!paused)}>{paused?'Fight':'Pause'}</button><button onClick={()=>restart()}>Restart</button><button disabled={recording} onClick={record}>{recording?'Recording…':'Record 6s'}</button>{clip&&<a href={clip} download="yokai-2d-duel.webm">Download clip</a>}<button onClick={()=>setNarrow(!narrow)}>{narrow?'Wide layout':'Mobile layout'}</button></header><main className={narrow?'preview-main narrow':'preview-main'}><div className="preview-title"><div><p>THE VAMPIRE TERRACE</p><h1>Yokai Duel<span>2D STICK FIGHT</span></h1></div><span>FIRST TO TWO ROUNDS</span></div><div className="arena-main"><ArcadeWorld key={run} s={state} seat={0} controls={controls} controllable={!paused&&!state.finished} action={async()=>{}}/></div><footer role="status">{state.finished?`Duel complete · ${state.winners.includes(0)?'You win!':'Rival wins'}`:paused?'Ready when you are. Press Fight.':`Fighting · ${Math.ceil(state.players[0].hp)} / ${Math.ceil(state.players[1].hp)} HP · ${state.players[0].hitCombo||0} hits · Round ${state.round+1}`}</footer></main></>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
