// Lets a plain Node script use @app/core's TypeScript (Node 22 strips the
// types). Core imports its files without an extension, as its bundlers
// allow; Node asks for one, so this tries ".ts" when a relative import has none.
import { register } from "node:module";

let registered = false;

/** Imports packages/core/src/<file>, e.g. loadCore("auth-email.ts"). */
export async function loadCore(file) {
  if (!registered) {
    register(
      "data:text/javascript," +
        encodeURIComponent(`export async function resolve(spec, ctx, next) {
          if (spec.startsWith(".") && !/\\.[a-z]+$/.test(spec)) {
            try { return await next(spec + ".ts", ctx); } catch {}
          }
          return next(spec, ctx);
        }`),
    );
    registered = true;
  }
  return import(new URL(`../../packages/core/src/${file}`, import.meta.url).href);
}
