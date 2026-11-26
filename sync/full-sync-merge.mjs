// A three-way JSON merge: no timestamps or last-writer-wins decisions.
// Array items with IDs merge independently; ambiguous ordering or edits stop sync.
export function canonicalJSON(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}
export const equal = (a,b) => canonicalJSON(a) === canonicalJSON(b);
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const itemId = v => object(v) && (typeof v.id === 'string' || Number.isSafeInteger(v.id)) ? String(v.id) : null;

function mergeOrder(base, local, remote, ids, path, conflicts, choice) {
  const kept = new Set(ids);
  const b = base.filter(id => kept.has(id));
  const old = new Set(base);
  function completeOrder(list){
    const sequence=list.filter(id=>kept.has(id)&&old.has(id));
    // A reviewed delete/edit choice may retain an item missing on one side.
    for(let i=0;i<b.length;i++)if(!sequence.includes(b[i])){
      const next=b.slice(i+1).find(id=>sequence.includes(id));
      if(next===undefined)sequence.push(b[i]);else sequence.splice(sequence.indexOf(next),0,b[i]);
    }
    return sequence;
  }
  const l = completeOrder(local),r = completeOrder(remote);
  const order = choice==='device'?l:choice==='cloud'?r:equal(l,r) ? l : equal(l,b) ? r : equal(r,b) ? l : null;
  if (!order) { conflicts.push({path,reason:'order'}); return local; }
  // Disjoint concurrent additions have a deterministic order on every peer.
  return [...order, ...ids.filter(id => !old.has(id)).sort()];
}
export function mergeJSON(base, local, remote, {choices = {}} = {}) {
  const conflicts = [];
  function merge(b,l,r,path) {
    const choice = choices[JSON.stringify(path)];
    const keyedArrays=Array.isArray(l)&&Array.isArray(r)&&(b===undefined||Array.isArray(b))&&
      [b||[],l,r].every(list=>list.every(item=>itemId(item)!==null)&&new Set(list.map(itemId)).size===list.length);
    if (!keyedArrays && choice === 'device') return structuredClone(l);
    if (!keyedArrays && choice === 'cloud') return structuredClone(r);
    if (equal(l,r) || equal(r,b)) return structuredClone(l);
    if (equal(l,b)) return structuredClone(r);
    if (l === undefined || r === undefined) {
      conflicts.push({path,reason:'delete-edit'}); return structuredClone(l);
    }
    if (object(l) && object(r) && (b === undefined || object(b))) {
      const out = Object.create(null);
      for (const key of new Set([...Object.keys(b || {}),...Object.keys(l),...Object.keys(r)])) {
        const value = merge(b?.[key],l[key],r[key],[...path,key]);
        if (value !== undefined) out[key] = value;
      }
      return out;
    }
    if (Array.isArray(l) && Array.isArray(r) && (b === undefined || Array.isArray(b))) {
      const lists = [b || [],l,r];
      if (lists.every(list => list.every(item => itemId(item) !== null) && new Set(list.map(itemId)).size === list.length)) {
        const maps = lists.map(list => new Map(list.map(item => [itemId(item),item])));
        const items = new Map();
        for (const id of new Set(maps.flatMap(map => [...map.keys()]))) {
          const v = merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),[...path,id]);
          if (v !== undefined) items.set(id,v);
        }
        const order = mergeOrder(lists[0].map(itemId),l.map(itemId),r.map(itemId),[...items.keys()],path,conflicts,choice);
        return order.map(id => items.get(id)).filter(v => v !== undefined);
      }
    }
    conflicts.push({path,reason:'edit-edit'}); return structuredClone(l);
  }
  return {value:merge(base,local,remote,[]),conflicts};
}
