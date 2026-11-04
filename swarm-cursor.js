/*!
 * Swarm Cursor — Saturn Results
 * A swarm of labelled "agent" cursors that appear to assemble the page in
 * front of the visitor: each agent flies to an element, drags a selection box
 * over it and the element materialises inside the box.
 *
 * Usage:  <script src="swarm-cursor.js" defer></script>
 * Options (data attributes on the script tag):
 *   data-targets="h1, h2, .card"   CSS selector for the layers the swarm builds
 *   data-start-after="#loader"      wait until this element has class "done"
 *   data-agents="7"                 number of agents (default 7, 4 on small screens)
 * Disable with ?swarm=off in the URL. Skipped entirely for prefers-reduced-motion.
 */
(() => {
  'use strict';

  const script = document.currentScript;
  const opts = (script && script.dataset) || {};
  if (new URLSearchParams(location.search).get('swarm') === 'off') return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DEFAULT_TARGETS = [
    '.nav__brand', '.nav__links a', '.nav__cta',
    '.hero__eyebrow', '.hero h1', '.hero__sub', '.hero__meta',
    '.section__num', '.section__title', '.section__kicker',
    '.project', '.service',
    '.cta h2', '.cta__btn',
    '.footer-inner h3', '.footer-inner p', '.footer-meta'
  ].join(',');

  const ROSTER = [
    { name: 'Layout', color: '#4d7cff' },
    { name: 'Type',   color: '#ff5fa2' },
    { name: 'Grid',   color: '#2fd18b' },
    { name: 'Motion', color: '#ffb020' },
    { name: 'Copy',   color: '#b388ff' },
    { name: 'Colour', color: '#22d3ee' },
    { name: 'A11y',   color: '#ff7a3d' },
    { name: 'SEO',    color: '#a3e635' }
  ];

  const small = innerWidth < 780;
  const agentCount = Math.max(1, Math.min(ROSTER.length,
    parseInt(opts.agents, 10) || (small ? 4 : 7)));

  /* ---------------- styles ---------------- */
  const css = `
  .swc-pending{visibility:hidden}
  .swc-layer{position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden}
  .swc-agent{position:absolute;left:0;top:0;will-change:transform;transition:opacity .4s}
  .swc-agent svg{display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
  .swc-tag{position:absolute;left:16px;top:18px;padding:2px 7px;border-radius:4px;font:600 10px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.04em;color:#0a0a12;white-space:nowrap}
  .swc-box{position:absolute;left:0;top:0;border:1.5px solid;box-sizing:border-box;transition:opacity .45s}
  .swc-box.out{opacity:0}
  .swc-h{position:absolute;width:7px;height:7px;background:#fff;border:1.5px solid;box-sizing:border-box}
  .swc-h.a{left:-4px;top:-4px}.swc-h.b{right:-4px;top:-4px}.swc-h.c{left:-4px;bottom:-4px}.swc-h.d{right:-4px;bottom:-4px}
  .swc-dim{position:absolute;right:-2px;bottom:-22px;padding:1px 6px;border-radius:3px;font:600 9px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0a0a12;white-space:nowrap}
  .swc-ghost{position:absolute;left:0;top:0;border:1px dashed rgba(170,190,255,.28);border-radius:2px;box-sizing:border-box;background:rgba(120,140,255,.03);transition:opacity .3s}
  .swc-pill{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9001;display:flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;border-radius:999px;background:rgba(14,12,24,.82);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#d9d4ef;box-shadow:0 8px 30px rgba(0,0,0,.45);transition:opacity .6s,transform .6s;white-space:nowrap}
  .swc-pill.hide{opacity:0;transform:translate(-50%,16px);pointer-events:none}
  .swc-dots{display:flex;gap:4px}
  .swc-dot{width:7px;height:7px;border-radius:50%;opacity:.45;transition:opacity .2s}
  .swc-dot.on{opacity:1;box-shadow:0 0 8px currentColor}
  .swc-bar{width:56px;height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
  .swc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4d7cff,#b388ff);transition:width .3s}
  .swc-btn{all:unset;cursor:pointer;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font:inherit}
  .swc-btn:hover{background:rgba(255,255,255,.18)}
  .swc-btn:focus-visible{outline:2px solid #b388ff;outline-offset:2px}
  @media (max-width:520px){.swc-bar{display:none}.swc-pill{gap:8px;padding-left:10px}}
  `;

  /* ---------------- helpers ---------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const pageRect = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  };
  const make = (tag, cls, parent) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  };

  let active = true;
  let layer, pill, pillText, pillBar, dots = [];
  let targets = [];          // all elements the swarm builds
  let queue = [];            // jobs waiting for an agent
  const jobs = new Map();    // el -> job
  const fading = [];         // boxes still fading out
  let built = 0;
  const agents = [];

  function tween(dur, step, abort) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const frame = now => {
        if (!active || (abort && abort())) return resolve(false);
        const p = Math.min(1, (now - t0) / dur);
        step(p);
        if (p < 1) requestAnimationFrame(frame); else resolve(true);
      };
      requestAnimationFrame(frame);
    });
  }
  const wait = (ms, abort) => tween(ms, () => {}, abort);

  /* ---------------- targets ---------------- */
  function collectTargets() {
    let list;
    try { list = Array.from(document.querySelectorAll(opts.targets || DEFAULT_TARGETS)); }
    catch (e) { list = []; }
    // Drop nested matches so a layer is only built once.
    list = list.filter(el => !list.some(o => o !== el && o.contains(el)));
    // Skip things that aren't rendered (e.g. nav links hidden on mobile).
    return list.filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; });
  }

  function reveal(el, instant) {
    if (!el.classList.contains('swc-pending')) return;
    el.classList.remove('swc-pending');
    if (!instant && el.animate) {
      el.animate(
        [{ clipPath: 'inset(0 100% 100% 0)' }, { clipPath: 'inset(0 0% 0% 0)' }],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
  }

  function enqueue(el) {
    if (jobs.has(el) || !el.classList.contains('swc-pending')) return;
    const ghost = make('div', 'swc-ghost', layer);
    const job = { el, ghost, agent: null, since: performance.now() };
    jobs.set(el, job);
    queue.push(job);
    queue.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  }

  function finishJob(job) {
    job.ghost.remove();
    jobs.delete(job.el);
    queue = queue.filter(j => j !== job);
    built++;
    updatePill();
  }

  /* ---------------- agents ---------------- */
  function arrowSVG(color) {
    return `<svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true"><path d="M1.5 1.5v16.2l4.6-4.3 3.3 7.3 3.1-1.4-3.3-7.1h6.4z" fill="${color}" stroke="#0a0a12" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  }

  function createAgent(def, i) {
    const node = make('div', 'swc-agent', layer);
    node.innerHTML = arrowSVG(def.color);
    const tag = make('span', 'swc-tag', node);
    tag.textContent = def.name;
    tag.style.background = def.color;
    // Spawn just off-screen around the edges.
    const side = i % 4;
    const vx = side === 0 ? -40 : side === 1 ? innerWidth + 40 : rand(0, innerWidth);
    const vy = side === 2 ? -40 : side === 3 ? innerHeight + 40 : rand(0, innerHeight);
    return { ...def, i, node, x: vx + scrollX, y: vy + scrollY, box: null, busy: false, idleSince: performance.now() };
  }

  function moveTo(agent, target, dur, abort) {
    const x0 = agent.x, y0 = agent.y;
    const [tx0, ty0] = target();
    const dist = Math.hypot(tx0 - x0, ty0 - y0) || 1;
    const bend = rand(-.28, .28) * Math.min(dist, 500);
    const nx = -(ty0 - y0) / dist, ny = (tx0 - x0) / dist;
    return tween(dur, p => {
      const [tx, ty] = target();                 // live: follows moving elements
      const e = easeInOut(p);
      const cx = (x0 + tx) / 2 + nx * bend, cy = (y0 + ty) / 2 + ny * bend;
      const u = 1 - e;
      agent.x = u * u * x0 + 2 * u * e * cx + e * e * tx;
      agent.y = u * u * y0 + 2 * u * e * cy + e * e * ty;
    }, abort);
  }
  const travelTime = (agent, x, y) => Math.min(1100, 380 + Math.hypot(x - agent.x, y - agent.y) * .55);

  function takeJob(agent) {
    const free = queue.filter(j => !j.agent);
    if (!free.length) return null;
    // Prefer the earliest unclaimed layers, picking the closest of the first few.
    const pool = free.slice(0, 3);
    pool.sort((a, b) => {
      const ra = pageRect(a.el), rb = pageRect(b.el);
      return Math.hypot(ra.x - agent.x, ra.y - agent.y) - Math.hypot(rb.x - agent.x, rb.y - agent.y);
    });
    pool[0].agent = agent;
    return pool[0];
  }

  async function work(agent, job) {
    agent.busy = true;
    updatePill();
    const el = job.el;
    const corner = () => { const r = pageRect(el); return [r.x, r.y]; };
    const [cx, cy] = corner();
    await moveTo(agent, corner, travelTime(agent, cx, cy));
    if (!active) return;

    // Drag a selection box from the top-left corner to the bottom-right.
    const node = make('div', 'swc-box', layer);
    node.style.borderColor = agent.color;
    ['a', 'b', 'c', 'd'].forEach(k => { make('span', 'swc-h ' + k, node).style.borderColor = agent.color; });
    const dim = make('span', 'swc-dim', node);
    dim.style.background = agent.color;
    agent.box = { el, node, dim, p: 0 };
    job.ghost.style.opacity = '0';

    await tween(rand(380, 620), p => { agent.box.p = easeOut(p); });
    if (!active) return;
    reveal(el);
    await wait(rand(220, 420));
    if (!active) return;

    node.classList.add('out');
    fading.push({ ...agent.box, until: performance.now() + 500 });
    agent.box = null;
    agent.busy = false;
    agent.idleSince = performance.now();
    finishJob(job);
  }

  async function idle(agent) {
    const hasWork = () => queue.some(j => !j.agent) || !active;
    const idleFor = performance.now() - agent.idleSince;
    let vx, vy, dur;
    if (idleFor > 2500 || built === targets.length) {
      // Park near the status pill while there's nothing to build.
      const spread = small ? 26 : 34;
      vx = innerWidth / 2 + (agent.i - (agentCount - 1) / 2) * spread;
      vy = innerHeight - (small ? 104 : 112) + (agent.i % 2) * 8;
      dur = 900;
    } else {
      vx = rand(innerWidth * .15, innerWidth * .85);
      vy = rand(innerHeight * .2, innerHeight * .8);
      dur = rand(700, 1300);
    }
    const target = () => [vx + scrollX, vy + scrollY];
    const moved = await moveTo(agent, target, dur, hasWork);
    if (moved) await wait(rand(250, 700), hasWork);
  }

  async function runAgent(agent) {
    await wait(agent.i * 90);
    while (active) {
      const job = takeJob(agent);
      if (job) await work(agent, job);
      else await idle(agent);
    }
  }

  /* ---------------- render loop ---------------- */
  function placeBox(node, dim, r, p) {
    const w = Math.max(1, r.w * p), h = Math.max(1, r.h * p);
    node.style.transform = `translate(${r.x - scrollX}px,${r.y - scrollY}px)`;
    node.style.width = w + 'px';
    node.style.height = h + 'px';
    if (dim) dim.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  }

  function render() {
    if (!active) return;
    const now = performance.now();
    scanViewport(now);

    for (const job of jobs.values()) {
      const r = pageRect(job.el);
      placeBox(job.ghost, null, r, 1);
      // Safety net: never leave content hidden for long if agents are busy.
      if (!job.agent && now - job.since > 5000) { reveal(job.el, false); finishJob(job); }
    }

    for (const a of agents) {
      if (a.box) {
        const r = pageRect(a.box.el);
        placeBox(a.box.node, a.box.dim, r, a.box.p);
        a.x = r.x + r.w * a.box.p;
        a.y = r.y + r.h * a.box.p;
      }
      a.node.style.transform = `translate(${a.x - scrollX}px,${a.y - scrollY}px)`;
    }

    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      if (now > f.until) { f.node.remove(); fading.splice(i, 1); continue; }
      placeBox(f.node, f.dim, pageRect(f.el), 1);
    }

    requestAnimationFrame(render);
  }

  /* ---------------- status pill ---------------- */
  function buildPill() {
    pill = make('div', 'swc-pill', document.body);
    pill.setAttribute('role', 'status');
    const d = make('span', 'swc-dots', pill);
    dots = agents.map(a => { const s = make('span', 'swc-dot', d); s.style.background = a.color; s.style.color = a.color; return s; });
    pillText = make('span', '', pill);
    const bar = make('span', 'swc-bar', pill);
    pillBar = make('i', '', bar);
    const replay = make('button', 'swc-btn', pill);
    replay.type = 'button';
    replay.textContent = '↻';
    replay.title = 'Replay the build';
    replay.setAttribute('aria-label', 'Replay the build');
    replay.addEventListener('click', replayBuild);
    const close = make('button', 'swc-btn', pill);
    close.type = 'button';
    close.textContent = '×';
    close.title = 'Hide the swarm';
    close.setAttribute('aria-label', 'Hide the swarm and show the page');
    close.addEventListener('click', dismiss);
    updatePill();
  }

  let hideTimer;
  function updatePill() {
    if (!pill) return;
    const total = targets.length;
    const done = built >= total;
    pillText.textContent = done
      ? `build complete · ${total} layers`
      : `${agents.length} agents · ${built} / ${total} layers`;
    pillBar.style.width = (total ? (built / total) * 100 : 100) + '%';
    agents.forEach((a, i) => dots[i] && dots[i].classList.toggle('on', a.busy));
    clearTimeout(hideTimer);
    pill.classList.remove('hide');
    if (done) hideTimer = setTimeout(() => { pill.classList.add('hide'); agents.forEach(a => { a.node.style.opacity = '0'; }); }, 3500);
    else agents.forEach(a => { a.node.style.opacity = '1'; });
  }

  /* ---------------- controls ---------------- */
  // Check the viewport directly on each frame (cheap for a few dozen layers).
  let lastScan = 0;
  function scanViewport(now) {
    if (now - lastScan < 120) return;
    lastScan = now;
    const vh = innerHeight;
    for (const el of targets) {
      if (!el.classList.contains('swc-pending') || jobs.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visible > Math.min(80, r.height * .5)) enqueue(el);
    }
  }

  function replayBuild() {
    for (const job of jobs.values()) job.ghost.remove();
    jobs.clear();
    queue = [];
    agents.forEach(a => { if (a.box) { a.box.node.remove(); a.box = null; } });
    targets = collectTargets();
    targets.forEach(el => el.classList.add('swc-pending'));
    built = 0;
    // Restart agents so in-flight jobs from the previous run are dropped.
    active = false;
    requestAnimationFrame(() => {
      active = true;
      agents.forEach(a => { a.busy = false; a.idleSince = performance.now(); runAgent(a); });
      lastScan = 0;
      updatePill();
      render();
    });
  }

  function dismiss() {
    active = false;
    targets.forEach(el => reveal(el, true));
    if (layer) layer.remove();
    if (pill) pill.remove();
    document.querySelectorAll('.swc-pending').forEach(el => el.classList.remove('swc-pending'));
  }

  /* ---------------- boot ---------------- */
  function whenReady(cb) {
    const sel = opts.startAfter;
    const gate = sel ? document.querySelector(sel) : null;
    if (!gate) return cb();
    const t0 = performance.now();
    const check = () => {
      const ready = gate.classList.contains('done') || getComputedStyle(gate).display === 'none' || !gate.isConnected;
      if (ready || performance.now() - t0 > 9000) cb(); else setTimeout(check, 100);
    };
    check();
  }

  function boot() {
    targets = collectTargets();
    if (!targets.length) return;
    try {
      const style = make('style', '', document.head);
      style.textContent = css;
      // Hide layers straight away (behind any loader) so nothing flashes in early.
      targets.forEach(el => el.classList.add('swc-pending'));

      whenReady(() => {
        try {
          layer = make('div', 'swc-layer', document.body);
          layer.setAttribute('aria-hidden', 'true');
          for (let i = 0; i < agentCount; i++) agents.push(createAgent(ROSTER[i], i));
          buildPill();
          render();
          agents.forEach(runAgent);
        } catch (err) { dismiss(); }
      });
    } catch (err) {
      dismiss();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
