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
  async function collect(state) {
    if (!await available()) return null;
    const entries = [];
    for (const {projectId, pageId} of pages(state)) {
      const result = await invoke('exportDrawing', {projectId, pageId});
      if (result.missing !== true && typeof result.base64 !== 'string')
        throw Error('Could not read drawing on page ' + pageId);
      entries.push({projectId, pageId, base64: result.missing ? null : result.base64});
    }
    return entries;
  }
  async function validate(state, entries) {
    const rows = pages(state);
    if (!Array.isArray(entries) || entries.length !== rows.length)
      throw Error('Incomplete native drawing manifest');
    entries.forEach((entry, i) => {
      const row = rows[i];
      if (entry?.projectId !== row.projectId || entry.pageId !== row.pageId ||
          !(entry.base64 === null || typeof entry.base64 === 'string' && entry.base64.length > 0))
        throw Error('Invalid drawing or notebook page relationship');
    });
    if (entries.some(entry => entry.base64 !== null) && !await available())
      throw Error('Restore this drawing archive in the updated Blueprint iOS app.');
  }
  async function stage(state, entries) {
    // The candidate planner is private until the existing restore commits.
    // Remap empty pages too, so they cannot inherit unrelated local ink.
    for (const [i, {projectId, pageId, project, page}] of pages(state).entries()) {
      const base64 = entries[i].base64;
      const fresh = base64 === null ? crypto.randomUUID() :
        (await invoke('stageDrawing', {projectId, base64})).pageId;
      if (typeof fresh !== 'string' || !fresh || project.notePages.some(p => String(p.id) === fresh))
        throw Error('Could not stage native drawing');
      if (String(project.activeNotePageId) === pageId) project.activeNotePageId = fresh;
      page.id = fresh;
    }
  }
  return {collect, validate, stage};
})();
