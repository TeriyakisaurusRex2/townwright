# Townwright v2 — Claude Code handoff

> Forward plan (districts, road grades, sewers, region scale) lives in **ROADMAP.md**.

A single-file HTML fantasy town generator. **v1 shipped** (deterministic engine: region → founding → industries → 10-year-tick simulation → economy → names/people/prose → canvas map, with a 3-tier control UI and 5 document tabs). **v2 is built and passing all automated tests** — what remains is real-browser QA and polish, which is why you're getting this locally.

Status at handoff:

| Piece | State |
|---|---|
| Engine v2 (archetypes, craft quality, geometry fixes) | **Done.** `node harness2.js` → 388 towns, 0 failures |
| UI v2 (zoom/pan/pinch, tooltips, era scrubber, archetype select, ~30 new map glyphs) | **Built, passing jsdom.** `node smoke.js` → 47 checks, all pass |
| Real-browser QA (feel, touch, visuals, perf) | **Done 2026-06** (see Post-handoff changes) except phone-hardware items: pinch, double-tap feel, thumb scrubber, OS reduced-motion |

## Quick start

```bash
npm i jsdom          # once (smoke test dependency)
bash build.sh        # regenerate townwright.html from v1 base + frags, extract, syntax-check
node harness2.js     # engine invariants (388 towns)
node smoke.js        # UI smoke (jsdom)
open townwright.html # the product
```

## THE ONE RULE

**`townwright.html` is generated. Never hand-edit it.** Source of truth is `townwright.v1.bak.html` (the v1 base) plus `frags/*.js` (v2 replacements), assembled by `splice.py` (engine) and `uisplice.py` (UI), which find/replace between the `/* ================= section ================= */` anchor comments. Every splice operation asserts its anchor exists exactly once — if you change v1 anchor text or duplicate an anchor inside a fragment, the build fails loudly (good). To change anything: edit the fragment, `bash build.sh`, re-run tests.

`engine2.js` / `ui2.js` are extracted build artifacts (engine2 gets a `module.exports` shim so node tests can require it). `engine.v1.js` / `ui.v1.js` are frozen v1 references for diffing.

## What v2 added (the brief, and how it landed)

1. **Interactive map** — wheel/pinch zoom (1×–8×, zooms to cursor), drag pan (clamped so parchment always fills the frame), double-click/double-tap zoom, +/−/reset buttons, hover/tap tooltips on every building and landmark (anonymous houses get deterministic householder names lazily via `Townwright.nameAt(seed, buildingIndex)`), place-name labels that fade in as you lean past 2.2×, an era scrubber + replay button to walk the town's growth year by year, and a PNG export that renders a clean 2000×1400 offscreen frame at identity view (no labels, chrome intact).
2. **Roads over rivers — fixed at the root.** v1's river was subdivided with x+y jitter then *sorted by x*, which scrambled the polyline; all bank-side math was reasoning about a different curve than the one drawn. The v2 river is single-valued in x by construction (y-only midpoint displacement + monotonic sweep). All roads route through **one canonical crossing** (nearest river point to town center, perpendicular approaches), with each bank's half densified to ≤14px segments and iteratively clamped to its side (`enforceSide`). The crossing renders as a **ford** (stepping stones + dashed wade line) from founding and upgrades to a **bridge** at the year the sim event fires.
3. **Buildings vs walls — fixed at the root.** Wall hull is computed over building **corners** (not centers) plus the extents of must-enclose reserved zones; buildings/landmarks placed after the wall are footprint-tested against the ring, gates get clearance, and a final wall-sanity pass nudges or drops anything still straddling (essential landmarks get pulled inside; fairgrounds/slipways/warehouses may be dropped). Harness asserts every footprint is all-in or all-out.
4. **Farms overlapping — fixed at the root.** Every farm (house + strips) is committed through `farmFits`: dense per-strip samples checked against water/roads/walls/reserved zones/the building hash, plus disjoint bounding circles across farms. Vintner towns get vine terraces hugging hill contours (`farm.type:"vine"`); harness does OBB-SAT across all strip pairs.
5. **Ten archetypes, integrated at the base** (not bolted on): each is a first-class pipeline stage influencing founding weights, industry strengths/floors, population target, wealth, government, infra thresholds, events, occupations, notables, name morphemes, epithets, prose, craft-quality bias, and map complexes. `market, mining, port, religious, capital, tradepost, fortress, scholar, vintner, lumber` — selectable in the Simple pane or emergent from geography. Capitals force `crown` government and a ≥9,000 target with palace/citadel/mint/barracks/parade; mining gets guaranteed hills, adits (boarded over if the vein dies), miners' row, ore road; ports get quay/customs/lighthouse/ropewalk/slipway/extra piers; religious gets a walled abbey precinct with cloister, hospice, abbey graveyard, waymark crosses; etc.
6. **Craft quality** — 9 crafts (`smith, weapons, vines, brew, leather, pottery, wool, ships, herbcraft`) seeded from resource ties + archetype bias, evolving through master/shoddy/vintage/blight/fire events, feeding wealth each tick, prefixing exports, labeling industries, minting "Master <craft>" notables at ≥0.78, and rendered as a **Craft repute** chip row in the Economy tab (poor/plain/good/fine/renowned, color-coded).

## Engine pipeline (generate order — don't reorder casually, RNG draws are sequence-sensitive)

```
normalizeCfg (adds cfg.archetype, default "auto")
→ genRegion
→ [explicit archetype only] applyArchToRegion   (coerces coast/relief/resource floors)
→ chooseFounding(rng, cfg, region, foundW)      (explicit archetype biases founding pick)
→ industryStrengths
→ baseTarget = chooseTarget                     (returns popOverride verbatim if set)
→ arch = chooseArchetype(...)                   (explicit short-circuits; else weighted by founding/S/target)
→ applyArchToS
→ target = baseTarget × targetMul, max targetMin (skipped entirely if popOverride)
→ Q = seedQuality(rng, region, S, def)          (guarantees ≥2 crafts; brew/leather fallback)
→ chooseAge → simulate(..., arch, Q) → economy(..., arch) → makeNames(..., arch)
→ makePeople(..., arch) → buildProse(..., arch)
→ buildMapModel(cfg, region, founding, sim, S, eco, arch, names, people)
```

Each sim/eco/people/names fragment derives `var def = arch.def` internally. `VERSION` is `"2.0.0"` — **v1 seeds intentionally generate different towns now** (RNG draw counts changed); J knows.

## v2 output schema deltas (vs v1)

Top level: `archetype:{key,label,emergent}`, `quality:[{k,craft,q,label}]` sorted desc. `sim.Q` = raw craft map (0.05–0.95). `economy.industries[].quality` = label or null. Exports: `Townwright.ARCHETYPES` (10 keys), `Townwright.nameAt(seed,i)`.

`map` additions: `arch{key,label}` · `veinDead` · `crossing{x,y,angle(tangent),w,fordEra:0,bridgeEra|null}` · `quay{y1,y2,era}` · `citadel{poly,era}` · `precinct{poly,era}` · `waymarks[{x,y}]` · `adits[{x,y,rot,era}]` · `stumps[{x,y,r}]` · `logpond{x,y,rx,ry,era}` · `farms[].type` `"field"|"vine"` · buildings gain `kind:"tavern"`, `.nm` (tavern name), `.who` ("Name, Role") · landmarks gain `.nm`, `.who`, `.bell` (abbey), `.logs` (sawmill). **Removed: `map.bridge`** (superseded by `crossing`). Hills guaranteed ≥2 for mining/vintner.

Landmark kinds the painter handles (drawLandmark in `frags/ui-paint.js`): church, temple, keep, guildhall, mill, windmill, tannery, smelter, graveyard, ware, customs, lighthouse, ropewalk, slipway, abbey, cloister, hospice, palace, mint, highcourt, barracks, parade, watchtower, college, collegewing, library, scriptorium, caravanserai, fairground, marketcross, press, cellars, sawmill — plus non-landmark layers: crossing, quay, citadel, precinct, waymarks, adits (+spoil, +veinDead boarding), stumps, logpond, vine strips.

## Adding an archetype (J wants this list to keep growing)

1. `frags/arch.js` — new `ARCH` entry. Fields: `label, need{coast/river/relief}, resFloor, foundW, Smul, Sfloor, targetMul, targetMin, wealthBias, gov{force|bias}, qBias, infra:[{key,pop,label}], occ:[{n,d,g}], notables:[{role,lines[],ruler?}], namePre, nameSuf, epithets, prose`. Add a weight row in `chooseArchetype` if it should emerge naturally.
2. `frags/sim.js` — optional `ARCH_EVENTS[key]` array (same shape as base EVENTS; can mutate `ctx.Q`).
3. `frags/mapmodel.js` — optional reserved zone (pre-building, via `reserve()`) + a complex block in the archetype-complexes section keyed off your infra keys. Use `lmOK`/`lmAdd`/`placeNear`; give landmarks `.nm` for labels/tooltips.
4. `frags/ui-paint.js` — `drawLandmark` glyph branch + `KINDLBL` tooltip label + optional `LMFILL` tone.
5. `uisplice.py` — add the `<option>` (then bump the smoke check that expects 11 options).
6. `harness2.js` — add an assertion (infra key ⇒ landmark/array exists).
7. `bash build.sh && node harness2.js && node smoke.js`.

## Testing

`harness2.js` (requires `engine2.js`, i.e. run build first): 11 archetype values × 4 sizes × 8 seeds + a terrain matrix = 388 towns. Invariants: determinism (full-JSON double-generate), every road×river intersection within `w/2+16` of the single crossing, every building/landmark footprint all-in or all-out of the wall ring (corner test, 1.2px shrink), cross-farm OBB-SAT disjointness, quality labels/bounds, and per-archetype guarantees (capital target ≥9000 + crown gov + palace; abbey/college/caravanserai/quay/adits/hills present when their infra fired).

`smoke.js` (jsdom): the canvas is an accept-anything proxy stub and `matchMedia` reports reduced-motion so paints run synchronously. 46 checks covering v1 surfaces plus v2: VERSION/exports/nameAt, archetype select wiring (explicit religious + mining reflected in Overview), Craft repute render, map control presence, zoom/replay no-throw, scrubber driving the year label both ways. The trailing "Not implemented: navigation to another Document" line is benign jsdom noise from the download-anchor click.

## YOUR TODO — real-browser QA checklist

Interaction feel: wheel zoom direction/speed (`0.0016` factor in the wheel handler), drag pan, pinch on an actual phone, double-tap zoom (custom 330ms/26px detector for touch; native dblclick for mouse), tooltip stickiness on tap (2.8s timer). Tooltip positioning near canvas edges (it's `translate(-50%,-115%)` anchored to the stage — may need flip logic at the top edge).

Visual pass: seed-surf every archetype (force via the select, hammer R) and judge the ~30 glyphs; label density at k=2.2 / 3 / 4.6 (householder labels cap at 70 visible — tune); ford→bridge transition (scrub across `crossing.bridgeEra` on a river town); boarded adits on a dead-vein mining town (console: loop `Townwright.generate({archetype:"mining",seed:"x"+i})` until `sim.veinDead`); abbey precinct/citadel rendering; quay + piers on a big port; vine terraces on vintner hills.

Perf: a city-size town (~1,500 buildings) repaints fully on every pointermove during drag. If it janks, coalesce with an rAF flag in `repaint()` (one-line fix, deliberately left out until proven needed). Also check label drawing at high zoom (it's viewport-culled already).

PNG export: verify the downloaded file is 2000×1400, labels absent, compass/scale/cartouche present, scale bar reads "≈ 200 yards".

Mobile: `touch-action:none` honored; `logicalPos` math (CSS-scaled canvas → 1000×700 logical) correct on small screens; scrubber usable with a thumb.

Reduced motion: OS setting → replay/generate should jump straight to the final frame (the `REDUCED` path).

## Post-handoff changes (local QA pass, 2026-06)

Engine (`frags/mapmodel.js`):
- **Suburbs** — `wallBlocks` takes a pressure arg (current era pop ÷ pop when the wall rose); gate corridors lengthen (≤3.5×64px) and acceptance rises (≤0.85) as a town outgrows its circuit. Capitals/cities now render dense (165→~600+ buildings for a 26k capital). Lanes sprout per-era scaled by placement deficit, may branch off other lanes from era 2, and stretch up to 1.8× for big towns (`roadCap` 5+min(26,pop/550)).
- **Lanes respect buildings** — each candidate lane subdivides FIRST, then the final polyline is walked at 3px steps; rejected if any point comes within 5.8px of a hashed center (4.7px inside the 14px junction mouth). Seven bearing candidates (±1.15 rad) before giving up.
- **Buildings respect roads** — placement draws bw/bh before the row offset (`ROADHALF[kind]+bh/2+2.0+(row-1)*11`), then `roadBlocked(pos,bh/2+0.6)` checks EVERY road edge, kind-aware. Miners' row checks too. Market stalls retry until off the carriageway.
- **True footprint test** — `overlapsBuilding` does OBB-SAT (1.1px inset) against a 26px-cell building hash; the old center-distance hash stays as the cheap prefilter.
- **`placeCivic`** — church/temple/keep/guildhall/mint/highcourt retry wider then raze colliding houses (never landmarks/walls/water/reserved/roads). Mint went 6/20→20/20 capitals.
- **Lumber forest floor** — effective forestCover ≥0.5 for lumber towns (mirrors the mining-hills guarantee); trees+stumps always present.

UI (`frags/ui-paint.js`, `uisplice.py`):
- **Two-pass roads** — all casings, then all fills, so junctions merge instead of overlapping.
- **Label collision avoidance** — greedy: draw order (landmarks → crossing → taverns → notables → householders) is priority; a label that would overlap an earlier one is skipped. Building name baselines raised to −7/k.
- **Building dossier panel** (`#bpanel`) — click/tap any map item to open a parchment side panel: title, kind/keeper line, raised year, plus two deterministic lore lines (seeded `loreRng(seed|idx|kind)`, kind-specific pools in `LORE`). Replaces the old 2.8s sticky tap-tooltip; hover tooltips unchanged. Closes on empty-ground click, ×, Esc, R, or regenerate.
- **Tooltip edge flip** — `showTip` flips below the cursor at the stage top and clamps horizontally.
- Header badge reads v2.0 (was stale v1.0).

Harness additions: DENS (≥1 building/90 souls above 6k pop), ROAD (no building center within `ROADHALF[kind]+h/2−1.5` of any road centerline), BLDG (grid-bucketed OBB overlap), capital⇒mint, fortress⇒keep, lumber⇒trees+stumps. Smoke: 47th check (dossier panel present/hidden/close wired). Perf measured in Chrome: 0.4–2.2ms full repaints on a 950-building city — the rAF coalesce remains unnecessary.

**v2.1 (roads with purpose):**
- **Lane-tail trim** — `trimLanes` pass after farms commit: each lane is walked from its junction outward and cut ~10px past the last structure it serves (buildings r16 / landmarks r18 / farm houses r20 / child-lane junctions r8); lanes serving nothing are dropped. Highways/mineroads exempt (they lead off-map by design).
- **Tracks** (`roads[].kind:"track"`) — `addTracks` pass: farms and outlying landmarks (windmill/press/cellars/sawmill/graveyard/fairground/lighthouse/abbey/caravanserai) 14–95px from the road net get a thin field-path to the nearest highway/mineroad/lane. Same-bank rule, `badCross`, 5px building clearance walked on the final polyline, last 11px (the dooryard) exempt. Painter draws tracks as dashed `rgba(122,99,63,.5)` 1.5px beneath the road net; buildings paint over the dooryard end.
- **Paved core** (`model.pavedSegs`) — when walled AND (gov charter/council/crown OR `eco.wealth≥1.35`): highway runs inside the wall poly + plaza-side lanes are extracted as segments, overlaid in stone `#c3b694` with a dashed setts seam at k≥3. Dirt remains the default everywhere else.
- Harness: TRACK invariant (every track ends ≤24px from a farm house/landmark/adit), `ROADHALF.track=0.8` in ROAD. Smoke: 49 checks (tracks on vintner, pavedSegs on capital).

**v2.2 (districts & town order):**
- **`cfg.plan`** `"auto"|"grown"|"half"|"surveyed"` (whitelisted in normalizeCfg; Simple-pane "Town plan" select `#c-plan`). Maps to `orderV` 0.18/0.5/0.85; `"auto"` is emergent: gov base (crown .58 → lord .30) + archetype (capital/fortress +.14, port/scholar +.06) + youth (<220yrs +.12, >520yrs −.07) + jitter, clamped .05–.92. Exported as `map.order`.
- **Planned grid** (orderV ≥ 0.55): 3–4 streets parallel to the main highway bearing + 2–3 cross streets, laid through the plaza BEFORE the first house, walked in 6px steps and stopped at water (the crossing stays canonical). They're `kind:"lane"` so the paved-core pass cobbles them. Row/rotation jitter halves in surveyed towns (multiplied post-draw — RNG count unchanged).
- **Districts** (`map.districts`, pop ≥ 5000): market ward at the plaza, wealth ward (Rmax·0.34), craft ward downstream (+x when river), 1–2 poor wards on the far side (Rmax·0.78), plus archetype wards (harbor/miners/scholars/abbeyside). Ward centers walk 15% toward C until off water. Nearest-seed assignment in the building loop: wealth ×1.18 size, poor ×0.84, craft ward 50% workshops (plaza 30%, elsewhere 6%). Buildings carry `.d` (district index).
- Painter: roofs blend 32% toward the ward tone (`mixTone`); ward names render as letterspaced caps from k≥1.7 (before all other labels, same dedup) until k 5.2. Tooltip/panel sub-line appends the ward name (`dnm` on hit items).
- Engine guard: `laneTooClose` — size-aware lane clearance from the building hash (deep wealth-ward houses need more room than the fixed radius gave). Harness: DIST (pop≥6000 ⇒ ≥4 wards, `.d` indexes valid), ORDER (0..1), DENS relaxed to 1/105 (collapse tripwire), +8 plan-matrix towns (396 total). Smoke: 53 checks.

## Known limitations & deliberate choices

Numbers are gamer-grade plausible (calibrated loosely to Paris 1292 / S.J. Ross), not scholarship. The map is a stylized plat, not a street-accurate survey. One crossing per river is a feature (traffic funnels through the ford/bridge), not a bug. Persistence is seed + JSON export only. Epithets append ", N souls" when pop>3500 — deliberate. `hitTest` priority ties resolve to the later item (landmarks win over buildings). Roads are densified to ≤14px segments near rivers — never index road points by fractional position assumptions.

## File inventory

`townwright.html` (generated build — the product) · `townwright.v1.bak.html` (v1 base, splice source) · `frags/` — arch, founding, sim, eco, people, namesprose, mapmodel, generate (engine) + ui-paint (painter/interactions) · `splice.py` + `uisplice.py` + `build.sh` (pipeline) · `harness2.js` + `smoke.js` (tests) · `engine2.js` / `ui2.js` (extracted artifacts) · `engine.v1.js` / `ui.v1.js` (frozen v1 reference) · `package.json` (jsdom).
