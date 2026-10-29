import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, Pressable, Text } from 'react-native';

import { TOAST_ACTION_MS, TOAST_MS, ToastProvider, useToast } from './toast';

function Speaker({ message = 'Vote counted.' }: { message?: string }) {
  const toast = useToast();
  return (
    <Pressable accessibilityRole="button" onPress={() => toast.show(message)}>
      <Text>{`Say ${message}`}</Text>
    </Pressable>
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('says a short message in a polite live region, then lets it go', async () => {
  await render(
    <ToastProvider>
      <Speaker />
    </ToastProvider>,
  );
  const region = screen.getByTestId('toast-region');
  expect(region).toHaveProp('role', 'status');
  expect(region).toHaveProp('accessibilityLiveRegion', 'polite');
  expect(screen.queryByTestId('toast')).toBeNull();

  await fireEvent.press(screen.getByRole('button'));
  expect(screen.getByTestId('toast')).toHaveTextContent('Vote counted.');
  await act(() => jest.advanceTimersByTime(TOAST_MS - 1));
  expect(screen.getByTestId('toast')).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByTestId('toast')).toBeNull();
});

it('shows one at a time, the latest, for its own full time', async () => {
  await render(
    <ToastProvider>
      <Speaker message="Ticked." />
      <Speaker message="Undone." />
    </ToastProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Say Ticked.' }));
  await act(() => jest.advanceTimersByTime(TOAST_MS - 1000));
  await fireEvent.press(screen.getByRole('button', { name: 'Say Undone.' }));
  expect(screen.getAllByTestId('toast')).toHaveLength(1);
  expect(screen.getByTestId('toast')).toHaveTextContent('Undone.');
  await act(() => jest.advanceTimersByTime(TOAST_MS - 1));
  expect(screen.getByTestId('toast')).toBeOnTheScreen();
});

it('announces itself on iOS, which has no live regions', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  await render(
    <ToastProvider>
      <Speaker />
    </ToastProvider>,
  );
  await fireEvent.press(screen.getByRole('button'));
  expect(announce).toHaveBeenCalledWith('Vote counted.');
});

it('needs the provider above it', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(render(<Speaker />)).rejects.toThrow(/ToastProvider/);
});

it('offers its one button for longer, and goes once it is pressed', async () => {
  const undo = jest.fn();
  function Offer() {
    const toast = useToast();
    return (
      <Pressable accessibilityRole="button" onPress={() => toast.show('Marked done.', { label: 'Undo', onPress: undo })}>
        <Text>Tick</Text>
      </Pressable>
    );
  }
  await render(
    <ToastProvider>
      <Offer />
    </ToastProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Tick' }));
  await act(() => jest.advanceTimersByTime(TOAST_MS));
  expect(screen.getByTestId('toast')).toHaveTextContent('Marked done.Undo');
  expect(screen.getByRole('button', { name: 'Undo: Marked done.' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('toast-action'));
  expect(undo).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('toast')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Tick' }));
  await act(() => jest.advanceTimersByTime(TOAST_ACTION_MS - 1));
  expect(screen.getByTestId('toast')).toBeOnTheScreen();
  await act(() => jest.advanceTimersByTime(1));
  expect(screen.queryByTestId('toast')).toBeNull();
});
