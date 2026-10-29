import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// vercel.json is how jonz.app serves the web build (the `jonz-web`
// project, Root Directory apps/client). JSON takes no comments, so the why
// lives here.

interface Rule {
  source: string;
  destination?: string;
  permanent?: boolean;
  headers?: { key: string; value: string }[];
}

const config = JSON.parse(readFileSync(join(__dirname, '../../vercel.json'), 'utf8')) as {
  framework: null;
  buildCommand: string;
  relatedProjects: string[];
  outputDirectory: string;
  redirects: Rule[];
  rewrites: Rule[];
  headers: Rule[];
};
const headersFor = (source: string) => config.headers.find((h) => h.source === source)?.headers ?? [];

describe("jonz.app's web build on Vercel", () => {
  it('builds the single-page export, with no framework guessed', () => {
    expect(config.framework).toBeNull();
    // scripts/build-web.mjs runs `npm run export:web`, first pointing a
    // preview at staging's API (or its own branch's: the related project).
    expect(config.buildCommand).toBe('node scripts/build-web.mjs');
    expect(config.relatedProjects).toEqual(['prj_7iAOREFWVIdf2Xi5TAoyO9a9ma7R']);
    expect(config.outputDirectory).toBe('dist');
  });

  it('keeps staging out of search engines', () => {
    expect(config.headers).toContainEqual({
      source: '/(.*)',
      has: [{ type: 'host', value: 'staging.jonz.app' }],
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    });
  });

  it("passes /api/* on to apps/api before anything else, so the clock's URL and the app's calls stay put", () => {
    expect(config.rewrites[0]).toEqual({
      source: '/api/:path*',
      destination: 'https://api.jonz.app/api/:path*',
    });
  });

  it('never caches what the API answers', () => {
    expect(headersFor('/api/:path*')).toContainEqual({ key: 'x-vercel-enable-rewrite-caching', value: '0' });
  });

  it("sends the old Wall, Stake and Table links on to their places under House, as the app's router does", () => {
    // On a phone and inside the app the router follows app.json's redirects.
    // A web page opened cold on one would get the router's own redirect
    // screen, which leaves a wrong address behind (/house/house/wall), so the
    // host sends it on before the app loads. Not permanent: a browser would
    // keep a permanent one for good.
    const app = JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8'));
    const router = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-router')[1];
    expect(config.redirects).toEqual(
      router.redirects.map((r: Rule) => ({ source: r.source, destination: r.destination, permanent: false })),
    );
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
