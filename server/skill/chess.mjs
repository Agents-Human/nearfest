import {Chess} from 'chess.js';
const values={p:1,n:2,b:3,r:4,q:5,k:6};
const square=i=>'abcdefgh'[i%8]+(8-Math.floor(i/8));
const index=s=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
const key=chess=>chess.fen().split(' ').slice(0,4).join(' ');
function fill(s,chess){s.fen=chess.fen();s.board=chess.board().flat().map(p=>p?values[p.type]*(p.color==='w'?1:-1):0);s.turn=chess.turn()==='w'?0:1;s.check=chess.isCheck();return s;}
const end=(s,winner,reason)=>Object.assign(s,{winner,draw:winner===null,reason});
export function initialChess(fen){const c=new Chess(fen),s={game:'chess-online',board:[],turn:0,winner:null,draw:false,reason:'',moves:0,last:null,history:{},positions:{[key(c)]:1},notation:[]};fill(s,c);return s;}
function claimable(s,c){return (s.positions?.[key(c)]||0)>=3||Number(c.fen().split(' ')[4])>=100;}
export function chessMoves(s){if(s.winner!==null||s.draw)return [];const c=new Chess(s.fen),moves=c.moves({verbose:true}).map(m=>({from:index(m.from),to:index(m.to),...(m.promotion?{promotion:m.promotion}:{})})),claims=[];
 if(claimable(s,c))claims.push({claim:true});
 if(Number(s.fen.split(' ')[4])>=99||Object.values(s.positions||{}).some(n=>n>=2))for(const m of moves){const next=new Chess(s.fen);next.move({from:square(m.from),to:square(m.to),...(m.promotion?{promotion:m.promotion}:{})});if((s.positions?.[key(next)]||0)+1>=3||Number(next.fen().split(' ')[4])>=100)claims.push({...m,claim:true});}
 return [...moves,...claims];
}
export function applyChess(previous,input){const s=structuredClone(previous),c=new Chess(s.fen);if(input.claim){if(input.from!==undefined){c.move({from:square(input.from),to:square(input.to),...(input.promotion?{promotion:input.promotion}:{})});if((s.positions?.[key(c)]||0)+1<3&&Number(c.fen().split(' ')[4])<100)throw Error('The intended move does not permit a draw claim.');}else if(!claimable(s,c))throw Error('A draw cannot be claimed in this position.');return end(s,null,'Draw claimed: threefold repetition or fifty moves'+(input.from!==undefined?' by intended move.':'.'));}
 const m=c.move({from:square(input.from),to:square(input.to),...(input.promotion?{promotion:input.promotion}:{})});s.moves++;s.last=input;s.notation.push(m.san);s.positions[key(c)]=(s.positions[key(c)]||0)+1;fill(s,c);
 if(c.isCheckmate())end(s,1-s.turn,'Checkmate.');else if(c.isStalemate())end(s,null,'Stalemate.');else if(c.isInsufficientMaterial())end(s,null,'Dead position: insufficient mating material.');else if(s.positions[key(c)]>=5)end(s,null,'Automatic fivefold repetition.');else if(Number(s.fen.split(' ')[4])>=150)end(s,null,'Automatic seventy-five-move draw.');return s;
}
// Material-based impossibility, including minor-piece flag-fall cases. A king
// alone never wins on time. Bishops all on one colour cannot create a mate.
export function hasMatingMaterial(s,side){const pieces=s.board.flatMap((v,i)=>v?[{type:Math.abs(v),side:v>0?0:1,square:i}]:[]),mine=pieces.filter(p=>p.side===side),other=pieces.filter(p=>p.side!==side);
 if(mine.some(p=>[1,4,5].includes(p.type)))return true;
 if(mine.some(p=>p.type===2))return mine.length>2||other.some(p=>![5,6].includes(p.type));
 if(mine.some(p=>p.type===3)){if(pieces.some(p=>[1,2].includes(p.type)))return true;const colors=new Set(pieces.filter(p=>p.type===3).map(p=>(p.square%8+Math.floor(p.square/8))%2));return colors.size>1||other.some(p=>[4,5].includes(p.type));}
 return false;
}
