# NearFest

**A social multiplayer arcade, strategy board, and challenge platform with a real NEAR testnet game economy — built for instant play without wallet extensions or seed phrases.**

> **NEAR Hackathon 2026 Submission** ([nearhackathon.com](https://nearhackathon.com)) · **Submitted**  
> **Tracks:** Games With Real Economies · Social Money (Social Fun) · Open Innovation  
> **Deployed Testnet Contract:** [`nearfest-mwg03pdw-2886.testnet`](https://testnet.nearblocks.io/address/nearfest-mwg03pdw-2886.testnet) · **Oracle Signer:** `oracle.nearfest-mwg03pdw-2886.testnet`

> **Live URL:** [`nearfest-mwg03pdw-2886.testnet`](https://nearfest-2fgw8.ondigitalocean.app)

---

---

## Overview

NearFest turns casual and competitive multiplayer gaming into a self-contained on-chain game economy on **NEAR testnet**. Instead of tacking a token onto a static dashboard, the economy drives every match, group tournament, head-to-head challenge, and community bounty:

- **Chain-abstracted onboarding:** Players join with a username and password. NearFest provisions a named `.testnet` account, encrypts its signing key server-side (`AES-256-GCM`), and automatically funds it with **10 test NEAR** via NEAR's testnet account helper—removing browser wallet popups, gas prompts, and seed phrases from the core game loop.
- **42 live playable games & challenges** in the discovery lobby (across real-time 2D/3D arcade games, deterministic two-player strategy board games, and timed quizzes/puzzles), playable **solo** or in **staked multiplayer rooms**.
- **Four on-chain economic primitives** on one Rust smart contract (`contract/src/lib.rs` & `contract/src/rooms.rs`), with **0% platform fees**, exact yoctoNEAR payout splitting, pull-based withdrawals, and permissionless timeout refunds.
- **AI-assisted help** powered by **NEAR AI Cloud** (`zai-org/GLM-5.1-FP8`) for bounded quiz curation, semantic moderation, and source-cited factual dispute proposals—always constrained by verbatim citation checks and human challenge windows—plus transparent disclosure of AI-assisted development.

---

## Submitted Hackathon Tracks

| Track | How NearFest Delivers |
| --- | --- |
| **Games With Real Economies** | 42 live games & challenges wired directly to on-chain NEAR escrow (`settle_game`), with 0% platform cut, exact yoctoNEAR payout splits, deterministic 2-leg board matches, real-time server-authoritative arcade rooms, and automatic 10 test NEAR starter grants so the economy powers every match loop. |
| **Social Money *(Social Fun)*** | Built for friends and groups pooling money together: **Group Pots** (`kind: "pot"`, 2–30 members) and **Community Bounties** (`kind: "bounty"`) govern shared prize pools via contributor majority voting (`vote_room`), paired with two-player challenges, live sideline chat, emoji reactions, invite links, broadcast overlays, and optional peer referees. |
| **Open Innovation** | Combines seamless chain abstraction (password-authenticated `nf-<hex>.testnet` accounts with server-MAC-verified TX execution and PostgreSQL `managed_locks` nonce leases), **NEAR AI Cloud** evidence judging with a 15-minute on-chain challenge window, and durable `pg-boss` payment/deadline recovery in one cohesive web arcade. |

---

## How the Game Economy Works

In NearFest, the economic loop *is* the social game loop:

1. **Instant Wallet & Balance Loop**
   - New players pick a username and password (`server/managed-accounts.mjs`). The server creates a unique `nf-<hex>.testnet` account mapped to that username (scrypt password hashes, AES-256-GCM encrypted keys with account-ID AAD), obtains an initial **10 test NEAR** grant, and confirms finalized balance before marking funds ready.
   - An optional dedicated sponsor faucet (`server/faucet.mjs`) supports bounded top-ups up to **10 NEAR every 24 hours** for accounts below 10 NEAR, persisted with transaction hashes before broadcast so retries never double-spend.
2. **Staked Play & Shared Prize Pots**
   - **Multiplayer Game Rooms (`kind: "game"`):** Players stake equal native NEAR entries (`0` NEAR for free rooms or any positive yoctoNEAR amount) into an escrow room (`create_room` / `contribute_room`). The host confirms the finalized participant list (`start_room`), an authoritative server engine runs the match, and the separate oracle settles the prize pot on chain (`settle_game`).
   - **Two-Player Head-to-Head Challenges (`create_bet` / `accept_bet`):** Players propose two-sided challenges across **Sports, Crypto, Maths, Facts, Science, Life, and Gaming**, lock equal stakes, and resolve outcomes via player consensus, a named referee, ESPN fixtures, Binance 1-minute candle closes, deterministic arithmetic, or **AI + sources**.
   - **Group Pots (`kind: "pot"`):** 2–30 players pool funds for tournaments or group nights; any participant can submit an evidence-hashed winner claim (`claim_room`), which pays out only after an independent majority vote of contributors excluding the claimant (`vote_room`).
   - **Community Bounties (`kind: "bounty"`):** Multiple backers crowdfund a task reward. A doer claims with hashed proof (`claim_room`), freezing further deposits until independent contributors approve or reject the claim on chain.
3. **Pull-Based Credits & Safety Invariants**
   - **Zero platform cut:** Prize pools distribute 100% of contributed stakes (splitting every yoctoNEAR deterministically, including remainders).
   - **Storage reserves:** Nonrefundable storage deposits (`0.1 NEAR` room/pot/bounty creation, `0.01 NEAR` room contribution, `0.03 NEAR` two-player challenge) cover on-chain contract state.
   - **Pull-based withdrawals (`withdraw` / `on_withdraw`):** Winnings and refunds accrue as contract credits and restore atomically if a transfer fails.
   - **Permissionless refunds (`refund_room` / `refund_expired`):** If a host cancels before start, a challenge goes unmatched, or an active room stalls past `refund_at` (48 hours post-deadline), anyone can trigger on-chain refunds.
   - **Testnet-only guardrails:** Mainnet RPC endpoints and non-`.testnet` contract accounts are rejected at startup and across account/faucet helpers.

---

## Games & Modes

From `server/game-catalog.mjs` and `src/App.tsx`, **42 titles** are active in the discovery lobby (`9` additional engine games remain archived behind `hiddenGameIds`):

| Category | Count | Titles |
| --- | ---: | --- |
| **Real-Time Arcade (`server/arcade/`)** | 17 | *Astro Dash*, *Pocket Racers*, *Yokai Duel*, *Tappy Plane*, *Bridge Builders*, *Cat Defense*, *Toy Tank Arena*, *Snake Arena*, *Draw & Guess*, *Word Hunt*, *Word Relay*, *Category Sprint*, *Equation Forge*, *Circuit Crew*, *Orbit Rescue*, *Molecule Match*, *Codebreakers* |
| **Strategy Board Games (`server/skill/`)** | 6 | *Chess*, *Checkers*, *Connect Four*, *Reversi*, *Hex*, *Nine Men's Morris* (2-leg matches with alternating starting sides) |
| **Timed Quizzes & Puzzles (`server/play.mjs`)** | 19 | *Number rush*, *Lab partners*, *Know-it-all?*, *One move. Checkmate.*, *Space cadet*, *On the record*, *Sports brain*, *Where on Earth?*, *Wild guesses*, *Think sideways*, *Chain reaction*, *Back in the day*, *Good taste*, *Multiply the fun*, *Roll credits*, *Hello, world*, *What comes next?*, *Piece of cake*, *Word shuffle* |

Live lobby state, room chat, gameplay ticks, and on-chain settlement confirmations sync via Server-Sent Events (`/api/events` and arcade room streams) backed by PostgreSQL and durable `pg-boss` queues (`server/job-queue.mjs`).

---

## AI-Assisted Help

AI assists both inside the NearFest application and in how this project was built and verified.

### 1. In-App AI Features (NEAR AI Cloud)

Configured via `NEAR_AI_API_KEY` (default endpoint `https://cloud-api.near.ai/v1`, default model `zai-org/GLM-5.1-FP8`):

- **AI Evidence Judge for Factual Challenges (`server/resolvers.mjs`):**
  - When a challenge uses the `evidence` (**AI + sources**) resolver, the server fetches Wikipedia article extracts and asks NEAR AI to evaluate the claim strictly as untrusted data.
  - The model must return JSON with a verdict (`true`, `false`, or `null`) and verbatim substring quotes (`12–180` characters) verified against the fetched text; each source extract is SHA-256 hashed. If evidence is ambiguous, conflicting, or unsupported, the judge abstains and refuses to propose an automatic payout.
  - **Human-in-the-loop safety:** AI verdicts never release escrow directly. They submit `propose_result` through the oracle, opening a **15-minute challenge window** (`REVIEW = 15 * 60 * 1000` in `contract/src/lib.rs`) where either player can dispute the proposal and escalate to player consensus, a chosen referee, or timeout refund.
- **AI Quiz Curation (`server/curator.mjs`):**
  - For multi-round quiz/word/math runs, `curateQuestions` sends candidate prompts (never answers) to NEAR AI so questions are varied, non-repetitive, and ordered from easier to harder for the requested difficulty (`mixed` or `brainy`).
  - The model returns only integer IDs from the server's bounded, answer-checked bank—it cannot invent questions, answers, or change scoring—and automatically falls back to deterministic local shuffling when `NEAR_AI_API_KEY` is not set.
- **Semantic Content Moderation (`server/resolvers.mjs`, `server/index.mjs`):**
  - `semanticModerate` adds an optional LLM safety classifier on top of deterministic server filtering (`moderate` in `server/domain.mjs`). Setting `REQUIRE_SEMANTIC_MODERATION=true` enforces semantic moderation before user-created content is published.

### 2. AI-Assisted Development Disclosure

- **AI-assisted coding tools** were used during the hackathon alongside human architecture, smart-contract security design, manual gameplay testing, and on-chain verification to implement game engines, PostgreSQL/job-queue migrations, managed NEAR account cryptography, UI components, and tests.
- All critical economic paths—escrow invariants, nonce serialization, transaction replay prevention, and settlement—are covered by automated tests in `tests/` and reproducible evidence logs in `evidence/`.

---

## Architecture & Repository Layout

```text
├── contract/                 # NEAR Rust escrow smart contract (lib.rs, rooms.rs)
├── server/
│   ├── index.mjs             # HTTP API, SSE streams, auth sessions, moderation
│   ├── near-economy.mjs      # Prepared TX MACs, finalized chain sync & recovery
│   ├── managed-accounts.mjs  # Custodial testnet account provisioning & AES-256-GCM signing
│   ├── faucet.mjs            # Bounded in-app testnet sponsor faucet
│   ├── resolvers.mjs         # Maths, Binance crypto, ESPN sports, & NEAR AI evidence resolver
│   ├── curator.mjs           # NEAR AI bounded quiz curator
│   ├── job-queue.mjs         # Durable pg-boss queues for deadlines & payment recovery
│   ├── arcade/               # 17+ real-time server-authoritative game engines
│   └── skill/                # Deterministic 2-player strategy board engines
├── src/                      # React 18 + TypeScript + Vite + Three.js + Matter.js frontend
├── scripts/                  # Local Postgres, dev launcher, test runner, contract & testnet scripts
├── tests/                    # Automated API, engine, PostgreSQL, concurrency & recovery tests
├── docs/                     # Managed accounts, testnet verification, & game specs
└── evidence/                 # Sandbox & public NEAR testnet verification artifacts
```

---

## Quickstart (Run Locally)

### Prerequisites

- **Node.js `22.12+`** (uses native `--env-file-if-exists` and `node --test`)
- **npm**
- *(Optional)* **Docker / Colima** if rebuilding or running the Rust NEAR sandbox tests (`npm run test:contract`)

### 1. Install and Configure

```sh
npm install
cp .env.example .env
npm run setup:accounts
```

`npm run setup:accounts` generates a 32-byte `NEAR_MANAGED_ACCOUNT_KEY` and writes it to `.env` (mode `0600`).

### 2. Start Local PostgreSQL (Terminal 1)

NearFest uses PostgreSQL (`pg` + `pg-boss` queues). `db:local` boots an isolated local `embedded-postgres` server bound to `127.0.0.1:5432` with persistent storage under `data/postgres/`:

```sh
npm run db:local
```

Keep this terminal running.

### 3. Start the App (Terminal 2)

```sh
npm run dev
```

- **Frontend (Vite):** `http://127.0.0.1:5188`
- **API Server:** `http://127.0.0.1:5189`

> **Optional environment configuration (`.env`):**
> - **Live NEAR testnet settlement:** Configure `NEAR_CONTRACT_ID`, `NEAR_ORACLE_ACCOUNT`, and `NEAR_ORACLE_PRIVATE_KEY` (or run `npm run setup:testnet` & `npm run deploy:testnet` for a fresh deployment).
> - **Dedicated in-app faucet:** Run `npm run setup:faucet` to populate `NEAR_FAUCET_ACCOUNT` and `NEAR_FAUCET_PRIVATE_KEY`.
> - **NEAR AI features (`AI + sources` resolver, AI quiz curation, semantic moderation):** Set `NEAR_AI_API_KEY` (without it, deterministic resolvers and curated question banks remain fully playable).

---

## Testing & Verification Evidence

### Run Automated Test Suite & Production Build

```sh
npm test        # Spins up an isolated temporary PostgreSQL cluster and runs tests/*.test.mjs
npm run build   # Runs TypeScript check (tsc --noEmit) and Vite production build
```

`npm test` automatically initializes, starts, and cleans up an ephemeral `embedded-postgres` instance (unless `TEST_DATABASE_URL` is supplied).

### Smart Contract & Public Testnet Verification

| Check | Command / Artifact | Recorded Result |
| --- | --- | --- |
| **Isolated NEAR Sandbox** | `npm run test:contract` / `evidence/contract-report.json` | **18/18 checks passed** (WASM SHA-256: `71c6748254b8be636629e1f78ef89ee3f63abfd30f6162e2c5411030a0d6901e`) |
| **Public NEAR Testnet E2E** | `npm run test:testnet` / `evidence/nearfest-testnet.json` | **7/7 scenarios passed** on `nearfest-mwg03pdw-2886.testnet` (`completed_at: 2026-11-14T18:35:37.065Z`) |
| **State-Preserving Upgrade** | `evidence/nearfest-upgrade.json` | Verified WASM deployment preserving all 17 stored state entries (`state_preserved: true`) |
| **In-App Faucet Replay & Auth** | `npm run test:faucet` / `evidence/nearfest-faucet.json` | Verified 10 NEAR authenticated grant & replay protection |

For full protocol details, see [docs/near-testnet.md](docs/near-testnet.md) and [docs/managed-accounts.md](docs/managed-accounts.md).

---

## License

Covered original source code and documentation are provided under the **NearFest Evaluation Licence 1.0** ([LICENSE](LICENSE)), Copyright © 2026 KesaLabs Ghana Limited, granting **NEAR Hackathon 2026** organizers, judges, and automated evaluation tools permission to download, build, run, and test this submission. Third-party assets and packages remain under their respective licenses ([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).
