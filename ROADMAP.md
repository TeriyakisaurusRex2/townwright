# Townwright roadmap — v2.x and beyond

J's direction (2026-06): more structure in big cities, purposeful roads, an underground layer,
and eventually region → country → continent scale. This file is the working plan; CLAUDE.md
stays the architecture handbook. Each phase is sized to ship alone, in order.

**Done already (this session):** lane tails are trimmed back to the last structure they serve
(`trimLanes` pass in `frags/mapmodel.js`, runs after farms commit); lanes that serve nothing
are removed. Highways/mineroads are never trimmed — they lead to the wider world by design.

## v2.1 — Road grades & farm tracks — **DONE 2026-06**

Shipped as: lane-tail trim (`trimLanes`), field-path tracks (`kind:"track"`) to farms +
outlying landmarks, and a paved core (`model.pavedSegs` — stone overlay + setts seam inside
the walls of chartered/wealthy towns) instead of a per-road `grade` field, which kept the
schema simpler (paving is a property of *where* the road runs, not of the road). Deferred:
wheel-rut dashes on dirt highways at k≥4.6 (needs offset polylines; revisit with districts).
Details in CLAUDE.md → Post-handoff changes → v2.1.

## v2.2 — Districts & town order — **DONE 2026-06**

Shipped as planned: `cfg.plan` / emergent `orderV` (+ "Town plan" select), planned grid streets
through the plaza for surveyed towns (laid before the first house, stopped at water, cobbled by
the paved-core pass), districts at pop ≥ 5k (market/wealth/craft/poor + harbor/miners/scholars/
abbeyside wards) driving building size/kind, 32% roof-tone tints, letterspaced ward labels from
k≥1.7, and ward lines in tooltips + the dossier panel. Deferred: district references in the
People/occupations tab; wheel-ruts (still waiting on offset polylines). Details in CLAUDE.md →
Post-handoff changes → v2.2.

## v2.3 — The Underworks (sewer layer for big cities)

- Generate when pop ≥ ~12k or capital: mains follow paved streets (offset polylines under the
  street net — geometry already exists), sloping to 1–3 outfalls at the river/sea downstream
  of town; junction chambers under crossroads, grates along streets, a cistern under the
  plaza, and one older "undercroft" spur near the citadel/abbey (adventure hook, deliberately
  unmapped end).
- Schema: `model.underworks = {mains:[{pts,w}], chambers:[{x,y,kind,nm}], outfalls:[{x,y}],
  grates:[{x,y}]}`. Chambers get deterministic names + lore via the existing nameAt/LORE
  machinery ("The Drowned Stair", "Tanners' Confluence").
- UI: a Surface/Underworks toggle next to the zoom buttons. Underworks paints a dark variant:
  ghosted surface streets for orientation, tunnels as double-line passages, chambers as rooms,
  grates as surface links. Tooltips/panel work as-is (hit index just swaps source arrays).
  PNG export exports whichever layer is active.
- This is cheap relative to its worldbuilding value because tunnels inherit street geometry.

## v3 — Region scale (country, continent)

The architectural insight: Townwright already takes geography as cfg (coast/river/relief/
resources) and picks archetypes emergently from it. A region generator only needs to produce
that cfg per settlement, plus a seed — then every town on the region map IS a Townwright town,
zoomable on click, deterministic from `worldSeed + settlementId`.

- **Region model**: heightfield (fbm + ridges), flow-accumulation rivers (the v2 single-valued
  river trick generalizes per-basin), coastline, biome bands. Settlement scoring = the same
  founding logic towns use now (river+coast+resources), importance tiers (capital/city/town/
  village) by score.
- **Routes**: least-cost paths over the heightfield between settlements by importance (the
  region-scale "highways"). Towns then inherit their highway bearings from the region routes
  so the two scales agree at the seam.
- **Borders**: weighted Voronoi over settlement importance for realms; snap border segments to
  rivers and ridgelines (classic, and reads instantly as "political map").
- **Scale recursion**: continent = sparser region pass that places regions; each region zooms
  the same way towns do. Persistence stays seed + JSON exports at every level.
- **DECIDED (J, 2026-06): v3 merges with the Cartographer's Table.** Hybrid authored +
  generated at every scale — some regions/cities/towns hand-crafted in FWB, some generated,
  most a mix. Architecture that falls out of this:
  - **FWB owns the world document** (Places, hand-drawn MapDocs, the canvas); **Townwright is
    the generative engine** — `engine2.js` already ships as a module (`Townwright.generate(cfg)`),
    so FWB imports it rather than reimplementing.
  - **Constraint pins** are the bridge between authored and generated: cfg grows optional
    pinned features (river bearing drawn by hand → cfg.riverPath; "the abbey goes HERE" →
    pinned reserved zone; hand-placed coast side, hand-named landmarks). The generator places
    pins first as reserved zones/fixed geometry, then generates around them — a town can be
    100% generated, 100% authored, or generated-then-pinned-then-regenerated.
  - **Provenance per entity**: each Place records `authored | generated(seed,cfg) | mixed(pins)`,
    so regeneration is always possible without losing hand work.
  - Region generation (heightfield/rivers/routes/borders above) becomes an FWB tool that
    *proposes*; the Table edits; settlements link down to Townwright town seeds.
  - Townwright stays a standalone single-file product too — the engine is shared, the shells
    differ.

## Engineering ground rules (all phases)

- THE ONE RULE holds: fragments + splice, never the built HTML.
- Every new geometry guarantee lands with a harness invariant the same day (ROAD/BLDG/DENS
  pattern). Every new UI surface gets a smoke check.
- RNG sequence is sacred within a phase; layout-changing phases note "seeds reroll" in the
  changelog (v2 already did this once — it's fine pre-region).
- Perf budget: full repaint stays under ~5ms on a city (currently 0.4–2.2ms); the Underworks
  layer paints only when active.
