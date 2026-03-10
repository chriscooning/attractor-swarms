import * as THREE from 'three';
import ForceGraph3D from '3d-force-graph';

/* ── palette from CSS custom properties ─────────────────────── */

const cs = getComputedStyle(document.documentElement);
const v = name => cs.getPropertyValue(name).trim();

const palette = {
  bg:        v('--bg'),
  primary:   v('--node-primary'),
  secondary: v('--node-secondary'),
  accent:    v('--node-accent'),
  dim:       v('--node-transient'),
  edge:      v('--edge-color'),
};

/* ── node types ─────────────────────────────────────────────── */

const TYPES = {
  system:    { color: palette.primary,   size: [6, 9],     ttl: null },
  folder:    { color: palette.primary,   size: [3, 5.5],   ttl: null },
  file:      { color: palette.secondary, size: [1.5, 3],   ttl: null },
  concept:   { color: palette.accent,    size: [2, 4.5],   ttl: null },
  transient: { color: palette.dim,       size: [0.5, 1.5], ttl: [8000, 20000] },
};

const mobile = window.innerWidth < 768;
const NODE_CAP = mobile ? 250 : 600;

/* ── state ──────────────────────────────────────────────────── */

const nodes = [];
const links = [];
let nid = 0;

const sid = l => l.source?.id ?? l.source;
const tid = l => l.target?.id ?? l.target;

function spawn(type, parent) {
  const t = TYPES[type];
  const node = {
    id: nid++,
    type,
    color: t.color,
    size: t.size[0] + Math.random() * (t.size[1] - t.size[0]),
    born: Date.now(),
    ttl: t.ttl ? t.ttl[0] + Math.random() * (t.ttl[1] - t.ttl[0]) : 0,
  };
  if (parent && parent.x !== undefined) {
    node.x = parent.x + (Math.random() - 0.5) * 15;
    node.y = parent.y + (Math.random() - 0.5) * 15;
    node.z = parent.z + (Math.random() - 0.5) * 15;
  }
  nodes.push(node);
  return node;
}

function wire(a, b) {
  if (a === b || wired(a, b)) return;
  links.push({ source: a, target: b, born: Date.now() });
  for (const n of nodes) {
    if ((n.id === a || n.id === b) && (n.type === 'system' || n.type === 'folder')) {
      n.__flickerAt = Date.now();
    }
  }
}

function wired(a, b) {
  return links.some(l =>
    (sid(l) === a && tid(l) === b) || (sid(l) === b && tid(l) === a)
  );
}

function degree(id) {
  let d = 0;
  for (const l of links) if (sid(l) === id || tid(l) === id) d++;
  return d;
}

function neighborsOf(id) {
  const out = [];
  for (const l of links) {
    if (sid(l) === id) out.push(tid(l));
    else if (tid(l) === id) out.push(sid(l));
  }
  return out;
}

function kill(id) {
  const i = nodes.findIndex(n => n.id === id);
  if (i >= 0) nodes.splice(i, 1);
  for (let j = links.length - 1; j >= 0; j--)
    if (sid(links[j]) === id || tid(links[j]) === id) links.splice(j, 1);
}

function pick(fn) {
  const p = fn ? nodes.filter(fn) : nodes;
  return p.length ? p[Math.floor(Math.random() * p.length)] : null;
}

function pickByDegree(fn) {
  const pool = fn ? nodes.filter(fn) : nodes;
  if (!pool.length) return null;
  const weights = pool.map(n => degree(n.id) + 1);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function cap() {
  while (nodes.length > NODE_CAP) {
    const t = nodes.find(n => n.type === 'transient');
    if (t) { kill(t.id); continue; }
    const c = nodes
      .filter(n => n.type !== 'system')
      .sort((a, b) => degree(a.id) - degree(b.id));
    if (c.length) kill(c[0].id); else break;
  }
}

/* ── sprite texture factories ───────────────────────────────── */

const texCache = new Map();

function glowTexture(hex) {
  if (texCache.has(hex)) return texCache.get(hex);
  const res = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = [col.r, col.g, col.b].map(c => Math.round(c * 255)).join(',');

  const g = ctx.createRadialGradient(res / 2, res / 2, 0, res / 2, res / 2, res / 2);
  g.addColorStop(0,    `rgba(${rgb}, 1)`);
  g.addColorStop(0.12, `rgba(${rgb}, 0.85)`);
  g.addColorStop(0.35, `rgba(${rgb}, 0.18)`);
  g.addColorStop(1,    `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, res, res);

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(hex, tex);
  return tex;
}

function ringTexture(hex) {
  const key = 'ring_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = [col.r, col.g, col.b].map(c => Math.round(c * 255)).join(',');

  ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(res / 2, res / 2, res / 2 - 3, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

function dotTexture(hex) {
  const key = 'dot_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = [col.r, col.g, col.b].map(c => Math.round(c * 255)).join(',');

  const g = ctx.createRadialGradient(res / 2, res / 2, 0, res / 2, res / 2, res / 2);
  g.addColorStop(0,   `rgba(${rgb}, 1)`);
  g.addColorStop(0.4, `rgba(${rgb}, 0.6)`);
  g.addColorStop(1,   `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, res, res);

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

/* ── graph ──────────────────────────────────────────────────── */

const el = document.getElementById('graph');

const graph = ForceGraph3D()(el)
  .backgroundColor(palette.bg)
  .showNavInfo(false)
  .enableNodeDrag(false)
  .enableNavigationControls(false)
  .nodeThreeObject(node => {
    const isHub = node.type === 'system' || node.type === 'folder';

    if (isHub) {
      const group = new THREE.Group();

      const dMat = new THREE.SpriteMaterial({
        map: dotTexture(node.color),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dot = new THREE.Sprite(dMat);
      const ds = Math.cbrt(node.size) * 4;
      dot.scale.set(ds, ds, 1);
      group.add(dot);

      const rMat = new THREE.SpriteMaterial({
        map: ringTexture(node.color),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.25,
      });
      const ring = new THREE.Sprite(rMat);
      const rs = ds * 3;
      ring.scale.set(rs, rs, 1);
      group.add(ring);

      node.__dot = dot;
      node.__ring = ring;
      node.__ringMat = rMat;
      node.__baseDot = ds;
      node.__baseRing = rs;
      node.__flickerAt = 0;
      return group;
    }

    const mat = new THREE.SpriteMaterial({
      map: glowTexture(node.color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const s = Math.cbrt(node.size) * 8;
    sprite.scale.set(s, s, 1);
    return sprite;
  })
  .nodeThreeObjectExtend(false)
  .linkThreeObject(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({
      color: palette.edge,
      transparent: true,
      opacity: 0,
    });
    return new THREE.Line(geo, mat);
  })
  .linkPositionUpdate((line, { start, end }, link) => {
    const age = (Date.now() - (link.born || 0)) / 1000;
    const t = Math.min(age / 0.6, 1);
    const ease = t * t * (3 - 2 * t);

    const pos = line.geometry.attributes.position;
    pos.array[0] = start.x; pos.array[1] = start.y; pos.array[2] = start.z;
    pos.array[3] = start.x + (end.x - start.x) * ease;
    pos.array[4] = start.y + (end.y - start.y) * ease;
    pos.array[5] = start.z + (end.z - start.z) * ease;
    pos.needsUpdate = true;

    line.material.opacity = 0.18 * ease;
    return true;
  })
  .warmupTicks(0)
  .cooldownTime(Infinity)
  .d3AlphaDecay(0.03)
  .d3VelocityDecay(0.35);

graph.d3Force('charge').strength(-18);
graph.d3Force('link').distance(35);
graph.d3Force('center').strength(0.06);

const fog = new THREE.FogExp2(0x000000, 0.0005);
fog.color.set(palette.bg);
graph.scene().fog = fog;

/* ── refresh ─────────────────────────────────────────────────── */

function refresh() {
  cap();
  for (const n of nodes) {
    if (n.type === 'system' || n.type === 'folder') n._deg = degree(n.id);
  }
  graph.graphData({ nodes, links });
}

/* ── parallax ───────────────────────────────────────────────── */

const ptr = { tx: 0, ty: 0, x: 0, y: 0 };

window.addEventListener('mousemove', e => {
  ptr.tx = (e.clientX / window.innerWidth  - 0.5) * 2;
  ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('touchmove', e => {
  if (e.touches.length) {
    ptr.tx = (e.touches[0].clientX / window.innerWidth  - 0.5) * 2;
    ptr.ty = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
  }
}, { passive: true });

/* ── zoom (scroll / pinch) ──────────────────────────────────── */

let zoomRadius = 450;
const ZOOM_MIN = 120;
const ZOOM_MAX = 1400;

window.addEventListener('wheel', e => {
  e.preventDefault();
  zoomRadius = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRadius + e.deltaY * 0.5));
}, { passive: false });

/* ── camera ─────────────────────────────────────────────────── */

const epoch = Date.now();

(function tick() {
  requestAnimationFrame(tick);
  const cam = graph.camera();
  if (!cam) return;

  ptr.x += (ptr.tx - ptr.x) * 0.03;
  ptr.y += (ptr.ty - ptr.y) * 0.03;

  const t = (Date.now() - epoch) / 1000;
  const r = zoomRadius + Math.sin(t * 0.05) * 60;
  const a = t * 0.012 + ptr.x * 0.07;
  const ey = 80 + Math.sin(t * 0.025) * 50 + ptr.y * 40;

  cam.position.set(r * Math.cos(a), ey, r * Math.sin(a));
  cam.lookAt(0, 0, 0);

  const now = Date.now();
  for (const n of nodes) {
    if (!n.__ringMat) continue;
    const d = n._deg || 0;

    const tDot = n.__baseDot * (1 + d * 0.12);
    const cDot = n.__dot.scale.x;
    const sd = cDot + (tDot - cDot) * 0.04;
    n.__dot.scale.set(sd, sd, 1);

    const tRing = n.__baseRing * (1 + d * 0.10);
    const cRing = n.__ring.scale.x;
    const sr = cRing + (tRing - cRing) * 0.04;
    n.__ring.scale.set(sr, sr, 1);

    const age = (now - (n.__flickerAt || 0)) / 1000;
    const flicker = age < 0.6 ? Math.exp(-age * 6) * 0.65 : 0;
    n.__ringMat.opacity = 0.2 + flicker;
  }
})();

/* ── generation patterns ────────────────────────────────────── */

function addSingle() {
  const parent = pickByDegree(nd => nd.type === 'folder' || nd.type === 'system');
  if (!parent) return;
  const r = Math.random();
  const type = r < 0.12 ? 'transient' : r < 0.35 ? 'concept' : 'file';
  const nd = spawn(type, parent);
  wire(parent.id, nd.id);
  if (Math.random() < 0.25) {
    const sibling = pick(nd2 => nd2.id !== nd.id && neighborsOf(parent.id).includes(nd2.id));
    if (sibling) wire(nd.id, sibling.id);
  }
  refresh();
}

function addBurst() {
  const hub = pickByDegree(nd => nd.type === 'folder' || nd.type === 'system');
  if (!hub) return;
  const count = 3 + Math.floor(Math.random() * 5);
  let prev = hub;
  for (let i = 0; i < count; i++) {
    const type = Math.random() < 0.3 ? 'concept' : 'file';
    const nd = spawn(type, prev);
    wire(prev.id, nd.id);
    if (i > 0 && Math.random() < 0.35) wire(hub.id, nd.id);
    if (i > 1 && Math.random() < 0.2) {
      const other = pick(nd2 => nd2.id !== nd.id && nd2.id !== prev.id && nd2.type !== 'transient');
      if (other) wire(nd.id, other.id);
    }
    prev = nd;
  }
  refresh();
}

function addSubcluster() {
  const anchor = pickByDegree(nd => nd.type !== 'transient');
  if (!anchor) return;
  const root = spawn('folder', anchor);
  wire(anchor.id, root.id);
  const size = 4 + Math.floor(Math.random() * 6);
  for (let i = 0; i < size; i++) {
    const parent = i < 2 ? root : pick(nd => nd.id === root.id || neighborsOf(root.id).includes(nd.id));
    if (!parent) continue;
    const type = Math.random() < 0.4 ? 'concept' : 'file';
    const nd = spawn(type, parent);
    wire(parent.id, nd.id);
    if (Math.random() < 0.3 && i > 0) wire(root.id, nd.id);
  }
  refresh();
}

function crossLink() {
  if (nodes.length < 15) return;
  const a = pickByDegree(nd => nd.type !== 'transient');
  const b = pickByDegree(nd => nd.id !== a?.id && nd.type !== 'transient');
  if (a && b && !wired(a.id, b.id)) {
    wire(a.id, b.id);
    refresh();
  }
}

function closeTriangle() {
  const nd = pickByDegree(nd => nd.type !== 'transient' && degree(nd.id) >= 2);
  if (!nd) return;
  const nbrs = neighborsOf(nd.id);
  if (nbrs.length < 2) return;
  const a = nbrs[Math.floor(Math.random() * nbrs.length)];
  let b = a;
  for (let i = 0; i < 6; i++) {
    b = nbrs[Math.floor(Math.random() * nbrs.length)];
    if (b !== a && !wired(a, b)) break;
  }
  if (a !== b && !wired(a, b)) {
    wire(a, b);
    refresh();
  }
}

function decayTransients() {
  const now = Date.now();
  const dead = nodes.filter(nd => nd.ttl && now - nd.born > nd.ttl);
  if (dead.length) {
    kill(dead[Math.floor(Math.random() * dead.length)].id);
    refresh();
  }
}

function fission() {
  const dense = nodes.filter(nd => degree(nd.id) >= 6);
  if (!dense.length) return;
  const target = dense[Math.floor(Math.random() * dense.length)];
  const tLinks = links.filter(l => sid(l) === target.id || tid(l) === target.id);
  const cut = Math.min(2 + Math.floor(Math.random() * 2), tLinks.length - 1);
  const shuffled = [...tLinks].sort(() => Math.random() - 0.5);
  for (let i = 0; i < cut; i++) {
    const idx = links.indexOf(shuffled[i]);
    if (idx >= 0) links.splice(idx, 1);
  }
  refresh();
}

/* ── simulation timeline ────────────────────────────────────── */

// Phase 1 — seed cluster roots
const clusterRoots = [];
for (let i = 0; i < 6; i++) {
  setTimeout(() => {
    const nd = spawn('system');
    clusterRoots.push(nd);
    refresh();
  }, i * 300);
}

// Phase 2 — branch folders (2-3 per root)
setTimeout(() => {
  let n = 0;
  (function go() {
    const root = clusterRoots[n % clusterRoots.length];
    if (root) {
      const f = spawn('folder', root);
      wire(root.id, f.id);
      refresh();
    }
    if (++n < 18) setTimeout(go, 250 + Math.random() * 200);
  })();
}, 1800);

// Phase 3 — continuous growth: mix of singles, bursts, and subclusters
setTimeout(() => {
  (function go() {
    const r = Math.random();
    if (r < 0.55)      addSingle();
    else if (r < 0.80) addBurst();
    else               addSubcluster();
    setTimeout(go, 80 + Math.random() * 200);
  })();
}, 4000);

// Phase 4 — cross-linking and triangle closure
setTimeout(() => {
  (function go() {
    if (Math.random() < 0.5) crossLink(); else closeTriangle();
    setTimeout(go, 600 + Math.random() * 1200);
  })();
}, 6000);

// Phase 5 — decay
setTimeout(() => {
  (function go() {
    decayTransients();
    setTimeout(go, 600 + Math.random() * 1000);
  })();
}, 10000);

// Phase 6 — fission
setTimeout(() => {
  (function go() {
    fission();
    setTimeout(go, 12000 + Math.random() * 10000);
  })();
}, 25000);

/* ── resize ─────────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  graph.width(window.innerWidth).height(window.innerHeight);
});
