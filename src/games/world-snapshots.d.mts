export class WorldSnapshots {
  readonly latest: any;
  push(state: any, now: number): void;
  sample(now: number): any;
}
