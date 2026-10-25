import { getCalendars, getLocales } from 'expo-localization';

import { deviceCurrency, deviceTimeZone } from './locale';

jest.mock('expo-localization', () => ({ getCalendars: jest.fn(), getLocales: jest.fn() }));

const calendars = getCalendars as jest.Mock;
const locales = getLocales as jest.Mock;

describe('a new house starts from the phone', () => {
  it("takes the phone's time zone, or London when it won't say", () => {
    calendars.mockReturnValueOnce([{ timeZone: 'America/Toronto' }]);
    expect(deviceTimeZone()).toBe('America/Toronto');
    calendars.mockReturnValueOnce([{ timeZone: null }]);
    expect(deviceTimeZone()).toBe('Europe/London');
    calendars.mockReturnValueOnce([]);
    expect(deviceTimeZone()).toBe('Europe/London');
  });

  it("takes the region's currency, pounds anywhere else", () => {
    locales.mockReturnValueOnce([{ regionCode: 'CA' }]);
    expect(deviceCurrency()).toBe('CAD');
    locales.mockReturnValueOnce([{ regionCode: 'DE' }]);
    expect(deviceCurrency()).toBe('EUR');
    locales.mockReturnValueOnce([{ regionCode: null }]);
    expect(deviceCurrency()).toBe('GBP');
    locales.mockReturnValueOnce([]);
    expect(deviceCurrency()).toBe('GBP');
  });
});
