'use strict';
window.BlueprintDrawingArchive = (() => {
  const native = window.Capacitor;
  const invoke = (method, args = {}) => native.nativePromise('BlueprintPencil', method, args);
  async function available() {
    if (!native?.isNativePlatform?.()) return false;
    try { return (await invoke('capabilities')).drawingArchiveVersion === 1; }
    catch (error) {
      if (error?.code === 'UNIMPLEMENTED') return false;
      throw error;
    }
  }
  function pages(state) {
    const rows = [];
    for (const project of state.projects || []) {
      const seen = new Set();
      for (const page of project.notePages || []) {
        const id = String(page.id ?? '');
        if (!id || seen.has(id)) throw Error('Missing or duplicate notebook page ID');
        seen.add(id);
        rows.push({projectId: String(project.id), pageId: id, page, project});
      }
    }
    return rows;
  }
  async function collect(state, {readBrowserInk} = {}) {
    const rows = pages(state);
    const hasBrowserInk = rows.some(row => row.page.blueprintBrowserInk);
    if (hasBrowserInk) {
      if (native?.isNativePlatform?.() || !readBrowserInk)
        throw Error('Preserved iPad handwriting needs the updated web backup reader.');
      const entries = [];
      for (const {projectId, pageId, page} of rows) {
        const base64 = page.blueprintBrowserInk ? await readBrowserInk(page.blueprintBrowserInk) : null;
        if (page.blueprintBrowserInk && !validBase64(base64)) throw Error('Preserved iPad handwriting is damaged.');
        entries.push({projectId, pageId, base64});
      }
      return entries;
    }
    if (!await available()) return null;
    const entries = [];
    for (const {projectId, pageId} of rows) {
      const result = await invoke('exportDrawing', {projectId, pageId});
      if (result.missing !== true && typeof result.base64 !== 'string')
        throw Error('Could not read drawing on page ' + pageId);
      entries.push({projectId, pageId, base64: result.missing ? null : result.base64});
    }
    return entries;
  }
  function validBase64(value) {
    if (typeof value !== 'string' || !value.length || value.length % 4) return false;
    const end = value.length - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
    for (let offset = 0; offset < end; offset += 32768)
      if (/[^A-Za-z0-9+/]/.test(value.slice(offset, Math.min(offset + 32768, end)))) return false;
    return end > 0;
  }
  async function validate(state, entries, {allowBrowserInk = false} = {}) {
    const rows = pages(state);
    if (!Array.isArray(entries) || entries.length !== rows.length)
      throw Error('Incomplete native drawing manifest');
    entries.forEach((entry, i) => {
      const row = rows[i];
      if (entry?.projectId !== row.projectId || entry.pageId !== row.pageId ||
          !(entry.base64 === null || typeof entry.base64 === 'string' && entry.base64.length > 0))
        throw Error('Invalid drawing or notebook page relationship');
    });
    if (entries.some(entry => entry.base64 !== null) && !await available()) {
      if (native?.isNativePlatform?.() || !allowBrowserInk)
        throw Error('Restore this drawing archive in the updated Blueprint iOS app.');
      if (entries.some(entry => entry.base64 !== null && !validBase64(entry.base64)))
        throw Error('Invalid preserved iPad handwriting encoding');
    }
  }
  async function stage(state, entries, {storeBrowserInk} = {}) {
    const preserveOnWeb = !native?.isNativePlatform?.() && typeof storeBrowserInk === 'function';
    // The candidate planner is private until the existing restore commits.
    // Remap empty pages too, so they cannot inherit unrelated local ink.
    for (const [i, {projectId, pageId, project, page}] of pages(state).entries()) {
      const base64 = entries[i].base64;
      const fresh = base64 === null || preserveOnWeb ? crypto.randomUUID() :
        (await invoke('stageDrawing', {projectId, base64})).pageId;
      if (preserveOnWeb && base64 !== null) {
        if (!validBase64(base64)) throw Error('Invalid preserved iPad handwriting encoding');
        page.blueprintBrowserInk = await storeBrowserInk(base64);
      }
      if (typeof fresh !== 'string' || !fresh || project.notePages.some(p => String(p.id) === fresh))
        throw Error('Could not stage native drawing');
      if (String(project.activeNotePageId) === pageId) project.activeNotePageId = fresh;
      page.id = fresh;
    }
  }
  return {collect, validate, stage};
})();
