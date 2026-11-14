import type {Game} from './PlayRoom';
import type {Party} from './Multiplayer';
import {gameCover} from './game-art';

export type RoomSetupProps = {
  game: Game;
  initialEntry?: string;
  created: (room: Party) => void;
  authorize?: (entry: string, create: () => Promise<void>) => void;
};

export function RoomSetupHeading({game,solo=false}: {game: Game;solo?: boolean}) {
  return <div className="room-setup-heading">
    <img src={gameCover(game)} alt=""/>
    <div><span>{game.genre || game.label}</span><h3>{game.title}</h3><p>{solo?'Choose your game options, then start your run.':'Choose your room options, then invite your friends.'}</p></div>
  </div>;
}
