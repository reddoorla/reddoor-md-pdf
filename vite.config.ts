import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import kitConfig from "./sveltekit.config.js";

export default defineConfig({
  // SvelteKit 3 takes its configuration here (sveltekit.config.js).
  plugins: [tailwindcss(), sveltekit(kitConfig)],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
