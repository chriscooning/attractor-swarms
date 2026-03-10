/**
 * GoL Glyph Morph — Game of Life with biased transitions between glyphs.
 */

const CONFIG = {
  scene: 'agents. evals. arize.',
  colorByAge: false,
  glow: false,
  trails: false,
  cellSizeVar: false,
  dotMode: false,
  scanline: false,
  ruleset: 'life',
  briansBrain: false,
  mouseInfluence: false,
};

const SCENES = {
  'agents. evals. arize.': { type: 'glyph', glyphs: ['agents.', 'evals.', 'arize.'] },
  'arize + symbols':       { type: 'glyph', glyphs: ['arize', '●', '▲', '■', '◆'] },
  'sonar':                 { type: 'procedural', gen: 'sonar' },
  'spiral':                { type: 'procedural', gen: 'spiral' },
  'moiré':                 { type: 'procedural', gen: 'moire' },
  'perlin':                { type: 'procedural', gen: 'perlin' },
  'heartbeat':             { type: 'procedural', gen: 'heartbeat' },
  'conway':                { type: 'conway' },
};

let activeScene = SCENES[CONFIG.scene];
let activeGlyphs = activeScene.glyphs;

const CELL_SIZE = 7;
const HOLD_FRAMES = 40;
const MORPH_FRAMES = 80;
const CYCLE_FRAMES = HOLD_FRAMES + MORPH_FRAMES;

let cols, rows;
let grid, ages;
let glyphGrids = [];
let currentIdx = 0;
let frameInCycle = 0;
let buf;
let glowBuf;

const PROC_BIAS = 0.35;

const GENERATORS = {
  sonar(t) {
    const cx = cols / 2, cy = rows / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    return makeGrid(cols, rows, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const w1 = Math.sin(dist * Math.PI * 2 / 0.28 - t * 0.045);
      const w2 = Math.sin(dist * Math.PI * 2 / 0.476 - t * 0.027 + 2.0);
      return (w1 * 0.7 + w2 * 0.3) > 0.25 ? 1 : 0;
    });
  },

  spiral(t) {
    const cx = cols / 2, cy = rows / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    return makeGrid(cols, rows, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const angle = Math.atan2(dy, dx);
      const arms = 2;
      const v = Math.sin(angle * arms + dist * 18 - t * 0.06);
      return v > 0.15 && dist < 0.92 ? 1 : 0;
    });
  },

  moire(t) {
    const a1 = t * 0.003;
    const a2 = t * -0.0025 + 1.2;
    const spacing = 6;
    return makeGrid(cols, rows, (x, y) => {
      const g1 = Math.sin((x * Math.cos(a1) + y * Math.sin(a1)) * Math.PI / spacing);
      const g2 = Math.sin((x * Math.cos(a2) + y * Math.sin(a2)) * Math.PI / spacing);
      return (g1 + g2) > 0.6 ? 1 : 0;
    });
  },

  perlin(t) {
    const scale = 0.06;
    const drift = t * 0.008;
    return makeGrid(cols, rows, (x, y) => {
      return noise(x * scale, y * scale, drift) > 0.48 ? 1 : 0;
    });
  },

  heartbeat(t) {
    const cx = cols / 2, cy = rows / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    const period = 90;
    const phase = (t % period) / period;
    const radius = phase * 1.2;
    const width = 0.08 * (1 - phase * 0.6);
    return makeGrid(cols, rows, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      return Math.abs(dist - radius) < width ? 1 : 0;
    });
  },
};

let conwayPopMin = 0;

const RULESETS = {
  life:     { birth: new Set([3]),          survive: new Set([2, 3]) },
  highlife: { birth: new Set([3, 6]),       survive: new Set([2, 3]) },
  daynight: { birth: new Set([3, 6, 7, 8]), survive: new Set([3, 4, 6, 7, 8]) },
};

const MOUSE_RADIUS = 5;

function loadScene() {
  currentIdx = 0;
  frameInCycle = 0;

  if (activeScene.type === 'glyph') {
    activeGlyphs = activeScene.glyphs;
    glyphGrids = [];
    for (const g of activeGlyphs) {
      glyphGrids.push(rasterizeGlyph(g));
    }
    grid = copyGrid(glyphGrids[0]);
  } else if (activeScene.type === 'procedural') {
    activeGlyphs = null;
    glyphGrids = [];
    grid = GENERATORS[activeScene.gen](0);
  } else if (activeScene.type === 'conway') {
    activeGlyphs = null;
    glyphGrids = [];
    grid = makeGrid(cols, rows, () => Math.random() < 0.35 ? 1 : 0);
    conwayPopMin = Math.floor(cols * rows * 0.01);
  }

  ages = makeGrid(cols, rows, (x, y) => grid[y][x] ? 1 : 0);
}

/* ── UI wiring ── */

function wirePanel() {
  const toggle = document.getElementById('panel-toggle');
  const panel = document.getElementById('ctrl-panel');
  toggle.addEventListener('click', () => panel.classList.toggle('open'));

  const container = document.getElementById('scene-radios');
  for (const name of Object.keys(SCENES)) {
    const lbl = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'scene';
    radio.value = name;
    if (name === CONFIG.scene) radio.checked = true;
    radio.addEventListener('change', () => {
      CONFIG.scene = name;
      activeScene = SCENES[name];
      loadScene();
    });
    lbl.appendChild(radio);
    lbl.append(' ' + name);
    container.appendChild(lbl);
  }

  const bindCheck = (id, key) => {
    const el = document.getElementById(id);
    el.checked = CONFIG[key];
    el.addEventListener('change', () => { CONFIG[key] = el.checked; });
  };

  bindCheck('opt-colorAge', 'colorByAge');
  bindCheck('opt-glow', 'glow');
  bindCheck('opt-trails', 'trails');
  bindCheck('opt-cellSize', 'cellSizeVar');
  bindCheck('opt-dotMode', 'dotMode');
  bindCheck('opt-scanline', 'scanline');
  bindCheck('opt-briansBrain', 'briansBrain');
  bindCheck('opt-mouseInfluence', 'mouseInfluence');

  const rulesel = document.getElementById('opt-ruleset');
  rulesel.value = CONFIG.ruleset;
  rulesel.addEventListener('change', () => { CONFIG.ruleset = rulesel.value; });
}

/* ── p5 lifecycle ── */

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  colorMode(RGB, 255, 255, 255, 255);

  cols = Math.floor(width / CELL_SIZE);
  rows = Math.floor(height / CELL_SIZE);

  buf = createGraphics(cols, rows);
  buf.pixelDensity(1);

  glowBuf = createGraphics(width, height);
  glowBuf.pixelDensity(1);

  wirePanel();
  loadScene();
}

function rasterizeGlyph(str) {
  buf.background(0);
  buf.fill(255);
  buf.noStroke();

  const isGeo = str.length === 1 && '●▲■◆'.includes(str);
  let fontSize;

  if (isGeo) {
    fontSize = rows * 0.65;
  } else {
    fontSize = rows * 0.6;
    buf.textSize(fontSize);
    const tw = buf.textWidth(str);
    if (tw > cols * 0.85) {
      fontSize *= (cols * 0.85) / tw;
    }
  }

  buf.textSize(fontSize);
  buf.textAlign(CENTER, CENTER);
  buf.text(str, cols / 2, rows / 2 - fontSize * 0.05);

  buf.loadPixels();

  const out = [];
  for (let y = 0; y < rows; y++) {
    out[y] = [];
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      out[y][x] = buf.pixels[i] > 100 ? 1 : 0;
    }
  }
  return out;
}

function makeGrid(c, r, fn) {
  const g = [];
  for (let y = 0; y < r; y++) {
    g[y] = [];
    for (let x = 0; x < c; x++) {
      g[y][x] = fn ? fn(x, y) : 0;
    }
  }
  return g;
}

function copyGrid(src) {
  return src.map(row => [...row]);
}

function countNeighbors(g, x, y, brains) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ny = (y + dy + rows) % rows;
      const nx = (x + dx + cols) % cols;
      if (brains) {
        n += (g[ny][nx] === 1) ? 1 : 0;
      } else {
        n += g[ny][nx];
      }
    }
  }
  return n;
}

function golStep(current, target, bias) {
  const next = makeGrid(cols, rows);
  const rules = RULESETS[CONFIG.ruleset] || RULESETS.life;
  const brains = CONFIG.briansBrain;
  const mouseOn = CONFIG.mouseInfluence;
  const mx = mouseOn ? Math.floor(mouseX / CELL_SIZE) : -999;
  const my = mouseOn ? Math.floor(mouseY / CELL_SIZE) : -999;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const state = current[y][x];

      if (brains && state === 2) {
        next[y][x] = 0;
        continue;
      }

      const alive = brains ? (state === 1) : (state > 0);
      const n = countNeighbors(current, x, y, brains);
      const want = target[y][x];

      let cell;

      if (alive) {
        cell = rules.survive.has(n) ? 1 : 0;
        if (brains && !cell) cell = 2;
      } else {
        cell = rules.birth.has(n) ? 1 : 0;
      }

      if (bias > 0) {
        const c = brains ? (cell === 1 ? 1 : 0) : cell;
        let nudged = c;
        if (want && !c && n >= 2 && Math.random() < bias * 0.6) nudged = 1;
        if (!want && c && Math.random() < bias * 0.4) nudged = 0;
        if (want && !c && Math.random() < bias * bias * 0.15) nudged = 1;
        if (brains) {
          cell = nudged ? 1 : (cell === 2 ? 2 : 0);
        } else {
          cell = nudged;
        }
      }

      if (mouseOn) {
        const mdx = x - mx, mdy = y - my;
        if (mdx * mdx + mdy * mdy <= MOUSE_RADIUS * MOUSE_RADIUS) {
          if (!alive && Math.random() < 0.25) cell = 1;
        }
      }

      next[y][x] = cell;
    }
  }
  return next;
}

function cellColor(age) {
  const t = age / 20;
  if (t < 0.4) {
    const u = t / 0.4;
    return [80 + 100 * u, 130 + 80 * u, 220 + 20 * u];
  } else if (t < 0.7) {
    const u = (t - 0.4) / 0.3;
    return [180 + 55 * u, 210 + 30 * u, 240];
  } else {
    const u = (t - 0.7) / 0.3;
    return [235 + 20 * u, 225 - 30 * u, 240 - 100 * u];
  }
}

function draw() {
  if (CONFIG.trails) {
    noStroke();
    fill(10, 10, 15, 35);
    rect(0, 0, width, height);
  } else {
    background(10, 10, 15);
  }

  let target;
  let bias;

  if (activeScene.type === 'procedural') {
    target = GENERATORS[activeScene.gen](frameCount);
    bias = PROC_BIAS;
  } else if (activeScene.type === 'conway') {
    target = grid;
    bias = 0;
  } else if (activeScene.type === 'glyph') {
    const nextIdx = (currentIdx + 1) % activeGlyphs.length;
    target = glyphGrids[nextIdx];

    bias = 0;
    if (frameInCycle >= HOLD_FRAMES) {
      const morphT = (frameInCycle - HOLD_FRAMES) / MORPH_FRAMES;
      bias = morphT * morphT;
    }

    frameInCycle++;
    if (frameInCycle >= CYCLE_FRAMES) {
      frameInCycle = 0;
      currentIdx = nextIdx;
    }
  }

  grid = golStep(grid, target, bias);

  if (activeScene.type === 'conway') {
    let pop = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) pop += grid[y][x];
    if (pop < conwayPopMin) {
      grid = makeGrid(cols, rows, () => Math.random() < 0.35 ? 1 : 0);
    }
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = grid[y][x];
      if (v === 1) {
        ages[y][x] = Math.min(ages[y][x] + 1, 20);
      } else if (v === 2) {
        ages[y][x] = Math.max(ages[y][x], 1);
      } else {
        ages[y][x] = Math.max(ages[y][x] - 1, 0);
      }
    }
  }

  const useGlow = CONFIG.glow;
  const target_g = useGlow ? glowBuf : this;

  if (useGlow) {
    glowBuf.clear();
    glowBuf.noStroke();
  }

  noStroke();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = ages[y][x];
      if (a <= 0) continue;

      const isDying = CONFIG.briansBrain && grid[y][x] === 2;
      const alpha = isDying ? 120 : Math.min(a / 4, 1) * 218;
      let r, g, b;

      if (isDying) {
        r = 180; g = 80; b = 60;
      } else if (CONFIG.colorByAge) {
        [r, g, b] = cellColor(a);
      } else {
        r = 235; g = 235; b = 240;
      }

      const sz = CONFIG.cellSizeVar
        ? Math.max(1, (0.3 + 0.7 * (a / 20)) * (CELL_SIZE - 1))
        : CELL_SIZE - 1;
      const offset = CONFIG.cellSizeVar ? (CELL_SIZE - 1 - sz) / 2 : 0;
      const px = x * CELL_SIZE + offset;
      const py = y * CELL_SIZE + offset;

      if (useGlow) {
        glowBuf.fill(r, g, b, alpha);
        if (CONFIG.dotMode) {
          glowBuf.ellipse(px + sz / 2, py + sz / 2, sz, sz);
        } else {
          glowBuf.rect(px, py, sz, sz);
        }
      } else {
        fill(r, g, b, alpha);
        if (CONFIG.dotMode) {
          ellipse(px + sz / 2, py + sz / 2, sz, sz);
        } else {
          rect(px, py, sz, sz);
        }
      }
    }
  }

  if (useGlow) {
    glowBuf.filter(BLUR, 4);
    push();
    tint(255, 120);
    image(glowBuf, 0, 0);
    pop();

    noStroke();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const a = ages[y][x];
        if (a <= 0) continue;

        const isDying2 = CONFIG.briansBrain && grid[y][x] === 2;
        const alpha = isDying2 ? 120 : Math.min(a / 4, 1) * 218;
        let r, g, b;
        if (isDying2) {
          r = 180; g = 80; b = 60;
        } else if (CONFIG.colorByAge) {
          [r, g, b] = cellColor(a);
        } else {
          r = 235; g = 235; b = 240;
        }

        const sz = CONFIG.cellSizeVar
          ? Math.max(1, (0.3 + 0.7 * (a / 20)) * (CELL_SIZE - 1))
          : CELL_SIZE - 1;
        const offset = CONFIG.cellSizeVar ? (CELL_SIZE - 1 - sz) / 2 : 0;
        const px = x * CELL_SIZE + offset;
        const py = y * CELL_SIZE + offset;

        fill(r, g, b, alpha);
        if (CONFIG.dotMode) {
          ellipse(px + sz / 2, py + sz / 2, sz, sz);
        } else {
          rect(px, py, sz, sz);
        }
      }
    }
  }

  if (CONFIG.scanline) {
    stroke(0, 0, 0, 40);
    strokeWeight(1);
    for (let sy = 0; sy < height; sy += 2) {
      line(0, sy, width, sy);
    }
    noStroke();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  cols = Math.floor(width / CELL_SIZE);
  rows = Math.floor(height / CELL_SIZE);

  buf = createGraphics(cols, rows);
  buf.pixelDensity(1);

  glowBuf = createGraphics(width, height);
  glowBuf.pixelDensity(1);

  loadScene();
}
