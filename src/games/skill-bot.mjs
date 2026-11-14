import {applyChess} from '../../server/skill/chess.mjs';
// A bounded, deterministic practice opponent. This never touches a room or a balance.
import {applyMove,legalMoves,ended} from '../../server/skill/engines.mjs';
const owned=(v,p)=>v!==0&&(v>0?0:1)===p;
function hexDistance(s,p){
 const color=s.colors[p],dist=Array(121).fill(Infinity),seen=new Set();
 for(let i=0;i<11;i++){const at=color===1?i:i*11;dist[at]=s.board[at]===color?0:s.board[at]===0?1:100;}
 for(let step=0;step<121;step++){
  let at=-1;for(let i=0;i<121;i++)if(!seen.has(i)&&(at<0||dist[i]<dist[at]))at=i;
  if(at<0)break;const x=at%11,y=Math.floor(at/11);if(color===1?y===10:x===10)return dist[at];seen.add(at);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<11&&ny>=0&&ny<11){const n=ny*11+nx,cost=s.board[n]===color?0:s.board[n]===0?1:100;dist[n]=Math.min(dist[n],dist[at]+cost);}}
 }return 100;
}
function value(s,p){
 if(ended(s))return s.draw?0:s.winner===p?100000-s.moves:-100000+s.moves;
 const b=s.board,sign=p===0?1:-1;
 if(s.game==='chess-online')return b.reduce((n,v,i)=>n+(v?Math.sign(v)*sign*([0,100,320,330,500,900,20000][Math.abs(v)]+(Math.abs(v)===1?(v>0?6-Math.floor(i/8):Math.floor(i/8)-1)*4:0)):0),0)+(s.check?(s.turn===p?-25:25):0);
 if(s.game==='oware')return (s.scores[p]-s.scores[1-p])*30+b.reduce((n,v,i)=>n+v*(Math.floor(i/6)===p?1:-1),0);
 if(s.game==='kalah')return (b[p===0?6:13]-b[p===0?13:6])*30;
 if(s.game==='checkers')return b.reduce((n,v,i)=>{if(!v)return n;const side=v>0?0:1,advance=side===0?7-Math.floor(i/8):Math.floor(i/8);return n+(side===p?1:-1)*(Math.abs(v)===2?180:100+advance*3);},0);
 if(s.game==='reversi')return b.reduce((n,v,i)=>n+(v?owned(v,p)?1:-1:0)*([0,7,56,63].includes(i)?80:[1,6,8,9,14,15,48,49,54,55,57,62].includes(i)?-10:3),0);
 if(s.game==='dots-boxes')return (s.scores[p]-s.scores[1-p])*40;
 if(s.game==='hex')return (hexDistance(s,1-p)-hexDistance(s,p))*30;
 if(s.game==='nine-mens-morris')return b.reduce((n,v)=>n+(v?owned(v,p)?1:-1:0),0)*50+(s.reserve[p]-s.reserve[1-p])*50+(s.capture?(s.turn===p?45:-45):0);
 let total=0;
 for(let i=0;i<42;i++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]]){
  const x=i%7,y=Math.floor(i/7);if(x+3*dx<0||x+3*dx>=7||y+3*dy>=6)continue;
  const line=Array.from({length:4},(_,k)=>b[(y+k*dy)*7+x+k*dx]);const mine=line.filter(v=>v===sign).length,theirs=line.filter(v=>v===-sign).length;
  if(!theirs)total+=[0,1,6,35,10000][mine];if(!mine)total-=[0,1,6,40,10000][theirs];
 }return total;
}
export function choosePracticeMove(state){
 if(ended(state))return null;
 const side=state.turn;let nodes=0;
 if(state.game==='chess-online'){
  const options=legalMoves(state).map(move=>({move,next:applyChess(state,move)})).map(o=>({...o,score:value(o.next,side)})).sort((a,b)=>b.score-a.score);
  if(options[0]?.score>90000)return options[0].move;
  for(const option of options.slice(0,8)){if(ended(option.next))continue;option.score=Math.min(...legalMoves(option.next).map(m=>value(applyChess(option.next,m),side)));}
  return options.slice(0,8).sort((a,b)=>b.score-a.score)[0]?.move||null;
 }

 function candidates(s){const direction=s.turn===side?1:-1;return legalMoves(s).map(move=>{const next=applyMove(s,move);return {move,next,score:value(next,side)};}).sort((a,b)=>direction*(b.score-a.score));}
 function search(s,depth,alpha,beta){
  if(!depth||ended(s)||nodes++>320)return value(s,side);
  const max=s.turn===side;let score=max?-Infinity:Infinity;
  for(const {next} of candidates(s).slice(0,8)){
   const v=search(next,depth-1,alpha,beta);score=max?Math.max(score,v):Math.min(score,v);
   if(max)alpha=Math.max(alpha,score);else beta=Math.min(beta,score);if(beta<=alpha)break;
  }return Number.isFinite(score)?score:value(s,side);
 }
 const options=candidates(state);let best=options[0]?.move??null,score=-Infinity;
 for(const item of options.slice(0,12)){const v=search(item.next,state.game==='hex'||state.game==='nine-mens-morris'?1:2,-Infinity,Infinity);if(v>score){score=v;best=item.move;}}
 return best;
}
