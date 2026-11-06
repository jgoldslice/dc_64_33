/* DRAFT — not wired into production. Small, dependency-free storage adapter.
   The caller owns user-visible status and should never report "Saved" on failure. */
export function saveJSON(storage, key, value, onStatus = () => {}) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
    if (serialized === undefined) throw new TypeError('Cannot serialize undefined');
    storage.setItem(key, serialized);
    onStatus({ status: 'saved' });
    return { ok: true };
  } catch (error) {
    onStatus({ status: 'unsaved', reason: error?.name || 'StorageError' });
    return { ok: false, error };
  }
}

export function loadJSON(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { ok: true, found: false };
    return { ok: true, found: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, found: false, error };
  }
}

/* A verified restore must finish validating *before* any live storage writes.
   No destructive import behavior is implemented in this draft helper. */
export function inspectCompleteBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return { ok: false, reason: 'Backup root must be an object' };
  if (payload.type !== 'canvas-complete-backup')
    return { ok: false, reason: 'Not a Canvas complete backup' };
  return { ok: true, caution: 'Format marker only; media/reference integrity still requires app-specific validation' };
}
