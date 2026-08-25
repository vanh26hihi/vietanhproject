import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import * as opentype from "opentype.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Eye, EyeOff, Lock, Plus, RotateCcw, Trash2, Undo2, Redo2, Unlock } from "lucide-react";
import { buildKeycap, mergeGeometries } from "./geometry";
import { DEFAULT_PARAMS, PROFILES, SIZES, applyProfile, applySize } from "./params";
import { ICONS, ICON_MAP } from "./iconLibraryV5";

const FONTS = [
  { id: "black", name: "Be Vietnam Pro Black", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Black.ttf" },
  { id: "extra", name: "Be Vietnam Pro ExtraBold", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-ExtraBold.ttf" },
  { id: "bold", name: "Be Vietnam Pro Bold", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Bold.ttf" },
  { id: "medium", name: "Be Vietnam Pro Medium", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Medium.ttf" },
  { id: "regular", name: "Be Vietnam Pro Regular", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-Regular.ttf" }
];
const FONT_MAP = Object.fromEntries(FONTS.map(x => [x.id, x]));
const fontCache = new Map();
const COLORS = ["#f3c9cf", "#f4e4a9", "#cfeccf", "#cddff1", "#e1d0ec", "#f3c9cf", "#f4e4a9"];
const DEFAULT_OBJ = color => ({ visible: true, locked: false, color, position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] });

async function loadFont(id) {
  if (fontCache.has(id)) return fontCache.get(id);
  const def = FONT_MAP[id] || FONTS[0];
  const buf = await fetch(def.url).then(r => { if (!r.ok) throw new Error(`Font HTTP ${r.status}`); return r.arrayBuffer(); });
  const font = opentype.parse(buf);
  fontCache.set(id, font);
  return font;
}
function textGeometry(font, text, size, depth, bevel = true, bevelSize = .06, bevelThickness = .05, letterSpacing = 0, lineHeight = 1.12) {
  if (!font || !text?.trim()) return null;
  const lines = text.split("\n").slice(0, 4);
  const lineGeos = [];
  lines.forEach((line, li) => {
    let cursor = 0;
    const parts = [];
    for (const ch of Array.from(line || " ")) {
      if (ch === " ") { cursor += size * .36 + letterSpacing; continue; }
      const path = font.getPath(ch, 0, 0, size);
      const sp = new THREE.ShapePath();
      for (const c of path.commands) {
        if (c.type === "M") sp.moveTo(c.x, c.y);
        else if (c.type === "L") sp.lineTo(c.x, c.y);
        else if (c.type === "C") sp.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
        else if (c.type === "Q") sp.quadraticCurveTo(c.x1, c.y1, c.x, c.y);
        else if (c.type === "Z") sp.currentPath?.closePath();
      }
      const shapes = sp.toShapes(true);
      if (!shapes.length) continue;
      const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: bevel, bevelSize: bevel ? bevelSize : 0, bevelThickness: bevel ? bevelThickness : 0, bevelSegments: 2, curveSegments: 12 }).toNonIndexed();
      g.computeBoundingBox();
      const b = g.boundingBox;
      const w = Math.max(.01, b.max.x - b.min.x);
      g.translate(cursor - b.min.x, 0, 0);
      parts.push(g);
      cursor += w + letterSpacing;
    }
    if (parts.length) {
      const lineGeo = mergeGeometries(parts);
      lineGeo.computeBoundingBox();
      const b = lineGeo.boundingBox;
      lineGeo.translate(-(b.min.x + b.max.x) / 2, -li * size * lineHeight, 0);
      lineGeos.push(lineGeo);
    }
  });
  if (!lineGeos.length) return null;
  const g = mergeGeometries(lineGeos);
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(0, -(b.min.y + b.max.y) / 2, 0);
  g.computeVertexNormals();
  return g;
}
function iconGeometry(iconId, depth = .5) {
  const icon = ICON_MAP[iconId];
  if (!icon) return null;
  const parts = [], px = .62;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (icon.matrix[y][x] === "1") {
    const g = new THREE.BoxGeometry(px, px, depth).toNonIndexed();
    g.translate((x - 3) * px, (3 - y) * px, depth / 2);
    parts.push(g);
  }
  return parts.length ? mergeGeometries(parts) : null;
}
function splitStems(p, g) {
  if (!g || !p.stemEnabled) return {};
  const n = p.stabEnabled && p.units >= 2 ? 3 : 1;
  const total = g.getAttribute("position").count, each = Math.floor(total / n);
  const slice = (start, count) => { const a = g.getAttribute("position").array; const out = new Float32Array(a.slice(start * 3, (start + count) * 3)); const x = new THREE.BufferGeometry(); x.setAttribute("position", new THREE.BufferAttribute(out, 3)); x.computeVertexNormals(); return x; };
  const r = { stem: slice(0, each) };
  if (n === 3) { r.stabR = slice(each, each); r.stabL = slice(each * 2, total - each * 2); }
  return r;
}
function applyObj(g, s, offsetX = 0) {
  const c = g.clone();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.rotation.map(THREE.MathUtils.degToRad)));
  m.compose(new THREE.Vector3(s.position[0] + offsetX, s.position[1], s.position[2]), q, new THREE.Vector3(...s.scale));
  c.applyMatrix4(m);
  return c;
}
function saveSTL(name, entries) {
  const root = new THREE.Group();
  entries.forEach(({ g, s, offsetX = 0 }) => { if (s?.visible === false || !g) return; root.add(new THREE.Mesh(applyObj(g, s || DEFAULT_OBJ("#fff"), offsetX), new THREE.MeshBasicMaterial())); });
  root.updateMatrixWorld(true);
  const v = new STLExporter().parse(root, { binary: true });
  const blob = new Blob([new Uint8Array(v.buffer, v.byteOffset, v.byteLength)], { type: "model/stl" });
  const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function newLegend(text = "A", id = `legend-${Date.now()}-${Math.random()}`) {
  return { id, text, fontId: "black", size: 5, depth: .55, letterSpacing: 0, lineHeight: 1.12, bevel: true, bevelSize: .06, bevelThickness: .05, zLift: .1, fit: "box", placement: "mc" };
}
function newCap(text = "A", i = 0) {
  const legend = newLegend(text, `legend-${Date.now()}-${i}-${Math.random()}`);
  return {
    id: `cap-${Date.now()}-${i}-${Math.random()}`,
    name: text || `Keycap ${i + 1}`,
    params: { ...DEFAULT_PARAMS, profileId: "xda", topWidth: 14, topDepth: 14, height: 9, topTilt: 0, sideDraft: 3, dishDepth: 0, stemHeight: 4.7 },
    legends: [legend],
    iconId: null,
    iconDepth: .5,
    states: { body: DEFAULT_OBJ(COLORS[i % COLORS.length]), stem: DEFAULT_OBJ("#d8dbe5"), stabL: DEFAULT_OBJ("#d8dbe5"), stabR: DEFAULT_OBJ("#d8dbe5"), icon: DEFAULT_OBJ("#4f2f72"), [legend.id]: DEFAULT_OBJ("#55446f") }
  };
}
function N({ l, v, set, step = .1, min, max }) { return <label className="grid grid-cols-[1fr_86px] items-center gap-2 text-[11px]"><span>{l}</span><input className="h-8 border bg-background px-2 text-right font-mono" type="number" value={v} step={step} min={min} max={max} onChange={e => set(Number(e.target.value))}/></label>; }
function V({ title, v, set }) { return <div className="border p-2"><div className="mb-2 text-[10px] font-semibold uppercase">{title}</div><div className="grid grid-cols-3 gap-1">{[0,1,2].map(i => <label key={i} className="text-[9px] text-muted-foreground">{"XYZ"[i]}<input className="mt-1 h-7 w-full border bg-background px-1 text-right font-mono text-[10px]" type="number" value={Number(v[i].toFixed(3))} step={title === "Scale" ? .05 : .1} onChange={e => { const a = [...v]; a[i] = Number(e.target.value); set(a); }}/></label>)}</div></div>; }

function SceneMesh({ g, s, offsetX, active, mode, onPick, onPatch }) {
  const ref = useRef();
  const mesh = <mesh ref={ref} geometry={g} position={[s.position[0] + offsetX, s.position[1], s.position[2]]} rotation={s.rotation.map(THREE.MathUtils.degToRad)} scale={s.scale} onClick={e => { e.stopPropagation(); onPick?.(); }}><meshStandardMaterial color={active ? "#f59e0b" : s.color} roughness={.38}/></mesh>;
  if (!active || s.locked || !onPatch) return mesh;
  return <TransformControls mode={mode} space="world" onMouseUp={() => { const m = ref.current; if (!m) return; onPatch({ position: [m.position.x - offsetX, m.position.y, m.position.z], rotation: [THREE.MathUtils.radToDeg(m.rotation.x), THREE.MathUtils.radToDeg(m.rotation.y), THREE.MathUtils.radToDeg(m.rotation.z)], scale: m.scale.toArray() }); }}>{mesh}</TransformControls>;
}
function Scene({ renderCaps, selectedCapId, selectedObject, mode, onPickCap, onPickObject, onPatchObject }) {
  return <Canvas shadows><color attach="background" args={["#f4f6f8"]}/><PerspectiveCamera makeDefault position={[42,-52,34]} fov={34} up={[0,0,1]}/><OrbitControls makeDefault target={[0,0,5]}/><ambientLight intensity={1.05}/><directionalLight position={[25,-30,45]} intensity={1.65}/>{renderCaps.flatMap(rc => Object.entries(rc.objects).map(([id,g]) => { const s = rc.cap.states[id]; if (!g || !s?.visible) return null; const active = rc.cap.id === selectedCapId && id === selectedObject; return <SceneMesh key={`${rc.cap.id}-${id}`} g={g} s={s} offsetX={rc.offsetX} active={active} mode={mode} onPick={() => { onPickCap(rc.cap.id); onPickObject(id); }} onPatch={active ? x => onPatchObject(id, x) : null}/>; }))}<Grid args={[300,300]} rotation={[Math.PI/2,0,0]} cellSize={1} sectionSize={10} infiniteGrid fadeDistance={180}/><axesHelper args={[15]}/></Canvas>;
}

export default function KeycapAdvancedV6() {
  const [caps, setCapsRaw] = useState(() => [newCap("A", 0)]);
  const [selectedCapId, setSelectedCapId] = useState(() => caps[0].id);
  const [selectedObject, setSelectedObject] = useState(() => caps[0].legends[0].id);
  const [batch, setBatch] = useState("A");
  const [mode, setMode] = useState("translate");
  const [fonts, setFonts] = useState({});
  const [fontError, setFontError] = useState("");
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const selectedCap = caps.find(c => c.id === selectedCapId) || caps[0];
  const activeLegend = selectedCap?.legends.find(l => l.id === selectedObject) || selectedCap?.legends[0];

  const commit = updater => {
    setCapsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setHistory(h => [...h.slice(-49), structuredClone(prev)]);
      setFuture([]);
      return next;
    });
  };
  const undo = () => setHistory(h => { if (!h.length) return h; const prev = h[h.length - 1]; setCapsRaw(cur => { setFuture(f => [structuredClone(cur), ...f].slice(0,50)); return prev; }); return h.slice(0,-1); });
  const redo = () => setFuture(f => { if (!f.length) return f; const next = f[0]; setCapsRaw(cur => { setHistory(h => [...h.slice(-49), structuredClone(cur)]); return next; }); return f.slice(1); });
  useEffect(() => { const fn = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); } }; window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn); }, [history, future]);
  useEffect(() => { const ids = [...new Set(caps.flatMap(c => c.legends.map(l => l.fontId)))]; ids.forEach(id => { if (!fonts[id]) loadFont(id).then(f => setFonts(s => ({...s,[id]:f}))).catch(e => setFontError(String(e))); }); }, [caps]);

  const patchCap = fn => commit(cs => cs.map(c => c.id === selectedCapId ? fn(structuredClone(c)) : c));
  const setParam = (k,v) => patchCap(c => { c.params[k] = v; return c; });
  const patchObject = (id,x) => patchCap(c => { c.states[id] = { ...(c.states[id] || DEFAULT_OBJ("#fff")), ...x }; return c; });
  const updateLegend = (id,x) => patchCap(c => { c.legends = c.legends.map(l => l.id === id ? {...l,...x} : l); return c; });
  const rebuild = () => { const tokens = batch.trim().split(/\s+/u).filter(Boolean); const next = (tokens.length ? tokens : ["A"]).map((t,i) => newCap(t,i)); commit(next); setSelectedCapId(next[0].id); setSelectedObject(next[0].legends[0].id); };
  const addCap = () => { const c = newCap("KEY", caps.length); commit(cs => [...cs,c]); setSelectedCapId(c.id); setSelectedObject(c.legends[0].id); setBatch(b => `${b.trim()} KEY`.trim()); };
  const cloneCap = () => { if (!selectedCap) return; const c = structuredClone(selectedCap); c.id = `cap-${Date.now()}-${Math.random()}`; c.name += " copy"; c.legends = c.legends.map((l,i) => ({...l,id:`legend-${Date.now()}-${i}-${Math.random()}`})); const ns = {...c.states}; c.legends.forEach((l,i) => { const old = selectedCap.legends[i]; ns[l.id] = structuredClone(selectedCap.states[old.id]); delete ns[old.id]; }); c.states = ns; commit(cs => [...cs,c]); setSelectedCapId(c.id); setSelectedObject(c.legends[0].id); };
  const removeCap = () => { if (caps.length <= 1) return; const next = caps.filter(c => c.id !== selectedCapId); commit(next); setSelectedCapId(next[0].id); setSelectedObject(next[0].legends[0].id); setBatch(next.map(c => c.legends[0]?.text || c.name).join(" ")); };
  const addLegend = () => { if (selectedCap.legends.length >= 8) return; const l = newLegend("A"); patchCap(c => { c.legends.push(l); c.states[l.id] = DEFAULT_OBJ("#55446f"); return c; }); setSelectedObject(l.id); };
  const removeLegend = id => { if (selectedCap.legends.length <= 1) return; const left = selectedCap.legends.filter(l => l.id !== id); patchCap(c => { c.legends = c.legends.filter(l => l.id !== id); delete c.states[id]; return c; }); setSelectedObject(left[0].id); };

  const renderCaps = useMemo(() => caps.map((cap,i) => {
    const built = buildKeycap(cap.params), stemParts = splitStems(cap.params, built.stems), objects = { body: built.shell, ...stemParts };
    cap.legends.forEach(l => {
      const g = textGeometry(fonts[l.fontId], l.text, l.size, l.depth, l.bevel, l.bevelSize, l.bevelThickness, l.letterSpacing, l.lineHeight);
      if (!g) return;
      g.computeBoundingBox(); const b = g.boundingBox, w = b.max.x-b.min.x, h=b.max.y-b.min.y;
      const safeW = Math.max(1,cap.params.topWidth-2), safeH=Math.max(1,cap.params.topDepth-2);
      let sc=1; if(l.fit==="width") sc=Math.min(1,safeW/Math.max(.1,w)); if(l.fit==="box") sc=Math.min(1,safeW/Math.max(.1,w),safeH/Math.max(.1,h)); if(sc<1) g.scale(sc,sc,1);
      const mx=cap.params.topWidth*.28,my=cap.params.topDepth*.28, map={tl:[-mx,my],tc:[0,my],tr:[mx,my],ml:[-mx,0],mc:[0,0],mr:[mx,0],bl:[-mx,-my],bc:[0,-my],br:[mx,-my]}; const [x,y]=map[l.placement]||[0,0];
      g.translate(x,y,Math.max(0,cap.params.height-cap.params.dishDepth)+l.zLift); objects[l.id]=g;
    });
    if (cap.iconId) { const ig = iconGeometry(cap.iconId, cap.iconDepth); if (ig) { ig.translate(0,0,cap.params.height+.08); objects.icon = ig; } }
    return { cap, objects, offsetX: (i-(caps.length-1)/2) * cap.params.pitch };
  }), [caps, fonts]);

  const exportCollection = () => { const entries=[]; renderCaps.forEach(rc => Object.entries(rc.objects).forEach(([id,g]) => entries.push({g,s:rc.cap.states[id],offsetX:rc.offsetX}))); saveSTL("keycap-collection.stl",entries); };
  const exportSelected = modeName => { const rc = renderCaps.find(x => x.cap.id===selectedCapId); if(!rc)return; let ids=Object.keys(rc.objects); if(modeName==="body") ids=ids.filter(x=>x==="body"); if(modeName==="stem") ids=ids.filter(x=>x==="stem"||x.startsWith("stab")); if(modeName==="legends") ids=ids.filter(x=>x.startsWith("legend-")); if(modeName==="icons") ids=ids.filter(x=>x==="icon"); saveSTL(`keycap-${modeName}.stl`,ids.map(id=>({g:rc.objects[id],s:rc.cap.states[id],offsetX:0}))); };

  if (!selectedCap) return null;
  const p = selectedCap.params;
  const ids = Object.keys(renderCaps.find(x=>x.cap.id===selectedCapId)?.objects || {});
  const sObj = selectedCap.states[selectedObject];
  return <div className="grid h-full min-h-0 grid-cols-[320px_1fr_380px] bg-background">
    <aside className="space-y-3 overflow-y-auto border-r p-3">
      <section className="border bg-card p-3"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">KEYCAP COLLECTION V6</h2><p className="text-[9px] uppercase tracking-[.16em] text-muted-foreground">Full detail · multi-keycap · Vietnamese</p></div><div className="flex gap-1"><button onClick={undo} disabled={!history.length} className="grid size-8 place-items-center border disabled:opacity-30"><Undo2 className="size-4"/></button><button onClick={redo} disabled={!future.length} className="grid size-8 place-items-center border disabled:opacity-30"><Redo2 className="size-4"/></button></div></div></section>
      <section className="space-y-2 border bg-card p-3"><div className="flex justify-between"><h3 className="text-[10px] font-semibold uppercase">Tạo nhanh nhiều keycap</h3><span className="text-[10px]">{caps.length} keycap</span></div><p className="text-[9px] text-muted-foreground">Khoảng trắng hoặc xuống dòng = keycap mới.</p><textarea value={batch} onChange={e=>setBatch(e.target.value)} rows={3} placeholder={'A B C D E\nViết ệ Đ ư ơ'} className="w-full border bg-background p-2 text-xs"/><button onClick={rebuild} className="h-9 w-full bg-primary text-[10px] text-primary-foreground">Tạo / cập nhật dãy</button><div className="flex flex-wrap gap-1">{caps.map((c,i)=><button key={c.id} onClick={()=>{setSelectedCapId(c.id);setSelectedObject(c.legends[0].id)}} className={`border px-2 py-1 text-[9px] ${c.id===selectedCapId?"border-primary bg-primary/5":""}`}>{i+1}. {c.legends[0]?.text||c.name}</button>)}</div><div className="grid grid-cols-3 gap-1"><button onClick={addCap} className="h-8 border text-[9px]"><Plus className="mr-1 inline size-3"/>Thêm</button><button onClick={cloneCap} className="h-8 border text-[9px]"><Copy className="mr-1 inline size-3"/>Clone</button><button onClick={removeCap} className="h-8 border text-[9px] text-red-600"><Trash2 className="mr-1 inline size-3"/>Xóa</button></div></section>
      <section className="border bg-card p-3"><h3 className="mb-2 text-[10px] font-semibold uppercase">Size / Profile · keycap đang chọn</h3><div className="grid grid-cols-4 gap-1">{Object.keys(SIZES).map(id=><button key={id} onClick={()=>patchCap(c=>{c.params=applySize(c.params,id);return c})} className={`border px-1 py-1 text-[9px] ${p.sizeId===id?"bg-primary text-primary-foreground":""}`}>{SIZES[id].label}</button>)}</div><div className="mt-2 grid grid-cols-5 gap-1">{Object.keys(PROFILES).map(id=><button key={id} onClick={()=>patchCap(c=>{const dish=c.params.dishDepth,stem=c.params.stemHeight;c.params={...applyProfile(c.params,id),dishDepth:dish,stemHeight:stem};return c})} className={`border px-1 py-1 text-[9px] ${p.profileId===id?"bg-primary text-primary-foreground":""}`}>{PROFILES[id].label}</button>)}</div></section>
      <section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Shape</h3><N l="Rộng đáy" v={p.bottomWidth} set={n=>setParam("bottomWidth",n)}/><N l="Sâu đáy" v={p.bottomDepth} set={n=>setParam("bottomDepth",n)}/><N l="Rộng top" v={p.topWidth} set={n=>setParam("topWidth",n)}/><N l="Sâu top" v={p.topDepth} set={n=>setParam("topDepth",n)}/><N l="Chiều cao" v={p.height} set={n=>setParam("height",n)}/><N l="Dày thành" v={p.wallThickness} step={.05} set={n=>setParam("wallThickness",n)}/><N l="Dày nóc" v={p.topThickness} step={.05} set={n=>setParam("topThickness",n)}/><N l="Side draft" v={p.sideDraft} step={.5} set={n=>setParam("sideDraft",n)}/><N l="Corner radius" v={p.cornerRadius} step={.05} set={n=>setParam("cornerRadius",n)}/><N l="Top corner" v={p.topCornerRadius} step={.05} set={n=>setParam("topCornerRadius",n)}/><N l="Dish depth" v={p.dishDepth} step={.05} min={0} set={n=>setParam("dishDepth",Math.max(0,n))}/><N l="Dish strength" v={p.dishStrength} step={.1} set={n=>setParam("dishStrength",n)}/><N l="Top tilt" v={p.topTilt} step={.5} set={n=>setParam("topTilt",n)}/><N l="Fillet top" v={p.filletTop} step={.05} set={n=>setParam("filletTop",n)}/></section>
      <section className="space-y-2 border bg-card p-3"><div className="flex justify-between"><h3 className="text-[10px] font-semibold uppercase">Stem / Stabilizer</h3><input type="checkbox" checked={p.stemEnabled} onChange={e=>setParam("stemEnabled",e.target.checked)}/></div><N l="Stem Ø" v={p.stemDiameter} step={.05} set={n=>setParam("stemDiameter",n)}/><N l="Stem cao" v={p.stemHeight} step={.05} set={n=>setParam("stemHeight",n)}/><N l="Cross dài" v={p.crossLength} step={.05} set={n=>setParam("crossLength",n)}/><N l="Cross rộng" v={p.crossWidth} step={.05} set={n=>setParam("crossWidth",n)}/><N l="Clearance" v={p.stemClearance} step={.01} set={n=>setParam("stemClearance",n)}/><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={p.stabEnabled} onChange={e=>setParam("stabEnabled",e.target.checked)}/>Stabilizer</label><N l="Stab spacing" v={p.stabSpacing} step={.1} set={n=>setParam("stabSpacing",n)}/></section>
      <section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">FDM / Compensation</h3><N l="XY compensation" v={p.xyCompensation} step={.01} set={n=>setParam("xyCompensation",n)}/><N l="Z compensation" v={p.zCompensation} step={.01} set={n=>setParam("zCompensation",n)}/><N l="Shrinkage %" v={p.shrinkage} step={.05} set={n=>setParam("shrinkage",n)}/><N l="Nozzle" v={p.nozzle} step={.2} set={n=>setParam("nozzle",n)}/><N l="Pitch" v={p.pitch} step={.05} set={n=>setParam("pitch",n)}/></section>
    </aside>
    <main className="relative min-h-0"><div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-1 border bg-card/90 p-1 shadow-sm">{[["translate","W · Move"],["rotate","E · Rotate"],["scale","R · Scale"]].map(([m,l])=><button key={m} onClick={()=>setMode(m)} className={`px-3 py-1.5 text-[9px] ${mode===m?"bg-primary text-primary-foreground":""}`}>{l}</button>)}</div><Scene renderCaps={renderCaps} selectedCapId={selectedCapId} selectedObject={selectedObject} mode={mode} onPickCap={setSelectedCapId} onPickObject={setSelectedObject} onPatchObject={patchObject}/></main>
    <aside className="space-y-3 overflow-y-auto border-l p-3">
      <section className="border bg-card p-3"><div className="mb-2 flex justify-between"><div><h3 className="text-[10px] font-semibold uppercase">Legends</h3><p className="text-[9px] text-muted-foreground">Tối đa 8 legend / keycap</p></div><button onClick={addLegend} className="grid size-8 place-items-center border"><Plus className="size-4"/></button></div><div className="space-y-1">{selectedCap.legends.map((l,i)=><div key={l.id} onClick={()=>setSelectedObject(l.id)} className={`grid grid-cols-[1fr_28px] items-center border px-2 py-1 ${selectedObject===l.id?"border-primary bg-primary/5":""}`}><div><div className="text-[10px] font-medium">{i+1}. {l.text||"(trống)"}</div><div className="text-[9px] text-muted-foreground">{FONT_MAP[l.fontId]?.name} · {l.size} mm</div></div><button disabled={selectedCap.legends.length<=1} onClick={e=>{e.stopPropagation();removeLegend(l.id)}} className="grid size-7 place-items-center disabled:opacity-30"><Trash2 className="size-3"/></button></div>)}</div></section>
      {activeLegend&&<section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Text Designer · tiếng Việt đầy đủ</h3><textarea value={activeLegend.text} rows={2} onChange={e=>updateLegend(activeLegend.id,{text:e.target.value})} className="w-full border bg-background p-2 text-sm" placeholder="Viết / ệ / Đ / ư / ơ"/><label className="text-[9px]">Font<select value={activeLegend.fontId} onChange={e=>updateLegend(activeLegend.id,{fontId:e.target.value})} className="mt-1 h-9 w-full border bg-background px-2">{FONTS.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="grid grid-cols-2 gap-2"><label className="text-[9px]">Fit<select value={activeLegend.fit} onChange={e=>updateLegend(activeLegend.id,{fit:e.target.value})} className="mt-1 h-8 w-full border bg-background px-2"><option value="none">None</option><option value="width">Fit width</option><option value="box">Fit safe area</option></select></label><label className="text-[9px]">Placement<select value={activeLegend.placement} onChange={e=>updateLegend(activeLegend.id,{placement:e.target.value})} className="mt-1 h-8 w-full border bg-background px-2">{["tl","tc","tr","ml","mc","mr","bl","bc","br"].map(x=><option key={x}>{x}</option>)}</select></label></div><N l="Cỡ chữ" v={activeLegend.size} step={.1} min={.5} set={n=>updateLegend(activeLegend.id,{size:Math.max(.5,n)})}/><N l="Độ nổi" v={activeLegend.depth} step={.05} min={.05} set={n=>updateLegend(activeLegend.id,{depth:Math.max(.05,n)})}/><N l="Letter spacing" v={activeLegend.letterSpacing} step={.05} set={n=>updateLegend(activeLegend.id,{letterSpacing:n})}/><N l="Line height" v={activeLegend.lineHeight} step={.05} set={n=>updateLegend(activeLegend.id,{lineHeight:n})}/><N l="Z lift" v={activeLegend.zLift} step={.05} set={n=>updateLegend(activeLegend.id,{zLift:n})}/><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={activeLegend.bevel} onChange={e=>updateLegend(activeLegend.id,{bevel:e.target.checked})}/>Bevel chữ</label>{activeLegend.bevel&&<><N l="Bevel size" v={activeLegend.bevelSize} step={.01} set={n=>updateLegend(activeLegend.id,{bevelSize:Math.max(0,n)})}/><N l="Bevel thickness" v={activeLegend.bevelThickness} step={.01} set={n=>updateLegend(activeLegend.id,{bevelThickness:Math.max(0,n)})}/></>}{fontError&&<p className="text-[9px] text-red-600">{fontError}</p>}</section>}
      <section className="border bg-card p-3"><h3 className="mb-2 text-[10px] font-semibold uppercase">Icon Library · 28</h3><div className="grid grid-cols-7 gap-1">{ICONS.map(ic=><button key={ic.id} title={ic.name} onClick={()=>patchCap(c=>{c.iconId=c.iconId===ic.id?null:ic.id;c.states.icon={...(c.states.icon||DEFAULT_OBJ(ic.color)),color:ic.color};return c})} className={`aspect-square border p-1 ${selectedCap.iconId===ic.id?"border-primary bg-muted":""}`}><div className="grid h-full grid-cols-7 grid-rows-7">{ic.matrix.flatMap((r,y)=>Array.from(r).map((v,x)=><span key={`${x}-${y}`} style={{background:v==="1"?ic.color:"transparent"}}/>))}</div></button>)}</div>{selectedCap.iconId&&<N l="Icon depth" v={selectedCap.iconDepth} step={.05} set={n=>patchCap(c=>{c.iconDepth=Math.max(.05,n);return c})}/>}</section>
      <section className="border bg-card p-3"><h3 className="mb-2 text-[10px] font-semibold uppercase">Objects · keycap đang chọn</h3><div className="space-y-1">{ids.map(id=>{const st=selectedCap.states[id];return <div key={id} onClick={()=>setSelectedObject(id)} className={`grid grid-cols-[28px_28px_1fr_28px] items-center border p-1 ${selectedObject===id?"border-primary bg-primary/5":""}`}><button onClick={e=>{e.stopPropagation();patchObject(id,{visible:!st?.visible})}}>{st?.visible?<Eye className="size-3.5"/>:<EyeOff className="size-3.5"/>}</button><input type="color" value={st?.color||"#ffffff"} onClick={e=>e.stopPropagation()} onChange={e=>patchObject(id,{color:e.target.value})} className="size-6"/><span className="truncate text-[9px]">{id==="body"?"Body / vỏ":id==="stem"?"Stem giữa":id==="stabL"?"Stabilizer trái":id==="stabR"?"Stabilizer phải":id==="icon"?`Icon · ${ICON_MAP[selectedCap.iconId]?.name||""}`:`Legend · ${selectedCap.legends.find(l=>l.id===id)?.text||id}`}</span><button onClick={e=>{e.stopPropagation();patchObject(id,{locked:!st?.locked})}}>{st?.locked?<Lock className="size-3.5"/>:<Unlock className="size-3.5"/>}</button></div>})}</div></section>
      {sObj&&<section className="space-y-2 border bg-card p-3"><h3 className="text-[10px] font-semibold uppercase">Inspector</h3><V title="Position" v={sObj.position} set={v=>patchObject(selectedObject,{position:v})}/><V title="Rotation" v={sObj.rotation} set={v=>patchObject(selectedObject,{rotation:v})}/><V title="Scale" v={sObj.scale} set={v=>patchObject(selectedObject,{scale:v})}/><button onClick={()=>patchObject(selectedObject,{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]})} className="flex h-8 w-full items-center justify-center gap-1 border text-[9px]"><RotateCcw className="size-3"/>Reset transform</button></section>}
      <section className="sticky bottom-0 space-y-2 border bg-card p-3 shadow-[0_-6px_20px_rgba(15,23,42,.06)]"><button onClick={exportCollection} className="h-10 w-full bg-primary text-[10px] text-primary-foreground"><Download className="mr-1 inline size-4"/>Export COLLECTION · {caps.length} keycap</button><div className="grid grid-cols-4 gap-1">{["body","stem","legends","icons"].map(x=><button key={x} onClick={()=>exportSelected(x)} className="border px-1 py-1 text-[8px] uppercase">{x}</button>)}</div></section>
    </aside>
  </div>;
}
