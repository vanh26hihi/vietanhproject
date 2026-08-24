import React, {useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useThree} from '@react-three/fiber';
import {OrbitControls, Grid, Environment, Text} from '@react-three/drei';
import * as THREE from 'three';
import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js';
import './styles.css';

const profiles={Cherry:{h:9.5,top:13.2,dish:.65,tilt:-6},OEM:{h:11.2,top:13.5,dish:.75,tilt:-7},XDA:{h:9.1,top:14.2,dish:.35,tilt:0},DSA:{h:7.6,top:14,dish:.45,tilt:0},SA:{h:13.5,top:12.7,dish:1.0,tilt:-8}};
const sizes={'1U':18,'1.25U':22.75,'1.5U':27.5,'1.75U':32.25,'2U':37,'2.25U':41.75,'2.75U':51.25,'6.25U':117.5};

function roundedRectShape(w,d,r){const s=new THREE.Shape();const x=-w/2,y=-d/2;r=Math.min(r,w/2-0.01,d/2-0.01);s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}

function buildShell(p){
 const seg=32, levels=10, pos=[], idx=[];
 const bw=p.width,bd=p.depth,tw=p.topWidth,td=p.topDepth,h=p.height,wall=p.wall,topT=p.topThickness;
 const addRing=(w,d,z,inner=false)=>{const base=pos.length/3;for(let i=0;i<seg;i++){const a=i/seg*Math.PI*2;const ca=Math.cos(a),sa=Math.sin(a);const rx=w/2-p.corner+(p.corner*Math.sign(ca));const ry=d/2-p.corner+(p.corner*Math.sign(sa));const ex=Math.sign(ca)*(w/2-p.corner)+p.corner*ca;const ey=Math.sign(sa)*(d/2-p.corner)+p.corner*sa;pos.push(ex,ey,z);}return base};
 const outer=[];for(let l=0;l<=levels;l++){const t=l/levels;const w=THREE.MathUtils.lerp(bw,tw,t),d=THREE.MathUtils.lerp(bd,td,t);let z=t*h;const yNorm=0;z+=Math.tan(THREE.MathUtils.degToRad(p.tilt))*0;outer.push(addRing(w,d,z));}
 for(let l=0;l<levels;l++){for(let i=0;i<seg;i++){const a=outer[l]+i,b=outer[l]+(i+1)%seg,c=outer[l+1]+(i+1)%seg,d=outer[l+1]+i;idx.push(a,b,c,a,c,d)}}
 const top=outer[levels];const topCenter=pos.length/3;pos.push(0,0,h-p.dish);
 for(let i=0;i<seg;i++) idx.push(top+i,top+(i+1)%seg,topCenter);
 const iw=Math.max(1,bw-2*wall), id=Math.max(1,bd-2*wall);const ib=addRing(iw,id,0.2), it=addRing(Math.max(1,tw-2*wall),Math.max(1,td-2*wall),Math.max(.3,h-topT));
 for(let i=0;i<seg;i++){let a=ib+i,b=ib+(i+1)%seg,c=it+(i+1)%seg,d=it+i;idx.push(a,c,b,a,d,c); idx.push(outer[0]+i,ib+(i+1)%seg,outer[0]+(i+1)%seg,outer[0]+i,ib+i,ib+(i+1)%seg)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 g.rotateX(Math.PI/2);g.translate(0,h/2,0);return g;
}

function Stem({p,mat}){const arm=Math.max(.8,1.15+p.clearance); const long=4.1+p.clearance;return <group position={[0,-p.height/2+2.2,0]}><mesh material={mat}><boxGeometry args={[long,4.4,arm]}/></mesh><mesh material={mat}><boxGeometry args={[arm,4.4,long]}/></mesh></group>}

function Model({p,modelRef}){const geom=useMemo(()=>buildShell(p),[p]);const mat=useMemo(()=>new THREE.MeshStandardMaterial({color:'#e8eef7',roughness:.36,metalness:.04,transparent:p.transparent,opacity:p.transparent?.55:1,wireframe:p.wireframe}),[p.transparent,p.wireframe]);return <group ref={modelRef} rotation={[THREE.MathUtils.degToRad(p.tilt),0,0]}><mesh geometry={geom} material={mat}/><Stem p={p} mat={mat}/>{p.text&&<Text position={[p.textX,p.height/2+.08,-p.textY]} rotation={[-Math.PI/2,0,THREE.MathUtils.degToRad(p.textRotate)]} fontSize={p.textSize} anchorX="center" anchorY="middle" color="#2563eb">{p.text}</Text>}</group>}

function Scene({p,modelRef}){return <><ambientLight intensity={1.1}/><directionalLight position={[8,12,8]} intensity={2}/><Model p={p} modelRef={modelRef}/><Grid args={[120,120]} cellSize={1} sectionSize={10} fadeDistance={100}/><OrbitControls makeDefault target={[0,2,0]}/></>}

function NumberField({label,value,onChange,min,max,step=.1,suffix='mm'}){return <label className="field"><span>{label}</span><div><input type="number" value={value} min={min} max={max} step={step} onChange={e=>onChange(+e.target.value)}/><b>{suffix}</b></div></label>}

function App(){
 const modelRef=useRef();const [size,setSize]=useState('1U');const [profile,setProfile]=useState('Cherry');const base=profiles[profile];
 const [p,setP]=useState({width:18,depth:18,topWidth:13.2,topDepth:13.2,height:9.5,wall:1.2,topThickness:1.6,corner:1.7,dish:.65,tilt:-6,clearance:.1,text:'A',textSize:4.2,textX:0,textY:0,textRotate:0,wireframe:false,transparent:false});
 const patch=x=>setP(v=>({...v,...x}));
 const applyProfile=n=>{setProfile(n);const q=profiles[n];patch({height:q.h,topWidth:q.top,topDepth:q.top,dish:q.dish,tilt:q.tilt})};
 const applySize=n=>{setSize(n);patch({width:sizes[n],depth:18})};
 const exportStl=()=>{if(!modelRef.current)return;modelRef.current.updateMatrixWorld(true);const exp=new STLExporter();const data=exp.parse(modelRef.current,{binary:true});const blob=new Blob([data],{type:'model/stl'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`keycap_${size}_${profile}_${p.text||'blank'}.stl`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 const exportJson=()=>{const blob=new Blob([JSON.stringify({size,profile,...p},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='keycap-settings.json';a.click()};
 return <div className="app"><header><div><h1>Keycap Generator</h1><p>Tạo keycap 3D tùy chỉnh cho Cherry MX / FDM</p></div><div className="actions"><button onClick={exportJson}>Xuất JSON</button><button className="primary" onClick={exportStl}>Xuất STL</button></div></header>
 <main><aside><section><h3>Kích thước</h3><div className="chips">{Object.keys(sizes).map(n=><button className={size===n?'active':''} onClick={()=>applySize(n)}>{n}</button>)}</div></section><section><h3>Profile</h3><div className="chips">{Object.keys(profiles).map(n=><button className={profile===n?'active':''} onClick={()=>applyProfile(n)}>{n}</button>)}</div></section><section><h3>Hiển thị</h3><label className="toggle"><input type="checkbox" checked={p.wireframe} onChange={e=>patch({wireframe:e.target.checked})}/>Wireframe</label><label className="toggle"><input type="checkbox" checked={p.transparent} onChange={e=>patch({transparent:e.target.checked})}/>Vỏ trong suốt</label></section></aside>
 <div className="viewer"><Canvas camera={{position:[24,22,24],fov:36}}><Scene p={p} modelRef={modelRef}/></Canvas><div className="hint">Kéo để xoay • Lăn chuột để zoom</div></div>
 <aside className="right"><section><h3>Thân keycap</h3><NumberField label="Rộng đáy" value={p.width} onChange={v=>patch({width:v})}/><NumberField label="Sâu đáy" value={p.depth} onChange={v=>patch({depth:v})}/><NumberField label="Rộng mặt" value={p.topWidth} onChange={v=>patch({topWidth:v})}/><NumberField label="Sâu mặt" value={p.topDepth} onChange={v=>patch({topDepth:v})}/><NumberField label="Chiều cao" value={p.height} onChange={v=>patch({height:v})}/><NumberField label="Wall" value={p.wall} onChange={v=>patch({wall:v})}/><NumberField label="Top thickness" value={p.topThickness} onChange={v=>patch({topThickness:v})}/><NumberField label="Bo góc" value={p.corner} onChange={v=>patch({corner:v})}/><NumberField label="Dish" value={p.dish} onChange={v=>patch({dish:v})}/><NumberField label="Tilt" value={p.tilt} onChange={v=>patch({tilt:v})} suffix="°"/></section>
 <section><h3>Stem Cherry MX</h3><NumberField label="Clearance" value={p.clearance} onChange={v=>patch({clearance:v})} step=.05/><small>FDM 0.4 mm thường bắt đầu ở +0.10 mm rồi test thực tế.</small></section>
 <section><h3>Chữ / Legend</h3><label className="field"><span>Nội dung</span><input className="textinput" value={p.text} maxLength={12} onChange={e=>patch({text:e.target.value})} placeholder="ESC, A, Enter..."/></label><NumberField label="Cỡ chữ" value={p.textSize} onChange={v=>patch({textSize:v})}/><NumberField label="Vị trí X" value={p.textX} onChange={v=>patch({textX:v})}/><NumberField label="Vị trí Y" value={p.textY} onChange={v=>patch({textY:v})}/><NumberField label="Xoay" value={p.textRotate} onChange={v=>patch({textRotate:v})} suffix="°"/><p className="note">Preview chữ realtime. Bản tiếp theo có thể thêm emboss/deboss thật vào STL.</p></section></aside></main></div>
}
createRoot(document.getElementById('root')).render(<App/>);
