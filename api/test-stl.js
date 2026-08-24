import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { Brush, Evaluator, ADDITION } from 'three-bvh-csg';

function toBuffer(view){
  if(view instanceof ArrayBuffer) return Buffer.from(view);
  if(ArrayBuffer.isView(view)) return Buffer.from(view.buffer,view.byteOffset,view.byteLength);
  return Buffer.from(view);
}

export default function handler(req,res){
  try{
    const ev=new Evaluator();
    ev.attributes=['position','normal'];
    const a=new Brush(new THREE.BoxGeometry(10,3,2));
    const b=new Brush(new THREE.BoxGeometry(3,10,2));
    a.updateMatrixWorld(true); b.updateMatrixWorld(true);
    const out=ev.evaluate(a,b,ADDITION);
    out.geometry.computeVertexNormals();
    const stl=new STLExporter().parse(out,{binary:true});
    const bytes=toBuffer(stl).length;
    res.status(200).json({ok:bytes>84,backend:'Vercel Node.js Function',csg:true,stlBytes:bytes});
  }catch(e){
    res.status(500).json({ok:false,error:e?.message||String(e)});
  }
}
