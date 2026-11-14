# NearFest on NEAR testnet

NearFest's demo starts with **Play for stakes**. Players connect independent NEAR testnet wallets, fund the same prize pot, play an authoritative multiplayer match, and collect the result. Free multiplayer and solo are secondary options. There is no FUN currency, fungible-token mint or mainnet mode.

## Current deployment

- Contract: [`nearfest-mwg03pdw-2886.testnet`](https://testnet.nearblocks.io/address/nearfest-mwg03pdw-2886.testnet)
- Oracle: `oracle.nearfest-mwg03pdw-2886.testnet`
- Compiled-code hash and sandbox checks: `evidence/contract-report.json`
- Public testnet API/transaction verification: `evidence/nearfest-testnet.json`, written incrementally by `npm run test:testnet`; only a report with `completed_at` represents a complete run.

The deployed WASM was downloaded through NEAR RPC and its SHA-256 compared to the tested artifact. The deployment key and oracle key are separate. The deployment account retains upgrade authority. This is functional testnet verification, not an independent security audit or a mainnet release.

## Demo flow

1. Open a competitive title such as Connect Four, Mancala or Paddle Duel and choose **Play for stakes**.
2. Connect a testnet wallet and sign the NEP-413 sign-in message. The signature does not authorize spending.
3. Choose the entry amount, create the room, and approve its deposit transaction. Share the room link with a second independent wallet.
4. The other player deposits the same entry; both mark ready. The host confirms the on-chain participant list and starts.
5. Play the match. The game server validates inputs, computes the result and submits the result hash and winner set through the separate oracle.
6. Wait for **Rewards confirmed on NEAR**, then open the account panel and **Collect**. A finished local match does not itself mean settlement has confirmed.

Board matches play two legs with starting sides swapped. Competitive action games use the game's published concession/tie rules. Subjective/cooperative titles remain free; a separately reviewed group activity can use a group pot.

## Money and storage

All amounts use native NEAR and integer yoctoNEAR. Testnet NEAR has no monetary value. Stakes are 0.01–100 NEAR per contribution.

| Action | Attached deposit |
| --- | --- |
| Create a game, group pot or bounty | Initial stake + 0.1 NEAR storage reserve |
| Join a game/pot or add bounty funding | Contribution + 0.01 NEAR receipt storage reserve |
| Create a custom two-player bet | Stake + 0.03 NEAR storage reserve |
| Start, approve, cancel, claim or collect | Network gas; no additional stake |

Storage reserves are nonrefundable. There is no platform percentage fee. Prize pots exclude storage reserves. Cancellation returns original contributions through contract credit. Payouts divide every yoctoNEAR, including deterministic remainders. Withdrawals are pull-based; a failed transfer restores the credit.

## Authority, approvals and recovery

`contract/src/rooms.rs` owns funding, membership, start, claim revision, independent votes, refunds and credits. `server/near-economy.mjs` prepares wallet transactions, verifies finalized chain state, then changes local game state. It never treats a client request or local balance as proof of a deposit. Contribution receipts prevent replay. Confirmed actions are recoverable after browser/API interruption.

The server oracle is trusted for game outcomes; the contract does not execute all game logic or prove a result hash true. AI can curate answer-checked questions and suggest evidence, but does not directly release game pots. Group pots and bounties require a majority of eligible contributors other than the named winner to approve the current claim. Revision-bound votes cannot silently approve replaced evidence. Bounty funding freezes after the first claim.

Waiting game rooms accept deposits for 30 minutes. The host can cancel a waiting game; a non-host can leave. An on-chain deposit missing from the local participant list blocks starting, and the host can refund that unconfirmed player. If the server is unavailable, anyone can call `refund_room` after the stored `refund_at` deadline (90 minutes after game creation; group/bounty deadline plus 48 hours). Mainnet checks reject non-testnet RPC chains and contract account IDs.

The account panel lists interrupted wallet actions. Recover confirmed deposits without sending them again, or cancel/refund eligible waiting deposits. Game-server failures retry settlement; an expired pot remains refundable on chain.

## Local setup and checks

Keep using the original checkout. Do not replace an existing `.env`, database or deployment to run a check.

```sh
npm run dev
npm test
npm run build
DOCKER_CONTEXT=colima-humandemo npm run test:contract
npm run test:testnet
```

The public testnet check requires the running app on 5188/5189 and the ignored `.nearfest-testnet-keys.json` test accounts. It signs as those disposable test accounts, uses actual wallet transactions and writes public transaction hashes. It funds new test rooms each run; it is not a unit test and must never be pointed at mainnet. `TEST_API_URL` and `APP_ORIGIN` can override the local addresses.

For a completely fresh testnet deployment only, `npm run setup:testnet` creates faucet-funded contract/oracle/test-player accounts and saves private keys locally with mode 0600, then updates the NEAR values in `.env`. Build/check the contract and run `npm run deploy:testnet`. The deployment command refuses to overwrite an existing contract. Never commit `.env`, `.nearfest-*-keys.json`, runtime data or deploy keys.

Optional `NEAR_AI_API_KEY` is separate from wallet and escrow setup. It is not configured here; curated-bank fallback remains available. `MCP_ASSETS` is a separate server-only StudyJunior library credential and is not sent to wallets or the browser.
