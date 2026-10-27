/* ================= people ================= */
function npcName(rng){return rng.pick(NPC_FIRST_A)+rng.pick(NPC_FIRST_B)+" "+(rng.chance(0.55)?rng.pick(NPC_SURN_OCC):rng.pick(NPC_SURN_TOPO));}
function royalName(rng){return rng.pick(NPC_FIRST_A)+rng.pick(NPC_FIRST_B)+" "+rng.pick(["I","II","II","III","IV"]);}

function makePeople(rng,cfg,region,sim,founding,S,eco,names,arch){
  var def=arch.def,pop=sim.pop,Q=sim.Q||{};
  var children=Math.round(pop*0.34),elderly=Math.round(pop*0.06);
  var adults=pop-children-elderly;
  var households=Math.round(pop/4.8);
  var craftHeads=eco.occupations.reduce(function(a,o){return a+((o.g==="Crafts")?o.count:0);},0);
  var merchHeads=eco.occupations.reduce(function(a,o){return a+((o.g==="Trade & services")?o.count:0);},0);
  var gentry=Math.max(sim.government==="lord"?6:0,Math.round(pop*0.009*sim.wealth));
  if(arch.key==="capital")gentry=Math.max(gentry,Math.round(pop*0.022));
  var clergy=Math.max(sim.infra.some(function(f){return f.key==="church"||f.key==="temple";})?2:0,Math.round(pop/420));
  if(arch.key==="religious")clergy=Math.max(clergy,Math.round(pop*0.055)+occCount(eco.occupations,"Monks, nuns & lay brothers"));
  var soldiers=occCount(eco.occupations,"Garrison soldiers");
  var crafts=Math.round(craftHeads*2.2);
  var merchants=Math.round(merchHeads*2.2);
  var destitute=Math.round(pop*clamp(0.05+(1.3-sim.wealth)*0.05,0.02,0.15));
  var soldierClass=soldiers>0?Math.round(soldiers*1.6):0;
  var laborers=Math.max(0,pop-children-gentry-clergy-crafts-merchants-destitute-soldierClass);
  var classes=[
    {n:"Gentry & officials",c:gentry},{n:"Clergy & religious",c:clergy},
    {n:"Garrison & soldiery",c:soldierClass},
    {n:"Merchants & traders",c:merchants},{n:"Craftsfolk & their households",c:crafts},
    {n:"Laborers, farmhands & servants",c:laborers},{n:"Poor & destitute",c:destitute}
  ].filter(function(x){return x.c>0;});

  var watch=pop>=800?Math.round(pop/160):(pop>=300?rng.ri(1,2):0);
  var militia=Math.round(adults*rng.rf(0.045,0.055));

  /* notables */
  var nb=[];
  function add(name,role,line){nb.push({name:name,role:role,line:line});}
  var rulerLine={
    lord:["holds the town from the keep; fair at the rents, hard at the hunt.","rules from the hall; collects the tolls and keeps the peace, mostly."],
    charter:["elected mayor under the charter; a former "+(rng.chance(.5)?"merchant":"guildsman")+".","keeps the charter under lock and the council in line."],
    council:["first among the aldermen; nothing moves on the wharves without a word.","speaks for the council; owes favors in three guilds."],
    temple:["keeps the shrine and, in practice, the town.","tithes are fair, sermons are long."],
    crown:["rules the realm from here, when the realm permits.","holds court, signs death warrants and charters with the same pen, and remembers everything."]
  }[sim.government];
  var rulerRole={lord:rng.chance(.5)?"Lord of the Town":"Lady of the Town",charter:"Mayor",council:"First Alderman",temple:rng.chance(.5)?"High Priest":"Prioress",crown:rng.chance(.5)?"King":"Queen"}[sim.government];
  if(arch.key==="religious"&&sim.government==="temple")rulerRole=rng.chance(.5)?"Lord Abbot":"Abbess";
  if(arch.key==="fortress"&&sim.government==="lord")rulerRole="Castellan";
  add(sim.government==="crown"?royalName(rng):npcName(rng),rulerRole,rng.pick(rulerLine));
  if(watch>0)add(npcName(rng),"Captain of the Watch","commands "+watch+" sworn watchmen; knows every cellar in town.");
  if(sim.infra.some(function(f){return f.key==="church";})&&arch.key!=="religious")add(npcName(rng),"Parish Priest","keeps the registry of births and burials back to "+(sim.founded+rng.ri(20,80))+".");
  if(eco.industries.length&&(pop>1200||sim.infra.some(function(f){return f.key==="guildhall";})))add(npcName(rng),"Guildmaster, "+eco.industries[0].name.toLowerCase(),"sets prices and settles disputes in the "+eco.industries[0].name.toLowerCase()+" trade.");
  if(names.taverns.length)add(npcName(rng),"Keeper of "+names.taverns[0],"hears everything worth hearing by the second bell.");
  if(sim.infra.some(function(f){return f.key==="harborworks"||f.key==="quay";}))add(npcName(rng),"Harbor-master","levies wharfage; keeps the tide-book and the gossip.");
  if((founding.key==="mine"||S.mine>0.5)&&!sim.veinDead&&arch.key!=="mining")add(npcName(rng),"Mine-reeve","counts the ore-carts down from the workings.");
  /* archetype notables */
  var an=def.notables||[];
  for(var i=0;i<an.length;i++){
    if(an[i].ruler)continue; /* already folded into ruler role */
    add(npcName(rng),an[i].role,rng.pick(an[i].lines));
  }
  /* a renowned master gets a name */
  var bestK=null,bestQ=0;
  for(var k in Q)if(Q[k]>bestQ){bestQ=Q[k];bestK=k;}
  if(bestK&&bestQ>=0.78){
    var cd=craftDef(bestK);
    add(npcName(rng),"Master "+cap(cd.noun),"whose "+cd.craft+" is the reason buyers know this town's name at all.");
  }
  if(S.magic>0&&rng.chance(0.8))add(npcName(rng),S.magic>0.6?"Town Enchanter":"Hedge-witch","sells warding knots, finds lost things; consulted more often than admitted.");

  var cap_n=(arch.key==="capital"||arch.key==="religious")?8:7;
  return {children:children,adults:adults,elderly:elderly,households:households,
          classes:classes,watch:watch,militia:militia,notables:nb.slice(0,cap_n)};
}

