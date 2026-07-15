import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DiagramApp from "./app/DiagramApp";
import {TooltipProvider} from "@/app/components/ui/tooltip";
//@ts-ignore
import "./app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Unable to find the application root element.");
}



createRoot(root).render(
  <StrictMode>
    <TooltipProvider delay={400}>
      <DiagramApp />
    </TooltipProvider>
  </StrictMode>,
);
