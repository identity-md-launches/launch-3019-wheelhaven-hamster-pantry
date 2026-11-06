// Multi-tab regression tests for the shared pantry save (dist/store.mjs).
// Each "tab" is its own store over one shared storage area, the way browser tabs share localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden, plantSeed, harvest, parseTelemetry, applyTelemetry, restoreGarden } from '../dist/game.mjs';
import { createPantryStore, LIVE_KEY, LEGACY_KEY } from '../dist/store.mjs';

const NOW = Date.now();
function sample(work, seconds = 0, epoch = 'wheel-a') {
  const date = new Date(NOW + seconds * 1000).toISOString();
  return parseTelemetry(
    { schemaVersion: 1, installationId: 'sepolia-installation', measurement: { freshness: 'online', provenance: 'hardware', receivedAt: date, observedAt: date, staleAfterSeconds: 120, counterEpoch: epoch, cumulativeWorkUnits: String(work), rpmMilli: 500, coreStatus: 'RUNNING' } },
    { schemaVersion: 3, status: 'available', installationId: 'sepolia-installation', chain: { chainId: '11155111', safeThroughBlock: '1000' }, mining: { processedThroughRound: '19' } },
    NOW + seconds * 1000,
  );
}

// A shared storage area with browser-like storage events delivered to every other tab.
function browser() {
  const data = new Map(), tabs = new Set();
  // One origin-wide FIFO lock manager, with asynchronous grants like navigator.locks.
  let tail = Promise.resolve();
  const locks = { request(_name, _options, operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  } };
  const area = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem(key, value) { data.set(key, String(value)); for (const tab of tabs) if (tab.area !== this) tab.events.push({ key }); },
    removeItem(key) { data.delete(key); },
  };
  return {
    data,
    open() {
      const tab = { events: [] };
      tab.area = { getItem: area.getItem, setItem(k, v) { area.setItem.call(tab.area, k, v); } };
      tab.store = createPantryStore(tab.area, { locks });
      tabs.add(tab);
      // The feed refresh in app.mjs: apply a sample to the newest pantry, writing only real changes.
      tab.refresh = s => { let round; return tab.store.commit(g => { round = g.round; return applyTelemetry(g, s); }, (r,g) => r.reanchored || r.delta !== '0' || round !== g.round); };
      tab.deliver = () => { let changed = false; for (const e of tab.events.splice(0)) changed = tab.store.handleStorageEvent(e).changed || changed; return changed; };
      tab.close = async () => { await tab.store.flush(); tabs.delete(tab); };
      return tab;
    },
    stored: () => JSON.parse(data.get(LIVE_KEY)),
  };
}
const occupied = g => g.plots.map((p, i) => p.plant ? `${i}:${p.plant.type}:${p.plant.grown}` : null).filter(Boolean);

test('advisory reproduction: an idle tab that refreshes and closes cannot revert another tab\'s planting', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  assert.equal(A.store.current().dew, 12);
  assert.equal((await A.store.commit(g => plantSeed(g, 4, 'broccoli'))).saved, true);
  assert.equal(A.store.current().dew, 7);

  // B never delivered A's storage event (worst case) and still holds 12 dew in memory.
  assert.equal(B.store.current().dew, 12);
  await B.refresh(sample(100));
  await B.refresh(sample(100, 15));
  await B.close();

  const C = b.open();
  assert.equal(C.store.current().dew, 7);
  assert.deepEqual(occupied(C.store.current()), ['4:broccoli:0']);
  assert.equal(b.stored().dew, 7);
});

test('pagehide from an idle tab writes nothing, even after other tabs write', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'carrot'));
  const before = b.data.get(LIVE_KEY);
  assert.equal(await B.store.flush(), false);
  assert.equal(b.data.get(LIVE_KEY), before);
});

test('a stale tab adopts the current pantry before its own gameplay action', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  const { result, adopted } = await B.store.commit(g => plantSeed(g, 3, 'carrot'));
  assert.equal(result.ok, true);
  assert.equal(adopted, true);
  assert.equal(B.store.current().dew, 5);
  assert.deepEqual(occupied(b.open().store.current()), ['3:carrot:0', '4:broccoli:0']);
  // The same plot cannot be bought twice from two tabs.
  assert.equal((await A.store.commit(g => plantSeed(g, 3, 'broccoli'))).result.reason, 'plotUnavailable');
  assert.equal(A.store.current().dew, 5);
});

test('storage events update other tabs immediately', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  assert.equal(B.deliver(), true);
  assert.equal(B.store.current().dew, 7);
  assert.equal(B.store.revision(), A.store.revision());
  // An unrelated key (language preference) does not trigger adoption work.
  assert.deepEqual(B.store.handleStorageEvent({ key: 'wheelhaven.language' }), { changed: false });
});

test('two tabs refreshing the feed never grow crops twice from the same wheel passages', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.refresh(sample(100));
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  await B.refresh(sample(100, 1));            // B adopts A's anchor; nothing new
  await A.refresh(sample(105, 15));
  assert.equal(A.store.current().plots[4].plant.grown, 5);
  await B.refresh(sample(105, 15));           // same sample in the stale tab
  await B.refresh(sample(105, 16));           // and a later sample with the same counter
  assert.equal(B.store.current().plots[4].plant.grown, 5);
  await B.refresh(sample(103, 10));           // an older, out-of-order sample
  assert.equal(B.store.current().plots[4].plant.grown, 5);
  await B.refresh(sample(108, 30));           // only the 3 new passages count
  assert.equal(B.store.current().plots[4].plant.grown, 8);
  await B.close(); await A.close();
  assert.equal(b.open().store.current().plots[4].plant.grown, 8);
});

test('a feed refresh with no new passages does not write or wake other tabs', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.refresh(sample(100));
  B.deliver();
  const revision = A.store.revision();
  assert.equal((await A.refresh(sample(100, 15))).saved, null);
  assert.equal(A.store.revision(), revision);
  assert.equal(B.events.length, 0);
});

test('reset propagates: stale tabs cannot resurrect the old pantry by refreshing, acting or closing', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.refresh(sample(100));
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.store.sync();
  assert.equal(B.store.current().dew, 7);

  const fresh = createGarden('live'); applyTelemetry(fresh, sample(110, 20));
  assert.equal(await A.store.replace(fresh, sample(110, 20)), true);

  await B.refresh(sample(110, 20));
  assert.equal(B.store.current().dew, 12);
  assert.deepEqual(occupied(B.store.current()), []);
  await B.close();
  const C = b.open();
  assert.equal(C.store.current().dew, 12);
  assert.deepEqual(occupied(C.store.current()), []);
  // The reset pantry is anchored at the current counter: old passages are not credited later.
  await C.store.commit(g => plantSeed(g, 4, 'carrot'));
  await C.refresh(sample(112, 30));
  assert.equal(C.store.current().plots[4].plant.grown, 2);
});

test('import propagates to other tabs and reanchors so imported crops are not credited twice', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.refresh(sample(100));

  const save = createGarden('live'); plantSeed(save, 4, 'broccoli'); save.dew = 40; save.harvests = 3;
  save.anchor = { epoch: 'sepolia-installation/wheel-a', work: '1' };   // an old anchor from another browser
  const imported = restoreGarden(JSON.parse(JSON.stringify(save)), 'live');
  imported.anchor = null;
  applyTelemetry(imported, sample(100, 5));
  assert.equal(imported.plots[4].plant.grown, 0);
  await A.store.replace(imported, sample(100, 5));

  await B.refresh(sample(100, 5));   // B used to hold the pre-import pantry
  assert.equal(B.store.current().dew, 40);
  assert.equal(B.store.current().plots[4].plant.grown, 0);
  await B.refresh(sample(104, 20));
  await A.refresh(sample(104, 20));
  assert.equal(A.store.current().plots[4].plant.grown, 4);
  await B.close();
  const C = b.open();
  assert.equal(C.store.current().dew, 40);
  assert.equal(C.store.current().harvests, 3);
  assert.equal(C.store.current().plots[4].plant.grown, 4);
});

test('a reset written while another tab had an unsaved change is not overwritten on pagehide', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  // B's write fails once (quota), leaving an unsaved change.
  const realSet = B.area.setItem;
  B.area.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal((await B.store.commit(g => plantSeed(g, 4, 'broccoli'))).saved, false);
  assert.equal(B.store.hasUnsavedChanges(), true);
  B.area.setItem = realSet;
  // Meanwhile A resets, storing a newer revision.
  await A.store.replace(createGarden('live'));
  assert.equal(await B.store.flush(), false);
  assert.equal(b.stored().dew, 12);
  assert.equal(B.store.current().dew, 12);
});

test('pagehide retries a failed write when nothing newer is stored', async () => {
  const b = browser();
  const B = b.open();
  const realSet = B.area.setItem;
  B.area.setItem = () => { throw new Error('QuotaExceededError'); };
  await B.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.area.setItem = realSet;
  assert.equal(await B.store.flush(), true);
  assert.equal(b.stored().dew, 7);
  assert.equal(B.store.hasUnsavedChanges(), false);
});

test('invalid, tampered or older stored values are never adopted', async () => {
  const b = browser();
  const A = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  const revision = A.store.revision();
  for (const raw of ['{not json', JSON.stringify({ version: 2, mode: 'live', dew: -5, rev: revision + 9 }), JSON.stringify({ ...createGarden('practice'), rev: revision + 9 })]) {
    b.data.set(LIVE_KEY, raw);
    assert.equal(A.store.sync().changed, false);
    assert.equal(A.store.current().dew, 7);
  }
  // A valid pantry from an older revision (an old tab without revisions) does not replace newer play.
  b.data.set(LIVE_KEY, JSON.stringify(createGarden('live')));
  assert.equal(A.store.sync().changed, false);
  // The next action restores the newest pantry to storage with a higher revision.
  await A.store.commit(g => plantSeed(g, 3, 'carrot'));
  assert.equal(b.stored().dew, 5);
  assert.ok(b.stored().rev > revision);
});

test('existing saves without revisions and v1 saves still load', async () => {
  const b = browser();
  const old = createGarden('live'); plantSeed(old, 4, 'carrot'); old.anchor = { epoch: 'sepolia-installation/wheel-a', work: '100', receivedAt: new Date(NOW).toISOString() };
  b.data.set(LIVE_KEY, JSON.stringify(old));
  const A = b.open();
  assert.equal(A.store.current().dew, 10);
  assert.equal(A.store.revision(), 0);
  await A.refresh(sample(103, 15));
  assert.equal(A.store.current().plots[4].plant.grown, 3);
  assert.equal(b.stored().rev, 1);

  const v1 = browser();
  const legacy = { ...createGarden('live'), version: 1, dew: 9 };
  v1.data.set(LEGACY_KEY, JSON.stringify(legacy));
  assert.equal(v1.open().store.current().dew, 9);
});

test('a harvest in one tab cannot be collected again from a stale tab', async () => {
  const b = browser();
  const A = b.open(), B = b.open();
  await A.refresh(sample(100));
  await A.store.commit(g => plantSeed(g, 4, 'carrot'));
  await A.refresh(sample(106, 15));
  B.store.sync();
  assert.equal((await A.store.commit(g => harvest(g, 4))).result.ok, true);
  const dew = A.store.current().dew;
  assert.equal((await B.store.commit(g => harvest(g, 4))).result.reason, 'notReady');
  assert.equal(b.open().store.current().dew, dew);
});

test('a competing commit attempted after read and mutation waits until the pending write finishes', async () => {
  const b = browser(), A = b.open(), B = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.store.sync();
  let competing, entered = false;
  await B.store.commit(g => {
    const result = plantSeed(g, 3, 'carrot');
    // Exact reviewer interleaving: A attempts an action after B read rev=1 and before B writes.
    competing = A.store.commit(s => { entered = true; return plantSeed(s, 1, 'carrot'); });
    assert.equal(entered, false, 'A must not enter the critical section while B holds the lock');
    assert.equal(b.stored().rev, 1);
    return result;
  });
  assert.equal((await competing).saved, true);
  assert.equal(b.stored().rev, 3);
  assert.equal(b.stored().dew, 3);
  assert.deepEqual(occupied(b.stored()), ['1:carrot:0', '3:carrot:0', '4:broccoli:0']);
});

test('simultaneously queued feed updates and purchases use the state read inside their lock', async () => {
  const b = browser(), A = b.open(), B = b.open();
  await A.refresh(sample(100));
  await Promise.all([A.store.commit(g => plantSeed(g, 4, 'broccoli')), B.store.commit(g => plantSeed(g, 3, 'carrot'))]);
  await Promise.all([A.refresh(sample(104, 5)), B.refresh(sample(104, 5))]);
  assert.equal(b.stored().dew, 5);
  assert.equal(b.stored().plots[4].plant.grown, 4);
  assert.equal(b.stored().plots[3].plant.grown, 4);
  const samePlot = await Promise.all([A.store.commit(g => plantSeed(g, 1, 'carrot')), B.store.commit(g => plantSeed(g, 1, 'carrot'))]);
  assert.equal(samePlot.filter(r => r.result.ok).length, 1);
  assert.equal(b.stored().dew, 3);
});

for (const kind of ['reset', 'import']) {
  for (const syncFirst of [false, true]) {
    test(`two failed writes cannot override a successful ${kind} on pagehide (sync=${syncFirst})`, async () => {
      const b = browser(), A = b.open(), B = b.open();
      await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
      B.store.sync();
      const realSet = B.area.setItem;
      B.area.setItem = () => { throw new Error('QuotaExceededError'); };
      assert.equal((await B.store.commit(g => plantSeed(g, 3, 'carrot'))).saved, false);
      assert.equal((await B.store.commit(g => plantSeed(g, 1, 'carrot'))).saved, false);
      assert.equal(B.store.current().dew, 3);
      assert.equal(B.store.revision(), 1, 'failed saves must not invent persisted revisions');
      B.area.setItem = realSet;
      const next = createGarden('live');
      if (kind === 'import') { next.dew = 33; plantSeed(next, 0, 'carrot'); }
      await A.store.replace(next);
      const replacement = b.data.get(LIVE_KEY);
      assert.equal(b.stored().rev, 2);
      if (syncFirst) assert.equal(B.store.sync().changed, true);
      assert.equal(await B.store.flush(), false);
      assert.equal(b.data.get(LIVE_KEY), replacement);
      assert.equal(B.store.current().dew, next.dew);
      assert.equal(B.store.hasUnsavedChanges(), false);
    });
  }

  test(`${kind} from a tab with older but fresh telemetry cannot rewind the shared anchor`, async () => {
    const b = browser(), A = b.open(), B = b.open();
    const old = sample(100), latest = sample(105, 5);
    await A.refresh(old); await B.refresh(old);
    await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    await A.refresh(latest);
    const next = kind === 'reset' ? createGarden('live') : restoreGarden(b.stored(), 'live');
    // An import's own anchor must also be ignored, even if it claims a much higher work count.
    next.anchor = { epoch: latest.epoch, work: '999999', receivedAt: latest.receivedAt };
    assert.equal(await B.store.replace(next, old), true);
    assert.equal(b.stored().anchor.work, '105');
    assert.equal(b.stored().anchor.receivedAt, latest.receivedAt);
    if (kind === 'reset') await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    await A.refresh(latest); await B.refresh(latest);
    assert.equal(b.stored().plots[4].plant.grown, kind === 'reset' ? 0 : 5);
    await Promise.all([A.refresh(sample(107, 10)), B.refresh(sample(107, 10))]);
    assert.equal(b.stored().plots[4].plant.grown, kind === 'reset' ? 2 : 7);
  });

  test(`${kind} keeps the latest shared epoch when the local sample is from an older device`, async () => {
    const b = browser(), A = b.open(), B = b.open();
    await A.refresh(sample(100));
    await A.refresh(sample(5, 5, 'wheel-b'));
    await B.store.replace(createGarden('live'), sample(100));
    assert.equal(b.stored().anchor.epoch, 'sepolia-installation/wheel-b');
    assert.equal(b.stored().anchor.work, '5');
  });

  test(`${kind} reads the anchor after waiting for a competing feed commit`, async () => {
    const b = browser(), A = b.open(), B = b.open();
    await A.refresh(sample(100));
    await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    const next = kind === 'reset' ? createGarden('live') : restoreGarden(b.stored(), 'live');
    // Both calls are pending together. The replacement must not choose its anchor before the lock.
    await Promise.all([A.refresh(sample(105, 5)), B.store.replace(next, sample(100))]);
    assert.equal(b.stored().anchor.work, '105');
    if (kind === 'reset') await B.store.commit(g => plantSeed(g, 4, 'broccoli'));
    await B.refresh(sample(105, 5));
    assert.equal(b.stored().plots[4].plant.grown, 0);
  });

  test(`${kind} with no fresh sample reanchors on the next feed without growing imported crops`, async () => {
    const b = browser(), A = b.open();
    await A.refresh(sample(100));
    const next = createGarden('live');
    if (kind === 'import') plantSeed(next, 4, 'broccoli');
    const expired = sample(1); expired.receivedAt = expired.observedAt = new Date(NOW - 400_000).toISOString();
    await A.store.replace(next, expired);
    assert.equal(b.stored().anchor, null);
    if (kind === 'reset') await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    await A.refresh(sample(105, 5));
    assert.equal(b.stored().plots[4].plant.grown, 0);
    await A.refresh(sample(107, 10));
    assert.equal(b.stored().plots[4].plant.grown, 2);
  });

  // A planted a crop at S100 and counted S105. B's feed is down while its own S100 response is pending.
  const planted = async () => {
    const b = browser(), A = b.open(), B = b.open();
    const old = sample(100), latest = sample(105, 5);
    await A.refresh(old);
    await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    await A.refresh(latest);
    assert.equal(b.stored().plots[4].plant.grown, 5);
    const replacement = () => {
      if (kind === 'reset') return createGarden('live');
      const next = restoreGarden(b.stored(), 'live');
      next.replayFloor = { epoch: latest.epoch, work: '1', receivedAt: new Date(NOW - 100_000).toISOString() }; // ignored
      return next;
    };
    return { b, A, B, old, latest, replacement, grown: kind === 'reset' ? 0 : 5 };
  };
  const replant = async ({ A }) => { if (kind === 'reset') await A.store.commit(g => plantSeed(g, 4, 'broccoli')); };
  const expired = () => { const s = sample(1); s.receivedAt = s.observedAt = new Date(NOW - 400_000).toISOString(); return s; };

  for (const [name, feed] of [['no', () => null], ['an unavailable', () => ({ ok: false, reason: 'unavailable' })], ['an expired', expired]]) {
    test(`${kind} with ${name} local feed rejects a delayed older response and a replay of the shared sample`, async () => {
      const t = await planted(), { b, A, B, old, latest } = t;
      assert.equal(await B.store.replace(t.replacement(), feed()), true);
      assert.equal(b.stored().anchor, null);
      assert.equal(b.stored().replayFloor.work, '105');
      await replant(t);
      const before = b.data.get(LIVE_KEY);
      assert.equal((await B.refresh(old)).result.reason, 'outOfOrder');
      assert.equal(b.data.get(LIVE_KEY), before, 'a rejected response writes nothing');
      await A.refresh(latest);
      assert.equal(b.stored().anchor.work, '105');
      assert.equal(b.stored().replayFloor, null);
      assert.equal(b.stored().plots[4].plant.grown, t.grown);
      await B.refresh(old);
      await B.refresh(latest);
      assert.equal(b.stored().plots[4].plant.grown, t.grown);
      await Promise.all([A.refresh(sample(108, 10)), B.refresh(sample(108, 10))]);
      assert.equal(b.stored().plots[4].plant.grown, t.grown + 3);
    });
  }

  test(`${kind} baselines on the first response newer than the floor without historical growth`, async () => {
    const t = await planted(), { b, A, B } = t;
    await B.store.replace(t.replacement(), null);
    await replant(t);
    await B.refresh(sample(120, 10));
    assert.equal(b.stored().anchor.work, '120');
    assert.equal(b.stored().plots[4].plant.grown, t.grown);
    await A.refresh(sample(121, 15));
    assert.equal(b.stored().plots[4].plant.grown, t.grown + 1);
  });

  test(`${kind} floor survives a second replacement, a fresh older local sample and a newly opened tab`, async () => {
    const t = await planted(), { b, A, B, old, latest } = t;
    await B.store.replace(t.replacement(), null);
    await A.store.replace(t.replacement(), { ok: false, reason: 'unavailable' });
    assert.equal(b.stored().replayFloor.work, '105');
    await B.store.replace(t.replacement(), old);
    assert.equal(b.stored().anchor, null, 'an older fresh sample cannot become the baseline');
    assert.equal(b.stored().replayFloor.work, '105');
    await replant(t);
    const C = b.open();
    assert.equal((await C.refresh(old)).result.reason, 'outOfOrder');
    await C.close();
    await A.refresh(latest);
    assert.equal(b.stored().plots[4].plant.grown, t.grown);
  });

  test(`${kind} floor also rejects an older response from a previous device epoch`, async () => {
    const b = browser(), A = b.open(), B = b.open();
    const oldDevice = sample(100), newDevice = sample(5, 5, 'wheel-b');
    await A.refresh(oldDevice);
    await A.refresh(newDevice);
    const next = createGarden('live');
    if (kind === 'import') plantSeed(next, 4, 'broccoli');
    await B.store.replace(next, null);
    if (kind === 'reset') await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    assert.equal((await B.refresh(oldDevice)).result.reason, 'outOfOrder');
    await A.refresh(newDevice);
    assert.equal(b.stored().anchor.epoch, newDevice.epoch);
    assert.equal(b.stored().plots[4].plant.grown, 0);
  });

  test(`${kind} over an undated legacy anchor waits for a response from after the replacement`, async () => {
    const b = browser();
    const old = createGarden('live'); old.anchor = { epoch: 'sepolia-installation/wheel-a', work: '105' };
    b.data.set(LIVE_KEY, JSON.stringify(old));
    const A = b.open(), B = b.open();
    const next = createGarden('live');
    if (kind === 'import') plantSeed(next, 4, 'broccoli');
    await B.store.replace(next, null);
    if (kind === 'reset') await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
    assert.equal((await B.refresh(sample(100, -10))).result.reason, 'outOfOrder');
    // A genuine counter restart reported after the replacement is not stalled by the old count.
    await A.refresh(sample(3, 5));
    assert.equal(b.stored().anchor.work, '3');
    assert.equal(b.stored().plots[4].plant.grown, 0);
  });
}

test('a delayed response from a previous device epoch cannot rewind the anchor and regrow its passages', async () => {
  const b = browser(), A = b.open(), B = b.open();
  await A.refresh(sample(100));
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  await A.refresh(sample(105, 5));
  await A.refresh(sample(5, 10, 'wheel-b'));
  assert.equal((await B.refresh(sample(100))).result.reason, 'outOfOrder');
  assert.equal((await A.refresh(sample(105, 5))).result.reason, 'outOfOrder');
  assert.equal(b.stored().anchor.epoch, 'sepolia-installation/wheel-b');
  assert.equal(b.stored().plots[4].plant.grown, 5);
});

test('a newer fresh sample reanchors replacements without awarding work, including a counter reset', async () => {
  const b = browser(), A = b.open();
  await A.refresh(sample(100));
  const next = createGarden('live'); plantSeed(next, 4, 'broccoli');
  await A.store.replace(next, sample(3, 5));
  assert.equal(b.stored().anchor.work, '3');
  await A.refresh(sample(3, 5));
  assert.equal(b.stored().plots[4].plant.grown, 0);
});

test('failed-write retries are serialized with reset and never write a snapshot based on its predecessor', async () => {
  const b = browser(), A = b.open(), B = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.store.sync();
  const realSet = B.area.setItem;
  B.area.setItem = () => { throw new Error('QuotaExceededError'); };
  await B.store.commit(g => plantSeed(g, 3, 'carrot'));
  B.area.setItem = realSet;
  await Promise.all([A.store.replace(createGarden('live')), B.store.flush()]);
  assert.equal(b.stored().dew, 12);
  assert.deepEqual(occupied(b.stored()), []);
});

test('storage read failures and unavailable coordination never allow an unlocked overwrite', async () => {
  const b = browser(), A = b.open(), B = b.open();
  await A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  const before = b.data.get(LIVE_KEY), realGet = B.area.getItem;
  B.area.getItem = () => { throw new Error('SecurityError'); };
  assert.equal((await B.store.commit(g => plantSeed(g, 3, 'carrot'))).saved, false);
  assert.equal(b.data.get(LIVE_KEY), before);
  B.area.getItem = realGet;
  assert.equal(await B.store.flush(), false);
  assert.equal(b.data.get(LIVE_KEY), before);
  const unsupported = createPantryStore(B.area, { locks: null, indexedDB: null });
  assert.equal((await unsupported.commit(g => plantSeed(g, 3, 'carrot'))).result.ok, false);
  assert.equal(await unsupported.replace(createGarden('live')), false);
  assert.equal(b.data.get(LIVE_KEY), before);
});
