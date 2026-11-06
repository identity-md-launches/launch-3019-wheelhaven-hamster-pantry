export const SPECIES = Object.freeze({
  carrot: { cost: 2, work: 6, yield: 5, points: 1 },
  broccoli: { cost: 5, work: 14, yield: 13, points: 3 },
  sunflower: { cost: 8, work: 24, yield: 24, points: 6 },
});
export const ORDER = [4, 3, 1, 0, 5, 7, 2, 6, 8];
export const IMPROVEMENTS = Object.freeze({
  mill: { cost: 20, harvests: 4 },
  library: { cost: 28, harvests: 6 },
  beacon: { cost: 80, harvests: 12 },
});

export function createGarden(mode) {
  if (!['live', 'practice'].includes(mode)) throw new Error('invalidMode');
  return {
    version: 2, mode, dew: 12, harvests: 0, points: 0,
    plots: Array.from({ length: 9 }, (_, id) => ({ unlocked: ORDER.slice(0, 4).includes(id), plant: null })),
    improvements: { mill: false, library: false, beacon: false },
    anchor: null, replayFloor: null, round: '0', practiceWork: '0',
    journal: [],
  };
}

function note(state, kind, detail = '') {
  state.journal.unshift({ kind, detail, at: Date.now() });
  state.journal = state.journal.slice(0, 8);
}

export function season(round) {
  const index = Number(BigInt(round || '0') % 3n);
  return { index, crop: ['carrot', 'broccoli', 'sunflower'][index] };
}

export function expansionCost(state) {
  return 12 + Math.max(0, state.plots.filter(p => p.unlocked).length - 4) * 4;
}

export function needed(plant) {
  return plant.watered ? Math.ceil(plant.work * 0.7) : plant.work;
}

export function ready(plant) { return !!plant && plant.grown >= needed(plant); }

export function plantSeed(state, index, type, rescue = false) {
  const plot = state.plots[index];
  if (!plot?.unlocked || plot.plant) return { ok: false, reason: 'plotUnavailable' };
  const spec = SPECIES[type];
  if (!spec || (type === 'sunflower' && !state.improvements.library)) return { ok: false, reason: 'seedLocked' };
  if (rescue && !(type === 'carrot' && canRescue(state))) return { ok: false, reason: 'rescueUnavailable' };
  if (!rescue && state.dew < spec.cost) return { ok: false, reason: 'notEnoughDew' };
  const bonus = (state.mode === 'practice' || state.round !== '0') && season(state.round).crop === type ? 2 : 0;
  if (!rescue) state.dew -= spec.cost;
  plot.plant = { type, grown: 0, work: rescue ? 10 : spec.work, watered: false,
    yield: (rescue ? 3 : spec.yield) + bonus, bonus, rescue };
  note(state, rescue ? 'rescued' : 'planted', type);
  return { ok: true };
}

export function canRescue(state) {
  return state.dew < SPECIES.carrot.cost && state.plots.every(p => !p.plant);
}

export function waterPlant(state, index) {
  const plant = state.plots[index]?.plant;
  if (!plant || ready(plant) || plant.watered) return { ok: false, reason: 'waterUnavailable' };
  if (state.dew < 1) return { ok: false, reason: 'notEnoughDew' };
  state.dew -= 1;
  plant.watered = true;
  plant.grown = Math.min(plant.grown, needed(plant));
  note(state, 'watered', plant.type);
  return { ok: true };
}

export function harvest(state, index) {
  const plot = state.plots[index];
  if (!ready(plot?.plant)) return { ok: false, reason: 'notReady' };
  const plant = plot.plant;
  const gain = plant.yield + (state.improvements.mill ? 1 : 0);
  state.dew = Math.min(1_000_000, state.dew + gain);
  state.harvests = Math.min(1_000_000, state.harvests + 1);
  state.points = Math.min(10_000_000, state.points + SPECIES[plant.type].points);
  plot.plant = null;
  note(state, 'harvested', `${plant.type}:${gain}`);
  return { ok: true, gain };
}

export function harvestAll(state) {
  let gain = 0, count = 0;
  for (let i = 0; i < 9; i++) {
    const result = harvest(state, i);
    if (result.ok) { count++; gain += result.gain; }
  }
  return { ok: count > 0, gain, count, reason: 'notReady' };
}

export function expandPlot(state, index) {
  const plot = state.plots[index];
  if (!plot || plot.unlocked) return { ok: false, reason: 'plotUnavailable' };
  const cost = expansionCost(state);
  if (state.dew < cost) return { ok: false, reason: 'notEnoughDew' };
  state.dew -= cost;
  plot.unlocked = true;
  note(state, 'expanded');
  return { ok: true };
}

export function buyImprovement(state, key) {
  const spec = IMPROVEMENTS[key];
  if (!spec || state.improvements[key]) return { ok: false, reason: 'improvementUnavailable' };
  if (key === 'beacon' && (!state.improvements.mill || !state.improvements.library)) return { ok: false, reason: 'buildFirst' };
  if (state.harvests < spec.harvests) return { ok: false, reason: 'moreHarvests' };
  if (state.dew < spec.cost) return { ok: false, reason: 'notEnoughDew' };
  state.dew -= spec.cost;
  state.improvements[key] = true;
  note(state, 'built', key);
  return { ok: true };
}

function grow(state, delta) {
  for (const plot of state.plots) {
    if (plot.plant) {
      const remaining = BigInt(Math.max(0, needed(plot.plant) - plot.plant.grown));
      plot.plant.grown += Number(delta > remaining ? remaining : delta);
    }
  }
}

export function advancePractice(state, passages = 10) {
  if (state.mode !== 'practice' || !Number.isInteger(passages) || passages < 1 || passages > 100) return { ok: false, reason: 'invalidPractice' };
  const delta = BigInt(passages);
  state.practiceWork = (BigInt(state.practiceWork) + delta).toString();
  state.round = (BigInt(state.practiceWork) / 30n).toString();
  grow(state, delta);
  return { ok: true };
}

export function parseTelemetry(status, economy, now = Date.now()) {
  const m = status?.measurement;
  const numeric = value => typeof value === 'string' && /^\d{1,80}$/.test(value);
  if (status?.schemaVersion !== 1 || !m || !numeric(m.cumulativeWorkUnits) ||
    typeof m.counterEpoch !== 'string' || !m.counterEpoch || typeof status.installationId !== 'string') {
    return { ok: false, reason: 'invalidTelemetry' };
  }
  const age = now - Date.parse(m.receivedAt);
  const observedAge = now - Date.parse(m.observedAt);
  const staleMs = Math.min(300, Math.max(10, Number(m.staleAfterSeconds) || 120)) * 1000;
  if (m.freshness !== 'online' || m.provenance !== 'hardware' || !Number.isFinite(age) ||
    !Number.isFinite(observedAge) || age < -60_000 || observedAge < -60_000 || age > staleMs || observedAge > staleMs) {
    return { ok: false, reason: 'staleTelemetry' };
  }
  const compatible = economy?.schemaVersion === 3 && economy.status === 'available' &&
    economy.installationId === status.installationId && economy.chain?.chainId === '11155111';
  const roundValue = economy?.mining?.processedThroughRound;
  const round = compatible && numeric(roundValue) ? roundValue : null;
  return {
    ok: true, epoch: `${status.installationId}/${m.counterEpoch}`, work: m.cumulativeWorkUnits,
    observedAt: m.observedAt, receivedAt: m.receivedAt, staleMs,
    rpm: Number.isFinite(m.rpmMilli) && m.rpmMilli >= 0 ? m.rpmMilli / 1000 : 0,
    running: m.coreStatus !== 'IDLE' && Number(m.rpmMilli) > 0,
    round, settledRound: compatible && numeric(economy.mining?.processedThroughRound) ? economy.mining.processedThroughRound : null,
    safeBlock: compatible && numeric(economy.chain?.safeThroughBlock) ? economy.chain.safeThroughBlock : null,
    release: compatible ? economy.release?.id || null : null,
  };
}

export function applyTelemetry(state, sample) {
  if (state.mode !== 'live' || !sample?.ok) return { ok: false, reason: 'invalidTelemetry' };
  const previous = state.anchor, floor = previous ?? state.replayFloor, next = BigInt(sample.work);
  // A delayed response must not rewind the newest sample, or a replay of that sample would count again.
  if (floor?.receivedAt) {
    const age = Date.parse(sample.receivedAt) - Date.parse(floor.receivedAt);
    if (age < 0 || (age === 0 && floor.epoch === sample.epoch && next < BigInt(floor.work))) return { ok: false, reason: 'outOfOrder' };
  }
  if (sample.round !== null) state.round = sample.round;
  state.anchor = { epoch: sample.epoch, work: sample.work, receivedAt: sample.receivedAt };
  state.replayFloor = null;
  if (!previous || previous.epoch !== sample.epoch || next < BigInt(previous.work)) {
    if (previous) note(state, 'reanchored');
    return { ok: true, reanchored: true, delta: '0' };
  }
  const delta = next - BigInt(previous.work);
  grow(state, delta);
  return { ok: true, delta: delta.toString() };
}

export function restoreGarden(raw, expectedMode) {
  let x = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (x?.version === 1) {
    const legacy = { clover: 'carrot', sunflower: 'broccoli', pumpkin: 'sunflower' };
    x = { ...x, version: 2,
      plots: Array.isArray(x.plots) ? x.plots.map(p => p?.plant ? { ...p, plant: { ...p.plant, type: legacy[p.plant.type] || p.plant.type } } : p) : x.plots,
      journal: Array.isArray(x.journal) ? x.journal.map(e => {
        if (typeof e?.detail !== 'string') return e;
        const [type, ...rest] = e.detail.split(':');
        return { ...e, detail: [legacy[type] || type, ...rest].join(':') };
      }) : x.journal,
    };
  }
  if (!x || x.version !== 2 || x.mode !== expectedMode || !Array.isArray(x.plots) || x.plots.length !== 9) throw new Error('invalidSave');
  const integer = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
  const decimal = v => typeof v === 'string' && /^\d{1,80}$/.test(v);
  if (!integer(x.dew, 1_000_000) || !integer(x.harvests, 1_000_000) || !integer(x.points, 10_000_000) ||
    !decimal(x.round) || !decimal(x.practiceWork)) throw new Error('invalidSave');
  const result = createGarden(expectedMode);
  result.dew = x.dew; result.harvests = x.harvests; result.points = x.points;
  result.round = x.round; result.practiceWork = x.practiceWork;
  for (const key of Object.keys(IMPROVEMENTS)) {
    if (typeof x.improvements?.[key] !== 'boolean') throw new Error('invalidSave');
    result.improvements[key] = x.improvements[key];
  }
  if (result.improvements.beacon && (!result.improvements.mill || !result.improvements.library)) throw new Error('invalidSave');
  result.plots = x.plots.map(p => {
    if (!p || typeof p.unlocked !== 'boolean' || (!p.unlocked && p.plant)) throw new Error('invalidSave');
    let plant = null;
    if (p.plant) {
      const q = p.plant, spec = SPECIES[q.type];
      if (!spec || !p.unlocked || typeof q.watered !== 'boolean' || typeof q.rescue !== 'boolean' ||
        !integer(q.grown, 100) || !integer(q.bonus, 2) || (q.bonus !== 0 && q.bonus !== 2) ||
        q.work !== (q.rescue ? 10 : spec.work) || q.yield !== (q.rescue ? 3 : spec.yield) + q.bonus ||
        (q.rescue && q.type !== 'carrot') || q.grown > (q.watered ? Math.ceil(q.work * .7) : q.work) ||
        (q.type === 'sunflower' && !result.improvements.library)) throw new Error('invalidSave');
      plant = { type: q.type, grown: q.grown, work: q.work, yield: q.yield, watered: q.watered, bonus: q.bonus, rescue: q.rescue };
    }
    return { unlocked: p.unlocked, plant };
  });
  if (result.plots.filter(p => p.unlocked).length < 4) throw new Error('invalidSave');
  // Normal browser restores retain the anchor; the explicit import flow clears it.
  const marker = m => {
    if (!m || typeof m.epoch !== 'string' || m.epoch.length >= 200 || !decimal(m.work)) return null;
    const value = { epoch: m.epoch, work: m.work };
    if (typeof m.receivedAt === 'string' && Number.isFinite(Date.parse(m.receivedAt))) value.receivedAt = m.receivedAt;
    return value;
  };
  result.anchor = marker(x.anchor);
  const floor = marker(x.replayFloor);
  if (!result.anchor && floor?.receivedAt) result.replayFloor = floor;
  result.journal = Array.isArray(x.journal) ? x.journal.slice(0, 8).filter(e =>
    e && typeof e.kind === 'string' && /^[a-z]+$/.test(e.kind) && typeof e.detail === 'string' && e.detail.length < 50 && Number.isFinite(e.at)
  ).map(e => ({ kind: e.kind, detail: e.detail, at: e.at })) : [];
  return result;
}
