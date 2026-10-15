import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Application root was not found.");

createRoot(app).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
