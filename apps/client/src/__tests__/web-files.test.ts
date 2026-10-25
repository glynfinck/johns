import { APP_NAME, BIN_NIGHT, TAGLINE } from '@app/core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// public/ is served as it is, so it can't import the tokens: these keep its
// colours and words equal to core's, and its links pointing at real files.

const PUBLIC = join(__dirname, '../../public');
const read = (file: string) => readFileSync(join(PUBLIC, file), 'utf8');

describe('the page template', () => {
  const html = read('index.html');

  it("wears each look's ground in the browser's chrome", () => {
    expect(html).toContain(`media="(prefers-color-scheme: light)" content="${BIN_NIGHT.light.background}"`);
    expect(html).toContain(`media="(prefers-color-scheme: dark)" content="${BIN_NIGHT.dark.background}"`);
  });

  it("says the app's name and what it is", () => {
    expect(html).toContain(`<meta name="description" content="${TAGLINE}" />`);
    expect(html).toContain(`<meta name="apple-mobile-web-app-title" content="${APP_NAME}" />`);
    expect(html).toContain('<title>%WEB_TITLE%</title>');
  });

  it('is installable, and fits under a notch', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('viewport-fit=cover');
    expect(existsSync(join(PUBLIC, 'icon-192.png'))).toBe(true);
  });
});

describe('the manifest', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));

  it('opens on Today, standing alone, in the daylight ground', () => {
    expect(manifest).toMatchObject({
      name: APP_NAME,
      short_name: APP_NAME,
      description: TAGLINE,
      start_url: '/today',
      display: 'standalone',
      background_color: BIN_NIGHT.light.background,
      theme_color: BIN_NIGHT.light.background,
    });
  });

  it('points at icons that are there, a maskable one among them', () => {
    for (const icon of manifest.icons) expect(existsSync(join(PUBLIC, icon.src))).toBe(true);
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  });
});

describe('the service worker', () => {
  const worker = read('sw.js');

  it('shows a reminder, and opens its page when tapped', () => {
    expect(worker).toContain('showNotification');
    expect(worker).toContain('notificationclick');
    expect(worker).toContain('icon: "/icon-192.png"');
  });

  it('caches nothing: a stale list of Johns is worse than a spinner', () => {
    expect(worker).not.toMatch(/caches\.|addEventListener\("fetch"/);
  });
});
