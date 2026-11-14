# Multiplayer simulations

Town Council and Castaway Crew are free cooperative games for 2–4 people, with a one-player practice mode. Find them in the game catalogue or open `/?game=town-council` and `/?game=castaway-crew`. Each player joins the room on their own device; all players ready up before the host starts.

## Playing in the world

- Move your character with WASD or arrow keys; hold Shift to run. Touch screens have a directional pad.
- Walk up to an NPC or work site, then press E or tap its prompt. Building collision and interaction distance are enforced by the server.
- Conversations and group decisions appear over the scene. Use 1–4 to choose, or tap a response. E/Escape returns to walking.
- Return to Council green or Survivor camp to vote and rest. Everyone resting advances the day early; otherwise dusk arrives on the shared clock. Work cannot be interrupted by resting.
- The HUD shows shared supplies, goals, remaining actions, time, and a map. Fullscreen keeps these controls and connection notices inside the game.

Town Council gives the team seven two-minute days to reach 75 festival preparation, 50 town care, and at least four content residents. Players earn town funds, prepare the festival, repair the neighbourhood, and restore the park.

Castaway Crew gives the team six two-and-a-half-minute days to reach 80 radio progress, 60 shelter, and at least four content survivors. Players gather wood and food, salvage parts, and work on the radio and shelter. Six NPCs plus the players eat each dusk; food shortages affect mood.

## Decisions and NPCs

Each world has six named NPCs with different priorities. Each NPC tracks trust and memories separately for every player. Listening, sharing supplies, requesting help, and making promises have authored outcomes. NPC moods are shared, while personal trust, memories, and promises are visible only to their owner. Trusted, content NPCs can help once a day and volunteer at dusk. Characters walk, work, rest, and react using the supplied animations.

Each day includes one authored group dilemma with three proposals. Ballots remain private until everyone has voted or dusk arrives. Ties and no votes select the third proposal. An unaffordable proposal fails without spending supplies. Work reserves shared supplies when it starts and awards its outcome only after its timer completes. There is no runtime AI dependency.

## Multiplayer behavior

The room server advances the simulation at 20 Hz and streams personalized snapshots over the existing SSE transport. Clients send directional controls and authored action IDs, never positions or rewards. Controls expire after 650 ms without a new packet. Action receipts prevent retries from double-spending supplies. A reconnect restores the same seat, input sequence, and private NPC relationships.

These games use the existing room lifecycle: a player ending the session cancels the cooperative game for everyone, and a server restart cancels active rooms. Temporary connection loss keeps the shared day clock running. There is no NEAR entry fee or escrow for either simulation.

## Assets and implementation

`public/models/simulation/manifest.json` records 52 selected assets, referenced textures, six CC0 licences, source paths, bounds, animations, and SHA-256 hashes. Original Kenney bytes are preserved. The selected files total about 2.33 MB. Only the models needed by the current world are loaded.

To regenerate from the downloaded packs:

```sh
node scripts/import-simulation-assets.mjs
```

Optional positional arguments select the source and output directories. See `public/models/simulation/README.md` for model conventions and selected IDs.

- Rules and authoritative movement: `server/arcade/simulations.mjs`
- In-world UI and keyboard/touch interaction: `src/SimulationGame.tsx`
- Following camera, scenery, models, and animations: `src/games/simulation-renderer.ts`
- Rules, private views, success/failure endings, and asset provenance: `tests/simulations.test.mjs`
- Four independent HTTP sessions, SSE consistency, movement, work, votes, privacy, and reconnect: `tests/simulations-api.test.mjs`

Run `npm test` and `npm run build`. The HTTP tests use temporary SQLite databases and local ports, including port 5193 for simulation coverage.
