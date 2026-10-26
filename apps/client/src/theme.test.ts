import { BIN_NIGHT } from '@app/core';

import app from '../app.json';
import { CONTENT_MAX, FONT, GUTTER, INSET, LEADING, ROW_GAP, ROW_MIN, TAP, themeFor } from './theme';

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
    expect(app.expo.scheme).toBe('johns');
    expect(app.expo.ios.bundleIdentifier).toBe('dev.glyn.johns');
    expect(app.expo.android.package).toBe('dev.glyn.johns');
    expect(app.expo.web.output).toBe('single');
  });
});
