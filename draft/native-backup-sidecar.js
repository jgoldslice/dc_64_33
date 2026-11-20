/* DRAFT ONLY — native PencilKit backup sidecar coordination.
 * Does not modify the existing v74 complete-backup format or any live data.
 * The caller must obtain explicit user consent before restoring with overwrite.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlueprintNativeBackupDraft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'blueprint-native-ink-sidecar';
  const PAGE_FORMAT = 'blueprint-pencilkit-page';
  function validId(value) {
    return typeof value === 'string' && value.length > 0 &&
      new TextEncoder().encode(value).length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
  }
  function assertPage(page, projectId, pageId) {
    if (!page || page.format !== PAGE_FORMAT || page.schemaVersion !== 1 ||
        page.projectId !== projectId || page.pageId !== pageId ||
        !/^[0-9a-f]{64}$/i.test(page.drawingSHA256 || '') ||
        !/^[0-9a-f]{64}$/i.test(page.previewSHA256 || '') ||
        typeof page.drawingBase64 !== 'string' ||
        typeof page.previewBase64 !== 'string') {
      throw new Error('Invalid native drawing sidecar metadata for ' + pageId);
    }
  }
  async function sha256(bytes) {
    if (!globalThis.crypto?.subtle) throw new Error('Secure SHA-256 unavailable');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  }
  function decode64(value) {
    if (typeof value !== 'string' || !value || value.length > 60_000_000 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
      throw new Error('Invalid or oversized base64 payload');
    const raw = atob(value);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  async function verifyPage(page, projectId, pageId) {
    assertPage(page, projectId, pageId);
    const [ink, png] = await Promise.all([
      sha256(decode64(page.drawingBase64)),
      sha256(decode64(page.previewBase64))
    ]);
    if (ink !== page.drawingSHA256.toLowerCase() ||
        png !== page.previewSHA256.toLowerCase())
      throw new Error('Native drawing checksum mismatch: ' + pageId);
    return true;
  }
  async function exportSidecar(plugin, projectId, pageIds) {
    if (!validId(projectId) || !Array.isArray(pageIds) ||
        pageIds.length > 200 || new Set(pageIds).size !== pageIds.length ||
        !pageIds.every(validId)) throw new Error('Invalid page identifiers');
    const pages = [];
    for (const pageId of pageIds) {
      // Missing pages are expected when a page has no native ink.
      let page;
      try { page = await plugin.exportPage({ projectId, pageId }); }
      catch (error) {
        if (/no native drawing has been saved/i.test(String(error?.message || error))) continue;
        throw error;
      }
      await verifyPage(page, projectId, pageId);
      pages.push(page);
    }
    return { format: FORMAT, schemaVersion: 1, projectId, pages };
  }
  async function verifySidecar(bundle) {
    if (!bundle || bundle.format !== FORMAT || bundle.schemaVersion !== 1 ||
        !validId(bundle.projectId) || !Array.isArray(bundle.pages) ||
        bundle.pages.length > 200) throw new Error('Invalid native sidecar bundle');
    const ids = new Set();
    for (const page of bundle.pages) {
      if (!validId(page?.pageId) || ids.has(page.pageId))
        throw new Error('Duplicate or invalid page ID');
      ids.add(page.pageId);
      await verifyPage(page, bundle.projectId, page.pageId);
    }
    return true;
  }
  async function importSidecar(plugin, bundle, options = {}) {
    await verifySidecar(bundle); // validate ALL pages before writing ANY page
    if (options.allowOverwrite !== true)
      throw new Error('Restore requires explicit user-confirmed overwrite consent');
    const imported = [];
    for (const page of bundle.pages) {
      try {
        await plugin.importPage({
          projectId: bundle.projectId, pageId: page.pageId,
          payload: page, allowOverwrite: true
        });
        imported.push(page.pageId);
      } catch (error) {
        const failure = new Error('Partial native restore; imported ' +
          imported.length + ' pages. Remaining pages were not changed.');
        failure.cause = error;
        failure.importedPageIds = imported;
        throw failure;
      }
    }
    return imported;
  }
  return { exportSidecar, verifySidecar, importSidecar };
});
