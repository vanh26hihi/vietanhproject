import React from "react";
import { createRoot } from "react-dom/client";
import StudioV2 from "./StudioV2";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StudioV2 />
  </React.StrictMode>,
);
