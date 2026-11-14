const STEP_MS = 50;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp = (a, b, f) => a + (b - a) * f;

/** A monotonic presentation clock, separate from the authoritative 20 Hz world.
 * Keep two ticks in reserve for network jitter. Never extrapolate collisions or
 * rewind the picture when an early/late packet changes the estimated clock.
 */
export class WorldSnapshots {
  snapshots = [];
  cursor = null;
  sampledAt = null;

  get latest() { return this.snapshots.at(-1)?.state; }

  push(state, now) {
    const previous = this.latest;
    if (previous && (state.tick < previous.tick ||
      state.tick === previous.tick && state.finished === previous.finished)) return;
    this.snapshots.push({state, at: now});
    if (this.snapshots.length > 32) this.snapshots.shift();
  }

  sample(now) {
    const newest = this.snapshots.at(-1);
    if (!newest) return null;
    const latest = newest.state;
    if (latest.finished) return latest;
    const oldest = this.snapshots[0].state.tick;
    const target = latest.tick - 2 + clamp((now - newest.at) / STEP_MS, 0, 2);
    // Fill the initial reserve before starting playback, rather than running
    // into the newest packet and freezing for part of every 50 ms tick.
    if (latest.tick - oldest < 2) {
      this.cursor = oldest;
      this.sampledAt = now;
      return this.snapshots[0].state;
    }
    if (this.cursor === null || this.sampledAt === null || now - this.sampledAt > 1000) {
      this.cursor = Math.max(oldest, target);
    } else {
      const elapsed = Math.max(0, now - this.sampledAt) / STEP_MS;
      // Correct clock drift gradually; packet arrival never resets the cursor.
      const rate = 1 + clamp((target - this.cursor) * .12, -.15, .15);
      this.cursor = Math.max(oldest, Math.min(latest.tick, this.cursor + elapsed * rate));
    }
    this.sampledAt = now;

    let a = this.snapshots[0].state, b = latest;
    for (let i = 1; i < this.snapshots.length; i++) {
      const next = this.snapshots[i].state;
      if (next.tick > this.cursor) { b = next; break; }
      a = next;
    }
    if (a === b || this.cursor >= b.tick) return b;
    const f = clamp((this.cursor - a.tick) / (b.tick - a.tick), 0, 1);
    // Racing can cover 95 units per tick (bolts). Scale the snap guard across lost packets.
    const blend = (p, q) => {
      if (!q || !Number.isFinite(p.x) || !Number.isFinite(q.x) ||
        Math.hypot(p.x - q.x, p.y - q.y) > (a.game === 'pocket-racers' ? Math.max(130, (b.tick-a.tick)*110) : 130)) return p;
      const entity = {...p, x: lerp(p.x, q.x, f), y: lerp(p.y, q.y, f)};
      for (const key of ['height', 'elevation', 'verticalSpeed', 'airTime', 'life', 'vx', 'steer', 'speed', 'driftCharge']) if (Number.isFinite(p[key]) && Number.isFinite(q[key])) entity[key] = lerp(p[key], q[key], f);
      if (Number.isFinite(p.heading) && Number.isFinite(q.heading)) entity.heading = p.heading + Math.atan2(Math.sin(q.heading - p.heading), Math.cos(q.heading - p.heading)) * f;
      if (a.game === 'bridge-builders') for (const key of ['length', 'rotation']) {
        if (Number.isFinite(p[key]) && q[key] >= p[key]) entity[key] = lerp(p[key], q[key], f);
      }
      return entity;
    };
    // Discrete state, entity membership, and positions share the same timeline.
    // In particular, shots must not jump at 20 Hz while the runner moves at 60+ Hz.
    const result = {...a, tick: this.cursor, elapsed: lerp(a.elapsed, b.elapsed, f), players: a.players.map((p, i) => blend(p, b.players[i]))};
    for (const key of ['ball', 'ship']) if (a[key]) result[key] = blend(a[key], b[key]);
    const collections = a.game === 'platform-relay' ? ['platforms', 'enemies', 'springs', 'coins', 'hazards', 'shots'] : a.game === 'cat-defense' ? ['enemies', 'shots'] : a.game === 'pocket-racers' ? ['shots'] : a.game === 'stick-rivals' ? ['beams'] : [];
    for (const key of collections) {
      const next = new Map((b[key] || []).map(entity => [entity.id, entity]));
      result[key] = (a[key] || []).map(entity => blend(entity, next.get(entity.id)));
    }
    if (Number.isFinite(a.stormX)) result.stormX = lerp(a.stormX, b.stormX, f);
    return result;
  }
}
