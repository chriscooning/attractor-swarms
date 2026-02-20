/**
 * Murmuration — flocking + gravity/attractors
 * p5.js sketch: thousands of particles, boids behavior, two attractors (funnel + spire)
 */

let particles = [];
const NUM_PARTICLES = 4000;

// Attractors (funnel bottom-left, spire top-right) — normalized 0..1, scaled in draw
const ATTRACTOR_FUNNEL = { x: 0.22, y: 0.82 };
const ATTRACTOR_SPIRE = { x: 0.78, y: 0.18 };

// Tuning
const FLOCK_PERCEPTION = 42;
const SEPARATION_WEIGHT = 1.8;
const ALIGNMENT_WEIGHT = 1.0;
const COHESION_WEIGHT = 0.85;
const ATTRACTOR_STRENGTH = 0.12;
const ATTRACTOR_RADIUS = 280;
const TURBULENCE_STRENGTH = 0.35;
const MAX_SPEED = 3.2;
const MAX_FORCE = 0.22;

// Pan (hold H to drag view)
let panX = 0, panY = 0;
let handToolActive = false;
let isDragging = false;
let dragPrevX, dragPrevY;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push(new Particle());
  }

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
  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    updateCursor();
  });
  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    updateCursor();
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || !handToolActive) return;
    panX += e.clientX - dragPrevX;
    panY += e.clientY - dragPrevY;
    dragPrevX = e.clientX;
    dragPrevY = e.clientY;
  });
}

function draw() {
  background(0, 0, 100); // white, like reference
  translate(panX, panY);

  const funnel = createVector(ATTRACTOR_FUNNEL.x * width, ATTRACTOR_FUNNEL.y * height);
  const spire = createVector(ATTRACTOR_SPIRE.x * width, ATTRACTOR_SPIRE.y * height);

  for (let p of particles) {
    p.edges();
    p.flock(particles);
    p.attract(funnel, spire);
    p.turbulence();
    p.update();
    p.show();
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(random(0.5, 1.5));
    this.acc = createVector(0, 0);
    this.sizeBase = random(1.2, 2.8);
    this.angle = random(TWO_PI);
    this.angleSpeed = random(-0.02, 0.02);
    // Slight hue/sat variation for organic look (still dark)
    this.hue = 0;
    this.sat = 0;
    this.bright = random(8, 22); // dark specks on white
  }

  edges() {
    const margin = 80;
    if (this.pos.x < -margin) this.pos.x = width + margin;
    if (this.pos.x > width + margin) this.pos.x = -margin;
    if (this.pos.y < -margin) this.pos.y = height + margin;
    if (this.pos.y > height + margin) this.pos.y = -margin;
  }

  flock(others) {
    let sep = createVector(0, 0);
    let ali = createVector(0, 0);
    let coh = createVector(0, 0);
    let sepCount = 0, aliCount = 0, cohCount = 0;
    const r = FLOCK_PERCEPTION;

    for (let o of others) {
      if (o === this) continue;
      let d = p5.Vector.dist(this.pos, o.pos);
      if (d > r) continue;

      // Separation: steer away from close neighbors
      if (d < r * 0.4 && d > 0) {
        let away = p5.Vector.sub(this.pos, o.pos);
        away.div(d);
        sep.add(away);
        sepCount++;
      }

      // Alignment: match velocity of neighbors
      ali.add(o.vel);
      aliCount++;

      // Cohesion: steer toward local center
      coh.add(o.pos);
      cohCount++;
    }

    if (sepCount > 0) {
      sep.div(sepCount);
      sep.setMag(MAX_SPEED);
      sep.sub(this.vel);
      sep.limit(MAX_FORCE * 1.5);
      this.acc.add(sep.mult(SEPARATION_WEIGHT));
    }
    if (aliCount > 0) {
      ali.div(aliCount);
      ali.setMag(MAX_SPEED);
      ali.sub(this.vel);
      ali.limit(MAX_FORCE);
      this.acc.add(ali.mult(ALIGNMENT_WEIGHT));
    }
    if (cohCount > 0) {
      coh.div(cohCount);
      let toCenter = p5.Vector.sub(coh, this.pos);
      toCenter.setMag(MAX_SPEED);
      toCenter.sub(this.vel);
      toCenter.limit(MAX_FORCE);
      this.acc.add(toCenter.mult(COHESION_WEIGHT));
    }
  }

  attract(funnel, spire) {
    const pull = (target) => {
      let to = p5.Vector.sub(target, this.pos);
      let d = to.mag();
      if (d < 5) return;
      d = max(d, 20);
      let strength = (ATTRACTOR_STRENGTH * ATTRACTOR_RADIUS) / d;
      to.setMag(min(strength, 0.8));
      return to;
    };
    this.acc.add(pull(funnel));
    this.acc.add(pull(spire));
  }

  turbulence() {
    const scale = 0.003;
    const t = frameCount * 0.015;
    let nx = this.pos.x * scale + t;
    let ny = this.pos.y * scale + t * 0.7;
    this.acc.x += (noise(nx, ny) - 0.5) * TURBULENCE_STRENGTH;
    this.acc.y += (noise(nx + 100, ny) - 0.5) * TURBULENCE_STRENGTH;
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(MAX_SPEED);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
    this.angle += this.angleSpeed;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    fill(this.hue, this.sat, this.bright, 92);
    // Elongated dash / speck
    const w = this.sizeBase * 0.6;
    const h = this.sizeBase * 1.8;
    ellipse(0, 0, w, h);
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
