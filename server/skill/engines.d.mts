export type Move={from?:number;to?:number;column?:number;edge?:number;take?:number;swap?:boolean;pass?:boolean;promotion?:string;claim?:boolean};
export type BoardState={game:string;turn:number;board:number[];scores?:number[];edges?:number[];reserve?:number[];capture?:boolean;forced?:number|null;colors?:number[];moves:number;last:Move|null;winner:number|null;draw:boolean;reason:string;history:Record<string,number>;quiet?:number;fen?:string;check?:boolean;positions?:Record<string,number>;notation?:string[]};
export function initialState(id:string):BoardState;
export function legalMoves(state:BoardState):Move[];
export function applyMove(state:BoardState,move:Move):BoardState;
export function ended(state:BoardState):boolean;
export function publicBoard(state:BoardState):BoardState;
export const morrisPoints:number[][];
