import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import JSZip from "jszip";
import { useMemo, useState } from "react";
import { Download, Grid3X3, RotateCcw } from "lucide-react";
import { buildKeycap, mergeGeometries } from "./geometry";
import { DEFAULT_PARAMS, PROFILES, SIZES, applyProfile, applySize, type ProfileId, type SizeId } from "./params";
import { download, exportSTL } from "./export";

type Cell = {
  id: string;
  row: number;
  col: number;
  active: boolean;
  sizeId: Exclude<SizeId, "custom">;
  profileId: ProfileId;
  color: string;
  name: string;
};

type LayoutState = {
  rows: number;
  cols: number;
  pitch: number;
  switchHole: number;
  plateThickness: number;
  edge: number;
  plateColor: string;
  showPlate: boolean;
  showKeycaps: boolean;
};

const COLORS = ["#4f83d1", "#d45b5b", "#57a773", "#9b6bd3", "#e49a3a", "#5c6f82"];
const SIZE_IDS = Object.keys(SIZES) as Exclude<SizeId, "custom">[];
const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];
const INITIAL: LayoutState = { rows: 4, cols: 6, pitch: 19.05, switchHole: 14.1, plateThickness: 1.6, edge: 4, plateColor: "#d9dee7", showPlate: true, showKeycaps: true };

function makeCells(rows: number, cols: number, old: Cell[] = []) {
  const byPos = new Map(old.map((x) => [`${x.row}:${x.col}`, x]));
  const out: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const prev = byPos.get(`${r}:${c}`);
      out.push(prev ?? { id: crypto.randomUUID(), row: r, col: c, active: true, sizeId: "1u", profileId: "cherry", color: COLORS[(r * cols + c) % COLORS.length]!, name: `R${r + 1}C${c + 1}` });
    }
  }
  return out;
}

function box(w: number, d: number, h: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, d, h);
  g.translate(x, y, z);
  return g.toNonIndexed();
}

function plateInfo(s: LayoutState) {
  const W = (s.cols - 1) * s.pitch + s.switchHole + s.edge * 2;
  const D = (s.rows - 1) * s.pitch + s.switchHole + s.edge * 2;
  const rail = Math.max(0.4, s.pitch - s.switchHole);
  return { W, D, rail };
}

function buildPlate(s: LayoutState, cells: Cell[]) {
  const i = plateInfo(s);
  const gs: THREE.BufferGeometry[] = [];
  const z = s.plateThickness / 2;
  const left = -(i.W / 2 - s.edge / 2), right = -left, bottom = -(i.D / 2 - s.edge / 2), top = -bottom;
  gs.push(box(s.edge, i.D, s.plateThickness, left, 0, z));
  gs.push(box(s.edge, i.D, s.plateThickness, right, 0, z));
  gs.push(box(i.W - s.edge * 2, s.edge, s.plateThickness, 0, bottom, z));
  gs.push(box(i.W - s.edge * 2, s.edge, s.plateThickness, 0, top, z));
  for (let c = 0; c < s.cols - 1; c++) {
    const x = (c - (s.cols - 2) / 2) * s.pitch;
    gs.push(box(i.rail, i.D - s.edge * 2, s.plateThickness, x, 0, z));
  }
  for (let r = 0; r < s.rows - 1; r++) {
    const y = (r - (s.rows - 2) / 2) * s.pitch;
    gs.push(box(i.W - s.edge * 2, i.rail, s.plateThickness, 0, y, z));
  }
  for (const cell of cells) {
    if (cell.active) continue;
    const x = (cell.col - (s.cols - 1) / 2) * s.pitch;
    const y = ((s.rows - 1) / 2 - cell.row) * s.pitch;
    gs.push(box(s.switchHole, s.switchHole, s.plateThickness, x, y, z));
  }
  return mergeGeometries(gs);
}

function keyParams(cell: Cell) {
  let p = applySize(DEFAULT_PARAMS, cell.sizeId);
  p = applyProfile(p, cell.profileId);
  if (p.units >= 2) p = { ...p, stabEnabled: true, stabSpacing: p.units >= 6 ? 100 : 23.8 };
  return p;
}

function KeyMesh({ cell, layout, selected, onSelect }: { cell: Cell; layout: LayoutState; selected: boolean; onSelect: () => void }) {
  const build = useMemo(() => buildKeycap(keyParams(cell)), [cell.sizeId, cell.profileId]);
  const x = (cell.col - (layout.cols - 1) / 2) * layout.pitch;
  const y = ((layout.rows - 1) / 2 - cell.row) * layout.pitch;
  return (
    <group position={[x, y, layout.plateThickness + 7]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <mesh geometry={build.shell}>
        <meshStandardMaterial color={selected ? "#f59e0b" : cell.color} roughness={0.42} />
      </mesh>
      {build.stems ? <mesh geometry={build.stems}><meshStandardMaterial color="#376da7" roughness={0.45} /></mesh> : null}
    </group>
  );
}

function Scene({ layout, cells, selected, onSelect }: { layout: LayoutState; cells: Cell[]; selected: string | null; onSelect: (id: string) => void }) {
  const plate = useMemo(() => buildPlate(layout, cells), [layout, cells]);
  const i = plateInfo(layout);
  const cameraScale = Math.max(i.W, i.D, 50);
  return (
    <Canvas shadows gl={{ antialias: true }} onPointerMissed={() => onSelect("")}>
      <color attach="background" args={["#eef2f7"]} />
      <PerspectiveCamera makeDefault position={[cameraScale * 0.85, -cameraScale, cameraScale * 0.72]} fov={38} up={[0, 0, 1]} />
      <OrbitControls makeDefault target={[0, 0, 5]} enableDamping />
      <ambientLight intensity={1.05} />
      <directionalLight position={[40, -50, 80]} intensity={1.55} castShadow />
      {layout.showPlate ? <mesh geometry={plate} castShadow receiveShadow><meshStandardMaterial color={layout.plateColor} roughness={0.5} /></mesh> : null}
      {layout.showKeycaps ? cells.filter((c) => c.active).map((c) => <KeyMesh key={c.id} cell={c} layout={layout} selected={c.id === selected} onSelect={() => onSelect(c.id)} />) : null}
      <Grid args={[400, 400]} rotation={[Math.PI / 2, 0, 0]} cellSize={1} sectionSize={19.05} infiniteGrid fadeDistance={220} cellColor="#cbd5e1" sectionColor="#8aa4c4" />
      <axesHelper args={[30]} />
    </Canvas>
  );
}

function NumberInput({ label, value, onChange, step = 0.1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return <label className="grid grid-cols-[1fr_90px] items-center gap-2 text-xs"><span>{label}</span><input className="h-8 rounded-md border bg-background px-2 text-right font-mono" type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

function placedKeyGeometry(cell: Cell, layout: LayoutState) {
  const build = buildKeycap(keyParams(cell));
  const x = (cell.col - (layout.cols - 1) / 2) * layout.pitch;
  const y = ((layout.rows - 1) / 2 - cell.row) * layout.pitch;
  const parts = [build.shell, ...(build.stems ? [build.stems] : [])].map((g) => {
    const c = g.clone();
    c.translate(x, y, layout.plateThickness + 7);
    return c;
  });
  return mergeGeometries(parts);
}

export default function Layout() {
  const [layout, setLayout] = useState<LayoutState>(INITIAL);
  const [cells, setCells] = useState<Cell[]>(() => makeCells(INITIAL.rows, INITIAL.cols));
  const [selected, setSelected] = useState<string | null>(cells[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const sel = cells.find((c) => c.id === selected) ?? null;
  const pinfo = plateInfo(layout);
  const setL = (p: Partial<LayoutState>) => setLayout((v) => ({ ...v, ...p }));
  const patchCell = (id: string, p: Partial<Cell>) => setCells((v) => v.map((c) => c.id === id ? { ...c, ...p } : c));
  const resize = (rows: number, cols: number) => {
    const r = Math.max(1, Math.min(8, Math.round(rows)));
    const c = Math.max(1, Math.min(12, Math.round(cols)));
    setLayout((v) => ({ ...v, rows: r, cols: c }));
    setCells((old) => makeCells(r, c, old));
  };
  const active = cells.filter((c) => c.active);
  const overlaps = active.filter((c) => SIZES[c.sizeId].units > 1).length;

  const exportPlate = () => download(exportSTL(buildPlate(layout, cells)), "switch-plate-layout.stl");
  const exportAssembly = () => {
    const parts = [buildPlate(layout, cells), ...active.map((c) => placedKeyGeometry(c, layout))];
    download(exportSTL(mergeGeometries(parts)), "layout-keycaps-plate.stl");
  };
  const exportZip = async () => {
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const cell of active) {
        const blob = exportSTL(buildKeycap(keyParams(cell)).merged);
        zip.file(`${cell.name}_${cell.sizeId}_${cell.profileId}.stl`, await blob.arrayBuffer());
      }
      const plate = exportSTL(buildPlate(layout, cells));
      zip.file("switch-plate.stl", await plate.arrayBuffer());
      const json = JSON.stringify({ version: 1, layout, cells }, null, 2);
      zip.file("layout.json", json);
      download(await zip.generateAsync({ type: "blob" }), "layout-keycaps.zip");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[310px_1fr_300px] bg-background">
      <aside className="space-y-3 overflow-y-auto border-r p-3 pt-16">
        <section className="rounded-lg border bg-card p-3">
          <div className="mb-3 flex items-center gap-2"><Grid3X3 className="size-4 text-primary" /><div><h2 className="text-sm font-semibold">Bố cục / Layout</h2><p className="text-[11px] text-muted-foreground">Nhiều keycap + plate lỗ switch MX.</p></div></div>
          <div className="space-y-2"><NumberInput label="Hàng" value={layout.rows} step={1} onChange={(n) => resize(n, layout.cols)} /><NumberInput label="Cột" value={layout.cols} step={1} onChange={(n) => resize(layout.rows, n)} /><NumberInput label="Pitch" value={layout.pitch} step={0.05} onChange={(n) => setL({ pitch: n })} /><NumberInput label="Lỗ switch MX" value={layout.switchHole} step={0.05} onChange={(n) => setL({ switchHole: n })} /><NumberInput label="Dày plate" value={layout.plateThickness} step={0.1} onChange={(n) => setL({ plateThickness: n })} /><NumberInput label="Viền ngoài" value={layout.edge} step={0.1} onChange={(n) => setL({ edge: n })} /></div>
        </section>
        <section className="rounded-lg border bg-card p-3"><h3 className="mb-2 text-xs font-semibold">Grid keycap</h3><div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0,1fr))` }}>{cells.map((c) => <button key={c.id} title={`${c.name} · ${c.sizeId} · ${c.profileId}`} onClick={() => setSelected(c.id)} onDoubleClick={() => patchCell(c.id, { active: !c.active })} className={`aspect-square rounded border text-[9px] ${c.id === selected ? "border-primary ring-1 ring-primary" : ""} ${c.active ? "text-white" : "bg-muted text-muted-foreground"}`} style={c.active ? { background: c.color } : undefined}>{c.active ? SIZES[c.sizeId].label.replace("Spacebar ", "") : "×"}</button>)}</div><p className="mt-2 text-[10px] text-muted-foreground">Click chọn ô · double click bật/tắt.</p></section>
        <section className="rounded-lg border bg-card p-3"><label className="flex items-center justify-between text-xs"><span>Hiện plate</span><input type="checkbox" checked={layout.showPlate} onChange={(e) => setL({ showPlate: e.target.checked })} /></label><label className="mt-2 flex items-center justify-between text-xs"><span>Hiện keycap</span><input type="checkbox" checked={layout.showKeycaps} onChange={(e) => setL({ showKeycaps: e.target.checked })} /></label><label className="mt-3 flex items-center justify-between text-xs"><span>Màu plate</span><input type="color" value={layout.plateColor} onChange={(e) => setL({ plateColor: e.target.value })} /></label></section>
      </aside>
      <main className="min-h-0 pt-12"><Scene layout={layout} cells={cells} selected={selected} onSelect={(id) => setSelected(id || null)} /></main>
      <aside className="space-y-3 overflow-y-auto border-l p-3 pt-16">
        <section className="rounded-lg border bg-card p-3"><h3 className="mb-2 text-xs font-semibold">Tổng quan</h3><dl className="space-y-2 text-xs"><div className="flex justify-between"><dt className="text-muted-foreground">Keycap đang bật</dt><dd className="font-mono">{active.length}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Plate X</dt><dd className="font-mono">{pinfo.W.toFixed(2)} mm</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Plate Y</dt><dd className="font-mono">{pinfo.D.toFixed(2)} mm</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Vách giữa lỗ</dt><dd className="font-mono">{pinfo.rail.toFixed(2)} mm</dd></div></dl>{overlaps > 0 ? <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-800">Có {overlaps} keycap lớn hơn 1U. Hãy tắt các ô lân cận nếu chúng bị chồng trong preview.</div> : null}</section>
        {sel ? <section className="space-y-3 rounded-lg border bg-card p-3"><h3 className="text-xs font-semibold">Ô đang chọn · {sel.name}</h3><label className="flex items-center justify-between text-xs"><span>Bật keycap / switch</span><input type="checkbox" checked={sel.active} onChange={(e) => patchCell(sel.id, { active: e.target.checked })} /></label><label className="space-y-1 text-[11px]"><span className="text-muted-foreground">Tên</span><input className="h-8 w-full rounded-md border bg-background px-2" value={sel.name} onChange={(e) => patchCell(sel.id, { name: e.target.value })} /></label><label className="space-y-1 text-[11px]"><span className="text-muted-foreground">Kích thước</span><select className="h-8 w-full rounded-md border bg-background px-2" value={sel.sizeId} onChange={(e) => patchCell(sel.id, { sizeId: e.target.value as Cell["sizeId"] })}>{SIZE_IDS.map((id) => <option value={id} key={id}>{SIZES[id].label}</option>)}</select></label><label className="space-y-1 text-[11px]"><span className="text-muted-foreground">Profile</span><select className="h-8 w-full rounded-md border bg-background px-2" value={sel.profileId} onChange={(e) => patchCell(sel.id, { profileId: e.target.value as ProfileId })}>{PROFILE_IDS.map((id) => <option value={id} key={id}>{PROFILES[id].label}</option>)}</select></label><label className="flex items-center justify-between text-xs"><span>Màu keycap</span><input type="color" value={sel.color} onChange={(e) => patchCell(sel.id, { color: e.target.value })} /></label></section> : null}
        <section className="space-y-2 rounded-lg border bg-card p-3"><button onClick={exportPlate} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background text-xs"><Download className="size-4" />Xuất STL plate</button><button onClick={exportAssembly} disabled={!active.length} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background text-xs">Xuất STL layout + keycap</button><button onClick={() => void exportZip()} disabled={!active.length || busy} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-primary-foreground"><Download className="size-4" />{busy ? "Đang đóng gói..." : "ZIP plate + từng keycap"}</button><button onClick={() => { setLayout(INITIAL); const n = makeCells(INITIAL.rows, INITIAL.cols); setCells(n); setSelected(n[0]?.id ?? null); }} className="flex h-9 w-full items-center justify-center gap-2 rounded-md border bg-background text-xs"><RotateCcw className="size-4" />Reset layout</button></section>
      </aside>
    </div>
  );
}
