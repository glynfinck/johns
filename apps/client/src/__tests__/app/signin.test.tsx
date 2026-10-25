import { SIGN_IN_COPY, signInReason } from '@app/core';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { appleSignInAvailable, signInWithApple, signInWithGoogle } from '@/api/auth';
import SignIn from '@/app/signin';

jest.mock('@/api/auth', () => ({
  appleSignInAvailable: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

// Apple's button is a native view; a plain button stands in for it.
jest.mock('expo-apple-authentication', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AppleAuthenticationButton: ({ onPress, testID }: { onPress: () => void; testID?: string }) =>
      createElement(Pressable, { accessibilityRole: 'button', onPress, testID }, createElement(Text, null, 'Continue with Apple')),
    AppleAuthenticationButtonType: { CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { WHITE: 0, BLACK: 2 },
  };
});

const available = appleSignInAvailable as jest.Mock;
const google = signInWithGoogle as jest.Mock;
const apple = signInWithApple as jest.Mock;

async function open(url = '/signin') {
  await renderRouter({ signin: SignIn }, { initialUrl: url });
}

beforeEach(() => {
  jest.clearAllMocks();
  available.mockResolvedValue(false);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('sign-in on Android and the web', () => {
  it('offers Google alone, with the web’s words', async () => {
    await open();
    expect(screen.getByRole('header', { name: SIGN_IN_COPY.heading })).toBeOnTheScreen();
    expect(screen.getByText(signInReason(null))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: SIGN_IN_COPY.google })).toBeOnTheScreen();
    expect(screen.queryByTestId('apple-sign-in')).toBeNull();
    expect(screen.queryByText(SIGN_IN_COPY.sameAccount)).toBeNull();
    expect(screen.getByRole('link', { name: SIGN_IN_COPY.privacy })).toBeOnTheScreen();
  });

  it('signs in with Google, and a closed sheet is no failure', async () => {
    google.mockResolvedValue('cancelled');
    await open();
    await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.google }));
    expect(google).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: SIGN_IN_COPY.google })).toBeEnabled();
  });

  it('stays busy while the web leaves for Google', async () => {
    google.mockResolvedValue('redirected');
    await open();
    await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.google }));
    expect(screen.getByRole('button', { name: SIGN_IN_COPY.googleBusy })).toBeDisabled();
  });

  it('says so when Google fails, and lets you try again', async () => {
    google.mockRejectedValue(new Error('DEVELOPER_ERROR'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: SIGN_IN_COPY.google }));
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_COPY.failed('Google'));
    expect(screen.getByRole('button', { name: SIGN_IN_COPY.google })).toBeEnabled();
  });

  it('says so when Google sends the web back with an error', async () => {
    await open('/signin?error=access_denied');
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_COPY.failed('Google'));
  });
});

describe('sign-in on iOS', () => {
  beforeEach(() => available.mockResolvedValue(true));

  it('offers Apple first, and warns that a second account starts with no house', async () => {
    await open();
    expect(await screen.findByTestId('apple-sign-in')).toBeOnTheScreen();
    expect(screen.getByText(SIGN_IN_COPY.eitherAccount)).toBeOnTheScreen();
    expect(screen.getByText(SIGN_IN_COPY.sameAccount)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: SIGN_IN_COPY.google })).toBeOnTheScreen();
  });

  it('signs in with Apple, and names Apple when it fails', async () => {
    apple.mockRejectedValue(new Error('invalid nonce'));
    await open();
    await act(async () => {
      fireEvent.press(await screen.findByTestId('apple-sign-in'));
    });
    expect(apple).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent(SIGN_IN_COPY.failed('Apple'));
  });
});
