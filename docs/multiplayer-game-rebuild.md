# Multiplayer game rebuild: implementation handoff

Current entry policy: every published multiplayer game supports optional NEAR testnet stakes chosen during room setup. Solo remains a separate practice mode.

Status: implementation requirements, updated 14 November 2026 for the user's skill-only constraint. A roster entry is not a claim of a completed or released game.


## Current delivery record — 14 November 2026

The 34-concept requirements roster plus the requested **Stick Rivals** now have implementations: eight board games, 26 new arcade/word/party/puzzle games, and the existing Trivia Showdown engine (`trivia`). The discovery catalogue has **60 entries**, including nineteen knowledge/puzzle entries; topic variants are not counted as distinct new engines. All support solo and independent online sessions. Every published multiplayer game supports optional NEAR testnet stakes. Ludo stays excluded; Kalah remains archived; the public Mancala name keeps the stable `oware` ID. See [the release checklist](game-release-checklist.md) for evidence and remaining verification limits.

Solo board practice runs the same move-validation engine against a bounded deterministic computer opponent, without funds or leaderboard effects. Online boards retain server-owned state, two-game matches with swapped starting sides, clocks, reconnect, participant chat and transactional settlement. Quiz rooms provide the same hidden questions to independent players and validate answers on the server. Quizzes and maths/science reasoning are skill/knowledge challenges; do not exclude them because questions are selected, generated or multiple choice.

Gameplay art is manually drawn SVG from ImageGen references: illustrated counters, seeds, wood and paper in `public/art/game-pieces`. It must look drawn during play, not like photographic texture pasted behind controls. Cover artwork and original generated references remain separately preserved. StudyJunior Primer MCP is connected via the private `MCP_ASSETS` value. Eight verified production SVGs support nine quiz prompts; production metadata and visual reviews are preserved in `assets/source/studyjunior`. The token works with `/api/mcp/primer`, not `/api/mcp/studio-build`.

Automated HTTP coverage includes all 26 new arcade titles, independent sessions, matching snapshots, invite privacy, reconnect and settlement. Simulated latency/jitter and dropped controls have been tested. Physical phone/laptop pairs and sustained load/balance certification remain outstanding. Counts describe actual published capabilities; archives are not released games.

## Product decision

Build our own games. **Every published game supports solo practice and multiplayer with optional NEAR testnet stakes.** Single-player boards need a computer opponent; multiplayer means independently authenticated people playing on separate devices, with server-owned state/results. Solo never charges an entry or awards competitive winnings. Show the stake per player and any storage fees before creating a room.

Do not publish imported games. Preserve source/licences and old saved records without including them in discovery or new room creation. Original prototypes without online support remain development work until both modes are complete. Do not remove working solo modes to satisfy multiplayer requirements. Avoid overlapping titles: one Mancala game using the Oware rules; Kalah is not a second public game. Chess puzzles are labelled puzzles and do not replace the planned full chess engine.

A group pot around independent offline games, shared chat alone, or two tabs sharing browser storage is not a multiplayer implementation. Every new title needs real game-specific controls, opponent state/progress, reconnect and verifiable results.

## Skill-based competition requirement

Exclude dice-driven Ludo and comparable chance-determined wagering mechanics. This is a product requirement, not a legal or hackathon eligibility conclusion. It does **not** exclude trivia, maths, science, reasoning, memory or deduction simply because a puzzle/question set varies.

- Opponents receive equivalent information, timing, content and rules. Shared generated questions/puzzles are allowed; validate their answers/solutions and persist the selected set before reveal.
- Keep questions and answer keys hidden until the proper stage. A model may select from answer-checked candidates; it cannot invent numeric correctness or change a live answer key.
- No random payout, lucky-score bonus, dice result or coin-flip tiebreaker. Equal scores split/refund/replay under published rules.
- Swap starting sides or roles where needed. Physics games need authoritative movement and equal controls; latency must not permit forged wins.
- Solo uses the same rules where practical but no escrow, settlement or shared competitive score submission.

Sports predictions and custom activities remain distinct platform features and are not counted as skill-game engines. Future mini-game rows specify implementation/fairness checks; they do not authorize hiding the working knowledge-game catalogue.

## Repository baseline and boundaries

Re-inspect these files before implementing: work may have continued since this handoff. Counts describe the source inventory, not a release claim.

| Area | Existing files and behavior | Required treatment |
| --- | --- | --- |
| App | React 18, TypeScript and Vite; `src/App.tsx`, `src/PlayRoom.tsx`, `src/Multiplayer.tsx`, `src/ChallengePicker.tsx`, `src/LiveMatches.tsx` | Integrate into the existing app, navigation, room flow and picker. Preserve unrelated UI work. |
| Server | Node HTTP in `server/index.mjs`; dev ports 5188/5189; origin checking and cookie sessions | Reuse authenticated identity and request protections. Add explicit game routes and schemas; do not create a disconnected demo server. |
| Storage | Node built-in SQLite via `server/store.mjs`; `data/slotvend.sqlite`; one server process | Add versioned, non-destructive migrations and durable game records. Keep sessions, existing rooms and balances readable. Never run tests against the user's database. |
| Current online play | `server/multiplayer.mjs`; `/api/parties`, `/:id/action`, `/:id/start`, `/:id/answer`, `/:id/messages` | Existing engine is a timed question race for 2–16 players. Its question/index/score representation is not a generic chess, board or physics engine. Preserve existing room compatibility or document an explicit migration. |
| Updates | `/api/events` sends global `update` invalidations; room clients refetch and poll | Suitable for current UI refreshes, not by itself a racing protocol. Add authenticated room-scoped updates with ordering/resume semantics. Keep the global feed for its existing purpose. |
| Catalogue | `server/game-catalog.mjs`, `server/library-catalog.json`, `server/play.mjs`, `src/game-art.ts` | Source inventory includes 1,004 imported titles, 29 with local shared-device play, five casual games and 19 timed packs. None of those counts proves remote game support. Audit discovery and direct launch paths. |
| Archived imports | `src/ImportedGame.tsx`, `server/library.mjs`, `public/library` | Retain opaque-origin isolation and attribution. Imported standalone builds are references/archives, not automatically trusted online clients. |
| Art/design | `public/art/game-covers`, `public/art/studyjunior`, `public/art/README.md`, `THIRD_PARTY_NOTICES.md`, `src/bright.css` | Preserve the bright NearFest design, compact illustrated cards, existing cover mappings, and StudyJunior assets/provenance. |
| Economy | `server/store.mjs`, `server/domain.mjs`, `server/community.mjs`, `server/near.mjs`, `src/wallet.ts` | Funded games, group pots and bounties use native NEAR testnet escrow through `server/near-economy.mjs` and `contract/src/rooms.rs`. Never debit a local currency balance or enable mainnet. |

The existing server is a single-process, persistent-disk application. Do not introduce Supabase, Redis, a new identity provider or a hosting rewrite merely to add multiplayer. A new dependency or WebSocket transport is acceptable when justified and pinned. Horizontal scaling is not an initial deliverable; prevent multiple processes from owning the same simulation if deployment assumptions later change.

Current party actions are limited to 60 requests per minute per user. Do not send racing input through that path unchanged, or remove global protection to make it work. Define separate bounded input and connection budgets appropriate to each game.

## What “online multiplayer” means

Use explicit mode labels in the registry and UI:

- **Shared board, live turns:** players modify the same server-owned board. Chess, Dots and Boxes, and Mancala belong here. “Real-time” means live synchronization during the match; it does not mean simultaneous turns.
- **Shared world, simultaneous action:** all players inhabit the same evolving simulation. Racing belongs here. Positions, checkpoints and outcomes are authoritative on the server.
- **Simultaneous challenge race:** participants receive equivalent challenges with a synchronized start/deadline, live progress and a server-validated winner. This is legitimate online competition when clearly labelled, but is not a substitute for a shared-board or shared-world game.

Show the actual player range and interaction mode. Never label a same-device game “online.” Existing timed packs may remain visible only after auditing that they meet the online release requirements; describe them as timed challenges. Do not present the existing one-move chess puzzle as the rebuilt chess game.

## Game roster and hackathon priorities — 14 November 2026

This section supersedes the earlier Ludo-led shortlist. The immediate deterministic board-game priorities are **Mancala (Oware), Checkers, Connect Four, Dots and Boxes, Reversi, Hex and Nine Men's Morris**. Chess remains in the board roster for a later verified rules-engine integration. Other mini-games remain design candidates with the explicit skill gate in their row; they are not approved simply by appearing here.

The active requirements roster now contains **34 distinct game concepts**: eight board games and 26 party, arcade and puzzle concepts. Ludo and dice-dependent competitive designs stay excluded; Kalah is consolidated into the single Mancala entry. These 34 are the original implementation roster toward the user's longer-term 1,000-title ambition. They are implemented along with Stick Rivals; this is not a definition or delivery of all 1,000. Variants, topics and difficulty changes do not inflate the count.

Every row inherits independently authenticated players on separate devices, server-owned state and results, synchronized turns/start, reconnection, touch and keyboard controls, readable rules, optional SFX, illustrations and completed-match evidence. A local pass-and-play fallback does not qualify. Competitive NEAR entry requires both skill-policy and settlement checks; free play must also pass the skill-design gate.

### Showcase implementation order

1. Complete the common room/invite/reconnect/result path with **Connect Four or Dots and Boxes**. Reuse it for the other shared-board games.
2. Deliver **Oware and Checkers** as the named favourites, with the detailed rules and acceptance cases below. Mancala uses the Oware rules; Kalah stays archived, not a second published title.
3. Add **Reversi, Hex and Nine Men's Morris** individually, preserving each game's actual legal moves and terminal conditions. Complete one game before publishing it; no empty-board wrappers.
4. Add **Paddle Duel** only after the deterministic serve, fixed physics and separate-device latency checks pass. **Draw & Guess** follows only after equal prompt/role exposure and the skill-design gate are demonstrated. Neither is approved by theme alone.
5. Re-audit existing maths/science/trivia challenges for fixed content, objective answers and equivalent exposure. Continue with three to five qualified mini-games per later batch; racing and hidden-role designs are not the board-game critical path.

### Board and table games — 8

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `oware` — **Mancala (Oware)** | 2, shared turns | Abapa sowing and capture game; exact rules below. Server tracks all 48 seeds and both scores; win/draw comes from board state. **Skill gate:** Fixed 48-seed starting board; agreed/alternating seats; no RNG. |
| `checkers` — **Checkers / Draughts** | 2, shared turns | Named 8×8 English rules initially; mandatory jumps, complete capture chains and crowning. Capture or immobilise the opponent to win; draw rules below. **Skill gate:** Fixed 12-men-per-side position; agreed/alternating colours; no RNG. |
| `chess-online` — **Chess** | 2, shared turns | A full legal chess match with clocks, special moves, draw claims, resignation and checkmate. Preserve the detailed chess acceptance criteria below. **Skill gate:** Fixed standard opening; agreed/alternating colours; no random openings or Chess960. |
| `connect-four` — **Connect Four** | 2, shared turns | Drop into a non-full column on a 7×6 board; four connected pieces in any direction wins; full board without a winner draws. Show the winning line. **Skill gate:** Fixed empty board; agreed/alternating first player; no RNG. |
| `dots-boxes` — **Dots and Boxes** | 2, shared turns | Claim shared edges, complete boxes and retain the turn after scoring; most boxes wins. Default 4×4 boxes; handle one edge completing two boxes. **Skill gate:** Fixed grid; agreed/alternating first player; no random edges or bonus boxes. |
| `reversi` — **Reversi** | 2, shared turns | Place on an 8×8 board only when bracketing opponents; flip all valid rays, pass only with no legal move, finish when neither can move. Most discs wins. **Skill gate:** Fixed four-disc opening; agreed/alternating colours; no RNG. |
| `nine-mens-morris` — **Nine Men's Morris** | 2, shared turns | Place nine pieces, then slide along connected points; a mill removes an eligible opposing piece. Permit flying at three pieces; below three or no legal move loses. Define repetition draw. **Skill gate:** Fixed empty board and nine pieces each; agreed/alternating opener; no RNG. |
| `hex` — **Hex** | 2, shared turns | An 11×11 hex board, opposite-edge connections and a swap option after the opening move. Server checks connectivity after every placement; no draw. **Skill gate:** Fixed board, explicit opening/swap rule and agreed seats; no RNG. |

### Social party and word games — 8

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `draw-guess` — **Draw & Guess** | 3–8, rotating drawer and live guesses | Each player draws once per cycle, 60 seconds per drawing. Server-only answer aliases, private guesses and ordered correct answers. Guessers receive 100/80/60/40/20 points by correct-answer rank (20 thereafter); drawer earns 20 per solver. Most points after one cycle wins; equal scores tie. **Skill gate:** CONDITIONAL: deterministic reviewed prompt rotation, equivalent difficulty/role exposure and fixed scoring. Blind guessing or prompt luck must not decide the result. Complete that scoring audit. |
| `word-hunt` — **Word Hunt** | 2–8, simultaneous shared letter grid | Shared 4×4 letters, 90 seconds; adjacent cells form dictionary words without reusing a cell. One score per word per player, server dictionary/version and length-based scores; highest total wins. **Skill gate:** CONDITIONAL: fixed published level version, same letter grid and dictionary for everyone; no rolled letter cubes or per-player layouts. |
| `word-relay` — **Word Relay** | 2–8, live turns | Begin with the last letter of the previous word; ten seconds per turn, no repeated words and a published dictionary. Invalid/time-out loses a life; last player with a life wins. **Skill gate:** CONDITIONAL: fixed starting word and agreed turn order; rotate starting seat across equal legs. Validate words objectively; no random rescue letters. |
| `category-sprint` — **Category Sprint** | 2–8, simultaneous private answers | Same letter and five categories, 60 seconds, submit privately then reveal together. Valid unique answers score 10, shared answers 5; four rounds, highest total wins. Dictionary/curation plus visible dispute review; review disputed answers before scoring. **Skill gate:** CONDITIONAL: fixed letter/category schedule, equal answer time and reviewed answer taxonomy. Unresolved subjective answers need scoring review under the skill policy. |
| `clue-crew` — **Clue Crew** | 4–8 in two teams, rotating clue giver | Give text clues for a private word without listed forbidden terms; server validates prohibited words and exact answer aliases. Five equal timed turns per team, most solved cards wins. Give fair score/skip rules and hide cards from opponents. **Skill gate:** CONDITIONAL: fixed paired prompt sets with equivalent team exposure; rotate clue-giver roles deterministically. No shuffled cards or random forbidden-word difficulty. |
| `trivia-showdown` — **Trivia Showdown** | 2–16, synchronized question race | Build on the existing multiplayer quiz engine: curated mixed subjects, hidden prompts before start, server scoring and shared round reveals. Highest correct count wins; tied players share. Categories remain variants, not new titles. **Skill gate:** Knowledge-based competition supported. Use the same answer-checked question set/order for all entrants, hidden until start, and objective server scoring. Solo remains available. |
| `bluff-club` — **Bluff Club** | 3–8, simultaneous writing and secret voting | Submit plausible false answers to a safe prompt, mix with the curated truth, then vote. Correct votes score two; each opponent fooled scores one. Five rounds, most points wins. Moderate submissions, prevent self-voting and duplicate options; free play initially. **Skill gate:** CONDITIONAL: fixed reviewed prompts, deterministic answer ordering with equal positional exposure, role symmetry and objective scoring. No random truth placement or luck-based voting bonuses. |
| `deduction-club` — **Deduction Club** | 5–10, hidden roles and timed phases | One secret saboteur, other players investigators; night action then discussion and vote. Investigators win by identifying the saboteur; saboteur wins at one remaining investigator. Roles/actions stay server-private; eliminated players have separate spectator chat. **Skill gate:** CONDITIONAL: parked until deterministic role choice/rotation, equal role opportunities and evidence-based deduction eliminate random role advantage/blind identification. Do not ship the original random hidden-role design. |

### Arcade and movement mini-games — 10

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `paddle-duel` — **Paddle Duel** | 2, shared real-time arena | Each player controls one paddle; authoritative ball, bounds and serves. First to seven points wins; rotate the serve after each point. Drag controls and keyboard, speed limits and latency handling. **Skill gate:** CONDITIONAL: fixed serve direction/speed, alternating server, mirrored court and deterministic collisions; no random bounce or speed boosts. |
| `air-hockey` — **Air Hockey** | 2, shared real-time table | Move a striker only inside your half; server simulates puck/striker collisions and goals. First to five wins; prevent teleport hits and cross-half movement. **Skill gate:** CONDITIONAL: fixed puck reset and mirrored strikers; deterministic collision solver, no random launch or bounce. |
| `pocket-racers` — **Pocket Racers** | 2–4, shared real-time track | Three-lap top-down race with checkpoints, visible opponents and authoritative physics/finish order. Follow the detailed racing acceptance tests below. **Skill gate:** CONDITIONAL: fixed track, equal vehicle stats, agreed grid with swapped positions across legs; no random hazards, pickups or rubber-banding. |
| `snake-arena` — **Snake Arena** | 2–6, shared real-time grid | Simultaneous snakes eat food at fixed symmetric positions with a deterministic refill schedule and avoid walls/bodies; last survivor wins. Simultaneous final collisions draw; five-minute cap uses length among survivors, with tied lengths sharing. **Skill gate:** CONDITIONAL: fixed symmetric food positions and published deterministic refill rule; no random spawning. Symmetric starts, equal speed and explicit simultaneous-collision ties. |
| `bomb-maze` — **Bomb Maze** | 2–4, shared real-time grid | A playful foam-bomb maze with blocked paths, timed blasts and breakable tiles. Three short rounds; last survivor scores a round, tied survivors after the timer split that round's point. Most round points wins. No graphic violence. **Skill gate:** CONDITIONAL: fixed symmetric maze/blocks, fixed blast timings, equal loadouts; no randomized loot or power-ups. Rotate seats across equal legs. |
| `mini-golf` — **Mini Golf** | 2–4, live turns on shared holes | Three original holes; server simulates aim/power strokes, hazards, resets and cup detection. Eight-stroke cap per hole; lowest total wins and equal totals tie. Everyone sees each shot. **Skill gate:** CONDITIONAL: fixed holes, no random wind/hazards, deterministic shot simulation; identical ball stats and agreed rotating order. |
| `marble-knockout` — **Marble Knockout** | 2–6, shared real-time arena | Steer marbles on a shrinking circular platform; server validates speed, collisions and boundary exits. Last marble wins; same-tick final eliminations draw. **Skill gate:** CONDITIONAL: fixed symmetric starts/shrink schedule and deterministic collision response; no random impulses or spawn advantages. |
| `kitchen-rush` — **Kitchen Rush** | 2–4, cooperative shared workspace | Pick, chop, cook and deliver safe fictional meals against a three-minute timer. Lock item ownership, station actions and recipes; team wins at the published order target. Shared achievement. **Skill gate:** CONDITIONAL: fixed recipe/order schedule and ingredient locations, equal role access; no randomly spawned orders or shortages. Optional multiplayer stakes. |
| `paint-tag` — **Paint Tag** | 2–4, shared real-time arena | Move, aim and tag with bright paint; obstacles, bounded projectile speed and respawns. Most validated tags after two minutes wins; equal totals tie. Cosmetic splashes, no weapons branding or gore. **Skill gate:** CONDITIONAL: fixed map, symmetric starts, deterministic respawn positions and projectile paths; no random spread, critical hits or equipment drops. |
| `platform-relay` — **Astro Dash** | 2–4, cooperative shared platform course | Players open switches and carry a baton through one original obstacle course. Server owns movement, checkpoints and baton transfer; everyone reaching the exit within three minutes wins. **Skill gate:** CONDITIONAL: fixed course/hazard timing and deterministic controls, agreed roles; no procedural obstacles or random baton effects. Optional multiplayer stakes. |

### Puzzle, maths and science games — 8

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `maths-tug` — **Maths Tug-of-War** | 2–8 in balanced teams, simultaneous | Equivalent hidden arithmetic challenges; each verified correct answer pulls the shared rope one unit, wrong answers impose a two-second input cooldown. First to ten net pulls wins; 90-second limit uses rope position, centre draws. No raw click-speed scoring. **Skill gate:** CONDITIONAL: fixed equivalent reviewed problems/order for both teams, deterministic team/role selection and exact validation; shared generated or curated questions are allowed; no lucky multiplier bonuses. |
| `equation-forge` — **Equation Forge** | 2–8, simultaneous puzzle rounds | Same six numbers and a target; construct an expression using each number at most once. Server parses safe arithmetic and scores target distance, then fewer operations; five rounds with published round points. Ties stay ties. **Skill gate:** CONDITIONAL: fixed identical number/target rounds and scoring for everyone; no random number draw or varying operator privileges. |
| `circuit-crew` — **Circuit Crew** | 2–4, cooperative shared board | Rotate wires, switches and logic gates to power target lamps without short circuits. Three low-voltage fictional boards, three-minute timer; server evaluates connectivity and win state. **Skill gate:** CONDITIONAL: fixed reviewed boards with deterministic connectivity and equal tool access; no random faults or component drops. Optional multiplayer stakes. |
| `orbit-rescue` — **Orbit Rescue** | 2–4, cooperative shared simulation | Divide steering, thrust and docking tasks to rescue three stranded probes before fuel/time runs out. Server physics, fuel and dock conditions; team success only when all probes are safe. Illustrative space physics. **Skill gate:** CONDITIONAL: fixed physics, probe positions, fuel and mission clock; agreed/rotating roles; no random space hazards. Optional multiplayer stakes. |
| `bridge-builders` — **Bridge Builders** | 2–4, cooperative shared construction | Place limited beams between legal anchors, then run a shared load test. Three original gaps; server owns budget and stable bridge evaluation. Team wins if the test vehicle crosses all three. Simplified mechanics clearly labelled. **Skill gate:** CONDITIONAL: fixed gaps, materials, load path and deterministic stability test; no randomized stresses or unequal budgets. Optional multiplayer stakes. |
| `molecule-match` — **Molecule Match** | 2–4, simultaneous educational puzzle race | Assemble safe, curated molecule graphs from atom tokens; server checks allowed bonds and exact target graph. Five equal rounds, most valid completions wins. No experimental procedures or dangerous chemistry content. **Skill gate:** CONDITIONAL: same fixed reviewed molecule targets and atom inventory/order for everyone; no random token bags or hidden bonus scores. |
| `sudoku-race` — **Sudoku Race** | 2–4, synchronized puzzle race | Same fixed reviewed solvable board, private entries, opponent progress only. First server-validated solution wins; cap uses correct cells with ties shared. Reject invalid or forged completions; spectating cannot reveal a solution. **Skill gate:** CONDITIONAL: same fixed reviewed uniquely solvable board; shared generated boards allowed if solution-checked and persisted before reveal. Objective validation; any timer tie stays tied. |
| `codebreakers` — **Codebreakers** | 2–4, synchronized deduction race | Solve the same fixed four-symbol logic puzzle from a complete reviewed clue set. Server validates the deduction and repeated-symbol constraints. Equal solutions/effort tie; no repeated blind guesses, randomly selected secret or hidden feedback lottery. **Skill gate:** CONDITIONAL: redesign as a fixed clue-based logic puzzle with a provable unique solution. No secret chosen randomly and no win from a lucky blind guess; stay parked until that design is complete. |

### Excluded and consolidated designs

- Ludo: excluded by the user because of dice outcomes.
- Backgammon and draw-dependent Dominoes: do not add dice/draw wagering games to this skill-game build.
- Kalah: consolidate into the single Mancala (Oware rules) title rather than ship overlapping games.
- 2048: the vendored solo prototype stays archived under the no-import decision.
- Memory: a legitimate memory/skill concept, not automatically excluded as luck. A future original title must offer solo and real shared-content online rounds with fair scoring.

### Detailed launch requirements for the named favourites

**Oware — Abapa, two players.** Twelve houses, four seeds each; sow counterclockwise, skipping the starting house on repeated laps. Capture backward along consecutive opposing houses containing two or three seeds after the final drop. A capture clearing the opponent's entire row takes nothing. Feed an empty opposing row whenever possible. No sowing into score bowls or extra turns. More than 24 captured seeds wins; 24 each draws. Reference: [Ply Yard's documented Abapa implementation](https://oware.plyyard.com/rules/). For NearFest, explicitly declare these endgame conventions in the room rules: if an empty opposing row cannot be fed, end the game and credit remaining seeds to the player whose row contains them; on the third identical board/score/side-to-move position, end and credit each row's remaining seeds to its owner. Compare final scores. Label the threefold endgame convention as a NearFest rule, not a universal Abapa rule. Record these choices in the engine rules version.

Oware's acceptance fixtures must include a long sow, chained capture, void grand slam, mandatory feed, no-feed ending, repetition ending, reconnection mid-animation and exact 48-seed conservation. Use a tactile wooden-style SVG board, individually animated seeds, readable pit counts and gentle seed clicks. Each device may orient its own row at the bottom, with a consistent server pit mapping. Board animation never delays authoritative turn processing or permits a second move.

**Checkers — 8×8 English draughts, two players.** Twelve men per side; men move and capture forward, kings in both directions. Captures are compulsory; choose any legal capture line and finish it. Promotion ends that turn, including capture chains. Winning requires taking all opposing pieces or leaving no legal move. Implement the WCDF repetition/no-progress draw conditions and draw agreement; identify the rules and clocks before joining. Reference: [WCDF Rules of Draughts](https://wcdf.net/rules/rules_of_checkers_english.pdf). Ghanaian/international variants require their own verified rule IDs and must not be silently mixed into this ruleset.

Checkers acceptance fixtures cover ignored mandatory jumps, branching multi-jumps, crowning during a jump, king movement, immobilisation, draw eligibility and duplicate move submissions. Use chunky coral/lilac SVG pieces, a crisp crown marker, highlighted legal moves and a short capture animation. Colour and orientation must not change move legality.

**Draw & Guess.** Use a 30-second optional practice canvas before readying; the match begins only when everyone is ready. The next prompt comes from the fixed reviewed rotation; its text goes only to the drawer. There is no random prompt draw or difficulty lottery. Other players and spectators receive bounded stroke events and public score changes, never the chosen word or other players' unsuccessful guesses. Exact normalized answers/curated aliases determine correctness; AI may propose safe words during offline content authoring; reviewers freeze the prompt set before anyone joins. It cannot curate a live match or judge payout-worthy answers. Cap stroke size/rate, implement undo/clear as ordered drawing events and reconnect with the current canvas. Give touch users a roomy canvas, colour dots, undo and an obvious guess field. Chat uses a separate tab to avoid accidental answer disclosure. Free play initially.

**Paddle Duel.** Send bounded paddle input at a rate the server explicitly supports. Use an authoritative ball and collision engine, equal paddle speeds, a ready countdown, score-to-seven and one result. Prediction may smooth motion but cannot award a goal. Test wall/paddle collisions, reconnect grace, duplicate goal detection, input flooding and latency on two devices. Serve direction, angle and speed follow a published deterministic sequence with alternating servers; collision behavior has no random component. Use a bright, high-contrast court, satisfying restrained trails and optional bounce sounds. Respect reduced motion and the shared SFX control.

### What makes the collection feel fun

- Illustrate the actual game on each compact card: an Oware board/seeds, checkers/crowns, Connect Four discs, a drawing pencil or an air-hockey puck. Avoid repeating a generic controller across the roster. Reuse verified StudyJunior production animals/items for avatars, pairs, prompts and scene decoration where appropriate.
- Make inviting a group effortless: one shareable room link plus a QR invite, visible seats, readiness, readable rules, friends' reactions and one-click rematch with fresh consent. No QR token may bypass the room's access policy.
- Keep the first action obvious and controls easy on phones. Spectators see the match, reactions and results, without secret information. Small win celebrations, turn cues, seed/piece/board motion and optional sounds should reinforce play rather than obstruct it.
- The social economy demo is create → invite → choose NEAR testnet entry → everyone ready → actual multiplayer game → server-verified result → pot/return → rematch. Cooperative/subjective games show shared achievements or reviewed community activities instead of an invented automatic winner payout.
- Avoid slow onboarding, long rules walls and forced background music. Provide a short interactive rules explanation and an expandable rules reference. Never shorten a traditional game by changing rules without naming the variant.

## Delivery batches

Each batch ends with runnable code, meaningful tests, a demonstration, updated registry/docs and a list of remaining limitations. Publish only the games that have passed. Later batches cannot be represented as already delivered.

### Batch 0 — catalogue gate and foundations

1. Inventory discovery, search, mode/category filters, creation selectors and deep links. Publish our own completed solo-plus-online games. Exclude imported titles and Ludo. Keep working knowledge-game solo and multiplayer modes; archive unfinished prototypes honestly.
2. Introduce a server-enforced registry with explicit readiness, supported modes/player counts, engine version, asset attribution and evidence references. A launchable entry must map to a working server engine and client renderer.
3. Implement shared room lifecycle, private/public access, queue/invites, reconnection, versioned input handling and NEAR escrow settlement integration. Build only the framework needed for the first real game.
4. Complete Dots and Boxes as the first end-to-end vertical slice. Do not call a generic empty room the completed foundation.

### Batch 1 — named favourites and the showcase shortlist

Follow the showcase order above: one complete foundation game, then Oware and Checkers, followed by Reversi, Hex and Nine Men's Morris. All seven board priorities need named deterministic rules, acceptance cases and real multiplayer. Chess follows with a validated rules engine. Conditional party/arcade games remain parked until their skill gates are satisfied. Do not infer player limits from the old quiz lobby. The following specifications retain extra detail for Dots and Boxes, Chess and Mancala.

| Game | Required rules and behavior | Release examples |
| --- | --- | --- |
| Dots and Boxes | One common configurable grid with a fixed launch default; each edge drawable once; adjacent box completion, ownership, scoring and extra turns; end when all boxes are owned; explicit tie outcome | A single edge completes two boxes correctly. Out-of-turn, repeated and non-adjacent edges are rejected. Both devices display identical owners and remaining moves. |
| Chess | Standard legal moves including check, castling, en passant and promotion; checkmate/stalemate; resignation and draw agreement; implement and test standard claimable/automatic draw rules, including repetition and move-count conditions; server-owned clock with one documented default time control | A pinned piece cannot expose its king. Castling through check fails. Promotion choice is synchronized. Timeout is adjudicated using the declared chess rules, including positions where the opponent cannot mate. Reconnect preserves board and clocks. |
| Mancala | Oware (Abapa): six houses each, four seeds per house, skip the starting house when lapping, capture opponent houses of two/three, feed an empty opponent and void grand-slam capture | All 48 seeds are conserved. Feeding, capture, no-feed finish and repetition use the declared Oware rules on both devices. No Kalah stores/extra-turn rules. |

A maintained permissively licensed chess rules dependency is acceptable; document its exact version and licence. “From scratch” requires a new integrated multiplayer implementation, not unnecessary reimplementation of validated rule primitives. Use original/appropriately licensed visuals and controls.

### Batch 2 — one genuine live racing game

After the board priorities and racing skill gate pass, build one polished top-down race for 2–4 remote players, with one fixed original track initially. Deliver steering, acceleration/braking, visible remote vehicles, server-owned movement, track boundaries, ordered checkpoints/laps, a synchronized countdown and an authoritative finish order. Choose and document collision behavior. If vehicles cannot collide, label it a non-contact race and still show live opponents in the common race.

Clients send controls, never final positions, lap totals, speed, finishing timestamps or score. Use a fixed server tick, bounded input rate, snapshots/deltas, interpolation and prediction/reconciliation where needed. Specify how simultaneous finishes are tied or ordered using authoritative simulation time. Server lag must not allow input bursts to create extra simulation time. A disconnected player cannot continue indefinitely under stale acceleration.

Prototype targets: 20 Hz authoritative simulation, 10–20 Hz updates and smooth client rendering. Treat these as starting parameters, then measure on the supported devices. Acceptance must include 150 ms round-trip latency with 50 ms jitter and 1% simulated transport disruption, plus degraded behavior at 300 ms round-trip latency. Publish actual results and load limits. SQLite persistence must not require a synchronous disk transaction for every render frame.

### Batch 3 — expand in small, distinct batches

Select three to five qualifying entries per subsequent batch from the 34-game roster above. Oware and Checkers are explicit user priorities; Ludo is explicitly excluded. Preserve each entry's interaction, player range, skill gate and outcome requirements. A server-validatable puzzle race needs input validation and a fixed reviewed server-owned puzzle, not a reported local score or random content draw. Add a full rule/edge-case specification before starting any later game; a roster row alone is not a release approval.

Keep imported games out of publication; build original replacements with all three modes. Maintain an inventory linking old IDs to replacements or archive status. New rules, tracks, themes or quiz packs are variants of an existing game unless they materially change its mechanics. Review the completed batch before selecting the next one.

## Rooms, invitations and matchmaking

Use a documented state machine: `lobby → countdown → playing → finished`, with terminal `cancelled`/`aborted` paths. Distinguish a network-disconnected participant from a room state. State transitions happen on the server.

- A player creates a room or joins a public queue filtered by game, rule version, player range, entry amount and compatible options. Queue cancellation and matching are atomic; never charge a player twice or enroll them in two matches from duplicate requests.
- Shareable invite links join the intended room across devices. Public discovery and link-only/private rooms have different access policies. For private rooms, possession of an authorized invitation must be checked server-side; unlisted alone is not access control. Do not put secrets in public feed data or logs.
- Show entry terms, rules and disconnect policy before joining. Readiness is explicit. A host cannot start without the minimum humans and all required players ready; readiness resets when material rules change. Freeze paid terms before locking entries.
- Spectators are read-only, consume no player slot and cannot affect state or settlement. Respect room privacy and game-specific secret information. Hidden-information games need redacted views and, where necessary, delayed spectating; no spectator endpoint may expose unrevealed cards or answer keys.
- Identify players by authenticated session, never by submitted display name or body `playerId`. Enforce one seat per identity; multiple tabs must not yield extra seats. Do not claim practice guests are Sybil-resistant.
- Reconnect restores the same seat, board, accepted-input sequence and authoritative clock. Resubmitting an unacknowledged action must not repeat it. A stale client gets a current snapshot or a clear conflict, not a divergent private game.
- Define lobby expiry, host departure, intentional resignation, network grace, timeout and server-restart policies per game before taking entry NEAR. Default lobby expiry may remain 30 minutes. Use a visible 30-second network grace as an initial policy where appropriate; chess clocks continue according to its published rules. Host departure does not destroy a running server-owned match.
- Rematch requires fresh consent and new settlement identity; it cannot silently reuse a locked stake. Surface loading, full room, expired invite, reconnecting, spectator and finished states clearly.

## Server authority and proposed contracts

The following shapes are implementation guidance, not a demand for one file layout or transport library. Keep the boundaries and invariants even if names change. Use a new namespace such as `/api/game-rooms` if adapting `/api/parties` would break stored quiz rooms; add a compatibility adapter when needed.

```ts
type GameRegistration = {
  id: string;
  engineVersion: string;
  release: 'parked' | 'testing' | 'verified-online';
  interaction: 'shared-turns' | 'shared-world' | 'challenge-race';
  minPlayers: number;
  maxPlayers: number;
  supportedRules: string[];
  skillPolicyVersion: string;
  initialStateVersion: string;
  skillGate: 'pending' | 'verified-deterministic';
  cover: string;
  attribution: string[];
  evidence: string[];
};

type ClientInput = {
  protocolVersion: number;
  roomId: string;
  matchId: string;
  inputId: string;          // unique idempotency key, scoped to authenticated actor/match
  sequence: number;
  expectedRevision?: number; // turn-based conflicts; not a global lock on racing inputs
  action: unknown;          // schema validated by the selected game engine
};

type RoomEvent = {
  protocolVersion: number;
  roomId: string;
  matchId: string;
  eventId: string;
  revision: number;
  serverTime: number;
  type: 'snapshot' | 'delta' | 'ack' | 'presence' | 'result';
  payload: unknown;         // filtered for this authenticated player/spectator
};
```

The engine contract needs `create`, `validateInput`, `applyInput`, optional fixed-step `tick`, `viewFor`, `result` and versioned serialize/restore operations. Inject clocks and fixed versioned initial states for testing. Scores and payouts must follow validated player performance. Persist the shared question/puzzle set and version before reveal; private prompts/answers stay server-side until their specified reveal. Cryptographic tokens and cosmetic randomness live outside the outcome engine. Clients may predict presentation but cannot determine legality, score, game-over or winnings.

Persist immutable match identity, engine/rule version, participants, entry terms, state revision, accepted-input IDs, sufficient replay/checkpoint data, deadlines and final result. Serialize accepted actions and settlement atomically where they affect money. Use bounded logs, snapshots and backpressure; do not retain unlimited client input forever. Restore only compatible engine versions, or apply a documented refund/abort path rather than guessing a state migration.

POST plus room-scoped SSE is acceptable for board games. Events need ordering, gap detection, authenticated resume and snapshot recovery; the existing global invalidation stream has none of those guarantees. WebSocket is a reasonable racing option. Authorize the upgrade and room subscription, check origins, validate every message, cap payloads and rates, and revalidate expired/revoked sessions. Broadcast public state to authorized viewers and private state only to its owner. Use server time for deadlines and monotonic elapsed time for simulation.

Guarantee one applied result for an input regardless of duplicates/retries, not an impossible promise of exactly-once network delivery. If an `inputId` is reused with different content, reject it. A lost event or reconnect uses an authoritative snapshot plus accepted sequence to resume. An old-match input must never mutate a rematch.

## NEAR testnet settlement

**The demo leads with Play for stakes.** Free multiplayer and solo are optional secondary paths. No FUN currency exists. Mainnet stays disabled until separately authorized after testnet validation.

All funded entries require a verified wallet deposit into `contract/src/rooms.rs`. Creation and contributions have explicit storage reserves. `server/near-economy.mjs` prepares transactions, confirms finalized chain state and applies the corresponding local room change. Clients never supply trusted funding, score or payout data.

- Verify exact deposits, immutable terms, receipt IDs, participant membership and wallet ownership. Retries must not double-fund or double-settle.
- Persist the authoritative result before the separate oracle signs settlement. Match payouts conserve every yoctoNEAR, including deterministic split remainders.
- Preserve cancellation, resignation, restart and tie rules; refunds use original on-chain contributions. Expired escrow can be refunded without the game server.
- Expose recovery for confirmed deposits whose browser/API response was interrupted. Reject stale claim votes using the on-chain claim revision.
- Group pots and bounties use independent contributor approvals, distinct from game-engine scoring. AI does not directly release a prize.
- Collect confirmed rewards/refunds from contract credit; never present a pending local result as a confirmed payment.

The current public testnet contract and verification scripts are documented in [near-testnet.md](near-testnet.md). The oracle is trusted to report game results; this is not trustless on-chain execution of the games. Retain separate oracle and deployment keys and preserve the testnet-only guard.

## Interface, accessibility and assets

Use the existing cream/yellow/lilac/coral palette, typography, wordmark, illustrated cards and approachable adult social tone. Integrate gameplay into the app's room and navigation rather than replacing the whole design. Preserve responsive card dimensions and load heavyweight game renderers only when opened.

Reuse `public/art/game-covers` and `src/game-art.ts` mappings where appropriate. Preserve `public/art/studyjunior/penguin.svg`, `saturn.svg`, `octopus.svg` and `provenance.json`; confirm the recorded rights and attribution before reuse. Art may illustrate a game without implying the old engine has been upgraded. Rename misleading titles and covers only where the actual replacement requires it.

### Required production StudyJunior asset workflow

Use the **production StudyJunior MCP asset library** for the rebuilt game's StudyJunior imagery. The three checked-in SVGs are provisional local exports, not verified production selections: their current provenance explicitly records that no remote MCP calls were used. Preserve that distinction until each is matched against production metadata or replaced with an approved production selection.

Before connecting, read the authoritative local integration documents:

- `/Users/benedictasamoah/Dev/StudyJunior/backend/docs/primer.md`
- `/Users/benedictasamoah/Dev/StudyJunior/backend/docs/admin-ai-mtls.md`

Use remote Streamable HTTP at `POST https://<configured-production-backend>/api/mcp/primer`, with the existing **admin Sanctum bearer token** and the production approved client-certificate/mTLS configuration. Do not guess the production hostname. The remote endpoint retains admin authorization, origin policy and throttling. There is no OAuth discovery flow; configure the approved client's bearer header explicitly. Never embed tokens, private keys or certificate secrets in frontend code, repository files, prompts, screenshots or evidence. Do not disable mTLS or use a parent/learner token to bypass admin access.

Discover and call `list_collections`, `search_assets` and `get_assets` through the connected production MCP client. Search by the actual game/scene need, review candidate visuals, and retrieve the chosen assets' current metadata and anchors. `search_assets` supports pages up to 50; `get_assets` supports up to 30 image UUIDs per batch. Respect the documented endpoint rate limit and current tool schemas.

For each selection, retain the production asset UUID, source/environment, collection, original asset file or canonical original-file reference, dimensions/viewBox, anchors, bounds, SHA-256 of downloaded original bytes, retrieval time and owner/licence/permission provenance. Preserve original bytes and record any derived files separately. Do not invent an `assetUUID`, bounds, anchors or a production provenance claim. If metadata is missing, record it as missing and resolve it before claiming verified production integration.

`php artisan mcp:start studyjunior-primer` is a local stdio alternative that runs with the operator's database/OS access. It does **not** automatically read the production library. The Primer documentation explicitly says local environments do not inherit production assets; a local asset search is not evidence of a production match.

Connection check on 2026-11-14: the saved Studio Build MCP connection at the configured production host returned HTTP 401, with the build token reported missing, expired or revoked. The owner will reconnect library access. The read-only asset search was not reached. `src/QuestionArt.tsx` now renders optional question illustrations in solo and multiplayer; `server/question-art.mjs` holds the shared exact-prompt mapping, intentionally empty until real production selections are verified. Add only relevant artwork that does not identify the correct choice through its drawing, URL or alt text. Every question must remain answerable from text when an optional image fails.

At handoff time, no connected production StudyJunior MCP tools are established in this task. Production connection and asset verification remain pending, and this document does not claim that any production asset was fetched. The implementing model must surface the concrete missing connection/configuration without requesting secrets in chat, continue independent gameplay work, and keep the production-asset deliverable incomplete until the authorized connection and evidence exist.

Support desktop keyboard/mouse and phone touch, visible focus, usable hit areas, readable contrast, text descriptions of moves/status and non-colour-only player identification. Board games need keyboard-operable cells/moves and meaningful labels; announce turn changes and results without flooding screen readers with every network tick. Respect reduced-motion settings. Racing needs usable touch controls and equivalent keyboard controls. Check narrow screens, landscape/portrait and fullscreen exit.

Honor the existing `slotvend-sound` preference, with sound off unless enabled. All new game audio must route through one shared setting; turning sound off immediately silences active and future sounds. Start/resume audio only after a user gesture, recover gracefully if the browser refuses it, and clean up audio contexts/listeners on exit. Keep music and game effects separately controllable, matching the existing footer controls. Muting effects immediately silences all game effects; pausing music silences the music track. No renderer or imported frame may bypass the relevant control.

Preserve creator/source/licence notices for reused assets and dependencies. A permissive code licence does not automatically license every bundled image or sound; check assets separately. Implement original mechanics/UI or use documented permissible primitives. Do not copy proprietary game code/assets or imply affiliation with original creators. Record new art, track and sound provenance.

## Security and privacy requirements

Keep imported frames sandboxed without `allow-same-origin`. Do not solve multiplayer or audio integration by giving an untrusted import cookies, storage, top navigation, arbitrary network access or unrestricted `postMessage` privileges. Prefer new trusted first-party game renderers; if a frame remains, use a narrow validated bridge bound to its specific window/instance and treat all messages as untrusted commands, never results. Preserve the library CSP and API origin separation.

Validate auth, room membership, seat/turn ownership, state phase, legal actions, bounds, sequence and payload size on every action. Reject out-of-range coordinates, impossible movement, stale/malicious revisions, injected actor identities, speed hacks and fabricated results. Use bounded per-user/per-room/IP budgets and concurrent connection limits without breaking legitimate gameplay. Avoid unsafe HTML for names/chat; retain moderation/report behavior.

Private rooms must not leak through list, event, snapshot, chat, replay, scoreboard or live-feed endpoints. Do not broadcast hidden board information and hide it with CSS. Avoid logging session cookies, invitation secrets or private hands. Public results and replay sharing must be explicit and redact private information. Retention should be bounded and documented. Practice names are not verified identities; no anti-cheat or privacy guarantee should exceed demonstrated behavior.

## Validation and evidence

Run the repository's existing `npm test` and `npm run build`, plus meaningful game-specific checks. Keep the current contract tests unchanged unless the separate contract is deliberately changed. Add deterministic rule fixtures and integration tests against temporary databases; test behavior/invariants instead of mirroring implementation branches.

Required automated coverage:

- Legal/illegal moves, terminal states, draws, clocks, deterministic replay and hidden-information views for each game; stone/box/piece conservation or other relevant invariants.
- Two independent authenticated clients playing through the actual HTTP/stream transport, with identical public state and one consistent result. No mocked network as the sole multiplayer test.
- Reproducible scoring: the same persisted board/question set plus inputs yields the same result; cosmetic randomness and token generation never affect play. Seat/order agreement, mirrored or swapped-leg fairness and deterministic ties are exercised.
- Concurrent seat joins, full rooms, ready/start races, host exit, spectator mutation attempts, rematches and queue cancellation/match races.
- Duplicate, delayed, missing and out-of-order messages; reconnect during countdown/play/finish; stale inputs after resync; tab suspension, session expiry and server restart.
- Spoofed player IDs, unauthorized private-room access, forged scores/outcomes, illegal moves, input floods, impossible speed and hidden-state leakage in every response/event.
- NEAR conservation, insufficient balance, double-join, split ties, refund/forfeit rules, repeated settlement and failure/restart around commits.
- Latency/jitter/loss testing and measurable state-recovery behavior; specify when a game stops accepting controls or ends/refunds due to unrecoverable service failure.
- Audio mute across active/new games, responsive controls, keyboard accessibility, reduced motion and cleanup when leaving a room.

Before enabling **each** game, demonstrate two physical devices on the same running service with independent session cookies and different players, for example a laptop and phone. Separate browser contexts are necessary automated evidence but not the sole physical-device proof. Use a reachable LAN/HTTPS origin with correctly configured `APP_ORIGIN`; do not disable origin checks for the demo. Record create → invite/queue → join → ready → start → live inputs from both devices → finish → matching result and balances. Include disconnect/reconnect and one spectator where supported. Record commit/engine version, browsers/devices, room/match IDs, environment, observed latency and evidence location; redact private data.

If physical devices are unavailable, report that limitation and keep the game `testing` and hidden. Do not mark it verified because two local screenshots look similar. Video/screenshots supplement, but do not replace, server logs and rule/transport tests.

## Catalogue release gate

Both verified solo play and `verified-online` with fair skill-based scoring are necessary but not sufficient: registration must resolve to the correct server engine, client renderer, rules and passing evidence. The server rejects creation of unverified games even if the browser forges an ID. Derive all playable discovery and counts from the same approved registry, including search, featured sections, picker, random selection and deep links. Existing room history should never become a launch bypass.

Release checklist for every game:

- [ ] Distinct playable rules implemented; interaction type and player limits accurate.
- [ ] Two or more independent human players can complete a live match across physical devices.
- [ ] Skill policy passes: no outcome RNG or unresolved chance-dependent mechanic; fixed rules/state, agreed seats, deterministic tie policy and replay evidence.
- [ ] Server owns state, clocks, legality, score and terminal result.
- [ ] Room, invite/queue, spectator policy, reconnect, rematch and failure behavior are complete.
- [ ] NEAR escrow settlement/refunds are atomic, conserved, idempotent and tested.
- [ ] Private/hidden information and credentials remain protected across every transport.
- [ ] Latency, disconnect, duplicates, cheating attempts and restart checks pass.
- [ ] Bright existing UI, mobile/keyboard controls, shared mute and asset attribution are preserved.
- [ ] StudyJunior production assets were selected through the authorized MCP, with real UUIDs, original files, metadata and rights provenance; provisional local exports are not described as production selections.
- [ ] Existing tests/build pass; evidence records exact implementation version and limitations.
- [ ] Registry registration and all discovery/launch paths enforce the same release state.
- [ ] README and visible counts describe delivered capabilities only; parked work stays parked.

A deliverable summary must name files changed, games actually released, checks run, cross-device evidence, remaining limitations and next batch. Do not claim “all games multiplayer” while some visible games are wrappers, offline titles or future work.

## Starter prompt for the implementing model

> Work in `betvend-development`. Read this entire handoff, repository instructions, current README, game catalogue, party server, storage, API, game rendering and design files before editing. Preserve ongoing user changes. Rebuild actual multiplayer games from scratch inside the existing React/Vite/Node/SQLite app; every discoverable playable game must support two or more independent devices. Park solo and local-only titles; keep archives, art and attribution. A room/chat wrapper, a quiz substitution or a client score submission is not a multiplayer rebuild.
>
> Read the latest product decisions first. Build original games with all three modes: solo for fun, online multiplayer free, and online multiplayer for NEAR testnet stakes. Preserve the seven delivered boards and nineteen knowledge/puzzle challenges. Use Mancala as the public name with Oware rules; exclude Ludo and duplicate Kalah. Do not publish imported games or remove working solo modes. Trivia, maths and science are skill/knowledge games; shared generated/curated questions are supported with validated answers. Extend the 34-concept backlog in complete batches, including full chess and fun original mini-games. Every title needs real online game state, reconnection, authoritative results and tested settlement; a social wrapper around a solo game is insufficient. Gameplay assets should be polished SVG drawings from ImageGen references. Preserve sessions, source/licence archives, existing balances and the bright UI. Preserve the documented NEAR testnet escrow integration and keep mainnet disabled.
