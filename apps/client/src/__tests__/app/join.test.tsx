import { JOIN_COPY, signInReason } from '@app/core';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { houseByCode, joinHouse } from '@/api/house';
import Join from '@/app/join/[joinCode]';
import { useMembership } from '@/hooks/use-membership';

jest.mock('@/api/house', () => ({ houseByCode: jest.fn(), joinHouse: jest.fn() }));
jest.mock('@/api/auth', () => ({
  appleSignInAvailable: jest.fn(async () => false),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));
jest.mock('@/hooks/use-membership', () => ({ useMembership: jest.fn() }));

const byCode = houseByCode as jest.Mock;
const join = joinHouse as jest.Mock;
const membership = useMembership as jest.Mock;
const refresh = jest.fn();
const FLAT = { id: 'h1', name: 'Flat 3', members: 3 };
const ME = { user: { id: 'u1' } };

function as(session: object | null, house: { id: string; name: string } | null = null) {
  membership.mockReturnValue({ session, house, refresh });
}

async function open(code = 'AB3DEF7H') {
  await renderRouter(
    { 'join/[joinCode]': Join, today: () => <Text>Today</Text>, welcome: () => <Text>Welcome</Text> },
    { initialUrl: `/join/${code}` },
  );
}

beforeEach(() => jest.clearAllMocks());

it('signs you in right there when signed out, without naming the house', async () => {
  as(null);
  await open();
  expect(screen.getByText(signInReason('/join/AB3DEF7H'))).toBeOnTheScreen();
  expect(byCode).not.toHaveBeenCalled();
});

it('names the house and how many live there, and joins it', async () => {
  as(ME);
  byCode.mockResolvedValue(FLAT);
  join.mockResolvedValue('h1');
  await open();
  expect(await screen.findByRole('header', { name: 'Flat 3' })).toBeOnTheScreen();
  expect(screen.getByText(JOIN_COPY.livesHere(3))).toBeOnTheScreen();
  expect(byCode).toHaveBeenCalledWith('AB3DEF7H');

  await fireEvent.press(screen.getByRole('button', { name: JOIN_COPY.join('Flat 3') }));
  expect(join).toHaveBeenCalledWith('AB3DEF7H');
  expect(refresh).toHaveBeenCalled();
  expect(screen).toHavePathname('/today');
});

it('says what went wrong joining, and stays', async () => {
  as(ME);
  byCode.mockResolvedValue(FLAT);
  join.mockRejectedValue(new Error("You're already in a house. Leave it first to join another."));
  await open();
  await fireEvent.press(await screen.findByRole('button', { name: JOIN_COPY.join('Flat 3') }));
  expect(screen.getByRole('alert')).toHaveTextContent("You're already in a house. Leave it first to join another.");
  expect(screen).toHavePathname('/join/AB3DEF7H');
});

it("says a link that matches no house doesn't work", async () => {
  as(ME);
  byCode.mockResolvedValue(null);
  await open('ZZZZZZZZ');
  expect(await screen.findByRole('header', { name: JOIN_COPY.badLink })).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: JOIN_COPY.back })).toHaveProp('href', '/welcome');
});

it("doesn't offer to join a house you're already in, or a second one", async () => {
  as(ME, { id: 'h1', name: 'Flat 3' });
  byCode.mockResolvedValue(FLAT);
  await open();
  expect(await screen.findByRole('header', { name: JOIN_COPY.alreadyIn('Flat 3') })).toBeOnTheScreen();

  as(ME, { id: 'h2', name: 'Number 9' });
  await open();
  expect(await screen.findByRole('header', { name: JOIN_COPY.otherHouse })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: JOIN_COPY.join('Flat 3') })).toBeNull();
});
