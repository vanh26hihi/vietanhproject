import fs from 'node:fs';

const file = 'src/lovable/KeycapAdvancedV4.tsx';
let s = fs.readFileSync(file, 'utf8');
if (s.includes('/* ROUND_FONT_PACK_V1 */')) {
  console.log('rounded font pack already applied');
  process.exit(0);
}

const importAnchor = 'import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";';
const imports = `${importAnchor}\n/* ROUND_FONT_PACK_V1 */\nimport fredoka700 from "@compai/font-fredoka/data/typefaces/normal-700.json";\nimport fredoka600 from "@compai/font-fredoka/data/typefaces/normal-600.json";\nimport baloo800 from "@compai/font-baloo-2/data/typefaces/normal-800.json";\nimport bree400 from "@compai/font-bree-serif/data/typefaces/normal-400.json";\nimport bubble400 from "@compai/font-bubblegum-sans/data/typefaces/normal-400.json";`;
if (!s.includes(importAnchor)) throw new Error('font import anchor not found');
s = s.replace(importAnchor, imports);

s = s.replace(
  'type FontDef={id:string;name:string;category:Exclude<FontCategory,"all">;url:string;preview:string;fdm:boolean};',
  'type FontDef={id:string;name:string;category:Exclude<FontCategory,"all">;url?:string;data?:unknown;preview:string;fdm:boolean};'
);

const fontAnchor = 'const FONTS:FontDef[]=[';
const customFonts = `${fontAnchor}\n {id:"fredoka-bold",name:"Fredoka Bold",category:"display",data:fredoka700,preview:"Fredoka,Arial Rounded MT Bold,sans-serif",fdm:true},\n {id:"fredoka-semibold",name:"Fredoka SemiBold",category:"display",data:fredoka600,preview:"Fredoka,Arial Rounded MT Bold,sans-serif",fdm:true},\n {id:"baloo2-extrabold",name:"Baloo 2 ExtraBold",category:"display",data:baloo800,preview:"Arial Rounded MT Bold,sans-serif",fdm:true},\n {id:"bree-serif",name:"Bree Serif",category:"serif",data:bree400,preview:"Georgia,serif",fdm:true},\n {id:"bubblegum-sans",name:"Bubblegum Sans",category:"display",data:bubble400,preview:"Arial Rounded MT Bold,sans-serif",fdm:true},`;
if (!s.includes(fontAnchor)) throw new Error('FONTS anchor not found');
s = s.replace(fontAnchor, customFonts);

const oldLoader = 'async function loadFont(id:string){if(fontCache.has(id))return fontCache.get(id)!;const def=FONT_MAP[id]||FONTS[0];const json=await fetch(def.url).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()});const font=new FontLoader().parse(json);fontCache.set(id,font);return font;}';
const newLoader = 'async function loadFont(id:string){if(fontCache.has(id))return fontCache.get(id)!;const def=FONT_MAP[id]||FONTS[0];const json=def.data ?? await fetch(def.url!).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()});const font=new FontLoader().parse(json as any);fontCache.set(id,font);return font;}';
if (!s.includes(oldLoader)) throw new Error('loadFont anchor not found');
s = s.replace(oldLoader, newLoader);

s = s.replace('fontId:"gentilis-bold",size:4.4', 'fontId:"fredoka-bold",size:5.0');
s = s.replace('fontId:"gentilis-bold",size:4.4,depth:.55', 'fontId:"fredoka-bold",size:5.0,depth:.55');
s = s.replace('fontId:"gentilis-bold",size:4.4,depth:.55,bevel:true', 'fontId:"fredoka-bold",size:5.0,depth:.55,bevel:true');

// Make the Pastel Clicker preset use the rounded toy font and slightly fuller bevel.
s = s.replace(
  '{...l,fontId:"gentilis-bold",size:4.4,depth:.55,bevel:true,bevelSize:.06,bevelThickness:.05,fit:"box"}',
  '{...l,fontId:"fredoka-bold",size:5.0,depth:.55,bevel:true,bevelSize:.08,bevelThickness:.06,fit:"box"}'
);

fs.writeFileSync(file, s);
console.log('applied rounded font pack');
