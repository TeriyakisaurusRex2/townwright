
/* ==================================================================
   TOWNWRIGHT ENGINE — pure, DOM-free. globalThis.Townwright.generate(cfg)
   ================================================================== */
(function(){
"use strict";
var VERSION="1.0.0";
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
function chooseFounding(rng,cfg,region){
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
   t:function(c,r){c.bridge=true;c.wealth+=.06;c.growthBoost+=.03;return "A stone bridge replaces the old ferry. Toll silver pays for it within a decade.";}},
 {k:"harbor", w:function(c){return (c.region.hasCoast&&!c.harborWorks&&c.pop>1400)?1:0;},
   t:function(c,r){c.harborWorks=true;c.wealth+=.07;return "A breakwater and new quays are raised; deep-keeled cogs can now winter here.";}},
 {k:"famine", w:function(c){return (c.S.farm<.4)?(1-(c.S.farm))*1.1:0;},
   t:function(c,r){c.popF*=r.rf(.9,.97);return "Two failed harvests running. Grain is bought dear from "+r.pick(["the river barges","downland merchants","the church stores"])+", and not everyone is fed.";}},
 {k:"temple", w:function(c){return (!c.templeFound&&c.pop>550)?.7:0;},
   t:function(c,r){c.templeFound=true;return "A wandering order is granted land; their bell is the first thing travelers hear.";}},
 {k:"guild",  w:function(c){return (c.pop>1700&&!c.guild)?.8:0;},
   t:function(c,r){c.guild=true;c.wealth+=.05;return "The "+r.pick(["smiths","weavers","mercers","coopers","masons"])+" charter a guild, fix their prices, and build a hall to argue in.";}},
 {k:"feud",   w:function(){return .35;},
   t:function(c,r){return r.pick(["A dispute over pannage rights ends in a famous fistfight on the bridge.","The old reeve dies; three families claim his office for a contentious year.","A two-headed calf is born; opinions differ sharply on what it portends."]);},minor:true}
];

function simulate(rng,cfg,region,founding,target,ageYears,S){
  var founded=PRESENT_YEAR-ageYears;
  var pop0={harbor:80,ford:60,mine:120,crossroads:55,market:70,defense:90,holy:50}[founding.key]||60;
  pop0=Math.min(pop0,target*.8);
  /* wealth potential */
  var wealth=.55+(S.trade*.5)+(S.precious*.7)+(S.mine*.25)+(S.wool*.25)+(S.fish*.15)+(S.salt*.3)+(S.farm*.15)+(S.vines*.2);
  if(cfg.prosperity!=="auto"){wealth={poor:.45,modest:.8,comfortable:1.25,wealthy:1.85}[cfg.prosperity];}
  /* food & trade reconciliation */
  var tradeLvl=clamp(S.trade*3,0,3), grainRoute=false;
  var food=foodCapacity(region,S,tradeLvl,wealth);
  if(target>food.total){ tradeLvl=clamp(tradeLvl+1.2,0,3.4); grainRoute=true; food=foodCapacity(region,S,tradeLvl,wealth); }
  if(cfg.popOverride&&target>food.total){ /* expert override wins: the grain route scales to feed it */
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
           charter:cfg.government==="charter",bridge:false,harborWorks:false,templeFound:false,guild:false,
           veinDead:false,mineDecay:1,growthBoost:0,wantWalls:false};
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

  var ticks=Math.ceil(ageYears/10);
  for(var i=1;i<=ticks;i++){
    var t=Math.min(i*10,ageYears);
    ctx.year=founded+t;
    var base=K/(1+A*Math.exp(-(rr+ctx.growthBoost*0.03)*t));
    ctx.growthBoost*=0.6; /* booms fade */
    if(cfg.events&&rng.chance(0.26)){
      var pool=EVENTS.map(function(e){return {v:e,w:e.w(ctx)};}).filter(function(x){return x.w>0;});
      if(pool.length){var ev=rng.wpick(pool);var txt=ev.t(ctx,rng);logE(ctx.year,txt,ev.minor);}
    }
    ctx.popF=clamp(ctx.popF,0.45,1.25);
    ctx.pop=Math.max(30,base*ctx.popF);
    popByEra.push({year:ctx.year,pop:Math.round(ctx.pop)});
    /* infrastructure thresholds (first crossing) */
    function once(key,cond,txt){ if(cond&&!infra.some(function(f){return f.key===key;})){infra.push({key:key,year:ctx.year,label:txt});} }
    once("well",ctx.pop>=50,"Town well dug");
    once("shrine",ctx.pop>=90,"Shrine raised");
    once("mill",S.mill>0&&ctx.pop>=260,(region.hasRiver?"Watermill built on the bank":"Windmill raised on the rise"));
    once("market",ctx.pop>=340,"Market square laid out"+(ctx.charter?" under charter":""));
    once("church",(ctx.pop>=680||ctx.templeFound),"Church consecrated");
    once("keep",(cfg.government==="lord"||founding.key==="defense")&&ctx.pop>=850,"Stone keep completed");
    once("walls",cfg.walls!=="none"&&(cfg.walls==="force"&&ctx.pop>=400 || (ctx.pop>=1250&&(cfg.danger>=1||ctx.wantWalls||wealth>1.3))),"Town walls raised");
    once("guildhall",ctx.pop>=2300,"Guildhall built");
    once("harborworks",region.hasCoast&&(ctx.harborWorks||ctx.pop>=1700),"Quays and breakwater");
    once("temple",ctx.pop>=4600,"Great temple begun");
    once("square",ctx.pop>=3600,"Market square paved");
  }
  var wallRec=infra.find(function(f){return f.key==="walls";});
  if(wallRec)walls={year:wallRec.year};
  if(ctx.mineDecay<1){S.mine*=ctx.mineDecay;S.precious*=ctx.mineDecay;S.smith*=Math.max(.7,ctx.mineDecay+.3);S.weapons*=ctx.mineDecay;}
  ctx.wealth=clamp(ctx.wealth,0.3,2.4);
  /* government resolution */
  var gov=cfg.government;
  if(gov==="auto"){
    if(founding.key==="holy")gov="temple";
    else if(ctx.charter&&ctx.pop>2200&&S.trade>.5)gov="council";
    else if(ctx.charter)gov="charter";
    else gov="lord";
  }
  var finalPop=Math.max(40,Math.round(ctx.pop));
  if(cfg.popOverride)finalPop=Math.round(clamp(ctx.pop,target*0.92,target*1.05));
  return {founded:founded,ageYears:ageYears,popByEra:popByEra,events:events,infra:infra,walls:walls,
          pop:finalPop,wealth:ctx.wealth,government:gov,charter:ctx.charter,bridge:ctx.bridge,
          grainRoute:grainRoute,tradeLvl:tradeLvl,food:food,hungerCapped:hungerCapped,veinDead:ctx.veinDead,target:target};
}

/* ================= economy ================= */
function wealthLabel(w){return w<0.35?"Destitute":w<0.7?"Poor":w<1.1?"Modest":w<1.6?"Comfortable":w<2.2?"Wealthy":"Opulent";}
function lerp(a,b,t){return a+(b-a)*t;}

function economy(rng,cfg,region,sim,founding,S){
  var pop=sim.pop, R=region.res;
  var workforce=Math.round(pop*0.47);
  var urb=clamp(Math.log(pop/150)/Math.log(40),0,1); /* 0 at ~150, 1 at ~6000 */

  /* ---- primary-sector industries (for the ledger) ---- */
  var shares=[];
  function ind(name,share,note){ if(share>0.004){ shares.push({name:name,share:share,note:note}); } }
  var mineBoost=(founding.key==="mine"?1.3:1)*(sim.veinDead?0.3:1);
  ind("Farming & smallholding", S.farm*lerp(0.42,0.05,urb), "grain, roots, orchard fruit");
  ind("Herding & dairying",     S.pastoral*lerp(0.15,0.02,urb), "sheep, cattle, cheese");
  ind("Fishing",                S.fish*(region.hasCoast?lerp(0.18,0.10,urb):0.07), region.hasCoast?"inshore boats, drying racks":"weirs and river nets");
  ind("Mining",                 S.mine*0.16*mineBoost, sim.veinDead?"the old workings, mostly played out":oreNote(R));
  ind("Quarrying",              S.quarry*0.05, "good building stone");
  ind("Forestry & charcoal",    S.forestry*lerp(0.09,0.02,urb), "felling, sawpits, charcoal heaps");
  ind("Salt-making",            S.salt*0.05, region.hasCoast?"evaporation pans":"brine springs");
  ind("Trapping & hunting",     S.furs*lerp(0.05,0.01,urb), "furs and game");
  ind("Wool & cloth working",   S.wool*lerp(0.07,0.11,urb), "spinning, weaving, fulling");
  ind("Smithing & metalwork",   S.smith*lerp(0.04,0.07,urb), "forges along the smiths' row");
  ind("Shipbuilding",           S.ships*0.05, "slips and rope-walks");
  ind("Carriage & portage",     S.trade*lerp(0.03,0.08,urb), "wagons, mules, riverboats");
  ind("Brewing",                S.brew*0.03, "ale for the town and the road");
  ind("Winemaking",             S.vines*0.06, "terraced vineyards");
  shares.sort(function(a,b){return b.share-a.share;});
  var sumShare=shares.reduce(function(a,x){return a+x.share;},0);
  var norm=sumShare>0.86?0.86/sumShare:1; /* leave room for crafts/services */
  var industries=shares.map(function(x){
    var sh=x.share*norm;
    return {name:x.name,workers:Math.max(2,Math.round(workforce*sh)),share:sh,note:x.note};
  }).filter(function(x){return x.workers>=2;}).slice(0,9);

  /* ---- occupations from the calibrated table ---- */
  var occ=[];
  for(var i=0;i<OCC.length;i++){
    var o=OCC[i], mult=1;
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

  /* ---- exports & imports ---- */
  var exports=[],imports=[];
  function topOre(){var c=[["iron",R.iron||0],["coppertin",(R.coppertin||0)*0.9],["silver",R.silver||0],["gold",R.gold||0],["gems",R.gems||0]];c.sort(function(a,b){return b[1]-a[1];});return c[0][0];}
  if(S.mine>0.45&&!sim.veinDead){var ore=topOre();exports.push({iron:"iron ore & pig iron",coppertin:"copper and tin",silver:"silver",gold:"gold",gems:"cut and rough gemstones"}[ore]);}
  if(S.smith>0.5)exports.push("wrought ironwork & tools");
  if(S.weapons>0.45)exports.push("arms & armor");
  if(S.wool>0.5)exports.push(occHas(occ,"Fullers & dyers")?"finished cloth":"raw wool");
  if(S.fish>0.5)exports.push(S.salt>0.3?"salted fish":"smoked & fresh fish");
  if(S.vines>0.4)exports.push("wine");
  if(S.farm>0.75&&!sim.grainRoute)exports.push("grain & malt");
  if(S.furs>0.45)exports.push("furs & hides");
  if(S.forestry>0.55)exports.push("timber & charcoal");
  if(S.quarry>0.5)exports.push("cut stone");
  if(S.salt>0.45)exports.push("salt");
  if(S.pottery>0.45)exports.push("pottery & brick");
  if(S.herbcraft>0.6)exports.push(S.magic>0?"remedies, simples & minor charms":"dried herbs & remedies");
  if(exports.length===0)exports.push(pop<400?"little beyond the odd cartload of surplus":"modest mixed goods");
  if(sim.grainRoute||sim.food.local<pop*0.9)imports.push("grain");
  if(S.salt<0.12)imports.push("salt");
  if(S.smith<0.2)imports.push("iron goods");
  if(S.forestry<0.12&&pop>1500)imports.push("timber");
  if(S.vines<0.1&&sim.wealth>1.2)imports.push("wine");
  if(sim.wealth>1.6)imports.push("dyes, spices & finery");

  return {workforce:workforce,industries:industries,occupations:occ,
          exports:exports,imports:imports,wealthLabel:wealthLabel(sim.wealth)};
}
function occHas(occ,n){for(var i=0;i<occ.length;i++)if(occ[i].n===n&&occ[i].count>0)return true;return false;}
function oreNote(R){
  var best="iron",v=R.iron||0;
  if((R.gold||0)>v){best="gold";v=R.gold;} if((R.silver||0)>v){best="silver";v=R.silver;}
  if((R.gems||0)>v){best="gems";v=R.gems;} if((R.coppertin||0)>v*1.1){best="coppertin";}
  return {iron:"iron workings in the high ground",gold:"placer and shaft gold",silver:"silver lodes",gems:"gem-bearing seams",coppertin:"copper and tin adits"}[best];
}

/* ================= people ================= */
function npcName(rng){return rng.pick(NPC_FIRST_A)+rng.pick(NPC_FIRST_B)+" "+(rng.chance(0.55)?rng.pick(NPC_SURN_OCC):rng.pick(NPC_SURN_TOPO));}

function makePeople(rng,cfg,region,sim,founding,S,eco,names){
  var pop=sim.pop;
  var children=Math.round(pop*0.34*rng.rf(0.94,1.06));
  var elderly=Math.round(pop*0.06*rng.rf(0.9,1.1));
  var adults=pop-children-elderly;
  var households=Math.round(pop/4.8);

  /* classes (rough head-counts incl. dependants) */
  var craftHeads=eco.occupations.reduce(function(a,o){return a+((o.g==="Crafts"||o.g==="Food & drink")?o.count:0);},0);
  var merchHeads=eco.occupations.reduce(function(a,o){return a+((o.g==="Trade & services")?o.count:0);},0);
  var gentry=Math.max(sim.government==="lord"?6:0,Math.round(pop*0.009*sim.wealth));
  var clergy=Math.max(sim.infra.some(function(f){return f.key==="church"||f.key==="temple";})?2:0,Math.round(pop/420));
  var crafts=Math.round(craftHeads*2.2);
  var merchants=Math.round(merchHeads*2.2);
  var destitute=Math.round(pop*clamp(0.05+(1.3-sim.wealth)*0.05,0.02,0.15));
  var laborers=Math.max(0,pop-children-gentry-clergy-crafts-merchants-destitute);
  var classes=[
    {n:"Gentry & officials",c:gentry},{n:"Clergy & religious",c:clergy},
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
    temple:["keeps the shrine and, in practice, the town.","tithes are fair, sermons are long."]
  }[sim.government];
  var rulerRole={lord:rng.chance(.5)?"Lord of the Town":"Lady of the Town",charter:"Mayor",council:"First Alderman",temple:rng.chance(.5)?"High Priest":"Prioress"}[sim.government];
  add(npcName(rng),rulerRole,rng.pick(rulerLine));
  if(watch>0)add(npcName(rng),"Captain of the Watch","commands "+watch+" sworn watchmen; knows every cellar in town.");
  if(sim.infra.some(function(f){return f.key==="church";}))add(npcName(rng),"Parish Priest","keeps the registry of births and burials back to "+(sim.founded+rng.ri(20,80))+".");
  if(eco.industries.length&&(pop>1200||sim.infra.some(function(f){return f.key==="guildhall";})))add(npcName(rng),"Guildmaster, "+eco.industries[0].name.toLowerCase(),"sets prices and settles disputes in the "+eco.industries[0].name.toLowerCase()+" trade.");
  if(names.taverns.length)add(npcName(rng),"Keeper of "+names.taverns[0],"hears everything worth hearing by the second bell.");
  if(sim.infra.some(function(f){return f.key==="harborworks";}))add(npcName(rng),"Harbor-master","levies wharfage; keeps the tide-book and the gossip.");
  if((founding.key==="mine"||S.mine>0.5)&&!sim.veinDead)add(npcName(rng),"Mine-reeve","counts the ore-carts down from the workings.");
  if(S.magic>0&&rng.chance(0.8))add(npcName(rng),S.magic>0.6?"Town Enchanter":"Hedge-witch","sells warding knots, finds lost things; consulted more often than admitted.");

  return {children:children,adults:adults,elderly:elderly,households:households,
          classes:classes,watch:watch,militia:militia,notables:nb.slice(0,7)};
}

/* ================= names ================= */
function makeNames(rng,cfg,region,founding,S,sim,eco){
  var R=region.res;
  var name;
  if(cfg.nameOverride){ name=cfg.nameOverride; }
  else{
    var pre=[],suf=[];
    function pw(arr,w){if(w>0)pre.push({v:arr,w:w});}
    pw(NAMES.pre_mine,S.mine*2.4); pw(NAMES.pre_gold,S.precious*2.2);
    pw(NAMES.pre_coast,region.hasCoast?2:0); pw(NAMES.pre_river,region.hasRiver?1.6:0);
    pw(NAMES.pre_fertile,S.farm*1.4); pw(NAMES.pre_forest,(region.forestCover>0.45?1.6:0)+S.forestry);
    pw(NAMES.pre_hill,region.relief>=2?1.6:0); pw(NAMES.pre_wool,S.wool*1.6);
    pw(NAMES.pre_generic,1.2);
    function sw(arr,w){if(w>0)suf.push({v:arr,w:w});}
    sw(NAMES.suf_coast,(founding.key==="harbor"?3:0)+(region.hasCoast?1.2:0));
    sw(NAMES.suf_river,(founding.key==="ford"?3:0)+(region.hasRiver?1.2:0));
    sw(NAMES.suf_mine,(founding.key==="mine"?3:0)+S.mine);
    sw(NAMES.suf_hill,(founding.key==="defense"?2:0)+(region.relief>=2?1:0));
    sw(NAMES.suf_generic,2);
    var STANDALONE=["Cross","Rest","Reach","Hollow","Green","Bridge","Ford","Haven","Gate","Wharf"];
    for(var tries=0;tries<24;tries++){
      var p=rng.pick(rng.wpick(pre)), s=rng.pick(rng.wpick(suf));
      if(/'s$/.test(p)){ name=p+" "+rng.pick(STANDALONE); }
      else{
        var pl=p.toLowerCase(), sl=s.toLowerCase();
        if(pl===sl)continue;
        if(pl.slice(-2)===sl.slice(0,2))continue;            /* Fordford */
        if(pl.slice(-1)===sl.slice(0,1)) s=sl.slice(1);      /* Salttton-type seams */
        name=cap(pl)+s.toLowerCase();
      }
      if(name.length>=4&&name.length<=15)break;
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
  if(founding.key==="holy")ep=rng.pick(["of the blessed spring","where pilgrims still come"]);
  if(big&&ep)ep=ep+", "+fmt(sim.pop)+" souls";

  /* taverns */
  var tavernCount=0;
  for(var i=0;i<eco.occupations.length;i++)if(eco.occupations[i].n==="Taverns & alehouses")tavernCount=eco.occupations[i].count;
  var nNamed=clamp(tavernCount,1,7);
  var nouns=TAVERN_NOUN_BASE.slice();
  var tagMap=[["fish",S.fish],["mine",S.mine],["wool",S.wool],["forestry",S.forestry],["trade",S.trade],["vines",S.vines]];
  for(var t=0;t<tagMap.length;t++){ if(tagMap[t][1]>0.4&&TAVERN_NOUN_TAGGED[tagMap[t][0]]){ nouns=nouns.concat(TAVERN_NOUN_TAGGED[tagMap[t][0]],TAVERN_NOUN_TAGGED[tagMap[t][0]]); } }
  var taverns=[],used={};
  for(var g=0;g<60&&taverns.length<nNamed;g++){
    var tn="The "+rng.pick(TAVERN_ADJ)+" "+rng.pick(nouns);
    if(!used[tn]){used[tn]=1;taverns.push(tn);}
  }
  return {name:name,epithet:ep,taverns:taverns,tavernCount:tavernCount};
}

/* ================= prose ================= */
function buildProse(region,founding,sim,S,eco,names){
  var R=region.res;
  var terrLabel={coastal:"a stretch of open coast",estuary:"the mouth of a slow river",riverlands:"broad riverlands",plains:"open plains",hills:"rolling hill country",foothills:"the foothills of the high ranges",forest:"deep forest country"}[region.terrain];
  var p1=names.name+" sits in "+terrLabel+
    (region.hasRiver&&region.terrain!=="riverlands"&&region.terrain!=="estuary"?", threaded by a river":"")+
    ", under a "+region.climate+" sky. It began as "+founding.label+" in "+sim.founded+
    " — "+sim.ageYears+" years ago — and has grown to "+fmt(sim.pop)+" people"+(sim.hungerCapped?", about as many as the land and the grain carts can feed":"")+".";

  /* the causal "why" paragraph */
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
  var p2="The town runs on what the land gives: "+why.join("; ")+".";

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
function buildMapModel(cfg,region,founding,sim,S,eco){
  var rng=RNG((cfg.mapSeed&&String(cfg.mapSeed).trim())?cfg.mapSeed:cfg.seed+"|map");
  var W=1000,H=700,pop=sim.pop;
  var model={W:W,H:H,seaSide:"east"};

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

  /* ---- coast ---- */
  var shore=null,shoreXs=null,coveY=H*0.5,coveDepth=0;
  function shoreAt(y){ if(!shoreXs)return 1e9; var i=clamp(Math.round(y/8),0,shoreXs.length-1); return shoreXs[i]; }
  if(region.hasCoast){
    coveY=H*rng.rf(0.34,0.64);
    coveDepth=(founding.key==="harbor"?rng.rf(62,92):rng.rf(28,48));
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
  if(founding.key==="harbor")C={x:shoreAt(coveY)-rng.rf(58,78),y:coveY+rng.rf(-14,14)};
  else if(founding.key==="mine")C={x:W*rng.rf(0.32,0.44),y:H*rng.rf(0.3,0.44)};
  else if(founding.key==="defense")C={x:W*rng.rf(0.36,0.5),y:H*rng.rf(0.32,0.48)};
  else C={x:W*rng.rf(0.38,0.52),y:H*rng.rf(0.42,0.58)};
  if(region.hasCoast)C.x=Math.min(C.x,shoreAt(C.y)-70);

  /* ---- river (left -> right, monotonic x) ---- */
  var river=null,bridgePt=null;
  if(region.hasRiver){
    var anchorY=(founding.key==="ford")?C.y:clamp(C.y+rng.rf(-1,1)*rng.rf(46,120),60,H-60);
    var endPt=region.hasCoast?{x:shoreAt(coveY)+6,y:coveY}:{x:W,y:clamp(anchorY+rng.rf(-90,90),50,H-50)};
    if(region.terrain==="estuary"){endPt={x:shoreAt(coveY)+6,y:coveY};}
    var startPt={x:0,y:clamp(anchorY+rng.rf(-110,110),50,H-50)};
    var mid={x:clamp(C.x+(founding.key==="ford"?0:rng.rf(-40,40)),80,W-120),y:anchorY};
    var rp=subdiv([startPt,mid,endPt],4,34,rng);
    rp.sort(function(a,b){return a.x-b.x;});
    var rw=clamp(11+Math.sqrt(pop)/14,11,22);
    river={pts:rp,w:rw};
    model.river=river;
    /* bridge / ford point = nearest river point to C */
    var bi=0,bd=1e9;
    for(var i2=0;i2<rp.length;i2++){var d2=dist(rp[i2],C);if(d2<bd){bd=d2;bi=i2;}}
    bridgePt=rp[bi];
    if(founding.key==="ford"){ /* town sits on the bank */
      var below=rng.chance(0.5)?1:-1;
      C={x:bridgePt.x+rng.rf(-8,8),y:bridgePt.y+below*(rw/2+22)};
    }
    if(sim.bridge||founding.key==="ford"){
      var a=rp[Math.max(0,bi-1)],b2=rp[Math.min(rp.length-1,bi+1)];
      model.bridge={x:bridgePt.x,y:bridgePt.y,angle:Math.atan2(b2.y-a.y,b2.x-a.x)+Math.PI/2,era:sim.bridge?eraForYear(yearOfEvent(sim,"bridge")||sim.founded):0};
    }
  }
  function riverYAt(x){
    if(!river)return null;var rp=river.pts;
    if(x<=rp[0].x)return rp[0].y; if(x>=rp[rp.length-1].x)return rp[rp.length-1].y;
    for(var i=0;i<rp.length-1;i++)if(x>=rp[i].x&&x<=rp[i+1].x){var t=(x-rp[i].x)/Math.max(1e-6,rp[i+1].x-rp[i].x);return rp[i].y+t*(rp[i+1].y-rp[i].y);}
    return rp[0].y;
  }
  function sideOf(p){var ry=riverYAt(p.x);return ry==null?0:(p.y<ry?-1:1);}
  model.C=C;

  /* ---- roads ---- */
  var roads=[];
  function routeRoad(to,kind){
    var pts;
    if(river&&sideOf(C)!==sideOf(to)&&sideOf(to)!==0){
      pts=subdiv([C,bridgePt],2,12,rng).concat(subdiv([bridgePt,to],2,18,rng).slice(1));
    }else pts=subdiv([C,to],3,20,rng);
    roads.push({pts:pts,kind:kind||"highway"});
  }
  routeRoad({x:0,y:clamp(C.y+rng.rf(-130,130),40,H-40)});
  routeRoad({x:clamp(C.x+rng.rf(-150,150),60,(region.hasCoast?shoreAt(0)-60:W-40)),y:0});
  routeRoad({x:clamp(C.x+rng.rf(-150,150),60,(region.hasCoast?shoreAt(H)-60:W-40)),y:H});
  if(!region.hasCoast)routeRoad({x:W,y:clamp(C.y+rng.rf(-130,130),40,H-40)});
  var hillsPt=null;
  if(region.relief>=1){hillsPt={x:W*rng.rf(0.1,0.2),y:H*rng.rf(0.1,0.22)};}
  if((S.mine>0.3||founding.key==="mine")&&hillsPt){routeRoad({x:hillsPt.x+rng.rf(-10,30),y:hillsPt.y+rng.rf(0,30)},"mineroad");}
  if(region.hasCoast&&founding.key!=="harbor"){routeRoad({x:shoreAt(coveY)-14,y:coveY},"highway");}
  model.roads=roads;

  /* ---- placement machinery ---- */
  var CELL=13,hash={};
  function hkey(x,y){return Math.floor(x/CELL)+","+Math.floor(y/CELL);}
  function collides(p,minD){
    var cx=Math.floor(p.x/CELL),cy=Math.floor(p.y/CELL);
    for(var i=-1;i<=1;i++)for(var j=-1;j<=1;j++){
      var arr=hash[(cx+i)+","+(cy+j)];if(!arr)continue;
      for(var k=0;k<arr.length;k++)if(dist(p,arr[k])<minD)return true;
    }
    return false;
  }
  function addHash(p){var k=hkey(p.x,p.y);(hash[k]||(hash[k]=[])).push(p);}
  function inWater(p,pad){
    pad=pad||6;
    if(shoreXs&&p.x>shoreAt(p.y)-pad)return true;
    if(river&&distToPolyline(p,river.pts)<river.w/2+pad)return true;
    return false;
  }
  function nearestOnRoads(p,kinds){
    var best=null;
    for(var r=0;r<roads.length;r++){
      if(kinds&&kinds.indexOf(roads[r].kind)<0)continue;
      var pts=roads[r].pts;
      for(var i=0;i<pts.length-1;i++){
        var pr=pointSegDist(p,pts[i],pts[i+1]);
        if(!best||pr.d<best.d){best={d:pr.d,pt:pr.pt,a:pts[i],b:pts[i+1]};}
      }
    }
    return best;
  }

  var finalPop=pop;
  var Rmax=clamp(36+Math.sqrt(finalPop)*1.6,55,235);
  var plazaR=(finalPop>=340)?clamp(15+finalPop/1100,15,30):0;
  model.plazaR=plazaR;

  var buildings=[],walls=null,gateAnchors=[];
  var wallYear=sim.walls?sim.walls.year:null;
  var nBld=clamp(Math.round(finalPop/7),8,1500);

  for(var e2=0;e2<eras.length;e2++){
    var popE=eras[e2].pop;
    var targetN=clamp(Math.round(popE/finalPop*nBld),Math.min(6,nBld),nBld);
    var Re=Math.max(26,Rmax*Math.sqrt(popE/finalPop));
    /* lanes appear as the town grows */
    if(e2>=1&&popE>320&&roads.length<5+Math.min(14,Math.floor(finalPop/700))&&buildings.length>10){
      var nl=rng.ri(1,2);
      for(var L=0;L<nl;L++){
        var bb=buildings[rng.ri(0,buildings.length-1)];
        var nr0=nearestOnRoads(bb,["highway","mineroad"]);
        if(nr0&&nr0.d<90){
          var dir={x:bb.x-nr0.pt.x,y:bb.y-nr0.pt.y},dl=Math.max(1,Math.sqrt(dir.x*dir.x+dir.y*dir.y));
          var endp={x:bb.x+dir.x/dl*rng.rf(35,85),y:bb.y+dir.y/dl*rng.rf(35,85)};
          if(!inWater(endp,4))roads.push({pts:subdiv([nr0.pt,endp],1,7,rng),kind:"lane"});
        }
      }
    }
    var attemptsBudget=(targetN-buildings.length)*14;
    while(buildings.length<targetN&&attemptsBudget-->0){
      var ang=rng.rf(0,6.2832),rad=Math.min(Re*1.3,Math.abs(rng.gauss(0,Re*0.55)));
      var p={x:C.x+Math.cos(ang)*rad,y:C.y+Math.sin(ang)*rad};
      var nr=nearestOnRoads(p);
      if(!nr||nr.d>(e2<2?62:95))continue;
      var rdx=nr.b.x-nr.a.x,rdy=nr.b.y-nr.a.y,rl=Math.max(1e-6,Math.sqrt(rdx*rdx+rdy*rdy));
      rdx/=rl;rdy/=rl;
      var sideSign=((p.x-nr.pt.x)*(-rdy)+(p.y-nr.pt.y)*rdx)>=0?1:-1;
      var row=rng.wpick([{v:1,w:5},{v:2,w:2.6},{v:3,w:1}]);
      var off=(7.5+(row-1)*11+rng.rf(-1.5,1.5))*sideSign;
      var pos={x:nr.pt.x+(-rdy)*off+rdx*rng.rf(-7,7),y:nr.pt.y+rdx*off+rdy*rng.rf(-7,7)};
      if(pos.x<14||pos.x>W-14||pos.y<14||pos.y>H-14)continue;
      if(inWater(pos,7))continue;
      if(plazaR&&dist(pos,C)<plazaR+6)continue;
      if(collides(pos,8.6))continue;
      if(walls){
        var inside=pointInPoly(pos,walls.poly);
        if(!inside){
          var nearGate=false;
          for(var g2=0;g2<gateAnchors.length;g2++)if(dist(pos,gateAnchors[g2])<64){nearGate=true;break;}
          if(!(rng.chance(0.22)&&nearGate))continue;
        }
      }
      var kind=(plazaR&&dist(pos,C)<plazaR+44&&rng.chance(0.3))?"craft":"house";
      buildings.push({x:pos.x,y:pos.y,w:rng.rf(6,11),h:rng.rf(5,9),rot:Math.atan2(rdy,rdx)+rng.rf(-0.07,0.07),kind:kind,era:e2});
      addHash(pos);
    }
    /* raise walls at the right era */
    if(wallYear!=null&&!walls&&eras[e2].year>=wallYear&&buildings.length>=8){
      var centers=buildings.map(function(b){return {x:b.x,y:b.y};});
      var hull=convexHull(centers);
      var G={x:0,y:0};hull.forEach(function(h){G.x+=h.x;G.y+=h.y;});G.x/=hull.length;G.y/=hull.length;
      var ex=hull.map(function(h){var d3=Math.max(1,dist(h,G));var k3=(d3+23)/d3;return {x:G.x+(h.x-G.x)*k3,y:G.y+(h.y-G.y)*k3};});
      var poly=[];
      for(var i3=0;i3<ex.length;i3++){
        var a3=ex[i3],b3=ex[(i3+1)%ex.length];
        poly.push(a3);
        var m3={x:(a3.x+b3.x)/2,y:(a3.y+b3.y)/2};
        var dm=Math.max(1,dist(m3,G));
        poly.push({x:G.x+(m3.x-G.x)*((dm+rng.rf(5,10))/dm),y:G.y+(m3.y-G.y)*((dm+5)/dm)});
      }
      poly=poly.map(function(pt){return {x:clamp(pt.x,12,(shoreXs?shoreAt(pt.y)-8:W-12)),y:clamp(pt.y,12,H-12)};});
      /* towers + gates */
      var towers=[],per=0;
      for(var i4=0;i4<poly.length;i4++){
        var a4=poly[i4],b4=poly[(i4+1)%poly.length],segL=dist(a4,b4);
        var step=86;
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
      gateAnchors=gates;
      model.walls=walls;
    }
  }
  model.buildings=buildings;

  /* ---- landmarks ---- */
  var lm=[];
  function placeNear(cx,cy,minR,maxR,w2,h2,kind,era3,tries){
    tries=tries||30;
    while(tries-->0){
      var ang=rng.rf(0,6.2832),r5=rng.rf(minR,maxR);
      var p5={x:cx+Math.cos(ang)*r5,y:cy+Math.sin(ang)*r5};
      if(p5.x<16||p5.x>W-16||p5.y<16||p5.y>H-16)continue;
      if(inWater(p5,8))continue;
      if(collides(p5,Math.max(w2,h2)*0.8+4))continue;
      addHash(p5);
      var o={kind:kind,x:p5.x,y:p5.y,w:w2,h:h2,rot:rng.rf(-0.1,0.1),era:era3};
      lm.push(o);return o;
    }
    return null;
  }
  function infraYear(k){var f=sim.infra.find(function(x){return x.key===k;});return f?f.year:null;}
  var yr;
  if((yr=infraYear("church"))!=null)placeNear(C.x,C.y,plazaR+12,plazaR+46,14,10,"church",eraForYear(yr));
  if((yr=infraYear("temple"))!=null)placeNear(C.x,C.y,plazaR+16,plazaR+60,19,13,"temple",eraForYear(yr));
  if((yr=infraYear("keep"))!=null){
    var kdir=hillsPt?Math.atan2(hillsPt.y-C.y,hillsPt.x-C.x):rng.rf(0,6.2832);
    var kp={x:C.x+Math.cos(kdir)*rng.rf(60,105),y:C.y+Math.sin(kdir)*rng.rf(60,105)};
    if(!inWater(kp,10)){lm.push({kind:"keep",x:clamp(kp.x,20,W-20),y:clamp(kp.y,20,H-20),w:15,h:15,rot:rng.rf(-0.15,0.15),era:eraForYear(yr)});addHash(kp);}
  }
  if((yr=infraYear("guildhall"))!=null)placeNear(C.x,C.y,plazaR+10,plazaR+40,15,10,"guildhall",eraForYear(yr));
  if((yr=infraYear("mill"))!=null&&river){
    var nMills=Math.min(2,Math.max(1,Math.round(S.mill*2)));
    for(var m5=0;m5<nMills;m5++){
      var rp5=river.pts[rng.ri(2,river.pts.length-3)];
      if(dist(rp5,C)<200&&!collides(rp5,12)){lm.push({kind:"mill",x:rp5.x,y:rp5.y-river.w/2-6,w:9,h:7,rot:0,era:eraForYear(yr)});addHash(rp5);}
    }
  }
  if(occHas(eco.occupations,"Tanners")&&river){
    var downs=river.pts.filter(function(p6){return p6.x>C.x+60&&dist(p6,C)<240;});
    if(downs.length){var tp=downs[rng.ri(0,downs.length-1)];lm.push({kind:"tannery",x:tp.x,y:tp.y+river.w/2+8,w:8,h:6,rot:0,era:Math.min(eras.length-1,1)});}
  }
  if(S.smith>0.42){
    var mr=roads.find(function(r6){return r6.kind==="mineroad";});
    if(mr){var sp=mr.pts[Math.floor(mr.pts.length*0.4)];if(!inWater(sp,8)&&!collides(sp,10)){lm.push({kind:"smelter",x:sp.x,y:sp.y+9,w:9,h:7,rot:0,era:Math.min(eras.length-1,1)});addHash(sp);}}
  }
  if(hillsPt&&(S.mine>0.3||founding.key==="mine"))lm.push({kind:"adit",x:hillsPt.x,y:hillsPt.y,w:8,h:6,rot:0,era:0});
  /* docks */
  var piers=[];
  if(region.hasCoast&&(infraYear("harborworks")!=null||finalPop>700||founding.key==="harbor")){
    var pe=infraYear("harborworks")!=null?eraForYear(infraYear("harborworks")):0;
    var nP=clamp(2+Math.round(finalPop/2500),2,5);
    for(var pi=0;pi<nP;pi++){
      var py=coveY+(pi-(nP-1)/2)*rng.rf(16,22)+rng.rf(-3,3);
      var sx=shoreAt(py);
      piers.push({x1:sx-2,y1:py,x2:sx+rng.rf(16,30),y2:py+rng.rf(-3,3),era:pe});
      if(rng.chance(0.8)){var wp={x:sx-rng.rf(12,26),y:py+rng.rf(-6,6)};if(!collides(wp,9)&&!inWater(wp,4)){lm.push({kind:"ware",x:wp.x,y:wp.y,w:10,h:7,rot:rng.rf(-0.1,0.1),era:pe});addHash(wp);}}
    }
  }
  model.piers=piers;
  /* graveyard */
  if(infraYear("church")!=null){
    var gv=placeNear(C.x,C.y,Rmax*0.95,Rmax*1.35,26,18,"graveyard",eraForYear(infraYear("church")));
    if(gv){gv.crosses=[];var ncr=rng.ri(5,9);for(var c6=0;c6<ncr;c6++)gv.crosses.push({x:gv.x+rng.rf(-10,10),y:gv.y+rng.rf(-6,6)});}
  }
  /* market stalls */
  var stalls=[];
  if(plazaR&&finalPop>400){
    var ns=rng.ri(3,7),me=infraYear("market")!=null?eraForYear(infraYear("market")):0;
    for(var s6=0;s6<ns;s6++){var sa=rng.rf(0,6.2832),sr=rng.rf(plazaR*0.25,plazaR*0.7);
      stalls.push({x:C.x+Math.cos(sa)*sr,y:C.y+Math.sin(sa)*sr,w:rng.rf(3,5),h:rng.rf(2.5,4),rot:rng.rf(0,3.14),era:me});}
  }
  model.stalls=stalls;
  /* farms */
  var farms=[];
  var nF=Math.round(clamp(S.farm*clamp(finalPop/120,4,26),0,26));
  var hwys=roads.filter(function(r7){return r7.kind==="highway";});
  for(var f6=0;f6<nF*4&&farms.length<nF;f6++){
    var rd7=hwys[rng.ri(0,hwys.length-1)];
    var seg=rng.ri(Math.floor(rd7.pts.length*0.4),rd7.pts.length-2);
    var a7=rd7.pts[seg],b7=rd7.pts[seg+1];
    var t7=rng.rf(0,1),fp={x:a7.x+(b7.x-a7.x)*t7,y:a7.y+(b7.y-a7.y)*t7};
    if(dist(fp,C)<Rmax*1.18)continue;
    var fdx=b7.x-a7.x,fdy=b7.y-a7.y,fl=Math.max(1e-6,Math.sqrt(fdx*fdx+fdy*fdy));fdx/=fl;fdy/=fl;
    var fs=rng.chance(0.5)?1:-1,foff=rng.rf(12,22)*fs;
    var house={x:fp.x-fdy*foff,y:fp.y+fdx*foff};
    if(house.x<20||house.x>W-20||house.y<20||house.y>H-20)continue;
    if(inWater(house,8)||collides(house,14))continue;
    addHash(house);
    var strips=[],nS2=rng.ri(2,4);
    for(var s7=0;s7<nS2;s7++){
      strips.push({x:house.x-fdy*(12+s7*13)*fs+fdx*rng.rf(-8,8),y:house.y+fdx*(12+s7*13)*fs+fdy*rng.rf(-8,8),
                   w:rng.rf(26,44),h:rng.rf(9,13),rot:Math.atan2(fdy,fdx)});
    }
    farms.push({house:{x:house.x,y:house.y,w:7,h:6,rot:Math.atan2(fdy,fdx)},strips:strips,era:rng.ri(0,Math.max(0,eras.length-2))});
  }
  model.farms=farms;
  /* trees */
  var trees=[];
  if(region.forestCover>0.22){
    var nCl=rng.ri(3,6);
    for(var cl=0;cl<nCl;cl++){
      var tcOK=false,tc=null,tt=18;
      while(tt-->0&&!tcOK){
        tc={x:rng.rf(40,W-40),y:rng.rf(40,H-40)};
        tcOK=dist(tc,C)>Rmax*1.3&&!inWater(tc,18)&&(!hillsPt||dist(tc,hillsPt)>120);
      }
      if(!tcOK)continue;
      var nT=Math.round(rng.rf(8,26)*region.forestCover);
      for(var t8=0;t8<nT;t8++){
        var tp8={x:tc.x+rng.gauss(0,42),y:tc.y+rng.gauss(0,34)};
        if(tp8.x<16||tp8.x>W-16||tp8.y<16||tp8.y>H-16)continue;
        if(inWater(tp8,10))continue;
        var nr8=nearestOnRoads(tp8);
        if(nr8&&nr8.d<13)continue;
        if(collides(tp8,9))continue;
        trees.push({x:tp8.x,y:tp8.y,r:rng.rf(2.2,4.2)});
      }
    }
  }
  model.trees=trees;
  /* hills */
  var hills=[];
  if(region.relief>=1&&hillsPt){
    var nH=region.relief>=2?rng.ri(3,4):rng.ri(1,2);
    for(var h8=0;h8<nH;h8++){
      var hc={x:clamp(hillsPt.x+rng.rf(-60,110),30,W-200),y:clamp(hillsPt.y+rng.rf(-40,110),30,H*0.55)};
      if(inWater(hc,40)||dist(hc,C)<Rmax*1.2)continue;
      var rings=[],r8=rng.rf(34,58);
      while(r8>10){rings.push(r8);r8*=rng.rf(0.6,0.72);}
      hills.push({x:hc.x,y:hc.y,rings:rings});
    }
  }
  model.hills=hills;
  model.landmarks=lm;
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
    founding:cfg.founding||"auto",nameOverride:(cfg.nameOverride||"").trim(),
    mapSeed:cfg.mapSeed||"",indMult:cfg.indMult||{}
  };
  return c;
}
function generate(rawCfg){
  var cfg=normalizeCfg(rawCfg);
  var rng=RNG(cfg.seed+"|world");
  var region=genRegion(rng,cfg);
  var founding=chooseFounding(rng,cfg,region);
  var S=industryStrengths(rng,cfg,region);
  var target=chooseTarget(rng,cfg);
  var ageYears=chooseAge(rng,cfg);
  var sim=simulate(rng,cfg,region,founding,target,ageYears,S);
  var eco=economy(rng,cfg,region,sim,founding,S);
  var names=makeNames(rng,cfg,region,founding,S,sim,eco);
  var people=makePeople(rng,cfg,region,sim,founding,S,eco,names);
  var prose=buildProse(region,founding,sim,S,eco,names);
  var map=buildMapModel(cfg,region,founding,sim,S,eco);
  return {version:VERSION,cfg:cfg,seed:cfg.seed,presentYear:PRESENT_YEAR,
          region:region,founding:founding,strengths:S,sim:sim,economy:eco,
          names:names,people:people,prose:prose,map:map};
}

globalThis.Townwright={generate:generate,VERSION:VERSION,RES_DEFS:RES_DEFS,PRESENT_YEAR:PRESENT_YEAR};
})();

module.exports=globalThis.Townwright;
