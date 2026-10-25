import { ERROR_COPY, NOT_FOUND_COPY, PRIVACY_COPY } from '@app/core';
import { fireEvent, render, screen } from '@testing-library/react-native';

import NotFound from '@/app/+not-found';
import { ErrorBoundary } from '@/app/_layout';
import Privacy from '@/app/privacy';

// The root layout's module brings sign-in with it; these pages don't need it.
jest.mock('@/hooks/use-membership', () => ({ MembershipProvider: ({ children }: { children: unknown }) => children, useMembership: jest.fn() }));

it('says what Johns keeps, and who sees it, as the web does', async () => {
  await render(<Privacy />);
  expect(screen.getByRole('header', { name: PRIVACY_COPY.title })).toBeOnTheScreen();
  for (const p of PRIVACY_COPY.paragraphs) expect(screen.getByText(p)).toBeOnTheScreen();
  expect(screen.getByRole('link', { name: 'Johns' })).toHaveProp('href', '/');
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
