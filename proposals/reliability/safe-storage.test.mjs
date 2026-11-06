/* Run with: node --test proposals/reliability/safe-storage.test.mjs
   Uses a data: import to test the standalone ESM helper without changing app packaging. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./safe-storage.js', import.meta.url), 'utf8');
const { saveJSON, loadJSON, inspectCompleteBackup } =
  await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));

test('round trips valid planner data', () => {
  const map = new Map();
  const storage = { setItem: (k,v) => map.set(k,v), getItem: k => map.get(k) ?? null };
  assert.equal(saveJSON(storage, 'planner', { goals: [{ title: 'Test' }] }).ok, true);
  assert.deepEqual(loadJSON(storage, 'planner').value, { goals: [{ title: 'Test' }] });
});
test('quota failures are reported as unsaved', () => {
  let status;
  const storage = { setItem: () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } };
  assert.equal(saveJSON(storage, 'planner', {}, s => status = s).ok, false);
  assert.deepEqual(status, { status: 'unsaved', reason: 'QuotaExceededError' });
});
test('corrupt JSON never gets mistaken for empty data', () => {
  const result = loadJSON({ getItem: () => '{broken' }, 'planner');
  assert.equal(result.ok, false);
});
test('rejects unsupported backup markers', () => {
  assert.equal(inspectCompleteBackup({ type: 'unknown' }).ok, false);
});
