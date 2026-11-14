// Presentation only: scoring and legality always come from the shared rules engine.
export function sowingFrames(previous, next) {
 if(previous.game!=='oware'||next.moves!==previous.moves+1||next.last?.from===undefined)return [];
 const from=next.last.from,n=previous.board[from];
 if(!n)return [];
 const board=[...previous.board],scores=[...previous.scores],frames=[];board[from]=0;
 frames.push({board:[...board],scores,active:from,hand:n});
 let at=from;
 for(let drop=0;drop<n;drop++){do{at=(at+1)%12;}while(at===from);board[at]++;frames.push({board:[...board],scores,active:at,hand:n-drop-1});}
 frames.push({board:[...next.board],scores:[...next.scores],active:at,hand:0});
 return frames;
}
