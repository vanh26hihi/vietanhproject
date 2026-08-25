import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import * as opentype from "opentype.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { Copy, Download, Grid3X3, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildKeycap, mergeGeometries } from "./geometry";
import { DEFAULT_PARAMS, PROFILES, applyProfile } from "./params";
import { ICONS, ICON_MAP } from "./iconLibraryV5";

const FONTS=[
  {id:"black",name:"Be Vietnam Pro Black",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Black.ttf"},
  {id:"extra",name:"Be Vietnam Pro ExtraBold",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-ExtraBold.ttf"},
  {id:"bold",name:"Be Vietnam Pro Bold",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf"},
  {id:"medium",name:"Be Vietnam Pro Medium",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Medium.ttf"},
  {id:"regular",name:"Be Vietnam Pro Regular",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf"}
];
const FONT_MAP=Object.fromEntries(FONTS.map(x=>[x.id,x]));
const fontCache=new Map();
async function loadFont(id){
  if(fontCache.has(id)) return fontCache.get(id);
  const def=FONT_MAP[id]||FONTS[0];
  const buf=await fetch(def.url).then(r=>{if(!r.ok)throw new Error(`Font HTTP ${r.status}`);return r.arrayBuffer()});
  const font=opentype.parse(buf);fontCache.set(id,font);return font;
}
function textGeometry(font,text,size,depth){
  const path=font.getPath(text,0,0,size),sp=new THREE.ShapePath();
  for(const c of path.commands){
    if(c.type==="M")sp.moveTo(c.x,c.y);
    else if(c.type==="L")sp.lineTo(c.x,c.y);
    else if(c.type==="C")sp.bezierCurveTo(c.x1,c.y1,c.x2,c.y2,c.x,c.y);
    else if(c.type==="Q")sp.quadraticCurveTo(c.x1,c.y1,c.x,c.y);
    else if(c.type==="Z")sp.currentPath?.closePath();
  }
  const shapes=sp.toShapes(true);if(!shapes.length)return null;
  const g=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:2,curveSegments:10}).toNonIndexed();
  g.computeBoundingBox();const b=g.boundingBox;g.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,0);return g;
}
function iconGeometry(id,z){
  const icon=ICON_MAP[id];if(!icon)return null;
  const parts=[],px=.62,d=.5;
  for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(icon.matrix[y][x]==="1"){
    const g=new THREE.BoxGeometry(px,px,d).toNonIndexed();g.translate((x-3)*px,(3-y)*px,z+d/2);parts.push(g);
  }
  return parts.length?mergeGeometries(parts):null;
}
function badgeGeometry(z){const g=new THREE.BoxGeometry(6.5,6.2,.3).toNonIndexed();g.translate(0,0,z+.15);return g;}
function exportSTL(items){
  const root=new THREE.Group();items.forEach(i=>root.add(new THREE.Mesh(i.g,new THREE.MeshBasicMaterial({color:i.color}))));root.updateMatrixWorld(true);
  const dv=new STLExporter().parse(root,{binary:true}),blob=new Blob([new Uint8Array(dv.buffer,dv.byteOffset,dv.byteLength)],{type:"model/stl"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="keycap-collection.stl";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Scene({items}){return <Canvas shadows><color attach="background" args={["#f4f6f8"]}/><PerspectiveCamera makeDefault position={[38,-48,31]} fov={34} up={[0,0,1]}/><OrbitControls makeDefault target={[0,0,5]}/><ambientLight intensity={1.1}/><directionalLight position={[20,-30,45]} intensity={1.6}/>{items.map((x,i)=><mesh key={i} geometry={x.g}><meshStandardMaterial color={x.color} roughness={.4}/></mesh>)}<Grid args={[240,240]} rotation={[Math.PI/2,0,0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={160}/></Canvas>}
const colors=["#f3c9cf","#f4e4a9","#cfeccf","#cddff1","#e1d0ec","#f3c9cf","#f4e4a9"];
const makeCap=(text,i)=>({id:`cap-${Date.now()}-${i}-${Math.random()}`,text,color:colors[i%colors.length],textColor:"#55446f",fontId:"black",fontSize:5,textDepth:.55,iconId:null});

export default function KeycapAdvancedV5(){
  const[p,setP]=useState({...DEFAULT_PARAMS,profileId:"xda",topWidth:14,topDepth:14,height:9,topTilt:0,sideDraft:3,dishDepth:0,stemHeight:4.7});
  const[caps,setCaps]=useState(()=>[makeCap("A",0)]);
  const[selectedId,setSelectedId]=useState(caps[0].id);
  const[batch,setBatch]=useState("A");
  const[fonts,setFonts]=useState({});
  const[fontError,setFontError]=useState("");
  const selected=caps.find(c=>c.id===selectedId)||caps[0];
  useEffect(()=>{for(const id of [...new Set(caps.map(c=>c.fontId))])if(!fonts[id])loadFont(id).then(f=>setFonts(s=>({...s,[id]:f}))).catch(e=>setFontError(String(e)))},[caps]);
  const rebuild=()=>{const tokens=batch.trim().split(/\s+/u).filter(Boolean),next=(tokens.length?tokens:["A"]).map(makeCap);setCaps(next);setSelectedId(next[0].id)};
  const patch=x=>setCaps(cs=>cs.map(c=>c.id===selectedId?{...c,...x}:c));
  const add=()=>{const c=makeCap("KEY",caps.length);setCaps(cs=>[...cs,c]);setSelectedId(c.id);setBatch(b=>(b.trim()?b.trim()+" ":"")+"KEY")};
  const clone=()=>{if(!selected)return;const c={...selected,id:`clone-${Date.now()}`};setCaps(cs=>[...cs,c]);setSelectedId(c.id)};
  const remove=()=>{if(caps.length<=1||!selected)return;const next=caps.filter(c=>c.id!==selected.id);setCaps(next);setSelectedId(next[0].id);setBatch(next.map(c=>c.text).join(" "))};
  const items=useMemo(()=>{
    const out=[],base=buildKeycap(p),n=caps.length;
    caps.forEach((c,i)=>{
      const off=(i-(n-1)/2)*p.pitch,body=base.shell.clone();body.translate(off,0,0);out.push({g:body,color:c.color});
      if(base.stems){const st=base.stems.clone();st.translate(off,0,0);out.push({g:st,color:"#d8dbe5"});}
      const font=fonts[c.fontId];
      if(font&&c.text){const g=textGeometry(font,c.text,c.fontSize,c.textDepth);if(g){g.computeBoundingBox();const b=g.boundingBox,w=b.max.x-b.min.x,h=b.max.y-b.min.y,scale=Math.min(1,(p.topWidth-1.5)/Math.max(.1,w),(p.topDepth-1.5)/Math.max(.1,h));g.scale(scale,scale,1);g.translate(off,0,p.height+.08);out.push({g,color:c.textColor});}}
      if(c.iconId){const bg=badgeGeometry(p.height+.05);bg.translate(off,0,0);out.push({g:bg,color:"#fffdf9"});const ig=iconGeometry(c.iconId,p.height+.38);if(ig){ig.translate(off,0,0);out.push({g:ig,color:ICON_MAP[c.iconId].color});}}
    });return out;
  },[caps,p,fonts]);
  return <div className="grid h-full min-h-0 grid-cols-[310px_1fr_360px] bg-background">
    <aside className="space-y-3 overflow-y-auto border-r p-3">
      <section className="border bg-card p-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">KEYCAP COLLECTION V5</h2><p className="text-[9px] uppercase tracking-[.16em] text-muted-foreground">Multi-keycap thật · Vietnamese TTF</p></div><span className="border bg-muted px-2 py-1 text-[10px]">{caps.length} keycap</span></div></section>
      <section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Tạo nhanh nhiều keycap</h3><p className="text-[9px] text-muted-foreground">Khoảng trắng hoặc xuống dòng = thêm 1 keycap.</p><textarea value={batch} onChange={e=>setBatch(e.target.value)} rows={4} placeholder={'A B C D E\nViết ệ Đ ư ơ'} className="w-full border bg-background p-2 text-xs"/><button onClick={rebuild} className="h-9 w-full bg-primary text-[10px] text-primary-foreground">Tạo / cập nhật dãy keycap</button><div className="flex flex-wrap gap-1">{caps.map((c,i)=><button key={c.id} onClick={()=>setSelectedId(c.id)} className={`border px-2 py-1 text-[9px] ${selectedId===c.id?"border-primary bg-muted":""}`}>{i+1}. {c.text}</button>)}</div><div className="grid grid-cols-3 gap-1"><button onClick={add} className="h-8 border text-[9px]"><Plus className="mr-1 inline size-3"/>Thêm</button><button onClick={clone} className="h-8 border text-[9px]"><Copy className="mr-1 inline size-3"/>Clone</button><button onClick={remove} className="h-8 border text-[9px] text-red-600"><Trash2 className="mr-1 inline size-3"/>Xóa</button></div></section>
      <section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Thông số chung</h3><div className="grid grid-cols-5 gap-1">{Object.keys(PROFILES).map(id=><button key={id} onClick={()=>setP(x=>({...applyProfile(x,id),dishDepth:x.dishDepth,stemHeight:4.7}))} className={`border px-1 py-1 text-[9px] ${p.profileId===id?"bg-primary text-primary-foreground":""}`}>{PROFILES[id].label}</button>)}</div><label className="grid grid-cols-[1fr_90px] items-center text-[10px]">Dish depth<input type="number" value={p.dishDepth} step=.05 min=0 onChange={e=>setP(x=>({...x,dishDepth:Math.max(0,Number(e.target.value))}))} className="h-8 border bg-background px-2"/></label><label className="grid grid-cols-[1fr_90px] items-center text-[10px]">Stem height<input type="number" value={p.stemHeight} step=.05 onChange={e=>setP(x=>({...x,stemHeight:Number(e.target.value)}))} className="h-8 border bg-background px-2"/></label><label className="grid grid-cols-[1fr_90px] items-center text-[10px]">Pitch<input type="number" value={p.pitch} step=.05 onChange={e=>setP(x=>({...x,pitch:Number(e.target.value)}))} className="h-8 border bg-background px-2"/></label></section>
    </aside>
    <main className="min-h-0"><Scene items={items}/></main>
    <aside className="space-y-3 overflow-y-auto border-l p-3">
      {selected&&<><section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Keycap {caps.findIndex(c=>c.id===selected.id)+1}</h3><label className="text-[9px]">Text<input value={selected.text} onChange={e=>patch({text:e.target.value})} className="mt-1 h-9 w-full border bg-background px-2 text-sm"/></label><p className="text-[9px] text-emerald-700">Tiếng Việt: Viết, ệ, Đ, ă, â, ê, ô, ơ, ư...</p><label className="text-[9px]">Font<select value={selected.fontId} onChange={e=>patch({fontId:e.target.value})} className="mt-1 h-9 w-full border bg-background px-2">{FONTS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-[9px]">Cỡ chữ<input type="number" value={selected.fontSize} step=.1 onChange={e=>patch({fontSize:Number(e.target.value)})} className="mt-1 h-8 w-full border"/></label><label className="text-[9px]">Độ nổi<input type="number" value={selected.textDepth} step=.05 onChange={e=>patch({textDepth:Number(e.target.value)})} className="mt-1 h-8 w-full border"/></label></div><div className="grid grid-cols-2 gap-2"><label className="text-[9px]">Màu keycap<input type="color" value={selected.color} onChange={e=>patch({color:e.target.value})} className="mt-1 h-8 w-full border"/></label><label className="text-[9px]">Màu chữ<input type="color" value={selected.textColor} onChange={e=>patch({textColor:e.target.value})} className="mt-1 h-8 w-full border"/></label></div>{fontError&&<p className="text-[9px] text-red-600">{fontError}</p>}</section><section className="border bg-card p-3"><div className="mb-2 flex items-center gap-2"><Grid3X3 className="size-4"/><h3 className="text-[10px] font-semibold uppercase">Icon Library · 28</h3></div><div className="grid grid-cols-7 gap-1">{ICONS.map(ic=><button key={ic.id} title={ic.name} onClick={()=>patch({iconId:selected.iconId===ic.id?null:ic.id})} className={`aspect-square border p-1 ${selected.iconId===ic.id?"border-primary bg-muted":""}`}><div className="grid h-full grid-cols-7 grid-rows-7">{ic.matrix.flatMap((r,y)=>Array.from(r).map((v,x)=><span key={`${x}-${y}`} style={{background:v==="1"?ic.color:"transparent"}}/>))}</div></button>)}</div></section></>}
      <section className="sticky bottom-0 border bg-card p-3"><button onClick={()=>exportSTL(items)} className="h-10 w-full bg-primary text-[10px] text-primary-foreground"><Download className="mr-1 inline size-4"/>Export {caps.length} keycap STL</button></section>
    </aside>
  </div>;
}
