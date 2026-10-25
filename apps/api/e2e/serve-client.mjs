// Serves the Expo app's web build for the e2e the way a host would serve a
// single-page app: files as they are, and index.html for every other path,
// so /signin and /today open on a reload. (`expo serve` 404s those.)
//
//   node e2e/serve-client.mjs <dist> <port>
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 8205);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
};

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  let file = path.join(root, decodeURIComponent(pathname));
  // Nothing outside the build, however the path is spelled.
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (!isFile(file)) file = path.join(root, "index.html");
  response.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
