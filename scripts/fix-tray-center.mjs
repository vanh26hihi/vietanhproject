import fs from 'node:fs';
const file='src/lovable/TrayV2.tsx';
let s=fs.readFileSync(file,'utf8');
s=s.replace('const fy=-i.id*.22;','const fy=0;');
s=s.replace('const i=info(t),fy=y-i.id*.22,z=t.base;','const i=info(t),fy=y,z=t.base;');
fs.writeFileSync(file,s);
console.log('TrayV2: centered MX round hole at cell origin');
