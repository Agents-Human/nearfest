# NearFest game delivery checklist

The catalogue currently exposes 53 original entries. All expose solo and independent online modes. Topic packs are catalogue entries, not claims of distinct engines. Imported titles, Ludo and the duplicate Kalah title stay out of discovery.

## Current catalogue

| Game | ID | Engine | Multiplayer entry |
| --- | --- | --- | --- |
| Mancala | oware | skill | NEAR testnet + free |
| Checkers | checkers | skill | NEAR testnet + free |
| Chess | chess-online | skill | NEAR testnet + free |
| Pocket Racers | pocket-racers | arcade | NEAR testnet + free |
| Stick Rivals | stick-rivals | arcade | NEAR testnet + free |
| Number rush | maths | knowledge / puzzle | NEAR testnet + free |
| Lab partners | science | knowledge / puzzle | NEAR testnet + free |
| Know-it-all? | trivia | knowledge / puzzle | NEAR testnet + free |
| One move. Checkmate. | chess | knowledge / puzzle | NEAR testnet + free |
| Connect Four | connect-four | skill | NEAR testnet + free |
| Dots and Boxes | dots-boxes | skill | NEAR testnet + free |
| Reversi | reversi | skill | NEAR testnet + free |
| Hex | hex | skill | NEAR testnet + free |
| Nine Men’s Morris | nine-mens-morris | skill | NEAR testnet + free |
| Paddle Duel | paddle-duel | arcade | NEAR testnet + free |
| Air Hockey | air-hockey | arcade | NEAR testnet + free |
| Snake Arena | snake-arena | arcade | NEAR testnet + free |
| Foam Frenzy | bomb-maze | arcade | NEAR testnet + free |
| Mini Golf | mini-golf | arcade | NEAR testnet + free |
| Marble Knockout | marble-knockout | arcade | NEAR testnet + free |
| Kitchen Rush | kitchen-rush | arcade | Free |
| Paint Tag | paint-tag | arcade | NEAR testnet + free |
| Platform Relay | platform-relay | arcade | Free |
| Draw & Guess | draw-guess | arcade | Free |
| Word Hunt | word-hunt | arcade | NEAR testnet + free |
| Word Relay | word-relay | arcade | NEAR testnet + free |
| Category Sprint | category-sprint | arcade | Free |
| Clue Crew | clue-crew | arcade | Free |
| Bluff Club | bluff-club | arcade | Free |
| Deduction Club | deduction-club | arcade | Free |
| Maths Tug-of-War | maths-tug | arcade | NEAR testnet + free |
| Equation Forge | equation-forge | arcade | NEAR testnet + free |
| Circuit Crew | circuit-crew | arcade | Free |
| Orbit Rescue | orbit-rescue | arcade | Free |
| Bridge Builders | bridge-builders | arcade | Free |
| Molecule Match | molecule-match | arcade | NEAR testnet + free |
| Sudoku Race | sudoku-race | arcade | NEAR testnet + free |
| Codebreakers | codebreakers | arcade | NEAR testnet + free |
| Space cadet | space | knowledge / puzzle | NEAR testnet + free |
| On the record | music | knowledge / puzzle | NEAR testnet + free |
| Sports brain | sports | knowledge / puzzle | NEAR testnet + free |
| Where on Earth? | geography | knowledge / puzzle | NEAR testnet + free |
| Wild guesses | animals | knowledge / puzzle | NEAR testnet + free |
| Think sideways | life | knowledge / puzzle | NEAR testnet + free |
| Chain reaction | crypto | knowledge / puzzle | NEAR testnet + free |
| Back in the day | history | knowledge / puzzle | NEAR testnet + free |
| Good taste | food | knowledge / puzzle | NEAR testnet + free |
| Multiply the fun | times | knowledge / puzzle | NEAR testnet + free |
| Roll credits | cinema | knowledge / puzzle | NEAR testnet + free |
| Hello, world | tech | knowledge / puzzle | NEAR testnet + free |
| What comes next? | sequence | knowledge / puzzle | NEAR testnet + free |
| Piece of cake | fractions | knowledge / puzzle | NEAR testnet + free |
| Word shuffle | words | knowledge / puzzle | NEAR testnet + free |

## Verified layers

- Rule and room tests: npm test. Temporary databases keep these tests separate from the user's app.
- TypeScript and production bundling: npm run build.
- Escrow and permission checks: npm run test:contract; see evidence/contract-report.json.
- Actual wallet sign-in, deposits, result settlement, independent group approvals and withdrawal: npm run test:testnet; see evidence/nearfest-testnet.json. A completed_at timestamp is required for a completed run.
- A published game must have an authoritative multiplayer state, solo path, reconnect behavior, legal-input checks, explicit outcome rules and illustrated gameplay.

## Remaining verification limits

Physical multi-device play, sustained production load, latency fairness across regions and an independent contract audit are not certified by these automated checks. Individual action games have bounded authored content; a catalogue count does not imply unlimited levels. Mainnet stays disabled. The game server remains the trusted outcome signer. Live NEAR AI inference is not configured.

See [the game requirements](multiplayer-game-rebuild.md) and [testnet architecture](near-testnet.md).
