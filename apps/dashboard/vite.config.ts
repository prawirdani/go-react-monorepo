import { fileURLToPath, URL } from "node:url"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { analyzer } from "vite-bundle-analyzer"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    analyzer({
      analyzerMode: "static",
      openAnalyzer: true,
    }),
    devtools(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    viteReact(),
    // React Compiler runs first in the Babel pipeline. plugin-react v6 dropped
    // its `babel` option, so the compiler now arrives as a Rolldown Babel
    // preset instead — order matters: `viteReact()` then `babel()`.
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
