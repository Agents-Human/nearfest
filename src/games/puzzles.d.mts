export function shuffle<T>(values:T[]):T[];
export function toggleLights(board:boolean[],index:number):boolean[];
export function lightBoard():boolean[];
export function slideTile(board:number[],index:number):number[];
export function slideBoard():number[];
export function solvedSlide(board:number[]):boolean;
export function codeClue(secret:number[],guess:number[]):{exact:number;nearby:number};
