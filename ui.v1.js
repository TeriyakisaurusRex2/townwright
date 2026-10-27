
(function(){
"use strict";
var TW=globalThis.Townwright;
function $(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function fmt(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,",");}
var REDUCED=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var current=null,animToken=0;

/* ---------------- seeds ---------------- */
var SW1=["amber","iron","willow","raven","ember","mist","cinder","heron","tarn","bramble","fen","gorse","alder","drift","sable","wren"];
var SW2=["otter","anvil","lantern","barrow","quay","spindle","hart","kestrel","mill","cairn","tide","furrow","gable","sickle","bellows","weir"];
function randomSeed(){return SW1[Math.floor(Math.random()*SW1.length)]+"-"+SW2[Math.floor(Math.random()*SW2.length)]+"-"+Math.floor(Math.random()*900+100);}

/* ---------------- resource rows ---------------- */
var resState={};
function buildResRows(){
  var host=$("reslist");host.innerHTML="";
  TW.RES_DEFS.forEach(function(rd){
    resState[rd.k]={auto:true,on:true,rich:0.5};
    var row=document.createElement("div");row.className="resrow";row.dataset.k=rd.k;
    row.innerHTML='<input type="checkbox" checked aria-label="enable '+esc(rd.label)+'">'+
      '<span class="rname">'+esc(rd.label)+'</span>'+
      '<input type="range" min="0" max="100" value="50" aria-label="'+esc(rd.label)+' richness">'+
      '<span class="rich">auto</span>';
    var cb=row.children[0],sl=row.children[2],lab=row.children[3];
    function manual(){var st=resState[rd.k];st.auto=false;st.on=cb.checked;st.rich=sl.value/100;
      lab.textContent=cb.checked?Math.round(sl.value)+"%":"off";lab.style.color="var(--wax)";}
    cb.addEventListener("change",manual);
    sl.addEventListener("input",function(){if(!cb.checked)cb.checked=true;manual();});
    host.appendChild(row);
  });
}
function reflectResources(res){ /* show what the survey rolled, in auto rows */
  var rows=$("reslist").children;
  for(var i=0;i<rows.length;i++){
    var k=rows[i].dataset.k,st=resState[k];
    if(st.auto){
      var v=Math.round((res[k]||0)*100);
      rows[i].children[2].value=v;
      rows[i].children[3].textContent="auto·"+v;
      rows[i].children[3].style.color="";
      rows[i].children[0].checked=v>0;
    }
  }
}
function resetResAuto(){
  var rows=$("reslist").children;
  for(var i=0;i<rows.length;i++){var k=rows[i].dataset.k;resState[k]={auto:true,on:true,rich:0.5};
    rows[i].children[3].textContent="auto";rows[i].children[3].style.color="";rows[i].children[0].checked=true;}
}

/* ---------------- industry multipliers ---------------- */
var INDM=[["mining","Mining & ores"],["wool","Wool & cloth"],["smith","Smithing"],["sea","Sea trades"],["trade","Trade routes"]];
function buildIndMults(){
  var host=$("indmults");host.innerHTML="";
  INDM.forEach(function(m){
    var l=document.createElement("label");l.className="fld fld-inline";
    l.innerHTML='<span class="fldspan" style="margin:0;flex:1">'+m[1]+'</span><input data-k="'+m[0]+'" type="number" min="0.25" max="3" step="0.05" value="1" style="width:70px">';
    host.appendChild(l);
  });
}

/* ---------------- read config ---------------- */
function readCfg(){
  var resources=null;
  for(var k in resState){if(!resState[k].auto){resources=resources||{};resources[k]={auto:false,on:resState[k].on,rich:resState[k].rich};}}
  var indMult={};
  $("indmults").querySelectorAll("input").forEach(function(inp){var v=parseFloat(inp.value);if(!isNaN(v)&&v!==1)indMult[inp.dataset.k]=v;});
  return {
    seed:$("seed").value.trim()||randomSeed(),
    size:$("c-size").value,terrain:$("c-terrain").value,age:$("c-age").value,
    prosperity:$("c-prosperity").value,magic:$("c-magic").value,
    danger:+$("c-danger").value,trade:+$("c-trade").value,
    government:$("c-gov").value,walls:$("c-walls").value,climate:$("c-climate").value,
    events:$("c-events").checked,resources:resources,
    popOverride:parseInt($("c-pop").value,10)||0,ageYears:parseInt($("c-ageyears").value,10)||0,
    founding:$("c-founding").value,nameOverride:$("c-name").value,mapSeed:$("c-mapseed").value.trim(),
    indMult:indMult
  };
}

/* ================= painter ================= */
var INK="#2e2418",INKSOFT="rgba(46,36,24,.55)";
function roofTone(kind){return {house:"#b58c5f",craft:"#a96e3f",ware:"#8f7a4f",civic:"#c0a36a"}[kind]||"#b58c5f";}
function setupCanvas(){
  var cv=$("mapcanvas"),dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=1000*dpr;cv.height=700*dpr;
  var ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  return ctx;
}
function blotchRng(seed){var h=0;for(var i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))>>>0;return function(){h=(h*1664525+1013904223)>>>0;return h/4294967296;};}
function drawBuildingRect(ctx,b,fill){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot||0);
  ctx.fillStyle=fill||roofTone(b.kind);ctx.strokeStyle=INK;ctx.lineWidth=0.8;
  ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);ctx.strokeRect(-b.w/2,-b.h/2,b.w,b.h);
  ctx.strokeStyle="rgba(46,36,24,.4)";ctx.beginPath();ctx.moveTo(-b.w/2+1,0);ctx.lineTo(b.w/2-1,0);ctx.stroke();
  ctx.restore();
}
function drawLandmark(ctx,o){
  var civic="#c0a36a";
  if(o.kind==="graveyard"){
    ctx.save();ctx.strokeStyle=INKSOFT;ctx.setLineDash([3,3]);ctx.strokeRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h);ctx.setLineDash([]);
    ctx.strokeStyle=INK;ctx.lineWidth=1;
    (o.crosses||[]).forEach(function(c){ctx.beginPath();ctx.moveTo(c.x,c.y-3);ctx.lineTo(c.x,c.y+3);ctx.moveTo(c.x-2,c.y-1);ctx.lineTo(c.x+2,c.y-1);ctx.stroke();});
    ctx.restore();return;
  }
  if(o.kind==="adit"){
    ctx.save();ctx.fillStyle=INK;ctx.beginPath();ctx.arc(o.x,o.y,4,Math.PI,0);ctx.fill();
    ctx.strokeStyle=INK;ctx.beginPath();ctx.moveTo(o.x-6,o.y);ctx.lineTo(o.x+6,o.y);ctx.stroke();ctx.restore();return;
  }
  drawBuildingRect(ctx,o,civic);
  ctx.save();ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.1;
  if(o.kind==="church"||o.kind==="temple"){
    var cy=o.y-o.h/2-5;ctx.beginPath();ctx.moveTo(o.x,cy-4);ctx.lineTo(o.x,cy+4);ctx.moveTo(o.x-3,cy-1);ctx.lineTo(o.x+3,cy-1);ctx.stroke();
    if(o.kind==="temple"){ctx.beginPath();ctx.arc(o.x,o.y,o.w*0.22,0,6.2832);ctx.stroke();}
  }else if(o.kind==="keep"){
    ctx.strokeRect(o.x-o.w/2+3,o.y-o.h/2+3,o.w-6,o.h-6);
    ctx.beginPath();ctx.moveTo(o.x,o.y-o.h/2);ctx.lineTo(o.x,o.y-o.h/2-7);ctx.lineTo(o.x+5,o.y-o.h/2-5);ctx.lineTo(o.x,o.y-o.h/2-3);ctx.stroke();
  }else if(o.kind==="mill"){
    ctx.beginPath();ctx.arc(o.x+o.w/2+4,o.y+3,4.5,0,6.2832);ctx.stroke();
    ctx.beginPath();ctx.moveTo(o.x+o.w/2+4,o.y-1.5);ctx.lineTo(o.x+o.w/2+4,o.y+7.5);ctx.moveTo(o.x+o.w/2-0.5,o.y+3);ctx.lineTo(o.x+o.w/2+8.5,o.y+3);ctx.stroke();
  }else if(o.kind==="tannery"){
    for(var i=0;i<3;i++){ctx.beginPath();ctx.arc(o.x-3+i*3,o.y+o.h/2+3,1.1,0,6.2832);ctx.fill();}
  }else if(o.kind==="smelter"){
    ctx.beginPath();ctx.moveTo(o.x+o.w/2-2,o.y-o.h/2);ctx.lineTo(o.x+o.w/2-2,o.y-o.h/2-6);ctx.stroke();
    ctx.strokeStyle=INKSOFT;ctx.beginPath();ctx.moveTo(o.x+o.w/2-2,o.y-o.h/2-7);ctx.quadraticCurveTo(o.x+o.w/2+2,o.y-o.h/2-10,o.x+o.w/2,o.y-o.h/2-13);ctx.stroke();
  }
  ctx.restore();
}
function paint(t,progress){
  var M=t.map,ctx=setupCanvas(),W=M.W,H=M.H;
  /* parchment + blotches */
  var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"#ead9b4");g.addColorStop(.55,"#e6d4ad");g.addColorStop(1,"#dec998");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  var br=blotchRng(t.seed+"|blotch");
  for(var i=0;i<12;i++){ctx.fillStyle="rgba(120,90,40,"+(0.022+br()*0.02)+")";
    ctx.beginPath();ctx.ellipse(br()*W,br()*H,30+br()*90,20+br()*60,br()*3,0,6.2832);ctx.fill();}
  ctx.strokeStyle="rgba(46,36,24,.35)";ctx.lineWidth=1;ctx.strokeRect(10.5,10.5,W-21,H-21);

  var nE=M.eras.length,visF=progress*(nE-0.0001),visEra=Math.floor(visF);

  /* hills */
  M.hills.forEach(function(h){
    ctx.strokeStyle="rgba(138,112,77,.75)";ctx.lineWidth=1;
    h.rings.forEach(function(r,ri){
      ctx.beginPath();
      for(var a=0;a<=20;a++){var th=a/20*6.2832;var wob=1+0.12*Math.sin(th*3+ri*1.7+h.x);
        var px=h.x+Math.cos(th)*r*wob,py=h.y+Math.sin(th)*r*0.72*wob;
        if(a===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
      ctx.closePath();ctx.stroke();
    });
  });
  /* trees */
  M.trees.forEach(function(tr){
    ctx.fillStyle="rgba(111,127,87,.85)";ctx.strokeStyle="rgba(60,72,46,.45)";ctx.lineWidth=0.7;
    ctx.beginPath();ctx.arc(tr.x,tr.y,tr.r,0,6.2832);ctx.fill();ctx.stroke();
  });
  /* farms */
  M.farms.forEach(function(f){
    if(f.era>visEra)return;
    f.strips.forEach(function(s,si){
      ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);
      ctx.fillStyle=si%2?"#cdbb82":"#d6c794";ctx.strokeStyle="rgba(46,36,24,.22)";ctx.lineWidth=0.7;
      ctx.fillRect(-s.w/2,-s.h/2,s.w,s.h);ctx.strokeRect(-s.w/2,-s.h/2,s.w,s.h);
      ctx.beginPath();for(var li=1;li<4;li++){ctx.moveTo(-s.w/2,-s.h/2+s.h*li/4);ctx.lineTo(s.w/2,-s.h/2+s.h*li/4);}ctx.stroke();
      ctx.restore();
    });
    drawBuildingRect(ctx,f.house);
  });
  /* sea */
  if(M.shore){
    ctx.fillStyle="#cfd9cc";
    ctx.beginPath();ctx.moveTo(M.shore[0].x,M.shore[0].y);
    M.shore.forEach(function(p){ctx.lineTo(p.x,p.y);});
    ctx.lineTo(W,H);ctx.lineTo(W,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle=INK;ctx.lineWidth=1.6;
    ctx.beginPath();M.shore.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
    for(var hh=1;hh<=3;hh++){
      ctx.strokeStyle="rgba(46,36,24,"+(0.28-hh*0.07)+")";ctx.lineWidth=0.8;
      ctx.beginPath();M.shore.forEach(function(p,pi){var x=p.x+hh*7;pi?ctx.lineTo(x,p.y):ctx.moveTo(x,p.y);});ctx.stroke();
    }
  }
  /* river */
  if(M.river){
    ctx.lineJoin="round";ctx.lineCap="round";
    ctx.strokeStyle=INK;ctx.lineWidth=M.river.w+2.2;
    ctx.beginPath();M.river.pts.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
    ctx.strokeStyle="#cfd9cc";ctx.lineWidth=M.river.w;
    ctx.beginPath();M.river.pts.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
  }
  /* roads */
  M.roads.forEach(function(r){
    var hw=r.kind==="lane"?[2.6,1.5]:r.kind==="mineroad"?[4.2,2.6]:[5,3.2];
    ctx.lineJoin="round";ctx.lineCap="round";
    ctx.strokeStyle="#6b5436";ctx.lineWidth=hw[0];
    ctx.beginPath();r.pts.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
    ctx.strokeStyle="#d9c79c";ctx.lineWidth=hw[1];
    ctx.beginPath();r.pts.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
  });
  /* graveyard + landmarks below buildings? draw graveyard now */
  M.landmarks.forEach(function(o){if(o.kind==="graveyard"&&o.era<=visEra)drawLandmark(ctx,o);});
  /* piers */
  M.piers.forEach(function(p){
    if(p.era>visEra)return;
    ctx.strokeStyle="#5a4630";ctx.lineWidth=3;ctx.lineCap="butt";
    ctx.beginPath();ctx.moveTo(p.x1,p.y1);ctx.lineTo(p.x2,p.y2);ctx.stroke();
    ctx.strokeStyle="rgba(90,70,48,.5)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(p.x1,p.y1-1.8);ctx.lineTo(p.x2,p.y2-1.8);ctx.moveTo(p.x1,p.y1+1.8);ctx.lineTo(p.x2,p.y2+1.8);ctx.stroke();
  });
  /* walls */
  if(M.walls&&visF>=M.walls.era+0.55){
    var wp=M.walls.poly;
    ctx.strokeStyle="#4a3826";ctx.lineWidth=4.6;ctx.lineJoin="round";
    ctx.beginPath();wp.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();
    /* crenel ticks */
    ctx.lineWidth=1.2;ctx.strokeStyle="#4a3826";
    var G={x:0,y:0};wp.forEach(function(p){G.x+=p.x;G.y+=p.y;});G.x/=wp.length;G.y/=wp.length;
    for(var wi=0;wi<wp.length;wi++){
      var a=wp[wi],b=wp[(wi+1)%wp.length],L=Math.hypot(b.x-a.x,b.y-a.y);
      for(var d=6;d<L;d+=12){
        var tt=d/L,px=a.x+(b.x-a.x)*tt,py=a.y+(b.y-a.y)*tt;
        var nx=px-G.x,ny=py-G.y,nl=Math.hypot(nx,ny);nx/=nl;ny/=nl;
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+nx*3.4,py+ny*3.4);ctx.stroke();
      }
    }
    M.walls.towers.forEach(function(tw){
      ctx.fillStyle="#4a3826";ctx.fillRect(tw.x-3.6,tw.y-3.6,7.2,7.2);
      ctx.fillStyle="#d9c79c";ctx.fillRect(tw.x-1.4,tw.y-1.4,2.8,2.8);
    });
    M.walls.gates.forEach(function(gt){
      ctx.fillStyle="#d9c79c";ctx.strokeStyle="#4a3826";ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(gt.x,gt.y,4.4,0,6.2832);ctx.fill();ctx.stroke();
    });
  }
  /* buildings, era-batched with partial reveal */
  var byEra=[];for(var e=0;e<nE;e++)byEra.push([]);
  M.buildings.forEach(function(b){byEra[Math.min(b.era,nE-1)].push(b);});
  for(var e2=0;e2<nE;e2++){
    var arr=byEra[e2],frac=visF-e2;
    if(frac<=0)break;
    var n=frac>=1?arr.length:Math.floor(arr.length*frac);
    for(var bi=0;bi<n;bi++)drawBuildingRect(ctx,arr[bi]);
  }
  /* stalls + non-graveyard landmarks */
  M.stalls.forEach(function(s){
    if(s.era>visEra)return;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);
    ctx.fillStyle=(s.x+s.y)%2<1?"#9c2f23":"#4e6b5b";ctx.globalAlpha=0.85;
    ctx.fillRect(-s.w/2,-s.h/2,s.w,s.h);ctx.restore();
  });
  M.landmarks.forEach(function(o){if(o.kind!=="graveyard"&&o.era<=visEra)drawLandmark(ctx,o);});
  /* bridge */
  if(M.bridge&&(M.bridge.era||0)<=visEra){
    ctx.save();ctx.translate(M.bridge.x,M.bridge.y);ctx.rotate(M.bridge.angle);
    ctx.fillStyle="#6b5436";ctx.fillRect(-3.4,-(M.river.w/2+5),6.8,M.river.w+10);
    ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(-3.4,-(M.river.w/2+5),6.8,M.river.w+10);
    ctx.restore();
  }
  /* compass */
  ctx.save();ctx.translate(52,58);ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.1;
  ctx.beginPath();ctx.arc(0,0,17,0,6.2832);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(4,4);ctx.lineTo(0,1);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();
  ctx.font="700 10px Palatino, 'Iowan Old Style', serif";ctx.textAlign="center";ctx.fillText("N",0,-21);
  ctx.restore();
  /* scale bar: 1px = 2 yards */
  ctx.save();ctx.translate(34,H-30);ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(100,0);ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.moveTo(50,-3);ctx.lineTo(50,3);ctx.moveTo(100,-4);ctx.lineTo(100,4);ctx.stroke();
  ctx.font="italic 10px Palatino, serif";ctx.textAlign="left";ctx.fillText("≈ 200 yards",0,14);
  ctx.restore();
  /* cartouche */
  var nm=t.names.name.toUpperCase();
  ctx.save();ctx.font="600 15px Palatino, 'Iowan Old Style', serif";
  var tw2=ctx.measureText(nm).width;
  var cw=tw2+40,cx=W-cw-24,cy=H-58;
  ctx.fillStyle="rgba(240,228,196,.92)";ctx.strokeStyle=INK;ctx.lineWidth=1.2;
  ctx.fillRect(cx,cy,cw,40);ctx.strokeRect(cx,cy,cw,40);
  ctx.strokeStyle="rgba(46,36,24,.4)";ctx.strokeRect(cx+3.5,cy+3.5,cw-7,33);
  ctx.fillStyle=INK;ctx.textAlign="center";
  ctx.fillText(nm,cx+cw/2,cy+18);
  ctx.font="italic 9px Palatino, serif";ctx.fillStyle="rgba(46,36,24,.7)";
  ctx.fillText("surveyed in the year "+t.presentYear,cx+cw/2,cy+31);
  ctx.restore();
}
function paintAnimated(t){
  var token=++animToken;
  var founded=t.sim.founded,span=Math.max(1,t.presentYear-founded);
  if(REDUCED){paint(t,1);$("mapyear").textContent="AD "+t.presentYear+" · "+fmt(t.sim.pop)+" souls";return;}
  var dur=1200+Math.min(700,t.map.buildings.length*0.6),start=null;
  function frame(ts){
    if(token!==animToken)return;
    if(start===null)start=ts;
    var p=Math.min(1,(ts-start)/dur);
    var ease=1-Math.pow(1-p,2.2);
    paint(t,ease);
    $("mapyear").textContent="AD "+Math.round(founded+span*ease);
    if(p<1)requestAnimationFrame(frame);
    else $("mapyear").textContent="AD "+t.presentYear+" · "+fmt(t.sim.pop)+" souls";
  }
  requestAnimationFrame(frame);
}

/* ================= document renderers ================= */
function capf(s){s=String(s);return s.charAt(0).toUpperCase()+s.slice(1);}
function statGrid(items){
  return '<div class="statgrid">'+items.map(function(s){
    return '<div class="stat"><span class="k">'+esc(s.k)+'</span><div class="v">'+s.v+'</div></div>';
  }).join('')+'</div>';
}
function chipRow(arr,imp){
  if(!arr||!arr.length)return '<p class="hint" style="margin:4px 0">— nothing of note —</p>';
  return '<div class="chips">'+arr.map(function(c){return '<span class="chip'+(imp?' imp':'')+'">'+esc(c)+'</span>';}).join('')+'</div>';
}
var GOV_LABEL={lord:"Feudal lord",charter:"Chartered town",council:"Merchant council",temple:"Temple seat"};

function renderOverview(t){
  var sim=t.sim,eco=t.economy;
  var stats=statGrid([
    {k:"Population",v:fmt(sim.pop)},
    {k:"Founded",v:sim.founded+" <small>· "+fmt(sim.ageYears)+" yrs</small>"},
    {k:"Origin",v:'<small style="font-size:.86rem;font-style:normal">'+esc(capf(t.founding.label))+"</small>"},
    {k:"Government",v:'<small style="font-size:.86rem;font-style:normal">'+esc(GOV_LABEL[sim.government]||capf(sim.government))+"</small>"},
    {k:"Wealth",v:'<small style="font-size:.86rem;font-style:normal">'+esc(eco.wealthLabel)+"</small>"},
    {k:"Walls",v:sim.walls?("Walled <small>· "+sim.walls.year+"</small>"):'<small style="font-size:.86rem;font-style:normal">Unwalled</small>'},
    {k:"Households",v:fmt(t.people.households)},
    {k:"Terrain",v:'<small style="font-size:.86rem;font-style:normal">'+esc(capf(t.region.terrain))+" · "+esc(t.region.climate)+"</small>"}
  ]);
  var prose='<div class="prose"><p>'+t.prose.p1+'</p><p>'+t.prose.p2+'</p><p>'+t.prose.p3+'</p></div>';
  var f=sim.food,total=Math.max(1,f.local+f.imports);
  var localPct=Math.round(100*f.local/total);
  var meter='<h2 style="margin-top:14px">Feeding the town</h2>'+
    '<div class="meter'+(sim.hungerCapped?' warn':'')+'"><i style="width:'+localPct+'%"></i></div>'+
    '<p class="hint" style="margin:2px 0 0">Local fields, pastures & waters feed ~'+fmt(Math.min(f.local,sim.pop))+' souls ('+localPct+'% of supply)'+
    (f.imports>1?'; carted & shipped food covers the rest'+(sim.grainRoute?' — a standing grain route keeps the granaries full':''):'')+'.'+
    (sim.hungerCapped?' <em style="color:var(--wax)">Growth has pressed hard against what the land and roads can feed.</em>':'')+'</p>';
  var trade='<div class="twocol" style="margin-top:14px"><div><h2>Exports</h2>'+chipRow(eco.exports)+'</div><div><h2>Imports</h2>'+chipRow(eco.imports,true)+'</div></div>';
  $("doc-overview").innerHTML=stats+prose+meter+trade;
}

function renderPeople(t){
  var p=t.people,pop=t.sim.pop;
  var stats=statGrid([
    {k:"Children",v:fmt(p.children)},
    {k:"Adults",v:fmt(p.adults)},
    {k:"Elderly",v:fmt(p.elderly)},
    {k:"Households",v:fmt(p.households)}
  ]);
  var rows=p.classes.map(function(c){
    var sh=Math.round(100*c.c/pop);
    return '<tr><td>'+esc(c.n)+'</td><td class="num">'+fmt(c.c)+'</td><td><span class="bar wax"><i style="width:'+Math.min(100,sh)+'%"></i></span> <span style="font-size:.78rem;color:var(--ink-soft)">'+sh+'%</span></td></tr>';
  }).join('');
  var ledger='<h2>Estates of the town</h2><table class="ledger"><thead><tr><th>Class</th><th class="num">Heads</th><th>Share</th></tr></thead><tbody>'+rows+'</tbody></table>';
  var watchLine='<p class="hint" style="margin:8px 0 0">'+
    (p.watch>0?fmt(p.watch)+' sworn watchmen keep the peace; ':'No standing watch — disputes go to the elders; ')+
    'in time of need the town can raise a militia of ~'+fmt(p.militia)+'.</p>';
  var cards='<h2 style="margin-top:16px">Notable folk</h2><div class="cards">'+p.notables.map(function(n){
    return '<div class="card"><div class="nm">'+esc(n.name)+'</div><div class="role">'+esc(n.role)+'</div><div class="tr">'+esc(capf(n.line))+'</div></div>';
  }).join('')+'</div>';
  $("doc-people").innerHTML=stats+ledger+watchLine+cards;
}

function renderEconomy(t){
  var eco=t.economy,sim=t.sim;
  var head='<p class="prose" style="margin:2px 0 12px">A <em>'+esc(eco.wealthLabel.toLowerCase())+'</em> settlement. Of '+fmt(sim.pop)+' souls, roughly '+fmt(eco.workforce)+' work a recognized trade; the rest keep house, work the fields as family labor, or are too young or too old.</p>';
  var rows=eco.industries.map(function(i){
    var sh=Math.round(100*i.share);
    return '<tr><td>'+esc(i.name)+(i.note?'<span class="sub">'+esc(i.note)+'</span>':'')+'</td><td class="num">'+fmt(i.workers)+'</td><td><span class="bar"><i style="width:'+Math.min(100,sh)+'%"></i></span> <span style="font-size:.78rem;color:var(--ink-soft)">'+sh+'%</span></td></tr>';
  }).join('');
  var ledger='<h2>Industries by workforce</h2><table class="ledger"><thead><tr><th>Industry</th><th class="num">Workers</th><th>Share</th></tr></thead><tbody>'+rows+'</tbody></table>';
  var tl=Math.round(sim.tradeLvl*10)/10;
  var tradeLine='<p class="hint" style="margin:8px 0 0">Trade reach '+tl+' / 3'+
    (tl<0.7?' — a backwater; peddlers and the odd cart.':tl<1.6?' — regular carts on the road, a seasonal fair.':tl<2.5?' — standing routes by road'+(t.region.hasRiver?' and river':'')+'; factors keep ledgers here.':' — a true entrepôt; goods pass through that were never made here.')+
    (sim.grainRoute?' A standing grain route feeds the town.':'')+'</p>';
  var chips='<div class="twocol" style="margin-top:14px"><div><h2>Exports</h2>'+chipRow(eco.exports)+'</div><div><h2>Imports</h2>'+chipRow(eco.imports,true)+'</div></div>';
  $("doc-economy").innerHTML=head+ledger+tradeLine+chips;
}

function renderBuildings(t){
  var eco=t.economy,names=t.names;
  var infra='<h2>Civic works</h2>'+(t.sim.infra.length?
    '<div class="chips">'+t.sim.infra.map(function(f){return '<span class="chip">'+esc(f.label)+' <b>'+f.year+'</b></span>';}).join('')+'</div>'
    :'<p class="hint" style="margin:4px 0">No civic works yet beyond the houses themselves.</p>');
  /* group occupations preserving first-seen order */
  var order=[],byG={};
  eco.occupations.forEach(function(o){ if(!byG[o.g]){byG[o.g]=[];order.push(o.g);} byG[o.g].push(o); });
  var cols=order.map(function(g){
    var rows=byG[g].map(function(o){return '<tr><td>'+esc(o.n)+'</td><td class="num">'+fmt(o.count)+'</td></tr>';}).join('');
    var extra='';
    if(g==="Food & drink"&&names.taverns.length){
      extra='<p class="hint" style="margin:6px 0 2px">Of its '+fmt(names.tavernCount)+' drinking-house'+(names.tavernCount===1?'':'s')+', those worth naming:</p>'+
        '<div class="chips">'+names.taverns.map(function(tv){return '<span class="chip">'+esc(tv)+'</span>';}).join('')+'</div>';
    }
    return '<div style="margin-top:14px"><h2>'+esc(g)+'</h2><table class="ledger"><thead><tr><th>Trade</th><th class="num">Count</th></tr></thead><tbody>'+rows+'</tbody></table>'+extra+'</div>';
  }).join('');
  $("doc-buildings").innerHTML=infra+'<div class="twocol">'+cols+'</div>';
}

function sparkSVG(t){
  var eras=t.sim.popByEra;
  if(!eras||eras.length<2)return'';
  var W=640,H=92,P=10,PB=18;
  var maxP=1;eras.forEach(function(e){if(e.pop>maxP)maxP=e.pop;});
  var x0=eras[0].year,span=Math.max(1,t.presentYear-x0);
  function X(yr){return P+(W-2*P)*(yr-x0)/span;}
  function Y(p){return H-PB-(H-P-PB)*(p/maxP);}
  var pts=eras.map(function(e){return X(e.year).toFixed(1)+","+Y(e.pop).toFixed(1);});
  var last=eras[eras.length-1];
  var area="M"+X(eras[0].year).toFixed(1)+","+(H-PB)+" L"+pts.join(" L")+" L"+X(last.year).toFixed(1)+","+(H-PB)+" Z";
  return '<svg id="popspark" viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:640px;height:auto" role="img" aria-label="Population over time">'+
    '<path d="'+area+'" fill="rgba(78,107,91,.16)"/>'+
    '<polyline points="'+pts.join(' ')+'" fill="none" stroke="#4e6b5b" stroke-width="1.6"/>'+
    '<line x1="'+P+'" y1="'+(H-PB)+'" x2="'+(W-P)+'" y2="'+(H-PB)+'" stroke="#b59f74" stroke-width="1"/>'+
    '<circle cx="'+X(last.year).toFixed(1)+'" cy="'+Y(last.pop).toFixed(1)+'" r="2.6" fill="#9c2f23"/>'+
    '<text x="'+P+'" y="'+(H-5)+'" font-size="9" font-family="ui-monospace,monospace" fill="#6b5b43">'+eras[0].year+'</text>'+
    '<text x="'+(W-P)+'" y="'+(H-5)+'" font-size="9" font-family="ui-monospace,monospace" fill="#6b5b43" text-anchor="end">'+t.presentYear+'</text>'+
    '<text x="'+(W-P)+'" y="'+(Y(last.pop)-5>12?Y(last.pop)-5:12).toFixed(1)+'" font-size="9" font-family="ui-monospace,monospace" fill="#9c2f23" text-anchor="end">'+fmt(last.pop)+'</text>'+
  '</svg>';
}

function renderHistory(t){
  var spark='<h2>Population</h2>'+sparkSVG(t)+
    '<p class="hint" style="margin:2px 0 12px">Surveyed each decade from founding to the present year.</p>';
  var lis=t.sim.events.map(function(e){
    return '<li><span class="yr">'+e.year+'</span><span class="ev'+(e.minor?' minor':'')+'">'+esc(e.text)+'</span></li>';
  }).join('');
  $("doc-history").innerHTML=spark+'<h2>Annals</h2><ul class="timeline">'+lis+'</ul>';
}

function renderDocs(t){
  $("t-name").textContent=t.names.name;
  $("t-epithet").textContent=t.names.epithet?"— "+t.names.epithet:"";
  $("t-seal").textContent="seed · "+t.seed;
  renderOverview(t);renderPeople(t);renderEconomy(t);renderBuildings(t);renderHistory(t);
}

/* ================= wiring ================= */
function download(blob,filename){
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},0);
}
function safeName(){return ((current&&current.names.name)||"town").replace(/[^\w\- ]+/g,"").trim()||"town";}

function doGenerate(){
  var cfg=readCfg();
  var t;
  try{ t=Townwright.generate(cfg); }
  catch(err){ console.error("Townwright survey failed:",err); $("mapyear").textContent="survey failed — see console"; return; }
  current=t;
  $("seed").value=t.seed;
  reflectResources(t.region.res);
  $("docsheet").hidden=false;
  renderDocs(t);
  paintAnimated(t);
}
function rollAndGenerate(){ $("seed").value=randomSeed(); doGenerate(); }

/* mode tabs */
document.querySelectorAll(".modes button").forEach(function(b){
  b.addEventListener("click",function(){
    document.querySelectorAll(".modes button").forEach(function(x){x.classList.toggle("on",x===b);});
    var m=b.getAttribute("data-mode");
    document.querySelectorAll(".modepane").forEach(function(p){p.classList.toggle("on",p.id==="pane-"+m);});
  });
});
/* doc tabs */
document.querySelectorAll(".dtab").forEach(function(b){
  b.addEventListener("click",function(){
    document.querySelectorAll(".dtab").forEach(function(x){x.classList.toggle("on",x===b);});
    var d=b.getAttribute("data-doc");
    document.querySelectorAll(".dpane").forEach(function(p){p.classList.toggle("on",p.id==="doc-"+d);});
  });
});
/* range labels */
$("c-danger").addEventListener("input",function(){$("v-danger").textContent=this.value;});
$("c-trade").addEventListener("input",function(){$("v-trade").textContent=this.value==="-1"?"auto":this.value;});

$("genBtn").addEventListener("click",doGenerate);
$("diceBtn").addEventListener("click",rollAndGenerate);
$("resAuto").addEventListener("click",function(){resetResAuto();doGenerate();});
$("resRoll").addEventListener("click",rollAndGenerate);

document.addEventListener("keydown",function(e){
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  var t=e.target,tag=t&&t.tagName;
  if(tag==="INPUT"||tag==="SELECT"||tag==="TEXTAREA"||(t&&t.isContentEditable))return;
  if(e.key==="r"||e.key==="R"){e.preventDefault();rollAndGenerate();}
});

$("pngBtn").addEventListener("click",function(){
  if(!current)return;
  animToken++;            /* cancel any running build animation */
  paint(current,1);       /* ensure the final frame is on the canvas */
  $("mapyear").textContent="AD "+current.presentYear+" · "+fmt(current.sim.pop)+" souls";
  $("mapcanvas").toBlob(function(b){ if(b)download(b,safeName()+".png"); },"image/png");
});
$("jsonBtn").addEventListener("click",function(){
  if(!current)return;
  var b=new Blob([JSON.stringify(current,null,2)],{type:"application/json"});
  download(b,safeName()+".json");
});

/* ================= init ================= */
buildResRows();
buildIndMults();
$("seed").value=randomSeed();
doGenerate();
})();
