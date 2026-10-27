/* ================= archetypes & craft quality ================= */
var SAINTS=["Elred","Maren","Oswin","Brigid","Cuthwin","Aldra","Tovan","Ysolt","Branoc","Wystan","Mireth","Halwen"];
var QKEYS=[
 {k:"smith",   craft:"smithing",        noun:"smith",      res:"iron"},
 {k:"weapons", craft:"blades & armor",  noun:"swordsmith", res:"iron"},
 {k:"vines",   craft:"wine",            noun:"vintner",    res:"vines"},
 {k:"brew",    craft:"ale",             noun:"brewer",     res:"fertile"},
 {k:"leather", craft:"leatherwork",     noun:"tanner",     res:"pasture"},
 {k:"pottery", craft:"pottery",         noun:"potter",     res:"clay"},
 {k:"wool",    craft:"cloth",           noun:"weaver",     res:"pasture"},
 {k:"ships",   craft:"shipwrighting",   noun:"shipwright", res:"timber"},
 {k:"herbcraft",craft:"remedies",       noun:"herbalist",  res:"herbs"}
];
function qualityLabel(q){return q<0.32?"poor":q<0.5?"plain":q<0.66?"good":q<0.82?"fine":"renowned";}
function seedQuality(rng,region,S,def){
  var Q={},R=region.res,qb=(def&&def.qBias)||{};
  for(var i=0;i<QKEYS.length;i++){
    var e=QKEYS[i];
    if((S[e.k]||0)<=0.12)continue;
    var tie=R[e.res]||0;
    Q[e.k]=clamp(0.34+tie*0.2+rng.gauss(0,0.09)+(qb[e.k]||0),0.08,0.92);
  }
  /* every town brews and tans something: guarantee a couple of crafts to speak of */
  var fb=["brew","leather","pottery"];
  for(var f=0;f<fb.length&&Object.keys(Q).length<2;f++){
    if(Q[fb[f]]==null)Q[fb[f]]=clamp(0.34+rng.gauss(0,0.09)+(qb[fb[f]]||0),0.08,0.92);
  }
  return Q;
}
function topQualityCraft(S,Q){
  var best=null,bw=0;
  for(var k in Q){var w=(S[k]||0);if(w>bw){bw=w;best=k;}}
  return best;
}
function craftDef(k){for(var i=0;i<QKEYS.length;i++)if(QKEYS[i].k===k)return QKEYS[i];return null;}

var ARCH={
 market:{label:"Market town",
   foundW:{market:2.2,crossroads:1.3},Smul:{farm:1.15,brew:1.1,trade:1.05},
   targetMul:1,wealthBias:0,gov:{},
   infra:[{key:"marketcross",pop:340,label:"Market cross raised"},{key:"fairground",pop:2600,label:"Fair charter granted"}],
   occ:[],namePre:[],nameSuf:[],
   epithets:["where the valley sells its grain","of the Tuesday market"],
   prose:"Above all it is a market town: the countryside's surplus funnels through its square, and its fortunes rise and fall with the harvest."},
 mining:{label:"Mining town",
   need:{relief:1},resFloor:{iron:0.55,stone:0.3},foundW:{mine:6},
   Smul:{mine:1.5,smith:1.35,precious:1.2,quarry:1.1},Sfloor:{mine:0.45},
   targetMul:1,wealthBias:0.06,gov:{bias:"lord"},qBias:{smith:0.12},
   infra:[{key:"adits",pop:60,label:"First adits driven"},{key:"orerow",pop:380,label:"Miners' row built"},{key:"deepworks",pop:1200,label:"Deep galleries timbered"}],
   occ:[{n:"Miners & ore-breakers",d:16,g:"Crafts"},{n:"Charcoal burners",d:420,g:"Crafts"}],
   notables:[{role:"Master of the Workings",lines:["keeps the tally of every cart that comes down the ore road.","has buried more friends underground than above it."]}],
   namePre:["Iron","Ore","Delf","Pick","Grim","Deep"],nameSuf:["delf","pit","fell","cleugh"],
   epithets:["where the hills are hollow","rich in ore and short on daylight"],
   prose:"It is a mining town first and everything else second: the adits in the high ground set the rhythm of its days, and the ore road is its true main street."},
 port:{label:"Port town",
   need:{coast:1},resFloor:{fish:0.45},foundW:{harbor:5},
   Smul:{fish:1.3,ships:1.4,trade:1.35,salt:1.15},Sfloor:{ships:0.3},
   targetMul:1.1,wealthBias:0.07,gov:{bias:"council"},qBias:{ships:0.1},
   infra:[{key:"quay",pop:300,label:"Timber quay driven"},{key:"lighthouse",pop:1500,label:"Harbor light kindled"},{key:"customs",pop:2200,label:"Customs house chartered"}],
   occ:[{n:"Dockhands & lightermen",d:140,g:"Trade & services"},{n:"Sailmakers",d:900,g:"Crafts"}],
   notables:[{role:"Pilot-master",lines:["knows every bar and shoal by the color of the water.","takes the big hulls in over the sands, for a fee and a prayer."]}],
   namePre:["Salt","Tide","Gull","Herring","Anchor","Storm"],nameSuf:["haven","port","mouth","wick","quay"],
   epithets:["smelling of tar and tide","where the cogs winter"],
   prose:"It is a port before it is anything: the quays are its heart, the tide its clock, and half the town's quarrels are settled by who owns which berth."},
 religious:{label:"Abbey town",
   foundW:{holy:8},Smul:{herbcraft:1.25,brew:1.15,trade:1.1},
   targetMul:0.95,wealthBias:0.05,gov:{bias:"temple"},qBias:{brew:0.1,herbcraft:0.1},
   infra:[{key:"abbey",pop:240,label:"Abbey founded"},{key:"hospice",pop:700,label:"Pilgrims' hospice raised"},{key:"belltower",pop:1500,label:"Great bell hung"}],
   occ:[{n:"Monks, nuns & lay brothers",d:55,g:"Cloister & chapter"},{n:"Pilgrim hostellers",d:520,g:"Cloister & chapter"},{n:"Candle & badge makers",d:800,g:"Cloister & chapter"}],
   notables:[{role:"Almoner",lines:["feeds the poor at the abbey gate and knows every hard-luck story in three parishes.","keeps the abbey's charity and, quietly, its intelligence."]},
             {role:"Master of Pilgrims",lines:["beds down the faithful and prices the badges.","can tell a true pilgrim from a pickpocket at forty paces."]}],
   namePre:["Saint","Bell","Cross","Prior","Abbey","Monk"],nameSuf:["minster","well","cross","stow"],
   epithets:["where pilgrims still come","under the great bell"],
   prose:"It is an abbey town: the cloister owns the best land, the bell orders the day, and pilgrim silver is the truest crop it raises."},
 capital:{label:"Capital",
   foundW:{crossroads:2,defense:2,market:1.5},Smul:{trade:1.4,smith:1.15,brew:1.1},
   targetMul:2.4,targetMin:9000,wealthBias:0.18,gov:{force:"crown"},
   infra:[{key:"palace",pop:600,label:"Royal palace begun"},{key:"garrison",pop:900,label:"Garrison barracks raised"},{key:"mint",pop:1200,label:"Royal mint established"},{key:"highcourt",pop:5000,label:"High court seated"}],
   occ:[{n:"Clerks of the crown",d:260,g:"Crown & garrison"},{n:"Courtiers & retainers",d:210,g:"Crown & garrison"},{n:"Garrison soldiers",d:55,g:"Crown & garrison"},{n:"Mint workers",d:1600,g:"Crown & garrison"}],
   notables:[{role:"Lord Chancellor",lines:["seals what the Crown wills and files what it forgets.","is said to know the kingdom's debts to the last penny — including the secret ones."]},
             {role:"Marshal of the City",lines:["commands the garrison and despises the watch.","keeps the peace of the realm inside one set of walls."]}],
   namePre:["King's","Queen's","Crown","High","Old"],nameSuf:["burgh","hold","mark","court"],
   epithets:["seat of the Crown","where the realm is argued"],
   prose:"It is the capital: the Crown sits here, and with it the court, the mint, the garrison, and every ambition in the realm that can afford the rents."},
 tradepost:{label:"Trading post",
   foundW:{crossroads:5,harbor:1.5},Smul:{trade:1.6,brew:1.2},Sfloor:{trade:0.5},
   targetMul:0.8,wealthBias:0.08,gov:{bias:"charter"},
   infra:[{key:"caravanserai",pop:380,label:"Caravanserai built"},{key:"fairground",pop:900,label:"Fairground staked out"}],
   occ:[{n:"Caravan masters & drovers",d:120,g:"Trade & services"},{n:"Factors & warehousemen",d:330,g:"Trade & services"}],
   notables:[{role:"Master of the Caravans",lines:["decides which trains leave, when, and carrying whose goods.","has crossed the long roads forty times and trusts none of them."]},
             {role:"Keeper of the Toll",lines:["counts every axle through the gate.","is incorruptible, which everyone agrees is very inconvenient."]}],
   namePre:["Wain","Toll","Mile","Span","Far"],nameSuf:["market","gate","wick","cross"],
   epithets:["where the roads shake hands","living off the through-trade"],
   prose:"It is a trading post: more goods pass through it than are made in it, and the town's whole art is taking a thin slice of everything that moves."},
 fortress:{label:"Fortress town",
   need:{relief:1},foundW:{defense:6},Smul:{weapons:1.5,smith:1.3,danger:1},Sfloor:{smith:0.3},
   targetMul:0.85,wealthBias:0,gov:{bias:"lord"},qBias:{weapons:0.1},
   infra:[{key:"garrison",pop:160,label:"Garrison barracks raised"},{key:"watchtowers",pop:420,label:"Road watchtowers manned"}],
   occ:[{n:"Garrison soldiers",d:11,g:"Crown & garrison"},{n:"Quartermaster's staff",d:160,g:"Crown & garrison"}],
   notables:[{role:"Castellan",lines:["holds the walls for a lord who rarely visits.","drills the garrison at dawn and the militia on Sundays."],ruler:true},
             {role:"Sergeant of the Gate",lines:["decides who enters after dark, and remembers everyone who ever argued.","has held the gate through two sieges and one wedding riot."]}],
   namePre:["Watch","Shield","Spear","Grim","March","Border"],nameSuf:["guard","hold","wall","gate","keep"],
   epithets:["the realm's stubborn knuckle","that has never been taken"],
   prose:"It is a fortress town: the garrison is its largest trade, the walls its proudest possession, and peace — whenever it comes — is quietly bad for business."},
 scholar:{label:"College town",
   foundW:{market:1.5,crossroads:1.3,holy:1.5},Smul:{herbcraft:1.3,trade:1.1},
   targetMul:0.9,wealthBias:0.06,gov:{bias:"charter"},qBias:{herbcraft:0.12},
   infra:[{key:"college",pop:400,label:"College chartered"},{key:"scriptorium",pop:700,label:"Scriptorium established"},{key:"library",pop:1300,label:"Library endowed"}],
   occ:[{n:"Scholars & masters",d:75,g:"College & scriptorium"},{n:"Scribes & copyists",d:230,g:"College & scriptorium"},{n:"Parchmenters & ink-makers",d:600,g:"College & scriptorium"}],
   notables:[{role:"Dean of the College",lines:["rules four hundred quarrelsome scholars with a bell and a budget.","has been threatening to resign for eleven years."]},
             {role:"Master Librarian",lines:["chains the books and remembers who touched them.","is owed favors by half the realm's clerks."]}],
   namePre:["Clerk","Quill","Candle","Ink"],nameSuf:["hall","ford","well","wick"],
   epithets:["of the chained books","arguing since its founding"],
   prose:"It is a college town: term-time doubles its population, the scriptorium's ink trade reaches three kingdoms, and the loudest fights are over Latin."},
 vintner:{label:"Wine town",
   need:{relief:1},resFloor:{vines:0.55},foundW:{market:2},
   Smul:{vines:1.6,brew:0.9,trade:1.15},Sfloor:{vines:0.5},
   targetMul:0.9,wealthBias:0.08,gov:{},qBias:{vines:0.2},
   infra:[{key:"press",pop:200,label:"Common press-house built"},{key:"cellars",pop:900,label:"Deep cellars cut"}],
   occ:[{n:"Vineyard hands",d:45,g:"Crafts"},{n:"Cellarers",d:380,g:"Crafts"}],
   notables:[{role:"Warden of the Vines",lines:["calls the harvest day, and woe to whoever picks early.","can name the slope a wine came from blindfolded."]}],
   namePre:["Vine","Grape","Sun","Terrace"],nameSuf:["garth","slope","cote","well"],
   epithets:["of the terraced slopes","whose cellars are deeper than its wells"],
   prose:"It is a wine town: the terraces above it are worth more than everything inside the walls, and the whole year bends toward the harvest."},
 lumber:{label:"Timber town",
   resFloor:{timber:0.6},foundW:{crossroads:1.5,market:1.2},
   Smul:{forestry:1.6,ships:1.1,smith:1.05},Sfloor:{forestry:0.5},
   targetMul:0.8,wealthBias:0,gov:{bias:"lord"},
   infra:[{key:"sawmill",pop:180,label:"Sawmill raised"},{key:"logpond",pop:400,label:"Log pond dammed"}],
   occ:[{n:"Fellers & sawyers",d:60,g:"Crafts"},{n:"Pitch & tar boilers",d:700,g:"Crafts"}],
   notables:[{role:"Master of the Woods",lines:["marks which trees fall and which stand another century.","answers to the lord for every oak and to nobody for the rest."]}],
   namePre:["Saw","Axe","Timber","Oak","Tar"],nameSuf:["fall","hew","ley","stock"],
   epithets:["built of its own felling","where the woods pay the rents"],
   prose:"It is a timber town: the forest is its mine and its master, log drives mark its seasons, and everything it owns smells faintly of pitch."}
};

function chooseArchetype(rng,cfg,region,founding,S,baseTarget){
  if(cfg.archetype&&cfg.archetype!=="auto"&&ARCH[cfg.archetype]){
    return {key:cfg.archetype,def:ARCH[cfg.archetype],emergent:false};
  }
  var sc=[
    {v:"market",   w:1.25+(S.farm||0)*1.2},
    {v:"mining",   w:(S.mine||0)*3+(founding.key==="mine"?2:0)},
    {v:"port",     w:region.hasCoast?((founding.key==="harbor"?3.2:1.0)+(S.fish||0)+(S.trade||0)*0.6):0},
    {v:"religious",w:(founding.key==="holy"?4.5:0.22)},
    {v:"capital",  w:(baseTarget>=12000&&!cfg.popOverride)?0.5:0},
    {v:"tradepost",w:(founding.key==="crossroads"?2.4:0.35)+(S.trade||0)*0.8},
    {v:"fortress", w:(founding.key==="defense"?2.4:0.15)+(cfg.danger>=2?1.2:0)},
    {v:"scholar",  w:(baseTarget>=1500?0.22:0)},
    {v:"vintner",  w:(S.vines||0)*2.6},
    {v:"lumber",   w:(S.forestry||0)*(region.terrain==="forest"?2.6:1.4)}
  ].filter(function(x){return x.w>0;});
  var key=rng.wpick(sc);
  return {key:key,def:ARCH[key],emergent:true};
}
function applyArchToS(S,def){
  if(def.Smul)for(var k in def.Smul)S[k]=(S[k]||0)*def.Smul[k];
  if(def.Sfloor)for(var f in def.Sfloor)S[f]=Math.max(S[f]||0,def.Sfloor[f]);
  S.smith=clamp(S.smith||0,0,1.3);S.trade=clamp(S.trade||0,0,1.3);
}
function applyArchToRegion(rng,region,def){
  var coerced=false;
  if(def.need){
    if(def.need.coast&&!region.hasCoast){region.hasCoast=true;coerced=true;if(!region.res.fish)region.res.fish=rng.rf(0.45,0.85);}
    if(def.need.river&&!region.hasRiver){region.hasRiver=true;coerced=true;}
    if(def.need.relief&&region.relief<def.need.relief){region.relief=def.need.relief;coerced=true;}
  }
  if(def.resFloor)for(var k in def.resFloor){
    if((region.res[k]||0)<def.resFloor[k]){region.res[k]=clamp(def.resFloor[k]+rng.rf(0,0.25),0,1);coerced=coerced||true;}
  }
  return coerced;
}

