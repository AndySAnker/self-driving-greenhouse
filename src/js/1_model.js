"use strict";
/* ================================================================
   SELF-DRIVING GREENHOUSE v3 — model
   Every plant gets its own growth conditions. A hidden analytical
   formula decides how tall it grows in one week.
   N = plants per batch (G.beds in code; costs money)
   p = chance a plant is exceptional (planner quality, costs money and thinking time)
   ================================================================ */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let rng=mulberry32((Date.now()^Math.floor(Math.random()*1e9))>>>0);
function gauss(r){r=r||rng;let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const eur=v=>(v<0?"−$":"$")+Math.abs(Math.round(v)).toLocaleString("en-US");

/* ---------- the four conditions you control (stored as 0–1) ---------- */
const KNOBS=[
  {k:"w",name:"Water",unit:"mL/day",lo:0,hi:500,step:10,col:"#4fb0ff"},
  {k:"l",name:"Light",unit:"µmol/m²/s",lo:0,hi:1000,step:20,col:"#ffd84a"},
  {k:"f",name:"Fertiliser",unit:"ppm N",lo:0,hi:300,step:5,col:"#7fd650"},
  {k:"t",name:"Temperature",unit:"°C",lo:10,hi:35,step:.5,col:"#ff8a5b"},
];
const toU=(i,x)=>KNOBS[i].lo+(KNOBS[i].hi-KNOBS[i].lo)*x;
const fromU=(i,u)=>(u-KNOBS[i].lo)/(KNOBS[i].hi-KNOBS[i].lo);
const fmtK=(i,x)=>{const v=toU(i,x);return (i===3?v.toFixed(1):Math.round(v))};
const condText=c=>KNOBS.map((k,i)=>`${k.name} ${fmtK(i,c[i])} ${k.unit}`).join(" · ");
const condShort=c=>c.map((x,i)=>fmtK(i,x)).join(" / ");

/* ---------- the hidden biology: one analytical formula ----------
   Each condition has a bell-shaped response. The best amount of water depends on the light
   (more light → more evaporation → more water needed). Height in cm after one week:
     H = 4 + 12·mean(W,L,F,T) + 48·W·L·F·T + 26·D
   W = exp(−((w − (0.2 + 0.55·l))/0.2)²)   L = exp(−((l − 0.7)/0.3)²)
   F = exp(−((f − 0.55)/0.28)²)            T = exp(−((t − 0.55)/0.25)²)
   D = a smaller bump at little light and lots of fertiliser (a local optimum)          */
const OPT={l:.7,f:.55,t:.55,wa:.2,wb:.55};
function factors(c){const [w,l,f,t]=c;
  return [Math.exp(-(((w-(OPT.wa+OPT.wb*l))/.2)**2)),Math.exp(-(((l-OPT.l)/.3)**2)),Math.exp(-(((f-OPT.f)/.28)**2)),Math.exp(-(((t-OPT.t)/.25)**2))]}
// A second, smaller "comfort zone": shade-tolerant growth with lots of fertiliser. A local optimum that traps simple hill-climbing.
const DECOY=[.3,.25,.85,.35];
function decoyOf(c){let d=0;for(let i=0;i<4;i++)d+=(c[i]-DECOY[i])**2;return Math.exp(-d/(2*.16*.16))}
function heightOf(c){const [a,b,d,e]=factors(c);return 4+12*(a+b+d+e)/4+48*a*b*d*e+26*decoyOf(c)}
const HMAX=heightOf([OPT.wa+OPT.wb*OPT.l,OPT.l,OPT.f,OPT.t]);
const GOLD=40;                       // cm: "exceptional"
const P_RANDOM=(()=>{const r=mulberry32(99);let k=0;const n=60000;for(let i=0;i<n;i++)if(heightOf([r(),r(),r(),r()])>=GOLD)k++;return k/n})();
function grow(c){return clamp(heightOf(c)*(1+.04*gauss()),1,80)}   // ±4 % biological variation

/* ---------- planners ---------- */
const PLANNERS=[
  {id:"you",name:"You decide",price:0,days:0,col:"#eef3e6",
   what:"You set the conditions yourself."},
  {id:"random",name:"Random",price:0,days:0,col:"#cfd6d9",
   what:"Random conditions. Learns nothing."},
  {id:"bo",name:"Bayesian optimisation",price:3000,days:1,col:"#d685ff",
   what:"Learns from all your plants and picks the most promising next try."},
  {id:"rough",name:"BO + rough twin",price:4000,days:2,col:"#9bb0ff",
   what:"Like Bayesian optimisation, plus a quick digital twin: a computer model of plants. It is only roughly right."},
  {id:"twin",name:"BO + detailed twin",price:6000,days:4,col:"#5fd3e8",
   what:"Like Bayesian optimisation, plus a detailed digital twin: a computer model of plants. Very good, but slow."},
];
const PLANNER=Object.fromEntries(PLANNERS.map(p=>[p.id,p]));
const randCond=()=>[rng(),rng(),rng(),rng()];
const mutate=(c,s)=>c.map(x=>clamp(x+s*gauss(),0,1));
function topData(data,k){return data.slice().sort((a,b)=>b.y-a.y).slice(0,k)}
function chol(A,n){const L=new Float64Array(n*n);for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i*n+j];for(let k=0;k<j;k++)s-=L[i*n+k]*L[j*n+k];L[i*n+j]=i===j?Math.sqrt(Math.max(s,1e-10)):s/L[j*n+j]}return L}
function twinPrior(c){ // a simulation with a systematic error: right shape, slightly wrong optimum
  const s=[c[0]+.06,c[1]-.05,c[2]+.07,c[3]-.04];return (heightOf(s)*0.95)/HMAX}
function roughPrior(c){ // a crude model: ignores the water–light interaction, optimum noticeably off, too broad
  const [w,l,f,t]=c;const b=x=>Math.exp(-x*x);
  return .62*b((w-.45)/.3)*b((l-.5)/.4)*b((f-.72)/.35)*b((t-.42)/.32)}
let PCTX=null;   // set by Round 2: {ymax, gold, detailed(c), rough(c)} — null means Round 1 (height)
function planBO(data,n,twin){
  const YM=PCTX?PCTX.ymax:HMAX,GL=PCTX?PCTX.gold:GOLD;
  const prior=twin==="detailed"?(PCTX?PCTX.detailed:twinPrior):twin==="rough"?(PCTX?PCTX.rough:roughPrior):null;const useTwin=!!prior;
  if(data.length<4&&!useTwin)return [...Array(n)].map(randCond);
  const ys=data.map(d=>d.y/YM);const m=data.length;
  const mean=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:.2;
  const m0=c=>useTwin?prior(c):mean;
  const best=data.reduce((a,d)=>Math.max(a,d.y),0);
  const ell=.17,sf2=.08,sn2=.0015,beta=best>=GL?1.0:1.8;
  const kf=(a,b)=>{let d=0;for(let i=0;i<4;i++)d+=(a[i]-b[i])**2;return sf2*Math.exp(-d/(2*ell*ell))};
  let L=null,alpha=null;
  if(m){const K=new Float64Array(m*m);for(let i=0;i<m;i++)for(let j=0;j<=i;j++){const v=kf(data[i].c,data[j].c)+(i===j?sn2:0);K[i*m+j]=v;K[j*m+i]=v}
    L=chol(K,m);const z=new Float64Array(m);for(let i=0;i<m;i++){let s=ys[i]-m0(data[i].c);for(let k=0;k<i;k++)s-=L[i*m+k]*z[k];z[i]=s/L[i*m+i]}
    alpha=new Float64Array(m);for(let i=m-1;i>=0;i--){let s=z[i];for(let k=i+1;k<m;k++)s-=L[k*m+i]*alpha[k];alpha[i]=s/L[i*m+i]}}
  // candidates: random points plus local variations of the best plants
  const cand=[];for(let i=0;i<1500;i++)cand.push(randCond());
  for(const d of topData(data,6))for(let i=0;i<80;i++)cand.push(mutate(d.c,.07));
  if(useTwin)for(let i=0;i<300;i++){const c=randCond();if(prior(c)>.45)cand.push(c)}
  const v=new Float64Array(m);
  const score=cand.map(c=>{let mu=m0(c),vr=sf2;if(m){for(let i=0;i<m;i++){const k=kf(c,data[i].c);v[i]=k;mu+=k*alpha[i]}for(let i=0;i<m;i++){let s=v[i];for(let k=0;k<i;k++)s-=L[i*m+k]*v[k];v[i]=s/L[i*m+i];vr-=v[i]*v[i]}}return mu+beta*Math.sqrt(Math.max(vr,1e-9))});
  const out=[];
  for(let t=0;t<n;t++){let bj=0;for(let j=1;j<cand.length;j++)if(score[j]>score[bj])bj=j;const cb=cand[bj];out.push(cb.slice());
    for(let j=0;j<cand.length;j++){let d=0;for(let i=0;i<4;i++)d+=(cand[j][i]-cb[i])**2;score[j]-=.5*Math.exp(-d/(2*.08*.08))}}
  return out;
}
function plan(id,data,n){
  data=data.filter(d=>d.y!=null);   // plants whose score could not be measured teach the planner nothing
  if(id==="random")return [...Array(n)].map(randCond);
  if(id==="bo")return planBO(data,n,false);
  if(id==="rough")return planBO(data,n,"rough");
  if(id==="twin")return planBO(data,n,"detailed");
  return null;
}

/* ---------- economy ---------- */
const START_MONEY=12000;
const SEASON_DAYS=49;
const GROW_DAYS=7;
const PLANT_COST=0;
const BEDS_START=1, BEDS_MAX=24, BEDS_PACK=1, BEDS_PRICE=1000;   // one bed = one plant per batch
