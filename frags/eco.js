/* ================= economy ================= */
function wealthLabel(w){return w<0.35?"Destitute":w<0.7?"Poor":w<1.1?"Modest":w<1.6?"Comfortable":w<2.2?"Wealthy":"Opulent";}
function lerp(a,b,t){return a+(b-a)*t;}

function economy(rng,cfg,region,sim,founding,S,arch){
  var pop=sim.pop, R=region.res, Q=sim.Q||{}, def=arch.def;
  var workforce=Math.round(pop*0.47);
  var urb=clamp(Math.log(pop/150)/Math.log(40),0,1); /* 0 at ~150, 1 at ~6000 */

  /* ---- primary-sector industries (for the ledger) ---- */
  var shares=[];
  function ind(name,share,note,qk){ if(share>0.004){ shares.push({name:name,share:share,note:note,qk:qk||null}); } }
  var mineBoost=(founding.key==="mine"||arch.key==="mining"?1.3:1)*(sim.veinDead?0.3:1);
  ind("Farming & smallholding", S.farm*lerp(0.42,0.05,urb), "grain, roots, orchard fruit");
  ind("Herding & dairying",     S.pastoral*lerp(0.15,0.02,urb), "sheep, cattle, cheese");
  ind("Fishing",                S.fish*(region.hasCoast?lerp(0.18,0.10,urb):0.07), region.hasCoast?"inshore boats, drying racks":"weirs and river nets");
  ind("Mining",                 S.mine*0.16*mineBoost, sim.veinDead?"the old workings, mostly played out":oreNote(R));
  ind("Quarrying",              S.quarry*0.05, "good building stone");
  ind("Forestry & charcoal",    S.forestry*lerp(0.09,0.02,urb)*(arch.key==="lumber"?1.6:1), "felling, sawpits, charcoal heaps");
  ind("Salt-making",            S.salt*0.05, region.hasCoast?"evaporation pans":"brine springs");
  ind("Trapping & hunting",     S.furs*lerp(0.05,0.01,urb), "furs and game");
  ind("Wool & cloth working",   S.wool*lerp(0.07,0.11,urb), "spinning, weaving, fulling","wool");
  ind("Smithing & metalwork",   S.smith*lerp(0.04,0.07,urb), "forges along the smiths' row","smith");
  ind("Shipbuilding",           S.ships*0.05, "slips and rope-walks","ships");
  ind("Carriage & portage",     S.trade*lerp(0.03,0.08,urb)*(arch.key==="tradepost"?1.5:1), "wagons, mules, riverboats");
  ind("Brewing",                S.brew*0.03, "ale for the town and the road","brew");
  ind("Winemaking",             S.vines*0.06*(arch.key==="vintner"?1.5:1), "terraced vineyards","vines");
  /* archetype spines */
  if(arch.key==="capital")  ind("Crown service",      0.11,"clerks, courts, the mint, the court itself");
  if(arch.key==="fortress") ind("The garrison",       0.15,"soldiery, drill, and everything that feeds it");
  if(arch.key==="religious")ind("The abbey & pilgrims",0.10,"the cloister's lands and the pilgrim trade");
  if(arch.key==="scholar")  ind("The college",        0.09,"scholars, scribes, parchment and ink");
  shares.sort(function(a,b){return b.share-a.share;});
  var sumShare=shares.reduce(function(a,x){return a+x.share;},0);
  var norm=sumShare>0.86?0.86/sumShare:1; /* leave room for crafts/services */
  var industries=shares.map(function(x){
    var sh=x.share*norm;
    return {name:x.name,workers:Math.max(2,Math.round(workforce*sh)),share:sh,note:x.note,
            quality:(x.qk&&Q[x.qk]!=null)?qualityLabel(Q[x.qk]):null};
  }).filter(function(x){return x.workers>=2;}).slice(0,10);

  /* ---- occupations from the calibrated table (plus archetype rows) ---- */
  var occ=[],TABLE=OCC.concat(def.occ||[]);
  for(var i=0;i<TABLE.length;i++){
    var o=TABLE[i], mult=1;
    if(o.tags){ for(var k in o.tags){ var s=(k==="charter")?(sim.charter?1:0):(S[k]||0); mult+=o.tags[k]*s; } }
    if(o.req){
      var ok={fish:S.fish>0.15,mill:S.mill>0,vines:S.vines>0.2,wool:S.wool>0.35,pottery:S.pottery>0.25,
              ships:S.ships>0.3,weapons:S.weapons>0.2,furs:S.furs>0.3,magic:S.magic>0,
              water:(region.hasCoast||region.hasRiver)}[o.req];
      if(!ok) continue;
    }
    var raw=pop/o.d*mult;
    var n=Math.floor(raw)+(rng.f()<(raw-Math.floor(raw))?1:0); /* seeded stochastic rounding */
    /* floors that make towns make sense */
    if(o.n==="Blacksmiths"&&S.mine>0.5&&pop>=600)n=Math.max(n,2);
    if(o.n==="Blacksmiths"&&pop>=400)n=Math.max(n,1);
    if(o.n==="Taverns & alehouses")n=Math.max(n,1); /* every settlement has at least an alewife */
    if(o.n==="Bakers"&&pop>=500)n=Math.max(n,1);
    if(n>0)occ.push({n:o.n,g:o.g,count:n});
  }

  /* ---- exports & imports, with craft quality speaking ---- */
  var exports=[],imports=[];
  function qAdj(k){var q=Q[k];if(q==null)return "";return q>=0.82?"renowned ":q>=0.66?"fine ":"";}
  function qPoor(k){return Q[k]!=null&&Q[k]<0.32;}
  function pushQ(k,base,poorBase,need){
    if((S[k]||0)<need)return;
    if(qPoor(k)){ if((S[k]||0)>=0.5)exports.push(poorBase); return; } /* a poor minor craft simply isn't exported */
    exports.push(qAdj(k)+base);
  }
  function topOre(){var c=[["iron",R.iron||0],["coppertin",(R.coppertin||0)*0.9],["silver",R.silver||0],["gold",R.gold||0],["gems",R.gems||0]];c.sort(function(a,b){return b[1]-a[1];});return c[0][0];}
  if(S.mine>0.45&&!sim.veinDead){var ore=topOre();exports.push({iron:"iron ore & pig iron",coppertin:"copper and tin",silver:"silver",gold:"gold",gems:"cut and rough gemstones"}[ore]);}
  pushQ("smith","wrought ironwork & tools","rough ironwork, sold cheap",0.5);
  pushQ("weapons","arms & armor","crude arms, fit for levies",0.45);
  if(S.wool>0.5)exports.push(occHas(occ,"Fullers & dyers")?(qAdj("wool")+"finished cloth"):"raw wool");
  if(S.fish>0.5)exports.push(S.salt>0.3?"salted fish":"smoked & fresh fish");
  pushQ("vines","wine","thin wine, drunk young and locally",0.4);
  if(S.farm>0.75&&!sim.grainRoute)exports.push("grain & malt");
  if(S.furs>0.45)exports.push("furs & hides");
  if(S.forestry>0.55)exports.push(arch.key==="lumber"?"timber, pitch & charcoal":"timber & charcoal");
  if(S.quarry>0.5)exports.push("cut stone");
  if(S.salt>0.45)exports.push("salt");
  pushQ("pottery","pottery & brick","coarse crockery",0.45);
  if(S.herbcraft>0.6)exports.push(qAdj("herbcraft")+(S.magic>0?"remedies, simples & minor charms":"dried herbs & remedies"));
  if(S.ships>0.45&&!qPoor("ships"))exports.push(qAdj("ships")+"hulls off the slipways");
  if(arch.key==="religious")exports.push("candles, badges & relic-tokens");
  if(arch.key==="scholar")exports.push("bound books, ink & parchment");
  if(S.trade>0.8&&pop>2000)exports.push("through-goods of every kind — an entrepôt's living");
  if(exports.length===0)exports.push(pop<400?"little beyond the odd cartload of surplus":"modest mixed goods");
  if(sim.grainRoute||sim.food.local<pop*0.9)imports.push(arch.key==="capital"?"grain, in bulk and by law":"grain");
  if(S.salt<0.12)imports.push("salt");
  if(S.smith<0.2)imports.push("iron goods");
  if(S.forestry<0.12&&pop>1500)imports.push("timber");
  if(S.vines<0.1&&sim.wealth>1.2)imports.push("wine");
  if(sim.wealth>1.6)imports.push(arch.key==="capital"?"luxuries of every port":"dyes, spices & finery");

  return {workforce:workforce,industries:industries,occupations:occ,
          exports:exports,imports:imports,wealthLabel:wealthLabel(sim.wealth)};
}
function occHas(occ,n){for(var i=0;i<occ.length;i++)if(occ[i].n===n&&occ[i].count>0)return true;return false;}
function occCount(occ,n){for(var i=0;i<occ.length;i++)if(occ[i].n===n)return occ[i].count;return 0;}
function oreNote(R){
  var best="iron",v=R.iron||0;
  if((R.gold||0)>v){best="gold";v=R.gold;} if((R.silver||0)>v){best="silver";v=R.silver;}
  if((R.gems||0)>v){best="gems";v=R.gems;} if((R.coppertin||0)>v*1.1){best="coppertin";}
  return {iron:"iron workings in the high ground",gold:"placer and shaft gold",silver:"silver lodes",gems:"gem-bearing seams",coppertin:"copper and tin adits"}[best];
}

