import {useEffect,useRef,useState} from 'react';
import './race-game.css';

export default function RaceControls({controls}:{controls:(key:string,value:boolean)=>void}){
 const [held,setHeld]=useState<Record<string,boolean>>({}),pointers=useRef(new Set<string>());
 useEffect(()=>{const clear=()=>{pointers.current.clear();setHeld({});};window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);return()=>{window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};},[]);
 function press(key:string,value:boolean){controls(key,value);setHeld(previous=>({...previous,[key]:value}));}
 function button(key:string,label:string,shortcut:string,className=''){
  return <button type="button" className={className} aria-label={label} aria-pressed={!!held[key]}
   onPointerDown={e=>{e.preventDefault();pointers.current.add(key);e.currentTarget.setPointerCapture(e.pointerId);press(key,true);}}
   onPointerUp={()=>{pointers.current.delete(key);press(key,false);}}
   onPointerCancel={()=>{pointers.current.delete(key);press(key,false);}}
   onLostPointerCapture={()=>{pointers.current.delete(key);press(key,false);}}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();press(key,true);}}}
   onKeyUp={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();press(key,false);}}}
   onBlur={()=>{if(!pointers.current.has(key))press(key,false);}}>
   <strong>{label}</strong><small>{shortcut}</small>
  </button>;
 }
 return <div className="race-control-deck" role="group" aria-label="Driving controls">
  <p>Hold <b>Accelerate</b> to drive. Release to slow down. Collect fuel cans, then hold <b>N</b> with the accelerator for nitro.</p>
  <div className="race-drive-row">{button('left','←','A / ←')}{button('right','→','D / →')}{button('up','Accelerate','W / ↑','race-accelerate')}{button('down','Brake','S / ↓')}</div>
  <div className="race-actions-row">{button('block','Drift','Shift')}{button('attack','Nitro','N','race-boost-button')}{button('fire','Fire','F')}</div>
 </div>;
}
