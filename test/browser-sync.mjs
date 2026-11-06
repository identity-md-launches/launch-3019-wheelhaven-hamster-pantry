// Real-browser check of the multi-tab save, primary interactions and layout at 390 and 1440 wide.
// Needs Playwright with Chromium, which this project does not install as a dependency:
//   IMD_PLAYWRIGHT=/path/to/playwright/index.mjs node test/browser-sync.mjs
// The Squeekchain API is replaced with a local mock so the wheel counter can be stepped.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.IMD_PLAYWRIGHT ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href : 'playwright');
const port = 4300 + Math.floor(Math.random() * 600);
const server = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env: { ...process.env, WHEELHAVEN_PORT: String(port) }, stdio: 'pipe' });
await new Promise(resolve => server.stdout.once('data', resolve));
const url = `http://127.0.0.1:${port}/`;

let work = 1000n;
const status = () => { const now = new Date().toISOString(); return { schemaVersion: 1, installationId: 'mock-installation', measurement: { freshness: 'online', provenance: 'hardware', receivedAt: now, observedAt: now, staleAfterSeconds: 120, counterEpoch: 'e1', cumulativeWorkUnits: work.toString(), rpmMilli: 900, coreStatus: 'RUNNING' } }; };
const economy = { schemaVersion: 3, status: 'available', installationId: 'mock-installation', chain: { chainId: '11155111', safeThroughBlock: '5' }, mining: { processedThroughRound: '7' } };

const browser = await chromium.launch({ executablePath: process.env.WHEELHAVEN_CHROMIUM || undefined });
const results = [];
const check = async (name, fn) => { await fn(); results.push(name); console.log(`ok - ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (process.env.WHEELHAVEN_COORDINATION === 'indexeddb') {
    await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  }
  await context.route('https://api.squeekchain.com/**', route => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(route.request().url().endsWith('/status') ? status() : economy) }));
  const errors = [];
  const open = async () => {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => document.querySelector('#wheel-dot')?.classList.contains('running'));
    return page;
  };
  const dew = page => page.locator('#dew-resource strong').textContent();
  const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('wheelhaven.v2.live')));
  const refresh = async page => { await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(300); };

  const A = await open(), B = await open();
  await check('the first screen at 390 shows the product and the food patch', async () => {
    const box = await A.locator('#plot-0').boundingBox();
    assert.ok(box && box.y + box.height <= 844, `first planting action at y=${box?.y}, height=${box?.height}`);
    assert.equal(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mkdir('test/scratch/browser', { recursive: true });
    await A.screenshot({ path: 'test/scratch/browser/390-zh.png' });
  });
  await check('planting broccoli in tab A spends 5 dew', async () => {
    await A.click('#seed-broccoli');
    await A.click('#plot-4');
    await A.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '7');
    assert.equal(await dew(A), '7');
    assert.equal((await stored(A)).dew, 7);
  });
  await check('idle tab B refreshing and closing does not revert A (advisory reproduction)', async () => {
    await refresh(B);
    await B.close({ runBeforeUnload: true });
    const C = await open();
    assert.equal(await dew(C), '7');
    assert.match(await C.locator('#plot-4').getAttribute('class'), /planted-plot/);
    await C.close({ runBeforeUnload: true });
    assert.equal((await stored(A)).dew, 7);
  });
  await check('B tab shows A\'s change through the storage event', async () => {
    const B2 = await open();
    await A.click('#seed-carrot');
    await A.click('#plot-3');
    await B2.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '5');
    await B2.close();
  });
  await check('the same wheel passages grow crops once across two refreshing tabs', async () => {
    const B3 = await open();
    work += 4n;
    await refresh(A); await refresh(B3); await refresh(A); await refresh(B3);
    const s = await stored(A);
    assert.equal(s.plots[4].plant.grown, 4);
    assert.equal(s.plots[3].plant.grown, 4);
    await B3.close({ runBeforeUnload: true });
  });
  let D;
  await check('reset in one tab propagates and a stale tab cannot restore old progress on pagehide', async () => {
    D = await open();
    await D.click('#save-button');
    await D.click('[data-action="reset-dialog"]');
    await D.click('[data-action="reset-confirm"]');
    await D.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '12');
    assert.equal(await dew(D), '12');
    await A.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '12');
    await A.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await refresh(A);
    const s = await stored(A);
    assert.equal(s.dew, 12);
    assert.equal(s.plots.filter(p => p.plant).length, 0);
  });
  await check('import in one tab propagates and reanchors', async () => {
    const save = await stored(D);
    save.dew = 33; save.harvests = 2; save.anchor = { epoch: 'mock-installation/e1', work: '1' };
    save.plots[4].plant = { type: 'carrot', grown: 1, work: 6, yield: 5, watered: false, bonus: 0, rescue: false };
    await D.click('#save-button');
    await D.setInputFiles('#import-save', { name: 'pantry.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
    await D.click('[data-action="import-confirm"]');
    await D.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '33');
    assert.equal(await dew(D), '33');
    await A.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '33');
    await refresh(A); await refresh(D);
    assert.equal((await stored(A)).plots[4].plant.grown, 1, 'old passages were not credited to the imported crop');
    work += 2n;
    await refresh(A); await refresh(D);
    assert.equal((await stored(A)).plots[4].plant.grown, 3);
  });
  for (const kind of ['import', 'reset']) {
    await check(`${kind} in a tab with an older fresh feed keeps the newer shared anchor`, async () => {
      // D keeps its old sample; only A receives the five new passages.
      work += 5n;
      await refresh(A);
      const before = await stored(A), grown = before.plots[4].plant.grown;
      await D.click('#save-button');
      if (kind === 'import') {
        await D.setInputFiles('#import-save', { name: 'pantry.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
        await D.click('[data-action="import-confirm"]');
      } else {
        await D.click('[data-action="reset-dialog"]');
        await D.click('[data-action="reset-confirm"]');
      }
      await D.waitForFunction(() => !document.querySelector('#info-dialog').open);
      assert.deepEqual((await stored(A)).anchor, before.anchor);
      if (kind === 'reset') {
        await A.click('#seed-broccoli'); await A.click('#plot-4');
        await A.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '7');
      }
      await refresh(A);
      assert.equal((await stored(A)).plots[4].plant.grown, kind === 'reset' ? 0 : grown);
    });
  }
  // Each scenario gets its own context, so its pantry starts empty, and its own controllable feed.
  for (const kind of ['import', 'reset']) {
    await check(`${kind} in a tab whose feed is down rejects its delayed response and a replay of the shared sample`, async () => {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (process.env.WHEELHAVEN_COORDINATION === 'indexeddb') {
        await isolated.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
      }
      try {
        const now = Date.now();
        const json = body => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const measured = (units, secondsAgo) => {
          const at = new Date(now - secondsAgo * 1000).toISOString();
          return json({ schemaVersion: 1, installationId: 'mock-installation', measurement: { freshness: 'online', provenance: 'hardware', receivedAt: at, observedAt: at, staleAfterSeconds: 120, counterEpoch: 'e1', cumulativeWorkUnits: String(units), rpmMilli: 900, coreStatus: 'RUNNING' } });
        };
        const S100 = measured(100, 10), S105 = measured(105, 5);
        const tab = async feed => {
          const page = await isolated.newPage(), control = { respond: route => route.fulfill(feed) };
          await page.route('https://api.squeekchain.com/**', route => route.request().url().endsWith('/status') ? control.respond(route) : route.fulfill(json(economy)));
          await page.goto(url);
          await page.waitForFunction(() => document.querySelector('#wheel-dot')?.classList.contains('running'));
          return { page, control };
        };
        const a = await tab(S100), b = await tab(S100);
        const planted = async () => {
          await a.page.click('#seed-broccoli'); await a.page.click('#plot-4');
          await a.page.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '7');
        };
        await planted();

        // B's feed goes down, then its next request stays in flight with the older sample.
        b.control.respond = route => route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' });
        await refresh(b.page);
        let held, requested;
        const pending = new Promise(resolve => { requested = resolve; });
        b.control.respond = route => { held = route; requested(); };
        await b.page.evaluate(() => window.dispatchEvent(new Event('online')));
        await pending;

        a.control.respond = route => route.fulfill(S105);
        await refresh(a.page);
        const shared = await stored(a.page);
        assert.equal(shared.anchor.work, '105');
        assert.equal(shared.plots[4].plant.grown, 5);

        await b.page.click('#save-button');
        if (kind === 'import') {
          await b.page.setInputFiles('#import-save', { name: 'pantry.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(shared)) });
          await b.page.click('[data-action="import-confirm"]');
        } else {
          await b.page.click('[data-action="reset-dialog"]');
          await b.page.click('[data-action="reset-confirm"]');
        }
        await b.page.waitForFunction(() => !document.querySelector('#info-dialog').open);
        if (kind === 'reset') await planted();
        const expected = kind === 'reset' ? 0 : 5;

        await held.fulfill(S100);
        await b.page.waitForTimeout(300);
        await refresh(a.page);
        const replayed = await stored(a.page);
        assert.equal(replayed.plots[4].plant.grown, expected, 'no new passages arrived');
        assert.equal(replayed.anchor.work, '105');
        assert.equal(replayed.dew, 7);

        // The first new passages after the baseline count exactly once across both tabs.
        const S108 = measured(108, 0);
        a.control.respond = route => route.fulfill(S108);
        b.control.respond = route => route.fulfill(S108);
        await refresh(a.page); await refresh(b.page);
        assert.equal((await stored(a.page)).plots[4].plant.grown, expected + 3);
      } finally { await isolated.close(); }
    });
  }
  await check('a real competing tab waits while the first tab is paused after mutation and before write', async () => {
    for (const page of [A, D]) {
      await page.evaluate(async () => {
        const { createPantryStore } = await import('./store.mjs');
        const { plantSeed } = await import('./game.mjs');
        window.syncTest = { store: createPantryStore(localStorage, { key: 'wheelhaven.test.overlap', legacyKey: 'wheelhaven.test.none' }), plantSeed };
      });
    }
    await A.evaluate(() => window.syncTest.store.commit(g => window.syncTest.plantSeed(g, 4, 'broccoli')));
    const debuggerSession = await context.newCDPSession(D);
    await debuggerSession.send('Debugger.enable');
    const paused = new Promise(resolve => debuggerSession.once('Debugger.paused', resolve));
    const first = D.evaluate(() => window.syncTest.store.commit(g => {
      const result = window.syncTest.plantSeed(g, 3, 'carrot');
      debugger; // intentionally suspend while the store owns the cross-tab lock
      return result;
    }));
    await paused;
    let second;
    try {
      second = A.evaluate(async () => {
        window.syncTest.requested = true;
        const result = await window.syncTest.store.commit(g => window.syncTest.plantSeed(g, 1, 'carrot'));
        window.syncTest.finished = true;
        return result;
      });
      await A.waitForFunction(() => window.syncTest.requested);
      if (process.env.WHEELHAVEN_COORDINATION !== 'indexeddb') {
        const locks = await A.evaluate(() => navigator.locks.query());
        assert.ok(locks.held.some(l => l.name === 'wheelhaven:pantry:wheelhaven.test.overlap'));
        assert.ok(locks.pending.some(l => l.name === 'wheelhaven:pantry:wheelhaven.test.overlap'));
      }
      assert.equal(await A.evaluate(() => !!window.syncTest.finished), false);
    } finally {
      await debuggerSession.send('Debugger.resume');
      await debuggerSession.detach();
    }
    await Promise.all([first, second]);
    const s = await A.evaluate(() => JSON.parse(localStorage.getItem('wheelhaven.test.overlap')));
    assert.equal(s.dew, 3);
    assert.deepEqual(s.plots.map((p, i) => p.plant ? i : null).filter(i => i !== null), [1, 3, 4]);
    await A.evaluate(() => localStorage.removeItem('wheelhaven.test.overlap'));
  });
  for (const kind of ['reset', 'import']) {
    await check(`two failed writes followed by ${kind} cannot be retried over it on pagehide`, async () => {
      const failed = await A.evaluate(async () => {
        const { createGarden } = await import('./game.mjs');
        const { store, plantSeed } = window.syncTest;
        await store.replace(createGarden('live'));
        await store.commit(g => plantSeed(g, 4, 'broccoli'));
        const realSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === 'wheelhaven.test.overlap') throw new DOMException('Test quota failure', 'QuotaExceededError');
          return realSet.call(this, key, value);
        };
        try {
          return [await store.commit(g => plantSeed(g, 3, 'carrot')), await store.commit(g => plantSeed(g, 1, 'carrot'))].map(r => r.saved);
        } finally { Storage.prototype.setItem = realSet; }
      });
      assert.deepEqual(failed, [false, false]);
      await D.evaluate(async kind => {
        const { createGarden } = await import('./game.mjs');
        const next = createGarden('live');
        if (kind === 'import') { next.dew = 33; window.syncTest.plantSeed(next, 0, 'carrot'); }
        await window.syncTest.store.replace(next);
      }, kind);
      const replacement = await D.evaluate(() => localStorage.getItem('wheelhaven.test.overlap'));
      await A.evaluate(async () => {
        // Same event path as the application, with a barrier so the asynchronous retry has finished.
        window.addEventListener('pagehide', () => { window.syncTest.retry = window.syncTest.store.flush(); }, { once: true });
        dispatchEvent(new PageTransitionEvent('pagehide'));
        await window.syncTest.retry;
      });
      assert.equal(await A.evaluate(() => localStorage.getItem('wheelhaven.test.overlap')), replacement);
    });
  }
  await check('language switch, help and evidence dialogs work', async () => {
    await A.click('#language-button');
    assert.equal(await A.evaluate(() => document.documentElement.lang), 'en');
    await A.screenshot({ path: 'test/scratch/browser/390-en.png' });
    await A.click('#help-button');
    assert.equal(await A.locator('#info-dialog').evaluate(d => d.open), true);
    await A.keyboard.press('Escape');
    await A.click('#footer-evidence-button');   // the header link is hidden at 390 wide
    assert.match(await A.locator('#info-dialog').textContent(), /mock-installation/);
    await A.keyboard.press('Escape');
    await A.click('#language-button');
  });
  await check('keyboard planting and a native help dialog preserve focus', async () => {
    await A.locator('#seed-carrot').focus(); await A.keyboard.press('Space');
    await A.locator('#plot-0').focus(); await A.keyboard.press('Enter');
    await A.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '5');
    assert.equal(await A.evaluate(() => document.activeElement.id), 'plot-0');
    await A.screenshot({ path: 'test/scratch/browser/390-keyboard-focus.png' });
    await A.locator('#help-button').focus(); await A.keyboard.press('Enter');
    assert.equal(await A.locator('#info-dialog').evaluate(d => d.open), true);
    await A.keyboard.press('Escape');
    assert.equal(await A.evaluate(() => document.activeElement.id), 'help-button');
  });
  await check('pantry export and complete source downloads return the current files', async () => {
    await A.click('#save-button');
    const [save] = await Promise.all([A.waitForEvent('download'), A.click('[data-action="export"]')]);
    const exported = JSON.parse(await readFile(await save.path(), 'utf8'));
    assert.equal(exported.dew, (await stored(A)).dew);
    assert.equal(exported.plots[4].plant.type, 'broccoli');
    await A.keyboard.press('Escape');
    await A.click('#about-button');
    const [source] = await Promise.all([A.waitForEvent('download'), A.click('#info-dialog a[download]')]);
    assert.equal(source.suggestedFilename(), 'wheelhaven-source.zip');
    assert.deepEqual(await readFile(await source.path()), await readFile(new URL('../dist/wheelhaven-source.zip', import.meta.url)));
    await A.keyboard.press('Escape');
  });
  await check('reduced motion stops the running wheel animation', async () => {
    await A.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await A.evaluate(() => document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)), false);
    await A.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await check('no horizontal overflow at 320 and 1440 wide', async () => {
    for (const width of [320, 1440]) {
      await A.setViewportSize({ width, height: 900 });
      assert.equal(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      await A.screenshot({ path: `test/scratch/browser/${width}-zh.png` });
    }
  });
  await check('no script or console errors', async () => assert.deepEqual(errors, []));
  console.log(`\n${results.length} browser checks passed`);
} finally {
  await browser.close();
  server.kill();
}
