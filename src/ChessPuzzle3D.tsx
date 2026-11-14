import {useMemo} from 'react';
import {Chess} from 'chess.js';
import {initialState,legalMoves} from '../server/skill/engines.mjs';
import ChessBoard from './ChessBoard';
import BoardWorld from './BoardWorld';
const square=(i:number)=>'abcdefgh'[i%8]+(8-Math.floor(i/8));
export default function ChessPuzzle3D({pieces,busy,answer}:{pieces:Record<string,string>;busy:boolean;answer:(move:string)=>void}){
 const state=useMemo(()=>{const rows=Array.from({length:8},(_,r)=>{let row='',empty=0;for(let c=0;c<8;c++){const piece=pieces[square(r*8+c)];if(piece){if(empty)row+=empty;empty=0;row+=piece;}else empty++;}if(empty)row+=empty;return row;});const fen=rows.join('/')+' w - - 0 1',chess=new Chess(fen),values:Record<string,number>={p:1,n:2,b:3,r:4,q:5,k:6};return {...initialState('chess-online'),fen,board:chess.board().flat().map(p=>p?values[p.type]*(p.color==='w'?1:-1):0),check:chess.isCheck()};},[JSON.stringify(pieces)]);
 const moves=busy?[]:legalMoves(state),move=(m:{from?:number;to?:number})=>{if(m.from!==undefined&&m.to!==undefined)answer(square(m.from)+square(m.to));};
 return <BoardWorld state={state} side={0} moves={moves} move={move} fallback={<ChessBoard state={state} side={0} moves={moves} move={move}/>}/>;
}
