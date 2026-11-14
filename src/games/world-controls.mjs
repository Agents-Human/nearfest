const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',Space:'attack',KeyJ:'attack',KeyK:'block',ShiftLeft:'block',ShiftRight:'block',KeyF:'fire'};

export function worldControlKey(code,game){
 if(game==='pocket-racers'){
  if(code==='KeyN')return 'attack';
  if(code==='Space'||code==='KeyJ')return undefined;
 }
 return keys[code];
}
