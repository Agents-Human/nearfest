import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import UiIcon from './UiIcon';
import './game-page.css';

type Session={active:boolean;end:()=>void|Promise<void>;message?:string};
type SessionContext={register:(session:Session)=>void;navigate:(action:()=>void)=>void};
const GameSession=createContext<SessionContext>({register:()=>{},navigate:action=>action()});
export function useGameSession(active:boolean,end:()=>void|Promise<void>,message?:string){
 const {register}=useContext(GameSession),latest=useRef(end);latest.current=end;
 useEffect(()=>{register({active,end:()=>latest.current(),message});return()=>register({active:false,end:()=>{}});},[active,message,register]);
}
export const useGameNavigation=()=>useContext(GameSession).navigate;
export default function GamePage({title,back,online,staked=false,children}:{title:string;staked?:boolean;back:()=>void;online?:()=>void;children:ReactNode}){
 const [session,setSession]=useState<Session>({active:false,end:()=>{}}),[pending,setPending]=useState<(()=>void)|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const headerRef=useRef<HTMLElement>(null),bodyRef=useRef<HTMLDivElement>(null),dialogRef=useRef<HTMLElement>(null),backRef=useRef(back);backRef.current=back;
 const register=useRef((s:Session)=>setSession(s)).current;
 function navigate(action:()=>void){if(session.active)setPending(()=>action);else action();}
 useEffect(()=>{if(!session.active)return;const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>window.removeEventListener('beforeunload',stop);},[session.active]);
 useEffect(()=>{
  if(!session.active)return;const url=location.href;
  if(!history.state?.slotvendGuard)history.pushState({slotvendGuard:true},'',url);
  const pop=(e:PopStateEvent)=>{e.stopImmediatePropagation();history.pushState({slotvendGuard:true},'',url);setPending(()=>()=>backRef.current());};
  window.addEventListener('popstate',pop,true);return()=>window.removeEventListener('popstate',pop,true);
 },[session.active]);
 useEffect(()=>{
  if(!pending)return;const previous=document.activeElement as HTMLElement;
  if(headerRef.current)headerRef.current.inert=true;if(bodyRef.current)bodyRef.current.inert=true;
  dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){e.preventDefault();setPending(null);}if(e.key==='Tab'){const buttons=Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);if(!buttons.length){e.preventDefault();return;}if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}};
  document.addEventListener('keydown',key);return()=>{if(headerRef.current)headerRef.current.inert=false;if(bodyRef.current)bodyRef.current.inert=false;document.removeEventListener('keydown',key);previous?.focus();};
 },[pending,busy]);
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[title]);
 async function end(){setBusy(true);setError('');try{await session.end();const action=pending;setPending(null);action?.();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <GameSession.Provider value={{register,navigate}}><main className="game-page"><header ref={headerRef} className="game-page-header"><button className="game-page-back" onClick={()=>navigate(back)}><UiIcon name="back"/><span>All games</span></button><span className="game-page-brand"><img src="/brand/nearfest-logo.svg" alt="NearFest" width="160" height="30"/></span><div>{session.active&&<button className="game-end-button" onClick={()=>setPending(()=>()=>{})}>End game</button>}{online&&<button className="primary game-online-button" onClick={()=>navigate(online)}><UiIcon name="people"/>{staked?'Play for stakes':'Play online'}</button>}</div></header><div ref={bodyRef} className="game-page-body" aria-label={`${title} gameplay`}>{children}</div>{pending&&<div className="game-exit-backdrop"><section ref={dialogRef} className="game-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="game-exit-title"><span className="skill-kicker">FINISH THIS ONE FIRST</span><h2 id="game-exit-title">End this game?</h2><p>{session.message||'Your current solo game will end. Start a fresh game or play someone online afterwards.'}</p><div><button autoFocus className="secondary" disabled={busy} onClick={()=>setPending(null)}>Keep playing</button><button className="primary" disabled={busy} onClick={()=>void end()}>{busy?'Ending…':'End game & continue'}</button></div>{error&&<p role="alert">{error}</p>}</section></div>}</main></GameSession.Provider>;
}
