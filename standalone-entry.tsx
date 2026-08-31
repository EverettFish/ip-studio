import React from "react";
import { createRoot } from "react-dom/client";
import { StudioShell } from "@/components/StudioShell";
import "@/app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <React.StrictMode>
    <StudioShell />
  </React.StrictMode>,
);
