/**
 * Lorenz & Rössler attractor viewer — single canvas, multiple attractors
 * Click canvas to add attractor; each has its own control panel. X toggles UI; hint fades after 4s.
 */

const DT = 0.012;
const ROSSLER_TRAIL_LENGTH = 80;
const LORENZ_TRAIL_LENGTH = 15;
const LORENZ = { sigma: 10, rho: 28, beta: 8 / 3 };
const ROSSLER = { a: 0.2, b: 0.2, c: 5.7 };
const LORENZ_SCALE = 6;
const ROSSLER_SCALE = 12;
const MURMUR_SCALE = 20;
const MURMUR_DEFAULT_GRID = 20;
const MURMUR_DEFAULT_BOX = 12;
const MURMUR_BOX_MAX = 80;
const MURMUR_VERTICAL_SCALE_DEFAULT = 1;
const MURMUR_LINE_RADIUS = 0.35;
const MURMUR_BOID_MAX_SPEED = 0.18;
const MURMUR_BOID_MAX_FORCE = 0.035;
const MURMUR_COHESION_W = 0.5;
const MURMUR_COHESION_RADIUS = 0.25;
const MURMUR_ALIGNMENT_W = 0.95;
const MURMUR_SEPARATION_W = 1.5;
const MURMUR_SEPARATION_RADIUS = 0.18;
const MURMUR_NOISE_STRENGTH = 0.018;
const MURMUR_LORENZ_WEIGHT_DEFAULT = 0.11;
const MURMUR_LORENZ_PATH_POINTS = 80;
const MURMUR_LORENZ_FILL = 1.05;
const MURMUR_BREATHE_SPEED = 0.015;
const MURMUR_BREATHE_AMOUNT = 0.35;
const MURMUR_BREATHE_EXTENT_MIN = 3.5;
const MURMUR_BREATHE_EXTENT_AMP = 1.5;
const MURMUR_CLUSTER_RADIUS = 0.35;
const MURMUR_MERGE_RADIUS = 0.55;
const MURMUR_CLUSTER_EVERY = 20;
const MURMUR_TRAIL_LENGTH = 10;
const MURMUR_BOUNCE_RADIUS = 0.5;
const MURMUR_BOUNCE_STRENGTH = 0.04;
const MURMUR_SPLIT_COUNT_THRESHOLD = 70;
const MURMUR_SPLIT_SPREAD_THRESHOLD = 0.25;
const MURMUR_FADE_COUNT_THRESHOLD = 8;
const MURMUR_CONNECT_RADIUS = 0.45;
const MURMUR_TORUS_MINOR = 0.4;
const PAN_SPEED = 0.5;

let attractors = [];
let nextAttractorId = 1;
let selectedAttractorId = null;
let cKeyHeld = false;

// Single shared camera
let orbitTheta = 0.6;
let orbitPhi = 0.4;
let zoomDistance = 350;
let centerX = 0, centerY = 0, centerZ = 0;
let isDragging = false;
let dragPrevX, dragPrevY;
let handToolActive = false;

let hintFadeTimeout = null;

function parseHexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 212, b: 255 };
  const h = hex.replace(/^#/, '');
  if (h.length !== 6 && h.length !== 3) return { r: 0, g: 212, b: 255 };
  const r = h.length === 6 ? parseInt(h.slice(0, 2), 16) : parseInt(h[0] + h[0], 16);
  const g = h.length === 6 ? parseInt(h.slice(2, 4), 16) : parseInt(h[1] + h[1], 16);
  const b = h.length === 6 ? parseInt(h.slice(4, 6), 16) : parseInt(h[2] + h[2], 16);
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 212 : g, b: isNaN(b) ? 255 : b };
}

function lightenRgb(r, g, b, t) {
  t = constrain(t, 0, 1);
  return {
    r: Math.round(r + (255 - r) * t),
    g: Math.round(g + (255 - g) * t),
    b: Math.round(b + (255 - b) * t),
  };
}

function defaultAttractorState() {
  return {
    mode: 'lorenz',
    speedMultiplier: 0.5,
    numParticles: 500,
    showLines: true,
    twinkleSpeed: 0.02,
    baseOpacity: 80,
    decayAlpha: 100,
    pathOpacity: 30,
    particles: [],
    rosslerPaths: [],
    murmurVertices: [],
    murmurBoids: [],
    murmurBoxExtent: MURMUR_DEFAULT_BOX,
    murmurVerticalScale: MURMUR_VERTICAL_SCALE_DEFAULT,
    murmurGridSize: MURMUR_DEFAULT_GRID,
    murmurSpacing: 1,
    murmurVideo: null,
    murmurVideoObjectURL: null,
    murmurVideoReady: false,
    murmurGif: null,
    murmurGifObjectURL: null,
    murmurGifReady: false,
    murmurGifBuffer: null,
    murmurWaveSpeed: 0.02,
    murmurBlobWeight: 0.4,
    murmurBlob: { x: 5, y: 5, z: 5 },
    murmurShowFluctuations: false,
    murmurLorenzPath: [],
    murmurLorenzPhase: { x: 5, y: 5, z: 5 },
    murmurLorenzWeight: MURMUR_LORENZ_WEIGHT_DEFAULT,
    murmurSwarmIds: [],
    murmurClusterFrame: 0,
    murmurShowTrails: true,
    murmurShowGrid: true,
    murmurShowInstrumentation: false,
    murmurBirdShape: true,
    murmurBaseColorHex: '#00d4ff',
    murmurBoxBreathe: true,
    murmurBoxBreatheSpeed: 0.02,
    murmurCurrentExtent: 2.4,
    murmurSwarmCentroids: [],
    murmurSwarmCounts: [],
    murmurContainerShape: 'box',
    scaleToWorld: LORENZ_SCALE,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
  };
}

function createAttractor() {
  const id = nextAttractorId++;
  const a = {
    id,
    ...defaultAttractorState(),
  };
  initAttractorParticles(a);
  attractors.push(a);
  a.offsetX = (attractors.length - 1) * 15;
  a.offsetY = 0;
  a.offsetZ = 0;
  return a;
}

function removeAttractor(id) {
  attractors = attractors.filter((a) => a.id !== id);
  const wasSelected = selectedAttractorId === id;
  if (wasSelected) selectedAttractorId = attractors.length ? attractors[0].id : null;
  const panel = document.querySelector(`.attractor-panel[data-attractor-id="${id}"]`);
  if (panel) panel.remove();
  if (wasSelected && selectedAttractorId != null) {
    document.querySelectorAll('.attractor-panel.selected').forEach((el) => el.classList.remove('selected'));
    const nextPanel = document.querySelector(`.attractor-panel[data-attractor-id="${selectedAttractorId}"]`);
    if (nextPanel) nextPanel.classList.add('selected');
  }
}

function initAttractorParticles(a) {
  a.particles = [];
  a.rosslerPaths = [];
  a.murmurVertices = [];
  if (a.mode === 'lorenz') {
    a.scaleToWorld = LORENZ_SCALE;
    for (let i = 0; i < a.numParticles; i++) {
      a.particles.push({
        x: 5 + random(-2, 2),
        y: 5 + random(-2, 2),
        z: 5 + random(-2, 2),
        hue: random(180, 260),
        phase: random(TWO_PI),
        trail: [],
        vx: 0, vy: 0, vz: 0,
      });
    }
  } else if (a.mode === 'murmuration') {
    a.scaleToWorld = MURMUR_SCALE;
    a.murmurVertices = [];
    a.murmurBoids = [];
    const extent = Math.max(1, Math.min(MURMUR_BOX_MAX, a.murmurBoxExtent ?? MURMUR_DEFAULT_BOX));
    const vertScale = Math.max(0.15, Math.min(1, a.murmurVerticalScale ?? MURMUR_VERTICAL_SCALE_DEFAULT));
    const extentY = extent * vertScale;
    const n = Math.max(100, Math.min(800, Math.round(a.numParticles * 0.5) || 400));
    for (let i = 0; i < n; i++) {
      a.murmurBoids.push({
        x: random(-extent, extent),
        y: random(-extentY, extentY),
        z: random(-extent, extent),
        vx: random(-0.03, 0.03),
        vy: random(-0.03, 0.03),
        vz: random(-0.03, 0.03),
        trail: [],
        sizeScale: 0.85 + random(0.3),
        phase: random(TWO_PI),
      });
    }
    a.murmurBlob = { x: 5, y: 5, z: 5 };
    a.murmurLorenzPath = [];
    a.murmurLorenzPhase = { x: 5, y: 5, z: 5 };
    a.murmurSwarmIds = a.murmurBoids.map(() => 0);
    a.murmurClusterFrame = 0;
  } else {
    a.scaleToWorld = ROSSLER_SCALE;
    const pathCount = Math.min(a.numParticles, 40);
    for (let i = 0; i < pathCount; i++) {
      a.rosslerPaths.push({
        x: random(-8, 8),
        y: 0,
        z: 0,
        hue: random(20, 60),
        trail: [],
      });
    }
  }
}

// Advance one Lorenz step (in Lorenz space)
function murmurLorenzAdvance(phase, dt) {
  const { sigma, rho, beta } = LORENZ;
  const dx = sigma * (phase.y - phase.x);
  const dy = phase.x * (rho - phase.z) - phase.y;
  const dz = phase.x * phase.y - beta * phase.z;
  phase.x += dx * dt;
  phase.y += dy * dt;
  phase.z += dz * dt;
}

// Map Lorenz (x,y,z) to cube space; MURMUR_LORENZ_FILL > 1 makes path use more of the cube
function murmurLorenzToCube(lx, ly, lz, extent, extentY) {
  const scaleXZ = (extent * MURMUR_LORENZ_FILL) / 20;
  const scaleY = (extentY * MURMUR_LORENZ_FILL) / 25;
  return {
    x: (lx / 20) * scaleXZ,
    y: ((lz - 25) / 25) * scaleY,
    z: (ly / 20) * scaleXZ,
  };
}

// Update Lorenz path and return nearest point on path to (bx, by, bz)
function murmurNearestOnLorenzPath(bx, by, bz, path) {
  if (!path || path.length < 2) return null;
  let best = path[0];
  let bestD = 1e30;
  for (let k = 0; k < path.length; k++) {
    const p = path[k];
    const d = (p.x - bx) ** 2 + (p.y - by) ** 2 + (p.z - bz) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

// Draw a bird silhouette (teardrop + wings); forward = +Y local (matches cone axis in p5)
function drawBoidBird(b, lenScale, useFill = true) {
  const bodyLen = 0.1 * lenScale * (b.sizeScale ?? 1);
  const wingSpan = 0.05 * lenScale * (b.sizeScale ?? 1);
  const flutter = (b.phase != null) ? 0.92 + 0.16 * sin(frameCount * 0.2 + (b.phase ?? 0)) : 1;
  push();
  scale(flutter);
  noStroke();
  if (useFill) {
    beginShape(TRIANGLES);
    vertex(0, bodyLen, 0);
    vertex(-bodyLen * 0.4, -bodyLen * 0.6, 0);
    vertex(bodyLen * 0.4, -bodyLen * 0.6, 0);
    endShape(CLOSE);
  }
  strokeWeight(0.01);
  stroke(0, 0, 0, 40);
  line(0, 0, 0, -wingSpan * 0.9, wingSpan * 0.2, wingSpan * 0.25);
  line(0, 0, 0, wingSpan * 0.9, wingSpan * 0.2, wingSpan * 0.25);
  noStroke();
  pop();
}

// Connected-components clustering: returns array of swarmId per boid (0..K-1)
function murmurClusterBoids(boids, extent, clusterRadius, mergeRadius) {
  const n = boids.length;
  const parent = [];
  for (let i = 0; i < n; i++) parent[i] = i;
  function find(i) {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i, j) {
    parent[find(i)] = find(j);
  }
  const r = extent * clusterRadius;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = boids[j].x - boids[i].x, dy = boids[j].y - boids[i].y, dz = boids[j].z - boids[i].z;
      if (dx * dx + dy * dy + dz * dz < r * r) union(i, j);
    }
  }
  const comp = new Map();
  let nextId = 0;
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!comp.has(root)) comp.set(root, nextId++);
  }
  let swarmIds = [];
  for (let i = 0; i < n; i++) swarmIds[i] = comp.get(find(i));

  const centroids = [];
  const counts = [];
  for (let s = 0; s < nextId; s++) {
    centroids.push({ x: 0, y: 0, z: 0 });
    counts.push(0);
  }
  for (let i = 0; i < n; i++) {
    const s = swarmIds[i];
    const b = boids[i];
    centroids[s].x += b.x;
    centroids[s].y += b.y;
    centroids[s].z += b.z;
    counts[s]++;
  }
  for (let s = 0; s < nextId; s++) {
    const c = counts[s];
    if (c > 0) {
      centroids[s].x /= c;
      centroids[s].y /= c;
      centroids[s].z /= c;
    }
  }
  const mergeR = extent * mergeRadius;
  const swarmParent = [];
  for (let s = 0; s < nextId; s++) swarmParent[s] = s;
  function findSwarm(s) {
    if (swarmParent[s] !== s) swarmParent[s] = findSwarm(swarmParent[s]);
    return swarmParent[s];
  }
  for (let s1 = 0; s1 < nextId; s1++) {
    for (let s2 = s1 + 1; s2 < nextId; s2++) {
      const c1 = centroids[s1], c2 = centroids[s2];
      const dx = c2.x - c1.x, dy = c2.y - c1.y, dz = c2.z - c1.z;
      if (dx * dx + dy * dy + dz * dz < mergeR * mergeR) {
        swarmParent[findSwarm(s2)] = findSwarm(s1);
      }
    }
  }
  const unique = [...new Set(swarmIds.map((id) => findSwarm(id)))];
  const remap = new Map();
  unique.forEach((id, idx) => remap.set(id, idx));
  swarmIds = swarmIds.map((id) => remap.get(findSwarm(id)));

  let K = unique.length;
  centroids.length = 0;
  counts.length = 0;
  for (let s = 0; s < K; s++) {
    centroids.push({ x: 0, y: 0, z: 0 });
    counts.push(0);
  }
  for (let i = 0; i < n; i++) {
    const s = swarmIds[i];
    const b = boids[i];
    centroids[s].x += b.x;
    centroids[s].y += b.y;
    centroids[s].z += b.z;
    counts[s]++;
  }
  for (let s = 0; s < K; s++) {
    const c = counts[s];
    if (c > 0) {
      centroids[s].x /= c;
      centroids[s].y /= c;
      centroids[s].z /= c;
    }
  }

  nextId = K;
  for (let s = 0; s < K; s++) {
    if (counts[s] < MURMUR_SPLIT_COUNT_THRESHOLD) continue;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      if (swarmIds[i] !== s) continue;
      const b = boids[i];
      const dx = b.x - centroids[s].x, dy = b.y - centroids[s].y, dz = b.z - centroids[s].z;
      variance += dx * dx + dy * dy + dz * dz;
    }
    variance /= counts[s];
    const spread = sqrt(variance);
    if (spread < extent * MURMUR_SPLIT_SPREAD_THRESHOLD) continue;
    const indices = [];
    for (let i = 0; i < n; i++) if (swarmIds[i] === s) indices.push(i);
    const ax = random(-1, 1), ay = random(-1, 1), az = random(-1, 1);
    const amag = sqrt(ax * ax + ay * ay + az * az) || 1e-6;
    const ux = ax / amag, uy = ay / amag, uz = az / amag;
    const cx = centroids[s].x, cy = centroids[s].y, cz = centroids[s].z;
    centroids.push({ x: 0, y: 0, z: 0 });
    counts.push(0);
    const newId = nextId++;
    let moved = 0;
    for (const i of indices) {
      const b = boids[i];
      const dot = (b.x - cx) * ux + (b.y - cy) * uy + (b.z - cz) * uz;
      if (dot < 0) {
        swarmIds[i] = newId;
        centroids[newId].x += b.x;
        centroids[newId].y += b.y;
        centroids[newId].z += b.z;
        counts[newId]++;
        moved++;
      }
    }
    if (counts[newId] > 0) {
      centroids[newId].x /= counts[newId];
      centroids[newId].y /= counts[newId];
      centroids[newId].z /= counts[newId];
      const remain = counts[s] - moved;
      counts[s] = remain;
      if (remain > 0) {
        let cx2 = 0, cy2 = 0, cz2 = 0;
        for (const i of indices) {
          if (swarmIds[i] === s) {
            cx2 += boids[i].x;
            cy2 += boids[i].y;
            cz2 += boids[i].z;
          }
        }
        centroids[s].x = cx2 / remain;
        centroids[s].y = cy2 / remain;
        centroids[s].z = cz2 / remain;
      }
    } else {
      counts[newId] = 0;
      nextId--;
      centroids.pop();
      counts.pop();
    }
  }
  K = nextId;
  for (let s = 0; s < K; s++) {
    counts[s] = 0;
    centroids[s].x = 0;
    centroids[s].y = 0;
    centroids[s].z = 0;
  }
  for (let i = 0; i < n; i++) {
    const s = swarmIds[i];
    const b = boids[i];
    centroids[s].x += b.x;
    centroids[s].y += b.y;
    centroids[s].z += b.z;
    counts[s]++;
  }
  for (let s = 0; s < K; s++) {
    const c = counts[s];
    if (c > 0) {
      centroids[s].x /= c;
      centroids[s].y /= c;
      centroids[s].z /= c;
    }
  }

  for (let s = 0; s < K; s++) {
    if (counts[s] >= MURMUR_FADE_COUNT_THRESHOLD || K <= 1) continue;
    let bestT = -1;
    let bestD = 1e30;
    for (let t = 0; t < K; t++) {
      if (t === s || counts[t] === 0) continue;
      const dx = centroids[t].x - centroids[s].x;
      const dy = centroids[t].y - centroids[s].y;
      const dz = centroids[t].z - centroids[s].z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        bestT = t;
      }
    }
    if (bestT >= 0) {
      for (let i = 0; i < n; i++) {
        if (swarmIds[i] === s) swarmIds[i] = bestT;
      }
    }
  }
  const alive = [];
  for (let s = 0; s < K; s++) {
    let c = 0;
    for (let i = 0; i < n; i++) if (swarmIds[i] === s) c++;
    if (c > 0) alive.push(s);
  }
  const finalRemap = new Map();
  alive.forEach((id, idx) => finalRemap.set(id, idx));
  swarmIds = swarmIds.map((id) => finalRemap.get(id));

  const numSwarms = alive.length;
  const outCentroids = [];
  const outCounts = [];
  for (let s = 0; s < numSwarms; s++) {
    outCentroids.push({ x: 0, y: 0, z: 0 });
    outCounts.push(0);
  }
  for (let i = 0; i < n; i++) {
    const s = swarmIds[i];
    const b = boids[i];
    outCentroids[s].x += b.x;
    outCentroids[s].y += b.y;
    outCentroids[s].z += b.z;
    outCounts[s]++;
  }
  for (let s = 0; s < numSwarms; s++) {
    const c = outCounts[s];
    if (c > 0) {
      outCentroids[s].x /= c;
      outCentroids[s].y /= c;
      outCentroids[s].z /= c;
    }
  }
  return { swarmIds, centroids: outCentroids, counts: outCounts };
}

function murmurContainBoid(b, extent, extentY, shape) {
  const { sqrt, abs, min, max } = Math;
  if (shape === 'box') {
    if (b.x < -extent) { b.x = -extent; b.vx = abs(b.vx); }
    if (b.x > extent) { b.x = extent; b.vx = -abs(b.vx); }
    if (b.y < -extentY) { b.y = -extentY; b.vy = abs(b.vy); }
    if (b.y > extentY) { b.y = extentY; b.vy = -abs(b.vy); }
    if (b.z < -extent) { b.z = -extent; b.vz = abs(b.vz); }
    if (b.z > extent) { b.z = extent; b.vz = -abs(b.vz); }
    return;
  }
  if (shape === 'sphere') {
    const r = sqrt(b.x * b.x + b.y * b.y + b.z * b.z) || 1e-9;
    if (r <= extent) return;
    const nx = b.x / r; const ny = b.y / r; const nz = b.z / r;
    b.x = extent * nx; b.y = extent * ny; b.z = extent * nz;
    const vr = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vr > 0) { b.vx -= 2 * vr * nx; b.vy -= 2 * vr * ny; b.vz -= 2 * vr * nz; }
    return;
  }
  if (shape === 'ellipsoid') {
    const ux = b.x / extent; const uy = b.y / extentY; const uz = b.z / extent;
    const r = sqrt(ux * ux + uy * uy + uz * uz) || 1e-9;
    if (r <= 1) return;
    const s = 1 / r;
    const nx = (ux * s) / extent; const ny = (uy * s) / extentY; const nz = (uz * s) / extent;
    const nlen = sqrt(nx * nx + ny * ny + nz * nz) || 1e-9;
    const nxn = nx / nlen; const nyn = ny / nlen; const nzn = nz / nlen;
    b.x = extent * ux * s; b.y = extentY * uy * s; b.z = extent * uz * s;
    const vr = b.vx * nxn + b.vy * nyn + b.vz * nzn;
    if (vr > 0) { b.vx -= 2 * vr * nxn; b.vy -= 2 * vr * nyn; b.vz -= 2 * vr * nzn; }
    return;
  }
  if (shape === 'cylinder') {
    if (b.y < -extentY) { b.y = -extentY; b.vy = abs(b.vy); }
    if (b.y > extentY) { b.y = extentY; b.vy = -abs(b.vy); }
    const r = sqrt(b.x * b.x + b.z * b.z) || 1e-9;
    if (r <= extent) return;
    const nx = b.x / r; const nz = b.z / r;
    b.x = extent * nx; b.z = extent * nz;
    const vr = b.vx * nx + b.vz * nz;
    if (vr > 0) { b.vx -= 2 * vr * nx; b.vz -= 2 * vr * nz; }
    return;
  }
  if (shape === 'cone') {
    if (b.y < -extentY) { b.y = -extentY; b.vy = abs(b.vy); }
    if (b.y > extentY) { b.y = extentY; b.vy = -abs(b.vy); }
    const maxR = extent * (extentY - b.y) / (2 * extentY);
    const r = sqrt(b.x * b.x + b.z * b.z) || 1e-9;
    if (r <= maxR) return;
    if (maxR < 1e-9) { b.x = 0; b.z = 0; b.vx *= -0.5; b.vz *= -0.5; return; }
    const nx = b.x / r; const nz = b.z / r;
    b.x = maxR * nx; b.z = maxR * nz;
    const vr = b.vx * nx + b.vz * nz;
    if (vr > 0) { b.vx -= 2 * vr * nx; b.vz -= 2 * vr * nz; }
    return;
  }
  if (shape === 'torus') {
    const R = extent;
    const r = extent * MURMUR_TORUS_MINOR;
    const rHoz = sqrt(b.x * b.x + b.z * b.z) || 1e-9;
    let cx = 0, cy = 0, cz = 0;
    if (rHoz > 1e-9) {
      cx = R * b.x / rHoz; cz = R * b.z / rHoz;
    } else {
      cx = R; cz = 0;
    }
    const dx = b.x - cx; const dy = b.y - cy; const dz = b.z - cz;
    const d = sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    if (d <= r) return;
    const s = r / d;
    b.x = cx + dx * s; b.y = cy + dy * s; b.z = cz + dz * s;
    return;
  }
  if (shape === 'pyramid') {
    if (b.y < -extentY) { b.y = -extentY; b.vy = abs(b.vy); }
    if (b.y > extentY) { b.y = extentY; b.vy = -abs(b.vy); }
    const w = extent * (extentY - b.y) / (2 * extentY);
    if (b.x < -w) { b.x = -w; b.vx = abs(b.vx); }
    if (b.x > w) { b.x = w; b.vx = -abs(b.vx); }
    if (b.z < -w) { b.z = -w; b.vz = abs(b.vz); }
    if (b.z > w) { b.z = w; b.vz = -abs(b.vz); }
    return;
  }
  if (shape === 'dome') {
    if (b.y < 0) { b.y = 0; b.vy = abs(b.vy); }
    const r = sqrt(b.x * b.x + b.y * b.y + b.z * b.z) || 1e-9;
    if (r <= extent) return;
    const nx = b.x / r; const ny = b.y / r; const nz = b.z / r;
    b.x = extent * nx; b.y = extent * ny; b.z = extent * nz;
    const vr = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vr > 0) { b.vx -= 2 * vr * nx; b.vy -= 2 * vr * ny; b.vz -= 2 * vr * nz; }
    return;
  }
}

function murmurBoidStep(a) {
  const boids = a.murmurBoids;
  if (!boids.length) return;
  let extent;
  if (a.murmurBoxBreathe !== false) {
    const speed = a.murmurBoxBreatheSpeed ?? 0.02;
    extent = MURMUR_BREATHE_EXTENT_MIN + MURMUR_BREATHE_EXTENT_AMP * (0.5 + 0.5 * sin(frameCount * speed));
  } else {
    extent = Math.max(1, Math.min(MURMUR_BOX_MAX, a.murmurBoxExtent ?? MURMUR_DEFAULT_BOX));
  }
  a.murmurCurrentExtent = extent;
  const vertScale = Math.max(0.15, Math.min(1, a.murmurVerticalScale ?? MURMUR_VERTICAL_SCALE_DEFAULT));
  const extentY = extent * vertScale;

  const spd = (a.speedMultiplier != null) ? a.speedMultiplier : 1;
  const dt = DT * spd * 2;

  if (!a.murmurLorenzPath) a.murmurLorenzPath = [];
  if (!a.murmurLorenzPhase) a.murmurLorenzPhase = { x: 5, y: 5, z: 5 };
  for (let step = 0; step < 3; step++) {
    murmurLorenzAdvance(a.murmurLorenzPhase, dt / 3);
    const pt = murmurLorenzToCube(a.murmurLorenzPhase.x, a.murmurLorenzPhase.y, a.murmurLorenzPhase.z, extent, extentY);
    a.murmurLorenzPath.push(pt);
    if (a.murmurLorenzPath.length > MURMUR_LORENZ_PATH_POINTS) a.murmurLorenzPath.shift();
  }

  if (!a.murmurSwarmIds || a.murmurSwarmIds.length !== boids.length) {
    a.murmurSwarmIds = boids.map(() => 0);
  }
  a.murmurClusterFrame = (a.murmurClusterFrame || 0) + 1;
  if (a.murmurClusterFrame >= MURMUR_CLUSTER_EVERY) {
    a.murmurClusterFrame = 0;
    const result = murmurClusterBoids(boids, extent, MURMUR_CLUSTER_RADIUS, MURMUR_MERGE_RADIUS);
    a.murmurSwarmIds = result.swarmIds;
    a.murmurSwarmCentroids = result.centroids;
    a.murmurSwarmCounts = result.counts;
  }
  if (!a.murmurSwarmCentroids || !a.murmurSwarmCounts || a.murmurSwarmCentroids.length === 0) {
    const n = boids.length;
    const ids = a.murmurSwarmIds || boids.map(() => 0);
    let K = 0;
    for (let i = 0; i < n; i++) K = Math.max(K, (ids[i] ?? 0) + 1);
    K = Math.max(1, K);
    a.murmurSwarmCentroids = [];
    a.murmurSwarmCounts = [];
    for (let s = 0; s < K; s++) {
      a.murmurSwarmCentroids.push({ x: 0, y: 0, z: 0 });
      a.murmurSwarmCounts.push(0);
    }
    for (let i = 0; i < n; i++) {
      const s = ids[i] ?? 0;
      const b = boids[i];
      a.murmurSwarmCentroids[s].x += b.x;
      a.murmurSwarmCentroids[s].y += b.y;
      a.murmurSwarmCentroids[s].z += b.z;
      a.murmurSwarmCounts[s]++;
    }
    for (let s = 0; s < K; s++) {
      const c = a.murmurSwarmCounts[s];
      if (c > 0) {
        a.murmurSwarmCentroids[s].x /= c;
        a.murmurSwarmCentroids[s].y /= c;
        a.murmurSwarmCentroids[s].z /= c;
      }
    }
  }

  const breathe = 1 + MURMUR_BREATHE_AMOUNT * sin(frameCount * MURMUR_BREATHE_SPEED);
  const perception = Math.min(extent * 0.45, 6) * sqrt(breathe);
  const separationRadius = extent * MURMUR_SEPARATION_RADIUS;
  const cohesionMinDist = extent * MURMUR_COHESION_RADIUS * (1 / breathe);
  const maxSpeed = MURMUR_BOID_MAX_SPEED;
  const maxForce = MURMUR_BOID_MAX_FORCE;

  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    const mySwarm = a.murmurSwarmIds[i];
    let cx = 0, cy = 0, cz = 0;
    let ax = 0, ay = 0, az = 0;
    let sx = 0, sy = 0, sz = 0;
    let nCohesion = 0, nAlign = 0, nSep = 0;

    for (let j = 0; j < boids.length; j++) {
      if (i === j) continue;
      const o = boids[j];
      const dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
      const d = sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-6) continue;
      const sameSwarm = a.murmurSwarmIds[j] === mySwarm;
      if (d < perception && sameSwarm) {
        cx += o.x; cy += o.y; cz += o.z;
        nCohesion++;
        ax += o.vx; ay += o.vy; az += o.vz;
        nAlign++;
      }
      if (d < separationRadius) {
        const f = (1 / d - 1 / separationRadius) / d;
        sx -= (dx / d) * f;
        sy -= (dy / d) * f;
        sz -= (dz / d) * f;
        nSep++;
      }
    }

    let fx = 0, fy = 0, fz = 0;
    if (nCohesion > 0) {
      cx = cx / nCohesion - b.x;
      cy = cy / nCohesion - b.y;
      cz = cz / nCohesion - b.z;
      const distToCenter = sqrt(cx * cx + cy * cy + cz * cz) || 1e-6;
      if (distToCenter > cohesionMinDist) {
        const mag = distToCenter;
        fx += (cx / mag) * MURMUR_COHESION_W;
        fy += (cy / mag) * MURMUR_COHESION_W;
        fz += (cz / mag) * MURMUR_COHESION_W;
      }
    }
    if (nAlign > 0) {
      ax = ax / nAlign - b.vx;
      ay = ay / nAlign - b.vy;
      az = az / nAlign - b.vz;
      const mag = sqrt(ax * ax + ay * ay + az * az) || 1;
      fx += (ax / mag) * MURMUR_ALIGNMENT_W;
      fy += (ay / mag) * MURMUR_ALIGNMENT_W;
      fz += (az / mag) * MURMUR_ALIGNMENT_W;
    }
    fx += sx * MURMUR_SEPARATION_W;
    fy += sy * MURMUR_SEPARATION_W;
    fz += sz * MURMUR_SEPARATION_W;

    const lorenzW = a.murmurLorenzWeight ?? MURMUR_LORENZ_WEIGHT_DEFAULT;
    const pathPt = murmurNearestOnLorenzPath(b.x, b.y, b.z, a.murmurLorenzPath);
    if (pathPt) {
      const tx = pathPt.x - b.x, ty = pathPt.y - b.y, tz = pathPt.z - b.z;
      const dist = sqrt(tx * tx + ty * ty + tz * tz) || 1e-6;
      const pull = lorenzW * min(1, dist / (extent * 0.3));
      fx += (tx / dist) * pull;
      fy += (ty / dist) * pull;
      fz += (tz / dist) * pull;
    }

    const bounceR = extent * MURMUR_BOUNCE_RADIUS;
    const centroids = a.murmurSwarmCentroids || [];
    for (let t = 0; t < centroids.length; t++) {
      if (t === mySwarm) continue;
      const ct = centroids[t];
      const dx = ct.x - b.x, dy = ct.y - b.y, dz = ct.z - b.z;
      const d = sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      if (d < bounceR && d > 1e-6) {
        const strength = MURMUR_BOUNCE_STRENGTH * (1 - d / bounceR);
        fx -= (dx / d) * strength;
        fy -= (dy / d) * strength;
        fz -= (dz / d) * strength;
      }
    }

    fx += random(-1, 1) * MURMUR_NOISE_STRENGTH;
    fy += random(-1, 1) * MURMUR_NOISE_STRENGTH;
    fz += random(-1, 1) * MURMUR_NOISE_STRENGTH;

    const fmag = sqrt(fx * fx + fy * fy + fz * fz) || 1;
    const scaleF = min(1, maxForce / fmag);
    b.vx += fx * scaleF;
    b.vy += fy * scaleF;
    b.vz += fz * scaleF;
    const vmag = sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz) || 1;
    if (vmag > maxSpeed) {
      const s = maxSpeed / vmag;
      b.vx *= s; b.vy *= s; b.vz *= s;
    }
    b.x += b.vx * spd;
    b.y += b.vy * spd;
    b.z += b.vz * spd;

    const containerShape = a.murmurContainerShape || 'box';
    murmurContainBoid(b, extent, extentY, containerShape);
    if (!b.trail) b.trail = [];
    b.trail.push({ x: b.x, y: b.y, z: b.z });
    if (b.trail.length > MURMUR_TRAIL_LENGTH) b.trail.shift();
  }
}

function createPanelForAttractor(a) {
  const id = a.id;
  const pre = `a${id}-`;
  const root = document.createElement('div');
  root.className = 'attractor-panel' + (a.mode === 'rossler' ? ' rossler' : '') + (a.mode === 'murmuration' ? ' murmuration' : '');
  root.dataset.attractorId = String(id);
  root.innerHTML = `
    <div class="panel-header">
      <span class="title">Attractor ${id}</span>
      <div class="panel-header-btns">
        <button type="button" class="minimize-btn" aria-label="Minimize">▼</button>
        <button type="button" class="remove-btn" aria-label="Remove">×</button>
      </div>
    </div>
    <div class="panel-body">
      <div class="panel-section">
        <div class="panel-section-title">Attractor</div>
        <select id="${pre}type">
          <option value="lorenz" ${a.mode === 'lorenz' ? 'selected' : ''}>Lorenz</option>
          <option value="rossler" ${a.mode === 'rossler' ? 'selected' : ''}>Rössler</option>
          <option value="murmuration" ${a.mode === 'murmuration' ? 'selected' : ''}>Murmuration</option>
        </select>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Motion</div>
        <div class="slider-row"><label for="${pre}speed">Speed</label><input type="range" id="${pre}speed" min="0.05" max="3" value="${a.speedMultiplier}" step="0.05"><span class="value" id="${pre}speedVal">${a.speedMultiplier.toFixed(2)}</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Display</div>
        <div class="slider-row"><label for="${pre}particles">Particles</label><input type="range" id="${pre}particles" min="100" max="2000" value="${a.numParticles}" step="50"><span class="value" id="${pre}particlesVal">${a.numParticles}</span></div>
        <label class="toggle-row">
          <input type="checkbox" id="${pre}lines" ${a.showLines ? 'checked' : ''}>
          <span>Lines</span>
        </label>
      </div>
      <div class="panel-section lorenz-only">
        <div class="panel-section-title">Lorenz</div>
        <div class="slider-row"><label for="${pre}twinkle">Twinkle</label><input type="range" id="${pre}twinkle" min="0" max="100" value="20" step="1"><span class="value" id="${pre}twinkleVal">20</span></div>
        <div class="slider-row"><label for="${pre}transparency">Opacity</label><input type="range" id="${pre}transparency" min="15" max="100" value="${a.baseOpacity}" step="1"><span class="value" id="${pre}transparencyVal">${a.baseOpacity}</span></div>
        <div class="slider-row"><label for="${pre}decay">Decay</label><input type="range" id="${pre}decay" min="0" max="98" value="0" step="1"><span class="value" id="${pre}decayVal">0</span></div>
      </div>
      <div class="panel-section rossler-only">
        <div class="panel-section-title">Rössler</div>
        <div class="slider-row"><label for="${pre}pathOpacity">Line opacity</label><input type="range" id="${pre}pathOpacity" min="5" max="80" value="${a.pathOpacity}" step="1"><span class="value" id="${pre}pathOpacityVal">${a.pathOpacity}</span></div>
      </div>
      <div class="panel-section murmuration-only">
        <div class="panel-section-title">Convergence</div>
        <div class="slider-row"><span class="value"><span id="${pre}convergenceSwarms">1</span> swarms</span></div>
        <div class="slider-row"><span class="value">phase <span id="${pre}convergencePhase">0</span></span></div>
        <div class="slider-row"><label for="${pre}lorenzWeight">Lorenz pull</label><input type="range" id="${pre}lorenzWeight" min="0" max="0.25" value="${a.murmurLorenzWeight ?? MURMUR_LORENZ_WEIGHT_DEFAULT}" step="0.01"><span class="value" id="${pre}lorenzWeightVal">${((a.murmurLorenzWeight ?? MURMUR_LORENZ_WEIGHT_DEFAULT) * 100).toFixed(0)}%</span></div>
        <div class="slider-row"><label for="${pre}baseColor">Color</label><input type="color" id="${pre}baseColor" value="${String(a.murmurBaseColorHex || '#00d4ff').replace(/^#/, '').slice(0, 6) || '00d4ff'}" style="width:36px;height:22px;padding:0;border:1px solid #333;cursor:pointer;"><input type="text" id="${pre}baseColorHex" value="${a.murmurBaseColorHex || '#00d4ff'}" placeholder="#00d4ff" class="value" style="width:72px;font-family:monospace;font-size:11px;background:#1a1a1e;color:#e0e0e0;border:1px solid #333;border-radius:4px;padding:4px 6px;"></div>
      </div>
      <div class="panel-section murmuration-only">
        <div class="panel-section-title">Murmuration</div>
        <label class="toggle-row"><input type="checkbox" id="${pre}birdShape" ${a.murmurBirdShape !== false ? 'checked' : ''}><span>Bird shape</span></label>
        <label class="toggle-row"><input type="checkbox" id="${pre}trails" ${a.murmurShowTrails !== false ? 'checked' : ''}><span>Trails</span></label>
        <label class="toggle-row"><input type="checkbox" id="${pre}grid" ${a.murmurShowGrid !== false ? 'checked' : ''}><span>Grid</span></label>
        <label class="toggle-row"><input type="checkbox" id="${pre}instrumentation" ${a.murmurShowInstrumentation ? 'checked' : ''}><span>Show instrumentation</span></label>
        <div class="slider-row"><label for="${pre}fluctuations">Vectors</label><input type="checkbox" id="${pre}fluctuations" ${a.murmurShowFluctuations ? 'checked' : ''}><span class="value">Fluctuations (B)</span></div>
        <div class="slider-row"><label for="${pre}containerShape">Container</label><select id="${pre}containerShape">
          <option value="box" ${(a.murmurContainerShape || 'box') === 'box' ? 'selected' : ''}>Box</option>
          <option value="sphere" ${(a.murmurContainerShape || '') === 'sphere' ? 'selected' : ''}>Sphere</option>
          <option value="ellipsoid" ${(a.murmurContainerShape || '') === 'ellipsoid' ? 'selected' : ''}>Ellipsoid</option>
          <option value="cylinder" ${(a.murmurContainerShape || '') === 'cylinder' ? 'selected' : ''}>Cylinder</option>
          <option value="cone" ${(a.murmurContainerShape || '') === 'cone' ? 'selected' : ''}>Cone</option>
          <option value="torus" ${(a.murmurContainerShape || '') === 'torus' ? 'selected' : ''}>Torus</option>
          <option value="pyramid" ${(a.murmurContainerShape || '') === 'pyramid' ? 'selected' : ''}>Pyramid</option>
          <option value="dome" ${(a.murmurContainerShape || '') === 'dome' ? 'selected' : ''}>Dome</option>
        </select></div>
        <label class="toggle-row"><input type="checkbox" id="${pre}boxBreathe" ${a.murmurBoxBreathe !== false ? 'checked' : ''}><span>Box breathe (3.5–5)</span></label>
        <div class="slider-row"><label for="${pre}boxBreatheSpeed">Breathe speed</label><input type="range" id="${pre}boxBreatheSpeed" min="0.002" max="0.12" value="${a.murmurBoxBreatheSpeed ?? 0.02}" step="0.002"><span class="value" id="${pre}boxBreatheSpeedVal">${((a.murmurBoxBreatheSpeed ?? 0.02) * 1000).toFixed(1)}</span></div>
        <div class="slider-row"><label for="${pre}boxExtent">Box size</label><input type="range" id="${pre}boxExtent" min="2" max="${MURMUR_BOX_MAX}" value="${a.murmurBoxExtent ?? MURMUR_DEFAULT_BOX}" step="1"><span class="value" id="${pre}boxExtentVal">${a.murmurBoxExtent ?? MURMUR_DEFAULT_BOX}</span></div>
        <div class="slider-row"><label for="${pre}gridSize">Grid</label><input type="range" id="${pre}gridSize" min="12" max="24" value="${a.murmurGridSize}" step="2"><span class="value" id="${pre}gridSizeVal">${a.murmurGridSize}</span></div>
        <div class="slider-row"><label for="${pre}spacing">Spacing</label><input type="range" id="${pre}spacing" min="0.3" max="5" value="${a.murmurSpacing ?? 1}" step="0.1"><span class="value" id="${pre}spacingVal">${(a.murmurSpacing ?? 1).toFixed(1)}</span></div>
        <div class="slider-row"><label for="${pre}waveSpeed">Wave</label><input type="range" id="${pre}waveSpeed" min="0.005" max="0.08" value="${a.murmurWaveSpeed ?? 0.02}" step="0.005"><span class="value" id="${pre}waveSpeedVal">${(a.murmurWaveSpeed ?? 0.02).toFixed(3)}</span></div>
        <div class="slider-row"><label for="${pre}blobWeight">Blob</label><input type="range" id="${pre}blobWeight" min="0" max="1" value="${a.murmurBlobWeight ?? 0.4}" step="0.05"><span class="value" id="${pre}blobWeightVal">${((a.murmurBlobWeight ?? 0.4) * 100).toFixed(0)}%</span></div>
        <div class="slider-row video-map-row">
          <label for="${pre}videoFile" class="video-label">Video map</label>
          <input type="file" id="${pre}videoFile" accept="video/*,image/gif" class="video-file-input">
          <button type="button" class="video-clear-btn" id="${pre}videoClear">Clear</button>
        </div>
      </div>
    </div>
  `;
  const container = document.getElementById('attractor-ui');
  const addBtn = document.getElementById('add-attractor-btn');
  if (container) {
    if (addBtn) container.insertBefore(root, addBtn);
    else container.appendChild(root);
  }

  root.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
      e.stopPropagation();
      removeAttractor(id);
      return;
    }
    if (e.target.classList.contains('minimize-btn')) {
      e.stopPropagation();
      root.classList.toggle('minimized');
      root.querySelector('.minimize-btn').textContent = root.classList.contains('minimized') ? '▶' : '▼';
      return;
    }
    selectedAttractorId = id;
    document.querySelectorAll('.attractor-panel.selected').forEach((el) => el.classList.remove('selected'));
    root.classList.add('selected');
  });

  bindPanelToAttractor(root, a);
  return root;
}

function bindPanelToAttractor(panelEl, a) {
  const id = a.id;
  const pre = `a${id}-`;

  const get = (suffix) => document.getElementById(pre + suffix);
  const setMode = (mode) => {
    a.mode = mode;
    panelEl.classList.toggle('rossler', mode === 'rossler');
    panelEl.classList.toggle('murmuration', mode === 'murmuration');
    initAttractorParticles(a);
  };

  get('type')?.addEventListener('change', (e) => setMode(e.target.value));

  get('speed')?.addEventListener('input', (e) => {
    a.speedMultiplier = Number(e.target.value);
    get('speedVal').textContent = a.speedMultiplier.toFixed(2);
  });

  get('particles')?.addEventListener('input', (e) => {
    a.numParticles = Number(e.target.value);
    get('particlesVal').textContent = a.numParticles;
    initAttractorParticles(a);
  });

  get('lines')?.addEventListener('change', (e) => { a.showLines = e.target.checked; });

  get('twinkle')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.twinkleSpeed = v === 0 ? 0 : 0.005 + (v / 100) * 0.15;
    get('twinkleVal').textContent = v;
  });

  get('transparency')?.addEventListener('input', (e) => {
    a.baseOpacity = Number(e.target.value);
    get('transparencyVal').textContent = a.baseOpacity;
  });

  get('decay')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.decayAlpha = 100 - v;
    get('decayVal').textContent = v;
  });

  get('pathOpacity')?.addEventListener('input', (e) => {
    a.pathOpacity = Number(e.target.value);
    get('pathOpacityVal').textContent = a.pathOpacity;
  });

  get('containerShape')?.addEventListener('change', (e) => {
    a.murmurContainerShape = e.target.value;
  });
  get('boxBreathe')?.addEventListener('change', (e) => {
    a.murmurBoxBreathe = e.target.checked;
  });
  get('boxBreatheSpeed')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurBoxBreatheSpeed = v;
    get('boxBreatheSpeedVal').textContent = (v * 1000).toFixed(1);
  });
  get('boxExtent')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurBoxExtent = v;
    get('boxExtentVal').textContent = v;
    if (a.mode === 'murmuration') initAttractorParticles(a);
  });

  get('birdShape')?.addEventListener('change', (e) => {
    a.murmurBirdShape = e.target.checked;
  });
  get('trails')?.addEventListener('change', (e) => {
    a.murmurShowTrails = e.target.checked;
  });
  get('grid')?.addEventListener('change', (e) => {
    a.murmurShowGrid = e.target.checked;
  });
  get('instrumentation')?.addEventListener('change', (e) => {
    a.murmurShowInstrumentation = e.target.checked;
  });
  get('fluctuations')?.addEventListener('change', (e) => {
    a.murmurShowFluctuations = e.target.checked;
  });

  get('gridSize')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurGridSize = v;
    get('gridSizeVal').textContent = v;
    if (a.mode === 'murmuration') initAttractorParticles(a);
  });

  get('spacing')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurSpacing = v;
    get('spacingVal').textContent = v.toFixed(1);
    if (a.mode === 'murmuration') initAttractorParticles(a);
  });

  get('waveSpeed')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurWaveSpeed = v;
    get('waveSpeedVal').textContent = v.toFixed(3);
  });

  get('blobWeight')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurBlobWeight = v;
    get('blobWeightVal').textContent = (v * 100).toFixed(0) + '%';
  });

  get('lorenzWeight')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.murmurLorenzWeight = v;
    get('lorenzWeightVal').textContent = (v * 100).toFixed(0) + '%';
  });

  get('baseColor')?.addEventListener('input', (e) => {
    const hex = e.target.value;
    a.murmurBaseColorHex = hex;
    const hexInput = get('baseColorHex');
    if (hexInput) hexInput.value = hex;
  });

  get('baseColorHex')?.addEventListener('input', (e) => {
    let v = (e.target.value || '').trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9A-Fa-f]{3}$/.test(v) || /^#[0-9A-Fa-f]{6}$/.test(v)) {
      a.murmurBaseColorHex = v;
      const colorInput = get('baseColor');
      if (colorInput && v.length === 7) colorInput.value = v.slice(1);
    }
  });

  get('videoFile')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isGif = (file.type || '').toLowerCase() === 'image/gif';
    if (a.murmurVideoObjectURL) URL.revokeObjectURL(a.murmurVideoObjectURL);
    if (a.murmurVideo) {
      a.murmurVideo.stop();
      a.murmurVideo.remove();
      a.murmurVideo = null;
    }
    a.murmurVideoReady = false;
    if (a.murmurGifObjectURL) URL.revokeObjectURL(a.murmurGifObjectURL);
    if (a.murmurGif) {
      a.murmurGif.remove();
      a.murmurGif = null;
    }
    a.murmurGifBuffer = null;
    a.murmurGifReady = false;
    if (isGif) {
      a.murmurGifObjectURL = url;
      a.murmurGif = createImg(url, () => {
        a.murmurGifReady = true;
        if (a.murmurGif && a.murmurGif.width && a.murmurGif.height) {
          a.murmurGifBuffer = createGraphics(a.murmurGif.width, a.murmurGif.height);
        }
      });
      a.murmurGif.hide();
    } else {
      a.murmurVideoObjectURL = url;
      a.murmurVideo = createVideo(url);
      a.murmurVideo.hide();
      a.murmurVideo.loop();
      a.murmurVideo.volume(0);
      a.murmurVideo.on('loadeddata', () => { a.murmurVideoReady = true; });
    }
    e.target.value = '';
  });

  get('videoClear')?.addEventListener('click', () => {
    if (a.murmurVideoObjectURL) {
      URL.revokeObjectURL(a.murmurVideoObjectURL);
      a.murmurVideoObjectURL = null;
    }
    if (a.murmurVideo) {
      a.murmurVideo.stop();
      a.murmurVideo.remove();
      a.murmurVideo = null;
    }
    a.murmurVideoReady = false;
    if (a.murmurGifObjectURL) {
      URL.revokeObjectURL(a.murmurGifObjectURL);
      a.murmurGifObjectURL = null;
    }
    if (a.murmurGif) {
      a.murmurGif.remove();
      a.murmurGif = null;
    }
    a.murmurGifBuffer = null;
    a.murmurGifReady = false;
    const fileEl = get('videoFile');
    if (fileEl) fileEl.value = '';
  });
}

function lorenzStep(a, p) {
  const effectiveDT = DT * a.speedMultiplier;
  const { sigma, rho, beta } = LORENZ;
  const dx = sigma * (p.y - p.x);
  const dy = p.x * (rho - p.z) - p.y;
  const dz = p.x * p.y - beta * p.z;
  p.vx = dx;
  p.vy = dy;
  p.vz = dz;
  p.x += dx * effectiveDT;
  p.y += dy * effectiveDT;
  p.z += dz * effectiveDT;
}

function rosslerStep(a, p) {
  const effectiveDT = DT * a.speedMultiplier;
  const { a: aa, b, c } = ROSSLER;
  const dx = -p.y - p.z;
  const dy = p.x + aa * p.y;
  const dz = b + p.z * (p.x - c);
  p.x += dx * effectiveDT;
  p.y += dy * effectiveDT;
  p.z += dz * effectiveDT;
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  const ui = document.getElementById('attractor-ui');
  const hint = document.getElementById('hint');

  function updateCursor() {
    if (cKeyHeld && selectedAttractorId != null && isDragging) canvas.style.cursor = 'grabbing';
    else if (cKeyHeld && selectedAttractorId != null) canvas.style.cursor = 'grab';
    else if (handToolActive && isDragging) canvas.style.cursor = 'grabbing';
    else if (handToolActive) canvas.style.cursor = 'grab';
    else canvas.style.cursor = 'default';
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      handToolActive = true;
      updateCursor();
    }
    if (e.key === 'c' || e.key === 'C') {
      cKeyHeld = true;
      updateCursor();
    }
    if (e.key === 'x' || e.key === 'X') {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (ui) ui.classList.toggle('hidden');
      if (hint) {
        hint.classList.remove('hint-faded');
        if (hintFadeTimeout) clearTimeout(hintFadeTimeout);
        hintFadeTimeout = setTimeout(() => {
          hint.classList.add('hint-faded');
          hintFadeTimeout = null;
        }, 4000);
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      handToolActive = false;
      updateCursor();
    }
    if (e.key === 'c' || e.key === 'C') {
      cKeyHeld = false;
      updateCursor();
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      dragPrevX = e.clientX;
      dragPrevY = e.clientY;
      updateCursor();
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      isDragging = false;
      updateCursor();
    }
  });
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    updateCursor();
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragPrevX;
    const dy = e.clientY - dragPrevY;
    if (cKeyHeld && selectedAttractorId != null) {
      const a = attractors.find((x) => x.id === selectedAttractorId);
      if (a) {
        const camX = centerX + zoomDistance * cos(orbitPhi) * sin(orbitTheta);
        const camY = centerY + zoomDistance * sin(orbitPhi);
        const camZ = centerZ + zoomDistance * cos(orbitPhi) * cos(orbitTheta);
        const viewDir = p5.Vector.sub(
          createVector(centerX, centerY, centerZ),
          createVector(camX, camY, camZ)
        ).normalize();
        const worldUp = createVector(0, 1, 0);
        const right = p5.Vector.cross(viewDir, worldUp).normalize();
        const screenUp = p5.Vector.cross(right, viewDir).normalize();
        const scale = (zoomDistance / 350) * PAN_SPEED;
        a.offsetX += (-dx * right.x + dy * screenUp.x) * scale;
        a.offsetY += (-dx * right.y + dy * screenUp.y) * scale;
        a.offsetZ += (-dx * right.z + dy * screenUp.z) * scale;
      }
    } else if (handToolActive) {
      const camX = centerX + zoomDistance * cos(orbitPhi) * sin(orbitTheta);
      const camY = centerY + zoomDistance * sin(orbitPhi);
      const camZ = centerZ + zoomDistance * cos(orbitPhi) * cos(orbitTheta);
      const viewDir = p5.Vector.sub(
        createVector(centerX, centerY, centerZ),
        createVector(camX, camY, camZ)
      ).normalize();
      const worldUp = createVector(0, 1, 0);
      const right = p5.Vector.cross(viewDir, worldUp).normalize();
      const screenUp = p5.Vector.cross(right, viewDir).normalize();
      const scale = (zoomDistance / 350) * PAN_SPEED;
      centerX += (-dx * right.x + dy * screenUp.x) * scale;
      centerY += (-dx * right.y + dy * screenUp.y) * scale;
      centerZ += (-dx * right.z + dy * screenUp.z) * scale;
    } else {
      orbitTheta += dx * 0.008;
      orbitPhi += dy * 0.008;
      orbitPhi = constrain(orbitPhi, -PI / 2 + 0.1, PI / 2 - 0.1);
    }
    dragPrevX = e.clientX;
    dragPrevY = e.clientY;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomDistance += e.deltaY * 0.4;
    zoomDistance = constrain(zoomDistance, 80, 1200);
  }, { passive: false });

  const addBtnEl = document.getElementById('add-attractor-btn');
  if (addBtnEl) {
    addBtnEl.addEventListener('click', () => {
      const newAttractor = createAttractor();
      createPanelForAttractor(newAttractor);
    });
  }

  // One default attractor so canvas isn't empty
  const first = createAttractor();
  createPanelForAttractor(first);
}

function draw() {
  background(0, 0, 6);

  const camX = centerX + zoomDistance * cos(orbitPhi) * sin(orbitTheta);
  const camY = centerY + zoomDistance * sin(orbitPhi);
  const camZ = centerZ + zoomDistance * cos(orbitPhi) * cos(orbitTheta);
  camera(camX, camY, camZ, centerX, centerY, centerZ, 0, 1, 0);

  for (let i = 0; i < attractors.length; i++) {
    const a = attractors[i];

    if (a.mode === 'lorenz') {
      for (const p of a.particles) lorenzStep(a, p);
    } else if (a.mode === 'rossler') {
      for (const path of a.rosslerPaths) {
        rosslerStep(a, path);
        path.trail.push({ x: path.x, y: path.y, z: path.z });
        if (path.trail.length > ROSSLER_TRAIL_LENGTH) path.trail.shift();
      }
    } else if (a.mode === 'murmuration') {
      murmurBoidStep(a);
    }

    push();
    translate(a.offsetX, a.offsetY, a.offsetZ);
    scale(a.scaleToWorld);

    if (a.mode === 'lorenz') {
      noFill();
      for (const p of a.particles) {
        p.trail.push({ x: p.x, y: p.y, z: p.z });
        if (p.trail.length > LORENZ_TRAIL_LENGTH) p.trail.shift();
      }
      for (const p of a.particles) {
        if (p.trail.length >= 2) {
          for (let i = 0; i < p.trail.length - 1; i++) {
            const t = (i + 1) / p.trail.length;
            const pt = p.trail[i];
            const next = p.trail[i + 1];
            stroke(p.hue, 70, 75, a.baseOpacity * 0.4 * t);
            strokeWeight(0.06);
            line(pt.x, pt.z, pt.y, next.x, next.z, next.y);
          }
        }
      }
      noStroke();
      for (const p of a.particles) {
        push();
        translate(p.x, p.z, p.y);
        const mag = sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) || 1;
        const vx = p.vx / mag, vz = p.vz / mag, vy = p.vy / mag;
        const yaw = atan2(vx, vz);
        const pitch = -acos(constrain(vy, -1, 1));
        rotateY(yaw);
        rotateX(pitch);
        const speedNorm = min(mag / 40, 1.5);
        const sizeScale = 0.4 + 0.6 * speedNorm;
        const tw = a.twinkleSpeed > 0 ? 0.3 + 0.7 * (0.5 + 0.5 * sin(frameCount * a.twinkleSpeed + (p.phase ?? 0))) : 1;
        const brightness = 70 + 25 * tw;
        const alpha = a.baseOpacity * (0.6 + 0.4 * (a.twinkleSpeed > 0 ? (0.5 + 0.5 * sin(frameCount * a.twinkleSpeed * 1.1 + (p.phase ?? 0) + 1)) : 1));
        fill(p.hue, 70, brightness, alpha);
        cone(0.06 * sizeScale, 0.2 * sizeScale);
        pop();
      }
    } else if (a.mode === 'murmuration') {
      const extent = a.murmurCurrentExtent != null ? a.murmurCurrentExtent : (a.murmurBoxBreathe !== false ? MURMUR_BREATHE_EXTENT_MIN + MURMUR_BREATHE_EXTENT_AMP * (0.5 + 0.5 * sin(frameCount * (a.murmurBoxBreatheSpeed ?? 0.02))) : Math.max(1, Math.min(MURMUR_BOX_MAX, a.murmurBoxExtent ?? MURMUR_DEFAULT_BOX)));
      const vertScale = Math.max(0.15, Math.min(1, a.murmurVerticalScale ?? MURMUR_VERTICAL_SCALE_DEFAULT));
      const extentY = extent * vertScale;
      const boids = a.murmurBoids;
      const e = extent;
      const eY = extentY;
      const containerShape = a.murmurContainerShape || 'box';
      stroke(200, 30, 70, 20);
      strokeWeight(0.015);
      noFill();
      if (containerShape === 'box') {
        line(-e, -e, -e, e, -e, -e); line(e, -e, -e, e, e, -e); line(e, e, -e, -e, e, -e); line(-e, e, -e, -e, -e, -e);
        line(-e, -e, e, e, -e, e); line(e, -e, e, e, e, e); line(e, e, e, -e, e, e); line(-e, e, e, -e, -e, e);
        line(-e, -e, -e, -e, -e, e); line(e, -e, -e, e, -e, e); line(e, e, -e, e, e, e); line(-e, e, -e, -e, e, e);
      } else if (containerShape === 'sphere') {
        sphere(e, 20, 14);
      } else if (containerShape === 'ellipsoid') {
        push();
        scale(1, 1, eY / e);
        sphere(e, 20, 14);
        pop();
      } else if (containerShape === 'cylinder') {
        push();
        rotateX(HALF_PI);
        cylinder(e, 2 * eY, 24, 1, true, true);
        pop();
      } else if (containerShape === 'cone') {
        push();
        translate(0, 0, -eY);
        rotateX(-HALF_PI);
        cone(e, 2 * eY, 24, 1);
        pop();
      } else if (containerShape === 'torus') {
        push();
        rotateX(HALF_PI);
        torus(e, e * MURMUR_TORUS_MINOR, 24, 12);
        pop();
      } else if (containerShape === 'pyramid') {
        line(0, 0, eY, -e, -e, -eY); line(0, 0, eY, e, -e, -eY); line(0, 0, eY, e, e, -eY); line(0, 0, eY, -e, e, -eY);
        line(-e, -e, -eY, e, -e, -eY); line(e, -e, -eY, e, e, -eY); line(e, e, -eY, -e, e, -eY); line(-e, e, -eY, -e, -e, -eY);
      } else if (containerShape === 'dome') {
        const steps = 12;
        const halfPi = PI / 2;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * halfPi;
          const ct = cos(theta); const st = sin(theta);
          for (let j = 0; j < 24; j++) {
            const phi = (j / 24) * TWO_PI;
            const cp = cos(phi); const sp = sin(phi);
            const x = e * ct * cp; const z = e * ct * sp; const y = e * st;
            if (j > 0) {
              const phi0 = ((j - 1) / 24) * TWO_PI;
              const cp0 = cos(phi0); const sp0 = sin(phi0);
              const x0 = e * ct * cp0; const z0 = e * ct * sp0; const y0 = e * st;
              line(x0, z0, y0, x, z, y);
            }
            if (i > 0) {
              const theta0 = ((i - 1) / steps) * halfPi;
              const ct0 = cos(theta0); const st0 = sin(theta0);
              const x0 = e * ct0 * cp; const z0 = e * ct0 * sp; const y0 = e * st0;
              line(x0, z0, y0, x, z, y);
            }
          }
        }
      }
      noStroke();
      if (a.murmurShowGrid && containerShape === 'box') {
        const gridN = Math.max(4, Math.min(24, a.murmurGridSize || 12));
        const step = (2 * e) / gridN;
        stroke(220, 15, 45, 12);
        strokeWeight(0.012);
        noFill();
        for (let i = 0; i <= gridN; i++) {
          const x = -e + i * step;
          line(x, -e, -e, x, -e, e);
          line(x, e, -e, x, e, e);
          line(-e, -e, x, e, -e, x);
          line(-e, e, x, e, e, x);
        }
        noStroke();
      }
      const path = a.murmurLorenzPath || [];
      if (path.length >= 2) {
        noFill();
        stroke(180, 60, 85, 28);
        strokeWeight(0.04);
        for (let i = 0; i < path.length - 1; i++) {
          const pt = path[i], next = path[i + 1];
          line(pt.x, pt.z, pt.y, next.x, next.z, next.y);
        }
        noStroke();
      }
      const swarmIds = a.murmurSwarmIds || boids.map(() => 0);
      const numSwarms = new Set(swarmIds).size;
      push();
      colorMode(RGB, 255);
      const baseRgb = parseHexToRgb(a.murmurBaseColorHex || '#00d4ff');
      if (a.murmurShowInstrumentation) {
        const breathe = 1 + MURMUR_BREATHE_AMOUNT * sin(frameCount * MURMUR_BREATHE_SPEED);
        const perception = Math.min(extent * 0.45, 6) * sqrt(breathe);
        const separationRadius = extent * MURMUR_SEPARATION_RADIUS;
        let cx = 0, cy = 0, cz = 0;
        for (const b of boids) {
          cx += b.x; cy += b.y; cz += b.z;
        }
        cx /= boids.length || 1;
        cy /= boids.length || 1;
        cz /= boids.length || 1;
        noFill();
        stroke(200, 70, 90, 22);
        strokeWeight(0.02);
        push();
        translate(cx, cz, cy);
        sphere(perception, 12, 10);
        pop();
        stroke(340, 60, 95, 18);
        push();
        translate(cx, cz, cy);
        sphere(separationRadius, 10, 8);
        pop();
        const pathPt = murmurNearestOnLorenzPath(cx, cy, cz, path);
        if (pathPt) {
          fill(50, 80, 95, 70);
          noStroke();
          push();
          translate(pathPt.x, pathPt.z, pathPt.y);
          sphere(0.15, 8, 8);
          pop();
        }
        for (let s = 0; s < numSwarms; s++) {
          let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
          let count = 0;
          for (let i = 0; i < boids.length; i++) {
            if (swarmIds[i] !== s) continue;
            count++;
            const b = boids[i];
            minX = min(minX, b.x); maxX = max(maxX, b.x);
            minY = min(minY, b.y); maxY = max(maxY, b.y);
            minZ = min(minZ, b.z); maxZ = max(maxZ, b.z);
          }
          if (count === 0) continue;
          const srgb = lightenRgb(baseRgb.r, baseRgb.g, baseRgb.b, s * 0.06);
          noFill();
          stroke(srgb.r, srgb.g, srgb.b, 90);
          strokeWeight(0.025);
          const pad = 0.1;
          line(minX - pad, minZ - pad, minY - pad, maxX + pad, minZ - pad, minY - pad);
          line(maxX + pad, minZ - pad, minY - pad, maxX + pad, maxZ + pad, minY - pad);
          line(maxX + pad, maxZ + pad, minY - pad, minX - pad, maxZ + pad, minY - pad);
          line(minX - pad, maxZ + pad, minY - pad, minX - pad, minZ - pad, minY - pad);
          line(minX - pad, minZ - pad, maxY + pad, maxX + pad, minZ - pad, maxY + pad);
          line(maxX + pad, minZ - pad, maxY + pad, maxX + pad, maxZ + pad, maxY + pad);
          line(maxX + pad, maxZ + pad, maxY + pad, minX - pad, maxZ + pad, maxY + pad);
          line(minX - pad, maxZ + pad, maxY + pad, minX - pad, minZ - pad, maxY + pad);
          line(minX - pad, minZ - pad, minY - pad, minX - pad, minZ - pad, maxY + pad);
          line(maxX + pad, minZ - pad, minY - pad, maxX + pad, minZ - pad, maxY + pad);
          line(maxX + pad, maxZ + pad, minY - pad, maxX + pad, maxZ + pad, maxY + pad);
          line(minX - pad, maxZ + pad, minY - pad, minX - pad, maxZ + pad, maxY + pad);
        }
        noStroke();
      }
      const connectR = extent * MURMUR_CONNECT_RADIUS;
      noFill();
      strokeWeight(0.006);
      for (let i = 0; i < boids.length; i++) {
        const bi = boids[i];
        for (let j = i + 1; j < boids.length; j++) {
          const bj = boids[j];
          const dx = bj.x - bi.x, dy = bj.y - bi.y, dz = bj.z - bi.z;
          const d = sqrt(dx * dx + dy * dy + dz * dz);
          if (d >= connectR || d < 1e-6) continue;
          const t = 1 - d / connectR;
          stroke(baseRgb.r, baseRgb.g, baseRgb.b, 3 + 14 * t);
          line(bi.x, bi.z, bi.y, bj.x, bj.z, bj.y);
        }
      }
      noStroke();
      if (a.murmurShowTrails) {
        for (let i = 0; i < boids.length; i++) {
          const b = boids[i];
          const trail = b.trail;
          if (!trail || trail.length < 2) continue;
          const trgb = lightenRgb(baseRgb.r, baseRgb.g, baseRgb.b, (swarmIds[i] ?? 0) * 0.05);
          for (let k = 0; k < trail.length - 1; k++) {
            const t = (k + 1) / trail.length;
            stroke(trgb.r, trgb.g, trgb.b, 12 + 25 * t);
            strokeWeight(0.015 * t);
            const pt = trail[k], next = trail[k + 1];
            line(pt.x, pt.z, pt.y, next.x, next.z, next.y);
          }
          noStroke();
        }
      }
      const maxSpeed = MURMUR_BOID_MAX_SPEED;
      let vcmX = 0, vcmY = 0, vcmZ = 0;
      for (const b of boids) {
        vcmX += b.vx; vcmY += b.vy; vcmZ += b.vz;
      }
      const nB = boids.length || 1;
      vcmX /= nB; vcmY /= nB; vcmZ /= nB;
      const useBird = !!a.murmurBirdShape;
      const drawBoidArrow = (b, useFill = true, showFluctuations = false) => {
        let vx = b.vx, vy = b.vy, vz = b.vz;
        if (showFluctuations) {
          vx = b.vx - vcmX;
          vy = b.vy - vcmY;
          vz = b.vz - vcmZ;
        }
        const vmag = sqrt(vx * vx + vy * vy + vz * vz) || 1e-9;
        const ux = vx / vmag, uy = vy / vmag, uz = vz / vmag;
        const yaw = atan2(ux, uz);
        const pitch = -acos(constrain(uy, -1, 1));
        push();
        translate(b.x, b.z, b.y);
        rotateY(yaw);
        rotateX(pitch);
        let lenScale;
        if (showFluctuations) {
          const fluctuationBoost = 5;
          lenScale = 0.3 + 1.2 * min(vmag / (maxSpeed * 0.15), 1) * fluctuationBoost;
        } else {
          lenScale = 0.5 + 0.8 * min((sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz) || 0) / maxSpeed, 1.5);
        }
        if (useBird) {
          drawBoidBird(b, lenScale * 1.2, useFill);
        } else if (useFill) {
          cone(0.022, 0.1 * lenScale, 4, 1);
        }
        pop();
      };
      const showFluctuations = !!a.murmurShowFluctuations;
      let usedMedia = false;
      const sampleAndDraw = (pw, ph, px) => {
        push();
        colorMode(RGB, 255);
        for (const b of boids) {
          const u = constrain((b.x / extent + 1) / 2, 0, 1);
          const vv = constrain((b.z / extent + 1) / 2, 0, 1);
          const px_i = floor(u * (pw - 1));
          const py_i = floor(vv * (ph - 1));
          const idx = (py_i * pw + px_i) * 4;
          const r = px[idx] ?? 0;
          const g = px[idx + 1] ?? 0;
          const b_ = px[idx + 2] ?? 0;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b_;
          const alpha = 30 + 70 * (lum / 255);
          fill(r, g, b_, alpha);
          drawBoidArrow(b, true, showFluctuations);
        }
        colorMode(HSB, 360, 100, 100, 100);
        pop();
      };
      if (a.murmurGif && a.murmurGifReady && a.murmurGifBuffer) {
        const buf = a.murmurGifBuffer;
        buf.image(a.murmurGif, 0, 0);
        buf.loadPixels();
        if (buf.pixels && buf.pixels.length > 0) {
          sampleAndDraw(buf.width, buf.height, buf.pixels);
          usedMedia = true;
        }
      }
      if (!usedMedia) {
        const vid = a.murmurVideo;
        if (vid && a.murmurVideoReady && typeof vid.loadPixels === 'function') {
          vid.loadPixels();
          if (vid.pixels && vid.pixels.length > 0) {
            sampleAndDraw(vid.width, vid.height, vid.pixels);
            usedMedia = true;
          }
        }
      }
      const phaseEl = document.getElementById(`a${a.id}-convergenceSwarms`);
      const phaseVal = document.getElementById(`a${a.id}-convergencePhase`);
      if (phaseEl) phaseEl.textContent = String(numSwarms);
      if (phaseVal) phaseVal.textContent = (frameCount * 0.01 % 1).toFixed(2);
      if (!usedMedia) {
        for (let i = 0; i < boids.length; i++) {
          const b = boids[i];
          const swarmId = swarmIds[i] ?? 0;
          const brgb = lightenRgb(baseRgb.r, baseRgb.g, baseRgb.b, swarmId * 0.06);
          fill(brgb.r, brgb.g, brgb.b, min(255, Math.round((a.baseOpacity || 80) * 2.55 * 1.2)));
          drawBoidArrow(b, true, showFluctuations);
        }
      }
      pop();
    } else {
      if (a.showLines) {
        noFill();
        for (const path of a.rosslerPaths) {
          const trail = path.trail;
          if (trail.length < 2) continue;
          for (let i = 0; i < trail.length - 1; i++) {
            const t = (i + 1) / trail.length;
            stroke(path.hue, 70, 88, a.pathOpacity * t * 0.9);
            strokeWeight(0.08 + 0.06 * t);
            line(trail[i].x, -trail[i].z, trail[i].y, trail[i + 1].x, -trail[i + 1].z, trail[i + 1].y);
          }
        }
        noStroke();
        for (const path of a.rosslerPaths) {
          fill(path.hue, 70, 95, 90);
          push();
          translate(path.x, -path.z, path.y);
          sphere(0.12, 6, 6);
          pop();
        }
      } else {
        noStroke();
        for (const path of a.rosslerPaths) {
          fill(path.hue, 70, 88, 80);
          push();
          translate(path.x, -path.z, path.y);
          sphere(0.12, 6, 6);
          pop();
        }
      }
    }
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
