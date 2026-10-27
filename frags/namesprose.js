/* ================= names ================= */
var ARCH_TAVERN={religious:["Pilgrim","Mitre","Bell","Friar"],capital:["Crown","Scepter","Herald"],fortress:["Shield","Trumpet","Banner"],scholar:["Quill","Owl","Candle"]};
function makeNames(rng,cfg,region,founding,S,sim,eco,arch){
  var R=region.res,def=arch.def;
  var name;
  if(cfg.nameOverride){ name=cfg.nameOverride; }
  else{
    var pre=[],suf=[];
    function pw(arr,w){if(w>0&&arr.length)pre.push({v:arr,w:w});}
    pw(NAMES.pre_mine,S.mine*2.4); pw(NAMES.pre_gold,S.precious*2.2);
    pw(NAMES.pre_coast,region.hasCoast?2:0); pw(NAMES.pre_river,region.hasRiver?1.6:0);
    pw(NAMES.pre_fertile,S.farm*1.4); pw(NAMES.pre_forest,(region.forestCover>0.45?1.6:0)+S.forestry);
    pw(NAMES.pre_hill,region.relief>=2?1.6:0); pw(NAMES.pre_wool,S.wool*1.6);
    pw(NAMES.pre_generic,1.2);
    pw(def.namePre||[],2.2);
    function sw(arr,w){if(w>0&&arr.length)suf.push({v:arr,w:w});}
    sw(NAMES.suf_coast,(founding.key==="harbor"?3:0)+(region.hasCoast?1.2:0));
    sw(NAMES.suf_river,(founding.key==="ford"?3:0)+(region.hasRiver?1.2:0));
    sw(NAMES.suf_mine,(founding.key==="mine"?3:0)+S.mine);
    sw(NAMES.suf_hill,(founding.key==="defense"?2:0)+(region.relief>=2?1:0));
    sw(NAMES.suf_generic,2);
    sw(def.nameSuf||[],2.4);
    var STANDALONE=["Cross","Rest","Reach","Hollow","Green","Bridge","Ford","Haven","Gate","Wharf"];
    for(var tries=0;tries<24;tries++){
      var p=rng.pick(rng.wpick(pre)), s=rng.pick(rng.wpick(suf));
      if(p==="Saint"){ name="St. "+rng.pick(SAINTS)+(rng.chance(0.55)?"'s "+rng.pick(STANDALONE):""); }
      else if(/'s$/.test(p)){ name=p+" "+rng.pick(STANDALONE); }
      else{
        var pl=p.toLowerCase(), sl=s.toLowerCase();
        if(pl===sl)continue;
        if(pl.slice(-2)===sl.slice(0,2))continue;            /* Fordford */
        if(pl.slice(-1)===sl.slice(0,1)) s=sl.slice(1);      /* Salttton-type seams */
        name=cap(pl)+s.toLowerCase();
      }
      if(name.length>=4&&name.length<=18)break;
    }
    if(!name)name="Newstead";
  }

  /* epithet from the dominant fact about the place */
  var ep="";
  var dom=[["mine",S.mine],["fish",S.fish],["wool",S.wool],["trade",S.trade],["farm",S.farm],["vines",S.vines],["forestry",S.forestry],["smith",S.smith]];
  dom.sort(function(a,b){return b[1]-a[1];});
  var d0=dom[0][0], big=sim.pop>3500;
  ep={
    mine:sim.veinDead?"the worked-out hill":rng.pick(["where the hills give up their "+( (R.gold||0)>(R.iron||0)?"gold":"iron"),"the ore road's end"]),
    fish:rng.pick(["smelling of salt and tar","where the catch comes in"]),
    wool:rng.pick(["grown fat on fleece","the wool road's market"]),
    trade:rng.pick(["where the roads shake hands","toll-gate of the region"]),
    farm:rng.pick(["granary of the valley","ringed by good fields"]),
    vines:rng.pick(["of the terraced vines","where the wine carts start"]),
    forestry:rng.pick(["at the forest's edge","timber-built and timber-rich"]),
    smith:rng.pick(["of the ringing forges","the smiths' town"])
  }[d0]||"";
  if(def.epithets&&def.epithets.length&&rng.chance(0.55))ep=rng.pick(def.epithets);
  if(founding.key==="holy"&&arch.key!=="religious")ep=rng.pick(["of the blessed spring","where pilgrims still come"]);
  if(big&&ep)ep=ep+", "+fmt(sim.pop)+" souls";

  /* taverns */
  var tavernCount=0;
  for(var i=0;i<eco.occupations.length;i++)if(eco.occupations[i].n==="Taverns & alehouses")tavernCount=eco.occupations[i].count;
  var nNamed=clamp(tavernCount,1,7);
  var nouns=TAVERN_NOUN_BASE.slice();
  var tagMap=[["fish",S.fish],["mine",S.mine],["wool",S.wool],["forestry",S.forestry],["trade",S.trade],["vines",S.vines]];
  for(var t=0;t<tagMap.length;t++){ if(tagMap[t][1]>0.4&&TAVERN_NOUN_TAGGED[tagMap[t][0]]){ nouns=nouns.concat(TAVERN_NOUN_TAGGED[tagMap[t][0]],TAVERN_NOUN_TAGGED[tagMap[t][0]]); } }
  if(ARCH_TAVERN[arch.key])nouns=nouns.concat(ARCH_TAVERN[arch.key],ARCH_TAVERN[arch.key]);
  var taverns=[],used={};
  for(var g=0;g<60&&taverns.length<nNamed;g++){
    var tn="The "+rng.pick(TAVERN_ADJ)+" "+rng.pick(nouns);
    if(!used[tn]){used[tn]=1;taverns.push(tn);}
  }
  return {name:name,epithet:ep,taverns:taverns,tavernCount:tavernCount};
}

/* ================= prose ================= */
function buildProse(region,founding,sim,S,eco,names,arch){
  var R=region.res,def=arch.def,Q=sim.Q||{};
  var terrLabel={coastal:"a stretch of open coast",estuary:"the mouth of a slow river",riverlands:"broad riverlands",plains:"open plains",hills:"rolling hill country",foothills:"the foothills of the high ranges",forest:"deep forest country"}[region.terrain];
  var p1=names.name+" sits in "+terrLabel+
    (region.hasCoast&&region.terrain!=="coastal"&&region.terrain!=="estuary"?", at the sea's edge":"")+
    (region.hasRiver&&region.terrain!=="riverlands"&&region.terrain!=="estuary"?", threaded by a river":"")+
    ", under a "+region.climate+" sky. It began as "+founding.label+" in "+sim.founded+
    " — "+sim.ageYears+" years ago — and has grown to "+fmt(sim.pop)+" people"+(sim.hungerCapped?", about as many as the land and the grain carts can feed":"")+".";

  /* the causal "why" paragraph, led by the archetype's identity */
  var why=[];
  if(S.mine>0.45&&!sim.veinDead)why.push("rich ore in the surrounding high ground keeps "+(S.smith>0.5?"both the mines and a street of forges":"the mines")+" busy");
  if(sim.veinDead)why.push("the old vein is worked out, and the town lives on what the boom built");
  if(S.fish>0.5)why.push(region.hasCoast?"the inshore fishery lands a catch most days":"river weirs take a steady catch");
  if(S.wool>0.5)why.push("flocks on the surrounding pasture feed a busy cloth trade");
  if(S.farm>0.7)why.push("the soil is good enough that grain leaves town more often than it arrives");
  if(S.vines>0.4)why.push("terraced vineyards above the town ship wine in most years");
  if(S.trade>0.55)why.push("through-traffic on the "+(region.hasCoast?"sea lanes and coast road":"roads")+" pays tolls and fills the inns");
  if(S.forestry>0.55)why.push("timber and charcoal come down out of the woods in steady carts");
  if(S.salt>0.45)why.push("salt pans give it a trade goods always want");
  if(why.length===0)why.push("it feeds itself, trades a little, and asks nothing dramatic of history");
  var p2=def.prose+" Past that, it runs on what the land gives: "+why.join("; ")+".";
  /* craft quality, where it's worth a sentence */
  var bestK=null,bestQ2=0,worstK=null;
  for(var k in Q){ if(Q[k]>bestQ2){bestQ2=Q[k];bestK=k;} if(Q[k]<0.32&&(S[k]||0)>=0.4&&!worstK)worstK=k; }
  if(bestK&&bestQ2>=0.66){
    var bc=craftDef(bestK);
    p2+=" Its "+bc.craft+" is "+qualityLabel(bestQ2)+(bestQ2>=0.82?" — buyers come from beyond the province for it.":".");
  }
  if(worstK&&worstK!==bestK){
    var wc=craftDef(worstK);
    p2+=" Its "+wc.craft+", by contrast, has a poor name; buyers have learned to look twice.";
  }

  var f=sim.food;
  var p3=sim.grainRoute?
    ("Local fields and waters feed roughly "+fmt(Math.min(f.local,sim.pop))+" of its people; the rest eat off the grain route — a dependency everyone here understands.")
    :("The surrounding land can feed roughly "+fmt(Math.round(f.local))+", "+(f.local>sim.pop*1.15?"comfortably more than live here, and the surplus goes to market.":"enough — with ordinary trade — to keep the town fed."));

  return {p1:p1,p2:p2,p3:p3};
}

