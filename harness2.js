/* harness2.js — v2 invariants: crossings, walls, farm packing, archetypes, determinism */
const T = require("./engine2.js");

let runs = 0, fails = [];
function fail(tag, cfg, msg) { fails.push(`[${tag}] seed=${cfg.seed} arch=${cfg.archetype || "auto"} size=${cfg.size || "auto"} :: ${msg}`); }

/* --- geometry helpers --- */
function segIntPoint(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function corners(b, shrink) {
  const s = shrink || 0, hw = Math.max(0.1, b.w / 2 - s), hh = Math.max(0.1, b.h / 2 - s);
  const c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0), out = [];
  for (const [dx, dy] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]])
    out.push({ x: b.x + dx * c - dy * sn, y: b.y + dx * sn + dy * c });
  return out;
}
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/* OBB overlap via SAT */
function obbOverlap(A, B) {
  const ca = corners(A, 0.75), cb = corners(B, 0.75);
  for (const poly of [ca, cb]) {
    for (let i = 0; i < 4; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % 4];
      const ax = -(p2.y - p1.y), ay = p2.x - p1.x;
      let minA = 1e9, maxA = -1e9, minB = 1e9, maxB = -1e9;
      for (const p of ca) { const d = p.x * ax + p.y * ay; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const p of cb) { const d = p.x * ax + p.y * ay; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

const VALID_LABELS = new Set(["poor", "plain", "good", "fine", "renowned"]);

function checkTown(cfg) {
  runs++;
  let t;
  try { t = T.generate(cfg); } catch (e) { fail("THROW", cfg, e.message); return; }
  const m = t.map, sim = t.sim;

  /* determinism */
  const t2 = T.generate(cfg);
  if (JSON.stringify(t) !== JSON.stringify(t2)) fail("DET", cfg, "non-deterministic output");

  /* quality block */
  if (!Array.isArray(t.quality) || !t.quality.length) fail("QUAL", cfg, "missing quality array");
  for (const q of t.quality) {
    if (!VALID_LABELS.has(q.label)) fail("QUAL", cfg, "bad label " + q.label);
    if (!(q.q >= 0.049 && q.q <= 0.951)) fail("QUAL", cfg, `q out of range ${q.k}=${q.q}`);
  }

  /* archetype block */
  if (!t.archetype || !t.archetype.key) fail("ARCH", cfg, "missing archetype");
  if (cfg.archetype && cfg.archetype !== "auto" && t.archetype.key !== cfg.archetype)
    fail("ARCH", cfg, `explicit ${cfg.archetype} -> got ${t.archetype.key}`);

  /* river crossings: every road-river intersection sits at the single crossing */
  if (m.river && m.river.pts) {
    if (!m.crossing) fail("CROSS", cfg, "river present but no crossing");
    const rp = m.river.pts;
    for (const road of (m.roads || [])) {
      const pts = road.pts || road;
      for (let i = 0; i + 1 < pts.length; i++) {
        for (let j = 0; j + 1 < rp.length; j++) {
          const ip = segIntPoint(pts[i], pts[i + 1], rp[j], rp[j + 1]);
          if (ip && m.crossing && dist(ip, m.crossing) > (m.river.w / 2 + 16))
            fail("CROSS", cfg, `road crosses river ${dist(ip, m.crossing).toFixed(0)}px from crossing`);
        }
      }
    }
    if (sim.bridge && m.crossing && m.crossing.bridgeEra == null) fail("CROSS", cfg, "sim.bridge but no bridgeEra");
  }

  /* wall straddle: footprint corners all-in or all-out */
  if (m.walls && m.walls.poly) {
    const poly = m.walls.poly;
    const checkRect = (b, tag) => {
      let inN = 0;
      for (const c of corners(b, 1.2)) if (pointInPoly(c, poly)) inN++;
      if (inN !== 0 && inN !== 4) fail("WALL", cfg, `${tag} ${b.kind || ""} straddles wall (${inN}/4 corners in)`);
    };
    for (const b of (m.buildings || [])) checkRect(b, "building");
    for (const l of (m.landmarks || [])) if (l.w && l.h) checkRect(l, "landmark");
  }

  /* farm packing: no strip/house OBB overlap across farms */
  const farms = m.farms || [];
  for (let a = 0; a < farms.length; a++) {
    for (let b = a + 1; b < farms.length; b++) {
      const ra = [farms[a].house, ...farms[a].strips], rb = [farms[b].house, ...farms[b].strips];
      let hit = false;
      for (const x of ra) { for (const y of rb) { if (obbOverlap(x, y)) { hit = true; break; } } if (hit) break; }
      if (hit) fail("FARM", cfg, `farms ${a}&${b} overlap (${farms[a].type}/${farms[b].type})`);
    }
  }

  /* big towns must render big — collapse tripwire (the original bug was 1 per 160 souls) */
  if (sim.pop > 6000 && (m.buildings || []).length < Math.min(1500, sim.pop / 105))
    fail("DENS", cfg, `only ${(m.buildings || []).length} buildings for ${sim.pop} souls`);

  /* buildings stay off the carriageway: center clears every road edge by bh/2 (kind-aware) */
  const ROADHALF = { highway: 2.5, mineroad: 2.1, lane: 1.3, track: 0.8 };
  function ptSegD(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    const u = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
    return Math.hypot(p.x - (a.x + dx * u), p.y - (a.y + dy * u));
  }
  for (const b of (m.buildings || [])) {
    for (const road of (m.roads || [])) {
      const rh = ROADHALF[road.kind] || 2.5, pts = road.pts || road;
      for (let i = 0; i + 1 < pts.length; i++) {
        if (ptSegD(b, pts[i], pts[i + 1]) < rh + b.h / 2 - 1.5) {
          fail("ROAD", cfg, `building sits on a ${road.kind} (${ptSegD(b, pts[i], pts[i + 1]).toFixed(1)}px from centerline)`);
          i = pts.length; break;
        }
      }
    }
  }

  /* no two building footprints overlap (grid-bucketed OBB-SAT) */
  {
    const grid = {}, CB = 26;
    const bk = (x, y) => Math.floor(x / CB) + "," + Math.floor(y / CB);
    (m.buildings || []).forEach((b, i) => { (grid[bk(b.x, b.y)] ||= []).push(i); });
    const bs = m.buildings || [];
    for (let i = 0; i < bs.length; i++) {
      const cx = Math.floor(bs[i].x / CB), cy = Math.floor(bs[i].y / CB);
      for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
        for (const j of (grid[(cx + gx) + "," + (cy + gy)] || [])) {
          if (j <= i) continue;
          if (obbOverlap(bs[i], bs[j])) { fail("BLDG", cfg, `buildings ${i}&${j} overlap`); gx = gy = 2; break; }
        }
      }
    }
  }

  /* districts: larger towns have wards, building district indexes are valid, order in range */
  if (sim.pop >= 6000 && (!m.districts || m.districts.length < 4))
    fail("DIST", cfg, `pop ${sim.pop} but only ${(m.districts || []).length} districts`);
  if (m.districts && m.districts.length) {
    for (const b of (m.buildings || [])) {
      if (b.d != null && !m.districts[b.d]) { fail("DIST", cfg, "building with invalid district index"); break; }
    }
  }
  if (!(m.order >= 0 && m.order <= 1)) fail("ORDER", cfg, "map.order out of range: " + m.order);

  /* every track ends at something it serves (farm house, landmark, adit) */
  for (const road of (m.roads || [])) {
    if (road.kind !== "track" || !road.pts.length) continue;
    const e = road.pts[road.pts.length - 1];
    const targets = [...(m.farms || []).map(f => f.house), ...(m.landmarks || []), ...(m.adits || [])];
    const dmin = targets.length ? Math.min(...targets.map(a => Math.hypot(a.x - e.x, a.y - e.y))) : 1e9;
    if (dmin > 24) fail("TRACK", cfg, `track ends ${dmin.toFixed(0)}px from anything it could serve`);
  }

  /* archetype map/sim guarantees */
  const has = k => sim.infra.some(f => f.key === k);
  const lmk = k => (m.landmarks || []).some(l => l.kind === k);
  switch (t.archetype.key) {
    case "capital":
      if (!cfg.popOverride && sim.target < 9000) fail("ARCH", cfg, `capital target ${sim.target} < 9000`);
      if (sim.government !== "crown") fail("ARCH", cfg, `capital gov ${sim.government}`);
      if (has("palace") && !lmk("palace")) fail("ARCH", cfg, "palace infra but no palace landmark");
      if (has("mint") && !lmk("mint")) fail("ARCH", cfg, "mint infra but no mint landmark");
      break;
    case "fortress":
      if (has("keep") && !lmk("keep")) fail("ARCH", cfg, "keep infra but no keep landmark");
      break;
    case "religious":
      if (has("abbey") && !lmk("abbey")) fail("ARCH", cfg, "abbey infra but no abbey landmark");
      break;
    case "mining":
      if (has("adits") && !(m.adits && m.adits.length)) fail("ARCH", cfg, "adits infra but no map adits");
      if (!(m.hills && m.hills.length >= 2)) fail("ARCH", cfg, "mining town without 2+ hills");
      break;
    case "port":
      if (has("quay") && !m.quay) fail("ARCH", cfg, "quay infra but no map quay");
      break;
    case "scholar":
      if (has("college") && !lmk("college")) fail("ARCH", cfg, "college infra but no college landmark");
      break;
    case "tradepost":
      if (has("caravanserai") && !lmk("caravanserai")) fail("ARCH", cfg, "caravanserai infra but no landmark");
      break;
    case "lumber":
      if (!(m.trees && m.trees.length)) fail("ARCH", cfg, "lumber town with no trees");
      if (!(m.stumps && m.stumps.length)) fail("ARCH", cfg, "lumber town with no stumps");
      break;
  }
}

/* --- matrix --- */
const archs = ["auto", ...T.ARCHETYPES];
const sizes = ["auto", "hamlet", "town", "city"];
let n = 0;
for (const a of archs) for (const s of sizes) for (let i = 0; i < 8; i++)
  checkTown({ seed: `h2-${a}-${s}-${i}`, archetype: a === "auto" ? undefined : a, size: s === "auto" ? undefined : s });
for (const terr of ["plains", "forest", "hills", "mountains", "coast", "river"]) for (let i = 0; i < 6; i++)
  checkTown({ seed: `h2t-${terr}-${i}`, terrain: terr });
for (const plan of ["grown", "surveyed"]) for (let i = 0; i < 4; i++)
  checkTown({ seed: `h2p-${plan}-${i}`, archetype: "market", size: i < 2 ? "town" : "city", plan });

console.log(`harness2: ${runs} towns generated, ${fails.length} failures`);
for (const f of fails.slice(0, 30)) console.log("  " + f);
if (fails.length > 30) console.log(`  ...and ${fails.length - 30} more`);
process.exit(fails.length ? 1 : 0);
