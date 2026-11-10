// Our Museum — a two-person 3D museum with live chat and shared photos.
// Hosting: any static host (GitHub Pages). Login, chat and photos: Firebase Realtime Database.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const C = window.MUSEUM_CONFIG || {};
const PEOPLE = Object.assign({ a:{ name:'Me', email:'', avatar:'avatars/me.glb', height:1.76 }, b:{ name:'', email:'', avatar:'avatars/her.glb', height:1.62 } }, C.people || {});
const DEMO = !C.firebase || !C.firebase.apiKey || /PASTE/i.test(C.firebase.apiKey);
const FB_VER = '10.12.2';

const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
const rand = (a,b) => a + Math.random()*(b-a);
const nameOf = who => (PEOPLE[who]?.name || '').trim() || (who === 'a' ? 'Me' : 'Her');

/* ================= state ================= */
const DEFAULT_A = {skin:'#c4906a',hair:'#0b0909',hairStyle:'fringe',eyes:'#2e1d13',lips:'#c98480',lashes:false,beard:true,blush:false,earrings:false,makeup:false,
  top:'tee',topColor:'#141414',bottom:'pants',bottomColor:'#a8946f',shoes:'#f5f3ef',height:1.0,scarf:'#b3243a'};
const DEFAULT_B = {skin:'#efc6a6',hair:'#2b1b13',hairStyle:'long',scarf:'#b3243a',eyes:'#3a2416',lips:'#c4858a',lashes:true,beard:false,blush:true,earrings:true,makeup:true,
  top:'gown',topColor:'#6e1f2e',bottom:'maxi',bottomColor:'#6e1f2e',shoes:'#2a1d18',height:.94};
const DEFAULT_DECO = {big:'garland', b1:'roses', b5:'roses', w2:'hearts', e2:'hearts', ps2:'roses', qs2:'roses', f2:'hearts', f3:'hearts'};
let state = {frames:{}, avatars:{}, decoInit:false};
const photoCache = {};   // photo id -> data URL

/* ================= renderer ================= */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
if ('useLegacyLights' in renderer) renderer.useLegacyLights = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#120c0a');
const camera = new THREE.PerspectiveCamera(52, 1, 0.03, 120);

(() => {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial({color:'#4a2a22', side:THREE.BackSide})));
  const lamp = (x,y,z,w,h,c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({color:c, side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); env.add(m); };
  lamp(0,4.9,0,10,6,'#fff6e2'); lamp(9.9,2,0,3,4,'#ffd9a0'); lamp(-9.9,2,3,3,4,'#ffd9a0'); lamp(0,1,9.9,6,2,'#c47a4a'); lamp(0,0,-9.9,6,3,'#ffe8c8');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, .02).texture;
})();
scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2418, 0.45));
const sun = new THREE.DirectionalLight(0xfff4e2, 1.1);
sun.position.set(2, 18, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left:-17, right:17, top:13, bottom:-13, near:1, far:30});
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun);

function tex(w, h, draw, {repeat, srgb=true}={}){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const M = (c, o={}) => new THREE.MeshStandardMaterial(Object.assign({color:c, roughness:.85, metalness:0}, o));
const gold = M('#c9a14e', {metalness:1, roughness:.32});
const goldDark = M('#8e6a2a', {metalness:1, roughness:.42});
const brass = M('#b8924a', {metalness:.9, roughness:.35});

/* ================= the hall ================= */
const T_PARQUET = tex(1024, 1024, (g,w,h)=>{
  const cell = 128, pl = cell/4;
  for (let cy=0; cy<h/cell; cy++) for (let cx=0; cx<w/cell; cx++){
    const horiz = (cx+cy)%2 === 0;
    for (let k=0;k<4;k++){
      g.fillStyle = `hsl(${24 + Math.random()*8} ${30 + Math.random()*12}% ${24 + Math.random()*12}%)`;
      const x = cx*cell + (horiz ? 0 : k*pl), y = cy*cell + (horiz ? k*pl : 0), ww = horiz ? cell : pl, hh = horiz ? pl : cell;
      g.fillRect(x, y, ww, hh);
      g.strokeStyle = 'rgba(40,20,8,.18)'; g.lineWidth = 1;
      for (let gr=0; gr<5; gr++){ g.beginPath();
        if (horiz){ const yy = y + Math.random()*hh; g.moveTo(x, yy); g.bezierCurveTo(x+ww*.3, yy+rand(-3,3), x+ww*.7, yy+rand(-3,3), x+ww, yy+rand(-2,2)); }
        else { const xx = x + Math.random()*ww; g.moveTo(xx, y); g.bezierCurveTo(xx+rand(-3,3), y+hh*.3, xx+rand(-3,3), y+hh*.7, xx+rand(-2,2), y+hh); }
        g.stroke(); }
      g.strokeStyle = 'rgba(25,12,4,.55)'; g.lineWidth = 1.5; g.strokeRect(x+.5, y+.5, ww-1, hh-1);
    }
  }
}, {repeat:[16,12]});
const T_DAMASK = (base, motif) => { const t = tex(256, 256, (g,w,h)=>{
  g.fillStyle = base; g.fillRect(0,0,w,h); g.fillStyle = motif; g.strokeStyle = motif; g.lineWidth = 3;
  const fleur = (cx, cy, s) => { g.save(); g.translate(cx, cy); g.scale(s, s);
    for (const m of [1,-1]){ g.save(); g.scale(m,1);
      g.beginPath(); g.moveTo(0,-46); g.bezierCurveTo(18,-34,24,-12,8,0); g.bezierCurveTo(26,6,34,26,16,40); g.bezierCurveTo(10,30,4,22,0,22); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(8,8); g.bezierCurveTo(30,-4,44,10,38,26); g.stroke(); g.beginPath(); g.arc(40,30,4,0,TAU); g.fill(); g.restore(); }
    g.beginPath(); g.moveTo(0,22); g.lineTo(-5,52); g.lineTo(5,52); g.closePath(); g.fill(); g.restore(); };
  fleur(128,128,1.2); fleur(0,0,.7); fleur(256,0,.7); fleur(0,256,.7); fleur(256,256,.7);
}); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const T_WALL = T_DAMASK('#5a1822', '#6b232d'), T_GREEN = T_DAMASK('#1f3a2c', '#284836');
const T_WAINSCOT = tex(512, 256, (g,w,h)=>{
  const grd = g.createLinearGradient(0,0,0,h); grd.addColorStop(0,'#3d2416'); grd.addColorStop(1,'#2a170d'); g.fillStyle = grd; g.fillRect(0,0,w,h);
  for (let i=0;i<60;i++){ g.strokeStyle = `rgba(20,10,4,${rand(.08,.2)})`; g.beginPath(); const y = Math.random()*h; g.moveTo(0,y); g.bezierCurveTo(w*.3,y+rand(-6,6),w*.6,y+rand(-6,6),w,y+rand(-4,4)); g.stroke(); }
  const panel = (x,y,pw,ph) => { g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6; g.strokeRect(x,y,pw,ph); g.strokeStyle = 'rgba(214,170,110,.28)'; g.lineWidth = 2; g.strokeRect(x+5,y+5,pw-10,ph-10); };
  panel(24, 36, w/2-48, h-90); panel(w/2+24, 36, w/2-48, h-90); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0,h-22,w,22);
}); T_WAINSCOT.wrapS = THREE.RepeatWrapping;
const T_MARBLE = tex(512, 512, (g,w,h)=>{
  g.fillStyle = '#efebe4'; g.fillRect(0,0,w,h);
  for (let i=0;i<14;i++){ g.strokeStyle = `rgba(110,100,95,${rand(.12,.35)})`; g.lineWidth = rand(.6,2.4); g.beginPath();
    let x = Math.random()*w, y = 0; g.moveTo(x,y); while (y < h){ x += rand(-30,30); y += rand(20,60); g.lineTo(x,y); } g.stroke(); }
});
const T_CARPET = tex(256, 1024, (g,w,h)=>{
  g.fillStyle = '#6e1420'; g.fillRect(0,0,w,h);
  g.fillStyle = '#c69a4a'; g.fillRect(14,0,10,h); g.fillRect(w-24,0,10,h);
  g.fillStyle = '#2c0a10'; g.fillRect(0,0,14,h); g.fillRect(w-14,0,14,h);
  g.fillStyle = 'rgba(198,154,74,.55)';
  for (let y=40; y<h; y+=96){ g.save(); g.translate(w/2, y); g.rotate(Math.PI/4); g.fillRect(-16,-16,32,32); g.restore();
    g.beginPath(); g.arc(w/2-60, y+48, 5, 0, TAU); g.arc(w/2+60, y+48, 5, 0, TAU); g.fill(); }
  for (let i=0;i<3000;i++){ g.fillStyle = `rgba(0,0,0,${Math.random()*.08})`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); }
}); T_CARPET.wrapT = THREE.RepeatWrapping;

const matWall = M('#ffffff', {map:T_WALL, roughness:.9}), matGreen = M('#ffffff', {map:T_GREEN, roughness:.9});
const matWains = M('#ffffff', {map:T_WAINSCOT, roughness:.55}), matCream = M('#e6dcc6', {roughness:.8});
const matMarble = M('#ffffff', {map:T_MARBLE, roughness:.25}), matWalnut = M('#3a2214', {roughness:.45});
const velvet = new THREE.MeshPhysicalMaterial({color:'#6a1222', roughness:.85, sheen:1, sheenRoughness:.5, sheenColor:new THREE.Color('#ff8fa0')});

const colliders = [], camBlockers = [], pickables = [];
function box(cx, cy, cz, sx, sy, sz, mat, {collide=true, block=true, shadow=true}={}){
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(cx, cy, cz); m.castShadow = shadow; m.receiveShadow = true; scene.add(m);
  if (collide) colliders.push({minX:cx-sx/2, maxX:cx+sx/2, minZ:cz-sz/2, maxZ:cz+sz/2});
  if (block) camBlockers.push(m);
  return m;
}
function setUV(mesh, ru, rv){ const t = mesh.material.map; mesh.material = mesh.material.clone(); mesh.material.map = t.clone(); mesh.material.map.needsUpdate = true; mesh.material.map.repeat.set(ru, rv); }
const RW = 16, RD = 12, RH = 6.5;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW*2, RD*2), M('#ffffff', {map:T_PARQUET, roughness:.38}));
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; floor.userData.floor = true; scene.add(floor); pickables.push(floor);
const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 19), M('#ffffff', {map:T_CARPET, roughness:.95}));
runner.material.map.repeat.set(1, 5); runner.rotation.x = -Math.PI/2; runner.position.set(0, .004, 1.6); runner.receiveShadow = true; runner.userData.floor = true; scene.add(runner); pickables.push(runner);
function wall(cx, cz, len, alongX, inward){
  const w = box(cx, RH/2, cz, alongX ? len : .3, RH, alongX ? .3 : len, matWall); setUV(w, len/1.4, RH/1.4);
  const off = inward * .17, px = alongX ? cx : cx + off, pz = alongX ? cz + off : cz, L = (a, b) => alongX ? a : b, o = {collide:false, block:false, shadow:false};
  const wn = box(px, .6, pz, L(len,.06), 1.2, L(.06,len), matWains, {collide:false, shadow:false}); setUV(wn, len/2.4, 1);
  box(px + L(0,inward*.03), 1.22, pz + L(inward*.03,0), L(len,.1), .07, L(.1,len), goldDark, o);
  box(px, .05, pz, L(len,.09), .1, L(.09,len), matWalnut, o);
  box(px, 5.55, pz, L(len,.07), .06, L(.07,len), gold, o);
  box(px, 6.05, pz, L(len,.04), .9, L(.04,len), matCream, o);
  box(px + L(0,inward*.08), 6.42, pz + L(inward*.08,0), L(len,.24), .16, L(.24,len), matCream, o);
  box(px + L(0,inward*.05), 5.62, pz + L(inward*.05,0), L(len,.12), .08, L(.12,len), matCream, o);
}
wall(-RW-.15, 0, RD*2+.6, false, 1); wall(RW+.15, 0, RD*2+.6, false, -1); wall(0, -RD-.15, RW*2, true, 1); wall(0, RD+.15, RW*2, true, -1);
(() => {
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW*2, RD*2), matCream); ceil.rotation.x = Math.PI/2; ceil.position.y = RH; scene.add(ceil);
  const beamM = M('#d9cdb2', {roughness:.7}), o = {collide:false, block:false, shadow:false};
  for (let x=-RW+2; x<RW; x+=2) box(x, RH-.12, 0, .14, .24, RD*2, beamM, o);
  for (let z=-RD+2; z<RD; z+=2) box(0, RH-.12, z, RW*2, .24, .14, beamM, o);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.6), new THREE.MeshBasicMaterial({color:'#fff3dc'})); sky.rotation.x = Math.PI/2; sky.position.set(0, RH-.02, 0); scene.add(sky);
  for (let x=-5; x<=5; x+=1.25) box(x, RH-.05, 0, .06, .06, 5.6, goldDark, o);
  for (let z=-2.8; z<=2.8; z+=1.4) box(0, RH-.05, z, 10, .06, .06, goldDark, o);
})();
function partition(cx, cz, len){
  const o = {collide:false, block:false, shadow:false};
  box(cx, .06, cz, len+.3, .12, .6, matWalnut, {collide:false, block:false});
  const p = box(cx, 2.15, cz, len, 4.3, .4, matGreen); setUV(p, len/1.4, 4.3/1.4);
  for (const s of [1,-1]){ const wn = box(cx, .6, cz + s*.21, len, 1.2, .03, matWains, o); setUV(wn, len/2.4, 1); box(cx, 1.22, cz + s*.225, len, .06, .04, goldDark, o); }
  box(cx, 4.36, cz, len+.12, .14, .52, matWalnut, {collide:false, block:false}); box(cx, 4.27, cz, len+.04, .05, .46, gold, o);
}
partition(-6.5, -2, 7); partition(6.5, -2, 7);
function column(x, z){
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const parts = [[new THREE.CylinderGeometry(.27, .3, 5.4, 32), matMarble, 3.0], [new THREE.BoxGeometry(.8, .3, .8), matMarble, .15], [new THREE.CylinderGeometry(.42, .28, .35, 32), matMarble, 5.88], [new THREE.BoxGeometry(.9, .14, .9), matMarble, 6.12]];
  parts.forEach(([geo, mat, y], i) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); if (i === 0) camBlockers.push(m); });
  for (const [r, t, y, mat] of [[.31,.06,.36,matMarble],[.29,.025,5.68,gold]]){ const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 32), mat); m.rotation.x = Math.PI/2; m.position.y = y; g.add(m); }
  scene.add(g); colliders.push({minX:x-.4, maxX:x+.4, minZ:z-.4, maxZ:z+.4});
}
[7.6, 3.4, -6.2].forEach(z => { column(-2.7, z); column(2.7, z); });
const flameMat = new THREE.MeshBasicMaterial({color:'#ffd892'});
const crystalMat = new THREE.MeshStandardMaterial({color:'#fff8ee', metalness:.6, roughness:.05, envMapIntensity:2.5, transparent:true, opacity:.75});
function chandelier(x, z){
  const g = new THREE.Group(); g.position.set(x, 4.55, z); scene.add(g);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,RH-4.75,6), goldDark); chain.position.y = (RH-4.55)/2; g.add(chain);
  g.add(new THREE.Mesh(new THREE.LatheGeometry([[0,-.35],[.08,-.3],[.12,-.1],[.06,0],[.1,.15],[.04,.3],[0,.32]].map(p=>new THREE.Vector2(p[0],p[1])), 20), gold));
  const candleM = M('#f6efe0', {roughness:.6});
  for (const [r, y, n] of [[.75, 0, 10], [.45, .32, 6]]){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .022, 8, 48), gold); ring.rotation.x = Math.PI/2; ring.position.y = y; g.add(ring);
    for (let i=0;i<n;i++){ const a = i/n*TAU, cx = Math.cos(a)*r, cz = Math.sin(a)*r;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(.045,.025,.05,10), gold); cup.position.set(cx, y+.03, cz); g.add(cup);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.13,8), candleM); candle.position.set(cx, y+.12, cz); g.add(candle);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), flameMat); fl.scale.y = 1.8; fl.position.set(cx, y+.21, cz); g.add(fl);
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.03), crystalMat); cr.scale.y = 1.8; cr.position.set(cx, y-.1, cz); g.add(cr); }
  }
  const lt = new THREE.PointLight(0xffc98a, 1.1, 14, 1.6); lt.position.y = .1; g.add(lt);
}
chandelier(0, 6.2); chandelier(0, -6.4);
const benches = [];
function bench(x, z, sitterRy){
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = sitterRy;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, .16, .56), velvet); seat.position.y = .37; seat.castShadow = seat.receiveShadow = true; g.add(seat);
  const cush = new THREE.Mesh(new THREE.CapsuleGeometry(.08, 1.74, 4, 12), velvet); cush.rotation.z = Math.PI/2; cush.scale.set(1, 3.3, .55); cush.position.y = .43; cush.castShadow = true; g.add(cush);
  for (let i=-3;i<=3;i++) for (const zz of [-.12,.12]){ const b = new THREE.Mesh(new THREE.SphereGeometry(.014,8,6), goldDark); b.position.set(i*.25 + (zz>0?.125:0), .5, zz); if (Math.abs(b.position.x) < .88) g.add(b); }
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.94, .08, .6), matWalnut); apron.position.y = .27; g.add(apron);
  for (const ox of [-.86,.86]) for (const oz of [-.22,.22]){
    const leg = new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.035,0],[.025,.06],[.04,.12],[.02,.2],[.03,.24],[0,.24]].map(p=>new THREE.Vector2(p[0],p[1])), 12), matWalnut);
    leg.position.set(ox, 0, oz); leg.castShadow = true; g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), gold); foot.position.set(ox, .02, oz); g.add(foot);
  }
  scene.add(g); seat.userData.bench = cush.userData.bench = benches.length; pickables.push(seat, cush);
  const fwd = new THREE.Vector3(Math.sin(sitterRy),0,Math.cos(sitterRy)), side = new THREE.Vector3(Math.cos(sitterRy),0,-Math.sin(sitterRy));
  const seats = [-.42,.42].map(o => ({pos:new THREE.Vector3(x,0,z).addScaledVector(side,o).addScaledVector(fwd,-.04), ry:sitterRy}));
  const ext = Math.abs(Math.sin(sitterRy)) > .5 ? {sx:.56, sz:1.9} : {sx:1.9, sz:.56};
  colliders.push({minX:x-ext.sx/2+.05, maxX:x+ext.sx/2-.05, minZ:z-ext.sz/2+.05, maxZ:z+ext.sz/2-.05});
  benches.push({seats, center:new THREE.Vector3(x,0,z), fwd});
}
bench(0, -6.4, Math.PI); bench(-11.8, 4.5, -Math.PI/2); bench(11.8, -5.5, Math.PI/2);
(() => {
  const posts = [-3.4, -1.15, 1.15, 3.4].map(x => new THREE.Vector3(x, 0, -10.3));
  posts.forEach(p => { const g = new THREE.Group(); g.position.copy(p);
    for (const [geo, y] of [[new THREE.CylinderGeometry(.16,.18,.04,24), .02], [new THREE.CylinderGeometry(.025,.025,.95,12), .5], [new THREE.SphereGeometry(.05,16,12), 1.0]]){ const m = new THREE.Mesh(geo, brass); m.position.y = y; m.castShadow = true; g.add(m); }
    scene.add(g); });
  const ropeM = new THREE.MeshPhysicalMaterial({color:'#8a1426', roughness:.7, sheen:1, sheenColor:new THREE.Color('#ff9aa8')});
  for (let i=0;i<posts.length-1;i++){ const a = posts[i].clone().setY(.93), b = posts[i+1].clone().setY(.93), m = a.clone().lerp(b,.5); m.y = .7;
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 24, .022, 8), ropeM); rope.castShadow = true; scene.add(rope); }
  colliders.push({minX:-3.5, maxX:3.5, minZ:-10.36, maxZ:-10.24});
})();

/* ================= flowers & ornaments ================= */
function mergeGeos(geos){
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g); let n = 0; parts.forEach(p => n += p.attributes.position.count);
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3); let o = 0;
  parts.forEach(p => { pos.set(p.attributes.position.array, o*3); nor.set(p.attributes.normal.array, o*3); o += p.attributes.position.count; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3)); g.setAttribute('normal', new THREE.BufferAttribute(nor,3)); return g;
}
const ROSE_GEO = (() => {
  const parts = []; const bud = new THREE.SphereGeometry(.28, 8, 6); bud.scale(1, 1.2, 1); bud.translate(0,.12,0); parts.push(bud);
  [[3,.45,.25,.32],[5,.7,.55,.45],[7,.95,.95,.55]].forEach(([n, r, tilt, size], li) => { for (let i=0;i<n;i++){
    const p = new THREE.SphereGeometry(size, 7, 5, 0, 1.9, 0, Math.PI*.55); p.scale(1, 1.15, .45); p.rotateX(-Math.PI/2 + tilt); p.translate(0, .05, r*.55); p.rotateY(i/n*TAU + li*.6); parts.push(p); } });
  const g = mergeGeos(parts); g.rotateX(Math.PI/2); g.computeBoundingSphere(); return g;
})();
const LEAF_GEO = (() => { const g = new THREE.SphereGeometry(1, 8, 5); g.scale(.38, 1, .08); g.translate(0, .9, 0); return g; })();
const DOT_GEO = new THREE.SphereGeometry(1, 6, 4);
const HEART_GEO = (() => { const s = new THREE.Shape(); s.moveTo(0,-.9); s.bezierCurveTo(-.2,-.6,-1,-.25,-1,.25); s.bezierCurveTo(-1,.8,-.35,1,0,.55); s.bezierCurveTo(.35,1,1,.8,1,.25); s.bezierCurveTo(1,-.25,.2,-.6,0,-.9);
  const g = new THREE.ExtrudeGeometry(s, {depth:.25, bevelEnabled:true, bevelThickness:.12, bevelSize:.1, bevelSegments:3, curveSegments:10}); g.center(); return g; })();
const SCROLL_GEO = (() => { const parts = []; for (const m of [1,-1]){ const t = new THREE.TorusGeometry(.5, .07, 6, 24, Math.PI*1.4); t.rotateZ(m>0? -.2 : Math.PI+.2); t.translate(m*.55, 0, 0); parts.push(t); } return mergeGeos(parts); })();
const roseMat = new THREE.MeshStandardMaterial({color:'#ffffff', roughness:.55, side:THREE.DoubleSide});
const leafMat = new THREE.MeshStandardMaterial({color:'#ffffff', roughness:.6});
const dotMat = new THREE.MeshStandardMaterial({color:'#fffaf2', roughness:.8});
const heartRed = new THREE.MeshPhysicalMaterial({color:'#b5172f', roughness:.25, clearcoat:1, clearcoatRoughness:.15});
const ROSES = ['#a3102a','#c9203c','#e0566e','#f2a3b3','#f9d3da','#fbf1e6'], LEAVES = ['#2f5a2c','#3c6b33','#24482a','#4a7a3c'];
class Bouquet {
  constructor(){ this.r = []; this.l = []; this.d = []; this.h = []; this.hg = []; this.s = []; }
  rose(x,y,z,s,c){ this.r.push([x,y,z,s,c || ROSES[Math.floor(Math.random()*ROSES.length)]]); }
  leaf(x,y,z,s,a){ this.l.push([x,y,z,s,a]); } dot(x,y,z,s){ this.d.push([x,y,z,s]); }
  heart(x,y,z,s,rz,goldy){ (goldy ? this.hg : this.h).push([x,y,z,s,rz]); } scroll(x,y,z,s,rz){ this.s.push([x,y,z,s,rz]); }
  cluster(cx, cy, z, n, spread, s, pal){
    for (let i=0;i<n;i++){ const a = Math.random()*TAU, r = Math.sqrt(Math.random())*spread; this.rose(cx + Math.cos(a)*r, cy + Math.sin(a)*r*.8, z + rand(0,.03), s*rand(.75,1.15), pal ? pal[i%pal.length] : undefined); }
    for (let i=0;i<n*1.4;i++){ const a = Math.random()*TAU; this.leaf(cx + Math.cos(a)*spread*.95, cy + Math.sin(a)*spread*.8, z - .01, s*rand(1.4,2.1), a - Math.PI/2); }
    for (let i=0;i<n*2;i++){ const a = Math.random()*TAU, r = spread*rand(.6,1.25); this.dot(cx + Math.cos(a)*r, cy + Math.sin(a)*r*.8, z + rand(0,.04), s*rand(.12,.2)); }
  }
  build(){
    const g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    const mk = (geo, mat, list, colorFn, rotFn) => { if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { v.set(it[0], it[1], it[2]); rotFn(e, it); q.setFromEuler(e); sc.setScalar(it[3]); m4.compose(v, q, sc); im.setMatrixAt(i, m4); if (colorFn) im.setColorAt(i, col.set(colorFn(it))); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); };
    mk(ROSE_GEO, roseMat, this.r, it => it[4], e => e.set(rand(-.3,.3), rand(-.3,.3), Math.random()*TAU));
    mk(LEAF_GEO, leafMat, this.l, () => LEAVES[Math.floor(Math.random()*LEAVES.length)], (e,it) => e.set(rand(-.4,.2), rand(-.3,.3), it[4]));
    mk(DOT_GEO, dotMat, this.d, null, e => e.set(0,0,0));
    mk(HEART_GEO, heartRed, this.h, null, (e,it) => e.set(0, 0, it[4]));
    mk(HEART_GEO, gold, this.hg, null, (e,it) => e.set(0, 0, it[4]));
    mk(SCROLL_GEO, gold, this.s, null, (e,it) => e.set(0, 0, it[4]));
    return g;
  }
}
function urn(x, z){
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const ped = new THREE.Mesh(new THREE.BoxGeometry(.55, 1.0, .55), matMarble); ped.position.y = .5; ped.castShadow = ped.receiveShadow = true; g.add(ped);
  const capm = new THREE.Mesh(new THREE.BoxGeometry(.66, .08, .66), matMarble); capm.position.y = 1.04; g.add(capm);
  const vase = new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.1,0],[.12,.04],[.07,.1],[.09,.2],[.17,.34],[.18,.42],[.15,.46],[.19,.5],[0,.5]].map(p=>new THREE.Vector2(p[0],p[1])), 24), gold);
  vase.position.y = 1.08; vase.castShadow = true; g.add(vase);
  const b = new Bouquet(), top = 1.62;
  for (let i=0;i<34;i++){ const th = Math.acos(rand(.05,1)), ph = Math.random()*TAU; b.r.push([Math.sin(th)*Math.cos(ph)*.26, top + Math.cos(th)*.234, Math.sin(th)*Math.sin(ph)*.26, rand(.045,.06), ROSES[i%ROSES.length]]); }
  for (let i=0;i<40;i++){ const ph = Math.random()*TAU, r = rand(.22,.3); b.l.push([Math.cos(ph)*r, top + rand(-.08,.12), Math.sin(ph)*r, rand(.07,.1), ph]); }
  for (let i=0;i<50;i++){ const th = Math.acos(rand(-.1,1)), ph = Math.random()*TAU, r = rand(.28,.36); b.d.push([Math.sin(th)*Math.cos(ph)*r, top + Math.cos(th)*r*.9, Math.sin(th)*Math.sin(ph)*r, rand(.007,.011)]); }
  const bg = b.build();
  bg.children.forEach(im => { if (im.geometry !== ROSE_GEO) return; const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i=0;i<im.count;i++){ im.getMatrixAt(i, m); m.decompose(p, q, s); q.setFromUnitVectors(new THREE.Vector3(0,0,1), new THREE.Vector3(p.x, p.y - top + .05, p.z).normalize()); m.compose(p, q, s); im.setMatrixAt(i, m); }
    im.instanceMatrix.needsUpdate = true; });
  g.add(bg); colliders.push({minX:x-.36, maxX:x+.36, minZ:z-.36, maxZ:z+.36});
}
urn(-4.7, -11.2); urn(4.7, -11.2); urn(-15, 11); urn(15, 11);

/* ================= plaque & lettering ================= */
const lectern = new THREE.Group(); lectern.position.set(-3.6, 0, 8.4); lectern.rotation.y = .55;
(() => {
  const post = new THREE.Mesh(new THREE.LatheGeometry([[0,0],[.22,0],[.22,.06],[.08,.12],[.06,.9],[.12,1.0],[0,1.0]].map(p=>new THREE.Vector2(p[0],p[1])), 20), matWalnut); post.castShadow = true; lectern.add(post);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(.9, .05, .6), matWalnut); desk.position.y = 1.04; desk.rotation.x = .42; desk.castShadow = true; lectern.add(desk);
  scene.add(lectern); colliders.push({minX:-4.05, maxX:-3.15, minZ:7.95, maxZ:8.85});
})();
const plaqueMat = new THREE.MeshStandardMaterial({metalness:.85, roughness:.35});
const plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(.8, .5), plaqueMat); plaqueMesh.position.set(0, 1.072, 0); plaqueMesh.rotation.x = -(Math.PI/2 - .42); lectern.add(plaqueMesh);
const letterMat = new THREE.MeshStandardMaterial({transparent:true, metalness:.9, roughness:.3});
const letters = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.8), letterMat); letters.position.set(0, 4.25, RD-.04); letters.rotation.y = Math.PI; scene.add(letters);
function drawNames(){
  const her = (PEOPLE.b.name || '').trim(), me = nameOf('a');
  plaqueMat.map?.dispose();
  plaqueMat.map = tex(1024, 640, (g,w,h)=>{
    const gr = g.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#d8b56b'); gr.addColorStop(.5,'#b48a3e'); gr.addColorStop(1,'#d4ae62'); g.fillStyle = gr; g.fillRect(0,0,w,h);
    g.strokeStyle = 'rgba(70,45,10,.6)'; g.lineWidth = 6; g.strokeRect(24,24,w-48,h-48); g.lineWidth = 2; g.strokeRect(40,40,w-80,h-80);
    g.fillStyle = '#3a260a'; g.textAlign = 'center'; g.font = '600 30px Figtree, sans-serif'; g.fillText('A   PERMANENT   COLLECTION', w/2, 160);
    g.font = 'italic 400 118px "Bodoni Moda", Georgia, serif'; g.fillText(her ? 'For ' + her : 'For You', w/2, 330, w-120);
    g.font = '400 38px Figtree, sans-serif'; g.fillText('with all my love, ' + me, w/2, 440, w-120);
  }); plaqueMat.needsUpdate = true;
  letterMat.map?.dispose();
  letterMat.map = tex(2048, 368, (g,w,h)=>{
    g.textAlign = 'center'; const gr = g.createLinearGradient(0,40,0,240); gr.addColorStop(0,'#f2d58f'); gr.addColorStop(.6,'#c39445'); gr.addColorStop(1,'#8d6526');
    g.fillStyle = gr; g.font = '400 200px "Bodoni Moda", Georgia, serif'; g.fillText('Our Museum', w/2, 215);
    g.font = '600 46px Figtree, sans-serif'; g.fillStyle = '#d9b36a'; g.fillText((me + '   &   ' + nameOf('b')).toUpperCase(), w/2, 320, w-100);
  }); letterMat.needsUpdate = true;
  $('#titleNames').textContent = me + ' & ' + nameOf('b');
  $('#tabA').textContent = nameOf('a'); $('#tabB').textContent = nameOf('b');
}

/* ================= frames ================= */
const WASH = tex(256, 256, (g,w,h)=>{ const r = g.createRadialGradient(w/2, h*.12, 4, w/2, h*.35, w*.58);
  r.addColorStop(0,'rgba(255,214,160,.6)'); r.addColorStop(.45,'rgba(255,200,140,.2)'); r.addColorStop(1,'rgba(255,190,130,0)'); g.fillStyle = r; g.fillRect(0,0,w,h); });
let EMPTY;
function makeEmpty(){ EMPTY = tex(512, 640, (g,w,h)=>{
  g.fillStyle = '#e8dfcc'; g.fillRect(0,0,w,h);
  for (let i=0;i<5000;i++){ g.fillStyle = `rgba(90,70,40,${Math.random()*.06})`; g.fillRect(Math.random()*w, Math.random()*h, 2, 1); }
  const v = g.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w*.8); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(60,40,20,.25)'); g.fillStyle = v; g.fillRect(0,0,w,h);
  g.fillStyle = 'rgba(80,60,40,.55)'; g.textAlign = 'center'; g.font = '300 110px Figtree, sans-serif'; g.fillText('+', w/2, h/2+10);
  g.font = 'italic 38px "Bodoni Moda", Georgia, serif'; g.fillText('Add a photo', w/2, h/2 + 80); }); }
makeEmpty();
const linerMat = M('#e9dfc8', {roughness:.9}), unitPlane = new THREE.PlaneGeometry(1,1);
const frames = new Map(), FRAME_ROOMS = {};
function frameGeo(w, h, b, depth){
  const s = new THREE.Shape(); s.moveTo(-w/2-b, -h/2-b); s.lineTo(w/2+b, -h/2-b); s.lineTo(w/2+b, h/2+b); s.lineTo(-w/2-b, h/2+b); s.closePath();
  const bs = b*.32, hole = new THREE.Path(); hole.moveTo(-w/2-bs, -h/2-bs); hole.lineTo(-w/2-bs, h/2+bs); hole.lineTo(w/2+bs, h/2+bs); hole.lineTo(w/2+bs, -h/2-bs); hole.closePath(); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, {depth, bevelEnabled:true, bevelThickness:depth*.9, bevelSize:bs, bevelSegments:3, curveSegments:1});
}
function addFrame(id, wall, x, y, z, ry, maxW, maxH){
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  const liner = new THREE.Mesh(unitPlane, linerMat), pic = new THREE.Mesh(unitPlane, new THREE.MeshStandardMaterial({map:EMPTY, roughness:.55}));
  const outer = new THREE.Mesh(new THREE.BufferGeometry(), gold), inner = new THREE.Mesh(new THREE.BufferGeometry(), goldDark); outer.castShadow = true;
  [outer, inner, liner, pic].forEach(m => { m.userData.frameId = id; g.add(m); pickables.push(m); });
  const wash = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({map:WASH, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending})); wash.position.z = .002; g.add(wash);
  const lamp = new THREE.Group(); g.add(lamp);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 1, 16, 1, false, 0, Math.PI), brass); hood.rotation.z = Math.PI/2; hood.rotation.y = Math.PI/2; lamp.add(hood);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.22,6), brass); arm.rotation.x = Math.PI/2; arm.position.set(0, .02, -.11); lamp.add(arm);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, .03), new THREE.MeshBasicMaterial({color:'#fff0cf'})); glow.rotation.x = Math.PI/2; glow.position.y = -.035; lamp.add(glow);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(.5,.12), new THREE.MeshStandardMaterial({metalness:.85, roughness:.35})); plaque.visible = false; g.add(plaque);
  const f = {id, wall, group:g, outer, inner, liner, pic, wash, lamp, hood, glow, plaque, deco:null, decoKey:'', maxW, maxH, normal:new THREE.Vector3(Math.sin(ry),0,Math.cos(ry)), pos:new THREE.Vector3(x,0,z), tex:null, loadedPid:undefined, size:null};
  frames.set(id, f); (FRAME_ROOMS[wall] ||= []).push(id); sizeFrame(f, maxW/maxH);
}
function sizeFrame(f, aspect){
  let w = f.maxW, h = w/aspect; if (h > f.maxH){ h = f.maxH; w = h*aspect; }
  if (f.size && Math.abs(f.size.w - w) < 1e-3 && Math.abs(f.size.h - h) < 1e-3) return;
  const big = Math.min(w,h), b = Math.max(.07, big*.075), liner = big*.035;
  f.outer.geometry.dispose(); f.outer.geometry = frameGeo(w + liner*2, h + liner*2, b, .025); f.outer.position.z = .02;
  f.inner.geometry.dispose(); f.inner.geometry = frameGeo(w + liner*2 - .002, h + liner*2 - .002, b*.22, .01); f.inner.position.z = .07;
  f.liner.scale.set(w + liner*2 + .01, h + liner*2 + .01, 1); f.liner.position.z = .022;
  f.pic.scale.set(w, h, 1); f.pic.position.z = .026;
  f.wash.scale.set(w*1.8 + 1.2, h + 2.4, 1); f.wash.position.y = .5;
  const top = h/2 + liner + b;
  f.lamp.position.set(0, top + .1, .24); f.hood.scale.set(1, Math.max(.4, w*.6), 1); f.glow.scale.x = Math.max(.4, w*.6)*.95;
  f.plaque.position.set(0, -(top + .16), .012);
  f.size = {w, h, W2: w/2 + liner + b, H2: h/2 + liner + b}; buildDeco(f, true);
}
function buildDeco(f, force){
  const kind = state.frames[f.id]?.deco || 'none', key = kind + '|' + f.size.w.toFixed(3) + '|' + f.size.h.toFixed(3);
  if (!force && key === f.decoKey) return; f.decoKey = key;
  if (f.deco){ f.group.remove(f.deco); f.deco.children.forEach(c => c.dispose && c.dispose()); f.deco = null; }
  if (kind === 'none') return;
  const {W2, H2} = f.size, s = Math.max(.75, Math.min(1.7, Math.min(W2, H2)/.8)), z = .09, B = new Bouquet();
  const RED = ['#a3102a','#c9203c','#e0566e','#f2a3b3','#fbf1e6','#f9d3da'];
  if (kind === 'roses'){
    B.cluster(-W2 + .06*s, H2 - .04*s, z, 11, .2*s, .05*s, RED); B.cluster(W2 - .06*s, -H2 + .04*s, z, 13, .23*s, .05*s, RED);
    for (let i=0;i<6;i++){ const t = i/6; B.rose(-W2 + .2*s + t*.5*s, H2 + .01, z, .035*s); B.leaf(-W2 + .25*s + t*.5*s, H2 + .02, z-.01, .07*s, -Math.PI/2 - .3);
      B.rose(W2 - .25*s - t*.5*s, -H2 - .01, z, .035*s); B.leaf(W2 - .3*s - t*.5*s, -H2 - .02, z-.01, .07*s, Math.PI/2 + .3); }
  } else if (kind === 'garland'){
    const per = 2*(W2*2 + H2*2), step = .1*s, n = Math.floor(per/step);
    for (let i=0;i<n;i++){ let d = i*step, x, y, nx, ny;
      if (d < W2*2){ x = -W2 + d; y = H2; nx = 0; ny = 1; } else if ((d -= W2*2) < H2*2){ x = W2; y = H2 - d; nx = 1; ny = 0; }
      else if ((d -= H2*2) < W2*2){ x = W2 - d; y = -H2; nx = 0; ny = -1; } else { d -= W2*2; x = -W2; y = -H2 + d; nx = -1; ny = 0; }
      B.rose(x + rand(-.015,.015), y + rand(-.015,.015), z, .042*s*rand(.85,1.15), RED[i % RED.length]);
      B.leaf(x + nx*.05*s, y + ny*.05*s, z - .012, .075*s, Math.atan2(ny, nx) - Math.PI/2 + rand(-.6,.6));
      if (i % 2) B.dot(x + nx*.07*s + rand(-.02,.02), y + ny*.07*s, z + .01, .008*s); }
    for (const [cx, cy] of [[-W2,H2],[W2,H2],[-W2,-H2],[W2,-H2]]) B.cluster(cx, cy, z+.01, 7, .13*s, .055*s, RED);
    B.cluster(0, H2 + .05*s, z+.01, 9, .17*s, .055*s, RED);
  } else if (kind === 'hearts'){
    B.heart(0, H2 + .2*s, z, .13*s, 0, true); B.heart(-.24*s, H2 + .13*s, z, .07*s, .35, false); B.heart(.24*s, H2 + .13*s, z, .07*s, -.35, false);
    B.scroll(-.48*s, H2 + .1*s, z, .16*s, .15); B.scroll(.48*s, H2 + .1*s, z, .16*s, -.15);
    const side = (x, sgn) => { for (let i=0;i<4;i++){ const y = H2*.7 - i*(H2*1.4/3); B.heart(x + sgn*.11*s, y, z, rand(.035,.05)*s, sgn*rand(.2,.5), i%2===0); } };
    side(-W2, -1); side(W2, 1);
    for (const [cx, cy] of [[-W2,-H2],[W2,-H2]]){ B.cluster(cx, cy, z, 6, .13*s, .045*s, RED); B.scroll(cx, cy - .12*s, z, .12*s, 0); }
    B.heart(0, -H2 - .14*s, z, .075*s, 0, true);
  }
  f.deco = B.build(); f.group.add(f.deco);
}
addFrame('b1','Main wall',-10.4,2.6,-RD+.02,0,1.6,2.1); addFrame('b2','Main wall',-6.8,2.6,-RD+.02,0,2.0,1.7);
addFrame('big','Main wall',0,3.05,-RD+.02,0,5.8,3.7);
addFrame('b4','Main wall',6.8,2.6,-RD+.02,0,2.0,1.7); addFrame('b5','Main wall',10.4,2.6,-RD+.02,0,1.6,2.1);
[-8,-3,2,7].forEach((z,i)=> addFrame('w'+(i+1),'West wing',-RW+.02,2.6,z,Math.PI/2,1.8,2.1));
[-8,-3,2,7].forEach((z,i)=> addFrame('e'+(i+1),'East wing',RW-.02,2.6,z,-Math.PI/2,1.8,2.1));
[-8.8,-6.5,-4.2].forEach((x,i)=>{ addFrame('ps'+(i+1),'Center walls',x,2.45,-1.795,0,1.4,1.7); addFrame('pn'+(i+1),'Center walls',x,2.45,-2.205,Math.PI,1.4,1.7); });
[4.2,6.5,8.8].forEach((x,i)=>{ addFrame('qs'+(i+1),'Center walls',x,2.45,-1.795,0,1.4,1.7); addFrame('qn'+(i+1),'Center walls',x,2.45,-2.205,Math.PI,1.4,1.7); });
[-10,-6,6,10].forEach((x,i)=> addFrame('f'+(i+1),'Entrance',x,2.5,RD-.02,Math.PI,1.6,1.8));

const texLoader = new THREE.TextureLoader();
function applyFrame(f){
  const pid = state.frames[f.id]?.photo || null;
  if (pid !== f.loadedPid){
    f.loadedPid = pid;
    if (f.tex){ f.tex.dispose(); f.tex = null; }
    if (!pid){ f.pic.material.map = EMPTY; f.pic.material.needsUpdate = true; sizeFrame(f, f.maxW/f.maxH); }
    else getPhoto(pid).then(url => {
      if (f.loadedPid !== pid || !url) return;
      texLoader.load(url, t => { if (f.loadedPid !== pid){ t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; f.tex = t; f.pic.material.map = t; f.pic.material.needsUpdate = true;
        sizeFrame(f, t.image.width / t.image.height); drawPlaque(f); if (openFrameId === f.id) renderFrameSheet(); });
    });
  }
  buildDeco(f, false); drawPlaque(f);
}
function drawPlaque(f){
  const capt = (state.frames[f.id]?.caption || '').trim();
  if (!capt || !state.frames[f.id]?.photo){ f.plaque.visible = false; return; }
  if (f.plaque.userData.cap === capt){ f.plaque.visible = true; return; }
  f.plaque.userData.cap = capt; f.plaque.material.map?.dispose();
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = 'italic 44px "Bodoni Moda", Georgia, serif';
  const tw = Math.min(1400, ctx.measureText(capt).width + 100);
  f.plaque.material.map = tex(Math.ceil(tw), 96, (g,w,h)=>{
    const gr = g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#dcbc76'); gr.addColorStop(1,'#a8813a'); g.fillStyle = gr; g.fillRect(0,0,w,h);
    g.strokeStyle = 'rgba(60,40,10,.5)'; g.lineWidth = 3; g.strokeRect(6,6,w-12,h-12);
    g.fillStyle = '#33220a'; g.textAlign = 'center'; g.font = 'italic 44px "Bodoni Moda", Georgia, serif'; g.fillText(capt, w/2, 62); });
  f.plaque.scale.set(tw/96*.12/.5, 1, 1); f.plaque.material.needsUpdate = true; f.plaque.visible = true;
}

/* ================= built-in characters (used until an avatar file is added) ================= */
function shade(hex, amt){ const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt))); return '#' + c.getHexString(); }
function rgba(hex, a){ const c = new THREE.Color(hex); return `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${a})`; }
function faceTexture(o, female){
  return tex(2048, 1024, (g, W, H)=>{
    const cx = 512; g.fillStyle = o.skin; g.fillRect(0,0,W,H);
    const warm = g.createRadialGradient(cx, 560, 40, cx, 560, 330); warm.addColorStop(0, rgba(shade(o.skin,.04), .5)); warm.addColorStop(1, rgba(o.skin,0)); g.fillStyle = warm; g.fillRect(0,0,W,H);
    const jaw = g.createLinearGradient(0, 640, 0, 860); jaw.addColorStop(0, rgba(o.skin,0)); jaw.addColorStop(1, rgba(shade(o.skin,-.08), .3)); g.fillStyle = jaw; g.fillRect(0,640,W,260);
    if (o.blush || female){ for (const s of [-1,1]){ const r = g.createRadialGradient(cx+s*150, 600, 4, cx+s*150, 600, 85); r.addColorStop(0, `rgba(226,112,122,${o.blush ? .32 : .12})`); r.addColorStop(1,'rgba(226,112,122,0)'); g.fillStyle = r; g.fillRect(cx+s*150-90, 510, 180, 180); } }
    if (o.beard){
      for (let i=0;i<26000;i++){ const a = Math.random()*Math.PI, r = 120 + Math.random()*110, x = cx + Math.cos(a)*r*1.05, y = 600 + Math.sin(a)*r*.95; if (y < 610) continue; g.fillStyle = rgba(o.hair, Math.random()*.07); g.fillRect(x, y, 1.6, 2.4); }
      const hs = (x, y, len, ang, a) => { g.strokeStyle = rgba(o.hair, a); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang)*len, y + Math.sin(ang)*len); g.stroke(); };
      for (let i=0;i<900;i++){ const t = Math.random()*2-1; hs(cx + t*58, 640 - (1-Math.abs(t))*10 + Math.abs(t)*14 + rand(-7,7), rand(5,10), Math.PI/2 + t*.9 + rand(-.3,.3), rand(.35,.75)); }
      for (let i=0;i<2600;i++){ const x = cx + rand(-46,46), y = rand(700, 790); if (Math.abs(x-cx) > 46 - (y-700)*.12) continue; hs(x, y, rand(6,12), Math.PI/2 + rand(-.4,.4), rand(.4,.85)); }
    }
    for (const s of [-1,1]){ const gr = g.createLinearGradient(cx+s*8, 0, cx+s*34, 0); gr.addColorStop(0, rgba(shade(o.skin,-.1),0)); gr.addColorStop(1, rgba(shade(o.skin,-.12), .4)); g.fillStyle = gr; g.beginPath(); g.ellipse(cx+s*24, 560, 14, 50, 0, 0, TAU); g.fill(); }
    g.fillStyle = rgba(shade(o.skin,-.35), .75); for (const s of [-1,1]){ g.beginPath(); g.ellipse(cx+s*15, 612, 8, 4.5, s*.3, 0, TAU); g.fill(); }
    const my = 662, mw = female ? 44 : 46, lipC = (female && o.makeup) ? o.lips : shade(o.lips, -.02), up = female ? 19 : 11, lo = female ? 30 : 18;
    g.fillStyle = shade(lipC, -.04); g.beginPath(); g.moveTo(cx-mw, my); g.bezierCurveTo(cx-mw*.55, my-up*.85, cx-mw*.18, my-up, cx, my-up*.55); g.bezierCurveTo(cx+mw*.18, my-up, cx+mw*.55, my-up*.85, cx+mw, my); g.bezierCurveTo(cx+mw*.5, my+2, cx-mw*.5, my+2, cx-mw, my); g.fill();
    g.fillStyle = shade(lipC, .03); g.beginPath(); g.moveTo(cx-mw*.95, my+1); g.bezierCurveTo(cx-mw*.55, my+lo, cx+mw*.55, my+lo, cx+mw*.95, my+1); g.bezierCurveTo(cx+mw*.4, my+3, cx-mw*.4, my+3, cx-mw*.95, my+1); g.fill();
    g.strokeStyle = rgba(shade(lipC,-.35), .8); g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx-mw, my); g.bezierCurveTo(cx-mw*.4, my+4, cx+mw*.4, my+4, cx+mw, my); g.stroke();
    const ey = 500, ex = 108, ew = female ? 57 : 46, eh = female ? 24 : 15;
    for (const s of [-1,1]){
      const x0 = cx + s*ex, inner = x0 - s*ew, outer = x0 + s*ew;
      const upper = () => { g.moveTo(inner, ey + 3); g.bezierCurveTo(x0 - s*ew*.45, ey - eh*1.35, x0 + s*ew*.4, ey - eh*1.4, outer, ey - (female?6:2)); };
      g.save(); g.beginPath(); upper(); g.bezierCurveTo(x0 + s*ew*.4, ey + eh*.95, x0 - s*ew*.45, ey + eh*.95, inner, ey + 3); g.closePath(); g.clip();
      g.fillStyle = '#f4efe9'; g.fillRect(x0-ew-4, ey-eh*2, ew*2+8, eh*4);
      const ir = female ? 20 : 15.5, ix = x0 + s*2, iy = ey - 1;
      const ig = g.createRadialGradient(ix, iy, 3, ix, iy, ir); ig.addColorStop(0, shade(o.eyes,-.08)); ig.addColorStop(.55, shade(o.eyes,.07)); ig.addColorStop(.88, o.eyes); ig.addColorStop(1, shade(o.eyes,-.2));
      g.fillStyle = ig; g.beginPath(); g.arc(ix, iy, ir, 0, TAU); g.fill();
      g.fillStyle = '#0c0807'; g.beginPath(); g.arc(ix, iy, female ? 7 : 6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(ix - 5, iy - 6, 4, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = '#120a08'; g.lineCap = 'round'; g.lineWidth = female ? 6 : 4; g.beginPath(); upper(); g.stroke();
      if (female && o.makeup){ g.lineWidth = 5; g.beginPath(); g.moveTo(outer - s*4, ey - 6); g.quadraticCurveTo(outer + s*10, ey - 10, outer + s*22, ey - 21); g.stroke(); }
      if (o.lashes){ g.lineWidth = 2.6; for (let k=0;k<20;k++){ const t = .18 + k/20*.82, px = inner + (outer-inner)*t, py = ey - eh*1.13*Math.sin(Math.PI*Math.min(1,t*1.04)); g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + s*4, py - 11, px + s*(6 + t*7), py - 15 - t*5); g.stroke(); } }
      const by = ey - (female ? 58 : 44);
      for (let k=0;k<200;k++){ const t = Math.random(), bx = inner - s*6 + (outer + s*12 - inner + s*6)*t, arch = female ? Math.sin(Math.min(1, t*1.2)*Math.PI*.85)*15 : Math.sin(t*Math.PI*.9)*7, thick = female ? 11 - t*6 : 13 - t*6;
        const yy = by - arch + rand(-thick, thick)*.6; g.strokeStyle = rgba(o.hair, rand(.35, .85)); g.lineWidth = female ? 1.8 : 2.2; g.beginPath(); g.moveTo(bx, yy + 3); g.lineTo(bx + s*rand(6,11), yy - rand(2,6)); g.stroke(); }
    }
  });
}
const add = (parent, m, x=0, y=0, z=0) => { m.position.set(x,y,z); m.castShadow = true; parent.add(m); return m; };
const cap = (r, len, mat, rs=14) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, rs), mat);
const sph = (r, mat, ws=20, hs=14) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
function skirtGeo(rTop, rBot, h, folds, amp){
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 64, 10, true), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (h/2 - y)/h, a = Math.atan2(z, x), k = 1 + Math.sin(a*folds)*amp*t*t + Math.sin(a*folds*2.3 + 1)*amp*.35*t; p.setX(i, x*k); p.setZ(i, z*k); }
  g.computeVertexNormals(); return g;
}
function headGeo(R){
  const g = new THREE.SphereGeometry(R, 64, 48), p = g.attributes.position;
  for (let i=0;i<p.count;i++){ let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const ny = y/R; x *= .86; y *= 1.18;
    if (ny < 0){ const t = -ny; x *= 1 - .3*Math.pow(t, 1.6); z *= 1 - (z > 0 ? .06 : .2)*t*t; }
    if (z < 0 && ny > -.4) z *= 1.08; if (z > 0) z *= .94;
    if (z > 0){ const nx = x/R, yy = y/R, across = Math.exp(-Math.pow(nx/.1, 2));
      z += R*(.09*Math.exp(-Math.pow((yy + .2)/.2, 2)) + .1*Math.exp(-Math.pow((yy + .36)/.1, 2))) * across * (z/R); }
    p.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); return g;
}
function scarfTexture(c){ return tex(512, 512, (g,w,h)=>{ g.fillStyle = c; g.fillRect(0,0,w,h); const hsl = {}; new THREE.Color(c).getHSL(hsl); g.fillStyle = hsl.l > .6 ? '#7a2030' : '#f4ece2';
  for (let y=0;y<32;y++) for (let x=0;x<32;x++){ if ((x+y)%2) continue; g.save(); g.translate(x*16+8, y*16+8); g.rotate(Math.PI/4); g.fillRect(-4.5,-4.5,9,9); g.restore(); } }, {repeat:[5,3]}); }
function buildBody(o, female){
  const skin = M(o.skin, {roughness:.62}), hairM = new THREE.MeshStandardMaterial({color:o.hair, roughness:.45, side:THREE.DoubleSide});
  const topM = new THREE.MeshPhysicalMaterial({color:o.topColor, roughness:.88, sheen:.4, sheenColor:new THREE.Color(shade(o.topColor,.25))});
  const gown = o.top === 'gown', dress = o.top === 'dress', lowerColor = (gown||dress) ? o.topColor : o.bottomColor;
  const botM = new THREE.MeshPhysicalMaterial({color:lowerColor, roughness:.85, side:THREE.DoubleSide, sheen:.5, sheenColor:new THREE.Color(shade(lowerColor,.25))});
  const shoeM = M(o.shoes, {roughness:.45}), P = {}, body = new THREE.Group(); P.body = body;
  const skirted = gown || dress || o.bottom === 'skirt' || o.bottom === 'maxi', longSk = gown || o.bottom === 'maxi';
  ['L','R'].forEach((side,i)=>{ const s = i ? -1 : 1;
    const hip = new THREE.Group(); hip.position.set(s*.088, .9, 0); body.add(hip);
    const legTop = skirted ? skin : botM; add(hip, cap(female ? .068 : .074, .29, legTop), 0, -.215, 0);
    const knee = new THREE.Group(); knee.position.y = -.43; hip.add(knee); add(knee, sph(female ? .055 : .06, legTop));
    add(knee, cap(female ? .05 : .056, .3, (skirted || o.bottom === 'shorts') ? skin : botM), 0, -.2, 0);
    const shoe = add(knee, cap(female ? .04 : .047, female ? .12 : .15, shoeM), 0, -.415, .045); shoe.rotation.x = Math.PI/2; shoe.scale.set(female ? 1.0 : 1.12, 1, .8);
    if (!female) add(knee, new THREE.Mesh(new THREE.BoxGeometry(.1, .025, .27), M('#f2f0ea')), 0, -.445, .045);
    P['hip'+side] = hip; P['knee'+side] = knee; });
  add(body, sph(female ? .158 : .16, botM, 24, 16), 0, .91, 0).scale.set(1, .55, .72);
  const prof = female ? [[0,.86],[.15,.87],[.16,.93],[.128,1.02],[.123,1.06],[.142,1.15],[.158,1.22],[.155,1.29],[.15,1.35],[.12,1.4],[.06,1.43],[0,1.435]]
                      : [[0,.86],[.15,.87],[.158,.96],[.152,1.06],[.162,1.18],[.185,1.31],[.192,1.37],[.15,1.42],[.07,1.445],[0,1.45]];
  add(body, new THREE.Mesh(new THREE.LatheGeometry(prof.map(p=>new THREE.Vector2(p[0],p[1])), 40), topM)).scale.z = .66;
  if (female && (gown || dress)){ const belt = add(body, new THREE.Mesh(new THREE.TorusGeometry(.124, .012, 8, 40), gold), 0, 1.04, 0); belt.rotation.x = Math.PI/2; belt.scale.y = .66; }
  if (skirted){ const top = (gown || dress) ? 1.04 : 1.0, len = longSk ? top - .03 : (dress ? .5 : .42);
    const sk = add(body, new THREE.Mesh(skirtGeo(female ? .128 : .14, longSk ? .42 : .3, len, longSk ? 13 : 10, longSk ? .08 : .05), botM), 0, top - len/2, 0); sk.scale.z = .82; P.skirt = sk; }
  add(body, new THREE.Mesh(new THREE.CylinderGeometry(female ? .042 : .052, female ? .05 : .06, .14, 16), skin), 0, 1.5, -.005);
  if (o.earrings){ const coin = add(body, new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.004,24), gold), 0, 1.36, female ? .085 : .1); coin.rotation.x = Math.PI/2 - .4; }
  ['L','R'].forEach((side,i)=>{ const s = i ? -1 : 1;
    const sh = new THREE.Group(); sh.position.set(s*(female ? .152 : .185), 1.38, -.005); body.add(sh);
    add(sh, sph(female ? .036 : .05, topM, 18, 12)).scale.set(1, .8, .85);
    const longS = o.top === 'long' || o.top === 'hoodie' || gown;
    add(sh, cap(female ? .039 : .05, .2, dress ? skin : topM), 0, -.14, 0);
    if (o.top === 'tee') add(sh, new THREE.Mesh(new THREE.CylinderGeometry(.06,.062,.14,16,1,true), topM), 0, -.08, 0);
    const el = new THREE.Group(); el.position.y = -.285; sh.add(el);
    add(el, sph(female ? .037 : .046, longS ? topM : skin, 12, 10)); add(el, cap(female ? .033 : .041, .19, longS ? topM : skin), 0, -.125, 0);
    add(el, sph(.04, skin, 14, 10), 0, -.29, 0).scale.set(female ? .72 : .85, 1.3, .5);
    P['sh'+side] = sh; P['el'+side] = el; });
  const head = new THREE.Group(); head.position.y = 1.615; body.add(head); P.head = head;
  const R = female ? .104 : .11;
  add(head, new THREE.Mesh(headGeo(R), new THREE.MeshStandardMaterial({map: faceTexture(o, female), roughness:.6})));
  for (const s of [-1,1]){ add(head, sph(1, skin, 14, 10), s*R*.84, -.005, -.006).scale.set(.008, .028, .018); }
  const hg = new THREE.Group(); hg.scale.set(.88, 1.18, 1.02); head.add(hg); buildHair(hg, body, o, hairM, R);
  return {body, P};
}
function buildHair(g, body, o, mat, R){
  const style = o.hairStyle, a = (m, x=0, y=0, z=0) => { m.position.set(x,y,z); m.castShadow = true; g.add(m); return m; };
  const shell = (r, open, t0, tl, m = mat) => a(new THREE.Mesh(new THREE.SphereGeometry(R*r, 48, 28, Math.PI/2 + open, TAU - open*2, t0, tl), m));
  if (style === 'bald') return;
  if (style === 'scarf'){
    const sm = new THREE.MeshPhysicalMaterial({map: scarfTexture(o.scarf || '#b3243a'), roughness:.85, side:THREE.DoubleSide, sheen:.6, sheenColor:new THREE.Color('#ffffff')});
    a(new THREE.Mesh(new THREE.SphereGeometry(R*1.13, 48, 20, 0, TAU, 0, Math.PI*.5), sm)).rotation.x = -.5; shell(1.11, .78, Math.PI*.06, Math.PI*.9, sm);
    a(new THREE.Mesh(new THREE.SphereGeometry(R*1.09, 32, 10, Math.PI/2 - .82, 1.64, Math.PI*.8, Math.PI*.18), sm));
    const drape = new THREE.Mesh(new THREE.LatheGeometry([[.07,-.1],[.08,-.14],[.11,-.18],[.17,-.22],[.205,-.27],[.205,-.33],[.19,-.42],[.17,-.5]].map(p=>new THREE.Vector2(p[0], p[1])), 48), sm);
    drape.position.y = 1.615; drape.scale.z = .74; body.add(drape); return;
  }
  if (style === 'fringe'){
    a(new THREE.Mesh(new THREE.SphereGeometry(R*1.13, 48, 20, 0, TAU, 0, Math.PI*.52), mat)).rotation.x = -.18; shell(1.09, 1.0, Math.PI*.18, Math.PI*.5);
    a(new THREE.Mesh(new THREE.SphereGeometry(R*1.1, 36, 16, 0, TAU, 0, Math.PI*.45), mat), 0, R*.1, -R*.03).rotation.x = -.14;
    for (let i=-5;i<=5;i++){ const ang = Math.PI/2 + i*.13, b = a(new THREE.Mesh(new THREE.SphereGeometry(R*.19, 12, 10), mat)); b.position.set(Math.cos(ang)*R*1.03, R*(.33 - Math.abs(i)*.012), Math.sin(ang)*R*1.03); b.scale.set(.85, 1.25, .45); b.rotation.set(-.55, -i*.13, i*.06); }
    return;
  }
  const capm = a(new THREE.Mesh(new THREE.SphereGeometry(R*1.08, 48, 20, 0, TAU, 0, Math.PI*.5), mat)); capm.rotation.x = -.32;
  if (style === 'short' || style === 'curly' || style === 'buzz'){ shell(1.06, 1.15, Math.PI*.18, Math.PI*.45); return; }
  if (style === 'bun'){ shell(1.06, 1.0, Math.PI*.15, Math.PI*.45); a(sph(R*.42, mat), 0, R*.95, -R*.55); return; }
  capm.rotation.x = -.5; shell(1.1, .95, Math.PI*.08, Math.PI*.6);
  const H = R*3.3, curtain = a(new THREE.Mesh(new THREE.CylinderGeometry(R*1.08, R*1.55, H, 48, 6, true, .75, TAU - 1.5), mat), 0, -R*.45 - H/2, -R*.08);
  for (const sd of [-1,1]){ const f = a(cap(R*.2, R*1.5, mat), sd*R*.9, -R*.45, R*.55); f.scale.set(.7, 1, .5); f.rotation.set(-.25, 0, sd*.06); }
}

/* ================= avatars: realistic file if present, built-in otherwise ================= */
const avatars = {};
const POSE0 = {hipL:0,hipR:0,kneeL:.03,kneeR:.03, shLx:0,shRx:0, shLz:.07,shRz:-.07, elLx:-.15,elRx:-.15, elLz:0,elRz:0, by:0, bx:0, bz:0, byaw:0, hx:0, hy:0, hz:0};
function makeAvatar(who, x, z, ry){
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = ry; scene.add(root);
  const tag = document.createElement('div'); tag.className = 'tag'; tag.innerHTML = '<i></i><span></span>';
  const bub = document.createElement('div'); bub.className = 'bubble'; $('#labels').append(tag, bub);
  const av = {who, root, body:null, P:null, glb:null, cfg:null, tag, bub, bubT:0, pose:Object.assign({}, POSE0),
    action:'idle', actionT:0, target:null, onArrive:null, phase:Math.random()*10, t:Math.random()*10, stuck:0, lastDist:0, seat:null, lookAt:null, topY:1.8, remote:null, blinkT:2};
  tag.querySelector('span').textContent = nameOf(who);
  avatars[who] = av; rebuildBuiltin(av); loadAvatarFile(av); return av;
}
function avatarCfg(who){ return Object.assign({}, who === 'a' ? DEFAULT_A : DEFAULT_B, state.avatars?.[who] || {}); }
function rebuildBuiltin(av){
  if (av.glb) return;
  const o = avatarCfg(av.who), key = JSON.stringify(o); if (av.cfg === key) return; av.cfg = key;
  if (av.body){ av.root.remove(av.body); av.body.traverse(n => { if (n.isMesh){ n.geometry.dispose(); [].concat(n.material).forEach(m => { if (m !== gold) { m.map?.dispose(); m.dispose(); } }); } }); }
  const {body, P} = buildBody(o, av.who === 'b'); av.body = body; av.P = P; av.root.add(body);
  av.root.scale.setScalar(o.height || 1); av.topY = 1.78 * (o.height || 1);
}
const BONE_KEYS = ['hips','spine','spine1','spine2','neck','head','leftarm','leftforearm','lefthand','rightarm','rightforearm','righthand','leftupleg','leftleg','leftfoot','rightupleg','rightleg','rightfoot'];
const avatarStatus = {a:'loading', b:'loading'};
async function loadAvatarFile(av){
  const url = PEOPLE[av.who]?.avatar; if (!url){ avatarStatus[av.who] = 'none'; return; }
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene, bones = {}, morphs = [];
    model.traverse(n => {
      if (n.isMesh){ n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; if (n.morphTargetDictionary) morphs.push(n);
        [].concat(n.material).forEach(m => { if (m && 'envMapIntensity' in m) m.envMapIntensity = .8; }); }
      if (n.isBone){ const k = n.name.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/^.*[:|]/, '').replace(/[^a-z0-9]/g, ''); if (BONE_KEYS.includes(k) && !bones[k]) bones[k] = n; }
    });
    const need = ['hips','leftupleg','leftleg','rightupleg','rightleg','leftarm','leftforearm','rightarm','rightforearm'];
    if (need.some(k => !bones[k])) throw new Error('This avatar file has no standard skeleton.');
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
    const target = PEOPLE[av.who]?.height || (av.who === 'a' ? 1.76 : 1.62), s = target / size.y;
    model.scale.setScalar(s); model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model), ctr = box2.getCenter(new THREE.Vector3());
    const holder = new THREE.Group(); holder.add(model); model.position.set(-ctr.x, -box2.min.y, -ctr.z);
    const rest = new Map(); for (const b of Object.values(bones)) rest.set(b, b.quaternion.clone());
    holder.updateMatrixWorld(true);
    const hipY = bones.hips.getWorldPosition(new THREE.Vector3()).y;
    if (av.body){ av.root.remove(av.body); }
    av.root.scale.setScalar(1); av.root.add(holder);
    av.glb = {holder, model, bones, rest, hipY, morphs, height:target}; av.P = null; av.topY = target + .08;
    avatarStatus[av.who] = 'ok';
  } catch(e){ avatarStatus[av.who] = String(e && e.message || '').includes('skeleton') ? 'bad' : 'none'; }
  if (!$('#charsSheet').hidden) renderChars();
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler();
function limbDir(x1, z1, x2, z2){ // direction of a limb in character space: rotate straight-down by X then Z, nested
  const v = new THREE.Vector3(0, -1, 0);
  if (x2 !== undefined) v.applyEuler(_e.set(x2, 0, z2, 'XYZ'));
  return v.applyEuler(_e.set(x1, 0, z1, 'XYZ'));
}
function aim(bone, child, dirChar, rootQ){
  if (!bone || !child) return;
  const dirW = dirChar.clone().applyQuaternion(rootQ).normalize();
  bone.getWorldPosition(_v1); child.getWorldPosition(_v2); const cur = _v2.sub(_v1).normalize();
  _q1.setFromUnitVectors(cur, dirW);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(_q2));
  bone.updateMatrixWorld(true);
}
function turn(bone, axisChar, angle, rootQ){
  if (!bone || !angle) return;
  const axisW = axisChar.clone().applyQuaternion(rootQ).normalize();
  _q1.setFromAxisAngle(axisW, angle); bone.getWorldQuaternion(_q2); _q2.premultiply(_q1);
  bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(_q2)); bone.updateMatrixWorld(true);
}
const AX = new THREE.Vector3(1,0,0), AY = new THREE.Vector3(0,1,0), AZ = new THREE.Vector3(0,0,1);
function applyGLB(av){
  const g = av.glb, B = g.bones, p = av.pose;
  for (const [b, q] of g.rest) b.quaternion.copy(q);
  g.holder.position.y = p.by; av.root.updateMatrixWorld(true);
  const rootQ = av.root.getWorldQuaternion(new THREE.Quaternion());
  const spine = B.spine || B.spine1;
  turn(spine, AY, p.byaw, rootQ); turn(spine, AX, p.bx, rootQ); turn(spine, AZ, p.bz, rootQ);
  const neck = B.neck || B.head; turn(neck, AY, p.hy, rootQ); turn(neck, AX, p.hx, rootQ); turn(neck, AZ, p.hz, rootQ);
  aim(B.leftupleg, B.leftleg, limbDir(p.hipL, 0), rootQ); aim(B.leftleg, B.leftfoot, limbDir(p.hipL, 0, p.kneeL, 0), rootQ);
  aim(B.rightupleg, B.rightleg, limbDir(p.hipR, 0), rootQ); aim(B.rightleg, B.rightfoot, limbDir(p.hipR, 0, p.kneeR, 0), rootQ);
  const out = .1;
  aim(B.leftarm, B.leftforearm, limbDir(p.shLx, p.shLz + out), rootQ); aim(B.leftforearm, B.lefthand, limbDir(p.shLx, p.shLz + out, p.elLx, p.elLz), rootQ);
  aim(B.rightarm, B.rightforearm, limbDir(p.shRx, p.shRz - out), rootQ); aim(B.rightforearm, B.righthand, limbDir(p.shRx, p.shRz - out, p.elRx, p.elRz), rootQ);
  // face: blink, a soft smile, mouth moves while a bubble is showing
  av.blinkT -= 1/60; const blink = av.blinkT < 0 ? 1 : 0; if (av.blinkT < -.12) av.blinkT = rand(2, 5);
  const talk = av.bubT > 0 ? (Math.sin(av.t*14)*.5 + .5)*.35 : 0;
  for (const m of g.morphs){ const d = m.morphTargetDictionary, inf = m.morphTargetInfluences;
    for (const [k, v] of [['eyeBlinkLeft', blink], ['eyeBlinkRight', blink], ['jawOpen', talk], ['mouthSmileLeft', .22], ['mouthSmileRight', .22]]) if (d[k] !== undefined) inf[d[k]] = v; }
}
function applyBuiltin(av){
  const P = av.P, p = av.pose;
  P.hipL.rotation.x = p.hipL; P.hipR.rotation.x = p.hipR; P.kneeL.rotation.x = p.kneeL; P.kneeR.rotation.x = p.kneeR;
  P.shL.rotation.set(p.shLx, 0, p.shLz); P.shR.rotation.set(p.shRx, 0, p.shRz); P.elL.rotation.set(p.elLx, 0, p.elLz); P.elR.rotation.set(p.elRx, 0, p.elRz);
  P.body.position.y = p.by; P.body.rotation.set(p.bx, p.byaw, p.bz); P.head.rotation.set(p.hx, p.hy, p.hz);
  if (P.skirt){ P.skirt.rotation.y = Math.sin(av.t*2.2)*.04; P.skirt.scale.x = av.action === 'dance' ? 1 + Math.abs(Math.sin(av.t*2.8))*.14 : 1; }
}
function animate(av, dt){
  const moving = av.moving || av.keyMoving; av.keyMoving = false;
  const t = av.t, k = Math.min(1, dt*9), fem = av.who === 'b', T = Object.assign({}, POSE0);
  if (moving){
    av.phase += dt * 8.6; const p = av.phase, sn = Math.sin(p);
    T.hipL = sn*.5; T.hipR = -sn*.5; T.kneeL = Math.max(0, sn)*.8 + .06; T.kneeR = Math.max(0, -sn)*.8 + .06;
    T.shLx = -sn*.38; T.shRx = sn*.38; T.elLx = -.3; T.elRx = -.3; T.by = Math.abs(Math.cos(p))*.025 - .008; T.bx = .03; T.byaw = sn*.07; T.bz = fem ? sn*.03 : 0;
  } else if (av.action === 'sit'){
    T.hipL = T.hipR = -1.5; T.kneeL = T.kneeR = 1.5; T.by = av.glb ? (.47 - av.glb.hipY) : -.45;
    T.shLx = T.shRx = -.5; T.elLx = T.elRx = -.75; T.shLz = .14; T.shRz = -.14; T.hx = .04 + Math.sin(t*1.1)*.02; T.hy = fem ? -.18 : .18;
    if (av.kissUntil > t){ const sd = av.kissSide || 1; T.bz = -sd*.26; T.hz = -sd*.18; T.hy = sd*.55; T.hx = .02; }
  } else if (av.action === 'kiss'){
    T.bx = .09; T.hx = fem ? -.14 : .2; T.hz = .14; T.by = fem ? .02 : -.01;
    if (fem){ T.shLx = T.shRx = -1.15; T.shLz = .55; T.shRz = -.55; T.elLx = T.elRx = -1.15; }
    else { T.shLx = T.shRx = -.6; T.shLz = .32; T.shRz = -.32; T.elLx = T.elRx = -.55; }
    if (t - av.actionT > 2.8){ av.action = 'idle'; av.lookAt = null; }
  } else if (av.action === 'dance'){
    const b = t*5.6; T.by = Math.abs(Math.sin(b))*.05; T.bz = Math.sin(b/2)*.1; T.byaw = Math.sin(t*1.5)*.45;
    T.kneeL = .18 + Math.max(0,Math.sin(b))*.3; T.kneeR = .18 + Math.max(0,-Math.sin(b))*.3; T.hipL = -T.kneeL*.5; T.hipR = -T.kneeR*.5;
    if (fem){ T.shLz = 2.3 + Math.sin(b/2)*.3; T.shRz = -2.3 + Math.sin(b/2)*.3; T.elLz = .5; T.elRz = -.5; T.hy = Math.sin(b/2)*.2; T.hz = Math.sin(b/2)*.08; }
    else { T.shLx = -1.1 + Math.sin(b)*.45; T.shRx = -1.1 - Math.sin(b)*.45; T.elLx = -1.4; T.elRx = -1.4; T.shLz = .35; T.shRz = -.35; T.hx = Math.sin(b)*.07; }
  } else if (av.action === 'wave'){
    T.shRz = -2.6; T.elRz = Math.sin(t*10)*.4 - .2; T.hy = .1; T.hz = .05; if (t - av.actionT > 2.4) av.action = 'idle';
  } else {
    T.by = Math.sin(t*1.7)*.004; T.shLz = .07 + Math.sin(t*1.7)*.01; T.shRz = -T.shLz; T.hy = Math.sin(t*.37)*.14; T.hx = Math.sin(t*.23)*.04; T.hz = fem ? Math.sin(t*.3)*.05 : 0;
    if (fem){ T.hipL = -.04; T.hipR = .06; T.kneeR = .12; T.bz = .02; }
  }
  for (const key in T) av.pose[key] += (T[key] - av.pose[key]) * k;
  if (av.glb) applyGLB(av); else if (av.P) applyBuiltin(av);
}

/* ================= movement ================= */
const RAD = .26;
function resolve(p){
  for (const c of colliders){
    const nx = Math.max(c.minX, Math.min(p.x, c.maxX)), nz = Math.max(c.minZ, Math.min(p.z, c.maxZ)), dx = p.x - nx, dz = p.z - nz, d2 = dx*dx + dz*dz;
    if (d2 < RAD*RAD){
      if (d2 > 1e-8){ const d = Math.sqrt(d2); p.x += dx/d*(RAD - d); p.z += dz/d*(RAD - d); }
      else { const l = p.x - c.minX, r = c.maxX - p.x, b = p.z - c.minZ, t = c.maxZ - p.z, m = Math.min(l,r,b,t);
        if (m===l) p.x = c.minX - RAD; else if (m===r) p.x = c.maxX + RAD; else if (m===b) p.z = c.minZ - RAD; else p.z = c.maxZ + RAD; }
    }
  }
  p.x = Math.max(-RW+.4, Math.min(RW-.4, p.x)); p.z = Math.max(-RD+.4, Math.min(RD-.4, p.z));
}
function faceTo(av, ry, dt, k=10){ let d = ry - av.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); av.root.rotation.y += d * Math.min(1, dt*k); }
function walkTo(av, pos, onArrive){ if (av.action === 'sit' || av.action === 'dance') av.action = 'idle'; av.seat = null; av._slide = null;
  av.target = pos.clone(); av.target.y = 0; av.onArrive = onArrive || null; av.stuck = 0; av.lastDist = 1e9; }
const SPEED = 1.9;
function stepAvatar(av, dt){
  av.t += dt;
  if (av._slide){ av._slide(dt); animate(av, dt); return; }
  let moving = false;
  if (av.target){
    const p = av.root.position, dx = av.target.x - p.x, dz = av.target.z - p.z, d = Math.hypot(dx, dz);
    if (d < .07){ av.target = null; const cb = av.onArrive; av.onArrive = null; cb && cb(); }
    else { const sp = Math.min(SPEED, d*4 + .35) * dt, np = p.clone(); np.x += dx/d*sp; np.z += dz/d*sp; resolve(np);
      moving = Math.hypot(np.x-p.x, np.z-p.z) > .0015; p.copy(np); faceTo(av, Math.atan2(dx, dz), dt);
      if (d > av.lastDist - .003) av.stuck += dt; else av.stuck = Math.max(0, av.stuck - dt*2);
      av.lastDist = d; if (av.stuck > 1.2){
        av.target = null; av.stuck = 0; const cb = av.onArrive; av.onArrive = null;
        if (av._goingToSit && cb) cb(); else av._goingToSit = false; } }
  }
  av.moving = moving; if (!moving && av.lookAt != null) faceTo(av, av.lookAt, dt, 6);
  animate(av, dt);
}

/* ================= people ================= */
let myRole = 'a';
const me = () => avatars[myRole], other = () => avatars[myRole === 'a' ? 'b' : 'a'];
makeAvatar('a', .5, 8.9, Math.PI); makeAvatar('b', -.4, 8.9, Math.PI);
const keys = {};
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === '1') doWave(); else if (k === '2') doDance(); else if (k === '3') doSit(); else if (k === '4') doLove(true); else if (k === '5') doKiss(); else if (k === 'escape') closeAll();
  keys[k] = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function keyMove(dt){
  let f = 0, s = 0;
  if (keys.w || keys.arrowup) f += 1; if (keys.s || keys.arrowdown) f -= 1; if (keys.a || keys.arrowleft) s -= 1; if (keys.d || keys.arrowright) s += 1;
  if (!f && !s) return;
  const av = me(); if (av.action === 'sit' || av.action === 'dance') av.action = 'idle';
  av.target = null; av.onArrive = null; av.seat = null; av.lookAt = null; av._slide = null; av._goingToSit = false; av._kissing = false; if (av.action === 'kiss') av.action = 'idle';
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); let mx = fx*f - fz*s, mz = fz*f + fx*s; const l = Math.hypot(mx, mz); mx /= l; mz /= l;
  const p = av.root.position.clone(); p.x += mx*SPEED*dt; p.z += mz*SPEED*dt; resolve(p); av.root.position.copy(p); faceTo(av, Math.atan2(mx, mz), dt); av.keyMoving = true;
}
function sitDown(av, bi, idx){ const s = benches[bi].seats[idx]; av.root.position.copy(s.pos); av.root.rotation.y = s.ry; av.lookAt = s.ry; av.action = 'sit'; av.seat = {bench:bi, idx}; av._goingToSit = false; setAct(); }
function slideTo(av, tgt, cb){ const start = av.root.position.clone(); let u = 0; av.target = null;
  av._slide = dt => { u = Math.min(1, u + dt*2); av.root.position.lerpVectors(start, tgt, u); av.moving = u < 1; if (u >= 1){ av._slide = null; cb && cb(); } }; }
function goSitAt(av, bi, i){ if (av.action === 'sit') av.action = 'idle'; av._goingToSit = true; av.lookAt = null;
  const b = benches[bi], seat = b.seats[i].pos;
  // approach from whichever side of the bench is closer, then slide onto the seat
  const front = seat.clone().addScaledVector(b.fwd, .55), back = seat.clone().addScaledVector(b.fwd, -.6);
  const near = av.root.position.distanceTo(front) <= av.root.position.distanceTo(back) ? front : back;
  walkTo(av, near, () => slideTo(av, seat, () => sitDown(av, bi, i))); av._goingToSit = true; }
function goSit(bi){
  const b = benches[bi], m = me(), o = other();
  const idx = m.root.position.distanceTo(b.seats[0].pos) < m.root.position.distanceTo(b.seats[1].pos) ? 0 : 1;
  goSitAt(m, bi, idx);
  if (!partnerOnline()) goSitAt(o, bi, 1 - idx);
}
function doSit(){ const m = me(); if (m.action === 'sit'){ standUp(); return; }
  let bi = 0, best = 1e9; benches.forEach((b,i)=>{ const d = b.center.distanceTo(m.root.position); if (d < best){ best = d; bi = i; } }); goSit(bi); }
function standUp(){ for (const av of [me(), partnerOnline() ? null : other()]){ if (!av) continue; av._goingToSit = false;
  if (av.action === 'sit'){ av.action = 'idle'; const b = benches[av.seat?.bench]; if (b) av.root.position.addScaledVector(b.fwd, .6); av.seat = null; } } setAct(); }
function doDance(){ const m = me(); if (m.action === 'dance'){ m.action = 'idle'; if (!partnerOnline()) other().action = 'idle'; setAct(); return; }
  if (m.action === 'sit') standUp(); m.target = null; m.action = 'dance'; m.lookAt = null; setAct(); }
let waveAt = 0;
function doWave(){ const m = me(); if (m.action === 'sit') standUp(); m.action = 'wave'; m.actionT = m.t; waveAt = Date.now();
  if (!partnerOnline()){ const p = other(); setTimeout(() => { if (p.action === 'idle'){ p.action = 'wave'; p.actionT = p.t; } }, 450); } }
function setAct(){ $('#aDance').classList.toggle('on', me().action === 'dance'); $('#aSit').classList.toggle('on', me().action === 'sit'); }
const heartTex = tex(128, 128, g=>{ g.fillStyle = '#ff5f7e'; g.beginPath(); g.moveTo(64,112); g.bezierCurveTo(10,72,4,34,34,22); g.bezierCurveTo(52,15,62,28,64,38); g.bezierCurveTo(66,28,76,15,94,22); g.bezierCurveTo(124,34,118,72,64,112); g.fill(); });
const hearts = []; let loveAt = 0, loveHold = 0;
function doLove(mine){
  if (mine) loveAt = Date.now();
  const A = avatars.a, Bv = avatars.b, mid = A.root.position.clone().add(Bv.root.position).multiplyScalar(.5);
  for (let i=0;i<16;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map:heartTex, transparent:true, depthWrite:false}));
    s.position.set(mid.x + rand(-.6,.6), 1.5 + Math.random()*.4, mid.z + rand(-.6,.6)); s.scale.setScalar(rand(.08,.18));
    s.userData = {vy:rand(.4,.9), life:0, max:rand(1.8,3), sway:Math.random()*TAU}; scene.add(s); hearts.push(s); }
  const m = me(); if (m.action !== 'sit'){ m.lookAt = Math.atan2(other().root.position.x - m.root.position.x, other().root.position.z - m.root.position.z); loveHold = 2.5; }
  if (!partnerOnline()){ const o = other(); if (o.action !== 'sit') o.lookAt = Math.atan2(m.root.position.x - o.root.position.x, m.root.position.z - o.root.position.z); }
}
let kissAt = 0;
function doKiss(){
  const m = me(), o = other();
  if (m.action === 'sit' || o.action === 'sit'){ beginKiss(true); return; }
  if (m.action === 'dance' || m.action === 'wave') m.action = 'idle';
  const d = m.root.position.distanceTo(o.root.position);
  if (d > .5){
    const dir = m.root.position.clone().sub(o.root.position).setY(0); if (dir.lengthSq() < 1e-4) dir.set(0,0,1); dir.normalize();
    const spot = o.root.position.clone().addScaledVector(dir, .42);
    m.lookAt = null; m._kissing = true; walkTo(m, spot, () => { m._kissing = false; beginKiss(true); });
  } else beginKiss(true);
}
function beginKiss(mine){
  const A = avatars.a, B = avatars.b;
  for (const [x, y] of [[A, B], [B, A]]){
    const remoteDriven = x === other() && partnerOnline();
    if (x.action === 'sit'){
      const ry = x.root.rotation.y, rel = y.root.position.clone().sub(x.root.position);
      x.kissSide = Math.sign(rel.x*Math.cos(ry) - rel.z*Math.sin(ry)) || 1; x.kissUntil = x.t + 2.8;
    } else {
      if (!remoteDriven) x.target = null;
      x.lookAt = Math.atan2(y.root.position.x - x.root.position.x, y.root.position.z - x.root.position.z);
      x.action = 'kiss'; x.actionT = x.t;
    }
  }
  if (mine){ kissAt = Date.now(); sendPresence(true); }
  setTimeout(() => { burstHearts(); }, 600); setAct();
}
function burstHearts(){
  const mid = avatars.a.root.position.clone().add(avatars.b.root.position).multiplyScalar(.5);
  for (let i=0;i<20;i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map:heartTex, transparent:true, depthWrite:false}));
    s.position.set(mid.x + rand(-.35,.35), 1.55 + Math.random()*.25, mid.z + rand(-.35,.35)); s.scale.setScalar(rand(.07,.16));
    s.userData = {vy:rand(.35,.8), life:0, max:rand(2,3.2), sway:Math.random()*TAU}; scene.add(s); hearts.push(s); }
}
function stepHearts(dt){ for (let i=hearts.length-1;i>=0;i--){ const h = hearts[i], u = h.userData; u.life += dt; h.position.y += u.vy*dt; h.position.x += Math.sin(u.life*3 + u.sway)*dt*.2;
  h.material.opacity = Math.max(0, 1 - u.life/u.max); if (u.life > u.max){ scene.remove(h); h.material.dispose(); hearts.splice(i,1); } } }
function say(av, text){ av.bub.textContent = text; av.bub.classList.add('show'); av.bubT = Math.max(3.5, Math.min(9, text.length*.09)); }

/* partner: follows you when they're away, mirrors their real moves when they're online */
let followIdle = 0, lastRemoteWave = 0, lastRemoteLove = 0, lastRemoteKiss = 0;
function partnerOnline(){ const r = other().remote; return !!(r && r.online); }
function driveRemote(av, dt){
  const r = av.remote;
  if (r.wave && r.wave !== lastRemoteWave){ lastRemoteWave = r.wave; if (Date.now() - r.wave < 8000){ av.action = 'wave'; av.actionT = av.t; } }
  if (r.love && r.love !== lastRemoteLove){ lastRemoteLove = r.love; if (Date.now() - r.love < 8000) doLove(false); }
  if (r.kiss && r.kiss !== lastRemoteKiss){ lastRemoteKiss = r.kiss; if (Date.now() - r.kiss < 8000) beginKiss(false); }
  if (r.act === 'sit' && r.seat){ if (av.action !== 'sit' || av.seat?.bench !== r.seat[0] || av.seat?.idx !== r.seat[1]) sitDown(av, r.seat[0], r.seat[1]); return; }
  if (av.action === 'sit'){ av.action = 'idle'; av.seat = null; }
  const tgt = new THREE.Vector3(r.x, 0, r.z), d = av.root.position.distanceTo(tgt);
  if (d > 4){ av.root.position.copy(tgt); av.target = null; }
  else if (d > .1){ if (!av.target || av.target.distanceTo(tgt) > .05) walkTo(av, tgt); }
  else { av.target = null; av.lookAt = r.ry; }
  if (r.act === 'dance'){ if (!av.target) av.action = 'dance'; } else if (av.action === 'dance') av.action = 'idle';
  if (av.action === 'kiss' && av.target) av.target = null;
}
function partnerThink(dt){
  const pa = other(), le = me();
  if (pa.remote && pa.remote.online){ driveRemote(pa, dt); return; }
  if (pa.action === 'sit' && le.action === 'sit') return;
  if (le.action === 'sit' || le._goingToSit || pa._goingToSit) return;
  if (le.action === 'kiss' || pa.action === 'kiss' || le._kissing) return;
  if (pa.action === 'sit'){ pa.action = 'idle'; const b = benches[pa.seat?.bench]; if (b) pa.root.position.addScaledVector(b.fwd, .6); pa.seat = null; }
  if (pa._slide) return;
  const ry = le.root.rotation.y, right = new THREE.Vector3(-Math.cos(ry), 0, Math.sin(ry)), side = pa.who === 'b' ? 1 : -1;
  const want = le.root.position.clone().addScaledVector(right, side*.62); resolve(want);
  const d = pa.root.position.distanceTo(want);
  if (le.action === 'dance'){ if (d > 1.4 && !pa.target) walkTo(pa, want); else if (!pa.target && pa.action !== 'dance') pa.action = 'dance'; return; }
  if (pa.action === 'dance') pa.action = 'idle';
  if (d > 7 && !pa.target){ followIdle += dt; if (followIdle > 2){ pa.root.position.copy(want); followIdle = 0; } } else followIdle = 0;
  if (d > .5 && (!pa.target || pa.target.distanceTo(want) > .35)) walkTo(pa, want);
  if (!pa.target) pa.lookAt = (le.lookAt != null && !le.moving) ? le.lookAt : ry;
}

/* ================= camera & input ================= */
const cam = {yaw:0, pitch:.3, dist:4.4, target:new THREE.Vector3()};
const ray = new THREE.Raycaster();
function updateCamera(dt){
  const le = me(), tgt = le.root.position.clone(); tgt.y = (le.action === 'sit' ? .65 : .82) * le.topY;
  cam.target.lerp(tgt, Math.min(1, dt*6));
  const cp = Math.cos(cam.pitch), dir = new THREE.Vector3(Math.sin(cam.yaw)*cp, Math.sin(cam.pitch), Math.cos(cam.yaw)*cp);
  let dist = cam.dist; ray.set(cam.target, dir); ray.far = dist;
  const hit = ray.intersectObjects(camBlockers, false)[0]; if (hit) dist = Math.max(.5, hit.distance - .2);
  const pos = cam.target.clone().addScaledVector(dir, dist); pos.y = Math.min(pos.y, RH - .4);
  camera.position.copy(pos); camera.lookAt(cam.target);
}
let down = null; const pointers = new Map(); let pinch0 = 0;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2){ const [a,b] = [...pointers.values()]; pinch0 = Math.hypot(a.x-b.x, a.y-b.y); down = null; return; } down = {moved:0}; });
canvas.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2){ const [a,b] = [...pointers.values()], d = Math.hypot(a.x-b.x, a.y-b.y); if (pinch0) cam.dist = Math.max(.9, Math.min(10, cam.dist * pinch0 / d)); pinch0 = d; return; }
  if (!down) return; const dx = e.clientX - prev.x, dy = e.clientY - prev.y; down.moved += Math.abs(dx) + Math.abs(dy);
  if (down.moved > 6){ cam.yaw -= dx*.006; cam.pitch = Math.max(-.15, Math.min(1.25, cam.pitch + dy*.004)); } });
const endPtr = e => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; if (down && down.moved <= 6 && e.type === 'pointerup') handleClick(e.clientX, e.clientY); down = null; };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(.9, Math.min(10, cam.dist * (1 + Math.sign(e.deltaY)*.1))); }, {passive:false});
const ndc = new THREE.Vector2();
function handleClick(x, y){
  const r = canvas.getBoundingClientRect(); ndc.set(((x - r.left)/r.width)*2 - 1, -((y - r.top)/r.height)*2 + 1);
  ray.setFromCamera(ndc, camera); ray.far = 80;
  const hit = ray.intersectObjects(pickables, false)[0]; if (!hit) return;
  const u = hit.object.userData;
  if (u.frameId){ openFrame(u.frameId, true); return; }
  if (u.bench != null){ goSit(u.bench); return; }
  if (u.floor){ const le = me(); le._kissing = false; if (le.action === 'kiss') le.action = 'idle'; if (le.action === 'sit') standUp(); le._goingToSit = false; other()._goingToSit = false; le.lookAt = null;
    const p = hit.point.clone(); resolve(p); walkTo(le, p); setAct(); ring.position.set(p.x, .012, p.z); ringT = 0; }
}
const ringMat = new THREE.MeshBasicMaterial({color:'#f2d58f', transparent:true, opacity:0, depthWrite:false});
const ring = new THREE.Mesh(new THREE.RingGeometry(.15, .19, 32), ringMat); ring.rotation.x = -Math.PI/2; scene.add(ring); let ringT = 9;

/* ================= data: Firebase (or this computer in demo mode) ================= */
let fb = null;
const LS = { get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } } };
async function loadFirebase(){
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [app, auth, db] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js')]);
  const a = app.initializeApp(C.firebase);
  fb = { auth: auth.getAuth(a), A: auth, db: db.getDatabase(a), D: db };
  fb.ref = p => db.ref(fb.db, p);
}
function dbSet(path, val){ if (fb) return fb.D.set(fb.ref(path), val); }
function dbUpdate(path, val){ if (fb) return fb.D.update(fb.ref(path), val); }
function saveLocal(){ if (!fb){ LS.set('museum-state', state); } }
async function getPhoto(id){
  if (photoCache[id]) return photoCache[id];
  if (!fb){ const all = LS.get('museum-photos', {}); return photoCache[id] = all[id] || null; }
  try { const snap = await fb.D.get(fb.ref('photos/' + id)); return photoCache[id] = snap.val(); } catch(e){ return null; }
}
async function putPhoto(id, dataURL){
  photoCache[id] = dataURL;
  if (fb) return fb.D.set(fb.ref('photos/' + id), dataURL);
  const all = LS.get('museum-photos', {}); all[id] = dataURL; if (!LS.set('museum-photos', all)) toast('Shown now, but this browser is out of room to keep it.');
}
function dropPhoto(id){ if (!id) return; delete photoCache[id];
  if (fb) fb.D.remove(fb.ref('photos/' + id)).catch(()=>{}); else { const all = LS.get('museum-photos', {}); delete all[id]; LS.set('museum-photos', all); } }
function saveFrame(id){ if (fb) dbSet('state/frames/' + id, state.frames[id] || null)?.catch(saveErr); else saveLocal(); }
function saveAvatarCfg(who){ if (fb) dbSet('state/avatars/' + who, state.avatars[who] || null)?.catch(saveErr); else saveLocal(); }
function saveErr(){ toast('Couldn\'t save that change. Check your internet and try again.'); }
function newId(){ return fb ? fb.D.push(fb.ref('photos')).key : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function applyIncomingState(val){
  val = val || {};
  state.frames = val.frames || {}; state.avatars = val.avatars || {}; state.decoInit = !!val.decoInit;
  if (!state.decoInit){
    state.decoInit = true; const upd = {decoInit:true};
    for (const [id, d] of Object.entries(DEFAULT_DECO)){ state.frames[id] = Object.assign({deco:d}, state.frames[id] || {}); upd['frames/' + id + '/deco'] = state.frames[id].deco; }
    if (fb) dbUpdate('state', upd); else saveLocal();
  }
  frames.forEach(applyFrame); Object.values(avatars).forEach(av => { av.cfg = av.glb ? av.cfg : av.cfg; rebuildBuiltin(av); });
  if (!$('#photosSheet').hidden) renderPhotos(); if (openFrameId) renderFrameSheet(); if (!$('#charsSheet').hidden) renderChars();
}

/* chat */
const chat = []; let unread = 0, chatReady = false;
function onMessage(m){
  if (!m || typeof m.text !== 'string') return;
  chat.push(m); renderMessage(m);
  const fresh = chatReady || (m.at && Date.now() - m.at < 15000);
  if (fresh && avatars[m.who]) say(avatars[m.who], m.text);
  if (chatReady && m.who !== myRole && $('#chatSheet').hidden){ unread++; updateBadge(); }
}
function sendChat(text){
  text = text.trim().slice(0, 500); if (!text) return;
  const m = {who: myRole, text, at: Date.now()};
  if (fb){ fb.D.push(fb.ref('chat'), {who: myRole, text, at: fb.D.serverTimestamp()}).catch(() => toast('Message didn\'t send. Check your internet.')); }
  else { onMessage(m); const saved = LS.get('museum-chat', []); saved.push(m); LS.set('museum-chat', saved.slice(-150)); }
}
function renderMessage(m){
  $('#chatEmpty').hidden = true;
  const d = document.createElement('div'); d.className = 'msg ' + (m.who === myRole ? 'mine' : 'theirs'); d.textContent = m.text;
  const s = document.createElement('small'); const when = m.at ? new Date(m.at) : new Date();
  s.textContent = (m.who === myRole ? 'You' : nameOf(m.who)) + ' · ' + when.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); d.append(s);
  const list = $('#chatList'); list.append(d); list.scrollTop = list.scrollHeight;
}
function updateBadge(){ const b = $('#chatBadge'); b.hidden = !unread; b.textContent = unread > 9 ? '9+' : unread; }

/* presence: where I am, so the other person sees me move */
let lastSent = '', lastSentAt = 0;
function sendPresence(force){
  if (!fb) return;
  const m = me(), now = performance.now(); if (!force && now - lastSentAt < 160) return;
  const p = {x:+m.root.position.x.toFixed(2), z:+m.root.position.z.toFixed(2), ry:+m.root.rotation.y.toFixed(2), act: (m.action === 'wave' || m.action === 'kiss') ? 'idle' : m.action, seat: m.action === 'sit' && m.seat ? [m.seat.bench, m.seat.idx] : null, wave: waveAt, love: loveAt, kiss: kissAt, online: true};
  const key = JSON.stringify(p); if (!force && key === lastSent) return;
  lastSent = key; lastSentAt = now; p.at = fb.D.serverTimestamp(); fb.D.set(fb.ref('presence/' + myRole), p).catch(()=>{});
}
function updatePartnerLine(){
  const on = partnerOnline(), o = myRole === 'a' ? 'b' : 'a';
  $('#partnerDot').classList.toggle('on', on); other().tag.classList.toggle('on', on); me().tag.classList.add('on');
  $('#partnerLine').textContent = DEMO ? 'Demo mode' : on ? nameOf(o) + ' is here' : nameOf(o) + ' is away';
}

async function startSync(){
  if (!fb){
    applyIncomingState(LS.get('museum-state', null));
    LS.get('museum-chat', []).forEach(onMessage); chatReady = true; updatePartnerLine(); return;
  }
  const D = fb.D, o = myRole === 'a' ? 'b' : 'a';
  D.onValue(fb.ref('state'), snap => applyIncomingState(snap.val()), () => toast('Couldn\'t load the museum. Check the database rules in README.md.'));
  D.onChildAdded(D.query(fb.ref('chat'), D.orderByChild('at'), D.limitToLast(150)), snap => onMessage(snap.val()));
  setTimeout(() => { chatReady = true; }, 2500);
  D.onValue(fb.ref('presence/' + o), snap => {
    const was = partnerOnline(); const v = snap.val();
    other().remote = v && v.online ? v : null;
    if (!was && partnerOnline()) toast(nameOf(o) + ' just came in');
    updatePartnerLine();
  });
  D.onValue(fb.ref('.info/connected'), snap => {
    if (snap.val() === true){ D.onDisconnect(fb.ref('presence/' + myRole)).update({online:false}); sendPresence(true); }
  });
  updatePartnerLine();
}

/* ================= login & title ================= */
function showEnter(){
  $('#loginForm').hidden = true; $('#enterBox').hidden = false;
  $('#welcomeLine').textContent = DEMO ? 'You can try everything here. Nothing is shared until Firebase is connected.' : 'Signed in as ' + nameOf(myRole) + '.';
}
async function boot(){
  drawNames();
  if (DEMO){ $('#demoNote').hidden = false; $('#aSwitch').hidden = false; myRole = 'a'; showEnter(); startSync(); return; }
  try { await loadFirebase(); }
  catch(e){ $('#loginForm').hidden = false; $('#loginErr').textContent = 'Couldn\'t reach Firebase. Check your internet and the settings in config.js.'; return; }
  $('#signOutBtn').hidden = false;
  fb.A.onAuthStateChanged(fb.auth, async user => {
    if (!user){ $('#enterBox').hidden = true; $('#loginForm').hidden = false; return; }
    const email = (user.email || '').toLowerCase();
    const role = ['a','b'].find(r => (PEOPLE[r].email || '').toLowerCase() === email);
    if (!role){ $('#loginErr').textContent = 'This account isn\'t on the guest list. Its email must match one in config.js.'; await fb.A.signOut(fb.auth); return; }
    myRole = role; cam.yaw = 0;
    const m = me(); m.root.position.set(role === 'a' ? .5 : -.4, 0, 8.9);
    showEnter(); startSync();
  });
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const btn = $('#loginBtn'); btn.disabled = true; $('#loginErr').textContent = '';
  try { await fb.A.signInWithEmailAndPassword(fb.auth, $('#email').value.trim(), $('#password').value); }
  catch(err){ const c = err && err.code || '';
    $('#loginErr').textContent = c.includes('invalid') || c.includes('wrong-password') || c.includes('user-not-found') ? 'That email or password isn\'t right.' : c.includes('too-many') ? 'Too many tries. Wait a minute and try again.' : 'Couldn\'t sign in. Check your internet and try again.'; }
  finally { btn.disabled = false; }
});
$('#forgotBtn').addEventListener('click', async () => {
  const email = $('#email').value.trim(); if (!email){ $('#loginErr').textContent = 'Type your email first, then tap Forgot password.'; return; }
  try { await fb.A.sendPasswordResetEmail(fb.auth, email); $('#loginErr').textContent = 'Check your email for a link to reset your password.'; }
  catch(e){ $('#loginErr').textContent = 'Couldn\'t send the reset email. Check the address.'; }
});
$('#signOutBtn').addEventListener('click', async () => { if (fb){ await dbUpdate('presence/' + myRole, {online:false}); await fb.A.signOut(fb.auth); location.reload(); } });
$('#startBtn').addEventListener('click', () => { $('#title').classList.add('gone'); canvas.focus();
  if (DEMO){ setTimeout(() => say(avatars.b, 'Wait… is this for me?'), 900); setTimeout(() => say(avatars.a, 'Welcome to our museum'), 3600); } });
$('#aSwitch').addEventListener('click', () => { myRole = myRole === 'a' ? 'b' : 'a'; toast('You are now ' + nameOf(myRole)); updatePartnerLine(); setAct(); });

/* ================= UI ================= */
const sheets = ['#frameSheet','#photosSheet','#charsSheet','#help','#chatSheet'];
function closeAll(except){ sheets.forEach(s => { if (s !== except) $(s).hidden = true; }); if (except !== '#frameSheet') openFrameId = null; $('#lightbox').hidden = true; }
function toggleSheet(sel, render){ const open = $(sel).hidden; closeAll(sel); $(sel).hidden = !open; if (open && render) render(); }
$('#photosBtn').addEventListener('click', () => toggleSheet('#photosSheet', renderPhotos));
$('#charsBtn').addEventListener('click', () => toggleSheet('#charsSheet', renderChars));
$('#helpBtn').addEventListener('click', () => toggleSheet('#help'));
$('#chatBtn').addEventListener('click', () => toggleSheet('#chatSheet', () => { unread = 0; updateBadge(); const l = $('#chatList'); l.scrollTop = l.scrollHeight; setTimeout(() => $('#chatIn').focus(), 50); }));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeAll()));
$('#aWave').onclick = doWave; $('#aDance').onclick = doDance; $('#aSit').onclick = doSit; $('#aLove').onclick = () => doLove(true); $('#aKiss').onclick = doKiss;
$('#sayForm').addEventListener('submit', e => { e.preventDefault(); sendChat($('#sayIn').value); $('#sayIn').value = ''; });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat($('#chatIn').value); $('#chatIn').value = ''; });
$('#snapBtn').addEventListener('click', () => { renderer.render(scene, camera);
  const a = document.createElement('a'); a.download = 'our-museum.png'; a.href = canvas.toDataURL('image/png'); document.body.append(a); a.click(); a.remove(); toast('Picture saved to your downloads'); });
let toastT = 0;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 3400); }

let openFrameId = null;
function frameLabel(f){ return f.id === 'big' ? 'The grand painting' : f.wall + ', frame ' + (FRAME_ROOMS[f.wall].indexOf(f.id) + 1); }
function openFrame(id, walk){
  const f = frames.get(id); if (!f) return;
  closeAll('#frameSheet'); openFrameId = id; $('#frameSheet').hidden = false; renderFrameSheet();
  if (walk){ const le = me(); if (le.action === 'sit') standUp(); le._goingToSit = false; other()._goingToSit = false;
    const spot = f.pos.clone().addScaledVector(f.normal, id === 'big' ? 4.4 : 2.4); resolve(spot);
    const look = Math.atan2(-f.normal.x, -f.normal.z); le.lookAt = null; walkTo(le, spot, () => { le.lookAt = look; }); }
}
const DECOS = [['none','None'],['roses','Rose corners'],['garland','Rose garland'],['hearts','Gold hearts']];
function renderFrameSheet(){
  const f = frames.get(openFrameId); if (!f) return;
  const data = state.frames[f.id] || {}, url = data.photo ? photoCache[data.photo] : null;
  $('#fsTitle').textContent = frameLabel(f);
  const pv = $('#fsPreview'); pv.textContent = '';
  if (url){ const img = new Image(); img.src = url; img.alt = data.caption || 'Photo in this frame'; pv.append(img); }
  else { const d = document.createElement('div'); d.className = 'empty'; d.textContent = data.photo ? 'Loading photo…' : 'This frame is empty. Add a photo and the frame resizes to fit it.'; pv.append(d); }
  $('#fsAdd').textContent = data.photo ? 'Replace photo' : 'Add photo';
  $('#fsRemove').hidden = !data.photo; resetRemove(); $('#fsView').hidden = !url; $('#fsCapWrap').hidden = !data.photo;
  $('#fsBy').textContent = data.photo && data.by ? 'Added by ' + (data.by === myRole ? 'you' : nameOf(data.by)) : '';
  const dw = $('#fsDeco'); dw.textContent = '';
  DECOS.forEach(([v, l]) => { const b = document.createElement('button'); b.textContent = l; if ((data.deco || 'none') === v) b.classList.add('on');
    b.onclick = () => { state.frames[f.id] = Object.assign({}, state.frames[f.id] || {}, {deco:v}); buildDeco(f, false); saveFrame(f.id); renderFrameSheet(); }; dw.append(b); });
  if (document.activeElement !== $('#fsCaption')) $('#fsCaption').value = data.caption || '';
}
$('#fsClose').onclick = () => closeAll();
$('#fsAdd').onclick = () => { $('#fileIn').value = ''; $('#fileIn').click(); };
$('#fileIn').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file || !openFrameId) return;
  const id = openFrameId; $('#fsAdd').disabled = true; $('#fsAdd').textContent = 'Adding…';
  try {
    let url = await resizeImage(file, 1400, .82); if (url.length > 1300000) url = await resizeImage(file, 1100, .72);
    const pid = newId(), old = state.frames[id]?.photo;
    await putPhoto(pid, url);
    state.frames[id] = Object.assign({}, state.frames[id] || {}, {photo:pid, by:myRole}); saveFrame(id); dropPhoto(old);
    applyFrame(frames.get(id)); renderFrameSheet(); if (!$('#photosSheet').hidden) renderPhotos(); toast('Photo hung on the wall');
  } catch(err){ toast(err && err.message === 'type' ? 'That file isn\'t a photo. Use a JPG or PNG.' : 'Couldn\'t add that photo. Check your internet and try again.'); }
  finally { $('#fsAdd').disabled = false; renderFrameSheet(); }
});
let removeArm = 0;
function resetRemove(){ const b = $('#fsRemove'); b.classList.remove('confirm'); b.textContent = 'Remove'; clearTimeout(removeArm); }
$('#fsRemove').onclick = () => { const b = $('#fsRemove');
  if (!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent = 'Tap again to remove'; removeArm = setTimeout(resetRemove, 3500); return; }
  const id = openFrameId, fr = state.frames[id]; if (!fr) return; const old = fr.photo; delete fr.photo; delete fr.caption; delete fr.by;
  saveFrame(id); dropPhoto(old); applyFrame(frames.get(id)); renderFrameSheet(); if (!$('#photosSheet').hidden) renderPhotos(); toast('Photo taken down'); };
let capT = 0;
$('#fsCaption').addEventListener('input', e => { const id = openFrameId; if (!id || !state.frames[id]) return; state.frames[id].caption = e.target.value;
  clearTimeout(capT); capT = setTimeout(() => { drawPlaque(frames.get(id)); saveFrame(id); }, 600); });
$('#fsView').onclick = () => { const d = state.frames[openFrameId]; const url = d && photoCache[d.photo]; if (!url) return;
  $('#lbImg').src = url; $('#lbImg').alt = d.caption || 'Photo'; $('#lbCap').textContent = d.caption || ''; $('#lightbox').hidden = false; };
$('#lbClose').onclick = () => { $('#lightbox').hidden = true; };
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') $('#lightbox').hidden = true; });
function resizeImage(file, max, q){
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), img = new Image();
    img.onload = () => { let w = img.naturalWidth, h = img.naturalHeight; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w*s); h = Math.round(h*s);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,w,h); g.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(u);
      res(c.toDataURL('image/jpeg', q)); };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('type')); }; img.src = u; });
}
function renderPhotos(){
  const wrap = $('#photoGroups'); wrap.textContent = ''; let filled = 0;
  Object.entries(FRAME_ROOMS).forEach(([wall, ids]) => {
    const g = document.createElement('div'); g.style.cssText = 'display:grid;gap:8px';
    const l = document.createElement('div'); l.className = 'label'; l.textContent = wall; g.append(l);
    const grid = document.createElement('div'); grid.className = 'grid';
    ids.forEach(id => { const f = frames.get(id), d = state.frames[id] || {}, url = d.photo ? photoCache[d.photo] : null; if (d.photo) filled++;
      const b = document.createElement('button'); b.className = 'slot' + (f.maxW > f.maxH ? ' wide' : '') + (d.photo ? ' filled' : '');
      b.setAttribute('aria-label', frameLabel(f) + (d.photo ? ', has a photo' : ', empty'));
      if (url) b.style.backgroundImage = 'url("' + url + '")'; else b.append(d.photo ? '…' : '+');
      if (d.deco && d.deco !== 'none'){ const dot = document.createElement('span'); dot.className = 'flw'; b.append(dot); }
      b.onclick = () => openFrame(id, true); grid.append(b); });
    g.append(grid); wrap.append(g);
  });
  $('#photoCount').textContent = filled + ' of ' + frames.size + ' frames have photos.';
}

/* characters */
const SKINS = ['#f2d0b6','#efc6a6','#d9a77f','#c4906a','#a8754f','#86583a','#5f3d27'], HAIRS = ['#0b0909','#2b1b13','#3a2416','#5a3820','#87562f','#b8864c','#dcc08a','#7a2c25'];
const EYES = ['#2e1d13','#3a2416','#6b4a2a','#2c5a86','#4b7448'], LIPS = ['#c4858a','#b5646c','#d48d92','#a03f4d','#c98480'];
const CLOTH = ['#141414','#f3efe8','#2a3c5c','#6e1f2e','#9c2f45','#c46f7b','#ebbcb6','#4a3630','#a8946f','#3e5a45','#6b5a8e','#d9c27a'];
let editWho = 'a';
$('#charTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; editWho = b.dataset.who;
  document.querySelectorAll('#charTabs button').forEach(x => x.classList.toggle('on', x === b)); renderChars(); });
function renderChars(){
  const st = avatarStatus[editWho], file = PEOPLE[editWho]?.avatar || '';
  $('#glbNote').textContent = st === 'ok' ? nameOf(editWho) + ' is using the realistic avatar from ' + file + '.'
    : st === 'loading' ? 'Loading ' + nameOf(editWho) + '\'s avatar…'
    : st === 'bad' ? 'The file ' + file + ' loaded, but it has no standard skeleton, so it can\'t walk. Export it again from Avaturn as a .glb.'
    : 'No realistic avatar for ' + nameOf(editWho) + ' yet. Make one from a selfie at avaturn.me, download it as a .glb, and upload it to your GitHub repo as ' + file + '. Until then, the character below is used.';
  const box = $('#charEditor'); box.textContent = '';
  if (st === 'ok') return;
  const o = avatarCfg(editWho);
  const set = (k, v) => { state.avatars[editWho] = Object.assign({}, o, {[k]: v}); avatars[editWho].cfg = null; rebuildBuiltin(avatars[editWho]); saveAvatarCfg(editWho); renderChars(); };
  const sec = (title, el) => { const d = document.createElement('div'), l = document.createElement('div'); l.className = 'label'; l.textContent = title; d.append(l, el); box.append(d); };
  const swatches = (k, list) => { const w = document.createElement('div'); w.className = 'sw';
    list.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', c); if (c === o[k]) b.classList.add('on'); b.onclick = () => set(k, c); w.append(b); }); return w; };
  const pills = (k, opts) => { const w = document.createElement('div'); w.className = 'pills';
    opts.forEach(([v, label]) => { const b = document.createElement('button'); b.textContent = label; if (o[k] === v) b.classList.add('on'); b.onclick = () => set(k, v); w.append(b); }); return w; };
  sec('Skin tone', swatches('skin', SKINS));
  sec('Hair', pills('hairStyle', [['fringe','Thick fringe'],['short','Short'],['buzz','Buzz cut'],['long','Long'],['bun','Bun'],['scarf','Headscarf']]));
  sec('Hair color', swatches('hair', HAIRS)); sec('Eye color', swatches('eyes', EYES)); sec('Lips', swatches('lips', LIPS));
  sec('Outfit', pills('top', [['tee','T-shirt'],['long','Long sleeve'],['gown','Long gown'],['dress','Short dress']]));
  sec('Outfit color', swatches('topColor', CLOTH));
  if (o.top !== 'gown' && o.top !== 'dress'){ sec('Bottoms', pills('bottom', [['pants','Pants'],['shorts','Shorts'],['maxi','Long skirt']])); sec('Bottoms color', swatches('bottomColor', CLOTH)); }
}

/* ================= loop ================= */
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const clock = new THREE.Clock(), tmpV = new THREE.Vector3();
function placeLabel(av, el, extra){
  tmpV.copy(av.root.position); tmpV.y = (av.action === 'sit' ? av.topY*.75 : av.topY) + extra; tmpV.project(camera);
  const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.2 && Math.abs(tmpV.y) < 1.2; el.style.display = vis ? '' : 'none';
  if (vis){ el.style.left = ((tmpV.x+1)/2*innerWidth) + 'px'; el.style.top = ((1-tmpV.y)/2*innerHeight) + 'px'; }
}
function loop(){
  const dt = Math.min(.05, clock.getDelta());
  keyMove(dt); stepAvatar(avatars.a, dt); stepAvatar(avatars.b, dt);
  if (loveHold > 0){ loveHold -= dt; if (loveHold <= 0) me().lookAt = null; }
  partnerThink(dt); sendPresence(false); stepHearts(dt);
  if (ringT < 1){ ringT += dt*1.6; ringMat.opacity = .8*(1-ringT); ring.scale.setScalar(1 + ringT*1.2); } else ringMat.opacity = 0;
  updateCamera(dt); renderer.render(scene, camera);
  for (const av of Object.values(avatars)){ placeLabel(av, av.tag, .06); if (av.bubT > 0){ av.bubT -= dt; placeLabel(av, av.bub, .3); if (av.bubT <= 0) av.bub.classList.remove('show'); } }
  requestAnimationFrame(loop);
}
window.__museum = {cam, avatars, frames, me, doKiss};
cam.target.set(.5, 1.45, 8.9);
document.fonts?.ready.then(() => { drawNames(); makeEmpty(); frames.forEach(f => { if (!f.loadedPid){ f.pic.material.map = EMPTY; f.pic.material.needsUpdate = true; } f.plaque.userData.cap = null; drawPlaque(f); }); });
loop(); boot();
