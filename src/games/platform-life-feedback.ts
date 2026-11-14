type RunnerLife = {lives?: number; alive: boolean; damageCount?: number};

/** Three deliberate blinks per life lost, independent of packet/render frequency. */
export class PlatformLifeFeedback {
  private previous: RunnerLife;
  private age = Infinity;

  constructor(player: RunnerLife) { this.previous = {...player}; }

  update(player: RunnerLife, dt: number) {
    const lostLife = (player.lives ?? 3) < (this.previous.lives ?? 3);
    const died = this.previous.alive && !player.alive;
    const hit = (player.damageCount ?? 0) > (this.previous.damageCount ?? 0);
    this.age = lostLife || died || hit ? 0 : this.age + Math.max(0, dt);
    this.previous = {lives: player.lives, alive: player.alive, damageCount: player.damageCount};
    // The body is visible between blinks and stays visible in its final pose.
    return this.age >= 1.2 || this.age % .4 >= .14;
  }
}
