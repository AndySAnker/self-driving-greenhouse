/* ================================================================
   Guided tour: step-by-step pop-ups the first time a team starts the run.
   Each step highlights one part of the screen and explains it.
   ================================================================ */
let TOUR=null;   // {steps, i, round}
const tourKey=r=>"sdl-tour-r"+r;
const tourSeen=r=>localGet(tourKey(r))==="1";
function $$all(sel){return [...document.querySelectorAll(sel)].filter(e=>e.offsetParent!==null||e.getClientRects().length)}
function unionRect(els){
  let x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
  for(const e of els){const r=e.getBoundingClientRect();if(!r.width&&!r.height)continue;x1=Math.min(x1,r.left);y1=Math.min(y1,r.top);x2=Math.max(x2,r.right);y2=Math.max(y2,r.bottom)}
  return x2>x1?{x:x1,y:y1,w:x2-x1,h:y2-y1}:null;
}
function stageRect(){   // the open part of the greenhouse view, between the side panels
  const st=$("#stage");if(!st)return null;const r=st.getBoundingClientRect();
  let x1=r.left,x2=r.right,y1=r.top,y2=r.bottom;
  if(getComputedStyle($("#left")).position==="absolute"){
    const L=$("#left").getBoundingClientRect(),R=$("#right").getBoundingClientRect(),T=$("#top").getBoundingClientRect(),A=$("#action").getBoundingClientRect();
    x1=Math.max(x1,L.right+12);x2=Math.min(x2,R.left-12);y1=Math.max(y1,T.bottom+12);y2=Math.min(y2,A.top-12);
  }
  return x2-x1>80&&y2-y1>80?{x:x1,y:y1,w:x2-x1,h:y2-y1}:{x:r.left,y:r.top,w:r.width,h:r.height};
}
function tourSteps(){
  if(G.round===2)return tourStepsR2();
  return [
    {t:"Use your self-driving greenhouse",
     x:`Your lab is built. You have ${SEASON_DAYS} days to find exceptional plants.<br>This short tour shows what to click, one step at a time.`},
    {sel:"#top .cell:first-child",t:"Time",
     x:`The season has ${SEASON_DAYS} days. Each batch of plants grows for ${GROW_DAYS} days. Smart planners also need days to think.`},
    {sel:"#left .kh, #left .prows",t:"Your beds",
     x:`Each row is one bed: one plant in the next batch. You have <b>${G.beds}</b> (this is N).<br>The bars show water, light, fertiliser and temperature.`},
    {sel:"#left .editor, #left .rowbtns",t:"Set the conditions",
     x:`Click a row, or a bed in the greenhouse. Then move the sliders.${G.beds>1?" The buttons below copy or mix conditions for all beds.":""}`},
    {sel:"#left .planners",t:"Who sets them? (p)",
     x:"Or let someone else choose: Random, or a planner you bought. Planners learn from every plant you grow. Some think for a few days first."},
    {rect:stageRect,t:"Your greenhouse",
     x:"Watch your plants grow here. Click a bed to select it. Drag to turn the view. Scroll or pinch to zoom."},
    {sel:"#right .card:first-child",t:"Results",
     x:`Every plant becomes a dot: its height, batch by batch. Gold dots are exceptional: <b>${GOLD} cm</b> or taller.`},
    {sel:"#top .cell:nth-last-child(2)",t:"Exceptional plants",
     x:"Your score. The class leaderboard ranks teams by this number. Ties are broken by the day of the first one."},
    {sel:"#action",t:"Start a batch",
     x:`When you are ready, press <b>Plant &amp; grow</b>. After ${GROW_DAYS} days, look at the results and choose again.`},
    {sel:"#ctrls",t:"Help and speed",
     x:"<b>Speed</b> makes days pass faster. <b>Read aloud</b> reads the screen. <b>How to play</b> shows this tour again. <b>Finish</b> ends the season early.",last:true},
  ];
}
/* Round 2: players know the greenhouse from Round 1, so only show what is new */
function tourStepsR2(){
  const lab=!!(G.sensors&&G.sensors.lab&&G.weights&&G.weights.vitc);
  const mod=G.system!=="turnkey";
  const s=[
    {t:"Round 2: what is new",
     x:"The greenhouse works like in Round 1: beds, sliders, planners and <b>Plant &amp; grow</b>.<br>This short tour only shows what is new."},
    {sel:"#top .cell:nth-child(3)",t:"Your health score",
     x:"Plants are no longer judged by height alone. This is <b>your</b> definition of a healthy plant. The planners try to make this score high."},
    {sel:"#right .card:first-child",t:"Score, not height",
     x:`The dots now show each plant’s health score. Gold dots are exceptional: a score of <b>${G.thrR}</b> or more.`},
    {sel:"#right .card:nth-child(2)",t:"What your sensors saw",
     x:"After a batch, click a bed to see what your sensors measured. Sensors can be noisy. <b>Not measured</b> means your planner cannot see that property at all."},
    {sel:"#top .cell:nth-child(2)",t:mod?"Your modular lab":"Your GrowBox",
     x:mod?"Parts you built yourself can break: a pump can clog, the computer can crash, or the camera can fail. A broken part can cost you plants or days."
          :"Your GrowBox never breaks. But it is closed: you cannot add other sensors or planners."},
  ];
  s.push({sel:"#action",t:"Waiting for results",
     x:lab?`Your lab test for vitamin C costs ${eur(SENS2M.lab.perPlant)} per plant and adds <b>${SENS2M.lab.wait} days</b> to every batch. You see it next to <b>Plant &amp; grow</b>.`
          :"Next to <b>Plant &amp; grow</b> you see how many days the next batch takes, including thinking time."});
  s.push({sel:"#top .cell:first-child",t:"Halfway review on day 21",
     x:"Your funder checks in around day 21. If you have an exceptional plant by then, you get <b>$2,000</b> more to spend on upgrades.",last:true});
  return s;
}
function startTour(){
  if(!G||TOUR)return;
  TOUR={steps:tourSteps(),i:0,round:G.round||1};
  let root=$("#tour");
  if(!root){root=document.createElement("div");root.id="tour";root.innerHTML=`<div id="tour-hole"></div><div id="tour-card" class="panel" role="dialog" aria-modal="true" aria-labelledby="tour-title"></div>`;document.body.appendChild(root)}
  root.hidden=false;showTourStep();
}
function endTour(){
  if(!TOUR)return;localSet(tourKey(TOUR.round),"1");TOUR=null;
  const root=$("#tour");if(root)root.hidden=true;try{speechSynthesis.cancel()}catch(e){}
  const go=$("#b-go");if(go)go.focus();
}
function tourTarget(st){
  if(st.rect)return st.rect();
  if(!st.sel)return null;
  const els=$$all(st.sel);if(!els.length)return null;
  return unionRect(els);
}
function showTourStep(){
  if(!TOUR)return;const st=TOUR.steps[TOUR.i];const n=TOUR.steps.length;
  // scroll the target into view first (phones: panels are stacked)
  if(st.rect&&getComputedStyle($("#left")).position!=="absolute"){const el=$("#stage");if(el)el.scrollIntoView({block:"start"})}
  if(st.sel){const el=$$all(st.sel)[0];if(el&&el.scrollIntoView){const r=el.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)el.scrollIntoView({block:"center"})}}
  const card=$("#tour-card");
  card.innerHTML=`<div class="tour-head"><span class="label">How to play · ${TOUR.i+1} of ${n}</span>${canSpeak?`<button class="btn small" id="t-say">Read aloud</button>`:""}</div>
    <h3 id="tour-title">${st.t}</h3><p>${st.x}</p>
    <div class="tour-dots" aria-hidden="true">${TOUR.steps.map((_,j)=>`<i class="${j===TOUR.i?"on":""}"></i>`).join("")}</div>
    <div class="row tour-btns">${TOUR.i>0?`<button class="btn" id="t-back">Back</button>`:""}<button class="btn primary" id="t-next">${st.last?"Start playing ▶":TOUR.i===0?"Start the tour ▶":"Next ▶"}</button>${st.last?"":`<button class="btn small" id="t-skip">Skip tour</button>`}</div>`;
  $("#t-next").onclick=()=>{if(TOUR.i>=TOUR.steps.length-1)endTour();else{TOUR.i++;showTourStep()}};
  if($("#t-back"))$("#t-back").onclick=()=>{TOUR.i=Math.max(0,TOUR.i-1);showTourStep()};
  if($("#t-skip"))$("#t-skip").onclick=endTour;
  if($("#t-say"))$("#t-say").onclick=()=>speak(st.t+". "+st.x);
  placeTour();
  $("#t-next").focus();
}
function placeTour(){
  if(!TOUR)return;const st=TOUR.steps[TOUR.i];const hole=$("#tour-hole"),card=$("#tour-card");
  const r=tourTarget(st);const W=innerWidth,H=innerHeight,pad=8,gap=14;
  if(!r){hole.style.cssText="left:50%;top:50%;width:0;height:0";card.style.left=Math.max(8,(W-card.offsetWidth)/2)+"px";card.style.top=Math.max(8,(H-card.offsetHeight)/2)+"px";return}
  const x=Math.max(2,r.x-pad),y=Math.max(2,r.y-pad),w=Math.min(W-4,r.w+2*pad),h=Math.min(H-4,r.h+2*pad);
  hole.style.cssText=`left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
  const cw=card.offsetWidth,ch=card.offsetHeight;let cx,cy;
  if(x+w+gap+cw<=W-8){cx=x+w+gap;cy=y}                 // right of the target
  else if(x-gap-cw>=8){cx=x-gap-cw;cy=y}               // left
  else if(y+h+gap+ch<=H-8){cx=x;cy=y+h+gap}            // below
  else if(y-gap-ch>=8){cx=x;cy=y-gap-ch}               // above
  else{cx=(W-cw)/2;cy=H-ch-8}                           // big target: bottom centre, over it
  cx=clamp(cx,8,Math.max(8,W-cw-8));cy=clamp(cy,8,Math.max(8,H-ch-8));
  card.style.left=cx+"px";card.style.top=cy+"px";
}
window.addEventListener("resize",()=>{if(TOUR)placeTour()});
window.addEventListener("scroll",()=>{if(TOUR)placeTour()},true);
setInterval(()=>{if(TOUR)placeTour()},400);   // panels re-render now and then
window.addEventListener("keydown",e=>{
  if(!TOUR)return;e.stopImmediatePropagation();
  if(e.key==="Escape"){e.preventDefault();endTour()}
  else if(e.key==="ArrowRight"||(e.key==="Enter"&&e.target.tagName!=="BUTTON")){e.preventDefault();$("#t-next").click()}
  else if(e.key==="ArrowLeft"){e.preventDefault();if($("#t-back"))$("#t-back").click()}
},true);
/* called from ui(): the first time a team reaches the planning step, offer the tour */
function maybeTour(){
  if(!G||TOUR||G.tourOffered||G.phase!=="plan"||!overlayClosed())return;
  G.tourOffered=true;if(tourSeen(G.round||1))return;
  setTimeout(()=>{if(G&&G.phase==="plan"&&overlayClosed())startTour()},350);
}
