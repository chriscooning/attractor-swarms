# Plan: Agent Memory Graph — Living Context Visualization

## Goal
Fullscreen cinematic 3D force-directed graph simulating an agent's memory/filesystem growing in real-time. Obsidian graph view aesthetic — glowing dots, translucent edges, dark void. Organic metabolism: nodes spawn, clusters form, connections bridge clusters, transients decay, dense clusters fracture. Subtle mouse/touch parallax. Mobile-friendly.

---

## Tech Stack

| Component | Choice |
|-----------|--------|
| Rendering | `3d-force-graph` via ESM (ThreeJS/WebGL) |
| Physics | d3-force-3d (bundled with 3d-force-graph) |
| Node glow | Sprite-based radial gradients, additive blending |
| Depth | ThreeJS FogExp2 |
| Parallax | Pointer/touch tracking → lerped camera offset |
| Palette | CSS custom properties, easy to swap |

---

## Node Types

| Type | Color | Size | Lifespan |
|------|-------|------|----------|
| System | `--node-primary` | Large | Permanent |
| Folder | `--node-primary` | Med-large | Permanent |
| File | `--node-secondary` | Medium | Long-lived |
| Concept | `--node-accent` | Medium | Permanent |
| Transient | `--node-transient` | Small | 5–15s |

No labels. Nodes are glowing dots only.

---

## Graph Metabolism

1. **Seed** (0–2s) — spawn 5 system nodes
2. **Branch** (2–6s) — folders attach to system nodes
3. **Populate** (6s+) — files, concepts, transients attach to folders/system
4. **Cross-link** (8s+) — bridge edges between unrelated nodes
5. **Decay** (12s+) — transient nodes expire and are removed
6. **Fission** (20s+) — sever edges on dense nodes, clusters fragment

Steady state: cap at ~350 nodes (desktop) / ~150 (mobile). Oldest/least-connected pruned.

---

## Camera

- Auto-orbit around origin, ~7min revolution
- Sinusoidal radius + elevation breathing
- Mouse/touch parallax: ±4° azimuth, ±3° elevation, lerp 0.03/frame
- Mobile: touchmove drives parallax

---

## Files

- `PLAN_graph_memory.md` — this plan
- `graph.html` — fullscreen container, import map, CSS palette
- `graph.js` — ES module: simulation, rendering, camera, parallax
