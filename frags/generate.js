/* ================= generate ================= */
function normalizeCfg(cfg){
  cfg=cfg||{};
  var c={
    seed:String(cfg.seed!=null&&String(cfg.seed).trim()?cfg.seed:Math.floor(Math.random()*1e9)),
    size:cfg.size||"auto",terrain:cfg.terrain||"auto",age:cfg.age||"auto",
    prosperity:cfg.prosperity||"auto",magic:cfg.magic||"scarce",
    danger:cfg.danger==null?1:+cfg.danger,trade:cfg.trade==null?-1:+cfg.trade,
    government:cfg.government||"auto",walls:cfg.walls||"auto",climate:cfg.climate||"auto",
    events:cfg.events!==false,resources:cfg.resources||null,
    popOverride:cfg.popOverride?clamp(+cfg.popOverride,20,60000):0,
    ageYears:cfg.ageYears?clamp(+cfg.ageYears,10,1500):0,
    founding:cfg.founding||"auto",plan:{grown:1,half:1,surveyed:1}[cfg.plan]?cfg.plan:"auto",
    nameOverride:(cfg.nameOverride||"").trim(),
    mapSeed:cfg.mapSeed||"",indMult:cfg.indMult||{},
    archetype:(cfg.archetype&&ARCH[cfg.archetype])?cfg.archetype:"auto"
  };
  return c;
}
function generate(rawCfg){
  var cfg=normalizeCfg(rawCfg);
  var rng=RNG(cfg.seed+"|world");
  var region=genRegion(rng,cfg);
  /* explicit archetype shapes the land before anything is founded on it */
  var explicit=cfg.archetype!=="auto"?ARCH[cfg.archetype]:null;
  if(explicit) applyArchToRegion(rng,region,explicit);
  var founding=chooseFounding(rng,cfg,region,explicit?explicit.foundW:null);
  var S=industryStrengths(rng,cfg,region);
  var baseTarget=chooseTarget(rng,cfg);
  var arch=chooseArchetype(rng,cfg,region,founding,S,baseTarget);
  applyArchToS(S,arch.def);
  var target=baseTarget;
  if(!cfg.popOverride){
    target=Math.round(baseTarget*(arch.def.targetMul||1));
    if(arch.def.targetMin)target=Math.max(target,arch.def.targetMin);
    target=clamp(target,20,60000);
  }
  var Q=seedQuality(rng,region,S,arch.def);
  var ageYears=chooseAge(rng,cfg);
  var sim=simulate(rng,cfg,region,founding,target,ageYears,S,arch,Q);
  var eco=economy(rng,cfg,region,sim,founding,S,arch);
  var names=makeNames(rng,cfg,region,founding,S,sim,eco,arch);
  var people=makePeople(rng,cfg,region,sim,founding,S,eco,names,arch);
  var prose=buildProse(region,founding,sim,S,eco,names,arch);
  var map=buildMapModel(cfg,region,founding,sim,S,eco,arch,names,people);
  var quality=[];
  for(var qk in sim.Q){
    var cd=craftDef(qk);
    if(cd)quality.push({k:qk,craft:cd.craft,q:Math.round(sim.Q[qk]*100)/100,label:qualityLabel(sim.Q[qk])});
  }
  quality.sort(function(a,b){return b.q-a.q;});
  return {version:VERSION,cfg:cfg,seed:cfg.seed,presentYear:PRESENT_YEAR,
          archetype:{key:arch.key,label:arch.def.label,emergent:arch.emergent},
          quality:quality,
          region:region,founding:founding,strengths:S,sim:sim,economy:eco,
          names:names,people:people,prose:prose,map:map};
}
/* deterministic anonymous-householder names for map tooltips */
function nameAt(seed,i){return npcName(RNG(seed+"|who|"+i));}

globalThis.Townwright={generate:generate,VERSION:VERSION,RES_DEFS:RES_DEFS,PRESENT_YEAR:PRESENT_YEAR,ARCHETYPES:Object.keys(ARCH),nameAt:nameAt};
