import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';

export const config = { maxDuration: 60 };

const boole = new Evaluator();
boole.attributes = ['position', 'normal'];

const DON_VI = {
  '1U': { w: 18, d: 18 }, '1.25U': { w: 22.75, d: 18 }, '1.5U': { w: 27.5, d: 18 },
  '1.75U': { w: 32.25, d: 18 }, '2U': { w: 37, d: 18 }, '2.25U': { w: 41.75, d: 18 },
  '2.75U': { w: 51.25, d: 18 }, '6.25U': { w: 117.5, d: 18 }
};
const PROFILE = {
  Cherry: { h: 9.5, top: 13.2, tilt: -6 }, OEM: { h: 11.2, top: 13.5, tilt: -7 },
  XDA: { h: 9.1, top: 14.2, tilt: 0 }, DSA: { h: 7.6, top: 14, tilt: 0 }, SA: { h: 13.5, top: 12.7, tilt: -8 }
};

function brush(g){ const b=new Brush(g); b.updateMatrixWorld(true); return b; }
function csg(a,b,op){ a.updateMatrixWorld(true); b.updateMatrixWorld(true); const o=boole.evaluate(a,b,op); o.geometry.computeVertexNormals(); return o; }
function ringBoGoc(w,d,r,z,segments=32){
  const rr=Math.max(.15,Math.min(r,w/2-.05,d/2-.05)), pc=Math.max(3,Math.floor(segments/4));
  const cs=[[w/2-rr,d/2-rr,0,Math.PI/2],[-w/2+rr,d/2-rr,Math.PI/2,Math.PI],[-w/2+rr,-d/2+rr,Math.PI,Math.PI*1.5],[w/2-rr,-d/2+rr,Math.PI*1.5,Math.PI*2]], pts=[];
  for(const[cx,cy,a0,a1]of cs) for(let i=0;i<pc;i++){ const a=a0+(a1-a0)*i/pc; pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,z]); }
  return pts;
}
function loftVuongBoGoc(bw,bd,tw,td,h,r=1.6,bottomZ=0){
  const levels=8,pos=[],idx=[],rings=[];
  for(let l=0;l<=levels;l++){ const t=l/levels,w=THREE.MathUtils.lerp(bw,tw,t),d=THREE.MathUtils.lerp(bd,td,t),pts=ringBoGoc(w,d,Math.min(r,w*.2,d*.2),bottomZ+t*h),start=pos.length/3; pts.forEach(p=>pos.push(...p)); rings.push({start,count:pts.length}); }
  const n=rings[0].count;
  for(let l=0;l<levels;l++) for(let i=0;i<n;i++){ const a=rings[l].start+i,b=rings[l].start+(i+1)%n,c=rings[l+1].start+(i+1)%n,d=rings[l+1].start+i; idx.push(a,b,c,a,c,d); }
  const tc=pos.length/3; pos.push(0,0,bottomZ+h); for(let i=0;i<n;i++) idx.push(rings[levels].start+i,rings[levels].start+(i+1)%n,tc);
  const bc=pos.length/3; pos.push(0,0,bottomZ); for(let i=0;i<n;i++) idx.push(rings[0].start+(i+1)%n,rings[0].start+i,bc);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function roundedBox(w,d,h,r=2){ const rr=Math.max(.2,Math.min(r,w/2-.05,d/2-.05,h/2-.05)),g=new RoundedBoxGeometry(w,h,d,4,rr); g.rotateX(Math.PI/2); return g; }
function crossSolid(total,arm,h,x=0,y=0,z=0){ const a=new THREE.BoxGeometry(total,arm,h),b=new THREE.BoxGeometry(arm,total,h); a.translate(x,y,z+h/2); b.translate(x,y,z+h/2); return csg(brush(a),brush(b),ADDITION); }

function taoKhay(t){
  const u=DON_VI[t.unit]||DON_VI['1U'];
  const openW=u.w+t.clearance*2+u.w*t.shrink/100, openD=u.d+t.clearance*2+u.d*t.shrink/100;
  const pitchX=Math.max(t.pitchX,openW+t.wallBetween), pitchY=Math.max(t.pitchY,openD+t.wallBetween);
  const W=(t.cols-1)*pitchX+openW+t.edge*2, D=(t.rows-1)*pitchY+openD+t.edge*2;
  if(t.mode==='Hốc chứa'){
    const H=t.base+t.depth+t.lip, outer=roundedBox(W,D,H,t.outerRadius); outer.translate(0,0,H/2); let solid=brush(outer);
    for(let r=0;r<t.rows;r++) for(let c=0;c<t.cols;c++){
      const x=(c-(t.cols-1)/2)*pitchX,y=((t.rows-1)/2-r)*pitchY;
      const p=loftVuongBoGoc(Math.max(5,openW-t.taper),Math.max(5,openD-t.taper),openW,openD,t.depth+t.lip+.8,Math.min(1.2,t.slotRadius),0); p.translate(x,y,t.base-.2); solid=csg(solid,brush(p),SUBTRACTION);
      if(t.notch){ const n=new THREE.CylinderGeometry(t.notchRadius,t.notchRadius,t.depth+2,28); n.rotateX(Math.PI/2); n.translate(x,y-openD/2+t.notchRadius*.35,t.base+t.depth*.55); solid=csg(solid,brush(n),SUBTRACTION); }
    }
    const g=solid.geometry.clone(); g.rotateX(-Math.PI/2); g.computeVertexNormals(); return g;
  }
  const H=t.mountPlate+t.pegHeight, plate=roundedBox(W,D,t.mountPlate,t.outerRadius); plate.translate(0,0,t.mountPlate/2); let solid=brush(plate);
  for(let r=0;r<t.rows;r++) for(let c=0;c<t.cols;c++){
    const x=(c-(t.cols-1)/2)*pitchX,y=((t.rows-1)/2-r)*pitchY;
    solid=csg(solid,crossSolid(t.pegTotal,t.pegArm,t.pegHeight,x,y,t.mountPlate-.05),ADDITION);
    if(t.ring){ const ro=new THREE.CylinderGeometry(t.ringOuter/2,t.ringOuter/2,t.ringHeight,28),ri=new THREE.CylinderGeometry(t.ringInner/2,t.ringInner/2,t.ringHeight+1,28); ro.rotateX(Math.PI/2); ri.rotateX(Math.PI/2); ro.translate(x,y,t.mountPlate+t.ringHeight/2); ri.translate(x,y,t.mountPlate+t.ringHeight/2); solid=csg(solid,csg(brush(ro),brush(ri),SUBTRACTION),ADDITION); }
  }
  const g=solid.geometry.clone(); g.rotateX(-Math.PI/2); g.computeVertexNormals(); return g;
}

function buildKeycap(k){
  const p=PROFILE[k.profile]||PROFILE.Cherry,u=DON_VI[k.unit]||DON_VI['1U'],topW=k.unit==='1U'?p.top:Math.max(p.top,u.w-4.8),topD=p.top;
  let solid=brush(loftVuongBoGoc(u.w,u.d,topW,topD,p.h,k.corner));
  const inner=loftVuongBoGoc(Math.max(2,u.w-k.wall*2),Math.max(2,u.d-k.wall*2),Math.max(2,topW-k.wall*2),Math.max(2,topD-k.wall*2),Math.max(.8,p.h-k.topThickness+.5),Math.max(.4,k.corner-k.wall*.45),-.45);
  solid=csg(solid,brush(inner),SUBTRACTION);
  const outer=new THREE.CylinderGeometry(k.socketOuter/2,k.socketOuter/2,k.socketHeight,28); outer.rotateX(Math.PI/2); outer.translate(0,0,k.socketHeight/2+.15); let socket=brush(outer);
  const total=k.crossTotal+k.tolerance*2,arm=k.crossArm+k.tolerance*2; socket=csg(socket,crossSolid(total,arm,k.socketHeight+1,0,0,-.35),SUBTRACTION); solid=csg(solid,socket,ADDITION);
  const g=solid.geometry.clone(); g.rotateX(-Math.PI/2); g.rotateZ(THREE.MathUtils.degToRad(p.tilt)); g.computeVertexNormals(); return g;
}

function toBuffer(view){
  if(view instanceof ArrayBuffer) return Buffer.from(view);
  if(ArrayBuffer.isView(view)) return Buffer.from(view.buffer,view.byteOffset,view.byteLength);
  return Buffer.from(view);
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Chỉ hỗ trợ POST'});
  try{
    const {tool='Khay',tray,key}=req.body||{};
    const geometry=tool==='Khay'?taoKhay(tray):buildKeycap(key);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()); mesh.updateMatrixWorld(true);
    const stl=new STLExporter().parse(mesh,{binary:true});
    const buf=toBuffer(stl);
    res.setHeader('Content-Type','model/stl');
    res.setHeader('Content-Disposition',`attachment; filename="${tool==='Khay'?'khay-keycap':'keycap'}.stl"`);
    res.setHeader('Content-Length',String(buf.length));
    res.status(200).send(buf);
  }catch(e){
    console.error(e);
    res.status(500).json({error:'Không thể tạo STL',detail:e?.message||String(e)});
  }
}
