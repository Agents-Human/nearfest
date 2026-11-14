import type {Game} from './PlayRoom';

const paintedBoards = new Set(['oware', 'checkers', 'connect-four', 'dots-boxes', 'reversi', 'kalah', 'hex', 'nine-mens-morris']);
const arcadeCovers=new Set(['marble-run','tank-arena','chess-online','pocket-racers','stick-rivals','paddle-duel','air-hockey','snake-arena','bomb-maze','mini-golf','marble-knockout','kitchen-rush','paint-tag','platform-relay','draw-guess','word-hunt','word-relay','category-sprint','clue-crew','bluff-club','deduction-club','maths-tug','equation-forge','circuit-crew','orbit-rescue','bridge-builders','molecule-match','sudoku-race','codebreakers']);
const gameplayCovers=new Set(['pocket-soccer','cat-defense','bridge-builders','pocket-racers','platform-relay','mini-golf','stick-rivals','marble-run','tank-arena']);
const tableCovers=new Set(['chess-online','oware','checkers','reversi','connect-four','dots-boxes','hex','nine-mens-morris']);
export const gameCoverById = (id: string) => id==='tappy-plane'?'/art/action-games/tappy-plane.png':['town-council','castaway-crew'].includes(id)?`/art/simulation/${id}.svg`:tableCovers.has(id)?`/art/skill-games/${id}-3d.jpg`:id==='chess'?'/art/skill-games/chess-online-3d.jpg':gameplayCovers.has(id)?`/art/action-games/${id}-gameplay.jpg`:arcadeCovers.has(id)?`/art/action-games/${id}.svg`:paintedBoards.has(id)
  ? `/art/skill-games/${id}.webp`
  : `/art/game-covers/${id}.svg`;
export const gameCover = (game: Game) => gameCoverById(game.art || game.id);
export const gameTitle = (game: Game) => game.title === game.title.toUpperCase()
  ? game.title.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase())
  : game.title;
