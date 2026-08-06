import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Deliberately separate from vitest.config.mts's `projects` array: eval
 * tests score a deterministic function against hand-labelled goldens with
 * precision/recall thresholds (see A6 in the implementation plan) rather
 * than asserting exact behavior. They are meant to run nightly, not on
 * every push — keeping them out of the `projects` list means a plain
 * `vitest run` (what `npm test` and CI's `test:unit` use) never picks them
 * up; only `npm run eval:extraction` does.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "eval",
    environment: "node",
    include: ["tests/eval/**/*.eval.test.ts"],
  },
});
