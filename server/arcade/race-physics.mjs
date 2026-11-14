import Matter from 'matter-js';

const { Engine, Bodies, Body, Composite } = Matter;

const BASE_DELTA_MS = 1000 / 60;
const ROAD_MIN_X = 350;
const ROAD_MAX_X = 610;

export const KART_ROSTER = [
  'race',
  'race-future',
  'sedan-sports',
  'hatchback-sports',
  'suv-luxury',
];

export const TRAFFIC_MODELS = [
  'police',
  'taxi',
  'sedan-sports',
  'ambulance',
  'suv',
  'delivery',
  'firetruck',
  'truck',
  'van',
  'sedan',
  'tractor',
  'race-future',
];

export const HAZARD_MODELS = ['barrier', 'tires', 'barrel'];

export function createRaceTraffic() {
  return Array.from({ length: 24 }, (_, i) => {
    const isHazard = i % 4 === 0;
    const lane = [390, 480, 570, 435, 525][i % 5];
    const model = isHazard
      ? HAZARD_MODELS[(i / 4) % HAZARD_MODELS.length | 0]
      : TRAFFIC_MODELS[i % TRAFFIC_MODELS.length];
    return {
      id: i,
      x: lane,
      distance: 720 + i * 335,
      speed: isHazard ? 0 : [48, 62, 54, 72, 42][i % 5],
      kind: isHazard ? 'barrier' : 'car',
      model,
      hitUntil: 0,
      hitDir: 0,
    };
  });
}

export function createRaceBoostPads() {
  return Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: [480, 395, 565, 435, 525][i % 5],
    distance: 420 + i * 580,
  }));
}

/**
 * Steps a deterministic Matter.js top-down kart physics simulation for one tick (dt = 0.05s).
 * Replaces sudden binary steering with smooth lateral velocity, counter-steering grip,
 * drift lean, turbo boost strips, wheel-to-wheel bumping, and dramatic crash physics.
 */
export function stepRaceWorld(s, cs, dt, clamp, ranked) {
  const engine = Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
  });

  const kartBodies = new Map();
  const beforeY = new Map();

  for (let i = 0; i < s.players.length; i++) {
    const p = s.players[i];
    const c = cs[i] || {};
    if (!p.kart) p.kart = KART_ROSTER[i % KART_ROSTER.length];
    if (!Array.isArray(p.collected)) p.collected = [];
    p.vx = p.vx ?? 0;
    p.steer = p.steer ?? 0;
    p.drift = p.drift ?? 0;
    p.crashTimer = Math.max(0, +((p.crashTimer || 0) - dt).toFixed(3));
    p.padBoost = Math.max(0, +((p.padBoost || 0) - dt).toFixed(3));

    if (p.finish !== null) continue;

    beforeY.set(i, p.y);
    p.invulnerable = Math.max(0, +(p.invulnerable - dt).toFixed(3));

    const manualBoost = Boolean((c.attack || c.up) && p.boost > 0);
    const padActive = p.padBoost > 0;
    p.boosting = manualBoost || padActive;
    p.boost = clamp(+(p.boost + (manualBoost ? -30 : 8) * dt).toFixed(2), 0, 100);

    const desired = c.down || c.block ? 130 : padActive ? 350 : p.boosting ? 335 : 235;
    const accel = p.boosting ? 185 : 150;
    p.speed =
      p.speed < desired
        ? Math.min(desired, +(p.speed + accel * dt).toFixed(2))
        : Math.max(desired, +(p.speed - 260 * dt).toFixed(2));

    // Smooth velocity-based kart steering with counter-steer responsiveness
    const dir = Number(Boolean(c.right)) - Number(Boolean(c.left));
    const maxLat = p.boosting ? 245 : 230;
    if (dir !== 0) {
      const counter = p.vx !== 0 && Math.sign(dir) !== Math.sign(p.vx);
      const latAccel = counter ? 1850 : 1280;
      p.vx = clamp(+(p.vx + dir * latAccel * dt).toFixed(2), -maxLat, maxLat);
    } else {
      // Smooth tire-grip decay instead of abrupt stop
      p.vx = Math.abs(p.vx) < 4 ? 0 : +(p.vx * 0.72).toFixed(2);
    }

    p.steer = +((p.steer || 0) * 0.52 + dir * 0.48).toFixed(3);
    if (dir !== 0 && p.speed > 195) {
      p.drift = clamp(+((p.drift || 0) + dt * 1.6).toFixed(2), 0, 1);
    } else {
      p.drift = clamp(+((p.drift || 0) - dt * 2.6).toFixed(2), 0, 1);
    }

    const body = Bodies.circle(p.x, p.y, 13, {
      frictionAir: 0,
      friction: 0,
      restitution: 0.65,
      collisionFilter: { group: -1 },
      label: `kart-${i}`,
    });
    Body.setVelocity(body, {
      x: p.vx * (BASE_DELTA_MS / 1000),
      y: p.speed * (BASE_DELTA_MS / 1000),
    });
    kartBodies.set(i, body);
    Composite.add(engine.world, body);
  }

  // Step 3 substeps (3 * 16.667ms = 50ms = dt)
  const substeps = Math.max(1, Math.round(dt / (1 / 60)));
  for (let step = 0; step < substeps; step++) {
    Engine.update(engine, BASE_DELTA_MS);
  }

  // Apply Matter.js integrated positions, guardrails, traffic crashes, boost pads & pickups
  for (let i = 0; i < s.players.length; i++) {
    const p = s.players[i];
    if (p.finish !== null) continue;
    const body = kartBodies.get(i);
    const before = beforeY.get(i) ?? p.y;

    let nextX = body.position.x;
    if (nextX < ROAD_MIN_X) {
      nextX = ROAD_MIN_X;
      p.vx = p.vx < -85 ? Math.abs(p.vx) * 0.35 : 0;
    } else if (nextX > ROAD_MAX_X) {
      nextX = ROAD_MAX_X;
      p.vx = p.vx > 85 ? -Math.abs(p.vx) * 0.35 : 0;
    }

    p.x = +clamp(nextX, ROAD_MIN_X, ROAD_MAX_X).toFixed(2);
    p.y = +body.position.y.toFixed(2);
    p.progress = p.y / s.courseLength;

    // Smooth yaw heading derived from actual lateral velocity + front wheel steer
    const targetHeading = (p.vx / 235) * 0.22;
    p.heading = +((p.heading || 0) * 0.45 + targetHeading * 0.55).toFixed(4);

    // Check traffic & road obstacle collisions
    for (const vehicle of s.traffic || []) {
      const z = vehicle.distance + vehicle.speed * s.elapsed;
      const oldZ = z - vehicle.speed * dt;
      if (
        p.invulnerable === 0 &&
        Math.abs(p.x - vehicle.x) < 29 &&
        before <= oldZ + 35 &&
        p.y >= z - 35
      ) {
        p.speed = Math.max(75, +(p.speed * 0.38).toFixed(2));
        p.crashes += 1;
        p.invulnerable = 1.25;
        p.crashTimer = 0.72;
        const pushDir =
          Math.abs(p.x - vehicle.x) < 2
            ? vehicle.x >= 480
              ? -1
              : 1
            : Math.sign(p.x - vehicle.x);
        p.vx = pushDir * 145;
        p.x = +clamp(p.x + pushDir * 10, ROAD_MIN_X, ROAD_MAX_X).toFixed(2);
        vehicle.hitUntil = +(s.elapsed + 0.85).toFixed(2);
        vehicle.hitDir = -pushDir;
      }
    }

    // Check turbo boost pads on the highway
    for (const pad of s.boostPads || []) {
      if (
        Math.abs(p.x - pad.x) < 32 &&
        before <= pad.distance + 28 &&
        p.y >= pad.distance - 28
      ) {
        p.padBoost = 0.55;
        p.boosting = true;
        p.speed = Math.min(350, +(p.speed + 42).toFixed(2));
        p.boost = Math.min(100, +(p.boost + 14).toFixed(2));
      }
    }

    // Check gold coin pickups
    for (const item of s.pickups || []) {
      if (
        !p.collected.includes(item.id) &&
        Math.abs(p.x - item.x) < 35 &&
        before <= item.distance + 25 &&
        p.y >= item.distance - 25
      ) {
        p.collected.push(item.id);
        p.coins += 1;
        p.boost = Math.min(100, p.boost + 8);
      }
    }

    if (p.y >= s.courseLength) {
      p.finish = s.elapsed - dt + (dt * (s.courseLength - before)) / Math.max(1e-6, p.y - before);
    }
  }

  // Wheel-to-wheel kart bumping when players in adjacent lanes rub tires
  for (let i = 0; i < s.players.length; i++) {
    for (let j = i + 1; j < s.players.length; j++) {
      const a = s.players[i];
      const b = s.players[j];
      if (a.finish !== null || b.finish !== null) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) >= 4 && Math.abs(dx) < 25 && Math.abs(dy) < 24) {
        const sign = Math.sign(dx);
        a.vx = clamp(+(a.vx - sign * 85).toFixed(2), -240, 240);
        b.vx = clamp(+(b.vx + sign * 85).toFixed(2), -240, 240);
      }
    }
  }

  if (s.players.some((p) => p.finish !== null)) {
    ranked(
      s,
      s.players.map((p) => p.finish ?? Infinity),
      'Coastal sprint complete!',
      true
    );
  } else if (s.elapsed >= 120) {
    ranked(
      s,
      s.players.map((p) => p.y),
      'Furthest along the coast wins.'
    );
  }
}

export function raceBotControls(s, i, c) {
  const p = s.players[i];
  const lookAhead = 350;
  const threats = (s.traffic || []).filter((v) => {
    const z = v.distance + v.speed * s.elapsed;
    return z > p.y - 25 && z < p.y + lookAhead;
  });

  // Find safest lane with bonus for nearby coins or boost pads
  const lanes = [390, 480, 570];
  let bestLane = p.x;
  let bestScore = -Infinity;

  for (const lane of lanes) {
    let score = -Math.abs(lane - p.x) * 0.15;
    for (const v of threats) {
      const z = v.distance + v.speed * s.elapsed;
      const distZ = Math.max(10, z - p.y);
      if (Math.abs(lane - v.x) < 52) {
        score -= 9000 / distZ;
      }
    }
    for (const item of s.pickups || []) {
      if (!p.collected?.includes(item.id) && item.distance > p.y && item.distance < p.y + 260) {
        if (Math.abs(lane - item.x) < 40) score += 25;
      }
    }
    for (const pad of s.boostPads || []) {
      if (pad.distance > p.y && pad.distance < p.y + 260 && Math.abs(lane - pad.x) < 40) {
        score += 35;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestLane = lane;
    }
  }

  c.left = p.x > bestLane + 10;
  c.right = p.x < bestLane - 10;
  c.attack = p.boost > 35 && threats.every((v) => Math.abs(p.x - v.x) >= 44);
}
