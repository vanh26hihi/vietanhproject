import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import './styles.css';

const profiles = {
  Cherry: { h: 9.5, top: 13.2, dish: 0.65, tilt: -6 },
  OEM: { h: 11.2, top: 13.5, dish: 0.75, tilt: -7 },
  XDA: { h: 9.1, top: 14.2, dish: 0.35, tilt: 0 },
  DSA: { h: 7.6, top: 14.0, dish: 0.45, tilt: 0 },
  SA: { h: 13.5, top: 12.7, dish: 1.0, tilt: -8 },
};
const sizes = { '1U': 18, '1.25U': 22.75, '1.5U': 27.5, '1.75U': 32.25, '2U': 37, '2.25U': 41.75, '2.75U': 51.25, '6.25U': 117.5 };
const fontUrls = {
  Sans: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_regular.typeface.json',
  Bold: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_bold.typeface.json',
  Serif: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/gentilis_regular.typeface.json',
  Mono: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/droid/droid_sans_mono_regular.typeface.json',
};
const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];

function brush(geometry) {
  const b = new Brush(geometry);
  b.updateMatrixWorld(true);
  return b;
}
function csg(a, b, op) {
  a.updateMatrixWorld(true);
  b.updateMatrixWorld(true);
  const out = evaluator.evaluate(a, b, op);
  out.geometry.computeVertexNormals();
  return out;
}
function roundedRing(w, d, r, z, segments = 48) {
  const pts = [];
  const rr = Math.max(0.05, Math.min(r, w / 2 - 0.02, d / 2 - 0.02));
  const perCorner = Math.max(3, Math.floor(segments / 4));
  const corners = [
    [w / 2 - rr, d / 2 - rr, 0, Math.PI / 2],
    [-w / 2 + rr, d / 2 - rr, Math.PI / 2, Math.PI],
    [-w / 2 + rr, -d / 2 + rr, Math.PI, Math.PI * 1.5],
    [w / 2 - rr, -d / 2 + rr, Math.PI * 1.5, Math.PI * 2],
  ];
  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i < perCorner; i++) {
      const a = a0 + ((a1 - a0) * i) / perCorner;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z]);
    }
  }
  return pts;
}
function loftGeometry(bw, bd, tw, td, h, corner, bottomZ = 0) {
  const levels = 8;
  const rings = [];
  const pos = [];
  const idx = [];
  for (let level = 0; level <= levels; level++) {
    const t = level / levels;
    const w = THREE.MathUtils.lerp(bw, tw, t);
    const d = THREE.MathUtils.lerp(bd, td, t);
    const ring = roundedRing(w, d, Math.min(corner, w * 0.22, d * 0.22), bottomZ + t * h);
    const start = pos.length / 3;
    for (const p of ring) pos.push(...p);
    rings.push({ start, count: ring.length });
  }
  const count = rings[0].count;
  for (let level = 0; level < levels; level++) {
    for (let i = 0; i < count; i++) {
      const a = rings[level].start + i;
      const b = rings[level].start + ((i + 1) % count);
      const cc = rings[level + 1].start + ((i + 1) % count);
      const d = rings[level + 1].start + i;
      idx.push(a, b, cc, a, cc, d);
    }
  }
  const topCenter = pos.length / 3;
  pos.push(0, 0, bottomZ + h);
  const top = rings[rings.length - 1];
  for (let i = 0; i < count; i++) idx.push(top.start + i, top.start + ((i + 1) % count), topCenter);
  const bottomCenter = pos.length / 3;
  pos.push(0, 0, bottomZ);
  const bottom = rings[0];
  for (let i = 0; i < count; i++) idx.push(bottom.start + ((i + 1) % count), bottom.start + i, bottomCenter);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeSocket(p, x = 0, y = 0) {
  const outer = new THREE.CylinderGeometry(p.socketOuter / 2, p.socketOuter / 2, p.socketHeight, 28);
  outer.rotateX(Math.PI / 2);
  outer.translate(x, y, p.socketHeight / 2 + p.socketBaseZ);
  let socket = brush(outer);
  const total = p.crossTotal + p.stemTolerance * 2;
  const arm = p.crossArm + p.stemTolerance * 2;
  const depth = p.socketHeight + 1;
  const g1 = new THREE.BoxGeometry(total, arm, depth);
  const g2 = new THREE.BoxGeometry(arm, total, depth);
  g1.translate(x, y, p.socketHeight / 2 + p.socketBaseZ);
  g2.translate(x, y, p.socketHeight / 2 + p.socketBaseZ);
  const cross = csg(brush(g1), brush(g2), ADDITION);
  socket = csg(socket, cross, SUBTRACTION);
  return socket;
}
function buildKeycapBase(p) {
  const outer = brush(loftGeometry(p.width, p.depth, p.topWidth, p.topDepth, p.height, p.corner));
  const iw = Math.max(1, p.width - 2 * p.wall);
  const id = Math.max(1, p.depth - 2 * p.wall);
  const itw = Math.max(1, p.topWidth - 2 * p.wall);
  const itd = Math.max(1, p.topDepth - 2 * p.wall);
  const cavityH = Math.max(0.5, p.height - p.topThickness + 0.6);
  let result = csg(outer, brush(loftGeometry(iw, id, itw, itd, cavityH, Math.max(0.2, p.corner - p.wall * 0.6), -0.5)), SUBTRACTION);
  if (p.dish > 0.01) {
    const radius = Math.max(18, Math.max(p.topWidth, p.topDepth) * 2.6);
    const sphere = new THREE.SphereGeometry(radius, 48, 24);
    sphere.translate(0, 0, p.height + radius - p.dish);
    result = csg(result, brush(sphere), SUBTRACTION);
  }
  if (p.stemEnabled) result = csg(result, makeSocket(p), ADDITION);
  if (p.stabilizers && p.width >= 36) {
    const half = p.stabSpacing / 2;
    result = csg(result, makeSocket(p, -half, 0), ADDITION);
    result = csg(result, makeSocket(p, half, 0), ADDITION);
  }
  return result;
}
function legendBrush(legend, p, font) {
  if (!font || !legend.text.trim() || legend.mode === 'Off') return null;
  const depth = legend.mode === 'Emboss' ? legend.depth + 0.28 : legend.depth + 0.45;
  const g = new TextGeometry(legend.text, {
    font,
    size: legend.size,
    depth,
    curveSegments: 5,
    bevelEnabled: legend.bevel > 0,
    bevelThickness: legend.bevel,
    bevelSize: legend.bevel,
    bevelSegments: 2,
  });
  g.computeBoundingBox();
  const box = g.boundingBox;
  g.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  g.rotateZ(THREE.MathUtils.degToRad(legend.rotate));
  const surface = p.height - Math.max(0.04, p.dish * 0.82);
  const z = legend.mode === 'Emboss' ? surface - 0.22 : surface - legend.depth;
  g.translate(legend.x, legend.y, z);
  return brush(g);
}
function buildKeycapGeometry(p, legends, fonts) {
  let solid = buildKeycapBase(p);
  for (const legend of legends) {
    const txt = legendBrush(legend, p, fonts[legend.font]);
    if (txt) solid = csg(solid, txt, legend.mode === 'Emboss' ? ADDITION : SUBTRACTION);
  }
  const g = solid.geometry.clone();
  g.rotateX(-Math.PI / 2);
  g.rotateZ(THREE.MathUtils.degToRad(p.tilt));
  g.computeVertexNormals();
  return g;
}

function roundedBox(w, d, h, r = 2, segments = 3) {
  const g = new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01));
  g.rotateX(Math.PI / 2);
  return g;
}
function buildTrayGeometry(t) {
  const slotW = t.slotWidth + t.clearance * 2;
  const slotD = t.slotDepth + t.clearance * 2;
  const overallW = (t.cols - 1) * t.pitchX + slotW + t.edge * 2;
  const overallD = (t.rows - 1) * t.pitchY + slotD + t.edge * 2;
  const overallH = t.baseThickness + t.pocketDepth + t.topLip;
  const outerG = roundedBox(overallW, overallD, overallH, t.outerRadius, 4);
  outerG.translate(0, 0, overallH / 2);
  let solid = brush(outerG);
  const pocketH = t.pocketDepth + t.topLip + 0.7;
  for (let row = 0; row < t.rows; row++) {
    for (let col = 0; col < t.cols; col++) {
      const idx = row * t.cols + col;
      if (!t.cells[idx]) continue;
      const x = (col - (t.cols - 1) / 2) * t.pitchX;
      const y = ((t.rows - 1) / 2 - row) * t.pitchY;
      const pocket = roundedBox(slotW, slotD, pocketH, t.slotRadius, 3);
      pocket.translate(x, y, t.baseThickness + pocketH / 2 - 0.15);
      solid = csg(solid, brush(pocket), SUBTRACTION);
      if (t.fingerNotch) {
        const notch = new THREE.CylinderGeometry(t.notchRadius, t.notchRadius, t.notchDepth + 1, 28);
        notch.rotateX(Math.PI / 2);
        notch.translate(x, y - slotD / 2 + t.notchRadius * 0.35, t.baseThickness + t.pocketDepth - t.notchDepth / 2 + 0.4);
        solid = csg(solid, brush(notch), SUBTRACTION);
      }
    }
  }
  if (t.wallCutout) {
    const cutW = overallW - t.edge * 2;
    const cutD = overallD - t.edge * 2;
    const g = roundedBox(cutW, cutD, t.baseThickness - 0.7, Math.max(0.5, t.outerRadius - 1), 3);
    g.translate(0, 0, (t.baseThickness - 0.7) / 2 + 0.35);
    solid = csg(solid, brush(g), SUBTRACTION);
  }
  const g = solid.geometry.clone();
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return { geometry: g, overallW, overallD, overallH };
}

function Controls({ view }) {
  const { camera, gl } = useThree();
  const ref = useRef();
  useEffect(() => {
    const c = new ThreeOrbitControls(camera, gl.domElement);
    c.target.set(0, 2, 0);
    c.enableDamping = true;
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useEffect(() => {
    const presets = {
      Iso: [32, 26, 34], Top: [0, 55, 0.01], Bottom: [0, -55, 0.01], Front: [0, 5, 55], Back: [0, 5, -55], Left: [-55, 5, 0], Right: [55, 5, 0],
    };
    const v = presets[view] || presets.Iso;
    camera.position.set(...v);
    camera.lookAt(0, 2, 0);
    ref.current?.update();
  }, [view, camera]);
  useFrame(() => ref.current?.update());
  return null;
}
function Model({ geometry, color, wireframe, transparent, modelRef }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.36, metalness: 0.04, transparent, opacity: transparent ? 0.55 : 1, wireframe, side: THREE.DoubleSide }), [color, wireframe, transparent]);
  return <mesh ref={modelRef} geometry={geometry} material={mat} />;
}
function Scene({ geometry, view, color, wireframe, transparent, modelRef }) {
  return <>
    <ambientLight intensity={1.2} />
    <directionalLight position={[12, 18, 14]} intensity={2.2} />
    <Model geometry={geometry} color={color} wireframe={wireframe} transparent={transparent} modelRef={modelRef} />
    <gridHelper args={[180, 180]} />
    <Controls view={view} />
  </>;
}

function NumberField({ label, value, onChange, min, max, step = 0.1, suffix = 'mm' }) {
  return <label className="field"><span>{label}</span><div><input type="number" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))} /><b>{suffix}</b></div></label>;
}
function SelectField({ label, value, onChange, children }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>;
}
function Toggle({ checked, onChange, children }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{children}</label>;
}
function exportMeshStl(mesh, filename) {
  if (!mesh) return;
  mesh.updateMatrixWorld(true);
  const data = new STLExporter().parse(mesh, { binary: true });
  const blob = new Blob([data], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function KeycapPanel({ p, setP, legends, setLegends, profile, setProfile, size, setSize, tab, setTab }) {
  const patch = x => setP(v => ({ ...v, ...x }));
  const applyProfile = n => { setProfile(n); const q = profiles[n]; patch({ height: q.h, topWidth: q.top, topDepth: q.top, dish: q.dish, tilt: q.tilt }); };
  const applySize = n => { setSize(n); patch({ width: sizes[n], depth: 18, stabilizers: ['2U', '2.25U', '2.75U', '6.25U'].includes(n), stabSpacing: n === '6.25U' ? 100.5 : 23.8 }); };
  const addLegend = () => setLegends(v => v.length >= 8 ? v : [...v, { id: crypto.randomUUID(), text: 'Fn', mode: 'Emboss', font: 'Sans', size: 3, depth: 0.5, bevel: 0.04, x: 0, y: 0, rotate: 0 }]);
  const updateLegend = (id, x) => setLegends(v => v.map(l => l.id === id ? { ...l, ...x } : l));
  const removeLegend = id => setLegends(v => v.filter(l => l.id !== id));
  return <>
    <div className="subtabs">{['Shape', 'Stem', 'Legends', 'Print'].map(x => <button key={x} className={tab === x ? 'active' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>
    {tab === 'Shape' && <>
      <section><h3>Size preset</h3><div className="chips">{Object.keys(sizes).map(n => <button key={n} className={size === n ? 'active' : ''} onClick={() => applySize(n)}>{n}</button>)}</div></section>
      <section><h3>Profile</h3><div className="chips">{Object.keys(profiles).map(n => <button key={n} className={profile === n ? 'active' : ''} onClick={() => applyProfile(n)}>{n}</button>)}</div></section>
      <section><h3>Body</h3><NumberField label="Bottom W" value={p.width} onChange={v => patch({ width: v })} /><NumberField label="Bottom D" value={p.depth} onChange={v => patch({ depth: v })} /><NumberField label="Top W" value={p.topWidth} onChange={v => patch({ topWidth: v })} /><NumberField label="Top D" value={p.topDepth} onChange={v => patch({ topDepth: v })} /><NumberField label="Height" value={p.height} onChange={v => patch({ height: v })} /><NumberField label="Wall" value={p.wall} onChange={v => patch({ wall: v })} /><NumberField label="Top thickness" value={p.topThickness} onChange={v => patch({ topThickness: v })} /><NumberField label="Corner" value={p.corner} onChange={v => patch({ corner: v })} /><NumberField label="Dish" value={p.dish} onChange={v => patch({ dish: v })} /><NumberField label="Tilt" value={p.tilt} onChange={v => patch({ tilt: v })} suffix="°" /></section>
    </>}
    {tab === 'Stem' && <>
      <section><h3>Cherry MX female socket</h3><Toggle checked={p.stemEnabled} onChange={v => patch({ stemEnabled: v })}>Center socket</Toggle><NumberField label="Cross total" value={p.crossTotal} onChange={v => patch({ crossTotal: v })} step={0.01} /><NumberField label="Cross arm" value={p.crossArm} onChange={v => patch({ crossArm: v })} step={0.01} /><NumberField label="Tolerance" value={p.stemTolerance} onChange={v => patch({ stemTolerance: v })} step={0.01} /><NumberField label="Housing OD" value={p.socketOuter} onChange={v => patch({ socketOuter: v })} /><NumberField label="Housing height" value={p.socketHeight} onChange={v => patch({ socketHeight: v })} /><NumberField label="Base Z" value={p.socketBaseZ} onChange={v => patch({ socketBaseZ: v })} /></section>
      <section><h3>Stabilizer</h3><Toggle checked={p.stabilizers} onChange={v => patch({ stabilizers: v })}>2 stabilizer sockets</Toggle><NumberField label="Spacing C-C" value={p.stabSpacing} onChange={v => patch({ stabSpacing: v })} /><div className="chips"><button onClick={() => patch({ stabSpacing: 23.8 })}>2U 23.8</button><button onClick={() => patch({ stabSpacing: 100.5 })}>6.25U 100.5</button></div></section>
    </>}
    {tab === 'Legends' && <section><div className="sectionHead"><h3>Legends ({legends.length}/8)</h3><button onClick={addLegend}>+ Add</button></div>{legends.map((l, i) => <div className="legendCard" key={l.id}><div className="legendTitle"><b>Legend {i + 1}</b><button className="danger" onClick={() => removeLegend(l.id)}>×</button></div><label className="field"><span>Text</span><input className="textinput" value={l.text} onChange={e => updateLegend(l.id, { text: e.target.value })} /></label><SelectField label="Mode" value={l.mode} onChange={v => updateLegend(l.id, { mode: v })}><option>Emboss</option><option>Deboss</option><option>Off</option></SelectField><SelectField label="Font" value={l.font} onChange={v => updateLegend(l.id, { font: v })}>{Object.keys(fontUrls).map(f => <option key={f}>{f}</option>)}</SelectField><NumberField label="Size" value={l.size} onChange={v => updateLegend(l.id, { size: v })} /><NumberField label="Depth" value={l.depth} onChange={v => updateLegend(l.id, { depth: v })} /><NumberField label="Bevel" value={l.bevel} onChange={v => updateLegend(l.id, { bevel: v })} step={0.01} /><div className="twoCols"><NumberField label="X" value={l.x} onChange={v => updateLegend(l.id, { x: v })} /><NumberField label="Y" value={l.y} onChange={v => updateLegend(l.id, { y: v })} /></div><NumberField label="Rotate" value={l.rotate} onChange={v => updateLegend(l.id, { rotate: v })} suffix="°" /></div>)}</section>}
    {tab === 'Print' && <section><h3>FDM presets</h3><div className="chips"><button onClick={() => patch({ stemTolerance: 0.05, wall: 0.8, topThickness: 1.2 })}>0.2 nozzle</button><button onClick={() => patch({ stemTolerance: 0.10, wall: 1.2, topThickness: 1.6 })}>0.4 nozzle</button><button onClick={() => patch({ stemTolerance: 0.15, wall: 1.8, topThickness: 2.0 })}>0.6 nozzle</button></div><p className="note">Stem tolerance vẫn nên test theo máy và vật liệu thực tế.</p></section>}
  </>;
}

function TrayPanel({ t, setT }) {
  const patch = x => setT(v => ({ ...v, ...x }));
  const resizeGrid = (rows, cols) => setT(v => { const cells = Array(rows * cols).fill(true); for (let r = 0; r < Math.min(rows, v.rows); r++) for (let c = 0; c < Math.min(cols, v.cols); c++) cells[r * cols + c] = v.cells[r * v.cols + c] ?? true; return { ...v, rows, cols, cells }; });
  const toggleCell = idx => setT(v => ({ ...v, cells: v.cells.map((x, i) => i === idx ? !x : x) }));
  const setAll = value => patch({ cells: Array(t.rows * t.cols).fill(value) });
  return <>
    <section><h3>Grid / layout</h3><div className="twoCols"><NumberField label="Rows" value={t.rows} min={1} max={12} step={1} onChange={v => resizeGrid(Math.max(1, Math.min(12, Math.round(v))), t.cols)} suffix="" /><NumberField label="Columns" value={t.cols} min={1} max={18} step={1} onChange={v => resizeGrid(t.rows, Math.max(1, Math.min(18, Math.round(v))))} suffix="" /></div><div className="chips"><button onClick={() => resizeGrid(4, 6)}>4×6</button><button onClick={() => resizeGrid(5, 7)}>5×7</button><button onClick={() => resizeGrid(6, 8)}>6×8</button><button onClick={() => resizeGrid(6, 12)}>6×12</button></div></section>
    <section><div className="sectionHead"><h3>Active pockets</h3><div><button onClick={() => setAll(true)}>All</button><button onClick={() => setAll(false)}>None</button></div></div><div className="cellGrid" style={{ gridTemplateColumns: `repeat(${t.cols}, 1fr)` }}>{t.cells.map((on, idx) => <button key={idx} className={on ? 'cell on' : 'cell'} onClick={() => toggleCell(idx)} title={`R${Math.floor(idx / t.cols) + 1} C${idx % t.cols + 1}`}>{on ? '✓' : ''}</button>)}</div><p className="note">Tắt từng ô để tạo khay theo layout riêng.</p></section>
    <section><h3>Pocket</h3><NumberField label="Slot width" value={t.slotWidth} onChange={v => patch({ slotWidth: v })} /><NumberField label="Slot depth" value={t.slotDepth} onChange={v => patch({ slotDepth: v })} /><NumberField label="Clearance" value={t.clearance} onChange={v => patch({ clearance: v })} step={0.05} /><NumberField label="Pocket depth" value={t.pocketDepth} onChange={v => patch({ pocketDepth: v })} /><NumberField label="Slot radius" value={t.slotRadius} onChange={v => patch({ slotRadius: v })} /></section>
    <section><h3>Spacing</h3><NumberField label="Pitch X" value={t.pitchX} onChange={v => patch({ pitchX: v })} step={0.05} /><NumberField label="Pitch Y" value={t.pitchY} onChange={v => patch({ pitchY: v })} step={0.05} /><button className="wideBtn" onClick={() => patch({ pitchX: 19.05, pitchY: 19.05 })}>Reset 19.05 mm</button></section>
    <section><h3>Tray body</h3><NumberField label="Edge margin" value={t.edge} onChange={v => patch({ edge: v })} /><NumberField label="Base thickness" value={t.baseThickness} onChange={v => patch({ baseThickness: v })} /><NumberField label="Top lip" value={t.topLip} onChange={v => patch({ topLip: v })} /><NumberField label="Outer radius" value={t.outerRadius} onChange={v => patch({ outerRadius: v })} /><Toggle checked={t.fingerNotch} onChange={v => patch({ fingerNotch: v })}>Finger notch</Toggle>{t.fingerNotch && <><NumberField label="Notch radius" value={t.notchRadius} onChange={v => patch({ notchRadius: v })} /><NumberField label="Notch depth" value={t.notchDepth} onChange={v => patch({ notchDepth: v })} /></>}<Toggle checked={t.wallCutout} onChange={v => patch({ wallCutout: v })}>Lightweight underside recess</Toggle></section>
    <section><h3>Quick presets</h3><div className="chips"><button onClick={() => patch({ slotWidth: 18.2, slotDepth: 18.2, clearance: 0.3, pocketDepth: 5.5, pitchX: 19.05, pitchY: 19.05 })}>1U loose</button><button onClick={() => patch({ slotWidth: 18.0, slotDepth: 18.0, clearance: 0.15, pocketDepth: 4.5, pitchX: 19.05, pitchY: 19.05 })}>1U snug</button><button onClick={() => patch({ baseThickness: 1.8, edge: 2.5, topLip: 0.8 })}>Light</button><button onClick={() => patch({ baseThickness: 3.0, edge: 4.0, topLip: 1.5 })}>Strong</button></div></section>
  </>;
}

function App() {
  const modelRef = useRef();
  const [mode, setMode] = useState('Keycap');
  const [view, setView] = useState('Iso');
  const [wireframe, setWireframe] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const [color, setColor] = useState('#d9e3f1');
  const [profile, setProfile] = useState('Cherry');
  const [size, setSize] = useState('1U');
  const [tab, setTab] = useState('Shape');
  const [fonts, setFonts] = useState({});
  const [p, setP] = useState({ width: 18, depth: 18, topWidth: 13.2, topDepth: 13.2, height: 9.5, wall: 1.2, topThickness: 1.6, corner: 1.7, dish: 0.65, tilt: -6, stemEnabled: true, crossTotal: 4.10, crossArm: 1.17, stemTolerance: 0.10, socketOuter: 5.6, socketHeight: 4.2, socketBaseZ: 0.7, stabilizers: false, stabSpacing: 23.8 });
  const [legends, setLegends] = useState([{ id: crypto.randomUUID(), text: 'A', mode: 'Emboss', font: 'Sans', size: 4.2, depth: 0.55, bevel: 0.05, x: 0, y: 0, rotate: 0 }]);
  const [t, setT] = useState({ rows: 4, cols: 6, cells: Array(24).fill(true), slotWidth: 18.2, slotDepth: 18.2, clearance: 0.30, pocketDepth: 5.5, slotRadius: 1.8, pitchX: 19.05, pitchY: 19.05, edge: 3.0, baseThickness: 2.2, topLip: 1.0, outerRadius: 3.0, fingerNotch: false, notchRadius: 3.0, notchDepth: 2.0, wallCutout: false });

  useEffect(() => {
    let dead = false;
    Promise.all(Object.entries(fontUrls).map(async ([name, url]) => {
      try { const r = await fetch(url); const j = await r.json(); return [name, new FontLoader().parse(j)]; } catch { return [name, null]; }
    })).then(entries => { if (!dead) setFonts(Object.fromEntries(entries.filter(([, f]) => f))); });
    return () => { dead = true; };
  }, []);

  const keycapGeometry = useMemo(() => { try { return buildKeycapGeometry(p, legends, fonts); } catch (e) { console.error('keycap CSG', e); return new THREE.BoxGeometry(1, 1, 1); } }, [p, legends, fonts]);
  const trayData = useMemo(() => { try { return buildTrayGeometry(t); } catch (e) { console.error('tray CSG', e); return { geometry: new THREE.BoxGeometry(1, 1, 1), overallW: 1, overallD: 1, overallH: 1 }; } }, [t]);
  const geometry = mode === 'Keycap' ? keycapGeometry : trayData.geometry;
  const bounds = useMemo(() => { geometry.computeBoundingBox(); const b = geometry.boundingBox; return b ? new THREE.Vector3().subVectors(b.max, b.min) : new THREE.Vector3(); }, [geometry]);
  const activePockets = t.cells.filter(Boolean).length;

  const exportJson = () => downloadJson({ version: 4, mode, keycap: { p, legends, profile, size }, tray: t }, `keycap-studio-${mode.toLowerCase()}.json`);
  const importJson = e => { const f = e.target.files?.[0]; if (!f) return; f.text().then(text => { try { const q = JSON.parse(text); if (q.mode) setMode(q.mode); if (q.keycap) { if (q.keycap.p) setP(q.keycap.p); if (q.keycap.legends) setLegends(q.keycap.legends); if (q.keycap.profile) setProfile(q.keycap.profile); if (q.keycap.size) setSize(q.keycap.size); } if (q.tray) setT(q.tray); } catch { alert('JSON không hợp lệ'); } }); e.target.value = ''; };
  const exportStl = () => exportMeshStl(modelRef.current, mode === 'Keycap' ? `keycap_${size}_${profile}.stl` : `keycap_tray_${t.rows}x${t.cols}_${activePockets}slots.stl`);

  return <div className="app darkApp">
    <header className="studioHeader"><div><h1>Keycap Studio</h1><p>Keycap + Tray Generator • STL ready</p></div><div className="modeSwitch"><button className={mode === 'Keycap' ? 'active' : ''} onClick={() => setMode('Keycap')}>Keycap</button><button className={mode === 'Tray' ? 'active' : ''} onClick={() => setMode('Tray')}>Tray Generator</button></div><div className="actions"><label className="filebtn">Import<input type="file" accept="application/json" onChange={importJson} /></label><button onClick={exportJson}>JSON</button><button className="primary" onClick={exportStl}>Export STL</button></div></header>
    <main className="studioMain">
      <aside className="leftPanel">{mode === 'Keycap' ? <KeycapPanel p={p} setP={setP} legends={legends} setLegends={setLegends} profile={profile} setProfile={setProfile} size={size} setSize={setSize} tab={tab} setTab={setTab} /> : <TrayPanel t={t} setT={setT} />}</aside>
      <div className="viewer studioViewer"><Canvas camera={{ position: [32, 26, 34], fov: 36 }}><Scene geometry={geometry} view={view} color={color} wireframe={wireframe} transparent={transparent} modelRef={modelRef} /></Canvas><div className="hint">Drag rotate • Wheel zoom • Grid 1 mm</div></div>
      <aside className="right inspector"><section><h3>{mode === 'Keycap' ? 'Keycap Inspector' : 'Tray Inspector'}</h3>{mode === 'Keycap' ? <div className="stats"><span>Size <b>{size}</b></span><span>Profile <b>{profile}</b></span><span>Legends <b>{legends.length}</b></span><span>Stem <b>{p.stemEnabled ? 'MX female' : 'Off'}</b></span></div> : <div className="stats"><span>Grid <b>{t.rows} × {t.cols}</b></span><span>Pockets <b>{activePockets}</b></span><span>Overall W <b>{trayData.overallW.toFixed(2)} mm</b></span><span>Overall D <b>{trayData.overallD.toFixed(2)} mm</b></span><span>Overall H <b>{trayData.overallH.toFixed(2)} mm</b></span></div>}<hr/><div className="stats"><span>Mesh X <b>{bounds.x.toFixed(2)} mm</b></span><span>Mesh Y <b>{bounds.y.toFixed(2)} mm</b></span><span>Mesh Z <b>{bounds.z.toFixed(2)} mm</b></span></div></section><section><h3>View</h3><div className="viewGrid">{['Iso','Top','Bottom','Front','Back','Left','Right'].map(v => <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v}</button>)}</div><Toggle checked={wireframe} onChange={setWireframe}>Wireframe</Toggle><Toggle checked={transparent} onChange={setTransparent}>Transparent</Toggle><label className="colorRow">Model color <input type="color" value={color} onChange={e => setColor(e.target.value)} /></label></section>{mode === 'Tray' && <section><h3>Tray notes</h3><p className="note">Pocket size = slot + 2×clearance. Pitch mặc định 19.05 mm. Bạn có thể tắt từng pocket để tạo layout tùy ý.</p><p className="note">Nếu khay quá lớn so với bàn in, giảm hàng/cột hoặc tách thành nhiều khay.</p></section>}</aside>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
