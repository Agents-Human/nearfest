import type {Game} from './PlayRoom';

export const gameCover = (game: Game) => `/art/game-covers/${game.art || game.id}.svg`;
export const gameTitle = (game: Game) => game.title === game.title.toUpperCase()
  ? game.title.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase())
  : game.title;
