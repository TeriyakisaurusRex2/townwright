const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync("townwright.html", "utf8");

/* universal absorber for canvas 2D context calls */
const ANY = new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : ANY),
  apply: () => ANY,
  set: () => true,
});

const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.matchMedia = () => ({ matches: true, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }); // REDUCED=true -> synchronous paint
    window.HTMLCanvasElement.prototype.getContext = () => ANY;
    window.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null); };
    window.URL.createObjectURL = () => "blob:fake";
    window.URL.revokeObjectURL = () => {};
    window.addEventListener("error", (e) => errors.push("window error: " + e.message));
  },
});

const { document } = dom.window;
const $ = (id) => document.getElementById(id);
const fail = (m) => { console.error("FAIL:", m); process.exitCode = 1; };
const ok = (m) => console.log("ok  ", m);

/* ---------- init generation ---------- */
if (errors.length) fail("script errors during load: " + errors.join(" | "));
else ok("page loaded with no script errors");

if (!dom.window.Townwright || typeof dom.window.Townwright.generate !== "function") fail("Townwright global missing");
else ok("Townwright global exposed");

if ($("docsheet").hidden) fail("docsheet still hidden after init generate");
else ok("docsheet revealed");

const name = $("t-name").textContent;
if (!name || name === "—") fail("t-name not populated");
else ok("town name rendered: " + name + " " + $("t-epithet").textContent);

if (!/^seed · .+/.test($("t-seal").textContent)) fail("seal/seed chip not populated: " + $("t-seal").textContent);
else ok("seal chip: " + $("t-seal").textContent);

for (const pane of ["overview", "people", "economy", "buildings", "history"]) {
  const el = $("doc-" + pane);
  if (!el.innerHTML || el.innerHTML.length < 200) fail("pane doc-" + pane + " looks empty (" + el.innerHTML.length + " chars)");
  else ok("pane doc-" + pane + " rendered (" + el.innerHTML.length + " chars)");
}

if (!document.querySelector("#doc-history #popspark polyline")) fail("population sparkline missing");
else ok("sparkline present");

if (!document.querySelector("#doc-people .card .nm")) fail("notable cards missing");
else ok("notable cards present");

if (!document.querySelector("#doc-buildings table.ledger td")) fail("occupation ledgers missing");
else ok("occupation ledgers present");

if (!/AD \d+ · [\d,]+ souls/.test($("mapyear").textContent)) fail("mapyear label wrong: " + $("mapyear").textContent);
else ok("mapyear label: " + $("mapyear").textContent);

const seedAfterInit = $("seed").value;
if (!seedAfterInit) fail("seed field empty after init");
else ok("seed field filled: " + seedAfterInit);

/* resource rows built? */
const rows = document.querySelectorAll("#reslist .resrow");
if (rows.length < 10) fail("resource rows not built: " + rows.length);
else ok(rows.length + " resource rows built");
const indInputs = document.querySelectorAll("#indmults input");
if (!indInputs.length) fail("industry multiplier inputs not built");
else ok(indInputs.length + " industry multiplier inputs built");

/* ---------- interactions ---------- */
function click(id) { $(id).dispatchEvent(new dom.window.Event("click", { bubbles: true })); }

/* mode tab switch */
document.querySelector('.modes button[data-mode="adv"]').dispatchEvent(new dom.window.Event("click", { bubbles: true }));
if (!$("pane-adv").classList.contains("on") || $("pane-simple").classList.contains("on")) fail("mode tab switch broken");
else ok("mode tab switch works");

/* doc tab switch */
document.querySelector('.dtab[data-doc="economy"]').dispatchEvent(new dom.window.Event("click", { bubbles: true }));
if (!$("doc-economy").classList.contains("on") || $("doc-overview").classList.contains("on")) fail("doc tab switch broken");
else ok("doc tab switch works");

/* range label */
$("c-trade").value = "2";
$("c-trade").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
if ($("v-trade").textContent !== "2") fail("trade range label not updating");
else ok("range label updates");
$("c-trade").value = "-1";
$("c-trade").dispatchEvent(new dom.window.Event("input", { bubbles: true }));
if ($("v-trade").textContent !== "auto") fail("trade auto label broken");
else ok("trade label shows auto at -1");

/* determinism: same seed + same controls => same name */
const n1 = $("t-name").textContent;
click("genBtn"); // seed field already holds the seed used
const n2 = $("t-name").textContent;
if (n1 !== n2) fail("same-seed regenerate changed town: " + n1 + " vs " + n2);
else ok("same-seed regenerate is deterministic");

/* dice changes seed and town */
click("diceBtn");
const n3 = $("t-name").textContent, s3 = $("seed").value;
if (s3 === seedAfterInit) fail("dice did not change seed");
else ok("dice rolled new seed: " + s3);
ok("new town after dice: " + n3);

/* terrain override flows through */
$("c-terrain").value = "coastal";
click("genBtn");
const ov = $("doc-overview").innerHTML;
if (!/Coastal/.test(ov)) fail("terrain override not reflected in overview");
else ok("terrain override reflected (Coastal)");

/* expert population override */
document.querySelector('.modes button[data-mode="expert"]').dispatchEvent(new dom.window.Event("click", { bubbles: true }));
$("c-pop").value = "4200";
click("genBtn");
const popText = $("doc-overview").querySelector(".stat .v").textContent.replace(/,/g, "");
const popN = parseInt(popText, 10);
if (!(popN >= 4200 * 0.85 && popN <= 4200 * 1.15)) fail("population override off: " + popN);
else ok("population override honored: " + popN);
$("c-pop").value = "";

/* name override + safe filename path */
$("c-name").value = "Test<>Town & \"Quotes\"";
click("genBtn");
if ($("t-name").textContent !== 'Test<>Town & "Quotes"') fail("name override mangled: " + $("t-name").textContent);
else ok("name override preserved via textContent (XSS-safe)");
if ($("doc-overview").innerHTML.includes("<>Town")) fail("unescaped name leaked into innerHTML pane");
else ok("name escaped inside panes");
$("c-name").value = "";

/* exports don't throw */
click("pngBtn");
click("jsonBtn");
ok("png/json export handlers ran without throwing");

/* keyboard R reroll (target = body) */
const before = $("seed").value;
document.body.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "r", bubbles: true }));
if ($("seed").value === before) fail("R key did not reroll");
else ok("R key rerolls");

/* R key ignored while typing in input */
const beforeTyping = $("seed").value;
$("seed").dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "r", bubbles: true }));
if ($("seed").value !== beforeTyping) fail("R key fired inside input field");
else ok("R key ignored while typing");

/* ================= v2: archetypes, quality, map controls ================= */
const TWg = dom.window.Townwright;
if (TWg.VERSION !== "2.0.0") fail("engine VERSION is " + TWg.VERSION + ", expected 2.0.0");
else ok("engine VERSION 2.0.0");
if (!TWg.ARCHETYPES || TWg.ARCHETYPES.length !== 10) fail("ARCHETYPES export wrong: " + JSON.stringify(TWg.ARCHETYPES));
else ok("10 archetypes exported");
if (TWg.nameAt("x", 3) !== TWg.nameAt("x", 3) || TWg.nameAt("x", 3) === TWg.nameAt("x", 4)) fail("nameAt not deterministic/distinct");
else ok("nameAt deterministic: " + TWg.nameAt("x", 3));

/* archetype select present and wired */
const archSel = $("c-archetype");
if (!archSel) fail("c-archetype select missing");
else if (archSel.options.length !== 11) fail("c-archetype has " + archSel.options.length + " options, expected 11");
else ok("archetype select present (11 options)");
archSel.value = "religious";
click("genBtn");
const tNow = dom.window.eval("typeof current!=='undefined'?null:null"); /* current is IIFE-scoped; assert via docs */
if (!$("doc-overview").innerHTML.includes("Abbey town")) fail("explicit religious archetype not reflected in Overview");
else ok("explicit archetype generates + shows in Overview (Abbey town)");
if (!$("doc-economy").innerHTML.includes("Craft repute")) fail("Craft repute section missing from Economy");
else ok("Craft repute section rendered in Economy");
archSel.value = "auto";

/* map controls exist and don't throw */
for (const id of ["zoomIn", "zoomOut", "zoomReset", "replayBtn", "eraScrub", "maptip", "mapstage"]) {
  if (!$(id)) fail("missing v2 map control #" + id);
}
ok("v2 map controls present");

/* v2.1: tracks reach outlying steads; chartered/wealthy walled towns pave the core */
{
  const tv = dom.window.Townwright.generate({ seed: "smoke-vintner", archetype: "vintner", size: "town" });
  if (tv.map.farms.length && !tv.map.roads.some(r => r.kind === "track")) fail("vintner town with farms but no tracks");
  else ok("farm tracks generated (kind: track)");
  const tc = dom.window.Townwright.generate({ seed: "smoke-capital", archetype: "capital", size: "auto" });
  if (!Array.isArray(tc.map.pavedSegs)) fail("pavedSegs missing from map model");
  else if (!tc.map.pavedSegs.length) fail("crown capital should pave its core");
  else ok("paved core present on capital (" + tc.map.pavedSegs.length + " segs)");
}

/* v2.2: town plan select, districts, order */
{
  const planSel = $("c-plan");
  if (!planSel) fail("c-plan select missing");
  else if (planSel.options.length !== 4) fail("c-plan has " + planSel.options.length + " options, expected 4");
  else ok("town plan select present (4 options)");
  planSel.value = "surveyed";
  click("genBtn");
  ok("surveyed plan generates without throwing");
  planSel.value = "auto";
  const td = dom.window.Townwright.generate({ seed: "smoke-districts", archetype: "market", size: "city" });
  if (!(td.map.districts && td.map.districts.length >= 4)) fail("city lacks districts (" + (td.map.districts || []).length + ")");
  else ok("districts present on city (" + td.map.districts.map(d => d.key).join(",") + ")");
  if (typeof td.map.order !== "number") fail("map.order missing from output");
  else ok("map.order exported (" + td.map.order + ")");
}

/* building dossier panel: present, hidden by default, close button wired */
for (const id of ["bpanel", "bpclose", "bptitle", "bpsub", "bpbody"]) {
  if (!$(id)) fail("missing building panel element #" + id);
}
if (!$("bpanel").hidden) fail("building panel should start hidden");
click("bpclose"); /* no-throw while already hidden */
ok("building dossier panel present and hidden");
click("zoomIn"); click("zoomIn"); click("zoomOut"); click("zoomReset");
ok("zoom buttons ran without throwing");

/* era scrubber drives the year label to an intermediate value */
const scrub = $("eraScrub");
scrub.value = "400";
scrub.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
const yearTxt = $("mapyear").textContent;
if (!/^AD \d+$/.test(yearTxt)) fail("scrubbed year label unexpected: " + yearTxt);
else ok("era scrubber updates year label: " + yearTxt);
scrub.value = "1000";
scrub.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
if (!$("mapyear").textContent.includes("souls")) fail("scrub back to present did not restore label");
else ok("scrub to present restores full label");
click("replayBtn");
ok("replay ran without throwing");

/* explicit mining smoke: full generate via select */
archSel.value = "mining";
click("genBtn");
if (!$("doc-overview").innerHTML.includes("Mining town")) fail("mining archetype not reflected");
else ok("mining archetype generates + shows in Overview");
archSel.value = "auto";
click("genBtn");

if (errors.length) fail("late script errors: " + errors.join(" | "));

console.log(process.exitCode ? "\nSMOKE TEST FAILED" : "\nALL SMOKE TESTS PASSED");
