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
const NODE_CAP = mobile ? 350 : 1000;

/* ── state ──────────────────────────────────────────────────── */

const nodes = [];
const links = [];
let nid = 0;
let spawnIndex = 0;
const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = 2 * Math.PI / (PHI * PHI);

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
  const si = spawnIndex++;
  const angle = si * GOLDEN_ANGLE;
  const spiralR = Math.sqrt(si + 1) * 20;
  if (parent && parent.x !== undefined) {
    node.x = parent.x + Math.cos(angle) * spiralR * 0.35;
    node.y = parent.y + Math.sin(angle * 0.7) * spiralR * 0.15;
    node.z = parent.z + Math.sin(angle) * spiralR * 0.35;
  } else {
    node.x = Math.cos(angle) * spiralR;
    node.y = Math.sin(angle * 0.7) * spiralR * 0.3;
    node.z = Math.sin(angle) * spiralR;
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

/* ── geometric texture factories ────────────────────────────── */

const texCache = new Map();

function _rgb(hex) {
  const c = new THREE.Color(hex);
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function hexOutlineTexture(hex) {
  const key = 'hexO_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 128, cx = res / 2, cy = res / 2, r = res / 2 - 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const [R, G, B] = _rgb(hex);

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.strokeStyle = `rgba(${R},${G},${B}, 0.9)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

function hexDotTexture(hex) {
  const key = 'hexD_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 32, cx = res / 2, cy = res / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const [R, G, B] = _rgb(hex);

  ctx.beginPath();
  ctx.arc(cx, cy, res * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${R},${G},${B}, 1)`;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

function diamondTexture(hex) {
  const key = 'diam_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 64, cx = res / 2, cy = res / 2, r = res / 2 - 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const [R, G, B] = _rgb(hex);

  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = `rgba(${R},${G},${B}, 0.85)`;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

function triangleTexture(hex) {
  const key = 'tri_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 64, cx = res / 2, cy = res / 2, r = res / 2 - 4;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const [R, G, B] = _rgb(hex);

  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${R},${G},${B}, 0.85)`;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

function hardDotTexture(hex) {
  const key = 'hdot_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 32, cx = res / 2, cy = res / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const [R, G, B] = _rgb(hex);

  ctx.beginPath();
  ctx.arc(cx, cy, res * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${R},${G},${B}, 0.7)`;
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  texCache.set(key, tex);
  return tex;
}

function tendrilDotTexture(hex) {
  const key = 'tend_' + hex;
  if (texCache.has(key)) return texCache.get(key);
  const res = 16, cx = res / 2, cy = res / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const [R, G, B] = _rgb(hex);

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, res / 2);
  g.addColorStop(0, `rgba(${R},${G},${B}, 0.95)`);
  g.addColorStop(0.4, `rgba(${R},${G},${B}, 0.35)`);
  g.addColorStop(1, `rgba(${R},${G},${B}, 0)`);
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
        map: hexDotTexture(node.color),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dot = new THREE.Sprite(dMat);
      const ds = Math.cbrt(node.size) * 4;
      dot.scale.set(ds, ds, 1);
      group.add(dot);

      const rMat = new THREE.SpriteMaterial({
        map: hexOutlineTexture(node.color),
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

    const texFn = node.type === 'concept' ? triangleTexture
                : node.type === 'transient' ? hardDotTexture
                : diamondTexture;
    const mat = new THREE.SpriteMaterial({
      map: texFn(node.color),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const s = Math.cbrt(node.size) * 7;
    sprite.scale.set(s, s, 1);

    if (node.type === 'transient') {
      sprite.__baseScale = s;
      return sprite;
    }

    const group = new THREE.Group();
    group.add(sprite);

    const TENDRIL_N = 5;
    const tendrilR = s * 1.1;
    const tTex = tendrilDotTexture(node.color);
    const tendrils = [];

    for (let ti = 0; ti < TENDRIL_N; ti++) {
      const theta = 2 * Math.PI * ti / PHI;
      const phi = Math.acos(1 - 2 * (ti + 0.5) / TENDRIL_N);
      const tMat = new THREE.SpriteMaterial({
        map: tTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      });
      const tSprite = new THREE.Sprite(tMat);
      const tSize = s * 0.2;
      tSprite.scale.set(tSize, tSize, 1);
      group.add(tSprite);

      tendrils.push({
        sprite: tSprite,
        mat: tMat,
        dx: Math.sin(phi) * Math.cos(theta),
        dy: Math.sin(phi) * Math.sin(theta),
        dz: Math.cos(phi),
        targetR: tendrilR * (0.85 + Math.random() * 0.3),
        delay: ti * 0.08 + Math.random() * 0.15,
      });
    }

    node.__tendrils = tendrils;
    node.__mainMat = mat;
    node.__baseScale = s;
    return group;
  })
  .nodeThreeObjectExtend(false)
  .linkThreeObject(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    const mat = new THREE.LineBasicMaterial({
      color: palette.edge,
      transparent: true,
      opacity: 0,
    });
    return new THREE.Line(geo, mat);
  })
  .linkPositionUpdate((line, { start, end }, link) => {
    const age = (Date.now() - (link.born || 0)) / 1000;
    const t = Math.min(age / 0.8, 1);
    const ease = t * t * (3 - 2 * t);

    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

    const perpX = -dz / len, perpZ = dx / len;
    const SNAP = Math.PI / 3;
    const rawAngle = Math.atan2(perpZ, perpX);
    const snapped = Math.round(rawAngle / SNAP) * SNAP;
    const off = len * 0.12;
    const offX = Math.cos(snapped) * off;
    const offZ = Math.sin(snapped) * off;

    const m1x = start.x + dx * 0.33 + offX;
    const m1y = start.y + dy * 0.33;
    const m1z = start.z + dz * 0.33 + offZ;
    const m2x = start.x + dx * 0.67 + offX;
    const m2y = start.y + dy * 0.67;
    const m2z = start.z + dz * 0.67 + offZ;

    const pts = [
      start.x, start.y, start.z,
      start.x + (m1x - start.x) * ease, start.y + (m1y - start.y) * ease, start.z + (m1z - start.z) * ease,
      start.x + (m2x - start.x) * ease, start.y + (m2y - start.y) * ease, start.z + (m2z - start.z) * ease,
      start.x + (end.x - start.x) * ease, start.y + (end.y - start.y) * ease, start.z + (end.z - start.z) * ease,
    ];
    const pos = line.geometry.attributes.position;
    pos.array.set(pts);
    pos.needsUpdate = true;

    const wNow = Date.now();
    const wS = waveIntensity(sid(link), wNow);
    const wT = waveIntensity(tid(link), wNow);
    const wMax = Math.max(wS, wT);
    line.material.opacity = (0.18 + wMax * 0.3) * ease;
    if (wMax > 0.01) {
      line.material.color.setStyle(palette.primary);
    } else {
      line.material.color.setStyle(palette.edge);
    }
    return true;
  })
  .warmupTicks(0)
  .cooldownTime(Infinity)
  .d3AlphaDecay(0.03)
  .d3VelocityDecay(0.35);

graph.d3Force('charge').strength(-65);
graph.d3Force('link').distance(55);
graph.d3Force('center').strength(0.015);

/* ── radial orbital force ──────────────────────────────────── */

const RING_SPACING = 100;
const RADIAL_STRENGTH = 0.02;

function computeDepths() {
  const depth = new Map();
  const queue = [];
  for (const n of nodes) {
    if (n.type === 'system') { depth.set(n.id, 0); queue.push(n.id); }
  }
  while (queue.length) {
    const cur = queue.shift();
    const d = depth.get(cur);
    for (const l of links) {
      const s = sid(l), t = tid(l);
      const other = s === cur ? t : t === cur ? s : null;
      if (other !== null && !depth.has(other)) {
        depth.set(other, d + 1);
        queue.push(other);
      }
    }
  }
  for (const n of nodes) {
    if (!depth.has(n.id)) depth.set(n.id, 3);
  }
  return depth;
}

let cachedDepths = new Map();
let depthStale = true;

function radialForce(alpha) {
  if (depthStale) { cachedDepths = computeDepths(); depthStale = false; }
  const depth = cachedDepths;
  for (const n of nodes) {
    const d = depth.get(n.id) || 3;
    const targetR = d * RING_SPACING;
    const x = n.x || 0, y = n.y || 0, z = n.z || 0;
    const currentR = Math.sqrt(x * x + y * y + z * z) || 1;
    const factor = (targetR - currentR) / currentR * RADIAL_STRENGTH * alpha;
    n.vx = (n.vx || 0) + x * factor;
    n.vy = (n.vy || 0) + y * factor;
    n.vz = (n.vz || 0) + z * factor;
  }
}

graph.d3Force('radial', radialForce);

const fog = new THREE.FogExp2(0x000000, 0.00015);
fog.color.set(palette.bg);
graph.scene().fog = fog;

/* ── membrane faces ────────────────────────────────────────── */

const FACE_CAP = 80;
const faceMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color(palette.edge),
  transparent: true,
  opacity: 0.018,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
let faceGeo = new THREE.BufferGeometry();
let faceMesh = new THREE.Mesh(faceGeo, faceMat);
let faceTriIds = [];

function findTriangles() {
  const adj = new Set();
  const key = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
  for (const l of links) adj.add(key(sid(l), tid(l)));

  const nbrMap = new Map();
  for (const n of nodes) nbrMap.set(n.id, []);
  for (const l of links) {
    const s = sid(l), t = tid(l);
    nbrMap.get(s)?.push(t);
    nbrMap.get(t)?.push(s);
  }

  const tris = [];
  const seen = new Set();
  for (const n of nodes) {
    const nbrs = nbrMap.get(n.id);
    if (!nbrs || nbrs.length < 2) continue;
    for (let i = 0; i < nbrs.length; i++) {
      for (let j = i + 1; j < nbrs.length; j++) {
        if (adj.has(key(nbrs[i], nbrs[j]))) {
          const sorted = [n.id, nbrs[i], nbrs[j]].sort((a, b) => a - b);
          const tk = sorted.join(':');
          if (!seen.has(tk)) {
            seen.add(tk);
            tris.push(sorted);
            if (tris.length >= FACE_CAP) return tris;
          }
        }
      }
    }
  }
  return tris;
}

function rebuildFaces() {
  faceTriIds = findTriangles();
  const count = faceTriIds.length;

  if (faceMesh.parent) graph.scene().remove(faceMesh);
  faceGeo.dispose();

  if (!count) return;

  const pos = new Float32Array(count * 9);
  faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.frustumCulled = false;
  graph.scene().add(faceMesh);
}

function updateFacePositions() {
  if (!faceTriIds.length) return;
  const nodeMap = new Map();
  for (const n of nodes) nodeMap.set(n.id, n);

  const pos = faceMesh.geometry.attributes.position;
  if (!pos) return;
  const arr = pos.array;

  for (let i = 0; i < faceTriIds.length; i++) {
    const [aId, bId, cId] = faceTriIds[i];
    const a = nodeMap.get(aId), b = nodeMap.get(bId), c = nodeMap.get(cId);
    if (!a || !b || !c) continue;
    const off = i * 9;
    arr[off]     = a.x || 0; arr[off + 1] = a.y || 0; arr[off + 2] = a.z || 0;
    arr[off + 3] = b.x || 0; arr[off + 4] = b.y || 0; arr[off + 5] = b.z || 0;
    arr[off + 6] = c.x || 0; arr[off + 7] = c.y || 0; arr[off + 8] = c.z || 0;
  }
  pos.needsUpdate = true;
}

/* ── data pulses ───────────────────────────────────────────── */

const MAX_PULSES = 40;
const PULSE_SPEED = 0.7;
const pulses = [];
const pulseGroup = new THREE.Group();

const pulseDotTex = (() => {
  const res = 32, cx = res / 2, cy = res / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = res;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, res / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(200,220,255,0.9)');
  g.addColorStop(0.5, 'rgba(120,160,220,0.2)');
  g.addColorStop(1, 'rgba(80,120,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, res, res);
  return new THREE.CanvasTexture(canvas);
})();

function emitPulse() {
  const hubs = nodes.filter(n => (n.type === 'system' || n.type === 'folder') && degree(n.id) >= 2);
  if (!hubs.length) return;
  const hub = hubs[Math.floor(Math.random() * hubs.length)];

  const hubLinks = links.filter(l => sid(l) === hub.id || tid(l) === hub.id);
  if (!hubLinks.length) return;
  const link = hubLinks[Math.floor(Math.random() * hubLinks.length)];

  const fromId = hub.id;
  const toId = sid(link) === hub.id ? tid(link) : sid(link);

  const mat = new THREE.SpriteMaterial({
    map: pulseDotTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3, 3, 1);
  pulseGroup.add(sprite);

  pulses.push({
    sprite, mat, fromId, toId,
    progress: 0,
    born: Date.now(),
  });

  while (pulses.length > MAX_PULSES) {
    const old = pulses.shift();
    pulseGroup.remove(old.sprite);
    old.mat.dispose();
  }
}

function updatePulses() {
  const nodeMap = new Map();
  for (const n of nodes) nodeMap.set(n.id, n);

  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.progress += PULSE_SPEED / 60;

    if (p.progress > 1.2) {
      pulseGroup.remove(p.sprite);
      p.mat.dispose();
      pulses.splice(i, 1);
      continue;
    }

    const from = nodeMap.get(p.fromId);
    const to = nodeMap.get(p.toId);
    if (!from || !to) {
      pulseGroup.remove(p.sprite);
      p.mat.dispose();
      pulses.splice(i, 1);
      continue;
    }

    const t = Math.min(p.progress, 1);
    const ease = t * t * (3 - 2 * t);
    p.sprite.position.set(
      from.x + (to.x - from.x) * ease,
      from.y + (to.y - from.y) * ease,
      from.z + (to.z - from.z) * ease,
    );

    const fadeIn = Math.min(p.progress / 0.1, 1);
    const fadeOut = p.progress > 0.85 ? 1 - (p.progress - 0.85) / 0.35 : 1;
    p.mat.opacity = 0.8 * fadeIn * Math.max(fadeOut, 0);
  }
}

graph.scene().add(pulseGroup);

let pulseTimer = 0;
function maybePulse() {
  pulseTimer++;
  if (pulseTimer % 8 === 0) emitPulse();
}

/* ── crawl waves ───────────────────────────────────────────── */

const WAVE_HOP_MS = 60;
const WAVE_FADE_MS = 400;
const waveHit = new Map();

function fireWave() {
  const hubs = nodes.filter(n => (n.type === 'system' || n.type === 'folder') && degree(n.id) >= 3);
  if (!hubs.length) return;
  const origin = hubs[Math.floor(Math.random() * hubs.length)];

  const visited = new Set();
  const queue = [{ id: origin.id, depth: 0 }];
  visited.add(origin.id);
  const now = Date.now();

  while (queue.length) {
    const { id, depth } = queue.shift();
    waveHit.set(id, now + depth * WAVE_HOP_MS);

    const nbrs = neighborsOf(id);
    for (const nid of nbrs) {
      if (!visited.has(nid)) {
        visited.add(nid);
        queue.push({ id: nid, depth: depth + 1 });
      }
    }
  }
}

function waveIntensity(nodeId, now) {
  const hit = waveHit.get(nodeId);
  if (hit === undefined) return 0;
  const elapsed = now - hit;
  if (elapsed < 0) return 0;
  if (elapsed > WAVE_FADE_MS) return 0;
  const t = elapsed / WAVE_FADE_MS;
  return (1 - t) * (1 - t);
}

setInterval(fireWave, 4000 + Math.random() * 3000);
setTimeout(fireWave, 6000);

/* ── refresh ─────────────────────────────────────────────────── */

function refresh() {
  cap();
  depthStale = true;
  for (const n of nodes) {
    if (n.type === 'system' || n.type === 'folder') n._deg = degree(n.id);
  }
  graph.graphData({ nodes, links });
  rebuildFaces();
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

let zoomRadius = 500;
const ZOOM_MIN = 140;
const ZOOM_MAX = 3500;

window.addEventListener('wheel', e => {
  e.preventDefault();
  zoomRadius = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRadius + e.deltaY * 0.5));
}, { passive: false });

/* ── camera ─────────────────────────────────────────────────── */

const epoch = Date.now();
let frameIdx = 0;

(function tick() {
  requestAnimationFrame(tick);
  const cam = graph.camera();
  if (!cam) return;

  ptr.x += (ptr.tx - ptr.x) * 0.03;
  ptr.y += (ptr.ty - ptr.y) * 0.03;

  const t = (Date.now() - epoch) / 1000;
  const r = zoomRadius + Math.sin(t * 0.05) * 50;
  const a = t * 0.01 + ptr.x * 0.07;
  const ey = 120 + Math.sin(t * 0.02) * 60 + ptr.y * 40;

  cam.position.set(r * Math.cos(a), ey, r * Math.sin(a));
  cam.lookAt(0, 0, 0);

  if (frameIdx % 3 === 0) updateFacePositions();
  maybePulse();
  if (frameIdx % 2 === 0) updatePulses();
  frameIdx++;

  const now = Date.now();
  for (const n of nodes) {
    const wi = waveIntensity(n.id, now);

    if (n.__ringMat) {
      const d = n._deg || 0;

      const tDot = n.__baseDot * (1 + d * 0.12);
      const cDot = n.__dot.scale.x;
      const sd = cDot + (tDot - cDot) * 0.04;
      n.__dot.scale.set(sd, sd, 1);

      const tRing = n.__baseRing * (1 + d * 0.10);
      const cRing = n.__ring.scale.x;
      const sr = cRing + (tRing - cRing) * 0.04;
      n.__ring.scale.set(sr, sr, 1);

      n.__ring.material.rotation += 0.002;

      const age = (now - (n.__flickerAt || 0)) / 1000;
      const flicker = age < 0.6 ? Math.exp(-age * 6) * 0.65 : 0;
      n.__ringMat.opacity = 0.2 + flicker + wi * 0.35;

      const dotMat = n.__dot.material;
      if (wi > 0.01) {
        dotMat.color.setStyle('#ffffff');
        dotMat.opacity = 0.8 + wi * 0.2;
      } else {
        dotMat.color.setStyle(n.color);
        dotMat.opacity = 1;
      }
    }

    const obj = n.__threeObj;
    if (obj && !n.__ringMat) {
      if (n.__mainMat) {
        n.__mainMat.opacity = 0.85 + (wi > 0.01 ? wi * 0.15 : 0);
      } else if (obj.material) {
        if (wi > 0.01) {
          obj.material.opacity = 0.85 + wi * 0.15;
          const boost = 1 + wi * 0.4;
          obj.scale.set(obj.__baseScale * boost, obj.__baseScale * boost, 1);
        } else {
          obj.material.opacity = 0.85;
          if (obj.__baseScale) obj.scale.set(obj.__baseScale, obj.__baseScale, 1);
        }
      }

      if (n.__tendrils) {
        const age = (now - (n.born || 0)) / 1000;
        const bs = n.__baseScale;
        for (const td of n.__tendrils) {
          const tAge = Math.max(0, age - td.delay);
          const growT = Math.min(tAge / 1.8, 1);
          const eased = growT * growT * (3 - 2 * growT);

          const breath = eased > 0.8
            ? Math.sin(now * 0.0015 + td.dx * 5) * 0.12 * eased
            : 0;
          const r = td.targetR * (eased + breath);

          td.sprite.position.set(td.dx * r, td.dy * r, td.dz * r);
          td.mat.opacity = eased * 0.55 + wi * 0.25 * eased;

          const pulse = 1 + Math.sin(now * 0.002 + td.dy * 4) * 0.2 * eased;
          const dotSize = bs * 0.2 * pulse;
          td.sprite.scale.set(dotSize, dotSize, 1);
        }
      }
    }
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
