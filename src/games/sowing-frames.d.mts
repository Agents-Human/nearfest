export type SowFrame={board:number[];scores:number[];active:number;hand:number};
export function sowingFrames(previous:{game:string;board:number[];scores?:number[];moves:number},next:{board:number[];scores?:number[];moves:number;last:{from?:number}|null}):SowFrame[];
