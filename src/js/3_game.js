/* ================================================================
   Game flow and interface
   plan → (computer thinks) → plants grow for a week → look at results → plan again
   ================================================================ */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const overlay=$("#overlay");
const overlayClosed=()=>overlay.hidden;
function openOverlay(html){overlay.innerHTML=`<div class="modal panel" role="dialog" aria-modal="true">${html}</div>`;overlay.hidden=false;overlay.scrollTop=0}
function closeOverlay(){overlay.hidden=true;overlay.innerHTML="";ui()}
function toast(msg,kind){const box=$("#toasts");const t=document.createElement("div");t.className="toast panel "+(kind||"");t.textContent=msg;box.appendChild(t);while(box.children.length>3)box.removeChild(box.firstChild);setTimeout(()=>t.remove(),kind==="gold"?5000:3800)}
const canSpeak=typeof window.speechSynthesis!=="undefined"&&typeof window.SpeechSynthesisUtterance!=="undefined";
function speak(text){if(!canSpeak)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g,""));u.rate=.92;u.lang="en-GB";speechSynthesis.speak(u)}catch(e){}}
const sayBtn=id=>canSpeak?`<button class="btn small speak" id="${id}" title="Read this page aloud">Read aloud</button>`:"";
function localGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function localSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}

const DAY_MS={think:900,grow:650,setup:600,wait:600};
const BATCH_COLS=["#e8e1c8","#f2b33d","#7fd650","#5fd3e8","#d685ff","#ff7a66","#ffd84a","#9bb0ff","#c9a26a","#ffffff"];
let G=null;

function newGame(team){
  G={team,day:0,money:START_MONEY,spent:0,beds:BEDS_START,own:{you:1,random:1},planner:"you",planFrom:"you",
    plan:[],plants:[],data:[],sims:[],batches:[],phase:"build",phaseT:0,phaseDays:0,selected:0,firstGold:null,runId:Date.now().toString(36)+Math.floor(rng()*1e6).toString(36)};
  G.plan=[...Array(BEDS_MAX)].map(randCond);   // a spread to start from
}
const thinkDays=()=>PLANNER[G.planFrom]?PLANNER[G.planFrom].days:0;
const batchCost=()=>G.beds*PLANT_COST;
const daysLeft=()=>SEASON_DAYS-G.day;
const waitDays=()=>G.round===2?r2WaitDays():0;
const canRun=()=>daysLeft()>=thinkDays()+GROW_DAYS+waitDays();
const best=()=>G.data.filter(d=>d.y!=null).reduce((a,d)=>!a||d.y>a.y?d:a,null);

/* ---------- planning ---------- */
function setPlanner(id){
  G.planner=id;
  if(id==="you"){G.planFrom="you";ui();return}
  const cs=plan(id,G.data,G.beds);
  for(let i=0;i<G.beds;i++)G.plan[i]=cs[i];
  G.planFrom=id;ui();
}
function editPlan(i,k,x){G.plan[i][k]=clamp(x,0,1);if(G.planFrom!=="you"){G.planFrom="you";G.planner="you"}refreshPlanRows()}
function fillAll(fn){for(let i=0;i<G.beds;i++)G.plan[i]=fn(i);G.planFrom="you";G.planner="you";ui()}
function frameView(){const rows=Math.ceil(G.beds/4);view.r=rows<=1?22:rows<=2?28:rows<=3?32:38;view.tz=rows<=1?ROWZ[0]:rows<=2?0:rows<=4?0:0;view.tx=0}
/* ---------- running a batch ---------- */
function startBatch(){
  if(G.phase!=="plan")return;
  if(!canRun()){finishSeason();return}
  G.cur={n:G.batches.length+1,planner:G.planFrom,beds:G.beds,conds:G.plan.slice(0,G.beds).map(c=>c.slice())};
  if(G.cur.planner==="rough"||G.cur.planner==="twin"){const sims=simulate(G.cur.planner,G.cur.conds,G.cur.n);G.cur.simFrom=G.sims.length;G.cur.simCount=sims.length;G.sims.push(...sims)}
  for(let i=0;i<24;i++)G.plants[i]=null;refreshAll();
  if(G.round===2)r2PrepareBatch();
  if(thinkDays()>0)startPhase("think",thinkDays());
  else beginGrow();
  ui();
}
function startPhase(name,days){G.phase=name;G.phaseDays=days;G.phaseT=0;G.phaseStart=G.day}
/* the twin screens many ideas in silico while it computes; the planted ones are revealed last */
function simulate(planner,conds,batch){
  const pred=PCTX?(planner==="twin"?c=>PCTX.detailed(c)*PCTX.ymax:c=>PCTX.rough(c)*PCTX.ymax):(planner==="twin"?c=>heightOf([c[0]+.06,c[1]-.05,c[2]+.07,c[3]-.04])*.95:c=>4+roughPrior(c)*HMAX);
  const total=PLANNER[planner].days*30;const out=[];
  const top=PCTX?PCTX.ymax:75;
  for(let i=0;i<total;i++){const c=i%2?randCond():mutate(conds[i%conds.length],.16);out.push({batch,y:clamp(pred(c),0,top),chosen:false,planner})}
  for(const c of conds)out.push({batch,y:clamp(pred(c),0,top),chosen:true,planner});
  return out;
}
function beginGrow(){
  startPhase("grow",GROW_DAYS);G.cur.plantDay=G.day;
  if(G.round===2)r2Grow();
  else G.cur.conds.forEach((c,i)=>{const h=grow(c);G.plants[i]={c,h,y:h,frac:.04,gold:h>=GOLD}});
  refreshAll();
}
function tick(dt){
  if(!["setup","think","grow","wait"].includes(G.phase))return;
  if(!overlayClosed())return;
  const ms=DAY_MS[G.phase]/(G.fast?3:1);
  G.phaseT+=dt*1000;
  if(G.phase==="grow"){const f=clamp(G.phaseT/(ms*GROW_DAYS),0,1);const e=1-Math.pow(1-f,2);for(let i=0;i<G.beds;i++){const p=G.plants[i];if(p)p.frac=Math.max(.04,e)}
    if(Math.floor(G.phaseT/120)!==Math.floor((G.phaseT-dt*1000)/120))growVisual()}
  const d=Math.min(G.phaseDays,Math.floor(G.phaseT/ms));
  if(G.phaseStart+d!==G.day){G.day=G.phaseStart+d;updateClock()}
  if(G.phase==="think"&&G.cur.simCount){const shown=Math.floor(clamp(G.phaseT/(ms*G.phaseDays),0,1)*G.cur.simCount);if(shown!==G.cur.simShown){G.cur.simShown=shown;drawDots($("#dots"))}}
  if(G.phaseT>=ms*G.phaseDays){
    G.day=G.phaseStart+G.phaseDays;
    if(G.phase==="setup"){G.phase="plan";toast("Your lab is ready. Plant the next batch!");if(G.planner!=="you")setPlanner(G.planner);ui()}
    else if(G.phase==="think"){if(G.cur.simCount){G.cur.simShown=G.cur.simCount;drawDots($("#dots"))}beginGrow()}
    else if(G.phase==="grow"&&G.cur.wait>0){for(let i=0;i<G.beds;i++)if(G.plants[i])G.plants[i].frac=1;refreshAll();startPhase("wait",G.cur.wait);ui()}
    else endBatch();
  }
}
function endBatch(){
  if(G.round===2)r2Finalise();
  const ys=[];let gold=0;
  for(let i=0;i<G.cur.beds;i++){const p=G.plants[i];p.frac=1;if(p.dead)continue;G.data.push(Object.assign({c:p.c.slice(),y:p.y,batch:G.cur.n,day:G.day,planner:G.cur.planner},p.extra||{}));ys.push(p.y??0);if(p.gold)gold++}
  if(!ys.length)ys.push(0);
  G.batches.push({n:G.cur.n,planner:G.cur.planner,beds:G.cur.beds,day:G.day,ys,gold,thinkDays:PLANNER[G.cur.planner]?PLANNER[G.cur.planner].days:0});
  if(gold&&G.firstGold==null)G.firstGold=G.day;
  refreshAll();
  const mx=Math.max(...ys);
  if(G.round===2)toast(gold?`Batch ${G.cur.n}: ${gold} of ${G.cur.beds} plants are exceptional!`:`Batch ${G.cur.n}: best health score ${Math.round(mx)}. None reached ${G.thrR}.`,gold?"gold":"");
  else toast(gold?`Batch ${G.cur.n}: ${gold} of ${G.cur.beds} plants are exceptional (≥ ${GOLD} cm)!`:`Batch ${G.cur.n}: tallest plant ${Math.round(mx)} cm. None reached ${GOLD} cm.`,gold?"gold":"");
  G.phase="plan";G.cur=null;
  // the next plan: an algorithm proposes again; "you" keeps your conditions so you can adjust them
  if(G.planner!=="you")setPlanner(G.planner);
  const b=best();G.selected=G.data.length?G.data.length-ys.length+ys.indexOf(Math.max(...ys)):0;G.selected=ys.indexOf(Math.max(...ys));
  ui();
  if(G.round===2&&r2Review())return;
  if(!canRun()){setTimeout(finishSeason,1400)}
}
function selectPlant(i){if(i>=G.beds)return;G.selected=i;walkTo(i);ui()}

/* ---------- top bar ---------- */
function updateClock(){const i=$("#daybar i");if(i&&G)i.style.width=Math.min(100,G.day/SEASON_DAYS*100)+"%";const d=$("#dayval");if(d&&G)d.textContent=G.day;if(G&&["grow","think","setup","wait"].includes(G.phase))renderAction()}
function renderTop(){
  if(G.round===2)return r2RenderTop();
  const gold=G.data.filter(d=>d.y>=GOLD).length;
  $("#top").innerHTML=`
   <div class="panel cell"><span class="label">Use the self-driving greenhouse</span><span class="big">Day <span id="dayval">${G.day}</span><span style="font-size:13px;color:var(--muted)"> / ${SEASON_DAYS}</span></span><div id="daybar"><i></i></div></div>
   <div class="panel cell"><span class="label">${esc(G.team)}'s lab</span><span class="big" style="font-size:16px"><span style="color:var(--amber)">${G.beds} bed${G.beds>1?"s":""}</span> · <span style="color:var(--magenta)">${ownedPlanners().filter(p=>p.price>0).map(p=>p.name).join(", ")||"no planner bought"}</span></span></div>
   <div class="panel cell"><span class="label">Exceptional plants</span><span class="big" style="color:var(--gold)">${gold}</span></div>
   <div id="ctrls" class="panel"><button class="btn small" id="b-tour">How to play</button>${sayBtn("b-say2")}<button class="btn small" id="b-fast" title="Animation speed">${G.fast?"Speed: fast":"Speed: normal"}</button><button class="btn small" id="b-finish">Finish</button></div>`;
  $("#b-fast").onclick=()=>{G.fast=!G.fast;ui()};
  $("#b-tour").onclick=()=>{if(G.phase==="plan")startTour();else toast("The tour opens when you can plan the next batch.")};
  if($("#b-say2"))$("#b-say2").onclick=()=>{const b=best();speak(`Day ${G.day} of ${SEASON_DAYS}. You have ${gold} exceptional plant${gold===1?"":"s"}. ${b?`Your tallest plant is ${Math.round(b.y)} centimetres. `:""}On the left, set the conditions for each bed, or choose a planner. Then press Plant and grow.`)};
  $("#b-finish").onclick=()=>{if(G.phase==="plan")finishSeason()};
  updateClock();
  document.documentElement.style.setProperty("--toph",$("#top").offsetHeight+"px");
}

/* ---------- left: plan the next batch ---------- */
const ownedPlanners=()=>PLANNERS.filter(p=>G.own[p.id]);
function bar(x,col){return `<span class="mini"><i style="width:${Math.round(x*100)}%;background:${col}"></i></span>`}
function renderLeft(){
  const busy=G.phase!=="plan";
  const sel=Math.min(G.selected??0,G.beds-1);const c=G.plan[sel];
  const plannerCards=ownedPlanners().map(p=>{const on=G.planner===p.id;
    const tag=p.days?`+${p.days} day${p.days>1?"s":""} per batch`:"instant";
    return `<button class="pl ${on?"on":""}" data-pl="${p.id}" ${busy?"disabled":""} title="${esc(p.what)}">
      <span class="pn">${p.name}</span><span class="pm">${tag}</span></button>`}).join("");
  const rows=G.plan.slice(0,G.beds).map((c,i)=>`<button class="prow ${i===sel?"on":""}" data-row="${i}" ${busy?"disabled":""}><span class="pi">${i+1}</span>${KNOBS.map((k,j)=>bar(c[j],k.col)).join("")}</button>`).join("");
  $("#left").innerHTML=`
   <section class="panel card"><h3>Next batch <span style="color:var(--amber)">· N = ${G.beds}</span></h3>
     <div class="kh"><span></span>${KNOBS.map(k=>`<span style="color:${k.col}">${k.name}</span>`).join("")}</div>
     <div class="prows">${rows}</div>
     <div class="editor"><span class="label">Bed ${sel+1}</span>
       ${KNOBS.map((k,j)=>`<label class="sl"><span>${k.name}</span><input type="range" id="k${j}" min="0" max="1" step="0.01" value="${c[j]}" ${busy?"disabled":""} style="accent-color:${k.col}"><b class="num" id="kv${j}">${fmtK(j,c[j])}</b><span class="u">${k.unit}</span></label>`).join("")}
     </div>
     ${G.beds>1?`<div class="rowbtns">
       <button class="btn small" id="b-copy" ${busy?"disabled":""}>Copy bed ${sel+1} to all</button>
       <button class="btn small" id="b-rand" ${busy?"disabled":""}>Randomise all</button>
       <button class="btn small" id="b-best" ${busy||!G.data.length?"disabled":""}>Best + small changes</button></div>`:""}</section>
   <section class="panel card"><h3>Who sets them? <span style="color:var(--magenta)">p</span></h3>
     <div class="planners">${plannerCards}</div></section>`;
  document.querySelectorAll("[data-pl]").forEach(b=>b.onclick=()=>setPlanner(b.dataset.pl));
  document.querySelectorAll("[data-row]").forEach(b=>b.onclick=()=>selectPlant(+b.dataset.row));
  KNOBS.forEach((k,j)=>{const s=$("#k"+j);s.oninput=()=>{editPlan(sel,j,+s.value);$("#kv"+j).textContent=fmtK(j,+s.value)}});
  if($("#b-copy"))$("#b-copy").onclick=()=>fillAll(()=>G.plan[sel].slice());if($("#b-rand"))$("#b-rand").onclick=()=>fillAll(randCond);if($("#b-best"))$("#b-best").onclick=()=>{const b=best();if(b)fillAll(i=>i===0?b.c.slice():mutate(b.c,.07))};
}
function refreshPlanRows(){const sel=G.selected??0;const row=document.querySelector(`[data-row="${sel}"]`);if(row)row.innerHTML=`<span class="pi">${sel+1}</span>${KNOBS.map((k,j)=>bar(G.plan[sel][j],k.col)).join("")}`;
  document.querySelectorAll("[data-pl]").forEach(b=>b.classList.toggle("on",b.dataset.pl===G.planner))}
/* ---------- right: results ---------- */
function renderRight(){
  if(G.round===2)return r2RenderRight();
  const b=best();
  $("#right").innerHTML=`
   <section class="panel card"><h3>Every plant you have grown</h3>
     <canvas class="chart" id="dots" style="height:300px" role="img" aria-label="Height of every plant, batch by batch"></canvas>
     ${b?`<p class="small">Tallest so far: <b style="color:var(--ink)">${Math.round(b.y)} cm</b></p>`:""}</section>`;
  drawDots($("#dots"));
}
function prepCanvas(cv){if(!cv)return null;const dpr=window.devicePixelRatio||1;const W=cv.clientWidth,H=cv.clientHeight;if(!W)return null;cv.width=W*dpr;cv.height=H*dpr;const g=cv.getContext("2d");g.scale(dpr,dpr);return {g,W,H}}
function drawDots(cv,big){
  const c=prepCanvas(cv);if(!c)return;const {g,W,H}=c;
  const FONT=f=>`${f}px Lexend, Verdana, sans-serif`;
  const nb=Math.max(6,G.batches.length+(G.cur?1:0));
  const R2=G.round===2,GL=R2?G.thr:GOLD;
  const YMAX=R2?135:90;   // headroom above the tallest plants for the legend
  const L=46,R=8,T=8,B=40;const pw=W-L-R,ph=H-T-B;const X=b=>L+(b-.5)/nb*pw,Y=v=>T+(1-v/YMAX)*ph;
  g.fillStyle="#0f1512";g.fillRect(0,0,W,H);g.font=FONT(13);g.fillStyle="#c3cfbe";g.strokeStyle="#2a3530";g.lineWidth=1;
  g.textAlign="right";g.textBaseline="middle";for(const v of (R2?[0,25,50,75,100]:[0,20,40,60])){g.beginPath();g.moveTo(L,Y(v));g.lineTo(L+pw,Y(v));g.stroke();g.fillText(v,L-6,Y(v))}
  g.textAlign="center";g.textBaseline="top";for(let b=1;b<=nb;b++)g.fillText(b,X(b),T+ph+4);
  g.fillText("Batch",L+pw/2,T+ph+21);
  g.save();g.translate(13,T+ph*.62);g.rotate(-Math.PI/2);g.textBaseline="middle";g.fillText(R2?"Health score":"Height (cm)",0,0);g.restore();
  // the exceptional line
  g.strokeStyle="#ffd84a";g.lineWidth=1.5;g.setLineDash([6,4]);g.beginPath();g.moveTo(L,Y(GL));g.lineTo(L+pw,Y(GL));g.stroke();g.setLineDash([]);g.lineWidth=1;
  const col=pw/nb;const rs=mulberry32(11);const hasSims=G.sims.length>0;
  G.sims.forEach((d,i)=>{const jx=(rs()-.5)*col*.42;
    if(G.cur&&d.batch===G.cur.n&&i-G.cur.simFrom>=(G.cur.simShown||0))return;
    const x=X(d.batch)-col*.16+jx;g.globalAlpha=d.chosen?1:.5;g.strokeStyle=d.chosen?"#ffffff":"#b9c6b3";g.lineWidth=d.chosen?1.8:1;g.beginPath();g.arc(x,Y(d.y),d.chosen?3.8:2.6,0,7);g.stroke()});
  g.globalAlpha=1;g.lineWidth=1;
  const rr=mulberry32(5);
  for(const d of G.data){if(d.y==null)continue;const x=X(d.batch)+(hasSims?col*.3:0)+(rr()-.5)*col*(hasSims?.2:.6);const gold=d.y>=GL;
    g.fillStyle=gold?"#ffd84a":"#7fd650";g.beginPath();g.arc(x,Y(d.y),gold?(big?5.5:4.5):(big?4:3.4),0,7);g.fill();
    if(gold){g.strokeStyle="#0f1512";g.lineWidth=1;g.stroke()}}
  // legend, top right
  const items=[{t:"Plant",draw:(x,y)=>{g.fillStyle="#7fd650";g.beginPath();g.arc(x,y,4,0,7);g.fill()}},
    {t:R2?`Exceptional (score ${G.thrR} or more)`:`Exceptional (${GOLD} cm or more)`,draw:(x,y)=>{g.fillStyle="#ffd84a";g.beginPath();g.arc(x,y,5,0,7);g.fill()}}];
  if(hasSims){items.push({t:"Twin's prediction",draw:(x,y)=>{g.strokeStyle="#b9c6b3";g.lineWidth=1.2;g.beginPath();g.arc(x,y,3.5,0,7);g.stroke()}});
    items.push({t:"Twin's pick",draw:(x,y)=>{g.strokeStyle="#fff";g.lineWidth=2;g.beginPath();g.arc(x,y,4,0,7);g.stroke()}})}
  g.font=FONT(12);const lh=17;let wmax=0;for(const it of items)wmax=Math.max(wmax,g.measureText(it.t).width);
  const bw=wmax+30,bh=items.length*lh+8,bx=L+pw-bw-4,by=T+4;
  g.fillStyle="rgba(15,21,18,.92)";g.fillRect(bx,by,bw,bh);g.strokeStyle="#4b5d54";g.lineWidth=1;g.strokeRect(bx+.5,by+.5,bw-1,bh-1);
  items.forEach((it,i)=>{const y=by+4+lh*i+lh/2;it.draw(bx+12,y);g.fillStyle="#f1f4ea";g.textAlign="left";g.textBaseline="middle";g.fillText(it.t,bx+24,y)});
  g.lineWidth=1;g.globalAlpha=1;
}

/* ---------- action bar ---------- */
function renderAction(){
  const a=$("#action");
  if(G.phase==="think"){a.innerHTML=`<span class="spin"></span> ${PLANNER[G.cur.planner].name} is computing…`;return}
  if(G.phase==="grow"){a.innerHTML=`<span class="spin g"></span> Growing… day ${Math.min(GROW_DAYS,G.day-G.cur.plantDay+1)} of ${GROW_DAYS}`;return}
  if(G.phase==="setup"){a.innerHTML=`<span class="spin"></span> Setting up your lab… day ${G.day+1} of ${G.phaseDays}`;return}
  if(G.phase==="wait"){a.innerHTML=`<span class="spin"></span> ${G.cur.waitWhy||"Waiting"}… ${G.phaseStart+G.phaseDays-G.day} day(s) left`;return}
  if(!canRun()){a.innerHTML=`<button class="btn primary big" id="b-go">See season results</button>`;$("#b-go").onclick=finishSeason;return}
  const td=thinkDays(),wd=waitDays();
  a.innerHTML=`<button class="btn primary big" id="b-go">Plant & grow ▶</button><span class="small">${td?`${td} day${td>1?"s":""} computing + `:""}${GROW_DAYS} days${wd?` + ${wd} days lab`:""}</span>`;
  if($("#b-go"))$("#b-go").onclick=startBatch;
}

/* ---------- master render ---------- */
let uiQueued=false;
function ui(){if(uiQueued)return;uiQueued=true;requestAnimationFrame(()=>{uiQueued=false;
  const on=!!G&&G.phase!=="build";for(const s of ["#top","#left","#right","#action"])$(s).hidden=!on;$("#coach").hidden=true;if(!on)return;
  renderTop();renderLeft();renderRight();renderAction();if(typeof maybeTour==="function")maybeTour()})}
window.addEventListener("resize",()=>{if(G)ui()});
window.addEventListener("keydown",e=>{if(e.target.tagName==="INPUT"||!G||!overlayClosed())return;if(e.key==="Enter"&&G.phase==="plan")startBatch()});

/* ---------- screens ---------- */
function openTitle(){
  G=null;PCTX=null;syncEquipment();ui();
  openOverlay(`<div class="row" style="justify-content:space-between"><span class="label">A teaching game about self-driving labs</span>${sayBtn("b-sayT")}</div>
   <h2>Self-Driving Greenhouse</h2>
   <p>Build a greenhouse that runs experiments by itself, and use it to grow exceptional basil.</p>
   <div class="cols">
     <button class="choice" id="r1"><h3>Round 1: Grow tall plants</h3><span class="what">Health = height. Choose more beds or a smarter planner, then run your lab for 49 days.</span><span class="note">About 10 minutes</span></button>
     <button class="choice" id="r2"><h3>Round 2: What is a healthy plant?</h3><span class="what">You decide what "healthy" means. Pick sensors to measure it. Buy a ready-made system or build your own from parts.</span><span class="note">About 15 minutes · best after Round 1</span></button>
   </div>
   <div class="row"><button class="btn" id="b-board">Class leaderboard</button>${typeof LIVE!=="undefined"&&LIVE?`<span class="small">Class: ${esc(LIVE.name)}</span>`:""}</div>`);
  if($("#b-sayT"))$("#b-sayT").onclick=()=>speak("Self-driving greenhouse. Round 1: grow tall plants. Choose more beds or a smarter planner. Round 2: what is a healthy plant? You decide what healthy means, pick sensors, and buy a ready-made system or build your own from parts.");
  $("#r1").onclick=()=>openBuild(localGet("sdl-team")||"");
  $("#r2").onclick=()=>openDefine(localGet("sdl-team")||"");
  $("#b-board").onclick=()=>openBoard("title");
}
/* "More info" panels on the build screen */
const INFO={
  bo:()=>({t:"What is Bayesian optimisation?",x:[
    "It is a smart way to search when each test is slow or costly. Here, each test is a plant that takes a week to grow.",
    "After each batch, it makes a <b>best guess</b>: how tall will a plant grow with these conditions?",
    "It also knows <b>where its guess is unsure</b>, because it has not tried those conditions yet.",
    "Then it picks the next conditions. Some are where it expects tall plants. Some are where it is unsure, so it can learn more.",
    "Every new plant makes the guess better. So p goes up during the season.",
    "At the start it knows nothing. So its first picks are random.",
    `It thinks for ${PLANNER.bo.days} day${PLANNER.bo.days>1?"s":""} before each batch.`,
    "Self-driving labs use it to find new materials and medicines with fewer experiments."]}),
  twin:()=>({t:"What is a digital twin?",x:[
    "A digital twin is a <b>computer model</b> of something real. Here, it is a model of how basil grows.",
    "The planner tests thousands of ideas on the twin first. Then it uses your real beds only for the best ideas.",
    "So it can make good picks from the very first batch, before you have any results.",
    "A twin is never perfect. Bayesian optimisation compares it with your real plants and corrects it.",
    `<b>Rough twin</b> (${eur(PLANNER.rough.price)}): quick and cheap, but only roughly right. Thinks ${PLANNER.rough.days} days before each batch.`,
    `<b>Detailed twin</b> (${eur(PLANNER.twin.price)}): much closer to real plants, but costs more. Thinks ${PLANNER.twin.days} days before each batch.`,
    "Thinking days use up your season. Fewer batches means fewer plants in total."]}),
};
/* First "Build a self-driving greenhouse" (spend the grant), then "Use the self-driving greenhouse" (run the campaign). */
function openBuild(team){
  newGame(team);PCTX=null;syncEquipment();frameView();ui();
  const extras=PLANNERS.filter(p=>p.price>0);
  let info=null;   // which info panel is open: "bo", "twin" or null
  const infoBtn=(id,label)=>`<button class="btn small info" data-info="${id}" aria-expanded="${info===id}"><span class="i" aria-hidden="true">i</span>${label}</button>`;
  const render=()=>{
    const spent=(G.beds-BEDS_START)*BEDS_PRICE+extras.reduce((a,p)=>a+(G.own[p.id]?p.price:0),0);
    G.money=START_MONEY-spent;G.spent=spent;
    const keepScroll=overlay.hidden?0:overlay.scrollTop;
    const I=info&&INFO[info]();
    openOverlay(`<div class="row" style="justify-content:space-between"><div class="eyebrow"><span class="label" style="color:var(--leaf)">Phase: Build a self-driving greenhouse</span><span class="label">Next: Use the self-driving greenhouse</span></div>${sayBtn("b-say")}</div>
     <h2>You won ${eur(START_MONEY)} to build a self-driving greenhouse!</h2>
     <div class="goalbox"><ul class="goal">
       <li><b>Your goal:</b> grow healthy basil plants.</li>
       <li>We measure health as <b>height</b>.</li>
       <li>A plant of <b style="color:var(--gold)">${GOLD} cm or more</b> is <b style="color:var(--gold)">exceptional</b>.</li>
       <li>Then you use your greenhouse for <b>${SEASON_DAYS} days</b>. Grow as many exceptional plants as you can.</li></ul></div>
     <div class="howbox">
       <h3>First, build your greenhouse</h3>
       <p>Now you spend your money. You can buy <b>equipment</b> (more beds) and <b>algorithms</b> (smart planners). Two numbers decide how many exceptional plants you find:</p>
       <div class="np">
         <span class="k" style="color:var(--amber)">N</span><p><b>How many plants you grow at once.</b> Each bed holds 1 plant. More beds give a bigger N.</p>
         <span class="k" style="color:var(--magenta)">p</span><p><b>The chance that one plant is exceptional.</b> A planner is an algorithm that picks the water, light, fertiliser and temperature. With random picks, p is only about ${(P_RANDOM*100).toFixed(1)}&nbsp;%. A smart planner learns from your plants and makes p bigger.</p>
       </div>
       <p>A big N and a big p both help. Your money cannot buy everything, so choose your mix.</p>
       <p><b>Spend the money now.</b> You cannot buy more later.</p>
     </div>
     <div class="buildgrid">
       <section class="bcol"><h3 style="color:var(--amber)">More plants (N)</h3>
         <p class="small">1 bed grows 1 plant every ${GROW_DAYS} days. Your first bed is free.</p>
         <div class="stepper"><button class="btn" id="b-minus" ${G.beds<=BEDS_START?"disabled":""} aria-label="One bed fewer">−</button><span class="num bigbeds">${G.beds}</span><span>bed${G.beds>1?"s":""}</span><button class="btn" id="b-plus" ${G.beds>=BEDS_MAX||G.money<BEDS_PRICE?"disabled":""} aria-label="One bed more">+</button></div>
         <p class="small">Each extra bed: ${eur(BEDS_PRICE)}</p></section>
       <section class="bcol"><h3 style="color:var(--magenta)">Smarter planning (p)</h3>
         <p class="small">A planner picks the growing conditions. "You decide" and "Random" are free. Smart planners cost money, and some need extra days to think.</p>
         <div class="inforow">${infoBtn("bo","What is Bayesian optimisation?")}${infoBtn("twin","What is a digital twin?")}</div>
         ${I?`<div class="infobox" role="region" aria-label="${I.t}"><div class="row" style="justify-content:space-between"><h3>${I.t}</h3><span class="row">${sayBtn("b-say-info")}<button class="btn small" id="b-info-close">Close</button></span></div><ul>${I.x.map(s=>`<li>${s}</li>`).join("")}</ul></div>`:""}
         <div class="buylist">${extras.map(p=>{const on=!!G.own[p.id];const can=on||G.money>=p.price;return `<button class="choice ${on?"on":""}" data-buy="${p.id}" ${can?"":"disabled"}><h3>${p.name}<span class="price">${eur(p.price)}</span></h3><span class="what">${p.what}</span><span class="note">${p.days?`Thinks ${p.days} day${p.days>1?"s":""} before each batch`:"No waiting"}</span></button>`}).join("")}</div></section>
     </div>
     <div class="total">Money left: ${eur(G.money)} of ${eur(START_MONEY)}</div>
     <div class="row"><label class="label" for="team">Team name</label><input id="team" type="text" maxlength="24" placeholder="e.g. Basil Instinct" value="${esc(G.team)}"></div>
     <div class="row"><button class="btn primary big" id="b-build">Build it and start using it ▶</button><button class="btn" id="b-board">Class leaderboard</button></div>`);
    overlay.scrollTop=keepScroll;
    if($("#b-say"))$("#b-say").onclick=()=>speak(`You won ${START_MONEY} dollars to build a self-driving greenhouse. Your goal: grow healthy basil plants. We measure health as height. A plant of ${GOLD} centimetres or more is exceptional. Then you use your greenhouse for ${SEASON_DAYS} days. Grow as many exceptional plants as you can. First, build your greenhouse. You can buy equipment and algorithms. Two numbers decide how many exceptional plants you find. N is how many plants you grow at once. More beds, for ${BEDS_PRICE} dollars each, give a bigger N. p is the chance that one plant is exceptional. A smart planner picks better growing conditions and makes p bigger. Smart planners cost money, and some need extra days to think. Spend the money now. You cannot buy more later. You have ${G.money} dollars left.`);
    if($("#b-say-info"))$("#b-say-info").onclick=()=>speak(I.t+" "+I.x.join(" "));
    document.querySelectorAll("[data-info]").forEach(b=>b.onclick=()=>{keepTeam();info=info===b.dataset.info?null:b.dataset.info;render()});
    if($("#b-info-close"))$("#b-info-close").onclick=()=>{keepTeam();info=null;render()};
    const keepTeam=()=>{G.team=$("#team").value};
    $("#b-minus").onclick=()=>{keepTeam();G.beds=Math.max(BEDS_START,G.beds-1);syncEquipment();frameView();render()};
    $("#b-plus").onclick=()=>{keepTeam();if(G.money>=BEDS_PRICE&&G.beds<BEDS_MAX){G.beds++;syncEquipment();frameView()}render()};
    document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>{keepTeam();const id=b.dataset.buy;if(G.own[id])delete G.own[id];else if(G.money>=PLANNER[id].price)G.own[id]=1;syncEquipment();render()});
    $("#b-board").onclick=()=>openBoard("title");
    $("#b-build").onclick=()=>{const t=($("#team").value||"").trim()||"Team "+(100+Math.floor(rng()*900));localSet("sdl-team",t);G.team=t;startCampaign()};
  };
  render();
}
function startCampaign(){
  G.phase="plan";
  const smart=["twin","rough","bo","evo"].find(id=>G.own[id]);
  closeOverlay();syncEquipment();frameView();
  if(smart)setPlanner(smart);else{G.planner="you";G.planFrom="you"}
  toast(`Your greenhouse is built. Now use it: ${SEASON_DAYS} days start now.`);
  ui();
}

/* ---------- end of season ---------- */
function curve(g,X,Y,lam,col,w,dash){g.strokeStyle=col;g.lineWidth=w;g.setLineDash(dash||[]);g.beginPath();for(let i=0;i<=120;i++){const t=i/120*SEASON_DAYS;const v=1-Math.exp(-lam*t);i?g.lineTo(X(t),Y(v)):g.moveTo(X(t),Y(v))}g.stroke();g.setLineDash([])}
function seasonNumbers(){
  const plants=G.data.length;const gold=G.data.filter(d=>d.y>=GOLD).length;
  const N=plants/Math.max(1,G.day)*7;                       // plants per week actually achieved
  const p=plants?gold/plants:0;
  return {plants,gold,N,p};
}
function drawSeasonCurves(cv){
  const c=prepCanvas(cv);if(!c)return;const {g,W,H}=c;const s=seasonNumbers();
  const L=40,R=10,T=10,B=26;const pw=W-L-R,ph=H-T-B;const X=t=>L+t/SEASON_DAYS*pw,Y=v=>T+(1-v)*ph;
  g.fillStyle="#0f1512";g.fillRect(0,0,W,H);g.font="14px Lexend, Verdana, sans-serif";g.fillStyle="#a3b39d";g.strokeStyle="#2a3530";
  g.textAlign="right";g.textBaseline="middle";for(const v of [0,.2,.4,.6,.8,1]){g.beginPath();g.moveTo(L,Y(v));g.lineTo(L+pw,Y(v));g.stroke();g.fillText(Math.round(v*100)+"%",L-5,Y(v))}
  g.textAlign="center";g.textBaseline="top";for(const t of [0,7,14,21,28,35,42])g.fillText(t,X(t),T+ph+6);g.textAlign="right";g.fillText("49 days",L+pw,T+ph+6);
  const lam=(N,p)=>-(N/7)*Math.log(1-Math.min(p,.999));
  const pYou=Math.max(s.p,.002),pR=P_RANDOM;
  const n0=BEDS_START*7/(GROW_DAYS),nY=Math.max(n0,s.N);
  curve(g,X,Y,lam(n0,pR),"#3a9a3a",2.5);
  curve(g,X,Y,lam(nY,pR),"#6ab0de",2.5);
  curve(g,X,Y,lam(n0,pYou),"#2a3fa8",2.5);
  curve(g,X,Y,lam(nY,pYou),"#ef4a52",3);
  if(G.firstGold!=null){g.fillStyle="#ffd84a";g.font="bold 18px sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText("★",X(G.firstGold),Y(1-Math.exp(-lam(nY,pYou)*G.firstGold)))}
}
function drawLandscape(cv){
  const c=prepCanvas(cv);if(!c)return;const {g,W,H}=c;
  const L=44,R=10,T=10,B=30;const pw=W-L-R,ph=H-T-B;const n=60;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const w=(i+.5)/n,l=(j+.5)/n;
    // best possible height for this water and light (fertiliser and temperature at their best)
    const h=Math.max(heightOf([w,l,OPT.f,OPT.t]),heightOf([w,l,DECOY[2],DECOY[3]]));
    const u=clamp((h-4)/(HMAX-4),0,1);g.fillStyle=h>=GOLD?"#6b5a12":lerpHex("#141c18","#3f6b2a",u);g.fillRect(L+i/n*pw,T+(1-(j+1)/n)*ph,pw/n+.6,ph/n+.6)}
  for(const d of G.data){g.fillStyle=d.y>=GOLD?"#ffd84a":"#eef3e6";g.globalAlpha=d.y>=GOLD?1:.65;g.beginPath();g.arc(L+d.c[0]*pw,T+(1-d.c[1])*ph,3,0,7);g.fill()}
  g.globalAlpha=1;g.fillStyle="#a3b39d";g.font="14px Lexend, Verdana, sans-serif";g.textAlign="center";g.textBaseline="top";g.fillText("Water →",L+pw/2,T+ph+8);
  g.textAlign="left";g.fillText("0",L,T+ph+8);g.textAlign="right";g.fillText("500 mL/day",L+pw,T+ph+8);
  g.save();g.translate(14,T+ph/2);g.rotate(-Math.PI/2);g.textAlign="center";g.textBaseline="middle";g.fillText("Light →",0,0);g.restore();
}
function finishSeason(){
  if(!G||G.phase!=="plan")return;
  if(G.round===2)return r2Finish();
  G.phase="done";ui();
  const s=seasonNumbers();const b=best();
  const code=encodeResult();G.code=code;
  openOverlay(`<div class="row" style="justify-content:space-between"><span class="label">Day ${G.day}: season over</span><div class="row">${sayBtn("b-say3")}<button class="btn" id="b-r2top">Round 2 ▶</button></div></div><h2>${esc(G.team)}: ${s.gold} exceptional plant${s.gold===1?"":"s"}</h2>
   <div class="stats">
     <div class="stat"><div class="v" style="color:var(--gold)">${G.firstGold==null?"–":"day "+G.firstGold}</div><div class="k">First exceptional plant</div></div>
     <div class="stat"><div class="v" style="color:var(--amber)">${s.plants}</div><div class="k">Plants grown (N·t)</div></div>
     <div class="stat"><div class="v" style="color:var(--magenta)">${(s.p*100).toFixed(1)} %</div><div class="k">Exceptional (p). Random: ${(P_RANDOM*100).toFixed(1)} %</div></div>
   </div>
   <h3>Your lab on the curve from the paper</h3>
   <p>Chance of having found an exceptional plant by day t, <span class="num" style="color:var(--gold)">P = 1 − (1 − p)<sup>N·t</sup></span>, with your N and p.</p>
   <canvas class="wide" id="curves"></canvas>
   <div class="legend"><span style="--c:#3a9a3a">1 bed, random</span><span style="--c:#6ab0de">Your beds, random</span><span style="--c:#2a3fa8">1 bed, your planning</span><span style="--c:#ef4a52">Your lab</span></div>
   <h3>Where the tall plants were</h3>
   <p class="small">Tallest plant possible for each water and light. Gold: exceptional is possible here. Dots: your plants.</p>
   <canvas class="wide" id="land" style="height:280px"></canvas>
   <h3>Class leaderboard</h3>
   <div class="row"><span class="code" id="code">${code}</span><button class="btn small" id="b-copy">Copy</button></div>
   <p class="small" id="post-status">Posting your result…</p>
   <h3>Next: Round 2</h3>
   <p>Is height really the best measure of a healthy plant? In Round 2 you decide what healthy means, pick sensors, and choose a ready-made or a modular lab.</p>
   <div class="row"><button class="btn primary big" id="b-r2">Go to Round 2 ▶</button><button class="btn" id="b-again">Play Round 1 again</button><button class="btn" id="b-board">Open leaderboard</button><button class="btn" id="b-home">Start screen</button></div>`);
  drawSeasonCurves($("#curves"));drawLandscape($("#land"));
  if($("#b-say3"))$("#b-say3").onclick=()=>speak(`Season over. You grew ${s.plants} plants. ${s.gold} were exceptional. ${G.firstGold==null?"None reached 40 centimetres.":`The first one came on day ${G.firstGold}.`} The curve shows your chance of finding an exceptional plant over time. More beds raise N. A smarter planner raises p. The map shows where tall plants were possible, and where your plants were.`);
  $("#b-again").onclick=()=>openBuild(G.team);
  $("#b-r2").onclick=$("#b-r2top").onclick=()=>openDefine(G.team);
  $("#b-home").onclick=openTitle;
  $("#b-board").onclick=()=>openBoard("end");
  $("#b-copy").onclick=()=>{try{navigator.clipboard.writeText(code).then(()=>toast("Code copied."),()=>{})}catch(e){}};
  submitResult(code);
}
