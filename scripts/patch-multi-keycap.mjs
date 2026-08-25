import fs from 'node:fs';

const file='src/lovable/KeycapAdvancedV4.tsx';
let s=fs.readFileSync(file,'utf8');
if(s.includes('/* MULTI_KEYCAP_V1 */')){console.log('multi keycap already applied');process.exit(0)}

const stateAnchor=' const[legends,setLegends]=useState<LegendCfg[]>([newLegend()]);';
if(!s.includes(stateAnchor))throw new Error('state anchor not found');
s=s.replace(stateAnchor,`${stateAnchor}\n /* MULTI_KEYCAP_V1 */\n const[batchText,setBatchText]=useState("A");\n const batchTokens=useMemo(()=>{const t=batchText.trim().split(/\\s+/).filter(Boolean);return t.length?t:["A"]},[batchText]);`);

const legendGeoAnchor=' const legendGeos=useMemo(()=>{const out:Record<string,THREE.BufferGeometry>={};for(const l of legends){const g=makeLegend(fonts[l.fontId]||null,l,p);if(!g)continue;const [x,y]=placementXY(l.placement,p);g.translate(x,y,0);out[l.id]=g;}return out},[fonts,legends,p]);';
if(!s.includes(legendGeoAnchor))throw new Error('legend geo anchor not found');
const batchGeoBlock=`${legendGeoAnchor}\n const batchGeos=useMemo(()=>{\n  if(batchTokens.length<=1)return null;\n  const out:Record<string,THREE.BufferGeometry>={};\n  const n=batchTokens.length;\n  const baseLegend=legends[0];\n  const font=baseLegend?fonts[baseLegend.fontId]:null;\n  batchTokens.forEach((text,i)=>{\n   const off=(i-(n-1)/2)*p.pitch;\n   const body=build.shell.clone();body.translate(off,0,0);out[\`cap-\${i}-body\`]=body;\n   Object.entries(stemParts).forEach(([k,g])=>{const c=g.clone();c.translate(off,0,0);out[\`cap-\${i}-\${k}\`]=c});\n   if(baseLegend&&font){const cfg={...baseLegend,text};const lg=makeLegend(font,cfg,p);if(lg){const [lx,ly]=placementXY(cfg.placement,p);lg.translate(off+lx,ly,0);out[\`cap-\${i}-legend\`]=lg}}\n  });\n  return out;\n },[batchTokens,build.shell,stemParts,legends,fonts,p]);`;
s=s.replace(legendGeoAnchor,batchGeoBlock);

const objectsAnchor=' const objects=useMemo(()=>({body:build.shell,...stemParts,...legendGeos,...iconGeos}) as Record<string,THREE.BufferGeometry>,[build.shell,stemParts,legendGeos,iconGeos]);';
if(!s.includes(objectsAnchor))throw new Error('objects anchor not found');
s=s.replace(objectsAnchor,' const objects=useMemo(()=>batchGeos??({body:build.shell,...stemParts,...legendGeos,...iconGeos}) as Record<string,THREE.BufferGeometry>,[batchGeos,build.shell,stemParts,legendGeos,iconGeos]);');

const patchAnchor=' const patch=(id:string,x:Partial<ObjState>)=>setState(s=>({...s,[id]:{...(s[id]||legendState()),...x}}));';
if(!s.includes(patchAnchor))throw new Error('patch anchor not found');
s=s.replace(patchAnchor,`${patchAnchor}\n useEffect(()=>{if(!batchGeos)return;setState(st=>{const next={...st};for(const id of Object.keys(batchGeos)){if(next[id])continue;const isBody=id.endsWith("-body"),isStem=id.includes("-stem")||id.includes("-stab"),isLegend=id.endsWith("-legend");next[id]={...legendState(),color:isBody?"#f3c9cf":isStem?"#d8dbe5":isLegend?"#55446f":"#999999"};}return next});const first=Object.keys(batchGeos)[0];if(first)setSelected(first)},[batchGeos]);`);

const headerAnchor='   <section className="border bg-card p-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">KEYCAP</h2><p className="text-[9px] uppercase tracking-[.18em] text-muted-foreground">Shape · stem · print</p></div><button onClick={pastelPreset} className="flex h-8 items-center gap-1 border px-2 text-[10px]"><WandSparkles className="size-3"/>Pastel Clicker</button></div></section>';
if(!s.includes(headerAnchor))throw new Error('header anchor not found');
const batchUI=`${headerAnchor}\n   <section className="space-y-2 border bg-card p-3"><div className="flex items-center justify-between"><div><h3 className="text-[10px] font-semibold uppercase tracking-wide">Tạo nhanh nhiều keycap</h3><p className="text-[9px] text-muted-foreground">Cách hoặc xuống dòng = thêm 1 keycap</p></div><span className="border bg-muted px-2 py-1 font-mono text-[9px]">${'${batchTokens.length}'} keycap</span></div><textarea value={batchText} onChange={e=>setBatchText(e.target.value)} rows={3} placeholder="A B C D E F G" className="w-full resize-y border bg-background p-2 font-mono text-xs"/><div className="flex flex-wrap gap-1">{batchTokens.map((t,i)=><button key={i} onClick={()=>{const a=[...batchTokens];a.splice(i,1);setBatchText(a.join(" "))}} title="Bấm để xóa keycap" className="border bg-muted px-2 py-1 text-[9px]"><span className="font-mono font-semibold">{t}</span><span className="ml-1 text-muted-foreground">×</span></button>)}</div><button onClick={()=>setBatchText(x=>(x.trim()?x.trim()+" ":"")+"KEY")} className="h-8 w-full border text-[9px]">+ Thêm keycap</button>{batchTokens.length>1&&<p className="text-[9px] text-emerald-700">Đang preview {batchTokens.length} keycap theo pitch {p.pitch} mm. Combined STL sẽ xuất cả dãy.</p>}</section>`;
s=s.replace(headerAnchor,batchUI);

s=s.replace('const labelOf=(id:string,legends:LegendCfg[])=>FIXED_LABEL[id]??(id.startsWith("icon-")?', 'const labelOf=(id:string,legends:LegendCfg[])=>id.startsWith("cap-")?`Keycap ${Number(id.split("-")[1])+1} · ${id.split("-").slice(2).join(" / ")}`:FIXED_LABEL[id]??(id.startsWith("icon-")?');

fs.writeFileSync(file,s);
console.log('applied multi keycap collection');
