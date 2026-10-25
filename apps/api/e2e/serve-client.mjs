// Serves the Expo app's web build for the e2e the way Vercel serves it in
// production: a file as it is, otherwise the first of apps/client/vercel.json's
// rewrites that matches, so /signin and /today open on a reload (`expo serve`
// 404s those) and /api/* goes on to apps/api. A rewrite to another origin
// (apps/api's production name) goes to the local API instead.
//
//   node e2e/serve-client.mjs <dist> <port> <api origin>
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer, request as forward } from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 8205);
const api = new URL(process.argv[4] ?? "http://localhost:3205");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

// Vercel's `:name*` is a named wildcard; `(.*)` is already a regex group.
const { rewrites } = JSON.parse(readFileSync(path.join(root, "..", "vercel.json"), "utf8"));
const rules = rewrites.map(({ source, destination }) => ({
  pattern: new RegExp(`^${source.replace(/:(\w+)\*/g, "(?<$1>.*)")}$`),
  destination,
}));

/** Where a path that is not a file goes: a file in the build, or a URL elsewhere. */
function rewrite(pathname) {
  for (const { pattern, destination } of rules) {
    const match = pattern.exec(pathname);
    if (match) return destination.replace(/:(\w+)\*?/g, (_, name) => match.groups?.[name] ?? "");
  }
  return null;
}

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function send(response, file) {
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let file = path.join(root, decodeURIComponent(url.pathname));
  // Nothing outside the build, however the path is spelled.
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (isFile(file)) return send(response, file);

  const to = rewrite(url.pathname);
  if (to === null) return response.writeHead(404).end();
  if (!/^https?:\/\//.test(to)) return send(response, path.join(root, to));

  // Another origin: passed on with its method, headers and body, as a proxy.
  const target = new URL(to);
  const upstream = forward(
    { host: api.hostname, port: api.port, method: request.method, path: target.pathname + url.search, headers: { ...request.headers, host: api.host } },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    },
  );
  upstream.on("error", () => response.writeHead(502).end());
  request.pipe(upstream);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}, /api from ${api.origin}`));
