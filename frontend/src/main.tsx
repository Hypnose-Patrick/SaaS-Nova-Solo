import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tokens.css";
import "@/styles/global.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Élément #root introuvable dans index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
