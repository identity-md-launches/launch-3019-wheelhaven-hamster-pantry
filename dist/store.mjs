// Shared pantry storage for every open tab.
//
// localStorage is the single source of truth. A tab never writes the copy it loaded at startup:
// every change first adopts the newest valid stored pantry, applies the change to it, then writes it
// back with a higher revision. Stale tabs therefore cannot replace newer progress, and telemetry is
// always applied against the newest stored anchor, so the same wheel passages never grow crops twice.
import { createGarden, restoreGarden } from './game.mjs';

export const LIVE_KEY = 'wheelhaven.v2.live';
export const LEGACY_KEY = 'wheelhaven.v1.live';

const revision = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

// Validates a stored string. Saves written before revisions existed count as revision 0.
export function parseStored(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 200_000) return null;
  try {
    const value = JSON.parse(raw);
    return { garden: restoreGarden(value, 'live'), rev: revision(value?.rev) };
  } catch { return null; }
}

export function createPantryStore(storage, { key = LIVE_KEY, legacyKey = LEGACY_KEY } = {}) {
  let garden = null, rev = 0, lastRaw = null, unsaved = false;

  const read = name => { try { return storage.getItem(name); } catch { return undefined; } };

  function adopt(raw, parsed) {
    garden = parsed.garden; rev = parsed.rev; lastRaw = raw; unsaved = false;
  }

  function write() {
    const stored = parseStored(read(key));
    rev = Math.max(rev, stored?.rev ?? 0) + 1;
    const raw = JSON.stringify({ ...garden, rev });
    try { storage.setItem(key, raw); lastRaw = raw; unsaved = false; return true; }
    catch { unsaved = true; return false; }
  }

  // Load the newest valid save, falling back to the v1 key, then to a new pantry.
  const initial = read(key), parsed = parseStored(initial);
  if (parsed) adopt(initial, parsed);
  else {
    const legacy = parseStored(read(legacyKey));
    garden = legacy?.garden ?? createGarden('live');
    lastRaw = initial ?? null;
  }

  return {
    current: () => garden,
    revision: () => rev,
    hasUnsavedChanges: () => unsaved,

    // Adopt the stored pantry when another tab has written a valid revision at least as new as ours.
    // Invalid, missing or older stored values are ignored; they never replace the copy in memory.
    sync() {
      const raw = read(key);
      if (raw === undefined || raw === null || raw === lastRaw) return { changed: false };
      const stored = parseStored(raw);
      if (!stored || stored.rev < rev) return { changed: false, ignored: true };
      adopt(raw, stored);
      return { changed: true };
    },

    // Run one game action against the newest pantry. `mutate` returns a game result; the pantry is
    // written only when the result is ok and `persist(result)` agrees.
    commit(mutate, persist = result => result.ok) {
      const synced = this.sync();
      const result = mutate(garden);
      const saved = result?.ok && persist(result) ? write() : null;
      return { result, saved, adopted: synced.changed };
    },

    // Reset and import: replace the pantry deliberately, with a revision above anything stored so
    // every other tab adopts it.
    replace(next) {
      this.sync();
      garden = next;
      return write();
    },

    // pagehide: write only a change that could not be saved earlier, and only if no other tab has
    // stored a newer revision since. An idle tab writes nothing.
    flush() {
      if (!unsaved) return false;
      const raw = read(key), stored = parseStored(raw);
      if (stored && stored.rev >= rev) { adopt(raw, stored); return false; }
      return write();
    },

    // The `storage` event from another tab. `key === null` means storage was cleared.
    handleStorageEvent(event) {
      if (event && event.key !== null && event.key !== key) return { changed: false };
      return this.sync();
    },
  };
}
