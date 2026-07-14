import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Hooks require the renderer and application to share one React singleton.
    // This also protects local development from stale or linked dependency trees.
    dedupe: ["react", "react-dom"],
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
