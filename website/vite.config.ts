import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Configure Vite for root-domain and project-page deployments. */
export default defineConfig({
  plugins: [react()],
  base: "./",
});
