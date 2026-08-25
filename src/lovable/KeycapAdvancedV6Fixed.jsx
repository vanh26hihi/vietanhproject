import * as opentype from "opentype.js";
import KeycapAdvancedV6 from "./KeycapAdvancedV6.jsx";

// opentype.js returns glyph paths in canvas-style Y-down coordinates.
// Keycap Studio uses a Z-up 3D workspace where +Y should point upward on the cap.
// Flip only OpenType path Y values so preview geometry and exported STL read correctly.
const proto = opentype.Font?.prototype;
if (proto && !proto.__keycapLegendYFixed) {
  const originalGetPath = proto.getPath;
  proto.getPath = function (...args) {
    const path = originalGetPath.apply(this, args);
    if (path?.commands) {
      path.commands = path.commands.map(cmd => {
        const next = { ...cmd };
        if (typeof next.y === "number") next.y = -next.y;
        if (typeof next.y1 === "number") next.y1 = -next.y1;
        if (typeof next.y2 === "number") next.y2 = -next.y2;
        return next;
      });
    }
    return path;
  };
  proto.__keycapLegendYFixed = true;
}

export default KeycapAdvancedV6;
