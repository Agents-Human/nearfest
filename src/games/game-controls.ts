export type ControlBinding = {
  action: string;
  keys?: readonly (readonly string[])[];
  pointer?: string;
  touch: readonly string[];
};
type GameIdentity = {id: string; engine?: string};
const move: ControlBinding = {action:'Move',keys:[['W','A','S','D'],['↑','←','↓','→']],touch:['↑','←','↓','→']};
const sideways: ControlBinding = {action:'Move',keys:[['A','D'],['←','→']],touch:['←','→']};
const key = (action:string, keys:string[][], ...touch:string[]):ControlBinding => ({action,keys,touch});
const point = (action:string, target:string):ControlBinding => ({action,pointer:`Click ${target}`,touch:[`Tap ${target}`]});
const type = (action:string):ControlBinding => ({action,pointer:'Type in the field',touch:['On-screen keyboard']});
const submit = (label:string):ControlBinding => ({action:'Submit',keys:[['Enter']],touch:[label]});
const pieceMove = [point('Choose piece','a piece'),point('Move','a legal destination')];

const controls: Record<string, readonly ControlBinding[]> = {
  'platform-relay':[sideways,key('Jump',[['W'],['↑']],'Jump'),key('Shoot',[['Space'],['J']],'Shoot')],
  'tappy-plane':[{action:'Climb',keys:[['Space'],['↑']],pointer:'Click play area',touch:['Tap play area']}],
  'pocket-racers':[
    {...sideways,action:'Steer'},key('Accelerate',[['W'],['↑']],'Accelerate'),key('Brake',[['S'],['↓']],'Brake'),
    key('Drift',[['Shift']],'Drift'),key('Nitro',[['N']],'Nitro'),key('Fire',[['F']],'Fire'),
  ],
  'stick-rivals':[sideways,key('Jump / air flip',[['W'],['↑']],'Jump'),key('Attack / combo',[['Space'],['J']],'Attack'),key('Kick / dropkick',[['S'],['↓']],'Kick'),key('Guard / parry',[['Shift'],['K']],'Guard'),key('Throw / blast',[['F']],'Throw / Blast')],
  'pocket-soccer':[move,key('Kick',[['Space'],['J']],'Kick')],
  'cat-defense':[move,key('Shoot',[['Space'],['J']],'Shoot'),key('Shockwave',[['Shift'],['K']],'Shockwave')],
  'marble-run':[{...sideways,action:'Steer'},key('Jump / air hop',[['Space'],['W']],'Jump')],
  'tank-arena':[{...move,action:'Drive'},key('Fire',[['Space'],['J']],'Fire'),key('Dash',[['Shift'],['K']],'Dash')],
  'paddle-duel':[key('Move paddle',[['W','S'],['↑','↓']],'↑','↓')],
  'air-hockey':[move],
  'snake-arena':[move],
  'bomb-maze':[move,key('Place foam',[['Space'],['J']],'Foam')],
  'mini-golf':[point('Aim','the green'),{action:'Set power',pointer:'Drag Power slider',touch:['Slide Power']},point('Shoot','Take your shot')],
  'marble-knockout':[{...move,action:'Steer'}],
  'kitchen-rush':[move,point('Use station','Interact with nearby station')],
  'paint-tag':[move,key('Tag',[['Space'],['J']],'Tag')],
  'orbit-rescue':[key('Steer',[['A','D'],['←','→']],'←','→'),key('Thrust',[['W'],['↑']],'↑'),key('Brake',[['S'],['↓']],'↓'),key('Dock',[['Space'],['J']],'Dock')],
  'bridge-builders':[{action:'Grow / drop',keys:[['Space']],pointer:'Hold, then release play area',touch:['Hold, then release play area']}],
  'town-council':[move,key('Run (hold)',[['Shift']]),{action:'Interact',keys:[['E']],touch:['Nearby prompt']}],
  'castaway-crew':[move,key('Run (hold)',[['Shift']]),{action:'Interact',keys:[['E']],touch:['Nearby prompt']}],
  'draw-guess':[{action:'Draw',pointer:'Drag on canvas',touch:['Drag on canvas']},type('Guess'),submit('Guess')],
  'word-hunt':[point('Build word','neighbouring letters'),point('Submit','Claim word')],
  'word-relay':[type('Your word'),submit('Pass it on')],
  'category-sprint':[type('Category answers'),point('Save','Save my answers')],
  'clue-crew':[type('Clue / guess'),submit('Send clue / Guess')],
  'bluff-club':[type('Your bluff'),point('Save','Save my bluff'),point('Vote','an answer')],
  'deduction-club':[point('Inspect','a station'),point('Vote','a suspect')],
  'maths-tug':[type('Your answer'),submit('Pull!')],
  'equation-forge':[type('Your expression'),submit('Forge it')],
  'circuit-crew':[point('Rotate','a wire tile'),point('Switch','Switch on / off')],
  'molecule-match':[point('Make a bond','two atoms'),point('Remove a bond','Add bonds · tap to remove')],
  'sudoku-race':[point('Choose cell','an empty cell'),point('Enter digit','a number button'),point('Check','Check my solution')],
  'codebreakers':[point('Set digits','+ / −'),point('Check','Check the code')],
  'chess-online':pieceMove,
  chess:pieceMove,
  checkers:pieceMove,
  oware:[point('Sow','one of your houses')],
  kalah:[point('Sow','one of your pits')],
  'connect-four':[point('Drop disc','a column')],
  'dots-boxes':[point('Draw line','an empty edge')],
  reversi:[point('Place disc','a legal square')],
  hex:[point('Place stone','an empty hex')],
  'nine-mens-morris':[point('Place / select','a board point'),point('Move','a neighbouring point')],
  '2048':[{action:'Slide tiles',keys:[['↑','←','↓','→']],touch:['Swipe the board','Direction buttons']}],
  memory:[point('Reveal pair','two cards')],
  lights:[point('Toggle','a light')],
  slide:[point('Slide','a tile beside the gap')],
  codebreaker:[point('Set colours','a slot, then a colour'),point('Check','Check guess')],
  'hundred-game-20-boomerang':[point('Throw / catch','the play area')],
};

export function controlsFor(game:GameIdentity):readonly ControlBinding[] {
  if(controls[game.id])return controls[game.id];
  if(!game.engine)return [key('Focus answer',[['Tab']]),{action:'Choose answer',keys:[['Enter']],pointer:'Click an answer',touch:['Tap an answer']}];
  return [];
}
