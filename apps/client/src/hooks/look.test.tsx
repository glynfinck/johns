import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text, useColorScheme } from 'react-native';

import { authStorage } from '@/api/storage';
import { useTheme } from '@/theme';

import { LookProvider, useLook } from './look';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn(() => 'light') }));

/** What a screen sees: the look chosen and the scheme the theme draws in, and a way to choose. */
function Probe() {
  const [look, setLook] = useLook();
  return (
    <>
      <Text testID="probe">{`${look} ${useTheme().scheme}`}</Text>
      {(['light', 'dark', 'system'] as const).map((l) => (
        <Pressable key={l} accessibilityRole="button" accessibilityLabel={l} onPress={() => setLook(l)} />
      ))}
    </>
  );
}

const choose = (look: string) => fireEvent.press(screen.getByRole('button', { name: look }));

beforeEach(() => {
  authStorage!.clear();
  (useColorScheme as jest.Mock).mockReturnValue('light');
});

it("follows the device's scheme until a look is chosen", async () => {
  (useColorScheme as jest.Mock).mockReturnValue('dark');
  await render(
    <LookProvider>
      <Probe />
    </LookProvider>,
  );
  expect(screen.getByTestId('probe')).toHaveTextContent('system dark');
});

it('remembers a chosen look on this device, under the key the old site used', async () => {
  await render(
    <LookProvider>
      <Probe />
    </LookProvider>,
  );
  await choose('dark');
  expect(screen.getByTestId('probe')).toHaveTextContent('dark dark');
  expect(authStorage!.getItem('theme')).toBe('dark');
  await choose('system');
  expect(screen.getByTestId('probe')).toHaveTextContent('system light');
});

it('starts from the look saved before, and ignores anything it does not know', async () => {
  authStorage!.setItem('theme', 'dark');
  const { unmount } = await render(
    <LookProvider>
      <Probe />
    </LookProvider>,
  );
  expect(screen.getByTestId('probe')).toHaveTextContent('dark dark');
  await unmount();
  authStorage!.setItem('theme', 'sepia');
  await render(
    <LookProvider>
      <Probe />
    </LookProvider>,
  );
  expect(screen.getByTestId('probe')).toHaveTextContent('system light');
});

it("still applies a look the device can't remember", async () => {
  jest.spyOn(authStorage!, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await render(
    <LookProvider>
      <Probe />
    </LookProvider>,
  );
  await choose('dark');
  expect(screen.getByTestId('probe')).toHaveTextContent('dark dark');
  jest.restoreAllMocks();
});

it('without a provider, the system decides', async () => {
  (useColorScheme as jest.Mock).mockReturnValue('dark');
  await render(<Probe />);
  expect(screen.getByTestId('probe')).toHaveTextContent('system dark');
});
