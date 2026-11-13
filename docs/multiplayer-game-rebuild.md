# Multiplayer game rebuild: implementation handoff

Status: requirements for a future implementation. This document does not assert that the rebuild exists.

## Product decision

Rebuild actual games from scratch for people playing together on separate devices. Every game exposed in the playable catalogue must support a verified online match involving at least two independently authenticated human players. Park solo-only and same-device-only games until their replacements pass the release gate. Keep their source archives, IDs, art and licence records; do not delete the library to simplify discovery.

A group pot around independent offline games, a shared chat, a client-submitted scoreboard, an iframe around a solo game, or two tabs sharing local storage does not satisfy this requirement. Chess must be a legal chess match, not a chess question pack. Dots and Boxes must share one board; Mancala must share one board; racing must have live opponents in the same authoritative race. Never advertise a capability merely because a `multiplayer` boolean is set.

The interim playable catalogue is the 19 existing cross-device timed quiz/puzzle challenges, subject to their release audit. All 29 same-device imported games must be parked too, along with every other solo/local-only title. Their local player count is not an exception to the online requirement. Rebuilt games are admitted individually after verification.

Build a small, excellent set of distinct games, then expand in reviewable batches. Do not manufacture hundreds of titles by changing quiz topics, seeds, difficulty, time limits, colour schemes or round counts. No requirement exists to rebuild all 1,004 imports immediately or to reproduce proprietary code, branding or art.

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
| Art/design | `public/art/game-covers`, `public/art/studyjunior`, `public/art/README.md`, `THIRD_PARTY_NOTICES.md`, `src/bright.css` | Preserve the bright slotVend design, compact illustrated cards, existing cover mappings, and StudyJunior assets/provenance. |
| Economy | `server/store.mjs`, `server/domain.mjs`, `server/community.mjs`, `server/near.mjs`, `src/wallet.ts` | New game settlement uses practice FUN only. Existing community approval flows and two-player NEAR bets are separate systems. Do not silently repurpose either. |

The existing server is a single-process, persistent-disk application. Do not introduce Supabase, Redis, a new identity provider or a hosting rewrite merely to add multiplayer. A new dependency or WebSocket transport is acceptable when justified and pinned. Horizontal scaling is not an initial deliverable; prevent multiple processes from owning the same simulation if deployment assumptions later change.

Current party actions are limited to 60 requests per minute per user. Do not send racing input through that path unchanged, or remove global protection to make it work. Define separate bounded input and connection budgets appropriate to each game.

## What “online multiplayer” means

Use explicit mode labels in the registry and UI:

- **Shared board, live turns:** players modify the same server-owned board. Chess, Dots and Boxes, and Mancala belong here. “Real-time” means live synchronization during the match; it does not mean simultaneous turns.
- **Shared world, simultaneous action:** all players inhabit the same evolving simulation. Racing belongs here. Positions, checkpoints and outcomes are authoritative on the server.
- **Simultaneous challenge race:** participants receive equivalent challenges with a synchronized start/deadline, live progress and a server-validated winner. This is legitimate online competition when clearly labelled, but is not a substitute for a shared-board or shared-world game.

Show the actual player range and interaction mode. Never label a same-device game “online.” Existing timed packs may remain visible only after auditing that they meet the online release requirements; describe them as timed challenges. Do not present the existing one-move chess puzzle as the rebuilt chess game.

## Game roster and hackathon priorities — 14 November 2026

This section defines the requested games for the next implementing model. It supersedes the earlier three-game shortlist. The immediate showcase priorities are **Ludo, Oware, Checkers, Draw & Guess and Paddle Duel**; **Connect Four** is a compact additional match. These are priorities, not a promise that all can be finished before the demo. Complete and verify games individually; tomorrow's public selection must reflect actual passing builds.

The requirements roster contains **40 distinct game concepts**, including familiar board games, social party games, arcade games and science/puzzle games. It is the first curated implementation roster toward the user's longer-term 1,000-title ambition; it does not claim to define all 1,000. The existing topic packs and variants do not inflate this count. Working names for original mini-games may change without creating extra titles.

Every row inherits the shared requirements below: independently authenticated players on separate devices, server-owned state and results, synchronized start/turns, reconnection, touch and keyboard controls, readable rules, optional SFX, accessible illustrations, and a real completed-match demonstration. No local pass-and-play fallback qualifies. Competitive games can offer free play and practice FUN pots only after their settlement checks pass. Cooperative and subjective party modes start as free play; their results do not automatically settle FUN pots.

### Tomorrow's showcase order

1. Finish the shared room/invite/reconnect/result path with one small game, Dots and Boxes or Connect Four. Reuse that infrastructure immediately for the named priorities.
2. **Oware and Checkers:** two recognisable strategic duels, distinctive boards, clear move animations, quick rematches. Oware must use its own rules; Kalah is a separate later game.
3. **Ludo:** the group centrepiece for 2–4 people, animated server-generated dice, shared tokens and a satisfying race home. Complete the exact launch rules below before polishing effects.
4. **Draw & Guess:** the social group choice, with a live drawing surface and private guesses. Do not expose the secret word to spectators.
5. **Paddle Duel:** the fast simultaneous-action option; only include it after real network play feels good on phone and laptop. Connect Four is an additional lower-complexity option if it is already complete.
6. Preserve the existing multiplayer maths/science/trivia challenges as ready-to-test variety. After the core games work, add one party or arcade game at a time. Full physics racing, complex hidden-role games and backgammon are later work, not tomorrow's critical path.

### Board and table games — 12

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `oware` — **Oware** | 2, shared turns | Abapa sowing and capture game; exact rules below. Server tracks all 48 seeds and both scores; win/draw comes from board state. |
| `checkers` — **Checkers / Draughts** | 2, shared turns | Named 8×8 English rules initially; mandatory jumps, complete capture chains and crowning. Capture or immobilise the opponent to win; draw rules below. |
| `ludo` — **Ludo** | 2–4, shared turns | Four tokens each, server dice, entry on six, captures, safe squares and exact finish. First to bring all four tokens home wins. Explicit launch rules below. |
| `chess-online` — **Chess** | 2, shared turns | A full legal chess match with clocks, special moves, draw claims, resignation and checkmate. Preserve the detailed chess acceptance criteria below. |
| `connect-four` — **Connect Four** | 2, shared turns | Drop into a non-full column on a 7×6 board; four connected pieces in any direction wins; full board without a winner draws. Show the winning line. |
| `dots-boxes` — **Dots and Boxes** | 2, shared turns | Claim shared edges, complete boxes and retain the turn after scoring; most boxes wins. Default 4×4 boxes; handle one edge completing two boxes. |
| `reversi` — **Reversi** | 2, shared turns | Place on an 8×8 board only when bracketing opponents; flip all valid rays, pass only with no legal move, finish when neither can move. Most discs wins. |
| `dominoes` — **Dominoes** | 2–4, shared turns and private hands | Double-six draw variant, seven tiles each; match either end, draw until playable or stock exhausted. Empty hand wins; blocked game uses lowest pip total, tied totals draw. Hide hands and stock order. |
| `nine-mens-morris` — **Nine Men's Morris** | 2, shared turns | Place nine pieces, then slide along connected points; a mill removes an eligible opposing piece. Permit flying at three pieces; below three or no legal move loses. Define repetition draw. |
| `hex` — **Hex** | 2, shared turns | An 11×11 hex board, opposite-edge connections and a swap option after the opening move. Server checks connectivity after every placement; no draw. |
| `backgammon` — **Backgammon** | 2, shared turns | Server dice, legal bar entry, hitting, forced available moves and bearing off. First to bear off wins. Single-game stakes only initially; no doubling cube; verify a named ruleset before implementation. |
| `kalah` — **Kalah** | 2, shared turns | Six pits with four stones each, stores, own-store extra turn, capture and final sweep. Retain existing Kalah requirements; its mechanics and ID stay separate from Oware. |

### Social party and word games — 8

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `draw-guess` — **Draw & Guess** | 3–8, rotating drawer and live guesses | Each player draws once per cycle, 60 seconds per drawing. Server-only answer aliases, private guesses and ordered correct answers. Guessers receive 100/80/60/40/20 points by correct-answer rank (20 thereafter); drawer earns 20 per solver. Most points after one cycle wins; equal scores tie. Free play initially. |
| `word-hunt` — **Word Hunt** | 2–8, simultaneous shared letter grid | Shared 4×4 letters, 90 seconds; adjacent cells form dictionary words without reusing a cell. One score per word per player, server dictionary/version and length-based scores; highest total wins. |
| `word-relay` — **Word Relay** | 2–8, live turns | Begin with the last letter of the previous word; ten seconds per turn, no repeated words and a published dictionary. Invalid/time-out loses a life; last player with a life wins. |
| `category-sprint` — **Category Sprint** | 2–8, simultaneous private answers | Same letter and five categories, 60 seconds, submit privately then reveal together. Valid unique answers score 10, shared answers 5; four rounds, highest total wins. Dictionary/curation plus visible dispute review; free play while judgment is subjective. |
| `clue-crew` — **Clue Crew** | 4–8 in two teams, rotating clue giver | Give text clues for a private word without listed forbidden terms; server validates prohibited words and exact answer aliases. Five equal timed turns per team, most solved cards wins. Give fair score/skip rules and hide cards from opponents. Free play initially. |
| `trivia-showdown` — **Trivia Showdown** | 2–16, synchronized question race | Build on the existing multiplayer quiz engine: curated mixed subjects, hidden prompts before start, server scoring and shared round reveals. Highest correct count wins; tied players share. Categories remain variants, not new titles. |
| `bluff-club` — **Bluff Club** | 3–8, simultaneous writing and secret voting | Submit plausible false answers to a safe prompt, mix with the curated truth, then vote. Correct votes score two; each opponent fooled scores one. Five rounds, most points wins. Moderate submissions, prevent self-voting and duplicate options; free play initially. |
| `deduction-club` — **Deduction Club** | 5–10, hidden roles and timed phases | One secret saboteur, other players investigators; night action then discussion and vote. Investigators win by identifying the saboteur; saboteur wins at one remaining investigator. Roles/actions stay server-private; eliminated players have separate spectator chat. Free play initially. |

### Arcade and movement mini-games — 10

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `paddle-duel` — **Paddle Duel** | 2, shared real-time arena | Each player controls one paddle; authoritative ball, bounds and serves. First to seven points wins; rotate the serve after each point. Drag controls and keyboard, speed limits and latency handling. |
| `air-hockey` — **Air Hockey** | 2, shared real-time table | Move a striker only inside your half; server simulates puck/striker collisions and goals. First to five wins; prevent teleport hits and cross-half movement. |
| `pocket-racers` — **Pocket Racers** | 2–4, shared real-time track | Three-lap top-down race with checkpoints, visible opponents and authoritative physics/finish order. Follow the detailed racing acceptance tests below. |
| `snake-arena` — **Snake Arena** | 2–6, shared real-time grid | Simultaneous snakes eat server-spawned food and avoid walls/bodies; last survivor wins. Simultaneous final collisions draw; five-minute cap uses length among survivors, with tied lengths sharing. |
| `bomb-maze` — **Bomb Maze** | 2–4, shared real-time grid | A playful foam-bomb maze with blocked paths, timed blasts and breakable tiles. Three short rounds; last survivor scores a round, tied survivors after the timer split that round's point. Most round points wins. No graphic violence. |
| `mini-golf` — **Mini Golf** | 2–4, live turns on shared holes | Three original holes; server simulates aim/power strokes, hazards, resets and cup detection. Eight-stroke cap per hole; lowest total wins and equal totals tie. Everyone sees each shot. |
| `marble-knockout` — **Marble Knockout** | 2–6, shared real-time arena | Steer marbles on a shrinking circular platform; server validates speed, collisions and boundary exits. Last marble wins; same-tick final eliminations draw. |
| `kitchen-rush` — **Kitchen Rush** | 2–4, cooperative shared workspace | Pick, chop, cook and deliver safe fictional meals against a three-minute timer. Lock item ownership, station actions and recipes; team wins at the published order target. Free play, shared achievement. |
| `paint-tag` — **Paint Tag** | 2–4, shared real-time arena | Move, aim and tag with bright paint; obstacles, bounded projectile speed and respawns. Most validated tags after two minutes wins; equal totals tie. Cosmetic splashes, no weapons branding or gore. |
| `platform-relay` — **Platform Relay** | 2–4, cooperative shared platform course | Players open switches and carry a baton through one original obstacle course. Server owns movement, checkpoints and baton transfer; everyone reaching the exit within three minutes wins. Free play. |

### Puzzle, maths and science games — 10

| ID / game | Players and interaction | Required game loop and result |
| --- | --- | --- |
| `maths-tug` — **Maths Tug-of-War** | 2–8 in balanced teams, simultaneous | Equivalent hidden arithmetic challenges; each verified correct answer pulls the shared rope one unit, wrong answers impose a two-second input cooldown. First to ten net pulls wins; 90-second limit uses rope position, centre draws. No raw click-speed scoring. |
| `equation-forge` — **Equation Forge** | 2–8, simultaneous puzzle rounds | Same six numbers and a target; construct an expression using each number at most once. Server parses safe arithmetic and scores target distance, then fewer operations; five rounds with published round points. Ties stay ties. |
| `circuit-crew` — **Circuit Crew** | 2–4, cooperative shared board | Rotate wires, switches and logic gates to power target lamps without short circuits. Three low-voltage fictional boards, three-minute timer; server evaluates connectivity and win state. Free play. |
| `orbit-rescue` — **Orbit Rescue** | 2–4, cooperative shared simulation | Divide steering, thrust and docking tasks to rescue three stranded probes before fuel/time runs out. Server physics, fuel and dock conditions; team success only when all probes are safe. Free play; illustrative space physics. |
| `bridge-builders` — **Bridge Builders** | 2–4, cooperative shared construction | Place limited beams between legal anchors, then run a shared load test. Three original gaps; server owns budget and stable bridge evaluation. Team wins if the test vehicle crosses all three. Free play; simplified mechanics clearly labelled. |
| `molecule-match` — **Molecule Match** | 2–4, simultaneous educational puzzle race | Assemble safe, curated molecule graphs from atom tokens; server checks allowed bonds and exact target graph. Five equal rounds, most valid completions wins. No experimental procedures or dangerous chemistry content. |
| `sudoku-race` — **Sudoku Race** | 2–4, synchronized puzzle race | Same server-generated solvable board, private entries, opponent progress only. First server-validated solution wins; cap uses correct cells with ties shared. Reject invalid or forged completions; spectating cannot reveal a solution. |
| `2048-race` — **2048 Race** | 2–4, synchronized move-based race | Each player has a private board and equivalent server RNG stream; send moves, never scores. First validated 2048 wins; three-minute cap compares highest tile then score. Name it a race, not a shared-board game. |
| `memory-match` — **Memory Match** | 2–4, shared turns | Twenty-four concealed cards, flip two per turn; a pair scores and retains the turn. Non-matches conceal after a shared reveal period; most pairs wins. Never send unrevealed identities to clients or spectators. |
| `codebreakers` — **Codebreakers** | 2–4, synchronized deduction race | Same secret of four symbols from six possible symbols; eight private guesses, exact/partial position feedback. Server handles duplicate symbols correctly. Solve with fewest guesses, then tie rather than a latency race; unresolved players do not win. |

### Detailed launch requirements for the named favourites

**Oware — Abapa, two players.** Twelve houses, four seeds each; sow counterclockwise, skipping the starting house on repeated laps. Capture backward along consecutive opposing houses containing two or three seeds after the final drop. A capture clearing the opponent's entire row takes nothing. Feed an empty opposing row whenever possible. No sowing into score bowls or extra turns. More than 24 captured seeds wins; 24 each draws. Reference: [Ply Yard's documented Abapa implementation](https://oware.plyyard.com/rules/). For slotVend, explicitly declare these endgame conventions in the room rules: if an empty opposing row cannot be fed, end the game and credit remaining seeds to the player whose row contains them; on the third identical board/score/side-to-move position, end and credit each row's remaining seeds to its owner. Compare final scores. Label the threefold endgame convention as a slotVend rule, not a universal Abapa rule. Record these choices in the engine rules version.

Oware's acceptance fixtures must include a long sow, chained capture, void grand slam, mandatory feed, no-feed ending, repetition ending, reconnection mid-animation and exact 48-seed conservation. Use a tactile wooden-style SVG board, individually animated seeds, readable pit counts and gentle seed clicks. Each device may orient its own row at the bottom, with a consistent server pit mapping. Board animation never delays authoritative turn processing or permits a second move.

**Checkers — 8×8 English draughts, two players.** Twelve men per side; men move and capture forward, kings in both directions. Captures are compulsory; choose any legal capture line and finish it. Promotion ends that turn, including capture chains. Winning requires taking all opposing pieces or leaving no legal move. Implement the WCDF repetition/no-progress draw conditions and draw agreement; identify the rules and clocks before joining. Reference: [WCDF Rules of Draughts](https://wcdf.net/rules/rules_of_checkers_english.pdf). Ghanaian/international variants require their own verified rule IDs and must not be silently mixed into this ruleset.

Checkers acceptance fixtures cover ignored mandatory jumps, branching multi-jumps, crowning during a jump, king movement, immobilisation, draw eligibility and duplicate move submissions. Use chunky coral/lilac SVG pieces, a crisp crown marker, highlighted legal moves and a short capture animation. Colour and orientation must not change move legality.

**Ludo — slotVend launch rules, two to four players.** Label this chosen house ruleset in the room; Ludo has multiple variants. Use a shared 52-cell outer track and six-cell home lane per colour, four tokens per player, one server-generated six-sided die. A six may enter a token at its own start or move an active token; six grants another roll. Three consecutive sixes forfeit the third roll and end the turn before a move; earlier moves stand. Players choose among legal tokens; if none can move, pass. Capturing an opponent on an unsafe square sends it home to the yard. Mark all four start squares and four star squares safe; safe squares allow coexistence and cannot capture. Own tokens may stack without forming movement blockades. Capturing/finishing grants no extra roll. Enter the home lane after a full track circuit; reaching its final cell requires the exact roll. First player with all four tokens home wins and ends the match. Document stable track indexes and clockwise turn order, including skipped empty seats.

Ludo acceptance fixtures cover every colour's home entry, safe-square coexistence, unsafe capture, stacks, overshoot, third-six handling, no-move turns and the final token. A duplicate roll request must return the original die result. Reconnect cannot reroll. Dice animation reflects the accepted server roll; no client-selected randomness. Draw a polished four-colour SVG board with distinct token shapes, an obvious active player, dice bounce, token hops, capture return animation and a brief winner celebration. Use a fixed published inactivity/forfeit policy for full matches; do not silently alter dice to make a demo faster.

**Draw & Guess.** Use a 30-second optional practice canvas before readying; the match begins only when everyone is ready. Private word choice from three moderated options goes only to the drawer. Other players and spectators receive bounded stroke events and public score changes, never the chosen word or other players' unsuccessful guesses. Exact normalized answers/curated aliases determine correctness; AI may curate safe words before play but cannot judge payout-worthy answers during a match. Cap stroke size/rate, implement undo/clear as ordered drawing events and reconnect with the current canvas. Give touch users a roomy canvas, colour dots, undo and an obvious guess field. Chat uses a separate tab to avoid accidental answer disclosure. Free play initially.

**Paddle Duel.** Send bounded paddle input at a rate the server explicitly supports. Use an authoritative ball and collision engine, equal paddle speeds, a ready countdown, score-to-seven and one result. Prediction may smooth motion but cannot award a goal. Test wall/paddle collisions, reconnect grace, duplicate goal detection, input flooding and latency on two devices. Use a bright, high-contrast court, satisfying restrained trails and optional bounce sounds. Respect reduced motion and the shared SFX control.

### What makes the collection feel fun

- Illustrate the actual game on each compact card: Ludo tokens/dice, an Oware board/seeds, checkers/crowns, a drawing pencil or an air-hockey puck. Avoid repeating a generic controller across the roster. Reuse verified StudyJunior production animals/items for avatars, pairs, prompts and scene decoration where appropriate.
- Make inviting a group effortless: one shareable room link plus a QR invite, visible seats, readiness, readable rules, friends' reactions and one-click rematch with fresh consent. No QR token may bypass the room's access policy.
- Keep the first action obvious and controls easy on phones. Spectators see the match, reactions and results, without secret information. Small win celebrations, turn cues, dice/seed/card motion and optional sounds should reinforce play rather than obstruct it.
- The social economy demo is create → invite → choose free/FUN entry → everyone ready → actual multiplayer game → server-verified result → pot/return → rematch. Cooperative/subjective games show shared achievements or reviewed community activities instead of an invented automatic winner payout.
- Avoid slow onboarding, long rules walls and forced background music. Provide a short interactive rules explanation and an expandable rules reference. Never shorten a traditional game by changing rules without naming the variant.

## Delivery batches

Each batch ends with runnable code, meaningful tests, a demonstration, updated registry/docs and a list of remaining limitations. Publish only the games that have passed. Later batches cannot be represented as already delivered.

### Batch 0 — catalogue gate and foundations

1. Inventory existing discovery, category filters, search, surprise/random selection, create-room selectors and deep links. Park all solo-only and local-only entries everywhere a user can start a new game. Archived records and completed-room history remain resolvable with an honest unavailable/archive state.
2. Introduce a server-enforced registry with explicit readiness, supported modes/player counts, engine version, asset attribution and evidence references. A launchable entry must map to a working server engine and client renderer.
3. Implement shared room lifecycle, private/public access, queue/invites, reconnection, versioned input handling and FUN settlement integration. Build only the framework needed for the first real game.
4. Complete Dots and Boxes as the first end-to-end vertical slice. Do not call a generic empty room the completed foundation.

### Batch 1 — named favourites and the showcase shortlist

Follow the showcase order above: finish the foundation game, then Oware, Checkers and Ludo, followed by Draw & Guess and Paddle Duel as capacity allows. Their detailed specifications above are required. Do not infer player limits from the old quiz lobby. The following established specifications are retained for Dots and Boxes, Chess and Kalah; Chess and Kalah follow the named favourites unless the user reprioritises them.

| Game | Required rules and behavior | Release examples |
| --- | --- | --- |
| Dots and Boxes | One common configurable grid with a fixed launch default; each edge drawable once; adjacent box completion, ownership, scoring and extra turns; end when all boxes are owned; explicit tie outcome | A single edge completes two boxes correctly. Out-of-turn, repeated and non-adjacent edges are rejected. Both devices display identical owners and remaining moves. |
| Chess | Standard legal moves including check, castling, en passant and promotion; checkmate/stalemate; resignation and draw agreement; implement and test standard claimable/automatic draw rules, including repetition and move-count conditions; server-owned clock with one documented default time control | A pinned piece cannot expose its king. Castling through check fails. Promotion choice is synchronized. Timeout is adjudicated using the declared chess rules, including positions where the opponent cannot mate. Reconnect preserves board and clocks. |
| Mancala | Name the initial variant explicitly: Kalah, six pits per side with four stones per pit; correct sowing, skipped opponent store, own-store extra turn, capture, terminal sweep, winner/tie | Seed conservation holds. Capture follows the declared opposite-pit mapping. An extra turn and a terminal sweep resolve identically on both devices. |

A maintained permissively licensed chess rules dependency is acceptable; document its exact version and licence. “From scratch” requires a new integrated multiplayer implementation, not unnecessary reimplementation of validated rule primitives. Use original/appropriately licensed visuals and controls.

### Batch 2 — one genuine live racing game

Build one polished top-down race for 2–4 remote players, with one original track initially. Deliver steering, acceleration/braking, visible remote vehicles, server-owned movement, track boundaries, ordered checkpoints/laps, a synchronized countdown and an authoritative finish order. Choose and document collision behavior. If vehicles cannot collide, label it a non-contact race and still show live opponents in the common race.

Clients send controls, never final positions, lap totals, speed, finishing timestamps or score. Use a fixed server tick, bounded input rate, snapshots/deltas, interpolation and prediction/reconciliation where needed. Specify how simultaneous finishes are tied or ordered using authoritative simulation time. Server lag must not allow input bursts to create extra simulation time. A disconnected player cannot continue indefinitely under stale acceleration.

Prototype targets: 20 Hz authoritative simulation, 10–20 Hz updates and smooth client rendering. Treat these as starting parameters, then measure on the supported devices. Acceptance must include 150 ms round-trip latency with 50 ms jitter and 1% simulated transport disruption, plus degraded behavior at 300 ms round-trip latency. Publish actual results and load limits. SQLite persistence must not require a synchronous disk transaction for every render frame.

### Batch 3 — expand in small, distinct batches

Select three to five entries per subsequent batch from the 40-game roster above. Ludo, Oware and Checkers are explicit user priorities, not optional unnamed candidates. Preserve each entry's interaction, player range and outcome requirements. A server-validatable puzzle race needs input validation and server-owned puzzle/RNG, not a reported local score. Add a full rule/edge-case specification before starting any later game; a roster row alone is not a release approval.

Keep unsupported imports parked. Maintain an inventory linking old IDs to replacements or archive status. New rules, tracks, themes or quiz packs are variants of an existing game unless they materially change its mechanics. Review the completed batch before selecting the next one.

## Rooms, invitations and matchmaking

Use a documented state machine: `lobby → countdown → playing → finished`, with terminal `cancelled`/`aborted` paths. Distinguish a network-disconnected participant from a room state. State transitions happen on the server.

- A player creates a room or joins a public queue filtered by game, rule version, player range, entry amount and compatible options. Queue cancellation and matching are atomic; never charge a player twice or enroll them in two matches from duplicate requests.
- Shareable invite links join the intended room across devices. Public discovery and link-only/private rooms have different access policies. For private rooms, possession of an authorized invitation must be checked server-side; unlisted alone is not access control. Do not put secrets in public feed data or logs.
- Show entry terms, rules and disconnect policy before joining. Readiness is explicit. A host cannot start without the minimum humans and all required players ready; readiness resets when material rules change. Freeze paid terms before locking entries.
- Spectators are read-only, consume no player slot and cannot affect state or settlement. Respect room privacy and game-specific secret information. Hidden-information games need redacted views and, where necessary, delayed spectating; no spectator endpoint may expose unrevealed cards or answer keys.
- Identify players by authenticated session, never by submitted display name or body `playerId`. Enforce one seat per identity; multiple tabs must not yield extra seats. Do not claim practice guests are Sybil-resistant.
- Reconnect restores the same seat, board, accepted-input sequence and authoritative clock. Resubmitting an unacknowledged action must not repeat it. A stale client gets a current snapshot or a clear conflict, not a divergent private game.
- Define lobby expiry, host departure, intentional resignation, network grace, timeout and server-restart policies per game before taking entry FUN. Default lobby expiry may remain 30 minutes. Use a visible 30-second network grace as an initial policy where appropriate; chess clocks continue according to its published rules. Host departure does not destroy a running server-owned match.
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

The engine contract needs `create`, `validateInput`, `applyInput`, optional fixed-step `tick`, `viewFor`, `result` and versioned serialize/restore operations. Inject clock and seeded RNG for testing. The server creates/stores RNG seeds and generates hidden material; do not expose seeds that reveal future cards, questions or hazards. Clients may predict presentation but cannot determine legality, score, game-over or winnings.

Persist immutable match identity, engine/rule version, participants, entry terms, state revision, accepted-input IDs, sufficient replay/checkpoint data, deadlines and final result. Serialize accepted actions and settlement atomically where they affect money. Use bounded logs, snapshots and backpressure; do not retain unlimited client input forever. Restore only compatible engine versions, or apply a documented refund/abort path rather than guessing a state migration.

POST plus room-scoped SSE is acceptable for board games. Events need ordering, gap detection, authenticated resume and snapshot recovery; the existing global invalidation stream has none of those guarantees. WebSocket is a reasonable racing option. Authorize the upgrade and room subscription, check origins, validate every message, cap payloads and rates, and revalidate expired/revoked sessions. Broadcast public state to authorized viewers and private state only to its owner. Use server time for deadlines and monotonic elapsed time for simulation.

Guarantee one applied result for an input regardless of duplicates/retries, not an impossible promise of exactly-once network delivery. If an `inputId` is reused with different content, reject it. A lost event or reconnect uses an authoritative snapshot plus accepted sequence to resume. An old-match input must never mutate a rematch.

## FUN settlement and NEAR boundary

Keep the current distinction between `balance` and collectible `credit`, integer amounts based on `UNIT`, and atomic SQLite transactions. Initial releases offer free play and optional practice FUN entry only; require a practice account for FUN. Do not auto-charge wallet accounts or infer that a connected NEAR wallet enables on-chain multiplayer stakes.

- Validate funds and lock/debit entry exactly once per player/match. Repeated join, queue match and start requests must be idempotent.
- Only the trusted game engine's terminal result can trigger automatic settlement. Client scores, iframe messages, chat votes, screenshots and self-reported winners cannot settle these matches.
- Record a result with engine/rules version, authoritative outcome, winner set, reason, revision/replay reference and integer payouts. Make settlement uniquely keyed to the match and commit terminal state plus credits in one transaction.
- Define payouts before play. With no fee, conserve the locked pot exactly. A tied competitive result splits among tied winners using documented deterministic integer-remainder handling. For two-player draws, refund each entry. Cancellation, unstartable lobby or an unrecoverable server-side abort refunds eligible entries. Publish game-specific resignation, disconnect and no-winner rules instead of blindly copying the quiz engine's “no correct answers” rule.
- Recovery after process failure must not lose entries, settle twice or strand funds. Test crashes before and after the settlement commit and repeated recovery ticks.
- Preserve existing community pots as separately reviewed activities, not proof that games are synchronized. Preserve the existing Collect flow and refresh balances/results only from server responses.

The existing NEAR contract is a separate two-player bet contract; public testnet deployment and online game escrow are not established by this document. Do not enable mainnet, add real-money claims, modify contract settlement or market FUN as monetary winnings. Future NEAR game escrow needs its own specification, deployment verification and security review.

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

- Legal/illegal moves, terminal states, draws, clocks, seeded randomness and hidden-information views for each game; stone/box/piece conservation or other relevant invariants.
- Two independent authenticated clients playing through the actual HTTP/stream transport, with identical public state and one consistent result. No mocked network as the sole multiplayer test.
- Concurrent seat joins, full rooms, ready/start races, host exit, spectator mutation attempts, rematches and queue cancellation/match races.
- Duplicate, delayed, missing and out-of-order messages; reconnect during countdown/play/finish; stale inputs after resync; tab suspension, session expiry and server restart.
- Spoofed player IDs, unauthorized private-room access, forged scores/outcomes, illegal moves, input floods, impossible speed and hidden-state leakage in every response/event.
- FUN conservation, insufficient balance, double-join, split ties, refund/forfeit rules, repeated settlement and failure/restart around commits.
- Latency/jitter/loss testing and measurable state-recovery behavior; specify when a game stops accepting controls or ends/refunds due to unrecoverable service failure.
- Audio mute across active/new games, responsive controls, keyboard accessibility, reduced motion and cleanup when leaving a room.

Before enabling **each** game, demonstrate two physical devices on the same running service with independent session cookies and different players, for example a laptop and phone. Separate browser contexts are necessary automated evidence but not the sole physical-device proof. Use a reachable LAN/HTTPS origin with correctly configured `APP_ORIGIN`; do not disable origin checks for the demo. Record create → invite/queue → join → ready → start → live inputs from both devices → finish → matching result and balances. Include disconnect/reconnect and one spectator where supported. Record commit/engine version, browsers/devices, room/match IDs, environment, observed latency and evidence location; redact private data.

If physical devices are unavailable, report that limitation and keep the game `testing` and hidden. Do not mark it verified because two local screenshots look similar. Video/screenshots supplement, but do not replace, server logs and rule/transport tests.

## Catalogue release gate

A `verified-online` flag is necessary but not sufficient: registration must resolve to the correct server engine, client renderer, rules and passing evidence. The server rejects creation of unverified games even if the browser forges an ID. Derive all playable discovery and counts from the same approved registry, including search, featured sections, picker, random selection and deep links. Existing room history should never become a launch bypass.

Release checklist for every game:

- [ ] Distinct playable rules implemented; interaction type and player limits accurate.
- [ ] Two or more independent human players can complete a live match across physical devices.
- [ ] Server owns state, RNG, clocks, legality, score and terminal result.
- [ ] Room, invite/queue, spectator policy, reconnect, rematch and failure behavior are complete.
- [ ] FUN settlement/refunds are atomic, conserved, idempotent and tested.
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
> Read the 40-game roster and 14 November showcase priorities first. Implement Batch 0 and Batch 1 in that order of priority: one complete foundation game, then Oware (Abapa), Checkers and Ludo, then Draw & Guess and Paddle Duel as capacity allows. Oware is not Kalah. Use the detailed launch rules and acceptance fixtures; ship only individually verified games. Retain Chess, Kalah and the rest of the roster as explicit later work. Reuse existing sessions, origin checks, FUN balances/Collect and the bright UI. Keep current quiz-room compatibility, sandbox isolation, StudyJunior assets and shared sound preference. Use server-authoritative rules, durable state, idempotent commands and settlement, private viewer projections, reconnect and real matchmaking/invites. Do not change the NEAR contract or enable real-money play.
>
> Use production StudyJunior MCP `list_collections`, `search_assets` and `get_assets` via the documented admin bearer + mTLS connection for StudyJunior art. Read the two referenced StudyJunior integration documents. Existing local SVGs are provisional until matched to production; never invent production UUIDs or provenance, expose credentials, or assume local stdio inherits the production database. Report unavailable production access explicitly and continue independent implementation work.
>
> Test each game through real independent client sessions, adversarial inputs, latency/disconnect and restart/settlement cases. Demonstrate two physical devices before enabling each game. If that evidence cannot be obtained, leave its registration `testing` and report exactly what remains. Finish with build/test results, changed-file summary, evidence and honest catalogue counts. After those batches are delivered, implement Batch 2 racing as a separate reviewable batch; do not fill the catalogue with near-identical packs. Use the handoff's release checklist as the acceptance criteria, adapting interface names where the repository warrants it.
