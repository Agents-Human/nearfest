import {useId, useState} from 'react';
import {PLATFORM_CHARACTERS, PLATFORM_DEFAULT_LIVES, PLATFORM_MAX_LIVES, platformCharacter, platformLives, type PlatformCharacter} from '../shared/platform-options.mjs';
import Select from './Select';
import './platform-menu.css';

const storageKey = 'nearfest-platform-options';
type Preferences = {character: PlatformCharacter; lives: number};
const portraitFilters: Record<PlatformCharacter, string> = {
  pink: 'none', purple: 'hue-rotate(-70deg) saturate(.72)', teal: 'hue-rotate(175deg) saturate(.65)',
  gold: 'hue-rotate(73deg) saturate(.9)', blue: 'hue-rotate(-125deg) saturate(.8)',
  red: 'hue-rotate(16deg) saturate(1.4)', orange: 'hue-rotate(48deg) saturate(1.2)',
  lime: 'hue-rotate(108deg) saturate(.85)', cyan: 'hue-rotate(-162deg) saturate(.8)',
  slate: 'hue-rotate(-125deg) saturate(.18)',
};

export function PlatformPortrait({character, className}: {character: PlatformCharacter; className?: string}) {
  return <img className={className} src="/models/platform/icons/character-pink.png" style={{filter: portraitFilters[character]}} alt=""/>;
}

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {character: platformCharacter(saved.character), lives: platformLives(saved.lives)};
  } catch { return {character: 'pink', lives: PLATFORM_DEFAULT_LIVES}; }
}

export function usePlatformPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  function change(patch: Partial<Preferences>) {
    setPreferences(previous => {
      const next = {...previous, ...patch};
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Private browsing can disable storage. */ }
      return next;
    });
  }
  return [preferences, change] as const;
}

export default function PlatformMenu({character, lives, onCharacter, onLives, disabled = false, online = false}: {
  character: PlatformCharacter;
  lives: number;
  onCharacter: (color: PlatformCharacter) => void;
  onLives?: (lives: number) => void;
  disabled?: boolean;
  online?: boolean;
}) {
  const id = useId();
  return <section className="platform-menu" aria-label="Astro Climb game menu">
    <div className="platform-menu-heading"><span>YOUR ADVENTURE</span><b>Make it your run.</b></div>
    <fieldset disabled={disabled}>
      <legend>Choose your color</legend>
      <p id={`${id}-color-note`}>Same moves. Same speed. Just your favorite color.</p>
      <div className="platform-character-options">
        {PLATFORM_CHARACTERS.map(color => <label key={color} className={`platform-character platform-character-${color}`}>
          <input type="radio" name={`${id}-character`} value={color} checked={character === color} aria-describedby={`${id}-color-note`} onChange={() => onCharacter(color)}/>
          <span><PlatformPortrait character={color}/><b>{color}</b><i aria-hidden="true">{character === color ? '✓' : ''}</i></span>
        </label>)}
      </div>
    </fieldset>
    <fieldset className="platform-lives" disabled={disabled || !onLives}>
      <legend>Starting lives</legend>
      <div className="platform-lives-row"><div className="platform-lives-picker">
        <button type="button" aria-label="Fewer starting lives" disabled={lives <= 1} onClick={() => onLives?.(lives - 1)}>−</button>
        <Select aria-label="Starting lives" disabled={disabled || !onLives} value={lives} onChange={e => onLives?.(Number(e.target.value))}>
          {Array.from({length: PLATFORM_MAX_LIVES}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'life' : 'lives'}</option>)}
        </Select>
        <button type="button" aria-label="More starting lives" disabled={lives >= PLATFORM_MAX_LIVES} onClick={() => onLives?.(lives + 1)}>+</button>
      </div><span className="platform-life-mode">{lives === 1 ? 'One shot. Make it count.' : lives <= 3 ? 'The classic challenge.' : lives <= 6 ? 'A little room to explore.' : 'A longer adventure.'}</span></div>
    </fieldset>
    <p className="platform-menu-note">{online ? onLives ? 'Everyone starts with this many lives. Changing lives resets ready checks.' : `Host’s choice: ${lives} ${lives === 1 ? 'life' : 'lives'} for everyone.` : 'Lose a life, blink, bounce back. Lose them all and your run ends.'}</p>
  </section>;
}
