// Nexus frontend: Agent, Graph and MCP views. Plain JavaScript, no build step.
// Libraries (index.html): ForceGraph (maps), marked (markdown), DOMPurify (safe HTML).
//
// The Agent view listens to the agent's live event stream and turns it into a "journey":
//   model -> a reasoning station      think -> its summary text
//   tool  -> a numbered tool station  node  -> an entity it touched (stamped on the map, route drawn)
//   tool_done -> the station's duration and a preview of what the tool returned

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const markdown = (text) => DOMPurify.sanitize(marked.parse(text || ''));
const api = (path, opts) => fetch(path, opts).then((r) => r.json());
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// One line colour per entity type, like the lines of a transit map.
const LINES = {
  service: { c: '#2f6bff', name: 'Services' },
  team: { c: '#ffc20e', name: 'Teams', dark: true },
  person: { c: '#e21d2d', name: 'People' },
  standard: { c: '#22b14c', name: 'Standards', dark: true },
  tool: { c: '#a274ef', name: 'Tools', dark: true },
  guide: { c: '#19b5b0', name: 'Guides', dark: true },
};
const lineOf = (type) => LINES[type] || { c: '#8e98bb', name: type };
const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// ── Shared graph data ────────────────────────────────────────────────────────────────────────────
let data = { nodes: [], links: [] };
let byId = {};
let degree = {};

const label = (slug) => byId[slug]?.label || slug;
const pred = (p) => p.replace(/([a-z])([A-Z])/g, '$1 $2'); // "dependsOn" -> "depends On" (shown in caps)
const stopChip = (slug, num) => {
  const n = byId[slug];
  return `<button class="stop" data-go="${esc(slug)}" style="--c:${lineOf(n?.type).c}"><i class="line"></i>${num ? `<b>${num}</b>` : ''}${esc(label(slug))}</button>`;
};

async function loadGraph() {
  const g = await api('/api/graph');
  data = g;
  byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  degree = {};
  for (const l of g.links) {
    degree[l.source] = (degree[l.source] || 0) + 1;
    degree[l.target] = (degree[l.target] || 0) + 1;
  }
  feed(agentMap, g);
  if (graphMap) feed(graphMap, g);
  renderStatus(g);
  renderLegend();
  if (graphMap) {
    renderLines();
    renderSide();
  }
  return g;
}

// Rail status: model, graph size, semantic index, review queue. Polls while the index is building.
function renderStatus(g) {
  const s = g.stats;
  const e = g.embeddings;
  $('#sModel').textContent = g.model.replace('claude-', 'Claude ').replace(/-(\d)-(\d)$/, ' $1.$2').replace('sonnet', 'Sonnet');
  $('#sGraph').textContent = `${s.nodes} stations · ${s.facts} links`;
  $('#sIndex').textContent = e.state === 'ready' ? `Ready · ${s.embedded}/${s.nodes} embedded` : e.state === 'loading' || e.state === 'off' ? 'Building…' : 'Keyword only (model unavailable)';
  $('#sReview').textContent = s.proposed ? `${s.proposed} planned change${s.proposed > 1 ? 's' : ''}` : 'Clear';
  $('#statusLamp').className = 'lamp ' + (e.state === 'ready' ? 'ok' : 'busy');
  if (e.state === 'loading' || e.state === 'off') setTimeout(async () => renderStatus(await api('/api/graph')), 3000);
}

function renderLegend() {
  const types = [...new Set(data.nodes.map((n) => n.type))].sort();
  $('#agentLegend').innerHTML = types.map((t) => `<span><i class="line" style="--c:${lineOf(t).c}"></i>${esc(lineOf(t).name)}</span>`).join('');
}

// ── Map drawing (shared by both maps) ────────────────────────────────────────────────────────────
// Each node is drawn as a station: porcelain dot ringed in its line colour; busy nodes are interchanges.
// Labels are not drawn here: nodes queue them, and placeLabels() sets them after every node is drawn,
// skipping any that would collide (transit-map style), so the map stays legible at every zoom.
const isHub = (id) => (degree[id] || 0) >= 7;
const radiusOf = (n) => (isHub(n.id) ? 9 : 5);

function drawStation(ctx, n, alpha) {
  const color = lineOf(n.type).c;
  const r = radiusOf(n);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
  ctx.fillStyle = isHub(n.id) ? '#0b1230' : '#f4f1ea';
  ctx.fill();
  ctx.lineWidth = isHub(n.id) ? 3.2 : 2.2;
  ctx.strokeStyle = isHub(n.id) ? '#f4f1ea' : color;
  ctx.stroke();
  if (isHub(n.id)) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 3.4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Place queued labels in priority order: right of the dot, else left, else skip if it would collide
// with a placed label, a station dot or a number stamp, or leave the visible canvas.
function placeLabels(fg, ctx, scale, queue, obstacles) {
  const size = 13 / scale;
  ctx.font = `600 ${size}px "Barlow Condensed", sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.06}px`;
  ctx.textBaseline = 'middle';
  const tl = fg.screen2GraphCoords(0, 0);
  const br = fg.screen2GraphCoords(fg.width(), fg.height());
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const placed = [...obstacles];
  for (const { n, alpha, must } of queue.sort((a, b) => a.priority - b.priority)) {
    const text = n.label.toUpperCase();
    const w = ctx.measureText(text).width;
    const h = size * 1.1;
    const gap = radiusOf(n) + 4 / scale;
    // Right, then left; stations the agent visited (`must`) also try below and above before giving up.
    const spots = [
      { x: n.x + gap, y: n.y - h / 2 },
      { x: n.x - gap - w, y: n.y - h / 2 },
      ...(must ? [{ x: n.x - w / 2, y: n.y + gap }, { x: n.x - w / 2, y: n.y - gap - h }] : []),
    ];
    for (const [i, spot] of spots.entries()) {
      const box = { ...spot, w, h };
      const inside = box.x > tl.x && box.x + w < br.x && box.y > tl.y && box.y + h < br.y;
      // A node's own stamp (top-left of it) may sit beside its left-hand label, but never under one placed above.
      if (!inside || placed.some((p) => !(i === 1 && p === n.__stamp) && hit(box, p))) continue;
      placed.push(box);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'left';
      ctx.lineWidth = 3.4 / scale;
      ctx.strokeStyle = '#0b1230';
      ctx.strokeText(text, box.x, box.y + h / 2);
      ctx.fillStyle = '#f4f1ea';
      ctx.fillText(text, box.x, box.y + h / 2);
      ctx.globalAlpha = 1;
      break;
    }
  }
}
const dotBox = (n, pad = 2) => ({ x: n.x - radiusOf(n) - pad, y: n.y - radiusOf(n) - pad, w: 2 * (radiusOf(n) + pad), h: 2 * (radiusOf(n) + pad) });

function makeMap(el, drawNode) {
  const fg = ForceGraph()(el)
    .backgroundColor('rgba(0,0,0,0)')
    .nodeId('id')
    .nodeLabel((n) => `${n.label} · ${lineOf(n.type).name}`)
    .nodeCanvasObject(drawNode)
    .nodePointerAreaPaint((n, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 10, 0, 2 * Math.PI);
      ctx.fill();
    })
    .linkLabel((l) => `${pred(l.predicate)}${l.status === 'proposed' ? ' (planned, unverified)' : ''}`)
    .linkLineDash((l) => (l.status === 'proposed' ? [4, 3] : null))
    .linkDirectionalArrowLength(3.5)
    .linkDirectionalArrowRelPos(0.92)
    .cooldownTicks(160);
  fg.d3Force('charge').strength(-300);
  fg.d3Force('link').distance(80);
  new ResizeObserver(([e]) => fg.width(e.contentRect.width).height(e.contentRect.height)).observe(el);
  return fg;
}

// Give a map its own copy of the data (the engine mutates nodes), keeping existing positions.
function feed(fg, g) {
  const old = new Map(fg.graphData().nodes.map((n) => [n.id, n]));
  const nodes = g.nodes.map((n) => {
    const o = old.get(n.id);
    return o ? { ...n, x: o.x, y: o.y } : { ...n };
  });
  fg.graphData({ nodes, links: g.links.map((l) => ({ ...l })) });
}
const endId = (end) => end?.id ?? end;

function zoomControls(container, fg, fit) {
  container.onclick = (e) => {
    const z = e.target.closest('[data-zoom]')?.dataset.zoom;
    if (z === 'in') fg.zoom(fg.zoom() * 1.4, 300);
    if (z === 'out') fg.zoom(fg.zoom() / 1.4, 300);
    if (z === 'fit') fit();
  };
}

// ── Views ────────────────────────────────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('#nav button').forEach((b) => {
    b.classList.toggle('on', b.dataset.view === name);
    b.toggleAttribute('aria-current', b.dataset.view === name);
  });
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === name));
  if (name === 'graph') ensureGraphMap();
  if (name === 'mcp') loadMcp();
}
$('#nav').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) showView(b.dataset.view);
};
// Entity chips: inside the Agent view they ring the entity on the live map (the presenter stays on the
// run); everywhere else they open the entity in the Graph view.
document.body.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (!go) return;
  if (go.closest('#agent')) pingNode(go.dataset.go);
  else focusStation(go.dataset.go);
});
document.body.addEventListener('mouseover', (e) => {
  const go = e.target.closest('#agent [data-go]');
  if (go) pingNode(go.dataset.go, false);
});

// ═══ AGENT VIEW ══════════════════════════════════════════════════════════════════════════════════
// `route` is the journey shown on the agent map. Events from the agent can arrive in bursts (a search
// reports ten entities at once), so every visual step is put on a small timeline and played in order:
//   legs      one per tool call: { from, anchor, nodes, at, arrive }. The main line travels from the previous
//             anchor to this call's anchor (the entity it is about, or a search's top hit) starting at `at`.
//   revealAt  entity -> the moment it lights up (after the line reaches its anchor, staggered).
//   stamp     entity -> number, in the order the agent first reached it (matches the chips).
const LEG_MS = 750; // how long the line takes to travel between two stations
const emptyRoute = () => ({ stamp: new Map(), revealAt: new Map(), legs: [], t0: 0, lastLeg: 0, lastReveal: 0, lastAnchor: null, current: null, live: false, ping: null });
let route = emptyRoute();
let labelQueue = [];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const progress = (start, ms) => (reduceMotion ? 1 : clamp01((performance.now() - start) / ms));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeBack = (t) => (t === 0 ? 0 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
const shown = (id) => route.revealAt.has(id) && performance.now() >= route.revealAt.get(id);

// Timeline helpers: give each visual step its own slot so bursts play out one after another.
const slot = (run, key, gap) => (run[key] = Math.max(performance.now(), run[key] + gap));
function startLeg(run, leg) {
  leg.at = slot(run, 'lastLeg', 600);
  if (leg.anchor) anchorLeg(run, leg, leg.anchor);
}
function anchorLeg(run, leg, slug) {
  leg.anchor = slug;
  leg.from = run.lastAnchor && run.lastAnchor !== slug ? run.lastAnchor : null; // null = no travel needed
  leg.arrive = leg.at + (leg.from ? LEG_MS : 0);
  run.lastAnchor = slug;
  reveal(run, slug, leg.arrive);
}
function reveal(run, slug, earliest) {
  if (run.revealAt.has(slug)) return;
  const t = Math.max(earliest, slot(run, 'lastReveal', 120));
  run.lastReveal = t;
  run.revealAt.set(slug, t);
  if (run === route) followCamera();
}
function nodeOnLeg(run, leg, slug) {
  if (!leg.anchor) return anchorLeg(run, leg, slug);
  if (slug !== leg.anchor && !leg.nodes.includes(slug)) leg.nodes.push(slug);
  reveal(run, slug, leg.arrive + 320);
}

const agentMap = makeMap($('#agentMap'), (n, ctx, scale) => {
  const active = route.legs.length > 0;
  const dimTo = active ? 0.92 - 0.78 * easeOut(progress(route.t0, 700)) : 0.92;
  const t = route.revealAt.get(n.id);
  const p = t != null ? easeOut(progress(t, 650)) : 0;
  const color = lineOf(n.type).c;
  const r = radiusOf(n);
  if (p > 0) {
    // Lit: a soft halo in the line's colour, plus a one-time burst ring as it lights up
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 7, 0, 2 * Math.PI);
    ctx.fillStyle = rgba(color, 0.42 * p);
    ctx.fill();
    if (p < 1) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3 + p * 26, 0, 2 * Math.PI);
      ctx.strokeStyle = rgba(color, 0.95 * (1 - p));
      ctx.lineWidth = 3.2 / scale;
      ctx.stroke();
    }
  }
  drawStation(ctx, n, dimTo + (1 - dimTo) * p);
  if (!active || p > 0) labelQueue.push({ n, alpha: active ? easeOut(progress(t + 100, 450)) : 1, must: p > 0, priority: n.id === route.current ? 0 : route.stamp.get(n.id) || (isHub(n.id) ? 100 : 200) });
  const num = route.stamp.get(n.id);
  const s = num && t != null ? easeBack(progress(t + 140, 460)) : 0;
  if (s > 0) {
    // Number stamp pops in: the order the agent reached this entity
    const sr = (10 / scale) * s;
    const sx = n.x - r - (10 / scale) * 0.6;
    const sy = n.y - r - (10 / scale) * 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, 2 * Math.PI);
    ctx.fillStyle = '#f4f1ea';
    ctx.fill();
    ctx.font = `700 ${sr * 1.2}px "Barlow Condensed", sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0b1230';
    ctx.fillText(String(num), sx, sy + sr * 0.06);
    n.__stamp = { x: sx - 10 / scale, y: sy - 10 / scale, w: 20 / scale, h: 20 / scale };
  } else n.__stamp = null;
  // The entity being read right now pulses; a pinged entity (chip hover/click) gets an amber ring
  if (route.live && n.id === route.current && p >= 1 && !reduceMotion) {
    const q = (performance.now() % 1300) / 1300;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 3 + q * 18, 0, 2 * Math.PI);
    ctx.strokeStyle = rgba('#f4f1ea', 0.8 * (1 - q));
    ctx.lineWidth = 2.4 / scale;
    ctx.stroke();
  }
  if (route.ping && route.ping.id === n.id && performance.now() - route.ping.at < 1800) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, r + 9, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ffc20e';
    ctx.lineWidth = 3 / scale;
    ctx.stroke();
  }
})
  .linkColor((l) => {
    const color = lineOf(byId[endId(l.source)]?.type).c;
    const idle = l.status === 'proposed' ? 0.7 : 0.42;
    if (!route.legs.length) return rgba(color, idle);
    const on = shown(endId(l.source)) && shown(endId(l.target));
    return rgba(color, on ? 0.32 : idle - (idle - 0.05) * easeOut(progress(route.t0, 700)));
  })
  .linkWidth(1.2)
  .autoPauseRedraw(false)
  // The signature move: the journey drawn as a cased porcelain line that travels station to station,
  // with a marker riding the leg in progress and a slow flow along the finished line.
  .onRenderFramePre((ctx, scale) => {
    labelQueue = [];
    const pos = new Map(agentMap.graphData().nodes.map((n) => [n.id, n]));
    const now = performance.now();
    // The pulsing "current" entity is the latest one that has actually lit up
    let latest = -1;
    for (const [id, t] of route.revealAt) if (t <= now && t > latest) [latest, route.current] = [t, id];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Spurs: each call's other entities, growing out of its anchor just before they light up
    route.legs.forEach((leg, i) => {
      const a = pos.get(leg.anchor);
      if (!a || a.x == null) return;
      const isCurrent = i === route.legs.length - 1;
      ctx.beginPath();
      for (const id of leg.nodes) {
        const b = pos.get(id);
        const e = easeOut(progress((route.revealAt.get(id) ?? Infinity) - 320, 320));
        if (b?.x != null && e > 0) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
        }
      }
      ctx.setLineDash([3 / scale, 4 / scale]);
      ctx.lineWidth = (isCurrent ? 2.4 : 1.8) / scale;
      ctx.strokeStyle = rgba('#f4f1ea', isCurrent ? 0.9 : 0.42);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Main line: leg by leg, eased like a train leaving and arriving
    const legs = route.legs.filter((l) => l.from && pos.get(l.from)?.x != null && pos.get(l.anchor)?.x != null);
    const path = () => {
      ctx.beginPath();
      let head = null;
      for (const leg of legs) {
        const e = easeInOut(progress(leg.at, LEG_MS));
        if (e <= 0) continue;
        const a = pos.get(leg.from);
        const b = pos.get(leg.anchor);
        const x = a.x + (b.x - a.x) * e;
        const y = a.y + (b.y - a.y) * e;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        if (e < 1) head = { x, y };
      }
      return head;
    };
    path();
    ctx.lineWidth = 11 / scale;
    ctx.strokeStyle = '#0b1230';
    ctx.stroke();
    const head = path();
    ctx.lineWidth = 5.5 / scale;
    ctx.strokeStyle = '#f4f1ea';
    ctx.stroke();
    // Flow: small enamel dashes drifting along the line in the direction of travel
    if (!reduceMotion) {
      path();
      ctx.setLineDash([2 / scale, 14 / scale]);
      ctx.lineDashOffset = -(now * 0.02) / scale;
      ctx.lineWidth = 2.2 / scale;
      ctx.strokeStyle = rgba('#0b1230', 0.7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    // The marker riding the leg in progress
    if (head) {
      ctx.beginPath();
      ctx.arc(head.x, head.y, 7.5 / scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#f4f1ea';
      ctx.fill();
      ctx.lineWidth = 3.5 / scale;
      ctx.strokeStyle = '#e21d2d';
      ctx.stroke();
    }
  })
  .onRenderFramePost((ctx, scale) => {
    const obstacles = [];
    for (const n of agentMap.graphData().nodes) {
      if (n.x == null) continue;
      if (!route.legs.length || shown(n.id)) obstacles.push(dotBox(n));
      if (n.__stamp) obstacles.push(n.__stamp);
    }
    placeLabels(agentMap, ctx, scale, labelQueue, obstacles);
  })
  .onNodeClick((n) => (busy ? pingNode(n.id) : focusStation(n.id)));
zoomControls(document.querySelector('.zoom[data-map="agent"]'), agentMap, () => fitRoute());

function pingNode(id, center = true) {
  route.ping = { id, at: performance.now() };
  const n = agentMap.graphData().nodes.find((x) => x.id === id);
  if (center && n?.x != null) agentMap.centerAt(n.x, n.y, 600);
}

// Camera: frame the whole route once (on demand / at the end); while live, only move when a newly lit
// entity would fall outside the view, and never more than once per second, so the map stays calm.
const routeIds = () => new Set([...route.revealAt.keys()]);
function fitRoute() {
  const ids = routeIds();
  if (ids.size >= 2) agentMap.zoomToFit(1100, 110, (n) => ids.has(n.id));
  else agentMap.zoomToFit(1100, 80);
}
let camBusy = false;
function followCamera() {
  if (camBusy) return;
  camBusy = true;
  setTimeout(() => {
    camBusy = false;
    const pad = 70;
    const W = agentMap.width();
    const H = agentMap.height();
    const pts = agentMap.graphData().nodes.filter((n) => route.revealAt.has(n.id) && n.x != null).map((n) => agentMap.graph2ScreenCoords(n.x, n.y));
    if (pts.length < 3) return; // too few stations to frame yet
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const out = pts.some((p) => p.x < pad || p.y < pad + 60 || p.x > W - pad || p.y > H - pad);
    // Also move in when the journey is a small cluster in the middle of the map, so it reads on a projector
    const small = Math.max(...xs) - Math.min(...xs) < W * 0.5 && Math.max(...ys) - Math.min(...ys) < H * 0.5;
    if (out || small) agentMap.zoomToFit(1200, 120, (n) => route.revealAt.has(n.id));
  }, 1000);
}
agentMap.onEngineStop(() => !route.legs.length && agentMap.zoomToFit(600, 80));

function setRoute(run) {
  route = run;
  $('#rStations').textContent = run.stamp.size;
  fitRoute();
}

// "Route on map": replay a finished journey from the start, leg by leg.
function replay(run) {
  const legs = run.legs.map((l) => ({ anchor: l.anchor, nodes: [...l.nodes] }));
  Object.assign(run, { revealAt: new Map(), legs: [], t0: performance.now(), lastLeg: 0, lastReveal: 0, lastAnchor: null });
  setRoute(run);
  for (const old of legs) {
    const leg = { anchor: null, nodes: [] };
    run.legs.push(leg);
    startLeg(run, leg);
    if (old.anchor) anchorLeg(run, leg, old.anchor);
    for (const id of old.nodes) nodeOnLeg(run, leg, id);
  }
}

// ── Conversation ──
const SUGGESTIONS = [
  'What breaks if Postgres goes down?',
  'Who owns the billing service and which standards must it follow?',
  'Which facts are still planned and need review?',
  'What should a new engineer read in their first week?',
];
let sid = crypto.randomUUID();
let busy = false;

function renderWelcome() {
  $('#log').innerHTML = `
    <div class="welcome">
      <h1>Ask the<br>network</h1>
      <p>Claude Sonnet 5.5 travels the company knowledge graph with tools. Every step it takes appears here as a station, and every entity it reads lights up on the map.</p>
      <h2 class="panel-title">Popular journeys</h2>
      <ul class="journeys">
        ${SUGGESTIONS.map((s, i) => `<li><button data-ask="${esc(s)}"><i class="line" style="--c:${Object.values(LINES)[i].c}"></i><span>${esc(s)}</span>${icon('arrow')}</button></li>`).join('')}
      </ul>
    </div>`;
}
renderWelcome();

$('#log').addEventListener('click', (e) => {
  const s = e.target.closest('[data-ask]');
  if (s) ask(s.dataset.ask);
  const r = e.target.closest('[data-route]');
  if (r) replay(turns[Number(r.dataset.route)]);
});
$('#ask').onsubmit = (e) => {
  e.preventDefault();
  ask($('#question').value);
};
$('#newChat').onclick = () => {
  if (busy) return;
  sid = crypto.randomUUID();
  turns.length = 0;
  setRoute(emptyRoute());
  setRunState('Idle', '');
  renderWelcome();
};

const TOOL_LABEL = {
  graph_search: 'Search', graph_entity: 'Open', graph_related: 'Follow lines', graph_stats: 'Count network',
  graph_review_list: 'Review queue', repo_list: 'List repos', repo_tree: 'Repo files', repo_read: 'Read file', repo_search: 'Search code',
};
function argText(name, a = {}) {
  if (a.query) return `“${a.query}”${a.repo ? ` in ${a.repo}` : ''}`;
  if (a.slug) return `${label(a.slug)}${a.predicate ? ` · ${a.predicate}` : ''}${a.depth ? ` · ${a.depth} hops` : ''}`;
  if (a.path) return `${a.repo} / ${a.path}`;
  if (a.repo) return a.repo;
  return '';
}
const seconds = (ms) => (ms < 1 ? '<1 ms' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

// Each tool kind gets its own glyph on its station dot (numbers are reserved for entities).
const TOOL_ICON = {
  graph_search: '<circle cx="11" cy="11" r="6"/><path d="m19 19-3.5-3.5"/>',
  graph_entity: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>',
  graph_related: '<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12H12m0 0 4.8-4.8M12 12l4.8 4.8"/>',
  graph_stats: '<path d="M5 19V11M12 19V5M19 19v-6"/>',
  graph_review_list: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5"/>',
};
const toolIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TOOL_ICON[name] || '<path d="M8 4h8l4 4v12H4V4h4"/><path d="M14 4v4h4"/>'}</svg>`;

function setRunState(text, cls) {
  const t = $('#runState');
  t.textContent = text;
  t.className = `tag ${cls}`;
}

const turns = [];

function ask(text) {
  const question = text.trim();
  if (!question || busy) return;
  busy = true;
  $('#askBtn').disabled = true;
  $('#question').value = '';
  $('#log').querySelector('.welcome')?.remove();

  const run = { ...emptyRoute(), live: true, t0: performance.now() };
  const index = turns.push(run) - 1;
  setRoute(run);
  let tools = 0;
  let rounds = 0;
  const started = performance.now();
  const stations = new Map(); // tool id -> { el, nodes, leg }
  let reasoning = null; // the current reasoning station
  let roundCalls = {}; // tool label -> count, for the current round's summary line

  // An honest, derived summary under each reasoning station: what the round actually called.
  const summarise = () => {
    if (!reasoning) return;
    const text = Object.entries(roundCalls).map(([k, v]) => (v > 1 ? `${k} ×${v}` : k)).join(' · ');
    let line = reasoning.querySelector('.auto');
    if (!line) {
      reasoning.querySelector('.body').insertAdjacentHTML('beforeend', '<p class="auto"></p>');
      line = reasoning.querySelector('.auto');
    }
    line.textContent = `Called ${text}`;
  };

  $('#log').insertAdjacentHTML('beforeend', `<article class="turn"><p class="q">${esc(question)}</p><ol class="route"></ol></article>`);
  const turn = $('#log').lastElementChild;
  const list = turn.querySelector('.route');
  const scroll = () => ($('#log').scrollTop = $('#log').scrollHeight);
  scroll();

  setRunState('Live', 'live');
  $('#rTools').textContent = '0';
  $('#rRounds').textContent = '0';
  const clock = setInterval(() => ($('#rTime').textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`), 100);

  const addStation = (cls, html) => {
    list.querySelectorAll('.st.active').forEach((el) => el.classList.replace('active', 'done'));
    list.insertAdjacentHTML('beforeend', `<li class="st active ${cls}">${html}</li>`);
    scroll();
    return list.lastElementChild;
  };

  const es = new EventSource(`/api/ask?sid=${sid}&q=${encodeURIComponent(question)}`);
  const finish = (html) => {
    es.close();
    clearInterval(clock);
    busy = false;
    run.live = false;
    $('#askBtn').disabled = false;
    list.querySelectorAll('.st.active').forEach((el) => el.classList.replace('active', 'done'));
    // The last round only wrote the answer: say so instead of leaving an empty station
    list.querySelectorAll('.st.think').forEach((el) => !el.querySelector('.thought, .auto') && el.querySelector('.body').insertAdjacentHTML('beforeend', '<p class="auto">Wrote the answer</p>'));
    turn.insertAdjacentHTML('beforeend', html);
    scroll();
  };

  es.addEventListener('model', (e) => {
    rounds = JSON.parse(e.data).round;
    $('#rRounds').textContent = rounds;
    reasoning = addStation('think', `<span class="dot"></span><div class="body"><h3>Reasoning <span class="arg"></span><span class="ms">Round ${rounds}</span></h3></div>`);
    roundCalls = {};
  });
  es.addEventListener('think', (e) => {
    const line = JSON.parse(e.data).line;
    reasoning?.querySelector('.body').insertAdjacentHTML('beforeend', `<p class="thought">${esc(line)}</p>`);
    scroll();
  });
  es.addEventListener('tool', (e) => {
    const { id, name, input } = JSON.parse(e.data);
    tools++;
    $('#rTools').textContent = tools;
    const toolName = TOOL_LABEL[name] || name;
    roundCalls[toolName] = (roundCalls[toolName] || 0) + 1;
    summarise();
    const el = addStation('tool', `<span class="dot" title="Tool call ${tools}">${toolIcon(name)}</span><div class="body"><h3>${esc(toolName)} <span class="arg">${esc(argText(name, input))}</span><span class="ms">…</span></h3><div class="stops"></div></div>`);
    // A new leg of the journey: anchored on the entity this call is about (or, for a search, its top hit)
    const leg = { anchor: byId[input?.slug] ? input.slug : null, nodes: [] };
    run.legs.push(leg);
    startLeg(run, leg);
    stations.set(id, { el, nodes: new Set(), leg });
  });
  es.addEventListener('node', (e) => {
    const { slug, tool } = JSON.parse(e.data);
    if (!run.stamp.has(slug)) {
      run.stamp.set(slug, run.stamp.size + 1);
      $('#rStations').textContent = run.stamp.size;
    }
    const st = stations.get(tool);
    if (st && !st.nodes.has(slug)) {
      st.nodes.add(slug);
      nodeOnLeg(run, st.leg, slug);
      st.el.querySelector('.stops').insertAdjacentHTML('beforeend', stopChip(slug, run.stamp.get(slug)));
    }
  });
  es.addEventListener('tool_done', (e) => {
    const { id, ms, preview } = JSON.parse(e.data);
    const st = stations.get(id);
    if (!st) return;
    st.el.classList.replace('active', 'done');
    st.el.querySelector('.ms').textContent = seconds(ms);
    if (!st.nodes.size && preview) st.el.querySelector('.body').insertAdjacentHTML('beforeend', `<p class="preview">${esc(preview)}</p>`);
  });
  es.addEventListener('answer', (e) => {
    const { answer, entities } = JSON.parse(e.data);
    const total = seconds(Math.round(performance.now() - started));
    setRunState('Arrived', 'done');
    finish(`
      <section class="arrival">
        <header><span class="tag done">Arrived</span><span class="caps" style="color:var(--ink-3);font-size:12.5px">${tools} tool calls · ${run.stamp.size} entities · ${total}</span></header>
        <div class="md">${markdown(answer)}</div>
        ${entities.length ? `<footer><h4 class="panel-title">Sources</h4>${entities.map((s) => stopChip(s, run.stamp.get(s))).join('')}<button class="btn small" data-route="${index}">${icon('route')}Replay route</button></footer>` : ''}
      </section>`);
    // Once the last queued station has lit up, frame the whole journey
    setTimeout(() => route === run && fitRoute(), Math.max(0, run.lastReveal - performance.now()) + 900);
  });
  es.addEventListener('error', (e) => {
    setRunState('Stopped', 'err');
    const msg = e.data ? JSON.parse(e.data).error : 'Connection to the server was lost.';
    finish(`<section class="arrival"><header><span class="tag err">Stopped</span></header><div class="md"><p class="error">${esc(msg)}</p></div></section>`);
  });
}

// ═══ GRAPH VIEW ══════════════════════════════════════════════════════════════════════════════════
let graphMap = null;
let selected = null;
let lit = new Set();
const hidden = new Set();

function ensureGraphMap() {
  if (graphMap) return;
  let queue = [];
  graphMap = makeMap($('#graphMap'), (n, ctx) => {
    const dim = lit.size && !lit.has(n.id);
    drawStation(ctx, n, dim ? 0.14 : 1);
    if (!dim) queue.push({ n, alpha: 1, priority: n.id === selected ? 0 : isHub(n.id) ? 1 : 2 });
    if (n.id === selected) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, radiusOf(n) + 6, 0, 2 * Math.PI);
      ctx.strokeStyle = '#f4f1ea';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  })
    .onRenderFramePre(() => (queue = []))
    .onRenderFramePost((ctx, scale) => {
      const visible = graphMap.graphData().nodes.filter((n) => n.x != null && !hidden.has(n.type));
      placeLabels(graphMap, ctx, scale, queue, visible.map((n) => dotBox(n)));
    })
    .nodeVisibility((n) => !hidden.has(n.type))
    .linkVisibility((l) => !hidden.has(byId[endId(l.source)]?.type) && !hidden.has(byId[endId(l.target)]?.type))
    .linkColor((l) => {
      const color = lineOf(byId[endId(l.source)]?.type).c;
      const on = !lit.size || (lit.has(endId(l.source)) && lit.has(endId(l.target)));
      return rgba(color, on ? (lit.size ? 0.95 : 0.5) : 0.05);
    })
    .linkWidth((l) => (lit.size && lit.has(endId(l.source)) && lit.has(endId(l.target)) ? 2.4 : 1.3))
    .onNodeClick((n) => select(n.id))
    .onBackgroundClick(() => select(null))
    .onEngineStop(() => !selected && graphMap.zoomToFit(600, 90));
  zoomControls(document.querySelector('.zoom[data-map="graph"]'), graphMap, () => graphMap.zoomToFit(600, 90));
  feed(graphMap, data);
  renderLines();
  renderSide();
}

function renderLines() {
  const counts = {};
  data.nodes.forEach((n) => (counts[n.type] = (counts[n.type] || 0) + 1));
  $('#lines').innerHTML = Object.keys(counts)
    .sort()
    .map((t) => `<button data-type="${t}" aria-pressed="${!hidden.has(t)}"><i class="line" style="--c:${lineOf(t).c}"></i>${esc(lineOf(t).name)} <b>${counts[t]}</b></button>`)
    .join('');
}
$('#lines').onclick = (e) => {
  const b = e.target.closest('[data-type]');
  if (!b) return;
  const t = b.dataset.type;
  hidden.has(t) ? hidden.delete(t) : hidden.add(t);
  b.setAttribute('aria-pressed', !hidden.has(t));
  graphMap.nodeVisibility(graphMap.nodeVisibility());
};

function neighbours(id) {
  const ids = new Set([id]);
  for (const l of data.links) {
    if (l.source === id) ids.add(l.target);
    if (l.target === id) ids.add(l.source);
  }
  return ids;
}

async function select(id) {
  selected = id;
  lit = id ? neighbours(id) : new Set();
  graphMap.linkWidth(graphMap.linkWidth()); // redraw
  renderSide(id ? await api(`/api/entity/${encodeURIComponent(id)}`) : null);
}

// Open a station from anywhere (chips, search, map): switch to Graph and fly to it.
function focusStation(id) {
  if (!byId[id]) return;
  showView('graph');
  hidden.delete(byId[id].type);
  renderLines();
  select(id);
  const n = graphMap.graphData().nodes.find((x) => x.id === id);
  if (n?.x != null) {
    graphMap.centerAt(n.x, n.y, 700);
    graphMap.zoom(2.4, 700);
  }
}

// Right panel: station card when a node is selected, network overview + review queue otherwise.
function renderSide(e) {
  const side = $('#side');
  if (!e) {
    const s = data.stats;
    const planned = data.links.filter((l) => l.status === 'proposed');
    side.innerHTML = `
      <h2>Network</h2>
      <p class="desc">Every station is a document; every line is a sourced fact. Pick a station on the map or search by name or meaning.</p>
      <dl class="figures">
        <div><dt>Stations</dt><dd>${s.nodes}</dd></div>
        <div><dt>Links</dt><dd>${s.facts}</dd></div>
        <div><dt>Verified</dt><dd>${s.verified}</dd></div>
        <div><dt>Planned</dt><dd>${s.proposed}</dd></div>
      </dl>
      <h3 class="panel-title">Review queue · ${planned.length} planned</h3>
      ${planned.length ? `<ul class="board">${planned.map((l) => `
        <li class="alert">${icon('alert')}
          <p><button data-go="${esc(l.source)}">${esc(label(l.source))}</button> <span class="caps" style="font-size:12px;color:var(--ink-3)">${esc(pred(l.predicate))}</span> <button data-go="${esc(l.target)}">${esc(label(l.target))}</button></p>
          <small>Unverified · from the source document</small>
          <span class="acts"><button class="btn small" data-review="${l.id}" data-status="verified">${icon('check')}Approve</button><button class="btn small" data-review="${l.id}" data-status="deprecated">${icon('x')}Reject</button></span>
        </li>`).join('')}</ul>` : '<p class="desc">Nothing waiting for review.</p>'}`;
    return;
  }
  const line = lineOf(e.type);
  const row = (f, out) => {
    const other = out ? f.object : f.subject;
    return `<li><span class="pred">${esc(pred(f.predicate))}</span>
      <button class="to" data-go="${esc(other)}"><i class="line" style="--c:${lineOf(byId[other]?.type).c}"></i><span>${esc(label(other))}</span></button>
      ${f.status === 'proposed' ? `<span class="flag"><span class="planned">Planned · unverified</span><span class="acts"><button data-review="${f.id}" data-status="verified" title="Approve">${icon('check')}</button><button data-review="${f.id}" data-status="deprecated" title="Reject">${icon('x')}</button></span></span>` : ''}</li>`;
  };
  side.innerHTML = `
    <div class="sidehead"><h2>${esc(e.label)}</h2><button class="close" data-close title="Close">${icon('x')}</button></div>
    <p class="meta"><span class="badge ${line.dark ? 'dark' : ''}" style="--c:${line.c}">${esc(e.type)}</span><span>${esc(e.path || '')}</span></p>
    <p class="desc">${esc(e.desc)}</p>
    ${e.outgoing.length ? `<h3 class="panel-title">Connections</h3><ul class="board">${e.outgoing.map((f) => row(f, true)).join('')}</ul>` : ''}
    ${e.incoming.length ? `<h3 class="panel-title">Referenced by</h3><ul class="board">${e.incoming.map((f) => row(f, false)).join('')}</ul>` : ''}
    ${e.body ? `<details class="doc"><summary>Source document</summary><div class="md">${markdown(e.body)}</div></details>` : ''}`;
}
$('#side').addEventListener('click', async (ev) => {
  if (ev.target.closest('[data-close]')) return select(null);
  const r = ev.target.closest('[data-review]');
  if (!r) return;
  await api('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.dataset.review, status: r.dataset.status }) });
  await loadGraph();
  if (selected) select(selected);
});

// Search by name or meaning (hybrid keyword + embeddings on the server).
let searchTimer;
$('#find').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) return ($('#results').hidden = true);
  searchTimer = setTimeout(async () => {
    const hits = await api(`/api/search?q=${encodeURIComponent(q)}`);
    $('#results').hidden = false;
    $('#results').innerHTML = hits.length
      ? hits.map((h) => `<li><button data-go="${esc(h.slug)}"><i class="line" style="--c:${lineOf(h.type).c}"></i><span>${esc(h.label)}</span><small>${h.via === 'keyword+meaning' ? 'Both' : esc(h.via)}</small></button></li>`).join('')
      : '<li class="empty">No stations match. Try other words.</li>';
  }, 180);
});
$('#find').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#results button')?.click();
  if (e.key === 'Escape') $('#results').hidden = true;
});
$('#results').addEventListener('click', () => ($('#results').hidden = true));

// ═══ MCP VIEW ════════════════════════════════════════════════════════════════════════════════════
let mcpInfo = null;
const codeBlock = (text) => `<div class="code"><pre>${esc(text)}</pre><button class="btn small" data-copy>${icon('copy')}Copy</button></div>`;
const toolKind = (name) => (name.startsWith('repo_') ? ['GitHub', '#a274ef'] : ['graph_propose', 'graph_verify'].includes(name) ? ['Write', '#e21d2d'] : ['Read', '#22b14c']);

async function loadMcp() {
  if (mcpInfo) return;
  mcpInfo = await api('/api/mcp-info');
  const { url, script, tools } = mcpInfo;
  const desktop = JSON.stringify({ mcpServers: { nexus: { command: 'node', args: [script] } } }, null, 2);
  $('#mcpPage').innerHTML = `
    <h1>Connect Claude</h1>
    <p class="lead">The same tools the agent uses are served over the Model Context Protocol, so Claude Code, Claude Desktop or any MCP client can travel this network itself.</p>
    <div class="grid2">
      <section class="card"><h2>HTTP endpoint</h2><p>Streamable HTTP, stateless. Available while <code>npm start</code> is running.</p>${codeBlock(url)}
        <div class="test"><button class="btn small primary" id="testMcp">Test connection</button><output id="testResult">Not tested yet.</output></div></section>
      <section class="card"><h2>Claude Code</h2><p>Over HTTP, or over stdio so Claude starts the server itself.</p>${codeBlock(`claude mcp add --transport http nexus ${url}`)}${codeBlock(`claude mcp add nexus -- node "${script}"`)}</section>
    </div>
    <section class="card"><h2>Claude Desktop</h2><p>Add to <code>claude_desktop_config.json</code>, then restart the app.</p>${codeBlock(desktop)}</section>
    <h3 class="panel-title" style="margin-top:36px">Tools · ${tools.length}</h3>
    <table class="timetable"><thead><tr><th>Tool</th><th>Access</th><th>What it does</th></tr></thead><tbody>
      ${tools.map((t) => { const [k, c] = toolKind(t.name); return `<tr><td>${esc(t.name)}</td><td><span class="badge ${k === 'Write' ? '' : 'dark'}" style="--c:${c}">${k}</span></td><td>${esc(t.description)}</td></tr>`; }).join('')}
    </tbody></table>`;
}

$('#mcpPage').addEventListener('click', async (e) => {
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard.writeText(copy.previousElementSibling.textContent);
    copy.lastChild.textContent = 'Copied';
    setTimeout(() => (copy.lastChild.textContent = 'Copy'), 1200);
  }
  if (e.target.closest('#testMcp')) {
    // A real MCP handshake from the browser: initialize, then tools/list.
    const out = $('#testResult');
    out.textContent = 'Connecting…';
    const call = (id, method, params = {}) =>
      api('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
    try {
      const init = await call(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'nexus-web', version: '1.0.0' } });
      const list = await call(2, 'tools/list');
      out.innerHTML = `<span class="tag done">Connected</span> ${esc(init.result.serverInfo.name)} · protocol ${esc(init.result.protocolVersion)} · ${list.result.tools.length} tools`;
    } catch (err) {
      out.innerHTML = `<span class="tag err">Failed</span> ${esc(err.message)}`;
    }
  }
});

// ── Start ──
loadGraph().then(() => document.fonts.ready.then(() => agentMap.zoom(agentMap.zoom())));
