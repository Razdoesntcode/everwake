import { defineConfig } from "vite";

export default defineConfig({
  // Relative base keeps the build portable: it works at a project page
  // (https://user.github.io/everwake/), a custom domain, or a plain folder.
  base: "./",
  build: {
    target: "es2022",
    assetsDir: "assets",
  },
});
