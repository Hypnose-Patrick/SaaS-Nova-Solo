import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ["@supabase/supabase-js", "@supabase/ssr", "@supabase/auth-ui-react", "@supabase/auth-ui-shared"],
          charts: ["chart.js", "react-chartjs-2"],
          router: ["react-router-dom"],
        },
      },
    },
  },
});
