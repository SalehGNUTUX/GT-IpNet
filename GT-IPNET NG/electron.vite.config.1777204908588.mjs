// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
var __electron_vite_injected_dirname = "/mnt/81d4e25b-45b1-43fd-917c-57799e706dc7/\u0628\u0631\u0627\u0645\u062C \u0648 \u0623\u0646\u0638\u0645\u0629/MY SCREPT/GT-IPNET";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts")
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/"),
        "@": resolve("src/renderer/")
      }
    },
    plugins: [react(), tailwindcss()]
  }
});
export {
  electron_vite_config_default as default
};
