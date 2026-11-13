import {useEffect,useRef,useState} from 'react';
import type {Game} from './PlayRoom';
import {gameCover,gameTitle} from './game-art';

export default function ImportedGame({game,createGroup,embedded=false}:{game:Game;createGroup?:()=>void;embedded?:boolean}){
 const frame=useRef<HTMLIFrameElement>(null),stage=useRef<HTMLDivElement>(null),ready=useRef(false);
 const [started,setStarted]=useState(false),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[copied,setCopied]=useState(false),[shareError,setShareError]=useState(false);
 useEffect(()=>{if(!started)return;ready.current=false;const receive=(e:MessageEvent)=>{if(e.source!==frame.current?.contentWindow||e.origin!=='null')return;if(e.data?.type==='slotvend:loaded'){ready.current=true;setLoaded(true);}if(e.data?.type==='slotvend:error')setFailed(true);if(e.data?.type==='slotvend:escape')stage.current?.querySelector<HTMLButtonElement>('button')?.focus();};window.addEventListener('message',receive);const timer=setTimeout(()=>{if(!ready.current)setFailed(true);},12000);return()=>{window.removeEventListener('message',receive);clearTimeout(timer);};},[started,attempt]);
 const restart=()=>{setFailed(false);setLoaded(false);setAttempt(n=>n+1);};
 const isBoomerang=game.id==='hundred-game-20-boomerang';
 const description=isBoomerang?'Aim, throw, and catch it on the way back. A little timing goes a long way.':game.description==='A complete independent browser game. Jump in and learn as you play.'?'Your next “just one more go” starts here.':game.description;
 const controls=isBoomerang?'Tap or click to aim and throw. Tap the returning boomerang to catch it for a bonus.':game.controls;
 const people=game.local_players&&game.local_players>1?`${game.local_players} players · same device`:'1 player';
 async function share(){try{await navigator.clipboard.writeText(`${location.origin}/?game=${game.id}`);setCopied(true);setShareError(false);}catch{setShareError(true);}}
 return <div className={`imported-game ${embedded?'embedded':''} ${started?'is-playing':''}`}>
  {!started?<div className="library-intro">
   <div className="library-art"><img src={gameCover(game)} alt=""/><span className="library-art-stamp">ONE MORE GO.</span></div>
   <div className="library-intro-copy">
    <span className="library-genre">{game.genre}</span>
    <h2>{gameTitle(game)}</h2><p>{description}</p>
    <div className="library-facts"><span><svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="6" r="3"/><path d="M3 18v-3a7 7 0 0 1 14 0v3"/></svg>{people}</span><span>Free to play</span></div>
    <button className="primary library-play" onClick={()=>setStarted(true)}><span>Let’s play</span><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 3.8c0-.8.9-1.3 1.6-.9l10 6.2c.7.4.7 1.4 0 1.8l-10 6.2c-.7.4-1.6-.1-1.6-.9z"/></svg></button>
    {createGroup&&<button className="library-challenge" onClick={createGroup}>Challenge your group <span aria-hidden="true">↗</span></button>}
    <span className="library-no-signup">Jump straight in. No signup needed.</span>
   </div>
  </div>:<div className="game-stage" ref={stage}>
   <div className="game-stage-tools"><span>{gameTitle(game)}</span><button onClick={restart} aria-label="Restart game">↻ <span>Restart</span></button><button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void stage.current?.requestFullscreen().catch(()=>setFailed(true));}} aria-label="Full screen">⛶ <span>Full screen</span></button><button onClick={()=>{setStarted(false);setLoaded(false);setFailed(false);}}>Back to game info</button></div>
   {!loaded&&<p className="game-loading" role="status">Opening {gameTitle(game)}…</p>}
   <iframe key={`${game.id}-${attempt}`} ref={frame} src={game.launch} title={`Play ${game.title}`} sandbox="allow-scripts allow-pointer-lock" allow="fullscreen; autoplay; gamepad" allowFullScreen referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>
   {failed&&<div className="game-launch-note" role="status">The game reported a loading problem. <button onClick={restart}>Try again</button><button onClick={()=>setFailed(false)}>Dismiss</button></div>}
  </div>}
  <div className="game-room-actions">
   <details className="game-credits"><summary>How to play <span aria-hidden="true">＋</span></summary><div className="game-credits-content"><p>{controls}</p><p>Made by <a href={game.source} target="_blank" rel="noreferrer">{game.author}</a> · <a href={game.license_url} target="_blank" rel="noreferrer">{game.license} licence</a></p><small>Progress lasts for this play session. Group challenges compare results with participant approval.</small></div></details>
   <button className="game-share" onClick={share}>{copied?'Link copied ✓':'Share game ↗'}</button>
   {shareError&&<span className="game-share-error" role="status">Copy this page’s address to share.</span>}
   {started&&createGroup&&<button className="library-challenge playing-challenge" onClick={createGroup}>Challenge your group ↗</button>}
  </div>
 </div>;
}
