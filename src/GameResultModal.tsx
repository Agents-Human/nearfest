import {Fragment} from 'react';
import Modal from './Modal';
import UiIcon from './UiIcon';
import './game-result.css';

export type ResultOutcome='win'|'loss'|'draw'|'neutral';

export type ResultPlayer={
 name:string;
 detail?:string;
 dot?:'coral'|'lilac';
 score?:number|string;
 winner?:boolean;
};

type GameResultModalProps={
 open:boolean;
 title:string;
 outcome:ResultOutcome;
 headline:string;
 reason?:string;
 gameId?:string;
 players?:ResultPlayer[];
 payout?:string;
 primaryLabel:string;
 primaryIcon?:string;
 onPrimary:()=>void;
 secondaryLabel?:string;
 onSecondary?:()=>void;
 links?:{label:string;onClick:()=>void}[];
 close:()=>void;
};

export default function GameResultModal({
 open,
 title,
 outcome,
 headline,
 reason,
 gameId,
 players,
 payout,
 primaryLabel,
 primaryIcon='reset',
 onPrimary,
 secondaryLabel,
 onSecondary,
 links,
 close,
}:GameResultModalProps){
 if(!open)return null;
 const icon=outcome==='win'?'trophy':outcome==='loss'?'games':'duel';
 return <Modal className="game-result-modal" title={title} close={close}>
  <div className="game-result" data-board-game={gameId}>
   <div className={`game-result-badge is-${outcome}`} aria-hidden="true">
    <UiIcon name={icon} size={26}/>
   </div>
   <h3 className="game-result-title">{headline}</h3>
   {reason&&<p className="game-result-reason">{reason}</p>}
   {players&&players.length===2&&<div className="game-result-players">
    {players.map((p,i)=><Fragment key={i}>
     {i===1&&<span className="game-result-vs">vs</span>}
     <div className={`game-result-player ${i===1?'is-right':''} ${p.winner?'is-winner':''}`}>
      {p.dot&&<i className={`turn-dot ${p.dot}`} aria-hidden="true"/>}
      <div className="game-result-player-copy">
       <b>{p.name}</b>
       {p.detail&&<span>{p.detail}</span>}
      </div>
      {p.score!==undefined&&<strong className="game-result-score">{p.score}</strong>}
     </div>
    </Fragment>)}
   </div>}
   {payout&&<div className="game-result-payout">{payout}</div>}
   <div className="game-result-actions">
    <button className="primary" onClick={onPrimary}>
     {primaryLabel}
     {primaryIcon&&<UiIcon name={primaryIcon} size={16}/>}
    </button>
    {secondaryLabel&&onSecondary&&<button className="secondary" onClick={onSecondary}>{secondaryLabel}</button>}
   </div>
   {links&&links.length>0&&<div className="game-result-links">
    {links.map(link=><button key={link.label} className="text-button" onClick={link.onClick}>{link.label}</button>)}
   </div>}
  </div>
 </Modal>;
}
