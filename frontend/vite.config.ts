import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
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
          supabase: ["@supabase/supabase-js", "@supabase/auth-helpers-react"],
          charts: ["chart.js", "react-chartjs-2"],
          "date-fns": ["date-fns"],
          router: ["react-router-dom"],
        },
      },
    },
  },
});
