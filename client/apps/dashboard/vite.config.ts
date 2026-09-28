import { fileURLToPath, URL } from "node:url"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { analyzer } from "vite-bundle-analyzer"

const root = fileURLToPath(new URL(".", import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // `loadEnv` resolves the root from the process cwd, which differs between a
  // direct `pnpm dev` and a turbo-run task, so pass it explicitly. The empty
  // prefix reads every var in `.env`, not just the `VITE_`-exposed ones.
  const env = loadEnv(mode, root, "")
  const port = Number(env.VITE_PORT) || 3001
  const proxyTarget = env.VITE_PROXY_TARGET

  return {
    server: {
      port,
      allowedHosts: true,
      // No target means no proxy: `/api` then fails loudly in the browser
      // instead of being silently forwarded to a stale hardcoded host.
      ...(proxyTarget && {
        proxy: {
          "/api": {
            target: proxyTarget,
            changeOrigin: true,
          },
        },
      }),
    },
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
  }
})
