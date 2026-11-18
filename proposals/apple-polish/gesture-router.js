/**
 * Canvas vNext PROPOSAL ONLY. This file is intentionally NOT imported.
 *
 * Replaces scattered swipe logic with one narrow, explicit gesture classifier.
 * No DOM modification or navigation happens until a caller installs it.
 * Do not install globally over the notebook: notes handle their own gestures.
 */
export function createHorizontalSwipeRouter({
  root,
  onSwipe,
  minDistance=68,
  horizontalRatio=1.6,
  maxDurationMs=850,
  edgeInset=26,
  excludeSelector=[
    'input','textarea','select','button','a','canvas','svg','video',
    '[contenteditable]','[role="slider"]','[role="tablist"]',
    '[role="dialog"]','.modal-back','.opening-overlay',
    '.bottom-nav','.v76-notebook-ui','.no-swipe',
    '[data-no-swipe]','[data-scroll-x]'
  ].join(',')
}={}) {
  if (!(root instanceof Element)) throw new TypeError('Gesture root must be an Element');
  if (typeof onSwipe!=='function') throw new TypeError('onSwipe callback required');
  let gesture=null;

  function inScrollableAncestor(target) {
    for(let node=target;node && node!==root.parentElement;node=node.parentElement){
      if(!(node instanceof Element))continue;
      const st=getComputedStyle(node);
      if(/^(auto|scroll)$/.test(st.overflowX) && node.scrollWidth > node.clientWidth + 8) return true;
    }
    return false;
  }
  function protectedTarget(target) {
    if(!(target instanceof Element))return true;
    if(target.closest(excludeSelector))return true;
    // Editable descendants inside custom notes are protected too.
    if(target.closest('[data-gesture-owner="notebook"]'))return true;
    return inScrollableAncestor(target);
  }
  const allowedPointer=e=>e.isPrimary!==false && e.button===0 && e.pointerType!=='pen';
  const clear=()=>{gesture=null;};
  function down(e) {
    gesture=null;
    if(!allowedPointer(e)||protectedTarget(e.target))return;
    const rect=root.getBoundingClientRect();
    if(e.clientX<rect.left+edgeInset||e.clientX>rect.right-edgeInset)return;
    gesture={pointerId:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),target:e.target,invalid:false};
  }
  function move(e) {
    if(!gesture||gesture.pointerId!==e.pointerId)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    // Once the user commits to a vertical scroll, don't reconsider.
    if(Math.abs(dy)>18 && Math.abs(dy)>Math.abs(dx))gesture.invalid=true;
  }
  function up(e) {
    if(!gesture||gesture.pointerId!==e.pointerId)return;
    const g=gesture;gesture=null;
    if(g.invalid||performance.now()-g.t>maxDurationMs)return;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(Math.abs(dx)<minDistance||Math.abs(dx)<Math.abs(dy)*horizontalRatio)return;
    // The callback chooses navigation; this library never swipes tabs itself.
    onSwipe({direction:dx<0?'left':'right',distance:Math.abs(dx),startTarget:g.target});
  }
  root.addEventListener('pointerdown',down,{passive:true});
  root.addEventListener('pointermove',move,{passive:true});
  root.addEventListener('pointerup',up,{passive:true});
  root.addEventListener('pointercancel',clear,{passive:true});
  window.addEventListener('blur',clear);
  return {dispose() {
    root.removeEventListener('pointerdown',down);
    root.removeEventListener('pointermove',move);
    root.removeEventListener('pointerup',up);
    root.removeEventListener('pointercancel',clear);
    window.removeEventListener('blur',clear);
    clear();
  }};
}

// Demonstration (DO NOT wire until the user approves):
// const router = createHorizontalSwipeRouter({
//   root: document.querySelector('#main-content'),
//   onSwipe: ({direction}) => navigateAdjacentTopLevelTab(direction)
// });
// router.dispose() when uninstalling or changing routes.
