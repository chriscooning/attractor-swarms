# Plan: Lorenz & Rössler Attractor Viewer

## Goal
- Particle systems that move along **Lorenz** and **Rössler** strange-attractor dynamics.
- **360° orbit** around the attractor and **zoom in/out** while staying **centered** on the object.

---

## 1. Attractor Equations

### Lorenz (from [Lorenz attractor](https://homepages.math.uic.edu/~kjerland/Lorenz/lorenz_attractor.html))
- **Equations:**  
  `x' = σ(y - x)`  
  `y' = x(ρ - z) - y`  
  `z' = xy - βz`
- **Standard params:** σ = 10, ρ = 28, β = 8/3  
- **Initial conditions:** e.g. near (5, 5, 5); chaotic so small differences diverge.
- **Shape:** Two “wings” (butterfly); trajectories spiral on one wing then switch to the other.

### Rössler
- **Equations:**  
  `x' = -y - z`  
  `y' = x + ay`  
  `z' = b + z(x - c)`
- **Standard params:** a = 0.2, b = 0.2, c = 5.7 (or c = 14 for different behavior).
- **Shape:** Single spiral band; simpler than Lorenz.

---

## 2. Technical Approach

| Item | Choice |
|------|--------|
| **Rendering** | p5.js **WEBGL** (3D) so we can orbit and zoom. |
| **Particles** | Many points (e.g. 2k–8k), each with (x, y, z); each particle is one trajectory. |
| **Integration** | Small step **Euler** or **RK4** for stability; dt ≈ 0.005–0.02. |
| **Scaling** | Scale (x,y,z) to fit the canvas (Lorenz ~ ±20, Rössler different range). |
| **Center** | World center = (0,0,0) or centroid of attractor; camera always looks at this center. |

---

## 3. Camera & Controls

| Control | Behavior |
|--------|----------|
| **Orbit 360°** | Mouse drag (or keys) → update azimuth θ and elevation φ; camera position = spherical (r, θ, φ) around **center**. |
| **Zoom** | Mouse wheel (or slider) → change **distance** r; camera moves in/out along view direction, **lookAt(center)** unchanged. |
| **Center** | `camera.lookAt(center)` every frame so the attractor stays centered. |

Implementation: store `orbitTheta`, `orbitPhi`, `zoomDistance`; compute camera position from spherical coords; `camera(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, 0, 1, 0)`.

---

## 4. UI

- **Attractor switch:** Dropdown or buttons → “Lorenz” / “Rössler” (reset particles when switching).
- **Optional sliders:** σ, ρ, β (Lorenz); a, b, c (Rössler) for experimentation.
- **Instructions:** Short on-screen text: “Drag to orbit, scroll to zoom.”
- **Particle count / trail:** Optional slider for N; optional “trail” mode (draw line strip per particle) in a later iteration.

---

## 5. File Structure

- **PLAN.md** (this file) — plan only.
- **attractor.html** — single page that loads p5.js and `attractor.js`.
- **attractor.js** — WEBGL sketch: Lorenz/Rössler ODEs, particle list, Euler/RK4 step, 3D draw, orbit/zoom, UI to switch attractor (and optional params).

Existing **index.html** + **sketch.js** remain the 2D murmuration; no change unless we later add a link from one to the other.

---

## 6. Implementation Order

1. **PLAN.md** — done.
2. **attractor.html** + **attractor.js** — implemented: WEBGL, Lorenz & Rössler ODEs, many particles, scale and draw; center camera at (0,0,0).
3. **Orbit** — mouse drag → θ, φ; camera from spherical coords; `camera(eye, center, up)`.
4. **Zoom** — wheel → distance; keep lookAt center.
5. **Rössler** — same pipeline, different ODE and scaling.
6. **UI** — dropdown to switch Lorenz/Rössler; on-screen hint for drag/scroll. Optional param sliders can be added later.

---

## 7. References

- [The Lorenz Attractor](https://homepages.math.uic.edu/~kjerland/Lorenz/lorenz_attractor.html) (UIC)
- Rössler: e.g. [Wikipedia](https://en.wikipedia.org/wiki/R%C3%B6ssler_attractor), [Wolfram MathWorld](https://mathworld.wolfram.com/RoesslerAttractor.html)
