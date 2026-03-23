import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
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
