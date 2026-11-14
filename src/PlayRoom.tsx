import ChessPuzzle3D from './ChessPuzzle3D';
import GameInfoTabs from './GameInfoTabs';
import Confetti from './Confetti';
import Modal from './Modal';
import {RoomSetupHeading} from './RoomSetup';
import {useEffect,useRef,useState} from 'react';
import {api,type User} from './api';
import {gameCover,gameTitle} from './game-art';
import {useGameSession} from './GamePage';
import QuestionArt,{type QuestionIllustration} from './QuestionArt';
import QuizAnswers,{type ChoiceIllustration} from './QuizAnswers';
import './arcade-games.css';
export type Game={id:string;title:string;category:string;label:string;description:string;rounds:number;seconds:number;plays:number;kind:'quiz'|'puzzle'|'game';engine?:'local'|'imported'|'skill'|'arcade';min_players?:number;max_players?:number;skill_only?:boolean;solo?:boolean;bettable?:boolean;standalone?:boolean;genre?:string;local_players?:number;thumbnail?:string;launch?:string;controls?:string;author?:string;source?:string;license?:string;license_url?:string;ai_available?:boolean;art?:string;multiplayer?:boolean;level?:string;pace?:string;pack?:boolean};
type Question={illustration?:QuestionIllustration;choiceArt?:ChoiceIllustration[];type:'choice'|'chess';prompt:string;choices?:string[];pieces?:Record<string,string>;hint?:string};
type Run={id:string;game_id:string;index:number;total:number;score:number;ends_at:number;done:boolean;abandoned?:boolean;question:Question|null;curation?:string;feedback?:{correct:boolean;answer:string}};
export function GameCard({game,open}:{game:Game;open:()=>void}){
 const together=game.multiplayer||Boolean(game.local_players&&game.local_players>1);
 return <button className="play-card illustrated-card" onClick={open} aria-label={`Play ${game.title}`}>
  <div className="play-card-art"><img src={gameCover(game)} alt="" loading="lazy" width="640" height="440"/>{together&&<span className="card-social-tag">{game.multiplayer?'Online multiplayer':'Play together'}</span>}</div>
  <div className="play-card-copy"><span>{game.genre||game.label}</span><h3>{gameTitle(game)}</h3><div><b><svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="6" r="3"/><path d="M2 17v-2a6 6 0 0 1 12 0v2"/>{together&&<path d="M14 3a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 5"/>}</svg>{game.engine==='skill'?'Solo + 2 online':game.engine==='arcade'?`Solo + ${game.min_players===game.max_players?game.max_players:game.min_players+'–'+game.max_players} online`:game.multiplayer?'Solo + 2–16 online':together?`${game.local_players} · same device`:'Solo play'}</b><span className="card-launch" aria-hidden="true">↗</span></div></div>
 </button>;
}
export default function PlayRoom({game,user,join,createGroup,multiplayer}:{game:Game;user:User|null;join:()=>void;createGroup:()=>void;multiplayer:(entry?:string)=>void}){
 const startAfterLogin=useRef(false),prevDone=useRef(false);
 const [soloSetup,setSoloSetup]=useState(false);
 const [run,setRun]=useState<Run|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[feedback,setFeedback]=useState<Run['feedback']>(),[time,setTime]=useState(Date.now()),[copied,setCopied]=useState(false),[difficulty,setDifficulty]=useState('mixed'),[shareLink,setShareLink]=useState(''),[celebrate,setCelebrate]=useState(false);
 async function start(){if(!user){join();return;}setBusy(true);setError('');try{const next=await api<Run>(`/play/${game.id}/start`,{difficulty});setCelebrate(false);prevDone.current=false;setSoloSetup(false);setTime(Date.now());setRun(next);setShareLink('');setCopied(false);setFeedback(undefined);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{if(user&&startAfterLogin.current){startAfterLogin.current=false;void start();}},[user?.id]);
 async function answer(value:number|string){if(!run||busy||feedback)return;setBusy(true);setError('');try{const r=await api<Run>(`/play/${run.id}/answer`,{index:run.index,answer:value});setFeedback(r.feedback);window.dispatchEvent(new CustomEvent('slotvend:sfx',{detail:r.done?'finish':r.feedback?.correct?'correct':'miss'}));setRun(r);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{if(!run||run.done)return;const timer=setInterval(()=>setTime(Date.now()),250);return()=>clearInterval(timer);},[run?.id,run?.done]);
 const seconds=run?Math.min(game.seconds,Math.max(0,Math.ceil((run.ends_at-time)/1000))):game.seconds,done=Boolean(run&&(run.done||seconds===0));
 useGameSession(Boolean(run&&!done),async()=>{if(run)setRun(await api<Run>(`/play/${run.id}/end`,{}));});
 useEffect(()=>{if(run&&!run.done&&seconds===0)api<Run>(`/play/${run.id}/run`).then(setRun).catch(e=>setError(e.message));},[run?.id,seconds===0]);
 useEffect(()=>{setCelebrate(false);prevDone.current=false;},[game.id]);
 useEffect(()=>{
  if(!run){prevDone.current=false;return;}
  const wasDone=prevDone.current;
  prevDone.current=done;
  if(!wasDone&&done&&!run.abandoned&&run.score===run.total)setCelebrate(true);
 },[done,run?.id,run?.abandoned,run?.score,run?.total]);
 return <>
  <Confetti active={celebrate}/>
  {!run?<section className="arena-intro">
   <div className="arena-intro-image">
    <img src={gameCover(game)} alt=""/>
    {game.multiplayer&&<span className="arena-sticker">Made to<br/>play together.</span>}
   </div>
   <div>
    <span className="skill-kicker">{game.genre||game.label||game.category} · ORIGINAL NEARFEST GAME</span>
    <h1>{game.title}</h1>
    <GameInfoTabs game={game} key={game.id} title={game.title} description={game.description}>{game.id==='chess'?<p>Select a piece, then its destination to deliver checkmate in one move. You have {game.seconds} seconds to find the solution.</p>:<><p>Choose one answer for each of the {game.rounds} questions. Each correct answer earns one point. You have {game.seconds} seconds for the whole run.</p><p>Read every choice before answering. After each answer, review the result and move to the next question.</p></>}{game.multiplayer&&<p>With friends, everyone gets the same questions and the same clock. The highest score wins; tied players share first place.</p>}</GameInfoTabs>
    <div className="arena-mode-chips"><span>{game.rounds} {game.rounds===1?'puzzle':'rounds'}</span><span>{game.seconds} seconds</span><span>Optional NEAR stakes</span></div>
    <div className="arena-intro-actions">{game.multiplayer&&<button className="primary" onClick={()=>multiplayer('0')}>Play with friends ↗</button>}<button className="secondary play-solo-button" disabled={busy} onClick={()=>{if(game.rounds>1&&!game.pack)setSoloSetup(true);else if(user)void start();else{startAfterLogin.current=true;join();}}}>{busy?'Getting ready…':'Play solo'}</button></div>
    {error&&!soloSetup&&<p className="inline-error" role="alert">{error}</p>}
   </div>
  </section>:<div className="play-room">{done?<div className="play-finish"><span className="finish-symbol">{run.score===run.total?'✦':'⚑'}</span><span className="eyebrow">{run.abandoned?'GAME ENDED':seconds===0&&!run.done?'TIME’S UP':'NICE RUN'}</span><h2>{run.score}<small> / {run.total}</small></h2><p>{run.score===run.total?'Perfect score. Who can match it?':'One more go?'}</p><div className="play-finish-actions"><button className="primary" disabled={busy} onClick={start}>Play again ↗</button><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/?game=${game.id}`);setCopied(true);}catch{setError('Copy the game link from your browser.');}}}>{copied?'Copied ✓':'Challenge someone'}</button></div><button className="text-button" onClick={createGroup}>Make it a group prize pot →</button>{!run.abandoned&&<button className="text-button" onClick={async()=>{try{await api(`/play/${run.id}/share`,{});const link=`${location.origin}/?result=${run.id}`;setShareLink(link);try{await navigator.clipboard.writeText(link);}catch{}}catch(e){setError((e as Error).message);}}}>Share score & proof ↗</button>}{shareLink&&<label className="score-share">Your name and score are public at this link<input readOnly value={shareLink} onFocus={e=>e.target.select()}/></label>}<p className="fine-print">{run.curation==='ai'?'AI-curated round · ':''}Score checked by NearFest.</p></div>:<><div className="play-progress"><span>ROUND {run.index+1} / {run.total}</span><b className={seconds<15?'hurry':''}>{seconds}s</b><span>{run.score} correct</span></div><div className="play-progress-track"><i style={{width:`${100*seconds/game.seconds}%`}}/></div>{feedback?<div className={`answer-feedback ${feedback.correct?'correct':'wrong'}`}><span>{feedback.correct?'✓':'×'}</span><h2>{feedback.correct?'You got it.':'Close. Keep going.'}</h2><p>Answer: {feedback.answer}</p><button className="primary" onClick={()=>setFeedback(undefined)}>Next round →</button></div>:run.question&&<><h2 className="quiz-question">{run.question.prompt}</h2><QuestionArt art={run.question.illustration}/>{run.question.type==='choice'?<QuizAnswers choices={run.question.choices!} art={run.question.choiceArt} busy={busy} onAnswer={answer}/>:<><p className="fine-print">{run.question.hint}</p><ChessPuzzle3D pieces={run.question.pieces||{}} busy={busy} answer={answer}/></>}</>}</>}{error&&!soloSetup&&<p className="inline-error" role="alert">{error}</p>}</div>}
  {soloSetup&&<Modal wide className="room-setup-modal" title="Play solo" close={()=>{startAfterLogin.current=false;setSoloSetup(false);}}><div className="room-setup solo-game-setup"><RoomSetupHeading game={game} solo/><form onSubmit={e=>{e.preventDefault();if(user)void start();else{startAfterLogin.current=true;join();}}}>{game.rounds>1&&!game.pack&&<div className="solo-quiz-field"><span className="solo-field-label">Question mix</span><div className="quiz-difficulty" role="group" aria-label="Quiz difficulty">{[['mixed','Mix it up'],['brainy','Test me']].map(([id,label])=><button type="button" key={id} aria-pressed={difficulty===id} className={difficulty===id?'active':''} onClick={()=>setDifficulty(id)}>{label}</button>)}</div><p className="curation-note">✦ {game.ai_available?'AI picks your question mix from an answer-checked bank.':'Fresh picks from the question bank.'}</p></div>}<button className="primary" disabled={busy}>{busy?'Getting ready…':'Start game'}</button>{error&&<p className="inline-error" role="alert">{error}</p>}</form></div></Modal>}
 </>;
}
