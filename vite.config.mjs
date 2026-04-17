import { defineConfig } from "vite";
import fs from "node:fs";
import path from "path";

export default defineConfig({
  base: "./",

  plugins: [
    {
      name: "copy-runtime-static-files",
      closeBundle() {
        const rootDir = process.cwd();
        const distDir = path.resolve(rootDir, "dist");
        const runtimeEntries = [
          "asset",
          "components",
          "css",
          "js",
          "vendor",
          "_headers",
        ];

        for (const entry of runtimeEntries) {
          const sourcePath = path.resolve(rootDir, entry);
          if (!fs.existsSync(sourcePath)) {
            continue;
          }

          const targetPath = path.resolve(distDir, entry);
          const sourceStat = fs.statSync(sourcePath);
          if (sourceStat.isDirectory()) {
            fs.cpSync(sourcePath, targetPath, {
              recursive: true,
              force: false,
              errorOnExist: false,
            });
          } else {
            fs.cpSync(sourcePath, targetPath, {
              force: false,
              errorOnExist: false,
            });
          }
        }
      },
    },
  ],
  // Multi-page app support
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), "index.html"),
        planner: path.resolve(process.cwd(), "planner.html"),
        profile: path.resolve(process.cwd(), "profile.html"),
        admin: path.resolve(process.cwd(), "admin.html"),
      },
    },
  },
});
