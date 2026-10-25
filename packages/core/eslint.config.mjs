import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...tseslint.configs.recommended,
  // Written by `npm run types`, never by hand.
  globalIgnores(["src/db-types.ts"]),
]);
