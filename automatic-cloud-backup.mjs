export const automaticBackupPolicy = Object.freeze({
  idleMs: 30_000, intervalMs: 5 * 60_000, dailyVersions: 12,
  dailyBytes: 200 * 1024 * 1024, maxArchiveBytes: 100 * 1024 * 1024,
});
const preferenceKey = projectId => 'blueprint-cloud-backup-auto-v1:' + projectId;

function consent(preferences, projectId) {
  try {
    const value = JSON.parse(preferences.getItem(preferenceKey(projectId)) || 'null');
    if (value?.version === 1 && typeof value.uid === 'string' && typeof value.enabled === 'boolean' &&
        typeof value.consentId === 'string') return value;
  } catch {}
  return null;
}
function writeConsent(preferences, projectId, value) {
  const raw = JSON.stringify(value);
  preferences.setItem(preferenceKey(projectId), raw);
  if (preferences.getItem(preferenceKey(projectId)) !== raw) throw Error('Automatic backup settings could not be saved.');
}
export function clearAutomaticConsent(projectId, preferences = globalThis.localStorage) {
  const value = consent(preferences, projectId);
  if (value?.enabled) {
    try {writeConsent(preferences, projectId, {...value, enabled: false});}
    catch {try {preferences.removeItem(preferenceKey(projectId));} catch {}}
  }
}

// A separate queue stores at most one complete Blob per account. Existing
// planner/attachment stores and all local backup formats are untouched.
export function createBackupQueue(indexedDB = globalThis.indexedDB) {
  async function database() {
    if (!indexedDB) throw Error('Automatic backups need persistent local storage.');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('blueprint-cloud-backup-queue-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('queues');
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error('Close the other Blueprint window to open the backup queue.'));
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function access(key, value, write) {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('queues', write ? 'readwrite' : 'readonly');
        const store = tx.objectStore('queues');
        const request = write ? store.put(value, key) : store.get(key);
        let result;
        request.onsuccess = () => {result = request.result;};
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error || Error('Could not persist the pending backup.'));
      });
    } finally {db.close();}
  }
  return {get: key => access(key), put: (key, value) => access(key, value, true)};
}

async function archiveDigest(archive) {
  const hash = await crypto.subtle.digest('SHA-256', await archive.arrayBuffer());
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

const emptyRecord = () => ({version: 1, lastFingerprint: '', lastSavedAt: 0,
  day: '', versions: 0, bytes: 0, pending: null});
function validateRecord(record) {
  if (!record) return emptyRecord();
  if (record.version !== 1 || (record.lastFingerprint !== '' && !/^[a-f0-9]{64}$/.test(record.lastFingerprint)) ||
      !Number.isFinite(record.lastSavedAt) || record.lastSavedAt < 0 ||
      (record.day !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(record.day)) ||
      !Number.isSafeInteger(record.versions) || record.versions < 0 ||
      !Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
      (record.pending && (!(record.pending.archive instanceof Blob) || !record.pending.archive.size ||
        record.pending.archive.size > automaticBackupPolicy.maxArchiveBytes ||
        !/^[a-f0-9]{64}$/.test(record.pending.fingerprint) ||
        typeof record.pending.consentId !== 'string' || !/^[a-f0-9]{64}$/.test(record.pending.sha256) ||
        !/^[a-zA-Z0-9_-]{1,128}$/.test(record.pending.id)))) {
    throw Error('The pending backup queue could not be read. Automatic backups paused; keep your local export.');
  }
  return record;
}

export function createAutomaticBackup({uid, projectId, store, build,
  preferences = globalThis.localStorage, queue = createBackupQueue(),
  locks = globalThis.navigator?.locks, canRun = () => true, onState = () => {},
  now = () => Date.now(), uuid = () => crypto.randomUUID()}) {
  const key = projectId + ':' + uid;
  let closed = false, running = false, dirty = true, revision = 0;
  let grantedConsent = consent(preferences, projectId)?.consentId;
  let dueAt = now() + automaticBackupPolicy.idleMs, probeAt = dueAt, failures = 0;
  let message = 'Automatic backups are off.';
  let lastSavedAt = 0;
  function enabled() {
    const value = consent(preferences, projectId);
    return !closed && value?.uid === uid && value.enabled && value.consentId === grantedConsent;
  }
  function emit(text) {
    if (text) message = text;
    onState({enabled: enabled(), running, message, lastSavedAt});
  }
  function assertActive() {
    store.assertAccount();
    if (!enabled() || !canRun()) throw Error('Automatic backups paused.');
  }
  function pause(reason = 'Automatic backups are off.') {
    const value = consent(preferences, projectId);
    if (value?.uid === uid && value.consentId === grantedConsent) {
      try {writeConsent(preferences, projectId, {...value, enabled: false});}
      catch {
        try {preferences.removeItem(preferenceKey(projectId));}
        catch {reason = 'Paused in this window; the off setting could not be saved. Check browser storage before reopening.';}
      }
    }
    // Closed/in-memory stop prevents writes even if preference persistence fails.
    closed = true;
    emit(reason);
  }
  async function enable() {
    if (!locks?.request) throw Error('This browser needs window-lock support for safe automatic backups. Manual backups remain available.');
    store.assertAccount();
    // Verify queue access and transaction completion before granting consent. A full/unavailable queue must
    // never turn on uploads that cannot recover after an interruption.
    const record = validateRecord(await queue.get(key));
    await queue.put(key, {...record, pending: null});
    store.assertAccount();
    grantedConsent = uuid();
    writeConsent(preferences, projectId, {version: 1, uid, enabled: true, consentId: grantedConsent});
    closed = false; dirty = true; failures = 0; dueAt = now() + automaticBackupPolicy.idleMs;
    emit('Automatic backups enabled. The first copy starts after edits settle.');
  }
  function changed() {
    revision++; dirty = true;
    dueAt = now() + automaticBackupPolicy.idleMs;
  }
  function budget(record, size) {
    const day = new Date(now()).toISOString().slice(0, 10);
    if (record.day !== day) {record = {...record, day, versions: 0, bytes: 0};}
    return {record, allowed: record.versions < automaticBackupPolicy.dailyVersions &&
      record.bytes + size <= automaticBackupPolicy.dailyBytes};
  }
  async function tick() {
    if (running || !enabled() || !canRun() || now() < dueAt || (!dirty && now() < probeAt)) return;
    if (!locks?.request) {pause('This browser cannot safely coordinate automatic backups. Manual backups remain available.'); return;}
    running = true; emit();
    try {
      await locks.request('blueprint-cloud-backup:' + projectId, {mode: 'exclusive', ifAvailable: true}, async lock => {
        if (!lock) {dueAt = now() + automaticBackupPolicy.idleMs; emit('Another Blueprint window is backing up.'); return;}
        assertActive();
        let record = validateRecord(await queue.get(key));
        const permission = consent(preferences, projectId);
        if (record.pending?.consentId !== permission.consentId) record = {...record, pending: null};
        lastSavedAt = record.lastSavedAt;
        if (!record.pending && record.lastSavedAt && now() < record.lastSavedAt + automaticBackupPolicy.intervalMs) {
          dueAt = record.lastSavedAt + automaticBackupPolicy.intervalMs; return;
        }
        let snapshotRevision;
        if (!record.pending) {
          snapshotRevision = revision;
          const snapshot = await build();
          assertActive();
          if (snapshotRevision !== revision) {dueAt = now() + automaticBackupPolicy.idleMs; return;}
          if (!(snapshot.archive instanceof Blob) || !snapshot.archive.size ||
              snapshot.archive.size > automaticBackupPolicy.maxArchiveBytes || !/^[a-f0-9]{64}$/.test(snapshot.fingerprint)) {
            throw Error('Invalid complete automatic backup. Use Export backup.');
          }
          if (snapshot.fingerprint === record.lastFingerprint) {
            dirty = false; probeAt = now() + automaticBackupPolicy.intervalMs;
            emit('Up to date. No duplicate backup uploaded.'); return;
          }
          const allowance = budget(record, snapshot.archive.size);
          record = allowance.record;
          if (!allowance.allowed) {
            dueAt = Date.parse(record.day + 'T00:00:00Z') + 86400000;
            emit('Today’s automatic-backup limit is reached. Local saving and manual backups remain available.'); return;
          }
          record = {...record, versions: record.versions + 1, bytes: record.bytes + snapshot.archive.size,
            pending: {id: uuid(), archive: snapshot.archive, fingerprint: snapshot.fingerprint, consentId: permission.consentId, sha256: await archiveDigest(snapshot.archive)}};
          // The exact Blob and immutable version ID survive reload/offline retry.
          await queue.put(key, record);
        }
        const currentDay = new Date(now()).toISOString().slice(0, 10);
        if (record.day !== currentDay) {
          record = {...record, day: currentDay, versions: 1, bytes: record.pending.archive.size};
          await queue.put(key, record);
        }
        if (await archiveDigest(record.pending.archive) !== record.pending.sha256) throw Error('Pending backup integrity check failed.');
        assertActive();
        emit('Saving automatic backup…');
        await store.save(record.pending.archive, {backupId: record.pending.id, assertCanWrite: assertActive});
        assertActive();
        const saved = {...record, lastFingerprint: record.pending.fingerprint, lastSavedAt: now(), pending: null};
        await queue.put(key, saved);
        lastSavedAt = saved.lastSavedAt; failures = 0;
        dirty = snapshotRevision === undefined || snapshotRevision !== revision;
        dueAt = probeAt = now() + automaticBackupPolicy.intervalMs;
        emit('Last automatic backup: ' + new Date(lastSavedAt).toLocaleString());
      });
    } catch (error) {
      if (enabled()) {
        failures++;
        dueAt = now() + Math.min(automaticBackupPolicy.intervalMs, 30_000 * 2 ** Math.min(failures - 1, 4));
        emit('Backup pending. Your local data is safe; retrying while Blueprint is open.');
        if (/version already|integrity check|queue could not|Invalid complete|750 KiB|native drawing archive/.test(error.message)) pause(error.message);
        if (error.name === 'QuotaExceededError') pause('Automatic backups paused because local queue storage is full. Keep your local export.');
        if (['permission-denied', 'storage/unauthorized'].includes(error.code)) pause('Automatic backups paused. Check the account and cloud access rules; local saving is unchanged.');
      }
    } finally {running = false; emit();}
  }
  emit(enabled() ? 'Automatic backups will resume after edits settle.' : message);
  return {enable, pause, changed, tick, dispose: () => pause(),
    get enabled() {return enabled();}, get running() {return running;}};
}
