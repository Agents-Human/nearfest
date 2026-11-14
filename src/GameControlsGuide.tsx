import {Fragment} from 'react';
import {controlsFor} from './games/game-controls';

export default function GameControlsGuide({game}:{game:{id:string;engine?:string}}) {
  const controls=controlsFor(game);
  if(!controls.length)return null;
  return <div className="game-controls-guide">
    {(['desktop','mobile'] as const).map(device=><section key={device} className={`game-controls-card is-${device}`} aria-label={`${device==='desktop'?'Desktop':'Mobile'} controls`}>
      <h4><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{device==='desktop'?<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></>:<><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/></>}</svg>{device==='desktop'?'Desktop':'Mobile'}</h4>
      <dl>{controls.filter(control=>device==='desktop'||control.touch.length).map(control=><div className="game-control-row" key={control.action}>
        <dt>{control.action}</dt>
        <dd>{device==='desktop'?<>
          {control.keys?.map((keys,index)=><Fragment key={keys.join('-')}>{index>0&&<span className="control-or">or</span>}<span className="control-key-group">{keys.map(k=><kbd key={k}>{k}</kbd>)}</span></Fragment>)}
          {control.pointer&&<>{!!control.keys?.length&&<span className="control-or">or</span>}<span className="control-pointer">{control.pointer}</span></>}
        </>:control.touch.map(label=><span className="control-touch" key={label}>{label}</span>)}</dd>
      </div>)}</dl>
    </section>)}
  </div>;
}
