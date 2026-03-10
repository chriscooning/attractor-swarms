/**
 * GoL Glyph Morph — Game of Life with biased transitions between glyphs.
 * Sequence: arize → ● → ▲ → ■ → ◆ (loops)
 */

const GLYPHS = ['arize', '●', '▲', '■', '◆'];

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

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  colorMode(RGB, 255, 255, 255, 255);

  cols = Math.floor(width / CELL_SIZE);
  rows = Math.floor(height / CELL_SIZE);

  buf = createGraphics(cols, rows);
  buf.pixelDensity(1);

  for (const g of GLYPHS) {
    glyphGrids.push(rasterizeGlyph(g));
  }

  grid = copyGrid(glyphGrids[0]);
  ages = makeGrid(cols, rows, (x, y) => grid[y][x] ? 1 : 0);
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

function countNeighbors(g, x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ny = (y + dy + rows) % rows;
      const nx = (x + dx + cols) % cols;
      n += g[ny][nx];
    }
  }
  return n;
}

function golStep(current, target, bias) {
  const next = makeGrid(cols, rows);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const alive = current[y][x];
      const n = countNeighbors(current, x, y);
      const want = target[y][x];

      let cell;

      if (alive) {
        cell = (n === 2 || n === 3) ? 1 : 0;
      } else {
        cell = (n === 3) ? 1 : 0;
      }

      if (bias > 0) {
        if (want && !cell && n >= 2 && Math.random() < bias * 0.6) {
          cell = 1;
        }
        if (!want && cell && Math.random() < bias * 0.4) {
          cell = 0;
        }
        if (want && !cell && Math.random() < bias * bias * 0.15) {
          cell = 1;
        }
      }

      next[y][x] = cell;
    }
  }
  return next;
}

function draw() {
  background(10, 10, 15);

  const nextIdx = (currentIdx + 1) % GLYPHS.length;
  const target = glyphGrids[nextIdx];

  let bias = 0;
  if (frameInCycle >= HOLD_FRAMES) {
    const morphT = (frameInCycle - HOLD_FRAMES) / MORPH_FRAMES;
    bias = morphT * morphT;
  }

  grid = golStep(grid, target, bias);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x]) {
        ages[y][x] = Math.min(ages[y][x] + 1, 20);
      } else {
        ages[y][x] = Math.max(ages[y][x] - 1, 0);
      }
    }
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const a = ages[y][x];
      if (a > 0) {
        const alpha = Math.min(a / 4, 1) * 218;
        fill(235, 235, 240, alpha);
        rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }

  frameInCycle++;
  if (frameInCycle >= CYCLE_FRAMES) {
    frameInCycle = 0;
    currentIdx = nextIdx;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  cols = Math.floor(width / CELL_SIZE);
  rows = Math.floor(height / CELL_SIZE);

  buf = createGraphics(cols, rows);
  buf.pixelDensity(1);

  glyphGrids = [];
  for (const g of GLYPHS) {
    glyphGrids.push(rasterizeGlyph(g));
  }

  grid = copyGrid(glyphGrids[currentIdx]);
  ages = makeGrid(cols, rows, (x, y) => grid[y][x] ? 1 : 0);
}
