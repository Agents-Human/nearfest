# NearFest app-managed testnet accounts

New players choose a NearFest username and password. The app creates one named NEAR testnet account, obtains its initial 10 native test NEAR through NEAR's testnet account-creation helper, and continues the saved room invitation. No external wallet extension, seed phrase, or wallet sign-in is used.

Accounts, encrypted signing keys, password hashes, sessions, and prepared transactions are stored in PostgreSQL and work across replicas. Usernames are case-insensitive. Passwords use scrypt with a per-account salt. Keys use AES-256-GCM with the account ID as authenticated data. Neither password hashes nor private keys are returned to the browser. Losing a password currently requires creating another demo account; there is no email reset service.

## Deployment

Run `npm run setup:accounts` once in the original checkout. This adds `NEAR_MANAGED_ACCOUNT_KEY` to the ignored `.env`, preserving an existing key. Add this same secret to the deployed app's runtime environment, then deploy. Every replica and subsequent deployment must use the same key. Keep a secure backup together with the database backups; replacing or losing the key makes previously stored account keys unreadable. Never put it in `VITE_` variables or commit it. Database migration 5 creates the managed account and transaction tables automatically.

The initial account grant does not depend on `NEAR_FAUCET_ACCOUNT` or its balance. The public helper is called only for a saved, newly registered account and public key. Retries use that same account and key, verify key ownership and finalized balance, and never generate replacement accounts to bypass service limits. A helper failure or limit keeps the account and invitation ready to retry. The UI never reports the initial 10 NEAR as delivered until on-chain state confirms it. Native NEAR available for play can be slightly below 10 because of protocol storage and transaction costs.

The existing optional faucet remains available for later top-ups under its existing per-account and network limits. Its availability does not block registration. Mainnet remains blocked.

## Transactions and recovery

The existing escrow contract and server validation prepare each game action. Prepared transactions carry a short-lived server MAC bound to the signer, contract, actions, deposit, and action ID. The managed signer executes them directly in the triggering request, rejects modified or unauthorized actions, and keeps stable action IDs across retries. External wallet signing has been completely removed.

Short-TTL PostgreSQL row leases (`managed_locks`) serialize per-account nonces across replicas without holding pool or advisory-lock connections during external RPC/helper I/O. The signed transaction and hash are committed before broadcast. Pending broadcasts are reconciled before another account nonce is prepared. Retries and durable background jobs resend only the saved signed transaction; they never sign another deposit for an ambiguous result. Successful and definitively failed receipts are recorded. Game membership and results are still accepted only after the existing finalized contract-state checks.

Logout invalidates the app session without deleting the account, funds, or rooms. Signing in on another browser with the same username and password restores that same account. This is a custodial testnet demo: NearFest holds the encrypted testnet signing keys and signs only app-prepared actions initiated by the authenticated player. It is not enabled for mainnet.

## Checks

`npm test` includes real PostgreSQL tests for registration, encrypted keys, initial funding, duplicate signup, returning users, account isolation, tamper rejection, ambiguous broadcasts, cross-instance concurrency, background recovery, and HTTP registration/signing/logout. The HTTP tests use a test RPC double with the real SDK's transaction encoder and signer. `npm run build` typechecks and builds the frontend.
