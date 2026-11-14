/** Local, licensed soundtracks + lightweight state-driven Web Audio effects.
 * Create once per room, call unlock() from a user gesture, update() with each
 * authoritative snapshot, and dispose() when the room unmounts.
 */
export type ArcadeAudio = {
  unlock(): Promise<void>;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  update(state: any, seat: number | null): void;
  dispose(): void;
};

export type ArcadeMusicCredit = {
  title: string;
  artist: string;
  source: string;
  license: string;
  file: string;
};

const tracks = {
  action: {
    title: 'Exhilarate', artist: 'Kevin MacLeod',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300028',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    file: '/audio/games/racing-exhilarate.mp3',
  },
  island: {
    title: 'Bassa Island Game Loop', artist: 'Kevin MacLeod',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100840',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    file: '/audio/games/platformer-island-loop.mp3',
  },
  groove: {
    title: 'Funk Game Loop', artist: 'Kevin MacLeod',
    source: 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100839',
    license: 'https://creativecommons.org/licenses/by/4.0/',
    file: '/audio/games/racing-funk-loop.mp3',
  },
};

export function arcadeMusicCredit(game: string): ArcadeMusicCredit {
  if (['pocket-racers', 'stick-rivals', 'tank-arena', 'paint-tag', 'bomb-maze'].includes(game)) return tracks.action;
  if (['platform-relay', 'mini-golf', 'marble-knockout', 'marble-run', 'orbit-rescue'].includes(game)) return tracks.island;
  return tracks.groove;
}

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const angle = (n: number) => Math.atan2(Math.sin(n), Math.cos(n));

export function createArcadeAudio(game: string): ArcadeAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let engine: OscillatorNode | null = null;
  let engineHarmonic: OscillatorNode | null = null;
  let engineGain: GainNode | null = null;
  let engineFilter: BiquadFilterNode | null = null;
  let windGain: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let music: HTMLAudioElement[] = [];
  let activeTrack = 0;
  let crossfadeAt = 0;
  let musicTimer: ReturnType<typeof setInterval> | undefined;
  let previous: any = null;
  let latestSeat: number | null = null;
  let muted = false;
  let volume = .65;
  let unlocked = false;
  let disposed = false;
  let lastEffect = -1;
  const voices = new Set<AudioScheduledSourceNode>();
  const decodedSamples = new Map<string, AudioBuffer>();
  const credit = arcadeMusicCredit(game);
  const musicLevel = credit === tracks.action ? .31 : .4;

  const audible = () => unlocked && !disposed && !muted && !document.hidden;
  function gains() {
    const level = audible() ? volume : 0;
    if (context && master) master.gain.setTargetAtTime(level, context.currentTime, .045);
    const mix = crossfadeAt ? clamp((performance.now() - crossfadeAt) / 750) : 0;
    music.forEach((track, i) => {
      track.volume = level * musicLevel * (i === activeTrack ? 1 - mix : mix);
    });
  }
  function makeVoice<T extends AudioScheduledSourceNode>(node: T, end: number, nodes: AudioNode[]): T {
    voices.add(node);
    node.onended = () => {
      voices.delete(node);
      node.disconnect();
      nodes.forEach(n => n.disconnect());
    };
    node.start();
    node.stop(end);
    return node;
  }
  function tone(frequency: number, duration = .13, level = .11, type: OscillatorType = 'sine', endFrequency = frequency, delay = 0) {
    if (!audible() || !context || !master || voices.size > 28) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(level, now + .008);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(envelope); envelope.connect(master);
    makeVoice(oscillator, now + duration + .03, [envelope]);
  }
  function noise(duration = .14, level = .1, frequency = 600) {
    if (!audible() || !context || !master || !noiseBuffer || voices.size > 28) return;
    const now = context.currentTime;
    const source = context.createBufferSource(), envelope = context.createGain(), filter = context.createBiquadFilter();
    source.buffer = noiseBuffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(level, now); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(master);
    makeVoice(source, now + duration + .03, [filter, envelope]);
  }
  function chime(finish = false) {
    const notes = finish ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
    notes.forEach((note, i) => tone(note, finish ? .5 : .24, .095, 'sine', note, i * .105));
  }
  function sample(name: string, level = .4): boolean {
    const buffer = decodedSamples.get(name);
    if (!buffer || !audible() || !context || !master || voices.size > 28) return false;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; gain.gain.value = level;
    source.connect(gain); gain.connect(master);
    makeVoice(source, context.currentTime + buffer.duration + .02, [gain]);
    return true;
  }
  function ensureContext() {
    if (context) return;
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    context = new AudioClass();
    if (game === 'platform-relay' || game === 'pocket-racers') {
      const decoding = context;
      const names = game === 'platform-relay' ? ['coin', 'jump', 'jump-high', 'hurt', 'bump', 'disappear'] : ['coin'];
      // Short supplied CC0 sounds decode once after the first user gesture.
      for (const name of names) void fetch('/audio/games/platform-' + name + '.ogg')
        .then(response => {if (!response.ok) throw new Error('Sound unavailable');return response.arrayBuffer();})
        .then(bytes => decoding.decodeAudioData(bytes))
        .then(buffer => {if (!disposed) decodedSamples.set(name, buffer);})
        .catch(() => {/* Synthesized feedback remains available on older codecs. */});
    }
    master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 5;
    master.connect(compressor); compressor.connect(context.destination);
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < samples.length; i++) { brown = (brown + (Math.random() * 2 - 1) * .04) / 1.04; samples[i] = brown * 3.5; }
    if (game === 'pocket-racers' || game === 'orbit-rescue') {
      engine = context.createOscillator(); engineHarmonic = context.createOscillator();
      engine.type = 'sawtooth'; engineHarmonic.type = 'triangle';
      engine.frequency.value = 42; engineHarmonic.frequency.value = 84;
      engineGain = context.createGain(); engineGain.gain.value = .012;
      engineFilter = context.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
      engine.connect(engineFilter); engineHarmonic.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engine.start(); engineHarmonic.start();
      const wind = context.createBufferSource(), filter = context.createBiquadFilter();
      wind.buffer = noiseBuffer; wind.loop = true; filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = .6;
      windGain = context.createGain(); windGain.gain.value = 0;
      wind.connect(filter); filter.connect(windGain); windGain.connect(master); wind.start();
      voices.add(wind);
    }
  }
  function updateEngine(state: any, seat: number | null) {
    if (!context || !engine || !engineHarmonic || !engineGain || !engineFilter || !windGain) return;
    const player = game === 'orbit-rescue' ? state?.ship : state?.players?.[seat ?? 0];
    if (!player) return;
    const speed = Math.abs(player.speed ?? Math.hypot(player.vx || 0, player.vy || 0));
    const power = clamp(speed / 230);
    const rpm = 42 + power * 100 + Math.sin(power * Math.PI * 5) * 8;
    const now = context.currentTime;
    engine.frequency.setTargetAtTime(rpm, now, .09);
    engineHarmonic.frequency.setTargetAtTime(rpm * 2.01, now, .09);
    engineFilter.frequency.setTargetAtTime(320 + power * 1150, now, .12);
    engineGain.gain.setTargetAtTime(state.finished ? 0 : .012 + power * .028, now, .12);
    windGain.gain.setTargetAtTime(state.finished ? 0 : power * power * .13, now, .1);
  }
  function ensureMusic() {
    if (music.length) return;
    music = [new Audio(credit.file), new Audio(credit.file)];
    music.forEach(track => { track.preload = 'none'; track.volume = 0; });
    // The browser streams compressed MP3s; we do not decode long soundtracks
    // into large PCM buffers. A short overlap smooths the original ending tails.
    musicTimer = setInterval(() => {
      if (!audible()) return;
      const current = music[activeTrack];
      if (!crossfadeAt && Number.isFinite(current.duration) && current.duration - current.currentTime < 1.1) {
        const next = music[1 - activeTrack];
        next.currentTime = 0;
        crossfadeAt = performance.now();
        void next.play().catch(() => { crossfadeAt = 0; current.currentTime = 0; void current.play().catch(() => {}); });
      }
      if (crossfadeAt && performance.now() - crossfadeAt >= 750) {
        current.pause(); current.currentTime = 0; activeTrack = 1 - activeTrack; crossfadeAt = 0;
      }
      gains();
    }, 100);
  }
  function visibility() {
    if (!unlocked || disposed) return;
    if (document.hidden) {
      music.forEach(track => track.pause());
      void context?.suspend().catch(() => {});
    } else if (!muted) {
      void context?.resume().catch(() => {});
      void music[activeTrack]?.play().catch(() => {});
    }
    if (crossfadeAt) { music[1 - activeTrack]?.pause(); crossfadeAt = 0; }
    gains();
  }
  document.addEventListener('visibilitychange', visibility);

  return {
    async unlock() {
      if (disposed) return;
      ensureContext(); ensureMusic();
      unlocked = true;
      // This event lets the global lounge player stop before game music starts.
      window.dispatchEvent(new Event('slotvend:arcade-audio'));
      const resume = context?.resume();
      const play = !muted && !document.hidden ? music[activeTrack].play() : Promise.resolve();
      gains();
      await Promise.all([resume, play]);
      if (previous) updateEngine(previous, latestSeat);
    },
    setMuted(value) {
      muted = value;
      if (muted) { music.forEach(track => track.pause()); if (crossfadeAt) crossfadeAt = 0; }
      else if (unlocked && !document.hidden) {
        window.dispatchEvent(new Event('slotvend:arcade-audio'));
        void context?.resume().catch(() => {});
        void music[activeTrack]?.play().catch(() => {});
      }
      gains();
    },
    setVolume(value) { volume = clamp(Number.isFinite(value) ? value : .65); gains(); },
    update(state, seat) {
      if (!state || disposed) return;
      latestSeat = seat;
      updateEngine(state, seat);
      const before = previous;
      previous = state;
      if (!before || !audible() || before.tick === state.tick) return;
      const mine = state.players?.[seat ?? 0], oldMine = before.players?.[seat ?? 0];
      if (state.finished && !before.finished) {if(game==='platform-relay'&&mine?.alive===false){if(!sample('hurt'))tone(180,.3,.1,'triangle',60);}else if(state.winners?.includes(seat??0))chime(true);else tone(250,.3,.07,'sine',180);return;}
      if (state.finished || !mine || !oldMine) return;
      if ((mine.coins || 0) > (oldMine.coins || 0) && !sample('coin',.3)) chime();
      // Authoritative snapshots may be reused by a 60/120 Hz renderer. Effects
      // are emitted once per changed tick, never once per rendered frame.
      const now = context?.currentTime ?? 0;
      const ready = now - lastEffect > .07;
      if (game === 'pocket-soccer') {
        if (mine.kicks > oldMine.kicks) {noise(.06,.1,900);tone(150,.1,.08,'sine',65);}
        if (state.goalSeq > before.goalSeq) {chime(true);noise(.65,.08,1900);}
      } else if (game === 'cat-defense') {
        if (ready && mine.shootTime > oldMine.shootTime) {tone(520,.07,.035,'triangle',220);lastEffect=now;}
        if (mine.bombs > oldMine.bombs) {noise(.32,.16,450);tone(160,.25,.1,'sine',45);}
        if (state.wave > before.wave) chime();
        if (state.gate < before.gate) tone(125,.12,.07,'triangle',75);
      } else if (game === 'bridge-builders') {
        if (mine.phase === 'turning' && oldMine.phase !== 'turning') noise(.15,.06,1100);
        if (mine.phase === 'walking' && oldMine.phase === 'turning') tone(180,.08,.08,'triangle',80);
        if (mine.phase === 'falling' && oldMine.phase !== 'falling') tone(450,.4,.07,'sine',70);
      } else if (game === 'pocket-racers') {
        if (mine.crashes > oldMine.crashes) {noise(.2,.15,550);tone(140,.16,.08,'sine',60);}
        if (ready && mine.speed > 145 && Math.abs(angle(mine.heading - oldMine.heading)) > .13) { noise(.12, .045, 2100); lastEffect = now; }
      } else if (game === 'platform-relay' || game === 'stick-rivals') {
        if ((oldMine.ground || (mine.airJumps ?? 0) < (oldMine.airJumps ?? 0)) && !mine.ground && mine.vy < -50 && !sample(oldMine.ground?'jump':'jump-high',.3)) tone(190, .19, .075, 'triangle', 490);
        if (game === 'platform-relay' && mine.bouncedAt && mine.bouncedAt !== oldMine.bouncedAt && !sample('jump-high',.35)) tone(260, .24, .09, 'sine', 640);
        if (game === 'platform-relay' && (mine.stomps || 0) > (oldMine.stomps || 0)) { if (!sample('disappear',.3)) tone(320, .2, .08, 'triangle', 580); }
        if (game === 'platform-relay' && (mine.shootCooldown || 0) > (oldMine.shootCooldown || 0)) { tone(680, .09, .065, 'triangle', 220); }
        if (game === 'platform-relay' && (mine.lives ?? 3) < (oldMine.lives ?? 3)) { if (!sample('hurt',.35)) tone(220, .28, .095, 'triangle', 75); }
        if (!oldMine.ground && mine.ground && oldMine.vy > 40 && !sample('bump',.1)) noise(.1, .07, 220);
        if (state.checkpoint > before.checkpoint || state.baton !== before.baton && state.baton != null) chime();
        if (mine.attack > (oldMine.attack || 0)) noise(.12, .09, 1600);
        if (state.players.some((p: any, i: number) => p.hp < before.players[i]?.hp)) { noise(.16, .18, 420); tone(95, .14, .12, 'sine', 40); }
        if (game === 'platform-relay' && Math.abs(mine.x - oldMine.x) > 160) tone(360, .25, .075, 'triangle', 100);
      } else if (game === 'paddle-duel' || game === 'air-hockey') {
        if (state.players.some((p: any, i: number) => p.score > before.players[i]?.score)) chime();
        else if (ready && state.reset <= 0 && before.reset <= 0 && (Math.sign(state.ball.vx) !== Math.sign(before.ball.vx) || Math.sign(state.ball.vy) !== Math.sign(before.ball.vy))) {
          tone(game === 'air-hockey' ? 740 : 430, .075, .09, 'triangle', 280); lastEffect = now;
        }
      } else if (game === 'marble-run') {
        if(oldMine.ground&&!mine.ground&&mine.vz>0)tone(240,.15,.06,'sine',520);if(mine.lives<oldMine.lives)tone(360,.3,.09,'triangle',90);
      } else if (game === 'paint-tag' || game === 'tank-arena') {
        if (mine.cooldown > oldMine.cooldown) tone(760, .09, .07, 'triangle', 140);
        if (state.players.some((p: any, i: number) => p.score > before.players[i]?.score)) { noise(.12, .12, 1600); chime(); }
      } else if (game === 'snake-arena') {
        if (mine.body.length > oldMine.body.length) chime();
        if (oldMine.alive && !mine.alive) { noise(.2, .13, 800); tone(240, .3, .07, 'triangle', 60); }
      } else if (game === 'bomb-maze') {
        if (state.bombs.length > before.bombs.length) tone(530, .09, .07, 'triangle', 320);
        if (state.blasts.length > before.blasts.length) { noise(.32, .2, 700); tone(130, .23, .1, 'sine', 35); }
      } else if (game === 'mini-golf') {
        if (state.players.some((p: any, i: number) => p.strokes > before.players[i]?.strokes)) { noise(.045, .14, 2400); tone(390, .07, .08, 'sine', 180); }
        if (state.hole > before.hole || mine.sunk && !oldMine.sunk) chime();
      } else if (game === 'kitchen-rush') {
        if (state.served > before.served) chime();
        else if (mine.carrying !== oldMine.carrying) tone(560, .12, .08, 'sine', 840);
      } else if (game === 'orbit-rescue') {
        if (state.docked > before.docked) chime();
      } else if (game === 'marble-knockout') {
        if (state.players.some((p: any, i: number) => !p.alive && before.players[i]?.alive)) tone(450, .35, .08, 'sine', 65);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('visibilitychange', visibility);
      if (musicTimer) clearInterval(musicTimer);
      music.forEach(track => { track.pause(); track.removeAttribute('src'); track.load(); });
      music = [];
      for (const voice of voices) { try { voice.stop(); voice.disconnect(); } catch { /* Already ended. */ } }
      voices.clear(); decodedSamples.clear();
      try { engine?.stop(); engineHarmonic?.stop(); } catch { /* Already closed. */ }
      if (context) void context.close().catch(() => {});
      context = null; previous = null;
    },
  };
}
