import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Hooks require the renderer and application to share one React singleton.
    // This also protects local development from stale or linked dependency trees.
    dedupe: ["react", "react-dom"],
  },
});
