/* ================================================================
   ROUND 2 — What is a healthy plant?
   Step 1 Define: weigh four properties into a health score (any number of objectives)
   Step 2 Build:  turnkey system or modular parts; sensors decide what you can see
   Step 3 Run:    49 days, setup time, lab waits, breakdowns, a halfway review
   ================================================================ */
const B=x=>Math.exp(-x*x);
const PROPS2=[
  {k:"height",name:"Height",unit:"cm",lo:4,hi:64,dec:0,col:"#f2b33d",what:"How tall the plant grows."},
  {k:"green",name:"Leaf colour",unit:"SPAD",lo:15,hi:55,dec:0,col:"#7fd650",what:"Deep green leaves have more chlorophyll."},
  {k:"yield",name:"Harvest",unit:"g",lo:5,hi:150,dec:0,col:"#5fd3e8",what:"Grams of fresh leaves you can pick."},
  {k:"vitc",name:"Vitamin C",unit:"mg/100 g",lo:5,hi:60,dec:0,col:"#ff8a5b",what:"How nutritious the leaves are."},
];
const PK2=PROPS2.map(p=>p.k);
const LEVELS=[{w:0,t:"Ignore"},{w:1,t:"A little"},{w:2,t:"Important"},{w:3,t:"Very important"}];
/* four hidden biology formulas: each property likes different conditions, so they trade off */
/* A new basil variety for Round 2. Each property mainly cares about two conditions, so they trade off:
   tall plants stretch under weak light and warmth, but vitamin C and harvest need strong light. */
function trueProps(c){
  const [w,l,f,t]=c;
  return {
    height:.05+.95*B((l-.35)/.45)*B((t-.7)/.45)*B((w-.6)/.6)*B((f-.7)/.675),
    green:.08+.92*B((f-.75)/.45)*B((t-.4)/.45)*B((l-.6)/.75)*B((w-.5)/.75),
    yield:.05+.95*B((l-.85)/.45)*B((w-(.4+.4*l))/.25)*B((f-.65)/.675)*B((t-.55)/.675),
    vitc:.05+.95*B((l-.95)/.45)*B((f-.3)/.45)*B((w-.35)/.675)*B((t-.45)/.675),
  };
}
const fmtP=(k,v)=>{const p=PROPS2.find(x=>x.k===k);return Math.round(p.lo+(p.hi-p.lo)*v)+" "+p.unit};
function scoreOf(vals,weights,only){
  let s=0,ws=0;for(const k of PK2){const w=weights[k]||0;if(!w)continue;if(only&&vals[k]==null)continue;s+=w*vals[k];ws+=w}
  return ws?100*s/ws:null;
}
const EXPERT={height:1,green:1,yield:1,vitc:1};   // the plant judge cares about everything equally…
const expertScore=v=>100*Math.pow(v.height*v.green*v.yield*v.vitc,1/4);   // …and a plant is only healthy if nothing is badly weak
const RSAMP=(()=>{const r=mulberry32(77);return [...Array(20000)].map(()=>trueProps([r(),r(),r(),r()]))})();
function thresholdFor(weights){const xs=RSAMP.map(v=>scoreOf(v,weights)).sort((a,b)=>b-a);return xs[Math.floor(xs.length*.01)]}
const EXPERT_MAX=(()=>{const r=mulberry32(5);let best=null,bv=-1;for(let i=0;i<40000;i++){const c=[r(),r(),r(),r()];const v=expertScore(trueProps(c));if(v>bv){bv=v;best=c}}
  for(let k=0;k<6000;k++){const c=best.map(x=>clamp(x+.03*gauss(r),0,1));const v=expertScore(trueProps(c));if(v>bv){bv=v;best=c}}return bv})();
function expertStars(v){const q=expertScore(v)/EXPERT_MAX;return q>=.9?5:q>=.78?4:q>=.62?3:q>=.4?2:1}

/* ---------- shop ---------- */
const SENS2=[
  {id:"ruler",name:"Ruler",price:0,setup:0,m:{height:.02},what:"Measures height. Free."},
  {id:"scale",name:"Kitchen scale",price:100,setup:0,m:{yield:.03},what:"Weighs the harvest."},
  {id:"camera",name:"Colour camera",price:1500,setup:1,m:{green:.08},what:"Measures leaf colour. A bit noisy."},
  {id:"lab",name:"Lab test for vitamin C",price:0,perPlant:40,wait:2,setup:0,m:{vitc:.02},what:"Very accurate. Costs $40 per plant, and the results take 2 days."},
  {id:"hyper",name:"Hyperspectral camera",price:8000,setup:2,m:{green:.02,vitc:.05,yield:.04},what:"Measures leaf colour, vitamin C and harvest. Expensive."},
];
const SENS2M=Object.fromEntries(SENS2.map(s=>[s.id,s]));
const TURNKEY={price:10000,beds:8,packPrice:3000,pack:4,maxPacks:0,sensors:["ruler","scale","camera"],planners:[]};
const MOD={basePrice:1000,bedPrice:500,maxBeds:24,breakChance:.14};

function r2New(team){
  newGame(team);
  Object.assign(G,{round:2,weights:{height:1,green:1,yield:1,vitc:1},system:"modular",packs:0,sensors:{ruler:1},
    setupDays:0,breakdowns:0,lost:0,labCost:0,reviewed:false,bonus:0});
  G.beds=6;G.own={you:1,random:1};
}
function r2Spent(){
  if(G.system==="turnkey")return TURNKEY.price+G.packs*TURNKEY.packPrice;
  let s=MOD.basePrice+(G.beds-1)*MOD.bedPrice;
  for(const id in G.sensors)if(G.sensors[id])s+=SENS2M[id].price;
  for(const p of PLANNERS)if(p.price&&G.own[p.id])s+=p.price;
  return s;
}
function r2SetupDays(){
  if(G.system==="turnkey")return 0;
  let d=1;for(const id in G.sensors)if(G.sensors[id])d+=SENS2M[id].setup;
  for(const p of PLANNERS)if(p.price&&G.own[p.id])d+=1;
  return d;
}
function r2Measured(){const m={};for(const id in G.sensors)if(G.sensors[id])for(const k in SENS2M[id].m){const sg=SENS2M[id].m[k];if(m[k]==null||sg<m[k].sg)m[k]={sg,by:id}}return m}
const r2WaitDays=()=>G.sensors.lab&&G.weights.vitc?SENS2M.lab.wait:0;

/* ---------- planner context: the planners chase YOUR measured health score ---------- */
function r2Context(){
  const W=G.weights;
  const shift=(c,a)=>c.map((x,i)=>clamp(x+a[i],0,1));
  return {ymax:100,gold:G.thr,
    detailed:c=>.95*scoreOf(trueProps(shift(c,[.05,-.05,.06,-.04])),W)/100,
    rough:c=>.8*scoreOf(trueProps(shift(c,[.14,-.16,.15,-.1])),W)/100};
}

/* ---------- a batch ---------- */
function r2PrepareBatch(){
  G.cur.wait=r2WaitDays();G.cur.waitWhy="Waiting for lab results";
  G.cur.noise=1;G.cur.dead=-1;G.cur.event=null;
  if(G.system==="modular"&&rng()<MOD.breakChance){
    const opts=["pump","crash"];if(G.sensors.camera)opts.push("camera");
    const ev=opts[Math.floor(rng()*opts.length)];G.cur.event=ev;G.breakdowns++;
    if(ev==="pump"){G.cur.dead=Math.floor(rng()*G.beds);G.lost++}
    if(ev==="crash"){G.cur.wait+=1;G.cur.waitWhy=G.cur.wait>1?"Repairing the controller, then waiting for lab results":"Repairing the controller"}
    if(ev==="camera")G.cur.noise=3;
  }
  if(G.sensors.lab&&G.weights.vitc){const cost=SENS2M.lab.perPlant*G.beds;if(G.money>=cost){G.money-=cost;G.labCost+=cost;G.cur.lab=true}else{G.cur.lab=false;G.cur.wait=Math.max(0,G.cur.wait-SENS2M.lab.wait);toast("Not enough money for lab tests this batch. Vitamin C is not measured.","bad")}}
}
function r2Grow(){
  const meas=r2Measured();
  G.cur.conds.forEach((c,i)=>{
    const tv=trueProps(c);const real={};for(const k of PK2)real[k]=clamp(tv[k]*(1+.04*gauss()),0,1.1);
    const seen={};
    for(const k of PK2){const m=meas[k];if(!m)continue;if(m.by==="lab"&&!G.cur.lab)continue;
      const sg=m.sg*(k==="green"&&m.by==="camera"?G.cur.noise:1);seen[k]=clamp(real[k]+sg*gauss(),0,1.15)}
    const dead=i===G.cur.dead;
    const ms=dead?null:scoreOf(seen,G.weights,true);
    const ts=scoreOf(real,G.weights);
    G.plants[i]={c,h:4+real.height*(HMAX-4),props:real,seen,y:ms,ts,frac:.04,dead,gold:!dead&&ms!=null&&ms>=G.thr,
      label:dead?"dead":G.cur.wait>0&&G.cur.lab?"lab…":ms==null?"?":String(Math.round(ms)),extra:{seen,real,ts}};
  });
  if(G.cur.event==="pump")toast(`The pump for plant ${G.cur.dead+1} clogged. That plant will die.`,"bad");
  if(G.cur.event==="camera")toast("The colour camera lost its calibration. Colour readings are very noisy this batch.","bad");
  if(G.cur.event==="crash")toast("The controller crashed. Repairs take 1 extra day.","bad");
}
function r2Finalise(){for(let i=0;i<G.beds;i++){const p=G.plants[i];if(p&&!p.dead)p.label=p.y==null?"?":String(Math.round(p.y))}refreshAll()}
function r2Review(){
  if(G.reviewed||G.day<21)return false;
  G.reviewed=true;
  const gold=G.data.filter(d=>d.y!=null&&d.y>=G.thr).length;
  if(!gold){
    openOverlay(`<span class="label">Day ${G.day}: halfway review</span><h2>No extra money yet</h2>
      <p>Your funder checked in. You have no exceptional plant yet, so there is no extra money.</p>
      <p class="small">Tip: check that your sensors measure what your health score needs.</p>
      <div class="row"><button class="btn primary big" id="b-ok">Keep going</button></div>`);
    $("#b-ok").onclick=()=>{closeOverlay();if(!canRun())finishSeason()};
    return true;
  }
  G.money+=2000;G.bonus=2000;
  r2OpenUpgrade();
  return true;
}
function r2OpenUpgrade(){
  const items=[];
  if(G.system==="turnkey"){if(G.packs<TURNKEY.maxPacks)items.push({id:"pack",name:`Room for ${TURNKEY.pack} more plants in the GrowBox`,price:TURNKEY.packPrice,days:0})}
  else{
    items.push({id:"bed",name:"Room for 1 more plant",price:MOD.bedPrice,days:0});
    for(const s of SENS2)if(!G.sensors[s.id]&&s.price)items.push({id:"s:"+s.id,name:s.name,price:s.price,days:s.setup});
    for(const p of PLANNERS)if(p.price&&!G.own[p.id])items.push({id:"p:"+p.id,name:p.name,price:p.price,days:1});
  }
  const render=()=>{
    openOverlay(`<span class="label">Day ${G.day}: halfway review</span><h2>Your funder is happy: +$2,000!</h2>
      <p>You found an exceptional plant. You may spend ${eur(G.money)} now, or keep it.</p>
      ${G.system==="turnkey"?`<p class="small">Your GrowBox is a closed system. There is nothing you can add to it. The money stays in the bank.</p>`:`<p class="small">New parts need setup days before your next batch.</p>`}
      <div class="buylist">${items.map(it=>`<button class="choice" data-up="${it.id}" ${G.money<it.price||(it.id==="bed"&&G.beds>=MOD.maxBeds)?"disabled":""}><h3>${it.name}<span class="price">${eur(it.price)}</span></h3>${it.days?`<span class="note">${it.days} setup day${it.days>1?"s":""}</span>`:""}</button>`).join("")||`<p class="small">Nothing more to buy.</p>`}</div>
      <div class="row"><button class="btn primary big" id="b-ok">Continue</button></div>`);
    document.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{const it=items.find(x=>x.id===b.dataset.up);if(!it||G.money<it.price||(it.id==="bed"&&G.beds>=MOD.maxBeds))return;
      G.money-=it.price;G.spent+=it.price;
      if(it.id==="pack"){G.packs++;G.beds+=TURNKEY.pack}
      else if(it.id==="bed"){G.beds++}
      else if(it.id.startsWith("s:"))G.sensors[it.id.slice(2)]=1;
      else if(it.id.startsWith("p:"))G.own[it.id.slice(2)]=1;
      G.pendingSetup=(G.pendingSetup||0)+it.days;
      if(it.id!=="bed")items.splice(items.indexOf(it),1);
      for(let i=0;i<G.beds;i++)if(!G.plan[i])G.plan[i]=randCond();
      syncEquipment();frameView();render()});
    $("#b-ok").onclick=()=>{closeOverlay();
      if(G.pendingSetup){const d=Math.min(G.pendingSetup,daysLeft());G.setupDays+=d;G.pendingSetup=0;startPhase("setup",d);G.phaseStart=G.day;toast(`Setting up the new parts: ${d} day${d>1?"s":""}.`);ui();return}
      if(G.planner!=="you")setPlanner(G.planner);if(!canRun())finishSeason()};
  };
  render();
}

/* ---------- Step 1: define healthy ---------- */
function weightText(W){const tot=PK2.reduce((a,k)=>a+(W[k]||0),0);if(!tot)return "Nothing yet";return PROPS2.filter(p=>W[p.k]).map(p=>`${Math.round(W[p.k]/tot*100)}% ${p.name}`).join(" + ")}
function openDefine(team,keepW){
  r2New(team);if(keepW)G.weights=Object.assign({},keepW);PCTX=null;syncEquipment();frameView();ui();
  const presets=[{t:"Only height",w:{height:3,green:0,yield:0,vitc:0}},{t:"Balanced",w:{height:1,green:1,yield:1,vitc:1}},{t:"Nutritious",w:{height:0,green:1,yield:1,vitc:3}},{t:"Big harvest",w:{height:1,green:1,yield:3,vitc:0}}];
  const render=()=>{
    const W=G.weights;const any=PK2.some(k=>W[k]);
    const T=any?thresholdFor(W):0;
    openOverlay(`<div class="row" style="justify-content:space-between"><div class="eyebrow"><span class="label" style="color:var(--leaf)">Round 2 · Step 1 of 3: Define</span><span class="label">Step 2: Build</span><span class="label">Step 3: Run</span></div>${sayBtn("b-sayD")}</div>
     <h2>What is a healthy plant?</h2>
     <div class="goalbox"><ul class="goal"><li>In Round 1, healthy meant <b>tall</b>. Was that right?</li><li>Now <b>you</b> decide. Choose how much each property matters.</li><li>Together they make your <b>health score</b> from 0 to 100.</li></ul></div>
     <div class="row"><span class="label">Quick start:</span>${presets.map((p,i)=>`<button class="btn small" data-pre="${i}">${p.t}</button>`).join("")}</div>
     <div class="props">${PROPS2.map(p=>`<div class="prop"><div><h3 style="color:${p.col}">${p.name}</h3><span class="small">${p.what}</span></div>
       <div class="lv" role="group" aria-label="How important is ${p.name}?">${LEVELS.map(l=>`<button class="seg ${W[p.k]===l.w?"on":""}" data-k="${p.k}" data-w="${l.w}">${l.t}</button>`).join("")}</div></div>`).join("")}</div>
     <div class="total">Health score = ${weightText(W)}</div>
     ${any?`<p>A plant with a health score of <b style="color:var(--gold)">${Math.round(T)} or more</b> is <b style="color:var(--gold)">exceptional</b>. About 1 in 100 random conditions get there.</p>`:`<p class="warn">Choose at least one property.</p>`}
     <div class="row"><button class="btn primary big" id="b-next" ${any?"":"disabled"}>Next: build your lab ▶</button><button class="btn" id="b-back">Back</button></div>`);
    document.querySelectorAll("[data-pre]").forEach(b=>b.onclick=()=>{G.weights=Object.assign({},presets[+b.dataset.pre].w);render()});
    document.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{G.weights[b.dataset.k]=+b.dataset.w;render()});
    if($("#b-sayD"))$("#b-sayD").onclick=()=>speak(`What is a healthy plant? In round 1, healthy meant tall. Now you decide. There are four properties: height, leaf colour, harvest, and vitamin C. For each one, choose how important it is. Together they make your health score, from 0 to 100. Right now your health score is ${weightText(W).replace(/%/g," percent")}.`);
    $("#b-back").onclick=openTitle;
    $("#b-next").onclick=()=>{G.thr=T;G.thrR=Math.round(T);openBuild2()};
  };
  render();
}

/* ---------- Step 2: build ---------- */
function openBuild2(){
  const presets=[
    {t:"Plug and play",what:"GrowBox Pro: 8 plants, ready on day 1",f:()=>{G.system="turnkey";G.packs=0;G.beds=TURNKEY.beds;G.own={you:1,random:1};G.sensors=Object.fromEntries(TURNKEY.sensors.map(s=>[s,1]))}},
    {t:"Cheap and DIY",what:"Modular: 12 plants, simple sensors",f:()=>{G.system="modular";G.beds=12;G.own={you:1,random:1};G.sensors={ruler:1,scale:1,lab:1}}},
    {t:"Smart software",what:"Modular: 6 plants, Bayesian optimisation, good sensors",f:()=>{G.system="modular";G.beds=6;G.own={you:1,random:1,bo:1};G.sensors={ruler:1,scale:1,camera:1,lab:1}}},
  ];
  const render=()=>{
    if(G.system==="turnkey"){G.packs=0;G.beds=TURNKEY.beds;G.sensors=Object.fromEntries(TURNKEY.sensors.map(s=>[s,1]));G.own={you:1,random:1}}
    const spent=r2Spent();G.money=START_MONEY-spent;G.spent=spent;
    const meas=r2Measured();const setup=r2SetupDays();
    const keep=overlay.hidden?0:overlay.scrollTop;
    const blind=PROPS2.filter(p=>G.weights[p.k]&&!meas[p.k]);
    const mod=G.system==="modular";
    const sensorRows=SENS2.map(s=>{const on=!!G.sensors[s.id];const can=on||G.money>=s.price||!mod;
      return `<button class="choice ${on?"on":""}" data-sen="${s.id}" ${(!mod||(!can))?"disabled":""}><h3>${s.name}<span class="price">${s.perPlant?`${eur(s.perPlant)}/plant`:s.price?eur(s.price):"free"}</span></h3><span class="what">${s.what}</span><span class="note">Measures: ${Object.keys(s.m).map(k=>PROPS2.find(p=>p.k===k).name).join(", ")}${s.setup?` · ${s.setup} setup day${s.setup>1?"s":""}`:""}</span></button>`}).join("");
    const plannerRows=PLANNERS.filter(p=>p.price).map(p=>{const on=!!G.own[p.id];const can=on||G.money>=p.price;
      return `<button class="choice ${on?"on":""}" data-pl2="${p.id}" ${(!mod||!can)?"disabled":""}><h3>${p.name}<span class="price">${eur(p.price)}</span></h3><span class="what">${p.what}</span><span class="note">${p.days?`Thinks ${p.days} day${p.days>1?"s":""} before each batch`:"No waiting"}${mod?" · 1 setup day":""}</span></button>`}).join("");
    openOverlay(`<div class="row" style="justify-content:space-between"><div class="eyebrow"><span class="label">Step 1: Define</span><span class="label" style="color:var(--leaf)">Step 2 of 3: Build</span><span class="label">Step 3: Run</span></div>${sayBtn("b-sayB")}</div>
     <h2>You won ${eur(START_MONEY)} to build your lab</h2>
     <p>Health score = <b>${weightText(G.weights)}</b>. Exceptional = <b style="color:var(--gold)">${G.thrR} or more</b>.</p>
     <div class="row"><span class="label">Quick start:</span>${presets.map((p,i)=>`<button class="btn small" data-bp="${i}" title="${p.what}">${p.t}</button>`).join("")}</div>
     <h3>1. Buy a complete set, or build it yourself?</h3>
     <p>There are two ways to get a self-driving lab:</p>
     <ul class="goal">
       <li><b>Buy a complete set.</b> One company sells everything together: room for plants, sensors, robot and software. It all works together from day 1. But you can only use what is in the box.</li>
       <li><b>Build it yourself.</b> Start small and add parts one by one: more plants, other sensors, a smarter planner. You choose every part. But each new part takes time to set up, and home-made setups break more often.</li>
     </ul>
     <p>Real labs face the same choice: a closed system that just works, or an open one you can change.</p>
     <div class="cols">
       <button class="choice ${G.system==="turnkey"?"on":""}" data-sys="turnkey"><h3>GrowBox Pro (complete set)<span class="price">${eur(TURNKEY.price)}</span></h3>
         <span class="what">Room for ${TURNKEY.beds} plants, a ruler, a scale and a colour camera. No smart planner: you decide, or pick at random.</span>
         <span class="note">Works on day 1. Never breaks. But it is closed: you cannot add other sensors or planners.</span></button>
       <button class="choice ${mod?"on":""}" data-sys="modular"><h3>Modular parts (build it yourself)<span class="price">from ${eur(MOD.basePrice)}</span></h3>
         <span class="what">A controller and room for 1 plant for ${eur(MOD.basePrice)}. Each extra plant ${eur(MOD.bedPrice)}. Add any sensors and planners.</span>
         <span class="note">Cheaper per plant and flexible. But setting up takes days, and parts sometimes break.</span></button>
     </div>
     <h3>2. Plants at once (N)</h3>
     <p>N is how many plants grow side by side in each batch. A batch grows for ${GROW_DAYS} days. Then you see the results and start a new batch. More plants at once means more chances to find an exceptional plant in every batch.</p>
     ${G.system==="turnkey"?`<div class="stepper"><span class="num bigbeds">${G.beds}</span><span>plants, fixed</span></div><p class="small">The GrowBox holds ${TURNKEY.beds} plants. You cannot add more.</p>`:
      `<div class="stepper"><button class="btn" id="b-bm" ${G.beds<=1?"disabled":""} aria-label="One plant fewer">−</button><span class="num bigbeds">${G.beds}</span><span>plant${G.beds>1?"s":""}</span><button class="btn" id="b-bp" ${G.beds>=MOD.maxBeds||G.money<MOD.bedPrice?"disabled":""} aria-label="One plant more">+</button></div><p class="small">Each extra plant: ${eur(MOD.bedPrice)}</p>`}
     <h3>3. Sensors: what can you see?</h3>
     <div class="buylist">${sensorRows}</div>
     <div class="checks">${PROPS2.filter(p=>G.weights[p.k]).map(p=>meas[p.k]?`<span class="ok">✓ ${p.name}: measured by ${SENS2M[meas[p.k].by].name}</span>`:`<span class="bad">✗ ${p.name}: not measured. Your planner cannot see it!</span>`).join("")}</div>
     <h3>4. Planner (p)</h3>
     <div class="buylist">${plannerRows}</div>
     <h3>5. During the round</h3>
     <ul class="goal">${r2DuringText(setup).map(s=>`<li>${s}</li>`).join("")}</ul>
     <div class="total">Money left: ${eur(G.money)} of ${eur(START_MONEY)} · Setup before you start: ${setup} day${setup===1?"":"s"} · ${G.beds} plants per batch</div>
     ${blind.length?`<p class="warn">Warning: ${blind.map(p=>p.name).join(" and ")} ${blind.length>1?"are":"is"} part of your health score, but nothing measures ${blind.length>1?"them":"it"}.</p>`:""}
     <div class="row"><label class="label" for="team">Team name</label><input id="team" type="text" maxlength="24" placeholder="e.g. Basil Instinct" value="${esc(G.team)}"></div>
     <div class="row"><button class="btn primary big" id="b-go2" ${G.money<0?"disabled":""}>Build it and start step 3 ▶</button><button class="btn" id="b-back2">Back to step 1</button></div>`);
    overlay.scrollTop=keep;
    const keepTeam=()=>{const t=$("#team");if(t)G.team=t.value};
    document.querySelectorAll("[data-bp]").forEach(b=>b.onclick=()=>{keepTeam();presets[+b.dataset.bp].f();syncEquipment();frameView();render()});
    document.querySelectorAll("[data-sys]").forEach(b=>b.onclick=()=>{keepTeam();const s=b.dataset.sys;if(s===G.system)return;G.system=s;
      if(s==="modular"){G.beds=6;G.sensors={ruler:1};G.own={you:1,random:1}}else{G.packs=0}syncEquipment();frameView();render()});
    if($("#b-pm"))$("#b-pm").onclick=()=>{keepTeam();G.packs=Math.max(0,G.packs-1);syncEquipment();frameView();render()};
    if($("#b-pp"))$("#b-pp").onclick=()=>{keepTeam();G.packs++;syncEquipment();frameView();render()};
    if($("#b-bm"))$("#b-bm").onclick=()=>{keepTeam();G.beds=Math.max(1,G.beds-1);syncEquipment();frameView();render()};
    if($("#b-bp"))$("#b-bp").onclick=()=>{keepTeam();G.beds++;syncEquipment();frameView();render()};
    document.querySelectorAll("[data-sen]").forEach(b=>b.onclick=()=>{keepTeam();const id=b.dataset.sen;if(id==="ruler")return;G.sensors[id]=G.sensors[id]?0:1;syncEquipment();render()});
    document.querySelectorAll("[data-pl2]").forEach(b=>b.onclick=()=>{keepTeam();const id=b.dataset.pl2;if(G.own[id])delete G.own[id];else G.own[id]=1;syncEquipment();render()});
    if($("#b-sayB"))$("#b-sayB").onclick=()=>speak(`Build your lab. You have ${START_MONEY} dollars. First choose how to get your lab. You can buy a complete set, the GrowBox. One company sells everything together, and it works from day one. But you can only use what is in the box. Or you can build it yourself from modular parts. Start small and add parts one by one. You choose every part, and it is cheaper per plant. But each new part takes time to set up, and home-made setups break more often. Then choose how many plants grow at once in each batch. This is N. More plants at once means more chances to find an exceptional plant. Then choose sensors and a planner. Sensors decide what you can measure. If your health score needs something that no sensor measures, your planner cannot see it. Money you do not spend stays in the bank. You need it for lab tests, which you pay in every batch, and for upgrades on day 21. Modular parts sometimes break. Repairs happen by themselves and cost no money, but they cost plants or time. You have ${G.money} dollars left, and setup takes ${setup} days.`);
    $("#b-back2").onclick=()=>{keepTeam();openDefine(G.team,G.weights)};
    $("#b-go2").onclick=()=>{keepTeam();if(G.money<0)return;const t=(G.team||"").trim()||"Team "+(100+Math.floor(rng()*900));localSet("sdl-team",t);G.team=t;r2Start()};
  };
  render();
}
function r2Start(){
  PCTX=r2Context();
  closeOverlay();syncEquipment();frameView();
  const smart=["twin","rough","bo"].find(id=>G.own[id]);
  if(smart){G.planner=smart}else{G.planner="you";G.planFrom="you"}
  G.setupDays=r2SetupDays();
  if(G.setupDays>0){G.phase="setup";startPhase("setup",G.setupDays);toast(`Setting up your modular lab: ${G.setupDays} day${G.setupDays>1?"s":""}.`)}
  else{G.phase="plan";toast("Your GrowBox works out of the box. Day 1 starts now.")}
  if(smart){const cs=plan(smart,G.data,G.beds);for(let i=0;i<G.beds;i++)G.plan[i]=cs[i];G.planFrom=smart}
  ui();
}

/* Build screen: what happens to money, upgrades and repairs once the round runs */
function r2DuringText(setup){
  const mod=G.system==="modular",out=[];
  out.push("<b>Money:</b> money you do not spend now stays in the bank. You can use it later in the round.");
  if(G.weights.vitc&&G.sensors.lab){
    const per=SENS2M.lab.perPlant*G.beds,smart=["twin","rough","bo"].find(id=>G.own[id]);
    const n=Math.max(1,Math.floor((SEASON_DAYS-setup)/(GROW_DAYS+SENS2M.lab.wait+(smart?PLANNER[smart].days:0))));
    out.push(`<b>Vitamin C tests:</b> ${G.beds} plants × ${eur(SENS2M.lab.perPlant)} = <b>${eur(per)} per batch</b>. You pay at the start of every batch. For about ${n} batches, that is about <b>${eur(per*n)}</b>. If you run out of money, vitamin C is not measured.`
      +(G.money<per*n?` <span class="warn">You have less than that left.</span>`:""));
  }else if(G.weights.vitc)out.push(`<b>Vitamin C tests:</b> if you choose the lab test, it costs ${eur(SENS2M.lab.perPlant)} per plant in every batch. Keep money for it.`);
  out.push(mod?"<b>Upgrades:</b> on day 21 your funder checks in. If you have an exceptional plant by then, you get <b>$2,000</b> more. Then you can spend your money on more plants, sensors or planners. New parts need setup days."
             :"<b>Upgrades:</b> on day 21 your funder checks in. If you have an exceptional plant by then, you get <b>$2,000</b> more. But the GrowBox is closed, so you cannot add anything to it.");
  out.push(mod?"<b>Repairs:</b> modular parts sometimes break. Repairs happen by themselves and cost no money, but they cost plants or time. A clogged pump kills one plant. A crashed controller costs 1 day. A camera that loses calibration gives noisy colour readings for one batch."
             :"<b>Repairs:</b> the GrowBox never breaks, so there is nothing to repair.");
  return out;
}

/* ---------- Step 3 panels ---------- */
function r2RenderTop(){
  const gold=G.data.filter(d=>d.y!=null&&d.y>=G.thr).length;
  $("#top").innerHTML=`
   <div class="panel cell"><span class="label">Round 2 · Step 3: Run</span><span class="big">Day <span id="dayval">${G.day}</span><span style="font-size:14px;color:var(--muted)"> / ${SEASON_DAYS}</span></span><div id="daybar"><i></i></div></div>
   <div class="panel cell"><span class="label">${esc(G.team)}'s lab</span><span class="big" style="font-size:16px"><span style="color:var(--amber)">${G.system==="turnkey"?"GrowBox":"Modular"} · ${G.beds} plants</span></span></div>
   <div class="panel cell"><span class="label">Money left</span><span class="big" style="color:var(--gold)">${eur(G.money)}</span></div>
   <div class="panel cell"><span class="label">Health score</span><span class="big" style="font-size:14px;max-width:260px;white-space:normal">${weightText(G.weights)}</span></div>
   <div class="panel cell"><span class="label">Exceptional (${G.thrR}+)</span><span class="big" style="color:var(--gold)">${gold}</span></div>
   <div id="ctrls" class="panel"><button class="btn small" id="b-tour">How to play</button>${sayBtn("b-say2")}<button class="btn small" id="b-fast">${G.fast?"Speed: fast":"Speed: normal"}</button><button class="btn small" id="b-finish">Finish</button></div>`;
  $("#b-fast").onclick=()=>{G.fast=!G.fast;ui()};
  $("#b-tour").onclick=()=>{if(G.phase==="plan")startTour();else toast("The tour opens when you can plan the next batch.")};
  if($("#b-say2"))$("#b-say2").onclick=()=>{const b=best();speak(`Day ${G.day} of ${SEASON_DAYS}. You have ${gold} exceptional plants and ${Math.round(G.money)} dollars left. ${b?`Your best health score is ${Math.round(b.y)}. `:""}Set the conditions on the left, or choose a planner. Then press Plant and grow.`)};
  $("#b-finish").onclick=()=>{if(G.phase==="plan")finishSeason()};
  updateClock();
  document.documentElement.style.setProperty("--toph",$("#top").offsetHeight+"px");
}
function propBars(real,seen){
  return `<div class="pbars">${PROPS2.map(p=>{const s=seen?seen[p.k]:null;const used=G.weights[p.k]>0;
    return `<div class="pbar ${used?"":"dim"}"><span>${p.name}${used?"":" (ignored)"}</span><div class="track"><i style="width:${Math.round((s!=null?s:0)*100)}%;background:${p.col}"></i></div><b>${s!=null?fmtP(p.k,s):"not measured"}</b></div>`}).join("")}</div>`;
}
function r2RenderRight(){
  const b=best();const sel=Math.min(G.selected??0,G.beds-1);const p=G.plants[sel];
  $("#right").innerHTML=`
   <section class="panel card"><h3>Health score of every plant</h3>
     <canvas class="chart" id="dots" style="height:280px" role="img" aria-label="Health score of every plant, batch by batch"></canvas>
     ${b?`<p class="small">Best so far: <b style="color:var(--ink)">${Math.round(b.y)}</b></p>`:""}</section>
   <section class="panel card"><h3>Plant ${sel+1}${p&&p.frac>=1&&!p.dead?`: score ${p.y==null?"?":Math.round(p.y)}`:""}</h3>
     ${p&&p.frac>=1?(p.dead?`<p class="small">This plant died (pump clogged).</p>`:propBars(p.props,p.seen)+`<p class="small">What your sensors measured. Click another plant to compare.</p>`):`<p class="small">Grow a batch, then click a plant to see what was measured.</p>`}</section>`;
  drawDots($("#dots"));
}

/* ---------- end ---------- */
function r2Finish(){
  G.phase="done";ui();
  const plants=G.data.length;
  const golds=G.data.filter(d=>d.y!=null&&d.y>=G.thr);
  const real=golds.filter(d=>d.ts>=G.thr).length;
  const bestD=best();
  const stars=bestD?expertStars(bestD.real):0;
  const onlyOne=PK2.filter(k=>G.weights[k]).length===1;
  const blind=PROPS2.filter(p=>G.weights[p.k]&&!r2Measured()[p.k]);
  const code=encodeResult2();G.code=code;
  const lessons=[];
  if(blind.length)lessons.push(`Nothing measured ${blind.map(p=>p.name.toLowerCase()).join(" or ")}, so your planner never saw ${blind.length>1?"them":"it"}. You can only optimise what you measure.`);
  if(golds.length>real)lessons.push(`${golds.length-real} of your "exceptional" plants were not really exceptional. Noisy or missing measurements fooled you.`);
  if(onlyOne&&stars<=2)lessons.push(`You optimised only one property. The plant expert, who cares about everything, gave your best plant ${stars} of 5 stars.`);
  if(G.system==="modular"&&(G.setupDays||G.breakdowns))lessons.push(`Building it yourself cost ${G.setupDays} setup day${G.setupDays===1?"":"s"} and ${G.breakdowns} breakdown${G.breakdowns===1?"":"s"}.`);
  if(G.system==="turnkey")lessons.push(`The GrowBox worked from day 1 and never broke, but you could not add new sensors or a smarter planner.`);
  if(G.labCost)lessons.push(`Lab tests cost ${eur(G.labCost)} and ${SENS2M.lab.wait} extra days per batch.`);
  openOverlay(`<div class="row" style="justify-content:space-between"><span class="label">Day ${G.day}: Round 2 over</span>${sayBtn("b-say3")}</div>
   <h2>${esc(G.team)}: ${golds.length} exceptional plant${golds.length===1?"":"s"}</h2>
   <div class="stats">
     <div class="stat"><div class="v" style="color:var(--gold)">${golds.length}</div><div class="k">Exceptional by your measurements</div></div>
     <div class="stat"><div class="v" style="color:var(--leaf)">${real}</div><div class="k">Really exceptional, checked with perfect measurements</div></div>
     <div class="stat"><div class="v">${plants}</div><div class="k">Plants grown</div></div>
     <div class="stat"><div class="v">${G.setupDays}</div><div class="k">Days lost to setup</div></div>
     <div class="stat"><div class="v">${G.breakdowns}</div><div class="k">Breakdowns</div></div>
     <div class="stat"><div class="v">${eur(G.spent+G.labCost)}</div><div class="k">Money spent</div></div>
   </div>
   <h3>The plant expert tastes your best plant</h3>
   ${bestD?`<p class="small">The expert cares about all four properties equally. These are the true values.</p>${propBars(bestD.real,bestD.real).replace(/ \(ignored\)/g,"")}
     <p><span class="stars" aria-label="${stars} of 5 stars">${"★".repeat(stars)}${"☆".repeat(5-stars)}</span> ${stars>=4?"A truly healthy plant.":stars>=3?"A good plant overall.":"Good on your score, but not very healthy overall."}</p>`:`<p class="small">No plant was measured.</p>`}
   <h3>What happened</h3><ul class="lessons">${lessons.map(l=>`<li>${l}</li>`).join("")||"<li>A smooth season.</li>"}</ul>
   <h3>Talk about it</h3><ul class="lessons"><li>Was your health score a good definition of a healthy plant?</li><li>Ready-made or modular: what would you choose for a real lab, and why?</li><li>Which sensor was worth its price?</li></ul>
   <h3>Class leaderboard</h3>
   <div class="row"><span class="code" id="code">${code}</span><button class="btn small" id="b-copy">Copy</button></div>
   <p class="small" id="post-status">Posting your result…</p>
   <div class="row"><button class="btn primary" id="b-again">Play Round 2 again</button><button class="btn" id="b-board">Open leaderboard</button><button class="btn" id="b-home">Start screen</button></div>`);
  if($("#b-say3"))$("#b-say3").onclick=()=>speak(`Round 2 over. ${golds.length} plants were exceptional by your measurements. ${real} were really exceptional. The plant expert gave your best plant ${stars} out of 5 stars. ${lessons.join(" ")}`);
  $("#b-again").onclick=()=>openDefine(G.team);
  $("#b-board").onclick=()=>openBoard("end");
  $("#b-home").onclick=openTitle;
  $("#b-copy").onclick=()=>{try{navigator.clipboard.writeText(code).then(()=>toast("Code copied."),()=>{})}catch(e){}};
  submitResult2(code,{gold:golds.length,real,stars});
}
