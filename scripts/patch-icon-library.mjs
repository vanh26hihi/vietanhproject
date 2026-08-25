import fs from 'node:fs';

const file='src/lovable/KeycapAdvancedV4.tsx';
let s=fs.readFileSync(file,'utf8');
if(s.includes('/* ICON_LIBRARY_V1 */')){console.log('icon library already applied');process.exit(0)}

s=s.replace('type ExportMode="combined"|"body"|"stem"|"legends";','type ExportMode="combined"|"body"|"stem"|"legends"|"icons";');
s=s.replace('type LegendCfg={id:string;text:string;fontId:string;size:number;depth:number;letterSpacing:number;lineHeight:number;align:Align;vAlign:VAlign;bevel:boolean;bevelSize:number;bevelThickness:number;zLift:number;placement:Placement;fit:FitMode};',`type LegendCfg={id:string;text:string;fontId:string;size:number;depth:number;letterSpacing:number;lineHeight:number;align:Align;vAlign:VAlign;bevel:boolean;bevelSize:number;bevelThickness:number;zLift:number;placement:Placement;fit:FitMode};
/* ICON_LIBRARY_V1 */
type IconDef={id:string;name:string;matrix:string[];color:string;badge:boolean};
type IconInst={id:string;defId:string};`);

const iconBlock=String.raw`
const ICONS:IconDef[]=[
 {id:"smile",name:"Smile",color:"#111111",badge:true,matrix:["0000000","0110110","0110110","0000000","1000001","0111110","0000000"]},
 {id:"haha",name:"HA HA",color:"#111111",badge:true,matrix:["1010101","1110111","1010101","0000000","1010101","1110111","1010101"]},
 {id:"sad",name:"Sad",color:"#111111",badge:true,matrix:["0110110","0110110","0000000","0000000","0111110","1000001","0000000"]},
 {id:"angry1",name:"Angry",color:"#ff4b32",badge:true,matrix:["1001001","0111110","0011100","1111111","0011100","0111110","1001001"]},
 {id:"angry2",name:"Rage",color:"#ff3b24",badge:true,matrix:["0101010","1111111","0011100","1111111","0011100","1111111","0101010"]},
 {id:"heart",name:"Heart",color:"#f21f46",badge:true,matrix:["0110110","1111111","1111111","1111111","0111110","0011100","0001000"]},
 {id:"hearts",name:"Hearts",color:"#f21f46",badge:true,matrix:["1100000","1110001","0100011","0000111","0010010","0111000","0010000"]},
 {id:"broken-heart",name:"Broken Heart",color:"#f21f46",badge:true,matrix:["0110110","1111111","1101111","1011111","0110110","0011100","0001000"]},
 {id:"sun",name:"Sun",color:"#ff9418",badge:true,matrix:["0001000","0101010","0011100","1111111","0011100","0101010","0001000"]},
 {id:"sparkles",name:"Sparkles",color:"#ff9418",badge:true,matrix:["1000001","0101010","0011100","1111111","0011100","0101010","1000001"]},
 {id:"music",name:"Music",color:"#111111",badge:true,matrix:["0011110","0010010","0010010","0010010","1110010","1110110","0000000"]},
 {id:"dollar",name:"Dollar",color:"#f58a11",badge:true,matrix:["0011100","0111110","0110000","0011100","0000110","0111110","0011100"]},
 {id:"cloud",name:"Cloud",color:"#555555",badge:true,matrix:["0000000","0011000","0111100","1111110","1111111","0111110","0000000"]},
 {id:"drop",name:"Water Drop",color:"#168ddd",badge:true,matrix:["0001000","0011100","0011100","0111110","0111110","0011100","0001000"]},
 {id:"sleep",name:"Sleep Z",color:"#111111",badge:true,matrix:["1111110","0001100","0011000","0110000","1100000","1111110","0000000"]},
 {id:"question",name:"Question",color:"#168ddd",badge:true,matrix:["0111110","1100011","0000110","0001100","0011000","0000000","0011000"]},
 {id:"exclamation",name:"Exclamation",color:"#ff352b",badge:true,matrix:["0011000","0011000","0011000","0011000","0011000","0000000","0011000"]},
 {id:"hands",name:"Hands Up",color:"#ff9418",badge:true,matrix:["1001001","1101011","1111111","0111110","0011100","0011100","0001000"]},
 {id:"spiral",name:"Spiral",color:"#111111",badge:true,matrix:["0111110","1100011","1011101","1010101","1011111","1100000","0111110"]},
 {id:"cross",name:"Cross",color:"#ff3b24",badge:true,matrix:["1100011","0110110","0011100","0001000","0011100","0110110","1100011"]},
 {id:"battery",name:"Battery",color:"#168ddd",badge:true,matrix:["0011100","0111110","1100011","1101011","1100011","0111110","0011100"]},
 {id:"plain-heart",name:"Heart Plain",color:"#4f2f72",badge:false,matrix:["0110110","1111111","1111111","1111111","0111110","0011100","0001000"]},
 {id:"plain-star",name:"Star Plain",color:"#4f2f72",badge:false,matrix:["0001000","0101010","0011100","1111111","0111110","0110110","1100011"]},
 {id:"plain-exclamation",name:"Exclamation Plain",color:"#4f2f72",badge:false,matrix:["0011000","0011000","0011000","0011000","0011000","0000000","0011000"]},
 {id:"plain-question",name:"Question Plain",color:"#4f2f72",badge:false,matrix:["0111110","1100011","0000110","0001100","0011000","0000000","0011000"]},
 {id:"heart-badge",name:"Heart Badge",color:"#f21f46",badge:true,matrix:["0110110","1111111","1111111","1111111","0111110","0011100","0001000"]},
 {id:"sun-badge",name:"Sun Badge",color:"#ff9418",badge:true,matrix:["0001000","0101010","0011100","1111111","0011100","0101010","0001000"]},
 {id:"music-badge",name:"Music Badge",color:"#111111",badge:true,matrix:["0011110","0010010","0010010","0010010","1110010","1110110","0000000"]}
];
const ICON_MAP=Object.fromEntries(ICONS.map(x=>[x.id,x])) as Record<string,IconDef>;
const iconState=(color="#111111"):ObjState=>({visible:true,locked:false,color,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
function badgeGeometry(p:KeycapParams){const w=7.8,h=6.8,r=1.05,shape=new THREE.Shape();shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new THREE.ExtrudeGeometry(shape,{depth:.34,bevelEnabled:true,bevelSize:.12,bevelThickness:.08,bevelSegments:2,curveSegments:5}).toNonIndexed();g.translate(0,.45,Math.max(0,p.height-p.dishDepth)+.08);const tail=new THREE.ConeGeometry(.72,1.15,4).toNonIndexed();tail.rotateX(Math.PI/2);tail.rotateZ(Math.PI/4);tail.translate(0,-3.45,Math.max(0,p.height-p.dishDepth)+.24);return mergeGeometries([g,tail]);}
function pixelGeometry(def:IconDef,p:KeycapParams){const parts:THREE.BufferGeometry[]=[],px=.68,depth=.55;for(let y=0;y<def.matrix.length;y++)for(let x=0;x<def.matrix[y].length;x++)if(def.matrix[y][x]==="1"){const g=new THREE.BoxGeometry(px,px,depth).toNonIndexed();g.translate((x-3)*px,(3-y)*px+(def.badge?.45:0),Math.max(0,p.height-p.dishDepth)+(def.badge?.47:.12)+depth/2);parts.push(g)}return parts.length?mergeGeometries(parts):new THREE.BufferGeometry();}
`;

const labelAnchor='const cloneFixed=()=>structuredClone(FIXED_STATE) as Record<string,ObjState>;';
if(!s.includes(labelAnchor))throw new Error('label anchor not found');
s=s.replace(labelAnchor,labelAnchor+'\n'+iconBlock);
s=s.replace('const labelOf=(id:string,legends:LegendCfg[])=>FIXED_LABEL[id]??`Legend · ${legends.find(x=>x.id===id)?.text || id.replace("legend-","")}`;', 'const labelOf=(id:string,legends:LegendCfg[])=>FIXED_LABEL[id]??(id.startsWith("icon-")?(id.endsWith("-badge")?"Icon badge":`Icon · ${ICON_MAP[id.split("-").slice(2).join("-")]?.name||"Pixel"}`):`Legend · ${legends.find(x=>x.id===id)?.text || id.replace("legend-","")}`);');

s=s.replace(' const[legends,setLegends]=useState<LegendCfg[]>([newLegend()]);',' const[legends,setLegends]=useState<LegendCfg[]>([newLegend()]);\n const[icons,setIcons]=useState<IconInst[]>([]);');
s=s.replace(' const legendGeos=useMemo(()=>{const out:Record<string,THREE.BufferGeometry>={};for(const l of legends){const g=makeLegend(fonts[l.fontId]||null,l,p);if(!g)continue;const [x,y]=placementXY(l.placement,p);g.translate(x,y,0);out[l.id]=g;}return out},[fonts,legends,p]);',' const legendGeos=useMemo(()=>{const out:Record<string,THREE.BufferGeometry>={};for(const l of legends){const g=makeLegend(fonts[l.fontId]||null,l,p);if(!g)continue;const [x,y]=placementXY(l.placement,p);g.translate(x,y,0);out[l.id]=g;}return out},[fonts,legends,p]);\n const iconGeos=useMemo(()=>{const out:Record<string,THREE.BufferGeometry>={};for(const i of icons){const d=ICON_MAP[i.defId];if(!d)continue;out[i.id]=pixelGeometry(d,p);if(d.badge)out[`${i.id}-badge`]=badgeGeometry(p);}return out},[icons,p]);');
s=s.replace(' const objects=useMemo(()=>({body:build.shell,...stemParts,...legendGeos}) as Record<string,THREE.BufferGeometry>,[build.shell,stemParts,legendGeos]);',' const objects=useMemo(()=>({body:build.shell,...stemParts,...legendGeos,...iconGeos}) as Record<string,THREE.BufferGeometry>,[build.shell,stemParts,legendGeos,iconGeos]);');
s=s.replace(' const addLegend=()=>{if(legends.length>=8)return;', ' const addIcon=(defId:string)=>{const d=ICON_MAP[defId];if(!d)return;const id=`icon-${Date.now()}-${defId}`;setIcons(x=>[...x,{id,defId}]);setState(st=>({...st,[id]:iconState(d.color),...(d.badge?{[`${id}-badge`]:{...iconState("#fffdf9"),locked:true}}:{})}));setSelected(id)};\n const removeIcon=(id:string)=>{setIcons(x=>x.filter(i=>i.id!==id));setState(st=>{const n={...st};delete n[id];delete n[`${id}-badge`];return n});setSelected("body")};\n const addLegend=()=>{if(legends.length>=8)return;');

s=s.replace('if(mode==="legends")ids=ids.filter(x=>x.startsWith("legend-"));','if(mode==="legends")ids=ids.filter(x=>x.startsWith("legend-"));if(mode==="icons")ids=ids.filter(x=>x.startsWith("icon-"));');

const objectSection='   <section className="border bg-card p-3"><h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide">Objects</h3>';
if(!s.includes(objectSection))throw new Error('object section anchor not found');
const iconUI=`   <section className="border bg-card p-3"><div className="mb-2 flex items-center justify-between"><div><h3 className="text-[10px] font-semibold uppercase tracking-wide">Icon Library</h3><p className="text-[9px] text-muted-foreground">Pixel icon 4 × 7 · bấm để thêm vào keycap</p></div><span className="text-[9px] text-muted-foreground">${'${icons.length}'} icon</span></div><div className="grid grid-cols-7 gap-1">{ICONS.map(d=><button key={d.id} title={d.name} onClick={()=>addIcon(d.id)} className="relative aspect-square overflow-hidden border bg-[#fbfaf7] hover:border-primary hover:bg-primary/5"><div className="grid h-full grid-cols-7 grid-rows-7 p-1">{d.matrix.flatMap((row,y)=>Array.from(row).map((v,x)=><span key={x+'-'+y} className={v==='1'?'block':'block opacity-0'} style={{background:v==='1'?d.color:'transparent'}}/>))}</div>{d.badge&&<span className="pointer-events-none absolute inset-[12%] -z-10 rounded bg-white"/>}</button>)}</div><div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground"><span>Badge trắng + glyph màu giống mẫu</span><span>28 mẫu</span></div>{selected.startsWith("icon-")&&!selected.endsWith("-badge")&&<button onClick={()=>removeIcon(selected)} className="mt-2 h-8 w-full border text-[9px] text-red-600">Xóa icon đang chọn</button>}</section>\n`;
s=s.replace(objectSection,iconUI+objectSection);

s=s.replace('(["combined","body","stem","legends"] as ExportMode[])','(["combined","body","stem","legends","icons"] as ExportMode[])');
s=s.replace('className="mb-2 grid grid-cols-4 gap-1"','className="mb-2 grid grid-cols-5 gap-1"');

fs.writeFileSync(file,s);
console.log('applied full pixel icon library');
