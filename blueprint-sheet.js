'use strict';
window.BlueprintSheet = (() => {
  const drafts = new Map();
  function open({title, message, fields = [], action = 'Save', danger = false, key = '', anchor = document.activeElement}) {
    if (document.querySelector('#bpSheet')) return Promise.resolve(null);
    const dialog = document.createElement('dialog');
    dialog.id = 'bpSheet';
    dialog.setAttribute('aria-labelledby', 'bpSheetTitle');
    const form = document.createElement('form');
    form.method = 'dialog';
    const heading = document.createElement('h2');
    heading.id = 'bpSheetTitle';
    heading.textContent = title;
    form.append(heading);
    if (message) {
      const description = document.createElement('p');
      description.id = 'bpSheetMessage';
      description.textContent = message;
      dialog.setAttribute('aria-describedby', description.id);
      form.append(description);
    }
    const inputs = fields.map(({label, value = '', multiline, required = true, type = 'text'}, i) => {
      const row = document.createElement('label');
      row.textContent = label;
      const input = document.createElement(multiline ? 'textarea' : 'input');
      if (!multiline) input.type = type;
      input.value = drafts.get(key)?.[i] ?? value;
      input.required = required;
      row.append(input);
      form.append(row);
      return input;
    });
    const footer = document.createElement('footer');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => dialog.close('cancel');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.value = 'accept';
    submit.className = danger ? 'bp-danger' : 'primary-button';
    submit.textContent = action;
    footer.append(cancel, submit);
    form.append(footer);
    dialog.append(form);
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    return new Promise(resolve => {
      dialog.addEventListener('close', () => {
        const values = inputs.map(field => field.value);
        if (key && !dialog.returnValue) drafts.set(key, values);
        else drafts.delete(key);
        dialog.remove();
        anchor?.focus?.({preventScroll:true});
        window.dispatchEvent(new Event('blueprint:sheet-change'));
        resolve(dialog.returnValue === 'accept' ? values : null);
      }, {once:true});
      function place() {
        dialog.classList.remove('bp-anchored');
        dialog.style.left = dialog.style.top = '';
        if (innerWidth <= 560 || !anchor?.getClientRects().length || anchor === document.body) return;
        const a = anchor.getBoundingClientRect(), r = dialog.getBoundingClientRect();
        dialog.classList.add('bp-anchored');
        dialog.style.left = Math.max(8, Math.min(a.left, innerWidth - r.width - 8)) + 'px';
        dialog.style.top = Math.max(8, Math.min(a.bottom + 5, innerHeight - r.height - 8)) + 'px';
      }
      dialog.showModal();
      place();
      window.addEventListener('resize', place);
      dialog.addEventListener('close', () => window.removeEventListener('resize', place), {once:true});
      (inputs[0] || cancel).focus({preventScroll:true});
      window.dispatchEvent(new Event('blueprint:sheet-change'));
    });
  }
  async function name(title, value = '', key = title, anchor) {
    const result = await open({title, fields:[{label:'Name', value}], key, anchor});
    return result?.[0] ?? null;
  }
  async function confirm(message, action = 'Delete', title = 'Confirm deletion', anchor) {
    return !!await open({title, message, action, danger:action === 'Delete', anchor});
  }
  function menuKeyboard(menu, dismiss) {
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
        return;
      }
      if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...menu.querySelectorAll('button:not([disabled])')];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus({preventScroll:true});
    });
  }
  let toastTimer;
  function toast(message) {
    let node = document.getElementById('bpToast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'bpToast';
      node.setAttribute('role','status');
      document.body.append(node);
    }
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3200);
  }
  let pendingNotice;
  function allowInk(withArchive) {
    const key = 'blueprint-ink-notice-' + (withArchive ? 'archive' : 'local');
    try { if (localStorage.getItem(key) === '1') return Promise.resolve(true); } catch {}
    if (!pendingNotice) pendingNotice = confirm(withArchive
      ? 'Handwriting saves on this device. Complete backups made by this app include native drawings. Restore them in an updated iOS app. Cross-device sync is unavailable.'
      : 'Handwriting saves only on this device. This version excludes native drawings from complete backups and sync.',
      'Continue', 'PencilKit storage').then(ok => {
        if (ok) try { localStorage.setItem(key, '1'); } catch {}
        return ok;
      }).finally(() => { pendingNotice = null; });
    return pendingNotice;
  }
  return {open, name, confirm, allowInk, menuKeyboard, toast};
})();
