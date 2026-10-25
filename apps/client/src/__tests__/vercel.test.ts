import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// vercel.json is how johns.glyn.dev serves the web build (the `johns-web`
// project, Root Directory apps/client). JSON takes no comments, so the why
// lives here.

interface Rule {
  source: string;
  destination?: string;
  headers?: { key: string; value: string }[];
}

const config = JSON.parse(readFileSync(join(__dirname, '../../vercel.json'), 'utf8')) as {
  framework: null;
  buildCommand: string;
  outputDirectory: string;
  rewrites: Rule[];
  headers: Rule[];
};
const headersFor = (source: string) => config.headers.find((h) => h.source === source)?.headers ?? [];

describe("johns.glyn.dev's web build on Vercel", () => {
  it('builds the single-page export, with no framework guessed', () => {
    expect(config.framework).toBeNull();
    expect(config.buildCommand).toBe('npm run export:web');
    expect(config.outputDirectory).toBe('dist');
  });

  it("passes /api/* on to apps/api before anything else, so the clock's URL and the app's calls stay put", () => {
    expect(config.rewrites[0]).toEqual({
      source: '/api/:path*',
      destination: 'https://api.johns.glyn.dev/api/:path*',
    });
  });

  it('never caches what the API answers', () => {
    expect(headersFor('/api/:path*')).toContainEqual({ key: 'x-vercel-enable-rewrite-caching', value: '0' });
  });

  it('opens any other path on the app, which draws its own not-found', () => {
    expect(config.rewrites.at(-1)).toEqual({ source: '/(.*)', destination: '/index.html' });
    expect(config.rewrites).toHaveLength(2);
  });

  it('sends the headers the Next app sends (apps/api/next.config.ts)', () => {
    expect(Object.fromEntries(headersFor('/(.*)').map((h) => [h.key, h.value]))).toEqual({
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Content-Security-Policy': "frame-ancestors 'none'",
    });
  });

  it('never serves the service worker stale, and keeps the hashed bundles for good', () => {
    expect(headersFor('/sw.js')).toEqual([{ key: 'Cache-Control', value: 'no-cache' }]);
    expect(headersFor('/_expo/static/(.*)')).toEqual([{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
  });
});
