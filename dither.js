/**
 * Dithering + Conway's Game of Life
 * Cellular automaton with real-time dithering post-processing.
 * ← → cycle modes · click/drag draw · space pause · R randomize · X ui
 */

// ─── Mode definitions ────────────────────────────────────────────────
const DITHER_MODES = [
  'original', 'threshold', 'bayer4', 'bayer8',
  'halftone', 'noise', 'floyd-steinberg', 'atkinson'
];
const MODE_LABELS = {
  'original':        'Original',
  'threshold':       'Threshold',
  'bayer4':          'Bayer 4×4',
  'bayer8':          'Bayer 8×8',
  'halftone':        'Halftone',
  'noise':           'Noise',
  'floyd-steinberg': 'Floyd–Steinberg',
  'atkinson':        'Atkinson'
};
const GPU_MODES = new Set(['original','threshold','bayer4','bayer8','halftone','noise']);

// ─── Error diffusion kernels ─────────────────────────────────────────
const FS_KERNEL = [
  { dx: 1, dy: 0, w: 7 / 16 },
  { dx:-1, dy: 1, w: 3 / 16 },
  { dx: 0, dy: 1, w: 5 / 16 },
  { dx: 1, dy: 1, w: 1 / 16 }
];
const ATKINSON_KERNEL = [
  { dx: 1, dy: 0, w: 1 / 8 },
  { dx: 2, dy: 0, w: 1 / 8 },
  { dx:-1, dy: 1, w: 1 / 8 },
  { dx: 0, dy: 1, w: 1 / 8 },
  { dx: 1, dy: 1, w: 1 / 8 },
  { dx: 0, dy: 2, w: 1 / 8 }
];

// ─── Life patterns ───────────────────────────────────────────────────
const PATTERNS = {
  'r-pentomino': ['.XX', 'XX.', '.X.'],
  'acorn':       ['.X.....', '...X...', 'XX..XXX'],
  'diehard':     ['......X.', 'XX......', '.X...XXX'],
  'glider-gun':  [
    '........................X',
    '......................X.X',
    '............XX......XX............XX',
    '...........X...X....XX............XX',
    'XX........X.....X...XX',
    'XX........X...X.XX....X.X',
    '..........X.....X.......X',
    '...........X...X',
    '............XX'
  ],
  'pulsar': [
    '..XXX...XXX..',
    '.............',
    'X....X.X....X',
    'X....X.X....X',
    'X....X.X....X',
    '..XXX...XXX..',
    '.............',
    '..XXX...XXX..',
    'X....X.X....X',
    'X....X.X....X',
    'X....X.X....X',
    '.............',
    '..XXX...XXX..'
  ]
};

// ─── Game of Life state ──────────────────────────────────────────────
let grid, nextGrid, cellAge, trailAge;
let cols, rows;
let cellSize = 4;
let lifeImage;
let generation = 0;
let paused = false;
let simSpeed = 8;
let isDrawing = false;

// ─── Dithering state ────────────────────────────────────────────────
let currentMode = 'bayer4';
let levels = 4;
let pixelScale = 3;
let colorDither = false;
let ditherShader;
let cpuBuffer;

// ─── Fragment shader ─────────────────────────────────────────────────
const FRAG_SRC = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 canvasSize;
uniform float mode;
uniform float levels;
uniform float pixelScale;
uniform float colorMode;
uniform float halftoneSize;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float quantize(float v, float n) { return clamp(floor(v * (n - 1.0) + 0.5) / (n - 1.0), 0.0, 1.0); }

float orderedDither(float val, float thr, float n) {
  float s = val * (n - 1.0);
  float base = floor(s);
  return clamp((base + step(thr, s - base)) / (n - 1.0), 0.0, 1.0);
}

float qv(float qx, float qy) { return qx * (1.0 - qy) * 2.0 + (1.0 - qx) * qy * 3.0 + qx * qy; }

float bayer4(vec2 pos) {
  vec2 p = mod(floor(pos), 4.0);
  float q1x = step(2.0, p.x), q1y = step(2.0, p.y);
  vec2 p0 = mod(p, 2.0);
  float q0x = step(1.0, p0.x), q0y = step(1.0, p0.y);
  return (qv(q0x, q0y) * 4.0 + qv(q1x, q1y)) / 16.0;
}

float bayer8(vec2 pos) {
  vec2 p = mod(floor(pos), 8.0);
  float q2x = step(4.0, p.x), q2y = step(4.0, p.y);
  vec2 p1 = mod(p, 4.0);
  float q1x = step(2.0, p1.x), q1y = step(2.0, p1.y);
  vec2 p0 = mod(p, 2.0);
  float q0x = step(1.0, p0.x), q0y = step(1.0, p0.y);
  return (qv(q0x, q0y) * 16.0 + qv(q1x, q1y) * 4.0 + qv(q2x, q2y)) / 64.0;
}

float ign(vec2 pos) { return fract(52.9829189 * fract(dot(pos, vec2(0.06711056, 0.00583715)))); }
vec2 rotP(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

float htDot(vec2 pos, float darkness, float cs) {
  vec2 off = fract(pos / cs) - 0.5;
  return step(0.5 * sqrt(clamp(darkness, 0.0, 1.0)), length(off));
}

void main() {
  vec2 uv = vTexCoord;
  vec2 pp = floor(uv * canvasSize / pixelScale);
  vec2 snappedUV = (pp + 0.5) * pixelScale / canvasSize;
  vec4 color = texture2D(tex0, snappedUV);
  float n = max(levels, 2.0);

  if (mode < 0.5) { gl_FragColor = color; return; }

  if (mode < 1.5) {
    if (colorMode > 0.5) gl_FragColor = vec4(quantize(color.r, n), quantize(color.g, n), quantize(color.b, n), 1.0);
    else gl_FragColor = vec4(vec3(quantize(luma(color.rgb), n)), 1.0);
    return;
  }
  if (mode < 2.5) {
    float thr = bayer4(pp);
    if (colorMode > 0.5) gl_FragColor = vec4(orderedDither(color.r, thr, n), orderedDither(color.g, thr, n), orderedDither(color.b, thr, n), 1.0);
    else gl_FragColor = vec4(vec3(orderedDither(luma(color.rgb), thr, n)), 1.0);
    return;
  }
  if (mode < 3.5) {
    float thr = bayer8(pp);
    if (colorMode > 0.5) gl_FragColor = vec4(orderedDither(color.r, thr, n), orderedDither(color.g, thr, n), orderedDither(color.b, thr, n), 1.0);
    else gl_FragColor = vec4(vec3(orderedDither(luma(color.rgb), thr, n)), 1.0);
    return;
  }
  if (mode < 4.5) {
    float cs = halftoneSize;
    if (colorMode > 0.5) {
      float c = 1.0 - color.r, m = 1.0 - color.g, y = 1.0 - color.b;
      float k = min(min(c, m), y);
      float ik = 1.0 / max(1.0 - k, 0.001);
      c = (c - k) * ik; m = (m - k) * ik; y = (y - k) * ik;
      float hc = htDot(rotP(pp, 0.262), c, cs);
      float hm = htDot(rotP(pp, 1.309), m, cs);
      float hy = htDot(rotP(pp, 0.0),   y, cs);
      float hk = htDot(rotP(pp, 0.785), k, cs);
      gl_FragColor = vec4(hc * hk, hm * hk, hy * hk, 1.0);
    } else {
      gl_FragColor = vec4(vec3(htDot(pp, 1.0 - luma(color.rgb), cs)), 1.0);
    }
    return;
  }
  if (mode < 5.5) {
    float thr = ign(pp);
    if (colorMode > 0.5) gl_FragColor = vec4(orderedDither(color.r, thr, n), orderedDither(color.g, thr, n), orderedDither(color.b, thr, n), 1.0);
    else gl_FragColor = vec4(vec3(orderedDither(luma(color.rgb), thr, n)), 1.0);
    return;
  }
  gl_FragColor = color;
}
`;

// ─── Game of Life ────────────────────────────────────────────────────
function initGrid(pattern) {
  cols = Math.floor(width / cellSize);
  rows = Math.floor(height / cellSize);
  const len = cols * rows;
  grid = new Uint8Array(len);
  nextGrid = new Uint8Array(len);
  cellAge = new Uint16Array(len);
  trailAge = new Uint8Array(len);
  lifeImage = createImage(cols, rows);
  cpuBuffer = null;
  generation = 0;
  loadPattern(pattern || 'random');
}

function loadPattern(name) {
  grid.fill(0);
  nextGrid.fill(0);
  cellAge.fill(0);
  trailAge.fill(0);
  generation = 0;

  if (!name) return;

  if (name === 'random') {
    for (let i = 0; i < grid.length; i++) {
      grid[i] = Math.random() < 0.25 ? 1 : 0;
      cellAge[i] = grid[i] ? 1 : 0;
    }
    return;
  }

  const pat = PATTERNS[name];
  if (!pat) return;
  const ph = pat.length;
  const pw = Math.max(...pat.map(r => r.length));
  const ox = Math.floor(cols / 2 - pw / 2);
  const oy = Math.floor(rows / 2 - ph / 2);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pat[y].length; x++) {
      if (pat[y][x] !== '.') {
        const gx = ox + x, gy = oy + y;
        if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
          const idx = gy * cols + gx;
          grid[idx] = 1;
          cellAge[idx] = 1;
        }
      }
    }
  }
}

function stepGrid() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      const alive = grid[idx];
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          n += grid[((y + dy + rows) % rows) * cols + ((x + dx + cols) % cols)];
        }
      }
      nextGrid[idx] = (alive ? (n === 2 || n === 3) : n === 3) ? 1 : 0;

      if (nextGrid[idx]) {
        cellAge[idx] = alive ? cellAge[idx] + 1 : 1;
        trailAge[idx] = 0;
      } else {
        if (alive) trailAge[idx] = 1;
        else if (trailAge[idx] > 0 && trailAge[idx] < 255) trailAge[idx]++;
        cellAge[idx] = 0;
      }
    }
  }
  [grid, nextGrid] = [nextGrid, grid];
  generation++;
}

function renderLife() {
  lifeImage.loadPixels();
  const TRAIL_MAX = 25;
  for (let i = 0; i < cols * rows; i++) {
    const px = i * 4;
    if (grid[i]) {
      const t = Math.min(cellAge[i], 80) / 80;
      lifeImage.pixels[px]     = Math.round(235 - 60 * t);
      lifeImage.pixels[px + 1] = Math.round(240 - 50 * t);
      lifeImage.pixels[px + 2] = Math.round(250 - 40 * t);
    } else if (trailAge[i] > 0 && trailAge[i] < TRAIL_MAX) {
      const fade = 1 - trailAge[i] / TRAIL_MAX;
      lifeImage.pixels[px]     = Math.round(14 + 48 * fade);
      lifeImage.pixels[px + 1] = Math.round(16 + 52 * fade);
      lifeImage.pixels[px + 2] = Math.round(22 + 44 * fade);
    } else {
      lifeImage.pixels[px]     = 14;
      lifeImage.pixels[px + 1] = 16;
      lifeImage.pixels[px + 2] = 22;
    }
    lifeImage.pixels[px + 3] = 255;
  }
  lifeImage.updatePixels();
}

// ─── CPU error diffusion ─────────────────────────────────────────────
function errorDiffusion(pixels, w, h, n, color, kernel) {
  if (color) {
    const ch = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      ch[0][i] = pixels[idx] / 255;
      ch[1][i] = pixels[idx + 1] / 255;
      ch[2][i] = pixels[idx + 2] / 255;
    }
    for (let c = 0; c < 3; c++) {
      const arr = ch[c];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const oldV = arr[i];
          const newV = Math.round(oldV * (n - 1)) / (n - 1);
          arr[i] = newV;
          const err = oldV - newV;
          for (const k of kernel) {
            const nx = x + k.dx, ny = y + k.dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h)
              arr[ny * w + nx] += err * k.w;
          }
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      pixels[idx]     = Math.max(0, Math.min(255, Math.round(ch[0][i] * 255)));
      pixels[idx + 1] = Math.max(0, Math.min(255, Math.round(ch[1][i] * 255)));
      pixels[idx + 2] = Math.max(0, Math.min(255, Math.round(ch[2][i] * 255)));
    }
  } else {
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const oldV = gray[i];
        const newV = Math.round(oldV * (n - 1)) / (n - 1);
        gray[i] = newV;
        const err = oldV - newV;
        for (const k of kernel) {
          const nx = x + k.dx, ny = y + k.dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h)
            gray[ny * w + nx] += err * k.w;
        }
      }
    }
    for (let i = 0; i < w * h; i++) {
      const v = Math.max(0, Math.min(255, Math.round(gray[i] * 255)));
      const idx = i * 4;
      pixels[idx] = pixels[idx + 1] = pixels[idx + 2] = v;
    }
  }
}

function applyCPUDither() {
  const sw = lifeImage.width;
  const sh = lifeImage.height;

  if (!cpuBuffer || cpuBuffer.width !== sw || cpuBuffer.height !== sh) {
    cpuBuffer = createImage(sw, sh);
  }

  cpuBuffer.loadPixels();
  const len = sw * sh * 4;
  for (let i = 0; i < len; i++) cpuBuffer.pixels[i] = lifeImage.pixels[i];

  const kernel = currentMode === 'floyd-steinberg' ? FS_KERNEL : ATKINSON_KERNEL;
  errorDiffusion(cpuBuffer.pixels, sw, sh, levels, colorDither, kernel);
  cpuBuffer.updatePixels();

  resetShader();
  noSmooth();
  image(cpuBuffer, -width / 2, -height / 2, width, height);
}

// ─── p5 lifecycle ────────────────────────────────────────────────────
function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(30);
  noStroke();
  noSmooth();

  ditherShader = createFilterShader(FRAG_SRC);
  initGrid('random');
  createDitherUI();

  const hint = document.getElementById('hint');
  setTimeout(() => { if (hint) hint.classList.add('hint-faded'); }, 6000);

  window.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'x' || e.key === 'X') document.getElementById('dither-ui')?.classList.toggle('hidden');
    if (e.key === 'ArrowRight') cycleMode(1);
    if (e.key === 'ArrowLeft')  cycleMode(-1);
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    if (e.key === 'r' || e.key === 'R') {
      loadPattern('random');
      const sel = document.getElementById('life-preset');
      if (sel) sel.value = 'random';
    }
    if (e.key === 'c' || e.key === 'C') loadPattern(null);
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const ui = document.getElementById('dither-ui');
    if (ui && !ui.classList.contains('hidden') && ui.contains(e.target)) return;
    isDrawing = true;
    paintCell(e);
  });
  canvas.addEventListener('mousemove', (e) => { if (isDrawing) paintCell(e); });
  canvas.addEventListener('mouseup', () => { isDrawing = false; });
  canvas.addEventListener('mouseleave', () => { isDrawing = false; });
}

function paintCell(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const gx = Math.floor(mx * cols / rect.width);
  const gy = Math.floor(my * rows / rect.height);
  const brush = Math.max(1, Math.round(2 / cellSize));
  for (let dy = -brush; dy <= brush; dy++) {
    for (let dx = -brush; dx <= brush; dx++) {
      const nx = gx + dx, ny = gy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const idx = ny * cols + nx;
        grid[idx] = 1;
        cellAge[idx] = 1;
        trailAge[idx] = 0;
      }
    }
  }
}

function togglePause() {
  paused = !paused;
  const cb = document.getElementById('life-running');
  if (cb) cb.checked = !paused;
}

function draw() {
  if (!paused) {
    const interval = Math.max(1, Math.round(30 / simSpeed));
    if (frameCount % interval === 0) stepGrid();
  }

  renderLife();

  const genEl = document.getElementById('gen-counter');
  if (genEl) genEl.textContent = `Gen ${generation}`;

  if (GPU_MODES.has(currentMode)) {
    resetShader();
    noSmooth();
    image(lifeImage, -width / 2, -height / 2, width, height);

    ditherShader.setUniform('mode', DITHER_MODES.indexOf(currentMode));
    ditherShader.setUniform('levels', levels);
    ditherShader.setUniform('pixelScale', pixelScale);
    ditherShader.setUniform('colorMode', colorDither ? 1.0 : 0.0);
    ditherShader.setUniform('halftoneSize', 4.0 + pixelScale * 4.0);
    filter(ditherShader);
  } else {
    applyCPUDither();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initGrid('random');
}

// ─── Mode cycling ────────────────────────────────────────────────────
function cycleMode(dir) {
  let idx = DITHER_MODES.indexOf(currentMode);
  idx = (idx + dir + DITHER_MODES.length) % DITHER_MODES.length;
  currentMode = DITHER_MODES[idx];
  const sel = document.getElementById('dither-mode');
  if (sel) sel.value = currentMode;
}

// ─── UI panel ────────────────────────────────────────────────────────
function createDitherUI() {
  const container = document.getElementById('dither-ui');
  if (!container) return;

  const panel = document.createElement('div');
  panel.className = 'attractor-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <span class="title">Dither + Life</span>
      <span class="title" id="gen-counter" style="color:#555">Gen 0</span>
    </div>
    <div class="panel-body">
      <div class="panel-section">
        <div class="panel-section-title">Mode</div>
        <select id="dither-mode">
          ${DITHER_MODES.map(m => `<option value="${m}" ${m === currentMode ? 'selected' : ''}>${MODE_LABELS[m]}</option>`).join('')}
        </select>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Dithering</div>
        <div class="slider-row"><label for="dither-levels">Levels</label><input type="range" id="dither-levels" min="2" max="32" value="${levels}" step="1"><span class="value" id="dither-levelsVal">${levels}</span></div>
        <div class="slider-row"><label for="dither-pixelScale">Pixel scale</label><input type="range" id="dither-pixelScale" min="1" max="8" value="${pixelScale}" step="1"><span class="value" id="dither-pixelScaleVal">${pixelScale}</span></div>
        <label class="toggle-row"><input type="checkbox" id="dither-color" ${colorDither ? 'checked' : ''}><span>Color</span></label>
      </div>
      <div class="panel-section">
        <div class="panel-section-title">Life</div>
        <div class="slider-row"><label for="life-speed">Speed</label><input type="range" id="life-speed" min="1" max="30" value="${simSpeed}" step="1"><span class="value" id="life-speedVal">${simSpeed}</span></div>
        <div class="slider-row"><label for="life-cellSize">Cell size</label><input type="range" id="life-cellSize" min="2" max="12" value="${cellSize}" step="1"><span class="value" id="life-cellSizeVal">${cellSize}</span></div>
        <select id="life-preset" style="margin-top:6px">
          <option value="random" selected>Random</option>
          <option value="r-pentomino">R-pentomino</option>
          <option value="acorn">Acorn</option>
          <option value="diehard">Diehard</option>
          <option value="glider-gun">Gosper Glider Gun</option>
          <option value="pulsar">Pulsar</option>
        </select>
        <label class="toggle-row"><input type="checkbox" id="life-running" ${!paused ? 'checked' : ''}><span>Running</span></label>
      </div>
    </div>
  `;
  container.appendChild(panel);

  document.getElementById('dither-mode')?.addEventListener('change', (e) => { currentMode = e.target.value; });
  document.getElementById('dither-levels')?.addEventListener('input', (e) => {
    levels = Number(e.target.value);
    document.getElementById('dither-levelsVal').textContent = levels;
  });
  document.getElementById('dither-pixelScale')?.addEventListener('input', (e) => {
    pixelScale = Number(e.target.value);
    document.getElementById('dither-pixelScaleVal').textContent = pixelScale;
  });
  document.getElementById('dither-color')?.addEventListener('change', (e) => { colorDither = e.target.checked; });
  document.getElementById('life-speed')?.addEventListener('input', (e) => {
    simSpeed = Number(e.target.value);
    document.getElementById('life-speedVal').textContent = simSpeed;
  });
  document.getElementById('life-cellSize')?.addEventListener('input', (e) => {
    cellSize = Number(e.target.value);
    document.getElementById('life-cellSizeVal').textContent = cellSize;
    initGrid('random');
    const sel = document.getElementById('life-preset');
    if (sel) sel.value = 'random';
  });
  document.getElementById('life-preset')?.addEventListener('change', (e) => { loadPattern(e.target.value); });
  document.getElementById('life-running')?.addEventListener('change', (e) => { paused = !e.target.checked; });
}
