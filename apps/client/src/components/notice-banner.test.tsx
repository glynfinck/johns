import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { WifiOffIcon } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Text } from 'react-native';

import { authStorage } from '@/api/storage';
import { testQueryClient } from '@/testing/query';

import { NoticeBand, NoticeView } from './notice-banner';

const fetchMock = jest.fn();
const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const on = (over: Record<string, unknown>) => ({
  id: 'n1',
  kind: 'offer',
  title: 'Founding pass ends 30 Nov.',
  body: 'Lock in $49 for life.',
  linkLabel: null,
  linkUrl: null,
  startsAt: '2020-01-01T00:00:00Z',
  endsAt: null,
  ...over,
});

beforeAll(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3205';
});

beforeEach(() => {
  jest.clearAllMocks();
  authStorage!.clear();
});

function App({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={testQueryClient()}>{children}</QueryClientProvider>;
}

describe('the notice band', () => {
  it('shows the most urgent notice above the screen', async () => {
    fetchMock.mockResolvedValue(
      reply({ notices: [on({}), on({ id: 's', kind: 'status', title: 'Jonz is slow right now.', body: '' })] }),
    );
    await render(
      <NoticeBand>
        <Text>Today</Text>
      </NoticeBand>,
      { wrapper: App },
    );
    expect(await screen.findByTestId('notice-status')).toBeTruthy();
    expect(screen.getByText('Jonz is slow right now.')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3205/api/notices');
  });

  it('closes a notice on this device, and remembers it', async () => {
    fetchMock.mockResolvedValue(reply({ notices: [on({})] }));
    await render(
      <NoticeBand>
        <Text>Today</Text>
      </NoticeBand>,
      { wrapper: App },
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Close notice' }));
    expect(screen.queryByTestId('notice-offer')).toBeNull();
    expect(JSON.parse(authStorage!.getItem('jonz.closed-notices')!)).toHaveProperty('n1');
  });

  it('leaves the screen under it alone when it comes up (a half-typed sheet stays open)', async () => {
    fetchMock.mockResolvedValue(reply({ notices: [on({})] }));
    const mounted = jest.fn();
    function Screen() {
      useEffect(() => mounted(), []);
      return <Text>Today</Text>;
    }
    await render(
      <NoticeBand>
        <Screen />
      </NoticeBand>,
      { wrapper: App },
    );
    expect(await screen.findByTestId('notice-offer')).toBeTruthy();
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when there is nothing to say', async () => {
    fetchMock.mockResolvedValue(reply({ notices: [] }));
    await render(
      <NoticeBand>
        <Text>Today</Text>
      </NoticeBand>,
      { wrapper: App },
    );
    expect(await screen.findByText('Today')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a notice, drawn', () => {
  it('says Jonz cannot be reached, with no close and a way to try again', async () => {
    const retry = jest.fn();
    await render(
      <NoticeView
        tone="status"
        icon={WifiOffIcon}
        title="We can’t reach Jonz right now."
        body="Showing what you saw last."
        action={{ label: 'Try now', onPress: retry }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Close notice' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'Try now' }));
    expect(retry).toHaveBeenCalled();
  });
});
