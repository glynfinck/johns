import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// No emoji anywhere in the UI: lucide icons only, reactions included. A stray
// one fails here rather than in code review.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx|json)$/.test(name) ? [path] : [];
  });
}

it('has no emoji in the app', () => {
  const offenders = [...sources(__dirname), join(__dirname, '..', 'app.json')].filter((path) =>
    /\p{Extended_Pictographic}/u.test(readFileSync(path, 'utf8')),
  );
  expect(offenders).toEqual([]);
});
