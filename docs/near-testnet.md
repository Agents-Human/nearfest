# NearFest on NEAR testnet

Choose **Play with friends**, enter a stake, and connect a NEAR testnet wallet. Players fund the same prize pot, play an authoritative multiplayer match, and collect the result. A zero stake opens a room without a deposit; **Play solo** starts individual practice. There is no FUN currency, fungible-token mint or mainnet mode.

## Current deployment

- Contract: [`nearfest-mwg03pdw-2886.testnet`](https://testnet.nearblocks.io/address/nearfest-mwg03pdw-2886.testnet)
- Oracle: `oracle.nearfest-mwg03pdw-2886.testnet`
- Compiled-code hash and sandbox checks: `evidence/contract-report.json`
- Public testnet API/transaction verification: `evidence/nearfest-testnet.json`, written incrementally by `npm run test:testnet`; only a report with `completed_at` represents a complete run.

The deployed WASM was downloaded through NEAR RPC and its SHA-256 compared to the tested artifact. The deployment key and oracle key are separate. The deployment account retains upgrade authority. This is functional testnet verification, not an independent security audit or a mainnet release.

## Demo flow

1. Open a competitive title such as Connect Four, Mancala or Paddle Duel and choose **Play with friends**.
2. Choose **Join**. If sign-in is needed, it starts immediately. The connector combines wallet connection and NEP-413 authentication using `signMessageParams`; the app reuses an existing authenticated session without opening the wallet. A player name is optional. Authentication does not authorize spending.
3. Choose the entry amount, create the room, and approve its deposit transaction. Share the room link with a second independent wallet.
4. The other player deposits the same entry; both mark ready. The host confirms the on-chain participant list and starts.
5. Play the match. The game server validates inputs, computes the result and submits the result hash and winner set through the separate oracle.
6. Wait for **Rewards confirmed on NEAR**, then open the account panel and **Collect**. A finished local match does not itself mean settlement has confirmed.

Board matches play two legs with starting sides swapped. Every published multiplayer game supports optional stakes selected during room setup. Arcade rooms use the game's server-owned win/tie rules; resigning a staked game awards the pot to the remaining players. Solo practice has no stake.

## Money and storage

All amounts use native NEAR and integer yoctoNEAR. Testnet NEAR has no monetary value. There is no application-defined minimum or maximum for positive stakes. Decimal amounts support all 24 yoctoNEAR places. A fresh available-wallet-balance check covers the stake plus required contract storage before a new deposit is prepared; the wallet also enforces its transaction costs.

| Action | Attached deposit |
| --- | --- |
| Create a game, group pot or bounty | Initial stake + 0.1 NEAR storage reserve |
| Join a game/pot or add bounty funding | Contribution + 0.01 NEAR receipt storage reserve |
| Create a custom two-player bet | Stake + 0.03 NEAR storage reserve |
| Start, approve, cancel, claim or collect | Network gas; no additional stake |

Storage reserves are nonrefundable. There is no platform percentage fee. Prize pots exclude storage reserves. Cancellation returns original contributions through contract credit. Payouts divide every yoctoNEAR, including deterministic remainders. Withdrawals are pull-based; a failed transfer restores the credit.

## Authority, approvals and recovery

`contract/src/rooms.rs` owns funding, membership, start, claim revision, independent votes, refunds and credits. `server/near-economy.mjs` prepares wallet transactions, verifies finalized chain state, then changes local game state. It never treats a client request or local balance as proof of a deposit. Contribution receipts prevent replay. The app checks finalized contract state while the wallet popup is open: a missing popup callback does not block entry into a confirmed room. Concurrent requests reuse the same intent and room ID, confirmations share one in-flight operation, and a retry of an already-funded creation opens that room without another deposit. Prepared transactions bind the authenticated signer. Confirmed actions remain recoverable after browser/API interruption.

The server oracle is trusted for game outcomes; the contract does not execute all game logic or prove a result hash true. AI can curate answer-checked questions and suggest evidence, but does not directly release game pots. Group pots and bounties require a majority of eligible contributors other than the named winner to approve the current claim. Revision-bound votes cannot silently approve replaced evidence. Bounty funding freezes after the first claim.

Waiting game rooms accept deposits for 30 minutes. The host can cancel a waiting game; a non-host can leave. An on-chain deposit missing from the local participant list blocks starting, and the host can refund that unconfirmed player. If the server is unavailable, anyone can call `refund_room` after the stored `refund_at` deadline (90 minutes after game creation; group/bounty deadline plus 48 hours). Mainnet checks reject non-testnet RPC chains and contract account IDs.

The wallet shows the available balance, a small Collect action when credit is available, and collapsed funding and Activity sections. The server checks pending payments every 20 seconds, restores confirmed room membership, and retires an unpaid creation only after a successful finalized read finds no room after its signing deadline plus a one-minute finality buffer. It never resends a room deposit or requests a wallet signature in the background. If approval is still needed, Activity offers Continue using the original room and contribution receipt. Game-server failures retry settlement; an expired pot remains refundable on chain.

Activity retains confirmed room actions, expired unpaid requests, faucet transfers, winnings and refunds in SQLite across browser and server restarts. Payout entries are recorded once from verified terminal escrow state. It displays the latest 30 entries and links to the full wallet transaction history on NEAR. Balance refreshes run while the app is visible and on return to the tab. Server recovery continues with the browser closed; reconnecting restores rooms into My rooms. Existing funded players go directly from Join to wallet approval. First-time players use one combined connection and authentication action that starts directly from Join; there is no Account/Wallet/Continue wizard and no Ready to join confirmation. Names equal to wallet addresses are valid. Collect still requires wallet approval. PostgreSQL is not required for this single-server workflow.

## Local setup and checks

Keep using the original checkout. Do not replace an existing `.env`, database or deployment to run a check.

```sh
npm run dev
npm test
npm run build
DOCKER_CONTEXT=colima-humandemo npm run test:contract
npm run test:testnet
```

The public testnet check requires the running app on 5188/5189 and the ignored `.nearfest-testnet-keys.json` test accounts. It signs as those disposable test accounts, uses actual wallet transactions and writes public transaction hashes. The suite requires at least 0.8 test NEAR available in each disposable test wallet. Refill only from a separate funding wallet, never escrow or oracle funds. It funds new test rooms each run; it is not a unit test and must never be pointed at mainnet. `TEST_API_URL` and `APP_ORIGIN` can override the local addresses.

For a completely fresh testnet deployment only, `npm run setup:testnet` creates faucet-funded contract/oracle/test-player accounts and saves private keys locally with mode 0600, then updates the NEAR values in `.env`. Build/check the contract and run `npm run deploy:testnet`. The deployment command refuses to overwrite an existing contract. Never commit `.env`, `.nearfest-*-keys.json`, runtime data or deploy keys.

Optional `NEAR_AI_API_KEY` is separate from wallet and escrow setup. It is not configured here; curated-bank fallback remains available. `MCP_ASSETS` is a separate server-only StudyJunior library credential and is not sent to wallets or the browser.

## In-app testnet funding

Joining automatically requests a free grant if the wallet cannot cover its entry and fees, then proceeds directly to wallet entry approval. The account panel also offers manual **Add test NEAR**. If funding is unavailable or limited, joining stays on the same screen and checks again when the player returns with funds. A separate faucet wallet pays the transfer and gas; an empty connected wallet does not need to approve a spending transaction or leave NearFest. Sign-in is still required, and the recipient is always the authenticated account, never an address supplied in a request body. Mainnet is rejected.

Funding is available below a 10 NEAR wallet balance, once every 24 hours per wallet. Persistent limits also cap five top-ups per network address per hour, ten total per hour and twenty per day. The faucet retains at least 0.1 NEAR after a transfer. The external faucet remains a backup when this reserve is empty or the service is limited. Shared networks can hit the network-address limit; this is a bounded hackathon demo faucet, not Sybil-resistant distribution.

The signer is configured through server-only `NEAR_FAUCET_ACCOUNT` and `NEAR_FAUCET_PRIVATE_KEY`; it must differ from the escrow and oracle accounts. `npm run setup:faucet` creates one fresh faucet-sponsored testnet wallet, preserves its keys in ignored `.nearfest-faucet-keys.json` with mode 0600, and writes the two runtime values to `.env`. It reuses the same account on subsequent runs; it does not mint endless replacement accounts. Refill that public testnet account when needed.

Each signed transfer is persisted with its hash before broadcast. Pending requests recover or re-broadcast that exact transaction rather than signing another payment. Only final successful outcomes are shown as delivered. Unresolved transfers hold further funding so a later nonce cannot overtake them. `npm run test:faucet` verifies authenticated HTTP funding and replay handling against a disposable testnet recipient; evidence is in `evidence/nearfest-faucet.json`.

Faucet grants are up to 10 NEAR per eligible wallet every 24 hours, capped by the amount needed to reach a 10 NEAR balance and the sponsor’s spendable funds after its gas reserve. Smaller grants are rounded down to 0.01 NEAR, with a minimum useful grant of 0.25 NEAR. Each claim stores its own amount, so pre-upgrade 1 NEAR claims and pending transfers remain accurate and recoverable; their existing cooldowns are preserved. The sponsor retains at least 0.1 NEAR; it can offer a smaller grant rather than rejecting every request below 10.1 NEAR. Availability distinguishes a depleted reserve, cooldown and RPC failure. Pending transfers reconcile automatically on the server, even after the funding panel or browser closes; retries reuse the persisted signed transaction and never prepare a second grant. Operators must replenish the dedicated faucet for continued use; no escrow or oracle funds are used for top-ups.

## Verified wallet-flow fix (2026-11-14)

The contract artifact in `evidence/contract-report.json` passed 18 sandbox scenarios plus the native withdrawal tests. `evidence/nearfest-upgrade.json` records the state-preserving testnet upgrade and the SHA-256 of the code downloaded after deployment; no initializer or migration ran, and all stored key/value pairs were unchanged. The public testnet suite includes an Astro Dash payment whose wallet callback intentionally never resolves, duplicate-create retries, final-state ownership checks, joins, cancellation, settlement and collection. Use `npm run test:testnet -- --resume` to continue only unfinished checks from its report.

Future upgrades use `scripts/upgrade-testnet.mjs` with explicit `--expected-current-sha256` and `--expected-wasm-sha256` values. The default is a read-only verification; `--apply` backs up code and state, deploys only the tested artifact, and verifies code and storage afterward. Fresh deployment remains a separate command that refuses to overwrite a contract.

Development-server shutdown now closes both lobby and arcade event streams, with a bounded drain for remaining HTTP connections. An integration test keeps both streams open during shutdown so a code reload cannot silently leave the API unavailable.

Finalized reads share in-flight requests and use bounded backoff for HTTP 429 responses. Unchanged escrow ticks no longer trigger balance refreshes in every open tab. Arcade subscribers receive finalized settlement changes directly. Public testnet checks are paced to respect the public RPC; application-level confirmations never retry a deposit merely because an RPC read failed.
