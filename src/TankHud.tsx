import type {CSSProperties} from 'react';
import './tank-game.css';

const colors=['#ff795d','#b69cff','#74d5b5','#ffe185'];

export function TankHud({player,seat}:{player:any;seat:number|null}){
 const hp=Math.max(0,player?.hp||0),maxHp=player?.maxHp||3,repairing=(player?.respawn||0)>0;
 const weapon=player?.weapon?`${player.weapon[0].toUpperCase()}${player.weapon.slice(1)}`:'Standard';
 return <div className="tank-status" style={{'--tank-color':colors[(seat??0)%4]} as CSSProperties}>
  <div className="tank-armour"><span className="tank-player-dot"/><div><small>{seat===null?'PLAYER 1':`YOUR TANK · P${seat+1}`}</small><div className="tank-armour-pips" role="img" aria-label={`${hp} of ${maxHp} armour${player?.shield?`, ${player.shield} shield charges`:''}`}>{Array.from({length:maxHp},(_,i)=><i key={i} className={i<hp?'filled':''}/>)}{player?.shield>0&&<span className="tank-shield">+{player.shield} shield</span>}</div></div></div>
  <div className="tank-loadout"><small>CANNON</small><b>{weapon}{player?.weaponTimer>0&&<span>{Math.ceil(player.weaponTimer)}s</span>}</b></div>
  <div className={`tank-dash ${(player?.dashCooldown||0)<=0?'is-ready':''}`}><small>{repairing?'REPAIRING':player?.boostTimer>0?'TURBO':'DASH'}</small><b>{repairing?`${Math.ceil(player.respawn)}s`:player?.boostTimer>0?`${Math.ceil(player.boostTimer)}s`:player?.dashCooldown>0?`${player.dashCooldown.toFixed(1)}s`:'Ready'}<span aria-hidden="true">↗</span></b></div>
 </div>;
}

export function TankGuide(){
 return <details className="tank-guide"><summary><span>How to play</span><span>First to 5 knockouts <i aria-hidden="true">+</i></span></summary><div><p><b>Move, find cover, fire.</b> Your turret aims at visible rivals. Shells bounce off walls.</p><p>Break wooden crates for cannon upgrades, shields and repairs. Red barrels explode. You respawn after a knockout.</p><p><kbd>WASD / arrows</kbd> drive <kbd>Space / J</kbd> fire <kbd>Shift / K</kbd> dash</p></div></details>;
}

export function TankControls({controls}:{controls:(key:string,value:boolean)=>void}){
 function button(key:string,label:string,icon:string){return <button key={key} type="button" className={`tank-control tank-control-${key}`} aria-label={label} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);controls(key,true);}} onPointerUp={()=>controls(key,false)} onPointerCancel={()=>controls(key,false)} onLostPointerCapture={()=>controls(key,false)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();controls(key,true);}}} onKeyUp={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();controls(key,false);}}} onBlur={()=>controls(key,false)}><span aria-hidden="true">{icon}</span>{key==='attack'||key==='block'?<b>{label}</b>:null}</button>;}
 return <div className="tank-controls"><p className="tank-keyboard"><span><kbd>WASD</kbd> Move</span><span><kbd>Space</kbd> Fire</span><span><kbd>Shift</kbd> Dash</span></p><div className="tank-touch"><div className="tank-dpad" role="group" aria-label="Drive tank">{button('up','Drive up','↑')}{button('left','Drive left','←')}{button('down','Drive down','↓')}{button('right','Drive right','→')}</div><div className="tank-actions" role="group" aria-label="Tank actions">{button('block','Dash','↗')}{button('attack','Fire','◎')}</div></div></div>;
}
