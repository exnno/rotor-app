import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: `base` must match your GitHub repository name so that
// assets load correctly when hosted at username.github.io/<repo>/
// If you rename the repo, update this string (keep the leading and trailing slash).
export default defineConfig({
  plugins: [react()],
  base: "/west-bridgford-rota/",
});
