import * as THREE from "three";
import type { KeycapParams } from "./params";

type Ring = THREE.Vector3[];
const CORNER_SEG=8, SIDE_LAYERS=14, CAP_RINGS=8, FILLET_RINGS=3;

function roundedRectRing(w:number,d:number,r:number){
  const hw=w/2,hd=d/2,rr=Math.max(.01,Math.min(r,Math.min(hw,hd)-.05));
  const centers=[{cx:hw-rr,cy:hd-rr,a0:0},{cx:-(hw-rr),cy:hd-rr,a0:Math.PI/2},{cx:-(hw-rr),cy:-(hd-rr),a0:Math.PI},{cx:hw-rr,cy:-(hd-rr),a0:3*Math.PI/2}];
  const pts:{x:number;y:number}[]=[];
  for(const c of centers) for(let i=0;i<CORNER_SEG;i++){const a=c.a0+(i/CORNER_SEG)*(Math.PI/2);pts.push({x:c.cx+rr*Math.cos(a),y:c.cy+rr*Math.sin(a)});} return pts;
}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
export function effectiveParams(p:KeycapParams):KeycapParams{const s=1+p.shrinkage/100,xy=p.xyCompensation;return{...p,bottomWidth:p.bottomWidth*s+2*xy,bottomDepth:p.bottomDepth*s+2*xy,topWidth:p.topWidth*s+2*xy,topDepth:p.topDepth*s+2*xy,height:p.height*s+p.zCompensation};}
function push(tris:number[][],a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3){tris.push([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z]);}
function stitch(a:Ring,b:Ring,tris:number[][],flip=false){for(let i=0;i<a.length;i++){const j=(i+1)%a.length,ai=a[i]!,aj=a[j]!,bi=b[i]!,bj=b[j]!;const q=flip?[[ai,bi,bj],[ai,bj,aj]]:[[ai,bj,bi],[ai,aj,bj]];for(const t of q)push(tris,t[0]!,t[1]!,t[2]!);}}
function fanToPoint(r:Ring,p:THREE.Vector3,tris:number[][],flip=false){for(let i=0;i<r.length;i++){const j=(i+1)%r.length;if(flip)push(tris,r[j]!,r[i]!,p);else push(tris,r[i]!,r[j]!,p);}}
function toGeometry(tris:number[][]){const pos=new Float32Array(tris.length*9);for(let i=0;i<tris.length;i++)pos.set(tris[i]!,i*9);const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.computeVertexNormals();return g;}

export interface KeycapBuild{shell:THREE.BufferGeometry;stems:THREE.BufferGeometry|null;merged:THREE.BufferGeometry;analysis:{bbox:{x:number;y:number;z:number};volume:number;minWall:number;triangles:number;warnings:string[];manifoldShell:boolean;}}

export function buildKeycap(raw:KeycapParams):KeycapBuild{
  const p=effectiveParams(raw),h=Math.max(2,p.height),fillet=Math.max(0,Math.min(p.filletTop,h/3,2)),wall=Math.max(.3,p.wallThickness),topTh=Math.max(.3,p.topThickness),tanTilt=Math.tan(p.topTilt*Math.PI/180),draftK=1+p.sideDraft/12;
  const sideTopZ=h-fillet,tSideMax=sideTopZ/h,topZ=(y:number,t:number)=>t*h+t*y*tanTilt;
  const outerAt=(t:number)=>{const te=Math.pow(t,draftK);return{w:lerp(p.bottomWidth,p.topWidth,te),d:lerp(p.bottomDepth,p.topDepth,te),r:lerp(p.cornerRadius,p.topCornerRadius,te)}};
  const ringAt=(w:number,d:number,r:number,t:number,dz=0):Ring=>roundedRectRing(w,d,r).map(q=>new THREE.Vector3(q.x,q.y,topZ(q.y,t)+dz));
  const tris:number[][]=[],outerRings:Ring[]=[];
  for(let i=0;i<=SIDE_LAYERS;i++){const t=i/SIDE_LAYERS*tSideMax,{w,d,r}=outerAt(t);outerRings.push(ringAt(w,d,r,t));}
  for(let i=0;i<SIDE_LAYERS;i++)stitch(outerRings[i]!,outerRings[i+1]!,tris);
  let rimRing=outerRings[SIDE_LAYERS]!;const topDim=outerAt(1);
  if(fillet>.01){for(let q=1;q<=FILLET_RINGS;q++){const a=q/FILLET_RINGS*Math.PI/2,inset=fillet*(1-Math.cos(a)),dz=fillet*Math.sin(a),w=Math.max(1,topDim.w-2*inset),d=Math.max(1,topDim.d-2*inset);const next=roundedRectRing(w,d,Math.max(.2,topDim.r-inset*.3)).map(pt=>new THREE.Vector3(pt.x,pt.y,topZ(pt.y,tSideMax)+dz));stitch(rimRing,next,tris);rimRing=next;}}
  const sag=(s:number)=>p.dishDepth*(1-Math.pow(s,Math.max(1,p.dishStrength))),rimFlatZ=tSideMax*h+(fillet>.01?fillet:0),capZ=(y:number,s:number,dz:number)=>rimFlatZ+y*tanTilt*tSideMax-sag(s)+dz,capRing=(s:number,dz:number):Ring=>rimRing.map(v=>new THREE.Vector3(v.x*s,v.y*s,capZ(v.y*s,s,dz)));
  let prev=rimRing;for(let k=1;k<=CAP_RINGS;k++){const s=1-k/(CAP_RINGS+1),next=capRing(s,0);stitch(prev,next,tris);prev=next;}const centerZ=capZ(0,0,0);fanToPoint(prev,new THREE.Vector3(0,0,centerZ),tris);
  const innerRings:Ring[]=[];for(let i=0;i<=SIDE_LAYERS;i++){const t=i/SIDE_LAYERS*tSideMax,{w,d,r}=outerAt(t);innerRings.push(ringAt(Math.max(1,w-2*wall),Math.max(1,d-2*wall),Math.max(.2,r-wall),t));}for(let i=0;i<SIDE_LAYERS;i++)stitch(innerRings[i]!,innerRings[i+1]!,tris,true);
  const innerRim=rimRing.map(v=>new THREE.Vector3(v.x*(1-wall*2/Math.max(topDim.w,1)),v.y*(1-wall*2/Math.max(topDim.d,1)),v.z-topTh));stitch(innerRings[SIDE_LAYERS]!,innerRim,tris,true);
  let iprev=innerRim;for(let k=1;k<=CAP_RINGS;k++){const s=1-k/(CAP_RINGS+1),next=innerRim.map(v=>new THREE.Vector3(v.x*s,v.y*s,capZ(v.y*s,s,-topTh)));stitch(iprev,next,tris,true);iprev=next;}const innerCenterZ=capZ(0,0,-topTh);fanToPoint(iprev,new THREE.Vector3(0,0,innerCenterZ),tris,true);stitch(outerRings[0]!,innerRings[0]!,tris);
  const shell=toGeometry(tris),stemGeos:THREE.BufferGeometry[]=[];
  if(p.stemEnabled){const zTop=innerCenterZ,mk=(offsetX:number)=>{const g=buildStem(p);g.translate(offsetX,0,zTop-p.stemHeight);return g};stemGeos.push(mk(0));if(p.stabEnabled&&p.units>=2){stemGeos.push(mk(p.stabSpacing/2));stemGeos.push(mk(-p.stabSpacing/2));}}
  const stems=stemGeos.length?mergeGeometries(stemGeos):null,merged=stems?mergeGeometries([shell,stems]):shell;merged.computeBoundingBox();const bb=merged.boundingBox!,warnings:string[]=[];
  if(wall<raw.nozzle*2)warnings.push(`Thành ${wall.toFixed(2)} mm mỏng hơn 2 lần đường kính vòi (${raw.nozzle} mm).`);if(topTh<raw.nozzle*3)warnings.push(`Nóc ${topTh.toFixed(2)} mm khá mỏng, nên ≥ ${(raw.nozzle*3).toFixed(2)} mm.`);if(p.topWidth>p.bottomWidth||p.topDepth>p.bottomDepth)warnings.push("Mặt trên rộng hơn mặt đáy → có thể cần support.");if(p.dishDepth>topTh-.2)warnings.push("Độ lõm dish lớn hơn độ dày nóc → nguy cơ thủng nóc.");if(p.stemEnabled&&p.stemDiameter+1>Math.min(p.bottomWidth,p.bottomDepth)-2*wall)warnings.push("Stem quá lớn so với khoang trong.");if(p.stabEnabled&&p.units>=2&&p.stabSpacing/2+p.stemDiameter/2>p.bottomWidth/2-wall)warnings.push("Khoảng cách stabilizer vượt ra ngoài thân keycap.");
  return{shell,stems,merged,analysis:{bbox:{x:bb.max.x-bb.min.x,y:bb.max.y-bb.min.y,z:bb.max.z-bb.min.z},volume:computeVolume(merged),minWall:Math.min(wall,topTh),triangles:merged.getAttribute("position").count/3,warnings,manifoldShell:stems===null}};
}

function buildStem(p:KeycapParams){const c=p.stemClearance,r=p.stemDiameter/2,shape=new THREE.Shape();shape.absarc(0,0,r,0,Math.PI*2,false);const L=(p.crossLength+c)/2,W=(p.crossWidth+c)/2,hole=new THREE.Path(),pts:[number,number][]=[[W,W],[W,L],[-W,L],[-W,W],[-L,W],[-L,-W],[-W,-W],[-W,-L],[W,-L],[W,-W],[L,-W],[L,W]];hole.moveTo(pts[0]![0],pts[0]![1]);for(let i=1;i<pts.length;i++)hole.lineTo(pts[i]![0],pts[i]![1]);hole.closePath();shape.holes.push(hole);return new THREE.ExtrudeGeometry(shape,{depth:p.stemHeight,bevelEnabled:false,curveSegments:24}).toNonIndexed();}
export function mergeGeometries(geos:THREE.BufferGeometry[]){let total=0;const arrays:Float32Array[]=[];for(const g of geos){const ng=g.index?g.toNonIndexed():g,a=ng.getAttribute("position").array as Float32Array;arrays.push(a);total+=a.length;}const out=new Float32Array(total);let o=0;for(const a of arrays){out.set(a,o);o+=a.length;}const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(out,3));g.computeVertexNormals();return g;}
export function computeVolume(g:THREE.BufferGeometry){const pos=g.getAttribute("position").array as ArrayLike<number>;let v=0;for(let i=0;i<pos.length;i+=9){const ax=pos[i]!,ay=pos[i+1]!,az=pos[i+2]!,bx=pos[i+3]!,by=pos[i+4]!,bz=pos[i+5]!,cx=pos[i+6]!,cy=pos[i+7]!,cz=pos[i+8]!;v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6;}return Math.abs(v);}
