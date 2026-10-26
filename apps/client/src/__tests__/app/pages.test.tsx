import { ERROR_COPY, FOCUS_SHELL_COPY, FRONT_DOOR_COPY, NOT_FOUND_COPY, PRIVACY_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter, screen as routed } from 'expo-router/testing-library';
import { Text } from 'react-native';

import NotFound from '@/app/+not-found';
import { ErrorBoundary } from '@/app/_layout';
import Privacy from '@/app/privacy';

// The root layout's module brings sign-in with it; these pages don't need it.
jest.mock('@/hooks/use-membership', () => ({ MembershipProvider: ({ children }: { children: unknown }) => children, useMembership: jest.fn() }));

it('says what Johns keeps, and who sees it, in the web’s words under headings', async () => {
  await render(<Privacy />);
  expect(screen.getByRole('header', { name: PRIVACY_COPY.title })).toBeOnTheScreen();
  for (const { heading, body } of FRONT_DOOR_COPY.privacy) {
    expect(screen.getByRole('header', { name: heading })).toBeOnTheScreen();
    for (const paragraph of body) expect(screen.getByText(paragraph)).toBeOnTheScreen();
  }
  for (const p of PRIVACY_COPY.paragraphs.slice(0, 3)) expect(screen.getByText(p)).toBeOnTheScreen();
});

it('goes back to the front door from privacy opened cold', async () => {
  await renderRouter({ index: () => <Text>Front door</Text>, privacy: Privacy }, { initialUrl: '/privacy' });
  await fireEvent.press(routed.getByRole('button', { name: FOCUS_SHELL_COPY.back }));
  expect(routed).toHavePathname('/');
  expect(routed.getByText('Front door')).toBeOnTheScreen();
});

it('turns a link to nowhere back to your Johns', async () => {
  await render(<NotFound />);
  expect(screen.getByRole('header', { name: NOT_FOUND_COPY.title })).toBeOnTheScreen();
  expect(screen.getByText(NOT_FOUND_COPY.body)).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: NOT_FOUND_COPY.back })).toHaveProp('href', '/');
});

it('says a screen broke, and tries it again', async () => {
  const retry = jest.fn(async () => {});
  await render(<ErrorBoundary error={new Error('boom')} retry={retry} />);
  expect(screen.getByRole('header', { name: ERROR_COPY.title })).toBeOnTheScreen();
  expect(screen.getByText(ERROR_COPY.body)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: ERROR_COPY.retry }));
  expect(retry).toHaveBeenCalled();
});
