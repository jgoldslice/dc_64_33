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
  const maxPreviewLength = 2400000;
  function validPreview(preview) {
    if (!preview || !Number.isSafeInteger(preview.width) || !Number.isSafeInteger(preview.height) ||
      preview.width < 1 || preview.height < 1 || preview.width > 20000 || preview.height > 20000 ||
      typeof preview.base64 !== 'string' || preview.base64.length > maxPreviewLength ||
      !validBase64(preview.base64)) return false;
    try {
      const header = atob(preview.base64.slice(0,32));
      if (header.length < 24 || header.slice(0,8) !== '\x89PNG\r\n\x1a\n' ||
          header.slice(12,16) !== 'IHDR') return false;
      const n = i => header.charCodeAt(i)*16777216+header.charCodeAt(i+1)*65536+
        header.charCodeAt(i+2)*256+header.charCodeAt(i+3);
      const w=n(16),h=n(20);
      return w>0 && h>0 && w<=4096 && h<=4096 && w*h<=2100000;
    } catch { return false; }
  }
  async function collect(state, {readBrowserInk, readBrowserPreview} = {}) {
    const rows = pages(state);
    const hasBrowserInk = rows.some(row => row.page.blueprintBrowserInk);
    if (hasBrowserInk) {
      if (native?.isNativePlatform?.() || !readBrowserInk)
        throw Error('Preserved iPad handwriting needs the updated web backup reader.');
      const entries = [];
      for (const {projectId, pageId, page} of rows) {
        const base64 = page.blueprintBrowserInk ? await readBrowserInk(page.blueprintBrowserInk) : null;
        if (page.blueprintBrowserInk && !validBase64(base64)) throw Error('Preserved iPad handwriting is damaged.');
        const entry={projectId,pageId,base64};
        if (page.blueprintBrowserInk?.preview) {
          if (!readBrowserPreview) throw Error('Preserved handwriting preview needs the updated web reader.');
          const preview=await readBrowserPreview(page.blueprintBrowserInk.preview);
          if (!validPreview(preview)) throw Error('Preserved handwriting preview is damaged.');
          entry.preview=preview;
        }
        entries.push(entry);
      }
      return entries;
    }
    if (!await available()) return null;
    const entries = [];
    let previewBytes=0;
    for (const {projectId, pageId} of rows) {
      const result = await invoke('exportDrawing', {projectId, pageId, includePreview:previewBytes<12000000});
      if (result.missing !== true && typeof result.base64 !== 'string')
        throw Error('Could not read drawing on page ' + pageId);
      const entry={projectId,pageId,base64:result.missing ? null : result.base64};
      if (entry.base64 && validPreview(result.preview) && previewBytes+result.preview.base64.length<=12000000) {
        entry.preview=result.preview;
        previewBytes+=result.preview.base64.length;
      }
      entries.push(entry);
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
      if (entry.preview !== undefined && (entry.base64 === null || !validPreview(entry.preview)))
        throw Error('Invalid handwriting preview');
    });
    if (entries.some(entry => entry.base64 !== null) && !await available()) {
      if (native?.isNativePlatform?.() || !allowBrowserInk)
        throw Error('Restore this drawing archive in the updated Blueprint iOS app.');
      if (entries.some(entry => entry.base64 !== null && !validBase64(entry.base64)))
        throw Error('Invalid preserved iPad handwriting encoding');
    }
  }
  async function stage(state, entries, {storeBrowserInk, reusePage} = {}) {
    const preserveOnWeb = !native?.isNativePlatform?.() && typeof storeBrowserInk === 'function';
    // The candidate planner is private until the existing restore commits.
    // Remap empty pages too, so they cannot inherit unrelated local ink.
    for (const [i, {projectId, pageId, project, page}] of pages(state).entries()) {
      const base64 = entries[i].base64;
      const reused = reusePage?.(projectId, pageId, entries[i]);
      const fresh = reused ? reused.id : base64 === null || preserveOnWeb ? crypto.randomUUID() :
        (await invoke('stageDrawing', {projectId, base64})).pageId;
      if (reused?.blueprintBrowserInk) page.blueprintBrowserInk = structuredClone(reused.blueprintBrowserInk);
      if (!reused && preserveOnWeb && base64 !== null) {
        if (!validBase64(base64)) throw Error('Invalid preserved iPad handwriting encoding');
        page.blueprintBrowserInk = await storeBrowserInk(base64,entries[i].preview);
      }
      if (typeof fresh !== 'string' || !fresh || project.notePages.some(p => p !== page && String(p.id) === fresh))
        throw Error('Could not stage native drawing');
      if (String(project.activeNotePageId) === pageId) project.activeNotePageId = fresh;
      page.id = fresh;
    }
  }
  return {collect, validate, stage};
})();
