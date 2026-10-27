/* ================= map model ================= */
function rectCorners(b){
  var c=Math.cos(b.rot||0),s=Math.sin(b.rot||0),hw=b.w/2,hh=b.h/2;
  return [
    {x:b.x+c*hw-s*hh,y:b.y+s*hw+c*hh},{x:b.x-c*hw-s*hh,y:b.y-s*hw+c*hh},
    {x:b.x-c*hw+s*hh,y:b.y-s*hw-c*hh},{x:b.x+c*hw+s*hh,y:b.y+s*hw-c*hh}
  ];
}
function halfDiag(b){return Math.sqrt(b.w*b.w+b.h*b.h)/2;}

function buildMapModel(cfg,region,founding,sim,S,eco,arch,names,people){
  var rng=RNG((cfg.mapSeed&&String(cfg.mapSeed).trim())?cfg.mapSeed:cfg.seed+"|map");
  var W=1000,H=700,pop=sim.pop;
  var archKey=(arch&&arch.key)||"market";
  var model={W:W,H:H,seaSide:"east",arch:{key:archKey,label:(arch&&ARCH[archKey])?ARCH[archKey].label:""},veinDead:!!sim.veinDead};
  /* half of all coast towns face west — coin drawn now so the draw sequence stays stable;
     the whole model is mirrored just before return */
  var mirrorSea=region.hasCoast?rng.chance(0.5):false;

  /* ---- eras: condense popByEra to <=8 map eras ---- */
  var pbe=sim.popByEra.length?sim.popByEra:[{year:PRESENT_YEAR,pop:pop}];
  var nE=Math.min(8,Math.max(3,Math.ceil(pbe.length/4)));
  var eras=[];
  for(var e=0;e<nE;e++){
    var idx=Math.min(pbe.length-1,Math.round((e+1)/nE*(pbe.length-1)));
    eras.push({year:pbe[idx].year,pop:pbe[idx].pop});
  }
  eras[nE-1]={year:PRESENT_YEAR,pop:pop};
  model.eras=eras;
  function eraForYear(y){for(var i=0;i<eras.length;i++)if(y<=eras[i].year)return i;return eras.length-1;}
  function infraYear(k){var f=sim.infra.find(function(x){return x.key===k;});return f?f.year:null;}
  function infraEra(k,fb){var y=infraYear(k);return y!=null?eraForYear(y):fb;}

  /* ---- coast ---- */
  var shore=null,shoreXs=null,coveY=H*0.5,coveDepth=0;
  function shoreAt(y){ if(!shoreXs)return 1e9; var i=clamp(Math.round(y/8),0,shoreXs.length-1); return shoreXs[i]; }
  if(region.hasCoast){
    coveY=H*rng.rf(0.34,0.64);
    coveDepth=((founding.key==="harbor"||archKey==="port")?rng.rf(62,92):rng.rf(28,48));
    var coveW=rng.rf(75,110), base=W*rng.rf(0.73,0.78);
    var ph1=rng.rf(0,6.28),ph2=rng.rf(0,6.28),a1=rng.rf(10,22),a2=rng.rf(5,12);
    shoreXs=[];shore=[];
    for(var y=0;y<=H;y+=8){
      var dy=(y-coveY)/coveW;
      var x=base+a1*Math.sin(y*0.012+ph1)+a2*Math.sin(y*0.031+ph2)-coveDepth*Math.exp(-dy*dy);
      shoreXs.push(x);shore.push({x:x,y:y});
    }
    model.shore=shore;model.coveY=coveY;
  }

  /* ---- center (provisional) ---- */
  var C;
  if(founding.key==="harbor"||archKey==="port")C={x:shoreAt(coveY)-rng.rf(58,78),y:coveY+rng.rf(-14,14)};
  else if(founding.key==="mine")C={x:W*rng.rf(0.32,0.44),y:H*rng.rf(0.3,0.44)};
  else if(founding.key==="defense")C={x:W*rng.rf(0.36,0.5),y:H*rng.rf(0.32,0.48)};
  else C={x:W*rng.rf(0.38,0.52),y:H*rng.rf(0.42,0.58)};
  if(region.hasCoast)C.x=Math.min(C.x,shoreAt(C.y)-70);

  /* ---- river (left -> right, x-monotonic) + canonical crossing ---- */
  var river=null,crossing=null,crossPerp=null,crossTan=null;
  if(region.hasRiver){
    var anchorY=(founding.key==="ford")?C.y:clamp(C.y+rng.rf(-1,1)*rng.rf(46,120),60,H-60);
    var endPt=region.hasCoast?{x:shoreAt(coveY)+6,y:coveY}:{x:W,y:clamp(anchorY+rng.rf(-90,90),50,H-50)};
    if(region.terrain==="estuary"){endPt={x:shoreAt(coveY)+6,y:coveY};}
    var startPt={x:0,y:clamp(anchorY+rng.rf(-110,110),50,H-50)};
    var mid={x:clamp(C.x+(founding.key==="ford"?0:rng.rf(-40,40)),80,W-120),y:anchorY};
    /* y-only midpoint displacement keeps the river single-valued in x, so the
       bank-side math (riverYAt / road clamping) always matches the drawn polyline */
    var rp=[startPt,mid,endPt],rAmp=34;
    for(var rk=0;rk<4;rk++){
      var rb=[rp[0]];
      for(var ri2=0;ri2<rp.length-1;ri2++){
        rb.push({x:(rp[ri2].x+rp[ri2+1].x)/2,y:(rp[ri2].y+rp[ri2+1].y)/2+rng.rf(-rAmp,rAmp)},rp[ri2+1]);
      }
      rp=rb;rAmp*=0.52;
    }
    for(var rm=1;rm<rp.length;rm++)if(rp[rm].x<=rp[rm-1].x)rp[rm].x=rp[rm-1].x+0.6;
    var rw=clamp(11+Math.sqrt(pop)/14,11,22);
    river={pts:rp,w:rw};
    model.river=river;
    /* crossing point = nearest river point to C */
    var bi=0,bd=1e9;
    for(var i2=0;i2<rp.length;i2++){var d2=dist(rp[i2],C);if(d2<bd){bd=d2;bi=i2;}}
    var bp=rp[bi];
    var ta=rp[Math.max(0,bi-1)],tb=rp[Math.min(rp.length-1,bi+1)];
    var tx=tb.x-ta.x,ty=tb.y-ta.y,tl=Math.max(1e-6,Math.sqrt(tx*tx+ty*ty));
    crossTan={x:tx/tl,y:ty/tl};crossPerp={x:-ty/tl,y:tx/tl};
    crossing={x:bp.x,y:bp.y};
    if(founding.key==="ford"){ /* town sits on the bank */
      var below=rng.chance(0.5)?1:-1;
      C={x:bp.x+rng.rf(-8,8),y:bp.y+below*(rw/2+24)};
    }
  }
  function riverYAt(x){
    if(!river)return null;var rp2=river.pts;
    if(x<=rp2[0].x)return rp2[0].y; if(x>=rp2[rp2.length-1].x)return rp2[rp2.length-1].y;
    for(var i=0;i<rp2.length-1;i++)if(x>=rp2[i].x&&x<=rp2[i+1].x){var t=(x-rp2[i].x)/Math.max(1e-6,rp2[i+1].x-rp2[i].x);return rp2[i].y+t*(rp2[i+1].y-rp2[i].y);}
    return rp2[0].y;
  }
  function sideOf(p){var ry=riverYAt(p.x);return ry==null?0:(p.y<ry?-1:1);}
  function distToRiver(p){return river?distToPolyline(p,river.pts):1e9;}
  model.C=C;

  var finalPop=pop;
  var Rmax=clamp(36+Math.sqrt(finalPop)*1.6,55,235);
  var plazaR=(finalPop>=340)?clamp(15+finalPop/1100,15,30):0;
  if(archKey==="capital"&&plazaR)plazaR=Math.min(36,plazaR*1.35);
  model.plazaR=plazaR;

  /* ---- roads (river-sanitized) ---- */
  var roads=[],crossingUsed=false;
  function approachPt(side,d){
    if(!crossing)return null;
    var p1={x:crossing.x+crossPerp.x*d,y:crossing.y+crossPerp.y*d};
    return sideOf(p1)===side?p1:{x:crossing.x-crossPerp.x*d,y:crossing.y-crossPerp.y*d};
  }
  function clampPtsToSide(pts,side,margin,lockFirst,lockLast){
    if(!river)return;
    for(var i=0;i<pts.length;i++){
      if((lockFirst&&i===0)||(lockLast&&i===pts.length-1))continue;
      var ry=riverYAt(pts[i].x),lim=ry+side*(river.w/2+margin);
      if(side<0?pts[i].y>lim:pts[i].y<lim)pts[i].y=lim;
    }
  }
  function enforceSide(pts,side,margin,lockFirst,lockLast){
    /* keep an entire polyline on one bank: densify so no segment can outrun a
       river meander, then clamp vertices AND segment midpoints until stable */
    if(!river||side===0)return;
    for(var i=pts.length-2;i>=0;i--){
      var a=pts[i],b=pts[i+1],d9=dist(a,b),n9=Math.ceil(d9/14);
      for(var k9=n9-1;k9>=1;k9--)pts.splice(i+1,0,{x:a.x+(b.x-a.x)*k9/n9,y:a.y+(b.y-a.y)*k9/n9});
    }
    for(var pass=0;pass<5;pass++){
      var moved=false;
      for(var i2=0;i2<pts.length;i2++){
        if((lockFirst&&i2===0)||(lockLast&&i2===pts.length-1))continue;
        var ry=riverYAt(pts[i2].x);if(ry==null)continue;
        var lim=ry+side*(river.w/2+margin);
        if(side<0?pts[i2].y>lim:pts[i2].y<lim){pts[i2].y=lim;moved=true;}
      }
      var ins=false;
      for(var i3=0;i3<pts.length-1;i3++){
        var mx=(pts[i3].x+pts[i3+1].x)/2,my=(pts[i3].y+pts[i3+1].y)/2;
        var ry2=riverYAt(mx);if(ry2==null)continue;
        var lim2=ry2+side*(river.w/2+margin);
        if(side<0?my>lim2:my<lim2){pts.splice(i3+1,0,{x:mx,y:lim2});ins=true;i3++;}
      }
      if(!moved&&!ins)break;
    }
  }
  function badCross(pts){ /* river-centerline intersections away from the crossing */
    if(!river)return false;
    for(var i=0;i<pts.length-1;i++)for(var j=0;j<river.pts.length-1;j++){
      var hit=segIntersect(pts[i],pts[i+1],river.pts[j],river.pts[j+1]);
      if(hit&&(!crossing||dist(hit,crossing)>16))return {i:i};
    }
    return false;
  }
  function routeRoad(to,kind){
    var pts,sC=sideOf(C),sT=sideOf(to);
    if(river&&sC!==sT&&sC!==0&&sT!==0){
      var a=approachPt(sC,river.w/2+9),b=approachPt(sT,river.w/2+9);
      var p1=subdiv([C,a],2,10,rng);enforceSide(p1,sC,8,false,true);
      var p2=subdiv([b,to],2,16,rng);enforceSide(p2,sT,8,true,false);
      pts=p1.concat(p2);
      crossingUsed=true;
    }else{
      pts=subdiv([C,to],3,20,rng);
      if(river&&sC!==0)enforceSide(pts,sC,8,false,false);
    }
    roads.push({pts:pts,kind:kind||"highway"});
  }
  routeRoad({x:0,y:clamp(C.y+rng.rf(-130,130),40,H-40)});
  routeRoad({x:clamp(C.x+rng.rf(-150,150),60,(region.hasCoast?shoreAt(0)-60:W-40)),y:0});
  routeRoad({x:clamp(C.x+rng.rf(-150,150),60,(region.hasCoast?shoreAt(H)-60:W-40)),y:H});
  if(!region.hasCoast)routeRoad({x:W,y:clamp(C.y+rng.rf(-130,130),40,H-40)});

  /* ---- hills (early: archetype features sit on them) ---- */
  var hillsPt=null,hills=[];
  if(region.relief>=1||archKey==="mining"||archKey==="vintner"){hillsPt={x:W*rng.rf(0.1,0.2),y:H*rng.rf(0.1,0.22)};}
  if(hillsPt){
    var nH=region.relief>=2?rng.ri(3,4):rng.ri(1,2);
    if(archKey==="mining"||archKey==="vintner")nH=Math.max(nH,2);
    for(var h8=0;h8<60&&hills.length<nH;h8++){
      var loose=h8>=24; /* widen the search if the first picks keep landing badly */
      var hc={x:clamp(hillsPt.x+rng.rf(-60,loose?260:110),30,W-200),y:clamp(hillsPt.y+rng.rf(-40,loose?200:110),30,H*0.55)};
      if(inWaterRaw(hc,40)||dist(hc,C)<Rmax*(loose?1.05:1.2))continue;
      if(hills.some(function(hx){return dist(hx,hc)<46;}))continue;
      var rings=[],r8=rng.rf(34,58);
      while(r8>10){rings.push(r8);r8*=rng.rf(0.6,0.72);}
      hills.push({x:hc.x,y:hc.y,rings:rings});
    }
  }
  model.hills=hills;
  function inWaterRaw(p,pad){
    pad=pad||6;
    if(shoreXs&&p.x>shoreAt(p.y)-pad)return true;
    if(river&&distToRiver(p)<river.w/2+pad)return true;
    return false;
  }
  if((S.mine>0.3||founding.key==="mine"||archKey==="mining")&&hillsPt){routeRoad({x:hillsPt.x+rng.rf(-10,30),y:hillsPt.y+rng.rf(0,30)},"mineroad");}
  if(region.hasCoast&&founding.key!=="harbor"&&archKey!=="port"){routeRoad({x:shoreAt(coveY)-14,y:coveY},"highway");}
  if(river&&!crossingUsed){ /* guarantee the river is bridged by some traffic */
    var os=-sideOf(C);
    routeRoad(os<0?{x:clamp(C.x+rng.rf(-120,120),60,W-60),y:0}:{x:clamp(C.x+rng.rf(-120,120),60,W-60),y:H});
  }
  model.roads=roads;

  /* crossing record: a ford from the first era, a bridge once history builds one */
  if(river&&crossingUsed){
    var by=sim.bridge?(yearOfEvent(sim,"bridge")||null):null;
    model.crossing={x:crossing.x,y:crossing.y,angle:Math.atan2(crossTan.y,crossTan.x),w:river.w,
                    fordEra:0,bridgeEra:by!=null?eraForYear(by):null};
  }

  /* ---- placement machinery ---- */
  var CELL=13,hash={};
  function hkey(x,y){return Math.floor(x/CELL)+","+Math.floor(y/CELL);}
  function collides(p,minD){
    var cx=Math.floor(p.x/CELL),cy=Math.floor(p.y/CELL),rr=Math.max(1,Math.ceil(minD/CELL));
    for(var i=-rr;i<=rr;i++)for(var j=-rr;j<=rr;j++){
      var arr=hash[(cx+i)+","+(cy+j)];if(!arr)continue;
      for(var k=0;k<arr.length;k++)if(dist(p,arr[k])<minD)return true;
    }
    return false;
  }
  function addHash(p){var k=hkey(p.x,p.y);(hash[k]||(hash[k]=[])).push({x:p.x,y:p.y});}
  function inWater(p,pad){return inWaterRaw(p,pad);}
  function nearCrossing(p,d){return model.crossing?dist(p,model.crossing)<d:false;}
  function nearestOnRoads(p,kinds){
    var best=null;
    for(var r=0;r<roads.length;r++){
      if(kinds&&kinds.indexOf(roads[r].kind)<0)continue;
      var pts=roads[r].pts;
      for(var i=0;i<pts.length-1;i++){
        var pr=pointSegDist(p,pts[i],pts[i+1]);
        if(!best||pr.d<best.d){best={d:pr.d,pt:pr.pt,a:pts[i],b:pts[i+1],kind:roads[r].kind};}
      }
    }
    return best;
  }
  function distToRoads(p,kinds){var n=nearestOnRoads(p,kinds);return n?n.d:1e9;}
  var ROADHALF={highway:2.5,mineroad:2.1,lane:1.3,track:0.8}; /* half the painter's casing width per kind */
  function roadBlocked(p,half){ /* any road EDGE within `half` of p */
    for(var r9=0;r9<roads.length;r9++){
      var lim=(ROADHALF[roads[r9].kind]||2.5)+half,pts9=roads[r9].pts;
      for(var i9=0;i9<pts9.length-1;i9++)if(pointSegDist(p,pts9[i9],pts9[i9+1]).d<lim)return true;
    }
    return false;
  }
  /* true footprint overlap (SAT over corners, slight inset) — the center-distance hash
     lets rotated rects clip corners; this catches what it misses */
  var bHash={};
  function bhKey(x,y){return Math.floor(x/26)+","+Math.floor(y/26);}
  function addBHash(b){var k9=bhKey(b.x,b.y);(bHash[k9]||(bHash[k9]=[])).push(b);}
  function obbHit(A,B){
    var ca=rectCorners({x:A.x,y:A.y,w:Math.max(1,A.w-1.1),h:Math.max(1,A.h-1.1),rot:A.rot});
    var cb=rectCorners({x:B.x,y:B.y,w:Math.max(1,B.w-1.1),h:Math.max(1,B.h-1.1),rot:B.rot});
    var polys=[ca,cb];
    for(var p9=0;p9<2;p9++){var poly=polys[p9];
      for(var i8=0;i8<4;i8++){
        var p1=poly[i8],p2=poly[(i8+1)%4],ax=p1.y-p2.y,ay=p2.x-p1.x;
        var minA=1e9,maxA=-1e9,minB=1e9,maxB=-1e9,d8,q8;
        for(q8=0;q8<4;q8++){d8=ca[q8].x*ax+ca[q8].y*ay;if(d8<minA)minA=d8;if(d8>maxA)maxA=d8;}
        for(q8=0;q8<4;q8++){d8=cb[q8].x*ax+cb[q8].y*ay;if(d8<minB)minB=d8;if(d8>maxB)maxB=d8;}
        if(maxA<minB||maxB<minA)return false;
      }
    }
    return true;
  }
  function overlapsBuilding(cand){
    var cx9=Math.floor(cand.x/26),cy9=Math.floor(cand.y/26);
    for(var i7=-1;i7<=1;i7++)for(var j7=-1;j7<=1;j7++){
      var arr=bHash[(cx9+i7)+","+(cy9+j7)];if(!arr)continue;
      for(var k7=0;k7<arr.length;k7++)if(obbHit(cand,arr[k7]))return true;
    }
    return false;
  }
  function laneTooClose(sp){ /* size-aware lane clearance: deep houses need more room than the fixed radius gives */
    var cx8=Math.floor(sp.x/26),cy8=Math.floor(sp.y/26);
    for(var i6=-1;i6<=1;i6++)for(var j6=-1;j6<=1;j6++){
      var arr=bHash[(cx8+i6)+","+(cy8+j6)];if(!arr)continue;
      for(var k6=0;k6<arr.length;k6++){var b6=arr[k6];if(dist(sp,b6)<b6.h/2+2.2)return true;}
    }
    return false;
  }

  /* ---- town order: how planned the streets are (0 grown … 1 surveyed).
     Explicit via cfg.plan; else emergent from government, archetype, and youth —
     planted towns are surveyed, old organic ones accreted. ---- */
  var planV={grown:0.18,half:0.5,surveyed:0.85}[cfg.plan];
  var ORDER_GOV={crown:0.58,charter:0.52,council:0.46,temple:0.4,lord:0.3};
  var townAge=PRESENT_YEAR-sim.founded;
  var orderV=planV!=null?planV:clamp(
    (ORDER_GOV[sim.government]||0.32)
    +(archKey==="capital"||archKey==="fortress"?0.14:(archKey==="port"||archKey==="scholar")?0.06:0)
    +(townAge<220?0.12:townAge>520?-0.07:0)
    +rng.rf(-0.08,0.08),0.05,0.92);
  model.order=Math.round(orderV*100)/100;

  /* ---- planned grid (surveyed towns): streets laid out before the first house ---- */
  if(orderV>=0.55){
    var nh=nearestOnRoads(C,["highway"]);
    var axA=nh?Math.atan2(nh.b.y-nh.a.y,nh.b.x-nh.a.x):rng.rf(0,3.14);
    var nPar=orderV>0.7?4:3,nCross=orderV>0.7?3:2;
    var gsp=plazaR?Math.max(26,plazaR*0.85):30;
    function gridStreet(cx,cy,ang,maxL){
      function walk(dir){
        var out=[],x=cx,y=cy,L=0;
        while(L<maxL){
          x+=Math.cos(ang)*6*dir;y+=Math.sin(ang)*6*dir;L+=6;
          if(x<20||x>W-20||y<20||y>H-20)break;
          if(inWater({x:x,y:y},7))break; /* streets stop at the bank — the crossing stays canonical */
          out.push({x:x,y:y});
        }
        return out;
      }
      var pts=walk(-1).reverse().concat([{x:cx,y:cy}],walk(1));
      if(pts.length>=5)roads.push({pts:pts,kind:"lane"});
    }
    for(var gi=0;gi<nPar;gi++){
      var goff=(gi-(nPar-1)/2)*gsp;
      gridStreet(C.x+Math.cos(axA+1.5708)*goff,C.y+Math.sin(axA+1.5708)*goff,axA,Rmax*0.78);
    }
    for(var gj=0;gj<nCross;gj++){
      var goff2=(gj-(nCross-1)/2)*gsp*1.25;
      gridStreet(C.x+Math.cos(axA)*goff2,C.y+Math.sin(axA)*goff2,axA+1.5708,Rmax*0.6);
    }
  }

  /* ---- reserved zones for archetype complexes (picked before houses) ---- */
  var reserved=[];
  function overlapsReserved(p,r){
    for(var i=0;i<reserved.length;i++)if(dist(p,reserved[i])<reserved[i].r+r+8)return true;
    return false;
  }
  function reserve(kind,r,inWall,picker,tries){
    tries=tries||40;
    while(tries-->0){
      var p=picker();
      if(p.x<r+14||p.x>W-r-14||p.y<r+14||p.y>H-r-14)continue;
      if(inWater(p,r*0.7))continue;
      if(river&&sideOf(p)!==sideOf(C))continue;
      if(model.crossing&&dist(p,model.crossing)<r+26)continue;
      if(plazaR&&dist(p,C)<plazaR+r*0.7)continue;
      if(overlapsReserved(p,r))continue;
      var z={x:p.x,y:p.y,r:r,kind:kind,inWall:inWall};
      reserved.push(z);return z;
    }
    return null;
  }
  function dirAwayFromSea(){
    var a=rng.rf(0,6.2832);
    if(region.hasCoast)a=Math.PI+rng.rf(-1.1,1.1); /* roughly westward */
    return a;
  }
  var zPalace=null,zParade=null,zAbbey=null,zCollege=null,zCaravan=null,zFair=null;
  if(infraYear("palace")!=null)zPalace=reserve("palace",42,true,function(){var a=dirAwayFromSea();var d=rng.rf(58,92);return {x:C.x+Math.cos(a)*d,y:C.y+Math.sin(a)*d};});
  if(infraYear("garrison")!=null||archKey==="fortress")zParade=reserve("parade",26,true,function(){
    var base=zPalace||C,a=rng.rf(0,6.2832),d=rng.rf(46,80);
    return {x:base.x+Math.cos(a)*d,y:base.y+Math.sin(a)*d};
  });
  if(infraYear("abbey")!=null)zAbbey=reserve("abbey",46,false,function(){var a=dirAwayFromSea()+rng.rf(-0.9,0.9);var d=Rmax*rng.rf(0.55,0.85);return {x:C.x+Math.cos(a)*d,y:C.y+Math.sin(a)*d};});
  if(zAbbey&&dist(zAbbey,C)<Rmax*0.78)zAbbey.inWall=true;
  if(infraYear("college")!=null)zCollege=reserve("college",36,true,function(){var a=rng.rf(0,6.2832),d=Rmax*rng.rf(0.35,0.62);return {x:C.x+Math.cos(a)*d,y:C.y+Math.sin(a)*d};});
  if(infraYear("caravanserai")!=null)zCaravan=reserve("caravanserai",26,false,function(){
    var hw=roads[rng.ri(0,Math.min(2,roads.length-1))];
    var k0=0;while(k0<hw.pts.length-1&&dist(hw.pts[k0],C)<Rmax+56)k0++;
    var p=hw.pts[Math.min(hw.pts.length-1,k0+rng.ri(0,4))],n=nearestOnRoads(p,["highway"]);
    var dx=n?n.b.x-n.a.x:1,dy=n?n.b.y-n.a.y:0,dl=Math.max(1,Math.sqrt(dx*dx+dy*dy));
    var sg=rng.chance(0.5)?1:-1;
    return {x:p.x+(-dy/dl)*30*sg,y:p.y+(dx/dl)*30*sg};
  });
  if(infraYear("fairground")!=null)zFair=reserve("fairground",30,false,function(){var a=rng.rf(0,6.2832),d=Rmax+30+rng.rf(44,96);return {x:C.x+Math.cos(a)*d,y:C.y+Math.sin(a)*d};});

  /* ---- walls helpers ---- */
  var buildings=[],walls=null,citadel=null,gateAnchors=[];
  /* ---- districts: the wards of a larger town (none below ~5k souls).
     Nearest-seed assignment; wards bias building size & kind, tint roofs, and label the plat. */
  var districts=[];
  if(finalPop>=5000){
    function ward(key,nm,x,y,tone){
      var p={x:clamp(x,30,W-30),y:clamp(y,30,H-30)};
      for(var w9=0;w9<30&&inWater(p,18);w9++){p={x:p.x+(C.x-p.x)*0.15,y:p.y+(C.y-p.y)*0.15};} /* wards stay on dry land */
      districts.push({key:key,nm:nm,x:p.x,y:p.y,tone:tone});
    }
    var wA=rng.rf(0,6.2832);
    ward("market",rng.pick(["The Market Ward","Cheap Ward","The Wide Ward"]),C.x,C.y,"#c0a36a");
    ward("wealth",rng.pick(["Goldgate","Silverrow","The High Ward"]),C.x+Math.cos(wA)*Rmax*0.34,C.y+Math.sin(wA)*Rmax*0.34,"#c9a653");
    var cA=river?rng.rf(-0.6,0.6):wA+3.1416+rng.rf(-0.5,0.5); /* crafts drift downstream (+x) when there's a river */
    ward("craft",rng.pick(["Dyers' Row","The Shambles","Tanners' End","Smithswalk"]),C.x+Math.cos(cA)*Rmax*0.55,C.y+Math.sin(cA)*Rmax*0.55,"#9c5a33");
    var pA=wA+3.1416+rng.rf(-0.7,0.7);
    ward("poor",rng.pick(["The Warrens","Mudlanes","Raggedrow"]),C.x+Math.cos(pA)*Rmax*0.78,C.y+Math.sin(pA)*Rmax*0.78,"#8d7c60");
    if(finalPop>=12000){
      var p2=pA+rng.rf(1.5,2.6);
      ward("poor",rng.pick(["Beggars' Furrow","The Tangles","Low Fields"]),C.x+Math.cos(p2)*Rmax*0.82,C.y+Math.sin(p2)*Rmax*0.82,"#8d7c60");
    }
    if(archKey==="port"&&shoreXs)ward("harbor",rng.pick(["The Quayside","Saltrow","Harborside"]),shoreAt(C.y)-40,C.y,"#7d6f56");
    if(archKey==="mining"&&hillsPt)ward("miners",rng.pick(["Delvers' Ward","Spoilside"]),C.x+(hillsPt.x-C.x)*0.5,C.y+(hillsPt.y-C.y)*0.5,"#8a6f51");
    if(archKey==="scholar"&&zCollege)ward("scholars","Scholars' Close",zCollege.x,zCollege.y,"#b3995c");
    if(archKey==="religious"&&zAbbey)ward("abbeyside","Abbeyside",zAbbey.x,zAbbey.y,"#b8a06b");
  }
  model.districts=districts;
  function districtAt(p){
    if(!districts.length)return -1;
    var bi=-1,bd=1e9;
    for(var i=0;i<districts.length;i++){var d9=dist(p,districts[i]);if(d9<bd){bd=d9;bi=i;}}
    return bi;
  }

  var wallYear=sim.walls?sim.walls.year:null,wallPop=null;
  function wallRingsClosed(){
    var out=[];
    if(walls)out.push(walls.poly.concat([walls.poly[0]]));
    if(citadel)out.push(citadel.poly.concat([citadel.poly[0]]));
    return out;
  }
  function nearWall(p,clr){
    var rings=wallRingsClosed();
    for(var i=0;i<rings.length;i++)if(distToPolyline(p,rings[i])<clr)return true;
    return false;
  }
  function wallBlocks(pos,hd,pressure){ /* true => reject this footprint */
    if(!walls)return false;
    if(nearWall(pos,hd+4))return true;
    for(var g=0;g<gateAnchors.length;g++)if(dist(pos,gateAnchors[g])<13)return true;
    if(citadel&&pointInPoly(pos,citadel.poly))return true;
    var inside=pointInPoly(pos,walls.poly);
    if(!inside){
      /* suburbs: gates throw longer shadows as the town bursts its seams (pressure =
         current pop / pop when the wall rose) — faubourgs sprawl along the approaches */
      var pr=Math.min(3.5,Math.max(1,pressure||1));
      var reach=64*pr,pAccept=Math.min(0.85,0.3+0.18*(pr-1));
      var nearGate=false;
      for(var g2=0;g2<gateAnchors.length;g2++)if(dist(pos,gateAnchors[g2])<reach){nearGate=true;break;}
      var harborStrip=region.hasCoast&&(shoreAt(pos.y)-pos.x)<58;
      if(!((nearGate&&rng.chance(pAccept))||(harborStrip&&rng.chance(0.5))))return true;
    }
    return false;
  }

  var nBld=clamp(Math.round(finalPop/7),8,1500);

  for(var e2=0;e2<eras.length;e2++){
    var popE=eras[e2].pop;
    var targetN=clamp(Math.round(popE/finalPop*nBld),Math.min(6,nBld),nBld);
    var Re=Math.max(26,Rmax*Math.sqrt(popE/finalPop));
    /* lanes appear as the town grows — sprouting faster when growth outpaces road frontage,
       and off other lanes in later eras, so big towns can actually fill their target */
    var roadCap=5+Math.min(26,Math.floor(finalPop/550));
    if(e2>=1&&popE>320&&roads.length<roadCap&&buildings.length>10){
      var deficit=Math.max(0,targetN-buildings.length);
      var nl=Math.min(roadCap-roads.length,rng.ri(1,2)+Math.floor(deficit/90));
      var laneKinds=e2>=2?["highway","mineroad","lane"]:["highway","mineroad"];
      var laneLen=1+Math.min(0.8,finalPop/15000);
      var LANE_ROTS=[0,0.38,-0.38,0.76,-0.76,1.15,-1.15];
      for(var L=0;L<nl;L++){
        var bb=buildings[rng.ri(0,buildings.length-1)];
        var nr0=nearestOnRoads(bb,laneKinds);
        if(nr0&&nr0.d<90){
          var baseAng=Math.atan2(bb.y-nr0.pt.y,bb.x-nr0.pt.x);
          var reach=nr0.d+rng.rf(35,85)*laneLen;
          /* lanes may not cut through standing buildings: swing the bearing until the path is clear.
             clearance is walked on the FINAL jittered polyline, not the straight pre-image */
          for(var lr=0;lr<LANE_ROTS.length;lr++){
            var a0=baseAng+LANE_ROTS[lr];
            var endp={x:nr0.pt.x+Math.cos(a0)*reach,y:nr0.pt.y+Math.sin(a0)*reach};
            if(inWater(endp,4)||(river&&sideOf(endp)!==sideOf(nr0.pt)))continue;
            var lpts=subdiv([nr0.pt,endp],1,4,rng);
            if(badCross(lpts))continue;
            var clear=true,walked=0;
            for(var si=0;si<lpts.length-1&&clear;si++){
              var segL=dist(lpts[si],lpts[si+1]),nst=Math.max(1,Math.ceil(segL/3));
              for(var st=1;st<=nst;st++){
                var sp9={x:lpts[si].x+(lpts[si+1].x-lpts[si].x)*st/nst,y:lpts[si].y+(lpts[si+1].y-lpts[si].y)*st/nst};
                /* tighter at the junction mouth (may squeeze past row-1 flanks, not through them) */
                if(collides(sp9,(walked+st*segL/nst)<14?4.7:5.8)||laneTooClose(sp9)){clear=false;break;}
              }
              walked+=segL;
            }
            if(!clear)continue;
            roads.push({pts:lpts,kind:"lane"});
            break;
          }
        }
      }
    }
    var attemptsBudget=(targetN-buildings.length)*(finalPop>20000?22:16);
    while(buildings.length<targetN&&attemptsBudget-->0){
      var ang=rng.rf(0,6.2832),rad=Math.min(Re*1.3,Math.abs(rng.gauss(0,Re*0.55)));
      var p={x:C.x+Math.cos(ang)*rad,y:C.y+Math.sin(ang)*rad};
      var nr=nearestOnRoads(p);
      if(!nr||nr.d>(e2<2?62:95))continue;
      var rdx=nr.b.x-nr.a.x,rdy=nr.b.y-nr.a.y,rl=Math.max(1e-6,Math.sqrt(rdx*rdx+rdy*rdy));
      rdx/=rl;rdy/=rl;
      var sideSign=((p.x-nr.pt.x)*(-rdy)+(p.y-nr.pt.y)*rdx)>=0?1:-1;
      var row=rng.wpick([{v:1,w:5},{v:2,w:2.6},{v:3,w:1}]);
      var di=districtAt(p),dk=di>=0?districts[di].key:null;
      var sizeMul=dk==="wealth"?1.18:dk==="poor"?0.84:1;
      var ordTight=orderV>=0.55?0.5:1; /* surveyed towns build in straighter rows */
      var bw=rng.rf(6,11)*sizeMul,bh=rng.rf(5,9)*sizeMul; /* size first: row offset depends on depth */
      var rh0=ROADHALF[nr.kind]||2.5;
      var off=(rh0+bh/2+2.0+(row-1)*11+rng.rf(-1.2,1.2)*ordTight)*sideSign;
      var pos={x:nr.pt.x+(-rdy)*off+rdx*rng.rf(-7,7),y:nr.pt.y+rdx*off+rdy*rng.rf(-7,7)};
      if(pos.x<14||pos.x>W-14||pos.y<14||pos.y>H-14)continue;
      if(inWater(pos,7))continue;
      if(nearCrossing(pos,river?river.w/2+15:0))continue;
      if(plazaR&&dist(pos,C)<plazaR+6)continue;
      if(overlapsReserved(pos,6))continue;
      if(collides(pos,8.6))continue;
      if(roadBlocked(pos,bh/2+0.6))continue; /* clear of EVERY road's edge, not just its own */
      var cand={x:pos.x,y:pos.y,w:bw,h:bh,rot:Math.atan2(rdy,rdx)+rng.rf(-0.07,0.07)*ordTight};
      if(overlapsBuilding(cand))continue;
      if(wallBlocks(pos,Math.sqrt(bw*bw+bh*bh)/2,wallPop?popE/wallPop:1))continue;
      var craftP=dk==="craft"?0.5:(plazaR&&dist(pos,C)<plazaR+44)?0.3:0.06;
      cand.kind=rng.chance(craftP)?"craft":"house";
      cand.era=e2;
      if(di>=0)cand.d=di;
      buildings.push(cand);
      addHash(pos);addBHash(cand);
    }
    /* raise walls at the right era — hull over building CORNERS + protected zones */
    if(wallYear!=null&&!walls&&eras[e2].year>=wallYear&&buildings.length>=8){
      var hullPts=[];
      buildings.forEach(function(b){rectCorners(b).forEach(function(c){hullPts.push(c);});});
      reserved.forEach(function(z){
        if(!z.inWall)return;
        for(var a5=0;a5<8;a5++)hullPts.push({x:z.x+Math.cos(a5*0.785)*z.r,y:z.y+Math.sin(a5*0.785)*z.r});
      });
      var hull=convexHull(hullPts);
      var G={x:0,y:0};hull.forEach(function(h){G.x+=h.x;G.y+=h.y;});G.x/=hull.length;G.y/=hull.length;
      var ex=hull.map(function(h){var d3=Math.max(1,dist(h,G));var k3=(d3+20)/d3;return {x:G.x+(h.x-G.x)*k3,y:G.y+(h.y-G.y)*k3};});
      var poly=[];
      for(var i3=0;i3<ex.length;i3++){
        var a3=ex[i3],b3=ex[(i3+1)%ex.length];
        poly.push(a3);
        if(dist(a3,b3)>46){
          var m3={x:(a3.x+b3.x)/2,y:(a3.y+b3.y)/2};
          var dm=Math.max(1,dist(m3,G));
          poly.push({x:G.x+(m3.x-G.x)*((dm+rng.rf(5,10))/dm),y:G.y+(m3.y-G.y)*((dm+5)/dm)});
        }
      }
      poly=poly.map(function(pt){return {x:clamp(pt.x,12,(shoreXs?shoreAt(pt.y)-6:W-12)),y:clamp(pt.y,12,H-12)};});
      /* towers + gates */
      var towers=[],per=0,step=(archKey==="capital"?62:86);
      for(var i4=0;i4<poly.length;i4++){
        var a4=poly[i4],b4=poly[(i4+1)%poly.length],segL=dist(a4,b4);
        while(per+step<segL){per+=step;var t4=per/segL;towers.push({x:a4.x+(b4.x-a4.x)*t4,y:a4.y+(b4.y-a4.y)*t4});}
        per=Math.max(0,per-segL);
        towers.push(a4);
      }
      var gates=[];
      roads.forEach(function(rd){
        if(rd.kind==="lane")return;
        for(var i5=0;i5<rd.pts.length-1;i5++){
          for(var j5=0;j5<poly.length;j5++){
            var hit=segIntersect(rd.pts[i5],rd.pts[i5+1],poly[j5],poly[(j5+1)%poly.length]);
            if(hit){gates.push(hit);return;}
          }
        }
      });
      walls={poly:poly,towers:towers,gates:gates,era:e2};
      wallPop=Math.max(1,popE);
      gateAnchors=gates;
      model.walls=walls;
      /* drop any building that now straddles or crowds the new wall line */
      buildings=buildings.filter(function(b){
        if(nearWall(b,halfDiag(b)+3))return false;
        for(var g6=0;g6<gates.length;g6++)if(dist(b,gates[g6])<12)return false;
        return true;
      });
    }
  }

  /* ---- landmarks ---- */
  var lm=[];
  function lmAdd(o){lm.push(o);addHash(o);return o;}
  function lmOK(p,w2,h2,opts){
    opts=opts||{};
    var hd=Math.sqrt(w2*w2+h2*h2)/2;
    if(p.x<16||p.x>W-16||p.y<16||p.y>H-16)return false;
    if(inWater(p,opts.waterPad!=null?opts.waterPad:8))return false;
    if(!opts.skipCross&&nearCrossing(p,(river?river.w/2:0)+hd+12))return false;
    if(!opts.skipReserved&&overlapsReserved(p,hd))return false;
    if(collides(p,hd+4))return false;
    if(!opts.skipRoads&&roadBlocked(p,Math.min(hd,7)*0.8+0.4))return false;
    if(!opts.skipWall&&nearWall(p,hd+5))return false;
    return true;
  }
  function placeNear(cx,cy,minR,maxR,w2,h2,kind,era3,tries,opts){
    tries=tries||34;
    while(tries-->0){
      var ang=rng.rf(0,6.2832),r5=rng.rf(minR,maxR);
      var p5={x:cx+Math.cos(ang)*r5,y:cy+Math.sin(ang)*r5};
      if(!lmOK(p5,w2,h2,opts))continue;
      return lmAdd({kind:kind,x:p5.x,y:p5.y,w:w2,h:h2,rot:rng.rf(-0.1,0.1),era:era3});
    }
    return null;
  }
  function razeBuildingsAt(p,hd){ /* clear houses for a civic build; hash keeps ghosts, harmless */
    for(var rb9=buildings.length-1;rb9>=0;rb9--){
      var b9=buildings[rb9],br=Math.sqrt(b9.w*b9.w+b9.h*b9.h)/2;
      if(dist(p,b9)<hd+br+3)buildings.splice(rb9,1);
    }
  }
  function placeCivic(cx,cy,minR,maxR,w2,h2,kind,era3,opts){
    /* essential civic landmarks must land: retry wider, then displace houses (never
       landmarks, walls, water, or reserved ground) — the crown demolishes, it does not defer */
    var got=placeNear(cx,cy,minR,maxR,w2,h2,kind,era3,40,opts);
    if(got)return got;
    got=placeNear(cx,cy,minR,maxR*1.7,w2,h2,kind,era3,46,opts);
    if(got)return got;
    var hd=Math.sqrt(w2*w2+h2*h2)/2,tries=60;
    while(tries-->0){
      var ang=rng.rf(0,6.2832),r5=rng.rf(minR,maxR*1.4);
      var p5={x:cx+Math.cos(ang)*r5,y:cy+Math.sin(ang)*r5};
      if(p5.x<16||p5.x>W-16||p5.y<16||p5.y>H-16)continue;
      if(inWater(p5,8))continue;
      if(nearCrossing(p5,(river?river.w/2:0)+hd+12))continue;
      if(!(opts&&opts.skipReserved)&&overlapsReserved(p5,hd))continue;
      if(roadBlocked(p5,Math.min(hd,7)*0.8+0.4))continue;
      if(nearWall(p5,hd+5))continue;
      var lmHit=false;
      for(var li9=0;li9<lm.length;li9++){
        var l9=lm[li9],lr=Math.sqrt(l9.w*l9.w+l9.h*l9.h)/2;
        if(dist(p5,l9)<hd+lr+4){lmHit=true;break;}
      }
      if(lmHit)continue;
      razeBuildingsAt(p5,hd);
      return lmAdd({kind:kind,x:p5.x,y:p5.y,w:w2,h:h2,rot:rng.rf(-0.1,0.1),era:era3});
    }
    return null;
  }
  var yr,saintParish=rng.pick(SAINTS);
  if((yr=infraYear("church"))!=null){
    var ch=placeCivic(C.x,C.y,plazaR+12,plazaR+46,14,10,"church",eraForYear(yr));
    if(ch)ch.nm="St. "+saintParish+"'s Church";
  }
  if((yr=infraYear("temple"))!=null){
    var tpl=placeCivic(C.x,C.y,plazaR+16,plazaR+60,19,13,"temple",eraForYear(yr));
    if(tpl)tpl.nm="The Great Temple";
  }
  if((yr=infraYear("keep"))!=null){
    var ke=eraForYear(yr),kp=null,kt=30;
    while(kt-->0&&!kp){
      var kdir=hillsPt?Math.atan2(hillsPt.y-C.y,hillsPt.x-C.x)+rng.rf(-0.5,0.5):rng.rf(0,6.2832);
      var kc={x:clamp(C.x+Math.cos(kdir)*rng.rf(60,105),20,W-20),y:clamp(C.y+Math.sin(kdir)*rng.rf(60,105),20,H-20)};
      if(lmOK(kc,15,15,{waterPad:10}))kp=kc;
    }
    if(kp)lmAdd({kind:"keep",x:kp.x,y:kp.y,w:15,h:15,rot:rng.rf(-0.15,0.15),era:ke,nm:"The Keep"});
    else{var ke2=placeCivic(C.x,C.y,60,105,15,15,"keep",ke,{waterPad:10});if(ke2)ke2.nm="The Keep";}
  }
  if((yr=infraYear("guildhall"))!=null){
    var gh=placeCivic(C.x,C.y,plazaR+10,plazaR+40,15,10,"guildhall",eraForYear(yr));
    if(gh)gh.nm="The Guildhall";
  }
  if((yr=infraYear("mill"))!=null){
    if(river){
      var nMills=Math.min(2,Math.max(1,Math.round(S.mill*2)));
      for(var m5=0;m5<nMills;m5++){
        var rp5=river.pts[rng.ri(2,river.pts.length-3)];
        var mside=rng.chance(0.5)?-1:1;
        var mp={x:rp5.x,y:rp5.y+mside*(river.w/2+6)};
        if(dist(rp5,C)<200&&lmOK(mp,9,7,{waterPad:2}))lmAdd({kind:"mill",x:mp.x,y:mp.y,w:9,h:7,rot:0,era:eraForYear(yr),nm:"The Watermill"});
      }
    }else{
      var wm=placeNear(C.x,C.y,Rmax*0.7,Rmax*1.1,8,8,"windmill",eraForYear(yr));
      if(wm)wm.nm="The Windmill";
    }
  }
  if(occHas(eco.occupations,"Tanners")&&river){
    var downs=river.pts.filter(function(p6){return p6.x>C.x+60&&dist(p6,C)<240;});
    for(var td=0;td<14&&downs.length;td++){
      var tp=downs[rng.ri(0,downs.length-1)],tpp={x:tp.x,y:tp.y+river.w/2+8};
      if(lmOK(tpp,8,6,{waterPad:2})){lmAdd({kind:"tannery",x:tpp.x,y:tpp.y,w:8,h:6,rot:0,era:Math.min(eras.length-1,1),nm:"The Tannery"});break;}
    }
  }
  if(S.smith>0.42){
    var mr=roads.find(function(r6){return r6.kind==="mineroad";});
    if(mr){var sp=mr.pts[Math.floor(mr.pts.length*0.4)],spp={x:sp.x,y:sp.y+9};
      if(lmOK(spp,9,7,{}))lmAdd({kind:"smelter",x:spp.x,y:spp.y,w:9,h:7,rot:0,era:Math.min(eras.length-1,1),nm:"The Smelter"});}
  }

  /* ---- archetype complexes ---- */
  var saintAbbey=rng.pick(SAINTS.filter(function(s){return s!==saintParish;}));
  if(archKey==="mining"&&hills.length){
    var adits=[];
    var nA=1+(infraYear("deepworks")!=null?2:(infraYear("orerow")!=null?1:0))+(S.mine>0.85?1:0);
    nA=clamp(nA,1,4);
    var aTries=nA*10;
    while(adits.length<nA&&aTries-->0){
      var hh=hills[rng.ri(0,hills.length-1)];
      var aAng=Math.atan2(C.y-hh.y,C.x-hh.x)+rng.rf(-0.8,0.8);
      var ap={x:hh.x+Math.cos(aAng)*hh.rings[0]*rng.rf(0.5,0.92),y:hh.y+Math.sin(aAng)*hh.rings[0]*rng.rf(0.5,0.92)};
      var tooClose=adits.some(function(q){return dist(q,ap)<22;});
      if(tooClose||inWater(ap,6))continue;
      adits.push({x:ap.x,y:ap.y,rot:aAng,era:adits.length===0?0:infraEra(adits.length<2?"orerow":"deepworks",1)});
      addHash(ap);
    }
    model.adits=adits;
    if((yr=infraYear("orerow"))!=null){
      var mrd=roads.find(function(r9){return r9.kind==="mineroad";});
      if(mrd){
        var oe=eraForYear(yr),placedRow=0;
        for(var oi=0;oi<10&&placedRow<5;oi++){
          var ot=0.55+oi*0.04,opt=mrd.pts[Math.floor(mrd.pts.length*Math.min(0.95,ot))];
          var on=nearestOnRoads(opt,["mineroad"]);if(!on)break;
          var odx=on.b.x-on.a.x,ody=on.b.y-on.a.y,odl=Math.max(1,Math.sqrt(odx*odx+ody*ody));
          var osg=(oi%2)?1:-1;
          var op={x:opt.x+(-ody/odl)*9*osg,y:opt.y+(odx/odl)*9*osg};
          if(op.x<14||op.x>W-14||op.y<14||op.y>H-14)continue;
          if(inWater(op,6)||collides(op,8)||nearWall(op,7))continue;
          if(roadBlocked(op,3.4))continue; /* a crossing lane may run through the row corridor */
          var rowB={x:op.x,y:op.y,w:rng.rf(5,7),h:rng.rf(4,5.5),rot:Math.atan2(ody,odx),kind:"house",era:oe};
          buildings.push(rowB);
          addHash(op);addBHash(rowB);placedRow++;
        }
      }
    }
  }
  if(archKey==="port"){
    if((yr=infraYear("quay"))!=null){
      var qL=clamp(60+finalPop/40,60,150);
      model.quay={y1:coveY-qL/2,y2:coveY+qL/2,era:eraForYear(yr)};
    }
    if((yr=infraYear("customs"))!=null){
      for(var ct=0;ct<14;ct++){
        var cy2=coveY+rng.rf(-22,22),cp={x:shoreAt(cy2)-rng.rf(18,34),y:cy2};
        if(lmOK(cp,12,9,{})){lmAdd({kind:"customs",x:cp.x,y:cp.y,w:12,h:9,rot:0,era:eraForYear(yr),nm:"The Customs House"});break;}
      }
    }
    if((yr=infraYear("lighthouse"))!=null){
      var lsg=rng.chance(0.5)?-1:1,ly=clamp(coveY+lsg*rng.rf(180,260),30,H-30);
      if(Math.abs(ly-coveY)<120)ly=clamp(coveY-lsg*rng.rf(180,260),30,H-30);
      lm.push({kind:"lighthouse",x:shoreAt(ly)-2,y:ly,w:6,h:6,rot:0,era:eraForYear(yr),nm:"The Harbor Light"});
    }
    if(finalPop>1200){
      for(var rwk=0;rwk<10;rwk++){
        var ry2=coveY+(rng.chance(0.5)?-1:1)*rng.rf(60,110);
        var rx2=shoreAt(ry2)-rng.rf(30,44);
        var rp9={x:rx2,y:ry2};
        if(lmOK(rp9,34,4,{})){lmAdd({kind:"ropewalk",x:rp9.x,y:rp9.y,w:34,h:4,rot:rng.rf(-0.18,0.18)+Math.PI/2,era:Math.min(eras.length-1,2),nm:"The Ropewalk"});break;}
      }
    }
    if(S.ships>0.42){
      var sy=coveY+(rng.chance(0.5)?-1:1)*rng.rf(26,46);
      lm.push({kind:"slipway",x:shoreAt(sy)-4,y:sy,w:16,h:8,rot:0,era:infraEra("quay",1),nm:"The Slipway"});
    }
  }
  if(archKey==="religious"&&zAbbey){
    var ae=infraEra("abbey",0),phi=rng.rf(-0.25,0.25);
    var abb=lmAdd({kind:"abbey",x:zAbbey.x,y:zAbbey.y-6,w:24,h:13,rot:phi,era:ae,nm:"The Abbey of St. "+saintAbbey,bell:infraYear("belltower")!=null});
    lmAdd({kind:"cloister",x:zAbbey.x+Math.sin(phi)*4,y:zAbbey.y+13,w:16,h:16,rot:phi,era:ae});
    /* precinct wall */
    var pre=[],nP2=10;
    for(var pi2=0;pi2<nP2;pi2++){
      var pa=pi2/nP2*6.2832,pr=zAbbey.r-5+rng.rf(-2,2);
      pre.push({x:zAbbey.x+Math.cos(pa)*pr,y:zAbbey.y+Math.sin(pa)*pr});
    }
    model.precinct={poly:pre,era:ae};
    if((yr=infraYear("hospice"))!=null){
      var hAng=Math.atan2(C.y-zAbbey.y,C.x-zAbbey.x);
      lmAdd({kind:"hospice",x:zAbbey.x+Math.cos(hAng)*(zAbbey.r-12),y:zAbbey.y+Math.sin(hAng)*(zAbbey.r-12),w:12,h:8,rot:hAng,era:eraForYear(yr),nm:"The Pilgrims' Hospice"});
    }
    var gAng=Math.atan2(zAbbey.y-C.y,zAbbey.x-C.x);
    for(var gt=0;gt<14;gt++){
      var gvp={x:zAbbey.x+Math.cos(gAng)*(zAbbey.r+18),y:zAbbey.y+Math.sin(gAng)*(zAbbey.r+18)};
      if(lmOK(gvp,30,22,{skipReserved:true})){
        var gv2=lmAdd({kind:"graveyard",x:gvp.x,y:gvp.y,w:30,h:22,rot:0,era:ae,nm:"The Abbey Graveyard"});
        gv2.crosses=[];var ncr2=rng.ri(9,14);
        for(var c7=0;c7<ncr2;c7++)gv2.crosses.push({x:gv2.x+rng.rf(-12,12),y:gv2.y+rng.rf(-8,8)});
        break;
      }
      gAng+=0.5;
    }
    /* waymark crosses along the pilgrim road */
    var wmRoad=roads[0],wms=[];
    for(var wmi=1;wmi<=3;wmi++){
      var wt=Math.min(0.92,(Rmax*1.2+wmi*110)/900);
      var wp2=wmRoad.pts[Math.floor(wmRoad.pts.length*wt)];
      if(wp2&&!inWater(wp2,4)&&dist(wp2,C)>Rmax*1.05)wms.push({x:wp2.x+rng.rf(-4,4),y:wp2.y-6});
    }
    model.waymarks=wms;
  }
  if(archKey==="capital"&&zPalace){
    var pe2=infraEra("palace",1);
    lmAdd({kind:"palace",x:zPalace.x,y:zPalace.y,w:24,h:16,rot:rng.rf(-0.1,0.1),era:pe2,nm:"The Royal Palace"});
    var cit=[],nC2=8;
    for(var ci=0;ci<nC2;ci++){
      var ca=ci/nC2*6.2832+0.39;
      cit.push({x:zPalace.x+Math.cos(ca)*(zPalace.r-4),y:zPalace.y+Math.sin(ca)*(zPalace.r-4)});
    }
    citadel={poly:cit,era:pe2};
    model.citadel=citadel;
    if((yr=infraYear("mint"))!=null){
      var mi2=placeCivic(C.x,C.y,plazaR+8,plazaR+36,13,9,"mint",eraForYear(yr));
      if(mi2)mi2.nm="The Royal Mint";
    }
    if((yr=infraYear("highcourt"))!=null){
      var hc2=placeCivic(C.x,C.y,plazaR+8,plazaR+40,15,10,"highcourt",eraForYear(yr));
      if(hc2)hc2.nm="The High Court";
    }
  }
  if((archKey==="capital"||archKey==="fortress")&&infraYear("garrison")!=null){
    var ge=infraEra("garrison",1);
    var base2=zParade||lm.find(function(l9){return l9.kind==="keep";})||zPalace||{x:C.x+rng.rf(-60,60),y:C.y+rng.rf(-60,60)};
    var bAng=rng.rf(0,3.14);
    for(var bi2=0;bi2<2;bi2++){
      for(var bt=0;bt<12;bt++){
        var bo={x:base2.x+Math.cos(bAng+1.57)*(14+bi2*11)+rng.rf(-3,3),y:base2.y+Math.sin(bAng+1.57)*(14+bi2*11)+rng.rf(-3,3)};
        if(lmOK(bo,17,6,{skipReserved:true})){lmAdd({kind:"barracks",x:bo.x,y:bo.y,w:17,h:6,rot:bAng,era:ge,nm:"The Barracks"});break;}
        bAng+=0.5;
      }
    }
    if(zParade)lm.push({kind:"parade",x:zParade.x,y:zParade.y,w:zParade.r*1.6,h:zParade.r*1.05,rot:rng.rf(0,0.4),era:ge,nm:"The Parade Ground"});
  }
  if(archKey==="fortress"&&infraYear("watchtowers")!=null){
    var we=infraEra("watchtowers",1),nW=0;
    for(var wr=0;wr<roads.length&&nW<3;wr++){
      if(roads[wr].kind!=="highway")continue;
      var wpt=roads[wr].pts[Math.floor(roads[wr].pts.length*0.86)];
      if(dist(wpt,C)<Rmax*1.35)continue;
      var wo={x:wpt.x+rng.rf(-10,10),y:wpt.y-8};
      if(!lmOK(wo,5,5,{}))continue;
      lmAdd({kind:"watchtower",x:wo.x,y:wo.y,w:5,h:5,rot:0,era:we,nm:"Road Watchtower"});nW++;
    }
  }
  if(archKey==="scholar"&&zCollege){
    var ce=infraEra("college",1),cphi=rng.rf(-0.2,0.2),q=zCollege.r*0.46;
    var quadDef=[{dx:0,dy:-q,w:14,h:7},{dx:0,dy:q,w:14,h:7},{dx:-q,dy:0,w:7,h:13},{dx:q,dy:0,w:7,h:13}];
    for(var qi=0;qi<4;qi++){
      var qd=quadDef[qi],co=Math.cos(cphi),si=Math.sin(cphi);
      var qp={x:zCollege.x+qd.dx*co-qd.dy*si,y:zCollege.y+qd.dx*si+qd.dy*co};
      lmAdd({kind:qi===0?"college":"collegewing",x:qp.x,y:qp.y,w:qd.w,h:qd.h,rot:cphi,era:ce,nm:qi===0?"The College":null});
    }
    if((yr=infraYear("library"))!=null){
      var lb=placeNear(zCollege.x,zCollege.y,zCollege.r+8,zCollege.r+26,11,8,"library",eraForYear(yr),24,{skipReserved:true});
      if(lb)lb.nm="The Library";
    }
    if((yr=infraYear("scriptorium"))!=null){
      var sc2=placeNear(zCollege.x,zCollege.y,zCollege.r+6,zCollege.r+22,9,7,"scriptorium",eraForYear(yr),24,{skipReserved:true});
      if(sc2)sc2.nm="The Scriptorium";
    }
  }
  if(archKey==="tradepost"){
    if(zCaravan&&(yr=infraYear("caravanserai"))!=null)
      lmAdd({kind:"caravanserai",x:zCaravan.x,y:zCaravan.y,w:21,h:21,rot:rng.rf(-0.12,0.12),era:eraForYear(yr),nm:"The Caravanserai"});
    var nWare=2;
    for(var wi2=0;wi2<nWare;wi2++){
      var wre=placeNear(C.x,C.y,plazaR+10,plazaR+42,11,8,"ware",Math.min(eras.length-1,1));
      if(wre)wre.nm="Warehouse";
    }
  }
  if(zFair&&(yr=infraYear("fairground"))!=null)
    lm.push({kind:"fairground",x:zFair.x,y:zFair.y,w:zFair.r*1.7,h:zFair.r*1.1,rot:rng.rf(0,0.5),era:eraForYear(yr),nm:"The Fairground"});
  if((yr=infraYear("marketcross"))!=null&&plazaR)
    lm.push({kind:"marketcross",x:C.x+rng.rf(-3,3),y:C.y+rng.rf(-3,3),w:3,h:3,rot:0,era:eraForYear(yr),nm:"The Market Cross"});
  if(archKey==="vintner"){
    if((yr=infraYear("press"))!=null&&hills.length){
      var hp=hills[0],pAng=Math.atan2(C.y-hp.y,C.x-hp.x);
      for(var pt2=0;pt2<14;pt2++){
        var pp={x:hp.x+Math.cos(pAng)*(hp.rings[0]+rng.rf(14,30)),y:hp.y+Math.sin(pAng)*(hp.rings[0]+rng.rf(14,30))};
        if(lmOK(pp,11,8,{})){lmAdd({kind:"press",x:pp.x,y:pp.y,w:11,h:8,rot:0,era:eraForYear(yr),nm:"The Press-house"});break;}
        pAng+=0.35;
      }
    }
    if((yr=infraYear("cellars"))!=null&&hills.length){
      var hc3=hills[hills.length-1],cAng2=Math.atan2(C.y-hc3.y,C.x-hc3.x)+rng.rf(-0.4,0.4);
      var cp2={x:hc3.x+Math.cos(cAng2)*hc3.rings[0]*0.92,y:hc3.y+Math.sin(cAng2)*hc3.rings[0]*0.92};
      if(!inWater(cp2,4))lm.push({kind:"cellars",x:cp2.x,y:cp2.y,w:8,h:6,rot:cAng2,era:eraForYear(yr),nm:"The Deep Cellars"});
    }
  }
  if(archKey==="lumber"){
    if((yr=infraYear("sawmill"))!=null){
      var se2=eraForYear(yr),swDone=false;
      if(river){
        for(var st2=0;st2<16&&!swDone;st2++){
          var srp=river.pts[rng.ri(2,river.pts.length-3)];
          if(dist(srp,C)<80||dist(srp,C)>200)continue;
          var sside=rng.chance(0.5)?-1:1;
          var smp={x:srp.x,y:srp.y+sside*(river.w/2+7)};
          if(!lmOK(smp,12,9,{waterPad:2}))continue;
          var sml=lmAdd({kind:"sawmill",x:smp.x,y:smp.y,w:12,h:9,rot:0,era:se2,nm:"The Sawmill",logs:true});
          if(infraYear("logpond")!=null){
            var lpp={x:srp.x+18,y:srp.y};
            model.logpond={x:lpp.x,y:lpp.y,rx:15,ry:Math.max(9,river.w*0.7),era:infraEra("logpond",se2)};
          }
          swDone=true;
        }
      }
      if(!swDone){
        var sm2=placeNear(C.x,C.y,Rmax*0.8,Rmax*1.2,12,9,"sawmill",se2);
        if(sm2){sm2.nm="The Saw-yard";sm2.logs=true;}
      }
    }
  }

  /* default graveyard (skip when the abbey provides one) */
  if(infraYear("church")!=null&&!(archKey==="religious"&&zAbbey)){
    var gv=placeNear(C.x,C.y,Rmax*0.95,Rmax*1.35,26,18,"graveyard",infraEra("church",0));
    if(gv){gv.nm="The Graveyard";gv.crosses=[];var ncr=rng.ri(5,9);for(var c6=0;c6<ncr;c6++)gv.crosses.push({x:gv.x+rng.rf(-10,10),y:gv.y+rng.rf(-6,6)});}
  }

  /* ---- docks (any coastal town that earns them) ---- */
  var piers=[];
  if(region.hasCoast&&(infraYear("harborworks")!=null||infraYear("quay")!=null||finalPop>700||founding.key==="harbor"||archKey==="port")){
    var pe=infraYear("quay")!=null?infraEra("quay",0):(infraYear("harborworks")!=null?infraEra("harborworks",0):0);
    var nP=clamp(2+Math.round(finalPop/(archKey==="port"?1700:2500)),2,archKey==="port"?7:5);
    for(var pi3=0;pi3<nP;pi3++){
      var py=coveY+(pi3-(nP-1)/2)*rng.rf(16,22)+rng.rf(-3,3);
      var sx=shoreAt(py);
      piers.push({x1:sx-2,y1:py,x2:sx+rng.rf(16,30),y2:py+rng.rf(-3,3),era:pe});
      if(rng.chance(0.8)){var wp={x:sx-rng.rf(12,28),y:py+rng.rf(-6,6)};
        if(lmOK(wp,10,7,{})){var wl=lmAdd({kind:"ware",x:wp.x,y:wp.y,w:10,h:7,rot:rng.rf(-0.1,0.1),era:pe});wl.nm="Warehouse";}}
    }
  }
  model.piers=piers;

  /* ---- market stalls (kept off the carriageways that cross the plaza) ---- */
  var stalls=[];
  if(plazaR&&finalPop>400){
    var ns=rng.ri(archKey==="capital"?5:3,archKey==="capital"?9:7),me=infraEra("market",0);
    for(var s6=0;s6<ns;s6++){
      for(var st6=0;st6<12;st6++){
        var sa=rng.rf(0,6.2832),sr=rng.rf(plazaR*0.25,plazaR*0.7);
        var sp6={x:C.x+Math.cos(sa)*sr,y:C.y+Math.sin(sa)*sr};
        if(roadBlocked(sp6,3.4))continue;
        stalls.push({x:sp6.x,y:sp6.y,w:rng.rf(3,5),h:rng.rf(2.5,4),rot:rng.rf(0,3.14),era:me});
        break;
      }
    }
  }
  model.stalls=stalls;

  /* ---- wall sanity: nothing may straddle the circuit ---- */
  function straddleCount(o){
    if(!walls||!walls.poly||!o.w||!o.h)return -1;
    var hw9=Math.max(0.1,o.w/2-1),hh9=Math.max(0.1,o.h/2-1),c9=Math.cos(o.rot||0),s9=Math.sin(o.rot||0),inN=0;
    var cs=[[-hw9,-hh9],[hw9,-hh9],[hw9,hh9],[-hw9,hh9]];
    for(var i=0;i<4;i++){
      var p={x:o.x+cs[i][0]*c9-cs[i][1]*s9,y:o.y+cs[i][0]*s9+cs[i][1]*c9};
      if(pointInPoly(p,walls.poly))inN++;
    }
    return inN;
  }
  if(walls&&walls.poly){
    var DROPPABLE={fairground:1,slipway:1,ropewalk:1,ware:1,waymark:1};
    for(var li=lm.length-1;li>=0;li--){
      var L=lm[li],sc9=straddleCount(L);
      if(sc9<=0||sc9>=4)continue;
      var dirx=L.x-C.x,diry=L.y-C.y,dl9=Math.max(1,Math.sqrt(dirx*dirx+diry*diry));dirx/=dl9;diry/=dl9;
      var fixed=false,dirs=[[dirx,diry],[-dirx,-diry],[diry,-dirx],[-diry,dirx]];
      for(var dd=0;dd<dirs.length&&!fixed;dd++){
        for(var st=5;st<=40;st+=5){
          var trial={x:L.x+dirs[dd][0]*st,y:L.y+dirs[dd][1]*st,w:L.w,h:L.h,rot:L.rot};
          var t9=straddleCount(trial);
          if((t9===0||t9===4)&&!inWaterRaw(trial,6)&&trial.x>14&&trial.x<W-14&&trial.y>14&&trial.y<H-14){
            L.x=trial.x;L.y=trial.y;addHash(L);fixed=true;break;
          }
        }
      }
      if(!fixed){
        if(DROPPABLE[L.kind])lm.splice(li,1);
        else{var g9=0;while(g9++<16&&straddleCount(L)>0&&straddleCount(L)<4){L.x-=dirx*5;L.y-=diry*5;}addHash(L);}
      }
    }
    for(var bi9=buildings.length-1;bi9>=0;bi9--){
      var B9=buildings[bi9],sb9=straddleCount(B9);
      if(sb9>0&&sb9<4)buildings.splice(bi9,1);
    }
  }

  /* ---- farms & vineyards: footprint-checked, never overlapping ---- */
  var farms=[],farmCircs=[];
  function stripSamples(st){
    var c=Math.cos(st.rot),s=Math.sin(st.rot),hw=st.w/2;
    var n=Math.max(2,Math.ceil(st.w/11)),out=[];
    for(var i=0;i<=n;i++){var t=-hw+st.w*i/n;out.push({x:st.x+c*t,y:st.y+s*t});}
    return out;
  }
  function farmFits(house,strips){
    var pts=[{x:house.x,y:house.y}];
    for(var i=0;i<strips.length;i++)pts=pts.concat(stripSamples(strips[i]));
    var cen={x:0,y:0};
    pts.forEach(function(p){cen.x+=p.x;cen.y+=p.y;});cen.x/=pts.length;cen.y/=pts.length;
    var rad=0;pts.forEach(function(p){var d=dist(p,cen);if(d>rad)rad=d;});
    rad+=6;
    for(var f=0;f<farmCircs.length;f++)if(dist(cen,farmCircs[f])<farmCircs[f].r+rad)return null;
    for(var j=0;j<pts.length;j++){
      var p2=pts[j];
      if(p2.x<14||p2.x>W-14||p2.y<14||p2.y>H-14)return null;
      if(inWater(p2,5))return null;
      if(collides(p2,9))return null;
      if(nearWall(p2,7))return null;
      if(overlapsReserved(p2,5))return null;
      if(distToRoads(p2,["highway","mineroad"])<7)return null;
      if(model.crossing&&dist(p2,model.crossing)<26)return null;
    }
    return {cen:cen,rad:rad,pts:pts};
  }
  function commitFarm(farm,fit){
    farms.push(farm);
    farmCircs.push({x:fit.cen.x,y:fit.cen.y,r:fit.rad});
    fit.pts.forEach(addHash);
  }
  var nF=Math.round(clamp(S.farm*clamp(finalPop/120,4,26),0,26));
  if(archKey==="lumber")nF=Math.round(nF*0.6);
  var hwys=roads.filter(function(r7){return r7.kind==="highway";});
  for(var f6=0;f6<nF*5&&farms.length<nF&&hwys.length;f6++){
    var rd7=hwys[rng.ri(0,hwys.length-1)];
    var seg=rng.ri(Math.floor(rd7.pts.length*0.4),rd7.pts.length-2);
    var a7=rd7.pts[seg],b7=rd7.pts[seg+1];
    var t7=rng.rf(0,1),fp={x:a7.x+(b7.x-a7.x)*t7,y:a7.y+(b7.y-a7.y)*t7};
    if(dist(fp,C)<Rmax*1.18)continue;
    var fdx=b7.x-a7.x,fdy=b7.y-a7.y,fl=Math.max(1e-6,Math.sqrt(fdx*fdx+fdy*fdy));fdx/=fl;fdy/=fl;
    var fs=rng.chance(0.5)?1:-1,foff=rng.rf(12,22)*fs;
    var house={x:fp.x-fdy*foff,y:fp.y+fdx*foff,w:7,h:6,rot:Math.atan2(fdy,fdx)};
    var strips=[],nS2=rng.ri(2,4);
    for(var s7=0;s7<nS2;s7++){
      strips.push({x:house.x-fdy*(12+s7*13)*fs+fdx*rng.rf(-6,6),y:house.y+fdx*(12+s7*13)*fs+fdy*rng.rf(-6,6),
                   w:rng.rf(26,44),h:rng.rf(9,13),rot:Math.atan2(fdy,fdx)});
    }
    var fit=farmFits(house,strips);
    if(!fit)continue;
    commitFarm({house:house,strips:strips,type:"field",era:rng.ri(0,Math.max(0,eras.length-2))},fit);
  }
  if(archKey==="vintner"&&hills.length){
    var nV=clamp(Math.round((S.vines||0)*8),3,9),vTries=nV*8;
    while(vTries-->0&&farms.filter(function(f){return f.type==="vine";}).length<nV){
      var vh=hills[rng.ri(0,hills.length-1)];
      var vAng=rng.rf(0,6.2832),vRad=vh.rings[0]*rng.rf(1.02,1.45);
      var vc={x:vh.x+Math.cos(vAng)*vRad,y:vh.y+Math.sin(vAng)*vRad};
      var tanA=vAng+Math.PI/2; /* terraces follow the contour */
      var vStrips=[],nRow=rng.ri(4,6),rowW=rng.rf(20,32);
      for(var vr=0;vr<nRow;vr++){
        vStrips.push({x:vc.x+Math.cos(vAng)*vr*6.5,y:vc.y+Math.sin(vAng)*vr*6.5,w:rowW*(1-vr*0.06),h:3.6,rot:tanA});
      }
      var vHouse={x:vc.x-Math.cos(vAng)*12,y:vc.y-Math.sin(vAng)*12,w:6,h:5,rot:tanA};
      var vFit=farmFits(vHouse,vStrips);
      if(!vFit)continue;
      commitFarm({house:vHouse,strips:vStrips,type:"vine",era:rng.ri(0,Math.max(0,eras.length-2))},vFit);
    }
  }
  model.farms=farms;

  /* ---- lane tails: a lane exists to serve something. Tails that overshoot the last
     thing they serve (built for growth that never came) are pulled back; lanes that
     serve nothing are removed. Highways and mineroads lead to the wider world — untouched. */
  (function trimLanes(){
    var anchors=[];
    buildings.forEach(function(b){anchors.push({x:b.x,y:b.y,r:16});});
    lm.forEach(function(l9){anchors.push({x:l9.x,y:l9.y,r:18});});
    farms.forEach(function(f9){anchors.push({x:f9.house.x,y:f9.house.y,r:20});});
    roads.forEach(function(r9){if(r9.kind==="lane"&&r9.pts.length)anchors.push({x:r9.pts[0].x,y:r9.pts[0].y,r:8});});
    function servedUpTo(pts){ /* furthest arclength still within reach of an anchor */
      var sBest=-1,s=0;
      for(var i=0;i<pts.length-1;i++){
        var a=pts[i],b=pts[i+1],L=dist(a,b),n=Math.max(1,Math.ceil(L/6));
        for(var st=0;st<=n;st++){
          var px=a.x+(b.x-a.x)*st/n,py=a.y+(b.y-a.y)*st/n;
          for(var k9=0;k9<anchors.length;k9++){
            var an=anchors[k9],dx=px-an.x,dy=py-an.y;
            if(dx*dx+dy*dy<an.r*an.r){sBest=s+L*st/n;break;}
          }
        }
        s+=L;
      }
      return {sBest:sBest,total:s};
    }
    roads.forEach(function(rd){
      if(rd.kind!=="lane")return;
      var res=servedUpTo(rd.pts);
      if(res.sBest<0){rd.pts=[];return;}
      var keep=Math.min(res.total,res.sBest+10);
      if(res.total-keep<8)return;
      var out=[],s=0;
      for(var i=0;i<rd.pts.length-1;i++){
        var a=rd.pts[i],b=rd.pts[i+1],L=dist(a,b);
        out.push(a);
        if(s+L>=keep){
          var f=(keep-s)/Math.max(1e-6,L);
          out.push({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
          break;
        }
        s+=L;
      }
      rd.pts=out;
    });
    for(var ri9=roads.length-1;ri9>=0;ri9--)if(!roads[ri9].pts.length)roads.splice(ri9,1);
  })();

  /* ---- tracks: thin field-paths pulling outlying steads & works onto the road net.
     The complement of trimLanes — destinations attract roads instead of roads overshooting. */
  (function addTracks(){
    var TRACK_MIN=14,TRACK_MAX=95;
    function tryTrack(from){
      var nr=nearestOnRoads(from,["highway","mineroad","lane"]);
      if(!nr||nr.d<TRACK_MIN||nr.d>TRACK_MAX)return;
      if(river&&sideOf(from)!==sideOf(nr.pt))return;
      var lpts=subdiv([nr.pt,{x:from.x,y:from.y}],1,2.5,rng);
      if(badCross(lpts))return;
      var total=0,i;for(i=0;i<lpts.length-1;i++)total+=dist(lpts[i],lpts[i+1]);
      var s=0;
      for(i=0;i<lpts.length-1;i++){
        var a=lpts[i],b=lpts[i+1],L=dist(a,b),n=Math.max(1,Math.ceil(L/3));
        for(var st=1;st<=n;st++){
          var sHere=s+L*st/n;
          if(total-sHere<11)break; /* the last yards are the dooryard */
          var sp={x:a.x+(b.x-a.x)*st/n,y:a.y+(b.y-a.y)*st/n};
          if(collides(sp,5.0)||inWater(sp,3))return;
          for(var f9=0;f9<farms.length;f9++){
            var fh=farms[f9].house;
            if(dist(fh,from)>1&&dist(sp,fh)<6)return; /* not through someone else's dooryard */
          }
        }
        s+=L;
      }
      roads.push({pts:lpts,kind:"track"});
    }
    farms.forEach(function(f){tryTrack({x:f.house.x,y:f.house.y});});
    var TRACKABLE={windmill:1,press:1,cellars:1,sawmill:1,graveyard:1,fairground:1,lighthouse:1,abbey:1,caravanserai:1};
    lm.forEach(function(l9){
      if(!TRACKABLE[l9.kind])return;
      if(distToRoads(l9)>TRACK_MIN+4)tryTrack({x:l9.x,y:l9.y});
    });
  })();

  /* ---- paved core: chartered/wealthy walled towns cobble the spine and plaza ring ---- */
  var pavedSegs=[];
  if(walls&&(sim.government==="charter"||sim.government==="council"||sim.government==="crown"||eco.wealth>=1.35)){
    roads.forEach(function(rd){
      if(rd.kind!=="highway"&&rd.kind!=="lane")return;
      if(rd.kind==="lane"&&!(plazaR&&rd.pts.some(function(p9){return dist(p9,C)<plazaR+34;})))return; /* only plaza-side lanes */
      var run=[];
      for(var i8=0;i8<rd.pts.length;i8++){
        if(pointInPoly(rd.pts[i8],walls.poly))run.push(rd.pts[i8]);
        else{if(run.length>1)pavedSegs.push({pts:run,kind:rd.kind});run=[];}
      }
      if(run.length>1)pavedSegs.push({pts:run,kind:rd.kind});
    });
  }
  model.pavedSegs=pavedSegs;

  /* ---- trees (lumber towns always have woods to cut, like mining always has hills) ---- */
  var trees=[];
  var fCov=archKey==="lumber"?Math.max(region.forestCover,0.5):region.forestCover;
  if(fCov>0.22){
    var nCl=rng.ri(3,6);
    if(archKey==="lumber")nCl+=2;
    for(var cl=0;cl<nCl;cl++){
      var tcOK=false,tc=null,tt=18;
      while(tt-->0&&!tcOK){
        tc={x:rng.rf(40,W-40),y:rng.rf(40,H-40)};
        tcOK=dist(tc,C)>Rmax*1.3&&!inWater(tc,18)&&(!hillsPt||dist(tc,hillsPt)>120)&&!overlapsReserved(tc,30);
      }
      if(!tcOK)continue;
      var nT=Math.round(rng.rf(8,26)*fCov);
      for(var t8=0;t8<nT;t8++){
        var tp8={x:tc.x+rng.gauss(0,42),y:tc.y+rng.gauss(0,34)};
        if(tp8.x<16||tp8.x>W-16||tp8.y<16||tp8.y>H-16)continue;
        if(inWater(tp8,10))continue;
        var nr8=nearestOnRoads(tp8);
        if(nr8&&nr8.d<13)continue;
        if(collides(tp8,9))continue;
        trees.push({x:tp8.x,y:tp8.y,r:rng.rf(2.2,4.2),c:tc});
      }
    }
  }
  model.trees=trees;
  /* lumber: cleared stump fields between town and the woods */
  if(archKey==="lumber"&&trees.length){
    var stumps=[],clCenters=[];
    trees.forEach(function(t9){if(!clCenters.some(function(c){return c===t9.c;}))clCenters.push(t9.c);});
    var nSt=Math.min(3,clCenters.length);
    for(var sc3=0;sc3<nSt;sc3++){
      var cc=clCenters[sc3];
      var towardC=Math.atan2(C.y-cc.y,C.x-cc.x);
      var scen={x:cc.x+Math.cos(towardC)*rng.rf(60,95),y:cc.y+Math.sin(towardC)*rng.rf(60,95)};
      var nSp=rng.ri(7,14);
      for(var sp2=0;sp2<nSp;sp2++){
        var spp2={x:scen.x+rng.gauss(0,26),y:scen.y+rng.gauss(0,20)};
        if(spp2.x<16||spp2.x>W-16||spp2.y<16||spp2.y>H-16)continue;
        if(inWater(spp2,8)||collides(spp2,6))continue;
        if(distToRoads(spp2)<9)continue;
        stumps.push({x:spp2.x,y:spp2.y,r:rng.rf(1.4,2.4)});
      }
    }
    model.stumps=stumps;
  }
  model.landmarks=lm;

  /* ---- labels: taverns & notable homes pinned to real buildings ---- */
  var anchor=(archKey==="port"&&piers.length)?{x:shoreAt(coveY)-30,y:coveY}:C;
  var cands=buildings.map(function(b,i){return {b:b,i:i,d:dist(b,anchor)};})
                     .sort(function(a,b){return a.d-b.d;});
  var used={},ti=0;
  for(var tv=0;tv<names.taverns.length&&ti<cands.length;tv++){
    while(ti<cands.length&&(used[cands[ti].i]||cands[ti].b.kind!=="house"&&cands[ti].b.kind!=="craft"))ti++;
    if(ti>=cands.length)break;
    cands[ti].b.kind="tavern";cands[ti].b.nm=names.taverns[tv];used[cands[ti].i]=1;ti+=rng.ri(2,4);
  }
  if(people&&people.notables){
    var ci2=0;
    for(var nb2=0;nb2<people.notables.length;nb2++){
      var nt=people.notables[nb2];
      if(/^Keeper of /.test(nt.role)){
        var tvName=nt.role.slice(10);
        var tb=buildings.find(function(b){return b.nm===tvName;});
        if(tb){tb.who=nt.name;continue;}
      }
      if(/Lord|Lady|King|Queen|Castellan/.test(nt.role)){
        var seat=lm.find(function(l){return l.kind==="palace";})||lm.find(function(l){return l.kind==="keep";});
        if(seat){seat.who=nt.name+", "+nt.role;continue;}
      }
      if(/Abbot|Abbess|Prior/.test(nt.role)){
        var ab2=lm.find(function(l){return l.kind==="abbey";});
        if(ab2){ab2.who=nt.name+", "+nt.role;continue;}
      }
      while(ci2<cands.length&&(used[cands[ci2].i]||cands[ci2].b.kind==="tavern"))ci2++;
      if(ci2>=cands.length)break;
      cands[ci2].b.who=nt.name+", "+nt.role;used[cands[ci2].i]=1;ci2+=rng.ri(1,3);
    }
  }
  /* ---- footprint character: grander buildings break the rectangle. Shapes are CARVED
     from the committed rect (always a subset), so no new collisions are possible. ---- */
  buildings.forEach(function(b){
    if(b.kind==="tavern"&&b.w>=8.6&&b.h>=6.6){b.shape="U";b.notch=rng.chance(0.5)?1:-1;return;}
    var dk2=(b.d!=null&&districts[b.d])?districts[b.d].key:null;
    if(dk2==="wealth"&&b.w>=8.8&&b.h>=6.8&&rng.chance(0.4))b.shape="L";
    else if(dk2==="wealth"&&Math.abs(b.w-b.h)<1.8&&rng.chance(0.2))b.shape="oct";
    else if(b.kind==="craft"&&b.w>=9&&rng.chance(0.08))b.shape="L";
  });

  /* ---- mirrored coast: the sea may lie west ---- */
  if(mirrorSea){
    var mpt=function(o){o.x=W-o.x;if(o.rot!=null)o.rot=-o.rot;if(o.angle!=null)o.angle=Math.PI-o.angle;};
    if(model.river)model.river.pts.forEach(mpt);
    (model.shore||[]).forEach(mpt);
    roads.forEach(function(r){r.pts.forEach(mpt);});
    (model.pavedSegs||[]).forEach(function(s){s.pts.forEach(mpt);});
    if(model.crossing)mpt(model.crossing);
    if(model.walls){model.walls.poly.forEach(mpt);(model.walls.towers||[]).forEach(mpt);(model.walls.gates||[]).forEach(mpt);}
    if(model.citadel)model.citadel.poly.forEach(mpt);
    if(model.precinct)model.precinct.poly.forEach(mpt);
    (model.waymarks||[]).forEach(mpt);
    (model.adits||[]).forEach(function(a){a.x=W-a.x;a.rot=Math.PI-a.rot;});
    (model.stumps||[]).forEach(mpt);
    if(model.logpond)model.logpond.x=W-model.logpond.x;
    (model.trees||[]).forEach(mpt);
    farms.forEach(function(f){mpt(f.house);f.strips.forEach(mpt);});
    buildings.forEach(mpt);
    lm.forEach(mpt);
    (model.stalls||[]).forEach(mpt);
    (model.districts||[]).forEach(mpt);
    (model.hills||[]).forEach(mpt);
    (model.piers||[]).forEach(function(p){p.x1=W-p.x1;p.x2=W-p.x2;});
    if(model.C)mpt(model.C);
    model.seaSide="west";
  }

  model.buildings=buildings;
  return model;
}
function yearOfEvent(sim,key){
  for(var i=0;i<sim.events.length;i++)if(sim.events[i].text.toLowerCase().indexOf(key)>=0)return sim.events[i].year;
  return null;
}

