import {planPlannerSync, projectPlannerRecord, samePlannerRecord, validatePlannerHead} from './planner-sync.mjs';

const keyOf = ({collection, id}) => collection + ':' + id;
const canonical = heads => heads.map(h => validatePlannerHead(h.collection, h))
  .sort((a,b) => keyOf(a).localeCompare(keyOf(b)));
const sameHeads = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const linked = r => !!r && ['area','projectId','projectActionId','goalId','actionId','ideaId','ideaActionId']
  .some(k => !!r[k]) || !!r && r.actionIndex != null && r.actionIndex !== '';

// First opt-in pilot: do not propagate deletions or alter related entities.
export function buildPilotPreview(planner, baseline, remote) {
  const excluded = new Set((planner.linkedTaskIds || []).map(String));
  for (const t of planner.tasks) if (linked(t)) excluded.add(String(t.id));
  for (const h of [...baseline,...remote])
    if (h.collection === 'tasks' && linked(h.record)) excluded.add(String(h.id));
  const eligible = h => h.collection !== 'tasks' || !excluded.has(String(h.id));
  const local = {tasks: planner.tasks.filter(t => !excluded.has(String(t.id))), events: planner.events};
  const plan = planPlannerSync({planner: local, baseline: baseline.filter(eligible), remote: remote.filter(eligible)});
  const deletions = [...plan.uploads, ...plan.downloads].filter(x => x.record === null);
  const blocked = new Set(deletions.map(keyOf));
  return {
    uploads: plan.uploads.filter(x => !blocked.has(keyOf(x))),
    downloads: plan.downloads.filter(x => !blocked.has(keyOf(x))),
    conflicts: plan.conflicts,
    skippedDeletions: [...blocked],
    excluded: [...excluded],
  };
}

export function createPlannerPilot({store, local, storage, scope, assertAccount}) {
  const key = 'blueprint-sync-v1:' + encodeURIComponent(scope);
  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return {raw, baseline: [], pending: null};
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.baseline))
      throw Error('Invalid sync checkpoint. Preserve local data and seek recovery before syncing.');
    return {raw, baseline: canonical(parsed.baseline), pending: parsed.pending || null};
  }
  function write(value, expected) {
    if (storage.getItem(key) !== expected) throw Error('Sync checkpoint changed in another window. Preview again.');
    const raw = JSON.stringify({version: 1, ...value});
    storage.setItem(key, raw);
    if (storage.getItem(key) !== raw) throw Error('Sync checkpoint could not be verified.');
    return raw;
  }
  async function preview() {
    assertAccount();
    const checkpoint = read(), snapshot = local.snapshot();
    const remote = canonical(await store.list());
    assertAccount();
    if (local.snapshot().token !== snapshot.token || read().raw !== checkpoint.raw)
      throw Error('Local planner changed. Preview again.');
    return {checkpoint, snapshot, remote, ...buildPilotPreview(snapshot.planner, checkpoint.baseline, remote)};
  }
  async function apply(review) {
    assertAccount();
    if (review.conflicts.length) throw Error('Resolve conflicting records before applying sync.');
    const remote = canonical(await store.list());
    assertAccount();
    const fresh = local.snapshot();
    if (fresh.token !== review.snapshot.token || !sameHeads(remote, review.remote))
      throw Error('Planner changed since preview. Preview again.');
    const checkpoint = read();
    if (checkpoint.raw !== review.checkpoint.raw) throw Error('Sync checkpoint changed. Preview again.');
    const plan = buildPilotPreview(fresh.planner, checkpoint.baseline, remote);
    if (plan.conflicts.length) throw Error('Resolve conflicting records before applying sync.');
    let journal = write({baseline: checkpoint.baseline, pending: {
      uploads: plan.uploads, downloads: plan.downloads,
    }}, checkpoint.raw);
    const expected = new Map(remote.map(h => [keyOf(h), h]));
    for (const intent of plan.uploads) {
      assertAccount();
      if (local.snapshot().token !== fresh.token) throw Error('Local planner changed. Preview again; cloud writes may have completed.');
      const head = await store.commit(intent);
      expected.set(keyOf(head), head);
    }
    const confirmed = canonical(await store.list());
    assertAccount();
    if (!sameHeads(confirmed, [...expected.values()]) || local.snapshot().token !== fresh.token ||
        read().raw !== journal) throw Error('Sync changed during apply. Preview again; cloud writes may have completed.');
    local.apply(fresh.token, plan.downloads);
    // Advance only heads that match the newly saved local planner. Skipped
    // tombstones, unpaired deletions and linked tasks never become a new baseline.
    const after = local.snapshot().planner;
    const excluded = new Set(plan.excluded);
    const blocked = new Set(plan.skippedDeletions);
    const paired = confirmed.filter(h => h.record && !blocked.has(keyOf(h)) &&
      !(h.collection === 'tasks' && excluded.has(h.id)) &&
      after[h.collection].some(r => String(r.id) === h.id &&
        samePlannerRecord(h.collection, projectPlannerRecord(h.collection, r), h.record)));
    const next = new Map(checkpoint.baseline.map(h => [keyOf(h), h]));
    for (const head of paired) next.set(keyOf(head), head);
    write({baseline: canonical([...next.values()]), pending: null}, journal);
    return {uploads: plan.uploads.length, downloads: plan.downloads.length};
  }
  return {preview, apply};
}
