import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Les paquets internes exposent dist/ (compilé) : on pointe les tests vers leurs sources
// TypeScript pour ne pas exiger un `npm run build` préalable de shared/ai-service.
export default defineConfig({
  resolve: {
    alias: {
      "@kalyaro/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      "@kalyaro/ai-service": fileURLToPath(new URL("../../packages/ai-service/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: { JWT_SECRET: "secret-de-test" },
  },
});
