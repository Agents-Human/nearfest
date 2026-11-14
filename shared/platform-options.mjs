// Pure data shared by the lobby, renderer and authoritative simulation.
export const PLATFORM_CHARACTERS = Object.freeze(['pink', 'purple', 'teal', 'gold', 'blue', 'red', 'orange', 'lime', 'cyan', 'slate']);
export const PLATFORM_TINTS = Object.freeze({
  pink: '#f58aa5', purple: '#b194e8', teal: '#5fc9ad', gold: '#efc65b', blue: '#689fe8',
  red: '#ec6570', orange: '#ef9b59', lime: '#a9cf63', cyan: '#5bcada', slate: '#8da0b3',
});
export const PLATFORM_DEFAULT_LIVES = 3;
export const PLATFORM_MAX_LIVES = 9;

export function platformCharacter(value, seat = 0) {
  if (value === undefined) return PLATFORM_CHARACTERS[seat % PLATFORM_CHARACTERS.length];
  if (!PLATFORM_CHARACTERS.includes(value)) throw Error('Choose one of the ten character colors.');
  return value;
}

export function platformLives(value = PLATFORM_DEFAULT_LIVES) {
  if (!Number.isInteger(value) || value < 1 || value > PLATFORM_MAX_LIVES) {
    throw Error(`Choose between 1 and ${PLATFORM_MAX_LIVES} starting lives.`);
  }
  return value;
}

export function platformSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Choose valid game settings.');
  return {lives: platformLives(value.lives)};
}
