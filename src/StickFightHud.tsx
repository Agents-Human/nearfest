import './stick-fight.css';

export function StickFightBanner({player,seat}:{player:any;rival?:any;seat:number|null}){
 return <div className="stick-status-bar">
  <span><i className={`stick-dot ${seat===1?'is-crimson':''}`}/>{seat===null?'WATCHING THE DUEL':seat===1?'YOU ARE CRIMSON':'YOU ARE CYAN'}</span>
  <b>{player?.guardBroken>0?'GUARD BROKEN':player?.charging?'RECHARGING SPIRIT':player?.calloutTimer>0?player.moveCallout:player?.weapon?`${player.weapon==='sword'?'KATANA':player.weapon.toUpperCase()} · ${player.weaponUses??6} HITS LEFT`:'CLOSE THE GAP. MAKE IT COUNT.'}</b>
  <span className="stick-energy-label">SPIRIT <strong>{Math.round(player?.energy??100)}%</strong></span>
 </div>;
}

export function StickFightFeedback({state,seat}:{state:any;seat:number|null}){
 const p=state.players[seat??0],combo=p?.hitCombo||0;
 const last=(state.impacts||[]).filter((i:any)=>i.kind==='parry'&&i.owner===(seat??0)).at(-1);
 return <div className="stick-feedback" aria-live="polite" aria-atomic="true">
  {combo>1&&p.hitComboTimer>0&&<div className="stick-combo" key={`${state.round}-${combo}`}><b>{combo}<small>HIT</small></b><span>{combo>=4?'BEAUTIFUL!':combo>=3?'KEEP IT GOING':'NICE COMBO'}</span></div>}
  {last?.age<.5&&<div className="stick-parry">PERFECT PARRY <small>Your turn.</small></div>}
 </div>;
}

export function StickFightControls({controls,disabled=false,player,rival}:{controls?:(key:string,value:boolean)=>void;disabled?:boolean;player?:any;rival?:any}){
 const close=player&&rival&&Math.abs(rival.x-player.x)<86&&Math.abs(rival.y-player.y)<75;
 function button(key:string,title:string,kbd:string,kind=''){
  const set=(held:boolean)=>{if(!held||!disabled)controls?.(key,held);};
  return <button key={key} type="button" disabled={disabled} className={`stick-btn ${kind}`} aria-label={`${title} (${kbd})`}
   onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);set(true);}}
   onPointerUp={()=>set(false)} onPointerCancel={()=>set(false)} onLostPointerCapture={()=>set(false)} onBlur={()=>set(false)}
   onKeyDown={e=>{if(e.key==='Enter'&&!e.repeat){e.preventDefault();set(true);}}} onKeyUp={e=>{if(e.key==='Enter')set(false);}}>
   <kbd>{kbd}</kbd><strong>{title}</strong>
  </button>;
 }
 return <div className="stick-arcade-deck" role="group" aria-label="Yokai Duel controls">
  <div className="stick-dpad-group">{button('left','←','A')}{button('up','Jump','W')}{button('right','→','D')}</div>
  <div className="stick-moves-group">{button('attack','Attack','Space','stick-btn-combo')}{button('down',player&&!player.ground?'Dropkick':player?.weapon==='hammer'?'Smash':player?.weapon==='sword'?'Slash':player?.weapon==='staff'?'Thrust':'Kick','S','stick-btn-heavy')}{button('block','Guard','Shift','stick-btn-guard')}{button('fire',close?'Throw':'Blast','F','stick-btn-special')}</div>
  <p className="stick-controls-tip">Hold <kbd>Space</kbd> for a combo. <span>Time <kbd>Shift</kbd> just before a hit to parry.</span></p>
 </div>;
}

export function StickFightGuide(){
 return <details className="stick-guide">
  <summary><span>A few moves. Endless ways to fight.</span><span>Move list +</span></summary>
  <div className="stick-moves-grid">
   <p><b>Attack · Space / J</b>Tap or hold for jab → cross → knee → finishing kick. Move in close; hits build your combo.</p>
   <p><b>Kick · S / ↓</b>A longer, heavier strike. In the air, it becomes a flying dropkick.</p>
   <p><b>Guard · Shift / K</b>Hold to block and restore spirit. Press just before contact for a perfect parry. Move while guarding to dash.</p>
   <p><b>Jump · W / ↑</b>Press again for an air flip. Jump + Attack unleashes a rising uppercut.</p>
   <p><b>Special · F</b>Throw a nearby rival over your shoulder, or send a spirit blast across the terrace.</p>
   <p><b>Pick up a weapon</b>Run over a glowing katana, hammer or staff. Attack uses its reach; Kick becomes a slash, smash or thrust. Six hits per weapon, then fight bare-handed. Weapons return after 13 seconds.</p>
   <p><b>Win the duel</b>Take two rounds. You have 60 seconds each round. Heavy moves spend spirit; blocking too many hits breaks your guard.</p>
  </div>
 </details>;
}
