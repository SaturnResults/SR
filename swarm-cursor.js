/*!
 * Swarm Cursor — Saturn Results
 * A swarm of labelled "agent" cursors that appear to assemble the page in
 * front of the visitor: each agent flies to an element, drags a selection box
 * over it and the element materialises inside the box.
 *
 * Usage:  <script src="swarm-cursor.js" defer></script>
 * Options (data attributes on the script tag):
 *   data-mode="demo"                showcase mode: "Start Build" button, more layers
 *                                   (frames first, headings word by word), build log,
 *                                   guides, sparks, timer and auto-scroll
 *   data-targets="h1, h2, .card"    CSS selector for the layers the swarm builds
 *   data-start-after="#loader"      wait until this element has class "done"
 *   data-agents="7"                 number of agents (default 7, or 22 in demo mode)
 *   data-words=".hero h1"           headings to build word by word (demo mode)
 *   data-speed="1"                  demo pace multiplier (higher is faster)
 * Disable with ?swarm=off in the URL. Skipped entirely for prefers-reduced-motion
 * (except in demo mode, which only runs when someone presses Start Build).
 */
(() => {
  'use strict';

  const script = document.currentScript;
  const opts = (script && script.dataset) || {};
  const demo = opts.mode === 'demo';
  if (new URLSearchParams(location.search).get('swarm') === 'off') return;
  if (!demo && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DEFAULT_TARGETS = [
    '.nav__brand', '.nav__links a', '.nav__cta',
    '.hero__eyebrow', '.hero h1', '.hero__sub', '.hero__meta',
    '.section__num', '.section__title', '.section__kicker',
    '.project', '.service',
    '.cta h2', '.cta__btn',
    '.footer-inner h3', '.footer-inner p', '.footer-meta'
  ].join(',');

  // Demo mode builds containers first, then their contents, then words.
  const DEMO_TARGETS = [
    '.nav__brand', '.nav__links a', '.nav__cta',
    '.hero__eyebrow', '.hero h1', '.hero__sub', '.hero__meta > div',
    '.marquee',
    '.section__head', '.section__num', '.section__title', '.section__kicker',
    '.project', '.project .chip', '.project__num', '.project__title', '.project__tag', '.project__year', '.project__link',
    '.services', '.service', '.service__icon', '.service h3', '.service p',
    '.cta h2', '.cta__btn',
    '.footer-inner h3', '.footer-inner p', '.footer-meta > div',
    '.swc-word'
  ].join(',');
  const WORD_SPLIT = opts.words || '.hero h1, .hero__sub, .section__title, .cta h2, .footer-inner h3';

  const NAMES = ['Layout', 'Type', 'Grid', 'Motion', 'Copy', 'Colour', 'A11y', 'SEO', 'Spacing', 'Icons',
    'Brand', 'Kerning', 'Shadows', 'Links', 'Perf', 'Tokens', 'Contrast', 'Responsive', 'Images', 'Nav', '3D', 'QA',
    'Pricing', 'Forms', 'Chat', 'Analytics', 'Ads', 'Booking', 'Social', 'Deploy'];
  const COLOURS = ['#4d7cff', '#ff5fa2', '#2fd18b', '#ffb020', '#b388ff', '#22d3ee', '#ff7a3d', '#a3e635',
    '#f472b6', '#60a5fa', '#facc15', '#34d399', '#c084fc', '#fb7185', '#38bdf8', '#fdba74'];
  const ROSTER = NAMES.map((name, i) => ({ name, color: COLOURS[i % COLOURS.length] }));

  const small = innerWidth < 780;
  const agentCount = Math.max(1, Math.min(ROSTER.length,
    parseInt(opts.agents, 10) || (demo ? (small ? 10 : 22) : (small ? 4 : 7))));
  const SPEED = demo ? 0.8 / (parseFloat(opts.speed) || 1) : 1;

  /* ---------------- styles ---------------- */
  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const css = `
  .swc-pending{visibility:hidden}
  .swc-word{display:inline-block}
  .swc-layer{position:fixed;inset:0;pointer-events:none;z-index:9600;overflow:hidden}
  .swc-grid{position:absolute;inset:0;opacity:0;transition:opacity 1.2s;background-image:linear-gradient(rgba(120,140,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(120,140,255,.07) 1px,transparent 1px);background-size:48px 48px}
  .swc-grid.on{opacity:1}
  .swc-agent{position:absolute;left:0;top:0;will-change:transform;transition:opacity .5s}
  .swc-agent svg{display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))}
  .swc-tag{position:absolute;left:16px;top:18px;padding:2px 7px;border-radius:4px;font:600 10px/1.5 ${mono};letter-spacing:.04em;color:#0a0a12;white-space:nowrap}
  .swc-box{position:absolute;left:0;top:0;border:1.5px solid;box-sizing:border-box;transition:opacity .45s}
  .swc-box.out{opacity:0}
  .swc-h{position:absolute;width:7px;height:7px;background:#fff;border:1.5px solid;box-sizing:border-box}
  .swc-h.a{left:-4px;top:-4px}.swc-h.b{right:-4px;top:-4px}.swc-h.c{left:-4px;bottom:-4px}.swc-h.d{right:-4px;bottom:-4px}
  .swc-dim{position:absolute;right:-2px;bottom:-22px;padding:1px 6px;border-radius:3px;font:600 9px/1.6 ${mono};color:#0a0a12;white-space:nowrap}
  .swc-ghost{position:absolute;left:0;top:0;border:1px dashed rgba(170,190,255,.28);border-radius:2px;box-sizing:border-box;background:rgba(120,140,255,.03);transition:opacity .3s}
  .swc-ghost.solid{border:1px solid rgba(110,150,255,.6);border-radius:3px;background:linear-gradient(180deg,rgba(205,210,225,.22),rgba(170,178,198,.16));box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
  .swc-guide{position:absolute;left:0;top:0;opacity:0;transition:opacity .25s}
  .swc-guide.on{opacity:.45}
  .swc-guide.h{width:100%;height:0;border-top:1px dashed}
  .swc-guide.v{height:100%;width:0;border-left:1px dashed}
  .swc-spark{position:absolute;left:0;top:0;width:4px;height:4px;border-radius:50%;transition:transform .55s cubic-bezier(.1,.8,.3,1),opacity .55s}
  .swc-pill{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9601;display:flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;border-radius:999px;background:rgba(14,12,24,.82);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:500 11px/1 ${mono};color:#d9d4ef;box-shadow:0 8px 30px rgba(0,0,0,.45);transition:opacity .6s,transform .6s;white-space:nowrap;font-variant-numeric:tabular-nums}
  .swc-pill.hide{opacity:0;transform:translate(-50%,16px);pointer-events:none}
  .swc-dots{display:flex;gap:3px;flex-wrap:wrap;max-width:140px}
  .swc-dot{width:6px;height:6px;border-radius:50%;opacity:.4;transition:opacity .2s}
  .swc-dot.on{opacity:1;box-shadow:0 0 8px currentColor}
  .swc-bar{width:64px;height:3px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
  .swc-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4d7cff,#b388ff,#ff5fa2);transition:width .3s}
  .swc-btn{all:unset;cursor:pointer;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;font:inherit}
  .swc-btn:hover{background:rgba(255,255,255,.18)}
  .swc-btn:focus-visible{outline:2px solid #b388ff;outline-offset:2px}
  .swc-log{position:fixed;left:18px;bottom:18px;z-index:9601;width:340px;padding:10px 12px;border-radius:10px;background:rgba(10,8,18,.78);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:500 10.5px/1.65 ${mono};color:#bdb5d8;transition:opacity .6s}
  .swc-log.hide{opacity:0}
  .swc-log__head{display:flex;justify-content:space-between;color:#7e7598;font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px}
  .swc-log__head b{color:#2fd18b;font-weight:600}
  .swc-log__row{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:swc-in .25s ease-out}
  .swc-log__row i{font-style:normal;color:#6c6487}
  .swc-log__row s{text-decoration:none;font-weight:700}
  @keyframes swc-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  .swc-start{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:radial-gradient(ellipse at center,rgba(26,12,52,.55),rgba(5,3,8,.94) 70%);transition:opacity .7s,visibility .7s}
  .swc-start.out{opacity:0;visibility:hidden}
  .swc-start__kicker{font:500 11px/1 ${mono};letter-spacing:.38em;text-transform:uppercase;color:#9b8fb5}
  .swc-start__btn{all:unset;position:relative;isolation:isolate;overflow:hidden;cursor:pointer;padding:22px 52px;border-radius:999px;font:600 22px/1 'Space Grotesk',system-ui,sans-serif;letter-spacing:.01em;color:#fff;box-shadow:0 0 50px rgba(122,60,255,.45),0 0 120px rgba(122,60,255,.2);animation:swc-pulse 2.4s ease-in-out infinite;transition:transform .2s}
  .swc-start__btn:hover{transform:scale(1.04)}
  .swc-start__btn:focus-visible{outline:2px solid #fff;outline-offset:4px}
  .swc-start__btn::before{content:"";position:absolute;left:50%;top:50%;width:420px;height:420px;margin:-210px 0 0 -210px;background:conic-gradient(#4d7cff,#b388ff,#ff5fa2,#ffb020,#2fd18b,#22d3ee,#4d7cff);animation:swc-spin 3s linear infinite;z-index:-2}
  .swc-start__btn::after{content:"";position:absolute;inset:2px;border-radius:inherit;background:linear-gradient(180deg,#140b26,#0b0714);z-index:-1}
  .swc-start__btn span{display:inline-flex;align-items:center;gap:12px}
  .swc-start__btn em{font-style:normal;display:inline-block;width:9px;height:9px;border-radius:50%;background:#2fd18b;box-shadow:0 0 12px #2fd18b}
  .swc-start__meta{font:500 11px/1 ${mono};color:#7e7598;letter-spacing:.06em}
  .swc-toast{position:fixed;left:50%;top:50%;z-index:9602;transform:translate(-50%,-50%) scale(.9);padding:18px 30px;border-radius:16px;background:rgba(10,8,18,.86);border:1px solid rgba(47,209,139,.45);box-shadow:0 0 60px rgba(47,209,139,.25);font:600 20px/1.3 'Space Grotesk',system-ui,sans-serif;color:#fff;text-align:center;opacity:0;transition:opacity .5s,transform .5s;pointer-events:none}
  .swc-toast.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
  .swc-toast small{display:block;margin-top:6px;font:500 11px/1 ${mono};color:#9b8fb5;letter-spacing:.08em}
  @keyframes swc-spin{to{transform:rotate(360deg)}}
  @keyframes swc-pulse{50%{box-shadow:0 0 70px rgba(122,60,255,.7),0 0 160px rgba(122,60,255,.3)}}
  @media (max-width:780px){.swc-log{display:none}}
  @media (max-width:520px){.swc-bar{display:none}.swc-pill{gap:8px;padding-left:10px}.swc-dots{max-width:70px}}
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
  const fmtTime = ms => {
    const s = Math.max(0, ms) / 1000;
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + (s % 60).toFixed(1).padStart(4, '0');
  };

  let alive = true;          // false once dismissed
  let active = false;        // agents are allowed to work
  let started = !demo;       // demo waits for the Start Build button
  let complete = false;
  let autopilot = demo;
  let startTime = 0, endTime = 0;
  let layer, grid, pill, pillText, pillBar, dots = [], logBox, logRows, startScreen, startMeta, toast;
  let targets = [];
  let queue = [];
  const jobs = new Map();
  const fading = [];
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
  function splitWords(root) {
    if (root.querySelector('.swc-word')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      if (!n.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
        else { const s = make('span', 'swc-word'); s.textContent = part; frag.appendChild(s); }
      });
      n.parentNode.replaceChild(frag, n);
    });
  }

  function collectTargets() {
    if (demo) document.querySelectorAll(WORD_SPLIT).forEach(splitWords);
    let list;
    try { list = Array.from(document.querySelectorAll(opts.targets || (demo ? DEMO_TARGETS : DEFAULT_TARGETS))); }
    catch (e) { list = []; }
    // Outside demo mode, drop nested matches so a layer is only built once.
    if (!demo) list = list.filter(el => !list.some(o => o !== el && o.contains(el)));
    return list.filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; });
  }

  // A layer can only be built once everything it sits inside has been built.
  const eligible = el => !(el.parentElement && el.parentElement.closest('.swc-pending'));

  function reveal(el, instant) {
    if (!el.classList.contains('swc-pending')) return;
    el.classList.remove('swc-pending');
    if (!instant && el.animate) {
      el.animate(
        [{ clipPath: 'inset(0 100% 100% 0)' }, { clipPath: 'inset(0 0% 0% 0)' }],
        { duration: demo ? 520 : 650, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    }
  }

  function enqueue(el) {
    if (jobs.has(el) || !el.classList.contains('swc-pending')) return;
    const ghost = make('div', demo ? 'swc-ghost solid' : 'swc-ghost', layer);
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
    if (built >= targets.length && !complete) onComplete();
  }

  let lastScan = 0;
  function scanViewport(now) {
    if (now - lastScan < 100) return;
    lastScan = now;
    const vh = innerHeight;
    for (const el of targets) {
      if (!el.classList.contains('swc-pending') || jobs.has(el) || !eligible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      if (visible > Math.min(80, r.height * .5)) enqueue(el);
    }
  }

  /* ---------------- build log ---------------- */
  function describe(el) {
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    const s = t.length > 24 ? t.slice(0, 23) + '…' : t;
    const c = el.classList;
    if (c.contains('swc-word')) return `set type "${s}"`;
    if (c.contains('project')) return 'framed project card';
    if (c.contains('chip') && !t) return 'painted gradient orb';
    if (c.contains('marquee')) return 'started marquee';
    if (c.contains('services')) return 'laid out services grid';
    if (c.contains('section__head')) return 'blocked out section header';
    if (c.contains('service__icon')) return 'drew icon';
    if (c.contains('project__num')) return `numbered card ${s}`;
    if (c.contains('project__title')) return `set title "${s}"`;
    if (c.contains('project__tag')) return `tagged "${s}"`;
    if (c.contains('project__year')) return `stamped year ${s}`;
    if (c.contains('project__link')) return 'wired "View case" CTA';
    if (c.contains('service')) return 'framed service card';
    if (c.contains('nav__brand')) return 'placed logo';
    if (c.contains('wcard')) return 'framed case study';
    if (c.contains('deck')) return 'stacked service deck';
    if (c.contains('plan')) return 'built pricing tier';
    if (c.contains('plan__price')) return `set price ${s}`;
    if (c.contains('bub')) return 'wrote chat bubble';
    if (c.contains('chip')) return `added badge "${s}"`;
    if (c.contains('btn') || el.tagName === 'BUTTON') return `wired button "${s}"`;
    if (el.tagName === 'LI') return `ticked "${s}"`;
    if (!t && el.querySelector('img') || el.tagName === 'IMG' || el.tagName === 'PICTURE') return 'placed image';
    if (el.tagName === 'A') return `wired link "${s}"`;
    if (/^H[1-6]$/.test(el.tagName)) return 'placed heading frame';
    if (el.tagName === 'P') return `wrote copy "${s}"`;
    return s ? `built "${s}"` : 'built layer';
  }

  function log(agent, el, w, h) {
    if (!logRows) return;
    const row = make('div', 'swc-log__row');
    const time = make('i', '', row); time.textContent = fmtTime(performance.now() - startTime) + ' ';
    const who = make('s', '', row); who.textContent = agent.name.padEnd(10, ' ');
    who.style.color = agent.color;
    row.appendChild(document.createTextNode(`${describe(el)} · ${Math.round(w)}×${Math.round(h)}`));
    logRows.appendChild(row);
    while (logRows.children.length > 8) logRows.firstChild.remove();
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
    const side = i % 4;
    const vx = side === 0 ? -40 : side === 1 ? innerWidth + 40 : rand(0, innerWidth);
    const vy = side === 2 ? -40 : side === 3 ? innerHeight + 40 : rand(0, innerHeight);
    const a = { ...def, i, node, x: vx + scrollX, y: vy + scrollY, box: null, busy: false, idleSince: performance.now() };
    if (demo) {
      a.gh = make('div', 'swc-guide h', layer); a.gh.style.borderColor = def.color;
      a.gv = make('div', 'swc-guide v', layer); a.gv.style.borderColor = def.color;
    }
    return a;
  }

  function moveTo(agent, target, dur, abort) {
    const x0 = agent.x, y0 = agent.y;
    const [tx0, ty0] = target();
    const dist = Math.hypot(tx0 - x0, ty0 - y0) || 1;
    const bend = rand(-.28, .28) * Math.min(dist, 500);
    const nx = -(ty0 - y0) / dist, ny = (tx0 - x0) / dist;
    return tween(dur, p => {
      const [tx, ty] = target();
      const e = easeInOut(p);
      const cx = (x0 + tx) / 2 + nx * bend, cy = (y0 + ty) / 2 + ny * bend;
      const u = 1 - e;
      agent.x = u * u * x0 + 2 * u * e * cx + e * e * tx;
      agent.y = u * u * y0 + 2 * u * e * cy + e * e * ty;
    }, abort);
  }
  const travelTime = (agent, x, y) => SPEED * Math.min(1100, 380 + Math.hypot(x - agent.x, y - agent.y) * .5);

  function takeJob(agent) {
    const free = queue.filter(j => !j.agent);
    if (!free.length) return null;
    const pool = free.slice(0, demo ? 6 : 3);
    pool.sort((a, b) => {
      const ra = pageRect(a.el), rb = pageRect(b.el);
      return Math.hypot(ra.x - agent.x, ra.y - agent.y) - Math.hypot(rb.x - agent.x, rb.y - agent.y);
    });
    pool[0].agent = agent;
    return pool[0];
  }

  function sparks(x, y, color) {
    for (let k = 0; k < 9; k++) {
      const s = make('div', 'swc-spark', layer);
      s.style.background = color;
      s.style.boxShadow = `0 0 6px ${color}`;
      s.style.transform = `translate(${x - scrollX}px,${y - scrollY}px)`;
      const ang = rand(0, Math.PI * 2), d = rand(18, 54);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        s.style.transform = `translate(${x - scrollX + Math.cos(ang) * d}px,${y - scrollY + Math.sin(ang) * d}px) scale(.4)`;
        s.style.opacity = '0';
      }));
      setTimeout(() => s.remove(), 650);
    }
  }

  async function work(agent, job) {
    agent.busy = true;
    agent.job = job;
    updatePill();
    const el = job.el;
    const corner = () => { const r = pageRect(el); return [r.x, r.y]; };
    const [cx, cy] = corner();
    await moveTo(agent, corner, travelTime(agent, cx, cy));
    if (!active) return;

    const node = make('div', 'swc-box', layer);
    node.style.borderColor = agent.color;
    ['a', 'b', 'c', 'd'].forEach(k => { make('span', 'swc-h ' + k, node).style.borderColor = agent.color; });
    const dim = make('span', 'swc-dim', node);
    dim.style.background = agent.color;
    agent.box = { el, node, dim, p: 0 };
    job.ghost.style.opacity = '0';
    if (agent.gh) { agent.gh.classList.add('on'); agent.gv.classList.add('on'); }

    await tween(SPEED * rand(380, 620), p => { agent.box.p = easeOut(p); });
    if (!active) return;
    reveal(el);
    const r = pageRect(el);
    if (demo) { sparks(r.x + r.w, r.y + r.h, agent.color); log(agent, el, r.w, r.h); }
    if (agent.gh) { agent.gh.classList.remove('on'); agent.gv.classList.remove('on'); }
    await wait(SPEED * rand(200, 400));
    if (!active) return;

    node.classList.add('out');
    fading.push({ ...agent.box, until: performance.now() + 500 });
    agent.box = null;
    agent.busy = false;
    agent.job = null;
    agent.idleSince = performance.now();
    finishJob(job);
  }

  async function idle(agent) {
    const hasWork = () => queue.some(j => !j.agent) || !active;
    const idleFor = performance.now() - agent.idleSince;
    let vx, vy, dur;
    if (idleFor > 2500 || complete) {
      // Park in a loose cluster above the status pill.
      const perRow = small ? 8 : 11;
      const spread = small ? 30 : 36;
      const col = agent.i % perRow, row = Math.floor(agent.i / perRow);
      vx = innerWidth / 2 + (col - (perRow - 1) / 2) * spread;
      vy = innerHeight - (small ? 104 : 118) - row * 30 + (col % 2) * 8;
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
    await wait(agent.i * (demo ? 35 : 90));
    while (active) {
      const job = takeJob(agent);
      if (job) await work(agent, job);
      else await idle(agent);
    }
  }

  /* ---------------- autopilot scrolling (demo) ---------------- */
  let scrolling = false;
  function smoothScrollTo(y, dur) {
    const max = document.documentElement.scrollHeight - innerHeight;
    y = Math.max(0, Math.min(max, y));
    const y0 = scrollY;
    if (Math.abs(y - y0) < 4) return;
    scrolling = true;
    const t0 = performance.now();
    const step = now => {
      if (!autopilot || !alive) { scrolling = false; return; }
      const p = Math.min(1, (now - t0) / dur);
      window.scrollTo({ top: y0 + (y - y0) * easeInOut(p), behavior: 'instant' });
      if (p < 1) requestAnimationFrame(step); else scrolling = false;
    };
    requestAnimationFrame(step);
  }

  let lastAutoCheck = 0;
  function autopilotTick(now) {
    if (!autopilot || scrolling || complete || !started || now - lastAutoCheck < 350) return;
    lastAutoCheck = now;
    if (queue.some(j => !j.agent)) return;
    const busy = agents.filter(a => a.busy).length;
    if (busy > Math.ceil(agentCount * .3)) return;
    // Hold the camera while a frame is going up whose contents come next.
    if (agents.some(a => a.job && a.job.el.querySelector('.swc-pending'))) return;
    const next = targets.find(el => el.classList.contains('swc-pending') && !jobs.has(el) && eligible(el));
    if (!next) return;
    const r = next.getBoundingClientRect();
    const dy = Math.min(r.top - innerHeight * .3, innerHeight * .7);
    smoothScrollTo(scrollY + dy, Math.max(1200, Math.min(2600, Math.abs(dy) * 2.4 * SPEED)));
  }

  function stopAutopilot(e) {
    if (e && e.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) return;
    autopilot = false;
  }

  /* ---------------- render loop ---------------- */
  function placeBox(node, dim, r, p) {
    const w = Math.max(1, r.w * p), h = Math.max(1, r.h * p);
    node.style.transform = `translate(${r.x - scrollX}px,${r.y - scrollY}px)`;
    node.style.width = w + 'px';
    node.style.height = h + 'px';
    if (dim) dim.textContent = `${Math.round(w)} × ${Math.round(h)}`;
  }

  let lastPill = 0;
  function render() {
    if (!alive) return;
    const now = performance.now();

    if (!started) {
      // Agents orbit the Start Build button while waiting.
      const btn = startScreen && startScreen.querySelector('.swc-start__btn');
      const br = btn ? btn.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
      const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      const rx = Math.min(innerWidth * .42, small ? 160 : 330), ry = Math.min(innerHeight * .36, small ? 190 : 210);
      agents.forEach((a, i) => {
        const ang = (i / agents.length) * Math.PI * 2 + now * .00022;
        const wob = Math.sin(now * .002 + i * 1.7) * 10;
        a.x = cx + Math.cos(ang) * (rx + wob) + scrollX;
        a.y = cy + Math.sin(ang) * (ry + wob) + scrollY;
      });
    } else {
      scanViewport(now);
      autopilotTick(now);
    }

    for (const job of jobs.values()) {
      placeBox(job.ghost, null, pageRect(job.el), 1);
      if (!job.agent && now - job.since > (demo ? 9000 : 5000)) { reveal(job.el, false); finishJob(job); }
    }

    for (const a of agents) {
      if (a.box) {
        const r = pageRect(a.box.el);
        placeBox(a.box.node, a.box.dim, r, a.box.p);
        a.x = r.x + r.w * a.box.p;
        a.y = r.y + r.h * a.box.p;
      }
      const vx = a.x - scrollX, vy = a.y - scrollY;
      a.node.style.transform = `translate(${vx}px,${vy}px)`;
      if (a.gh) {
        a.gh.style.transform = `translateY(${vy}px)`;
        a.gv.style.transform = `translateX(${vx}px)`;
      }
    }

    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      if (now > f.until) { f.node.remove(); fading.splice(i, 1); continue; }
      placeBox(f.node, f.dim, pageRect(f.el), 1);
    }

    if (grid) grid.style.backgroundPosition = `${-scrollX}px ${-scrollY}px`;
    if (demo && started && !complete && now - lastPill > 100) { lastPill = now; updatePill(); }

    requestAnimationFrame(render);
  }

  /* ---------------- UI ---------------- */
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
    if (demo && !started) pill.classList.add('hide');
    updatePill();
  }

  function buildLog() {
    logBox = make('div', 'swc-log hide', document.body);
    logBox.setAttribute('aria-hidden', 'true');
    const head = make('div', 'swc-log__head', logBox);
    head.innerHTML = '<span>build log</span><b>● live</b>';
    logRows = make('div', '', logBox);
  }

  function buildStartScreen() {
    startScreen = make('div', 'swc-start', document.body);
    const kicker = make('div', 'swc-start__kicker', startScreen);
    kicker.textContent = 'Saturn Results · Build system';
    const btn = make('button', 'swc-start__btn', startScreen);
    btn.type = 'button';
    btn.innerHTML = '<span><em></em>Start Build</span>';
    btn.addEventListener('click', startBuild);
    startMeta = make('div', 'swc-start__meta', startScreen);
    startMeta.textContent = `${agents.length} agents ready · ${targets.length} layers queued`;
    setTimeout(() => btn.focus({ preventScroll: true }), 50);
    // Enter or Space starts the build whenever the start screen is showing.
    addEventListener('keydown', e => {
      if (started || !alive || startScreen.classList.contains('out')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startBuild(); }
    });
  }

  let hideTimer;
  function updatePill() {
    if (!pill) return;
    const total = targets.length;
    const done = built >= total;
    const time = demo && started ? ' · ' + fmtTime((complete ? endTime : performance.now()) - startTime) : '';
    pillText.textContent = done
      ? `build complete · ${total} layers${time}`
      : `${agents.length} agents · ${built} / ${total} layers${time}`;
    pillBar.style.width = (total ? (built / total) * 100 : 100) + '%';
    agents.forEach((a, i) => dots[i] && dots[i].classList.toggle('on', a.busy));
    if (!demo) {
      clearTimeout(hideTimer);
      pill.classList.remove('hide');
      if (done) hideTimer = setTimeout(() => { pill.classList.add('hide'); agents.forEach(a => { a.node.style.opacity = '0'; }); }, 3500);
      else agents.forEach(a => { a.node.style.opacity = '1'; });
    }
  }

  function onComplete() {
    complete = true;
    endTime = performance.now();
    updatePill();
    if (!demo) return;
    if (grid) grid.classList.remove('on');
    toast.innerHTML = `✓ Build complete<small>${targets.length} layers · ${agents.length} agents · ${fmtTime(endTime - startTime)}</small>`;
    toast.classList.add('on');
    setTimeout(() => toast.classList.remove('on'), 2600);
    setTimeout(() => {
      if (autopilot) smoothScrollTo(0, 2200);
      agents.forEach(a => { a.node.style.opacity = '0'; });
      if (logBox) logBox.classList.add('hide');
    }, 2200);
  }

  /* ---------------- controls ---------------- */
  function startBuild() {
    if (started) return;
    started = true;
    complete = false;
    autopilot = true;
    startTime = performance.now();
    window.scrollTo({ top: 0, behavior: 'instant' });
    startScreen.classList.add('out');
    pill.classList.remove('hide');
    logBox.classList.remove('hide');
    grid.classList.add('on');
    agents.forEach(a => { a.node.style.opacity = '1'; a.idleSince = performance.now(); });
    active = true;
    agents.forEach(runAgent);
  }

  function resetLayers() {
    for (const job of jobs.values()) job.ghost.remove();
    jobs.clear();
    queue = [];
    agents.forEach(a => {
      if (a.box) { a.box.node.remove(); a.box = null; }
      if (a.gh) { a.gh.classList.remove('on'); a.gv.classList.remove('on'); }
      a.busy = false;
      a.job = null;
      a.idleSince = performance.now();
    });
    targets = collectTargets();
    targets.forEach(el => el.classList.add('swc-pending'));
    built = 0;
    complete = false;
    lastScan = 0;
    if (logRows) logRows.textContent = '';
  }

  function replayBuild() {
    active = false;           // stops in-flight agent work on the next frame
    requestAnimationFrame(() => requestAnimationFrame(() => {
      resetLayers();
      if (demo) {
        started = false;
        autopilot = false;
        window.scrollTo({ top: 0, behavior: 'instant' });
        pill.classList.add('hide');
        logBox.classList.add('hide');
        grid.classList.remove('on');
        toast.classList.remove('on');
        agents.forEach(a => { a.node.style.opacity = '1'; });
        startMeta.textContent = `${agents.length} agents ready · ${targets.length} layers queued`;
        startScreen.classList.remove('out');
        updatePill();
        return;
      }
      active = true;
      agents.forEach(runAgent);
      updatePill();
    }));
  }

  function dismiss() {
    alive = false;
    active = false;
    autopilot = false;
    targets.forEach(el => reveal(el, true));
    [layer, pill, logBox, startScreen, toast].forEach(n => n && n.remove());
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
    try {
      const style = make('style', '', document.head);
      style.textContent = css;
      targets = collectTargets();
      if (!targets.length) return;
      // Hide layers straight away (behind any loader) so nothing flashes in early.
      targets.forEach(el => el.classList.add('swc-pending'));

      whenReady(() => {
        try {
          layer = make('div', 'swc-layer', document.body);
          layer.setAttribute('aria-hidden', 'true');
          if (demo) grid = make('div', 'swc-grid', layer);
          for (let i = 0; i < agentCount; i++) agents.push(createAgent(ROSTER[i], i));
          buildPill();
          if (demo) {
            buildLog();
            toast = make('div', 'swc-toast', document.body);
            buildStartScreen();
            ['wheel', 'touchmove', 'keydown'].forEach(t => addEventListener(t, stopAutopilot, { passive: true }));
          } else {
            active = true;
            agents.forEach(runAgent);
          }
          render();
        } catch (err) { dismiss(); }
      });
    } catch (err) {
      dismiss();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
