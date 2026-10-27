
/* ==================================================================
   TOWNWRIGHT ENGINE — pure, DOM-free. globalThis.Townwright.generate(cfg)
   ================================================================== */
(function(){
"use strict";
var VERSION="2.0.0";
var PRESENT_YEAR=1453; /* year of the Common Reckoning */

/* ---------------- seeded RNG ---------------- */
function xmur3(str){var h=1779033703^str.length;for(var i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=h>>>16)>>>0;};}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function RNG(seedStr){
  var f=mulberry32(xmur3(String(seedStr))());
  var r={};
  r.f=function(){return f();};
  r.rf=function(a,b){return a+(b-a)*f();};
  r.ri=function(a,b){return Math.floor(a+(b-a+1)*f());};
  r.chance=function(p){return f()<p;};
  r.pick=function(arr){return arr[Math.floor(f()*arr.length)];};
  r.wpick=function(items){ /* [{v,w}] */
    var tot=0,i;for(i=0;i<items.length;i++)tot+=items[i].w;
    var x=f()*tot;
    for(i=0;i<items.length;i++){x-=items[i].w;if(x<=0)return items[i].v;}
    return items[items.length-1].v;
  };
  r.gauss=function(mu,sig){var u=0,v=0;while(u===0)u=f();while(v===0)v=f();return mu+sig*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  r.shuffle=function(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(f()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;};
  return r;
}
function clamp(x,a,b){return x<a?a:(x>b?b:x);}
function round(x){return Math.round(x);}
function fmt(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,",");}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

/* ---------------- static data ---------------- */
var RES_DEFS=[
  {k:"fertile", label:"Fertile soil",  grp:"land"},
  {k:"pasture", label:"Pasture",       grp:"land"},
  {k:"vines",   label:"Vineyards",     grp:"land"},
  {k:"timber",  label:"Timber",        grp:"wood"},
  {k:"furs",    label:"Game & furs",   grp:"wood"},
  {k:"herbs",   label:"Wild herbs",    grp:"wood"},
  {k:"iron",    label:"Iron ore",      grp:"stone"},
  {k:"coppertin",label:"Copper & tin", grp:"stone"},
  {k:"silver",  label:"Silver",        grp:"stone"},
  {k:"gold",    label:"Gold",          grp:"stone"},
  {k:"gems",    label:"Gemstones",     grp:"stone"},
  {k:"stone",   label:"Good stone",    grp:"stone"},
  {k:"clay",    label:"Clay beds",     grp:"stone"},
  {k:"salt",    label:"Salt",          grp:"stone"},
  {k:"fish",    label:"Fisheries",     grp:"water"}
];

var SIZES={
  hamlet:[60,180], village:[200,900], smalltown:[1000,2500],
  town:[2500,6000], largetown:[6000,12000], city:[12000,28000]
};
var AGES={young:[30,80],established:[90,300],old:[300,600],ancient:[600,1100]};

/* occupations: d = one per d people (base), tags multiply with industry strengths */
var OCC=[
 {n:"Taverns & alehouses",      d:430,  g:"Food & drink", tags:{trade:.45,fish:.35,mine:.5}},
 {n:"Inns (lodging)",           d:1900, g:"Food & drink", tags:{trade:1.0,fish:.3}},
 {n:"Bakers",                   d:750,  g:"Food & drink", tags:{mill:.3}},
 {n:"Butchers",                 d:1050, g:"Food & drink", tags:{pastoral:.6}},
 {n:"Fishmongers",              d:1150, g:"Food & drink", tags:{fish:1.8}, req:"fish"},
 {n:"Brewers",                  d:850,  g:"Food & drink", tags:{farm:.5}},
 {n:"Millers",                  d:1500, g:"Food & drink", tags:{mill:1.0}, req:"mill"},
 {n:"Vintners",                 d:1500, g:"Food & drink", tags:{vines:2.4}, req:"vines"},
 {n:"Cobblers & shoemakers",    d:220,  g:"Crafts"},
 {n:"Tailors & seamstresses",   d:310,  g:"Crafts"},
 {n:"Carpenters",               d:360,  g:"Crafts", tags:{forestry:.4,ships:.3}},
 {n:"Masons",                   d:640,  g:"Crafts", tags:{masonry:1.0}},
 {n:"Blacksmiths",              d:950,  g:"Crafts", tags:{smith:2.4,mine:.6}},
 {n:"Weavers",                  d:520,  g:"Crafts", tags:{wool:1.9}},
 {n:"Fullers & dyers",          d:1300, g:"Crafts", tags:{wool:2.2}, req:"wool"},
 {n:"Tanners",                  d:1500, g:"Crafts", tags:{leather:1.6,furs:.5}},
 {n:"Potters & brickmakers",    d:1500, g:"Crafts", tags:{pottery:2.0}, req:"pottery"},
 {n:"Coopers",                  d:950,  g:"Crafts", tags:{brew:.4,fish:.4,trade:.3}},
 {n:"Ropemakers",               d:1900, g:"Crafts", tags:{ships:1.6,fish:.5}},
 {n:"Shipwrights",              d:2600, g:"Crafts", tags:{ships:2.6}, req:"ships"},
 {n:"Wainwrights & cartwrights",d:1700, g:"Crafts", tags:{trade:.9,mine:.4}},
 {n:"Armorers",                 d:4200, g:"Crafts", tags:{weapons:2.2}, req:"weapons"},
 {n:"Bowyers & fletchers",      d:2500, g:"Crafts", tags:{forestry:.5,danger:.7}},
 {n:"Furriers",                 d:1900, g:"Crafts", tags:{furs:2.2}, req:"furs"},
 {n:"Jewelers & goldsmiths",    d:2600, g:"Crafts", tags:{precious:2.6,trade:.4}},
 {n:"Saddlers & harness-makers",d:1250, g:"Crafts", tags:{trade:.5,pastoral:.4}},
 {n:"Chandlers (candles, soap)",d:1250, g:"Crafts"},
 {n:"Mercers & merchants",      d:700,  g:"Trade & services", tags:{trade:1.3}},
 {n:"Carters & teamsters",      d:600,  g:"Trade & services", tags:{trade:.9,mine:.7,quarry:.5}},
 {n:"Stevedores & boatmen",     d:520,  g:"Trade & services", tags:{ships:.8,fish:.8}, req:"water"},
 {n:"Moneychangers",            d:3200, g:"Trade & services", tags:{trade:1.6,precious:.6}},
 {n:"Scribes & notaries",       d:2100, g:"Trade & services", tags:{trade:.5,charter:.6}},
 {n:"Barbers (& surgeons)",     d:820,  g:"Trade & services"},
 {n:"Physicians",               d:2300, g:"Trade & services"},
 {n:"Apothecaries & herbalists",d:1900, g:"Trade & services", tags:{herbcraft:1.8,magic:.9}},
 {n:"Hedge-mages & enchanters", d:5200, g:"Rare trades", tags:{magic:3.2}, req:"magic"}
];

/* ------------- name morphemes ------------- */
var NAMES={
  pre_mine:["Iron","Forge","Delf","Grim","Coal","Ore","Hammer","Black"],
  pre_gold:["Gold","Glitter","Gild","Silver"],
  pre_coast:["Salt","Tide","Wave","Gull","Herring","Brine","Sea","Storm"],
  pre_river:["Ford","Bridge","Mill","Otter","Reed","Eel","Swan"],
  pre_fertile:["Wheat","Barley","Mead","Ox","Apple","Harrow","Fallow"],
  pre_forest:["Oak","Ash","Elm","Thorn","Birch","Alder","Hart","Wolf"],
  pre_hill:["Stone","Crag","Tor","High","Fell","Cold"],
  pre_wool:["Ram","Wool","Shep","Fleece"],
  pre_generic:["King's","Bishop's","Old","New","White","Red","Fair","Crow","Raven","Dun","East","West","North","South"],
  suf_river:["ford","bridge","mill","bourne","mere","wade"],
  suf_coast:["haven","mouth","wick","port","strand","ness"],
  suf_mine:["delf","pit","forge","fell"],
  suf_hill:["dale","cliff","tor","crag","fell"],
  suf_generic:["ton","ham","stead","field","by","thorpe","worth","cote","market","burgh","well","ley","den","wick"]
};
var TAVERN_ADJ=["Gilded","Crooked","Drowned","Merry","Salty","Iron","Black","Wandering","Thirsty","Brazen","Sleeping","Howling","Copper","Velvet","Broken","Laughing","Rusty","Silver","Honest","Limping"];
var TAVERN_NOUN_BASE=["Goose","Lantern","Stag","Barrel","Crow","Maiden","Plough","Tankard","Boar","Rose","Hound","Griffin","Cup","Wheel","Bell","Piper"];
var TAVERN_NOUN_TAGGED={fish:["Kraken","Net","Mermaid","Anchor","Herring","Gull"],mine:["Pickaxe","Anvil","Lamp","Mole"],wool:["Ram","Fleece","Shuttle"],forestry:["Axe","Acorn","Wolf"],trade:["Wagon","Purse","Mule"],vines:["Grape","Goblet"]};
var NPC_FIRST_A=["Al","Ber","Cal","Dor","Ed","Fen","Gar","Hal","Is","Jor","Kel","Lun","Mar","Ned","Or","Pet","Quin","Ros","Sam","Tam","Ulf","Ver","Wil","Yor"];
var NPC_FIRST_B=["ric","win","mund","da","eth","wyn","bert","gar","sa","ton","drik","ina","mer","old","ja","ren","na","el","fred","is","ward","ya"];
var NPC_SURN_OCC=["Smith","Tanner","Cooper","Weaver","Fletcher","Mason","Carter","Fisher","Salter","Shepherd","Wright","Baker","Dyer","Ward","Hale"];
var NPC_SURN_TOPO=["of the Ford","Underhill","Atwater","Greenfield","of the Crag","Longacre","Birchwood","Stoneholt","Marshborn","Fairweather","Ashdown","Coppersworth"];

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

/* ================= region ================= */
var TERRAINS=["coastal","estuary","riverlands","plains","hills","foothills","forest"];
function genRegion(rng,cfg){
  var terrain=cfg.terrain!=="auto"?cfg.terrain:rng.wpick([
    {v:"coastal",w:17},{v:"estuary",w:10},{v:"riverlands",w:20},{v:"plains",w:16},
    {v:"hills",w:14},{v:"foothills",w:11},{v:"forest",w:12}]);
  var climate=cfg.climate!=="auto"?cfg.climate:rng.wpick([{v:"cold",w:25},{v:"temperate",w:50},{v:"warm",w:25}]);
  var hasCoast=(terrain==="coastal"||terrain==="estuary");
  var hasRiver=(terrain==="estuary"||terrain==="riverlands"||(terrain!=="coastal"&&rng.chance(terrain==="plains"?0.35:0.45))||(terrain==="coastal"&&rng.chance(0.2)));
  if(terrain==="estuary")hasRiver=true;
  var relief = terrain==="foothills"?2 : (terrain==="hills"?2 : (terrain==="forest"||terrain==="riverlands")?(rng.chance(.4)?1:0) : terrain==="plains"?0 : (rng.chance(.5)?1:0));
  var forestCover = terrain==="forest"?rng.rf(.65,.95) : terrain==="foothills"?rng.rf(.3,.6) : terrain==="hills"?rng.rf(.2,.5) : rng.rf(.08,.4);

  var R={}; /* richness map */
  function seed(k,p,lo,hi){ if(rng.chance(p)) R[k]=rng.rf(lo,hi); }
  /* land */
  var fertP={coastal:.7,estuary:.92,riverlands:.97,plains:.95,hills:.7,foothills:.5,forest:.55}[terrain];
  var fertHi={coastal:.7,estuary:.95,riverlands:1,plains:.95,hills:.6,foothills:.45,forest:.5}[terrain];
  seed("fertile",fertP,.2,fertHi);
  seed("pasture",(relief>=1?.8:.55),.2,(relief>=1?.9:.6));
  if(climate!=="cold"&&(relief>=1||hasRiver)) seed("vines",climate==="warm"?.45:.2,.25,.85);
  /* wood */
  if(forestCover>.3) R.timber=clamp(forestCover+rng.rf(-.1,.1),.2,1);
  if(forestCover>.4&&(climate==="cold"||relief>=1)) seed("furs",.55,.25,.85);
  if(forestCover>.25||relief>=1) seed("herbs",.35+(cfg.magic==="low"?.2:cfg.magic==="scarce"?.08:0),.15,.6+(cfg.magic==="low"?.3:0));
  /* stone & ore */
  if(relief>=1){
    seed("iron",relief===2?.62:.42,.3,1);
    seed("coppertin",.22,.25,.8);
    seed("stone",.55,.3,.95);
    if(relief===2){ seed("silver",.1,.3,.9); seed("gems",.07,.3,.9); }
    seed("gold",relief===2?.08:.04,.35,1);
  }
  if(terrain==="plains"||terrain==="riverlands"||terrain==="estuary") seed("clay",.5,.3,.9);
  else seed("clay",.2,.2,.6);
  if(hasCoast&&climate!=="cold") seed("salt",.3,.4,.95);
  if(!R.salt) seed("salt",.06,.5,1); /* rock salt — rare, anywhere */
  /* water */
  if(hasCoast) R.fish=rng.rf(.5,1);
  else if(hasRiver) seed("fish",.75,.2,.6);

  /* manual overrides */
  if(cfg.resources){ for(var k in cfg.resources){ var o=cfg.resources[k]; if(o&&o.auto===false){ if(o.on)R[k]=clamp(o.rich,0.05,1); else delete R[k]; } } }
  /* coherence: fish needs water — grant a river if forced */
  if(R.fish&&!hasCoast&&!hasRiver)hasRiver=true;

  return {terrain:terrain,climate:climate,hasCoast:hasCoast,hasRiver:hasRiver,relief:relief,forestCover:forestCover,res:R};
}

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

/* ============== industry strengths (potential) ============== */
function industryStrengths(rng,cfg,region){
  var R=region.res, m=cfg.indMult||{};
  function mm(k){return m[k]==null?1:m[k];}
  var S={};
  S.farm   =(R.fertile||0);
  S.pastoral=(R.pasture||0);
  S.fish   =(R.fish||0)*(region.hasCoast?1:.6)*mm("sea");
  S.mine   =Math.max(R.iron||0,(R.coppertin||0)*.85,(R.silver||0),(R.gold||0),(R.gems||0))*mm("mining");
  S.precious=Math.max((R.silver||0),(R.gold||0)*1.1,(R.gems||0))*mm("mining");
  S.quarry =(R.stone||0)*.9;
  S.pottery=(R.clay||0)*.9;
  S.salt   =(R.salt||0);
  S.forestry=(R.timber||0);
  S.furs   =(R.furs||0);
  S.wool   =(R.pasture||0)*(0.6+(R.fertile||0)*.3)*mm("wool");
  S.smith  =clamp((R.iron||0)*(0.55+(R.timber||0)*.65),0,1.2)*mm("smith");
  S.weapons=S.smith>0.45?S.smith*.8:0;
  S.ships  =region.hasCoast?clamp((R.timber||0)*.9+.15,0,1)*mm("sea"):0;
  S.brew   =clamp((R.fertile||0)*.9,0,1);
  S.mill   =((R.fertile||0)>.25&&(region.hasRiver||region.terrain==="plains"))?clamp((R.fertile||0),0,1):0;
  S.leather=clamp((R.pasture||0)*.7+(R.furs||0)*.4,0,1);
  S.vines  =(R.vines||0);
  S.herbcraft=(R.herbs||0)*(cfg.magic==="none"?.7:cfg.magic==="scarce"?1:1.3);
  S.masonry=(R.stone||0)*.8;
  /* trade potential: routes + water + founding bonus resolved later */
  var tr=cfg.trade>=0?cfg.trade:( (region.hasCoast?1.2:0)+(region.hasRiver?.7:0)+rng.rf(0,1) );
  S.trade=clamp(tr/3,0,1.15)*mm("trade");
  S.magic=cfg.magic==="none"?0:cfg.magic==="scarce"?.5:1;
  S.danger=cfg.danger/3;
  return S;
}

/* ================= simulation ================= */
function chooseTarget(rng,cfg){
  if(cfg.popOverride)return clamp(cfg.popOverride,20,60000);
  var sizeKey=cfg.size!=="auto"?cfg.size:rng.wpick([{v:"hamlet",w:8},{v:"village",w:22},{v:"smalltown",w:26},{v:"town",w:24},{v:"largetown",w:13},{v:"city",w:7}]);
  var r=SIZES[sizeKey];
  /* log-uniform inside band feels better than uniform */
  return Math.round(Math.exp(rng.rf(Math.log(r[0]),Math.log(r[1]))));
}
function chooseAge(rng,cfg){
  if(cfg.ageYears)return clamp(cfg.ageYears,10,1500);
  var k=cfg.age!=="auto"?cfg.age:rng.wpick([{v:"young",w:14},{v:"established",w:40},{v:"old",w:30},{v:"ancient",w:16}]);
  var r=AGES[k];return rng.ri(r[0],r[1]);
}

function foodCapacity(region,S,tradeLvl,wealth){
  var R=region.res;
  var climF=region.climate==="warm"?1.12:region.climate==="cold"?0.8:1;
  var local=2600*Math.pow(R.fertile||0,1.05)*climF + 420*(R.pasture||0) + (region.hasCoast?2300:(region.hasRiver?1100:0))*(R.fish||0);
  local=Math.max(local,160); /* even bad land feeds a hamlet */
  var imports=tradeLvl*(3800+wealth*2600);
  return {local:local,imports:imports,total:local+imports};
}

var EVENTS=[
 {k:"fire",   w:function(c){return c.pop>500?(1.1+(c.S.forestry||0)*.6):0;},
   t:function(c,r){c.popF*=r.rf(.92,.975);c.wealth-= .04;return "A great fire sweeps the "+r.pick(["lower","old","market","river","craft"])+" quarter; "+r.pick(["forty","sixty","a hundred"])+" roofs are lost in a night.";}},
 {k:"plague", w:function(c){return c.pop>1300?(.8+(c.region.hasCoast?.8:0)):0;},
   t:function(c,r){c.popF*=r.rf(.74,.9);c.wealth-=.06;return "Plague comes "+ (c.region.hasCoast?"off a foreign hull":"up the road with the drovers")+". The bells do not stop for a season.";}},
 {k:"raid",   w:function(c){return c.cfg.danger*0.9;},
   t:function(c,r){c.popF*=r.rf(.94,.99);c.wantWalls=true;return r.pick(["Raiders","Reavers","A rival lord's riders"])+" burn the outlying farms; the survivors press inside and talk turns to walls.";}},
 {k:"charter",w:function(c){return (!c.charter&&c.pop>650&&c.S.trade>.3)?1.4:0;},
   t:function(c,r){c.charter=true;c.wealth+=.12;c.growthBoost+=.05;return "A royal charter grants market rights and freedom from the lord's toll. Merchants take notice.";}},
 {k:"vein",   w:function(c){return c.S.mine>.3?.9:0;},
   t:function(c,r){c.growthBoost+=.06;c.wealth+=.08;return "Miners strike a new vein "+r.pick(["rich beyond the old workings","that glitters in the lamplight","deeper than any yet dug"])+". The camps swell within the year.";}},
 {k:"exhaust",w:function(c){return (c.S.mine>.35&&c.year-c.founded>120&&!c.veinDead&&c.r.chance(.5))?.8:0;},
   t:function(c,r){c.veinDead=true;c.mineDecay=.45;c.wealth-=.1;return "The old vein pinches out. Half the deep galleries flood, and the ore carts run lighter each season.";}},
 {k:"bridge", w:function(c){return (c.region.hasRiver&&!c.bridge&&c.pop>450)?1.2:0;},
   t:function(c,r){c.bridge=true;c.wealth+=.06;c.growthBoost+=.03;return "A stone bridge replaces the old ford. Toll silver pays for it within a decade.";}},
 {k:"harbor", w:function(c){return (c.region.hasCoast&&!c.harborWorks&&c.pop>1400)?1:0;},
   t:function(c,r){c.harborWorks=true;c.wealth+=.07;return "A breakwater and new quays are raised; deep-keeled cogs can now winter here.";}},
 {k:"famine", w:function(c){return (c.S.farm<.4)?(1-(c.S.farm))*1.1:0;},
   t:function(c,r){c.popF*=r.rf(.9,.97);return "Two failed harvests running. Grain is bought dear from "+r.pick(["the river barges","downland merchants","the church stores"])+", and not everyone is fed.";}},
 {k:"temple", w:function(c){return (!c.templeFound&&c.pop>550)?.7:0;},
   t:function(c,r){c.templeFound=true;return "A wandering order is granted land; their bell is the first thing travelers hear.";}},
 {k:"guild",  w:function(c){return (c.pop>1700&&!c.guild)?.8:0;},
   t:function(c,r){c.guild=true;c.wealth+=.05;return "The "+r.pick(["smiths","weavers","mercers","coopers","masons"])+" charter a guild, fix their prices, and build a hall to argue in.";}},
 {k:"master", w:function(c){return (c.pop>300&&c.qList.length)?0.95:0;},
   t:function(c,r){
     var pool=c.qList.map(function(k){return {v:k,w:(c.S[k]||0)+0.1};});
     var k=r.wpick(pool),cd=craftDef(k);
     c.Q[k]=Math.min(0.95,c.Q[k]+r.rf(0.10,0.18));
     return "A master "+cd.noun+" out of "+r.pick(["the south","the old capital","across the water","the guild towns"])+" settles here; apprentices follow within the year.";}},
 {k:"shoddy", w:function(c){return c.qList.length?0.35:0;},
   t:function(c,r){
     var k=topQualityCraft(c.S,c.Q)||c.qList[0],cd=craftDef(k);
     c.Q[k]=Math.max(0.05,c.Q[k]-r.rf(0.05,0.10));
     return "A scandal of short measures and shoddy work stains the "+cd.noun+"s' name; buyers go elsewhere for a season.";},minor:true},
 {k:"feud",   w:function(){return .35;},
   t:function(c,r){return r.pick(["A dispute over pannage rights ends in a famous fistfight on the bridge.","The old reeve dies; three families claim his office for a contentious year.","A two-headed calf is born; opinions differ sharply on what it portends."]);},minor:true}
];

var ARCH_EVENTS={
 mining:[
  {k:"collapse",w:function(c){return .7;},
   t:function(c,r){c.popF*=r.rf(.965,.99);return "A gallery comes down in the "+r.pick(["north","deep","old"])+" workings. The bell tolls "+r.ri(4,14)+" times.";}}],
 port:[
  {k:"gale",w:function(c){return 1.0;},
   t:function(c,r){c.popF*=r.rf(.97,.995);c.wealth-=.05;return "An autumn gale drives "+r.pick(["three","five","seven"])+" boats onto the bar; the town buries its drowned and rebuilds its drying racks.";}},
  {k:"factor",w:function(c){return c.S.trade>.4?.8:0;},
   t:function(c,r){c.wealth+=.07;return "A foreign trading house opens a factory on the quay; strange coin and stranger fashions follow.";}}],
 religious:[
  {k:"pilgrim",w:function(c){return c.pop>200?1.2:0;},
   t:function(c,r){c.wealth+=.05;c.growthBoost+=.04;return "Word of a healing at the shrine spreads "+r.pick(["down the river","along the pilgrim road","through the courts"])+"; pilgrim traffic doubles for a generation.";}},
  {k:"relic",w:function(c){return (!c.relic&&c.pop>600)?.8:0;},
   t:function(c,r){c.relic=true;c.wealth+=.1;return "The abbey acquires a relic of St. "+r.pick(SAINTS)+", by gift or by means not closely examined. Offerings triple.";}}],
 capital:[
  {k:"court",w:function(){return .9;},
   t:function(c,r){c.wealth+=.04;return "The court winters here in unusual splendor; prices triple, and so do several fortunes.";},minor:true},
  {k:"intrigue",w:function(){return .6;},
   t:function(c,r){return r.pick(["A chancellor falls; the city watches the scaffold and adjusts its loyalties.","Two great houses feud through the law courts for a decade, enriching every clerk in town."]);},minor:true}],
 fortress:[
  {k:"siege",w:function(c){return .5+c.cfg.danger*.4;},
   t:function(c,r){c.popF*=r.rf(.95,.985);c.wantWalls=true;c.wealth-=.04;return "A "+r.pick(["summer","winter","season's"])+" siege is weathered behind the walls; the granaries empty, but the gate holds.";}}],
 scholar:[
  {k:"libfire",w:function(c){return c.pop>800?.4:0;},
   t:function(c,r){c.wealth-=.03;return "Fire takes the library's west range; three irreplaceable codices are lost and mourned louder than any alderman.";}},
  {k:"gift",w:function(c){return .5;},
   t:function(c,r){c.wealth+=.06;return "A royal endowment founds two new chairs; the colleges quarrel magnificently over the money.";},minor:true}],
 tradepost:[
  {k:"bandits",w:function(c){return .5+c.cfg.danger*.5;},
   t:function(c,r){c.wealth-=.05;return "Banditry on the "+r.pick(["east","west","high"])+" road chokes the caravans for two seasons, until the toll silver buys outriders.";}}],
 lumber:[
  {k:"forestfire",w:function(c){return .6;},
   t:function(c,r){c.wealth-=.06;c.popF*=r.rf(.97,.995);return "Fire runs the dry woods for a week; the town saves itself by burning its own firebreak.";}},
  {k:"felling",w:function(c){return .6;},
   t:function(c,r){c.wealth+=.05;c.growthBoost+=.03;return "A great felling contract — keels for the fleet — brings two hundred axes into the woods.";}}],
 vintner:[
  {k:"vintage",w:function(c){return .8;},
   t:function(c,r){if(c.Q.vines!=null)c.Q.vines=Math.min(.95,c.Q.vines+.05);c.wealth+=.06;return "The year's vintage is spoken of for a decade; cellar space sells dearer than houses.";}},
  {k:"blight",w:function(c){return .5;},
   t:function(c,r){if(c.Q.vines!=null)c.Q.vines=Math.max(.08,c.Q.vines-.08);c.wealth-=.07;return "Blight takes the lower terraces; three years of grafting before the rows bear properly again.";}}]
};

function simulate(rng,cfg,region,founding,target,ageYears,S,arch,Q){
  var def=arch.def;
  var founded=PRESENT_YEAR-ageYears;
  var pop0={harbor:80,ford:60,mine:120,crossroads:55,market:70,defense:90,holy:50}[founding.key]||60;
  pop0=Math.min(pop0,target*.8);
  /* wealth potential */
  var wealth=.55+(S.trade*.5)+(S.precious*.7)+(S.mine*.25)+(S.wool*.25)+(S.fish*.15)+(S.salt*.3)+(S.farm*.15)+(S.vines*.2)+(def.wealthBias||0);
  if(cfg.prosperity!=="auto"){wealth={poor:.45,modest:.8,comfortable:1.25,wealthy:1.85}[cfg.prosperity];}
  /* food & trade reconciliation */
  var tradeLvl=clamp(S.trade*3,0,3), grainRoute=false;
  var food=foodCapacity(region,S,tradeLvl,wealth);
  if(target>food.total){ tradeLvl=clamp(tradeLvl+1.2,0,3.4); grainRoute=true; food=foodCapacity(region,S,tradeLvl,wealth); }
  if((cfg.popOverride||arch.key==="capital")&&target>food.total){ /* override & capitals: the grain route scales to feed them */
    grainRoute=true; tradeLvl=Math.max(tradeLvl,2);
    food={local:food.local,imports:Math.max(food.imports,Math.round(target*1.06-food.local)),total:0};
    food.total=food.local+food.imports;
  }
  var K=Math.min(target*1.04,Math.max(food.total,target*0.55));
  var hungerCapped=K<target*0.95;
  /* logistic params */
  var A=(K-pop0)/pop0;
  var rr=Math.log(A/0.0434)/Math.max(ageYears,10); /* reach ~95.8% of K at present */
  rr=Math.max(rr,0.004);
  var ctx={cfg:cfg,region:region,S:S,r:rng,pop:pop0,popF:1,wealth:wealth,year:founded,founded:founded,
           charter:cfg.government==="charter",bridge:false,harborWorks:false,templeFound:(arch.key==="religious"),guild:false,
           veinDead:false,mineDecay:1,growthBoost:0,wantWalls:false,relic:false,
           Q:Q,qList:Object.keys(Q)};
  var events=[],popByEra=[],infra=[],walls=null;
  function logE(y,txt,minor){events.push({year:y,text:txt,minor:!!minor});}
  /* founding line */
  var ftxt={
    harbor:"Fisherfolk first beach their boats in the lee of the headland; a customs post follows the catch.",
    ford:"Drovers cross here in the dry months. Someone builds an alehouse on the bank, then a smithy, then everything else.",
    mine:"Prospectors strike ore in the high ground. The first winter is tents and timber; the second, a street.",
    crossroads:"Two old roads meet on dry ground. A waystation becomes a hamlet almost without anyone deciding it.",
    market:"The valley's farms need somewhere to sell. A green, a well, and a market cross — the rest accretes.",
    defense:"Refugees of a border war fortify the height. Peace comes, but the families stay.",
    holy:"A spring said to heal draws pilgrims; an order raises a shrine, and trade follows the faithful."
  }[founding.key];
  logE(founded,"Founded at "+founding.label+" in "+founded+". "+ftxt);

  var evPool=EVENTS.concat(ARCH_EVENTS[arch.key]||[]);
  var ticks=Math.ceil(ageYears/10);
  for(var i=1;i<=ticks;i++){
    var t=Math.min(i*10,ageYears);
    ctx.year=founded+t;
    var base=K/(1+A*Math.exp(-(rr+ctx.growthBoost*0.03)*t));
    ctx.growthBoost*=0.6; /* booms fade */
    if(cfg.events&&rng.chance(0.27)){
      var pool=evPool.map(function(e){return {v:e,w:e.w(ctx)};}).filter(function(x){return x.w>0;});
      if(pool.length){
        var ev=rng.wpick(pool);var txt=ev.t(ctx,rng);logE(ctx.year,txt,ev.minor);
        if(ev.k==="fire"){var tq=topQualityCraft(S,ctx.Q);if(tq)ctx.Q[tq]=Math.max(0.05,ctx.Q[tq]-0.06);}
      }
    }
    /* craft quality feeds wealth, slowly */
    var qw=0;for(var qi=0;qi<ctx.qList.length;qi++){var qk=ctx.qList[qi];qw+=(S[qk]||0)*(ctx.Q[qk]-0.5);}
    ctx.wealth=clamp(ctx.wealth+qw*0.006,0.3,2.6);
    ctx.popF=clamp(ctx.popF,0.45,1.25);
    ctx.pop=Math.max(30,base*ctx.popF);
    popByEra.push({year:ctx.year,pop:Math.round(ctx.pop)});
    /* infrastructure thresholds (first crossing) */
    function once(key,cond,txt){ if(cond&&!infra.some(function(f){return f.key===key;})){infra.push({key:key,year:ctx.year,label:txt});} }
    once("well",ctx.pop>=50,"Town well dug");
    once("shrine",ctx.pop>=90,"Shrine raised");
    once("mill",S.mill>0&&ctx.pop>=260,(region.hasRiver?"Watermill built on the bank":"Windmill raised on the rise"));
    once("market",ctx.pop>=340,"Market square laid out"+(ctx.charter?" under charter":""));
    once("church",(ctx.pop>=(arch.key==="religious"?300:680)||ctx.templeFound&&ctx.pop>=400),"Church consecrated");
    once("keep",(cfg.government==="lord"||founding.key==="defense"||arch.key==="fortress")&&ctx.pop>=(arch.key==="fortress"?300:850),"Stone keep completed");
    once("walls",cfg.walls!=="none"&&(cfg.walls==="force"&&ctx.pop>=400 || (arch.key==="capital"&&ctx.pop>=700) || (arch.key==="fortress"&&ctx.pop>=250) || (ctx.pop>=1250&&(cfg.danger>=1||ctx.wantWalls||wealth>1.3))),"Town walls raised");
    once("guildhall",ctx.pop>=2300,"Guildhall built");
    once("harborworks",region.hasCoast&&(ctx.harborWorks||ctx.pop>=1700),"Quays and breakwater");
    once("temple",ctx.pop>=4600,"Great temple begun");
    once("square",ctx.pop>=3600,"Market square paved");
    var ai=def.infra||[];
    for(var a2=0;a2<ai.length;a2++)once(ai[a2].key,ctx.pop>=ai[a2].pop,ai[a2].label);
  }
  var wallRec=infra.find(function(f){return f.key==="walls";});
  if(wallRec)walls={year:wallRec.year};
  if(ctx.mineDecay<1){S.mine*=ctx.mineDecay;S.precious*=ctx.mineDecay;S.smith*=Math.max(.7,ctx.mineDecay+.3);S.weapons*=ctx.mineDecay;}
  ctx.wealth=clamp(ctx.wealth,0.3,2.6);
  /* government resolution */
  var gov=cfg.government;
  if(gov==="auto"){
    if(def.gov&&def.gov.force)gov=def.gov.force;
    else if(founding.key==="holy"||(def.gov&&def.gov.bias==="temple"))gov="temple";
    else if(def.gov&&def.gov.bias==="council"&&ctx.pop>1200)gov="council";
    else if(def.gov&&def.gov.bias==="charter"){ctx.charter=true;gov="charter";}
    else if(ctx.charter&&ctx.pop>2200&&S.trade>.5)gov="council";
    else if(ctx.charter)gov="charter";
    else gov="lord";
  }
  var finalPop=Math.max(40,Math.round(ctx.pop));
  if(cfg.popOverride)finalPop=Math.round(clamp(ctx.pop,target*0.92,target*1.05));
  /* clamp quality */
  for(var qk2 in ctx.Q)ctx.Q[qk2]=clamp(ctx.Q[qk2],0.05,0.95);
  return {founded:founded,ageYears:ageYears,popByEra:popByEra,events:events,infra:infra,walls:walls,
          pop:finalPop,wealth:ctx.wealth,government:gov,charter:ctx.charter,bridge:ctx.bridge,
          grainRoute:grainRoute,tradeLvl:tradeLvl,food:food,hungerCapped:hungerCapped,veinDead:ctx.veinDead,target:target,Q:ctx.Q};
}

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

/* ================= map geometry ================= */
function dist(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy);}
function pointSegDist(p,a,b){
  var dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;
  if(L2===0)return {d:dist(p,a),t:0,pt:a};
  var t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/L2,0,1);
  var pt={x:a.x+t*dx,y:a.y+t*dy};
  return {d:dist(p,pt),t:t,pt:pt};
}
function distToPolyline(p,pts){
  var best=1e9;
  for(var i=0;i<pts.length-1;i++){var r=pointSegDist(p,pts[i],pts[i+1]);if(r.d<best)best=r.d;}
  return best;
}
function subdiv(pts,iters,amp,rng){
  var a=pts.slice();
  for(var k=0;k<iters;k++){
    var b=[a[0]];
    for(var i=0;i<a.length-1;i++){
      var m={x:(a[i].x+a[i+1].x)/2+rng.rf(-amp,amp),y:(a[i].y+a[i+1].y)/2+rng.rf(-amp,amp)};
      b.push(m,a[i+1]);
    }
    a=b;amp*=0.52;
  }
  return a;
}
function convexHull(pts){
  if(pts.length<3)return pts.slice();
  var p=pts.slice().sort(function(a,b){return a.x-b.x||a.y-b.y;});
  function cross(o,a,b){return (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);}
  var lo=[],up=[],i;
  for(i=0;i<p.length;i++){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p[i])<=0)lo.pop();lo.push(p[i]);}
  for(i=p.length-1;i>=0;i--){while(up.length>=2&&cross(up[up.length-2],up[up.length-1],p[i])<=0)up.pop();up.push(p[i]);}
  lo.pop();up.pop();return lo.concat(up);
}
function pointInPoly(p,poly){
  var inside=false;
  for(var i=0,j=poly.length-1;i<poly.length;j=i++){
    var xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
    if(((yi>p.y)!==(yj>p.y))&&(p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function segIntersect(p1,p2,p3,p4){
  var d=(p2.x-p1.x)*(p4.y-p3.y)-(p2.y-p1.y)*(p4.x-p3.x);
  if(Math.abs(d)<1e-9)return null;
  var t=((p3.x-p1.x)*(p4.y-p3.y)-(p3.y-p1.y)*(p4.x-p3.x))/d;
  var u=((p3.x-p1.x)*(p2.y-p1.y)-(p3.y-p1.y)*(p2.x-p1.x))/d;
  if(t<0||t>1||u<0||u>1)return null;
  return {x:p1.x+t*(p2.x-p1.x),y:p1.y+t*(p2.y-p1.y)};
}

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

})();

module.exports=globalThis.Townwright;
