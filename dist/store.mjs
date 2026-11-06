// Shared pantry storage for every open tab.
//
// localStorage is the single source of truth. The ENTIRE read/validate/mutate/write operation runs
// under an origin-wide exclusive lock. Revisions order successful saves; they are not a mutex.
import { applyTelemetry, createGarden, restoreGarden } from './game.mjs';

export const LIVE_KEY = 'wheelhaven.v2.live';
export const LEGACY_KEY = 'wheelhaven.v1.live';

const revision = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Web Locks coordinate all tabs. Older browsers use a readwrite IndexedDB transaction, whose
// object-store scope is exclusive across connections. Never fall back to an unlocked write.
function coordinator(key, locks, indexedDB) {
  let database;
  return async operation => {
    if (locks) return locks.request(`wheelhaven:pantry:${key}`, { mode: 'exclusive' }, operation);
    if (!indexedDB) throw new Error('coordinationUnavailable');
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('wheelhaven.sync', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('locks');
      request.onerror = () => { database = null; reject(request.error); };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = null; };
        resolve(db);
      };
    });
    const db = await database;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('locks', 'readwrite');
      let result;
      transaction.objectStore('locks').get(key).onsuccess = () => {
        try { result = operation(); }
        catch (error) { transaction.abort(); reject(error); }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('coordinationUnavailable'));
    });
  };
}

// Replacement crops must never receive passages from before the reset/import. Ignore the imported
// anchor. A fresh local sample can establish a baseline, but cannot rewind a newer shared sample,
// even across installation/epoch changes. Without fresh telemetry, the next feed only reanchors.
function anchorReplacement(next, current, sample) {
  next.anchor = null;
  const now = Date.now(), received = Date.parse(sample?.receivedAt), observed = Date.parse(sample?.observedAt);
  if (!sample?.ok || !Number.isFinite(sample.staleMs) || sample.staleMs < 10_000 || sample.staleMs > 300_000 ||
    !Number.isFinite(received) || !Number.isFinite(observed) || now - received > sample.staleMs ||
    now - observed > sample.staleMs || received - now > 60_000 || observed - now > 60_000) return;
  const shared = current.anchor;
  if (shared && (Date.parse(shared.receivedAt) > received ||
    (shared.epoch === sample.epoch && BigInt(shared.work) > BigInt(sample.work) &&
      (!shared.receivedAt || Date.parse(shared.receivedAt) === received)))) {
    // An undated legacy anchor cannot establish freshness. Defer to the next feed in that case.
    if (shared.receivedAt) { next.anchor = { ...shared }; next.round = current.round; }
    return;
  }
  applyTelemetry(next, sample); // anchor is null, so this awards no growth
}

// Validates a stored string. Saves written before revisions existed count as revision 0.
export function parseStored(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 200_000) return null;
  try {
    const value = JSON.parse(raw);
    return { garden: restoreGarden(value, 'live'), rev: revision(value?.rev) };
  } catch { return null; }
}

export function createPantryStore(storage, { key = LIVE_KEY, legacyKey = LEGACY_KEY,
  locks = globalThis.navigator?.locks, indexedDB = globalThis.indexedDB } = {}) {
  const exclusive = coordinator(key, locks, indexedDB);
  let garden = null, rev = 0, lastRaw = null, observedRaw, unsaved = false, pendingBase, confirmed;

  const read = name => { try { return storage.getItem(name); } catch { return undefined; } };

  function adopt(raw, parsed) {
    garden = parsed.garden; rev = parsed.rev; lastRaw = raw; unsaved = false;
    confirmed = restoreGarden(garden, 'live'); pendingBase = undefined;
  }

  function write() {
    const nextRev = rev + 1;
    const raw = JSON.stringify({ ...garden, rev: nextRev });
    try {
      // A failed read must not allow this tab to overwrite an unseen pantry.
      if (observedRaw === undefined || !Number.isSafeInteger(nextRev)) throw new Error('storageUnavailable');
      storage.setItem(key, raw);
      adopt(raw, { garden, rev: nextRev });
      return true;
    } catch {
      if (!unsaved) pendingBase = observedRaw;
      unsaved = true;
      return false; // failed writes never allocate a revision
    }
  }

  // Load the newest valid save, falling back to the v1 key, then to a new pantry.
  const initial = read(key), parsed = parseStored(initial);
  observedRaw = initial;
  if (parsed) adopt(initial, parsed);
  else {
    const legacy = parseStored(read(legacyKey));
    garden = legacy?.garden ?? createGarden('live');
    lastRaw = initial ?? null;
  }
  confirmed = restoreGarden(garden, 'live');

  function sync() {
    const raw = read(key);
    observedRaw = raw;
    if (raw === undefined) return { changed: false };
    let discarded = false;
    if (unsaved && raw !== pendingBase) {
      // Pending changes belong to this exact persisted base, not to a speculative revision.
      garden = restoreGarden(confirmed, 'live'); unsaved = false; pendingBase = undefined;
      discarded = true;
    }
    if (raw === null || raw === lastRaw) return { changed: discarded };
    const stored = parseStored(raw);
    if (!stored || stored.rev < rev) return { changed: discarded, ignored: true };
    adopt(raw, stored);
    return { changed: true };
  }

  return {
    current: () => garden,
    revision: () => rev,
    hasUnsavedChanges: () => unsaved,

    // Adopt the stored pantry when another tab has written a valid revision at least as new as ours.
    // Invalid, missing or older stored values are ignored; they never replace the copy in memory.
    sync,

    // Run one game action against the newest pantry. `mutate` returns a game result; the pantry is
    // written only when the result is ok and `persist(result)` agrees.
    async commit(mutate, persist = (result, _next) => result.ok) {
      try {
        return await exclusive(() => {
          const synced = sync(); // re-read INSIDE the lock, after any wait
          const next = restoreGarden(garden, 'live');
          const result = mutate(next); // synchronous game rule; never await while mutating a snapshot
          let saved = null;
          if (result?.ok) {
            garden = next;
            if (persist(result, next)) saved = write();
          }
          return { result, saved, adopted: synced.changed };
        });
      } catch { return { result: { ok: false, reason: 'saveUnavailable' }, saved: false, adopted: false }; }
    },

    // Reset and import: replace the pantry deliberately, with a revision above anything stored so
    // every other tab adopts it.
    async replace(next, sample = null) {
      try {
        const replacement = restoreGarden(next, 'live');
        return await exclusive(() => {
          sync();
          anchorReplacement(replacement, garden, sample);
          garden = replacement;
          return write();
        });
      } catch { return false; }
    },

    // pagehide: write only a change that could not be saved earlier, and only if no other tab has
    // stored a newer revision since. An idle tab writes nothing.
    async flush() {
      if (!unsaved) return false;
      try {
        return await exclusive(() => {
          if (!unsaved) return false;
          const raw = read(key);
          if (raw === undefined) return false;
          if (raw !== pendingBase) { sync(); return false; }
          observedRaw = raw;
          return write();
        });
      } catch { return false; }
    },

    // The `storage` event from another tab. `key === null` means storage was cleared.
    handleStorageEvent(event) {
      if (event && event.key !== null && event.key !== key) return { changed: false };
      return sync();
    },
  };
}
