# Plan: Center-peak flow (particles from left, right, and up into center)

## Goal
A separate p5.js sketch where particles **flow from the left, right, and top** toward a **single center peak**, so that density is highest at the center and tapers off toward the edges—inspired by skewed centered stable distributions (e.g. peak at center, flow from both sides; optional skew parameter β).

## Concept

- **2D canvas** (same style as the murmuration sketch: 2D, many particles).
- **One central attractor** at the middle of the screen; particles are pulled toward it so they accumulate at the center (the “peak”).
- **Particles originate at the boundaries**: spawn (or respawn) along the **left edge**, **right edge**, and **top edge**, then move inward under the central force. Optionally allow some from the bottom for symmetry.
- **Visual outcome**: A visible density peak at the center, with streams of particles flowing in from left, right, and up, matching the idea of “particles flow from left and right and up into the center peak.”
- **Optional skew (β)**: A parameter (e.g. 0 = symmetric flow, 1 = skewed) can bias spawn positions or attractor strength by side (e.g. stronger pull from one side, or more particles from left than right) to echo the skewed stable distribution look.

## Implementation outline

### 1. Physics / forces

- **Central attractor**: Single point at `(width/2, height/2)`. Force on each particle: toward center, e.g. inverse-distance (stronger when closer) or a Gaussian-like potential so particles “roll” toward the peak. Use the same kind of pull as in [sketch.js](sketch.js) (`attract` with one target).
- **Optional damping**: Slight velocity damping or speed limit so particles don’t overshoot forever; they settle or orbit loosely around the peak.
- **Optional turbulence**: Small noise on acceleration so the flow isn’t perfectly mechanical (like murmuration).

### 2. Spawn / respawn

- **Initial**: Fill N particles by spawning at the left edge (e.g. x = 0 or near 0, y random), right edge (x = width), and top edge (y = 0, x random). Ratio can be tunable (e.g. 1/3 each) or weighted.
- **Respawn**: When a particle gets very close to the center (or after a lifetime), respawn it at a random choice of left / right / top edge. That keeps a steady “flow” into the peak and avoids all particles piling at center only once.
- **Skew (β)**: If β > 0, bias respawn (e.g. more from left than right) or bias force by which side the particle is on (e.g. stronger pull when coming from the left). Keeps the “skewed” distribution feel.

### 3. Drawing

- **Particles**: Small shapes (ellipse or short line) as in murmuration; dark on light or light on dark to taste.
- **Optional trails**: Per-particle history and draw a fading trail (like [attractor.js](attractor.js)) so the “flow” lines are visible. Optional decay by distance or age.
- **No flocking**: No boids; only central force + optional turbulence + respawn. That keeps the focus on “flow into peak.”

### 4. Parameters (tunable via constants or later sliders)

| Parameter   | Role |
|------------|------|
| Peak strength | Magnitude of pull toward center. |
| Spawn edges   | Which edges emit particles (left, right, top; optionally bottom). |
| Respawn radius | Distance from center below which a particle is respawned at an edge. |
| Skew β        | 0 = symmetric flow; 1 = skewed (e.g. more from one side or asymmetric force). |
| Trail length / decay | If trails are used: length and fade. |
| Turbulence    | Amount of noise on acceleration. |

### 5. File structure

- **New sketch** (keep existing ones unchanged):
  - **peak.html** — Page that loads p5.js and `peak.js`; minimal UI (optional: link back to index / attractor).
  - **peak.js** — `setup()` / `draw()`; central attractor; spawn at left/right/top; update and respawn logic; draw particles (and optional trails).

Existing files stay as-is: [index.html](index.html) + [sketch.js](sketch.js) (murmuration), [attractor.html](attractor.html) + [attractor.js](attractor.js) (Lorenz/Rössler).

### 6. Implementation order

1. **peak.html** + **peak.js** skeleton: canvas, one central attractor, particles that spawn once at left/right/top and are pulled toward center.
2. Respawn: when particle is close to center (or age), respawn at a random edge (left/right/top).
3. Tune force (and optional damping) so density visibly peaks at center.
4. Optional: trails with decay; then skew β (bias spawn or force).
5. Optional: simple on-screen controls (sliders for peak strength, β, respawn radius) or instructions.

## Out of scope for this plan

- Changing the murmuration or Lorenz/Rössler sketches.
- 3D or WEBGL for this sketch (2D only unless we extend later).
- Exact replication of the stable distribution PDF (we’re approximating the *effect*: flow into a central peak, optional skew).

## Reference

- Skewed centered stable distributions (α, β, c, μ): peak at center (μ=0), symmetric at β=0, right-skewed as β increases. We use the same idea of “central peak + skew” for particle flow and density, not the math of the PDF itself.
