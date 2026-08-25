import fs from "node:fs";

const v6Path = "src/lovable/KeycapAdvancedV6.jsx";
const geometryPath = "src/lovable/geometry.ts";

function mustReplace(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(from, to);
}

let v6 = fs.readFileSync(v6Path, "utf8");
v6 = mustReplace(
  v6,
  'size: 5, depth: .55',
  'size: 9, depth: .8',
  "default legend size/depth"
);
v6 = v6.replaceAll('stemHeight: 4.7', 'stemHeight: 5.2');
fs.writeFileSync(v6Path, v6, "utf8");

let geometry = fs.readFileSync(geometryPath, "utf8");
geometry = mustReplace(
  geometry,
  '  const shell=toGeometry(tris),stemGeos:THREE.BufferGeometry[]=[];',
  `  let shell=toGeometry(tris);\n  // Reinforced underside inspired by molded keycaps: central stem housing + 8 radial ribs.\n  // These supports are part of the body shell so the existing stem/stabilizer object split stays intact.\n  if(p.stemEnabled){\n    const supportGeos:THREE.BufferGeometry[]=[];\n    const zTop=innerCenterZ;\n    const housingH=Math.min(3.0,Math.max(2.2,p.stemHeight*.55));\n    const maxHousingR=Math.max(p.stemDiameter/2+.35,Math.min(p.topWidth,p.topDepth)/2-wall-1.0);\n    const outerR=Math.min(p.stemDiameter/2+1.15,maxHousingR);\n    const innerR=Math.max(.6,p.stemDiameter/2-.18);\n    if(outerR>innerR+.25){\n      const ringShape=new THREE.Shape();\n      ringShape.absarc(0,0,outerR,0,Math.PI*2,false);\n      const ringHole=new THREE.Path();\n      ringHole.absarc(0,0,innerR,0,Math.PI*2,true);\n      ringShape.holes.push(ringHole);\n      const housing=new THREE.ExtrudeGeometry(ringShape,{depth:housingH,bevelEnabled:true,bevelSize:.12,bevelThickness:.10,bevelSegments:2,curveSegments:32}).toNonIndexed();\n      housing.translate(0,0,zTop-housingH);\n      supportGeos.push(housing);\n\n      const cavityHalf=Math.max(outerR+.8,Math.min(p.topWidth,p.topDepth)/2-wall-.7);\n      const ribLen=Math.max(.8,cavityHalf-outerR+.25);\n      const ribW=Math.min(1.0,Math.max(.8,raw.nozzle*2));\n      const ribH=Math.min(2.4,housingH*.82);\n      const ribCenter=(outerR-.15)+ribLen/2;\n      for(let ri=0;ri<8;ri++){\n        const angle=ri*Math.PI/4;\n        const rib=new THREE.BoxGeometry(ribLen,ribW,ribH).toNonIndexed();\n        rib.rotateZ(angle);\n        rib.translate(Math.cos(angle)*ribCenter,Math.sin(angle)*ribCenter,zTop-ribH/2);\n        supportGeos.push(rib);\n      }\n    }\n    if(supportGeos.length) shell=mergeGeometries([shell,...supportGeos]);\n  }\n  const stemGeos:THREE.BufferGeometry[]=[];`,
  "reinforced underside"
);
fs.writeFileSync(geometryPath, geometry, "utf8");

console.log("applied V6 defaults: font 9, legend 0.8mm, stem 5.2mm, reinforced underside");
