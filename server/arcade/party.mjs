import {randomInt,createHash} from 'node:crypto';
import {banks} from '../question-bank.mjs';
import {finish,ranked,DT} from './world.mjs';
export const partyIds=new Set(['draw-guess','clue-crew','bluff-club','deduction-club']);
const pictures=[
 {word:'house',aliases:['home'],clue:'A place where a family lives.',forbidden:['home','building','roof'],lines:[[[.2,.5],[.5,.2],[.8,.5],[.2,.5],[.2,.85],[.8,.85],[.8,.5]],[[.43,.85],[.43,.63],[.57,.63],[.57,.85]]]},
 {word:'tree',aliases:[],clue:'It grows tall and has roots and branches.',forbidden:['leaf','leaves','wood'],lines:[[[.45,.9],[.45,.6],[.55,.6],[.55,.9]],[[.5,.1],[.2,.5],[.35,.5],[.15,.65],[.85,.65],[.65,.5],[.8,.5],[.5,.1]]]},
 {word:'fish',aliases:[],clue:'An animal with fins that swims.',forbidden:['water','sea','ocean'],lines:[[[.2,.5],[.4,.3],[.65,.3],[.8,.5],[.65,.7],[.4,.7],[.2,.5],[.08,.3],[.08,.7],[.2,.5]],[[.65,.44],[.67,.44]]]},
 {word:'star',aliases:[],clue:'A bright point you can see in the night sky.',forbidden:['sky','space','sun'],lines:[[[.5,.1],[.6,.37],[.9,.4],[.66,.6],[.74,.9],[.5,.72],[.26,.9],[.34,.6],[.1,.4],[.4,.37],[.5,.1]]]},
 {word:'boat',aliases:['ship'],clue:'A vessel that floats and carries people.',forbidden:['ship','sea','sail'],lines:[[[.15,.6],[.85,.6],[.7,.85],[.3,.85],[.15,.6]],[[.48,.6],[.48,.15],[.75,.5],[.48,.5]],[[.1,.9],[.3,.94],[.5,.9],[.7,.94],[.9,.9]]]},
 {word:'car',aliases:['automobile'],clue:'A vehicle driven on a road.',forbidden:['drive','wheel','vehicle'],lines:[[[.13,.65],[.13,.45],[.3,.4],[.4,.22],[.68,.22],[.8,.45],[.9,.5],[.9,.65]],[[.3,.4],[.8,.45]],[[.23,.65],[.23,.75],[.33,.75],[.33,.65],[.23,.65]],[[.7,.65],[.7,.75],[.8,.75],[.8,.65],[.7,.65]]]},
];
const normalized=s=>String(s??'').toLowerCase().trim().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
const matching=(a,p)=>[p.word,...p.aliases].some(w=>normalized(w)===normalized(a));
function beginDraw(s){s.phase='draw';s.phaseAt=s.elapsed;s.drawer=s.solo?1:s.round%s.players.length;s.secret=pictures[(s.seed+s.round)%pictures.length];s.strokes=[];s.solved=[];s.players.forEach(p=>p.feedback='');}
function beginClue(s){s.phase='clue';s.phaseAt=s.elapsed;s.team=s.round%2;const members=s.players.flatMap((p,i)=>p.team===s.team?[i]:[]);s.drawer=s.solo?(s.team===0?1:3):members[Math.floor(s.round/2)%members.length];s.secret=pictures[(s.seed+s.round)%pictures.length];s.clues=[];s.solved=[];}
function beginBluff(s){s.phase='write';s.phaseAt=s.elapsed;s.truth=banks.trivia[(s.seed+s.round)%banks.trivia.length];s.submissions={};s.votes={};s.options=[];s.correct=null;}
export function newParty(game,n,solo=false){const s={game,tick:0,elapsed:0,finished:false,winners:[],reason:'',round:0,seed:randomInt(1000000),solo,players:Array.from({length:n},(_,i)=>({score:0,feedback:'',team:solo?(i<2?0:1):i%2,alive:true,guessAt:0})),phaseAt:0};
 if(game==='draw-guess')beginDraw(s);else if(game==='clue-crew'){s.teamScores=[0,0];beginClue(s);}else if(game==='bluff-club')beginBluff(s);else if(game==='deduction-club'){s.saboteur=solo?1+randomInt(n-1):randomInt(n);s.phase='night';s.nightActions={};s.votes={};s.evidence=[];s.notes={};s.lastEliminated=null;}return s;
}
function bluffVote(s){s.phase='vote';s.phaseAt=s.elapsed;const entries=[{text:s.truth[1],authors:[],truth:true},...Object.entries(s.submissions).map(([i,text])=>({text,authors:[Number(i)],truth:false}))],merged=[];for(const e of entries){const old=merged.find(q=>normalized(q.text)===normalized(e.text));if(old)old.authors.push(...e.authors);else merged.push(e);}s.options=merged.map(e=>({...e,id:createHash('sha256').update(`${s.seed}:${s.round}:${normalized(e.text)}`).digest('hex').slice(0,12)})).sort((a,b)=>a.id.localeCompare(b.id));}
function bluffReveal(s){s.phase='reveal';s.phaseAt=s.elapsed;s.correct=s.options.find(o=>o.truth)?.id;for(const [who,id] of Object.entries(s.votes)){const option=s.options.find(o=>o.id===id);if(!option)continue;if(option.truth)s.players[Number(who)].score+=2;else for(const author of option.authors)s.players[author].score++;}}
function deductionEnd(s){if(!s.players[s.saboteur].alive)return finish(s,s.players.flatMap((_,i)=>i!==s.saboteur?[i]:[]),'The investigators found the saboteur.');if(s.players.filter(p=>p.alive).length<=2)return finish(s,[s.saboteur],'The saboteur outlasted the investigators.');return s;}
function revealNight(s){const alive=s.players.flatMap((p,i)=>p.alive?[i]:[]),action=s.nightActions[s.saboteur],victim=Number.isInteger(action?.target)&&alive.includes(action.target)&&action.target!==s.saboteur?action.target:null;if(victim!==null){s.players[victim].alive=false;s.lastEliminated=victim;}
 const location=action?.location??s.round%3,decoys=alive.filter(i=>i!==s.saboteur&&i!==victim),decoy=decoys[s.round%Math.max(1,decoys.length)];s.evidence.push({night:s.round+1,location,suspects:[s.saboteur,decoy].filter(i=>i!==undefined).sort((a,b)=>a-b)});
 for(const i of alive)if(i!==s.saboteur&&s.nightActions[i]?.location===location)s.notes[i]=`You checked the damaged station. Badge ${s.saboteur+1} was recorded at the console.`;
 s.phase='discuss';s.phaseAt=s.elapsed;deductionEnd(s);
}
export function partyAction(s,i,d){if(s.finished)throw Error('This game has ended.');const p=s.players[i];if(!p)throw Error('Join this game.');
 if(s.game==='draw-guess'){
  if(d.type==='stroke'){if(i!==s.drawer||s.phase!=='draw')throw Error('Only the drawer can draw now.');if(!Array.isArray(d.points)||d.points.length<1||d.points.length>100||d.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('Use a short valid drawing stroke.');if(s.strokes.length>=500||s.strokes.reduce((n,line)=>n+line.points.length,0)+d.points.length>5000)throw Error('Drawing is full. Undo or clear some strokes.');const color=['#302b27','#ed8d76','#9d81c7','#5fa88a','#efc94b'].includes(d.color)?d.color:'#302b27';s.strokes.push({points:d.points,color,width:d.width===8?8:4});return;}
  if(['clear','undo'].includes(d.type)){if(i!==s.drawer)throw Error('Only the drawer can edit.');if(d.type==='clear')s.strokes=[];else s.strokes.pop();return;}
  if(i===s.drawer||s.solved.includes(i)||s.elapsed<p.guessAt)throw Error('Wait before guessing again.');p.guessAt=s.elapsed+.7;if(matching(d.guess,s.secret)){p.score+=Math.max(20,100-s.solved.length*20);s.players[s.drawer].score+=20;s.solved.push(i);p.feedback='You got it!';}else p.feedback='Keep looking at the drawing.';return;
 }
 if(s.game==='clue-crew'){
  if(s.phase!=='clue'||p.team!==s.team)throw Error('The other team is playing.');
  if(d.type==='clue'){if(i!==s.drawer)throw Error('Only the clue giver can send clues.');const text=String(d.text??'').trim();if(text.length<2||text.length>160)throw Error('Use a short clue.');const words=normalized(text).split(' ');if([s.secret.word,...s.secret.aliases,...s.secret.forbidden].some(w=>words.includes(normalized(w))))throw Error('That clue includes a forbidden word.');s.clues.push(text);return;}
  if(i===s.drawer||s.elapsed<p.guessAt)throw Error('Wait before guessing.');p.guessAt=s.elapsed+.7;if(matching(d.guess,s.secret)){s.teamScores[s.team]++;p.score++;s.phase='reveal';s.phaseAt=s.elapsed;}else p.feedback='Try another guess.';return;
 }
 if(s.game==='bluff-club'){
  if(s.phase==='write'){const text=String(d.text??'').trim();if(text.length<2||text.length>100)throw Error('Write a short, plausible answer.');if(normalized(text)===normalized(s.truth[1]))throw Error('That matches the real answer. Try a bluff.');s.submissions[i]=text;return;}
  if(s.phase==='vote'){if(s.votes[i])throw Error('Your vote is locked.');const option=s.options.find(o=>o.id===d.option);if(!option||option.authors.includes(i))throw Error('Vote for someone else’s answer.');s.votes[i]=option.id;return;}
  throw Error('Wait for the next round.');
 }
 if(s.game==='deduction-club'){
  if(!p.alive)throw Error('You are on the spectator bench.');
  if(s.phase==='night'){if(!Number.isInteger(d.location)||d.location<0||d.location>2)throw Error('Choose a station.');const action={location:d.location};if(i===s.saboteur){if(!Number.isInteger(d.target)||d.target===i||!s.players[d.target]?.alive)throw Error('Choose another active player.');action.target=d.target;}s.nightActions[i]=action;return;}
  if(s.phase==='vote'){if(!Number.isInteger(d.target)||d.target===i||!s.players[d.target]?.alive)throw Error('Choose another active player.');if(s.votes[i]!==undefined)throw Error('Your vote is locked.');s.votes[i]=d.target;return;}
  throw Error('Discuss the evidence, then vote.');
 }
 throw Error('Unknown party action.');
}
export function advanceParty(previous){if(previous.finished)return previous;const s=structuredClone(previous);s.elapsed+=DT;s.tick++;const time=s.elapsed-s.phaseAt;
 if(s.game==='draw-guess'){
  if(s.phase==='draw'&&(time>=60||s.solved.length>=s.players.length-1||s.solo&&s.solved.includes(0))){s.phase='reveal';s.phaseAt=s.elapsed;}
  else if(s.phase==='reveal'&&time>=4){s.round++;if(s.round>=(s.solo?5:s.players.length))ranked(s,s.players.map(p=>p.score),'Drawing cycle complete.');else beginDraw(s);}
 }else if(s.game==='clue-crew'){
  if(s.phase==='clue'&&time>=50){s.phase='reveal';s.phaseAt=s.elapsed;}else if(s.phase==='reveal'&&time>=4){s.round++;if(s.round===10){const max=Math.max(...s.teamScores);finish(s,s.players.flatMap((p,i)=>s.teamScores[p.team]===max?[i]:[]),'Five turns per team complete.');}else beginClue(s);}
 }else if(s.game==='bluff-club'){
  if(s.phase==='write'&&(time>=30||Object.keys(s.submissions).length===s.players.length))bluffVote(s);
  else if(s.phase==='vote'&&(time>=20||Object.keys(s.votes).length===s.players.length))bluffReveal(s);
  else if(s.phase==='reveal'&&time>=5){s.round++;if(s.round===5)ranked(s,s.players.map(p=>p.score),'Five bluffs played.');else beginBluff(s);}
 }else if(s.game==='deduction-club'){
  if(s.phase==='night'&&time>=20)revealNight(s);else if(s.phase==='discuss'&&time>=35){s.phase='vote';s.phaseAt=s.elapsed;s.votes={};}
  else if(s.phase==='vote'&&(time>=20||Object.keys(s.votes).length===s.players.filter(p=>p.alive).length)){const counts=s.players.map((_,i)=>Object.values(s.votes).filter(v=>v===i).length),max=Math.max(...counts),top=counts.flatMap((n,i)=>n===max&&max>0?[i]:[]);s.lastVote={votes:{...s.votes},eliminated:top.length===1?top[0]:null};if(top.length===1)s.players[top[0]].alive=false;deductionEnd(s);if(!s.finished){s.phase='night';s.phaseAt=s.elapsed;s.round++;s.nightActions={};s.notes={};}}
  if(s.elapsed>=600&&!s.finished)finish(s,[],'Case timed out. No winning side.');
 }
 return s;
}
export function partyView(s,i){const p=s.players[i],v={game:s.game,tick:s.tick,elapsed:s.elapsed,finished:s.finished,winners:s.winners,reason:s.reason,round:s.round,phase:s.phase,phaseAt:s.phaseAt,players:s.players.map(q=>({score:q.score,team:q.team,alive:q.alive})),me:p?{feedback:p.feedback,team:p.team,alive:p.alive}:null};
 if(s.game==='draw-guess')Object.assign(v,{drawer:s.drawer,strokes:s.strokes,solved:s.solved,word:i===s.drawer||s.phase==='reveal'?s.secret.word:null,letters:s.secret.word.length});
 if(s.game==='clue-crew')Object.assign(v,{drawer:s.drawer,team:s.team,teamScores:s.teamScores,clues:s.clues,word:i===s.drawer||s.phase==='reveal'?s.secret.word:null,forbidden:i===s.drawer?s.secret.forbidden:null});
 if(s.game==='bluff-club'){Object.assign(v,{prompt:s.truth[0],submitted:Object.keys(s.submissions).map(Number),mySubmission:s.submissions[i]||'',myVote:s.votes[i]??null,options:s.phase==='write'?[]:s.options.map(o=>({id:o.id,text:o.text,mine:o.authors.includes(i),...(s.phase==='reveal'?{correct:o.truth,authors:o.authors,votes:Object.values(s.votes).filter(id=>id===o.id).length}:{})}))});}
 if(s.game==='deduction-club')Object.assign(v,{role:p?(s.saboteur===i?'saboteur':'investigator'):null,evidence:s.evidence,note:s.notes[i]||'',myAction:s.nightActions[i]||null,myVote:s.votes[i]??null,lastEliminated:s.lastEliminated,lastVote:s.lastVote||null,saboteur:s.finished?s.saboteur:null});
 return v;
}
export function partyBot(s,i){if(s.finished||s.tick%30!==i%5)return null;const time=s.elapsed-s.phaseAt,p=s.players[i];
 if(s.game==='draw-guess'){if(i===s.drawer&&s.phase==='draw'){const index=s.strokes.length,line=s.secret.lines[index];if(line&&time>(index+1)*2)return {type:'stroke',points:line,color:'#302b27',width:8};}return null;}
 if(s.game==='clue-crew'){if(s.phase!=='clue'||p.team!==s.team)return null;if(i===s.drawer&&s.clues.length===0&&time>3){const clues={house:'A family lives here.',tree:'Roots below, branches above.',fish:'It has fins and swims.',star:'A bright point visible at night.',boat:'It floats and carries people.',car:'It travels on a road.'};return {type:'clue',text:clues[s.secret.word]};}if(i!==s.drawer&&time>12&&s.clues.some(text=>normalized(text).split(' ').some(w=>['family','roots','fins','bright','floats','road'].includes(w))))return {guess:s.secret.word};return null;}
 if(s.game==='bluff-club'){if(s.phase==='write'&&!s.submissions[i]&&time>3+i)return {text:s.truth[2+i%3]||'A clever invention'};if(s.phase==='vote'&&!s.votes[i]&&time>6+i){const options=s.options.filter(o=>!o.authors.includes(i));return {option:options[(i+s.round)%options.length]?.id};}}
 if(s.game==='deduction-club'&&p.alive){if(s.phase==='night'&&!s.nightActions[i])return {location:(i+s.round)%3,...(i===s.saboteur?{target:s.players.findIndex((q,j)=>j!==i&&q.alive)}:{})};if(s.phase==='vote'&&s.votes[i]===undefined){const candidates=s.players.flatMap((q,j)=>q.alive&&j!==i?[j]:[]),suspects=s.evidence.at(-1)?.suspects||candidates;return {target:candidates.find(j=>suspects.includes(j))??candidates[0]};}}
 return null;
}
