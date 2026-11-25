export const plannerCollections = Object.freeze(['tasks', 'events']);

const taskGroups = [
  ['title'], ['done'], ['date', 'dueDate'], ['scheduledDate', 'scheduledTime'],
  ['priority', 'priorityRank'],
  ['area', 'projectId', 'projectActionId', 'goalId', 'actionId', 'actionIndex'],
  ['ideaId', 'ideaActionId'],
];
const eventGroups = [['title'], ['date', 'time']];

function groupsFor(collection) {
  if (collection === 'tasks') return taskGroups;
  if (collection === 'events') return eventGroups;
  throw new TypeError('Unsupported planner collection');
}

export function plannerId(value) {
  if (typeof value !== 'string' && !Number.isSafeInteger(value)) {
    throw new TypeError('Invalid planner record ID');
  }
  const id = String(value);
  if (!id.trim() || id.length > 128 || id.includes('/')) {
    throw new TypeError('Invalid planner record ID');
  }
  return id;
}

function boundedText(value, name, max = 512) {
  const text = value ?? '';
  if (typeof text !== 'string' || text.length > max) {
    throw new TypeError(`Invalid planner field: ${name}`);
  }
  return text;
}

function reference(value, name) {
  return boundedText(Number.isSafeInteger(value) ? String(value) : value, name);
}

export function projectPlannerRecord(collection, source) {
  groupsFor(collection);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('Invalid planner record');
  }
  const id = plannerId(source.id);
  const title = boundedText(source.title, 'title', 4096);
  if (!title.trim()) throw new TypeError('Planner records need a title');
  if (collection === 'events') {
    return {id, title, date: boundedText(source.date, 'date', 32), time: boundedText(source.time, 'time', 32)};
  }

  const dueDate = boundedText(source.dueDate ?? source.date, 'dueDate', 32);
  const scheduledDate = boundedText(source.scheduledDate, 'scheduledDate', 32);
  const priority = !!source.priority;
  const rank = Number(source.priorityRank);
  const index = source.actionIndex == null || source.actionIndex === '' ? '' : Number(source.actionIndex);
  return {
    id, title, done: !!source.done, date: dueDate, dueDate, scheduledDate,
    scheduledTime: scheduledDate ? boundedText(source.scheduledTime, 'scheduledTime', 32) : '',
    priority, priorityRank: priority && Number.isSafeInteger(rank) && rank > 0 ? rank : 0,
    area: boundedText(source.area, 'area'),
    projectId: reference(source.projectId, 'projectId'),
    projectActionId: reference(source.projectActionId, 'projectActionId'),
    goalId: reference(source.goalId, 'goalId'),
    actionId: reference(source.actionId, 'actionId'),
    actionIndex: Number.isSafeInteger(index) && index >= 0 ? index : '',
    ideaId: reference(source.ideaId, 'ideaId'),
    ideaActionId: reference(source.ideaActionId, 'ideaActionId'),
  };
}

function sameFields(left, right, fields) {
  return fields.every(field => left[field] === right[field]);
}

export function samePlannerRecord(collection, left, right) {
  if (!left || !right) return left === right;
  return left.id === right.id && groupsFor(collection).every(fields => sameFields(left, right, fields));
}

function mergeRecord(collection, base, local, remote) {
  if (samePlannerRecord(collection, local, remote)) return {record: local};
  if (samePlannerRecord(collection, local, base)) return {record: remote};
  if (samePlannerRecord(collection, remote, base)) return {record: local};
  if (!local || !remote) return {reason: 'deletion', fields: []};

  const record = {id: local.id};
  const conflicts = [];
  for (const group of groupsFor(collection)) {
    let chosen = local;
    if (!sameFields(local, remote, group)) {
      if (base && sameFields(local, base, group)) chosen = remote;
      else if (!base || !sameFields(remote, base, group)) conflicts.push(...group);
    }
    for (const field of group) record[field] = chosen[field];
  }
  return conflicts.length ? {reason: 'fields', fields: conflicts} : {record};
}

export function validatePlannerHead(collection, head) {
  groupsFor(collection);
  const id = plannerId(head.id);
  if (!Number.isSafeInteger(head.revision) || head.revision < 1) {
    throw new TypeError('Invalid planner record revision');
  }
  const record = head.record === null ? null : projectPlannerRecord(collection, head.record);
  if (record && record.id !== id) throw new TypeError('Planner record ID does not match its envelope');
  return {collection, id, revision: head.revision, record};
}

function putUnique(map, id, value) {
  if (map.has(id)) throw new TypeError(`Duplicate planner record ID: ${id}`);
  map.set(id, value);
}

function indexHeads(heads) {
  const index = {tasks: new Map(), events: new Map()};
  for (const raw of heads) {
    const head = validatePlannerHead(raw.collection, raw);
    putUnique(index[head.collection], head.id, head);
  }
  return index;
}

// Baseline means the last confirmed cloud heads already reconciled into the
// saved local planner. This function only produces a preview and write intents.
export function planPlannerSync({planner, baseline = [], remote}) {
  if (!Array.isArray(remote)) throw new TypeError('A server snapshot is required for planner sync');
  const baseIndex = indexHeads(baseline);
  const remoteIndex = indexHeads(remote);
  const result = {uploads: [], downloads: [], conflicts: []};

  for (const collection of plannerCollections) {
    const localIndex = new Map();
    if (!Array.isArray(planner?.[collection])) throw new TypeError(`Missing planner ${collection}`);
    for (const source of planner[collection]) {
      const record = projectPlannerRecord(collection, source);
      putUnique(localIndex, record.id, record);
    }
    const baseHeads = baseIndex[collection];
    const remoteHeads = remoteIndex[collection];
    const ids = new Set([...localIndex.keys(), ...remoteHeads.keys(), ...baseHeads.keys()]);
    for (const id of ids) {
      const base = baseHeads.get(id);
      const head = remoteHeads.get(id);
      const local = localIndex.get(id) ?? null;
      const cloud = head?.record ?? null;
      const remoteRegressed = base && (!head || head.revision < base.revision ||
        (head.revision === base.revision && !samePlannerRecord(collection, base.record, cloud)));
      const initialTombstone = !base && head?.record === null && local;
      const merged = remoteRegressed || initialTombstone
        ? {reason: remoteRegressed ? 'remote-regression' : 'deletion', fields: []}
        : mergeRecord(collection, base?.record ?? null, local, cloud);
      if (merged.reason) {
        result.conflicts.push({collection, id, revision: head?.revision ?? 0, local, remote: cloud, ...merged});
        continue;
      }
      if (!samePlannerRecord(collection, cloud, merged.record)) {
        result.uploads.push({collection, id, expectedRevision: head?.revision ?? 0, record: merged.record});
      }
      if (!samePlannerRecord(collection, local, merged.record)) {
        result.downloads.push({collection, id, record: merged.record});
      }
    }
  }
  return result;
}
