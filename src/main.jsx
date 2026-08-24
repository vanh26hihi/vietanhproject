import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import './styles.css';

const profiles = {
  Cherry: { h: 9.5, top: 13.2, dish: 0.65, tilt: -6 },
  OEM: { h: 11.2, top: 13.5, dish: 0.75, tilt: -7 },
  XDA: { h: 9.1, top: 14.2, dish: 0.35, tilt: 0 },
  DSA: { h: 7.6, top: 14.0, dish: 0.45, tilt: 0 },
  SA: { h: 13.5, top: 12.7, dish: 1.0, tilt: -8 },
};

const sizes = {
  '1U': 18,
  '1.25U': 22.75,
  '1.5U': 27.5,
  '1.75U': 32.25,
  '2U': 37,
  '2.25U': 41.75,
  '2.75U': 51.25,
  '6.25U': 117.5,
};

const fontUrls = {
  Sans: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_regular.typeface.json',
  Bold: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/helvetiker_bold.typeface.json',
  Serif: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/gentilis_regular.typeface.json',
  Mono: 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/fonts/droid/droid_sans_mono_regular.typeface.json',
};

const evaluator = new Evaluator();
evaluator.attributes = ['position', 'normal'];

function roundedRing(width, depth, radius, z, segments = 48) {
  const points = [];
  const r = Math.max(0.05, Math.min(radius, width / 2 - 0.02, depth / 2 - 0.02));
  const perCorner = Math.max(3, Math.floor(segments / 4));
  const corners = [
    [width / 2 - r, depth / 2 - r, 0, Math.PI / 2],
    [-width / 2 + r, depth / 2 - r, Math.PI / 2, Math.PI],
    [-width / 2 + r, -depth / 2 + r, Math.PI, Math.PI * 1.5],
    [width / 2 - r, -depth / 2 + r, Math.PI * 1.5, Math.PI * 2],
  ];

  for (const [cx, cy, a0, a1] of corners) {
    for (let i = 0; i < perCorner; i += 1) {
      const a = a0 + ((a1 - a0) * i) / perCorner;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
  }
  return points;
}

function loftGeometry(bottomW, bottomD, topW, topD, height, corner, bottomZ = 0) {
  const levels = 8;
  const rings = [];
  const positions = [];
  const indices = [];

  for (let level = 0; level <= levels; level += 1) {
    const t = level / levels;
    const width = THREE.MathUtils.lerp(bottomW, topW, t);
    const depth = THREE.MathUtils.lerp(bottomD, topD, t);
    const ring = roundedRing(width, depth, Math.min(corner, width * 0.22, depth * 0.22), bottomZ + t * height);
    const start = positions.length / 3;
    for (const point of ring) positions.push(...point);
    rings.push({ start, count: ring.length });
  }

  const count = rings[0].count;
  for (let level = 0; level < levels; level += 1) {
    for (let i = 0; i < count; i += 1) {
      const a = rings[level].start + i;
      const b = rings[level].start + ((i + 1) % count);
      const c = rings[level + 1].start + ((i + 1) % count);
      const d = rings[level + 1].start + i;
      indices.push(a, b, c, a, c, d);
    }
  }

  const topCenter = positions.length / 3;
  positions.push(0, 0, bottomZ + height);
  const top = rings[rings.length - 1];
  for (let i = 0; i < count; i += 1) {
    indices.push(top.start + i, top.start + ((i + 1) % count), topCenter);
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, 0, bottomZ);
  const bottom = rings[0];
  for (let i = 0; i < count; i += 1) {
    indices.push(bottom.start + ((i + 1) % count), bottom.start + i, bottomCenter);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function toBrush(geometry) {
  const brush = new Brush(geometry);
  brush.updateMatrixWorld(true);
  return brush;
}

function csg(a, b, operation) {
  a.updateMatrixWorld(true);
  b.updateMatrixWorld(true);
  const result = evaluator.evaluate(a, b, operation);
  result.geometry.computeVertexNormals();
  return result;
}

function buildBase(params) {
  let result = toBrush(
    loftGeometry(
      params.width,
      params.depth,
      params.topWidth,
      params.topDepth,
      params.height,
      params.corner,
    ),
  );

  const innerW = Math.max(1, params.width - params.wall * 2);
  const innerD = Math.max(1, params.depth - params.wall * 2);
  const innerTopW = Math.max(1, params.topWidth - params.wall * 2);
  const innerTopD = Math.max(1, params.topDepth - params.wall * 2);
  const cavityHeight = Math.max(0.5, params.height - params.topThickness + 0.6);

  const cavity = toBrush(
    loftGeometry(
      innerW,
      innerD,
      innerTopW,
      innerTopD,
      cavityHeight,
      Math.max(0.2, params.corner - params.wall * 0.6),
      -0.5,
    ),
  );
  result = csg(result, cavity, SUBTRACTION);

  if (params.dish > 0.01) {
    const radius = Math.max(18, Math.max(params.topWidth, params.topDepth) * 2.6);
    const dishGeometry = new THREE.SphereGeometry(radius, 48, 24);
    dishGeometry.translate(0, 0, params.height + radius - params.dish);
    result = csg(result, toBrush(dishGeometry), SUBTRACTION);
  }

  if (params.stemEnabled) {
    const arm = Math.max(0.9, 1.15 + params.clearance);
    const long = Math.max(3.7, 4.05 + params.clearance);
    const stemTop = params.height - params.topThickness + 0.18;
    const stemHeight = Math.min(params.stemHeight, Math.max(2.2, stemTop + 0.2));
    const stemZ = stemTop - stemHeight / 2;

    const horizontal = new THREE.BoxGeometry(long, arm, stemHeight);
    horizontal.translate(0, 0, stemZ);
    const vertical = new THREE.BoxGeometry(arm, long, stemHeight);
    vertical.translate(0, 0, stemZ);
    const stem = csg(toBrush(horizontal), toBrush(vertical), ADDITION);
    result = csg(result, stem, ADDITION);
  }

  return result;
}

function buildTextBrush(params, font) {
  if (!font || !params.text.trim() || params.textMode === 'Off') return null;

  const depth = params.textMode === 'Emboss' ? params.textDepth + 0.28 : params.textDepth + 0.45;
  const geometry = new TextGeometry(params.text, {
    font,
    size: params.textSize,
    depth,
    curveSegments: 5,
    bevelEnabled: params.textBevel > 0,
    bevelThickness: params.textBevel,
    bevelSize: params.textBevel,
    bevelSegments: 2,
  });

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  geometry.rotateZ(THREE.MathUtils.degToRad(params.textRotate));

  const surfaceZ = params.height - Math.max(0.04, params.dish * 0.82);
  const z = params.textMode === 'Emboss' ? surfaceZ - 0.22 : surfaceZ - params.textDepth;
  geometry.translate(params.textX, params.textY, z);
  return toBrush(geometry);
}

function buildFinalGeometry(params, font) {
  let solid = buildBase(params);
  const text = buildTextBrush(params, font);
  if (text) solid = csg(solid, text, params.textMode === 'Emboss' ? ADDITION : SUBTRACTION);

  const geometry = solid.geometry.clone();
  geometry.rotateX(-Math.PI / 2);
  geometry.rotateZ(THREE.MathUtils.degToRad(params.tilt));
  geometry.computeVertexNormals();
  return geometry;
}

function Controls() {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);

  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement);
    controls.target.set(0, 3, 0);
    controls.enableDamping = true;
    controlsRef.current = controls;
    return () => controls.dispose();
  }, [camera, gl]);

  useFrame(() => controlsRef.current?.update());
  return null;
}

function Model({ geometry, params, modelRef }) {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8eef7',
        roughness: 0.36,
        metalness: 0.04,
        transparent: params.transparent,
        opacity: params.transparent ? 0.58 : 1,
        wireframe: params.wireframe,
        side: THREE.DoubleSide,
      }),
    [params.transparent, params.wireframe],
  );

  return <mesh ref={modelRef} geometry={geometry} material={material} />;
}

function Scene({ geometry, params, modelRef }) {
  return (
    <>
      <ambientLight intensity={1.25} />
      <directionalLight position={[8, 12, 8]} intensity={2} />
      <Model geometry={geometry} params={params} modelRef={modelRef} />
      <gridHelper args={[140, 140]} />
      <Controls />
    </>
  );
}

function NumberField({ label, value, onChange, step = 0.1, suffix = 'mm' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} />
        <b>{suffix}</b>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function App() {
  const modelRef = useRef(null);
  const [size, setSize] = useState('1U');
  const [profile, setProfile] = useState('Cherry');
  const [font, setFont] = useState(null);
  const [fontError, setFontError] = useState('');
  const [params, setParams] = useState({
    width: 18,
    depth: 18,
    topWidth: 13.2,
    topDepth: 13.2,
    height: 9.5,
    wall: 1.2,
    topThickness: 1.6,
    corner: 1.7,
    dish: 0.65,
    tilt: -6,
    clearance: 0.1,
    stemEnabled: true,
    stemHeight: 4.4,
    text: 'A',
    textMode: 'Emboss',
    textFont: 'Sans',
    textSize: 4.2,
    textDepth: 0.55,
    textBevel: 0.05,
    textX: 0,
    textY: 0,
    textRotate: 0,
    wireframe: false,
    transparent: false,
  });

  const patch = (next) => setParams((current) => ({ ...current, ...next }));

  useEffect(() => {
    let cancelled = false;
    setFont(null);
    setFontError('');
    fetch(fontUrls[params.textFont])
      .then((response) => {
        if (!response.ok) throw new Error('font');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setFont(new FontLoader().parse(json));
      })
      .catch(() => {
        if (!cancelled) setFontError('Không tải được font. Hãy thử đổi font hoặc tải lại trang.');
      });
    return () => {
      cancelled = true;
    };
  }, [params.textFont]);

  const geometry = useMemo(() => {
    try {
      return buildFinalGeometry(params, font);
    } catch (error) {
      console.error('Geometry error', error);
      return new THREE.BoxGeometry(1, 1, 1);
    }
  }, [params, font]);

  const bounds = useMemo(() => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    return box ? new THREE.Vector3().subVectors(box.max, box.min) : new THREE.Vector3();
  }, [geometry]);

  const warnings = [];
  if (params.wall < 0.8) warnings.push('Wall dưới 0.8 mm khá mỏng cho nozzle 0.4.');
  if (params.topThickness < 1.1) warnings.push('Top thickness dưới 1.1 mm có thể yếu.');
  if (params.textMode === 'Deboss' && params.textDepth > params.topThickness - 0.35) {
    warnings.push('Độ khắc chữ đang gần hoặc xuyên qua top thickness.');
  }

  const applySize = (name) => {
    setSize(name);
    patch({ width: sizes[name], depth: 18 });
  };

  const applyProfile = (name) => {
    setProfile(name);
    const preset = profiles[name];
    patch({
      height: preset.h,
      topWidth: preset.top,
      topDepth: preset.top,
      dish: preset.dish,
      tilt: preset.tilt,
    });
  };

  const setTextPosition = (name) => {
    const dx = params.topWidth * 0.28;
    const dy = params.topDepth * 0.27;
    const map = {
      Center: [0, 0],
      Top: [0, dy],
      Bottom: [0, -dy],
      Left: [-dx, 0],
      Right: [dx, 0],
      TL: [-dx, dy],
      TR: [dx, dy],
    };
    const [x, y] = map[name];
    patch({ textX: Number(x.toFixed(2)), textY: Number(y.toFixed(2)) });
  };

  const exportStl = () => {
    if (!modelRef.current) return;
    modelRef.current.updateMatrixWorld(true);
    const data = new STLExporter().parse(modelRef.current, { binary: true });
    const blob = new Blob([data], { type: 'model/stl' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `keycap_${size}_${profile}_${params.textMode}_${(params.text || 'blank').replace(/[^a-z0-9_-]/gi, '_')}.stl`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 2, size, profile, ...params }, null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'keycap-settings.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const importJson = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const data = JSON.parse(text);
        if (data.size) setSize(data.size);
        if (data.profile) setProfile(data.profile);
        const { version, size: ignoredSize, profile: ignoredProfile, ...rest } = data;
        void version;
        void ignoredSize;
        void ignoredProfile;
        patch(rest);
      } catch {
        alert('File JSON không hợp lệ.');
      }
    });
    event.target.value = '';
  };

  return (
    <div className="app">
      <header>
        <div>
          <h1>Keycap Generator</h1>
          <p>Keycap FDM — chữ nổi/khắc chìm được boolean trực tiếp vào STL</p>
        </div>
        <div className="actions">
          <label className="filebtn">
            Nhập JSON
            <input type="file" accept="application/json" onChange={importJson} />
          </label>
          <button onClick={exportJson}>Xuất JSON</button>
          <button className="primary" onClick={exportStl}>Xuất STL</button>
        </div>
      </header>

      <main>
        <aside>
          <section>
            <h3>Kích thước</h3>
            <div className="chips">
              {Object.keys(sizes).map((name) => (
                <button key={name} className={size === name ? 'active' : ''} onClick={() => applySize(name)}>
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Profile</h3>
            <div className="chips">
              {Object.keys(profiles).map((name) => (
                <button key={name} className={profile === name ? 'active' : ''} onClick={() => applyProfile(name)}>
                  {name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>Hiển thị</h3>
            <label className="toggle"><input type="checkbox" checked={params.wireframe} onChange={(e) => patch({ wireframe: e.target.checked })} />Wireframe</label>
            <label className="toggle"><input type="checkbox" checked={params.transparent} onChange={(e) => patch({ transparent: e.target.checked })} />Vỏ trong suốt</label>
          </section>

          <section>
            <h3>Phân tích</h3>
            <div className="stats">
              <span>X <b>{bounds.x.toFixed(2)} mm</b></span>
              <span>Y <b>{bounds.y.toFixed(2)} mm</b></span>
              <span>Z <b>{bounds.z.toFixed(2)} mm</b></span>
            </div>
            {warnings.map((warning) => <p className="warning" key={warning}>{warning}</p>)}
            {warnings.length === 0 ? <p className="ok">Thông số hiện tại hợp lý cho FDM.</p> : null}
          </section>
        </aside>

        <div className="viewer">
          <Canvas camera={{ position: [28, 22, 30], fov: 36 }}>
            <Scene geometry={geometry} params={params} modelRef={modelRef} />
          </Canvas>
          <div className="hint">Kéo để xoay • Lăn chuột để zoom • Grid = 1 mm</div>
        </div>

        <aside className="right">
          <section>
            <h3>Thân keycap</h3>
            <NumberField label="Rộng đáy" value={params.width} onChange={(value) => patch({ width: value })} />
            <NumberField label="Sâu đáy" value={params.depth} onChange={(value) => patch({ depth: value })} />
            <NumberField label="Rộng mặt" value={params.topWidth} onChange={(value) => patch({ topWidth: value })} />
            <NumberField label="Sâu mặt" value={params.topDepth} onChange={(value) => patch({ topDepth: value })} />
            <NumberField label="Chiều cao" value={params.height} onChange={(value) => patch({ height: value })} />
            <NumberField label="Wall" value={params.wall} onChange={(value) => patch({ wall: value })} />
            <NumberField label="Top thickness" value={params.topThickness} onChange={(value) => patch({ topThickness: value })} />
            <NumberField label="Bo góc" value={params.corner} onChange={(value) => patch({ corner: value })} />
            <NumberField label="Dish" value={params.dish} onChange={(value) => patch({ dish: value })} />
            <NumberField label="Tilt" value={params.tilt} onChange={(value) => patch({ tilt: value })} suffix="°" />
          </section>

          <section>
            <h3>Stem Cherry MX</h3>
            <label className="toggle"><input type="checkbox" checked={params.stemEnabled} onChange={(e) => patch({ stemEnabled: e.target.checked })} />Bật stem</label>
            <NumberField label="Clearance" value={params.clearance} onChange={(value) => patch({ clearance: value })} step={0.05} />
            <NumberField label="Chiều cao stem" value={params.stemHeight} onChange={(value) => patch({ stemHeight: value })} />
            <small>FDM nozzle 0.4: nên test clearance +0.05 đến +0.15 mm.</small>
          </section>

          <section>
            <h3>Chữ / Legend</h3>
            <label className="field">
              <span>Nội dung</span>
              <input className="textinput" value={params.text} maxLength={14} onChange={(e) => patch({ text: e.target.value })} placeholder="ESC, A, Enter..." />
            </label>
            <SelectField label="Kiểu" value={params.textMode} onChange={(value) => patch({ textMode: value })}>
              <option>Emboss</option><option>Deboss</option><option>Off</option>
            </SelectField>
            <SelectField label="Font" value={params.textFont} onChange={(value) => patch({ textFont: value })}>
              {Object.keys(fontUrls).map((name) => <option key={name}>{name}</option>)}
            </SelectField>
            <NumberField label="Cỡ chữ" value={params.textSize} onChange={(value) => patch({ textSize: value })} />
            <NumberField label="Độ nổi / khắc" value={params.textDepth} onChange={(value) => patch({ textDepth: value })} step={0.05} />
            <NumberField label="Bevel chữ" value={params.textBevel} onChange={(value) => patch({ textBevel: value })} step={0.01} />
            <NumberField label="Vị trí X" value={params.textX} onChange={(value) => patch({ textX: value })} />
            <NumberField label="Vị trí Y" value={params.textY} onChange={(value) => patch({ textY: value })} />
            <NumberField label="Xoay" value={params.textRotate} onChange={(value) => patch({ textRotate: value })} suffix="°" />
            <div className="chips position">
              {['Center', 'Top', 'Bottom', 'Left', 'Right', 'TL', 'TR'].map((name) => (
                <button key={name} onClick={() => setTextPosition(name)}>{name}</button>
              ))}
            </div>
            {fontError ? <p className="warning">{fontError}</p> : null}
            <p className="note"><b>Emboss</b> = chữ nổi liền mesh. <b>Deboss</b> = khắc chìm thật bằng CSG. STL xuất ra dùng đúng geometry đang preview.</p>
          </section>
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
