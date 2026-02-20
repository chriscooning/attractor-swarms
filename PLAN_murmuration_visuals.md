# Plan: Murmuration visuals — flock of birds + agent swarm + instrumentation

## Goal
Make the murmuration look like a **flock of birds** and an **agent swarm on a grid**, and add **instrumentation** so you can "see" what is happening (perception, swarms, velocity).

## 1. Bird-shaped boids
- **Replace cone with bird glyph**: elongated teardrop (point = head) in the plane of motion, plus two short "wing" lines for silhouette. Draw as triangle + lines so it reads as a bird from any angle.
- **Per-boid variation**: add `sizeScale` (e.g. 0.8–1.2) and `phase` (for flutter) when creating boids so they’re not identical.
- **Subtle flutter**: optional tiny scale or wing-angle oscillation using `frameCount + b.phase` so the swarm feels alive.

## 2. Motion trails
- **Per-boid trail**: add `trail: []` to each boid; each frame push `{x,y,z}` and trim to fixed length (e.g. 8–12 points).
- **Draw**: before drawing boids, draw each trail as a fading line strip (alpha increases toward the boid); use swarm hue for color.
- **Toggle**: panel option "Trails" to show/hide.

## 3. Grid (agent swarm feel)
- **Floor grid**: draw a regular grid in the bottom face of the cube (and optionally one other face) so the space feels like a discretized "agent grid." Use `murmurGridSize` or a derived step; subtle grey/low-opacity lines.
- **Toggle**: panel option "Grid" to show/hide.

## 4. Instrumentation ("see what’s happening")
- **Toggle**: "Show instrumentation" in the Murmuration panel.
- When on, draw:
  - **Perception radius**: faint sphere (or circle) around the flock centroid or one sample boid, using the same `perception` value as in the step.
  - **Separation radius**: same idea for separation distance (smaller sphere).
  - **Swarm boundaries**: for each swarm, compute axis-aligned bounding box or centroid + max radius; draw wireframe box or outline.
  - **Velocity arrows** (optional): short lines from each boid in velocity direction; can limit to every Nth boid if too noisy.
  - **Lorenz target**: small sphere/dot at the current nearest point on the Lorenz path for the flock centroid.
- Draw order: grid → Lorenz path → instrumentation → trails → boids (so boids stay on top).

## 5. Draw order and polish
- Order: box edges → floor grid (if on) → Lorenz path → instrumentation (if on) → trails (if on) → boids.
- Ensure bird glyph uses the same coordinate system as current cone (translate(b.x, b.z, b.y), then rotate by yaw/pitch from velocity).

## 6. Panel additions
- **Trails**: checkbox, default on.
- **Grid**: checkbox, default on.
- **Show instrumentation**: checkbox, default off.
- **Bird shape**: checkbox "Bird shape" (vs arrow/cone), default on for new attractors.

## Implementation notes
- Boid init: add `trail: []`, `sizeScale: 0.85 + random(0.3)`, `phase: random(TWO_PI)`.
- In `murmurBoidStep`: after updating position, push `{x: b.x, y: b.y, z: b.z}` to `b.trail`, trim to `MURMUR_TRAIL_LENGTH`.
- New constant: `MURMUR_TRAIL_LENGTH = 10`.
- New state: `murmurShowTrails: true`, `murmurShowGrid: true`, `murmurShowInstrumentation: false`, `murmurBirdShape: true`.
- Bird drawing: in draw, if `murmurBirdShape` use new `drawBoidBird(b, ...)` else keep existing cone for compatibility.
