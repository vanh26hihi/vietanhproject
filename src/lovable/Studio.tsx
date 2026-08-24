import React, { Suspense, lazy, useEffect, useState } from "react";
import { Box, Grid3X3, Wrench } from "lucide-react";

const Keycap = lazy(() => import("./App"));
const Tray = lazy(() => import("./Tray"));
const Editor = lazy(() => import("./Editor"));
type Tool = "keycap" | "tray" | "editor";

class Boundary extends React.Component<{children:React.ReactNode;name:string},{error:Error|null}>{
  state={error:null as Error|null};
  static getDerivedStateFromError(error:Error){return{error};}
  componentDidUpdate(prev:{children:React.ReactNode;name:string}){if(prev.name!==this.props.name&&this.state.error)this.setState({error:null});}
  render(){if(this.state.error)return <div className="grid h-full place-items-center bg-background p-6"><div className="max-w-lg rounded-xl border bg-card p-6 text-center"><h2 className="text-base font-semibold">Module {this.props.name} gặp lỗi</h2><p className="mt-2 text-xs text-muted-foreground">Trang Keycap chính vẫn an toàn. Chuyển sang module khác hoặc tải lại trang.</p><pre className="mt-3 overflow-auto rounded bg-muted p-2 text-left text-[10px]">{this.state.error.message}</pre></div></div>;return this.props.children;}
}
function fromHash():Tool{const h=location.hash.replace("#","");return h==="tray"||h==="editor"?h:"keycap";}
export default function Studio(){const[tool,setTool]=useState<Tool>(()=>fromHash());useEffect(()=>{const f=()=>setTool(fromHash());addEventListener("hashchange",f);return()=>removeEventListener("hashchange",f);},[]);const go=(t:Tool)=>{location.hash=t;setTool(t);};return <div className="relative h-screen overflow-hidden bg-background"><nav className="absolute left-1/2 top-2 z-[100] flex -translate-x-1/2 gap-1 rounded-xl border bg-card/95 p-1 shadow-lg backdrop-blur"><button onClick={()=>go("keycap")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium ${tool==="keycap"?"bg-primary text-primary-foreground":"hover:bg-muted"}`}><Box className="size-3.5"/>Tạo keycap</button><button onClick={()=>go("tray")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium ${tool==="tray"?"bg-primary text-primary-foreground":"hover:bg-muted"}`}><Grid3X3 className="size-3.5"/>Tạo khay</button><button onClick={()=>go("editor")} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium ${tool==="editor"?"bg-primary text-primary-foreground":"hover:bg-muted"}`}><Wrench className="size-3.5"/>Sửa / tách 3D</button></nav><div className="h-full pt-0"><Boundary name={tool}><Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Đang tải module 3D…</div>}>{tool==="keycap"?<Keycap/>:tool==="tray"?<Tray/>:<Editor/>}</Suspense></Boundary></div></div>}
