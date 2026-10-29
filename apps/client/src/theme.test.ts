import { BIN_NIGHT } from '@app/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import app from '../app.json';
import { CONTENT_MAX, FONT, FONT_FILES, GUTTER, INSET, LEADING, ROW_GAP, ROW_MIN, TAP, themeFor } from './theme';

// Jest turns every font file into the same stand-in, so name the app's own.
jest.mock('../assets/fonts/Overpass_400Regular.ttf', () => 'app 400');
jest.mock('../assets/fonts/Overpass_700Bold.ttf', () => 'app 700');
jest.mock('../assets/fonts/Overpass_800ExtraBold.ttf', () => 'app 800');
jest.mock('../assets/fonts/Overpass_900Black.ttf', () => 'app 900');

describe('theme', () => {
  it('follows the system into the dark, and treats anything else as daylight', () => {
    expect(themeFor('dark').colors).toBe(BIN_NIGHT.dark);
    expect(themeFor('light').colors).toBe(BIN_NIGHT.light);
    expect(themeFor(null).scheme).toBe('light');
    expect(themeFor('unspecified').scheme).toBe('light');
  });

  it('sets headings in uppercase Overpass', () => {
    const h1 = themeFor('light').type.heading(1);
    expect(h1.textTransform).toBe('uppercase');
    expect(h1.fontFamily).toBe(FONT.black);
    expect(themeFor('dark').type.heading(2).color).toBe(BIN_NIGHT.dark.foreground);
  });
});

describe("Focus's type", () => {
  const { type } = themeFor('light');
  const dark = themeFor('dark').type;

  it('has six roles, each its own size, from the caps title down to the meta line', () => {
    const roles = [type.title, type.lead, type.sectionLabel, type.rowTitle, type.body, type.meta];
    expect(roles.map((r) => [r.fontSize, r.lineHeight])).toEqual([
      [28, 32],
      [22, 28],
      [12, 16],
      [17, 22],
      [16, 24],
      [14, 20],
    ]);
    // Numbers line up in columns everywhere.
    for (const role of roles) expect(role.fontVariant).toEqual(['tabular-nums']);
  });

  it('sets the title and the section labels in caps, the labels quiet', () => {
    expect(type.title).toMatchObject({ fontFamily: FONT.black, textTransform: 'uppercase' });
    expect(type.sectionLabel).toMatchObject({ fontFamily: FONT.extrabold, textTransform: 'uppercase' });
    expect(type.sectionLabel.color).toBe(BIN_NIGHT.light.mutedForeground);
    expect(type.meta.color).toBe(BIN_NIGHT.light.mutedForeground);
    expect(type.rowTitle.textTransform).toBeUndefined();
  });

  it('sets the street plate in Black caps, smaller than the title it sits under', () => {
    expect(type.plate).toMatchObject({ fontFamily: FONT.black, textTransform: 'uppercase', fontVariant: ['tabular-nums'] });
    expect(type.plate.fontSize).toBeLessThan(type.title.fontSize ?? 0);
    expect(type.plate.fontSize).toBeGreaterThan(type.lead.fontSize ?? 0);
    expect(dark.plate.color).toBe(BIN_NIGHT.dark.foreground);
  });

  it('follows the scheme into the dark', () => {
    expect(dark.title.color).toBe(BIN_NIGHT.dark.foreground);
    expect(dark.meta.color).toBe(BIN_NIGHT.dark.mutedForeground);
  });

  it("keeps a tab's label and the initials colourless, for the tab or the plate to ink", () => {
    expect(type.tabLabel.color).toBeUndefined();
    expect(type.initials).toMatchObject({ fontSize: 12, lineHeight: 16, fontFamily: FONT.extrabold, textTransform: 'uppercase' });
    expect(type.initials.color).toBeUndefined();
  });
});

describe('Overpass', () => {
  const FILES = ['Overpass_400Regular', 'Overpass_700Bold', 'Overpass_800ExtraBold', 'Overpass_900Black'];

  it("loads the app's own copies of the four weights Focus sets, under the same families, and no others", () => {
    expect(Object.keys(FONT_FILES)).toHaveLength(4);
    expect(FONT_FILES).toMatchObject({
      [FONT.regular]: 'app 400',
      [FONT.bold]: 'app 700',
      [FONT.extrabold]: 'app 800',
      [FONT.black]: 'app 900',
    });
  });

  it('gives the middle dot a width of its own in each, so " · " keeps the space after it', () => {
    for (const file of FILES) {
      const font = readFileSync(join(__dirname, '../assets/fonts', `${file}.ttf`));
      // GDEF's glyph classes: 1 a base, which keeps its advance; 3 a mark, which a shaper draws with none.
      expect([file, glyphClass(font, 0xb7)]).toEqual([file, 1]);
      expect([file, glyphClass(font, 0x61)]).toEqual([file, 1]);
    }
  });
});

/** A character's glyph class in a TrueType font's GDEF table (0 when it has none). */
function glyphClass(font: Buffer, char: number): number {
  const tables = new Map<string, number>();
  for (let i = 0; i < font.readUInt16BE(4); i++) {
    const record = 12 + i * 16;
    tables.set(font.toString('latin1', record, record + 4), font.readUInt32BE(record + 8));
  }
  const glyph = glyphOf(font, tables.get('cmap')!, char);
  const gdef = tables.get('GDEF')!;
  const classes = gdef + font.readUInt16BE(gdef + 4);
  if (font.readUInt16BE(classes) === 1) {
    const start = font.readUInt16BE(classes + 2);
    const count = font.readUInt16BE(classes + 4);
    return glyph >= start && glyph < start + count ? font.readUInt16BE(classes + 6 + (glyph - start) * 2) : 0;
  }
  for (let i = 0; i < font.readUInt16BE(classes + 2); i++) {
    const range = classes + 4 + i * 6;
    if (glyph >= font.readUInt16BE(range) && glyph <= font.readUInt16BE(range + 2)) return font.readUInt16BE(range + 4);
  }
  return 0;
}

/** A character's glyph, from the font's Unicode map (format 4, as Overpass's is). */
function glyphOf(font: Buffer, cmap: number, char: number): number {
  for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
    const record = cmap + 4 + i * 8;
    const table = cmap + font.readUInt32BE(record + 4);
    if (font.readUInt16BE(record) !== 3 || font.readUInt16BE(record + 2) !== 1 || font.readUInt16BE(table) !== 4) continue;
    const segments = font.readUInt16BE(table + 6) / 2;
    const ends = table + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const offsets = deltas + segments * 2;
    for (let s = 0; s < segments; s++) {
      if (font.readUInt16BE(ends + s * 2) < char) continue;
      const start = font.readUInt16BE(starts + s * 2);
      if (start > char) return 0;
      const delta = font.readInt16BE(deltas + s * 2);
      const offset = font.readUInt16BE(offsets + s * 2);
      if (offset === 0) return (char + delta) & 0xffff;
      const glyph = font.readUInt16BE(offsets + s * 2 + offset + (char - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
  }
  throw new Error('no Unicode map');
}

describe('the layout constants', () => {
  it('make a row a thumb tall at least, its words on one keyline', () => {
    expect(ROW_MIN).toBeGreaterThanOrEqual(TAP);
    // Where a row's words start when it has a leading slot.
    expect(INSET + LEADING + ROW_GAP).toBe(60);
    expect(GUTTER).toBe(16);
    expect(CONTENT_MAX).toBe(680);
  });
});

describe('app.json', () => {
  // JSON can't import the tokens, so this keeps its few colours honest.
  const splash = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [
    string,
    { backgroundColor: string; dark: { backgroundColor: string } },
  ];

  it('opens on the Bin Night ground in both themes', () => {
    expect(splash[1].backgroundColor).toBe(BIN_NIGHT.light.background);
    expect(splash[1].dark.backgroundColor).toBe(BIN_NIGHT.dark.background);
  });

  it('puts the Android icon on hi-vis amber', () => {
    expect(app.expo.android.adaptiveIcon.backgroundColor).toBe(BIN_NIGHT.light.hivis);
  });

  it('carries the identifiers the plan settled', () => {
    expect(app.expo.scheme).toBe('jonz');
    expect(app.expo.ios.bundleIdentifier).toBe('dev.glyn.jonz');
    expect(app.expo.android.package).toBe('dev.glyn.jonz');
    expect(app.expo.web.output).toBe('single');
  });
});
