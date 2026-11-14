import {useState} from 'react';
import Select from './Select';
import {RACE_SECONDS,DEFAULT_RACE_SECONDS} from '../server/arcade/race-course.mjs';
import './race-game.css';
const preference='slotvend-race-duration';
export function readRaceDuration(){try{const value=Number(sessionStorage.getItem(preference));return RACE_SECONDS.includes(value)?value:DEFAULT_RACE_SECONDS;}catch{return DEFAULT_RACE_SECONDS;}}
export function useRaceDuration(){const [seconds,setSeconds]=useState(readRaceDuration);return [seconds,(value:number)=>{setSeconds(value);try{sessionStorage.setItem(preference,String(value));}catch{/* A blocked preference store does not prevent racing. */}}] as const;}
export default function RaceDuration({value,onChange,disabled=false}:{value:number;onChange:(n:number)=>void;disabled?:boolean}){
 return <div className="race-duration-field"><label><span>Race duration</span><Select aria-label="Race duration" value={String(value)} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}>{RACE_SECONDS.map(n=><option value={n} key={n}>{n/60} minute{n===60?'':'s'}</option>)}</Select></label><p>Endless road. Take the lead before the clock runs out.</p></div>;
}
