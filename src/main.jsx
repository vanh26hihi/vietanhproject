import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{Canvas,useFrame,useThree}from'@react-three/fiber';
import*as THREE from'three';
import{OrbitControls as ThreeOrbitControls}from'three/examples/jsm/controls/OrbitControls.js';
import{STLExporter}from'three/examples/jsm/exporters/STLExporter.js';
import{RoundedBoxGeometry}from'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import{Brush,Evaluator,ADDITION,SUBTRACTION}from'three-bvh-csg';
import'./styles.css';

const boole=new Evaluator();boole.attributes=['position','normal'];
const DON_VI={
'1U':{w:18,d:18},'1.25U':{w:22.75,d:18},'1.5U':{w:27.5,d:18},'1.75U':{w:32.25,d:18},'2U':{w:37,d:18},'2.25U':{w:41.75,d:18},'2.75U':{w:51.25,d:18},'6.25U':{w:117.5,d:18}
};
const PROFILE={Cherry:{h:9.5,top:13.2,tilt:-6},OEM:{h:11.2,top:13.5,tilt:-7},XDA:{h:9.1,top:14.2,tilt:0},DSA:{h:7.6,top:14,tilt:0},SA:{h:13.5,top:12.7,tilt:-8}};
const FIT={Chặt:.12,Vừa:.28,Rộng:.48};
const VAT_LIEU={PLA:0,PETG:.15,ABS:.45,ASA:.40};

function brush(g){const b=new Brush(g);b.updateMatrixWorld(true);return b}
function csg(a,b,op){a.updateMatrixWorld(true);b.updateMatrixWorld(true);const o=boole.evaluate(a,b,op);o.geometry.computeVertexNormals();return o}

function ringBoGoc(w,d,r,z,segments=32){
 const rr=Math.max(.15,Math.min(r,w/2-.05,d/2-.05)),pc=Math.max(3,Math.floor(segments/4));
 const cs=[[w/2-rr,d/2-rr,0,Math.PI/2],[-w/2+rr,d/2-rr,Math.PI/2,Math.PI],[-w/2+rr,-d/2+rr,Math.PI,Math.PI*1.5],[w/2-rr,-d/2+rr,Math.PI*1.5,Math.PI*2]],pts=[];
 for(const[cx,cy,a0,a1]of cs)for(let i=0;i<pc;i++){const a=a0+(a1-a0)*i/pc;pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,z])}
 return pts;
}
function loftVuongBoGoc(bw,bd,tw,td,h,r=1.6,bottomZ=0){
 const levels=8,pos=[],idx=[],rings=[];
 for(let l=0;l<=levels;l++){const t=l/levels,w=THREE.MathUtils.lerp(bw,tw,t),d=THREE.MathUtils.lerp(bd,td,t),pts=ringBoGoc(w,d,Math.min(r,w*.2,d*.2),bottomZ+t*h),start=pos.length/3;pts.forEach(p=>pos.push(...p));rings.push({start,count:pts.length})}
 const n=rings[0].count;
 for(let l=0;l<levels;l++)for(let i=0;i<n;i++){const a=rings[l].start+i,b=rings[l].start+(i+1)%n,c=rings[l+1].start+(i+1)%n,d=rings[l+1].start+i;idx.push(a,b,c,a,c,d)}
 const tc=pos.length/3;pos.push(0,0,bottomZ+h);for(let i=0;i<n;i++)idx.push(rings[levels].start+i,rings[levels].start+(i+1)%n,tc);
 const bc=pos.length/3;pos.push(0,0,bottomZ);for(let i=0;i<n;i++)idx.push(rings[0].start+(i+1)%n,rings[0].start+i,bc);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function roundedBox(w,d,h,r=2){const rr=Math.max(.2,Math.min(r,w/2-.05,d/2-.05,h/2-.05)),g=new RoundedBoxGeometry(w,h,d,4,rr);g.rotateX(Math.PI/2);return g}
function pocketTaper(bottomW,bottomD,topW,topD,h,r=.9){return loftVuongBoGoc(bottomW,bottomD,topW,topD,h,r)}
function crossSolid(total,arm,h,x=0,y=0,z=0){const a=new THREE.BoxGeometry(total,arm,h),b=new THREE.BoxGeometry(arm,total,h);a.translate(x,y,z+h/2);b.translate(x,y,z+h/2);return csg(brush(a),brush(b),ADDITION)}

function buildKeycap(k){
 const p=PROFILE[k.profile],u=DON_VI[k.unit],topW=k.unit==='1U'?p.top:Math.max(p.top,u.w-4.8),topD=p.top;
 let solid=brush(loftVuongBoGoc(u.w,u.d,topW,topD,p.h,k.corner));
 const inner=loftVuongBoGoc(Math.max(2,u.w-k.wall*2),Math.max(2,u.d-k.wall*2),Math.max(2,topW-k.wall*2),Math.max(2,topD-k.wall*2),Math.max(.8,p.h-k.topThickness+.5),Math.max(.4,k.corner-k.wall*.45),-.45);
 solid=csg(solid,brush(inner),SUBTRACTION);
 const outer=new THREE.CylinderGeometry(k.socketOuter/2,k.socketOuter/2,k.socketHeight,28);outer.rotateX(Math.PI/2);outer.translate(0,0,k.socketHeight/2+.15);let socket=brush(outer);
 const total=k.crossTotal+k.tolerance*2,arm=k.crossArm+k.tolerance*2,cross=crossSolid(total,arm,k.socketHeight+1,0,0,-.35);socket=csg(socket,cross,SUBTRACTION);solid=csg(solid,socket,ADDITION);
 const g=solid.geometry.clone();g.rotateX(-Math.PI/2);g.rotateZ(THREE.MathUtils.degToRad(p.tilt));g.computeVertexNormals();return g;
}
function keycapMau(unit,profile,corner=1.6){const p=PROFILE[profile],u=DON_VI[unit],tw=unit==='1U'?p.top:Math.max(p.top,u.w-4.8),g=loftVuongBoGoc(u.w,u.d,tw,p.top,p.h,corner);g.rotateX(-Math.PI/2);g.rotateZ(THREE.MathUtils.degToRad(p.tilt));return g}

function taoKhay(t){
 const u=DON_VI[t.unit],shrink=u.w*t.shrink/100,openW=u.w+t.clearance*2+shrink,openD=u.d+t.clearance*2+u.d*t.shrink/100,pitchX=t.unit==='1U'?Math.max(t.pitchX,openW+t.wallBetween):Math.max(t.pitchX,openW+t.wallBetween),pitchY=Math.max(t.pitchY,openD+t.wallBetween),W=(t.cols-1)*pitchX+openW+t.edge*2,D=(t.rows-1)*pitchY+openD+t.edge*2;
 if(t.mode==='Hốc chứa'){
  const H=t.base+t.depth+t.lip,outer=roundedBox(W,D,H,t.outerRadius);outer.translate(0,0,H/2);let solid=brush(outer);
  for(let r=0;r<t.rows;r++)for(let c=0;c<t.cols;c++){
   const x=(c-(t.cols-1)/2)*pitchX,y=((t.rows-1)/2-r)*pitchY,bw=Math.max(5,openW-t.taper),bd=Math.max(5,openD-t.taper),p=pocketTaper(bw,bd,openW,openD,t.depth+t.lip+.8,Math.min(1.2,t.slotRadius));p.translate(x,y,t.base-.2);solid=csg(solid,brush(p),SUBTRACTION);
   if(t.notch){const n=new THREE.CylinderGeometry(t.notchRadius,t.notchRadius,t.depth+2,28);n.rotateX(Math.PI/2);n.translate(x,y-openD/2+t.notchRadius*.35,t.base+t.depth*.55);solid=csg(solid,brush(n),SUBTRACTION)}
  }
  const g=solid.geometry.clone();g.rotateX(-Math.PI/2);g.computeVertexNormals();return{geometry:g,W,D,H,pitchX,pitchY,openW,openD};
 }
 const H=t.mountPlate+t.pegHeight,plate=roundedBox(W,D,t.mountPlate,t.outerRadius);plate.translate(0,0,t.mountPlate/2);let solid=brush(plate);
 for(let r=0;r<t.rows;r++)for(let c=0;c<t.cols;c++){
  const x=(c-(t.cols-1)/2)*pitchX,y=((t.rows-1)/2-r)*pitchY;solid=csg(solid,crossSolid(t.pegTotal,t.pegArm,t.pegHeight,x,y,t.mountPlate-.05),ADDITION);
  if(t.ring){const ro=new THREE.CylinderGeometry(t.ringOuter/2,t.ringOuter/2,t.ringHeight,28),ri=new THREE.CylinderGeometry(t.ringInner/2,t.ringInner/2,t.ringHeight+1,28);ro.rotateX(Math.PI/2);ri.rotateX(Math.PI/2);ro.translate(x,y,t.mountPlate+t.ringHeight/2);ri.translate(x,y,t.mountPlate+t.ringHeight/2);solid=csg(solid,csg(brush(ro),brush(ri),SUBTRACTION),ADDITION)}
 }
 const g=solid.geometry.clone();g.rotateX(-Math.PI/2);g.computeVertexNormals();return{geometry:g,W,D,H,pitchX,pitchY,openW,openD};
}

function Controls({view}){const{camera,gl}=useThree(),ref=useRef();useEffect(()=>{const c=new ThreeOrbitControls(camera,gl.domElement);c.enableDamping=true;c.target.set(0,2,0);ref.current=c;return()=>c.dispose()},[camera,gl]);useEffect(()=>{const m={"Phối cảnh":[48,36,56],"Trên":[0,80,.01],"Dưới":[0,-80,.01],"Trước":[0,10,80],"Sau":[0,10,-80],"Trái":[-80,10,0],"Phải":[80,10,0]};camera.position.set(...(m[view]||m["Phối cảnh"]));camera.lookAt(0,2,0);ref.current?.update()},[view,camera]);useFrame(()=>ref.current?.update());return null}
function Scene({tool,built,keyGeom,view,colors,wire,alpha,showSamples,tray,modelRef}){
 const trayMat=useMemo(()=>new THREE.MeshStandardMaterial({color:colors.tray,roughness:.38,wireframe:wire,transparent:alpha,opacity:alpha?.58:1,side:THREE.DoubleSide}),[colors.tray,wire,alpha]);
 const keyMat=useMemo(()=>new THREE.MeshStandardMaterial({color:colors.keycap,roughness:.34,transparent:true,opacity:.92}),[colors.keycap]);
 const sample=useMemo(()=>keycapMau(tray.unit,tray.profile),[tray.unit,tray.profile]);
 return<><color attach="background" args={[colors.background]}/><ambientLight intensity={1.35}/><directionalLight position={[14,20,16]} intensity={2.2}/><mesh ref={modelRef} geometry={tool==='Khay'?built.geometry:keyGeom} material={trayMat}/>{tool==='Khay'&&showSamples&&tray.mode==='Hốc chứa'&&Array.from({length:tray.rows*tray.cols},(_,i)=>{const r=Math.floor(i/tray.cols),c=i%tray.cols,x=(c-(tray.cols-1)/2)*built.pitchX,z=((tray.rows-1)/2-r)*built.pitchY;return<mesh key={i} geometry={sample} material={keyMat} position={[x,tray.base+Math.max(1,tray.depth*.52),z]}/>})}<gridHelper args={[240,240]} colorCenterLine={colors.grid} colorGrid={colors.grid}/><Controls view={view}/></>;
}
const Num=({label,value,onChange,step=.1,suffix='mm',min})=><label className="field"><span>{label}</span><div><input type="number" value={value} step={step} min={min} onChange={e=>onChange(Number(e.target.value))}/><b>{suffix}</b></div></label>;
const Sel=({label,value,onChange,children})=><label className="field"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label>;
function tai(name,data,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),800)}

function App(){
 const modelRef=useRef(),[tool,setTool]=useState('Khay'),[view,setView]=useState('Phối cảnh'),[wire,setWire]=useState(false),[alpha,setAlpha]=useState(false),[showSamples,setShowSamples]=useState(true),[colors,setColors]=useState({tray:'#d7e2f2',keycap:'#7aa2ff',grid:'#31405d',background:'#0b1020'});
 const[tray,setTray]=useState({mode:'Hốc chứa',unit:'1U',profile:'Cherry',fit:'Vừa',material:'PLA',shrink:0,rows:4,cols:6,pitchX:21,pitchY:21,edge:4,wallBetween:2.0,clearance:.28,base:2.8,depth:6.8,lip:1.4,taper:1.2,slotRadius:1.0,outerRadius:3,notch:true,notchRadius:3.2,mountPlate:3,pegHeight:3.6,pegTotal:3.95,pegArm:1.05,ring:true,ringOuter:7,ringInner:5.4,ringHeight:1.2});
 const[key,setKey]=useState({unit:'1U',profile:'Cherry',wall:1.2,topThickness:1.6,corner:1.6,socketOuter:5.5,socketHeight:4.2,crossTotal:4.10,crossArm:1.17,tolerance:.10});
 const pt=x=>setTray(v=>({...v,...x})),pk=x=>setKey(v=>({...v,...x}));
 const built=useMemo(()=>{try{return taoKhay(tray)}catch(e){console.error(e);return{geometry:new THREE.BoxGeometry(1,1,1),W:0,D:0,H:0,pitchX:tray.pitchX,pitchY:tray.pitchY,openW:0,openD:0}}},[tray]);
 const keyGeom=useMemo(()=>{try{return buildKeycap(key)}catch(e){console.error(e);return new THREE.BoxGeometry(1,1,1)}},[key]);
 const exportStl=()=>{if(!modelRef.current)return;modelRef.current.updateMatrixWorld(true);tai(tool==='Khay'?'khay-keycap.stl':'keycap.stl',new STLExporter().parse(modelRef.current,{binary:true}),'model/stl')};
 const exportJson=()=>tai('keycap-studio.json',JSON.stringify({tool,tray,key,colors},null,2),'application/json');
 const warnings=[];if(tool==='Khay'&&built.W>256||built.D>256)warnings.push('Khay có thể vượt bàn in 256 × 256 mm.');if(tool==='Khay'&&tray.mode==='Hốc chứa'&&tray.depth<5)warnings.push('Độ sâu hốc dưới 5 mm có thể giữ keycap kém.');if(tool==='Khay'&&built.pitchX<built.openW+1.4)warnings.push('Khoảng cách ngang quá sát, thành giữa các ô có thể mỏng.');if(tool==='Khay'&&tray.mode==='Gắn MX'&&tray.pegArm>1.15)warnings.push('Chốt MX hơi dày, nên in mẫu thử trước.');
 const doiFit=n=>pt({fit:n,clearance:FIT[n]});const doiVL=n=>pt({material:n,shrink:VAT_LIEU[n]});
 return <div className="app"><header><div className="brand"><div className="logo">K</div><div><h1>Keycap Studio</h1><p>Thiết kế keycap và khay in 3D</p></div></div><div className="modeSwitch"><button className={tool==='Khay'?'active':''} onClick={()=>setTool('Khay')}>Tạo khay</button><button className={tool==='Keycap'?'active':''} onClick={()=>setTool('Keycap')}>Tạo keycap</button></div><div className="actions"><button onClick={exportJson}>Xuất JSON</button><button className="primary" onClick={exportStl}>Xuất STL</button></div></header><main className="workspace"><aside className="left">{tool==='Khay'?<><section><h3>Kiểu khay</h3><div className="seg"><button className={tray.mode==='Hốc chứa'?'active':''} onClick={()=>pt({mode:'Hốc chứa'})}>Hốc chứa keycap</button><button className={tray.mode==='Gắn MX'?'active':''} onClick={()=>pt({mode:'Gắn MX'})}>Chốt gắn MX</button></div></section><section><h3>Loại keycap</h3><Sel label="Kích thước" value={tray.unit} onChange={v=>pt({unit:v})}>{Object.keys(DON_VI).map(x=><option key={x}>{x}</option>)}</Sel><Sel label="Profile xem trước" value={tray.profile} onChange={v=>pt({profile:v})}>{Object.keys(PROFILE).map(x=><option key={x}>{x}</option>)}</Sel><div className="chips">{Object.keys(FIT).map(n=><button key={n} className={tray.fit===n?'active':''} onClick={()=>doiFit(n)}>{n}</button>)}</div><Num label="Độ hở mỗi bên" value={tray.clearance} onChange={v=>pt({clearance:v})} step={.05}/><Sel label="Vật liệu" value={tray.material} onChange={doiVL}>{Object.keys(VAT_LIEU).map(x=><option key={x}>{x}</option>)}</Sel><Num label="Bù co ngót" value={tray.shrink} onChange={v=>pt({shrink:v})} step={.05} suffix="%"/></section><section><h3>Bố cục khay</h3><div className="two"><Num label="Số hàng" value={tray.rows} onChange={v=>pt({rows:Math.max(1,Math.min(12,Math.round(v)))})} step={1} suffix=""/><Num label="Số cột" value={tray.cols} onChange={v=>pt({cols:Math.max(1,Math.min(16,Math.round(v)))})} step={1} suffix=""/></div><Num label="Khoảng tâm X" value={tray.pitchX} onChange={v=>pt({pitchX:v})}/><Num label="Khoảng tâm Y" value={tray.pitchY} onChange={v=>pt({pitchY:v})}/><Num label="Lề ngoài" value={tray.edge} onChange={v=>pt({edge:v})}/><Num label="Thành tối thiểu giữa ô" value={tray.wallBetween} onChange={v=>pt({wallBetween:v})}/></section>{tray.mode==='Hốc chứa'?<section><h3>Hình học hốc</h3><Num label="Độ dày đáy" value={tray.base} onChange={v=>pt({base:v})}/><Num label="Độ sâu hốc" value={tray.depth} onChange={v=>pt({depth:v})}/><Num label="Gờ miệng" value={tray.lip} onChange={v=>pt({lip:v})}/><Num label="Độ thu đáy hốc" value={tray.taper} onChange={v=>pt({taper:v})}/><Num label="Bo góc hốc" value={tray.slotRadius} onChange={v=>pt({slotRadius:v})}/><label className="toggle"><input type="checkbox" checked={tray.notch} onChange={e=>pt({notch:e.target.checked})}/>Tạo khấc lấy keycap</label>{tray.notch&&<Num label="Bán kính khấc" value={tray.notchRadius} onChange={v=>pt({notchRadius:v})}/>}</section>:<section><h3>Chốt gắn MX</h3><Num label="Độ dày tấm" value={tray.mountPlate} onChange={v=>pt({mountPlate:v})}/><Num label="Chiều cao chốt" value={tray.pegHeight} onChange={v=>pt({pegHeight:v})}/><Num label="Chiều dài dấu cộng" value={tray.pegTotal} onChange={v=>pt({pegTotal:v})} step={.05}/><Num label="Độ dày tay dấu cộng" value={tray.pegArm} onChange={v=>pt({pegArm:v})} step={.02}/><label className="toggle"><input type="checkbox" checked={tray.ring} onChange={e=>pt({ring:e.target.checked})}/>Vòng đỡ keycap</label></section>}</>:<><section><h3>Hình dáng keycap</h3><Sel label="Kích thước" value={key.unit} onChange={v=>pk({unit:v})}>{Object.keys(DON_VI).map(x=><option key={x}>{x}</option>)}</Sel><Sel label="Profile" value={key.profile} onChange={v=>pk({profile:v})}>{Object.keys(PROFILE).map(x=><option key={x}>{x}</option>)}</Sel><Num label="Độ dày thành" value={key.wall} onChange={v=>pk({wall:v})}/><Num label="Độ dày mặt trên" value={key.topThickness} onChange={v=>pk({topThickness:v})}/><Num label="Bo góc thân" value={key.corner} onChange={v=>pk({corner:v})}/></section><section><h3>Lỗ cắm Cherry MX</h3><Num label="Đường kính housing" value={key.socketOuter} onChange={v=>pk({socketOuter:v})}/><Num label="Chiều cao housing" value={key.socketHeight} onChange={v=>pk({socketHeight:v})}/><Num label="Tổng chiều dài khe +" value={key.crossTotal} onChange={v=>pk({crossTotal:v})} step={.01}/><Num label="Độ dày tay khe +" value={key.crossArm} onChange={v=>pk({crossArm:v})} step={.01}/><Num label="Dung sai FDM" value={key.tolerance} onChange={v=>pk({tolerance:v})} step={.02}/></section></>}</aside><section className="viewer"><Canvas camera={{position:[48,36,56],fov:34}}><Scene tool={tool} built={built} keyGeom={keyGeom} view={view} colors={colors} wire={wire} alpha={alpha} showSamples={showSamples} tray={tray} modelRef={modelRef}/></Canvas><div className="viewerTop"><span className="statusDot"/>Mô hình đang cập nhật theo thông số</div><div className="hint">Kéo để xoay • Lăn chuột để zoom</div></section><aside className="inspector"><section><h3>Góc nhìn</h3><div className="viewgrid">{['Phối cảnh','Trên','Dưới','Trước','Sau','Trái','Phải'].map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v}</button>)}</div><label className="toggle"><input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>Hiện lưới cạnh</label><label className="toggle"><input type="checkbox" checked={alpha} onChange={e=>setAlpha(e.target.checked)}/>Trong suốt mô hình</label>{tool==='Khay'&&tray.mode==='Hốc chứa'&&<label className="toggle"><input type="checkbox" checked={showSamples} onChange={e=>setShowSamples(e.target.checked)}/>Hiện keycap mẫu trong khay</label>}</section><section><h3>Màu xem trước</h3><label className="colorRow"><span>Màu khay / keycap chính</span><input type="color" value={colors.tray} onChange={e=>setColors({...colors,tray:e.target.value})}/></label><label className="colorRow"><span>Màu keycap mẫu</span><input type="color" value={colors.keycap} onChange={e=>setColors({...colors,keycap:e.target.value})}/></label><label className="colorRow"><span>Màu lưới</span><input type="color" value={colors.grid} onChange={e=>setColors({...colors,grid:e.target.value})}/></label><label className="colorRow"><span>Màu nền</span><input type="color" value={colors.background} onChange={e=>setColors({...colors,background:e.target.value})}/></label></section>{tool==='Khay'&&<section><h3>Kích thước khay</h3><div className="stats"><span>Rộng <b>{built.W.toFixed(2)} mm</b></span><span>Sâu <b>{built.D.toFixed(2)} mm</b></span><span>Cao <b>{built.H.toFixed(2)} mm</b></span><span>Miệng ô <b>{built.openW.toFixed(2)} × {built.openD.toFixed(2)} mm</b></span></div></section>}<section><h3>Kiểm tra</h3>{warnings.length?warnings.map((w,i)=><p className="warning" key={i}>{w}</p>):<p className="ok">Thông số hiện tại hợp lý.</p>}</section><section className="tip"><h3>Lưu ý khi in</h3><p><b>Nên in thử 1–3 ô</b> trước khi in toàn bộ khay. Với PETG, có thể tăng độ hở thêm 0.05–0.15 mm tùy máy.</p></section></aside></main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
