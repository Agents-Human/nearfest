import Matter from 'matter-js';

const {Bodies, Body, Query} = Matter;

export const BIOMES = [
  {id: 'grove', name: 'EMERALD GROVE', ground: 'ground-grass', trees: ['tree', 'pine'], details: ['flowers', 'mushrooms', 'plant', 'grass'], landAnimals: ['crab', 'hog', 'frog', 'slime'], airAnimals: ['bee'], waterAnimals: ['fish', 'piranha'], skyTop: '#5294c7', skyBottom: '#d2ebdc', fog: '#b3d4cf', water: '#228fa6'},
  {id: 'frost', name: 'FROSTBITE PEAKS', ground: 'ground-snow', trees: ['tree-snow', 'pine'], details: ['crate', 'rocks', 'stones'], landAnimals: ['penguin', 'polar', 'slime'], airAnimals: ['bat', 'bee'], waterAnimals: ['fish', 'piranha'], skyTop: '#3b5998', skyBottom: '#cbe3f5', fog: '#b8d0e8', water: '#1b6285'},
  {id: 'tropics', name: 'SUNBAKED ATOLL', ground: 'ground-fortified', trees: ['tree', 'tree'], details: ['barrel', 'rocks', 'flowers-tall', 'plant'], landAnimals: ['crab', 'frog', 'barnacle'], airAnimals: ['parrot', 'bee'], waterAnimals: ['piranha', 'fish'], skyTop: '#d96b43', skyBottom: '#f7d29c', fog: '#e8c39b', water: '#1ca39c'},
  {id: 'canopy', name: 'TWILIGHT CANOPY', ground: 'ground-grass', trees: ['pine', 'tree'], details: ['flowers-tall', 'mushrooms', 'barrel', 'grass'], landAnimals: ['monkey', 'spider', 'frog'], airAnimals: ['bat', 'parrot'], waterAnimals: ['piranha', 'fish'], skyTop: '#3a2459', skyBottom: '#b86b8f', fog: '#835879', water: '#1a5c54'},
  {id: 'volcano', name: 'VOLCANIC CITADEL', ground: 'ground-fortified', trees: ['pine', 'pine'], details: ['rocks', 'stones', 'crate', 'barrel'], landAnimals: ['tiger', 'snakeLava', 'spider'], airAnimals: ['bat', 'bee'], waterAnimals: ['piranha', 'fish'], skyTop: '#2b1118', skyBottom: '#c94a29', fog: '#8f3929', water: '#b83728'},
];

const ANIMAL_META = {
  fish: {label: 'leaping fish', speed: 0, w: 25, h: 25, flying: true},
  piranha: {label: 'leaping piranha', speed: 0, w: 25, h: 28, flying: true},
  crab: {label: 'island crab', speed: 52, w: 26, h: 22, flying: false},
  hog: {label: 'charging boar', speed: 70, w: 28, h: 24, flying: false},
  penguin: {label: 'sliding penguin', speed: 74, w: 26, h: 26, flying: false},
  polar: {label: 'polar bear', speed: 62, w: 30, h: 28, flying: false},
  monkey: {label: 'jungle monkey', speed: 72, w: 26, h: 26, flying: false},
  tiger: {label: 'citadel tiger', speed: 82, w: 30, h: 26, flying: false},
  frog: {label: 'leaping frog', speed: 58, w: 26, h: 22, flying: false},
  slime: {label: 'toxic slime', speed: 46, w: 26, h: 20, flying: false},
  spider: {label: 'jungle spider', speed: 68, w: 26, h: 22, flying: false},
  snakeLava: {label: 'lava serpent', speed: 54, w: 24, h: 34, flying: false},
  barnacle: {label: 'snapping barnacle', speed: 24, w: 25, h: 25, flying: false},
  bee: {label: 'giant bee', speed: 64, w: 26, h: 26, flying: true},
  parrot: {label: 'swooping parrot', speed: 72, w: 26, h: 26, flying: true},
  bat: {label: 'swooping bat', speed: 70, w: 26, h: 24, flying: true},
};

export function biomeForIsland(islandId) {
  return BIOMES[Math.floor(islandId / 5) % BIOMES.length];
}

export function platformPoseAt(floor, elapsed) {
  const baseX = floor.baseX ?? floor.x;
  const baseY = floor.baseY ?? floor.y;
  if (!floor.moving) return {x: baseX, y: baseY};
  const offset = Math.sin(elapsed * floor.moving.speed + floor.moving.phase) * floor.moving.range;
  return {
    x: floor.moving.axis === 'x' ? baseX + offset : baseX,
    y: floor.moving.axis === 'y' ? baseY + offset : baseY,
  };
}

export function extendPlatformCourse(s) {
  if (!s.springs) s.springs = [];
  if (!s.enemies) s.enemies = [];
  const lead = Math.max(...s.players.map(p => p.x));
  while (!s.platforms.length || (s.platforms.at(-1).baseX ?? s.platforms.at(-1).x) + s.platforms.at(-1).w < lead + 2600) {
    const i = s.nextIsland++;
    // Smooth progressive curve: 0 for the first 5 islands, then gradually ramps up to 1.0 by island 42
    const prog = Math.min(1, Math.max(0, (i - 4) / 38));
    const r = Math.abs(Math.sin(s.seed + i * 73.17));
    const r2 = Math.abs(Math.cos(s.seed * 0.7 + i * 41.93));
    const biome = biomeForIsland(i);
    const previous = s.platforms.at(-1);
    const prevBaseX = previous ? (previous.baseX ?? previous.x) : 0;
    const gap = previous ? 48 + Math.round(prog * 34 + r * 10) : 0;
    const baseX = previous ? prevBaseX + previous.w + gap : 0;
    const baseY = i === 0 ? 460 : [430, 395, 420, 450, 405, 370, 415][(i - 1) % 7];
    const w = i === 0 ? 460 : Math.round(350 - prog * 65 + r * 30);

    // Moving platforms start gently from island 6 onwards, ramping speed & range progressively
    let moving = null;
    if (i >= 6 && (i % 4 === 2 || (prog > 0.45 && i % 3 === 1))) {
      const axis = i >= 10 && i % 2 === 0 ? 'y' : 'x';
      const range = axis === 'x' ? Math.round(10 + prog * 10) : Math.round(14 + prog * 22);
      const speed = +(0.9 + prog * 1.35 + r2 * 0.25).toFixed(2);
      moving = {axis, range, speed, phase: +(r * 6.28).toFixed(2)};
    }

    const pose = platformPoseAt({baseX, baseY, moving}, s.elapsed || 0);
    const floor = {
      id: i,
      x: pose.x,
      y: pose.y,
      baseX,
      baseY,
      w,
      h: 85,
      vx: 0,
      vy: 0,
      biome: biome.id,
      moving,
    };
    s.platforms.push(floor);

    // Coins along the platform
    for (let j = 0; j < 3; j++) {
      const cx = baseX + w * (0.26 + j * 0.22);
      const cy = baseY - (moving?.axis === 'y' ? 70 : 56) - (j === 1 && i % 2 === 1 ? 16 : 0);
      s.coins.push({id: i * 3 + j, x: cx, y: cy, baseX: cx, baseY: cy, platformId: i, offsetX: w * (0.26 + j * 0.22), offsetY: -56 - (j === 1 && i % 2 === 1 ? 16 : 0), collectedBy: []});
    }

    // Spring bounce pads before high elevation climbs
    if (i >= 2 && (i % 4 === 2 || (baseY > 425 && i % 3 === 1))) {
      const offsetX = Math.round(w * 0.76);
      s.springs.push({id: i, platformId: i, offsetX, x: pose.x + offsetX, y: pose.y});
    }

    // Leaping water fish & piranhas: rare & gentle early on, frequent & high-leaping in deeper zones
    const spawnWaterEnemy = i >= 4 && previous && (prog < 0.25 ? i % 4 === 0 : prog < 0.55 ? i % 3 === 0 : i % 2 === 0);
    if (spawnWaterEnemy) {
      const gapCenterX = prevBaseX + previous.w + gap * 0.5;
      const peakY = Math.min(previous.baseY ?? previous.y, baseY) - Math.round(20 + prog * 34 + r2 * 18);
      const period = Math.max(1.55, +(2.85 - prog * 1.15).toFixed(2));
      const waterKind = biome.waterAnimals[i % biome.waterAnimals.length];
      s.enemies.push({
        id: i * 10 + 1,
        kind: waterKind,
        label: ANIMAL_META[waterKind].label,
        biome: biome.id,
        baseX: gapCenterX,
        x: gapCenterX,
        y: 530,
        vx: 0,
        vy: 0,
        waterY: 530,
        peakY,
        period,
        phase: +(r * 6.28).toFixed(2),
        facing: -1,
        submerged: true,
        alive: true,
      });
    }

    // Patrolling land & swooping air monsters: starts with slow single monsters at island 3, scales up progressively
    const spawnIslandMonster = i >= 3 && (prog < 0.2 ? !moving && i % 2 === 1 : prog < 0.5 ? i % 2 === 0 || i % 3 === 0 : true);
    if (spawnIslandMonster) {
      const useAir = i >= 8 && (prog > 0.4 ? i % 3 === 0 : i % 5 === 0);
      const pool = useAir ? biome.airAnimals : biome.landAnimals;
      const kind = pool[(i + Math.floor(r * 10)) % pool.length];
      const meta = ANIMAL_META[kind];
      const speed = Math.round(meta.speed * (0.72 + prog * 1.15));
      const offsetX = Math.round(w * 0.5);
      const baseOffsetY = useAir ? -62 : -20;
      s.enemies.push({
        id: i * 10 + 2,
        kind,
        label: meta.label,
        biome: biome.id,
        platformId: i,
        minOffset: 40,
        maxOffset: Math.max(80, w - 40),
        offsetX,
        baseOffsetY,
        x: pose.x + offsetX,
        y: pose.y + baseOffsetY,
        vx: (i % 2 === 0 ? 1 : -1) * speed,
        vy: 0,
        speed,
        flying: useAir,
        phase: +(r2 * 6.28).toFixed(2),
        facing: i % 2 === 0 ? 1 : -1,
        alive: true,
      });

      // Double-monster waves unlock in deeper zones (island 18+, Zone 4+)
      if (i >= 18 && prog > 0.35 && (i % 2 === 0 || prog > 0.65)) {
        const secondAir = !useAir && i % 2 === 0;
        const pool2 = secondAir ? biome.airAnimals : biome.landAnimals;
        const kind2 = pool2[(i + 2 + Math.floor(r2 * 10)) % pool2.length];
        const meta2 = ANIMAL_META[kind2];
        const speed2 = Math.round(meta2.speed * (0.85 + prog * 1.2));
        const offsetX2 = Math.round(w * 0.74);
        const baseOffsetY2 = secondAir ? -64 : -20;
        s.enemies.push({
          id: i * 10 + 3,
          kind: kind2,
          label: meta2.label,
          biome: biome.id,
          platformId: i,
          minOffset: 40,
          maxOffset: Math.max(80, w - 40),
          offsetX: offsetX2,
          baseOffsetY: baseOffsetY2,
          x: pose.x + offsetX2,
          y: pose.y + baseOffsetY2,
          vx: (i % 2 === 1 ? 1 : -1) * speed2,
          vy: 0,
          speed: speed2,
          flying: secondAir,
          phase: +((r + r2) * 3.14).toFixed(2),
          facing: i % 2 === 1 ? 1 : -1,
          alive: true,
        });
      }
    }

    // Hazards unlock at island 8 and progressively introduce spinning saws (14+) & spike-blocks (20+)
    if (i >= 8 && (!moving || prog > 0.55) && (prog < 0.35 ? i % 4 === 1 : i % 2 === 1)) {
      const kind = i >= 14 && i % 2 === 0 ? 'orb' : i >= 20 && i % 3 === 0 ? 'spike-block' : 'thorns';
      const offsetX = Math.round(w * (i % 2 === 0 ? 0.35 : 0.65));
      s.hazards.push({
        id: i,
        platformId: i,
        offsetX,
        kind,
        x: pose.x + offsetX,
        y: pose.y,
        phase: +(r * 6.28).toFixed(2),
      });
    }
  }

  const aliveXs = s.players.filter(p => p.alive).map(p => p.x);
  const behind = (aliveXs.length ? Math.min(...aliveXs) : lead) - 700;
  s.platforms = s.platforms.filter(p => (p.baseX ?? p.x) + p.w > behind);
  const activePlatformIds = new Set(s.platforms.map(p => p.id));
  s.coins = s.coins.filter(c => c.x > behind);
  s.hazards = s.hazards.filter(h => h.x > behind);
  s.springs = s.springs.filter(sp => sp.x > behind && activePlatformIds.has(sp.platformId));
  s.enemies = s.enemies.filter(e => e.alive && e.x > behind - 120 && (!e.platformId || activePlatformIds.has(e.platformId)));
  s.difficulty = 1 + Math.floor(lead / 1800);
  const currentIsland = s.platforms.filter(p => p.x <= lead).at(-1) || s.platforms[0];
  s.biome = currentIsland?.biome || 'grove';
}

export function stepPlatformWorld(s, cs, DT, finish) {
  if (!s.springs) s.springs = [];
  if (!s.enemies) s.enemies = [];
  if (!s.shots) s.shots = [];
  if (s.nextShot === undefined) s.nextShot = 0;

  // Storm starts at a comfortable pace so players can enjoy the opening zones, then ramps up progressively
  const difficultyBoost = Math.min(95, (s.difficulty - 1) * 10 + Math.min(60, Math.max(0, s.elapsed - 20) * 0.35));
  s.stormX = -500 + Math.max(0, s.elapsed - 10.5) * (74 + difficultyBoost);

  // Kinematic motion uses the authoritative fixed step; Matter only handles contact queries.
  const platformById = new Map();
  const platformSurfaces = [];

  // 1. Update the moving surfaces used for one-way landings.
  for (const floor of s.platforms) {
    const prevX = floor.x;
    const prevY = floor.y;
    const nextPose = platformPoseAt(floor, s.elapsed);
    floor.x = nextPose.x;
    floor.y = nextPose.y;
    floor.vx = (floor.x - prevX) / DT;
    floor.vy = (floor.y - prevY) / DT;
    platformById.set(floor.id, {floor, prevX, prevY});

    platformSurfaces.push({floor, prevX, prevY});
  }

  // Sync coins, springs, and hazards attached to moving platforms
  for (const coin of s.coins) {
    if (coin.platformId !== undefined && platformById.has(coin.platformId)) {
      const {floor} = platformById.get(coin.platformId);
      coin.x = floor.x + coin.offsetX;
      coin.y = floor.y + coin.offsetY;
    }
  }
  const springBodies = [];
  for (const sp of s.springs) {
    if (platformById.has(sp.platformId)) {
      const {floor} = platformById.get(sp.platformId);
      sp.x = floor.x + sp.offsetX;
      sp.y = floor.y;
    }
    const sb = Bodies.rectangle(sp.x, sp.y - 12, 38, 24, {isStatic: true, isSensor: true, label: 'spring'});
    sb.plugin = {spring: sp};
    springBodies.push(sb);
  }

  const hazardBodies = [];
  for (const h of s.hazards) {
    if (h.platformId !== undefined && platformById.has(h.platformId)) {
      const {floor} = platformById.get(h.platformId);
      h.x = floor.x + h.offsetX;
      h.y = floor.y;
    }
    const hy = h.kind === 'orb'
      ? h.y - 65 + Math.sin(s.elapsed * (2 + Math.min(1.5, (s.difficulty - 1) * 0.2)) + h.phase) * 25
      : h.kind === 'spike-block'
        ? h.y - 48 + Math.cos(s.elapsed * 2.6 + h.phase) * 28
        : h.y - 14;
    const hb = h.kind === 'thorns'
      ? Bodies.rectangle(h.x, hy, 32, 26, {isStatic: true, isSensor: true, label: 'hazard'})
      : Bodies.circle(h.x, hy, 20, {isStatic: true, isSensor: true, label: 'hazard'});
    hb.plugin = {hazard: h, hy};
    hazardBodies.push(hb);
  }

  // 2. Update animal enemies (leaping water fish/piranhas, patrolling land animals, swooping air animals)
  const enemyBodies = [];
  for (const e of s.enemies) {
    if (!e.alive) continue;
    if (e.kind === 'fish' || e.kind === 'piranha') {
      const cycle = ((s.elapsed + e.phase) % e.period + e.period) % e.period;
      const leapPortion = 0.48;
      if (cycle < e.period * leapPortion) {
        const u = cycle / (e.period * leapPortion); // 0..1
        const leapH = e.waterY - e.peakY;
        const prevY = e.y;
        const prevX = e.x;
        e.y = e.waterY - 4 * leapH * u * (1 - u);
        e.x = e.baseX + Math.sin((u - 0.5) * Math.PI) * (e.kind === 'piranha' ? 5 : 12);
        e.vx = (e.x - prevX) / DT;
        e.vy = (e.y - prevY) / DT;
        e.submerged = false;
        e.facing = e.vx >= 0 ? 1 : -1;
      } else {
        e.x = e.baseX;
        e.y = e.waterY + 18;
        e.vx = 0;
        e.vy = 0;
        e.submerged = true;
      }
    } else if (e.platformId !== undefined && platformById.has(e.platformId)) {
      const {floor} = platformById.get(e.platformId);
      const dir = e.facing || 1;
      const speedMult = 1 + Math.min(0.65, Math.max(0, s.difficulty - 2) * 0.08);
      e.offsetX += dir * e.speed * speedMult * DT;
      if (e.offsetX >= e.maxOffset) {
        e.offsetX = e.maxOffset;
        e.facing = -1;
      } else if (e.offsetX <= e.minOffset) {
        e.offsetX = e.minOffset;
        e.facing = 1;
      }
      e.vx = e.facing * e.speed * speedMult + floor.vx;
      e.x = floor.x + e.offsetX;
      if (e.flying) {
        const bob = Math.sin(s.elapsed * 3.4 + e.phase) * 20;
        e.vy = Math.cos(s.elapsed * 3.4 + e.phase) * 20 * 3.4;
        e.y = floor.y + e.baseOffsetY + bob;
      } else if (e.kind === 'frog') {
        const hop = Math.max(0, Math.sin(s.elapsed * 5.2 + e.phase)) * 28;
        e.vy = floor.vy;
        e.y = floor.y - 20 - hop;
      } else {
        e.vy = floor.vy;
        e.y = floor.y - 20;
      }
    }
    if (!e.submerged) {
      const meta = ANIMAL_META[e.kind] || ANIMAL_META.crab;
      const eb = Bodies.rectangle(e.x, e.y, meta.w, meta.h, {isStatic: true, isSensor: true, label: 'enemy'});
      eb.plugin = {enemy: e};
      enemyBodies.push(eb);
    }
  }

  // 2.5. Advance player blaster shots and check Matter.js collisions against monsters
  for (const shot of s.shots) {
    shot.x += shot.vx * DT;
    shot.life -= DT;
    if (shot.life <= 0) continue;
    const shotBody = Bodies.circle(shot.x, shot.y, 14, {isStatic: true, isSensor: true, label: 'shot'});
    const hits = Query.collides(shotBody, enemyBodies);
    let hitEnemy = hits[0]?.bodyA?.plugin?.enemy || hits[0]?.bodyB?.plugin?.enemy;
    if (!hitEnemy) {
      hitEnemy = s.enemies.find(e => e.alive && !e.submerged && Math.hypot(shot.x - e.x, shot.y - e.y) < 30);
    }
    if (hitEnemy && hitEnemy.alive) {
      hitEnemy.alive = false;
      shot.life = 0;
      const shooter = s.players[shot.owner];
      if (shooter) {
        shooter.stomps = (shooter.stomps || 0) + 1;
      }
    }
  }
  s.shots = s.shots.filter(sh => sh.life > 0);

  function loseLife(p, reason, respawnOnIsland = false) {
    if (p.lives === undefined) p.lives = p.maxLives ?? s.startingLives ?? 3;
    p.lives = Math.max(0, p.lives - 1);
    p.damageCount = (p.damageCount || 0) + 1;
    if (p.lives <= 0) {
      p.alive = false;
      p.deathReason = reason;
      return;
    }
    p.invulnerable = 1.4;
    if (respawnOnIsland) {
      const targetX = Math.max(p.x - 60, s.stormX + 85);
      const safeFloor = s.platforms.find(f => f.x + f.w > targetX) || s.platforms.at(-1) || s.platforms[0];
      if (safeFloor) {
        p.x = Math.min(safeFloor.x + safeFloor.w - 28, Math.max(safeFloor.x + 28, targetX));
        p.y = safeFloor.y - 25;
        p.vx = 0;
        p.vy = 0;
        p.ground = true;
        p.platformId = safeFloor.id;
      }
    } else {
      p.vy = -360;
      p.ground = false;
      p.platformId = undefined;
    }
  }

  // 3. Step players and query contacts against the shared sensor bodies.
  s.players.forEach((p, i) => {
    if (!p.alive) return;
    if (p.lives === undefined) p.lives = p.maxLives ?? s.startingLives ?? 3;
    if (p.maxLives === undefined) p.maxLives = s.startingLives ?? 3;
    p.invulnerable = Math.max(0, (p.invulnerable || 0) - DT);
    p.shootCooldown = Math.max(0, (p.shootCooldown || 0) - DT);

    const c = cs[i], oldY = p.y;
    const dirInput = Number(c.right) - Number(c.left);
    if (dirInput !== 0) p.facing = dirInput > 0 ? 1 : -1;
    else if (!p.facing) p.facing = 1;

    // Shoot projectile when pressing Space / J (attack)
    if (c.attack && p.shootCooldown <= 0) {
      p.shootCooldown = 0.24;
      const shotX = p.x + p.facing * 20;
      const shotY = p.y - 4;
      const newShot = {
        id: ++s.nextShot,
        owner: i,
        x: shotX,
        y: shotY,
        vx: p.facing * 540,
        life: 1.15,
      };
      // Check immediate close-range hit as well
      const immediateHit = s.enemies.find(e => e.alive && !e.submerged && Math.sign(e.x - p.x || p.facing) === p.facing && Math.hypot(e.x - shotX, e.y - shotY) < 42);
      if (immediateHit) {
        immediateHit.alive = false;
        p.stomps = (p.stomps || 0) + 1;
      } else {
        s.shots.push(newShot);
      }
    }

    const jump = Boolean(c.up);

    // If standing on a moving platform from previous tick, carry player with the platform
    if (p.ground && p.platformId !== undefined && platformById.has(p.platformId)) {
      const {floor, prevX, prevY} = platformById.get(p.platformId);
      p.x += floor.x - prevX;
      p.y += floor.y - prevY;
    }

    p.coyote = p.ground ? 0.22 : Math.max(0, (p.coyote || 0) - DT);
    p.jumpBuffer = jump && !p.jumpHeld ? 0.22 : Math.max(0, (p.jumpBuffer || 0) - DT);
    p.vx = dirInput * 228;

    // Manual jumping with generous coyote time & jump buffer
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -535;
      p.ground = false;
      p.platformId = undefined;
      p.coyote = 0;
      p.jumpBuffer = 0;
    } else if (p.jumpBuffer > 0 && !p.ground && p.airJumps > 0) {
      p.vy = -480;
      p.airJumps--;
      p.jumpBuffer = 0;
    }
    if (!jump && p.jumpHeld && p.vy < -245) p.vy = -245;
    p.jumpHeld = jump;

    // Integrate once, independently for each seat. Rebuilding an Engine and
    // stepping every earlier player's body three more times per seat added
    // allocation/solver work without contributing to these one-way collisions.
    p.vy += 1020 * DT;
    p.x = Math.max(20, p.x + p.vx * DT);
    p.y += p.vy * DT;
    const playerBody = Bodies.rectangle(p.x, p.y, 22, 48, {isSensor: true, label: 'player'});
    p.ground = false;
    p.platformId = undefined;

    // Resolve one-way top surface landings with a forgiving ledge grab.
    for (const {floor, prevY} of platformSurfaces) {
      if (
        p.x > floor.x - 16 &&
        p.x < floor.x + floor.w + 16 &&
        oldY + 25 <= prevY + 10 &&
        p.y + 25 >= floor.y &&
        p.vy >= 0
      ) {
        p.y = floor.y - 25;
        p.vy = 0;
        p.ground = true;
        p.platformId = floor.id;
        Body.setPosition(playerBody, {x: p.x, y: p.y});
        break;
      }
    }

    // Check Matter.js spring collisions
    const springHits = Query.collides(playerBody, springBodies);
    if (springHits.length > 0 && p.vy >= -100) {
      p.vy = -575;
      p.ground = false;
      p.platformId = undefined;
      p.coyote = 0;
      p.bouncedAt = +(s.elapsed).toFixed(2);
    }

    // Coin collection
    for (const coin of s.coins) {
      if (!coin.collectedBy.includes(i) && Math.hypot(p.x - coin.x, p.y - coin.y) < 48) {
        coin.collectedBy.push(i);
        p.coins++;
        if (p.coins % 8 === 0) p.airJumps = Math.min(2, (p.airJumps || 0) + 1);
      }
    }

    // Check Matter.js animal enemy collisions (forgiving stomp from above vs losing a life)
    const enemyHits = Query.collides(playerBody, enemyBodies);
    for (const hit of enemyHits) {
      const enemy = hit.bodyA.plugin?.enemy || hit.bodyB.plugin?.enemy;
      if (!enemy || !enemy.alive) continue;
      const waterLeaper = enemy.kind === 'fish' || enemy.kind === 'piranha';
      const canStomp = p.vy >= -60 && (oldY <= enemy.y + 10 || p.y <= enemy.y + 2);
      if (canStomp) {
        enemy.alive = false;
        p.vy = -465;
        p.ground = false;
        p.stomps = (p.stomps || 0) + 1;
        p.airJumps = Math.min(2, (p.airJumps || 0) + 1);
      } else if (p.invulnerable <= 0) {
        loseLife(p, waterLeaper ? `was chomped by a ${enemy.label}` : `was knocked out by a ${enemy.label}`, false);
        break;
      }
    }

    // Check Hazards (spikes, saws, spike-blocks)
    if (p.alive && p.invulnerable <= 0) {
      const hazardHits = Query.collides(playerBody, hazardBodies);
      for (const hit of hazardHits) {
        const h = hit.bodyA.plugin?.hazard || hit.bodyB.plugin?.hazard;
        if (!h) continue;
        loseLife(p, h.kind === 'thorns' ? 'hit the spikes' : h.kind === 'spike-block' ? 'hit a spike block' : 'hit a moving saw', false);
        break;
      }
      // Fallback exact geometric check so existing boundary tests remain 100% consistent
      if (p.alive && p.invulnerable <= 0) {
        for (const hazard of s.hazards) {
          const hy = hazard.kind === 'orb'
            ? hazard.y - 65 + Math.sin(s.elapsed * (2 + Math.min(1.5, (s.difficulty - 1) * 0.2)) + hazard.phase) * 25
            : hazard.kind === 'spike-block'
              ? hazard.y - 48 + Math.cos(s.elapsed * 2.6 + hazard.phase) * 28
              : hazard.y;
          const hit = hazard.kind === 'thorns'
            ? Math.abs(p.x - hazard.x) < 28 && p.y + 23 > hazard.y - 27 && p.y - 20 < hazard.y
            : Math.hypot(p.x - hazard.x, p.y - hy) < 32;
          if (hit) {
            loseLife(p, hazard.kind === 'thorns' ? 'hit the spikes' : hazard.kind === 'spike-block' ? 'hit a spike block' : 'hit a moving saw', false);
            break;
          }
        }
      }
    }

    if (p.alive) {
      if (p.y > 620) {
        loseLife(p, 'fell into the sea', true);
      } else if (p.x < s.stormX && p.invulnerable <= 0) {
        loseLife(p, 'was caught by the storm', true);
      }
    }

    p.score = Math.floor(p.x / 10) + p.coins * 10 + (p.stomps || 0) * 25;
  });

  const lost = s.players.flatMap((p, i) => (p.alive ? [] : [i]));
  if (lost.length) {
    s.eliminated = lost;
    finish(
      s,
      s.players.flatMap((p, i) => (p.alive ? [i] : [])),
      lost.length === s.players.length
        ? 'Everyone fell on the same beat. Rematch!'
        : `Player ${lost[0] + 1} ${s.players[lost[0]].deathReason}. The survivors win!`,
    );
  } else {
    extendPlatformCourse(s);
  }
  return s;
}

export function platformBotControls(s, i, c) {
  const p = s.players[i];
  if (!p?.alive) return c;
  c.right = true;

  // Check if nearing the right edge of the current platform
  const floor = s.platforms.find(f => p.x >= f.x - 12 && p.x <= f.x + f.w + 12 && Math.abs(p.y + 25 - f.y) < 14);
  const nearEdge = Boolean(floor && p.x > floor.x + floor.w - 48);
  const overPlatform = s.platforms.some(f => p.x >= f.x - 6 && p.x <= f.x + f.w - 18 && p.y + 25 <= f.y + 14);

  // Check for hazards or enemies ahead
  const hazardAhead = s.hazards.find(h => h.x > p.x - 10 && h.x - p.x < 110);
  const enemyAhead = (s.enemies || []).find(e => e.alive && !e.submerged && e.x > p.x - 15 && e.x - p.x < 115 && Math.abs(e.y - p.y) < 95);
  const danger = hazardAhead || enemyAhead;

  // Pause briefly at edge only if a leaping fish or piranha is currently blocking the gap right in front of us
  const fishInGap = nearEdge && (s.enemies || []).find(e => (e.kind === 'fish' || e.kind === 'piranha') && !e.submerged && e.x > p.x && e.x - p.x < 130 && e.y < p.y + 40 && e.vy < 0);
  if (fishInGap && p.x - s.stormX > 220) {
    c.right = false;
  }

  const wantGroundJump = p.ground && !p.jumpHeld && ((nearEdge && !fishInGap) || Boolean(danger));
  const holdJump = !p.ground && p.jumpHeld && p.vy < -35;
  const wantAirJump = !p.ground && !p.jumpHeld && p.airJumps > 0 && ((!overPlatform && p.vy > 60 && p.y > 380) || (danger && p.vy >= 0 && p.y > (danger.y || 420) - 140));

  c.up = Boolean(wantGroundJump || holdJump || wantAirJump);
  c.attack = Boolean(enemyAhead && (!p.shootCooldown || p.shootCooldown <= 0));
  return c;
}
