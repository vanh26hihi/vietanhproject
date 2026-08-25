import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import * as opentype from "opentype.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { Download, Plus, Trash2, Copy, Type, Grid3X3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildKeycap, mergeGeometries } from "./geometry";
import { DEFAULT_PARAMS, PROFILES, applyProfile, type KeycapParams, type ProfileId } from "./params";

type FontDef={id:string;name:string;url:string;preview:string};
type Cap={id:string;text:string;color:string;textColor:string;fontId:string;fontSize:number;textDepth:number;iconId:string|null};
type PixelIcon={id:string;name:string;color:string;matrix:string[]};

const FONTS:FontDef[]=[
 {id:"be-black",name:"Be Vietnam Pro Black",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Black.ttf",preview:"Arial Black,sans-serif"},
 {id:"be-extrabold",name:"Be Vietnam Pro ExtraBold",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-ExtraBold.ttf",preview:"Arial Black,sans-serif"},
 {id:"be-bold",name:"Be Vietnam Pro Bold",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf",preview:"Arial,sans-serif"},
 {id:"be-medium",name:"Be Vietnam Pro Medium",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Medium.ttf",preview:"Arial,sans-serif"},
 {id:"be-regular",name:"Be Vietnam Pro Regular",url:"https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf",preview:"Arial,sans-serif"}
];
const FONT_MAP=Object.fromEntries(FONTS.map(x=>[x.id,x])) as Record<string,FontDef>;
const fontCache=new Map<string,opentype.Font>();
async function loadOTFont(id:string){
 if(fontCache.has(id))return fontCache.get(id)!;
 const def=FONT_MAP[id]||FONTS[0];
 const buf=await fetch(def.url).then(r=>{if(!r.ok)throw new Error(`Font HTTP ${r.status}`);return r.arrayBuffer()});
 const f=opentype.parse(buf);fontCache.set(id,f);return f;
}

const ICONS:PixelIcon[]=[
 {id:"smile",name:"Smile",color:"#111111",matrix:["0000000","0110110","0110110","0000000","1000001","0111110","0000000"]},
 {id:"haha",name:"HA HA",color:"#111111",matrix:["1010101","1110111","1010101","0000000","1010101","1110111","1010101"]},
 {id:"sad",name:"Sad",color:"#111111",matrix:["0110110","0110110","0000000","0000000","0111110","1000001","0000000"]},
 {id:"angry",name:"Angry",color:"#ff4b32",matrix:["1001001","0111110","0011100","1111111","0011100","0111110","1001001"]},
 {id:"rage",name:"Rage",color:"#ff3b24",matrix:["0101010","1111111","0011100","1111111","0011100","1111111","0101010"]},
 {id:"heart",name:"Heart",color:"#f21f46",matrix:["0110110","1111111","1111111","1111111","0111110","0011100","0001000"]},
 {id:"hearts",name:"Hearts",color:"#f21f46",matrix:["1100000","1110001","0100011","0000111","0010010","0111000","0010000"]},
 {id:"broken",name:"Broken Heart",color:"#f21f46",matrix:["0110110","1111111","1101111","1011111","0110110","0011100","0001000"]},
 {id:"sun",name:"Sun",color:"#ff9418",matrix:["0001000","0101010","0011100","1111111","0011100","0101010","0001000"]},
 {id:"sparkles",name:"Sparkles",color:"#ff9418",matrix:["1000001","0101010","0011100","1111111","0011100","0101010","1000001"]},
 {id:"music",name:"Music",color:"#111111",matrix:["0011110","0010010","0010010","0010010","1110010","1110110","0000000"]},
 {id:"dollar",name:"Dollar",color:"#f58a11",matrix:["0011100","0111110","0110000","0011100","0000110","0111110","0011100"]},
 {id:"cloud",name:"Cloud",color:"#555555",matrix:["0000000","0011000","0111100","1111110","1111111","0111110","0000000"]},
 {id:"drop",name:"Drop",color:"#168ddd",matrix:["0001000","0011100","0011100","0111110","0111110","0011100","0001000"]},
 {id:"sleep",name:"Sleep Z",color:"#111111",matrix:["1111110","0001100","0011000","0110000","1100000","1111110","0000000"]},
 {id:"question",name:"Question",color:"#168ddd",matrix:["0111110","1100011","0000110","0001100","0011000","0000000","0011000"]},
 {id:"exclamation",name:"Exclamation",color:"#ff352b",matrix:["0011000","0011000","0011000","0011000","0011000","0000000","0011000"]},
 {id:"hands",name:"Hands",color:"#ff9418",matrix:["1001001","1101011","1111111","0111110","0011100","0011100","0001000"]},
 {id:"spiral",name:"Spiral",color:"#111111",matrix:["0111110","1100011","1011101","1010101","1011111","1100000","0111110"]},
 {id:"cross",name:"Cross",color:"#ff3b24",matrix:["1100011","0110110","0011100","0001000","0011100","0110110","1100011"]},
 {id:"battery",name:"Battery",color:"#168ddd",matrix:["0011100","0111110","1100011","1101011","1100011","0111110","0011100"]},
 {id:"plain-heart",name:"♥",color:"#4f2f72",matrix:["0110110","1111111","1111111","1111111","0111110","0011100","0001000"]},
 {id:"plain-star",name:"★",color:"#4f2f72",matrix:["0001000","0101010","0011100","1111111","0111110","0110110","1100011"]},
 {id:"plain-exclamation",name:"!",color:"#4f2f72",matrix:["0011000","0011000","0011000","0011000","0011000","0000000","0011000"]},
 {id:"plain-question",name:"?",color:"#4f2f72",matrix:["0111110","1100011","0000110","0001100","0011000","0000000","0011000"]},
 {id:"heart-badge",name:"Heart badge",color:"#f21f46",matrix:["0110110","1111111","1111111","1111111","0111110","0011100","0001000"]},
 {id:"sun-badge",name:"Sun badge",color:"#ff9418",matrix:["0001000","0101010","0011100","1111111","0011100","0101010","0001000"]},
 {id:"music-badge",name:"Music badge",color:"#111111",matrix:["0011110","0010010","0010010","0010010","1110010","1110110","0000000"]}
];
const ICON_MAP=Object.fromEntries(ICONS.map(x=>[x.id,x])) as Record<string,PixelIcon>;

function pathToGeometry(font:opentype.Font,text:string,size:number,depth:number){
 const path=font.getPath(text,0,0,size);
 const sp=new THREE.ShapePath();
 for(const c of path.commands as any[]){
  if(c.type==='M')sp.moveTo(c.x,c.y);
  else if(c.type==='L')sp.lineTo(c.x,c.y);
  else if(c.type==='C')sp.bezierCurveTo(c.x1,c.y1,c.x2,c.y2,c.x,c.y);
  else if(c.type==='Q')sp.quadraticCurveTo(c.x1,c.y1,c.x,c.y);
  else if(c.type==='Z')sp.currentPath?.closePath();
 }
 const shapes=sp.toShapes(true);
 if(!shapes.length)return null;
 const g=new THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:2,curveSegments:10}).toNonIndexed();
 g.computeBoundingBox();const b=g.boundingBox!;g.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,0);g.computeVertexNormals();return g;
}
function pixelGeo(icon:PixelIcon,z:number){const parts:THREE.BufferGeometry[]=[],px=.62,d=.5;for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(icon.matrix[y][x]==='1'){const g=new THREE.BoxGeometry(px,px,d).toNonIndexed();g.translate((x-3)*px,(3-y)*px,z+d/2);parts.push(g)}return parts.length?mergeGeometries(parts):null}
function badgeGeo(z:number){const g=new THREE.BoxGeometry(6.5,6.2,.3).toNonIndexed();g.translate(0,0,z+.15);return g}
function saveSTL(name:string,meshes:{g:THREE.BufferGeometry;color:string}[]){const root=new THREE.Group();for(const m of meshes)root.add(new THREE.Mesh(m.g,new THREE.MeshBasicMaterial({color:m.color})));root.updateMatrixWorld(true);const dv=new STLExporter().parse(root,{binary:true}) as DataView;const blob=new Blob([new Uint8Array(dv.buffer,dv.byteOffset,dv.byteLength)],{type:'model/stl'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

function Scene({items}:{items:{g:THREE.BufferGeometry;color:string}[]}){return <Canvas shadows><color attach="background" args={["#f4f6f8"]}/><PerspectiveCamera makeDefault position={[34,-44,30]} fov={34} up={[0,0,1]}/><OrbitControls makeDefault target={[0,0,5]}/><ambientLight intensity={1.1}/><directionalLight position={[20,-30,45]} intensity={1.6}/>{items.map((x,i)=><mesh key={i} geometry={x.g}><meshStandardMaterial color={x.color} roughness={.4}/></mesh>)}<Grid args={[220,220]} rotation={[Math.PI/2,0,0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={150}/></Canvas>}

const palette=["#f3c9cf","#f4e4a9","#cfeccf","#cddff1","#e1d0ec","#f3c9cf","#f4e4a9"];
const makeCap=(text:string,i:number):Cap=>({id:`cap-${Date.now()}-${i}-${Math.random()}`,text,color:palette[i%palette.length],textColor:"#55446f",fontId:"be-black",fontSize:5,textDepth:.55,iconId:null});

export default function KeycapAdvancedV5(){
 const[p,setP]=useState<KeycapParams>({...DEFAULT_PARAMS,profileId:"xda",topWidth:14,topDepth:14,height:9,topTilt:0,sideDraft:3,dishDepth:0,stemHeight:4.7});
 const[caps,setCaps]=useState<Cap[]>(()=>[makeCap("A",0)]);
 const[selectedId,setSelectedId]=useState(caps[0].id);
 const[batch,setBatch]=useState("A");
 const[fonts,setFonts]=useState<Record<string,opentype.Font>>({});
 const[fontErr,setFontErr]=useState("");
 const selected=caps.find(x=>x.id===selectedId)||caps[0];

 useEffect(()=>{for(const id of Array.from(new Set(caps.map(c=>c.fontId))))if(!fonts[id])loadOTFont(id).then(f=>setFonts(s=>({...s,[id]:f}))).catch(e=>setFontErr(String(e)))},[caps]);
 const rebuildBatch=()=>{const tokens=batch.trim().split(/\s+/u).filter(Boolean);const next=(tokens.length?tokens:["A"]).map((t,i)=>makeCap(t,i));setCaps(next);setSelectedId(next[0].id)};
 const addCap=()=>{const c=makeCap("KEY",caps.length);setCaps(x=>[...x,c]);setSelectedId(c.id);setBatch(x=>(x.trim()?x.trim()+" ":"")+"KEY")};
 const cloneCap=()=>{if(!selected)return;const c={...selected,id:`cap-${Date.now()}-clone`};setCaps(x=>[...x,c]);setSelectedId(c.id)};
 const delCap=(id:string)=>{if(caps.length<=1)return;const n=caps.filter(x=>x.id!==id);setCaps(n);setSelectedId(n[0].id);setBatch(n.map(x=>x.text).join(" "))};
 const patchCap=(x:Partial<Cap>)=>setCaps(cs=>cs.map(c=>c.id===selectedId?{...c,...x}:c));
 const setPField=<K extends keyof KeycapParams>(k:K,v:KeycapParams[K])=>setP(x=>({...x,[k]:v}));

 const items=useMemo(()=>{const out:{g:THREE.BufferGeometry;color:string}[]=[];const base=buildKeycap(p);const n=caps.length;caps.forEach((c,i)=>{const off=(i-(n-1)/2)*p.pitch;const body=base.shell.clone();body.translate(off,0,0);out.push({g:body,color:c.color});if(base.stems){const st=base.stems.clone();st.translate(off,0,0);out.push({g:st,color:"#d8dbe5"})}const f=fonts[c.fontId];if(f&&c.text){const tg=pathToGeometry(f,c.text,c.fontSize,c.textDepth);if(tg){tg.computeBoundingBox();const b=tg.boundingBox!;const maxW=p.topWidth-1.5,maxH=p.topDepth-1.5,w=b.max.x-b.min.x,h=b.max.y-b.min.y,sc=Math.min(1,maxW/Math.max(.1,w),maxH/Math.max(.1,h));tg.scale(sc,sc,1);tg.translate(off,0,p.height+.08);out.push({g:tg,color:c.textColor})}}if(c.iconId){const ic=ICON_MAP[c.iconId];const bg=badgeGeo(p.height+.05);bg.translate(off,0,0);out.push({g:bg,color:"#fffdf9"});const ig=pixelGeo(ic,p.height+.38);if(ig){ig.translate(off,0,0);out.push({g:ig,color:ic.color})}}});return out},[caps,p,fonts]);

 return <div className="grid h-full min-h-0 grid-cols-[310px_1fr_360px] bg-background">
  <aside className="space-y-3 overflow-y-auto border-r p-3">
   <section className="border bg-card p-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">KEYCAP COLLECTION V5</h2><p className="text-[9px] uppercase tracking-[.16em] text-muted-foreground">Multi-keycap thật · Vietnamese TTF</p></div><span className="border bg-muted px-2 py-1 font-mono text-[10px]">{caps.length} keycap</span></div></section>
   <section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Tạo nhanh nhiều keycap</h3><p className="text-[9px] text-muted-foreground">Khoảng trắng hoặc xuống dòng = thêm 1 keycap.</p><textarea value={batch} onChange={e=>setBatch(e.target.value)} rows={4} placeholder="A B C D E\nViết ệ Đ ư ơ" className="w-full border bg-background p-2 font-mono text-xs"/><button onClick={rebuildBatch} className="h-9 w-full bg-primary text-[10px] font-medium text-primary-foreground">Tạo / cập nhật dãy keycap</button><div className="flex flex-wrap gap-1">{caps.map((c,i)=><button key={c.id} onClick={()=>setSelectedId(c.id)} className={`border px-2 py-1 text-[9px] ${selectedId===c.id?"border-primary bg-primary/5":""}`}>{i+1}. {c.text}</button>)}</div><div className="grid grid-cols-3 gap-1"><button onClick={addCap} className="flex h-8 items-center justify-center gap-1 border text-[9px]"><Plus className="size-3"/>Thêm</button><button onClick={cloneCap} className="flex h-8 items-center justify-center gap-1 border text-[9px]"><Copy className="size-3"/>Clone</button><button onClick={()=>selected&&delCap(selected.id)} className="flex h-8 items-center justify-center gap-1 border text-[9px] text-red-600"><Trash2 className="size-3"/>Xóa</button></div></section>
   <section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Keycap mặc định</h3><div className="grid grid-cols-5 gap-1">{(Object.keys(PROFILES) as ProfileId[]).map(id=><button key={id} onClick={()=>setP(x=>({...applyProfile(x,id),dishDepth:x.dishDepth,stemHeight:4.7}))} className={`border px-1 py-1 text-[9px] ${p.profileId===id?"bg-primary text-primary-foreground":""}`}>{PROFILES[id].label}</button>)}</div><label className="grid grid-cols-[1fr_90px] text-[10px] items-center">Dish depth<input type="number" value={p.dishDepth} step=.05 min=0 onChange={e=>setPField("dishDepth",Math.max(0,Number(e.target.value)))} className="h-8 border bg-background px-2 text-right"/></label><label className="grid grid-cols-[1fr_90px] text-[10px] items-center">Stem height<input type="number" value={p.stemHeight} step=.05 onChange={e=>setPField("stemHeight",Number(e.target.value))} className="h-8 border bg-background px-2 text-right"/></label><label className="grid grid-cols-[1fr_90px] text-[10px] items-center">Pitch<input type="number" value={p.pitch} step=.05 onChange={e=>setPField("pitch",Number(e.target.value))} className="h-8 border bg-background px-2 text-right"/></label></section>
  </aside>
  <main className="min-h-0"><Scene items={items}/></main>
  <aside className="space-y-3 overflow-y-auto border-l p-3">
   {selected&&<><section className="space-y-2 border bg-card p-3"><div className="flex items-center gap-2"><Type className="size-4"/><h3 className="text-[10px] font-semibold uppercase">Keycap {caps.findIndex(x=>x.id===selected.id)+1}</h3></div><label className="text-[9px]">Text<input value={selected.text} onChange={e=>{patchCap({text:e.target.value});setBatch(caps.map(c=>c.id===selected.id?e.target.value:c.text).join(" "))}} className="mt-1 h-9 w-full border bg-background px-2 text-sm"/></label><p className="text-[9px] text-emerald-700">Hỗ trợ tiếng Việt: Viết, ệ, Đ, ă, â, ê, ô, ơ, ư...</p><label className="text-[9px]">Font<select value={selected.fontId} onChange={e=>patchCap({fontId:e.target.value})} className="mt-1 h-9 w-full border bg-background px-2">{FONTS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-[9px]">Cỡ chữ<input type="number" value={selected.fontSize} step=.1 onChange={e=>patchCap({fontSize:Number(e.target.value)})} className="mt-1 h-8 w-full border bg-background px-2"/></label><label className="text-[9px]">Độ nổi<input type="number" value={selected.textDepth} step=.05 onChange={e=>patchCap({textDepth:Number(e.target.value)})} className="mt-1 h-8 w-full border bg-background px-2"/></label></div><div className="grid grid-cols-2 gap-2"><label className="text-[9px]">Màu keycap<input type="color" value={selected.color} onChange={e=>patchCap({color:e.target.value})} className="mt-1 h-8 w-full border"/></label><label className="text-[9px]">Màu chữ<input type="color" value={selected.textColor} onChange={e=>patchCap({textColor:e.target.value})} className="mt-1 h-8 w-full border"/></label></div>{fontErr&&<p className="text-[9px] text-red-600">{fontErr}</p>}</section>
   <section className="border bg-card p-3"><div className="mb-2 flex items-center gap-2"><Grid3X3 className="size-4"/><h3 className="text-[10px] font-semibold uppercase">Icon Library · 28</h3></div><div className="grid grid-cols-7 gap-1">{ICONS.map(ic=><button key={ic.id} title={ic.name} onClick={()=>patchCap({iconId:selected.iconId===ic.id?null:ic.id})} className={`aspect-square border p-1 ${selected.iconId===ic.id?"border-primary bg-primary/10":"bg-[#fbfaf7]"}`}><div className="grid h-full grid-cols-7 grid-rows-7">{ic.matrix.flatMap((r,y)=>Array.from(r).map((v,x)=><span key={`${x}-${y}`} style={{background:v==='1'?ic.color:'transparent'}}/>))}</div></button>)}</div><button onClick={()=>patchCap({iconId:null})} className="mt-2 h-8 w-full border text-[9px]">Bỏ icon</button></section></>}
   <section className="sticky bottom-0 border bg-card p-3 shadow-[0_-6px_20px_rgba(15,23,42,.06)]"><button onClick={()=>saveSTL('keycap-collection.stl',items)} className="flex h-10 w-full items-center justify-center gap-2 bg-primary text-[10px] font-medium text-primary-foreground"><Download className="size-4"/>Export {caps.length} keycap STL</button></section>
  </aside>
 </div>
}
