# Wheelhaven · 仓鼠粮仓

An original crop strategy game for the Squeekchain ecosystem. A real hamster's accepted wheel passages grow carrots, broccoli and sunflower seeds for a hamster-themed pantry. Players choose crops, manage dew, water plants, expand plots, restore the watermill and seed library, and light a beacon to complete the game.

## Run

Node.js 18 or later. The game has no runtime dependencies: no installation or bundler is needed to preview it. Keep the existing package manifest unchanged.

```sh
npm start
```

Open the printed `http://127.0.0.1:4317/` URL. Production hosting can serve `dist/` on any static host, including a gateway subpath. The export uses relative module, stylesheet, favicon and source-download URLs.

To rebuild the production delivery, use Node.js and Python 3 (standard library only):

```sh
node scripts/build.mjs
python3 scripts/source-archive.py --check
```

`dist/` is both the native JavaScript source and the production export. The build checks module syntax, local imports, relative assets and share metadata, then regenerates `dist/wheelhaven-source.zip` deterministically. Every archived file is compared byte for byte with the final tree. The download includes the storage module, engine and synchronization tests, browser checks, build scripts, design documentation, validation record, original artwork and share image. It excludes itself, private task inputs and dependency/cache directories.

## Play

1. Choose Carrot or Broccoli, then tap an empty plot.
2. All plants advance only when fresh accepted sensor passages increase. There is one planting experience, driven by the real hamster. Crops pause while the hamster rests.
3. Water once to reduce a crop's passage requirement by 30%.
4. Harvest crops for dew. Restore the watermill for +1 yield, the seed library for sunflower seeds, and the beacon to finish.
5. Expand plots to grow more crops at once. If dew runs out and all food patches are empty, an emergency seed prevents a permanent soft lock.

English and Chinese are available. Local browser saves can be exported and imported. Existing real-wheel saves remain compatible; the UI does not load or import old practice saves. This is a local, noncompetitive game: saves are portable, editable files, not authenticated on-chain achievements.

## Tabs and saves

All tabs on the same origin share `wheelhaven.v2.live`. Gameplay, feed changes, reset/import and failed-write retries serialize the **complete** read/validate/mutate/write operation using Web Locks. Browsers without Web Locks use an exclusive IndexedDB transaction instead. The current pantry is read again after acquiring the lock. A revision increases only after a successful `localStorage.setItem`; failed changes retain their exact persisted base and are discarded if another tab replaces it. An idle `pagehide` writes nothing; a pending retry also acquires the lock and compares its base before writing. Unload retries are best effort: normal actions save immediately rather than relying on page close.

Reset/import select their baseline inside the same lock. A tab's older fresh feed cannot rewind a newer shared anchor, including a newer device epoch. Imported anchors are ignored. If there is no fresh sample, the replacement stores no anchor but keeps the newest shared sample as a replay floor: a delayed response older than that floor is rejected, and the next eligible response only reanchors and awards no historical growth. Storage events, focus and visibility changes update idle tabs; actions recheck even when those events have not arrived. If neither coordination mechanism is available, changes fail safely with the existing bilingual storage warning instead of writing without a lock. Coordination applies to this updated application; unrelated code manually changing the same storage key cannot be forced to honor its lock.

## Squeekchain integration

- `https://api.squeekchain.com/v1/status`: `measurement.cumulativeWorkUnits`, `counterEpoch`, hardware provenance, observed/received timestamps, freshness and wheel RPM.
- `https://api.squeekchain.com/v1/economy/state`: schema 3, matching installation and Sepolia chain ID; `mining.processedThroughRound` rotates an in-game crop bonus. The active future round is not presented as settled history.
- Refreshes every 15 seconds with request deadlines. Disconnected, stale, future-dated and invalid samples do not add growth. Counter resets and installation changes reanchor without granting a jump. Out-of-order samples, including a delayed response from a previous device epoch, do not rewind the counter.
- All counter arithmetic uses bigint before a bounded per-plant conversion. No contract addresses are hard-coded.
- Growth represents accepted sensor activity, not settled on-chain rewards. The evidence panel exposes that distinction and links the official sources.
- No wallet connection, signatures, purchases, bets or tokens. All dew and harvests are in-game objects.

## Check

```sh
npm test
node scripts/typecheck.mjs /path/to/typescript/lib/tsc.js
IMD_PLAYWRIGHT=/path/to/playwright/index.mjs node test/browser-sync.mjs
WHEELHAVEN_COORDINATION=indexeddb IMD_PLAYWRIGHT=/path/to/playwright/index.mjs node test/browser-sync.mjs
node test/check-live.mjs
```

Optional development checks use TypeScript 5.9.3 and Playwright 1.61.1, installed outside the project (for example `npm install --prefix /tmp/wheelhaven-checks typescript@5.9.3 playwright@1.61.1`). Install the corresponding Chromium browser with that external Playwright CLI. `WHEELHAVEN_CHROMIUM=/path/to/browser` can select an existing executable. No tools or dependencies are needed by visitors; no dependency directory belongs in the submission. The typecheck checks all production JavaScript modules with `allowJs`, `checkJs` and `noEmit`.

The 15 original engine tests cover a complete game win using an isolated simulation helper, resource constraints, stale/replayed samples, epoch changes, watering and save validation. The simulation helper is not exposed by the application. The synchronization tests force a competing action between another tab's read and write, queue overlapping feed updates, exercise repeated failed saves followed by reset/import and pagehide, and test differing feed ages and device epochs, including reset/import with an unavailable or expired local feed followed by a delayed older response and a replay of the shared sample. Browser coverage pauses a real tab inside its mutation and verifies that another tab waits, then retains all three crops and 3 dew. It holds a real feed response in flight across reset and import through the Save dialog. It also exercises planting, language switching, dialogs, keyboard focus, downloads and responsive layouts. The live check calls the official endpoints and therefore needs network access and a healthy fresh feed.

Validation on 2026-11-06: all 60 Node tests passed (15 engine + 45 synchronization), all production modules typechecked, both browser coordination paths passed 20/20 checks each, the design probe passed 16/16 checks, and the live API check passed. See [the validation record](VALIDATION.md) for exact commands, final browser counts, design coverage and limitations. The Chinese/English design, original SVG art, single real-wheel planting experience, MIT license and FLau1212 attribution are preserved.

## Files

- `dist/game.mjs`: pure crop rules and telemetry validation.
- `dist/app.mjs`: UI, bilingual copy, live feed and local saves.
- `dist/store.mjs`: cross-tab serialized saves, replacement anchoring and failed-write handling.
- `dist/art.mjs`: original vector crop, hamster wheel and building artwork.
- `dist/styles.css`, `dist/index.html`: responsive, keyboard-accessible game.
- `test/`: meaningful engine and integration checks.
- `server.mjs`: local-only static preview server.
- `scripts/`: production/archive build and JavaScript typecheck.

## Submission status

The working project can be prepared for Genesis direct submission. A team-approved badge is not guaranteed. The owner still needs an eligible custom domain, a publicly reviewable source repository, the exact DNS/page verification challenge from Genesis, and team approval. Do not substitute a shared hosting hostname or a fabricated ownership token.

Created by FLau1212 with development assistance from Codex. Independent of Squeekchain. The hamster imagery and game artwork here are original SVG illustrations, not copies of Squeekchain NFT art.

## License

MIT. See `LICENSE`.
