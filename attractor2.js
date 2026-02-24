/**
 * Attractor2: TSL-style Reynolds boids flock (dedicated page).
 * Separation, alignment, cohesion, single neighbour radius, noise on speed, rotation blend.
 * X toggles UI; hint fades after 4s.
 */

const DT = 0.016;

// Default state (plan defaults)
function defaultFlockState() {
  return {
    mode: 'flock',
    numParticles: 800,
    neighbourDistance: 0.5,
    boidSpeed: 0.12,
    rotationSpeed: 2,
    separationW: 1.5,
    alignmentW: 0.9,
    cohesionW: 0.5,
    noiseStrength: 0.1,
    extent: 12,
    showVectors: false,
    showWireframe: true,
    boids: []
  };
}

let state;
let orbitTheta = 0.6;
let orbitPhi = 0.4;
let zoomDistance = 350;
let centerX = 0, centerY = 0, centerZ = 0;
let isDragging = false;
let dragPrevX, dragPrevY;
let handToolActive = false;
let hintFadeTimeout = null;
const PAN_SPEED = 0.5;

function initFlockBoids(a) {
  const n = Math.max(1, Math.min(5000, a.numParticles ?? 800));
  const extent = Math.max(1, a.extent ?? 12);
  const boids = [];
  for (let i = 0; i < n; i++) {
    const x = (Math.random() * 2 - 1) * extent * 0.9;
    const y = (Math.random() * 2 - 1) * extent * 0.9;
    const z = (Math.random() * 2 - 1) * extent * 0.9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const vx = Math.sin(phi) * Math.cos(theta);
    const vy = Math.sin(phi) * Math.sin(theta);
    const vz = Math.cos(phi);
    const mag = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    boids.push({
      x, y, z,
      vx: vx / mag, vy: vy / mag, vz: vz / mag
    });
  }
  a.boids = boids;
}

function containBoidBox(b, extent) {
  const e = extent;
  if (b.x < -e) { b.x = -e; b.vx = Math.abs(b.vx) * 0.5; }
  if (b.x > e)  { b.x = e;  b.vx = -Math.abs(b.vx) * 0.5; }
  if (b.y < -e) { b.y = -e; b.vy = Math.abs(b.vy) * 0.5; }
  if (b.y > e)  { b.y = e;  b.vy = -Math.abs(b.vy) * 0.5; }
  if (b.z < -e) { b.z = -e; b.vz = Math.abs(b.vz) * 0.5; }
  if (b.z > e)  { b.z = e;  b.vz = -Math.abs(b.vz) * 0.5; }
}

function flockStep(a) {
  const boids = a.boids;
  const n = boids.length;
  if (n === 0) return;

  const neighbourDist = Math.max(0.01, a.neighbourDistance ?? 0.5);
  const boidSpeed = Math.max(0.01, a.boidSpeed ?? 0.12);
  const rotationSpeed = Math.max(0.01, a.rotationSpeed ?? 2);
  const separationW = a.separationW ?? 1.5;
  const alignmentW = a.alignmentW ?? 0.9;
  const cohesionW = a.cohesionW ?? 0.5;
  const noiseStr = a.noiseStrength ?? 0.1;
  const extent = Math.max(1, a.extent ?? 12);
  const dt = DT;

  for (let i = 0; i < n; i++) {
    const b = boids[i];
    let sx = 0, sy = 0, sz = 0;
    let ax = 0, ay = 0, az = 0;
    let cx = 0, cy = 0, cz = 0;
    let nearbyCount = 0;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const o = boids[j];
      const dx = o.x - b.x, dy = o.y - b.y, dz = o.z - b.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      if (dist < 1e-6) continue;
      if (dist < neighbourDist) {
        nearbyCount++;
        const invD = 1 / dist;
        const sepFactor = invD - 1 / neighbourDist;
        sx -= (dx / dist) * sepFactor;
        sy -= (dy / dist) * sepFactor;
        sz -= (dz / dist) * sepFactor;
        ax += o.vx; ay += o.vy; az += o.vz;
        cx += o.x; cy += o.y; cz += o.z;
      }
    }

    let dx = 0, dy = 0, dz = 0;
    dx += sx * separationW;
    dy += sy * separationW;
    dz += sz * separationW;

    if (nearbyCount > 0) {
      const invN = 1 / nearbyCount;
      ax *= invN; ay *= invN; az *= invN;
      cx = cx * invN - b.x; cy = cy * invN - b.y; cz = cz * invN - b.z;
      const alignMag = Math.sqrt(ax * ax + ay * ay + az * az) || 1e-9;
      dx += (ax / alignMag) * alignmentW;
      dy += (ay / alignMag) * alignmentW;
      dz += (az / alignMag) * alignmentW;
      const cohMag = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1e-9;
      if (cohMag > 0.001) {
        dx += (cx / cohMag) * cohesionW;
        dy += (cy / cohMag) * cohesionW;
        dz += (cz / cohMag) * cohesionW;
      }
    }

    const desMag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
    const desX = dx / desMag, desY = dy / desMag, desZ = dz / desMag;
    const curVx = b.vx, curVy = b.vy, curVz = b.vz;
    const curMag = Math.sqrt(curVx * curVx + curVy * curVy + curVz * curVz) || 1e-9;
    const blend = 1 - Math.exp(-rotationSpeed * dt);
    let newVx = curVx / curMag + (desX - curVx / curMag) * blend;
    let newVy = curVy / curMag + (desY - curVy / curMag) * blend;
    let newVz = curVz / curMag + (desZ - curVz / curMag) * blend;
    const newMag = Math.sqrt(newVx * newVx + newVy * newVy + newVz * newVz) || 1e-9;
    b.vx = newVx / newMag;
    b.vy = newVy / newMag;
    b.vz = newVz / newMag;

    const noise = (Math.random() * 2 - 1) * noiseStr;
    const speed = boidSpeed * (1 + noise);
    b.x += b.vx * speed * dt * 60;
    b.y += b.vy * speed * dt * 60;
    b.z += b.vz * speed * dt * 60;

    containBoidBox(b, extent);
  }
}

function createPanelForFlock(a) {
  const pre = 'flock-';
  const root = document.createElement('div');
  root.className = 'attractor-panel';
  root.innerHTML = `
    <div class="panel-header">
      <span class="title">Flock</span>
    </div>
    <div class="panel-body">
      <div class="panel-section">
        <div class="panel-section-title">Flock</div>
        <div class="slider-row"><label for="${pre}particles">Particles</label><input type="range" id="${pre}particles" min="100" max="2000" value="${a.numParticles}" step="50"><span class="value" id="${pre}particlesVal">${a.numParticles}</span></div>
        <div class="slider-row"><label for="${pre}neighbourDistance">Neighbour dist</label><input type="range" id="${pre}neighbourDistance" min="0.2" max="2" value="${a.neighbourDistance ?? 0.5}" step="0.05"><span class="value" id="${pre}neighbourDistanceVal">${(a.neighbourDistance ?? 0.5).toFixed(2)}</span></div>
        <div class="slider-row"><label for="${pre}boidSpeed">Boid speed</label><input type="range" id="${pre}boidSpeed" min="0.05" max="0.5" value="${a.boidSpeed ?? 0.12}" step="0.01"><span class="value" id="${pre}boidSpeedVal">${(a.boidSpeed ?? 0.12).toFixed(2)}</span></div>
        <div class="slider-row"><label for="${pre}rotationSpeed">Rotation speed</label><input type="range" id="${pre}rotationSpeed" min="0.5" max="20" value="${a.rotationSpeed ?? 2}" step="0.5"><span class="value" id="${pre}rotationSpeedVal">${(a.rotationSpeed ?? 2).toFixed(1)}</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Weights</div>
        <div class="slider-row"><label for="${pre}separationW">Separation</label><input type="range" id="${pre}separationW" min="0" max="3" value="${a.separationW ?? 1.5}" step="0.1"><span class="value" id="${pre}separationWVal">${(a.separationW ?? 1.5).toFixed(1)}</span></div>
        <div class="slider-row"><label for="${pre}alignmentW">Alignment</label><input type="range" id="${pre}alignmentW" min="0" max="2" value="${a.alignmentW ?? 0.9}" step="0.1"><span class="value" id="${pre}alignmentWVal">${(a.alignmentW ?? 0.9).toFixed(1)}</span></div>
        <div class="slider-row"><label for="${pre}cohesionW">Cohesion</label><input type="range" id="${pre}cohesionW" min="0" max="2" value="${a.cohesionW ?? 0.5}" step="0.1"><span class="value" id="${pre}cohesionWVal">${(a.cohesionW ?? 0.5).toFixed(1)}</span></div>
        <div class="slider-row"><label for="${pre}noiseStrength">Noise</label><input type="range" id="${pre}noiseStrength" min="0" max="0.3" value="${a.noiseStrength ?? 0.1}" step="0.01"><span class="value" id="${pre}noiseStrengthVal">${(a.noiseStrength ?? 0.1).toFixed(2)}</span></div>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Display</div>
        <div class="slider-row"><label for="${pre}extent">Box size</label><input type="range" id="${pre}extent" min="5" max="30" value="${a.extent ?? 12}" step="1"><span class="value" id="${pre}extentVal">${a.extent ?? 12}</span></div>
        <label class="toggle-row"><input type="checkbox" id="${pre}showVectors" ${a.showVectors ? 'checked' : ''}><span>Show vectors</span></label>
        <label class="toggle-row"><input type="checkbox" id="${pre}showWireframe" ${a.showWireframe !== false ? 'checked' : ''}><span>Box wireframe</span></label>
      </div>
    </div>
  `;
  const container = document.getElementById('attractor-ui');
  if (container) {
    const addBtn = document.getElementById('add-attractor-btn');
    if (addBtn) container.insertBefore(root, addBtn);
    else container.appendChild(root);
  }
  return root;
}

function bindPanelToFlock(panelEl, a) {
  const pre = 'flock-';
  const get = (id) => panelEl.querySelector(`#${pre}${id}`);

  get('particles')?.addEventListener('input', (e) => {
    const v = Math.round(Number(e.target.value));
    a.numParticles = v;
    const valEl = get('particlesVal');
    if (valEl) valEl.textContent = v;
    initFlockBoids(a);
  });
  get('neighbourDistance')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.neighbourDistance = v;
    const valEl = get('neighbourDistanceVal');
    if (valEl) valEl.textContent = v.toFixed(2);
  });
  get('boidSpeed')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.boidSpeed = v;
    const valEl = get('boidSpeedVal');
    if (valEl) valEl.textContent = v.toFixed(2);
  });
  get('rotationSpeed')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.rotationSpeed = v;
    const valEl = get('rotationSpeedVal');
    if (valEl) valEl.textContent = v.toFixed(1);
  });
  get('separationW')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.separationW = v;
    const valEl = get('separationWVal');
    if (valEl) valEl.textContent = v.toFixed(1);
  });
  get('alignmentW')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.alignmentW = v;
    const valEl = get('alignmentWVal');
    if (valEl) valEl.textContent = v.toFixed(1);
  });
  get('cohesionW')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.cohesionW = v;
    const valEl = get('cohesionWVal');
    if (valEl) valEl.textContent = v.toFixed(1);
  });
  get('noiseStrength')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.noiseStrength = v;
    const valEl = get('noiseStrengthVal');
    if (valEl) valEl.textContent = v.toFixed(2);
  });
  get('extent')?.addEventListener('input', (e) => {
    const v = Number(e.target.value);
    a.extent = v;
    const valEl = get('extentVal');
    if (valEl) valEl.textContent = v;
  });
  get('showVectors')?.addEventListener('change', (e) => {
    a.showVectors = e.target.checked;
  });
  get('showWireframe')?.addEventListener('change', (e) => {
    a.showWireframe = e.target.checked;
  });
}

function drawBoxWireframe(e) {
  noFill();
  stroke(200, 30, 70, 25);
  strokeWeight(0.015);
  line(-e, -e, -e, e, -e, -e); line(e, -e, -e, e, e, -e); line(e, e, -e, -e, e, -e); line(-e, e, -e, -e, -e, -e);
  line(-e, -e, e, e, -e, e); line(e, -e, e, e, e, e); line(e, e, e, -e, e, e); line(-e, e, e, -e, -e, e);
  line(-e, -e, -e, -e, -e, e); line(e, -e, -e, e, -e, e); line(e, e, -e, e, e, e); line(-e, e, -e, -e, e, e);
  noStroke();
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  state = defaultFlockState();
  initFlockBoids(state);

  const panelRoot = createPanelForFlock(state);
  bindPanelToFlock(panelRoot, state);

  const ui = document.getElementById('attractor-ui');
  const hint = document.getElementById('hint');

  function updateCursor() {
    if (handToolActive && isDragging) canvas.style.cursor = 'grabbing';
    else if (handToolActive) canvas.style.cursor = 'grab';
    else canvas.style.cursor = 'default';
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      handToolActive = true;
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
    if (handToolActive) {
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
}

function draw() {
  background(0, 0, 6);

  const camX = centerX + zoomDistance * cos(orbitPhi) * sin(orbitTheta);
  const camY = centerY + zoomDistance * sin(orbitPhi);
  const camZ = centerZ + zoomDistance * cos(orbitPhi) * cos(orbitTheta);
  camera(camX, camY, camZ, centerX, centerY, centerZ, 0, 1, 0);

  flockStep(state);

  const a = state;
  const extent = Math.max(1, a.extent ?? 12);
  const boids = a.boids;
  const showVectors = !!a.showVectors;
  const showWireframe = a.showWireframe !== false;

  if (showWireframe) {
    drawBoxWireframe(extent);
  }

  fill(200, 70, 85, 90);
  noStroke();
  const coneRad = 0.08;
  const coneH = 0.2;
  const vectorLen = 0.4;

  for (let i = 0; i < boids.length; i++) {
    const b = boids[i];
    const vx = b.vx, vy = b.vy, vz = b.vz;
    const vmag = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9;
    const ux = vx / vmag, uy = vy / vmag, uz = vz / vmag;
    const yaw = atan2(ux, uz);
    const pitch = -acos(constrain(uy, -1, 1));

    push();
    translate(b.x, b.z, b.y);
    rotateY(yaw);
    rotateX(pitch);
    cone(coneRad, coneH);
    if (showVectors) {
      stroke(200, 50, 90, 60);
      strokeWeight(0.02);
      line(0, 0, 0, 0, 0, vectorLen);
      noStroke();
    }
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
