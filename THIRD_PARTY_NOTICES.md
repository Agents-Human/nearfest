# Third-party notices

The root [NearFest Evaluation Licence](LICENSE) applies only to original protectable NearFest material owned by KesaLabs Ghana Limited. It does not replace the licences below, acquire ownership of third-party material, or restrict permissions its authors already granted. Original notices remain applicable even when files are modified, bundled or archived.

## Frontend baseline and dependencies

The supplied React/Vite/Tezos vending-machine frontend is preserved in `legacy/tezos/` as inherited source. This archive is not newly authored NearFest code and is not relicensed by the root licence. Retain any applicable upstream terms; the archive is not a grant of additional rights.

Dependencies listed in `package.json` and `package-lock.json`, including React, Vite, Three.js, Matter.js, GSAP and NEAR packages, remain governed by their respective package licences. The full `chess.js` BSD-2-Clause notice is preserved in `docs/chess-rules-library-LICENSE.txt`.

## Artwork, models, audio and supplied media

- Kenney packs retain their CC0 terms. Selected simulation assets and their six source-pack notices are listed in `public/models/simulation/manifest.json` and `public/models/simulation/licenses/`; other packs retain notices beside their runtime models.
- CraftPix artwork retains the applicable [CraftPix licence](https://craftpix.net/file-licenses/), including its restrictions on redistributing art as reusable source assets. Fighter and background provenance is in `public/models/fighters/`; Cat Defense provenance is in `public/models/cats/`. These assets are not offered under the NearFest licence or MIT.
- StudyJunior media retains its existing rights and access terms. Source records are in `assets/source/studyjunior/provenance.json` and `assets/source/studyjunior/choices/provenance.json`. Access through the asset service is not a grant by NearFest to redistribute that library independently.
- “Lobby Time” by Kevin MacLeod is used under CC BY 4.0; retain `public/audio/CREDITS.md` and the associated attribution. Fonts retain their own notices.
- Original project illustrations and AI-assisted artwork have provenance in `public/art/`. Those records distinguish generated references, redraws and sourced assets; they do not override any third-party rights.

## 2048

Original author: Gabriele Cirulli (2014) and upstream contributors.
Repository: https://github.com/gabrielecirulli/2048
Pinned commit: `478b6ec346e3787f589e4af751378d06ded4cbbc`.
Licence: MIT; the full notice is preserved in `src/vendor/2048/LICENSE.txt` and served at `public/licenses/2048.txt`.
Imported files: `js/game_manager.js`, `js/grid.js`, `js/tile.js`.
Changes: ES module imports/exports and licence headers. The engine runs through a local React renderer, input adapter and best-score storage adapter. Upstream analytics, advertisements, donations and network scripts are not imported.
In-app credit appears below the 2048 controls.

Memory, Lights Out, Sliding Puzzle and Codebreaker use original local implementations of familiar game rules. No external collection code or unlicensed artwork was imported for them.

## Imported browser library

The per-title source, author, snapshot, licence URL and launch-file SHA-256 are recorded in `server/library-catalog.json`. Full game licence notices (including any fetched Apache NOTICE) are shipped in `public/library/credits`; the in-game Controls & credits panel links directly to them. No blanket licence is assumed for the js13k archive: only entries with an independently retrieved permissive notice are imported.

| Collection | Author | Licence / notices |
| --- | --- | --- |
| Individually licensed js13k games | Original named creators | Per-title MIT, Apache-2.0, ISC, BSD, Unlicense, CC0, WTFPL or Zlib notice |
| crisp-game-lib-games, crisp-game-lib-11-games, crisp-game-lib-12-games, claude-one-button-game-creation, agentic-gamedev-games | ABA Games | MIT; collection notices in credits |
| Chogan | Chogan contributors | MIT; bundled fonts retain OFL notices in `library/chogan/fonts` |
| LittleJS Arcade | Frank Force | MIT; Twemoji CC-BY-4.0 notice in `library/littlejs/games/TWEMOJI-LICENSE.txt` |
| 100games | Srikanth-AD | MIT; full notice in credits |

Bundled browser dependencies retain package licence files under `public/library/deps`: crisp-game-lib, sounds-some-sounds, gif-capture-canvas, PixiJS, pixi-filters, lodash.clonedeep and algo-chip. LittleJS retains its MIT engine notice and the Box2D/box2d.js zlib notice in `library/littlejs/dist`.

Integration changes: an isolation/storage adapter is inserted before game scripts; optional remote font links are removed; crisp engines get individual launch pages and local script/audio-worklet paths; animated screenshots become static thumbnails. Source game rules are retained. Generic SVG covers are original slotVend code. Upstream source and author credits remain linked; these games are not represented as original slotVend creations.

### Cat Defense and Pocket Soccer

Cat Defense artwork is from the user-supplied **CraftPix Free Cartoon Cat Defense Game Asset Kit**, used under its Freebie license. Selected original frames are cropped and packed into lossless WebP atlases; the original source files are unchanged. License, source/output hashes and atlas metadata are in `public/models/cats/`.

Pocket Soccer characters, equipment and ball artwork are original vector groups extracted from the supplied **Kenney Sports Pack**, licensed CC0. Exact group IDs and hashes are recorded in `public/models/soccer/provenance.json`; the CC0 license is included there. Articulated motion and the stadium are original code.

Bridge Builders’ hold/release gameplay was referenced from <https://github.com/manumishra12/Stick_Man> by Manu Mishra. No repository code or artwork was copied. The multiplayer simulation, scenery, models and UI were implemented for this project.

### Tappy Plane

Tappy Plane 1.1 artwork by Kenney (CC0-1.0), supplied in `assets/new/kenney_tappy-plane`. Selected PNG sprites and the supplied sample cover are copied unchanged. The complete source licence and SHA-256 provenance are in `public/games/tappy-plane/License.txt` and `provenance.json`. Flight rules, multiplayer integration and browser rendering are original implementation work; the artwork remains credited to Kenney.
