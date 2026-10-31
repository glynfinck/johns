import { ERROR_COPY, FOCUS_SHELL_COPY, NOT_FOUND_COPY, PRIVACY_POLICY, TERMS } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter, screen as routed } from 'expo-router/testing-library';
import { Text } from 'react-native';

import NotFound from '@/app/+not-found';
import { ErrorBoundary } from '@/app/_layout';
import Privacy from '@/app/privacy';
import Terms from '@/app/terms';
import { useMembership } from '@/hooks/use-membership';

// The root layout's module brings sign-in with it; these pages don't need it.
jest.mock('@/hooks/use-membership', () => ({ MembershipProvider: ({ children }: { children: unknown }) => children, useMembership: jest.fn() }));
jest.mock('@/api/account', () => ({ keepAccount: jest.fn() }));
jest.mock('@/api/auth', () => ({ signOut: jest.fn() }));

it.each([
  ['the Privacy Policy', Privacy, PRIVACY_POLICY],
  ['the Terms', Terms, TERMS],
] as const)('shows %s whole, every section under its heading', async (_, Page, page) => {
  await render(<Page />);
  expect(screen.getByRole('header', { name: page.title })).toBeOnTheScreen();
  expect(screen.getByText(page.updated)).toBeOnTheScreen();
  expect(screen.getByText(page.lead)).toBeOnTheScreen();
  for (const { heading, body, links } of page.sections) {
    expect(screen.getByRole('header', { name: heading })).toBeOnTheScreen();
    for (const paragraph of body) expect(screen.getByText(paragraph)).toBeOnTheScreen();
    for (const link of links ?? []) expect(screen.getByRole('link', { name: link.label })).toHaveProp('href', link.href);
  }
});

it('goes back to the front door from privacy opened cold', async () => {
  await renderRouter({ index: () => <Text>Front door</Text>, privacy: Privacy }, { initialUrl: '/privacy' });
  await fireEvent.press(routed.getByRole('button', { name: FOCUS_SHELL_COPY.back }));
  expect(routed).toHavePathname('/');
  expect(routed.getByText('Front door')).toBeOnTheScreen();
});

it('turns a link to nowhere back to your Johns', async () => {
  jest.mocked(useMembership).mockReturnValue({ session: { user: { id: 'sam' } } } as ReturnType<typeof useMembership>);
  await render(<NotFound />);
  expect(screen.getByRole('header', { name: NOT_FOUND_COPY.title })).toBeOnTheScreen();
  expect(screen.getByText(NOT_FOUND_COPY.body)).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: NOT_FOUND_COPY.back })).toHaveProp('href', '/');
});

it('turns a link to nowhere back to the front door when signed out', async () => {
  jest.mocked(useMembership).mockReturnValue({ session: null } as ReturnType<typeof useMembership>);
  await render(<NotFound />);
  expect(screen.getByRole('link', { name: NOT_FOUND_COPY.backToDoor })).toHaveProp('href', '/');
  expect(screen.queryByRole('link', { name: NOT_FOUND_COPY.back })).toBeNull();
});

it('says a screen broke, and tries it again', async () => {
  const retry = jest.fn(async () => {});
  await render(<ErrorBoundary error={new Error('boom')} retry={retry} />);
  expect(screen.getByRole('header', { name: ERROR_COPY.title })).toBeOnTheScreen();
  expect(screen.getByText(ERROR_COPY.body)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: ERROR_COPY.retry }));
  expect(retry).toHaveBeenCalled();
});
