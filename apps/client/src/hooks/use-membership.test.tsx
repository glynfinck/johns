import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { deletionStatus } from '@/api/account';
import { getMyHouse } from '@/api/house';
import { MembershipProvider, useMembership } from '@/hooks/use-membership';
import { useSession } from '@/hooks/use-session';

jest.mock('@/api/house', () => ({ getMyHouse: jest.fn() }));
jest.mock('@/api/account', () => ({ deletionStatus: jest.fn().mockResolvedValue(null) }));
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('@/api/microsoft-photo', () => ({ followMicrosoftSignIns: () => () => undefined }));

const myHouse = getMyHouse as jest.Mock;
const session = useSession as jest.Mock;
const FLAT = { id: 'h1', name: 'Flat 3' };

function Probe() {
  const { loading, failed, house, refresh } = useMembership();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="refresh" onPress={() => void refresh()}>
      <Text>{loading ? 'loading' : failed ? 'failed' : (house?.name ?? 'no house')}</Text>
    </Pressable>
  );
}

async function mount() {
  await render(
    <MembershipProvider>
      <Probe />
    </MembershipProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

it('knows nothing until the saved session has been read', async () => {
  session.mockReturnValue({ session: null, loading: true });
  await mount();
  expect(screen.getByText('loading')).toBeOnTheScreen();
});

it('is in no house, and reads none, when signed out', async () => {
  session.mockReturnValue({ session: null, loading: false });
  await mount();
  expect(screen.getByText('no house')).toBeOnTheScreen();
  expect(myHouse).not.toHaveBeenCalled();
});

it("stays loading until the signed-in person's house has been read", async () => {
  let answer!: (house: typeof FLAT) => void;
  myHouse.mockReturnValue(new Promise((resolve) => (answer = resolve)));
  session.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  await mount();
  expect(screen.getByText('loading')).toBeOnTheScreen();
  await act(async () => answer(FLAT));
  expect(screen.getByText('Flat 3')).toBeOnTheScreen();
  expect(myHouse).toHaveBeenCalledWith('u1');
});

it('reads the house again on refresh, after creating or joining one', async () => {
  myHouse.mockResolvedValueOnce(null).mockResolvedValueOnce(FLAT);
  session.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  await mount();
  expect(await screen.findByText('no house')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'refresh' }));
  expect(await screen.findByText('Flat 3')).toBeOnTheScreen();
});

it("says so when the house can't be read, rather than claiming there's none", async () => {
  myHouse.mockRejectedValue(new Error('offline'));
  session.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  await mount();
  expect(await screen.findByText('failed')).toBeOnTheScreen();
});

it('needs a provider', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(render(<Probe />)).rejects.toThrow('MembershipProvider');
});

it('knows when the account is waiting to be deleted, and lets the house decide if it can’t tell', async () => {
  function Deleting() {
    const { loading, deletion } = useMembership();
    return <Text>{loading ? 'loading' : (deletion?.deleteAfter ?? 'staying')}</Text>;
  }
  session.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false });
  myHouse.mockResolvedValue(FLAT);
  jest.mocked(deletionStatus).mockResolvedValueOnce({ deleteAfter: '2026-11-29T09:00:00Z', requestedBy: 'self' });
  const view = await render(
    <MembershipProvider>
      <Deleting />
    </MembershipProvider>,
  );
  expect(await screen.findByText('2026-11-29T09:00:00Z')).toBeOnTheScreen();
  view.unmount();

  jest.mocked(deletionStatus).mockRejectedValueOnce(new Error('offline'));
  await render(
    <MembershipProvider>
      <Deleting />
    </MembershipProvider>,
  );
  expect(await screen.findByText('staying')).toBeOnTheScreen();
});
