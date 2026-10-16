/* ================================================================
   The voxel greenhouse (three.js)
   ================================================================ */
const canvas=document.getElementById("gl");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
const scene=new THREE.Scene();
scene.background=new THREE.Color("#a7d8f2");
scene.fog=new THREE.Fog("#a7d8f2",70,150);
const cam=new THREE.PerspectiveCamera(45,1,.1,400);
scene.add(new THREE.HemisphereLight("#eaf6ff","#5d7a3a",.75));
const sun=new THREE.DirectionalLight("#fff4dc",.75);sun.position.set(18,30,14);scene.add(sun);
const fill=new THREE.DirectionalLight("#cfe6ff",.25);fill.position.set(-20,12,-10);scene.add(fill);

/* ---- pixel textures, drawn at 16×16 like a block game ---- */
function pixTex(draw,size){size=size||16;const c=document.createElement("canvas");c.width=c.height=size;const g=c.getContext("2d");const r=mulberry32(draw.length*97+size);draw(g,r,size);const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const shade=(hex,a)=>{const c=new THREE.Color(hex);c.offsetHSL(0,0,a);return "#"+c.getHexString()};
const T={
  grass:pixTex((g,r,n)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=shade("#6aa83a",(r()-.5)*.12);g.fillRect(x,y,1,1)}}),
  gravel:pixTex((g,r,n)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=shade("#b8b2a2",(r()-.5)*.16);g.fillRect(x,y,1,1)}}),
  dirt:pixTex((g,r,n)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=shade("#5a3c22",(r()-.5)*.14);g.fillRect(x,y,1,1)}}),
  planks:pixTex((g,r,n)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++){const b=Math.floor(y/4);g.fillStyle=shade(b%2?"#a3743e":"#b07f45",(r()-.5)*.06-(y%4===3?.08:0)-((x+b*5)%16===0?.06:0));g.fillRect(x,y,1,1)}}),
  water:pixTex((g,r,n)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=shade("#3f8fd0",(r()-.5)*.1);g.fillRect(x,y,1,1)}}),
  birch:pixTex((g,r,n)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=r()<.12?"#2b2b2b":shade("#e9e6dc",(r()-.5)*.06);g.fillRect(x,y,1,1)}}),
  rainbow:pixTex((g,r,n)=>{const cols=["#ff3b3b","#ff9a2e","#ffe53b","#4be35d","#3bb7ff","#6b4bff","#c14bff"];for(let y=0;y<n;y++)for(let x=0;x<n;x++){g.fillStyle=cols[Math.floor(x/n*7)];g.fillRect(x,y,1,1)}}),
};
T.grass.repeat.set(90,90);T.gravel.repeat.set(10,14);
const UNIT=new THREE.BoxGeometry(1,1,1);
const MC={};
function mat(c,o){const k=c+(o?JSON.stringify(o):"");if(MC[k])return MC[k];const p=Object.assign({color:c},o||{});const basic=p.basic;delete p.basic;const m=basic?new THREE.MeshBasicMaterial(p):new THREE.MeshLambertMaterial(p);return MC[k]=m}
function vox(p,x,y,z,sx,sy,sz,m){const me=new THREE.Mesh(UNIT,typeof m==="string"?mat(m):m);me.position.set(x,y,z);me.scale.set(sx,sy,sz);p.add(me);return me}

/* ---- landscape ---- */
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshLambertMaterial({map:T.grass}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,28),new THREE.MeshLambertMaterial({map:T.gravel}));floor.rotation.x=-Math.PI/2;floor.position.y=.005;scene.add(floor);
const house=new THREE.Group();scene.add(house);
(function buildHouse(){
  const frame="#e8ece6";
  for(const x of [-10,10])for(let z=-14;z<=14;z+=4)vox(house,x,3.5,z,.3,7,.3,frame);
  for(const z of [-14,14])for(let x=-10;x<=10;x+=4)vox(house,x,3.5,z,.3,7,.3,frame);
  for(const x of [-10,10])vox(house,x,7,0,.35,.35,28.3,frame);
  for(const z of [-14,14])vox(house,0,7,z,20.3,.35,.35,frame);
  for(let z=-14;z<=14;z+=4)vox(house,0,7,z,20.3,.2,.2,frame);
  vox(house,0,7.6,0,.3,.3,28.3,frame);
  const glass=new THREE.MeshLambertMaterial({color:"#cfefff",transparent:true,opacity:.13,depthWrite:false});
  vox(house,-10,3.5,0,.05,7,28,glass);vox(house,10,3.5,0,.05,7,28,glass);vox(house,0,3.5,-14,20,7,.05,glass);
  const front=vox(house,0,3.5,14,20,7,.05,new THREE.MeshLambertMaterial({color:"#cfefff",transparent:true,opacity:.07,depthWrite:false}));
  const roof=new THREE.MeshLambertMaterial({color:"#dff4ff",transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide});
  for(const sgn of [-1,1]){const r=vox(house,sgn*5,7.3,0,10.2,.05,28,roof);r.rotation.z=sgn*-.12}
  // path to the door
  for(let z=15;z<24;z+=1.2)vox(house,(z%2.4<1.2?.2:-.2),.04,z,2.2,.08,1,"#b8b2a2");
  // Finnish birches in autumn
  const birch=new THREE.MeshLambertMaterial({map:T.birch});
  const spots=[[-17,-8],[-19,6],[-15,18],[17,-11],[19,4],[16,17],[-6,-21],[8,-22],[-24,-18],[25,-20],[-26,12],[27,13]];
  spots.forEach(([x,z],i)=>{const h=6+(i%3);vox(house,x,h/2,z,.8,h,.8,birch);
    const leaf=["#e0b12f","#d89a22","#c7c33a","#e6c64a"];
    for(let k=0;k<14;k++){const a=k*2.4,rr=1+((k*7)%3)*.6;vox(house,x+Math.cos(a)*rr*.8,h-.5+((k*5)%4)*.7,z+Math.sin(a)*rr*.8,1.2,1.2,1.2,leaf[(i+k)%4])}});
})();

/* ---- beds ---- */
const ROWZ=[-2.25,2.25,-6.75,6.75,-11.25,11.25];
const bedPos=i=>({x:((i%4)-1.5)*4.5,z:ROWZ[Math.floor(i/4)]});
const BED=[];
const pickables=[];
function spriteTex(draw){const c=document.createElement("canvas");c.width=c.height=64;draw(c.getContext("2d"));const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;return t}
const ICON={
  drop:spriteTex(g=>{g.fillStyle="#0b0f0d";g.fillRect(18,6,28,52);g.fillStyle="#4fb0ff";const px=[[28,10,8,6],[24,16,16,8],[20,24,24,26],[24,50,16,4]];for(const [x,y,w,h] of px)g.fillRect(x,y,w,h);g.fillStyle="#d6f0ff";g.fillRect(26,30,6,10)}),
  ready:spriteTex(g=>{g.fillStyle="#0b0f0d";g.fillRect(12,4,40,56);g.fillStyle="#7fd650";g.fillRect(16,8,32,48);g.fillStyle="#0b0f0d";g.fillRect(28,14,8,24);g.fillRect(28,42,8,8)}),
  tube:spriteTex(g=>{g.fillStyle="#0b0f0d";g.fillRect(22,4,20,56);g.fillStyle="#f4f4f4";g.fillRect(26,8,12,44);g.fillStyle="#f2b33d";g.fillRect(26,32,12,20)}),
};
function numTex(n){return spriteTex(g=>{g.fillStyle="rgba(11,15,13,.85)";g.fillRect(8,14,48,36);g.fillStyle="#eef3e6";g.font="bold 30px monospace";g.textAlign="center";g.textBaseline="middle";g.fillText(String(n),32,33)})}
for(let i=0;i<24;i++){
  const p=bedPos(i);const g=new THREE.Group();g.position.set(p.x,0,p.z);scene.add(g);
  const wood=vox(g,0,.4,0,3.2,.8,3.2,new THREE.MeshLambertMaterial({map:T.planks}));
  const soil=vox(g,0,.82,0,2.9,.1,2.9,new THREE.MeshLambertMaterial({map:T.dirt}));
  const tank=vox(g,0,.45,0,3.2,.9,3.2,"#e9f1f2");tank.visible=false;
  const water=vox(g,0,.91,0,2.9,.04,2.9,new THREE.MeshLambertMaterial({map:T.water}));water.visible=false;
  const pick=new THREE.Mesh(UNIT,new THREE.MeshBasicMaterial({visible:false}));pick.scale.set(3.6,4,3.6);pick.position.y=2;pick.userData.bed=i;g.add(pick);pickables.push(pick);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:numTex(i+1),depthTest:false}));label.scale.set(.9,.9,1);label.position.set(-1.25,1.2,1.25);g.add(label);
  const status=new THREE.Sprite(new THREE.SpriteMaterial({map:ICON.drop,depthTest:false}));status.scale.set(1.1,1.1,1);status.position.set(0,3.6,0);status.visible=false;g.add(status);
  const plant=new THREE.Group();plant.position.y=.87;g.add(plant);
  const stake=new THREE.Group();g.add(stake);vox(stake,1.15,1.3,1.15,.08,1,.08,"#7a5a32");const flag=vox(stake,1.35,1.65,1.15,.4,.28,.05,mat("#5fd3e8",{basic:true}));stake.visible=false;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,40,8,1,true),new THREE.MeshBasicMaterial({color:"#ffe066",transparent:true,opacity:.38,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=20;beam.visible=false;g.add(beam);
  BED.push({g,wood,soil,tank,water,label,status,plant,stake,flag,beam,led:null});
  g.visible=false;
}
const sel=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.5,.95,3.5)),new THREE.LineBasicMaterial({color:"#ffd84a"}));sel.visible=false;scene.add(sel);
const hov=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4,.9,3.4)),new THREE.LineBasicMaterial({color:"#ffffff",transparent:true,opacity:.7}));hov.visible=false;scene.add(hov);


const lerpHex=(a,b,t)=>{const c=new THREE.Color(a).lerp(new THREE.Color(b),clamp(t,0,1));return "#"+c.getHexString()};
function buildPlant(grp,p){
  while(grp.children.length)grp.remove(grp.children[0]);
  if(!p)return;
  const h=p.h*p.frac;                 // cm right now
  const fs=factors(p.c);
  if(p.dead){vox(grp,0,.1,0,.5,.2,.5,"#6b4a2a");vox(grp,.1,.25,0,.15,.3,.15,"#7a5a32");return}
  const vigour=p.props?p.props.green:(fs[0]+fs[2])/2;
  let leafC=lerpHex("#d8d27a","#2a7a2e",vigour);
  if(p.c[0]<OPT.wa+OPT.wb*p.c[1]-.25)leafC=lerpHex(leafC,"#9c7b3c",.45);       // too dry: brown edges
  const stemC=lerpHex("#8aa83a","#4f7d28",vigour);
  const bs=.25;const nodes=Math.max(1,Math.round(h/4.5));
  for(let j=0;j<nodes;j++)vox(grp,0,bs/2+j*bs,0,bs*.8,bs,bs*.8,stemC);
  const leafS=p.props?(.2+.45*p.props.yield)*Math.max(.35,p.frac):.22+.5*Math.min(1,h/60);
  for(let j=1;j<=nodes;j++){
    const yy=j*bs-.05;const rot=j%2;const span=leafS*(1.2-.5*j/nodes);
    for(const s of [-1,1]){const L=vox(grp,rot?s*(span*.5+.1):0,yy,rot?0:s*(span*.5+.1),rot?span:leafS*.7,.08,rot?leafS*.7:span,leafC);L.rotation[rot?"z":"x"]=s*(rot?.25:-.25)}
  }
  vox(grp,0,nodes*bs+.08,0,leafS*.8,.14,leafS*.8,lerpHex(leafC,"#9be05a",.2));
}
function hTex(txt,gold){return spriteTex(g=>{g.fillStyle=gold?"rgba(59,50,16,.92)":"rgba(11,15,13,.85)";g.fillRect(2,18,60,28);g.fillStyle=gold?"#ffd84a":"#eef3e6";g.font="bold 19px monospace";g.textAlign="center";g.textBaseline="middle";g.fillText(txt,32,33)})}
const hCache={};
function refreshBed(i){
  const B=BED[i];
  if(!G){B.g.visible=false;return}
  B.g.visible=i<G.beds;
  const p=G.plants[i];
  buildPlant(B.plant,p);
  const showH=!!(p&&p.frac>=1);
  B.status.visible=showH;
  if(showH){const txt=p.label||(Math.round(p.h)+" cm");const key=txt+(p.gold?"g":"");B.status.material.map=hCache[key]||(hCache[key]=hTex(txt,p.gold));B.status.material.needsUpdate=true;B.status.position.y=1.6+Math.max(1,Math.round(p.h/4.5))*.25+.4;B.status.scale.set(1.7,1.7,1)}
  B.beam.visible=!!(p&&p.gold&&p.frac>=1);
  B.stake.visible=false;
  if(B.led){const l=p?p.c[1]:0;B.led.material=mat(lerpHex("#3a3f45","#fff2c0",l),{basic:true})}
}
function refreshAll(){for(let i=0;i<24;i++)refreshBed(i)}
function growVisual(){for(let i=0;i<G.beds;i++){const p=G.plants[i];if(p&&p.frac<1)buildPlant(BED[i].plant,p)}}

/* ---- equipment ---- */
const equip=new THREE.Group();scene.add(equip);
const anim={leds:[],twin:null};
function syncEquipment(){
  while(equip.children.length)equip.remove(equip.children[0]);
  anim.leds=[];anim.twin=null;anim.rough=null;
  for(let i=0;i<24;i++)BED[i].led=null;
  if(!G){refreshAll();return}
  for(let i=0;i<G.beds;i++){const p=bedPos(i);vox(equip,p.x,5.66,p.z,2.6,.12,.3,"#2b2f33");BED[i].led=vox(equip,p.x,5.56,p.z,2.5,.08,.45,mat("#3a3f45",{basic:true}));vox(equip,p.x-1.2,6.4,p.z,.04,1.4,.04,"#222");vox(equip,p.x+1.2,6.4,p.z,.04,1.4,.04,"#222")}
  // every bed has its own pump, dosing and lamp: the computer sets the conditions, the plants grow by themselves
  const rows=[...Array(Math.ceil(G.beds/4)).keys()].map(k=>ROWZ[k]);
  vox(equip,-8.6,1.3,-12.6,1.6,2.6,1.6,"#3b8fd9");vox(equip,-8.6,2.7,-12.6,1.7,.2,1.7,"#2a6aa6");
  for(const z of rows){vox(equip,0,.95,z-1.75,17,.14,.14,"#3b8fd9");for(let k=0;k<4;k++)vox(equip,(k-1.5)*4.5,.92,z-1.4,.2,.2,.5,"#1d4f7d")}
  vox(equip,-8.6,.95,0,.14,.14,26,"#3b8fd9");
  if(G.own.bo||G.own.twin||G.own.rough){
    vox(equip,-4.5,1.6,-13.1,1.3,3.2,1.1,"#15181b");
    for(let r=0;r<7;r++)for(let k=0;k<3;k++){const m=vox(equip,-4.85+k*.35,.5+r*.4,-12.53,.12,.08,.04,mat("#d685ff",{basic:true}));anim.leds.push(m)}
  }
  if(G.own.rough){const tw=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:"#9bb0ff"}));tw.position.set(-6.3,3.4,-13.1);equip.add(tw);anim.rough=tw}
  if(G.own.twin){const tw=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.4,1.4,1.4)),new THREE.LineBasicMaterial({color:"#5fd3e8"}));tw.position.set(-4.5,4.6,-13.1);equip.add(tw);anim.twin=tw}
  if(G.own.evo){vox(equip,-2.4,.4,-13.1,1.6,.8,.9,"#9a7a4a");vox(equip,-2.4,1.25,-13.1,1.1,.85,.5,"#d9d2bf");vox(equip,-2.4,1.27,-12.84,.85,.6,.02,mat("#7fd650",{basic:true}))}
  vox(equip,-6.3,.35,-13.1,.7,.7,.7,"#f4f4f4");for(const [dx,dy] of [[-.15,.15],[.15,-.15],[0,0]])vox(equip,-6.3+dx,.35+dy,-12.74,.12,.12,.02,"#111");
  if(G.round===2){
    const S=G.sensors||{};
    if(G.system==="turnkey"){ // one white cabinet with a branded screen: the ready-made GrowBox
      vox(equip,8.4,1.6,-12.4,2.2,3.2,1.4,"#eef2f0");vox(equip,8.4,2.2,-11.68,1.6,.9,.05,mat("#5fd3e8",{basic:true}));vox(equip,8.4,.9,-11.68,1.2,.2,.05,"#2b2f33");
    }else{ // a table with a small green circuit board and cables: the modular controller
      vox(equip,8.4,.8,-12.4,2,.12,1.2,"#9a6a35");for(const x of [7.6,9.2])for(const z of [-12.9,-11.9])vox(equip,x,.4,z,.12,.8,.12,"#7a5a32");
      vox(equip,8.2,.9,-12.3,.6,.06,.4,"#2e8b3a");vox(equip,8.7,.95,-12.2,.3,.12,.3,"#222");vox(equip,8.4,.5,-11.7,.05,.6,.05,"#d33");vox(equip,8.6,.5,-11.7,.05,.6,.05,"#33d");
    }
    if(S.camera){vox(equip,-8.6,2,12.4,.15,4,.15,"#555");vox(equip,-8.2,4.1,12.1,.7,.5,.9,"#111");vox(equip,-8.2,4.05,11.6,.35,.35,.15,"#3b6b8f")}
    if(S.hyper){vox(equip,8.6,2.2,12.4,.18,4.4,.18,"#555");vox(equip,8.4,4.6,12.1,1,.7,1,"#2a2340");vox(equip,8.4,4.6,11.58,.8,.5,.05,new THREE.MeshBasicMaterial({map:T.rainbow}))}
    if(S.lab){vox(equip,-3.5,.45,15.6,1.2,.9,.8,"#f4f4f4");vox(equip,-3.5,.5,16.01,.5,.15,.02,"#2a6aa6");vox(equip,-3.5,.5,16.01,.15,.5,.02,"#2a6aa6")}
    if(S.scale){vox(equip,6,.3,15.2,1,.6,1,"#d0d4d6");vox(equip,6,.62,15.2,.8,.04,.8,"#9aa0a4")}
  }
  refreshAll();
}
function person(coat){
  const p=new THREE.Group();
  const legL=vox(p,-.17,.45,0,.28,.9,.3,"#2f3e66"),legR=vox(p,.17,.45,0,.28,.9,.3,"#2f3e66");
  vox(p,0,1.3,0,.72,.85,.4,coat);vox(p,0,.95,0,.74,.12,.42,coat);
  const armL=vox(p,-.5,1.3,0,.22,.8,.26,coat),armR=vox(p,.5,1.3,0,.22,.8,.26,coat);
  vox(p,0,2.0,0,.5,.5,.5,"#d9a77c");vox(p,0,2.28,-.03,.54,.14,.56,"#3b2a1a");vox(p,0,2.05,.255,.38,.1,.02,"#5fd3e8");
  p.userData={legL,legR,armL,armR,tx:0,tz:16,phase:0};
  scene.add(p);return p;
}
const avatars={me:person("#f4f4f4")};
avatars.me.position.set(0,0,16.5);
function walkTo(i){const p=bedPos(i);avatars.me.userData.tx=p.x+.3;avatars.me.userData.tz=p.z+2.3}
function stepPerson(p,dt){
  const u=p.userData;const dx=u.tx-p.position.x,dz=u.tz-p.position.z;const d=Math.hypot(dx,dz);
  if(d>.05){const sp=Math.min(d,dt*7);p.position.x+=dx/d*sp;p.position.z+=dz/d*sp;p.rotation.y=Math.atan2(dx,dz);u.phase+=dt*12}
  else u.phase*=.8;
  const s=Math.sin(u.phase)*.5;u.legL.rotation.x=s;u.legR.rotation.x=-s;u.armL.rotation.x=-s;u.armR.rotation.x=s;
}

/* ---- camera: drag to orbit, wheel/pinch to zoom, WASD to move ---- */
const view={theta:.55,phi:.98,r:34,tx:0,ty:1,tz:-1,goalR:34};
function placeCam(){
  view.phi=clamp(view.phi,.25,1.45);view.r=clamp(view.r,10,70);
  const {theta,phi,r}=view;
  cam.position.set(view.tx+r*Math.sin(phi)*Math.sin(theta),view.ty+r*Math.cos(phi),view.tz+r*Math.sin(phi)*Math.cos(theta));
  cam.lookAt(view.tx,view.ty,view.tz);
}
const ptrs=new Map();let drag=null;let pinch0=0;
canvas.addEventListener("pointerdown",ev=>{canvas.setPointerCapture(ev.pointerId);ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(ptrs.size===1)drag={x:ev.clientX,y:ev.clientY,moved:0,btn:ev.button};
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y);drag&&(drag.moved=99)}});
canvas.addEventListener("pointermove",ev=>{
  if(ptrs.has(ev.pointerId)){const p=ptrs.get(ev.pointerId);const dx=ev.clientX-p.x,dy=ev.clientY-p.y;p.x=ev.clientX;p.y=ev.clientY;
    if(ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0){view.r*=pinch0/d;pinch0=d}return}
    if(drag){drag.moved+=Math.abs(dx)+Math.abs(dy);if(drag.moved>5){
      if(drag.btn===2||ev.shiftKey){const s=view.r*.0016;view.tx-=(Math.cos(view.theta)*dx)*s;view.tz+=(Math.sin(view.theta)*dx)*s;view.tx-=Math.sin(view.theta)*dy*s;view.tz-=Math.cos(view.theta)*dy*s}
      else{view.theta-=dx*.006;view.phi-=dy*.005}}}}
  else hoverAt(ev.clientX,ev.clientY);
});
canvas.addEventListener("pointerup",ev=>{ptrs.delete(ev.pointerId);if(ptrs.size<2)pinch0=0;
  if(drag&&drag.moved<=5&&ptrs.size===0){const i=pickAt(ev.clientX,ev.clientY);if(i!=null&&G&&overlayClosed())selectPlant(i);}
  if(ptrs.size===0)drag=null});
canvas.addEventListener("pointercancel",ev=>{ptrs.delete(ev.pointerId);drag=null});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("wheel",ev=>{ev.preventDefault();view.r*=Math.exp(ev.deltaY*.0012)},{passive:false});
const ray=new THREE.Raycaster();const v2=new THREE.Vector2();
function pickAt(cx,cy){const r=canvas.getBoundingClientRect();v2.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(v2,cam);
  const hits=ray.intersectObjects(pickables.filter(p=>p.parent.visible));return hits.length?hits[0].object.userData.bed:null}
let hovered=null;
function hoverAt(cx,cy){if(!G)return;const i=pickAt(cx,cy);hovered=i;canvas.style.cursor=i!=null?"pointer":"crosshair";}
const keys=new Set();
window.addEventListener("keydown",e=>{const t=e.target&&e.target.tagName;if(t==="INPUT"||t==="TEXTAREA"||typeof e.key!=="string")return;keys.add(e.key.toLowerCase())});
window.addEventListener("keyup",e=>{if(typeof e.key==="string")keys.delete(e.key.toLowerCase())});
window.addEventListener("blur",()=>keys.clear());

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}}

let last=performance.now();let ledBlink=0;
function frame(now){
  const dt=Math.min(.25,(now-last)/1000);last=now;
  resize();
  const mv=12*dt*(view.r/34);
  if(keys.has("w")){view.tx-=Math.sin(view.theta)*mv;view.tz-=Math.cos(view.theta)*mv}
  if(keys.has("s")){view.tx+=Math.sin(view.theta)*mv;view.tz+=Math.cos(view.theta)*mv}
  if(keys.has("a")){view.tx-=Math.cos(view.theta)*mv;view.tz+=Math.sin(view.theta)*mv}
  if(keys.has("d")){view.tx+=Math.cos(view.theta)*mv;view.tz-=Math.sin(view.theta)*mv}
  view.tx=clamp(view.tx,-25,25);view.tz=clamp(view.tz,-25,25);
  if(!G)view.theta+=dt*.05;
  placeCam();
  if(G){
    tick(dt);
    if(G.selected!=null&&G.selected<G.beds){const p=bedPos(G.selected);sel.position.set(p.x,.45,p.z);sel.visible=true}else sel.visible=false;
    if(hovered!=null&&hovered!==G.selected&&hovered<G.beds){const p=bedPos(hovered);hov.position.set(p.x,.45,p.z);hov.visible=true}else hov.visible=false;
    ledBlink+=dt;if(anim.leds.length&&ledBlink>(G.phase==="think"?.03:.18)){ledBlink=0;const m=anim.leds[Math.floor(Math.random()*anim.leds.length)];m.visible=!m.visible}
    for(const tw of [anim.twin,anim.rough]){if(!tw)continue;const sp=G.phase==="think"?4:.6;tw.rotation.y+=dt*sp;tw.rotation.x+=dt*sp*.4}
    stepPerson(avatars.me,dt);
  }
  renderer.render(scene,cam);
  requestAnimationFrame(frame);
}
