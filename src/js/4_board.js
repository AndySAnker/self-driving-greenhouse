/* ================================================================
   Class leaderboard
   db (direct post) · room (live to the teacher's screen) · result code (always works)
   ================================================================ */
const B32="0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function encodeResult(){
  const s=seasonNumbers();const b=best();
  const mask=(G.own.evo?1:0)|(G.own.bo?2:0)|(G.own.twin?4:0)|(G.own.rough?8:0);
  const fields=[[Math.min(255,s.gold),8],[G.firstGold==null?63:Math.min(62,G.firstGold),6],[Math.min(255,s.plants),8],[Math.min(63,Math.round(G.spent/1000)),6],[G.beds,5],[mask,4],[b?Math.min(127,Math.round(b.y)):0,7]];
  let big=0n;for(const [v,n] of fields)big=(big<<BigInt(n))|BigInt(v);
  let s2="";for(let i=0;i<9;i++){s2=B32[Number(big&31n)]+s2;big>>=5n}
  let cs=0;for(const ch of s2)cs=(cs*7+B32.indexOf(ch))%32;s2+=B32[cs];
  return s2.slice(0,5)+"-"+s2.slice(5);
}
function decodeResult(code){
  const s=String(code).toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");
  if(s.length!==10)return null;
  let cs=0;for(const ch of s.slice(0,9)){const v=B32.indexOf(ch);if(v<0)return null;cs=(cs*7+v)%32}
  if(B32[cs]!==s[9])return null;
  let big=0n;for(const ch of s.slice(0,9))big=(big<<5n)|BigInt(B32.indexOf(ch));
  const sizes=[8,6,8,6,5,4,7];const v=[];
  for(let i=sizes.length-1;i>=0;i--){v[i]=Number(big&((1n<<BigInt(sizes[i]))-1n));big>>=BigInt(sizes[i])}
  return {gold:v[0],first:v[1]===63?null:v[1],plants:v[2],spent:v[3]*1000,beds:v[4],planners:["evo","bo","twin","rough"].filter((_,i)=>v[5]&(1<<i)),best:v[6]};
}
/* Round 2 codes are 13 characters: they carry the health-score definition, the system and the sensors */
const R2_SENS=["ruler","scale","camera","lab","hyper"],R2_PL=["evo","bo","rough","twin"];
function encodeResult2(){
  const golds=G.data.filter(d=>d.y!=null&&d.y>=G.thr);const real=golds.filter(d=>d.ts>=G.thr).length;
  const b=best();const stars=b?expertStars(b.real):0;
  const wbits=PK2.reduce((a,k,i)=>a|((G.weights[k]||0)<<(2*i)),0);
  const smask=R2_SENS.reduce((a,id,i)=>a|(G.sensors[id]?1<<i:0),0);
  const pmask=R2_PL.reduce((a,id,i)=>a|(G.own[id]?1<<i:0),0);
  const fields=[[Math.min(255,golds.length),8],[Math.min(255,real),8],[Math.min(255,G.data.length),8],[Math.min(63,Math.round((G.spent+G.labCost)/1000)),6],[Math.min(31,G.beds),5],[G.system==="turnkey"?1:0,1],[wbits,8],[smask,5],[pmask,4],[stars,3]];
  let big=0n;for(const [v,n] of fields)big=(big<<BigInt(n))|BigInt(v);
  let s2="";for(let i=0;i<12;i++){s2=B32[Number(big&31n)]+s2;big>>=5n}
  let cs=0;for(const ch of s2)cs=(cs*7+B32.indexOf(ch))%32;s2+=B32[cs];
  return s2.slice(0,4)+"-"+s2.slice(4,8)+"-"+s2.slice(8);
}
function decodeResult2(code){
  const s=String(code).toUpperCase().replace(/[^0-9A-Z]/g,"").replace(/O/g,"0").replace(/[IL]/g,"1");
  if(s.length!==13)return null;
  let cs=0;for(const ch of s.slice(0,12)){const v=B32.indexOf(ch);if(v<0)return null;cs=(cs*7+v)%32}
  if(B32[cs]!==s[12])return null;
  let big=0n;for(const ch of s.slice(0,12))big=(big<<5n)|BigInt(B32.indexOf(ch));
  const sizes=[8,8,8,6,5,1,8,5,4,3];const v=[];
  for(let i=sizes.length-1;i>=0;i--){v[i]=Number(big&((1n<<BigInt(sizes[i]))-1n));big>>=BigInt(sizes[i])}
  const weights={};PK2.forEach((k,i)=>weights[k]=(v[6]>>(2*i))&3);
  return {round:2,gold:v[0],real:v[1],plants:v[2],spent:v[3]*1000,beds:v[4],system:v[5]?"turnkey":"modular",weights,
    sensors:R2_SENS.filter((_,i)=>v[7]&(1<<i)),planners:R2_PL.filter((_,i)=>v[8]&(1<<i)),stars:v[9]};
}
const decodeAny=code=>decodeResult(code)||decodeResult2(code);
let boardRound=1;
let DB=null,ROOM=null,USER=null,canWrite=null,dbRuns=[],boardFrom=null;
(async()=>{
  try{
    if(!window.claude||!window.claude.use)return;
    const [db,room,user]=await Promise.all([claude.use("db").catch(()=>null),claude.use("room").catch(()=>null),claude.use("user").catch(()=>null)]);
    DB=db;ROOM=room;USER=user;
    if(USER){try{canWrite=await USER.can("data.write")}catch(e){canWrite=null}}
    if(ROOM){try{ROOM.onPeers(()=>{if(boardFrom)renderBoard();mirrorPeers()},()=>{})}catch(e){ROOM=null}}
    if(DB){try{DB.collection("runs3").onSnapshot(s=>{dbRuns=s.docs.map(d=>Object.assign({_id:d.id},d.data()));if(boardFrom)renderBoard()},()=>{DB=null})}catch(e){DB=null}}
  }catch(e){}
})();
/* ---------- live class board for self-hosting (e.g. GitHub Pages) ----------
   Results are sent as short text messages to a free public relay (ntfy.sh) under a class name.
   Set window.SDL_CLASS in index.html, or add ?class=yourname to the link. Not used on claude.ai. */
const LIVE=(()=>{
  if(window.claude&&window.claude.use)return null;
  let c="";try{c=new URLSearchParams(location.search).get("class")||""}catch(e){}
  c=(c||window.SDL_CLASS||"").toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,40);
  if(!c||!/^https?:$/.test(location.protocol))return null;
  return {name:c,topic:"sdl-greenhouse-"+c,url:"https://ntfy.sh/sdl-greenhouse-"+c};
})();
let liveRuns=new Map(),liveState=LIVE?"off":"none",liveES=null;
function liveConnect(){
  if(!LIVE||liveES)return;liveState="connecting";
  try{
    liveES=new EventSource(LIVE.url+"/sse?since=all");
    liveES.onopen=()=>{const was=liveState;liveState="live";if(was==="live")return;if(boardFrom)renderBoard()};
    liveES.onmessage=ev=>{try{const m=JSON.parse(ev.data);if(m.event&&m.event!=="message")return;
      const r=JSON.parse(m.message);const id=String(r.id||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,60);if(!id)return;
      const e=entryFromCode(String(r.code||""),String(r.team||"Team"),id);if(!e)return;e.at=(m.time||0)*1000;
      liveState="live";liveRuns.set(id,e);if(boardFrom)renderBoard()}catch(err){}};
    liveES.onerror=()=>{if(liveES&&liveES.readyState===2){liveState="error";liveES=null;if(boardFrom)renderBoard()}};   // the browser retries by itself
    setTimeout(()=>{if(liveState==="connecting"){liveState="error";if(boardFrom)renderBoard()}},8000);
  }catch(e){liveState="error";liveES=null}
}
async function livePost(code,team,id){
  if(!LIVE)return false;
  try{const r=await fetch(LIVE.url,{method:"POST",body:JSON.stringify({id,team:String(team||"Team").slice(0,24),code})});return r.ok}catch(e){return false}
}
function clearedAt(){try{return +localStorage.getItem("sdl-cleared-at")||0}catch(e){return 0}}
function localRuns(){try{return JSON.parse(localStorage.getItem("sdl-runs3")||"[]")}catch(e){return[]}}
function saveLocal(e){try{const a=localRuns().filter(x=>x._id!==e._id);a.push(e);localStorage.setItem("sdl-runs3",JSON.stringify(a.slice(-300)))}catch(err){}}
function entryFromCode(code,team,id){const d=decodeAny(code);if(!d)return null;return Object.assign(d,{_id:id,team:String(team||"Team").slice(0,24),code,at:Date.now()})}
async function submitResult2(code){return submitResult(code)}
async function submitResult(code){
  const id=G.runId.replace(/[^A-Za-z0-9_-]/g,"");const e=entryFromCode(code,G.team,id);saveLocal(e);
  if(ROOM){try{await ROOM.presence({team:G.team,result:{code,id}})}catch(err){}}
  let posted=false;if(DB&&canWrite!==false){try{await DB.collection("runs3").doc(id).set(e);posted=true}catch(err){}}
  if(LIVE)posted=await livePost(code,G.team,id);
  const st=$("#post-status");if(st)st.textContent=posted?"Posted to the class leaderboard.":"Give this code to your teacher. It holds your results.";
}
async function mirrorPeers(){
  if(!DB||!ROOM||!boardFrom)return;let edit=false;try{edit=USER?await USER.canEdit():false}catch(e){}if(!edit)return;
  for(const p of ROOM.peers()){const r=p.presence&&p.presence.result;if(!r||!r.id||dbRuns.some(x=>x._id===r.id))continue;
    const e=entryFromCode(r.code,p.presence.team,String(r.id).replace(/[^A-Za-z0-9_-]/g,"").slice(0,60));if(!e)continue;try{await DB.collection("runs3").doc(e._id).set(e)}catch(err){}}
}
function allEntries(){
  const map=new Map();for(const e of localRuns())map.set(e._id,e);for(const e of dbRuns)map.set(e._id,e);for(const [k,e] of liveRuns)map.set(k,e);
  if(ROOM){try{for(const p of ROOM.peers()){const r=p.presence&&p.presence.result;if(r&&r.id&&!map.has(r.id)){const e=entryFromCode(r.code,p.presence.team,r.id);if(e)map.set(r.id,e)}}}catch(e){}}
  const cut=clearedAt();const all=[...map.values()].filter(e=>!cut||(e.at||0)>cut);
  if(boardRound===2)return all.filter(e=>e.round===2).sort((a,b)=>b.real-a.real||b.stars-a.stars||b.gold-a.gold);
  return all.filter(e=>(e.round||1)===1&&e.spent<=START_MONEY).sort((a,b)=>b.gold-a.gold||((a.first??99)-(b.first??99)));
}
function openBoard(from){boardFrom=from;liveConnect();if(G&&G.round===2)boardRound=2;else if(G)boardRound=1;renderBoard()}
const wShort=W=>{const tot=PK2.reduce((a,k)=>a+(W[k]||0),0);return PROPS2.filter(p=>W[p.k]).map(p=>`${p.name} ${Math.round(W[p.k]/tot*100)}%`).join(", ")};
function renderBoard(){
  const rows=allEntries();
  openOverlay(`<div class="row" style="justify-content:space-between"><h2>Class leaderboard</h2><button class="btn" id="b-bclose">Back</button></div>
   <p class="small">${DB?"Results are saved on this page for everyone who can open it.":LIVE?`Live class board “${esc(LIVE.name)}”: ${liveState==="live"?"connected. Results from everyone playing with this link appear here.":liveState==="error"?"not reachable right now. Type in the result codes below instead.":"connecting…"}`:"Results are saved in this browser. Use one computer as the class screen."} Ranked by exceptional plants, then by the day of the first one.</p>
   <div class="row"><button class="btn small ${boardRound===1?"primary":""}" data-br="1">Round 1</button><button class="btn small ${boardRound===2?"primary":""}" data-br="2">Round 2</button></div>
   ${boardRound===1?`<div class="tw"><table class="t"><thead><tr><th>#</th><th>Team</th><th style="text-align:right">Exceptional</th><th style="text-align:right">First on day</th><th style="text-align:right">Beds (N)</th><th>Planners bought</th><th style="text-align:right">Plants</th><th style="text-align:right">Spent</th><th style="text-align:right">Tallest</th></tr></thead>
   <tbody>${rows.length?rows.map((e,i)=>`<tr><td class="n">${i+1}</td><td>${esc(e.team)}</td><td class="n" style="color:var(--gold)">${e.gold}</td><td class="n">${e.first==null?"–":e.first}</td><td class="n">${e.beds}</td><td>${e.planners.length?e.planners.map(id=>`<span class="chip" style="--c:${PLANNER[id].col}">${PLANNER[id].name}</span>`).join(" "):`<span class="small">none</span>`}</td><td class="n">${e.plants}</td><td class="n">${eur(e.spent)}</td><td class="n">${e.best} cm</td></tr>`).join(""):`<tr><td colspan="9" class="small">No results yet. Teams appear when they finish a season.</td></tr>`}</tbody></table></div>`:
   `<p class="small">Ranked by plants that were really exceptional, then by the plant expert's stars.</p>
   <div class="tw"><table class="t"><thead><tr><th>#</th><th>Team</th><th>Their health score</th><th style="text-align:right">Exceptional</th><th style="text-align:right">Really</th><th>Expert</th><th>System</th><th>Sensors</th><th style="text-align:right">Spent</th></tr></thead>
   <tbody>${rows.length?rows.map((e,i)=>`<tr><td class="n">${i+1}</td><td>${esc(e.team)}</td><td class="small" style="color:var(--ink)">${wShort(e.weights)}</td><td class="n" style="color:var(--gold)">${e.gold}</td><td class="n" style="color:var(--leaf)">${e.real}</td><td style="color:var(--gold)">${"★".repeat(e.stars)}</td><td>${e.system==="turnkey"?"GrowBox":"Modular"} · ${e.beds} beds</td><td class="small" style="color:var(--ink)">${e.sensors.map(id=>SENS2M[id].name).join(", ")}</td><td class="n">${eur(e.spent)}</td></tr>`).join(""):`<tr><td colspan="9" class="small">No Round 2 results yet.</td></tr>`}</tbody></table></div>`}
   <h3>Add a result code</h3>
   <form id="codeform" class="row"><input id="c-team" type="text" placeholder="Team name" maxlength="24" style="max-width:200px"><input id="c-code" type="text" placeholder="Result code" maxlength="18" style="max-width:200px"><button class="btn primary" type="submit">Add</button><span class="small" id="c-msg"></span></form>
   ${rows.length?`<div class="row"><button class="btn small" id="b-clear">Clear this board…</button><span id="clear-confirm"></span></div>`:""}`);
  document.querySelectorAll("[data-br]").forEach(b=>b.onclick=()=>{boardRound=+b.dataset.br;renderBoard()});
  $("#b-bclose").onclick=()=>{const f=boardFrom;boardFrom=null;if(f==="end"){G.phase="plan";finishSeason()}else openTitle()};
  $("#codeform").onsubmit=async ev=>{ev.preventDefault();const code=$("#c-code").value;const id="code-"+code.toUpperCase().replace(/[^0-9A-Z]/g,"");const e=entryFromCode(code,($("#c-team").value||"").trim()||"Team",id);
    if(!e){$("#c-msg").textContent="That code is not valid. Check for typos.";return}boardRound=e.round||1;saveLocal(e);if(DB){try{await DB.collection("runs3").doc(id).set(e)}catch(err){}}if(LIVE){liveRuns.set(id,e);livePost(e.code,e.team,id)}renderBoard()};
  const cb=$("#b-clear");if(cb)cb.onclick=()=>{$("#clear-confirm").innerHTML=`<button class="btn small" id="b-clear2" style="background:#5a2018">Yes, remove all results</button>`;
    $("#b-clear2").onclick=async()=>{try{localStorage.removeItem("sdl-runs3");localStorage.setItem("sdl-cleared-at",String(Date.now()))}catch(e){}if(DB){for(const e of dbRuns){try{await DB.collection("runs3").doc(e._id).delete()}catch(err){}}}renderBoard()}};
}

/* ---------- boot ---------- */
requestAnimationFrame(frame);
if(location.hash==="#board")openBoard("title");else openTitle();
