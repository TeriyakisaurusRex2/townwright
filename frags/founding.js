/* ================= founding ================= */
var FOUNDING_LABEL={harbor:"a natural harbor",ford:"a river ford",mine:"a mining camp",crossroads:"a crossroads",market:"a market for the surrounding farms",defense:"defensible high ground",holy:"a holy site"};
function chooseFounding(rng,cfg,region,foundW){
  var R=region.res, key;
  if(cfg.founding!=="auto"){ key=cfg.founding; }
  else{
    var ore=Math.max(R.iron||0,(R.coppertin||0)*.8,(R.silver||0)*1.2,(R.gold||0)*1.4,(R.gems||0)*1.1);
    var sc=[];
    if(region.hasCoast) sc.push({v:"harbor",w:2.2+(R.fish||0)*1.5});
    if(region.hasRiver) sc.push({v:"ford",w:1.9+(R.fertile||0)});
    if(ore>0.25&&region.relief>=1) sc.push({v:"mine",w:ore*3.4});
    if(!region.hasCoast) sc.push({v:"crossroads",w:1+(R.fertile||0)*1.2+(cfg.trade>=0?cfg.trade*.5:0)});
    if((R.fertile||0)>.5) sc.push({v:"market",w:(R.fertile||0)*2});
    if(region.relief>=1) sc.push({v:"defense",w:region.relief*.6+cfg.danger*.8});
    sc.push({v:"holy",w:.3});
    /* archetype founding bias: explicit archetypes pull toward fitting origins */
    if(foundW)for(var i=0;i<sc.length;i++){ if(foundW[sc[i].v]!=null) sc[i].w*=foundW[sc[i].v]; }
    key=rng.wpick(sc);
  }
  /* sanity: founding implies geography */
  if(key==="harbor"&&!region.hasCoast){region.hasCoast=true;}
  if(key==="ford"&&!region.hasRiver){region.hasRiver=true;}
  if(key==="mine"&&region.relief<1){region.relief=1; if(!region.res.iron)region.res.iron=rng.rf(.4,.9);}
  return {key:key,label:FOUNDING_LABEL[key]};
}

