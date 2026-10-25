import { SECTION_LABEL } from '@app/core';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text, useWindowDimensions } from 'react-native';

import { loadHouse } from '@/api/board';
import HouseLayout from '@/app/(house)/_layout';
import { snapshot } from '@/testing/house';
import { testQueryClient } from '@/testing/query';

// The real house layout (tabs, header, sidebar, the live channel) with
// stand-in screens.
jest.mock('@/api/board', () => ({ loadHouse: jest.fn() }));
jest.mock('@/api/house', () => ({ catchUp: jest.fn() }));
jest.mock('@/api/supabase', () => {
  const mockChannel = { on: jest.fn(), subscribe: jest.fn() };
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  return {
    supabase: {
      auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) },
      realtime: { setAuth: jest.fn() },
      channel: jest.fn(() => mockChannel),
      removeChannel: jest.fn(),
    },
  };
});
jest.mock('@/hooks/use-membership', () => ({
  useMembership: () => ({ session: { user: { id: 'priya' } }, house: { id: 'h1', name: 'Flat 3' } }),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 412, height: 915, scale: 1, fontScale: 1 })),
}));

async function open(url = '/today') {
  const client = testQueryClient();
  await renderRouter(
    {
      _layout: () => (
        <QueryClientProvider client={client}>
          <Slot />
        </QueryClientProvider>
      ),
      '(house)/_layout': HouseLayout,
      '(house)/today': () => <Text>Today screen</Text>,
      '(house)/week': () => <Text>Week screen</Text>,
      '(house)/wall': () => <Text>Wall screen</Text>,
    },
    { initialUrl: url },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadHouse as jest.Mock).mockResolvedValue(
    snapshot({ members: snapshot().members.map((m) => (m.userId === 'priya' ? { ...m, immunityTokens: 1 } : m)) }),
  );
});

describe('on a phone', () => {
  it('has a tab for each screen, and moves between them', async () => {
    await open();
    expect(screen.getByText('Today screen')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: SECTION_LABEL.today })).toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: SECTION_LABEL.week }));
    expect(screen).toHavePathname('/week');
    expect(screen.getByText('Week screen')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: SECTION_LABEL.week })).toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: SECTION_LABEL.wall }));
    expect(screen).toHavePathname('/wall');
    expect(screen.getByText('Wall screen')).toBeOnTheScreen();
  });

  it('says which house this is above every screen', async () => {
    await open();
    expect(screen.getByText('Flat 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Johns')).toBeOnTheScreen();
  });
});

describe('on a laptop', () => {
  beforeEach(() => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
  });

  it('has a sidebar with the house above the signs and you below', async () => {
    await open('/week');
    expect(await screen.findByText('2 housemates')).toBeOnTheScreen();
    expect(screen.getByText('Flat 3')).toBeOnTheScreen();
    expect(screen.getByText('Priya')).toBeOnTheScreen();
    expect(screen.getByText('3-week streak · 1 token')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: SECTION_LABEL.week })).toBeSelected();
  });
});
