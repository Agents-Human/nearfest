import {initialChess,chessMoves,applyChess} from './chess.mjs';
// Deterministic, perfect-information rules. Randomness is never used by these engines.
export const skillGames=[
 ['chess-online','Chess','A good move changes everything.','Play a full chess game: castling, promotion, en passant and proper draw rules.'],
 ['oware','Mancala','Sow. Capture. Think ahead.','Sow seeds around twelve houses. Capture pairs and triples. Feed your rival when their row is empty.'],
 ['checkers','Checkers','Make your next move count.','Jump, capture and crown your pieces. Captures are compulsory; a blocked opponent loses.'],
 ['connect-four','Connect Four','Four in a row. One big grin.','Drop a disc into a column. Connect four horizontally, vertically or diagonally.'],
 ['dots-boxes','Dots and Boxes','Little lines. Big plans.','Join dots to claim boxes. Complete a box and take another turn. Most boxes wins.'],
 ['reversi','Reversi','Turn the whole thing around.','Bracket opposing discs to flip them. The player with the most discs at the end wins.'],
 ['kalah','Kalah','A handful of possibilities.','Sow stones into your pits and store. Land in your store for another turn. Most stones wins.'],
 ['hex','Hex','Find your own way across.','Connect your two edges on a eleven-by-eleven hex board. The second player may swap colours after the opening.'],
 ['nine-mens-morris','Nine Men’s Morris','Three in line. A clever little trap.','Place nine pieces, then move along the lines. Form a mill to capture a piece. At three pieces, you may fly.'],
].map(([id,title,label,description])=>({id,title,label,description,category:'Gaming',kind:'game',engine:'skill',multiplayer:true,standalone:true,min_players:2,max_players:2,rounds:2,seconds:600,art:id,skill_only:true,rules_version:'slotvend-1',genre:'Board games'}));
export const getSkillGame=id=>skillGames.find(g=>g.id===id);
const own=(v,p)=>v!==0&&(v>0?0:1)===p;
const sum=a=>a.reduce((n,x)=>n+x,0);
const count=(a,p)=>a.filter(x=>own(x,p)).length;
const finish=(s,winner,reason)=>Object.assign(s,{winner,draw:winner===null,reason});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const ended=s=>s.winner!==null||s.draw;
function remember(s){const key=JSON.stringify([s.board,s.turn,s.scores,s.reserve,s.colors,s.edges,s.forced,s.capture]);s.history[key]=(s.history[key]||0)+1;if(s.history[key]>=3)finish(s,null,'Threefold repetition.');}
export function initialState(id){
 if(id==='chess-online')return initialChess();
 const s={game:id,turn:0,board:[],winner:null,draw:false,reason:'',moves:0,history:{},last:null};
 if(id==='connect-four')s.board=Array(42).fill(0);
 else if(id==='checkers'){s.board=Array.from({length:64},(_,i)=>(Math.floor(i/8)+i%8)%2===1?(i<24?-1:i>=40?1:0):0);s.forced=null;s.quiet=0;}
 else if(id==='reversi'){s.board=Array(64).fill(0);s.board[27]=-1;s.board[36]=-1;s.board[28]=1;s.board[35]=1;}
 else if(id==='oware'){s.board=Array(12).fill(4);s.scores=[0,0];}
 else if(id==='kalah')s.board=Array.from({length:14},(_,i)=>[6,13].includes(i)?0:4);
 else if(id==='dots-boxes'){s.board=Array(16).fill(0);s.edges=Array(40).fill(0);s.scores=[0,0];}
 else if(id==='hex'){s.board=Array(121).fill(0);s.colors=[1,2];}
 else if(id==='nine-mens-morris'){s.board=Array(24).fill(0);s.reserve=[9,9];s.capture=false;s.quiet=0;}
 else throw Error('Unsupported skill game.');
 remember(s);return s;
}
function checkersMoves(s){
 const jumps=[],steps=[];
 s.board.forEach((piece,from)=>{if(!own(piece,s.turn)||s.forced!==null&&s.forced!==from)return;const x=from%8,y=Math.floor(from/8),dirs=Math.abs(piece)===2?[-1,1]:[piece>0?-1:1];
  for(const dy of dirs)for(const dx of [-1,1]){const xx=x+dx,yy=y+dy;if(xx<0||xx>7||yy<0||yy>7)continue;const mid=yy*8+xx;if(!s.board[mid])steps.push({from,to:mid});else if(!own(s.board[mid],s.turn)){const tx=x+dx*2,ty=y+dy*2;if(tx>=0&&tx<8&&ty>=0&&ty<8&&!s.board[ty*8+tx])jumps.push({from,to:ty*8+tx,capture:mid});}}
 });return jumps.length?jumps:s.forced!==null?[]:steps;
}
function flips(s,to,p=s.turn){if(s.board[to])return [];const x=to%8,y=Math.floor(to/8),all=[];for(const dx of [-1,0,1])for(const dy of [-1,0,1]){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy,line=[];while(xx>=0&&xx<8&&yy>=0&&yy<8){const i=yy*8+xx;if(!s.board[i])break;if(own(s.board[i],p)){if(line.length)all.push(...line);break;}line.push(i);xx+=dx;yy+=dy;}}return all;}
function sowOware(s,from){const a=[...s.board];let n=a[from],i=from;a[from]=0;while(n){i=(i+1)%12;if(i===from)continue;a[i]++;n--;}return {a,last:i};}
const side=(i,p)=>p===0?i<6:i>=6;
const mills=Array.from({length:3},(_,r)=>[[0,1,2],[2,3,4],[4,5,6],[6,7,0]].map(a=>a.map(i=>i+r*8))).flat().concat([[1,9,17],[3,11,19],[5,13,21],[7,15,23]]);
export const morrisPoints=Array.from({length:3},(_,r)=>[[r,r],[3,r],[6-r,r],[6-r,3],[6-r,6-r],[3,6-r],[r,6-r],[r,3]]).flat();
const inMill=(s,i)=>mills.some(m=>m.includes(i)&&m.every(j=>s.board[j]===s.board[i]&&s.board[i]!==0));
const adjacent=(a,b)=>Math.floor(a/8)===Math.floor(b/8)&&([1,7].includes(Math.abs(a-b)))||a%8===b%8&&a%2===1&&Math.abs(a-b)===8;
function morrisMoves(s){const p=s.turn,b=s.board;if(s.capture){const opponents=b.map((v,i)=>own(v,1-p)?i:-1).filter(i=>i>=0),outside=opponents.filter(i=>!inMill(s,i));return (outside.length?outside:opponents).map(take=>({take}));}const empty=b.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(s.reserve[p]>0)return empty.map(to=>({to}));return b.flatMap((v,from)=>own(v,p)?empty.filter(to=>count(b,p)===3||adjacent(from,to)).map(to=>({from,to})):[]);}
export function legalMoves(s){
 if(s.game==='chess-online')return chessMoves(s);if(ended(s))return [];const id=s.game;
 if(id==='connect-four')return Array.from({length:7},(_,column)=>({column})).filter(m=>s.board[m.column]===0);
 if(id==='checkers')return checkersMoves(s).map(({from,to})=>({from,to}));
 if(id==='reversi'){const moves=s.board.flatMap((v,to)=>!v&&flips(s,to).length?[{to}]:[]);return moves.length?moves:[{pass:true}];}
 if(id==='oware'){const moves=s.board.flatMap((v,from)=>v>0&&side(from,s.turn)?[{from}]:[]);return s.board.some((v,i)=>v&&side(i,1-s.turn))?moves:moves.filter(m=>sowOware(s,m.from).a.some((v,i)=>v&&side(i,1-s.turn)));}
 if(id==='kalah')return s.board.flatMap((v,from)=>v>0&&(s.turn===0?from<6:from>=7&&from<13)?[{from}]:[]);
 if(id==='dots-boxes')return s.edges.flatMap((v,edge)=>v===0?[{edge}]:[]);
 if(id==='hex')return s.board.flatMap((v,to)=>!v?[{to}]:[]).concat(s.moves===1&&s.turn===1?[{swap:true}]:[]);
 if(id==='nine-mens-morris')return morrisMoves(s);
 return [];
}
const winByScore=(s,scores,reason)=>finish(s,scores[0]===scores[1]?null:scores[0]>scores[1]?0:1,reason);
function hasFour(b,to){const x=to%7,y=Math.floor(to/7),piece=b[to];for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){let n=1;for(const sign of [-1,1])for(let d=1;d<4;d++){const xx=x+dx*d*sign,yy=y+dy*d*sign;if(xx<0||xx>=7||yy<0||yy>=6||b[yy*7+xx]!==piece)break;n++;}if(n>=4)return true;}return false;}
function hexWins(s,color){const q=[],seen=new Set();for(let i=0;i<11;i++){const j=color===1?i:i*11;if(s.board[j]===color){q.push(j);seen.add(j);}}while(q.length){const i=q.pop(),x=i%11,y=Math.floor(i/11);if(color===1?y===10:x===10)return true;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){const xx=x+dx,yy=y+dy,j=yy*11+xx;if(xx>=0&&xx<11&&yy>=0&&yy<11&&s.board[j]===color&&!seen.has(j)){seen.add(j);q.push(j);}}}return false;}
export function applyMove(previous,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a legal move.');
 const normalized=Object.fromEntries(Object.entries(input).sort(([a],[b])=>a.localeCompare(b)));
 const legal=legalMoves(previous).find(m=>equal(Object.fromEntries(Object.entries(m).sort(([a],[b])=>a.localeCompare(b))),normalized));
 if(!legal)throw Error('That move is not legal.');
 if(previous.game==='chess-online')return applyChess(previous,legal);
 const s=structuredClone(previous),p=s.turn,mark=p===0?1:-1,b=s.board,id=s.game;s.last=legal;s.moves++;
 if(id==='connect-four'){let to=legal.column;while(to+7<42&&!b[to+7])to+=7;b[to]=mark;s.last={to,...legal};if(hasFour(b,to))finish(s,p,'Four in a row.');else if(b.every(Boolean))finish(s,null,'The board is full.');s.turn=1-p;}
 else if(id==='checkers'){
  const move=checkersMoves(previous).find(m=>m.from===legal.from&&m.to===legal.to),piece=b[move.from];b[move.to]=piece;b[move.from]=0;
  if(move.capture!==undefined)b[move.capture]=0;
  const crowned=Math.abs(piece)===1&&(p===0?move.to<8:move.to>=56);if(crowned)b[move.to]=mark*2;
  s.quiet=Math.abs(piece)===1||move.capture!==undefined?0:s.quiet+1;s.forced=move.capture!==undefined&&!crowned?move.to:null;
  if(s.forced!==null&&checkersMoves(s).length)return s;
  s.forced=null;s.turn=1-p;if(!checkersMoves(s).length)finish(s,p,'No legal move remains.');else if(s.quiet>=80)finish(s,null,'Forty moves each without a man move or capture.');
 }
 else if(id==='reversi'){
  if(!legal.pass){const changed=flips(s,legal.to);b[legal.to]=mark;for(const i of changed)b[i]=mark;}
  s.turn=1-p;const any=q=>b.some((v,i)=>!v&&flips(s,i,q).length);
  if(!any(0)&&!any(1))winByScore(s,[count(b,0),count(b,1)],'Neither player can move.');
 }
 else if(id==='oware'){
  const {a,last}=sowOware(s,legal.from);s.board=a;const captures=[];let i=last;
  while(side(i,1-p)&&[2,3].includes(a[i])){captures.push(i);i=(i+11)%12;}
  const removed=sum(captures.map(i=>a[i])),opponent=sum(a.filter((_,i)=>side(i,1-p)));
  if(removed&&removed<opponent){s.scores[p]+=removed;captures.forEach(i=>a[i]=0);}
  s.turn=1-p;
  if(s.scores.some(n=>n>24))winByScore(s,s.scores,'More than 24 seeds captured.');
  else if(!legalMoves(s).length){for(let q=0;q<2;q++)s.scores[q]+=sum(a.filter((_,i)=>side(i,q)));s.board.fill(0);winByScore(s,s.scores,'No legal feed or sow remains.');}
 }
 else if(id==='kalah'){
  const store=p===0?6:13,other=p===0?13:6;let n=b[legal.from],to=legal.from;b[to]=0;while(n){to=(to+1)%14;if(to===other)continue;b[to]++;n--;}
  if((p===0?to<6:to>=7&&to<13)&&b[to]===1&&b[12-to]>0){b[store]+=b[12-to]+1;b[12-to]=0;b[to]=0;}
  s.turn=to===store?p:1-p;
  if(!sum(b.slice(0,6))||!sum(b.slice(7,13))){b[6]+=sum(b.slice(0,6));b[13]+=sum(b.slice(7,13));for(let i=0;i<14;i++)if(i!==6&&i!==13)b[i]=0;winByScore(s,[b[6],b[13]],'All remaining stones have been swept.');}
 }
 else if(id==='dots-boxes'){
  s.edges[legal.edge]=mark;let gained=0;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=y*4+x,edges=[y*4+x,(y+1)*4+x,20+y*5+x,20+y*5+x+1];if(!b[i]&&edges.every(e=>s.edges[e])){b[i]=mark;s.scores[p]++;gained++;}}
  s.turn=gained?p:1-p;if(b.every(Boolean))winByScore(s,s.scores,'Every box has an owner.');
 }
 else if(id==='hex'){
  if(legal.swap)s.colors.reverse();else b[legal.to]=s.colors[p];
  s.turn=1-p;for(const color of [1,2])if(hexWins(s,color))finish(s,s.colors.indexOf(color),'Connected the two edges.');
 }
 else if(id==='nine-mens-morris'){
  if(legal.take!==undefined){b[legal.take]=0;s.capture=false;s.quiet=0;s.turn=1-p;}
  else {if(legal.from!==undefined){b[legal.from]=0;s.quiet++;}else{s.reserve[p]--;s.quiet=0;}b[legal.to]=mark;if(inMill(s,legal.to)&&count(b,1-p)>0){s.capture=true;return s;}s.turn=1-p;}
  if(s.reserve[s.turn]===0&&(count(b,s.turn)<3||morrisMoves(s).length===0))finish(s,p,'Too few pieces or no legal move.');
  else if(s.quiet>=100)finish(s,null,'Fifty moves each without a capture.');
 }
 if(!ended(s)){remember(s);if(s.draw&&id==='oware'){s.draw=false;for(let q=0;q<2;q++)s.scores[q]+=sum(s.board.filter((_,i)=>side(i,q)));s.board.fill(0);winByScore(s,s.scores,'Repeated position: remaining seeds credited by row.');}}
 return s;
}
export function publicBoard(s){const {history,...state}=s;return state;}
