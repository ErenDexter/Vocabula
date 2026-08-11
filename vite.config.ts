import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    // Pure logic only. The daily challenge has to be provably deterministic, so the
    // modules that decide it are covered; components are verified by playing them.
    include: ["src/lib/**/*.test.ts"],
    environment: "node",
  },
});
