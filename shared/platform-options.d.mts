export type PlatformCharacter = 'pink' | 'purple' | 'teal' | 'gold' | 'blue' | 'red' | 'orange' | 'lime' | 'cyan' | 'slate';
export const PLATFORM_CHARACTERS: readonly PlatformCharacter[];
export const PLATFORM_TINTS: Readonly<Record<PlatformCharacter, string>>;
export const PLATFORM_DEFAULT_LIVES: number;
export const PLATFORM_MAX_LIVES: number;
export function platformCharacter(value?: unknown, seat?: number): PlatformCharacter;
export function platformLives(value?: unknown): number;
export function platformSettings(value?: unknown): {lives: number};
