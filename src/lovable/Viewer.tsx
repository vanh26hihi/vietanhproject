import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, PerspectiveCamera, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import type { KeycapBuild } from "./geometry";

export type ViewName = "iso" | "top" | "front" | "side" | "bottom";
export interface ViewOptions { view:ViewName; ortho:boolean; wireframe:boolean; transparent:boolean; grid:boolean; axes:boolean; section:boolean; sectionAxis:"x"|"y"; }
const VIEW_POS:Record<ViewName,[number,number,number]>={iso:[26,-30,24],top:[0,0,46],front:[0,-46,4],side:[46,0,4],bottom:[0,0,-46]};

function Model({build,opts}:{build:KeycapBuild;opts:ViewOptions}){
  const clipping=useMemo(()=>{if(!opts.section)return[];const n=opts.sectionAxis==="x"?new THREE.Vector3(-1,0,0):new THREE.Vector3(0,-1,0);return[new THREE.Plane(n,0)];},[opts.section,opts.sectionAxis]);
  const mat=useMemo(()=>new THREE.MeshStandardMaterial({color:new THREE.Color("#3f4c63"),metalness:.15,roughness:.45,side:THREE.DoubleSide,transparent:opts.transparent,opacity:opts.transparent?.38:1,wireframe:opts.wireframe,clippingPlanes:clipping,clipShadows:true}),[opts.transparent,opts.wireframe,clipping]);
  const stemMat=useMemo(()=>new THREE.MeshStandardMaterial({color:new THREE.Color("#1d7fd4"),metalness:.1,roughness:.4,side:THREE.DoubleSide,wireframe:opts.wireframe,clippingPlanes:clipping}),[opts.wireframe,clipping]);
  useEffect(()=>()=>{mat.dispose();stemMat.dispose();},[mat,stemMat]);
  return <group><mesh geometry={build.shell} material={mat} castShadow/>{build.stems&&<mesh geometry={build.stems} material={stemMat}/>}</group>;
}

export function Viewer({build,opts}:{build:KeycapBuild;opts:ViewOptions}){
  const size=Math.max(build.analysis.bbox.x,build.analysis.bbox.y,build.analysis.bbox.z),k=Math.max(1,size/20),base=VIEW_POS[opts.view],pos:[number,number,number]=[base[0]*k,base[1]*k,base[2]*k],zoom=14/k;
  return <Canvas key={opts.ortho?"ortho":"persp"} shadows gl={{antialias:true,localClippingEnabled:true}} style={{background:"transparent"}}>
    {opts.ortho?<OrthographicCamera makeDefault position={pos} zoom={zoom} up={[0,0,1]} near={-500} far={500}/>:<PerspectiveCamera makeDefault position={pos} fov={35} up={[0,0,1]} near={.1} far={800}/>} 
    <OrbitControls makeDefault target={[0,0,5]} enableDamping dampingFactor={.12}/><ambientLight intensity={.75}/><directionalLight position={[20,-25,40]} intensity={1.5} castShadow/><directionalLight position={[-25,20,15]} intensity={.5}/><Model build={build} opts={opts}/>
    {opts.grid&&<Grid args={[200,200]} rotation={[Math.PI/2,0,0]} cellSize={1} sectionSize={10} cellColor="#c9d3e0" sectionColor="#8ea6c4" infiniteGrid fadeDistance={120}/>} {opts.axes&&<axesHelper args={[15]}/>} 
  </Canvas>;
}
