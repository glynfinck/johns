import { BIN_NIGHT } from '@app/core';

import app from '../app.json';
import { FONT, themeFor } from './theme';

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
