const {test} = require('node:test');
const assert = require('node:assert/strict');
const {
  planPlannerSync,
  projectPlannerRecord,
} = require('../sync/planner-sync.mjs');

const task = {id: 42, title: 'Review lab notebook', done: false, date: '2026-11-23'};
const event = {id: 42, title: 'Meet with advisor', date: '2026-11-24', time: '14:00'};
const planner = (tasks = [], events = []) => ({tasks, events});

function head(collection, value, revision = 1) {
  return {
    collection, id: String(value.id), revision, record: projectPlannerRecord(collection, value),
  };
}

test('initial preview proposes seeding the saved task and event by their existing IDs', () => {
  const local = planner([task], [event]);
  const plan = planPlannerSync({planner: local, remote: []});
  assert.deepEqual(plan.uploads.map(({collection, id, expectedRevision}) =>
    [collection, id, expectedRevision]), [['tasks', '42', 0], ['events', '42', 0]]);
  assert.deepEqual(plan.downloads, []);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(local, {tasks: [task], events: [event]});
  assert.equal(plan.uploads[0].record.dueDate, task.date);
  assert.equal(plan.uploads[0].record.scheduledDate, task.date);
});

test('second-device preview preserves distinct local and cloud records', () => {
  const remote = [head('events', event)];
  const plan = planPlannerSync({planner: planner([task]), remote});
  assert.deepEqual(plan.uploads.map(item => item.collection), ['tasks']);
  assert.deepEqual(plan.downloads, [{collection: 'events', id: '42', record: remote[0].record}]);
});

test('initial same-ID disagreement shows both versions without changes', () => {
  const remote = [head('tasks', {...task, title: 'Different task'})];
  const plan = planPlannerSync({planner: planner([task]), remote});
  assert.deepEqual(plan.uploads, []);
  assert.deepEqual(plan.downloads, []);
  assert.deepEqual(plan.conflicts[0].fields, ['title']);
  assert.equal(plan.conflicts[0].remote.title, 'Different task');
  assert.equal(plan.conflicts[0].local.title, task.title);
});

test('completion and rescheduling merge even after the saved local state is reopened', () => {
  const baseline = JSON.parse(JSON.stringify([head('tasks', task)]));
  const remote = [head('tasks', {...task, scheduledDate: '2026-11-26', scheduledTime: '10:00'}, 2)];
  const local = JSON.parse(JSON.stringify(planner([{...task, done: true}])));
  const plan = planPlannerSync({planner: local, baseline, remote});
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.uploads[0].expectedRevision, 2);
  const merged = plan.uploads[0].record;
  assert.equal(merged.done, true);
  assert.equal(merged.dueDate, task.date);
  assert.equal(merged.scheduledDate, '2026-11-26');
  assert.equal(merged.scheduledTime, '10:00');
  assert.deepEqual(plan.downloads[0].record, merged);
});

test('concurrent event date/time changes stay together and require a decision', () => {
  const baseline = [head('events', event)];
  const remote = [head('events', {...event, time: '15:00'}, 2)];
  const local = planner([], [{...event, date: '2026-11-25'}]);
  const plan = planPlannerSync({planner: local, baseline, remote});
  assert.deepEqual(plan.conflicts[0].fields, ['date', 'time']);
  assert.deepEqual(plan.uploads, []);
  assert.deepEqual(plan.downloads, []);
});

test('legacy links are retained and only planner fields are projected', () => {
  const original = {...task, goalId: 12, actionIndex: '0', area: 'Research', projectId: 'p-1',
    projectActionId: 'a-1', ideaId: 'i-1', ideaActionId: 'ai-1', arbitrary: 'local only'};
  const projected = projectPlannerRecord('tasks', original);
  for (const field of ['area', 'projectId', 'projectActionId', 'ideaId', 'ideaActionId']) {
    assert.equal(projected[field], original[field]);
  }
  assert.equal(projected.goalId, '12');
  assert.equal(projected.actionIndex, 0);
  assert.equal(Object.hasOwn(projected, 'arbitrary'), false);
});

test('a local deletion becomes a tombstone and the other device removes the unchanged task', () => {
  const baseline = [head('tasks', task)];
  const deletion = planPlannerSync({planner: planner(), baseline, remote: baseline});
  assert.deepEqual(deletion.uploads, [{collection: 'tasks', id: '42', expectedRevision: 1, record: null}]);
  const tombstone = {...baseline[0], revision: 2, record: null};
  const plan = planPlannerSync({planner: planner([task]), baseline, remote: [tombstone]});
  assert.deepEqual(plan.downloads, [{collection: 'tasks', id: '42', record: null}]);
  assert.deepEqual(plan.uploads, []);
});

test('a remote deletion never silently discards an offline edit or resurrects an unpaired record', () => {
  const baseline = [head('tasks', task)];
  const remote = [{...baseline[0], revision: 2, record: null}];
  for (const prior of [baseline, []]) {
    const plan = planPlannerSync({planner: planner([{...task, done: true}]), baseline: prior, remote});
    assert.equal(plan.conflicts[0].reason, 'deletion');
    assert.deepEqual(plan.uploads, []);
    assert.deepEqual(plan.downloads, []);
  }
});

test('a missing or regressed cloud head blocks uploads and downloads for that record', () => {
  const baseline = [head('tasks', task, 2)];
  for (const remote of [[], [head('tasks', task)], [head('tasks', {...task, done: true}, 2)]]) {
    const plan = planPlannerSync({planner: planner([task]), baseline, remote});
    assert.equal(plan.conflicts[0].reason, 'remote-regression');
    assert.deepEqual(plan.uploads, []);
    assert.deepEqual(plan.downloads, []);
  }
});

test('identical edits, including numeric/string ID equivalents, do not cause write loops', () => {
  const baseline = [head('tasks', task)];
  const local = planner([{...task, id: '42', done: true}]);
  const remote = [head('tasks', {...task, done: true}, 2)];
  assert.deepEqual(planPlannerSync({planner: local, baseline, remote}),
    {uploads: [], downloads: [], conflicts: []});
});

test('rejects incomplete snapshots, duplicate IDs and invalid identities before producing a plan', () => {
  assert.throws(() => planPlannerSync({planner: planner()}), /server snapshot/);
  assert.throws(() => planPlannerSync({planner: {tasks: []}, remote: []}), /Missing planner events/);
  assert.throws(() => planPlannerSync({planner: planner([task, {...task, id: '42'}]), remote: []}),
    /Duplicate/);
  assert.throws(() => planPlannerSync({planner: planner([{...task, id: 'a\/b'}]), remote: []}),
    /record ID/);
  const mismatched = {...head('tasks', task), id: 'something-else'};
  assert.throws(() => planPlannerSync({planner: planner(), remote: [mismatched]}), /envelope/);
});
