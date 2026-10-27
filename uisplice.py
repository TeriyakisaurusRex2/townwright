"""uisplice.py — splice the v2 UI into townwright.html.

Run AFTER splice.py (engine). Pipeline:
  cp townwright.v1.bak.html townwright.html
  python3 splice.py        # engine v2
  python3 uisplice.py      # UI v2  (this file)
"""
import io

P = "townwright.html"
src = io.open(P, encoding="utf-8").read()

def rep(old, new, label):
    global src
    assert old in src, "MISSING [%s]: %r" % (label, old[:80])
    assert src.count(old) == 1, "NOT UNIQUE [%s]: %r" % (label, old[:80])
    src = src.replace(old, new)
    print("ok:", label)

# ---------- 1) CSS ----------
CSS = """
/* ---- v2: map interactivity ---- */
.mapstage{position:relative}
#mapcanvas{touch-action:none;cursor:grab}
#mapcanvas.dragging{cursor:grabbing}
.mapzoom{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:6px}
.zbtn{width:30px;height:30px;border:1px solid #8a7146;background:rgba(240,228,196,.92);color:#2e2418;font-size:1rem;line-height:1;border-radius:3px;cursor:pointer;box-shadow:0 1px 2px rgba(40,30,15,.25)}
.zbtn:hover{background:#f4e9cd}
.zbtn:active{transform:translateY(1px)}
#maptip{position:absolute;z-index:5;pointer-events:none;background:rgba(247,238,214,.97);border:1px solid #6b5436;border-radius:3px;padding:6px 9px;font-size:.78rem;color:#2e2418;max-width:240px;box-shadow:0 2px 8px rgba(40,30,15,.3);transform:translate(-50%,-115%)}
#maptip b{display:block;font-size:.84rem;letter-spacing:.02em}
#maptip span{color:rgba(46,36,24,.75);font-style:italic}
.mapscrub{display:flex;align-items:center;gap:10px;margin-top:8px}
.mapscrub .btn{background:transparent;border-color:#b59f74;color:var(--ink);font-size:.78rem;white-space:nowrap}
.mapscrub .btn:hover{background:rgba(74,56,32,.08);border-color:#8a7146}
.mapscrub input[type=range]{flex:1}
.maphint{font-size:.7rem;color:rgba(46,36,24,.55);margin-top:5px;font-style:italic}
#bpanel{position:absolute;top:10px;right:48px;width:232px;max-height:calc(100% - 20px);overflow-y:auto;background:rgba(247,238,214,.97);border:1px solid #6b5436;border-radius:3px;padding:12px 14px;box-shadow:0 3px 12px rgba(40,30,15,.35);z-index:6}
#bpanel h3{margin:0 20px 2px 0;font-size:.95rem;color:#2e2418;font-family:Palatino,'Iowan Old Style',serif}
#bpanel .bpsub{margin:0 0 4px;font-size:.72rem;font-style:italic;color:rgba(46,36,24,.7)}
#bpanel .bplore{font-size:.78rem;color:#2e2418;line-height:1.45;margin:7px 0 0}
#bpclose{position:absolute;top:5px;right:7px;border:0;background:none;font-size:1.05rem;color:#6b5436;cursor:pointer;line-height:1;padding:2px}
#bpclose:hover{color:#2e2418}
.chip.q-poor{border-color:#9c2f23;color:#9c2f23}
.chip.q-good{border-color:#4e6b5b;color:#3f5a4b}
.chip.q-fine{border-color:#8a6d1f;color:#7a5f15}
.chip.q-renowned{border-color:#8a6d1f;background:rgba(176,141,46,.16);color:#6b4f0d}
"""
rep("</style>", CSS + "</style>", "css")

# ---------- 1b) header version badge ----------
rep('<span class="ver">v1.0 · seed-deterministic</span>',
    '<span class="ver">v2.0 · seed-deterministic</span>',
    "version badge")

# ---------- 2) archetype select (Simple pane) ----------
ARCH_SEL = """        <label class="fld"><span>Town archetype</span>
          <select id="c-archetype">
            <option value="auto" selected>Surveyor's choice (random)</option>
            <option value="market">Market town</option>
            <option value="mining">Mining town</option>
            <option value="port">Port town</option>
            <option value="religious">Abbey town</option>
            <option value="capital">Capital</option>
            <option value="tradepost">Trading post</option>
            <option value="fortress">Fortress town</option>
            <option value="scholar">College town</option>
            <option value="vintner">Wine town</option>
            <option value="lumber">Timber town</option>
          </select>
        </label>
        <label class="fld"><span>Town plan</span>
          <select id="c-plan">
            <option value="auto" selected>Let history decide</option>
            <option value="grown">Grown &mdash; organic lanes</option>
            <option value="half">Half-planned</option>
            <option value="surveyed">Surveyed &mdash; gridded core</option>
          </select>
        </label>
        <label class="fld"><span>Settlement size</span>"""
rep('        <label class="fld"><span>Settlement size</span>', ARCH_SEL, "archetype select")

# ---------- 3) map stage: zoom buttons, tooltip, scrubber ----------
MAPSTAGE = """        <div class="mapstage" id="mapstage">
          <canvas id="mapcanvas" width="1000" height="700" aria-label="Town map"></canvas>
          <div class="mapzoom">
            <button class="zbtn" id="zoomIn" aria-label="Zoom in" title="Zoom in">+</button>
            <button class="zbtn" id="zoomOut" aria-label="Zoom out" title="Zoom out">&minus;</button>
            <button class="zbtn" id="zoomReset" aria-label="Reset view" title="Reset view">&#8982;</button>
          </div>
          <div id="maptip" hidden></div>
          <aside id="bpanel" hidden>
            <button id="bpclose" aria-label="Close panel">&times;</button>
            <h3 id="bptitle"></h3>
            <p id="bpsub" class="bpsub"></p>
            <div id="bpbody"></div>
          </aside>
        </div>
        <div class="mapscrub">
          <button class="btn" id="replayBtn" title="Replay the survey from founding">&#9654; Replay</button>
          <input type="range" id="eraScrub" min="0" max="1000" value="1000" aria-label="Scrub through the town's history">
        </div>
        <p class="maphint">Drag to pan &middot; scroll or pinch to zoom &middot; hover or tap things for their names &middot; drag the slider to walk the years</p>"""
rep('        <canvas id="mapcanvas" width="1000" height="700" aria-label="Town map"></canvas>', MAPSTAGE, "map stage")

# ---------- 4) painter section -> frags/ui-paint.js ----------
paint_new = io.open("frags/ui-paint.js", encoding="utf-8").read().rstrip() + "\n\n"
a = "/* ================= painter ================= */"
b = "/* ================= document renderers ================= */"
i = src.index(a); j = src.index(b, i)
src = src[:i] + paint_new + src[j:]
print("ok: painter section")

# ---------- 5) readCfg: send archetype ----------
rep('    seed:$("seed").value.trim()||randomSeed(),',
    '    seed:$("seed").value.trim()||randomSeed(),\n    archetype:$("c-archetype").value,\n    plan:$("c-plan").value,',
    "readCfg archetype")

# ---------- 6) GOV_LABEL: crown ----------
rep('var GOV_LABEL={lord:"Feudal lord",charter:"Chartered town",council:"Merchant council",temple:"Temple seat"};',
    'var GOV_LABEL={lord:"Feudal lord",charter:"Chartered town",council:"Merchant council",temple:"Temple seat",crown:"Seat of the Crown"};',
    "GOV_LABEL crown")

# ---------- 7) Overview: archetype stat ----------
rep("""    {k:"Origin",v:'<small style="font-size:.86rem;font-style:normal">'+esc(capf(t.founding.label))+"</small>"},""",
    """    {k:"Origin",v:'<small style="font-size:.86rem;font-style:normal">'+esc(capf(t.founding.label))+"</small>"},
    {k:"Archetype",v:'<small style="font-size:.86rem;font-style:normal">'+esc(t.archetype.label)+'</small>'},""",
    "overview archetype")

# ---------- 8) Economy: craft repute chips + per-industry badges ----------
rep("""  var ledger='<h2>Industries by workforce</h2>""",
    """  var qual='';
  if(t.quality&&t.quality.length){
    qual='<h2>Craft repute</h2><div class="chips">'+t.quality.map(function(q){return '<span class="chip q-'+q.label+'">'+esc(capf(q.craft))+' &middot; <b>'+q.label+'</b></span>';}).join('')+'</div><div style="height:10px"></div>';
  }
  var ledger='<h2>Industries by workforce</h2>""",
    "economy quality block")

rep("""    return '<tr><td>'+esc(i.name)+(i.note?'<span class="sub">'+esc(i.note)+'</span>':'')+'</td><td class="num">'+fmt(i.workers)+""",
    """    return '<tr><td>'+esc(i.name)+(i.quality&&i.quality!=="plain"?' <span class="chip q-'+i.quality+'" style="padding:1px 6px;font-size:.66rem;vertical-align:1px">'+esc(i.quality)+'</span>':'')+(i.note?'<span class="sub">'+esc(i.note)+'</span>':'')+'</td><td class="num">'+fmt(i.workers)+""",
    "industry quality badge")

rep('  $("doc-economy").innerHTML=head+ledger+tradeLine+chips;',
    '  $("doc-economy").innerHTML=head+qual+ledger+tradeLine+chips;',
    "economy assembly")

# ---------- 9) doGenerate: reset view, rebuild hit index ----------
rep("""  current=t;
  $("seed").value=t.seed;""",
    """  current=t;
  VIEW.k=1;VIEW.tx=0;VIEW.ty=0;SCRUB=1;
  buildHitIndex(t);
  $("seed").value=t.seed;""",
    "doGenerate view/hit reset")

# ---------- 10) PNG export: offscreen 2x with identity view ----------
rep("""$("pngBtn").addEventListener("click",function(){
  if(!current)return;
  animToken++;            /* cancel any running build animation */
  paint(current,1);       /* ensure the final frame is on the canvas */
  $("mapyear").textContent="AD "+current.presentYear+" \u00b7 "+fmt(current.sim.pop)+" souls";
  $("mapcanvas").toBlob(function(b){ if(b)download(b,safeName()+".png"); },"image/png");
});""",
    """$("pngBtn").addEventListener("click",function(){
  if(!current)return;
  animToken++;SCRUB=1;
  paint(current,1);       /* ensure the final frame is on the visible canvas */
  $("mapyear").textContent="AD "+current.presentYear+" \u00b7 "+fmt(current.sim.pop)+" souls";
  var oc=document.createElement("canvas");oc.width=2000;oc.height=1400;
  var octx=oc.getContext("2d");
  paint(current,1,{ctx:octx,dpr:2,view:{k:1,tx:0,ty:0}});
  if(oc.toBlob)oc.toBlob(function(b){ if(b)download(b,safeName()+".png"); },"image/png");
  else $("mapcanvas").toBlob(function(b){ if(b)download(b,safeName()+".png"); },"image/png");
});""",
    "png export")

io.open(P, "w", encoding="utf-8").write(src)
print("uisplice complete: %d bytes" % len(src))
