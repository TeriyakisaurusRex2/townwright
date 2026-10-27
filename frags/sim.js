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

