import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Every script in src/app becomes a route and ships in the app: Expo Router
// takes every .js/.ts(x) file there except +api and +html ones. A test left
// there is a screen anyone can open, with its test library in the bundle
// (Phase 3 shipped one). Screen tests live in src/__tests__/app instead.
const APP = join(__dirname, 'app');

function scripts(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? scripts(path) : /\.[jt]sx?$/.test(name) ? [path] : [];
  });
}

it('keeps tests out of src/app', () => {
  const tests = scripts(APP).filter((path) => /\.(test|spec)\.[jt]sx?$/.test(path) || path.includes('__tests__'));
  expect(tests.map((path) => relative(APP, path))).toEqual([]);
});

it('keeps src/app to screens and layouts, each with a default export', () => {
  const notScreens = scripts(APP).filter((path) => !/^export default /m.test(readFileSync(path, 'utf8')));
  expect(notScreens.map((path) => relative(APP, path))).toEqual([]);
});
