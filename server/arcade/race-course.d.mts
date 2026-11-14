export const RACE_SECONDS: number[];
export const DEFAULT_RACE_SECONDS: number;
export const RACE_BIOME_METRES: number;
export type RaceBiome = {id:string;name:string;subtitle:string;sky:string;haze:string;ground:string;shoulder:string;road:string;accent:string};
export const RACE_BIOMES: RaceBiome[];
export function raceBiome(distance:number): RaceBiome;
export function roadCenter(distance:number): number;
export function roadSlope(distance:number): number;
export function roadBend(distance:number): number;
export function roadHeight(distance:number): number;
export function roadGrade(distance:number): number;

export type RaceWater={id:number;start:number;end:number;left:number;right:number;kind:string;level:number};
export function raceWaterSections(start:number,end:number):RaceWater[];
export function raceWaterAt(distance:number,x?:number,elevation?:number):RaceWater|null;
export function raceWeather(elapsed:number,seed?:number):{rain:number;wet:number};
export function raceTarget(players:{x:number;y:number}[],seat:number):number;

export type RaceBridge={id:number;biome:number;start:number;end:number;waterLevel:number;name:string};
export type RaceRamp={id:number;start:number;end:number;x:number;width:number;height:number};
export function raceBridgeSections(start:number,end:number):RaceBridge[];
export function raceRampSections(start:number,end:number):RaceRamp[];
export function raceRampHeight(distance:number,x:number):number;
export function raceRampGrade(distance:number,x:number):number;
export function raceTerrainHeight(distance:number,x:number):number;
export function raceSceneryAllowed(distance:number,radius?:number):boolean;
export function raceTrafficX(vehicle:{x:number},distance:number):number;
