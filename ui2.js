
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
    archetype:$("c-archetype").value,
    plan:$("c-plan").value,
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
var SEASGN=1; /* +1 sea east, −1 sea west (set per paint from map.seaSide) */
var VIEW={k:1,tx:0,ty:0};   /* zoom & pan: screen = world*k + t */
var SCRUB=1;                 /* 0..1 position in the town's history */
var hitItems=[],hitSeed="";
function roofTone(kind){return {house:"#b58c5f",craft:"#a96e3f",ware:"#8f7a4f",civic:"#c0a36a",tavern:"#a3552c"}[kind]||"#b58c5f";}
function mixTone(a,b,t){ /* hex blend for district roof tints */
  var pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);
  var r=Math.round(((pa>>16)&255)+((((pb>>16)&255)-((pa>>16)&255))*t));
  var g=Math.round(((pa>>8)&255)+((((pb>>8)&255)-((pa>>8)&255))*t));
  var bl=Math.round((pa&255)+(((pb&255)-(pa&255))*t));
  return "rgb("+r+","+g+","+bl+")";
}
var LMFILL={palace:"#c9a13f",mint:"#c9a13f",abbey:"#cdb579",keep:"#b3a27c",barracks:"#9f8c63",watchtower:"#9f8c63",ware:"#8f7a4f",caravanserai:"#c2a06a",sawmill:"#a96e3f",press:"#a96e3f",tannery:"#a96e3f",smelter:"#a96e3f",collegewing:"#c6ab74",scriptorium:"#c6ab74",hospice:"#c6ab74",ropewalk:"#b09a6e"};
function setupCanvas(){
  var cv=$("mapcanvas"),dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=1000*dpr;cv.height=700*dpr;
  return {ctx:cv.getContext("2d"),dpr:dpr};
}
function clampView(M){
  VIEW.k=Math.min(8,Math.max(1,VIEW.k));
  VIEW.tx=Math.min(0,Math.max(M.W-M.W*VIEW.k,VIEW.tx));
  VIEW.ty=Math.min(0,Math.max(M.H-M.H*VIEW.k,VIEW.ty));
}
function blotchRng(seed){var h=0;for(var i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))>>>0;return function(){h=(h*1664525+1013904223)>>>0;return h/4294967296;};}
function drawBuildingRect(ctx,b,fill){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot||0);
  ctx.fillStyle=fill||roofTone(b.kind);ctx.strokeStyle=INK;ctx.lineWidth=0.8;
  var w=b.w,h=b.h;
  function poly(pts){
    ctx.beginPath();pts.forEach(function(p,pi){pi?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);});
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  if(b.shape==="U"){ /* coaching inn: courtyard notched into one long side */
    var nw=w*0.36,nd=h*0.52,s=b.notch||1;
    poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[nw/2,h/2],[nw/2,h/2-nd],[-nw/2,h/2-nd],[-nw/2,h/2],[-w/2,h/2]]
      .map(function(p){return [p[0],p[1]*s];}));
  }else if(b.shape==="L"){
    var cw=w*0.45,ch=h*0.5;
    poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2-ch],[w/2-cw,h/2-ch],[w/2-cw,h/2],[-w/2,h/2]]);
  }else if(b.shape==="oct"){ /* tower house: corners cut */
    var c=Math.min(w,h)*0.3;
    poly([[-w/2+c,-h/2],[w/2-c,-h/2],[w/2,-h/2+c],[w/2,h/2-c],[w/2-c,h/2],[-w/2+c,h/2],[-w/2,h/2-c],[-w/2,-h/2+c]]);
  }else{
    ctx.fillRect(-w/2,-h/2,w,h);ctx.strokeRect(-w/2,-h/2,w,h);
    ctx.strokeStyle="rgba(46,36,24,.4)";ctx.beginPath();ctx.moveTo(-w/2+1,0);ctx.lineTo(w/2-1,0);ctx.stroke();
  }
  ctx.restore();
}
function crossGlyph(ctx,x,y,s){
  ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x,y+s);ctx.moveTo(x-s*0.66,y-s*0.33);ctx.lineTo(x+s*0.66,y-s*0.33);ctx.stroke();
}
function drawLandmark(ctx,o){
  var civic="#c0a36a";
  if(o.kind==="graveyard"){
    ctx.save();ctx.strokeStyle=INKSOFT;ctx.setLineDash([3,3]);ctx.strokeRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h);ctx.setLineDash([]);
    ctx.strokeStyle=INK;ctx.lineWidth=1;
    (o.crosses||[]).forEach(function(c){crossGlyph(ctx,c.x,c.y,3);});
    ctx.restore();return;
  }
  if(o.kind==="parade"){
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);
    ctx.fillStyle="rgba(201,178,128,.5)";
    ctx.beginPath();ctx.ellipse(0,0,o.w/2,o.h/2,0,0,6.2832);ctx.fill();
    ctx.strokeStyle=INKSOFT;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle=INK;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,-9);ctx.lineTo(6,-7);ctx.lineTo(0,-5);ctx.stroke();
    ctx.restore();return;
  }
  if(o.kind==="fairground"){
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);
    ctx.strokeStyle=INKSOFT;ctx.setLineDash([2,4]);ctx.strokeRect(-o.w/2,-o.h/2,o.w,o.h);ctx.setLineDash([]);
    ctx.strokeStyle=INK;ctx.fillStyle="#cdb579";ctx.lineWidth=0.9;
    for(var ti=-1;ti<=1;ti++){
      var tx=ti*o.w*0.26;
      ctx.beginPath();ctx.moveTo(tx-4,3);ctx.lineTo(tx,-4);ctx.lineTo(tx+4,3);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();return;
  }
  if(o.kind==="marketcross"){
    ctx.save();ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(o.x,o.y,2.6,0,6.2832);ctx.stroke();
    crossGlyph(ctx,o.x,o.y-4,3.4);
    ctx.restore();return;
  }
  if(o.kind==="lighthouse"){
    ctx.save();ctx.strokeStyle=INK;ctx.fillStyle="#e7d6ab";ctx.lineWidth=1.1;
    ctx.beginPath();ctx.arc(o.x,o.y,3.4,0,6.2832);ctx.fill();ctx.stroke();
    ctx.fillStyle=INK;ctx.beginPath();ctx.arc(o.x,o.y,1.2,0,6.2832);ctx.fill();
    ctx.strokeStyle="rgba(46,36,24,.45)";
    for(var ri=0;ri<3;ri++){var ra=-0.5+ri*0.5;if(SEASGN<0)ra=Math.PI-ra; /* the light faces the sea */
      ctx.beginPath();ctx.moveTo(o.x+Math.cos(ra)*5,o.y+Math.sin(ra)*5);ctx.lineTo(o.x+Math.cos(ra)*9,o.y+Math.sin(ra)*9);ctx.stroke();}
    ctx.restore();return;
  }
  if(o.kind==="slipway"){
    ctx.save();ctx.translate(o.x,o.y);
    ctx.strokeStyle="#5a4630";ctx.lineWidth=1.4;
    ctx.beginPath();ctx.moveTo(-8,-4);ctx.lineTo(10,-3);ctx.moveTo(-8,4);ctx.lineTo(10,3);ctx.stroke();
    ctx.lineWidth=0.9;
    for(var si=-6;si<=8;si+=3.4){ctx.beginPath();ctx.moveTo(si,-3.6);ctx.lineTo(si,3.6);ctx.stroke();}
    ctx.strokeStyle=INK;ctx.beginPath();ctx.ellipse(-2,0,4.6,2.2,0,3.34,6.08);ctx.stroke(); /* hull ribs */
    ctx.restore();return;
  }
  if(o.kind==="cloister"){
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);
    ctx.fillStyle="#cdb579";ctx.strokeStyle=INK;ctx.lineWidth=0.9;
    ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h);ctx.strokeRect(-o.w/2,-o.h/2,o.w,o.h);
    ctx.fillStyle="#dcc998";ctx.fillRect(-o.w/2+3.5,-o.h/2+3.5,o.w-7,o.h-7);
    ctx.strokeStyle="rgba(46,36,24,.5)";ctx.strokeRect(-o.w/2+3.5,-o.h/2+3.5,o.w-7,o.h-7);
    ctx.fillStyle=INK;
    for(var ci=-1;ci<=1;ci++){ctx.fillRect(ci*o.w*0.28-0.6,-o.h/2+2.4,1.2,1.2);ctx.fillRect(ci*o.w*0.28-0.6,o.h/2-3.6,1.2,1.2);}
    ctx.restore();return;
  }
  if(o.kind==="cellars"){
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);
    ctx.fillStyle=INK;ctx.beginPath();ctx.arc(0,0,3.4,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();
    ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-4.4);ctx.lineTo(0,4.4);ctx.stroke();
    ctx.fillStyle="#7a5a36";
    ctx.beginPath();ctx.arc(6,-2.4,1.7,0,6.2832);ctx.fill();
    ctx.beginPath();ctx.arc(6.6,1.6,1.7,0,6.2832);ctx.fill();
    ctx.restore();return;
  }
  /* default: a civic building with a kind glyph */
  drawBuildingRect(ctx,o,LMFILL[o.kind]||civic);
  ctx.save();ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.1;
  var topY=o.y-o.h/2;
  if(o.kind==="church"||o.kind==="temple"||o.kind==="abbey"||o.kind==="hospice"){
    crossGlyph(ctx,o.x,topY-5,4);
    if(o.kind==="temple"){ctx.beginPath();ctx.arc(o.x,o.y,o.w*0.22,0,6.2832);ctx.stroke();}
    if(o.kind==="abbey"&&o.bell){ctx.fillStyle="#b3a27c";ctx.fillRect(o.x+o.w/2-4,topY-9,5,9);ctx.strokeRect(o.x+o.w/2-4,topY-9,5,9);ctx.fillStyle=INK;ctx.beginPath();ctx.arc(o.x+o.w/2-1.5,topY-5.5,1.1,0,6.2832);ctx.fill();}
  }else if(o.kind==="keep"||o.kind==="watchtower"){
    ctx.strokeRect(o.x-o.w/2+3,o.y-o.h/2+3,Math.max(2,o.w-6),Math.max(2,o.h-6));
    ctx.beginPath();ctx.moveTo(o.x,topY);ctx.lineTo(o.x,topY-7);ctx.lineTo(o.x+5,topY-5);ctx.lineTo(o.x,topY-3);ctx.stroke();
  }else if(o.kind==="palace"){
    ctx.lineWidth=0.9;
    for(var px=o.x-o.w/2+2;px<o.x+o.w/2-1;px+=3){ctx.beginPath();ctx.moveTo(px,topY);ctx.lineTo(px,topY-2);ctx.stroke();}
    ctx.lineWidth=1.1;
    ctx.beginPath();ctx.moveTo(o.x,topY-2);ctx.lineTo(o.x,topY-11);ctx.stroke();
    ctx.fillStyle="#9c2f23";ctx.beginPath();ctx.moveTo(o.x,topY-11);ctx.lineTo(o.x+7,topY-9);ctx.lineTo(o.x,topY-7);ctx.closePath();ctx.fill();
  }else if(o.kind==="mint"){
    ctx.beginPath();ctx.arc(o.x,o.y,2.6,0,6.2832);ctx.stroke();
    ctx.beginPath();ctx.moveTo(o.x-1,o.y);ctx.lineTo(o.x+1,o.y);ctx.stroke();
  }else if(o.kind==="highcourt"||o.kind==="guildhall"){
    ctx.beginPath();ctx.moveTo(o.x-o.w/2+1,topY);ctx.lineTo(o.x,topY-5);ctx.lineTo(o.x+o.w/2-1,topY);ctx.stroke();
  }else if(o.kind==="barracks"){
    ctx.beginPath();ctx.moveTo(o.x-o.w/2+2,topY);ctx.lineTo(o.x-o.w/2+2,topY-6);ctx.lineTo(o.x-o.w/2+6,topY-4.8);ctx.lineTo(o.x-o.w/2+2,topY-3.6);ctx.stroke();
  }else if(o.kind==="college"||o.kind==="library"||o.kind==="scriptorium"||o.kind==="collegewing"){
    if(o.kind==="college"){ctx.beginPath();ctx.moveTo(o.x,topY);ctx.lineTo(o.x,topY-6);ctx.stroke();ctx.beginPath();ctx.arc(o.x,topY-7,1.4,0,6.2832);ctx.stroke();}
    if(o.kind==="library"){for(var bi=-1;bi<=1;bi++){ctx.beginPath();ctx.moveTo(o.x+bi*2.4,o.y-2);ctx.lineTo(o.x+bi*2.4,o.y+2);ctx.stroke();}}
    if(o.kind==="scriptorium"){ctx.beginPath();ctx.moveTo(o.x-2.5,o.y+2);ctx.lineTo(o.x+2.5,o.y-2);ctx.stroke();}
  }else if(o.kind==="caravanserai"){
    ctx.fillStyle="#d8c190";ctx.fillRect(o.x-o.w/2+4,o.y-o.h/2+4,o.w-8,o.h-8);
    ctx.strokeStyle="rgba(46,36,24,.55)";ctx.strokeRect(o.x-o.w/2+4,o.y-o.h/2+4,o.w-8,o.h-8);
    ctx.strokeStyle=INK;ctx.beginPath();ctx.arc(o.x,o.y+o.h/2,2.6,Math.PI,0);ctx.stroke();
  }else if(o.kind==="customs"){
    ctx.beginPath();ctx.moveTo(o.x,topY);ctx.lineTo(o.x,topY-8);ctx.stroke();
    ctx.fillStyle="#4e6b5b";ctx.beginPath();ctx.moveTo(o.x,topY-8);ctx.lineTo(o.x+6,topY-6.4);ctx.lineTo(o.x,topY-4.8);ctx.closePath();ctx.fill();
  }else if(o.kind==="mill"){
    ctx.beginPath();ctx.arc(o.x+o.w/2+4,o.y+3,4.5,0,6.2832);ctx.stroke();
    ctx.beginPath();ctx.moveTo(o.x+o.w/2+4,o.y-1.5);ctx.lineTo(o.x+o.w/2+4,o.y+7.5);ctx.moveTo(o.x+o.w/2-0.5,o.y+3);ctx.lineTo(o.x+o.w/2+8.5,o.y+3);ctx.stroke();
  }else if(o.kind==="windmill"){
    ctx.beginPath();ctx.moveTo(o.x,topY);ctx.lineTo(o.x,topY-6);ctx.stroke();
    ctx.beginPath();ctx.moveTo(o.x-5,topY-11);ctx.lineTo(o.x+5,topY-1);ctx.moveTo(o.x+5,topY-11);ctx.lineTo(o.x-5,topY-1);ctx.stroke();
  }else if(o.kind==="sawmill"){
    ctx.beginPath();ctx.arc(o.x+o.w/2+4.6,o.y,3.6,0,6.2832);ctx.stroke();
    for(var sa=0;sa<6;sa++){var an=sa*1.047;
      ctx.beginPath();ctx.moveTo(o.x+o.w/2+4.6+Math.cos(an)*3.6,o.y+Math.sin(an)*3.6);ctx.lineTo(o.x+o.w/2+4.6+Math.cos(an)*5,o.y+Math.sin(an)*5);ctx.stroke();}
    if(o.logs){ctx.fillStyle="#8a6a44";
      for(var lg=0;lg<3;lg++){ctx.save();ctx.translate(o.x-o.w/2-5,o.y-3+lg*3.2);ctx.fillRect(-5,-1.1,10,2.2);ctx.strokeRect(-5,-1.1,10,2.2);ctx.restore();}}
  }else if(o.kind==="press"){
    ctx.beginPath();ctx.arc(o.x+o.w/2+4,o.y,2.8,0,6.2832);ctx.stroke();
    ctx.beginPath();ctx.moveTo(o.x+o.w/2+4,o.y-4.5);ctx.lineTo(o.x+o.w/2+4,o.y+4.5);ctx.stroke();
  }else if(o.kind==="tannery"){
    for(var i=0;i<3;i++){ctx.beginPath();ctx.arc(o.x-3+i*3,o.y+o.h/2+3,1.1,0,6.2832);ctx.fill();}
  }else if(o.kind==="smelter"){
    ctx.beginPath();ctx.moveTo(o.x+o.w/2-2,topY);ctx.lineTo(o.x+o.w/2-2,topY-6);ctx.stroke();
    ctx.strokeStyle=INKSOFT;ctx.beginPath();ctx.moveTo(o.x+o.w/2-2,topY-7);ctx.quadraticCurveTo(o.x+o.w/2+2,topY-10,o.x+o.w/2,topY-13);ctx.stroke();
  }else if(o.kind==="ropewalk"){
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);
    ctx.strokeStyle="rgba(46,36,24,.6)";ctx.setLineDash([3,2]);
    ctx.beginPath();ctx.moveTo(-o.w/2+2,0);ctx.lineTo(o.w/2-2,0);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();
}

function paint(t,progress,opts){
  opts=opts||{};
  var M=t.map,W=M.W,H=M.H,ctx,dpr;
  SEASGN=M.seaSide==="west"?-1:1;
  if(opts.ctx){ctx=opts.ctx;dpr=opts.dpr||1;}
  else{var su=setupCanvas();ctx=su.ctx;dpr=su.dpr;}
  var view=opts.view||VIEW;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.setTransform(dpr*view.k,0,0,dpr*view.k,dpr*view.tx,dpr*view.ty);

  /* parchment + blotches */
  var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"#ead9b4");g.addColorStop(.55,"#e6d4ad");g.addColorStop(1,"#dec998");
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  var br=blotchRng(t.seed+"|blotch");
  for(var i=0;i<12;i++){ctx.fillStyle="rgba(120,90,40,"+(0.022+br()*0.02)+")";
    ctx.beginPath();ctx.ellipse(br()*W,br()*H,30+br()*90,20+br()*60,br()*3,0,6.2832);ctx.fill();}

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
  /* felled ground (timber towns) */
  (M.stumps||[]).forEach(function(s){
    ctx.strokeStyle="rgba(106,84,54,.8)";ctx.lineWidth=0.8;
    ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,6.2832);ctx.stroke();
    ctx.fillStyle="rgba(106,84,54,.8)";ctx.fillRect(s.x-0.5,s.y-0.5,1,1);
  });
  /* farms & vineyards */
  M.farms.forEach(function(f){
    if(f.era>visEra)return;
    if(f.type==="vine"){
      f.strips.forEach(function(s){
        ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);
        ctx.fillStyle="#c6cc92";ctx.strokeStyle="rgba(46,36,24,.18)";ctx.lineWidth=0.6;
        ctx.fillRect(-s.w/2,-s.h/2,s.w,s.h);ctx.strokeRect(-s.w/2,-s.h/2,s.w,s.h);
        ctx.fillStyle="#5d6b3f";
        for(var vx=-s.w/2+2;vx<s.w/2-1;vx+=3.2)ctx.fillRect(vx,-0.7,1.2,1.4);
        ctx.restore();
      });
    }else{
      f.strips.forEach(function(s,si){
        ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);
        ctx.fillStyle=si%2?"#cdbb82":"#d6c794";ctx.strokeStyle="rgba(46,36,24,.22)";ctx.lineWidth=0.7;
        ctx.fillRect(-s.w/2,-s.h/2,s.w,s.h);ctx.strokeRect(-s.w/2,-s.h/2,s.w,s.h);
        ctx.beginPath();for(var li=1;li<4;li++){ctx.moveTo(-s.w/2,-s.h/2+s.h*li/4);ctx.lineTo(s.w/2,-s.h/2+s.h*li/4);}ctx.stroke();
        ctx.restore();
      });
    }
    drawBuildingRect(ctx,f.house);
  });
  /* sea */
  if(M.shore){
    ctx.fillStyle="#cfd9cc";
    ctx.beginPath();ctx.moveTo(M.shore[0].x,M.shore[0].y);
    M.shore.forEach(function(p){ctx.lineTo(p.x,p.y);});
    ctx.lineTo(SEASGN>0?W:0,H);ctx.lineTo(SEASGN>0?W:0,0);ctx.closePath();ctx.fill();
    ctx.strokeStyle=INK;ctx.lineWidth=1.6;
    ctx.beginPath();M.shore.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
    for(var hh=1;hh<=3;hh++){
      ctx.strokeStyle="rgba(46,36,24,"+(0.28-hh*0.07)+")";ctx.lineWidth=0.8;
      ctx.beginPath();M.shore.forEach(function(p,pi){var x=p.x+hh*7*SEASGN;pi?ctx.lineTo(x,p.y):ctx.moveTo(x,p.y);});ctx.stroke();
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
  /* log pond (timber towns) */
  if(M.logpond&&M.logpond.era<=visEra){
    var lp=M.logpond;
    ctx.fillStyle="#cfd9cc";ctx.strokeStyle=INK;ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(lp.x,lp.y,lp.rx,lp.ry,0,0,6.2832);ctx.fill();ctx.stroke();
    ctx.strokeStyle="#8a6a44";ctx.lineWidth=2;ctx.lineCap="round";
    for(var lgi=0;lgi<4;lgi++){
      var la=lgi*1.8+0.4,lxx=lp.x+Math.cos(la)*lp.rx*0.45,lyy=lp.y+Math.sin(la)*lp.ry*0.5;
      ctx.beginPath();ctx.moveTo(lxx-4,lyy-1+lgi);ctx.lineTo(lxx+4,lyy-1+lgi);ctx.stroke();
    }
  }
  /* quay (hardened waterfront) */
  if(M.quay&&M.shore&&M.quay.era<=visEra){
    var q=M.quay;
    ctx.strokeStyle="#4a3826";ctx.lineWidth=4.4;ctx.lineCap="butt";
    ctx.beginPath();var qs=false;
    M.shore.forEach(function(p){if(p.y>=q.y1&&p.y<=q.y2){qs?ctx.lineTo(p.x-1.2*SEASGN,p.y):ctx.moveTo(p.x-1.2*SEASGN,p.y);qs=true;}});
    ctx.stroke();
    ctx.fillStyle="#4a3826";
    for(var qy=q.y1+6;qy<q.y2;qy+=14){
      var qi=Math.max(0,Math.min(M.shore.length-1,Math.round(qy/8)));
      ctx.beginPath();ctx.arc(M.shore[qi].x+2.4*SEASGN,qy,1.3,0,6.2832);ctx.fill();
    }
  }
  /* roads — two passes (all casings, then all fills) so junctions merge instead of overlapping.
     Tracks are bare field-paths drawn beneath; the paved core is overlaid in stone afterward. */
  var ROADW={lane:[2.6,1.5],mineroad:[4.2,2.6],highway:[5,3.2]};
  function roadPath(pts){ctx.beginPath();pts.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});}
  ctx.lineJoin="round";ctx.lineCap="round";
  ctx.setLineDash([5,3.5]);
  M.roads.forEach(function(r){
    if(r.kind!=="track")return;
    ctx.strokeStyle="rgba(122,99,63,.5)";ctx.lineWidth=1.5;
    roadPath(r.pts);ctx.stroke();
  });
  ctx.setLineDash([]);
  M.roads.forEach(function(r){
    if(r.kind==="track")return;
    ctx.strokeStyle="#6b5436";ctx.lineWidth=(ROADW[r.kind]||ROADW.highway)[0];
    roadPath(r.pts);ctx.stroke();
  });
  M.roads.forEach(function(r){
    if(r.kind==="track")return;
    ctx.strokeStyle="#d9c79c";ctx.lineWidth=(ROADW[r.kind]||ROADW.highway)[1];
    roadPath(r.pts);ctx.stroke();
  });
  if(M.pavedSegs&&M.pavedSegs.length){
    M.pavedSegs.forEach(function(seg){
      ctx.strokeStyle="#c3b694";ctx.lineWidth=(ROADW[seg.kind]||ROADW.highway)[1];
      roadPath(seg.pts);ctx.stroke();
    });
    if(VIEW.k>=3){ /* setts seam down the middle of cobbled streets */
      ctx.strokeStyle="rgba(46,36,24,.18)";ctx.lineWidth=0.5;ctx.setLineDash([2.2,2.2]);
      M.pavedSegs.forEach(function(seg){roadPath(seg.pts);ctx.stroke();});
      ctx.setLineDash([]);
    }
  }
  /* adits + spoil (mining) */
  (M.adits||[]).forEach(function(a){
    if(a.era>visEra)return;
    ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.rot);
    ctx.fillStyle="rgba(46,36,24,.28)";
    ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(11,-4.5);ctx.lineTo(12.5,4);ctx.closePath();ctx.fill();
    ctx.fillStyle=INK;ctx.beginPath();ctx.arc(0,0,3.6,-Math.PI/2,Math.PI/2);ctx.closePath();ctx.fill();
    ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-4.6);ctx.lineTo(0,4.6);ctx.stroke();
    if(M.veinDead&&visF>=nE-0.5){
      ctx.strokeStyle="#6b3a2a";ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(-1,-4.5);ctx.lineTo(3,4.5);ctx.moveTo(3,-4.5);ctx.lineTo(-1,4.5);ctx.stroke();
    }
    ctx.restore();
  });
  /* the crossing: a ford until history builds a bridge */
  if(M.crossing){
    var cr=M.crossing,isBridge=cr.bridgeEra!=null&&visF>=cr.bridgeEra+0.5;
    ctx.save();ctx.translate(cr.x,cr.y);ctx.rotate(cr.angle);
    var span=cr.w+10;
    if(isBridge){
      ctx.fillStyle="#6b5436";ctx.fillRect(-3.4,-span/2,6.8,span);
      ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(-3.4,-span/2,6.8,span);
      ctx.strokeStyle="rgba(46,36,24,.5)";ctx.lineWidth=0.8;
      ctx.beginPath();ctx.moveTo(-3.4,-span/2+2);ctx.lineTo(3.4,-span/2+2);ctx.moveTo(-3.4,span/2-2);ctx.lineTo(3.4,span/2-2);ctx.stroke();
    }else{
      ctx.strokeStyle="rgba(46,36,24,.4)";ctx.lineWidth=1.2;ctx.setLineDash([2.5,3]);
      ctx.beginPath();ctx.moveTo(0,-span/2);ctx.lineTo(0,span/2);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="#b6a87f";ctx.strokeStyle=INKSOFT;ctx.lineWidth=0.6;
      var ns2=Math.max(4,Math.round(cr.w/3.2));
      for(var st2=0;st2<ns2;st2++){
        var yy=-cr.w/2+(st2+0.5)*(cr.w/ns2);
        ctx.beginPath();ctx.ellipse(st2%2?1.7:-1.7,yy,1.9,1.4,0,0,6.2832);ctx.fill();ctx.stroke();
      }
    }
    ctx.restore();
  }
  /* abbey precinct */
  if(M.precinct&&M.precinct.era<=visEra){
    ctx.strokeStyle="rgba(74,56,38,.7)";ctx.lineWidth=1.4;ctx.setLineDash([5,3]);
    ctx.beginPath();M.precinct.poly.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();
    ctx.setLineDash([]);
  }
  /* graveyards under buildings */
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
  /* citadel ring (capitals) */
  if(M.citadel&&visF>=M.citadel.era+0.55){
    var cp=M.citadel.poly;
    ctx.strokeStyle="#4a3826";ctx.lineWidth=2.8;ctx.lineJoin="round";
    ctx.beginPath();cp.forEach(function(p,pi){pi?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();
    cp.forEach(function(p){ctx.fillStyle="#4a3826";ctx.fillRect(p.x-2.4,p.y-2.4,4.8,4.8);});
  }
  /* buildings, era-batched with partial reveal */
  var byEra=[];for(var e=0;e<nE;e++)byEra.push([]);
  M.buildings.forEach(function(b){byEra[Math.min(b.era,nE-1)].push(b);});
  for(var e2=0;e2<nE;e2++){
    var arr=byEra[e2],frac=visF-e2;
    if(frac<=0)break;
    var n=frac>=1?arr.length:Math.floor(arr.length*frac);
    for(var bi=0;bi<n;bi++){
      var b9=arr[bi];
      var dt=(b9.d!=null&&M.districts&&M.districts[b9.d])?M.districts[b9.d].tone:null;
      drawBuildingRect(ctx,b9,dt?mixTone(roofTone(b9.kind),dt,0.32):null);
    }
  }
  /* stalls + remaining landmarks */
  M.stalls.forEach(function(s){
    if(s.era>visEra)return;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.rot);
    ctx.fillStyle=(s.x+s.y)%2<1?"#9c2f23":"#4e6b5b";ctx.globalAlpha=0.85;
    ctx.fillRect(-s.w/2,-s.h/2,s.w,s.h);ctx.restore();
  });
  M.landmarks.forEach(function(o){if(o.kind!=="graveyard"&&o.era<=visEra)drawLandmark(ctx,o);});
  /* waymark crosses on the pilgrim road */
  if(M.waymarks&&(!M.precinct||M.precinct.era<=visEra)){
    ctx.strokeStyle=INK;ctx.lineWidth=1;
    M.waymarks.forEach(function(wm){crossGlyph(ctx,wm.x,wm.y,3);});
  }
  /* place-name labels appear as you lean in */
  if(!opts.ctx)drawLabels(ctx,t,visEra,visF);

  /* ---- screen-fixed chrome ---- */
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.strokeStyle="rgba(46,36,24,.35)";ctx.lineWidth=1;ctx.strokeRect(10.5,10.5,W-21,H-21);
  ctx.save();ctx.translate(52,58);ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.1;
  ctx.beginPath();ctx.arc(0,0,17,0,6.2832);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(4,4);ctx.lineTo(0,1);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();
  ctx.font="700 10px Palatino, 'Iowan Old Style', serif";ctx.textAlign="center";ctx.fillText("N",0,-21);
  ctx.restore();
  ctx.save();ctx.translate(34,H-30);ctx.strokeStyle=INK;ctx.fillStyle=INK;ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(100,0);ctx.moveTo(0,-4);ctx.lineTo(0,4);ctx.moveTo(50,-3);ctx.lineTo(50,3);ctx.moveTo(100,-4);ctx.lineTo(100,4);ctx.stroke();
  ctx.font="italic 10px Palatino, serif";ctx.textAlign="left";
  ctx.fillText("≈ "+Math.max(25,Math.round(200/view.k))+" yards",0,14);
  ctx.restore();
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

function drawLabels(ctx,t,visEra,visF){
  var M=t.map,k=VIEW.k;
  if(k<1.7)return;
  var vx0=(0-VIEW.tx)/k-26,vy0=(0-VIEW.ty)/k-26,vx1=(M.W-VIEW.tx)/k+26,vy1=(M.H-VIEW.ty)/k+26;
  function vis(o){return o.x>vx0&&o.x<vx1&&o.y>vy0&&o.y<vy1;}
  /* greedy collision avoidance: draw order = priority, later labels skip occupied ground */
  var placed=[];
  function label(x,y,txt,size,italic,col){
    ctx.font=(italic?"italic ":"")+"600 "+(size/k)+"px Palatino, 'Iowan Old Style', serif";
    var w=ctx.measureText(txt).width,h=size/k;
    var x0=x-w/2-2/k,x1=x+w/2+2/k,y0=y-h,y1=y+h*0.32;
    for(var i=0;i<placed.length;i++){
      var r=placed[i];
      if(x0<r.x1&&x1>r.x0&&y0<r.y1&&y1>r.y0)return false;
    }
    placed.push({x0:x0,x1:x1,y0:y0,y1:y1});
    ctx.textAlign="center";ctx.lineWidth=3/k;ctx.strokeStyle="rgba(240,228,196,.85)";ctx.lineJoin="round";
    ctx.strokeText(txt,x,y);ctx.fillStyle=col||INK;ctx.fillText(txt,x,y);
    return true;
  }
  /* district names first — the structure of the town, visible from further out */
  if(M.districts&&M.districts.length&&k<5.2){
    var hadLS="letterSpacing" in ctx;
    if(hadLS)ctx.letterSpacing=(2.2/k)+"px";
    M.districts.forEach(function(d){
      if(!vis(d))return;
      label(d.x,d.y,d.nm.toUpperCase(),9.5,false,"rgba(46,36,24,.52)");
    });
    if(hadLS)ctx.letterSpacing="0px";
  }
  if(k<2.2)return;
  M.landmarks.forEach(function(o){
    if(o.era>visEra||!o.nm||!vis(o))return;
    if(label(o.x,o.y-(o.h||8)/2-5/k,o.nm,10.5)&&o.who&&k>=3)
      label(o.x,o.y-(o.h||8)/2-5/k+10/k,o.who,8.5,true,"rgba(46,36,24,.78)");
  });
  if(M.crossing&&vis(M.crossing)){
    var isB=M.crossing.bridgeEra!=null&&visF>=M.crossing.bridgeEra+0.5;
    label(M.crossing.x,M.crossing.y-12/k,isB?"The Bridge":"The Ford",9.5,true);
  }
  if(k>=3){
    M.buildings.forEach(function(b){
      if(b.era>visEra||!vis(b))return;
      if(b.nm)label(b.x,b.y-b.h/2-7/k,b.nm,9.5);
      else if(b.who&&k>=3.4)label(b.x,b.y-b.h/2-7/k,b.who.split(",")[0],8.5,true);
    });
  }
  if(k>=4.6){
    var shown=0;
    M.buildings.forEach(function(b,i){
      if(shown>=70||b.era>visEra||b.nm||b.who||!vis(b))return;
      if(label(b.x,b.y+b.h/2+7/k,TW.nameAt(t.seed,i),7.5,true,"rgba(46,36,24,.7)"))shown++;
    });
  }
}

function paintAnimated(t){
  var token=++animToken;
  VIEW.k=1;VIEW.tx=0;VIEW.ty=0;
  var founded=t.sim.founded,span=Math.max(1,t.presentYear-founded);
  var scrub=$("eraScrub");
  if(REDUCED){SCRUB=1;if(scrub)scrub.value=1000;paint(t,1);$("mapyear").textContent="AD "+t.presentYear+" · "+fmt(t.sim.pop)+" souls";return;}
  var dur=1200+Math.min(700,t.map.buildings.length*0.6),start=null;
  function frame(ts){
    if(token!==animToken)return;
    if(start===null)start=ts;
    var p=Math.min(1,(ts-start)/dur);
    var ease=1-Math.pow(1-p,2.2);
    SCRUB=ease;if(scrub)scrub.value=Math.round(ease*1000);
    paint(t,ease);
    $("mapyear").textContent="AD "+Math.round(founded+span*ease);
    if(p<1)requestAnimationFrame(frame);
    else{SCRUB=1;$("mapyear").textContent="AD "+t.presentYear+" · "+fmt(t.sim.pop)+" souls";}
  }
  requestAnimationFrame(frame);
}

/* ================= map hit index & tooltips ================= */
var KINDLBL={church:"Parish church",temple:"Great temple",keep:"The keep",guildhall:"Guildhall",mill:"Watermill",windmill:"Windmill",tannery:"Tannery",smelter:"Smelter",customs:"Customs house",lighthouse:"Harbor light",ropewalk:"Ropewalk",slipway:"Slipway",abbey:"Abbey",cloister:"Cloister",hospice:"Pilgrims' hospice",graveyard:"Graveyard",palace:"Royal palace",mint:"Royal mint",highcourt:"High court",barracks:"Barracks",parade:"Parade ground",watchtower:"Watchtower",college:"College hall",collegewing:"College range",library:"Library",scriptorium:"Scriptorium",caravanserai:"Caravanserai",ware:"Warehouse",fairground:"Fairground",marketcross:"Market cross",press:"Press-house",cellars:"Wine cellars",sawmill:"Sawmill",house:"House",craft:"Workshop",tavern:"Tavern"};
function buildHitIndex(t){
  hitItems=[];hitSeed=t.seed;
  var M=t.map;
  function yr(e){return M.eras[Math.max(0,Math.min(e||0,M.eras.length-1))].year;}
  M.buildings.forEach(function(b,i){
    hitItems.push({x:b.x,y:b.y,w:b.w,h:b.h,rot:b.rot,era:b.era,
      pri:(b.nm||b.who)?2:1,idx:(b.nm||b.who)?null:i,kind:b.kind,who:b.who||null,
      dnm:(b.d!=null&&M.districts&&M.districts[b.d])?M.districts[b.d].nm:null,
      title:b.nm||(b.who?b.who.split(",")[0]:null),
      sub:b.nm?((b.shape==="U"?"Coaching inn":"Tavern")+(b.who?" — kept by "+b.who:"")):(b.who?(b.who.split(",").slice(1).join(",").trim()||"Notable house"):null),
      yr:yr(b.era)});
  });
  (M.stalls||[]).forEach(function(s){
    hitItems.push({x:s.x,y:s.y,w:Math.max(7,s.w+3),h:Math.max(7,s.h+3),rot:s.rot,era:s.era,pri:1,kind:"stall",
      title:"Market stall",sub:"canvas, trestles, and argument",yr:yr(s.era)});
  });
  (M.stumps||[]).forEach(function(s){
    hitItems.push({x:s.x,y:s.y,w:7,h:7,rot:0,era:0,pri:1,kind:"stump",
      title:"Felled stump",sub:"the woods gave way to the town",yr:yr(0)});
  });
  M.farms.forEach(function(f,fi){
    hitItems.push({x:f.house.x,y:f.house.y,w:f.house.w+4,h:f.house.h+4,rot:f.house.rot,era:f.era,
      pri:1,stead:fi,kind:f.type,title:null,sub:(f.type==="vine"?"Vineyard terraces":"Strip fields"),yr:yr(f.era)});
  });
  M.landmarks.forEach(function(o){
    hitItems.push({x:o.x,y:o.y,w:o.w||10,h:o.h||10,rot:o.rot,era:o.era,pri:3,kind:o.kind,
      title:o.nm||KINDLBL[o.kind]||capf(o.kind),
      sub:(o.nm&&KINDLBL[o.kind]?KINDLBL[o.kind]+" · ":"")+"raised c. AD "+yr(o.era)+(o.who?" — "+o.who:"")});
  });
  (M.adits||[]).forEach(function(a){
    hitItems.push({x:a.x,y:a.y,w:12,h:12,rot:0,era:a.era,pri:3,kind:"adit",
      title:"Mine adit",sub:"cut c. AD "+yr(a.era)+(M.veinDead?" — the vein has since died":"")});
  });
  if(M.crossing){
    var cr=M.crossing;
    hitItems.push({x:cr.x,y:cr.y,w:cr.w+12,h:cr.w+12,rot:0,era:0,pri:3,kind:"crossing",
      title:"River crossing",
      sub:cr.bridgeEra!=null?("forded since the founding; bridged c. AD "+yr(cr.bridgeEra)):"a ford — carts wait for low water"});
  }
  if(M.quay&&M.shore){
    var qi=Math.max(0,Math.min(M.shore.length-1,Math.round(((M.quay.y1+M.quay.y2)/2)/8)));
    hitItems.push({x:M.shore[qi].x,y:(M.quay.y1+M.quay.y2)/2,w:12,h:M.quay.y2-M.quay.y1,rot:0,era:M.quay.era,pri:2,kind:"quay",
      title:"The Quay",sub:"driven c. AD "+yr(M.quay.era)});
  }
  if(M.logpond)hitItems.push({x:M.logpond.x,y:M.logpond.y,w:M.logpond.rx*2,h:M.logpond.ry*2,rot:0,era:M.logpond.era,pri:2,kind:"logpond",title:"The Log Pond",sub:"dammed c. AD "+yr(M.logpond.era)});
}
function hitTest(wp,visEra){
  var best=null;
  for(var i=0;i<hitItems.length;i++){
    var o=hitItems[i];
    if(o.era>visEra)continue;
    var dx=wp.x-o.x,dy=wp.y-o.y;
    var c=Math.cos(-(o.rot||0)),s=Math.sin(-(o.rot||0));
    var lx=dx*c-dy*s,ly=dx*s+dy*c;
    var pad=2.4/VIEW.k+1.4;
    if(Math.abs(lx)<=o.w/2+pad&&Math.abs(ly)<=o.h/2+pad){
      if(!best||o.pri>=best.pri)best=o;
    }
  }
  return best;
}
function tipContent(o){
  var title=o.title,sub=o.sub;
  if(title==null&&o.idx!=null){
    title=TW.nameAt(hitSeed,o.idx);
    sub=(o.kind==="craft"?"Workshop":"House")+" · built c. AD "+o.yr;
  }
  if(title==null&&o.stead!=null){
    var parts=TW.nameAt(hitSeed,9000+o.stead).split(" ");
    title="The "+parts[parts.length-1]+" steading";
  }
  if(o.dnm)sub=(sub?sub+" · ":"")+o.dnm;
  return {t:title||"",s:sub||""};
}

/* ================= map interactions ================= */
(function(){
  var cv=$("mapcanvas"),stage=$("mapstage"),tip=$("maptip");
  if(!cv||!stage)return;
  var pointers={},pinchBase=null,dragMoved=0,lastTap={t:0,x:0,y:0},tipTimer=null;
  function repaint(){if(current)paint(current,SCRUB);}
  function logicalPos(e){
    var r=cv.getBoundingClientRect();
    return {x:(e.clientX-r.left)*(1000/Math.max(1,r.width)),y:(e.clientY-r.top)*(700/Math.max(1,r.height)),cx:e.clientX,cy:e.clientY};
  }
  function worldPos(sp){return {x:(sp.x-VIEW.tx)/VIEW.k,y:(sp.y-VIEW.ty)/VIEW.k};}
  function visEraNow(){if(!current)return 0;return Math.floor(SCRUB*(current.map.eras.length-0.0001));}
  function hideTip(){if(tip){tip.hidden=true;}if(tipTimer){clearTimeout(tipTimer);tipTimer=null;}}
  function showTip(o,e){
    if(!tip)return;
    var c=tipContent(o);
    if(!c.t){hideTip();return;}
    tip.innerHTML="<b>"+esc(c.t)+"</b>"+(c.s?"<span>"+esc(c.s)+"</span>":"");
    var sr=stage.getBoundingClientRect();
    tip.hidden=false; /* visible before measuring */
    var x=e.clientX-sr.left,y=e.clientY-sr.top;
    var flip=y-tip.offsetHeight*1.15-8<2; /* would poke above the stage -> show below the cursor */
    tip.style.transform=flip?"translate(-50%,0)":"translate(-50%,-115%)";
    x=Math.max(tip.offsetWidth/2+4,Math.min(sr.width-tip.offsetWidth/2-4,x)); /* stay inside the side edges */
    tip.style.left=x+"px";
    tip.style.top=(flip?y+14:y-8)+"px";
  }
  /* ---- building dossier panel (click/tap a thing to open it) ---- */
  var panel=$("bpanel"),bpTitle=$("bptitle"),bpSub=$("bpsub"),bpBody=$("bpbody");
  function closePanel(){if(panel)panel.hidden=true;}
  function loreRng(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return function(){h=(h*1664525+1013904223)>>>0;return h/4294967296;};}
  function lorePick(r,arr){return arr[Math.floor(r()*arr.length)];}
  var LORE={
    house:["{N} keeps {n} hens and one temperamental goose out back.","The roof was rethatched after the storms of AD {y}.","{N} brews a small-ale the neighbors pretend not to covet.","A {adj} dog sleeps in the doorway most afternoons.","The lintel bears a charm against ague, cut by a hedge-witch.","{N} owes the miller a sack of flour, and both of them know it.","Three generations have argued over the same garden wall.","A cousin from {dir} lodges here whenever the fairs come."],
    craft:["Apprentice {A} sweeps the shavings into the lane at dusk.","The sign over the door has been repainted twice — crooked both times.","Work here is promised faster than it is finished, as everywhere.","{N} talks to the tools; the tools, neighbors say, talk back.","Half the town owes for work done; {N} keeps the tally in chalk.","The workshop cat answers to no name and earns its keep anyway."],
    tavern:["The common room smells of {stew} and woodsmoke.","{K} waters the ale for strangers, and knows that it shows.","A fiddle comes down off the wall most {day} nights.","The cellar floods each spring; regulars grade the years by the watermark.","Nobody has won the standing dart wager since AD {y}.","The corner table belongs, by custom older than the deed, to the carters."],
    holy:["The bell is rung by {A}, who is paid in candle-ends and respect.","Pilgrims leave pressed flowers in the door-crack for luck.","The roof leaks over the font; buckets are placed with reverence.","An old feud about pew-rights smolders politely on.","The graveyard yew is older than the town and minds its own business."],
    martial:["The garrison drills at dawn and grumbles by noon.","{A} holds the watch-list, and with it every grudge in the company.","The armory smells of tallow, rust, and exaggeration.","Recruits are taught the walls first, the taverns second — they learn both.","A kestrel nests in the tower top; the men consider her an officer."],
    work:["The ledger is kept in a hand only {A} can read.","Carts queue here before first light on market days.","The smell carries to the next street; the street has stopped complaining.","Goods move through faster than gossip, though it is a near thing.","The beams still show the scorch of the fire of AD {y}."],
    learned:["Students argue in the doorway about things with Latin names.","{A} fines a penny for dog-eared pages and keeps a fierce list.","The ink here is mixed to a recipe guarded like a relic.","Someone has been correcting the margins. Nobody confesses.","Candles burn later here than anywhere in town save the taverns."],
    stead:["The strips are walked end to end each evening, weather be damned.","A scarecrow in a soldier's old coat guards the near field.","The well went sweet again in AD {y}; the luck is still discussed.","Hedges here are clipped by inheritance, not by agreement."],
    stall:["Sells onions, ribbons, and rumor in roughly equal measure.","The awning has outlived four owners and one small riot.","Prices rise with fair weather and fall when the watch strolls past.","Everything is fresh; the meaning of the word is negotiable."],
    stump:["Counting the rings puts it older than the town's charter.","Saw-cut, not storm-felled — the town needed beams more than shade.","Mushrooms have claimed the north side; children have claimed the top.","The stump is used as an auction block on quarter-days."],
    generic:["It has outlasted three roofs and at least two scandals.","Children dare each other to touch the door at dusk.","It appears in town records mostly when something has gone wrong.","The town would miss it more than the town admits."]
  };
  function lorePool(kind){
    if(kind==="tavern")return LORE.tavern;
    if(kind==="stall")return LORE.stall;
    if(kind==="stump")return LORE.stump;
    if(kind==="craft")return LORE.craft;
    if(kind==="house")return LORE.house;
    if(kind==="field"||kind==="vine")return LORE.stead;
    if(/church|temple|abbey|cloister|hospice|graveyard/.test(kind))return LORE.holy;
    if(/keep|barracks|watchtower|parade|citadel|palace/.test(kind))return LORE.martial;
    if(/mill|windmill|tannery|smelter|sawmill|press|cellars|ropewalk|slipway|ware|customs|quay|logpond|adit/.test(kind))return LORE.work;
    if(/college|collegewing|library|scriptorium/.test(kind))return LORE.learned;
    return LORE.generic;
  }
  function genLore(o){
    var r=loreRng(hitSeed+"|"+(o.idx!=null?o.idx:(o.title||""))+"|"+(o.kind||""));
    var first=(o.title||"").split(" ")[0]||"The householder";
    var keeper=o.who?o.who.split(",")[0].split(" ")[0]:first;
    var span=Math.max(1,(current?current.presentYear:o.yr||1453)-(o.yr||1400));
    var yLore=(o.yr||1400)+Math.floor(r()*span);
    function fill(s){
      return s.replace("{N}",first).replace("{K}",keeper)
        .replace("{A}",TW.nameAt(hitSeed,((o.idx||0)+4321)%9000).split(" ")[0])
        .replace("{y}",String(yLore))
        .replace("{n}",lorePick(r,["three","four","five","a half-dozen"]))
        .replace("{adj}",lorePick(r,["grey-muzzled","one-eared","limping","fat","ancient"]))
        .replace("{dir}",lorePick(r,["upriver","downriver","the coast road","the hill country"]))
        .replace("{stew}",lorePick(r,["barley stew","onion pottage","eel pie","mutton broth"]))
        .replace("{day}",lorePick(r,["market","feast","washing"]));
    }
    var pool=lorePool(o.kind||"");
    var i1=Math.floor(r()*pool.length),i2=Math.floor(r()*(pool.length-1));
    if(i2>=i1)i2++;
    return [fill(pool[i1]),fill(pool[i2])];
  }
  function openPanel(o){
    if(!panel)return;
    var c=tipContent(o);
    if(!c.t){closePanel();return;}
    bpTitle.textContent=c.t;
    bpSub.textContent=c.s||"";
    bpBody.innerHTML=genLore(o).map(function(s){return '<p class="bplore">'+esc(s)+'</p>';}).join("");
    panel.hidden=false;
  }
  if($("bpclose"))$("bpclose").addEventListener("click",closePanel);
  if($("genBtn"))$("genBtn").addEventListener("click",closePanel);
  if($("diceBtn"))$("diceBtn").addEventListener("click",closePanel);
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"){closePanel();return;}
    if(e.key!=="r"&&e.key!=="R")return;
    var tg=e.target&&e.target.tagName;
    if(tg==="INPUT"||tg==="SELECT"||tg==="TEXTAREA")return;
    closePanel();
  });
  function setZoom(nk,sp){
    if(!current)return;
    nk=Math.min(8,Math.max(1,nk));
    var w=worldPos(sp);
    VIEW.k=nk;VIEW.tx=sp.x-w.x*nk;VIEW.ty=sp.y-w.y*nk;
    clampView(current.map);
    repaint();hideTip();
  }
  cv.addEventListener("wheel",function(e){
    if(!current)return;
    e.preventDefault();
    setZoom(VIEW.k*Math.exp(-e.deltaY*0.0016),logicalPos(e));
  },{passive:false});
  cv.addEventListener("dblclick",function(e){
    if(!current)return;
    e.preventDefault();
    var sp=logicalPos(e);
    setZoom(VIEW.k<4?VIEW.k*1.9:1,sp);
  });
  cv.addEventListener("pointerdown",function(e){
    if(!current)return;
    cv.setPointerCapture(e.pointerId);
    pointers[e.pointerId]=logicalPos(e);
    dragMoved=0;
    var keys=Object.keys(pointers);
    if(keys.length===2){
      var a=pointers[keys[0]],b=pointers[keys[1]];
      pinchBase={d:Math.hypot(a.x-b.x,a.y-b.y),k:VIEW.k};
    }
    cv.classList.add("dragging");
    hideTip();
  });
  cv.addEventListener("pointermove",function(e){
    if(!current)return;
    var sp=logicalPos(e);
    if(pointers[e.pointerId]){
      var keys=Object.keys(pointers);
      if(keys.length===2&&pinchBase){
        pointers[e.pointerId]=sp;
        var a=pointers[keys[0]],b=pointers[keys[1]];
        var d=Math.hypot(a.x-b.x,a.y-b.y);
        var mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        setZoom(pinchBase.k*(d/Math.max(1,pinchBase.d)),mid);
        dragMoved+=4;
      }else{
        var prev=pointers[e.pointerId];
        var dx=sp.x-prev.x,dy=sp.y-prev.y;
        dragMoved+=Math.abs(dx)+Math.abs(dy);
        VIEW.tx+=dx;VIEW.ty+=dy;
        clampView(current.map);
        pointers[e.pointerId]=sp;
        repaint();
      }
    }else if(e.pointerType==="mouse"){
      var hit=hitTest(worldPos(sp),visEraNow());
      if(hit)showTip(hit,e);else hideTip();
    }
  });
  function endPointer(e){
    if(pointers[e.pointerId]){
      var sp=logicalPos(e);
      if(dragMoved<6){
        var now=Date.now();
        if(e.pointerType!=="mouse"&&now-lastTap.t<330&&Math.hypot(sp.x-lastTap.x,sp.y-lastTap.y)<26){
          setZoom(VIEW.k<4?VIEW.k*1.9:1,sp);
          lastTap={t:0,x:0,y:0};
        }else{
          lastTap={t:now,x:sp.x,y:sp.y};
          var hit=hitTest(worldPos(sp),visEraNow());
          if(hit){openPanel(hit);hideTip();}
          else{closePanel();hideTip();}
        }
      }
      delete pointers[e.pointerId];
      if(Object.keys(pointers).length<2)pinchBase=null;
    }
    if(!Object.keys(pointers).length)cv.classList.remove("dragging");
  }
  cv.addEventListener("pointerup",endPointer);
  cv.addEventListener("pointercancel",endPointer);
  cv.addEventListener("pointerleave",function(e){if(!pointers[e.pointerId])hideTip();});
  var zi=$("zoomIn"),zo=$("zoomOut"),zr=$("zoomReset");
  if(zi)zi.addEventListener("click",function(){setZoom(VIEW.k*1.45,{x:500,y:350});});
  if(zo)zo.addEventListener("click",function(){setZoom(VIEW.k/1.45,{x:500,y:350});});
  if(zr)zr.addEventListener("click",function(){VIEW.k=1;VIEW.tx=0;VIEW.ty=0;repaint();hideTip();});
  var sc=$("eraScrub");
  if(sc)sc.addEventListener("input",function(){
    if(!current)return;
    animToken++; /* take the reins from any running replay */
    SCRUB=(+this.value)/1000;
    repaint();
    var founded=current.sim.founded,span=Math.max(1,current.presentYear-founded);
    $("mapyear").textContent=SCRUB>=1?("AD "+current.presentYear+" · "+fmt(current.sim.pop)+" souls"):("AD "+Math.round(founded+span*SCRUB));
    hideTip();
  });
  var rb=$("replayBtn");
  if(rb)rb.addEventListener("click",function(){if(current)paintAnimated(current);});
})();

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
var GOV_LABEL={lord:"Feudal lord",charter:"Chartered town",council:"Merchant council",temple:"Temple seat",crown:"Seat of the Crown"};

function renderOverview(t){
  var sim=t.sim,eco=t.economy;
  var stats=statGrid([
    {k:"Population",v:fmt(sim.pop)},
    {k:"Founded",v:sim.founded+" <small>· "+fmt(sim.ageYears)+" yrs</small>"},
    {k:"Origin",v:'<small style="font-size:.86rem;font-style:normal">'+esc(capf(t.founding.label))+"</small>"},
    {k:"Archetype",v:'<small style="font-size:.86rem;font-style:normal">'+esc(t.archetype.label)+'</small>'},
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
    return '<tr><td>'+esc(i.name)+(i.quality&&i.quality!=="plain"?' <span class="chip q-'+i.quality+'" style="padding:1px 6px;font-size:.66rem;vertical-align:1px">'+esc(i.quality)+'</span>':'')+(i.note?'<span class="sub">'+esc(i.note)+'</span>':'')+'</td><td class="num">'+fmt(i.workers)+'</td><td><span class="bar"><i style="width:'+Math.min(100,sh)+'%"></i></span> <span style="font-size:.78rem;color:var(--ink-soft)">'+sh+'%</span></td></tr>';
  }).join('');
  var qual='';
  if(t.quality&&t.quality.length){
    qual='<h2>Craft repute</h2><div class="chips">'+t.quality.map(function(q){return '<span class="chip q-'+q.label+'">'+esc(capf(q.craft))+' &middot; <b>'+q.label+'</b></span>';}).join('')+'</div><div style="height:10px"></div>';
  }
  var ledger='<h2>Industries by workforce</h2><table class="ledger"><thead><tr><th>Industry</th><th class="num">Workers</th><th>Share</th></tr></thead><tbody>'+rows+'</tbody></table>';
  var tl=Math.round(sim.tradeLvl*10)/10;
  var tradeLine='<p class="hint" style="margin:8px 0 0">Trade reach '+tl+' / 3'+
    (tl<0.7?' — a backwater; peddlers and the odd cart.':tl<1.6?' — regular carts on the road, a seasonal fair.':tl<2.5?' — standing routes by road'+(t.region.hasRiver?' and river':'')+'; factors keep ledgers here.':' — a true entrepôt; goods pass through that were never made here.')+
    (sim.grainRoute?' A standing grain route feeds the town.':'')+'</p>';
  var chips='<div class="twocol" style="margin-top:14px"><div><h2>Exports</h2>'+chipRow(eco.exports)+'</div><div><h2>Imports</h2>'+chipRow(eco.imports,true)+'</div></div>';
  $("doc-economy").innerHTML=head+qual+ledger+tradeLine+chips;
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
  VIEW.k=1;VIEW.tx=0;VIEW.ty=0;SCRUB=1;
  buildHitIndex(t);
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
  animToken++;SCRUB=1;
  paint(current,1);       /* ensure the final frame is on the visible canvas */
  $("mapyear").textContent="AD "+current.presentYear+" · "+fmt(current.sim.pop)+" souls";
  var oc=document.createElement("canvas");oc.width=2000;oc.height=1400;
  var octx=oc.getContext("2d");
  paint(current,1,{ctx:octx,dpr:2,view:{k:1,tx:0,ty:0}});
  if(oc.toBlob)oc.toBlob(function(b){ if(b)download(b,safeName()+".png"); },"image/png");
  else $("mapcanvas").toBlob(function(b){ if(b)download(b,safeName()+".png"); },"image/png");
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
