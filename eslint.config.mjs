import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// The root lints only the repo's own scripts' tests; every workspace lints
// itself with its own config.
export default defineConfig([...tseslint.configs.recommended]);
