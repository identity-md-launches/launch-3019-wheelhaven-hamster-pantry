// Multi-tab regression tests for the shared pantry save (dist/store.mjs).
// Each "tab" is its own store over one shared storage area, the way browser tabs share localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGarden, plantSeed, harvest, parseTelemetry, applyTelemetry, restoreGarden } from '../dist/game.mjs';
import { createPantryStore, LIVE_KEY, LEGACY_KEY } from '../dist/store.mjs';

const NOW = Date.parse('2026-11-05T08:00:00Z');
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
      tab.store = createPantryStore(tab.area);
      tabs.add(tab);
      // The feed refresh in app.mjs: apply a sample to the newest pantry, writing only real changes.
      tab.refresh = s => { let round; return tab.store.commit(g => { round = g.round; return applyTelemetry(g, s); }, r => r.reanchored || r.delta !== '0' || round !== tab.store.current().round); };
      tab.deliver = () => { let changed = false; for (const e of tab.events.splice(0)) changed = tab.store.handleStorageEvent(e).changed || changed; return changed; };
      tab.close = () => { tab.store.flush(); tabs.delete(tab); };
      return tab;
    },
    stored: () => JSON.parse(data.get(LIVE_KEY)),
  };
}
const occupied = g => g.plots.map((p, i) => p.plant ? `${i}:${p.plant.type}:${p.plant.grown}` : null).filter(Boolean);

test('advisory reproduction: an idle tab that refreshes and closes cannot revert another tab\'s planting', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  assert.equal(A.store.current().dew, 12);
  assert.equal(A.store.commit(g => plantSeed(g, 4, 'broccoli')).saved, true);
  assert.equal(A.store.current().dew, 7);

  // B never delivered A's storage event (worst case) and still holds 12 dew in memory.
  assert.equal(B.store.current().dew, 12);
  B.refresh(sample(100));
  B.refresh(sample(100, 15));
  B.close();

  const C = b.open();
  assert.equal(C.store.current().dew, 7);
  assert.deepEqual(occupied(C.store.current()), ['4:broccoli:0']);
  assert.equal(b.stored().dew, 7);
});

test('pagehide from an idle tab writes nothing, even after other tabs write', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.store.commit(g => plantSeed(g, 4, 'carrot'));
  const before = b.data.get(LIVE_KEY);
  assert.equal(B.store.flush(), false);
  assert.equal(b.data.get(LIVE_KEY), before);
});

test('a stale tab adopts the current pantry before its own gameplay action', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  const { result, adopted } = B.store.commit(g => plantSeed(g, 3, 'carrot'));
  assert.equal(result.ok, true);
  assert.equal(adopted, true);
  assert.equal(B.store.current().dew, 5);
  assert.deepEqual(occupied(b.open().store.current()), ['3:carrot:0', '4:broccoli:0']);
  // The same plot cannot be bought twice from two tabs.
  assert.equal(A.store.commit(g => plantSeed(g, 3, 'broccoli')).result.reason, 'plotUnavailable');
  assert.equal(A.store.current().dew, 5);
});

test('storage events update other tabs immediately', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  assert.equal(B.deliver(), true);
  assert.equal(B.store.current().dew, 7);
  assert.equal(B.store.revision(), A.store.revision());
  // An unrelated key (language preference) does not trigger adoption work.
  assert.deepEqual(B.store.handleStorageEvent({ key: 'wheelhaven.language' }), { changed: false });
});

test('two tabs refreshing the feed never grow crops twice from the same wheel passages', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.refresh(sample(100));
  A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.refresh(sample(100, 1));            // B adopts A's anchor; nothing new
  A.refresh(sample(105, 15));
  assert.equal(A.store.current().plots[4].plant.grown, 5);
  B.refresh(sample(105, 15));           // same sample in the stale tab
  B.refresh(sample(105, 16));           // and a later sample with the same counter
  assert.equal(B.store.current().plots[4].plant.grown, 5);
  B.refresh(sample(103, 10));           // an older, out-of-order sample
  assert.equal(B.store.current().plots[4].plant.grown, 5);
  B.refresh(sample(108, 30));           // only the 3 new passages count
  assert.equal(B.store.current().plots[4].plant.grown, 8);
  B.close(); A.close();
  assert.equal(b.open().store.current().plots[4].plant.grown, 8);
});

test('a feed refresh with no new passages does not write or wake other tabs', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.refresh(sample(100));
  B.deliver();
  const revision = A.store.revision();
  assert.equal(A.refresh(sample(100, 15)).saved, null);
  assert.equal(A.store.revision(), revision);
  assert.equal(B.events.length, 0);
});

test('reset propagates: stale tabs cannot resurrect the old pantry by refreshing, acting or closing', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.refresh(sample(100));
  A.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.store.sync();
  assert.equal(B.store.current().dew, 7);

  const fresh = createGarden('live'); applyTelemetry(fresh, sample(110, 20));
  assert.equal(A.store.replace(fresh), true);

  B.refresh(sample(110, 20));
  assert.equal(B.store.current().dew, 12);
  assert.deepEqual(occupied(B.store.current()), []);
  B.close();
  const C = b.open();
  assert.equal(C.store.current().dew, 12);
  assert.deepEqual(occupied(C.store.current()), []);
  // The reset pantry is anchored at the current counter: old passages are not credited later.
  C.store.commit(g => plantSeed(g, 4, 'carrot'));
  C.refresh(sample(112, 30));
  assert.equal(C.store.current().plots[4].plant.grown, 2);
});

test('import propagates to other tabs and reanchors so imported crops are not credited twice', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.refresh(sample(100));

  const save = createGarden('live'); plantSeed(save, 4, 'broccoli'); save.dew = 40; save.harvests = 3;
  save.anchor = { epoch: 'sepolia-installation/wheel-a', work: '1' };   // an old anchor from another browser
  const imported = restoreGarden(JSON.parse(JSON.stringify(save)), 'live');
  imported.anchor = null;
  applyTelemetry(imported, sample(100, 5));
  assert.equal(imported.plots[4].plant.grown, 0);
  A.store.replace(imported);

  B.refresh(sample(100, 5));   // B used to hold the pre-import pantry
  assert.equal(B.store.current().dew, 40);
  assert.equal(B.store.current().plots[4].plant.grown, 0);
  B.refresh(sample(104, 20));
  A.refresh(sample(104, 20));
  assert.equal(A.store.current().plots[4].plant.grown, 4);
  B.close();
  const C = b.open();
  assert.equal(C.store.current().dew, 40);
  assert.equal(C.store.current().harvests, 3);
  assert.equal(C.store.current().plots[4].plant.grown, 4);
});

test('a reset written while another tab had an unsaved change is not overwritten on pagehide', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  // B's write fails once (quota), leaving an unsaved change.
  const realSet = B.area.setItem;
  B.area.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(B.store.commit(g => plantSeed(g, 4, 'broccoli')).saved, false);
  assert.equal(B.store.hasUnsavedChanges(), true);
  B.area.setItem = realSet;
  // Meanwhile A resets, storing a newer revision.
  A.store.replace(createGarden('live'));
  assert.equal(B.store.flush(), false);
  assert.equal(b.stored().dew, 12);
  assert.equal(B.store.current().dew, 12);
});

test('pagehide retries a failed write when nothing newer is stored', () => {
  const b = browser();
  const B = b.open();
  const realSet = B.area.setItem;
  B.area.setItem = () => { throw new Error('QuotaExceededError'); };
  B.store.commit(g => plantSeed(g, 4, 'broccoli'));
  B.area.setItem = realSet;
  assert.equal(B.store.flush(), true);
  assert.equal(b.stored().dew, 7);
  assert.equal(B.store.hasUnsavedChanges(), false);
});

test('invalid, tampered or older stored values are never adopted', () => {
  const b = browser();
  const A = b.open();
  A.store.commit(g => plantSeed(g, 4, 'broccoli'));
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
  A.store.commit(g => plantSeed(g, 3, 'carrot'));
  assert.equal(b.stored().dew, 5);
  assert.ok(b.stored().rev > revision);
});

test('existing saves without revisions and v1 saves still load', () => {
  const b = browser();
  const old = createGarden('live'); plantSeed(old, 4, 'carrot'); old.anchor = { epoch: 'sepolia-installation/wheel-a', work: '100', receivedAt: new Date(NOW).toISOString() };
  b.data.set(LIVE_KEY, JSON.stringify(old));
  const A = b.open();
  assert.equal(A.store.current().dew, 10);
  assert.equal(A.store.revision(), 0);
  A.refresh(sample(103, 15));
  assert.equal(A.store.current().plots[4].plant.grown, 3);
  assert.equal(b.stored().rev, 1);

  const v1 = browser();
  const legacy = { ...createGarden('live'), version: 1, dew: 9 };
  v1.data.set(LEGACY_KEY, JSON.stringify(legacy));
  assert.equal(v1.open().store.current().dew, 9);
});

test('a harvest in one tab cannot be collected again from a stale tab', () => {
  const b = browser();
  const A = b.open(), B = b.open();
  A.refresh(sample(100));
  A.store.commit(g => plantSeed(g, 4, 'carrot'));
  A.refresh(sample(106, 15));
  B.store.sync();
  assert.equal(A.store.commit(g => harvest(g, 4)).result.ok, true);
  const dew = A.store.current().dew;
  assert.equal(B.store.commit(g => harvest(g, 4)).result.reason, 'notReady');
  assert.equal(b.open().store.current().dew, dew);
});
