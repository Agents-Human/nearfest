# Game music credits

These are original, unmodified MP3 downloads from the composer’s official site, renamed for the application. They were not extracted from YouTube.

## Exhilarate

“Exhilarate” — Kevin MacLeod ([incompetech.com](https://incompetech.com/)). Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- [Official track page](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300028)
- [Original artist download](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Exhilarate.mp3)
- ISRC: `USUAN1300028`
- Application file: `/audio/games/racing-exhilarate.mp3`
- 170 BPM driving rock. Used for Pocket Racers, Stick Rivals, Paint Tag, and Bomb Maze.
- Modifications: original MP3 unchanged; renamed for the application. Playback adjusts volume and overlaps the end/start when repeating.

## Funk Game Loop

“Funk Game Loop” — Kevin MacLeod ([incompetech.com](https://incompetech.com/)). Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- [Official track page](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100839)
- [Original artist download](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Funk%20Game%20Loop.mp3)
- ISRC: `USUAN1100839`
- Application file: `/audio/games/racing-funk-loop.mp3`
- Modifications: none; filename only changed.

## Bassa Island Game Loop

“Bassa Island Game Loop” — Kevin MacLeod ([incompetech.com](https://incompetech.com/)). Licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

- [Official track page](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100840)
- [Original artist download](https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bassa%20Island%20Game%20Loop.mp3)
- ISRC: `USUAN1100840`
- Application file: `/audio/games/platformer-island-loop.mp3`
- Modifications: none; filename only changed.

## Display in the game

Keep the track title, artist, official source link and license link accessible in the game’s music credits. The license permits commercial use and adaptation with attribution. If a future edit modifies the audio, update the modification notice.

Suggested initial playback volumes: racing 0.30; platformer 0.24. All three tracks are stereo 44.1 kHz, 320 kbps MP3. Respect the user’s music toggle and start only after a user gesture. Do not run these at the same time as the lounge track.

The composer supplies Funk Game Loop and Bassa Island Game Loop as loops. Exhilarate is a complete 145-second composition. The application streams local MP3 files and applies a short crossfade at repeat boundaries, without decoding long music tracks into large PCM buffers. Engine, wind and most impact sounds use original Web Audio synthesis. Coin, jump, landing and hurt effects use the supplied Kenney New Platformer Pack samples (CC0 1.0), with synthesis available as a codec fallback. Original licenses and source hashes are in `/models/platform/provenance.json` and `platform-sfx-license.txt`.
