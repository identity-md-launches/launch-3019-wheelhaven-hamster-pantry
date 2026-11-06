// Real-browser check of the multi-tab save, primary interactions and layout at 390 and 1440 wide.
// Needs Playwright with Chromium, which this project does not install as a dependency:
//   IMD_PLAYWRIGHT=/path/to/playwright/index.mjs node test/browser-sync.mjs
// The Squeekchain API is replaced with a local mock so the wheel counter can be stepped.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.IMD_PLAYWRIGHT ? pathToFileURL(process.env.IMD_PLAYWRIGHT).href : 'playwright');
const port = 4300 + Math.floor(Math.random() * 600);
const server = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { env: { ...process.env, WHEELHAVEN_PORT: String(port) }, stdio: 'pipe' });
await new Promise(resolve => server.stdout.once('data', resolve));
const url = `http://127.0.0.1:${port}/`;

let work = 1000n;
const status = () => { const now = new Date().toISOString(); return { schemaVersion: 1, installationId: 'mock-installation', measurement: { freshness: 'online', provenance: 'hardware', receivedAt: now, observedAt: now, staleAfterSeconds: 120, counterEpoch: 'e1', cumulativeWorkUnits: work.toString(), rpmMilli: 900, coreStatus: 'RUNNING' } }; };
const economy = { schemaVersion: 3, status: 'available', installationId: 'mock-installation', chain: { chainId: '11155111', safeThroughBlock: '5' }, mining: { processedThroughRound: '7' } };

const browser = await chromium.launch();
const results = [];
const check = async (name, fn) => { await fn(); results.push(name); console.log(`ok - ${name}`); };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
    const box = await A.locator('#plots').boundingBox();
    assert.ok(box && box.y < 844 * 1.6, `plots at y=${box?.y}`);
    assert.equal(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await check('planting broccoli in tab A spends 5 dew', async () => {
    await A.click('#seed-broccoli');
    await A.click('#plot-4');
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
    assert.equal(await dew(D), '33');
    await A.waitForFunction(() => document.querySelector('#dew-resource strong').textContent === '33');
    await refresh(A); await refresh(D);
    assert.equal((await stored(A)).plots[4].plant.grown, 1, 'old passages were not credited to the imported crop');
    work += 2n;
    await refresh(A); await refresh(D);
    assert.equal((await stored(A)).plots[4].plant.grown, 3);
  });
  await check('language switch, help and evidence dialogs work', async () => {
    await A.click('#language-button');
    assert.equal(await A.evaluate(() => document.documentElement.lang), 'en');
    await A.click('#help-button');
    assert.equal(await A.locator('#info-dialog').evaluate(d => d.open), true);
    await A.keyboard.press('Escape');
    await A.click('#footer-evidence-button');   // the header link is hidden at 390 wide
    assert.match(await A.locator('#info-dialog').textContent(), /mock-installation/);
    await A.keyboard.press('Escape');
    await A.click('#language-button');
  });
  await check('no horizontal overflow at 320 and 1440 wide', async () => {
    for (const width of [320, 1440]) {
      await A.setViewportSize({ width, height: 900 });
      assert.equal(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
    }
  });
  await check('no script or console errors', async () => assert.deepEqual(errors, []));
  console.log(`\n${results.length} browser checks passed`);
} finally {
  await browser.close();
  server.kill();
}
